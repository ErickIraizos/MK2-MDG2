import { AppError } from '../core/AppError.js';
import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { notificationService } from './notificationService.js';
import { webPushService } from './webPushService.js';
import { appointmentSchedulerService } from './appointmentSchedulerService.js';

export class AppointmentService {
  constructor(
    appointmentRepo = RepositoryFactory.getAppointmentRepository(),
    patientRepo = RepositoryFactory.getPatientRepository(),
    therapistRepo = RepositoryFactory.getTherapistRepository(),
    roomRepo = RepositoryFactory.getRoomRepository(),
    tutorRepo = RepositoryFactory.getTutorRepository(),
    userRepo = RepositoryFactory.getUserRepository()
  ) {
    this.appointmentRepo = appointmentRepo;
    this.patientRepo = patientRepo;
    this.therapistRepo = therapistRepo;
    this.roomRepo = roomRepo;
    this.tutorRepo = tutorRepo;
    this.userRepo = userRepo;
  }

  /**
   * Calcula fecha y hora de fin sumando la duración en minutos
   */
  calculateEndTime(fechaHoraInicio, duracionMinutos) {
    const normalized = typeof fechaHoraInicio === 'string'
      ? fechaHoraInicio.trim().replace(' ', 'T')
      : fechaHoraInicio;
    const start = new Date(normalized);
    if (isNaN(start.getTime())) {
      throw AppError.badRequest('La fecha y hora de inicio no tiene un formato válido.');
    }
    const duration = parseInt(duracionMinutos, 10) || 45;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = end.getFullYear();
    const mm = pad(end.getMonth() + 1);
    const dd = pad(end.getDate());
    const hh = pad(end.getHours());
    const min = pad(end.getMinutes());
    const ss = pad(end.getSeconds());

    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }

  /**
   * Regla temporal: impide agendar sesiones nuevas en fechas u horas pasadas
   * (con margen configurable para registro en recepción del turno actual).
   */
  _assertFutureOrCurrentAppointment(fechaHoraInicio, toleranceMinutes = 15) {
    const normalized = typeof fechaHoraInicio === 'string'
      ? fechaHoraInicio.trim().replace(' ', 'T')
      : fechaHoraInicio;
    const start = new Date(normalized);
    if (isNaN(start.getTime())) {
      throw AppError.badRequest('La fecha y hora de inicio no tiene un formato válido.');
    }
    const earliestAllowed = Date.now() - toleranceMinutes * 60 * 1000;
    if (start.getTime() < earliestAllowed) {
      throw AppError.badRequest('No se pueden programar citas en fechas u horas pasadas.');
    }
  }

  async getAppointments(filters = {}, user = null) {
    const queryFilters = { ...filters };

    // Regla de privacidad RBAC para TUTOR: Solo puede ver citas de sus propios hijos/pupilos tutelados
    if (user && user.rol === 'TUTOR') {
      let tutor = await this.tutorRepo.findByUserId(user.id);
      if (!tutor && user.email) {
        tutor = await this.tutorRepo.findByEmail(user.email);
      }
      if (!tutor) {
        return [];
      }
      const patients = (tutor.pacientes && tutor.pacientes.length > 0)
        ? tutor.pacientes
        : await this.tutorRepo.getPatientsByTutorId(tutor.id);
      if (!patients || patients.length === 0) {
        return [];
      }

      const myChildIds = patients.map(p => p.id);
      if (queryFilters.pacienteId) {
        const requestedId = parseInt(queryFilters.pacienteId, 10);
        if (!myChildIds.includes(requestedId)) {
          throw AppError.forbidden('Acceso restringido: Solo puede consultar citas correspondientes a sus propios hijos o tutelados.');
        }
        queryFilters.pacienteId = requestedId;
        delete queryFilters.pacienteIds;
      } else {
        queryFilters.pacienteIds = myChildIds;
        delete queryFilters.pacienteId;
      }
    }

    // Para TERAPEUTA: Por estricto secreto profesional y privacidad clínica,
    // SIEMPRE se filtra automáticamente por sus propias citas asignadas
    if (user && user.rol === 'TERAPEUTA') {
      const therapist = await this.therapistRepo.findByUserId(user.id);
      if (therapist) {
        queryFilters.terapeutaId = therapist.id;
      }
    }

    return this.appointmentRepo.findAll(queryFilters);
  }

  /**
   * Agenda Institucional Pública / Ocupación de Salas:
   * Retorna franjas horarias ocupadas por consultorio y terapeuta para coordinación interprofesional.
   * CERO DATOS DE PACIENTES para proteger el secreto profesional y la confidencialidad médica.
   */
  async getPublicSchedule({ mes, fechaDesde, fechaHasta } = {}) {
    let start = fechaDesde;
    let end = fechaHasta;

    if (mes && !start && !end) {
      start = `${mes}-01`;
      const [year, month] = mes.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const pad = (n) => String(n).padStart(2, '0');
      end = `${mes}-${pad(lastDay)}`;
    }

    if (!start) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      start = `${y}-${m}-01`;
      const lastDay = new Date(y, Number(m), 0).getDate();
      end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    }

    const appointments = await this.appointmentRepo.findAll({
      fechaDesde: start,
      fechaHasta: end,
      excludeCancelled: true
    });

    // Mapeo anónimo sin datos de pacientes (Privacidad y Secreto Profesional)
    return appointments.map(apt => ({
      id: apt.id,
      ambiente_id: apt.ambiente_id,
      ambiente_codigo: apt.ambiente_codigo,
      ambiente_nombre: apt.ambiente_nombre,
      ambiente_color: apt.ambiente_color,
      terapeuta_id: apt.terapeuta_id,
      terapeuta_nombre_completo: apt.terapeuta_nombre_completo,
      terapeuta_especialidad: apt.especialidad_nombre,
      fecha_hora_inicio: apt.fecha_hora_inicio,
      fecha_hora_fin: apt.fecha_hora_fin,
      duracion_minutos: apt.duracion_minutos,
      estado: apt.estado
    }));
  }

  async getAppointmentById(id, user = null) {
    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      throw AppError.notFound(`No se encontró ninguna cita con el identificador [${id}].`);
    }

    // Control de acceso RBAC para rol TUTOR
    if (user && user.rol === 'TUTOR') {
      let tutor = await this.tutorRepo.findByUserId(user.id);
      if (!tutor && user.email) {
        tutor = await this.tutorRepo.findByEmail(user.email);
      }
      if (!tutor) {
        throw AppError.forbidden('Perfil de tutor legal no vinculado a este usuario.');
      }
      const patients = (tutor.pacientes && tutor.pacientes.length > 0)
        ? tutor.pacientes
        : await this.tutorRepo.getPatientsByTutorId(tutor.id);
      const isMyChild = patients.some(p => p.id === appointment.paciente_id);
      if (!isMyChild) {
        throw AppError.forbidden('Secreto profesional médico: No tiene autorización para acceder a citas de pacientes ajenos.');
      }
    }

    return appointment;
  }

  async getTodayStats(dateStr = null) {
    return this.appointmentRepo.getTodayStats(dateStr);
  }

  /**
   * Pre-verificación de disponibilidad para dar feedback reactivo en el formulario
   */
  async checkAvailability({ ambienteId, terapeutaId, fechaHoraInicio, duracionMinutos = 45, excludeId = null, bufferMinutes = 10 }) {
    if (!ambienteId || !terapeutaId || !fechaHoraInicio) {
      return { available: true, message: 'Parámetros incompletos para verificar colisión' };
    }

    const fechaHoraFin = this.calculateEndTime(fechaHoraInicio, duracionMinutos);
    const collision = await this.appointmentRepo.checkCollision({
      ambienteId,
      terapeutaId,
      fechaHoraInicio,
      fechaHoraFin,
      excludeId,
      bufferMinutes
    });

    return {
      available: !collision.hasCollision,
      collision
    };
  }

  /**
   * Agendamiento de Cita Médica con Validación Anti-Colisión (RN-01 & RN-02)
   */
  async createAppointment(data, user = null, ip = null) {
    // 1. Validaciones básicas obligatorias
    if (!data.paciente_id) {
      throw AppError.badRequest('El paciente es obligatorio para agendar una cita médica.');
    }
    // Si el usuario es terapeuta, se fuerza estrictamente a su propio ID para que no agende a nombre de otros
    if (user && user.rol === 'TERAPEUTA') {
      const therapist = await this.therapistRepo.findByUserId(user.id);
      if (!therapist) {
        throw AppError.forbidden('No se encontró el perfil profesional correspondiente a este terapeuta.');
      }
      data.terapeuta_id = therapist.id;
    }

    if (!data.terapeuta_id) {
      throw AppError.badRequest('El terapeuta o especialista asignado es obligatorio.');
    }
    if (!data.ambiente_id) {
      throw AppError.badRequest('Debe seleccionar un consultorio físico acreditado del centro.');
    }
    if (!data.fecha_hora_inicio) {
      throw AppError.badRequest('La fecha y hora de inicio de la sesión es obligatoria.');
    }

    const duracion = parseInt(data.duracion_minutos, 10) || 45;
    if (isNaN(duracion) || duracion < 15 || duracion > 240) {
      throw AppError.badRequest('La duración de la sesión debe ser un valor numérico entre 15 y 240 minutos.');
    }

    // 2. Validar regla temporal y calcular fecha de finalización
    this._assertFutureOrCurrentAppointment(data.fecha_hora_inicio, 15);
    const fechaHoraFin = this.calculateEndTime(data.fecha_hora_inicio, duracion);
    data.fecha_hora_fin = fechaHoraFin;
    data.duracion_minutos = duracion;

    // 3. Auditoría previa a persistencia atómica
    data.creado_por_usuario_id = user ? user.id : null;
    data.estado = data.estado || 'PROGRAMADA';

    // 4. Control Algorítmico Anti-Colisión + Inserción Atómica (BEGIN IMMEDIATE)
    const bufferMinutes = 10;
    let newAppointment;
    if (typeof this.appointmentRepo.createWithCollisionCheck === 'function') {
      newAppointment = await this.appointmentRepo.createWithCollisionCheck(data, bufferMinutes);
    } else {
      const collision = await this.appointmentRepo.checkCollision({
        ambienteId: data.ambiente_id,
        terapeutaId: data.terapeuta_id,
        fechaHoraInicio: data.fecha_hora_inicio,
        fechaHoraFin: data.fecha_hora_fin,
        excludeId: null,
        bufferMinutes
      });
      if (collision.hasCollision) {
        throw AppError.conflict(collision.message, 'COLLISION_DETECTED', collision);
      }
      newAppointment = await this.appointmentRepo.create(data);
    }

    // 5.1 Registro de Recordatorio Desacoplado Configurable (Sprint 9)
    try {
      const rem = data.recordatorio || {};
      await this.appointmentRepo.saveReminder({
        citaId: newAppointment.id,
        canal: rem.canal || 'WHATSAPP_Y_PUSH',
        anticipacionMinutos: parseInt(rem.anticipacionMinutos, 10) || 30,
        fechaProgramadaEnvio: rem.fechaProgramadaEnvio || null,
        mensajePersonalizado: rem.mensajePersonalizado || null
      });

      // Disparar chequeo inmediato: si la cita fue fijada para dentro de < 30 min, se despacha al instante
      appointmentSchedulerService.triggerImmediateCheck().catch(() => {});
    } catch (remErr) {
      console.warn('[AppointmentService] Aviso al registrar recordatorio programado:', remErr.message);
    }

    // 6. Registro inalterable en Bitácora de Auditoría
    await this.userRepo.logAudit(
      user ? user.id : null,
      'APPOINTMENT_CREATED',
      'AGENDA',
      `Cita agendada para ${newAppointment.paciente_nombre_completo} (${newAppointment.paciente_codigo}) en ${newAppointment.ambiente_nombre} con ${newAppointment.terapeuta_nombre_completo} el ${newAppointment.fecha_hora_inicio}`,
      ip
    );

    notificationService.emitAppointmentChanged(newAppointment);

    return newAppointment;
  }

  /**
   * Reprogramación o edición de cita
   */
  async updateAppointment(id, data, user = null, ip = null) {
    const existing = await this.getAppointmentById(id, user);

    const duracion = data.duracion_minutos !== undefined 
      ? parseInt(data.duracion_minutos, 10) 
      : existing.duracion_minutos;

    const fechaHoraInicio = data.fecha_hora_inicio || existing.fecha_hora_inicio;
    if (data.fecha_hora_inicio && String(data.fecha_hora_inicio).replace('T', ' ') !== String(existing.fecha_hora_inicio).replace('T', ' ')) {
      this._assertFutureOrCurrentAppointment(data.fecha_hora_inicio, 15);
    }
    const fechaHoraFin = this.calculateEndTime(fechaHoraInicio, duracion);
    const ambienteId = data.ambiente_id || existing.ambiente_id;
    const terapeutaId = data.terapeuta_id || existing.terapeuta_id;

    data.fecha_hora_inicio = fechaHoraInicio;
    data.fecha_hora_fin = fechaHoraFin;
    data.duracion_minutos = duracion;

    if (existing.estado === 'REPROGRAMADA' && !data.estado) {
      data.estado = 'PROGRAMADA';
    }

    let updated;
    if (typeof this.appointmentRepo.updateWithCollisionCheck === 'function') {
      updated = await this.appointmentRepo.updateWithCollisionCheck(id, data, 10);
    } else {
      const collision = await this.appointmentRepo.checkCollision({
        ambienteId,
        terapeutaId,
        fechaHoraInicio,
        fechaHoraFin,
        excludeId: id,
        bufferMinutes: 10
      });

      if (collision.hasCollision) {
        throw AppError.conflict(collision.message, 'COLLISION_DETECTED', collision);
      }
      updated = await this.appointmentRepo.update(id, data);
    }

    const isReschedule = (fechaHoraInicio !== existing.fecha_hora_inicio) || (ambienteId !== existing.ambiente_id);
    const action = isReschedule ? 'APPOINTMENT_RESCHEDULED' : 'APPOINTMENT_UPDATED';

    // Actualizar fecha programada de recordatorios si cambió el horario
    if (isReschedule) {
      try {
        this.appointmentRepo.updateScheduledDateByCitaId(id, updated.fecha_hora_inicio);
      } catch (e) {}
    }

    // Si se envió configuración de recordatorio en la actualización
    if (data.recordatorio) {
      try {
        await this.appointmentRepo.saveReminder({
          citaId: id,
          canal: data.recordatorio.canal || 'WHATSAPP_Y_PUSH',
          anticipacionMinutos: parseInt(data.recordatorio.anticipacionMinutos, 10) || 30,
          mensajePersonalizado: data.recordatorio.mensajePersonalizado || null
        });
      } catch (e) {}
    }

    // Si se reprogramó o actualizó, verificar si hay recordatorios pendientes listos para despacho
    appointmentSchedulerService.triggerImmediateCheck().catch(() => {});

    await this.userRepo.logAudit(
      user ? user.id : null,
      action,
      'AGENDA',
      `${isReschedule ? 'Reprogramación' : 'Actualización'} de cita ID #${id} (${updated.paciente_nombre_completo}) nueva franja: ${updated.fecha_hora_inicio} en ${updated.ambiente_nombre}`,
      ip
    );

    notificationService.emitAppointmentChanged(updated);

    return updated;
  }

  /**
   * Transición de estados (RF-G04: Asistencia con 1 clic, cancelaciones, atenciones)
   */
  async updateStatus(id, estado, metadata = {}, user = null, ip = null) {
    const allowed = ['PROGRAMADA', 'CONFIRMADA', 'EN_ATENCION', 'ATENDIDA', 'REPROGRAMADA', 'CANCELADA', 'AUSENTE'];
    if (!allowed.includes(estado)) {
      throw AppError.badRequest(`Estado inválido [${estado}]. Estados admitidos: ${allowed.join(', ')}`);
    }

    if (user && user.rol === 'TUTOR') {
      const allowedTutor = ['CONFIRMADA', 'REPROGRAMADA', 'CANCELADA'];
      if (!allowedTutor.includes(estado)) {
        throw AppError.forbidden('Los tutores solo pueden confirmar asistencia, solicitar reprogramación o cancelar justificada.');
      }
    }

    const existing = await this.getAppointmentById(id, user);

    if (estado === 'CANCELADA') {
      const motivo = (metadata.motivoCancelacion || '').trim();
      if (!motivo || motivo.length < 5) {
        throw AppError.badRequest('Para cancelar una cita se requiere un motivo clínico o justificación formal de al menos 5 caracteres.');
      }
    }

    const meta = {
      ...metadata,
      usuarioId: user ? user.id : null
    };

    const updated = await this.appointmentRepo.updateStatus(id, estado, meta);

    // Si se cancela la cita, cancelar de inmediato cualquier recordatorio pendiente
    if (estado === 'CANCELADA') {
      try {
        await this.appointmentRepo.cancelPendingRemindersByCitaId(id);
      } catch (e) {}
    }

    // Notificación formal al especialista cuando el tutor confirma o solicita reprogramación desde PWA
    if (user && user.rol === 'TUTOR' && (estado === 'CONFIRMADA' || estado === 'REPROGRAMADA')) {
      try {
        const pacienteNombre = updated.paciente_nombre_completo || 'Paciente';
        const tutorNombre = `${user.nombres || ''} ${user.apellidos || ''}`.trim() || 'Tutor Familiar';
        const isConfirm = (estado === 'CONFIRMADA');
        const title = isConfirm ? 'Cita Confirmada (Portal Familiar)' : 'Solicitud de Reprogramación (Portal Familiar)';
        const msg = isConfirm
          ? `El tutor ${tutorNombre} confirmó la asistencia para la sesión de ${pacienteNombre}.`
          : `El tutor ${tutorNombre} solicitó reprogramar la sesión de ${pacienteNombre}.${metadata.motivoCancelacion ? ` Motivo: ${metadata.motivoCancelacion}` : ''}`;

        const terapeuta = await this.therapistRepo.findById(updated.terapeuta_id);
        if (terapeuta && terapeuta.usuario_id) {
          await notificationService.createNotification({
            userId: terapeuta.usuario_id,
            tipo: isConfirm ? 'CITA_CONFIRMADA' : 'CITA_REPROGRAMADA',
            titulo: title,
            mensaje: msg,
            linkUrl: '#/appointments',
            citaId: id
          });

          webPushService.sendNotificationToUser(terapeuta.usuario_id, {
            title,
            body: msg,
            icon: '/icons/icon-192x192.png',
            url: '#/appointments',
            data: { citaId: id, tipo: isConfirm ? 'CITA_CONFIRMADA' : 'CITA_REPROGRAMADA' }
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('[AppointmentService] Error notificando al terapeuta:', err.message);
      }
    }

    await this.userRepo.logAudit(
      user ? user.id : null,
      'APPOINTMENT_STATUS_CHANGED',
      'AGENDA',
      `Cambio de estado en cita ID #${id} (${updated.paciente_nombre_completo}): ${existing.estado} -> ${estado}${metadata.motivoCancelacion ? ` | Motivo: ${metadata.motivoCancelacion}` : ''}`,
      ip
    );

    notificationService.emitAppointmentChanged(updated);

    return updated;
  }

  async cancelAppointment(id, motivoCancelacion, user = null, ip = null) {
    return this.updateStatus(id, 'CANCELADA', { motivoCancelacion }, user, ip);
  }
}

