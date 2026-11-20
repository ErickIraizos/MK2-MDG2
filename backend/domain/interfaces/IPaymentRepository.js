export class IPaymentRepository {
  async createPayment(data) { throw new Error('Not implemented'); }
  async getPaymentById(id) { throw new Error('Not implemented'); }
  async getPaymentByAppointmentId(appointmentId) { throw new Error('Not implemented'); }
  async getPayments(filters = {}) { throw new Error('Not implemented'); }
  async updatePayment(id, data) { throw new Error('Not implemented'); }
  async verifyPayment(id, verificationData) { throw new Error('Not implemented'); }
  async getCashSummary(filters = {}) { throw new Error('Not implemented'); }
  async getQrConfig() { throw new Error('Not implemented'); }
  async updateQrConfig(configData) { throw new Error('Not implemented'); }
}
