import { DatabaseConnection } from '../../core/DatabaseConnection.js';

export class SqliteNotificationRepository {
  constructor(db = DatabaseConnection.getInstance()) {
    this.db = db;
  }

  async createNotification({ userId, tipo = 'RECORDATORIO', titulo, mensaje, linkUrl = null, citaId = null }) {
    const info = this.db.prepare(`
      INSERT INTO notificaciones_sistema (usuario_id, tipo, titulo, mensaje, link_url, cita_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(userId, tipo, titulo, mensaje, linkUrl, citaId);

    return {
      id: info.lastInsertRowid,
      userId,
      tipo,
      titulo,
      mensaje,
      linkUrl,
      citaId
    };
  }

  _buildAdminFilter(userId, userObj = null) {
    let rol = userObj?.rol;
    if (!rol) {
      const user = this.db.prepare(`
        SELECT u.id, r.nombre as rol_nombre
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE u.id = ?
      `).get(userId);
      rol = user?.rol_nombre;
    }

    if (rol !== 'ADMIN') return '';

    const therapist = this.db.prepare(`SELECT id, nombres FROM terapeutas WHERE usuario_id = ?`).get(userId);
    if (!therapist) {
      return ` AND (n.cita_id IS NULL AND n.tipo NOT IN ('RECORDATORIO', 'RECORDATORIO_24H', 'RECORDATORIO_2H', 'RECORDATORIO_MANUAL_PWA', 'CITA_CONFIRMADA', 'CITA_REPROGRAMADA', 'CITA_PROGRAMADA'))`;
    }

    return ` AND (
      (n.cita_id IS NULL AND n.tipo NOT IN ('RECORDATORIO', 'RECORDATORIO_24H', 'RECORDATORIO_2H', 'RECORDATORIO_MANUAL_PWA', 'CITA_CONFIRMADA', 'CITA_REPROGRAMADA', 'CITA_PROGRAMADA'))
      OR (c.id IS NOT NULL AND c.terapeuta_id = ${Number(therapist.id)})
    )`;
  }

  async getUserNotifications(userId, options = {}) {
    const limit = options.limit || 25;
    const unreadOnly = options.unreadOnly === true;
    const adminFilter = this._buildAdminFilter(userId, options.user);

    let query = `
      SELECT n.*, c.fecha_hora_inicio, c.ambiente_id, a.nombre AS ambiente_nombre
      FROM notificaciones_sistema n
      LEFT JOIN citas c ON n.cita_id = c.id
      LEFT JOIN ambientes a ON c.ambiente_id = a.id
      WHERE n.usuario_id = ?
      ${adminFilter}
    `;

    if (unreadOnly) {
      query += ` AND n.leida = 0`;
    }

    query += ` ORDER BY n.created_at DESC LIMIT ?`;
    return this.db.prepare(query).all(userId, limit);
  }

  async getUnreadCount(userId, options = {}) {
    const adminFilter = this._buildAdminFilter(userId, options.user);
    const query = `
      SELECT COUNT(*) as count
      FROM notificaciones_sistema n
      LEFT JOIN citas c ON n.cita_id = c.id
      WHERE n.usuario_id = ? AND n.leida = 0
      ${adminFilter}
    `;
    const row = this.db.prepare(query).get(userId);
    return row ? row.count : 0;
  }

  async markAsRead(notificationId, userId) {
    const res = this.db.prepare(`
      UPDATE notificaciones_sistema
      SET leida = 1
      WHERE id = ? AND usuario_id = ?
    `).run(notificationId, userId);
    return { success: res.changes > 0 };
  }

  async markAllAsRead(userId) {
    const res = this.db.prepare(`
      UPDATE notificaciones_sistema
      SET leida = 1
      WHERE usuario_id = ? AND leida = 0
    `).run(userId);
    return { success: true, updated: res.changes };
  }

  async deleteNotification(notificationId, userId) {
    const res = this.db.prepare(`
      DELETE FROM notificaciones_sistema
      WHERE id = ? AND usuario_id = ?
    `).run(notificationId, userId);
    return { success: res.changes > 0 };
  }

  async clearReadNotifications(userId) {
    const res = this.db.prepare(`
      DELETE FROM notificaciones_sistema
      WHERE usuario_id = ? AND leida = 1
    `).run(userId);
    return { success: true, deleted: res.changes };
  }

  async clearAllNotifications(userId) {
    const res = this.db.prepare(`
      DELETE FROM notificaciones_sistema
      WHERE usuario_id = ?
    `).run(userId);
    return { success: true, deleted: res.changes };
  }

  async savePushSubscription(userId, endpoint, p256dh, auth, userAgent = '') {
    this.db.prepare(`
      INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh_key, auth_key, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(endpoint) DO UPDATE SET
        usuario_id = excluded.usuario_id,
        p256dh_key = excluded.p256dh_key,
        auth_key = excluded.auth_key,
        user_agent = excluded.user_agent,
        created_at = CURRENT_TIMESTAMP
    `).run(userId, endpoint, p256dh, auth, userAgent || '');
    return { success: true, message: 'Suscripción guardada exitosamente.' };
  }

  async deletePushSubscription(endpoint) {
    this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
    return { success: true };
  }

  async getPushSubscriptionsByUserId(userId) {
    return this.db.prepare('SELECT * FROM push_subscriptions WHERE usuario_id = ?').all(userId);
  }
}
