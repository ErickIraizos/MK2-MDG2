import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';
import { store } from '../../store.js';

export class AppointmentsView {
  constructor(container) {
    this.container = container;
    this.user = store.getState().user;
    this.userRole = store.getUserRole();

    // Estado del calendario: para ADMIN, RECEPCION y TUTOR la vista predeterminada es 'MONTH' (Calendario Mensual Completo); para TERAPEUTA es 'FIVE_DAYS'
    this.selectedDate = this.getLocalDateString();
    this.selectedMonthDay = this.selectedDate;
    this.viewMode = (this.userRole === 'ADMIN' || this.userRole === 'RECEPCION' || this.userRole === 'TUTOR') ? 'MONTH' : 'FIVE_DAYS';
    // Modos admitidos: 'MONTH' (Mes Completo) | 'ROOMS' (Salas en paralelo) | 'FIVE_DAYS' (Hoy + 4 días compactos) | 'DAY' | 'LIST'
    
    this.appointments = [];
    this.therapists = [];
    this.rooms = [];
    this.services = [];
    this.patients = []; // Para tutor contiene solo sus hijos; para staff todos los pacientes
    this.stats = { total: 0, enAtencion: 0, confirmadas: 0, programadas: 0, atendidas: 0, canceladas: 0, ausentes: 0 };

    // Filtros
    this.filterTherapist = '';
    this.filterPatientId = ''; // Filtro por hijo (para tutores con múltiples hijos)
    this.filterRoomId = ''; // Filtro por consultorio / sala física
    this.filterStatus = '';
    this.searchTerm = '';

    // Modales y formularios
    this.selectedAppointment = null;
    this.collisionTimer = null;
    this.collisionState = { checked: false, available: true, message: '' };
    this.isSubmitting = false;

    // Auto-sincronización en segundo plano (silenciosa cada 20s y en cambio de pestaña)
    this.autoSyncTimer = null;
    this.onVisibilityChange = null;
    this.onWindowFocus = null;

    // Estado para el modal de Disponibilidad Institucional de Salas (Agenda Pública sin datos de pacientes)
    this.publicScheduleMonth = this.selectedDate.slice(0, 7); // 'YYYY-MM'
    this.publicScheduleData = [];
    this.publicSelectedDay = this.selectedDate;
  }

  getLocalDateString(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  formatDateHeader(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  }

  formatMonthHeader(dateStr) {
    const parts = dateStr.slice(0, 7).split('-');
    if (parts.length !== 2) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${months[month - 1]} de ${year}`;
  }

  formatTime(isoStr) {
    if (!isoStr) return '--:--';
    return isoStr.slice(11, 16);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  getStatusBadge(estado) {
    const map = {
      'PROGRAMADA': { label: 'Programada', cls: 'soft-badge-lavender' },
      'CONFIRMADA': { label: 'Confirmada', cls: 'soft-badge-emerald' },
      'EN_ATENCION': { label: 'En Sala Ahora', cls: 'soft-badge-mint', pulse: true },
      'ATENDIDA': { label: 'Atendida', cls: 'soft-badge-slate' },
      'REPROGRAMADA': { label: 'Reprogramada', cls: 'soft-badge-amber' },
      'CANCELADA': { label: 'Cancelada', cls: 'soft-badge-rose' },
      'AUSENTE': { label: 'Ausente', cls: 'soft-badge-rose' }
    };

    const cfg = map[estado] || { label: estado, cls: 'soft-badge-slate' };
    const pulseDot = cfg.pulse
      ? `<span style="width: 7px; height: 7px; border-radius: 50%; background: var(--soft-emerald); box-shadow: 0 0 0 2.5px var(--soft-emerald-ring); display: inline-block;"></span>`
      : '';

    return `
      <span class="soft-badge ${cfg.cls}">
        ${pulseDot}<span>${cfg.label}</span>
      </span>
    `;
  }

  async render() {
    this.user = store.getState().user;
    this.userRole = store.getUserRole();

    // Limpiar temporizadores anteriores si existían
    this.cleanupSync();

    const isTutor = (this.userRole === 'TUTOR');
    const isTherapist = (this.userRole === 'TERAPEUTA');
    const isStaff = ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole);

    this.container.innerHTML = `
      <style>
        .today-card-active {
          border-color: rgba(26, 166, 156, 0.48) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.94),
                      0 0 0 1px rgba(45, 185, 174, 0.16),
                      var(--soft-shadow-mint-hover) !important;
        }
      </style>

      <div class="page-container panel-general">
        
        <!-- ENCABEZADO PRINCIPAL -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.calendar(13, 'var(--soft-purple-primary)')}
                <span>${isTutor ? 'Portal Familiar' : 'Coordinación Clínica'}</span>
              </span>
              <div class="live-sync-indicator soft-badge soft-badge-emerald" title="La agenda se mantiene sincronizada automáticamente en tiempo real" style="user-select: none;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--soft-emerald); box-shadow: 0 0 0 2.5px var(--soft-emerald-ring); display: inline-block;"></span>
                <span id="sync-status-text">Sincronizado en vivo</span>
              </div>
            </div>
            <h1 class="soft-page-title">
              ${isTutor ? 'Mis Citas Agendadas & Terapeutas' : 'Agenda Médica & Consultorios'}
            </h1>
            <p class="soft-page-subtitle">
              ${isTutor 
                ? 'Consulte el cronograma de sesiones terapéuticas de sus hijos tutelados y sus especialistas asignados.'
                : 'Programación clínica, algoritmo anti-colisiones multiconsultorio (<strong style="color: var(--soft-text-title);">RN-01</strong>) y margen preventivo (<strong style="color: var(--soft-text-title);">RN-02</strong>).'
              }
            </p>
          </div>

          <div class="soft-header-actions">
            <!-- Botón de Disponibilidad de Salas (Solo Staff: terapeutas, recepción y admin) -->
            ${isStaff ? `
              <button id="btn-public-schedule" class="soft-btn soft-btn-lvl-1-muted" title="Consultar disponibilidad y ocupación institucional de consultorios (sin datos de pacientes)">
                ${Icons.rooms(16, 'var(--soft-purple-primary)')}
                <span>Disponibilidad de Salas</span>
              </button>
            ` : ''}

            ${isStaff ? `
              <button id="btn-open-new-appointment" class="soft-btn soft-btn-lvl-1">
                ${Icons.calendarPlus(17, '#FFFFFF')}
                <span>+ Agendar Cita</span>
              </button>
            ` : ''}

            <button id="btn-refresh-agenda" class="soft-btn soft-btn-lvl-1-muted" title="Sincronizar ahora manualmente" aria-label="Sincronizar agenda">
              ${Icons.refresh(16, 'var(--soft-purple-primary)')}
              <span>Sincronizar</span>
            </button>
          </div>
        </div>

        <!-- FRANJA COMPACTA DE MÉTRICAS (5 KPIs SOFT UI) -->
        <div id="kpi-ribbon" class="soft-kpi-grid-5">
          <div class="soft-kpi-card">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.calendar(19, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Citas de Hoy</span>
              <div id="kpi-total" class="soft-kpi-value">--</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <span class="soft-status-dot-green" title="Atención activa en sala"></span>
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-indigo">
              ${Icons.pulse(19, 'var(--soft-indigo-accent)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">En Sala Ahora</span>
              <div id="kpi-en-atencion" class="soft-kpi-value">--</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
              ${Icons.checkCircle(19, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Confirmadas</span>
              <div id="kpi-confirmadas" class="soft-kpi-value">--</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.clock(19, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Por Atender</span>
              <div id="kpi-programadas" class="soft-kpi-value">--</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
              ${Icons.userCheck(19, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Atendidas Hoy</span>
              <div id="kpi-atendidas" class="soft-kpi-value">--</div>
            </div>
          </div>
        </div>

        <!-- BARRA DE CONTROL, FECHA Y MODALIDAD DE VISTA -->
        <div class="soft-card-static" style="padding: 1.25rem 1.45rem; margin-bottom: 1.65rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            
            <!-- Selector de Fecha y Navegación (Día Anterior, Hoy, Día Siguiente) -->
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <div style="display: inline-flex; align-items: center; gap: 0.38rem;">
                <button id="btn-date-prev" type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" title="Día Anterior" style="padding: 0.46rem 0.72rem;">
                  ←
                </button>
                <button id="btn-date-today" type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="padding: 0.46rem 0.9rem;">
                  Hoy
                </button>
                <button id="btn-date-next" type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" title="Día Siguiente" style="padding: 0.46rem 0.72rem;">
                  →
                </button>
              </div>

              <input type="date" id="calendar-date-picker" value="${this.selectedDate}" 
                class="soft-input soft-input-sm" style="width: auto; min-height: 38px; padding: 0.42rem 0.78rem;" />

              <span id="calendar-date-title" style="font-weight: 800; color: var(--soft-text-title); font-size: 1rem; margin-left: 0.35rem; letter-spacing: -0.015em;">
                ${this.viewMode === 'MONTH' ? this.formatMonthHeader(this.selectedDate) : this.formatDateHeader(this.selectedDate)}
              </span>
            </div>

            <!-- Modos de Vista Dinámicos según Rol -->
            <div class="soft-segmented-bar" style="padding: 0.35rem; gap: 0.4rem;">
              
              <!-- Modo Mes Completo (Predeterminado para ADMIN y RECEPCION) -->
              ${['ADMIN', 'RECEPCION'].includes(this.userRole) ? `
                <button id="btn-view-month" type="button" class="soft-btn soft-btn-sm ${this.viewMode === 'MONTH' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}">
                  ${Icons.calendar(15, this.viewMode === 'MONTH' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
                  <span>Mes</span>
                </button>
              ` : ''}

              <!-- Solo para ADMIN y RECEPCION: Consultorios Multisala para control físico -->
              ${['ADMIN', 'RECEPCION'].includes(this.userRole) ? `
                <button id="btn-view-rooms" type="button" class="soft-btn soft-btn-sm ${this.viewMode === 'ROOMS' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}">
                  ${Icons.rooms(15, this.viewMode === 'ROOMS' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
                  <span>Consultorios (Multisala)</span>
                </button>
              ` : ''}

              <!-- Modo 5 Días Compactos: Hoy + 4 Siguientes (Predeterminado para Terapeuta y Tutor) -->
              <button id="btn-view-five-days" type="button" class="soft-btn soft-btn-sm ${this.viewMode === 'FIVE_DAYS' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}">
                ${Icons.calendar(15, this.viewMode === 'FIVE_DAYS' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
                <span>5 Días (Hoy + 4)</span>
              </button>

              <button id="btn-view-day" type="button" class="soft-btn soft-btn-sm ${this.viewMode === 'DAY' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}">
                ${Icons.clock(15, this.viewMode === 'DAY' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
                <span>Día</span>
              </button>

              <button id="btn-view-list" type="button" class="soft-btn soft-btn-sm ${this.viewMode === 'LIST' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}">
                ${Icons.fileText(15, this.viewMode === 'LIST' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
                <span>Listado</span>
              </button>
            </div>
          </div>

          <!-- Filtros Secundarios con estricta adaptación de privacidad por Rol -->
          <div style="display: flex; gap: 0.85rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--soft-divider); flex-wrap: wrap; align-items: stretch;">
            <div class="soft-search-box" style="flex: 2; min-width: min(100%, 240px);">
              <span class="soft-search-box-icon">
                ${Icons.search(16)}
              </span>
              <input type="text" id="agenda-search" placeholder="${isTutor ? 'Buscar cita por nombre de hijo...' : 'Buscar por paciente, código o CI...'}" 
                value="${this.escapeHtml(this.searchTerm)}"
                class="soft-input" />
            </div>

            <!-- FILTRO DE ROL: -->
            ${isTherapist ? `
              <!-- TERAPEUTA: Bloqueado a sus propios pacientes por secreto profesional -->
              <div style="flex: 1.5; min-width: min(100%, 250px); display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.95rem; background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; font-size: 0.84rem; font-weight: 700; color: var(--soft-text-title); box-sizing: border-box;">
                <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.therapist(15)}</span>
                <span>Sus Pacientes Asignados (${this.escapeHtml(this.user?.nombres || 'Terapeuta')})</span>
              </div>
            ` : isTutor ? `
              <!-- TUTOR MULTI-HIJO: Selector opcional para filtrar entre sus hijos tutelados -->
              <div style="flex: 1.2; min-width: min(100%, 220px);">
                <select id="select-filter-hijo" class="soft-select">
                  <option value="">-- Todos sus Hijos Tutelados --</option>
                  ${this.patients.map(p => `
                    <option value="${p.id}" ${this.filterPatientId == p.id ? 'selected' : ''}>
                      ${this.escapeHtml(p.nombres)} ${this.escapeHtml(p.apellidos)} (${this.escapeHtml(p.codigo_expediente)})
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- TUTOR: Selector de terapeutas asignados a sus hijos -->
              <div style="flex: 1.2; min-width: min(100%, 220px);">
                <select id="select-filter-terapeuta" class="soft-select">
                  <option value="">-- Terapeutas de sus Hijos --</option>
                </select>
              </div>
            ` : `
              <!-- ADMIN / RECEPCIÓN: Selector de todos los terapeutas -->
              <div style="flex: 1.4; min-width: min(100%, 230px);">
                <select id="select-filter-terapeuta" class="soft-select">
                  <option value="">-- Todos los Especialistas (${this.therapists.length}) --</option>
                </select>
              </div>

              <!-- ADMIN / RECEPCIÓN: Selector de consultorios / salas físicas -->
              <div style="flex: 1.2; min-width: min(100%, 200px);">
                <select id="select-filter-ambiente" class="soft-select">
                  <option value="">-- Todos los Consultorios (${this.rooms.length}) --</option>
                  ${(this.rooms || []).map(r => `
                    <option value="${r.id}" ${this.filterRoomId == r.id ? 'selected' : ''}>
                      ${this.escapeHtml(r.nombre?.split(' - ')[0] || r.codigo)}
                    </option>
                  `).join('')}
                </select>
              </div>
            `}

            <div style="flex: 1; min-width: min(100%, 190px);">
              <select id="select-filter-estado" class="soft-select">
                <option value="">-- Todos los Estados --</option>
                <option value="PROGRAMADA">Programada</option>
                <option value="CONFIRMADA">Confirmada</option>
                <option value="EN_ATENCION">En Sala Ahora</option>
                <option value="ATENDIDA">Atendida</option>
                <option value="REPROGRAMADA">Reprogramada</option>
                <option value="CANCELADA">Cancelada</option>
                <option value="AUSENTE">Ausente</option>
              </select>
            </div>
          </div>
        </div>

        <!-- CONTENEDOR PRINCIPAL DEL CALENDARIO (DINÁMICO SEGÚN viewMode) -->
        <div id="calendar-content-area" style="min-height: 520px;">
          <div style="text-align: center; padding: 4rem 1rem; color: var(--soft-text-muted);">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--soft-emerald); box-shadow: 0 0 0 3.5px var(--soft-emerald-ring); display: inline-block; margin-bottom: 0.65rem;"></div>
            <div>Cargando calendario y sesiones programadas...</div>
          </div>
        </div>

      </div>

      <!-- MODALES DEL SPRINT 6 -->
      <div id="modal-container-agenda"></div>
    `;

    await this.loadInitialData();
    this.attachEvents();
    this.setupAutoSync();
    this.setupServiceWorkerMessages();
    this.checkUrlActions();
  }

  setupAutoSync() {
    this._lastAutoRefreshTs = Date.now();
    // Respaldo de baja frecuencia (45s): la sincronización inmediata llega por SSE ('appointment-status-changed')
    this.autoSyncTimer = setInterval(() => {
      const isFormOpen = document.getElementById('modal-schedule-appointment') ||
                         document.getElementById('modal-cancel-reason') ||
                         document.getElementById('modal-edit-appointment');
      if (!isFormOpen && !document.hidden) {
        this._lastAutoRefreshTs = Date.now();
        this.refreshAppointments({ silent: true });
      }
    }, 45000);

    const triggerThrottledRefresh = () => {
      const now = Date.now();
      if (now - (this._lastAutoRefreshTs || 0) < 2500) return;
      const isFormOpen = document.getElementById('modal-schedule-appointment') ||
                         document.getElementById('modal-cancel-reason') ||
                         document.getElementById('modal-edit-appointment');
      if (!isFormOpen) {
        this._lastAutoRefreshTs = now;
        this.refreshAppointments({ silent: true });
      }
    };

    this.onVisibilityChange = () => {
      if (!document.hidden) {
        triggerThrottledRefresh();
      }
    };
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.onWindowFocus = () => {
      triggerThrottledRefresh();
    };
    window.addEventListener('focus', this.onWindowFocus);

    // Escuchar eventos en tiempo real (ej. SSE, WhatsApp o notificación PWA)
    this.onAppointmentStatusChanged = () => {
      this._lastAutoRefreshTs = Date.now();
      this.refreshAppointments({ silent: true });
    };
    window.addEventListener('appointment-status-changed', this.onAppointmentStatusChanged);
  }

  setupServiceWorkerMessages() {
    if ('serviceWorker' in navigator) {
      this.onSwMessage = (event) => {
        if (event.data?.type === 'NOTIFICATION_ACTION') {
          const { action, citaId } = event.data;
          if (action === 'confirm_appointment' && citaId) {
            apiClient.patch(`/appointments/${citaId}/status`, { estado: 'CONFIRMADA' })
              .then(() => {
                Toast.success('¡Cita confirmada correctamente desde la notificación!');
                this.refreshAppointments();
              })
              .catch(err => Toast.error(err.message || 'Error al confirmar cita.'));
          } else if (action === 'reschedule_appointment' && citaId) {
            apiClient.get(`/appointments/${citaId}`).then(res => {
              if (res.data) {
                if (this.userRole === 'TUTOR') this.openTutorRescheduleModal(res.data);
                else this.openEditScheduleModal(res.data);
              }
            }).catch(() => {});
          }
        }
      };
      navigator.serviceWorker.addEventListener('message', this.onSwMessage);
    }
  }

  async checkUrlActions() {
    const hash = window.location.hash || '';
    if (!hash.includes('?')) return;
    const queryStr = hash.split('?')[1];
    const params = new URLSearchParams(queryStr);
    const action = params.get('action');
    const citaId = params.get('citaId');

    if (!citaId) return;

    if (action === 'confirm') {
      try {
        await apiClient.patch(`/appointments/${citaId}/status`, { estado: 'CONFIRMADA' });
        Toast.success('¡Cita médica confirmada exitosamente!');
        window.history.replaceState(null, '', '#/appointments');
        await this.refreshAppointments();
      } catch (err) {
        Toast.error(err.message || 'Error al confirmar la cita.');
      }
    } else if (action === 'reschedule') {
      try {
        const res = await apiClient.get(`/appointments/${citaId}`);
        const apt = res.data;
        if (apt) {
          window.history.replaceState(null, '', '#/appointments');
          if (this.userRole === 'TUTOR') {
            this.openTutorRescheduleModal(apt);
          } else {
            this.openEditScheduleModal(apt);
          }
        }
      } catch (e) {}
    }
  }

  cleanupSync() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    if (this.onVisibilityChange) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.onVisibilityChange = null;
    }
    if (this.onWindowFocus) {
      window.removeEventListener('focus', this.onWindowFocus);
      this.onWindowFocus = null;
    }
    if (this.onAppointmentStatusChanged) {
      window.removeEventListener('appointment-status-changed', this.onAppointmentStatusChanged);
      this.onAppointmentStatusChanged = null;
    }
    if (this.onSwMessage && 'serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', this.onSwMessage);
      this.onSwMessage = null;
    }
  }

  // Actualización en caliente del modal de detalle abierto sin recargar la página
  updateLiveDetailModal() {
    if (!this.activeDetailCitaId) return;
    const modal = document.getElementById('modal-detail-appointment');
    if (!modal) {
      this.activeDetailCitaId = null;
      return;
    }

    const updatedApt = this.appointments.find(a => a.id === this.activeDetailCitaId);
    if (!updatedApt) return;

    const badgeContainer = modal.querySelector('#modal-detail-status-badge-container');
    if (badgeContainer) {
      badgeContainer.innerHTML = this.getStatusBadge(updatedApt.estado);
    }

    // Si la cita pasó a CONFIRMADA, ocultar botón de confirmación porque ya está confirmada
    if (updatedApt.estado === 'CONFIRMADA') {
      const confirmBtn = modal.querySelector('#btn-modal-confirm');
      if (confirmBtn) confirmBtn.style.display = 'none';
      const tutorConfirmBtn = modal.querySelector('#btn-tutor-confirm-pwa');
      if (tutorConfirmBtn) tutorConfirmBtn.style.display = 'none';
    }
  }

  // Actualización en caliente del modal de citas del día si está abierto
  updateLiveDayModal() {
    if (!this.activeDayModalDate) return;
    const modal = document.getElementById('modal-day-appointments');
    if (!modal) {
      this.activeDayModalDate = null;
      return;
    }

    const dateStr = this.activeDayModalDate;
    const dayAppointments = this.appointments
      .filter(a => a.fecha_hora_inicio && a.fecha_hora_inicio.slice(0, 10) === dateStr)
      .sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));

    const listContainer = modal.querySelector('#day-modal-appointments-list');
    if (!listContainer) return;

    const nowMs = Date.now();
    const isTutor = (this.userRole === 'TUTOR');
    const isStaff = ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole);

    listContainer.innerHTML = dayAppointments.length === 0 ? `
      <div style="text-align: center; padding: 3rem 1rem; color: var(--soft-text-muted);">
        <p style="margin: 0; font-size: 0.95rem; font-weight: 700;">No hay sesiones registradas en este día.</p>
      </div>
    ` : dayAppointments.map(apt => {
      const startTime = this.formatTime(apt.fecha_hora_inicio);
      const endTime = this.formatTime(apt.fecha_hora_fin);
      const startMs = new Date(apt.fecha_hora_inicio).getTime();
      const diffMinutes = Math.round((startMs - nowMs) / 60000);

      let urgencyPill = '';
      if (apt.estado === 'PROGRAMADA' || apt.estado === 'CONFIRMADA') {
        if (diffMinutes <= 45 && diffMinutes >= -60) {
          urgencyPill = `<span class="soft-badge soft-badge-rose" style="font-size: 0.68rem; font-weight: 800;">● En sala o en ${diffMinutes > 0 ? diffMinutes + 'm' : 'curso'}</span>`;
        } else if (diffMinutes > 45 && diffMinutes <= 120) {
          urgencyPill = `<span class="soft-badge soft-badge-amber" style="font-size: 0.68rem; font-weight: 700;">● Próxima en ${Math.round(diffMinutes / 60)}h</span>`;
        } else if (diffMinutes > 120) {
          urgencyPill = `<span class="soft-badge soft-badge-lavender" style="font-size: 0.68rem; font-weight: 600;">● Más tarde</span>`;
        }
      }

      return `
        <div class="soft-card-static" style="background: #FFFFFF; border: 1.5px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.1rem 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span style="font-size: 0.95rem; font-weight: 800; color: var(--soft-text-title);">
                ${startTime} a ${endTime} <span style="font-size: 0.76rem; font-weight: 600; color: var(--soft-text-muted);">(${apt.duracion_minutos} min)</span>
              </span>
              <span class="soft-badge soft-badge-indigo" style="font-size: 0.7rem; font-weight: 800;">
                ${this.escapeHtml(apt.ambiente_codigo || 'CONS')}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              ${urgencyPill}
              ${this.getStatusBadge(apt.estado)}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 0.75rem; margin-bottom: 0.85rem;">
            <div>
              <div style="font-size: 0.68rem; color: var(--soft-text-overline); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Paciente:</div>
              <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.95rem;">
                ${this.escapeHtml(apt.paciente_nombre_completo)}
              </div>
              <div style="font-size: 0.76rem; color: var(--soft-text-body);">
                Expediente: <strong>${this.escapeHtml(apt.paciente_codigo)}</strong> · CI: ${this.escapeHtml(apt.paciente_ci || 'S/E')}
              </div>
            </div>

            <div>
              <div style="font-size: 0.68rem; color: var(--soft-text-overline); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Terapeuta Asignado:</div>
              <div style="font-weight: 700; color: var(--soft-text-title); font-size: 0.92rem; display: flex; align-items: center; gap: 0.35rem;">
                <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.therapist(14)}</span>
                <span>Lic. ${this.escapeHtml(apt.terapeuta_nombre_completo)}</span>
              </div>
              <div style="font-size: 0.76rem; color: var(--soft-text-body);">
                ${this.escapeHtml(apt.especialidad_nombre || 'Especialista')}
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 0.45rem; justify-content: flex-end; align-items: center; border-top: 1px solid var(--soft-divider); padding-top: 0.65rem; flex-wrap: wrap;">
            ${(apt.estado === 'PROGRAMADA' || apt.estado === 'CONFIRMADA') && isStaff ? `
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2 btn-quick-attend" data-id="${apt.id}" title="Registrar llegada a sala">
                ${Icons.pulse(13, '#FFFFFF')}
                <span>Llegó (En Sala)</span>
              </button>
            ` : ''}
            <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-open-detail" data-id="${apt.id}">
              ${Icons.eye(14, 'var(--soft-purple-primary)')}
              <span>Detalles Completos</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.attachCardActions(listContainer);
  }

  unmount() {
    this.cleanupSync();
    document.getElementById('modal-schedule-appointment')?.remove();
    document.getElementById('modal-detail-appointment')?.remove();
    document.getElementById('modal-cancel-reason')?.remove();
    document.getElementById('modal-public-schedule')?.remove();
    document.getElementById('modal-day-appointments')?.remove();
  }

  getTutorTherapists() {
    if (this.userRole !== 'TUTOR') return this.therapists;

    const assignedIds = new Set();
    // 1. Del listado de hijos tutelados (pacientes.terapeuta_id)
    (this.patients || []).forEach(p => {
      if (p.terapeuta_id) assignedIds.add(Number(p.terapeuta_id));
    });
    // 2. De las citas cargadas de los hijos
    (this.appointments || []).forEach(a => {
      if (a.terapeuta_id) assignedIds.add(Number(a.terapeuta_id));
    });

    return this.therapists.filter(t => assignedIds.has(Number(t.id)));
  }

  populateTherapistFilter() {
    const selectTherapist = document.getElementById('select-filter-terapeuta');
    if (!selectTherapist) return;

    if (this.userRole === 'TUTOR') {
      const tutorTherapists = this.getTutorTherapists();
      selectTherapist.innerHTML = `
        <option value="">-- Terapeutas de sus Hijos (${tutorTherapists.length}) --</option>
        ${tutorTherapists.map(t => `
          <option value="${t.id}" ${this.filterTherapist == t.id ? 'selected' : ''}>
            Lic. ${this.escapeHtml(t.nombres)} ${this.escapeHtml(t.apellidos)} (${this.escapeHtml(t.especialidad_nombre || 'Especialista')})
          </option>
        `).join('')}
      `;
    } else if (this.userRole !== 'TERAPEUTA') {
      selectTherapist.innerHTML = `
        <option value="">-- Todos los Especialistas (${this.therapists.length}) --</option>
        ${this.therapists.map(t => `
          <option value="${t.id}" ${this.filterTherapist == t.id ? 'selected' : ''}>
            Lic. ${this.escapeHtml(t.nombres)} ${this.escapeHtml(t.apellidos)} (${this.escapeHtml(t.especialidad_nombre || 'Especialista')})
          </option>
        `).join('')}
      `;
    }
  }

  populateHijoFilter() {
    const selectHijo = document.getElementById('select-filter-hijo');
    if (!selectHijo) return;

    const count = (this.patients || []).length;
    selectHijo.innerHTML = `
      <option value="">-- Todos sus Hijos Tutelados (${count}) --</option>
      ${(this.patients || []).map(p => `
        <option value="${p.id}" ${this.filterPatientId == p.id ? 'selected' : ''}>
          ${this.escapeHtml(p.nombres)} ${this.escapeHtml(p.apellidos)} (${this.escapeHtml(p.codigo_expediente || 'EXP')})
        </option>
      `).join('')}
    `;
  }

  populateRoomFilter() {
    const selectRoom = document.getElementById('select-filter-ambiente');
    if (!selectRoom) return;

    selectRoom.innerHTML = `
      <option value="">-- Todos los Consultorios (${this.rooms.length}) --</option>
      ${(this.rooms || []).map(r => `
        <option value="${r.id}" ${this.filterRoomId == r.id ? 'selected' : ''}>
          ${this.escapeHtml(r.nombre?.split(' - ')[0] || r.codigo)}
        </option>
      `).join('')}
    `;
  }

  async loadInitialData() {
    try {
      const [therapistsRes, roomsRes, configRes] = await Promise.all([
        apiClient.get('/therapists').catch(() => ({ data: [] })),
        apiClient.get('/rooms').catch(() => ({ data: [] })),
        apiClient.get('/rooms/services').catch(() => ({ data: [] }))
      ]);

      this.therapists = therapistsRes.data || [];
      this.rooms = roomsRes.data || [];
      this.services = configRes.data || [];

      // Si es tutor, /patients retorna exclusivamente sus hijos tutelados
      const patientsRes = await apiClient.get('/patients?activo=true').catch(() => ({ data: [] }));
      this.patients = patientsRes.data || [];

      this.populateHijoFilter();
      this.populateTherapistFilter();
      this.populateRoomFilter();

      await this.refreshAppointments();
    } catch (err) {
      console.error('[AppointmentsView] Error al cargar catálogos:', err);
      Toast.error('No se pudieron cargar los datos del calendario.');
    }
  }

  async refreshAppointments(options = {}) {
    const silent = options.silent === true;
    const syncStatus = document.getElementById('sync-status-text');

    try {
      if (!silent && syncStatus) {
        syncStatus.textContent = 'Sincronizando...';
      }

      const dateStr = this.selectedDate;
      const params = new URLSearchParams();

      if (this.viewMode === 'MONTH') {
        const [year, month] = dateStr.slice(0, 7).split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const pad = (n) => String(n).padStart(2, '0');
        params.append('fecha_desde', `${year}-${pad(month)}-01`);
        params.append('fecha_hasta', `${year}-${pad(month)}-${pad(lastDay)}`);
      } else if (this.viewMode === 'FIVE_DAYS') {
        // Rango de 5 días compactos: Hoy + 4 días siguientes
        const dStart = new Date(dateStr + 'T00:00:00');
        const dEnd = new Date(dStart);
        dEnd.setDate(dStart.getDate() + 4);

        params.append('fecha_desde', this.getLocalDateString(dStart));
        params.append('fecha_hasta', this.getLocalDateString(dEnd));
      } else if (this.viewMode === 'LIST') {
        params.append('fecha_desde', dateStr);
      } else {
        // En vista ROOMS y DAY: fecha exacta
        params.append('fecha', dateStr);
      }

      if (this.filterRoomId) params.append('ambiente_id', this.filterRoomId);
      if (this.filterTherapist) params.append('terapeuta_id', this.filterTherapist);
      if (this.filterPatientId) params.append('paciente_id', this.filterPatientId);
      if (this.filterStatus) params.append('estado', this.filterStatus);
      if (this.searchTerm) params.append('search', this.searchTerm);

      const [appointmentsRes, statsRes] = await Promise.all([
        apiClient.get(`/appointments?${params.toString()}`),
        apiClient.get(`/appointments/stats/today?fecha=${this.selectedDate}`)
      ]);

      this.appointments = appointmentsRes.data || [];
      this.stats = statsRes.data || { total: 0, enAtencion: 0, confirmadas: 0, programadas: 0, atendidas: 0, canceladas: 0, ausentes: 0 };

      this.populateHijoFilter();
      this.populateTherapistFilter();
      this.updateKpis();
      this.renderCalendarContent();

      // Actualizar en caliente modales abiertos si están en pantalla
      this.updateLiveDetailModal();
      this.updateLiveDayModal();

      if (syncStatus) {
        syncStatus.textContent = 'Sincronizado en vivo';
      }
    } catch (err) {
      console.error('[AppointmentsView] Error al consultar citas:', err);
      if (syncStatus) {
        syncStatus.textContent = 'Error de sincronización';
      }

      if (!silent) {
        const content = document.getElementById('calendar-content-area');
        if (content) {
          content.innerHTML = `
            <div class="soft-card-static" style="text-align: center; padding: 3rem 1.5rem;">
              <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 0.85rem auto;">
                ${Icons.alertTriangle(26, 'var(--soft-purple-primary)')}
              </div>
              <h3 style="color: var(--soft-text-title); font-weight: 800; margin: 0 0 0.5rem 0;">Error al sincronizar citas</h3>
              <p style="color: var(--soft-text-body); max-width: 500px; margin: 0 auto 1.25rem;">
                ${this.escapeHtml(err.message || 'No se pudo conectar con el servidor para consultar las citas.')}
              </p>
              <button id="btn-retry-agenda" class="soft-btn soft-btn-lvl-1">
                ${Icons.refresh(15, '#FFFFFF')}
                <span>Reintentar</span>
              </button>
            </div>
          `;
          document.getElementById('btn-retry-agenda')?.addEventListener('click', () => this.refreshAppointments());
        }
      }
    }
  }

  updateKpis() {
    const elTotal = document.getElementById('kpi-total');
    const elAtencion = document.getElementById('kpi-en-atencion');
    const elConfirmadas = document.getElementById('kpi-confirmadas');
    const elProgramadas = document.getElementById('kpi-programadas');
    const elAtendidas = document.getElementById('kpi-atendidas');

    if (elTotal) elTotal.textContent = this.stats.total || 0;
    if (elAtencion) elAtencion.textContent = this.stats.enAtencion || 0;
    if (elConfirmadas) elConfirmadas.textContent = this.stats.confirmadas || 0;
    if (elProgramadas) elProgramadas.textContent = this.stats.programadas || 0;
    if (elAtendidas) elAtendidas.textContent = this.stats.atendidas || 0;
  }

  renderCalendarContent() {
    const area = document.getElementById('calendar-content-area');
    if (!area) return;

    if (this.viewMode === 'MONTH') {
      this.renderMonthView(area);
    } else if (this.viewMode === 'FIVE_DAYS') {
      this.renderFiveDaysView(area);
    } else if (this.viewMode === 'ROOMS') {
      this.renderRoomsParallelView(area);
    } else if (this.viewMode === 'DAY') {
      this.renderDayView(area);
    } else if (this.viewMode === 'LIST') {
      this.renderListView(area);
    }
  }

  // =========================================================================
  // VISTA 0: CALENDARIO MENSUAL COMPLETO (PREDETERMINADO PARA ADMIN Y RECEPCIÓN)
  // Grilla mensual institucional con selector de días y panel cronológico lateral
  // =========================================================================
  renderMonthView(container) {
    const dateStr = this.selectedDate;
    const [year, month] = dateStr.slice(0, 7).split('-').map(Number);
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = this.getLocalDateString();

    // Asegurar que selectedMonthDay pertenece al mes visible
    if (!this.selectedMonthDay || !this.selectedMonthDay.startsWith(dateStr.slice(0, 7))) {
      this.selectedMonthDay = this.selectedDate;
    }

    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    // En Bolivia la semana laboral inicia en Lunes (Lunes=0..Domingo=6)
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    let cellsHtml = '';
    for (let i = 0; i < startOffset; i++) {
      cellsHtml += `<div style="background: var(--soft-lavender-surface); min-height: 84px; border-radius: 14px; opacity: 0.4; border: 1px dashed var(--soft-border-card-inner);"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = `${year}-${pad(month)}-${pad(day)}`;
      const dayAppointments = this.appointments
        .filter(a => a.fecha_hora_inicio && a.fecha_hora_inicio.slice(0, 10) === cellDate)
        .sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));

      const isToday = (cellDate === todayStr);
      const isSelected = (cellDate === this.selectedMonthDay);

      // Desglose por salas
      const roomCounts = (this.rooms || []).map(r => ({
        room: r,
        count: dayAppointments.filter(s => s.ambiente_id === r.id).length
      })).filter(rc => rc.count > 0);

      cellsHtml += `
        <div class="month-cal-day-cell ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}" data-date="${cellDate}">
          <!-- Cabecera de la celda de día -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <div style="display: flex; align-items: center; gap: 0.3rem;">
              <span style="font-weight: 800; font-size: 0.96rem; color: ${isToday ? 'var(--soft-mint-deep)' : (isSelected ? 'var(--soft-purple-primary)' : 'var(--soft-text-title)')};">
                ${day}
              </span>
              ${isToday ? `<span class="soft-badge soft-badge-mint" style="font-size: 0.62rem; padding: 0.1rem 0.38rem;">HOY</span>` : ''}
            </div>

            ${dayAppointments.length > 0 ? `
              <span class="soft-badge ${isSelected ? 'soft-badge-lavender' : (isToday ? 'soft-badge-mint' : 'soft-badge-slate')}" style="font-weight: 800; font-size: 0.72rem; padding: 0.12rem 0.45rem;">
                ${dayAppointments.length}
              </span>
            ` : ''}
          </div>

          <!-- Micro-insignias de salas ocupadas -->
          <div style="display: flex; flex-direction: column; gap: 0.22rem; margin-top: auto;">
            ${roomCounts.slice(0, 3).map(rc => `
              <div style="font-size: 0.67rem; font-weight: 700; color: ${rc.room.color_identificador || 'var(--soft-purple-primary)'}; background: ${rc.room.color_identificador ? rc.room.color_identificador + '15' : 'var(--soft-lavender-surface)'}; border: 1px solid ${rc.room.color_identificador ? rc.room.color_identificador + '30' : 'var(--soft-border-card-inner)'}; border-radius: 6px; padding: 0.1rem 0.35rem; display: flex; align-items: center; justify-content: space-between;" title="${this.escapeHtml(rc.room.nombre || rc.room.codigo)}: ${rc.count} sesión(es)">
                <span style="display: inline-flex; align-items: center; gap: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <span style="width: 5px; height: 5px; border-radius: 50%; background: ${rc.room.color_identificador || 'var(--soft-purple-primary)'}; display: inline-block; flex-shrink: 0;"></span>
                  <span>${this.escapeHtml(rc.room.codigo || rc.room.nombre?.split(' - ')[0] || 'Sala')}</span>
                </span>
                <span>${rc.count}</span>
              </div>
            `).join('')}

            ${roomCounts.length > 3 ? `
              <div style="font-size: 0.64rem; color: var(--soft-text-muted); font-weight: 700; text-align: right;">
                +${roomCounts.length - 3} más
              </div>
            ` : ''}

            ${dayAppointments.length === 0 ? `
              <div style="font-size: 0.68rem; color: var(--soft-text-muted); font-style: italic; opacity: 0.7;">
                Disponible
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="month-agenda-layout">
        
        <!-- Columna 1: Grilla del Mes Completo -->
        <div class="soft-card-static" style="padding: 1.35rem 1.45rem;">
          
          <!-- Encabezado de la Grilla con Leyenda de Salas -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.15rem; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <div style="font-weight: 800; color: var(--soft-text-title); font-size: 1.15rem; letter-spacing: -0.015em;">
                ${this.formatMonthHeader(dateStr)}
              </div>
              <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                ${this.appointments.length} cita(s) registrada(s) este mes · Seleccione un día para inspeccionar el detalle clínico.
              </div>
            </div>

            <!-- Leyenda de salas / consultorios -->
            <div style="display: flex; gap: 0.65rem; font-size: 0.74rem; color: var(--soft-text-body); font-weight: 600; align-items: center; flex-wrap: wrap;">
              ${(this.rooms || []).map(r => `
                <span style="display: inline-flex; align-items: center; gap: 0.32rem;" title="${this.escapeHtml(r.nombre || r.codigo)}">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: ${r.color_identificador || 'var(--soft-purple-primary)'}; display: inline-block;"></span>
                  <span>${this.escapeHtml(r.nombre?.split(' - ')[0] || r.codigo)}</span>
                </span>
              `).join('')}
            </div>
          </div>

          <!-- Encabezados de días de la semana -->
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; text-align: center; font-weight: 800; font-size: 0.74rem; color: var(--soft-text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.5rem;">
            <div>Lun</div><div>Mar</div><div>Mié</div><div>Jue</div><div>Vie</div><div>Sáb</div><div>Dom</div>
          </div>

          <!-- Grilla de celdas -->
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem;" id="month-calendar-cells-grid">
            ${cellsHtml}
          </div>
        </div>

        <!-- Columna 2: Panel Lateral con Detalle Clínico del Día Seleccionado -->
        <div class="soft-card-static" style="padding: 1.35rem 1.45rem; position: sticky; top: 1rem; max-height: calc(100vh - 120px); overflow-y: auto;" id="month-day-detail-panel">
          ${this.renderMonthDayDetail(this.selectedMonthDay)}
        </div>

      </div>
    `;

    // Conectar clic en celdas de días
    container.querySelectorAll('.month-cal-day-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const date = cell.dataset.date;
        if (date) {
          this.selectedMonthDay = date;
          this.renderMonthView(container);
          if (window.innerWidth <= 1040) {
            setTimeout(() => {
              document.getElementById('month-day-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 60);
          }
        }
      });
    });

    // Conectar botones de agendar en fecha
    container.querySelectorAll('.btn-month-schedule-day').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const date = btn.dataset.date || this.selectedMonthDay;
        this.openScheduleModal({ fecha: date });
      });
    });

    // Conectar acciones clínicas estándar
    this.attachCardActions(container);
  }

  renderMonthDayDetail(dateStr) {
    const dayAppointments = this.appointments
      .filter(a => a.fecha_hora_inicio && a.fecha_hora_inicio.slice(0, 10) === dateStr)
      .sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));

    const isToday = (dateStr === this.getLocalDateString());
    const dateFormatted = this.formatDateHeader(dateStr);
    const isStaff = ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole);

    let html = `
      <!-- Encabezado del Panel del Día -->
      <div style="border-bottom: 1px solid var(--soft-divider); padding-bottom: 1rem; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; flex-wrap: wrap;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 0.2rem;">
              <span class="soft-badge soft-badge-lavender" style="font-size: 0.68rem;">Detalle Diario</span>
              ${isToday ? `<span class="soft-badge soft-badge-mint" style="font-size: 0.68rem;">HOY</span>` : ''}
            </div>
            <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--soft-text-title); margin: 0; letter-spacing: -0.015em;">
              ${dateFormatted}
            </h3>
            <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.2rem;">
              ${dayAppointments.length} sesión(es) programada(s)
            </div>
          </div>

          ${isStaff ? `
            <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2 btn-month-schedule-day" data-date="${dateStr}" title="Agendar cita en esta fecha">
              ${Icons.calendarPlus(14, '#FFFFFF')}
              <span>+ Agendar</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;

    if (dayAppointments.length === 0) {
      html += `
        <div style="text-align: center; padding: 3rem 1rem; color: var(--soft-text-muted); background: var(--soft-lavender-surface); border-radius: 16px; border: 1px dashed var(--soft-border-card-inner);">
          <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto 0.75rem auto;">
            ${Icons.calendar(22, 'var(--soft-purple-primary)')}
          </div>
          <div style="font-weight: 800; font-size: 0.98rem; color: var(--soft-text-title);">Sin citas programadas</div>
          <div style="font-size: 0.8rem; margin: 0.25rem 0 1rem 0;">No existen sesiones agendadas para esta fecha.</div>
          ${isStaff ? `
            <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2 btn-month-schedule-day" data-date="${dateStr}">
              ${Icons.calendarPlus(14, '#FFFFFF')}
              <span>+ Programar Cita en este Día</span>
            </button>
          ` : ''}
        </div>
      `;
    } else {
      html += `
        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${dayAppointments.map(apt => {
            const startTime = this.formatTime(apt.fecha_hora_inicio);
            const endTime = this.formatTime(apt.fecha_hora_fin);
            const tutorPhone = apt.tutor_telefono || apt.paciente_telefono;
            const cleanPhone = tutorPhone ? tutorPhone.replace(/[^\d]/g, '') : '';

            return `
              <div class="soft-subcard appointment-card" data-id="${apt.id}" style="padding: 1rem 1.15rem; cursor: pointer; transition: all 0.2s ease;">
                
                <!-- Fila 1: Horario, Sala y Estado -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.55rem; flex-wrap: wrap; gap: 0.4rem;">
                  <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                    <span style="font-weight: 800; color: var(--soft-text-title); font-size: 0.95rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                      <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.clock(14)}</span>
                      <span>${startTime} - ${endTime}</span>
                    </span>
                    <span class="soft-badge soft-badge-lavender" style="font-size: 0.7rem; padding: 0.12rem 0.45rem;">
                      ${this.escapeHtml(apt.ambiente_codigo || apt.ambiente_nombre?.split(' - ')[0] || 'Sala')}
                    </span>
                  </div>
                  <div>
                    ${this.getStatusBadge(apt.estado)}
                  </div>
                </div>

                <!-- Fila 2: Paciente y Terapeuta -->
                <div style="margin-bottom: 0.55rem;">
                  <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.95rem;">
                    ${this.escapeHtml(apt.paciente_nombre_completo)}
                  </div>
                  <div style="font-size: 0.76rem; color: var(--soft-text-body); margin-top: 0.12rem; display: flex; align-items: center; gap: 0.35rem;">
                    <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.therapist(13)}</span>
                    <span>Lic. ${this.escapeHtml(apt.terapeuta_nombre_completo)}</span>
                    <span style="color: var(--soft-text-muted);">· ${this.escapeHtml(apt.especialidad_nombre || 'Especialista')}</span>
                  </div>
                </div>

                <!-- Fila 3: Servicio y Tutor con Enlace WhatsApp -->
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 0.65rem; font-size: 0.76rem;">
                  <div style="color: var(--soft-text-muted);">
                    ${apt.servicio_nombre ? `<strong style="color: var(--soft-purple-primary);">${this.escapeHtml(apt.servicio_nombre)}</strong>` : 'Sesión regular'}
                  </div>

                  ${cleanPhone ? `
                    <a href="https://wa.me/${cleanPhone}" target="_blank" rel="noopener noreferrer" 
                      class="soft-badge soft-badge-emerald" style="text-decoration: none; font-size: 0.72rem; padding: 0.18rem 0.5rem; display: inline-flex; align-items: center; gap: 0.3rem;"
                      title="Enviar mensaje por WhatsApp al tutor" onclick="event.stopPropagation();">
                      ${Icons.whatsapp(12, 'var(--soft-emerald-dark)')}
                      <span>WhatsApp Tutor</span>
                    </a>
                  ` : ''}
                </div>

                <!-- Fila 4: Acciones Clínicas -->
                <div style="display: flex; gap: 0.4rem; justify-content: flex-end; align-items: center; border-top: 1px solid var(--soft-divider); padding-top: 0.55rem; flex-wrap: wrap;">
                  ${(apt.estado === 'PROGRAMADA' || apt.estado === 'CONFIRMADA') && isStaff ? `
                    <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2 btn-quick-attend" data-id="${apt.id}" title="Registrar llegada del paciente">
                      ${Icons.pulse(13, '#FFFFFF')}
                      <span>En Sala</span>
                    </button>
                  ` : ''}

                  ${apt.estado === 'EN_ATENCION' && isStaff ? `
                    <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2 btn-quick-complete" data-id="${apt.id}" title="Marcar sesión como atendida">
                      ${Icons.check(13, '#FFFFFF')}
                      <span>Completar</span>
                    </button>
                  ` : ''}

                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-open-detail" data-id="${apt.id}">
                    ${Icons.eye(13, 'var(--soft-purple-primary)')}
                    <span>Ver Ficha</span>
                  </button>
                </div>

              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return html;
  }

  // =========================================================================
  // VISTA 1: CINCO DÍAS COMPACTOS (HOY + 4 DÍAS SIGUIENTES)
  // Muestra tarjetas de día limpias con puntos de colores de salas y pulso en HOY.
  // Al hacer clic en un día se abre la ventana emergente con semáforo de proximidad.
  // =========================================================================
  renderFiveDaysView(container) {
    const baseDate = new Date(this.selectedDate + 'T00:00:00');
    const todayStr = this.getLocalDateString();
    const days = [];

    // 5 días exactos: Hoy + 4 días siguientes
    for (let i = 0; i < 5; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      days.push(this.getLocalDateString(d));
    }

    const dayShortNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1.15rem; align-items: stretch;" class="five-days-grid">
        ${days.map((dayStr, idx) => {
          const isToday = (dayStr === todayStr);
          const dayParts = dayStr.split('-').map(Number);
          const dateObj = new Date(dayParts[0], dayParts[1] - 1, dayParts[2]);
          const dayName = dayShortNames[dateObj.getDay()];
          const dayNumber = dateObj.getDate();
          const monthName = monthNames[dateObj.getMonth()];

          // Citas de este día filtradas
          const dayAppointments = this.appointments
            .filter(a => a.fecha_hora_inicio && a.fecha_hora_inicio.slice(0, 10) === dayStr)
            .sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));

          // Desglose de ocupación por salas
          const sala1Count = dayAppointments.filter(s => s.ambiente_id === 1).length;
          const sala2Count = dayAppointments.filter(s => s.ambiente_id === 2).length;
          const sala3Count = dayAppointments.filter(s => s.ambiente_id === 3).length;

          // Primera cita del día para previsualización inmediata
          const firstApt = dayAppointments[0];

          return `
            <div class="soft-room-card day-tile-card ${isToday ? 'soft-room-mint today-card-active' : ''}" data-date="${dayStr}"
              style="padding: 1.25rem 1.15rem; cursor: pointer; ${isToday ? 'background: var(--soft-gradient-quick-mint);' : ''}">
              
              <!-- Cabecera de la Tarjeta del Día -->
              <div style="padding-bottom: 0.85rem; margin-bottom: 1rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                    ${isToday ? `<span class="soft-badge soft-badge-mint" style="padding: 0.2rem 0.6rem; font-size: 0.68rem;">HOY</span>` : ''}
                    <span style="font-weight: 800; font-size: 0.98rem; color: var(--soft-text-title); letter-spacing: -0.015em;">${dayName} ${dayNumber} ${monthName}</span>
                  </div>
                  <div style="font-size: 0.75rem; color: var(--soft-text-muted); font-weight: 600; margin-top: 0.2rem;">
                    ${idx === 0 && isToday ? 'Jornada Activa de Atención' : (idx === 1 ? 'Mañana' : `Día +${idx}`)}
                  </div>
                </div>

                <div>
                  <span class="soft-badge ${isToday ? 'soft-badge-mint' : 'soft-badge-lavender'}" style="font-weight: 800; font-size: 0.82rem; padding: 0.28rem 0.72rem;">
                    ${dayAppointments.length}
                  </span>
                </div>
              </div>

              <!-- Cuerpo de la Tarjeta del Día -->
              <div style="display: flex; flex-direction: column; flex: 1; justify-content: space-between; text-align: center;">
                
                <div>
                  <!-- Contador numérico principal -->
                  <div style="font-size: 2.15rem; font-weight: 800; color: var(--soft-text-title); line-height: 1; letter-spacing: -0.03em;">
                    ${dayAppointments.length}
                  </div>
                  <div style="font-size: 0.72rem; color: var(--soft-text-overline); text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em; margin-top: 0.3rem;">
                    ${dayAppointments.length === 1 ? 'Sesión Programada' : 'Sesiones Programadas'}
                  </div>

                  <!-- Insignias suaves de los consultorios físicos -->
                  <div style="display: flex; gap: 0.4rem; margin: 1rem 0; flex-wrap: wrap; justify-content: center;">
                    ${sala1Count > 0 ? `
                      <span class="soft-badge soft-badge-indigo" title="Consultorio 1 - Infantil / Neuropsicología" style="font-size: 0.7rem; padding: 0.22rem 0.6rem;">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--soft-indigo-accent); display: inline-block;"></span>
                        <span>Sala 1 (${sala1Count})</span>
                      </span>
                    ` : ''}
                    ${sala2Count > 0 ? `
                      <span class="soft-badge soft-badge-lavender" title="Consultorio 2 - Evaluación Integral y Terapia Conductual" style="font-size: 0.7rem; padding: 0.22rem 0.6rem;">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--soft-purple-primary); display: inline-block;"></span>
                        <span>Sala 2 (${sala2Count})</span>
                      </span>
                    ` : ''}
                    ${sala3Count > 0 ? `
                      <span class="soft-badge soft-badge-amber" title="Consultorio 3 - Adultos y Psicogerontología" style="font-size: 0.7rem; padding: 0.22rem 0.6rem;">
                        <span style="width: 6px; height: 6px; border-radius: 50%; background: #D97706; display: inline-block;"></span>
                        <span>Sala 3 (${sala3Count})</span>
                      </span>
                    ` : ''}
                    ${dayAppointments.length === 0 ? `
                      <span style="font-size: 0.76rem; color: var(--soft-text-muted); font-style: italic;">Sin salas ocupadas</span>
                    ` : ''}
                  </div>

                  <!-- Previsualización de la primera cita si existe -->
                  ${firstApt ? `
                    <div style="background: rgba(255, 255, 255, 0.88); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.6rem 0.75rem; font-size: 0.76rem; color: var(--soft-text-title); text-align: left; margin-bottom: 0.85rem;">
                      <div style="font-size: 0.66rem; color: var(--soft-text-overline); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em; margin-bottom: 0.15rem;">
                        ${this.userRole === 'TUTOR' ? 'Sesión Familiar:' : 'Primera Sesión:'}
                      </div>
                      <div style="font-weight: 700; color: var(--soft-purple-primary); display: flex; justify-content: space-between; align-items: center; gap: 0.35rem;">
                        <span>${this.formatTime(firstApt.fecha_hora_inicio)} · ${this.escapeHtml(firstApt.paciente_nombre_completo?.split(' ')[0] || 'Paciente')}</span>
                        <span class="soft-badge soft-badge-lavender" style="font-size: 0.65rem; padding: 0.14rem 0.48rem;">
                          ${this.escapeHtml(firstApt.ambiente_codigo || 'Sala')}
                        </span>
                      </div>
                      <div style="font-size: 0.73rem; color: var(--soft-text-body); margin-top: 0.22rem; display: flex; align-items: center; gap: 0.28rem;">
                        <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.therapist(12)}</span>
                        <span>Lic. ${this.escapeHtml(firstApt.terapeuta_nombre_completo?.split(' ')[0] || 'Especialista')}</span>
                      </div>
                    </div>
                  ` : ''}
                </div>

                <!-- Botón de apertura de ventana emergente del día -->
                <div style="margin-top: 0.4rem;">
                  ${dayAppointments.length > 0 ? `
                    <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-open-day-modal" data-date="${dayStr}" style="width: 100%;">
                      ${Icons.eye(15, '#FFFFFF')}
                      <span>Ver ${dayAppointments.length} Cita(s) del Día</span>
                    </button>
                  ` : `
                    ${['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole) ? `
                      <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-schedule-day" data-date="${dayStr}" style="width: 100%;">
                        ${Icons.calendarPlus(14, 'var(--soft-purple-primary)')}
                        <span>+ Agendar en este día</span>
                      </button>
                    ` : `
                      <div style="font-size: 0.78rem; color: var(--soft-text-muted); padding: 0.5rem 0;">Disponible</div>
                    `}
                  `}
                </div>

              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    // Conectar eventos de apertura del modal de citas del día al hacer clic en la tarjeta o botón
    container.querySelectorAll('.day-tile-card, .btn-open-day-modal').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.btn-schedule-day')) return;
        const date = el.dataset.date || el.closest('.day-tile-card')?.dataset.date;
        if (date) this.openDayAppointmentsModal(date);
      });
    });

    container.querySelectorAll('.btn-schedule-day').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const date = btn.dataset.date;
        this.openScheduleModal({ fecha: date });
      });
    });
  }

  // =========================================================================
  // MODAL DE CITAS DEL DÍA: VENTANA EMERGENTE LIMPIA Y ELEGANTE (NIVEL 2)
  // Incorpora el semáforo de proximidad gradual (<45m rojo, 1-2h ámbar, >2h amarillo)
  // =========================================================================
  openDayAppointmentsModal(dateStr) {
    const modalContainer = document.getElementById('modal-container-agenda');
    if (!modalContainer) return;

    this.activeDayModalDate = dateStr;

    const dayAppointments = this.appointments
      .filter(a => a.fecha_hora_inicio && a.fecha_hora_inicio.slice(0, 10) === dateStr)
      .sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));

    const isToday = (dateStr === this.getLocalDateString());
    const dateFormatted = this.formatDateHeader(dateStr);
    const nowMs = Date.now();
    const isTutor = (this.userRole === 'TUTOR');
    const isStaff = ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole);

    modalContainer.innerHTML = `
      <div id="modal-day-appointments" class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.45); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1050; padding: 1rem;">
        
        <div class="soft-modal-card" style="max-width: 840px; max-height: 90vh;">
          
          <!-- Encabezado de la Ventana Emergente -->
          <div style="background: var(--soft-lavender-surface); padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.calendar(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.015em;">
                    Citas del ${dateFormatted}
                  </h3>
                  ${isToday ? `<span class="soft-badge soft-badge-mint" style="font-size: 0.68rem;">HOY</span>` : ''}
                </div>
                <div style="font-size: 0.8rem; color: var(--soft-text-body); margin-top: 0.18rem;">
                  ${dayAppointments.length} sesión(es) registrada(s) · Ordenadas estrictamente por orden de hora de inicio.
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.55rem;">
              ${isStaff ? `
                <button id="btn-modal-day-new" type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2">
                  ${Icons.calendarPlus(14, '#FFFFFF')}
                  <span>+ Nueva Cita</span>
                </button>
              ` : ''}
              <button id="btn-close-day-modal" type="button" class="soft-modal-close-btn" aria-label="Cerrar">
                ${Icons.close(18)}
              </button>
            </div>
          </div>

          <!-- Leyenda de Proximidad Gradual si es HOY -->
          ${isToday && dayAppointments.length > 0 ? `
            <div style="background: #FCFBFF; padding: 0.65rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; gap: 1rem; font-size: 0.74rem; align-items: center; flex-wrap: wrap;">
              <span style="font-weight: 700; color: var(--soft-text-overline); text-transform: uppercase; letter-spacing: 0.03em;">Semáforo de Proximidad Horaria:</span>
              <span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #BE123C; font-weight: 600;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #EF4444; display: inline-block;"></span>
                <span>En sala o en menos de 45m</span>
              </span>
              <span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #B45309; font-weight: 600;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span>
                <span>Próxima (en 1 a 2 horas)</span>
              </span>
              <span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #A16207; font-weight: 600;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #EAB308; display: inline-block;"></span>
                <span>Más tarde hoy (&gt; 2 horas)</span>
              </span>
            </div>
          ` : ''}

          <!-- Cuerpo: Lista de citas ordenadas cronológicamente -->
          <div id="day-modal-appointments-list" style="padding: 1.4rem 1.5rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.95rem; flex: 1;">
            ${dayAppointments.length === 0 ? `
              <div style="text-align: center; padding: 3.5rem 1rem; color: var(--soft-text-muted); background: var(--soft-lavender-surface); border-radius: 20px; border: 1px dashed var(--soft-border-card-inner);">
                <div class="soft-icon-box soft-icon-box-mint" style="margin: 0 auto 0.75rem auto;">
                  ${Icons.checkCircle(24, 'var(--soft-mint-deep)')}
                </div>
                <div style="font-weight: 800; font-size: 1.02rem; color: var(--soft-text-title);">Sin sesiones para esta jornada</div>
                <div style="font-size: 0.84rem; margin-top: 0.25rem;">No se encontraron citas agendadas para este día.</div>
              </div>
            ` : dayAppointments.map(apt => {
              const startTime = this.formatTime(apt.fecha_hora_inicio);
              const endTime = this.formatTime(apt.fecha_hora_fin);
              const startMs = new Date(apt.fecha_hora_inicio.replace('T', ' ')).getTime();
              const endMs = new Date(apt.fecha_hora_fin.replace('T', ' ')).getTime();
              const diffMinutes = Math.round((startMs - nowMs) / 60000);

              let proximityBadge = '';
              if (['ATENDIDA', 'CANCELADA', 'REPROGRAMADA'].includes(apt.estado)) {
                proximityBadge = '';
              } else if (apt.estado === 'EN_ATENCION' || (isToday && nowMs >= startMs && nowMs <= endMs)) {
                proximityBadge = `<span class="soft-badge soft-badge-rose" style="font-size: 0.7rem;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #EF4444; display: inline-block;"></span><span>En Sala Ahora</span></span>`;
              } else if (isToday && diffMinutes > 0 && diffMinutes <= 45) {
                proximityBadge = `<span class="soft-badge soft-badge-rose" style="font-size: 0.7rem;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #EF4444; display: inline-block;"></span><span>Inminente (${diffMinutes}m)</span></span>`;
              } else if (isToday && diffMinutes > 45 && diffMinutes <= 120) {
                proximityBadge = `<span class="soft-badge soft-badge-amber" style="font-size: 0.7rem;"><span style="width: 6px; height: 6px; border-radius: 50%; background: #F59E0B; display: inline-block;"></span><span>Próxima (~${Math.round(diffMinutes/60)}h)</span></span>`;
              } else if (isToday && nowMs > endMs) {
                proximityBadge = `<span class="soft-badge soft-badge-slate" style="font-size: 0.7rem;">Horario Cumplido</span>`;
              } else {
                proximityBadge = '';
              }

              return `
                <div class="soft-subcard appointment-modal-card" data-id="${apt.id}" style="padding: 1.1rem 1.25rem;">
                  
                  <!-- Fila 1: Horario, Consultorio y Proximidad -->
                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.65rem;">
                    <div style="display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap;">
                      <span style="font-weight: 800; color: var(--soft-text-title); font-size: 1.02rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                        <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.clock(15)}</span>
                        <span>${startTime} a ${endTime}</span>
                        <span style="font-size: 0.75rem; color: var(--soft-text-muted); font-weight: 600;">(${apt.duracion_minutos} min)</span>
                      </span>

                      <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem;">
                        ${this.escapeHtml(apt.ambiente_codigo || apt.ambiente_nombre?.split(' - ')[0] || 'Sala')}
                      </span>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                      ${proximityBadge}
                      ${this.getStatusBadge(apt.estado)}
                    </div>
                  </div>

                  <!-- Fila 2: Datos del Paciente y Especialista Asignado -->
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 0.85rem; margin-bottom: 0.6rem;">
                    <div>
                      <div style="font-size: 0.68rem; color: var(--soft-text-overline); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">
                        ${isTutor ? 'Hijo/a Tutelado/a:' : 'Paciente:'}
                      </div>
                      <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.98rem;">
                        ${this.escapeHtml(apt.paciente_nombre_completo)}
                      </div>
                      <div style="font-size: 0.76rem; color: var(--soft-text-body);">
                        Expediente: <strong>${this.escapeHtml(apt.paciente_codigo || '')}</strong> · CI: <strong>${this.escapeHtml(apt.paciente_ci || 'S/E')}</strong>
                      </div>
                    </div>

                    <div>
                      <div style="font-size: 0.68rem; color: var(--soft-text-overline); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Terapeuta Asignado:</div>
                      <div style="font-weight: 700; color: var(--soft-text-title); font-size: 0.92rem; display: flex; align-items: center; gap: 0.35rem;">
                        <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.therapist(14)}</span>
                        <span>Lic. ${this.escapeHtml(apt.terapeuta_nombre_completo)}</span>
                      </div>
                      <div style="font-size: 0.76rem; color: var(--soft-text-body);">
                        ${this.escapeHtml(apt.especialidad_nombre || 'Especialista')}
                      </div>
                    </div>
                  </div>

                  <!-- Fila 3: Servicio y Motivo -->
                  ${apt.servicio_nombre || apt.motivo_consulta ? `
                    <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.5rem 0.75rem; font-size: 0.78rem; margin-bottom: 0.65rem; color: var(--soft-text-body);">
                      ${apt.servicio_nombre ? `<strong style="color: var(--soft-purple-primary);">${this.escapeHtml(apt.servicio_nombre)}</strong> ${apt.servicio_arancel ? `(Bs. ${apt.servicio_arancel})` : ''} — ` : ''}
                      <span>"${this.escapeHtml(apt.motivo_consulta || 'Sesión programada regular')}"</span>
                    </div>
                  ` : ''}

                  <!-- Fila 4: Acciones Clínicas en 1 Clic según Rol (Botones Nivel 2 dentro de Modal) -->
                  <div style="display: flex; gap: 0.45rem; justify-content: flex-end; align-items: center; border-top: 1px solid var(--soft-divider); padding-top: 0.65rem; flex-wrap: wrap;">
                    ${(apt.estado === 'PROGRAMADA' || apt.estado === 'CONFIRMADA') && isStaff ? `
                      <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2 btn-quick-attend" data-id="${apt.id}" title="Registrar llegada a sala">
                        ${Icons.pulse(13, '#FFFFFF')}
                        <span>Llegó (En Sala)</span>
                      </button>
                    ` : ''}

                    ${apt.estado === 'EN_ATENCION' && isStaff ? `
                      <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2 btn-quick-complete" data-id="${apt.id}" title="Marcar sesión completada">
                        ${Icons.check(13, '#FFFFFF')}
                        <span>Completar</span>
                      </button>
                    ` : ''}

                    ${apt.estado === 'ATENDIDA' && ['ADMIN', 'TERAPEUTA'].includes(this.userRole) ? `
                      <a href="#/clinical-records?patientId=${apt.paciente_id}&patient=${apt.paciente_id}&action=soap" 
                        class="soft-btn soft-btn-sm soft-btn-lvl-2 btn-modal-day-soap" title="Redactar Nota SOAP para este paciente">
                        ${Icons.fileText(13, '#FFFFFF')}
                        <span>Nota SOAP</span>
                      </a>
                    ` : ''}

                    <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-open-detail" data-id="${apt.id}">
                      ${Icons.eye(14, 'var(--soft-purple-primary)')}
                      <span>Detalles Completos</span>
                    </button>
                  </div>

                </div>
              `;
            }).join('')}
          </div>

        </div>
      </div>
    `;

    // Cerrar modal del día
    document.getElementById('btn-close-day-modal')?.addEventListener('click', () => {
      this.activeDayModalDate = null;
      document.getElementById('modal-day-appointments')?.remove();
    });

    const dayBackdrop = document.getElementById('modal-day-appointments');
    dayBackdrop?.addEventListener('click', (e) => {
      if (e.target === dayBackdrop) {
        this.activeDayModalDate = null;
        dayBackdrop.remove();
      }
    });

    // Cerrar modal al navegar a SOAP
    modalContainer.querySelectorAll('.btn-modal-day-soap').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeDayModalDate = null;
        document.getElementById('modal-day-appointments')?.remove();
      });
    });

    // Botón para agendar en este día desde el encabezado
    document.getElementById('btn-modal-day-new')?.addEventListener('click', () => {
      this.activeDayModalDate = null;
      document.getElementById('modal-day-appointments')?.remove();
      this.openScheduleModal({ fecha: dateStr });
    });

    // Conectar acciones de tarjetas
    this.attachCardActions(modalContainer);
  }

  /**
   * VISTA MULTICONSULTORIO: COLUMNAS PARALELAS POR CONSULTORIO FÍSICO (NIVEL 1)
   */
  renderRoomsParallelView(container) {
    const rooms = this.rooms.length > 0 ? this.rooms : [
      { id: 1, codigo: 'CONS-01', nombre: 'Consultorio 1 - Infantil / Neuropsicología y Psicopedagogía', color_identificador: '#584294', descripcion: 'Equipado con materiales sensoriales y baterías CUMANES / WISC-V' },
      { id: 2, codigo: 'CONS-02', nombre: 'Consultorio 2 - Evaluación Integral y Terapia Conductual', color_identificador: '#6E56B0', descripcion: 'Ambiente adaptado para evaluación conductual y adolescentes' },
      { id: 3, codigo: 'CONS-03', nombre: 'Consultorio 3 - Adultos y Psicogerontología', color_identificador: '#1AA69C', descripcion: 'Consultorio privado e independiente para adultos mayores (Horizontes Plateados)' }
    ];

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 1.35rem; align-items: start;" class="multisala-grid">
        ${rooms.map((room, rIdx) => {
          const roomAppointments = this.appointments.filter(a => a.ambiente_id === room.id);
          const isMintBox = (rIdx % 2 === 1);

          return `
            <div class="soft-card-static ${isMintBox ? 'soft-card-mint' : ''}" style="padding: 1.35rem 1.3rem;">
              
              <div style="padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; min-width: 0;">
                  <div class="soft-icon-box soft-icon-box-sm ${isMintBox ? 'soft-icon-box-mint' : 'soft-icon-box-lavender'}" style="font-weight: 800; font-size: 0.92rem;">
                    ${room.id}
                  </div>
                  <div style="min-width: 0;">
                    <h3 style="margin: 0; font-size: 0.98rem; color: var(--soft-text-title); font-weight: 800; line-height: 1.25; letter-spacing: -0.01em;">
                      ${this.escapeHtml(room.nombre.split(' - ')[0])}
                    </h3>
                    <div style="font-size: 0.76rem; color: var(--soft-text-body); font-weight: 500; margin-top: 0.12rem;">
                      ${this.escapeHtml(room.nombre.split(' - ')[1] || room.descripcion || '')}
                    </div>
                  </div>
                </div>

                <div style="flex-shrink: 0;">
                  <span class="soft-badge ${isMintBox ? 'soft-badge-mint' : 'soft-badge-lavender'}">
                    ${roomAppointments.length} ${roomAppointments.length === 1 ? 'cita' : 'citas'}
                  </span>
                </div>
              </div>

              <div style="min-height: 360px; display: flex; flex-direction: column; gap: 0.9rem;" class="room-appointments-col">
                ${roomAppointments.length === 0 ? `
                  <div style="text-align: center; padding: 3.5rem 1.2rem; color: var(--soft-text-muted); background: var(--soft-lavender-surface); border-radius: 20px; border: 1px dashed var(--soft-border-card-inner); display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1;">
                    <div class="soft-icon-box soft-icon-box-sm ${isMintBox ? 'soft-icon-box-mint' : 'soft-icon-box-lavender'}" style="margin-bottom: 0.65rem;">
                      ${Icons.door(20, isMintBox ? 'var(--soft-mint-deep)' : 'var(--soft-purple-primary)')}
                    </div>
                    <div style="font-size: 0.92rem; font-weight: 800; color: var(--soft-text-title);">Consultorio Disponible</div>
                    <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.22rem;">No hay sesiones agendadas para esta fecha.</div>
                    ${['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole) ? `
                      <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-schedule-here" data-room-id="${room.id}" style="margin-top: 0.95rem;">
                        ${Icons.calendarPlus(14, 'var(--soft-purple-primary)')}
                        <span>+ Agendar en Sala ${room.id}</span>
                      </button>
                    ` : ''}
                  </div>
                ` : roomAppointments.map((apt, idx) => {
                  const startTime = this.formatTime(apt.fecha_hora_inicio);
                  const endTime = this.formatTime(apt.fecha_hora_fin);

                  const nextApt = roomAppointments[idx + 1];
                  let bufferInfo = '';
                  if (nextApt) {
                    const thisEnd = new Date(apt.fecha_hora_fin.replace('T', ' ')).getTime();
                    const nextStart = new Date(nextApt.fecha_hora_inicio.replace('T', ' ')).getTime();
                    const diffMin = Math.round((nextStart - thisEnd) / 60000);
                    if (diffMin >= 10) {
                      bufferInfo = `
                        <div style="font-size: 0.72rem; color: var(--soft-emerald-dark); background: var(--soft-emerald-bg); padding: 0.3rem 0.65rem; border-radius: 10px; margin-top: 0.55rem; display: flex; align-items: center; gap: 0.35rem;">
                          ${Icons.checkCircle(12, 'var(--soft-emerald-dark)')}
                          <span>Margen de higiene y ventilación: <strong>${diffMin} min</strong> (RN-02 OK)</span>
                        </div>
                      `;
                    }
                  }

                  return `
                    <div class="appointment-card soft-subcard" data-id="${apt.id}" style="padding: 1rem 1.1rem; cursor: pointer; position: relative;">
                      
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.45rem; margin-bottom: 0.55rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.35rem; font-weight: 800; color: var(--soft-text-title); font-size: 0.92rem;">
                          <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.clock(15)}</span>
                          <span>${startTime} - ${endTime}</span>
                          <span style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 600;">(${apt.duracion_minutos} min)</span>
                        </div>
                        <div>${this.getStatusBadge(apt.estado)}</div>
                      </div>

                      <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.96rem; margin-bottom: 0.28rem; display: flex; align-items: center; justify-content: space-between; gap: 0.4rem;">
                        <span>${this.escapeHtml(apt.paciente_nombre_completo)}</span>
                        <span class="soft-specialty-tag" style="margin-left: 0; font-size: 0.68rem;">
                          ${this.escapeHtml(apt.paciente_codigo || '')}
                        </span>
                      </div>

                      <div style="font-size: 0.82rem; color: var(--soft-text-body); margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
                        <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.therapist(14)}</span>
                        <span>Lic. ${this.escapeHtml(apt.terapeuta_nombre_completo)}</span>
                      </div>

                      ${apt.servicio_nombre ? `
                        <div style="font-size: 0.76rem; color: var(--soft-mint-deep); font-weight: 700; margin-bottom: 0.35rem;">
                          ${this.escapeHtml(apt.servicio_nombre)} ${apt.servicio_arancel ? `(Bs. ${apt.servicio_arancel})` : ''}
                        </div>
                      ` : ''}

                      <div style="display: flex; gap: 0.45rem; margin-top: 0.65rem; padding-top: 0.6rem; border-top: 1px solid var(--soft-divider); justify-content: flex-end; align-items: center; flex-wrap: wrap;">
                        ${(apt.estado === 'PROGRAMADA' || apt.estado === 'CONFIRMADA') && ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole) ? `
                          <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-quick-attend" data-id="${apt.id}" title="Registrar llegada del paciente a sala">
                            ${Icons.pulse(12, '#FFFFFF')}
                            <span>Llegó (En Sala)</span>
                          </button>
                        ` : ''}

                        ${apt.estado === 'EN_ATENCION' && ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole) ? `
                          <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-quick-complete" data-id="${apt.id}" title="Marcar sesión como atendida y completada">
                            ${Icons.check(12, '#FFFFFF')}
                            <span>Completar</span>
                          </button>
                        ` : ''}

                        ${apt.estado === 'ATENDIDA' && ['ADMIN', 'TERAPEUTA'].includes(this.userRole) ? `
                          <a href="#/clinical-records?patientId=${apt.paciente_id}&patient=${apt.paciente_id}&action=soap" 
                            class="soft-btn soft-btn-sm soft-btn-lvl-1" title="Redactar Nota SOAP para este paciente">
                            ${Icons.fileText(12, '#FFFFFF')}
                            <span>Nota SOAP</span>
                          </a>
                        ` : ''}

                        <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-open-detail" data-id="${apt.id}">
                          ${Icons.eye(13, 'var(--soft-purple-primary)')}
                          <span>Detalles</span>
                        </button>
                      </div>

                      ${bufferInfo}
                    </div>
                  `;
                }).join('')}
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;

    this.attachCardActions(container);
  }

  /**
   * VISTA DETALLADA POR DÍA (NIVEL 1)
   */
  renderDayView(container) {
    if (this.appointments.length === 0) {
      container.innerHTML = this.getEmptyStateHTML('No hay citas agendadas para este día.');
      return;
    }

    container.innerHTML = `
      <div class="soft-section-card">
        <div class="soft-section-header" style="margin-bottom: 1.25rem;">
          <div>
            <h3 class="soft-section-title">
              Cronograma Diario: ${this.formatDateHeader(this.selectedDate)}
            </h3>
            <p class="soft-section-subtitle">Sesiones programadas ordenadas cronológicamente para la jornada seleccionada.</p>
          </div>
          <span class="soft-badge soft-badge-lavender">${this.appointments.length} sesión(es)</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.95rem;">
          ${this.appointments.map(apt => `
            <div class="appointment-card soft-subcard" data-id="${apt.id}" 
              style="padding: 1.1rem 1.25rem; flex-direction: row; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; cursor: pointer;">
              
              <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                <div style="background: linear-gradient(145deg, var(--soft-lavender-bg) 0%, var(--soft-lavender-bg-deep) 100%); color: var(--soft-purple-primary); padding: 0.65rem 0.95rem; border-radius: 14px; border: 1px solid rgba(139, 114, 214, 0.16); text-align: center; min-width: 78px;">
                  <div style="font-weight: 800; font-size: 1rem;">${this.formatTime(apt.fecha_hora_inicio)}</div>
                  <div style="font-size: 0.72rem; color: var(--soft-text-body); font-weight: 600;">${this.formatTime(apt.fecha_hora_fin)}</div>
                </div>

                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <span style="font-weight: 800; color: var(--soft-text-title); font-size: 1.04rem;">
                      ${this.escapeHtml(apt.paciente_nombre_completo)}
                    </span>
                    <span class="soft-specialty-tag" style="margin-left: 0;">${this.escapeHtml(apt.paciente_codigo || '')}</span>
                    ${this.getStatusBadge(apt.estado)}
                  </div>

                  <div style="font-size: 0.84rem; color: var(--soft-text-body); margin-top: 0.3rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                    <span><strong style="color: var(--soft-text-title);">Terapeuta:</strong> Lic. ${this.escapeHtml(apt.terapeuta_nombre_completo)}</span>
                    <span><strong style="color: var(--soft-text-title);">Ambiente:</strong> ${this.escapeHtml(apt.ambiente_nombre)}</span>
                    ${apt.servicio_nombre ? `<span><strong style="color: var(--soft-text-title);">Servicio:</strong> ${this.escapeHtml(apt.servicio_nombre)}</span>` : ''}
                  </div>
                </div>
              </div>

              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                ${(apt.estado === 'PROGRAMADA' || apt.estado === 'CONFIRMADA') && ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole) ? `
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-quick-attend" data-id="${apt.id}">
                    ${Icons.pulse(13, '#FFFFFF')}
                    <span>Llegó (En Sala)</span>
                  </button>
                ` : ''}

                ${apt.estado === 'EN_ATENCION' && ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole) ? `
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-quick-complete" data-id="${apt.id}">
                    ${Icons.check(13, '#FFFFFF')}
                    <span>Completar</span>
                  </button>
                ` : ''}

                ${apt.estado === 'ATENDIDA' && ['ADMIN', 'TERAPEUTA'].includes(this.userRole) ? `
                  <a href="#/clinical-records?patientId=${apt.paciente_id}&patient=${apt.paciente_id}&action=soap" 
                    class="soft-btn soft-btn-sm soft-btn-lvl-1">
                    ${Icons.fileText(13, '#FFFFFF')}
                    <span>Nota SOAP</span>
                  </a>
                ` : ''}

                <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-open-detail" data-id="${apt.id}">
                  ${Icons.eye(14, 'var(--soft-purple-primary)')}
                  <span>Ver Detalle</span>
                </button>
              </div>

            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.attachCardActions(container);
  }

  /**
   * VISTA LISTADO / TABLA CLÍNICA (NIVEL 1)
   */
  renderListView(container) {
    if (this.appointments.length === 0) {
      container.innerHTML = this.getEmptyStateHTML('No se encontraron citas con los filtros aplicados.');
      return;
    }

    container.innerHTML = `
      <div class="soft-section-card" style="padding: 1.4rem;">
        <div class="soft-table-wrap">
          <table class="soft-table">
            <thead>
              <tr>
                <th>Fecha &amp; Hora</th>
                <th>Paciente / Código</th>
                <th>Especialista</th>
                <th>Consultorio</th>
                <th>Servicio / Arancel</th>
                <th>Estado</th>
                <th style="text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${this.appointments.map(apt => `
                <tr>
                  <td style="white-space: nowrap;">
                    <div style="font-weight: 800; color: var(--soft-text-title);">${apt.fecha_hora_inicio.slice(0, 10)}</div>
                    <div style="font-size: 0.78rem; color: var(--soft-purple-primary); font-weight: 700;">
                      ${this.formatTime(apt.fecha_hora_inicio)} - ${this.formatTime(apt.fecha_hora_fin)} (${apt.duracion_minutos}m)
                    </div>
                  </td>
                  <td>
                    <div style="font-weight: 700; color: var(--soft-text-title);">${this.escapeHtml(apt.paciente_nombre_completo)}</div>
                    <div style="font-size: 0.75rem; color: var(--soft-text-muted);">${this.escapeHtml(apt.paciente_codigo || '')} · CI: ${this.escapeHtml(apt.paciente_ci || 'S/E')}</div>
                  </td>
                  <td>
                    <div style="color: var(--soft-text-title); font-weight: 600;">Lic. ${this.escapeHtml(apt.terapeuta_nombre_completo)}</div>
                    <div style="font-size: 0.75rem; color: var(--soft-text-body);">${this.escapeHtml(apt.especialidad_nombre || '')}</div>
                  </td>
                  <td>
                    <span class="soft-badge soft-badge-lavender">
                      ${this.escapeHtml(apt.ambiente_codigo || apt.ambiente_nombre)}
                    </span>
                  </td>
                  <td>
                    <div style="color: var(--soft-text-title); font-weight: 600;">${this.escapeHtml(apt.servicio_nombre || 'Sesión Estándar')}</div>
                    <div style="font-size: 0.75rem; color: var(--soft-emerald-dark); font-weight: 700;">
                      ${apt.servicio_arancel ? `Bs. ${apt.servicio_arancel}` : 'Arancel regular'}
                    </div>
                  </td>
                  <td>
                    ${this.getStatusBadge(apt.estado)}
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <div style="display: inline-flex; gap: 0.45rem; align-items: center;">
                      ${apt.estado === 'ATENDIDA' && ['ADMIN', 'TERAPEUTA'].includes(this.userRole) ? `
                        <a href="#/clinical-records?patientId=${apt.paciente_id}&patient=${apt.paciente_id}&action=soap" 
                          class="soft-btn soft-btn-sm soft-btn-lvl-1">
                          ${Icons.fileText(12, '#FFFFFF')}
                          <span>SOAP</span>
                        </a>
                      ` : ''}
                      <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-open-detail" data-id="${apt.id}" title="Ver detalles de la sesión">
                        ${Icons.eye(14, 'var(--soft-purple-primary)')}
                        <span>Ver</span>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.attachCardActions(container);
  }

  getEmptyStateHTML(message = 'No se encontraron citas agendadas.') {
    return `
      <div class="soft-card-static" style="text-align: center; padding: 4rem 1.5rem;">
        <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1rem auto;">
          ${Icons.calendar(28, 'var(--soft-purple-primary)')}
        </div>
        <h3 style="color: var(--soft-text-title); font-weight: 800; margin: 0 0 0.5rem 0; font-size: 1.22rem;">${message}</h3>
        <p style="color: var(--soft-text-body); max-width: 480px; margin: 0 auto 1.5rem; font-size: 0.9rem; line-height: 1.5;">
          Puede cambiar la fecha seleccionada, restablecer los filtros o programar una nueva sesión en los consultorios.
        </p>
        ${['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole) ? `
          <button id="btn-empty-schedule" type="button" class="soft-btn soft-btn-lvl-1">
            ${Icons.calendarPlus(16, '#FFFFFF')}
            <span>+ Programar Nueva Cita</span>
          </button>
        ` : ''}
      </div>
    `;
  }

  attachEvents() {
    const datePicker = document.getElementById('calendar-date-picker');
    const titleDate = document.getElementById('calendar-date-title');

    datePicker?.addEventListener('change', (e) => {
      this.selectedDate = e.target.value;
      this.selectedMonthDay = this.selectedDate;
      if (titleDate) {
        titleDate.textContent = this.viewMode === 'MONTH'
          ? this.formatMonthHeader(this.selectedDate)
          : this.formatDateHeader(this.selectedDate);
      }
      this.refreshAppointments();
    });

    document.getElementById('btn-date-prev')?.addEventListener('click', () => {
      if (this.viewMode === 'MONTH') {
        const [y, m] = this.selectedDate.slice(0, 7).split('-').map(Number);
        let prevM = m - 1;
        let prevY = y;
        if (prevM < 1) { prevM = 12; prevY--; }
        const pad = (n) => String(n).padStart(2, '0');
        this.selectedDate = `${prevY}-${pad(prevM)}-01`;
        this.selectedMonthDay = this.selectedDate;
      } else {
        const d = new Date(this.selectedDate + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        this.selectedDate = this.getLocalDateString(d);
      }
      if (datePicker) datePicker.value = this.selectedDate;
      if (titleDate) {
        titleDate.textContent = this.viewMode === 'MONTH'
          ? this.formatMonthHeader(this.selectedDate)
          : this.formatDateHeader(this.selectedDate);
      }
      this.refreshAppointments();
    });

    document.getElementById('btn-date-next')?.addEventListener('click', () => {
      if (this.viewMode === 'MONTH') {
        const [y, m] = this.selectedDate.slice(0, 7).split('-').map(Number);
        let nextM = m + 1;
        let nextY = y;
        if (nextM > 12) { nextM = 1; nextY++; }
        const pad = (n) => String(n).padStart(2, '0');
        this.selectedDate = `${nextY}-${pad(nextM)}-01`;
        this.selectedMonthDay = this.selectedDate;
      } else {
        const d = new Date(this.selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        this.selectedDate = this.getLocalDateString(d);
      }
      if (datePicker) datePicker.value = this.selectedDate;
      if (titleDate) {
        titleDate.textContent = this.viewMode === 'MONTH'
          ? this.formatMonthHeader(this.selectedDate)
          : this.formatDateHeader(this.selectedDate);
      }
      this.refreshAppointments();
    });

    document.getElementById('btn-date-today')?.addEventListener('click', () => {
      this.selectedDate = this.getLocalDateString();
      this.selectedMonthDay = this.selectedDate;
      if (datePicker) datePicker.value = this.selectedDate;
      if (titleDate) {
        titleDate.textContent = this.viewMode === 'MONTH'
          ? this.formatMonthHeader(this.selectedDate)
          : this.formatDateHeader(this.selectedDate);
      }
      this.refreshAppointments();
    });

    // Modos de vista
    document.getElementById('btn-view-month')?.addEventListener('click', () => {
      this.viewMode = 'MONTH';
      this.render();
    });
    document.getElementById('btn-view-five-days')?.addEventListener('click', () => {
      this.viewMode = 'FIVE_DAYS';
      this.render();
    });
    document.getElementById('btn-view-rooms')?.addEventListener('click', () => {
      this.viewMode = 'ROOMS';
      this.render();
    });
    document.getElementById('btn-view-day')?.addEventListener('click', () => {
      this.viewMode = 'DAY';
      this.render();
    });
    document.getElementById('btn-view-list')?.addEventListener('click', () => {
      this.viewMode = 'LIST';
      this.render();
    });

    // Filtros
    document.getElementById('select-filter-terapeuta')?.addEventListener('change', (e) => {
      this.filterTherapist = e.target.value;
      this.refreshAppointments();
    });

    document.getElementById('select-filter-ambiente')?.addEventListener('change', (e) => {
      this.filterRoomId = e.target.value;
      this.refreshAppointments();
    });

    document.getElementById('select-filter-hijo')?.addEventListener('change', (e) => {
      this.filterPatientId = e.target.value;
      this.refreshAppointments();
    });

    document.getElementById('select-filter-estado')?.addEventListener('change', (e) => {
      this.filterStatus = e.target.value;
      this.refreshAppointments();
    });

    // Buscador con debounce
    const searchInput = document.getElementById('agenda-search');
    let searchDebounce = null;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          this.searchTerm = e.target.value.trim();
          this.refreshAppointments();
        }, 300);
      });
    }

    // Refrescar citas manual
    document.getElementById('btn-refresh-agenda')?.addEventListener('click', async () => {
      await this.refreshAppointments();
      Toast.info('Agenda sincronizada.');
    });

    // Botón Disponibilidad de Salas (Agenda Pública sin datos)
    document.getElementById('btn-public-schedule')?.addEventListener('click', () => {
      this.openPublicScheduleModal();
    });

    // Botón Nueva Cita
    document.getElementById('btn-open-new-appointment')?.addEventListener('click', () => {
      this.openScheduleModal();
    });

    document.getElementById('btn-empty-schedule')?.addEventListener('click', () => {
      this.openScheduleModal();
    });
  }

  attachCardActions(container) {
    container.querySelectorAll('.appointment-card, .btn-open-detail').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.btn-quick-attend') || e.target.closest('.btn-quick-complete') || e.target.closest('a')) {
          return;
        }
        const id = el.dataset.id || el.closest('.appointment-card')?.dataset.id;
        if (id) this.openDetailModal(id);
      });
    });

    container.querySelectorAll('.btn-quick-attend').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (!id) return;
        try {
          btn.disabled = true;
          await apiClient.patch(`/appointments/${id}/status`, { estado: 'EN_ATENCION' });
          Toast.success('Llegada registrada. El paciente se encuentra en sala de atención.');
          await this.refreshAppointments();
        } catch (err) {
          btn.disabled = false;
          Toast.error(err.message || 'No se pudo actualizar el estado de la cita.');
        }
      });
    });

    container.querySelectorAll('.btn-quick-complete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (!id) return;
        try {
          btn.disabled = true;
          await apiClient.patch(`/appointments/${id}/status`, { estado: 'ATENDIDA' });
          Toast.success('Sesión completada y registrada en auditoría.');
          await this.refreshAppointments();
        } catch (err) {
          btn.disabled = false;
          Toast.error(err.message || 'No se pudo completar la sesión.');
        }
      });
    });

    container.querySelectorAll('.btn-schedule-here').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = btn.dataset.roomId;
        this.openScheduleModal({ ambiente_id: roomId });
      });
    });
  }

  // =========================================================================
  // MODAL: DISPONIBILIDAD DE CONSULTORIOS & AGENDA INSTITUCIONAL PÚBLICA
  // Muestra franjas ocupadas de los consultorios con CERO datos de pacientes
  // =========================================================================
  async openPublicScheduleModal() {
    const modalContainer = document.getElementById('modal-container-agenda');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div id="modal-public-schedule" class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.45); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1050; padding: 1rem;">
        
        <div class="soft-modal-card" style="max-width: 960px; max-height: 92vh;">
          
          <!-- Encabezado con Secreto Profesional -->
          <div style="background: var(--soft-lavender-surface); padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                ${Icons.rooms(20, 'var(--soft-mint-deep)')}
              </div>
              <div>
                <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.015em;">Disponibilidad de Consultorios &amp; Agenda Institucional</h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Cronograma de ocupación física de salas sin exposición de pacientes (Secreto Profesional y Ley 3131).
                </div>
              </div>
            </div>

            <button id="btn-close-public-modal" type="button" class="soft-modal-close-btn" aria-label="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- Barra de navegación del mes -->
          <div style="padding: 0.85rem 1.5rem; background: #FFFFFF; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem;">
            <div style="display: flex; align-items: center; gap: 0.55rem;">
              <button id="btn-public-month-prev" type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">← Mes Anterior</button>
              <span id="public-month-title" style="font-weight: 800; color: var(--soft-text-title); font-size: 1rem; padding: 0 0.35rem;">Cargando...</span>
              <button id="btn-public-month-next" type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">Mes Siguiente →</button>
            </div>

            <!-- Leyenda dinámica de salas físicas -->
            <div style="display: flex; gap: 0.85rem; font-size: 0.76rem; color: var(--soft-text-body); font-weight: 600; align-items: center; flex-wrap: wrap;">
              ${(this.rooms || []).map(r => `
                <span style="display: inline-flex; align-items: center; gap: 0.35rem;">
                  <span style="width: 9px; height: 9px; border-radius: 50%; background: ${r.color_identificador || 'var(--soft-purple-primary)'}; display: inline-block;"></span>
                  <span>${r.nombre || r.codigo}</span>
                </span>
              `).join('')}
            </div>
          </div>

          <!-- Cuerpo: Vista Dividida (Calendario a la izquierda, Detalle a la derecha) -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); align-items: start; align-content: start; flex: 1 1 auto; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch;" id="public-schedule-body">
            
            <div style="padding: 1.35rem; border-right: 1px solid var(--soft-divider);" id="public-calendar-grid-container">
              <div style="text-align: center; padding: 3rem; color: var(--soft-text-muted);">
                <div style="width: 9px; height: 9px; border-radius: 50%; background: var(--soft-emerald); display: inline-block; margin-bottom: 0.5rem;"></div>
                <div>Cargando ocupación mensual...</div>
              </div>
            </div>

            <div style="padding: 1.35rem; background: var(--soft-lavender-surface);" id="public-day-timeline-container">
              <div style="font-weight: 700; color: var(--soft-text-title); font-size: 0.95rem; margin-bottom: 0.75rem;">
                Seleccione un día del calendario para ver la línea de tiempo.
              </div>
            </div>

          </div>

        </div>
      </div>
    `;

    document.getElementById('btn-close-public-modal')?.addEventListener('click', () => {
      document.getElementById('modal-public-schedule')?.remove();
    });

    await this.loadPublicScheduleData(this.publicScheduleMonth);
  }

  async loadPublicScheduleData(monthStr) {
    this.publicScheduleMonth = monthStr;
    const monthTitle = document.getElementById('public-month-title');
    const [year, month] = monthStr.split('-').map(Number);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    if (monthTitle) monthTitle.textContent = `${months[month - 1]} de ${year}`;

    try {
      const res = await apiClient.get(`/appointments/public-schedule?mes=${monthStr}`);
      this.publicScheduleData = res.data || [];
      this.renderPublicCalendarGrid();
      this.renderPublicDayTimeline(this.publicSelectedDay || `${monthStr}-01`);
    } catch (err) {
      console.error('Error al cargar agenda pública:', err);
      Toast.error('No se pudo cargar la ocupación mensual.');
    }

    document.getElementById('btn-public-month-prev')?.addEventListener('click', () => {
      let prevM = month - 1;
      let prevY = year;
      if (prevM < 1) { prevM = 12; prevY--; }
      const newMonth = `${prevY}-${String(prevM).padStart(2, '0')}`;
      this.loadPublicScheduleData(newMonth);
    });

    document.getElementById('btn-public-month-next')?.addEventListener('click', () => {
      let nextM = month + 1;
      let nextY = year;
      if (nextM > 12) { nextM = 1; nextY++; }
      const newMonth = `${nextY}-${String(nextM).padStart(2, '0')}`;
      this.loadPublicScheduleData(newMonth);
    });
  }

  renderPublicCalendarGrid() {
    const container = document.getElementById('public-calendar-grid-container');
    if (!container) return;

    const [year, month] = this.publicScheduleMonth.split('-').map(Number);
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const pad = (n) => String(n).padStart(2, '0');

    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    let cellsHtml = '';
    const dayHeaders = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    for (let i = 0; i < startOffset; i++) {
      cellsHtml += `<div style="background: var(--soft-lavender-surface); min-height: 54px; border-radius: 12px; opacity: 0.45;"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${pad(month)}-${pad(day)}`;
      const daySlots = this.publicScheduleData.filter(a => a.fecha_hora_inicio && a.fecha_hora_inicio.slice(0, 10) === dateStr);
      const isSelected = (dateStr === this.publicSelectedDay);
      const isToday = (dateStr === this.getLocalDateString());

      const sala1Count = daySlots.filter(s => s.ambiente_id === 1).length;
      const sala2Count = daySlots.filter(s => s.ambiente_id === 2).length;
      const sala3Count = daySlots.filter(s => s.ambiente_id === 3).length;

      cellsHtml += `
        <div class="public-cal-day-cell" data-date="${dateStr}" 
          style="border: 1px solid ${isSelected ? 'rgba(124, 98, 196, 0.65)' : (isToday ? 'rgba(26, 166, 156, 0.5)' : 'var(--soft-border-card-inner)')}; 
                 background: ${isSelected ? 'var(--soft-lavender-bg)' : (isToday ? '#F1FBF9' : '#FFFFFF')}; 
                 box-shadow: ${isSelected ? '0 0 0 1px rgba(139, 114, 214, 0.25)' : 'none'};
                 padding: 0.4rem 0.45rem; border-radius: 12px; cursor: pointer; min-height: 58px; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.18s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 800; font-size: 0.8rem; color: ${isToday ? 'var(--soft-mint-deep)' : 'var(--soft-text-title)'};">
              ${day} ${isToday ? '·' : ''}
            </span>
            ${daySlots.length > 0 ? `
              <span class="soft-badge soft-badge-lavender" style="font-size: 0.64rem; padding: 0.12rem 0.42rem;">
                ${daySlots.length}
              </span>
            ` : ''}
          </div>

          <div style="display: flex; gap: 3px; margin-top: 4px;">
            ${sala1Count > 0 ? `<span title="Sala 1 ocupada (${sala1Count})" style="width: 6px; height: 6px; border-radius: 50%; background: var(--soft-indigo-accent); display: inline-block;"></span>` : ''}
            ${sala2Count > 0 ? `<span title="Sala 2 ocupada (${sala2Count})" style="width: 6px; height: 6px; border-radius: 50%; background: var(--soft-purple-primary); display: inline-block;"></span>` : ''}
            ${sala3Count > 0 ? `<span title="Sala 3 ocupada (${sala3Count})" style="width: 6px; height: 6px; border-radius: 50%; background: #D97706; display: inline-block;"></span>` : ''}
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.4rem; text-align: center; margin-bottom: 0.55rem;">
        ${dayHeaders.map(h => `<div style="font-size: 0.7rem; font-weight: 700; color: var(--soft-text-overline); text-transform: uppercase; letter-spacing: 0.04em;">${h}</div>`).join('')}
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.4rem;" id="public-cal-cells">
        ${cellsHtml}
      </div>
    `;

    container.querySelectorAll('.public-cal-day-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const date = cell.dataset.date;
        this.publicSelectedDay = date;
        this.renderPublicCalendarGrid();
        this.renderPublicDayTimeline(date);
        if (window.innerWidth <= 768) {
          setTimeout(() => {
            document.getElementById('public-day-timeline-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 60);
        }
      });
    });
  }

  renderPublicDayTimeline(dateStr) {
    const container = document.getElementById('public-day-timeline-container');
    if (!container) return;

    const daySlots = this.publicScheduleData
      .filter(a => a.fecha_hora_inicio && a.fecha_hora_inicio.slice(0, 10) === dateStr)
      .sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));

    const header = this.formatDateHeader(dateStr);

    container.innerHTML = `
      <div style="margin-bottom: 1rem; padding-bottom: 0.85rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.55rem;">
        <div>
          <div style="font-weight: 800; color: var(--soft-text-title); font-size: 1rem;">
            ${header}
          </div>
          <div style="font-size: 0.76rem; color: var(--soft-text-body);">
            ${daySlots.length === 0 ? 'Sin sesiones programadas este día' : `${daySlots.length} sesión(es) registrada(s)`}
          </div>
        </div>

        ${['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole) ? `
          <button id="btn-public-book-now" type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2">
            ${Icons.calendarPlus(14, '#FFFFFF')}
            <span>+ Agendar en esta fecha</span>
          </button>
        ` : ''}
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${daySlots.length === 0 ? `
          <div style="text-align: center; padding: 2.5rem 1rem; color: var(--soft-text-muted); background: #FFFFFF; border-radius: 18px; border: 1px dashed var(--soft-border-card-inner);">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint" style="margin: 0 auto 0.6rem auto;">
              ${Icons.checkCircle(20, 'var(--soft-mint-deep)')}
            </div>
            <div style="font-weight: 800; font-size: 0.9rem; color: var(--soft-text-title);">Consultorios 100% Disponibles</div>
            <div style="font-size: 0.78rem; margin-top: 0.22rem;">
              No hay sesiones programadas en las salas físicas para esta fecha.
            </div>
          </div>
        ` : daySlots.map(slot => {
          const startTime = this.formatTime(slot.fecha_hora_inicio);
          const endTime = this.formatTime(slot.fecha_hora_fin);

          return `
            <div class="soft-subcard" style="padding: 0.85rem 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; gap: 0.4rem;">
                <div style="font-weight: 800; font-size: 0.9rem; color: var(--soft-text-title); display: flex; align-items: center; gap: 0.35rem;">
                  <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.clock(14)}</span>
                  <span>${startTime} a ${endTime}</span>
                  <span style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 600;">(${slot.duracion_minutos}m)</span>
                </div>
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.68rem;">
                  ${this.escapeHtml(slot.ambiente_codigo || 'Sala')}
                </span>
              </div>

              <div style="font-size: 0.84rem; font-weight: 700; color: var(--soft-text-title);">
                ${this.escapeHtml(slot.ambiente_nombre?.split(' - ')[0] || 'Consultorio')}
              </div>

              <div style="font-size: 0.76rem; color: var(--soft-text-body); margin-top: 0.2rem; display: flex; align-items: center; gap: 0.35rem;">
                <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.therapist(13)}</span>
                <span>Lic. ${this.escapeHtml(slot.terapeuta_nombre_completo)} (${this.escapeHtml(slot.terapeuta_especialidad || 'Especialista')})</span>
              </div>

              <div style="font-size: 0.7rem; color: var(--soft-emerald-dark); font-weight: 600; margin-top: 0.4rem; display: flex; align-items: center; gap: 0.28rem;">
                ${Icons.checkCircle(11, 'var(--soft-emerald-dark)')}
                <span>Margen de higiene requerido: +10 min (Sala libre a las ${this.calculateBufferTime(slot.fecha_hora_fin, 10)})</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    document.getElementById('btn-public-book-now')?.addEventListener('click', () => {
      document.getElementById('modal-public-schedule')?.remove();
      this.openScheduleModal({ fecha: dateStr });
    });
  }

  calculateBufferTime(isoFin, bufferMin = 10) {
    if (!isoFin) return '--:--';
    const end = new Date(isoFin.replace('T', ' ')).getTime();
    if (isNaN(end)) return '--:--';
    const buf = new Date(end + bufferMin * 60000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(buf.getHours())}:${pad(buf.getMinutes())}`;
  }

  // =========================================================================
  // MODAL 1: AGENDAR NUEVA CITA CON VALIDACIÓN ANTI-COLISIÓN EN VIVO (RN-01) — NIVEL 2
  // =========================================================================
  openScheduleModal(initialData = {}) {
    const modalContainer = document.getElementById('modal-container-agenda');
    if (!modalContainer) return;

    const defaultDate = initialData.fecha || this.selectedDate;
    const defaultTime = initialData.hora || '09:00';
    const defaultRoom = initialData.ambiente_id || '1';
    const defaultDuration = initialData.duracion || 45;

    const isTherapistRole = this.userRole === 'TERAPEUTA';
    const loggedTherapist = isTherapistRole
      ? (this.therapists.find(t => t.usuario_id === this.user?.id || t.email === this.user?.email) || this.therapists[0])
      : null;
    const defaultTherapist = loggedTherapist ? loggedTherapist.id : (initialData.terapeuta_id || (this.therapists[0]?.id || '1'));

    modalContainer.innerHTML = `
      <div id="modal-schedule-appointment" class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.45); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1050; padding: 1rem;">
        
        <div class="soft-modal-card" style="max-width: 680px; max-height: 90vh;">
          
          <div style="background: var(--soft-lavender-surface); padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.calendarPlus(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.015em;">Agendar Cita Médica</h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.1rem;">Control algorítmico anti-colisión multi-sala y multi-especialista</div>
              </div>
            </div>

            <button id="btn-close-schedule-modal" type="button" class="soft-modal-close-btn" aria-label="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <form id="form-schedule-appointment" style="padding: 1.45rem 1.5rem; overflow-y: auto;">
            
            <div class="form-group" style="margin-bottom: 1.1rem;">
              <label class="soft-label">
                Paciente / Expediente Clínico <span class="required">*</span>
              </label>
              <select id="modal-apt-paciente" class="soft-select" required>
                <option value="">-- Seleccione un paciente del centro --</option>
                ${this.patients.map(p => `
                  <option value="${p.id}" ${initialData.paciente_id == p.id ? 'selected' : ''}>
                    ${this.escapeHtml(p.nombres)} ${this.escapeHtml(p.apellidos)} (${this.escapeHtml(p.codigo_expediente)}) · CI: ${this.escapeHtml(p.ci || 'S/E')}
                  </option>
                `).join('')}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1rem; margin-bottom: 1.1rem;">
              <div class="form-group">
                <label class="soft-label">
                  Consultorio Físico <span class="required">*</span>
                </label>
                <select id="modal-apt-ambiente" class="soft-select" required>
                  ${this.rooms.map(r => `
                    <option value="${r.id}" ${defaultRoom == r.id ? 'selected' : ''}>
                      ${this.escapeHtml(r.nombre.split(' - ')[0])} (${this.escapeHtml(r.tipo)})
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="form-group">
                <label class="soft-label">
                  Especialista / Terapeuta <span class="required">*</span>
                </label>
                ${isTherapistRole && loggedTherapist ? `
                  <select id="modal-apt-terapeuta" class="soft-select" disabled>
                    <option value="${loggedTherapist.id}" selected>
                      Lic. ${this.escapeHtml(loggedTherapist.nombres)} ${this.escapeHtml(loggedTherapist.apellidos)} (${this.escapeHtml(loggedTherapist.especialidad_nombre || 'Especialista')})
                    </option>
                  </select>
                  <input type="hidden" id="modal-apt-terapeuta-locked" value="${loggedTherapist.id}" />
                  <div style="font-size: 0.74rem; color: var(--soft-mint-deep); font-weight: 700; margin-top: 0.35rem; display: flex; align-items: center; gap: 0.3rem;">
                    ${Icons.checkCircle(12, 'var(--soft-mint-deep)')}
                    <span>Asignado a su perfil profesional (Lic. ${this.escapeHtml(loggedTherapist.apellidos)})</span>
                  </div>
                ` : `
                  <select id="modal-apt-terapeuta" class="soft-select" required>
                    ${this.therapists.map(t => `
                      <option value="${t.id}" ${defaultTherapist == t.id ? 'selected' : ''}>
                        Lic. ${this.escapeHtml(t.nombres)} ${this.escapeHtml(t.apellidos)} (${this.escapeHtml(t.especialidad_nombre || '')})
                      </option>
                    `).join('')}
                  </select>
                `}
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.1rem;">
              <label class="soft-label">
                Tipo de Sesión Terapéutica / Servicio Clínico
              </label>
              <select id="modal-apt-servicio" class="soft-select">
                <option value="">-- Sesión Estándar / Por determinar --</option>
                ${this.services.map(s => `
                  <option value="${s.id}" data-duration="${s.duracion_minutos}" data-price="${s.arancel_bob}">
                    ${this.escapeHtml(s.nombre)} (${s.duracion_minutos} min - Bs. ${s.arancel_bob})
                  </option>
                `).join('')}
                <option value="MANUAL">+ Otra sesión / Personalizada (Escribir a mano)...</option>
              </select>

              <div id="custom-service-fields" style="display: none; margin-top: 0.75rem; padding: 0.9rem 1rem; background: var(--soft-lavender-surface); border: 1px dashed var(--soft-border-card-inner); border-radius: 16px;">
                <div style="font-size: 0.72rem; color: var(--soft-text-overline); font-weight: 700; margin-bottom: 0.55rem; text-transform: uppercase; letter-spacing: 0.04em;">
                  Datos de la Sesión Personalizada
                </div>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.75rem;">
                  <div>
                    <label class="soft-label" style="font-size: 0.76rem;">
                      Nombre o Descripción del Servicio <span class="required">*</span>
                    </label>
                    <input type="text" id="modal-apt-servicio-custom" class="soft-input" 
                      placeholder="Ej. Terapia Ocupacional, Reevaluación Domiciliaria..." />
                  </div>
                  <div>
                    <label class="soft-label" style="font-size: 0.76rem;">
                      Arancel (Bs.)
                    </label>
                    <input type="number" id="modal-apt-arancel-custom" class="soft-input" 
                      placeholder="Ej. 150" min="0" step="5" />
                  </div>
                </div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 175px), 1fr)); gap: 0.9rem; margin-bottom: 1.1rem;">
              <div class="form-group">
                <label class="soft-label">
                  Fecha de la Cita <span class="required">*</span>
                </label>
                <input type="date" id="modal-apt-fecha" value="${defaultDate}" required class="soft-input" />
              </div>

              <div class="form-group">
                <label class="soft-label">
                  Hora de Inicio <span class="required">*</span>
                </label>
                <input type="time" id="modal-apt-hora" value="${defaultTime}" required class="soft-input" step="900" />
              </div>

              <div class="form-group">
                <label class="soft-label">
                  Duración en Minutos <span class="required">*</span>
                </label>
                
                <div style="display: flex; gap: 0.3rem; margin-bottom: 0.45rem; flex-wrap: wrap;">
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-duration-chip" data-min="30" style="padding: 0.22rem 0.55rem; font-size: 0.72rem; border-radius: 9px;">30m</button>
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-duration-chip" data-min="45" style="padding: 0.22rem 0.55rem; font-size: 0.72rem; border-radius: 9px;">45m</button>
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-duration-chip" data-min="60" style="padding: 0.22rem 0.55rem; font-size: 0.72rem; border-radius: 9px;">60m</button>
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-duration-chip" data-min="90" style="padding: 0.22rem 0.55rem; font-size: 0.72rem; border-radius: 9px;">90m</button>
                  <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-duration-chip" data-min="120" style="padding: 0.22rem 0.55rem; font-size: 0.72rem; border-radius: 9px;">120m</button>
                </div>

                <input type="number" id="modal-apt-duracion" value="${defaultDuration}" min="15" max="240" step="5" required 
                  class="soft-input" placeholder="15 - 240 min" />
                <div style="font-size: 0.72rem; color: var(--soft-text-muted); margin-top: 0.25rem;">
                  Personalizable libremente (15 a 240 min)
                </div>
              </div>
            </div>

            <div id="modal-apt-time-preview" style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.7rem 0.95rem; margin-bottom: 1.1rem; font-size: 0.82rem; color: var(--soft-text-title); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.45rem;">
              <div>
                Finaliza a las: <strong id="preview-hora-fin" style="color: var(--soft-purple-primary);">--:--</strong>
              </div>
              <div style="font-size: 0.76rem; color: var(--soft-emerald-dark); font-weight: 700;">
                Margen higiénico: +10 min (Sala libre a las <span id="preview-hora-buffer">--:--</span>)
              </div>
            </div>

            <div id="collision-alert-container" style="display: none; margin-bottom: 1.1rem;"></div>

            <div class="form-group" style="margin-bottom: 1.4rem;">
              <label class="soft-label">
                Motivo Clínico de Consulta / Observaciones
              </label>
              <textarea id="modal-apt-motivo" rows="2" class="soft-textarea" 
                placeholder="Ej. Evaluación inicial de lectoescritura, seguimiento atencional o revisión de metas..."></textarea>
            </div>

            <!-- SECCIÓN RECORDATORIO INTELIGENTE FAMILIAR (WHATSAPP & PWA) -->
            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.15rem; margin-bottom: 1.4rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
                <div style="font-weight: 800; font-size: 0.92rem; color: var(--soft-text-title); display: flex; align-items: center; gap: 0.5rem;">
                  <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.bell(18)}</span>
                  <span>Recordatorio Inteligente para la Familia</span>
                </div>
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem; font-weight: 700;">
                  WhatsApp & PWA
                </span>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 0.85rem; margin-bottom: 0.85rem;">
                <div>
                  <label class="soft-label" style="font-size: 0.76rem; margin-bottom: 0.35rem;">
                    Anticipación de Envío:
                  </label>
                  <select id="modal-apt-anticipacion" class="soft-select" style="font-size: 0.82rem; padding: 0.55rem 0.85rem;">
                    <option value="30" selected>30 minutos antes (Predeterminado)</option>
                    <option value="60">1 hora antes</option>
                    <option value="120">2 horas antes</option>
                    <option value="1440">24 horas antes (Día anterior)</option>
                  </select>
                </div>

                <div>
                  <label class="soft-label" style="font-size: 0.76rem; margin-bottom: 0.35rem;">
                    Canales Habilitados:
                  </label>
                  <div style="display: flex; gap: 0.9rem; align-items: center; height: 38px;">
                    <label style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; color: var(--soft-text-body); cursor: pointer;">
                      <input type="checkbox" id="modal-apt-canal-wa" checked style="accent-color: var(--soft-purple-primary);" />
                      <span>WhatsApp Móvil</span>
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; color: var(--soft-text-body); cursor: pointer;">
                      <input type="checkbox" id="modal-apt-canal-push" checked style="accent-color: var(--soft-purple-primary);" />
                      <span>Web Push PWA</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                  <label class="soft-label" style="font-size: 0.76rem; margin: 0;">
                    Mensaje Formal Prellenado (Editable para indicaciones):
                  </label>
                  <button type="button" id="btn-reset-reminder-msg" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="padding: 0.15rem 0.5rem; font-size: 0.7rem;">
                    Restablecer plantilla formal
                  </button>
                </div>
                <textarea id="modal-apt-mensaje-recordatorio" rows="3" class="soft-textarea" style="font-size: 0.79rem; line-height: 1.4;"
                  placeholder="Estimado/a tutor/a, le recordamos la sesión clínica de {paciente}..."></textarea>
                <div style="font-size: 0.71rem; color: var(--soft-text-muted); margin-top: 0.3rem;">
                  Variables: <code>{paciente}</code>, <code>{fecha}</code>, <code>{hora}</code>, <code>{consultorio}</code>, <code>{terapeuta}</code>. El tutor responderá <strong>1</strong> para confirmar o <strong>2</strong> para reprogramar.
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1.15rem;">
              <button type="button" id="btn-cancel-schedule" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
              <button type="submit" id="btn-submit-appointment" class="soft-btn soft-btn-lvl-2">
                ${Icons.calendarPlus(16, '#FFFFFF')}
                <span>Confirmar Agendamiento</span>
              </button>
            </div>

          </form>

        </div>
      </div>
    `;

    this.attachScheduleModalEvents();
  }

  attachScheduleModalEvents() {
    const modal = document.getElementById('modal-schedule-appointment');
    const closeBtn = document.getElementById('btn-close-schedule-modal');
    const cancelBtn = document.getElementById('btn-cancel-schedule');
    const form = document.getElementById('form-schedule-appointment');

    const closeModal = () => {
      if (modal) modal.remove();
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    const selectServicio = document.getElementById('modal-apt-servicio');
    const customFields = document.getElementById('custom-service-fields');
    const inputDuracion = document.getElementById('modal-apt-duracion');

    selectServicio?.addEventListener('change', () => {
      if (selectServicio.value === 'MANUAL') {
        if (customFields) customFields.style.display = 'block';
      } else {
        if (customFields) customFields.style.display = 'none';
        const selected = selectServicio.options[selectServicio.selectedIndex];
        const duration = selected.getAttribute('data-duration');
        if (duration && inputDuracion) {
          inputDuracion.value = duration;
        }
      }
      this.evaluateCollisionLive();
    });

    modal?.querySelectorAll('.btn-duration-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const min = chip.dataset.min;
        if (inputDuracion && min) {
          inputDuracion.value = min;
          this.evaluateCollisionLive();
        }
      });
    });

    const reminderMsgInput = document.getElementById('modal-apt-mensaje-recordatorio');
    const updateDynamicReminder = () => {
      if (reminderMsgInput) {
        reminderMsgInput.value = this.generateReminderMessageForForm();
      }
    };

    updateDynamicReminder();

    document.getElementById('modal-apt-paciente')?.addEventListener('change', updateDynamicReminder);
    document.getElementById('modal-apt-terapeuta')?.addEventListener('change', updateDynamicReminder);
    document.getElementById('modal-apt-ambiente')?.addEventListener('change', updateDynamicReminder);
    document.getElementById('modal-apt-fecha')?.addEventListener('change', updateDynamicReminder);
    document.getElementById('modal-apt-hora')?.addEventListener('change', updateDynamicReminder);

    document.getElementById('btn-reset-reminder-msg')?.addEventListener('click', () => {
      updateDynamicReminder();
    });

    ['modal-apt-ambiente', 'modal-apt-terapeuta', 'modal-apt-fecha', 'modal-apt-hora', 'modal-apt-duracion'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => this.evaluateCollisionLive());
      document.getElementById(id)?.addEventListener('input', () => this.evaluateCollisionLive());
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitScheduleForm();
    });

    this.evaluateCollisionLive();
  }

  generateReminderMessageForForm() {
    const pacienteId = document.getElementById('modal-apt-paciente')?.value;
    const lockedTherapist = document.getElementById('modal-apt-terapeuta-locked')?.value;
    const terapeutaId = lockedTherapist || document.getElementById('modal-apt-terapeuta')?.value;
    const ambienteId = document.getElementById('modal-apt-ambiente')?.value;
    const fecha = document.getElementById('modal-apt-fecha')?.value || this.selectedDate;
    const hora = document.getElementById('modal-apt-hora')?.value || '09:00';

    const p = (this.patients || []).find(pt => pt.id == pacienteId);
    const pacienteNombre = p ? `${p.nombres} ${p.apellidos}`.trim() : '{paciente}';
    const tutorNombre = (p?.tutores && p.tutores.length > 0)
      ? `${p.tutores[0].nombres} ${p.tutores[0].apellidos}`.trim()
      : 'Estimado/a tutor/a';
    const primerNombre = p ? (p.nombres.split(' ')[0] || 'HIJO').toUpperCase() : 'HIJO';

    const t = (this.therapists || []).find(th => th.id == terapeutaId);
    const terapeutaNombre = t ? `${t.nombres} ${t.apellidos}`.trim() : (this.user?.nombre_completo || '{terapeuta}');

    const r = (this.rooms || []).find(rm => rm.id == ambienteId);
    const consultorioNombre = r ? (r.nombre?.split(' - ')[0] || r.codigo) : '{consultorio}';

    let formattedDate = fecha;
    try {
      const [y, m, d] = fecha.split('-');
      formattedDate = `${d}/${m}/${y}`;
    } catch (e) {}

    return `Estimado/a ${tutorNombre}, le recordamos la sesión clínica de su hijo/a ${pacienteNombre} con Lic. ${terapeutaNombre} en ${consultorioNombre} el ${formattedDate} a las ${hora}.\n\nPor favor responda a este mensaje con:\n*1 ${primerNombre}* para Confirmar asistencia\n*2 ${primerNombre}* para Solicitar reprogramación\n(O simplemente responda 1 o 2).`;
  }

  evaluateCollisionLive(excludeId = null) {
    const inputFecha = document.getElementById('modal-apt-fecha')?.value;
    const inputHora = document.getElementById('modal-apt-hora')?.value;
    const inputDuracion = parseInt(document.getElementById('modal-apt-duracion')?.value, 10) || 45;
    const ambienteId = document.getElementById('modal-apt-ambiente')?.value;
    
    const lockedTherapist = document.getElementById('modal-apt-terapeuta-locked')?.value;
    const terapeutaId = lockedTherapist || document.getElementById('modal-apt-terapeuta')?.value;

    const previewFin = document.getElementById('preview-hora-fin');
    const previewBuffer = document.getElementById('preview-hora-buffer');
    const alertBox = document.getElementById('collision-alert-container');
    const submitBtn = document.getElementById('btn-submit-appointment');

    if (!inputFecha || !inputHora) return;

    const start = new Date(`${inputFecha}T${inputHora}:00`);
    if (isNaN(start.getTime())) return;

    const end = new Date(start.getTime() + inputDuracion * 60000);
    const buffer = new Date(end.getTime() + 10 * 60000);

    const pad = (n) => String(n).padStart(2, '0');
    const endStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
    const bufferStr = `${pad(buffer.getHours())}:${pad(buffer.getMinutes())}`;

    if (previewFin) previewFin.textContent = endStr;
    if (previewBuffer) previewBuffer.textContent = bufferStr;

    clearTimeout(this.collisionTimer);
    this.collisionTimer = setTimeout(async () => {
      if (!ambienteId || !terapeutaId) return;

      try {
        const fechaHoraInicio = `${inputFecha} ${inputHora}:00`;
        const res = await apiClient.get(
          `/appointments/check-availability?ambiente_id=${ambienteId}&terapeuta_id=${terapeutaId}&fecha_hora_inicio=${encodeURIComponent(fechaHoraInicio)}&duracion_minutos=${inputDuracion}${excludeId ? `&exclude_id=${excludeId}` : ''}`
        );

        const data = res.data || {};
        if (data.available) {
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.innerHTML = `
              <div style="background: var(--soft-emerald-bg); border: 1px solid rgba(16, 185, 129, 0.28); border-radius: 14px; padding: 0.7rem 0.95rem; font-size: 0.82rem; color: var(--soft-emerald-dark); display: flex; align-items: center; gap: 0.55rem;">
                ${Icons.checkCircle(16, 'var(--soft-emerald-dark)')}
                <span><strong>Franja y consultorio disponibles:</strong> Cero colisiones con el terapeuta y margen de 10 min verificado (RN-01).</span>
              </div>
            `;
          }
          if (submitBtn) submitBtn.disabled = false;
        } else {
          const col = data.collision || {};
          if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.innerHTML = `
              <div style="background: #FFF1F2; border: 1px solid rgba(225, 29, 72, 0.26); border-radius: 14px; padding: 0.78rem 0.95rem; font-size: 0.82rem; color: #9F1239; display: flex; align-items: flex-start; gap: 0.55rem;">
                <span style="flex-shrink: 0; margin-top: 1px;">${Icons.alertTriangle(18, '#BE123C')}</span>
                <div>
                  <div style="font-weight: 800; margin-bottom: 0.2rem;">Conflicto de Horario Detectado (${col.collisionType === 'AMBIENTE' ? 'Consultorio Ocupado' : 'Especialista Ocupado'})</div>
                  <div>${this.escapeHtml(col.message || 'La franja horaria seleccionada colisiona con otra cita existente.')}</div>
                </div>
              </div>
            `;
          }
          if (submitBtn) submitBtn.disabled = true;
        }
      } catch (err) {
        console.warn('[AppointmentsView] Error al verificar colisión:', err);
      }
    }, 250);
  }

  async submitScheduleForm() {
    const submitBtn = document.getElementById('btn-submit-appointment');
    if (this.isSubmitting) return;

    try {
      this.isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Agendando cita...</span>`;
      }

      const pacienteId = document.getElementById('modal-apt-paciente')?.value;
      const ambienteId = document.getElementById('modal-apt-ambiente')?.value;

      const lockedTherapist = document.getElementById('modal-apt-terapeuta-locked')?.value;
      const terapeutaId = lockedTherapist || document.getElementById('modal-apt-terapeuta')?.value;

      const servicioSelect = document.getElementById('modal-apt-servicio');
      const fecha = document.getElementById('modal-apt-fecha')?.value;
      const hora = document.getElementById('modal-apt-hora')?.value;
      const duracion = parseInt(document.getElementById('modal-apt-duracion')?.value, 10) || 45;
      const motivo = document.getElementById('modal-apt-motivo')?.value || '';

      if (duracion < 15 || duracion > 240) {
        Toast.warning('La duración de la sesión debe estar comprendida entre 15 y 240 minutos.');
        return;
      }

      let servicioId = null;
      let servicioPersonalizado = null;
      let arancelPersonalizado = null;

      if (servicioSelect?.value === 'MANUAL') {
        const customName = document.getElementById('modal-apt-servicio-custom')?.value?.trim();
        if (!customName) {
          Toast.warning('Por favor, especifique el nombre o tipo del servicio personalizado.');
          return;
        }
        servicioPersonalizado = customName;
        const customPrice = document.getElementById('modal-apt-arancel-custom')?.value;
        arancelPersonalizado = (customPrice !== '' && customPrice !== null && !isNaN(customPrice)) ? Number(customPrice) : 0;
      } else if (servicioSelect?.value) {
        servicioId = parseInt(servicioSelect.value, 10);
      }

      const fechaHoraInicio = `${fecha} ${hora}:00`;

      const anticipacionMinutos = parseInt(document.getElementById('modal-apt-anticipacion')?.value, 10) || 30;
      const canalWa = document.getElementById('modal-apt-canal-wa')?.checked;
      const canalPush = document.getElementById('modal-apt-canal-push')?.checked;
      const canal = (canalWa && canalPush) ? 'WHATSAPP_Y_PUSH' : (canalWa ? 'WHATSAPP' : (canalPush ? 'PUSH' : 'WHATSAPP_Y_PUSH'));
      const mensajePersonalizado = document.getElementById('modal-apt-mensaje-recordatorio')?.value.trim();

      const payload = {
        paciente_id: parseInt(pacienteId, 10),
        ambiente_id: parseInt(ambienteId, 10),
        terapeuta_id: parseInt(terapeutaId, 10),
        servicio_id: servicioId,
        servicio_personalizado: servicioPersonalizado,
        arancel_personalizado: arancelPersonalizado,
        fecha_hora_inicio: fechaHoraInicio,
        duracion_minutos: duracion,
        motivo_consulta: motivo,
        recordatorio: {
          anticipacionMinutos,
          canal,
          mensajePersonalizado: mensajePersonalizado || null
        }
      };

      await apiClient.post('/appointments', payload);
      Toast.success('Cita médica programada exitosamente en el consultorio.');
      
      document.getElementById('modal-schedule-appointment')?.remove();
      await this.refreshAppointments();
    } catch (err) {
      Toast.error(err.message || 'Error al programar la cita.');
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${Icons.calendarPlus(16, '#FFFFFF')} <span>Confirmar Agendamiento</span>`;
      }
    }
  }

  // =========================================================================
  // MODAL 2: DETALLE Y GESTIÓN DE CITA (ADAPTADO CON RBAC PARA TUTOR)
  // =========================================================================
  async openDetailModal(appointmentId) {
    const modalContainer = document.getElementById('modal-container-agenda');
    if (!modalContainer) return;

    try {
      const res = await apiClient.get(`/appointments/${appointmentId}`);
      const apt = res.data;
      if (!apt) return;

      const startTime = this.formatTime(apt.fecha_hora_inicio);
      const endTime = this.formatTime(apt.fecha_hora_fin);
      const isTutor = (this.userRole === 'TUTOR');
      const isStaff = ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole);

      modalContainer.innerHTML = `
        <div id="modal-detail-appointment" class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.45); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1050; padding: 1rem;">
          
          <div class="soft-modal-card" style="max-width: 650px; max-height: 90vh;">
            
            <div style="background: var(--soft-lavender-surface); padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.calendar(20, 'var(--soft-purple-primary)')}
                </div>
                <div>
                  <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.015em;">Detalle de Sesión Terapéutica</h3>
                  <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.1rem;">Identificador de cita: #${apt.id}</div>
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 0.55rem;">
                <div id="modal-detail-status-badge-container" style="display: inline-flex; align-items: center;">
                  ${this.getStatusBadge(apt.estado)}
                </div>
                <button id="btn-close-detail-modal" type="button" class="soft-modal-close-btn" aria-label="Cerrar">
                  ${Icons.close(18)}
                </button>
              </div>
            </div>

            <div style="padding: 1.45rem 1.5rem; overflow-y: auto;">
              
              <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 18px; padding: 1rem 1.15rem; margin-bottom: 1.15rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem;">
                <div style="display: flex; align-items: center; gap: 0.85rem;">
                  <div class="soft-avatar-lg" style="width: 48px; height: 48px; border-radius: 16px; font-size: 1.1rem;">
                    ${apt.paciente_nombres ? this.escapeHtml(apt.paciente_nombres[0]) : 'P'}
                  </div>
                  <div>
                    <div style="font-weight: 800; color: var(--soft-text-title); font-size: 1.04rem;">
                      ${this.escapeHtml(apt.paciente_nombre_completo)}
                    </div>
                    <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                      Código: <strong>${this.escapeHtml(apt.paciente_codigo)}</strong> · CI: <strong>${this.escapeHtml(apt.paciente_ci || 'S/E')}</strong>
                    </div>
                  </div>
                </div>

                ${['ADMIN', 'TERAPEUTA'].includes(this.userRole) ? `
                  <a href="#/clinical-records?patientId=${apt.paciente_id}&patient=${apt.paciente_id}" id="link-view-history" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft">
                    ${Icons.stethoscope(14, 'var(--soft-purple-primary)')}
                    <span>Ver Historia</span>
                  </a>
                ` : ''}
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 0.85rem; margin-bottom: 1.15rem;">
                
                <div style="border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 0.85rem 1rem; background: #FFFFFF;">
                  <div style="font-size: 0.68rem; color: var(--soft-text-overline); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Consultorio Asignado</div>
                  <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.92rem; margin-top: 0.2rem;">
                    ${this.escapeHtml(apt.ambiente_nombre)}
                  </div>
                  <div style="font-size: 0.76rem; color: var(--soft-mint-deep); font-weight: 700; margin-top: 0.1rem;">
                    ${this.escapeHtml(apt.ambiente_codigo)}
                  </div>
                </div>

                <div style="border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 0.85rem 1rem; background: #FFFFFF;">
                  <div style="font-size: 0.68rem; color: var(--soft-text-overline); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Horario de Atención</div>
                  <div style="font-weight: 800; color: var(--soft-purple-primary); font-size: 0.92rem; margin-top: 0.2rem;">
                    ${apt.fecha_hora_inicio.slice(0, 10)} · ${startTime} a ${endTime}
                  </div>
                  <div style="font-size: 0.76rem; color: var(--soft-text-body); margin-top: 0.1rem;">
                    Duración: ${apt.duracion_minutos} min (+ 10 min higiene)
                  </div>
                </div>

                <div style="border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 0.85rem 1rem; background: #FFFFFF;">
                  <div style="font-size: 0.68rem; color: var(--soft-text-overline); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Terapeuta Responsable</div>
                  <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.92rem; margin-top: 0.2rem;">
                    Lic. ${this.escapeHtml(apt.terapeuta_nombre_completo)}
                  </div>
                  <div style="font-size: 0.76rem; color: var(--soft-text-body); margin-top: 0.1rem;">
                    ${this.escapeHtml(apt.especialidad_nombre || '')} (${this.escapeHtml(apt.terapeuta_matricula || '')})
                  </div>
                </div>

                <div style="border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 0.85rem 1rem; background: #FFFFFF;">
                  <div style="font-size: 0.68rem; color: var(--soft-text-overline); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Servicio &amp; Arancel</div>
                  <div style="font-weight: 800; color: var(--soft-emerald-dark); font-size: 0.92rem; margin-top: 0.2rem;">
                    ${apt.servicio_arancel ? `Bs. ${apt.servicio_arancel}` : 'Arancel regular'}
                  </div>
                  <div style="font-size: 0.76rem; color: var(--soft-text-body); margin-top: 0.1rem;">
                    ${this.escapeHtml(apt.servicio_nombre || 'Sesión Clínica')}
                  </div>
                </div>

                <div style="border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 0.85rem 1rem; background: #FFFFFF;">
                  <div style="font-size: 0.68rem; color: var(--soft-text-overline); text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">Tutor / Contacto Familiar</div>
                  <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.92rem; margin-top: 0.2rem;">
                    ${this.escapeHtml(apt.tutor_nombre_completo || 'Tutor registrado')}
                  </div>
                  <div style="font-size: 0.76rem; color: var(--soft-purple-primary); font-weight: 700; margin-top: 0.1rem; display: flex; align-items: center; gap: 0.35rem;">
                    ${Icons.whatsapp(13, 'var(--soft-purple-primary)')}
                    <span>${this.escapeHtml(apt.tutor_whatsapp ? (apt.tutor_whatsapp.startsWith('+') ? apt.tutor_whatsapp : (apt.tutor_whatsapp.startsWith('591') ? `+591 ${apt.tutor_whatsapp.slice(3)}` : `+591 ${apt.tutor_whatsapp}`)) : 'Sin WhatsApp')}</span>
                  </div>
                </div>

              </div>

              ${apt.motivo_consulta ? `
                <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.8rem 1rem; margin-bottom: 1.1rem;">
                  <div style="font-size: 0.74rem; color: var(--soft-text-overline); font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 0.2rem;">Motivo Clínico de Consulta:</div>
                  <div style="font-size: 0.86rem; color: var(--soft-text-title);">"${this.escapeHtml(apt.motivo_consulta)}"</div>
                </div>
              ` : ''}

              ${apt.motivo_cancelacion ? `
                <div style="background: #FFF1F2; border: 1px solid rgba(225, 29, 72, 0.24); border-radius: 14px; padding: 0.8rem 1rem; margin-bottom: 1.1rem; color: #9F1239;">
                  <div style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 0.2rem;">Motivo de Cancelación Registrado:</div>
                  <div style="font-size: 0.86rem;">"${this.escapeHtml(apt.motivo_cancelacion)}"</div>
                </div>
              ` : ''}

              ${apt.asistencia_registrada_at ? `
                <div style="font-size: 0.78rem; color: var(--soft-emerald-dark); font-weight: 600; margin-bottom: 1.1rem; display: flex; align-items: center; gap: 0.38rem;">
                  ${Icons.checkCircle(14, 'var(--soft-emerald-dark)')}
                  <span>Llegada registrada el <strong>${apt.asistencia_registrada_at}</strong> por <strong>${this.escapeHtml(apt.asistencia_registrada_por_nombre || 'Recepción')}</strong>.</span>
                </div>
              ` : ''}

              <!-- SECCIÓN EXCLUSIVA PARA TUTOR: Confirmación, Reprogramación y Cancelación Familiar -->
              ${isTutor ? `
                <div style="background: var(--soft-emerald-bg); border: 1px solid rgba(16, 185, 129, 0.24); border-radius: 16px; padding: 0.9rem 1.05rem; color: var(--soft-emerald-dark); font-size: 0.82rem; margin-top: 0.5rem; display: flex; align-items: flex-start; gap: 0.55rem;">
                  <span style="flex-shrink: 0; margin-top: 2px;">${Icons.checkCircle(16, 'var(--soft-emerald-dark)')}</span>
                  <div>
                    <div style="font-weight: 800; margin-bottom: 0.2rem;">Portal de Confirmación Familiar</div>
                    <div>Por favor confirme su asistencia para garantizar el espacio clínico de su hijo/a con su especialista. Si requiere cambiar el horario o no podrá asistir, puede solicitar reprogramación o cancelación justificada.</div>
                  </div>
                </div>

                ${(apt.estado === 'PROGRAMADA' || apt.estado === 'CONFIRMADA') ? `
                  <div style="display: flex; gap: 0.65rem; justify-content: flex-end; margin-top: 1.1rem; border-top: 1px solid var(--soft-divider); padding-top: 0.95rem; flex-wrap: wrap; align-items: center;">
                    <a href="#/portal/pagos" class="soft-btn soft-btn-lvl-1" style="font-size: 0.82rem; padding: 0.45rem 0.95rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;" title="Pagar arancel de la consulta mediante QR oficial">
                      ${Icons.qrCode(14, '#FFFFFF')}
                      <span>Pagar Consulta con QR</span>
                    </a>

                    ${apt.estado === 'PROGRAMADA' ? `
                      <button id="btn-tutor-confirm-pwa" type="button" class="soft-btn soft-btn-lvl-2" title="Confirmar asistencia a la sesión clínica">
                        ${Icons.check(14, '#FFFFFF')}
                        <span>Confirmar Asistencia</span>
                      </button>
                    ` : `
                      <span class="soft-btn soft-btn-sm soft-btn-confirmed" style="padding: 0.45rem 0.95rem; font-size: 0.82rem; border-radius: 12px;">
                        ${Icons.check(15, '#FFFFFF')}
                        <span>Asistencia Confirmada</span>
                      </span>
                    `}

                    <button id="btn-tutor-reschedule-pwa" type="button" class="soft-btn soft-btn-lvl-2-soft" title="Solicitar cambio de horario para la sesión">
                      ${Icons.clock(14, 'var(--soft-purple-primary)')}
                      <span>Solicitar Reprogramación</span>
                    </button>

                    <button id="btn-modal-cancel" type="button" class="soft-btn soft-btn-xs" title="Cancelar cita por motivos de fuerza mayor" style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); color: #FFFFFF !important; border: 1px solid #DC2626; font-weight: 800; padding: 0.35rem 0.75rem; border-radius: 10px; box-shadow: 0 4px 10px -2px rgba(220, 38, 38, 0.25);">
                      ${Icons.close(13, '#FFFFFF')}
                      <span style="color: #FFFFFF !important; font-weight: 800;">Cancelar</span>
                    </button>
                  </div>
                ` : apt.estado === 'REPROGRAMADA' ? `
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.1rem; border-top: 1px solid var(--soft-divider); padding-top: 0.95rem; flex-wrap: wrap; gap: 0.65rem;">
                    <div style="font-size: 0.82rem; font-weight: 700; color: #b45309; padding: 0.55rem 0.85rem; background: rgba(245, 158, 11, 0.12); border-radius: 10px; display: inline-flex; align-items: center; gap: 0.4rem;">
                      ${Icons.clock(15, '#b45309')}
                      <span>Solicitud de reprogramación registrada. Su terapeuta se comunicará con usted.</span>
                    </div>
                    <button id="btn-tutor-reschedule-pwa" type="button" class="soft-btn soft-btn-lvl-2-soft" title="Actualizar o cambiar solicitud">
                      <span>Modificar Solicitud</span>
                    </button>
                  </div>
                ` : ''}
              ` : ''}

              <!-- BOTONERA CLÍNICA Y ADMINISTRATIVA (SOLO PERSONAL AUTORIZADO — NIVEL 2) -->
              ${isStaff ? `
                <div style="display: flex; gap: 0.65rem; border-top: 1px solid var(--soft-divider); padding-top: 1.15rem; flex-wrap: wrap; justify-content: flex-end; align-items: center;">
                  
                  ${apt.estado === 'PROGRAMADA' ? `
                    <button id="btn-modal-notify-whatsapp" type="button" class="soft-btn soft-btn-lvl-2-soft" title="Enviar recordatorio por WhatsApp al tutor">
                      ${Icons.whatsapp(15, 'var(--soft-purple-primary)')}
                      <span>Notificar WhatsApp</span>
                    </button>

                    <button id="btn-modal-notify-pwa" type="button" class="soft-btn soft-btn-lvl-2-soft" title="Enviar notificación Web Push PWA inmediata al móvil/PC del tutor">
                      ${Icons.bell(15, 'var(--soft-purple-primary)')}
                      <span>Notificar PWA</span>
                    </button>

                    <button id="btn-modal-arrive" type="button" class="soft-btn soft-btn-lvl-2">
                      ${Icons.pulse(15, '#FFFFFF')}
                      <span>Registrar Llegada (En Sala)</span>
                    </button>

                    <button id="btn-modal-confirm" type="button" class="soft-btn soft-btn-lvl-2-soft">
                      ${Icons.check(15, 'var(--soft-purple-primary)')}
                      <span>Confirmar Cita</span>
                    </button>
                  ` : ''}

                  ${apt.estado === 'CONFIRMADA' ? `
                    <span class="soft-btn soft-btn-sm soft-btn-confirmed" style="padding: 0.45rem 0.95rem; font-size: 0.82rem; border-radius: 12px;">
                      ${Icons.check(15, '#FFFFFF')}
                      <span>Asistencia Confirmada</span>
                    </span>

                    <button id="btn-modal-arrive" type="button" class="soft-btn soft-btn-lvl-2">
                      ${Icons.pulse(15, '#FFFFFF')}
                      <span>Registrar Llegada (En Sala)</span>
                    </button>
                  ` : ''}

                  ${apt.estado === 'REPROGRAMADA' ? `
                    <button id="btn-modal-reschedule-appointment" type="button" class="soft-btn soft-btn-lvl-2" style="background: #d97706; border-color: #b45309; color: #FFFFFF;" title="Reprogramar fecha y hora acordada con el tutor">
                      ${Icons.calendar(15, '#FFFFFF')}
                      <span>Reprogramar Horario</span>
                    </button>
                  ` : ''}

                  ${apt.estado === 'EN_ATENCION' ? `
                    <button id="btn-modal-complete" type="button" class="soft-btn soft-btn-lvl-2">
                      ${Icons.checkCircle(15, '#FFFFFF')}
                      <span>Marcar Sesión Atendida</span>
                    </button>
                  ` : ''}

                  ${apt.estado !== 'CANCELADA' && apt.estado !== 'ATENDIDA' && apt.estado !== 'AUSENTE' ? `
                    <button id="btn-modal-absent" type="button" class="soft-btn soft-btn-lvl-2-soft" title="Marcar inasistencia del paciente">
                      ${Icons.userCheck(15, 'var(--soft-purple-primary)')}
                      <span>Ausente</span>
                    </button>

                    <button id="btn-modal-cancel" type="button" class="soft-btn soft-btn-lvl-2-soft" style="color: #BE123C !important; border-color: rgba(190, 18, 60, 0.25);" title="Cancelar la cita">
                      ${Icons.close(15, '#BE123C')}
                      <span>Cancelar Cita</span>
                    </button>
                  ` : ''}

                  ${apt.estado === 'AUSENTE' ? `
                    <span class="soft-badge soft-badge-rose" style="padding: 0.45rem 0.85rem; font-size: 0.8rem; font-weight: 700;">
                      Inasistencia / Ausente Registrado
                    </span>
                  ` : ''}

                  ${apt.estado === 'ATENDIDA' && ['ADMIN', 'TERAPEUTA'].includes(this.userRole) ? `
                    <a href="#/clinical-records?patientId=${apt.paciente_id}&patient=${apt.paciente_id}&action=soap" 
                      id="btn-goto-soap" class="soft-btn soft-btn-lvl-2">
                      ${Icons.fileText(15, '#FFFFFF')}
                      <span>Redactar Nota SOAP</span>
                    </a>
                  ` : ''}
                </div>
              ` : ''}

            </div>

          </div>
        </div>
      `;

      const modal = document.getElementById('modal-detail-appointment');
      this.activeDetailCitaId = apt.id;
      const closeDetailModal = () => {
        this.activeDetailCitaId = null;
        modal?.remove();
      };
      document.getElementById('btn-close-detail-modal')?.addEventListener('click', closeDetailModal);
      document.getElementById('link-view-history')?.addEventListener('click', closeDetailModal);
      document.getElementById('btn-goto-soap')?.addEventListener('click', closeDetailModal);

      // Despacho Manual de Alerta Web Push PWA al Tutor
      document.getElementById('btn-modal-notify-pwa')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const originalHtml = btn.innerHTML;
        try {
          btn.disabled = true;
          btn.innerHTML = `<span class="soft-spinner soft-spinner-sm" style="margin-right: 0.35rem;"></span> <span>Enviando PWA...</span>`;
          const res = await apiClient.post(`/appointments/${apt.id}/notify-pwa`, {});
          Toast.success(res.message || 'Notificación PWA enviada al dispositivo del tutor.');
        } catch (err) {
          Toast.error(err.message || 'Error al despachar notificación PWA.');
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      });

      document.getElementById('btn-modal-notify-whatsapp')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const recipientPhone = apt.tutor_whatsapp;
        if (!recipientPhone) {
          Toast.error('El paciente no tiene registrado un tutor con número de WhatsApp válido.');
          return;
        }

        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="soft-spinner soft-spinner-sm soft-spinner-white" style="margin-right: 0.4rem;"></span> <span>Enviando...</span>`;

        try {
          const parts = apt.fecha_hora_inicio.slice(0, 10).split('-');
          const fechaFmt = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : apt.fecha_hora_inicio.slice(0, 10);
          const childFirst = (apt.paciente_nombre_completo || 'PACIENTE').split(' ')[0].toUpperCase();
          const tutorNom = apt.tutor_nombre_completo || 'Tutor Familiar';
          const consultorio = apt.ambiente_codigo || apt.ambiente_nombre || 'Consultorio';
          const terapeutaNom = apt.terapeuta_nombre_completo || 'Especialista Asignado';

          const reminderMsg = 
`*RECORDATORIO DE SESIÓN CLÍNICA - PSI APRENDE*

Estimado/a *${tutorNom}*,
Le recordamos la sesión terapéutica programada para *${apt.paciente_nombre_completo}*:

• *Fecha:* ${fechaFmt}
• *Hora:* ${startTime}
• *Consultorio:* ${consultorio}
• *Especialista:* Lic. ${terapeutaNom}

Por favor responda a este mensaje con:
*1 ${childFirst}* para Confirmar asistencia
*2 ${childFirst}* para Solicitar reprogramación
(O simplemente responda *1* o *2*).

_Centro Psicopedagógico y de Atención Psicológica PSI Aprende_
_Cochabamba - Bolivia_`;

          const sendRes = await apiClient.post(`/whatsapp/appointments/${apt.id}/dispatch-now`, {
            message: reminderMsg
          });

          Toast.success(`Recordatorio formal enviado por WhatsApp a ${recipientPhone}.`);
          await this.refreshAppointments();
        } catch (err) {
          if (err.status === 409 || (err.message && err.message.includes('reconectando'))) {
            Toast.warning('El canal de WhatsApp del especialista se encuentra reconectando con el servidor en segundo plano. Por favor espere unos segundos e intente nuevamente.');
          } else {
            Toast.error(err.message || 'Error al despachar notificación por WhatsApp.');
          }
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      });

      document.getElementById('btn-modal-arrive')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await apiClient.patch(`/appointments/${apt.id}/status`, { estado: 'EN_ATENCION' });
          Toast.success('Llegada registrada. El paciente ya se encuentra en sala de atención.');
          modal?.remove();
          await this.refreshAppointments();
        } catch (err) {
          btn.disabled = false;
          Toast.error(err.message || 'Error al actualizar estado.');
        }
      });

      document.getElementById('btn-modal-confirm')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await apiClient.patch(`/appointments/${apt.id}/status`, { estado: 'CONFIRMADA' });
          Toast.success('Cita confirmada.');
          modal?.remove();
          await this.refreshAppointments();
        } catch (err) {
          btn.disabled = false;
          Toast.error(err.message || 'Error al confirmar cita.');
        }
      });

      document.getElementById('btn-modal-complete')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await apiClient.patch(`/appointments/${apt.id}/status`, { estado: 'ATENDIDA' });
          Toast.success('Sesión clínica completada exitosamente.');
          modal?.remove();
          await this.refreshAppointments();
        } catch (err) {
          btn.disabled = false;
          Toast.error(err.message || 'Error al completar sesión.');
        }
      });

      document.getElementById('btn-modal-absent')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const origHtml = btn.innerHTML;
        try {
          btn.disabled = true;
          btn.innerHTML = `<span class="soft-spinner soft-spinner-sm" style="margin-right: 0.3rem;"></span><span>Marcando...</span>`;
          await apiClient.patch(`/appointments/${apt.id}/status`, { estado: 'AUSENTE' });
          Toast.warning('Cita marcada como inasistencia / ausente.');
          this.activeDetailCitaId = null;
          modal?.remove();
          window.dispatchEvent(new CustomEvent('appointment-status-changed', {
            detail: { citaId: apt.id, estado: 'AUSENTE' }
          }));
          await this.refreshAppointments();
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = origHtml;
          Toast.error(err.message || 'Error al marcar inasistencia.');
        }
      });

      document.getElementById('btn-modal-reschedule-appointment')?.addEventListener('click', () => {
        this.activeDetailCitaId = null;
        modal?.remove();
        this.openEditScheduleModal(apt);
      });

      document.getElementById('btn-modal-cancel')?.addEventListener('click', () => {
        this.openCancelModal(apt.id);
      });

      document.getElementById('btn-tutor-confirm-pwa')?.addEventListener('click', () => {
        this.openTutorConfirmModal(apt);
      });

      document.getElementById('btn-tutor-reschedule-pwa')?.addEventListener('click', () => {
        this.openTutorRescheduleModal(apt);
      });

    } catch (err) {
      Toast.error(err.message || 'Error al cargar los detalles de la cita.');
    }
  }

  // =========================================================================
  // MODAL 3: CANCELAR CITA CON MOTIVO OBLIGATORIO (SUB-MODAL ANIDADO — NIVEL 3)
  // =========================================================================
  openCancelModal(appointmentId) {
    const modalContainer = document.getElementById('modal-container-agenda');
    if (!modalContainer) return;

    const cancelModal = document.createElement('div');
    cancelModal.id = 'modal-cancel-reason';
    cancelModal.className = 'modal-backdrop';
    cancelModal.style.cssText = 'position: fixed; inset: 0; background: rgba(39, 52, 95, 0.55); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem;';

    cancelModal.innerHTML = `
      <div class="soft-modal-card" style="max-width: 480px; padding: 1.65rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.9rem;">
          <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
            ${Icons.alertTriangle(20, 'var(--soft-purple-primary)')}
          </div>
          <div>
            <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.015em;">Cancelar Cita Médica</h3>
            <div style="font-size: 0.76rem; color: var(--soft-text-muted);">Registro en bitácora de auditoría</div>
          </div>
        </div>

        <p style="font-size: 0.86rem; color: var(--soft-text-body); margin: 0 0 1rem 0; line-height: 1.5;">
          Por favor, ingrese el motivo clínico o justificación formal de la cancelación para registrarlo en la bitácora de auditoría.
        </p>

        <div class="form-group" style="margin-bottom: 1.35rem;">
          <textarea id="input-cancel-reason" class="soft-textarea" rows="3" required
            placeholder="Ej. Solicitud de la familia por salud, viaje o reprogramación para la siguiente semana..."></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.65rem;">
          <button id="btn-abort-cancel" type="button" class="soft-btn soft-btn-lvl-2-soft">Atrás</button>
          <button id="btn-confirm-cancel" type="button" class="soft-btn" style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%) !important; color: #FFFFFF !important; border: 1px solid #DC2626; box-shadow: 0 4px 14px -2px rgba(220, 38, 38, 0.35);">
            Confirmar Cancelación
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(cancelModal);

    cancelModal.querySelector('#btn-abort-cancel')?.addEventListener('click', () => cancelModal.remove());

    cancelModal.querySelector('#btn-confirm-cancel')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const reason = cancelModal.querySelector('#input-cancel-reason')?.value.trim();
      if (!reason || reason.length < 5) {
        Toast.warning('Debe especificar un motivo de al menos 5 caracteres.');
        return;
      }

      btn.disabled = true;
      try {
        await apiClient.post(`/appointments/${appointmentId}/cancel`, { motivo_cancelacion: reason });
        Toast.success('Cita médica cancelada con justificación registrada.');
        cancelModal.remove();
        document.getElementById('modal-detail-appointment')?.remove();
        await this.refreshAppointments();
      } catch (err) {
        btn.disabled = false;
        Toast.error(err.message || 'No se pudo cancelar la cita.');
      }
    });
  }

  // =========================================================================
  // MODAL 4: CONFIRMAR ASISTENCIA CLÍNICA POR EL TUTOR (PWA PORTAL)
  // =========================================================================
  openTutorConfirmModal(apt) {
    const confirmModal = document.createElement('div');
    confirmModal.id = 'modal-tutor-confirm';
    confirmModal.className = 'modal-backdrop';
    confirmModal.style.cssText = 'position: fixed; inset: 0; background: rgba(39, 52, 95, 0.55); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem;';

    const fecha = this.formatDateHeader(apt.fecha_hora_inicio.slice(0, 10));
    const hora = this.formatTime(apt.fecha_hora_inicio);
    const ambiente = apt.ambiente_codigo || apt.ambiente_nombre || 'Consultorio';
    const terapeuta = apt.terapeuta_nombre_completo || 'Especialista Asignado';

    confirmModal.innerHTML = `
      <div class="soft-modal-card" style="max-width: 480px; padding: 1.65rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.9rem;">
          <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
            ${Icons.checkCircle(20, 'var(--soft-mint-deep)')}
          </div>
          <div>
            <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.015em;">Confirmar Asistencia Familiar</h3>
            <div style="font-size: 0.76rem; color: var(--soft-text-muted);">Compromiso de sesión terapéutica</div>
          </div>
        </div>

        <div style="background: var(--soft-lavender-light, #F5F3FF); border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 1rem; font-size: 0.84rem; color: var(--soft-text-title); line-height: 1.5;">
          <div><strong>Paciente:</strong> ${this.escapeHtml(apt.paciente_nombre_completo)}</div>
          <div><strong>Especialista:</strong> ${this.escapeHtml(terapeuta)}</div>
          <div><strong>Fecha y Hora:</strong> ${fecha} a las ${hora}</div>
          <div><strong>Consultorio:</strong> ${this.escapeHtml(ambiente)}</div>
        </div>

        <p style="font-size: 0.84rem; color: var(--soft-text-body); margin: 0 0 1.25rem 0; line-height: 1.5;">
          Al confirmar, el sistema garantizará la reserva del consultorio y notificará al especialista en tiempo real sobre su asistencia.
        </p>

        <div style="display: flex; justify-content: flex-end; gap: 0.65rem;">
          <button id="btn-abort-tutor-confirm" type="button" class="soft-btn soft-btn-lvl-2-soft">Volver</button>
          <button id="btn-submit-tutor-confirm" type="button" class="soft-btn soft-btn-lvl-2">
            ${Icons.check(14, '#FFFFFF')}
            <span>Confirmar Cita</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmModal);

    confirmModal.querySelector('#btn-abort-tutor-confirm')?.addEventListener('click', () => confirmModal.remove());

    confirmModal.querySelector('#btn-submit-tutor-confirm')?.addEventListener('click', async () => {
      try {
        await apiClient.patch(`/appointments/${apt.id}/status`, { estado: 'CONFIRMADA' });
        Toast.success('¡Asistencia confirmada exitosamente! Su especialista ha sido notificado.');
        confirmModal.remove();
        document.getElementById('modal-detail-appointment')?.remove();
        await this.refreshAppointments();
      } catch (e) {
        Toast.error(e.message || 'No se pudo confirmar la cita.');
      }
    });
  }

  // =========================================================================
  // MODAL 5: SOLICITAR REPROGRAMACIÓN FAMILIAR (PWA PORTAL)
  // =========================================================================
  openTutorRescheduleModal(apt) {
    const rescheduleModal = document.createElement('div');
    rescheduleModal.id = 'modal-tutor-reschedule';
    rescheduleModal.className = 'modal-backdrop';
    rescheduleModal.style.cssText = 'position: fixed; inset: 0; background: rgba(39, 52, 95, 0.55); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem;';

    rescheduleModal.innerHTML = `
      <div class="soft-modal-card" style="max-width: 480px; padding: 1.65rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.9rem;">
          <div class="soft-icon-box soft-icon-box-sm soft-icon-box-indigo">
            ${Icons.clock(20, 'var(--soft-indigo-accent)')}
          </div>
          <div>
            <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.015em;">Solicitud de Reprogramación</h3>
            <div style="font-size: 0.76rem; color: var(--soft-text-muted);">Coordinación clínica personalizada</div>
          </div>
        </div>

        <p style="font-size: 0.84rem; color: var(--soft-text-body); margin: 0 0 0.85rem 0; line-height: 1.5;">
          Indique la razón o preferencia de horario para la cita de <strong>${this.escapeHtml(apt.paciente_nombre_completo)}</strong>. Secretaría y su especialista se comunicarán con usted para convenir la nueva fecha:
        </p>

        <div class="form-group" style="margin-bottom: 1.35rem;">
          <textarea id="input-reschedule-reason" class="soft-textarea" rows="3" required
            placeholder="Ej: Requerimos cambio por actividades escolares / preferimos turno de la tarde..."></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.65rem;">
          <button id="btn-abort-tutor-reschedule" type="button" class="soft-btn soft-btn-lvl-2-soft">Volver</button>
          <button id="btn-submit-tutor-reschedule" type="button" class="soft-btn soft-btn-lvl-2">
            ${Icons.check(14, '#FFFFFF')}
            <span>Enviar Solicitud</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(rescheduleModal);

    rescheduleModal.querySelector('#btn-abort-tutor-reschedule')?.addEventListener('click', () => rescheduleModal.remove());

    rescheduleModal.querySelector('#btn-submit-tutor-reschedule')?.addEventListener('click', async () => {
      const reason = rescheduleModal.querySelector('#input-reschedule-reason')?.value.trim();
      if (!reason || reason.length < 5) {
        Toast.warning('Por favor describa el motivo o preferencia horaria (mínimo 5 caracteres).');
        return;
      }

      try {
        await apiClient.patch(`/appointments/${apt.id}/status`, { 
          estado: 'REPROGRAMADA',
          motivo_cancelacion: reason 
        });
        Toast.info('Solicitud de reprogramación registrada. El especialista ha sido avisado para coordinar el nuevo horario.');
        rescheduleModal.remove();
        document.getElementById('modal-detail-appointment')?.remove();
        await this.refreshAppointments();
      } catch (e) {
        Toast.error(e.message || 'No se pudo enviar la solicitud.');
      }
    });
  }

  // =========================================================================
  // MODAL 6: REPROGRAMAR / EDITAR CITA CLÍNICA (PERSONAL DE COORDINACIÓN)
  // =========================================================================
  openEditScheduleModal(apt) {
    const modalContainer = document.getElementById('modal-container-agenda');
    if (!modalContainer) return;

    const fechaVal = (apt.fecha_hora_inicio || '').slice(0, 10) || this.selectedDate;
    const horaVal = (apt.fecha_hora_inicio || '').slice(11, 16) || '09:00';
    const duracionVal = apt.duracion_minutos || 45;
    const ambienteVal = apt.ambiente_id || (this.rooms[0]?.id || 1);
    const terapeutaVal = apt.terapeuta_id || (this.therapists[0]?.id || 1);
    const pacienteNom = apt.paciente_nombre_completo || 'Paciente';

    modalContainer.innerHTML = `
      <div id="modal-edit-appointment" class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.45); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 620px; width: 100%; max-height: 90vh;">
          <div style="background: var(--soft-lavender-surface); padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.calendar(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; letter-spacing: -0.015em;">Reprogramar Cita Terapéutica</h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.1rem;">Cita #${apt.id} · Paciente: <strong>${this.escapeHtml(pacienteNom)}</strong></div>
              </div>
            </div>
            <button id="btn-close-edit-modal" type="button" class="soft-modal-close-btn" aria-label="Cerrar">${Icons.close(18)}</button>
          </div>

          <form id="form-edit-appointment" style="padding: 1.45rem 1.5rem; overflow-y: auto;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.1rem;">
              <div class="form-group">
                <label class="soft-label">Nueva Fecha <span class="required">*</span></label>
                <input type="date" id="edit-apt-fecha" class="soft-input" value="${fechaVal}" required />
              </div>
              <div class="form-group">
                <label class="soft-label">Nueva Hora de Inicio <span class="required">*</span></label>
                <input type="time" id="edit-apt-hora" class="soft-input" value="${horaVal}" required />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.1rem;">
              <div class="form-group">
                <label class="soft-label">Consultorio Asignado <span class="required">*</span></label>
                <select id="edit-apt-ambiente" class="soft-select" required>
                  ${this.rooms.map(r => `
                    <option value="${r.id}" ${r.id == ambienteVal ? 'selected' : ''}>
                      ${this.escapeHtml(r.nombre.split(' - ')[0])} (${this.escapeHtml(r.tipo)})
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="soft-label">Duración (minutos) <span class="required">*</span></label>
                <input type="number" id="edit-apt-duracion" class="soft-input" value="${duracionVal}" min="15" max="240" step="5" required />
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.1rem;">
              <label class="soft-label">Terapeuta Responsable <span class="required">*</span></label>
              <select id="edit-apt-terapeuta" class="soft-select" required>
                ${this.therapists.map(t => `
                  <option value="${t.id}" ${t.id == terapeutaVal ? 'selected' : ''}>
                    Lic. ${this.escapeHtml(t.nombres)} ${this.escapeHtml(t.apellidos)} (${this.escapeHtml(t.especialidad_nombre || '')})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="soft-label">Notas de Reprogramación / Motivo</label>
              <textarea id="edit-apt-motivo" class="soft-textarea" rows="2" placeholder="Motivo o acuerdo con el tutor sobre el cambio de horario...">${this.escapeHtml(apt.motivo_consulta || '')}</textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.65rem; border-top: 1px solid var(--soft-divider); padding-top: 1.15rem;">
              <button type="button" id="btn-cancel-edit-modal" class="soft-btn soft-btn-lvl-1-muted">Cancelar</button>
              <button type="submit" id="btn-submit-edit-appointment" class="soft-btn soft-btn-lvl-2" style="background: #d97706; border-color: #b45309; color: #FFFFFF;">
                ${Icons.calendar(15, '#FFFFFF')}
                <span>Guardar Nueva Fecha y Hora</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    const closeEdit = () => document.getElementById('modal-edit-appointment')?.remove();
    document.getElementById('btn-close-edit-modal')?.addEventListener('click', closeEdit);
    document.getElementById('btn-cancel-edit-modal')?.addEventListener('click', closeEdit);

    document.getElementById('form-edit-appointment')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-edit-appointment');
      const fecha = document.getElementById('edit-apt-fecha')?.value;
      const hora = document.getElementById('edit-apt-hora')?.value;
      const ambienteId = document.getElementById('edit-apt-ambiente')?.value;
      const terapeutaId = document.getElementById('edit-apt-terapeuta')?.value;
      const duracion = parseInt(document.getElementById('edit-apt-duracion')?.value, 10) || 45;
      const motivo = document.getElementById('edit-apt-motivo')?.value?.trim();

      if (!fecha || !hora) {
        Toast.warning('La fecha y hora son obligatorias.');
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span class="soft-spinner soft-spinner-sm soft-spinner-white" style="margin-right: 0.35rem;"></span> <span>Reprogramando...</span>`;
        }

        await apiClient.put(`/appointments/${apt.id}`, {
          fecha_hora_inicio: `${fecha} ${hora}:00`,
          duracion_minutos: duracion,
          ambiente_id: parseInt(ambienteId, 10),
          terapeuta_id: parseInt(terapeutaId, 10),
          motivo_consulta: motivo || apt.motivo_consulta,
          estado: 'PROGRAMADA'
        });

        Toast.success(`¡Cita reprogramada con éxito para el ${fecha} a las ${hora}!`);
        closeEdit();

        this.selectedDate = fecha;
        window.dispatchEvent(new CustomEvent('appointment-status-changed', {
          detail: { citaId: apt.id, estado: 'PROGRAMADA' }
        }));

        await this.refreshAppointments();
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `${Icons.calendar(15, '#FFFFFF')} <span>Guardar Nueva Fecha y Hora</span>`;
        }
        Toast.error(err.message || 'Error al reprogramar la cita.');
      }
    });
  }
}
