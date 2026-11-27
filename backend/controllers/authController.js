import { AuthService } from '../services/authService.js';

const authService = new AuthService();

export class AuthController {
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      const result = await authService.login(email, password, ip);

      res.status(200).json({
        success: true,
        message: 'Sesión iniciada correctamente.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async register(req, res, next) {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const result = await authService.register(req.body, ip);

      res.status(201).json({
        success: true,
        message: 'Registro completado exitosamente. Bienvenido a PSI Aprende.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async me(req, res, next) {
    try {
      const user = await authService.getProfile(req.user.id);
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req, res, next) {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'];
      const updatedUser = await authService.updateProfile(req.user.id, req.body, ip);
      res.status(200).json({
        success: true,
        message: 'Perfil actualizado exitosamente.',
        data: updatedUser
      });
    } catch (err) {
      next(err);
    }
  }

  static async uploadProfilePhoto(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No se subió ningún archivo de imagen.' }
        });
      }
      const ip = req.ip || req.headers['x-forwarded-for'];
      const result = await authService.updateProfilePhoto(req.user.id, req.file, ip);
      res.status(200).json({
        success: true,
        message: 'Foto de perfil actualizada exitosamente.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const ip = req.ip || req.headers['x-forwarded-for'];

      const result = await authService.changePassword(req.user.id, currentPassword, newPassword, ip);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }
}
