import { PostgresConnection } from '../../core/PostgresConnection.js';
import { IClinicalRecordRepository } from '../../domain/interfaces/IClinicalRecordRepository.js';
import { getBoliviaTodayDateString } from '../../utils/dateTime.js';

export class PostgresClinicalRecordRepository extends IClinicalRecordRepository {
  async findHistoryById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
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
         p.terapeuta_id AS paciente_terapeuta_id,
         t.id AS terapeuta_id,
         t.nombres AS terapeuta_nombres,
         t.apellidos AS terapeuta_apellidos,
         t.registro_profesional AS terapeuta_matricula,
         esp.nombre AS especialidad_nombre,
         (SELECT COUNT(*)::int FROM notas_evolucion ne WHERE ne.historia_id = hc.id) AS total_sesiones,
         (SELECT MAX(ne.fecha_sesion) FROM notas_evolucion ne WHERE ne.historia_id = hc.id) AS ultima_sesion_fecha,
         CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END AS tiene_anamnesis
       FROM historias_clinicas hc
       JOIN pacientes p ON hc.paciente_id = p.id
       LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
       LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
       LEFT JOIN anamnesis a ON a.historia_id = hc.id
       WHERE hc.id = $1`,
      [id]
    );

    const record = rows[0];
    if (!record) return null;

    const { rows: allLinkedTutors } = await PostgresConnection.query(
      `SELECT tut.id, tut.nombres, tut.apellidos, tut.ci, tut.whatsapp, tut.email, pt.parentesco, pt.es_principal, u.email AS usuario_email
       FROM paciente_tutor pt
       JOIN tutores tut ON pt.tutor_id = tut.id
       LEFT JOIN usuarios u ON tut.usuario_id = u.id
       WHERE pt.paciente_id = $1
       ORDER BY pt.es_principal DESC, tut.nombres ASC`,
      [record.paciente_id]
    );
    record.tutores = allLinkedTutors;
    record.tutor_principal = allLinkedTutors.length > 0 ? allLinkedTutors[0] : null;

    return record;
  }

  async findHistoryByPatientId(pacienteId) {
    const { rows } = await PostgresConnection.query(
      `SELECT id FROM historias_clinicas WHERE paciente_id = $1`,
      [pacienteId]
    );
    if (!rows[0]) return null;
    return this.findHistoryById(rows[0].id);
  }

  async findHistoryByNumeroExpediente(numeroExpediente) {
    const { rows } = await PostgresConnection.query(
      `SELECT id FROM historias_clinicas WHERE numero_expediente = $1`,
      [numeroExpediente]
    );
    if (!rows[0]) return null;
    return this.findHistoryById(rows[0].id);
  }

  async findAllHistories(options = {}) {
    const { search = '', estado = null, terapeutaId = null, limit = 50, offset = 0 } = options;

    const whereConditions = [];
    const params = [];

    if (search && search.trim() !== '') {
      params.push(`%${search.trim()}%`);
      const pIdx = `$${params.length}`;
      whereConditions.push(`(
        p.nombres ILIKE ${pIdx} OR
        p.apellidos ILIKE ${pIdx} OR
        p.ci ILIKE ${pIdx} OR
        hc.numero_expediente ILIKE ${pIdx}
      )`);
    }

    if (estado && estado !== 'TODOS') {
      params.push(estado);
      whereConditions.push(`hc.estado = $${params.length}`);
    }

    if (terapeutaId) {
      params.push(terapeutaId);
      whereConditions.push(`p.terapeuta_id = $${params.length}`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countRes = await PostgresConnection.query(
      `SELECT COUNT(*)::int AS total
       FROM historias_clinicas hc
       JOIN pacientes p ON hc.paciente_id = p.id
       ${whereClause}`,
      params
    );
    const total = countRes.rows[0].total;

    const dataParams = [...params, Number(limit), Number(offset)];
    const { rows: records } = await PostgresConnection.query(
      `SELECT
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
         (SELECT COUNT(*)::int FROM notas_evolucion ne WHERE ne.historia_id = hc.id) AS total_sesiones,
         (SELECT MAX(ne.fecha_sesion) FROM notas_evolucion ne WHERE ne.historia_id = hc.id) AS ultima_sesion_fecha,
         CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END AS tiene_anamnesis
       FROM historias_clinicas hc
       JOIN pacientes p ON hc.paciente_id = p.id
       LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
       LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
       LEFT JOIN anamnesis a ON a.historia_id = hc.id
       ${whereClause}
       ORDER BY hc.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );

    return { total, records };
  }

  async createHistory(data) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO historias_clinicas (
         paciente_id,
         numero_expediente,
         fecha_apertura,
         estado,
         observaciones_ingreso,
         triaje_origen_id
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        data.pacienteId,
        data.numeroExpediente,
        data.fechaApertura || getBoliviaTodayDateString(),
        data.estado || 'ACTIVO',
        data.observacionesIngreso || null,
        data.triajeOrigenId || null
      ]
    );

    return this.findHistoryById(rows[0].id);
  }

  async updateHistoryStatus(id, estado, observaciones = null) {
    await PostgresConnection.query(
      `UPDATE historias_clinicas
       SET estado = $1,
           observaciones_ingreso = COALESCE($2, observaciones_ingreso),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [estado, observaciones, id]
    );

    return this.findHistoryById(id);
  }

  async syncPatientClinicalState(pacienteId, estado) {
    await PostgresConnection.query(
      `UPDATE pacientes SET estado_clinico = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [estado, pacienteId]
    );
  }

  async checkTutorPatientRelation(pacienteId, usuarioId) {
    const { rows } = await PostgresConnection.query(
      `SELECT pt.id
       FROM paciente_tutor pt
       JOIN tutores t ON pt.tutor_id = t.id
       WHERE pt.paciente_id = $1 AND t.usuario_id = $2
       LIMIT 1`,
      [pacienteId, usuarioId]
    );
    return rows[0] || null;
  }

  async getTutorIdByUserId(usuarioId) {
    const { rows } = await PostgresConnection.query(
      `SELECT id, nombres, apellidos FROM tutores WHERE usuario_id = $1 LIMIT 1`,
      [usuarioId]
    );
    return rows[0] || null;
  }

  async getChildrenForTutor(tutorId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         p.id AS paciente_id,
         p.nombres,
         p.apellidos,
         p.codigo_expediente,
         p.fecha_nacimiento,
         p.ci,
         pt.parentesco,
         hc.id AS historia_id
       FROM pacientes p
       JOIN paciente_tutor pt ON p.id = pt.paciente_id
       LEFT JOIN historias_clinicas hc ON p.id = hc.paciente_id
       WHERE pt.tutor_id = $1 AND p.activo = 1
       ORDER BY p.nombres ASC`,
      [tutorId]
    );
    return rows;
  }

  async getAssignedTherapistForPatient(pacienteId) {
    const { rows } = await PostgresConnection.query(
      `SELECT t.id, t.nombres, t.apellidos, t.color_agenda, t.turnos_atencion, t.bio,
              t.registro_profesional,
              esp.nombre AS especialidad_nombre,
              amb.codigo AS ambiente_codigo, amb.nombre AS ambiente_nombre
       FROM pacientes p
       LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
       LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
       LEFT JOIN ambientes amb ON t.ambiente_preferido_id = amb.id
       WHERE p.id = $1`,
      [pacienteId]
    );
    return rows[0] || null;
  }

  async getRecentHomeCheckinAndMonthCount(metaId) {
    const { rows: recentRows } = await PostgresConnection.query(
      `SELECT nivel_respuesta, observacion_hogar, fecha_registro, created_at
       FROM tutor_seguimiento_hogar
       WHERE meta_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [metaId]
    );

    const currentMonthPrefix = getBoliviaTodayDateString().slice(0, 7);
    const { rows: countRows } = await PostgresConnection.query(
      `SELECT COUNT(*)::int AS count
       FROM tutor_seguimiento_hogar
       WHERE meta_id = $1
         AND TO_CHAR(fecha_registro, 'YYYY-MM') = $2`,
      [metaId, currentMonthPrefix]
    );

    return {
      recentCheckin: recentRows[0] || null,
      totalMes: countRows[0]?.count || 0
    };
  }

  async getSmartGoalRawById(metaId) {
    const { rows } = await PostgresConnection.query(
      `SELECT * FROM metas_terapeuticas WHERE id = $1`,
      [metaId]
    );
    return rows[0] || null;
  }

  async getAnamnesisByHistoryId(historiaId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         a.*,
         u.nombre_completo AS evaluador_nombre,
         u.email AS evaluador_email,
         r.nombre AS evaluador_rol
       FROM anamnesis a
       LEFT JOIN usuarios u ON a.evaluador_id = u.id
       LEFT JOIN roles r ON u.rol_id = r.id
       WHERE a.historia_id = $1`,
      [historiaId]
    );
    return rows[0] || null;
  }

  async saveAnamnesis(historiaId, data) {
    const { rows: existingRows } = await PostgresConnection.query(
      `SELECT id FROM anamnesis WHERE historia_id = $1`,
      [historiaId]
    );

    if (existingRows[0]) {
      await PostgresConnection.query(
        `UPDATE anamnesis SET
           motivo_consulta = $1,
           historia_problema_actual = $2,
           antecedentes_perinatales = $3,
           desarrollo_motor_lenguaje = $4,
           antecedentes_medicos = $5,
           antecedentes_familiares = $6,
           dinamica_familiar_escolar = $7,
           exploracion_cognitiva_conductual = $8,
           impresion_diagnostica_inicial = $9,
           evaluador_id = COALESCE($10, evaluador_id),
           fecha_evaluacion = COALESCE($11, fecha_evaluacion),
           updated_at = CURRENT_TIMESTAMP
         WHERE historia_id = $12`,
        [
          data.motivoConsulta,
          data.historiaProblemaActual || null,
          data.antecedentesPerinatales || null,
          data.desarrolloMotorLenguaje || null,
          data.antecedentesMedicos || null,
          data.antecedentesFamiliares || null,
          data.dinamicaFamiliarEscolar || null,
          data.exploracionCognitivaConductual || null,
          data.impresionDiagnosticaInicial || null,
          data.evaluadorId || null,
          data.fechaEvaluacion || null,
          historiaId
        ]
      );
    } else {
      await PostgresConnection.query(
        `INSERT INTO anamnesis (
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
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          historiaId,
          data.motivoConsulta,
          data.historiaProblemaActual || null,
          data.antecedentesPerinatales || null,
          data.desarrolloMotorLenguaje || null,
          data.antecedentesMedicos || null,
          data.antecedentesFamiliares || null,
          data.dinamicaFamiliarEscolar || null,
          data.exploracionCognitivaConductual || null,
          data.impresionDiagnosticaInicial || null,
          data.evaluadorId || null,
          data.fechaEvaluacion || getBoliviaTodayDateString()
        ]
      );
    }

    return this.getAnamnesisByHistoryId(historiaId);
  }

  async findSoapNotesByHistoryId(historiaId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
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
       WHERE ne.historia_id = $1
       ORDER BY ne.numero_sesion DESC, ne.fecha_sesion DESC, ne.id DESC`,
      [historiaId]
    );
    return rows;
  }

  async getNextSessionNumber(historiaId) {
    const { rows } = await PostgresConnection.query(
      `SELECT (COALESCE(MAX(numero_sesion), 0) + 1)::int AS next_session
       FROM notas_evolucion
       WHERE historia_id = $1`,
      [historiaId]
    );
    return rows[0] ? rows[0].next_session : 1;
  }

  async createSoapNote(data) {
    const numeroSesion = data.numeroSesion || (await this.getNextSessionNumber(data.historiaId));

    const { rows: insertRows } = await PostgresConnection.query(
      `INSERT INTO notas_evolucion (
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
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING id`,
      [
        data.historiaId,
        data.pacienteId,
        data.terapeutaId,
        data.usuarioId,
        numeroSesion,
        data.fechaSesion || getBoliviaTodayDateString(),
        data.horaInicio || null,
        data.horaFin || null,
        data.ambienteId || null,
        data.subjetivo,
        data.objetivo,
        data.analisis,
        data.plan,
        data.diagnosticoCodigo || null,
        data.diagnosticoGlosa || null,
        data.recomendacionesHogar || null,
        data.asistidoPorIa ? 1 : 0,
        1,
        data.firmaDigitalSnapshot || null
      ]
    );

    await PostgresConnection.query(
      `UPDATE historias_clinicas SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [data.historiaId]
    );

    const { rows } = await PostgresConnection.query(
      `SELECT
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
       WHERE ne.id = $1`,
      [insertRows[0].id]
    );

    return rows[0];
  }

  async searchDiagnostics(query = '', categoria = null) {
    let sql = `SELECT * FROM catalogo_diagnosticos WHERE activo = 1`;
    const params = [];

    if (query && query.trim() !== '') {
      params.push(`%${query.trim()}%`);
      const pIdx = `$${params.length}`;
      sql += ` AND (codigo ILIKE ${pIdx} OR nombre ILIKE ${pIdx} OR descripcion ILIKE ${pIdx} OR criterios_resumen ILIKE ${pIdx})`;
    }

    if (categoria && categoria.trim() !== '' && categoria !== 'TODAS') {
      params.push(categoria.trim());
      sql += ` AND categoria = $${params.length}`;
    }

    sql += ` ORDER BY categoria ASC, codigo ASC LIMIT 30`;
    const { rows } = await PostgresConnection.query(sql, params);
    return rows;
  }

  async getFoldersByPatientId(pacienteId, includeInactive = false, currentUser = null) {
    const countRes = await PostgresConnection.query(
      `SELECT COUNT(*)::int AS count FROM paciente_carpetas WHERE paciente_id = $1 AND activo = 1`,
      [pacienteId]
    );
    const count = countRes.rows[0]?.count || 0;

    if (count === 0) {
      const defaultFolders = [
        { nombre: '1. Evaluaciones Neuropsicológicas y Test', desc: 'Protocolos de aplicación WISC-V, CUMANES, Test d2 y perfiles de evaluación', orden: 1 },
        { nombre: '2. Informes Médicos y Neurológicos Externos', desc: 'Dictámenes médicos externos, neuropediatría, pediatría y psiquiatría', orden: 2 },
        { nombre: '3. Estudios Clínicos / Laboratorios / EEG / TAC', desc: 'Resultados de laboratorio, electroencefalogramas, tomografías y neuroimágenes', orden: 3 },
        { nombre: '4. Informes Escolares y Gabinetes Psicopedagógicos', desc: 'Boletines de notas, reportes de profesores y psicología escolar', orden: 4 },
        { nombre: '5. Consentimientos y Documentación Legal', desc: 'Consentimientos informados firmados digitalmente y autorizaciones legales', orden: 5 }
      ];

      for (const f of defaultFolders) {
        await PostgresConnection.query(
          `INSERT INTO paciente_carpetas (paciente_id, nombre, descripcion, es_sistema, orden, activo, creado_por_usuario_id)
           VALUES ($1, $2, $3, 1, $4, 1, NULL)`,
          [pacienteId, f.nombre, f.desc, f.orden]
        );
      }
    }

    let sql = `
      SELECT
        c.*,
        (SELECT COUNT(*)::int FROM paciente_documentos d WHERE d.carpeta_id = c.id AND d.activo = 1) AS total_documentos
      FROM paciente_carpetas c
      WHERE c.paciente_id = $1
    `;
    const params = [pacienteId];

    if (!includeInactive) {
      sql += ` AND c.activo = 1`;
    }

    if (currentUser && currentUser.rol === 'TERAPEUTA') {
      params.push(currentUser.id);
      sql += ` AND (c.es_sistema = 1 OR c.creado_por_usuario_id = $${params.length})`;
    }

    sql += ` ORDER BY c.orden ASC, c.id ASC`;
    const { rows } = await PostgresConnection.query(sql, params);
    return rows;
  }

  async getFolderById(folderId) {
    const { rows } = await PostgresConnection.query(
      'SELECT * FROM paciente_carpetas WHERE id = $1',
      [folderId]
    );
    return rows[0] || null;
  }

  async updateFolderStatus(folderId, activo, motivoBaja = null) {
    if (activo) {
      await PostgresConnection.query(
        'UPDATE paciente_carpetas SET activo = 1, motivo_baja = NULL, fecha_baja = NULL WHERE id = $1',
        [folderId]
      );
    } else {
      await PostgresConnection.query(
        'UPDATE paciente_carpetas SET activo = 0, motivo_baja = $1, fecha_baja = CURRENT_TIMESTAMP WHERE id = $2',
        [motivoBaja, folderId]
      );
    }
    return this.getFolderById(folderId);
  }

  async createFolder(data) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO paciente_carpetas (paciente_id, nombre, descripcion, es_sistema, orden, activo, creado_por_usuario_id)
       VALUES ($1, $2, $3, 0, $4, 1, $5)
       RETURNING *`,
      [
        data.pacienteId,
        data.nombre.trim(),
        data.descripcion ? data.descripcion.trim() : null,
        data.orden || 99,
        data.creadoPorUsuarioId || null
      ]
    );
    return rows[0];
  }

  async getDocumentsByFolderId(carpetaId, pacienteId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         d.*,
         u.nombre_completo AS subido_por_nombre,
         c.nombre AS carpeta_nombre
       FROM paciente_documentos d
       JOIN usuarios u ON d.subido_por_usuario_id = u.id
       JOIN paciente_carpetas c ON d.carpeta_id = c.id
       WHERE d.carpeta_id = $1 AND d.paciente_id = $2 AND d.activo = 1 AND c.activo = 1
       ORDER BY d.created_at DESC`,
      [carpetaId, pacienteId]
    );
    return rows;
  }

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
      WHERE d.paciente_id = $1 AND d.activo = 1 AND c.activo = 1
    `;
    const params = [pacienteId];

    if (currentUser && currentUser.rol === 'TERAPEUTA') {
      params.push(currentUser.id);
      sql += ` AND (c.es_sistema = 1 OR c.creado_por_usuario_id = $${params.length})`;
    }

    sql += ` ORDER BY c.orden ASC, d.created_at DESC`;
    const { rows } = await PostgresConnection.query(sql, params);
    return rows;
  }

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
      WHERE d.paciente_id = $1 AND d.activo = 0
    `;
    const params = [pacienteId];

    if (currentUser && currentUser.rol === 'TERAPEUTA') {
      params.push(currentUser.id);
      sql += ` AND (c.es_sistema = 1 OR c.creado_por_usuario_id = $${params.length})`;
    }

    sql += ` ORDER BY d.fecha_anulacion DESC, d.id DESC`;
    const { rows } = await PostgresConnection.query(sql, params);
    return rows;
  }

  async getDocumentById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         d.*,
         c.nombre AS carpeta_nombre,
         u.nombre_completo AS subido_por_nombre
       FROM paciente_documentos d
       JOIN paciente_carpetas c ON d.carpeta_id = c.id
       JOIN usuarios u ON d.subido_por_usuario_id = u.id
       WHERE d.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async createDocument(data) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO paciente_documentos (
         carpeta_id, paciente_id, nombre_original, nombre_almacenado, tipo_mime,
         tamano_bytes, categoria_clinica, descripcion, subido_por_usuario_id, activo
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
       RETURNING id`,
      [
        data.carpetaId,
        data.pacienteId,
        data.nombreOriginal,
        data.nombreAlmacenado,
        data.tipoMime,
        data.tamanoBytes,
        data.categoriaClinica || 'ESTUDIO_EXTERNO',
        data.descripcion ? data.descripcion.trim() : null,
        data.subidoPorUsuarioId
      ]
    );

    return this.getDocumentById(rows[0].id);
  }

  async softDeleteDocument(id, anuladoPorId, motivoAnulacion) {
    const res = await PostgresConnection.query(
      `UPDATE paciente_documentos
       SET activo = 0,
           anulado_por_usuario_id = $1,
           motivo_anulacion = $2,
           fecha_anulacion = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [anuladoPorId, motivoAnulacion, id]
    );
    return res.rowCount > 0;
  }

  async restoreDocument(id) {
    const res = await PostgresConnection.query(
      `UPDATE paciente_documentos
       SET activo = 1,
           anulado_por_usuario_id = NULL,
           motivo_anulacion = NULL,
           fecha_anulacion = NULL
       WHERE id = $1`,
      [id]
    );
    return res.rowCount > 0;
  }

  async createHomePracticeCheckin(data) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO tutor_seguimiento_hogar (
         meta_id, paciente_id, tutor_id, nivel_respuesta, observacion_hogar
       ) VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.metaId,
        data.pacienteId,
        data.tutorId,
        data.nivelRespuesta,
        data.observacionHogar ? data.observacionHogar.trim() : null
      ]
    );
    return rows[0];
  }

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
      WHERE tsh.paciente_id = $1
    `;
    const params = [pacienteId];
    if (metaId) {
      params.push(metaId);
      sql += ` AND tsh.meta_id = $${params.length}`;
    }
    sql += ` ORDER BY tsh.created_at DESC LIMIT 30`;
    const { rows } = await PostgresConnection.query(sql, params);
    return rows;
  }

  async getInterventionPlansByHistoryId(historiaId) {
    const { rows: plans } = await PostgresConnection.query(
      `SELECT
         pi.*,
         t.nombres AS terapeuta_nombres,
         t.apellidos AS terapeuta_apellidos,
         t.registro_profesional AS terapeuta_matricula,
         esp.nombre AS especialidad_nombre,
         (SELECT COUNT(*)::int FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id) AS total_metas,
         (SELECT COUNT(*)::int FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id AND mt.porcentaje_logro = 100) AS metas_consolidadas,
         (SELECT ROUND(AVG(mt.porcentaje_logro), 1)::float FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id) AS progreso_promedio
       FROM planes_intervencion pi
       JOIN terapeutas t ON pi.terapeuta_id = t.id
       LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
       WHERE pi.historia_id = $1
       ORDER BY
         CASE WHEN pi.estado = 'ACTIVO' THEN 1 ELSE 2 END,
         pi.created_at DESC`,
      [historiaId]
    );

    for (const plan of plans) {
      plan.metas = await this.getSmartGoalsByPlanId(plan.id);
    }

    return plans;
  }

  async getInterventionPlanById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         pi.*,
         p.nombres AS paciente_nombres,
         p.apellidos AS paciente_apellidos,
         p.codigo_expediente AS paciente_codigo,
         p.fecha_nacimiento AS paciente_fecha_nacimiento,
         t.nombres AS terapeuta_nombres,
         t.apellidos AS terapeuta_apellidos,
         t.registro_profesional AS terapeuta_matricula,
         esp.nombre AS especialidad_nombre,
         (SELECT COUNT(*)::int FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id) AS total_metas,
         (SELECT COUNT(*)::int FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id AND mt.porcentaje_logro = 100) AS metas_consolidadas,
         (SELECT ROUND(AVG(mt.porcentaje_logro), 1)::float FROM metas_terapeuticas mt WHERE mt.plan_id = pi.id) AS progreso_promedio
       FROM planes_intervencion pi
       JOIN pacientes p ON pi.paciente_id = p.id
       JOIN terapeutas t ON pi.terapeuta_id = t.id
       LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
       WHERE pi.id = $1`,
      [id]
    );

    const plan = rows[0];
    if (!plan) return null;

    plan.metas = await this.getSmartGoalsByPlanId(plan.id);
    return plan;
  }

  async createInterventionPlan(data) {
    const planId = await PostgresConnection.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO planes_intervencion (
           historia_id, paciente_id, terapeuta_id, diagnostico_codigo, diagnostico_glosa,
           diagnostico_catalogo_id, titulo, objetivo_general, periodicidad_meses,
           fecha_inicio, fecha_revision, recomendaciones_familia, estado
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVO')
         RETURNING id`,
        [
          data.historiaId,
          data.pacienteId,
          data.terapeutaId,
          data.diagnosticoCodigo || null,
          data.diagnosticoGlosa || null,
          data.diagnosticoCatalogoId || null,
          data.titulo.trim(),
          data.objetivoGeneral.trim(),
          data.periodicidadMeses || 3,
          data.fechaInicio || getBoliviaTodayDateString(),
          data.fechaRevision || null,
          data.recomendacionesFamilia ? data.recomendacionesFamilia.trim() : null
        ]
      );

      const createdPlanId = rows[0].id;

      if (Array.isArray(data.metas) && data.metas.length > 0) {
        let orden = 1;
        for (const m of data.metas) {
          if (m.descripcionMeta && m.descripcionMeta.trim() !== '') {
            const pct = m.porcentajeLogro || 0;
            const estado = pct === 100 ? 'CONSOLIDADA' : (pct > 0 ? 'EN_PROCESO' : 'PENDIENTE');
            await client.query(
              `INSERT INTO metas_terapeuticas (
                 plan_id, descripcion_meta, area_intervencion, criterio_exito,
                 porcentaje_logro, estado, pautas_hogar, orden
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                createdPlanId,
                m.descripcionMeta.trim(),
                m.areaIntervencion || 'ATENCION_CONCENTRACION',
                (m.criterioExito || 'Cumplimiento verificable en consultorio y hogar.').trim(),
                pct,
                estado,
                m.pautasHogar ? m.pautasHogar.trim() : null,
                orden++
              ]
            );
          }
        }
      }

      return createdPlanId;
    });

    return this.getInterventionPlanById(planId);
  }

  async updateInterventionPlanStatus(id, estado, motivoCierre, cerradoPorId) {
    await PostgresConnection.query(
      `UPDATE planes_intervencion
       SET estado = $1,
           motivo_cierre = $2,
           cerrado_por_usuario_id = $3,
           fecha_cierre = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [estado, motivoCierre || null, cerradoPorId || null, id]
    );
    return this.getInterventionPlanById(id);
  }

  async getSmartGoalById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         mt.*,
         (SELECT COUNT(*)::int FROM seguimiento_metas_historial smh WHERE smh.meta_id = mt.id) AS total_revisiones,
         (SELECT MAX(smh.fecha_registro) FROM seguimiento_metas_historial smh WHERE smh.meta_id = mt.id) AS ultima_revision_fecha
       FROM metas_terapeuticas mt
       WHERE mt.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async getSmartGoalsByPlanId(planId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         mt.*,
         (SELECT COUNT(*)::int FROM seguimiento_metas_historial smh WHERE smh.meta_id = mt.id) AS total_revisiones,
         (SELECT MAX(smh.fecha_registro) FROM seguimiento_metas_historial smh WHERE smh.meta_id = mt.id) AS ultima_revision_fecha
       FROM metas_terapeuticas mt
       WHERE mt.plan_id = $1
       ORDER BY mt.orden ASC, mt.id ASC`,
      [planId]
    );
    return rows;
  }

  async createSmartGoal(data) {
    const estado = data.porcentajeLogro === 100 ? 'CONSOLIDADA' : (data.porcentajeLogro > 0 ? 'EN_PROCESO' : 'PENDIENTE');

    const { rows } = await PostgresConnection.query(
      `INSERT INTO metas_terapeuticas (
         plan_id, descripcion_meta, area_intervencion, criterio_exito,
         porcentaje_logro, estado, pautas_hogar, orden
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.planId,
        data.descripcionMeta.trim(),
        data.areaIntervencion || 'ATENCION_CONCENTRACION',
        data.criterioExito.trim(),
        data.porcentajeLogro || 0,
        estado,
        data.pautasHogar ? data.pautasHogar.trim() : null,
        data.orden || 0
      ]
    );

    await PostgresConnection.query(
      `UPDATE planes_intervencion SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [data.planId]
    );

    return rows[0];
  }

  async updateSmartGoalProgress(metaId, data) {
    await PostgresConnection.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM metas_terapeuticas WHERE id = $1 FOR UPDATE`,
        [metaId]
      );
      const currentMeta = rows[0];
      if (!currentMeta) {
        throw new Error(`La meta terapéutica con ID [${metaId}] no existe.`);
      }

      const nuevoPorcentaje = Number(data.porcentajeLogro);
      const estado = nuevoPorcentaje === 100 ? 'CONSOLIDADA' : (nuevoPorcentaje > 0 ? 'EN_PROCESO' : 'PENDIENTE');

      await client.query(
        `UPDATE metas_terapeuticas
         SET porcentaje_logro = $1,
             estado = $2,
             pautas_hogar = COALESCE($3, pautas_hogar),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [nuevoPorcentaje, estado, data.pautasHogar ? data.pautasHogar.trim() : null, metaId]
      );

      await client.query(
        `INSERT INTO seguimiento_metas_historial (
           meta_id, plan_id, paciente_id, terapeuta_id, porcentaje_anterior,
           nuevo_porcentaje, observaciones_clinicas, sesion_numero
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          metaId,
          currentMeta.plan_id,
          data.pacienteId,
          data.terapeutaId,
          currentMeta.porcentaje_logro,
          nuevoPorcentaje,
          data.observacionesClinicas ? data.observacionesClinicas.trim() : 'Actualización de avance de meta SMART.',
          data.sesionNumero || null
        ]
      );

      await client.query(
        `UPDATE planes_intervencion SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [currentMeta.plan_id]
      );
    });

    return this.getSmartGoalById(metaId);
  }

  async getGoalEvolutionHistory(metaId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         smh.*,
         t.nombres AS terapeuta_nombres,
         t.apellidos AS terapeuta_apellidos
       FROM seguimiento_metas_historial smh
       JOIN terapeutas t ON smh.terapeuta_id = t.id
       WHERE smh.meta_id = $1
       ORDER BY smh.fecha_registro DESC`,
      [metaId]
    );
    return rows;
  }
}
