import { Router } from 'express';
import { AppointmentController } from '../controllers/appointmentController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';

const router = Router();

// Todas las rutas de agenda requieren autenticación
router.use(authMiddleware);

// Validadores DTO
const validateAppointmentCreate = (data) => {
  const errors = [];
  if (!data.paciente_id || !Validators.isPositiveNumber(data.paciente_id)) {
    errors.push({ field: 'paciente_id', message: 'Debe seleccionar un paciente válido.' });
  }
  if (!data.terapeuta_id || !Validators.isPositiveNumber(data.terapeuta_id)) {
    errors.push({ field: 'terapeuta_id', message: 'Debe seleccionar un especialista / terapeuta acreditado.' });
  }
  if (!data.ambiente_id || !Validators.isPositiveNumber(data.ambiente_id)) {
    errors.push({ field: 'ambiente_id', message: 'Debe seleccionar un consultorio físico acreditado.' });
  }
  if (!Validators.isNonEmptyString(data.fecha_hora_inicio)) {
    errors.push({ field: 'fecha_hora_inicio', message: 'La fecha y hora de inicio de la cita es obligatoria.' });
  } else {
    const d = new Date(data.fecha_hora_inicio);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'fecha_hora_inicio', message: 'Formato de fecha y hora inválido.' });
    }
  }

  const duracion = parseInt(data.duracion_minutos, 10);
  if (isNaN(duracion) || duracion < 15 || duracion > 240) {
    errors.push({ field: 'duracion_minutos', message: 'La duración de la sesión debe ser entre 15 y 240 minutos.' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      ...data,
      paciente_id: parseInt(data.paciente_id, 10),
      terapeuta_id: parseInt(data.terapeuta_id, 10),
      ambiente_id: parseInt(data.ambiente_id, 10),
      servicio_id: data.servicio_id ? parseInt(data.servicio_id, 10) : null,
      servicio_personalizado: data.servicio_personalizado ? data.servicio_personalizado.trim() : null,
      arancel_personalizado: data.arancel_personalizado !== undefined && data.arancel_personalizado !== null && data.arancel_personalizado !== '' ? Number(data.arancel_personalizado) : null,
      duracion_minutos: duracion,
      motivo_consulta: data.motivo_consulta ? data.motivo_consulta.trim() : null,
      notas_internas: data.notas_internas ? data.notas_internas.trim() : null
    }
  };
};

const validateStatusUpdate = (data) => {
  const errors = [];
  const allowed = ['PROGRAMADA', 'CONFIRMADA', 'EN_ATENCION', 'ATENDIDA', 'REPROGRAMADA', 'CANCELADA', 'AUSENTE'];
  if (!data.estado || !allowed.includes(data.estado)) {
    errors.push({ field: 'estado', message: `Estado inválido. Opciones permitidas: ${allowed.join(', ')}` });
  }
  if (data.estado === 'CANCELADA') {
    if (!Validators.isNonEmptyString(data.motivo_cancelacion) || data.motivo_cancelacion.trim().length < 5) {
      errors.push({ field: 'motivo_cancelacion', message: 'El motivo de cancelación es obligatorio y debe tener al menos 5 caracteres.' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      ...data,
      motivo_cancelacion: data.motivo_cancelacion ? data.motivo_cancelacion.trim() : null
    }
  };
};

// 1. Estadísticas y verificación de disponibilidad
router.get('/stats/today', AppointmentController.getTodayStats);
router.get('/check-availability', AppointmentController.checkAvailability);
router.get('/public-schedule', AppointmentController.getPublicSchedule);

// 2. Consulta de citas
router.get('/', AppointmentController.getAll);
router.get('/:id', AppointmentController.getById);
router.get('/:id/reminders', AppointmentController.getReminders);

// 3. Creación y edición (Personal administrativo y clínico)
router.post(
  '/', 
  requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), 
  validateBody(validateAppointmentCreate), 
  AppointmentController.create
);

router.put(
  '/:id', 
  requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), 
  AppointmentController.update
);

// 4. Actualización rápida de estado (Asistencia en sala, confirmación, reprogramación, etc.)
router.patch(
  '/:id/status', 
  requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION', 'TUTOR']), 
  validateBody(validateStatusUpdate), 
  AppointmentController.updateStatus
);

// 5. Cancelación (tutores también pueden cancelar con justificación)
router.post(
  '/:id/cancel', 
  requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION', 'TUTOR']), 
  AppointmentController.cancel
);

// 6. Despacho manual inmediato de notificación Web Push PWA al tutor
router.post(
  '/:id/notify-pwa', 
  requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), 
  AppointmentController.dispatchPwaNotification
);

export default router;

