import { RoomService } from '../services/roomService.js';
import { RepositoryFactory } from '../core/RepositoryFactory.js';

const roomService = new RoomService();

export class RoomController {
  static async getServices(req, res, next) {
    try {
      const roomRepo = RepositoryFactory.getRoomRepository();
      const services = await roomRepo.getActiveServices();

      res.status(200).json({
        success: true,
        data: services
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAll(req, res, next) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const rooms = await roomService.getAllRooms(includeInactive);
      res.status(200).json({
        success: true,
        data: rooms
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const room = await roomService.getRoomById(Number(req.params.id));
      res.status(200).json({
        success: true,
        data: room
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'];
      const created = await roomService.createRoom(req.body, req.user?.id, ip);
      res.status(201).json({
        success: true,
        message: 'Consultorio creado exitosamente.',
        data: created
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'];
      const updated = await roomService.updateRoom(Number(req.params.id), req.body, req.user?.id, ip);
      res.status(200).json({
        success: true,
        message: 'Consultorio actualizado exitosamente.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'];
      const result = await roomService.deleteRoom(Number(req.params.id), req.user?.id, ip);
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }

  static async getStatus(req, res, next) {
    try {
      const summary = await roomService.getRoomStatus();
      res.status(200).json({
        success: true,
        data: summary
      });
    } catch (err) {
      next(err);
    }
  }
}
