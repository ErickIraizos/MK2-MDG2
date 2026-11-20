import { DatabaseConnection } from '../../core/DatabaseConnection.js';
import { IPaymentRepository } from '../../domain/interfaces/IPaymentRepository.js';
import { AppError } from '../../core/AppError.js';
import { getBoliviaNowSqlString } from '../../utils/dateTime.js';

export class SqlitePaymentRepository extends IPaymentRepository {
  constructor() {
    super();
    this.db = DatabaseConnection.getInstance();
    this._ensureSchema();
  }

  _ensureSchema() {
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS pagos_citas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cita_id INTEGER NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
          paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
          tutor_id INTEGER REFERENCES tutores(id) ON DELETE SET NULL,
          terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
          monto_bob REAL NOT NULL,
          metodo_pago TEXT DEFAULT 'QR_SIMPLE' CHECK (metodo_pago IN ('QR_SIMPLE', 'EFECTIVO', 'TRANSFERENCIA')),
          estado TEXT DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_REVISION', 'VERIFICADO', 'RECHAZADO')),
          comprobante_url TEXT,
          comprobante_tipo TEXT,
          numero_transaccion TEXT,
          observaciones TEXT,
          motivo_rechazo TEXT,
          verificado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          fecha_pago DATETIME,
          fecha_verificacion DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).run();
    } catch (e) {}
  }

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
    const stmt = this.db.prepare(`
      INSERT INTO pagos_citas (
        cita_id, paciente_id, tutor_id, terapeuta_id, monto_bob,
        metodo_pago, estado, comprobante_url, comprobante_tipo,
        numero_transaccion, observaciones, fecha_pago, created_at, updated_at, servicio_nombre
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
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
    );

    return this.getPaymentById(result.lastInsertRowid);
  }

  /**
   * Crea o recupera de forma atómica (BEGIN IMMEDIATE) la orden de pago de una cita,
   * evitando órdenes duplicadas cuando dos peticiones llegan al mismo milisegundo.
   */
  async ensureAppointmentPaymentAtomic(appointmentId, createData) {
    const nowBo = getBoliviaNowSqlString();
    const tx = this.db.transaction(() => {
      const existing = this.db.prepare(`
        SELECT id FROM pagos_citas
        WHERE cita_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(appointmentId);

      if (existing) {
        return existing.id;
      }

      const result = this.db.prepare(`
        INSERT INTO pagos_citas (
          cita_id, paciente_id, tutor_id, terapeuta_id, monto_bob,
          metodo_pago, estado, comprobante_url, comprobante_tipo,
          numero_transaccion, observaciones, fecha_pago, created_at, updated_at, servicio_nombre
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
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
      );

      return result.lastInsertRowid;
    });

    const paymentId = tx.immediate();
    return this.getPaymentById(paymentId);
  }

  /**
   * Registra y acredita un cobro en efectivo de manera atómica,
   * rechazando cualquier intento duplicado si la cita ya tiene pago VERIFICADO.
   */
  async registerCashPaymentAtomic(appointmentId, payload) {
    const nowBo = getBoliviaNowSqlString();
    const tx = this.db.transaction(() => {
      const verified = this.db.prepare(`
        SELECT id FROM pagos_citas
        WHERE cita_id = ? AND estado IN ('VERIFICADO', 'COMPLETADO')
        LIMIT 1
      `).get(appointmentId);

      if (verified) {
        throw AppError.conflict('Esta cita ya cuenta con un pago verificado y acreditado. No se permiten cobros duplicados.');
      }

      const reusable = this.db.prepare(`
        SELECT id FROM pagos_citas
        WHERE cita_id = ? AND estado IN ('PENDIENTE', 'EN_REVISION', 'RECHAZADO')
        ORDER BY id DESC
        LIMIT 1
      `).get(appointmentId);

      if (reusable) {
        this.db.prepare(`
          UPDATE pagos_citas
          SET
            monto_bob = ?,
            metodo_pago = 'EFECTIVO',
            estado = 'VERIFICADO',
            numero_transaccion = ?,
            observaciones = COALESCE(?, observaciones),
            motivo_rechazo = NULL,
            verificado_por_usuario_id = ?,
            fecha_pago = ?,
            fecha_verificacion = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          payload.monto_bob,
          payload.numero_transaccion,
          payload.observaciones,
          payload.verificado_por_usuario_id,
          payload.fecha_pago || nowBo,
          nowBo,
          nowBo,
          reusable.id
        );
        return reusable.id;
      }

      const result = this.db.prepare(`
        INSERT INTO pagos_citas (
          cita_id, paciente_id, tutor_id, terapeuta_id, monto_bob,
          metodo_pago, estado, numero_transaccion, observaciones,
          verificado_por_usuario_id, fecha_pago, fecha_verificacion,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'EFECTIVO', 'VERIFICADO', ?, ?, ?, ?, ?, ?, ?)
      `).run(
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
      );

      return result.lastInsertRowid;
    });

    const paymentId = tx.immediate();
    return this.getPaymentById(paymentId);
  }

  async findConflictingTransaction(numeroTransaccion, excludePaymentId = null) {
    const clean = String(numeroTransaccion || '').trim();
    if (!clean) return null;

    let sql = `
      SELECT id, estado, cita_id, numero_transaccion
      FROM pagos_citas
      WHERE LOWER(TRIM(numero_transaccion)) = LOWER(?)
        AND estado IN ('VERIFICADO', 'COMPLETADO', 'EN_REVISION')
    `;
    const params = [clean];

    if (excludePaymentId) {
      sql += ` AND id != ?`;
      params.push(excludePaymentId);
    }
    sql += ` LIMIT 1`;

    return this.db.prepare(sql).get(...params) || null;
  }

  async getPaymentById(id) {
    const sql = `
      SELECT 
        p.*,
        p.monto_bob AS monto,
        p.created_at AS fecha_creacion,
        p.fecha_verificacion AS fecha_aprobacion,
        COALESCE(SUBSTR(c.fecha_hora_inicio, 1, 10), SUBSTR(p.created_at, 1, 10)) AS cita_fecha,
        COALESCE(SUBSTR(c.fecha_hora_inicio, 12, 5), SUBSTR(p.created_at, 12, 5)) AS cita_hora_inicio,
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
      WHERE p.id = ?
    `;

    const row = this.db.prepare(sql).get(id);
    return row || null;
  }

  async getPaymentByAppointmentId(appointmentId) {
    const sql = `
      SELECT 
        p.*,
        p.monto_bob AS monto,
        p.created_at AS fecha_creacion,
        p.fecha_verificacion AS fecha_aprobacion,
        COALESCE(SUBSTR(c.fecha_hora_inicio, 1, 10), SUBSTR(p.created_at, 1, 10)) AS cita_fecha,
        COALESCE(SUBSTR(c.fecha_hora_inicio, 12, 5), SUBSTR(p.created_at, 12, 5)) AS cita_hora_inicio,
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
      WHERE p.cita_id = ?
      ORDER BY p.id DESC
      LIMIT 1
    `;
    const row = this.db.prepare(sql).get(appointmentId);
    return row || null;
  }

  async getPayments(filters = {}) {
    let sql = `
      SELECT 
        p.*,
        p.monto_bob AS monto,
        p.created_at AS fecha_creacion,
        p.fecha_verificacion AS fecha_aprobacion,
        COALESCE(SUBSTR(c.fecha_hora_inicio, 1, 10), SUBSTR(p.created_at, 1, 10)) AS cita_fecha,
        COALESCE(SUBSTR(c.fecha_hora_inicio, 12, 5), SUBSTR(p.created_at, 12, 5)) AS cita_hora_inicio,
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
      sql += ` AND p.terapeuta_id = ?`;
      params.push(filters.terapeutaId);
    }

    if (filters.pacienteId) {
      sql += ` AND p.paciente_id = ?`;
      params.push(filters.pacienteId);
    }

    if (filters.tutorId) {
      sql += ` AND (p.tutor_id = ? OR pac.id IN (SELECT paciente_id FROM paciente_tutor WHERE tutor_id = ?))`;
      params.push(filters.tutorId, filters.tutorId);
    }

    if (filters.estado) {
      sql += ` AND p.estado = ?`;
      params.push(filters.estado);
    }

    if (filters.metodoPago) {
      sql += ` AND p.metodo_pago = ?`;
      params.push(filters.metodoPago);
    }

    if (filters.fechaInicio) {
      sql += ` AND (p.fecha_pago >= ? OR c.fecha_hora_inicio >= ?)`;
      params.push(filters.fechaInicio + ' 00:00:00', filters.fechaInicio + ' 00:00:00');
    }

    if (filters.fechaFin) {
      sql += ` AND (p.fecha_pago <= ? OR c.fecha_hora_inicio <= ?)`;
      params.push(filters.fechaFin + ' 23:59:59', filters.fechaFin + ' 23:59:59');
    }

    sql += ` ORDER BY p.id DESC`;

    return this.db.prepare(sql).all(...params);
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
        sets.push(`${key} = ?`);
        params.push(data[key]);
      }
    }

    if (sets.length === 0) return this.getPaymentById(id);

    const nowBo = getBoliviaNowSqlString();
    sets.push(`updated_at = ?`);
    params.push(nowBo, id);

    const sql = `UPDATE pagos_citas SET ${sets.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...params);

    return this.getPaymentById(id);
  }

  async verifyPayment(id, { verificado_por_usuario_id, estado = 'VERIFICADO', observaciones = null, motivo_rechazo = null }) {
    const nowBo = getBoliviaNowSqlString();
    const tx = this.db.transaction(() => {
      const current = this.db.prepare(`
        SELECT id, estado, numero_transaccion
        FROM pagos_citas
        WHERE id = ?
      `).get(id);

      if (!current) {
        throw AppError.notFound(`Pago con ID ${id} no encontrado.`);
      }

      if (current.estado === 'VERIFICADO' || current.estado === 'COMPLETADO') {
        throw AppError.conflict('Este pago ya fue verificado y acreditado anteriormente.');
      }

      if (estado === 'VERIFICADO' && current.numero_transaccion && String(current.numero_transaccion).trim()) {
        const dup = this.db.prepare(`
          SELECT id FROM pagos_citas
          WHERE id != ?
            AND LOWER(TRIM(numero_transaccion)) = LOWER(?)
            AND estado IN ('VERIFICADO', 'COMPLETADO')
          LIMIT 1
        `).get(id, String(current.numero_transaccion).trim());
        if (dup) {
          throw AppError.conflict('El número de transacción de este comprobante ya fue aprobado en otro pago.');
        }
      }

      const upd = this.db.prepare(`
        UPDATE pagos_citas 
        SET 
          estado = ?,
          verificado_por_usuario_id = ?,
          observaciones = COALESCE(?, observaciones),
          motivo_rechazo = ?,
          fecha_verificacion = ?,
          updated_at = ?
        WHERE id = ? AND estado NOT IN ('VERIFICADO', 'COMPLETADO')
      `).run(estado, verificado_por_usuario_id, observaciones, motivo_rechazo, nowBo, nowBo, id);

      if (upd.changes !== 1) {
        throw AppError.conflict('El pago acaba de ser procesado por otra solicitud simultánea.');
      }
    });

    tx.immediate();
    return this.getPaymentById(id);
  }

  async getCashSummary(filters = {}) {
    let whereSql = 'WHERE 1=1';
    const params = [];

    if (filters.terapeutaId) {
      whereSql += ' AND p.terapeuta_id = ?';
      params.push(filters.terapeutaId);
    }

    if (filters.fechaInicio) {
      whereSql += ' AND (p.fecha_pago >= ? OR p.created_at >= ?)';
      params.push(filters.fechaInicio + ' 00:00:00', filters.fechaInicio + ' 00:00:00');
    }

    if (filters.fechaFin) {
      whereSql += ' AND (p.fecha_pago <= ? OR p.created_at <= ?)';
      params.push(filters.fechaFin + ' 23:59:59', filters.fechaFin + ' 23:59:59');
    }

    const sql = `
      SELECT 
        COUNT(*) AS total_transacciones,
        COALESCE(SUM(CASE WHEN p.estado IN ('VERIFICADO', 'COMPLETADO') THEN p.monto_bob ELSE 0 END), 0) AS total_recaudado_bob,
        COALESCE(SUM(CASE WHEN p.estado IN ('VERIFICADO', 'COMPLETADO') AND p.metodo_pago IN ('QR_SIMPLE', 'QR_BANCO') THEN p.monto_bob ELSE 0 END), 0) AS total_qr_bob,
        COALESCE(SUM(CASE WHEN p.estado IN ('VERIFICADO', 'COMPLETADO') AND p.metodo_pago = 'EFECTIVO' THEN p.monto_bob ELSE 0 END), 0) AS total_efectivo_bob,
        COALESCE(SUM(CASE WHEN p.estado IN ('VERIFICADO', 'COMPLETADO') AND p.metodo_pago = 'TRANSFERENCIA' THEN p.monto_bob ELSE 0 END), 0) AS total_transferencia_bob,
        COUNT(CASE WHEN p.estado = 'EN_REVISION' THEN 1 END) AS pendientes_revision,
        COUNT(CASE WHEN p.estado = 'PENDIENTE' THEN 1 END) AS pendientes_pago,
        COUNT(CASE WHEN p.estado IN ('VERIFICADO', 'COMPLETADO') THEN 1 END) AS verificados,
        COUNT(CASE WHEN p.estado = 'RECHAZADO' THEN 1 END) AS rechazados
      FROM pagos_citas p
      ${whereSql}
    `;

    const res = this.db.prepare(sql).get(...params);
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

    const placeholders = keys.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT clave, valor, descripcion 
      FROM configuraciones_sistema 
      WHERE clave IN (${placeholders})
    `).all(...keys);

    const map = {};
    for (const r of rows) {
      map[r.clave] = r.valor;
    }

    return {
      qr_imagen: map['PAGO_QR_IMAGEN'] || null,
      banco_nombre: map['PAGO_BANCO_NOMBRE'] || 'Banco Unión S.A. / BCP Bolivia',
      cuenta_titular: map['PAGO_CUENTA_TITULAR'] || 'Centro Psicopedagógico y Psicológico PSI Aprende S.R.L.',
      cuenta_numero: map['PAGO_CUENTA_NUMERO'] || '10000049281726 (Cta. Corriente M/N Bolivianos)',
      instrucciones: map['PAGO_QR_INSTRUCCIONES'] || 'Escanee el código QR desde su aplicación móvil de banca (Simple QR). En la glosa ingrese el nombre del paciente y adjunte su comprobante.'
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

    const stmt = this.db.prepare(`
      INSERT INTO configuraciones_sistema (clave, valor, categoria, es_secreto, updated_at, updated_by)
      VALUES (?, ?, 'FINANZAS', 0, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(clave) DO UPDATE SET
        valor = excluded.valor,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = excluded.updated_by
    `);

    for (const [clave, valor] of Object.entries(map)) {
      if (valor !== undefined && valor !== null) {
        stmt.run(clave, valor, userId);
      }
    }

    return this.getQrConfig();
  }
}
