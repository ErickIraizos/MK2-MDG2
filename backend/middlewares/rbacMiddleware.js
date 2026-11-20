import { AppError } from '../core/AppError.js';

/**
 * Middleware para Control de Acceso Basado en Roles (RBAC)
 * @param {Array<string>} allowedRoles Lista de nombres de roles permitidos ('ADMIN', 'TERAPEUTA', etc.)
 */
export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Usuario no autenticado.'));
    }

    const userRole = req.user.rol;
    
    // Si se pasa un string único, convertir a array
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!rolesArray.includes(userRole)) {
      return next(AppError.forbidden(
        `Acceso restringido. Su rol actual (${userRole}) no posee permisos para ejecutar esta acción.`,
        'FORBIDDEN_ROLE'
      ));
    }

    next();
  };
};
