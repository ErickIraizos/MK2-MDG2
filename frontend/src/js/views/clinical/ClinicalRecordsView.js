import { apiClient } from '../../api/apiClient.js';
import { store } from '../../store.js';
import { Toast } from '../../components/Toast.js';
import { Icons } from '../../components/Icons.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { SignatureCanvas } from '../../components/SignatureCanvas.js';
import { getBoliviaTodayDateString } from '../../utils/dateTime.js';
import mammoth from 'mammoth';

export class ClinicalRecordsView {
  constructor(container) {
    this.container = container;
    this.histories = [];
    this.currentHistory = null;
    this.anamnesis = null;
    this.soapNotes = [];
    this.plans = [];
    this.folders = [];
    this.inactiveFolders = [];
    this.documents = [];
    this.inactiveDocs = [];
    this.familyCheckins = [];
    this.consents = [];
    this.reports = [];
    this.hasActiveConsent = false;
    this.selectedFolderId = null;
    this.activeTab = 'soap'; // 'soap' | 'anamnesis' | 'plans' | 'folders' | 'consents' | 'reports' | 'patient_info'
    this.filterState = 'TODOS';
    this.searchQuery = '';
    this.isLoading = false;
    this.isAiProcessing = false;
    this.selectedHistoryId = null;
    this.signatureCanvasInstance = null;
  }

  async render() {
    // Detectar si la URL trae un parámetro ?id=X o ?patientId=Y o ?patient=Y o ?action=soap
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
    const paramId = urlParams.get('id');
    const paramPatientId = urlParams.get('patientId') || urlParams.get('patient');
    const paramTab = urlParams.get('tab');
    const paramAction = urlParams.get('action');

    if (paramId) {
      this.selectedHistoryId = Number(paramId);
    }
    if (paramTab && ['soap', 'anamnesis', 'plans', 'folders', 'consents', 'reports', 'patient_info'].includes(paramTab)) {
      this.activeTab = paramTab;
    }

    this.container.innerHTML = `
      <div class="clinical-records-container page-container panel-general" style="max-width: 1400px; margin: 0 auto; padding-bottom: 3rem;">
        <div id="clinical-records-content" class="panel-general" style="padding: 0;">
          <div class="soft-section-card" style="text-align: center; padding: 3.5rem 1.5rem;">
            <div class="spinner" style="margin: 0 auto 1rem auto; width: 34px; height: 34px; border: 3px solid var(--soft-border-card-inner); border-top-color: var(--soft-purple-primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            <p style="color: var(--soft-text-body); font-size: 0.92rem; margin: 0;">Cargando historias clínicas y expedientes...</p>
          </div>
        </div>
      </div>
      <div id="modal-container-clinical"></div>
    `;

    if (paramPatientId) {
      await this.loadHistoryByPatient(paramPatientId);
      if (paramAction === 'soap') {
        setTimeout(() => this.openSoapModal(), 180);
      }
    } else if (this.selectedHistoryId) {
      await this.loadHistoryDetail(this.selectedHistoryId);
      if (paramAction === 'soap') {
        setTimeout(() => this.openSoapModal(), 180);
      }
    } else {
      await this.loadHistoriesList();
    }
  }

  async loadHistoriesList() {
    this.selectedHistoryId = null;
    this.currentHistory = null;
    try {
      this.isLoading = true;
      const res = await apiClient.get(`/clinical-records?search=${encodeURIComponent(this.searchQuery)}&estado=${this.filterState}`);
      this.histories = res.data || [];
      this.renderMasterListView();
    } catch (err) {
      Toast.error('No se pudieron cargar los expedientes clínicos: ' + err.message);
      this.renderEmptyState('Error al conectar con la base de datos clínica.');
    } finally {
      this.isLoading = false;
    }
  }

  async loadHistoryDetail(id) {
    this.currentHistory = null;
    this.anamnesis = null;
    this.soapNotes = [];
    this.plans = [];
    this.folders = [];
    this.inactiveFolders = [];
    this.documents = [];
    try {
      this.isLoading = true;
      const res = await apiClient.get(`/clinical-records/${id}`);
      this.currentHistory = res.data.history;
      this.anamnesis = res.data.anamnesis;
      this.soapNotes = res.data.soapNotes || [];
      this.selectedHistoryId = id;

      // Cargar en paralelo planes PTI, carpetas, documentos, bitácora del hogar y Módulo I (consentimientos y reportes)
      try {
        const [plansRes, foldersRes, docsRes, inactiveDocsRes, checkinsRes, consentsRes, reportsRes, consentStatusRes] = await Promise.all([
          apiClient.get(`/clinical-records/${this.currentHistory.id}/plans`).catch(() => ({ data: [] })),
          apiClient.get(`/clinical-records/patient/${this.currentHistory.paciente_id}/folders?includeInactive=true`).catch(() => ({ data: [] })),
          apiClient.get(`/clinical-records/patient/${this.currentHistory.paciente_id}/documents`).catch(() => ({ data: [] })),
          apiClient.get(`/clinical-records/patients/${this.currentHistory.paciente_id}/inactive-documents`).catch(() => ({ data: [] })),
          apiClient.get(`/clinical-records/portal/family-checkins/${this.currentHistory.paciente_id}`).catch(() => ({ data: [] })),
          apiClient.get(`/consents/patient/${this.currentHistory.paciente_id}`).catch(() => ({ data: [] })),
          apiClient.get(`/reports/patient/${this.currentHistory.paciente_id}`).catch(() => ({ data: [] })),
          apiClient.get(`/consents/check/${this.currentHistory.paciente_id}`).catch(() => ({ data: { hasActiveConsent: false } }))
        ]);
        this.plans = plansRes.data || [];
        const allFolders = foldersRes.data || [];
        this.folders = allFolders.filter(f => f.activo === 1);
        this.inactiveFolders = allFolders.filter(f => f.activo === 0);
        this.documents = docsRes.data || [];
        this.inactiveDocs = inactiveDocsRes.data || [];
        this.familyCheckins = checkinsRes.data || [];
        this.consents = consentsRes.data || [];
        this.reports = reportsRes.data || [];
        this.hasActiveConsent = consentStatusRes.data?.hasActiveConsent || false;
        if (!this.selectedFolderId && this.folders.length > 0) {
          this.selectedFolderId = this.folders[0].id;
        } else if (this.selectedFolderId && !this.folders.some(f => f.id === this.selectedFolderId)) {
          this.selectedFolderId = this.folders.length > 0 ? this.folders[0].id : null;
        }
      } catch (subErr) {
        console.warn('Error cargando planes/documentos/consentimientos:', subErr);
      }

      this.renderDetailView();
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch (err) {
      Toast.error('Error al cargar el detalle del expediente: ' + err.message);
      await this.loadHistoriesList();
    } finally {
      this.isLoading = false;
    }
  }

  async loadHistoryByPatient(patientId) {
    this.currentHistory = null;
    this.anamnesis = null;
    this.soapNotes = [];
    this.plans = [];
    this.folders = [];
    this.inactiveFolders = [];
    this.documents = [];
    try {
      this.isLoading = true;
      const res = await apiClient.get(`/clinical-records/patient/${patientId}`);
      this.currentHistory = res.data.history;
      this.anamnesis = res.data.anamnesis;
      this.soapNotes = res.data.soapNotes || [];
      this.selectedHistoryId = this.currentHistory.id;

      // Cargar en paralelo planes PTI, carpetas, documentos, bitácora del hogar y Módulo I (consentimientos y reportes)
      try {
        const [plansRes, foldersRes, docsRes, inactiveDocsRes, checkinsRes, consentsRes, reportsRes, consentStatusRes] = await Promise.all([
          apiClient.get(`/clinical-records/${this.currentHistory.id}/plans`).catch(() => ({ data: [] })),
          apiClient.get(`/clinical-records/patient/${this.currentHistory.paciente_id}/folders?includeInactive=true`).catch(() => ({ data: [] })),
          apiClient.get(`/clinical-records/patient/${this.currentHistory.paciente_id}/documents`).catch(() => ({ data: [] })),
          apiClient.get(`/clinical-records/patients/${this.currentHistory.paciente_id}/inactive-documents`).catch(() => ({ data: [] })),
          apiClient.get(`/clinical-records/portal/family-checkins/${this.currentHistory.paciente_id}`).catch(() => ({ data: [] })),
          apiClient.get(`/consents/patient/${this.currentHistory.paciente_id}`).catch(() => ({ data: [] })),
          apiClient.get(`/reports/patient/${this.currentHistory.paciente_id}`).catch(() => ({ data: [] })),
          apiClient.get(`/consents/check/${this.currentHistory.paciente_id}`).catch(() => ({ data: { hasActiveConsent: false } }))
        ]);
        this.plans = plansRes.data || [];
        const allFolders = foldersRes.data || [];
        this.folders = allFolders.filter(f => f.activo === 1);
        this.inactiveFolders = allFolders.filter(f => f.activo === 0);
        this.documents = docsRes.data || [];
        this.inactiveDocs = inactiveDocsRes.data || [];
        this.familyCheckins = checkinsRes.data || [];
        this.consents = consentsRes.data || [];
        this.reports = reportsRes.data || [];
        this.hasActiveConsent = consentStatusRes.data?.hasActiveConsent || false;
        if (!this.selectedFolderId && this.folders.length > 0) {
          this.selectedFolderId = this.folders[0].id;
        } else if (this.selectedFolderId && !this.folders.some(f => f.id === this.selectedFolderId)) {
          this.selectedFolderId = this.folders.length > 0 ? this.folders[0].id : null;
        }
      } catch (subErr) {
        console.warn('Error cargando planes/documentos/consentimientos:', subErr);
      }

      this.renderDetailView();
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch (err) {
      Toast.error('No se pudo abrir la historia clínica del paciente: ' + err.message);
      await this.loadHistoriesList();
    } finally {
      this.isLoading = false;
    }
  }

  renderMasterListView() {
    const content = document.getElementById('clinical-records-content');
    if (!content) return;

    const userRole = store.getUserRole();
    const totalActivos = this.histories.filter(h => h.estado === 'ACTIVO').length;
    const totalSesiones = this.histories.reduce((acc, h) => acc + (h.total_sesiones || 0), 0);

    content.innerHTML = `
      <!-- AVISO DE CONFIDENCIALIDAD MÉDICA PARA TERAPEUTAS -->
      ${userRole === 'TERAPEUTA' ? `
        <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 0.85rem 1.2rem; margin-bottom: 1.35rem; display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--soft-text-body);">
          <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender" style="width: 36px; height: 36px; border-radius: 11px;">
            ${Icons.shield(18, 'var(--soft-purple-primary)')}
          </div>
          <span>
            <strong style="color: var(--soft-purple-primary);">Modo Especialista Asignado:</strong> Por normativa de Secreto Profesional y Deontología Médica, este listado muestra únicamente los expedientes clínicos de pacientes asignados a tu cargo.
          </span>
        </div>
      ` : ''}

      <!-- CABECERA INSTITUCIONAL SOFT UI -->
      <div class="soft-header-row" style="margin-bottom: 1.65rem;">
        <div>
          <div class="soft-header-meta">
            <span class="soft-badge soft-badge-lavender">
              ${Icons.stethoscope(14, 'var(--soft-purple-primary)')}
              <span>Módulo E · Historia Clínica Digital Unificada</span>
            </span>
            <span class="soft-location-label">Centro "PSI Aprende"</span>
          </div>
          <h1 class="soft-page-title">Historias Clínicas & Notas SOAP</h1>
          <p class="soft-page-subtitle" style="max-width: 780px;">
            Seguimiento longitudinal inalterable (RN-07), registro de Anamnesis inicial y notas de evolución continua con sello de tiempo y asistencia de IA.
          </p>
        </div>

        <!-- TARJETAS MÉTRICAS RÁPIDAS -->
        <div style="display: flex; gap: 0.95rem; flex-wrap: wrap;">
          <div class="soft-kpi-card soft-kpi-mint" style="padding: 1rem 1.25rem; min-width: min(100%, 195px);">
            ${totalActivos > 0 ? '<span class="soft-status-dot-green" title="Expedientes clínicos activos"></span>' : ''}
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
              ${Icons.fileText(20)}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Expedientes</span>
              <div class="soft-kpi-value">${this.histories.length}</div>
              <div class="soft-kpi-sub">${totalActivos} activos</div>
            </div>
          </div>

          <div class="soft-kpi-card" style="padding: 1rem 1.25rem; min-width: min(100%, 195px);">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.history(20)}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Sesiones SOAP</span>
              <div class="soft-kpi-value">${totalSesiones}</div>
              <div class="soft-kpi-sub">Trazabilidad RN-07</div>
            </div>
          </div>
        </div>
      </div>

      <!-- BARRA DE FILTROS Y BÚSQUEDA -->
      <div class="soft-card-static" style="padding: 1.15rem 1.4rem; margin-bottom: 1.65rem; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem;">
        <div class="soft-search-box" style="flex: 1; min-width: min(100%, 260px);">
          <span class="soft-search-box-icon">
            ${Icons.search(16)}
          </span>
          <input 
            type="text" 
            id="input-search-records" 
            class="soft-input"
            placeholder="Buscar por paciente, CI o código correlativo (ej. PSI-A-0001)..." 
            value="${this.escapeHtml(this.searchQuery)}"
          />
        </div>

        <!-- FILTROS POR ESTADO CLÍNICO -->
        <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
          ${['TODOS', 'ACTIVO', 'EN_EVALUACION', 'ALTA', 'SUSPENDIDO'].map(st => `
            <button 
              type="button" 
              class="btn-filter-status soft-btn soft-btn-sm ${this.filterState === st ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" 
              data-status="${st}"
            >
              <span>${st.replace('_', ' ')}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- LISTADO DE EXPEDIENTES CLÍNICOS -->
      ${this.histories.length === 0 ? `
        <div class="empty-state-card">
          <div class="empty-state-icon">
            ${Icons.folderSearch(34)}
          </div>
          <h3 class="empty-state-title">No se encontraron historias clínicas</h3>
          <p class="empty-state-desc">
            No hay expedientes que coincidan con el filtro actual. Los expedientes se crean automáticamente cuando se admite un paciente.
          </p>
          <a href="#/patients" class="soft-btn soft-btn-lvl-1">
            ${Icons.patient(16, '#FFFFFF')}
            <span>Ir a Gestión de Pacientes</span>
          </a>
        </div>
      ` : `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 1.3rem;">
          ${this.histories.map(h => this.renderHistoryCard(h)).join('')}
        </div>
      `}
    `;

    this.attachMasterEvents();
  }

  renderHistoryCard(h) {
    const age = this.calculateAge(h.paciente_fecha_nacimiento);
    const estadoBadge = this.getStatusBadge(h.estado);

    return `
      <div class="card-history soft-room-card">
        <div>
          <!-- CABECERA DE LA TARJETA -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.85rem;">
            <div>
              <span class="soft-badge soft-badge-lavender" style="font-family: monospace; font-size: 0.78rem; padding: 0.24rem 0.65rem;">
                ${h.numero_expediente}
              </span>
              <div style="font-size: 0.74rem; color: var(--soft-text-muted); margin-top: 0.35rem;">
                Apertura: ${h.fecha_apertura}
              </div>
            </div>
            ${estadoBadge}
          </div>

          <!-- NOMBRE DEL PACIENTE -->
          <h3 style="color: var(--soft-text-title); font-size: 1.14rem; font-weight: 800; margin: 0 0 0.35rem 0; letter-spacing: -0.015em;">
            ${h.paciente_nombres} ${h.paciente_apellidos}
          </h3>
          <div style="display: flex; flex-wrap: wrap; gap: 0.55rem; font-size: 0.8rem; color: var(--soft-text-body); margin-bottom: 0.95rem;">
            <span><strong style="color: var(--soft-text-title);">C.I.:</strong> ${h.paciente_ci}</span>
            <span>&bull;</span>
            <span><strong style="color: var(--soft-text-title);">Edad:</strong> ${age}</span>
            <span>&bull;</span>
            <span><strong style="color: var(--soft-text-title);">Sexo:</strong> ${h.paciente_sexo === 'M' ? 'Masc.' : (h.paciente_sexo === 'F' ? 'Fem.' : 'Otro')}</span>
          </div>

          <!-- TERAPEUTA ASIGNADO -->
          <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.7rem 0.85rem; margin-bottom: 0.95rem; display: flex; align-items: center; gap: 0.7rem;">
            <div class="soft-avatar-sm">
              ${h.terapeuta_nombres ? h.terapeuta_nombres[0] : 'S'}
            </div>
            <div style="min-width: 0; flex: 1;">
              <div style="font-size: 0.83rem; font-weight: 700; color: var(--soft-text-title); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${h.terapeuta_nombres ? `${h.terapeuta_nombres} ${h.terapeuta_apellidos}` : 'Sin terapeuta asignado'}
              </div>
              <div style="font-size: 0.73rem; color: var(--soft-text-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${h.especialidad_nombre || 'Evaluación Interdisciplinaria'} ${h.terapeuta_matricula ? `(${h.terapeuta_matricula})` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- PIE DE TARJETA CON CONTADORES Y ACCIÓN -->
        <div style="border-top: 1px solid var(--soft-divider); padding-top: 0.9rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
            <span class="soft-badge soft-badge-mint" style="padding: 0.25rem 0.6rem; font-size: 0.72rem;">
              ${Icons.history(13)}
              <span>${h.total_sesiones || 0} sesiones</span>
            </span>

            ${h.tiene_anamnesis ? `
              <span class="soft-badge soft-badge-emerald" style="padding: 0.25rem 0.55rem; font-size: 0.71rem;" title="Anamnesis inicial registrada">
                ${Icons.check(12)}
                <span>Anamnesis</span>
              </span>
            ` : `
              <span class="soft-badge soft-badge-amber" style="padding: 0.25rem 0.55rem; font-size: 0.71rem;" title="Anamnesis pendiente">
                ${Icons.alert(12)}
                <span>Pendiente</span>
              </span>
            `}
          </div>

          <button 
            type="button" 
            class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-open-history" 
            data-id="${h.id}"
          >
            <span>Ver Expediente</span>
            ${Icons.chevronRight(14, '#FFFFFF')}
          </button>
        </div>
      </div>
    `;
  }



  renderDetailView() {
    const content = document.getElementById('clinical-records-content');
    if (!content || !this.currentHistory) return;

    const h = this.currentHistory;
    const age = this.calculateAge(h.paciente_fecha_nacimiento);
    const estadoBadge = this.getStatusBadge(h.estado);

    content.innerHTML = `
      <!-- BOTÓN VOLVER Y ACCIÓN PRIMARIA -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem;">
        <button type="button" id="btn-back-to-list" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted">
          <span style="display: inline-flex; transform: rotate(180deg);">${Icons.chevronRight(14, 'currentColor')}</span>
          <span>Volver al Directorio de Expedientes</span>
        </button>

        <div style="display: flex; gap: 0.6rem; align-items: center;">
          <button type="button" id="btn-new-soap" class="soft-btn soft-btn-lvl-1">
            ${Icons.plus(16, '#FFFFFF')}
            <span>Nueva Nota SOAP</span>
          </button>
        </div>
      </div>

      <!-- BANNER DE IDENTIFICACIÓN CLÍNICA DEL PACIENTE -->
      <div class="soft-hero-surface" style="padding: 1.65rem 1.85rem; margin-bottom: 1.5rem;">
        <div style="position: relative; z-index: 1;">
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 1rem;">
            <div style="display: flex; gap: 1.15rem; align-items: center; flex-wrap: wrap;">
              <div class="soft-avatar-lg">
                ${h.paciente_nombres[0]}
              </div>
              <div>
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 0.35rem;">
                  <h2 style="color: var(--soft-text-title); font-size: 1.45rem; font-weight: 800; margin: 0; letter-spacing: -0.02em;">
                    ${h.paciente_nombres} ${h.paciente_apellidos}
                  </h2>
                  <span class="soft-badge soft-badge-lavender" style="font-family: monospace; font-size: 0.8rem;">
                    ${h.numero_expediente}
                  </span>
                  ${estadoBadge}
                  ${this.hasActiveConsent ? `
                    <span class="soft-badge soft-badge-emerald" title="Consentimiento Informado Firmado y Vigente conforme a Ley 548">
                      <span class="soft-status-dot"></span>
                      <span>Consentimiento OK</span>
                    </span>
                  ` : `
                    <span class="soft-badge soft-badge-amber" title="Falta firma legal del tutor para intervenciones y baterías">
                      <span class="soft-status-dot"></span>
                      <span>Consentimiento Pendiente</span>
                    </span>
                  `}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.8rem; font-size: 0.85rem; color: var(--soft-text-body);">
                  <span><strong style="color: var(--soft-text-title);">Cédula:</strong> ${h.paciente_ci}</span>
                  <span>&bull;</span>
                  <span><strong style="color: var(--soft-text-title);">Edad cronológica:</strong> ${age}</span>
                  <span>&bull;</span>
                  <span><strong style="color: var(--soft-text-title);">Ocupación o Colegio:</strong> ${h.paciente_colegio_ocupacion || 'No especificado'}</span>
                </div>
              </div>
            </div>

            <!-- CAMBIADOR DE ESTADO CLÍNICO Y ACCIONES RÁPIDAS -->
            <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
              <button type="button" id="btn-quick-consent-header" class="soft-btn soft-btn-sm ${this.hasActiveConsent ? 'soft-btn-lvl-1-muted' : 'soft-btn-lvl-1'}" title="Captura de firma táctil para consentimiento legal">
                ${Icons.signature(14, this.hasActiveConsent ? 'var(--soft-purple-primary)' : '#FFFFFF')}
                <span>${this.hasActiveConsent ? 'Consentimientos' : 'Firmar Consentimiento'}</span>
              </button>
              <button type="button" id="btn-quick-report-header" class="soft-btn soft-btn-sm soft-btn-lvl-1" title="Redactar Informe Oficial en Word">
                ${Icons.fileWord(14, '#FFFFFF')}
                <span>+ Redactar Informe</span>
              </button>
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <label for="select-history-status" class="soft-kpi-overline" style="margin: 0; padding: 0;">Estado:</label>
                <select id="select-history-status" class="soft-select soft-select-sm" style="width: auto; min-width: 140px; cursor: pointer;">
                  ${['ACTIVO', 'EN_EVALUACION', 'ALTA', 'SUSPENDIDO'].map(st => `
                    <option value="${st}" ${h.estado === st ? 'selected' : ''}>${st.replace('_', ' ')}</option>
                  `).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- RESUMEN MÉDICO RÁPIDO -->
          <div style="margin-top: 1.25rem; padding-top: 1.1rem; border-top: 1px solid var(--soft-divider); display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1.1rem; font-size: 0.82rem;">
            <div>
              <span style="color: var(--soft-text-overline); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; display: block; margin-bottom: 0.2rem;">Especialista de Cabecera</span>
              <span style="color: var(--soft-text-title); font-weight: 700; font-size: 0.86rem;">
                ${h.terapeuta_nombres ? `${h.terapeuta_nombres} ${h.terapeuta_apellidos}` : 'No asignado'}
              </span>
              <div style="font-size: 0.75rem; color: var(--soft-text-body); margin-top: 0.1rem;">${h.especialidad_nombre || ''}</div>
            </div>

            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.2rem;">
                <span style="color: var(--soft-text-overline); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em;">Tutor Principal</span>
                <button type="button" id="btn-quick-manage-tutor" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="font-size: 0.72rem; padding: 0.2rem 0.6rem; border-radius: 9px; gap: 0.3rem;">
                  ${Icons.family(12)}
                  <span>${h.tutor_principal ? 'Gestionar' : '+ Vincular'}</span>
                </button>
              </div>
              <span style="color: var(--soft-text-title); font-weight: 700; font-size: 0.86rem; display: block;">
                ${h.tutor_principal ? `${this.escapeHtml(h.tutor_principal.nombres)} ${this.escapeHtml(h.tutor_principal.apellidos)} (${this.escapeHtml(h.tutor_principal.parentesco || 'TUTOR')})` : 'Sin tutor vinculado'}
              </span>
              <div style="font-size: 0.75rem; color: var(--soft-text-body); display: flex; align-items: center; gap: 0.4rem; margin-top: 0.2rem; flex-wrap: wrap;">
                <span>${h.tutor_principal ? this.escapeHtml(h.tutor_principal.whatsapp) : 'No podrá consultar seguimiento familiar hasta ser vinculado'}</span>
                ${h.tutor_principal && h.tutor_principal.usuario_email ? `
                  <span class="soft-badge soft-badge-emerald" style="font-size: 0.66rem; padding: 0.14rem 0.5rem;">Cuenta web activa</span>
                ` : (h.tutor_principal ? `
                  <span class="soft-badge soft-badge-slate" style="font-size: 0.66rem; padding: 0.14rem 0.5rem;">Sin cuenta web aún</span>
                ` : '')}
              </div>
            </div>

            <div>
              <span style="color: var(--soft-text-overline); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; display: block; margin-bottom: 0.2rem;">Alergias / Antecedentes Médicos</span>
              <span style="color: var(--soft-text-title); font-weight: 600; font-size: 0.84rem; line-height: 1.4;">
                ${h.paciente_antecedentes_medicos || 'Sin antecedentes patológicos declarados'}
              </span>
            </div>

            <div>
              <span style="color: var(--soft-text-overline); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; display: block; margin-bottom: 0.2rem;">Medicación Actual</span>
              <span style="color: var(--soft-text-title); font-weight: 600; font-size: 0.84rem; line-height: 1.4;">
                ${h.paciente_medicacion_actual || 'Ninguna'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- PESTAÑAS DE NAVEGACIÓN DEL EXPEDIENTE (CON PROTECCIÓN ANTI-RECORTE SEGÚN DESIGN_RULES.MD) -->
      <div class="tabs-scroll-container" style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 18px; padding: 10px 10px 14px 10px !important; margin: 0 0 1.5rem 0; display: flex; flex-wrap: nowrap; overflow-x: auto; gap: 0.55rem;">
        <button 
          type="button" 
          class="tab-btn soft-btn soft-btn-sm ${this.activeTab === 'soap' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" 
          data-tab="soap"
        >
          ${Icons.history(16)}
          <span>Notas SOAP</span>
          <span style="background: ${this.activeTab === 'soap' ? 'rgba(255, 255, 255, 0.24)' : 'rgba(88, 66, 148, 0.12)'}; color: ${this.activeTab === 'soap' ? '#FFFFFF' : 'var(--soft-purple-primary)'}; font-size: 0.71rem; font-weight: 800; padding: 0.1rem 0.48rem; border-radius: 9999px;">${this.soapNotes.length}</span>
        </button>

        <button 
          type="button" 
          class="tab-btn soft-btn soft-btn-sm ${this.activeTab === 'anamnesis' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" 
          data-tab="anamnesis"
        >
          ${Icons.fileText(16)}
          <span>Anamnesis</span>
          ${this.anamnesis ? `
            <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--soft-emerald); box-shadow: 0 0 0 2px ${this.activeTab === 'anamnesis' ? 'rgba(255, 255, 255, 0.35)' : 'rgba(16, 185, 129, 0.2)'};"></span>
          ` : `
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B; box-shadow: 0 0 0 2px ${this.activeTab === 'anamnesis' ? 'rgba(255, 255, 255, 0.35)' : 'rgba(245, 158, 11, 0.22)'};"></span>
          `}
        </button>

        <button 
          type="button" 
          class="tab-btn soft-btn soft-btn-sm ${this.activeTab === 'plans' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" 
          data-tab="plans"
        >
          ${Icons.target(16)}
          <span>Planes PTI & Metas</span>
          <span style="background: ${this.activeTab === 'plans' ? 'rgba(255, 255, 255, 0.24)' : 'rgba(88, 66, 148, 0.12)'}; color: ${this.activeTab === 'plans' ? '#FFFFFF' : 'var(--soft-purple-primary)'}; font-size: 0.71rem; font-weight: 800; padding: 0.1rem 0.48rem; border-radius: 9999px;">${this.plans.length}</span>
        </button>

        <button 
          type="button" 
          class="tab-btn soft-btn soft-btn-sm ${this.activeTab === 'folders' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" 
          data-tab="folders"
        >
          ${Icons.folder(16)}
          <span>Estudios & Carpetas</span>
          <span style="background: ${this.activeTab === 'folders' ? 'rgba(255, 255, 255, 0.24)' : 'rgba(88, 66, 148, 0.12)'}; color: ${this.activeTab === 'folders' ? '#FFFFFF' : 'var(--soft-purple-primary)'}; font-size: 0.71rem; font-weight: 800; padding: 0.1rem 0.48rem; border-radius: 9999px;">${this.documents.length}</span>
        </button>

        <!-- SPRINT 9.5: HU-13 CONSENTIMIENTOS & FIRMA DIGITAL -->
        <button 
          type="button" 
          class="tab-btn soft-btn soft-btn-sm ${this.activeTab === 'consents' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" 
          data-tab="consents"
        >
          ${Icons.signature(16, this.activeTab === 'consents' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
          <span>Consentimiento & Firma</span>
          <span style="background: ${this.activeTab === 'consents' ? 'rgba(255, 255, 255, 0.24)' : 'rgba(88, 66, 148, 0.12)'}; color: ${this.activeTab === 'consents' ? '#FFFFFF' : 'var(--soft-purple-primary)'}; font-size: 0.71rem; font-weight: 800; padding: 0.1rem 0.48rem; border-radius: 9999px;">${this.consents.length}</span>
        </button>

        <!-- HU-14 INFORMES CLÍNICOS OFICIALES Y DEVOLUCIONES -->
        <button 
          type="button" 
          class="tab-btn soft-btn soft-btn-sm ${this.activeTab === 'reports' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" 
          data-tab="reports"
        >
          ${Icons.fileWord(16, this.activeTab === 'reports' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
          <span>Informes Oficiales</span>
          <span style="background: ${this.activeTab === 'reports' ? 'rgba(255, 255, 255, 0.24)' : 'rgba(88, 66, 148, 0.12)'}; color: ${this.activeTab === 'reports' ? '#FFFFFF' : 'var(--soft-purple-primary)'}; font-size: 0.71rem; font-weight: 800; padding: 0.1rem 0.48rem; border-radius: 9999px;">${this.reports.length}</span>
        </button>

        <button 
          type="button" 
          class="tab-btn soft-btn soft-btn-sm ${this.activeTab === 'patient_info' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" 
          data-tab="patient_info"
        >
          ${Icons.patient(16)}
          <span>Ficha & Antecedentes</span>
        </button>
      </div>

      <!-- CONTENIDO DE LA PESTAÑA ACTIVA -->
      <div id="tab-content-area">
        ${this.activeTab === 'soap' ? this.renderSoapTab() : ''}
        ${this.activeTab === 'anamnesis' ? this.renderAnamnesisTab() : ''}
        ${this.activeTab === 'plans' ? this.renderPlansTab() : ''}
        ${this.activeTab === 'folders' ? this.renderFoldersTab() : ''}
        ${this.activeTab === 'consents' ? this.renderConsentsTab() : ''}
        ${this.activeTab === 'reports' ? this.renderReportsTab() : ''}
        ${this.activeTab === 'patient_info' ? this.renderPatientInfoTab() : ''}
      </div>
    `;

    this.attachDetailEvents();
  }

  renderSoapTab() {
    if (this.soapNotes.length === 0) {
      return `
        <div class="empty-state-card">
          <div class="empty-state-icon">
            ${Icons.history(32)}
          </div>
          <h3 class="empty-state-title">Sin notas de evolución registradas</h3>
          <p class="empty-state-desc">
            Aún no se han documentado sesiones para este expediente. Comienza registrando la primera sesión en formato estructurado SOAP.
          </p>
          <button type="button" class="soft-btn soft-btn-lvl-1 btn-launch-soap-modal">
            ${Icons.plus(16, '#FFFFFF')}
            <span>Registrar Primera Nota SOAP</span>
          </button>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 1.1rem;">
        ${!this.hasActiveConsent ? `
          <div class="soft-subcard" style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.35); padding: 1.1rem 1.35rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.85rem;">
              <div class="soft-icon-box soft-icon-box-sm" style="background: rgba(245, 158, 11, 0.18); color: #B45309;">
                ${Icons.alertTriangle(18)}
              </div>
              <div>
                <strong style="color: #92400E; font-size: 0.92rem; display: block;">Advertencia Regulatoria Institucional</strong>
                <span style="color: #78350F; font-size: 0.82rem;">Este expediente aún no cuenta con Consentimiento Informado firmado por el tutor legal.</span>
              </div>
            </div>
            <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-open-consent-from-alert">
              ${Icons.signature(14, '#FFFFFF')}
              <span>Firmar Consentimiento Táctil</span>
            </button>
          </div>
        ` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 0.86rem; color: var(--soft-text-body);">
            Mostrando <strong style="color: var(--soft-text-title);">${this.soapNotes.length}</strong> sesiones terapéuticas consecutivas registradas en el expediente.
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 1.2rem;">
          ${this.soapNotes.map(n => `
            <div class="soap-session-summary-card soft-room-card">
              
              <div>
                <!-- ENCABEZADO SESIÓN -->
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 0.8rem;">
                  <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                    <span class="soft-badge soft-badge-lavender" style="font-weight: 800;">
                      SESIÓN #${n.numero_sesion}
                    </span>
                    <span class="soft-badge soft-badge-mint" style="padding: 0.24rem 0.6rem; font-size: 0.7rem;">
                      Consecutiva
                    </span>
                  </div>

                  <span class="soft-badge soft-badge-indigo" style="padding: 0.24rem 0.6rem; font-size: 0.7rem;" title="Registro inalterable por normativa RN-07">
                    ${Icons.shield(12)}
                    <span>RN-07</span>
                  </span>
                </div>

                <!-- FECHA Y HORARIO -->
                <div style="font-size: 0.9rem; font-weight: 800; color: var(--soft-text-title); margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                  <span>${n.fecha_sesion}</span>
                  ${n.hora_inicio ? `
                    <span style="font-weight: 500; font-size: 0.8rem; color: var(--soft-text-muted);">
                      (${n.hora_inicio} ${n.hora_fin ? `- ${n.hora_fin}` : ''})
                    </span>
                  ` : ''}
                </div>

                <!-- AMBIENTE / CONSULTORIO -->
                <div style="font-size: 0.79rem; color: var(--soft-text-body); margin-bottom: 0.7rem;">
                  ${n.ambiente_nombre ? `Sala: <strong style="color: var(--soft-text-title);">${n.ambiente_nombre}</strong>` : 'Atención en Consultorio'}
                </div>

                <!-- DIAGNÓSTICO O MOTIVO -->
                ${n.diagnostico_codigo ? `
                  <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.48rem 0.72rem; font-size: 0.76rem; color: var(--soft-purple-primary); font-weight: 700; margin-bottom: 0.75rem;">
                    Diagnóstico: ${n.diagnostico_codigo} ${n.diagnostico_glosa ? `- ${n.diagnostico_glosa}` : ''}
                  </div>
                ` : ''}

                <!-- EXTRACTO SÍNTESIS CLÍNICA -->
                <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.7rem 0.85rem; margin-bottom: 0.9rem; font-size: 0.81rem; color: var(--soft-text-body); line-height: 1.48;">
                  <strong style="color: var(--soft-text-overline); display: block; margin-bottom: 0.2rem; font-size: 0.69rem; text-transform: uppercase; letter-spacing: 0.04em;">Apreciación Clínica</strong>
                  ${this.escapeHtml(n.analisis ? (n.analisis.length > 130 ? n.analisis.substring(0, 130) + '...' : n.analisis) : 'Sesión documentada en formato SOAP.')}
                </div>
              </div>

              <!-- PIE DE TARJETA CON ESPECIALISTA Y BOTÓN EMERGENTE -->
              <div style="border-top: 1px solid var(--soft-divider); padding-top: 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                <div style="min-width: 0; font-size: 0.75rem; color: var(--soft-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${n.asistido_por_ia ? `<span style="color: var(--soft-mint-deep); font-weight: 700;">IA · </span>` : ''}
                  ${n.firma_digital_snapshot || `${n.terapeuta_nombres} ${n.terapeuta_apellidos}`}
                </div>

                <button 
                  type="button" 
                  class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-view-soap-popup" 
                  data-note-id="${n.id}"
                >
                  ${Icons.fileText(14, '#FFFFFF')}
                  <span>Ver Nota SOAP</span>
                </button>
              </div>

            </div>
          `).join('')}
        </div>
      </div>
    `;
  }



  renderAnamnesisTab() {
    const a = this.anamnesis || {};

    return `
      <div class="soft-section-card clinical-folders-card" style="padding: 1.85rem; max-width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 0.95rem; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 style="color: var(--soft-text-title); font-size: 1.22rem; font-weight: 800; margin: 0; letter-spacing: -0.015em;">
              Formulario Estructurado de Anamnesis / Evaluación Inicial
            </h3>
            <p style="color: var(--soft-text-body); font-size: 0.85rem; margin: 0.25rem 0 0 0;">
              Levantamiento riguroso de antecedentes médicos, desarrollo y dinámica sociofamiliar para el expediente.
            </p>
          </div>

          ${a.fecha_evaluacion ? `
            <div class="soft-subcard" style="padding: 0.55rem 0.85rem; background: var(--soft-lavender-surface); text-align: right; font-size: 0.76rem; color: var(--soft-text-body);">
              <div>Evaluación registrada: <strong style="color: var(--soft-text-title);">${a.fecha_evaluacion}</strong></div>
              <div>Evaluador: <strong style="color: var(--soft-purple-primary);">${a.evaluador_nombre || 'Especialista'}</strong></div>
            </div>
          ` : ''}
        </div>

        <form id="form-anamnesis" style="display: flex; flex-direction: column; gap: 1.2rem;">
          
          <!-- 1. MOTIVO DE CONSULTA -->
          <div>
            <label class="soft-label">
              1. Motivo de Consulta Principal *
            </label>
            <textarea 
              name="motivoConsulta" 
              required
              rows="3" 
              class="soft-textarea"
              placeholder="Describa la queja principal manifestada por la familia, escuela o paciente..."
            >${this.escapeHtml(a.motivo_consulta || '')}</textarea>
          </div>

          <!-- 2. HISTORIA DEL PROBLEMA ACTUAL -->
          <div>
            <label class="soft-label">
              2. Historia del Problema Actual y Sintomatología Evolutiva
            </label>
            <textarea 
              name="historiaProblemaActual" 
              rows="3" 
              class="soft-textarea"
              placeholder="Evolución temporal de la conducta, cuándo comenzó, factores desencadenantes..."
            >${this.escapeHtml(a.historia_problema_actual || '')}</textarea>
          </div>

          <!-- 3. ANTECEDENTES PERINATALES Y DEL DESARROLLO -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1rem;">
            <div>
              <label class="soft-label">
                3. Antecedentes Perinatales y Gestación
              </label>
              <textarea 
                name="antecedentesPerinatales" 
                rows="3" 
                class="soft-textarea"
                placeholder="Semanas de gestación, tipo de parto, peso al nacer, APGAR, complicaciones neonatales..."
              >${this.escapeHtml(a.antecedentes_perinatales || this.currentHistory.paciente_antecedentes_perinatales || '')}</textarea>
            </div>

            <div>
              <label class="soft-label">
                4. Hitos de Desarrollo Motor y del Lenguaje
              </label>
              <textarea 
                name="desarrolloMotorLenguaje" 
                rows="3" 
                class="soft-textarea"
                placeholder="Marcha, primeras palabras, control de esfínteres, coordinación psicomotriz..."
              >${this.escapeHtml(a.desarrollo_motor_lenguaje || '')}</textarea>
            </div>
          </div>

          <!-- 5. ANTECEDENTES MÉDICOS Y FAMILIARES -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1rem;">
            <div>
              <label class="soft-label">
                5. Antecedentes Médicos y Patológicos
              </label>
              <textarea 
                name="antecedentesMedicos" 
                rows="2" 
                class="soft-textarea"
                placeholder="Enfermedades crónicas, traumatismos, alergias, medicación..."
              >${this.escapeHtml(a.antecedentes_medicos || this.currentHistory.paciente_antecedentes_medicos || '')}</textarea>
            </div>

            <div>
              <label class="soft-label">
                6. Antecedentes Familiares Relevantes
              </label>
              <textarea 
                name="antecedentesFamiliares" 
                rows="2" 
                class="soft-textarea"
                placeholder="Historial familiar de dificultades de aprendizaje, déficit atencional, demencias..."
              >${this.escapeHtml(a.antecedentes_familiares || '')}</textarea>
            </div>
          </div>

          <!-- 7. DINÁMICA ESCOLAR Y FAMILIAR -->
          <div>
            <label class="soft-label">
              7. Dinámica Familiar y Rendimiento Escolar / Ocupacional
            </label>
            <textarea 
              name="dinamicaFamiliarEscolar" 
              rows="2" 
              class="soft-textarea"
              placeholder="Relación con los padres/hermanos, adaptación al aula, llamadas de atención..."
            >${this.escapeHtml(a.dinamica_familiar_escolar || '')}</textarea>
          </div>

          <!-- 8. EXPLORACIÓN COGNITIVA Y CONDUCTUAL -->
          <div>
            <label class="soft-label">
              8. Exploración Preliminar de Funciones Neurocognitivas y Conducta
            </label>
            <textarea 
              name="exploracionCognitivaConductual" 
              rows="3" 
              class="soft-textarea"
              placeholder="Atención, lenguaje expresivo/receptivo, memoria, control de impulsos, estado anímico en sesión..."
            >${this.escapeHtml(a.exploracion_cognitiva_conductual || '')}</textarea>
          </div>

          <!-- 9. IMPRESIÓN DIAGNÓSTICA PRELIMINAR -->
          <div>
            <label class="soft-label">
              9. Impresión Diagnóstica Inicial (Hipótesis de Trabajo)
            </label>
            <textarea 
              name="impresionDiagnosticaInicial" 
              rows="2" 
              class="soft-textarea"
              placeholder="Hipótesis clínica basada en los criterios nosológicos CIE-11 / DSM-5..."
            >${this.escapeHtml(a.impresion_diagnostica_inicial || '')}</textarea>
          </div>

          <div style="border-top: 1px solid var(--soft-divider); padding-top: 1.25rem; display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="submit" class="soft-btn soft-btn-lvl-1">
              ${Icons.check(16, '#FFFFFF')}
              <span>Guardar Evaluación de Anamnesis</span>
            </button>
          </div>

        </form>
      </div>
    `;
  }

  renderPatientInfoTab() {
    const h = this.currentHistory;
    return `
      <div class="soft-section-card clinical-folders-card" style="padding: 1.85rem; max-width: 100%;">
        <h3 style="color: var(--soft-text-title); font-size: 1.22rem; font-weight: 800; margin: 0 0 1.15rem 0; letter-spacing: -0.015em;">
          Ficha de Filiación & Entorno Familiar
        </h3>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1.25rem;">
          <div class="soft-subcard" style="background: var(--soft-lavender-surface); padding: 1.15rem 1.25rem;">
            <div style="font-size: 0.74rem; font-weight: 800; color: var(--soft-purple-primary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.65rem;">Datos del Paciente</div>
            <div style="font-size: 0.87rem; line-height: 1.65; color: var(--soft-text-body);">
              <div><strong style="color: var(--soft-text-title);">Nombres:</strong> ${h.paciente_nombres} ${h.paciente_apellidos}</div>
              <div><strong style="color: var(--soft-text-title);">Cédula de Identidad:</strong> ${h.paciente_ci}</div>
              <div><strong style="color: var(--soft-text-title);">Fecha de Nacimiento:</strong> ${h.paciente_fecha_nacimiento}</div>
              <div><strong style="color: var(--soft-text-title);">Edad:</strong> ${this.calculateAge(h.paciente_fecha_nacimiento)}</div>
              <div><strong style="color: var(--soft-text-title);">Sexo:</strong> ${h.paciente_sexo === 'M' ? 'Masculino' : (h.paciente_sexo === 'F' ? 'Femenino' : 'Otro')}</div>
              <div><strong style="color: var(--soft-text-title);">Colegio / Ocupación:</strong> ${h.paciente_colegio_ocupacion || 'No registrado'}</div>
            </div>
          </div>

          <div class="soft-subcard" style="background: var(--soft-lavender-surface); padding: 1.15rem 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; gap: 0.5rem; flex-wrap: wrap;">
              <div style="font-size: 0.74rem; font-weight: 800; color: var(--soft-mint-deep); text-transform: uppercase; letter-spacing: 0.04em;">
                Tutor Legal & Vinculación Portal
              </div>
              <button type="button" id="btn-manage-tutor-tab" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="padding: 0.28rem 0.65rem; font-size: 0.74rem;">
                ${Icons.family(13, 'var(--soft-purple-primary)')}
                <span>${h.tutor_principal ? 'Gestionar / Cambiar' : '+ Vincular Tutor'}</span>
              </button>
            </div>
            ${h.tutor_principal ? `
              <div style="font-size: 0.87rem; line-height: 1.65; color: var(--soft-text-body);">
                <div><strong style="color: var(--soft-text-title);">Nombre:</strong> ${this.escapeHtml(h.tutor_principal.nombres)} ${this.escapeHtml(h.tutor_principal.apellidos)}</div>
                <div><strong style="color: var(--soft-text-title);">Parentesco:</strong> ${this.escapeHtml(h.tutor_principal.parentesco || 'TUTOR')}</div>
                <div><strong style="color: var(--soft-text-title);">C.I.:</strong> ${this.escapeHtml(h.tutor_principal.ci || 'No registrado')}</div>
                <div><strong style="color: var(--soft-text-title);">WhatsApp / Tel:</strong> ${this.escapeHtml(h.tutor_principal.whatsapp || 'No registrado')}</div>
                <div><strong style="color: var(--soft-text-title);">Correo Electrónico:</strong> ${this.escapeHtml(h.tutor_principal.email || h.tutor_principal.usuario_email || 'No registrado')}</div>
                <div class="soft-subcard" style="margin-top: 0.75rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; background: #FFFFFF; padding: 0.6rem 0.85rem;">
                  <div style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.78rem;">
                    ${h.tutor_principal.usuario_email ? `
                      <span class="soft-badge soft-badge-emerald">
                        <span class="soft-status-dot"></span>
                        <span>Tiene acceso al Portal Familiar (${this.escapeHtml(h.tutor_principal.usuario_email)})</span>
                      </span>
                    ` : `
                      <span style="color: var(--soft-text-muted); font-weight: 600;">
                        Sin cuenta web activa. El tutor puede auto-registrarse en la web con este correo/teléfono para consultar este expediente.
                      </span>
                    `}
                  </div>
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-unlink-tutor" data-tutor-id="${h.tutor_principal.id}" data-tutor-name="${this.escapeHtml(h.tutor_principal.nombres + ' ' + h.tutor_principal.apellidos)}" style="padding: 0.25rem 0.6rem; font-size: 0.73rem;">
                    ${Icons.trash(12, '#B91C1C')}
                    <span>Desvincular</span>
                  </button>
                </div>
              </div>
            ` : `
              <div style="font-size: 0.85rem; color: var(--soft-text-muted); padding: 0.5rem 0;">
                Sin tutor legal vinculado en la ficha de filiación. El tutor no podrá consultar el progreso clínico desde el portal familiar.
              </div>
              <button type="button" id="btn-bind-tutor-empty" class="soft-btn soft-btn-sm soft-btn-lvl-1" style="margin-top: 0.35rem;">
                ${Icons.family(14, '#FFFFFF')}
                <span>Buscar y Vincular Tutor</span>
              </button>
            `}
          </div>
        </div>

        <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
          <a href="#/patients" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="text-decoration: none;">
            ${Icons.edit(14, 'var(--soft-purple-primary)')}
            <span>Editar Datos del Paciente en Filiación</span>
          </a>
        </div>
      </div>
    `;
  }



  // =========================================================================
  // SPRINT 5: PESTAÑA DE PLANES TERAPÉUTICOS (PTI) Y METAS SMART (HU-09)
  // =========================================================================

  renderPlansTab() {
    const plans = this.plans || [];
    return `
      <div class="soft-section-card clinical-folders-card" style="padding: 1.85rem; max-width: 100%;">
        <!-- CABECERA DE LA PESTAÑA DE PLANES -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="color: var(--soft-text-title); font-size: 1.22rem; font-weight: 800; margin: 0 0 0.35rem 0; display: flex; align-items: center; gap: 0.5rem; letter-spacing: -0.015em;">
              ${Icons.target(20, 'var(--soft-purple-primary)')}
              <span>Planes Terapéuticos Individualizados PTI & Metas SMART</span>
            </h3>
            <p style="color: var(--soft-text-body); font-size: 0.86rem; margin: 0;">
              Formulación de objetivos clínicos medibles con porcentaje de logro por sesión y pautas ecológicas para el hogar.
            </p>
          </div>
          <button type="button" id="btn-open-new-plan-modal" class="soft-btn soft-btn-lvl-1">
            ${Icons.plus(16, '#FFFFFF')}
            <span>Nuevo Plan PTI</span>
          </button>
        </div>

        ${plans.length === 0 ? `
          <div class="soft-subcard" style="background: var(--soft-lavender-surface); border-style: dashed; padding: 3rem 1.5rem; text-align: center;">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1rem auto;">
              ${Icons.target(30, 'var(--soft-purple-primary)')}
            </div>
            <h4 style="color: var(--soft-text-title); font-size: 1.1rem; font-weight: 800; margin: 0 0 0.4rem 0;">Sin planes de intervención activos</h4>
            <p style="color: var(--soft-text-body); font-size: 0.86rem; max-width: 480px; margin: 0 auto 1.35rem auto; line-height: 1.55;">
              Formula un Plan Terapéutico Individualizado (PTI) asociado al diagnóstico nosológico CIE-11 / DSM-5 para registrar y medir cuantitativamente las metas SMART del paciente.
            </p>
            <button type="button" class="soft-btn soft-btn-lvl-1 btn-launch-new-plan">
              ${Icons.plus(16, '#FFFFFF')}
              <span>Formular Primer Plan PTI</span>
            </button>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 1.35rem;">
            ${plans.map(plan => this.renderPlanCard(plan)).join('')}
          </div>
        `}
      </div>
    `;
  }

  renderPlanCard(plan) {
    const isActivo = plan.estado === 'ACTIVO';
    const statusBadgeClass = plan.estado === 'ACTIVO' ? 'soft-badge-emerald' : (plan.estado === 'CUMPLIDO' ? 'soft-badge-mint' : 'soft-badge-amber');
    const metas = plan.metas || [];
    const avgProgress = plan.progreso_promedio !== null && plan.progreso_promedio !== undefined ? plan.progreso_promedio : 0;

    return `
      <div class="soft-subcard plan-card" style="background: #FFFFFF; padding: 1.45rem;">
        <!-- CABECERA DEL PLAN -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.05rem; flex-wrap: wrap; gap: 0.85rem;">
          <div style="flex: 1; min-width: min(100%, 280px);">
            <div style="display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; margin-bottom: 0.45rem;">
              <span class="soft-badge ${statusBadgeClass}">
                <span class="soft-status-dot"></span>
                <span>${plan.estado}</span>
              </span>
              ${plan.diagnostico_codigo ? `
                <span class="soft-badge soft-badge-lavender">
                  ${Icons.stethoscope(13, 'var(--soft-purple-primary)')}
                  <span>${plan.diagnostico_codigo} ${plan.diagnostico_glosa ? `· ${plan.diagnostico_glosa}` : ''}</span>
                </span>
              ` : ''}
              <span style="font-size: 0.78rem; color: var(--soft-text-muted);">
                Vigencia: ${plan.periodicidad_meses} meses (Inicio: ${plan.fecha_inicio} ${plan.fecha_revision ? `· Revisión: ${plan.fecha_revision}` : ''})
              </span>
            </div>
            <h4 style="color: var(--soft-text-title); font-size: 1.12rem; font-weight: 800; margin: 0 0 0.35rem 0; letter-spacing: -0.015em;">
              ${plan.titulo}
            </h4>
            <p style="color: var(--soft-text-body); font-size: 0.87rem; line-height: 1.5; margin: 0 0 0.4rem 0;">
              <strong style="color: var(--soft-text-title);">Objetivo General:</strong> ${plan.objetivo_general}
            </p>
          </div>

          <!-- BOTONES DE ACCIÓN DEL PLAN -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            ${isActivo ? `
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-add-goal" data-plan-id="${plan.id}">
                ${Icons.plus(14, '#FFFFFF')}
                <span>Agregar Meta SMART</span>
              </button>
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-close-plan" data-plan-id="${plan.id}" data-plan-title="${encodeURIComponent(plan.titulo)}">
                ${Icons.check(14, 'var(--soft-purple-primary)')}
                <span>Finalizar Plan</span>
              </button>
            ` : `
              <span style="font-size: 0.8rem; color: var(--soft-text-muted); font-style: italic;">
                Plan archivado: ${plan.motivo_cierre || 'Concluido formalmente'}
              </span>
            `}
          </div>
        </div>

        <!-- BARRA DE PROGRESO GLOBAL DEL PLAN -->
        <div class="soft-subcard" style="background: var(--soft-lavender-surface); padding: 0.85rem 1.05rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; font-size: 0.82rem;">
            <span style="font-weight: 700; color: var(--soft-text-title);">Logro Promedio del Plan Terapéutico</span>
            <span style="font-weight: 800; color: var(--soft-purple-primary); font-size: 0.95rem;">${avgProgress}%</span>
          </div>
          <div style="width: 100%; height: 10px; background: rgba(88, 66, 148, 0.1); border-radius: 9999px; overflow: hidden;">
            <div style="width: ${avgProgress}%; height: 100%; background: linear-gradient(90deg, #584294 0%, #3BB5A8 100%); border-radius: 9999px; transition: width 0.4s ease;"></div>
          </div>
          ${plan.recomendaciones_familia ? `
            <div style="margin-top: 0.65rem; font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.45;">
              <strong style="color: var(--soft-mint-deep);">Pautas para la Familia:</strong> ${plan.recomendaciones_familia}
            </div>
          ` : ''}
        </div>

        <!-- LISTA DE METAS SMART -->
        <div style="margin-top: 1rem;">
          <div style="font-size: 0.82rem; font-weight: 800; color: var(--soft-text-title); text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.04em; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span>Metas Terapéuticas SMART</span>
              <span class="soft-badge soft-badge-lavender">${metas.length}</span>
            </div>
            <span style="font-size: 0.76rem; color: var(--soft-text-muted); font-weight: 600; text-transform: none; letter-spacing: 0;">Escala cuantitativa: 0%, 25%, 50%, 75%, 100%</span>
          </div>

          ${metas.length === 0 ? `
            <div class="soft-subcard" style="text-align: center; padding: 1.5rem; background: var(--soft-lavender-surface); font-size: 0.85rem; color: var(--soft-text-muted);">
              Este plan aún no tiene metas SMART formuladas. Presiona "Agregar Meta SMART" para definir objetivos medibles.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
              ${metas.map((meta, idx) => this.renderMetaItem(meta, plan, idx + 1)).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }



  renderMetaItem(meta, plan, num) {
    const isActivo = plan.estado === 'ACTIVO';
    const pct = meta.porcentaje_logro || 0;
    const percentages = [0, 25, 50, 75, 100];
    const metaCheckins = (this.familyCheckins || []).filter(c => Number(c.meta_id) === Number(meta.id));
    const checkinCount = metaCheckins.length;

    const areaLabels = {
      'ATENCION_CONCENTRACION': 'Atención y Concentración',
      'FUNCIONES_EJECUTIVAS': 'Funciones Ejecutivas',
      'MEMORIA': 'Memoria Neurocognitiva',
      'LECTOESCRITURA': 'Lectoescritura / Lenguaje Escrito',
      'CALCULO_LOGICO': 'Cálculo y Razonamiento Lógico',
      'LENGUAJE_COMUNICACION': 'Lenguaje y Habla',
      'REGULACION_CONDUCTUAL': 'Autorregulación y Conducta',
      'SOCIOEMOCIONAL': 'Área Socioemocional',
      'PSICOMOTRICIDAD': 'Psicomotricidad y Coordinación'
    };
    const areaName = areaLabels[meta.area_intervencion] || meta.area_intervencion;

    return `
      <div class="soft-subcard" style="background: #FFFFFF; padding: 1.05rem 1.15rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.9rem; flex-wrap: wrap;">
          <div style="flex: 1; min-width: min(100%, 260px);">
            <div style="display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.4rem; flex-wrap: wrap;">
              <span class="soft-badge soft-badge-lavender">
                Meta #${num}
              </span>
              <span class="soft-badge soft-badge-mint">
                ${areaName}
              </span>
              <span class="soft-badge ${pct === 100 ? 'soft-badge-emerald' : (pct > 0 ? 'soft-badge-lavender' : 'soft-badge-slate')}">
                ${pct === 100 ? 'Consolidada' : (pct > 0 ? 'En Proceso' : 'Pendiente')}
              </span>
            </div>

            <div style="font-size: 0.92rem; font-weight: 700; color: var(--soft-text-title); line-height: 1.45; margin-bottom: 0.35rem;">
              ${meta.descripcion_meta}
            </div>

            <div style="font-size: 0.82rem; color: var(--soft-text-body); margin-bottom: 0.4rem;">
              <strong style="color: var(--soft-text-title);">Criterio de Éxito:</strong> ${meta.criterio_exito}
            </div>

            ${meta.pautas_hogar ? `
              <div class="soft-subcard" style="background: var(--soft-mint-bg); border-color: var(--soft-mint-border); padding: 0.45rem 0.7rem; font-size: 0.8rem; color: var(--soft-text-title); margin-top: 0.45rem;">
                <strong style="color: var(--soft-mint-deep);">Pauta para el Hogar:</strong> ${meta.pautas_hogar}
              </div>
            ` : ''}
          </div>

          <!-- SELECTOR INTERACTIVO DE AVANCE SMART -->
          <div style="min-width: min(100%, 235px); text-align: right;">
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--soft-text-body); margin-bottom: 0.4rem;">
              Avance Actual: <strong style="color: var(--soft-purple-primary); font-size: 0.95rem;">${pct}%</strong>
            </div>

            <!-- BOTONES CUANTITATIVOS 0-100% -->
            <div style="display: inline-flex; gap: 0.3rem; flex-wrap: wrap; justify-content: flex-end;">
              ${percentages.map(val => `
                <button 
                  type="button" 
                  class="soft-btn soft-btn-sm ${pct === val ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'} btn-pct-step" 
                  data-meta-id="${meta.id}" 
                  data-target-pct="${val}"
                  ${!isActivo ? 'disabled' : ''}
                  style="padding: 0.28rem 0.54rem; font-size: 0.74rem; border-radius: 9px;"
                  title="Actualizar logro a ${val}%"
                >
                  ${val}%
                </button>
              `).join('')}
            </div>

            <div style="margin-top: 0.7rem; display: flex; justify-content: flex-end; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
              <button 
                type="button" 
                class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-view-tutor-meta-checkins" 
                data-meta-id="${meta.id}" 
                data-meta-desc="${encodeURIComponent(meta.descripcion_meta)}"
                style="padding: 0.26rem 0.65rem; font-size: 0.73rem;"
                title="Ver reportes y observaciones registradas por el tutor en casa para esta meta"
              >
                ${Icons.family(13, 'var(--soft-purple-primary)')}
                <span>Reportes del Tutor</span>
                <span style="background: rgba(88, 66, 148, 0.14); color: var(--soft-purple-primary); font-size: 0.68rem; padding: 0.05rem 0.42rem; border-radius: 9999px; font-weight: 800;">${checkinCount}</span>
              </button>

              <button 
                type="button" 
                class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-view-goal-history" 
                data-meta-id="${meta.id}" 
                data-meta-desc="${encodeURIComponent(meta.descripcion_meta)}"
                style="padding: 0.26rem 0.65rem; font-size: 0.73rem;"
                title="Ver historial de evaluaciones y porcentaje clínico"
              >
                ${Icons.history(13, 'var(--soft-purple-primary)')}
                <span>Historial</span>
                <span style="background: rgba(88, 66, 148, 0.14); color: var(--soft-purple-primary); font-size: 0.68rem; padding: 0.05rem 0.4rem; border-radius: 9999px; font-weight: 800;">${meta.total_revisiones || 0}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }



  // =========================================================================
  // SPRINT 5: PESTAÑA DE CARPETAS Y ESTUDIOS EXTERNOS / LABORATORIOS (HU-08)
  // =========================================================================

  renderFoldersTab() {
    const folders = this.folders || [];
    const documents = this.documents || [];
    const selectedFolder = folders.find(f => f.id === this.selectedFolderId) || null;
    const filteredDocs = this.selectedFolderId 
      ? documents.filter(d => d.carpeta_id === this.selectedFolderId)
      : documents;

    return `
      <div class="soft-section-card clinical-folders-card" style="padding: 1.85rem; max-width: 100%;">
        <!-- CABECERA DE LA PESTAÑA DE CARPETAS -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="color: var(--soft-text-title); font-size: 1.22rem; font-weight: 800; margin: 0 0 0.35rem 0; display: flex; align-items: center; gap: 0.5rem; letter-spacing: -0.015em;">
              ${Icons.folder(20, 'var(--soft-purple-primary)')}
              <span>Carpetas Digitales del Expediente & Estudios Externos</span>
            </h3>
            <p style="color: var(--soft-text-body); font-size: 0.86rem; margin: 0;">
              Repositorio médico para custodiar laboratorios, electroencefalogramas (EEG), TAC e informes escolares en PDF con visor directo.
            </p>
          </div>

          <div style="display: flex; gap: 0.55rem; align-items: center; flex-wrap: wrap;">
            <button 
              type="button" 
              id="btn-open-inactive-folders" 
              class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" 
              title="Ver carpetas dadas de baja lógica y reincorporarlas"
            >
              ${Icons.archive(14, 'var(--soft-purple-primary)')}
              <span>Carpetas Desvinculadas</span>
              <span style="background: rgba(88, 66, 148, 0.14); color: var(--soft-purple-primary); font-size: 0.72rem; padding: 0.08rem 0.45rem; border-radius: 9999px; font-weight: 800;">${this.inactiveFolders ? this.inactiveFolders.length : 0}</span>
            </button>
            <button 
              type="button" 
              id="btn-open-inactive-docs" 
              class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" 
              title="Ver estudios y archivos dados de baja lógica y reincorporarlos"
            >
              ${Icons.fileText(14, 'var(--soft-purple-primary)')}
              <span>Estudios Desvinculados</span>
              <span style="background: rgba(88, 66, 148, 0.14); color: var(--soft-purple-primary); font-size: 0.72rem; padding: 0.08rem 0.45rem; border-radius: 9999px; font-weight: 800;">${this.inactiveDocs ? this.inactiveDocs.length : 0}</span>
            </button>
            <button type="button" id="btn-open-new-folder" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted">
              ${Icons.plus(14, 'var(--soft-purple-primary)')}
              <span>Nueva Carpeta</span>
            </button>
            <button type="button" id="btn-open-upload-doc" class="soft-btn soft-btn-lvl-1">
              ${Icons.upload(16, '#FFFFFF')}
              <span>Subir Estudio</span>
            </button>
          </div>
        </div>

        <!-- SELECTOR DE CARPETAS EN PÍLDORAS (SOLO CARPETAS ACTIVAS) -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 1rem;">
          <button 
            type="button" 
            class="folder-pill-btn soft-btn soft-btn-sm ${!this.selectedFolderId ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" 
            data-folder-id=""
            style="border-radius: 9999px;"
          >
            ${Icons.folder(14, !this.selectedFolderId ? '#FFFFFF' : 'var(--soft-purple-primary)')}
            <span>Todos los Estudios</span>
            <span style="font-size: 0.72rem; font-weight: 800; background: ${!this.selectedFolderId ? 'rgba(255,255,255,0.22)' : 'rgba(88, 66, 148, 0.12)'}; color: ${!this.selectedFolderId ? '#FFFFFF' : 'var(--soft-purple-primary)'}; padding: 0.08rem 0.45rem; border-radius: 9999px;">${documents.length}</span>
          </button>

          ${folders.map(f => {
            const isSelected = this.selectedFolderId === f.id;
            return `
              <button 
                type="button" 
                class="folder-pill-btn soft-btn soft-btn-sm ${isSelected ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" 
                data-folder-id="${f.id}"
                style="border-radius: 9999px;"
                title="${this.escapeHtml(f.descripcion || '')}"
              >
                ${Icons.folder(14, isSelected ? '#FFFFFF' : 'var(--soft-purple-primary)')}
                <span>${this.escapeHtml(f.nombre)}</span>
                <span style="font-size: 0.72rem; font-weight: 800; background: ${isSelected ? 'rgba(255,255,255,0.22)' : 'rgba(88, 66, 148, 0.12)'}; color: ${isSelected ? '#FFFFFF' : 'var(--soft-purple-primary)'}; padding: 0.08rem 0.45rem; border-radius: 9999px;">${f.total_documentos || 0}</span>
              </button>
            `;
          }).join('')}
        </div>

        ${selectedFolder ? `
          <div class="soft-subcard" style="background: var(--soft-lavender-surface); padding: 0.9rem 1.25rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem; flex-wrap: wrap;">
                <strong style="color: var(--soft-text-title); font-size: 0.95rem; font-weight: 800;">${this.escapeHtml(selectedFolder.nombre)}</strong>
                <span class="soft-badge soft-badge-emerald">
                  <span class="soft-status-dot"></span>
                  Carpeta Activa
                </span>
                ${selectedFolder.es_sistema ? `<span class="soft-badge soft-badge-lavender">Sistema</span>` : ''}
              </div>
              <p style="color: var(--soft-text-body); font-size: 0.82rem; margin: 0;">
                ${this.escapeHtml(selectedFolder.descripcion || 'Sin descripción adicional registrada.')}
              </p>
            </div>

            ${!selectedFolder.es_sistema ? `
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button 
                type="button" 
                class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-deactivate-folder-trigger" 
                data-folder-id="${selectedFolder.id}"
                data-folder-name="${this.escapeHtml(selectedFolder.nombre)}"
                title="Desvincular carpeta con justificación médica"
              >
                ${Icons.archive(13, '#B91C1C')}
                <span>Desvincular Carpeta</span>
              </button>
            </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- LISTADO DE DOCUMENTOS DE LA CARPETA SELECCIONADA -->
        ${filteredDocs.length === 0 ? `
          <div class="soft-subcard" style="background: var(--soft-lavender-surface); border-style: dashed; padding: 3rem 1.5rem; text-align: center;">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1rem auto;">
              ${Icons.folderSearch(30, 'var(--soft-purple-primary)')}
            </div>
            <h4 style="color: var(--soft-text-title); font-size: 1.1rem; font-weight: 800; margin: 0 0 0.4rem 0;">No hay estudios adjuntos en esta carpeta</h4>
            <p style="color: var(--soft-text-body); font-size: 0.86rem; max-width: 480px; margin: 0 auto 1.35rem auto; line-height: 1.55;">
              Puedes subir resultados de laboratorio, tomografías, electroencefalogramas o boletines escolares en formato PDF o imagen.
            </p>
            <button type="button" class="soft-btn soft-btn-lvl-1 btn-launch-upload-doc">
              ${Icons.upload(16, '#FFFFFF')}
              <span>Subir Primer Documento</span>
            </button>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr)); gap: 1.15rem;">
            ${filteredDocs.map(doc => this.renderDocumentCard(doc)).join('')}
          </div>
        `}
      </div>
    `;
  }

  renderDocumentCard(doc) {
    const isPdf = doc.tipo_mime === 'application/pdf';
    const sizeKb = Math.round(doc.tamano_bytes / 1024);
    const sizeFormatted = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

    const categoryNames = {
      'LABORATORIO_ESTUDIO': 'Estudio / Laboratorio',
      'EVALUACION_NEUROPSICOLOGICA': 'Evaluación Neuropsicológica',
      'INFORME_ESCOLAR': 'Informe Escolar',
      'CONSENTIMIENTO_LEGAL': 'Consentimiento Legal',
      'OTRO': 'Documento Clínico'
    };
    const catName = categoryNames[doc.categoria_clinica] || doc.categoria_clinica;

    return `
      <div class="soft-room-card doc-card" style="padding: 1.2rem 1.3rem; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.7rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0;">
              <div class="soft-icon-box soft-icon-box-sm ${isPdf ? 'soft-icon-box-lavender' : 'soft-icon-box-mint'}">
                ${isPdf ? Icons.filePdf(19, 'var(--soft-purple-primary)') : Icons.fileText(19, 'var(--soft-mint-deep)')}
              </div>
              <div style="min-width: 0;">
                <span style="font-size: 0.7rem; font-weight: 800; color: ${isPdf ? 'var(--soft-purple-primary)' : 'var(--soft-mint-deep)'}; text-transform: uppercase; letter-spacing: 0.04em;">
                  ${this.escapeHtml(catName)}
                </span>
                <h5 style="color: var(--soft-text-title); font-size: 0.92rem; font-weight: 800; margin: 0.1rem 0 0 0; line-height: 1.35; word-break: break-word;">
                  ${this.escapeHtml(doc.nombre_original)}
                </h5>
              </div>
            </div>
          </div>

          ${doc.descripcion ? `
            <p class="soft-subcard" style="font-size: 0.81rem; color: var(--soft-text-body); line-height: 1.45; margin: 0 0 0.8rem 0; background: var(--soft-lavender-surface); padding: 0.55rem 0.75rem;">
              ${this.escapeHtml(doc.descripcion)}
            </p>
          ` : ''}

          <div style="font-size: 0.75rem; color: var(--soft-text-muted); display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.85rem; align-items: center;">
            <span style="display: inline-flex; align-items: center; gap: 0.32rem;">
              ${Icons.folder(13, 'var(--soft-mint-deep)')}
              <span>${this.escapeHtml(doc.carpeta_nombre || 'General')}</span>
            </span>
            <span style="display: inline-flex; align-items: center; gap: 0.32rem;">
              ${Icons.database(13, 'var(--soft-purple-primary)')}
              <span>${sizeFormatted}</span>
            </span>
            <span style="display: inline-flex; align-items: center; gap: 0.32rem;">
              ${Icons.user(13, 'var(--soft-text-body)')}
              <span>${this.escapeHtml(doc.subido_por_nombre || 'Especialista')}</span>
            </span>
            <span style="display: inline-flex; align-items: center; gap: 0.32rem;">
              ${Icons.calendar(13, 'var(--soft-text-muted)')}
              <span>${doc.created_at ? doc.created_at.split(' ')[0] : ''}</span>
            </span>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--soft-divider); padding-top: 0.8rem; gap: 0.4rem; flex-wrap: wrap;">
          <button 
            type="button" 
            class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-view-doc" 
            data-doc-id="${doc.id}" 
            data-doc-name="${encodeURIComponent(doc.nombre_original)}"
            data-doc-mime="${doc.tipo_mime}"
          >
            ${Icons.eye(14, '#FFFFFF')}
            <span>Ver en Pantalla</span>
          </button>

          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            <button 
              type="button" 
              class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-download-doc-card" 
              data-doc-id="${doc.id}" 
              data-doc-name="${encodeURIComponent(doc.nombre_original)}"
              title="Descargar archivo en tu equipo"
            >
              ${Icons.download(13, 'var(--soft-purple-primary)')}
              <span>Descargar</span>
            </button>
            <button 
              type="button" 
              class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-delete-doc" 
              data-doc-id="${doc.id}" 
              data-doc-name="${encodeURIComponent(doc.nombre_original)}"
              title="Desvincular estudio con justificación médica"
            >
              ${Icons.trash(13, '#B91C1C')}
              <span>Desvincular</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }



  // =========================================================================
  // SPRINT 9.5: HU-13 CONSENTIMIENTOS INFORMADOS Y FIRMA TÁCTIL (RN-03)
  // =========================================================================

  renderConsentsTab() {
    const consents = this.consents || [];
    const patient = this.currentHistory;
    const tutor = patient.tutor_principal;

    return `
      <div class="soft-section-card clinical-folders-card" style="padding: 1.85rem; max-width: 100%;">
        <!-- CABECERA DE LA PESTAÑA DE CONSENTIMIENTOS -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="color: var(--soft-text-title); font-size: 1.22rem; font-weight: 800; margin: 0 0 0.35rem 0; display: flex; align-items: center; gap: 0.5rem; letter-spacing: -0.015em;">
              ${Icons.signature(22, 'var(--soft-purple-primary)')}
              <span>Consentimientos Informados y Autorizaciones Legales</span>
            </h3>
            <p style="color: var(--soft-text-body); font-size: 0.86rem; margin: 0;">
              Captura táctil de firma manuscrita según la Ley 548, Código Niña, Niño y Adolescente de Bolivia, y salvaguarda legal obligatoria.
            </p>
          </div>
          <button type="button" id="btn-open-new-consent-modal" class="soft-btn soft-btn-lvl-1">
            ${Icons.plus(16, '#FFFFFF')}
            <span>+ Nuevo Consentimiento</span>
          </button>
        </div>

        ${!this.hasActiveConsent ? `
          <div class="soft-subcard" style="background: rgba(245, 158, 11, 0.09); border: 1px solid rgba(245, 158, 11, 0.32); padding: 1.2rem 1.4rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.85rem;">
              <div class="soft-icon-box soft-icon-box-sm" style="background: rgba(245, 158, 11, 0.2); color: #B45309;">
                ${Icons.alertTriangle(20)}
              </div>
              <div>
                <strong style="color: #92400E; font-size: 0.95rem; display: block;">Atención Ético-Legal</strong>
                <span style="color: #78350F; font-size: 0.84rem;">Este expediente aún no posee un consentimiento informado firmado por el tutor legal. No se deben aplicar baterías ni formalizar dictámenes hasta recabar la firma digital.</span>
              </div>
            </div>
            <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-launch-consent-now">
              ${Icons.signature(14, '#FFFFFF')}
              <span>Firmar Ahora con el Dedo</span>
            </button>
          </div>
        ` : ''}

        ${consents.length === 0 ? `
          <div class="soft-subcard" style="background: var(--soft-lavender-surface); border-style: dashed; padding: 3rem 1.5rem; text-align: center;">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1rem auto;">
              ${Icons.signature(32, 'var(--soft-purple-primary)')}
            </div>
            <h4 style="color: var(--soft-text-title); font-size: 1.1rem; font-weight: 800; margin: 0 0 0.4rem 0;">Sin consentimientos registrados aún</h4>
            <p style="color: var(--soft-text-body); font-size: 0.86rem; max-width: 480px; margin: 0 auto 1.35rem auto; line-height: 1.55;">
              Abre el acta digital para que el padre, madre o tutor legal firme en el dispositivo táctil o mediante ratón antes de proceder con las pruebas neuropsicológicas.
            </p>
            <button type="button" class="soft-btn soft-btn-lvl-1 btn-launch-consent-now">
              ${Icons.signature(16, '#FFFFFF')}
              <span>Abrir Acta de Consentimiento</span>
            </button>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 1.25rem;">
            ${consents.map(c => this.renderConsentCard(c)).join('')}
          </div>
        `}
      </div>
    `;
  }

  renderConsentCard(c) {
    const isSigned = c.estado === 'FIRMADO';
    const typeNames = {
      'EVALUACION_INICIAL': 'Evaluación Inicial / Triaje',
      'TRATAMIENTO_CONTINUO': 'Tratamiento Psicoterapéutico',
      'INTERVENCION_NEUROCOGNITIVA': 'Intervención Neurocognitiva',
      'APLICACION_PRUEBAS': 'Aplicación Baterías Psicométricas',
      'TELEPSICOLOGIA': 'Telepsicología / Atención Remota'
    };

    return `
      <div class="soft-subcard" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s ease;">
        <div>
          <!-- CABECERA DE TARJETA -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.75rem;">
            <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem; font-weight: 700;">
              ${typeNames[c.tipo_consentimiento] || c.tipo_consentimiento}
            </span>
            ${isSigned ? `
              <span class="soft-badge soft-badge-emerald" style="font-size: 0.72rem;">
                <span class="soft-status-dot"></span>
                <span>Firmado Legal</span>
              </span>
            ` : `
              <span class="soft-badge soft-badge-rose" style="font-size: 0.72rem;">
                <span class="soft-status-dot"></span>
                <span>Revocado</span>
              </span>
            `}
          </div>

          <h4 style="color: var(--soft-text-title); font-size: 0.98rem; font-weight: 800; margin: 0 0 0.5rem 0; line-height: 1.35;">
            ${this.escapeHtml(c.titulo)}
          </h4>

          <div style="font-size: 0.8rem; color: var(--soft-text-body); margin-bottom: 0.85rem; line-height: 1.45;">
            <div><strong style="color: var(--soft-text-title);">Firmado por:</strong> ${this.escapeHtml(c.firmado_por_nombre)} (CI: ${this.escapeHtml(c.firmado_por_ci)})</div>
            <div><strong style="color: var(--soft-text-title);">Parentesco:</strong> ${this.escapeHtml(c.parentesco)}</div>
            <div><strong style="color: var(--soft-text-title);">Fecha y Hora:</strong> ${c.fecha_firma ? c.fecha_firma.replace('T', ' ').substring(0, 16) : ''}</div>
          </div>

          <!-- MINIATURA DE TRAZO DE FIRMA TÁCTIL -->
          <div style="background: #FBFBFE; border: 1px dashed var(--soft-border-card-inner); border-radius: 10px; padding: 0.5rem; text-align: center; margin-bottom: 0.9rem; min-height: 70px; display: flex; align-items: center; justify-content: center;">
            <img src="${c.firma_digital_blob}" alt="Firma manuscrita digital" style="max-height: 55px; max-width: 100%; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(36, 40, 91, 0.15));" />
          </div>
        </div>

        <!-- PIE DE ACCIONES -->
        <div style="border-top: 1px solid var(--soft-divider); padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <button 
            type="button" 
            class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-view-consent-doc" 
            data-consent-id="${c.id}"
            title="Ver acta legal completa e imprimir certificado"
          >
            ${Icons.eye(13, '#FFFFFF')}
            <span>Ver Certificado Legal</span>
          </button>

          ${isSigned ? `
            <button 
              type="button" 
              class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-revoke-consent" 
              data-consent-id="${c.id}"
              title="Revocar consentimiento por razones médico-legales"
              style="color: var(--soft-rose, #E11D48);"
            >
              ${Icons.close(13)}
              <span>Revocar</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // SPRINT 9.5: HU-14 INFORMES CLÍNICOS OFICIALES WORD .DOCX (RF-I03 / RF-I07)
  // =========================================================================

  renderReportsTab() {
    const reports = this.reports || [];
    const patient = this.currentHistory;

    return `
      <div class="soft-section-card clinical-folders-card" style="padding: 1.85rem; max-width: 100%;">
        <!-- CABECERA DE LA PESTAÑA DE INFORMES -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="color: var(--soft-text-title); font-size: 1.22rem; font-weight: 800; margin: 0 0 0.35rem 0; display: flex; align-items: center; gap: 0.5rem; letter-spacing: -0.015em;">
              ${Icons.fileWord(22, 'var(--soft-purple-primary)')}
              <span>Informes Clínicos Oficiales y Devoluciones</span>
            </h3>
            <p style="color: var(--soft-text-body); font-size: 0.86rem; margin: 0;">
              Generador dinámico de informes en Microsoft Word con membrete oficial del Centro PSI Aprende, previsualizador Mammoth y descarga directa.
            </p>
          </div>
          <div style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
            <button type="button" id="btn-open-family-report-modal" class="soft-btn soft-btn-lvl-1-muted">
              ${Icons.plus(16, 'var(--soft-purple-primary)')}
              <span>+ Reporte de Orientación Familiar</span>
            </button>
            <button type="button" id="btn-open-new-report-modal" class="soft-btn soft-btn-lvl-1">
              ${Icons.fileWord(16, '#FFFFFF')}
              <span>+ Informe Técnico Word</span>
            </button>
          </div>
        </div>

        ${reports.length === 0 ? `
          <div class="soft-subcard" style="background: var(--soft-lavender-surface); border-style: dashed; padding: 3rem 1.5rem; text-align: center;">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1rem auto;">
              ${Icons.fileWord(32, 'var(--soft-purple-primary)')}
            </div>
            <h4 style="color: var(--soft-text-title); font-size: 1.1rem; font-weight: 800; margin: 0 0 0.4rem 0;">Sin informes clínicos emitidos</h4>
            <p style="color: var(--soft-text-body); font-size: 0.86rem; max-width: 480px; margin: 0 auto 1.35rem auto; line-height: 1.55;">
              Compila y genera el primer informe oficial de evaluación neuropsicológica o un reporte de avance familiar en formato Microsoft Word editable.
            </p>
            <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
              <button type="button" class="soft-btn soft-btn-lvl-1-muted" id="btn-launch-family-report-empty">
                ${Icons.plus(16, 'var(--soft-purple-primary)')}
                <span>Reporte de Avance Familiar</span>
              </button>
              <button type="button" class="soft-btn soft-btn-lvl-1 btn-launch-report-now">
                ${Icons.fileWord(16, '#FFFFFF')}
                <span>Informe Técnico Word</span>
              </button>
            </div>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 1.25rem;">
            ${reports.map(r => this.renderReportCard(r)).join('')}
          </div>
        `}
      </div>
    `;
  }

  renderReportCard(r) {
    const typeNames = {
      'EVALUACION_NEUROPSICOLOGICA': 'Neuropsicología Clínica',
      'INFORME_PSICOPEDAGOGICO': 'Psicopedagogía & Aprendizaje',
      'VALORACION_GERONTOLOGICA': 'Valoración Gerontológica VGI',
      'EVOLUCION_CLINICA': 'Evolución Periódica',
      'INFORME_ESCOLAR': 'Dictamen Escolar Adaptativo',
      'REPORTE_FAMILIAR_AVANCE': 'Reporte de Avance Familiar'
    };

    const isFamilyType = r.tipo_informe === 'REPORTE_FAMILIAR_AVANCE';
    const isSigned = r.estado === 'FIRMADO' || !!r.ruta_archivo_firmado;
    const bCount = Array.isArray(r.baterias_administradas) ? r.baterias_administradas.length : 0;

    return `
      <div class="soft-subcard" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); padding: 1.35rem; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s ease; min-width: 0; overflow: hidden; word-break: break-word;">
        <div style="min-width: 0; overflow: hidden;">
          <!-- CABECERA -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
            <span class="soft-badge ${isFamilyType ? 'soft-badge-mint' : 'soft-badge-lavender'}" style="font-size: 0.72rem; font-weight: 700;">
              ${typeNames[r.tipo_informe] || r.tipo_informe}
            </span>
            <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
              ${r.entregable_familiar ? `
                <span class="soft-badge soft-badge-mint" title="Visible para los tutores en el portal familiar" style="font-size: 0.69rem;">
                  <span class="soft-status-dot"></span>
                  <span>Entregable a Familia</span>
                </span>
              ` : `
                <span class="soft-badge soft-badge-slate" title="Uso clínico interno confidencial" style="font-size: 0.69rem;">
                  <span>Clínico Confidencial</span>
                </span>
              `}
              <span class="soft-badge ${isSigned ? 'soft-badge-emerald' : 'soft-badge-slate'}" style="font-size: 0.69rem;">
                ${isSigned ? '<span class="soft-status-dot"></span><span>Firmado y Sellado</span>' : `<span>${r.estado || 'EMITIDO'}</span>`}
              </span>
            </div>
          </div>

          <h4 style="color: var(--soft-text-title); font-size: 1.02rem; font-weight: 800; margin: 0 0 0.5rem 0; line-height: 1.35; word-break: break-word;">
            ${this.escapeHtml(r.titulo)}
          </h4>

          <div style="font-size: 0.8rem; color: var(--soft-text-body); margin-bottom: 0.85rem; line-height: 1.45;">
            <div><strong style="color: var(--soft-text-title);">Especialista:</strong> Lic. ${this.escapeHtml(r.terapeuta_nombres)} ${this.escapeHtml(r.terapeuta_apellidos)}</div>
            <div><strong style="color: var(--soft-text-title);">Fecha Emisión:</strong> ${r.fecha_emision ? r.fecha_emision.split(' ')[0] : ''}</div>
            ${r.diagnostico_codigo ? `
              <div style="margin-top: 0.35rem; width: 100%; min-width: 0; overflow: hidden;">
                <span class="soft-badge soft-badge-lavender soft-badge-wrap" style="font-size: 0.74rem; text-align: left; padding: 0.35rem 0.65rem; display: inline-block; white-space: normal !important; word-break: break-word !important; overflow-wrap: anywhere !important; max-width: 100%; box-sizing: border-box; line-height: 1.35;">
                  ${this.escapeHtml(r.diagnostico_codigo.replace(/[()]/g, ''))} - ${this.escapeHtml(r.diagnostico_descripcion ? r.diagnostico_descripcion.replace(/[()]/g, '') : '')}
                </span>
              </div>
            ` : ''}
          </div>

          ${bCount > 0 ? `
            <div style="margin-bottom: 0.9rem; font-size: 0.75rem; color: var(--soft-text-muted);">
              <strong>Baterías administradas:</strong> ${r.baterias_administradas.map(b => b.nombre || b.codigo).join(', ')}
            </div>
          ` : ''}
        </div>

        <!-- ACCIONES DE DESCARGA, PREVISUALIZACIÓN Y FIRMA ESCANEADA -->
        <div style="border-top: 1px solid var(--soft-divider); padding-top: 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
          <div style="display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap;">
            <button 
              type="button" 
              class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-preview-report" 
              data-report-id="${r.id}"
              title="Previsualizar informe generado en pantalla con Mammoth"
            >
              ${Icons.eye(13, 'var(--soft-purple-primary)')}
              <span>Ver</span>
            </button>

            <button 
              type="button" 
              class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-download-report-docx" 
              data-report-id="${r.id}"
              title="Descargar archivo editable Microsoft Word"
            >
              ${Icons.download(13, '#FFFFFF')}
              <span>Word</span>
            </button>

            ${isSigned ? `
              <button 
                type="button" 
                class="soft-btn soft-btn-sm btn-download-signed-report" 
                data-report-id="${r.id}"
                title="Descargar documento oficial firmado y sellado"
                style="background: #DCFCE7; color: #15803D; font-weight: 700;"
              >
                ${Icons.shield(13, '#15803D')}
                <span>Firmado</span>
              </button>
              <button 
                type="button" 
                class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-stamp-digital-signature" 
                data-report-id="${r.id}"
                title="Re-estampar firma digital colegiada guardada"
              >
                ${Icons.signature(13, 'var(--soft-purple-primary)')}
              </button>
              <button 
                type="button" 
                class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-upload-signed-report" 
                data-report-id="${r.id}"
                title="Subir o reemplazar archivo escaneado"
              >
                ${Icons.upload(13, 'var(--soft-purple-primary)')}
              </button>
            ` : `
              <button 
                type="button" 
                class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-stamp-digital-signature" 
                data-report-id="${r.id}"
                title="Estampar firma digital colegiada guardada en este informe"
                style="background: linear-gradient(135deg, #0F766E, #0D9488); color: #FFFFFF;"
              >
                ${Icons.signature(13, '#FFFFFF')}
                <span>Estampar Firma</span>
              </button>
              <button 
                type="button" 
                class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-upload-signed-report" 
                data-report-id="${r.id}"
                title="Subir documento firmado y sellado en papel"
              >
                ${Icons.upload(13, 'var(--soft-purple-primary)')}
                <span>Subir Escaneado</span>
              </button>
            `}
          </div>

          <button 
            type="button" 
            class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-delete-report" 
            data-report-id="${r.id}"
            title="Eliminar informe"
            style="color: var(--soft-rose, #E11D48);"
          >
            ${Icons.trash(13)}
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // MODALES SPRINT 9.5 (NIVEL 2 SOFT UI SEGÚN DESIGN_RULES.MD)
  // =========================================================================

  openConsentModal(initialTab = 'PHYSICAL') {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer || !this.currentHistory) return;

    const h = this.currentHistory;
    const tutor = h.tutor_principal || {};

    let isAdult = false;
    if (h.paciente_fecha_nacimiento) {
      const birth = new Date(h.paciente_fecha_nacimiento);
      const now = new Date();
      let years = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
      if (years >= 18) isAdult = true;
    }
    if (tutor.parentesco === 'TITULAR_PACIENTE') isAdult = true;

    const defaultFirmanteNombre = isAdult
      ? `${h.paciente_nombres} ${h.paciente_apellidos}`
      : (tutor.nombres ? `${tutor.nombres} ${tutor.apellidos}` : '');
    const defaultFirmanteCi = isAdult
      ? (h.paciente_ci || '')
      : (tutor.ci || '');
    const isCiVerified = Boolean(defaultFirmanteCi && defaultFirmanteCi.trim().length >= 4);

    const defaultClausesText = isAdult
      ? `1. DECLARACIÓN Y AUTORIZACIÓN:
El/la suscrito/a, en pleno ejercicio de sus facultades civiles según la Ley N° 3131 del Ejercicio Profesional del Estado Plurinacional de Bolivia, autoriza de forma libre, informada y expresa a los profesionales acreditados del Centro Psicopedagógico y de Atención Psicológica "PSI Aprende" a realizar el proceso de evaluación neuropsicológica, psicodiagnóstico clínico y psicoterapia.

2. CONFIDENCIALIDAD Y SECRETO PROFESIONAL:
Toda la información personal, médica y terapéutica recabada se mantendrá bajo estricto secreto profesional conforme al Art. 16 de la Ley N° 3131 y el Código de Ética del Colegio de Psicólogos de Bolivia, resguardándose en el expediente clínico inalterable.

3. USO DE RESULTADOS Y DIAGNÓSTICO:
Los resultados y diagnósticos derivados del proceso evaluativo serán entregados formalmente en informe escrito confidencial para fines de orientación personal, médica, laboral o de rehabilitación.

4. VALIDEZ DEL REGISTRO:
El presente documento, suscrito digitalmente o mediante constancia física escaneada, acredita el pleno conocimiento y conformidad con los alcances del abordaje clínico.`
      : `1. DECLARACIÓN Y AUTORIZACIÓN:
El/la suscrito/a, en pleno ejercicio de la patria potestad o tutoría legal según la Ley N° 548 (Código Niña, Niño y Adolescente del Estado Plurinacional de Bolivia), autoriza libre, informada y expresamente a los profesionales acreditados del Centro Psicopedagógico y de Atención Psicológica "PSI Aprende" a realizar el proceso de evaluación neuropsicológica, psicopedagógica y psicoterapéutica respecto al menor ${h.paciente_nombres} ${h.paciente_apellidos}.

2. CONFIDENCIALIDAD Y SECRETO PROFESIONAL:
Toda la información recabada durante las entrevistas, aplicaciones de baterías psicométricas y notas de evolución clínica se mantendrá bajo estricto secreto profesional conforme a la Ley y el Código de Ética Profesional del Colegio de Psicólogos de Bolivia, resguardándose digitalmente en el expediente clínico inalterable del centro.

3. USO DE RESULTADOS Y DIAGNÓSTICO:
Los resultados y diagnósticos derivados del proceso evaluativo serán entregados formalmente a los tutores legales mediante informe escrito para fines de orientación psicopedagógica, médica o adaptaciones curriculares escolares.

4. VALIDEZ DEL REGISTRO:
La presente acta legal acredita el pleno conocimiento y consentimiento informado de los tutores respecto al plan de intervención del Centro.`;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="consent-modal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 700px; width: 100%; max-height: 92vh; display: flex; flex-direction: column;">
          
          <!-- CABECERA MODAL (NIVEL 2) -->
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.signature(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0; letter-spacing: -0.015em;">
                  Formalización de Consentimiento Informado
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Paciente: <strong>${this.escapeHtml(h.paciente_nombres)} ${this.escapeHtml(h.paciente_apellidos)}</strong> · Expediente ${h.numero_expediente} · <span class="soft-badge ${isAdult ? 'soft-badge-indigo' : 'soft-badge-lavender'}" style="font-size: 0.68rem;">${isAdult ? 'Adulto · Ley 3131' : 'Menor de Edad · Ley 548'}</span>
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-consent-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- CUERPO MODAL (SCROLLABLE) -->
          <div style="padding: 1.35rem 1.65rem; overflow-y: auto; flex: 1;">
            
            <!-- SELECTOR DE MODALIDAD: FÍSICO VS DIGITAL -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1.2rem; background: var(--soft-lavender-surface); padding: 0.35rem; border-radius: 12px; border: 1px solid var(--soft-border-card-inner);">
              <button type="button" id="tab-btn-physical-clinical" class="${initialTab === 'PHYSICAL' ? 'soft-btn soft-btn-sm soft-btn-lvl-1' : 'soft-btn soft-btn-sm soft-btn-lvl-1-muted'}" style="flex: 1; justify-content: center; font-size: 0.76rem;">
                ${Icons.printer(14)}
                <span>1. Formulario Físico en Papel</span>
              </button>
              <button type="button" id="tab-btn-digital-clinical" class="${initialTab === 'DIGITAL' ? 'soft-btn soft-btn-sm soft-btn-lvl-1' : 'soft-btn soft-btn-sm soft-btn-lvl-1-muted'}" style="flex: 1; justify-content: center; font-size: 0.76rem;">
                ${Icons.signature(14)}
                <span>2. Firma Digital en Pantalla o Tableta</span>
              </button>
            </div>

            <form id="form-create-consent">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label class="soft-label">Tipo de Consentimiento <span class="required">*</span></label>
                  <select name="tipo_consentimiento" required class="soft-select">
                    <option value="EVALUACION_INICIAL" selected>Evaluación Inicial o Triaje</option>
                    <option value="TRATAMIENTO_CONTINUO">Tratamiento Psicoterapéutico Continuo</option>
                    <option value="INTERVENCION_NEUROCOGNITIVA">Intervención Neurocognitiva y Estimulación</option>
                    <option value="APLICACION_PRUEBAS">Aplicación de Baterías Neuropsicológicas</option>
                    <option value="TELEPSICOLOGIA">Telepsicología o Atención a Distancia</option>
                  </select>
                </div>
                <div>
                  <label class="soft-label">Parentesco o Representación Legal <span class="required">*</span></label>
                  <select name="parentesco" required class="soft-select">
                    ${isAdult ? `
                      <option value="TITULAR_PACIENTE" selected>Paciente Titular · Mayor de edad</option>
                      <option value="APODERADO">Apoderado o Representante Legal</option>
                    ` : `
                      <option value="MADRE" ${tutor.parentesco === 'MADRE' ? 'selected' : ''}>Madre</option>
                      <option value="PADRE" ${tutor.parentesco === 'PADRE' ? 'selected' : ''}>Padre</option>
                      <option value="TUTOR_LEGAL" ${(!tutor.parentesco || tutor.parentesco === 'TUTOR') ? 'selected' : ''}>Tutor Legal</option>
                      <option value="ABUELO_A">Abuelo o Abuela</option>
                      <option value="APODERADO">Apoderado o Representante</option>
                    `}
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label class="soft-label">Nombre Completo del Firmante <span class="required">*</span></label>
                  <input type="text" name="firmado_por_nombre" required class="soft-input" value="${this.escapeHtml(defaultFirmanteNombre)}" placeholder="Ej. Roberto Morales" />
                </div>
                <div>
                  <label class="soft-label">
                    Cédula de Identidad <span class="required">*</span>
                    ${isCiVerified ? `<span class="soft-badge soft-badge-mint" style="font-size: 0.65rem; margin-left: 0.35rem;"><span class="soft-status-dot"></span><span>Verificado en Expediente</span></span>` : ''}
                  </label>
                  <input 
                    type="text" 
                    name="firmado_por_ci" 
                    required 
                    class="soft-input" 
                    value="${this.escapeHtml(defaultFirmanteCi)}" 
                    placeholder="Ej. 6543210 LP" 
                    ${isCiVerified ? 'readonly style="background: #F8FAFC; color: var(--soft-text-title); font-weight: 700; cursor: not-allowed;"' : ''}
                  />
                </div>
              </div>

              <div style="margin-bottom: 1.15rem;">
                <label class="soft-label">Cláusulas Legales y Alcance Clínico: ${isAdult ? 'Ley 3131' : 'Ley 548'}</label>
                <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.85rem; max-height: 120px; overflow-y: auto; font-size: 0.76rem; color: var(--soft-text-body); line-height: 1.5; white-space: pre-line;">
                  ${defaultClausesText}
                </div>
              </div>

              <!-- PANEL MODALIDAD A: FORMULARIO FÍSICO EN PAPEL -->
              <div id="panel-clinical-physical" style="display: ${initialTab === 'PHYSICAL' ? 'block' : 'none'}; margin-bottom: 1.15rem;">
                <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 1rem 1.15rem; margin-bottom: 1rem;">
                  <strong style="color: var(--soft-text-title); font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">
                    Paso 1: Impresión del Formulario Prellenado
                  </strong>
                  <p style="font-size: 0.79rem; color: var(--soft-text-body); margin: 0 0 0.85rem 0; line-height: 1.45;">
                    Imprima este formulario oficial con membrete del Centro PSI Aprende para que el tutor o paciente lo firme con bolígrafo físico en recepción o consultorio.
                  </p>
                  <button type="button" id="btn-print-physical-clinical" class="soft-btn soft-btn-sm soft-btn-lvl-1" style="font-size: 0.76rem;">
                    ${Icons.printer(14, '#FFFFFF')}
                    <span>Imprimir Plantilla Oficial para Firma en Papel</span>
                  </button>
                </div>

                <div>
                  <label class="soft-label">
                    Paso 2: Subir Escaneo o Foto del Formulario Firmado <span class="required">*</span>
                  </label>
                  <input type="file" id="input-physical-scan-clinical" accept="image/png,image/jpeg,image/webp,application/pdf" class="soft-input" style="padding: 0.5rem; background: #FFFFFF; border: 1.5px dashed var(--soft-purple-primary); cursor: pointer;" />
                  <div style="font-size: 0.72rem; color: var(--soft-text-muted); margin-top: 0.35rem;">
                    Formatos admitidos: JPG, PNG o PDF. Se custodiará como constancia digital inalterable en el expediente.
                  </div>
                </div>
              </div>

              <!-- PANEL MODALIDAD B: FIRMA DIGITAL EN PANTALLA TÁCTIL -->
              <div id="panel-clinical-digital" style="display: ${initialTab === 'DIGITAL' ? 'block' : 'none'}; margin-bottom: 1.15rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                  <label class="soft-label" style="margin: 0;">
                    Firma Manuscrita Digital en pantalla táctil o ratón <span class="required">*</span>
                  </label>
                  <button type="button" id="btn-clear-canvas" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="font-size: 0.72rem; padding: 0.25rem 0.6rem;">
                    ${Icons.trash(12)}
                    <span>Limpiar Trazo</span>
                  </button>
                </div>
                
                <div style="background: #FFFFFF; border: 2px dashed var(--soft-purple-primary); border-radius: 14px; padding: 0.25rem; box-shadow: inset 0 2px 6px rgba(0,0,0,0.03);">
                  <canvas id="consent-signature-canvas" style="width: 100%; height: 160px; display: block; border-radius: 12px; background: #FFFFFF; touch-action: none; cursor: crosshair;"></canvas>
                </div>
                <div style="font-size: 0.72rem; color: var(--soft-text-muted); margin-top: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
                  ${Icons.info(12, 'var(--soft-purple-primary)')}
                  <span>Firme con claridad dentro del recuadro. La firma quedará sellada con marca de tiempo e IP.</span>
                </div>
              </div>

              <!-- PIE DE MODAL (NIVEL 2) -->
              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem; margin-top: 1rem;">
                <button type="button" id="btn-cancel-consent-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" id="btn-submit-consent-btn" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(16, '#FFFFFF')}
                  <span>Registrar y Custodiar Legalmente</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    let activeClinicalMode = initialTab;

    // Inicializar el canvas de firma interactiva
    const canvasEl = document.getElementById('consent-signature-canvas');
    if (canvasEl) {
      this.signatureCanvasInstance = new SignatureCanvas(canvasEl);
    }

    // Alternar pestañas
    const tabBtnPhys = document.getElementById('tab-btn-physical-clinical');
    const tabBtnDig = document.getElementById('tab-btn-digital-clinical');
    const panelPhys = document.getElementById('panel-clinical-physical');
    const panelDig = document.getElementById('panel-clinical-digital');

    tabBtnPhys?.addEventListener('click', () => {
      activeClinicalMode = 'PHYSICAL';
      tabBtnPhys.className = 'soft-btn soft-btn-sm soft-btn-lvl-1';
      tabBtnDig.className = 'soft-btn soft-btn-sm soft-btn-lvl-1-muted';
      if (panelPhys) panelPhys.style.display = 'block';
      if (panelDig) panelDig.style.display = 'none';
    });

    tabBtnDig?.addEventListener('click', () => {
      activeClinicalMode = 'DIGITAL';
      tabBtnDig.className = 'soft-btn soft-btn-sm soft-btn-lvl-1';
      tabBtnPhys.className = 'soft-btn soft-btn-sm soft-btn-lvl-1-muted';
      if (panelPhys) panelPhys.style.display = 'none';
      if (panelDig) panelDig.style.display = 'block';
      setTimeout(() => {
        if (this.signatureCanvasInstance) this.signatureCanvasInstance.resizeCanvas();
      }, 50);
    });

    // Botón imprimir plantilla física
    document.getElementById('btn-print-physical-clinical')?.addEventListener('click', () => {
      this.printPhysicalTemplate(h, tutor, isAdult);
    });

    // Eventos
    const closeModal = () => {
      if (this.signatureCanvasInstance) {
        this.signatureCanvasInstance.destroy();
        this.signatureCanvasInstance = null;
      }
      modalContainer.innerHTML = '';
    };

    document.getElementById('btn-close-consent-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-consent-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-clear-canvas')?.addEventListener('click', () => {
      if (this.signatureCanvasInstance) this.signatureCanvasInstance.clear();
    });

    const form = document.getElementById('form-create-consent');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);

        let finalFirmaBlob = '';

        if (activeClinicalMode === 'DIGITAL') {
          if (!this.signatureCanvasInstance || this.signatureCanvasInstance.isEmpty()) {
            Toast.error('Debe estampar la firma manuscrita en el recuadro blanco antes de confirmar.');
            return;
          }
          finalFirmaBlob = this.signatureCanvasInstance.toDataURL();
        } else {
          const fileInput = document.getElementById('input-physical-scan-clinical');
          if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            Toast.error('Debe adjuntar la foto o archivo escaneado (PDF/imagen) del documento firmado a mano.');
            return;
          }
          finalFirmaBlob = await this._fileToDataUrl(fileInput.files[0]);
        }

        const payload = {
          paciente_id: h.paciente_id,
          tutor_id: isAdult ? null : (tutor.id || null),
          tipo_consentimiento: formData.get('tipo_consentimiento'),
          parentesco: formData.get('parentesco'),
          firmado_por_nombre: formData.get('firmado_por_nombre'),
          firmado_por_ci: formData.get('firmado_por_ci'),
          titulo: `Consentimiento Informado - ${formData.get('tipo_consentimiento')}`,
          contenido_clausulas: defaultClausesText,
          firma_digital_blob: finalFirmaBlob
        };

        const submitBtn = document.getElementById('btn-submit-consent-btn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Firmando y Sellando...</span>`;
        }

        try {
          await apiClient.post('/consents', payload);
          Toast.success('Consentimiento informado registrado y sellado legalmente.');
          closeModal();
          this.activeTab = 'consents';
          await this.loadHistoryDetail(this.selectedHistoryId);
        } catch (err) {
          Toast.error('Error al registrar consentimiento: ' + err.message);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `${Icons.check(16, '#FFFFFF')} <span>Registrar y Custodiar Legalmente</span>`;
          }
        }
      });
    }
  }

  _getInstAddress() {
    return store.getState().publicConfig?.INSTITUCION_DIRECCION || 'Calle Ladislao Cabrera entre Calle Antezana y Calle 16 de Julio, Cochabamba, Bolivia';
  }

  _getInstPhone() {
    return store.getState().publicConfig?.INSTITUCION_TELEFONO || '+591 4 4521234';
  }

  _getInstDirector() {
    return store.getState().publicConfig?.INSTITUCION_DIRECTORA || 'Mgr. Grisel Aguilar Apaza';
  }

  printPhysicalTemplate(h, tutor, isAdult) {
    const firmanteNombre = isAdult ? `${h.paciente_nombres} ${h.paciente_apellidos}` : (tutor.nombres ? `${tutor.nombres} ${tutor.apellidos}` : '____________________________________');
    const firmanteCi = isAdult ? (h.paciente_ci || '____________________') : (tutor.ci || '____________________');
    const rolFirmante = isAdult ? 'Paciente Titular · Mayor de edad' : 'Tutor o Responsable Legal';
    const leyClausula = isAdult
      ? `<strong>1. DECLARACIÓN Y AUTORIZACIÓN:</strong> El suscrito o la suscrita, en pleno ejercicio de sus facultades civiles según la Ley 3131 del Ejercicio Profesional del Estado Plurinacional de Bolivia, autoriza de forma libre, informada y expresa al equipo acreditado del Centro PSI Aprende a realizar el proceso de evaluación neuropsicológica, psicodiagnóstico clínico y psicoterapia.`
      : `<strong>1. DECLARACIÓN Y AUTORIZACIÓN:</strong> El suscrito o la suscrita, en pleno ejercicio de la patria potestad o tutoría legal según la Ley 548 del Estado Plurinacional de Bolivia, autoriza de forma libre, informada y expresa a los profesionales acreditados del Centro PSI Aprende a realizar el proceso de evaluación neuropsicológica, psicopedagógica y psicoterapéutica respecto al menor mencionado.`;

    const loggedUser = store.getState().user;
    const therapistName = h.terapeuta_nombres 
      ? `Lic. ${h.terapeuta_nombres} ${h.terapeuta_apellidos}` 
      : (loggedUser?.rol === 'TERAPEUTA' ? loggedUser.nombre_completo : 'Especialista a Cargo');
    const therapistRole = h.especialidad_nombre || 'Especialista en Psicología';
    const therapistMat = h.terapeuta_matricula ? ` · Matrícula: ${h.terapeuta_matricula}` : '';

    const html = `
      <div style="text-align: center; border-bottom: 2px solid #27345F; padding-bottom: 8px; margin-bottom: 12px;">
        <div style="font-size: 13pt; font-weight: 800; color: #27345F; letter-spacing: -0.01em;">
          CENTRO PSICOPEDAGÓGICO Y DE ATENCIÓN PSICOLÓGICA PSI APRENDE
        </div>
        <div style="font-size: 8pt; color: #584294; margin-top: 2px;">
          ${this.escapeHtml(this._getInstAddress())}
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 12px;">
        <h2 style="font-size: 11pt; text-transform: uppercase; color: #27345F; letter-spacing: 0.03em; margin: 0 0 2px 0;">
          Acta Oficial de Consentimiento Informado para Atención Clínica
        </h2>
        <span style="font-size: 7.5pt; color: #64748B;">Cumplimiento ${isAdult ? 'Ley 3131 de Ejercicio Profesional' : 'Ley 548, Código Niña, Niño y Adolescente'}</span>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 8.5pt;">
        <tr>
          <td style="width: 32%; font-weight: bold; background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 8px;">PACIENTE EVALUADO:</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${this.escapeHtml(h.paciente_nombres)} ${this.escapeHtml(h.paciente_apellidos)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 8px;">CÓDIGO DE EXPEDIENTE:</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${this.escapeHtml(h.numero_expediente || 'N/A')} · Cédula: ${this.escapeHtml(h.paciente_ci || 'No registrado')}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 8px;">${rolFirmante.toUpperCase()}:</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${this.escapeHtml(firmanteNombre)} · Cédula: ${this.escapeHtml(firmanteCi)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 8px;">FECHA DE SUSCRIPCIÓN:</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${new Date().toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
        </tr>
      </table>

      <div style="font-size: 8pt; line-height: 1.4; color: #334155; margin-bottom: 16px; text-align: justify;">
        <p style="margin-bottom: 6px;">${leyClausula}</p>
        <p style="margin-bottom: 6px;"><strong>2. SECRETO PROFESIONAL:</strong> Toda la información recabada se mantendrá bajo estricto secreto profesional conforme a la Ley y el Código de Ética Profesional del Colegio de Psicólogos de Bolivia, resguardándose en el expediente clínico inalterable.</p>
        <p style="margin-bottom: 6px;"><strong>3. ENTREGA DE RESULTADOS:</strong> Los resultados serán formalizados en informe oficial para fines de orientación familiar, médica o adaptaciones curriculares.</p>
      </div>

      <div style="margin-top: 32px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-around; text-align: center; page-break-inside: avoid; break-inside: avoid;">
        <div style="width: 45%;">
          <!-- Espacio vertical despejado para firma manuscrita -->
          <div style="height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6px;"></div>
          <div style="border-top: 1.5px solid #27345F; padding-top: 4px; font-weight: bold; font-size: 8.5pt; color: #27345F;">
            Firma del ${rolFirmante}
          </div>
          <div style="font-size: 7.5pt; color: #64748B; margin-top: 3px; line-height: 1.35;">
            Aclaración de Firma: ___________________________________<br/>
            Cédula de Identidad: ____________________ Celular: ____________________
          </div>
        </div>

        <div style="width: 45%;">
          <!-- Espacio vertical despejado para estampar sello físico y firma profesional -->
          <div style="height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6px;">
            <!-- Espacio limpio reservado para estampar el sello físico real del centro -->
          </div>
          <div style="border-top: 1.5px solid #27345F; padding-top: 4px; font-weight: bold; font-size: 8.5pt; color: #27345F;">
            ${this.escapeHtml(therapistName)}
          </div>
          <div style="font-size: 7.5pt; color: #64748B; margin-top: 3px; line-height: 1.35;">
            ${this.escapeHtml(therapistRole)}${this.escapeHtml(therapistMat)}<br/>
            Centro "PSI Aprende" · Sede Cochabamba
          </div>
        </div>
      </div>
    `;

    this.printDocumentViaIframe('Plantilla Física de Consentimiento Informado', html);
  }

  printDocumentViaIframe(title, bodyHtml) {
    let iframe = document.getElementById('print-doc-isolated-iframe-clinical');
    if (iframe) {
      iframe.remove();
    }
    iframe = document.createElement('iframe');
    iframe.id = 'print-doc-isolated-iframe-clinical';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${title || 'Documento Oficial - PSI Aprende'}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 8mm 12mm 8mm 12mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            color: #1e293b;
            background: #ffffff;
            font-size: 8.5pt;
            line-height: 1.32;
            padding: 0;
          }
          p { margin: 0 0 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
          th, td { border: 1px solid #cbd5e1; padding: 4px 8px; text-align: left; }
          th { background: #f1f5f9; font-weight: bold; }
          img, .mammoth-rendered-document img {
            max-height: 38px !important;
            max-width: 140px !important;
            object-fit: contain !important;
            display: block;
            margin: 4px auto !important;
          }
          .no-print-seal {
            display: none !important;
          }
          div, table, section {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
      </html>
    `;

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(fullHtml);
    doc.close();

    const doPrint = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Error al imprimir iframe:', err);
      }
    };

    setTimeout(doPrint, 300);
  }

  _fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  async openConsentDetailModal(consentId) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    try {
      const res = await apiClient.get(`/consents/${consentId}`);
      const c = res.data;

      const isImageBlob = c.firma_digital_blob && c.firma_digital_blob.startsWith('data:image/');
      const isPdfBlob = c.firma_digital_blob && c.firma_digital_blob.startsWith('data:application/pdf');

      const loggedUser = store.getState().user;
      const therapistName = c.terapeuta_nombres 
        ? `Lic. ${c.terapeuta_nombres} ${c.terapeuta_apellidos}` 
        : (this.currentHistory?.terapeuta_nombres 
            ? `Lic. ${this.currentHistory.terapeuta_nombres} ${this.currentHistory.terapeuta_apellidos}` 
            : (loggedUser?.rol === 'TERAPEUTA' ? loggedUser.nombre_completo : 'Especialista a Cargo'));
      const therapistRole = c.especialidad_nombre || this.currentHistory?.especialidad_nombre || 'Especialista en Psicología';
      const therapistMat = (c.terapeuta_matricula || this.currentHistory?.terapeuta_matricula) 
        ? ` · Mat. CPB: ${c.terapeuta_matricula || this.currentHistory.terapeuta_matricula}` 
        : '';

      modalContainer.innerHTML = `
        <div class="modal-backdrop" id="consent-detail-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
          <div class="soft-modal-card" style="max-width: 760px; width: 100%; max-height: 92vh; display: flex; flex-direction: column;">
            
            <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.fileCheck(20, 'var(--soft-purple-primary)')}
                </div>
                <div>
                  <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0;">
                    Certificado de Consentimiento Informado
                  </h3>
                  <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                    Expediente: <strong>${c.paciente_codigo}</strong> · ${c.paciente_nombres} ${c.paciente_apellidos}
                  </div>
                </div>
              </div>
              <button type="button" id="btn-close-detail-consent" class="soft-modal-close-btn" title="Cerrar">
                ${Icons.close(18)}
              </button>
            </div>

            <!-- CUERPO IMPRIMIBLE -->
            <div id="printable-consent-area" style="padding: 2rem 2.2rem; overflow-y: auto; flex: 1; background: #FFFFFF; font-size: 0.86rem; color: var(--soft-text-title); line-height: 1.6;">
              <!-- MEMBRETE OFICIAL -->
              <div style="text-align: center; border-bottom: 2px solid var(--soft-indigo-heading); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                <div style="font-size: 1.15rem; font-weight: 800; color: var(--soft-indigo-heading); letter-spacing: -0.02em;">
                  CENTRO PSICOPEDAGÓGICO Y DE ATENCIÓN PSICOLÓGICA "PSI APRENDE"
                </div>
                <div style="font-size: 0.75rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                  Dirección General: ${this.escapeHtml(this._getInstDirector())} · Cochabamba, Bolivia
                </div>
                <div style="font-size: 0.72rem; color: var(--soft-text-muted);">
                  ${this.escapeHtml(this._getInstAddress())}
                </div>
              </div>

              <div style="text-align: center; margin-bottom: 1rem;">
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.82rem; font-weight: 800; text-transform: uppercase;">
                  ${this.escapeHtml(c.titulo)}
                </span>
              </div>

              <!-- DATOS LEGALES -->
              <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.78rem;">
                <div><strong>Menor / Paciente:</strong> ${c.paciente_nombres} ${c.paciente_apellidos}</div>
                <div><strong>C.I. Menor:</strong> ${c.paciente_ci || 'No registrado'}</div>
                <div><strong>Tutor Firmante:</strong> ${this.escapeHtml(c.firmado_por_nombre)}</div>
                <div><strong>C.I. Firmante:</strong> ${this.escapeHtml(c.firmado_por_ci)}</div>
                <div><strong>Parentesco:</strong> ${this.escapeHtml(c.parentesco)}</div>
                <div><strong>Fecha y Hora de Firma:</strong> ${c.fecha_firma ? c.fecha_firma.replace('T', ' ').substring(0, 19) : ''}</div>
                <div><strong>IP de Registro:</strong> ${c.ip_registro || '127.0.0.1'}</div>
                <div><strong>Estado de Validez:</strong> <span style="color: var(--soft-emerald-dark); font-weight: 700;">${c.estado}</span></div>
              </div>

              <!-- TEXTO DE CLÁUSULAS -->
              <div style="margin-bottom: 1.25rem; font-size: 0.8rem; color: var(--soft-text-body); white-space: pre-line; line-height: 1.42;">
                ${this.escapeHtml(c.contenido_clausulas)}
              </div>

              <!-- FIRMA ESTAMPADA DEL TUTOR Y ACREDITACIÓN PROFESIONAL -->
              <div style="margin-top: 2.25rem; padding-top: 1.25rem; border-top: 1px dashed var(--soft-border-card-inner); display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; text-align: center; page-break-inside: avoid; align-items: flex-end;">
                <!-- ÚNICA FIRMA LEGAL: TUTOR / FIRMANTE -->
                <div>
                  <div style="height: 52px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 0.5rem;">
                    ${isImageBlob ? `
                      <img src="${c.firma_digital_blob}" alt="Firma manuscrita" style="max-height: 48px; max-width: 150px; object-fit: contain;" />
                    ` : (isPdfBlob ? `
                      <span style="font-size: 0.74rem; color: var(--soft-purple-primary); font-weight: 700;">Documento PDF Escaneado Adjunto</span>
                    ` : `
                      <span style="font-size: 0.74rem; color: var(--soft-text-muted);">Firma legal registrada</span>
                    `)}
                  </div>
                  <div style="border-top: 1.5px solid var(--soft-text-title); padding-top: 0.4rem; font-weight: 800; font-size: 0.84rem; color: var(--soft-text-title);">
                    ${this.escapeHtml(c.firmado_por_nombre)}
                  </div>
                  <div style="font-size: 0.74rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                    C.I.: ${this.escapeHtml(c.firmado_por_ci)} · ${this.escapeHtml(c.parentesco)}
                  </div>
                  <div style="font-size: 0.7rem; color: var(--soft-emerald-dark); font-weight: 700; margin-top: 0.2rem;">
                    Firma de Consentimiento Legal Acreditada
                  </div>
                </div>

                <!-- ACREDITACIÓN INSTITUCIONAL DEL ESPECIALISTA ASIGNADO (SIN LÍNEA DE FIRMA VACÍA) -->
                <div style="text-align: center; background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 1rem 1.2rem; box-sizing: border-box;">
                  <div style="font-size: 0.68rem; color: var(--soft-purple-primary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem;">
                    Atención Profesional Asignada
                  </div>
                  <div style="font-weight: 800; font-size: 0.88rem; color: var(--soft-text-title);">
                    ${this.escapeHtml(therapistName)}
                  </div>
                  <div style="font-size: 0.74rem; color: var(--soft-text-body); margin-top: 0.2rem;">
                    ${this.escapeHtml(therapistRole)}${this.escapeHtml(therapistMat)}
                  </div>
                  <div style="font-size: 0.7rem; color: var(--soft-text-muted); margin-top: 0.35rem;">
                    Centro PSI Aprende · ${this.escapeHtml(this._getInstAddress().split(',')[0])}
                  </div>
                </div>
              </div>
            </div>

            <!-- PIE DE ACCIONES -->
            <div style="padding: 1rem 1.65rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
              <button type="button" id="btn-print-consent-doc" class="soft-btn soft-btn-lvl-2">
                ${Icons.printer(16, '#FFFFFF')}
                <span>Imprimir Certificado</span>
              </button>
              <button type="button" id="btn-close-detail-consent-footer" class="soft-btn soft-btn-lvl-2-soft">
                Cerrar
              </button>
            </div>

          </div>
        </div>
      `;

      const closeModal = () => { modalContainer.innerHTML = ''; };
      document.getElementById('btn-close-detail-consent')?.addEventListener('click', closeModal);
      document.getElementById('btn-close-detail-consent-footer')?.addEventListener('click', closeModal);
      
      // Impresión aislada por IFRAME (evita páginas en blanco al 100%)
      document.getElementById('btn-print-consent-doc')?.addEventListener('click', () => {
        const printableArea = document.getElementById('printable-consent-area');
        if (printableArea) {
          this.printDocumentViaIframe(`Consentimiento Informado - ${c.paciente_nombres} ${c.paciente_apellidos}`, printableArea.innerHTML);
        }
      });
    } catch (e) {
      Toast.error('No se pudo cargar el consentimiento: ' + e.message);
    }
  }

  async revokeConsentModal(consentId) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="revoke-consent-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2100; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 500px; width: 100%;">
          
          <div style="padding: 1.25rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-amber">
                ${Icons.alertTriangle(20, 'var(--soft-coral-alert)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.1rem; font-weight: 800; margin: 0;">
                  Revocar Consentimiento Informado
                </h3>
                <div style="font-size: 0.76rem; color: var(--soft-text-body);">
                  Acción Médico-Legal · Ley 548 y Ley 3131
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-revoke-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <form id="form-revoke-consent" style="padding: 1.5rem 1.65rem; display: flex; flex-direction: column; gap: 1rem;">
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 0.85rem 1rem; font-size: 0.82rem; color: #991B1B; line-height: 1.45;">
              <strong>Advertencia Legal:</strong> La revocación anula la autorización clínica y queda registrada de forma permanente en la auditoría inalterable del expediente del paciente.
            </div>

            <div>
              <label class="soft-label" for="input-revoke-motivo" style="font-weight: 700; font-size: 0.82rem; color: var(--soft-text-title); display: block; margin-bottom: 0.35rem;">
                Motivo médico-legal de la revocación *
              </label>
              <textarea 
                id="input-revoke-motivo" 
                name="motivo" 
                rows="3" 
                required 
                placeholder="Describa claramente la causa o justificación clínica o familiar de la revocación..." 
                class="soft-input" 
                style="width: 100%; resize: vertical; font-size: 0.85rem; padding: 0.65rem 0.85rem;"
              ></textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
              <button type="button" id="btn-cancel-revoke-modal" class="soft-btn soft-btn-lvl-2-soft">
                Cancelar
              </button>
              <button type="submit" class="soft-btn soft-btn-lvl-2" style="background: var(--soft-coral-alert, #E11D48); color: #FFFFFF;">
                ${Icons.alertTriangle(15, '#FFFFFF')}
                <span>Confirmar Revocación Legal</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-revoke-modal')?.addEventListener('click', close);
    document.getElementById('btn-cancel-revoke-modal')?.addEventListener('click', close);

    document.getElementById('form-revoke-consent')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const motivo = document.getElementById('input-revoke-motivo')?.value.trim();
      if (!motivo) {
        Toast.error('Debe ingresar el motivo de la revocación');
        return;
      }
      try {
        await apiClient.post(`/consents/${consentId}/revoke`, { motivo });
        Toast.success('El consentimiento ha sido revocado legalmente.');
        close();
        await this.loadHistoryDetail(this.selectedHistoryId);
      } catch (err) {
        Toast.error('Error al revocar: ' + err.message);
      }
    });
  }

  openFamilyReportModal() {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer || !this.currentHistory) return;

    const h = this.currentHistory;
    const today = getBoliviaTodayDateString();

    let isAdult = false;
    if (h.paciente_fecha_nacimiento) {
      const birth = new Date(h.paciente_fecha_nacimiento);
      const now = new Date();
      let years = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
      if (years >= 18) isAdult = true;
    }
    if (h.tutor_principal && h.tutor_principal.parentesco === 'TITULAR_PACIENTE') isAdult = true;

    const defaultTitle = `Reporte de Avance Terapéutico y Orientación Familiar - ${h.paciente_nombres} ${h.paciente_apellidos}`;

    const defaultObjetivos = isAdult
      ? `Durante este ciclo de psicoterapia y acompañamiento, hemos enfocado el trabajo en el fortalecimiento de la regulación emocional, el manejo saludable del estrés cotidiano y el desarrollo de estrategias de resolución adaptativa de problemas.`
      : `Durante este ciclo de atención en el centro, hemos enfocado las sesiones en el fortalecimiento de la atención, la autorregulación emocional, el seguimiento de instrucciones y el desarrollo de habilidades sociales y de aprendizaje.`;

    const defaultLogros = isAdult
      ? `Se observan avances muy consistentes en la identificación temprana de factores de tensión, mayor claridad para poner límites personales y una respuesta proactiva ante los objetivos planteados en consulta.`
      : `El/la paciente muestra un progreso notable en su capacidad de concentración sostenida, mayor entusiasmo ante las actividades lúdico-pedagógicas y una actitud colaborativa y cariñosa en cada sesión.`;

    const defaultFortalecimiento = isAdult
      ? `Continuamos acompañando la consolidación de rutinas de autocuidado y descanso, así como la flexibilidad cognitiva ante imprevistos laborales o familiares.`
      : `Continuamos afianzando la tolerancia a la frustración cuando enfrenta tareas complejas, el orden en sus tiempos de estudio y la pausa reflexiva antes de actuar impulsivamente.`;

    const defaultPautasHogar = isAdult
      ? `• Reservar momentos diarios de desconexión digital para favorecer la higiene mental y el descanso.
• Practicar las técnicas de respiración consciente acordadas en las sesiones ante momentos de sobrecarga.
• Mantener hábitos regulares de actividad física y sueño.`
      : `• Brindar refuerzo positivo inmediato: felicitar el esfuerzo diario y no únicamente las calificaciones o resultados.
• Establecer un cronograma visual sencillo en casa con horarios claros para tareas, juego y descanso.
• Practicar pausas activas breves de 5 minutos entre actividades escolares para evitar la fatiga mental.`;

    const defaultProximosPasos = `Se recomienda mantener la continuidad y frecuencia de las sesiones de acuerdo con el plan terapéutico trazado, en estrecha colaboración entre la familia y el centro "PSI Aprende".`;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="family-report-modal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 820px; width: 100%; max-height: 92vh; display: flex; flex-direction: column;">
          
          <!-- CABECERA MODAL SOFT UI -->
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: #ECFDF5; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm" style="background: #D1FAE5; color: #059669;">
                ${Icons.fileText(20, '#059669')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0; letter-spacing: -0.015em;">
                  Reporte de Avance Terapéutico Familiar
                </h3>
                <div style="font-size: 0.78rem; color: #047857; margin-top: 0.12rem;">
                  Documento claro, cálido y sin tecnicismos para orientar y compartir logros con la familia · Paciente: <strong>${this.escapeHtml(h.paciente_nombres)} ${this.escapeHtml(h.paciente_apellidos)}</strong>
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-family-report-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- FORMULARIO -->
          <form id="form-create-family-report" style="display: flex; flex-direction: column; flex: 1; overflow-y: auto; margin: 0;">
            <input type="hidden" name="tipo_informe" value="REPORTE_FAMILIAR_AVANCE" />
            
            <div style="padding: 1.5rem 1.65rem; display: flex; flex-direction: column; gap: 1.15rem;">

              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 0.85rem 1.1rem; display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.25rem;">🌱</span>
                <span style="font-size: 0.82rem; color: #065F46; line-height: 1.45;">
                  <strong>Enfoque Familiar:</strong> Este reporte compila un archivo Word formal con membrete del centro, pero omite baremos psicométricos densos o códigos diagnósticos complejos para facilitar la lectura, motivación y comprensión total de los tutores.
                </span>
              </div>

              <!-- TÍTULO Y FECHA -->
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
                <div>
                  <label class="soft-form-label" style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">
                    Título del Reporte *
                  </label>
                  <input type="text" name="titulo" class="soft-input" value="${this.escapeHtml(defaultTitle)}" required />
                </div>
                <div>
                  <label class="soft-form-label" style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">
                    Fecha de Emisión *
                  </label>
                  <input type="date" name="fecha_emision" class="soft-input" value="${today}" required />
                </div>
              </div>

              <!-- SECCIÓN 1: OBJETIVOS -->
              <div>
                <label class="soft-form-label" style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">
                  1. Objetivos Terapéuticos y Foco Trabajado en Sesión *
                </label>
                <textarea name="motivo_evaluacion" class="soft-input" rows="3" required style="resize: vertical; font-size: 0.84rem; line-height: 1.5;">${defaultObjetivos}</textarea>
              </div>

              <!-- SECCIÓN 2: LOGROS OBSERVADOS -->
              <div>
                <label class="soft-form-label" style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">
                  2. Logros y Avances Observados en el Paciente *
                </label>
                <textarea name="resultados_cuantitativos" class="soft-input" rows="3" required style="resize: vertical; font-size: 0.84rem; line-height: 1.5;">${defaultLogros}</textarea>
              </div>

              <!-- SECCIÓN 3: ASPECTOS EN FORTALECIMIENTO -->
              <div>
                <label class="soft-form-label" style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">
                  3. Aspectos en Proceso de Fortalecimiento y Seguimiento *
                </label>
                <textarea name="conclusiones_cualitativas" class="soft-input" rows="3" required style="resize: vertical; font-size: 0.84rem; line-height: 1.5;">${defaultFortalecimiento}</textarea>
              </div>

              <!-- SECCIÓN 4: PAUTAS PARA EL HOGAR -->
              <div>
                <label class="soft-form-label" style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">
                  4. Pautas y Recomendaciones Prácticas para la Familia en el Hogar *
                </label>
                <textarea name="recomendaciones_familia" class="soft-input" rows="4" required style="resize: vertical; font-size: 0.84rem; line-height: 1.5;">${defaultPautasHogar}</textarea>
              </div>

              <!-- SECCIÓN 5: PRÓXIMOS PASOS -->
              <div>
                <label class="soft-form-label" style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">
                  5. Próximos Pasos y Continuidad Terapéutica *
                </label>
                <textarea name="recomendaciones_colegio" class="soft-input" rows="2" required style="resize: vertical; font-size: 0.84rem; line-height: 1.5;">${defaultProximosPasos}</textarea>
              </div>

              <!-- ENTREGA FAMILIAR -->
              <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.9rem 1.15rem; display: flex; align-items: center; gap: 0.75rem;">
                <input type="checkbox" id="chk-family-report-deliverable" name="entregable_familiar" value="1" checked style="width: 18px; height: 18px; accent-color: #10B981;" />
                <label for="chk-family-report-deliverable" style="font-size: 0.84rem; color: var(--soft-text-title); cursor: pointer; user-select: none;">
                  <strong>Habilitar visualización y descarga en el Portal del Tutor Familiar</strong>
                  <div style="font-size: 0.76rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                    Al estar marcado, los tutores o el paciente titular podrán consultar y descargar este reporte desde su sección de documentos.
                  </div>
                </label>
              </div>

            </div>

            <!-- PIE DE ACCIONES MODAL -->
            <div style="padding: 1.1rem 1.65rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; align-items: center; gap: 0.75rem; background: var(--soft-lavender-surface);">
              <button type="button" id="btn-cancel-family-report" class="soft-btn soft-btn-lvl-2-soft">
                Cancelar
              </button>
              <button type="submit" id="btn-submit-family-report" class="soft-btn soft-btn-lvl-2">
                ${Icons.fileWord(16, '#FFFFFF')}
                <span>Compilar y Generar Reporte Word</span>
              </button>
            </div>

          </form>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-family-report-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-family-report')?.addEventListener('click', closeModal);
    document.getElementById('family-report-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'family-report-modal-backdrop') closeModal();
    });

    const form = document.getElementById('form-create-family-report');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);

        const payload = {
          paciente_id: h.paciente_id,
          historia_id: h.id,
          tipo_informe: 'REPORTE_FAMILIAR_AVANCE',
          titulo: formData.get('titulo'),
          motivo_evaluacion: formData.get('motivo_evaluacion'),
          resultados_cuantitativos: formData.get('resultados_cuantitativos'),
          conclusiones_cualitativas: formData.get('conclusiones_cualitativas'),
          recomendaciones_familia: formData.get('recomendaciones_familia'),
          recomendaciones_colegio: formData.get('recomendaciones_colegio'),
          entregable_familiar: formData.get('entregable_familiar') === '1'
        };

        const submitBtn = document.getElementById('btn-submit-family-report');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Compilando reporte en Word...</span>`;
        }

        try {
          const res = await apiClient.post('/reports', payload);
          Toast.success('¡Reporte familiar de avance generado exitosamente!');
          closeModal();
          this.activeTab = 'reports';
          await this.loadHistoryDetail(this.selectedHistoryId);
          if (res.data?.id) {
            this.previewReportWithMammoth(res.data.id);
          }
        } catch (err) {
          Toast.error('Error al generar reporte familiar: ' + err.message);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `${Icons.fileWord(16, '#FFFFFF')} <span>Compilar y Generar Reporte Word</span>`;
          }
        }
      });
    }
  }

  openUploadSignedModal(reportId) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer || !this.currentHistory) return;

    const currentUser = store.getState().user;
    const hasStoredSig = !!(currentUser?.firma_digital_blob || currentUser?.terapeuta?.firma_digital_blob);

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="upload-signed-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 560px; width: 100%;">
          
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.upload(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Firma y Sello Oficial del Informe
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Expediente ${this.escapeHtml(this.currentHistory?.numero_expediente || 'Clínico')}
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-upload-signed-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <div style="padding: 1.5rem 1.65rem; display: flex; flex-direction: column; gap: 1.1rem; margin: 0;">
            ${hasStoredSig ? `
              <div style="background: rgba(15, 118, 110, 0.08); border: 1.5px solid rgba(15, 118, 110, 0.25); border-radius: 12px; padding: 1rem 1.15rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
                  <div style="display: flex; align-items: center; gap: 0.65rem;">
                    <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                      ${Icons.signature(18, 'var(--soft-mint-deep)')}
                    </div>
                    <div>
                      <div style="font-weight: 800; font-size: 0.88rem; color: var(--soft-text-title);">
                        Rúbrica Colegiada Vinculada
                      </div>
                      <div style="font-size: 0.76rem; color: var(--soft-text-body);">
                        Estampa tu firma guardada directamente sobre este informe Word.
                      </div>
                    </div>
                  </div>
                  <button type="button" id="btn-stamp-from-upload-modal" class="soft-btn soft-btn-sm soft-btn-lvl-2">
                    ${Icons.signature(14, '#FFFFFF')}
                    <span>Estampar mi Firma Ahora</span>
                  </button>
                </div>
              </div>
              <div style="text-align: center; margin: 0.2rem 0; font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                — O subir documento firmado escaneado en papel —
              </div>
            ` : `
              <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 10px; padding: 0.75rem 0.95rem; font-size: 0.78rem; color: #92400E; display: flex; align-items: center; justify-content: space-between; gap: 0.6rem;">
                <span>💡 Puedes registrar tu firma digital en tu <strong>Perfil</strong> para estampar informes con 1 solo clic.</span>
                <a href="#/profile" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="font-size: 0.72rem; flex-shrink: 0;">Configurar</a>
              </div>
            `}

            <form id="form-upload-signed-report" style="display: flex; flex-direction: column; gap: 1.1rem; margin: 0;">
              <p style="font-size: 0.84rem; color: var(--soft-text-body); margin: 0; line-height: 1.45;">
                Sube el documento escaneado en formato PDF, Word o imagen que contenga la firma autógrafa y el sello colegiado del especialista tratante.
              </p>

              <div style="border: 2px dashed var(--soft-border-card-inner); border-radius: 12px; padding: 1.6rem 1.2rem; text-align: center; background: var(--soft-lavender-surface); cursor: pointer; transition: all 0.2s;" id="dropzone-signed-report">
                <input type="file" id="input-signed-file" name="archivo_firmado" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg" style="display: none;" required />
                <div class="soft-icon-box soft-icon-box-md soft-icon-box-lavender" style="margin: 0 auto 0.75rem auto;">
                  ${Icons.fileText(24, 'var(--soft-purple-primary)')}
                </div>
                <div style="font-weight: 700; font-size: 0.88rem; color: var(--soft-text-title); margin-bottom: 0.25rem;" id="txt-selected-filename">
                  Haz clic para seleccionar el archivo firmado
                </div>
                <div style="font-size: 0.76rem; color: var(--soft-text-muted);">
                  Formatos permitidos: PDF, Word o imágenes PNG y JPG · Máximo 15 MB
                </div>
              </div>

              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px; padding: 0.75rem 0.95rem; font-size: 0.8rem; color: #065F46; display: flex; align-items: center; gap: 0.6rem;">
                <span class="soft-status-dot"></span>
                <span>Al confirmarse, el estado del informe cambiará automáticamente a <strong>"FIRMADO"</strong> y quedará resguardado permanentemente.</span>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.3rem;">
                <button type="button" id="btn-cancel-upload-signed" class="soft-btn soft-btn-lvl-2-soft">
                  Cancelar
                </button>
                <button type="submit" id="btn-submit-upload-signed" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(16, '#FFFFFF')}
                  <span>Guardar y Sellar en Expediente</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-upload-signed-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-upload-signed')?.addEventListener('click', closeModal);
    document.getElementById('upload-signed-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'upload-signed-backdrop') closeModal();
    });

    const dropzone = document.getElementById('dropzone-signed-report');
    const fileInput = document.getElementById('input-signed-file');
    const labelTxt = document.getElementById('txt-selected-filename');

    dropzone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        const f = fileInput.files[0];
        const sz = (f.size / (1024 * 1024)).toFixed(2);
        if (labelTxt) {
          labelTxt.innerHTML = `📄 <strong>${this.escapeHtml(f.name)}</strong> (${sz} MB)`;
        }
        dropzone.style.borderColor = 'var(--soft-purple-primary)';
        dropzone.style.background = '#FFFFFF';
      }
    });

    const btnStampInModal = document.getElementById('btn-stamp-from-upload-modal');
    if (btnStampInModal) {
      btnStampInModal.addEventListener('click', () => {
        closeModal();
        this.stampReportSignature(reportId);
      });
    }

    const form = document.getElementById('form-upload-signed-report');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!fileInput.files || fileInput.files.length === 0) {
          Toast.error('Por favor, selecciona un archivo firmado para adjuntar.');
          return;
        }

        const formData = new FormData();
        formData.append('archivo_firmado', fileInput.files[0]);

        const submitBtn = document.getElementById('btn-submit-upload-signed');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Adjuntando y sellando...</span>`;
        }

        try {
          const token = store.getState().token || localStorage.getItem('psi_token') || '';
          const response = await fetch(`/api/reports/${reportId}/upload-signed`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || 'Error al subir informe firmado');
          }

          Toast.success('¡Informe firmado adjuntado con éxito al expediente!');
          closeModal();
          this.activeTab = 'reports';
          await this.loadHistoryDetail(this.selectedHistoryId);
        } catch (err) {
          Toast.error('Error: ' + err.message);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `${Icons.check(16, '#FFFFFF')} <span>Guardar y Sellar en Expediente</span>`;
          }
        }
      });
    }
  }

  async stampReportSignature(reportId) {
    if (!reportId) return;

    const user = store.getState().user;
    const hasSig = !!(user?.firma_digital_blob || user?.terapeuta?.firma_digital_blob);
    if (!hasSig) {
      this.openNoSignatureAlertModal();
      return;
    }

    Toast.info('Estampando firma digital colegiada...');
    try {
      const res = await apiClient.post(`/reports/${reportId}/stamp-signature`);
      if (res.success) {
        Toast.success('Firma digital colegiada estampada con éxito en el informe oficial.');
        const modalContainer = document.getElementById('modal-container-clinical');
        if (modalContainer) modalContainer.innerHTML = '';
        this.activeTab = 'reports';
        await this.loadHistoryDetail(this.selectedHistoryId);
      }
    } catch (err) {
      if (err.message && err.message.includes('perfil')) {
        this.openNoSignatureAlertModal();
      } else {
        Toast.error(err.message || 'Error al estampar firma digital.');
      }
    }
  }

  openNoSignatureAlertModal() {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2500; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 480px; width: 100%;">
          <div style="padding: 1.6rem 1.8rem; text-align: center;">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1rem auto;">
              ${Icons.signature(28, 'var(--soft-purple-primary)')}
            </div>
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.2rem; font-weight: 800; color: var(--soft-text-title);">
              Firma Digital No Configurada
            </h3>
            <p style="font-size: 0.88rem; color: var(--soft-text-body); margin: 0 0 1.5rem 0; line-height: 1.5;">
              Para estampar informes con 1 solo clic, primero debes registrar tu rúbrica o firma manuscrita en tu perfil de usuario institucional.
            </p>
            <div style="display: flex; gap: 0.75rem; justify-content: center;">
              <button type="button" id="btn-close-no-sig-modal" class="soft-btn soft-btn-lvl-2-soft" style="flex: 1;">
                Entendido
              </button>
              <a href="#/profile" class="soft-btn soft-btn-lvl-1" style="flex: 1; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;">
                ${Icons.signature(14, '#FFFFFF')}
                <span>Ir a mi Perfil</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-close-no-sig-modal')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });
  }

  downloadSignedReport(reportId) {
    const token = store.getState().token || localStorage.getItem('psi_token') || '';
    window.open(`/api/reports/${reportId}/signed?token=${token}`, '_blank');
  }

  openReportModal(reportId = null) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer || !this.currentHistory) return;

    const h = this.currentHistory;
    const today = getBoliviaTodayDateString();

    let isAdult = false;
    if (h.paciente_fecha_nacimiento) {
      const birth = new Date(h.paciente_fecha_nacimiento);
      const now = new Date();
      let years = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
      if (years >= 18) isAdult = true;
    }
    if (h.tutor_principal && h.tutor_principal.parentesco === 'TITULAR_PACIENTE') isAdult = true;

    const defaultBatteryName = isAdult ? 'WAIS-IV' : 'WISC-V';
    const defaultBatteryArea = isAdult ? 'Comprensión Verbal y Memoria de Trabajo' : 'Comprensión Verbal e Inteligencia';
    const defaultBatteryScore = isAdult ? '112' : '108';
    const defaultBatteryPc = isAdult ? 'Pc 79' : 'Pc 70';

    const defaultDiagCode = isAdult ? '6D70 (F06.7)' : '6A05 (F90.0)';
    const defaultDiagDesc = isAdult 
      ? 'Evaluación Neurocognitiva Integral / Trastorno Neurocognitivo Leve o Adaptativo'
      : 'Trastorno por Déficit de Atención con Hiperactividad con presentación combinada';

    const labelRecA = isAdult ? '5.A. Recomendaciones Laborales / Ocupacionales' : '5.A. Recomendaciones para el Colegio';
    const labelRecB = isAdult ? '5.B. Recomendaciones Personales y Compensación' : '5.B. Recomendaciones para el Hogar';

    const defaultRecA = isAdult
      ? `• Implementar sistemas de listas de verificación y recordatorios digitales para tareas secuenciales en el entorno laboral.
• Segmentar jornadas de alta demanda cognitiva en bloques de 45 minutos con pausas breves de 5 minutos.`
      : `• Brindar tiempo adicional del 25% para resolución de pruebas escritas.
• Sentar al estudiante en las primeras filas del aula, lejos de ventanas o distractores sonoros.
• Segmentar consignas largas en instrucciones secuenciales cortas.`;

    const defaultRecB = isAdult
      ? `• Establecer higiene del sueño rigurosa y actividad física aeróbica 3 veces por semana.
• Practicar ejercicios de gimnasia cerebral y memoria operativa guiados en la plataforma.`
      : `• Establecer un cronograma visual de tareas con pausas activas de 5 minutos cada 25 minutos de estudio.
• Reforzar conductas de culminación de actividades mediante elogios específicos y contingentes.`;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="report-modal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 860px; width: 100%; max-height: 92vh; display: flex; flex-direction: column;">
          
          <!-- CABECERA MODAL (NIVEL 2) -->
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.fileWord(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0; letter-spacing: -0.015em;">
                  Compilador de Informe Clínico Oficial
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Paciente: <strong>${this.escapeHtml(h.paciente_nombres)} ${this.escapeHtml(h.paciente_apellidos)}</strong> · Expediente ${h.numero_expediente}
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-report-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- CUERPO MODAL -->
          <div style="padding: 1.35rem 1.65rem; overflow-y: auto; flex: 1;">
            <form id="form-create-report">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label class="soft-label">Tipo de Informe Clínico <span class="required">*</span></label>
                  <select name="tipo_informe" id="select-report-type" required class="soft-select">
                    <option value="EVALUACION_NEUROPSICOLOGICA" selected>Evaluación Neuropsicológica Clínica</option>
                    <option value="INFORME_PSICOPEDAGOGICO">Informe Psicopedagógico y de Aprendizaje</option>
                    <option value="VALORACION_GERONTOLOGICA">Valoración Gerontológica Integral VGI</option>
                    <option value="EVOLUCION_CLINICA">Informe de Evolución y Progreso</option>
                    <option value="INFORME_ESCOLAR">Dictamen Escolar Adaptativo</option>
                  </select>
                </div>
                <div>
                  <label class="soft-label">Título del Documento <span class="required">*</span></label>
                  <input type="text" name="titulo" id="input-report-title" required class="soft-input" value="INFORME DE EVALUACIÓN NEUROPSICOLÓGICA CLÍNICA" />
                </div>
              </div>

              <div style="margin-bottom: 1rem;">
                <label class="soft-label">1. Motivo de Consulta o Evaluación <span class="required">*</span></label>
                <textarea name="motivo_evaluacion" rows="3" required class="soft-textarea" placeholder="Describa el motivo por el cual se realizó la evaluación...">${this.anamnesis ? (this.anamnesis.motivo_consulta || '') : ''}</textarea>
              </div>

              <div style="margin-bottom: 1rem;">
                <label class="soft-label">Antecedentes Madurativos o Historial Relevante</label>
                <textarea name="antecedentes_relevantes" rows="2" class="soft-textarea" placeholder="Antecedentes médicos, escolares o perinatales relevantes...">${this.anamnesis ? (this.anamnesis.antecedentes_personales || '') : ''}</textarea>
              </div>

              <!-- BATERÍAS NEUROPSICOLÓGICAS (SELECTOR DINÁMICO) -->
              <div style="margin-bottom: 1rem; background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                  <label class="soft-label" style="margin: 0;">2. Baterías y Pruebas Psicométricas Administradas</label>
                  <button type="button" id="btn-add-battery-row" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">
                    ${Icons.plus(12)}
                    <span>Agregar Batería</span>
                  </button>
                </div>

                <div id="batteries-container" style="display: flex; flex-direction: column; gap: 0.6rem;">
                  <!-- Fila 1 predeterminada -->
                  <div class="battery-row" style="display: grid; grid-template-columns: 2fr 2fr 1fr 1fr auto; gap: 0.5rem; align-items: center;">
                    <input type="text" class="soft-input soft-input-sm b-nombre" placeholder="Prueba" value="${defaultBatteryName}" />
                    <input type="text" class="soft-input soft-input-sm b-area" placeholder="Área Evaluada" value="${defaultBatteryArea}" />
                    <input type="text" class="soft-input soft-input-sm b-puntuacion" placeholder="Puntuación" value="${defaultBatteryScore}" />
                    <input type="text" class="soft-input soft-input-sm b-interpretacion" placeholder="Percentil" value="${defaultBatteryPc}" />
                    <button type="button" class="btn-remove-battery soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="padding: 0.3rem 0.5rem;">✕</button>
                  </div>
                </div>
              </div>

              <div style="margin-bottom: 1rem;">
                <label class="soft-label">3. Resultados Cuantitativos y Análisis Cualitativo <span class="required">*</span></label>
                <textarea name="resultados_cuantitativos" rows="3" required class="soft-textarea" placeholder="Desglose de resultados por funciones cognitivas: atención, memoria, lenguaje, funciones ejecutivas...">${isAdult ? 'El perfil neurocognitivo evaluado refleja un rendimiento intelectual general acorde a su grupo etario y nivel académico, con funciones ejecutivas preservadas y leve lentitud en tareas de velocidad de procesamiento bajo presión de tiempo.' : 'El perfil cognitivo evaluado refleja un rendimiento promedio general con fortalezas notables en el razonamiento visoespacial. Se aprecian dificultades moderadas en la memoria de trabajo y la velocidad de procesamiento.'}</textarea>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label class="soft-label">Código Diagnóstico CIE-11 y DSM-5</label>
                  <input type="text" name="diagnostico_codigo" class="soft-input" value="${defaultDiagCode}" placeholder="Ej. 6A05 / F90" />
                </div>
                <div>
                  <label class="soft-label">Descripción Diagnóstica</label>
                  <input type="text" name="diagnostico_descripcion" class="soft-input" value="${defaultDiagDesc}" placeholder="Ej. TDAH, Trastorno Específico del Aprendizaje..." />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label class="soft-label">${labelRecA}</label>
                  <textarea name="recomendaciones_colegio" rows="3" class="soft-textarea" placeholder="Adaptaciones y estrategias...">${defaultRecA}</textarea>
                </div>
                <div>
                  <label class="soft-label">${labelRecB}</label>
                  <textarea name="recomendaciones_familia" rows="3" class="soft-textarea" placeholder="Rutinas y compensación...">${defaultRecB}</textarea>
                </div>
              </div>

              <div style="margin-bottom: 1rem; background: var(--soft-lavender-surface); padding: 0.85rem 1rem; border-radius: 12px; border: 1px solid var(--soft-border-card-inner);">
                <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; margin: 0; font-size: 0.86rem; color: var(--soft-text-title); font-weight: 700;">
                  <input type="checkbox" name="entregable_familiar" value="1" checked style="width: 17px; height: 17px; accent-color: var(--soft-purple-primary);" />
                  <span>Autorizar entrega y visualización al Portal del Tutor Familiar</span>
                </label>
                <div style="font-size: 0.74rem; color: var(--soft-text-body); margin-top: 0.2rem; margin-left: 2rem;">
                  Si está marcado, los padres podrán previsualizar y descargar este informe oficial desde su panel.
                </div>
              </div>

              <!-- PIE DE MODAL (NIVEL 2) -->
              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-report-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" id="btn-submit-report-btn" class="soft-btn soft-btn-lvl-2">
                  ${Icons.fileWord(16, '#FFFFFF')}
                  <span>Compilar y Generar Informe Word</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-report-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-report-modal')?.addEventListener('click', closeModal);

    // Auto-título dinámico según tipo de informe
    const selectType = document.getElementById('select-report-type');
    const inputTitle = document.getElementById('input-report-title');
    if (selectType && inputTitle) {
      const titles = {
        'EVALUACION_NEUROPSICOLOGICA': 'INFORME DE EVALUACIÓN NEUROPSICOLÓGICA CLÍNICA',
        'INFORME_PSICOPEDAGOGICO': 'INFORME DE VALORACIÓN PSICOPEDAGÓGICA Y DEL APRENDIZAJE',
        'VALORACION_GERONTOLOGICA': 'INFORME DE VALORACIÓN NEUROCOGNITIVA GERONTOLÓGICA',
        'EVOLUCION_CLINICA': 'INFORME DE PROGRESO Y EVOLUCIÓN TERAPÉUTICA',
        'INFORME_ESCOLAR': 'DICTAMEN CLÍNICO Y ORIENTACIONES PSICOPEDAGÓGICAS ESCOLARES'
      };
      selectType.addEventListener('change', () => {
        inputTitle.value = titles[selectType.value] || 'INFORME CLÍNICO INSTITUCIONAL';
      });
    }

    // Agregar filas de batería
    const bContainer = document.getElementById('batteries-container');
    document.getElementById('btn-add-battery-row')?.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'battery-row';
      row.style.cssText = 'display: grid; grid-template-columns: 2fr 2fr 1fr 1fr auto; gap: 0.5rem; align-items: center; margin-top: 0.4rem;';
      row.innerHTML = `
        <input type="text" class="soft-input soft-input-sm b-nombre" placeholder="Prueba" value="CUMANES" />
        <input type="text" class="soft-input soft-input-sm b-area" placeholder="Área" value="Madurez Neuropsicológica Escolar" />
        <input type="text" class="soft-input soft-input-sm b-puntuacion" placeholder="Puntaje" value="75" />
        <input type="text" class="soft-input soft-input-sm b-interpretacion" placeholder="Percentil" value="Pc 60" />
        <button type="button" class="btn-remove-battery soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="padding: 0.3rem 0.5rem;">✕</button>
      `;
      bContainer.appendChild(row);
      row.querySelector('.btn-remove-battery')?.addEventListener('click', () => row.remove());
    });

    document.querySelectorAll('.btn-remove-battery').forEach(btn => {
      btn.addEventListener('click', (e) => e.target.closest('.battery-row')?.remove());
    });

    // Envío del formulario
    const form = document.getElementById('form-create-report');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);

        // Recolectar filas de baterías
        const batteries = [];
        document.querySelectorAll('.battery-row').forEach(row => {
          const nombre = row.querySelector('.b-nombre')?.value?.trim();
          const area = row.querySelector('.b-area')?.value?.trim();
          const puntuacion = row.querySelector('.b-puntuacion')?.value?.trim();
          const interpretacion = row.querySelector('.b-interpretacion')?.value?.trim();
          if (nombre) {
            batteries.push({ nombre, area, puntuacion, interpretacion });
          }
        });

        const payload = {
          paciente_id: h.paciente_id,
          historia_id: h.id,
          tipo_informe: formData.get('tipo_informe'),
          titulo: formData.get('titulo'),
          motivo_evaluacion: formData.get('motivo_evaluacion'),
          antecedentes_relevantes: formData.get('antecedentes_relevantes'),
          baterias_administradas: batteries,
          resultados_cuantitativos: formData.get('resultados_cuantitativos'),
          diagnostico_codigo: formData.get('diagnostico_codigo'),
          diagnostico_descripcion: formData.get('diagnostico_descripcion'),
          recomendaciones_colegio: formData.get('recomendaciones_colegio'),
          recomendaciones_familia: formData.get('recomendaciones_familia'),
          entregable_familiar: formData.get('entregable_familiar') === '1'
        };

        const submitBtn = document.getElementById('btn-submit-report-btn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Compilando en Microsoft Word...</span>`;
        }

        try {
          const res = await apiClient.post('/reports', payload);
          Toast.success('¡Informe compilado y guardado en Word con éxito!');
          closeModal();
          this.activeTab = 'reports';
          await this.loadHistoryDetail(this.selectedHistoryId);
          // Abrir automáticamente previsualización Mammoth del informe recién creado
          if (res.data?.id) {
            this.previewReportWithMammoth(res.data.id);
          }
        } catch (err) {
          Toast.error('Error al generar informe: ' + err.message);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `${Icons.fileWord(16, '#FFFFFF')} <span>Compilar y Generar Informe Word</span>`;
          }
        }
      });
    }
  }

  async previewReportWithMammoth(reportId) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="mammoth-preview-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2100; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 920px; width: 100%; max-height: 92vh; display: flex; flex-direction: column;">
          
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.eye(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Visor Mammoth de Documento Word
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Renderizado en vivo desde el archivo oficial compilado
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-mammoth-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <div style="padding: 1.5rem; overflow-y: auto; flex: 1; background: #F8F9FD;">
            <div id="mammoth-content-container" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 2.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.06); font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.65; color: #222;">
              <div style="text-align: center; padding: 2rem;">
                <div class="spinner" style="margin: 0 auto 1rem auto; width: 32px; height: 32px; border: 3px solid var(--soft-border-card-inner); border-top-color: var(--soft-purple-primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                <p style="color: var(--soft-text-body); font-size: 0.9rem;">Leyendo estructura y convirtiendo documento con Mammoth...</p>
              </div>
            </div>
          </div>

          <div style="padding: 1rem 1.65rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; gap: 0.6rem;">
              <button type="button" id="btn-download-from-preview" class="soft-btn soft-btn-lvl-2">
                ${Icons.download(16, '#FFFFFF')}
                <span>Descargar Word</span>
              </button>
              <button type="button" id="btn-print-from-preview" class="soft-btn soft-btn-lvl-2-soft">
                ${Icons.printer(16, 'var(--soft-purple-primary)')}
                <span>Imprimir o Guardar PDF</span>
              </button>
            </div>
            <button type="button" id="btn-close-preview-footer" class="soft-btn soft-btn-lvl-2-soft">
              Cerrar
            </button>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-mammoth-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-preview-footer')?.addEventListener('click', closeModal);
    document.getElementById('btn-download-from-preview')?.addEventListener('click', () => {
      this.downloadReportDocx(reportId);
    });
    // Impresión aislada por IFRAME (evita páginas en blanco)
    document.getElementById('btn-print-from-preview')?.addEventListener('click', () => {
      const container = document.getElementById('mammoth-content-container');
      if (container) {
        this.printDocumentViaIframe('Informe Clínico Oficial - PSI Aprende', container.innerHTML);
      }
    });

    try {
      const token = store.getState().token || localStorage.getItem('psi_token') || '';
      const response = await fetch(`/api/reports/${reportId}/docx`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('No se pudo recuperar el archivo DOCX');
      const arrayBuffer = await response.arrayBuffer();

      const result = await mammoth.convertToHtml({ arrayBuffer });
      const container = document.getElementById('mammoth-content-container');
      if (container) {
        container.innerHTML = `
          <div class="mammoth-rendered-document" style="font-size: 0.9rem;">
            ${result.value}
          </div>
        `;
      }
    } catch (err) {
      const container = document.getElementById('mammoth-content-container');
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: #DC2626;">
            ${Icons.alertTriangle(32, '#DC2626')}
            <h4 style="margin: 0.5rem 0;">Error al previsualizar el documento</h4>
            <p style="font-size: 0.85rem; color: var(--soft-text-body);">${err.message}</p>
          </div>
        `;
      }
    }
  }

  async downloadReportDocx(reportId) {
    const token = store.getState().token || localStorage.getItem('psi_token') || '';
    try {
      const res = await fetch(`/api/reports/${reportId}/docx`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error al descargar el archivo DOCX');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Informe_${this.currentHistory?.numero_expediente || 'EXP'}_${reportId}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      Toast.success('Descarga iniciada exitosamente.');
    } catch (e) {
      Toast.error('No se pudo descargar el informe: ' + e.message);
    }
  }

  deleteReportConfirm(reportId) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="delete-report-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2100; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 480px; width: 100%;">
          
          <div style="padding: 1.25rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-amber">
                ${Icons.trash(20, 'var(--soft-coral-alert)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.1rem; font-weight: 800; margin: 0;">
                  Eliminar Informe Clínico
                </h3>
                <div style="font-size: 0.76rem; color: var(--soft-text-body);">
                  Expediente ${this.escapeHtml(this.currentHistory?.numero_expediente || 'Clínico')}
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-delete-report-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <div style="padding: 1.5rem 1.65rem; display: flex; flex-direction: column; gap: 1rem;">
            <p style="font-size: 0.88rem; color: var(--soft-text-body); margin: 0; line-height: 1.5;">
              ¿Está seguro de eliminar este informe clínico emitido? Esta acción retirará el documento y su archivo Word asociado de manera permanente.
            </p>
            <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 0.75rem 0.95rem; font-size: 0.8rem; color: #991B1B;">
              <strong>Nota de Seguridad:</strong> Si el informe ya fue entregado a la familia, esta acción anula su consulta en el portal familiar.
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
              <button type="button" id="btn-cancel-delete-report-modal" class="soft-btn soft-btn-lvl-2-soft">
                Cancelar
              </button>
              <button type="button" id="btn-confirm-delete-report-action" class="soft-btn soft-btn-lvl-2" style="background: var(--soft-coral-alert, #E11D48); color: #FFFFFF;">
                ${Icons.trash(15, '#FFFFFF')}
                <span>Eliminar Permanentemente</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-delete-report-modal')?.addEventListener('click', close);
    document.getElementById('btn-cancel-delete-report-modal')?.addEventListener('click', close);

    document.getElementById('btn-confirm-delete-report-action')?.addEventListener('click', async () => {
      try {
        await apiClient.delete(`/reports/${reportId}`);
        Toast.success('Informe clínico eliminado con éxito.');
        close();
        await this.loadHistoryDetail(this.selectedHistoryId);
      } catch (err) {
        Toast.error('Error al eliminar: ' + err.message);
      }
    });
  }

  attachMasterEvents() {
    const searchInput = document.getElementById('input-search-records');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.loadHistoriesList(), 300);
      });
    }

    document.querySelectorAll('.btn-filter-status').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.filterState = e.currentTarget.getAttribute('data-status');
        this.loadHistoriesList();
      });
    });

    document.querySelectorAll('.btn-open-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-id'));
        window.location.hash = `#/clinical-records?id=${id}`;
      });
    });
  }

  attachDetailEvents() {
    const btnBack = document.getElementById('btn-back-to-list');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        window.location.hash = '#/clinical-records';
      });
    }

    const btnNewSoap = document.getElementById('btn-new-soap');
    if (btnNewSoap) {
      btnNewSoap.addEventListener('click', () => this.openSoapModal());
    }

    document.querySelectorAll('.btn-launch-soap-modal').forEach(btn => {
      btn.addEventListener('click', () => this.openSoapModal());
    });

    // Pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeTab = e.currentTarget.getAttribute('data-tab');
        this.renderDetailView();
      });
    });

    // Abrir detalle emergente de nota SOAP individual
    document.querySelectorAll('.btn-view-soap-popup').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const noteId = Number(e.currentTarget.getAttribute('data-note-id'));
        const note = this.soapNotes.find(n => n.id === noteId);
        if (note) this.openSoapDetailPopup(note);
      });
    });

    // Cambio de estado
    const selectStatus = document.getElementById('select-history-status');
    if (selectStatus) {
      selectStatus.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        try {
          await apiClient.patch(`/clinical-records/${this.currentHistory.id}/status`, { estado: newStatus });
          this.currentHistory.estado = newStatus;
          Toast.success(`Estado del expediente actualizado a: ${newStatus}`);
          this.renderDetailView();
        } catch (err) {
          Toast.error('No se pudo actualizar el estado: ' + err.message);
          selectStatus.value = this.currentHistory.estado;
        }
      });
    }

    // Formulario de Anamnesis
    const formAnamnesis = document.getElementById('form-anamnesis');
    if (formAnamnesis) {
      formAnamnesis.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(formAnamnesis);
        const payload = Object.fromEntries(formData.entries());

        try {
          const res = await apiClient.post(`/clinical-records/${this.currentHistory.id}/anamnesis`, payload);
          this.anamnesis = res.data;
          Toast.success('Anamnesis clínica guardada exitosamente.');
          this.renderDetailView();
        } catch (err) {
          Toast.error('Error al guardar anamnesis: ' + err.message);
        }
      });
    }

    // =========================================================================
    // VINCULACIÓN Y GESTIÓN DE TUTORES (PORTAL FAMILIAR)
    // =========================================================================
    document.getElementById('btn-quick-manage-tutor')?.addEventListener('click', () => {
      this.openLinkTutorModal(this.currentHistory.paciente_id, this.currentHistory.tutor_principal);
    });
    document.getElementById('btn-manage-tutor-tab')?.addEventListener('click', () => {
      this.openLinkTutorModal(this.currentHistory.paciente_id, this.currentHistory.tutor_principal);
    });
    document.getElementById('btn-bind-tutor-empty')?.addEventListener('click', () => {
      this.openLinkTutorModal(this.currentHistory.paciente_id, this.currentHistory.tutor_principal);
    });
    document.querySelectorAll('.btn-unlink-tutor').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const tutorId = e.currentTarget.getAttribute('data-tutor-id');
        const tutorName = e.currentTarget.getAttribute('data-tutor-name') || 'este tutor';
        await this.handleUnlinkTutor(this.currentHistory.paciente_id, tutorId, tutorName);
      });
    });

    // =========================================================================
    // EVENTOS SPRINT 5: PLANES PTI, METAS SMART, CARPETAS Y DOCUMENTOS
    // =========================================================================

    // 1. Abrir Modal de Nuevo Plan PTI
    const btnNewPlan = document.getElementById('btn-open-new-plan-modal');
    if (btnNewPlan) btnNewPlan.addEventListener('click', () => this.openNewPlanModal());
    document.querySelectorAll('.btn-launch-new-plan').forEach(btn => {
      btn.addEventListener('click', () => this.openNewPlanModal());
    });

    // 2. Agregar Meta SMART
    document.querySelectorAll('.btn-add-goal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const planId = Number(e.currentTarget.getAttribute('data-plan-id'));
        this.openNewGoalModal(planId);
      });
    });

    // 3. Finalizar / Descontinuar Plan
    document.querySelectorAll('.btn-close-plan').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const planId = Number(e.currentTarget.getAttribute('data-plan-id'));
        const planTitle = decodeURIComponent(e.currentTarget.getAttribute('data-plan-title') || '');
        this.openClosePlanModal(planId, planTitle);
      });
    });

    // 4. Actualizar Avance Cuantitativo de Meta SMART (0-100%)
    document.querySelectorAll('.btn-pct-step').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const metaId = Number(e.currentTarget.getAttribute('data-meta-id'));
        const targetPct = Number(e.currentTarget.getAttribute('data-target-pct'));
        this.openUpdateGoalModal(metaId, targetPct);
      });
    });

    // 5. Ver Historial de Avance de Meta SMART
    document.querySelectorAll('.btn-view-goal-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const metaId = Number(e.currentTarget.getAttribute('data-meta-id'));
        const metaDesc = decodeURIComponent(e.currentTarget.getAttribute('data-meta-desc') || '');
        this.openGoalHistoryModal(metaId, metaDesc);
      });
    });

    // 5b. Ver Reportes de Estimulación del Tutor para Meta SMART específica (Modal interactivo)
    document.querySelectorAll('.btn-view-tutor-meta-checkins').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const metaId = Number(e.currentTarget.getAttribute('data-meta-id'));
        const metaDesc = decodeURIComponent(e.currentTarget.getAttribute('data-meta-desc') || '');
        this.openTutorMetaCheckinsModal(metaId, metaDesc);
      });
    });

    // 6. Selector de Carpetas Digitales (Filtro por píldoras)
    document.querySelectorAll('.folder-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const folderIdStr = e.currentTarget.getAttribute('data-folder-id');
        this.selectedFolderId = folderIdStr ? Number(folderIdStr) : null;
        this.renderDetailView();
      });
    });

    // 6b. Abrir listado de Carpetas Desvinculadas / Archivadas
    const btnInactiveFolders = document.getElementById('btn-open-inactive-folders');
    if (btnInactiveFolders) {
      btnInactiveFolders.addEventListener('click', () => this.openInactiveFoldersModal());
    }

    // 6b2. Abrir listado de Estudios Desvinculados / Archivados
    const btnInactiveDocs = document.getElementById('btn-open-inactive-docs');
    if (btnInactiveDocs) {
      btnInactiveDocs.addEventListener('click', () => this.openInactiveDocumentsModal());
    }

    // 6c. Desvincular Carpeta Clínica Activa (con modal de justificación)
    document.querySelectorAll('.btn-deactivate-folder-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const folderId = e.currentTarget.getAttribute('data-folder-id');
        const folderName = e.currentTarget.getAttribute('data-folder-name') || 'Carpeta';
        this.openDeactivateFolderModal(folderId, folderName);
      });
    });

    // 6d. Descargar Documento desde tarjeta
    document.querySelectorAll('.btn-download-doc-card').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const docId = Number(e.currentTarget.getAttribute('data-doc-id'));
        const docName = decodeURIComponent(e.currentTarget.getAttribute('data-doc-name') || 'estudio.pdf');
        const token = store.getState().token || localStorage.getItem('psi_token') || '';
        try {
          const res = await fetch(`/api/clinical-records/documents/${docId}/view?download=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Error al descargar archivo');
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = docName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch (err) {
          Toast.error('No se pudo descargar el documento: ' + err.message);
        }
      });
    });

    // 7. Subir Estudio / Laboratorio
    const btnUploadDoc = document.getElementById('btn-open-upload-doc');
    if (btnUploadDoc) btnUploadDoc.addEventListener('click', () => this.openUploadDocumentModal());
    document.querySelectorAll('.btn-launch-upload-doc').forEach(btn => {
      btn.addEventListener('click', () => this.openUploadDocumentModal());
    });

    // 8. Crear Nueva Carpeta
    const btnNewFolder = document.getElementById('btn-open-new-folder');
    if (btnNewFolder) btnNewFolder.addEventListener('click', () => this.openNewFolderModal());

    // 9. Ver Documento en Pantalla (Visor Embebido PDF / Imagen)
    document.querySelectorAll('.btn-view-doc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const docId = Number(e.currentTarget.getAttribute('data-doc-id'));
        const docName = decodeURIComponent(e.currentTarget.getAttribute('data-doc-name') || 'Documento');
        const docMime = e.currentTarget.getAttribute('data-doc-mime') || 'application/pdf';
        this.openDocumentViewerModal(docId, docName, docMime);
      });
    });

    // 10. Archivar / Anular Documento
    document.querySelectorAll('.btn-delete-doc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const docId = Number(e.currentTarget.getAttribute('data-doc-id'));
        const docName = decodeURIComponent(e.currentTarget.getAttribute('data-doc-name') || 'Documento');
        this.openDeleteDocumentModal(docId, docName);
      });
    });

    // =========================================================================
    // SPRINT 9.5: EVENTOS DE CONSENTIMIENTOS Y REPORTES WORD
    // =========================================================================

    // Botones rápidos del header del paciente
    document.getElementById('btn-quick-consent-header')?.addEventListener('click', () => {
      if (!this.hasActiveConsent) {
        this.openConsentModal();
      } else {
        this.activeTab = 'consents';
        this.renderDetailView();
      }
    });

    document.getElementById('btn-quick-report-header')?.addEventListener('click', () => {
      this.openReportModal();
    });

    // Pestaña Consentimientos
    document.getElementById('btn-open-new-consent-modal')?.addEventListener('click', () => this.openConsentModal());
    document.querySelectorAll('.btn-launch-consent-now').forEach(btn => {
      btn.addEventListener('click', () => this.openConsentModal());
    });
    document.querySelectorAll('.btn-open-consent-from-alert').forEach(btn => {
      btn.addEventListener('click', () => this.openConsentModal());
    });
    document.querySelectorAll('.btn-view-consent-doc').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const consentId = Number(e.currentTarget.getAttribute('data-consent-id'));
        if (consentId) this.openConsentDetailModal(consentId);
      });
    });
    document.querySelectorAll('.btn-revoke-consent').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const consentId = Number(e.currentTarget.getAttribute('data-consent-id'));
        if (consentId) this.revokeConsentModal(consentId);
      });
    });

    // Pestaña Informes Clínicos (.docx) & Reportes Familiares
    document.getElementById('btn-open-new-report-modal')?.addEventListener('click', () => this.openReportModal());
    document.getElementById('btn-open-family-report-modal')?.addEventListener('click', () => this.openFamilyReportModal());
    document.getElementById('btn-launch-family-report-empty')?.addEventListener('click', () => this.openFamilyReportModal());
    document.querySelectorAll('.btn-launch-report-now').forEach(btn => {
      btn.addEventListener('click', () => this.openReportModal());
    });
    document.querySelectorAll('.btn-preview-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reportId = Number(e.currentTarget.getAttribute('data-report-id'));
        if (reportId) this.previewReportWithMammoth(reportId);
      });
    });
    document.querySelectorAll('.btn-download-report-docx').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reportId = Number(e.currentTarget.getAttribute('data-report-id'));
        if (reportId) this.downloadReportDocx(reportId);
      });
    });
    document.querySelectorAll('.btn-upload-signed-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reportId = Number(e.currentTarget.getAttribute('data-report-id'));
        if (reportId) this.openUploadSignedModal(reportId);
      });
    });
    document.querySelectorAll('.btn-stamp-digital-signature').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reportId = Number(e.currentTarget.getAttribute('data-report-id'));
        if (reportId) this.stampReportSignature(reportId);
      });
    });
    document.querySelectorAll('.btn-download-signed-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reportId = Number(e.currentTarget.getAttribute('data-report-id'));
        if (reportId) this.downloadSignedReport(reportId);
      });
    });
    document.querySelectorAll('.btn-delete-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const reportId = Number(e.currentTarget.getAttribute('data-report-id'));
        if (reportId) this.deleteReportConfirm(reportId);
      });
    });
  }

  openSoapDetailPopup(note) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="soap-detail-backdrop" style="display: flex; z-index: 2000;">
        <div class="soft-modal-card" style="max-width: 920px; width: 100%; max-height: 90vh;">
          
          <!-- CABECERA DE LA NOTA (NIVEL 2) -->
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
              <span class="soft-badge soft-badge-lavender" style="font-size: 0.82rem; font-weight: 800; padding: 0.36rem 0.82rem;">
                SESIÓN #${note.numero_sesion}
              </span>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0; letter-spacing: -0.015em;">
                  Nota de Evolución Clínica SOAP
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                  Paciente: <strong style="color: var(--soft-text-title);">${this.currentHistory.paciente_nombres} ${this.currentHistory.paciente_apellidos}</strong> · Expediente: <strong style="color: var(--soft-purple-primary);">${this.currentHistory.numero_expediente}</strong>
                </div>
              </div>
            </div>

            <button type="button" id="btn-close-soap-detail" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- BARRA INFORMATIVA DE LA SESIÓN -->
          <div style="background: #FFFFFF; border-bottom: 1px solid var(--soft-divider); padding: 0.8rem 1.65rem; display: flex; flex-wrap: wrap; gap: 1.35rem; align-items: center; font-size: 0.82rem;">
            <div>
              <span style="color: var(--soft-text-muted); font-weight: 600;">Fecha:</span>
              <strong style="color: var(--soft-text-title); margin-left: 0.35rem;">${note.fecha_sesion}</strong>
            </div>

            ${note.hora_inicio ? `
              <div>
                <span style="color: var(--soft-text-muted); font-weight: 600;">Horario:</span>
                <strong style="color: var(--soft-text-title); margin-left: 0.35rem;">${note.hora_inicio} ${note.hora_fin ? `- ${note.hora_fin}` : ''}</strong>
              </div>
            ` : ''}

            <div>
              <span style="color: var(--soft-text-muted); font-weight: 600;">Ambiente:</span>
              <strong style="color: var(--soft-text-title); margin-left: 0.35rem;">${note.ambiente_nombre || 'Consultorio Institucional'}</strong>
            </div>

            ${note.diagnostico_codigo ? `
              <div style="margin-left: auto;">
                <span class="soft-badge soft-badge-lavender">
                  CIE: ${note.diagnostico_codigo} ${note.diagnostico_glosa ? `(${note.diagnostico_glosa})` : ''}
                </span>
              </div>
            ` : ''}
          </div>

          <!-- CUERPO CON LOS 4 PILARES SOAP -->
          <div style="padding: 1.5rem 1.65rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.2rem; background: var(--soft-lavender-surface);">
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1.15rem;">
              
              <!-- PILAR S -->
              <div class="soft-subcard" style="background: #FFFFFF; padding: 1.15rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--soft-divider);">
                  <div style="display: flex; align-items: center; gap: 0.45rem;">
                    <span class="soft-badge soft-badge-lavender" style="font-weight: 800; padding: 0.16rem 0.55rem;">S</span>
                    <strong style="color: var(--soft-text-title); font-size: 0.88rem;">Subjetivo</strong>
                  </div>
                  <span style="font-size: 0.72rem; color: var(--soft-text-muted);">Relato del paciente / familia</span>
                </div>
                <div style="font-size: 0.86rem; line-height: 1.58; color: var(--soft-text-body); white-space: pre-line;">
                  ${this.escapeHtml(note.subjetivo || 'Sin registro')}
                </div>
              </div>

              <!-- PILAR O -->
              <div class="soft-subcard" style="background: #FFFFFF; padding: 1.15rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--soft-divider);">
                  <div style="display: flex; align-items: center; gap: 0.45rem;">
                    <span class="soft-badge soft-badge-mint" style="font-weight: 800; padding: 0.16rem 0.55rem;">O</span>
                    <strong style="color: var(--soft-text-title); font-size: 0.88rem;">Objetivo</strong>
                  </div>
                  <span style="font-size: 0.72rem; color: var(--soft-text-muted);">Observación y métricas en sala</span>
                </div>
                <div style="font-size: 0.86rem; line-height: 1.58; color: var(--soft-text-body); white-space: pre-line;">
                  ${this.escapeHtml(note.objetivo || 'Sin registro')}
                </div>
              </div>

              <!-- PILAR A -->
              <div class="soft-subcard" style="background: #FFFFFF; padding: 1.15rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--soft-divider);">
                  <div style="display: flex; align-items: center; gap: 0.45rem;">
                    <span class="soft-badge soft-badge-amber" style="font-weight: 800; padding: 0.16rem 0.55rem;">A</span>
                    <strong style="color: var(--soft-text-title); font-size: 0.88rem;">Análisis / Apreciación Clínica</strong>
                  </div>
                  <span style="font-size: 0.72rem; color: var(--soft-text-muted);">Juicio clínico del especialista</span>
                </div>
                <div style="font-size: 0.86rem; line-height: 1.58; color: var(--soft-text-body); white-space: pre-line;">
                  ${this.escapeHtml(note.analisis || 'Sin registro')}
                </div>
              </div>

              <!-- PILAR P -->
              <div class="soft-subcard" style="background: #FFFFFF; padding: 1.15rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--soft-divider);">
                  <div style="display: flex; align-items: center; gap: 0.45rem;">
                    <span class="soft-badge soft-badge-emerald" style="font-weight: 800; padding: 0.16rem 0.55rem;">P</span>
                    <strong style="color: var(--soft-text-title); font-size: 0.88rem;">Plan Terapéutico</strong>
                  </div>
                  <span style="font-size: 0.72rem; color: var(--soft-text-muted);">Objetivos y próxima sesión</span>
                </div>
                <div style="font-size: 0.86rem; line-height: 1.58; color: var(--soft-text-body); white-space: pre-line;">
                  ${this.escapeHtml(note.plan || 'Sin registro')}
                </div>
              </div>

            </div>

            <!-- PAUTAS EN EL HOGAR SI EXISTEN -->
            ${note.recomendaciones_hogar ? `
              <div class="soft-subcard" style="background: var(--soft-mint-bg); border-color: var(--soft-mint-border); padding: 1.1rem 1.2rem;">
                <div style="display: flex; align-items: center; gap: 0.45rem; margin-bottom: 0.45rem; color: var(--soft-mint-deep);">
                  ${Icons.home(16, 'var(--soft-mint-deep)')}
                  <strong style="font-size: 0.86rem; color: var(--soft-text-title);">Pautas de Estimulación y Trabajo en Casa (Para Padres / Tutores):</strong>
                </div>
                <div style="font-size: 0.85rem; line-height: 1.55; color: var(--soft-text-body); white-space: pre-line;">
                  ${this.escapeHtml(note.recomendaciones_hogar)}
                </div>
              </div>
            ` : ''}

            <!-- SELLO DIGITAL Y TRAZABILIDAD RN-07 -->
            <div class="soft-subcard" style="background: #FFFFFF; padding: 0.9rem 1.1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
              <div style="display: flex; align-items: center; gap: 0.7rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.shield(18, 'var(--soft-purple-primary)')}
                </div>
                <div>
                  <div style="font-size: 0.82rem; font-weight: 800; color: var(--soft-text-title);">
                    Firma Digital: ${note.firma_digital_snapshot || `${note.terapeuta_nombres} ${note.terapeuta_apellidos}`}
                  </div>
                  <div style="font-size: 0.74rem; color: var(--soft-text-muted);">
                    Especialista Colegiado CPB · ${note.terapeuta_matricula || 'Matrícula CPB'} · Registro Inalterable RN-07
                  </div>
                </div>
              </div>

              <div style="font-size: 0.74rem; color: var(--soft-text-muted); text-align: right;">
                Registrado: ${note.created_at || note.fecha_sesion}
                ${note.asistido_por_ia ? `<div style="color: var(--soft-mint-deep); font-weight: 700;">Redacción asistida por Groq IA</div>` : ''}
              </div>
            </div>

          </div>

          <!-- PIE DE MODAL (NIVEL 2) -->
          <div style="padding: 1rem 1.65rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; gap: 0.75rem; background: #FFFFFF;">
            <button type="button" id="btn-print-soap-note" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">
              ${Icons.printer(14, 'var(--soft-purple-primary)')}
              <span>Imprimir / Exportar</span>
            </button>
            <button type="button" id="btn-close-soap-detail-footer" class="soft-btn soft-btn-sm soft-btn-lvl-2">
              Cerrar Detalle
            </button>
          </div>

        </div>
      </div>
    `;

    const backdrop = document.getElementById('soap-detail-backdrop');
    const btnClose = document.getElementById('btn-close-soap-detail');
    const btnCloseFooter = document.getElementById('btn-close-soap-detail-footer');
    const btnPrint = document.getElementById('btn-print-soap-note');

    const closeDetail = () => {
      if (modalContainer) modalContainer.innerHTML = '';
    };

    if (btnClose) btnClose.addEventListener('click', closeDetail);
    if (btnCloseFooter) btnCloseFooter.addEventListener('click', closeDetail);
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeDetail();
      });
    }

    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        this.printSoapNote(note);
      });
    }
  }

  printSoapNote(note) {
    const h = this.currentHistory;
    const printContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Ficha SOAP - Sesión #${note.numero_sesion} - ${this.escapeHtml(h.paciente_nombres)} ${this.escapeHtml(h.paciente_apellidos)}</title>
        <style>
          @page {
            size: letter portrait;
            margin: 8mm 12mm 8mm 12mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            color: #1e293b;
            background: #ffffff;
            font-size: 8.2pt;
            line-height: 1.25;
            padding: 0;
          }
          .header-table {
            width: 100%;
            border-bottom: 2px solid #27345F;
            padding-bottom: 4px;
            margin-bottom: 6px;
          }
          .brand-title {
            font-size: 13pt;
            font-weight: 800;
            color: #27345F;
            letter-spacing: -0.3px;
          }
          .brand-title span {
            color: #54B8B0;
          }
          .brand-subtitle {
            font-size: 7.5pt;
            text-transform: uppercase;
            font-weight: 700;
            color: #4E3A70;
            letter-spacing: 0.5px;
          }
          .institution-meta {
            text-align: right;
            font-size: 7.5pt;
            color: #64748b;
            line-height: 1.25;
          }
          .doc-title-bar {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 4px 8px;
            margin-bottom: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .doc-title {
            font-size: 9pt;
            font-weight: 800;
            color: #27345F;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .session-badge {
            background: #4E3A70;
            color: #ffffff;
            font-weight: 800;
            font-size: 7.5pt;
            padding: 2px 6px;
            border-radius: 3px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr;
            gap: 3px 6px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 5px 8px;
            margin-bottom: 6px;
            font-size: 7.8pt;
          }
          .info-item {
            margin-bottom: 2px;
          }
          .info-label {
            color: #64748b;
            font-weight: 600;
            font-size: 7pt;
            text-transform: uppercase;
            display: block;
          }
          .info-value {
            font-weight: 700;
            color: #1e293b;
          }
          .soap-section {
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            margin-bottom: 5px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .soap-header {
            padding: 2px 8px;
            font-size: 8pt;
            font-weight: 800;
            border-bottom: 1px solid #cbd5e1;
            background: #f1f5f9;
            display: flex;
            align-items: center;
            gap: 5px;
          }
          .soap-badge {
            display: inline-block;
            color: #ffffff;
            font-weight: 800;
            font-size: 7pt;
            padding: 1px 5px;
            border-radius: 3px;
          }
          .soap-body {
            padding: 3px 8px;
            font-size: 7.8pt;
            line-height: 1.25;
            color: #0f172a;
            white-space: pre-line;
          }
          .badge-s { background: #4E3A70; }
          .badge-o { background: #0284c7; }
          .badge-a { background: #d97706; }
          .badge-p { background: #27345F; }
          .badge-home { background: #059669; }

          .footer-box {
            margin-top: 18px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 10px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .signature-table {
            width: 100%;
            margin-top: 4px;
          }
          .signature-cell {
            width: 50%;
            vertical-align: bottom;
          }
          .signature-line {
            width: 85%;
            border-top: 1.5px solid #27345F;
            margin-top: 50px;
            padding-top: 4px;
            text-align: center;
            font-size: 7.8pt;
            font-weight: 700;
            color: #334155;
          }
          .signature-sub {
            font-size: 7pt;
            color: #64748b;
            text-align: center;
            width: 85%;
          }
          .legal-notice {
            font-size: 6.5pt;
            color: #64748b;
            line-height: 1.2;
            margin-top: 5px;
            text-align: justify;
            border-top: 1px dashed #cbd5e1;
            padding-top: 3px;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="vertical-align: middle;">
              <div class="brand-title">PSI <span>APRENDE</span></div>
              <div class="brand-subtitle">Centro Psicopedagógico y Psicológico</div>
            </td>
            <td class="institution-meta" style="vertical-align: middle;">
              <div>${this.escapeHtml(this._getInstAddress())}</div>
              <div>Tel/WhatsApp: ${this.escapeHtml(this._getInstPhone())} · CPB Oficial</div>
              <div>Sistema Web PWA de Gestión Clínica Asistida</div>
            </td>
          </tr>
        </table>

        <div class="doc-title-bar">
          <div class="doc-title">Ficha Oficial de Evolución Clínica (Formato SOAP)</div>
          <div class="session-badge">SESIÓN #${note.numero_sesion} CONSECUTIVA</div>
        </div>

        <div class="info-grid">
          <div>
            <span class="info-label">Paciente</span>
            <span class="info-value">${this.escapeHtml(h.paciente_nombres)} ${this.escapeHtml(h.paciente_apellidos)}</span>
          </div>
          <div>
            <span class="info-label">Cédula de Identidad</span>
            <span class="info-value">${this.escapeHtml(h.paciente_ci || 'N/D')}</span>
          </div>
          <div>
            <span class="info-label">N° de Expediente</span>
            <span class="info-value">${this.escapeHtml(h.numero_expediente)}</span>
          </div>
          <div>
            <span class="info-label">Fecha de Sesión & Horario</span>
            <span class="info-value">${note.fecha_sesion} ${note.hora_inicio ? `(${note.hora_inicio} ${note.hora_fin ? `- ${note.hora_fin}` : ''})` : ''}</span>
          </div>
          <div>
            <span class="info-label">Consultorio / Ambiente</span>
            <span class="info-value">${this.escapeHtml(note.ambiente_nombre || 'Consultorio Institucional')}</span>
          </div>
          <div>
            <span class="info-label">Diagnóstico Nosológico</span>
            <span class="info-value">${this.escapeHtml(note.diagnostico_codigo || 'En valoración clínica')}</span>
          </div>
        </div>

        <!-- S -->
        <div class="soap-section">
          <div class="soap-header">
            <span class="soap-badge badge-s">S</span>
            <span>SUBJETIVO · Reporte del Paciente, Familia o Colegio</span>
          </div>
          <div class="soap-body">${this.escapeHtml(note.subjetivo || 'Sin registro')}</div>
        </div>

        <!-- O -->
        <div class="soap-section">
          <div class="soap-header">
            <span class="soap-badge badge-o">O</span>
            <span>OBJETIVO · Hallazgos Clínicos, Desempeño y Métricas en Sala</span>
          </div>
          <div class="soap-body">${this.escapeHtml(note.objetivo || 'Sin registro')}</div>
        </div>

        <!-- A -->
        <div class="soap-section">
          <div class="soap-header">
            <span class="soap-badge badge-a">A</span>
            <span>ANÁLISIS · Apreciación Diagnóstica y Juicio Clínico del Especialista</span>
          </div>
          <div class="soap-body">${this.escapeHtml(note.analisis || 'Sin registro')}</div>
        </div>

        <!-- P -->
        <div class="soap-section">
          <div class="soap-header">
            <span class="soap-badge badge-p">P</span>
            <span>PLAN TERAPÉUTICO · Objetivos para la Próxima Sesión y Tareas Acordadas</span>
          </div>
          <div class="soap-body">${this.escapeHtml(note.plan || 'Sin registro')}</div>
        </div>

        ${note.recomendaciones_hogar ? `
          <!-- PAUTAS EN EL HOGAR -->
          <div class="soap-section">
            <div class="soap-header">
              <span class="soap-badge badge-home">HOGAR</span>
              <span>Pautas de Estimulación y Trabajo en Casa (Para Padres / Tutores)</span>
            </div>
            <div class="soap-body">${this.escapeHtml(note.recomendaciones_hogar)}</div>
          </div>
        ` : ''}

        <div class="footer-box">
          <table class="signature-table">
            <tr>
              <td class="signature-cell">
                <div class="signature-line">Firma Manuscrita del Especialista</div>
                <div class="signature-sub">Sello y Rúbrica Profesional Colegiada</div>
              </td>
              <td class="signature-cell" style="text-align: right;">
                <div style="display: inline-block; text-align: left; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px;">
                  <div style="font-weight: 800; font-size: 8.5pt; color: #27345F;">SELLO DIGITAL Y TRAZABILIDAD RN-07</div>
                  <div style="font-size: 8pt; color: #334155;"><strong>Firma Digital:</strong> ${this.escapeHtml(note.firma_digital_snapshot || `${note.terapeuta_nombres || ''} ${note.terapeuta_apellidos || ''}`)}</div>
                  <div style="font-size: 7.5pt; color: #64748b;"><strong>Registro inalterable:</strong> ${note.created_at || note.fecha_sesion}</div>
                  ${note.asistido_por_ia ? '<div style="font-size: 7pt; color: #0284c7; font-weight: 700;">Redacción estructurada con GroqCloud IA</div>' : ''}
                </div>
              </td>
            </tr>
          </table>

          <div class="legal-notice">
            <strong>DOCUMENTO MÉDICO-PSICOLÓGICO CONFIDENCIAL:</strong> La información contenida en esta ficha clínica de evolución está protegida por el Secreto Profesional, la Ley N° 223 y normativas del Colegio de Psicólogos de Bolivia (CPB). Prohibida su difusión, copia no autorizada o alteración según la Regla de Negocio RN-07.
          </div>
        </div>

      </body>
      </html>
    `;

    let iframe = document.getElementById('print-soap-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-soap-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(printContent);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
  }

  openSoapModal() {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer || !this.currentHistory) return;

    // Calcular el siguiente número consecutivo EXCLUSIVAMENTE para este paciente
    const nextSession = (this.soapNotes && this.soapNotes.length > 0)
      ? Math.max(...this.soapNotes.map(n => Number(n.numero_sesion) || 0)) + 1
      : 1;

    const today = getBoliviaTodayDateString();
    const nowTime = new Date().toTimeString().substring(0, 5);

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="soap-modal-backdrop" style="display: flex; z-index: 2000;">
        <div class="soft-modal-card" style="max-width: 960px; width: 95%; max-height: 92vh;">
          
          <!-- CABECERA MODAL (NIVEL 2) -->
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.stethoscope(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <h3 style="color: var(--soft-text-title); font-size: 1.18rem; font-weight: 800; margin: 0; letter-spacing: -0.015em;">
                    Registrar Nota de Evolución SOAP
                  </h3>
                  <span class="soft-badge soft-badge-lavender">
                    Sesión #${nextSession}
                  </span>
                </div>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                  Paciente: <strong style="color: var(--soft-text-title);">${this.currentHistory.paciente_nombres} ${this.currentHistory.paciente_apellidos}</strong> (${this.currentHistory.numero_expediente})
                </div>
              </div>
            </div>

            <button type="button" id="btn-close-soap-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- CUERPO MODAL CON SCROLL -->
          <div style="padding: 1.35rem 1.65rem; overflow-y: auto; flex: 1;">
            
            <!-- CAJA DE ASISTENCIA CON IA (GROQ / LLAMA 3.3) -->
            <div class="soft-subcard" style="background: linear-gradient(135deg, var(--soft-mint-bg) 0%, var(--soft-lavender-bg) 100%); border-color: var(--soft-mint-border); padding: 1.15rem 1.25rem; margin-bottom: 1.35rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.45rem; color: var(--soft-purple-primary); font-weight: 800; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.04em;">
                  ${Icons.sparkles(16, 'var(--soft-mint-deep)')}
                  <span>Asistente de Redacción SOAP (GroqCloud IA)</span>
                </div>
                <span class="soft-badge soft-badge-mint" style="font-size: 0.7rem;">Anonimización biomédica previa (RN-04)</span>
              </div>
              <p style="font-size: 0.82rem; color: var(--soft-text-body); margin: 0 0 0.7rem 0; line-height: 1.45;">
                Escribe apuntes informales o desordenados de la sesión y presiona <strong style="color: var(--soft-text-title);">"Estructurar con IA"</strong> para convertirlo automáticamente en los 4 campos SOAP formales.
              </p>
              <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                <input 
                  type="text" 
                  id="input-rough-notes" 
                  class="soft-input"
                  placeholder="Ej: Niño inquieto al principio, aplicamos cubos de Corsi, mejoró en atención visual, dar pautas de descansos al padre..." 
                  style="flex: 1; min-width: min(100%, 240px); background: #FFFFFF;"
                />
                <button 
                  type="button" 
                  id="btn-ai-assist-soap" 
                  class="soft-btn soft-btn-lvl-2" 
                  style="white-space: nowrap;"
                >
                  ${Icons.sparkles(14, '#FFFFFF')}
                  <span id="ai-btn-text">Estructurar con IA</span>
                </button>
              </div>
            </div>

            <form id="form-new-soap">
              <!-- METADATOS DE LA SESIÓN (FECHA, HORA, CONSULTORIO) -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
                <div>
                  <label class="soft-label">
                    Número de Sesión Consecutiva *
                  </label>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="number" name="numeroSesion" value="${nextSession}" min="1" step="1" required class="soft-input" style="width: 90px; font-weight: 800; color: var(--soft-purple-primary); text-align: center;" />
                    <span class="soft-badge soft-badge-mint">
                      Autoincrementado
                    </span>
                  </div>
                </div>

                <div>
                  <label class="soft-label">Fecha de la Sesión *</label>
                  <input type="date" name="fechaSesion" value="${today}" required class="soft-input" />
                </div>

                <div>
                  <label class="soft-label">Horario (Inicio - Fin)</label>
                  <div style="display: flex; gap: 0.35rem;">
                    <input type="time" name="horaInicio" value="${nowTime}" class="soft-input" style="width: 50%;" />
                    <input type="time" name="horaFin" class="soft-input" style="width: 50%;" />
                  </div>
                </div>

                <div>
                  <label class="soft-label">Consultorio Físico</label>
                  <select name="ambienteId" class="soft-select">
                    <option value="1">Consultorio 1 (Infantil)</option>
                    <option value="2">Consultorio 2 (Integral)</option>
                    <option value="3">Consultorio 3 (Adultos / Psicogerontología)</option>
                  </select>
                </div>
              </div>

              <!-- PILARES S, O, A, P ESPACIOSOS EN REJILLA 2X2 -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1.1rem; margin-bottom: 1.25rem;">
                
                <!-- S -->
                <div class="soft-subcard" style="background: var(--soft-lavender-surface); padding: 1rem;">
                  <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; font-weight: 800; color: var(--soft-purple-primary); margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                      <span class="soft-badge soft-badge-lavender" style="font-weight: 800; padding: 0.14rem 0.5rem;">S</span>
                      <span>Subjetivo *</span>
                    </div>
                    <span style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 500;">Relato de paciente y familia</span>
                  </label>
                  <textarea id="soap-s" name="subjetivo" required rows="4" class="soft-textarea" placeholder="Manifestaciones de la familia sobre la semana, estado anímico reportado, síntomas percibidos..." style="min-height: 110px; background: #FFFFFF;"></textarea>
                </div>

                <!-- O -->
                <div class="soft-subcard" style="background: var(--soft-lavender-surface); padding: 1rem;">
                  <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; font-weight: 800; color: var(--soft-mint-deep); margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                      <span class="soft-badge soft-badge-mint" style="font-weight: 800; padding: 0.14rem 0.5rem;">O</span>
                      <span>Objetivo *</span>
                    </div>
                    <span style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 500;">Observaciones y rendimiento</span>
                  </label>
                  <textarea id="soap-o" name="objetivo" required rows="4" class="soft-textarea" placeholder="Pruebas aplicadas, tiempo de atención medido, conducta observable en sala de sesión..." style="min-height: 110px; background: #FFFFFF;"></textarea>
                </div>

                <!-- A -->
                <div class="soft-subcard" style="background: var(--soft-lavender-surface); padding: 1rem;">
                  <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; font-weight: 800; color: #B45309; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                      <span class="soft-badge soft-badge-amber" style="font-weight: 800; padding: 0.14rem 0.5rem;">A</span>
                      <span>Análisis / Juicio Clínico *</span>
                    </div>
                    <span style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 500;">Apreciación diagnóstica</span>
                  </label>
                  <textarea id="soap-a" name="analisis" required rows="4" class="soft-textarea" placeholder="Interpretación diagnóstica del especialista, avances o retrocesos respecto a sesiones previas..." style="min-height: 110px; background: #FFFFFF;"></textarea>
                </div>

                <!-- P -->
                <div class="soft-subcard" style="background: var(--soft-lavender-surface); padding: 1rem;">
                  <label style="display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; font-weight: 800; color: var(--soft-emerald-text); margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                      <span class="soft-badge soft-badge-emerald" style="font-weight: 800; padding: 0.14rem 0.5rem;">P</span>
                      <span>Plan Terapéutico *</span>
                    </div>
                    <span style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 500;">Próxima intervención</span>
                  </label>
                  <textarea id="soap-p" name="plan" required rows="4" class="soft-textarea" placeholder="Actividades de la siguiente sesión, pautas de intervención coordinadas con el equipo..." style="min-height: 110px; background: #FFFFFF;"></textarea>
                </div>

              </div>

              <!-- DIAGNÓSTICO Y RECOMENDACIONES HOGAR -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
                <div class="soft-subcard" style="background: #FFFFFF; padding: 0.9rem 1rem;">
                  <label class="soft-label">Código Diagnóstico CIE-11 y DSM-5</label>
                  <input type="text" id="soap-diag" name="diagnosticoCodigo" class="soft-input" placeholder="Ej: 6A05 - TDAH o 6A03 - Lectura" />
                </div>

                <div class="soft-subcard" style="background: #FFFFFF; padding: 0.9rem 1rem;">
                  <label class="soft-label">Pautas de Estimulación en Casa para Padres o Tutores</label>
                  <input type="text" id="soap-home" name="recomendacionesHogar" class="soft-input" placeholder="Ej: Bloques de 15 min de estudio con temporizador visual..." />
                </div>
              </div>

              <!-- AVISO DE TRAZABILIDAD MÉDICA RN-07 -->
              <div class="soft-subcard" style="background: var(--soft-lavender-bg); border-color: var(--soft-border-hover); padding: 0.85rem 1.05rem; font-size: 0.78rem; color: var(--soft-text-body); display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1.25rem;">
                ${Icons.shield(18, 'var(--soft-purple-primary)')}
                <span>
                  <strong style="color: var(--soft-purple-primary);">Regla de Negocio RN-07:</strong> Una vez guardada, esta nota clínica quedará sellada digitalmente con tu nombre, matrícula profesional y marca temporal. No podrá ser eliminada físicamente de la base de datos.
                </span>
              </div>

              <!-- PIE MODAL (NIVEL 2) -->
              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-soap-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(16, '#FFFFFF')}
                  <span>Firmar y Guardar Nota SOAP</span>
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    `;

    this.attachSoapModalEvents();
  }

  attachSoapModalEvents() {
    const backdrop = document.getElementById('soap-modal-backdrop');
    const btnClose = document.getElementById('btn-close-soap-modal');
    const btnCancel = document.getElementById('btn-cancel-soap-modal');

    const closeModal = () => {
      const modalContainer = document.getElementById('modal-container-clinical');
      if (modalContainer) modalContainer.innerHTML = '';
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
      });
    }

    // Botón Asistente IA
    const btnAi = document.getElementById('btn-ai-assist-soap');
    const inputRough = document.getElementById('input-rough-notes');
    const aiBtnText = document.getElementById('ai-btn-text');

    if (btnAi && inputRough) {
      btnAi.addEventListener('click', async () => {
        const roughNotes = inputRough.value.trim();
        if (!roughNotes) {
          Toast.warning('Ingresa algunos apuntes en el campo de texto para que la IA los estructure.');
          return;
        }

        try {
          btnAi.disabled = true;
          if (aiBtnText) aiBtnText.textContent = 'Analizando con IA...';

          const res = await apiClient.post('/clinical-records/assist-soap', {
            roughNotes,
            patientContext: {
              motivo: this.currentHistory.observaciones_ingreso || 'Sesión de intervención continua',
              paciente: this.currentHistory.paciente_nombres
            },
            areaClinica: this.currentHistory.especialidad_nombre || 'Neuropsicología / Psicopedagogía'
          });

          if (res.data?.soap) {
            const s = res.data.soap;
            const fieldS = document.getElementById('soap-s');
            const fieldO = document.getElementById('soap-o');
            const fieldA = document.getElementById('soap-a');
            const fieldP = document.getElementById('soap-p');
            const fieldDiag = document.getElementById('soap-diag');
            const fieldHome = document.getElementById('soap-home');

            if (fieldS && s.subjetivo) fieldS.value = s.subjetivo;
            if (fieldO && s.objetivo) fieldO.value = s.objetivo;
            if (fieldA && s.analisis) fieldA.value = s.analisis;
            if (fieldP && s.plan) fieldP.value = s.plan;
            if (fieldDiag && s.diagnosticoSugerido) fieldDiag.value = s.diagnosticoSugerido;
            if (fieldHome && s.recomendacionesHogar) fieldHome.value = s.recomendacionesHogar;

            Toast.success(`Estructuración completada con ${res.data.motor === 'GROQ_CLOUD' ? 'GroqCloud IA' : 'Motor Clínico Local'}. Revisa y ajusta los campos antes de firmar.`);
          }
        } catch (err) {
          Toast.error('No se pudo estructurar con IA: ' + err.message);
        } finally {
          btnAi.disabled = false;
          if (aiBtnText) aiBtnText.textContent = 'Estructurar con IA';
        }
      });
    }

    // Submit del formulario
    const formSoap = document.getElementById('form-new-soap');
    if (formSoap) {
      formSoap.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(formSoap);
        const payload = Object.fromEntries(formData.entries());

        payload.pacienteId = this.currentHistory.paciente_id;
        payload.numeroSesion = Number(payload.numeroSesion);
        payload.asistidoPorIa = document.getElementById('input-rough-notes')?.value?.trim() ? true : false;

        try {
          const res = await apiClient.post(`/clinical-records/${this.currentHistory.id}/soap`, payload);
          Toast.success(`Nota de Sesión #${res.data.numero_sesion} registrada y sellada formalmente.`);
          closeModal();
          // Recargar detalle
          await this.loadHistoryDetail(this.currentHistory.id);
        } catch (err) {
          Toast.error('Error al guardar la nota SOAP: ' + err.message);
        }
      });
    }

    // Autocompletado reactivo de diagnósticos CIE-11 / DSM-5 en la nota SOAP
    const soapDiagInput = document.getElementById('soap-diag');
    if (soapDiagInput) {
      let diagTimer = null;
      soapDiagInput.addEventListener('input', (e) => {
        clearTimeout(diagTimer);
        const term = e.target.value.trim();
        if (term.length < 2) return;
        diagTimer = setTimeout(async () => {
          try {
            const res = await apiClient.get(`/clinical-records/diagnostics/search?q=${encodeURIComponent(term)}`);
            const suggestions = res.data || [];
            let container = document.getElementById('soap-diag-suggestions');
            if (!container) {
              container = document.createElement('div');
              container.id = 'soap-diag-suggestions';
              container.style.cssText = 'position: absolute; z-index: 2500; background: #FFFFFF; border: 1px solid var(--border-light); border-radius: var(--radius-sm); box-shadow: var(--shadow-md); max-height: 180px; overflow-y: auto; width: 100%; margin-top: 2px;';
              soapDiagInput.parentElement.style.position = 'relative';
              soapDiagInput.parentElement.appendChild(container);
            }
            if (suggestions.length === 0) {
              container.innerHTML = '<div style="padding: 0.5rem; font-size: 0.78rem; color: var(--text-muted);">Sin coincidencias CIE-11/DSM-5</div>';
            } else {
              container.innerHTML = suggestions.map(d => `
                <div class="diag-item" data-code="${d.codigo}" data-name="${d.nombre}" style="padding: 0.45rem 0.65rem; font-size: 0.8rem; cursor: pointer; border-bottom: 1px solid var(--border-light); hover:background: var(--bg-surface-hover);">
                  <strong style="color: var(--brand-purple-deep);">${d.codigo}</strong> - ${d.nombre}
                </div>
              `).join('');
              container.querySelectorAll('.diag-item').forEach(item => {
                item.addEventListener('click', () => {
                  soapDiagInput.value = `${item.getAttribute('data-code')} (${item.getAttribute('data-name')})`;
                  container.remove();
                });
              });
            }
          } catch (e) {
            console.warn('Error buscando diagnósticos:', e);
          }
        }, 250);
      });
    }
  }

  // =========================================================================
  // MODALES SPRINT 5: PLANES PTI, METAS SMART, CARPETAS Y DOCUMENTOS
  // =========================================================================

  openNewPlanModal() {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="new-plan-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 760px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; background: #FFFFFF;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(78, 58, 112, 0.1); display: flex; align-items: center; justify-content: center; color: var(--brand-purple-deep);">
                ${Icons.target(20)}
              </div>
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Nuevo Plan Terapéutico Individualizado (PTI)
                </h3>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                  Paciente: <strong>${this.currentHistory.paciente_nombres} ${this.currentHistory.paciente_apellidos}</strong> · Expediente: <strong>${this.currentHistory.numero_expediente}</strong>
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-plan-modal" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem;" title="Cerrar">
              ${Icons.close(20)}
            </button>
          </div>

          <div style="padding: 1.25rem 1.75rem; overflow-y: auto; flex: 1;">
            <form id="form-new-plan">
              
              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Título del Plan Terapéutico *
                </label>
                <input type="text" name="titulo" required placeholder="Ej: Plan de Estimulación en Funciones Ejecutivas y Memoria" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;" />
              </div>

              <!-- BUSCADOR NOSOLÓGICO CIE-11 / DSM-5 -->
              <div style="margin-bottom: 1rem; position: relative;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Diagnóstico Clínico de Base: CIE-11 y DSM-5
                </label>
                <input type="text" id="new-plan-diag-search" placeholder="Escribe para buscar código: TDAH, Dislexia, F90, 6A05, Alzheimer..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;" />
                <div id="new-plan-diag-suggestions" style="position: absolute; z-index: 2500; background: #FFFFFF; border: 1px solid var(--border-light); border-radius: var(--radius-sm); box-shadow: var(--shadow-md); max-height: 180px; overflow-y: auto; width: 100%; margin-top: 2px; display: none;"></div>
                
                <input type="hidden" id="new-plan-diag-codigo" name="diagnosticoCodigo" />
                <input type="hidden" id="new-plan-diag-glosa" name="diagnosticoGlosa" />
                <div id="selected-diag-badge" style="display: none; margin-top: 0.4rem; font-size: 0.8rem; font-weight: 700; color: var(--brand-purple-deep); background: rgba(78, 58, 112, 0.08); padding: 0.3rem 0.6rem; border-radius: 4px; border: 1px solid rgba(78, 58, 112, 0.2);"></div>
              </div>

              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Objetivo General Terapéutico *
                </label>
                <textarea name="objetivoGeneral" required rows="3" placeholder="Formular el objetivo general de la intervención neurocognitiva o psicopedagógica..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box; line-height: 1.5;"></textarea>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">Periodicidad Estimada</label>
                  <select name="periodicidadMeses" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.85rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;">
                    <option value="1">1 Mes (Intensivo)</option>
                    <option value="3" selected>3 Meses (Trimestral - Recomendado)</option>
                    <option value="6">6 Meses (Semestral)</option>
                    <option value="12">12 Meses (Anual)</option>
                  </select>
                </div>
                <div>
                  <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">Fecha de Inicio</label>
                  <input type="date" name="fechaInicio" value="${getBoliviaTodayDateString()}" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.85rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;" />
                </div>
                <div>
                  <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">Fecha de Revisión</label>
                  <input type="date" name="fechaRevision" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.85rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;" />
                </div>
              </div>

              <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Pautas y Recomendaciones para la Familia / Hogar
                </label>
                <textarea name="recomendacionesFamilia" rows="2" placeholder="Indicaciones para padres y tutores (técnicas de estudio, pausas activas, etc.)..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box; line-height: 1.5;"></textarea>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-plan-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(16, '#FFFFFF')}
                  <span>Crear Plan Terapéutico</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-plan-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-plan-modal')?.addEventListener('click', closeModal);

    // Live search CIE-11 / DSM-5
    const diagInput = document.getElementById('new-plan-diag-search');
    const diagSuggestions = document.getElementById('new-plan-diag-suggestions');
    const diagCodeInput = document.getElementById('new-plan-diag-codigo');
    const diagGlosaInput = document.getElementById('new-plan-diag-glosa');
    const diagBadge = document.getElementById('selected-diag-badge');

    if (diagInput && diagSuggestions) {
      let t = null;
      diagInput.addEventListener('input', (e) => {
        clearTimeout(t);
        const term = e.target.value.trim();
        if (term.length < 2) {
          diagSuggestions.style.display = 'none';
          return;
        }
        t = setTimeout(async () => {
          try {
            const res = await apiClient.get(`/clinical-records/diagnostics/search?q=${encodeURIComponent(term)}`);
            const items = res.data || [];
            if (items.length === 0) {
              diagSuggestions.innerHTML = '<div style="padding: 0.5rem; font-size: 0.78rem; color: var(--text-muted);">Sin coincidencias</div>';
            } else {
              diagSuggestions.innerHTML = items.map(d => `
                <div class="diag-sugg-item" data-code="${d.codigo}" data-name="${d.nombre}" style="padding: 0.5rem 0.75rem; font-size: 0.82rem; cursor: pointer; border-bottom: 1px solid var(--border-light);">
                  <strong style="color: var(--brand-purple-deep);">${d.codigo}</strong> · ${d.nombre}
                </div>
              `).join('');

              diagSuggestions.querySelectorAll('.diag-sugg-item').forEach(el => {
                el.addEventListener('click', () => {
                  const code = el.getAttribute('data-code');
                  const name = el.getAttribute('data-name');
                  diagCodeInput.value = code;
                  diagGlosaInput.value = name;
                  diagInput.value = '';
                  diagSuggestions.style.display = 'none';
                  diagBadge.style.display = 'inline-block';
                  diagBadge.textContent = `Seleccionado: ${code} - ${name}`;
                });
              });
            }
            diagSuggestions.style.display = 'block';
          } catch (err) {
            console.warn(err);
          }
        }, 250);
      });
    }

    // Submit handler
    const form = document.getElementById('form-new-plan');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        try {
          await apiClient.post(`/clinical-records/${this.currentHistory.id}/plans`, payload);
          Toast.success('Plan Terapéutico Individualizado (PTI) registrado con éxito.');
          closeModal();
          this.activeTab = 'plans';
          await this.loadHistoryDetail(this.currentHistory.id);
        } catch (err) {
          Toast.error('Error al registrar el plan: ' + err.message);
        }
      });
    }
  }

  openNewGoalModal(planId) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="new-goal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 680px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; background: #FFFFFF;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(92, 142, 160, 0.12); display: flex; align-items: center; justify-content: center; color: var(--brand-teal);">
                ${Icons.target(20)}
              </div>
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Agregar Meta Terapéutica SMART
                </h3>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                  Formulación de objetivo: Específico, Medible, Alcanzable, Relevante y Temporal.
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-goal-modal" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem;" title="Cerrar">
              ${Icons.close(20)}
            </button>
          </div>

          <div style="padding: 1.25rem 1.75rem; overflow-y: auto; flex: 1;">
            <form id="form-new-goal">
              
              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Descripción de la Meta SMART *
                </label>
                <textarea name="descripcionMeta" required rows="3" placeholder="Ej: Mantener el foco atencional sostenido en tareas de mesa durante 25 minutos continuos con un máximo de 1 llamado verbal..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box; line-height: 1.5;"></textarea>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">Área de Intervención *</label>
                  <select name="areaIntervencion" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.85rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;">
                    <option value="ATENCION_CONCENTRACION">Atención y Concentración</option>
                    <option value="FUNCIONES_EJECUTIVAS">Funciones Ejecutivas / Control Inhibitorio</option>
                    <option value="MEMORIA">Memoria Neurocognitiva</option>
                    <option value="LECTOESCRITURA">Lectoescritura / Lenguaje Escrito</option>
                    <option value="CALCULO_LOGICO">Cálculo y Razonamiento Lógico</option>
                    <option value="LENGUAJE_COMUNICACION">Lenguaje y Comunicación</option>
                    <option value="REGULACION_CONDUCTUAL">Autorregulación y Conducta</option>
                    <option value="SOCIOEMOCIONAL">Área Socioemocional</option>
                    <option value="PSICOMOTRICIDAD">Psicomotricidad</option>
                  </select>
                </div>

                <div>
                  <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">Porcentaje Inicial de Logro</label>
                  <select name="porcentajeLogro" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.85rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;">
                    <option value="0" selected>0% (No iniciada)</option>
                    <option value="25">25% (En proceso asistido)</option>
                    <option value="50">50% (Logro parcial con apoyos)</option>
                    <option value="75">75% (En vías de autonomía)</option>
                    <option value="100">100% (Consolidada)</option>
                  </select>
                </div>
              </div>

              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Criterio Cuantitativo de Éxito *
                </label>
                <input type="text" name="criterioExito" required placeholder="Ej: Medido mediante registro de mesa en tareas escolares con al menos 80% de efectividad..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;" />
              </div>

              <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Pauta Explicativa para el Hogar (Comprensible para el Tutor)
                </label>
                <textarea name="pautasHogar" rows="2" placeholder="Ej: Establecer una rutina diaria con un temporizador visual de mesa para las tareas de la tarde..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box; line-height: 1.5;"></textarea>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-goal-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(16, '#FFFFFF')}
                  <span>Registrar Meta SMART</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-goal-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-goal-modal')?.addEventListener('click', closeModal);

    const form = document.getElementById('form-new-goal');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        try {
          await apiClient.post(`/clinical-records/plans/${planId}/goals`, payload);
          Toast.success('Meta SMART agregada exitosamente.');
          closeModal();
          await this.loadHistoryDetail(this.currentHistory.id);
        } catch (err) {
          Toast.error('Error al agregar meta: ' + err.message);
        }
      });
    }
  }

  openUpdateGoalModal(metaId, targetPct) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="update-goal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 580px; width: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(34, 197, 94, 0.12); display: flex; align-items: center; justify-content: center; color: #16a34a;">
                ${Icons.check(20)}
              </div>
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Actualizar Avance de Meta SMART
                </h3>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                  Registro con trazabilidad y sello clínico inalterable en historial.
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-update-goal" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem;">
              ${Icons.close(20)}
            </button>
          </div>

          <div style="padding: 1.25rem 1.75rem;">
            <form id="form-update-goal">
              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Porcentaje de Logro Cuantitativo *
                </label>
                <select name="porcentajeLogro" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none;">
                  <option value="0" ${targetPct === 0 ? 'selected' : ''}>0% (No iniciada)</option>
                  <option value="25" ${targetPct === 25 ? 'selected' : ''}>25% (En proceso asistido)</option>
                  <option value="50" ${targetPct === 50 ? 'selected' : ''}>50% (Logro parcial con apoyos)</option>
                  <option value="75" ${targetPct === 75 ? 'selected' : ''}>75% (En vías de consolidación)</option>
                  <option value="100" ${targetPct === 100 ? 'selected' : ''}>100% (Objetivo Consolidado / Autónomo)</option>
                </select>
              </div>

              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Observaciones Clínicas / Desempeño en Sesión *
                </label>
                <textarea name="observacionesClinicas" required rows="3" placeholder="Describe los avances concretos, reactivos aplicados o conductas observadas que justifican este porcentaje de logro..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.86rem; background: var(--bg-surface-hover); outline: none; line-height: 1.5; box-sizing: border-box;"></textarea>
              </div>

              <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Pautas Actualizadas para el Hogar (Opcional)
                </label>
                <input type="text" name="pautasHogar" placeholder="Ajustes o nuevas recomendaciones para el tutor en casa..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.86rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;" />
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-update-goal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(16, '#FFFFFF')}
                  <span>Confirmar y Sellar Avance</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-update-goal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-update-goal')?.addEventListener('click', closeModal);

    const form = document.getElementById('form-update-goal');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        try {
          await apiClient.patch(`/clinical-records/goals/${metaId}/progress`, payload);
          Toast.success('Avance de meta SMART actualizado formalmente.');
          closeModal();
          await this.loadHistoryDetail(this.currentHistory.id);
        } catch (err) {
          Toast.error('Error al actualizar avance: ' + err.message);
        }
      });
    }
  }

  async openGoalHistoryModal(metaId, metaDesc) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="goal-history-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 680px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(78, 58, 112, 0.1); display: flex; align-items: center; justify-content: center; color: var(--brand-purple-deep);">
                ${Icons.history(20)}
              </div>
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Historial de Evolución de la Meta SMART
                </h3>
                <div style="font-size: 0.78rem; color: var(--text-secondary); max-width: 480px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                  ${metaDesc}
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-goal-history" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem;">
              ${Icons.close(20)}
            </button>
          </div>

          <div style="padding: 1.25rem 1.75rem; overflow-y: auto; flex: 1;" id="goal-history-content">
            <div style="text-align: center; padding: 2rem;">
              <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 28px; height: 28px; border: 2px solid var(--border-light); border-top-color: var(--brand-purple-deep); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
              <p style="color: var(--text-secondary); font-size: 0.85rem;">Cargando trazabilidad histórica...</p>
            </div>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-goal-history')?.addEventListener('click', closeModal);

    try {
      const res = await apiClient.get(`/clinical-records/goals/${metaId}/history`);
      const historyItems = res.data || [];
      const contentEl = document.getElementById('goal-history-content');

      if (historyItems.length === 0) {
        contentEl.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.88rem;">
            Aún no se han registrado revisiones intermedias para esta meta SMART.
          </div>
        `;
      } else {
        contentEl.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${historyItems.map(item => `
              <div style="border: 1px solid var(--border-light); background: var(--bg-surface-hover); padding: 0.85rem 1rem; border-radius: var(--radius-sm);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <span style="font-size: 0.82rem; font-weight: 800; color: var(--brand-navy);">
                    Avance: <span style="color: var(--text-muted);">${item.porcentaje_anterior}%</span> → <span style="color: var(--brand-purple-deep); font-size: 0.95rem;">${item.nuevo_porcentaje}%</span>
                  </span>
                  <span style="font-size: 0.75rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.25rem;">
                    ${Icons.calendar(12)} <span>${item.fecha_registro}</span>
                  </span>
                </div>
                <div style="font-size: 0.84rem; color: var(--brand-dark-text); line-height: 1.45; margin-bottom: 0.4rem;">
                  ${this.escapeHtml(item.observaciones_clinicas)}
                </div>
                <div style="font-size: 0.74rem; color: var(--brand-teal); font-weight: 600;">
                  Certificado por: ${item.terapeuta_nombres} ${item.terapeuta_apellidos}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (err) {
      document.getElementById('goal-history-content').innerHTML = `
        <div style="text-align: center; color: var(--brand-coral); padding: 1.5rem;">
          Error al cargar historial: ${err.message}
        </div>
      `;
    }
  }

  async openTutorMetaCheckinsModal(metaId, metaDesc) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="tutor-checkins-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 680px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); box-sizing: border-box;">
          
          <!-- CABECERA DEL MODAL -->
          <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(233, 118, 105, 0.12); display: flex; align-items: center; justify-content: center; color: var(--brand-coral); flex-shrink: 0;">
                ${Icons.family(20, 'var(--brand-coral)')}
              </div>
              <div style="min-width: 0;">
                <h3 style="color: var(--brand-navy); font-size: 1.12rem; font-weight: 800; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  Reportes de Práctica en el Hogar (Tutor)
                </h3>
                <div style="font-size: 0.78rem; color: var(--text-secondary); max-width: 460px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                  ${this.escapeHtml(metaDesc)}
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-tutor-checkins" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem; display: flex; align-items: center; justify-content: center;" title="Cerrar ventana">
              ${Icons.close(20)}
            </button>
          </div>

          <!-- CUERPO SCROLLABLE -->
          <div style="padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1;" id="tutor-checkins-content">
            <div style="text-align: center; padding: 2.5rem 1rem;">
              <div class="spinner" style="margin: 0 auto 0.5rem auto; width: 28px; height: 28px; border: 2px solid var(--border-light); border-top-color: var(--brand-coral); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
              <p style="color: var(--text-secondary); font-size: 0.85rem;">Consultando registros del tutor...</p>
            </div>
          </div>

          <!-- FOOTER -->
          <div style="padding: 0.9rem 1.5rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; background: var(--soft-lavender-surface); border-radius: 0 0 20px 20px;">
            <button type="button" id="btn-dismiss-tutor-checkins" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.45rem 1.25rem; font-size: 0.84rem; font-weight: 700;">
              Cerrar
            </button>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-tutor-checkins')?.addEventListener('click', closeModal);
    document.getElementById('btn-dismiss-tutor-checkins')?.addEventListener('click', closeModal);
    document.getElementById('tutor-checkins-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'tutor-checkins-backdrop') closeModal();
    });

    try {
      let checkins = [];
      const patientId = this.currentHistory ? (this.currentHistory.paciente_id || this.currentHistory.id) : null;
      if (patientId) {
        const res = await apiClient.get(`/clinical-records/portal/family-checkins/${patientId}?metaId=${metaId}`);
        checkins = res.data || [];
      } else {
        checkins = (this.familyCheckins || []).filter(c => Number(c.meta_id) === Number(metaId));
      }

      const contentEl = document.getElementById('tutor-checkins-content');
      if (!contentEl) return;

      if (checkins.length === 0) {
        contentEl.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
            <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--bg-surface-hover); border: 1px solid var(--border-light); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.85rem auto; color: var(--text-muted);">
              ${Icons.family(24, 'var(--text-muted)')}
            </div>
            <h4 style="color: var(--brand-navy); font-size: 1.05rem; font-weight: 800; margin: 0 0 0.4rem 0;">
              Sin reportes del tutor para esta meta
            </h4>
            <p style="color: var(--text-secondary); font-size: 0.86rem; max-width: 440px; margin: 0 auto; line-height: 1.5;">
              El tutor legal aún no ha reportado prácticas o avances domiciliarios para esta pauta específica. Tan pronto el tutor interactúe con esta meta desde su portal familiar, sus registros aparecerán aquí automáticamente.
            </p>
          </div>
        `;
      } else {
        contentEl.innerHTML = `
          <div style="margin-bottom: 0.85rem; font-size: 0.8rem; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <span>Se encontraron <strong>${checkins.length}</strong> registro(s) domiciliario(s)</span>
            <span style="font-weight: 700; color: var(--brand-coral);">Supervisión Domiciliaria</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${checkins.map(item => {
              let badgeBg = 'rgba(34, 197, 94, 0.12)';
              let badgeColor = '#16a34a';
              let badgeText = 'Fluido y Autónomo';

              if (item.nivel_respuesta === 'CON_DIFICULTAD') {
                badgeBg = 'rgba(217, 119, 6, 0.12)';
                badgeColor = '#d97706';
                badgeText = 'Con Dificultad / Resistencia';
              } else if (item.nivel_respuesta === 'NECESITO_APOYO') {
                badgeBg = 'rgba(233, 118, 105, 0.15)';
                badgeColor = 'var(--brand-coral)';
                badgeText = 'Requirió Apoyo Permanente';
              }

              const tutorName = item.tutor_nombres ? `${item.tutor_nombres} ${item.tutor_apellidos || ''}`.trim() : (item.tutor_nombre || 'Tutor Registrado');
              const filiation = item.parentesco ? ` (${item.parentesco})` : '';
              const dateDisplay = item.created_at ? (item.created_at.includes('T') ? item.created_at.replace('T', ' ').substring(0, 16) : item.created_at) : 'Fecha no registrada';

              return `
                <div style="border: 1px solid var(--border-light); background: #FFFFFF; padding: 1rem 1.15rem; border-radius: var(--radius-sm); box-shadow: var(--shadow-subtle);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                    <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; font-weight: 800; font-size: 0.74rem; border: 1px solid ${badgeColor}30; padding: 0.15rem 0.55rem; border-radius: 9999px;">
                      ${badgeText}
                    </span>
                    <span style="font-size: 0.76rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.3rem;">
                      ${Icons.calendar(12)} <span>${dateDisplay}</span>
                    </span>
                  </div>

                  <div style="background: var(--bg-surface-hover); border: 1px solid var(--soft-border-card-inner); padding: 0.6rem 0.85rem; border-radius: 8px; font-size: 0.85rem; color: var(--brand-navy); margin-bottom: 0.6rem; line-height: 1.45;">
                    <div style="font-size: 0.72rem; font-weight: 700; color: var(--brand-coral); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.2rem;">
                      Observación Cualitativa en Casa
                    </div>
                    "${this.escapeHtml(item.observacion_hogar || 'Práctica realizada sin observaciones adicionales.')}"
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.76rem; color: var(--text-secondary); flex-wrap: wrap; gap: 0.5rem;">
                    <div style="display: inline-flex; align-items: center; gap: 0.35rem; color: var(--brand-navy); font-weight: 600;">
                      ${Icons.user(12, 'var(--text-secondary)')}
                      <span>Registrado por: <strong>${this.escapeHtml(tutorName)}</strong>${this.escapeHtml(filiation)}</span>
                    </div>
                    ${item.ci ? `
                      <span style="color: var(--text-muted); font-size: 0.73rem;">
                        C.I.: ${this.escapeHtml(item.ci)} ${this.escapeHtml(item.departamento_ci || '')}
                      </span>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    } catch (err) {
      const contentEl = document.getElementById('tutor-checkins-content');
      if (contentEl) {
        contentEl.innerHTML = `
          <div style="text-align: center; color: var(--brand-coral); padding: 2rem;">
            Error al consultar los reportes del tutor: ${this.escapeHtml(err.message)}
          </div>
        `;
      }
    }
  }

  openClosePlanModal(planId, planTitle) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="close-plan-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 540px; width: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(233, 118, 105, 0.12); display: flex; align-items: center; justify-content: center; color: var(--brand-coral);">
                ${Icons.alertTriangle(20)}
              </div>
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Finalizar Plan Terapéutico
                </h3>
                <div style="font-size: 0.78rem; color: var(--text-secondary); max-width: 380px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                  ${planTitle}
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-close-plan" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem;">
              ${Icons.close(20)}
            </button>
          </div>

          <div style="padding: 1.25rem 1.75rem;">
            <form id="form-close-plan">
              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Estado Final del Plan *
                </label>
                <select name="estado" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none;">
                  <option value="CUMPLIDO" selected>CUMPLIDO (Objetivos terapéuticos consolidados)</option>
                  <option value="DESCONTINUADO">DESCONTINUADO (Reevaluación diagnóstica / Traslado)</option>
                </select>
              </div>

              <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Justificación Clínica del Cierre *
                </label>
                <textarea name="motivoCierre" required rows="3" placeholder="Registra la conclusión del caso, porcentaje global alcanzado o los motivos de reformulación del PTI..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.86rem; background: var(--bg-surface-hover); outline: none; line-height: 1.5; box-sizing: border-box;"></textarea>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-close-plan" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" class="soft-btn soft-btn-lvl-2" style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);">
                  ${Icons.check(16, '#FFFFFF')}
                  <span>Finalizar Plan</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-close-plan')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-close-plan')?.addEventListener('click', closeModal);

    const form = document.getElementById('form-close-plan');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        try {
          await apiClient.patch(`/clinical-records/plans/${planId}/status`, payload);
          Toast.success('Plan terapéutico finalizado correctamente.');
          closeModal();
          await this.loadHistoryDetail(this.currentHistory.id);
        } catch (err) {
          Toast.error('Error al finalizar plan: ' + err.message);
        }
      });
    }
  }

  openUploadDocumentModal() {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="upload-doc-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 620px; width: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(39, 52, 95, 0.1); display: flex; align-items: center; justify-content: center; color: var(--brand-navy);">
                ${Icons.upload(20)}
              </div>
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Adjuntar Estudio Clínico / Laboratorio
                </h3>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                  Carga de PDFs o imágenes médicas con custodia digital confidencial.
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-upload-modal" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem;">
              ${Icons.close(20)}
            </button>
          </div>

          <div style="padding: 1.25rem 1.75rem;">
            <form id="form-upload-document">
              
              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Carpeta de Destino *
                </label>
                <select name="carpetaId" required style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none;">
                  ${this.folders.filter(f => f.activo === 1).map(f => `
                    <option value="${f.id}" ${this.selectedFolderId === f.id ? 'selected' : ''}>${f.nombre}</option>
                  `).join('')}
                </select>
              </div>

              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Categoría Clínica *
                </label>
                <select id="select-doc-category" name="categoriaClinicaSelect" required style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none;">
                  <option value="LABORATORIO_ESTUDIO" selected>Estudio / Laboratorio (EEG, TAC, Resonancia, Sangre)</option>
                  <option value="EVALUACION_NEUROPSICOLOGICA">Evaluación Neuropsicológica (Test, Protocolo)</option>
                  <option value="INFORME_ESCOLAR">Informe Escolar / Gabinete Psicopedagógico</option>
                  <option value="CONSENTIMIENTO_LEGAL">Consentimiento Informado / Documentación Legal</option>
                  <option value="OTRO">Otro Documento Médico Externo</option>
                  <option value="CUSTOM">Personalizada (Escribir a mano)...</option>
                </select>

                <div id="custom-category-group" style="display: none; margin-top: 0.6rem;">
                  <label style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--brand-purple-deep); margin-bottom: 0.25rem;">
                    Especifique la Categoría Clínica a Mano *
                  </label>
                  <input 
                    type="text" 
                    id="input-custom-category" 
                    placeholder="Ej. Fisioterapia Motora, Audiometría, Genética Clínica..." 
                    style="width: 100%; padding: 0.6rem; border: 1px solid var(--brand-purple-deep); border-radius: var(--radius-sm); font-size: 0.85rem; background: #FFFFFF; outline: none; box-sizing: border-box;" 
                  />
                </div>
              </div>

              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Descripción / Hallazgos Relevantes (Opcional)
                </label>
                <input type="text" name="descripcion" placeholder="Ej: Trazado normal sin paroxismos, emitido por Neuropediatría..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.86rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;" />
              </div>

              <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Seleccionar Archivo (PDF o Imagen - Máx. 15MB) *
                </label>
                <input type="file" id="input-doc-file" name="file" required accept=".pdf,image/png,image/jpeg,image/webp" style="width: 100%; padding: 0.5rem; border: 1px dashed var(--brand-purple-deep); border-radius: var(--radius-sm); font-size: 0.85rem; background: var(--brand-light-bg); cursor: pointer;" />
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-upload-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" id="btn-submit-upload-doc" class="soft-btn soft-btn-lvl-2">
                  ${Icons.upload(16, '#FFFFFF')}
                  <span>Subir y Custodiar Estudio</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-upload-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-upload-modal')?.addEventListener('click', closeModal);

    const selectCat = document.getElementById('select-doc-category');
    const customGroup = document.getElementById('custom-category-group');
    const inputCustom = document.getElementById('input-custom-category');
    if (selectCat && customGroup) {
      selectCat.addEventListener('change', () => {
        if (selectCat.value === 'CUSTOM') {
          customGroup.style.display = 'block';
          if (inputCustom) inputCustom.focus();
        } else {
          customGroup.style.display = 'none';
        }
      });
    }

    const form = document.getElementById('form-upload-document');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-submit-upload-doc');
        const fileInput = document.getElementById('input-doc-file');

        if (!fileInput.files || fileInput.files.length === 0) {
          Toast.warning('Selecciona un archivo PDF o imagen.');
          return;
        }

        let finalCategory = selectCat ? selectCat.value : 'OTRO';
        if (finalCategory === 'CUSTOM') {
          const typedCat = inputCustom ? inputCustom.value.trim() : '';
          if (!typedCat) {
            Toast.warning('Por favor escribe el nombre de la categoría clínica personalizada.');
            if (inputCustom) inputCustom.focus();
            return;
          }
          finalCategory = typedCat;
        }

        const formData = new FormData(form);
        formData.set('categoriaClinica', finalCategory);

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Subiendo archivo...';
          }

          await apiClient.upload(`/clinical-records/patient/${this.currentHistory.paciente_id}/documents`, formData);

          Toast.success('Estudio clínico adjuntado correctamente.');
          closeModal();
          this.activeTab = 'folders';
          await this.loadHistoryDetail(this.currentHistory.id);
        } catch (err) {
          Toast.error('Error al cargar documento: ' + err.message);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Subir y Custodiar Estudio';
          }
        }
      });
    }
  }

  openNewFolderModal() {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="new-folder-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 520px; width: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(92, 142, 160, 0.12); display: flex; align-items: center; justify-content: center; color: var(--brand-teal);">
                ${Icons.folder(20)}
              </div>
              <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 800; margin: 0;">
                Nueva Carpeta Digital
              </h3>
            </div>
            <button type="button" id="btn-close-new-folder" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem;">
              ${Icons.close(20)}
            </button>
          </div>

          <div style="padding: 1.25rem 1.75rem;">
            <form id="form-new-folder">
              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">Nombre de la Carpeta *</label>
                <input type="text" name="nombre" required placeholder="Ej: Evaluaciones WISC-V o Informes Fonoaudiología" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.88rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;" />
              </div>

              <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">Descripción (Opcional)</label>
                <input type="text" name="descripcion" placeholder="Breve descripción del contenido de la carpeta..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.86rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box;" />
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-new-folder" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" class="soft-btn soft-btn-lvl-2">Crear Carpeta</button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-new-folder')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-new-folder')?.addEventListener('click', closeModal);

    const form = document.getElementById('form-new-folder');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        try {
          const res = await apiClient.post(`/clinical-records/patient/${this.currentHistory.paciente_id}/folders`, payload);
          Toast.success('Carpeta creada exitosamente.');
          closeModal();
          this.selectedFolderId = res.data.id;
          await this.loadHistoryDetail(this.currentHistory.id);
        } catch (err) {
          Toast.error('Error al crear carpeta: ' + err.message);
        }
      });
    }
  }

  async openDocumentViewerModal(docId, docName, docMime) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    const isPdf = docMime === 'application/pdf';
    const isMobile = window.innerWidth <= 900 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const token = store.getState().token || localStorage.getItem('psi_token') || '';
    const fallbackViewUrl = `/api/clinical-records/documents/${docId}/view?token=${encodeURIComponent(token)}`;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="doc-viewer-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.75); backdrop-filter: blur(6px); z-index: 2100; display: flex; align-items: center; justify-content: center; padding: 0.5rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 1050px; width: 96%; height: 90vh; max-height: 94vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); overflow: hidden;">
          
          <!-- CABECERA VISOR RESPONSIVA -->
          <div style="padding: 0.85rem 1.15rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; gap: 0.5rem; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 0.65rem; min-width: 0; flex: 1;">
              <div style="width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0; background: ${isPdf ? 'rgba(233, 118, 105, 0.12)' : 'rgba(92, 142, 160, 0.12)'}; display: flex; align-items: center; justify-content: center;">
                ${isPdf ? Icons.filePdf(18, 'var(--brand-coral)') : Icons.fileText(18, 'var(--brand-teal)')}
              </div>
              <div style="min-width: 0; flex: 1;">
                <h4 style="color: var(--brand-navy); font-size: 0.95rem; font-weight: 800; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(docName)}">
                  ${this.escapeHtml(docName)}
                </h4>
                <div style="font-size: 0.72rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  Visor Clínico Seguro · Centro PSI Aprende
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.45rem; flex-shrink: 0;">
              ${!isMobile && isPdf ? `
                <a href="${fallbackViewUrl}" target="_blank" rel="noopener noreferrer" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; text-decoration: none;" title="Abrir en pestaña nueva">
                  ${Icons.share(14)}
                  <span>Pestaña</span>
                </a>
              ` : ''}
              <a id="btn-download-doc-viewer" href="${fallbackViewUrl}&download=1" download="${this.escapeHtml(docName)}" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; text-decoration: none;" title="Descargar Copia">
                ${Icons.download(14)}
                <span>Descargar</span>
              </a>
              <button type="button" id="btn-close-viewer" class="soft-modal-close-btn" title="Cerrar Visor">
                ${Icons.close(18)}
              </button>
            </div>
          </div>

          <!-- CONTENIDO VISOR CON IFRAME, IMAGEN O VISTA MÓVIL SEGURA -->
          <div id="viewer-content-body" style="flex: 1; min-height: 0; background: #f8fafc; overflow: auto; display: flex; align-items: center; justify-content: center; position: relative;">
            <div id="viewer-loading-spinner" style="text-align: center; color: var(--brand-purple-deep);">
              <div style="display: inline-block; animation: spin 1s linear infinite; margin-bottom: 0.5rem;">
                ${Icons.refresh(28)}
              </div>
              <div style="font-size: 0.85rem; font-weight: 600;">Cargando documento clínico seguro...</div>
            </div>
          </div>

        </div>
      </div>
    `;

    let activeBlobUrl = null;

    const cleanupViewer = () => {
      if (activeBlobUrl) {
        URL.revokeObjectURL(activeBlobUrl);
        activeBlobUrl = null;
      }
      modalContainer.innerHTML = '';
    };

    document.getElementById('btn-close-viewer')?.addEventListener('click', cleanupViewer);
    document.getElementById('doc-viewer-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'doc-viewer-backdrop') cleanupViewer();
    });

    try {
      // Obtenemos el archivo mediante fetch autenticado para generar un Blob in-memory
      const res = await fetch(`/api/clinical-records/documents/${docId}/view`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `Error HTTP ${res.status} al recuperar archivo`);
      }

      const blob = await res.blob();
      activeBlobUrl = URL.createObjectURL(blob);

      const downloadBtn = document.getElementById('btn-download-doc-viewer');
      if (downloadBtn) {
        downloadBtn.href = activeBlobUrl;
      }

      const container = document.getElementById('viewer-content-body');
      if (container) {
        if (isPdf) {
          if (isMobile) {
            // EN MÓVIL: Los navegadores móviles bloquean iframes de PDF ('Chrome ha bloqueado esta página').
            // Se ofrece apertura directa en el lector de PDF nativo a pantalla completa y descarga.
            container.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 2rem 1.25rem; text-align: center; background: #FFFFFF; width: 100%; box-sizing: border-box;">
                <div style="width: 68px; height: 68px; border-radius: 18px; background: rgba(233, 118, 105, 0.12); display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; color: var(--brand-coral);">
                  ${Icons.filePdf(36, 'var(--brand-coral)')}
                </div>
                <h4 style="color: var(--brand-navy); font-size: 1.05rem; font-weight: 800; margin: 0 0 0.35rem 0; word-break: break-word; max-width: 320px;">
                  ${this.escapeHtml(docName)}
                </h4>
                <div class="badge badge-purple" style="font-size: 0.72rem; margin-bottom: 1.15rem;">
                  Documento PDF Confidencial
                </div>
                <p style="color: var(--text-secondary); font-size: 0.84rem; max-width: 300px; margin: 0 0 1.5rem 0; line-height: 1.45;">
                  En teléfonos móviles, los documentos PDF se abren en pantalla completa a través del lector de tu navegador con soporte táctil y zoom.
                </p>
                <div style="display: flex; flex-direction: column; gap: 0.75rem; width: 100%; max-width: 280px;">
                  <a 
                    href="${fallbackViewUrl}" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    class="soft-btn soft-btn-lvl-1" 
                    style="text-decoration: none;"
                  >
                    ${Icons.share(18, '#FFFFFF')}
                    <span>Abrir y Ver PDF Completo</span>
                  </a>
                  <a 
                    href="${fallbackViewUrl}&download=1" 
                    download="${this.escapeHtml(docName)}" 
                    class="soft-btn soft-btn-lvl-1-muted" 
                    style="text-decoration: none;"
                  >
                    ${Icons.download(16)}
                    <span>Descargar Copia</span>
                  </a>
                </div>
              </div>
            `;
          } else {
            // EN ESCRITORIO: Iframe integrado
            container.innerHTML = `
              <iframe 
                src="${activeBlobUrl}#toolbar=1" 
                style="width: 100%; height: 100%; border: none;"
                title="${this.escapeHtml(docName)}"
              ></iframe>
            `;
          }
        } else {
          // IMÁGENES: Visualización directa en modal con scroll y zoom
          container.innerHTML = `
            <div style="padding: 1.5rem; max-height: 100%; overflow: auto; text-align: center; width: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: center;">
              <img src="${activeBlobUrl}" alt="${this.escapeHtml(docName)}" style="max-width: 100%; max-height: 75vh; object-fit: contain; border-radius: 6px; box-shadow: var(--shadow-md);" />
            </div>
          `;
        }
      }
    } catch (err) {
      const container = document.getElementById('viewer-content-body');
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 2rem; max-width: 480px;">
            <div style="color: var(--brand-coral); margin-bottom: 0.75rem;">
              ${Icons.alertTriangle(36)}
            </div>
            <h4 style="color: var(--brand-navy); margin-bottom: 0.5rem;">No se pudo visualizar el archivo</h4>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1.25rem;">
              ${this.escapeHtml(err.message)}
            </p>
            <a href="${fallbackViewUrl}&download=1" download="${this.escapeHtml(docName)}" class="soft-btn soft-btn-lvl-1" style="display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none;">
              ${Icons.download(16, '#FFFFFF')}
              <span>Intentar Descarga Directa</span>
            </a>
          </div>
        `;
      }
    }
  }

  openDeactivateFolderModal(folderId, folderName) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="deactivate-folder-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.55); backdrop-filter: blur(4px); z-index: 2100; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 520px; width: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(233, 118, 105, 0.12); display: flex; align-items: center; justify-content: center; color: var(--brand-coral);">
                ${Icons.archive(20, 'var(--brand-coral)')}
              </div>
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Desvincular Carpeta Clínica
                </h3>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                  Baja lógica con preservación íntegra de estudios y trazabilidad médica.
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-deactivate-folder" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem;">
              ${Icons.close(20)}
            </button>
          </div>

          <div style="padding: 1.5rem 1.75rem;">
            <p style="font-size: 0.9rem; color: var(--brand-navy); margin: 0 0 1.25rem 0; line-height: 1.5;">
              Confirmas la desvinculación de la carpeta <strong>${this.escapeHtml(folderName)}</strong>. La carpeta se archivará y podrá ser reincorporada posteriormente en cualquier momento.
            </p>

            <form id="form-deactivate-folder">
              <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Motivo de Desvinculación / Baja <span style="color: var(--brand-coral);">*</span>
                </label>
                <textarea 
                  id="input-folder-deactivate-reason" 
                  name="motivo_baja" 
                  rows="3" 
                  required 
                  placeholder="Ej. Estudios concluidos, carpeta creada por error o reorganización temática del expediente..."
                  style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.86rem; background: var(--bg-surface-hover); outline: none; box-sizing: border-box; resize: vertical;"
                ></textarea>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-deactivate-folder" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" class="soft-btn soft-btn-lvl-2" style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);">
                  ${Icons.archive(16, '#FFFFFF')}
                  <span>Confirmar Desvinculación</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-deactivate-folder')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-deactivate-folder')?.addEventListener('click', closeModal);

    const form = document.getElementById('form-deactivate-folder');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reasonInput = document.getElementById('input-folder-deactivate-reason');
        const reason = reasonInput ? reasonInput.value.trim() : '';

        if (!reason) {
          Toast.warning('Debes ingresar un motivo de desvinculación.');
          return;
        }

        try {
          await apiClient.patch(`/clinical-records/patient/${this.currentHistory.paciente_id}/folders/${folderId}/status`, {
            activo: false,
            motivo_baja: reason
          });
          Toast.success(`Carpeta "${folderName}" desvinculada exitosamente.`);
          closeModal();
          if (this.selectedFolderId === Number(folderId)) {
            this.selectedFolderId = null;
          }
          await this.loadHistoryDetail(this.currentHistory.id);
        } catch (err) {
          Toast.error('Error al desvincular carpeta: ' + err.message);
        }
      });
    }
  }

  openInactiveFoldersModal() {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    const inactiveList = this.inactiveFolders || [];

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="inactive-folders-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.55); backdrop-filter: blur(4px); z-index: 2100; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 780px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <!-- CABECERA -->
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(233, 118, 105, 0.12); display: flex; align-items: center; justify-content: center; color: var(--brand-coral);">
                ${Icons.archive(20, 'var(--brand-coral)')}
              </div>
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.2rem; font-weight: 800; margin: 0;">
                  Carpetas Clínicas Desvinculadas / Archivadas
                </h3>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">
                  Repositorio de carpetas en baja lógica. Puedes reincorporarlas al expediente activo con un solo clic.
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-inactive-modal" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem;">
              ${Icons.close(20)}
            </button>
          </div>

          <!-- CUERPO / LISTADO -->
          <div style="padding: 1.5rem 1.75rem; overflow-y: auto; flex: 1;">
            ${inactiveList.length === 0 ? `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <div style="margin-bottom: 0.75rem; color: var(--text-muted); display: flex; justify-content: center;">
                  ${Icons.archive(42)}
                </div>
                <h4 style="color: var(--brand-navy); margin: 0 0 0.25rem 0;">No existen carpetas desvinculadas</h4>
                <p style="font-size: 0.85rem; margin: 0;">Todas las carpetas del expediente se encuentran actualmente en estado activo.</p>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                ${inactiveList.map(f => `
                  <div style="background: var(--bg-surface-hover); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div style="flex: 1; min-width: min(100%, 260px);">
                      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                        <span style="font-weight: 800; font-size: 0.95rem; color: var(--brand-navy);">${this.escapeHtml(f.nombre)}</span>
                        <span class="badge" style="background: rgba(233, 118, 105, 0.15); color: var(--brand-coral); font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.45rem;">Desvinculada</span>
                        ${f.es_sistema ? `<span class="badge badge-purple" style="font-size: 0.65rem;">Sistema</span>` : ''}
                      </div>

                      <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.4rem;">
                        ${this.escapeHtml(f.descripcion || 'Sin descripción adicional.')}
                      </div>

                      <div style="font-size: 0.76rem; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
                        <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                          ${Icons.calendar(12)}
                          <span>Fecha de baja: <strong>${f.fecha_baja ? f.fecha_baja.split(' ')[0] : 'Archivada'}</strong></span>
                        </span>
                        <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                          ${Icons.fileText(12)}
                          <span>Contiene: <strong>${f.total_documentos || 0} estudios</strong></span>
                        </span>
                      </div>

                      ${f.motivo_baja ? `
                        <div style="margin-top: 0.45rem; font-size: 0.8rem; color: var(--text-secondary);">
                          <strong style="color: var(--brand-navy);">Motivo de baja:</strong> ${this.escapeHtml(f.motivo_baja)}
                        </div>
                      ` : ''}
                    </div>

                    <div>
                      <button 
                        type="button" 
                        class="soft-btn soft-btn-sm soft-btn-lvl-2 btn-restore-folder-action" 
                        data-folder-id="${f.id}"
                        data-folder-name="${this.escapeHtml(f.nombre)}"
                      >
                        ${Icons.restore(14, '#FFFFFF')}
                        <span>Reincorporar</span>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- PIE DE MODAL -->
          <div style="padding: 1rem 1.75rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; background: var(--soft-lavender-surface); border-radius: 0 0 20px 20px;">
            <button type="button" id="btn-close-inactive-modal-footer" class="soft-btn soft-btn-lvl-2-soft">Cerrar</button>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-inactive-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-inactive-modal-footer')?.addEventListener('click', closeModal);

    modalContainer.querySelectorAll('.btn-restore-folder-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const folderId = e.currentTarget.getAttribute('data-folder-id');
        const folderName = e.currentTarget.getAttribute('data-folder-name') || 'Carpeta';

        try {
          await apiClient.patch(`/clinical-records/patient/${this.currentHistory.paciente_id}/folders/${folderId}/status`, {
            activo: true
          });
          Toast.success(`Carpeta "${folderName}" reincorporada exitosamente al expediente.`);
          closeModal();
          this.selectedFolderId = Number(folderId);
          await this.loadHistoryDetail(this.currentHistory.id);
        } catch (err) {
          Toast.error('Error al reincorporar carpeta: ' + err.message);
        }
      });
    });
  }

  openInactiveDocumentsModal() {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    const inactiveList = this.inactiveDocs || [];

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="inactive-docs-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 720px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <!-- ENCABEZADO DE MODAL -->
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; background: #FFFFFF;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(233, 118, 105, 0.12); display: flex; align-items: center; justify-content: center; color: var(--brand-coral);">
                ${Icons.fileText(22)}
              </div>
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.2rem; font-weight: 800; margin: 0 0 0.15rem 0;">
                  Estudios Clínicos Desvinculados
                </h3>
                <span style="font-size: 0.8rem; color: var(--text-secondary);">
                  Historial de documentos anulados bajo custodia médica y opción de reincorporación
                </span>
              </div>
            </div>
            <button type="button" id="btn-close-inactive-docs-modal" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem;">
              ${Icons.close(20)}
            </button>
          </div>

          <!-- CUERPO / LISTADO -->
          <div style="padding: 1.5rem 1.75rem; overflow-y: auto; flex: 1;">
            ${inactiveList.length === 0 ? `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <div style="margin-bottom: 0.75rem; color: var(--text-muted); display: flex; justify-content: center;">
                  ${Icons.fileText(42)}
                </div>
                <h4 style="color: var(--brand-navy); margin: 0 0 0.25rem 0;">No existen estudios desvinculados</h4>
                <p style="font-size: 0.85rem; margin: 0;">Todos los documentos y estudios del paciente se encuentran actualmente activos en sus respectivas carpetas.</p>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                ${inactiveList.map(doc => {
                  const isPdf = doc.tipo_mime === 'application/pdf';
                  const sizeKb = Math.round((doc.tamano_bytes || 0) / 1024);
                  const sizeFormatted = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

                  return `
                    <div style="background: var(--bg-surface-hover); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                      <div style="flex: 1; min-width: min(100%, 260px);">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                          <span style="font-weight: 800; font-size: 0.95rem; color: var(--brand-navy); word-break: break-word;">
                            ${this.escapeHtml(doc.nombre_original)}
                          </span>
                          <span class="badge" style="background: rgba(233, 118, 105, 0.15); color: var(--brand-coral); font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.45rem;">Desvinculado</span>
                          <span class="badge ${isPdf ? 'badge-coral' : 'badge-teal'}" style="font-size: 0.65rem;">
                            ${isPdf ? 'PDF' : 'Imagen'}
                          </span>
                        </div>

                        <div style="font-size: 0.76rem; color: var(--text-muted); display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin-bottom: 0.35rem;">
                          <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                            ${Icons.folder(12)}
                            <span>Carpeta de origen: <strong>${this.escapeHtml(doc.carpeta_nombre || 'General')}</strong></span>
                          </span>
                          <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                            ${Icons.database(12)}
                            <span>${sizeFormatted}</span>
                          </span>
                          <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                            ${Icons.calendar(12)}
                            <span>Fecha de baja: <strong>${doc.fecha_anulacion ? doc.fecha_anulacion.split(' ')[0] : 'Archivado'}</strong></span>
                          </span>
                          ${doc.anulado_por_nombre ? `
                            <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                              ${Icons.user(12)}
                              <span>Anulado por: <strong>${this.escapeHtml(doc.anulado_por_nombre)}</strong></span>
                            </span>
                          ` : ''}
                        </div>

                        ${doc.motivo_anulacion ? `
                          <div style="margin-top: 0.45rem; font-size: 0.8rem; color: var(--text-secondary); background: #FFFFFF; padding: 0.4rem 0.65rem; border-radius: 4px; border: 1px solid var(--border-light);">
                            <strong style="color: var(--brand-navy);">Motivo clínico de baja:</strong> ${this.escapeHtml(doc.motivo_anulacion)}
                          </div>
                        ` : ''}
                      </div>

                      <div>
                        <button 
                          type="button" 
                          class="soft-btn soft-btn-sm soft-btn-lvl-2 btn-restore-doc-action" 
                          data-doc-id="${doc.id}"
                          data-doc-name="${this.escapeHtml(doc.nombre_original)}"
                        >
                          ${Icons.restore(14, '#FFFFFF')}
                          <span>Reincorporar</span>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

          <!-- PIE DE MODAL -->
          <div style="padding: 1rem 1.75rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; background: var(--soft-lavender-surface); border-radius: 0 0 20px 20px;">
            <button type="button" id="btn-close-inactive-docs-footer" class="soft-btn soft-btn-lvl-2-soft">Cerrar</button>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-inactive-docs-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-inactive-docs-footer')?.addEventListener('click', closeModal);

    modalContainer.querySelectorAll('.btn-restore-doc-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const docId = e.currentTarget.getAttribute('data-doc-id');
        const docName = e.currentTarget.getAttribute('data-doc-name') || 'Estudio';

        try {
          await apiClient.post(`/clinical-records/documents/${docId}/restore`);
          Toast.success(`Estudio "${docName}" reincorporado exitosamente a su carpeta.`);
          closeModal();
          await this.loadHistoryDetail(this.currentHistory.id);
        } catch (err) {
          Toast.error('Error al reincorporar estudio: ' + err.message);
        }
      });
    });
  }

  openDeleteDocumentModal(docId, docName) {
    const modalContainer = document.getElementById('modal-container-clinical');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="delete-doc-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.5); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="modal-card" style="background: #FFFFFF; border-radius: var(--radius-md); max-width: 520px; width: 100%; display: flex; flex-direction: column; box-shadow: var(--shadow-lg); border: 1px solid var(--border-light); animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
          
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(233, 118, 105, 0.12); display: flex; align-items: center; justify-content: center; color: var(--brand-coral);">
                ${Icons.trash(20)}
              </div>
              <div>
                <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 800; margin: 0 0 0.1rem 0;">
                  Desvincular Estudio Clínico
                </h3>
                <span style="font-size: 0.78rem; color: var(--text-secondary);">
                  Baja lógica con preservación íntegra de archivo y trazabilidad médica
                </span>
              </div>
            </div>
            <button type="button" id="btn-close-delete-doc" style="background: transparent; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 0.35rem;">
              ${Icons.close(20)}
            </button>
          </div>

          <div style="padding: 1.25rem 1.75rem;">
            <p style="font-size: 0.9rem; color: var(--brand-navy); margin: 0 0 1.25rem 0; line-height: 1.5;">
              ¿Confirmas la desvinculación del estudio <strong>"${this.escapeHtml(docName)}"</strong>? El documento dejará de mostrarse en las carpetas activas, pero el archivo se mantendrá resguardado en el servidor y podrá reincorporarse en cualquier momento desde la sección de estudios desvinculados.
            </p>

            <form id="form-delete-doc">
              <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem;">
                  Motivo de Desvinculación / Anulación <span style="color: var(--brand-coral);">*</span>
                </label>
                <textarea name="motivoAnulacion" required minlength="2" rows="3" placeholder="Ej: No se necesita más, archivo subido por error o estudio reemplazado..." style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: 0.86rem; background: var(--bg-surface-hover); outline: none; line-height: 1.5; box-sizing: border-box;"></textarea>
                <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 0.35rem;">
                  Indica la razón de la baja para mantener el registro de trazabilidad clínica.
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-delete-doc" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" class="soft-btn soft-btn-lvl-2" style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);">
                  Confirmar Desvinculación
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-delete-doc')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-delete-doc')?.addEventListener('click', closeModal);

    const form = document.getElementById('form-delete-doc');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        const motivoText = (payload.motivoAnulacion || '').trim();
        if (!motivoText || motivoText.length < 2) {
          Toast.error('Debe ingresar una justificación o motivo válido para desvincular el documento.');
          return;
        }

        try {
          await apiClient.delete(`/clinical-records/documents/${docId}?motivoAnulacion=${encodeURIComponent(motivoText)}`, {
            body: { motivoAnulacion: motivoText }
          });
          Toast.success('Estudio clínico desvinculado formalmente.');
          closeModal();
          await this.loadHistoryDetail(this.currentHistory.id);
        } catch (err) {
          Toast.error('Error al desvincular estudio: ' + err.message);
        }
      });
    }
  }

  async handleUnlinkTutor(patientId, tutorId, tutorName) {
    const confirmed = await ConfirmModal.show({
      title: '¿Desvincular tutor del expediente?',
      message: `¿Confirmas la desvinculación de "${tutorName}"? El familiar dejará de visualizar este expediente y sus metas terapéuticas en el portal familiar.`,
      confirmText: 'Sí, desvincular tutor',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await apiClient.delete(`/api/patients/${patientId}/tutors/${tutorId}`);
      Toast.success('Tutor desvinculado formalmente del expediente.');
      const modalBackdrop = document.getElementById('link-tutor-modal-backdrop');
      if (modalBackdrop) modalBackdrop.remove();
      await this.loadHistoryDetail(this.currentHistory.id);
    } catch (err) {
      Toast.error('No se pudo desvincular el tutor: ' + (err.message || 'Error desconocido'));
    }
  }

  async openLinkTutorModal(patientId, currentTutor = null) {
    let modalBackdrop = document.getElementById('link-tutor-modal-backdrop');
    if (modalBackdrop) modalBackdrop.remove();

    const patientName = `${this.currentHistory?.paciente_nombres || ''} ${this.currentHistory?.paciente_apellidos || ''}`.trim();
    const patientCode = this.currentHistory?.numero_expediente || '';

    modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'link-tutor-modal-backdrop';
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.style.cssText = `
      position: fixed; inset: 0; background: rgba(39, 52, 95, 0.55);
      backdrop-filter: blur(4px); z-index: 2000; display: flex;
      align-items: center; justify-content: center; padding: 1rem;
    `;

    modalBackdrop.innerHTML = `
      <div class="soft-modal-card" style="max-width: 640px; width: 100%; max-height: 90vh;">
        
        <!-- CABECERA DEL MODAL (NIVEL 2) -->
        <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.family(20, 'var(--soft-purple-primary)')}
            </div>
            <div>
              <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0 0 0.12rem 0; letter-spacing: -0.015em;">
                Vincular Tutor al Expediente
              </h3>
              <div style="font-size: 0.78rem; color: var(--soft-text-body);">
                Paciente: <strong style="color: var(--soft-text-title);">${this.escapeHtml(patientName)}</strong> (<strong style="color: var(--soft-purple-primary);">${this.escapeHtml(patientCode)}</strong>)
              </div>
            </div>
          </div>
          <button type="button" id="btn-close-link-tutor-modal" class="soft-modal-close-btn" title="Cerrar">
            ${Icons.close(18)}
          </button>
        </div>

        <!-- CUERPO DEL MODAL (SCROLLABLE) -->
        <div style="padding: 1.35rem 1.65rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.2rem;">
          
          ${currentTutor ? `
            <div class="soft-subcard" style="background: var(--soft-mint-bg); border-color: rgba(26, 166, 156, 0.28); padding: 0.95rem 1.1rem; flex-direction: row; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <div style="font-size: 0.72rem; font-weight: 800; color: var(--soft-mint-deep); text-transform: uppercase; letter-spacing: 0.04em;">Tutor Actualmente Vinculado</div>
                <div style="font-size: 0.96rem; font-weight: 800; color: var(--soft-text-title); margin-top: 0.15rem;">${this.escapeHtml(currentTutor.nombres)} ${this.escapeHtml(currentTutor.apellidos)} (${this.escapeHtml(currentTutor.parentesco || 'TUTOR')})</div>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                  WhatsApp: ${this.escapeHtml(currentTutor.whatsapp)} ${currentTutor.usuario_email ? `· Cuenta: ${this.escapeHtml(currentTutor.usuario_email)}` : ''}
                </div>
              </div>
              <button type="button" id="btn-unlink-current-modal" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="color: #BE123C; flex-shrink: 0;">
                Desvincular
              </button>
            </div>
          ` : ''}

          <!-- BUSCADOR EN VIVO DE TUTORES -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
              <label class="soft-label" style="margin: 0;">
                Buscar Tutor Registrado
              </label>
              <button type="button" id="btn-toggle-create-tutor-inline" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="font-size: 0.74rem; padding: 0.25rem 0.65rem;">
                + Registrar Nuevo Tutor
              </button>
            </div>
            <div class="soft-search-box" style="width: 100%;">
              <span class="soft-search-box-icon">
                ${Icons.search(16, 'var(--soft-purple-primary)')}
              </span>
              <input 
                type="text" 
                id="input-search-tutors-modal" 
                placeholder="Buscar por nombre, apellidos, C.I., teléfono o correo..." 
                class="soft-input" 
              />
            </div>
            <div style="font-size: 0.74rem; color: var(--soft-text-muted); margin-top: 0.35rem;">
              Busca tutores registrados en recepción o tutores con cuenta creada en el portal web.
            </div>
          </div>

          <!-- RESULTADOS DE BÚSQUEDA -->
          <div id="tutors-search-results-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; padding-right: 0.25rem;">
            <div style="text-align: center; padding: 1.5rem; color: var(--soft-text-muted); font-size: 0.85rem;">
              Cargando tutores disponibles...
            </div>
          </div>

          <!-- TUTOR SELECCIONADO PARA ASIGNAR -->
          <div id="selected-tutor-container" class="soft-subcard" style="display: none; background: var(--soft-lavender-surface); border: 1.5px solid var(--soft-purple-primary); padding: 1.1rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
              <div>
                <span class="soft-badge soft-badge-lavender" style="margin-bottom: 0.35rem; display: inline-flex;">
                  Tutor Seleccionado para Vincular
                </span>
                <div id="selected-tutor-name" style="font-size: 1.05rem; font-weight: 800; color: var(--soft-text-title);"></div>
                <div id="selected-tutor-contact" style="font-size: 0.82rem; color: var(--soft-text-body); margin-top: 0.15rem;"></div>
                <div id="selected-tutor-account-status" style="margin-top: 0.35rem;"></div>
              </div>
              <button type="button" id="btn-cancel-selected-tutor" style="background: none; border: none; cursor: pointer; color: #BE123C; font-size: 0.76rem; font-weight: 700;">
                Cambiar Selección
              </button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; border-top: 1px dashed var(--soft-divider); padding-top: 0.75rem;">
              <div>
                <label class="soft-label">
                  Parentesco con el Paciente *
                </label>
                <select id="select-tutor-parentesco" class="soft-select">
                  <option value="PADRE">PADRE</option>
                  <option value="MADRE">MADRE</option>
                  <option value="TUTOR_LEGAL" selected>TUTOR LEGAL</option>
                  <option value="ABUELO_A">ABUELO / ABUELA</option>
                  <option value="TIO_A">TÍO / TÍA</option>
                  <option value="HERMANO_MAYOR">HERMANO / HERMANA MAYOR</option>
                  <option value="OTRO">OTRO</option>
                </select>
              </div>

              <div style="display: flex; align-items: center; padding-top: 1.25rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; font-weight: 700; color: var(--soft-text-title); cursor: pointer;">
                  <input type="checkbox" id="check-is-principal" checked />
                  <span>¿Es el Tutor Principal?</span>
                </label>
              </div>
            </div>
          </div>

          <!-- FORMULARIO DESPLEGABLE: CREAR NUEVO TUTOR AL VUELO -->
          <div id="create-tutor-inline-panel" class="soft-subcard" style="display: none; background: #FFFFFF; border: 1px dashed var(--soft-border-hover); padding: 1.1rem;">
            <div style="font-size: 0.88rem; font-weight: 800; color: var(--soft-text-title); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
              <span style="color: var(--soft-purple-primary);">${Icons.plus(16)}</span>
              <span>Registrar Nuevo Tutor en el Centro</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-bottom: 0.65rem;">
              <div>
                <label class="soft-label" style="font-size: 0.76rem;">Nombres *</label>
                <input type="text" id="new-tutor-inline-nombres" class="soft-input" placeholder="Ej: Carlos" />
              </div>
              <div>
                <label class="soft-label" style="font-size: 0.76rem;">Apellidos *</label>
                <input type="text" id="new-tutor-inline-apellidos" class="soft-input" placeholder="Ej: Fuentes Mendoza" />
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-bottom: 0.65rem;">
              <div>
                <label class="soft-label" style="font-size: 0.76rem;">WhatsApp * (8 dígitos)</label>
                <input type="tel" inputmode="tel" maxlength="16" id="new-tutor-inline-whatsapp" class="soft-input" placeholder="Ej: 71234567" />
              </div>
              <div>
                <label class="soft-label" style="font-size: 0.76rem;">C.I. (Opcional)</label>
                <input type="text" maxlength="20" id="new-tutor-inline-ci" class="soft-input" placeholder="Ej: 4892011 CB" />
              </div>
            </div>
            <div style="margin-bottom: 0.75rem;">
              <label class="soft-label" style="font-size: 0.76rem;">Correo Electrónico (Para sincronizar cuenta web)</label>
              <input type="email" id="new-tutor-inline-email" class="soft-input" placeholder="Ej: tutor@gmail.com" />
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
              <button type="button" id="btn-cancel-create-tutor-inline" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">Cancelar</button>
              <button type="button" id="btn-save-new-tutor-inline" class="soft-btn soft-btn-sm soft-btn-lvl-2">Crear y Seleccionar</button>
            </div>
          </div>

        </div>

        <!-- PIE DEL MODAL (NIVEL 2) -->
        <div style="padding: 1rem 1.65rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; gap: 0.75rem; background: var(--soft-lavender-surface);">
          <button type="button" id="btn-close-link-tutor-action" class="soft-btn soft-btn-lvl-2-soft">Cerrar</button>
          <button type="button" id="btn-submit-link-tutor" class="soft-btn soft-btn-lvl-2" disabled style="opacity: 0.5; cursor: not-allowed;">
            Guardar Vinculación al Expediente
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modalBackdrop);

    // Estado local del modal
    let selectedTutor = null;
    let searchDebounceTimer = null;

    const closeModal = () => modalBackdrop.remove();
    document.getElementById('btn-close-link-tutor-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-link-tutor-action')?.addEventListener('click', closeModal);

    document.getElementById('btn-unlink-current-modal')?.addEventListener('click', async () => {
      await this.handleUnlinkTutor(patientId, currentTutor.id, `${currentTutor.nombres} ${currentTutor.apellidos}`);
    });

    const resultsList = document.getElementById('tutors-search-results-list');
    const selectedContainer = document.getElementById('selected-tutor-container');
    const selectedNameEl = document.getElementById('selected-tutor-name');
    const selectedContactEl = document.getElementById('selected-tutor-contact');
    const selectedAccountStatusEl = document.getElementById('selected-tutor-account-status');
    const submitBtn = document.getElementById('btn-submit-link-tutor');

    const selectTutor = (tutor) => {
      selectedTutor = tutor;
      selectedNameEl.textContent = `${tutor.nombres} ${tutor.apellidos}`;
      selectedContactEl.textContent = `WhatsApp: ${tutor.whatsapp || 'N/D'} · C.I.: ${tutor.ci || 'N/D'}`;
      
      const accountEmail = tutor.usuario_email || (tutor.usuario_id ? tutor.email : null) || tutor.email;
      if (tutor.usuario_id || tutor.usuario_email) {
        selectedAccountStatusEl.innerHTML = `
          <span class="soft-badge soft-badge-emerald">
            <span class="soft-status-dot"></span>
            <span>Tiene cuenta activa en el portal web (${this.escapeHtml(accountEmail)})</span>
          </span>
        `;
      } else {
        selectedAccountStatusEl.innerHTML = `
          <span class="soft-badge soft-badge-slate">
            Registro en clínica (cuando se registre en la web con este correo/celular se vinculará automáticamente)
          </span>
        `;
      }

      if (tutor.parentesco) {
        const parentescoSelect = document.getElementById('select-tutor-parentesco');
        if (parentescoSelect && ['PADRE', 'MADRE', 'TUTOR_LEGAL', 'ABUELO_A', 'TIO_A', 'HERMANO_MAYOR', 'OTRO'].includes(tutor.parentesco)) {
          parentescoSelect.value = tutor.parentesco;
        }
      }

      selectedContainer.style.display = 'flex';
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    };

    document.getElementById('btn-cancel-selected-tutor')?.addEventListener('click', () => {
      selectedTutor = null;
      selectedContainer.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.5';
      submitBtn.style.cursor = 'not-allowed';
    });

    const searchAndRenderTutors = async (query = '') => {
      try {
        const res = await apiClient.get(`/api/patients/tutors${query ? `?search=${encodeURIComponent(query)}` : ''}`);
        const tutors = res.data || [];

        if (tutors.length === 0) {
          resultsList.innerHTML = `
            <div class="soft-subcard" style="text-align: center; padding: 1.5rem; background: var(--soft-lavender-surface); border: 1px dashed var(--soft-border-hover);">
              <div style="font-size: 0.86rem; color: var(--soft-text-body); margin-bottom: 0.35rem;">
                No se encontraron tutores coincidentes con "${this.escapeHtml(query)}"
              </div>
              <button type="button" id="btn-launch-inline-create" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="align-self: center;">
                + Registrar a este tutor ahora
              </button>
            </div>
          `;
          document.getElementById('btn-launch-inline-create')?.addEventListener('click', () => {
            const inlinePanel = document.getElementById('create-tutor-inline-panel');
            if (inlinePanel) {
              inlinePanel.style.display = 'flex';
              document.getElementById('new-tutor-inline-nombres')?.focus();
            }
          });
          return;
        }

        resultsList.innerHTML = tutors.map(t => {
          const isCurrent = currentTutor && currentTutor.id === t.id;
          const hasAccount = Boolean(t.usuario_email || (t.usuario_id && t.email) || t.usuario_id);

          return `
            <div class="tutor-search-item soft-subcard" data-id="${t.id}" style="background: #FFFFFF; padding: 0.75rem 0.95rem; flex-direction: row; justify-content: space-between; align-items: center; gap: 0.75rem;">
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                  <strong style="color: var(--soft-text-title); font-size: 0.9rem;">
                    ${this.escapeHtml(t.nombres)} ${this.escapeHtml(t.apellidos)}
                  </strong>
                  ${hasAccount ? `
                    <span class="soft-badge soft-badge-emerald">
                      <span class="soft-status-dot"></span> Cuenta web
                    </span>
                  ` : `
                    <span class="soft-badge soft-badge-slate">
                      Clínica
                    </span>
                  `}
                  ${isCurrent ? `
                    <span class="soft-badge soft-badge-mint">
                      Actual
                    </span>
                  ` : ''}
                </div>
                <div style="font-size: 0.76rem; color: var(--soft-text-muted); margin-top: 0.15rem;">
                  WhatsApp: ${this.escapeHtml(t.whatsapp || 'N/D')} ${t.email ? `· ${this.escapeHtml(t.email)}` : ''} ${t.ci ? `· C.I. ${this.escapeHtml(t.ci)}` : ''}
                </div>
              </div>
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-select-tutor" data-id="${t.id}" style="flex-shrink: 0;">
                Seleccionar
              </button>
            </div>
          `;
        }).join('');

        resultsList.querySelectorAll('.btn-select-tutor').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const id = Number(e.currentTarget.getAttribute('data-id'));
            const tutor = tutors.find(item => item.id === id);
            if (tutor) selectTutor(tutor);
          });
        });

      } catch (err) {
        resultsList.innerHTML = `
          <div style="text-align: center; padding: 1rem; color: #BE123C; font-size: 0.8rem;">
            Error al consultar directorio de tutores: ${this.escapeHtml(err.message)}
          </div>
        `;
      }
    };

    // Cargar inicial
    await searchAndRenderTutors();

    // Buscador en tiempo real con debounce
    const searchInput = document.getElementById('input-search-tutors-modal');
    searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        searchAndRenderTutors(e.target.value.trim());
      }, 250);
    });

    // Toggle crear tutor
    const toggleCreateBtn = document.getElementById('btn-toggle-create-tutor-inline');
    const inlineCreatePanel = document.getElementById('create-tutor-inline-panel');
    toggleCreateBtn?.addEventListener('click', () => {
      const isVisible = inlineCreatePanel.style.display !== 'none';
      inlineCreatePanel.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) document.getElementById('new-tutor-inline-nombres')?.focus();
    });

    document.getElementById('btn-cancel-create-tutor-inline')?.addEventListener('click', () => {
      inlineCreatePanel.style.display = 'none';
    });

    // Guardar nuevo tutor inline
    document.getElementById('btn-save-new-tutor-inline')?.addEventListener('click', async () => {
      const nombres = document.getElementById('new-tutor-inline-nombres')?.value.trim();
      const apellidos = document.getElementById('new-tutor-inline-apellidos')?.value.trim();
      const whatsapp = document.getElementById('new-tutor-inline-whatsapp')?.value.trim();
      const ci = document.getElementById('new-tutor-inline-ci')?.value.trim();
      const email = document.getElementById('new-tutor-inline-email')?.value.trim();

      if (!nombres || !apellidos || !whatsapp) {
        Toast.error('Debe completar nombres, apellidos y número de WhatsApp (8 dígitos).');
        return;
      }

      try {
        const res = await apiClient.post('/api/patients/tutors', {
          nombres,
          apellidos,
          whatsapp,
          ci: ci || null,
          email: email || null,
          parentesco: 'TUTOR_LEGAL'
        });

        if (res.success && res.data) {
          Toast.success('Tutor registrado exitosamente.');
          inlineCreatePanel.style.display = 'none';
          selectTutor(res.data);
          await searchAndRenderTutors();
        }
      } catch (err) {
        Toast.error('No se pudo registrar al tutor: ' + (err.message || 'Error desconocido'));
      }
    });

    // Confirmar vinculación
    submitBtn?.addEventListener('click', async () => {
      if (!selectedTutor) {
        Toast.error('Debe seleccionar un tutor para vincular.');
        return;
      }

      const parentesco = document.getElementById('select-tutor-parentesco')?.value || 'TUTOR_LEGAL';
      const esPrincipal = document.getElementById('check-is-principal')?.checked;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Vinculando...';

      try {
        await apiClient.post(`/api/patients/${patientId}/tutors`, {
          tutor_id: selectedTutor.id,
          parentesco,
          es_principal: esPrincipal ? 1 : 0
        });

        Toast.success(`Tutor ${selectedTutor.nombres} ${selectedTutor.apellidos} vinculado exitosamente.`);
        closeModal();
        await this.loadHistoryDetail(this.currentHistory.id);
      } catch (err) {
        Toast.error('Error al vincular tutor: ' + (err.message || 'Error desconocido'));
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Vinculación al Expediente';
      }
    });
  }

  calculateAge(birthDate) {
    if (!birthDate) return 'N/D';
    const birth = new Date(birthDate);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    if (months < 0 || (months === 0 && now.getDate() < birth.getDate())) {
      years--;
      months = (months + 12) % 12;
    }
    return `${years} años (${months} m)`;
  }

  getStatusBadge(estado) {
    switch (estado) {
      case 'ACTIVO':
        return `<span class="soft-badge soft-badge-emerald"><span class="soft-status-dot"></span>Activo</span>`;
      case 'EN_EVALUACION':
        return `<span class="soft-badge soft-badge-amber"><span class="soft-status-dot"></span>En Evaluación</span>`;
      case 'ALTA':
        return `<span class="soft-badge soft-badge-mint"><span class="soft-status-dot"></span>Alta Médica</span>`;
      case 'SUSPENDIDO':
        return `<span class="soft-badge soft-badge-rose"><span class="soft-status-dot"></span>Suspendido</span>`;
      default:
        return `<span class="soft-badge soft-badge-slate">${estado}</span>`;
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  renderEmptyState(message) {
    const content = document.getElementById('clinical-records-content');
    if (content) {
      content.innerHTML = `
        <div class="soft-card-static" style="padding: 3rem 1rem; text-align: center;">
          <p style="color: #BE123C; font-weight: 700; margin-bottom: 0.85rem;">${message}</p>
          <button type="button" class="soft-btn soft-btn-lvl-1" onclick="window.location.reload();">Reintentar</button>
        </div>
      `;
    }
  }
}


