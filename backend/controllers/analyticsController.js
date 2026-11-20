import { analyticsService } from '../services/analyticsService.js';

export class AnalyticsController {
  /**
   * GET /api/analytics/admin
   * Dashboard Ejecutivo Global para Dirección General (ADMIN)
   */
  static async getAdminDashboard(req, res, next) {
    try {
      const { period } = req.query;
      const data = await analyticsService.getAdminDashboard(period);
      return res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/analytics/therapist/my-summary
   * Dashboard Personal Clínico para el Terapeuta logueado
   */
  static async getTherapistDashboard(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.rol;
      const { period, therapistId } = req.query;

      const data = await analyticsService.getTherapistDashboard(userId, userRole, period, therapistId);
      return res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/analytics/reports/admin
   * Reportes Estadísticos Avanzados no redundantes para Dirección General (ADMIN)
   */
  static async getAdminReportsData(req, res, next) {
    try {
      const { period } = req.query;
      const data = await analyticsService.getAdminReportsData(period);
      return res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/analytics/reports/therapist
   * Reportes Estadísticos Avanzados personales para el Terapeuta logueado
   */
  static async getTherapistReportsData(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.rol;
      const { period, therapistId } = req.query;

      const data = await analyticsService.getTherapistReportsData(userId, userRole, period, therapistId);
      return res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }
}
