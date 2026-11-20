/**
 * Interfaz de Dominio para el Repositorio de Historias Clínicas y Notas SOAP (Módulo E - Sprint 4)
 * Define el contrato de persistencia para expedientes clínicos, anamnesis y notas de evolución continua.
 */
export class IClinicalRecordRepository {
  /**
   * Obtiene la historia clínica por su ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findHistoryById(id) {
    throw new Error('Método findHistoryById() no implementado');
  }

  /**
   * Obtiene la historia clínica asociada a un paciente.
   * @param {number} pacienteId
   * @returns {Promise<Object|null>}
   */
  async findHistoryByPatientId(pacienteId) {
    throw new Error('Método findHistoryByPatientId() no implementado');
  }

  /**
   * Obtiene la historia clínica por su código/número de expediente (ej. 'PSI-A-0001').
   * @param {string} numeroExpediente
   * @returns {Promise<Object|null>}
   */
  async findHistoryByNumeroExpediente(numeroExpediente) {
    throw new Error('Método findHistoryByNumeroExpediente() no implementado');
  }

  /**
   * Obtiene todos los expedientes clínicos con filtros y datos de paciente y terapeuta.
   * @param {Object} options { search, estado, terapeutaId, limit, offset }
   * @returns {Promise<{ total: number, records: Array }>}
   */
  async findAllHistories(options = {}) {
    throw new Error('Método findAllHistories() no implementado');
  }

  /**
   * Crea una nueva historia clínica vinculada a un paciente.
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createHistory(data) {
    throw new Error('Método createHistory() no implementado');
  }

  /**
   * Actualiza el estado clínico de un expediente.
   * @param {number} id
   * @param {string} estado
   * @param {string} observaciones
   * @returns {Promise<Object>}
   */
  async updateHistoryStatus(id, estado, observaciones) {
    throw new Error('Método updateHistoryStatus() no implementado');
  }

  /**
   * Obtiene la anamnesis inicial vinculada a una historia clínica.
   * @param {number} historiaId
   * @returns {Promise<Object|null>}
   */
  async getAnamnesisByHistoryId(historiaId) {
    throw new Error('Método getAnamnesisByHistoryId() no implementado');
  }

  /**
   * Crea o actualiza la anamnesis de una historia clínica.
   * @param {number} historiaId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async saveAnamnesis(historiaId, data) {
    throw new Error('Método saveAnamnesis() no implementado');
  }

  /**
   * Obtiene la cronología de notas de evolución SOAP de una historia clínica.
   * @param {number} historiaId
   * @returns {Promise<Array>}
   */
  async findSoapNotesByHistoryId(historiaId) {
    throw new Error('Método findSoapNotesByHistoryId() no implementado');
  }

  /**
   * Registra una nota de evolución SOAP inalterable (RN-07).
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createSoapNote(data) {
    throw new Error('Método createSoapNote() no implementado');
  }

  /**
   * Obtiene el siguiente número correlativo de sesión para un expediente.
   * @param {number} historiaId
   * @returns {Promise<number>}
   */
  async getNextSessionNumber(historiaId) {
    throw new Error('Método getNextSessionNumber() no implementado');
  }

  // =========================================================================
  // SPRINT 5: CATÁLOGO NOSOLÓGICO, CARPETAS DIGITALES Y PLANES SMART
  // =========================================================================

  /**
   * Busca diagnósticos en el catálogo nosológico oficial CIE-11 / DSM-5.
   * @param {string} query
   * @param {string|null} categoria
   * @returns {Promise<Array>}
   */
  async searchDiagnostics(query = '', categoria = null) {
    throw new Error('Método searchDiagnostics() no implementado');
  }

  /**
   * Obtiene las carpetas digitales de un paciente (inicializando las 5 del sistema si no existen).
   * @param {number} pacienteId
   * @param {boolean} includeInactive
   * @param {Object|null} currentUser
   * @returns {Promise<Array>}
   */
  async getFoldersByPatientId(pacienteId, includeInactive = false, currentUser = null) {
    throw new Error('Método getFoldersByPatientId() no implementado');
  }

  /**
   * Obtiene una carpeta digital por su ID.
   * @param {number} folderId
   * @returns {Promise<Object|null>}
   */
  async getFolderById(folderId) {
    throw new Error('Método getFolderById() no implementado');
  }

  /**
   * Actualiza el estado activo/inactivo de una carpeta digital con motivo de baja opcional.
   * @param {number} folderId
   * @param {boolean|number} activo
   * @param {string|null} motivoBaja
   * @returns {Promise<Object>}
   */
  async updateFolderStatus(folderId, activo, motivoBaja = null) {
    throw new Error('Método updateFolderStatus() no implementado');
  }

  /**
   * Crea una carpeta digital personalizada para el paciente.
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createFolder(data) {
    throw new Error('Método createFolder() no implementado');
  }

  /**
   * Obtiene los documentos activos de una carpeta específica.
   * @param {number} carpetaId
   * @param {number} pacienteId
   * @returns {Promise<Array>}
   */
  async getDocumentsByFolderId(carpetaId, pacienteId) {
    throw new Error('Método getDocumentsByFolderId() no implementado');
  }

  /**
   * Obtiene todos los documentos clínicos de un paciente agrupados o planos.
   * @param {number} pacienteId
   * @returns {Promise<Array>}
   */
  async getDocumentsByPatientId(pacienteId) {
    throw new Error('Método getDocumentsByPatientId() no implementado');
  }

  /**
   * Obtiene un documento por su ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async getDocumentById(id) {
    throw new Error('Método getDocumentById() no implementado');
  }

  /**
   * Registra un nuevo documento o estudio externo adjunto.
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createDocument(data) {
    throw new Error('Método createDocument() no implementado');
  }

  /**
   * Anulación lógica (soft delete) de un documento con justificación médica.
   * @param {number} id
   * @param {number} anuladoPorId
   * @param {string} motivoAnulacion
   * @returns {Promise<boolean>}
   */
  async softDeleteDocument(id, anuladoPorId, motivoAnulacion) {
    throw new Error('Método softDeleteDocument() no implementado');
  }

  /**
   * Reincorpora un documento clínico previamente anulado.
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  async restoreDocument(id) {
    throw new Error('Método restoreDocument() no implementado');
  }

  /**
   * Obtiene los documentos desvinculados de un paciente.
   * @param {number} pacienteId
   * @param {object} currentUser
   * @returns {Promise<Array>}
   */
  async getInactiveDocumentsByPatientId(pacienteId, currentUser = null) {
    throw new Error('Método getInactiveDocumentsByPatientId() no implementado');
  }

  /**
   * Registra un check-in de pauta en el hogar realizado por el tutor.
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createHomePracticeCheckin(data) {
    throw new Error('Método createHomePracticeCheckin() no implementado');
  }

  /**
   * Obtiene el historial de prácticas en el hogar.
   * @param {number} pacienteId
   * @param {number|null} metaId
   * @returns {Promise<Array>}
   */
  async getHomePracticeHistory(pacienteId, metaId = null) {
    throw new Error('Método getHomePracticeHistory() no implementado');
  }

  /**
   * Obtiene los planes de intervención (PTI) de una historia clínica.
   * @param {number} historiaId
   * @returns {Promise<Array>}
   */
  async getInterventionPlansByHistoryId(historiaId) {
    throw new Error('Método getInterventionPlansByHistoryId() no implementado');
  }

  /**
   * Obtiene un plan de intervención por su ID con sus metas SMART.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async getInterventionPlanById(id) {
    throw new Error('Método getInterventionPlanById() no implementado');
  }

  /**
   * Crea un nuevo Plan Terapéutico Individualizado (PTI).
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createInterventionPlan(data) {
    throw new Error('Método createInterventionPlan() no implementado');
  }

  /**
   * Actualiza el estado de un plan (soft close: 'CUMPLIDO' | 'DESCONTINUADO').
   * @param {number} id
   * @param {string} estado
   * @param {string} motivoCierre
   * @param {number} cerradoPorId
   * @returns {Promise<Object>}
   */
  async updateInterventionPlanStatus(id, estado, motivoCierre, cerradoPorId) {
    throw new Error('Método updateInterventionPlanStatus() no implementado');
  }

  /**
   * Obtiene una meta SMART por su ID.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async getSmartGoalById(id) {
    throw new Error('Método getSmartGoalById() no implementado');
  }

  /**
   * Obtiene las metas SMART asociadas a un plan.
   * @param {number} planId
   * @returns {Promise<Array>}
   */
  async getSmartGoalsByPlanId(planId) {
    throw new Error('Método getSmartGoalsByPlanId() no implementado');
  }

  /**
   * Registra una nueva meta SMART en un plan PTI.
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createSmartGoal(data) {
    throw new Error('Método createSmartGoal() no implementado');
  }

  /**
   * Actualiza el avance cuantitativo de una meta SMART registrando trazabilidad en historial.
   * @param {number} metaId
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async updateSmartGoalProgress(metaId, data) {
    throw new Error('Método updateSmartGoalProgress() no implementado');
  }

  /**
   * Obtiene la cronología de evolución de una meta SMART.
   * @param {number} metaId
   * @returns {Promise<Array>}
   */
  async getGoalEvolutionHistory(metaId) {
    throw new Error('Método getGoalEvolutionHistory() no implementado');
  }
}

