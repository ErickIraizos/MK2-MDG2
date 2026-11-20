export class IBatteryRepository {
  async getAllBatteries(filters = {}) { throw new Error('Not implemented'); }
  async getBatteryById(id) { throw new Error('Not implemented'); }
  async createBattery(data) { throw new Error('Not implemented'); }
  async updateBattery(id, data) { throw new Error('Not implemented'); }
  async createLoan(loanData) { throw new Error('Not implemented'); }
  async returnLoan(loanId, returnData) { throw new Error('Not implemented'); }
  async getActiveLoans(filters = {}) { throw new Error('Not implemented'); }
  async checkTherapistLoanStatus(therapistId) { throw new Error('Not implemented'); }
  async getLoanHistory(filters = {}) { throw new Error('Not implemented'); }
}
