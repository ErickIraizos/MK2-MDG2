import { RepositoryFactory } from '../core/RepositoryFactory.js';

class NotificationService {
  constructor() {
    this.sseClients = new Map(); // userId -> Set<{ res, rol }>
  }

  _repo() {
    return RepositoryFactory.getNotificationRepository();
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

  async createNotification({ userId, tipo = 'RECORDATORIO', titulo, mensaje, linkUrl = null, citaId = null }) {
    const created = await this._repo().createNotification({ userId, tipo, titulo, mensaje, linkUrl, citaId });
    this.emitToUser(userId, 'notification', {
      id: created.id,
      tipo,
      titulo,
      linkUrl,
      citaId
    });
    return created;
  }

  async getUserNotifications(userId, options = {}) {
    return this._repo().getUserNotifications(userId, options);
  }

  async getUnreadCount(userId, options = {}) {
    return this._repo().getUnreadCount(userId, options);
  }

  async markAsRead(notificationId, userId) {
    return this._repo().markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId) {
    return this._repo().markAllAsRead(userId);
  }

  async deleteNotification(notificationId, userId) {
    return this._repo().deleteNotification(notificationId, userId);
  }

  async clearReadNotifications(userId) {
    return this._repo().clearReadNotifications(userId);
  }

  async clearAllNotifications(userId) {
    return this._repo().clearAllNotifications(userId);
  }
}

export const notificationService = new NotificationService();
