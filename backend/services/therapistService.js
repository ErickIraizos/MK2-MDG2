import { AppError } from '../core/AppError.js';
import { RepositoryFactory } from '../core/RepositoryFactory.js';

export class TherapistService {
  constructor(
    therapistRepo = RepositoryFactory.getTherapistRepository(),
    userRepo = RepositoryFactory.getUserRepository()
  ) {
    this.therapistRepo = therapistRepo;
    this.userRepo = userRepo;
  }

  async getAllTherapists(includeInactive = false) {
    return this.therapistRepo.findAll(includeInactive);
  }

  async getTherapistById(id) {
    const therapist = await this.therapistRepo.findById(id);
    if (!therapist) {
      throw AppError.notFound(`No se encontró el especialista con ID ${id}`);
    }
    return therapist;
  }

  async getTherapistByUserId(userId) {
    const therapist = await this.therapistRepo.findByUserId(userId);
    return therapist || null;
  }

  async createTherapist(data, userId = null, ip = null) {
    const newTherapist = await this.therapistRepo.create(data);
    await this.userRepo.logAudit(
      userId,
      'THERAPIST_CREATED',
      'TERAPEUTAS',
      `Registro de especialista: ${newTherapist.nombres} ${newTherapist.apellidos} (${newTherapist.registro_profesional})`,
      ip
    );
    return newTherapist;
  }

  async updateTherapist(id, data, userId = null, ip = null) {
    const existing = await this.getTherapistById(id);
    const updated = await this.therapistRepo.update(id, data);

    await this.userRepo.logAudit(
      userId,
      'THERAPIST_UPDATED',
      'TERAPEUTAS',
      `Actualización de datos del especialista ${existing.registro_profesional}`,
      ip
    );

    return updated;
  }

  async deleteTherapist(id, userId = null, ip = null) {
    const existing = await this.getTherapistById(id);
    await this.therapistRepo.deleteLogical(id);

    await this.userRepo.logAudit(
      userId,
      'THERAPIST_DEACTIVATED',
      'TERAPEUTAS',
      `Baja de especialista ${existing.registro_profesional}: ${existing.nombres} ${existing.apellidos}`,
      ip
    );

    return { message: `Especialista ${existing.nombres} ${existing.apellidos} desactivado correctamente.` };
  }

  async getSpecialties() {
    return this.therapistRepo.getSpecialties();
  }
}
