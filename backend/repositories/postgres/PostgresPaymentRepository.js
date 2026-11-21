import { PostgresConnection } from '../../core/PostgresConnection.js';
import { IPaymentRepository } from '../../domain/interfaces/IPaymentRepository.js';
import { AppError } from '../../core/AppError.js';
import { getBoliviaNowSqlString } from '../../utils/dateTime.js';

export class PostgresPaymentRepository extends IPaymentRepository {
  async createPayment(data) {
    const {
      cita_id = null,
      paciente_id,
      tutor_id,
      terapeuta_id,
      monto_bob,
      metodo_pago = 'QR_SIMPLE',
      estado = 'PENDIENTE',
      comprobante_url = null,
      comprobante_tipo = null,
      numero_transaccion = null,
      observaciones = null,
      fecha_pago = null,
      servicio_nombre = null
    } = data;

    const nowBo = getBoliviaNowSqlString();
    const { rows } = await PostgresConnection.query(
      `INSERT INTO pagos_citas (
         cita_id, paciente_id, tutor_id, terapeuta_id, monto_bob,
         metodo_pago, estado, comprobante_url, comprobante_tipo,
         numero_transaccion, observaciones, fecha_pago, created_at, updated_at, servicio_nombre
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        cita_id || null,
        paciente_id,
        tutor_id || null,
        terapeuta_id,
        monto_bob,
        metodo_pago,
        estado,
        comprobante_url,
        comprobante_tipo,
        numero_transaccion,
        observaciones,
        fecha_pago || (comprobante_url ? nowBo : null),
        nowBo,
        nowBo,
        servicio_nombre || null
      ]
    );

    return this.getPaymentById(rows[0].id);
  }

  async ensureAppointmentPaymentAtomic(appointmentId, createData) {
    const nowBo = getBoliviaNowSqlString();
    const paymentId = await PostgresConnection.transaction(async (client) => {
      // Lock exclusivo por cita_id equivalente a BEGIN IMMEDIATE
      await PostgresConnection.advisoryLock(client, 3001, appointmentId);

      const { rows: existingRows } = await client.query(
        `SELECT id FROM pagos_citas
         WHERE cita_id = $1
         ORDER BY id DESC
         LIMIT 1`,
        [appointmentId]
      );

      if (existingRows[0]) {
        return existingRows[0].id;
      }

      const { rows: insertRows } = await client.query(
        `INSERT INTO pagos_citas (
           cita_id, paciente_id, tutor_id, terapeuta_id, monto_bob,
           metodo_pago, estado, comprobante_url, comprobante_tipo,
           numero_transaccion, observaciones, fecha_pago, created_at, updated_at, servicio_nombre
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         RETURNING id`,
        [
          appointmentId,
          createData.paciente_id,
          createData.tutor_id || null,
          createData.terapeuta_id,
          createData.monto_bob,
          createData.metodo_pago || 'QR_SIMPLE',
          createData.estado || 'PENDIENTE',
          createData.comprobante_url || null,
          createData.comprobante_tipo || null,
          createData.numero_transaccion || null,
          createData.observaciones || null,
          createData.fecha_pago || null,
          nowBo,
          nowBo,
          createData.servicio_nombre || null
        ]
      );

      return insertRows[0].id;
    });

    return this.getPaymentById(paymentId);
  }

  async registerCashPaymentAtomic(appointmentId, payload) {
    const nowBo = getBoliviaNowSqlString();
    const paymentId = await PostgresConnection.transaction(async (client) => {
      await PostgresConnection.advisoryLock(client, 3001, appointmentId);

      const { rows: verifiedRows } = await client.query(
        `SELECT id FROM pagos_citas
         WHERE cita_id = $1 AND estado IN ('VERIFICADO', 'COMPLETADO')
         LIMIT 1`,
        [appointmentId]
      );

      if (verifiedRows[0]) {
        throw AppError.conflict('Esta cita ya cuenta con un pago verificado y acreditado. No se permiten cobros duplicados.');
      }

      const { rows: reusableRows } = await client.query(
        `SELECT id FROM pagos_citas
         WHERE cita_id = $1 AND estado IN ('PENDIENTE', 'EN_REVISION', 'RECHAZADO')
         ORDER BY id DESC
         LIMIT 1`,
        [appointmentId]
      );

      if (reusableRows[0]) {
        await client.query(
          `UPDATE pagos_citas
           SET
             monto_bob = $1,
             metodo_pago = 'EFECTIVO',
             estado = 'VERIFICADO',
             numero_transaccion = $2,
             observaciones = COALESCE($3, observaciones),
             motivo_rechazo = NULL,
             verificado_por_usuario_id = $4,
             fecha_pago = $5,
             fecha_verificacion = $6,
             updated_at = $7
           WHERE id = $8`,
          [
            payload.monto_bob,
            payload.numero_transaccion,
            payload.observaciones,
            payload.verificado_por_usuario_id,
            payload.fecha_pago || nowBo,
            nowBo,
            nowBo,
            reusableRows[0].id
          ]
        );
        return reusableRows[0].id;
      }

      const { rows: insertRows } = await client.query(
        `INSERT INTO pagos_citas (
           cita_id, paciente_id, tutor_id, terapeuta_id, monto_bob,
           metodo_pago, estado, numero_transaccion, observaciones,
           verificado_por_usuario_id, fecha_pago, fecha_verificacion,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, 'EFECTIVO', 'VERIFICADO', $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          appointmentId,
          payload.paciente_id,
          payload.tutor_id || null,
          payload.terapeuta_id,
          payload.monto_bob,
          payload.numero_transaccion,
          payload.observaciones,
          payload.verificado_por_usuario_id,
          payload.fecha_pago || nowBo,
          nowBo,
          nowBo,
          nowBo
        ]
      );

      return insertRows[0].id;
    });

    return this.getPaymentById(paymentId);
  }

  async findConflictingTransaction(numeroTransaccion, excludePaymentId = null) {
    const clean = String(numeroTransaccion || '').trim();
    if (!clean) return null;

    let sql = `
      SELECT id, estado, cita_id, numero_transaccion
      FROM pagos_citas
      WHERE LOWER(TRIM(numero_transaccion)) = LOWER($1)
        AND estado IN ('VERIFICADO', 'COMPLETADO', 'EN_REVISION')
    `;
    const params = [clean];

    if (excludePaymentId) {
      params.push(excludePaymentId);
      sql += ` AND id != $${params.length}`;
    }
    sql += ` LIMIT 1`;

    const { rows } = await PostgresConnection.query(sql, params);
    return rows[0] || null;
  }

  async getPaymentById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         p.*,
         p.monto_bob AS monto,
         p.created_at AS fecha_creacion,
         p.fecha_verificacion AS fecha_aprobacion,
         COALESCE(
           TO_CHAR(c.fecha_hora_inicio AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD'),
           TO_CHAR(p.created_at AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')
         ) AS cita_fecha,
         COALESCE(
           TO_CHAR(c.fecha_hora_inicio AT TIME ZONE 'America/La_Paz', 'HH24:MI'),
           TO_CHAR(p.created_at AT TIME ZONE 'America/La_Paz', 'HH24:MI')
         ) AS cita_hora_inicio,
         pac.codigo_expediente AS paciente_codigo,
         pac.nombres AS paciente_nombres,
         pac.apellidos AS paciente_apellidos,
         TRIM(pac.nombres || ' ' || pac.apellidos) AS paciente_nombre,
         pac.ci AS paciente_ci,
         t.nombres AS terapeuta_nombres,
         t.apellidos AS terapeuta_apellidos,
         TRIM(t.nombres || ' ' || t.apellidos) AS terapeuta_nombre,
         t.qr_cobro_url AS terapeuta_qr_url,
         t.banco_nombre AS terapeuta_banco,
         t.cuenta_numero AS terapeuta_cuenta,
         t.cuenta_titular AS terapeuta_titular,
         t.qr_fecha_vencimiento AS terapeuta_qr_vencimiento,
         esp.nombre AS terapeuta_especialidad,
         tut.nombres AS tutor_nombres,
         tut.apellidos AS tutor_apellidos,
         TRIM(tut.nombres || ' ' || tut.apellidos) AS tutor_nombre,
         tut.ci AS tutor_ci,
         tut.whatsapp AS tutor_whatsapp,
         c.fecha_hora_inicio AS cita_fecha_hora,
         c.duracion_minutos AS cita_duracion,
         COALESCE(p.servicio_nombre, c.servicio_personalizado, sa.nombre, 'Consulta Especializada') AS servicio_nombre,
         u_ver.nombre_completo AS verificado_por_nombre
       FROM pagos_citas p
       JOIN pacientes pac ON p.paciente_id = pac.id
       JOIN terapeutas t ON p.terapeuta_id = t.id
       LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
       LEFT JOIN tutores tut ON p.tutor_id = tut.id
       LEFT JOIN citas c ON p.cita_id = c.id
       LEFT JOIN servicios_aranceles sa ON c.servicio_id = sa.id
       LEFT JOIN usuarios u_ver ON p.verificado_por_usuario_id = u_ver.id
       WHERE p.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async getPaymentByAppointmentId(appointmentId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         p.*,
         p.monto_bob AS monto,
         p.created_at AS fecha_creacion,
         p.fecha_verificacion AS fecha_aprobacion,
         COALESCE(
           TO_CHAR(c.fecha_hora_inicio AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD'),
           TO_CHAR(p.created_at AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')
         ) AS cita_fecha,
         COALESCE(
           TO_CHAR(c.fecha_hora_inicio AT TIME ZONE 'America/La_Paz', 'HH24:MI'),
           TO_CHAR(p.created_at AT TIME ZONE 'America/La_Paz', 'HH24:MI')
         ) AS cita_hora_inicio,
         pac.codigo_expediente AS paciente_codigo,
         pac.nombres AS paciente_nombres,
         pac.apellidos AS paciente_apellidos,
         t.nombres AS terapeuta_nombres,
         t.apellidos AS terapeuta_apellidos,
         t.qr_cobro_url AS terapeuta_qr_url,
         t.banco_nombre AS terapeuta_banco,
         t.cuenta_numero AS terapeuta_cuenta,
         t.cuenta_titular AS terapeuta_titular,
         t.qr_fecha_vencimiento AS terapeuta_qr_vencimiento,
         COALESCE(p.servicio_nombre, c.servicio_personalizado, sa.nombre, 'Consulta Especializada') AS servicio_nombre
       FROM pagos_citas p
       JOIN pacientes pac ON p.paciente_id = pac.id
       JOIN terapeutas t ON p.terapeuta_id = t.id
       LEFT JOIN citas c ON p.cita_id = c.id
       LEFT JOIN servicios_aranceles sa ON c.servicio_id = sa.id
       WHERE p.cita_id = $1
       ORDER BY p.id DESC
       LIMIT 1`,
      [appointmentId]
    );
    return rows[0] || null;
  }

  async getPayments(filters = {}) {
    let sql = `
      SELECT
        p.*,
        p.monto_bob AS monto,
        p.created_at AS fecha_creacion,
        p.fecha_verificacion AS fecha_aprobacion,
        COALESCE(
          TO_CHAR(c.fecha_hora_inicio AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD'),
          TO_CHAR(p.created_at AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD')
        ) AS cita_fecha,
        COALESCE(
          TO_CHAR(c.fecha_hora_inicio AT TIME ZONE 'America/La_Paz', 'HH24:MI'),
          TO_CHAR(p.created_at AT TIME ZONE 'America/La_Paz', 'HH24:MI')
        ) AS cita_hora_inicio,
        pac.codigo_expediente AS paciente_codigo,
        pac.nombres AS paciente_nombres,
        pac.apellidos AS paciente_apellidos,
        TRIM(pac.nombres || ' ' || pac.apellidos) AS paciente_nombre,
        pac.ci AS paciente_ci,
        t.id AS terapeuta_id,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos,
        TRIM(t.nombres || ' ' || t.apellidos) AS terapeuta_nombre,
        t.qr_cobro_url AS terapeuta_qr_url,
        t.banco_nombre AS terapeuta_banco,
        t.cuenta_numero AS terapeuta_cuenta,
        t.cuenta_titular AS terapeuta_titular,
        t.qr_fecha_vencimiento AS terapeuta_qr_vencimiento,
        esp.nombre AS terapeuta_especialidad,
        tut.nombres AS tutor_nombres,
        tut.apellidos AS tutor_apellidos,
        TRIM(tut.nombres || ' ' || tut.apellidos) AS tutor_nombre,
        tut.whatsapp AS tutor_whatsapp,
        c.fecha_hora_inicio AS cita_fecha_hora,
        c.duracion_minutos AS cita_duracion,
        COALESCE(p.servicio_nombre, c.servicio_personalizado, sa.nombre, p.observaciones, 'Consulta Especializada') AS servicio_nombre,
        u_ver.nombre_completo AS verificado_por_nombre
      FROM pagos_citas p
      JOIN pacientes pac ON p.paciente_id = pac.id
      JOIN terapeutas t ON p.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      LEFT JOIN tutores tut ON p.tutor_id = tut.id
      LEFT JOIN citas c ON p.cita_id = c.id
      LEFT JOIN servicios_aranceles sa ON c.servicio_id = sa.id
      LEFT JOIN usuarios u_ver ON p.verificado_por_usuario_id = u_ver.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.terapeutaId) {
      params.push(filters.terapeutaId);
      sql += ` AND p.terapeuta_id = $${params.length}`;
    }

    if (filters.pacienteId) {
      params.push(filters.pacienteId);
      sql += ` AND p.paciente_id = $${params.length}`;
    }

    if (filters.tutorId) {
      params.push(filters.tutorId);
      const pIdx = `$${params.length}`;
      sql += ` AND (p.tutor_id = ${pIdx} OR pac.id IN (SELECT paciente_id FROM paciente_tutor WHERE tutor_id = ${pIdx}))`;
    }

    if (filters.estado) {
      params.push(filters.estado);
      sql += ` AND p.estado = $${params.length}`;
    }

    if (filters.metodoPago) {
      params.push(filters.metodoPago);
      sql += ` AND p.metodo_pago = $${params.length}`;
    }

    if (filters.fechaInicio) {
      params.push(filters.fechaInicio + ' 00:00:00');
      const pIdx = `$${params.length}`;
      sql += ` AND (p.fecha_pago >= ${pIdx}::timestamptz OR c.fecha_hora_inicio >= ${pIdx}::timestamptz)`;
    }

    if (filters.fechaFin) {
      params.push(filters.fechaFin + ' 23:59:59');
      const pIdx = `$${params.length}`;
      sql += ` AND (p.fecha_pago <= ${pIdx}::timestamptz OR c.fecha_hora_inicio <= ${pIdx}::timestamptz)`;
    }

    sql += ` ORDER BY p.id DESC`;

    const { rows } = await PostgresConnection.query(sql, params);
    return rows;
  }

  async updatePayment(id, data) {
    const allowed = [
      'metodo_pago', 'estado', 'comprobante_url', 'comprobante_tipo',
      'numero_transaccion', 'observaciones', 'motivo_rechazo',
      'verificado_por_usuario_id', 'fecha_pago', 'fecha_verificacion'
    ];

    const sets = [];
    const params = [];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        params.push(data[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }

    if (sets.length === 0) return this.getPaymentById(id);

    const nowBo = getBoliviaNowSqlString();
    params.push(nowBo, id);
    sets.push(`updated_at = $${params.length - 1}`);

    await PostgresConnection.query(
      `UPDATE pagos_citas SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    );

    return this.getPaymentById(id);
  }

  async verifyPayment(id, { verificado_por_usuario_id, estado = 'VERIFICADO', observaciones = null, motivo_rechazo = null }) {
    const nowBo = getBoliviaNowSqlString();

    await PostgresConnection.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, estado, numero_transaccion
         FROM pagos_citas
         WHERE id = $1
         FOR UPDATE`,
        [id]
      );
      const current = rows[0];

      if (!current) {
        throw AppError.notFound(`Pago con ID ${id} no encontrado.`);
      }

      if (current.estado === 'VERIFICADO' || current.estado === 'COMPLETADO') {
        throw AppError.conflict('Este pago ya fue verificado y acreditado anteriormente.');
      }

      if (estado === 'VERIFICADO' && current.numero_transaccion && String(current.numero_transaccion).trim()) {
        const { rows: dupRows } = await client.query(
          `SELECT id FROM pagos_citas
           WHERE id != $1
             AND LOWER(TRIM(numero_transaccion)) = LOWER($2)
             AND estado IN ('VERIFICADO', 'COMPLETADO')
           LIMIT 1`,
          [id, String(current.numero_transaccion).trim()]
        );
        if (dupRows[0]) {
          throw AppError.conflict('El número de transacción de este comprobante ya fue aprobado en otro pago.');
        }
      }

      const upd = await client.query(
        `UPDATE pagos_citas
         SET
           estado = $1,
           verificado_por_usuario_id = $2,
           observaciones = COALESCE($3, observaciones),
           motivo_rechazo = $4,
           fecha_verificacion = $5,
           updated_at = $6
         WHERE id = $7 AND estado NOT IN ('VERIFICADO', 'COMPLETADO')`,
        [estado, verificado_por_usuario_id, observaciones, motivo_rechazo, nowBo, nowBo, id]
      );

      if (upd.rowCount !== 1) {
        throw AppError.conflict('El pago acaba de ser procesado por otra solicitud simultánea.');
      }
    });

    return this.getPaymentById(id);
  }

  async getCashSummary(filters = {}) {
    let whereSql = 'WHERE 1=1';
    const params = [];

    if (filters.terapeutaId) {
      params.push(filters.terapeutaId);
      whereSql += ` AND p.terapeuta_id = $${params.length}`;
    }

    if (filters.fechaInicio) {
      params.push(filters.fechaInicio + ' 00:00:00');
      const pIdx = `$${params.length}`;
      whereSql += ` AND (p.fecha_pago >= ${pIdx}::timestamptz OR p.created_at >= ${pIdx}::timestamptz)`;
    }

    if (filters.fechaFin) {
      params.push(filters.fechaFin + ' 23:59:59');
      const pIdx = `$${params.length}`;
      whereSql += ` AND (p.fecha_pago <= ${pIdx}::timestamptz OR p.created_at <= ${pIdx}::timestamptz)`;
    }

    const { rows } = await PostgresConnection.query(
      `SELECT
         COUNT(*)::int AS total_transacciones,
         COALESCE(SUM(CASE WHEN p.estado IN ('VERIFICADO', 'COMPLETADO') THEN p.monto_bob ELSE 0 END), 0) AS total_recaudado_bob,
         COALESCE(SUM(CASE WHEN p.estado IN ('VERIFICADO', 'COMPLETADO') AND p.metodo_pago IN ('QR_SIMPLE', 'QR_BANCO') THEN p.monto_bob ELSE 0 END), 0) AS total_qr_bob,
         COALESCE(SUM(CASE WHEN p.estado IN ('VERIFICADO', 'COMPLETADO') AND p.metodo_pago = 'EFECTIVO' THEN p.monto_bob ELSE 0 END), 0) AS total_efectivo_bob,
         COALESCE(SUM(CASE WHEN p.estado IN ('VERIFICADO', 'COMPLETADO') AND p.metodo_pago = 'TRANSFERENCIA' THEN p.monto_bob ELSE 0 END), 0) AS total_transferencia_bob,
         COUNT(CASE WHEN p.estado = 'EN_REVISION' THEN 1 END)::int AS pendientes_revision,
         COUNT(CASE WHEN p.estado = 'PENDIENTE' THEN 1 END)::int AS pendientes_pago,
         COUNT(CASE WHEN p.estado IN ('VERIFICADO', 'COMPLETADO') THEN 1 END)::int AS verificados,
         COUNT(CASE WHEN p.estado = 'RECHAZADO' THEN 1 END)::int AS rechazados
       FROM pagos_citas p
       ${whereSql}`,
      params
    );

    const res = rows[0] || {};
    return {
      ...res,
      totalRecaudado: Number(res.total_recaudado_bob) || 0,
      totalQr: (Number(res.total_qr_bob) || 0) + (Number(res.total_transferencia_bob) || 0),
      totalEfectivo: Number(res.total_efectivo_bob) || 0,
      totalPendiente: Number(res.pendientes_pago) || 0,
      totalEnRevision: Number(res.pendientes_revision) || 0,
      totalAprobadosCount: Number(res.verificados) || 0,
      total_recaudado: Number(res.total_recaudado_bob) || 0,
      total_qr: (Number(res.total_qr_bob) || 0) + (Number(res.total_transferencia_bob) || 0),
      total_efectivo: Number(res.total_efectivo_bob) || 0
    };
  }

  async getQrConfig() {
    const keys = [
      'PAGO_QR_IMAGEN',
      'PAGO_BANCO_NOMBRE',
      'PAGO_CUENTA_TITULAR',
      'PAGO_CUENTA_NUMERO',
      'PAGO_QR_INSTRUCCIONES'
    ];

    const { rows } = await PostgresConnection.query(
      `SELECT clave, valor, descripcion
       FROM configuraciones_sistema
       WHERE clave = ANY($1::text[])`,
      [keys]
    );

    const map = {};
    for (const r of rows) {
      map[r.clave] = r.valor;
    }

    return {
      qr_imagen: map['PAGO_QR_IMAGEN'] || null,
      banco_nombre: map['PAGO_BANCO_NOMBRE'] || 'Banco Unión S.A. / BCP Bolivia',
      cuenta_titular: map['PAGO_CUENTA_TITULAR'] || 'Centro Psicopedagógico y Psicológico PSI Aprende S.R.L.',
      cuenta_numero: map['PAGO_CUENTA_NUMERO'] || '10000049281726 (Cta. Corriente M/N Bolivianos)',
      instrucciones: map['PAGO_QR_INSTRUCCIONES'] || 'Escanee el código QR desde su aplicación móvil de banca (Simple QR). En la glosa ingrese el nombre del paciente y adjunte su comprobante.',
      PAGO_QR_IMAGEN: map['PAGO_QR_IMAGEN'] || null,
      PAGO_BANCO_NOMBRE: map['PAGO_BANCO_NOMBRE'] || 'Banco Unión S.A. / BCP Bolivia',
      PAGO_CUENTA_TITULAR: map['PAGO_CUENTA_TITULAR'] || 'Centro Psicopedagógico y Psicológico PSI Aprende S.R.L.',
      PAGO_CUENTA_NUMERO: map['PAGO_CUENTA_NUMERO'] || '10000049281726 (Cta. Corriente M/N Bolivianos)',
      PAGO_QR_INSTRUCCIONES: map['PAGO_QR_INSTRUCCIONES'] || 'Escanee el código QR desde su aplicación móvil de banca (Simple QR). En la glosa ingrese el nombre del paciente y adjunte su comprobante.'
    };
  }

  async updateQrConfig(configData, userId = null) {
    const map = {
      PAGO_QR_IMAGEN: configData.qr_imagen,
      PAGO_BANCO_NOMBRE: configData.banco_nombre,
      PAGO_CUENTA_TITULAR: configData.cuenta_titular,
      PAGO_CUENTA_NUMERO: configData.cuenta_numero,
      PAGO_QR_INSTRUCCIONES: configData.instrucciones
    };

    const sql = `
      INSERT INTO configuraciones_sistema (clave, valor, categoria, es_secreto, updated_at, updated_by)
      VALUES ($1, $2, 'FINANZAS', 0, CURRENT_TIMESTAMP, $3)
      ON CONFLICT (clave) DO UPDATE SET
        valor = EXCLUDED.valor,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = EXCLUDED.updated_by
    `;

    for (const [clave, valor] of Object.entries(map)) {
      if (valor !== undefined && valor !== null) {
        await PostgresConnection.query(sql, [clave, valor, userId]);
      }
    }

    return this.getQrConfig();
  }
}
