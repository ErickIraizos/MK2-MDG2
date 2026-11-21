import { PostgresConnection } from '../../core/PostgresConnection.js';
import { ITriageRepository } from '../../domain/interfaces/ITriageRepository.js';

export class PostgresTriageRepository extends ITriageRepository {
  async create(data) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO triajes_clinicos (
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
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        data.sesionId || null,
        data.usuarioId || null,
        data.motivoConsulta,
        data.motivoAnonimizado || null,
        data.areaSugerida || 'Orientación Institucional',
        data.nivelUrgencia || 'Baja',
        data.motivoSintetizado || null,
        Array.isArray(data.preguntasOrientadoras)
          ? JSON.stringify(data.preguntasOrientadoras)
          : (data.preguntasOrientadoras || null),
        data.recomendacionAccion || null,
        data.esCrisis ? 1 : 0,
        data.motorUtilizado || 'FALLBACK_HEURISTICO_OFFLINE',
        data.ipOrigen || null
      ]
    );

    return this.findById(rows[0].id);
  }

  async findById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         t.*,
         u.nombre_completo AS usuario_nombre,
         u.email AS usuario_email
       FROM triajes_clinicos t
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE t.id = $1`,
      [id]
    );
    if (!rows[0]) return null;
    return this._formatRow(rows[0]);
  }

  async findAll(options = {}) {
    const { limit = 50, offset = 0, esCrisis = null, area = null } = options;
    const conditions = [];
    const params = [];

    if (esCrisis !== null) {
      params.push(esCrisis ? 1 : 0);
      conditions.push(`t.es_crisis = $${params.length}`);
    }

    if (area) {
      params.push(`%${area}%`);
      conditions.push(`t.area_sugerida ILIKE $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await PostgresConnection.query(
      `SELECT COUNT(*)::int AS total FROM triajes_clinicos t ${whereClause}`,
      params
    );
    const total = countRes.rows[0].total;

    const queryParams = [...params, limit, offset];
    const { rows } = await PostgresConnection.query(
      `SELECT
         t.*,
         u.nombre_completo AS usuario_nombre,
         u.email AS usuario_email
       FROM triajes_clinicos t
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      queryParams
    );

    return {
      total,
      triajes: rows.map(r => this._formatRow(r))
    };
  }

  async getMetrics() {
    const totalRes = await PostgresConnection.query('SELECT COUNT(*)::int AS count FROM triajes_clinicos');
    const crisisRes = await PostgresConnection.query('SELECT COUNT(*)::int AS count FROM triajes_clinicos WHERE es_crisis = 1');

    const byAreaRes = await PostgresConnection.query(
      `SELECT area_sugerida AS area, COUNT(*)::int AS count
       FROM triajes_clinicos
       GROUP BY area_sugerida
       ORDER BY count DESC`
    );

    const byMotorRes = await PostgresConnection.query(
      `SELECT motor_utilizado AS motor, COUNT(*)::int AS count
       FROM triajes_clinicos
       GROUP BY motor_utilizado`
    );

    return {
      total: totalRes.rows[0].count,
      crisis: crisisRes.rows[0].count,
      porArea: byAreaRes.rows,
      porMotor: byMotorRes.rows
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
