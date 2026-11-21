import { whatsappManager } from '../services/whatsappManager.js';
import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { webPushService } from '../services/webPushService.js';
import { notificationService } from '../services/notificationService.js';
import { assertTherapistOwnership, getTherapistForUser } from '../core/accessControl.js';

export class WhatsAppController {
  // 1. Listar todas las sesiones
  static async getAllSessions(req, res, next) {
    try {
      const sessions = await whatsappManager.getAllSessions();
      if (req.user?.rol === 'TERAPEUTA') {
        const myTherapist = await getTherapistForUser(req.user);
        const sanitized = sessions.map(s => {
          if (myTherapist && Number(s.terapeuta_id) === Number(myTherapist.id)) {
            return s;
          }
          return {
            terapeuta_id: s.terapeuta_id,
            usuario_id: s.usuario_id,
            estado: s.estado,
            estado_en_vivo: s.estado_en_vivo
          };
        });
        return res.status(200).json({
          success: true,
          data: sanitized
        });
      }
      res.status(200).json({
        success: true,
        data: sessions
      });
    } catch (err) {
      next(err);
    }
  }

  // 2. Detalle de una sesión
  static async getSession(req, res, next) {
    try {
      const { therapistId } = req.params;
      await assertTherapistOwnership(therapistId, req.user, { allowReception: true });
      const session = await whatsappManager.getSession(therapistId);
      res.status(200).json({
        success: true,
        data: session
      });
    } catch (err) {
      next(err);
    }
  }

  // 3. Inicializar / Obtener QR de vinculación
  static async initializeSession(req, res, next) {
    try {
      const { therapistId } = req.params;
      await assertTherapistOwnership(therapistId, req.user);
      const result = await whatsappManager.initializeSession(therapistId);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // 4. Desconectar sesión
  static async disconnectSession(req, res, next) {
    try {
      const { therapistId } = req.params;
      await assertTherapistOwnership(therapistId, req.user);
      const result = await whatsappManager.disconnectSession(therapistId);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // 5. Enviar mensaje de prueba
  static async sendTestMessage(req, res, next) {
    try {
      const { therapistId } = req.params;
      await assertTherapistOwnership(therapistId, req.user);
      const { phone } = req.body;
      const result = await whatsappManager.sendTestMessage(therapistId, phone);
      res.status(200).json({
        success: true,
        message: 'Mensaje de prueba procesado exitosamente.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // 6. Enviar mensaje clínico
  static async sendMessage(req, res, next) {
    try {
      const { therapistId, toPhone, message } = req.body;
      if (!toPhone || !message) {
        return res.status(400).json({
          success: false,
          message: 'Los campos toPhone y message son obligatorios.'
        });
      }
      if (therapistId) {
        await assertTherapistOwnership(therapistId, req.user, { allowReception: true });
      }
      const result = await whatsappManager.sendMessage(therapistId, toPhone, message);
      res.status(200).json({
        success: true,
        message: 'Mensaje despachado exitosamente.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  // 7. Programar recordatorio de cita
  static async scheduleAppointmentReminder(req, res, next) {
    try {
      const citaId = parseInt(req.params.citaId, 10);
      const { anticipacionMinutos, canal, mensajePersonalizado } = req.body;
      const repo = RepositoryFactory.getAppointmentRepository();
      const reminder = await repo.saveReminder({
        citaId,
        canal: canal || 'WHATSAPP_Y_PUSH',
        anticipacionMinutos: parseInt(anticipacionMinutos, 10) || 30,
        mensajePersonalizado: mensajePersonalizado || null
      });

      res.status(200).json({
        success: true,
        message: 'Recordatorio programado exitosamente.',
        data: reminder
      });
    } catch (err) {
      next(err);
    }
  }

  // 8. Despachar recordatorio / mensaje inmediato a cita
  static async dispatchAppointmentNow(req, res, next) {
    try {
      const citaId = parseInt(req.params.citaId, 10);
      const { message, customPhone } = req.body;
      const repo = RepositoryFactory.getAppointmentRepository();
      const cita = await repo.findById(citaId);
      if (!cita) {
        return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
      }

      await assertTherapistOwnership(cita.terapeuta_id, req.user, { allowReception: true });

      const targetPhone = customPhone || cita.tutor_whatsapp;
      if (!targetPhone) {
        return res.status(400).json({ success: false, message: 'La cita no tiene un número de WhatsApp de tutor asociado.' });
      }

      let therapistId = cita.terapeuta_id;
      if (req.user?.rol === 'TERAPEUTA') {
        const therapistRepo = RepositoryFactory.getTherapistRepository();
        const therapist = await therapistRepo.findByUserId(req.user.id);
        if (therapist) {
          therapistId = therapist.id;
        }
      }
      const result = await whatsappManager.sendMessage(therapistId, targetPhone, message);

      // 1. Guardar y marcar recordatorio como ENVIADO
      try {
        const rem = await repo.saveReminder({
          citaId,
          canal: 'WHATSAPP_Y_PUSH',
          anticipacionMinutos: 0,
          mensajePersonalizado: message
        });
        await repo.updateReminderStatus(rem.id, 'ENVIADO', { enviadoAt: new Date().toISOString() });
      } catch (e) {}

      // 2. Despachar alerta Web Push PWA al Tutor (si tiene usuario)
      if (cita.tutor_usuario_id) {
        const hora = (cita.fecha_hora_inicio || '').slice(11, 16);
        const pacienteNom = cita.paciente_nombre_completo || 'su hijo/a';
        const pwaTitle = `Recordatorio de Cita Clínica`;
        const pwaBody = `Sesión de ${pacienteNom} programada hoy a las ${hora}. Despacho clínico confirmado.`;

        try {
          await webPushService.sendNotificationToUser(cita.tutor_usuario_id, {
            title: pwaTitle,
            body: pwaBody,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            url: '#/appointments',
            data: { citaId: cita.id, tipo: 'RECORDATORIO_INMEDIATO' }
          });
        } catch (pushErr) {
          console.warn('[WhatsAppController] Push al tutor no disponible:', pushErr.message);
        }

        // 3. Notificación In-App en la campanita para el Tutor
        try {
          await notificationService.createNotification({
            userId: cita.tutor_usuario_id,
            tipo: 'RECORDATORIO',
            titulo: pwaTitle,
            mensaje: pwaBody,
            linkUrl: '#/appointments',
            citaId: cita.id
          });
        } catch (notifErr) {}
      }

      res.status(200).json({
        success: true,
        message: 'Mensaje despachado de inmediato por WhatsApp.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

