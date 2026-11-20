import { TriageService } from '../services/triageService.js';

const triageService = new TriageService();

export class TriageController {
  /**
   * Endpoint público de chat de triaje e inferencia con MindBot IA.
   * Accesible desde el botón flotante (FAB) por cualquier usuario, visitante o tutor.
   */
  static async handleChat(req, res, next) {
    try {
      const { message, sessionId, conversationHistory } = req.body;
      const userId = req.user ? req.user.id : null;
      const userRole = req.user ? req.user.rol : 'TUTOR';
      const userName = req.user ? req.user.nombre_completo : 'Usuario';
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      const result = await triageService.processTriage({
        message,
        sessionId,
        userId,
        userRole,
        userName,
        ip,
        conversationHistory: conversationHistory || []
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Obtiene el listado de triajes para supervisión clínica y de recepción.
   * Requiere autenticación JWT (ADMIN, TERAPEUTA, RECEPCION).
   */
  static async getHistory(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      const offset = parseInt(req.query.offset, 10) || 0;
      const esCrisis = req.query.esCrisis !== undefined ? req.query.esCrisis === 'true' : null;
      const area = req.query.area || null;

      const history = await triageService.getTriageHistory({ limit, offset, esCrisis, area });

      res.status(200).json({
        success: true,
        data: history
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Obtiene métricas agregadas de consultas de triaje y atenciones en crisis.
   */
  static async getMetrics(req, res, next) {
    try {
      const metrics = await triageService.getTriageMetrics();

      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (err) {
      next(err);
    }
  }
}

