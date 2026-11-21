import { Router } from 'express';
import multer from 'multer';
import { DocumentReportController } from '../controllers/documentReportController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';
import { createSafeFileFilter, verifyUploadedFileMiddleware } from '../utils/fileValidator.js';

const ALLOWED_REPORT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB para informes
  fileFilter: createSafeFileFilter(
    ALLOWED_REPORT_MIMES,
    null,
    'Formato no permitido para informe firmado. Solo se aceptan PDF, Word (.doc/.docx) o imágenes (JPG, PNG, WEBP).'
  )
});

const router = Router();

router.use(authMiddleware);

// Descargar archivo Word (.docx) generado
router.get('/:id/docx', DocumentReportController.downloadDocx);

// Descargar archivo firmado escaneado (PDF/Word/Imagen)
router.get(
  '/:id/signed',
  requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION', 'TUTOR']),
  DocumentReportController.downloadSignedDocument
);

// Obtener detalle de informe específico
router.get('/:id', DocumentReportController.getReportById);

// Listar informes de un paciente (filtrado para tutores solo entregables)
router.get(
  '/patient/:patientId',
  requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION', 'TUTOR']),
  DocumentReportController.getReportsByPatient
);

const validateReportPayloadDto = ({ requirePatient = true } = {}) => (data = {}) => {
  const errors = {};
  if (requirePatient && !Validators.isPositiveInt(data.paciente_id)) {
    errors.paciente_id = 'El ID del paciente debe ser un entero positivo.';
  } else if (!requirePatient && data.paciente_id !== undefined && !Validators.isPositiveInt(data.paciente_id)) {
    errors.paciente_id = 'El ID del paciente debe ser un entero positivo.';
  }
  if (data.historia_id !== undefined && data.historia_id !== null && data.historia_id !== '' && !Validators.isPositiveInt(data.historia_id)) {
    errors.historia_id = 'El ID de historia clínica debe ser un entero positivo.';
  }
  if (data.terapeuta_id !== undefined && data.terapeuta_id !== null && data.terapeuta_id !== '' && !Validators.isPositiveInt(data.terapeuta_id)) {
    errors.terapeuta_id = 'El ID de terapeuta debe ser un entero positivo.';
  }
  if (data.titulo !== undefined && data.titulo !== null && Validators.exceedsMaxLength(String(data.titulo), 220)) {
    errors.titulo = 'El título no puede exceder 220 caracteres.';
  }
  if (data.estado !== undefined && !['BORRADOR', 'FINALIZADO', 'FIRMADO'].includes(data.estado)) {
    errors.estado = 'El estado debe ser BORRADOR, FINALIZADO o FIRMADO.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

// Crear y compilar nuevo informe clínico (.docx)
router.post(
  '/',
  requireRole(['ADMIN', 'TERAPEUTA']),
  validateBody(validateReportPayloadDto({ requirePatient: true })),
  DocumentReportController.createReport
);

// Subir informe firmado físicamente o digitalmente (PDF/Word escaneado)
router.post(
  '/:id/upload-signed',
  requireRole(['ADMIN', 'TERAPEUTA']),
  upload.single('archivo_firmado'),
  verifyUploadedFileMiddleware(ALLOWED_REPORT_MIMES),
  DocumentReportController.uploadSignedDocument
);

// Estampar directamente la firma digital colegiada guardada en el perfil del especialista
router.post(
  '/:id/stamp-signature',
  requireRole(['ADMIN', 'TERAPEUTA']),
  DocumentReportController.stampSignature
);

// Actualizar informe existente
router.put(
  '/:id',
  requireRole(['ADMIN', 'TERAPEUTA']),
  validateBody(validateReportPayloadDto({ requirePatient: false })),
  DocumentReportController.updateReport
);

// Eliminar informe (solo ADMIN o autor si está en borrador)
router.delete(
  '/:id',
  requireRole(['ADMIN', 'TERAPEUTA']),
  DocumentReportController.deleteReport
);

export default router;
