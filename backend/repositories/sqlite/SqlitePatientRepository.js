import { IPatientRepository } from '../../domain/interfaces/IPatientRepository.js';
import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqlitePatientRepository extends IPatientRepository {
  constructor(db = DatabaseConnection.getInstance()) {
    super();
    this.db = db;
  }

  async findById(id) {
    const stmt = this.db.prepare(`
      SELECT p.*,
             (t.nombres || ' ' || t.apellidos) as terapeuta_nombre,
             t.activo as terapeuta_activo,
             t.registro_profesional as terapeuta_registro,
             esp.nombre as terapeuta_especialidad,
             esp.color as terapeuta_color,
             u_creador.nombre_completo as creador_nombre,
             u_elim.nombre_completo as eliminador_nombre
      FROM pacientes p
      LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      LEFT JOIN usuarios u_creador ON p.creado_por_usuario_id = u_creador.id
      LEFT JOIN usuarios u_elim ON p.eliminado_por_usuario_id = u_elim.id
      WHERE p.id = ?
    `);
    const patient = stmt.get(id);
    if (!patient) return null;

    patient.tutores = await this.getTutorsByPatientId(patient.id);
    patient.derivaciones = await this.getDerivationsByPatientId(patient.id);
    patient.hermanos = await this.getSiblings(patient.id);
    return patient;
  }

  async findByCode(codigoExpediente) {
    const stmt = this.db.prepare(`
      SELECT p.*,
             (t.nombres || ' ' || t.apellidos) as terapeuta_nombre,
             t.activo as terapeuta_activo,
             t.registro_profesional as terapeuta_registro,
             esp.nombre as terapeuta_especialidad,
             esp.color as terapeuta_color,
             u_creador.nombre_completo as creador_nombre,
             u_elim.nombre_completo as eliminador_nombre
      FROM pacientes p
      LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      LEFT JOIN usuarios u_creador ON p.creado_por_usuario_id = u_creador.id
      LEFT JOIN usuarios u_elim ON p.eliminado_por_usuario_id = u_elim.id
      WHERE p.codigo_expediente = ? COLLATE NOCASE
    `);
    const patient = stmt.get(codigoExpediente.trim());
    if (!patient) return null;

    patient.tutores = await this.getTutorsByPatientId(patient.id);
    patient.derivaciones = await this.getDerivationsByPatientId(patient.id);
    patient.hermanos = await this.getSiblings(patient.id);
    return patient;
  }

  async checkCiExists(ci, excludeId = null) {
    if (!ci) return null;
    const cleanCi = ci.trim().replace(/\s+/g, ' ');
    let query = `
      SELECT p.id, p.codigo_expediente, p.nombres, p.apellidos, p.ci, p.activo,
             (t.nombres || ' ' || t.apellidos) as terapeuta_nombre
      FROM pacientes p
      LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
      WHERE UPPER(REPLACE(p.ci, ' ', '')) = UPPER(REPLACE(?, ' ', ''))
    `;
    const params = [cleanCi];
    if (excludeId) {
      query += ` AND p.id != ?`;
      params.push(excludeId);
    }
    const stmt = this.db.prepare(query);
    return stmt.get(...params) || null;
  }

  async getTherapistByUserId(userId) {
    if (!userId) return null;
    const stmt = this.db.prepare(`
      SELECT t.*, (t.nombres || ' ' || t.apellidos) as nombre_completo,
             esp.nombre as especialidad_nombre
      FROM terapeutas t
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      WHERE t.usuario_id = ?
    `);
    return stmt.get(userId) || null;
  }

  async getPatientAccessSnapshot(pacienteId) {
    return this.db.prepare(`
      SELECT id, terapeuta_id, creado_por_usuario_id
      FROM pacientes
      WHERE id = ?
    `).get(pacienteId) || null;
  }

  async hasActiveDerivation(pacienteId, therapistId) {
    return Boolean(this.db.prepare(`
      SELECT 1 FROM derivaciones_pacientes
      WHERE paciente_id = ?
        AND estado = 'ACTIVA'
        AND (terapeuta_destino_id = ? OR terapeuta_origen_id = ?)
      LIMIT 1
    `).get(pacienteId, therapistId, therapistId));
  }

  async hasTutorLink(pacienteId, tutorId) {
    return Boolean(this.db.prepare(`
      SELECT 1 FROM paciente_tutor
      WHERE paciente_id = ? AND tutor_id = ?
      LIMIT 1
    `).get(pacienteId, tutorId));
  }

  async findAll(filters = {}) {
    let query = `
      SELECT p.*,
             (t.nombres || ' ' || t.apellidos) as terapeuta_nombre,
             t.activo as terapeuta_activo,
             t.registro_profesional as terapeuta_registro,
             esp.nombre as especialidad_nombre,
             esp.color as especialidad_color,
             u_creador.nombre_completo as creador_nombre,
             u_elim.nombre_completo as eliminador_nombre,
             (SELECT COUNT(*) FROM derivaciones_pacientes dp WHERE dp.paciente_id = p.id AND dp.estado = 'ACTIVA') as total_derivaciones_activas,
             (SELECT (to_ter.nombres || ' ' || to_ter.apellidos)
              FROM derivaciones_pacientes dp
              JOIN terapeutas to_ter ON dp.terapeuta_origen_id = to_ter.id
              WHERE dp.paciente_id = p.id AND dp.estado = 'ACTIVA'
              ORDER BY dp.id DESC LIMIT 1) as derivado_por_nombre,
             (SELECT dp.motivo
              FROM derivaciones_pacientes dp
              WHERE dp.paciente_id = p.id AND dp.estado = 'ACTIVA'
              ORDER BY dp.id DESC LIMIT 1) as ultima_derivacion_motivo
      FROM pacientes p
      LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      LEFT JOIN usuarios u_creador ON p.creado_por_usuario_id = u_creador.id
      LEFT JOIN usuarios u_elim ON p.eliminado_por_usuario_id = u_elim.id
      WHERE 1=1
    `;
    const params = [];

    // Manejo de estado activo / archivado
    if (filters.solo_archivados) {
      query += ` AND p.activo = 0`;
    } else if (filters.activo !== undefined) {
      query += ` AND p.activo = ?`;
      params.push(filters.activo ? 1 : 0);
    } else {
      query += ` AND p.activo = 1`; // Por defecto solo activos
    }

    if (filters.estado_clinico) {
      query += ` AND p.estado_clinico = ?`;
      params.push(filters.estado_clinico);
    }

    // Filtro por IDs específicos (útil para perfiles tutores o selecciones explícitas)
    if (Array.isArray(filters.ids) && filters.ids.length > 0) {
      const placeholders = filters.ids.map(() => '?').join(',');
      query += ` AND p.id IN (${placeholders})`;
      params.push(...filters.ids);
    }

    // Filtro por terapeuta (Regla de Confidencialidad RBAC)
    // Un terapeuta ve los pacientes: asignados a él, creados por él, o derivados a él
    if (filters.terapeuta_id) {
      if (filters.solo_derivados) {
        query += ` AND p.id IN (
          SELECT paciente_id FROM derivaciones_pacientes
          WHERE (terapeuta_destino_id = ? OR terapeuta_origen_id = ?) AND estado = 'ACTIVA'
        )`;
        params.push(filters.terapeuta_id, filters.terapeuta_id);
      } else if (filters.solo_directos) {
        query += ` AND (p.terapeuta_id = ? OR p.creado_por_usuario_id = ?)`;
        params.push(filters.terapeuta_id, filters.usuario_id || 0);
      } else {
        query += ` AND (
          p.terapeuta_id = ? 
          OR p.creado_por_usuario_id = ?
          OR p.id IN (
            SELECT paciente_id FROM derivaciones_pacientes 
            WHERE (terapeuta_destino_id = ? OR terapeuta_origen_id = ?) AND estado = 'ACTIVA'
          )
        )`;
        params.push(filters.terapeuta_id, filters.usuario_id || 0, filters.terapeuta_id, filters.terapeuta_id);
      }
    } else if (filters.filtrar_por_terapeuta_especifico) {
      // Usado por Admin para filtrar la lista por un especialista
      query += ` AND p.terapeuta_id = ?`;
      params.push(filters.filtrar_por_terapeuta_especifico);
    }

    query += ` ORDER BY p.codigo_expediente DESC`;

    const patients = this.db.prepare(query).all(...params);
    
    // Adjuntar tutores principales para visualización ágil en listados
    for (const p of patients) {
      p.tutores = await this.getTutorsByPatientId(p.id);
    }

    return patients;
  }

  async search(queryText, filters = {}, limit = 30) {
    const term = `%${queryText.trim()}%`;
    let query = `
      SELECT p.*,
             (t.nombres || ' ' || t.apellidos) as terapeuta_nombre,
             t.activo as terapeuta_activo,
             t.registro_profesional as terapeuta_registro,
             esp.nombre as especialidad_nombre,
             esp.color as especialidad_color,
             u_creador.nombre_completo as creador_nombre,
             u_elim.nombre_completo as eliminador_nombre,
             (SELECT (to_ter.nombres || ' ' || to_ter.apellidos)
              FROM derivaciones_pacientes dp
              JOIN terapeutas to_ter ON dp.terapeuta_origen_id = to_ter.id
              WHERE dp.paciente_id = p.id AND dp.estado = 'ACTIVA'
              ORDER BY dp.id DESC LIMIT 1) as derivado_por_nombre
      FROM pacientes p
      LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      LEFT JOIN usuarios u_creador ON p.creado_por_usuario_id = u_creador.id
      LEFT JOIN usuarios u_elim ON p.eliminado_por_usuario_id = u_elim.id
      WHERE (p.codigo_expediente LIKE ? 
         OR p.nombres LIKE ? 
         OR p.apellidos LIKE ? 
         OR (p.nombres || ' ' || p.apellidos) LIKE ?
         OR p.ci LIKE ?)
    `;
    const params = [term, term, term, term, term];

    if (filters.solo_archivados) {
      query += ` AND p.activo = 0`;
    } else {
      query += ` AND p.activo = 1`;
    }

    if (filters.terapeuta_id) {
      query += ` AND (
        p.terapeuta_id = ? 
        OR p.creado_por_usuario_id = ?
        OR p.id IN (
          SELECT paciente_id FROM derivaciones_pacientes 
          WHERE (terapeuta_destino_id = ? OR terapeuta_origen_id = ?) AND estado = 'ACTIVA'
        )
      )`;
      params.push(filters.terapeuta_id, filters.usuario_id || 0, filters.terapeuta_id, filters.terapeuta_id);
    }

    if (Array.isArray(filters.ids) && filters.ids.length > 0) {
      const placeholders = filters.ids.map(() => '?').join(',');
      query += ` AND p.id IN (${placeholders})`;
      params.push(...filters.ids);
    }

    query += ` ORDER BY p.codigo_expediente DESC LIMIT ?`;
    params.push(limit);

    const patients = this.db.prepare(query).all(...params);
    for (const p of patients) {
      p.tutores = await this.getTutorsByPatientId(p.id);
    }
    return patients;
  }

  async getNextCorrelativeCode() {
    const stmt = this.db.prepare(`
      SELECT codigo_expediente 
      FROM pacientes 
      ORDER BY id DESC 
      LIMIT 1
    `);
    const last = stmt.get();

    let nextNumber = 1;
    if (last && last.codigo_expediente) {
      const match = last.codigo_expediente.match(/PSI-A-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      } else {
        const total = this.db.prepare('SELECT count(*) as count FROM pacientes').get();
        nextNumber = total.count + 1;
      }
    }

    const paddedNumber = String(nextNumber).padStart(4, '0');
    return `PSI-A-${paddedNumber}`;
  }

  async create(patientData) {
    const stmt = this.db.prepare(`
      INSERT INTO pacientes (
        codigo_expediente, nombres, apellidos, ci, fecha_nacimiento,
        sexo, colegio_ocupacion, antecedentes_medicos, antecedentes_perinatales,
        medicacion_actual, estado_clinico, activo,
        creado_por_usuario_id, terapeuta_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      patientData.codigo_expediente.trim(),
      patientData.nombres.trim(),
      patientData.apellidos.trim(),
      patientData.ci.trim(),
      patientData.fecha_nacimiento,
      patientData.sexo,
      patientData.colegio_ocupacion ? patientData.colegio_ocupacion.trim() : null,
      patientData.antecedentes_medicos || null,
      patientData.antecedentes_perinatales || null,
      patientData.medicacion_actual || null,
      patientData.estado_clinico || 'ACTIVO',
      patientData.activo !== undefined ? (patientData.activo ? 1 : 0) : 1,
      patientData.creado_por_usuario_id || null,
      patientData.terapeuta_id || null
    );

    const newId = info.lastInsertRowid;

    // Si viene tutorId para vinculación automática
    if (patientData.tutor_id) {
      await this.linkTutor(
        newId, 
        patientData.tutor_id, 
        patientData.tutor_parentesco || 'TUTOR', 
        patientData.tutor_es_principal !== undefined ? (patientData.tutor_es_principal ? 1 : 0) : 1
      );
    }

    return this.findById(newId);
  }

  async update(id, patientData) {
    const fields = [];
    const params = [];

    const allowed = [
      'nombres', 'apellidos', 'ci', 'fecha_nacimiento', 'sexo',
      'colegio_ocupacion', 'antecedentes_medicos', 'antecedentes_perinatales',
      'medicacion_actual', 'estado_clinico', 'activo', 'terapeuta_id'
    ];

    for (const key of allowed) {
      if (patientData[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(patientData[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const query = `UPDATE pacientes SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(query).run(...params);

    return this.findById(id);
  }

  async deleteLogical(id, usuarioId = null, motivoBaja = 'Baja solicitada') {
    const stmt = this.db.prepare(`
      UPDATE pacientes 
      SET activo = 0, 
          eliminado_por_usuario_id = ?, 
          fecha_eliminacion = CURRENT_TIMESTAMP, 
          motivo_baja = ?, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(usuarioId, motivoBaja, id);
    return true;
  }

  async restore(id) {
    const stmt = this.db.prepare(`
      UPDATE pacientes 
      SET activo = 1, 
          eliminado_por_usuario_id = NULL, 
          fecha_eliminacion = NULL, 
          motivo_baja = NULL, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run(id);
    return true;
  }

  async createDerivation(data) {
    const stmt = this.db.prepare(`
      INSERT INTO derivaciones_pacientes (
        paciente_id, terapeuta_origen_id, terapeuta_destino_id,
        usuario_responsable_id, motivo, notas, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      data.paciente_id,
      data.terapeuta_origen_id || null,
      data.terapeuta_destino_id,
      data.usuario_responsable_id || null,
      data.motivo.trim(),
      data.notas ? data.notas.trim() : null,
      data.estado || 'ACTIVA'
    );

    return info.lastInsertRowid;
  }

  async getDerivationsByPatientId(pacienteId) {
    const stmt = this.db.prepare(`
      SELECT dp.*,
             (tor.nombres || ' ' || tor.apellidos) as terapeuta_origen_nombre,
             espor.nombre as especialidad_origen,
             (tde.nombres || ' ' || tde.apellidos) as terapeuta_destino_nombre,
             espde.nombre as especialidad_destino,
             u.nombre_completo as responsable_nombre
      FROM derivaciones_pacientes dp
      LEFT JOIN terapeutas tor ON dp.terapeuta_origen_id = tor.id
      LEFT JOIN especialidades espor ON tor.especialidad_id = espor.id
      LEFT JOIN terapeutas tde ON dp.terapeuta_destino_id = tde.id
      LEFT JOIN especialidades espde ON tde.especialidad_id = espde.id
      LEFT JOIN usuarios u ON dp.usuario_responsable_id = u.id
      WHERE dp.paciente_id = ?
      ORDER BY dp.fecha_derivacion DESC, dp.id DESC
    `);
    return stmt.all(pacienteId);
  }

  async getTutorsByPatientId(patientId) {
    const stmt = this.db.prepare(`
      SELECT t.*, pt.parentesco as parentesco_vinculo, pt.es_principal, u.email as usuario_email
      FROM tutores t
      JOIN paciente_tutor pt ON t.id = pt.tutor_id
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE pt.paciente_id = ? AND t.activo = 1
      ORDER BY pt.es_principal DESC, t.nombres ASC
    `);
    return stmt.all(patientId);
  }

  async linkTutor(patientId, tutorId, parentesco = 'TUTOR', esPrincipal = 1) {
    if (esPrincipal) {
      this.db.prepare(`
        UPDATE paciente_tutor 
        SET es_principal = 0 
        WHERE paciente_id = ?
      `).run(patientId);
    }

    const stmt = this.db.prepare(`
      INSERT INTO paciente_tutor (paciente_id, tutor_id, parentesco, es_principal)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(paciente_id, tutor_id) DO UPDATE SET
        parentesco = excluded.parentesco,
        es_principal = excluded.es_principal
    `);
    stmt.run(patientId, tutorId, parentesco, esPrincipal ? 1 : 0);
    return true;
  }

  async unlinkTutor(patientId, tutorId) {
    const stmt = this.db.prepare(`
      DELETE FROM paciente_tutor 
      WHERE paciente_id = ? AND tutor_id = ?
    `);
    stmt.run(patientId, tutorId);
    return true;
  }

  async getSiblings(patientId) {
    const stmt = this.db.prepare(`
      SELECT DISTINCT p.id, p.codigo_expediente, p.nombres, p.apellidos, 
                      p.fecha_nacimiento, p.sexo, p.estado_clinico
      FROM pacientes p
      JOIN paciente_tutor pt ON p.id = pt.paciente_id
      WHERE pt.tutor_id IN (
        SELECT tutor_id FROM paciente_tutor WHERE paciente_id = ?
      )
      AND p.id != ?
      AND p.activo = 1
    `);
    return stmt.all(patientId, patientId);
  }
}

