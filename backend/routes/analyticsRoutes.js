import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';

const router = Router();

// Dashboard Ejecutivo Global: Exclusivo para ADMIN (Dirección General)
router.get('/admin', authMiddleware, requireRole(['ADMIN']), AnalyticsController.getAdminDashboard);

// Dashboard Clínico Personal: Exclusivo para TERAPEUTA (y ADMIN para supervisión)
router.get('/therapist/my-summary', authMiddleware, requireRole(['TERAPEUTA', 'ADMIN']), AnalyticsController.getTherapistDashboard);

// Reportes Estadísticos Avanzados (No redundantes): Exclusivo para ADMIN
router.get('/reports/admin', authMiddleware, requireRole(['ADMIN']), AnalyticsController.getAdminReportsData);

// Reportes Estadísticos Avanzados Personales: Exclusivo para TERAPEUTA (y ADMIN)
router.get('/reports/therapist', authMiddleware, requireRole(['TERAPEUTA', 'ADMIN']), AnalyticsController.getTherapistReportsData);

export default router;
