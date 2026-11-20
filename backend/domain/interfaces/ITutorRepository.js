/**
 * Contrato abstracto para el repositorio de tutores legales
 * Cumple con Clean Architecture y DIP (SOLID)
 */
export class ITutorRepository {
  async findById(id) {
    throw new Error('Método no implementado');
  }

  async findByCi(ci) {
    throw new Error('Método no implementado');
  }

  async findAll(includeInactive = false) {
    throw new Error('Método no implementado');
  }

  async search(query, limit = 15) {
    throw new Error('Método no implementado');
  }

  async create(tutorData) {
    throw new Error('Método no implementado');
  }

  async update(id, tutorData) {
    throw new Error('Método no implementado');
  }

  async getPatientsByTutorId(tutorId) {
    throw new Error('Método no implementado');
  }

  async findByPatientId(patientId) {
    throw new Error('Método no implementado');
  }
}
