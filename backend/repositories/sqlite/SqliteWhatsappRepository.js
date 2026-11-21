import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqliteWhatsappRepository {
  constructor(db = DatabaseConnection.getInstance()) {
    this.db = db;
  }

  async ensureDynamicSessions() {
    const therapists = this.db.prepare(`SELECT id, telefono FROM terapeutas`).all();
    const insertSession = this.db.prepare(`
      INSERT OR IGNORE INTO whatsapp_sesiones (terapeuta_id, estado, telefono_vinculado)
      VALUES (?, 'DESCONECTADO', ?)
    `);
    for (const t of therapists) {
      insertSession.run(t.id, t.telefono || null);
    }
  }

  async getAllSessionsWithTherapists() {
    return this.db.prepare(`
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
    `).all();
  }

  async getSessionRowByTherapistOrUserId(id) {
    return this.db.prepare(`
      SELECT
        ws.*,
        t.usuario_id,
        t.nombres,
        t.apellidos,
        t.registro_profesional,
        COALESCE(u.telefono, t.telefono) AS terapeuta_telefono_oficial
      FROM terapeutas t
      LEFT JOIN whatsapp_sesiones ws ON t.id = ws.terapeuta_id
      LEFT JOIN usuarios u ON t.usuario_id = u.id
      WHERE t.id = ? OR t.usuario_id = ?
    `).get(id, id) || null;
  }

  async getUserFallbackById(id) {
    return this.db.prepare(
      `SELECT id, nombre_completo, email, telefono, rol_id FROM usuarios WHERE id = ?`
    ).get(id) || null;
  }

  async setSessionStatus(therapistId, estado, extra = {}) {
    if (estado === 'CONECTADO') {
      this.db.prepare(`
        UPDATE whatsapp_sesiones
        SET estado = 'CONECTADO',
            telefono_vinculado = COALESCE(?, telefono_vinculado),
            nombre_dispositivo = 'WhatsApp Web Móvil',
            conectado_at = ${extra.preserveConnectedAt ? 'COALESCE(conectado_at, CURRENT_TIMESTAMP)' : 'CURRENT_TIMESTAMP'},
            updated_at = CURRENT_TIMESTAMP
        WHERE terapeuta_id = ?
      `).run(extra.phone || null, therapistId);
    } else if (estado === 'ESPERANDO_QR') {
      this.db.prepare(`
        UPDATE whatsapp_sesiones
        SET estado = 'ESPERANDO_QR', ultimo_qr_generado_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE terapeuta_id = ?
      `).run(therapistId);
    } else if (extra.clearConnectedAt) {
      this.db.prepare(`
        UPDATE whatsapp_sesiones
        SET estado = ?, conectado_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE terapeuta_id = ?
      `).run(estado, therapistId);
    } else {
      this.db.prepare(`
        UPDATE whatsapp_sesiones
        SET estado = ?, updated_at = CURRENT_TIMESTAMP
        WHERE terapeuta_id = ?
      `).run(estado, therapistId);
    }
  }

  async syncLinkedPhone(therapistId, phone) {
    this.db.prepare(`
      UPDATE whatsapp_sesiones
      SET telefono_vinculado = COALESCE(?, telefono_vinculado), updated_at = CURRENT_TIMESTAMP
      WHERE terapeuta_id = ?
    `).run(phone, therapistId);
  }

  async touchLastMessageAt(therapistId) {
    this.db.prepare(`
      UPDATE whatsapp_sesiones
      SET ultimo_mensaje_at = CURRENT_TIMESTAMP
      WHERE terapeuta_id = ?
    `).run(therapistId);
  }

  async getConnectedSessions() {
    return this.db.prepare(`
      SELECT terapeuta_id FROM whatsapp_sesiones WHERE estado = 'CONECTADO'
    `).all();
  }

  async findTutorByPhoneDigits(cleanDigits, localPhone) {
    return this.db.prepare(`
      SELECT * FROM tutores
      WHERE ? LIKE '%' || REPLACE(REPLACE(REPLACE(whatsapp, '+', ''), ' ', ''), '-', '') || '%'
         OR REPLACE(REPLACE(REPLACE(whatsapp, '+', ''), ' ', ''), '-', '') LIKE '%' || ? || '%'
         OR REPLACE(REPLACE(REPLACE(whatsapp, '+', ''), ' ', ''), '-', '') LIKE '%' || ? || '%'
      LIMIT 1
    `).get(cleanDigits, cleanDigits, localPhone) || null;
  }

  async getLatestSentReminderAppointmentByTherapist(therapistId) {
    return this.db.prepare(`
      SELECT
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
      WHERE c.terapeuta_id = ?
        AND rc.estado = 'ENVIADO'
        AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
      ORDER BY rc.id DESC
      LIMIT 1
    `).get(therapistId) || null;
  }

  async getLatestSentReminderAppointmentByTutor(tutorId) {
    return this.db.prepare(`
      SELECT
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
      WHERE tut.id = ?
        AND rc.estado = 'ENVIADO'
        AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
      ORDER BY rc.id DESC
      LIMIT 1
    `).get(tutorId) || null;
  }

  async getUpcomingTutorAppointments(tutorId) {
    return this.db.prepare(`
      SELECT
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
      WHERE tut.id = ?
        AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
        AND date(c.fecha_hora_inicio) >= date('now', '-1 day')
      ORDER BY c.fecha_hora_inicio ASC
      LIMIT 4
    `).all(tutorId);
  }

  async updateAppointmentStateFromWhatsapp(citaId, estado) {
    this.db.prepare(`UPDATE citas SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(estado, citaId);
  }
}
