import { TherapistService } from '../services/therapistService.js';

const therapistService = new TherapistService();

export class TherapistController {
  static async getAll(req, res, next) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const therapists = await therapistService.getAllTherapists(includeInactive);
      res.status(200).json({
        success: true,
        data: therapists,
        count: therapists.length
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const therapist = await therapistService.getTherapistById(req.params.id);
      res.status(200).json({
        success: true,
        data: therapist
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req, res, next) {
    try {
      const therapist = await therapistService.getTherapistByUserId(req.user.id);
      if (!therapist) {
        return res.status(404).json({
          success: false,
          error: { message: 'No se encontró ficha de terapeuta vinculada al usuario autenticado.' }
        });
      }
      res.status(200).json({
        success: true,
        data: therapist
      });
    } catch (err) {
      next(err);
    }
  }

  static async uploadPhoto(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No se subió ningún archivo de imagen.' }
        });
      }

      const fileUrl = `/uploads/therapists/${req.file.filename}`;
      if (req.params.id) {
        // Verificar si es ADMIN o el propio terapeuta
        const existing = await therapistService.getTherapistById(req.params.id);
        if (req.user.rol !== 'ADMIN' && existing.usuario_id !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: { message: 'No tiene permiso para modificar la foto de otro terapeuta.' }
          });
        }
        await therapistService.updateTherapist(req.params.id, { foto_url: fileUrl }, req.user?.id, req.ip);
      }

      res.status(200).json({
        success: true,
        message: 'Foto de perfil subida exitosamente.',
        data: {
          url: fileUrl,
          filename: req.file.filename,
          size: req.file.size
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getSpecialties(req, res, next) {
    try {
      const specialties = await therapistService.getSpecialties();
      res.status(200).json({
        success: true,
        data: specialties
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const newTherapist = await therapistService.createTherapist(req.body, req.user?.id, req.ip);
      res.status(201).json({
        success: true,
        message: 'Especialista registrado exitosamente en el directorio.',
        data: newTherapist
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const existing = await therapistService.getTherapistById(req.params.id);
      if (req.user.rol !== 'ADMIN' && existing.usuario_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: { message: 'No tiene permisos para modificar la información de otro terapeuta.' }
        });
      }

      // Si el usuario es terapeuta pero no admin, restringir campos sensibles
      let dataToUpdate = { ...req.body };
      if (req.user.rol !== 'ADMIN') {
        delete dataToUpdate.activo;
        delete dataToUpdate.porcentaje_honorarios;
        delete dataToUpdate.usuario_id;
        delete dataToUpdate.registro_profesional;
      }

      const updated = await therapistService.updateTherapist(req.params.id, dataToUpdate, req.user?.id, req.ip);
      res.status(200).json({
        success: true,
        message: 'Perfil del especialista actualizado correctamente.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const result = await therapistService.deleteTherapist(req.params.id, req.user?.id, req.ip);
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }
}
