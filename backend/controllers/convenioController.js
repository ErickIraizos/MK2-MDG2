import { ConvenioService } from '../services/convenioService.js';

const convenioService = new ConvenioService();

export class ConvenioController {
  static async getConvenios(req, res, next) {
    try {
      // Si no es ADMIN, solo ve activos
      const isAdmin = req.user?.rol === 'ADMIN';
      const filters = {
        ...req.query,
        soloActivos: isAdmin ? (req.query.soloActivos !== 'false') : true
      };

      const convenios = await convenioService.getAllConvenios(filters);
      res.status(200).json({
        success: true,
        data: convenios
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllForAdmin(req, res, next) {
    try {
      const filters = {
        ...req.query,
        soloActivos: false
      };
      const convenios = await convenioService.getAllConvenios(filters);
      const stats = await convenioService.getStats();

      res.status(200).json({
        success: true,
        data: convenios,
        stats
      });
    } catch (error) {
      next(error);
    }
  }

  static async getConvenioById(req, res, next) {
    try {
      const { id } = req.params;
      const convenio = await convenioService.getConvenioById(Number(id));
      res.status(200).json({
        success: true,
        data: convenio
      });
    } catch (error) {
      next(error);
    }
  }

  static async createConvenio(req, res, next) {
    try {
      const convenio = await convenioService.createConvenio(req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Convenio institucional registrado exitosamente.',
        data: convenio
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateConvenio(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await convenioService.updateConvenio(Number(id), req.body, req.user);
      res.status(200).json({
        success: true,
        message: 'Convenio institucional actualizado exitosamente.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleActivo(req, res, next) {
    try {
      const { id } = req.params;
      const toggled = await convenioService.toggleActivo(Number(id), req.user);
      res.status(200).json({
        success: true,
        message: `Convenio ${toggled.activo === 1 ? 'activado' : 'desactivado'} para los tutores.`,
        data: toggled
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteConvenio(req, res, next) {
    try {
      const { id } = req.params;
      const result = await convenioService.deleteConvenio(Number(id), req.user);
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req, res, next) {
    try {
      const stats = await convenioService.getStats();
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadLogo(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No se subió ningún archivo de imagen.' }
        });
      }

      const fileUrl = `/uploads/convenios/${req.file.filename}`;
      res.status(200).json({
        success: true,
        message: 'Imagen subida exitosamente.',
        data: {
          url: fileUrl,
          filename: req.file.filename,
          size: req.file.size
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
