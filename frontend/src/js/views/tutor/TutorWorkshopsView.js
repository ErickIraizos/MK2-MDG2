import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';

/**
 * Cartelera de Talleres, Webinars y Cursos Clínicos Soft UI Médica
 * Espacio de formación y promoción psicoeducativa con asignación directa del terapeuta responsable.
 */
export class TutorWorkshopsView {
  constructor(container) {
    this.container = container;
    this.selectedFilter = 'TODOS';
    this.searchQuery = '';
    this.workshops = [];
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
      <div class="page-container panel-general" style="max-width: 1240px; margin: 0 auto; padding-bottom: 3.5rem;">
        
        <!-- CABECERA INSTITUCIONAL SOFT UI -->
        <div class="soft-header-row" style="margin-bottom: 2rem;">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.calendar(13, 'var(--soft-purple-primary)')}
                <span>Cartelera de Formación & Prevención</span>
              </span>
              <span class="soft-location-label">Centro PSI Aprende · Cochabamba</span>
            </div>
            <h1 class="soft-page-title" style="letter-spacing: -0.025em;">
              Talleres, Cursos & Webinars Psicoeducativos
            </h1>
            <p class="soft-page-subtitle" style="max-width: 820px; font-size: 0.94rem; line-height: 1.6;">
              Espacios vivenciales de aprendizaje orientados a padres, cuidadores, docentes y personas mayores. Desarrollados por nuestros terapeutas colegiados para fortalecer el neurodesarrollo y la armonía familiar.
            </p>
          </div>

          <div class="soft-header-actions" style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <a 
              href="https://wa.me/59171234567?text=Hola%20Centro%20PSI%20Aprende,%20deseo%20consultar%20sobre%20los%20talleres%20y%20cursos%20disponibles" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="soft-btn soft-btn-lvl-1"
              style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;"
            >
              ${Icons.whatsapp(16, '#FFFFFF')}
              <span>Consultar por WhatsApp</span>
            </a>
          </div>
        </div>

        <!-- FRANJA DE MÉTRICAS CLÍNICAS Y FORMATIVAS -->
        <div class="soft-kpi-grid-3" style="margin-bottom: 2.25rem;">
          <div class="soft-kpi-card">
            <span class="soft-status-dot-green" title="Programación disponible"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.calendar(22, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Eventos Programados</span>
              <div id="kpi-count-talleres" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Charlas y talleres en cartelera</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.video(22, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Modalidades Activas</span>
              <div id="kpi-modalidad-talleres" class="soft-kpi-value">Presencial y Virtual</div>
              <div class="soft-kpi-sub">Sesiones en consultorio y Google Meet</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <div class="soft-icon-box soft-icon-box-indigo">
              ${Icons.users(22, 'var(--soft-indigo-accent)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Cupos Limitados</span>
              <div id="kpi-cupos-talleres" class="soft-kpi-value">-</div>
              <div class="soft-kpi-sub">Grupos reducidos para interacción</div>
            </div>
          </div>
        </div>

        <!-- FILTROS Y BUSCADOR EN TIEMPO REAL -->
        <div class="soft-card-static" style="padding: 1.25rem 1.6rem; margin-bottom: 2rem;">
          <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; align-items: center;">
            
            <!-- Barra de Búsqueda -->
            <div style="flex: 1; min-width: min(100%, 270px); position: relative;">
              <span style="position: absolute; left: 0.95rem; top: 50%; transform: translateY(-50%); color: var(--soft-text-muted);">
                ${Icons.search(16, 'var(--soft-text-muted)')}
              </span>
              <input 
                type="text" 
                id="workshops-search-input" 
                placeholder="Buscar por temática, expositor o público objetivo..." 
                class="soft-input" 
                style="padding-left: 2.5rem; width: 100%;"
              />
            </div>

            <!-- Chips de Filtro Rápido -->
            <div id="workshop-filter-chips" style="display: flex; flex-wrap: wrap; gap: 0.55rem;">
              <button class="soft-filter-chip active" data-filter="TODOS">Todos los Eventos</button>
              <button class="soft-filter-chip" data-filter="Presencial">Presenciales</button>
              <button class="soft-filter-chip" data-filter="Virtual">Virtuales</button>
              <button class="soft-filter-chip" data-filter="Padres">Para Padres</button>
              <button class="soft-filter-chip" data-filter="Adultos Mayores">Adultos Mayores</button>
            </div>

          </div>
        </div>

        <!-- CUADRÍCULA DE TALLERES (2 PANELES POR FILA) -->
        <div id="workshops-grid-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 1.75rem;">
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--soft-text-body);">
            <div class="soft-spinner" style="margin: 0 auto 1rem auto;"></div>
            <p>Cargando cartelera de talleres y facilitadores...</p>
          </div>
        </div>

      </div>
    `;

    this.attachEvents();
    await this.loadData();
  }

  async loadData() {
    this.isLoading = true;
    try {
      const res = await apiClient.get('/workshops');
      if (res && res.data) {
        this.workshops = res.data;
        this.updateKpis();
        this.renderGrid();
      }
    } catch (err) {
      console.warn('[TutorWorkshopsView] Error cargando talleres desde API, usando respaldo:', err);
      // Respaldo preventivo si el servidor no responde
      this.renderGrid();
    } finally {
      this.isLoading = false;
    }
  }

  updateKpis() {
    const totalEl = this.container.querySelector('#kpi-count-talleres');
    const cuposEl = this.container.querySelector('#kpi-cupos-talleres');

    const total = this.workshops.length;
    let cuposLibres = 0;
    this.workshops.forEach(w => {
      const restantes = (w.cupos_totales || 0) - (w.cupos_ocupados || 0);
      if (restantes > 0) cuposLibres += restantes;
    });

    if (totalEl) totalEl.textContent = `${total} Talleres`;
    if (cuposEl) cuposEl.textContent = `${cuposLibres} Cupos Libres`;
  }

  renderGrid() {
    const grid = this.container.querySelector('#workshops-grid-container');
    if (!grid) return;

    const filtered = this.workshops.filter(item => {
      const matchFilter = (this.selectedFilter === 'TODOS') || 
        (item.tipo === this.selectedFilter) || 
        (item.categoria && item.categoria.includes(this.selectedFilter));

      const matchSearch = !this.searchQuery ||
        (item.titulo && item.titulo.toLowerCase().includes(this.searchQuery)) ||
        (item.subtitulo && item.subtitulo.toLowerCase().includes(this.searchQuery)) ||
        (item.expositor_display && item.expositor_display.toLowerCase().includes(this.searchQuery)) ||
        (item.expositor_nombre && item.expositor_nombre.toLowerCase().includes(this.searchQuery)) ||
        (Array.isArray(item.temas) && item.temas.some(t => t.toLowerCase().includes(this.searchQuery)));

      return matchFilter && matchSearch;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1.5rem; background: #FFFFFF; border-radius: 20px; border: 1px dashed rgba(88,66,148,0.25);">
          <div style="margin-bottom: 0.75rem; color: var(--soft-purple-primary);">
            ${Icons.calendar(44, 'var(--soft-purple-primary)')}
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.35rem;">
            No se encontraron eventos con los filtros seleccionados
          </h3>
          <p style="color: var(--soft-text-body); font-size: 0.9rem; max-width: 480px; margin: 0 auto;">
            Pruebe modificando su búsqueda o seleccionando "Todos los Eventos" para revisar la programación completa.
          </p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(w => this._renderWorkshopCard(w)).join('');
    this.attachCardEvents();
  }

  _renderWorkshopCard(item) {
    const cuposTotales = item.cupos_totales || 15;
    const cuposOcupados = item.cupos_ocupados || 0;
    const pctOcupado = Math.round((cuposOcupados / cuposTotales) * 100);
    const cuposRestantes = cuposTotales - cuposOcupados;

    // Número de teléfono de WhatsApp del terapeuta a cargo
    const rawPhone = item.telefono_final || item.telefono_contacto || item.terapeuta_telefono || '';
    const cleanPhone = rawPhone ? String(rawPhone).replace(/[\s\-\+]/g, '') : '';
    const phoneWithCountry = cleanPhone ? (cleanPhone.startsWith('591') ? cleanPhone : '591' + cleanPhone) : '59171234567';

    const whatsappMessage = encodeURIComponent(
      `Hola Centro PSI Aprende, deseo reservar un cupo para el evento "${item.titulo}" programado para el ${item.fecha}. Por favor bríndenme los detalles para asegurar mi participación.`
    );
    const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${whatsappMessage}`;

    const expositorNombre = item.expositor_display || item.expositor_nombre || 'Equipo Multidisciplinario PSI Aprende';
    const expositorCargo = item.expositor_cargo || 'Especialista en Neuropsicología y Psicopedagogía';
    const initials = expositorNombre.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('');
    const temas = Array.isArray(item.temas) ? item.temas.slice(0, 3) : [];

    const isVirtual = item.tipo === 'Virtual';
    const tipoBadgeClass = isVirtual ? 'soft-badge-mint' : 'soft-badge-lavender';
    const arancelText = item.arancel || '50 Bs';
    const isGratis = arancelText.toLowerCase().includes('libre') || arancelText.toLowerCase().includes('gratis');

    return `
      <div class="soft-card-static" style="display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; border-radius: 22px; padding: 0; transition: transform 0.22s ease, box-shadow 0.22s ease;">
        
        <!-- CUERPO PRINCIPAL DEL TALLER -->
        <div style="padding: 1.65rem 1.85rem 1.25rem 1.85rem;">
          
          <!-- BADGES SUPERIORES -->
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.95rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <span class="soft-badge ${tipoBadgeClass}" style="font-size: 0.73rem; font-weight: 700; text-transform: uppercase;">
                ${isVirtual ? Icons.video(12, 'currentColor') : Icons.building(12, 'currentColor')}
                <span>${this.escapeHtml(item.tipo)}</span>
              </span>
              <span class="soft-badge soft-badge-indigo" style="font-size: 0.72rem; font-weight: 700;">
                ${this.escapeHtml(item.categoria)}
              </span>
            </div>

            <span class="soft-badge ${isGratis ? 'soft-badge-emerald' : 'soft-badge-amber'}" style="font-size: 0.75rem; font-weight: 800;">
              ${this.escapeHtml(arancelText)}
            </span>
          </div>

          <!-- TÍTULO Y SUBTÍTULO -->
          <h3 style="margin: 0 0 0.35rem 0; font-size: 1.22rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.018em; line-height: 1.35;">
            ${this.escapeHtml(item.titulo)}
          </h3>

          ${item.subtitulo ? `
            <p style="margin: 0 0 1rem 0; font-size: 0.88rem; color: var(--soft-text-body); line-height: 1.5;">
              ${this.escapeHtml(item.subtitulo)}
            </p>
          ` : ''}

          <!-- TERAPEUTA RESPONSABLE DIRECTO -->
          <div style="background: var(--soft-lavender-surface); border-radius: 14px; padding: 0.8rem 1rem; margin-bottom: 1rem; border: 1px solid var(--soft-border-card-inner); display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              ${item.terapeuta_foto_url ? `
                <img src="${this.escapeHtml(item.terapeuta_foto_url)}" alt="Facilitador" style="width: 38px; height: 38px; border-radius: 12px; object-fit: cover; border: 1.5px solid var(--soft-purple-primary);" />
              ` : `
                <div style="width: 38px; height: 38px; border-radius: 12px; background: var(--soft-purple-primary); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; flex-shrink: 0;">
                  ${initials}
                </div>
              `}
              <div>
                <span style="font-size: 0.71rem; color: var(--soft-text-overline); font-weight: 700; text-transform: uppercase;">Facilitador a Cargo:</span>
                <div style="font-size: 0.88rem; font-weight: 800; color: var(--soft-text-title);">${this.escapeHtml(expositorNombre)}</div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 700; color: var(--soft-mint-deep);">
              <span>${Icons.whatsapp(14, 'var(--soft-mint-deep)')}</span>
              <span>${this.escapeHtml(rawPhone || '+591 71234567')}</span>
            </div>
          </div>

          <!-- DETALLES LOGÍSTICOS -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 0.65rem; font-size: 0.84rem; color: var(--soft-text-title); margin-bottom: 1.15rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: var(--soft-purple-primary); flex-shrink: 0;">${Icons.calendar(15, 'var(--soft-purple-primary)')}</span>
              <span style="font-weight: 700;">${this.escapeHtml(item.fecha)}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: var(--soft-mint-deep); flex-shrink: 0;">${Icons.clock(15, 'var(--soft-mint-deep)')}</span>
              <span style="font-weight: 600;">${this.escapeHtml(item.hora)}</span>
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: var(--soft-purple-primary); flex-shrink: 0;">${Icons.mapPin(15, 'var(--soft-purple-primary)')}</span>
              <span style="font-weight: 500;">${this.escapeHtml(item.lugar)}</span>
            </div>
          </div>

          <!-- TEMARIO RÁPIDO -->
          ${temas.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 1.15rem; background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.85rem 1rem;">
              <span style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-text-overline);">Temas Principales:</span>
              ${temas.map(t => `
                <div style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.82rem; color: var(--soft-text-body);">
                  <span style="color: var(--soft-mint-deep); flex-shrink: 0; margin-top: 2px;">${Icons.check(13, 'var(--soft-mint-deep)')}</span>
                  <span style="line-height: 1.4;">${this.escapeHtml(t)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- BARRA DE OCUPACIÓN DE CUPOS -->
          <div style="margin-top: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.35rem;">
              <span style="color: var(--soft-text-title);">Disponibilidad de Asientos:</span>
              <span style="color: ${cuposRestantes <= 3 ? '#DC2626' : 'var(--soft-purple-primary)'};">
                ${cuposRestantes > 0 ? `Quedan ${cuposRestantes} lugares disponibles` : 'Cupos Agotados'}
              </span>
            </div>
            <div style="width: 100%; height: 7px; background: rgba(88,66,148,0.1); border-radius: 4px; overflow: hidden;">
              <div style="width: ${Math.min(pctOcupado, 100)}%; height: 100%; background: linear-gradient(90deg, var(--soft-mint-deep) 0%, var(--soft-purple-primary) 100%); border-radius: 4px; transition: width 0.3s ease;"></div>
            </div>
          </div>

        </div>

        <!-- ACCIONES INFERIORES HORIZONTALES -->
        <div style="padding: 1rem 1.65rem 1.35rem 1.65rem; display: flex; gap: 0.65rem; border-top: 1px solid var(--soft-divider); background: var(--soft-lavender-surface); align-items: center; flex-wrap: wrap;">
          <a 
            href="${whatsappUrl}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="soft-btn soft-btn-lvl-1"
            style="flex: 1; min-width: min(100%, 170px); text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;"
          >
            ${Icons.whatsapp(16, '#FFFFFF')}
            <span>Inscribirme por WhatsApp</span>
          </a>

          <button 
            type="button" 
            class="soft-btn soft-btn-lvl-1-muted btn-open-workshop-modal" 
            data-workshop-id="${item.id}"
            style="display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;"
          >
            ${Icons.info(15, 'var(--soft-purple-primary)')}
            <span>Ver Temario</span>
          </button>
        </div>

      </div>
    `;
  }

  attachEvents() {
    // Filtros por chips
    const filterChips = this.container.querySelectorAll('.soft-filter-chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        filterChips.forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.selectedFilter = e.currentTarget.dataset.filter || 'TODOS';
        this.renderGrid();
      });
    });

    // Búsqueda en tiempo real
    const searchInput = this.container.querySelector('#workshops-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderGrid();
      });
    }
  }

  attachCardEvents() {
    const buttons = this.container.querySelectorAll('.btn-open-workshop-modal');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.workshopId;
        const w = this.workshops.find(item => String(item.id) === String(id));
        if (w) {
          this.showWorkshopDetailsModal(w);
        }
      });
    });
  }

  showWorkshopDetailsModal(w) {
    const existing = document.getElementById('global-workshop-details-backdrop');
    if (existing) existing.remove();

    const rawPhone = w.telefono_final || w.telefono_contacto || w.terapeuta_telefono || '';
    const cleanPhone = rawPhone ? String(rawPhone).replace(/[\s\-\+]/g, '') : '';
    const phoneWithCountry = cleanPhone ? (cleanPhone.startsWith('591') ? cleanPhone : '591' + cleanPhone) : '59171234567';

    const whatsappMessage = encodeURIComponent(
      `Hola Centro PSI Aprende, solicito formalizar mi inscripción para el evento "${w.titulo}" del día ${w.fecha}.`
    );
    const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${whatsappMessage}`;

    const expositorNombre = w.expositor_display || w.expositor_nombre || 'Equipo Multidisciplinario PSI Aprende';
    const expositorCargo = w.expositor_cargo || 'Especialista Clínico Colegiado';
    const temas = Array.isArray(w.temas) ? w.temas : [];

    const backdrop = document.createElement('div');
    backdrop.id = 'global-workshop-details-backdrop';
    backdrop.className = 'modal-backdrop';
    backdrop.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(26, 32, 64, 0.75) !important;
      backdrop-filter: blur(10px) !important;
      -webkit-backdrop-filter: blur(10px) !important;
      z-index: 99999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 1.25rem !important;
      box-sizing: border-box !important;
      animation: fadeIn 0.22s ease-out;
    `;

    backdrop.innerHTML = `
      <div class="soft-modal-card" style="max-width: 720px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; background: #FFFFFF; border-radius: 24px; border: 1px solid rgba(139, 114, 214, 0.22); box-shadow: 0 24px 50px -10px rgba(50, 40, 95, 0.45);">
        
        <!-- CABECERA -->
        <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.calendar(20, 'var(--soft-purple-primary, #584294)')}
            </div>
            <div>
              <span class="soft-badge soft-badge-lavender" style="font-size: 0.7rem; font-weight: 700;">
                ${this.escapeHtml(w.categoria || 'Evento Clínico')}
              </span>
              <h3 style="margin: 0.2rem 0 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; line-height: 1.3;">
                ${this.escapeHtml(w.titulo)}
              </h3>
            </div>
          </div>

          <button type="button" class="soft-modal-close-btn" id="btn-close-workshop-modal" title="Cerrar ventana">
            ${Icons.close(18)}
          </button>
        </div>

        <!-- CONTENIDO CON SCROLL -->
        <div style="padding: 1.5rem 1.85rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.25rem;">
          
          <div>
            <h4 style="margin: 0 0 0.4rem 0; font-size: 1rem; font-weight: 800; color: var(--soft-purple-primary);">
              ${this.escapeHtml(w.subtitulo || '')}
            </h4>
            ${w.dirigido_a ? `
              <p style="margin: 0; font-size: 0.88rem; color: var(--soft-text-body); line-height: 1.55;">
                <strong>Población Objetivo:</strong> ${this.escapeHtml(w.dirigido_a)}
              </p>
            ` : ''}
          </div>

          <!-- DETALLES LOGÍSTICOS -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 0.85rem; background: var(--soft-lavender-surface); border-radius: 14px; padding: 1.05rem 1.2rem; border: 1px solid var(--soft-border-card-inner);">
            <div>
              <strong style="display: block; font-size: 0.74rem; color: var(--soft-text-overline); text-transform: uppercase;">Fecha y Hora:</strong>
              <div style="font-size: 0.86rem; color: var(--soft-text-title); font-weight: 700; margin-top: 0.15rem;">${this.escapeHtml(w.fecha)}</div>
              <div style="font-size: 0.8rem; color: var(--soft-text-muted);">${this.escapeHtml(w.hora)}</div>
            </div>

            <div>
              <strong style="display: block; font-size: 0.74rem; color: var(--soft-text-overline); text-transform: uppercase;">Lugar de Encuentro:</strong>
              <div style="font-size: 0.86rem; color: var(--soft-text-title); font-weight: 700; margin-top: 0.15rem;">${this.escapeHtml(w.lugar)}</div>
              ${w.direccion ? `<div style="font-size: 0.8rem; color: var(--soft-text-muted);">${this.escapeHtml(w.direccion)}</div>` : ''}
            </div>

            <div>
              <strong style="display: block; font-size: 0.74rem; color: var(--soft-text-overline); text-transform: uppercase;">Arancel e Inversión:</strong>
              <div style="font-size: 0.95rem; color: var(--soft-purple-primary); font-weight: 800; margin-top: 0.15rem;">${this.escapeHtml(w.arancel || '50 Bs')}</div>
              ${w.arancel_detalle ? `<div style="font-size: 0.78rem; color: var(--soft-text-muted);">${this.escapeHtml(w.arancel_detalle)}</div>` : ''}
            </div>

            <div>
              <strong style="display: block; font-size: 0.74rem; color: var(--soft-text-overline); text-transform: uppercase;">Facilitador Clínico Responsable:</strong>
              <div style="font-size: 0.86rem; color: var(--soft-text-title); font-weight: 700; margin-top: 0.15rem;">${this.escapeHtml(expositorNombre)}</div>
              <div style="font-size: 0.78rem; color: var(--soft-text-muted);">${this.escapeHtml(expositorCargo)}</div>
            </div>
          </div>

          <!-- TEMARIO COMPLETO Y OBJETIVOS -->
          ${temas.length > 0 ? `
            <div>
              <div style="font-size: 0.82rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-mint-deep); margin-bottom: 0.65rem; display: flex; align-items: center; gap: 0.45rem;">
                ${Icons.bookOpen(16, 'var(--soft-mint-deep)')}
                <span>Temario y Metodología del Taller:</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                ${temas.map(t => `
                  <div style="display: flex; align-items: flex-start; gap: 0.65rem; background: var(--soft-lavender-surface); border-radius: 12px; padding: 0.75rem 1rem;">
                    <span style="color: var(--soft-mint-deep); flex-shrink: 0; margin-top: 2px;">${Icons.check(15, 'var(--soft-mint-deep)')}</span>
                    <span style="font-size: 0.86rem; color: var(--soft-text-title); line-height: 1.45;">${this.escapeHtml(t)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

        </div>

        <!-- PIE FIJO CON CONTACTO DIRECTO -->
        <div style="padding: 1rem 1.65rem; border-top: 1px solid var(--soft-divider, #F0EEF9); background: var(--soft-lavender-surface, #F8F6FE); display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-shrink: 0; flex-wrap: wrap;">
          <a 
            href="${whatsappUrl}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="soft-btn soft-btn-lvl-1"
            style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.45rem;"
          >
            ${Icons.whatsapp(16, '#FFFFFF')}
            <span>Reservar Mi Lugar por WhatsApp</span>
          </a>

          <button type="button" id="btn-close-workshop-footer" class="soft-btn soft-btn-lvl-1-muted">
            Cerrar
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(backdrop);

    const closeModal = () => {
      backdrop.style.opacity = '0';
      backdrop.style.transition = 'opacity 0.18s ease-out';
      setTimeout(() => backdrop.remove(), 190);
    };

    backdrop.querySelector('#btn-close-workshop-modal')?.addEventListener('click', closeModal);
    backdrop.querySelector('#btn-close-workshop-footer')?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  }
}
