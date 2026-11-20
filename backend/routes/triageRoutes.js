import { Router } from 'express';
import { TriageController } from '../controllers/triageController.js';
import { authMiddleware, optionalAuthMiddleware } from '../middlewares/authMiddleware.js';
import { requireRole } from '../middlewares/rbacMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';

const router = Router();

// Validador DTO para consulta al MindBot IA (Regla 2 de recuerda.md)
const validateTriageInput = (body) => {
  const errors = {};

  if (!Validators.isNonEmptyString(body.message)) {
    errors.message = 'El mensaje no puede estar vacío.';
  } else if (body.message.trim().length > 2000) {
    errors.message = 'El mensaje excede el límite permitido de 2000 caracteres.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      message: body.message ? body.message.trim() : '',
      sessionId: body.sessionId ? String(body.sessionId).trim() : null,
      conversationHistory: Array.isArray(body.conversationHistory) ? body.conversationHistory : []
    }
  };
};

// 1. Endpoint público para interactuar con MindBot IA
// Accesible desde el botón flotante (FAB) en cualquier pantalla
router.post('/chat', optionalAuthMiddleware, validateBody(validateTriageInput), TriageController.handleChat);

// 2. Endpoint protegido para auditoría y visualización del historial de triajes
// Exclusivo para personal clínico y de administración
router.get('/history', authMiddleware, requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), TriageController.getHistory);

// 3. Endpoint de métricas de triajes y crisis
router.get('/metrics', authMiddleware, requireRole(['ADMIN', 'TERAPEUTA', 'RECEPCION']), TriageController.getMetrics);

export default router;

