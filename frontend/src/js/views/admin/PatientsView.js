import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { store } from '../../store.js';
import { printIsolatedDocument } from '../../utils/printHelper.js';

export class PatientsView {
  constructor(container) {
    this.container = container;
    this.user = store.getState().user;
    this.userRole = store.getUserRole();
    this.patients = [];
    this.filteredPatients = [];
    this.tutors = [];
    this.therapists = [];
    this.searchTerm = '';
    this.currentFilter = 'ALL';
    this.activeTab = 'ACTIVOS'; // 'ACTIVOS' | 'ARCHIVADOS' (Admin) o 'ASIGNADOS' | 'DERIVADOS' (Terapeuta)
    this.selectedTherapistFilter = ''; // Filtro por terapeuta para Admin
    this.debounceTimer = null;
    this.ciDebounceTimer = null;
    this.isCiValid = false;
    this.selectedPatient = null;
    this.isEditing = false;
    this.patientToArchive = null;
    this.patientToDerive = null;
  }

  get isAdmin() {
    return (this.userRole || store.getUserRole()) === 'ADMIN';
  }

  get isTerapeuta() {
    return (this.userRole || store.getUserRole()) === 'TERAPEUTA';
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async render() {
    this.user = store.getState().user;
    this.userRole = store.getUserRole();

    const isAdmin = this.isAdmin;
    const isTerapeuta = this.isTerapeuta;

    // Inicializar pestaña adecuada según rol
    if (!isAdmin && this.activeTab === 'ACTIVOS') {
      this.activeTab = 'ASIGNADOS';
    } else if (isAdmin && (this.activeTab === 'ASIGNADOS' || this.activeTab === 'DERIVADOS')) {
      this.activeTab = 'ACTIVOS';
    }

    this.container.innerHTML = `
      <div class="page-container panel-general">
        <!-- Encabezado de la Vista -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.patient(13, 'var(--soft-purple-primary)')}
                <span>Admisión y Red Familiar</span>
              </span>
              <span class="soft-location-label">Confidencialidad Clínica · Ley 3131</span>
            </div>
            <h1 class="soft-page-title">Expedientes de Pacientes y Familias</h1>
            <p class="soft-page-subtitle">
              Filiación clínica institucional <strong style="color: var(--soft-text-title);">PSI-APRENDE</strong>, confidencialidad médica y derivaciones interdisciplinarias.
            </p>
          </div>

          <div class="soft-header-actions">
            <button id="btn-new-patient" type="button" class="soft-btn soft-btn-lvl-1">
              ${Icons.plus(17, '#FFFFFF')}
              <span>Nuevo Expediente</span>
            </button>
          </div>
        </div>

        <!-- FRANJA DE MÉTRICAS RÁPIDAS (4 KPIs SOFT UI) -->
        <div id="patient-stats" class="soft-kpi-grid">
          <div class="soft-kpi-card">
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.patient(22, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">${isTerapeuta ? 'Mis Pacientes' : 'Total Activos'}</span>
              <div id="stat-total" class="soft-kpi-value">--</div>
              <div class="soft-kpi-sub">Expedientes en seguimiento</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.brain(22, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Pediátricos (&lt;12)</span>
              <div id="stat-pediatric" class="soft-kpi-value">--</div>
              <div class="soft-kpi-sub">Atención infantil temprana</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <div class="soft-icon-box soft-icon-box-indigo">
              ${Icons.clinic(22, 'var(--soft-indigo-accent)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Adultos Mayores</span>
              <div id="stat-seniors" class="soft-kpi-value">--</div>
              <div class="soft-kpi-sub">Psicogerontología integral</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <span class="soft-status-dot-green" title="Red interdisciplinaria activa"></span>
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.share(22, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Derivaciones</span>
              <div id="stat-derivados" class="soft-kpi-value">--</div>
              <div class="soft-kpi-sub">Pases interdisciplinarios</div>
            </div>
          </div>
        </div>

        <!-- PESTAÑAS DE SEGMENTACIÓN SEGÚN ROL Y FILTRO DE ESPECIALISTA -->
        <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 1rem; flex-wrap: wrap; align-items: center; justify-content: space-between;">
          <div class="tabs-scroll-container">
            ${isAdmin ? `
              <button type="button" class="soft-btn nav-tab ${this.activeTab === 'ACTIVOS' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" data-tab="ACTIVOS">
                <span class="nav-tab-icon" style="display: inline-flex;">${Icons.patient(16, this.activeTab === 'ACTIVOS' ? '#FFFFFF' : 'var(--soft-purple-primary)')}</span>
                <span>Expedientes Activos</span>
                <span id="tab-count-activos" class="nav-tab-badge" style="background: ${this.activeTab === 'ACTIVOS' ? 'rgba(255,255,255,0.22)' : 'rgba(88, 66, 148, 0.12)'}; color: ${this.activeTab === 'ACTIVOS' ? '#FFFFFF' : 'var(--soft-purple-primary)'}; padding: 0.12rem 0.52rem; border-radius: 9999px; font-size: 0.74rem; font-weight: 800;">0</span>
              </button>

              <button type="button" class="soft-btn nav-tab ${this.activeTab === 'ARCHIVADOS' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" data-tab="ARCHIVADOS">
                <span class="nav-tab-icon" style="display: inline-flex;">${Icons.archive(16, this.activeTab === 'ARCHIVADOS' ? '#FFFFFF' : 'var(--soft-purple-primary)')}</span>
                <span>Papelera de Expedientes</span>
                <span id="tab-count-archivados" class="nav-tab-badge" style="background: ${this.activeTab === 'ARCHIVADOS' ? 'rgba(255,255,255,0.22)' : 'rgba(88, 66, 148, 0.12)'}; color: ${this.activeTab === 'ARCHIVADOS' ? '#FFFFFF' : 'var(--soft-purple-primary)'}; padding: 0.12rem 0.52rem; border-radius: 9999px; font-size: 0.74rem; font-weight: 800;">0</span>
              </button>
            ` : `
              <button type="button" class="soft-btn nav-tab ${this.activeTab === 'ASIGNADOS' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" data-tab="ASIGNADOS">
                <span class="nav-tab-icon" style="display: inline-flex;">${Icons.patient(16, this.activeTab === 'ASIGNADOS' ? '#FFFFFF' : 'var(--soft-purple-primary)')}</span>
                <span>Mis Pacientes Asignados</span>
                <span id="tab-count-asignados" class="nav-tab-badge" style="background: ${this.activeTab === 'ASIGNADOS' ? 'rgba(255,255,255,0.22)' : 'rgba(88, 66, 148, 0.12)'}; color: ${this.activeTab === 'ASIGNADOS' ? '#FFFFFF' : 'var(--soft-purple-primary)'}; padding: 0.12rem 0.52rem; border-radius: 9999px; font-size: 0.74rem; font-weight: 800;">0</span>
              </button>

              <button type="button" class="soft-btn nav-tab ${this.activeTab === 'DERIVADOS' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" data-tab="DERIVADOS">
                <span class="nav-tab-icon" style="display: inline-flex;">${Icons.share(16, this.activeTab === 'DERIVADOS' ? '#FFFFFF' : 'var(--soft-purple-primary)')}</span>
                <span>Recibidos por Derivación</span>
                <span id="tab-count-derivados" class="nav-tab-badge" style="background: ${this.activeTab === 'DERIVADOS' ? 'rgba(255,255,255,0.22)' : 'rgba(88, 66, 148, 0.12)'}; color: ${this.activeTab === 'DERIVADOS' ? '#FFFFFF' : 'var(--soft-purple-primary)'}; padding: 0.12rem 0.52rem; border-radius: 9999px; font-size: 0.74rem; font-weight: 800;">0</span>
              </button>
            `}
          </div>

          ${isAdmin ? `
            <!-- Filtro de Terapeuta para Dirección General (RF-A07) -->
            <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; max-width: 100%; min-width: 0; flex: 1 1 260px;">
              <span style="font-size: 0.82rem; font-weight: 700; color: var(--soft-text-title); white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;">
                ${Icons.filter(15, 'var(--soft-purple-primary)')} Filtrar por Especialista:
              </span>
              <select id="select-filter-terapeuta" class="soft-select" style="flex: 1 1 200px; width: 100%; max-width: 100%; min-width: 0;">
                <option value="">-- Todos los Especialistas --</option>
              </select>
            </div>
          ` : ''}
        </div>

        <!-- Barra de Búsqueda Predictiva y Filtros Etarios -->
        <div class="soft-card-static" style="padding: 1.2rem 1.45rem; margin-bottom: 1.75rem;">
          <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; justify-content: space-between;">
            <!-- Buscador Predictivo -->
            <div class="soft-search-box" style="flex: 1; min-width: min(100%, 280px);">
              <span class="soft-search-box-icon">
                ${Icons.search(17)}
              </span>
              <input 
                type="text" 
                id="patient-search-input" 
                class="soft-input" 
                placeholder="Buscar por código institucional PSI-APRENDE, nombres, apellidos o C.I..."
              />
            </div>

            <!-- Filtros Rápidos por Grupo Etario -->
            <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;">
              <button type="button" class="filter-chip active" data-filter="ALL">Todos</button>
              <button type="button" class="filter-chip" data-filter="INFANTIL">Infantil (&lt;12a)</button>
              <button type="button" class="filter-chip" data-filter="ADOLESCENTE">Adolescentes</button>
              <button type="button" class="filter-chip" data-filter="ADULTO">Adultos</button>
              <button type="button" class="filter-chip" data-filter="ADULTO_MAYOR">Adultos Mayores (60+)</button>
            </div>
          </div>
        </div>

        <!-- Contenedor de Pacientes (Cards Clínicas) -->
        <div id="patients-list" class="soft-rooms-grid" style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 1.35rem;">
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--soft-text-muted);">
            Cargando expedientes clínicos...
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- MODAL 1: APERTURA / EDICIÓN DE EXPEDIENTE (NIVEL 2) -->
      <!-- ========================================================================= -->
      <div id="patient-modal-backdrop" class="modal-backdrop" style="display: none;">
        <div class="soft-modal-card" style="max-width: 690px; max-height: 90vh;">
          <div style="background: var(--soft-lavender-surface); padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div id="modal-icon" class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.patient(20, 'var(--soft-purple-primary)')}
              </div>
              <h3 id="modal-title" style="margin: 0; color: var(--soft-text-title); font-size: 1.16rem; font-weight: 800; letter-spacing: -0.015em;">Apertura de Expediente Clínico</h3>
            </div>
            <button id="btn-close-modal" type="button" class="soft-modal-close-btn" aria-label="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <form id="patient-form" novalidate style="padding: 1.45rem 1.5rem; overflow-y: auto;">
            <input type="hidden" id="patient-id" value="" />

            <!-- Fila Código y C.I. Obligatorio con Selector de Departamento -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="soft-label" for="form-codigo">Código Correlativo</label>
                <input type="text" id="form-codigo" class="soft-input" style="font-weight: 800; color: var(--soft-purple-primary);" readonly />
                <div class="field-feedback" id="feedback-codigo" style="font-size: 0.75rem; color: var(--soft-text-muted); margin-top: 0.25rem;">Asignado correlativamente</div>
              </div>

              <div class="form-group">
                <label class="soft-label" for="form-ci-num">
                  Cédula de Identidad (C.I.) <span class="required">*</span>
                </label>
                <div style="display: flex; gap: 0.45rem;">
                  <input type="text" maxlength="20" id="form-ci-num" class="soft-input" placeholder="Ej. 9876543" style="flex: 1;" required />
                  <select id="form-ci-dep" class="soft-select" style="width: 96px; font-weight: 700;">
                    <option value="CB" selected>CB</option>
                    <option value="LP">LP</option>
                    <option value="SC">SC</option>
                    <option value="OR">OR</option>
                    <option value="PT">PT</option>
                    <option value="TJ">TJ</option>
                    <option value="CH">CH</option>
                    <option value="BE">BE</option>
                    <option value="PD">PD</option>
                    <option value="">S/E</option>
                  </select>
                </div>
                <div class="field-feedback" id="feedback-ci" style="font-size: 0.76rem; color: var(--soft-text-muted); margin-top: 0.25rem;">
                  Requerido para el historial médico oficial
                </div>
              </div>
            </div>

            <!-- Fila Terapeuta Asignado de Cabecera (Cero Huérfanos) -->
            <div class="form-group" style="margin-bottom: 1rem; background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); padding: 0.85rem 1.05rem; border-radius: 16px;">
              <label class="soft-label" for="form-terapeuta-id" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.4rem;">
                <span>Terapeuta Asignado de Cabecera <span class="required">*</span></span>
                <span style="font-size: 0.74rem; color: var(--soft-mint-deep); font-weight: 700;">Especialista Clínico Responsable</span>
              </label>
              ${isAdmin ? `
                <select id="form-terapeuta-id" class="soft-select" required style="font-weight: 600;">
                  <option value="">-- Seleccionar Terapeuta --</option>
                </select>
                <div class="field-feedback" id="feedback-terapeuta" style="font-size: 0.75rem; color: var(--soft-text-muted); margin-top: 0.25rem;">Define el acceso confidencial al expediente</div>
              ` : `
                <input type="text" class="soft-input" value="Lic. ${this.user?.nombre_completo || 'Terapeuta'} (Usted - Titular Asignado)" readonly style="font-weight: 700; cursor: not-allowed;" />
                <input type="hidden" id="form-terapeuta-id" value="${this.user?.terapeuta?.id || ''}" />
                <div class="field-feedback" id="feedback-terapeuta" style="font-size: 0.75rem; color: var(--soft-mint-deep); font-weight: 700; margin-top: 0.25rem;">El expediente se registra bajo su propia titularidad profesional</div>
              `}
            </div>

            <!-- Fila Nombres y Apellidos -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="soft-label" for="form-nombres">Nombres del Paciente <span class="required">*</span></label>
                <input type="text" id="form-nombres" class="soft-input" placeholder="Ej. Mateo Andrés" required />
                <div class="field-feedback" id="feedback-nombres" style="font-size: 0.75rem; color: var(--soft-text-muted); margin-top: 0.25rem;">Campo obligatorio</div>
              </div>

              <div class="form-group">
                <label class="soft-label" for="form-apellidos">Apellidos <span class="required">*</span></label>
                <input type="text" id="form-apellidos" class="soft-input" placeholder="Ej. Fuentes Rocha" required />
                <div class="field-feedback" id="feedback-apellidos" style="font-size: 0.75rem; color: var(--soft-text-muted); margin-top: 0.25rem;">Campo obligatorio</div>
              </div>
            </div>

            <!-- Fila Fecha Nacimiento, Edad y Sexo -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="soft-label" for="form-fecha-nac">Fecha de Nacimiento <span class="required">*</span></label>
                <input type="date" id="form-fecha-nac" class="soft-input" required />
                <div class="field-feedback" id="feedback-fecha-nac" style="font-size: 0.75rem; color: var(--soft-text-muted); margin-top: 0.25rem;">Cálculo dinámico en vivo</div>
                <div id="live-age-badge" class="soft-badge soft-badge-mint" style="margin-top: 0.45rem; display: none;">
                  Edad computada: <span id="live-age-text">--</span>
                </div>
              </div>

              <div class="form-group">
                <label class="soft-label" for="form-sexo">Sexo Biológico <span class="required">*</span></label>
                <select id="form-sexo" class="soft-select" required>
                  <option value="M">Masculino (M)</option>
                  <option value="F">Femenino (F)</option>
                  <option value="OTRO">Otro</option>
                </select>
                <div class="field-feedback" id="feedback-sexo" style="font-size: 0.75rem; color: var(--soft-text-muted); margin-top: 0.25rem;">Requerido para baremos psicométricos</div>
              </div>
            </div>

            <!-- Colegio u Ocupación -->
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="soft-label" for="form-colegio">Unidad Educativa / Grado Escolar u Ocupación</label>
              <input type="text" id="form-colegio" class="soft-input" placeholder="Ej. Colegio Alemán Santa María (3ro Primaria)" />
            </div>

            <!-- Sección Tutor Legal Responsable -->
            <div style="padding: 1.15rem; background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 18px; margin-bottom: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; flex-wrap: wrap; gap: 0.5rem;">
                <div style="font-weight: 800; font-size: 0.92rem; color: var(--soft-text-title); display: flex; align-items: center; gap: 0.45rem;">
                  <span style="color: var(--soft-mint-deep); display: inline-flex;">${Icons.family(18)}</span>
                  <span>Tutor Legal / Responsable Primario</span>
                </div>
                <button type="button" id="btn-toggle-new-tutor" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">
                  + Crear Nuevo Tutor
                </button>
              </div>

              <!-- Input oculto para almacenar el ID del tutor seleccionado -->
              <input type="hidden" id="form-tutor-id" value="" />

              <!-- Estado: Sin Tutor Seleccionado -->
              <div id="tutor-unselected-box" style="background: #FFFFFF; border: 1px dashed var(--soft-border-card-inner); border-radius: 16px; padding: 1.1rem; text-align: center;">
                <div style="color: var(--soft-text-body); font-size: 0.85rem; margin-bottom: 0.85rem;">
                  Ningún tutor seleccionado actualmente (puedes buscarlo en el directorio o vincularlo después).
                </div>
                <div style="display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap;">
                  <button type="button" id="btn-open-search-tutor-modal" class="soft-btn soft-btn-sm soft-btn-lvl-2">
                    ${Icons.search(14, '#FFFFFF')}
                    <span>Buscar Tutor en Directorio</span>
                  </button>
                  <button type="button" id="btn-quick-new-tutor" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">
                    + Registrar Nuevo
                  </button>
                </div>
              </div>

              <!-- Estado: Tutor Seleccionado -->
              <div id="tutor-selected-card" style="display: none; background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.05rem; box-shadow: var(--soft-shadow-subcard);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.8rem;">
                  <div>
                    <span class="soft-badge soft-badge-mint" style="margin-bottom: 0.3rem;">
                      Tutor Seleccionado
                    </span>
                    <div id="form-selected-tutor-name" style="font-size: 1.02rem; font-weight: 800; color: var(--soft-text-title);"></div>
                    <div id="form-selected-tutor-contact" style="font-size: 0.82rem; color: var(--soft-text-body); margin-top: 0.15rem;"></div>
                    <div id="form-selected-tutor-badge" style="margin-top: 0.4rem;"></div>
                  </div>
                  <div style="display: flex; gap: 0.45rem; flex-shrink: 0;">
                    <button type="button" id="btn-change-selected-tutor" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">
                      Cambiar
                    </button>
                    <button type="button" id="btn-remove-selected-tutor" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">
                      Quitar
                    </button>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr)); gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 0.8rem;">
                  <div>
                    <label class="soft-label" for="form-tutor-parentesco" style="font-size: 0.78rem;">Parentesco con el Paciente *</label>
                    <select id="form-tutor-parentesco" class="soft-select">
                      <option value="MADRE">Madre</option>
                      <option value="PADRE">Padre</option>
                      <option value="TUTOR_LEGAL" selected>Tutor Legal</option>
                      <option value="ABUELO_A">Abuelo / Abuela</option>
                      <option value="TIO_A">Tío / Tía</option>
                      <option value="HERMANO_MAYOR">Hermano / Hermana Mayor</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                  <div style="display: flex; align-items: center; padding-top: 1.15rem;">
                    <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.83rem; font-weight: 700; color: var(--soft-text-title); cursor: pointer;">
                      <input type="checkbox" id="form-tutor-is-principal" checked />
                      <span>Tutor Principal Responsable</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Formulario Desplegable para Crear Nuevo Tutor al Vuelo -->
              <div id="new-tutor-fields" style="display: none; border-top: 1px solid var(--soft-divider); margin-top: 0.85rem; padding-top: 0.85rem;">
                <div style="font-size: 0.82rem; font-weight: 800; color: var(--soft-purple-primary); margin-bottom: 0.55rem; display: flex; align-items: center; gap: 0.35rem;">
                  ${Icons.plus(14, 'var(--soft-purple-primary)')}
                  <span>Filiación del Nuevo Tutor:</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr)); gap: 0.75rem; margin-bottom: 0.75rem;">
                  <input type="text" id="new-tutor-nombres" class="soft-input" placeholder="Nombres del tutor *" />
                  <input type="text" id="new-tutor-apellidos" class="soft-input" placeholder="Apellidos del tutor *" />
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr)); gap: 0.75rem; margin-bottom: 0.75rem;">
                  <input type="tel" inputmode="tel" maxlength="16" id="new-tutor-whatsapp" class="soft-input" placeholder="WhatsApp * (8 dígitos boliviano)" />
                  <input type="text" maxlength="20" id="new-tutor-ci" class="soft-input" placeholder="C.I. (Opcional, ej. 4892011 CB)" />
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr)); gap: 0.75rem; margin-bottom: 0.8rem;">
                  <input type="email" id="new-tutor-email" class="soft-input" placeholder="Correo electrónico (para portal web)" />
                  <select id="new-tutor-parentesco" class="soft-select">
                    <option value="MADRE">Madre</option>
                    <option value="PADRE">Padre</option>
                    <option value="TUTOR_LEGAL" selected>Tutor Legal</option>
                    <option value="ABUELO_A">Abuelo / Abuela</option>
                    <option value="TIO_A">Tío / Tía</option>
                    <option value="HERMANO_MAYOR">Hermano / Hermana Mayor</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 0.55rem;">
                  <button type="button" id="btn-cancel-new-tutor-box" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">Cancelar</button>
                  <button type="button" id="btn-confirm-new-tutor-box" class="soft-btn soft-btn-sm soft-btn-lvl-2">Guardar y Seleccionar Tutor</button>
                </div>
              </div>
            </div>

            <!-- Antecedentes Perinatales y Médicos -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1rem; margin-bottom: 1.35rem;">
              <div class="form-group">
                <label class="soft-label" for="form-antecedentes-medicos">Antecedentes Médicos / Alergias</label>
                <textarea id="form-antecedentes-medicos" class="soft-textarea" rows="2" placeholder="Enfermedades crónicas, alergias a fármacos..."></textarea>
              </div>

              <div class="form-group">
                <label class="soft-label" for="form-antecedentes-perinatales">Desarrollo / Neurodesarrollo</label>
                <textarea id="form-antecedentes-perinatales" class="soft-textarea" rows="2" placeholder="Parto a término, hitos motores, lenguaje..."></textarea>
              </div>
            </div>

            <!-- Botones de Acción del Modal -->
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1.1rem;">
              <button type="button" id="btn-cancel-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
              <button type="submit" id="btn-save-patient" class="soft-btn soft-btn-lvl-2">
                ${Icons.check(16, '#FFFFFF')}
                <span>Guardar Expediente</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- MODAL 2: DERIVACIÓN INTERDISCIPLINARIA ENTRE ESPECIALISTAS (NIVEL 2) -->
      <!-- ========================================================================= -->
      <div id="derivar-modal-backdrop" class="modal-backdrop" style="display: none;">
        <div class="soft-modal-card" style="max-width: 590px; max-height: 90vh;">
          <div style="background: var(--soft-lavender-surface); padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                ${Icons.share(20, 'var(--soft-mint-deep)')}
              </div>
              <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.015em;">Derivación Interdisciplinaria de Caso</h3>
            </div>
            <button id="btn-close-derivar" type="button" class="soft-modal-close-btn" aria-label="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <form id="derivar-form" style="padding: 1.45rem 1.5rem; overflow-y: auto;">
            <input type="hidden" id="derivar-patient-id" value="" />

            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 0.9rem 1.05rem; margin-bottom: 1.15rem;">
              <div style="font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-text-overline); margin-bottom: 0.2rem;">Paciente a Derivar</div>
              <div id="derivar-patient-summary" style="font-weight: 800; color: var(--soft-text-title); font-size: 1.04rem;">--</div>
              <div id="derivar-current-therapist" style="font-size: 0.82rem; color: var(--soft-purple-primary); font-weight: 600; margin-top: 0.2rem;">Terapeuta actual: --</div>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="soft-label" for="derivar-destino-id">
                Especialista Clínico de Destino <span class="required">*</span>
              </label>
              <select id="derivar-destino-id" class="soft-select" required style="font-weight: 600;">
                <option value="">-- Seleccionar Terapeuta Receptor --</option>
              </select>
              <div class="field-feedback" style="font-size: 0.75rem; color: var(--soft-text-muted); margin-top: 0.25rem;">El paciente se sumará a la lista de casos del especialista receptor</div>
            </div>

            <div class="form-group" style="margin-bottom: 1.15rem;">
              <label class="soft-label" for="derivar-motivo" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.35rem;">
                <span>Motivo Clínico de Derivación <span class="required">*</span></span>
                <span style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 500;">Redacción libre o uso de sugerencias rápidas</span>
              </label>
              
              <!-- Chips de sugerencias clínicas de clic rápido -->
              <div style="display: flex; gap: 0.38rem; flex-wrap: wrap; margin-bottom: 0.55rem;" id="chips-motivo-container">
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-chip-motivo" data-text="Interconsulta y estimulación fonoaudiológica por dificultades del habla/lenguaje" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">+ Fonoaudiología</button>
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-chip-motivo" data-text="Evaluación psicopedagógica complementaria en lectoescritura y cálculo" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">+ Psicopedagogía</button>
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-chip-motivo" data-text="Valoración neuropsicológica integral de atención y funciones ejecutivas" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">+ Neuropsicología</button>
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-chip-motivo" data-text="Evaluación cognitiva y memoria en adulto mayor (Psicogerontología)" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">+ Adulto Mayor</button>
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-chip-motivo" data-text="Intervención en modificación conductual y dinámica familiar" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">+ Conductual</button>
                <button type="button" id="btn-clear-motivo" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">Limpiar</button>
              </div>

              <textarea 
                id="derivar-motivo" 
                class="soft-textarea" 
                rows="3" 
                placeholder="Escriba a mano alzada el motivo específico de derivación o haga clic en un botón superior para sugerir la base..."
                required
              ></textarea>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="soft-label" for="derivar-notas">
                Observaciones Clínicas y Recomendaciones de Pase
              </label>
              <textarea id="derivar-notas" class="soft-textarea" rows="3" placeholder="Sintomatología observada, pruebas previas, acuerdos con la familia..."></textarea>
            </div>

            <div class="form-group" style="margin-bottom: 1.3rem; display: flex; align-items: center; gap: 0.5rem;">
              <input type="checkbox" id="derivar-reasignar-principal" style="width: 17px; height: 17px; cursor: pointer;" />
              <label for="derivar-reasignar-principal" style="font-size: 0.85rem; font-weight: 700; color: var(--soft-text-title); cursor: pointer; margin: 0;">
                Traspasar cabecera: Reasignar como terapeuta principal del paciente
              </label>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1.1rem;">
              <button type="button" id="btn-cancel-derivar" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
              <button type="submit" id="btn-submit-derivar" class="soft-btn soft-btn-lvl-2">
                ${Icons.share(16, '#FFFFFF')}
                <span>Confirmar Derivación</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- MODAL 3: CONFIRMACIÓN DE BAJA LÓGICA CON MOTIVO (NIVEL 2) -->
      <!-- ========================================================================= -->
      <div id="archive-modal-backdrop" class="modal-backdrop" style="display: none;">
        <div class="soft-modal-card" style="max-width: 540px; max-height: 90vh;">
          <div style="background: var(--soft-lavender-surface); padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.archive(20, 'var(--soft-purple-primary)')}
              </div>
              <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.015em;">Archivar Expediente Clínico</h3>
            </div>
            <button id="btn-close-archive" type="button" class="soft-modal-close-btn" aria-label="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <form id="archive-form" style="padding: 1.45rem 1.5rem; overflow-y: auto;">
            <input type="hidden" id="archive-patient-id" value="" />

            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 0.9rem 1.05rem; margin-bottom: 1.15rem;">
              <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.95rem; margin-bottom: 0.25rem;">
                ¿Desea dar de baja el expediente <span id="archive-patient-code" style="color: var(--soft-purple-primary);">--</span>?
              </div>
              <div style="font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.48;">
                Por normativa médica, el historial <strong>no se borrará físicamente</strong> de la base de datos. Pasará al archivo histórico institucional y solo el Administrador podrá consultarlo o restaurarlo.
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.2rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; flex-wrap: wrap; gap: 0.35rem;">
                <label class="soft-label" for="archive-motivo" style="margin: 0;">
                  Motivo o Justificación de la Baja Clínica <span class="required">*</span>
                </label>
                <span style="font-size: 0.72rem; color: var(--soft-text-muted);">Redacción libre o selección rápida</span>
              </div>

              <!-- Chips de sugerencias clínicas de baja -->
              <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.6rem;">
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-chip-baja" data-text="Alta médica / Objetivos de intervención cumplidos" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">+ Alta Terapéutica</button>
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-chip-baja" data-text="Abandono voluntario de tratamiento por parte de la familia" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">+ Abandono Familiar</button>
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-chip-baja" data-text="Cambio de domicilio o traslado de ciudad" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">+ Traslado de Ciudad</button>
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-chip-baja" data-text="Derivación definitiva a institución médica externa" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">+ Derivación Externa</button>
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-chip-baja" data-text="Ficha duplicada o error involuntario de registro" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">+ Ficha Duplicada / Error</button>
                <button type="button" id="btn-clear-baja" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="padding: 0.26rem 0.65rem; font-size: 0.73rem; border-radius: 9999px;">Limpiar</button>
              </div>

              <textarea 
                id="archive-motivo" 
                class="soft-textarea" 
                rows="3" 
                placeholder="Escriba a mano alzada el motivo de la baja clínica o haga clic en uno de los botones para insertar una justificación..." 
                required
              ></textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1.1rem;">
              <button type="button" id="btn-cancel-archive" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
              <button type="submit" id="btn-submit-archive" class="soft-btn soft-btn-lvl-2">
                ${Icons.archive(16, '#FFFFFF')}
                <span>Archivar Expediente</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- MODAL 4: DETALLE DE FICHA DEMOGRÁFICA Y DERIVACIONES (NIVEL 2) -->
      <!-- ========================================================================= -->
      <div id="detail-modal-backdrop" class="modal-backdrop" style="display: none;">
        <div class="soft-modal-card" style="max-width: 730px; max-height: 90vh;">
          <div style="background: var(--soft-lavender-surface); padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.fileText(20, 'var(--soft-purple-primary)')}
              </div>
              <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.16rem; font-weight: 800; letter-spacing: -0.015em;">Ficha Demográfica del Expediente</h3>
            </div>
            <button id="btn-close-detail" type="button" class="soft-modal-close-btn" aria-label="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <div id="detail-modal-content" style="padding: 1.45rem 1.5rem; overflow-y: auto;">
            <!-- Rellenado dinámicamente -->
          </div>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- MODAL 5: DIRECTORIO DE TUTORES REGISTRADOS (SUB-MODAL ANIDADO — NIVEL 3) -->
      <!-- ========================================================================= -->
      <div id="search-tutor-modal-backdrop" class="modal-backdrop" style="display: none; z-index: 1150;">
        <div class="soft-modal-card" style="max-width: 680px; width: 95%; max-height: 90vh;">
          <!-- Modal Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--soft-divider); background: var(--soft-lavender-surface); gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                ${Icons.family(20, 'var(--soft-mint-deep)')}
              </div>
              <div>
                <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.14rem; font-weight: 800; letter-spacing: -0.015em;">Directorio de Tutores Registrados</h3>
                <p style="margin: 0.15rem 0 0 0; font-size: 0.78rem; color: var(--soft-text-body);">
                  Selecciona un tutor para vincularlo a este expediente clínico
                </p>
              </div>
            </div>
            <button type="button" id="btn-close-search-tutor-modal" class="soft-modal-close-btn" aria-label="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- Search & Filter Controls -->
          <div style="padding: 1rem 1.5rem; background: #FFFFFF; border-bottom: 1px solid var(--soft-divider); display: flex; flex-direction: column; gap: 0.8rem;">
            <!-- Buscador Input -->
            <div class="soft-search-box" style="width: 100%;">
              <span class="soft-search-box-icon">
                ${Icons.search(16)}
              </span>
              <input 
                type="text" 
                id="modal-tutor-search-input" 
                class="soft-input" 
                placeholder="Buscar por nombre, apellidos, C.I., correo o WhatsApp..." 
                style="padding-right: 2.2rem;"
              />
              <button 
                type="button" 
                id="modal-tutor-search-clear" 
                style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); border: none; background: transparent; cursor: pointer; color: var(--soft-text-muted); display: none; padding: 0.2rem;"
              >
                ${Icons.close(14)}
              </button>
            </div>

            <!-- Filtros Rápidos (Chips Nivel 3) -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;" id="modal-tutor-filter-tabs">
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-3 btn-tutor-filter-tab active" data-filter="ALL" style="padding: 0.3rem 0.78rem; font-size: 0.75rem; border-radius: 9999px;">
                  Todos (<span id="tutor-filter-count-all">0</span>)
                </button>
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-tutor-filter-tab" data-filter="WEB" style="padding: 0.3rem 0.78rem; font-size: 0.75rem; border-radius: 9999px;">
                  Con Cuenta Web (<span id="tutor-filter-count-web">0</span>)
                </button>
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-tutor-filter-tab" data-filter="CLINIC_ONLY" style="padding: 0.3rem 0.78rem; font-size: 0.75rem; border-radius: 9999px;">
                  Solo Registro Clínico (<span id="tutor-filter-count-clinic">0</span>)
                </button>
              </div>

              <button type="button" id="btn-modal-open-create-tutor" class="soft-btn soft-btn-sm soft-btn-lvl-3">
                + Crear Tutor Nuevo
              </button>
            </div>
          </div>

          <!-- Tutor Cards List Container (Scrollable) -->
          <div id="modal-tutor-results-list" style="padding: 1.25rem 1.5rem; overflow-y: auto; max-height: calc(90vh - 230px); display: flex; flex-direction: column; gap: 0.8rem; background: var(--soft-lavender-surface);">
            <!-- Contenido dinámico -->
          </div>

          <!-- Modal Footer -->
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.9rem 1.5rem; border-top: 1px solid var(--soft-divider); background: #FFFFFF;">
            <div style="font-size: 0.78rem; color: var(--soft-text-body); font-weight: 600;">
              <span id="modal-tutor-results-count">0</span> tutores encontrados
            </div>
            <button type="button" id="btn-cancel-search-tutor-modal" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    `;

    // Cargar datos
    await this.loadInitialData();
    this.attachEvents();
  }

  async loadInitialData() {
    try {
      const [tutorsRes, therapistsRes] = await Promise.all([
        apiClient.get('/api/patients/tutors'),
        apiClient.get('/api/therapists')
      ]);

      if (tutorsRes.success) {
        this.tutors = tutorsRes.data;
        this.populateTutorsSelect();
      }

      if (therapistsRes.success) {
        this.therapists = therapistsRes.data;
        this.populateTherapistsSelect();
      }

      await this.loadPatients();
    } catch (err) {
      console.error('Error cargando catálogos:', err);
      Toast.error('No se pudieron cargar los catálogos del centro.');
    }
  }

  async loadPatients() {
    try {
      let endpoint = '/api/patients';
      const params = [];

      if (this.userRole === 'ADMIN') {
        if (this.activeTab === 'ARCHIVADOS') {
          params.push('archivados=true');
        } else if (this.selectedTherapistFilter) {
          params.push(`filtrar_por_terapeuta=${this.selectedTherapistFilter}`);
        }
      } else if (this.userRole === 'TERAPEUTA') {
        if (this.activeTab === 'DERIVADOS') {
          params.push('solo_derivados=true');
        }
      }

      if (params.length > 0) {
        endpoint += '?' + params.join('&');
      }

      const res = await apiClient.get(endpoint);
      if (res.success) {
        this.patients = res.data;
        this.applyFilter();
        this.updateStats();
      }
    } catch (err) {
      console.error('Error cargando expedientes:', err);
      Toast.error(err.message || 'Error al obtener los expedientes clínicos.');
    }
  }

  populateTherapistsSelect() {
    const formSelect = document.getElementById('form-terapeuta-id');
    const derivarSelect = document.getElementById('derivar-destino-id');
    const filterSelect = document.getElementById('select-filter-terapeuta');

    const optionsHtml = this.therapists.map(t => `
      <option value="${t.id}">
        Lic. ${t.nombres} ${t.apellidos} - ${t.especialidad_nombre || 'Especialista'} (${t.registro_profesional})
      </option>
    `).join('');

    if (formSelect && formSelect.tagName === 'SELECT') {
      formSelect.innerHTML = `<option value="">-- Seleccionar Especialista Responsable --</option>` + optionsHtml;
    }

    if (derivarSelect) {
      derivarSelect.innerHTML = `<option value="">-- Seleccionar Terapeuta Receptor --</option>` + optionsHtml;
    }

    if (filterSelect) {
      filterSelect.innerHTML = `<option value="">-- Todos los Especialistas --</option>` + optionsHtml;
      filterSelect.value = this.selectedTherapistFilter;
    }
  }

  populateTutorsSelect() {
    const select = document.getElementById('form-tutor-id');
    if (!select || select.tagName !== 'SELECT') return;
    const options = this.tutors.map(t => `
      <option value="${t.id}">${t.nombres} ${t.apellidos} - C.I. ${t.ci || 'S/CI'} (${t.parentesco || 'Tutor'}) · WhatsApp: ${t.whatsapp}</option>
    `).join('');
    select.innerHTML = '<option value="">-- Sin tutor asignado o vincular después --</option>' + options;
  }

  updateStats() {
    const totalEl = document.getElementById('stat-total');
    const pedEl = document.getElementById('stat-pediatric');
    const senEl = document.getElementById('stat-seniors');
    const derEl = document.getElementById('stat-derivados');

    const countActivosEl = document.getElementById('tab-count-activos');
    const countArchivadosEl = document.getElementById('tab-count-archivados');
    const countAsignadosEl = document.getElementById('tab-count-asignados');
    const countDerivadosEl = document.getElementById('tab-count-derivados');

    if (totalEl) totalEl.textContent = this.patients.length;
    if (pedEl) {
      const peds = this.patients.filter(p => p.edad_cronologica && p.edad_cronologica.years < 12).length;
      pedEl.textContent = peds;
    }
    if (senEl) {
      const seniors = this.patients.filter(p => p.edad_cronologica && p.edad_cronologica.years >= 60).length;
      senEl.textContent = seniors;
    }
    if (derEl) {
      const derivationsCount = this.patients.filter(p => p.total_derivaciones_activas > 0 || p.derivado_por_nombre).length;
      derEl.textContent = derivationsCount;
    }

    if (countActivosEl && this.activeTab === 'ACTIVOS') countActivosEl.textContent = this.patients.length;
    if (countArchivadosEl && this.activeTab === 'ARCHIVADOS') countArchivadosEl.textContent = this.patients.length;
    if (countAsignadosEl) countAsignadosEl.textContent = this.patients.filter(p => p.es_titular_actual !== false).length;
    if (countDerivadosEl) countDerivadosEl.textContent = this.patients.filter(p => p.total_derivaciones_activas > 0 || p.es_titular_actual === false).length;
  }

  applyFilter() {
    let list = [...this.patients];

    if (this.searchTerm.trim().length > 0) {
      const term = this.searchTerm.toLowerCase().trim();
      list = list.filter(p => 
        p.codigo_expediente.toLowerCase().includes(term) ||
        p.nombres.toLowerCase().includes(term) ||
        p.apellidos.toLowerCase().includes(term) ||
        `${p.nombres} ${p.apellidos}`.toLowerCase().includes(term) ||
        (p.ci && p.ci.toLowerCase().includes(term)) ||
        (p.terapeuta_nombre && p.terapeuta_nombre.toLowerCase().includes(term))
      );
    }

    if (this.currentFilter !== 'ALL') {
      list = list.filter(p => p.edad_cronologica && p.edad_cronologica.grupoEtario === this.currentFilter);
    }

    this.filteredPatients = list;
    this.renderPatientsList();
  }

  renderPatientsList() {
    const container = document.getElementById('patients-list');
    if (!container) return;

    if (this.filteredPatients.length === 0) {
      const isArchivedTab = this.activeTab === 'ARCHIVADOS';
      container.innerHTML = `
        <div class="soft-card-static" style="grid-column: 1 / -1; padding: 2.75rem 1.75rem; text-align: center;">
          <div class="soft-icon-box soft-icon-box-lg ${isArchivedTab ? 'soft-icon-box-amber' : 'soft-icon-box-lavender'}" style="margin: 0 auto 1rem auto;">
            ${isArchivedTab ? Icons.archive(30, '#B45309') : Icons.folderSearch(30, 'var(--soft-purple-primary)')}
          </div>
          <h3 style="color: var(--soft-text-title); font-size: 1.12rem; font-weight: 800; margin: 0 0 0.45rem 0; letter-spacing: -0.01em;">
            ${isArchivedTab 
              ? 'No hay expedientes archivados en la papelera histórica' 
              : 'No se encontraron expedientes clínicos coincidentes'}
          </h3>
          <p style="color: var(--soft-text-body); font-size: 0.86rem; max-width: 520px; margin: 0 auto 1.35rem auto; line-height: 1.55;">
            ${this.searchTerm.trim()
              ? `No existen registros que coincidan con "<strong>${this.escapeHtml(this.searchTerm)}</strong>". Verifique el número de carnet de identidad o el código.`
              : (isArchivedTab 
                  ? 'Todos los pacientes registrados permanecen en el flujo activo institucional.' 
                  : 'No hay pacientes registrados en este filtro o asignados a su consulta.')}
          </p>
          ${!isArchivedTab ? `
            <button id="btn-empty-create" class="soft-btn soft-btn-lvl-1">
              ${Icons.plus(15, '#FFFFFF')}
              <span>Aperturar Nuevo Expediente</span>
            </button>
          ` : ''}
        </div>
      `;

      const createBtn = document.getElementById('btn-empty-create');
      if (createBtn) {
        createBtn.addEventListener('click', () => this.openCreateModal());
      }
      return;
    }

    const isArchivedTab = this.activeTab === 'ARCHIVADOS';
    const isAdmin = this.isAdmin;

    container.innerHTML = this.filteredPatients.map(p => {
      let isMintCard = false;
      let ageBadgeClass = 'soft-badge-lavender';
      let ageIconColor = 'var(--soft-purple-primary)';

      if (p.edad_cronologica) {
        if (p.edad_cronologica.grupoEtario === 'INFANTIL') {
          isMintCard = !isArchivedTab;
          ageBadgeClass = 'soft-badge-mint';
          ageIconColor = 'var(--soft-mint-deep)';
        } else if (p.edad_cronologica.grupoEtario === 'ADULTO_MAYOR') {
          ageBadgeClass = 'soft-badge-amber';
          ageIconColor = '#B45309';
        }
      }

      const tutorPrincipal = p.tutores && p.tutores.length > 0 ? p.tutores[0] : null;
      const terapeutaInactivo = p.terapeuta_activo === 0;
      const canEdit = isAdmin || (p.puede_editar !== false && (!this.user?.terapeuta || p.terapeuta_id === this.user.terapeuta.id));

      return `
        <div class="soft-room-card ${isMintCard ? 'soft-room-mint' : ''}" style="display: flex; flex-direction: column; justify-content: space-between; position: relative; padding: 1.35rem 1.45rem; ${isArchivedTab ? 'background: #F8FAFC;' : ''}">
          <div>
            <!-- Cabecera de la Tarjeta: Código, Sexo y Estado -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; gap: 0.5rem;">
              <span class="soft-badge ${isArchivedTab ? 'soft-badge-slate' : 'soft-badge-lavender'}" style="letter-spacing: 0.03em; font-weight: 800;">
                ${!isArchivedTab ? '<span class="soft-status-dot"></span>' : ''}
                ${p.codigo_expediente}
              </span>
              <div style="display: flex; gap: 0.35rem; align-items: center;">
                ${isArchivedTab ? `
                  <span class="soft-badge soft-badge-rose">Archivado</span>
                ` : `
                  <span class="soft-badge ${p.sexo === 'F' ? 'soft-badge-lavender' : 'soft-badge-mint'}">
                    ${p.sexo === 'F' ? 'Femenino' : (p.sexo === 'M' ? 'Masculino' : 'Otro')}
                  </span>
                `}
              </div>
            </div>

            <!-- Nombre Completo del Paciente -->
            <h3 style="font-size: 1.12rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.3rem 0; letter-spacing: -0.015em;">
              ${p.nombres} ${p.apellidos}
            </h3>

            <!-- CI Boliviano y Ocupación -->
            <div style="font-size: 0.82rem; color: var(--soft-text-body); margin-bottom: 0.7rem;">
              <span>C.I. <strong style="color: var(--soft-text-title);">${p.ci || 'Sin C.I.'}</strong></span> · 
              <span>${p.colegio_ocupacion || 'Sin ocupación'}</span>
            </div>

            <!-- Chip de Edad Cronológica -->
            <div style="margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
              <span class="soft-badge ${ageBadgeClass}">
                ${Icons.pulse(13, ageIconColor)}
                <span>${p.edad_cronologica ? p.edad_cronologica.formatted : 'Sin fecha'}</span>
              </span>

              ${p.derivado_por_nombre ? `
                <span class="soft-badge soft-badge-mint" title="Derivado por Lic. ${p.derivado_por_nombre}">
                  ${Icons.share(12, 'var(--soft-mint-deep)')}
                  <span>Derivado</span>
                </span>
              ` : ''}
            </div>

            <!-- FICHA DE ASIGNACIÓN CLÍNICA Y CREADOR -->
            <div class="soft-subcard" style="padding: 0.65rem 0.85rem; font-size: 0.78rem; margin-bottom: 0.8rem; background: rgba(255, 255, 255, 0.82);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.22rem; gap: 0.5rem;">
                <span style="color: var(--soft-text-muted); font-weight: 700;">Terapeuta:</span>
                <span style="font-weight: 800; color: ${terapeutaInactivo ? '#B91C1C' : 'var(--soft-text-title)'}; text-align: right;">
                  ${p.terapeuta_nombre ? `Lic. ${p.terapeuta_nombre}` : '<em style="color: var(--soft-text-muted); font-weight: 500;">Sin asignar</em>'}
                </span>
              </div>

              ${terapeutaInactivo ? `
                <div style="color: #B91C1C; font-size: 0.72rem; font-weight: 700; display: flex; align-items: center; gap: 0.25rem; margin-top: 0.2rem;">
                  ${Icons.alertTriangle(12, '#B91C1C')}
                  <span>Requiere reasignación (Terapeuta inactivo)</span>
                </div>
              ` : ''}

              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.3rem; border-top: 1px dashed var(--soft-divider); padding-top: 0.3rem; gap: 0.5rem;">
                <span style="color: var(--soft-text-muted);">Aperturado por:</span>
                <span style="color: var(--soft-purple-primary); font-weight: 700;">${p.creador_nombre || 'Sistema'}</span>
              </div>
            </div>

            ${isArchivedTab ? `
              <!-- Información de Baja Lógica (Papelera) -->
              <div class="soft-subcard" style="background: var(--soft-rose-bg); border-color: rgba(225, 29, 72, 0.18); padding: 0.65rem 0.85rem; font-size: 0.76rem; color: var(--soft-text-body); margin-bottom: 0.5rem;">
                <div><strong style="color: #B91C1C;">Motivo de baja:</strong> ${p.motivo_baja || 'Baja solicitada'}</div>
                <div style="margin-top: 0.15rem;">Archivado por: <strong style="color: var(--soft-text-title);">${p.eliminador_nombre || 'Admin'}</strong> el <em>${p.fecha_eliminacion ? p.fecha_eliminacion.slice(0, 10) : 'N/A'}</em></div>
              </div>
            ` : `
              <!-- Tutor Responsable -->
              <div style="padding-top: 0.65rem; border-top: 1px dashed var(--soft-divider); font-size: 0.82rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; gap: 0.5rem;">
                  <span style="color: var(--soft-text-muted); font-weight: 700;">Tutor / Red Familiar:</span>
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-link-tutor-direct" data-id="${p.id}" data-name="${this.escapeHtml(p.nombres + ' ' + p.apellidos)}" data-code="${this.escapeHtml(p.codigo_expediente)}" style="padding: 0.22rem 0.6rem; font-size: 0.72rem;">
                    ${Icons.family(12, 'var(--soft-purple-primary)')}
                    <span>${tutorPrincipal ? 'Gestionar' : '+ Vincular'}</span>
                  </button>
                </div>
                ${tutorPrincipal ? `
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                    <span style="font-weight: 700; color: var(--soft-text-title); font-size: 0.84rem;">
                      ${this.escapeHtml(tutorPrincipal.nombres)} ${this.escapeHtml(tutorPrincipal.apellidos)} (${this.escapeHtml(tutorPrincipal.parentesco_vinculo || tutorPrincipal.parentesco || 'TUTOR')})
                    </span>
                    <a href="https://wa.me/${(tutorPrincipal.whatsapp || '').replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="padding: 0.24rem 0.5rem;" title="Abrir WhatsApp">
                      ${Icons.phone(13, 'var(--soft-emerald-text)')}
                    </a>
                  </div>
                ` : `
                  <span style="color: var(--soft-text-muted); font-style: italic; font-size: 0.8rem;">Sin tutor vinculado al portal</span>
                `}
              </div>
            `}
          </div>

          <!-- BOTONERA DE ACCIÓN INFERIOR -->
          <div style="margin-top: 1.15rem; display: flex; gap: 0.42rem; justify-content: flex-end; align-items: center; border-top: 1px solid var(--soft-divider); padding-top: 0.9rem; flex-wrap: wrap;">
            ${isArchivedTab ? `
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-view-patient" data-id="${p.id}" title="Ver Ficha Histórica">
                ${Icons.fileText(14, 'var(--soft-purple-primary)')}
                <span>Histórico</span>
              </button>
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-restore-patient" data-id="${p.id}" data-name="${p.nombres} ${p.apellidos}" data-code="${p.codigo_expediente}">
                ${Icons.restore(14, '#FFFFFF')}
                <span>Restaurar</span>
              </button>
            ` : `
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-view-patient" data-id="${p.id}" title="Ver Ficha Clínica">
                ${Icons.fileText(14, 'var(--soft-purple-primary)')}
                <span>Ficha</span>
              </button>

              ${['ADMIN', 'TERAPEUTA'].includes(this.userRole) ? `
                <a href="#/clinical-records?patientId=${p.id}" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="text-decoration: none;" title="Historia Clínica & Notas SOAP">
                  ${Icons.stethoscope(14, 'var(--soft-purple-primary)')}
                  <span>Historia</span>
                </a>
              ` : ''}

              ${canEdit ? `
                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-link-tutor-direct" data-id="${p.id}" data-name="${this.escapeHtml(p.nombres + ' ' + p.apellidos)}" data-code="${this.escapeHtml(p.codigo_expediente)}" title="Vincular o Cambiar Tutor">
                  ${Icons.family(14, 'var(--soft-purple-primary)')}
                  <span>Tutor</span>
                </button>

                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-derivar-patient" data-id="${p.id}" title="Derivación Interdisciplinaria">
                  ${Icons.share(14, 'var(--soft-purple-primary)')}
                  <span>Derivar</span>
                </button>

                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-edit-patient" data-id="${p.id}" title="Editar Datos">
                  ${Icons.edit(14, '#FFFFFF')}
                  <span>Editar</span>
                </button>

                ${isAdmin ? `
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-archive-patient" data-id="${p.id}" data-code="${p.codigo_expediente}" data-name="${p.nombres} ${p.apellidos}" style="padding: 0.42rem 0.65rem;" title="Archivar Expediente (Baja Lógica)">
                    ${Icons.trash(14, '#B91C1C')}
                  </button>
                ` : ''}
              ` : `
                <span class="soft-badge soft-badge-mint" title="Caso derivado a otro especialista. Modalidad de solo lectura.">
                  ${Icons.lock(12, 'var(--soft-mint-deep)')} Solo Lectura (Derivado)
                </span>
              `}
            `}
          </div>
        </div>
      `;
    }).join('');

    // Listeners de tarjetas
    container.querySelectorAll('.btn-view-patient').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.openDetailModal(id);
      });
    });

    container.querySelectorAll('.btn-edit-patient').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.openEditModal(id);
      });
    });

    container.querySelectorAll('.btn-link-tutor-direct').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const name = e.currentTarget.getAttribute('data-name');
        const code = e.currentTarget.getAttribute('data-code');
        const patient = this.patients.find(item => String(item.id) === String(id));
        const currentTutor = patient?.tutores && patient.tutores.length > 0 ? patient.tutores[0] : null;
        this.openLinkTutorModal(id, name, code, currentTutor);
      });
    });

    container.querySelectorAll('.btn-derivar-patient').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.openDerivarModal(id);
      });
    });

    container.querySelectorAll('.btn-archive-patient').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const code = e.currentTarget.getAttribute('data-code');
        const name = e.currentTarget.getAttribute('data-name');
        this.openArchiveModal(id, code, name);
      });
    });

    container.querySelectorAll('.btn-restore-patient').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const code = e.currentTarget.getAttribute('data-code');
        const name = e.currentTarget.getAttribute('data-name');
        this.handleRestorePatient(id, code, name);
      });
    });
  }

  attachEvents() {
    // 1. Buscador predictivo
    const searchInput = document.getElementById('patient-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.searchTerm = e.target.value;
          this.applyFilter();
        }, 300);
      });
    }

    // 2. Filtros etarios
    const chips = this.container.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        chips.forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentFilter = e.currentTarget.getAttribute('data-filter');
        this.applyFilter();
      });
    });

    // 3. Pestañas de segmento (Activos / Archivados / Derivados)
    const tabs = this.container.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', async (e) => {
        const clickedTab = e.currentTarget;
        const targetTab = clickedTab.getAttribute('data-tab');
        this.activeTab = targetTab;

        tabs.forEach(t => {
          const isActive = t.getAttribute('data-tab') === targetTab;
          t.classList.toggle('active', isActive);
          t.classList.toggle('soft-btn-lvl-1', isActive);
          t.classList.toggle('soft-btn-lvl-1-muted', !isActive);

          const iconSvg = t.querySelector('.nav-tab-icon svg');
          if (iconSvg) {
            iconSvg.setAttribute('stroke', isActive ? '#FFFFFF' : 'var(--soft-purple-primary)');
          }

          const badge = t.querySelector('.nav-tab-badge');
          if (badge) {
            badge.style.background = isActive ? 'rgba(255,255,255,0.22)' : 'rgba(88, 66, 148, 0.12)';
            badge.style.color = isActive ? '#FFFFFF' : 'var(--soft-purple-primary)';
          }
        });

        await this.loadPatients();
      });
    });

    // 4. Filtro por terapeuta para Admin
    const filterTherapistSelect = document.getElementById('select-filter-terapeuta');
    if (filterTherapistSelect) {
      filterTherapistSelect.addEventListener('change', async (e) => {
        this.selectedTherapistFilter = e.target.value;
        await this.loadPatients();
      });
    }

    // 5. Botón Nuevo Expediente
    const newBtn = document.getElementById('btn-new-patient');
    if (newBtn) {
      newBtn.addEventListener('click', () => this.openCreateModal());
    }

    // 6. Validación de C.I. en vivo con Debounce
    const ciNumInput = document.getElementById('form-ci-num');
    const ciDepSelect = document.getElementById('form-ci-dep');
    const triggerCiCheck = () => {
      clearTimeout(this.ciDebounceTimer);
      this.ciDebounceTimer = setTimeout(() => this.validateCiLive(), 350);
    };

    if (ciNumInput) ciNumInput.addEventListener('input', triggerCiCheck);
    if (ciDepSelect) ciDepSelect.addEventListener('change', triggerCiCheck);

    // 7. Cálculo de edad en vivo al tipear fecha
    const fechaNacInput = document.getElementById('form-fecha-nac');
    if (fechaNacInput) {
      fechaNacInput.addEventListener('change', (e) => this.calculateAgeLive(e.target.value));
      fechaNacInput.addEventListener('input', (e) => this.calculateAgeLive(e.target.value));
    }

    // 8. Toggle para nuevo tutor al vuelo
    const toggleTutorBtn = document.getElementById('btn-toggle-new-tutor');
    const newTutorFields = document.getElementById('new-tutor-fields');
    if (toggleTutorBtn && newTutorFields) {
      toggleTutorBtn.addEventListener('click', () => {
        const isHidden = newTutorFields.style.display === 'none';
        newTutorFields.style.display = isHidden ? 'block' : 'none';
        toggleTutorBtn.textContent = isHidden ? '- Cancelar Nuevo Tutor' : '+ Crear Nuevo Tutor';
      });
    }

    // 9. Envíos y cierres de modal
    const patientForm = document.getElementById('patient-form');
    if (patientForm) patientForm.addEventListener('submit', (e) => this.handleSubmitPatient(e));

    const closeBtn = document.getElementById('btn-close-modal');
    const cancelBtn = document.getElementById('btn-cancel-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closePatientModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closePatientModal());

    const closeDetailBtn = document.getElementById('btn-close-detail');
    if (closeDetailBtn) closeDetailBtn.addEventListener('click', () => this.closeDetailModal());

    // 10. Modal Derivar
    const closeDerivarBtn = document.getElementById('btn-close-derivar');
    const cancelDerivarBtn = document.getElementById('btn-cancel-derivar');
    const derivarForm = document.getElementById('derivar-form');

    if (closeDerivarBtn) closeDerivarBtn.addEventListener('click', () => this.closeDerivarModal());
    if (cancelDerivarBtn) cancelDerivarBtn.addEventListener('click', () => this.closeDerivarModal());
    if (derivarForm) derivarForm.addEventListener('submit', (e) => this.handleSubmitDerivar(e));

    // Sugerencias rápidas para motivo de derivación
    document.querySelectorAll('.btn-chip-motivo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const text = e.currentTarget.getAttribute('data-text');
        const textarea = document.getElementById('derivar-motivo');
        if (textarea && text) {
          if (textarea.value.trim().length > 0) {
            textarea.value = textarea.value.trim() + ' | ' + text;
          } else {
            textarea.value = text;
          }
          textarea.focus();
        }
      });
    });

    const clearMotivoBtn = document.getElementById('btn-clear-motivo');
    if (clearMotivoBtn) {
      clearMotivoBtn.addEventListener('click', () => {
        const textarea = document.getElementById('derivar-motivo');
        if (textarea) {
          textarea.value = '';
          textarea.focus();
        }
      });
    }

    // 11. Modal Archivar
    const closeArchiveBtn = document.getElementById('btn-close-archive');
    const cancelArchiveBtn = document.getElementById('btn-cancel-archive');
    const archiveForm = document.getElementById('archive-form');

    if (closeArchiveBtn) closeArchiveBtn.addEventListener('click', () => this.closeArchiveModal());
    if (cancelArchiveBtn) cancelArchiveBtn.addEventListener('click', () => this.closeArchiveModal());
    if (archiveForm) archiveForm.addEventListener('submit', (e) => this.handleSubmitArchive(e));

    const chipsBaja = this.container.querySelectorAll('.btn-chip-baja');
    chipsBaja.forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text');
        const textarea = document.getElementById('archive-motivo');
        if (textarea && text) {
          if (textarea.value.trim().length > 0) {
            textarea.value = textarea.value.trim() + ' | ' + text;
          } else {
            textarea.value = text;
          }
          textarea.focus();
        }
      });
    });

    const clearBajaBtn = document.getElementById('btn-clear-baja');
    if (clearBajaBtn) {
      clearBajaBtn.addEventListener('click', () => {
        const textarea = document.getElementById('archive-motivo');
        if (textarea) {
          textarea.value = '';
          textarea.focus();
        }
      });
    }

    // 12. Modal Directorio y Selección de Tutor para Formulario de Paciente
    document.getElementById('btn-open-search-tutor-modal')?.addEventListener('click', () => {
      this.openSelectTutorModalForPatientForm();
    });

    document.getElementById('btn-change-selected-tutor')?.addEventListener('click', () => {
      this.openSelectTutorModalForPatientForm();
    });

    document.getElementById('btn-remove-selected-tutor')?.addEventListener('click', () => {
      this.setFormSelectedTutor(null);
    });

    // Toggle rápido de formulario nuevo tutor
    const toggleNewTutorBtn = document.getElementById('btn-toggle-new-tutor');
    const quickNewTutorBtn = document.getElementById('btn-quick-new-tutor');
    const newTutorContainer = document.getElementById('new-tutor-fields');

    const toggleNewTutorForm = () => {
      if (!newTutorContainer) return;
      const isVisible = newTutorContainer.style.display !== 'none';
      newTutorContainer.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        document.getElementById('new-tutor-nombres')?.focus();
      }
    };

    toggleNewTutorBtn?.addEventListener('click', toggleNewTutorForm);
    quickNewTutorBtn?.addEventListener('click', toggleNewTutorForm);

    document.getElementById('btn-cancel-new-tutor-box')?.addEventListener('click', () => {
      if (newTutorContainer) newTutorContainer.style.display = 'none';
    });

    document.getElementById('btn-confirm-new-tutor-box')?.addEventListener('click', async () => {
      await this.handleQuickCreateTutor();
    });

    // Eventos dentro de la ventana emergente Modal 5 (Búsqueda de Tutores - Nivel 3)
    document.getElementById('btn-close-search-tutor-modal')?.addEventListener('click', () => {
      this.closeSelectTutorModal();
    });

    document.getElementById('btn-cancel-search-tutor-modal')?.addEventListener('click', () => {
      this.closeSelectTutorModal();
    });

    // Buscador en tiempo real de tutores con debounce
    const modalSearchInput = document.getElementById('modal-tutor-search-input');
    let modalTutorDebounce = null;
    modalSearchInput?.addEventListener('input', (e) => {
      clearTimeout(modalTutorDebounce);
      modalTutorDebounce = setTimeout(() => {
        this.handleTutorSearch(e.target.value);
      }, 250);
    });

    document.getElementById('modal-tutor-search-clear')?.addEventListener('click', () => {
      if (modalSearchInput) {
        modalSearchInput.value = '';
        modalSearchInput.focus();
      }
      this.handleTutorSearch('');
    });

    // Filtros por pestaña dentro del modal Nivel 3 (Todos / Web / Clínico)
    document.querySelectorAll('.btn-tutor-filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const currentTab = e.currentTarget;
        document.querySelectorAll('.btn-tutor-filter-tab').forEach(t => {
          const isActive = t === currentTab;
          t.classList.toggle('active', isActive);
          t.classList.toggle('soft-btn-lvl-3', isActive);
          t.classList.toggle('soft-btn-lvl-2-soft', !isActive);
          t.style.background = '';
          t.style.color = '';
          t.style.borderColor = '';
        });

        this.modalTutorFilter = currentTab.dataset.filter || 'ALL';
        this.renderModalTutorList();
      });
    });

    // Botón crear tutor desde modal emergente
    document.getElementById('btn-modal-open-create-tutor')?.addEventListener('click', () => {
      this.closeSelectTutorModal();
      if (newTutorContainer) {
        newTutorContainer.style.display = 'block';
        document.getElementById('new-tutor-nombres')?.focus();
      }
    });

    // Auto-apertura de modal o selección de pestaña por Deep Linking (MindBot IA o enlaces directos)
    if (window.location.hash.includes('/patients/new') || window.location.hash.includes('modal=new-patient')) {
      setTimeout(() => {
        this.openCreateModal();
      }, 150);
    } else if (window.location.hash.includes('archived')) {
      setTimeout(() => {
        this.container.querySelector('[data-tab="ARCHIVADOS"]')?.click();
      }, 150);
    } else if (window.location.hash.includes('assigned')) {
      setTimeout(() => {
        this.container.querySelector('[data-tab="ASIGNADOS"]')?.click();
      }, 150);
    }
  }

  async validateCiLive() {
    const ciNum = document.getElementById('form-ci-num')?.value.trim();
    const ciDep = document.getElementById('form-ci-dep')?.value;
    const feedback = document.getElementById('feedback-ci');
    const input = document.getElementById('form-ci-num');
    const saveBtn = document.getElementById('btn-save-patient');
    const currentId = document.getElementById('patient-id')?.value;

    if (!ciNum) {
      if (feedback) {
        feedback.textContent = 'La Cédula de Identidad es obligatoria.';
        feedback.style.color = '#B91C1C';
      }
      if (input) input.style.borderColor = '#E11D48';
      this.isCiValid = false;
      return false;
    }

    const fullCi = ciDep ? `${ciNum} ${ciDep}` : ciNum;

    try {
      const res = await apiClient.get(`/api/patients/check-ci?ci=${encodeURIComponent(fullCi)}${currentId ? `&excludeId=${currentId}` : ''}`);
      if (res.success && res.data.exists) {
        const p = res.data.patient;
        if (p.activo === 1) {
          if (feedback) {
            feedback.innerHTML = `<span style="color: #B91C1C; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">${Icons.alertTriangle(13, '#B91C1C')} Ya registrado en ${p.codigo_expediente} (${this.escapeHtml(p.nombres)} ${this.escapeHtml(p.apellidos)})</span>`;
          }
          if (input) input.style.borderColor = '#E11D48';
        } else {
          if (feedback) {
            feedback.innerHTML = `<span style="color: #B45309; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">${Icons.alertTriangle(13, '#B45309')} Pertenece al expediente archivado ${p.codigo_expediente}. Puede restaurarlo desde la papelera.</span>`;
          }
          if (input) input.style.borderColor = '#D97706';
        }
        this.isCiValid = false;
        if (saveBtn) saveBtn.disabled = true;
        return false;
      } else {
        if (feedback) {
          feedback.innerHTML = `<span style="color: var(--soft-emerald-text); font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem;">${Icons.check(13, 'var(--soft-emerald-text)')} C.I. boliviano disponible y validado</span>`;
        }
        if (input) input.style.borderColor = 'var(--soft-emerald-dot)';
        this.isCiValid = true;
        if (saveBtn) saveBtn.disabled = false;
        return true;
      }
    } catch (err) {
      console.warn('Error validando CI:', err);
      return false;
    }
  }

  calculateAgeLive(dateString) {
    const feedback = document.getElementById('feedback-fecha-nac');
    const input = document.getElementById('form-fecha-nac');
    const badge = document.getElementById('live-age-badge');
    const text = document.getElementById('live-age-text');

    if (!dateString) {
      if (badge) badge.style.display = 'none';
      return;
    }

    const birth = new Date(dateString);
    const today = new Date();

    if (birth > today) {
      if (feedback) {
        feedback.textContent = 'La fecha de nacimiento no puede ser una fecha futura.';
        feedback.style.color = '#B91C1C';
      }
      if (input) input.style.borderColor = '#E11D48';
      if (badge) badge.style.display = 'none';
      return;
    }

    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();

    if (days < 0) months--;
    if (months < 0) {
      years--;
      months += 12;
    }

    const formatted = years === 0 ? `${months} meses` : `${years} años, ${months} meses`;
    if (feedback) {
      feedback.textContent = 'Fecha válida y verificada';
      feedback.style.color = 'var(--soft-emerald-text)';
    }
    if (input) input.style.borderColor = 'var(--soft-emerald-dot)';
    if (badge && text) {
      text.textContent = formatted;
      badge.style.display = 'inline-flex';
    }
  }

  async openCreateModal() {
    this.isEditing = false;
    document.getElementById('patient-id').value = '';
    document.getElementById('modal-title').textContent = 'Apertura de Expediente Clínico';
    document.getElementById('patient-form').reset();
    document.getElementById('live-age-badge').style.display = 'none';
    document.getElementById('new-tutor-fields').style.display = 'none';
    this.setFormSelectedTutor(null);

    // Obtener código correlativo automático
    try {
      const res = await apiClient.get('/api/patients/next-code');
      if (res.success && res.data.nextCode) {
        document.getElementById('form-codigo').value = res.data.nextCode;
      }
    } catch (err) {
      document.getElementById('form-codigo').value = 'PSI-APRENDE';
    }

    // Auto-seleccionar terapeuta si es terapeuta
    const terapeutaSelect = document.getElementById('form-terapeuta-id');
    if (terapeutaSelect && this.user && this.user.terapeuta) {
      terapeutaSelect.value = this.user.terapeuta.id;
    }

    // Reset feedback
    const feedbackCi = document.getElementById('feedback-ci');
    if (feedbackCi) {
      feedbackCi.textContent = 'Requerido para el historial médico oficial';
      feedbackCi.style.color = 'var(--text-secondary)';
    }
    const ciInput = document.getElementById('form-ci-num');
    if (ciInput) ciInput.style.borderColor = 'var(--border-light)';

    const saveBtn = document.getElementById('btn-save-patient');
    if (saveBtn) saveBtn.disabled = false;

    document.getElementById('patient-modal-backdrop').style.display = 'flex';
  }

  async openEditModal(patientId) {
    this.isEditing = true;
    document.getElementById('patient-id').value = patientId;
    document.getElementById('modal-title').textContent = 'Editar Expediente Clínico';

    try {
      const res = await apiClient.get(`/api/patients/${patientId}`);
      if (!res.success) throw new Error();
      const p = res.data;

      // Verificación de permiso: si es terapeuta y no es el titular actual
      if (this.user && this.user.rol === 'TERAPEUTA' && p.puede_editar === false) {
        Toast.warning('Acceso restringido: Este expediente fue derivado a otro especialista. Solo tiene permiso de lectura.');
        this.openDetailModal(patientId);
        return;
      }

      document.getElementById('form-codigo').value = p.codigo_expediente;
      document.getElementById('form-nombres').value = p.nombres;
      document.getElementById('form-apellidos').value = p.apellidos;

      if (p.ci) {
        const parts = p.ci.trim().split(' ');
        if (parts.length >= 2) {
          document.getElementById('form-ci-num').value = parts[0];
          document.getElementById('form-ci-dep').value = parts[1].toUpperCase();
        } else {
          document.getElementById('form-ci-num').value = p.ci.trim();
          document.getElementById('form-ci-dep').value = 'CB';
        }
      } else {
        document.getElementById('form-ci-num').value = '';
        document.getElementById('form-ci-dep').value = 'CB';
      }

      document.getElementById('form-fecha-nac').value = p.fecha_nacimiento;
      document.getElementById('form-sexo').value = p.sexo;
      document.getElementById('form-colegio').value = p.colegio_ocupacion || '';
      document.getElementById('form-antecedentes-medicos').value = p.antecedentes_medicos || '';
      document.getElementById('form-antecedentes-perinatales').value = p.antecedentes_perinatales || '';

      if (p.terapeuta_id) {
        document.getElementById('form-terapeuta-id').value = p.terapeuta_id;
      }

      if (p.edad_cronologica) {
        document.getElementById('live-age-text').textContent = p.edad_cronologica.formatted;
        document.getElementById('live-age-badge').style.display = 'inline-block';
      }

      if (p.tutores && p.tutores.length > 0) {
        const primaryTutor = p.tutores.find(t => t.es_principal) || p.tutores[0];
        this.setFormSelectedTutor(primaryTutor, primaryTutor.parentesco, primaryTutor.es_principal);
      } else {
        this.setFormSelectedTutor(null);
      }

      document.getElementById('new-tutor-fields').style.display = 'none';
      document.getElementById('patient-modal-backdrop').style.display = 'flex';
      this.validateCiLive();
    } catch (err) {
      console.error(err);
      Toast.error('No se pudo cargar la información del paciente.');
    }
  }

  closePatientModal() {
    document.getElementById('patient-modal-backdrop').style.display = 'none';
  }

  setFormSelectedTutor(tutor, parentesco = 'TUTOR_LEGAL', isPrincipal = true) {
    const hiddenId = document.getElementById('form-tutor-id');
    const unselectedBox = document.getElementById('tutor-unselected-box');
    const selectedCard = document.getElementById('tutor-selected-card');
    const nameEl = document.getElementById('form-selected-tutor-name');
    const contactEl = document.getElementById('form-selected-tutor-contact');
    const badgeEl = document.getElementById('form-selected-tutor-badge');
    const parentescoSelect = document.getElementById('form-tutor-parentesco');
    const isPrincipalCheckbox = document.getElementById('form-tutor-is-principal');

    if (!tutor) {
      if (hiddenId) hiddenId.value = '';
      if (unselectedBox) unselectedBox.style.display = 'block';
      if (selectedCard) selectedCard.style.display = 'none';
      this.selectedTutorForForm = null;
      return;
    }

    this.selectedTutorForForm = tutor;
    if (hiddenId) hiddenId.value = tutor.id;
    if (unselectedBox) unselectedBox.style.display = 'none';
    if (selectedCard) selectedCard.style.display = 'block';

    if (nameEl) {
      nameEl.textContent = `${tutor.nombres} ${tutor.apellidos}`;
    }

    if (contactEl) {
      const parts = [];
      if (tutor.whatsapp) parts.push(`WhatsApp: ${tutor.whatsapp}`);
      if (tutor.ci) parts.push(`C.I.: ${tutor.ci}`);
      if (tutor.email || tutor.usuario_email) parts.push(`Email: ${tutor.email || tutor.usuario_email}`);
      contactEl.textContent = parts.join(' · ') || 'Sin información adicional de contacto';
    }

    if (badgeEl) {
      const hasWebAccount = !!(tutor.usuario_id || tutor.usuario_email);
      if (hasWebAccount) {
        badgeEl.innerHTML = `
          <span class="soft-badge soft-badge-emerald">
            <span class="soft-status-dot"></span>
            Cuenta Web Activa (${this.escapeHtml(tutor.usuario_email || tutor.email)})
          </span>
        `;
      } else {
        badgeEl.innerHTML = `
          <span class="soft-badge soft-badge-slate">
            Ficha clínica local (Sin acceso web registrado)
          </span>
        `;
      }
    }

    if (parentescoSelect) {
      parentescoSelect.value = parentesco || tutor.parentesco || 'TUTOR_LEGAL';
    }

    if (isPrincipalCheckbox) {
      isPrincipalCheckbox.checked = isPrincipal !== undefined ? !!isPrincipal : true;
    }
  }

  async openSelectTutorModalForPatientForm() {
    const modal = document.getElementById('search-tutor-modal-backdrop');
    if (!modal) return;

    this.modalTutorFilter = 'ALL';
    this.modalTutorSearchTerm = '';
    
    const searchInput = document.getElementById('modal-tutor-search-input');
    if (searchInput) searchInput.value = '';

    const clearBtn = document.getElementById('modal-tutor-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';

    // Reset tabs (Nivel 3)
    document.querySelectorAll('.btn-tutor-filter-tab').forEach(tab => {
      const isAll = tab.dataset.filter === 'ALL';
      tab.classList.toggle('active', isAll);
      tab.classList.toggle('soft-btn-lvl-3', isAll);
      tab.classList.toggle('soft-btn-lvl-2-soft', !isAll);
      tab.style.background = '';
      tab.style.color = '';
      tab.style.borderColor = '';
    });

    modal.style.display = 'flex';
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 100);
    }

    // Refrescar tutores del servidor para incluir nuevos usuarios registrados
    try {
      const res = await apiClient.get('/api/patients/tutors');
      if (res.success && Array.isArray(res.data)) {
        this.tutors = res.data;
      }
    } catch (e) {
      console.warn('Error refrescando catálogo de tutores:', e);
    }

    this.renderModalTutorList();
  }

  closeSelectTutorModal() {
    const modal = document.getElementById('search-tutor-modal-backdrop');
    if (modal) modal.style.display = 'none';
  }

  renderModalTutorList(filteredList = null) {
    const container = document.getElementById('modal-tutor-results-list');
    const countEl = document.getElementById('modal-tutor-results-count');
    const countAllEl = document.getElementById('tutor-filter-count-all');
    const countWebEl = document.getElementById('tutor-filter-count-web');
    const countClinicEl = document.getElementById('tutor-filter-count-clinic');

    if (!container) return;

    let baseList = filteredList !== null ? filteredList : (this.tutors || []);

    const totalAll = baseList.length;
    const totalWeb = baseList.filter(t => t.usuario_id || t.usuario_email).length;
    const totalClinic = totalAll - totalWeb;

    if (countAllEl) countAllEl.textContent = totalAll;
    if (countWebEl) countWebEl.textContent = totalWeb;
    if (countClinicEl) countClinicEl.textContent = totalClinic;

    // Aplicar filtro de tab
    let displayList = baseList;
    if (this.modalTutorFilter === 'WEB') {
      displayList = displayList.filter(t => t.usuario_id || t.usuario_email);
    } else if (this.modalTutorFilter === 'CLINIC_ONLY') {
      displayList = displayList.filter(t => !t.usuario_id && !t.usuario_email);
    }

    if (countEl) countEl.textContent = displayList.length;

    if (displayList.length === 0) {
      container.innerHTML = `
        <div class="soft-subcard" style="text-align: center; padding: 2.5rem 1.25rem; background: #FFFFFF; border-style: dashed;">
          <div style="font-size: 1.02rem; font-weight: 800; color: var(--soft-text-title); margin-bottom: 0.35rem;">
            No se encontraron tutores con los criterios de búsqueda
          </div>
          <p style="font-size: 0.85rem; margin-bottom: 1.1rem; color: var(--soft-text-body);">
            Puedes registrar a un nuevo tutor de inmediato e incorporarlo a este expediente.
          </p>
          <button type="button" id="btn-modal-empty-create-tutor" class="soft-btn soft-btn-lvl-3">
            ${Icons.plus(15, '#FFFFFF')}
            <span>Registrar Nuevo Tutor Ahora</span>
          </button>
        </div>
      `;

      const emptyCreateBtn = document.getElementById('btn-modal-empty-create-tutor');
      if (emptyCreateBtn) {
        emptyCreateBtn.addEventListener('click', () => {
          this.closeSelectTutorModal();
          const newTutorContainer = document.getElementById('new-tutor-fields');
          if (newTutorContainer) {
            newTutorContainer.style.display = 'block';
            document.getElementById('new-tutor-nombres')?.focus();
          }
        });
      }
      return;
    }

    const currentSelectedId = parseInt(document.getElementById('form-tutor-id')?.value, 10);

    container.innerHTML = displayList.map(tutor => {
      const isSelected = currentSelectedId === tutor.id;
      const hasWebAccount = !!(tutor.usuario_id || tutor.usuario_email);
      const pacientesList = Array.isArray(tutor.pacientes) && tutor.pacientes.length > 0
        ? tutor.pacientes.map(p => p.nombres ? `${p.nombres} ${p.apellidos}` : (p.codigo_expediente || 'Paciente')).join(', ')
        : null;

      return `
        <div class="soft-subcard tutor-card-item" style="border: 1px solid ${isSelected ? 'rgba(139, 118, 199, 0.45)' : 'var(--soft-border)'}; padding: 1rem 1.15rem; background: ${isSelected ? 'var(--soft-lavender-bg)' : '#FFFFFF'}; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <div style="flex: 1; min-width: min(100%, 240px);">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.3rem;">
              <span style="font-weight: 800; font-size: 0.96rem; color: var(--soft-text-title);">
                ${this.escapeHtml(tutor.nombres)} ${this.escapeHtml(tutor.apellidos)}
              </span>
              ${hasWebAccount ? `
                <span class="soft-badge soft-badge-emerald">
                  <span class="soft-status-dot"></span>
                  Cuenta Web Activa (${this.escapeHtml(tutor.usuario_email || tutor.email)})
                </span>
              ` : `
                <span class="soft-badge soft-badge-slate">
                  Solo Ficha Clínica
                </span>
              `}
              ${isSelected ? `
                <span class="soft-badge soft-badge-lavender">
                  Seleccionado
                </span>
              ` : ''}
            </div>

            <!-- Detalles de contacto -->
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.82rem; color: var(--soft-text-body); margin-bottom: 0.35rem;">
              <span><strong style="color: var(--soft-text-title);">WhatsApp / Tel:</strong> ${this.escapeHtml(tutor.whatsapp || 'No registrado')}</span>
              <span><strong style="color: var(--soft-text-title);">C.I.:</strong> ${this.escapeHtml(tutor.ci || 'Sin C.I.')}</span>
              ${tutor.email ? `<span><strong style="color: var(--soft-text-title);">Correo:</strong> ${this.escapeHtml(tutor.email)}</span>` : ''}
            </div>

            <!-- Pacientes ya a su cargo -->
            <div style="font-size: 0.78rem; color: var(--soft-purple-primary);">
              ${pacientesList ? `<strong>Hijos / Pacientes a cargo:</strong> ${this.escapeHtml(pacientesList)}` : `<span style="color: var(--soft-text-muted);">Sin pacientes vinculados anteriormente</span>`}
            </div>
          </div>

          <!-- Botón de Selección (Nivel 3) -->
          <div style="flex-shrink: 0;">
            ${isSelected ? `
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-select-tutor" data-tutor-id="${tutor.id}">
                ${Icons.check(14, 'var(--soft-purple-primary)')}
                <span>Seleccionado</span>
              </button>
            ` : `
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-3 btn-select-tutor" data-tutor-id="${tutor.id}">
                <span>Seleccionar Tutor</span>
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Event listener en cada botón "Seleccionar Tutor"
    container.querySelectorAll('.btn-select-tutor').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tid = parseInt(e.currentTarget.getAttribute('data-tutor-id'), 10);
        const selected = (this.tutors || []).find(t => t.id === tid);
        if (selected) {
          this.setFormSelectedTutor(selected, selected.parentesco || 'TUTOR_LEGAL', true);
          this.closeSelectTutorModal();
        }
      });
    });
  }

  async handleTutorSearch(term) {
    this.modalTutorSearchTerm = term;
    const clearBtn = document.getElementById('modal-tutor-search-clear');
    if (clearBtn) {
      clearBtn.style.display = term.trim().length > 0 ? 'inline-flex' : 'none';
    }

    if (!term || term.trim().length === 0) {
      this.renderModalTutorList(this.tutors);
      return;
    }

    const cleanTerm = term.trim();
    try {
      const res = await apiClient.get(`/api/patients/tutors?search=${encodeURIComponent(cleanTerm)}`);
      if (res.success && Array.isArray(res.data)) {
        this.renderModalTutorList(res.data);
      }
    } catch (err) {
      // Fallback a filtro local si la red falla
      const lowTerm = cleanTerm.toLowerCase();
      const localFiltered = (this.tutors || []).filter(t => {
        const fullName = `${t.nombres} ${t.apellidos}`.toLowerCase();
        return fullName.includes(lowTerm) ||
          (t.email && t.email.toLowerCase().includes(lowTerm)) ||
          (t.usuario_email && t.usuario_email.toLowerCase().includes(lowTerm)) ||
          (t.whatsapp && t.whatsapp.toLowerCase().includes(lowTerm)) ||
          (t.ci && t.ci.toLowerCase().includes(lowTerm));
      });
      this.renderModalTutorList(localFiltered);
    }
  }

  async handleQuickCreateTutor() {
    const tutNombres = document.getElementById('new-tutor-nombres')?.value.trim();
    const tutApellidos = document.getElementById('new-tutor-apellidos')?.value.trim();
    const tutWhatsapp = document.getElementById('new-tutor-whatsapp')?.value.trim();
    const tutCi = document.getElementById('new-tutor-ci')?.value.trim() || null;
    const tutEmail = document.getElementById('new-tutor-email')?.value.trim() || null;
    const tutParentesco = document.getElementById('new-tutor-parentesco')?.value || 'TUTOR_LEGAL';

    if (!tutNombres || !tutApellidos || !tutWhatsapp) {
      Toast.error('Debe ingresar al menos nombres, apellidos y número de WhatsApp para el nuevo tutor.');
      return;
    }
    const cleanPhone = tutWhatsapp.replace(/[\s\-+]/g, '');
    if (!/^(591)?[467]\d{7}$/.test(cleanPhone)) {
      Toast.error('El número de WhatsApp debe tener 8 dígitos válidos en Bolivia (ej. 71234567).');
      return;
    }

    try {
      const res = await apiClient.post('/api/patients/tutors', {
        nombres: tutNombres,
        apellidos: tutApellidos,
        whatsapp: tutWhatsapp,
        ci: tutCi,
        email: tutEmail,
        parentesco: tutParentesco
      });

      if (res.success && res.data) {
        const createdTutor = res.data;
        // Añadir a la lista local de tutores
        if (!this.tutors) this.tutors = [];
        this.tutors.unshift(createdTutor);
        // Seleccionar automáticamente en el formulario
        this.setFormSelectedTutor(createdTutor, tutParentesco, true);
        // Ocultar formulario de nuevo tutor
        const newTutorContainer = document.getElementById('new-tutor-fields');
        if (newTutorContainer) newTutorContainer.style.display = 'none';
        // Limpiar campos
        ['new-tutor-nombres', 'new-tutor-apellidos', 'new-tutor-whatsapp', 'new-tutor-ci', 'new-tutor-email'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        Toast.success(`Tutor ${createdTutor.nombres} ${createdTutor.apellidos} registrado y seleccionado.`);
      }
    } catch (err) {
      console.error('Error registrando nuevo tutor:', err);
      Toast.error(err.message || 'Error al registrar el tutor.');
    }
  }

  // MODAL DERIVAR
  async openDerivarModal(patientId) {
    try {
      const res = await apiClient.get(`/api/patients/${patientId}`);
      if (!res.success) throw new Error();
      const p = res.data;

      this.patientToDerive = p;
      document.getElementById('derivar-patient-id').value = p.id;
      document.getElementById('derivar-patient-summary').textContent = `${p.codigo_expediente} · ${p.nombres} ${p.apellidos}`;
      document.getElementById('derivar-current-therapist').textContent = `Terapeuta actual: ${p.terapeuta_nombre ? `Lic. ${p.terapeuta_nombre}` : 'Sin asignar'}`;

      // Filtrar terapeuta destino para excluir el actual
      const selectDestino = document.getElementById('derivar-destino-id');
      if (selectDestino) {
        const available = this.therapists.filter(t => t.id !== p.terapeuta_id);
        selectDestino.innerHTML = `<option value="">-- Seleccionar Especialista Receptor --</option>` +
          available.map(t => `<option value="${t.id}">Lic. ${t.nombres} ${t.apellidos} - ${t.especialidad_nombre} (${t.registro_profesional})</option>`).join('');
      }

      document.getElementById('derivar-form').reset();
      const motivoTextarea = document.getElementById('derivar-motivo');
      if (motivoTextarea) motivoTextarea.value = '';
      document.getElementById('derivar-modal-backdrop').style.display = 'flex';
    } catch (err) {
      Toast.error('No se pudo abrir el asistente de derivación.');
    }
  }

  closeDerivarModal() {
    document.getElementById('derivar-modal-backdrop').style.display = 'none';
    this.patientToDerive = null;
  }

  async handleSubmitDerivar(e) {
    e.preventDefault();
    const patientId = document.getElementById('derivar-patient-id').value;
    const destinoId = document.getElementById('derivar-destino-id').value;
    const motivoTextarea = document.getElementById('derivar-motivo');
    const motivoFinal = motivoTextarea ? motivoTextarea.value.trim() : '';
    const notas = document.getElementById('derivar-notas').value.trim();
    const reasignar = document.getElementById('derivar-reasignar-principal').checked;

    if (!destinoId) {
      Toast.error('Debe seleccionar el terapeuta especialista de destino.');
      return;
    }

    if (!motivoFinal) {
      Toast.error('Debe especificar el motivo clínico de la derivación.');
      return;
    }

    try {
      const res = await apiClient.post(`/api/patients/${patientId}/derivar`, {
        terapeuta_destino_id: parseInt(destinoId, 10),
        motivo: motivoFinal,
        notas,
        reasignar_principal: reasignar
      });

      if (res.success) {
        Toast.success('Paciente derivado interdisciplinariamente con éxito.');
        this.closeDerivarModal();
        await this.loadPatients();
      }
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Error al procesar la derivación.');
    }
  }

  // MODAL ARCHIVAR
  openArchiveModal(patientId, code, name) {
    this.patientToArchive = { id: patientId, code, name };
    document.getElementById('archive-patient-id').value = patientId;
    document.getElementById('archive-patient-code').textContent = `${code} (${name})`;
    document.getElementById('archive-form').reset();
    const motivoTextarea = document.getElementById('archive-motivo');
    if (motivoTextarea) motivoTextarea.value = '';
    document.getElementById('archive-modal-backdrop').style.display = 'flex';
    setTimeout(() => {
      if (motivoTextarea) motivoTextarea.focus();
    }, 100);
  }

  closeArchiveModal() {
    document.getElementById('archive-modal-backdrop').style.display = 'none';
    this.patientToArchive = null;
  }

  async handleSubmitArchive(e) {
    e.preventDefault();
    const patientId = document.getElementById('archive-patient-id').value;
    const motivoTextarea = document.getElementById('archive-motivo');
    const motivoFinal = motivoTextarea ? motivoTextarea.value.trim() : '';

    if (!motivoFinal) {
      Toast.error('Debe especificar o redactar el motivo de la baja clínica.');
      return;
    }

    try {
      const res = await apiClient.delete(`/api/patients/${patientId}`, {
        body: { motivo: motivoFinal }
      });

      if (res.success) {
        Toast.success('Expediente archivado en el histórico del centro.');
        this.closeArchiveModal();
        await this.loadPatients();
      }
    } catch (err) {
      Toast.error(err.message || 'Error al archivar el expediente.');
    }
  }

  async handleRestorePatient(patientId, code, name) {
    if (!confirm(`¿Desea restaurar el expediente [${code}] de ${name} y reincorporarlo al flujo activo del centro?`)) {
      return;
    }

    try {
      const res = await apiClient.put(`/api/patients/${patientId}/restore`);
      if (res.success) {
        Toast.success(`Expediente ${code} restaurado exitosamente.`);
        await this.loadPatients();
      }
    } catch (err) {
      Toast.error(err.message || 'Error al restaurar el expediente.');
    }
  }

  // MODAL DETALLE Y FICHA OFICIAL (NIVEL 2)
  async openDetailModal(patientId) {
    try {
      const res = await apiClient.get(`/api/patients/${patientId}`);
      if (!res.success) throw new Error();

      const p = res.data;
      const content = document.getElementById('detail-modal-content');
      const terapeutaInactivo = p.terapeuta_activo === 0;
      const isOriginalTherapistDerived = this.user?.rol === 'TERAPEUTA' && !p.es_titular_actual;

      content.innerHTML = `
        <!-- Aviso de caso derivado para terapeuta inicial -->
        ${isOriginalTherapistDerived ? `
          <div class="soft-subcard" style="background: var(--soft-lavender-bg); border-color: var(--soft-border-hover); padding: 0.85rem 1.05rem; margin-bottom: 1.15rem; display: flex; align-items: flex-start; gap: 0.75rem;">
            <span style="color: var(--soft-purple-primary); margin-top: 2px;">${Icons.lock(18, 'var(--soft-purple-primary)')}</span>
            <div>
              <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.88rem;">Expediente Clínico Derivado (Solo Lectura)</div>
              <div style="font-size: 0.78rem; color: var(--soft-text-body); line-height: 1.45; margin-top: 0.2rem;">
                Usted aperturó o atendió este paciente inicialmente. Tras su derivación formal, la titularidad clínica activa pertenece al especialista receptor. Sus registros históricos permanecen inalterados en el expediente.
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Barra Superior: Botón de Impresión Oficial Membretada y Acceso a Historia -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.1rem; border-bottom: 1px dashed var(--soft-divider); padding-bottom: 0.85rem; flex-wrap: wrap; gap: 0.65rem;">
          <div style="font-size: 0.8rem; color: var(--soft-text-body);">
            Aperturado por: <strong style="color: var(--soft-text-title);">${p.creador_nombre || 'Sistema'}</strong>
          </div>
          <div style="display: flex; gap: 0.55rem; align-items: center; flex-wrap: wrap;">
            ${['ADMIN', 'TERAPEUTA'].includes(this.user?.rol) ? `
              <a href="#/clinical-records?patientId=${p.id}" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="text-decoration: none;">
                ${Icons.stethoscope(15, 'var(--soft-purple-primary)')}
                <span>Historia Clínica & SOAP</span>
              </a>
              <a href="#/clinical-records?patientId=${p.id}&tab=consents" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="text-decoration: none;" title="Firma de Consentimiento Informado (RN-03)">
                ${Icons.signature(15, 'var(--soft-purple-primary)')}
                <span>Consentimiento (RN-03)</span>
              </a>
              <a href="#/clinical-records?patientId=${p.id}&tab=reports" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="text-decoration: none;" title="Informes en Word (.docx)">
                ${Icons.fileWord(15, 'var(--soft-purple-primary)')}
                <span>Informes Word</span>
              </a>
            ` : (['RECEPCION'].includes(this.user?.rol) ? `
              <a href="#/clinical-records?patientId=${p.id}&tab=consents" class="soft-btn soft-btn-sm soft-btn-lvl-2" style="text-decoration: none;" title="Firma de Consentimiento en Tablet de Recepción">
                ${Icons.signature(15, '#FFFFFF')}
                <span>Firmar Consentimiento</span>
              </a>
            ` : '')}
            <button id="btn-print-patient-card" type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2">
              ${Icons.printer(15, '#FFFFFF')}
              <span>Imprimir Ficha Clínica</span>
            </button>
          </div>
        </div>

        <div style="display: flex; gap: 1.15rem; align-items: center; margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid var(--soft-divider);">
          <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender">
            ${Icons.patient(28, 'var(--soft-purple-primary)')}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
              <span class="soft-badge soft-badge-lavender"><span class="soft-status-dot"></span>${p.codigo_expediente}</span>
              <span class="soft-badge ${p.sexo === 'F' ? 'soft-badge-lavender' : 'soft-badge-mint'}">${p.sexo === 'F' ? 'Femenino' : 'Masculino'}</span>
              ${p.activo === 0 ? '<span class="soft-badge soft-badge-rose">Archivado</span>' : ''}
            </div>
            <h2 style="margin: 0.3rem 0 0.15rem 0; color: var(--soft-text-title); font-size: 1.32rem; font-weight: 800; letter-spacing: -0.02em;">${p.nombres} ${p.apellidos}</h2>
            <div style="font-size: 0.84rem; color: var(--soft-text-body);">
              C.I.: <strong style="color: var(--soft-text-title);">${p.ci || 'Sin C.I.'}</strong> · Nacimiento: <strong style="color: var(--soft-text-title);">${p.fecha_nacimiento}</strong> (${p.edad_cronologica ? p.edad_cronologica.formatted : '--'})
            </div>
          </div>
        </div>

        <!-- Ficha de Asignación del Terapeuta -->
        <div class="soft-subcard" style="padding: 0.95rem 1.1rem; margin-bottom: 1.15rem; background: var(--soft-lavender-surface);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-text-muted);">Terapeuta de Cabecera Asignado</div>
              <div style="font-size: 0.98rem; font-weight: 800; color: var(--soft-text-title); margin-top: 0.15rem;">
                ${p.terapeuta_nombre ? `Lic. ${p.terapeuta_nombre}` : '<span style="color: var(--soft-text-muted); font-weight: 500;">Sin terapeuta asignado</span>'}
              </div>
              <div style="font-size: 0.78rem; color: var(--soft-purple-primary); font-weight: 600; margin-top: 0.1rem;">
                ${p.terapeuta_especialidad || 'Especialista'} · Matrícula: <strong>${p.terapeuta_registro || 'CPB'}</strong>
              </div>
            </div>
            ${terapeutaInactivo ? `
              <span class="soft-badge soft-badge-rose">
                ${Icons.alertTriangle(13, '#B91C1C')}
                <span>Profesional inactivo en el centro</span>
              </span>
            ` : ''}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
          <div class="soft-subcard" style="padding: 1rem 1.1rem; background: #FFFFFF;">
            <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-text-muted); margin-bottom: 0.3rem;">Unidad Educativa / Actividad</div>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--soft-text-title);">${p.colegio_ocupacion || 'No especificado'}</div>
          </div>

          <div class="soft-subcard" style="padding: 1rem 1.1rem; background: #FFFFFF;">
            <div style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-text-muted); margin-bottom: 0.3rem;">Estado Clínico</div>
            <span class="soft-badge soft-badge-emerald"><span class="soft-status-dot"></span>${p.estado_clinico}</span>
          </div>
        </div>

        <!-- HISTORIAL DE DERIVACIONES CLÍNICAS INTERDISCIPLINARIAS -->
        <div style="margin-bottom: 1.25rem;">
          <h4 style="color: var(--soft-text-title); font-size: 0.92rem; font-weight: 800; margin: 0 0 0.65rem 0; display: flex; align-items: center; gap: 0.45rem;">
            <span style="color: var(--soft-mint-deep); display: inline-flex;">${Icons.share(17, 'var(--soft-mint-deep)')}</span>
            <span>Historial de Derivaciones Interdisciplinarias</span>
            <span class="soft-badge soft-badge-mint">${p.derivaciones ? p.derivaciones.length : 0}</span>
          </h4>
          ${p.derivaciones && p.derivaciones.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
              ${p.derivaciones.map(d => `
                <div class="soft-subcard" style="padding: 0.85rem 1.05rem; background: var(--soft-lavender-surface);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; font-size: 0.82rem; flex-wrap: wrap; gap: 0.4rem;">
                    <span style="font-weight: 700; color: var(--soft-text-title); display: inline-flex; align-items: center;">
                      De: Lic. ${d.terapeuta_origen_nombre || 'Centro'} <span style="display: inline-flex; align-items: center; margin: 0 0.35rem;">${Icons.arrowRight(13, 'var(--soft-purple-primary)')}</span> A: Lic. ${d.terapeuta_destino_nombre} (${d.especialidad_destino || 'Especialista'})
                    </span>
                    <span style="color: var(--soft-text-muted); font-size: 0.75rem;">${d.fecha_derivacion ? d.fecha_derivacion.slice(0, 16) : ''}</span>
                  </div>
                  <div style="font-size: 0.84rem; color: var(--soft-purple-primary); font-weight: 700;">
                    Motivo: ${d.motivo}
                  </div>
                  ${d.notas ? `
                    <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.2rem; font-style: italic;">
                      "${d.notas}"
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="soft-subcard" style="font-size: 0.84rem; color: var(--soft-text-body); margin: 0; background: var(--soft-lavender-surface); padding: 0.7rem 0.95rem;">
              Este expediente no ha requerido derivaciones interdisciplinarias adicionales.
            </div>
          `}
        </div>

        <!-- Tutores Vinculados -->
        <div style="margin-bottom: 1.25rem;">
          <h4 style="color: var(--soft-text-title); font-size: 0.92rem; font-weight: 800; margin: 0 0 0.65rem 0; display: flex; align-items: center; gap: 0.45rem;">
            <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.family(17, 'var(--soft-purple-primary)')}</span>
            <span>Tutores Responsables</span>
            <span class="soft-badge soft-badge-lavender">${p.tutores ? p.tutores.length : 0}</span>
          </h4>
          ${p.tutores && p.tutores.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
              ${p.tutores.map(t => `
                <div class="soft-subcard" style="background: #FFFFFF; padding: 0.8rem 1.05rem; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.92rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                      <span>${t.nombres} ${t.apellidos}</span>
                      <span class="soft-badge soft-badge-lavender">${t.parentesco_vinculo || t.parentesco}</span>
                      ${t.es_principal ? `<span class="soft-badge soft-badge-emerald"><span class="soft-status-dot"></span>Principal</span>` : ''}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--soft-text-body); margin-top: 0.2rem;">
                      C.I.: ${t.ci || 'N/A'} · ${t.ocupacion || ''}
                    </div>
                  </div>
                  <a href="https://wa.me/${t.whatsapp.replace(/\D/g, '')}" target="_blank" rel="noopener noreferrer" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="text-decoration: none;">
                    ${Icons.phone(14, 'var(--soft-emerald-text)')}
                    <span>${t.whatsapp}</span>
                  </a>
                </div>
              `).join('')}
            </div>
          ` : `
            <p style="font-size: 0.85rem; color: var(--soft-text-muted); margin: 0;">No tiene tutores vinculados aún.</p>
          `}
        </div>

        <!-- Hermanos / Red Familiar Unificada -->
        <div style="margin-bottom: 1.25rem;">
          <h4 style="color: var(--soft-text-title); font-size: 0.92rem; font-weight: 800; margin: 0 0 0.65rem 0; display: flex; align-items: center; gap: 0.45rem;">
            <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.users(17, 'var(--soft-purple-primary)')}</span>
            <span>Hermanos Registrados en el Centro (Unificación Familiar)</span>
          </h4>
          ${p.hermanos && p.hermanos.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${p.hermanos.map(h => `
                <div class="soft-subcard" style="background: var(--soft-lavender-bg); border-style: dashed; padding: 0.7rem 0.95rem; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <strong style="color: var(--soft-text-title);">${h.nombres} ${h.apellidos}</strong>
                    <span style="font-size: 0.78rem; color: var(--soft-purple-primary); font-weight: 700; margin-left: 0.45rem;">[${h.codigo_expediente}]</span>
                  </div>
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-jump-sibling" data-id="${h.id}">
                    Ver Hermano
                  </button>
                </div>
              `).join('')}
            </div>
          ` : `
            <p style="font-size: 0.85rem; color: var(--soft-text-muted); margin: 0;">No se detectaron hermanos con el mismo tutor registrado.</p>
          `}
        </div>

        <!-- Antecedentes Médicos y Perinatales -->
        <div class="soft-subcard" style="padding: 1rem 1.15rem; margin-bottom: 0.5rem; background: var(--soft-lavender-surface);">
          <div style="font-size: 0.82rem; font-weight: 800; color: var(--soft-text-title); margin-bottom: 0.3rem;">Antecedentes Médicos y Alergias:</div>
          <p style="font-size: 0.85rem; color: var(--soft-text-body); margin: 0 0 0.8rem 0; line-height: 1.5;">${p.antecedentes_medicos || 'Sin antecedentes reportados'}</p>
          
          <div style="font-size: 0.82rem; font-weight: 800; color: var(--soft-text-title); margin-bottom: 0.3rem;">Desarrollo Neurocognitivo / Perinatal:</div>
          <p style="font-size: 0.85rem; color: var(--soft-text-body); margin: 0; line-height: 1.5;">${p.antecedentes_perinatales || 'Sin antecedentes perinatales reportados'}</p>
        </div>
      `;

      // Evento de impresión oficial
      const printBtn = content.querySelector('#btn-print-patient-card');
      if (printBtn) {
        printBtn.addEventListener('click', () => {
          this.printPatientSheet(p);
        });
      }

      // Listener para saltar a la ficha de un hermano
      content.querySelectorAll('.btn-jump-sibling').forEach(b => {
        b.addEventListener('click', (e) => {
          const sibId = e.currentTarget.getAttribute('data-id');
          this.openDetailModal(sibId);
        });
      });

      document.getElementById('detail-modal-backdrop').style.display = 'flex';
    } catch (err) {
      console.error(err);
      Toast.error('No se pudo abrir la ficha clínica.');
    }
  }

  printPatientSheet(p) {
    const todayStr = new Date().toLocaleDateString('es-BO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const tutoresHtml = p.tutores && p.tutores.length > 0 
      ? p.tutores.map((t, idx) => `
        <tr style="border-bottom: 1px solid #cbd5e1;">
          <td style="padding: 3px 6px; font-weight: 700; color: #0f172a;">${idx + 1}. ${t.nombres} ${t.apellidos}</td>
          <td style="padding: 3px 6px; color: #334155;">${t.parentesco_vinculo || t.parentesco || 'Tutor'} ${t.es_principal ? '(Principal)' : ''}</td>
          <td style="padding: 3px 6px; color: #334155;">C.I. ${t.ci || 'N/A'}</td>
          <td style="padding: 3px 6px; color: #334155;">${t.whatsapp || t.telefono || 'Sin teléfono'}</td>
          <td style="padding: 3px 6px; color: #475569;">${t.ocupacion || 'No especificada'}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="5" style="padding: 6px; color: #64748b; text-align: center;">No tiene tutores registrados</td></tr>`;

    const hermanosHtml = p.hermanos && p.hermanos.length > 0
      ? p.hermanos.map(h => `<strong style="color: #27345F;">${h.nombres} ${h.apellidos}</strong> (${h.codigo_expediente})`).join(' &nbsp;·&nbsp; ')
      : 'No se registran hermanos activos bajo la misma tutela familiar.';

    const instAddress = store.getState().publicConfig?.INSTITUCION_DIRECCION || 'Calle Ladislao Cabrera entre Calle Antezana y Calle 16 de Julio, Cochabamba, Bolivia';
    const instPhone = store.getState().publicConfig?.INSTITUCION_TELEFONO || '+591 4 4521234';
    const instNombre = store.getState().publicConfig?.INSTITUCION_NOMBRE || 'PSI APRENDE';

    const contentHtml = `
      <div style="page-break-inside: avoid; break-inside: avoid; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <!-- CABECERA INSTITUCIONAL OFICIAL -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #27345F; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="/assets/logo-brand.png" alt="PSI Aprende" style="height: 38px; width: auto;" />
            <div>
              <div style="font-size: 11pt; font-weight: 800; color: #27345F; letter-spacing: 0.3px;">CENTRO "${this.escapeHtml(instNombre)}"</div>
              <div style="font-size: 7.5pt; color: #475569; font-weight: 600;">Centro Psicopedagógico y de Atención Psicológica Integral</div>
              <div style="font-size: 7.2pt; color: #64748b;">${this.escapeHtml(instAddress)} · Telf: ${this.escapeHtml(instPhone)}</div>
            </div>
          </div>
          <div style="text-align: right; border: 1.5px solid #27345F; border-radius: 6px; padding: 4px 10px; background: #f8fafc;">
            <div style="font-size: 7pt; text-transform: uppercase; font-weight: 700; color: #64748b;">Código Institucional</div>
            <div style="font-size: 11pt; font-weight: 800; color: #27345F;">${p.codigo_expediente}</div>
            <div style="font-size: 7pt; color: #475569;">Emisión: ${todayStr}</div>
          </div>
        </div>

        <div style="text-align: center; margin-bottom: 8px;">
          <h2 style="font-size: 11pt; font-weight: 800; color: #27345F; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
            FICHA CLÍNICA DE FILIACIÓN Y EXPEDIENTE
          </h2>
          <div style="font-size: 7.5pt; color: #64748b; margin-top: 1px;">
            Registro Oficial de Admisión y Red Familiar · Sistema Web PWA "${this.escapeHtml(instNombre)}"
          </div>
        </div>

        <!-- 1. DATOS GENERALES -->
        <div style="margin-bottom: 8px;">
          <div style="font-size: 8.5pt; font-weight: 800; color: #27345F; background: #f1f5f9; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 4px; text-transform: uppercase;">
            1. Datos Demográficos y Asignación Clínica
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 8pt; line-height: 1.25;">
            <tr>
              <td style="padding: 2px 6px; width: 22%; font-weight: 700; color: #475569;">Nombres y Apellidos:</td>
              <td style="padding: 2px 6px; width: 44%; font-weight: 700; color: #0f172a; font-size: 8.5pt;">${p.nombres} ${p.apellidos}</td>
              <td style="padding: 2px 6px; width: 16%; font-weight: 700; color: #475569;">Cédula Identidad:</td>
              <td style="padding: 2px 6px; width: 18%; font-weight: 700; color: #0f172a;">${p.ci || 'Sin C.I.'}</td>
            </tr>
            <tr>
              <td style="padding: 2px 6px; font-weight: 700; color: #475569;">Fecha de Nacimiento:</td>
              <td style="padding: 2px 6px; color: #0f172a;">${p.fecha_nacimiento}</td>
              <td style="padding: 2px 6px; font-weight: 700; color: #475569;">Sexo Biológico:</td>
              <td style="padding: 2px 6px; color: #0f172a;">${p.sexo === 'F' ? 'Femenino (F)' : (p.sexo === 'M' ? 'Masculino (M)' : 'Otro')}</td>
            </tr>
            <tr>
              <td style="padding: 2px 6px; font-weight: 700; color: #475569;">Edad Cronológica:</td>
              <td style="padding: 2px 6px; font-weight: 800; color: #0284c7;">${p.edad_cronologica ? p.edad_cronologica.formatted : '--'}</td>
              <td style="padding: 2px 6px; font-weight: 700; color: #475569;">Estado Clínico:</td>
              <td style="padding: 2px 6px; font-weight: 700; color: #059669;">${p.estado_clinico}</td>
            </tr>
            <tr>
              <td style="padding: 2px 6px; font-weight: 700; color: #475569;">Terapeuta Asignado:</td>
              <td style="padding: 2px 6px; color: #27345F; font-weight: 700;">${p.terapeuta_nombre ? `Lic. ${p.terapeuta_nombre} (${p.terapeuta_especialidad || 'Especialista'})` : 'Sin asignar'}</td>
              <td style="padding: 2px 6px; font-weight: 700; color: #475569;">Matrícula CPB:</td>
              <td style="padding: 2px 6px; color: #0f172a; font-weight: 700;">${p.terapeuta_registro || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 2px 6px; font-weight: 700; color: #475569;">Aperturado por:</td>
              <td colspan="3" style="padding: 2px 6px; color: #475569;">${p.creador_nombre || 'Sistema'} · Archivo confidencial registrado</td>
            </tr>
          </table>
        </div>

        <!-- 2. RED FAMILIAR -->
        <div style="margin-bottom: 8px;">
          <div style="font-size: 8.5pt; font-weight: 800; color: #27345F; background: #f1f5f9; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 4px; text-transform: uppercase;">
            2. Red Familiar y Tutores Legales Responsables
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 7.8pt; border: 1px solid #cbd5e1; margin-bottom: 4px; line-height: 1.25;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 1.5px solid #cbd5e1; text-align: left; color: #475569;">
                <th style="padding: 3px 6px;">Tutor Legal</th>
                <th style="padding: 3px 6px;">Parentesco</th>
                <th style="padding: 3px 6px;">Cédula</th>
                <th style="padding: 3px 6px;">WhatsApp / Teléfono</th>
                <th style="padding: 3px 6px;">Ocupación</th>
              </tr>
            </thead>
            <tbody>
              ${tutoresHtml}
            </tbody>
          </table>

          <div style="font-size: 7.5pt; background: #faf5ff; border: 1px dashed #c084fc; padding: 4px 8px; border-radius: 4px;">
            <strong style="color: #4E3A70;">Hermanos Vinculados en el Centro:</strong> ${hermanosHtml}
          </div>
        </div>

        <!-- 3. ANTECEDENTES CLÍNICOS -->
        <div style="margin-bottom: 8px;">
          <div style="font-size: 8.5pt; font-weight: 800; color: #27345F; background: #f1f5f9; padding: 3px 6px; border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 4px; text-transform: uppercase;">
            3. Antecedentes Médicos y del Neurodesarrollo
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 7.8pt; line-height: 1.22;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 4px;">
                <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 8px; background: #ffffff; min-height: 38px;">
                  <div style="font-weight: 700; color: #334155; margin-bottom: 1px;">Antecedentes Médicos, Alergias y Medicación:</div>
                  <div style="color: #475569;">${p.antecedentes_medicos || 'Sin antecedentes patológicos relevantes reportados.'}</div>
                </div>
              </td>
              <td style="width: 50%; vertical-align: top; padding-left: 4px;">
                <div style="border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 8px; background: #ffffff; min-height: 38px;">
                  <div style="font-weight: 700; color: #334155; margin-bottom: 1px;">Desarrollo Madurativo y Perinatal:</div>
                  <div style="color: #475569;">${p.antecedentes_perinatales || 'Desarrollo madurativo reportado dentro de parámetros esperados.'}</div>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- 4. FIRMAS OFICIALES CON ESPACIO DESPEJADO -->
        <div style="margin-top: 24px; padding-top: 12px; border-top: 1px dashed #cbd5e1; page-break-inside: avoid; break-inside: avoid;">
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 7.8pt;">
            <tr>
              <td style="width: 45%; vertical-align: bottom; padding: 0 10px;">
                <!-- Espacio vertical despejado para firma y sello manual del terapeuta -->
                <div style="height: 55px;"></div>
                <div style="border-top: 1.5px solid #27345F; padding-top: 4px;">
                  <strong style="color: #0f172a; font-size: 8.5pt;">Firma del Terapeuta Responsable</strong>
                  <div style="color: #475569; font-size: 7.5pt; margin-top: 1px;">Especialista Acreditado · Colegio de Psicólogos de Bolivia (CPB)</div>
                  <div style="color: #64748b; font-size: 7pt;">Centro "${this.escapeHtml(instNombre)}" · ${this.escapeHtml(instAddress.split(',')[0])}</div>
                </div>
              </td>
              <td style="width: 10%;"></td>
              <td style="width: 45%; vertical-align: bottom; padding: 0 10px;">
                <!-- Espacio vertical despejado para firma manual del tutor legal -->
                <div style="height: 55px;"></div>
                <div style="border-top: 1.5px solid #27345F; padding-top: 4px;">
                  <strong style="color: #0f172a; font-size: 8.5pt;">Firma del Padre de Familia / Tutor Legal</strong>
                  <div style="color: #475569; font-size: 7.5pt; margin-top: 1px;">Aceptación y Veracidad de Información Filiatoria</div>
                  <div style="color: #64748b; font-size: 7pt;">C.I.: ___________________________</div>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- PIE DE PÁGINA -->
        <div style="margin-top: 12px; text-align: center; font-size: 7pt; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 4px;">
          Documento oficial generado por la Plataforma Web PWA "${this.escapeHtml(instNombre)}" · Ley 164 de Telecomunicaciones y TICs de Bolivia · Confidencialidad Sanitaria y Ética Biomédica Protegida.
        </div>
      </div>
    `;

    printIsolatedDocument({
      title: `Ficha Clinica - ${p.codigo_expediente}`,
      contentHtml
    });
  }

  closeDetailModal() {
    document.getElementById('detail-modal-backdrop').style.display = 'none';
  }

  async handleSubmitPatient(e) {
    e.preventDefault();

    const id = document.getElementById('patient-id').value;
    const codigo_expediente = document.getElementById('form-codigo').value;
    const nombres = document.getElementById('form-nombres').value.trim();
    const apellidos = document.getElementById('form-apellidos').value.trim();
    const ciNum = document.getElementById('form-ci-num').value.trim();
    const ciDep = document.getElementById('form-ci-dep').value;
    const ci = ciNum ? (ciDep ? `${ciNum} ${ciDep}` : ciNum) : null;
    const fecha_nacimiento = document.getElementById('form-fecha-nac').value;
    const sexo = document.getElementById('form-sexo').value;
    const colegio_ocupacion = document.getElementById('form-colegio').value.trim();
    const antecedentes_medicos = document.getElementById('form-antecedentes-medicos').value.trim();
    const antecedentes_perinatales = document.getElementById('form-antecedentes-perinatales').value.trim();
    const terapeutaId = document.getElementById('form-terapeuta-id').value;

    // Validaciones estrictas
    if (!nombres || !apellidos || !fecha_nacimiento) {
      Toast.error('Por favor complete los nombres, apellidos y fecha de nacimiento.');
      return;
    }

    if (!ci) {
      Toast.error('La Cédula de Identidad (C.I.) es obligatoria para el expediente.');
      document.getElementById('form-ci-num').focus();
      return;
    }

    if (!terapeutaId) {
      Toast.error('Debe seleccionar el terapeuta especialista de cabecera.');
      document.getElementById('form-terapeuta-id').focus();
      return;
    }

    const payload = {
      codigo_expediente,
      nombres,
      apellidos,
      ci,
      fecha_nacimiento,
      sexo,
      colegio_ocupacion,
      antecedentes_medicos,
      antecedentes_perinatales,
      terapeuta_id: parseInt(terapeutaId, 10)
    };

    // Tutor nuevo o existente
    const newTutorContainer = document.getElementById('new-tutor-fields');
    if (newTutorContainer && newTutorContainer.style.display !== 'none') {
      const tutNombres = document.getElementById('new-tutor-nombres').value.trim();
      const tutApellidos = document.getElementById('new-tutor-apellidos').value.trim();
      const tutWhatsapp = document.getElementById('new-tutor-whatsapp').value.trim();
      const tutParentesco = document.getElementById('new-tutor-parentesco').value;

      if (!tutNombres || !tutApellidos || !tutWhatsapp) {
        Toast.error('Para registrar al nuevo tutor debe ingresar nombres, apellidos y número de WhatsApp.');
        return;
      }
      const cleanTutPhone = tutWhatsapp.replace(/[\s\-+]/g, '');
      if (!/^(591)?[467]\d{7}$/.test(cleanTutPhone)) {
        Toast.error('El WhatsApp del tutor debe ser un número válido de 8 dígitos en Bolivia.');
        return;
      }

      try {
        const resTutor = await apiClient.post('/api/patients/tutors', {
          nombres: tutNombres,
          apellidos: tutApellidos,
          whatsapp: tutWhatsapp,
          parentesco: tutParentesco
        });

        if (resTutor.success) {
          payload.tutor_id = resTutor.data.id;
          payload.tutor_parentesco = tutParentesco;
          payload.tutor_es_principal = 1;
        }
      } catch (err) {
        Toast.error('Error al registrar el tutor: ' + (err.message || ''));
        return;
      }
    } else {
      const tutorId = document.getElementById('form-tutor-id').value;
      if (tutorId) {
        payload.tutor_id = parseInt(tutorId, 10);
        payload.tutor_parentesco = document.getElementById('form-tutor-parentesco')?.value || 'TUTOR_LEGAL';
        payload.tutor_es_principal = document.getElementById('form-tutor-is-principal')?.checked ? 1 : 0;
      }
    }

    try {
      let res;
      if (this.isEditing && id) {
        res = await apiClient.put(`/api/patients/${id}`, payload);
        if (payload.tutor_id) {
          try {
            await apiClient.post(`/api/patients/${id}/tutors`, {
              tutor_id: payload.tutor_id,
              parentesco: payload.tutor_parentesco || 'TUTOR_LEGAL',
              es_principal: payload.tutor_es_principal !== undefined ? payload.tutor_es_principal : 1
            });
          } catch (tutorErr) {
            console.warn('[PatientsView] Error al vincular tutor en edición:', tutorErr);
          }
        }
      } else {
        res = await apiClient.post('/api/patients', payload);
      }

      if (res.success) {
        Toast.success(this.isEditing ? 'Expediente actualizado exitosamente.' : 'Expediente clínico aperturado con éxito.');
        this.closePatientModal();
        await this.loadPatients();
      }
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Ocurrió un error al guardar el expediente.');
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
      await this.loadPatients();
    } catch (err) {
      Toast.error('No se pudo desvincular el tutor: ' + (err.message || 'Error desconocido'));
    }
  }

  async openLinkTutorModal(patientId, patientName, patientCode, currentTutor = null) {
    let modalBackdrop = document.getElementById('link-tutor-modal-backdrop');
    if (modalBackdrop) modalBackdrop.remove();

    modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'link-tutor-modal-backdrop';
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.style.cssText = 'display: flex; z-index: 2000;';

    modalBackdrop.innerHTML = `
      <div class="soft-modal-card" style="max-width: 650px; width: 100%; max-height: 90vh;">
        
        <!-- CABECERA DEL MODAL (NIVEL 2) -->
        <div style="padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.family(20, 'var(--soft-purple-primary)')}
            </div>
            <div>
              <h3 style="color: var(--soft-text-title); font-size: 1.14rem; font-weight: 800; margin: 0 0 0.15rem 0; letter-spacing: -0.015em;">
                Vincular Tutor al Expediente
              </h3>
              <div style="font-size: 0.78rem; color: var(--soft-text-body);">
                Paciente: <strong style="color: var(--soft-text-title);">${this.escapeHtml(patientName)}</strong> (${this.escapeHtml(patientCode)})
              </div>
            </div>
          </div>
          <button type="button" id="btn-close-link-tutor-modal" class="soft-modal-close-btn" aria-label="Cerrar">
            ${Icons.x(18)}
          </button>
        </div>

        <!-- CUERPO DEL MODAL (SCROLLABLE) -->
        <div style="padding: 1.35rem 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.15rem;">
          
          ${currentTutor ? `
            <div class="soft-subcard" style="background: var(--soft-mint-bg); border-color: var(--soft-mint-border); padding: 0.9rem 1.1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
              <div>
                <div style="font-size: 0.72rem; font-weight: 800; color: var(--soft-mint-deep); text-transform: uppercase; letter-spacing: 0.04em;">Tutor Actualmente Vinculado</div>
                <div style="font-size: 0.95rem; font-weight: 800; color: var(--soft-text-title); margin-top: 0.15rem;">${this.escapeHtml(currentTutor.nombres)} ${this.escapeHtml(currentTutor.apellidos)} (${this.escapeHtml(currentTutor.parentesco_vinculo || currentTutor.parentesco || 'TUTOR')})</div>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                  WhatsApp: ${this.escapeHtml(currentTutor.whatsapp)} ${currentTutor.usuario_email ? `· Cuenta web: ${this.escapeHtml(currentTutor.usuario_email)}` : ''}
                </div>
              </div>
              <button type="button" id="btn-unlink-current-modal" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="color: #B91C1C; flex-shrink: 0;">
                Desvincular
              </button>
            </div>
          ` : ''}

          <!-- BUSCADOR EN VIVO DE TUTORES -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; gap: 0.5rem; flex-wrap: wrap;">
              <label class="soft-label" style="margin: 0;">
                Buscar Tutor Registrado
              </label>
              <button type="button" id="btn-toggle-create-tutor-inline" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="padding: 0.28rem 0.68rem; font-size: 0.75rem;">
                + Registrar Nuevo Tutor
              </button>
            </div>
            <div class="soft-search-box">
              <span class="soft-search-box-icon">
                ${Icons.search(16)}
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
          <div id="tutors-search-results-list" style="display: flex; flex-direction: column; gap: 0.55rem; max-height: 210px; overflow-y: auto; padding: 0.25rem;">
            <div style="text-align: center; padding: 1.5rem; color: var(--soft-text-muted); font-size: 0.85rem;">
              Cargando tutores disponibles...
            </div>
          </div>

          <!-- TUTOR SELECCIONADO PARA ASIGNAR -->
          <div id="selected-tutor-container" class="soft-subcard" style="display: none; background: var(--soft-lavender-bg); border-color: var(--soft-border-hover); padding: 1rem 1.15rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; gap: 0.75rem; flex-wrap: wrap;">
              <div>
                <span class="soft-badge soft-badge-lavender" style="margin-bottom: 0.3rem;">
                  <span class="soft-status-dot"></span>
                  Tutor Seleccionado para Vincular
                </span>
                <div id="selected-tutor-name" style="font-size: 1.02rem; font-weight: 800; color: var(--soft-text-title);"></div>
                <div id="selected-tutor-contact" style="font-size: 0.82rem; color: var(--soft-text-body); margin-top: 0.15rem;"></div>
                <div id="selected-tutor-account-status" style="margin-top: 0.35rem;"></div>
              </div>
              <button type="button" id="btn-cancel-selected-tutor" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="padding: 0.28rem 0.65rem; font-size: 0.75rem;">
                Cambiar Selección
              </button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 0.75rem; border-top: 1px dashed var(--soft-divider); padding-top: 0.75rem;">
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
                  <input type="checkbox" id="check-is-principal" checked style="accent-color: var(--soft-purple-primary);" />
                  <span>¿Es el Tutor Principal?</span>
                </label>
              </div>
            </div>
          </div>

          <!-- FORMULARIO DESPLEGABLE: CREAR NUEVO TUTOR AL VUELO -->
          <div id="create-tutor-inline-panel" class="soft-subcard" style="display: none; background: var(--soft-lavender-surface); border-style: dashed; padding: 1.05rem 1.15rem;">
            <div style="font-size: 0.88rem; font-weight: 800; color: var(--soft-text-title); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
              <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.plus(16, 'var(--soft-purple-primary)')}</span>
              <span>Registrar Nuevo Tutor en el Centro</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-bottom: 0.65rem;">
              <div>
                <label class="soft-label">Nombres *</label>
                <input type="text" id="new-tutor-inline-nombres" class="soft-input" placeholder="Ej: Carlos" />
              </div>
              <div>
                <label class="soft-label">Apellidos *</label>
                <input type="text" id="new-tutor-inline-apellidos" class="soft-input" placeholder="Ej: Fuentes Mendoza" />
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-bottom: 0.65rem;">
              <div>
                <label class="soft-label">WhatsApp * (8 dígitos)</label>
                <input type="text" id="new-tutor-inline-whatsapp" class="soft-input" placeholder="Ej: 71234567" />
              </div>
              <div>
                <label class="soft-label">C.I. (Opcional)</label>
                <input type="text" id="new-tutor-inline-ci" class="soft-input" placeholder="Ej: 4892011 CB" />
              </div>
            </div>
            <div style="margin-bottom: 0.85rem;">
              <label class="soft-label">Correo Electrónico (Para sincronizar cuenta web)</label>
              <input type="email" id="new-tutor-inline-email" class="soft-input" placeholder="Ej: tutor@gmail.com" />
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
              <button type="button" id="btn-cancel-create-tutor-inline" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">Cancelar</button>
              <button type="button" id="btn-save-new-tutor-inline" class="soft-btn soft-btn-sm soft-btn-lvl-2">Crear y Seleccionar</button>
            </div>
          </div>

        </div>

        <!-- PIE DEL MODAL (NIVEL 2) -->
        <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; gap: 0.75rem; background: #FFFFFF;">
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

      selectedContainer.style.display = 'block';
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
            <div class="soft-subcard" style="text-align: center; padding: 1.5rem; background: var(--soft-lavender-surface); border-style: dashed;">
              <div style="font-size: 0.86rem; color: var(--soft-text-body); margin-bottom: 0.5rem;">
                No se encontraron tutores coincidentes con "${this.escapeHtml(query)}"
              </div>
              <button type="button" id="btn-launch-inline-create" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">
                + Registrar a este tutor ahora
              </button>
            </div>
          `;
          document.getElementById('btn-launch-inline-create')?.addEventListener('click', () => {
            const inlinePanel = document.getElementById('create-tutor-inline-panel');
            if (inlinePanel) {
              inlinePanel.style.display = 'block';
              document.getElementById('new-tutor-inline-nombres')?.focus();
            }
          });
          return;
        }

        resultsList.innerHTML = tutors.map(t => {
          const isCurrent = currentTutor && currentTutor.id === t.id;
          const hasAccount = Boolean(t.usuario_email || (t.usuario_id && t.email) || t.usuario_id);

          return `
            <div class="soft-subcard tutor-search-item" data-id="${t.id}" style="background: #FFFFFF; padding: 0.8rem 0.95rem; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                  <strong style="color: var(--soft-text-title); font-size: 0.9rem; font-weight: 800;">
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
                <div style="font-size: 0.76rem; color: var(--soft-text-body); margin-top: 0.2rem;">
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
          <div style="text-align: center; padding: 1rem; color: #B91C1C; font-size: 0.8rem;">
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
      inlineCreatePanel.style.display = isVisible ? 'none' : 'block';
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
        await this.loadPatients();
      } catch (err) {
        Toast.error('Error al vincular tutor: ' + (err.message || 'Error desconocido'));
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Vinculación al Expediente';
      }
    });
  }
}
