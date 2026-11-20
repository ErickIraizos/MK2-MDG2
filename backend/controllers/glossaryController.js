import { GlossaryService } from '../services/glossaryService.js';

const service = new GlossaryService();

export class GlossaryController {
  static async getAll(req, res) {
    try {
      const { category, search, status } = req.query;
      const userRole = req.user?.rol;
      const terms = await service.getAllTerms({ category, search, status, userRole });
      return res.json({
        success: true,
        data: terms,
        count: terms.length
      });
    } catch (error) {
      console.error('[GlossaryController.getAll] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al consultar términos del glosario: ' + error.message
      });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const term = await service.getTermById(Number(id));
      return res.json({
        success: true,
        data: term
      });
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  static async create(req, res) {
    try {
      const user = req.user;
      const term = await service.createTerm(req.body, user);
      return res.status(201).json({
        success: true,
        data: term,
        message: 'Término clínico registrado exitosamente en el glosario institucional.'
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const user = req.user;
      const term = await service.updateTerm(Number(id), req.body, user);
      return res.json({
        success: true,
        data: term,
        message: 'Término actualizado correctamente.'
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deactivate(req, res) {
    try {
      const { id } = req.params;
      const term = await service.deactivateTerm(Number(id));
      return res.json({
        success: true,
        data: term,
        message: 'Término pasado a estado inactivo. Solo el Administrador puede reactivarlo.'
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async reactivate(req, res) {
    try {
      const { id } = req.params;
      const term = await service.reactivateTerm(Number(id));
      return res.json({
        success: true,
        data: term,
        message: 'Término reactivado exitosamente y ahora es visible en el glosario.'
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async delete(req, res) {
    // Protección anti-eliminación por error: pasa a inactivo
    return GlossaryController.deactivate(req, res);
  }
}
