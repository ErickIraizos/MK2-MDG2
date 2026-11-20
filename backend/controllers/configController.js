import { ConfigService } from '../services/configService.js';

const configService = new ConfigService();

export class ConfigController {
  static async getPublic(req, res, next) {
    try {
      const settings = await configService.getPublicConfig();
      res.status(200).json({
        success: true,
        data: settings
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAllAdmin(req, res, next) {
    try {
      const settings = await configService.getAllAdminConfig();
      res.status(200).json({
        success: true,
        data: settings
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateGroqKey(req, res, next) {
    try {
      const { apiKey } = req.body;
      const ip = req.ip || req.headers['x-forwarded-for'];
      const result = await configService.updateGroqApiKey(apiKey, req.user.id, ip);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateInstitution(req, res, next) {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'];
      const result = await configService.updateInstitutionConfig(req.body, req.user.id, ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async uploadFacilityPhoto(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No se subió ningún archivo de imagen.' }
        });
      }

      const fileUrl = `/uploads/instalaciones/${req.file.filename}`;
      res.status(200).json({
        success: true,
        message: 'Fotografía de instalación subida exitosamente.',
        data: {
          url: fileUrl,
          filename: req.file.filename,
          size: req.file.size
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async testGroq(req, res, next) {
    try {
      const apiKey = req.body?.apiKey || req.query?.apiKey || null;
      const result = await configService.testGroqConnection(apiKey);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
