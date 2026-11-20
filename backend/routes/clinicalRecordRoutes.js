import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { ClinicalRecordController } from '../controllers/clinicalRecordController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';
import { createSafeFileFilter, verifyUploadedFileMiddleware } from '../utils/fileValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads', 'patient_documents');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_CLINICAL_DOC_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

// Configuración segura de Multer (Almacenamiento en disco con nombres sanitizados / UUID)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    cb(null, `doc_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // Máximo 15 MB por estudio / laboratorio
  fileFilter: createSafeFileFilter(
    ALLOWED_CLINICAL_DOC_MIMES,
    null,
    'Tipo de archivo no permitido. Solo se aceptan PDFs o imágenes (JPEG/PNG/WEBP).'
  )
});

const router = Router();

// Todas las rutas de historias clínicas requieren autenticación
router.use(authMiddleware);

// =========================================================================
// CATÁLOGO NOSOLÓGICO CLÍNICO CIE-11 / DSM-5 (HU-08)
// =========================================================================
router.get(
  '/diagnostics/search',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.searchDiagnostics
);

// =========================================================================
// CARPETAS DIGITALES Y ESTUDIOS EXTERNOS / LABORATORIOS (HU-08)
// =========================================================================
router.get(
  '/patient/:patientId/folders',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.getPatientFolders
);

router.post(
  '/patient/:patientId/folders',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.createPatientFolder
);

router.patch(
  '/patient/:patientId/folders/:folderId/status',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.updateFolderStatus
);

router.get(
  '/patient/:patientId/documents',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.getPatientDocuments
);

router.post(
  '/patient/:patientId/documents',
  requireRole(['ADMIN', 'TERAPEUTA']),
  upload.single('file'),
  verifyUploadedFileMiddleware(ALLOWED_CLINICAL_DOC_MIMES),
  ClinicalRecordController.uploadPatientDocument
);

router.get(
  '/documents/:docId/view',
  requireRole(['ADMIN', 'TERAPEUTA', 'TUTOR']),
  ClinicalRecordController.viewDocument
);

router.delete(
  '/documents/:docId',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.softDeleteDocument
);

router.post(
  '/documents/:docId/restore',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.restoreDocument
);

router.get(
  '/patients/:patientId/inactive-documents',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.getInactiveDocuments
);

// =========================================================================
// HISTORIAS CLÍNICAS Y NOTAS SOAP (HU-07)
// =========================================================================
// 1. Obtener lista de historias clínicas (Admin, Terapeutas, Recepción)
router.get(
  '/',
  requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']),
  ClinicalRecordController.getHistories
);

// 2. Asistente IA para estructuración de notas SOAP (Admin, Terapeutas)
router.post(
  '/assist-soap',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.assistSoap
);

// 3. Obtener historia clínica por paciente (Admin, Terapeutas, Recepción)
router.get(
  '/patient/:patientId',
  requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']),
  ClinicalRecordController.getHistoryByPatient
);

// 4. Obtener historia clínica por ID con Anamnesis y Notas SOAP (Admin, Terapeutas, Recepción)
router.get(
  '/:id',
  requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']),
  ClinicalRecordController.getHistoryById
);

// 5. Actualizar estado clínico del expediente (Admin, Terapeutas)
router.patch(
  '/:id/status',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.updateStatus
);

const validateAnamnesisDto = (data = {}) => {
  const errors = {};
  if (!Validators.isNonEmptyString(data.motivoConsulta)) {
    errors.motivoConsulta = 'El motivo de consulta es obligatorio para la anamnesis.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateSoapDto = (data = {}) => {
  const errors = {};
  for (const field of ['subjetivo', 'objetivo', 'analisis', 'plan']) {
    if (!Validators.isNonEmptyString(data[field])) {
      errors[field] = `El campo ${field} del pilar SOAP es obligatorio.`;
    }
  }
  if (data.numeroSesion !== undefined && data.numeroSesion !== null && data.numeroSesion !== '' && !Validators.isPositiveInt(data.numeroSesion)) {
    errors.numeroSesion = 'El número de sesión debe ser un entero positivo.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const validatePlanDto = (data = {}) => {
  const errors = {};
  if (!Validators.isNonEmptyString(data.titulo) || Validators.exceedsMaxLength(data.titulo, 200)) {
    errors.titulo = 'El título del plan terapéutico es obligatorio (máx. 200 caracteres).';
  }
  if (!Validators.isNonEmptyString(data.objetivoGeneral)) {
    errors.objetivoGeneral = 'El objetivo general del plan terapéutico es obligatorio.';
  }
  if (data.periodicidadMeses !== undefined && data.periodicidadMeses !== null && data.periodicidadMeses !== '') {
    const m = Number(data.periodicidadMeses);
    if (!Number.isInteger(m) || m < 1 || m > 36) {
      errors.periodicidadMeses = 'La periodicidad debe estar entre 1 y 36 meses.';
    }
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

// 6. Registrar o actualizar Anamnesis / Evaluación Inicial (Admin, Terapeutas)
router.post(
  '/:id/anamnesis',
  requireRole(['ADMIN', 'TERAPEUTA']),
  validateBody(validateAnamnesisDto),
  ClinicalRecordController.saveAnamnesis
);

// 7. Registrar nueva Nota de Evolución SOAP sellada e inalterable (Admin, Terapeutas)
router.post(
  '/:id/soap',
  requireRole(['ADMIN', 'TERAPEUTA']),
  validateBody(validateSoapDto),
  ClinicalRecordController.createSoap
);

// =========================================================================
// PLANES TERAPÉUTICOS INDIVIDUALIZADOS (PTI) Y METAS SMART (HU-09)
// =========================================================================
router.get(
  '/portal/family-plans',
  requireRole(['TUTOR']),
  ClinicalRecordController.getFamilyPlansForTutor
);

router.post(
  '/portal/family-checkin',
  requireRole(['TUTOR']),
  ClinicalRecordController.recordHomePracticeCheckin
);

router.get(
  '/portal/family-checkins/:patientId',
  requireRole(['ADMIN', 'TERAPEUTA', 'TUTOR']),
  ClinicalRecordController.getHomePracticeHistory
);

router.get(
  '/:historyId/plans',
  requireRole(['ADMIN', 'TERAPEUTA', 'TUTOR']),
  ClinicalRecordController.getInterventionPlans
);

router.post(
  '/:historyId/plans',
  requireRole(['ADMIN', 'TERAPEUTA']),
  validateBody(validatePlanDto),
  ClinicalRecordController.createInterventionPlan
);

router.get(
  '/plans/:planId',
  requireRole(['ADMIN', 'TERAPEUTA', 'TUTOR']),
  ClinicalRecordController.getInterventionPlanById
);

router.patch(
  '/plans/:planId/status',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.updateInterventionPlanStatus
);

router.post(
  '/plans/:planId/goals',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.addSmartGoal
);

router.patch(
  '/goals/:metaId/progress',
  requireRole(['ADMIN', 'TERAPEUTA']),
  ClinicalRecordController.updateSmartGoalProgress
);

router.get(
  '/goals/:metaId/history',
  requireRole(['ADMIN', 'TERAPEUTA', 'TUTOR']),
  ClinicalRecordController.getGoalHistory
);

export default router;

