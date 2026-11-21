import { PostgresConnection } from '../../core/PostgresConnection.js';
import { IConsentRepository } from '../../domain/interfaces/IConsentRepository.js';

export class PostgresConsentRepository extends IConsentRepository {
  async createConsent(data) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO consentimientos_informados (
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
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, $12, $13)
       RETURNING id`,
      [
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
      ]
    );

    return this.findById(rows[0].id);
  }

  async findById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
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
       WHERE ci.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async findByPatientId(patientId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
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
       WHERE ci.paciente_id = $1
       ORDER BY ci.fecha_firma DESC, ci.id DESC`,
      [patientId]
    );
    return rows;
  }

  async findByTutorId(tutorId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
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
       WHERE ci.tutor_id = $1
       ORDER BY ci.fecha_firma DESC`,
      [tutorId]
    );
    return rows;
  }

  async hasActiveConsent(patientId, tipoConsentimiento = null) {
    let sql = `
      SELECT COUNT(*)::int AS total
      FROM consentimientos_informados
      WHERE paciente_id = $1 AND estado = 'FIRMADO'
    `;
    const params = [patientId];

    if (tipoConsentimiento) {
      params.push(tipoConsentimiento);
      sql += ` AND tipo_consentimiento = $${params.length}`;
    }

    const { rows } = await PostgresConnection.query(sql, params);
    return rows[0] ? rows[0].total > 0 : false;
  }

  async revokeConsent(id, motivo, userId) {
    await PostgresConnection.query(
      `UPDATE consentimientos_informados
       SET estado = 'REVOCADO',
           motivo_revocacion = $1
       WHERE id = $2`,
      [motivo, id]
    );
    return this.findById(id);
  }
}
