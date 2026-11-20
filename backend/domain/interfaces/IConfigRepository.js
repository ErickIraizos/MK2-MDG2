/**
 * Contrato abstracto para la persistencia de parámetros del sistema y claves de IA
 */
export class IConfigRepository {
  async getByKey(key) {
    throw new Error('Método no implementado');
  }

  async getAll(includeSecrets = false) {
    throw new Error('Método no implementado');
  }

  async setKey(key, value, updatedBy = null) {
    throw new Error('Método no implementado');
  }

  async setMultiple(keyValueMap, updatedBy = null) {
    throw new Error('Método no implementado');
  }
}
