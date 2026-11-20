import { AppError } from '../core/AppError.js';
import { RepositoryFactory } from '../core/RepositoryFactory.js';

export class RoomService {
  constructor(roomRepo = RepositoryFactory.getRoomRepository(), userRepo = RepositoryFactory.getUserRepository()) {
    this.roomRepo = roomRepo;
    this.userRepo = userRepo;
  }

  async getAllRooms(includeInactive = false) {
    return this.roomRepo.findAll(includeInactive);
  }

  async getRoomById(id) {
    const room = await this.roomRepo.findById(id);
    if (!room) {
      throw AppError.notFound(`El consultorio con ID ${id} no existe.`);
    }
    return room;
  }

  async createRoom(data, userId = null, ip = null) {
    if (!data.codigo || !data.nombre) {
      throw AppError.badRequest('El código y el nombre del consultorio son obligatorios.');
    }

    const existingCode = await this.roomRepo.findByCode(data.codigo);
    if (existingCode) {
      throw AppError.conflict(`Ya existe un consultorio registrado con el código "${data.codigo}".`);
    }

    if (data.capacidad !== undefined && (isNaN(data.capacidad) || data.capacidad <= 0)) {
      throw AppError.badRequest('La capacidad debe ser un número entero positivo.');
    }

    const created = await this.roomRepo.create(data);
    await this.userRepo.logAudit(userId, 'ROOM_CREATED', 'AMBIENTES', `Creación de consultorio: ${created.codigo} (${created.nombre})`, ip);

    return created;
  }

  async updateRoom(id, data, userId = null, ip = null) {
    const existing = await this.getRoomById(id);

    if (data.capacidad !== undefined && (isNaN(data.capacidad) || data.capacidad <= 0)) {
      throw AppError.badRequest('La capacidad del consultorio debe ser un número entero positivo.');
    }

    const updated = await this.roomRepo.update(id, data);
    await this.userRepo.logAudit(userId, 'ROOM_UPDATED', 'AMBIENTES', `Actualización de consultorio: ${existing.codigo}`, ip);

    return updated;
  }

  async deleteRoom(id, userId = null, ip = null) {
    const existing = await this.getRoomById(id);

    const deleted = await this.roomRepo.delete(id);
    if (!deleted) {
      throw AppError.badRequest(`No se pudo eliminar el consultorio con ID ${id}.`);
    }

    await this.userRepo.logAudit(userId, 'ROOM_DELETED', 'AMBIENTES', `Eliminación de consultorio: ${existing.codigo} (${existing.nombre})`, ip);

    return { success: true, message: `Consultorio ${existing.codigo} eliminado correctamente.` };
  }

  async getRoomStatus() {
    return this.roomRepo.getOccupancySummary();
  }
}
