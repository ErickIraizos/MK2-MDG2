/**
 * Interfaz de Dominio para el Repositorio de Triaje e Inferencia IA (Módulo D)
 * Define el contrato de persistencia para sesiones de triaje y orientaciones clínicas.
 */
export class ITriageRepository {
  /**
   * Guarda un nuevo registro de triaje clínico o consulta de orientación.
   * @param {Object} triageData
   * @returns {Promise<Object>}
   */
  async create(triageData) {
    throw new Error('Método create() no implementado en ITriageRepository');
  }

  /**
   * Obtiene el listado de triajes con paginación y filtros opcionales.
   * @param {Object} options { limit, offset, esCrisis, area }
   * @returns {Promise<{ total: number, triajes: Array }>}
   */
  async findAll(options = {}) {
    throw new Error('Método findAll() no implementado en ITriageRepository');
  }

  /**
   * Busca un triaje por su ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    throw new Error('Método findById() no implementado en ITriageRepository');
  }

  /**
   * Obtiene métricas resumidas de triaje (total, por área, casos de crisis).
   * @returns {Promise<Object>}
   */
  async getMetrics() {
    throw new Error('Método getMetrics() no implementado en ITriageRepository');
  }
}

