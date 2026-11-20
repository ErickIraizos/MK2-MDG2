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

let instances = {};

export class RepositoryFactory {
  static getUserRepository() {
    if (!instances.userRepo) {
      if (config.database.driver === 'sqlite') {
        instances.userRepo = new SqliteUserRepository();
      } else {
        // Reservado para migración a Supabase (Fase 2)
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.userRepo;
  }

  static getRoomRepository() {
    if (!instances.roomRepo) {
      if (config.database.driver === 'sqlite') {
        instances.roomRepo = new SqliteRoomRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.roomRepo;
  }

  static getConfigRepository() {
    if (!instances.configRepo) {
      if (config.database.driver === 'sqlite') {
        instances.configRepo = new SqliteConfigRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.configRepo;
  }

  static getPatientRepository() {
    if (!instances.patientRepo) {
      if (config.database.driver === 'sqlite') {
        instances.patientRepo = new SqlitePatientRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.patientRepo;
  }

  static getTherapistRepository() {
    if (!instances.therapistRepo) {
      if (config.database.driver === 'sqlite') {
        instances.therapistRepo = new SqliteTherapistRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.therapistRepo;
  }

  static getTutorRepository() {
    if (!instances.tutorRepo) {
      if (config.database.driver === 'sqlite') {
        instances.tutorRepo = new SqliteTutorRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.tutorRepo;
  }

  static getTriageRepository() {
    if (!instances.triageRepo) {
      if (config.database.driver === 'sqlite') {
        instances.triageRepo = new SqliteTriageRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.triageRepo;
  }

  static getClinicalRecordRepository() {
    if (!instances.clinicalRecordRepo) {
      if (config.database.driver === 'sqlite') {
        instances.clinicalRecordRepo = new SqliteClinicalRecordRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.clinicalRecordRepo;
  }

  static getAppointmentRepository() {
    if (!instances.appointmentRepo) {
      if (config.database.driver === 'sqlite') {
        instances.appointmentRepo = new SqliteAppointmentRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.appointmentRepo;
  }

  static getConsentRepository() {
    if (!instances.consentRepo) {
      if (config.database.driver === 'sqlite') {
        instances.consentRepo = new SqliteConsentRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.consentRepo;
  }

  static getReportRepository() {
    if (!instances.reportRepo) {
      if (config.database.driver === 'sqlite') {
        instances.reportRepo = new SqliteReportRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.reportRepo;
  }

  static getPaymentRepository() {
    if (!instances.paymentRepo) {
      if (config.database.driver === 'sqlite') {
        instances.paymentRepo = new SqlitePaymentRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.paymentRepo;
  }

  static getBatteryRepository() {
    if (!instances.batteryRepo) {
      if (config.database.driver === 'sqlite') {
        instances.batteryRepo = new SqliteBatteryRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.batteryRepo;
  }

  static getConvenioRepository() {
    if (!instances.convenioRepo) {
      if (config.database.driver === 'sqlite') {
        instances.convenioRepo = new SqliteConvenioRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.convenioRepo;
  }

  static getGlossaryRepository() {
    if (!instances.glossaryRepo) {
      if (config.database.driver === 'sqlite') {
        instances.glossaryRepo = new SqliteGlossaryRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.glossaryRepo;
  }

  static getWorkshopRepository() {
    if (!instances.workshopRepo) {
      if (config.database.driver === 'sqlite') {
        instances.workshopRepo = new SqliteWorkshopRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.workshopRepo;
  }

  static getAnalyticsRepository() {
    if (!instances.analyticsRepo) {
      if (config.database.driver === 'sqlite') {
        instances.analyticsRepo = new SqliteAnalyticsRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.analyticsRepo;
  }

  static getMaterialRepository() {
    if (!instances.materialRepo) {
      if (config.database.driver === 'sqlite') {
        instances.materialRepo = new SqliteMaterialRepository();
      } else {
        throw new Error(`Driver [${config.database.driver}] no configurado aún en RepositoryFactory`);
      }
    }
    return instances.materialRepo;
  }
}

