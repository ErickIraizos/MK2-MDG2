import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';

export class AdminWorkshopsView {
  constructor(container) {
    this.container = container;
    this.workshops = [];
    this.therapists = [];
    this.stats = { total: 0, activos: 0, inactivos: 0, cuposTotales: 0, cuposOcupados: 0 };
    this.searchQuery = '';
    this.selectedTipo = 'TODOS';
    this.selectedEstado = 'TODOS';
    this.currentEditingId = null;
    this.isLoading = false;
  }

  escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/[()]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-container panel-general">
        
        <!-- ENCABEZADO DE ADMINISTRACIÓN SOFT UI MÉDICA -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.calendar(13, 'var(--soft-purple-primary)')}
                <span>Módulo F · Formación & Cartelera Psicoeducativa</span>
              </span>
              <span class="soft-location-label">Centro PSI Aprende · Cochabamba</span>
            </div>
            <h1 class="soft-page-title">Gestión de Talleres, Cursos & Webinars</h1>
            <p class="soft-page-subtitle" style="max-width: 780px;">
              Programa y publica las actividades formativas del centro. Asigna un terapeuta principal a cargo para que los tutores se inscriban directamente a su número de WhatsApp sin intermediarios ni números estáticos.
            </p>
          </div>

          <div class="soft-header-actions" style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <a 
              href="#/portal/talleres" 
              class="soft-btn soft-btn-lvl-1-muted"
              style="text-decoration: none;"
              title="Ver cómo lo visualizan los tutores"
            >
              ${Icons.eye(16, 'var(--soft-purple-primary)')}
              <span>Ver Cartelera de Familias</span>
            </a>

            <button 
              type="button"
              id="btn-open-create-workshop" 
              class="soft-btn soft-btn-lvl-1"
            >
              ${Icons.plus(16, '#FFFFFF')}
              <span>Nuevo Taller o Evento</span>
            </button>
          </div>
        </div>

        <!-- TARJETAS DE ESTADÍSTICAS KPI -->
        <div class="soft-kpi-grid" style="margin-bottom: 1.5rem;">
          <div class="soft-kpi-card">
            <span class="soft-status-dot-green"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.calendar(22, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Total Eventos</span>
              <div id="admin-kpi-total-talleres" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Talleres en catálogo</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.check(22, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Publicados Activos</span>
              <div id="admin-kpi-activos-talleres" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Visibles en cartelera</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <div class="soft-icon-box soft-icon-box-indigo">
              ${Icons.users(22, 'var(--soft-indigo-accent)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Cupos Ocupados</span>
              <div id="admin-kpi-cupos-talleres" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Inscripciones registradas</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <div class="soft-icon-box" style="background: #F1F5F9; color: var(--soft-text-body);">
              ${Icons.video(22, 'var(--soft-text-body)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Modalidad Mixta</span>
              <div id="admin-kpi-modalidad-talleres" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Presencial y En Línea</div>
            </div>
          </div>
        </div>

        <!-- BARRA DE BÚSQUEDA Y FILTROS -->
        <div class="soft-card-static" style="padding: 1.15rem 1.45rem; margin-bottom: 1.5rem;">
          <div style="display: flex; flex-wrap: wrap; gap: 0.85rem; justify-content: space-between; align-items: center;">
            <div style="flex: 1; min-width: min(100%, 250px); position: relative;">
              <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: var(--soft-text-muted);">
                ${Icons.search(16, 'var(--soft-text-muted)')}
              </span>
              <input 
                type="text" 
                id="admin-workshops-search" 
                placeholder="Buscar por título, expositor, temario o terapeuta..." 
                class="soft-input" 
                style="padding-left: 2.35rem; width: 100%;"
              />
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <select id="admin-filter-estado-talleres" class="soft-select" style="font-size: 0.85rem; padding: 0.5rem 0.85rem;">
                <option value="TODOS">Todos los Estados</option>
                <option value="ACTIVOS">Solo Publicados</option>
                <option value="INACTIVOS">Solo en Pausa</option>
              </select>

              <select id="admin-filter-tipo-talleres" class="soft-select" style="font-size: 0.85rem; padding: 0.5rem 0.85rem;">
                <option value="TODOS">Todas las Modalidades</option>
                <option value="Presencial">Solo Presenciales</option>
                <option value="Virtual">Solo Virtuales</option>
              </select>
            </div>
          </div>
        </div>

        <!-- CUADRÍCULA DE TALLERES ADMINISTRATIVOS (2 PANELES POR FILA) -->
        <div id="admin-workshops-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 1.6rem;">
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--soft-text-body);">
            <div class="soft-spinner" style="margin: 0 auto 1rem auto;"></div>
            <p>Cargando lista de talleres y facilitadores clínicos...</p>
          </div>
        </div>

      </div>

      <!-- MODAL DE CREACIÓN / EDICIÓN DE TALLER -->
      <div id="admin-workshop-modal-backdrop" class="modal-backdrop" style="display: none;">
        <div class="soft-modal-card" style="max-width: 780px; max-height: 94vh; display: flex; flex-direction: column; overflow: hidden; background: #FFFFFF; border-radius: 24px; border: 1px solid rgba(139, 114, 214, 0.22); box-shadow: 0 24px 50px -10px rgba(50, 40, 95, 0.45);">
          
          <!-- CABECERA MODAL -->
          <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 0.8rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.calendar(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 id="admin-workshop-modal-title" style="margin: 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.015em;">
                  Crear Nuevo Taller o Evento
                </h3>
                <span style="font-size: 0.77rem; color: var(--soft-purple-primary); font-weight: 600;">
                  Asignación directa de terapeuta y canal de WhatsApp para inscripciones
                </span>
              </div>
            </div>
            <button id="btn-close-workshop-modal" type="button" class="soft-modal-close-btn" aria-label="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- CUERPO DEL FORMULARIO CON SCROLL -->
          <form id="form-admin-workshop" style="padding: 1.6rem 1.85rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.25rem;">
            <input type="hidden" id="workshop-form-id" />

            <!-- SECCIÓN: ASIGNACIÓN DE TERAPEUTA RESPONSABLE -->
            <div style="background: linear-gradient(135deg, rgba(88,66,148,0.06) 0%, rgba(21,150,141,0.06) 100%); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.15rem 1.35rem;">
              <div style="font-size: 0.82rem; font-weight: 800; color: var(--soft-purple-primary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
                ${Icons.therapist(16, 'var(--soft-purple-primary)')}
                <span>Terapeuta Principal a Cargo &amp; WhatsApp de Admisiones</span>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 1rem;">
                <div>
                  <label class="soft-label" for="workshop-terapeuta-select">
                    Terapeuta Principal del Centro *
                  </label>
                  <select id="workshop-terapeuta-select" class="soft-select" style="width: 100%;" required>
                    <option value="">Seleccione un especialista...</option>
                  </select>
                  <div style="font-size: 0.73rem; color: var(--soft-text-muted); margin-top: 0.25rem;">
                    Al elegir un especialista, se vinculará su número registrado de WhatsApp automáticamente.
                  </div>
                </div>

                <div>
                  <label class="soft-label" for="workshop-telefono-input">
                    WhatsApp para Inscripciones *
                  </label>
                  <div style="position: relative;">
                    <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: var(--soft-mint-deep);">
                      ${Icons.whatsapp(16, 'var(--soft-mint-deep)')}
                    </span>
                    <input 
                      type="text" 
                      id="workshop-telefono-input" 
                      class="soft-input" 
                      placeholder="+591 70000000" 
                      style="padding-left: 2.4rem;" 
                      required 
                    />
                  </div>
                  <div style="font-size: 0.73rem; color: var(--soft-text-muted); margin-top: 0.25rem;">
                    Número al que llegarán las reservas directas de los tutores.
                  </div>
                </div>
              </div>

              <!-- LÍNEA DE EXPOSITOR VISIBLE -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 1rem; margin-top: 0.9rem;">
                <div>
                  <label class="soft-label" for="workshop-expositor-nombre">
                    Nombre Visible del Expositor o Equipo
                  </label>
                  <input 
                    type="text" 
                    id="workshop-expositor-nombre" 
                    class="soft-input" 
                    placeholder="Ej. Lic. Grisel Aguilar y Lic. Claudia Morales" 
                  />
                  <div style="font-size: 0.73rem; color: var(--soft-text-muted); margin-top: 0.25rem;">
                    Permite indicar varios profesionales si el taller es interdisciplinario.
                  </div>
                </div>

                <div>
                  <label class="soft-label" for="workshop-expositor-cargo">
                    Cargo o Especialidad del Facilitador
                  </label>
                  <input 
                    type="text" 
                    id="workshop-expositor-cargo" 
                    class="soft-input" 
                    placeholder="Ej. Especialistas en Neuropsicología y Fonoaudiología" 
                  />
                </div>
              </div>
            </div>

            <!-- SECCIÓN: DETALLES DEL EVENTO -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 1rem;">
              <div style="grid-column: 1 / -1;">
                <label class="soft-label" for="workshop-titulo">
                  Título del Taller o Evento *
                </label>
                <input 
                  type="text" 
                  id="workshop-titulo" 
                  class="soft-input" 
                  placeholder="Ej. Taller Práctico: Crianza Respetuosa y Manejo de Berrinches" 
                  required 
                />
              </div>

              <div style="grid-column: 1 / -1;">
                <label class="soft-label" for="workshop-subtitulo">
                  Subtítulo u Objetivo Central
                </label>
                <input 
                  type="text" 
                  id="workshop-subtitulo" 
                  class="soft-input" 
                  placeholder="Ej. Estrategias neurocognitivas de contención y calma para niños de 3 a 8 años" 
                />
              </div>

              <div>
                <label class="soft-label" for="workshop-tipo">
                  Modalidad *
                </label>
                <select id="workshop-tipo" class="soft-select" style="width: 100%;" required>
                  <option value="Presencial">Presencial en Sede</option>
                  <option value="Virtual">Virtual en Línea</option>
                </select>
              </div>

              <div>
                <label class="soft-label" for="workshop-categoria">
                  Población / Categoría *
                </label>
                <select id="workshop-categoria" class="soft-select" style="width: 100%;" required>
                  <option value="Padres">Padres de Familia</option>
                  <option value="Docentes & Padres">Docentes &amp; Padres</option>
                  <option value="Padres & Niños">Padres &amp; Niños</option>
                  <option value="Adultos Mayores">Adultos Mayores</option>
                  <option value="Docentes">Docentes y Colegios</option>
                  <option value="Comunidad">Comunidad en General</option>
                </select>
              </div>

              <div>
                <label class="soft-label" for="workshop-fecha">
                  Fecha Programada *
                </label>
                <input 
                  type="text" 
                  id="workshop-fecha" 
                  class="soft-input" 
                  placeholder="Ej. Sábado 28 de Noviembre de 2026" 
                  required 
                />
              </div>

              <div>
                <label class="soft-label" for="workshop-hora">
                  Horario *
                </label>
                <input 
                  type="text" 
                  id="workshop-hora" 
                  class="soft-input" 
                  placeholder="Ej. 09:30 a 11:30" 
                  required 
                />
              </div>

              <div>
                <label class="soft-label" for="workshop-lugar">
                  Lugar o Plataforma *
                </label>
                <input 
                  type="text" 
                  id="workshop-lugar" 
                  class="soft-input" 
                  placeholder="Ej. Sede PSI Aprende · Consultorio 1 o Google Meet" 
                  required 
                />
              </div>

              <div>
                <label class="soft-label" for="workshop-direccion">
                  Dirección o Enlace Informativo
                </label>
                <input 
                  type="text" 
                  id="workshop-direccion" 
                  class="soft-input" 
                  placeholder="Ej. Calle Ladislao Cabrera e/ Antezana y 16 de Julio" 
                />
              </div>

              <div>
                <label class="soft-label" for="workshop-arancel">
                  Arancel o Inversión *
                </label>
                <input 
                  type="text" 
                  id="workshop-arancel" 
                  class="soft-input" 
                  placeholder="Ej. 50 Bs o Entrada Libre" 
                  required 
                />
              </div>

              <div>
                <label class="soft-label" for="workshop-arancel-detalle">
                  Detalle del Arancel
                </label>
                <input 
                  type="text" 
                  id="workshop-arancel-detalle" 
                  class="soft-input" 
                  placeholder="Ej. Incluye cuadernillo de pautas para el hogar" 
                />
              </div>

              <div>
                <label class="soft-label" for="workshop-cupos-totales">
                  Cupos Totales *
                </label>
                <input 
                  type="number" 
                  id="workshop-cupos-totales" 
                  class="soft-input" 
                  value="15" 
                  min="1" 
                  required 
                />
              </div>

              <div>
                <label class="soft-label" for="workshop-cupos-ocupados">
                  Cupos Ocupados Actualmente
                </label>
                <input 
                  type="number" 
                  id="workshop-cupos-ocupados" 
                  class="soft-input" 
                  value="0" 
                  min="0" 
                />
              </div>

              <div style="grid-column: 1 / -1;">
                <label class="soft-label" for="workshop-dirigido-a">
                  Población Específica a la que va Dirigido
                </label>
                <input 
                  type="text" 
                  id="workshop-dirigido-a" 
                  class="soft-input" 
                  placeholder="Ej. Padres de familia, madres y cuidadores de niños en etapa preescolar." 
                />
              </div>

              <div style="grid-column: 1 / -1;">
                <label class="soft-label" for="workshop-temas">
                  Temario y Puntos Clave · Ingrese un punto por línea
                </label>
                <textarea 
                  id="workshop-temas" 
                  class="soft-textarea" 
                  rows="4" 
                  placeholder="¿Por qué ocurren las rabietas? Funcionamiento del cerebro infantil.&#10;Diferencia entre berrinche y sobrecarga sensorial.&#10;Pautas de co-regulación para padres."
                ></textarea>
              </div>
            </div>

            <!-- INTERRUPTORES DE ESTADO Y DESTACADO -->
            <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; padding-top: 0.5rem; border-top: 1px solid var(--soft-divider);">
              <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.88rem; font-weight: 600; color: var(--soft-text-title);">
                <input type="checkbox" id="workshop-check-activo" checked style="width: 17px; height: 17px; accent-color: var(--soft-purple-primary);" />
                <span>Publicar inmediatamente en la cartelera de tutores</span>
              </label>

              <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.88rem; font-weight: 600; color: var(--soft-text-title);">
                <input type="checkbox" id="workshop-check-destacado" style="width: 17px; height: 17px; accent-color: var(--soft-purple-primary);" />
                <span>Marcar como Evento Destacado</span>
              </label>
            </div>

            <!-- PIE CON BOTONES DE ACCIÓN -->
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid var(--soft-divider); flex-shrink: 0;">
              <button type="button" id="btn-cancel-workshop-modal" class="soft-btn soft-btn-lvl-1-muted">
                Cancelar
              </button>
              <button type="submit" id="btn-submit-workshop" class="soft-btn soft-btn-lvl-1">
                ${Icons.check(15, '#FFFFFF')}
                <span>Guardar Taller</span>
              </button>
            </div>

          </form>

        </div>
      </div>
    `;

    this.attachEvents();
    await this.loadInitialData();
  }

  attachEvents() {
    // Buscador
    const searchInput = this.container.querySelector('#admin-workshops-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderGrid();
      });
    }

    // Filtros
    const filterEstado = this.container.querySelector('#admin-filter-estado-talleres');
    if (filterEstado) {
      filterEstado.addEventListener('change', (e) => {
        this.selectedEstado = e.target.value;
        this.renderGrid();
      });
    }

    const filterTipo = this.container.querySelector('#admin-filter-tipo-talleres');
    if (filterTipo) {
      filterTipo.addEventListener('change', (e) => {
        this.selectedTipo = e.target.value;
        this.renderGrid();
      });
    }

    // Botón abrir modal de creación
    const btnOpenCreate = this.container.querySelector('#btn-open-create-workshop');
    if (btnOpenCreate) {
      btnOpenCreate.addEventListener('click', () => {
        this.openCreateModal();
      });
    }

    // Eventos del modal
    const modalBackdrop = this.container.querySelector('#admin-workshop-modal-backdrop');
    const btnCloseModal = this.container.querySelector('#btn-close-workshop-modal');
    const btnCancelModal = this.container.querySelector('#btn-cancel-workshop-modal');

    const closeModal = () => {
      if (modalBackdrop) modalBackdrop.style.display = 'none';
      this.currentEditingId = null;
    };

    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    // Cambio de terapeuta principal en el modal
    const terapeutaSelect = this.container.querySelector('#workshop-terapeuta-select');
    if (terapeutaSelect) {
      terapeutaSelect.addEventListener('change', (e) => {
        const id = Number(e.target.value);
        const selected = this.therapists.find(t => t.id === id);
        if (selected) {
          const phoneInput = this.container.querySelector('#workshop-telefono-input');
          const expositorInput = this.container.querySelector('#workshop-expositor-nombre');
          const cargoInput = this.container.querySelector('#workshop-expositor-cargo');

          if (phoneInput && selected.telefono) {
            phoneInput.value = selected.telefono;
          }
          if (expositorInput && !expositorInput.value.trim()) {
            expositorInput.value = `Lic. ${selected.nombres} ${selected.apellidos}`;
          }
          if (cargoInput && !cargoInput.value.trim()) {
            cargoInput.value = selected.especialidad_nombre || 'Especialista en Neuropsicología y Psicopedagogía';
          }
        }
      });
    }

    // Envío del formulario
    const form = this.container.querySelector('#form-admin-workshop');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      });
    }
  }

  async loadInitialData() {
    this.isLoading = true;
    try {
      // 1. Cargar terapeutas para el selector
      const therRes = await apiClient.get('/therapists');
      if (therRes && therRes.data) {
        this.therapists = therRes.data;
        this.populateTherapistsSelect();
      }

      // 2. Cargar talleres administrativos
      await this.loadWorkshops();
    } catch (err) {
      console.error('[AdminWorkshopsView] Error cargando datos iniciales:', err);
      Toast.error('No se pudo cargar la información de talleres.');
    } finally {
      this.isLoading = false;
    }
  }

  populateTherapistsSelect() {
    const select = this.container.querySelector('#workshop-terapeuta-select');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccione un especialista responsable...</option>' + 
      this.therapists.map(t => `
        <option value="${t.id}" data-phone="${this.escapeHtml(t.telefono || '')}">
          Lic. ${this.escapeHtml(t.nombres)} ${this.escapeHtml(t.apellidos)} · ${this.escapeHtml(t.registro_profesional || 'CPB')}
        </option>
      `).join('');
  }

  async loadWorkshops() {
    try {
      const res = await apiClient.get('/workshops/admin/all');
      if (res && res.success) {
        this.workshops = res.data || [];
        this.stats = res.stats || { total: 0, activos: 0, inactivos: 0, cuposTotales: 0, cuposOcupados: 0 };
        this.updateKpis();
        this.renderGrid();
      }
    } catch (err) {
      console.error('[AdminWorkshopsView] Error cargando talleres:', err);
      Toast.error('Error al sincronizar talleres desde el servidor.');
    }
  }

  updateKpis() {
    const totalEl = this.container.querySelector('#admin-kpi-total-talleres');
    const activosEl = this.container.querySelector('#admin-kpi-activos-talleres');
    const cuposEl = this.container.querySelector('#admin-kpi-cupos-talleres');
    const modEl = this.container.querySelector('#admin-kpi-modalidad-talleres');

    if (totalEl) totalEl.textContent = `${this.stats.total} Eventos`;
    if (activosEl) activosEl.textContent = `${this.stats.activos} Activos`;
    if (cuposEl) cuposEl.textContent = `${this.stats.cuposOcupados} / ${this.stats.cuposTotales}`;
    if (modEl) modEl.textContent = `${this.stats.presenciales || 0} Pres · ${this.stats.virtuales || 0} Virt`;
  }

  renderGrid() {
    const grid = this.container.querySelector('#admin-workshops-grid');
    if (!grid) return;

    const filtered = this.workshops.filter(item => {
      // Filtro de estado
      if (this.selectedEstado === 'ACTIVOS' && item.activo !== 1) return false;
      if (this.selectedEstado === 'INACTIVOS' && item.activo !== 0) return false;

      // Filtro de tipo
      if (this.selectedTipo !== 'TODOS' && item.tipo !== this.selectedTipo) return false;

      // Filtro de búsqueda
      if (this.searchQuery) {
        const query = this.searchQuery;
        const inTitulo = item.titulo && item.titulo.toLowerCase().includes(query);
        const inSub = item.subtitulo && item.subtitulo.toLowerCase().includes(query);
        const inExpositor = item.expositor_display && item.expositor_display.toLowerCase().includes(query);
        const inTemas = item.temas && item.temas.some(t => t.toLowerCase().includes(query));
        if (!inTitulo && !inSub && !inExpositor && !inTemas) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem; background: #FFFFFF; border-radius: 20px; border: 1px dashed rgba(88, 66, 148, 0.25);">
          <div style="margin-bottom: 0.75rem; color: var(--soft-purple-primary);">
            ${Icons.calendar(44, 'var(--soft-purple-primary)')}
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.35rem;">
            No se encontraron eventos con los filtros seleccionados
          </h3>
          <p style="color: var(--soft-text-body); font-size: 0.9rem; max-width: 480px; margin: 0 auto;">
            Prueba ajustando los criterios de búsqueda o pulsa "Nuevo Taller o Evento" para programar una nueva actividad.
          </p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(item => this._renderWorkshopCard(item)).join('');
    this.attachCardEvents();
  }

  _renderWorkshopCard(item) {
    const isActivo = item.activo === 1;
    const isDestacado = item.destacado === 1;
    const pctOcupado = item.cupos_totales > 0 ? Math.round((item.cupos_ocupados / item.cupos_totales) * 100) : 0;
    const cleanPhone = item.telefono_final ? String(item.telefono_final).replace(/[\s\-\+]/g, '') : '';
    const whatsappLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('591') ? cleanPhone : '591' + cleanPhone}` : null;

    const temasList = Array.isArray(item.temas) ? item.temas.slice(0, 3) : [];

    return `
      <div class="soft-card-static" style="display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border-radius: 22px; padding: 0; opacity: ${isActivo ? '1' : '0.78'}; border: ${isDestacado ? '1.5px solid var(--soft-purple-primary)' : '1px solid var(--soft-border-card-inner)'};">
        
        <!-- CUERPO SUPERIOR -->
        <div style="padding: 1.6rem 1.8rem 1.25rem 1.8rem;">
          
          <!-- BADGES SUPERIORES -->
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.85rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span class="soft-badge ${item.tipo === 'Virtual' ? 'soft-badge-mint' : 'soft-badge-lavender'}" style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">
                ${item.tipo === 'Virtual' ? Icons.video(12, 'currentColor') : Icons.building(12, 'currentColor')}
                <span>${this.escapeHtml(item.tipo)}</span>
              </span>

              <span class="soft-badge soft-badge-indigo" style="font-size: 0.72rem; font-weight: 700;">
                ${this.escapeHtml(item.categoria)}
              </span>

              ${isDestacado ? `
                <span class="soft-badge soft-badge-amber" style="font-size: 0.72rem; font-weight: 700;">
                  ${Icons.star(12, '#D97706')}
                  <span>Destacado</span>
                </span>
              ` : ''}
            </div>

            <span class="soft-badge ${isActivo ? 'soft-badge-emerald' : 'soft-badge-gray'}" style="font-size: 0.72rem; font-weight: 700;">
              ${isActivo ? 'Publicado' : 'En Pausa'}
            </span>
          </div>

          <!-- TÍTULO Y SUBTÍTULO -->
          <h3 style="margin: 0 0 0.4rem 0; font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em; line-height: 1.35;">
            ${this.escapeHtml(item.titulo)}
          </h3>

          ${item.subtitulo ? `
            <p style="margin: 0 0 0.85rem 0; font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.5;">
              ${this.escapeHtml(item.subtitulo)}
            </p>
          ` : ''}

          <!-- TERAPEUTA A CARGO Y WHATSAPP VINCULADO -->
          <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.85rem 1.05rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.85rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div style="width: 38px; height: 38px; border-radius: 12px; background: var(--soft-purple-primary); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; flex-shrink: 0;">
                ${item.terapeuta_nombres ? item.terapeuta_nombres.charAt(0) + (item.terapeuta_apellidos ? item.terapeuta_apellidos.charAt(0) : '') : 'TP'}
              </div>
              <div>
                <span style="font-size: 0.71rem; color: var(--soft-text-overline); font-weight: 700; text-transform: uppercase;">Terapeuta a Cargo:</span>
                <div style="font-size: 0.88rem; font-weight: 800; color: var(--soft-text-title);">
                  ${this.escapeHtml(item.expositor_display)}
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="color: var(--soft-mint-deep);">${Icons.whatsapp(16, 'var(--soft-mint-deep)')}</span>
              <span style="font-size: 0.84rem; font-weight: 700; color: var(--soft-text-title);">${this.escapeHtml(item.telefono_final || 'Sin número')}</span>
            </div>
          </div>

          <!-- DATOS LOGÍSTICOS -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 0.65rem; font-size: 0.82rem; color: var(--soft-text-body); margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="color: var(--soft-purple-primary); flex-shrink: 0;">${Icons.calendar(14, 'var(--soft-purple-primary)')}</span>
              <span><strong>Fecha:</strong> ${this.escapeHtml(item.fecha)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="color: var(--soft-mint-deep); flex-shrink: 0;">${Icons.clock(14, 'var(--soft-mint-deep)')}</span>
              <span><strong>Horario:</strong> ${this.escapeHtml(item.hora)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="color: var(--soft-purple-primary); flex-shrink: 0;">${Icons.mapPin(14, 'var(--soft-purple-primary)')}</span>
              <span><strong>Lugar:</strong> ${this.escapeHtml(item.lugar)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span style="color: var(--soft-mint-deep); flex-shrink: 0;">${Icons.wallet(14, 'var(--soft-mint-deep)')}</span>
              <span><strong>Arancel:</strong> ${this.escapeHtml(item.arancel)}</span>
            </div>
          </div>

          <!-- BARRA DE OCUPACIÓN DE CUPOS -->
          <div style="margin-bottom: 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.35rem;">
              <span>Inscripciones Registradas:</span>
              <span>${item.cupos_ocupados} de ${item.cupos_totales} cupos (${pctOcupado}%)</span>
            </div>
            <div style="width: 100%; height: 7px; background: rgba(88,66,148,0.1); border-radius: 4px; overflow: hidden;">
              <div style="width: ${Math.min(pctOcupado, 100)}%; height: 100%; background: linear-gradient(90deg, var(--soft-mint-deep) 0%, var(--soft-purple-primary) 100%); border-radius: 4px;"></div>
            </div>
          </div>

          <!-- TEMARIO RESUMIDO -->
          ${temasList.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.79rem; color: var(--soft-text-body); border-top: 1px dashed var(--soft-divider); padding-top: 0.65rem;">
              ${temasList.map(t => `
                <div style="display: flex; align-items: flex-start; gap: 0.45rem;">
                  <span style="color: var(--soft-mint-deep); flex-shrink: 0; margin-top: 2px;">${Icons.check(12, 'var(--soft-mint-deep)')}</span>
                  <span style="line-height: 1.4;">${this.escapeHtml(t)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

        </div>

        <!-- ACCIONES DE GESTIÓN ADMINISTRATIVA -->
        <div style="padding: 0.95rem 1.6rem 1.15rem 1.6rem; display: flex; gap: 0.55rem; border-top: 1px solid var(--soft-divider); background: var(--soft-lavender-surface); align-items: center; justify-content: space-between; flex-wrap: wrap;">
          
          <div style="display: flex; gap: 0.5rem;">
            <button 
              type="button" 
              class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-edit-workshop" 
              data-id="${item.id}"
              title="Modificar taller o reasignar terapeuta"
            >
              ${Icons.edit(14, '#FFFFFF')}
              <span>Editar</span>
            </button>

            <button 
              type="button" 
              class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-toggle-workshop" 
              data-id="${item.id}"
              title="${isActivo ? 'Pausar evento para que no sea visible' : 'Publicar evento en cartelera'}"
            >
              ${isActivo ? Icons.lock(14, 'currentColor') : Icons.check(14, 'currentColor')}
              <span>${isActivo ? 'Pausar' : 'Publicar'}</span>
            </button>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            ${whatsappLink ? `
              <a 
                href="${whatsappLink}" 
                target="_blank" 
                rel="noopener noreferrer" 
                class="soft-btn soft-btn-sm soft-btn-lvl-1-muted"
                title="Probar chat de WhatsApp asignado"
                style="text-decoration: none;"
              >
                ${Icons.whatsapp(14, 'var(--soft-mint-deep)')}
                <span>Chat</span>
              </a>
            ` : ''}

            <button 
              type="button" 
              class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-delete-workshop" 
              data-id="${item.id}"
              title="Eliminar este taller"
              style="color: #DC2626;"
            >
              ${Icons.trash(14, 'currentColor')}
            </button>
          </div>

        </div>

      </div>
    `;
  }

  attachCardEvents() {
    // Editar
    const editBtns = this.container.querySelectorAll('.btn-edit-workshop');
    editBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.dataset.id);
        this.openEditModal(id);
      });
    });

    // Activar / Pausar
    const toggleBtns = this.container.querySelectorAll('.btn-toggle-workshop');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        await this.handleToggle(id);
      });
    });

    // Eliminar
    const deleteBtns = this.container.querySelectorAll('.btn-delete-workshop');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        await this.handleDelete(id);
      });
    });
  }

  openCreateModal() {
    this.currentEditingId = null;
    const modal = this.container.querySelector('#admin-workshop-modal-backdrop');
    const title = this.container.querySelector('#admin-workshop-modal-title');
    const form = this.container.querySelector('#form-admin-workshop');

    if (title) title.textContent = 'Crear Nuevo Taller o Evento';
    if (form) form.reset();

    const idInput = this.container.querySelector('#workshop-form-id');
    if (idInput) idInput.value = '';

    const checkActivo = this.container.querySelector('#workshop-check-activo');
    if (checkActivo) checkActivo.checked = true;

    const checkDestacado = this.container.querySelector('#workshop-check-destacado');
    if (checkDestacado) checkDestacado.checked = false;

    if (modal) modal.style.display = 'flex';
  }

  openEditModal(id) {
    const item = this.workshops.find(w => w.id === id);
    if (!item) return;

    this.currentEditingId = id;
    const modal = this.container.querySelector('#admin-workshop-modal-backdrop');
    const title = this.container.querySelector('#admin-workshop-modal-title');

    if (title) title.textContent = `Editar Taller: ${item.titulo}`;

    const idInput = this.container.querySelector('#workshop-form-id');
    if (idInput) idInput.value = item.id;

    const selectTerapeuta = this.container.querySelector('#workshop-terapeuta-select');
    if (selectTerapeuta) selectTerapeuta.value = item.terapeuta_principal_id || '';

    const phoneInput = this.container.querySelector('#workshop-telefono-input');
    if (phoneInput) phoneInput.value = item.telefono_contacto || item.telefono_final || '';

    const expositorInput = this.container.querySelector('#workshop-expositor-nombre');
    if (expositorInput) expositorInput.value = item.expositor_nombre || '';

    const cargoInput = this.container.querySelector('#workshop-expositor-cargo');
    if (cargoInput) cargoInput.value = item.expositor_cargo || '';

    const tituloInput = this.container.querySelector('#workshop-titulo');
    if (tituloInput) tituloInput.value = item.titulo || '';

    const subtituloInput = this.container.querySelector('#workshop-subtitulo');
    if (subtituloInput) subtituloInput.value = item.subtitulo || '';

    const tipoSelect = this.container.querySelector('#workshop-tipo');
    if (tipoSelect) tipoSelect.value = item.tipo || 'Presencial';

    const categoriaSelect = this.container.querySelector('#workshop-categoria');
    if (categoriaSelect) categoriaSelect.value = item.categoria || 'Padres';

    const fechaInput = this.container.querySelector('#workshop-fecha');
    if (fechaInput) fechaInput.value = item.fecha || '';

    const horaInput = this.container.querySelector('#workshop-hora');
    if (horaInput) horaInput.value = item.hora || '';

    const lugarInput = this.container.querySelector('#workshop-lugar');
    if (lugarInput) lugarInput.value = item.lugar || '';

    const direccionInput = this.container.querySelector('#workshop-direccion');
    if (direccionInput) direccionInput.value = item.direccion || '';

    const arancelInput = this.container.querySelector('#workshop-arancel');
    if (arancelInput) arancelInput.value = item.arancel || '';

    const arancelDetalleInput = this.container.querySelector('#workshop-arancel-detalle');
    if (arancelDetalleInput) arancelDetalleInput.value = item.arancel_detalle || '';

    const cuposTotalesInput = this.container.querySelector('#workshop-cupos-totales');
    if (cuposTotalesInput) cuposTotalesInput.value = item.cupos_totales || 15;

    const cuposOcupadosInput = this.container.querySelector('#workshop-cupos-ocupados');
    if (cuposOcupadosInput) cuposOcupadosInput.value = item.cupos_ocupados || 0;

    const dirigidoInput = this.container.querySelector('#workshop-dirigido-a');
    if (dirigidoInput) dirigidoInput.value = item.dirigido_a || '';

    const temasTextarea = this.container.querySelector('#workshop-temas');
    if (temasTextarea) {
      temasTextarea.value = Array.isArray(item.temas) ? item.temas.join('\n') : '';
    }

    const checkActivo = this.container.querySelector('#workshop-check-activo');
    if (checkActivo) checkActivo.checked = item.activo === 1;

    const checkDestacado = this.container.querySelector('#workshop-check-destacado');
    if (checkDestacado) checkDestacado.checked = item.destacado === 1;

    if (modal) modal.style.display = 'flex';
  }

  async handleFormSubmit() {
    const form = this.container.querySelector('#form-admin-workshop');
    if (!form) return;

    const id = this.currentEditingId;
    const isEdit = Boolean(id);

    const terapeutaId = this.container.querySelector('#workshop-terapeuta-select')?.value;
    const telefono = this.container.querySelector('#workshop-telefono-input')?.value;
    const expositorNombre = this.container.querySelector('#workshop-expositor-nombre')?.value;
    const expositorCargo = this.container.querySelector('#workshop-expositor-cargo')?.value;
    const titulo = this.container.querySelector('#workshop-titulo')?.value;
    const subtitulo = this.container.querySelector('#workshop-subtitulo')?.value;
    const tipo = this.container.querySelector('#workshop-tipo')?.value;
    const categoria = this.container.querySelector('#workshop-categoria')?.value;
    const fecha = this.container.querySelector('#workshop-fecha')?.value;
    const hora = this.container.querySelector('#workshop-hora')?.value;
    const lugar = this.container.querySelector('#workshop-lugar')?.value;
    const direccion = this.container.querySelector('#workshop-direccion')?.value;
    const arancel = this.container.querySelector('#workshop-arancel')?.value;
    const arancelDetalle = this.container.querySelector('#workshop-arancel-detalle')?.value;
    const cuposTotales = this.container.querySelector('#workshop-cupos-totales')?.value;
    const cuposOcupados = this.container.querySelector('#workshop-cupos-ocupados')?.value;
    const dirigidoA = this.container.querySelector('#workshop-dirigido-a')?.value;
    const temasRaw = this.container.querySelector('#workshop-temas')?.value || '';
    const temas = temasRaw.split('\n').map(t => t.trim()).filter(Boolean);
    const activo = this.container.querySelector('#workshop-check-activo')?.checked ? 1 : 0;
    const destacado = this.container.querySelector('#workshop-check-destacado')?.checked ? 1 : 0;

    const payload = {
      terapeuta_principal_id: terapeutaId ? Number(terapeutaId) : null,
      telefono_contacto: telefono ? telefono.trim() : null,
      expositor_nombre: expositorNombre ? expositorNombre.trim() : null,
      expositor_cargo: expositorCargo ? expositorCargo.trim() : null,
      titulo: titulo ? titulo.trim() : '',
      subtitulo: subtitulo ? subtitulo.trim() : null,
      tipo,
      categoria,
      fecha: fecha ? fecha.trim() : '',
      hora: hora ? hora.trim() : '',
      lugar: lugar ? lugar.trim() : '',
      direccion: direccion ? direccion.trim() : null,
      arancel: arancel ? arancel.trim() : '50 Bs',
      arancel_detalle: arancelDetalle ? arancelDetalle.trim() : null,
      cupos_totales: Number(cuposTotales) || 15,
      cupos_ocupados: Number(cuposOcupados) || 0,
      dirigido_a: dirigidoA ? dirigidoA.trim() : null,
      temas,
      activo,
      destacado
    };

    try {
      let res;
      if (isEdit) {
        res = await apiClient.put(`/workshops/${id}`, payload);
        Toast.success('Taller actualizado correctamente.');
      } else {
        res = await apiClient.post('/workshops', payload);
        Toast.success('Nuevo taller programado y registrado.');
      }

      const modal = this.container.querySelector('#admin-workshop-modal-backdrop');
      if (modal) modal.style.display = 'none';
      this.currentEditingId = null;

      await this.loadWorkshops();
    } catch (err) {
      console.error('[AdminWorkshopsView] Error guardando taller:', err);
      Toast.error(err.message || 'No se pudo guardar el taller.');
    }
  }

  async handleToggle(id) {
    try {
      const res = await apiClient.patch(`/workshops/${id}/toggle`);
      if (res && res.success) {
        Toast.success(res.message || 'Estado actualizado.');
        await this.loadWorkshops();
      }
    } catch (err) {
      console.error('[AdminWorkshopsView] Error alternando estado:', err);
      Toast.error('No se pudo cambiar el estado del taller.');
    }
  }

  async handleDelete(id) {
    const item = this.workshops.find(w => w.id === id);
    const nombre = item ? item.titulo : 'este taller';

    if (!confirm(`¿Está seguro de eliminar ${nombre} de la cartelera?`)) {
      return;
    }

    try {
      const res = await apiClient.delete(`/workshops/${id}`);
      if (res && res.success) {
        Toast.success('Taller eliminado con éxito.');
        await this.loadWorkshops();
      }
    } catch (err) {
      console.error('[AdminWorkshopsView] Error eliminando taller:', err);
      Toast.error('No se pudo eliminar el taller.');
    }
  }
}
