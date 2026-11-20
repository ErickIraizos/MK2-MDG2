import bcrypt from 'bcryptjs';
import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { AppError } from '../core/AppError.js';

const userRepo = RepositoryFactory.getUserRepository();

export class UserController {
  static async getAll(req, res, next) {
    try {
      const users = await userRepo.findAll();
      res.status(200).json({
        success: true,
        data: users
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const { nombre_completo, email, password, rol_id, telefono, activo } = req.body;
      const ip = req.ip || req.headers['x-forwarded-for'];

      if (!nombre_completo || !email || !password || !rol_id) {
        throw AppError.badRequest('Nombre completo, email, contraseña y rol son obligatorios.');
      }

      if (password.length < 8) {
        throw AppError.badRequest('La contraseña debe tener al menos 8 caracteres.');
      }

      const existing = await userRepo.findByEmail(email);
      if (existing) {
        throw AppError.conflict('Ya existe un usuario con este correo electrónico.');
      }

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);

      const newUser = await userRepo.create({
        nombre_completo: nombre_completo.trim(),
        email: email.trim().toLowerCase(),
        password_hash,
        rol_id: Number(rol_id),
        telefono: telefono ? telefono.trim() : null,
        activo: activo !== undefined ? (activo ? 1 : 0) : 1
      });

      await userRepo.logAudit(req.user.id, 'USER_CREATED_BY_ADMIN', 'USUARIOS', `Creación de usuario: ${newUser.email} con rol ${newUser.rol_nombre}`, ip);

      res.status(201).json({
        success: true,
        message: `Usuario ${newUser.nombre_completo} creado exitosamente con rol ${newUser.rol_nombre}.`,
        data: newUser
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateRole(req, res, next) {
    try {
      const userId = Number(req.params.id);
      const { rol_id } = req.body;
      const ip = req.ip || req.headers['x-forwarded-for'];

      if (!rol_id || ![1, 2, 3, 4].includes(Number(rol_id))) {
        throw AppError.badRequest('Debe seleccionar un rol válido (ADMIN, TERAPEUTA, RECEPCION, TUTOR).');
      }

      const user = await userRepo.findById(userId);
      if (!user) {
        throw AppError.notFound('El usuario especificado no existe.');
      }

      // Evitar que el director se quite a sí mismo el rol de ADMIN
      if (req.user.id === userId && Number(rol_id) !== 1) {
        throw AppError.badRequest('No puede quitarse a sí mismo el rol de Administrador.');
      }

      const updated = await userRepo.updateRole(userId, Number(rol_id));
      await userRepo.logAudit(req.user.id, 'USER_ROLE_CHANGED', 'USUARIOS', `Rol de ${user.email} cambiado de ${user.rol_nombre} a ${updated.rol_nombre}`, ip);

      res.status(200).json({
        success: true,
        message: `Rol de ${updated.nombre_completo} actualizado a ${updated.rol_nombre}.`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const userId = Number(req.params.id);
      const { activo } = req.body;
      const ip = req.ip || req.headers['x-forwarded-for'];

      if (req.user.id === userId && !activo) {
        throw AppError.badRequest('No puede desactivar su propia cuenta de Administrador.');
      }

      const user = await userRepo.findById(userId);
      if (!user) {
        throw AppError.notFound('El usuario especificado no existe.');
      }

      const updated = await userRepo.updateStatus(userId, Boolean(activo));
      await userRepo.logAudit(req.user.id, 'USER_STATUS_CHANGED', 'USUARIOS', `Estado de ${user.email} cambiado a ${activo ? 'ACTIVO' : 'INACTIVO'}`, ip);

      res.status(200).json({
        success: true,
        message: `Estado del usuario ${updated.nombre_completo} actualizado correctamente.`,
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const userId = Number(req.params.id);
      const { motivo } = req.body || {};
      const ip = req.ip || req.headers['x-forwarded-for'];

      if (req.user.id === userId) {
        throw AppError.badRequest('No puede desvincular su propia cuenta de usuario en sesión.');
      }

      const user = await userRepo.findById(userId);
      if (!user) {
        throw AppError.notFound('El usuario especificado no existe.');
      }

      await userRepo.delete(userId, motivo || 'Desvinculación administrativa del centro', req.user.id);
      await userRepo.logAudit(
        req.user.id, 
        'USER_DEACTIVATED', 
        'USUARIOS', 
        `Desvinculación / Baja lógica de usuario: ${user.email} (${user.nombre_completo}). Motivo: ${motivo || 'Baja administrativa'}`, 
        ip
      );

      res.status(200).json({
        success: true,
        message: `Usuario ${user.nombre_completo} desvinculado del sistema. Su histórico permanece intacto.`
      });
    } catch (err) {
      next(err);
    }
  }

  static async restore(req, res, next) {
    try {
      const userId = Number(req.params.id);
      const ip = req.ip || req.headers['x-forwarded-for'];

      const user = await userRepo.findById(userId);
      if (!user) {
        throw AppError.notFound('El usuario especificado no existe.');
      }

      await userRepo.restore(userId);
      await userRepo.logAudit(
        req.user.id,
        'USER_RESTORED',
        'USUARIOS',
        `Reactivación de cuenta de usuario: ${user.email} (${user.nombre_completo})`,
        ip
      );

      res.status(200).json({
        success: true,
        message: `Cuenta de ${user.nombre_completo} reactivada exitosamente.`
      });
    } catch (err) {
      next(err);
    }
  }

  static async getInactive(req, res, next) {
    try {
      const inactives = await userRepo.getInactiveUsers();
      res.status(200).json({
        success: true,
        data: inactives,
        count: inactives.length
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAuditLogs(req, res, next) {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const logs = await userRepo.getAuditLogs(limit);
      res.status(200).json({
        success: true,
        data: logs
      });
    } catch (err) {
      next(err);
    }
  }
}
