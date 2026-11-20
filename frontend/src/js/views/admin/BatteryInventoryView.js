import { apiClient } from '../../api/apiClient.js';
import { Toast } from '../../components/Toast.js';
import { Icons } from '../../components/Icons.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { store } from '../../store.js';

export class BatteryInventoryView {
  constructor(container) {
    this.container = container;
    this.batteries = [];
    this.loans = [];
    this.therapists = [];
    this.rooms = [];
    this.activeTab = 'catalog'; // 'catalog' | 'history'
    this.selectedBattery = null;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  formatDateTime(isoString) {
    if (!isoString) return 'No registrado';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  }

  formatLoanTimeDetail(startIso, endIso) {
    if (!startIso) return 'Horario en curso';
    try {
      const s = new Date(startIso);
      const isToday = new Date().toDateString() === s.toDateString();
      const datePrefix = isToday ? 'Hoy' : s.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit' });
      const sTime = s.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
      if (endIso) {
        const e = new Date(endIso);
        const eTime = e.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
        return `${datePrefix}, de ${sTime} a ${eTime}`;
      }
      return `${datePrefix}, desde las ${sTime}`;
    } catch {
      return startIso;
    }
  }

  async render() {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem;">
        <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto;">
          <div style="display: inline-flex; animation: spin 1.1s linear infinite;">${Icons.pulse(24, 'var(--soft-purple-primary)')}</div>
        </div>
        <p style="color: var(--soft-text-body); margin-top: 0.9rem; font-weight: 500; font-size: 0.9rem;">Cargando inventario de baterías psicométricas y custodia RN-06...</p>
      </div>
    `;

    try {
      await this.loadData();
      this.renderContent();
    } catch (error) {
      console.error('Error al cargar BatteryInventoryView:', error);
      this.container.innerHTML = `
        <div class="page-container panel-general">
          <div class="soft-card" style="text-align: center; padding: 2.5rem 1.5rem; max-width: 600px; margin: 2rem auto; border: 1px solid var(--soft-border-card-inner, #E2DCF0);">
            <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto 1rem;">
              ${Icons.alertTriangle(28, '#DC2626')}
            </div>
            <h3 style="color: var(--brand-navy); font-size: 1.15rem; margin-bottom: 0.5rem;">No se pudo cargar el inventario clínico</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">${this.escapeHtml(error.message)}</p>
            <button type="button" class="soft-btn soft-btn-lvl-1" id="btn-retry-batteries">
              ${Icons.refresh(16, '#FFFFFF')}
              <span>Reintentar</span>
            </button>
          </div>
        </div>
      `;
      document.getElementById('btn-retry-batteries')?.addEventListener('click', () => this.render());
    }
  }

  async loadData() {
    const [batteriesRes, historyRes, therapistsRes, roomsRes] = await Promise.all([
      apiClient.get('/inventory'),
      apiClient.get('/inventory/history').catch(() => ({ data: [] })),
      apiClient.get('/therapists').catch(() => ({ data: [] })),
      apiClient.get('/rooms?includeInactive=false').catch(() => ({ data: [] }))
    ]);

    this.batteries = batteriesRes.data || [];
    this.loans = historyRes.data || [];
    this.therapists = therapistsRes.data || [];
    this.rooms = roomsRes.data || [];
  }

  renderContent() {
    const user = store.getState().user;
    const canManageLoans = ['ADMIN', 'RECEPCION'].includes(user?.rol);

    const totalBatteries = this.batteries.length;
    const disponibles = this.batteries.filter(b => (b.estado_disponibilidad || b.estado) === 'DISPONIBLE').length;
    const enConsulta = this.batteries.filter(b => (b.estado_disponibilidad || b.estado) === 'EN_CONSULTA').length;
    const enMantenimiento = this.batteries.filter(b => ['EN_MANTENIMIENTO', 'EN_DESUSO'].includes(b.estado_disponibilidad || b.estado)).length;

    this.container.innerHTML = `
      <div class="page-container panel-general">
        <!-- CABECERA -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <a href="#/dashboard" class="soft-back-link">&larr; Volver al Panel Principal</a>
              <span class="soft-badge soft-badge-mint">Custodia Psicométrica RN-06</span>
            </div>
            <h1 class="soft-page-title">
              Inventario de Baterías Psicométricas y Préstamos
            </h1>
            <p class="soft-page-subtitle" style="max-width: 800px;">
              Catálogo estandarizado de instrumentos diagnósticos, control estricto de piezas, estado de conservación y protocolo bioético RN-06 de préstamos a consultorios con bloqueo automático en caso de mora.
            </p>
          </div>

          <div class="soft-header-actions" style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            ${canManageLoans ? `
              <button type="button" id="btn-create-battery" class="soft-btn soft-btn-lvl-2">
                ${Icons.plus(16, 'currentColor')}
                <span>Registrar Batería en Inventario</span>
              </button>
              <button type="button" id="btn-open-loan-modal" class="soft-btn soft-btn-lvl-1">
                ${Icons.package(16, '#FFFFFF')}
                <span>Prestar Batería a Consultorio</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- TARJETAS DE RESUMEN KPI (Uniform 1px border) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 1.25rem; margin-bottom: 2rem;">
          <div class="soft-card" style="padding: 1.25rem 1.4rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.04); display: flex; align-items: center; gap: 1rem;">
            <div class="soft-icon-box soft-icon-box-lavender" style="flex-shrink: 0;">
              ${Icons.package(24, 'var(--soft-purple-primary)')}
            </div>
            <div>
              <span style="font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary);">
                Total Baterías en Centro
              </span>
              <div style="font-size: 1.35rem; font-weight: 800; color: var(--brand-navy); margin-top: 0.2rem;">
                ${totalBatteries} Pruebas
              </div>
            </div>
          </div>

          <div class="soft-card" style="padding: 1.25rem 1.4rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.04); display: flex; align-items: center; gap: 1rem;">
            <div class="soft-icon-box soft-icon-box-mint" style="flex-shrink: 0;">
              ${Icons.checkCircle(24, 'var(--soft-mint-deep)')}
            </div>
            <div>
              <span style="font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary);">
                Disponibles en Gabinete
              </span>
              <div style="font-size: 1.35rem; font-weight: 800; color: var(--soft-emerald-dark); margin-top: 0.2rem;">
                ${disponibles} Listas
              </div>
            </div>
          </div>

          <div class="soft-card" style="padding: 1.25rem 1.4rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.04); display: flex; align-items: center; gap: 1rem;">
            <div class="soft-icon-box" style="flex-shrink: 0; background: #FFFBEB;">
              ${Icons.clock(24, '#D97706')}
            </div>
            <div>
              <span style="font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary);">
                En Consulta / En Uso
              </span>
              <div style="font-size: 1.35rem; font-weight: 800; color: #B45309; margin-top: 0.2rem;">
                ${enConsulta} en Salas
              </div>
            </div>
          </div>

          <div class="soft-card" style="padding: 1.25rem 1.4rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.04); display: flex; align-items: center; gap: 1rem;">
            <div class="soft-icon-box" style="flex-shrink: 0; background: #F1F5F9;">
              ${Icons.shield(24, '#64748B')}
            </div>
            <div>
              <span style="font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary);">
                Mantenimiento / Baja
              </span>
              <div style="font-size: 1.35rem; font-weight: 800; color: var(--brand-navy); margin-top: 0.2rem;">
                ${enMantenimiento} Instrumentos
              </div>
            </div>
          </div>
        </div>

        <!-- PESTAÑAS (Catálogo vs Historial de Préstamos) -->
        <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--soft-border-card-inner, #E2DCF0); padding-bottom: 0.75rem;">
          <button type="button" id="tab-catalog" class="soft-btn ${this.activeTab === 'catalog' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-2'}" style="padding: 0.5rem 1.15rem; font-size: 0.88rem;">
            ${Icons.package(16, 'currentColor')}
            <span>Catálogo de Baterías Psicométricas</span>
          </button>
          <button type="button" id="tab-history" class="soft-btn ${this.activeTab === 'history' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-2'}" style="padding: 0.5rem 1.15rem; font-size: 0.88rem;">
            ${Icons.history(16, 'currentColor')}
            <span>Historial y Auditoría de Préstamos</span>
          </button>
        </div>

        <!-- CONTENIDO SEGÚN PESTAÑA -->
        ${this.activeTab === 'catalog' ? this.renderCatalogSection(canManageLoans) : this.renderHistorySection()}
      </div>

      <!-- CONTENEDOR MODAL -->
      <div id="modal-container-battery"></div>
    `;

    this.attachEvents(canManageLoans);
  }

  renderCatalogSection(canManageLoans) {
    if (this.batteries.length === 0) {
      return `
        <div class="soft-card" style="text-align: center; padding: 3rem 1.5rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF;">
          <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto 1rem;">
            ${Icons.package(28, 'var(--soft-purple-primary)')}
          </div>
          <h3 style="color: var(--brand-navy); font-size: 1.1rem; margin-bottom: 0.5rem;">No hay baterías registradas en inventario</h3>
          <p style="color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 1.25rem;">Comience registrando los instrumentos psicométricos del centro clínico.</p>
          ${canManageLoans ? `
            <button type="button" class="soft-btn soft-btn-lvl-1" onclick="document.getElementById('btn-create-battery')?.click()">
              ${Icons.plus(16, '#FFFFFF')}
              <span>Registrar Primera Batería</span>
            </button>
          ` : ''}
        </div>
      `;
    }

    return `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 1.5rem;">
        ${this.batteries.map(battery => this.renderBatteryCard(battery, canManageLoans)).join('')}
      </div>
    `;
  }

  renderBatteryCard(battery, canManageLoans) {
    const estado = battery.estado_disponibilidad || battery.estado || 'DISPONIBLE';
    const isDisponible = estado === 'DISPONIBLE';
    const isEnConsulta = estado === 'EN_CONSULTA';
    const isMantenimiento = estado === 'EN_MANTENIMIENTO';
    const isDesuso = estado === 'EN_DESUSO';

    const codigo = battery.codigo_patrimonial || battery.codigo;
    const activeLoanId = battery.prestamo_activo_id || battery.prestamo_actual?.id;
    
    // Especialista activo
    const activeTherapist = (battery.terapeuta_nombres ? `${battery.terapeuta_nombres} ${battery.terapeuta_apellidos || ''}`.trim() : null)
      || battery.prestamo_actual?.terapeuta_nombre
      || 'Especialista en Evaluación';
    const activeSpec = battery.terapeuta_especialidad || battery.prestamo_actual?.terapeuta_especialidad || '';
    
    // Sala / Ambiente activo
    const activeRoom = (battery.ambiente_nombre ? `${battery.ambiente_nombre}${battery.ambiente_codigo ? ` (${battery.ambiente_codigo})` : ''}` : null)
      || battery.prestamo_actual?.sala_nombre
      || 'Consultorio de Evaluación';
    
    // Rango horario de consulta
    const activeTimeRange = this.formatLoanTimeDetail(
      battery.prestamo_fecha_retiro || battery.prestamo_actual?.fecha_prestamo,
      battery.prestamo_devolucion_estimada || battery.prestamo_actual?.fecha_devolucion_esperada
    );
    const loanNotes = battery.prestamo_observaciones || battery.prestamo_actual?.observaciones;

    // Estado de conservación
    const estadoConservacion = (battery.estado_conservacion || 'BUENO').toUpperCase();
    let conservacionBadge = '';
    if (estadoConservacion === 'EXCELENTE') {
      conservacionBadge = `<span class="soft-badge" style="background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; font-size: 0.74rem;">Conservación: Excelente</span>`;
    } else if (estadoConservacion === 'BUENO') {
      conservacionBadge = `<span class="soft-badge" style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); color: var(--soft-purple-primary); font-size: 0.74rem;">Conservación: Buen Estado</span>`;
    } else if (estadoConservacion === 'REGULAR') {
      conservacionBadge = `<span class="soft-badge" style="background: #FFFBEB; border: 1px solid #FDE68A; color: #B45309; font-size: 0.74rem;">Conservación: Regular</span>`;
    } else {
      conservacionBadge = `<span class="soft-badge" style="background: #FEF2F2; border: 1px solid #FECACA; color: #DC2626; font-size: 0.74rem;">Deteriorado / Reponer</span>`;
    }

    return `
      <div class="soft-card" style="padding: 1.5rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.04); display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; max-width: 100%; box-sizing: border-box;">
        <div style="max-width: 100%; overflow: hidden;">
          
          <!-- FOTO O DOCUMENTO DE REFERENCIA (SI TIENE ADJUNTO) -->
          ${battery.imagen_url ? `
            <div style="margin-bottom: 1rem; border-radius: 12px; overflow: hidden; border: 1px solid var(--soft-border-card-inner, #E2DCF0); background: #FAF9FD; text-align: center; position: relative;">
              ${battery.imagen_url.toLowerCase().endsWith('.pdf') ? `
                <a href="${this.escapeHtml(battery.imagen_url)}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 0.6rem; padding: 1.25rem 1rem; text-decoration: none; color: var(--soft-purple-primary); font-weight: 600; font-size: 0.84rem;">
                  ${Icons.filePdf(22, '#DC2626')}
                  <span>Ver Ficha Técnica / Protocolo Escaneado (PDF)</span>
                </a>
              ` : `
                <a href="${this.escapeHtml(battery.imagen_url)}" target="_blank" rel="noopener noreferrer" title="Clic para ampliar referencia visual" style="display: block; width: 100%; height: 140px; overflow: hidden;">
                  <img src="${this.escapeHtml(battery.imagen_url)}" alt="${this.escapeHtml(battery.nombre)}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.parentElement.style.display='none'" />
                </a>
              `}
            </div>
          ` : ''}

          <!-- CABECERA DE LA TARJETA -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.85rem;">
            <div style="min-width: 0; flex: 1;">
              <span class="soft-badge" style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); color: var(--soft-purple-primary); font-family: monospace; font-weight: 700; font-size: 0.78rem;">
                ${this.escapeHtml(codigo)}
              </span>
              <h3 style="color: var(--brand-navy); font-size: 1.08rem; font-weight: 700; margin: 0.4rem 0 0.15rem; line-height: 1.35; word-break: break-word;">
                ${this.escapeHtml(battery.nombre)}
              </h3>
            </div>

            <div style="flex-shrink: 0;">
              ${isDisponible ? `
                <span class="soft-badge soft-badge-mint" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem;">
                  ${Icons.checkCircle(13, 'var(--soft-mint-deep)')} Disponible
                </span>
              ` : isEnConsulta ? `
                <span class="soft-badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem;">
                  ${Icons.clock(13, '#B45309')} En Consulta
                </span>
              ` : isMantenimiento ? `
                <span class="soft-badge" style="background: #F1F5F9; color: #64748B; border: 1px solid #E2E8F0; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem;">
                  ${Icons.shield(13, '#64748B')} Mantenimiento
                </span>
              ` : `
                <span class="soft-badge" style="background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem;">
                  ${Icons.alertTriangle(13, '#DC2626')} En Desuso
                </span>
              `}
            </div>
          </div>

          <!-- METADATOS CLÍNICOS -->
          <div style="display: flex; flex-wrap: wrap; gap: 0.45rem; margin-bottom: 0.9rem; max-width: 100%;">
            <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.35rem 0.65rem; color: var(--brand-navy); font-size: 0.76rem; line-height: 1.35; width: 100%; word-break: break-word; box-sizing: border-box;">
              <strong style="color: var(--soft-purple-primary);">Área:</strong> ${this.escapeHtml(battery.area_evaluada || battery.categoria || 'Evaluación Psicométrica')}
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.45rem; width: 100%;">
              ${conservacionBadge}
              <span class="soft-badge" style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); color: var(--text-secondary); font-size: 0.74rem;">
                ${this.escapeHtml(battery.editorial || 'Edición Estandarizada')}
              </span>
            </div>
          </div>

          <!-- DETALLE DE PIEZAS Y COMPONENTES -->
          <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 0.9rem; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.45; word-break: break-word; box-sizing: border-box;">
            <strong style="color: var(--brand-navy); display: block; margin-bottom: 0.25rem;">Componentes e Inventario de Piezas:</strong>
            ${this.escapeHtml(battery.piezas_detalle || 'Material estandarizado completo.')}
          </div>

          <!-- UBICACIÓN EN GABINETE -->
          <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1.15rem;">
            <span style="color: var(--soft-purple-primary);">${Icons.rooms(15, 'currentColor')}</span>
            <span>Ubicación: <strong>${this.escapeHtml(battery.ubicacion || 'Gabinete Psicométrico General')}</strong></span>
          </div>

          <!-- INDICADOR COMPACTO EN CASO DE CONSULTA ACTIVA -->
          ${isEnConsulta ? `
            <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 1.15rem; display: flex; align-items: center; justify-content: space-between; gap: 0.65rem; flex-wrap: wrap; box-sizing: border-box;">
              <div style="display: flex; align-items: flex-start; gap: 0.45rem; min-width: 0; flex: 1 1 170px;">
                <span style="color: #B45309; flex-shrink: 0; margin-top: 0.1rem;">${Icons.clock(16, '#B45309')}</span>
                <div style="font-size: 0.8rem; color: #92400E; line-height: 1.35; word-break: break-word;">
                  En uso en <strong>${this.escapeHtml(activeRoom)}</strong>
                </div>
              </div>
              <button type="button" class="btn-usage-details soft-btn soft-btn-lvl-2" data-battery-id="${battery.id}" style="font-size: 0.78rem; padding: 0.35rem 0.85rem; font-weight: 600; flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.35rem;">
                ${Icons.eye(14, '#FFFFFF')}
                <span>Ver Detalles</span>
              </button>
            </div>
          ` : ''}
        </div>

        <!-- ACCIONES (Soft UI Médica Level 1 & Level 2 Buttons) -->
        <div style="border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1rem; display: flex; justify-content: flex-end; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
          ${canManageLoans ? `
            <button type="button" class="btn-edit-battery soft-btn soft-btn-lvl-2" data-battery-id="${battery.id}" style="font-size: 0.82rem; padding: 0.45rem 0.85rem;">
              ${Icons.edit(14, 'currentColor')}
              <span>Editar</span>
            </button>
          ` : ''}

          ${canManageLoans && isDisponible ? `
            <button type="button" class="btn-loan-specific soft-btn soft-btn-lvl-1" data-battery-id="${battery.id}" style="font-size: 0.82rem; padding: 0.45rem 1rem;">
              ${Icons.plus(15, '#FFFFFF')}
              <span>Prestar a Consultorio</span>
            </button>
          ` : ''}

          ${canManageLoans && isEnConsulta && activeLoanId ? `
            <button type="button" class="btn-return-specific soft-btn soft-btn-lvl-1" data-loan-id="${activeLoanId}" data-battery-name="${this.escapeHtml(battery.nombre)}" style="background: var(--soft-mint-deep); box-shadow: 0 2px 8px rgba(0, 135, 121, 0.25); font-size: 0.82rem; padding: 0.45rem 1rem;">
              ${Icons.check(15, '#FFFFFF')}
              <span>Registrar Devolución</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderHistorySection() {
    return `
      <div class="soft-card" style="padding: 0; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; overflow: hidden; box-shadow: 0 2px 10px rgba(107, 70, 193, 0.03);">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem;">
            <thead>
              <tr style="background: #F8F7FC; border-bottom: 1px solid var(--soft-border-card-inner, #E2DCF0); color: var(--brand-navy); font-weight: 700; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em;">
                <th style="padding: 1rem 1.25rem;">Préstamo #</th>
                <th style="padding: 1rem 1.25rem;">Batería Psicométrica</th>
                <th style="padding: 1rem 1.25rem;">Especialista Solicitante</th>
                <th style="padding: 1rem 1.25rem;">Consultorio</th>
                <th style="padding: 1rem 1.25rem;">Salida & Devolución Estimada</th>
                <th style="padding: 1rem 1.25rem;">Estado</th>
                <th style="padding: 1rem 1.25rem;">Condición Recepción</th>
              </tr>
            </thead>
            <tbody>
              ${this.loans.length === 0 ? `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-secondary);">
                    <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto 0.75rem;">
                      ${Icons.package(24, 'var(--soft-purple-primary)')}
                    </div>
                    <p style="font-weight: 600; font-size: 0.95rem; margin: 0; color: var(--brand-navy);">No hay registros de préstamos clínicos previos</p>
                    <p style="font-size: 0.82rem; margin-top: 0.25rem;">Los préstamos y devoluciones de pruebas psicométricas se registrarán en esta tabla.</p>
                  </td>
                </tr>
              ` : this.loans.map(loan => {
                const isActivo = loan.estado === 'ACTIVO';
                const isDevuelto = loan.estado === 'DEVUELTO';

                return `
                  <tr style="border-bottom: 1px solid var(--soft-divider, #EAE5F5); transition: background 0.15s ease;" onmouseover="this.style.background='#FAF9FD'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 1rem 1.25rem; font-weight: 700; color: var(--brand-navy);">
                      #${loan.id}
                    </td>

                    <td style="padding: 1rem 1.25rem;">
                      <div style="font-weight: 700; color: var(--brand-navy);">${this.escapeHtml(loan.bateria_nombre)}</div>
                      <div style="font-size: 0.75rem; color: var(--soft-purple-primary); font-family: monospace;">${this.escapeHtml(loan.bateria_codigo)}</div>
                    </td>

                    <td style="padding: 1rem 1.25rem;">
                      <div style="font-weight: 600; color: var(--brand-navy);">${this.escapeHtml(loan.terapeuta_nombre)}</div>
                      <div style="font-size: 0.75rem; color: var(--text-secondary);">${this.escapeHtml(loan.terapeuta_especialidad || 'Especialista')}</div>
                    </td>

                    <td style="padding: 1rem 1.25rem;">
                      <span class="soft-badge" style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); color: var(--brand-navy); font-size: 0.78rem;">
                        ${this.escapeHtml(loan.sala_nombre || 'Consultorio General')}
                      </span>
                    </td>

                    <td style="padding: 1rem 1.25rem; font-size: 0.82rem;">
                      <div>Salida: <strong>${this.formatDateTime(loan.fecha_prestamo)}</strong></div>
                      <div style="color: var(--text-secondary); margin-top: 0.15rem;">Retorno estimado: ${this.formatDateTime(loan.fecha_devolucion_esperada)}</div>
                    </td>

                    <td style="padding: 1rem 1.25rem;">
                      ${isActivo ? `
                        <span class="soft-badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem;">
                          ${Icons.clock(13, '#B45309')} En Consulta
                        </span>
                      ` : `
                        <span class="soft-badge soft-badge-mint" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem;">
                          ${Icons.checkCircle(13, 'var(--soft-mint-deep)')} Devuelto
                        </span>
                      `}
                    </td>

                    <td style="padding: 1rem 1.25rem; font-size: 0.82rem;">
                      ${isDevuelto ? `
                        <span style="font-weight: 700; color: ${loan.condicion_devolucion === 'EXCELENTE' ? 'var(--soft-emerald-dark)' : '#B45309'};">
                          ${this.escapeHtml(loan.condicion_devolucion || 'VERIFICADO')}
                        </span>
                        <div style="font-size: 0.74rem; color: var(--text-secondary); margin-top: 0.15rem;">
                          Recep: ${this.escapeHtml(loan.registrado_por_nombre || 'Recepción')}
                        </div>
                      ` : `
                        <span style="color: var(--text-secondary); font-style: italic;">En uso activo</span>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  attachEvents(canManageLoans) {
    document.getElementById('tab-catalog')?.addEventListener('click', () => {
      this.activeTab = 'catalog';
      this.renderContent();
    });
    document.getElementById('tab-history')?.addEventListener('click', () => {
      this.activeTab = 'history';
      this.renderContent();
    });

    if (canManageLoans) {
      document.getElementById('btn-create-battery')?.addEventListener('click', () => {
        this.openBatteryModal();
      });

      document.querySelectorAll('.btn-edit-battery').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const batId = Number(e.currentTarget.getAttribute('data-battery-id'));
          const battery = this.batteries.find(b => Number(b.id) === batId);
          if (battery) {
            this.openBatteryModal(battery);
          }
        });
      });
    }

    document.getElementById('btn-open-loan-modal')?.addEventListener('click', () => {
      this.openLoanModal();
    });

    document.querySelectorAll('.btn-loan-specific').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const batId = e.currentTarget.getAttribute('data-battery-id');
        this.openLoanModal(batId);
      });
    });

    document.querySelectorAll('.btn-return-specific').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const loanId = e.currentTarget.getAttribute('data-loan-id');
        const batName = e.currentTarget.getAttribute('data-battery-name');
        this.openReturnModal(loanId, batName);
      });
    });

    document.querySelectorAll('.btn-usage-details').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const batId = Number(e.currentTarget.getAttribute('data-battery-id'));
        const battery = this.batteries.find(b => Number(b.id) === batId);
        if (battery) {
          this.openUsageDetailsModal(battery);
        }
      });
    });
  }

  // =========================================================================
  // MODAL DE DETALLES DE CUSTODIA Y USO CLÍNICO ("DE QUÉ HORA A QUÉ HORA")
  // =========================================================================
  openUsageDetailsModal(battery) {
    const activeTherapist = (battery.terapeuta_nombres ? `${battery.terapeuta_nombres} ${battery.terapeuta_apellidos || ''}`.trim() : null)
      || battery.prestamo_actual?.terapeuta_nombre
      || 'Especialista Clínico';
    const activeSpec = battery.terapeuta_especialidad || battery.prestamo_actual?.terapeuta_especialidad || 'Especialista en Evaluación';
    const activeRoom = (battery.ambiente_nombre ? `${battery.ambiente_nombre}${battery.ambiente_codigo ? ` (${battery.ambiente_codigo})` : ''}` : null)
      || battery.prestamo_actual?.sala_nombre
      || 'Consultorio de Evaluación';
    const activeTimeRange = this.formatLoanTimeDetail(
      battery.prestamo_fecha_retiro || battery.prestamo_actual?.fecha_prestamo,
      battery.prestamo_devolucion_estimada || battery.prestamo_actual?.fecha_devolucion_esperada
    );
    const fechaRetiro = this.formatDateTime(battery.prestamo_fecha_retiro || battery.prestamo_actual?.fecha_prestamo);
    const fechaEstimada = this.formatDateTime(battery.prestamo_devolucion_estimada || battery.prestamo_actual?.fecha_devolucion_esperada);
    const loanNotes = battery.prestamo_observaciones || battery.prestamo_actual?.observaciones;
    const activeLoanId = battery.prestamo_activo_id || battery.prestamo_actual?.id;

    const user = store.getState().user;
    const canManageLoans = ['ADMIN', 'RECEPCION'].includes(user?.rol);

    const modalContainer = document.getElementById('modal-container-battery');
    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
            <div>
              <span class="soft-badge" style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); color: var(--soft-purple-primary); font-family: monospace; font-weight: 700; font-size: 0.78rem;">
                ${this.escapeHtml(battery.codigo_patrimonial || battery.codigo)}
              </span>
              <h3 style="margin: 0.35rem 0 0; font-size: 1.12rem; font-weight: 700; color: var(--brand-navy); line-height: 1.35;">
                ${this.escapeHtml(battery.nombre)}
              </h3>
            </div>
            <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2" style="padding: 0.35rem 0.65rem;">${Icons.close(16)}</button>
          </div>

          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
            <div style="display: flex; align-items: center; gap: 0.45rem; font-weight: 700; color: #92400E; font-size: 0.88rem; margin-bottom: 0.85rem;">
              ${Icons.clock(16, '#B45309')}
              <span>Custodia Activa en Consulta Clínica</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem; font-size: 0.84rem;">
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: #78350F; font-weight: 700;">Especialista a Cargo:</span>
                <span style="color: #451A03; font-weight: 700; font-size: 0.92rem; margin-top: 0.1rem;">${this.escapeHtml(activeTherapist)}</span>
                <span style="color: #92400E; font-size: 0.78rem;">${this.escapeHtml(activeSpec)}</span>
              </div>

              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: #78350F; font-weight: 700;">Consultorio / Ambiente de Destino:</span>
                <span style="color: #451A03; font-weight: 700; font-size: 0.88rem; margin-top: 0.1rem;">${this.escapeHtml(activeRoom)}</span>
              </div>

              <div style="display: flex; flex-direction: column; background: rgba(255, 255, 255, 0.8); border: 1px solid #FDE68A; border-radius: 8px; padding: 0.65rem 0.8rem;">
                <span style="font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: #78350F; font-weight: 700;">Horario de Utilización:</span>
                <strong style="color: #92400E; font-size: 0.92rem; margin-top: 0.1rem;">${this.escapeHtml(activeTimeRange)}</strong>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #78350F; margin-top: 0.4rem; border-top: 1px dashed #FDE68A; padding-top: 0.35rem;">
                  <span>Salida: <strong>${fechaRetiro}</strong></span>
                  <span>Retorno límite: <strong>${fechaEstimada}</strong></span>
                </div>
              </div>

              ${loanNotes ? `
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.04em; color: #78350F; font-weight: 700;">Notas de Custodia / Entrega:</span>
                  <span style="color: #78350F; font-style: italic; margin-top: 0.1rem;">"${this.escapeHtml(loanNotes)}"</span>
                </div>
              ` : ''}
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1.25rem;">
            <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2">Cerrar</button>
            ${canManageLoans && activeLoanId ? `
              <button type="button" id="btn-modal-return-direct" class="soft-btn soft-btn-lvl-1" style="background: var(--soft-mint-deep); box-shadow: 0 4px 14px rgba(0, 135, 121, 0.3);">
                ${Icons.check(16, '#FFFFFF')}
                <span>Registrar Devolución</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });

    if (canManageLoans && activeLoanId) {
      document.getElementById('btn-modal-return-direct')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
        this.openReturnModal(activeLoanId, battery.nombre);
      });
    }
  }

  // =========================================================================
  // MODAL DE REGISTRO Y EDICIÓN DE BATERÍA PSICOMÉTRICA CON SUBIDA DE FOTO/DOC
  // =========================================================================
  openBatteryModal(battery = null) {
    const isEdit = Boolean(battery && battery.id);
    const modalContainer = document.getElementById('modal-container-battery');

    let currentImageUrl = isEdit ? (battery.imagen_url || '') : '';

    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 640px; max-height: 90vh; overflow-y: auto; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--brand-navy); display: flex; align-items: center; gap: 0.5rem;">
              ${Icons.package(20, 'var(--soft-purple-primary)')}
              <span>${isEdit ? 'Editar Instrumento Psicométrico' : 'Registrar Batería en Inventario'}</span>
            </h3>
            <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2" style="padding: 0.35rem 0.65rem;">${Icons.close(16)}</button>
          </div>

          <form id="form-save-battery">
            <!-- CÓDIGO Y NOMBRE -->
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Código Patrimonial *</label>
                <input type="text" id="bat-codigo" class="form-input" required placeholder="Ej: BAT-WISC5-01" value="${this.escapeHtml(isEdit ? (battery.codigo_patrimonial || battery.codigo) : '')}" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Nombre del Instrumento *</label>
                <input type="text" id="bat-nombre" class="form-input" required placeholder="Ej: WISC-V: Escala de Inteligencia" value="${this.escapeHtml(isEdit ? battery.nombre : '')}" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;" />
              </div>
            </div>

            <!-- ÁREA EVALUADA Y EDITORIAL -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Área Evaluada</label>
                <input type="text" id="bat-area" class="form-input" placeholder="Ej: Funciones Ejecutivas / Cognición" value="${this.escapeHtml(isEdit ? (battery.area_evaluada || battery.categoria || '') : '')}" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Editorial / Edición</label>
                <input type="text" id="bat-editorial" class="form-input" placeholder="Ej: Pearson Clinical / TEA" value="${this.escapeHtml(isEdit ? (battery.editorial || '') : '')}" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;" />
              </div>
            </div>

            <!-- ESTADO OPERATIVO (DISPONIBILIDAD) Y ESTADO FÍSICO (CONSERVACIÓN) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Estado Operativo / Disponibilidad</label>
                <select id="bat-disponibilidad" class="form-input" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                  <option value="DISPONIBLE" ${(isEdit ? (battery.estado_disponibilidad || battery.estado) : '') === 'DISPONIBLE' ? 'selected' : ''}>DISPONIBLE (Listo en Gabinete)</option>
                  <option value="EN_CONSULTA" ${(isEdit ? (battery.estado_disponibilidad || battery.estado) : '') === 'EN_CONSULTA' ? 'selected' : ''}>EN CONSULTA (En uso en sala)</option>
                  <option value="EN_MANTENIMIENTO" ${(isEdit ? (battery.estado_disponibilidad || battery.estado) : '') === 'EN_MANTENIMIENTO' ? 'selected' : ''}>EN MANTENIMIENTO (Revisión técnica)</option>
                  <option value="EN_DESUSO" ${(isEdit ? (battery.estado_disponibilidad || battery.estado) : '') === 'EN_DESUSO' ? 'selected' : ''}>EN DESUSO (Baja de circulación)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Estado Físico de Conservación</label>
                <select id="bat-conservacion" class="form-input" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                  <option value="EXCELENTE" ${(isEdit ? battery.estado_conservacion : '') === 'EXCELENTE' ? 'selected' : ''}>EXCELENTE (Íntegro, sin desgaste)</option>
                  <option value="BUENO" ${(isEdit ? battery.estado_conservacion : 'BUENO') === 'BUENO' ? 'selected' : ''}>BUENO (Uso normal en sesión)</option>
                  <option value="REGULAR" ${(isEdit ? battery.estado_conservacion : '') === 'REGULAR' ? 'selected' : ''}>REGULAR (Desgaste notorio)</option>
                  <option value="DETERIORADO" ${(isEdit ? battery.estado_conservacion : '') === 'DETERIORADO' ? 'selected' : ''}>DETERIORADO (Requiere reposición)</option>
                </select>
              </div>
            </div>

            <!-- UBICACIÓN EN GABINETE -->
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Ubicación Física en Centro</label>
              <input type="text" id="bat-ubicacion" class="form-input" placeholder="Ej: Gabinete Psicométrico A-02 / Estante 3" value="${this.escapeHtml(isEdit ? (battery.ubicacion || 'Gabinete General') : 'Gabinete General')}" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;" />
            </div>

            <!-- INVENTARIO DE PIEZAS Y COMPONENTES -->
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Detalle de Piezas, Cuadernillos y Componentes</label>
              <textarea id="bat-piezas" class="form-input" rows="3" placeholder="Ej: 1 Manual de aplicación, 2 Cuadernillos de estímulo, 9 Cubos bicolores, 1 Plantilla de corrección..." style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box; resize: vertical;">${this.escapeHtml(isEdit ? (battery.piezas_detalle || '') : '')}</textarea>
            </div>

            <!-- SUBIDA DE FOTO O DOCUMENTO DE REFERENCIA ESCANEADO -->
            <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 12px; padding: 1.15rem; margin-bottom: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                <label style="font-size: 0.84rem; font-weight: 700; color: var(--brand-navy); display: flex; align-items: center; gap: 0.4rem;">
                  ${Icons.fileText(16, 'var(--soft-purple-primary)')}
                  <span>Foto de Referencia o Ficha Escaneada (Opcional)</span>
                </label>
                <input type="file" id="file-battery-upload" accept="image/jpeg,image/png,image/webp,application/pdf" style="display: none;" />
                <button type="button" id="btn-trigger-upload" class="soft-btn soft-btn-lvl-2" style="font-size: 0.8rem; padding: 0.35rem 0.85rem;">
                  ${Icons.upload(14, 'currentColor')}
                  <span>Subir Archivo</span>
                </button>
              </div>

              <!-- PREVISUALIZACIÓN DEL ARCHIVO ADJUNTO -->
              <div id="preview-battery-container" style="text-align: center; font-size: 0.82rem; color: var(--text-secondary);">
                ${currentImageUrl ? this.renderUploadPreviewHtml(currentImageUrl) : `
                  <div style="padding: 1rem; border: 1px dashed var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; background: #FFFFFF;">
                    No hay imagen ni documento adjunto actualmente. Formatos admitidos: JPG, PNG, WEBP o PDF escaneado (máx. 15MB).
                  </div>
                `}
              </div>
              <input type="hidden" id="bat-imagen-url" value="${this.escapeHtml(currentImageUrl)}" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1.25rem;">
              <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2">Cancelar</button>
              <button type="submit" id="btn-submit-battery" class="soft-btn soft-btn-lvl-1">
                ${Icons.check(16, '#FFFFFF')}
                <span>${isEdit ? 'Guardar Cambios' : 'Registrar Batería'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });

    const fileInput = document.getElementById('file-battery-upload');
    const triggerUploadBtn = document.getElementById('btn-trigger-upload');
    const previewContainer = document.getElementById('preview-battery-container');
    const hiddenUrlInput = document.getElementById('bat-imagen-url');

    triggerUploadBtn.addEventListener('click', () => fileInput.click());

    // Al seleccionar archivo, subirlo inmediatamente al endpoint /inventory/upload-image
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      previewContainer.innerHTML = `
        <div style="padding: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: var(--soft-purple-primary);">
          <div style="display: inline-flex; animation: spin 1s linear infinite;">${Icons.pulse(16, 'currentColor')}</div>
          <span>Subiendo archivo al servidor...</span>
        </div>
      `;

      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.upload('/inventory/upload-image', formData);

        if (res.success && res.url) {
          hiddenUrlInput.value = res.url;
          currentImageUrl = res.url;
          previewContainer.innerHTML = this.renderUploadPreviewHtml(res.url);
          this.bindPreviewActions(previewContainer, hiddenUrlInput);
          Toast.success('Archivo de referencia subido exitosamente.');
        } else {
          throw new Error(res.message || 'Error al subir archivo');
        }
      } catch (err) {
        console.error('Error al subir imagen de batería:', err);
        Toast.error(err.message || 'No se pudo subir el archivo.');
        previewContainer.innerHTML = hiddenUrlInput.value ? this.renderUploadPreviewHtml(hiddenUrlInput.value) : `
          <div style="padding: 1rem; border: 1px dashed var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; background: #FFFFFF; color: #DC2626;">
            Error en la subida. Intente con otro archivo.
          </div>
        `;
      }
    });

    this.bindPreviewActions(previewContainer, hiddenUrlInput);

    // Envío del formulario (Creación o Edición)
    const form = document.getElementById('form-save-battery');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const codigo_patrimonial = document.getElementById('bat-codigo').value.trim();
      const nombre = document.getElementById('bat-nombre').value.trim();
      const area_evaluada = document.getElementById('bat-area').value.trim();
      const editorial = document.getElementById('bat-editorial').value.trim();
      const estado_disponibilidad = document.getElementById('bat-disponibilidad').value;
      const estado_conservacion = document.getElementById('bat-conservacion').value;
      const ubicacion = document.getElementById('bat-ubicacion').value.trim();
      const piezas_detalle = document.getElementById('bat-piezas').value.trim();
      const imagen_url = hiddenUrlInput.value.trim() || null;

      if (!codigo_patrimonial || !nombre) {
        Toast.error('El código patrimonial y el nombre son obligatorios.');
        return;
      }

      const payload = {
        codigo_patrimonial,
        nombre,
        area_evaluada,
        editorial,
        estado_disponibilidad,
        estado_conservacion,
        ubicacion,
        piezas_detalle,
        imagen_url
      };

      const submitBtn = document.getElementById('btn-submit-battery');
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.6';

      try {
        if (isEdit) {
          await apiClient.put(`/inventory/${battery.id}`, payload);
          Toast.success('¡Instrumento psicométrico actualizado con éxito!');
        } else {
          await apiClient.post('/inventory', payload);
          Toast.success('¡Batería psicométrica registrada exitosamente en el inventario!');
        }

        modalContainer.innerHTML = '';
        await this.loadData();
        this.renderContent();
      } catch (err) {
        console.error('Error al guardar batería:', err);
        Toast.error(err.message || 'Error al guardar la batería en inventario.');
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }
    });
  }

  renderUploadPreviewHtml(url) {
    const isPdf = url.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px;">
          <a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--soft-purple-primary); font-weight: 600;">
            ${Icons.filePdf(20, '#DC2626')}
            <span>Documento PDF Adjunto (Ver en nueva pestaña)</span>
          </a>
          <button type="button" class="btn-remove-attachment soft-btn soft-btn-lvl-2" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; color: #DC2626;">Quitar</button>
        </div>
      `;
    }
    return `
      <div style="position: relative; display: inline-block; max-width: 100%; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; overflow: hidden; background: #FFFFFF;">
        <img src="${this.escapeHtml(url)}" alt="Referencia" style="max-height: 150px; max-width: 100%; object-fit: contain; display: block;" />
        <button type="button" class="btn-remove-attachment soft-btn soft-btn-lvl-2" style="position: absolute; top: 6px; right: 6px; background: rgba(255,255,255,0.92); font-size: 0.75rem; padding: 0.25rem 0.55rem; color: #DC2626;">Quitar</button>
      </div>
    `;
  }

  bindPreviewActions(previewContainer, hiddenUrlInput) {
    previewContainer.querySelector('.btn-remove-attachment')?.addEventListener('click', () => {
      hiddenUrlInput.value = '';
      previewContainer.innerHTML = `
        <div style="padding: 1rem; border: 1px dashed var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; background: #FFFFFF;">
          Archivo eliminado. Formatos admitidos: JPG, PNG, WEBP o PDF escaneado.
        </div>
      `;
    });
  }

  // =========================================================================
  // MODAL DE PRÉSTAMO CON VERIFICACIÓN Y BLOQUEO RN-06
  // =========================================================================
  openLoanModal(preselectedBatteryId = null) {
    const availableBatteries = this.batteries.filter(b => (b.estado_disponibilidad || b.estado) === 'DISPONIBLE' || String(b.id) === String(preselectedBatteryId));

    if (availableBatteries.length === 0) {
      Toast.info('No hay baterías psicométricas disponibles para préstamo en este momento.');
      return;
    }

    const modalContainer = document.getElementById('modal-container-battery');
    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--brand-navy); display: flex; align-items: center; gap: 0.5rem;">
              ${Icons.package(20, 'var(--soft-purple-primary)')}
              <span>Préstamo de Batería a Consultorio</span>
            </h3>
            <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2" style="padding: 0.35rem 0.65rem;">${Icons.close(16)}</button>
          </div>

          <form id="form-create-loan">
            <!-- SELECCIÓN DE BATERÍA -->
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Instrumento / Batería Psicométrica:</label>
              <select id="loan-battery-id" class="form-input" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                <option value="">Seleccione una batería disponible...</option>
                ${availableBatteries.map(b => `
                  <option value="${b.id}" ${String(b.id) === String(preselectedBatteryId) ? 'selected' : ''}>
                    ${this.escapeHtml(b.nombre)} (${this.escapeHtml(b.codigo_patrimonial || b.codigo)})
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- SELECCIÓN DE ESPECIALISTA (NOMBRE COMPLETO Y ESPECIALIDAD CORREGIDOS) -->
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Especialista Solicitante en Consultorio:</label>
              <select id="loan-therapist-id" class="form-input" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                <option value="">Seleccione un terapeuta para verificar custodia bioética...</option>
                ${this.therapists.map(t => {
                  const fullName = t.nombre_completo || `${t.nombres || ''} ${t.apellidos || ''}`.trim() || t.nombre || `Terapeuta #${t.id}`;
                  const spec = t.especialidad_nombre || t.especialidad || 'Especialista';
                  return `
                    <option value="${t.id}">
                      ${this.escapeHtml(fullName)} (${this.escapeHtml(spec)})
                    </option>
                  `;
                }).join('')}
              </select>
            </div>

            <!-- CONTENEDOR DEL ESTADO RN-06 (Alerta o Aprobado) -->
            <div id="rn06-status-container" style="margin-bottom: 1rem;"></div>

            <!-- CONSULTORIO / SALA -->
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Consultorio / Gabinete de Destino:</label>
              <select id="loan-room-id" class="form-input" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                <option value="">Gabinete de Evaluación General</option>
                ${this.rooms.map(r => `
                  <option value="${r.id}">
                    ${this.escapeHtml(r.nombre)} (Capacidad: ${r.capacidad})
                  </option>
                `).join('')}
              </select>
            </div>

            <!-- TIEMPO ESTIMADO DE DEVOLUCIÓN -->
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Plazo Máximo de Retorno a Gabinete:</label>
              <select id="loan-duration-hours" class="form-input" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                <option value="2">2 Horas (Sesión de Evaluación Estándar)</option>
                <option value="4">4 Horas (Batería Completa Turno Mañana/Tarde)</option>
                <option value="8">8 Horas (Fin de Jornada Clínica)</option>
              </select>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1.25rem;">
              <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2">Cancelar</button>
              <button type="submit" id="btn-submit-loan" class="soft-btn soft-btn-lvl-1">
                ${Icons.check(16, '#FFFFFF')}
                <span>Autorizar Salida de Batería</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });

    const therapistSelect = document.getElementById('loan-therapist-id');
    const rn06Container = document.getElementById('rn06-status-container');
    const submitBtn = document.getElementById('btn-submit-loan');

    therapistSelect.addEventListener('change', async (e) => {
      const therapistId = e.target.value;
      if (!therapistId) {
        rn06Container.innerHTML = '';
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        return;
      }

      rn06Container.innerHTML = `
        <div style="font-size: 0.82rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.5rem;">
          <div style="display: inline-flex; animation: spin 1s linear infinite;">${Icons.pulse(15, 'var(--soft-purple-primary)')}</div>
          <span>Verificando historial de custodia bioética RN-06...</span>
        </div>
      `;

      try {
        const res = await apiClient.get(`/inventory/therapist-status/${therapistId}`);
        const status = res.data;
        const isBlocked = status.hasOverdueLoan || status.hasOverdue || status.bloqueado || !status.canBorrow;

        if (isBlocked) {
          // BLOQUEO BIOÉTICO RN-06
          const overdueItem = status.overdueLoans?.[0];
          const overdueName = overdueItem ? (overdueItem.bateria_nombre || overdueItem.nombre) : 'Material psicométrico anterior';
          const overdueDate = overdueItem ? this.formatDateTime(overdueItem.fecha_devolucion_estimada || overdueItem.fecha_devolucion_esperada) : 'Vencido';

          rn06Container.innerHTML = `
            <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 1rem; color: #991B1B;">
              <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
                <span style="color: #DC2626; flex-shrink: 0;">${Icons.alertTriangle(22, '#DC2626')}</span>
                <div>
                  <strong style="color: #991B1B; display: block; font-size: 0.88rem; margin-bottom: 0.2rem;">
                    BLOQUEO BIOÉTICO RN-06 ACTIVO
                  </strong>
                  <p style="margin: 0; color: #7F1D1D; font-size: 0.82rem; line-height: 1.45;">
                    El especialista seleccionado presenta material clínico en mora sin devolución:
                    <strong>${this.escapeHtml(overdueName)}</strong> (vencido el ${overdueDate}).
                    Conforme al protocolo de bioética RN-06, <strong>no se autoriza la entrega de nuevo material</strong> hasta que se regularice la entrega del instrumento pendiente.
                  </p>
                </div>
              </div>
            </div>
          `;
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
        } else {
          // HABILITADO
          rn06Container.innerHTML = `
            <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 0.75rem 1rem; color: #166534; font-size: 0.82rem; display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: var(--soft-mint-deep);">${Icons.checkCircle(16, 'var(--soft-mint-deep)')}</span>
              <span><strong>Custodia Bioética RN-06 Conforme:</strong> Especialista al día y autorizado para el préstamo de pruebas.</span>
            </div>
          `;
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
        }
      } catch (err) {
        console.warn('Error al chequear RN-06:', err);
        rn06Container.innerHTML = '';
        submitBtn.disabled = false;
      }
    });

    const form = document.getElementById('form-create-loan');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const batteryId = document.getElementById('loan-battery-id').value;
      const therapistId = document.getElementById('loan-therapist-id').value;
      const roomId = document.getElementById('loan-room-id').value || null;
      const durationHours = Number(document.getElementById('loan-duration-hours').value) || 2;

      const loanSubmitBtn = document.getElementById('btn-submit-loan');
      if (loanSubmitBtn) loanSubmitBtn.disabled = true;

      try {
        await apiClient.post('/inventory/loan', {
          bateria_id: Number(batteryId),
          terapeuta_id: Number(therapistId),
          ambiente_id: roomId ? Number(roomId) : null,
          duracion_horas: durationHours
        });

        Toast.success('¡Préstamo de batería registrado y autorizado exitosamente!');
        modalContainer.innerHTML = '';
        await this.loadData();
        this.renderContent();
      } catch (err) {
        if (loanSubmitBtn) loanSubmitBtn.disabled = false;
        Toast.error(err.message || 'Error al autorizar el préstamo de batería');
      }
    });
  }

  // =========================================================================
  // MODAL DE DEVOLUCIÓN DE BATERÍA CON CHECKLIST DE INTEGRIDAD DE PIEZAS
  // =========================================================================
  openReturnModal(loanId, batteryName) {
    const modalContainer = document.getElementById('modal-container-battery');
    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--brand-navy); display: flex; align-items: center; gap: 0.5rem;">
              ${Icons.clipboardList(20, 'var(--soft-mint-deep)')}
              <span>Recepción y Devolución de Batería</span>
            </h3>
            <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2" style="padding: 0.35rem 0.65rem;">${Icons.close(16)}</button>
          </div>

          <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem; font-size: 0.86rem;">
            <div><strong>Instrumento a Recepcionar:</strong> <span style="color: var(--brand-navy); font-weight: 700;">${this.escapeHtml(batteryName)}</span></div>
            <div style="color: var(--text-secondary); margin-top: 0.25rem;">N° Registro de Préstamo: #${loanId}</div>
          </div>

          <form id="form-return-battery">
            <!-- CHECKLIST DE INTEGRIDAD DE PIEZAS -->
            <div style="margin-bottom: 1.25rem;">
              <strong style="color: var(--brand-navy); font-size: 0.85rem; display: block; margin-bottom: 0.65rem;">
                Checklist de Integridad y Custodia Bioética:
              </strong>

              <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.84rem; color: var(--brand-navy);">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <input type="checkbox" id="chk-manual" checked required style="accent-color: var(--brand-purple);" />
                  <span>Manuales de aplicación y cuadernillos de estímulo completos</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <input type="checkbox" id="chk-cubos" checked required style="accent-color: var(--brand-purple);" />
                  <span>Material manipulativo, plantillas y cubos completos según inventario</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                  <input type="checkbox" id="chk-protocolos" checked required style="accent-color: var(--brand-purple);" />
                  <span>Protocolos de registro devueltos y resguardados en expediente</span>
                </label>
              </div>
            </div>

            <!-- CONDICIÓN DEL MATERIAL -->
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Estado de Conservación al Retornar:</label>
              <select id="return-condition" class="form-input" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;">
                <option value="EXCELENTE">Excelente (Material íntegro y sin marcas)</option>
                <option value="BUENO">Bueno (Desgaste natural propio de la sesión)</option>
                <option value="REGULAR">Regular (Desgaste notorio / requiere revisión)</option>
                <option value="DETERIORADO">Deteriorado (Requiere reparación o reposición)</option>
              </select>
            </div>

            <!-- OBSERVACIONES -->
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600; display: block; margin-bottom: 0.35rem;">Notas de Custodia / Devolución (Opcional):</label>
              <input type="text" id="return-notes" class="form-input" placeholder="Ej: Material verificado conforme en recepción" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1.25rem;">
              <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2">Cancelar</button>
              <button type="submit" class="soft-btn soft-btn-lvl-1" style="background: var(--soft-mint-deep); box-shadow: 0 4px 14px rgba(0, 135, 121, 0.3);">
                ${Icons.check(16, '#FFFFFF')}
                <span>Registrar Devolución y Liberar Batería</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });

    const form = document.getElementById('form-return-battery');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const condition = document.getElementById('return-condition').value;
      const notes = document.getElementById('return-notes').value.trim();

      const returnSubmitBtn = form.querySelector('button[type="submit"]');
      if (returnSubmitBtn) returnSubmitBtn.disabled = true;

      try {
        await apiClient.post(`/inventory/return/${loanId}`, {
          condicion: condition,
          estado_conservacion: condition,
          observaciones: notes,
          observaciones_recepcion: notes
        });

        Toast.success('¡Batería recepcionada exitosamente! Instrumento nuevamente disponible en gabinete.');
        modalContainer.innerHTML = '';
        await this.loadData();
        this.renderContent();
      } catch (err) {
        if (returnSubmitBtn) returnSubmitBtn.disabled = false;
        Toast.error(err.message || 'Error al recepcionar la batería');
      }
    });
  }
}
