import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';
import { ImageLightboxModal } from '../../components/ImageLightboxModal.js';
import { escapeHtml, sanitizeUrl } from '../../utils/sanitize.js';

export class AdminConveniosView {
  constructor(container) {
    this.container = container;
    this.convenios = [];
    this.stats = { total: 0, activos: 0, inactivos: 0, destacados: 0 };
    this.searchQuery = '';
    this.selectedTipo = 'TODOS';
    this.selectedEstado = 'TODOS'; // 'TODOS', 'ACTIVOS', 'INACTIVOS'
    this.currentEditingId = null;
    this.uploadedImageUrl = null;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-container panel-general">
        
        <!-- ENCABEZADO DE ADMINISTRACIÓN SOFT UI MÉDICA -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.handshake(13, 'var(--soft-purple-primary)')}
                <span>Módulo O · Alianzas Estratégicas</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende" · Cochabamba</span>
            </div>
            <h1 class="soft-page-title">Gestión de Convenios & Alianzas Institucionales</h1>
            <p class="soft-page-subtitle" style="max-width: 780px;">
              Administra los convenios de articulación con colegios, centros médicos, fundaciones y gabinetes. Las alianzas activas se publican en tiempo real en el portal de las familias como vitrina de respaldo y beneficios.
            </p>
          </div>

          <div class="soft-header-actions" style="display: flex; gap: 0.75rem; align-items: center;">
            <a 
              href="#/portal/convenios" 
              class="soft-btn soft-btn-lvl-1-muted"
              style="text-decoration: none;"
              title="Ver cómo lo visualizan los tutores"
            >
              ${Icons.eye(16, 'var(--soft-purple-primary)')}
              <span>Ver Vitrina de Familias</span>
            </a>

            <button 
              type="button"
              id="btn-open-create-convenio" 
              class="soft-btn soft-btn-lvl-1"
            >
              ${Icons.plus(16, '#FFFFFF')}
              <span>Nuevo Convenio</span>
            </button>
          </div>
        </div>

        <!-- TARJETAS DE ESTADÍSTICAS KPI (SOFT UI) -->
        <div class="soft-kpi-grid" style="margin-bottom: 1.5rem;">
          <div class="soft-kpi-card">
            <span class="soft-status-dot-green"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.handshake(22, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Total Alianzas</span>
              <div id="admin-kpi-total" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Convenios registrados</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.check(22, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Publicados / Activos</span>
              <div id="admin-kpi-activos" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Visibles para tutores</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <div class="soft-icon-box soft-icon-box-indigo">
              ${Icons.star(22, 'var(--soft-indigo-accent)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Alianzas Destacadas</span>
              <div id="admin-kpi-destacados" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Con insignia prioritaria</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <div class="soft-icon-box" style="background: #F1F5F9; color: var(--soft-text-body);">
              ${Icons.lock(22, 'var(--soft-text-body)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">En Pausa / Ocultos</span>
              <div id="admin-kpi-inactivos" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Inactivos temporalmente</div>
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
                id="admin-convenios-search" 
                placeholder="Buscar por institución, descripción o beneficio..." 
                class="soft-input" 
                style="padding-left: 2.35rem; width: 100%;"
              />
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <select id="admin-filter-estado" class="soft-select" style="font-size: 0.85rem; padding: 0.5rem 0.85rem;">
                <option value="TODOS">Todos los Estados</option>
                <option value="ACTIVOS">Solo Publicados</option>
                <option value="INACTIVOS">Solo En Pausa</option>
              </select>

              <select id="admin-filter-tipo" class="soft-select" style="font-size: 0.85rem; padding: 0.5rem 0.85rem;">
                <option value="TODOS">Todas las Categorías</option>
                <option value="Colegio / Unidad Educativa">Colegios</option>
                <option value="Centro Médico / Neurológico">Centros Médicos</option>
                <option value="Centro de Estimulación / Terapia">Estimulación & Terapias</option>
                <option value="Fundación / Asociación">Fundaciones</option>
                <option value="Gabinete Psicopedagógico">Gabinetes</option>
                <option value="Universidad / Instituto">Universidades</option>
                <option value="Otro">Otros</option>
              </select>
            </div>
          </div>
        </div>

        <!-- LISTADO DE TARJETAS DE CONVENIOS -->
        <div id="admin-convenios-list" style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="text-align: center; padding: 3rem; color: var(--soft-text-body);">
            <div class="soft-spinner" style="margin: 0 auto 1rem auto;"></div>
            <p>Cargando convenios institucionales...</p>
          </div>
        </div>
      </div>

      <!-- MODAL SOFT UI (NIVEL 2) DE CREACIÓN / EDICIÓN -->
      <div id="modal-convenio-container" style="display: none;"></div>
    `;

    this.attachEvents();
    await this.loadData();
  }

  attachEvents() {
    const btnNew = this.container.querySelector('#btn-open-create-convenio');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openFormModal());
    }

    const searchInput = this.container.querySelector('#admin-convenios-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderList();
      });
    }

    const filterEstado = this.container.querySelector('#admin-filter-estado');
    if (filterEstado) {
      filterEstado.addEventListener('change', (e) => {
        this.selectedEstado = e.target.value;
        this.renderList();
      });
    }

    const filterTipo = this.container.querySelector('#admin-filter-tipo');
    if (filterTipo) {
      filterTipo.addEventListener('change', (e) => {
        this.selectedTipo = e.target.value;
        this.renderList();
      });
    }
  }

  async loadData() {
    try {
      const response = await apiClient.get('/convenios/admin/all');
      if (response && response.success) {
        this.convenios = response.data || [];
        this.stats = response.stats || { total: 0, activos: 0, inactivos: 0, destacados: 0 };
        this.updateKpis();
        this.renderList();
      }
    } catch (error) {
      console.error('[AdminConveniosView] Error al cargar convenios:', error);
      Toast.error('Error al conectar con la base de convenios.');
    }
  }

  updateKpis() {
    const totalEl = this.container.querySelector('#admin-kpi-total');
    const activosEl = this.container.querySelector('#admin-kpi-activos');
    const inactivosEl = this.container.querySelector('#admin-kpi-inactivos');
    const destacadosEl = this.container.querySelector('#admin-kpi-destacados');

    if (totalEl) totalEl.textContent = this.stats.total || 0;
    if (activosEl) activosEl.textContent = this.stats.activos || 0;
    if (inactivosEl) inactivosEl.textContent = this.stats.inactivos || 0;
    if (destacadosEl) destacadosEl.textContent = this.stats.destacados || 0;
  }

  renderList() {
    const listContainer = this.container.querySelector('#admin-convenios-list');
    if (!listContainer) return;

    const filtered = this.convenios.filter(item => {
      if (this.selectedEstado === 'ACTIVOS' && item.activo !== 1) return false;
      if (this.selectedEstado === 'INACTIVOS' && item.activo === 1) return false;
      if (this.selectedTipo !== 'TODOS' && item.tipo_institucion !== this.selectedTipo) return false;

      if (this.searchQuery) {
        const text = `${item.nombre_institucion} ${item.descripcion_convenio} ${item.beneficio_familias || ''}`.toLowerCase();
        if (!text.includes(this.searchQuery)) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="soft-card-static" style="text-align: center; padding: 3rem 1.5rem; border: 1px dashed rgba(123, 102, 181, 0.25);">
          <div style="margin-bottom: 0.75rem; color: var(--soft-purple-primary);">
            ${Icons.handshake(44, 'var(--soft-purple-primary)')}
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title); margin-bottom: 0.35rem;">
            No se encontraron convenios con los criterios aplicados
          </h3>
          <p style="color: var(--soft-text-body); font-size: 0.9rem; margin-bottom: 1.25rem;">
            Puedes registrar una nueva institución aliada o restablecer los filtros de búsqueda.
          </p>
          <button type="button" id="btn-empty-create" class="soft-btn soft-btn-lvl-1">
            ${Icons.plus(16, '#FFFFFF')}
            <span>Registrar Nuevo Convenio</span>
          </button>
        </div>
      `;
      const btnEmpty = listContainer.querySelector('#btn-empty-create');
      if (btnEmpty) btnEmpty.addEventListener('click', () => this.openFormModal());
      return;
    }

    listContainer.innerHTML = filtered.map(item => this._renderConvenioRow(item)).join('');
    this.attachListRowEvents();
  }

  _renderConvenioRow(item) {
    const isActivo = item.activo === 1;
    const isDestacado = item.destacado === 1;
    const safeImgUrl = sanitizeUrl(item.imagen_url, { allowDataImage: true });

    // Miniatura o placeholder vectorizado interactivo (al hacer clic se agranda)
    const thumbHtml = safeImgUrl ? `
      <div 
        class="btn-preview-imagen-convenio" 
        data-id="${escapeHtml(item.id)}"
        data-img-url="${escapeHtml(safeImgUrl)}"
        data-title="${encodeURIComponent(item.nombre_institucion || '')}"
        data-tipo="${encodeURIComponent(item.tipo_institucion || '')}"
        data-desc="${encodeURIComponent(item.descripcion_convenio || '')}"
        data-benefit="${encodeURIComponent(item.beneficio_familias || '')}"
        style="width: 72px; height: 72px; border-radius: 14px; position: relative; overflow: hidden; flex-shrink: 0; cursor: pointer; border: 1px solid rgba(123, 102, 181, 0.18); box-shadow: 0 2px 8px rgba(88, 66, 148, 0.08); transition: transform 0.2s ease, box-shadow 0.2s ease;"
        title="Clic para ver fotografía ampliada"
        onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 14px rgba(88,66,148,0.2)';"
        onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 8px rgba(88, 66, 148, 0.08)';"
      >
        <img 
          src="${escapeHtml(safeImgUrl)}" 
          alt="${escapeHtml(item.nombre_institucion)}" 
          style="width: 100%; height: 100%; object-fit: cover;"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div style="display: none; width: 100%; height: 100%; border-radius: 14px; background: var(--soft-lavender-surface); align-items: center; justify-content: center; color: var(--soft-purple-primary);">
          ${Icons.building(28, 'var(--soft-purple-primary)')}
        </div>
        <div style="position: absolute; bottom: 3px; right: 3px; background: rgba(36, 40, 91, 0.75); backdrop-filter: blur(4px); border-radius: 6px; padding: 2px 4px; display: flex; align-items: center; justify-content: center; color: #FFFFFF;" title="Ampliar">
          ${Icons.search(10, '#FFFFFF')}
        </div>
      </div>
    ` : `
      <div style="width: 72px; height: 72px; border-radius: 14px; background: var(--soft-lavender-surface); display: flex; align-items: center; justify-content: center; color: var(--soft-purple-primary); flex-shrink: 0; border: 1px solid rgba(123, 102, 181, 0.16);">
        ${Icons.building(28, 'var(--soft-purple-primary)')}
      </div>
    `;

    return `
      <div class="soft-card-static" style="padding: 1.25rem 1.45rem; display: flex; flex-wrap: wrap; gap: 1.25rem; align-items: center; justify-content: space-between;">
        
        <div style="display: flex; gap: 1rem; align-items: flex-start; flex: 1; min-width: min(100%, 300px);">
          ${thumbHtml}

          <div style="flex: 1;">
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
              <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem;">
                ${escapeHtml(item.tipo_institucion)}
              </span>

              ${isDestacado ? `
                <span class="soft-badge soft-badge-amber" style="font-size: 0.7rem; font-weight: 700;">
                  ${Icons.star(12, '#D97706')}
                  <span>Destacada</span>
                </span>
              ` : ''}

              ${isActivo ? `
                <span class="soft-badge soft-badge-emerald" style="font-size: 0.7rem;">
                  <span class="soft-status-dot"></span>
                  <span>Visible en Portal</span>
                </span>
              ` : `
                <span class="soft-badge soft-badge-slate" style="font-size: 0.7rem;">
                  <span class="soft-status-dot" style="background: #94A3B8;"></span>
                  <span>En Pausa · Oculto</span>
                </span>
              `}
            </div>

            <h3 style="font-size: 1.08rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.25rem 0;">
              ${escapeHtml(item.nombre_institucion)}
            </h3>

            <p style="font-size: 0.85rem; color: var(--soft-text-body); margin: 0 0 0.5rem 0; line-height: 1.48; max-width: 680px;">
              ${escapeHtml(item.descripcion_convenio)}
            </p>

            ${item.beneficio_familias ? `
              <div style="display: inline-flex; align-items: center; gap: 0.45rem; background: var(--soft-lavender-surface); border: 1px dashed var(--soft-purple-primary); padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.8rem; color: var(--soft-purple-primary); font-weight: 600;">
                ${Icons.gift(14, 'var(--soft-purple-primary)')}
                <span>Beneficio: ${escapeHtml(item.beneficio_familias)}</span>
              </div>
            ` : ''}

            <div style="display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.78rem; color: var(--soft-text-muted); margin-top: 0.5rem;">
              ${item.telefono_contacto ? `
                <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                  ${Icons.phone(12, 'var(--soft-text-muted)')}
                  <span>${escapeHtml(item.telefono_contacto)}</span>
                </span>
              ` : ''}

              ${item.email_contacto ? `
                <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                  ${Icons.mail(12, 'var(--soft-text-muted)')}
                  <span>${escapeHtml(item.email_contacto)}</span>
                </span>
              ` : ''}

              ${item.direccion ? `
                <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                  ${Icons.mapPin(12, 'var(--soft-text-muted)')}
                  <span>${escapeHtml(item.direccion)}</span>
                </span>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- BOTONES DE ACCIÓN SOFT UI (NIVEL 1) -->
        <div style="display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap;">
          <button 
            type="button"
            class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-toggle-activo" 
            data-id="${item.id}"
            title="${isActivo ? 'Ocultar a los tutores' : 'Publicar y hacer visible'}"
          >
            <span>${isActivo ? 'Pausar' : 'Activar'}</span>
          </button>

          <button 
            type="button"
            class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-edit-convenio" 
            data-id="${item.id}"
          >
            ${Icons.edit(14, '#FFFFFF')}
            <span>Editar</span>
          </button>

          <button 
            type="button"
            class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-delete-convenio" 
            data-id="${item.id}"
            title="Eliminar convenio institucional"
            style="color: #EF4444;"
          >
            ${Icons.trash(14, '#EF4444')}
            <span>Eliminar</span>
          </button>
        </div>
      </div>
    `;
  }

  attachListRowEvents() {
    // Alternar estado activo / inactivo
    const toggleBtns = this.container.querySelectorAll('.btn-toggle-activo');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        try {
          const res = await apiClient.patch(`/convenios/${id}/toggle`, {});
          if (res && res.success) {
            Toast.success(res.message);
            await this.loadData();
          }
        } catch (err) {
          Toast.error(err.message || 'Error al cambiar estado.');
        }
      });
    });

    // Editar
    const editBtns = this.container.querySelectorAll('.btn-edit-convenio');
    editBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.dataset.id);
        const item = this.convenios.find(c => c.id === id);
        if (item) {
          this.openFormModal(item);
        }
      });
    });

    // Eliminar
    const deleteBtns = this.container.querySelectorAll('.btn-delete-convenio');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        const item = this.convenios.find(c => c.id === id);
        const nom = item ? item.nombre_institucion : 'esta institución';

        if (confirm(`¿Está seguro de eliminar el convenio con "${nom}"? Esta acción no se puede deshacer.`)) {
          try {
            const res = await apiClient.delete(`/convenios/${id}`);
            if (res && res.success) {
              Toast.success('Convenio eliminado exitosamente.');
              await this.loadData();
            }
          } catch (err) {
            Toast.error(err.message || 'Error al eliminar convenio.');
          }
        }
      });
    });

    // Clic en la imagen para agrandarla en ventana emergente (Lightbox Global)
    const imgTriggers = this.container.querySelectorAll('.btn-preview-imagen-convenio');
    imgTriggers.forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        const trg = e.currentTarget;
        const imgUrl = trg.dataset.imgUrl;
        if (!imgUrl) return;
        ImageLightboxModal.show({
          imageUrl: imgUrl,
          title: decodeURIComponent(trg.dataset.title || 'Institución Aliada'),
          subtitle: `${decodeURIComponent(trg.dataset.tipo || '')} · Institución Aliada`,
          description: decodeURIComponent(trg.dataset.desc || ''),
          benefit: decodeURIComponent(trg.dataset.benefit || '')
        });
      });
    });
  }

  openFormModal(itemToEdit = null) {
    this.currentEditingId = itemToEdit ? itemToEdit.id : null;
    this.uploadedImageUrl = itemToEdit ? itemToEdit.imagen_url : null;
    const isEdit = !!itemToEdit;

    const modalContainer = this.container.querySelector('#modal-convenio-container');
    if (!modalContainer) return;

    modalContainer.style.display = 'block';
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="modal-convenio-backdrop" style="position: fixed; inset: 0; background: rgba(36, 40, 91, 0.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); z-index: 2100; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        
        <div class="soft-modal-card" style="max-width: 660px; width: 100%; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden;">
          
          <!-- CABECERA DEL MODAL SOFT UI (NIVEL 2) -->
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider, #F0EEF9); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface, #F8F6FE); gap: 1rem; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.handshake(20, 'var(--soft-purple-primary, #584294)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title, #24285B); font-size: 1.15rem; font-weight: 800; margin: 0; letter-spacing: -0.015em;">
                  ${isEdit ? 'Editar Convenio Institucional' : 'Nuevo Convenio Institucional'}
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body, #696F8C); margin-top: 0.12rem;">
                  ${isEdit ? 'Actualice las condiciones de la alianza estratégica' : 'Complete los datos para publicarlo en la vitrina familiar'}
                </div>
              </div>
            </div>

            <button type="button" class="soft-modal-close-btn" id="btn-close-modal" title="Cerrar ventana">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- FORMULARIO CON SCROLL SUAVE (NIVEL 2) -->
          <form id="form-convenio" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; margin: 0;">
            
            <div class="soft-modal-scroll" style="padding: 1.35rem 1.65rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem; max-height: calc(88vh - 140px);">
              
              <!-- Nombre de la Institución -->
              <div>
                <label class="soft-label">
                  Nombre de la Institución / Centro <span class="required" style="color: #EF4444;">*</span>
                </label>
                <input 
                  type="text" 
                  name="nombre_institucion" 
                  id="form-nombre"
                  class="soft-input" 
                  placeholder="Ej: Colegio Alemán Federico Froebel" 
                  value="${itemToEdit?.nombre_institucion || ''}"
                  required 
                  style="width: 100%;"
                />
              </div>

              <!-- Categoría -->
              <div>
                <label class="soft-label">
                  Categoría o Tipo de Institución <span class="required" style="color: #EF4444;">*</span>
                </label>
                <select name="tipo_institucion" id="form-tipo" class="soft-select" required style="width: 100%;">
                  <option value="Colegio / Unidad Educativa" ${itemToEdit?.tipo_institucion === 'Colegio / Unidad Educativa' ? 'selected' : ''}>Colegio / Unidad Educativa</option>
                  <option value="Centro Médico / Neurológico" ${itemToEdit?.tipo_institucion === 'Centro Médico / Neurológico' ? 'selected' : ''}>Centro Médico / Neurológico</option>
                  <option value="Gabinete Psicopedagógico" ${itemToEdit?.tipo_institucion === 'Gabinete Psicopedagógico' ? 'selected' : ''}>Gabinete Psicopedagógico</option>
                  <option value="Centro de Estimulación / Terapia" ${itemToEdit?.tipo_institucion === 'Centro de Estimulación / Terapia' ? 'selected' : ''}>Centro de Estimulación / Terapia</option>
                  <option value="Fundación / Asociación" ${itemToEdit?.tipo_institucion === 'Fundación / Asociación' ? 'selected' : ''}>Fundación / Asociación</option>
                  <option value="Universidad / Instituto" ${itemToEdit?.tipo_institucion === 'Universidad / Instituto' ? 'selected' : ''}>Universidad / Instituto</option>
                  <option value="Otro" ${itemToEdit?.tipo_institucion === 'Otro' ? 'selected' : ''}>Otro</option>
                </select>
              </div>

              <!-- Descripción del Convenio -->
              <div>
                <label class="soft-label">
                  Descripción del Convenio / Alcances <span class="required" style="color: #EF4444;">*</span>
                </label>
                <textarea 
                  name="descripcion_convenio" 
                  id="form-desc"
                  class="soft-textarea" 
                  rows="3" 
                  placeholder="Explique en qué consiste el acuerdo: articulación escolar, reuniones de seguimiento, interconsulta neurológica..."
                  required
                >${itemToEdit?.descripcion_convenio || ''}</textarea>
              </div>

              <!-- Beneficio para Familias -->
              <div style="background: var(--soft-lavender-surface, #F8F6FE); border: 1px dashed var(--soft-purple-primary, #7B66B5); border-radius: 14px; padding: 1rem 1.15rem;">
                <label class="soft-label" style="font-weight: 700; color: var(--soft-purple-primary, #584294); margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.45rem;">
                  ${Icons.gift(16, 'var(--soft-purple-primary, #584294)')}
                  <span>Beneficio Exclusivo para Familias de PSI Aprende</span>
                </label>
                <textarea 
                  name="beneficio_familias" 
                  id="form-beneficio"
                  class="soft-textarea" 
                  rows="2" 
                  placeholder="Ej: 15% de descuento en evaluaciones integrales y turnos preferenciales en 48h..."
                  style="background: #FFFFFF;"
                >${itemToEdit?.beneficio_familias || ''}</textarea>
              </div>

              <!-- Teléfono y Correo Electrónico -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;">
                <div>
                  <label class="soft-label">Teléfono / WhatsApp</label>
                  <input 
                    type="text" 
                    name="telefono_contacto" 
                    id="form-telefono"
                    class="soft-input" 
                    placeholder="Ej: +591 76912345" 
                    value="${itemToEdit?.telefono_contacto || ''}"
                    style="width: 100%;"
                  />
                </div>

                <div>
                  <label class="soft-label">Correo Electrónico</label>
                  <input 
                    type="email" 
                    name="email_contacto" 
                    id="form-email"
                    class="soft-input" 
                    placeholder="contacto@institucion.edu.bo" 
                    value="${itemToEdit?.email_contacto || ''}"
                    style="width: 100%;"
                  />
                </div>
              </div>

              <!-- Dirección y Sitio Web -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;">
                <div>
                  <label class="soft-label">Dirección Física en Cochabamba</label>
                  <input 
                    type="text" 
                    name="direccion" 
                    id="form-direccion"
                    class="soft-input" 
                    placeholder="Av. América Oeste N° 850" 
                    value="${itemToEdit?.direccion || ''}"
                    style="width: 100%;"
                  />
                </div>

                <div>
                  <label class="soft-label">Sitio Web o Red Social</label>
                  <input 
                    type="text" 
                    name="sitio_web" 
                    id="form-web"
                    class="soft-input" 
                    placeholder="https://institucion.com" 
                    value="${itemToEdit?.sitio_web || ''}"
                    style="width: 100%;"
                  />
                </div>
              </div>

              <!-- Carga de Fotografía o Logotipo -->
              <div>
                <label class="soft-label">Fotografía o Logotipo Institucional</label>
                <div style="display: flex; gap: 1rem; align-items: center; background: var(--soft-lavender-surface, #F8F6FE); border: 1px solid var(--soft-border-card-inner, rgba(110, 86, 176, 0.12)); border-radius: 14px; padding: 0.85rem 1rem;">
                  
                  <!-- Miniatura de Vista Previa -->
                  <div id="modal-img-preview-box" style="width: 72px; height: 72px; border-radius: 12px; overflow: hidden; background: #FFFFFF; border: 1px solid rgba(123, 102, 181, 0.18); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <img 
                      id="modal-img-preview" 
                      src="${itemToEdit?.imagen_url || ''}" 
                      alt="Vista previa" 
                      style="width: 100%; height: 100%; object-fit: cover; display: ${itemToEdit?.imagen_url ? 'block' : 'none'};" 
                    />
                    <div id="modal-img-fallback" style="display: ${itemToEdit?.imagen_url ? 'none' : 'flex'}; align-items: center; justify-content: center; width: 100%; height: 100%; color: var(--soft-purple-primary, #584294);">
                      ${Icons.building(28, 'var(--soft-purple-primary, #584294)')}
                    </div>
                  </div>

                  <!-- Botón y Entrada de Archivo -->
                  <div style="flex: 1; display: flex; flex-direction: column; gap: 0.45rem;">
                    <input type="file" id="form-file-input" accept="image/jpeg,image/png,image/webp,image/svg+xml" style="display: none;" />
                    
                    <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                      <button 
                        type="button" 
                        id="btn-upload-file" 
                        class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" 
                        style="display: inline-flex; align-items: center; gap: 0.4rem;"
                      >
                        ${Icons.upload(15, 'var(--soft-purple-primary, #584294)')}
                        <span>Subir Archivo desde PC</span>
                      </button>
                      <span id="upload-status-indicator" style="font-size: 0.78rem; color: var(--soft-text-body, #696F8C); font-weight: 500;">
                        ${itemToEdit?.imagen_url ? 'Imagen actual vinculada' : 'Selecciona un archivo PNG, JPG o WEBP'}
                      </span>
                    </div>

                    <div>
                      <input 
                        type="text" 
                        name="imagen_url" 
                        id="form-imagen-url" 
                        class="soft-input" 
                        placeholder="O pega una URL directa de imagen: https://... o /uploads/..." 
                        value="${itemToEdit?.imagen_url || ''}"
                        style="font-size: 0.8rem; padding: 0.45rem 0.75rem; width: 100%;"
                      />
                    </div>
                  </div>

                </div>
              </div>

              <!-- Casillas de verificación -->
              <div style="display: flex; gap: 1.5rem; align-items: center; padding-top: 0.5rem; border-top: 1px solid var(--soft-divider, #F0EEF9);">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--soft-text-title); cursor: pointer;">
                  <input 
                    type="checkbox" 
                    id="form-destacado" 
                    ${itemToEdit?.destacado === 1 ? 'checked' : ''}
                    style="width: 18px; height: 18px; accent-color: var(--soft-purple-primary, #584294);"
                  />
                  <span style="display: inline-flex; align-items: center; gap: 0.35rem;">
                    ${Icons.star(14, '#D97706')}
                    <span>Alianza Destacada · Insignia prioritaria</span>
                  </span>
                </label>

                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: var(--soft-text-title); cursor: pointer;">
                  <input 
                    type="checkbox" 
                    id="form-activo" 
                    ${(!itemToEdit || itemToEdit.activo === 1) ? 'checked' : ''}
                    style="width: 18px; height: 18px; accent-color: var(--soft-purple-primary, #584294);"
                  />
                  <span>Publicar y hacer visible para familias</span>
                </label>
              </div>

            </div>

            <!-- PIE DEL MODAL (NIVEL 2) -->
            <div style="padding: 1rem 1.65rem; border-top: 1px solid var(--soft-divider, #F0EEF9); background: var(--soft-lavender-surface, #F8F6FE); display: flex; justify-content: flex-end; gap: 0.75rem; flex-shrink: 0;">
              <button 
                type="button" 
                id="btn-cancel-modal" 
                class="soft-btn soft-btn-lvl-2-soft"
              >
                Cancelar
              </button>

              <button 
                type="submit" 
                id="btn-save-convenio"
                class="soft-btn soft-btn-lvl-2"
              >
                ${Icons.check(16, '#FFFFFF')}
                <span>${isEdit ? 'Guardar Cambios' : 'Registrar Convenio'}</span>
              </button>
            </div>

          </form>

        </div>
      </div>
    `;

    // Cerrar modal
    const closeModal = () => {
      modalContainer.style.display = 'none';
      modalContainer.innerHTML = '';
    };

    modalContainer.querySelector('#btn-close-modal').addEventListener('click', closeModal);
    modalContainer.querySelector('#btn-cancel-modal').addEventListener('click', closeModal);

    // Cerrar al hacer clic en el backdrop exterior
    const backdrop = modalContainer.querySelector('#modal-convenio-backdrop');
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    // Vista previa ampliable al hacer clic en el recuadro de imagen
    const previewBox = modalContainer.querySelector('#modal-img-preview-box');
    const form = modalContainer.querySelector('#form-convenio');
    const inputUrl = modalContainer.querySelector('#form-imagen-url');
    const imgPreview = modalContainer.querySelector('#modal-img-preview');
    const imgFallback = modalContainer.querySelector('#modal-img-fallback');
    const statusIndicator = modalContainer.querySelector('#upload-status-indicator');

    if (previewBox) {
      previewBox.style.cursor = 'pointer';
      previewBox.title = 'Clic para ver imagen ampliada';
      previewBox.addEventListener('click', () => {
        const currentUrl = inputUrl.value || imgPreview.src;
        if (currentUrl && !currentUrl.endsWith('undefined') && imgPreview.style.display !== 'none') {
          ImageLightboxModal.show({
            imageUrl: currentUrl,
            title: form.querySelector('#form-nombre')?.value || itemToEdit?.nombre_institucion || 'Fotografía de la Institución',
            subtitle: form.querySelector('#form-tipo')?.value || 'Convenio Institucional',
            description: form.querySelector('#form-desc')?.value || '',
            benefit: form.querySelector('#form-beneficio')?.value || ''
          });
        }
      });
    }

    // Subida de imagen con FileReader + apiClient.upload
    const fileInput = modalContainer.querySelector('#form-file-input');
    const btnUpload = modalContainer.querySelector('#btn-upload-file');

    btnUpload.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // 1. Vista previa visual instantánea local en el navegador
      const reader = new FileReader();
      reader.onload = (ev) => {
        imgPreview.src = ev.target.result;
        imgPreview.style.display = 'block';
        imgFallback.style.display = 'none';
      };
      reader.readAsDataURL(file);

      // 2. Subida real por FormData con apiClient.upload
      const formData = new FormData();
      formData.append('imagen', file);

      btnUpload.disabled = true;
      statusIndicator.textContent = 'Subiendo al servidor...';
      statusIndicator.style.color = 'var(--soft-purple-primary, #584294)';

      try {
        const res = await apiClient.upload('/convenios/upload', formData);
        if (res && res.success && res.data?.url) {
          inputUrl.value = res.data.url;
          imgPreview.src = res.data.url;
          imgPreview.style.display = 'block';
          imgFallback.style.display = 'none';
          statusIndicator.textContent = 'Imagen subida y vinculada con éxito';
          statusIndicator.style.color = '#15803D';
          Toast.success('Logotipo subido y vinculado correctamente.');
        } else {
          throw new Error(res?.error?.message || 'Error en la respuesta del servidor');
        }
      } catch (err) {
        console.error('[Upload Convenio Error]', err);
        statusIndicator.textContent = 'Error al subir imagen';
        statusIndicator.style.color = '#EF4444';
        Toast.error(err.message || 'Error al subir imagen.');
      } finally {
        btnUpload.disabled = false;
      }
    });

    // Sincronización en vivo si el usuario escribe o pega una URL manual
    inputUrl.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (val) {
        imgPreview.src = val;
        imgPreview.style.display = 'block';
        imgFallback.style.display = 'none';
        statusIndicator.textContent = 'URL de imagen manual vinculada';
        statusIndicator.style.color = 'var(--soft-text-body)';
      } else {
        imgPreview.style.display = 'none';
        imgFallback.style.display = 'flex';
        statusIndicator.textContent = 'Ningún archivo seleccionado';
      }
    });

    // Guardar formulario
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = modalContainer.querySelector('#btn-save-convenio');
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <div class="soft-spinner" style="width: 14px; height: 14px; border-width: 2px; margin-right: 6px;"></div>
        <span>Guardando...</span>
      `;

      const payload = {
        nombre_institucion: form.querySelector('#form-nombre').value,
        tipo_institucion: form.querySelector('#form-tipo').value,
        descripcion_convenio: form.querySelector('#form-desc').value,
        beneficio_familias: form.querySelector('#form-beneficio').value,
        telefono_contacto: form.querySelector('#form-telefono').value,
        email_contacto: form.querySelector('#form-email').value,
        direccion: form.querySelector('#form-direccion').value,
        sitio_web: form.querySelector('#form-web').value,
        imagen_url: form.querySelector('#form-imagen-url').value,
        destacado: form.querySelector('#form-destacado').checked ? 1 : 0,
        activo: form.querySelector('#form-activo').checked ? 1 : 0
      };

      try {
        if (isEdit) {
          const res = await apiClient.put(`/convenios/${this.currentEditingId}`, payload);
          if (res && res.success) {
            Toast.success('Convenio actualizado exitosamente.');
            closeModal();
            await this.loadData();
          }
        } else {
          const res = await apiClient.post('/convenios', payload);
          if (res && res.success) {
            Toast.success('Convenio registrado exitosamente.');
            closeModal();
            await this.loadData();
          }
        }
      } catch (err) {
        Toast.error(err.message || 'Error al procesar solicitud.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
          ${Icons.check(16, '#FFFFFF')}
          <span>${isEdit ? 'Guardar Cambios' : 'Registrar Convenio'}</span>
        `;
      }
    });
  }
}
