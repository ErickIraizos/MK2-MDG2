import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { AppError } from '../core/AppError.js';
import { getBoliviaTodayDateString } from '../utils/dateTime.js';
import { storageService, PRIVATE_BUCKET, extractStorageKey } from './storageService.js';

export class ClinicalRecordService {
  constructor() {
    this.recordRepo = RepositoryFactory.getClinicalRecordRepository();
    this.patientRepo = RepositoryFactory.getPatientRepository();
    this.therapistRepo = RepositoryFactory.getTherapistRepository();
    this.configRepo = RepositoryFactory.getConfigRepository();
    this.userRepo = RepositoryFactory.getUserRepository();
  }

  /**
   * Valida que el terapeuta en sesión solo acceda a pacientes asignados a su cargo (Secreto Profesional y RBAC).
   * La Dirección Médica (ADMIN) cuenta con acceso total de auditoría.
   * Si allowTutor es true y el rol es TUTOR, valida tutela legal activa en paciente_tutor.
   */
  async _assertTherapistAccess(historyOrPatient, currentUser, actionDescription = 'consultar este expediente', allowTutor = false) {
    if (currentUser.rol === 'ADMIN') return null;

    if (currentUser.rol === 'TERAPEUTA') {
      const therapist = await this.therapistRepo.findByUserId(currentUser.id);
      const assignedTherapistId = historyOrPatient.terapeuta_id || historyOrPatient.paciente_terapeuta_id;
      if (!therapist || assignedTherapistId !== therapist.id) {
        throw AppError.forbidden(
          `Acceso confidencial restringido: Solo el especialista tratante asignado o la Dirección Médica pueden ${actionDescription}.`
        );
      }
      return therapist;
    }

    if (currentUser.rol === 'TUTOR' && allowTutor) {
      const pacienteId = historyOrPatient.paciente_id || historyOrPatient.id;
      const relation = await this.recordRepo.checkTutorPatientRelation(pacienteId, currentUser.id);

      if (!relation) {
        throw AppError.forbidden(
          `Acceso confidencial denegado: El tutor no tiene tutela legal registrada sobre este paciente para ${actionDescription}.`
        );
      }
      return null;
    }

    throw AppError.forbidden('Acceso denegado: Rol no autorizado para operar expedientes clínicos.');
  }

  /**
   * Obtiene la lista paginada de historias clínicas.
   * Si el usuario es TERAPEUTA, se filtra OBLIGATORIAMENTE por sus pacientes asignados.
   */
  async getAllHistories(options = {}, currentUser) {
    const filterOptions = { ...options };

    if (currentUser.rol === 'TERAPEUTA') {
      const therapist = await this.therapistRepo.findByUserId(currentUser.id);
      if (!therapist) {
        return { records: [], total: 0 };
      }
      filterOptions.terapeutaId = therapist.id;
    }

    return await this.recordRepo.findAllHistories(filterOptions);
  }

  /**
   * Obtiene o abre automáticamente la historia clínica de un paciente (RF-E01).
   */
  async getHistoryByPatientId(pacienteId, currentUser) {
    const patient = await this.patientRepo.findById(pacienteId);
    if (!patient) {
      throw AppError.notFound(`El paciente con ID [${pacienteId}] no existe.`);
    }

    await this._assertTherapistAccess(patient, currentUser, 'abrir o consultar este expediente clínico');

    let history = await this.recordRepo.findHistoryByPatientId(pacienteId);

    // RF-E01: Apertura automática de Expediente Clínico si aún no existe
    if (!history) {
      history = await this.recordRepo.createHistory({
        pacienteId: patient.id,
        numeroExpediente: patient.codigo_expediente,
        fechaApertura: getBoliviaTodayDateString(),
        estado: patient.estado_clinico || 'ACTIVO',
        observacionesIngreso: `Expediente clínico abierto automáticamente para ${patient.nombres} ${patient.apellidos}.`
      });

      // Registrar auditoría de apertura
      this._audit(currentUser.id, 'APERTURA_HISTORIA_CLINICA', 'MODULO_E', {
        paciente_id: patient.id,
        codigo_expediente: patient.codigo_expediente
      });
    }

    const anamnesis = await this.recordRepo.getAnamnesisByHistoryId(history.id);
    const soapNotes = await this.recordRepo.findSoapNotesByHistoryId(history.id);
    const consentRepo = RepositoryFactory.getConsentRepository();
    const hasConsent = await consentRepo.hasActiveConsent(history.paciente_id);

    return {
      history,
      anamnesis,
      soapNotes,
      hasConsent
    };
  }

  /**
   * Obtiene un expediente por su ID con anamnesis y notas SOAP.
   */
  async getHistoryById(id, currentUser) {
    const history = await this.recordRepo.findHistoryById(id);
    if (!history) {
      throw AppError.notFound(`La historia clínica con ID [${id}] no fue encontrada.`);
    }

    await this._assertTherapistAccess(history, currentUser, 'consultar este expediente clínico');

    const anamnesis = await this.recordRepo.getAnamnesisByHistoryId(history.id);
    const soapNotes = await this.recordRepo.findSoapNotesByHistoryId(history.id);
    const consentRepo = RepositoryFactory.getConsentRepository();
    const hasConsent = await consentRepo.hasActiveConsent(history.paciente_id);

    return {
      history,
      anamnesis,
      soapNotes,
      hasConsent
    };
  }

  /**
   * Actualiza el estado clínico del expediente.
   */
  async updateHistoryStatus(id, { estado, observaciones }, currentUser) {
    const validStates = ['ACTIVO', 'EN_EVALUACION', 'ALTA', 'SUSPENDIDO'];
    if (!validStates.includes(estado)) {
      throw new Error(`Estado no válido. Opciones permitidas: ${validStates.join(', ')}`);
    }

    const updated = await this.recordRepo.updateHistoryStatus(id, estado, observaciones);

    // Sincronizar estado en la ficha del paciente
    if (updated.paciente_id) {
      await this.recordRepo.syncPatientClinicalState(updated.paciente_id, estado);
    }

    this._audit(currentUser.id, 'CAMBIO_ESTADO_HISTORIA', 'MODULO_E', {
      historia_id: id,
      nuevo_estado: estado,
      observaciones
    });

    return updated;
  }

  /**
   * Guarda o actualiza la Anamnesis / Evaluación Inicial (Módulo E).
   */
  async saveAnamnesis(historiaId, data, currentUser) {
    if (!data.motivoConsulta || data.motivoConsulta.trim() === '') {
      throw AppError.badRequest('El motivo de consulta es obligatorio para la anamnesis.');
    }

    const history = await this.recordRepo.findHistoryById(historiaId);
    if (!history) {
      throw AppError.notFound(`La historia clínica [${historiaId}] no existe.`);
    }

    await this._assertTherapistAccess(history, currentUser, 'registrar o modificar la anamnesis de este paciente');

    const anamnesisData = {
      ...data,
      evaluadorId: data.evaluadorId || currentUser.id,
      fechaEvaluacion: data.fechaEvaluacion || getBoliviaTodayDateString()
    };

    const saved = await this.recordRepo.saveAnamnesis(historiaId, anamnesisData);

    this._audit(currentUser.id, 'REGISTRO_ANAMNESIS', 'MODULO_E', {
      historia_id: historiaId,
      paciente_id: history.paciente_id,
      evaluador_id: anamnesisData.evaluadorId
    });

    return saved;
  }

  /**
   * Registra una Nota de Evolución SOAP con firma digital y sello inalterable (RN-07).
   */
  async createSoapNote(data, currentUser) {
    const { historiaId, pacienteId, subjetivo, objetivo, analisis, plan } = data;

    if (!historiaId || !pacienteId) {
      throw AppError.badRequest('Se requiere historiaId y pacienteId para registrar la nota SOAP.');
    }

    if (!subjetivo || !objetivo || !analisis || !plan) {
      throw AppError.badRequest('Los 4 pilares SOAP (Subjetivo, Objetivo, Análisis, Plan) son obligatorios.');
    }

    const history = await this.recordRepo.findHistoryById(historiaId);
    if (!history) {
      throw AppError.notFound(`La historia clínica con ID [${historiaId}] no fue encontrada.`);
    }

    // Validación de confidencialidad médica y secreto profesional
    const loggedTherapist = await this._assertTherapistAccess(history, currentUser, 'registrar notas de evolución SOAP para este paciente');

    // Determinar terapeuta responsable y snapshot de firma profesional
    let terapeutaId = data.terapeutaId;
    let firmaSnapshot = data.firmaDigitalSnapshot;

    if (loggedTherapist) {
      terapeutaId = loggedTherapist.id;
      firmaSnapshot = `${loggedTherapist.nombres} ${loggedTherapist.apellidos} · Matrícula ${loggedTherapist.registro_profesional || 'CPB'}`;
    } else if (!terapeutaId) {
      // Si es ADMIN, usar el terapeuta asignado a la historia/paciente o la dirección médica
      if (history.terapeuta_id) {
        terapeutaId = history.terapeuta_id;
        firmaSnapshot = `${history.terapeuta_nombres} ${history.terapeuta_apellidos} · Matrícula ${history.terapeuta_matricula || 'CPB'}`;
      } else {
        terapeutaId = 1; // Default Dirección Médica
        firmaSnapshot = `${currentUser.nombre_completo} (${currentUser.rol})`;
      }
    }

    if (!firmaSnapshot) {
      const t = await this.therapistRepo.findById(terapeutaId);
      firmaSnapshot = t ? `${t.nombres} ${t.apellidos} · Matrícula ${t.registro_profesional || 'CPB'}` : currentUser.nombre_completo;
    }

    // Autoincremento consecutivo estricto por cada paciente / historia clínica
    const nextSession = await this.recordRepo.getNextSessionNumber(historiaId);
    const numeroSesion = (Number(data.numeroSesion) && Number(data.numeroSesion) === nextSession)
      ? nextSession
      : nextSession;

    const notePayload = {
      historiaId,
      pacienteId,
      terapeutaId,
      usuarioId: currentUser.id,
      numeroSesion,
      fechaSesion: data.fechaSesion || getBoliviaTodayDateString(),
      horaInicio: data.horaInicio || null,
      horaFin: data.horaFin || null,
      ambienteId: data.ambienteId || null,
      subjetivo: subjetivo.trim(),
      objetivo: objetivo.trim(),
      analisis: analisis.trim(),
      plan: plan.trim(),
      diagnosticoCodigo: data.diagnosticoCodigo || null,
      diagnosticoGlosa: data.diagnosticoGlosa || null,
      recomendacionesHogar: data.recomendacionesHogar || null,
      asistidoPorIa: !!data.asistidoPorIa,
      firmaDigitalSnapshot: firmaSnapshot
    };

    const createdNote = await this.recordRepo.createSoapNote(notePayload);

    this._audit(currentUser.id, 'NOTA_SOAP_REGISTRADA', 'MODULO_E', {
      historia_id: historiaId,
      paciente_id: pacienteId,
      numero_sesion: createdNote.numero_sesion,
      terapeuta_id: terapeutaId,
      asistido_ia: createdNote.asistido_por_ia
    });

    return createdNote;
  }

  /**
   * Asistente de redacción SOAP mediante IA (GroqCloud / Fallback local) con sanitización biomédica previa (RN-04).
   */
  async assistSoapWithAi({ roughNotes, patientContext = {}, areaClinica = 'General' }, currentUser) {
    if (!roughNotes || roughNotes.trim().length < 5) {
      throw new Error('Debe proveer apuntes o notas del terapeuta para que el asistente pueda estructurarlas.');
    }

    // Anonimización biomédica estricta (RN-04)
    const sanitizedNotes = this._sanitizeText(roughNotes);

    const systemPrompt = `Eres un especialista clínico senior del Centro Psicopedagógico y Psicológico "PSI Aprende" (Cochabamba, Bolivia).
Tu tarea es tomar las notas rápidas o apuntes informales de una sesión terapéutica y estructurarlos en formato clínico profesional SOAP:
- S (Subjetivo): Lo que refiere el tutor, paciente o escuela sobre la conducta semanal o sintomatología.
- O (Objetivo): Observaciones clínicas directas en consultorio, tareas aplicadas, rendimiento y conductas concretas.
- A (Análisis / Apreciación): Interpretación diagnóstica, hipótesis clínica y análisis de avance según criterios psicológicos/neurocognitivos.
- P (Plan): Objetivos de la próxima sesión y tareas/indicaciones terapéuticas.

Debes responder ÚNICAMENTE un objeto JSON válido con las siguientes claves:
{
  "subjetivo": "Texto formal para S",
  "objetivo": "Texto formal para O",
  "analisis": "Texto formal para A",
  "plan": "Texto formal para P",
  "diagnosticoSugerido": "Código y glosa nosológica sugerida (CIE-11 o DSM-5) o null",
  "recomendacionesHogar": "Pauta clara y comprensible para entregar a los padres o cuidadores"
}`;

    const userPrompt = `Área clínica: ${areaClinica}
Contexto del caso (edad/motivo general): ${patientContext.motivo || 'Evaluación neurocognitiva integral'}
Apuntes rápidos del terapeuta:
"""
${sanitizedNotes}
"""
Por favor, estructura estos apuntes en formato formal SOAP manteniendo total veracidad con los hechos descritos.`;

    try {
      const apiKey = await this.configRepo.getByKey('GROQ_API_KEY');
      const isDemoKey = !apiKey || apiKey.startsWith('gsk_demo_') || apiKey.length < 20;

      if (!isDemoKey) {
        const model = (await this.configRepo.getByKey('GROQ_MODEL_PRIMARY')) || 'openai/gpt-oss-120b';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' }
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const rawContent = data.choices?.[0]?.message?.content;
          if (rawContent) {
            const parsed = JSON.parse(rawContent);
            return {
              success: true,
              motor: 'GROQ_CLOUD',
              soap: parsed
            };
          }
        }
      }
    } catch (err) {
      console.warn('[ClinicalRecordService] Inferencia GroqCloud falló o timeout:', err.message);
    }

    // Fallback heurístico local estructurado si la IA no está disponible
    return {
      success: true,
      motor: 'FALLBACK_LOCAL_ESTRUCTURADO',
      soap: this._generateFallbackSoap(sanitizedNotes, areaClinica)
    };
  }

  _generateFallbackSoap(notes, area) {
    return {
      subjetivo: `El paciente y/o tutor manifiesta las siguientes observaciones preliminares: ${notes.substring(0, 150)}. Se evidencia motivación para el abordaje terapéutico.`,
      objetivo: `Durante la sesión se realizaron actividades de exploración clínica correspondientes al área de ${area}. Se aplicaron ejercicios de focalización y evaluación de habilidades funcionales según lo reportado: ${notes}.`,
      analisis: `El desempeño general del paciente concuerda con las pautas de evolución esperadas. Se identifican áreas de oportunidad neurocognitiva y conductual a ser reforzadas en el plan terapéutico.`,
      plan: `Continuar con el protocolo de estimulación en la siguiente sesión programada. Reforzar el control de estímulos en el entorno familiar y escolar.`,
      diagnosticoSugerido: area.includes('Neuro') ? '6A05 (Trastorno por Déficit de Atención con Hiperactividad)' : '6A03 (Trastorno del Aprendizaje)',
      recomendacionesHogar: `Mantener rutinas estructuradas en el hogar, felicitando explícitamente los avances cotidianos del paciente.`
    };
  }

  // =========================================================================
  // SPRINT 5: CATÁLOGO NOSOLÓGICO, CARPETAS DIGITALES Y PLANES SMART
  // =========================================================================

  /**
   * Busca diagnósticos en el catálogo nosológico CIE-11 / DSM-5.
   */
  async searchDiagnostics({ query = '', categoria = null }) {
    return await this.recordRepo.searchDiagnostics(query, categoria);
  }

  /**
   * Obtiene las carpetas digitales de un paciente con filtrado RBAC por terapeuta.
   */
  async getPatientFolders(pacienteId, currentUser, includeInactive = false) {
    const patient = await this.patientRepo.findById(pacienteId);
    if (!patient) throw AppError.notFound(`Paciente [${pacienteId}] no encontrado.`);

    await this._assertTherapistAccess(patient, currentUser, 'consultar las carpetas de este paciente');
    return await this.recordRepo.getFoldersByPatientId(pacienteId, includeInactive, currentUser);
  }

  /**
   * Actualiza el estado activo/inactivo de una carpeta (Soft-deactivate/reactivate con motivo de baja).
   */
  async updateFolderStatus(pacienteId, folderId, activo, currentUser, motivoBaja = null) {
    const patient = await this.patientRepo.findById(pacienteId);
    if (!patient) throw AppError.notFound(`Paciente [${pacienteId}] no encontrado.`);

    await this._assertTherapistAccess(patient, currentUser, 'modificar el estado de las carpetas de este paciente');

    const folder = await this.recordRepo.getFolderById(folderId);
    if (!folder || folder.paciente_id !== Number(pacienteId)) {
      throw AppError.notFound(`Carpeta clínica [${folderId}] no encontrada para este paciente.`);
    }

    // Regla de privacidad RBAC: solo el terapeuta que creó la carpeta personalizada o el ADMIN pueden modificarla
    if (currentUser.rol === 'TERAPEUTA' && folder.es_sistema === 0 && folder.creado_por_usuario_id && folder.creado_por_usuario_id !== currentUser.id) {
      throw AppError.forbidden('Acceso restringido: Solo el especialista que creó esta carpeta o la Dirección Médica pueden modificarla.');
    }

    const updated = await this.recordRepo.updateFolderStatus(folderId, activo, motivoBaja);

    this._audit(currentUser.id, activo ? 'CARPETA_REACTIVADA' : 'CARPETA_DESACTIVADA', 'MODULO_E', {
      paciente_id: pacienteId,
      carpeta_id: folderId,
      nombre: folder.nombre,
      nuevo_estado: activo ? 'ACTIVO' : 'INACTIVO',
      motivo_baja: motivoBaja || null
    });

    return updated;
  }

  /**
   * Crea una carpeta personalizada para el paciente vinculándola al terapeuta creador.
   */
  async createPatientFolder(pacienteId, data, currentUser) {
    if (!data.nombre || data.nombre.trim().length === 0) {
      throw AppError.badRequest('El nombre de la carpeta es obligatorio.');
    }

    const patient = await this.patientRepo.findById(pacienteId);
    if (!patient) throw AppError.notFound(`Paciente [${pacienteId}] no encontrado.`);

    await this._assertTherapistAccess(patient, currentUser, 'crear carpetas para este paciente');

    const created = await this.recordRepo.createFolder({
      pacienteId,
      nombre: data.nombre.trim(),
      descripcion: data.descripcion ? data.descripcion.trim() : null,
      orden: data.orden || 99,
      creadoPorUsuarioId: currentUser.id
    });

    this._audit(currentUser.id, 'CARPETA_DIGITAL_CREADA', 'MODULO_E', {
      paciente_id: pacienteId,
      carpeta_id: created.id,
      nombre: created.nombre,
      creado_por_usuario_id: currentUser.id
    });

    return created;
  }

  /**
   * Obtiene los documentos clínicos de un paciente (opcionalmente filtrados por carpeta).
   */
  async getPatientDocuments(pacienteId, options = {}, currentUser) {
    const patient = await this.patientRepo.findById(pacienteId);
    if (!patient) throw AppError.notFound(`Paciente [${pacienteId}] no encontrado.`);

    await this._assertTherapistAccess(patient, currentUser, 'consultar los documentos y estudios de este paciente');

    if (options.carpetaId) {
      const folder = await this.recordRepo.getFolderById(options.carpetaId);
      if (folder && folder.es_sistema === 0 && folder.creado_por_usuario_id && currentUser.rol === 'TERAPEUTA' && folder.creado_por_usuario_id !== currentUser.id) {
        return [];
      }
      return await this.recordRepo.getDocumentsByFolderId(options.carpetaId, pacienteId);
    }
    return await this.recordRepo.getDocumentsByPatientId(pacienteId, currentUser);
  }

  /**
   * Obtiene un documento específico para visualización o descarga segura.
   */
  async getDocumentForView(documentId, currentUser) {
    const document = await this.recordRepo.getDocumentById(documentId);
    if (!document || document.activo === 0) {
      throw AppError.notFound('El documento clínico solicitado no existe o fue archivado.');
    }

    const patient = await this.patientRepo.findById(document.paciente_id);
    if (patient) {
      await this._assertTherapistAccess(patient, currentUser, 'visualizar este documento médico confidencial', true);
    }

    // Regla de privacidad: si el documento está en una carpeta personalizada creada por otro terapeuta
    const folder = await this.recordRepo.getFolderById(document.carpeta_id);
    if (folder && folder.es_sistema === 0 && folder.creado_por_usuario_id && currentUser.rol === 'TERAPEUTA') {
      if (folder.creado_por_usuario_id !== currentUser.id) {
        throw AppError.forbidden('Acceso confidencial restringido: Este documento se custodia en una carpeta privada de otro especialista.');
      }
    }

    const objectKey = extractStorageKey(document.nombre_almacenado, 'patient_documents', PRIVATE_BUCKET);
    if (!objectKey) {
      throw AppError.notFound('El archivo físico no se encuentra configurado.');
    }

    return {
      document,
      objectKey
    };
  }

  /**
   * Carga y registra un documento o estudio externo adjunto (Laboratorios, EEG, informes escolares).
   */
  async uploadPatientDocument(pacienteId, file, data, currentUser) {
    if (!file || !file.buffer) {
      throw AppError.badRequest('Debe adjuntar un archivo válido (PDF o Imagen).');
    }

    const patient = await this.patientRepo.findById(pacienteId);
    if (!patient) throw AppError.notFound(`Paciente [${pacienteId}] no encontrado.`);

    await this._assertTherapistAccess(patient, currentUser, 'adjuntar estudios o documentos clínicos a este paciente');

    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw AppError.badRequest('Formato no permitido. Solo se aceptan archivos PDF o imágenes (JPEG, PNG).');
    }

    const carpetaId = Number(data.carpetaId);
    if (!carpetaId) {
      throw AppError.badRequest('Debe seleccionar la carpeta de destino para el archivo.');
    }

    const targetFolder = await this.recordRepo.getFolderById(carpetaId);
    if (!targetFolder || targetFolder.paciente_id !== Number(pacienteId) || targetFolder.activo === 0) {
      throw AppError.badRequest('La carpeta de destino no existe o se encuentra inactiva.');
    }

    if (currentUser.rol === 'TERAPEUTA' && targetFolder.es_sistema === 0 && targetFolder.creado_por_usuario_id && targetFolder.creado_por_usuario_id !== currentUser.id) {
      throw AppError.forbidden('Acceso restringido: Solo el especialista que creó esta carpeta privada o la Dirección Médica pueden custodiar archivos en ella.');
    }

    const objectKey = `patient_documents/${storageService.buildSafeFilename('doc', file.originalname || 'documento_clinico.pdf')}`;
    await storageService.uploadPrivate(objectKey, file.buffer, file.mimetype);

    const createdDoc = await this.recordRepo.createDocument({
      carpetaId,
      pacienteId,
      nombreOriginal: file.originalname || 'documento_clinico.pdf',
      nombreAlmacenado: objectKey,
      tipoMime: file.mimetype,
      tamanoBytes: file.size,
      categoriaClinica: data.categoriaClinica || 'LABORATORIO_ESTUDIO',
      descripcion: data.descripcion || null,
      subidoPorUsuarioId: currentUser.id
    });

    this._audit(currentUser.id, 'DOCUMENTO_CLINICO_SUBIDO', 'MODULO_E', {
      paciente_id: pacienteId,
      documento_id: createdDoc.id,
      nombre_original: createdDoc.nombre_original,
      categoria: createdDoc.categoria_clinica
    });

    return createdDoc;
  }

  /**
   * Anulación lógica (soft delete) de un documento clínico con justificación médica.
   */
  async softDeletePatientDocument(documentId, { motivoAnulacion }, currentUser) {
    const motivo = (motivoAnulacion || '').trim();
    if (!motivo || motivo.length < 2) {
      throw AppError.badRequest('Debe registrar un motivo para anular o desvincular el documento.');
    }

    const document = await this.recordRepo.getDocumentById(documentId);
    if (!document) throw AppError.notFound('El documento clínico no fue encontrado.');

    const patient = await this.patientRepo.findById(document.paciente_id);
    if (patient) {
      await this._assertTherapistAccess(patient, currentUser, 'anular documentos de este expediente');
    }

    await this.recordRepo.softDeleteDocument(documentId, currentUser.id, motivoAnulacion.trim());

    this._audit(currentUser.id, 'DOCUMENTO_CLINICO_ANULADO', 'MODULO_E', {
      documento_id: documentId,
      paciente_id: document.paciente_id,
      motivo: motivoAnulacion.trim()
    });

    return { success: true, message: 'Documento archivado correctamente.' };
  }

  /**
   * Reincorporación de un documento clínico previamente anulado.
   */
  async restorePatientDocument(documentId, currentUser) {
    const document = await this.recordRepo.getDocumentById(documentId);
    if (!document) throw AppError.notFound('El documento clínico no fue encontrado.');

    const patient = await this.patientRepo.findById(document.paciente_id);
    if (patient) {
      await this._assertTherapistAccess(patient, currentUser, 'reincorporar documentos de este expediente');
    }

    await this.recordRepo.restoreDocument(documentId);

    this._audit(currentUser.id, 'DOCUMENTO_CLINICO_REINCORPORADO', 'MODULO_E', {
      documento_id: documentId,
      paciente_id: document.paciente_id
    });

    return { success: true, message: 'Documento clínico reincorporado exitosamente.' };
  }

  /**
   * Obtiene los documentos desvinculados de un paciente.
   */
  async getInactiveDocuments(pacienteId, currentUser) {
    const patient = await this.patientRepo.findById(pacienteId);
    if (!patient) throw AppError.notFound(`Paciente [${pacienteId}] no encontrado.`);

    await this._assertTherapistAccess(patient, currentUser, 'consultar documentos desvinculados de este expediente', true);
    return await this.recordRepo.getInactiveDocumentsByPatientId(pacienteId, currentUser);
  }

  /**
   * Obtiene los planes de intervención (PTI) de una historia clínica.
   */
  async getInterventionPlans(historiaId, currentUser) {
    const history = await this.recordRepo.findHistoryById(historiaId);
    if (!history) throw AppError.notFound(`Historia clínica [${historiaId}] no encontrada.`);

    await this._assertTherapistAccess(history, currentUser, 'consultar los planes de intervención de este paciente', true);
    return await this.recordRepo.getInterventionPlansByHistoryId(historiaId);
  }

  /**
   * Obtiene los planes terapéuticos y metas SMART activos para los hijos/pupilos de un tutor autenticado (HU-09).
   */
  async getFamilyPlansForTutor(currentUser) {
    if (currentUser.rol !== 'TUTOR') {
      throw AppError.forbidden('Solo los tutores legales pueden acceder a su resumen de planes familiares.');
    }

    const tutor = await this.recordRepo.getTutorIdByUserId(currentUser.id);
    if (!tutor) {
      return [];
    }

    const children = await this.recordRepo.getChildrenForTutor(tutor.id);

    const familyPlans = [];

    for (const child of children) {
      // Especialista asignado al hijo/a
      const childTherapist = await this.recordRepo.getAssignedTherapistForPatient(child.paciente_id);

      let plans = [];
      if (child.historia_id) {
        plans = await this.recordRepo.getInterventionPlansByHistoryId(child.historia_id);
      }

      // Enriquecer cada meta con su último check-in familiar y conteo del mes
      for (const p of plans) {
        if (p.metas && Array.isArray(p.metas)) {
          for (const m of p.metas) {
            const { recentCheckin, totalMes } = await this.recordRepo.getRecentHomeCheckinAndMonthCount(m.id);

            m.ultimo_checkin = recentCheckin || null;
            m.total_practicas_mes = totalMes;
          }
        }
      }

      familyPlans.push({
        paciente: {
          id: child.paciente_id,
          nombres: child.nombres,
          apellidos: child.apellidos,
          codigo_expediente: child.codigo_expediente,
          parentesco: child.parentesco,
          historia_id: child.historia_id,
          terapeuta_asignado: childTherapist || null
        },
        planes: plans
      });
    }

    return familyPlans;
  }

  /**
   * Registra un check-in de refuerzo o práctica en el hogar realizado por el tutor legal.
   */
  async recordHomePracticeCheckin({ metaId, pacienteId, nivelRespuesta, observacionHogar }, currentUser) {
    if (currentUser.rol !== 'TUTOR') {
      throw AppError.forbidden('Solo los tutores legales pueden registrar prácticas en el hogar.');
    }

    const tutor = await this.recordRepo.getTutorIdByUserId(currentUser.id);
    if (!tutor) throw AppError.forbidden('Perfil de tutor legal no encontrado.');

    // Validar vinculación tutor-paciente
    const relation = await this.recordRepo.checkTutorPatientRelation(pacienteId, currentUser.id);

    if (!relation) {
      throw AppError.forbidden('No tiene autorización sobre este expediente familiar.');
    }

    if (!['FLUIDO', 'CON_APOYO', 'DIFICIL'].includes(nivelRespuesta)) {
      throw AppError.badRequest('El nivel de respuesta seleccionado es inválido.');
    }

    const record = await this.recordRepo.createHomePracticeCheckin({
      metaId: Number(metaId),
      pacienteId: Number(pacienteId),
      tutorId: tutor.id,
      nivelRespuesta,
      observacionHogar
    });

    await this._audit(currentUser.id, 'CHECKIN_FAMILIAR_REGISTRADO', 'PORTAL_FAMILIAR', {
      meta_id: metaId,
      paciente_id: pacienteId,
      nivel: nivelRespuesta
    });

    return {
      success: true,
      message: 'Práctica familiar registrada en la bitácora clínica exitosamente.',
      data: record
    };
  }

  /**
   * Obtiene el historial de bitácora de prácticas en el hogar.
   */
  async getHomePracticeHistory(pacienteId, currentUser, metaId = null) {
    if (currentUser.rol === 'TUTOR') {
      const rel = await this.recordRepo.checkTutorPatientRelation(pacienteId, currentUser.id);
      if (!rel) throw AppError.forbidden('No tiene acceso a los registros de este paciente.');
    } else {
      const patient = await this.patientRepo.findById(pacienteId);
      if (!patient) throw AppError.notFound('Paciente no encontrado.');
      await this._assertTherapistAccess(patient, currentUser, 'consultar bitácora del hogar', true);
    }

    return await this.recordRepo.getHomePracticeHistory(pacienteId, metaId);
  }

  /**
   * Obtiene un plan de intervención por su ID.
   */
  async getInterventionPlanById(planId, currentUser) {
    const plan = await this.recordRepo.getInterventionPlanById(planId);
    if (!plan) throw AppError.notFound(`Plan terapéutico [${planId}] no encontrado.`);

    const history = await this.recordRepo.findHistoryById(plan.historia_id);
    if (history) {
      await this._assertTherapistAccess(history, currentUser, 'consultar este plan de intervención', true);
    }

    return plan;
  }

  /**
   * Crea un nuevo Plan Terapéutico Individualizado (PTI) con metas SMART opcionales.
   */
  async createInterventionPlan(historiaId, data, currentUser) {
    if (!data.titulo || data.titulo.trim().length === 0) {
      throw AppError.badRequest('El título del plan terapéutico es obligatorio.');
    }
    if (!data.objetivoGeneral || data.objetivoGeneral.trim().length === 0) {
      throw AppError.badRequest('El objetivo general terapéutico es obligatorio.');
    }

    const history = await this.recordRepo.findHistoryById(historiaId);
    if (!history) throw AppError.notFound(`Historia clínica [${historiaId}] no encontrada.`);

    const loggedTherapist = await this._assertTherapistAccess(history, currentUser, 'crear planes terapéuticos para este paciente');

    const terapeutaId = loggedTherapist?.id || history.terapeuta_id || 1;

    const planPayload = {
      historiaId,
      pacienteId: history.paciente_id,
      terapeutaId,
      diagnosticoCodigo: data.diagnosticoCodigo || null,
      diagnosticoGlosa: data.diagnosticoGlosa || null,
      diagnosticoCatalogoId: data.diagnosticoCatalogoId || null,
      titulo: data.titulo.trim(),
      objetivoGeneral: data.objetivoGeneral.trim(),
      periodicidadMeses: Number(data.periodicidadMeses) || 3,
      fechaInicio: data.fechaInicio || getBoliviaTodayDateString(),
      fechaRevision: data.fechaRevision || null,
      recomendacionesFamilia: data.recomendacionesFamilia || null,
      metas: Array.isArray(data.metas) ? data.metas : []
    };

    const createdPlan = await this.recordRepo.createInterventionPlan(planPayload);

    this._audit(currentUser.id, 'PLAN_TERAPEUTICO_CREADO', 'MODULO_F', {
      plan_id: createdPlan.id,
      historia_id: historiaId,
      paciente_id: history.paciente_id,
      titulo: createdPlan.titulo
    });

    return createdPlan;
  }

  /**
   * Cierre o actualización de estado de un plan (Soft Close: 'CUMPLIDO' | 'DESCONTINUADO').
   */
  async updateInterventionPlanStatus(planId, { estado, motivoCierre }, currentUser) {
    const validStates = ['ACTIVO', 'CUMPLIDO', 'DESCONTINUADO'];
    if (!validStates.includes(estado)) {
      throw AppError.badRequest(`Estado no válido. Opciones permitidas: ${validStates.join(', ')}`);
    }

    const plan = await this.recordRepo.getInterventionPlanById(planId);
    if (!plan) throw AppError.notFound(`Plan terapéutico [${planId}] no encontrado.`);

    const history = await this.recordRepo.findHistoryById(plan.historia_id);
    if (history) {
      await this._assertTherapistAccess(history, currentUser, 'modificar el estado de este plan');
    }

    const updated = await this.recordRepo.updateInterventionPlanStatus(planId, estado, motivoCierre, currentUser.id);

    this._audit(currentUser.id, 'ESTADO_PLAN_TERAPEUTICO_ACTUALIZADO', 'MODULO_F', {
      plan_id: planId,
      nuevo_estado: estado,
      motivo_cierre: motivoCierre
    });

    return updated;
  }

  /**
   * Registra una nueva meta SMART en un plan PTI.
   */
  async addSmartGoal(planId, data, currentUser) {
    if (!data.descripcionMeta || data.descripcionMeta.trim().length === 0) {
      throw AppError.badRequest('La descripción de la meta SMART es obligatoria.');
    }
    if (!data.criterioExito || data.criterioExito.trim().length === 0) {
      throw AppError.badRequest('El criterio cuantitativo de éxito es obligatorio.');
    }

    const plan = await this.recordRepo.getInterventionPlanById(planId);
    if (!plan) throw AppError.notFound(`Plan terapéutico [${planId}] no encontrado.`);

    const history = await this.recordRepo.findHistoryById(plan.historia_id);
    if (history) {
      await this._assertTherapistAccess(history, currentUser, 'agregar metas terapéuticas a este plan');
    }

    const goal = await this.recordRepo.createSmartGoal({
      planId,
      descripcionMeta: data.descripcionMeta.trim(),
      areaIntervencion: data.areaIntervencion || 'ATENCION_CONCENTRACION',
      criterioExito: data.criterioExito.trim(),
      porcentajeLogro: Number(data.porcentajeLogro) || 0,
      pautasHogar: data.pautasHogar ? data.pautasHogar.trim() : null,
      orden: data.orden || 0
    });

    this._audit(currentUser.id, 'META_SMART_AGREGADA', 'MODULO_F', {
      plan_id: planId,
      meta_id: goal.id,
      area: goal.area_intervencion
    });

    return goal;
  }

  /**
   * Actualiza el progreso cuantitativo de una meta SMART con trazabilidad histórica inalterable.
   */
  async updateSmartGoalProgress(metaId, data, currentUser) {
    const validPercentages = [0, 25, 50, 75, 100];
    const pct = Number(data.porcentajeLogro);
    if (!validPercentages.includes(pct)) {
      throw AppError.badRequest('El porcentaje de logro debe ser uno de los valores clínicos: 0, 25, 50, 75 o 100.');
    }

    const meta = await this.recordRepo.getSmartGoalRawById(metaId);
    if (!meta) throw AppError.notFound(`Meta SMART [${metaId}] no encontrada.`);

    const plan = await this.recordRepo.getInterventionPlanById(meta.plan_id);
    if (!plan) throw AppError.notFound('Plan asociado no encontrado.');

    const history = await this.recordRepo.findHistoryById(plan.historia_id);
    const loggedTherapist = history ? await this._assertTherapistAccess(history, currentUser, 'actualizar avances en esta meta') : null;

    const terapeutaId = loggedTherapist?.id || plan.terapeuta_id || 1;

    const updated = await this.recordRepo.updateSmartGoalProgress(metaId, {
      porcentajeLogro: pct,
      pautasHogar: data.pautasHogar || null,
      pacienteId: plan.paciente_id,
      terapeutaId,
      observacionesClinicas: data.observacionesClinicas || `Avance actualizado a ${pct}%`,
      sesionNumero: data.sesionNumero || null
    });

    this._audit(currentUser.id, 'AVANCE_META_SMART_REGISTRADO', 'MODULO_F', {
      meta_id: metaId,
      plan_id: plan.id,
      paciente_id: plan.paciente_id,
      nuevo_porcentaje: pct
    });

    return updated;
  }

  /**
   * Obtiene la cronología de evolución de una meta SMART.
   */
  async getGoalHistory(metaId, currentUser) {
    const goal = await this.recordRepo.getSmartGoalById(metaId);
    if (!goal) throw AppError.notFound(`Meta terapéutica [${metaId}] no encontrada.`);

    const plan = await this.recordRepo.getInterventionPlanById(goal.plan_id);
    if (plan) {
      const history = await this.recordRepo.findHistoryById(plan.historia_id);
      if (history) {
        await this._assertTherapistAccess(history, currentUser, 'consultar la cronología de esta meta terapéutica', true);
      }
    }

    return await this.recordRepo.getGoalEvolutionHistory(metaId);
  }

  _sanitizeText(text) {
    if (!text) return '';
    let s = text;
    s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[CORREO]');
    s = s.replace(/(\+?591\s*[-.]?)?([67]\d{7}\b|4\d{6}\b)/g, '[TELÉFONO]');
    s = s.replace(/\b\d{5,8}(\s*(LP|CB|SC|OR|PT|TJ|CH|BE|PD))?\b/gi, '[C.I.]');
    return s;
  }

  async _audit(usuarioId, accion, modulo, detalles = {}) {
    try {
      await this.userRepo.logAudit(usuarioId, accion, modulo, detalles, null);
    } catch (e) {
      console.warn('[Audit] Error registrando bitácora:', e.message);
    }
  }
}
