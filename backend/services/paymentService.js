import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { AppError } from '../core/AppError.js';
import { assertPatientAccess, getTutorForUser, getTherapistForUser } from '../core/accessControl.js';
import { getBoliviaNowSqlString, diffCalendarDaysBolivia } from '../utils/dateTime.js';

export class PaymentService {
  constructor() {
    this.paymentRepo = RepositoryFactory.getPaymentRepository();
    this.appointmentRepo = RepositoryFactory.getAppointmentRepository();
    this.therapistRepo = RepositoryFactory.getTherapistRepository();
    this.tutorRepo = RepositoryFactory.getTutorRepository();
    this.patientRepo = RepositoryFactory.getPatientRepository();
  }

  _assertPositiveAmount(rawAmount, fieldName = 'monto') {
    const num = Number(rawAmount);
    if (rawAmount === undefined || rawAmount === null || rawAmount === '' || !Number.isFinite(num) || num <= 0) {
      throw AppError.badRequest(`El campo ${fieldName} debe ser un importe numérico estrictamente mayor a 0.`);
    }
    return Math.round(num * 100) / 100;
  }

  async _assertPaymentReadWriteAccess(payment, currentUser, actionLabel = 'acceder a este pago') {
    if (!currentUser) {
      throw AppError.unauthorized('Autenticación requerida.');
    }
    if (['ADMIN', 'RECEPCION'].includes(currentUser.rol)) {
      return;
    }
    if (currentUser.rol === 'TERAPEUTA') {
      const therapist = await getTherapistForUser(currentUser);
      if (!therapist || Number(payment.terapeuta_id) !== Number(therapist.id)) {
        throw AppError.forbidden(`No tiene autorización para ${actionLabel} de otro especialista.`);
      }
      return;
    }
    if (currentUser.rol === 'TUTOR') {
      const tutor = await getTutorForUser(currentUser);
      if (!tutor) {
        throw AppError.forbidden('Perfil de tutor no vinculado para consultar pagos.');
      }
      if (payment.tutor_id && Number(payment.tutor_id) === Number(tutor.id)) {
        return;
      }
      await assertPatientAccess(payment.paciente_id, currentUser, {
        allowTutor: true,
        actionDescription: actionLabel
      });
      return;
    }
    throw AppError.forbidden('Rol no autorizado para operar pagos.');
  }

  async getPayments(currentUser, queryFilters = {}) {
    const filters = { ...queryFilters };

    // Aislamiento estricto por rol:
    if (currentUser?.rol === 'TERAPEUTA') {
      const therapist = await getTherapistForUser(currentUser);
      if (!therapist) {
        throw AppError.forbidden('No se encontró el registro clínico del terapeuta asociado.');
      }
      // El terapeuta SOLO puede ver sus propias sesiones y pagos
      filters.terapeutaId = therapist.id;
    } else if (currentUser?.rol === 'TUTOR') {
      const tutor = await getTutorForUser(currentUser);
      if (!tutor) {
        return [];
      }
      filters.tutorId = tutor.id;
      delete filters.terapeutaId;
    } else if (['ADMIN', 'RECEPCION'].includes(currentUser?.rol)) {
      // Admin y Recepción pueden ver todo o filtrar por el terapeuta seleccionado
      if (queryFilters.terapeutaId) {
        filters.terapeutaId = Number(queryFilters.terapeutaId);
      }
    } else {
      throw AppError.forbidden('Rol no autorizado.');
    }

    return this.paymentRepo.getPayments(filters);
  }

  async getPaymentById(id, currentUser = null) {
    const payment = await this.paymentRepo.getPaymentById(id);
    if (!payment) {
      throw AppError.notFound(`Pago con ID ${id} no encontrado.`);
    }

    if (currentUser) {
      await this._assertPaymentReadWriteAccess(payment, currentUser, 'visualizar este comprobante o pago');
    }

    return payment;
  }

  async getPaymentByAppointmentId(appointmentId) {
    return this.paymentRepo.getPaymentByAppointmentId(appointmentId);
  }

  async ensurePaymentForAppointment(appointmentId, currentUser = null) {
    // Obtener datos de la cita primero para validar pertenencia
    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) {
      throw AppError.notFound(`Cita con ID ${appointmentId} no encontrada.`);
    }

    if (currentUser) {
      if (currentUser.rol === 'TERAPEUTA') {
        const therapist = await getTherapistForUser(currentUser);
        if (!therapist || Number(appointment.terapeuta_id) !== Number(therapist.id)) {
          throw AppError.forbidden('No tiene autorización para gestionar el cobro de citas de otro especialista.');
        }
      } else if (currentUser.rol === 'TUTOR') {
        await assertPatientAccess(appointment.paciente_id, currentUser, {
          allowTutor: true,
          actionDescription: 'consultar o gestionar el pago de esta cita'
        });
      }
    }

    let payment = await this.paymentRepo.getPaymentByAppointmentId(appointmentId);
    if (payment) return payment;

    // Resolver tutor
    let tutorId = null;
    try {
      const tutorList = await this.tutorRepo.findByPatientId(appointment.paciente_id);
      const tutor = Array.isArray(tutorList) ? (tutorList.find(t => t.es_principal) || tutorList[0]) : tutorList;
      if (tutor) tutorId = tutor.id;
    } catch (e) {}

    let monto = appointment.arancel_personalizado || appointment.servicio_arancel;
    if (!monto && appointment.servicio_id && appointment.terapeuta_id) {
      try {
        const tariffs = await this.therapistRepo.getTherapistTariffs(appointment.terapeuta_id);
        const match = tariffs.find(t => Number(t.servicio_id) === Number(appointment.servicio_id));
        if (match && match.arancel_terapeuta_bob) {
          monto = match.arancel_terapeuta_bob;
        }
      } catch (e) {}
    }
    if (!monto) monto = 150.00;
    const validMonto = this._assertPositiveAmount(monto, 'monto_bob');

    const payload = {
      cita_id: appointment.id,
      paciente_id: appointment.paciente_id,
      tutor_id: tutorId,
      terapeuta_id: appointment.terapeuta_id,
      monto_bob: validMonto,
      metodo_pago: 'QR_SIMPLE',
      estado: 'PENDIENTE',
      observaciones: `Arancel correspondiente a ${appointment.servicio_nombre || appointment.servicio_personalizado || 'Sesión Terapéutica'}`
    };

    if (typeof this.paymentRepo.ensureAppointmentPaymentAtomic === 'function') {
      payment = await this.paymentRepo.ensureAppointmentPaymentAtomic(appointment.id, payload);
    } else {
      payment = await this.paymentRepo.createPayment(payload);
    }

    return payment;
  }

  // EMISIÓN MANUAL DE COBRO A PACIENTE/TUTOR POR TERAPEUTA O RECEPCIÓN
  async createPaymentRequest(currentUser, { paciente_id, cita_id = null, servicio_nombre, monto_bob, mensaje_tutor, terapeuta_id = null }) {
    if (!['TERAPEUTA', 'ADMIN', 'RECEPCION'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo especialistas o recepción pueden emitir solicitudes de cobro a tutores.');
    }

    const monto = this._assertPositiveAmount(monto_bob, 'monto_bob');

    let therapistId = null;
    if (currentUser.rol === 'TERAPEUTA') {
      const therapist = await this.therapistRepo.findByUserId(currentUser.id);
      if (!therapist) {
        throw AppError.notFound('Ficha de especialista no encontrada para el usuario activo.');
      }
      therapistId = therapist.id;
    } else {
      therapistId = Number(terapeuta_id);
      if (!therapistId) {
        throw AppError.badRequest('Debe especificar el terapeuta emisor.');
      }
    }

    const patient = await this.patientRepo.findById(Number(paciente_id));
    if (!patient) {
      throw AppError.notFound(`Paciente con ID ${paciente_id} no encontrado.`);
    }

    let tutorId = null;
    try {
      const tutorList = await this.tutorRepo.findByPatientId(patient.id);
      const tutor = Array.isArray(tutorList) ? (tutorList.find(t => t.es_principal) || tutorList[0]) : tutorList;
      if (tutor) tutorId = tutor.id;
    } catch (e) {}

    const servicio = (servicio_nombre || 'Consulta Clínica Especializada').trim();
    const mensaje = (mensaje_tutor || `Arancel correspondiente a ${servicio}`).trim();

    const payment = await this.paymentRepo.createPayment({
      cita_id: cita_id ? Number(cita_id) : null,
      paciente_id: patient.id,
      tutor_id: tutorId,
      terapeuta_id: therapistId,
      monto_bob: monto,
      metodo_pago: 'QR_SIMPLE',
      estado: 'PENDIENTE',
      observaciones: mensaje,
      servicio_nombre: servicio
    });

    return payment;
  }

  async uploadReceipt(paymentId, { fileUrl, fileType, numeroTransaccion, observaciones }, currentUser = null) {
    const payment = await this.paymentRepo.getPaymentById(paymentId);
    if (!payment) {
      throw AppError.notFound(`Pago con ID ${paymentId} no encontrado.`);
    }

    if (currentUser) {
      await this._assertPaymentReadWriteAccess(payment, currentUser, 'subir un comprobante para este pago');
    }

    if (payment.estado === 'VERIFICADO' || payment.estado === 'COMPLETADO') {
      throw AppError.conflict('Este pago ya fue verificado y acreditado; no es posible modificar ni reemplazar su comprobante.');
    }

    const cleanTx = numeroTransaccion ? String(numeroTransaccion).trim() : null;
    if (cleanTx && typeof this.paymentRepo.findConflictingTransaction === 'function') {
      const dup = await this.paymentRepo.findConflictingTransaction(cleanTx, paymentId);
      if (dup) {
        throw AppError.conflict(`El número de transacción "${cleanTx}" ya fue registrado en otro comprobante activo o verificado.`);
      }
    }

    const updated = await this.paymentRepo.updatePayment(paymentId, {
      comprobante_url: fileUrl,
      comprobante_tipo: fileType,
      numero_transaccion: cleanTx,
      observaciones: observaciones || payment.observaciones,
      estado: 'EN_REVISION',
      motivo_rechazo: null,
      fecha_pago: getBoliviaNowSqlString()
    });

    return updated;
  }

  async verifyPayment(paymentId, { estado, observaciones, motivoRechazo }, currentUser) {
    const payment = await this.paymentRepo.getPaymentById(paymentId);
    if (!payment) {
      throw AppError.notFound(`Pago con ID ${paymentId} no encontrado.`);
    }

    // Regla de Aprobación Dual:
    // Pueden aprobar: ADMIN, RECEPCION o el TERAPEUTA ASIGNADO a la sesión
    const isStaff = ['ADMIN', 'RECEPCION'].includes(currentUser?.rol);
    let isAssignedTherapist = false;

    if (currentUser?.rol === 'TERAPEUTA') {
      const therapist = await this.therapistRepo.findByUserId(currentUser.id);
      if (therapist && payment.terapeuta_id === therapist.id) {
        isAssignedTherapist = true;
      }
    }

    if (!isStaff && !isAssignedTherapist) {
      throw AppError.forbidden('Solo la Recepción, Dirección o el Especialista asignado a la sesión pueden aprobar este comprobante.');
    }

    let targetEstado = estado;
    if (targetEstado === 'COMPLETADO') targetEstado = 'VERIFICADO';

    if (!['VERIFICADO', 'RECHAZADO'].includes(targetEstado)) {
      throw AppError.badRequest('El estado de verificación debe ser VERIFICADO o RECHAZADO.');
    }

    const verified = await this.paymentRepo.verifyPayment(paymentId, {
      verificado_por_usuario_id: currentUser.id,
      estado: targetEstado,
      observaciones: observaciones || (targetEstado === 'VERIFICADO' ? `Aprobado por ${currentUser.nombre_completo || currentUser.nombre} (${currentUser.rol})` : null),
      motivo_rechazo: targetEstado === 'RECHAZADO' ? motivoRechazo : null
    });

    return verified;
  }

  async registerCashPayment(appointmentId, { monto, observaciones }, currentUser) {
    // Registro directo de cobro en efectivo en recepción o por terapeuta
    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) {
      throw AppError.notFound(`Cita con ID ${appointmentId} no encontrada.`);
    }

    if (currentUser?.rol === 'TERAPEUTA') {
      const therapist = await getTherapistForUser(currentUser);
      if (!therapist || Number(appointment.terapeuta_id) !== Number(therapist.id)) {
        throw AppError.forbidden('Solo puede registrar cobros en efectivo de sus propias citas asignadas.');
      }
    }

    const hasExplicitMonto = monto !== undefined && monto !== null && monto !== '';
    const rawAmount = hasExplicitMonto
      ? monto
      : (appointment.arancel_personalizado || appointment.servicio_arancel || 150);
    const validMonto = this._assertPositiveAmount(rawAmount, 'monto');

    let tutorId = null;
    try {
      const tutorList = await this.tutorRepo.findByPatientId(appointment.paciente_id);
      const tutor = Array.isArray(tutorList) ? (tutorList.find(t => t.es_principal) || tutorList[0]) : tutorList;
      if (tutor) tutorId = tutor.id;
    } catch (e) {}

    const cashPayload = {
      cita_id: appointment.id,
      paciente_id: appointment.paciente_id,
      tutor_id: tutorId,
      terapeuta_id: appointment.terapeuta_id,
      monto_bob: validMonto,
      metodo_pago: 'EFECTIVO',
      estado: 'VERIFICADO',
      numero_transaccion: `EFE-${Date.now().toString().slice(-6)}`,
      observaciones: observaciones || `Cobro en efectivo registrado por ${currentUser.nombre_completo || currentUser.nombre || 'Recepción'}`,
      verificado_por_usuario_id: currentUser.id,
      fecha_pago: getBoliviaNowSqlString()
    };

    if (typeof this.paymentRepo.registerCashPaymentAtomic === 'function') {
      return this.paymentRepo.registerCashPaymentAtomic(appointment.id, cashPayload);
    }

    const payment = await this.paymentRepo.createPayment(cashPayload);
    await this.paymentRepo.verifyPayment(payment.id, {
      verificado_por_usuario_id: currentUser.id,
      estado: 'VERIFICADO',
      observaciones: 'Cobro en efectivo acreditado en caja'
    });

    return this.paymentRepo.getPaymentById(payment.id);
  }

  async getCashSummary(currentUser, queryFilters = {}) {
    const filters = { ...queryFilters };

    if (currentUser?.rol === 'TERAPEUTA') {
      const therapist = await this.therapistRepo.findByUserId(currentUser.id);
      if (therapist) filters.terapeutaId = therapist.id;
    } else if (['ADMIN', 'RECEPCION'].includes(currentUser?.rol)) {
      if (queryFilters.terapeutaId) filters.terapeutaId = Number(queryFilters.terapeutaId);
    }

    return this.paymentRepo.getCashSummary(filters);
  }

  async getQrConfig() {
    return this.paymentRepo.getQrConfig();
  }

  async updateQrConfig(configData, currentUser) {
    if (!['ADMIN', 'RECEPCION'].includes(currentUser?.rol)) {
      throw AppError.forbidden('Solo Administración y Recepción pueden actualizar la configuración del QR institucional.');
    }
    return this.paymentRepo.updateQrConfig(configData, currentUser.id);
  }

  // =========================================================================
  // GESTIÓN DE TARIFARIOS Y QR PERSONAL DEL ESPECIALISTA (SPRINT 10 REFINADO)
  // =========================================================================
  async getTherapistPaymentConfig(therapistId, forTutor = false) {
    const therapist = await this.therapistRepo.findById(Number(therapistId));
    if (!therapist) {
      throw AppError.notFound(`Especialista con ID ${therapistId} no encontrado.`);
    }

    const tariffs = await this.therapistRepo.getTherapistTariffs(Number(therapistId));
    const clinicQr = await this.paymentRepo.getQrConfig();

    const fechaVencimiento = therapist.qr_fecha_vencimiento || null;
    let diasParaVencer = null;
    let qrVencido = false;
    let qrPorVencer = false;

    if (fechaVencimiento) {
      const diffDias = diffCalendarDaysBolivia(fechaVencimiento);
      diasParaVencer = diffDias;
      if (diffDias !== null) {
        if (diffDias < 0) {
          qrVencido = true;
        } else if (diffDias <= 5) {
          qrPorVencer = true;
        }
      }
    }

    const hasPersonalQr = !!therapist.qr_cobro_url;
    // Si el QR está vencido y es consultado por el tutor, el sistema activa automáticamente el QR institucional
    const useInstitutionalFallback = !hasPersonalQr || (forTutor && qrVencido);

    return {
      therapist_id: therapist.id,
      therapist_nombre: `${therapist.nombres} ${therapist.apellidos}`.trim(),
      qr_url: useInstitutionalFallback
        ? (clinicQr.PAGO_QR_IMAGEN || '/uploads/qr/default_qr_psi_aprende.svg')
        : therapist.qr_cobro_url,
      qr_personal_url: therapist.qr_cobro_url || null,
      qr_fecha_vencimiento: fechaVencimiento,
      dias_para_vencer: diasParaVencer,
      qr_vencido: qrVencido,
      qr_por_vencer: qrPorVencer,
      qr_url_institucional: clinicQr.PAGO_QR_IMAGEN || '/uploads/qr/default_qr_psi_aprende.svg',
      banco_nombre: useInstitutionalFallback
        ? (clinicQr.PAGO_BANCO_NOMBRE || 'Banco Unión S.A.')
        : (therapist.banco_nombre || clinicQr.PAGO_BANCO_NOMBRE || 'Banco Unión S.A.'),
      cuenta_numero: useInstitutionalFallback
        ? (clinicQr.PAGO_CUENTA_NUMERO || '1000004829103')
        : (therapist.cuenta_numero || clinicQr.PAGO_CUENTA_NUMERO || '1000004829103'),
      cuenta_titular: useInstitutionalFallback
        ? (clinicQr.PAGO_CUENTA_TITULAR || 'Centro PSI Aprende SRL')
        : (therapist.cuenta_titular || `${therapist.nombres} ${therapist.apellidos}`.trim()),
      instrucciones: useInstitutionalFallback
        ? (clinicQr.PAGO_QR_INSTRUCCIONES || 'Escanee el código QR institucional y adjunte el comprobante.')
        : `Escanee el código QR personal del especialista desde su app de banco móvil y adjunte el comprobante.`,
      es_qr_personal: hasPersonalQr && !useInstitutionalFallback,
      qr_vencido_fallback_activo: (forTutor && hasPersonalQr && qrVencido),
      arancel_base_bob: therapist.arancel_base_bob || 150.00,
      tariffs
    };
  }

  async getMyTherapistPaymentConfig(currentUser) {
    if (currentUser?.rol !== 'TERAPEUTA') {
      throw AppError.forbidden('Esta acción solo está disponible para usuarios con rol TERAPEUTA.');
    }
    const therapist = await this.therapistRepo.findByUserId(currentUser.id);
    if (!therapist) {
      throw AppError.notFound('No se encontró ficha de terapeuta vinculada a este usuario.');
    }

    const tariffs = await this.therapistRepo.getTherapistTariffs(Number(therapist.id));
    const clinicQr = await this.paymentRepo.getQrConfig();

    const fechaVencimiento = therapist.qr_fecha_vencimiento || null;
    let diasParaVencer = null;
    let qrVencido = false;
    let qrPorVencer = false;

    if (fechaVencimiento) {
      const diffDias = diffCalendarDaysBolivia(fechaVencimiento);
      diasParaVencer = diffDias;
      if (diffDias !== null) {
        if (diffDias < 0) {
          qrVencido = true;
        } else if (diffDias <= 5) {
          qrPorVencer = true;
        }
      }
    }

    return {
      therapist_id: therapist.id,
      therapist_nombre: `${therapist.nombres} ${therapist.apellidos}`.trim(),
      qr_url: therapist.qr_cobro_url || null,
      qr_fecha_vencimiento: fechaVencimiento,
      dias_para_vencer: diasParaVencer,
      qr_vencido: qrVencido,
      qr_por_vencer: qrPorVencer,
      qr_url_institucional: clinicQr.PAGO_QR_IMAGEN || '/uploads/qr/default_qr_psi_aprende.svg',
      banco_nombre: therapist.banco_nombre || '',
      cuenta_numero: therapist.cuenta_numero || '',
      cuenta_titular: therapist.cuenta_titular || `${therapist.nombres} ${therapist.apellidos}`.trim(),
      es_qr_personal: !!therapist.qr_cobro_url,
      arancel_base_bob: therapist.arancel_base_bob || 150.00,
      tariffs
    };
  }

  async updateMyTherapistPaymentConfig(currentUser, { tariffs, banco_nombre, cuenta_numero, cuenta_titular, arancel_base_bob, qr_fecha_vencimiento }) {
    if (currentUser?.rol !== 'TERAPEUTA') {
      throw AppError.forbidden('Solo el especialista titular puede actualizar su tarifario y datos bancarios.');
    }
    const therapist = await this.therapistRepo.findByUserId(currentUser.id);
    if (!therapist) {
      throw AppError.notFound('No se encontró ficha de terapeuta vinculada a este usuario.');
    }

    // 1. Actualizar datos bancarios, arancel base y fecha de vencimiento del QR
    const updateData = {};
    if (banco_nombre !== undefined) updateData.banco_nombre = banco_nombre.trim();
    if (cuenta_numero !== undefined) updateData.cuenta_numero = cuenta_numero.trim();
    if (cuenta_titular !== undefined) updateData.cuenta_titular = cuenta_titular.trim();
    if (arancel_base_bob !== undefined) updateData.arancel_base_bob = Number(arancel_base_bob);
    if (qr_fecha_vencimiento !== undefined) updateData.qr_fecha_vencimiento = qr_fecha_vencimiento ? qr_fecha_vencimiento.trim() : null;

    if (Object.keys(updateData).length > 0) {
      await this.therapistRepo.update(therapist.id, updateData);
    }

    // 2. Si se enviaron tarifas por servicio, actualizarlas
    if (Array.isArray(tariffs) && tariffs.length > 0) {
      await this.therapistRepo.saveTherapistTariffs(therapist.id, tariffs);
    }

    return this.getTherapistPaymentConfig(therapist.id);
  }

  async uploadTherapistQr(currentUser, fileUrl, qr_fecha_vencimiento = null) {
    if (currentUser?.rol !== 'TERAPEUTA') {
      throw AppError.forbidden('Solo especialistas pueden subir su propio código QR bancario.');
    }
    const therapist = await this.therapistRepo.findByUserId(currentUser.id);
    if (!therapist) {
      throw AppError.notFound('Ficha de especialista no encontrada.');
    }

    const updateData = { qr_cobro_url: fileUrl };
    if (qr_fecha_vencimiento) {
      updateData.qr_fecha_vencimiento = qr_fecha_vencimiento.trim();
    }

    await this.therapistRepo.update(therapist.id, updateData);
    return this.getTherapistPaymentConfig(therapist.id);
  }
}
