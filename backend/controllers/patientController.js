import { PatientService } from '../services/patientService.js';

const patientService = new PatientService();

export class PatientController {
  static async checkCi(req, res, next) {
    try {
      const { ci, excludeId } = req.query;
      const result = await patientService.checkCiAvailability(ci, excludeId ? parseInt(excludeId, 10) : null);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAll(req, res, next) {
    try {
      const { search, estado_clinico, activo, archivados, filtrar_por_terapeuta, solo_derivados } = req.query;
      const filters = {
        estado_clinico,
        activo: activo !== undefined ? activo === 'true' : undefined,
        solo_archivados: archivados === 'true',
        filtrar_por_terapeuta_especifico: filtrar_por_terapeuta ? parseInt(filtrar_por_terapeuta, 10) : undefined,
        solo_derivados: solo_derivados === 'true'
      };

      let patients;
      if (search) {
        patients = await patientService.searchPatients(search, filters, req.user);
      } else {
        patients = await patientService.getAllPatients(filters, req.user);
      }

      res.status(200).json({
        success: true,
        data: patients,
        count: patients.length
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const patient = await patientService.getPatientById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: patient
      });
    } catch (err) {
      next(err);
    }
  }

  static async getByCode(req, res, next) {
    try {
      const patient = await patientService.getPatientByCode(req.params.code, req.user);
      res.status(200).json({
        success: true,
        data: patient
      });
    } catch (err) {
      next(err);
    }
  }

  static async getNextCode(req, res, next) {
    try {
      const nextCode = await patientService.getNextCode();
      res.status(200).json({
        success: true,
        data: { nextCode }
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const newPatient = await patientService.createPatient(req.body, req.user, req.ip);
      res.status(201).json({
        success: true,
        message: 'Expediente clínico aperturado exitosamente.',
        data: newPatient
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const updated = await patientService.updatePatient(req.params.id, req.body, req.user, req.ip);
      res.status(200).json({
        success: true,
        message: 'Expediente actualizado exitosamente.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const motivo = req.body?.motivo || req.query?.motivo || 'Baja solicitada';
      const result = await patientService.deletePatient(req.params.id, motivo, req.user, req.ip);
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }

  static async restore(req, res, next) {
    try {
      const result = await patientService.restorePatient(req.params.id, req.user, req.ip);
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (err) {
      next(err);
    }
  }

  static async derivar(req, res, next) {
    try {
      const result = await patientService.derivarPatient(req.params.id, req.body, req.user, req.ip);
      res.status(200).json({
        success: true,
        message: 'Paciente derivado interdisciplinariamente con éxito.',
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDerivations(req, res, next) {
    try {
      const list = await patientService.getDerivations(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: list
      });
    } catch (err) {
      next(err);
    }
  }

  static async linkTutor(req, res, next) {
    try {
      const { tutor_id, parentesco, es_principal } = req.body;
      const patient = await patientService.linkTutor(
        req.params.id,
        tutor_id,
        parentesco,
        es_principal,
        req.user,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Tutor vinculado correctamente al expediente.',
        data: patient
      });
    } catch (err) {
      next(err);
    }
  }

  static async unlinkTutor(req, res, next) {
    try {
      const patient = await patientService.unlinkTutor(
        req.params.id,
        req.params.tutorId,
        req.user,
        req.ip
      );
      res.status(200).json({
        success: true,
        message: 'Tutor desvinculado del expediente.',
        data: patient
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTutorsByPatient(req, res, next) {
    try {
      const patientId = req.params.id;
      const tutors = await patientService.getTutorsByPatientId(patientId, req.user);
      res.status(200).json({
        success: true,
        data: tutors
      });
    } catch (err) {
      next(err);
    }
  }

  // Controladores de Tutores
  static async getAllTutors(req, res, next) {
    try {
      const { search } = req.query;
      let tutors;
      if (search) {
        tutors = await patientService.searchTutors(search);
      } else {
        tutors = await patientService.getAllTutors();
      }
      res.status(200).json({
        success: true,
        data: tutors,
        count: tutors.length
      });
    } catch (err) {
      next(err);
    }
  }

  static async createTutor(req, res, next) {
    try {
      const newTutor = await patientService.createTutor(req.body, req.user?.id, req.ip);
      res.status(201).json({
        success: true,
        message: 'Tutor registrado exitosamente.',
        data: newTutor
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateTutor(req, res, next) {
    try {
      const updated = await patientService.updateTutor(req.params.id, req.body, req.user?.id, req.ip);
      res.status(200).json({
        success: true,
        message: 'Datos de tutor actualizados.',
        data: updated
      });
    } catch (err) {
      next(err);
    }
  }
}
