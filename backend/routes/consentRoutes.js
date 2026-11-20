import { Router } from 'express';
import { ConsentController } from '../controllers/consentController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';

const validateCreateConsentDto = (data = {}) => {
  const errors = {};
  if (!Validators.isPositiveInt(data.paciente_id)) {
    errors.paciente_id = 'El ID del paciente es obligatorio y debe ser numérico.';
  }
  if (!Validators.isNonEmptyString(data.firmado_por_nombre) || Validators.exceedsMaxLength(data.firmado_por_nombre, 150)) {
    errors.firmado_por_nombre = 'El nombre completo de quien firma es obligatorio (máx. 150 caracteres).';
  }
  if (!Validators.isNonEmptyString(data.firmado_por_ci) || Validators.exceedsMaxLength(data.firmado_por_ci, 30)) {
    errors.firmado_por_ci = 'El C.I. de quien firma es obligatorio (máx. 30 caracteres).';
  }
  if (!Validators.isNonEmptyString(data.firma_digital_blob)) {
    errors.firma_digital_blob = 'La firma digital o documento firmado es obligatorio.';
  }
  if (data.titulo !== undefined && data.titulo !== null && Validators.exceedsMaxLength(String(data.titulo), 220)) {
    errors.titulo = 'El título no puede exceder 220 caracteres.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      ...data,
      paciente_id: Number(data.paciente_id),
      firmado_por_nombre: data.firmado_por_nombre ? data.firmado_por_nombre.trim() : '',
      firmado_por_ci: data.firmado_por_ci ? data.firmado_por_ci.trim() : ''
    }
  };
};

const validateRevokeConsentDto = (data = {}) => {
  const errors = {};
  if (data.motivo !== undefined && data.motivo !== null && Validators.exceedsMaxLength(String(data.motivo), 500)) {
    errors.motivo = 'El motivo de revocación no puede exceder 500 caracteres.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const router = Router();

router.use(authMiddleware);

// Verificar estado de consentimiento del paciente (RN-03)
router.get('/check/:patientId', ConsentController.checkConsentStatus);

// Listar consentimientos de un paciente
router.get('/patient/:patientId', ConsentController.getConsentsByPatient);

// Obtener detalle de consentimiento específico
router.get('/:id', ConsentController.getConsentById);

// Registrar y firmar consentimiento informado (TUTOR, RECEPCION, TERAPEUTA, ADMIN)
router.post(
  '/',
  requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION', 'TUTOR']),
  validateBody(validateCreateConsentDto),
  ConsentController.createConsent
);

// Revocar consentimiento por causas legales (ADMIN, TERAPEUTA)
router.post(
  '/:id/revoke',
  requireRole(['ADMIN', 'TERAPEUTA']),
  validateBody(validateRevokeConsentDto),
  ConsentController.revokeConsent
);

export default router;
