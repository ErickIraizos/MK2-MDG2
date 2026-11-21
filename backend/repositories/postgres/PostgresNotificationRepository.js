import { PostgresConnection } from '../../core/PostgresConnection.js';

export class PostgresNotificationRepository {
  async createNotification({ userId, tipo = 'RECORDATORIO', titulo, mensaje, linkUrl = null, citaId = null }) {
    const { rows } = await PostgresConnection.query(
      `INSERT INTO notificaciones_sistema (usuario_id, tipo, titulo, mensaje, link_url, cita_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING id`,
      [userId, tipo, titulo, mensaje, linkUrl, citaId]
    );

    return {
      id: rows[0].id,
      userId,
      tipo,
      titulo,
      mensaje,
      linkUrl,
      citaId
    };
  }

  async _buildAdminFilter(userId, userObj = null) {
    let rol = userObj?.rol;
    if (!rol) {
      const { rows } = await PostgresConnection.query(
        `SELECT u.id, r.nombre AS rol_nombre
         FROM usuarios u
         JOIN roles r ON u.rol_id = r.id
         WHERE u.id = $1`,
        [userId]
      );
      rol = rows[0]?.rol_nombre;
    }

    if (rol !== 'ADMIN') return '';

    const { rows: thRows } = await PostgresConnection.query(
      `SELECT id, nombres FROM terapeutas WHERE usuario_id = $1`,
      [userId]
    );
    const therapist = thRows[0];
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
    const adminFilter = await this._buildAdminFilter(userId, options.user);

    let query = `
      SELECT n.*, c.fecha_hora_inicio, c.ambiente_id, a.nombre AS ambiente_nombre
      FROM notificaciones_sistema n
      LEFT JOIN citas c ON n.cita_id = c.id
      LEFT JOIN ambientes a ON c.ambiente_id = a.id
      WHERE n.usuario_id = $1
      ${adminFilter}
    `;

    if (unreadOnly) {
      query += ` AND n.leida = 0`;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $2`;
    const { rows } = await PostgresConnection.query(query, [userId, limit]);
    return rows;
  }

  async getUnreadCount(userId, options = {}) {
    const adminFilter = await this._buildAdminFilter(userId, options.user);
    const query = `
      SELECT COUNT(*)::int AS count
      FROM notificaciones_sistema n
      LEFT JOIN citas c ON n.cita_id = c.id
      WHERE n.usuario_id = $1 AND n.leida = 0
      ${adminFilter}
    `;
    const { rows } = await PostgresConnection.query(query, [userId]);
    return rows[0] ? rows[0].count : 0;
  }

  async markAsRead(notificationId, userId) {
    const res = await PostgresConnection.query(
      `UPDATE notificaciones_sistema
       SET leida = 1
       WHERE id = $1 AND usuario_id = $2`,
      [notificationId, userId]
    );
    return { success: res.rowCount > 0 };
  }

  async markAllAsRead(userId) {
    const res = await PostgresConnection.query(
      `UPDATE notificaciones_sistema
       SET leida = 1
       WHERE usuario_id = $1 AND leida = 0`,
      [userId]
    );
    return { success: true, updated: res.rowCount };
  }

  async deleteNotification(notificationId, userId) {
    const res = await PostgresConnection.query(
      `DELETE FROM notificaciones_sistema
       WHERE id = $1 AND usuario_id = $2`,
      [notificationId, userId]
    );
    return { success: res.rowCount > 0 };
  }

  async clearReadNotifications(userId) {
    const res = await PostgresConnection.query(
      `DELETE FROM notificaciones_sistema
       WHERE usuario_id = $1 AND leida = 1`,
      [userId]
    );
    return { success: true, deleted: res.rowCount };
  }

  async clearAllNotifications(userId) {
    const res = await PostgresConnection.query(
      `DELETE FROM notificaciones_sistema
       WHERE usuario_id = $1`,
      [userId]
    );
    return { success: true, deleted: res.rowCount };
  }

  async savePushSubscription(userId, endpoint, p256dh, auth, userAgent = '') {
    await PostgresConnection.query(
      `INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh_key, auth_key, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (endpoint) DO UPDATE SET
         usuario_id = EXCLUDED.usuario_id,
         p256dh_key = EXCLUDED.p256dh_key,
         auth_key = EXCLUDED.auth_key,
         user_agent = EXCLUDED.user_agent,
         created_at = CURRENT_TIMESTAMP`,
      [userId, endpoint, p256dh, auth, userAgent || '']
    );
    return { success: true, message: 'Suscripción guardada exitosamente.' };
  }

  async deletePushSubscription(endpoint) {
    await PostgresConnection.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    return { success: true };
  }

  async getPushSubscriptionsByUserId(userId) {
    const { rows } = await PostgresConnection.query(
      'SELECT * FROM push_subscriptions WHERE usuario_id = $1',
      [userId]
    );
    return rows;
  }
}
