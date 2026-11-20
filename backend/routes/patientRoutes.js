import { Router } from 'express';
import { PatientController } from '../controllers/patientController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';

const router = Router();

// Todas las rutas de pacientes requieren autenticación
router.use(authMiddleware);

// Validadores DTO
const validatePatientCreate = (data) => {
  const errors = [];
  if (!Validators.isNonEmptyString(data.nombres)) {
    errors.push({ field: 'nombres', message: 'Los nombres del paciente son obligatorios.' });
  }
  if (!Validators.isNonEmptyString(data.apellidos)) {
    errors.push({ field: 'apellidos', message: 'Los apellidos del paciente son obligatorios.' });
  }
  if (!Validators.isNonEmptyString(data.ci)) {
    errors.push({ field: 'ci', message: 'La Cédula de Identidad (C.I.) es obligatoria para todos los pacientes.' });
  }
  if (!data.fecha_nacimiento) {
    errors.push({ field: 'fecha_nacimiento', message: 'La fecha de nacimiento es obligatoria.' });
  } else {
    const d = new Date(data.fecha_nacimiento);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'fecha_nacimiento', message: 'Formato de fecha de nacimiento inválido.' });
    } else if (d > new Date()) {
      errors.push({ field: 'fecha_nacimiento', message: 'La fecha de nacimiento no puede ser una fecha futura.' });
    }
  }
  if (!data.sexo || !['M', 'F', 'OTRO'].includes(data.sexo)) {
    errors.push({ field: 'sexo', message: 'El sexo debe ser M, F u OTRO.' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      ...data,
      nombres: data.nombres ? data.nombres.trim() : '',
      apellidos: data.apellidos ? data.apellidos.trim() : '',
      ci: data.ci ? data.ci.trim() : ''
    }
  };
};

const validateTutorCreate = (data) => {
  const errors = [];
  if (!Validators.isNonEmptyString(data.nombres)) {
    errors.push({ field: 'nombres', message: 'El nombre del tutor es obligatorio.' });
  }
  if (!Validators.isNonEmptyString(data.apellidos)) {
    errors.push({ field: 'apellidos', message: 'Los apellidos del tutor son obligatorios.' });
  }
  if (!Validators.isNonEmptyString(data.whatsapp)) {
    errors.push({ field: 'whatsapp', message: 'El número de WhatsApp es obligatorio para recordatorios.' });
  } else if (!Validators.isValidPhoneBolivia(data.whatsapp)) {
    errors.push({ field: 'whatsapp', message: 'El formato de teléfono/WhatsApp boliviano no es válido (8 dígitos).' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      ...data,
      nombres: data.nombres ? data.nombres.trim() : '',
      apellidos: data.apellidos ? data.apellidos.trim() : '',
      whatsapp: data.whatsapp ? data.whatsapp.trim() : ''
    }
  };
};

const validateTutorUpdate = (data = {}) => {
  const errors = [];
  if (data.nombres !== undefined && !Validators.isNonEmptyString(data.nombres)) {
    errors.push({ field: 'nombres', message: 'El nombre del tutor no puede quedar vacío.' });
  }
  if (data.apellidos !== undefined && !Validators.isNonEmptyString(data.apellidos)) {
    errors.push({ field: 'apellidos', message: 'Los apellidos del tutor no pueden quedar vacíos.' });
  }
  if (data.whatsapp !== undefined && (!Validators.isNonEmptyString(data.whatsapp) || !Validators.isValidPhoneBolivia(data.whatsapp))) {
    errors.push({ field: 'whatsapp', message: 'El número de WhatsApp boliviano no es válido (8 dígitos).' });
  }
  if (data.email && !Validators.isValidEmail(data.email)) {
    errors.push({ field: 'email', message: 'El correo electrónico del tutor no es válido.' });
  }
  return { isValid: errors.length === 0, errors };
};

const validatePatientUpdate = (data = {}) => {
  const errors = [];
  if (data.nombres !== undefined && !Validators.isNonEmptyString(data.nombres)) {
    errors.push({ field: 'nombres', message: 'Los nombres no pueden quedar vacíos.' });
  }
  if (data.apellidos !== undefined && !Validators.isNonEmptyString(data.apellidos)) {
    errors.push({ field: 'apellidos', message: 'Los apellidos no pueden quedar vacíos.' });
  }
  if (data.fecha_nacimiento !== undefined && data.fecha_nacimiento !== null && data.fecha_nacimiento !== '') {
    const d = new Date(data.fecha_nacimiento);
    if (isNaN(d.getTime()) || d > new Date()) {
      errors.push({ field: 'fecha_nacimiento', message: 'La fecha de nacimiento es inválida o futura.' });
    }
  }
  if (data.sexo !== undefined && !['M', 'F', 'OTRO'].includes(data.sexo)) {
    errors.push({ field: 'sexo', message: 'El sexo debe ser M, F u OTRO.' });
  }
  return { isValid: errors.length === 0, errors };
};

// Rutas de Tutores (Lectura para personal clínico)
router.get('/tutors', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), PatientController.getAllTutors);
router.post('/tutors', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), validateBody(validateTutorCreate), PatientController.createTutor);
router.put('/tutors/:id', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), validateBody(validateTutorUpdate), PatientController.updateTutor);

// Rutas Especiales de Pacientes (Deben definirse antes de /:id para evitar colisión de rutas)
router.get('/check-ci', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), PatientController.checkCi);
router.get('/next-code', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), PatientController.getNextCode);
router.get('/', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION', 'TUTOR']), PatientController.getAll);
router.get('/code/:code', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION', 'TUTOR']), PatientController.getByCode);
router.get('/:id', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION', 'TUTOR']), PatientController.getById);

router.post('/', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), validateBody(validatePatientCreate), PatientController.create);
router.put('/:id', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), validateBody(validatePatientUpdate), PatientController.update);
router.delete('/:id', requireRole(['ADMIN', 'TERAPEUTA']), PatientController.delete);
router.put('/:id/restore', requireRole(['ADMIN']), PatientController.restore);

// Derivaciones Interdisciplinarias
router.post('/:id/derivar', requireRole(['ADMIN', 'TERAPEUTA']), PatientController.derivar);
router.get('/:id/derivaciones', requireRole(['ADMIN', 'TERAPEUTA']), PatientController.getDerivations);

// Vínculos Familiares
router.get('/:id/tutors', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), PatientController.getTutorsByPatient);
router.post('/:id/tutors', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), PatientController.linkTutor);
router.delete('/:id/tutors/:tutorId', requireRole(['ADMIN', 'TERAPEUTA']), PatientController.unlinkTutor);

export default router;
