/**
 * Contrato abstracto para el repositorio de pacientes
 * Cumple con Clean Architecture y DIP (SOLID)
 */
export class IPatientRepository {
  async findById(id) {
    throw new Error('Método no implementado');
  }

  async findByCode(codigoExpediente) {
    throw new Error('Método no implementado');
  }

  async findAll(filters = {}) {
    throw new Error('Método no implementado');
  }

  async search(query, limit = 20) {
    throw new Error('Método no implementado');
  }

  async getNextCorrelativeCode() {
    throw new Error('Método no implementado');
  }

  async create(patientData) {
    throw new Error('Método no implementado');
  }

  async update(id, patientData) {
    throw new Error('Método no implementado');
  }

  async deleteLogical(id, usuarioId = null, motivoBaja = null) {
    throw new Error('Método no implementado');
  }

  async restore(id) {
    throw new Error('Método no implementado');
  }

  async checkCiExists(ci, excludeId = null) {
    throw new Error('Método no implementado');
  }

  async createDerivation(derivationData) {
    throw new Error('Método no implementado');
  }

  async getDerivationsByPatientId(pacienteId) {
    throw new Error('Método no implementado');
  }

  async getTherapistByUserId(userId) {
    throw new Error('Método no implementado');
  }

  async getTutorsByPatientId(patientId) {
    throw new Error('Método no implementado');
  }

  async linkTutor(patientId, tutorId, parentesco = 'TUTOR', esPrincipal = 1) {
    throw new Error('Método no implementado');
  }

  async unlinkTutor(patientId, tutorId) {
    throw new Error('Método no implementado');
  }

  async getSiblings(patientId) {
    throw new Error('Método no implementado');
  }
}

