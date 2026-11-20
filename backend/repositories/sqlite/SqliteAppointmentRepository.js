import { DatabaseConnection } from '../../core/DatabaseConnection.js';
import { IAppointmentRepository } from '../../domain/interfaces/IAppointmentRepository.js';
import { AppError } from '../../core/AppError.js';
import { getBoliviaNowSqlString, getBoliviaTodayDateString } from '../../utils/dateTime.js';

export class SqliteAppointmentRepository extends IAppointmentRepository {
  constructor() {
    super();
    this.db = DatabaseConnection.getInstance();
    this._ensureSchemaMigrations();
  }

  _ensureSchemaMigrations() {
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS citas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          paciente_id INTEGER NOT NULL,
          terapeuta_id INTEGER NOT NULL,
          ambiente_id INTEGER NOT NULL,
          servicio_id INTEGER,
          fecha_hora_inicio DATETIME NOT NULL,
          fecha_hora_fin DATETIME NOT NULL,
          duracion_minutos INTEGER NOT NULL DEFAULT 45,
          estado TEXT NOT NULL DEFAULT 'PROGRAMADA' CHECK (estado IN ('PROGRAMADA', 'CONFIRMADA', 'EN_ATENCION', 'ATENDIDA', 'REPROGRAMADA', 'CANCELADA', 'AUSENTE')),
          motivo_consulta TEXT,
          motivo_cancelacion TEXT,
          notas_internas TEXT,
          reprogramada_de_cita_id INTEGER,
          creado_por_usuario_id INTEGER,
          asistencia_registrada_at DATETIME,
          asistencia_registrada_por_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
          FOREIGN KEY (terapeuta_id) REFERENCES terapeutas(id) ON DELETE RESTRICT,
          FOREIGN KEY (ambiente_id) REFERENCES ambientes(id) ON DELETE RESTRICT,
          FOREIGN KEY (servicio_id) REFERENCES servicios_aranceles(id) ON DELETE SET NULL,
          FOREIGN KEY (reprogramada_de_cita_id) REFERENCES citas(id) ON DELETE SET NULL,
          FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
          FOREIGN KEY (asistencia_registrada_por_id) REFERENCES usuarios(id) ON DELETE SET NULL
        )
      `).run();
    } catch (e) {}

    try {
      this.db.prepare("CREATE INDEX IF NOT EXISTS idx_citas_ambiente_rango ON citas(ambiente_id, fecha_hora_inicio, fecha_hora_fin)").run();
      this.db.prepare("CREATE INDEX IF NOT EXISTS idx_citas_terapeuta_rango ON citas(terapeuta_id, fecha_hora_inicio, fecha_hora_fin)").run();
      this.db.prepare("CREATE INDEX IF NOT EXISTS idx_citas_paciente ON citas(paciente_id)").run();
      this.db.prepare("CREATE INDEX IF NOT EXISTS idx_citas_estado ON citas(estado)").run();
      this.db.prepare("CREATE INDEX IF NOT EXISTS idx_citas_inicio ON citas(fecha_hora_inicio)").run();
    } catch (e) {}

    try {
      this.db.prepare("ALTER TABLE citas ADD COLUMN servicio_personalizado TEXT").run();
    } catch (e) {}
    try {
      this.db.prepare("ALTER TABLE citas ADD COLUMN arancel_personalizado REAL").run();
    } catch (e) {}

    // Tabla de Recordatorios Clínicos Desacoplados (Sprint 9 / Notificaciones Inteligentes)
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS recordatorios_citas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cita_id INTEGER NOT NULL,
          canal TEXT NOT NULL DEFAULT 'WHATSAPP_Y_PUSH' CHECK (canal IN ('WHATSAPP', 'PUSH', 'WHATSAPP_Y_PUSH')),
          anticipacion_minutos INTEGER NOT NULL DEFAULT 30,
          fecha_programada_envio DATETIME NOT NULL,
          mensaje_personalizado TEXT,
          estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'ENVIADO', 'CANCELADO', 'FALLIDO')),
          enviado_at DATETIME,
          error_mensaje TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE CASCADE
        )
      `).run();
      this.db.prepare("CREATE INDEX IF NOT EXISTS idx_recordatorios_estado_fecha ON recordatorios_citas(estado, fecha_programada_envio)").run();
      this.db.prepare("CREATE INDEX IF NOT EXISTS idx_recordatorios_cita ON recordatorios_citas(cita_id)").run();
    } catch (e) {}
  }

  _baseSelectQuery() {
    return `
      SELECT 
        c.*,
        p.codigo_expediente AS paciente_codigo,
        p.nombres AS paciente_nombres,
        p.apellidos AS paciente_apellidos,
        (p.nombres || ' ' || p.apellidos) AS paciente_nombre_completo,
        p.ci AS paciente_ci,
        p.fecha_nacimiento AS paciente_fecha_nacimiento,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos,
        (t.nombres || ' ' || t.apellidos) AS terapeuta_nombre_completo,
        t.registro_profesional AS terapeuta_matricula,
        t.color_agenda AS terapeuta_color,
        t.telefono AS terapeuta_telefono,
        esp.nombre AS especialidad_nombre,
        esp.color AS especialidad_color,
        a.nombre AS ambiente_nombre,
        a.codigo AS ambiente_codigo,
        a.tipo AS ambiente_tipo,
        a.color_identificador AS ambiente_color,
        COALESCE(s.nombre, c.servicio_personalizado, 'Sesión Clínica') AS servicio_nombre,
        COALESCE(s.arancel_bob, c.arancel_personalizado, 0) AS servicio_arancel,
        s.duracion_minutos AS servicio_duracion_estandar,
        u.nombre_completo AS creador_nombre,
        uar.nombre_completo AS asistencia_registrada_por_nombre,
        (SELECT tut.whatsapp FROM paciente_tutor pt JOIN tutores tut ON pt.tutor_id = tut.id WHERE pt.paciente_id = c.paciente_id ORDER BY pt.es_principal DESC, pt.id ASC LIMIT 1) AS tutor_whatsapp,
        (SELECT (tut.nombres || ' ' || tut.apellidos) FROM paciente_tutor pt JOIN tutores tut ON pt.tutor_id = tut.id WHERE pt.paciente_id = c.paciente_id ORDER BY pt.es_principal DESC, pt.id ASC LIMIT 1) AS tutor_nombre_completo,
        (SELECT tut.parentesco FROM paciente_tutor pt JOIN tutores tut ON pt.tutor_id = tut.id WHERE pt.paciente_id = c.paciente_id ORDER BY pt.es_principal DESC, pt.id ASC LIMIT 1) AS tutor_parentesco
      FROM citas c
      INNER JOIN pacientes p ON c.paciente_id = p.id
      INNER JOIN terapeutas t ON c.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      INNER JOIN ambientes a ON c.ambiente_id = a.id
      LEFT JOIN servicios_aranceles s ON c.servicio_id = s.id
      LEFT JOIN usuarios u ON c.creado_por_usuario_id = u.id
      LEFT JOIN usuarios uar ON c.asistencia_registrada_por_id = uar.id
    `;
  }

  async findById(id) {
    const stmt = this.db.prepare(`
      ${this._baseSelectQuery()}
      WHERE c.id = ?
    `);
    const row = stmt.get(id);
    return row || null;
  }

  async findAll(filters = {}) {
    let sql = this._baseSelectQuery();
    const whereClauses = [];
    const params = [];

    if (filters.fecha) {
      whereClauses.push("date(c.fecha_hora_inicio) = date(?)");
      params.push(filters.fecha);
    }

    if (filters.fechaDesde) {
      whereClauses.push("date(c.fecha_hora_inicio) >= date(?)");
      params.push(filters.fechaDesde);
    }

    if (filters.fechaHasta) {
      whereClauses.push("date(c.fecha_hora_inicio) <= date(?)");
      params.push(filters.fechaHasta);
    }

    if (filters.ambienteId) {
      whereClauses.push("c.ambiente_id = ?");
      params.push(filters.ambienteId);
    }

    if (filters.terapeutaId) {
      whereClauses.push("c.terapeuta_id = ?");
      params.push(filters.terapeutaId);
    }

    if (filters.pacienteId) {
      whereClauses.push("c.paciente_id = ?");
      params.push(filters.pacienteId);
    }

    if (Array.isArray(filters.pacienteIds) && filters.pacienteIds.length > 0) {
      const placeholders = filters.pacienteIds.map(() => '?').join(',');
      whereClauses.push(`c.paciente_id IN (${placeholders})`);
      params.push(...filters.pacienteIds);
    }

    if (filters.estado) {
      if (Array.isArray(filters.estado)) {
        const placeholders = filters.estado.map(() => '?').join(',');
        whereClauses.push(`c.estado IN (${placeholders})`);
        params.push(...filters.estado);
      } else {
        whereClauses.push("c.estado = ?");
        params.push(filters.estado);
      }
    }

    if (filters.excludeCancelled) {
      whereClauses.push("c.estado != 'CANCELADA'");
    }

    if (filters.search) {
      const term = `%${filters.search.trim()}%`;
      whereClauses.push(`(
        p.nombres LIKE ? OR 
        p.apellidos LIKE ? OR 
        p.codigo_expediente LIKE ? OR 
        p.ci LIKE ? OR
        t.nombres LIKE ? OR
        t.apellidos LIKE ?
      )`);
      params.push(term, term, term, term, term, term);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    sql += ` ORDER BY c.fecha_hora_inicio ASC`;

    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Algoritmo Anti-Colisión Multi-Sala y Multi-Terapeuta (RN-01 & RN-02)
   * Versión síncrona interna para ejecución atómica dentro de BEGIN IMMEDIATE
   */
  _checkCollisionSync({ ambienteId, terapeutaId, fechaHoraInicio, fechaHoraFin, excludeId = null, bufferMinutes = 10 }) {
    const inicioNorm = String(fechaHoraInicio).replace('T', ' ');
    const finNorm = String(fechaHoraFin).replace('T', ' ');
    const bufStr = `+${Math.max(0, parseInt(bufferMinutes, 10) || 0)} minutes`;

    // 1. Verificación de colisión en el Ambiente / Consultorio físico (con margen de higiene preventivo RN-02)
    let sqlAmbiente = `
      SELECT 
        c.id, c.fecha_hora_inicio, c.fecha_hora_fin, c.estado,
        p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
        t.nombres AS terapeuta_nombres, t.apellidos AS terapeuta_apellidos,
        a.nombre AS ambiente_nombre
      FROM citas c
      INNER JOIN pacientes p ON c.paciente_id = p.id
      INNER JOIN terapeutas t ON c.terapeuta_id = t.id
      INNER JOIN ambientes a ON c.ambiente_id = a.id
      WHERE c.ambiente_id = ?
        AND c.estado != 'CANCELADA'
        AND datetime(?) < datetime(c.fecha_hora_fin, '${bufStr}')
        AND datetime(?, '${bufStr}') > datetime(c.fecha_hora_inicio)
    `;
    const paramsAmbiente = [ambienteId, inicioNorm, finNorm];

    if (excludeId) {
      sqlAmbiente += ` AND c.id != ?`;
      paramsAmbiente.push(excludeId);
    }
    sqlAmbiente += ` LIMIT 1`;

    const conflictAmbiente = this.db.prepare(sqlAmbiente).get(...paramsAmbiente);

    if (conflictAmbiente) {
      const hInicio = conflictAmbiente.fecha_hora_inicio.slice(11, 16);
      const hFin = conflictAmbiente.fecha_hora_fin.slice(11, 16);
      return {
        hasCollision: true,
        collisionType: 'AMBIENTE',
        message: `El ${conflictAmbiente.ambiente_nombre} ya se encuentra ocupado (o en margen de higiene de ${bufferMinutes} min) entre las ${hInicio} y ${hFin} por la sesión de ${conflictAmbiente.paciente_nombres} ${conflictAmbiente.paciente_apellidos} con ${conflictAmbiente.terapeuta_nombres} ${conflictAmbiente.terapeuta_apellidos}.`,
        conflictingAppointment: conflictAmbiente
      };
    }

    // 2. Verificación de colisión en el Terapeuta (un especialista no puede atender dos citas simultáneas en distintas salas)
    let sqlTerapeuta = `
      SELECT 
        c.id, c.fecha_hora_inicio, c.fecha_hora_fin, c.estado,
        p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
        t.nombres AS terapeuta_nombres, t.apellidos AS terapeuta_apellidos,
        a.nombre AS ambiente_nombre
      FROM citas c
      INNER JOIN pacientes p ON c.paciente_id = p.id
      INNER JOIN terapeutas t ON c.terapeuta_id = t.id
      INNER JOIN ambientes a ON c.ambiente_id = a.id
      WHERE c.terapeuta_id = ?
        AND c.estado != 'CANCELADA'
        AND datetime(?) < datetime(c.fecha_hora_fin)
        AND datetime(?) > datetime(c.fecha_hora_inicio)
    `;
    const paramsTerapeuta = [terapeutaId, inicioNorm, finNorm];

    if (excludeId) {
      sqlTerapeuta += ` AND c.id != ?`;
      paramsTerapeuta.push(excludeId);
    }
    sqlTerapeuta += ` LIMIT 1`;

    const conflictTerapeuta = this.db.prepare(sqlTerapeuta).get(...paramsTerapeuta);

    if (conflictTerapeuta) {
      const hInicio = conflictTerapeuta.fecha_hora_inicio.slice(11, 16);
      const hFin = conflictTerapeuta.fecha_hora_fin.slice(11, 16);
      return {
        hasCollision: true,
        collisionType: 'TERAPEUTA',
        message: `La especialista ${conflictTerapeuta.terapeuta_nombres} ${conflictTerapeuta.terapeuta_apellidos} ya tiene otra sesión agendada a esa misma hora (${hInicio} - ${hFin}) en el ${conflictTerapeuta.ambiente_nombre} con el paciente ${conflictTerapeuta.paciente_nombres} ${conflictTerapeuta.paciente_apellidos}.`,
        conflictingAppointment: conflictTerapeuta
      };
    }

    return { hasCollision: false };
  }

  async checkCollision(params) {
    return this._checkCollisionSync(params);
  }

  _insertSync(appointmentData) {
    const stmt = this.db.prepare(`
      INSERT INTO citas (
        paciente_id,
        terapeuta_id,
        ambiente_id,
        servicio_id,
        servicio_personalizado,
        arancel_personalizado,
        fecha_hora_inicio,
        fecha_hora_fin,
        duracion_minutos,
        estado,
        motivo_consulta,
        motivo_cancelacion,
        notas_internas,
        reprogramada_de_cita_id,
        creado_por_usuario_id,
        asistencia_registrada_at,
        asistencia_registrada_por_id,
        created_at,
        updated_at
      ) VALUES (
        @paciente_id,
        @terapeuta_id,
        @ambiente_id,
        @servicio_id,
        @servicio_personalizado,
        @arancel_personalizado,
        @fecha_hora_inicio,
        @fecha_hora_fin,
        @duracion_minutos,
        @estado,
        @motivo_consulta,
        @motivo_cancelacion,
        @notas_internas,
        @reprogramada_de_cita_id,
        @creado_por_usuario_id,
        @asistencia_registrada_at,
        @asistencia_registrada_por_id,
        @created_at,
        @updated_at
      )
    `);

    const nowBo = getBoliviaNowSqlString();
    const inicioNorm = String(appointmentData.fecha_hora_inicio).replace('T', ' ');
    const finNorm = String(appointmentData.fecha_hora_fin).replace('T', ' ');

    const info = stmt.run({
      paciente_id: appointmentData.paciente_id,
      terapeuta_id: appointmentData.terapeuta_id,
      ambiente_id: appointmentData.ambiente_id,
      servicio_id: appointmentData.servicio_id || null,
      servicio_personalizado: appointmentData.servicio_personalizado || null,
      arancel_personalizado: appointmentData.arancel_personalizado !== undefined && appointmentData.arancel_personalizado !== null ? Number(appointmentData.arancel_personalizado) : null,
      fecha_hora_inicio: inicioNorm,
      fecha_hora_fin: finNorm,
      duracion_minutos: appointmentData.duracion_minutos || 45,
      estado: appointmentData.estado || 'PROGRAMADA',
      motivo_consulta: appointmentData.motivo_consulta || null,
      motivo_cancelacion: appointmentData.motivo_cancelacion || null,
      notas_internas: appointmentData.notas_internas || null,
      reprogramada_de_cita_id: appointmentData.reprogramada_de_cita_id || null,
      creado_por_usuario_id: appointmentData.creado_por_usuario_id || null,
      asistencia_registrada_at: appointmentData.asistencia_registrada_at || null,
      asistencia_registrada_por_id: appointmentData.asistencia_registrada_por_id || null,
      created_at: nowBo,
      updated_at: nowBo
    });

    return info.lastInsertRowid;
  }

  async create(appointmentData) {
    const insertedId = this._insertSync(appointmentData);
    return this.findById(insertedId);
  }

  /**
   * Inserción atómica anti-race-condition (BEGIN IMMEDIATE):
   * Ejecuta checkCollision + INSERT dentro de una sola transacción exclusiva de escritura.
   */
  async createWithCollisionCheck(appointmentData, bufferMinutes = 10) {
    const tx = this.db.transaction(() => {
      const collision = this._checkCollisionSync({
        ambienteId: appointmentData.ambiente_id,
        terapeutaId: appointmentData.terapeuta_id,
        fechaHoraInicio: appointmentData.fecha_hora_inicio,
        fechaHoraFin: appointmentData.fecha_hora_fin,
        excludeId: null,
        bufferMinutes
      });
      if (collision.hasCollision) {
        throw AppError.conflict(collision.message, 'COLLISION_DETECTED', collision);
      }
      return this._insertSync(appointmentData);
    });

    const insertedId = tx.immediate();
    return this.findById(insertedId);
  }

  _updateSync(id, existing, appointmentData) {
    const inicioNorm = appointmentData.fecha_hora_inicio 
      ? String(appointmentData.fecha_hora_inicio).replace('T', ' ') 
      : existing.fecha_hora_inicio;
    const finNorm = appointmentData.fecha_hora_fin 
      ? String(appointmentData.fecha_hora_fin).replace('T', ' ') 
      : existing.fecha_hora_fin;

    const stmt = this.db.prepare(`
      UPDATE citas SET
        paciente_id = @paciente_id,
        terapeuta_id = @terapeuta_id,
        ambiente_id = @ambiente_id,
        servicio_id = @servicio_id,
        servicio_personalizado = @servicio_personalizado,
        arancel_personalizado = @arancel_personalizado,
        fecha_hora_inicio = @fecha_hora_inicio,
        fecha_hora_fin = @fecha_hora_fin,
        duracion_minutos = @duracion_minutos,
        estado = @estado,
        motivo_consulta = @motivo_consulta,
        notas_internas = @notas_internas,
        updated_at = @updated_at
      WHERE id = @id
    `);

    stmt.run({
      id,
      paciente_id: appointmentData.paciente_id !== undefined ? appointmentData.paciente_id : existing.paciente_id,
      terapeuta_id: appointmentData.terapeuta_id !== undefined ? appointmentData.terapeuta_id : existing.terapeuta_id,
      ambiente_id: appointmentData.ambiente_id !== undefined ? appointmentData.ambiente_id : existing.ambiente_id,
      servicio_id: appointmentData.servicio_id !== undefined ? appointmentData.servicio_id : existing.servicio_id,
      servicio_personalizado: appointmentData.servicio_personalizado !== undefined ? appointmentData.servicio_personalizado : existing.servicio_personalizado,
      arancel_personalizado: appointmentData.arancel_personalizado !== undefined ? appointmentData.arancel_personalizado : existing.arancel_personalizado,
      fecha_hora_inicio: inicioNorm,
      fecha_hora_fin: finNorm,
      duracion_minutos: appointmentData.duracion_minutos !== undefined ? appointmentData.duracion_minutos : existing.duracion_minutos,
      estado: appointmentData.estado !== undefined ? appointmentData.estado : existing.estado,
      motivo_consulta: appointmentData.motivo_consulta !== undefined ? appointmentData.motivo_consulta : existing.motivo_consulta,
      notas_internas: appointmentData.notas_internas !== undefined ? appointmentData.notas_internas : existing.notas_internas,
      updated_at: getBoliviaNowSqlString()
    });
  }

  async update(id, appointmentData) {
    const existing = await this.findById(id);
    if (!existing) return null;
    this._updateSync(id, existing, appointmentData);
    return this.findById(id);
  }

  /**
   * Actualización/reprogramación atómica anti-race-condition (BEGIN IMMEDIATE)
   */
  async updateWithCollisionCheck(id, appointmentData, bufferMinutes = 10) {
    const tx = this.db.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM citas WHERE id = ?').get(id);
      if (!existing) return null;

      const fechaHoraInicio = appointmentData.fecha_hora_inicio || existing.fecha_hora_inicio;
      const fechaHoraFin = appointmentData.fecha_hora_fin || existing.fecha_hora_fin;
      const ambienteId = appointmentData.ambiente_id || existing.ambiente_id;
      const terapeutaId = appointmentData.terapeuta_id || existing.terapeuta_id;

      const collision = this._checkCollisionSync({
        ambienteId,
        terapeutaId,
        fechaHoraInicio,
        fechaHoraFin,
        excludeId: id,
        bufferMinutes
      });
      if (collision.hasCollision) {
        throw AppError.conflict(collision.message, 'COLLISION_DETECTED', collision);
      }

      this._updateSync(id, existing, appointmentData);
      return id;
    });

    const updatedId = tx.immediate();
    if (!updatedId) return null;
    return this.findById(updatedId);
  }

  async updateStatus(id, estado, metadata = {}) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const nowBo = getBoliviaNowSqlString();
    let sql = `UPDATE citas SET estado = ?, updated_at = ?`;
    const params = [estado, nowBo];

    if (estado === 'EN_ATENCION') {
      sql += `, asistencia_registrada_at = ?, asistencia_registrada_por_id = ?`;
      params.push(nowBo, metadata.usuarioId || null);
    } else if (estado === 'CANCELADA') {
      sql += `, motivo_cancelacion = ?`;
      params.push(metadata.motivoCancelacion || 'Cancelada por el centro');
    } else if (estado === 'REPROGRAMADA') {
      if (metadata.motivoCancelacion) {
        sql += `, motivo_cancelacion = ?`;
        params.push(metadata.motivoCancelacion);
      }
    }

    sql += ` WHERE id = ?`;
    params.push(id);

    this.db.prepare(sql).run(...params);
    return this.findById(id);
  }

  async cancel(id, motivoCancelacion, userId = null) {
    return this.updateStatus(id, 'CANCELADA', { motivoCancelacion, usuarioId: userId });
  }

  async getTodayStats(dateStr = null) {
    const targetDate = dateStr || getBoliviaTodayDateString();
    const stmt = this.db.prepare(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN estado = 'EN_ATENCION' THEN 1 ELSE 0 END) AS en_atencion,
        SUM(CASE WHEN estado = 'CONFIRMADA' THEN 1 ELSE 0 END) AS confirmadas,
        SUM(CASE WHEN estado = 'PROGRAMADA' THEN 1 ELSE 0 END) AS programadas,
        SUM(CASE WHEN estado = 'ATENDIDA' THEN 1 ELSE 0 END) AS atendidas,
        SUM(CASE WHEN estado = 'CANCELADA' THEN 1 ELSE 0 END) AS canceladas,
        SUM(CASE WHEN estado = 'AUSENTE' THEN 1 ELSE 0 END) AS ausentes
      FROM citas
      WHERE date(fecha_hora_inicio) = date(?)
    `);
    const res = stmt.get(targetDate);
    return {
      date: targetDate,
      total: res?.total || 0,
      enAtencion: res?.en_atencion || 0,
      confirmadas: res?.confirmadas || 0,
      programadas: res?.programadas || 0,
      atendidas: res?.atendidas || 0,
      canceladas: res?.canceladas || 0,
      ausentes: res?.ausentes || 0
    };
  }

  // =========================================================================
  // GESTIÓN DE RECORDATORIOS DESACOPLADOS (recordatorios_citas)
  // =========================================================================

  async saveReminder({ citaId, canal = 'WHATSAPP_Y_PUSH', anticipacionMinutos = 30, fechaProgramadaEnvio, mensajePersonalizado = null }) {
    // Si no se especifica fecha programada, calcular: fecha_inicio - anticipación
    let scheduleDate = fechaProgramadaEnvio;
    if (!scheduleDate) {
      const cita = await this.findById(citaId);
      if (cita) {
        const start = new Date(cita.fecha_hora_inicio);
        const sched = new Date(start.getTime() - (anticipacionMinutos * 60 * 1000));
        scheduleDate = sched.toISOString().replace('T', ' ').slice(0, 19);
      } else {
        scheduleDate = new Date().toISOString().replace('T', ' ').slice(0, 19);
      }
    }

    // Cancelar recordatorios previos pendientes para no duplicar
    this.cancelPendingRemindersByCitaId(citaId);

    const stmt = this.db.prepare(`
      INSERT INTO recordatorios_citas (
        cita_id, canal, anticipacion_minutos, fecha_programada_envio, mensaje_personalizado, estado
      ) VALUES (?, ?, ?, ?, ?, 'PENDIENTE')
    `);
    const info = stmt.run(citaId, canal, anticipacionMinutos, scheduleDate, mensajePersonalizado);
    return this.getReminderById(info.lastInsertRowid);
  }

  getReminderById(id) {
    return this.db.prepare(`SELECT * FROM recordatorios_citas WHERE id = ?`).get(id) || null;
  }

  getRemindersByCitaId(citaId) {
    return this.db.prepare(`SELECT * FROM recordatorios_citas WHERE cita_id = ? ORDER BY id DESC`).all(citaId);
  }

  getPendingRemindersDue(nowIso = null) {
    const current = nowIso || new Date().toISOString().replace('T', ' ').slice(0, 19);
    return this.db.prepare(`
      SELECT 
        r.*,
        c.fecha_hora_inicio, c.fecha_hora_fin, c.estado AS cita_estado,
        p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos, p.codigo_expediente,
        t.id AS terapeuta_id, t.nombres AS terapeuta_nombres, t.apellidos AS terapeuta_apellidos, t.usuario_id AS terapeuta_usuario_id,
        a.codigo AS ambiente_codigo, a.nombre AS ambiente_nombre,
        tut.id AS tutor_id, tut.nombres AS tutor_nombres, tut.apellidos AS tutor_apellidos, tut.whatsapp AS tutor_telefono, tut.usuario_id AS tutor_usuario_id
      FROM recordatorios_citas r
      JOIN citas c ON r.cita_id = c.id
      JOIN pacientes p ON c.paciente_id = p.id
      JOIN terapeutas t ON c.terapeuta_id = t.id
      JOIN ambientes a ON c.ambiente_id = a.id
      LEFT JOIN paciente_tutor pt ON p.id = pt.paciente_id AND pt.es_principal = 1
      LEFT JOIN tutores tut ON pt.tutor_id = tut.id
      WHERE r.estado = 'PENDIENTE'
        AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
        AND r.fecha_programada_envio <= ?
      ORDER BY r.fecha_programada_envio ASC
    `).all(current);
  }

  updateReminderStatus(id, estado, { enviadoAt = null, errorMensaje = null } = {}) {
    return this.db.prepare(`
      UPDATE recordatorios_citas
      SET estado = ?, enviado_at = COALESCE(?, enviado_at), error_mensaje = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(estado, enviadoAt, errorMensaje, id);
  }

  cancelPendingRemindersByCitaId(citaId) {
    return this.db.prepare(`
      UPDATE recordatorios_citas
      SET estado = 'CANCELADO', updated_at = CURRENT_TIMESTAMP
      WHERE cita_id = ? AND estado = 'PENDIENTE'
    `).run(citaId);
  }

  updateScheduledDateByCitaId(citaId, newStartIso) {
    const reminders = this.db.prepare(`
      SELECT id, anticipacion_minutos FROM recordatorios_citas WHERE cita_id = ? AND estado = 'PENDIENTE'
    `).all(citaId);

    const start = new Date(newStartIso);
    for (const r of reminders) {
      const sched = new Date(start.getTime() - (r.anticipacion_minutos * 60 * 1000));
      const scheduleDate = sched.toISOString().replace('T', ' ').slice(0, 19);
      this.db.prepare(`
        UPDATE recordatorios_citas
        SET fecha_programada_envio = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(scheduleDate, r.id);
    }
  }
}

