/**
 * Contrato abstracto para el repositorio de terapeutas y especialistas clínicos
 * Cumple con Clean Architecture y DIP (SOLID)
 */
export class ITherapistRepository {
  async findById(id) {
    throw new Error('Método no implementado');
  }

  async findByUserId(userId) {
    throw new Error('Método no implementado');
  }

  async findAll(includeInactive = false) {
    throw new Error('Método no implementado');
  }

  async create(therapistData) {
    throw new Error('Método no implementado');
  }

  async update(id, therapistData) {
    throw new Error('Método no implementado');
  }

  async deleteLogical(id) {
    throw new Error('Método no implementado');
  }

  async getSpecialties() {
    throw new Error('Método no implementado');
  }
}
