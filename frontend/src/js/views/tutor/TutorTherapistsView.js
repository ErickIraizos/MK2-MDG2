import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';
import { store } from '../../store.js';

export class TutorTherapistsView {
  constructor(container) {
    this.container = container;
    this.therapists = [];
    this.rooms = [];
    this.specialties = [];
    this.assignedTherapists = new Map(); // therapistId -> childName
    this.selectedSpecialty = 'TODAS';
    this.selectedTurno = 'TODOS';
    this.searchQuery = '';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-container panel-general">
        <!-- Encabezado Institucional Soft UI para Familias y Tutores -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.therapist(13, 'var(--soft-purple-primary)')}
                <span>Portal Familiar</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende" · Cochabamba</span>
            </div>
            <h1 class="soft-page-title">Directorio de Especialistas Acreditados</h1>
            <p class="soft-page-subtitle" style="max-width: 740px;">
              Conoce al equipo de profesionales colegiados del Centro "PSI Aprende". Nuestro personal cuenta con acreditación oficial ante el Colegio de Psicólogos de Bolivia y formación continua para el cuidado y desarrollo de tu familia.
            </p>
          </div>

          <div class="soft-header-actions">
            <span class="soft-badge soft-badge-emerald" style="padding: 0.48rem 0.95rem; font-size: 0.78rem;">
              ${Icons.shield(15, 'var(--soft-emerald-dark)')}
              <span>Atención bajo Secreto Profesional · Ley 3131</span>
            </span>
          </div>
        </div>

        <!-- Franja Informativa de Respaldo Clínico -->
        <div class="soft-kpi-grid-3">
          <div class="soft-kpi-card">
            <span class="soft-status-dot-green" title="Directorio clínico activo"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.therapist(22, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Directorio Multidisciplinario</span>
              <div id="tutor-kpi-count-therapists" class="soft-kpi-value">Profesionales</div>
              <div class="soft-kpi-sub">Equipo clínico especializado</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.badge(22, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Matrículas Oficiales CPB</span>
              <div class="soft-kpi-value">100% Colegiados</div>
              <div class="soft-kpi-sub">Respaldo ético y deontológico</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <div class="soft-icon-box soft-icon-box-indigo">
              ${Icons.clinic(22, 'var(--soft-indigo-accent)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Sede Central · Cochabamba</span>
              <div id="tutor-kpi-count-rooms" class="soft-kpi-value">Consultorios</div>
              <div class="soft-kpi-sub">${store.getState().publicConfig?.INSTITUCION_DIRECCION?.split(',')[0] || 'Sede Central'}</div>
            </div>
          </div>
        </div>

        <!-- Barra de Búsqueda y Filtros Interactivos Soft UI -->
        <div class="soft-card-static" style="padding: 1.35rem 1.55rem; margin-bottom: 1.85rem;">
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <!-- Buscador en tiempo real -->
            <div class="soft-search-box" style="flex: 1; min-width: min(100%, 260px);">
              <span class="soft-search-box-icon">
                ${Icons.search(16)}
              </span>
              <input
                type="text"
                id="input-search-therapist"
                class="soft-input"
                placeholder="Buscar especialista por nombre, matrícula o área..."
                value="${this._escapeHtml(this.searchQuery)}"
              />
            </div>

            <!-- Filtro de Turno (Nivel 1 Monocromático Morado) -->
            <div style="display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap;">
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--soft-text-overline); text-transform: uppercase; letter-spacing: 0.04em; margin-right: 0.2rem;">Turno:</span>
              <button type="button" class="soft-btn soft-btn-sm btn-filter-turno ${this.selectedTurno === 'TODOS' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" data-turno="TODOS" style="border-radius: 9999px;">
                Todos
              </button>
              <button type="button" class="soft-btn soft-btn-sm btn-filter-turno ${this.selectedTurno === 'MAÑANA' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" data-turno="MAÑANA" style="border-radius: 9999px;">
                Mañana
              </button>
              <button type="button" class="soft-btn soft-btn-sm btn-filter-turno ${this.selectedTurno === 'TARDE' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" data-turno="TARDE" style="border-radius: 9999px;">
                Tarde
              </button>
            </div>
          </div>

          <!-- Filtro de Especialidades en Píldoras (Dinámico al cargar datos) -->
          <div id="tutor-specialty-pills-row" style="display: flex; gap: 0.45rem; flex-wrap: wrap; align-items: center; padding-top: 0.85rem; border-top: 1px solid var(--soft-divider);">
            ${this.renderSpecialtyPillsHtml()}
          </div>
        </div>

        <!-- Cuadrícula de Especialistas para Familias -->
        <div id="tutor-therapists-grid" class="soft-rooms-grid" style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 1.45rem;">
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--soft-text-body);">
            Cargando información del equipo clínico...
          </div>
        </div>
      </div>
      <div id="modal-container-tutor-therapist"></div>
    `;

    await this.loadData();
    this.attachEvents();
  }

  renderSpecialtyPillsHtml() {
    return `
      <span style="font-size: 0.75rem; font-weight: 700; color: var(--soft-text-overline); text-transform: uppercase; letter-spacing: 0.04em; margin-right: 0.25rem;">
        Especialidad:
      </span>
      <button type="button" class="soft-btn soft-btn-sm btn-filter-specialty ${this.selectedSpecialty === 'TODAS' ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" data-spec="TODAS" style="border-radius: 9999px;">
        Todas
      </button>
      ${this.specialties.map(s => {
        const isSel = this.selectedSpecialty === s.nombre;
        return `
          <button type="button" class="soft-btn soft-btn-sm btn-filter-specialty ${isSel ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}" data-spec="${this._escapeHtml(s.nombre)}" style="border-radius: 9999px;">
            ${this._escapeHtml(s.nombre)}
          </button>
        `;
      }).join('')}
    `;
  }

  async loadData() {
    try {
      const [therapistsRes, roomsRes, specsRes, familyPlansRes] = await Promise.all([
        apiClient.get('/therapists').catch(() => ({ success: false, data: [] })),
        apiClient.get('/rooms').catch(() => ({ success: false, data: [] })),
        apiClient.get('/therapists/specialties').catch(() => ({ success: false, data: [] })),
        apiClient.get('/clinical-records/portal/family-plans').catch(() => ({ success: false, data: [] }))
      ]);

      if (therapistsRes?.success || Array.isArray(therapistsRes?.data)) {
        this.therapists = therapistsRes.data || [];
        const elTherapists = document.getElementById('tutor-kpi-count-therapists');
        if (elTherapists) elTherapists.textContent = `${this.therapists.length} Profesionales`;
      }
      if (roomsRes?.success || Array.isArray(roomsRes?.data)) {
        this.rooms = roomsRes.data || [];
        const elRooms = document.getElementById('tutor-kpi-count-rooms');
        if (elRooms) elRooms.textContent = `${this.rooms.length} Consultorios`;
      }
      if (specsRes?.success || Array.isArray(specsRes?.data)) {
        this.specialties = specsRes.data || [];
        const pillsRow = document.getElementById('tutor-specialty-pills-row');
        if (pillsRow) {
          pillsRow.innerHTML = this.renderSpecialtyPillsHtml();
        }
      }

      // Identificar especialistas asignados a los hijos del tutor
      this.assignedTherapists.clear();
      if (familyPlansRes?.data && Array.isArray(familyPlansRes.data)) {
        familyPlansRes.data.forEach(item => {
          if (item.paciente?.terapeuta_asignado?.id) {
            this.assignedTherapists.set(
              item.paciente.terapeuta_asignado.id,
              `${item.paciente.nombres || ''} ${item.paciente.apellidos || ''}`.trim()
            );
          }
        });
      }

      this.renderTherapistCards();
    } catch (err) {
      console.error(err);
      Toast.error('No se pudo cargar el directorio de especialistas.');
    }
  }

  getFilteredTherapists() {
    return this.therapists.filter(t => {
      // Filtro por Especialidad
      if (this.selectedSpecialty !== 'TODAS' && t.especialidad_nombre !== this.selectedSpecialty) {
        return false;
      }
      // Filtro por Turno
      if (this.selectedTurno !== 'TODOS' && t.turnos_atencion !== this.selectedTurno) {
        return false;
      }
      // Filtro por Búsqueda de texto
      if (this.searchQuery.trim()) {
        const query = this.searchQuery.toLowerCase();
        const fullName = `${t.nombres} ${t.apellidos}`.toLowerCase();
        const spec = (t.especialidad_nombre || '').toLowerCase();
        const reg = (t.registro_profesional || '').toLowerCase();
        if (!fullName.includes(query) && !spec.includes(query) && !reg.includes(query)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      // Priorizar a los especialistas de cabecera de la familia
      const aAssigned = this.assignedTherapists.has(a.id) ? 1 : 0;
      const bAssigned = this.assignedTherapists.has(b.id) ? 1 : 0;
      return bAssigned - aAssigned;
    });
  }

  renderTherapistCards() {
    const grid = document.getElementById('tutor-therapists-grid');
    if (!grid) return;

    const filtered = this.getFilteredTherapists();

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon">
            ${Icons.therapist(30, 'var(--soft-purple-primary)')}
          </div>
          <h4 class="empty-state-title">No se encontraron especialistas con los filtros seleccionados</h4>
          <p class="empty-state-desc">Prueba modificando los criterios de turno, especialidad o el término de búsqueda.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((t, idx) => {
      const isAssigned = this.assignedTherapists.has(t.id);
      const childName = this.assignedTherapists.get(t.id);
      const isMintCard = isAssigned || t.color_agenda === '#0284c7' || t.color_agenda === '#10b981' || idx % 2 === 1;

      const initials = ((t.nombres || '').charAt(0) + (t.apellidos || '').charAt(0)).toUpperCase() || 'E';
      const avatarBg = isMintCard
        ? 'linear-gradient(135deg, #15968D 0%, #2DB9AE 100%)'
        : 'var(--soft-btn-lvl-1-bg)';

      let turnoLabel = 'Lunes a Viernes: 08:30 a 12:30 y 14:30 a 18:30';
      if (t.turnos_atencion === 'MAÑANA') {
        turnoLabel = 'Turno Mañana: 08:30 a 12:30';
      } else if (t.turnos_atencion === 'TARDE') {
        turnoLabel = 'Turno Tarde: 14:30 a 18:30';
      }

      const room = this.rooms.find(r => r.id === t.ambiente_preferido_id || r.id === t.ambiente_preferencial_id || r.codigo === t.ambiente_codigo);
      const roomLabel = room ? `${room.codigo} · ${room.nombre}` : (t.ambiente_codigo ? `${t.ambiente_codigo} · Atención Ambulatoria` : 'Consultorio Clínico Principal');

      return `
        <div class="soft-room-card ${isMintCard ? 'soft-room-mint' : ''}" style="padding: 1.55rem; position: relative; ${isAssigned ? 'border-color: rgba(26, 166, 156, 0.34); background: linear-gradient(180deg, #FFFFFF 0%, #F6FCFB 100%);' : ''}">
          <div>
            ${isAssigned ? `
              <div style="background: var(--soft-emerald-bg); border: 1px solid rgba(16, 185, 129, 0.24); border-radius: 12px; padding: 0.42rem 0.78rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.45rem; font-size: 0.76rem; font-weight: 700; color: var(--soft-emerald-dark);">
                ${Icons.checkCircle(14, 'var(--soft-emerald-dark)')}
                <span>Especialista de Cabecera de ${this._escapeHtml(childName)}</span>
              </div>
            ` : ''}

            <!-- Cabecera con Foto Real / Avatar Suave, Matrícula CPB y Nombre -->
            <div style="display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.05rem;">
              <div style="width: 58px; height: 58px; border-radius: 18px; overflow: hidden; flex-shrink: 0; border: 2px solid var(--soft-purple-primary); box-shadow: 0 6px 16px rgba(88,66,148,0.18);">
                ${t.foto_url ? `
                  <img src="${this._escapeHtml(t.foto_url)}" alt="${this._escapeHtml(t.nombres)}" style="width: 100%; height: 100%; object-fit: cover;" />
                ` : `
                  <div style="width: 100%; height: 100%; background: ${avatarBg}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.18rem;">
                    ${initials}
                  </div>
                `}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="margin-bottom: 0.32rem; display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                  <span class="soft-badge soft-badge-lavender" style="padding: 0.2rem 0.65rem; font-size: 0.71rem;">
                    ${Icons.badge(12, 'var(--soft-purple-primary)')}
                    <span>${this._escapeHtml(t.registro_profesional)}</span>
                  </span>
                  ${t.experiencia_anios ? `
                    <span class="soft-badge soft-badge-indigo" style="font-size: 0.68rem; padding: 0.18rem 0.55rem; font-weight: 600;">
                      ${this._escapeHtml(t.experiencia_anios)}
                    </span>
                  ` : ''}
                </div>
                <h3 style="font-size: 1.12rem; font-weight: 800; color: var(--soft-text-title); margin: 0; line-height: 1.25;">
                  Lic. ${this._escapeHtml(t.nombres)} ${this._escapeHtml(t.apellidos)}
                </h3>
              </div>
            </div>

            <!-- Especialidad Clínica & Enfoque -->
            <div style="margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
              <span class="soft-badge soft-badge-mint">
                ${this._escapeHtml(t.especialidad_nombre || 'Especialista Clínico')}
              </span>
              ${t.enfoque_terapeutico ? `
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem; font-weight: 700;">
                  ${this._escapeHtml(t.enfoque_terapeutico)}
                </span>
              ` : ''}
            </div>

            <!-- Resumen Bio y Formación Académica -->
            <div style="margin: 0 0 1.15rem 0;">
              ${t.titulos_academicos ? `
                <div style="font-size: 0.78rem; font-weight: 700; color: var(--soft-text-title); line-height: 1.4; margin-bottom: 0.3rem;">
                  ${this._escapeHtml(t.titulos_academicos)}
                </div>
              ` : ''}
              <p style="font-size: 0.84rem; color: var(--soft-text-body); line-height: 1.5; margin: 0;">
                ${this._escapeHtml(t.bio || 'Especialista colegiado dedicado a la valoración neurocognitiva y acompañamiento clínico infantil, juvenil y familiar en PSI Aprende.')}
              </p>
            </div>

            <!-- Detalles Prácticos de Atención (Consultorio y Turnos) -->
            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.88rem 1rem; font-size: 0.82rem;">
              <div style="display: flex; align-items: flex-start; gap: 0.55rem; margin-bottom: 0.5rem;">
                <span style="color: var(--soft-purple-primary); margin-top: 2px; flex-shrink: 0;">${Icons.clinic(14)}</span>
                <div>
                  <span style="color: var(--soft-text-muted); font-size: 0.74rem; font-weight: 600; display: block;">Ambiente de Atención:</span>
                  <strong style="color: var(--soft-text-title); font-weight: 700;">${this._escapeHtml(roomLabel)}</strong>
                </div>
              </div>
              <div style="display: flex; align-items: flex-start; gap: 0.55rem; padding-top: 0.45rem; border-top: 1px solid var(--soft-divider);">
                <span style="color: var(--soft-mint-deep); margin-top: 2px; flex-shrink: 0;">${Icons.pulse(14)}</span>
                <div>
                  <span style="color: var(--soft-text-muted); font-size: 0.74rem; font-weight: 600; display: block;">Turno Habitual:</span>
                  <span style="font-weight: 600; color: var(--soft-text-title);">${this._escapeHtml(turnoLabel)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Acciones Interactivas para el Tutor (Nivel 1 Monocromático Morado) -->
          <div style="margin-top: 1.2rem; padding-top: 1rem; border-top: 1px solid var(--soft-divider); display: flex; flex-direction: column; gap: 0.55rem;">
            <button
              type="button"
              class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-view-therapist-detail"
              data-therapist-id="${t.id}"
              style="width: 100%;"
            >
              ${Icons.eye(14, 'var(--soft-purple-primary)')}
              <span>Ver Ficha Completa &amp; Horarios</span>
            </button>
            <button
              type="button"
              class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-ask-mindbot-therapist"
              data-specialist="${this._escapeHtml(t.nombres + ' ' + t.apellidos)}"
              data-spec="${this._escapeHtml(t.especialidad_nombre || '')}"
              style="width: 100%;"
            >
              ${Icons.sparkles(14, '#FFFFFF')}
              <span>Consultar Disponibilidad con IA</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  attachEvents() {
    // Búsqueda en tiempo real
    const searchInput = document.getElementById('input-search-therapist');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderTherapistCards();
      });
    }

    // Delegación para píldoras de Especialidad (soporta píldoras cargadas dinámicamente)
    const pillsRow = document.getElementById('tutor-specialty-pills-row');
    if (pillsRow) {
      pillsRow.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-filter-specialty');
        if (!btn) return;
        this.selectedSpecialty = btn.getAttribute('data-spec') || 'TODAS';
        pillsRow.querySelectorAll('.btn-filter-specialty').forEach(b => {
          const isSel = b.getAttribute('data-spec') === this.selectedSpecialty;
          b.classList.toggle('soft-btn-lvl-1', isSel);
          b.classList.toggle('active', isSel);
          b.classList.toggle('soft-btn-lvl-1-muted', !isSel);
        });
        this.renderTherapistCards();
      });
    }

    // Filtros por Turno
    this.container.querySelectorAll('.btn-filter-turno').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.selectedTurno = e.currentTarget.getAttribute('data-turno');
        this.container.querySelectorAll('.btn-filter-turno').forEach(b => {
          const isSel = b.getAttribute('data-turno') === this.selectedTurno;
          b.classList.toggle('soft-btn-lvl-1', isSel);
          b.classList.toggle('active', isSel);
          b.classList.toggle('soft-btn-lvl-1-muted', !isSel);
        });
        this.renderTherapistCards();
      });
    });

    // Delegación para botones de las tarjetas
    const grid = document.getElementById('tutor-therapists-grid');
    if (!grid) return;

    grid.addEventListener('click', (e) => {
      // Ficha completa
      const detailBtn = e.target.closest('.btn-view-therapist-detail');
      if (detailBtn) {
        const id = Number(detailBtn.getAttribute('data-therapist-id'));
        const therapist = this.therapists.find(t => t.id === id);
        if (therapist) {
          this.openTherapistDetailModal(therapist);
        }
        return;
      }

      // Consulta con MindBot
      const askBtn = e.target.closest('.btn-ask-mindbot-therapist');
      if (askBtn) {
        const specialist = askBtn.getAttribute('data-specialist');
        const specialty = askBtn.getAttribute('data-spec');

        const fabBtn = document.getElementById('mindbot-fab-btn');
        const textInput = document.getElementById('mindbot-text-input');
        const chatWindow = document.getElementById('mindbot-chat-window');

        if (chatWindow && !chatWindow.classList.contains('active')) {
          fabBtn?.click();
        }

        if (textInput) {
          textInput.value = `Deseo consultar sobre los turnos de atención y valoración con ${specialist} - ${specialty}`;
          setTimeout(() => textInput.focus(), 300);
        }
      }
    });
  }

  openTherapistDetailModal(therapist) {
    const modalContainer = document.getElementById('modal-container-tutor-therapist');
    if (!modalContainer) return;

    const isAssigned = this.assignedTherapists.has(therapist.id);
    const childName = this.assignedTherapists.get(therapist.id);
    const room = this.rooms.find(r => r.id === therapist.ambiente_preferido_id || r.id === therapist.ambiente_preferencial_id || r.codigo === therapist.ambiente_codigo);
    const roomLabel = room ? `${room.codigo} · ${room.nombre}` : (therapist.ambiente_codigo || 'Consultorio Clínico Principal');

    let turnoLabel = 'Lunes a Viernes: 08:30 a 12:30 y 14:30 a 18:30';
    if (therapist.turnos_atencion === 'MAÑANA') turnoLabel = 'Mañanas: 08:30 a 12:30';
    else if (therapist.turnos_atencion === 'TARDE') turnoLabel = 'Tardes: 14:30 a 18:30';

    const initials = `${therapist.nombres.charAt(0)}${therapist.apellidos.charAt(0)}`.toUpperCase();

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="therapist-detail-backdrop" style="z-index: 2000;">
        <div class="soft-modal-card" style="max-width: 600px; max-height: 90vh;">
          
          <!-- CABECERA DEL MODAL (Nivel 2) -->
          <div style="padding: 1.35rem 1.75rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.9rem;">
              <div style="width: 56px; height: 56px; border-radius: 17px; overflow: hidden; flex-shrink: 0; border: 2px solid var(--soft-purple-primary); box-shadow: 0 4px 14px rgba(88,66,148,0.2);">
                ${therapist.foto_url ? `
                  <img src="${this._escapeHtml(therapist.foto_url)}" alt="${this._escapeHtml(therapist.nombres)}" style="width: 100%; height: 100%; object-fit: cover;" />
                ` : `
                  <div style="width: 100%; height: 100%; background: var(--soft-btn-lvl-2-bg); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.15rem;">
                    ${initials}
                  </div>
                `}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.18rem; font-weight: 800; margin: 0 0 0.25rem 0;">
                  Lic. ${this._escapeHtml(therapist.nombres)} ${this._escapeHtml(therapist.apellidos)}
                </h3>
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem;">
                  <span class="soft-badge soft-badge-mint" style="padding: 0.2rem 0.65rem; font-size: 0.71rem;">
                    ${this._escapeHtml(therapist.especialidad_nombre || 'Especialista')}
                  </span>
                  <span class="soft-badge soft-badge-lavender" style="padding: 0.2rem 0.65rem; font-size: 0.71rem;">
                    ${this._escapeHtml(therapist.registro_profesional)}
                  </span>
                  ${therapist.experiencia_anios ? `
                    <span class="soft-badge soft-badge-indigo" style="padding: 0.2rem 0.65rem; font-size: 0.71rem;">
                      ${this._escapeHtml(therapist.experiencia_anios)}
                    </span>
                  ` : ''}
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-therapist-detail" class="soft-modal-close-btn" aria-label="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- CUERPO DEL MODAL -->
          <div style="padding: 1.5rem 1.75rem; overflow-y: auto; flex: 1;">
            ${isAssigned ? `
              <div style="background: var(--soft-emerald-bg); border: 1px solid rgba(16, 185, 129, 0.24); border-radius: 14px; padding: 0.7rem 0.95rem; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.55rem; font-size: 0.82rem; font-weight: 700; color: var(--soft-emerald-dark);">
                ${Icons.checkCircle(16, 'var(--soft-emerald-dark)')}
                <span>Profesional asignado al seguimiento y Plan Terapéutico de ${this._escapeHtml(childName)}</span>
              </div>
            ` : ''}

            <!-- Logros Académicos y Grados -->
            ${therapist.titulos_academicos ? `
              <div style="margin-bottom: 1.15rem;">
                <span style="font-size: 0.72rem; font-weight: 800; color: var(--soft-purple-primary); text-transform: uppercase; letter-spacing: 0.045em; display: block; margin-bottom: 0.35rem;">
                  Títulos Universitarios &amp; Grados Académicos
                </span>
                <div style="font-size: 0.88rem; font-weight: 700; color: var(--soft-text-title); line-height: 1.45;">
                  ${this._escapeHtml(therapist.titulos_academicos)}
                </div>
              </div>
            ` : ''}

            <!-- Diplomados y Certificaciones -->
            ${therapist.diplomados_certificaciones ? `
              <div style="margin-bottom: 1.15rem;">
                <span style="font-size: 0.72rem; font-weight: 800; color: var(--soft-purple-primary); text-transform: uppercase; letter-spacing: 0.045em; display: block; margin-bottom: 0.35rem;">
                  Diplomados &amp; Certificaciones Clínicas
                </span>
                <div style="font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.48; background: var(--soft-lavender-surface); padding: 0.6rem 0.85rem; border-radius: 10px; border: 1px solid var(--soft-border-card-inner);">
                  ${this._escapeHtml(therapist.diplomados_certificaciones)}
                </div>
              </div>
            ` : ''}

            <!-- Enfoque Terapéutico -->
            ${therapist.enfoque_terapeutico ? `
              <div style="margin-bottom: 1.15rem;">
                <span style="font-size: 0.72rem; font-weight: 800; color: var(--soft-purple-primary); text-transform: uppercase; letter-spacing: 0.045em; display: block; margin-bottom: 0.35rem;">
                  Enfoque Clínico &amp; Metodología
                </span>
                <div style="font-size: 0.85rem; color: var(--soft-text-title); font-weight: 600;">
                  ${this._escapeHtml(therapist.enfoque_terapeutico)}
                </div>
              </div>
            ` : ''}

            <!-- Perfil Profesional / Biografía -->
            <div style="margin-bottom: 1.3rem;">
              <span style="font-size: 0.72rem; font-weight: 800; color: var(--soft-purple-primary); text-transform: uppercase; letter-spacing: 0.045em; display: block; margin-bottom: 0.4rem;">
                Resumen de Trayectoria &amp; Vocación
              </span>
              <p style="font-size: 0.86rem; color: var(--soft-text-body); line-height: 1.56; margin: 0;">
                ${this._escapeHtml(therapist.bio || 'Profesional colegiado por el Colegio de Psicólogos de Bolivia, especializado en evaluación diagnóstica, intervención psicopedagógica y acompañamiento clínico infantil en PSI Aprende.')}
              </p>
            </div>

            <!-- Información Operativa -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
              <div class="soft-subcard" style="padding: 0.95rem 1.05rem;">
                <div style="display: flex; align-items: center; gap: 0.45rem; color: var(--soft-purple-primary); margin-bottom: 0.32rem;">
                  ${Icons.clinic(16, 'var(--soft-purple-primary)')}
                  <strong style="font-size: 0.82rem;">Consultorio Físico</strong>
                </div>
                <div style="font-size: 0.88rem; font-weight: 800; color: var(--soft-text-title);">
                  ${this._escapeHtml(roomLabel)}
                </div>
                <span style="font-size: 0.74rem; color: var(--soft-text-muted); margin-top: 0.18rem;">Centro PSI Aprende</span>
              </div>

              <div class="soft-subcard" style="padding: 0.95rem 1.05rem;">
                <div style="display: flex; align-items: center; gap: 0.45rem; color: var(--soft-mint-deep); margin-bottom: 0.32rem;">
                  ${Icons.calendar(16, 'var(--soft-mint-deep)')}
                  <strong style="font-size: 0.82rem;">Turnos Disponibles</strong>
                </div>
                <div style="font-size: 0.88rem; font-weight: 800; color: var(--soft-text-title);">
                  ${this._escapeHtml(turnoLabel)}
                </div>
                <span style="font-size: 0.74rem; color: var(--soft-text-muted); margin-top: 0.18rem;">Previa coordinación de agenda</span>
              </div>
            </div>

            <div style="background: #F1FBF9; border: 1px solid rgba(21, 150, 141, 0.18); border-radius: 14px; padding: 0.85rem 1.05rem; font-size: 0.8rem; color: var(--soft-text-title); line-height: 1.48; display: flex; align-items: flex-start; gap: 0.6rem;">
              <span style="color: var(--soft-mint-deep); flex-shrink: 0; margin-top: 1px;">${Icons.shield(16, 'var(--soft-mint-deep)')}</span>
              <span>La atención se realiza bajo estricto cumplimiento del secreto profesional según la Ley N° 3131 del Ejercicio Profesional Médico y normas éticas del Colegio de Psicólogos de Bolivia.</span>
            </div>
          </div>

          <!-- PIE DE MODAL CON ACCIÓN DE NIVEL 2 -->
          <div style="padding: 1.05rem 1.75rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; gap: 0.75rem; background: #FFFFFF;">
            <button type="button" id="btn-close-therapist-detail-footer" class="soft-btn soft-btn-lvl-2-soft">Cerrar</button>
            <button
              type="button"
              id="btn-ask-mindbot-modal"
              class="soft-btn soft-btn-lvl-2"
            >
              ${Icons.sparkles(14, '#FFFFFF')}
              <span>Consultar Turno con IA</span>
            </button>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-therapist-detail')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-therapist-detail-footer')?.addEventListener('click', closeModal);

    document.getElementById('btn-ask-mindbot-modal')?.addEventListener('click', () => {
      closeModal();
      const fabBtn = document.getElementById('mindbot-fab-btn');
      const textInput = document.getElementById('mindbot-text-input');
      const chatWindow = document.getElementById('mindbot-chat-window');

      if (chatWindow && !chatWindow.classList.contains('active')) {
        fabBtn?.click();
      }

      if (textInput) {
        textInput.value = `Deseo consultar sobre los turnos de atención y valoración con Lic. ${therapist.nombres} ${therapist.apellidos} - ${therapist.especialidad_nombre || 'Especialista'}`;
        setTimeout(() => textInput.focus(), 300);
      }
    });
  }

  _escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/[()]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
