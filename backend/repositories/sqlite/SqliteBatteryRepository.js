import { DatabaseConnection } from '../../core/DatabaseConnection.js';
import { IBatteryRepository } from '../../domain/interfaces/IBatteryRepository.js';
import { AppError } from '../../core/AppError.js';

export class SqliteBatteryRepository extends IBatteryRepository {
  constructor() {
    super();
    this.db = DatabaseConnection.getInstance();
    this._ensureSchema();
  }

  _ensureSchema() {
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS inventario_baterias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo_patrimonial TEXT UNIQUE NOT NULL,
          nombre TEXT NOT NULL,
          editorial TEXT,
          area_evaluada TEXT,
          piezas_detalle TEXT,
          ubicacion TEXT DEFAULT 'Gabinete General',
          imagen_url TEXT,
          documento_referencia_url TEXT,
          estado_conservacion TEXT DEFAULT 'BUENO',
          estado_disponibilidad TEXT DEFAULT 'DISPONIBLE',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).run();

      // Migraciones seguras si la tabla ya existía
      const bInfo = this.db.prepare("PRAGMA table_info(inventario_baterias)").all();
      const bCols = bInfo.map(c => c.name);
      if (!bCols.includes('imagen_url')) {
        this.db.exec("ALTER TABLE inventario_baterias ADD COLUMN imagen_url TEXT");
      }
      if (!bCols.includes('documento_referencia_url')) {
        this.db.exec("ALTER TABLE inventario_baterias ADD COLUMN documento_referencia_url TEXT");
      }
      if (!bCols.includes('ubicacion')) {
        this.db.exec("ALTER TABLE inventario_baterias ADD COLUMN ubicacion TEXT DEFAULT 'Gabinete General'");
      }

      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS prestamos_baterias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bateria_id INTEGER NOT NULL REFERENCES inventario_baterias(id) ON DELETE RESTRICT,
          terapeuta_id INTEGER NOT NULL REFERENCES terapeutas(id) ON DELETE RESTRICT,
          ambiente_id INTEGER REFERENCES ambientes(id) ON DELETE SET NULL,
          paciente_id INTEGER REFERENCES pacientes(id) ON DELETE SET NULL,
          fecha_retiro DATETIME DEFAULT CURRENT_TIMESTAMP,
          fecha_devolucion_estimada DATETIME NOT NULL,
          fecha_devolucion_real DATETIME,
          estado TEXT DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'DEVUELTO', 'MORA')),
          observaciones_entrega TEXT,
          observaciones_recepcion TEXT,
          entregado_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          recibido_por_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).run();
    } catch (e) {}
  }

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
      sql += ` AND b.estado_disponibilidad = ?`;
      params.push(filters.estadoDisponibilidad);
    }

    if (filters.search) {
      sql += ` AND (b.nombre LIKE ? OR b.codigo_patrimonial LIKE ? OR b.area_evaluada LIKE ?)`;
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY b.id ASC`;
    return this.db.prepare(sql).all(...params);
  }

  async getBatteryById(id) {
    const sql = `
      SELECT 
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
      WHERE b.id = ?
    `;
    return this.db.prepare(sql).get(id) || null;
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

    const stmt = this.db.prepare(`
      INSERT INTO inventario_baterias (
        codigo_patrimonial, nombre, editorial, area_evaluada,
        piezas_detalle, ubicacion, imagen_url, documento_referencia_url,
        estado_conservacion, estado_disponibilidad,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    const result = stmt.run(
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
    );

    return this.getBatteryById(result.lastInsertRowid);
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
        sets.push(`${key} = ?`);
        params.push(data[key]);
      }
    }

    if (sets.length === 0) return this.getBatteryById(id);

    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    this.db.prepare(`UPDATE inventario_baterias SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getBatteryById(id);
  }

  _checkTherapistLoanStatusSync(therapistId) {
    // Regla de Negocio RN-06:
    // Un terapeuta entra en mora si tiene un préstamo ACTIVO cuya fecha_devolucion_estimada es anterior al momento actual
    const sql = `
      SELECT 
        p.*,
        b.codigo_patrimonial,
        b.nombre AS bateria_nombre,
        CASE 
          WHEN datetime(p.fecha_devolucion_estimada) < datetime('now') THEN 1 
          ELSE 0 
        END AS esta_vencido
      FROM prestamos_baterias p
      JOIN inventario_baterias b ON p.bateria_id = b.id
      WHERE p.terapeuta_id = ? AND p.estado IN ('ACTIVO', 'MORA')
      ORDER BY p.fecha_devolucion_estimada ASC
    `;

    const activeLoans = this.db.prepare(sql).all(therapistId);
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
    return this._checkTherapistLoanStatusSync(therapistId);
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

    const tx = this.db.transaction(() => {
      // 1. Verificar mora del terapeuta dentro del candado transaccional (RN-06)
      const therapistStatus = this._checkTherapistLoanStatusSync(terapeuta_id);
      if (therapistStatus.hasOverdueLoan) {
        throw AppError.forbidden(therapistStatus.reason);
      }

      // 2. Verificar existencia y disponibilidad real dentro de la transacción
      const battery = this.db.prepare(`
        SELECT id, nombre, estado_disponibilidad 
        FROM inventario_baterias 
        WHERE id = ?
      `).get(bateria_id);

      if (!battery) {
        throw AppError.notFound(`Batería con ID ${bateria_id} no encontrada.`);
      }
      if (battery.estado_disponibilidad !== 'DISPONIBLE') {
        throw AppError.conflict(`La prueba "${battery.nombre}" no está disponible actualmente (Estado: ${battery.estado_disponibilidad}).`);
      }

      // 3. Marcar batería como EN_CONSULTA de manera condicional e indivisible
      const updateRes = this.db.prepare(`
        UPDATE inventario_baterias 
        SET estado_disponibilidad = 'EN_CONSULTA', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND estado_disponibilidad = 'DISPONIBLE'
      `).run(bateria_id);

      if (updateRes.changes !== 1) {
        throw AppError.conflict(`La prueba "${battery.nombre}" acaba de ser asignada en una solicitud simultánea.`);
      }

      // 4. Registrar el préstamo
      const stmt = this.db.prepare(`
        INSERT INTO prestamos_baterias (
          bateria_id, terapeuta_id, ambiente_id, paciente_id,
          fecha_retiro, fecha_devolucion_estimada, estado,
          observaciones_entrega, entregado_por_usuario_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 'ACTIVO', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      const result = stmt.run(
        bateria_id,
        terapeuta_id,
        ambiente_id,
        paciente_id,
        returnEstimado,
        observaciones_entrega,
        entregado_por_usuario_id
      );

      return result.lastInsertRowid;
    });

    const loanId = tx.immediate();
    return this.getLoanById(loanId);
  }

  async returnLoan(loanId, returnData = {}) {
    const {
      observaciones_recepcion = null,
      estado_conservacion = null,
      recibido_por_usuario_id = null
    } = returnData;

    const tx = this.db.transaction(() => {
      const loan = this.db.prepare(`SELECT id, bateria_id, estado FROM prestamos_baterias WHERE id = ?`).get(loanId);
      if (!loan) {
        throw AppError.notFound(`Préstamo con ID ${loanId} no encontrado.`);
      }
      if (loan.estado === 'DEVUELTO') {
        throw AppError.conflict('Este material ya fue devuelto y registrado con anterioridad.');
      }

      // 1. Cerrar préstamo como DEVUELTO de forma condicional
      const updLoan = this.db.prepare(`
        UPDATE prestamos_baterias 
        SET 
          estado = 'DEVUELTO',
          fecha_devolucion_real = CURRENT_TIMESTAMP,
          observaciones_recepcion = ?,
          recibido_por_usuario_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND estado != 'DEVUELTO'
      `).run(observaciones_recepcion, recibido_por_usuario_id, loanId);

      if (updLoan.changes !== 1) {
        throw AppError.conflict('Este material ya fue devuelto por otra solicitud simultánea.');
      }

      // 2. Liberar batería a DISPONIBLE (y actualizar estado de conservación si se indicó)
      if (estado_conservacion) {
        this.db.prepare(`
          UPDATE inventario_baterias 
          SET estado_disponibilidad = 'DISPONIBLE', estado_conservacion = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(estado_conservacion, loan.bateria_id);
      } else {
        this.db.prepare(`
          UPDATE inventario_baterias 
          SET estado_disponibilidad = 'DISPONIBLE', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(loan.bateria_id);
      }
    });

    tx.immediate();
    return this.getLoanById(loanId);
  }

  async getLoanById(id) {
    const sql = `
      SELECT 
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
      WHERE p.id = ?
    `;
    return this.db.prepare(sql).get(id) || null;
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
      sql += ` AND p.terapeuta_id = ?`;
      params.push(filters.terapeutaId);
    }

    if (filters.bateriaId) {
      sql += ` AND p.bateria_id = ?`;
      params.push(filters.bateriaId);
    }

    if (filters.estado) {
      sql += ` AND p.estado = ?`;
      params.push(filters.estado);
    }

    sql += ` ORDER BY p.id DESC LIMIT 100`;
    return this.db.prepare(sql).all(...params);
  }
}
