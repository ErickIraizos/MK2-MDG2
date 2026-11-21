import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresWhatsappRepository {
  async ensureDynamicSessions() {
    await PostgresConnection.query(`
      INSERT INTO whatsapp_sesiones (terapeuta_id, estado, telefono_vinculado)
      SELECT id, 'DESCONECTADO', telefono
      FROM terapeutas
      ON CONFLICT (terapeuta_id) DO NOTHING
    `);
  }

  async getAllSessionsWithTherapists() {
    const { rows } = await PostgresConnection.query(`
      SELECT
        ws.id,
        ws.terapeuta_id,
        ws.estado,
        ws.telefono_vinculado,
        ws.nombre_dispositivo,
        ws.ultimo_qr_generado_at,
        ws.ultimo_mensaje_at,
        ws.conectado_at,
        t.usuario_id,
        t.nombres,
        t.apellidos,
        t.registro_profesional,
        COALESCE(u.telefono, t.telefono) AS terapeuta_telefono_oficial,
        t.color_agenda,
        e.nombre AS especialidad_nombre,
        a.codigo AS ambiente_codigo,
        a.nombre AS ambiente_nombre
      FROM terapeutas t
      LEFT JOIN whatsapp_sesiones ws ON t.id = ws.terapeuta_id
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      LEFT JOIN especialidades e ON t.especialidad_id = e.id
      LEFT JOIN ambientes a ON t.ambiente_preferido_id = a.id
      ORDER BY t.id ASC
    `);
    return rows;
  }

  async getSessionRowByTherapistOrUserId(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         ws.*,
         t.usuario_id,
         t.nombres,
         t.apellidos,
         t.registro_profesional,
         COALESCE(u.telefono, t.telefono) AS terapeuta_telefono_oficial
       FROM terapeutas t
       LEFT JOIN whatsapp_sesiones ws ON t.id = ws.terapeuta_id
       LEFT JOIN usuarios u ON t.usuario_id = u.id
       WHERE t.id = $1 OR t.usuario_id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async getUserFallbackById(id) {
    const { rows } = await PostgresConnection.query(
      `SELECT id, nombre_completo, email, telefono, rol_id FROM usuarios WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async setSessionStatus(therapistId, estado, extra = {}) {
    if (estado === 'CONECTADO') {
      await PostgresConnection.query(
        `UPDATE whatsapp_sesiones
         SET estado = 'CONECTADO',
             telefono_vinculado = COALESCE($1, telefono_vinculado),
             nombre_dispositivo = 'WhatsApp Web Móvil',
             conectado_at = ${extra.preserveConnectedAt ? 'COALESCE(conectado_at, CURRENT_TIMESTAMP)' : 'CURRENT_TIMESTAMP'},
             updated_at = CURRENT_TIMESTAMP
         WHERE terapeuta_id = $2`,
        [extra.phone || null, therapistId]
      );
    } else if (estado === 'ESPERANDO_QR') {
      await PostgresConnection.query(
        `UPDATE whatsapp_sesiones
         SET estado = 'ESPERANDO_QR', ultimo_qr_generado_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE terapeuta_id = $1`,
        [therapistId]
      );
    } else if (extra.clearConnectedAt) {
      await PostgresConnection.query(
        `UPDATE whatsapp_sesiones
         SET estado = $1, conectado_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE terapeuta_id = $2`,
        [estado, therapistId]
      );
    } else {
      await PostgresConnection.query(
        `UPDATE whatsapp_sesiones
         SET estado = $1, updated_at = CURRENT_TIMESTAMP
         WHERE terapeuta_id = $2`,
        [estado, therapistId]
      );
    }
  }

  async syncLinkedPhone(therapistId, phone) {
    await PostgresConnection.query(
      `UPDATE whatsapp_sesiones
       SET telefono_vinculado = COALESCE($1, telefono_vinculado), updated_at = CURRENT_TIMESTAMP
       WHERE terapeuta_id = $2`,
      [phone, therapistId]
    );
  }

  async touchLastMessageAt(therapistId) {
    await PostgresConnection.query(
      `UPDATE whatsapp_sesiones
       SET ultimo_mensaje_at = CURRENT_TIMESTAMP
       WHERE terapeuta_id = $1`,
      [therapistId]
    );
  }

  async getConnectedSessions() {
    const { rows } = await PostgresConnection.query(
      `SELECT terapeuta_id FROM whatsapp_sesiones WHERE estado = 'CONECTADO'`
    );
    return rows;
  }

  async findTutorByPhoneDigits(cleanDigits, localPhone) {
    const { rows } = await PostgresConnection.query(
      `SELECT * FROM tutores
       WHERE $1 LIKE '%' || REPLACE(REPLACE(REPLACE(whatsapp, '+', ''), ' ', ''), '-', '') || '%'
          OR REPLACE(REPLACE(REPLACE(whatsapp, '+', ''), ' ', ''), '-', '') LIKE '%' || $1 || '%'
          OR REPLACE(REPLACE(REPLACE(whatsapp, '+', ''), ' ', ''), '-', '') LIKE '%' || $2 || '%'
       LIMIT 1`,
      [cleanDigits, localPhone]
    );
    return rows[0] || null;
  }

  async getLatestSentReminderAppointmentByTherapist(therapistId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         c.id, c.paciente_id, c.terapeuta_id, c.ambiente_id, c.fecha_hora_inicio, c.fecha_hora_fin, c.estado,
         p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
         t.usuario_id AS terapeuta_usuario_id, t.nombres AS terapeuta_nombres, t.apellidos AS terapeuta_apellidos,
         a.nombre AS ambiente_nombre, a.codigo AS ambiente_codigo,
         tut.id AS tutor_id, tut.nombres AS tutor_nombres, tut.apellidos AS tutor_apellidos, tut.whatsapp AS tutor_whatsapp, tut.usuario_id AS tutor_usuario_id
       FROM recordatorios_citas rc
       JOIN citas c ON rc.cita_id = c.id
       JOIN pacientes p ON c.paciente_id = p.id
       JOIN paciente_tutor pt ON pt.paciente_id = p.id
       JOIN tutores tut ON pt.tutor_id = tut.id
       JOIN terapeutas t ON c.terapeuta_id = t.id
       JOIN ambientes a ON c.ambiente_id = a.id
       WHERE c.terapeuta_id = $1
         AND rc.estado = 'ENVIADO'
         AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
       ORDER BY rc.id DESC
       LIMIT 1`,
      [therapistId]
    );
    return rows[0] || null;
  }

  async getLatestSentReminderAppointmentByTutor(tutorId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         c.id, c.paciente_id, c.terapeuta_id, c.ambiente_id, c.fecha_hora_inicio, c.fecha_hora_fin, c.estado,
         p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
         t.usuario_id AS terapeuta_usuario_id, t.nombres AS terapeuta_nombres, t.apellidos AS terapeuta_apellidos,
         a.nombre AS ambiente_nombre, a.codigo AS ambiente_codigo
       FROM recordatorios_citas rc
       JOIN citas c ON rc.cita_id = c.id
       JOIN pacientes p ON c.paciente_id = p.id
       JOIN paciente_tutor pt ON pt.paciente_id = p.id
       JOIN tutores tut ON pt.tutor_id = tut.id
       JOIN terapeutas t ON c.terapeuta_id = t.id
       JOIN ambientes a ON c.ambiente_id = a.id
       WHERE tut.id = $1
         AND rc.estado = 'ENVIADO'
         AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
       ORDER BY rc.id DESC
       LIMIT 1`,
      [tutorId]
    );
    return rows[0] || null;
  }

  async getUpcomingTutorAppointments(tutorId) {
    const { rows } = await PostgresConnection.query(
      `SELECT
         c.id, c.paciente_id, c.terapeuta_id, c.ambiente_id, c.fecha_hora_inicio, c.fecha_hora_fin, c.estado,
         p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos,
         t.usuario_id AS terapeuta_usuario_id, t.nombres AS terapeuta_nombres, t.apellidos AS terapeuta_apellidos,
         a.nombre AS ambiente_nombre, a.codigo AS ambiente_codigo
       FROM citas c
       JOIN pacientes p ON c.paciente_id = p.id
       JOIN paciente_tutor pt ON pt.paciente_id = p.id
       JOIN tutores tut ON pt.tutor_id = tut.id
       JOIN terapeutas t ON c.terapeuta_id = t.id
       JOIN ambientes a ON c.ambiente_id = a.id
       WHERE tut.id = $1
         AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
         AND (c.fecha_hora_inicio AT TIME ZONE 'America/La_Paz')::date >= ((NOW() AT TIME ZONE 'America/La_Paz')::date - INTERVAL '1 day')
       ORDER BY c.fecha_hora_inicio ASC
       LIMIT 4`,
      [tutorId]
    );
    return rows;
  }

  async updateAppointmentStateFromWhatsapp(citaId, estado) {
    await PostgresConnection.query(
      `UPDATE citas SET estado = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [estado, citaId]
    );
  }
}
