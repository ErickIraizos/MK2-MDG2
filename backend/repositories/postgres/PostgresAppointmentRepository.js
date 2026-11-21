import { PostgresConnection } from '../../core/PostgresConnection.js';
import { IAppointmentRepository } from '../../domain/interfaces/IAppointmentRepository.js';
import { AppError } from '../../core/AppError.js';
import { getBoliviaNowSqlString, getBoliviaTodayDateString } from '../../utils/dateTime.js';

export class PostgresAppointmentRepository extends IAppointmentRepository {
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
    const { rows } = await PostgresConnection.query(
      `${this._baseSelectQuery()} WHERE c.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async findAll(filters = {}) {
    let sql = this._baseSelectQuery();
    const whereClauses = [];
    const params = [];

    if (filters.fecha) {
      params.push(filters.fecha);
      whereClauses.push(`(c.fecha_hora_inicio AT TIME ZONE 'America/La_Paz')::date = $${params.length}::date`);
    }

    if (filters.fechaDesde) {
      params.push(filters.fechaDesde);
      whereClauses.push(`(c.fecha_hora_inicio AT TIME ZONE 'America/La_Paz')::date >= $${params.length}::date`);
    }

    if (filters.fechaHasta) {
      params.push(filters.fechaHasta);
      whereClauses.push(`(c.fecha_hora_inicio AT TIME ZONE 'America/La_Paz')::date <= $${params.length}::date`);
    }

    if (filters.ambienteId) {
      params.push(filters.ambienteId);
      whereClauses.push(`c.ambiente_id = $${params.length}`);
    }

    if (filters.terapeutaId) {
      params.push(filters.terapeutaId);
      whereClauses.push(`c.terapeuta_id = $${params.length}`);
    }

    if (filters.pacienteId) {
      params.push(filters.pacienteId);
      whereClauses.push(`c.paciente_id = $${params.length}`);
    }

    if (Array.isArray(filters.pacienteIds) && filters.pacienteIds.length > 0) {
      params.push(filters.pacienteIds);
      whereClauses.push(`c.paciente_id = ANY($${params.length}::int[])`);
    }

    if (filters.estado) {
      if (Array.isArray(filters.estado)) {
        params.push(filters.estado);
        whereClauses.push(`c.estado = ANY($${params.length}::text[])`);
      } else {
        params.push(filters.estado);
        whereClauses.push(`c.estado = $${params.length}`);
      }
    }

    if (filters.excludeCancelled) {
      whereClauses.push(`c.estado != 'CANCELADA'`);
    }

    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      const pIdx = `$${params.length}`;
      whereClauses.push(`(
        p.nombres ILIKE ${pIdx} OR
        p.apellidos ILIKE ${pIdx} OR
        p.codigo_expediente ILIKE ${pIdx} OR
        p.ci ILIKE ${pIdx} OR
        t.nombres ILIKE ${pIdx} OR
        t.apellidos ILIKE ${pIdx}
      )`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    sql += ` ORDER BY c.fecha_hora_inicio ASC`;

    const { rows } = await PostgresConnection.query(sql, params);
    return rows;
  }

  async _checkCollisionWithRunner(runner, { ambienteId, terapeutaId, fechaHoraInicio, fechaHoraFin, excludeId = null, bufferMinutes = 10 }) {
    const inicioNorm = String(fechaHoraInicio).replace('T', ' ');
    const finNorm = String(fechaHoraFin).replace('T', ' ');
    const bufMins = Math.max(0, parseInt(bufferMinutes, 10) || 0);

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
      WHERE c.ambiente_id = $1
        AND c.estado != 'CANCELADA'
        AND $2::timestamptz < (c.fecha_hora_fin + ($3 * INTERVAL '1 minute'))
        AND ($4::timestamptz + ($3 * INTERVAL '1 minute')) > c.fecha_hora_inicio
    `;
    const paramsAmbiente = [ambienteId, inicioNorm, bufMins, finNorm];

    if (excludeId) {
      paramsAmbiente.push(excludeId);
      sqlAmbiente += ` AND c.id != $${paramsAmbiente.length}`;
    }
    sqlAmbiente += ` LIMIT 1`;

    const { rows: ambRows } = await runner.query(sqlAmbiente, paramsAmbiente);
    const conflictAmbiente = ambRows[0];

    if (conflictAmbiente) {
      const hInicio = String(conflictAmbiente.fecha_hora_inicio).slice(11, 16);
      const hFin = String(conflictAmbiente.fecha_hora_fin).slice(11, 16);
      return {
        hasCollision: true,
        collisionType: 'AMBIENTE',
        message: `El ${conflictAmbiente.ambiente_nombre} ya se encuentra ocupado (o en margen de higiene de ${bufferMinutes} min) entre las ${hInicio} y ${hFin} por la sesión de ${conflictAmbiente.paciente_nombres} ${conflictAmbiente.paciente_apellidos} con ${conflictAmbiente.terapeuta_nombres} ${conflictAmbiente.terapeuta_apellidos}.`,
        conflictingAppointment: conflictAmbiente
      };
    }

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
      WHERE c.terapeuta_id = $1
        AND c.estado != 'CANCELADA'
        AND $2::timestamptz < c.fecha_hora_fin
        AND $3::timestamptz > c.fecha_hora_inicio
    `;
    const paramsTerapeuta = [terapeutaId, inicioNorm, finNorm];

    if (excludeId) {
      paramsTerapeuta.push(excludeId);
      sqlTerapeuta += ` AND c.id != $${paramsTerapeuta.length}`;
    }
    sqlTerapeuta += ` LIMIT 1`;

    const { rows: terRows } = await runner.query(sqlTerapeuta, paramsTerapeuta);
    const conflictTerapeuta = terRows[0];

    if (conflictTerapeuta) {
      const hInicio = String(conflictTerapeuta.fecha_hora_inicio).slice(11, 16);
      const hFin = String(conflictTerapeuta.fecha_hora_fin).slice(11, 16);
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
    return this._checkCollisionWithRunner(PostgresConnection, params);
  }

  async _insertWithRunner(runner, appointmentData) {
    const nowBo = getBoliviaNowSqlString();
    const inicioNorm = String(appointmentData.fecha_hora_inicio).replace('T', ' ');
    const finNorm = String(appointmentData.fecha_hora_fin).replace('T', ' ');

    const { rows } = await runner.query(
      `INSERT INTO citas (
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
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING id`,
      [
        appointmentData.paciente_id,
        appointmentData.terapeuta_id,
        appointmentData.ambiente_id,
        appointmentData.servicio_id || null,
        appointmentData.servicio_personalizado || null,
        appointmentData.arancel_personalizado !== undefined && appointmentData.arancel_personalizado !== null
          ? Number(appointmentData.arancel_personalizado)
          : null,
        inicioNorm,
        finNorm,
        appointmentData.duracion_minutos || 45,
        appointmentData.estado || 'PROGRAMADA',
        appointmentData.motivo_consulta || null,
        appointmentData.motivo_cancelacion || null,
        appointmentData.notas_internas || null,
        appointmentData.reprogramada_de_cita_id || null,
        appointmentData.creado_por_usuario_id || null,
        appointmentData.asistencia_registrada_at || null,
        appointmentData.asistencia_registrada_por_id || null,
        nowBo,
        nowBo
      ]
    );

    return rows[0].id;
  }

  async create(appointmentData) {
    const insertedId = await this._insertWithRunner(PostgresConnection, appointmentData);
    return this.findById(insertedId);
  }

  async createWithCollisionCheck(appointmentData, bufferMinutes = 10) {
    const insertedId = await PostgresConnection.transaction(async (client) => {
      // Bloqueos exclusivos determinísticos por consultorio y terapeuta (anti-race-condition)
      await PostgresConnection.advisoryLock(client, 1001, appointmentData.ambiente_id);
      await PostgresConnection.advisoryLock(client, 1002, appointmentData.terapeuta_id);

      const collision = await this._checkCollisionWithRunner(client, {
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

      return this._insertWithRunner(client, appointmentData);
    });

    return this.findById(insertedId);
  }

  async _updateWithRunner(runner, id, existing, appointmentData) {
    const inicioNorm = appointmentData.fecha_hora_inicio
      ? String(appointmentData.fecha_hora_inicio).replace('T', ' ')
      : existing.fecha_hora_inicio;
    const finNorm = appointmentData.fecha_hora_fin
      ? String(appointmentData.fecha_hora_fin).replace('T', ' ')
      : existing.fecha_hora_fin;

    await runner.query(
      `UPDATE citas SET
         paciente_id = $1,
         terapeuta_id = $2,
         ambiente_id = $3,
         servicio_id = $4,
         servicio_personalizado = $5,
         arancel_personalizado = $6,
         fecha_hora_inicio = $7,
         fecha_hora_fin = $8,
         duracion_minutos = $9,
         estado = $10,
         motivo_consulta = $11,
         notas_internas = $12,
         updated_at = $13
       WHERE id = $14`,
      [
        appointmentData.paciente_id !== undefined ? appointmentData.paciente_id : existing.paciente_id,
        appointmentData.terapeuta_id !== undefined ? appointmentData.terapeuta_id : existing.terapeuta_id,
        appointmentData.ambiente_id !== undefined ? appointmentData.ambiente_id : existing.ambiente_id,
        appointmentData.servicio_id !== undefined ? appointmentData.servicio_id : existing.servicio_id,
        appointmentData.servicio_personalizado !== undefined ? appointmentData.servicio_personalizado : existing.servicio_personalizado,
        appointmentData.arancel_personalizado !== undefined ? appointmentData.arancel_personalizado : existing.arancel_personalizado,
        inicioNorm,
        finNorm,
        appointmentData.duracion_minutos !== undefined ? appointmentData.duracion_minutos : existing.duracion_minutos,
        appointmentData.estado !== undefined ? appointmentData.estado : existing.estado,
        appointmentData.motivo_consulta !== undefined ? appointmentData.motivo_consulta : existing.motivo_consulta,
        appointmentData.notas_internas !== undefined ? appointmentData.notas_internas : existing.notas_internas,
        getBoliviaNowSqlString(),
        id
      ]
    );
  }

  async update(id, appointmentData) {
    const existing = await this.findById(id);
    if (!existing) return null;
    await this._updateWithRunner(PostgresConnection, id, existing, appointmentData);
    return this.findById(id);
  }

  async updateWithCollisionCheck(id, appointmentData, bufferMinutes = 10) {
    const updatedId = await PostgresConnection.transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM citas WHERE id = $1 FOR UPDATE', [id]);
      const existing = rows[0];
      if (!existing) return null;

      const fechaHoraInicio = appointmentData.fecha_hora_inicio || existing.fecha_hora_inicio;
      const fechaHoraFin = appointmentData.fecha_hora_fin || existing.fecha_hora_fin;
      const ambienteId = appointmentData.ambiente_id || existing.ambiente_id;
      const terapeutaId = appointmentData.terapeuta_id || existing.terapeuta_id;

      await PostgresConnection.advisoryLock(client, 1001, ambienteId);
      await PostgresConnection.advisoryLock(client, 1002, terapeutaId);

      const collision = await this._checkCollisionWithRunner(client, {
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

      await this._updateWithRunner(client, id, existing, appointmentData);
      return id;
    });

    if (!updatedId) return null;
    return this.findById(updatedId);
  }

  async updateStatus(id, estado, metadata = {}) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const nowBo = getBoliviaNowSqlString();
    let sql = `UPDATE citas SET estado = $1, updated_at = $2`;
    const params = [estado, nowBo];

    if (estado === 'EN_ATENCION') {
      params.push(nowBo, metadata.usuarioId || null);
      sql += `, asistencia_registrada_at = $${params.length - 1}, asistencia_registrada_por_id = $${params.length}`;
    } else if (estado === 'CANCELADA') {
      params.push(metadata.motivoCancelacion || 'Cancelada por el centro');
      sql += `, motivo_cancelacion = $${params.length}`;
    } else if (estado === 'REPROGRAMADA' && metadata.motivoCancelacion) {
      params.push(metadata.motivoCancelacion);
      sql += `, motivo_cancelacion = $${params.length}`;
    }

    params.push(id);
    sql += ` WHERE id = $${params.length}`;

    await PostgresConnection.query(sql, params);
    return this.findById(id);
  }

  async cancel(id, motivoCancelacion, userId = null) {
    return this.updateStatus(id, 'CANCELADA', { motivoCancelacion, usuarioId: userId });
  }

  async getTodayStats(dateStr = null) {
    const targetDate = dateStr || getBoliviaTodayDateString();
    const { rows } = await PostgresConnection.query(
      `SELECT
         COUNT(*)::int AS total,
         COALESCE(SUM(CASE WHEN estado = 'EN_ATENCION' THEN 1 ELSE 0 END), 0)::int AS en_atencion,
         COALESCE(SUM(CASE WHEN estado = 'CONFIRMADA' THEN 1 ELSE 0 END), 0)::int AS confirmadas,
         COALESCE(SUM(CASE WHEN estado = 'PROGRAMADA' THEN 1 ELSE 0 END), 0)::int AS programadas,
         COALESCE(SUM(CASE WHEN estado = 'ATENDIDA' THEN 1 ELSE 0 END), 0)::int AS atendidas,
         COALESCE(SUM(CASE WHEN estado = 'CANCELADA' THEN 1 ELSE 0 END), 0)::int AS canceladas,
         COALESCE(SUM(CASE WHEN estado = 'AUSENTE' THEN 1 ELSE 0 END), 0)::int AS ausentes
       FROM citas
       WHERE (fecha_hora_inicio AT TIME ZONE 'America/La_Paz')::date = $1::date`,
      [targetDate]
    );
    const res = rows[0];
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

  async getPrimaryTutorUserIdByPatientId(pacienteId) {
    const { rows } = await PostgresConnection.query(
      `SELECT tut.usuario_id
       FROM paciente_tutor pt
       JOIN tutores tut ON pt.tutor_id = tut.id
       WHERE pt.paciente_id = $1
       ORDER BY pt.es_principal DESC
       LIMIT 1`,
      [pacienteId]
    );
    return rows[0]?.usuario_id || null;
  }

  // =========================================================================
  // RECORDATORIOS DESACOPLADOS (recordatorios_citas) & SCHEDULER
  // =========================================================================

  async saveReminder({ citaId, canal = 'WHATSAPP_Y_PUSH', anticipacionMinutos = 30, fechaProgramadaEnvio, mensajePersonalizado = null }) {
    let scheduleDate = fechaProgramadaEnvio;
    if (!scheduleDate) {
      const cita = await this.findById(citaId);
      if (cita) {
        const start = new Date(String(cita.fecha_hora_inicio).replace(' ', 'T') + '-04:00');
        const sched = new Date(start.getTime() - (anticipacionMinutos * 60 * 1000));
        scheduleDate = getBoliviaNowSqlString(sched);
      } else {
        scheduleDate = getBoliviaNowSqlString();
      }
    }

    await this.cancelPendingRemindersByCitaId(citaId);

    const { rows } = await PostgresConnection.query(
      `INSERT INTO recordatorios_citas (
         cita_id, canal, anticipacion_minutos, fecha_programada_envio, mensaje_personalizado, estado
       ) VALUES ($1, $2, $3, $4, $5, 'PENDIENTE')
       RETURNING id`,
      [citaId, canal, anticipacionMinutos, scheduleDate, mensajePersonalizado]
    );
    return this.getReminderById(rows[0].id);
  }

  async getReminderById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT * FROM recordatorios_citas WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async getRemindersByCitaId(citaId) {
    const { rows } = await PostgresConnection.query(
      `SELECT * FROM recordatorios_citas WHERE cita_id = $1 ORDER BY id DESC`,
      [citaId]
    );
    return rows;
  }

  async getPendingRemindersDue(nowIso = null) {
    const current = nowIso || getBoliviaNowSqlString();
    const { rows } = await PostgresConnection.query(
      `SELECT
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
         AND r.fecha_programada_envio <= $1::timestamptz
       ORDER BY r.fecha_programada_envio ASC`,
      [current]
    );
    return rows;
  }

  async updateReminderStatus(id, estado, { enviadoAt = null, errorMensaje = null } = {}) {
    await PostgresConnection.query(
      `UPDATE recordatorios_citas
       SET estado = $1, enviado_at = COALESCE($2, enviado_at), error_mensaje = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [estado, enviadoAt, errorMensaje, id]
    );
    return true;
  }

  async cancelPendingRemindersByCitaId(citaId) {
    await PostgresConnection.query(
      `UPDATE recordatorios_citas
       SET estado = 'CANCELADO', updated_at = CURRENT_TIMESTAMP
       WHERE cita_id = $1 AND estado = 'PENDIENTE'`,
      [citaId]
    );
    return true;
  }

  async updateScheduledDateByCitaId(citaId, newStartIso) {
    const { rows: reminders } = await PostgresConnection.query(
      `SELECT id, anticipacion_minutos FROM recordatorios_citas WHERE cita_id = $1 AND estado = 'PENDIENTE'`,
      [citaId]
    );

    const start = new Date(String(newStartIso).includes('T') ? newStartIso : String(newStartIso).replace(' ', 'T') + '-04:00');
    for (const r of reminders) {
      const sched = new Date(start.getTime() - (r.anticipacion_minutos * 60 * 1000));
      const scheduleDate = getBoliviaNowSqlString(sched);
      await PostgresConnection.query(
        `UPDATE recordatorios_citas
         SET fecha_programada_envio = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [scheduleDate, r.id]
      );
    }
  }

  async getUpcomingAppointmentsForReminderWindow(flagColumn, startIso, endIso) {
    const allowedFlag = flagColumn === 'recordatorio_24h_enviado' ? 'recordatorio_24h_enviado' : 'recordatorio_2h_enviado';
    const { rows } = await PostgresConnection.query(
      `SELECT
         c.id, c.paciente_id, c.terapeuta_id, c.ambiente_id, c.fecha_hora_inicio, c.fecha_hora_fin, c.estado,
         p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos, p.codigo_expediente,
         t.nombres AS terapeuta_nombres, t.apellidos AS terapeuta_apellidos, t.usuario_id AS terapeuta_usuario_id,
         a.codigo AS ambiente_codigo, a.nombre AS ambiente_nombre,
         tut.nombres AS tutor_nombres, tut.apellidos AS tutor_apellidos, tut.whatsapp AS tutor_telefono, tut.usuario_id AS tutor_usuario_id
       FROM citas c
       JOIN pacientes p ON c.paciente_id = p.id
       JOIN terapeutas t ON c.terapeuta_id = t.id
       JOIN ambientes a ON c.ambiente_id = a.id
       LEFT JOIN paciente_tutor pt ON p.id = pt.paciente_id AND pt.es_principal = 1
       LEFT JOIN tutores tut ON pt.tutor_id = tut.id
       WHERE c.estado IN ('PROGRAMADA', 'CONFIRMADA')
         AND c.${allowedFlag} = 0
         AND c.fecha_hora_inicio BETWEEN $1::timestamptz AND $2::timestamptz
       ORDER BY c.fecha_hora_inicio ASC`,
      [startIso, endIso]
    );
    return rows;
  }

  async markWindowReminderSent(citaId, windowType) {
    if (windowType === '24H') {
      await PostgresConnection.query(
        `UPDATE citas SET recordatorio_24h_enviado = 1, recordatorio_24h_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [citaId]
      );
    } else {
      await PostgresConnection.query(
        `UPDATE citas SET recordatorio_2h_enviado = 1, recordatorio_2h_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [citaId]
      );
    }
  }
}
