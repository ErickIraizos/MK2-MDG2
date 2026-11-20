import { DatabaseConnection } from '../core/DatabaseConnection.js';

class NotificationService {
  constructor() {
    this.db = null;
    this.sseClients = new Map(); // userId -> Set<{ res, rol }>
  }

  registerSseClient(user, res) {
    if (!user?.id || !res) return () => {};
    const uid = Number(user.id);
    if (!this.sseClients.has(uid)) {
      this.sseClients.set(uid, new Set());
    }
    const clientEntry = { res, rol: user.rol };
    this.sseClients.get(uid).add(clientEntry);

    return () => {
      const set = this.sseClients.get(uid);
      if (set) {
        set.delete(clientEntry);
        if (set.size === 0) {
          this.sseClients.delete(uid);
        }
      }
    };
  }

  _writeSseEvent(res, eventName, data) {
    try {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof res.flush === 'function') {
        res.flush();
      }
    } catch {
      // Socket cerrado; será removido en event 'close'
    }
  }

  emitToUser(userId, eventName, data = {}) {
    const uid = Number(userId);
    const clients = this.sseClients.get(uid);
    if (!clients || clients.size === 0) return;
    for (const entry of clients) {
      this._writeSseEvent(entry.res, eventName, data);
    }
  }

  emitAppointmentChanged(appointment = null, extra = {}) {
    if (this.sseClients.size === 0) return;
    const payload = {
      citaId: appointment?.id || extra.citaId || null,
      estado: appointment?.estado || extra.estado || null,
      ts: Date.now()
    };

    for (const clients of this.sseClients.values()) {
      for (const entry of clients) {
        if (['ADMIN', 'RECEPCION', 'TERAPEUTA'].includes(entry.rol)) {
          this._writeSseEvent(entry.res, 'appointment_changed', payload);
        }
      }
    }
  }

  getDb() {
    if (!this.db) {
      this.db = DatabaseConnection.getInstance();
    }
    return this.db;
  }

  createNotification({ userId, tipo = 'RECORDATORIO', titulo, mensaje, linkUrl = null, citaId = null }) {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO notificaciones_sistema (usuario_id, tipo, titulo, mensaje, link_url, cita_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const info = stmt.run(userId, tipo, titulo, mensaje, linkUrl, citaId);
    const created = {
      id: info.lastInsertRowid,
      userId,
      tipo,
      titulo,
      mensaje,
      linkUrl,
      citaId
    };
    this.emitToUser(userId, 'notification', {
      id: created.id,
      tipo,
      titulo,
      linkUrl,
      citaId
    });
    return created;
  }

  _buildAdminFilter(userId, userObj = null) {
    const db = this.getDb();
    let rol = userObj?.rol;
    if (!rol) {
      const user = db.prepare(`
        SELECT u.id, r.nombre as rol_nombre 
        FROM usuarios u 
        JOIN roles r ON u.rol_id = r.id 
        WHERE u.id = ?
      `).get(userId);
      rol = user?.rol_nombre;
    }

    if (rol !== 'ADMIN') return '';

    // Si es ADMIN, verificar si tiene perfil de terapeuta vinculado
    const therapist = db.prepare(`SELECT id, nombres FROM terapeutas WHERE usuario_id = ?`).get(userId);
    if (!therapist) {
      // Admin puro: excluir notificaciones de citas y recordatorios clínicos de terapeutas
      return ` AND (n.cita_id IS NULL AND n.tipo NOT IN ('RECORDATORIO', 'RECORDATORIO_24H', 'RECORDATORIO_2H', 'RECORDATORIO_MANUAL_PWA', 'CITA_CONFIRMADA', 'CITA_REPROGRAMADA', 'CITA_PROGRAMADA'))`;
    }

    // Admin con perfil de terapeuta:
    // Solo permitir notificaciones donde sea el terapeuta asignado a la cita. Excluir citas de otros terapeutas.
    return ` AND (
      (n.cita_id IS NULL AND n.tipo NOT IN ('RECORDATORIO', 'RECORDATORIO_24H', 'RECORDATORIO_2H', 'RECORDATORIO_MANUAL_PWA', 'CITA_CONFIRMADA', 'CITA_REPROGRAMADA', 'CITA_PROGRAMADA'))
      OR (c.id IS NOT NULL AND c.terapeuta_id = ${therapist.id})
    )`;
  }

  getUserNotifications(userId, options = {}) {
    const db = this.getDb();
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

    return db.prepare(query).all(userId, limit);
  }

  getUnreadCount(userId, options = {}) {
    const db = this.getDb();
    const adminFilter = this._buildAdminFilter(userId, options.user);
    const query = `
      SELECT COUNT(*) as count 
      FROM notificaciones_sistema n
      LEFT JOIN citas c ON n.cita_id = c.id
      WHERE n.usuario_id = ? AND n.leida = 0
      ${adminFilter}
    `;
    const row = db.prepare(query).get(userId);
    return row ? row.count : 0;
  }

  markAsRead(notificationId, userId) {
    const db = this.getDb();
    const stmt = db.prepare(`
      UPDATE notificaciones_sistema 
      SET leida = 1 
      WHERE id = ? AND usuario_id = ?
    `);
    const res = stmt.run(notificationId, userId);
    return { success: res.changes > 0 };
  }

  markAllAsRead(userId) {
    const db = this.getDb();
    const stmt = db.prepare(`
      UPDATE notificaciones_sistema 
      SET leida = 1 
      WHERE usuario_id = ? AND leida = 0
    `);
    const res = stmt.run(userId);
    return { success: true, updated: res.changes };
  }

  deleteNotification(notificationId, userId) {
    const db = this.getDb();
    const stmt = db.prepare(`
      DELETE FROM notificaciones_sistema 
      WHERE id = ? AND usuario_id = ?
    `);
    const res = stmt.run(notificationId, userId);
    return { success: res.changes > 0 };
  }

  clearReadNotifications(userId) {
    const db = this.getDb();
    const stmt = db.prepare(`
      DELETE FROM notificaciones_sistema 
      WHERE usuario_id = ? AND leida = 1
    `);
    const res = stmt.run(userId);
    return { success: true, deleted: res.changes };
  }

  clearAllNotifications(userId) {
    const db = this.getDb();
    const stmt = db.prepare(`
      DELETE FROM notificaciones_sistema 
      WHERE usuario_id = ?
    `);
    const res = stmt.run(userId);
    return { success: true, deleted: res.changes };
  }
}

export const notificationService = new NotificationService();

