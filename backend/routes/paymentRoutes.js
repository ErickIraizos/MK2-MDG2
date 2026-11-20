import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PaymentController } from '../controllers/paymentController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';
import { createSafeFileFilter, verifyUploadedFileMiddleware } from '../utils/fileValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RECEIPTS_DIR = path.resolve(__dirname, '../uploads/receipts');
const QR_DIR = path.resolve(__dirname, '../uploads/qr');

if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

const ALLOWED_RECEIPT_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ALLOWED_QR_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, RECEIPTS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `comprobante_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const uploadReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: createSafeFileFilter(
    ALLOWED_RECEIPT_MIMES,
    null,
    'Formato de comprobante no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP) o documentos PDF.'
  )
});

const qrStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, QR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `qr_institucional_${Date.now()}${ext}`);
  }
});
const uploadQr = multer({
  storage: qrStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: createSafeFileFilter(
    ALLOWED_QR_MIMES,
    null,
    'Formato de imagen QR no permitido. Solo se aceptan imágenes JPG, PNG o WEBP.'
  )
});

const validateQrConfigDto = (data = {}) => {
  const errors = {};
  for (const key of ['PAGO_BANCO_NOMBRE', 'PAGO_CUENTA_TITULAR', 'PAGO_CUENTA_NUMERO', 'banco_nombre', 'cuenta_titular', 'cuenta_numero']) {
    if (data[key] !== undefined && data[key] !== null && Validators.exceedsMaxLength(String(data[key]), 150)) {
      errors[key] = 'No puede exceder 150 caracteres.';
    }
  }
  for (const key of ['PAGO_QR_INSTRUCCIONES', 'instrucciones']) {
    if (data[key] !== undefined && data[key] !== null && Validators.exceedsMaxLength(String(data[key]), 600)) {
      errors[key] = 'Las instrucciones no pueden exceder 600 caracteres.';
    }
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const validatePaymentRequestDto = (data = {}) => {
  const errors = {};
  if (!Validators.isPositiveInt(data.paciente_id)) {
    errors.paciente_id = 'El ID del paciente debe ser un entero positivo.';
  }
  if (data.terapeuta_id !== undefined && data.terapeuta_id !== null && data.terapeuta_id !== '' && !Validators.isPositiveInt(data.terapeuta_id)) {
    errors.terapeuta_id = 'El ID del terapeuta debe ser un entero positivo.';
  }
  if (data.cita_id !== undefined && data.cita_id !== null && data.cita_id !== '' && !Validators.isPositiveInt(data.cita_id)) {
    errors.cita_id = 'El ID de la cita debe ser un entero positivo.';
  }
  if (!Validators.isPositiveNumber(data.monto_bob) || Number(data.monto_bob) > 50000) {
    errors.monto_bob = 'El monto debe ser un valor numérico mayor a 0 y menor o igual a 50,000.';
  }
  if (data.servicio_nombre !== undefined && Validators.exceedsMaxLength(String(data.servicio_nombre), 150)) {
    errors.servicio_nombre = 'El nombre del servicio no puede exceder 150 caracteres.';
  }
  if (data.mensaje_tutor !== undefined && Validators.exceedsMaxLength(String(data.mensaje_tutor), 500)) {
    errors.mensaje_tutor = 'El mensaje para el tutor no puede exceder 500 caracteres.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      ...data,
      monto_bob: Number(data.monto_bob),
      servicio_nombre: typeof data.servicio_nombre === 'string' ? data.servicio_nombre.trim() : data.servicio_nombre,
      mensaje_tutor: typeof data.mensaje_tutor === 'string' ? data.mensaje_tutor.trim() : data.mensaje_tutor
    }
  };
};

const validateMyTariffDto = (data = {}) => {
  const errors = {};
  if (data.arancel_base_bob !== undefined && data.arancel_base_bob !== null && data.arancel_base_bob !== '') {
    if (!Validators.isPositiveNumber(data.arancel_base_bob) || Number(data.arancel_base_bob) > 50000) {
      errors.arancel_base_bob = 'El arancel base debe ser mayor a 0 y menor o igual a 50,000.';
    }
  }
  if (data.qr_fecha_vencimiento && !Validators.isValidIsoDate(String(data.qr_fecha_vencimiento))) {
    errors.qr_fecha_vencimiento = 'La fecha de vencimiento debe tener formato YYYY-MM-DD.';
  }
  if (Array.isArray(data.tariffs)) {
    for (const item of data.tariffs) {
      const fee = item?.arancel_bob ?? item?.arancel_terapeuta_bob;
      if (!Validators.isPositiveInt(item?.servicio_id) || !Validators.isPositiveNumber(fee) || Number(fee) > 50000) {
        errors.tariffs = 'Cada tarifa del listado requiere servicio_id válido y un arancel positivo (hasta 50,000 Bs.).';
        break;
      }
    }
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateUploadReceiptDto = (data = {}) => {
  const errors = {};
  if (data.numero_transaccion !== undefined && data.numero_transaccion !== null && Validators.exceedsMaxLength(String(data.numero_transaccion), 100)) {
    errors.numero_transaccion = 'El número de transacción no puede exceder 100 caracteres.';
  }
  if (data.observaciones !== undefined && data.observaciones !== null && Validators.exceedsMaxLength(String(data.observaciones), 500)) {
    errors.observaciones = 'Las observaciones no pueden exceder 500 caracteres.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateVerifyPaymentDto = (data = {}) => {
  const errors = {};
  const validStates = ['VERIFICADO', 'COMPLETADO', 'RECHAZADO'];
  if (data.estado !== undefined && !validStates.includes(data.estado)) {
    errors.estado = 'El estado debe ser VERIFICADO, COMPLETADO o RECHAZADO.';
  }
  if (data.observaciones !== undefined && data.observaciones !== null && Validators.exceedsMaxLength(String(data.observaciones), 500)) {
    errors.observaciones = 'Las observaciones no pueden exceder 500 caracteres.';
  }
  if (data.motivo_rechazo !== undefined && data.motivo_rechazo !== null && Validators.exceedsMaxLength(String(data.motivo_rechazo), 500)) {
    errors.motivo_rechazo = 'El motivo de rechazo no puede exceder 500 caracteres.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateCashPaymentDto = (data = {}) => {
  const errors = {};
  if (data.monto !== undefined && data.monto !== null && data.monto !== '') {
    if (!Validators.isPositiveNumber(data.monto) || Number(data.monto) > 50000) {
      errors.monto = 'El monto en efectivo debe ser mayor a 0 y menor o igual a 50,000.';
    }
  }
  if (data.observaciones !== undefined && data.observaciones !== null && Validators.exceedsMaxLength(String(data.observaciones), 500)) {
    errors.observaciones = 'Las observaciones no pueden exceder 500 caracteres.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const router = Router();

router.use(authMiddleware);

// Rutas de pagos
router.get('/', PaymentController.getPayments);
router.get('/summary', requireRole(['ADMIN', 'RECEPCION', 'TERAPEUTA']), PaymentController.getCashSummary);
router.get('/qr-config', PaymentController.getQrConfig);
router.post('/qr-config', requireRole(['ADMIN', 'RECEPCION']), validateBody(validateQrConfigDto), PaymentController.updateQrConfig);
router.post('/qr-image', requireRole(['ADMIN', 'RECEPCION']), uploadQr.single('qr_image'), verifyUploadedFileMiddleware(ALLOWED_QR_MIMES), PaymentController.uploadQrImage);

// Tarifario y QR personal del especialista (Sprint 10)
router.post('/request', requireRole(['TERAPEUTA', 'ADMIN', 'RECEPCION']), validateBody(validatePaymentRequestDto), PaymentController.createPaymentRequest);
router.get('/therapist-config/:therapistId', PaymentController.getTherapistPaymentConfig);
router.get('/my-tariff', requireRole(['TERAPEUTA']), PaymentController.getMyTherapistPaymentConfig);
router.post('/my-tariff', requireRole(['TERAPEUTA']), validateBody(validateMyTariffDto), PaymentController.updateMyTherapistPaymentConfig);
router.post('/my-qr', requireRole(['TERAPEUTA']), uploadQr.single('qr_image'), verifyUploadedFileMiddleware(ALLOWED_QR_MIMES), PaymentController.uploadTherapistQr);

router.get('/appointment/:appointmentId', PaymentController.ensurePayment);
router.get('/:id', PaymentController.getPaymentById);
router.post('/:id/upload-receipt', uploadReceipt.single('comprobante'), verifyUploadedFileMiddleware(ALLOWED_RECEIPT_MIMES), validateBody(validateUploadReceiptDto), PaymentController.uploadReceipt);

// Aprobación dual: ADMIN, RECEPCION y TERAPEUTA
router.post('/:id/verify', requireRole(['ADMIN', 'RECEPCION', 'TERAPEUTA']), validateBody(validateVerifyPaymentDto), PaymentController.verifyPayment);

// Cobro en efectivo
router.post('/cash/:appointmentId', requireRole(['ADMIN', 'RECEPCION', 'TERAPEUTA']), validateBody(validateCashPaymentDto), PaymentController.registerCashPayment);

// Visor del comprobante físico
router.get('/:id/receipt-file', PaymentController.viewReceipt);

export default router;
