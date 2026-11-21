import { PostgresConnection } from '../../core/PostgresConnection.js';
import { IBatteryRepository } from '../../domain/interfaces/IBatteryRepository.js';
import { AppError } from '../../core/AppError.js';

export class PostgresBatteryRepository extends IBatteryRepository {
  async getAllBatteries(filters = {}) {
    let sql = `
      SELECT
        b.*,
        p.id AS prestamo_activo_id,
        p.fecha_retiro AS prestamo_fecha_retiro,
        p.fecha_devolucion_estimada AS prestamo_devolucion_estimada,
        p.observaciones_entrega AS prestamo_observaciones,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos,
        esp.nombre AS terapeuta_especialidad,
        amb.nombre AS ambiente_nombre,
        amb.codigo AS ambiente_codigo
      FROM inventario_baterias b
      LEFT JOIN prestamos_baterias p ON b.id = p.bateria_id AND p.estado IN ('ACTIVO', 'MORA')
      LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      LEFT JOIN ambientes amb ON p.ambiente_id = amb.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.estadoDisponibilidad) {
      params.push(filters.estadoDisponibilidad);
      sql += ` AND b.estado_disponibilidad = $${params.length}`;
    }

    if (filters.search) {
      const term = `%${filters.search}%`;
      params.push(term);
      const pIdx = `$${params.length}`;
      sql += ` AND (b.nombre ILIKE ${pIdx} OR b.codigo_patrimonial ILIKE ${pIdx} OR b.area_evaluada ILIKE ${pIdx})`;
    }

    sql += ` ORDER BY b.id ASC`;
    const { rows } = await PostgresConnection.query(sql, params);
    return rows;
  }

  async getBatteryById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         b.*,
         p.id AS prestamo_activo_id,
         p.fecha_retiro AS prestamo_fecha_retiro,
         p.fecha_devolucion_estimada AS prestamo_devolucion_estimada,
         p.observaciones_entrega AS prestamo_observaciones,
         t.id AS prestamo_terapeuta_id,
         t.nombres AS terapeuta_nombres,
         t.apellidos AS terapeuta_apellidos,
         esp.nombre AS terapeuta_especialidad,
         amb.nombre AS ambiente_nombre,
         amb.codigo AS ambiente_codigo
       FROM inventario_baterias b
       LEFT JOIN prestamos_baterias p ON b.id = p.bateria_id AND p.estado IN ('ACTIVO', 'MORA')
       LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
       LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
       LEFT JOIN ambientes amb ON p.ambiente_id = amb.id
       WHERE b.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async createBattery(data) {
    const {
      codigo_patrimonial,
      nombre,
      editorial = null,
      area_evaluada = null,
      piezas_detalle = null,
      ubicacion = 'Gabinete General',
      imagen_url = null,
      documento_referencia_url = null,
      estado_conservacion = 'BUENO',
      estado_disponibilidad = 'DISPONIBLE'
    } = data;

    const { rows } = await PostgresConnection.query(
      `INSERT INTO inventario_baterias (
         codigo_patrimonial, nombre, editorial, area_evaluada,
         piezas_detalle, ubicacion, imagen_url, documento_referencia_url,
         estado_conservacion, estado_disponibilidad,
         created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        codigo_patrimonial,
        nombre,
        editorial,
        area_evaluada,
        piezas_detalle,
        ubicacion,
        imagen_url,
        documento_referencia_url,
        estado_conservacion,
        estado_disponibilidad
      ]
    );

    return this.getBatteryById(rows[0].id);
  }

  async updateBattery(id, data) {
    const allowed = [
      'codigo_patrimonial', 'nombre', 'editorial', 'area_evaluada',
      'piezas_detalle', 'ubicacion', 'imagen_url', 'documento_referencia_url',
      'estado_conservacion', 'estado_disponibilidad'
    ];

    const sets = [];
    const params = [];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        params.push(data[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }

    if (sets.length === 0) return this.getBatteryById(id);

    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await PostgresConnection.query(
      `UPDATE inventario_baterias SET ${sets.join(', ')} WHERE id = $${params.length}`,
      params
    );
    return this.getBatteryById(id);
  }

  async _checkTherapistLoanStatusWithRunner(runner, therapistId) {
    const { rows: activeLoans } = await runner.query(
      `SELECT
         p.*,
         b.codigo_patrimonial,
         b.nombre AS bateria_nombre,
         CASE
           WHEN p.fecha_devolucion_estimada < CURRENT_TIMESTAMP THEN 1
           ELSE 0
         END AS esta_vencido
       FROM prestamos_baterias p
       JOIN inventario_baterias b ON p.bateria_id = b.id
       WHERE p.terapeuta_id = $1 AND p.estado IN ('ACTIVO', 'MORA')
       ORDER BY p.fecha_devolucion_estimada ASC`,
      [therapistId]
    );

    const overdueLoans = activeLoans.filter(l => l.esta_vencido === 1 || l.estado === 'MORA');

    return {
      canBorrow: overdueLoans.length === 0,
      hasOverdueLoan: overdueLoans.length > 0,
      overdueLoans,
      activeLoans,
      reason: overdueLoans.length > 0
        ? `Bloqueo RN-06: El especialista registra ${overdueLoans.length} material(es) en mora de entrega (${overdueLoans.map(o => o.bateria_nombre).join(', ')}). Debe regularizar la devolución antes de solicitar nuevas pruebas.`
        : null
    };
  }

  async checkTherapistLoanStatus(therapistId) {
    return this._checkTherapistLoanStatusWithRunner(PostgresConnection, therapistId);
  }

  async createLoan(loanData) {
    const {
      bateria_id,
      terapeuta_id,
      ambiente_id = null,
      paciente_id = null,
      fecha_devolucion_estimada,
      duracion_horas = 3,
      observaciones_entrega = null,
      entregado_por_usuario_id = null
    } = loanData;

    const returnEstimado = fecha_devolucion_estimada || new Date(Date.now() + (Number(duracion_horas) || 3) * 3600 * 1000).toISOString();

    const loanId = await PostgresConnection.transaction(async (client) => {
      // Lock exclusivo por terapeuta para evitar préstamos simultáneos con mora (RN-06)
      await PostgresConnection.advisoryLock(client, 2001, terapeuta_id);

      const therapistStatus = await this._checkTherapistLoanStatusWithRunner(client, terapeuta_id);
      if (therapistStatus.hasOverdueLoan) {
        throw AppError.forbidden(therapistStatus.reason);
      }

      const { rows: bRows } = await client.query(
        `SELECT id, nombre, estado_disponibilidad
         FROM inventario_baterias
         WHERE id = $1
         FOR UPDATE`,
        [bateria_id]
      );
      const battery = bRows[0];

      if (!battery) {
        throw AppError.notFound(`Batería con ID ${bateria_id} no encontrada.`);
      }
      if (battery.estado_disponibilidad !== 'DISPONIBLE') {
        throw AppError.conflict(`La prueba "${battery.nombre}" no está disponible actualmente (Estado: ${battery.estado_disponibilidad}).`);
      }

      const updateRes = await client.query(
        `UPDATE inventario_baterias
         SET estado_disponibilidad = 'EN_CONSULTA', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND estado_disponibilidad = 'DISPONIBLE'`,
        [bateria_id]
      );

      if (updateRes.rowCount !== 1) {
        throw AppError.conflict(`La prueba "${battery.nombre}" acaba de ser asignada en una solicitud simultánea.`);
      }

      const { rows: insertRows } = await client.query(
        `INSERT INTO prestamos_baterias (
           bateria_id, terapeuta_id, ambiente_id, paciente_id,
           fecha_retiro, fecha_devolucion_estimada, estado,
           observaciones_entrega, entregado_por_usuario_id,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, 'ACTIVO', $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        [
          bateria_id,
          terapeuta_id,
          ambiente_id,
          paciente_id,
          returnEstimado,
          observaciones_entrega,
          entregado_por_usuario_id
        ]
      );

      return insertRows[0].id;
    });

    return this.getLoanById(loanId);
  }

  async returnLoan(loanId, returnData = {}) {
    const {
      observaciones_recepcion = null,
      estado_conservacion = null,
      recibido_por_usuario_id = null
    } = returnData;

    await PostgresConnection.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, bateria_id, estado FROM prestamos_baterias WHERE id = $1 FOR UPDATE`,
        [loanId]
      );
      const loan = rows[0];
      if (!loan) {
        throw AppError.notFound(`Préstamo con ID ${loanId} no encontrado.`);
      }
      if (loan.estado === 'DEVUELTO') {
        throw AppError.conflict('Este material ya fue devuelto y registrado con anterioridad.');
      }

      const updLoan = await client.query(
        `UPDATE prestamos_baterias
         SET
           estado = 'DEVUELTO',
           fecha_devolucion_real = CURRENT_TIMESTAMP,
           observaciones_recepcion = $1,
           recibido_por_usuario_id = $2,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND estado != 'DEVUELTO'`,
        [observaciones_recepcion, recibido_por_usuario_id, loanId]
      );

      if (updLoan.rowCount !== 1) {
        throw AppError.conflict('Este material ya fue devuelto por otra solicitud simultánea.');
      }

      if (estado_conservacion) {
        await client.query(
          `UPDATE inventario_baterias
           SET estado_disponibilidad = 'DISPONIBLE', estado_conservacion = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [estado_conservacion, loan.bateria_id]
        );
      } else {
        await client.query(
          `UPDATE inventario_baterias
           SET estado_disponibilidad = 'DISPONIBLE', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [loan.bateria_id]
        );
      }
    });

    return this.getLoanById(loanId);
  }

  async getLoanById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         p.*,
         b.codigo_patrimonial,
         b.nombre AS bateria_nombre,
         b.editorial AS bateria_editorial,
         b.piezas_detalle,
         t.nombres AS terapeuta_nombres,
         t.apellidos AS terapeuta_apellidos,
         amb.nombre AS ambiente_nombre,
         pac.codigo_expediente AS paciente_codigo,
         pac.nombres AS paciente_nombres,
         pac.apellidos AS paciente_apellidos,
         u_ent.nombre_completo AS entregado_por_nombre,
         u_rec.nombre_completo AS recibido_por_nombre
       FROM prestamos_baterias p
       JOIN inventario_baterias b ON p.bateria_id = b.id
       JOIN terapeutas t ON p.terapeuta_id = t.id
       LEFT JOIN ambientes amb ON p.ambiente_id = amb.id
       LEFT JOIN pacientes pac ON p.paciente_id = pac.id
       LEFT JOIN usuarios u_ent ON p.entregado_por_usuario_id = u_ent.id
       LEFT JOIN usuarios u_rec ON p.recibido_por_usuario_id = u_rec.id
       WHERE p.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async getLoanHistory(filters = {}) {
    let sql = `
      SELECT
        p.*,
        b.codigo_patrimonial,
        b.nombre AS bateria_nombre,
        t.nombres AS terapeuta_nombres,
        t.apellidos AS terapeuta_apellidos,
        amb.nombre AS ambiente_nombre,
        pac.nombres AS paciente_nombres,
        pac.apellidos AS paciente_apellidos
      FROM prestamos_baterias p
      JOIN inventario_baterias b ON p.bateria_id = b.id
      JOIN terapeutas t ON p.terapeuta_id = t.id
      LEFT JOIN ambientes amb ON p.ambiente_id = amb.id
      LEFT JOIN pacientes pac ON p.paciente_id = pac.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.terapeutaId) {
      params.push(filters.terapeutaId);
      sql += ` AND p.terapeuta_id = $${params.length}`;
    }

    if (filters.bateriaId) {
      params.push(filters.bateriaId);
      sql += ` AND p.bateria_id = $${params.length}`;
    }

    if (filters.estado) {
      params.push(filters.estado);
      sql += ` AND p.estado = $${params.length}`;
    }

    sql += ` ORDER BY p.id DESC LIMIT 100`;
    const { rows } = await PostgresConnection.query(sql, params);
    return rows;
  }
}
