import { IPatientRepository } from '../../domain/interfaces/IPatientRepository.js';
import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresPatientRepository extends IPatientRepository {
  async findById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT p.*,
              (t.nombres || ' ' || t.apellidos) AS terapeuta_nombre,
              t.activo AS terapeuta_activo,
              t.registro_profesional AS terapeuta_registro,
              esp.nombre AS terapeuta_especialidad,
              esp.color AS terapeuta_color,
              u_creador.nombre_completo AS creador_nombre,
              u_elim.nombre_completo AS eliminador_nombre
       FROM pacientes p
       LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
       LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
       LEFT JOIN usuarios u_creador ON p.creado_por_usuario_id = u_creador.id
       LEFT JOIN usuarios u_elim ON p.eliminado_por_usuario_id = u_elim.id
       WHERE p.id = $1`,
      [id]
    );
    const patient = rows[0];
    if (!patient) return null;

    patient.tutores = await this.getTutorsByPatientId(patient.id);
    patient.derivaciones = await this.getDerivationsByPatientId(patient.id);
    patient.hermanos = await this.getSiblings(patient.id);
    return patient;
  }

  async findByCode(codigoExpediente) {
    const { rows } = await PostgresConnection.query(
      `SELECT p.*,
              (t.nombres || ' ' || t.apellidos) AS terapeuta_nombre,
              t.activo AS terapeuta_activo,
              t.registro_profesional AS terapeuta_registro,
              esp.nombre AS terapeuta_especialidad,
              esp.color AS terapeuta_color,
              u_creador.nombre_completo AS creador_nombre,
              u_elim.nombre_completo AS eliminador_nombre
       FROM pacientes p
       LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
       LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
       LEFT JOIN usuarios u_creador ON p.creado_por_usuario_id = u_creador.id
       LEFT JOIN usuarios u_elim ON p.eliminado_por_usuario_id = u_elim.id
       WHERE LOWER(p.codigo_expediente) = LOWER($1)`,
      [String(codigoExpediente || '').trim()]
    );
    const patient = rows[0];
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
             (t.nombres || ' ' || t.apellidos) AS terapeuta_nombre
      FROM pacientes p
      LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
      WHERE UPPER(REPLACE(p.ci, ' ', '')) = UPPER(REPLACE($1, ' ', ''))
    `;
    const params = [cleanCi];
    if (excludeId) {
      params.push(excludeId);
      query += ` AND p.id != $${params.length}`;
    }
    const { rows } = await PostgresConnection.query(query, params);
    return rows[0] || null;
  }

  async getTherapistByUserId(userId) {
    if (!userId) return null;
    const { rows } = await PostgresConnection.query(
      `SELECT t.*, (t.nombres || ' ' || t.apellidos) AS nombre_completo,
              esp.nombre AS especialidad_nombre
       FROM terapeutas t
       LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
       WHERE t.usuario_id = $1`,
      [userId]
    );
    return rows[0] || null;
  }

  async getPatientAccessSnapshot(pacienteId) {
    const { rows } = await PostgresConnection.query(
      `SELECT id, terapeuta_id, creado_por_usuario_id
       FROM pacientes
       WHERE id = $1`,
      [pacienteId]
    );
    return rows[0] || null;
  }

  async hasActiveDerivation(pacienteId, therapistId) {
    const { rows } = await PostgresConnection.query(
      `SELECT 1
       FROM derivaciones_pacientes
       WHERE paciente_id = $1
         AND estado = 'ACTIVA'
         AND (terapeuta_destino_id = $2 OR terapeuta_origen_id = $2)
       LIMIT 1`,
      [pacienteId, therapistId]
    );
    return rows.length > 0;
  }

  async hasTutorLink(pacienteId, tutorId) {
    const { rows } = await PostgresConnection.query(
      `SELECT 1
       FROM paciente_tutor
       WHERE paciente_id = $1 AND tutor_id = $2
       LIMIT 1`,
      [pacienteId, tutorId]
    );
    return rows.length > 0;
  }

  async findAll(filters = {}) {
    let query = `
      SELECT p.*,
             (t.nombres || ' ' || t.apellidos) AS terapeuta_nombre,
             t.activo AS terapeuta_activo,
             t.registro_profesional AS terapeuta_registro,
             esp.nombre AS especialidad_nombre,
             esp.color AS especialidad_color,
             u_creador.nombre_completo AS creador_nombre,
             u_elim.nombre_completo AS eliminador_nombre,
             (SELECT COUNT(*)::int FROM derivaciones_pacientes dp WHERE dp.paciente_id = p.id AND dp.estado = 'ACTIVA') AS total_derivaciones_activas,
             (SELECT (to_ter.nombres || ' ' || to_ter.apellidos)
              FROM derivaciones_pacientes dp
              JOIN terapeutas to_ter ON dp.terapeuta_origen_id = to_ter.id
              WHERE dp.paciente_id = p.id AND dp.estado = 'ACTIVA'
              ORDER BY dp.id DESC LIMIT 1) AS derivado_por_nombre,
             (SELECT dp.motivo
              FROM derivaciones_pacientes dp
              WHERE dp.paciente_id = p.id AND dp.estado = 'ACTIVA'
              ORDER BY dp.id DESC LIMIT 1) AS ultima_derivacion_motivo
      FROM pacientes p
      LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      LEFT JOIN usuarios u_creador ON p.creado_por_usuario_id = u_creador.id
      LEFT JOIN usuarios u_elim ON p.eliminado_por_usuario_id = u_elim.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.solo_archivados) {
      query += ` AND p.activo = 0`;
    } else if (filters.activo !== undefined) {
      params.push(filters.activo ? 1 : 0);
      query += ` AND p.activo = $${params.length}`;
    } else {
      query += ` AND p.activo = 1`;
    }

    if (filters.estado_clinico) {
      params.push(filters.estado_clinico);
      query += ` AND p.estado_clinico = $${params.length}`;
    }

    if (Array.isArray(filters.ids) && filters.ids.length > 0) {
      params.push(filters.ids);
      query += ` AND p.id = ANY($${params.length}::int[])`;
    }

    if (filters.terapeuta_id) {
      if (filters.solo_derivados) {
        params.push(filters.terapeuta_id);
        const pT = `$${params.length}`;
        query += ` AND p.id IN (
          SELECT paciente_id FROM derivaciones_pacientes
          WHERE (terapeuta_destino_id = ${pT} OR terapeuta_origen_id = ${pT}) AND estado = 'ACTIVA'
        )`;
      } else if (filters.solo_directos) {
        params.push(filters.terapeuta_id, filters.usuario_id || 0);
        query += ` AND (p.terapeuta_id = $${params.length - 1} OR p.creado_por_usuario_id = $${params.length})`;
      } else {
        params.push(filters.terapeuta_id, filters.usuario_id || 0);
        const pT = `$${params.length - 1}`;
        const pU = `$${params.length}`;
        query += ` AND (
          p.terapeuta_id = ${pT}
          OR p.creado_por_usuario_id = ${pU}
          OR p.id IN (
            SELECT paciente_id FROM derivaciones_pacientes
            WHERE (terapeuta_destino_id = ${pT} OR terapeuta_origen_id = ${pT}) AND estado = 'ACTIVA'
          )
        )`;
      }
    } else if (filters.filtrar_por_terapeuta_especifico) {
      params.push(filters.filtrar_por_terapeuta_especifico);
      query += ` AND p.terapeuta_id = $${params.length}`;
    }

    query += ` ORDER BY p.codigo_expediente DESC`;

    const { rows: patients } = await PostgresConnection.query(query, params);
    for (const p of patients) {
      p.tutores = await this.getTutorsByPatientId(p.id);
    }

    return patients;
  }

  async search(queryText, filters = {}, limit = 30) {
    const term = `%${queryText.trim()}%`;
    const params = [term];
    let query = `
      SELECT p.*,
             (t.nombres || ' ' || t.apellidos) AS terapeuta_nombre,
             t.activo AS terapeuta_activo,
             t.registro_profesional AS terapeuta_registro,
             esp.nombre AS especialidad_nombre,
             esp.color AS especialidad_color,
             u_creador.nombre_completo AS creador_nombre,
             u_elim.nombre_completo AS eliminador_nombre,
             (SELECT (to_ter.nombres || ' ' || to_ter.apellidos)
              FROM derivaciones_pacientes dp
              JOIN terapeutas to_ter ON dp.terapeuta_origen_id = to_ter.id
              WHERE dp.paciente_id = p.id AND dp.estado = 'ACTIVA'
              ORDER BY dp.id DESC LIMIT 1) AS derivado_por_nombre
      FROM pacientes p
      LEFT JOIN terapeutas t ON p.terapeuta_id = t.id
      LEFT JOIN especialidades esp ON t.especialidad_id = esp.id
      LEFT JOIN usuarios u_creador ON p.creado_por_usuario_id = u_creador.id
      LEFT JOIN usuarios u_elim ON p.eliminado_por_usuario_id = u_elim.id
      WHERE (p.codigo_expediente ILIKE $1
         OR p.nombres ILIKE $1
         OR p.apellidos ILIKE $1
         OR (p.nombres || ' ' || p.apellidos) ILIKE $1
         OR p.ci ILIKE $1)
    `;

    if (filters.solo_archivados) {
      query += ` AND p.activo = 0`;
    } else {
      query += ` AND p.activo = 1`;
    }

    if (filters.terapeuta_id) {
      params.push(filters.terapeuta_id, filters.usuario_id || 0);
      const pT = `$${params.length - 1}`;
      const pU = `$${params.length}`;
      query += ` AND (
        p.terapeuta_id = ${pT}
        OR p.creado_por_usuario_id = ${pU}
        OR p.id IN (
          SELECT paciente_id FROM derivaciones_pacientes
          WHERE (terapeuta_destino_id = ${pT} OR terapeuta_origen_id = ${pT}) AND estado = 'ACTIVA'
        )
      )`;
    }

    if (Array.isArray(filters.ids) && filters.ids.length > 0) {
      params.push(filters.ids);
      query += ` AND p.id = ANY($${params.length}::int[])`;
    }

    params.push(limit);
    query += ` ORDER BY p.codigo_expediente DESC LIMIT $${params.length}`;

    const { rows: patients } = await PostgresConnection.query(query, params);
    for (const p of patients) {
      p.tutores = await this.getTutorsByPatientId(p.id);
    }
    return patients;
  }

  async getNextCorrelativeCode() {
    const { rows } = await PostgresConnection.query(
      `SELECT codigo_expediente
       FROM pacientes
       ORDER BY id DESC
       LIMIT 1`
    );
    const last = rows[0];

    let nextNumber = 1;
    if (last && last.codigo_expediente) {
      const match = last.codigo_expediente.match(/PSI-A-(\d+)/);
      if (match && match[1]) {
        nextNumber = parseInt(match[1], 10) + 1;
      } else {
        const totalRes = await PostgresConnection.query('SELECT COUNT(*)::int AS count FROM pacientes');
        nextNumber = totalRes.rows[0].count + 1;
      }
    }

    const paddedNumber = String(nextNumber).padStart(4, '0');
    return `PSI-A-${paddedNumber}`;
  }

  async create(patientData) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO pacientes (
         codigo_expediente, nombres, apellidos, ci, fecha_nacimiento,
         sexo, colegio_ocupacion, antecedentes_medicos, antecedentes_perinatales,
         medicacion_actual, estado_clinico, activo,
         creado_por_usuario_id, terapeuta_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
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
      ]
    );

    const newId = rows[0].id;

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
        params.push(patientData[key]);
        fields.push(`${key} = $${params.length}`);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await PostgresConnection.query(
      `UPDATE pacientes SET ${fields.join(', ')} WHERE id = $${params.length}`,
      params
    );

    return this.findById(id);
  }

  async deleteLogical(id, usuarioId = null, motivoBaja = 'Baja solicitada') {
    await PostgresConnection.query(
      `UPDATE pacientes
       SET activo = 0,
           eliminado_por_usuario_id = $1,
           fecha_eliminacion = CURRENT_TIMESTAMP,
           motivo_baja = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [usuarioId, motivoBaja, id]
    );
    return true;
  }

  async restore(id) {
    await PostgresConnection.query(
      `UPDATE pacientes
       SET activo = 1,
           eliminado_por_usuario_id = NULL,
           fecha_eliminacion = NULL,
           motivo_baja = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
    return true;
  }

  async createDerivation(data) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO derivaciones_pacientes (
         paciente_id, terapeuta_origen_id, terapeuta_destino_id,
         usuario_responsable_id, motivo, notas, estado
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        data.paciente_id,
        data.terapeuta_origen_id || null,
        data.terapeuta_destino_id,
        data.usuario_responsable_id || null,
        data.motivo.trim(),
        data.notas ? data.notas.trim() : null,
        data.estado || 'ACTIVA'
      ]
    );

    return rows[0].id;
  }

  async getDerivationsByPatientId(pacienteId) {
    const { rows } = await PostgresConnection.query(
      `SELECT dp.*,
              (tor.nombres || ' ' || tor.apellidos) AS terapeuta_origen_nombre,
              espor.nombre AS especialidad_origen,
              (tde.nombres || ' ' || tde.apellidos) AS terapeuta_destino_nombre,
              espde.nombre AS especialidad_destino,
              u.nombre_completo AS responsable_nombre
       FROM derivaciones_pacientes dp
       LEFT JOIN terapeutas tor ON dp.terapeuta_origen_id = tor.id
       LEFT JOIN especialidades espor ON tor.especialidad_id = espor.id
       LEFT JOIN terapeutas tde ON dp.terapeuta_destino_id = tde.id
       LEFT JOIN especialidades espde ON tde.especialidad_id = espde.id
       LEFT JOIN usuarios u ON dp.usuario_responsable_id = u.id
       WHERE dp.paciente_id = $1
       ORDER BY dp.fecha_derivacion DESC, dp.id DESC`,
      [pacienteId]
    );
    return rows;
  }

  async getTutorsByPatientId(patientId) {
    const { rows } = await PostgresConnection.query(
      `SELECT t.*, pt.parentesco AS parentesco_vinculo, pt.es_principal, u.email AS usuario_email
       FROM tutores t
       JOIN paciente_tutor pt ON t.id = pt.tutor_id
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE pt.paciente_id = $1 AND t.activo = 1
       ORDER BY pt.es_principal DESC, t.nombres ASC`,
      [patientId]
    );
    return rows;
  }

  async linkTutor(patientId, tutorId, parentesco = 'TUTOR', esPrincipal = 1) {
    await PostgresConnection.transaction(async (client) => {
      if (esPrincipal) {
        await client.query(
          `UPDATE paciente_tutor SET es_principal = 0 WHERE paciente_id = $1`,
          [patientId]
        );
      }

      await client.query(
        `INSERT INTO paciente_tutor (paciente_id, tutor_id, parentesco, es_principal)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (paciente_id, tutor_id) DO UPDATE SET
           parentesco = EXCLUDED.parentesco,
           es_principal = EXCLUDED.es_principal`,
        [patientId, tutorId, parentesco, esPrincipal ? 1 : 0]
      );
    });
    return true;
  }

  async unlinkTutor(patientId, tutorId) {
    await PostgresConnection.query(
      `DELETE FROM paciente_tutor WHERE paciente_id = $1 AND tutor_id = $2`,
      [patientId, tutorId]
    );
    return true;
  }

  async getSiblings(patientId) {
    const { rows } = await PostgresConnection.query(
      `SELECT DISTINCT p.id, p.codigo_expediente, p.nombres, p.apellidos,
                       p.fecha_nacimiento, p.sexo, p.estado_clinico
       FROM pacientes p
       JOIN paciente_tutor pt ON p.id = pt.paciente_id
       WHERE pt.tutor_id IN (
         SELECT tutor_id FROM paciente_tutor WHERE paciente_id = $1
       )
       AND p.id != $1
       AND p.activo = 1`,
      [patientId]
    );
    return rows;
  }
}
