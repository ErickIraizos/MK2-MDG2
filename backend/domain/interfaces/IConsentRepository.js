export class IConsentRepository {
  async createConsent(consentData) {
    throw new Error('Método createConsent() no implementado');
  }

  async findById(id) {
    throw new Error('Método findById() no implementado');
  }

  async findByPatientId(patientId) {
    throw new Error('Método findByPatientId() no implementado');
  }

  async findByTutorId(tutorId) {
    throw new Error('Método findByTutorId() no implementado');
  }

  async hasActiveConsent(patientId, tipoConsentimiento = null) {
    throw new Error('Método hasActiveConsent() no implementado');
  }

  async revokeConsent(id, motivo, userId) {
    throw new Error('Método revokeConsent() no implementado');
  }
}
