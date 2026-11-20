import { store } from '../../store.js';
import { apiClient } from '../../api/apiClient.js';
import { Toast } from '../../components/Toast.js';
import { Icons } from '../../components/Icons.js';
import { SignatureCanvas } from '../../components/SignatureCanvas.js';
import mammoth from 'mammoth';

export class TutorDocumentsView {
  constructor(container) {
    this.container = container;
    this.children = [];
    this.selectedChildId = null;
    this.consents = [];
    this.reports = [];
    this.hasActiveConsent = false;
    this.signatureCanvasInstance = null;
    this.isLoading = false;
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

  async render() {
    const user = store.getState().user;
    if (!user || user.rol !== 'TUTOR') {
      window.location.hash = '#/login';
      return;
    }

    this.isLoading = true;
    this._renderLoadingSkeleton();

    try {
      // 1. Obtener los hijos tutelados
      const fpRes = await apiClient.get('/clinical-records/portal/family-plans').catch(() => ({ success: false, data: [] }));
      const familyPlans = fpRes?.data || [];
      this.children = familyPlans.map(item => item.paciente);

      if (!this.selectedChildId && this.children.length > 0) {
        this.selectedChildId = this.children[0].id;
      }

      // 2. Si hay un hijo seleccionado, cargar sus documentos
      if (this.selectedChildId) {
        const [checkRes, consentsRes, reportsRes] = await Promise.all([
          apiClient.get(`/consents/check/${this.selectedChildId}`).catch(() => ({ success: false, data: { hasActiveConsent: false } })),
          apiClient.get(`/consents/patient/${this.selectedChildId}`).catch(() => ({ success: false, data: [] })),
          apiClient.get(`/reports/patient/${this.selectedChildId}`).catch(() => ({ success: false, data: [] }))
        ]);

        this.hasActiveConsent = !!checkRes?.data?.hasActiveConsent;
        this.consents = consentsRes?.data || [];
        this.reports = reportsRes?.data || [];
      } else {
        this.hasActiveConsent = false;
        this.consents = [];
        this.reports = [];
      }
    } catch (err) {
      console.warn('Error al cargar documentos del tutor:', err);
      Toast.error('No se pudieron recuperar los documentos del familiar.');
    } finally {
      this.isLoading = false;
    }

    this._renderContent();
    this.attachEvents();
  }

  _renderLoadingSkeleton() {
    this.container.innerHTML = `
      <div class="page-container panel-general">
        <div style="text-align: center; padding: 3rem 1rem;">
          <div class="spinner" style="margin: 0 auto 1rem auto; width: 36px; height: 36px; border: 3px solid var(--soft-border-card-inner); border-top-color: var(--soft-purple-primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
          <p style="color: var(--soft-text-body); font-size: 0.95rem;">Cargando repositorio legal y expedientes familiares...</p>
        </div>
      </div>
    `;
  }

  _renderContent() {
    const activeChild = this.children.find(c => c.id === this.selectedChildId) || this.children[0] || null;
    let isAdult = false;
    if (activeChild?.fecha_nacimiento) {
      const birth = new Date(activeChild.fecha_nacimiento);
      const diffYears = (new Date().getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (diffYears >= 18) isAdult = true;
    }
    if (activeChild?.parentesco === 'TITULAR_PACIENTE') isAdult = true;

    // Ordenar cronológicamente descendente
    const sortedConsents = [...this.consents].sort((a, b) => (b.id || 0) - (a.id || 0));
    const latestConsent = sortedConsents[0] || null;

    const sortedReports = [...this.reports].sort((a, b) => (b.id || 0) - (a.id || 0));
    const latestReport = sortedReports[0] || null;

    this.container.innerHTML = `
      <div class="page-container panel-general" style="max-width: 1280px; margin: 0 auto; padding-bottom: 3rem;">
        
        <!-- ENCABEZADO INSTITUCIONAL ADAPTATIVO -->
        <div class="soft-header-row" style="margin-bottom: 1.5rem;">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-indigo" style="text-transform: uppercase; font-size: 0.71rem; letter-spacing: 0.05em;">
                ${isAdult ? 'Mi Portal de Paciente · Expediente Titular' : 'Portal Familiar · Repositorio Legal'}
              </span>
              <span class="soft-location-label">
                Centro PSI Aprende · ${this._escapeHtml((this._getInstAddress() || 'Cochabamba').split(',')[0])}
              </span>
            </div>
            <h1 class="soft-page-title" style="margin: 0.35rem 0 0.25rem 0;">
              ${isAdult ? 'Mis Documentos y Consentimientos Clínicos' : 'Documentos Legales e Informes Familiares'}
            </h1>
            <p class="soft-page-subtitle" style="margin: 0;">
              ${isAdult 
                ? 'Custodia inalterable de mi acta de consentimiento informado bajo la Ley 3131 y reportes de evolución clínica.' 
                : 'Custodia inalterable de consentimientos informados bajo la Ley 548 y acceso a reportes autorizados para la familia.'}
            </p>
          </div>

          <div class="soft-header-actions">
            <a href="#/dashboard" class="soft-btn soft-btn-lvl-1-muted">
              ${Icons.arrowRight(15, 'var(--soft-purple-primary)')}
              <span>Volver al Resumen</span>
            </a>
          </div>
        </div>

        ${this.children.length === 0 ? `
          <div class="soft-section-card" style="text-align: center; padding: 3.5rem 1.5rem; color: var(--soft-text-muted);">
            ${Icons.folderSearch(48, 'var(--soft-purple-primary)')}
            <h3 style="margin-top: 1rem; color: var(--soft-text-title); font-size: 1.2rem;">Sin pacientes asociados</h3>
            <p style="font-size: 0.88rem; max-width: 500px; margin: 0.5rem auto 0 auto;">
              No se registran pacientes o pupilos vinculados a este usuario familiar en el sistema.
            </p>
          </div>
        ` : `
          <!-- SELECTOR DE PACIENTES O HIJOS -->
          ${this.children.length > 1 ? `
            <div class="tabs-scroll-container" style="display: flex; gap: 0.6rem; flex-wrap: nowrap; overflow-x: auto; margin-bottom: 1.25rem; border-bottom: 1px solid var(--soft-divider); padding: 6px 4px 12px 4px !important;">
              ${this.children.map(c => {
                const isSelected = activeChild && c.id === activeChild.id;
                return `
                  <button 
                    type="button" 
                    class="soft-btn soft-btn-sm btn-switch-child ${isSelected ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" 
                    data-child-id="${c.id}"
                    style="flex-shrink: 0;"
                  >
                    ${Icons.patient(14, isSelected ? '#FFFFFF' : 'var(--soft-purple-primary)')}
                    <span>${this._escapeHtml(c.nombres)} ${this._escapeHtml(c.apellidos)}</span>
                  </button>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- BARRA DE MÉTRICAS KPI SUPERIOR -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <!-- KPI 1: ESTADO LEGAL -->
            <div class="soft-card-static" style="padding: 1.15rem 1.35rem; display: flex; align-items: center; gap: 0.95rem;">
              <div class="soft-icon-box soft-icon-box-sm ${this.hasActiveConsent ? 'soft-icon-box-mint' : 'soft-icon-box-lavender'}">
                ${this.hasActiveConsent ? Icons.check(18, 'var(--soft-mint-deep)') : Icons.alert(18, '#F59E0B')}
              </div>
              <div style="min-width: 0;">
                <div style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
                  Consentimiento Bioético
                </div>
                <div style="font-size: 0.98rem; font-weight: 800; color: ${this.hasActiveConsent ? 'var(--soft-emerald-dark, #065F46)' : '#92400E'}; margin: 0.15rem 0;">
                  ${this.hasActiveConsent ? 'Acreditado y Vigente' : 'Pendiente de Firma'}
                </div>
                <div style="font-size: 0.73rem; color: var(--soft-text-body);">
                  ${isAdult ? 'Ley 3131 de Autonomía' : 'Ley 548 de Tutoría Legal'}
                </div>
              </div>
            </div>

            <!-- KPI 2: ACTAS REGISTRADAS -->
            <div class="soft-card-static" style="padding: 1.15rem 1.35rem; display: flex; align-items: center; gap: 0.95rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.fileCheck(18, 'var(--soft-purple-primary)')}
              </div>
              <div style="min-width: 0;">
                <div style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
                  Repositorio de Actas
                </div>
                <div style="font-size: 1.05rem; font-weight: 800; color: var(--soft-text-title); margin: 0.15rem 0;">
                  ${sortedConsents.length === 1 ? '1 Acta Formalizada' : `${sortedConsents.length} Actas Formalizadas`}
                </div>
                <div style="font-size: 0.73rem; color: var(--soft-text-body);">
                  ${latestConsent ? `Última: ${latestConsent.fecha_firma ? latestConsent.fecha_firma.substring(0, 10) : 'Registrada'}` : 'Sin actas previas'}
                </div>
              </div>
            </div>

            <!-- KPI 3: REPORTES FAMILIARES -->
            <div class="soft-card-static" style="padding: 1.15rem 1.35rem; display: flex; align-items: center; gap: 0.95rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                ${Icons.fileWord(18, 'var(--soft-mint-deep)')}
              </div>
              <div style="min-width: 0;">
                <div style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
                  Reportes de Avance Clínico
                </div>
                <div style="font-size: 1.05rem; font-weight: 800; color: var(--soft-text-title); margin: 0.15rem 0;">
                  ${sortedReports.length === 1 ? '1 Informe Autorizado' : `${sortedReports.length} Informes Autorizados`}
                </div>
                <div style="font-size: 0.73rem; color: var(--soft-text-body);">
                  Devoluciones sin tecnicismos
                </div>
              </div>
            </div>

            <!-- KPI 4: EXPEDIENTE CLÍNICO -->
            <div class="soft-card-static" style="padding: 1.15rem 1.35rem; display: flex; align-items: center; gap: 0.95rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.lock(18, '#27345F')}
              </div>
              <div style="min-width: 0;">
                <div style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">
                  Expediente Clínico
                </div>
                <div style="font-size: 1.02rem; font-weight: 800; color: var(--soft-text-title); margin: 0.15rem 0; font-family: monospace;">
                  ${this._escapeHtml(activeChild?.codigo_expediente || 'EXP-CLIN')}
                </div>
                <div style="font-size: 0.73rem; color: var(--soft-text-body);">
                  Custodia bajo secreto bioético
                </div>
              </div>
            </div>
          </div>

          <!-- FICHA DESTACADA DEL PACIENTE CON ACCIONES RÁPIDAS -->
          ${activeChild ? `
            <div style="background: var(--soft-lavender-surface); border: 1.5px solid var(--soft-border-card-inner); border-radius: 18px; padding: 1.25rem 1.55rem; margin-bottom: 1.6rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.2rem;">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <div class="soft-icon-box soft-icon-box-lavender" style="width: 48px; height: 48px; border-radius: 14px; font-weight: 800; font-size: 1.15rem;">
                  ${((activeChild.nombres || '').charAt(0) + (activeChild.apellidos || '').charAt(0)).toUpperCase()}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                    <strong style="font-size: 1.12rem; color: var(--soft-text-title);">${this._escapeHtml(activeChild.nombres)} ${this._escapeHtml(activeChild.apellidos)}</strong>
                    <span class="soft-badge soft-badge-indigo" style="font-size: 0.7rem;">Expediente: ${this._escapeHtml(activeChild.codigo_expediente || 'N/A')}</span>
                    <span class="soft-badge ${this.hasActiveConsent ? 'soft-badge-emerald' : 'soft-badge-amber'}" style="font-size: 0.7rem; font-weight: 700;">
                      <span class="soft-status-dot"></span>
                      <span>${this.hasActiveConsent ? 'Consentimiento Acreditado' : 'Pendiente de Consentimiento'}</span>
                    </span>
                  </div>
                  <span style="font-size: 0.8rem; color: var(--soft-text-body); margin-top: 0.2rem; display: block;">
                    ${isAdult 
                      ? 'Régimen Autónomo de Atención Psicológica y Neurocognitiva bajo la Ley 3131' 
                      : 'Atención y resguardo bioético bajo la patria potestad y secreto profesional de la Ley 548'}
                  </span>
                </div>
              </div>

              <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                ${!this.hasActiveConsent ? `
                  <button type="button" id="btn-open-sign-modal" class="soft-btn soft-btn-sm soft-btn-lvl-1">
                    ${Icons.signature(14, '#FFFFFF')}
                    <span>Firmar Digitalmente Ahora</span>
                  </button>
                  <button type="button" id="btn-open-physical-modal" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted">
                    ${Icons.printer(14, 'var(--soft-purple-primary)')}
                    <span>Opción Papel Físico</span>
                  </button>
                ` : `
                  <button type="button" id="btn-open-sign-modal" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted">
                    ${Icons.signature(14, 'var(--soft-purple-primary)')}
                    <span>Actualizar o Renovar Firma</span>
                  </button>
                  <button type="button" id="btn-open-physical-modal" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted">
                    ${Icons.upload(14, 'var(--soft-purple-primary)')}
                    <span>Subir Documento Físico</span>
                  </button>
                `}
              </div>
            </div>
          ` : ''}

          <!-- GRID PRINCIPAL DE 2 COLUMNAS BALANCEADAS -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 1.6rem; margin-bottom: 1.6rem; align-items: stretch;">

            <!-- COLUMNA 1: ACTA DE CONSENTIMIENTO INFORMADO VIGENTE -->
            <div class="soft-card-static" style="display: flex; flex-direction: column; justify-content: space-between; position: relative;">
              <div>
                <!-- CABECERA DE LA TARJETA -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.8rem; margin-bottom: 1.15rem; padding-bottom: 1rem; border-bottom: 1px solid var(--soft-divider); flex-wrap: wrap;">
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                      ${Icons.fileCheck(20, 'var(--soft-purple-primary)')}
                    </div>
                    <div>
                      <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title);">
                        Acta de Consentimiento Vigente
                      </h3>
                      <div style="font-size: 0.75rem; color: var(--soft-text-muted);">
                        ${isAdult ? 'Autorización médica autónoma según Ley 3131' : 'Autorización jurídica familiar según Ley 548'}
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    ${sortedConsents.length > 1 ? `
                      <button type="button" id="btn-open-consent-history" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="font-size: 0.74rem;">
                        ${Icons.clock(13, 'var(--soft-purple-primary)')}
                        <span>Historial · ${sortedConsents.length}</span>
                      </button>
                    ` : ''}
                    <span class="soft-badge ${latestConsent && latestConsent.estado === 'VIGENTE' ? 'soft-badge-emerald' : 'soft-badge-amber'}" style="font-weight: 800; font-size: 0.72rem;">
                      <span class="soft-status-dot"></span>
                      <span>${latestConsent ? latestConsent.estado : 'PENDIENTE'}</span>
                    </span>
                  </div>
                </div>

                ${!latestConsent ? `
                  <div style="text-align: center; padding: 2.5rem 1.4rem; color: var(--soft-text-muted); font-size: 0.88rem; background: var(--soft-lavender-surface); border-radius: 16px; border: 1.5px dashed rgba(110, 86, 176, 0.25);">
                    <div style="margin-bottom: 0.75rem; color: var(--soft-purple-primary);">${Icons.signature(36, 'var(--soft-purple-primary)')}</div>
                    <strong style="display: block; font-size: 1rem; color: var(--soft-text-title); margin-bottom: 0.35rem;">No se registra consentimiento informado activo</strong>
                    <p style="margin: 0 0 1.25rem 0; font-size: 0.84rem; line-height: 1.45;">
                      El Código Niña, Niño y Adolescente bajo la Ley 548 exige formalizar la autorización del proceso terapéutico previo a la continuidad de sesiones.
                    </p>
                    <div style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
                      <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-trigger-sign-now">
                        ${Icons.signature(14, '#FFFFFF')}
                        <span>Firmar en Pantalla Ahora</span>
                      </button>
                      <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-trigger-physical-now">
                        ${Icons.printer(14, 'var(--soft-purple-primary)')}
                        <span>Descargar Plantilla Física</span>
                      </button>
                    </div>
                  </div>
                ` : `
                  <!-- CUERPO DE LA ACTA OFICIAL -->
                  <div style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 1.25rem 1.35rem; margin-bottom: 1.15rem; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
                      <div style="font-weight: 800; font-size: 0.95rem; color: var(--soft-text-title);">
                        ${this._escapeHtml(latestConsent.titulo || latestConsent.tipo_consentimiento)}
                      </div>
                      <span class="soft-badge soft-badge-lavender" style="font-size: 0.68rem; font-family: monospace;">
                        ID: ACT-${String(latestConsent.id).padStart(4, '0')}
                      </span>
                    </div>

                    <!-- RESUMEN DE CLÁUSULAS BIOÉTICAS -->
                    <div style="background: var(--soft-lavender-surface); border-radius: 10px; padding: 0.85rem 1rem; font-size: 0.8rem; color: var(--soft-text-body); line-height: 1.48; margin-bottom: 1rem; border: 1px solid var(--soft-border-card-inner);">
                      "Autorización libre e informada al equipo de PSI Aprende para evaluaciones integrales y tratamiento psicoterapéutico, bajo estricta confidencialidad bioética y médica."
                    </div>

                    <!-- GRID DE DATOS DE FILIACIÓN LEGAL -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.82rem; margin-bottom: 1.15rem; background: #FAF9FE; padding: 0.9rem 1rem; border-radius: 12px; border: 1px solid var(--soft-border-card-inner);">
                      <div>
                        <span style="color: var(--soft-text-muted); font-size: 0.72rem; display: block; font-weight: 600; text-transform: uppercase;">Firmante:</span>
                        <strong style="color: var(--soft-text-title);">${this._escapeHtml(latestConsent.firmado_por_nombre || 'Tutor')}</strong>
                      </div>
                      <div>
                        <span style="color: var(--soft-text-muted); font-size: 0.72rem; display: block; font-weight: 600; text-transform: uppercase;">Parentesco o Filiación:</span>
                        <strong style="color: var(--soft-text-title);">${this._escapeHtml(latestConsent.parentesco || 'TUTOR_LEGAL')}</strong>
                      </div>
                      <div>
                        <span style="color: var(--soft-text-muted); font-size: 0.72rem; display: block; font-weight: 600; text-transform: uppercase;">Cédula de Identidad:</span>
                        <strong style="color: var(--soft-text-title);">${this._escapeHtml(latestConsent.firmado_por_ci || 'No registrada')}</strong>
                      </div>
                      <div>
                        <span style="color: var(--soft-text-muted); font-size: 0.72rem; display: block; font-weight: 600; text-transform: uppercase;">Fecha y Sello Digital:</span>
                        <span style="color: var(--soft-text-title); font-size: 0.78rem;">${latestConsent.fecha_firma ? latestConsent.fecha_firma.replace('T', ' ').substring(0, 16) : 'Suscrito'}</span>
                      </div>
                    </div>

                    <!-- PREVIEW DE RÚBRICA DIGITALIZADA SI EXISTE -->
                    ${latestConsent.firma_digital ? `
                      <div style="border: 1px dashed var(--soft-border-card-inner); border-radius: 10px; padding: 0.65rem 0.9rem; text-align: center; background: #FFFFFF; margin-bottom: 0.75rem;">
                        <div style="font-size: 0.68rem; color: var(--soft-mint-deep); font-weight: 700; text-transform: uppercase; margin-bottom: 0.35rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                          <span class="soft-status-dot"></span>
                          <span>Rúbrica Digitalizada Sellada con IP: ${latestConsent.ip_registro || '127.0.0.1'}</span>
                        </div>
                        <img src="${latestConsent.firma_digital}" alt="Rúbrica Legal" style="max-height: 55px; max-width: 100%; object-fit: contain;" />
                      </div>
                    ` : ''}
                  </div>
                `}
              </div>

              <!-- BOTONERA DE ACCIÓN INFERIOR -->
              <div style="display: flex; gap: 0.65rem; margin-top: 1rem; flex-wrap: wrap; padding-top: 0.85rem; border-top: 1px solid var(--soft-divider);">
                ${latestConsent ? `
                  <button type="button" class="soft-btn soft-btn-lvl-1 btn-view-consent-detail" data-consent-id="${latestConsent.id}" style="flex: 1; min-width: min(100%, 180px);">
                    ${Icons.eye(15, '#FFFFFF')}
                    <span>Ver o Imprimir Acta Oficial</span>
                  </button>
                  <button type="button" class="soft-btn soft-btn-lvl-1-muted btn-trigger-sign-now" style="flex: 1; min-width: min(100%, 160px);">
                    ${Icons.signature(14, 'var(--soft-purple-primary)')}
                    <span>Renovar Firma</span>
                  </button>
                ` : `
                  <button type="button" class="soft-btn soft-btn-lvl-1 btn-trigger-sign-now" style="width: 100%;">
                    ${Icons.signature(15, '#FFFFFF')}
                    <span>Firmar Consentimiento Ahora</span>
                  </button>
                `}
              </div>
            </div>

            <!-- COLUMNA 2: REPORTES DE AVANCE Y ORIENTACIÓN FAMILIAR -->
            <div class="soft-card-static" style="display: flex; flex-direction: column; justify-content: space-between; position: relative;">
              <div>
                <!-- CABECERA DE LA TARJETA -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.8rem; margin-bottom: 1.15rem; padding-bottom: 1rem; border-bottom: 1px solid var(--soft-divider); flex-wrap: wrap;">
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                      ${Icons.fileWord(20, 'var(--soft-mint-deep)')}
                    </div>
                    <div>
                      <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title);">
                        Reporte de Avance Terapéutico
                      </h3>
                      <div style="font-size: 0.75rem; color: var(--soft-text-muted);">
                        Devoluciones claras y pautas orientadas al hogar
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    ${sortedReports.length > 1 ? `
                      <button type="button" id="btn-open-reports-history" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="font-size: 0.74rem;">
                        ${Icons.folder(13, 'var(--soft-purple-primary)')}
                        <span>Historial · ${sortedReports.length}</span>
                      </button>
                    ` : ''}
                    <span class="soft-badge soft-badge-mint" style="font-weight: 800; font-size: 0.72rem;">
                      <span class="soft-status-dot"></span>
                      <span>${latestReport ? (latestReport.estado === 'FIRMADO' ? 'Firmado' : 'Entregable') : 'Sin Reportes'}</span>
                    </span>
                  </div>
                </div>

                ${!latestReport ? `
                  <div style="text-align: center; padding: 2.5rem 1.4rem; color: var(--soft-text-muted); font-size: 0.88rem; background: var(--soft-lavender-surface); border-radius: 16px; border: 1.5px dashed rgba(21, 150, 141, 0.25);">
                    <div style="margin-bottom: 0.75rem; color: var(--soft-mint-deep);">${Icons.fileWord(36, 'var(--soft-mint-deep)')}</div>
                    <strong style="display: block; font-size: 1rem; color: var(--soft-text-title); margin-bottom: 0.35rem;">Aún no se registran reportes de avance liberados</strong>
                    <p style="margin: 0; font-size: 0.84rem; line-height: 1.45;">
                      Cuando los especialistas a cargo concluyan un ciclo evaluativo y autoricen la entrega formal al tutor, el documento aparecerá aquí para descarga inmediata.
                    </p>
                  </div>
                ` : `
                  <!-- CUERPO DEL INFORME FAMILIAR OFICIAL -->
                  <div style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 1.25rem 1.35rem; margin-bottom: 1.15rem; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
                      <div style="font-weight: 800; font-size: 0.95rem; color: var(--soft-text-title);">
                        ${this._escapeHtml(latestReport.titulo)}
                      </div>
                      <span class="soft-badge soft-badge-indigo" style="font-size: 0.68rem; font-family: monospace;">
                        ID: INF-${String(latestReport.id).padStart(4, '0')}
                      </span>
                    </div>

                    <!-- DATOS DEL ESPECIALISTA TRATANTE -->
                    <div style="display: flex; align-items: center; gap: 0.75rem; background: #FAF9FE; padding: 0.8rem 1rem; border-radius: 12px; margin-bottom: 1rem; border: 1px solid var(--soft-border-card-inner);">
                      <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender" style="width: 36px; height: 36px; border-radius: 10px;">
                        ${Icons.therapist(16, 'var(--soft-purple-primary)')}
                      </div>
                      <div>
                        <strong style="font-size: 0.86rem; color: var(--soft-text-title); display: block;">
                          Lic. ${this._escapeHtml(latestReport.terapeuta_nombres || latestReport.autor_nombre || 'Especialista')} ${this._escapeHtml(latestReport.terapeuta_apellidos || '')}
                        </strong>
                        <span style="font-size: 0.74rem; color: var(--soft-text-muted);">
                          ${this._escapeHtml(latestReport.terapeuta_especialidad || 'Neuropsicología y Psicología')} · Matrícula Profesional
                        </span>
                      </div>
                    </div>

                    <!-- EXTRACTOS DE CONCLUSIONES Y PAUTAS PARA CASA -->
                    <div style="display: flex; flex-direction: column; gap: 0.65rem; font-size: 0.81rem; line-height: 1.46;">
                      <div style="background: var(--soft-lavender-surface); border-radius: 10px; padding: 0.75rem 0.95rem;">
                        <strong style="color: var(--soft-text-title); display: block; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.2rem;">
                          Progreso y Avance Terapéutico:
                        </strong>
                        <span style="color: var(--soft-text-body);">
                          ${latestReport.conclusiones_cualitativas ? this._escapeHtml(latestReport.conclusiones_cualitativas.substring(0, 190) + (latestReport.conclusiones_cualitativas.length > 190 ? '...' : '')) : 'Evolución favorable con buen nivel de adherencia a las sesiones.'}
                        </span>
                      </div>

                      ${latestReport.recomendaciones_familia ? `
                        <div style="background: rgba(16, 185, 129, 0.07); border-radius: 10px; padding: 0.75rem 0.95rem; border: 1px solid rgba(16, 185, 129, 0.2);">
                          <strong style="color: #065F46; display: block; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.2rem;">
                            Orientación Clave para la Familia:
                          </strong>
                          <span style="color: var(--soft-text-body);">
                            ${this._escapeHtml(latestReport.recomendaciones_familia.substring(0, 180) + (latestReport.recomendaciones_familia.length > 180 ? '...' : ''))}
                          </span>
                        </div>
                      ` : ''}
                    </div>

                    ${latestReport.estado === 'FIRMADO' ? `
                      <div style="margin-top: 0.85rem; padding: 0.5rem 0.75rem; background: #DCFCE7; border-radius: 8px; font-size: 0.74rem; color: #15803D; font-weight: 700; display: flex; align-items: center; gap: 0.45rem;">
                        <span class="soft-status-dot"></span>
                        <span>Documento avalado con firma digital colegiada del especialista tratante.</span>
                      </div>
                    ` : ''}
                  </div>
                `}
              </div>

              <!-- BOTONERA DE ACCIÓN INFERIOR -->
              <div style="display: flex; gap: 0.65rem; margin-top: 1rem; flex-wrap: wrap; padding-top: 0.85rem; border-top: 1px solid var(--soft-divider);">
                ${latestReport ? `
                  <button type="button" class="soft-btn soft-btn-lvl-1 btn-download-report" data-report-id="${latestReport.id}" style="flex: 1; min-width: min(100%, 170px);">
                    ${Icons.download(14, '#FFFFFF')}
                    <span>Descargar Word</span>
                  </button>
                  <button type="button" class="soft-btn soft-btn-lvl-1-muted btn-preview-report" data-report-id="${latestReport.id}" style="flex: 1; min-width: min(100%, 150px);">
                    ${Icons.eye(14, 'var(--soft-purple-primary)')}
                    <span>Previsualizar</span>
                  </button>
                  ${(latestReport.estado === 'FIRMADO' || latestReport.ruta_archivo_firmado) ? `
                    <button type="button" class="soft-btn btn-download-signed-report" data-report-id="${latestReport.id}" style="background: #DCFCE7; color: #15803D; font-weight: 700; font-size: 0.82rem; border: none; box-shadow: 0 2px 8px rgba(21, 128, 61, 0.15);">
                      ${Icons.shield(14, '#15803D')}
                      <span>Copia Firmada</span>
                    </button>
                  ` : ''}
                ` : `
                  <div style="width: 100%; text-align: center; font-size: 0.8rem; color: var(--soft-text-muted);">
                    Se notificará vía WhatsApp cuando se libere un nuevo informe.
                  </div>
                `}
              </div>
            </div>

          </div>

          <!-- SECCIÓN 3: BARRA DE GARANTÍAS LEGALES Y ORIENTACIÓN AL TUTOR -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1.25rem; margin-top: 0.5rem;">
            
            <!-- TARJETA A: VALIDEZ LEGAL -->
            <div class="soft-card-static" style="padding: 1.2rem 1.35rem; background: #FFFFFF;">
              <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.shield(18, 'var(--soft-purple-primary)')}
                </div>
                <strong style="color: var(--soft-text-title); font-size: 0.9rem;">Validez Jurídica Inalterable</strong>
              </div>
              <p style="font-size: 0.8rem; color: var(--soft-text-body); margin: 0; line-height: 1.46;">
                Cada consentimiento suscrito se estampa con sello de tiempo e IP según la Ley 548, Código Niña, Niño y Adolescente, y la Ley 3131, resguardando la bioética profesional.
              </p>
            </div>

            <!-- TARJETA B: ALTERNATIVA FÍSICA EN SECRETARÍA -->
            <div class="soft-card-static" style="padding: 1.2rem 1.35rem; background: #FFFFFF;">
              <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                  ${Icons.printer(18, 'var(--soft-mint-deep)')}
                </div>
                <strong style="color: var(--soft-text-title); font-size: 0.9rem;">Opción Física en Recepción</strong>
              </div>
              <p style="font-size: 0.8rem; color: var(--soft-text-body); margin: 0; line-height: 1.46;">
                Si el tutor no desea o no puede firmar en pantalla táctil, puede solicitar la plantilla impresa en la secretaría del centro o descargarla para entregarla firmada a mano.
              </p>
            </div>

            <!-- TARJETA C: CONFIDENCIALIDAD SANITARIA -->
            <div class="soft-card-static" style="padding: 1.2rem 1.35rem; background: #FFFFFF;">
              <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.5rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.lock(18, '#27345F')}
                </div>
                <strong style="color: var(--soft-text-title); font-size: 0.9rem;">Custodia y Secreto Bioético</strong>
              </div>
              <p style="font-size: 0.8rem; color: var(--soft-text-body); margin: 0; line-height: 1.46;">
                El expediente y los avances terapéuticos son confidenciales. Los reportes familiares están especialmente redactados sin jerga técnica para facilitar el acompañamiento en el hogar.
              </p>
            </div>

          </div>
        `}

      </div>
      <div id="modal-container-tutor-docs"></div>
    `;
  }

  attachEvents() {
    // Selector de hijos
    this.container.querySelectorAll('.btn-switch-child').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const childId = Number(e.currentTarget.getAttribute('data-child-id'));
        if (childId && childId !== this.selectedChildId) {
          this.selectedChildId = childId;
          this.render();
        }
      });
    });

    // Abrir modal de firma digital táctil
    document.getElementById('btn-open-sign-modal')?.addEventListener('click', () => this.openSignModal('DIGITAL'));
    this.container.querySelectorAll('.btn-trigger-sign-now').forEach(btn => {
      btn.addEventListener('click', () => this.openSignModal('DIGITAL'));
    });

    // Abrir modal de opción física en papel
    document.getElementById('btn-open-physical-modal')?.addEventListener('click', () => this.openSignModal('PHYSICAL'));
    this.container.querySelectorAll('.btn-trigger-physical-now').forEach(btn => {
      btn.addEventListener('click', () => this.openSignModal('PHYSICAL'));
    });

    // Botones de Historial
    document.getElementById('btn-open-consent-history')?.addEventListener('click', () => {
      this.openConsentHistoryModal();
    });

    document.getElementById('btn-open-reports-history')?.addEventListener('click', () => {
      this.openReportsHistoryModal();
    });

    // Ver detalle de consentimiento
    this.container.querySelectorAll('.btn-view-consent-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-consent-id'));
        if (id) this.openConsentDetailModal(id);
      });
    });

    // Vista previa Mammoth
    this.container.querySelectorAll('.btn-preview-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-report-id'));
        if (id) this.previewReportWithMammoth(id);
      });
    });

    // Descargar Word
    this.container.querySelectorAll('.btn-download-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-report-id'));
        if (id) this.downloadReportDocx(id);
      });
    });

    // Descargar informe firmado escaneado
    this.container.querySelectorAll('.btn-download-signed-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-report-id'));
        if (id) this.downloadSignedReport(id);
      });
    });
  }

  downloadSignedReport(reportId) {
    const token = store.getState().token || localStorage.getItem('psi_token') || '';
    window.open(`/api/reports/${reportId}/signed?token=${token}`, '_blank');
  }

  openConsentHistoryModal() {
    const modalContainer = document.getElementById('modal-container-tutor-docs');
    if (!modalContainer) return;
    const sorted = [...this.consents].sort((a, b) => (b.id || 0) - (a.id || 0));

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="consent-history-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 760px; width: 100%; max-height: 85vh; display: flex; flex-direction: column;">
          
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.clock(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Historial de Consentimientos Informados
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Cronología inalterable de firmas registradas en el Centro PSI Aprende
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-consent-history" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <div style="padding: 1.25rem 1.65rem; overflow-y: auto; flex: 1;">
            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
              ${sorted.map((c, idx) => `
                <div class="soft-subcard" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 14px; flex-wrap: wrap; gap: 0.75rem;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                      <span class="soft-badge ${c.estado === 'VIGENTE' ? 'soft-badge-emerald' : 'soft-badge-amber'}" style="font-size: 0.68rem; font-weight: 800;">
                        <span class="soft-status-dot"></span>
                        <span>${c.estado} ${idx === 0 ? '· Más reciente' : ''}</span>
                      </span>
                      <span style="font-size: 0.74rem; color: var(--soft-text-muted);">
                        ${c.fecha_firma ? c.fecha_firma.replace('T', ' ').substring(0, 16) : ''}
                      </span>
                    </div>
                    <strong style="color: var(--soft-text-title); font-size: 0.92rem; display: block;">
                      ${this._escapeHtml(c.titulo || c.tipo_consentimiento)}
                    </strong>
                    <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                      Firmante: ${this._escapeHtml(c.firmado_por_nombre)} · Cédula ${this._escapeHtml(c.firmado_por_ci)} · ${this._escapeHtml(c.parentesco)}
                    </div>
                  </div>
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-view-consent-detail" data-consent-id="${c.id}" style="font-size: 0.75rem;">
                    ${Icons.eye(13, '#FFFFFF')}
                    <span>Ver Acta Oficial</span>
                  </button>
                </div>
              `).join('')}
            </div>
          </div>

          <div style="padding: 0.9rem 1.65rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; background: var(--soft-lavender-surface);">
            <button type="button" id="btn-close-consent-history-footer" class="soft-btn soft-btn-lvl-2-soft">
              Cerrar
            </button>
          </div>

        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-consent-history')?.addEventListener('click', close);
    document.getElementById('btn-close-consent-history-footer')?.addEventListener('click', close);

    modalContainer.querySelectorAll('.btn-view-consent-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-consent-id'));
        if (id) this.openConsentDetailModal(id);
      });
    });
  }

  openReportsHistoryModal() {
    const modalContainer = document.getElementById('modal-container-tutor-docs');
    if (!modalContainer) return;
    const sorted = [...this.reports].sort((a, b) => (b.id || 0) - (a.id || 0));

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="reports-history-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 820px; width: 100%; max-height: 85vh; display: flex; flex-direction: column;">
          
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.folder(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Historial de Reportes Clínicos y de Avance
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Documentos oficiales emitidos y autorizados por el equipo multidisciplinario
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-reports-history" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <div style="padding: 1.25rem 1.65rem; overflow-y: auto; flex: 1;">
            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
              ${sorted.map((r, idx) => `
                <div class="soft-subcard" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 14px; flex-wrap: wrap; gap: 0.75rem;">
                  <div style="flex: 1; min-width: min(100%, 240px);">
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                      <span class="soft-badge soft-badge-lavender" style="font-size: 0.68rem; font-weight: 700;">
                        <span class="soft-status-dot"></span>
                        <span>${r.tipo_informe} ${idx === 0 ? '· Más reciente' : ''}</span>
                      </span>
                      <span style="font-size: 0.74rem; color: var(--soft-text-muted);">
                        Emitido: ${r.fecha_emision ? r.fecha_emision.substring(0, 10) : ''}
                      </span>
                    </div>
                    <strong style="color: var(--soft-text-title); font-size: 0.92rem; display: block;">
                      ${this._escapeHtml(r.titulo)}
                    </strong>
                    <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                      Especialista: Lic. ${this._escapeHtml(r.terapeuta_nombres || r.autor_nombre || 'Especialista')} ${this._escapeHtml(r.terapeuta_apellidos || '')}
                    </div>
                  </div>
                  <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                    <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-preview-report" data-report-id="${r.id}" style="font-size: 0.75rem;">
                      ${Icons.eye(13, 'var(--soft-purple-primary)')}
                      <span>Ver o Imprimir</span>
                    </button>
                    <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-download-report" data-report-id="${r.id}" style="font-size: 0.75rem;">
                      ${Icons.download(13, '#FFFFFF')}
                      <span>Descargar Word</span>
                    </button>
                    ${(r.estado === 'FIRMADO' || r.ruta_archivo_firmado) ? `
                      <button type="button" class="soft-btn soft-btn-sm btn-download-signed-report" data-report-id="${r.id}" style="background: #DCFCE7; color: #15803D; font-weight: 700; font-size: 0.75rem; border: none;">
                        ${Icons.shield(13, '#15803D')}
                        <span>Firmado</span>
                      </button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div style="padding: 0.9rem 1.65rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; background: var(--soft-lavender-surface);">
            <button type="button" id="btn-close-reports-history-footer" class="soft-btn soft-btn-lvl-2-soft">
              Cerrar
            </button>
          </div>

        </div>
      </div>
    `;

    const close = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-reports-history')?.addEventListener('click', close);
    document.getElementById('btn-close-reports-history-footer')?.addEventListener('click', close);

    modalContainer.querySelectorAll('.btn-preview-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-report-id'));
        if (id) this.previewReportWithMammoth(id);
      });
    });

    modalContainer.querySelectorAll('.btn-download-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-report-id'));
        if (id) this.downloadReportDocx(id);
      });
    });

    modalContainer.querySelectorAll('.btn-download-signed-report').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-report-id'));
        if (id) this.downloadSignedReport(id);
      });
    });
  }

  /**
   * Modal dual: Firma Digital en Pantalla o Subida de Documento Físico Escaneado
   */
  openSignModal(initialTab = 'DIGITAL') {
    const modalContainer = document.getElementById('modal-container-tutor-docs');
    const activeChild = this.children.find(c => c.id === this.selectedChildId) || this.children[0] || null;
    if (!modalContainer || !activeChild) return;

    const user = store.getState().user || {};
    let isAdult = false;
    if (activeChild.fecha_nacimiento) {
      const birth = new Date(activeChild.fecha_nacimiento);
      const diffYears = (new Date().getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (diffYears >= 18) isAdult = true;
    }
    if (activeChild.parentesco === 'TITULAR_PACIENTE') isAdult = true;

    const defaultFirmanteNombre = isAdult 
      ? `${activeChild.nombres} ${activeChild.apellidos}` 
      : (user.nombre_completo || '');
    const defaultFirmanteCi = isAdult 
      ? (activeChild.ci || '') 
      : (user.tutor?.ci || activeChild.tutor_ci || '');
    const isCiVerified = Boolean(defaultFirmanteCi && defaultFirmanteCi.trim().length >= 4);

    const defaultClausesText = isAdult ? `1. DECLARACIÓN Y AUTORIZACIÓN: LEY 3131 Y BIOÉTICA
El suscrito o la suscrita, en pleno ejercicio de sus facultades legales y civiles conforme a la Ley 3131 del Ejercicio Profesional Médico y el Código de Bioética en Salud del Estado Plurinacional de Bolivia, autoriza de forma libre, informada y voluntaria a los especialistas colegiados del Centro Psicopedagógico y de Atención Psicológica PSI Aprende a realizar el proceso de evaluación neuropsicológica, psicodiagnóstica y abordaje psicoterapéutico sobre su persona: ${activeChild.nombres} ${activeChild.apellidos}.

2. CONFIDENCIALIDAD Y SECRETO PROFESIONAL:
Toda la información personal, anamnesis, resultados de baterías cognitivas y notas de evolución clínica se mantendrá bajo estricto secreto profesional y custodia digital inalterable, resguardando la intimidad del paciente según las normas del Colegio de Psicólogos de Bolivia.

3. ENTREGA DE RESULTADOS E INFORME CLÍNICO:
Los resultados y diagnósticos derivados del proceso evaluativo serán formalizados en informe clínico oficial emitido por el especialista tratante para fines terapéuticos, médicos o de derivación especializada.

4. VALIDEZ JURÍDICA:
La presente firma manuscrita estampada digitalmente o suscrita en acta física escaneada tiene plena validez jurídica y probatoria, acreditando el pleno conocimiento y conformidad con los alcances del servicio.`
: `1. DECLARACIÓN Y AUTORIZACIÓN: LEY 548
El suscrito o la suscrita, en pleno ejercicio de la patria potestad o tutoría legal según la Ley 548, Código Niña, Niño y Adolescente del Estado Plurinacional de Bolivia, autoriza libre, informada y expresamente a los profesionales acreditados del Centro Psicopedagógico y de Atención Psicológica PSI Aprende a realizar el proceso de evaluación neuropsicológica, psicopedagógica y psicoterapéutica respecto al menor ${activeChild.nombres} ${activeChild.apellidos}.

2. CONFIDENCIALIDAD Y SECRETO PROFESIONAL:
Toda la información recabada durante las entrevistas, aplicaciones de pruebas psicométricas y notas de evolución clínica se mantendrá bajo estricto secreto profesional conforme a la Ley y el Código de Ética Profesional del Colegio de Psicólogos de Bolivia, resguardándose digitalmente en el expediente clínico inalterable del centro.

3. USO DE RESULTADOS Y DIAGNÓSTICO:
Los resultados y diagnósticos derivados del proceso evaluativo serán entregados formalmente a los tutores legales mediante informe escrito para fines de orientación psicopedagógica, médica o adaptaciones curriculares escolares.

4. VALIDEZ JURÍDICA:
La presente firma manuscrita estampada digitalmente en pantalla táctil o suscrita en formulario físico escaneado tiene plena validez jurídica, probatoria y consentida, acreditando el conocimiento de los alcances terapéuticos del Centro.`;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="sign-modal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 680px; width: 100%; max-height: 92vh; display: flex; flex-direction: column;">
          
          <!-- CABECERA MODAL (NIVEL 2) -->
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.signature(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0; letter-spacing: -0.015em;">
                  Acta de Consentimiento Informado Legal
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Paciente: <strong>${this._escapeHtml(activeChild.nombres)} ${this._escapeHtml(activeChild.apellidos)}</strong> · Expediente ${this._escapeHtml(activeChild.codigo_expediente || 'N/A')}
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-sign-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- PESTAÑAS DE MODALIDAD -->
          <div style="padding: 0.75rem 1.65rem 0 1.65rem; background: var(--soft-lavender-surface); border-bottom: 1px solid var(--soft-divider); display: flex; gap: 0.6rem;">
            <button type="button" id="tab-btn-digital" class="soft-btn soft-btn-sm ${initialTab === 'DIGITAL' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" style="border-radius: 10px 10px 0 0;">
              ${Icons.signature(13, initialTab === 'DIGITAL' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
              <span>Firma con el Dedo o Ratón</span>
            </button>
            <button type="button" id="tab-btn-physical" class="soft-btn soft-btn-sm ${initialTab === 'PHYSICAL' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" style="border-radius: 10px 10px 0 0;">
              ${Icons.printer(13, initialTab === 'PHYSICAL' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
              <span>Formulario Físico en Papel</span>
            </button>
          </div>

          <!-- CUERPO MODAL -->
          <div style="padding: 1.35rem 1.65rem; overflow-y: auto; flex: 1;">
            <form id="form-submit-tutor-consent">
              
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
                      <option value="TITULAR_PACIENTE" selected>Propio Paciente · Adulto Titular</option>
                    ` : `
                      <option value="MADRE" ${activeChild.parentesco === 'MADRE' ? 'selected' : ''}>Madre</option>
                      <option value="PADRE" ${activeChild.parentesco === 'PADRE' ? 'selected' : ''}>Padre</option>
                      <option value="TUTOR_LEGAL" ${(!activeChild.parentesco || activeChild.parentesco === 'TUTOR') ? 'selected' : ''}>Tutor Legal</option>
                      <option value="ABUELO_A">Abuelo o Abuela</option>
                      <option value="APODERADO">Apoderado o Representante</option>
                    `}
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label class="soft-label">Nombre Completo del Firmante <span class="required">*</span></label>
                  <input type="text" name="firmado_por_nombre" required class="soft-input" value="${this._escapeHtml(defaultFirmanteNombre)}" placeholder="Ej. Roberto Morales" />
                </div>
                <div>
                  <label class="soft-label">
                    Cédula de Identidad <span class="required">*</span>
                    ${isCiVerified ? `<span class="soft-badge soft-badge-mint" style="font-size: 0.65rem; margin-left: 0.35rem;"><span class="soft-status-dot"></span><span>Verificado en Perfil</span></span>` : ''}
                  </label>
                  <input 
                    type="text" 
                    name="firmado_por_ci" 
                    required 
                    class="soft-input" 
                    value="${this._escapeHtml(defaultFirmanteCi)}" 
                    placeholder="Ej. 6543210 CB"
                    ${isCiVerified ? 'readonly style="background: #F8FAFC; color: var(--soft-text-title); font-weight: 700; cursor: not-allowed;"' : ''}
                  />
                </div>
              </div>

              <div style="margin-bottom: 1.15rem;">
                <label class="soft-label">Cláusulas Legales: Ley 548 y Ley 3131</label>
                <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.85rem; max-height: 120px; overflow-y: auto; font-size: 0.76rem; color: var(--soft-text-body); line-height: 1.5; white-space: pre-line;">
                  ${defaultClausesText}
                </div>
              </div>

              <!-- PANEL MODALIDAD A: FIRMA DIGITAL TÁCTIL (CANVAS) -->
              <div id="panel-mode-digital" style="display: ${initialTab === 'DIGITAL' ? 'block' : 'none'}; margin-bottom: 1.15rem;">
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
                  <canvas id="tutor-signature-canvas" style="width: 100%; height: 160px; display: block; border-radius: 12px; background: #FFFFFF; touch-action: none; cursor: crosshair;"></canvas>
                </div>
                <div style="font-size: 0.72rem; color: var(--soft-text-muted); margin-top: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
                  ${Icons.info(12, 'var(--soft-purple-primary)')}
                  <span>Firme con claridad dentro del recuadro. La firma quedará sellada con marca de tiempo e IP.</span>
                </div>
              </div>

              <!-- PANEL MODALIDAD B: DOCUMENTO FÍSICO EN PAPEL -->
              <div id="panel-mode-physical" style="display: ${initialTab === 'PHYSICAL' ? 'block' : 'none'}; margin-bottom: 1.15rem;">
                <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 1rem 1.15rem; margin-bottom: 1rem;">
                  <strong style="color: var(--soft-text-title); font-size: 0.85rem; display: block; margin-bottom: 0.25rem;">
                    Alternativa Presencial: Impresión y Firma Manual en Papel
                  </strong>
                  <p style="font-size: 0.79rem; color: var(--soft-text-body); margin: 0 0 0.85rem 0; line-height: 1.45;">
                    Si prefiere firmar a mano con bolígrafo físico en consultorio o secretaría, descargue o imprima este formulario oficial prellenado con los datos de su paciente a cargo.
                  </p>
                  <button type="button" id="btn-print-physical-template" class="soft-btn soft-btn-sm soft-btn-lvl-1" style="font-size: 0.76rem;">
                    ${Icons.printer(14, '#FFFFFF')}
                    <span>Imprimir Formulario Oficial en Blanco o Prellenado</span>
                  </button>
                </div>

                <div>
                  <label class="soft-label">
                    Subir Foto o Escaneo del Formulario Firmado <span class="required">*</span>
                  </label>
                  <input type="file" id="input-physical-scan-file" accept="image/png,image/jpeg,image/webp,application/pdf" class="soft-input" style="padding: 0.5rem; background: #FFFFFF; border: 1.5px dashed var(--soft-purple-primary); cursor: pointer;" />
                  <div style="font-size: 0.72rem; color: var(--soft-text-muted); margin-top: 0.35rem;">
                    Formatos admitidos: JPG, PNG o PDF. Se custodiará como constancia digital inalterable.
                  </div>
                </div>
              </div>

              <!-- PIE DE MODAL (NIVEL 2) -->
              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem; margin-top: 1rem;">
                <button type="button" id="btn-cancel-sign-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" id="btn-submit-sign-form" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(16, '#FFFFFF')}
                  <span>Registrar y Formalizar Consentimiento</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    let activeModalMode = initialTab;

    // Inicializar canvas
    const canvasEl = document.getElementById('tutor-signature-canvas');
    if (canvasEl) {
      this.signatureCanvasInstance = new SignatureCanvas(canvasEl);
    }

    // Alternar pestañas
    const tabBtnDigital = document.getElementById('tab-btn-digital');
    const tabBtnPhysical = document.getElementById('tab-btn-physical');
    const panelDigital = document.getElementById('panel-mode-digital');
    const panelPhysical = document.getElementById('panel-mode-physical');

    tabBtnDigital?.addEventListener('click', () => {
      activeModalMode = 'DIGITAL';
      tabBtnDigital.className = 'soft-btn soft-btn-sm soft-btn-lvl-1';
      tabBtnPhysical.className = 'soft-btn soft-btn-sm soft-btn-lvl-1-muted';
      if (panelDigital) panelDigital.style.display = 'block';
      if (panelPhysical) panelPhysical.style.display = 'none';
      setTimeout(() => {
        if (this.signatureCanvasInstance) this.signatureCanvasInstance.setupCanvasDimensions();
      }, 50);
    });

    tabBtnPhysical?.addEventListener('click', () => {
      activeModalMode = 'PHYSICAL';
      tabBtnPhysical.className = 'soft-btn soft-btn-sm soft-btn-lvl-1';
      tabBtnDigital.className = 'soft-btn soft-btn-sm soft-btn-lvl-1-muted';
      if (panelDigital) panelDigital.style.display = 'none';
      if (panelPhysical) panelPhysical.style.display = 'block';
    });

    // Imprimir plantilla oficial para firma física
    document.getElementById('btn-print-physical-template')?.addEventListener('click', () => {
      this.printPhysicalTemplate(activeChild, user, isAdult);
    });

    const closeModal = () => {
      if (this.signatureCanvasInstance) {
        this.signatureCanvasInstance.destroy();
        this.signatureCanvasInstance = null;
      }
      modalContainer.innerHTML = '';
    };

    document.getElementById('btn-close-sign-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-sign-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-clear-canvas')?.addEventListener('click', () => {
      if (this.signatureCanvasInstance) this.signatureCanvasInstance.clear();
    });

    // Envío del formulario
    const form = document.getElementById('form-submit-tutor-consent');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);

        let finalFirmaBlob = '';

        if (activeModalMode === 'DIGITAL') {
          if (!this.signatureCanvasInstance || this.signatureCanvasInstance.isEmpty()) {
            Toast.error('Debe estampar su firma manuscrita en el recuadro blanco antes de confirmar.');
            return;
          }
          finalFirmaBlob = this.signatureCanvasInstance.toDataURL();
        } else {
          const fileInput = document.getElementById('input-physical-scan-file');
          if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            Toast.error('Debe adjuntar la foto o archivo escaneado del documento firmado a mano.');
            return;
          }
          const file = fileInput.files[0];
          finalFirmaBlob = await this._fileToDataUrl(file);
        }

        const payload = {
          paciente_id: activeChild.id,
          tipo_consentimiento: formData.get('tipo_consentimiento'),
          parentesco: formData.get('parentesco'),
          firmado_por_nombre: formData.get('firmado_por_nombre'),
          firmado_por_ci: formData.get('firmado_por_ci'),
          titulo: `Consentimiento Informado - ${formData.get('tipo_consentimiento')}`,
          contenido_clausulas: defaultClausesText,
          firma_digital_blob: finalFirmaBlob
        };

        const submitBtn = document.getElementById('btn-submit-sign-form');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Custodiando y Sellando...</span>';
        }

        try {
          await apiClient.post('/consents', payload);
          Toast.success('Consentimiento informado registrado y sellado legalmente con éxito.');
          closeModal();
          await this.render();
        } catch (err) {
          Toast.error('Error al registrar consentimiento: ' + err.message);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `${Icons.check(16, '#FFFFFF')} <span>Registrar y Formalizar Consentimiento</span>`;
          }
        }
      });
    }
  }

  /**
   * Genera e imprime en papel físico la plantilla oficial prellenada para firma con bolígrafo
   */
  printPhysicalTemplate(child, user, isAdult) {
    const html = `
      <div style="text-align: center; border-bottom: 2px solid #27345F; padding-bottom: 8px; margin-bottom: 12px;">
        <div style="font-size: 13pt; font-weight: 800; color: #27345F; letter-spacing: -0.01em;">
          CENTRO PSICOPEDAGÓGICO Y DE ATENCIÓN PSICOLÓGICA PSI APRENDE
        </div>
        <div style="font-size: 8pt; color: #584294; margin-top: 2px;">
          ${this._escapeHtml(this._getInstAddress())}
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 12px;">
        <h2 style="font-size: 11pt; text-transform: uppercase; color: #27345F; letter-spacing: 0.03em; margin: 0 0 2px 0;">
          Acta Oficial de Consentimiento Informado para Atención Clínica
        </h2>
        <span style="font-size: 7.5pt; color: #64748B;">Cumplimiento Ley 548, Código Niña, Niño y Adolescente, y Ley 3131</span>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 8.5pt;">
        <tr>
          <td style="width: 32%; font-weight: bold; background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 8px;">PACIENTE EVALUADO:</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${this._escapeHtml(child.nombres)} ${this._escapeHtml(child.apellidos)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 8px;">CÓDIGO DE EXPEDIENTE:</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${this._escapeHtml(child.codigo_expediente || 'N/A')} · Cédula: ${this._escapeHtml(child.ci || 'No registrado')}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 8px;">TUTOR O RESPONSABLE LEGAL:</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${this._escapeHtml(user.nombre_completo || '____________________________________')}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 8px;">FECHA DE SUSCRIPCIÓN:</td>
          <td style="border: 1px solid #cbd5e1; padding: 4px 8px;">${new Date().toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })}</td>
        </tr>
      </table>

      <div style="font-size: 8pt; line-height: 1.4; color: #334155; margin-bottom: 16px; text-align: justify;">
        <p style="margin-bottom: 6px;"><strong>1. DECLARACIÓN Y AUTORIZACIÓN:</strong> El suscrito o la suscrita, en pleno ejercicio de la patria potestad o tutoría legal según la Ley 548 del Estado Plurinacional de Bolivia, autoriza de forma libre, informada y expresa a los profesionales acreditados del Centro PSI Aprende a realizar el proceso de evaluación neuropsicológica, psicopedagógica y psicoterapéutica respecto al paciente mencionado.</p>
        <p style="margin-bottom: 6px;"><strong>2. SECRETO PROFESIONAL:</strong> Toda la información recabada se mantendrá bajo estricto secreto profesional conforme a la Ley y el Código de Ética Profesional del Colegio de Psicólogos de Bolivia, resguardándose en el expediente clínico inalterable.</p>
        <p style="margin-bottom: 6px;"><strong>3. ENTREGA DE RESULTADOS:</strong> Los resultados serán formalizados en informe oficial para fines de orientación familiar, médica o adaptaciones curriculares escolares.</p>
      </div>

      <div style="margin-top: 32px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-around; text-align: center; page-break-inside: avoid; break-inside: avoid;">
        <div style="width: 45%;">
          <!-- Espacio vertical despejado para firma manuscrita -->
          <div style="height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6px;"></div>
          <div style="border-top: 1.5px solid #27345F; padding-top: 4px; font-weight: bold; font-size: 8.5pt; color: #27345F;">
            Firma del ${isAdult ? 'Paciente Titular' : 'Tutor o Responsable Legal'}
          </div>
          <div style="font-size: 7.5pt; color: #64748B; margin-top: 3px; line-height: 1.35;">
            Aclaración de Firma: ___________________________________<br/>
            Cédula de Identidad: ____________________ Celular: ____________________
          </div>
        </div>

        <div style="width: 45%;">
          <!-- Espacio vertical despejado para sello físico y firma profesional -->
          <div style="height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6px;">
            <!-- Espacio limpio para estampar sello físico real del centro -->
          </div>
          <div style="border-top: 1.5px solid #27345F; padding-top: 4px; font-weight: bold; font-size: 8.5pt; color: #27345F;">
            ${child?.terapeuta_nombres ? `Lic. ${this._escapeHtml(child.terapeuta_nombres)} ${this._escapeHtml(child.terapeuta_apellidos)}` : 'Especialista a Cargo'}
          </div>
          <div style="font-size: 7.5pt; color: #64748B; margin-top: 3px; line-height: 1.35;">
            ${this._escapeHtml(child?.especialidad_nombre || 'Especialista en Psicología')}<br/>
            Centro PSI Aprende · Sede Cochabamba
          </div>
        </div>
      </div>
    `;

    this.printDocumentViaIframe('Plantilla Física de Consentimiento Informado', html);
  }

  /**
   * Muestra el detalle del acta legal firmada y permite imprimirla sin hojas en blanco
   */
  async openConsentDetailModal(consentId) {
    const modalContainer = document.getElementById('modal-container-tutor-docs');
    if (!modalContainer) return;

    try {
      const res = await apiClient.get('/consents/' + consentId);
      const c = res.data;

      const isImageBlob = c.firma_digital_blob && c.firma_digital_blob.startsWith('data:image/');
      const isPdfBlob = c.firma_digital_blob && c.firma_digital_blob.startsWith('data:application/pdf');

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
                    Certificado Oficial de Consentimiento Informado
                  </h3>
                  <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                    Expediente: <strong>${c.paciente_codigo || ''}</strong> · ${c.paciente_nombres || ''} ${c.paciente_apellidos || ''}
                  </div>
                </div>
              </div>
              <button type="button" id="btn-close-detail-modal" class="soft-modal-close-btn" title="Cerrar">
                ${Icons.close(18)}
              </button>
            </div>

            <!-- CUERPO IMPRIMIBLE -->
            <div id="printable-tutor-consent-area" style="padding: 2rem 2.2rem; overflow-y: auto; flex: 1; background: #FFFFFF; font-size: 0.86rem; color: var(--soft-text-title); line-height: 1.6;">
              <!-- MEMBRETE OFICIAL -->
              <div style="text-align: center; border-bottom: 2px solid #27345F; padding-bottom: 0.75rem; margin-bottom: 1rem;">
                <div style="font-size: 1.15rem; font-weight: 800; color: #27345F; letter-spacing: -0.02em;">
                  CENTRO PSICOPEDAGÓGICO Y DE ATENCIÓN PSICOLÓGICA PSI APRENDE
                </div>
                <div style="font-size: 0.75rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                  ${this._escapeHtml(this._getInstAddress())}
                </div>
              </div>

              <div style="text-align: center; margin-bottom: 1rem;">
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.82rem; font-weight: 800; text-transform: uppercase;">
                  ${this._escapeHtml(c.titulo)}
                </span>
              </div>

              <!-- DATOS LEGALES -->
              <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.78rem;">
                <div><strong>Menor o Paciente:</strong> ${c.paciente_nombres || ''} ${c.paciente_apellidos || ''}</div>
                <div><strong>Cédula Menor:</strong> ${c.paciente_ci || 'No registrado'}</div>
                <div><strong>Tutor Firmante:</strong> ${this._escapeHtml(c.firmado_por_nombre)}</div>
                <div><strong>Cédula Firmante:</strong> ${this._escapeHtml(c.firmado_por_ci)}</div>
                <div><strong>Parentesco:</strong> ${this._escapeHtml(c.parentesco)}</div>
                <div><strong>Fecha y Hora:</strong> ${c.fecha_firma ? c.fecha_firma.replace('T', ' ').substring(0, 19) : ''}</div>
                <div><strong>IP de Registro:</strong> ${c.ip_registro || '127.0.0.1'}</div>
                <div><strong>Estado de Validez:</strong> <span style="color: var(--soft-emerald-dark); font-weight: 700;">${c.estado}</span></div>
              </div>

              <!-- TEXTO DE CLÁUSULAS -->
              <div style="margin-bottom: 1.25rem; font-size: 0.8rem; color: var(--soft-text-body); white-space: pre-line; line-height: 1.42;">
                ${this._escapeHtml(c.contenido_clausulas)}
              </div>

              <!-- REPRODUCCIÓN DE FIRMA DIGITAL DEL TUTOR Y ACREDITACIÓN PROFESIONAL -->
              <div style="border-top: 1px dashed var(--soft-divider); padding-top: 1.25rem; display: flex; justify-content: space-around; align-items: flex-end; margin-top: 2.25rem; flex-wrap: wrap; gap: 1.5rem; page-break-inside: avoid;">
                <!-- ÚNICA FIRMA LEGAL: TUTOR / FIRMANTE -->
                <div style="text-align: center; max-width: 290px; width: 100%;">
                  <div style="min-height: 52px; display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem;">
                    ${isImageBlob ? `
                      <img src="${c.firma_digital_blob}" alt="Firma manuscrita" style="max-height: 48px; max-width: 150px; object-fit: contain;" />
                    ` : (isPdfBlob ? `
                      <div style="font-size: 0.74rem; color: var(--soft-purple-primary); font-weight: 700;">Documento PDF Escaneado Adjunto</div>
                    ` : `
                      <span style="color: var(--soft-text-muted); font-size: 0.74rem;">Firma legal registrada</span>
                    `)}
                  </div>
                  <div style="border-top: 1.5px solid var(--soft-text-title); padding-top: 0.4rem; font-weight: 800; font-size: 0.84rem; color: var(--soft-text-title);">
                    ${this._escapeHtml(c.firmado_por_nombre)}
                  </div>
                  <div style="font-size: 0.74rem; color: var(--soft-text-muted); margin-top: 0.15rem;">
                    Cédula ${this._escapeHtml(c.firmado_por_ci)} · ${this._escapeHtml(c.parentesco)}
                  </div>
                  <div style="font-size: 0.7rem; color: var(--soft-emerald-dark); font-weight: 700; margin-top: 0.2rem;">
                    Firma de Consentimiento Legal Acreditada
                  </div>
                </div>

                <!-- ACREDITACIÓN INSTITUCIONAL DEL ESPECIALISTA ASIGNADO (SIN LÍNEA DE FIRMA VACÍA) -->
                <div style="text-align: center; max-width: 290px; width: 100%; background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 1rem 1.2rem; box-sizing: border-box;">
                  <div style="font-size: 0.68rem; color: var(--soft-purple-primary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem;">
                    Atención Profesional Asignada
                  </div>
                  <div style="font-weight: 800; font-size: 0.88rem; color: var(--soft-text-title);">
                    ${c.terapeuta_nombres ? `Lic. ${this._escapeHtml(c.terapeuta_nombres)} ${this._escapeHtml(c.terapeuta_apellidos)}` : 'Especialista Clínico Responsable'}
                  </div>
                  <div style="font-size: 0.74rem; color: var(--soft-text-body); margin-top: 0.2rem;">
                    ${this._escapeHtml(c.especialidad_nombre || 'Especialidad en Neuropsicología y Psicología')}
                  </div>
                  <div style="font-size: 0.7rem; color: var(--soft-text-muted); margin-top: 0.35rem;">
                    Centro PSI Aprende · Cochabamba
                  </div>
                </div>
              </div>
            </div>

            <!-- PIE MODAL -->
            <div style="padding: 1rem 1.65rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
              <button type="button" id="btn-print-consent-doc-isolated" class="soft-btn soft-btn-lvl-2">
                ${Icons.printer(16, '#FFFFFF')}
                <span>Imprimir Certificado</span>
              </button>
              <button type="button" id="btn-close-detail-modal-footer" class="soft-btn soft-btn-lvl-2-soft">
                Cerrar
              </button>
            </div>

          </div>
        </div>
      `;

      const closeModal = () => { modalContainer.innerHTML = ''; };
      document.getElementById('btn-close-detail-modal')?.addEventListener('click', closeModal);
      document.getElementById('btn-close-detail-modal-footer')?.addEventListener('click', closeModal);
      
      // Impresión aislada por IFRAME (evita hojas en blanco al 100%)
      document.getElementById('btn-print-consent-doc-isolated')?.addEventListener('click', () => {
        const area = document.getElementById('printable-tutor-consent-area');
        if (area) {
          this.printDocumentViaIframe(`Consentimiento Informado - ${c.paciente_nombres} ${c.paciente_apellidos}`, area.innerHTML);
        }
      });
    } catch (err) {
      Toast.error('Error al cargar detalle del consentimiento: ' + err.message);
    }
  }

  /**
   * Vista previa interactiva de documentos Word con Mammoth.js
   */
  async previewReportWithMammoth(reportId) {
    const modalContainer = document.getElementById('modal-container-tutor-docs');
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
                  Visor de Documento Word
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Renderizado en vivo del informe clínico oficial compilado
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-mammoth-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <div style="padding: 1.5rem; overflow-y: auto; flex: 1; background: #F8F9FD;">
            <div id="tutor-mammoth-content-container" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 2.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.06); font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.65; color: #222;">
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
    
    // Impresión aislada por IFRAME (evita hojas en blanco al 100%)
    document.getElementById('btn-print-from-preview')?.addEventListener('click', () => {
      const container = document.getElementById('tutor-mammoth-content-container');
      if (container) {
        this.printDocumentViaIframe('Informe Clínico Oficial - PSI Aprende', container.innerHTML);
      }
    });

    try {
      const token = store.getState().token || localStorage.getItem('psi_token') || '';
      const response = await fetch('/api/reports/' + reportId + '/docx', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (!response.ok) throw new Error('No se pudo recuperar el archivo de Word');
      const arrayBuffer = await response.arrayBuffer();

      const result = await mammoth.convertToHtml({ arrayBuffer });
      const container = document.getElementById('tutor-mammoth-content-container');
      if (container) {
        container.innerHTML = `
          <div class="mammoth-rendered-document" style="font-size: 0.9rem;">
            ${result.value}
          </div>
        `;
      }
    } catch (err) {
      const container = document.getElementById('tutor-mammoth-content-container');
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
      const res = await fetch('/api/reports/' + reportId + '/docx', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Error al descargar el archivo Word');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PSI_Aprende_Informe_' + reportId + '.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      Toast.success('Descarga de informe Word iniciada.');
    } catch (err) {
      Toast.error('Error al descargar documento: ' + err.message);
    }
  }

  /**
   * Helper universal de impresión aislada mediante iframe
   * Resuelve al 100% el error de hojas en blanco al imprimir modales
   */
  printDocumentViaIframe(title, bodyHtml) {
    let iframe = document.getElementById('print-doc-isolated-iframe');
    if (iframe) {
      iframe.remove();
    }
    iframe = document.createElement('iframe');
    iframe.id = 'print-doc-isolated-iframe';
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

  _escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
