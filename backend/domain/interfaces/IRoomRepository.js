/**
 * Contrato abstracto para la persistencia de infraestructura de consultorios
 */
export class IRoomRepository {
  async findAll(includeInactive = false) {
    throw new Error('Método no implementado');
  }

  async findById(id) {
    throw new Error('Método no implementado');
  }

  async findByCode(code) {
    throw new Error('Método no implementado');
  }

  async create(roomData) {
    throw new Error('Método no implementado');
  }

  async update(id, roomData) {
    throw new Error('Método no implementado');
  }

  async delete(id) {
    throw new Error('Método no implementado');
  }

  async getOccupancySummary() {
    throw new Error('Método no implementado');
  }
}
