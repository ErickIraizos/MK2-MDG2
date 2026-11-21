import { Router } from 'express';
import multer from 'multer';
import { BatteryController } from '../controllers/batteryController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';
import { createSafeFileFilter, verifyUploadedFileMiddleware } from '../utils/fileValidator.js';
import { storageService } from '../services/storageService.js';

const ALLOWED_BATTERY_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
  fileFilter: createSafeFileFilter(
    ALLOWED_BATTERY_MIMES,
    null,
    'Tipo de archivo no permitido. Solo se aceptan imágenes (JPEG/PNG/WEBP/SVG) o documentos PDF.'
  )
});

const router = Router();

router.use(authMiddleware);

// Rutas de inventario y baterías
router.get('/', BatteryController.getAllBatteries);
router.get('/history', requireRole(['ADMIN', 'RECEPCION', 'TERAPEUTA']), BatteryController.getLoanHistory);
router.get('/therapist-status/:therapistId', BatteryController.checkTherapistStatus);
router.get('/:id', BatteryController.getBatteryById);

const validateBatteryDto = ({ isCreate = true } = {}) => (data = {}) => {
  const errors = {};
  if (isCreate || data.codigo_patrimonial !== undefined) {
    if (!Validators.isNonEmptyString(data.codigo_patrimonial) || Validators.exceedsMaxLength(data.codigo_patrimonial, 60)) {
      errors.codigo_patrimonial = 'El código patrimonial es obligatorio (máx. 60 caracteres).';
    }
  }
  if (isCreate || data.nombre !== undefined) {
    if (!Validators.isNonEmptyString(data.nombre) || Validators.exceedsMaxLength(data.nombre, 160)) {
      errors.nombre = 'El nombre de la batería es obligatorio (máx. 160 caracteres).';
    }
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateLoanDto = (data = {}) => {
  const errors = {};
  if (!Validators.isPositiveInt(data.bateria_id)) {
    errors.bateria_id = 'Debe seleccionar una batería válida.';
  }
  if (!Validators.isPositiveInt(data.terapeuta_id)) {
    errors.terapeuta_id = 'Debe seleccionar un especialista válido.';
  }
  if (data.duracion_horas !== undefined && data.duracion_horas !== null && data.duracion_horas !== '') {
    const h = Number(data.duracion_horas);
    if (!Number.isFinite(h) || h < 1 || h > 72) {
      errors.duracion_horas = 'La duración del préstamo debe estar entre 1 y 72 horas.';
    }
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateReturnDto = (data = {}) => {
  const errors = {};
  if (data.observaciones_recepcion !== undefined && data.observaciones_recepcion !== null && Validators.exceedsMaxLength(String(data.observaciones_recepcion), 500)) {
    errors.observaciones_recepcion = 'Las observaciones no pueden exceder 500 caracteres.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

router.post('/', requireRole(['ADMIN', 'RECEPCION']), validateBody(validateBatteryDto({ isCreate: true })), BatteryController.createBattery);
router.put('/:id', requireRole(['ADMIN', 'RECEPCION']), validateBody(validateBatteryDto({ isCreate: false })), BatteryController.updateBattery);

// Subida de imagen o documento de referencia
router.post('/upload-image', requireRole(['ADMIN', 'RECEPCION']), upload.single('file'), verifyUploadedFileMiddleware(ALLOWED_BATTERY_MIMES), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
    }
    const objectPath = `batteries/${storageService.buildSafeFilename('battery', req.file.originalname)}`;
    const uploaded = await storageService.uploadPublic(objectPath, req.file.buffer, req.file.mimetype);
    res.status(200).json({
      success: true,
      message: 'Archivo de referencia subido con éxito.',
      url: uploaded.publicUrl,
      filename: uploaded.path
    });
  } catch (err) {
    next(err);
  }
});

// Préstamo y devolución de pruebas clínicas
router.post('/loan', requireRole(['ADMIN', 'RECEPCION']), validateBody(validateLoanDto), BatteryController.registerLoan);
router.post('/return/:loanId', requireRole(['ADMIN', 'RECEPCION']), validateBody(validateReturnDto), BatteryController.registerReturn);

export default router;
