import { AppointmentService } from '../services/appointmentService.js';
import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { webPushService } from '../services/webPushService.js';
import { notificationService } from '../services/notificationService.js';

const appointmentService = new AppointmentService();

export class AppointmentController {
  static async getAll(req, res, next) {
    try {
      const { 
        fecha, 
        fecha_desde, 
        fecha_hasta, 
        ambiente_id, 
        terapeuta_id, 
        paciente_id, 
        estado, 
        search, 
        only_mine,
        exclude_cancelled
      } = req.query;

      const filters = {
        fecha,
        fechaDesde: fecha_desde,
        fechaHasta: fecha_hasta,
        ambienteId: ambiente_id ? parseInt(ambiente_id, 10) : undefined,
        terapeutaId: terapeuta_id ? parseInt(terapeuta_id, 10) : undefined,
        pacienteId: paciente_id ? parseInt(paciente_id, 10) : undefined,
        estado,
        search,
        onlyMine: only_mine,
        excludeCancelled: exclude_cancelled === 'true'
      };

      const appointments = await appointmentService.getAppointments(filters, req.user);
      res.status(200).json({
        success: true,
        data: appointments,
        count: appointments.length
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const appointment = await appointmentService.getAppointmentById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: appointment
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTodayStats(req, res, next) {
    try {
      const { fecha } = req.query;
      const stats = await appointmentService.getTodayStats(fecha);
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (err) {
      next(err);
    }
  }

  static async getPublicSchedule(req, res, next) {
    try {
      const { mes, fecha_desde, fecha_hasta } = req.query;
      const schedule = await appointmentService.getPublicSchedule({
        mes,
        fechaDesde: fecha_desde,
        fechaHasta: fecha_hasta
      });
      res.status(200).json({
        success: true,
        data: schedule,
        count: schedule.length
      });
    } catch (err) {
      next(err);
    }
  }

  static async checkAvailability(req, res, next) {
    try {
      const { ambiente_id, terapeuta_id, fecha_hora_inicio, duracion_minutos, exclude_id } = req.query;
      const result = await appointmentService.checkAvailability({
        ambienteId: parseInt(ambiente_id, 10),
        terapeutaId: parseInt(terapeuta_id, 10),
        fechaHoraInicio: fecha_hora_inicio,
        duracionMinutos: duracion_minutos ? parseInt(duracion_minutos, 10) : 45,
        excludeId: exclude_id ? parseInt(exclude_id, 10) : null
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const appointment = await appointmentService.createAppointment(req.body, req.user, ip);
      res.status(201).json({
        success: true,
        message: 'Cita médica agendada correctamente.',
        data: appointment
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const updated = await appointmentService.updateAppointment(req.params.id, req.body, req.user, ip);
      res.status(200).json({
        success: true,
        message: 'Cita actualizada / reprogramada exitosamente.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const { estado, motivo_cancelacion } = req.body;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const updated = await appointmentService.updateStatus(
        req.params.id, 
        estado, 
        { motivoCancelacion: motivo_cancelacion }, 
        req.user, 
        ip
      );
      res.status(200).json({
        success: true,
        message: `Estado de la cita actualizado a [${estado}].`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req, res, next) {
    try {
      const { motivo_cancelacion } = req.body;
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const cancelled = await appointmentService.cancelAppointment(
        req.params.id, 
        motivo_cancelacion, 
        req.user, 
        ip
      );
      res.status(200).json({
        success: true,
        message: 'Cita médica cancelada con registro formal en auditoría.',
        data: cancelled
      });
    } catch (err) {
      next(err);
    }
  }

  static async getReminders(req, res, next) {
    try {
      const reminders = await appointmentService.appointmentRepo.getRemindersByCitaId(req.params.id);
      res.status(200).json({
        success: true,
        data: reminders
      });
    } catch (err) {
      next(err);
    }
  }

  // Despachar notificación manual PWA (Web Push nativo + In-App)
  static async dispatchPwaNotification(req, res, next) {
    try {
      const citaId = parseInt(req.params.id, 10);
      const repo = RepositoryFactory.getAppointmentRepository();
      const cita = await repo.findById(citaId);
      if (!cita) {
        return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
      }

      let tutorUsuarioId = cita.tutor_usuario_id;
      if (!tutorUsuarioId) {
        tutorUsuarioId = await repo.getPrimaryTutorUserIdByPatientId(cita.paciente_id);
      }

      const pacienteNom = cita.paciente_nombre_completo || 'su hijo/a';
      const hora = (cita.fecha_hora_inicio || '').slice(11, 16);
      const fecha = (cita.fecha_hora_inicio || '').slice(0, 10);
      const parts = fecha.split('-');
      const fechaFmt = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : fecha;
      const ambienteNom = cita.ambiente_codigo || cita.ambiente_nombre || 'Consultorio';
      const terapeutaNom = cita.terapeuta_nombre_completo || 'Especialista';

      const customMessage = req.body.mensaje || req.body.message;
      const title = `Recordatorio de Sesión: ${pacienteNom}`;
      const body = customMessage || `Estimado/a tutor/a, le recordamos la atención clínica de ${pacienteNom}:\n📅 Fecha: ${fechaFmt}\n⏰ Hora: ${hora}\n🏥 Consultorio: ${ambienteNom}\n👩‍⚕️ Especialista: Lic. ${terapeutaNom}\n\nPor favor confirme su asistencia o solicite reprogramación con los botones a continuación.`;

      let pushDelivered = false;

      if (tutorUsuarioId) {
        try {
          const pushRes = await webPushService.sendNotificationToUser(tutorUsuarioId, {
            title,
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            url: '#/appointments',
            data: { citaId: cita.id, tipo: 'RECORDATORIO_MANUAL_PWA' },
            actions: [
              { action: 'confirm_appointment', title: 'Confirmar Cita' },
              { action: 'reschedule_appointment', title: 'Reprogramar' }
            ]
          });
          pushDelivered = Boolean(pushRes?.sent > 0 || pushRes?.success);
        } catch (pushErr) {
          console.warn('[AppointmentController] Aviso al despachar Web Push manual:', pushErr.message);
        }

        try {
          await notificationService.createNotification({
            userId: tutorUsuarioId,
            tipo: 'RECORDATORIO',
            titulo: title,
            mensaje: body,
            linkUrl: '#/appointments',
            citaId: cita.id
          });
        } catch (e) {}
      }

      // Guardar registro en historial de recordatorios
      try {
        const rem = await repo.saveReminder({
          citaId: cita.id,
          canal: 'PUSH',
          anticipacionMinutos: 0,
          mensajePersonalizado: body
        });
        await repo.updateReminderStatus(rem.id, 'ENVIADO', { enviadoAt: new Date().toISOString() });
      } catch (e) {}

      res.status(200).json({
        success: true,
        message: pushDelivered 
          ? 'Notificación Web Push PWA despachada inmediatamente al móvil/PC del tutor.' 
          : (tutorUsuarioId 
              ? 'Alerta registrada en la bandeja del tutor. Se emitirá a su pantalla al estar en línea.' 
              : 'Alerta registrada. El paciente no cuenta aún con un usuario tutor con acceso PWA asignado.'),
        pushDelivered,
        tutorUsuarioId
      });
    } catch (err) {
      next(err);
    }
  }
}

