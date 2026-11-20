import { Router } from 'express';
import { PushNotificationController } from '../controllers/pushNotificationController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';

const router = Router();

// 1. Obtener clave pública VAPID (acceso autenticado para cualquier rol registrado)
router.get('/vapid-public-key', authMiddleware, PushNotificationController.getVapidPublicKey);

// 2. Suscribir y desuscribir dispositivos Web Push
router.post('/subscribe', authMiddleware, PushNotificationController.subscribe);
router.post('/unsubscribe', authMiddleware, PushNotificationController.unsubscribe);

// 3. Envío de notificación push de prueba al usuario conectado
router.post('/test-push', authMiddleware, PushNotificationController.sendTestPush);

// 4. Bandeja in-app de notificaciones + Canal SSE en tiempo real
router.get('/stream', authMiddleware, PushNotificationController.streamNotifications);
router.get('/', authMiddleware, PushNotificationController.getNotifications);
router.get('/unread-count', authMiddleware, PushNotificationController.getUnreadCount);
router.patch('/read-all', authMiddleware, PushNotificationController.markAllAsRead);
router.patch('/:id/read', authMiddleware, PushNotificationController.markAsRead);
router.delete('/clear', authMiddleware, PushNotificationController.clearNotifications);
router.delete('/:id', authMiddleware, PushNotificationController.deleteNotification);

// 5. Control y supervisión del motor Scheduler (ADMIN y RECEPCION)
router.get('/scheduler/status', authMiddleware, requireRole(['ADMIN', 'RECEPCION']), PushNotificationController.getSchedulerStatus);
router.post('/scheduler/run-cycle', authMiddleware, requireRole(['ADMIN', 'RECEPCION']), PushNotificationController.triggerSchedulerCycle);

export default router;

