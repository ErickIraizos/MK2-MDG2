import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';

const validateCreateUserDto = (data = {}) => {
  const errors = {};
  if (!Validators.isNonEmptyString(data.nombre_completo) || Validators.exceedsMaxLength(data.nombre_completo, 150)) {
    errors.nombre_completo = 'El nombre completo es obligatorio (máx. 150 caracteres).';
  }
  if (!Validators.isValidEmail(data.email)) {
    errors.email = 'Debe proporcionar un correo electrónico válido.';
  }
  if (typeof data.password !== 'string' || data.password.length < 8 || data.password.length > 100) {
    errors.password = 'La contraseña debe tener entre 8 y 100 caracteres.';
  }
  if (![1, 2, 3, 4].includes(Number(data.rol_id))) {
    errors.rol_id = 'El rol asignado debe ser válido (1-4).';
  }
  if (data.telefono && !/^[+\d\s()-]{6,20}$/.test(String(data.telefono).trim())) {
    errors.telefono = 'El teléfono solo puede contener dígitos y símbolos válidos (+, -, paréntesis), entre 6 y 20 caracteres.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateUpdateRoleDto = (data = {}) => {
  const errors = {};
  if (![1, 2, 3, 4].includes(Number(data.rol_id))) {
    errors.rol_id = 'Debe seleccionar un rol válido (1-4).';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const validateUpdateStatusDto = (data = {}) => {
  const errors = {};
  if (data.activo === undefined && data.motivo === undefined) {
    return { isValid: true, errors };
  }
  if (data.motivo !== undefined && data.motivo !== null && Validators.exceedsMaxLength(String(data.motivo), 300)) {
    errors.motivo = 'El motivo no puede exceder 300 caracteres.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const router = Router();

// Todas las rutas de administración de usuarios requieren autenticación y rol ADMIN
router.use(authMiddleware);
router.use(requireRole(['ADMIN']));

router.get('/', UserController.getAll);
router.get('/inactive', UserController.getInactive);
router.get('/audit-logs', UserController.getAuditLogs);
router.post('/', validateBody(validateCreateUserDto), UserController.create);
router.put('/:id/role', validateBody(validateUpdateRoleDto), UserController.updateRole);
router.put('/:id/status', validateBody(validateUpdateStatusDto), UserController.updateStatus);
router.put('/:id/restore', UserController.restore);
router.delete('/:id', UserController.delete);

export default router;
