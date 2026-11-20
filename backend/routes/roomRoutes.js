import { Router } from 'express';
import { RoomController } from '../controllers/roomController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';

const router = Router();

// Validador DTO para creación de consultorio
const validateRoomCreate = (body) => {
  const errors = {};
  if (!Validators.isNonEmptyString(body.codigo)) {
    errors.codigo = 'El código del consultorio es obligatorio (ej. CONS-04).';
  }
  if (!Validators.isNonEmptyString(body.nombre)) {
    errors.nombre = 'El nombre o denominación del consultorio es obligatorio.';
  }
  if (body.capacidad !== undefined && (!Validators.isPositiveNumber(body.capacidad) || Number(body.capacidad) > 20)) {
    errors.capacidad = 'La capacidad debe ser un número entero entre 1 y 20.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

// Validador DTO para actualización de consultorio
const validateRoomUpdate = (body) => {
  const errors = {};
  if (body.capacidad !== undefined && (!Validators.isPositiveNumber(body.capacidad) || Number(body.capacidad) > 20)) {
    errors.capacidad = 'La capacidad debe ser un número entero entre 1 y 20.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

router.get('/', RoomController.getAll);
router.get('/status', RoomController.getStatus);
router.get('/services', RoomController.getServices);
router.get('/:id', RoomController.getById);

// Rutas protegidas exclusivamente para Administrador
router.post('/', authMiddleware, requireRole(['ADMIN']), validateBody(validateRoomCreate), RoomController.create);
router.put('/:id', authMiddleware, requireRole(['ADMIN']), validateBody(validateRoomUpdate), RoomController.update);
router.delete('/:id', authMiddleware, requireRole(['ADMIN']), RoomController.delete);

export default router;
