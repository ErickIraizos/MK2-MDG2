import { apiClient } from '../../api/apiClient.js';
import { Toast } from '../../components/Toast.js';
import { Icons } from '../../components/Icons.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { store } from '../../store.js';
import { escapeHtml } from '../../utils/sanitize.js';

export class UsersView {
  constructor(container) {
    this.container = container;
    this.users = [];
    this.inactiveUsers = [];
    this.searchTerm = '';
    this.currentTab = 'STAFF'; // 'STAFF' | 'TUTORS' | 'ALL' | 'INACTIVE'
    this.auditLogs = [];
    this.auditSearchTerm = '';
  }

  async render() {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem;">
        <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto;">
          <div style="display: inline-flex; animation: spin 1.1s linear infinite;">${Icons.pulse(24, 'var(--soft-purple-primary)')}</div>
        </div>
        <p style="color: var(--soft-text-body); margin-top: 0.9rem; font-weight: 500; font-size: 0.9rem;">Cargando directorio institucional de usuarios...</p>
      </div>
    `;

    try {
      const [res, resInactive] = await Promise.all([
        apiClient.get('/users'),
        apiClient.get('/users/inactive')
      ]);
      const rawUsers = res.data || [];
      this.users = rawUsers.filter(u => u.activo === 1);
      this.inactiveUsers = resInactive.data || [];

      const renderTabPill = (isActive, count) => `
        <span class="tab-count-pill" style="padding: 0.1rem 0.5rem; border-radius: 9999px; font-size: 0.71rem; font-weight: 800; background: ${isActive ? 'rgba(255, 255, 255, 0.22)' : 'rgba(88, 66, 148, 0.11)'}; color: inherit;">
          ${count}
        </span>
      `;

      this.container.innerHTML = `
        <div class="page-container panel-general">
          <!-- CABECERA -->
          <div class="soft-header-row">
            <div>
              <div class="soft-header-meta">
                <span class="soft-badge soft-badge-lavender">Control de Acceso RBAC</span>
                <span class="soft-location-label">Centro "PSI Aprende" · Administración</span>
              </div>
              <h1 class="soft-page-title">
                Gestión de Usuarios y Roles (RBAC)
              </h1>
              <p class="soft-page-subtitle">
                Control de acceso, asignación de roles para personal clínico y supervisión de cuentas de tutores.
              </p>
            </div>

            <div class="soft-header-actions">
              <button type="button" id="btn-view-audit" class="soft-btn soft-btn-lvl-1-muted">
                ${Icons.shield(16, 'currentColor')}
                <span>Bitácora de Auditoría</span>
              </button>
              <button type="button" id="btn-create-user" class="soft-btn soft-btn-lvl-1">
                ${Icons.plus(16, '#FFFFFF')}
                <span>Registrar Nuevo Personal</span>
              </button>
            </div>
          </div>

          <!-- FRANJA COMPACTA DE MÉTRICAS EJECUTIVAS (KPIs) -->
          <div class="soft-kpi-grid">
            <div class="soft-kpi-card">
              <span class="soft-status-dot-green" title="Directorio en línea" aria-hidden="true"></span>
              <div class="soft-icon-box soft-icon-box-lavender">
                ${Icons.users(22, 'var(--soft-purple-primary)')}
              </div>
              <div class="soft-kpi-body">
                <span class="soft-kpi-overline">Total Usuarios</span>
                <div class="soft-kpi-value" style="font-size: 1.45rem;">${this.users.length}</div>
              </div>
            </div>

            <div class="soft-kpi-card soft-kpi-mint">
              <span class="soft-status-dot-green" title="Especialistas activos" aria-hidden="true"></span>
              <div class="soft-icon-box soft-icon-box-mint">
                ${Icons.therapist(22, 'var(--soft-mint-deep)')}
              </div>
              <div class="soft-kpi-body">
                <span class="soft-kpi-overline">Personal Clínico</span>
                <div class="soft-kpi-value" style="font-size: 1.45rem;">
                  ${this.users.filter(u => u.rol_nombre === 'TERAPEUTA').length}
                </div>
              </div>
            </div>

            <div class="soft-kpi-card">
              <div class="soft-icon-box soft-icon-box-indigo">
                ${Icons.shield(22, 'var(--soft-indigo-accent)')}
              </div>
              <div class="soft-kpi-body">
                <span class="soft-kpi-overline">Dirección y Caja</span>
                <div class="soft-kpi-value" style="font-size: 1.45rem;">
                  ${this.users.filter(u => ['ADMIN', 'RECEPCION'].includes(u.rol_nombre)).length}
                </div>
              </div>
            </div>

            <div class="soft-kpi-card soft-kpi-mint">
              <div class="soft-icon-box soft-icon-box-mint">
                ${Icons.patient(22, 'var(--soft-mint-deep)')}
              </div>
              <div class="soft-kpi-body">
                <span class="soft-kpi-overline">Familias y Tutores</span>
                <div class="soft-kpi-value" style="font-size: 1.45rem;">
                  ${this.users.filter(u => u.rol_nombre === 'TUTOR').length}
                </div>
              </div>
            </div>
          </div>

          <!-- PESTAÑAS DE SEPARACIÓN: PERSONAL VS TUTORES VS INACTIVOS -->
          <div class="tabs-scroll-container" style="margin-bottom: 1.35rem;">
            <button type="button" id="tab-users-staff" class="soft-btn soft-btn-sm ${this.currentTab === 'STAFF' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}">
              ${Icons.therapist(15, 'currentColor')}
              <span>Personal del Centro</span>
              ${renderTabPill(this.currentTab === 'STAFF', this.users.filter(u => u.rol_nombre !== 'TUTOR').length)}
            </button>

            <button type="button" id="tab-users-tutors" class="soft-btn soft-btn-sm ${this.currentTab === 'TUTORS' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}">
              ${Icons.users(15, 'currentColor')}
              <span>Familias y Tutores</span>
              ${renderTabPill(this.currentTab === 'TUTORS', this.users.filter(u => u.rol_nombre === 'TUTOR').length)}
            </button>

            <button type="button" id="tab-users-all" class="soft-btn soft-btn-sm ${this.currentTab === 'ALL' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}">
              <span>Todos los Activos</span>
              ${renderTabPill(this.currentTab === 'ALL', this.users.length)}
            </button>

            <button type="button" id="tab-users-inactive" class="soft-btn soft-btn-sm ${this.currentTab === 'INACTIVE' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}">
              ${Icons.archive(15, 'currentColor')}
              <span>Personal Desvinculado / Inactivos</span>
              ${renderTabPill(this.currentTab === 'INACTIVE', this.inactiveUsers.length)}
            </button>
          </div>

          <!-- TABLA DE USUARIOS Y GESTOR DE ROLES -->
          <div class="soft-section-card">
            <div class="soft-section-header" style="margin-bottom: 1.35rem;">
              <div>
                <h3 id="table-category-title" class="soft-section-title" style="font-size: 1.18rem;">
                  ${this.currentTab === 'STAFF' ? 'Directorio de Personal Clínico y Administrativo' : (this.currentTab === 'TUTORS' ? 'Directorio de Familias y Tutores' : 'Listado General de Cuentas')}
                </h3>
                <p class="soft-section-subtitle">
                  Asigne roles o modifique el estado de acceso de cualquier usuario en tiempo real
                </p>
              </div>

              <!-- Buscador reactivo de usuarios -->
              <div class="soft-search-box">
                <span class="soft-search-box-icon">
                  ${Icons.search(16, 'currentColor')}
                </span>
                <input 
                  type="text" 
                  id="user-search-input" 
                  class="soft-input" 
                  placeholder="Buscar por nombre, email o rol..."
                  style="height: 42px; font-size: 0.85rem;"
                />
              </div>
            </div>

            <div class="soft-table-wrap">
              <table class="soft-table">
                <thead id="users-table-head">
                  <tr>
                    <th>Usuario</th>
                    <th>Correo Electrónico</th>
                    <th>Teléfono / WhatsApp</th>
                    <th>Rol Asignado</th>
                    <th style="text-align: center;">Estado</th>
                    <th style="text-align: right;">Acciones</th>
                  </tr>
                </thead>
                <tbody id="users-table-body">
                  <!-- Se llena dinámicamente con renderUsersTable() -->
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- MODAL DE BITÁCORA DE AUDITORÍA Y SEGURIDAD (NIVEL 2) -->
        <div id="audit-modal-backdrop" class="modal-backdrop" style="display: none; background: rgba(36, 40, 91, 0.45);">
          <div class="soft-modal-card" style="max-width: 980px; width: 100%; max-height: 90vh;">
            <div style="padding: 1.35rem 1.75rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.85rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.shield(20, 'var(--soft-purple-primary)')}
                </div>
                <div>
                  <h3 style="margin: 0; font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em;">
                    Bitácora Inalterable de Auditoría y Seguridad
                  </h3>
                  <div style="font-size: 0.8rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                    Registro cronológico de accesos, roles y transacciones auditables (SQLite WAL)
                  </div>
                </div>
              </div>
              <button type="button" id="btn-close-audit-modal" class="soft-modal-close-btn" aria-label="Cerrar bitácora">
                ${Icons.close(18)}
              </button>
            </div>

            <div style="padding: 1.35rem 1.75rem; overflow-y: auto; flex: 1;">
              <!-- Filtro de bitácora -->
              <div class="soft-search-box" style="margin-bottom: 1.1rem; min-width: 100%;">
                <span class="soft-search-box-icon">
                  ${Icons.search(16, 'currentColor')}
                </span>
                <input 
                  type="text" 
                  id="audit-search-input" 
                  class="soft-input" 
                  placeholder="Filtrar por acción (LOGIN, USER_CREATED), módulo, usuario o IP..."
                  style="height: 40px; font-size: 0.85rem;"
                />
              </div>

              <!-- Tabla de bitácora -->
              <div class="soft-table-wrap">
                <table class="soft-table" style="font-size: 0.82rem;">
                  <thead>
                    <tr>
                      <th>Fecha y Hora</th>
                      <th>Usuario / Rol</th>
                      <th>Módulo</th>
                      <th>Acción</th>
                      <th>Detalles</th>
                      <th>IP Origen</th>
                    </tr>
                  </thead>
                  <tbody id="audit-table-body">
                    <tr>
                      <td colspan="6" style="text-align: center; padding: 2rem; color: var(--soft-text-body);">
                        Cargando registros de auditoría...
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style="padding: 1rem 1.75rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; background: #FCFBFF;">
              <button type="button" id="btn-close-audit-bottom" class="soft-btn soft-btn-lvl-2-soft">Cerrar Bitácora</button>
            </div>
          </div>
        </div>

        <!-- MODAL PARA CREAR NUEVO USUARIO / PERSONAL (NIVEL 2) -->
        <div id="create-user-modal" class="modal-backdrop" style="display: none; background: rgba(36, 40, 91, 0.45);">
          <div class="soft-modal-card" style="max-width: 520px; width: 100%;">
            <div style="padding: 1.35rem 1.75rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 0.8rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.users(20, 'var(--soft-purple-primary)')}
                </div>
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em;">
                  Registrar Nuevo Usuario / Personal
                </h3>
              </div>
              <button type="button" id="modal-user-close" class="soft-modal-close-btn" aria-label="Cerrar">
                ${Icons.close(18)}
              </button>
            </div>

            <form id="create-user-form" style="padding: 1.45rem 1.75rem;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.05rem;">
                <div>
                  <label class="soft-label" for="new-user-nombres">Nombres <span class="required">*</span></label>
                  <input type="text" id="new-user-nombres" class="soft-input" placeholder="Ej. Dr. Mario" required />
                </div>
                <div>
                  <label class="soft-label" for="new-user-apellidos">Apellidos <span class="required">*</span></label>
                  <input type="text" id="new-user-apellidos" class="soft-input" placeholder="Ej. Torrico Céspedes" required />
                </div>
              </div>

              <div style="margin-bottom: 1.05rem;">
                <label class="soft-label" for="new-user-email">Correo Electrónico Institucional / Personal <span class="required">*</span></label>
                <input type="email" id="new-user-email" class="soft-input" placeholder="mario.torrico@psi-aprende.com" required />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.05rem;">
                <div>
                  <label class="soft-label" for="new-user-role">Rol en el Sistema <span class="required">*</span></label>
                  <select id="new-user-role" class="soft-select" required>
                    <option value="2" selected>TERAPEUTA (Clínico)</option>
                    <option value="3">RECEPCION (Caja / Admisión)</option>
                    <option value="1">ADMIN (Dirección General)</option>
                    <option value="4">TUTOR (Familia)</option>
                  </select>
                </div>

                <div>
                  <label class="soft-label" for="new-user-phone">Teléfono / WhatsApp</label>
                  <input type="tel" id="new-user-phone" class="soft-input" placeholder="+591 7XXXXXXX" />
                </div>
              </div>

              <div style="margin-bottom: 1.45rem;">
                <label class="soft-label" for="new-user-password">Contraseña Temporal <span class="required">*</span></label>
                <input type="password" id="new-user-password" class="soft-input" placeholder="Mínimo 8 caracteres" required />
                <div style="font-size: 0.76rem; color: var(--soft-text-muted); margin-top: 0.3rem;">
                  El usuario podrá cambiarla luego desde su panel de seguridad.
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1.15rem;">
                <button type="button" id="btn-cancel-user-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" id="btn-save-new-user" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(15, '#FFFFFF')}
                  <span>Crear Usuario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      this.renderUsersTable();
      this.attachEvents();
    } catch (err) {
      this.container.innerHTML = `
        <div class="page-container panel-general">
          <div class="soft-card-static" style="text-align: center; padding: 2.5rem 2rem;">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 0.9rem auto;">
              ${Icons.alert(24, 'var(--soft-purple-primary)')}
            </div>
            <h3 style="color: var(--soft-text-title); font-weight: 800; margin: 0 0 0.45rem 0;">Error al cargar usuarios</h3>
            <p style="color: var(--soft-text-body); margin: 0;">${escapeHtml(err.message)}</p>
          </div>
        </div>
      `;
    }
  }

  renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    const thead = document.getElementById('users-table-head');
    if (!tbody) return;

    if (thead) {
      if (this.currentTab === 'INACTIVE') {
        thead.innerHTML = `
          <tr>
            <th>Usuario Desvinculado</th>
            <th>Correo / Contacto</th>
            <th>Rol Histórico</th>
            <th>Fecha de Salida</th>
            <th>Motivo de Salida</th>
            <th style="text-align: right;">Acciones</th>
          </tr>
        `;
      } else {
        thead.innerHTML = `
          <tr>
            <th>Usuario</th>
            <th>Correo Electrónico</th>
            <th>Teléfono / WhatsApp</th>
            <th>Rol Asignado</th>
            <th style="text-align: center;">Estado</th>
            <th style="text-align: right;">Acciones</th>
          </tr>
        `;
      }
    }

    const currentUser = store.getState().user;
    let filtered = this.currentTab === 'INACTIVE' ? this.inactiveUsers : this.users;

    // Filtrar por pestaña activa (Personal vs Tutores)
    if (this.currentTab === 'STAFF') {
      filtered = filtered.filter(u => u.rol_nombre !== 'TUTOR');
    } else if (this.currentTab === 'TUTORS') {
      filtered = filtered.filter(u => u.rol_nombre === 'TUTOR');
    }

    if (this.searchTerm) {
      filtered = filtered.filter(u => 
        (u.nombre_completo && u.nombre_completo.toLowerCase().includes(this.searchTerm)) ||
        (u.email && u.email.toLowerCase().includes(this.searchTerm)) ||
        (u.rol_nombre && u.rol_nombre.toLowerCase().includes(this.searchTerm)) ||
        (u.telefono && u.telefono.toLowerCase().includes(this.searchTerm))
      );
    }

    if (filtered.length === 0) {
      const emptyMsg = this.currentTab === 'INACTIVE' 
        ? 'No hay personal desvinculado o cuentas inactivas registradas.' 
        : `No existen cuentas registradas que coincidan con "${escapeHtml(this.searchTerm)}".`;
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 2.75rem 1rem; text-align: center;">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin-bottom: 1rem;">
                ${Icons.folderSearch(28, 'var(--soft-purple-primary)')}
              </div>
              <h4 style="font-size: 1.08rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.35rem 0;">
                ${this.currentTab === 'INACTIVE' ? 'Sin cuentas inactivas' : 'No se encontraron usuarios coincidentes'}
              </h4>
              <p style="font-size: 0.86rem; color: var(--soft-text-body); max-width: 420px; margin: 0 0 1.1rem 0; line-height: 1.48;">
                ${emptyMsg}
              </p>
              ${this.searchTerm ? `
                <button type="button" id="btn-clear-user-search" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted">
                  Restablecer Búsqueda
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;

      const clearBtn = document.getElementById('btn-clear-user-search');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          this.searchTerm = '';
          const input = document.getElementById('user-search-input');
          if (input) input.value = '';
          this.renderUsersTable();
        });
      }
      return;
    }

    const getInitials = (name) => (name || 'U')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(n => n[0].toUpperCase())
      .join('');

    if (this.currentTab === 'INACTIVE') {
      tbody.innerHTML = filtered.map(u => {
        const fechaSalida = u.fecha_desvinculacion 
          ? new Date(u.fecha_desvinculacion).toLocaleDateString('es-BO', { dateStyle: 'medium' }) 
          : 'No registrada';
        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="soft-avatar-sm">${escapeHtml(getInitials(u.nombre_completo))}</div>
                <div>
                  <div style="font-weight: 700; color: var(--soft-text-title);">${escapeHtml(u.nombre_completo)}</div>
                  <span class="soft-badge soft-badge-amber" style="font-size: 0.68rem; padding: 0.16rem 0.55rem; margin-top: 0.2rem;">Desvinculado</span>
                </div>
              </div>
            </td>
            <td>${escapeHtml(u.email)}</td>
            <td>
              <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem;">${escapeHtml(u.rol_nombre)}</span>
            </td>
            <td style="font-size: 0.82rem; white-space: nowrap;">
              ${escapeHtml(fechaSalida)}
            </td>
            <td style="font-size: 0.82rem; color: var(--soft-text-title); font-style: italic;">
              "${escapeHtml(u.motivo_desvinculacion || 'Desvinculación del centro')}"
            </td>
            <td style="text-align: right;">
              <button 
                type="button"
                class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-restore-user" 
                data-id="${escapeHtml(u.id)}" 
                data-name="${escapeHtml(u.nombre_completo)}"
                title="Reactivar usuario en el sistema"
              >
                ${Icons.restore(14, '#FFFFFF')}
                <span>Reactivar</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      tbody.innerHTML = filtered.map(u => {
        const isSelf = currentUser && currentUser.id === u.id;

        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="soft-avatar-sm">${escapeHtml(getInitials(u.nombre_completo))}</div>
                <div>
                  <div style="font-weight: 700; color: var(--soft-text-title);">${escapeHtml(u.nombre_completo)}</div>
                  ${isSelf ? '<span class="soft-badge soft-badge-mint" style="font-size: 0.68rem; padding: 0.14rem 0.52rem; margin-top: 0.18rem;">Tu cuenta activa</span>' : ''}
                </div>
              </div>
            </td>
            <td>${escapeHtml(u.email)}</td>
            <td>${u.telefono ? escapeHtml(u.telefono) : '<span style="color: var(--soft-text-muted);">-</span>'}</td>
            <td>
              <select 
                class="soft-select soft-select-sm select-user-role" 
                data-id="${escapeHtml(u.id)}" 
                data-name="${escapeHtml(u.nombre_completo)}"
                ${isSelf ? 'disabled title="No puedes cambiar tu propio rol"' : ''}
                style="width: 148px;"
              >
                <option value="1" ${u.rol_id === 1 ? 'selected' : ''}>ADMIN</option>
                <option value="2" ${u.rol_id === 2 ? 'selected' : ''}>TERAPEUTA</option>
                <option value="3" ${u.rol_id === 3 ? 'selected' : ''}>RECEPCION</option>
                <option value="4" ${u.rol_id === 4 ? 'selected' : ''}>TUTOR</option>
              </select>
            </td>
            <td style="text-align: center;">
              <button 
                type="button"
                class="btn-toggle-status soft-status-pill ${u.activo ? 'soft-status-pill-active' : 'soft-status-pill-inactive'}" 
                data-id="${escapeHtml(u.id)}" 
                data-name="${escapeHtml(u.nombre_completo)}"
                data-active="${u.activo ? '1' : '0'}"
                ${isSelf ? 'disabled title="No puede desactivar su propia cuenta de acceso"' : 'title="Clic para cambiar estado activo / inactivo de la cuenta"'}
              >
                <span style="width: 7px; height: 7px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
                <span>${u.activo ? 'Activo' : 'Inactivo'}</span>
              </button>
            </td>
            <td style="text-align: right;">
              ${!isSelf ? `
                <button 
                  type="button"
                  class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-delete-user" 
                  data-id="${escapeHtml(u.id)}" 
                  data-name="${escapeHtml(u.nombre_completo)}"
                  title="Desvincular usuario del centro"
                >
                  ${Icons.trash(14, 'currentColor')}
                  <span>Desvincular</span>
                </button>
              ` : '<span class="soft-badge soft-badge-indigo" style="font-size: 0.71rem;">Protegido</span>'}
            </td>
          </tr>
        `;
      }).join('');
    }

    this.attachTableDynamicEvents();
  }

  attachTableDynamicEvents() {
    // Alternar estado activo / inactivo del usuario
    document.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const userId = btn.dataset.id;
        const userName = btn.dataset.name;
        const currentActive = btn.dataset.active === '1';
        const newActive = !currentActive;

        try {
          btn.disabled = true;
          await apiClient.put(`/users/${userId}/status`, { activo: newActive });
          Toast.success(`Estado de "${userName}" actualizado a ${newActive ? 'Activo' : 'Inactivo'}.`);
          const target = this.users.find(u => String(u.id) === String(userId));
          if (target) target.activo = newActive ? 1 : 0;
          this.renderUsersTable();
        } catch (err) {
          Toast.error(err.message || 'Error al actualizar estado del usuario.');
          btn.disabled = false;
        }
      });
    });

    // Cambiar rol directamente desde el select
    document.querySelectorAll('.select-user-role').forEach(select => {
      select.addEventListener('change', async () => {
        const userId = select.dataset.id;
        const userName = select.dataset.name;
        const newRoleId = select.value;

        try {
          const res = await apiClient.put(`/users/${userId}/role`, { rol_id: newRoleId });
          Toast.success(res.message || `Rol de ${userName} actualizado.`);
          await this.render();
        } catch (err) {
          Toast.error(err.message || 'Error al cambiar rol del usuario.');
          await this.render(); // Restaura valor anterior
        }
      });
    });

    // Reactivar usuario desvinculado
    document.querySelectorAll('.btn-restore-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.id;
        const userName = btn.dataset.name;

        const confirmed = await ConfirmModal.show({
          title: `¿Reactivar la cuenta de ${userName}?`,
          message: `El usuario volverá a estar activo con su rol histórico y podrá iniciar sesión normalmente en la plataforma.`,
          confirmText: 'Sí, reactivar cuenta',
          cancelText: 'Cancelar'
        });

        if (confirmed) {
          try {
            await apiClient.put(`/users/${userId}/restore`);
            Toast.success(`Cuenta de "${userName}" reactivada exitosamente.`);
            await this.render();
          } catch (err) {
            Toast.error(err.message || 'Error al reactivar usuario.');
          }
        }
      });
    });

    // Desvincular usuario con ConfirmModal (Baja Lógica)
    document.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.id;
        const userName = btn.dataset.name;

        const confirmed = await ConfirmModal.show({
          title: `¿Desvincular a ${userName} del centro?`,
          message: `Esta acción revocará los accesos al sistema. Su firma histórica, expedientes y registros en la bitácora permanecerán inalterables.`,
          confirmText: 'Sí, desvincular usuario',
          cancelText: 'Cancelar'
        });

        if (confirmed) {
          try {
            await apiClient.delete(`/users/${userId}`, { motivo: 'Desvinculación del centro' });
            Toast.success(`Usuario "${userName}" desvinculado del sistema. Su histórico se conserva.`);
            await this.render();
          } catch (err) {
            Toast.error(err.message || 'Error al desvincular usuario.');
          }
        }
      });
    });
  }

  async loadAuditLogs() {
    const tbody = document.getElementById('audit-table-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--soft-text-body);">
            <div style="display: inline-block; animation: spin 1.1s linear infinite;">${Icons.pulse(20, 'var(--soft-purple-primary)')}</div>
            <div style="margin-top: 0.5rem;">Consultando registros de auditoría...</div>
          </td>
        </tr>
      `;
    }

    try {
      const res = await apiClient.get('/users/audit-logs?limit=100');
      this.auditLogs = res.data || [];
      this.renderAuditTable();
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 2rem; color: var(--soft-purple-primary); font-weight: 600;">
              Error al consultar la bitácora: ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  renderAuditTable() {
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;

    let filtered = this.auditLogs;
    if (this.auditSearchTerm) {
      filtered = filtered.filter(log => 
        (log.accion && log.accion.toLowerCase().includes(this.auditSearchTerm)) ||
        (log.modulo && log.modulo.toLowerCase().includes(this.auditSearchTerm)) ||
        (log.detalles && log.detalles.toLowerCase().includes(this.auditSearchTerm)) ||
        (log.usuario_nombre && log.usuario_nombre.toLowerCase().includes(this.auditSearchTerm)) ||
        (log.usuario_email && log.usuario_email.toLowerCase().includes(this.auditSearchTerm)) ||
        (log.ip_origen && log.ip_origen.toLowerCase().includes(this.auditSearchTerm))
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--soft-text-body);">
            <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto 0.7rem auto;">
              ${Icons.folderSearch(24, 'var(--soft-purple-primary)')}
            </div>
            <div>No se encontraron registros de auditoría coincidentes.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(log => {
      let actionBadge = 'soft-badge-lavender';
      if (log.accion.includes('CREATE')) actionBadge = 'soft-badge-emerald';
      if (log.accion.includes('DELETE')) actionBadge = 'soft-badge-amber';
      if (log.accion.includes('LOGIN')) actionBadge = 'soft-badge-mint';

      const dateStr = new Date(log.created_at).toLocaleString('es-BO', {
        dateStyle: 'short',
        timeStyle: 'medium'
      });

      return `
        <tr>
          <td style="font-family: monospace; font-size: 0.78rem; white-space: nowrap; color: var(--soft-text-muted);">
            ${escapeHtml(dateStr)}
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
              <strong style="color: var(--soft-text-title);">${escapeHtml(log.usuario_nombre || 'Personal del Centro')}</strong>
              ${log.usuario_activo === 0 ? '<span class="soft-badge soft-badge-amber" style="font-size: 0.65rem; padding: 0.1rem 0.42rem;">Desvinculado</span>' : ''}
            </div>
            <div style="font-size: 0.72rem; color: var(--soft-text-muted);">${escapeHtml(log.usuario_email || '')} ${log.rol_nombre ? `(${escapeHtml(log.rol_nombre)})` : ''}</div>
          </td>
          <td>
            <span class="soft-specialty-tag" style="margin-left: 0; font-size: 0.71rem;">
              ${escapeHtml(log.modulo)}
            </span>
          </td>
          <td>
            <span class="soft-badge ${actionBadge}" style="font-size: 0.69rem; padding: 0.22rem 0.62rem;">
              ${escapeHtml(String(log.accion).replace(/_/g, ' '))}
            </span>
          </td>
          <td style="font-size: 0.8rem; color: var(--soft-text-body);">
            ${escapeHtml(log.detalles || '-')}
          </td>
          <td style="font-family: monospace; font-size: 0.76rem; color: var(--soft-text-muted); white-space: nowrap;">
            ${escapeHtml(log.ip_origen || '127.0.0.1')}
          </td>
        </tr>
      `;
    }).join('');
  }

  attachEvents() {
    // Buscador de usuarios reactivo
    const searchInput = document.getElementById('user-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase().trim();
        this.renderUsersTable();
      });
    }

    // Modal de Bitácora de Auditoría
    const btnViewAudit = document.getElementById('btn-view-audit');
    const auditModal = document.getElementById('audit-modal-backdrop');
    const btnCloseAuditModal = document.getElementById('btn-close-audit-modal');
    const btnCloseAuditBottom = document.getElementById('btn-close-audit-bottom');
    const auditSearchInput = document.getElementById('audit-search-input');

    if (btnViewAudit && auditModal) {
      btnViewAudit.addEventListener('click', async () => {
        auditModal.style.display = 'flex';
        await this.loadAuditLogs();
      });
    }
    if (btnCloseAuditModal && auditModal) {
      btnCloseAuditModal.addEventListener('click', () => auditModal.style.display = 'none');
    }
    if (btnCloseAuditBottom && auditModal) {
      btnCloseAuditBottom.addEventListener('click', () => auditModal.style.display = 'none');
    }
    auditModal?.addEventListener('click', (e) => {
      if (e.target === auditModal) auditModal.style.display = 'none';
    });

    if (auditSearchInput) {
      auditSearchInput.addEventListener('input', (e) => {
        this.auditSearchTerm = e.target.value.toLowerCase().trim();
        this.renderAuditTable();
      });
    }

    // Modal de Crear Usuario
    const modal = document.getElementById('create-user-modal');
    const btnOpenModal = document.getElementById('btn-create-user');
    const btnCloseModal = document.getElementById('modal-user-close');
    const btnCancelModal = document.getElementById('btn-cancel-user-modal');
    const form = document.getElementById('create-user-form');

    const openModal = () => {
      if (modal) modal.style.display = 'flex';
    };
    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Pestañas de separación Personal vs Tutores vs Inactivos
    const tabStaff = document.getElementById('tab-users-staff');
    const tabTutors = document.getElementById('tab-users-tutors');
    const tabAll = document.getElementById('tab-users-all');
    const tabInactive = document.getElementById('tab-users-inactive');
    const tableCategoryTitle = document.getElementById('table-category-title');

    const setTabActive = (btn, isActive) => {
      if (!btn) return;
      btn.classList.toggle('soft-btn-lvl-1', isActive);
      btn.classList.toggle('soft-btn-lvl-1-muted', !isActive);
      const pill = btn.querySelector('.tab-count-pill');
      if (pill) {
        pill.style.background = isActive ? 'rgba(255, 255, 255, 0.22)' : 'rgba(88, 66, 148, 0.11)';
      }
    };

    const updateTabsUI = () => {
      setTabActive(tabStaff, this.currentTab === 'STAFF');
      setTabActive(tabTutors, this.currentTab === 'TUTORS');
      setTabActive(tabAll, this.currentTab === 'ALL');
      setTabActive(tabInactive, this.currentTab === 'INACTIVE');
      if (tableCategoryTitle) {
        tableCategoryTitle.textContent = this.currentTab === 'STAFF' 
          ? 'Directorio de Personal Clínico y Administrativo' 
          : (this.currentTab === 'TUTORS' 
              ? 'Directorio de Familias y Tutores' 
              : (this.currentTab === 'INACTIVE' 
                  ? 'Personal Desvinculado y Cuentas Inactivas' 
                  : 'Listado General de Cuentas Activas'));
      }
      this.renderUsersTable();
    };

    if (tabStaff) tabStaff.addEventListener('click', () => { this.currentTab = 'STAFF'; updateTabsUI(); });
    if (tabTutors) tabTutors.addEventListener('click', () => { this.currentTab = 'TUTORS'; updateTabsUI(); });
    if (tabAll) tabAll.addEventListener('click', () => { this.currentTab = 'ALL'; updateTabsUI(); });
    if (tabInactive) tabInactive.addEventListener('click', () => { this.currentTab = 'INACTIVE'; updateTabsUI(); });

    // Guardar nuevo usuario creado por el director
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombres = document.getElementById('new-user-nombres').value.trim();
        const apellidos = document.getElementById('new-user-apellidos').value.trim();
        const email = document.getElementById('new-user-email').value.trim();
        const rol_id = document.getElementById('new-user-role').value;
        const telefono = document.getElementById('new-user-phone').value.trim();
        const password = document.getElementById('new-user-password').value;

        if (!nombres || !apellidos || !email || !password) {
          Toast.error('Por favor complete todos los campos obligatorios.');
          return;
        }

        try {
          const nombre_completo = `${nombres} ${apellidos}`.trim();
          await apiClient.post('/users', {
            nombre_completo,
            email,
            password,
            rol_id,
            telefono
          });
          Toast.success(`Usuario ${nombre_completo} creado exitosamente.`);
          closeModal();
          await this.render();
        } catch (err) {
          Toast.error(err.message || 'Error al crear usuario.');
        }
      });
    }

    // Auto-apertura de modal o selección de pestaña por Deep Linking (MindBot IA o enlaces directos)
    const currentHash = window.location.hash;
    if (currentHash.includes('audit')) {
      setTimeout(() => {
        btnViewAudit?.click();
      }, 150);
    } else if (currentHash.includes('/users/new') || currentHash.includes('modal=new-user')) {
      setTimeout(() => {
        btnOpenModal?.click();
      }, 150);
    } else if (currentHash.includes('inactive')) {
      setTimeout(() => {
        tabInactive?.click();
      }, 150);
    } else if (currentHash.includes('tutors')) {
      setTimeout(() => {
        tabTutors?.click();
      }, 150);
    }
  }
}
