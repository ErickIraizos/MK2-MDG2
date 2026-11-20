import { DatabaseConnection } from '../../core/DatabaseConnection.js';
import { IClinicalRecordRepository } from '../../domain/interfaces/IClinicalRecordRepository.js';

export class SqliteClinicalRecordRepository extends IClinicalRecordRepository {
  constructor() {
    super();
    this.db = DatabaseConnection.getInstance();
    this._ensureSchemaMigrations();
  }

  _ensureSchemaMigrations() {
    try {
      this.db.prepare("ALTER TABLE paciente_carpetas ADD COLUMN motivo_baja TEXT").run();
    } catch (e) {}
    try {
      this.db.prepare("ALTER TABLE paciente_carpetas ADD COLUMN fecha_baja DATETIME").run();
    } catch (e) {}
    try {
      this.db.prepare("ALTER TABLE paciente_carpetas ADD COLUMN creado_por_usuario_id INTEGER").run();
    } catch (e) {}
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS tutor_seguimiento_hogar (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          meta_id INTEGER NOT NULL,
          paciente_id INTEGER NOT NULL,
          tutor_id INTEGER NOT NULL,
          nivel_respuesta TEXT NOT NULL,
          observacion_hogar TEXT,
          fecha_registro DATE DEFAULT CURRENT_DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (meta_id) REFERENCES metas_terapeuticas(id) ON DELETE CASCADE,
          FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
          FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE CASCADE
        )
      `).run();
    } catch (e) {}
  }

  async findHistoryById(id) {
    const stmt = this.db.prepare(`
      SELECT 
        hc.*,
        p.nombres AS paciente_nombres,
        p.apellidos AS paciente_apellidos,
        p.ci AS paciente_ci,
        p.fecha_nacimiento AS paciente_fecha_nacimiento,
        p.sexo AS paciente_sexo,
        p.colegio_ocupacion AS paciente_colegio_ocupacion,
        p.antecedentes_medicos AS paciente_antecedentes_medicos,
        p.antecedentes_perinatales AS paciente_antecedentes_perinatales,
        p.medicacion_actual AS paciente_medicacion_actual,
        p.estado_clinico AS paciente_estado_clinico,
        t.id AS terapeuta_id,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos,
        t.registro_profesional AS terapeuta_matricula,
        esp.nombre AS especialidad_nombre,
        (SELECT COUNT(*) FROM notas_evolucion ne WHERE ne.historia_id = hc.id) AS total_sesiones,
        (SELECT MAX(ne.fecha_sesion) FROM notas_evolucion ne WHERE ne.historia_id = hc.id) AS ultima_sesion_fecha,
        CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END AS tiene_anamnesis
      FROM historias_clinicas hc
      JOIN pacientes p ON hc.paciente_id = p.id
      LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      LEFT JOIN anamnesis a ON a.historia_id = hc.id
      WHERE hc.id = ?
    `);

    const record = stmt.get(id);
    if (!record) return null;

    // Obtener tutor principal y tutores vinculados si existen
    const tutorStmt = this.db.prepare(`
      SELECT tut.id, tut.nombres, tut.apellidos, tut.ci, tut.whatsapp, tut.email, pt.parentesco, pt.es_principal, u.email as usuario_email
      FROM paciente_tutor pt
      JOIN tutores tut ON pt.tutor_id = tut.id
      LEFT JOIN usuarios u ON tut.usuario_id = u.id
      WHERE pt.paciente_id = ?
      ORDER BY pt.es_principal DESC, tut.nombres ASC
    `);
    const allLinkedTutors = tutorStmt.all(record.paciente_id);
    record.tutores = allLinkedTutors;
    record.tutor_principal = allLinkedTutors.length > 0 ? allLinkedTutors[0] : null;

    return record;
  }

  async findHistoryByPatientId(pacienteId) {
    const stmt = this.db.prepare(`SELECT id FROM historias_clinicas WHERE paciente_id = ?`);
    const row = stmt.get(pacienteId);
    if (!row) return null;
    return this.findHistoryById(row.id);
  }

  async findHistoryByNumeroExpediente(numeroExpediente) {
    const stmt = this.db.prepare(`SELECT id FROM historias_clinicas WHERE numero_expediente = ?`);
    const row = stmt.get(numeroExpediente);
    if (!row) return null;
    return this.findHistoryById(row.id);
  }

  async findAllHistories(options = {}) {
    const { search = '', estado = null, terapeutaId = null, limit = 50, offset = 0 } = options;

    let whereConditions = [];
    let params = {};

    if (search && search.trim() !== '') {
      whereConditions.push(`(
        p.nombres LIKE @search OR 
        p.apellidos LIKE @search OR 
        p.ci LIKE @search OR 
        hc.numero_expediente LIKE @search
      )`);
      params.search = `%${search.trim()}%`;
    }

    if (estado && estado !== 'TODOS') {
      whereConditions.push(`hc.estado = @estado`);
      params.estado = estado;
    }

    if (terapeutaId) {
      whereConditions.push(`p.terapeuta_id = @terapeutaId`);
      params.terapeutaId = terapeutaId;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countStmt = this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM historias_clinicas hc
      JOIN pacientes p ON hc.paciente_id = p.id
      ${whereClause}
    `);
    const { total } = countStmt.get(params);

    const dataStmt = this.db.prepare(`
      SELECT 
        hc.id,
        hc.paciente_id,
        hc.numero_expediente,
        hc.fecha_apertura,
        hc.estado,
        hc.observaciones_ingreso,
        hc.created_at,
        p.nombres AS paciente_nombres,
        p.apellidos AS paciente_apellidos,
        p.ci AS paciente_ci,
        p.fecha_nacimiento AS paciente_fecha_nacimiento,
        p.sexo AS paciente_sexo,
        p.colegio_ocupacion AS paciente_colegio_ocupacion,
        t.id AS terapeuta_id,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos,
        t.registro_profesional AS terapeuta_matricula,
        esp.nombre AS especialidad_nombre,
        (SELECT COUNT(*) FROM notas_evolucion ne WHERE ne.historia_id = hc.id) AS total_sesiones,
        (SELECT MAX(ne.fecha_sesion) FROM notas_evolucion ne WHERE ne.historia_id = hc.id) AS ultima_sesion_fecha,
        CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END AS tiene_anamnesis
      FROM historias_clinicas hc
      JOIN pacientes p ON hc.paciente_id = p.id
      LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      LEFT JOIN anamnesis a ON a.historia_id = hc.id
      ${whereClause}
      ORDER BY hc.id DESC
      LIMIT @limit OFFSET @offset
    `);

    const records = dataStmt.all({
      ...params,
      limit: Number(limit),
      offset: Number(offset)
    });

    return { total, records };
  }

  async createHistory(data) {
    const stmt = this.db.prepare(`
      INSERT INTO historias_clinicas (
        paciente_id,
        numero_expediente,
        fecha_apertura,
        estado,
        observaciones_ingreso,
        triaje_origen_id
      ) VALUES (
        @paciente_id,
        @numero_expediente,
        @fecha_apertura,
        @estado,
        @observaciones_ingreso,
        @triaje_origen_id
      )
    `);

    const info = stmt.run({
      paciente_id: data.pacienteId,
      numero_expediente: data.numeroExpediente,
      fecha_apertura: data.fechaApertura || new Date().toISOString().split('T')[0],
      estado: data.estado || 'ACTIVO',
      observaciones_ingreso: data.observacionesIngreso || null,
      triaje_origen_id: data.triajeOrigenId || null
    });

    return this.findHistoryById(info.lastInsertRowid);
  }

  async updateHistoryStatus(id, estado, observaciones = null) {
    const stmt = this.db.prepare(`
      UPDATE historias_clinicas
      SET estado = @estado,
          observaciones_ingreso = COALESCE(@observaciones, observaciones_ingreso),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);

    stmt.run({ id, estado, observaciones });
    return this.findHistoryById(id);
  }

  async getAnamnesisByHistoryId(historiaId) {
    const stmt = this.db.prepare(`
      SELECT 
        a.*,
        u.nombre_completo AS evaluador_nombre,
        u.email AS evaluador_email,
        r.nombre AS evaluador_rol
      FROM anamnesis a
      LEFT JOIN usuarios u ON a.evaluador_id = u.id
      LEFT JOIN roles r ON u.rol_id = r.id
      WHERE a.historia_id = ?
    `);

    return stmt.get(historiaId) || null;
  }

  async saveAnamnesis(historiaId, data) {
    const existing = this.db.prepare(`SELECT id FROM anamnesis WHERE historia_id = ?`).get(historiaId);

    if (existing) {
      const updateStmt = this.db.prepare(`
        UPDATE anamnesis SET
          motivo_consulta = @motivo_consulta,
          historia_problema_actual = @historia_problema_actual,
          antecedentes_perinatales = @antecedentes_perinatales,
          desarrollo_motor_lenguaje = @desarrollo_motor_lenguaje,
          antecedentes_medicos = @antecedentes_medicos,
          antecedentes_familiares = @antecedentes_familiares,
          dinamica_familiar_escolar = @dinamica_familiar_escolar,
          exploracion_cognitiva_conductual = @exploracion_cognitiva_conductual,
          impresion_diagnostica_inicial = @impresion_diagnostica_inicial,
          evaluador_id = COALESCE(@evaluador_id, evaluador_id),
          fecha_evaluacion = COALESCE(@fecha_evaluacion, fecha_evaluacion),
          updated_at = CURRENT_TIMESTAMP
        WHERE historia_id = @historia_id
      `);

      updateStmt.run({
        historia_id: historiaId,
        motivo_consulta: data.motivoConsulta,
        historia_problema_actual: data.historiaProblemaActual || null,
        antecedentes_perinatales: data.antecedentesPerinatales || null,
        desarrollo_motor_lenguaje: data.desarrolloMotorLenguaje || null,
        antecedentes_medicos: data.antecedentesMedicos || null,
        antecedentes_familiares: data.antecedentesFamiliares || null,
        dinamica_familiar_escolar: data.dinamicaFamiliarEscolar || null,
        exploracion_cognitiva_conductual: data.exploracionCognitivaConductual || null,
        impresion_diagnostica_inicial: data.impresionDiagnosticaInicial || null,
        evaluador_id: data.evaluadorId || null,
        fecha_evaluacion: data.fechaEvaluacion || null
      });
    } else {
      const insertStmt = this.db.prepare(`
        INSERT INTO anamnesis (
          historia_id,
          motivo_consulta,
          historia_problema_actual,
          antecedentes_perinatales,
          desarrollo_motor_lenguaje,
          antecedentes_medicos,
          antecedentes_familiares,
          dinamica_familiar_escolar,
          exploracion_cognitiva_conductual,
          impresion_diagnostica_inicial,
          evaluador_id,
          fecha_evaluacion
        ) VALUES (
          @historia_id,
          @motivo_consulta,
          @historia_problema_actual,
          @antecedentes_perinatales,
          @desarrollo_motor_lenguaje,
          @antecedentes_medicos,
          @antecedentes_familiares,
          @dinamica_familiar_escolar,
          @exploracion_cognitiva_conductual,
          @impresion_diagnostica_inicial,
          @evaluador_id,
          @fecha_evaluacion
        )
      `);

      insertStmt.run({
        historia_id: historiaId,
        motivo_consulta: data.motivoConsulta,
        historia_problema_actual: data.historiaProblemaActual || null,
        antecedentes_perinatales: data.antecedentesPerinatales || null,
        desarrollo_motor_lenguaje: data.desarrolloMotorLenguaje || null,
        antecedentes_medicos: data.antecedentesMedicos || null,
        antecedentes_familiares: data.antecedentesFamiliares || null,
        dinamica_familiar_escolar: data.dinamicaFamiliarEscolar || null,
        exploracion_cognitiva_conductual: data.exploracionCognitivaConductual || null,
        impresion_diagnostica_inicial: data.impresionDiagnosticaInicial || null,
        evaluador_id: data.evaluadorId || null,
        fecha_evaluacion: data.fechaEvaluacion || new Date().toISOString().split('T')[0]
      });
    }

    return this.getAnamnesisByHistoryId(historiaId);
  }

  async findSoapNotesByHistoryId(historiaId) {
    const stmt = this.db.prepare(`
      SELECT 
        ne.*,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos,
        t.registro_profesional AS terapeuta_matricula,
        esp.nombre AS especialidad_nombre,
        u.nombre_completo AS usuario_nombre,
        amb.codigo AS ambiente_codigo,
        amb.nombre AS ambiente_nombre
      FROM notas_evolucion ne
      JOIN terapeutas t ON ne.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      JOIN usuarios u ON ne.usuario_id = u.id
      LEFT JOIN ambientes amb ON ne.ambiente_id = amb.id
      WHERE ne.historia_id = ?
      ORDER BY ne.numero_sesion DESC, ne.fecha_sesion DESC, ne.id DESC
    `);

    return stmt.all(historiaId);
  }

  async getNextSessionNumber(historiaId) {
    const stmt = this.db.prepare(`
      SELECT COALESCE(MAX(numero_sesion), 0) + 1 AS next_session
      FROM notas_evolucion
      WHERE historia_id = ?
    `);
    const row = stmt.get(historiaId);
    return row ? row.next_session : 1;
  }

  async createSoapNote(data) {
    const numeroSesion = data.numeroSesion || (await this.getNextSessionNumber(data.historiaId));

    const stmt = this.db.prepare(`
      INSERT INTO notas_evolucion (
        historia_id,
        paciente_id,
        terapeuta_id,
        usuario_id,
        numero_sesion,
        fecha_sesion,
        hora_inicio,
        hora_fin,
        ambiente_id,
        subjetivo,
        objetivo,
        analisis,
        plan,
        diagnostico_codigo,
        diagnostico_glosa,
        recomendaciones_hogar,
        asistido_por_ia,
        sellado,
        firma_digital_snapshot
      ) VALUES (
        @historia_id,
        @paciente_id,
        @terapeuta_id,
        @usuario_id,
        @numero_sesion,
        @fecha_sesion,
        @hora_inicio,
        @hora_fin,
        @ambiente_id,
        @subjetivo,
        @objetivo,
        @analisis,
        @plan,
        @diagnostico_codigo,
        @diagnostico_glosa,
        @recomendaciones_hogar,
        @asistido_por_ia,
        @sellado,
        @firma_digital_snapshot
      )
    `);

    const info = stmt.run({
      historia_id: data.historiaId,
      paciente_id: data.pacienteId,
      terapeuta_id: data.terapeutaId,
      usuario_id: data.usuarioId,
      numero_sesion: numeroSesion,
      fecha_sesion: data.fechaSesion || new Date().toISOString().split('T')[0],
      hora_inicio: data.horaInicio || null,
      hora_fin: data.horaFin || null,
      ambiente_id: data.ambienteId || null,
      subjetivo: data.subjetivo,
      objetivo: data.objetivo,
      analisis: data.analisis,
      plan: data.plan,
      diagnostico_codigo: data.diagnosticoCodigo || null,
      diagnostico_glosa: data.diagnosticoGlosa || null,
      recomendaciones_hogar: data.recomendacionesHogar || null,
      asistido_por_ia: data.asistidoPorIa ? 1 : 0,
      sellado: 1, // RN-07: Inalterable
      firma_digital_snapshot: data.firmaDigitalSnapshot || null
    });

    // Actualizar timestamp en la historia clínica
    this.db.prepare(`UPDATE historias_clinicas SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(data.historiaId);

    // Retornar la nota insertada
    const getStmt = this.db.prepare(`
      SELECT 
        ne.*,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos,
        t.registro_profesional AS terapeuta_matricula,
        esp.nombre AS especialidad_nombre,
        u.nombre_completo AS usuario_nombre,
        amb.codigo AS ambiente_codigo,
        amb.nombre AS ambiente_nombre
      FROM notas_evolucion ne
      JOIN terapeutas t ON ne.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      JOIN usuarios u ON ne.usuario_id = u.id
      LEFT JOIN ambientes amb ON ne.ambiente_id = amb.id
      WHERE ne.id = ?
    `);

    return getStmt.get(info.lastInsertRowid);
  }

  // =========================================================================
  // SPRINT 5: CATÁLOGO NOSOLÓGICO, CARPETAS DIGITALES Y PLANES SMART
  // =========================================================================

  /**
   * Busca diagnósticos en el catálogo nosológico oficial CIE-11 / DSM-5.
   */
  async searchDiagnostics(query = '', categoria = null) {
    let sql = `SELECT * FROM catalogo_diagnosticos WHERE activo = 1`;
    const params = [];

    if (query && query.trim() !== '') {
      sql += ` AND (codigo LIKE ? OR nombre LIKE ? OR descripcion LIKE ? OR criterios_resumen LIKE ?)`;
      const term = `%${query.trim()}%`;
      params.push(term, term, term, term);
    }

    if (categoria && categoria.trim() !== '' && categoria !== 'TODAS') {
      sql += ` AND categoria = ?`;
      params.push(categoria.trim());
    }

    sql += ` ORDER BY categoria ASC, codigo ASC LIMIT 30`;
    return this.db.prepare(sql).all(...params);
  }

  /**
   * Obtiene las carpetas digitales de un paciente con filtrado de privacidad RBAC.
   * - Las carpetas fijas de sistema (es_sistema = 1) son visibles para el especialista asignado y ADMIN.
   * - Las carpetas creadas por un terapeuta (es_sistema = 0) SOLO las puede ver ese terapeuta y el ADMIN.
   */
  async getFoldersByPatientId(pacienteId, includeInactive = false, currentUser = null) {
    const checkStmt = this.db.prepare(`SELECT COUNT(*) AS count FROM paciente_carpetas WHERE paciente_id = ? AND activo = 1`);
    const count = checkStmt.get(pacienteId)?.count || 0;

    if (count === 0) {
      // Auto-inicialización de las 5 carpetas estándar de centro
      const defaultFolders = [
        { nombre: '1. Evaluaciones Neuropsicológicas y Test', desc: 'Protocolos de aplicación WISC-V, CUMANES, Test d2 y perfiles de evaluación', orden: 1 },
        { nombre: '2. Informes Médicos y Neurológicos Externos', desc: 'Dictámenes médicos externos, neuropediatría, pediatría y psiquiatría', orden: 2 },
        { nombre: '3. Estudios Clínicos / Laboratorios / EEG / TAC', desc: 'Resultados de laboratorio, electroencefalogramas, tomografías y neuroimágenes', orden: 3 },
        { nombre: '4. Informes Escolares y Gabinetes Psicopedagógicos', desc: 'Boletines de notas, reportes de profesores y psicología escolar', orden: 4 },
        { nombre: '5. Consentimientos y Documentación Legal', desc: 'Consentimientos informados firmados digitalmente y autorizaciones legales', orden: 5 }
      ];

      const insertStmt = this.db.prepare(`
        INSERT INTO paciente_carpetas (paciente_id, nombre, descripcion, es_sistema, orden, activo, creado_por_usuario_id)
        VALUES (?, ?, ?, 1, ?, 1, NULL)
      `);

      for (const f of defaultFolders) {
        insertStmt.run(pacienteId, f.nombre, f.desc, f.orden);
      }
    }

    let sql = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM paciente_documentos d WHERE d.carpeta_id = c.id AND d.activo = 1) AS total_documentos
      FROM paciente_carpetas c
      WHERE c.paciente_id = ?
    `;

    const params = [pacienteId];

    if (!includeInactive) {
      sql += ` AND c.activo = 1`;
    }

    // RBAC: Si es TERAPEUTA, solo ve carpetas de sistema O carpetas personalizadas que él mismo haya creado
    if (currentUser && currentUser.rol === 'TERAPEUTA') {
      sql += ` AND (c.es_sistema = 1 OR c.creado_por_usuario_id = ?)`;
      params.push(currentUser.id);
    }

    sql += ` ORDER BY c.orden ASC, c.id ASC`;

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Obtiene una carpeta digital por su ID.
   */
  async getFolderById(folderId) {
    return this.db.prepare('SELECT * FROM paciente_carpetas WHERE id = ?').get(folderId) || null;
  }

  /**
   * Actualiza el estado activo/inactivo de una carpeta digital con motivo de baja.
   */
  async updateFolderStatus(folderId, activo, motivoBaja = null) {
    if (activo) {
      this.db.prepare('UPDATE paciente_carpetas SET activo = 1, motivo_baja = NULL, fecha_baja = NULL WHERE id = ?').run(folderId);
    } else {
      this.db.prepare('UPDATE paciente_carpetas SET activo = 0, motivo_baja = ?, fecha_baja = CURRENT_TIMESTAMP WHERE id = ?').run(motivoBaja, folderId);
    }
    return this.getFolderById(folderId);
  }

  /**
   * Crea una carpeta personalizada para el paciente vinculada al usuario creador.
   */
  async createFolder(data) {
    const stmt = this.db.prepare(`
      INSERT INTO paciente_carpetas (paciente_id, nombre, descripcion, es_sistema, orden, activo, creado_por_usuario_id)
      VALUES (?, ?, ?, 0, ?, 1, ?)
    `);

    const info = stmt.run(
      data.pacienteId,
      data.nombre.trim(),
      data.descripcion ? data.descripcion.trim() : null,
      data.orden || 99,
      data.creadoPorUsuarioId || null
    );

    return this.db.prepare(`SELECT * FROM paciente_carpetas WHERE id = ?`).get(info.lastInsertRowid);
  }

  /**
   * Obtiene los documentos activos de una carpeta específica.
   */
  async getDocumentsByFolderId(carpetaId, pacienteId) {
    const stmt = this.db.prepare(`
      SELECT 
        d.*,
        u.nombre_completo AS subido_por_nombre,
        c.nombre AS carpeta_nombre
      FROM paciente_documentos d
      JOIN usuarios u ON d.subido_por_usuario_id = u.id
      JOIN paciente_carpetas c ON d.carpeta_id = c.id
      WHERE d.carpeta_id = ? AND d.paciente_id = ? AND d.activo = 1 AND c.activo = 1
      ORDER BY d.created_at DESC
    `);
    return stmt.all(carpetaId, pacienteId);
  }

  /**
   * Obtiene todos los documentos activos de un paciente agrupados con metadatos.
   * Filtra según visibilidad de carpetas privadas del terapeuta y estado activo de la carpeta.
   */
  async getDocumentsByPatientId(pacienteId, currentUser = null) {
    let sql = `
      SELECT 
        d.*,
        c.nombre AS carpeta_nombre,
        c.orden AS carpeta_orden,
        u.nombre_completo AS subido_por_nombre
      FROM paciente_documentos d
      JOIN paciente_carpetas c ON d.carpeta_id = c.id
      JOIN usuarios u ON d.subido_por_usuario_id = u.id
      WHERE d.paciente_id = ? AND d.activo = 1 AND c.activo = 1
    `;
    const params = [pacienteId];

    if (currentUser && currentUser.rol === 'TERAPEUTA') {
      sql += ` AND (c.es_sistema = 1 OR c.creado_por_usuario_id = ?)`;
      params.push(currentUser.id);
    }

    sql += ` ORDER BY c.orden ASC, d.created_at DESC`;
    return this.db.prepare(sql).all(...params);
  }

  /**
   * Obtiene todos los documentos desvinculados/anulados de un paciente.
   */
  async getInactiveDocumentsByPatientId(pacienteId, currentUser = null) {
    let sql = `
      SELECT 
        d.*,
        c.nombre AS carpeta_nombre,
        c.orden AS carpeta_orden,
        u.nombre_completo AS subido_por_nombre,
        ua.nombre_completo AS anulado_por_nombre
      FROM paciente_documentos d
      JOIN paciente_carpetas c ON d.carpeta_id = c.id
      JOIN usuarios u ON d.subido_por_usuario_id = u.id
      LEFT JOIN usuarios ua ON d.anulado_por_usuario_id = ua.id
      WHERE d.paciente_id = ? AND d.activo = 0
    `;
    const params = [pacienteId];

    if (currentUser && currentUser.rol === 'TERAPEUTA') {
      sql += ` AND (c.es_sistema = 1 OR c.creado_por_usuario_id = ?)`;
      params.push(currentUser.id);
    }

    sql += ` ORDER BY d.fecha_anulacion DESC, d.id DESC`;
    return this.db.prepare(sql).all(...params);
  }

  /**
   * Obtiene un documento por su ID.
   */
  async getDocumentById(id) {
    const stmt = this.db.prepare(`
      SELECT 
        d.*,
        c.nombre AS carpeta_nombre,
        u.nombre_completo AS subido_por_nombre
      FROM paciente_documentos d
      JOIN paciente_carpetas c ON d.carpeta_id = c.id
      JOIN usuarios u ON d.subido_por_usuario_id = u.id
      WHERE d.id = ?
    `);
    return stmt.get(id) || null;
  }

  /**
   * Registra un nuevo documento o estudio externo adjunto (PDF, imagen).
   */
  async createDocument(data) {
    const stmt = this.db.prepare(`
      INSERT INTO paciente_documentos (
        carpeta_id, paciente_id, nombre_original, nombre_almacenado, tipo_mime,
        tamano_bytes, categoria_clinica, descripcion, subido_por_usuario_id, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const info = stmt.run(
      data.carpetaId,
      data.pacienteId,
      data.nombreOriginal,
      data.nombreAlmacenado,
      data.tipoMime,
      data.tamanoBytes,
      data.categoriaClinica || 'ESTUDIO_EXTERNO',
      data.descripcion ? data.descripcion.trim() : null,
      data.subidoPorUsuarioId
    );

    return this.getDocumentById(info.lastInsertRowid);
  }

  /**
   * Anulación lógica (soft delete) de un documento con justificación médica.
   */
  async softDeleteDocument(id, anuladoPorId, motivoAnulacion) {
    const stmt = this.db.prepare(`
      UPDATE paciente_documentos 
      SET activo = 0,
          anulado_por_usuario_id = ?,
          motivo_anulacion = ?,
          fecha_anulacion = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const info = stmt.run(anuladoPorId, motivoAnulacion, id);
    return info.changes > 0;
  }

  /**
   * Reincorporación de un documento clínico previamente anulado.
   */
  async restoreDocument(id) {
    const stmt = this.db.prepare(`
      UPDATE paciente_documentos 
      SET activo = 1,
          anulado_por_usuario_id = NULL,
          motivo_anulacion = NULL,
          fecha_anulacion = NULL
      WHERE id = ?
    `);
    const info = stmt.run(id);
    return info.changes > 0;
  }

  /**
   * Registra un check-in de pauta en el hogar realizado por el tutor legal.
   */
  async createHomePracticeCheckin(data) {
    const stmt = this.db.prepare(`
      INSERT INTO tutor_seguimiento_hogar (
        meta_id, paciente_id, tutor_id, nivel_respuesta, observacion_hogar
      ) VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      data.metaId,
      data.pacienteId,
      data.tutorId,
      data.nivelRespuesta,
      data.observacionHogar ? data.observacionHogar.trim() : null
    );
    return this.db.prepare('SELECT * FROM tutor_seguimiento_hogar WHERE id = ?').get(info.lastInsertRowid);
  }

  /**
   * Obtiene el historial de prácticas en el hogar para un paciente y opcionalmente una meta.
   */
  async getHomePracticeHistory(pacienteId, metaId = null) {
    let sql = `
      SELECT 
        tsh.*,
        t.nombres AS tutor_nombres,
        t.apellidos AS tutor_apellidos,
        t.parentesco,
        t.ci,
        m.descripcion_meta,
        m.area_intervencion
      FROM tutor_seguimiento_hogar tsh
      JOIN tutores t ON tsh.tutor_id = t.id
      JOIN metas_terapeuticas m ON tsh.meta_id = m.id
      WHERE tsh.paciente_id = ?
    `;
    const params = [pacienteId];
    if (metaId) {
      sql += ` AND tsh.meta_id = ?`;
      params.push(metaId);
    }
    sql += ` ORDER BY tsh.created_at DESC LIMIT 30`;
    return this.db.prepare(sql).all(...params);
  }

  /**
   * Obtiene los planes de intervención (PTI) de una historia clínica con su progreso promedio.
   */
  async getInterventionPlansByHistoryId(historiaId) {
    const stmt = this.db.prepare(`
      SELECT 
        pi.*,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos,
        t.registro_profesional AS terapeuta_matricula,
        esp.nombre AS especialidad_nombre,
        (SELECT COUNT(*) FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id) AS total_metas,
        (SELECT COUNT(*) FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id AND mt.porcentaje_logro = 100) AS metas_consolidadas,
        (SELECT ROUND(AVG(mt.porcentaje_logro), 1) FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id) AS progreso_promedio
      FROM planes_intervencion pi
      JOIN terapeutas t ON pi.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      WHERE pi.historia_id = ?
      ORDER BY 
        CASE WHEN pi.estado = 'ACTIVO' THEN 1 ELSE 2 END,
        pi.created_at DESC
    `);

    const plans = stmt.all(historiaId);

    // Adjuntar las metas SMART a cada plan (con conteo inalterable de revisiones y trazabilidad)
    for (const plan of plans) {
      plan.metas = await this.getSmartGoalsByPlanId(plan.id);
    }

    return plans;
  }

  /**
   * Obtiene un plan de intervención por su ID con sus metas y trazabilidad.
   */
  async getInterventionPlanById(id) {
    const stmt = this.db.prepare(`
      SELECT 
        pi.*,
        p.nombres AS paciente_nombres,
        p.apellidos AS paciente_apellidos,
        p.codigo_expediente AS paciente_codigo,
        p.fecha_nacimiento AS paciente_fecha_nacimiento,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos,
        t.registro_profesional AS terapeuta_matricula,
        esp.nombre AS especialidad_nombre,
        (SELECT COUNT(*) FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id) AS total_metas,
        (SELECT COUNT(*) FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id AND mt.porcentaje_logro = 100) AS metas_consolidadas,
        (SELECT ROUND(AVG(mt.porcentaje_logro), 1) FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id) AS progreso_promedio
      FROM planes_intervencion pi
      JOIN pacientes p ON pi.paciente_id = p.id
      JOIN terapeutas t ON pi.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      WHERE pi.id = ?
    `);

    const plan = stmt.get(id);
    if (!plan) return null;

    plan.metas = await this.getSmartGoalsByPlanId(plan.id);
    return plan;
  }

  /**
   * Crea un nuevo Plan Terapéutico Individualizado (PTI).
   */
  async createInterventionPlan(data) {
    const stmt = this.db.prepare(`
      INSERT INTO planes_intervencion (
        historia_id, paciente_id, terapeuta_id, diagnostico_codigo, diagnostico_glosa,
        diagnostico_catalogo_id, titulo, objetivo_general, periodicidad_meses,
        fecha_inicio, fecha_revision, recomendaciones_familia, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO')
    `);

    const info = stmt.run(
      data.historiaId,
      data.pacienteId,
      data.terapeutaId,
      data.diagnosticoCodigo || null,
      data.diagnosticoGlosa || null,
      data.diagnosticoCatalogoId || null,
      data.titulo.trim(),
      data.objetivoGeneral.trim(),
      data.periodicidadMeses || 3,
      data.fechaInicio || new Date().toISOString().split('T')[0],
      data.fechaRevision || null,
      data.recomendacionesFamilia ? data.recomendacionesFamilia.trim() : null
    );

    const planId = info.lastInsertRowid;

    // Si se enviaron metas iniciales, insertarlas de forma atómica
    if (Array.isArray(data.metas) && data.metas.length > 0) {
      let orden = 1;
      for (const m of data.metas) {
        if (m.descripcionMeta && m.descripcionMeta.trim() !== '') {
          await this.createSmartGoal({
            planId,
            descripcionMeta: m.descripcionMeta,
            areaIntervencion: m.areaIntervencion || 'ATENCION_CONCENTRACION',
            criterioExito: m.criterioExito || 'Cumplimiento verificable en consultorio y hogar.',
            porcentajeLogro: m.porcentajeLogro || 0,
            pautasHogar: m.pautasHogar || null,
            orden: orden++
          });
        }
      }
    }

    return this.getInterventionPlanById(planId);
  }

  /**
   * Actualiza el estado de un plan (soft close: 'CUMPLIDO' | 'DESCONTINUADO').
   */
  async updateInterventionPlanStatus(id, estado, motivoCierre, cerradoPorId) {
    const stmt = this.db.prepare(`
      UPDATE planes_intervencion 
      SET estado = ?,
          motivo_cierre = ?,
          cerrado_por_usuario_id = ?,
          fecha_cierre = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(estado, motivoCierre || null, cerradoPorId || null, id);
    return this.getInterventionPlanById(id);
  }

  /**
   * Obtiene una meta SMART por su ID.
   */
  async getSmartGoalById(id) {
    const stmt = this.db.prepare(`
      SELECT 
        mt.*,
        (SELECT COUNT(*) FROM seguimiento_metas_historial smh WHERE smh.meta_id = mt.id) AS total_revisiones,
        (SELECT MAX(smh.fecha_registro) FROM seguimiento_metas_historial smh WHERE smh.meta_id = mt.id) AS ultima_revision_fecha
      FROM metas_terapeuticas mt
      WHERE mt.id = ?
    `);
    return stmt.get(id) || null;
  }

  /**
   * Obtiene las metas SMART asociadas a un plan.
   */
  async getSmartGoalsByPlanId(planId) {
    const stmt = this.db.prepare(`
      SELECT 
        mt.*,
        (SELECT COUNT(*) FROM seguimiento_metas_historial smh WHERE smh.meta_id = mt.id) AS total_revisiones,
        (SELECT MAX(smh.fecha_registro) FROM seguimiento_metas_historial smh WHERE smh.meta_id = mt.id) AS ultima_revision_fecha
      FROM metas_terapeuticas mt
      WHERE mt.plan_id = ?
      ORDER BY mt.orden ASC, mt.id ASC
    `);
    return stmt.all(planId);
  }

  /**
   * Registra una nueva meta SMART en un plan PTI.
   */
  async createSmartGoal(data) {
    const estado = data.porcentajeLogro === 100 ? 'CONSOLIDADA' : (data.porcentajeLogro > 0 ? 'EN_PROCESO' : 'PENDIENTE');

    const stmt = this.db.prepare(`
      INSERT INTO metas_terapeuticas (
        plan_id, descripcion_meta, area_intervencion, criterio_exito,
        porcentaje_logro, estado, pautas_hogar, orden
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      data.planId,
      data.descripcionMeta.trim(),
      data.areaIntervencion || 'ATENCION_CONCENTRACION',
      data.criterioExito.trim(),
      data.porcentajeLogro || 0,
      estado,
      data.pautasHogar ? data.pautasHogar.trim() : null,
      data.orden || 0
    );

    // Actualizar timestamp en el plan
    this.db.prepare(`UPDATE planes_intervencion SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(data.planId);

    return this.db.prepare(`SELECT * FROM metas_terapeuticas WHERE id = ?`).get(info.lastInsertRowid);
  }

  /**
   * Actualiza el avance cuantitativo de una meta SMART registrando trazabilidad inalterable en historial.
   */
  async updateSmartGoalProgress(metaId, data) {
    const currentMeta = this.db.prepare(`SELECT * FROM metas_terapeuticas WHERE id = ?`).get(metaId);
    if (!currentMeta) {
      throw new Error(`La meta terapéutica con ID [${metaId}] no existe.`);
    }

    const nuevoPorcentaje = Number(data.porcentajeLogro);
    const estado = nuevoPorcentaje === 100 ? 'CONSOLIDADA' : (nuevoPorcentaje > 0 ? 'EN_PROCESO' : 'PENDIENTE');

    // 1. Actualizar la meta
    const updateStmt = this.db.prepare(`
      UPDATE metas_terapeuticas 
      SET porcentaje_logro = ?,
          estado = ?,
          pautas_hogar = COALESCE(?, pautas_hogar),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(nuevoPorcentaje, estado, data.pautasHogar ? data.pautasHogar.trim() : null, metaId);

    // 2. Registrar en la bitácora histórica de seguimiento de metas (Trazabilidad clínica)
    const historyStmt = this.db.prepare(`
      INSERT INTO seguimiento_metas_historial (
        meta_id, plan_id, paciente_id, terapeuta_id, porcentaje_anterior,
        nuevo_porcentaje, observaciones_clinicas, sesion_numero
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    historyStmt.run(
      metaId,
      currentMeta.plan_id,
      data.pacienteId,
      data.terapeutaId,
      currentMeta.porcentaje_logro,
      nuevoPorcentaje,
      data.observacionesClinicas ? data.observacionesClinicas.trim() : 'Actualización de avance de meta SMART.',
      data.sesionNumero || null
    );

    // 3. Actualizar timestamp del plan
    this.db.prepare(`UPDATE planes_intervencion SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(currentMeta.plan_id);

    return await this.getSmartGoalById(metaId);
  }

  /**
   * Obtiene la cronología de evolución de una meta SMART.
   */
  async getGoalEvolutionHistory(metaId) {
    const stmt = this.db.prepare(`
      SELECT 
        smh.*,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos
      FROM seguimiento_metas_historial smh
      JOIN terapeutas t ON smh.terapeuta_id = t.id
      WHERE smh.meta_id = ?
      ORDER BY smh.fecha_registro DESC
    `);
    return stmt.all(metaId);
  }
}

