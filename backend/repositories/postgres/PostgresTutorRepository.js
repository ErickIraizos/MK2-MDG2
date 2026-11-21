import { ITutorRepository } from '../../domain/interfaces/ITutorRepository.js';
import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresTutorRepository extends ITutorRepository {
  async findById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT t.*, u.email AS usuario_email
       FROM tutores t
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE t.id = $1`,
      [id]
    );
    const tutor = rows[0];
    if (!tutor) return null;

    tutor.pacientes = await this.getPatientsByTutorId(tutor.id);
    return tutor;
  }

  async findByCi(ci) {
    const { rows } = await PostgresConnection.query(
      `SELECT t.*
       FROM tutores t
       WHERE LOWER(t.ci) = LOWER($1)`,
      [String(ci || '').trim()]
    );
    return rows[0] || null;
  }

  async findAll(includeInactive = false) {
    let query = `
      SELECT t.*, u.email AS usuario_email
      FROM tutores t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE 1=1
    `;
    if (!includeInactive) {
      query += ` AND t.activo = 1`;
    }
    query += ` ORDER BY t.nombres ASC`;

    const { rows: list } = await PostgresConnection.query(query);
    for (const t of list) {
      t.pacientes = await this.getPatientsByTutorId(t.id);
    }
    return list;
  }

  async findByEmail(email) {
    if (!email) return null;
    const clean = email.trim();
    const { rows } = await PostgresConnection.query(
      `SELECT t.*, u.email AS usuario_email
       FROM tutores t
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE LOWER(t.email) = LOWER($1) OR LOWER(u.email) = LOWER($1)`,
      [clean]
    );
    const tutor = rows[0];
    if (!tutor) return null;
    tutor.pacientes = await this.getPatientsByTutorId(tutor.id);
    return tutor;
  }

  async findByUserId(userId) {
    if (!userId) return null;
    const { rows } = await PostgresConnection.query(
      `SELECT t.*, u.email AS usuario_email
       FROM tutores t
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE t.usuario_id = $1`,
      [userId]
    );
    const tutor = rows[0];
    if (!tutor) return null;
    tutor.pacientes = await this.getPatientsByTutorId(tutor.id);
    return tutor;
  }

  async search(queryText, limit = 15) {
    const term = `%${queryText.trim()}%`;
    const { rows: results } = await PostgresConnection.query(
      `SELECT t.*, u.email AS usuario_email
       FROM tutores t
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE (t.nombres ILIKE $1
          OR t.apellidos ILIKE $1
          OR (t.nombres || ' ' || t.apellidos) ILIKE $1
          OR t.ci ILIKE $1
          OR t.whatsapp ILIKE $1
          OR t.email ILIKE $1
          OR u.email ILIKE $1)
         AND t.activo = 1
       ORDER BY t.nombres ASC
       LIMIT $2`,
      [term, limit]
    );
    for (const t of results) {
      t.pacientes = await this.getPatientsByTutorId(t.id);
    }
    return results;
  }

  async create(tutorData) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO tutores (
         usuario_id, nombres, apellidos, ci, parentesco,
         ocupacion, whatsapp, telefono_emergencia, direccion, email, activo
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        tutorData.usuario_id || null,
        tutorData.nombres.trim(),
        tutorData.apellidos.trim(),
        tutorData.ci ? tutorData.ci.trim() : null,
        tutorData.parentesco || 'MADRE',
        tutorData.ocupacion ? tutorData.ocupacion.trim() : null,
        tutorData.whatsapp.trim(),
        tutorData.telefono_emergencia ? tutorData.telefono_emergencia.trim() : null,
        tutorData.direccion ? tutorData.direccion.trim() : null,
        tutorData.email ? tutorData.email.trim() : null,
        tutorData.activo !== undefined ? (tutorData.activo ? 1 : 0) : 1
      ]
    );

    return this.findById(rows[0].id);
  }

  async update(id, tutorData) {
    const fields = [];
    const params = [];

    const allowed = [
      'usuario_id', 'nombres', 'apellidos', 'ci', 'parentesco', 'ocupacion',
      'whatsapp', 'telefono_emergencia', 'direccion', 'email', 'activo'
    ];

    for (const key of allowed) {
      if (tutorData[key] !== undefined) {
        params.push(tutorData[key]);
        fields.push(`${key} = $${params.length}`);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await PostgresConnection.query(
      `UPDATE tutores SET ${fields.join(', ')} WHERE id = $${params.length}`,
      params
    );

    return this.findById(id);
  }

  async getPatientsByTutorId(tutorId) {
    const { rows } = await PostgresConnection.query(
      `SELECT p.id, p.codigo_expediente, p.nombres, p.apellidos,
              p.fecha_nacimiento, p.sexo, p.estado_clinico,
              pt.parentesco, pt.es_principal
       FROM pacientes p
       JOIN paciente_tutor pt ON p.id = pt.paciente_id
       WHERE pt.tutor_id = $1 AND p.activo = 1
       ORDER BY p.nombres ASC`,
      [tutorId]
    );
    return rows;
  }

  async findByPatientId(patientId) {
    const { rows } = await PostgresConnection.query(
      `SELECT t.*, pt.parentesco AS parentesco_vinculo, pt.es_principal, u.email AS usuario_email
       FROM tutores t
       JOIN paciente_tutor pt ON t.id = pt.tutor_id
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE pt.paciente_id = $1 AND t.activo = 1
       ORDER BY pt.es_principal DESC, t.id ASC`,
      [patientId]
    );
    return rows;
  }
}
