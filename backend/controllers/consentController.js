import { ConsentService } from '../services/consentService.js';

const consentService = new ConsentService();

export class ConsentController {
  static async createConsent(req, res, next) {
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Browser/PWA';

      // Si quien firma es un tutor autenticado y no envió tutor_id, resolverlo por usuario_id
      if (req.user?.rol === 'TUTOR' && !req.body.tutor_id && consentService.tutorRepo?.findByUserId) {
        const userTutor = await consentService.tutorRepo.findByUserId(req.user.id);
        if (userTutor) req.body.tutor_id = userTutor.id;
      }

      const consent = await consentService.createConsent(req.body, req.user, clientIp, userAgent);

      res.status(201).json({
        success: true,
        message: 'Consentimiento informado registrado y firmado exitosamente.',
        data: consent
      });
    } catch (error) {
      next(error);
    }
  }

  static async getConsentsByPatient(req, res, next) {
    try {
      const { patientId } = req.params;
      const consents = await consentService.getConsentsByPatient(Number(patientId), req.user);

      res.status(200).json({
        success: true,
        data: consents
      });
    } catch (error) {
      next(error);
    }
  }

  static async getConsentById(req, res, next) {
    try {
      const { id } = req.params;
      const consent = await consentService.getConsentById(Number(id), req.user);

      res.status(200).json({
        success: true,
        data: consent
      });
    } catch (error) {
      next(error);
    }
  }

  static async checkConsentStatus(req, res, next) {
    try {
      const { patientId } = req.params;
      const status = await consentService.checkPatientConsentStatus(Number(patientId), req.user);

      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  static async revokeConsent(req, res, next) {
    try {
      const { id } = req.params;
      const { motivo } = req.body;
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const revoked = await consentService.revokeConsent(Number(id), motivo, req.user, clientIp);

      res.status(200).json({
        success: true,
        message: 'Consentimiento revocado legalmente.',
        data: revoked
      });
    } catch (error) {
      next(error);
    }
  }
}
