import { DatabaseConnection } from '../core/DatabaseConnection.js';
import { whatsappManager } from './whatsappManager.js';
import { webPushService } from './webPushService.js';
import { notificationService } from './notificationService.js';

class AppointmentSchedulerService {
  constructor() {
    this.db = null;
    this.intervalId = null;
    this.isRunning = false;
    this.checkIntervalMs = 20 * 1000; // Sincronización reactiva cada 20 segundos
    this.lastRunAt = null;
    this.lastStats = { processed24h: 0, processed2h: 0, errors: [] };
  }

  getDb() {
    if (!this.db) {
      this.db = DatabaseConnection.getInstance();
    }
    return this.db;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('[Scheduler] Motor de recordatorios iniciado (intervalo reactivo: 20s).');

    // Ejecución inicial diferida (10s después del arranque para estabilizar Puppeteer init)
    setTimeout(() => {
      this.runCycle().catch(err => console.error('[Scheduler] Error en ciclo inicial:', err));
    }, 10000);

    this.intervalId = setInterval(() => {
      this.runCycle().catch(err => console.error('[Scheduler] Error en ciclo programado:', err));
    }, this.checkIntervalMs);
  }

  async triggerImmediateCheck() {
    try {
      return await this.runCycle();
    } catch (err) {
      console.error('[Scheduler] Error en ciclo inmediato reactivo:', err.message);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[Scheduler] Motor de recordatorios detenido.');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.checkIntervalMs / 60000,
      lastRunAt: this.lastRunAt,
      lastStats: this.lastStats
    };
  }

  formatTime(isoStr) {
    if (!isoStr) return '--:--';
    return isoStr.slice(11, 16);
  }

  formatDate(isoStr) {
    if (!isoStr) return '';
    const parts = isoStr.slice(0, 10).split('-');
    if (parts.length !== 3) return isoStr.slice(0, 10);
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  async runCycle() {
    this.lastRunAt = new Date().toISOString();
    const db = this.getDb();
    const stats = { processed24h: 0, processed2h: 0, errors: [] };

    try {
      // Obtenemos fecha y hora actual en formato ISO string comparable (YYYY-MM-DD HH:mm:ss)
      const now = new Date();
      
      // Ventana 24 Horas: Citas entre 20h y 28h hacia adelante
      const win24hStart = new Date(now.getTime() + 20 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      const win24hEnd = new Date(now.getTime() + 28 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

      // Ventana 2 Horas: Citas entre 1h y 3h hacia adelante
      const win2hStart = new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      const win2hEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

      // 1. EVALUAR CITAS PARA RECORDATORIO 24 HORAS
      const citas24h = db.prepare(`
        SELECT 
          c.id, c.paciente_id, c.terapeuta_id, c.ambiente_id, c.fecha_hora_inicio, c.fecha_hora_fin, c.estado,
          p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos, p.codigo_expediente,
          t.nombres AS terapeuta_nombres, t.apellidos AS terapeuta_apellidos, t.usuario_id AS terapeuta_usuario_id,
          a.codigo AS ambiente_codigo, a.nombre AS ambiente_nombre,
          tut.nombres AS tutor_nombres, tut.apellidos AS tutor_apellidos, tut.whatsapp AS tutor_telefono, tut.usuario_id AS tutor_usuario_id
        FROM citas c
        JOIN pacientes p ON c.paciente_id = p.id
        JOIN terapeutas t ON c.terapeuta_id = t.id
        JOIN ambientes a ON c.ambiente_id = a.id
        LEFT JOIN paciente_tutor pt ON p.id = pt.paciente_id AND pt.es_principal = 1
        LEFT JOIN tutores tut ON pt.tutor_id = tut.id
        WHERE c.estado IN ('PROGRAMADA', 'CONFIRMADA')
          AND c.recordatorio_24h_enviado = 0
          AND c.fecha_hora_inicio BETWEEN ? AND ?
        ORDER BY c.fecha_hora_inicio ASC
      `).all(win24hStart, win24hEnd);

      for (const cita of citas24h) {
        try {
          await this.dispatchReminder(cita, '24H');
          db.prepare(`
            UPDATE citas 
            SET recordatorio_24h_enviado = 1, recordatorio_24h_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(cita.id);
          stats.processed24h++;
        } catch (err) {
          console.error(`[Scheduler] Error despachando 24h para cita ID ${cita.id}:`, err.message);
          stats.errors.push({ citaId: cita.id, type: '24H', error: err.message });
        }
      }

      // 2. EVALUAR CITAS PARA RECORDATORIO 2 HORAS
      const citas2h = db.prepare(`
        SELECT 
          c.id, c.paciente_id, c.terapeuta_id, c.ambiente_id, c.fecha_hora_inicio, c.fecha_hora_fin, c.estado,
          p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos, p.codigo_expediente,
          t.nombres AS terapeuta_nombres, t.apellidos AS terapeuta_apellidos, t.usuario_id AS terapeuta_usuario_id,
          a.codigo AS ambiente_codigo, a.nombre AS ambiente_nombre,
          tut.nombres AS tutor_nombres, tut.apellidos AS tutor_apellidos, tut.whatsapp AS tutor_telefono, tut.usuario_id AS tutor_usuario_id
        FROM citas c
        JOIN pacientes p ON c.paciente_id = p.id
        JOIN terapeutas t ON c.terapeuta_id = t.id
        JOIN ambientes a ON c.ambiente_id = a.id
        LEFT JOIN paciente_tutor pt ON p.id = pt.paciente_id AND pt.es_principal = 1
        LEFT JOIN tutores tut ON pt.tutor_id = tut.id
        WHERE c.estado IN ('PROGRAMADA', 'CONFIRMADA')
          AND c.recordatorio_2h_enviado = 0
          AND c.fecha_hora_inicio BETWEEN ? AND ?
        ORDER BY c.fecha_hora_inicio ASC
      `).all(win2hStart, win2hEnd);

      for (const cita of citas2h) {
        try {
          await this.dispatchReminder(cita, '2H');
          db.prepare(`
            UPDATE citas 
            SET recordatorio_2h_enviado = 1, recordatorio_2h_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(cita.id);
          stats.processed2h++;
        } catch (err) {
          console.error(`[Scheduler] Error despachando 2h para cita ID ${cita.id}:`, err.message);
          stats.errors.push({ citaId: cita.id, type: '2H', error: err.message });
        }
      }

      // 3. EVALUAR RECORDATORIOS PROGRAMADOS INDEPENDIENTES (recordatorios_citas)
      const nowSchedule = new Date().toISOString().replace('T', ' ').slice(0, 19);
      const customReminders = db.prepare(`
        SELECT 
          r.*,
          c.fecha_hora_inicio, c.fecha_hora_fin, c.estado AS cita_estado,
          p.nombres AS paciente_nombres, p.apellidos AS paciente_apellidos, p.codigo_expediente,
          t.id AS terapeuta_id, t.nombres AS terapeuta_nombres, t.apellidos AS terapeuta_apellidos, t.usuario_id AS terapeuta_usuario_id,
          a.codigo AS ambiente_codigo, a.nombre AS ambiente_nombre,
          tut.id AS tutor_id, tut.nombres AS tutor_nombres, tut.apellidos AS tutor_apellidos, tut.whatsapp AS tutor_telefono, tut.usuario_id AS tutor_usuario_id
        FROM recordatorios_citas r
        JOIN citas c ON r.cita_id = c.id
        JOIN pacientes p ON c.paciente_id = p.id
        JOIN terapeutas t ON c.terapeuta_id = t.id
        JOIN ambientes a ON c.ambiente_id = a.id
        LEFT JOIN paciente_tutor pt ON p.id = pt.paciente_id AND pt.es_principal = 1
        LEFT JOIN tutores tut ON pt.tutor_id = tut.id
        WHERE r.estado = 'PENDIENTE'
          AND c.estado IN ('PROGRAMADA', 'CONFIRMADA')
          AND r.fecha_programada_envio <= ?
        ORDER BY r.fecha_programada_envio ASC
      `).all(nowSchedule);

      stats.processedCustom = 0;
      for (const rem of customReminders) {
        try {
          await this.dispatchCustomReminder(rem);
          db.prepare(`
            UPDATE recordatorios_citas
            SET estado = 'ENVIADO', enviado_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(rem.id);
          stats.processedCustom++;
        } catch (remErr) {
          console.error(`[Scheduler] Error despachando recordatorio programado ID ${rem.id}:`, remErr.message);
          db.prepare(`
            UPDATE recordatorios_citas
            SET estado = 'FALLIDO', error_mensaje = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(remErr.message, rem.id);
          stats.errors.push({ reminderId: rem.id, type: 'CUSTOM', error: remErr.message });
        }
      }

    } catch (cycleErr) {
      console.error('[Scheduler] Error general en ejecución de ciclo:', cycleErr.message);
      stats.errors.push({ general: cycleErr.message });
    }

    this.lastStats = stats;
    if (stats.processed24h > 0 || stats.processed2h > 0) {
      console.log(`[Scheduler] Ciclo ejecutado: ${stats.processed24h} recordatorios 24h, ${stats.processed2h} recordatorios 2h.`);
    }
    return stats;
  }

  async dispatchReminder(cita, windowType) {
    const pacienteNombre = `${cita.paciente_nombres} ${cita.paciente_apellidos}`.trim();
    const tutorNombre = cita.tutor_nombres ? `${cita.tutor_nombres} ${cita.tutor_apellidos || ''}`.trim() : 'Estimado/a Tutor/a';
    const terapeutaNombre = `${cita.terapeuta_nombres} ${cita.terapeuta_apellidos}`.trim();
    const ambienteNombre = cita.ambiente_codigo || cita.ambiente_nombre?.split(' - ')[0] || 'Consultorio';
    const hora = this.formatTime(cita.fecha_hora_inicio);
    const fecha = this.formatDate(cita.fecha_hora_inicio);

    // 1. Mensaje de WhatsApp estructurado según el tipo de ventana
    let whatsappText = '';
    let notificationTitle = '';
    let notificationBody = '';

    if (windowType === '24H') {
      notificationTitle = 'Recordatorio de Sesión para Mañana';
      notificationBody = `Cita de ${pacienteNombre} mañana a las ${hora} con Lic. ${terapeutaNombre} en ${ambienteNombre}.`;
      whatsappText = 
`*RECORDATORIO DE CITA CLÍNICA - PSI APRENDE*

Estimado/a *${tutorNombre}*,
Le recordamos la sesión terapéutica programada para *${pacienteNombre}*:

• *Fecha:* Mañana, ${fecha}
• *Hora:* ${hora}
• *Consultorio:* ${ambienteNombre}
• *Especialista:* Lic. ${terapeutaNombre}

Por favor responda a este mensaje con:
*1* para Confirmar asistencia
*2* para Solicitar reprogramación

_Centro Psicopedagógico y de Atención Psicológica PSI Aprende_
_Cochabamba - Bolivia_`;
    } else {
      notificationTitle = 'Sesión Terapéutica en 2 Horas';
      notificationBody = `La sesión de ${pacienteNombre} iniciará hoy a las ${hora} en ${ambienteNombre}.`;
      whatsappText = 
`*RECORDATORIO DE PRÓXIMA SESIÓN (EN 2 HORAS) - PSI APRENDE*

Estimado/a *${tutorNombre}*,
Le recordamos que la sesión de *${pacienteNombre}* iniciará hoy a las *${hora}* en el *${ambienteNombre}* con *Lic. ${terapeutaNombre}*.

Le sugerimos llegar 5 minutos antes para el registro oportuno en sala. ¡Los esperamos!

_Centro Psicopedagógico PSI Aprende_`;
    }

    // A. DESPACHO POR WHATSAPP (A través del canal del terapeuta asignado)
    if (cita.tutor_telefono) {
      try {
        await whatsappManager.sendMessage(cita.terapeuta_id, cita.tutor_telefono, whatsappText);
        console.log(`[Scheduler] WhatsApp ${windowType} enviado exitosamente a ${cita.tutor_telefono} vía terapeuta ID ${cita.terapeuta_id}`);
      } catch (waErr) {
        console.warn(`[Scheduler] WhatsApp ${windowType} no pudo enviarse vía móvil (continuando con Web Push): ${waErr.message}`);
      }
    }

    // B. DESPACHO POR NOTIFICACIÓN WEB PUSH PWA (Si el tutor tiene usuario y suscripción)
    if (cita.tutor_usuario_id) {
      try {
        await webPushService.sendNotificationToUser(cita.tutor_usuario_id, {
          title: notificationTitle,
          body: notificationBody,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          url: '#/appointments',
          data: { citaId: cita.id, tipo: windowType },
          actions: [
            { action: 'confirm_appointment', title: 'Confirmar Cita' },
            { action: 'reschedule_appointment', title: 'Reprogramar' }
          ]
        });
      } catch (pushErr) {
        console.warn(`[Scheduler] Push a tutor ${cita.tutor_usuario_id} falló:`, pushErr.message);
      }

      // C. REGISTRO EN CENTRO DE NOTIFICACIONES IN-APP (Para el Tutor)
      notificationService.createNotification({
        userId: cita.tutor_usuario_id,
        tipo: windowType === '24H' ? 'RECORDATORIO_24H' : 'RECORDATORIO_2H',
        titulo: notificationTitle,
        mensaje: notificationBody,
        linkUrl: '#/appointments',
        citaId: cita.id
      });
    }

    // D. REGISTRO EN CENTRO DE NOTIFICACIONES PARA EL TERAPEUTA
    if (cita.terapeuta_usuario_id) {
      const therapistTitle = windowType === '24H' 
        ? `Sesión programada mañana: ${pacienteNombre}`
        : `Sesión en 2 horas: ${pacienteNombre}`;
      const therapistBody = `Horario: ${hora} · Consultorio: ${ambienteNombre}.`;

      try {
        await webPushService.sendNotificationToUser(cita.terapeuta_usuario_id, {
          title: therapistTitle,
          body: therapistBody,
          icon: '/icons/icon-192x192.png',
          url: '#/appointments',
          data: { citaId: cita.id }
        });
      } catch (e) {}

      notificationService.createNotification({
        userId: cita.terapeuta_usuario_id,
        tipo: 'RECORDATORIO',
        titulo: therapistTitle,
        mensaje: therapistBody,
        linkUrl: '#/appointments',
        citaId: cita.id
      });
    }
  }

  async dispatchCustomReminder(rem) {
    const pacienteNombre = `${rem.paciente_nombres} ${rem.paciente_apellidos}`.trim();
    const tutorNombre = rem.tutor_nombres ? `${rem.tutor_nombres} ${rem.tutor_apellidos || ''}`.trim() : 'Estimado/a Tutor/a';
    const terapeutaNombre = `${rem.terapeuta_nombres} ${rem.terapeuta_apellidos}`.trim();
    const ambienteNombre = rem.ambiente_codigo || rem.ambiente_nombre?.split(' - ')[0] || 'Consultorio';
    const hora = this.formatTime(rem.fecha_hora_inicio);
    const fecha = this.formatDate(rem.fecha_hora_inicio);

    // Texto de WhatsApp: si el especialista personalizó el mensaje, se usa ese; sino la plantilla formal con desambiguación
    let whatsappText = rem.mensaje_personalizado && rem.mensaje_personalizado.trim() !== ''
      ? rem.mensaje_personalizado
          .replace(/{paciente}/gi, pacienteNombre)
          .replace(/{tutor}/gi, tutorNombre)
          .replace(/{terapeuta}/gi, terapeutaNombre)
          .replace(/{consultorio}/gi, ambienteNombre)
          .replace(/{fecha}/gi, fecha)
          .replace(/{hora}/gi, hora)
      : `*RECORDATORIO DE SESIÓN CLÍNICA - PSI APRENDE*

Estimado/a *${tutorNombre}*,
Le recordamos la sesión terapéutica programada para *${pacienteNombre}*:

• *Fecha:* ${fecha}
• *Hora:* ${hora} (en ${rem.anticipacion_minutos} minutos)
• *Consultorio:* ${ambienteNombre}
• *Especialista:* Lic. ${terapeutaNombre}

Por favor responda a este mensaje con:
*1 ${rem.paciente_nombres.toUpperCase()}* para Confirmar asistencia
*2 ${rem.paciente_nombres.toUpperCase()}* para Solicitar reprogramación
(O simplemente responda *1* o *2* si solo tiene esta cita programada).

_Centro Psicopedagógico y de Atención Psicológica PSI Aprende_
_Cochabamba - Bolivia_`;

    const title = `Recordatorio de Sesión: ${pacienteNombre}`;
    const body = `Cita programada hoy a las ${hora} en ${ambienteNombre} con Lic. ${terapeutaNombre}.`;

    // 1. Envío por WhatsApp
    if (['WHATSAPP', 'WHATSAPP_Y_PUSH'].includes(rem.canal) && rem.tutor_telefono) {
      try {
        await whatsappManager.sendMessage(rem.terapeuta_id, rem.tutor_telefono, whatsappText);
        console.log(`[Scheduler] WhatsApp programado (${rem.anticipacion_minutos}m) enviado a ${rem.tutor_telefono} para cita ID ${rem.cita_id}`);
      } catch (waErr) {
        console.warn(`[Scheduler] WhatsApp programado a ${rem.tutor_telefono} no pudo enviarse:`, waErr.message);
      }
    }

    // 2. Envío por Web Push PWA al Tutor
    if (['PUSH', 'WHATSAPP_Y_PUSH'].includes(rem.canal) && rem.tutor_usuario_id) {
      try {
        await webPushService.sendNotificationToUser(rem.tutor_usuario_id, {
          title,
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          url: '#/appointments',
          data: { citaId: rem.cita_id, tipo: 'RECORDATORIO_PROGRAMADO' },
          actions: [
            { action: 'confirm_appointment', title: 'Confirmar Cita' },
            { action: 'reschedule_appointment', title: 'Reprogramar' }
          ]
        });
      } catch (pushErr) {}

      notificationService.createNotification({
        userId: rem.tutor_usuario_id,
        tipo: 'RECORDATORIO',
        titulo: title,
        mensaje: body,
        linkUrl: '#/appointments',
        citaId: rem.cita_id
      });
    }

    // 3. Notificación In-App al Terapeuta
    if (rem.terapeuta_usuario_id) {
      const thTitle = `Recordatorio despachado: ${pacienteNombre}`;
      const thBody = `Se envió recordatorio a ${tutorNombre} (${rem.anticipacion_minutos} min antes). Horario: ${hora}.`;
      notificationService.createNotification({
        userId: rem.terapeuta_usuario_id,
        tipo: 'RECORDATORIO',
        titulo: thTitle,
        mensaje: thBody,
        linkUrl: '#/appointments',
        citaId: rem.cita_id
      });
    }
  }
}

export const appointmentSchedulerService = new AppointmentSchedulerService();

