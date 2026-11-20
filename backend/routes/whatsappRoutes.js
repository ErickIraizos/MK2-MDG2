import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsappController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';

const router = Router();

// Todas las rutas de WhatsApp exigen autenticación
router.use(authMiddleware);

// 1. Listar todas las sesiones (ADMIN, TERAPEUTA, RECEPCION)
router.get('/sessions', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), WhatsAppController.getAllSessions);

// 2. Detalle de sesión de un terapeuta
router.get('/:therapistId', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), WhatsAppController.getSession);

// 3. Inicializar / Solicitar QR (ADMIN o TERAPEUTA titular)
router.post('/:therapistId/init', requireRole(['ADMIN', 'TERAPEUTA']), WhatsAppController.initializeSession);

// 4. Desconectar sesión (ADMIN o TERAPEUTA titular)
router.post('/:therapistId/disconnect', requireRole(['ADMIN', 'TERAPEUTA']), WhatsAppController.disconnectSession);

// 5. Enviar mensaje de prueba (ADMIN o TERAPEUTA)
router.post('/:therapistId/test', requireRole(['ADMIN', 'TERAPEUTA']), WhatsAppController.sendTestMessage);

// 6. Enviar mensaje general clínico
router.post('/send', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), WhatsAppController.sendMessage);

// 7. Recordatorios vinculados a citas
router.post('/appointments/:citaId/schedule-reminder', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), WhatsAppController.scheduleAppointmentReminder);
router.post('/appointments/:citaId/dispatch-now', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), WhatsAppController.dispatchAppointmentNow);

export default router;

