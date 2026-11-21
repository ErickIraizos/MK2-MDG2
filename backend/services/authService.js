import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { AppError } from '../core/AppError.js';
import { RepositoryFactory } from '../core/RepositoryFactory.js';

export class AuthService {
  constructor(
    userRepo = RepositoryFactory.getUserRepository(),
    therapistRepo = RepositoryFactory.getTherapistRepository()
  ) {
    this.userRepo = userRepo;
    this.therapistRepo = therapistRepo;
  }

  async login(email, password, ip = null) {
    if (!email || !password) {
      throw AppError.badRequest('Debe proporcionar correo electrónico y contraseña.');
    }

    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      await this.userRepo.logAudit(null, 'LOGIN_FAILED_NOT_FOUND', 'AUTH', `Intento fallido: ${email}`, ip);
      throw AppError.unauthorized('Credenciales incorrectas. Verifique correo y contraseña.', 'INVALID_CREDENTIALS');
    }

    if (user.activo !== 1) {
      await this.userRepo.logAudit(user.id, 'LOGIN_BLOCKED_INACTIVE', 'AUTH', 'Intento de acceso con cuenta desactivada', ip);
      throw AppError.unauthorized('Esta cuenta se encuentra inactiva. Contacte a la Dirección.', 'ACCOUNT_DISABLED');
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      await this.userRepo.logAudit(user.id, 'LOGIN_FAILED_PASSWORD', 'AUTH', 'Contraseña incorrecta', ip);
      throw AppError.unauthorized('Credenciales incorrectas. Verifique correo y contraseña.', 'INVALID_CREDENTIALS');
    }

    // Actualizar fecha de último acceso
    await this.userRepo.updateLastAccess(user.id);
    await this.userRepo.logAudit(user.id, 'LOGIN_SUCCESS', 'AUTH', `Acceso exitoso con rol ${user.rol_nombre}`, ip);

    // Obtener datos clínicos si es terapeuta
    let terapeutaInfo = null;
    if (user.rol_nombre === 'TERAPEUTA') {
      const therapist = await this.therapistRepo.findByUserId(user.id);
      if (therapist) {
        terapeutaInfo = {
          id: therapist.id,
          registro_profesional: therapist.registro_profesional,
          especialidad: therapist.especialidad_nombre,
          firma_digital_blob: therapist.firma_digital_blob || user.firma_digital_blob || null
        };
      }
    }

    let tutorInfo = null;
    if (user.rol_nombre === 'TUTOR' || user.rol_id === 4) {
      try {
        const tutorRepo = RepositoryFactory.getTutorRepository();
        const tutor = await tutorRepo.findByUserId(user.id) || (user.email ? await tutorRepo.findByEmail(user.email) : null);
        if (tutor) {
          tutorInfo = {
            id: tutor.id,
            ci: tutor.ci,
            parentesco: tutor.parentesco,
            whatsapp: tutor.whatsapp
          };
        }
      } catch (tErr) {}
    }

    // Generar token JWT con vigencia de 8h
    const payload = {
      id: user.id,
      email: user.email,
      rol: user.rol_nombre,
      rol_id: user.rol_id,
      nombre_completo: user.nombre_completo,
      terapeuta_id: terapeutaInfo ? terapeutaInfo.id : null
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });

    return {
      token,
      user: {
        id: user.id,
        nombre_completo: user.nombre_completo,
        email: user.email,
        rol: user.rol_nombre,
        telefono: user.telefono,
        firma_digital_blob: user.firma_digital_blob || terapeutaInfo?.firma_digital_blob || null,
        terapeuta: terapeutaInfo,
        tutor: tutorInfo
      }
    };
  }

  async register(data, ip = null) {
    const {
      nombre_completo,
      email,
      password,
      telefono,
      ci,
      tipo_registro,
      fecha_nacimiento,
      menor_nombre,
      menor_fecha_nacimiento,
      parentesco
    } = data;

    if (!nombre_completo || !email || !password) {
      throw AppError.badRequest('Nombre completo, correo electrónico y contraseña son obligatorios.');
    }

    if (password.length < 8) {
      throw AppError.badRequest('La contraseña debe tener al menos 8 caracteres.');
    }

    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw AppError.conflict('Ya existe una cuenta registrada con este correo electrónico.');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Registro público crea usuario con rol TUTOR / Paciente Titular (rol_id = 4)
    const newUser = await this.userRepo.create({
      nombre_completo: nombre_completo.trim(),
      email: email.trim().toLowerCase(),
      password_hash,
      rol_id: 4,
      telefono: telefono ? telefono.trim() : null,
      activo: 1
    });

    const isAdultPatient = tipo_registro === 'PACIENTE_ADULTO';
    let tutorRecord = null;

    // Sincronización con filiación clínica y repositorio familiar/pacientes
    try {
      const tutorRepo = RepositoryFactory.getTutorRepository();
      const patientRepo = RepositoryFactory.getPatientRepository();

      const parts = nombre_completo.trim().split(/\s+/);
      const tutNombres = parts[0] || '';
      const tutApellidos = parts.slice(1).join(' ') || tutNombres;

      const existingTutor = await tutorRepo.findByEmail(newUser.email);
      if (existingTutor) {
        tutorRecord = await tutorRepo.update(existingTutor.id, {
          usuario_id: newUser.id,
          ci: ci ? ci.trim() : existingTutor.ci,
          whatsapp: telefono ? telefono.trim() : existingTutor.whatsapp,
          parentesco: isAdultPatient ? 'TITULAR_PACIENTE' : (parentesco || existingTutor.parentesco || 'TUTOR_LEGAL'),
          activo: 1
        });
      } else {
        tutorRecord = await tutorRepo.create({
          usuario_id: newUser.id,
          nombres: tutNombres,
          apellidos: tutApellidos,
          ci: ci ? ci.trim() : null,
          email: newUser.email,
          whatsapp: telefono ? telefono.trim() : '+591 70000000',
          parentesco: isAdultPatient ? 'TITULAR_PACIENTE' : (parentesco || 'TUTOR_LEGAL'),
          activo: 1
        });
      }

      // Si es paciente adulto autónomo, registrar su expediente clínico de inmediato
      if (isAdultPatient) {
        const nextCode = await patientRepo.getNextExpedienteCode();
        const adultPatient = await patientRepo.create({
          codigo_expediente: nextCode,
          nombres: tutNombres,
          apellidos: tutApellidos,
          ci: ci ? ci.trim() : '',
          fecha_nacimiento: fecha_nacimiento || '1995-01-01',
          sexo: 'OTRO',
          colegio_ocupacion: 'Adulto Titular',
          estado_clinico: 'ACTIVO',
          creado_por_usuario_id: newUser.id,
          terapeuta_id: null
        });

        if (tutorRecord && adultPatient) {
          await patientRepo.linkTutor(adultPatient.id, tutorRecord.id, 'TITULAR_PACIENTE', 1);
        }
      } else if (menor_nombre && menor_nombre.trim()) {
        // Si es tutor y proporcionó los datos iniciales de su hijo/a menor
        const childParts = menor_nombre.trim().split(/\s+/);
        const childNombres = childParts[0] || '';
        const childApellidos = childParts.slice(1).join(' ') || tutApellidos;
        const nextCode = await patientRepo.getNextExpedienteCode();

        const childPatient = await patientRepo.create({
          codigo_expediente: nextCode,
          nombres: childNombres,
          apellidos: childApellidos,
          ci: '',
          fecha_nacimiento: menor_fecha_nacimiento || '2016-01-01',
          sexo: 'OTRO',
          colegio_ocupacion: 'Escolar / Menor tutelado',
          estado_clinico: 'ACTIVO',
          creado_por_usuario_id: newUser.id,
          terapeuta_id: null
        });

        if (tutorRecord && childPatient) {
          await patientRepo.linkTutor(childPatient.id, tutorRecord.id, parentesco || 'TUTOR_LEGAL', 1);
        }
      }
    } catch (tutorSyncErr) {
      console.warn('[AuthService] Error al sincronizar filiación clínica en registro:', tutorSyncErr);
    }

    await this.userRepo.logAudit(
      newUser.id, 
      'USER_REGISTERED_PUBLIC', 
      'AUTH', 
      `Auto-registro (${isAdultPatient ? 'Paciente Adulto' : 'Tutor Familiar'}): ${newUser.email}`, 
      ip
    );

    const payload = {
      id: newUser.id,
      email: newUser.email,
      rol: newUser.rol_nombre,
      rol_id: newUser.rol_id,
      nombre_completo: newUser.nombre_completo
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });

    return {
      token,
      user: {
        id: newUser.id,
        nombre_completo: newUser.nombre_completo,
        email: newUser.email,
        rol: newUser.rol_nombre,
        telefono: newUser.telefono
      }
    };
  }

  async changePassword(userId, currentPassword, newPassword, ip = null) {
    if (!currentPassword || !newPassword) {
      throw AppError.badRequest('Debe proporcionar la contraseña actual y la nueva.');
    }

    if (newPassword.length < 8) {
      throw AppError.badRequest('La nueva contraseña debe tener al menos 8 caracteres.');
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound('Usuario no encontrado.');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      throw AppError.badRequest('La contraseña actual es incorrecta.');
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await this.userRepo.updatePassword(userId, newHash);
    await this.userRepo.logAudit(userId, 'PASSWORD_CHANGED', 'AUTH', 'Contraseña modificada exitosamente', ip);

    return { message: 'Contraseña actualizada exitosamente.' };
  }

  async getProfile(userId) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound('Usuario no encontrado.');
    }

    const result = {
      id: user.id,
      nombre_completo: user.nombre_completo,
      email: user.email,
      rol: user.rol_nombre,
      rol_id: user.rol_id,
      telefono: user.telefono,
      firma_digital_blob: user.firma_digital_blob || null,
      firma_actualizada_at: user.firma_actualizada_at || null,
      ultimo_acceso: user.ultimo_acceso,
      created_at: user.created_at
    };

    if (user.rol_nombre === 'TERAPEUTA') {
      try {
        const therapist = await this.therapistRepo.findByUserId(userId);
        if (therapist) {
          result.terapeuta = {
            id: therapist.id,
            registro_profesional: therapist.registro_profesional,
            especialidad: therapist.especialidad_nombre,
            firma_digital_blob: therapist.firma_digital_blob || user.firma_digital_blob || null,
            firma_actualizada_at: therapist.firma_actualizada_at || user.firma_actualizada_at || null
          };
          if (!result.firma_digital_blob && therapist.firma_digital_blob) {
            result.firma_digital_blob = therapist.firma_digital_blob;
          }
        }
      } catch (thErr) {
        console.warn('[AuthService] Error al obtener datos de terapeuta para perfil:', thErr);
      }
    }

    if (user.rol_nombre === 'TUTOR' || user.rol_id === 4) {
      try {
        const tutorRepo = RepositoryFactory.getTutorRepository();
        const tutor = await tutorRepo.findByUserId(userId) || (user.email ? await tutorRepo.findByEmail(user.email) : null);
        if (tutor) {
          result.tutor = {
            id: tutor.id,
            ci: tutor.ci,
            whatsapp: tutor.whatsapp,
            parentesco: tutor.parentesco,
            direccion: tutor.direccion,
            telefono_emergencia: tutor.telefono_emergencia
          };
        }
      } catch (tutorErr) {
        console.warn('[AuthService] Error al obtener datos de tutor para perfil:', tutorErr);
      }
    }

    return result;
  }

  async updateProfile(userId, data, ip = null) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound('Usuario no encontrado.');
    }

    if (data.telefono !== undefined) {
      const cleanPhone = data.telefono ? String(data.telefono).trim() : null;
      await this.userRepo.update(userId, {
        telefono: cleanPhone
      });

      // Si el usuario es terapeuta o personal clínico, sincronizar con su perfil de terapeuta y WhatsApp
      try {
        const therapistRepo = RepositoryFactory.getTherapistRepository();
        const allTherapists = await therapistRepo.findAll(true);
        const therapist = allTherapists.find(t => t.usuario_id === userId);
        if (therapist) {
          await therapistRepo.update(therapist.id, {
            telefono: cleanPhone
          });

          // Actualizar teléfono en tabla whatsapp_sesiones
          const waRepo = RepositoryFactory.getWhatsappRepository();
          await waRepo.syncLinkedPhone(therapist.id, cleanPhone);
        }
      } catch (thErr) {
        console.warn('[AuthService] Nota al sincronizar teléfono en terapeuta:', thErr.message);
      }
    }

    if (data.firma_digital_blob !== undefined) {
      const sigBlob = data.firma_digital_blob ? String(data.firma_digital_blob).trim() : null;
      const nowIso = new Date().toISOString();

      await this.userRepo.update(userId, {
        firma_digital_blob: sigBlob,
        firma_actualizada_at: nowIso
      });

      // Sincronizar con el perfil clínico del terapeuta si corresponde
      try {
        const therapistRepo = RepositoryFactory.getTherapistRepository();
        const allTherapists = await therapistRepo.findAll(true);
        const therapist = allTherapists.find(t => t.usuario_id === userId);
        if (therapist) {
          await therapistRepo.update(therapist.id, {
            firma_digital_blob: sigBlob,
            firma_actualizada_at: nowIso
          });
        }
      } catch (sigErr) {
        console.warn('[AuthService] Nota al sincronizar firma digital en terapeuta:', sigErr.message);
      }

      await this.userRepo.logAudit(
        user.id,
        'DIGITAL_SIGNATURE_UPDATED',
        'PERFIL',
        sigBlob ? 'Firma manuscrita digital colegiada registrada/actualizada' : 'Firma manuscrita digital eliminada',
        ip
      );
    }

    if (user.rol_nombre === 'TUTOR' || user.rol_id === 4) {
      const tutorRepo = RepositoryFactory.getTutorRepository();
      let tutor = await tutorRepo.findByUserId(userId);
      if (!tutor && user.email) {
        tutor = await tutorRepo.findByEmail(user.email);
      }

      const tutorUpdateData = {};
      if (data.ci !== undefined) {
        tutorUpdateData.ci = data.ci ? String(data.ci).trim() : null;
      }
      if (data.telefono !== undefined || data.whatsapp !== undefined) {
        const phone = data.whatsapp !== undefined ? data.whatsapp : data.telefono;
        tutorUpdateData.whatsapp = phone ? String(phone).trim() : null;
      }
      if (data.parentesco !== undefined) {
        tutorUpdateData.parentesco = data.parentesco;
      }
      if (data.direccion !== undefined) {
        tutorUpdateData.direccion = data.direccion ? String(data.direccion).trim() : null;
      }

      if (tutor) {
        await tutorRepo.update(tutor.id, tutorUpdateData);
      } else {
        const parts = (user.nombre_completo || 'Tutor').trim().split(/\s+/);
        await tutorRepo.create({
          usuario_id: user.id,
          nombres: parts[0] || 'Tutor',
          apellidos: parts.slice(1).join(' ') || 'Familiar',
          email: user.email,
          whatsapp: tutorUpdateData.whatsapp || user.telefono || '+591 70000000',
          ci: tutorUpdateData.ci || null,
          parentesco: tutorUpdateData.parentesco || 'TUTOR_LEGAL',
          activo: 1
        });
      }

      await this.userRepo.logAudit(
        user.id,
        'TUTOR_PROFILE_UPDATED',
        'TUTORES',
        `Actualización de perfil de tutor (C.I.: ${tutorUpdateData.ci || 'N/A'})`,
        ip
      );
    }

    return this.getProfile(userId);
  }
}
