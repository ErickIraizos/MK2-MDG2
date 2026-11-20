import { BatteryService } from '../services/batteryService.js';

const batteryService = new BatteryService();

export class BatteryController {
  static async getAllBatteries(req, res, next) {
    try {
      const batteries = await batteryService.getAllBatteries(req.query);
      res.status(200).json({
        success: true,
        data: batteries
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBatteryById(req, res, next) {
    try {
      const { id } = req.params;
      const battery = await batteryService.getBatteryById(Number(id));
      res.status(200).json({
        success: true,
        data: battery
      });
    } catch (error) {
      next(error);
    }
  }

  static async createBattery(req, res, next) {
    try {
      const battery = await batteryService.createBattery(req.body, req.user);
      res.status(201).json({
        success: true,
        message: 'Batería psicométrica registrada exitosamente en inventario.',
        data: battery
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBattery(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await batteryService.updateBattery(Number(id), req.body, req.user);
      res.status(200).json({
        success: true,
        message: 'Datos de la batería actualizados correctamente.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async checkTherapistStatus(req, res, next) {
    try {
      const { therapistId } = req.params;
      const status = await batteryService.checkTherapistStatus(Number(therapistId));
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  static async registerLoan(req, res, next) {
    try {
      const loan = await batteryService.registerLoan(req.body, req.user);
      res.status(201).json({
        success: true,
        message: '¡Préstamo de material clínico registrado con éxito!',
        data: loan
      });
    } catch (error) {
      next(error);
    }
  }

  static async registerReturn(req, res, next) {
    try {
      const { loanId } = req.params;
      const returned = await batteryService.registerReturn(Number(loanId), req.body, req.user);
      res.status(200).json({
        success: true,
        message: '¡Devolución de batería registrada! Material liberado a disponibilidad.',
        data: returned
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLoanHistory(req, res, next) {
    try {
      const history = await batteryService.getLoanHistory(req.query);
      res.status(200).json({
        success: true,
        data: history
      });
    } catch (error) {
      next(error);
    }
  }
}
