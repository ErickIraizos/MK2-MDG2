import { Router } from 'express';
import { GlossaryController } from '../controllers/glossaryController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';

const router = Router();

// Todas las rutas requieren sesión activa
router.use(authMiddleware);

// Rutas de lectura: abiertas a todo usuario del centro (Admin, Terapeuta, Recepción, Tutor)
router.get('/', GlossaryController.getAll);
router.get('/:id', GlossaryController.getById);

// Rutas de escritura y actualización: abiertas a Terapeutas, Admins y Recepción
router.post('/', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), GlossaryController.create);
router.put('/:id', requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), GlossaryController.update);

// Desactivación preventiva (Soft-Delete / Inactivar): disponible para Admin y Terapeuta
router.delete('/:id', requireRole(['ADMIN', 'TERAPEUTA']), GlossaryController.deactivate);
router.post('/:id/deactivate', requireRole(['ADMIN', 'TERAPEUTA']), GlossaryController.deactivate);

// Reactivación a estado activo: RESTRINGIDO EXCLUSIVAMENTE AL ADMINISTRADOR
router.post('/:id/reactivate', requireRole(['ADMIN']), GlossaryController.reactivate);
router.put('/:id/reactivate', requireRole(['ADMIN']), GlossaryController.reactivate);


export default router;
