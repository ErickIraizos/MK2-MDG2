import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';
import { ImageLightboxModal } from '../../components/ImageLightboxModal.js';
import { ConvenioCarouselModal } from '../../components/ConvenioCarouselModal.js';
import { escapeHtml, sanitizeUrl } from '../../utils/sanitize.js';

export class TutorConveniosView {
  constructor(container) {
    this.container = container;
    this.convenios = [];
    this.selectedTipo = 'TODOS';
    this.searchQuery = '';
    this.isLoading = false;
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-container panel-general">
        <!-- Encabezado Institucional Soft UI para Familias y Tutores -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.handshake(13, 'var(--soft-purple-primary, #7B66B5)')}
                <span>Red Institucional de Apoyo</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende" · Cochabamba</span>
            </div>
            <h1 class="soft-page-title">Alianzas & Convenios Institucionales</h1>
            <p class="soft-page-subtitle" style="max-width: 780px;">
              Conoce las instituciones educativas, centros médicos y gabinetes especializados de Cochabamba que mantienen acuerdos activos de cooperación con "PSI Aprende" para brindar atención coordinada y beneficios exclusivos a nuestras familias.
            </p>
          </div>

          <div class="soft-header-actions">
            <span class="soft-badge soft-badge-emerald" style="padding: 0.5rem 1rem; font-size: 0.8rem;">
              ${Icons.gift(15, 'var(--soft-emerald-dark, #065F46)')}
              <span>Beneficios Exclusivos para Pacientes</span>
            </span>
          </div>
        </div>

        <!-- Franja de KPIs Informativos -->
        <div class="soft-kpi-grid-3" style="margin-bottom: 1.5rem;">
          <div class="soft-kpi-card">
            <span class="soft-status-dot-green" title="Red de convenios vigente"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.handshake(22, 'var(--soft-purple-primary, #7B66B5)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Alianzas Vigentes</span>
              <div id="kpi-total-convenios" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Instituciones con convenio activo</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.bookOpen(22, 'var(--soft-mint-deep, #0D9488)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Articulación Escolar</span>
              <div id="kpi-colegios-convenios" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Colegios y unidades educativas</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <div class="soft-icon-box soft-icon-box-indigo">
              ${Icons.stethoscope(22, 'var(--soft-indigo-accent, #4F46E5)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Salud y Terapias</span>
              <div id="kpi-salud-convenios" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Neurología, Fonoaudiología y Fundaciones</div>
            </div>
          </div>
        </div>

        <!-- Filtros y Buscador en Tiempo Real -->
        <div class="soft-card" style="padding: 1.25rem 1.5rem; margin-bottom: 1.75rem;">
          <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; align-items: center;">
            
            <!-- Barra de Búsqueda -->
            <div style="flex: 1; min-width: min(100%, 260px); position: relative;">
              <span style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: #9CA3AF;">
                ${Icons.search(16, '#9CA3AF')}
              </span>
              <input 
                type="text" 
                id="convenios-search-input" 
                placeholder="Buscar por nombre de colegio, centro o beneficio..." 
                class="soft-input" 
                style="padding-left: 2.35rem; width: 100%;"
              />
            </div>

            <!-- Chips de Categoría -->
            <div id="tipo-filter-container" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              <button class="soft-filter-chip active" data-tipo="TODOS">Todos</button>
              <button class="soft-filter-chip" data-tipo="Colegio / Unidad Educativa">Colegios</button>
              <button class="soft-filter-chip" data-tipo="Centro Médico / Neurológico">Centros Médicos</button>
              <button class="soft-filter-chip" data-tipo="Centro de Estimulación / Terapia">Estimulación & Terapias</button>
              <button class="soft-filter-chip" data-tipo="Fundación / Asociación">Fundaciones</button>
            </div>
          </div>
        </div>

        <!-- Grid de Tarjetas de Convenios en 2 Paneles por Fila -->
        <div id="convenios-grid-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 1.75rem;">
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: #6B7280;">
            <div class="soft-spinner" style="margin: 0 auto 1rem auto;"></div>
            <p>Cargando red de convenios y alianzas institucionales...</p>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
    await this.loadData();
  }

  attachEvents() {
    // Buscador en tiempo real
    const searchInput = this.container.querySelector('#convenios-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderGrid();
      });
    }

    // Filtros por tipo
    const chips = this.container.querySelectorAll('.soft-filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        chips.forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.selectedTipo = e.currentTarget.dataset.tipo;
        this.renderGrid();
      });
    });
  }

  async loadData() {
    this.isLoading = true;
    try {
      const response = await apiClient.get('/convenios');
      if (response && response.success) {
        this.convenios = response.data || [];
        this.updateKpis();
        this.renderGrid();
      }
    } catch (error) {
      console.error('[TutorConveniosView] Error al cargar convenios:', error);
      Toast.error('No se pudo cargar la lista de convenios institucionales.');
      const grid = this.container.querySelector('#convenios-grid-container');
      if (grid) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #EF4444;">
            <p>Error al conectar con el servidor. Intente nuevamente en unos instantes.</p>
          </div>
        `;
      }
    } finally {
      this.isLoading = false;
    }
  }

  updateKpis() {
    const totalEl = this.container.querySelector('#kpi-total-convenios');
    const colegiosEl = this.container.querySelector('#kpi-colegios-convenios');
    const saludEl = this.container.querySelector('#kpi-salud-convenios');

    const total = this.convenios.length;
    const colegios = this.convenios.filter(c => c.tipo_institucion === 'Colegio / Unidad Educativa').length;
    const salud = this.convenios.filter(c => 
      c.tipo_institucion === 'Centro Médico / Neurológico' || 
      c.tipo_institucion === 'Centro de Estimulación / Terapia' ||
      c.tipo_institucion === 'Fundación / Asociación'
    ).length;

    if (totalEl) totalEl.textContent = `${total} Aliados`;
    if (colegiosEl) colegiosEl.textContent = `${colegios} Colegios`;
    if (saludEl) saludEl.textContent = `${salud} Centros`;
  }

  renderGrid() {
    const grid = this.container.querySelector('#convenios-grid-container');
    if (!grid) return;

    // Filtrar por categoría y texto de búsqueda
    const filtered = this.convenios.filter(item => {
      const matchTipo = (this.selectedTipo === 'TODOS') || (item.tipo_institucion === this.selectedTipo);
      const matchSearch = !this.searchQuery || 
        (item.nombre_institucion && item.nombre_institucion.toLowerCase().includes(this.searchQuery)) ||
        (item.descripcion_convenio && item.descripcion_convenio.toLowerCase().includes(this.searchQuery)) ||
        (item.beneficio_familias && item.beneficio_familias.toLowerCase().includes(this.searchQuery));

      return matchTipo && matchSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem; background: #FFFFFF; border-radius: 1rem; border: 1px dashed rgba(123, 102, 181, 0.2);">
          <div style="margin-bottom: 0.75rem; color: #7B66B5;">
            ${Icons.handshake(44, '#7B66B5')}
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #1E293B; margin-bottom: 0.35rem;">
            No se encontraron convenios con los filtros seleccionados
          </h3>
          <p style="color: #64748B; font-size: 0.9rem; max-width: 480px; margin: 0 auto;">
            Prueba ajustando tu búsqueda o seleccionando la categoría "Todos" para explorar todas las instituciones aliadas.
          </p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(item => this._renderConvenioCard(item)).join('');
    this.attachCardEvents();
  }

  attachCardEvents() {
    // Abrir modal con carrusel interactivo al pulsar "Ver Alianza y Beneficios" o la fotografía
    const openModalForId = (id) => {
      const item = this.convenios.find(c => String(c.id) === String(id));
      if (item) {
        ConvenioCarouselModal.show(item);
      }
    };

    const detailButtons = this.container.querySelectorAll('.btn-convenio-details');
    detailButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (id) openModalForId(id);
      });
    });

    const triggers = this.container.querySelectorAll('.tutor-convenio-img-trigger');
    triggers.forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        if (id) openModalForId(id);
      });
    });
  }

  _renderConvenioCard(item) {
    const isDestacado = item.destacado === 1;
    const cleanPhone = item.telefono_contacto ? String(item.telefono_contacto).replace(/[^\d]/g, '') : '';
    const whatsappLink = cleanPhone ? sanitizeUrl(`https://wa.me/${cleanPhone.startsWith('591') ? cleanPhone : '591' + cleanPhone}`) : null;
    const rawWebLink = item.sitio_web ? (String(item.sitio_web).startsWith('http') ? item.sitio_web : `https://${item.sitio_web}`) : null;
    const webLink = rawWebLink ? sanitizeUrl(rawWebLink) : null;
    const safeImgUrl = sanitizeUrl(item.imagen_url, { allowDataImage: true });

    // Imagen interactiva con opción de ampliar en ventana emergente (Lightbox)
    const imageHtml = safeImgUrl ? `
      <div 
        class="tutor-convenio-img-trigger" 
        data-id="${escapeHtml(item.id)}"
        data-img-url="${escapeHtml(safeImgUrl)}"
        data-title="${encodeURIComponent(item.nombre_institucion || '')}"
        data-tipo="${encodeURIComponent(item.tipo_institucion || '')}"
        data-desc="${encodeURIComponent(item.descripcion_convenio || '')}"
        data-benefit="${encodeURIComponent(item.beneficio_familias || '')}"
        style="width: 100%; height: 160px; overflow: hidden; position: relative; border-radius: 0.85rem 0.85rem 0 0; background: #F1F5F9; cursor: pointer;"
        title="Clic para ver fotografía ampliada"
      >
        <img 
          src="${escapeHtml(safeImgUrl)}" 
          alt="${escapeHtml(item.nombre_institucion)}" 
          style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.35s ease;"
          onmouseover="this.style.transform='scale(1.05)';"
          onmouseout="this.style.transform='scale(1)';"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; background: linear-gradient(135deg, #7B66B5 0%, #9682CC 100%); color: #FFFFFF;">
          ${Icons.building(42, '#FFFFFF')}
        </div>
        <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(36, 40, 91, 0.75); backdrop-filter: blur(4px); border-radius: 8px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 0.3rem; color: #FFFFFF; font-size: 0.72rem; font-weight: 600;">
          ${Icons.search(12, '#FFFFFF')}
          <span>Ampliar</span>
        </div>
      </div>
    ` : `
      <div style="width: 100%; height: 110px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #EDE9FE 0%, #F5F3FF 100%); border-radius: 0.85rem 0.85rem 0 0; color: #7B66B5;">
        ${Icons.building(38, '#7B66B5')}
      </div>
    `;

    return `
      <div class="soft-card-static" style="display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border-radius: 20px; transition: transform 0.2s ease, box-shadow 0.2s ease; padding: 0;">
        <div>
          ${imageHtml}

          <div style="padding: 1.35rem 1.45rem;">
            <!-- Badges superiores -->
            <div style="display: flex; flex-wrap: wrap; gap: 0.45rem; align-items: center; margin-bottom: 0.75rem;">
              <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem; font-weight: 600;">
                ${escapeHtml(item.tipo_institucion)}
              </span>

              ${isDestacado ? `
                <span class="soft-badge soft-badge-amber" style="font-size: 0.72rem; font-weight: 700;">
                  ${Icons.star(12, '#D97706')}
                  <span>Alianza Destacada</span>
                </span>
              ` : ''}
            </div>

            <!-- Título de la Institución -->
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title, #24285B); margin: 0 0 0.45rem 0; line-height: 1.35; letter-spacing: -0.015em;">
              ${escapeHtml(item.nombre_institucion)}
            </h3>

            <!-- Descripción del Convenio -->
            <p style="font-size: 0.86rem; color: var(--soft-text-body, #696F8C); line-height: 1.5; margin-bottom: 1rem;">
              ${escapeHtml(item.descripcion_convenio)}
            </p>

            <!-- Caja Destacada: Beneficio Exclusivo para Familias -->
            ${item.beneficio_familias ? `
              <div style="background: var(--soft-lavender-surface, #F8F6FE); border: 1px dashed var(--soft-purple-primary, #7B66B5); border-radius: 14px; padding: 0.9rem 1.05rem; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.45rem; color: var(--soft-purple-primary, #584294); font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem;">
                  ${Icons.gift(15, 'var(--soft-purple-primary, #584294)')}
                  <span>Beneficio para Familias PSI Aprende</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--soft-text-title, #24285B); line-height: 1.45; font-weight: 600;">
                  ${escapeHtml(item.beneficio_familias)}
                </div>
              </div>
            ` : ''}

            <!-- Datos de Contacto y Dirección -->
            <div style="display: flex; flex-direction: column; gap: 0.45rem; font-size: 0.82rem; color: var(--soft-text-muted, #8E94B2); margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--soft-divider, #F0EEF9);">
              ${item.direccion ? `
                <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
                  <span style="color: var(--soft-purple-primary, #584294); flex-shrink: 0; margin-top: 2px;">${Icons.mapPin(14, 'var(--soft-purple-primary, #584294)')}</span>
                  <span style="color: var(--soft-text-body, #696F8C);">${escapeHtml(item.direccion)}</span>
                </div>
              ` : ''}

              ${item.email_contacto ? `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="color: var(--soft-purple-primary, #584294); flex-shrink: 0;">${Icons.mail(14, 'var(--soft-purple-primary, #584294)')}</span>
                  <a href="mailto:${escapeHtml(item.email_contacto)}" style="color: var(--soft-text-body, #696F8C); text-decoration: none;">${escapeHtml(item.email_contacto)}</a>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Acciones Inferiores: Botón Detalles y Carrusel + Canales -->
        <div style="padding: 1rem 1.45rem 1.35rem 1.45rem; display: flex; gap: 0.65rem; border-top: 1px solid var(--soft-divider, #F0EEF9); background: var(--soft-lavender-surface, #F8F6FE); align-items: center; flex-wrap: wrap;">
          <button 
            type="button" 
            class="soft-btn soft-btn-lvl-1 btn-convenio-details" 
            data-id="${escapeHtml(item.id)}"
            style="flex: 1; min-width: min(100%, 170px); display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;"
          >
            ${Icons.eye(15, '#FFFFFF')}
            <span>Ver Alianza &amp; Beneficios</span>
          </button>

          ${whatsappLink ? `
            <a 
              href="${escapeHtml(whatsappLink)}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="soft-btn soft-btn-lvl-1-muted" 
              style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;"
              title="Escribir por WhatsApp a la institución"
            >
              ${Icons.whatsapp(15, 'var(--soft-purple-primary, #584294)')}
              <span>WhatsApp</span>
            </a>
          ` : (cleanPhone ? `
            <a 
              href="tel:${escapeHtml(cleanPhone)}" 
              class="soft-btn soft-btn-lvl-1-muted" 
              style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;"
              title="Llamar a la institución"
            >
              ${Icons.phone(15, 'var(--soft-purple-primary, #584294)')}
              <span>Llamar</span>
            </a>
          ` : '')}

          ${webLink ? `
            <a 
              href="${escapeHtml(webLink)}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="soft-btn soft-btn-lvl-1-muted"
              style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; padding: 0.65rem 0.85rem;"
              title="Abrir sitio web oficial"
            >
              ${Icons.externalLink(15, 'var(--soft-purple-primary, #584294)')}
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }
}
