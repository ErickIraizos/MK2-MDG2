import { config } from '../config/environment.js';

import { SqliteUserRepository } from '../repositories/sqlite/SqliteUserRepository.js';
import { SqliteRoomRepository } from '../repositories/sqlite/SqliteRoomRepository.js';
import { SqliteConfigRepository } from '../repositories/sqlite/SqliteConfigRepository.js';
import { SqlitePatientRepository } from '../repositories/sqlite/SqlitePatientRepository.js';
import { SqliteTherapistRepository } from '../repositories/sqlite/SqliteTherapistRepository.js';
import { SqliteTutorRepository } from '../repositories/sqlite/SqliteTutorRepository.js';
import { SqliteTriageRepository } from '../repositories/sqlite/SqliteTriageRepository.js';
import { SqliteClinicalRecordRepository } from '../repositories/sqlite/SqliteClinicalRecordRepository.js';
import { SqliteAppointmentRepository } from '../repositories/sqlite/SqliteAppointmentRepository.js';
import { SqliteConsentRepository } from '../repositories/sqlite/SqliteConsentRepository.js';
import { SqliteReportRepository } from '../repositories/sqlite/SqliteReportRepository.js';
import { SqlitePaymentRepository } from '../repositories/sqlite/SqlitePaymentRepository.js';
import { SqliteBatteryRepository } from '../repositories/sqlite/SqliteBatteryRepository.js';
import { SqliteConvenioRepository } from '../repositories/sqlite/SqliteConvenioRepository.js';
import { SqliteGlossaryRepository } from '../repositories/sqlite/SqliteGlossaryRepository.js';
import { SqliteWorkshopRepository } from '../repositories/sqlite/SqliteWorkshopRepository.js';
import { SqliteAnalyticsRepository } from '../repositories/sqlite/SqliteAnalyticsRepository.js';
import { SqliteMaterialRepository } from '../repositories/sqlite/SqliteMaterialRepository.js';
import { SqliteNotificationRepository } from '../repositories/sqlite/SqliteNotificationRepository.js';
import { SqliteWhatsappRepository } from '../repositories/sqlite/SqliteWhatsappRepository.js';

import { PostgresUserRepository } from '../repositories/postgres/PostgresUserRepository.js';
import { PostgresRoomRepository } from '../repositories/postgres/PostgresRoomRepository.js';
import { PostgresConfigRepository } from '../repositories/postgres/PostgresConfigRepository.js';
import { PostgresPatientRepository } from '../repositories/postgres/PostgresPatientRepository.js';
import { PostgresTherapistRepository } from '../repositories/postgres/PostgresTherapistRepository.js';
import { PostgresTutorRepository } from '../repositories/postgres/PostgresTutorRepository.js';
import { PostgresTriageRepository } from '../repositories/postgres/PostgresTriageRepository.js';
import { PostgresClinicalRecordRepository } from '../repositories/postgres/PostgresClinicalRecordRepository.js';
import { PostgresAppointmentRepository } from '../repositories/postgres/PostgresAppointmentRepository.js';
import { PostgresConsentRepository } from '../repositories/postgres/PostgresConsentRepository.js';
import { PostgresReportRepository } from '../repositories/postgres/PostgresReportRepository.js';
import { PostgresPaymentRepository } from '../repositories/postgres/PostgresPaymentRepository.js';
import { PostgresBatteryRepository } from '../repositories/postgres/PostgresBatteryRepository.js';
import { PostgresConvenioRepository } from '../repositories/postgres/PostgresConvenioRepository.js';
import { PostgresGlossaryRepository } from '../repositories/postgres/PostgresGlossaryRepository.js';
import { PostgresWorkshopRepository } from '../repositories/postgres/PostgresWorkshopRepository.js';
import { PostgresAnalyticsRepository } from '../repositories/postgres/PostgresAnalyticsRepository.js';
import { PostgresMaterialRepository } from '../repositories/postgres/PostgresMaterialRepository.js';
import { PostgresNotificationRepository } from '../repositories/postgres/PostgresNotificationRepository.js';
import { PostgresWhatsappRepository } from '../repositories/postgres/PostgresWhatsappRepository.js';

let instances = {};

function resolveRepo(key, SqliteImpl, PostgresImpl) {
  if (!instances[key]) {
    if (config.database.driver === 'sqlite') {
      instances[key] = new SqliteImpl();
    } else if (config.database.driver === 'postgres' || config.database.driver === 'postgresql') {
      instances[key] = new PostgresImpl();
    } else {
      throw new Error(`Driver [${config.database.driver}] no soportado en RepositoryFactory`);
    }
  }
  return instances[key];
}

export class RepositoryFactory {
  static getUserRepository() {
    return resolveRepo('userRepo', SqliteUserRepository, PostgresUserRepository);
  }

  static getRoomRepository() {
    return resolveRepo('roomRepo', SqliteRoomRepository, PostgresRoomRepository);
  }

  static getConfigRepository() {
    return resolveRepo('configRepo', SqliteConfigRepository, PostgresConfigRepository);
  }

  static getPatientRepository() {
    return resolveRepo('patientRepo', SqlitePatientRepository, PostgresPatientRepository);
  }

  static getTherapistRepository() {
    return resolveRepo('therapistRepo', SqliteTherapistRepository, PostgresTherapistRepository);
  }

  static getTutorRepository() {
    return resolveRepo('tutorRepo', SqliteTutorRepository, PostgresTutorRepository);
  }

  static getTriageRepository() {
    return resolveRepo('triageRepo', SqliteTriageRepository, PostgresTriageRepository);
  }

  static getClinicalRecordRepository() {
    return resolveRepo('clinicalRecordRepo', SqliteClinicalRecordRepository, PostgresClinicalRecordRepository);
  }

  static getAppointmentRepository() {
    return resolveRepo('appointmentRepo', SqliteAppointmentRepository, PostgresAppointmentRepository);
  }

  static getConsentRepository() {
    return resolveRepo('consentRepo', SqliteConsentRepository, PostgresConsentRepository);
  }

  static getReportRepository() {
    return resolveRepo('reportRepo', SqliteReportRepository, PostgresReportRepository);
  }

  static getPaymentRepository() {
    return resolveRepo('paymentRepo', SqlitePaymentRepository, PostgresPaymentRepository);
  }

  static getBatteryRepository() {
    return resolveRepo('batteryRepo', SqliteBatteryRepository, PostgresBatteryRepository);
  }

  static getConvenioRepository() {
    return resolveRepo('convenioRepo', SqliteConvenioRepository, PostgresConvenioRepository);
  }

  static getGlossaryRepository() {
    return resolveRepo('glossaryRepo', SqliteGlossaryRepository, PostgresGlossaryRepository);
  }

  static getWorkshopRepository() {
    return resolveRepo('workshopRepo', SqliteWorkshopRepository, PostgresWorkshopRepository);
  }

  static getAnalyticsRepository() {
    return resolveRepo('analyticsRepo', SqliteAnalyticsRepository, PostgresAnalyticsRepository);
  }

  static getMaterialRepository() {
    return resolveRepo('materialRepo', SqliteMaterialRepository, PostgresMaterialRepository);
  }

  static getNotificationRepository() {
    return resolveRepo('notificationRepo', SqliteNotificationRepository, PostgresNotificationRepository);
  }

  static getWhatsappRepository() {
    return resolveRepo('whatsappRepo', SqliteWhatsappRepository, PostgresWhatsappRepository);
  }
}
