import { ITutorRepository } from '../../domain/interfaces/ITutorRepository.js';
import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqliteTutorRepository extends ITutorRepository {
  constructor(db = DatabaseConnection.getInstance()) {
    super();
    this.db = db;
  }

  async findById(id) {
    const stmt = this.db.prepare(`
      SELECT t.*, u.email as usuario_email
      FROM tutores t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.id = ?
    `);
    const tutor = stmt.get(id);
    if (!tutor) return null;

    tutor.pacientes = await this.getPatientsByTutorId(tutor.id);
    return tutor;
  }

  async findByCi(ci) {
    const stmt = this.db.prepare(`
      SELECT t.*
      FROM tutores t
      WHERE t.ci = ? COLLATE NOCASE
    `);
    return stmt.get(ci.trim()) || null;
  }

  async findAll(includeInactive = false) {
    let query = `
      SELECT t.*, u.email as usuario_email
      FROM tutores t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE 1=1
    `;
    if (!includeInactive) {
      query += ` AND t.activo = 1`;
    }
    query += ` ORDER BY t.nombres ASC`;

    const list = this.db.prepare(query).all();
    for (const t of list) {
      t.pacientes = await this.getPatientsByTutorId(t.id);
    }
    return list;
  }

  async findByEmail(email) {
    if (!email) return null;
    const stmt = this.db.prepare(`
      SELECT t.*, u.email as usuario_email
      FROM tutores t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE LOWER(t.email) = LOWER(?) OR LOWER(u.email) = LOWER(?)
    `);
    const tutor = stmt.get(email.trim(), email.trim());
    if (!tutor) return null;
    tutor.pacientes = await this.getPatientsByTutorId(tutor.id);
    return tutor;
  }

  async findByUserId(userId) {
    if (!userId) return null;
    const stmt = this.db.prepare(`
      SELECT t.*, u.email as usuario_email
      FROM tutores t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.usuario_id = ?
    `);
    const tutor = stmt.get(userId);
    if (!tutor) return null;
    tutor.pacientes = await this.getPatientsByTutorId(tutor.id);
    return tutor;
  }

  async search(queryText, limit = 15) {
    const term = `%${queryText.trim()}%`;
    const stmt = this.db.prepare(`
      SELECT t.*, u.email as usuario_email
      FROM tutores t
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE (t.nombres LIKE ? 
         OR t.apellidos LIKE ? 
         OR (t.nombres || ' ' || t.apellidos) LIKE ?
         OR t.ci LIKE ? 
         OR t.whatsapp LIKE ?
         OR t.email LIKE ?
         OR u.email LIKE ?)
        AND t.activo = 1
      ORDER BY t.nombres ASC
      LIMIT ?
    `);
    const results = stmt.all(term, term, term, term, term, term, term, limit);
    for (const t of results) {
      t.pacientes = await this.getPatientsByTutorId(t.id);
    }
    return results;
  }

  async create(tutorData) {
    const stmt = this.db.prepare(`
      INSERT INTO tutores (
        usuario_id, nombres, apellidos, ci, parentesco, 
        ocupacion, whatsapp, telefono_emergencia, direccion, email, activo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
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
    );

    return this.findById(info.lastInsertRowid);
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
        fields.push(`${key} = ?`);
        params.push(tutorData[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const query = `UPDATE tutores SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(query).run(...params);

    return this.findById(id);
  }

  async getPatientsByTutorId(tutorId) {
    const stmt = this.db.prepare(`
      SELECT p.id, p.codigo_expediente, p.nombres, p.apellidos, 
             p.fecha_nacimiento, p.sexo, p.estado_clinico,
             pt.parentesco, pt.es_principal
      FROM pacientes p
      JOIN paciente_tutor pt ON p.id = pt.paciente_id
      WHERE pt.tutor_id = ? AND p.activo = 1
      ORDER BY p.nombres ASC
    `);
    return stmt.all(tutorId);
  }

  async findByPatientId(patientId) {
    const stmt = this.db.prepare(`
      SELECT t.*, pt.parentesco as parentesco_vinculo, pt.es_principal, u.email as usuario_email
      FROM tutores t
      JOIN paciente_tutor pt ON t.id = pt.tutor_id
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE pt.paciente_id = ? AND t.activo = 1
      ORDER BY pt.es_principal DESC, t.id ASC
    `);
    return stmt.all(patientId);
  }
}
