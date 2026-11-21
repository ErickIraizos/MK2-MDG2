import { AppError } from './AppError.js';
import { RepositoryFactory } from './RepositoryFactory.js';

/**
 * Resuelve la ficha de tutor vinculada al usuario autenticado (por usuario_id o fallback de email).
 */
export async function getTutorForUser(user) {
  if (!user) return null;
  const tutorRepo = RepositoryFactory.getTutorRepository();
  let tutor = await tutorRepo.findByUserId(user.id);
  if (!tutor && user.email && typeof tutorRepo.findByEmail === 'function') {
    tutor = await tutorRepo.findByEmail(user.email);
  }
  return tutor || null;
}

/**
 * Resuelve la ficha de terapeuta vinculada al usuario autenticado.
 */
export async function getTherapistForUser(user) {
  if (!user) return null;
  const therapistRepo = RepositoryFactory.getTherapistRepository();
  return (await therapistRepo.findByUserId(user.id)) || null;
}

/**
 * Verifica que el usuario autenticado tenga permisos legítimos sobre un paciente.
 * Reutiliza la misma matriz clínica de confidencialidad en Pacientes, Historias, Consentimientos e Informes.
 */
export async function assertPatientAccess(
  pacienteId,
  currentUser,
  {
    allowReception = false,
    allowTutor = false,
    actionDescription = 'acceder a la información de este paciente'
  } = {}
) {
  if (!currentUser) {
    throw AppError.unauthorized('Autenticación requerida.');
  }

  const targetId = Number(pacienteId);
  if (!targetId || Number.isNaN(targetId)) {
    throw AppError.badRequest('Identificador de paciente inválido.');
  }

  if (currentUser.rol === 'ADMIN') {
    return { allowed: true };
  }

  if (currentUser.rol === 'RECEPCION') {
    if (allowReception) return { allowed: true };
    throw AppError.forbidden(`Acceso restringido: Recepción no tiene permisos para ${actionDescription}.`);
  }

  if (currentUser.rol === 'TERAPEUTA') {
    const therapist = await getTherapistForUser(currentUser);
    if (!therapist) {
      throw AppError.forbidden('Perfil de especialista no encontrado.');
    }

    const patientRepo = RepositoryFactory.getPatientRepository();
    const patient = await patientRepo.getPatientAccessSnapshot(targetId);

    if (!patient) {
      throw AppError.notFound(`No se encontró el paciente con ID ${targetId}.`);
    }

    const isAssigned = Number(patient.terapeuta_id) === Number(therapist.id);
    const isCreator = Number(patient.creado_por_usuario_id) === Number(currentUser.id);
    const hasDerivation = await patientRepo.hasActiveDerivation(targetId, therapist.id);

    if (!isAssigned && !isCreator && !hasDerivation) {
      throw AppError.forbidden(
        `Acceso confidencial restringido: Solo el especialista tratante o derivado puede ${actionDescription}.`
      );
    }
    return { allowed: true, therapist };
  }

  if (currentUser.rol === 'TUTOR' && allowTutor) {
    const tutor = await getTutorForUser(currentUser);
    if (!tutor) {
      throw AppError.forbidden(`Acceso restringido: No existe un perfil de tutor vinculado para ${actionDescription}.`);
    }

    const patientRepo = RepositoryFactory.getPatientRepository();
    const hasLink = await patientRepo.hasTutorLink(targetId, tutor.id);

    if (!hasLink) {
      throw AppError.forbidden(
        `Acceso confidencial denegado: No tiene tutela legal registrada sobre este paciente para ${actionDescription}.`
      );
    }
    return { allowed: true, tutor };
  }

  throw AppError.forbidden(`Acceso denegado: Su rol no tiene autorización para ${actionDescription}.`);
}

/**
 * Verifica que un terapeuta solo opere sus propios recursos (por ejemplo sesión de WhatsApp),
 * permitiendo supervisión de ADMIN y opcionalmente RECEPCION.
 */
export async function assertTherapistOwnership(therapistId, currentUser, { allowReception = false } = {}) {
  if (!currentUser) {
    throw AppError.unauthorized('Autenticación requerida.');
  }

  if (currentUser.rol === 'ADMIN') return null;
  if (currentUser.rol === 'RECEPCION' && allowReception) return null;

  if (currentUser.rol === 'TERAPEUTA') {
    const therapist = await getTherapistForUser(currentUser);
    if (!therapist || Number(therapist.id) !== Number(therapistId)) {
      throw AppError.forbidden('Acceso restringido: Solo puede gestionar los recursos asignados a su propio perfil profesional.');
    }
    return therapist;
  }

  throw AppError.forbidden('No cuenta con permisos para realizar esta acción.');
}
