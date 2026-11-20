/**
 * Contrato abstracto para el repositorio de usuarios
 * Principio de Inversión de Dependencias (SOLID)
 */
export class IUserRepository {
  async findById(id) {
    throw new Error('Método no implementado');
  }

  async findByEmail(email) {
    throw new Error('Método no implementado');
  }

  async findAll(filters = {}) {
    throw new Error('Método no implementado');
  }

  async create(userData) {
    throw new Error('Método no implementado');
  }

  async updatePassword(id, newPasswordHash) {
    throw new Error('Método no implementado');
  }

  async updateLastAccess(id) {
    throw new Error('Método no implementado');
  }

  async updateRole(id, roleId) {
    throw new Error('Método no implementado');
  }

  async updateStatus(id, activo) {
    throw new Error('Método no implementado');
  }

  async delete(id, motivo, desvinculadoPorId) {
    throw new Error('Método no implementado');
  }

  async restore(id) {
    throw new Error('Método no implementado');
  }

  async getInactiveUsers() {
    throw new Error('Método no implementado');
  }

  async logAudit(userId, accion, modulo, detalles, ip) {
    throw new Error('Método no implementado');
  }

  async getAuditLogs(limit = 100) {
    throw new Error('Método no implementado');
  }
}
