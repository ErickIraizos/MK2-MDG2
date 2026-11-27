import { AppError } from '../core/AppError.js';
import { RepositoryFactory } from '../core/RepositoryFactory.js';

export class ConfigService {
  constructor(configRepo = RepositoryFactory.getConfigRepository(), userRepo = RepositoryFactory.getUserRepository()) {
    this.configRepo = configRepo;
    this.userRepo = userRepo;
  }

  async getPublicConfig() {
    const all = await this.configRepo.getAll(false);
    const publicSettings = {};
    for (const item of all) {
      if (item.es_secreto !== 1) {
        publicSettings[item.clave] = item.valor;
      }
    }
    return publicSettings;
  }

  async getAllAdminConfig() {
    return this.configRepo.getAll(true);
  }

  async getGroqApiKey() {
    const key = await this.configRepo.getByKey('GROQ_API_KEY');
    return key || '';
  }

  async updateGroqApiKey(newKey, userId = null, ip = null) {
    if (!newKey || typeof newKey !== 'string' || newKey.trim().length < 10) {
      throw AppError.badRequest('La clave GROQ_API_KEY proporcionada no tiene un formato válido.');
    }

    const trimmedKey = newKey.trim();
    await this.configRepo.setKey('GROQ_API_KEY', trimmedKey, userId);
    await this.userRepo.logAudit(userId, 'GROQ_KEY_UPDATED', 'CONFIG_IA', 'Actualización dinámica de GROQ_API_KEY', ip);

    return {
      success: true,
      message: 'Clave GROQ_API_KEY actualizada exitosamente en caliente sin reiniciar el servidor.'
    };
  }

  /**
   * Actualización de dirección y datos de sede del centro (Exclusivo Administrador)
   */
  async updateInstitutionConfig(data = {}, userId = null, ip = null) {
    const direccion = data.direccion !== undefined ? data.direccion : data.INSTITUCION_DIRECCION;
    const telefono = data.telefono !== undefined ? data.telefono : data.INSTITUCION_TELEFONO;
    const whatsapp = data.whatsapp !== undefined ? data.whatsapp : data.INSTITUCION_WHATSAPP;
    const nombre = data.nombre !== undefined ? data.nombre : data.INSTITUCION_NOMBRE;

    if (direccion !== undefined) {
      if (!direccion || typeof direccion !== 'string' || direccion.trim().length < 5) {
        throw AppError.badRequest('La dirección de la sede debe tener al menos 5 caracteres descriptivos.');
      }
      await this.configRepo.setKey('INSTITUCION_DIRECCION', direccion.trim(), userId);
    }

    if (telefono !== undefined) {
      await this.configRepo.setKey('INSTITUCION_TELEFONO', String(telefono || '').trim(), userId);
    }

    if (whatsapp !== undefined) {
      await this.configRepo.setKey('INSTITUCION_WHATSAPP', String(whatsapp || '').trim(), userId);
    }

    if (nombre !== undefined && typeof nombre === 'string' && nombre.trim().length >= 3) {
      await this.configRepo.setKey('INSTITUCION_NOMBRE', nombre.trim(), userId);
    }

    const mision = data.mision !== undefined ? data.mision : data.INSTITUCION_MISION;
    if (mision !== undefined && typeof mision === 'string') {
      await this.configRepo.setKey('INSTITUCION_MISION', mision.trim(), userId);
    }

    const vision = data.vision !== undefined ? data.vision : data.INSTITUCION_VISION;
    if (vision !== undefined && typeof vision === 'string') {
      await this.configRepo.setKey('INSTITUCION_VISION', vision.trim(), userId);
    }

    const metas = data.metas !== undefined ? data.metas : data.INSTITUCION_METAS;
    if (metas !== undefined && typeof metas === 'string') {
      await this.configRepo.setKey('INSTITUCION_METAS', metas.trim(), userId);
    }

    const horario = data.horario !== undefined ? data.horario : data.INSTITUCION_HORARIO;
    if (horario !== undefined && typeof horario === 'string') {
      await this.configRepo.setKey('INSTITUCION_HORARIO', horario.trim(), userId);
    }

    const directora = data.directora !== undefined ? data.directora : data.INSTITUCION_DIRECTORA;
    if (directora !== undefined && typeof directora === 'string') {
      await this.configRepo.setKey('INSTITUCION_DIRECTORA', directora.trim(), userId);
    }

    const direccionFields = [
      ['INSTITUCION_DIRECCION_ETIQUETA', data.INSTITUCION_DIRECCION_ETIQUETA ?? data.direccion_etiqueta],
      ['INSTITUCION_DIRECCION_MATRICULA', data.INSTITUCION_DIRECCION_MATRICULA ?? data.direccion_matricula],
      ['INSTITUCION_DIRECCION_BIO', data.INSTITUCION_DIRECCION_BIO ?? data.direccion_bio],
      ['INSTITUCION_DIRECTORA_FOTO', data.INSTITUCION_DIRECTORA_FOTO ?? data.directora_foto]
    ];
    for (const [k, v] of direccionFields) {
      if (v !== undefined && typeof v === 'string') {
        await this.configRepo.setKey(k, v.trim(), userId);
      }
    }

    const googleMapsUrl = data.google_maps_url !== undefined ? data.google_maps_url : data.INSTITUCION_GOOGLE_MAPS_URL;
    if (googleMapsUrl !== undefined && typeof googleMapsUrl === 'string') {
      await this.configRepo.setKey('INSTITUCION_GOOGLE_MAPS_URL', googleMapsUrl.trim(), userId);
    }

    const facilityPhotos = [
      ['INSTITUCION_FOTO_FACHADA', data.INSTITUCION_FOTO_FACHADA ?? data.foto_fachada],
      ['INSTITUCION_FOTO_RECEPCION', data.INSTITUCION_FOTO_RECEPCION ?? data.foto_recepcion],
      ['INSTITUCION_FOTO_CONS1', data.INSTITUCION_FOTO_CONS1 ?? data.foto_cons1],
      ['INSTITUCION_FOTO_CONS2', data.INSTITUCION_FOTO_CONS2 ?? data.foto_cons2],
      ['INSTITUCION_FOTO_CONS3', data.INSTITUCION_FOTO_CONS3 ?? data.foto_cons3]
    ];
    for (const [k, v] of facilityPhotos) {
      if (v !== undefined && typeof v === 'string') {
        await this.configRepo.setKey(k, v.trim(), userId);
      }
    }

    await this.userRepo.logAudit(
      userId,
      'INSTITUTION_CONFIG_UPDATED',
      'SEDE_INSTITUCIONAL',
      `Actualización de datos de sede: ${direccion ? direccion.trim() : 'Parámetros actualizados'}`,
      ip
    );

    return {
      success: true,
      message: 'Dirección física y datos institucionales del centro actualizados correctamente.',
      data: await this.getPublicConfig()
    };
  }

  async testGroqConnection(apiKeyToTest = null) {
    const key = apiKeyToTest || (await this.getGroqApiKey());

    if (!key || key.startsWith('gsk_demo_dummy')) {
      return {
        online: false,
        message: 'Clave demo o no configurada. Configure una clave real de GroqCloud (https://console.groq.com) para activar el LLM en la nube.'
      };
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          online: false,
          statusCode: response.status,
          message: errorData.error?.message || `Error HTTP ${response.status} al conectar con GroqCloud.`
        };
      }

      const data = await response.json();
      return {
        online: true,
        message: 'Conectividad verificada con GroqCloud. La API responde correctamente.',
        availableModelsCount: data.data ? data.data.length : 0
      };
    } catch (err) {
      return {
        online: false,
        message: `Error de red al conectar con GroqCloud: ${err.message}. El sistema usará el motor heurístico local offline.`
      };
    }
  }
}
