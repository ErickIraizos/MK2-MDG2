import { DatabaseConnection } from '../../core/DatabaseConnection.js';
import { IConsentRepository } from '../../domain/interfaces/IConsentRepository.js';

export class SqliteConsentRepository extends IConsentRepository {
  constructor() {
    super();
    this.db = DatabaseConnection.getInstance();
    this._ensureSchema();
  }

  _ensureSchema() {
    try {
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS consentimientos_informados (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          paciente_id INTEGER NOT NULL,
          tutor_id INTEGER NOT NULL,
          tipo_consentimiento TEXT NOT NULL CHECK (tipo_consentimiento IN (
            'EVALUACION_INICIAL',
            'TRATAMIENTO_CONTINUO',
            'INTERVENCION_NEUROCOGNITIVA',
            'TELEPSICOLOGIA',
            'APLICACION_PRUEBAS'
          )),
          titulo TEXT NOT NULL,
          contenido_clausulas TEXT NOT NULL,
          firma_digital_blob TEXT NOT NULL,
          firmado_por_nombre TEXT NOT NULL,
          firmado_por_ci TEXT NOT NULL,
          parentesco TEXT NOT NULL,
          ip_registro TEXT,
          user_agent TEXT,
          fecha_firma DATETIME DEFAULT CURRENT_TIMESTAMP,
          estado TEXT DEFAULT 'FIRMADO' CHECK (estado IN ('PENDIENTE', 'FIRMADO', 'REVOCADO')),
          motivo_revocacion TEXT,
          creado_por_usuario_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
          FOREIGN KEY (tutor_id) REFERENCES tutores(id) ON DELETE RESTRICT,
          FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
        )
      `).run();
    } catch (e) {
      console.warn('[SqliteConsentRepository] Nota de esquema:', e.message);
    }
  }

  async createConsent(data) {
    const stmt = this.db.prepare(`
      INSERT INTO consentimientos_informados (
        paciente_id,
        tutor_id,
        tipo_consentimiento,
        titulo,
        contenido_clausulas,
        firma_digital_blob,
        firmado_por_nombre,
        firmado_por_ci,
        parentesco,
        ip_registro,
        user_agent,
        fecha_firma,
        estado,
        creado_por_usuario_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
    `);

    const result = stmt.run(
      data.paciente_id,
      data.tutor_id,
      data.tipo_consentimiento || 'EVALUACION_INICIAL',
      data.titulo,
      data.contenido_clausulas,
      data.firma_digital_blob,
      data.firmado_por_nombre,
      data.firmado_por_ci,
      data.parentesco || 'TUTOR_LEGAL',
      data.ip_registro || '127.0.0.1',
      data.user_agent || 'Client PWA',
      data.estado || 'FIRMADO',
      data.creado_por_usuario_id || null
    );

    return this.findById(result.lastInsertRowid);
  }

  async findById(id) {
    const stmt = this.db.prepare(`
      SELECT 
        ci.*,
        p.codigo_expediente AS paciente_codigo,
        p.nombres AS paciente_nombres,
        p.apellidos AS paciente_apellidos,
        p.ci AS paciente_ci,
        p.fecha_nacimiento AS paciente_fecha_nacimiento,
        t.nombres AS tutor_nombres,
        t.apellidos AS tutor_apellidos,
        t.ci AS tutor_ci_oficial,
        t.whatsapp AS tutor_whatsapp,
        t.parentesco AS tutor_parentesco_oficial,
        ter.nombres AS terapeuta_nombres,
        ter.apellidos AS terapeuta_apellidos,
        ter.registro_profesional AS terapeuta_registro,
        esp.nombre AS terapeuta_especialidad,
        u.nombre_completo AS creado_por_nombre
      FROM consentimientos_informados ci
      JOIN pacientes p ON ci.paciente_id = p.id
      LEFT JOIN tutores t ON ci.tutor_id = t.id
      LEFT JOIN terapeutas ter ON p.terapeuta_id = ter.id
      LEFT JOIN especialidades esp ON ter.especialidad_id = esp.id
      LEFT JOIN usuarios u ON ci.creado_por_usuario_id = u.id
      WHERE ci.id = ?
    `);

    return stmt.get(id) || null;
  }

  async findByPatientId(patientId) {
    const stmt = this.db.prepare(`
      SELECT 
        ci.*,
        p.codigo_expediente AS paciente_codigo,
        p.nombres AS paciente_nombres,
        p.apellidos AS paciente_apellidos,
        t.nombres AS tutor_nombres,
        t.apellidos AS tutor_apellidos,
        t.ci AS tutor_ci_oficial,
        ter.nombres AS terapeuta_nombres,
        ter.apellidos AS terapeuta_apellidos,
        ter.registro_profesional AS terapeuta_registro,
        esp.nombre AS terapeuta_especialidad,
        u.nombre_completo AS creado_por_nombre
      FROM consentimientos_informados ci
      JOIN pacientes p ON ci.paciente_id = p.id
      LEFT JOIN tutores t ON ci.tutor_id = t.id
      LEFT JOIN terapeutas ter ON p.terapeuta_id = ter.id
      LEFT JOIN especialidades esp ON ter.especialidad_id = esp.id
      LEFT JOIN usuarios u ON ci.creado_por_usuario_id = u.id
      WHERE ci.paciente_id = ?
      ORDER BY ci.fecha_firma DESC, ci.id DESC
    `);

    return stmt.all(patientId);
  }

  async findByTutorId(tutorId) {
    const stmt = this.db.prepare(`
      SELECT 
        ci.*,
        p.codigo_expediente AS paciente_codigo,
        p.nombres AS paciente_nombres,
        p.apellidos AS paciente_apellidos,
        ter.nombres AS terapeuta_nombres,
        ter.apellidos AS terapeuta_apellidos,
        ter.registro_profesional AS terapeuta_registro,
        esp.nombre AS terapeuta_especialidad
      FROM consentimientos_informados ci
      JOIN pacientes p ON ci.paciente_id = p.id
      LEFT JOIN tutores t ON ci.tutor_id = t.id
      LEFT JOIN terapeutas ter ON p.terapeuta_id = ter.id
      LEFT JOIN especialidades esp ON ter.especialidad_id = esp.id
      WHERE ci.tutor_id = ?
      ORDER BY ci.fecha_firma DESC
    `);

    return stmt.all(tutorId);
  }

  async hasActiveConsent(patientId, tipoConsentimiento = null) {
    let sql = `
      SELECT COUNT(*) AS total
      FROM consentimientos_informados
      WHERE paciente_id = ? AND estado = 'FIRMADO'
    `;
    const params = [patientId];

    if (tipoConsentimiento) {
      sql += ` AND tipo_consentimiento = ?`;
      params.push(tipoConsentimiento);
    }

    const row = this.db.prepare(sql).get(...params);
    return row ? row.total > 0 : false;
  }

  async revokeConsent(id, motivo, userId) {
    const stmt = this.db.prepare(`
      UPDATE consentimientos_informados
      SET estado = 'REVOCADO',
          motivo_revocacion = ?
      WHERE id = ?
    `);
    stmt.run(motivo, id);
    return this.findById(id);
  }
}
