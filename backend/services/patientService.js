import { AppError } from '../core/AppError.js';
import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { assertPatientAccess } from '../core/accessControl.js';

export class PatientService {
  constructor(
    patientRepo = RepositoryFactory.getPatientRepository(),
    tutorRepo = RepositoryFactory.getTutorRepository(),
    userRepo = RepositoryFactory.getUserRepository()
  ) {
    this.patientRepo = patientRepo;
    this.tutorRepo = tutorRepo;
    this.userRepo = userRepo;
  }

  /**
   * Calcula con exactitud la edad cronológica en años y meses
   * Impide fechas futuras según las especificaciones clínicas
   */
  calculateChronologicalAge(birthDateString) {
    if (!birthDateString) return null;
    const birth = new Date(birthDateString);
    const today = new Date();

    if (isNaN(birth.getTime())) {
      throw AppError.badRequest('La fecha de nacimiento no es válida.');
    }

    if (birth > today) {
      throw AppError.badRequest('La fecha de nacimiento no puede ser futura.');
    }

    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();

    if (days < 0) {
      months--;
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    // Clasificación etaria institucional
    let grupoEtario = 'INFANTIL';
    if (years >= 12 && years < 18) grupoEtario = 'ADOLESCENTE';
    else if (years >= 18 && years < 60) grupoEtario = 'ADULTO';
    else if (years >= 60) grupoEtario = 'ADULTO_MAYOR';

    return {
      years,
      months,
      grupoEtario,
      formatted: years === 0 ? `${months} meses` : `${years} años, ${months} meses`
    };
  }

  async checkCiAvailability(ci, excludeId = null) {
    if (!ci || ci.trim() === '') {
      return { exists: false, message: 'C.I. vacío' };
    }
    const patient = await this.patientRepo.checkCiExists(ci.trim(), excludeId);
    if (patient) {
      return {
        exists: true,
        patient: {
          id: patient.id,
          codigo_expediente: patient.codigo_expediente,
          nombres: patient.nombres,
          apellidos: patient.apellidos,
          ci: patient.ci,
          activo: patient.activo,
          terapeuta_nombre: patient.terapeuta_nombre
        }
      };
    }
    return { exists: false };
  }

  async getAllPatients(filters = {}, user = null) {
    const finalFilters = { ...filters };

    // Regla de Confidencialidad y Secreto Profesional (RBAC Clínico)
    let userTherapistId = null;
    if (user && user.rol === 'TERAPEUTA') {
      const therapist = await this.patientRepo.getTherapistByUserId(user.id);
      userTherapistId = therapist ? therapist.id : -1;
      finalFilters.terapeuta_id = userTherapistId;
      finalFilters.usuario_id = user.id;
      finalFilters.solo_archivados = false; // Terapeutas jamás ven archivados
    } else if (user && user.rol === 'TUTOR') {
      // Un tutor solo puede acceder y consultar a sus propios hijos/pupilos tutelados
      let tutor = await this.tutorRepo.findByUserId(user.id);
      if (!tutor && user.email) {
        tutor = await this.tutorRepo.findByEmail(user.email);
      }
      if (!tutor) return [];
      const patients = (tutor.pacientes && tutor.pacientes.length > 0)
        ? tutor.pacientes
        : await this.tutorRepo.getPatientsByTutorId(tutor.id);
      if (!patients || patients.length === 0) return [];
      finalFilters.ids = patients.map(p => p.id);
    }

    const patients = await this.patientRepo.findAll(finalFilters);
    return patients.map(p => {
      const esTitular = user?.rol === 'ADMIN' ? true : (user?.rol === 'TERAPEUTA' ? p.terapeuta_id === userTherapistId : false);
      return {
        ...p,
        edad_cronologica: this.calculateChronologicalAge(p.fecha_nacimiento),
        puede_editar: esTitular,
        es_titular_actual: esTitular
      };
    });
  }

  async searchPatients(queryText, filters = {}, user = null) {
    if (!queryText || queryText.trim().length === 0) {
      return this.getAllPatients(filters, user);
    }

    const finalFilters = { ...filters };
    let userTherapistId = null;
    if (user && user.rol === 'TERAPEUTA') {
      const therapist = await this.patientRepo.getTherapistByUserId(user.id);
      userTherapistId = therapist ? therapist.id : -1;
      finalFilters.terapeuta_id = userTherapistId;
      finalFilters.usuario_id = user.id;
      finalFilters.solo_archivados = false;
    } else if (user && user.rol === 'TUTOR') {
      let tutor = await this.tutorRepo.findByUserId(user.id);
      if (!tutor && user.email) {
        tutor = await this.tutorRepo.findByEmail(user.email);
      }
      if (!tutor) return [];
      const patients = (tutor.pacientes && tutor.pacientes.length > 0)
        ? tutor.pacientes
        : await this.tutorRepo.getPatientsByTutorId(tutor.id);
      if (!patients || patients.length === 0) return [];
      finalFilters.ids = patients.map(p => p.id);
    }

    const patients = await this.patientRepo.search(queryText, finalFilters);
    return patients.map(p => {
      const esTitular = user?.rol === 'ADMIN' ? true : (user?.rol === 'TERAPEUTA' ? p.terapeuta_id === userTherapistId : false);
      return {
        ...p,
        edad_cronologica: this.calculateChronologicalAge(p.fecha_nacimiento),
        puede_editar: esTitular,
        es_titular_actual: esTitular
      };
    });
  }

  async getPatientById(id, user = null) {
    const patient = await this.patientRepo.findById(id);
    if (!patient) {
      throw AppError.notFound(`No se encontró el paciente con ID ${id}`);
    }

    // Validación de confidencialidad médica para terapeutas
    if (user && user.rol === 'TERAPEUTA') {
      const therapist = await this.patientRepo.getTherapistByUserId(user.id);
      const therapistId = therapist ? therapist.id : -1;

      const esAsignado = patient.terapeuta_id === therapistId;
      const esCreador = patient.creado_por_usuario_id === user.id;
      const tieneDerivacion = (patient.derivaciones || []).some(
        d => (d.terapeuta_destino_id === therapistId || d.terapeuta_origen_id === therapistId) && d.estado === 'ACTIVA'
      );

      if (!esAsignado && !esCreador && !tieneDerivacion) {
        throw AppError.forbidden('Acceso confidencial restringido: Este expediente no se encuentra asignado ni derivado a su consulta.');
      }

      patient.es_titular_actual = esAsignado;
      patient.puede_editar = esAsignado;
    } else if (user && user.rol === 'ADMIN') {
      patient.es_titular_actual = true;
      patient.puede_editar = true;
    } else {
      patient.es_titular_actual = false;
      patient.puede_editar = false;
    }

    patient.edad_cronologica = this.calculateChronologicalAge(patient.fecha_nacimiento);
    return patient;
  }

  async getPatientByCode(code, user = null) {
    const patient = await this.patientRepo.findByCode(code);
    if (!patient) {
      throw AppError.notFound(`No se encontró el expediente [${code}]`);
    }

    if (user && user.rol === 'TERAPEUTA') {
      const therapist = await this.patientRepo.getTherapistByUserId(user.id);
      const therapistId = therapist ? therapist.id : -1;

      const esAsignado = patient.terapeuta_id === therapistId;
      const esCreador = patient.creado_por_usuario_id === user.id;
      const tieneDerivacion = (patient.derivaciones || []).some(
        d => (d.terapeuta_destino_id === therapistId || d.terapeuta_origen_id === therapistId) && d.estado === 'ACTIVA'
      );

      if (!esAsignado && !esCreador && !tieneDerivacion) {
        throw AppError.forbidden('Acceso confidencial restringido: Este expediente no se encuentra asignado ni derivado a su consulta.');
      }
    }

    patient.edad_cronologica = this.calculateChronologicalAge(patient.fecha_nacimiento);
    return patient;
  }

  async getNextCode() {
    return this.patientRepo.getNextCorrelativeCode();
  }

  async createPatient(data, user = null, ip = null) {
    // 1. C.I. estrictamente obligatorio (acordado con el usuario)
    if (!data.ci || data.ci.trim() === '') {
      throw AppError.badRequest('La Cédula de Identidad (C.I.) es obligatoria para el expediente del paciente.');
    }

    // 2. Validación de unicidad de C.I. (Anti-Duplicidad)
    const existingCi = await this.patientRepo.checkCiExists(data.ci.trim());
    if (existingCi) {
      if (existingCi.activo === 1) {
        throw AppError.conflict(
          `El C.I. [${data.ci}] ya pertenece al expediente ${existingCi.codigo_expediente} (${existingCi.nombres} ${existingCi.apellidos}). No se admiten expedientes duplicados.`
        );
      } else {
        throw AppError.conflict(
          `El C.I. [${data.ci}] pertenece al expediente archivado ${existingCi.codigo_expediente} (${existingCi.nombres} ${existingCi.apellidos}). Puede restaurarlo desde la papelera en lugar de crear un duplicado.`
        );
      }
    }

    // 3. Validar fecha de nacimiento
    this.calculateChronologicalAge(data.fecha_nacimiento);

    // 4. Autogenerar código si no se proporciona
    if (!data.codigo_expediente || data.codigo_expediente.trim() === '') {
      data.codigo_expediente = await this.patientRepo.getNextCorrelativeCode();
    } else {
      const exists = await this.patientRepo.findByCode(data.codigo_expediente);
      if (exists) {
        throw AppError.conflict(`El código de expediente [${data.codigo_expediente}] ya se encuentra registrado.`);
      }
    }

    // 5. Asignar creador del expediente
    data.creado_por_usuario_id = user ? user.id : null;

    // 6. Asignar terapeuta responsable inicial
    if (user && user.rol === 'TERAPEUTA') {
      const therapist = await this.patientRepo.getTherapistByUserId(user.id);
      if (therapist) {
        data.terapeuta_id = therapist.id;
      }
    }

    // 7. Crear paciente
    const newPatient = await this.patientRepo.create(data);

    // 8. Auditoría inalterable
    await this.userRepo.logAudit(
      user ? user.id : null,
      'PATIENT_CREATED',
      'PACIENTES',
      `Apertura de expediente ${newPatient.codigo_expediente}: ${newPatient.nombres} ${newPatient.apellidos} (CI: ${newPatient.ci})`,
      ip
    );

    newPatient.edad_cronologica = this.calculateChronologicalAge(newPatient.fecha_nacimiento);
    return newPatient;
  }

  async updatePatient(id, data, user = null, ip = null) {
    const existing = await this.getPatientById(id, user);

    // Si el usuario es terapeuta, solo puede editar si ES EL TITULAR ASIGNADO ACTUAL
    if (user && user.rol === 'TERAPEUTA') {
      const therapist = await this.patientRepo.getTherapistByUserId(user.id);
      if (!therapist || existing.terapeuta_id !== therapist.id) {
        throw AppError.forbidden(
          'Acceso restringido: Este expediente fue derivado o transferido a otro especialista. No tiene permisos para modificar sus datos.'
        );
      }
      // Un terapeuta no puede cambiar el terapeuta_id asignado mediante un PUT estándar
      delete data.terapeuta_id;
    }

    if (data.ci && data.ci.trim() !== '') {
      const duplicateCi = await this.patientRepo.checkCiExists(data.ci.trim(), id);
      if (duplicateCi) {
        throw AppError.conflict(
          `El C.I. [${data.ci}] ya pertenece al expediente ${duplicateCi.codigo_expediente} (${duplicateCi.nombres} ${duplicateCi.apellidos}).`
        );
      }
    }

    if (data.fecha_nacimiento) {
      this.calculateChronologicalAge(data.fecha_nacimiento);
    }

    const updated = await this.patientRepo.update(id, data);

    await this.userRepo.logAudit(
      user ? user.id : null,
      'PATIENT_UPDATED',
      'PACIENTES',
      `Modificación de datos de expediente ${existing.codigo_expediente}`,
      ip
    );

    updated.edad_cronologica = this.calculateChronologicalAge(updated.fecha_nacimiento);
    return updated;
  }

  async deletePatient(id, motivoBaja = 'Baja solicitada', user = null, ip = null) {
    const existing = await this.getPatientById(id);
    await this.patientRepo.deleteLogical(id, user ? user.id : null, motivoBaja);

    await this.userRepo.logAudit(
      user ? user.id : null,
      'PATIENT_ARCHIVED',
      'PACIENTES',
      `Baja lógica / Archivado de expediente ${existing.codigo_expediente} por: ${motivoBaja}`,
      ip
    );

    return { 
      message: `Expediente ${existing.codigo_expediente} archivado correctamente. Su histórico permanece en la base de datos.` 
    };
  }

  async restorePatient(id, user = null, ip = null) {
    if (user && user.rol !== 'ADMIN') {
      throw AppError.forbidden('Solo la Dirección General (Admin) puede restaurar expedientes archivados.');
    }

    const existing = await this.patientRepo.findById(id);
    if (!existing) {
      throw AppError.notFound(`No se encontró el paciente con ID ${id}`);
    }

    await this.patientRepo.restore(id);

    await this.userRepo.logAudit(
      user ? user.id : null,
      'PATIENT_RESTORED',
      'PACIENTES',
      `Restauración de expediente archivado ${existing.codigo_expediente}`,
      ip
    );

    return {
      message: `Expediente ${existing.codigo_expediente} restaurado exitosamente al flujo activo.`
    };
  }

  async derivarPatient(id, derivationData, user = null, ip = null) {
    const patient = await this.patientRepo.findById(id);
    if (!patient) {
      throw AppError.notFound(`No se encontró el paciente con ID ${id}`);
    }

    if (!derivationData.terapeuta_destino_id) {
      throw AppError.badRequest('Debe seleccionar el terapeuta especialista de destino.');
    }

    if (!derivationData.motivo || derivationData.motivo.trim() === '') {
      throw AppError.badRequest('Debe especificar el motivo clínico de la derivación.');
    }

    let terapeutaOrigenId = derivationData.terapeuta_origen_id || null;
    if (user && user.rol === 'TERAPEUTA') {
      const originTherapist = await this.patientRepo.getTherapistByUserId(user.id);
      if (originTherapist) {
        terapeutaOrigenId = originTherapist.id;
      }
    } else if (!terapeutaOrigenId) {
      terapeutaOrigenId = patient.terapeuta_id;
    }

    if (terapeutaOrigenId && parseInt(terapeutaOrigenId, 10) === parseInt(derivationData.terapeuta_destino_id, 10)) {
      throw AppError.badRequest('No puede derivar un paciente al mismo terapeuta que actualmente lo atiende.');
    }

    await this.patientRepo.createDerivation({
      paciente_id: id,
      terapeuta_origen_id: terapeutaOrigenId,
      terapeuta_destino_id: derivationData.terapeuta_destino_id,
      usuario_responsable_id: user ? user.id : null,
      motivo: derivationData.motivo.trim(),
      notas: derivationData.notas ? derivationData.notas.trim() : null,
      estado: 'ACTIVA'
    });

    // Si se especifica reasignación como terapeuta principal
    if (derivationData.reasignar_principal) {
      await this.patientRepo.update(id, {
        terapeuta_id: derivationData.terapeuta_destino_id
      });
    }

    await this.userRepo.logAudit(
      user ? user.id : null,
      'PATIENT_DERIVED',
      'PACIENTES',
      `Derivación interdisciplinaria de expediente ${patient.codigo_expediente} a terapeuta ID ${derivationData.terapeuta_destino_id}. Motivo: ${derivationData.motivo}`,
      ip
    );

    return this.getPatientById(id);
  }

  async getDerivations(patientId, currentUser = null) {
    if (currentUser) {
      await assertPatientAccess(patientId, currentUser, {
        allowReception: true,
        allowTutor: false,
        actionDescription: 'consultar derivaciones de este paciente'
      });
    }
    await this.patientRepo.findById(patientId);
    return this.patientRepo.getDerivationsByPatientId(patientId);
  }

  async getTutorsByPatientId(patientId, currentUser = null) {
    if (currentUser) {
      await assertPatientAccess(patientId, currentUser, {
        allowReception: true,
        allowTutor: true,
        actionDescription: 'consultar tutores vinculados a este paciente'
      });
    }
    await this.patientRepo.findById(patientId);
    return this.patientRepo.getTutorsByPatientId(patientId);
  }

  async linkTutor(patientId, tutorId, parentesco = 'TUTOR', esPrincipal = true, userOrId = null, ip = null) {
    const currentUser = userOrId && typeof userOrId === 'object' ? userOrId : null;
    const userId = currentUser ? currentUser.id : userOrId;
    if (currentUser) {
      await assertPatientAccess(patientId, currentUser, {
        allowReception: true,
        allowTutor: false,
        actionDescription: 'vincular tutores a este expediente'
      });
    }
    await this.getPatientById(patientId, currentUser);
    const tutor = await this.tutorRepo.findById(tutorId);
    if (!tutor) {
      throw AppError.notFound(`El tutor con ID ${tutorId} no existe.`);
    }

    await this.patientRepo.linkTutor(patientId, tutorId, parentesco, esPrincipal ? 1 : 0);

    await this.userRepo.logAudit(
      userId,
      'TUTOR_LINKED',
      'PACIENTES',
      `Vinculación de tutor ${tutor.nombres} ${tutor.apellidos} con paciente ID ${patientId}`,
      ip
    );

    return this.getPatientById(patientId, currentUser);
  }

  async unlinkTutor(patientId, tutorId, userOrId = null, ip = null) {
    const currentUser = userOrId && typeof userOrId === 'object' ? userOrId : null;
    const userId = currentUser ? currentUser.id : userOrId;
    if (currentUser) {
      await assertPatientAccess(patientId, currentUser, {
        allowReception: false,
        allowTutor: false,
        actionDescription: 'desvincular tutores de este expediente'
      });
    }
    await this.patientRepo.unlinkTutor(patientId, tutorId);
    await this.userRepo.logAudit(
      userId,
      'TUTOR_UNLINKED',
      'PACIENTES',
      `Desvinculación de tutor ID ${tutorId} de paciente ID ${patientId}`,
      ip
    );
    return this.getPatientById(patientId, currentUser);
  }

  // GESTIÓN DE TUTORES
  async getAllTutors(includeInactive = false) {
    return this.tutorRepo.findAll(includeInactive);
  }

  async searchTutors(queryText) {
    if (!queryText || queryText.trim().length === 0) {
      return this.tutorRepo.findAll(false);
    }
    return this.tutorRepo.search(queryText);
  }

  async getTutorById(id) {
    const tutor = await this.tutorRepo.findById(id);
    if (!tutor) {
      throw AppError.notFound(`No se encontró el tutor con ID ${id}`);
    }
    return tutor;
  }

  async createTutor(data, userId = null, ip = null) {
    if (data.email && !data.usuario_id) {
      try {
        const existingUser = await this.userRepo.findByEmail(data.email.trim().toLowerCase());
        if (existingUser) {
          data.usuario_id = existingUser.id;
        }
      } catch (err) {
        // Ignorar si no se puede buscar usuario
      }
    }
    const newTutor = await this.tutorRepo.create(data);
    await this.userRepo.logAudit(
      userId,
      'TUTOR_CREATED',
      'TUTORES',
      `Registro de tutor: ${newTutor.nombres} ${newTutor.apellidos}`,
      ip
    );
    return newTutor;
  }

  async updateTutor(id, data, userId = null, ip = null) {
    await this.getTutorById(id);
    const updated = await this.tutorRepo.update(id, data);
    await this.userRepo.logAudit(
      userId,
      'TUTOR_UPDATED',
      'TUTORES',
      `Actualización de tutor ID ${id}`,
      ip
    );
    return updated;
  }
}
