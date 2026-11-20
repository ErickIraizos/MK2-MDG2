import { DatabaseConnection } from '../../core/DatabaseConnection.js';
import { ITriageRepository } from '../../domain/interfaces/ITriageRepository.js';

export class SqliteTriageRepository extends ITriageRepository {
  constructor() {
    super();
    this.db = DatabaseConnection.getInstance();
  }

  async create(data) {
    const stmt = this.db.prepare(`
      INSERT INTO triajes_clinicos (
        sesion_id,
        usuario_id,
        motivo_consulta,
        motivo_anonimizado,
        area_sugerida,
        nivel_urgencia,
        motivo_sintetizado,
        preguntas_orientadoras,
        recomendacion_accion,
        es_crisis,
        motor_utilizado,
        ip_origen
      ) VALUES (
        @sesion_id,
        @usuario_id,
        @motivo_consulta,
        @motivo_anonimizado,
        @area_sugerida,
        @nivel_urgencia,
        @motivo_sintetizado,
        @preguntas_orientadoras,
        @recomendacion_accion,
        @es_crisis,
        @motor_utilizado,
        @ip_origen
      )
    `);

    const info = stmt.run({
      sesion_id: data.sesionId || null,
      usuario_id: data.usuarioId || null,
      motivo_consulta: data.motivoConsulta,
      motivo_anonimizado: data.motivoAnonimizado || null,
      area_sugerida: data.areaSugerida || 'Orientación Institucional',
      nivel_urgencia: data.nivelUrgencia || 'Baja',
      motivo_sintetizado: data.motivoSintetizado || null,
      preguntas_orientadoras: Array.isArray(data.preguntasOrientadoras) 
        ? JSON.stringify(data.preguntasOrientadoras) 
        : (data.preguntasOrientadoras || null),
      recomendacion_accion: data.recomendacionAccion || null,
      es_crisis: data.esCrisis ? 1 : 0,
      motor_utilizado: data.motorUtilizado || 'FALLBACK_HEURISTICO_OFFLINE',
      ip_origen: data.ipOrigen || null
    });

    return this.findById(info.lastInsertRowid);
  }

  async findById(id) {
    const row = this.db.prepare(`
      SELECT 
        t.*,
        u.nombre_completo AS usuario_nombre,
        u.email AS usuario_email
      FROM triajes_clinicos t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.id = ?
    `).get(id);

    if (!row) return null;
    return this._formatRow(row);
  }

  async findAll(options = {}) {
    const { limit = 50, offset = 0, esCrisis = null, area = null } = options;
    const conditions = [];
    const params = [];

    if (esCrisis !== null) {
      conditions.push('t.es_crisis = ?');
      params.push(esCrisis ? 1 : 0);
    }

    if (area) {
      conditions.push('t.area_sugerida LIKE ?');
      params.push(`%${area}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = this.db.prepare(`
      SELECT COUNT(*) AS total FROM triajes_clinicos t ${whereClause}
    `);
    const total = countStmt.get(...params).total;

    const queryStmt = this.db.prepare(`
      SELECT 
        t.*,
        u.nombre_completo AS usuario_nombre,
        u.email AS usuario_email
      FROM triajes_clinicos t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = queryStmt.all(...params, limit, offset);
    return {
      total,
      triajes: rows.map(r => this._formatRow(r))
    };
  }

  async getMetrics() {
    const total = this.db.prepare('SELECT COUNT(*) AS count FROM triajes_clinicos').get().count;
    const crisis = this.db.prepare('SELECT COUNT(*) AS count FROM triajes_clinicos WHERE es_crisis = 1').get().count;
    
    const byArea = this.db.prepare(`
      SELECT area_sugerida AS area, COUNT(*) AS count
      FROM triajes_clinicos
      GROUP BY area_sugerida
      ORDER BY count DESC
    `).all();

    const byMotor = this.db.prepare(`
      SELECT motor_utilizado AS motor, COUNT(*) AS count
      FROM triajes_clinicos
      GROUP BY motor_utilizado
    `).all();

    return {
      total,
      crisis,
      porArea: byArea,
      porMotor: byMotor
    };
  }

  _formatRow(row) {
    let preguntas = [];
    if (row.preguntas_orientadoras) {
      try {
        preguntas = JSON.parse(row.preguntas_orientadoras);
      } catch (e) {
        preguntas = [row.preguntas_orientadoras];
      }
    }

    return {
      id: row.id,
      sesionId: row.sesion_id,
      usuarioId: row.usuario_id,
      usuarioNombre: row.usuario_nombre,
      usuarioEmail: row.usuario_email,
      motivoConsulta: row.motivo_consulta,
      motivoAnonimizado: row.motivo_anonimizado,
      areaSugerida: row.area_sugerida,
      nivelUrgencia: row.nivel_urgencia,
      motivoSintetizado: row.motivo_sintetizado,
      preguntasOrientadoras: preguntas,
      recomendacionAccion: row.recomendacion_accion,
      esCrisis: Boolean(row.es_crisis),
      motorUtilizado: row.motor_utilizado,
      ipOrigen: row.ip_origen,
      createdAt: row.created_at
    };
  }
}

