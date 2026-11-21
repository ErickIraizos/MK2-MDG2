import { Router } from 'express';
import multer from 'multer';
import { ConvenioController } from '../controllers/convenioController.js';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';
import { createSafeFileFilter, verifyUploadedFileMiddleware } from '../utils/fileValidator.js';

const ALLOWED_CONVENIO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
  fileFilter: createSafeFileFilter(
    ALLOWED_CONVENIO_MIMES,
    null,
    'Formato de imagen no permitido. Use JPEG, PNG, WEBP o SVG.'
  )
});

const router = Router();

// Rutas públicas / de consulta accesibles para visitantes, familias, tutores, terapeutas y administración
router.get('/', optionalAuthMiddleware, ConvenioController.getConvenios);
router.get('/stats', optionalAuthMiddleware, ConvenioController.getStats);
router.get('/item/:id', optionalAuthMiddleware, ConvenioController.getConvenioById);

const validateConvenioDto = ({ isCreate = true } = {}) => (data = {}) => {
  const errors = {};
  if (isCreate || data.nombre_institucion !== undefined) {
    if (!Validators.isNonEmptyString(data.nombre_institucion) || Validators.exceedsMaxLength(data.nombre_institucion, 180)) {
      errors.nombre_institucion = 'El nombre de la institución es obligatorio (máx. 180 caracteres).';
    }
  }
  if (isCreate || data.tipo_institucion !== undefined) {
    if (!Validators.isNonEmptyString(data.tipo_institucion) || Validators.exceedsMaxLength(data.tipo_institucion, 80)) {
      errors.tipo_institucion = 'El tipo de institución es obligatorio (máx. 80 caracteres).';
    }
  }
  if (isCreate || data.descripcion_convenio !== undefined) {
    if (!Validators.isNonEmptyString(data.descripcion_convenio) || Validators.exceedsMaxLength(data.descripcion_convenio, 2000)) {
      errors.descripcion_convenio = 'La descripción del convenio es obligatoria (máx. 2000 caracteres).';
    }
  }
  if (data.email_contacto && !Validators.isValidEmail(data.email_contacto)) {
    errors.email_contacto = 'El correo de contacto no tiene un formato válido.';
  }
  if (data.beneficio_familias !== undefined && data.beneficio_familias !== null && Validators.exceedsMaxLength(String(data.beneficio_familias), 1000)) {
    errors.beneficio_familias = 'El beneficio para familias no puede exceder 1000 caracteres.';
  }
  if (data.sitio_web !== undefined && data.sitio_web !== null && Validators.exceedsMaxLength(String(data.sitio_web), 255)) {
    errors.sitio_web = 'El sitio web no puede exceder 255 caracteres.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

// Rutas exclusivas para ADMIN
router.get('/admin/all', authMiddleware, requireRole(['ADMIN']), ConvenioController.getAllForAdmin);
router.post('/', authMiddleware, requireRole(['ADMIN']), validateBody(validateConvenioDto({ isCreate: true })), ConvenioController.createConvenio);
router.put('/:id', authMiddleware, requireRole(['ADMIN']), validateBody(validateConvenioDto({ isCreate: false })), ConvenioController.updateConvenio);
router.patch('/:id/toggle', authMiddleware, requireRole(['ADMIN']), ConvenioController.toggleActivo);
router.delete('/:id', authMiddleware, requireRole(['ADMIN']), ConvenioController.deleteConvenio);
router.post('/upload', authMiddleware, requireRole(['ADMIN']), upload.single('imagen'), verifyUploadedFileMiddleware(ALLOWED_CONVENIO_MIMES), ConvenioController.uploadLogo);

export default router;
