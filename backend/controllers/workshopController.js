import { WorkshopService } from '../services/workshopService.js';

const workshopService = new WorkshopService();

export class WorkshopController {
  static async getWorkshops(req, res, next) {
    try {
      const isAdmin = req.user?.rol === 'ADMIN';
      const filters = {
        ...req.query,
        soloActivos: isAdmin ? (req.query.soloActivos !== 'false') : true
      };

      const workshops = await workshopService.getAllWorkshops(filters);
      res.status(200).json({
        success: true,
        data: workshops
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
      const workshops = await workshopService.getAllWorkshops(filters);
      const stats = await workshopService.getStats();

      res.status(200).json({
        success: true,
        data: workshops,
        stats
      });
    } catch (error) {
      next(error);
    }
  }

  static async getWorkshopById(req, res, next) {
    try {
      const { id } = req.params;
      const workshop = await workshopService.getWorkshopById(Number(id));
      res.status(200).json({
        success: true,
        data: workshop
      });
    } catch (error) {
      next(error);
    }
  }

  static async createWorkshop(req, res, next) {
    try {
      const workshop = await workshopService.createWorkshop(req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Taller o evento clínico registrado exitosamente.',
        data: workshop
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateWorkshop(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await workshopService.updateWorkshop(Number(id), req.body, req.user);
      res.status(200).json({
        success: true,
        message: 'Taller o evento formativo actualizado exitosamente.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleActivo(req, res, next) {
    try {
      const { id } = req.params;
      const toggled = await workshopService.toggleActivo(Number(id), req.user);
      res.status(200).json({
        success: true,
        message: `Taller ${toggled.activo === 1 ? 'publicado' : 'pausado'} en cartelera.`,
        data: toggled
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteWorkshop(req, res, next) {
    try {
      const { id } = req.params;
      const result = await workshopService.deleteWorkshop(Number(id), req.user);
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
      const stats = await workshopService.getStats();
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}
