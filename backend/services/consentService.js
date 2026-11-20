import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { AppError } from '../core/AppError.js';
import { assertPatientAccess } from '../core/accessControl.js';

export class ConsentService {
  constructor() {
    this.consentRepo = RepositoryFactory.getConsentRepository();
    this.patientRepo = RepositoryFactory.getPatientRepository();
    this.tutorRepo = RepositoryFactory.getTutorRepository();
    this.userRepo = RepositoryFactory.getUserRepository();
  }

  async createConsent(data, currentUser = null, reqIp = '127.0.0.1', userAgent = '') {
    const {
      paciente_id,
      tutor_id,
      tipo_consentimiento,
      titulo,
      contenido_clausulas,
      firma_digital_blob,
      firmado_por_nombre,
      firmado_por_ci,
      parentesco
    } = data;

    if (!paciente_id) {
      throw new AppError('El ID del paciente es obligatorio para el consentimiento informado', 400, 'VALIDATION_ERROR');
    }

    // Verificar si el formato es firma táctil (imagen base64) o documento escaneado/PDF
    const isBase64Img = typeof firma_digital_blob === 'string' && firma_digital_blob.startsWith('data:image/');
    const isPdfOrFile = typeof firma_digital_blob === 'string' && (firma_digital_blob.startsWith('data:application/pdf') || firma_digital_blob.startsWith('data:') || firma_digital_blob.startsWith('/uploads/') || firma_digital_blob.includes('.'));
    
    if (!firma_digital_blob || (!isBase64Img && !isPdfOrFile)) {
      throw new AppError('Se requiere una firma manuscrita válida o el archivo escaneado del consentimiento firmado', 400, 'INVALID_SIGNATURE');
    }

    if (!firmado_por_nombre || !firmado_por_ci) {
      throw new AppError('El nombre completo y C.I. de quien firma son obligatorios', 400, 'VALIDATION_ERROR');
    }

    // Verificar existencia del paciente
    const patient = await this.patientRepo.findById(paciente_id);
    if (!patient) {
      throw new AppError(`No se encontró el paciente con ID ${paciente_id}`, 404, 'NOT_FOUND');
    }

    if (currentUser) {
      await assertPatientAccess(paciente_id, currentUser, {
        allowReception: true,
        allowTutor: true,
        actionDescription: 'registrar consentimiento informado'
      });
    }

    // Determinar si es paciente adulto o auto-consentimiento
    let isAdult = false;
    if (patient.fecha_nacimiento) {
      const birth = new Date(patient.fecha_nacimiento);
      const diffYears = (new Date().getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (diffYears >= 18) isAdult = true;
    }
    if (parentesco === 'TITULAR_PACIENTE' || parentesco === 'PROPIO_PACIENTE') {
      isAdult = true;
    }

    // Resolver tutor si no viene especificado
    let finalTutorId = tutor_id;
    if (!finalTutorId) {
      if (this.tutorRepo && typeof this.tutorRepo.findByPatientId === 'function') {
        const tutors = await this.tutorRepo.findByPatientId(paciente_id);
        if (tutors && tutors.length > 0) {
          finalTutorId = tutors[0].id;
        }
      }
      if (!finalTutorId && !isAdult) {
        throw new AppError('El paciente menor de edad no tiene un tutor legal registrado para asociar el consentimiento', 400, 'TUTOR_REQUIRED');
      }
    }

    const payload = {
      paciente_id,
      tutor_id: finalTutorId,
      tipo_consentimiento: tipo_consentimiento || 'EVALUACION_INICIAL',
      titulo: titulo || `Consentimiento Informado para Atención y Evaluación Clínica - ${patient.nombres} ${patient.apellidos}`,
      contenido_clausulas: contenido_clausulas || this._getDefaultClauses(patient, isAdult),
      firma_digital_blob,
      firmado_por_nombre,
      firmado_por_ci,
      parentesco: parentesco || (isAdult ? 'TITULAR_PACIENTE' : 'TUTOR_LEGAL'),
      ip_registro: reqIp,
      user_agent: userAgent,
      estado: 'FIRMADO',
      creado_por_usuario_id: currentUser ? currentUser.id : null
    };

    const consent = await this.consentRepo.createConsent(payload);

    // Enriquecer automáticamente el perfil si no tenía C.I. registrado
    try {
      if (finalTutorId && firmado_por_ci && this.tutorRepo?.update) {
        const currentTutor = await this.tutorRepo.findById(finalTutorId);
        if (currentTutor && !currentTutor.ci) {
          await this.tutorRepo.update(finalTutorId, { ci: firmado_por_ci });
        }
      }
      if (isAdult && firmado_por_ci && !patient.ci && this.patientRepo?.update) {
        await this.patientRepo.update(paciente_id, { ci: firmado_por_ci });
      }
    } catch (profileSyncErr) {
      console.warn('[ConsentService] Aviso al sincronizar C.I. de firmante en perfil:', profileSyncErr.message);
    }

    // Auditoría legal
    try {
      if (this.userRepo.logAudit && currentUser) {
        await this.userRepo.logAudit(
          currentUser.id,
          'FIRMA_CONSENTIMIENTO_INFORMADO',
          'CONSENTIMIENTOS',
          JSON.stringify({
            consentimiento_id: consent.id,
            paciente_id,
            paciente: `${patient.nombres} ${patient.apellidos}`,
            firmante: firmado_por_nombre,
            ci: firmado_por_ci
          }),
          reqIp
        );
      }
    } catch (e) {
      console.warn('[ConsentService] Aviso al registrar auditoría:', e.message);
    }

    return consent;
  }

  async getConsentsByPatient(patientId, currentUser = null) {
    if (!patientId) {
      throw new AppError('El ID del paciente es requerido', 400, 'VALIDATION_ERROR');
    }
    if (currentUser) {
      await assertPatientAccess(patientId, currentUser, {
        allowReception: true,
        allowTutor: true,
        actionDescription: 'consultar consentimientos informados del paciente'
      });
    }
    return this.consentRepo.findByPatientId(patientId);
  }

  async getConsentsByTutor(tutorId) {
    if (!tutorId) {
      throw new AppError('El ID del tutor es requerido', 400, 'VALIDATION_ERROR');
    }
    return this.consentRepo.findByTutorId(tutorId);
  }

  async getConsentById(id, currentUser = null) {
    const consent = await this.consentRepo.findById(id);
    if (!consent) {
      throw new AppError('Consentimiento informado no encontrado', 404, 'NOT_FOUND');
    }
    if (currentUser) {
      await assertPatientAccess(consent.paciente_id, currentUser, {
        allowReception: true,
        allowTutor: true,
        actionDescription: 'visualizar este consentimiento informado'
      });
    }
    return consent;
  }

  async checkPatientConsentStatus(patientId, currentUser = null) {
    if (!patientId) {
      throw new AppError('ID de paciente requerido', 400, 'VALIDATION_ERROR');
    }
    if (currentUser) {
      await assertPatientAccess(patientId, currentUser, {
        allowReception: true,
        allowTutor: true,
        actionDescription: 'verificar el estado del consentimiento informado'
      });
    }
    const hasConsent = await this.consentRepo.hasActiveConsent(patientId);
    const list = await this.consentRepo.findByPatientId(patientId);
    return {
      hasActiveConsent: hasConsent,
      total: list.length,
      consents: list
    };
  }

  async revokeConsent(id, motivo, currentUser = null, reqIp = '127.0.0.1') {
    if (!motivo) {
      throw new AppError('Debe indicar un motivo legal para la revocación del consentimiento', 400, 'VALIDATION_ERROR');
    }
    const consent = await this.getConsentById(id, currentUser);
    const updated = await this.consentRepo.revokeConsent(id, motivo, currentUser ? currentUser.id : null);

    try {
      if (this.userRepo.logAudit && currentUser) {
        await this.userRepo.logAudit(
          currentUser.id,
          'REVOCACION_CONSENTIMIENTO',
          'CONSENTIMIENTOS',
          JSON.stringify({ consentimiento_id: id, motivo }),
          reqIp
        );
      }
    } catch (e) {}

    return updated;
  }

  _getDefaultClauses(patient, isAdult = false) {
    if (isAdult) {
      return `1. DECLARACIÓN Y AUTORIZACIÓN (LEY N° 3131 Y BIOÉTICA):
El/la suscrito/a, en pleno ejercicio de mis facultades legales y civiles conforme a la Ley N° 3131 del Ejercicio Profesional Médico y el Código de Bioética en Salud del Estado Plurinacional de Bolivia, autorizo libre, informada y voluntariamente a los especialistas colegiados del Centro Psicopedagógico y de Atención Psicológica "PSI Aprende" a realizar el proceso de evaluación neuropsicológica, psicodiagnóstica y abordaje psicoterapéutico sobre mi persona (${patient.nombres} ${patient.apellidos}).

2. CONFIDENCIALIDAD Y SECRETO PROFESIONAL:
Toda la información personal, anamnesis, resultados de baterías cognitivas y notas de evolución clínica se mantendrá bajo estricto secreto profesional y custodia digital cifrada e inalterable, resguardando la intimidad del paciente según las normas del Colegio de Psicólogos de Bolivia (CPB).

3. ENTREGA DE RESULTADOS E INFORME CLÍNICO:
Los resultados y diagnósticos derivados del proceso evaluativo serán formalizados en informe clínico oficial emitido por el especialista tratante para fines terapéuticos, médicos o de derivación especializada.

4. VALIDEZ JURÍDICA DE LA FIRMA:
La presente firma manuscrita estampada digitalmente o suscrita en acta física escaneada tiene plena validez jurídica y probatoria, acreditando el pleno conocimiento y conformidad con los alcances del servicio.`;
    }

    return `1. DECLARACIÓN Y AUTORIZACIÓN (LEY N° 548):
El/la suscrito/a, en pleno ejercicio de la patria potestad o tutoría legal según la Ley N° 548 (Código Niña, Niño y Adolescente del Estado Plurinacional de Bolivia), autoriza libre, informada y expresamente a los profesionales acreditados del Centro Psicopedagógico y de Atención Psicológica "PSI Aprende" a realizar el proceso de evaluación neuropsicológica, psicopedagógica y psicoterapéutica respecto al menor ${patient.nombres} ${patient.apellidos}.

2. CONFIDENCIALIDAD Y SECRETO PROFESIONAL:
Toda la información recabada durante las entrevistas, aplicaciones de baterías psicométricas y notas de evolución clínica se mantendrá bajo estricto secreto profesional conforme a la Ley y el Código de Ética Profesional del Colegio de Psicólogos de Bolivia, resguardándose digitalmente en el expediente clínico inalterable del centro.

3. USO DE RESULTADOS Y DIAGNÓSTICO:
Los resultados y diagnósticos derivados del proceso evaluativo serán entregados formalmente a los tutores legales mediante informe escrito para fines de orientación psicopedagógica, médica o adaptaciones curriculares escolares.

4. VALIDEZ JURÍDICA DE LA FIRMA:
La presente firma manuscrita estampada digitalmente o suscrita en acta física escaneada tiene plena validez jurídica, probatoria y consentida, acreditando el conocimiento de los alcances terapéuticos del Centro.`;
  }
}
