import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';
import { store } from '../../store.js';
import { escapeHtml, sanitizeUrl } from '../../utils/sanitize.js';

export class TherapistsView {
  constructor(container) {
    this.container = container;
    this.user = store.getState().user;
    this.userRole = store.getUserRole();
    this.therapists = [];
    this.rooms = [];
    this.specialties = [];
    this.selectedTherapist = null;
  }

  get isAdmin() {
    return (this.userRole || store.getUserRole()) === 'ADMIN';
  }

  async render() {
    this.user = store.getState().user;
    this.userRole = store.getUserRole();

    this.container.innerHTML = `
      <div class="page-container panel-general">
        <!-- Encabezado Soft UI Médica -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.therapist(13, 'var(--soft-purple-primary)')}
                <span>Equipo Clínico</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende" · Acreditación CPB</span>
            </div>
            <h1 class="soft-page-title">Directorio de Especialistas y Disponibilidad</h1>
            <p class="soft-page-subtitle">
              Equipo de profesionales clínicos del centro, matrículas oficiales del Colegio de Psicólogos de Bolivia y asignación de consultorios físicos.
            </p>
          </div>

          <div class="soft-header-actions">
            <button id="btn-refresh-therapists" type="button" class="soft-btn soft-btn-lvl-1">
              ${Icons.pulse(16, '#FFFFFF')}
              <span>Actualizar Directorio</span>
            </button>
          </div>
        </div>

        <!-- Franja de Métricas Clínicas Soft UI -->
        <div class="soft-kpi-grid-3">
          <div class="soft-kpi-card">
            <span class="soft-status-dot-green" title="Plantel clínico activo"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.therapist(22, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">100% Acreditados CPB</span>
              <div id="kpi-count-therapists" class="soft-kpi-value">Especialistas</div>
              <div class="soft-kpi-sub">Profesionales habilitados</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.brain(22, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Especialidades Clínicas</span>
              <div id="kpi-count-specialties" class="soft-kpi-value">Especialidades</div>
              <div class="soft-kpi-sub">Cobertura interdisciplinaria</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <div class="soft-icon-box soft-icon-box-indigo">
              ${Icons.rooms(22, 'var(--soft-indigo-accent)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Asignación Anti-Colisión</span>
              <div id="kpi-count-rooms" class="soft-kpi-value">Salas Clínicas</div>
              <div class="soft-kpi-sub">Consultorios físicos activos</div>
            </div>
          </div>
        </div>

        <!-- Contenedor Principal del Directorio de Especialistas Acreditados -->
        <div class="soft-section-card">
          <div class="soft-section-header">
            <div>
              <h2 class="soft-section-title">Plantel de Especialistas Colegiados</h2>
              <p class="soft-section-subtitle">Consultorios preferentes, turnos operativos y parámetros de liquidación clínica.</p>
            </div>
            <span class="soft-badge soft-badge-emerald">
              ${Icons.shield(13, 'var(--soft-emerald-dark)')}
              <span>Colegio de Psicólogos de Bolivia</span>
            </span>
          </div>

          <div id="therapists-grid" class="soft-rooms-grid" style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 1.35rem;">
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--soft-text-body);">
              Cargando directorio de profesionales...
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de Edición de Terapeuta (Nivel 2) -->
      <div id="therapist-modal-backdrop" class="modal-backdrop" style="display: none;">
        <div class="soft-modal-card" style="max-width: 560px; max-height: 92vh; overflow-y: auto;">
          <div style="padding: 1.35rem 1.75rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.8rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.badge(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 id="therapist-modal-title" style="margin: 0; color: var(--soft-text-title); font-size: 1.14rem; font-weight: 800;">Modificar Asignación de Terapeuta</h3>
                <span style="font-size: 0.78rem; color: var(--soft-text-muted);">Configuración operativa y matrícula profesional</span>
              </div>
            </div>
            <button id="btn-close-therapist-modal" type="button" class="soft-modal-close-btn" aria-label="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <form id="therapist-form" style="padding: 1.45rem 1.75rem;">
            <input type="hidden" id="edit-therapist-id" />

            <!-- FOTOGRAFÍA DE PERFIL DEL ESPECIALISTA -->
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1px solid var(--soft-divider);">
              <div style="width: 64px; height: 64px; border-radius: 18px; overflow: hidden; background: #F1F5F9; border: 2px solid var(--soft-purple-primary); flex-shrink: 0; box-shadow: 0 4px 12px rgba(88,66,148,0.14);">
                <img id="edit-therapist-preview-photo" src="" alt="Foto" style="width: 100%; height: 100%; object-fit: cover; display: none;" />
                <div id="edit-therapist-photo-fallback" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.25rem; background: var(--soft-btn-lvl-1-bg); color: #FFFFFF;">
                  TP
                </div>
              </div>
              <div style="flex: 1; min-width: 0;">
                <label class="soft-label" style="margin-bottom: 0.25rem;">Fotografía de Perfil · Visible para Familias</label>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <input type="file" id="edit-therapist-file" accept="image/*" style="display: none;" />
                  <button type="button" id="btn-upload-admin-therapist-photo" class="soft-btn soft-btn-lvl-2-soft soft-btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem;">
                    ${Icons.upload(13, 'currentColor')}
                    <span>Subir Foto desde PC</span>
                  </button>
                  <input type="text" id="edit-therapist-foto-url" class="soft-input" placeholder="O ruta /uploads/..." style="font-size: 0.78rem; flex: 1; min-width: min(100%, 180px);" />
                </div>
              </div>
            </div>

            <div style="margin-bottom: 1rem;">
              <label class="soft-label" for="edit-therapist-name">Especialista</label>
              <input type="text" id="edit-therapist-name" class="soft-input" readonly style="font-weight: 700; color: var(--soft-text-title); background: #F3F0FC;" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div>
                <label class="soft-label" for="edit-therapist-cpb">Matrícula CPB <span class="required">*</span></label>
                <input type="text" id="edit-therapist-cpb" class="soft-input" required />
              </div>

              <div>
                <label class="soft-label" for="edit-therapist-phone">Teléfono / WhatsApp</label>
                <input type="text" id="edit-therapist-phone" class="soft-input" />
              </div>
            </div>

            <!-- LOGROS ACADÉMICOS Y ENFOQUE CLÍNICO -->
            <div style="margin-bottom: 1rem;">
              <label class="soft-label" for="edit-therapist-titulos">Títulos Académicos y Grados Oficiales</label>
              <input type="text" id="edit-therapist-titulos" class="soft-input" placeholder="Ej: Licenciada en Psicología por la UMSS, Maestría en Neuropsicología" />
            </div>

            <div style="margin-bottom: 1rem;">
              <label class="soft-label" for="edit-therapist-diplomados">Diplomados, Certificaciones &amp; Cursos</label>
              <input type="text" id="edit-therapist-diplomados" class="soft-input" placeholder="Ej: Certificación ADOS-2, Diplomado en Dificultades del Aprendizaje" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div>
                <label class="soft-label" for="edit-therapist-experiencia">Años de Trayectoria</label>
                <input type="text" id="edit-therapist-experiencia" class="soft-input" placeholder="Ej: 10 años de experiencia clínica" />
              </div>

              <div>
                <label class="soft-label" for="edit-therapist-enfoque">Enfoque Terapéutico</label>
                <input type="text" id="edit-therapist-enfoque" class="soft-input" placeholder="Ej: Neurocognitivo, Conductual y Familiar" />
              </div>
            </div>

            <div style="margin-bottom: 1rem;">
              <label class="soft-label" for="edit-therapist-bio">Biografía y Resumen Profesional</label>
              <textarea id="edit-therapist-bio" class="soft-textarea" rows="2" placeholder="Resumen profesional para tutores..."></textarea>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div>
                <label class="soft-label" for="edit-therapist-room">Consultorio Preferencial</label>
                <select id="edit-therapist-room" class="soft-select">
                  <!-- Llenado dinámicamente -->
                </select>
              </div>

              <div>
                <label class="soft-label" for="edit-therapist-turnos">Turno de Atención</label>
                <select id="edit-therapist-turnos" class="soft-select">
                  <option value="MAÑANA_TARDE">Mañana y Tarde: 08:30 a 18:30</option>
                  <option value="MAÑANA">Solo Mañanas: 08:30 a 12:30</option>
                  <option value="TARDE">Solo Tardes: 14:30 a 18:30</option>
                </select>
              </div>
            </div>

            <div style="margin-bottom: 1.35rem;">
              <label class="soft-label" for="edit-therapist-comision">Comisión por Sesión Clínica (%)</label>
              <input type="number" id="edit-therapist-comision" class="soft-input" min="0" max="100" step="1" />
              <div class="field-feedback" style="color: var(--soft-text-muted); margin-top: 0.32rem;">
                Porcentaje de honorarios asignado al especialista por sesión - ej. 70% especialista / 30% centro
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1.15rem;">
              <button type="button" id="btn-cancel-therapist-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
              <button type="submit" class="soft-btn soft-btn-lvl-2">
                ${Icons.check(15, '#FFFFFF')}
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    await this.loadData();
    this.attachEvents();
  }

  async loadData() {
    try {
      const [therapistsRes, roomsRes, specsRes] = await Promise.all([
        apiClient.get('/api/therapists'),
        apiClient.get('/api/rooms'),
        apiClient.get('/api/therapists/specialties')
      ]);

      if (therapistsRes.success) {
        this.therapists = therapistsRes.data;
        const elTherapists = document.getElementById('kpi-count-therapists');
        if (elTherapists) elTherapists.textContent = `${this.therapists.length} Especialistas`;
      }
      if (roomsRes.success) {
        this.rooms = roomsRes.data;
        const elRooms = document.getElementById('kpi-count-rooms');
        if (elRooms) elRooms.textContent = `${this.rooms.length} Salas`;
        this.populateRoomsSelect();
      }
      if (specsRes.success) {
        this.specialties = specsRes.data;
        const elSpecs = document.getElementById('kpi-count-specialties');
        if (elSpecs) elSpecs.textContent = `${this.specialties.length} Áreas`;
      }

      this.renderTherapists();
    } catch (err) {
      console.error(err);
      Toast.error('No se pudo cargar el directorio de especialistas.');
    }
  }

  populateRoomsSelect() {
    const select = document.getElementById('edit-therapist-room');
    if (!select) return;

    select.innerHTML = '<option value="">-- Sin consultorio preferente --</option>';
    this.rooms.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = `${r.codigo} - ${r.nombre}`;
      select.appendChild(opt);
    });
  }

  renderTherapists() {
    const grid = document.getElementById('therapists-grid');
    if (!grid) return;

    if (this.therapists.length === 0) {
      grid.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon">${Icons.therapist(28, 'var(--soft-purple-primary)')}</div>
          <h4 class="empty-state-title">No hay especialistas registrados</h4>
          <p class="empty-state-desc">El directorio clínico se actualizará cuando se registren profesionales acreditados.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.therapists.map((t, idx) => {
      const isMintAccent = t.color_agenda === '#0284c7' || t.color_agenda === '#10b981' || idx % 2 === 1;
      const initials = `${(t.nombres || '').charAt(0)}${(t.apellidos || '').charAt(0)}`.toUpperCase();
      const avatarBg = isMintAccent
        ? 'linear-gradient(135deg, #15968D 0%, #2DB9AE 100%)'
        : 'var(--soft-btn-lvl-1-bg)';
      const safeFotoUrl = sanitizeUrl(t.foto_url, { allowDataImage: true });

      return `
        <div class="soft-room-card ${isMintAccent ? 'soft-room-mint' : ''}" style="position: relative;">
          <div>
            <!-- Encabezado con Avatar Suave / Foto Real, Matrícula CPB y Nombre -->
            <div style="display: flex; align-items: center; gap: 0.95rem; margin-bottom: 1.05rem;">
              <div style="width: 52px; height: 52px; border-radius: 17px; overflow: hidden; flex-shrink: 0; border: 2px solid var(--soft-purple-primary); box-shadow: 0 4px 14px rgba(88,66,148,0.18);">
                ${safeFotoUrl ? `
                  <img src="${escapeHtml(safeFotoUrl)}" alt="${escapeHtml(t.nombres)}" style="width: 100%; height: 100%; object-fit: cover;" />
                ` : `
                  <div style="width: 100%; height: 100%; background: ${avatarBg}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.08rem;">
                    ${escapeHtml(initials)}
                  </div>
                `}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.28rem; flex-wrap: wrap;">
                  <span class="soft-badge soft-badge-lavender" style="padding: 0.18rem 0.62rem; font-size: 0.7rem;">
                    ${Icons.badge(12, 'var(--soft-purple-primary)')}
                    <span>${escapeHtml(t.registro_profesional)}</span>
                  </span>
                  ${t.experiencia_anios ? `
                    <span class="soft-badge soft-badge-mint" style="font-size: 0.68rem; padding: 0.16rem 0.5rem;">
                      ${escapeHtml(t.experiencia_anios)}
                    </span>
                  ` : ''}
                </div>
                <h3 style="font-size: 1.06rem; font-weight: 800; color: var(--soft-text-title); margin: 0; line-height: 1.25;">
                  Lic. ${escapeHtml(t.nombres)} ${escapeHtml(t.apellidos)}
                </h3>
              </div>
            </div>

            <!-- Especialidad Acreditada & Enfoque -->
            <div style="margin-bottom: 0.8rem; display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem;">
              <span class="soft-badge ${isMintAccent ? 'soft-badge-mint' : 'soft-badge-indigo'}">
                ${escapeHtml(t.especialidad_nombre || 'Especialista Clínico')}
              </span>
              ${t.enfoque_terapeutico ? `
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem;">
                  ${escapeHtml(t.enfoque_terapeutico)}
                </span>
              ` : ''}
            </div>

            <!-- Resumen Bio & Logros -->
            <p style="font-size: 0.84rem; color: var(--soft-text-body); line-height: 1.5; margin: 0 0 1.05rem 0;">
              ${t.titulos_academicos ? `<strong>${escapeHtml(t.titulos_academicos)}</strong> · ` : ''}${escapeHtml(t.bio || 'Profesional colegiado del Centro Psicopedagógico PSI Aprende.')}
            </p>

            <!-- Datos de Consultorio y Turnos -->
            <div style="background: var(--soft-lavender-surface); border-radius: 14px; padding: 0.85rem 1rem; border: 1px solid var(--soft-border-card-inner); font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.42rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                <span style="color: var(--soft-text-body);">Consultorio:</span>
                <strong style="color: var(--soft-text-title); font-weight: 700;">${escapeHtml(t.ambiente_codigo || 'Por asignar')}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                <span style="color: var(--soft-text-body);">Turno:</span>
                <span style="font-weight: 600; color: var(--soft-text-title);">${t.turnos_atencion === 'MAÑANA_TARDE' ? 'Mañana y Tarde' : (t.turnos_atencion === 'MAÑANA' ? 'Mañana' : 'Tarde')}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding-top: 0.35rem; border-top: 1px solid var(--soft-divider);">
                <span style="color: var(--soft-text-body);">Comisión por Sesión:</span>
                <span class="soft-specialty-tag" style="margin-left: 0;">${escapeHtml(t.porcentaje_honorarios)}% (Liquidación)</span>
              </div>
            </div>
          </div>

          <!-- Botones de Acción / Solo Admin puede editar asignaciones -->
          <div style="margin-top: 1.15rem; padding-top: 0.9rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end;">
            ${this.isAdmin ? `
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-edit-therapist" data-id="${escapeHtml(t.id)}" style="width: 100%;">
                ${Icons.edit(14, '#FFFFFF')}
                <span>Editar Asignación</span>
              </button>
            ` : `
              <div class="soft-badge soft-badge-emerald" style="width: 100%; justify-content: center; padding: 0.48rem 0.75rem; border-radius: 12px;">
                ${Icons.badge(14, 'var(--soft-emerald-dark)')}
                <span>Especialista Clínico Acreditado</span>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Listener para editar terapeuta (solo si es ADMIN)
    if (this.isAdmin) {
      grid.querySelectorAll('.btn-edit-therapist').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          this.openEditModal(id);
        });
      });
    }
  }

  attachEvents() {
    const refreshBtn = document.getElementById('btn-refresh-therapists');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadData());
    }

    const closeBtn = document.getElementById('btn-close-therapist-modal');
    const cancelBtn = document.getElementById('btn-cancel-therapist-modal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());

    const form = document.getElementById('therapist-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Botón para subir foto desde el modal de administración
    const btnUploadPhoto = document.getElementById('btn-upload-admin-therapist-photo');
    const fileInput = document.getElementById('edit-therapist-file');
    const fotoUrlInput = document.getElementById('edit-therapist-foto-url');
    const previewImg = document.getElementById('edit-therapist-preview-photo');
    const fallbackBox = document.getElementById('edit-therapist-photo-fallback');

    if (btnUploadPhoto && fileInput) {
      btnUploadPhoto.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const id = document.getElementById('edit-therapist-id')?.value;
        const formData = new FormData();
        formData.append('foto', file);

        try {
          Toast.info('Subiendo fotografía del especialista...');
          const endpoint = id ? `/therapists/${id}/photo` : '/therapists/upload-photo';
          const res = await apiClient.upload(endpoint, formData);

          if (res?.data?.url) {
            if (fotoUrlInput) fotoUrlInput.value = res.data.url;
            if (previewImg) {
              previewImg.src = res.data.url;
              previewImg.style.display = 'block';
            }
            if (fallbackBox) fallbackBox.style.display = 'none';
            Toast.success('Fotografía subida exitosamente.');
          }
        } catch (uploadErr) {
          console.error('[Upload Admin Photo Error]', uploadErr);
          Toast.error(uploadErr.message || 'Error al subir fotografía.');
        }
      });
    }

    if (fotoUrlInput && previewImg && fallbackBox) {
      fotoUrlInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val) {
          previewImg.src = val;
          previewImg.style.display = 'block';
          fallbackBox.style.display = 'none';
        } else {
          previewImg.style.display = 'none';
          fallbackBox.style.display = 'flex';
        }
      });
    }
  }

  openEditModal(therapistId) {
    const t = this.therapists.find(item => item.id == therapistId);
    if (!t) return;

    this.selectedTherapist = t;
    document.getElementById('edit-therapist-id').value = t.id;
    document.getElementById('edit-therapist-name').value = `${t.nombres} ${t.apellidos}`;
    document.getElementById('edit-therapist-cpb').value = t.registro_profesional || '';
    document.getElementById('edit-therapist-phone').value = t.telefono || '';
    document.getElementById('edit-therapist-room').value = t.ambiente_preferido_id || '';
    document.getElementById('edit-therapist-turnos').value = t.turnos_atencion || 'MAÑANA_TARDE';
    document.getElementById('edit-therapist-comision').value = t.porcentaje_honorarios || 70;

    // Campos de fotografía y logros académicos
    const fotoUrlInput = document.getElementById('edit-therapist-foto-url');
    const previewImg = document.getElementById('edit-therapist-preview-photo');
    const fallbackBox = document.getElementById('edit-therapist-photo-fallback');
    
    if (fotoUrlInput) fotoUrlInput.value = t.foto_url || '';
    if (t.foto_url) {
      if (previewImg) {
        previewImg.src = t.foto_url;
        previewImg.style.display = 'block';
      }
      if (fallbackBox) fallbackBox.style.display = 'none';
    } else {
      if (previewImg) previewImg.style.display = 'none';
      if (fallbackBox) {
        fallbackBox.style.display = 'flex';
        fallbackBox.textContent = `${(t.nombres || '').charAt(0)}${(t.apellidos || '').charAt(0)}`.toUpperCase() || 'TP';
      }
    }

    const inputTitulos = document.getElementById('edit-therapist-titulos');
    if (inputTitulos) inputTitulos.value = t.titulos_academicos || '';

    const inputDiplomados = document.getElementById('edit-therapist-diplomados');
    if (inputDiplomados) inputDiplomados.value = t.diplomados_certificaciones || '';

    const inputExperiencia = document.getElementById('edit-therapist-experiencia');
    if (inputExperiencia) inputExperiencia.value = t.experiencia_anios || '';

    const inputEnfoque = document.getElementById('edit-therapist-enfoque');
    if (inputEnfoque) inputEnfoque.value = t.enfoque_terapeutico || '';

    const inputBio = document.getElementById('edit-therapist-bio');
    if (inputBio) inputBio.value = t.bio || '';

    document.getElementById('therapist-modal-backdrop').style.display = 'flex';
  }

  closeModal() {
    document.getElementById('therapist-modal-backdrop').style.display = 'none';
  }

  async handleSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('edit-therapist-id').value;
    const registro_profesional = document.getElementById('edit-therapist-cpb').value.trim();
    const telefono = document.getElementById('edit-therapist-phone').value.trim();
    const ambiente_preferido_id = document.getElementById('edit-therapist-room').value;
    const turnos_atencion = document.getElementById('edit-therapist-turnos').value;
    const porcentaje_honorarios = parseFloat(document.getElementById('edit-therapist-comision').value);

    const foto_url = document.getElementById('edit-therapist-foto-url')?.value.trim() || null;
    const titulos_academicos = document.getElementById('edit-therapist-titulos')?.value.trim() || null;
    const diplomados_certificaciones = document.getElementById('edit-therapist-diplomados')?.value.trim() || null;
    const experiencia_anios = document.getElementById('edit-therapist-experiencia')?.value.trim() || null;
    const enfoque_terapeutico = document.getElementById('edit-therapist-enfoque')?.value.trim() || null;
    const bio = document.getElementById('edit-therapist-bio')?.value.trim() || null;

    try {
      const res = await apiClient.put(`/therapists/${id}`, {
        registro_profesional,
        telefono,
        ambiente_preferido_id: ambiente_preferido_id ? parseInt(ambiente_preferido_id, 10) : null,
        turnos_atencion,
        porcentaje_honorarios,
        foto_url,
        titulos_academicos,
        diplomados_certificaciones,
        experiencia_anios,
        enfoque_terapeutico,
        bio
      });

      if (res.success) {
        Toast.success('Asignación y perfil de especialista actualizados exitosamente.');
        this.closeModal();
        await this.loadData();
      }
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Error al actualizar el especialista.');
    }
  }
}
