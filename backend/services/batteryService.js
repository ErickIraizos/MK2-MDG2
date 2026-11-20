import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { AppError } from '../core/AppError.js';

export class BatteryService {
  constructor() {
    this.batteryRepo = RepositoryFactory.getBatteryRepository();
    this.therapistRepo = RepositoryFactory.getTherapistRepository();
    this.patientRepo = RepositoryFactory.getPatientRepository();
    this.roomRepo = RepositoryFactory.getRoomRepository();
  }

  async getAllBatteries(filters = {}) {
    return this.batteryRepo.getAllBatteries(filters);
  }

  async getBatteryById(id) {
    const battery = await this.batteryRepo.getBatteryById(id);
    if (!battery) {
      throw AppError.notFound(`Batería psicométrica con ID ${id} no encontrada.`);
    }
    return battery;
  }

  async createBattery(data, currentUser) {
    if (!['ADMIN', 'RECEPCION'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo el personal de Administración y Recepción puede registrar nuevo material en inventario.');
    }
    if (!data.codigo_patrimonial || !data.nombre) {
      throw AppError.badRequest('El código patrimonial y el nombre de la prueba son obligatorios.');
    }
    return this.batteryRepo.createBattery(data);
  }

  async updateBattery(id, data, currentUser) {
    if (!['ADMIN', 'RECEPCION'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo Administración y Recepción pueden editar especificaciones de inventario.');
    }
    return this.batteryRepo.updateBattery(id, data);
  }

  async checkTherapistStatus(therapistId) {
    const therapist = await this.therapistRepo.findById(therapistId);
    if (!therapist) {
      throw AppError.notFound(`Especialista con ID ${therapistId} no encontrado.`);
    }
    return this.batteryRepo.checkTherapistLoanStatus(therapistId);
  }

  async registerLoan(loanData, currentUser) {
    const {
      bateria_id,
      terapeuta_id,
      ambiente_id,
      paciente_id,
      duracion_horas = 3,
      observaciones_entrega
    } = loanData;

    if (!bateria_id || !terapeuta_id) {
      throw AppError.badRequest('La batería y el terapeuta solicitante son obligatorios.');
    }

    const hours = Number(duracion_horas);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 72) {
      throw AppError.badRequest('La duración del préstamo debe estar entre 1 y 72 horas.');
    }

    // Calcular fecha estimada de devolución (la validación de mora RN-06 y disponibilidad ocurre de forma atómica en createLoan)
    const estimatedReturn = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    const loan = await this.batteryRepo.createLoan({
      bateria_id,
      terapeuta_id,
      ambiente_id: ambiente_id ? Number(ambiente_id) : null,
      paciente_id: paciente_id ? Number(paciente_id) : null,
      fecha_devolucion_estimada: estimatedReturn,
      observaciones_entrega: observaciones_entrega || 'Material clínico entregado en recepción con piezas completas.',
      entregado_por_usuario_id: currentUser.id
    });

    return loan;
  }

  async registerReturn(loanId, returnData, currentUser) {
    const loan = await this.batteryRepo.getLoanById(loanId);
    if (!loan) {
      throw AppError.notFound(`Préstamo con ID ${loanId} no encontrado.`);
    }

    if (loan.estado === 'DEVUELTO') {
      throw AppError.badRequest('Este material ya fue devuelto y registrado con anterioridad.');
    }

    return this.batteryRepo.returnLoan(loanId, {
      observaciones_recepcion: returnData.observaciones_recepcion || 'Material devuelto a casillero de recepción con inventario verificado.',
      estado_conservacion: returnData.estado_conservacion || null,
      recibido_por_usuario_id: currentUser.id
    });
  }

  async getLoanHistory(filters = {}) {
    return this.batteryRepo.getLoanHistory(filters);
  }
}
