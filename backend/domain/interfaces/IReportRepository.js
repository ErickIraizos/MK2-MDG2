export class IReportRepository {
  async createReport(reportData) {
    throw new Error('Método createReport() no implementado');
  }

  async findById(id) {
    throw new Error('Método findById() no implementado');
  }

  async findByPatientId(patientId, options = {}) {
    throw new Error('Método findByPatientId() no implementado');
  }

  async findByTherapistId(therapistId) {
    throw new Error('Método findByTherapistId() no implementado');
  }

  async updateReport(id, updateData) {
    throw new Error('Método updateReport() no implementado');
  }

  async updateDocxPath(id, docxPath) {
    throw new Error('Método updateDocxPath() no implementado');
  }

  async deleteReport(id) {
    throw new Error('Método deleteReport() no implementado');
  }
}
