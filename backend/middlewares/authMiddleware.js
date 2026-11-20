import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { AppError } from '../core/AppError.js';
import { RepositoryFactory } from '../core/RepositoryFactory.js';

export const authMiddleware = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      throw AppError.unauthorized('No se proporcionó un token de autorización.');
    }
    let decoded;

    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw AppError.unauthorized('La sesión ha expirado. Por favor ingrese nuevamente.', 'TOKEN_EXPIRED');
      }
      throw AppError.unauthorized('Token de sesión inválido.', 'INVALID_TOKEN');
    }

    // Verificar existencia y estado del usuario en persistencia
    const userRepo = RepositoryFactory.getUserRepository();
    const user = await userRepo.findById(decoded.id);

    if (!user || user.activo !== 1) {
      throw AppError.unauthorized('El usuario asociado a esta sesión no existe o ha sido desactivado.', 'USER_INACTIVE');
    }

    // Adjuntar usuario autenticado a la petición
    req.user = {
      id: user.id,
      nombre_completo: user.nombre_completo,
      email: user.email,
      rol: user.rol_nombre,
      rol_id: user.rol_id
    };

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware de autenticación opcional:
 * Si se envía un token válido, adjunta req.user; de lo contrario, deja req.user = null y permite continuar.
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (e) {
      req.user = null;
      return next();
    }

    const userRepo = RepositoryFactory.getUserRepository();
    const user = await userRepo.findById(decoded.id);
    if (user && user.activo === 1) {
      req.user = {
        id: user.id,
        nombre_completo: user.nombre_completo,
        email: user.email,
        rol: user.rol_nombre,
        rol_id: user.rol_id
      };
    } else {
      req.user = null;
    }
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};
