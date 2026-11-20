import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TherapistController } from '../controllers/therapistController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';
import { createSafeFileFilter, verifyUploadedFileMiddleware } from '../utils/fileValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const THERAPISTS_UPLOAD_DIR = path.resolve(__dirname, '../uploads/therapists');

if (!fs.existsSync(THERAPISTS_UPLOAD_DIR)) {
  fs.mkdirSync(THERAPISTS_UPLOAD_DIR, { recursive: true });
}

const ALLOWED_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, THERAPISTS_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `therapist_${uniqueSuffix}${ext}`);
  }
});

const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: createSafeFileFilter(
    ALLOWED_PHOTO_MIMES,
    null,
    'Formato no permitido. Utilice imágenes en formato JPG, PNG o WEBP.'
  )
});

const router = Router();

// Catálogo de especialidades (accesible incluso público o con auth)
router.get('/specialties', TherapistController.getSpecialties);

// Directorio general (público / lectura para pacientes o personal)
router.get('/', TherapistController.getAll);

// Rutas autenticadas
router.use(authMiddleware);

// Perfil propio del terapeuta en sesión
router.get('/me', requireRole(['ADMIN', 'TERAPEUTA']), TherapistController.getMe);
router.post('/upload-photo', requireRole(['ADMIN', 'TERAPEUTA']), photoUpload.single('foto'), verifyUploadedFileMiddleware(ALLOWED_PHOTO_MIMES), TherapistController.uploadPhoto);
router.post('/:id/photo', requireRole(['ADMIN', 'TERAPEUTA']), photoUpload.single('foto'), verifyUploadedFileMiddleware(ALLOWED_PHOTO_MIMES), TherapistController.uploadPhoto);

router.get('/:id', TherapistController.getById);

const validateTherapistCreate = (data) => {
  const errors = [];
  if (!Validators.isNonEmptyString(data.nombres)) {
    errors.push({ field: 'nombres', message: 'Los nombres del especialista son obligatorios.' });
  }
  if (!Validators.isNonEmptyString(data.apellidos)) {
    errors.push({ field: 'apellidos', message: 'Los apellidos del especialista son obligatorios.' });
  }
  if (!Validators.isNonEmptyString(data.registro_profesional)) {
    errors.push({ field: 'registro_profesional', message: 'El número de matrícula o registro profesional (CPB) es obligatorio.' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      ...data,
      nombres: data.nombres ? data.nombres.trim() : '',
      apellidos: data.apellidos ? data.apellidos.trim() : '',
      registro_profesional: data.registro_profesional ? data.registro_profesional.trim().toUpperCase() : ''
    }
  };
};

const validateTherapistUpdate = (data = {}) => {
  const errors = [];
  if (data.nombres !== undefined && (!Validators.isNonEmptyString(data.nombres) || Validators.exceedsMaxLength(data.nombres, 100))) {
    errors.push({ field: 'nombres', message: 'Los nombres no pueden quedar vacíos ni exceder 100 caracteres.' });
  }
  if (data.apellidos !== undefined && (!Validators.isNonEmptyString(data.apellidos) || Validators.exceedsMaxLength(data.apellidos, 100))) {
    errors.push({ field: 'apellidos', message: 'Los apellidos no pueden quedar vacíos ni exceder 100 caracteres.' });
  }
  if (data.email && !Validators.isValidEmail(data.email)) {
    errors.push({ field: 'email', message: 'El correo electrónico no es válido.' });
  }
  if (data.porcentaje_honorarios !== undefined && data.porcentaje_honorarios !== null && data.porcentaje_honorarios !== '') {
    const pct = Number(data.porcentaje_honorarios);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      errors.push({ field: 'porcentaje_honorarios', message: 'El porcentaje de honorarios debe estar entre 0 y 100.' });
    }
  }
  if (data.arancel_base_bob !== undefined && data.arancel_base_bob !== null && data.arancel_base_bob !== '' && !Validators.isPositiveNumber(data.arancel_base_bob)) {
    errors.push({ field: 'arancel_base_bob', message: 'El arancel base debe ser mayor a 0.' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      ...data,
      ...(typeof data.nombres === 'string' ? { nombres: data.nombres.trim() } : {}),
      ...(typeof data.apellidos === 'string' ? { apellidos: data.apellidos.trim() } : {})
    }
  };
};

router.post('/', requireRole(['ADMIN']), validateBody(validateTherapistCreate), TherapistController.create);
router.put('/:id', requireRole(['ADMIN', 'TERAPEUTA']), validateBody(validateTherapistUpdate), TherapistController.update);
router.delete('/:id', requireRole(['ADMIN']), TherapistController.delete);

export default router;
