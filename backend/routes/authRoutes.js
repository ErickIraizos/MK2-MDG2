import { Router } from 'express';
import multer from 'multer';
import { AuthController } from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { validateBody, Validators } from '../middlewares/validationMiddleware.js';
import { createRateLimiter } from '../middlewares/rateLimitMiddleware.js';
import { createSafeFileFilter, verifyUploadedFileMiddleware } from '../utils/fileValidator.js';

const ALLOWED_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: createSafeFileFilter(
    ALLOWED_PHOTO_MIMES,
    null,
    'Formato no permitido. Utilice imágenes en formato JPG, PNG o WEBP.'
  )
});

const router = Router();

// Limitadores anti fuerza bruta sin afectar a usuarios legítimos en la misma red
const loginAccountLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 15,
  keyPrefix: 'auth-login-acct',
  message: 'Demasiados intentos de inicio de sesión para esta cuenta. Por seguridad, espere unos minutos antes de reintentar.',
  keyGenerator: (req, ip) => `${ip}:${req.body?.email || 'anon'}`
});

const loginIpLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 60,
  keyPrefix: 'auth-login-ip',
  message: 'Demasiadas peticiones de inicio de sesión desde esta dirección. Intente nuevamente en unos minutos.'
});

const registerLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'auth-register',
  message: 'Demasiados intentos de registro desde esta dirección. Espere unos minutos.'
});

const changePasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'auth-chg-pwd',
  message: 'Demasiados intentos de cambio de contraseña. Espere unos minutos.'
});

// Validación de DTO para Login (Regla 2 de recuerda.md)
const validateLogin = (body) => {
  const errors = {};
  if (!Validators.isValidEmail(body.email)) {
    errors.email = 'Debe proporcionar un correo electrónico válido.';
  }
  if (!Validators.isNonEmptyString(body.password)) {
    errors.password = 'La contraseña no puede estar vacía.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      email: body.email ? body.email.trim().toLowerCase() : '',
      password: body.password
    }
  };
};

// Validación de DTO para Registro Público
const validateRegister = (body) => {
  const errors = {};
  if (!Validators.isNonEmptyString(body.nombre_completo) || body.nombre_completo.trim().length < 3) {
    errors.nombre_completo = 'Debe ingresar sus nombres y apellidos completos.';
  }
  if (!Validators.isValidEmail(body.email)) {
    errors.email = 'Debe proporcionar un correo electrónico válido.';
  }
  if (!Validators.isNonEmptyString(body.password) || body.password.length < 8) {
    errors.password = 'La contraseña debe tener un mínimo de 8 caracteres.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      nombre_completo: body.nombre_completo ? body.nombre_completo.trim() : '',
      email: body.email ? body.email.trim().toLowerCase() : '',
      password: body.password,
      telefono: body.telefono ? body.telefono.trim() : ''
    }
  };
};

// Validación de DTO para Cambio de Contraseña
const validateChangePassword = (body) => {
  const errors = {};
  if (!Validators.isNonEmptyString(body.currentPassword)) {
    errors.currentPassword = 'Debe ingresar su contraseña actual.';
  }
  if (!Validators.isNonEmptyString(body.newPassword) || body.newPassword.length < 8) {
    errors.newPassword = 'La nueva contraseña debe tener un mínimo de 8 caracteres.';
  }
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

router.post('/login', loginIpLimiter, loginAccountLimiter, validateBody(validateLogin), AuthController.login);
router.post('/register', registerLimiter, validateBody(validateRegister), AuthController.register);
router.get('/me', authMiddleware, AuthController.me);
router.put('/profile', authMiddleware, AuthController.updateProfile);
router.post('/profile/photo', authMiddleware, photoUpload.single('foto'), verifyUploadedFileMiddleware(ALLOWED_PHOTO_MIMES), AuthController.uploadProfilePhoto);
router.post('/change-password', authMiddleware, changePasswordLimiter, validateBody(validateChangePassword), AuthController.changePassword);

export default router;
