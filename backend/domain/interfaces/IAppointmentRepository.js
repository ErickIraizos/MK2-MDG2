/**
 * Contrato abstracto para el repositorio de citas y agenda médica
 * Cumple con Clean Architecture y DIP (SOLID) - Módulo G (Sprint 6)
 */
export class IAppointmentRepository {
  async findById(id) {
    throw new Error('Método no implementado');
  }

  async findAll(filters = {}) {
    throw new Error('Método no implementado');
  }

  async create(appointmentData) {
    throw new Error('Método no implementado');
  }

  async update(id, appointmentData) {
    throw new Error('Método no implementado');
  }

  async updateStatus(id, estado, metadata = {}) {
    throw new Error('Método no implementado');
  }

  async cancel(id, motivoCancelacion, userId = null) {
    throw new Error('Método no implementado');
  }

  async checkCollision({ ambienteId, terapeutaId, fechaHoraInicio, fechaHoraFin, excludeId = null, bufferMinutes = 10 }) {
    throw new Error('Método no implementado');
  }

  async getTodayStats(dateStr = null) {
    throw new Error('Método no implementado');
  }
}

