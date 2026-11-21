import { webPushService } from '../services/webPushService.js';
import { notificationService } from '../services/notificationService.js';
import { appointmentSchedulerService } from '../services/appointmentSchedulerService.js';

export class PushNotificationController {
  // 1. Obtener clave pública VAPID para suscripción en frontend
  static async getVapidPublicKey(req, res, next) {
    try {
      const publicKey = await webPushService.getPublicKey();
      res.status(200).json({
        success: true,
        data: { publicKey }
      });
    } catch (err) {
      next(err);
    }
  }

  // 2. Registrar suscripción de navegador
  static async subscribe(req, res, next) {
    try {
      const { subscription } = req.body;
      const userId = req.user.id;
      const userAgent = req.headers['user-agent'] || '';

      if (!subscription) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el objeto subscription para registrar el dispositivo.'
        });
      }

      const result = await webPushService.saveSubscription(userId, subscription, userAgent);
      res.status(200).json({
        success: true,
        message: 'Dispositivo suscrito a notificaciones Web Push exitosamente.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // 3. Cancelar suscripción
  static async unsubscribe(req, res, next) {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el endpoint de la suscripción para desvincularla.'
        });
      }

      await webPushService.deleteSubscription(endpoint);
      res.status(200).json({
        success: true,
        message: 'Suscripción Web Push cancelada exitosamente.'
      });
    } catch (err) {
      next(err);
    }
  }

  // 4. Enviar notificación Web Push de prueba al usuario actual
  static async sendTestPush(req, res, next) {
    try {
      const userId = req.user.id;
      const payload = {
        title: 'Prueba Web Push - PSI Aprende',
        body: '¡Excelente! Las notificaciones nativas PWA están configuradas y funcionando.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        url: '#/',
        data: { test: true, timestamp: Date.now() }
      };

      const pushResult = await webPushService.sendNotificationToUser(userId, payload);

      // También registramos una alerta en la bandeja in-app
      const inAppNotif = await notificationService.createNotification({
        userId,
        tipo: 'SISTEMA',
        titulo: 'Notificación de Prueba Activada',
        mensaje: 'Se despachó exitosamente una alerta Web Push a sus navegadores suscritos.',
        linkUrl: '#/'
      });

      res.status(200).json({
        success: true,
        message: 'Notificación de prueba procesada.',
        data: {
          push: pushResult,
          inApp: inAppNotif
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // 4b. Canal SSE (Server-Sent Events) en tiempo real para reemplazar polling continuo
  static async streamNotifications(req, res, next) {
    try {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      if (req.socket && typeof req.socket.setTimeout === 'function') {
        req.socket.setTimeout(0);
      }

      const unreadCount = (await notificationService.getUnreadCount(req.user.id, { user: req.user })) || 0;
      res.write(`event: connected\ndata: ${JSON.stringify({ unreadCount, ts: Date.now() })}\n\n`);

      const unregister = notificationService.registerSseClient(req.user, res);

      const heartbeatTimer = setInterval(() => {
        try {
          res.write(`: heartbeat ${Date.now()}\n\n`);
        } catch {
          clearInterval(heartbeatTimer);
          unregister();
        }
      }, 25000);

      if (typeof heartbeatTimer.unref === 'function') {
        heartbeatTimer.unref();
      }

      req.on('close', () => {
        clearInterval(heartbeatTimer);
        unregister();
      });
    } catch (err) {
      next(err);
    }
  }

  // 5. Listar notificaciones in-app del usuario
  static async getNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const unreadOnly = req.query.unread === 'true';
      const limit = parseInt(req.query.limit, 10) || 25;

      let notifications = [];
      let unreadCount = 0;

      try {
        notifications = (await notificationService.getUserNotifications(userId, { limit, unreadOnly, user: req.user })) || [];
        unreadCount = (await notificationService.getUnreadCount(userId, { user: req.user })) || 0;
      } catch (dbErr) {
        console.error('[PushNotificationController.getNotifications] Error en consulta de base de datos:', dbErr);
      }

      res.status(200).json({
        success: true,
        data: {
          notifications,
          unreadCount
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // 6. Contador de no leídas
  static async getUnreadCount(req, res, next) {
    try {
      let unreadCount = 0;
      try {
        unreadCount = (await notificationService.getUnreadCount(req.user.id, { user: req.user })) || 0;
      } catch (dbErr) {
        console.error('[PushNotificationController.getUnreadCount] Error en consulta:', dbErr);
      }

      res.status(200).json({
        success: true,
        data: { unreadCount }
      });
    } catch (err) {
      next(err);
    }
  }

  // 7. Marcar notificación como leída
  static async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const result = await notificationService.markAsRead(id, req.user.id);
      res.status(200).json({
        success: true,
        message: 'Notificación marcada como leída.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // 8. Marcar todas como leídas
  static async markAllAsRead(req, res, next) {
    try {
      const result = await notificationService.markAllAsRead(req.user.id);
      res.status(200).json({
        success: true,
        message: 'Todas las notificaciones fueron marcadas como leídas.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // 9. Eliminar notificación
  static async deleteNotification(req, res, next) {
    try {
      const { id } = req.params;
      const result = await notificationService.deleteNotification(id, req.user.id);
      res.status(200).json({
        success: true,
        message: 'Notificación eliminada.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // 9b. Limpiar notificaciones leídas o todas
  static async clearNotifications(req, res, next) {
    try {
      const { all } = req.query;
      const result = all === 'true'
        ? await notificationService.clearAllNotifications(req.user.id)
        : await notificationService.clearReadNotifications(req.user.id);
      res.status(200).json({
        success: true,
        message: all === 'true' ? 'Bandeja de notificaciones vaciada.' : 'Notificaciones leídas eliminadas.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // 10. Consultar estado del motor de recordatorios
  static async getSchedulerStatus(req, res, next) {
    try {
      const status = appointmentSchedulerService.getStatus();
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (err) {
      next(err);
    }
  }

  // 11. Ejecutar ciclo manual del scheduler (Admin / Staff)
  static async triggerSchedulerCycle(req, res, next) {
    try {
      const stats = await appointmentSchedulerService.runCycle();
      res.status(200).json({
        success: true,
        message: 'Ciclo de recordatorios ejecutado exitosamente.',
        data: stats
      });
    } catch (err) {
      next(err);
    }
  }
}

