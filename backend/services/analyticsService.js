import { RepositoryFactory } from '../core/RepositoryFactory.js';

export class AnalyticsService {
  constructor() {
    this.analyticsRepo = RepositoryFactory.getAnalyticsRepository();
    this.therapistRepo = RepositoryFactory.getTherapistRepository();
  }

  /**
   * Obtiene la analítica ejecutiva global para el Administrador
   */
  async getAdminDashboard(period = 'month') {
    const validPeriods = ['week', 'month', 'quarter', 'year', 'all'];
    const safePeriod = validPeriods.includes(period) ? period : 'month';
    return await this.analyticsRepo.getAdminDashboardData(safePeriod);
  }

  /**
   * Obtiene la analítica personal confidencial para el Terapeuta
   */
  async getTherapistDashboard(userId, userRole, period = 'month', targetTherapistId = null) {
    const validPeriods = ['week', 'month', 'quarter', 'year', 'all'];
    const safePeriod = validPeriods.includes(period) ? period : 'month';

    let therapist = null;

    if (userRole === 'TERAPEUTA') {
      // Estricta seguridad: el terapeuta solo puede ver su propio registro vinculado a su usuario autenticado
      therapist = await this.therapistRepo.findByUserId(userId);
      if (!therapist) {
        throw new Error('No se encontró un registro clínico de terapeuta vinculado a su cuenta de usuario.');
      }
    } else if (userRole === 'ADMIN') {
      // El administrador puede consultar el panel de un terapeuta específico si envía targetTherapistId
      if (targetTherapistId) {
        therapist = await this.therapistRepo.findById(Number(targetTherapistId));
      } else {
        therapist = await this.therapistRepo.findByUserId(userId);
        if (!therapist) {
          const all = await this.therapistRepo.findAll();
          therapist = all[0] || null;
        }
      }
      if (!therapist) {
        throw new Error('No hay especialistas disponibles para consultar.');
      }
    } else {
      throw new Error('Acceso no autorizado a este panel clínico.');
    }

    return await this.analyticsRepo.getTherapistDashboardData(therapist.id, safePeriod);
  }

  /**
   * Obtiene métricas estadísticas avanzadas no redundantes para Reportes (ADMIN)
   */
  async getAdminReportsData(period = 'month') {
    const validPeriods = ['week', 'month', 'quarter', 'year', 'all'];
    const safePeriod = validPeriods.includes(period) ? period : 'month';
    return await this.analyticsRepo.getAdminReportsData(safePeriod);
  }

  /**
   * Obtiene métricas estadísticas avanzadas personales para Reportes (TERAPEUTA)
   */
  async getTherapistReportsData(userId, userRole, period = 'month', targetTherapistId = null) {
    const validPeriods = ['week', 'month', 'quarter', 'year', 'all'];
    const safePeriod = validPeriods.includes(period) ? period : 'month';

    let therapist = null;

    if (userRole === 'TERAPEUTA') {
      therapist = await this.therapistRepo.findByUserId(userId);
      if (!therapist) {
        throw new Error('No se encontró un registro clínico de terapeuta vinculado a su cuenta de usuario.');
      }
    } else if (userRole === 'ADMIN') {
      if (targetTherapistId) {
        therapist = await this.therapistRepo.findById(Number(targetTherapistId));
      } else {
        therapist = await this.therapistRepo.findByUserId(userId);
        if (!therapist) {
          const all = await this.therapistRepo.findAll();
          therapist = all[0] || null;
        }
      }
      if (!therapist) {
        throw new Error('No hay especialistas disponibles para consultar.');
      }
    } else {
      throw new Error('Acceso no autorizado a este reporte.');
    }

    return await this.analyticsRepo.getTherapistReportsData(therapist.id, safePeriod);
  }
}

export const analyticsService = new AnalyticsService();
