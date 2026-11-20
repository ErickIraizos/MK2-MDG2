import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { AppError } from '../core/AppError.js';

export class WorkshopService {
  constructor() {
    this.workshopRepo = RepositoryFactory.getWorkshopRepository();
  }

  async getAllWorkshops(filters = {}) {
    return this.workshopRepo.getAllWorkshops(filters);
  }

  async getWorkshopById(id) {
    const workshop = await this.workshopRepo.getWorkshopById(id);
    if (!workshop) {
      throw AppError.notFound(`Taller o evento con ID ${id} no encontrado.`);
    }
    return workshop;
  }

  async createWorkshop(data, currentUser) {
    if (!['ADMIN'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo la Dirección y Administración pueden crear talleres y eventos formativos.');
    }

    if (!data.titulo || !data.titulo.trim()) {
      throw AppError.badRequest('El título del taller es obligatorio.');
    }

    if (!data.fecha || !data.fecha.trim()) {
      throw AppError.badRequest('La fecha programada es obligatoria.');
    }

    if (!data.hora || !data.hora.trim()) {
      throw AppError.badRequest('El horario del evento es obligatorio.');
    }

    if (!data.lugar || !data.lugar.trim()) {
      throw AppError.badRequest('El lugar o plataforma de encuentro es obligatorio.');
    }

    return this.workshopRepo.createWorkshop(data, currentUser);
  }

  async updateWorkshop(id, data, currentUser) {
    if (!['ADMIN'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo la Dirección y Administración pueden modificar talleres y eventos.');
    }

    const existing = await this.getWorkshopById(id);
    if (!existing) {
      throw AppError.notFound(`Taller con ID ${id} no existe.`);
    }

    return this.workshopRepo.updateWorkshop(id, data, currentUser);
  }

  async toggleActivo(id, currentUser) {
    if (!['ADMIN'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo el Administrador puede publicar o pausar talleres.');
    }

    return this.workshopRepo.toggleActivo(id, currentUser);
  }

  async deleteWorkshop(id, currentUser) {
    if (!['ADMIN'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo el Administrador puede eliminar talleres y eventos formativos.');
    }

    const success = await this.workshopRepo.deleteWorkshop(id, currentUser);
    if (!success) {
      throw AppError.notFound(`Taller con ID ${id} no encontrado.`);
    }
    return { success: true, message: 'Taller eliminado correctamente de la cartelera.' };
  }

  async getStats() {
    return this.workshopRepo.getStats();
  }
}
