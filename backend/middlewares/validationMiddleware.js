import { AppError } from '../core/AppError.js';

/**
 * Middleware para validación declarativa de datos de entrada (DTOs)
 * Cumple estrictamente la Regla 2 de recuerda.md
 * @param {Function} validateFn Función sincrónica que recibe (data) y retorna { isValid, errors }
 */
export const validateBody = (validateFn) => {
  return (req, res, next) => {
    try {
      const { isValid, errors, sanitizedData } = validateFn(req.body);
      if (!isValid) {
        return next(AppError.badRequest('Datos del formulario inválidos o incompletos.', 'VALIDATION_ERROR', errors));
      }
      if (sanitizedData) {
        req.body = sanitizedData;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Validadores y sanitizadores utilitarios reutilizables
 */
export const Validators = {
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  },

  isValidPhoneBolivia(phone) {
    if (!phone) return true; // Opcional si no se proporciona
    const cleaned = String(phone).replace(/[\s\-\+]/g, '');
    // Teléfonos en Bolivia suelen tener 8 dígitos (ej. 7XXXXXXX o 4XXXXXXX) con o sin prefijo 591
    return /^(591)?[467]\d{7}$/.test(cleaned);
  },

  isNonEmptyString(val) {
    return typeof val === 'string' && val.trim().length > 0;
  },

  isPositiveNumber(val) {
    const num = Number(val);
    return Number.isFinite(num) && num > 0;
  },

  isNonNegativeNumber(val) {
    const num = Number(val);
    return Number.isFinite(num) && num >= 0;
  },

  isPositiveInt(val) {
    const num = Number(val);
    return Number.isInteger(num) && num > 0;
  },

  isValidIsoDate(val) {
    if (!val || typeof val !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
  },

  exceedsMaxLength(val, maxLen) {
    return typeof val === 'string' && val.trim().length > maxLen;
  }
};
