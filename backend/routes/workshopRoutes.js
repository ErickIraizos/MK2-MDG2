import { Router } from 'express';
import { WorkshopController } from '../controllers/workshopController.js';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';

const validateWorkshopDto = ({ isCreate = true } = {}) => (data = {}) => {
  const errors = {};
  if (isCreate || data.titulo !== undefined) {
    if (!Validators.isNonEmptyString(data.titulo) || Validators.exceedsMaxLength(data.titulo, 180)) {
      errors.titulo = 'El título del taller es obligatorio (máx. 180 caracteres).';
    }
  }
  if (isCreate || data.fecha !== undefined) {
    if (!Validators.isNonEmptyString(data.fecha) || Validators.exceedsMaxLength(data.fecha, 40)) {
      errors.fecha = 'La fecha programada es obligatoria.';
    }
  }
  if (isCreate || data.hora !== undefined) {
    if (!Validators.isNonEmptyString(data.hora) || Validators.exceedsMaxLength(data.hora, 40)) {
      errors.hora = 'El horario del evento es obligatorio.';
    }
  }
  if (isCreate || data.lugar !== undefined) {
    if (!Validators.isNonEmptyString(data.lugar) || Validators.exceedsMaxLength(data.lugar, 200)) {
      errors.lugar = 'El lugar o plataforma del taller es obligatorio (máx. 200 caracteres).';
    }
  }
  if (data.costo_bob !== undefined && data.costo_bob !== null && data.costo_bob !== '' && !Validators.isNonNegativeNumber(data.costo_bob)) {
    errors.costo_bob = 'El costo debe ser numérico mayor o igual a 0.';
  }
  if (data.cupos_totales !== undefined && data.cupos_totales !== null && data.cupos_totales !== '' && !Validators.isPositiveInt(data.cupos_totales)) {
    errors.cupos_totales = 'Los cupos totales deben ser un entero positivo.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const router = Router();

// Rutas públicas / de consulta (accesibles para familias, visitantes y tutores)
router.get('/', optionalAuthMiddleware, WorkshopController.getWorkshops);
router.get('/item/:id', optionalAuthMiddleware, WorkshopController.getWorkshopById);
router.get('/stats', optionalAuthMiddleware, WorkshopController.getStats);

// Rutas de administración (exclusivas para Administrador)
router.get('/admin/all', authMiddleware, requireRole(['ADMIN']), WorkshopController.getAllForAdmin);
router.post('/', authMiddleware, requireRole(['ADMIN']), validateBody(validateWorkshopDto({ isCreate: true })), WorkshopController.createWorkshop);
router.put('/:id', authMiddleware, requireRole(['ADMIN']), validateBody(validateWorkshopDto({ isCreate: false })), WorkshopController.updateWorkshop);
router.patch('/:id/toggle', authMiddleware, requireRole(['ADMIN']), WorkshopController.toggleActivo);
router.delete('/:id', authMiddleware, requireRole(['ADMIN']), WorkshopController.deleteWorkshop);

export default router;
