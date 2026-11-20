import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { AppError } from '../core/AppError.js';

export class ConvenioService {
  constructor() {
    this.convenioRepo = RepositoryFactory.getConvenioRepository();
  }

  async getAllConvenios(filters = {}) {
    return this.convenioRepo.getAllConvenios(filters);
  }

  async getConvenioById(id) {
    const convenio = await this.convenioRepo.getConvenioById(id);
    if (!convenio) {
      throw AppError.notFound(`Convenio institucional con ID ${id} no encontrado.`);
    }
    return convenio;
  }

  async createConvenio(data, currentUser) {
    if (!['ADMIN'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo la Dirección y Administración pueden registrar convenios institucionales.');
    }

    if (!data.nombre_institucion || !data.nombre_institucion.trim()) {
      throw AppError.badRequest('El nombre de la institución es obligatorio.');
    }

    if (!data.tipo_institucion) {
      throw AppError.badRequest('El tipo de institución es obligatorio.');
    }

    if (!data.descripcion_convenio || !data.descripcion_convenio.trim()) {
      throw AppError.badRequest('La descripción del convenio es obligatoria.');
    }

    return this.convenioRepo.createConvenio(data, currentUser);
  }

  async updateConvenio(id, data, currentUser) {
    if (!['ADMIN'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo la Dirección y Administración pueden modificar convenios institucionales.');
    }

    const existing = await this.getConvenioById(id);
    if (!existing) {
      throw AppError.notFound(`Convenio con ID ${id} no existe.`);
    }

    return this.convenioRepo.updateConvenio(id, data, currentUser);
  }

  async toggleActivo(id, currentUser) {
    if (!['ADMIN'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo el Administrador puede activar o desactivar convenios.');
    }

    return this.convenioRepo.toggleActivo(id, currentUser);
  }

  async deleteConvenio(id, currentUser) {
    if (!['ADMIN'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo el Administrador puede eliminar convenios institucionales.');
    }

    const success = await this.convenioRepo.deleteConvenio(id, currentUser);
    if (!success) {
      throw AppError.notFound(`Convenio con ID ${id} no encontrado.`);
    }
    return { success: true, message: 'Convenio eliminado correctamente.' };
  }

  async getStats() {
    return this.convenioRepo.getStats();
  }
}
