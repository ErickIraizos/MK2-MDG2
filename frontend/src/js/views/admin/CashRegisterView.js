import ExcelJS from 'exceljs';
import { apiClient } from '../../api/apiClient.js';
import { Toast } from '../../components/Toast.js';
import { Icons } from '../../components/Icons.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';
import { store } from '../../store.js';
import { printIsolatedDocument } from '../../utils/printHelper.js';

export class CashRegisterView {
  constructor(container) {
    this.container = container;
    this.payments = [];
    this.summary = { totalRecaudado: 0, totalQr: 0, totalEfectivo: 0, totalPendiente: 0, totalEnRevision: 0, totalAprobadosCount: 0 };
    this.therapists = [];
    this.qrConfig = null;
    this.currentFilterTherapist = 'ALL';
    this.currentFilterStatus = 'ALL';
    this.currentFilterDate = 'ALL';
    this.currentFilterMethod = 'ALL';

    // Estado del Filtro Temporal Superior (Por Día, Semana, Mes, Año o Todo)
    this.periodMode = 'ALL'; // 'ALL' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
    this.selectedDate = new Date(); // Para modo Día
    this.selectedWeekDate = new Date(); // Fecha ancla para modo Semana
    this.selectedMonth = new Date().getMonth(); // 0-11 para modo Mes
    this.selectedYear = new Date().getFullYear(); // YYYY para modo Mes y Año

    const hash = window.location.hash || '';
    if (hash.includes('tab=my_config') || hash.includes('tab=config')) {
      this.activeTab = 'my_config';
    } else {
      this.activeTab = 'transactions'; // 'transactions' | 'qr_config' | 'my_config'
    }
    this.therapistConfig = null;
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

  formatMoney(amount) {
    const num = Number(amount) || 0;
    return `Bs. ${num.toFixed(2)}`;
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

  getPaymentDate(p) {
    const raw = p.cita_fecha_hora || p.cita_fecha || p.fecha_pago || p.created_at || p.fecha_creacion;
    if (!raw) return null;
    if (typeof raw === 'string') {
      if (raw.length === 10 && raw.includes('-')) {
        const [y, m, d] = raw.split('-').map(Number);
        return new Date(y, m - 1, d, 12, 0, 0);
      }
      if (raw.includes(' ') && !raw.includes('T')) {
        return new Date(raw.replace(' ', 'T'));
      }
    }
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  getPeriodRangeAndLabel() {
    const MONTH_NAMES = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    if (this.periodMode === 'DAY') {
      const d = new Date(this.selectedDate);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const dayName = d.toLocaleDateString('es-BO', { weekday: 'long' });
      const capDay = dayName ? (dayName.charAt(0).toUpperCase() + dayName.slice(1)) : 'Día';
      const label = `${capDay}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
      const shortLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      const slug = `Dia_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { start, end, label, shortLabel, slug };
    }

    if (this.periodMode === 'WEEK') {
      const anchor = new Date(this.selectedWeekDate);
      const dayOfWeek = anchor.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + diffToMonday, 0, 0, 0, 0);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

      const monMonth = MONTH_NAMES[monday.getMonth()].slice(0, 3);
      const sunMonth = MONTH_NAMES[sunday.getMonth()].slice(0, 3);
      const label = `Semana: ${monday.getDate()} ${monMonth} - ${sunday.getDate()} ${sunMonth} ${sunday.getFullYear()}`;
      const shortLabel = `${monday.getDate()} ${monMonth} - ${sunday.getDate()} ${sunMonth} ${sunday.getFullYear()}`;
      const slug = `Semana_${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}_al_${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
      return { start: monday, end: sunday, label, shortLabel, slug };
    }

    if (this.periodMode === 'MONTH') {
      const y = this.selectedYear;
      const m = this.selectedMonth;
      const start = new Date(y, m, 1, 0, 0, 0, 0);
      const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
      const label = `Mes de ${MONTH_NAMES[m]} de ${y}`;
      const shortLabel = `${MONTH_NAMES[m]} ${y}`;
      const slug = `Mes_${MONTH_NAMES[m]}_${y}`;
      return { start, end, label, shortLabel, slug };
    }

    if (this.periodMode === 'YEAR') {
      const y = this.selectedYear;
      const start = new Date(y, 0, 1, 0, 0, 0, 0);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      const label = `Gestión Anual ${y}`;
      const shortLabel = `Año ${y}`;
      const slug = `Gestion_${y}`;
      return { start, end, label, shortLabel, slug };
    }

    return {
      start: null,
      end: null,
      label: 'Histórico Total de Recaudaciones',
      shortLabel: 'Histórico Completo',
      slug: 'Historico_Total'
    };
  }

  navigatePeriod(direction) {
    if (this.periodMode === 'DAY') {
      const d = new Date(this.selectedDate);
      d.setDate(d.getDate() + direction);
      this.selectedDate = d;
    } else if (this.periodMode === 'WEEK') {
      const w = new Date(this.selectedWeekDate);
      w.setDate(w.getDate() + (direction * 7));
      this.selectedWeekDate = w;
    } else if (this.periodMode === 'MONTH') {
      let newMonth = this.selectedMonth + direction;
      if (newMonth < 0) {
        this.selectedMonth = 11;
        this.selectedYear -= 1;
      } else if (newMonth > 11) {
        this.selectedMonth = 0;
        this.selectedYear += 1;
      } else {
        this.selectedMonth = newMonth;
      }
    } else if (this.periodMode === 'YEAR') {
      this.selectedYear += direction;
    }
    this.renderContent();
  }

  renderPeriodFilterBar(periodInfo) {
    const MONTH_NAMES = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
    if (!years.includes(this.selectedYear)) {
      years.push(this.selectedYear);
      years.sort((a, b) => a - b);
    }

    const renderSubcontrols = () => {
      if (this.periodMode === 'DAY') {
        const d = this.selectedDate;
        const dateVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return `
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
            <button type="button" id="btn-period-prev" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.65rem; border-radius: 10px;" title="Día Anterior">
              ${Icons.chevronLeft(15, 'currentColor')}
            </button>
            <input type="date" id="input-period-day" value="${dateVal}" class="form-input" style="padding: 0.35rem 0.75rem; font-size: 0.84rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 10px; background: #FAF9FD; font-weight: 600; color: var(--brand-navy);" />
            <button type="button" id="btn-period-next" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.65rem; border-radius: 10px;" title="Día Siguiente">
              ${Icons.chevronRight(15, 'currentColor')}
            </button>
            <button type="button" id="btn-period-today" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.85rem; font-size: 0.82rem; border-radius: 10px; font-weight: 700;">
              Hoy
            </button>
            <span class="soft-badge soft-badge-lavender" style="font-size: 0.8rem; padding: 0.38rem 0.8rem; font-weight: 600;">
              ${this.escapeHtml(periodInfo.label)}
            </span>
          </div>
        `;
      }

      if (this.periodMode === 'WEEK') {
        return `
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
            <button type="button" id="btn-period-prev" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.65rem; border-radius: 10px;" title="Semana Anterior">
              ${Icons.chevronLeft(15, 'currentColor')}
            </button>
            <span class="soft-badge soft-badge-lavender" style="font-size: 0.82rem; padding: 0.4rem 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
              ${Icons.calendar(14, 'currentColor')}
              <span>${this.escapeHtml(periodInfo.label)}</span>
            </span>
            <button type="button" id="btn-period-next" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.65rem; border-radius: 10px;" title="Semana Siguiente">
              ${Icons.chevronRight(15, 'currentColor')}
            </button>
            <button type="button" id="btn-period-this-week" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.85rem; font-size: 0.82rem; border-radius: 10px; font-weight: 700;">
              Esta Semana
            </button>
          </div>
        `;
      }

      if (this.periodMode === 'MONTH') {
        return `
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
            <button type="button" id="btn-period-prev" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.65rem; border-radius: 10px;" title="Mes Anterior">
              ${Icons.chevronLeft(15, 'currentColor')}
            </button>
            <select id="select-period-month" class="form-input" style="padding: 0.38rem 0.75rem; font-size: 0.84rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 10px; background: #FAF9FD; font-weight: 600; color: var(--brand-navy);">
              ${MONTH_NAMES.map((name, idx) => `
                <option value="${idx}" ${this.selectedMonth === idx ? 'selected' : ''}>${name}</option>
              `).join('')}
            </select>
            <select id="select-period-year" class="form-input" style="padding: 0.38rem 0.75rem; font-size: 0.84rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 10px; background: #FAF9FD; font-weight: 600; color: var(--brand-navy);">
              ${years.map(y => `
                <option value="${y}" ${this.selectedYear === y ? 'selected' : ''}>${y}</option>
              `).join('')}
            </select>
            <button type="button" id="btn-period-next" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.65rem; border-radius: 10px;" title="Mes Siguiente">
              ${Icons.chevronRight(15, 'currentColor')}
            </button>
            <button type="button" id="btn-period-this-month" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.85rem; font-size: 0.82rem; border-radius: 10px; font-weight: 700;">
              Este Mes
            </button>
            <span class="soft-badge soft-badge-mint" style="font-size: 0.8rem; padding: 0.38rem 0.75rem; font-weight: 700;">
              ${this.escapeHtml(periodInfo.label)}
            </span>
          </div>
        `;
      }

      if (this.periodMode === 'YEAR') {
        return `
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
            <button type="button" id="btn-period-prev" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.65rem; border-radius: 10px;" title="Año Anterior">
              ${Icons.chevronLeft(15, 'currentColor')}
            </button>
            <select id="select-period-year-only" class="form-input" style="padding: 0.38rem 0.75rem; font-size: 0.84rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 10px; background: #FAF9FD; font-weight: 600; color: var(--brand-navy);">
              ${years.map(y => `
                <option value="${y}" ${this.selectedYear === y ? 'selected' : ''}>Gestión ${y}</option>
              `).join('')}
            </select>
            <button type="button" id="btn-period-next" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.65rem; border-radius: 10px;" title="Año Siguiente">
              ${Icons.chevronRight(15, 'currentColor')}
            </button>
            <button type="button" id="btn-period-this-year" class="soft-btn soft-btn-lvl-2-soft" style="padding: 0.38rem 0.85rem; font-size: 0.82rem; border-radius: 10px; font-weight: 700;">
              Este Año
            </button>
            <span class="soft-badge soft-badge-mint" style="font-size: 0.8rem; padding: 0.38rem 0.75rem; font-weight: 700;">
              ${this.escapeHtml(periodInfo.label)}
            </span>
          </div>
        `;
      }

      return `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="soft-badge soft-badge-lavender" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; padding: 0.4rem 0.85rem;">
            ${Icons.fileText(14, 'currentColor')}
            <span>Historial completo de cobros y sesiones clínicas</span>
          </span>
        </div>
      `;
    };

    return `
      <div class="soft-card" style="padding: 1rem 1.25rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.03); margin-bottom: 1.5rem;">
        <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 1rem;">
          <!-- Selector de Modo de Período -->
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;">
            <div style="display: inline-flex; align-items: center; gap: 0.45rem; font-weight: 700; font-size: 0.84rem; color: var(--brand-navy); margin-right: 0.25rem;">
              <div class="soft-icon-box soft-icon-box-lavender" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
                ${Icons.calendar(16, 'var(--soft-purple-primary)')}
              </div>
              <span>Período de Recaudación:</span>
            </div>

            <div class="soft-segmented-bar" style="padding: 0.25rem; gap: 0.25rem;">
              <button type="button" class="soft-btn soft-btn-sm btn-period-mode ${this.periodMode === 'ALL' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-mode="ALL" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; border-radius: 10px;">
                Todo
              </button>
              <button type="button" class="soft-btn soft-btn-sm btn-period-mode ${this.periodMode === 'DAY' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-mode="DAY" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; border-radius: 10px;">
                Día
              </button>
              <button type="button" class="soft-btn soft-btn-sm btn-period-mode ${this.periodMode === 'WEEK' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-mode="WEEK" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; border-radius: 10px;">
                Semana
              </button>
              <button type="button" class="soft-btn soft-btn-sm btn-period-mode ${this.periodMode === 'MONTH' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-mode="MONTH" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; border-radius: 10px;">
                Mes
              </button>
              <button type="button" class="soft-btn soft-btn-sm btn-period-mode ${this.periodMode === 'YEAR' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-mode="YEAR" style="padding: 0.35rem 0.8rem; font-size: 0.8rem; border-radius: 10px;">
                Año
              </button>
            </div>
          </div>

          <!-- Sub-controles de Navegación Específicos -->
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            ${renderSubcontrols()}
          </div>
        </div>
      </div>
    `;
  }

  async render() {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem;">
        <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto;">
          <div style="display: inline-flex; animation: spin 1.1s linear infinite;">${Icons.pulse(24, 'var(--soft-purple-primary)')}</div>
        </div>
        <p style="color: var(--soft-text-body); margin-top: 0.9rem; font-weight: 500; font-size: 0.9rem;">Cargando flujo de caja, aranceles y pasarela QR...</p>
      </div>
    `;

    try {
      await this.loadData();
      this.renderContent();
    } catch (error) {
      console.error('Error al inicializar CashRegisterView:', error);
      this.container.innerHTML = `
        <div class="page-container panel-general">
          <div class="soft-card" style="text-align: center; padding: 2.5rem 1.5rem; max-width: 600px; margin: 2rem auto; border: 1px solid var(--soft-border-card-inner, #E2DCF0);">
            <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto 1rem;">
              ${Icons.alertTriangle(28, '#DC2626')}
            </div>
            <h3 style="color: var(--brand-navy); font-size: 1.15rem; margin-bottom: 0.5rem;">No se pudo cargar la información de pagos</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">${this.escapeHtml(error.message)}</p>
            <button type="button" class="soft-btn soft-btn-lvl-1" id="btn-retry-cash">
              ${Icons.refresh(16, '#FFFFFF')}
              <span>Reintentar</span>
            </button>
          </div>
        </div>
      `;
      document.getElementById('btn-retry-cash')?.addEventListener('click', () => this.render());
    }
  }

  async loadData() {
    const user = store.getState().user;
    const isTherapist = user?.rol === 'TERAPEUTA';

    const [paymentsRes, summaryRes, qrRes] = await Promise.all([
      apiClient.get('/payments'),
      apiClient.get('/payments/summary'),
      apiClient.get('/payments/qr-config').catch(() => ({ data: null }))
    ]);

    this.payments = paymentsRes.data || [];
    this.summary = summaryRes.data || { totalRecaudado: 0, totalQr: 0, totalEfectivo: 0, totalPendiente: 0, totalEnRevision: 0, totalAprobadosCount: 0 };
    this.qrConfig = qrRes.data || null;

    if (isTherapist) {
      try {
        const tariffRes = await apiClient.get('/payments/my-tariff');
        this.therapistConfig = tariffRes.data || null;
      } catch (e) {
        console.warn('No se pudo cargar tarifario del terapeuta:', e);
        this.therapistConfig = null;
      }
    } else if (user?.rol !== 'TUTOR') {
      try {
        const therapistsRes = await apiClient.get('/therapists');
        this.therapists = therapistsRes.data || [];
      } catch (e) {
        console.warn('No se pudo cargar lista de terapeutas:', e);
        this.therapists = [];
      }
    }
  }

  renderContent() {
    const user = store.getState().user;
    const isTherapist = user?.rol === 'TERAPEUTA';
    const isTutor = user?.rol === 'TUTOR';
    const isAdminOrReception = ['ADMIN', 'RECEPCION'].includes(user?.rol);

    // Filtrado local
    let filtered = [...this.payments];

    // 1. Filtrado temporal por Periodo Superior (Día, Semana, Mes, Año, Todo)
    const periodInfo = this.getPeriodRangeAndLabel();
    if (periodInfo.start && periodInfo.end) {
      filtered = filtered.filter(p => {
        const pDate = this.getPaymentDate(p);
        if (!pDate) return false;
        return pDate >= periodInfo.start && pDate <= periodInfo.end;
      });
    }

    if (!isTherapist && !isTutor && this.currentFilterTherapist !== 'ALL') {
      filtered = filtered.filter(p => String(p.terapeuta_id) === String(this.currentFilterTherapist));
    }

    if (this.currentFilterStatus !== 'ALL') {
      filtered = filtered.filter(p => {
        if (this.currentFilterStatus === 'COMPLETADO' || this.currentFilterStatus === 'VERIFICADO') {
          return p.estado === 'COMPLETADO' || p.estado === 'VERIFICADO';
        }
        return p.estado === this.currentFilterStatus;
      });
    }

    if (this.currentFilterMethod !== 'ALL') {
      filtered = filtered.filter(p => {
        if (this.currentFilterMethod === 'QR_BANCO' || this.currentFilterMethod === 'QR_SIMPLE') {
          return p.metodo_pago === 'QR_BANCO' || p.metodo_pago === 'QR_SIMPLE';
        }
        return p.metodo_pago === this.currentFilterMethod;
      });
    }

    // Métricas dinámicas calculadas sobre los registros filtrados activos del período
    const isPaid = p => p.estado === 'VERIFICADO' || p.estado === 'COMPLETADO';
    const isQr = p => ['QR_SIMPLE', 'QR_BANCO', 'TRANSFERENCIA'].includes(p.metodo_pago);
    const isCash = p => p.metodo_pago === 'EFECTIVO';

    let kpiRecaudado = filtered.filter(isPaid).reduce((sum, p) => sum + (Number(p.monto || p.monto_bob) || 0), 0);
    let kpiQr = filtered.filter(p => isPaid(p) && isQr(p)).reduce((sum, p) => sum + (Number(p.monto || p.monto_bob) || 0), 0);
    let kpiEfectivo = filtered.filter(p => isPaid(p) && isCash(p)).reduce((sum, p) => sum + (Number(p.monto || p.monto_bob) || 0), 0);
    let kpiRevision = filtered.filter(p => p.estado === 'EN_REVISION').length;

    // Respaldo de resumen global cuando no hay filtros restrictivos
    if (filtered.length === 0 && this.periodMode === 'ALL' && this.currentFilterTherapist === 'ALL' && this.currentFilterStatus === 'ALL' && this.currentFilterMethod === 'ALL') {
      kpiRecaudado = this.summary.totalRecaudado || this.summary.total_recaudado_bob || 0;
      kpiQr = this.summary.totalQr || this.summary.total_qr_bob || 0;
      kpiEfectivo = this.summary.totalEfectivo || this.summary.total_efectivo_bob || 0;
      kpiRevision = this.summary.totalEnRevision || this.summary.pendientes_revision || 0;
    }

    this.container.innerHTML = `
      <div class="page-container panel-general">
        <!-- CABECERA -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <a href="#/dashboard" class="soft-back-link">&larr; Volver al Panel Principal</a>
              <span class="soft-badge soft-badge-mint">
                ${isTherapist ? 'Planilla de Especialista' : isTutor ? 'Portal de Pagos Familiar' : 'Caja Diaria & Finanzas'}
              </span>
            </div>
            <h1 class="soft-page-title">
              ${isTherapist ? 'Mis Honorarios y Sesiones Clínicas' : isTutor ? 'Mis Pagos y Aranceles de Consulta' : 'Caja Diaria y Cobros por QR Oficial'}
            </h1>
            <p class="soft-page-subtitle" style="max-width: 800px;">
              ${isTherapist 
                ? 'Consulte sus consultas realizadas, valide los comprobantes bancarios subidos por las familias y descargue su planilla individual de ingresos en formato Excel.'
                : isTutor
                ? 'Escanee el código QR oficial del centro PSI Aprende con su aplicación bancaria, suba la constancia de transferencia y consulte sus recibos oficiales autorizados.'
                : 'Supervisión integral de recaudaciones, arqueo de caja, verificación dual de pagos QR institucionales y generación de planillas para auditoría contable.'
              }
            </p>
          </div>

          <div class="soft-header-actions" style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
            <button type="button" id="btn-emit-payment-request" class="soft-btn soft-btn-lvl-1" style="font-size: 0.86rem; padding: 0.55rem 1.15rem;">
              ${Icons.plus(15, '#FFFFFF')}
              <span>Emitir Cobro a Paciente</span>
            </button>
            ${isTherapist ? `
              <button type="button" id="btn-export-excel-therapist" class="soft-btn soft-btn-lvl-2" style="font-size: 0.86rem; padding: 0.55rem 1.15rem;">
                ${Icons.download(15, 'currentColor')}
                <span>Exportar Planilla Excel</span>
              </button>
            ` : isAdminOrReception ? `
              <button type="button" id="btn-export-excel-admin" class="soft-btn soft-btn-lvl-2" style="font-size: 0.86rem; padding: 0.55rem 1.15rem;">
                ${Icons.download(15, 'currentColor')}
                <span>Exportar Planilla (.xlsx)</span>
              </button>
              <button type="button" id="btn-register-cash" class="soft-btn soft-btn-lvl-2" style="font-size: 0.86rem; padding: 0.55rem 1.15rem;">
                ${Icons.wallet(15, 'currentColor')}
                <span>Cobro en Efectivo</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- BARRA DE FILTRO DE PERÍODO TEMPORAL (DÍA, SEMANA, MES, AÑO, TODO) -->
        ${this.renderPeriodFilterBar(periodInfo)}

        <!-- TARJETAS DE RESUMEN KPI (Uniform 1px border) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1.25rem; margin-bottom: 2rem;">
          <div class="soft-card" style="padding: 1.25rem 1.4rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.04); display: flex; align-items: center; gap: 1rem;">
            <div class="soft-icon-box soft-icon-box-lavender" style="flex-shrink: 0;">
              ${Icons.wallet(24, 'var(--soft-purple-primary)')}
            </div>
            <div style="flex: 1; min-width: 0;">
              <span style="font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); display: block;">
                ${isTherapist ? 'Mis Honorarios Recaudados' : 'Total General Recaudado'}
              </span>
              <div style="font-size: 1.35rem; font-weight: 800; color: var(--brand-navy); margin-top: 0.2rem;">
                ${this.formatMoney(kpiRecaudado)}
              </div>
              <div style="margin-top: 0.35rem;">
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem; padding: 0.2rem 0.55rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                  ${Icons.calendar(12, 'currentColor')}
                  <span>${this.escapeHtml(periodInfo.shortLabel || periodInfo.label)}</span>
                </span>
              </div>
            </div>
          </div>

          <div class="soft-card" style="padding: 1.25rem 1.4rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.04); display: flex; align-items: center; gap: 1rem;">
            <div class="soft-icon-box soft-icon-box-mint" style="flex-shrink: 0;">
              ${Icons.qrCode(24, 'var(--soft-mint-deep)')}
            </div>
            <div style="flex: 1; min-width: 0;">
              <span style="font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); display: block;">
                Cobrado por QR Oficial
              </span>
              <div style="font-size: 1.35rem; font-weight: 800; color: var(--soft-emerald-dark); margin-top: 0.2rem;">
                ${this.formatMoney(kpiQr)}
              </div>
              <div style="margin-top: 0.35rem;">
                <span class="soft-badge soft-badge-mint" style="font-size: 0.72rem; padding: 0.2rem 0.55rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                  ${Icons.qrCode(12, 'currentColor')}
                  <span>Transferencias QR</span>
                </span>
              </div>
            </div>
          </div>

          <div class="soft-card" style="padding: 1.25rem 1.4rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.04); display: flex; align-items: center; gap: 1rem;">
            <div class="soft-icon-box" style="flex-shrink: 0; background: #EFF6FF;">
              ${Icons.receipt(24, '#2563EB')}
            </div>
            <div style="flex: 1; min-width: 0;">
              <span style="font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); display: block;">
                Cobrado en Efectivo
              </span>
              <div style="font-size: 1.35rem; font-weight: 800; color: #1D4ED8; margin-top: 0.2rem;">
                ${this.formatMoney(kpiEfectivo)}
              </div>
              <div style="margin-top: 0.35rem;">
                <span class="soft-badge" style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; font-size: 0.72rem; padding: 0.2rem 0.55rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                  ${Icons.wallet(12, 'currentColor')}
                  <span>En Consultorio</span>
                </span>
              </div>
            </div>
          </div>

          <div class="soft-card" style="padding: 1.25rem 1.4rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.04); display: flex; align-items: center; gap: 1rem;">
            <div class="soft-icon-box" style="flex-shrink: 0; background: #FFFBEB;">
              ${Icons.clock(24, '#D97706')}
            </div>
            <div style="flex: 1; min-width: 0;">
              <span style="font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); display: block;">
                Comprobantes en Revisión
              </span>
              <div style="font-size: 1.35rem; font-weight: 800; color: #B45309; margin-top: 0.2rem;">
                ${kpiRevision} pendientes
              </div>
              <div style="margin-top: 0.35rem;">
                <span class="soft-badge" style="background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; font-size: 0.72rem; padding: 0.2rem 0.55rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                  ${Icons.clock(12, 'currentColor')}
                  <span>Por Validar</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- PESTAÑAS PARA EL TERAPEUTA (Mis Honorarios vs Mi QR & Tarifario) -->
        ${isTherapist ? `
          <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--soft-border-card-inner, #E2DCF0); padding-bottom: 0.75rem;">
            <button type="button" id="tab-transactions" class="soft-btn ${this.activeTab === 'transactions' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-2'}" style="padding: 0.5rem 1.15rem; font-size: 0.88rem;">
              ${Icons.fileText(16, 'currentColor')}
              <span>Mis Honorarios &amp; Sesiones Cobradas</span>
            </button>
            <button type="button" id="tab-therapist-config" class="soft-btn ${this.activeTab === 'my_config' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-2'}" style="padding: 0.5rem 1.15rem; font-size: 0.88rem;">
              ${Icons.qrCode(16, 'currentColor')}
              <span>Mi QR de Cobro &amp; Tarifario de Servicios</span>
            </button>
          </div>
        ` : ''}

        <!-- PESTAÑAS PARA ADMIN/RECEPCIÓN (Flujo de Sesiones vs Configuración QR Oficial) -->
        ${isAdminOrReception ? `
          <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--soft-border-card-inner, #E2DCF0); padding-bottom: 0.75rem;">
            <button type="button" id="tab-transactions" class="soft-btn ${this.activeTab === 'transactions' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-2'}" style="padding: 0.5rem 1.15rem; font-size: 0.88rem;">
              ${Icons.fileText(16, 'currentColor')}
              <span>Registro de Citas & Pagos</span>
            </button>
            <button type="button" id="tab-qr-config" class="soft-btn ${this.activeTab === 'qr_config' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-2'}" style="padding: 0.5rem 1.15rem; font-size: 0.88rem;">
              ${Icons.qrCode(16, 'currentColor')}
              <span>Configuración del QR Oficial y Banco</span>
            </button>
          </div>
        ` : ''}

        <!-- CONTENIDO SEGÚN PESTAÑA -->
        ${this.activeTab === 'my_config' && isTherapist 
          ? this.renderTherapistConfigSection() 
          : (this.activeTab === 'qr_config' && isAdminOrReception 
              ? this.renderQrConfigSection() 
              : this.renderTransactionsSection(filtered, isTherapist, isTutor, isAdminOrReception, periodInfo))}
      </div>

      <!-- CONTENEDOR MODAL -->
      <div id="modal-container-cash"></div>
    `;

    this.attachEvents(filtered, isTherapist, isTutor, isAdminOrReception);
  }

  renderTransactionsSection(filtered, isTherapist, isTutor, isAdminOrReception, periodInfo = {}) {
    return `
      <!-- BARRA DE FILTROS -->
      <div class="soft-card" style="padding: 1.25rem 1.5rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.02);">
        <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between;">
          <div style="display: flex; flex-wrap: wrap; gap: 0.85rem; align-items: center;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--brand-navy); display: inline-flex; align-items: center; gap: 0.35rem;">
              ${Icons.filter(15, 'var(--soft-purple-primary)')} Filtros:
            </span>

            ${!isTherapist && !isTutor ? `
              <div>
                <select id="filter-therapist" class="form-input" style="padding: 0.45rem 0.85rem; font-size: 0.84rem; border-radius: 9999px; border: 1px solid var(--soft-border-card-inner, #E2DCF0); background: #FAF9FD;">
                  <option value="ALL" ${this.currentFilterTherapist === 'ALL' ? 'selected' : ''}>Todos los Terapeutas</option>
                  ${this.therapists.map(t => `
                    <option value="${t.id}" ${String(this.currentFilterTherapist) === String(t.id) ? 'selected' : ''}>
                      ${this.escapeHtml(t.nombre_completo || t.nombre)} (${this.escapeHtml(t.especialidad || 'Especialista')})
                    </option>
                  `).join('')}
                </select>
              </div>
            ` : ''}

            <div>
              <select id="filter-status" class="form-input" style="padding: 0.45rem 0.85rem; font-size: 0.84rem; border-radius: 9999px; border: 1px solid var(--soft-border-card-inner, #E2DCF0); background: #FAF9FD;">
                <option value="ALL" ${this.currentFilterStatus === 'ALL' ? 'selected' : ''}>Todos los Estados</option>
                <option value="COMPLETADO" ${this.currentFilterStatus === 'COMPLETADO' ? 'selected' : ''}>Completado / Verificado</option>
                <option value="EN_REVISION" ${this.currentFilterStatus === 'EN_REVISION' ? 'selected' : ''}>En Revisión (Comprobante Subido)</option>
                <option value="PENDIENTE" ${this.currentFilterStatus === 'PENDIENTE' ? 'selected' : ''}>Pendiente de Pago</option>
                <option value="RECHAZADO" ${this.currentFilterStatus === 'RECHAZADO' ? 'selected' : ''}>Rechazado</option>
              </select>
            </div>

            <div>
              <select id="filter-method" class="form-input" style="padding: 0.45rem 0.85rem; font-size: 0.84rem; border-radius: 9999px; border: 1px solid var(--soft-border-card-inner, #E2DCF0); background: #FAF9FD;">
                <option value="ALL" ${this.currentFilterMethod === 'ALL' ? 'selected' : ''}>Todos los Métodos</option>
                <option value="QR_BANCO" ${this.currentFilterMethod === 'QR_BANCO' ? 'selected' : ''}>QR Institucional</option>
                <option value="EFECTIVO" ${this.currentFilterMethod === 'EFECTIVO' ? 'selected' : ''}>Efectivo en Consultorio</option>
              </select>
            </div>

            <div>
              <span class="soft-badge soft-badge-lavender" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; padding: 0.4rem 0.8rem; font-weight: 600;">
                ${Icons.calendar(13, 'currentColor')}
                <span>Periodo: <strong>${this.escapeHtml(periodInfo.shortLabel || periodInfo.label || 'Todo')}</strong></span>
              </span>
            </div>
          </div>

          <div style="font-size: 0.82rem; color: var(--text-secondary); font-weight: 600;">
            Mostrando <strong>${filtered.length}</strong> registro(s) en este período
          </div>
        </div>
      </div>

      <!-- TABLA DE TRANSACCIONES / REGISTROS -->
      <div class="soft-card" style="padding: 0; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; overflow: hidden; box-shadow: 0 2px 10px rgba(107, 70, 193, 0.03);">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem;">
            <thead>
              <tr style="background: #F8F7FC; border-bottom: 1px solid var(--soft-border-card-inner, #E2DCF0); color: var(--brand-navy); font-weight: 700; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em;">
                <th style="padding: 1rem 1.25rem;">Cita / Fecha</th>
                <th style="padding: 1rem 1.25rem;">Paciente & Tutor</th>
                ${!isTherapist ? '<th style="padding: 1rem 1.25rem;">Especialista</th>' : ''}
                <th style="padding: 1rem 1.25rem;">Servicio & Arancel</th>
                <th style="padding: 1rem 1.25rem;">Método</th>
                <th style="padding: 1rem 1.25rem;">Estado</th>
                <th style="padding: 1rem 1.25rem;">Comprobante</th>
                <th style="padding: 1rem 1.25rem; text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="${!isTherapist ? 8 : 7}" style="text-align: center; padding: 3rem 1.5rem; color: var(--text-secondary);">
                    <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto 0.75rem;">
                      ${Icons.folderSearch(24, 'var(--soft-purple-primary)')}
                    </div>
                    <p style="font-weight: 600; font-size: 0.95rem; margin: 0; color: var(--brand-navy);">No se encontraron registros de cobro con los filtros aplicados</p>
                    <p style="font-size: 0.82rem; margin-top: 0.25rem;">Modifique los filtros o registre un nuevo cobro institucional.</p>
                  </td>
                </tr>
              ` : filtered.map(item => this.renderTableRow(item, isTherapist, isTutor, isAdminOrReception)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderTableRow(item, isTherapist, isTutor, isAdminOrReception) {
    const estadoBadges = {
      COMPLETADO: `<span class="soft-badge soft-badge-mint" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; padding: 0.25rem 0.65rem;">${Icons.checkCircle(13, 'var(--soft-mint-deep)')} Verificado</span>`,
      VERIFICADO: `<span class="soft-badge soft-badge-mint" style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; padding: 0.25rem 0.65rem;">${Icons.checkCircle(13, 'var(--soft-mint-deep)')} Verificado</span>`,
      EN_REVISION: `<span class="soft-badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; padding: 0.25rem 0.65rem;">${Icons.clock(13, '#B45309')} En Revisión</span>`,
      PENDIENTE: `<span class="soft-badge" style="background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; padding: 0.25rem 0.65rem;">${Icons.alert(13, '#64748B')} Pendiente</span>`,
      RECHAZADO: `<span class="soft-badge" style="background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.76rem; padding: 0.25rem 0.65rem;">${Icons.close(13, '#DC2626')} Rechazado</span>`
    };

    const metodoBadges = {
      QR_BANCO: `<span style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600; color: var(--soft-purple-primary); font-size: 0.82rem;">${Icons.qrCode(14, 'currentColor')} QR Oficial</span>`,
      QR_SIMPLE: `<span style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600; color: var(--soft-purple-primary); font-size: 0.82rem;">${Icons.qrCode(14, 'currentColor')} QR Oficial</span>`,
      TRANSFERENCIA: `<span style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600; color: var(--soft-purple-primary); font-size: 0.82rem;">${Icons.qrCode(14, 'currentColor')} Transferencia</span>`,
      EFECTIVO: `<span style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600; color: #1D4ED8; font-size: 0.82rem;">${Icons.wallet(14, 'currentColor')} Efectivo</span>`
    };

    const badgeEstado = estadoBadges[item.estado] || item.estado;
    const badgeMetodo = metodoBadges[item.metodo_pago] || item.metodo_pago || 'No definido';

    const isCita = Boolean(item.cita_id);
    const idLabel = isCita ? `Cita #${item.cita_id}` : `Cobro #${item.id}`;
    const fechaRaw = item.cita_fecha ? `${item.cita_fecha} ${item.cita_hora_inicio ? item.cita_hora_inicio.slice(0, 5) : ''}` : (item.created_at || item.fecha_creacion || item.fecha_pago);
    const fechaTexto = fechaRaw ? this.formatDateTime(fechaRaw) : 'Fecha no registrada';

    return `
      <tr style="border-bottom: 1px solid var(--soft-divider, #EAE5F5); transition: background 0.15s ease;" onmouseover="this.style.background='#FAF9FD'" onmouseout="this.style.background='transparent'">
        <td style="padding: 1rem 1.25rem;">
          <div style="font-weight: 700; color: var(--brand-navy);">${idLabel}</div>
          <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.15rem;">${this.escapeHtml(fechaTexto)}</div>
        </td>

        <td style="padding: 1rem 1.25rem;">
          <div style="font-weight: 700; color: var(--brand-navy);">${this.escapeHtml(item.paciente_nombre || 'Paciente')}</div>
          <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.15rem;">Tutor: ${this.escapeHtml(item.tutor_nombre || 'No registrado')}</div>
        </td>

        ${!isTherapist ? `
          <td style="padding: 1rem 1.25rem;">
            <div style="font-weight: 600; color: var(--brand-navy);">${this.escapeHtml(item.terapeuta_nombre || 'No asignado')}</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">${this.escapeHtml(item.terapeuta_especialidad || 'Especialista')}</div>
          </td>
        ` : ''}

        <td style="padding: 1rem 1.25rem;">
          <div style="font-weight: 600; color: var(--brand-navy);">${this.escapeHtml(item.servicio_nombre || 'Consulta Clínica')}</div>
          <div style="font-weight: 800; color: var(--soft-purple-primary); font-size: 0.95rem; margin-top: 0.15rem;">${this.formatMoney(item.monto)}</div>
        </td>

        <td style="padding: 1rem 1.25rem;">
          ${badgeMetodo}
        </td>

        <td style="padding: 1rem 1.25rem;">
          ${badgeEstado}
          ${item.numero_transaccion ? `
            <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.25rem; font-family: monospace;">Ref: ${this.escapeHtml(item.numero_transaccion)}</div>
          ` : ''}
        </td>

        <td style="padding: 1rem 1.25rem;">
          ${item.comprobante_url ? `
            <button type="button" class="btn-view-receipt soft-btn soft-btn-lvl-2" data-payment-id="${item.id}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;">
              ${Icons.eye(14, 'currentColor')}
              <span>Ver Comprobante</span>
            </button>
          ` : isTutor ? `
            <button type="button" class="btn-pay-qr-tutor soft-btn soft-btn-lvl-1" data-payment-id="${item.id}" data-appointment-id="${item.cita_id}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;">
              ${Icons.qrCode(14, '#FFFFFF')}
              <span>Pagar con QR</span>
            </button>
          ` : `
            <span style="font-size: 0.78rem; color: var(--text-secondary); font-style: italic;">Sin archivo</span>
          `}
        </td>

        <td style="padding: 1rem 1.25rem; text-align: right;">
          <div style="display: inline-flex; gap: 0.45rem; justify-content: flex-end;">
            ${(isAdminOrReception || isTherapist) && item.estado === 'EN_REVISION' ? `
              <button type="button" class="btn-verify-receipt soft-btn soft-btn-lvl-1" data-payment-id="${item.id}" title="Revisar y Validar Comprobante" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; background: var(--soft-mint-deep); box-shadow: 0 2px 8px rgba(0, 135, 121, 0.25);">
                ${Icons.checkCircle(14, '#FFFFFF')}
                <span>Aprobar Pago</span>
              </button>
            ` : ''}

            ${(item.estado === 'COMPLETADO' || item.estado === 'VERIFICADO') ? `
              <button type="button" class="btn-print-receipt soft-btn soft-btn-lvl-2" data-payment-id="${item.id}" title="Imprimir Recibo Oficial de Caja" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;">
                ${Icons.printer(14, 'currentColor')}
                <span>Recibo Oficial</span>
              </button>
            ` : ''}

            ${(isAdminOrReception || isTherapist) && item.estado === 'PENDIENTE' ? `
              <button type="button" class="btn-quick-cash soft-btn soft-btn-lvl-2" data-appointment-id="${item.cita_id}" data-amount="${item.monto}" title="Registrar Cobro en Efectivo" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;">
                ${Icons.wallet(14, 'currentColor')}
                <span>Cobro Efectivo</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  renderTherapistConfigSection() {
    const config = this.therapistConfig || {};
    const tariffs = config.tariffs || [];
    const hasQrImage = !!config.qr_url && config.es_qr_personal;

    return `
      <!-- BANNER DE ALERTA PULSANTE SI EL QR ESTÁ POR VENCER O VENCIDO -->
      ${(config.qr_vencido || config.qr_por_vencer) ? `
        <div class="soft-alert-pulse-red" style="padding: 1.25rem 1.6rem; margin-bottom: 1.75rem; display: flex; align-items: center; justify-content: space-between; gap: 1.2rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="color: #E11D48; flex-shrink: 0;">
              ${Icons.alertTriangle(32, '#E11D48')}
            </div>
            <div>
              <strong style="color: #9F1239; font-size: 1.05rem; display: block; margin-bottom: 0.25rem;">
                ${config.qr_vencido ? '¡Atención: Su Código QR Bancario ha Vencido!' : '¡Aviso Preventivo: Su Código QR está por Caducar!'}
              </strong>
              <span style="color: #BE123C; font-size: 0.86rem; line-height: 1.45; display: block;">
                ${config.qr_vencido 
                  ? `Su código QR bancario personal venció el <strong>${this.escapeHtml(config.qr_fecha_vencimiento || 'plazo fijado')}</strong>. Los tutores no pueden transferir a un QR caducado y el sistema activó temporalmente el cobro por cuenta institucional. Por favor, genere un nuevo QR en su banca móvil y actualícelo a continuación.`
                  : `Su código QR vencerá en <strong>${config.dias_para_vencer} días</strong> (el ${this.escapeHtml(config.qr_fecha_vencimiento)}). Prepare la renovación en su app bancaria para no interrumpir la recaudación.`
                }
              </span>
            </div>
          </div>
          <span class="soft-badge" style="background: #FFE4E6; color: #9F1239; border: 1px solid #FECACA; font-weight: 800; font-size: 0.8rem; padding: 0.45rem 0.85rem;">
            ${config.qr_vencido ? 'ESTADO: QR VENCIDO' : `VENCE EN ${config.dias_para_vencer} DÍAS`}
          </span>
        </div>
      ` : ''}

      <div class="therapist-config-grid" style="display: grid; grid-template-columns: minmax(min(100%, 320px), 420px) 1fr; gap: 1.75rem; align-items: start;">
        
        <!-- COLUMNA 1: MI CÓDIGO QR PERSONAL Y DATOS BANCARIOS -->
        <div class="soft-card" style="padding: 1.75rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 10px rgba(107, 70, 193, 0.04);">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.qrCode(20, 'var(--soft-purple-primary)')}
            </div>
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--brand-navy);">
                Mi Código QR Personal
              </h3>
              <div style="font-size: 0.74rem; color: var(--soft-purple-primary); font-weight: 700; text-transform: uppercase;">
                Transferencias de Pacientes
              </div>
            </div>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.83rem; margin: 0 0 1.25rem 0; line-height: 1.45;">
            Suba la imagen de su código QR bancario (Banco Unión, BCP, BNB, etc.) y registre la fecha de vencimiento configurada en su app bancaria.
          </p>

          <!-- ÁREA VISUAL DEL QR CON ESTADO DE ESPERA LIMPIO (CERO PARPADEO) -->
          <div style="margin-bottom: 1.25rem;">
            ${hasQrImage ? `
              <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 14px; padding: 1.1rem; text-align: center;">
                <img id="preview-therapist-qr" src="${config.qr_url}?t=${Date.now()}" alt="QR Personal Especialista" style="max-height: 180px; width: auto; object-fit: contain; margin: 0 auto 0.65rem; display: block; border-radius: 8px;" onerror="this.onerror=null; this.src='/uploads/qr/default_qr_psi_aprende.svg';" />
                <div style="display: flex; justify-content: center; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                  <span class="soft-badge ${config.qr_vencido ? 'soft-badge-rose' : 'soft-badge-mint'}" style="font-size: 0.72rem; font-weight: 700;">
                    ${config.qr_vencido ? Icons.alertTriangle(12, '#E11D48') : Icons.checkCircle(12, 'var(--soft-mint-deep)')}
                    <span>${config.qr_vencido ? 'QR Personal Vencido' : 'QR Personal Activo'}</span>
                  </span>
                  ${config.qr_fecha_vencimiento ? `
                    <span class="soft-badge soft-badge-indigo" style="font-size: 0.72rem;">
                      Vence: ${this.escapeHtml(config.qr_fecha_vencimiento)}
                    </span>
                  ` : ''}
                </div>
              </div>
            ` : `
              <!-- ILUSTRACIÓN DE ESPERA SUAVE (SIN IMÁGENES ROTAS NI PARPADEO) -->
              <div style="padding: 1.75rem 1.25rem; text-align: center; background: #FAF9FD; border: 1.5px dashed var(--soft-border-card-inner, #E2DCF0); border-radius: 14px;">
                <div style="color: var(--soft-purple-primary); margin-bottom: 0.5rem; display: inline-flex;">
                  ${Icons.qrCode(42, 'var(--soft-purple-primary)')}
                </div>
                <strong style="color: var(--brand-navy); font-size: 0.95rem; display: block; margin-bottom: 0.25rem;">
                  Código QR en Espera de Carga
                </strong>
                <p style="font-size: 0.79rem; color: var(--text-secondary); margin: 0 0 0.85rem; line-height: 1.45;">
                  Aún no ha subido su código QR personal. Los tutores verán temporalmente el QR institucional del centro mientras no vincule uno propio.
                </p>
                <span class="soft-badge" style="background: #FFFBEB; color: #92400E; border: 1px solid #FDE68A; font-size: 0.72rem;">
                  Usando QR Institucional de Respaldo
                </span>
              </div>
            `}
          </div>

          <!-- FORMULARIO DE SUBIDA DEL QR CON FECHA DE VENCIMIENTO -->
          <form id="form-therapist-upload-qr" style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--soft-divider, #EAE5F5); padding-bottom: 1.5rem;">
            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.82rem; color: var(--brand-navy); margin-bottom: 0.35rem; display: block;">
                Seleccionar Imagen del QR (JPG, PNG o WEBP): <span style="color: #DC2626;">*</span>
              </label>
              <input type="file" id="input-therapist-qr-file" class="form-input" accept="image/png,image/jpeg,image/webp" required style="padding: 0.45rem; font-size: 0.82rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; width: 100%; box-sizing: border-box;" />
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.82rem; color: var(--brand-navy); margin-bottom: 0.35rem; display: block;">
                Fecha de Vencimiento del QR (Según su App Bancaria):
              </label>
              <input type="date" id="input-therapist-qr-expiry" class="form-input" value="${this.escapeHtml(config.qr_fecha_vencimiento || '')}" style="padding: 0.45rem 0.75rem; font-size: 0.85rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; width: 100%; box-sizing: border-box;" />
              <div style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.25rem;">
                El sistema le avisará automáticamente con un panel parpadeante cuando la fecha se acerque.
              </div>
            </div>

            <button type="submit" id="btn-submit-therapist-qr" class="soft-btn soft-btn-lvl-1" style="width: 100%; justify-content: center; font-size: 0.85rem;">
              ${Icons.upload(15, '#FFFFFF')}
              <span>Subir y Guardar Imagen QR</span>
            </button>
          </form>

          <!-- FORMULARIO DE CUENTA BANCARIA -->
          <form id="form-therapist-bank">
            <h4 style="color: var(--brand-navy); font-size: 0.95rem; font-weight: 700; margin: 0 0 0.85rem 0;">
              Datos de Cuenta para Transferencias
            </h4>
            
            <div class="form-group" style="margin-bottom: 0.75rem;">
              <label class="form-label" style="font-size: 0.8rem; font-weight: 600; color: var(--brand-navy);">Entidad Bancaria:</label>
              <input type="text" id="therapist-bank-name" class="form-input" value="${this.escapeHtml(config.banco_nombre || '')}" placeholder="Ej: Banco Unión S.A., Banco BCP, BNB" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.45rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;" />
            </div>

            <div class="form-group" style="margin-bottom: 0.75rem;">
              <label class="form-label" style="font-size: 0.8rem; font-weight: 600; color: var(--brand-navy);">N° de Cuenta / Caja de Ahorro:</label>
              <input type="text" id="therapist-account-number" class="form-input" value="${this.escapeHtml(config.cuenta_numero || '')}" placeholder="Ej: 1000004829103" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.45rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;" />
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.8rem; font-weight: 600; color: var(--brand-navy);">Titular de la Cuenta:</label>
              <input type="text" id="therapist-account-holder" class="form-input" value="${this.escapeHtml(config.cuenta_titular || '')}" placeholder="Ej: Lic. ${this.escapeHtml(config.therapist_nombre || '')}" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.45rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;" />
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" class="soft-btn soft-btn-lvl-2" style="font-size: 0.85rem;">
                ${Icons.check(14, 'currentColor')}
                <span>Guardar Datos Bancarios</span>
              </button>
            </div>
          </form>
        </div>

        <!-- COLUMNA 2: MI TARIFARIO CLÍNICO & ARANCELES POR SERVICIO -->
        <div class="soft-card" style="padding: 1.75rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 10px rgba(107, 70, 193, 0.04);">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
              ${Icons.wallet(20, 'var(--soft-mint-deep)')}
            </div>
            <div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--brand-navy);">
                Mi Tarifario Clínico &amp; Aranceles por Servicio
              </h3>
              <div style="font-size: 0.74rem; color: var(--soft-mint-deep); font-weight: 700; text-transform: uppercase;">
                Honorarios Profesionales Personalizables
              </div>
            </div>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.84rem; margin: 0 0 1.25rem 0; line-height: 1.48;">
            Configure su arancel específico en bolivianos (Bs.) para cada prestación diagnóstica o terapéutica. Este arancel se vinculará a la cita del paciente y determinará el importe del QR que el tutor debe pagar.
          </p>

          <form id="form-therapist-tariffs">
            <!-- ARANCEL BASE GENERAL -->
            <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 14px; padding: 1rem 1.35rem; margin-bottom: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem;">
                <div>
                  <strong style="color: var(--brand-navy); font-size: 0.92rem;">Arancel Base de Consulta General:</strong>
                  <div style="font-size: 0.76rem; color: var(--text-secondary);">Tarifa por defecto para sesiones no catalogadas o particulares</div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-weight: 700; font-size: 0.88rem; color: var(--soft-purple-primary);">Bs.</span>
                  <input type="number" min="1" max="50000" step="1" id="therapist-base-fee" class="form-input" value="${Number(config.arancel_base_bob) || 150}" required style="width: 110px; padding: 0.45rem 0.75rem; font-size: 0.95rem; font-weight: 700; text-align: right; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px;" />
                </div>
              </div>
            </div>

            <!-- TABLA AMPLIA DE SERVICIOS (Con scroll horizontal protector para evitar desbordes) -->
            <div style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 14px; overflow-x: auto; margin-bottom: 1.5rem; background: #FFFFFF;">
              <table style="width: 100%; min-width: 540px; border-collapse: collapse; font-size: 0.86rem; text-align: left;">
                <thead>
                  <tr style="background: #F8F7FC; border-bottom: 1px solid var(--soft-border-card-inner, #E2DCF0); color: var(--brand-navy); font-size: 0.76rem; text-transform: uppercase;">
                    <th style="padding: 0.85rem 1rem;">Servicio / Prestación Clínica</th>
                    <th style="padding: 0.85rem 1rem; width: 95px;">Duración</th>
                    <th style="padding: 0.85rem 1rem; width: 110px;">Base Centro</th>
                    <th style="padding: 0.85rem 1rem; text-align: right; width: 150px;">Mi Arancel (Bs.)</th>
                  </tr>
                </thead>
                <tbody>
                  ${tariffs.map(tariff => `
                    <tr style="border-bottom: 1px solid var(--soft-divider, #EAE5F5);">
                      <td style="padding: 0.85rem 1rem;">
                        <div style="font-weight: 700; color: var(--brand-navy);">${this.escapeHtml(tariff.servicio_nombre)}</div>
                        <div style="font-size: 0.76rem; color: var(--text-secondary); line-height: 1.35; margin-top: 0.15rem;">${this.escapeHtml(tariff.servicio_descripcion || '')}</div>
                      </td>
                      <td style="padding: 0.85rem 1rem; color: var(--text-secondary); font-weight: 500;">
                        ${tariff.duracion_minutos || 60} min
                      </td>
                      <td style="padding: 0.85rem 1rem; color: var(--text-secondary); font-weight: 600;">
                        Bs. ${tariff.arancel_base_clinica}
                      </td>
                      <td style="padding: 0.85rem 1rem; text-align: right;">
                        <div style="display: inline-flex; align-items: center; gap: 0.4rem; justify-content: flex-end;">
                          <span style="font-weight: 700; font-size: 0.85rem; color: var(--soft-purple-primary);">Bs.</span>
                          <input type="number" min="1" max="50000" step="1" class="form-input input-therapist-service-fee" data-service-id="${tariff.servicio_id}" value="${Number(tariff.arancel_terapeuta_bob) || Number(tariff.arancel_base_clinica) || 150}" required style="width: 95px; padding: 0.4rem 0.6rem; font-size: 0.92rem; font-weight: 700; text-align: right; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px;" />
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" class="soft-btn soft-btn-lvl-1">
                ${Icons.check(16, '#FFFFFF')}
                <span>Guardar Tarifario de Servicios</span>
              </button>
            </div>
          </form>
        </div>

      </div>
    `;
  }

  renderQrConfigSection() {
    const config = this.qrConfig || {};
    const qrImageUrl = config.PAGO_QR_IMAGEN || '/uploads/qr/default_qr_psi_aprende.svg';

    return `
      <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 1.75rem; align-items: start;">
        <!-- VISUALIZACIÓN DEL QR ACTIVO -->
        <div class="soft-card" style="padding: 1.75rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; text-align: center; box-shadow: 0 2px 10px rgba(107, 70, 193, 0.04);">
          <div class="soft-badge soft-badge-mint" style="margin-bottom: 1rem; display: inline-flex;">
            ${Icons.qrCode(14, 'var(--soft-mint-deep)')} Código QR Bancario Institucional
          </div>

          <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; padding: 1.5rem; max-width: 280px; margin: 0 auto 1.25rem;">
            <img id="preview-active-qr" src="${qrImageUrl}?t=${Date.now()}" alt="Código QR PSI Aprende" style="width: 100%; height: auto; object-fit: contain; border-radius: 8px; display: block;" onerror="this.onerror=null; this.src='/uploads/qr/default_qr_psi_aprende.svg';" />
          </div>

          <h3 style="color: var(--brand-navy); font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem;">
            ${this.escapeHtml(config.PAGO_BANCO_NOMBRE || 'Banco Unión S.A.')}
          </h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0;">
            Titular: <strong>${this.escapeHtml(config.PAGO_CUENTA_TITULAR || 'Centro PSI Aprende SRL')}</strong>
          </p>
          <p style="color: var(--brand-purple); font-family: monospace; font-size: 0.95rem; font-weight: 700; margin-top: 0.25rem;">
            Cta: ${this.escapeHtml(config.PAGO_CUENTA_NUMERO || '1000004829103')}
          </p>
        </div>

        <!-- FORMULARIO DE ACTUALIZACIÓN DEL QR Y CUENTA BANCARIA -->
        <div class="soft-card" style="padding: 1.75rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 10px rgba(107, 70, 193, 0.04);">
          <div style="margin-bottom: 1.25rem;">
            <h3 style="color: var(--brand-navy); font-size: 1.15rem; font-weight: 700; margin-bottom: 0.25rem;">
              Subir Nuevo Código QR Institucional
            </h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem;">
              El centro no genera QR dinámicos por transacción. Suba la imagen oficial provista por su entidad bancaria (Banco Unión, BCP, BNB, etc.) para que los tutores la escaneen directamente desde su app.
            </p>
          </div>

          <form id="form-upload-qr-image" style="margin-bottom: 1.75rem; border-bottom: 1px solid var(--soft-divider, #EAE5F5); padding-bottom: 1.5rem;">
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem; color: var(--brand-navy);">
                Archivo de Imagen del QR Oficial (JPG, PNG o SVG):
              </label>
              <input type="file" id="input-qr-file" class="form-input" accept="image/png,image/jpeg,image/svg+xml" required style="padding: 0.5rem; font-size: 0.85rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; width: 100%;" />
            </div>

            <button type="submit" id="btn-submit-qr-file" class="soft-btn soft-btn-lvl-1" style="font-size: 0.88rem;">
              ${Icons.upload(16, '#FFFFFF')}
              <span>Guardar y Actualizar Imagen QR</span>
            </button>
          </form>

          <!-- DATOS BANCARIOS -->
          <form id="form-bank-details">
            <h4 style="color: var(--brand-navy); font-size: 0.95rem; font-weight: 700; margin-bottom: 1rem;">
              Detalles de la Cuenta de Transferencia
            </h4>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Entidad Bancaria:</label>
                <input type="text" id="bank-name" class="form-input" value="${this.escapeHtml(config.PAGO_BANCO_NOMBRE || 'Banco Unión S.A.')}" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%;" />
              </div>

              <div class="form-group">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Número de Cuenta / Caja de Ahorro:</label>
                <input type="text" id="bank-account" class="form-input" value="${this.escapeHtml(config.PAGO_CUENTA_NUMERO || '1000004829103')}" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%;" />
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Titular de la Cuenta:</label>
              <input type="text" id="bank-holder" class="form-input" value="${this.escapeHtml(config.PAGO_CUENTA_TITULAR || 'Centro de Atención Psicológica PSI Aprende SRL')}" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%;" />
            </div>

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Instrucciones para el Tutor:</label>
              <textarea id="bank-instructions" class="form-input" rows="2" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; resize: vertical;">${this.escapeHtml(config.PAGO_QR_INSTRUCCIONES || 'Escanee el código QR desde su aplicación bancaria oficial. En la glosa incluya el nombre del paciente y adjunte el comprobante.')}</textarea>
            </div>

            <button type="submit" class="soft-btn soft-btn-lvl-2" style="font-size: 0.88rem;">
              ${Icons.check(16, 'currentColor')}
              <span>Guardar Parámetros Bancarios</span>
            </button>
          </form>
        </div>
      </div>
    `;
  }

  attachEvents(filtered, isTherapist, isTutor, isAdminOrReception) {
    // Pestañas
    document.getElementById('tab-transactions')?.addEventListener('click', () => {
      this.activeTab = 'transactions';
      this.renderContent();
    });
    document.getElementById('tab-therapist-config')?.addEventListener('click', () => {
      this.activeTab = 'my_config';
      this.renderContent();
    });
    document.getElementById('tab-qr-config')?.addEventListener('click', () => {
      this.activeTab = 'qr_config';
      this.renderContent();
    });

    // Filtro Temporal de Período (Segmented buttons)
    document.querySelectorAll('.btn-period-mode').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-mode');
        if (mode && this.periodMode !== mode) {
          this.periodMode = mode;
          this.renderContent();
        }
      });
    });

    // Navegación temporal anterior / siguiente
    document.getElementById('btn-period-prev')?.addEventListener('click', () => {
      this.navigatePeriod(-1);
    });
    document.getElementById('btn-period-next')?.addEventListener('click', () => {
      this.navigatePeriod(1);
    });

    // Acciones de salto rápido
    document.getElementById('btn-period-today')?.addEventListener('click', () => {
      this.selectedDate = new Date();
      this.renderContent();
    });
    document.getElementById('btn-period-this-week')?.addEventListener('click', () => {
      this.selectedWeekDate = new Date();
      this.renderContent();
    });
    document.getElementById('btn-period-this-month')?.addEventListener('click', () => {
      const now = new Date();
      this.selectedMonth = now.getMonth();
      this.selectedYear = now.getFullYear();
      this.renderContent();
    });
    document.getElementById('btn-period-this-year')?.addEventListener('click', () => {
      this.selectedYear = new Date().getFullYear();
      this.renderContent();
    });

    // Selectores e inputs temporales
    document.getElementById('input-period-day')?.addEventListener('change', (e) => {
      if (e.target.value) {
        const [y, m, d] = e.target.value.split('-').map(Number);
        this.selectedDate = new Date(y, m - 1, d, 12, 0, 0);
        this.renderContent();
      }
    });
    document.getElementById('select-period-month')?.addEventListener('change', (e) => {
      this.selectedMonth = Number(e.target.value);
      this.renderContent();
    });
    document.getElementById('select-period-year')?.addEventListener('change', (e) => {
      this.selectedYear = Number(e.target.value);
      this.renderContent();
    });
    document.getElementById('select-period-year-only')?.addEventListener('change', (e) => {
      this.selectedYear = Number(e.target.value);
      this.renderContent();
    });

    // Filtros secundarios
    document.getElementById('filter-therapist')?.addEventListener('change', (e) => {
      this.currentFilterTherapist = e.target.value;
      this.renderContent();
    });
    document.getElementById('filter-status')?.addEventListener('change', (e) => {
      this.currentFilterStatus = e.target.value;
      this.renderContent();
    });
    document.getElementById('filter-method')?.addEventListener('change', (e) => {
      this.currentFilterMethod = e.target.value;
      this.renderContent();
    });

    // Exportar Excel Terapeuta (Planilla Individual)
    document.getElementById('btn-export-excel-therapist')?.addEventListener('click', () => {
      this.exportTherapistExcel(filtered);
    });

    // Exportar Excel Admin (Consolidado o Filtrado)
    document.getElementById('btn-export-excel-admin')?.addEventListener('click', () => {
      this.exportAdminExcel(filtered);
    });

    // Emitir orden de cobro a paciente / tutor
    document.getElementById('btn-emit-payment-request')?.addEventListener('click', () => {
      this.openEmitPaymentModal();
    });

    // Registrar cobro en efectivo
    document.getElementById('btn-register-cash')?.addEventListener('click', () => {
      this.openCashPaymentModal();
    });

    // Botones individuales en la tabla
    document.querySelectorAll('.btn-view-receipt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const paymentId = e.currentTarget.getAttribute('data-payment-id');
        this.openReceiptViewerModal(paymentId);
      });
    });

    document.querySelectorAll('.btn-verify-receipt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const paymentId = e.currentTarget.getAttribute('data-payment-id');
        this.openReceiptVerificationModal(paymentId);
      });
    });

    document.querySelectorAll('.btn-print-receipt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const paymentId = e.currentTarget.getAttribute('data-payment-id');
        this.openOfficialReceiptModal(paymentId);
      });
    });

    document.querySelectorAll('.btn-pay-qr-tutor').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const paymentId = e.currentTarget.getAttribute('data-payment-id');
        const appointmentId = e.currentTarget.getAttribute('data-appointment-id');
        this.openTutorPayQrModal(paymentId, appointmentId);
      });
    });

    document.querySelectorAll('.btn-quick-cash').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const appointmentId = e.currentTarget.getAttribute('data-appointment-id');
        const amount = e.currentTarget.getAttribute('data-amount');
        this.openCashPaymentModal(appointmentId, amount);
      });
    });

    // Eventos de la pestaña Configuración QR
    const formQrImage = document.getElementById('form-upload-qr-image');
    if (formQrImage) {
      formQrImage.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('input-qr-file');
        if (!fileInput.files || fileInput.files.length === 0) {
          Toast.error('Seleccione un archivo de imagen para el QR.');
          return;
        }

        const formData = new FormData();
        formData.append('qr_image', fileInput.files[0]);

        try {
          Toast.info('Subiendo nueva imagen del código QR institucional...');
          const res = await apiClient.request('/payments/qr-image', {
            method: 'POST',
            body: formData
          });
          Toast.success('¡Código QR institucional actualizado exitosamente!');
          await this.loadData();
          this.renderContent();
        } catch (err) {
          Toast.error(err.message || 'Error al actualizar imagen QR');
        }
      });
    }

    const formBank = document.getElementById('form-bank-details');
    if (formBank) {
      formBank.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          PAGO_BANCO_NOMBRE: document.getElementById('bank-name').value.trim(),
          PAGO_CUENTA_NUMERO: document.getElementById('bank-account').value.trim(),
          PAGO_CUENTA_TITULAR: document.getElementById('bank-holder').value.trim(),
          PAGO_QR_INSTRUCCIONES: document.getElementById('bank-instructions').value.trim()
        };

        try {
          await apiClient.post('/payments/qr-config', payload);
          Toast.success('Parámetros bancarios actualizados correctamente.');
          await this.loadData();
          this.renderContent();
        } catch (err) {
          Toast.error(err.message || 'Error al guardar datos bancarios');
        }
      });
    }

    // Eventos de la pestaña Mi QR & Tarifario Terapeuta
    const formTherapistQr = document.getElementById('form-therapist-upload-qr');
    if (formTherapistQr) {
      formTherapistQr.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('input-therapist-qr-file');
        const expiryInput = document.getElementById('input-therapist-qr-expiry');
        if (!fileInput.files || fileInput.files.length === 0) {
          Toast.error('Seleccione un archivo de imagen para su QR personal.');
          return;
        }

        const formData = new FormData();
        formData.append('qr_image', fileInput.files[0]);
        if (expiryInput && expiryInput.value) {
          formData.append('qr_fecha_vencimiento', expiryInput.value);
        }

        const submitBtn = document.getElementById('btn-submit-therapist-qr');
        if (submitBtn) submitBtn.disabled = true;

        try {
          Toast.info('Subiendo imagen de su código QR personal...');
          await apiClient.request('/payments/my-qr', {
            method: 'POST',
            body: formData
          });
          Toast.success('¡Código QR personal y fecha de vencimiento guardados exitosamente!');
          await this.loadData();
          this.renderContent();
        } catch (err) {
          Toast.error(err.message || 'Error al subir código QR personal');
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    const formTherapistBank = document.getElementById('form-therapist-bank');
    if (formTherapistBank) {
      formTherapistBank.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          banco_nombre: document.getElementById('therapist-bank-name')?.value.trim(),
          cuenta_numero: document.getElementById('therapist-account-number')?.value.trim(),
          cuenta_titular: document.getElementById('therapist-account-holder')?.value.trim()
        };

        const expiryVal = document.getElementById('input-therapist-qr-expiry')?.value;
        if (expiryVal !== undefined) {
          payload.qr_fecha_vencimiento = expiryVal;
        }

        try {
          await apiClient.post('/payments/my-tariff', payload);
          Toast.success('¡Datos bancarios guardados exitosamente!');
          await this.loadData();
          this.renderContent();
        } catch (err) {
          Toast.error(err.message || 'Error al guardar datos bancarios');
        }
      });
    }

    const formTherapistTariffs = document.getElementById('form-therapist-tariffs');
    if (formTherapistTariffs) {
      formTherapistTariffs.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawBase = document.getElementById('therapist-base-fee')?.value;
        const baseFee = Number(rawBase);
        if (!Number.isFinite(baseFee) || baseFee <= 0 || baseFee > 50000) {
          Toast.error('El arancel base por defecto debe ser mayor a 0 Bs.');
          return;
        }
        const tariffInputs = document.querySelectorAll('.input-therapist-service-fee');
        const tariffs = [];
        let invalidFee = false;
        tariffInputs.forEach(input => {
          const servicioId = input.getAttribute('data-service-id');
          const arancel = Number(input.value);
          if (!Number.isFinite(arancel) || arancel <= 0 || arancel > 50000) {
            invalidFee = true;
          } else if (servicioId) {
            tariffs.push({ servicio_id: Number(servicioId), arancel_bob: arancel });
          }
        });
        if (invalidFee) {
          Toast.error('Todos los aranceles por servicio deben ser montos positivos mayores a 0 Bs.');
          return;
        }

        try {
          await apiClient.post('/payments/my-tariff', {
            arancel_base_bob: baseFee,
            tariffs
          });
          Toast.success('¡Tarifario de servicios actualizado exitosamente!');
          await this.loadData();
          this.renderContent();
        } catch (err) {
          Toast.error(err.message || 'Error al actualizar tarifario');
        }
      });
    }
  }

  // EXPORTACIÓN A EXCEL: TERAPEUTA (Planilla Individual de Honorarios Médicos)
  async exportTherapistExcel(records) {
    try {
      const user = store.getState().user;
      const therapistName = user?.nombre_completo || user?.nombre || 'Especialista';
      const periodInfo = this.getPeriodRangeAndLabel();

      const wb = new ExcelJS.Workbook();
      wb.creator = 'PSI Aprende - Centro Clínico';
      wb.created = new Date();

      const ws = wb.addWorksheet('Mis Honorarios', {
        views: [{ showGridLines: true }]
      });

      // Paleta institucional médica
      const COLOR_NAVY = 'FF27345F';
      const COLOR_PURPLE = 'FF584294';
      const COLOR_CARD_BG = 'FFF4F1FA';
      const COLOR_ZEBRA = 'FFFAF9FD';
      const COLOR_WHITE = 'FFFFFFFF';
      const COLOR_TOTAL_BG = 'FFEDE9FE';
      const COLOR_BORDER = 'FFE2DCF0';
      const COLOR_SUCCESS = 'FF059669';

      const borderThin = {
        top: { style: 'thin', color: { argb: COLOR_BORDER } },
        left: { style: 'thin', color: { argb: COLOR_BORDER } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER } }
      };

      // Fila 1: Título Institucional Banner
      ws.mergeCells('A1:H1');
      const t1 = ws.getCell('A1');
      t1.value = 'CENTRO PSICOPEDAGÓGICO Y DE ATENCIÓN PSICOLÓGICA "PSI APRENDE"';
      t1.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLOR_WHITE } };
      t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
      t1.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 32;

      // Fila 2: Subtítulo
      ws.mergeCells('A2:H2');
      const t2 = ws.getCell('A2');
      t2.value = `PLANILLA INDIVIDUAL DE HONORARIOS PROFESIONALES - ${periodInfo.label.toUpperCase()}`;
      t2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_WHITE } };
      t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PURPLE } };
      t2.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 22;

      // Fila 3: Separador
      ws.getRow(3).height = 10;

      // Calcular totales
      let totalBs = 0;
      let totalQr = 0;
      let totalEfe = 0;
      records.forEach(r => {
        const m = Number(r.monto || r.monto_bob) || 0;
        if (r.estado === 'COMPLETADO' || r.estado === 'VERIFICADO') {
          totalBs += m;
          if (['QR_SIMPLE', 'QR_BANCO', 'TRANSFERENCIA'].includes(r.metodo_pago)) totalQr += m;
          if (r.metodo_pago === 'EFECTIVO') totalEfe += m;
        }
      });

      // Fila 4: Tarjeta Resumen Metadatos Fila 1
      ws.mergeCells('B4:D4');
      ws.getCell('A4').value = 'Especialista:';
      ws.getCell('B4').value = therapistName;
      ws.getCell('E4').value = 'Fecha Emisión:';
      ws.getCell('F4').value = new Date().toLocaleString('es-BO');
      ws.getCell('G4').value = 'Total Sesiones:';
      ws.getCell('H4').value = records.length;

      // Fila 5: Tarjeta Resumen Metadatos Fila 2
      ws.mergeCells('B5:D5');
      ws.mergeCells('F5:H5');
      ws.getCell('A5').value = 'Honorarios Total:';
      ws.getCell('B5').value = `Bs. ${totalBs.toFixed(2)} (QR: Bs. ${totalQr.toFixed(2)} | Efectivo: Bs. ${totalEfe.toFixed(2)})`;
      ws.getCell('E5').value = 'Periodo Auditado:';
      ws.getCell('F5').value = periodInfo.label;

      [4, 5].forEach(rowNum => {
        const r = ws.getRow(rowNum);
        r.height = 22;
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
          const cell = ws.getCell(`${col}${rowNum}`);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CARD_BG } };
          cell.border = borderThin;
          const isLabel = ['A4', 'E4', 'G4', 'A5', 'E5'].includes(`${col}${rowNum}`);
          cell.font = {
            name: 'Segoe UI',
            size: 9,
            bold: isLabel,
            color: { argb: isLabel ? COLOR_NAVY : 'FF334155' }
          };
          cell.alignment = { vertical: 'middle', horizontal: ['G4', 'H4'].includes(`${col}${rowNum}`) ? 'center' : 'left' };
        });
      });

      // Fila 6: Separador
      ws.getRow(6).height = 12;

      // Fila 7: Cabeceras de Tabla
      const headers = [
        'N° Registro / Cita',
        'Fecha y Hora',
        'Paciente',
        'Tutor Legal',
        'Servicio / Prestación Clínica',
        'Arancel (Bs.)',
        'Método de Pago',
        'Estado'
      ];
      const headerRow = ws.getRow(7);
      headerRow.values = headers;
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_WHITE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
        cell.border = borderThin;
      });

      // Anchos de columna holgados para evitar palabras cortadas
      const colWidths = [18, 20, 28, 28, 36, 18, 22, 18];
      colWidths.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
      });

      // Filas de datos
      let currentRowIndex = 8;
      records.forEach((r, idx) => {
        const dRow = ws.getRow(currentRowIndex);
        const monto = Number(r.monto || r.monto_bob) || 0;
        const fechaRaw = r.cita_fecha_hora || r.cita_fecha || r.fecha_pago || r.created_at || r.fecha_creacion;
        const fechaStr = fechaRaw ? this.formatDateTime(fechaRaw) : 'Fecha no registrada';
        const idLabel = r.cita_id ? `CITA-${r.cita_id}` : `ORD-${r.id}`;
        const metodoLabel = (r.metodo_pago === 'QR_BANCO' || r.metodo_pago === 'QR_SIMPLE')
          ? 'QR Institucional'
          : r.metodo_pago === 'EFECTIVO'
          ? 'Efectivo en Consultorio'
          : (r.metodo_pago || 'No especificado');

        dRow.values = [
          idLabel,
          fechaStr,
          r.paciente_nombre || 'Paciente',
          r.tutor_nombre || 'No registrado',
          r.servicio_nombre || 'Consulta Clínica',
          monto,
          metodoLabel,
          r.estado || 'PENDIENTE'
        ];
        dRow.height = 22;

        const isEven = idx % 2 === 0;
        const rowBg = isEven ? COLOR_WHITE : COLOR_ZEBRA;

        dRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1E293B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
          cell.border = borderThin;
          cell.alignment = { vertical: 'middle' };

          if ([1, 2, 7].includes(colNumber)) {
            cell.alignment.horizontal = 'center';
          }
          if (colNumber === 1) {
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
          }
          if (colNumber === 6) {
            cell.alignment.horizontal = 'right';
            cell.numFmt = '#,##0.00 "Bs."';
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
          }
          if (colNumber === 8) {
            cell.alignment.horizontal = 'center';
            cell.font = {
              name: 'Segoe UI',
              size: 9,
              bold: true,
              color: {
                argb: (r.estado === 'VERIFICADO' || r.estado === 'COMPLETADO') ? COLOR_SUCCESS : (r.estado === 'EN_REVISION' ? 'FFD97706' : 'FF64748B')
              }
            };
          }
        });

        currentRowIndex++;
      });

      // Fila de Total
      const totRow = ws.getRow(currentRowIndex);
      ws.mergeCells(`A${currentRowIndex}:E${currentRowIndex}`);
      totRow.getCell(1).value = 'TOTAL HONORARIOS PERCIBIDOS (BS.):';
      totRow.getCell(6).value = totalBs;
      totRow.height = 26;

      const totalBorder = {
        top: { style: 'thin', color: { argb: COLOR_PURPLE } },
        bottom: { style: 'double', color: { argb: COLOR_NAVY } },
        left: { style: 'thin', color: { argb: COLOR_BORDER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER } }
      };

      for (let c = 1; c <= 8; c++) {
        const cell = totRow.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
        cell.border = totalBorder;
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_NAVY } };
        cell.alignment = { vertical: 'middle' };
        if (c === 1) cell.alignment.horizontal = 'right';
        if (c === 6) {
          cell.alignment.horizontal = 'right';
          cell.numFmt = '#,##0.00 "Bs."';
        }
      }

      // Descarga de archivo XLSX
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileName = `Planilla_Honorarios_${therapistName.replace(/[^a-zA-Z0-9]/g, '_')}_${periodInfo.slug}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Toast.success('¡Planilla de honorarios en Excel descargada exitosamente!');
    } catch (err) {
      console.error('Error al exportar Excel terapeuta:', err);
      Toast.error('No se pudo generar la planilla en Excel.');
    }
  }

  // EXPORTACIÓN A EXCEL: ADMINISTRACIÓN (Consolidado o Filtrado)
  async exportAdminExcel(records) {
    try {
      const periodInfo = this.getPeriodRangeAndLabel();
      const wb = new ExcelJS.Workbook();
      wb.creator = 'PSI Aprende - Centro Clínico';
      wb.created = new Date();

      let therapistLabel = 'Todos los Especialistas';
      if (this.currentFilterTherapist !== 'ALL') {
        const found = this.therapists.find(t => String(t.id) === String(this.currentFilterTherapist));
        if (found) therapistLabel = found.nombre_completo || found.nombre;
      }

      const ws = wb.addWorksheet('Flujo de Caja', {
        views: [{ showGridLines: true }]
      });

      const COLOR_NAVY = 'FF27345F';
      const COLOR_PURPLE = 'FF584294';
      const COLOR_CARD_BG = 'FFF4F1FA';
      const COLOR_ZEBRA = 'FFFAF9FD';
      const COLOR_WHITE = 'FFFFFFFF';
      const COLOR_TOTAL_BG = 'FFEDE9FE';
      const COLOR_BORDER = 'FFE2DCF0';
      const COLOR_SUCCESS = 'FF059669';

      const borderThin = {
        top: { style: 'thin', color: { argb: COLOR_BORDER } },
        left: { style: 'thin', color: { argb: COLOR_BORDER } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER } }
      };

      // Fila 1: Título Institucional Banner
      ws.mergeCells('A1:K1');
      const t1 = ws.getCell('A1');
      t1.value = 'CENTRO PSICOPEDAGÓGICO Y DE ATENCIÓN PSICOLÓGICA "PSI APRENDE"';
      t1.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLOR_WHITE } };
      t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
      t1.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 32;

      // Fila 2: Subtítulo
      ws.mergeCells('A2:K2');
      const t2 = ws.getCell('A2');
      t2.value = `REPORTE OFICIAL DE AUDITORÍA CONTABLE Y CAJA - ${periodInfo.label.toUpperCase()}`;
      t2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_WHITE } };
      t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PURPLE } };
      t2.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 22;

      // Fila 3: Separador
      ws.getRow(3).height = 10;

      // Totales
      let totalRecaudado = 0;
      let totalQr = 0;
      let totalEfectivo = 0;
      records.forEach(r => {
        const monto = Number(r.monto || r.monto_bob) || 0;
        if (r.estado === 'COMPLETADO' || r.estado === 'VERIFICADO') {
          totalRecaudado += monto;
          if (['QR_BANCO', 'QR_SIMPLE', 'TRANSFERENCIA'].includes(r.metodo_pago)) totalQr += monto;
          if (r.metodo_pago === 'EFECTIVO') totalEfectivo += monto;
        }
      });

      // Fila 4: Metadatos Fila 1
      ws.mergeCells('B4:D4');
      ws.mergeCells('F4:H4');
      ws.mergeCells('J4:K4');
      ws.getCell('A4').value = 'Ámbito de Auditoría:';
      ws.getCell('B4').value = therapistLabel;
      ws.getCell('E4').value = 'Periodo Auditado:';
      ws.getCell('F4').value = periodInfo.label;
      ws.getCell('I4').value = 'Total Registros:';
      ws.getCell('J4').value = records.length;

      // Fila 5: Metadatos Fila 2 (KPIs de Recaudación)
      ws.mergeCells('B5:C5');
      ws.mergeCells('E5:F5');
      ws.mergeCells('H5:I5');
      ws.mergeCells('J5:K5');
      ws.getCell('A5').value = 'Recaudado Total:';
      ws.getCell('B5').value = `Bs. ${totalRecaudado.toFixed(2)}`;
      ws.getCell('D5').value = 'Cobro QR Banco:';
      ws.getCell('E5').value = `Bs. ${totalQr.toFixed(2)}`;
      ws.getCell('G5').value = 'Cobro Efectivo:';
      ws.getCell('H5').value = `Bs. ${totalEfectivo.toFixed(2)}`;
      ws.getCell('J5').value = `Emisión: ${new Date().toLocaleDateString('es-BO')}`;

      [4, 5].forEach(rowNum => {
        const r = ws.getRow(rowNum);
        r.height = 22;
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach(col => {
          const cell = ws.getCell(`${col}${rowNum}`);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CARD_BG } };
          cell.border = borderThin;
          const isLabel = ['A4', 'E4', 'I4', 'A5', 'D5', 'G5'].includes(`${col}${rowNum}`);
          cell.font = {
            name: 'Segoe UI',
            size: 9,
            bold: isLabel,
            color: { argb: isLabel ? COLOR_NAVY : 'FF334155' }
          };
          cell.alignment = { vertical: 'middle', horizontal: ['I4', 'J4', 'K4'].includes(`${col}${rowNum}`) ? 'center' : 'left' };
        });
      });

      // Fila 6: Separador
      ws.getRow(6).height = 12;

      // Fila 7: Cabeceras
      const headers = [
        'N° Pago',
        'N° Cita / Ref',
        'Fecha y Hora',
        'Paciente',
        'Tutor Legal',
        'Especialista Asignado',
        'Servicio Clínico',
        'Arancel (Bs.)',
        'Método',
        'Estado',
        'N° Ref. Transacción'
      ];
      const headerRow = ws.getRow(7);
      headerRow.values = headers;
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_WHITE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderThin;
      });

      // Anchos de columna holgados
      const colWidths = [14, 15, 20, 26, 26, 26, 34, 18, 20, 18, 24];
      colWidths.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
      });

      // Filas de datos
      let currentRowIndex = 8;
      records.forEach((r, idx) => {
        const dRow = ws.getRow(currentRowIndex);
        const monto = Number(r.monto || r.monto_bob) || 0;
        const fechaRaw = r.cita_fecha_hora || r.cita_fecha || r.fecha_pago || r.created_at || r.fecha_creacion;
        const fechaStr = fechaRaw ? this.formatDateTime(fechaRaw) : 'Fecha no registrada';
        const citaLabel = r.cita_id ? `CITA-${r.cita_id}` : `ORD-${r.id}`;
        const metodoLabel = (r.metodo_pago === 'QR_BANCO' || r.metodo_pago === 'QR_SIMPLE')
          ? 'QR Institucional'
          : r.metodo_pago === 'EFECTIVO'
          ? 'Efectivo en Caja'
          : (r.metodo_pago || 'No especificado');

        dRow.values = [
          `PAG-${r.id}`,
          citaLabel,
          fechaStr,
          r.paciente_nombre || 'N/A',
          r.tutor_nombre || 'N/A',
          r.terapeuta_nombre || 'N/A',
          r.servicio_nombre || 'Consulta Clínica',
          monto,
          metodoLabel,
          r.estado || 'PENDIENTE',
          r.numero_transaccion || '-'
        ];
        dRow.height = 22;

        const isEven = idx % 2 === 0;
        const rowBg = isEven ? COLOR_WHITE : COLOR_ZEBRA;

        dRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1E293B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
          cell.border = borderThin;
          cell.alignment = { vertical: 'middle' };

          if ([1, 2, 3, 9, 11].includes(colNumber)) {
            cell.alignment.horizontal = 'center';
          }
          if (colNumber === 1 || colNumber === 2) {
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
          }
          if (colNumber === 8) {
            cell.alignment.horizontal = 'right';
            cell.numFmt = '#,##0.00 "Bs."';
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
          }
          if (colNumber === 10) {
            cell.alignment.horizontal = 'center';
            cell.font = {
              name: 'Segoe UI',
              size: 9,
              bold: true,
              color: {
                argb: (r.estado === 'VERIFICADO' || r.estado === 'COMPLETADO') ? COLOR_SUCCESS : (r.estado === 'EN_REVISION' ? 'FFD97706' : 'FF64748B')
              }
            };
          }
        });

        currentRowIndex++;
      });

      // Filas de Resumen de Totales
      const totalBorder = {
        top: { style: 'thin', color: { argb: COLOR_PURPLE } },
        bottom: { style: 'double', color: { argb: COLOR_NAVY } },
        left: { style: 'thin', color: { argb: COLOR_BORDER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER } }
      };

      const appendTotalRow = (label, val, rowColor) => {
        const row = ws.getRow(currentRowIndex);
        ws.mergeCells(`A${currentRowIndex}:G${currentRowIndex}`);
        row.getCell(1).value = label;
        row.getCell(8).value = val;
        row.height = 24;

        for (let c = 1; c <= 11; c++) {
          const cell = row.getCell(c);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
          cell.border = totalBorder;
          cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: rowColor || COLOR_NAVY } };
          cell.alignment = { vertical: 'middle' };
          if (c === 1) cell.alignment.horizontal = 'right';
          if (c === 8) {
            cell.alignment.horizontal = 'right';
            cell.numFmt = '#,##0.00 "Bs."';
          }
        }
        currentRowIndex++;
      };

      appendTotalRow('TOTAL RECAUDADO VERIFICADO (BS.):', totalRecaudado, COLOR_NAVY);
      appendTotalRow('TOTAL COBRADO POR QR OFICIAL (BS.):', totalQr, 'FF2563EB');
      appendTotalRow('TOTAL COBRADO EN EFECTIVO (BS.):', totalEfectivo, 'FF1D4ED8');

      // Descarga
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileName = `Reporte_Caja_PSI_Aprende_${therapistLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${periodInfo.slug}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Toast.success('¡Reporte oficial de caja exportado exitosamente!');
    } catch (err) {
      console.error('Error al exportar Excel admin:', err);
      Toast.error('No se pudo generar el reporte en Excel.');
    }
  }

  // MODAL PARA EMITIR Y HABILITAR ORDEN DE COBRO A PACIENTE / TUTOR
  async openEmitPaymentModal() {
    const modalContainer = document.getElementById('modal-container-cash');
    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 580px; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15); text-align: center;">
          <div style="display: inline-flex; animation: spin 1s linear infinite;">${Icons.pulse(24, 'var(--soft-purple-primary)')}</div>
          <p style="color: var(--text-secondary); margin-top: 0.75rem; font-size: 0.88rem;">Cargando catálogo de pacientes y tarifario clínico...</p>
        </div>
      </div>
    `;

    try {
      // 1. Obtener pacientes
      const patientsRes = await apiClient.get('/patients').catch(() => ({ data: [] }));
      const patients = patientsRes.data || [];

      // 2. Obtener tarifario de servicios
      const user = store.getState().user;
      let tariffs = [];
      let baseFee = 150;
      if (user?.rol === 'TERAPEUTA') {
        if (!this.therapistConfig) {
          try {
            const confRes = await apiClient.get('/payments/my-tariff');
            this.therapistConfig = confRes.data;
          } catch (e) {}
        }
        tariffs = this.therapistConfig?.tariffs || [];
        baseFee = Number(this.therapistConfig?.arancel_base_bob) || 150;
      }

      if (tariffs.length === 0) {
        tariffs = [
          { servicio_id: 1, servicio_nombre: 'Evaluación Neuropsicológica Integral', arancel_terapeuta_bob: 220 },
          { servicio_id: 2, servicio_nombre: 'Intervención Psicopedagógica', arancel_terapeuta_bob: 160 },
          { servicio_id: 3, servicio_nombre: 'Psicoterapia Infantil / Adolescente', arancel_terapeuta_bob: 150 },
          { servicio_id: 4, servicio_nombre: 'Terapia de Lenguaje y Comunicación', arancel_terapeuta_bob: 150 },
          { servicio_id: 5, servicio_nombre: 'Consulta de Orientación y Diagnóstico', arancel_terapeuta_bob: 150 }
        ];
      }

      modalContainer.innerHTML = `
        <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
          <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 580px; max-height: 92vh; overflow-y: auto; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--brand-navy); display: flex; align-items: center; gap: 0.5rem;">
                ${Icons.wallet(20, 'var(--soft-purple-primary)')}
                <span>Habilitar Orden de Cobro a Paciente / Tutor</span>
              </h3>
              <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2" style="padding: 0.35rem 0.65rem;">
                ${Icons.close(16)}
              </button>
            </div>

            <p style="font-size: 0.84rem; color: var(--text-secondary); margin: 0 0 1.25rem 0; line-height: 1.45;">
              Seleccione al paciente y el servicio prestado. El sistema fijará automáticamente el arancel según su tarifario personal y mostrará su código QR bancario al tutor para que realice el pago y adjunte su comprobante.
            </p>

            <form id="form-emit-payment">
              <!-- SELECTOR DE PACIENTE -->
              <div class="form-group" style="margin-bottom: 1rem;">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem; display: block;">
                  Seleccionar Paciente / Familia: <span style="color: #DC2626;">*</span>
                </label>
                <select id="emit-pay-patient" class="form-input" required style="width: 100%; padding: 0.5rem 0.75rem; font-size: 0.88rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; box-sizing: border-box;">
                  <option value="">-- Seleccionar Paciente --</option>
                  ${patients.map(p => {
                    const tutorInfo = p.tutor_nombres ? ` · Tutor: ${this.escapeHtml(p.tutor_nombres)} ${this.escapeHtml(p.tutor_apellidos || '')}` : '';
                    return `<option value="${p.id}" data-patient-name="${this.escapeHtml(p.nombres)} ${this.escapeHtml(p.apellidos || '')}">
                      ${this.escapeHtml(p.nombres)} ${this.escapeHtml(p.apellidos || '')} (${this.escapeHtml(p.codigo_expediente || 'EXP')})${tutorInfo}
                    </option>`;
                  }).join('')}
                </select>
              </div>

              <!-- SELECTOR DE SERVICIO CLINICO / TARIFARIO -->
              <div class="form-group" style="margin-bottom: 1rem;">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem; display: block;">
                  Tipo de Atención / Prestación Clínica: <span style="color: #DC2626;">*</span>
                </label>
                <select id="emit-pay-service" class="form-input" required style="width: 100%; padding: 0.5rem 0.75rem; font-size: 0.88rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; box-sizing: border-box;">
                  ${tariffs.map(t => `
                    <option value="${this.escapeHtml(t.servicio_nombre)}" data-price="${t.arancel_terapeuta_bob || t.arancel_base_clinica || baseFee}">
                      ${this.escapeHtml(t.servicio_nombre)} — Bs. ${t.arancel_terapeuta_bob || t.arancel_base_clinica || baseFee}
                    </option>
                  `).join('')}
                  <option value="Consulta General / Particular" data-price="${baseFee}">
                    Consulta General / Particular — Bs. ${baseFee}
                  </option>
                </select>
              </div>

              <!-- ARANCEL A COBRAR EN BOLIVIANOS -->
              <div class="form-group" style="margin-bottom: 1.15rem;">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem; display: block;">
                  Arancel a Cobrar (Bs.): <span style="color: #DC2626;">*</span>
                </label>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-weight: 800; color: var(--soft-purple-primary); font-size: 1.05rem;">Bs.</span>
                  <input type="number" min="1" max="50000" step="1" id="emit-pay-amount" class="form-input" value="${tariffs[0]?.arancel_terapeuta_bob || baseFee}" required style="padding: 0.5rem 0.75rem; font-size: 1.05rem; font-weight: 800; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; width: 140px; box-sizing: border-box;" />
                  <span style="font-size: 0.78rem; color: var(--text-secondary);">Editable en caso de descuento o arancel particular</span>
                </div>
              </div>

              <!-- MENSAJE PERSONALIZADO PARA EL TUTOR -->
              <div class="form-group" style="margin-bottom: 1.25rem;">
                <label class="form-label" style="font-size: 0.82rem; font-weight: 700; color: var(--brand-navy); margin-bottom: 0.35rem; display: block;">
                  Mensaje Explicativo para el Tutor:
                </label>
                <textarea id="emit-pay-message" class="form-input" rows="3" style="width: 100%; padding: 0.5rem 0.75rem; font-size: 0.85rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; line-height: 1.4; box-sizing: border-box;"></textarea>
                <div style="font-size: 0.73rem; color: var(--text-secondary); margin-top: 0.25rem;">
                  Este mensaje aparecerá en el portal del tutor junto a su código QR y datos bancarios.
                </div>
              </div>

              <!-- AVISO DE QR VINCULADO -->
              <div style="background: #F8F7FC; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 12px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.65rem;">
                <span style="color: var(--soft-purple-primary);">${Icons.info(18, 'currentColor')}</span>
                <span>El tutor recibirá prioritariamente su <strong>Código QR Personal</strong> cargado en el sistema. En caso de no haber cargado uno propio o estar vencido, se mostrará el QR institucional de contingencia.</span>
              </div>

              <!-- BOTONES -->
              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1rem;">
                <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2">Cancelar</button>
                <button type="submit" id="btn-submit-emit" class="soft-btn soft-btn-lvl-1">
                  ${Icons.check(15, '#FFFFFF')}
                  <span>Habilitar y Emitir Cobro</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      `;

      // Eventos del modal
      modalContainer.querySelectorAll('.btn-close-modal').forEach(b => {
        b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
      });

      const patientSelect = document.getElementById('emit-pay-patient');
      const serviceSelect = document.getElementById('emit-pay-service');
      const amountInput = document.getElementById('emit-pay-amount');
      const messageTextarea = document.getElementById('emit-pay-message');

      const updateMessage = () => {
        const patientName = patientSelect.selectedOptions[0]?.getAttribute('data-patient-name') || 'del paciente';
        const serviceName = serviceSelect.value || 'atención clínica';
        messageTextarea.value = `Estimado(a) tutor(a): Se ha habilitado la orden de pago por la sesión de ${serviceName} para el paciente ${patientName}. Por favor escanee el código QR adjunto para realizar su transferencia y suba su comprobante bancario.`;
      };

      serviceSelect.addEventListener('change', () => {
        const selectedOpt = serviceSelect.selectedOptions[0];
        const price = selectedOpt?.getAttribute('data-price');
        if (price) amountInput.value = price;
        updateMessage();
      });

      patientSelect.addEventListener('change', () => {
        updateMessage();
      });

      // Inicializar mensaje por defecto
      updateMessage();

      const formEmit = document.getElementById('form-emit-payment');
      formEmit.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pacienteId = patientSelect.value;
        if (!pacienteId) {
          Toast.error('Por favor seleccione al paciente a cobrar.');
          return;
        }

        const payload = {
          paciente_id: Number(pacienteId),
          servicio_nombre: serviceSelect.value,
          monto_bob: Number(amountInput.value) || baseFee,
          mensaje_tutor: messageTextarea.value.trim()
        };

        const submitBtn = document.getElementById('btn-submit-emit');
        if (submitBtn) submitBtn.disabled = true;

        try {
          await apiClient.post('/payments/request', payload);
          Toast.success('¡Orden de cobro emitida exitosamente! El tutor ya puede ver su código QR y arancel.');
          modalContainer.innerHTML = '';
          await this.loadData();
          this.renderContent();
        } catch (err) {
          if (submitBtn) submitBtn.disabled = false;
          Toast.error(err.message || 'Error al emitir orden de cobro');
        }
      });

    } catch (err) {
      console.error('Error al abrir modal emitir cobro:', err);
      Toast.error('No se pudo cargar la información para emitir cobro.');
      modalContainer.innerHTML = '';
    }
  }

  // MODAL VISOR DE COMPROBANTE SUBIDO
  getProtectedReceiptUrl(payment) {
    if (!payment?.comprobante_url) return '';
    if (payment.comprobante_url.startsWith('data:')) return payment.comprobante_url;
    const token = store.getState().token || '';
    return `/api/payments/${payment.id}/receipt-file?token=${encodeURIComponent(token)}`;
  }

  openReceiptViewerModal(paymentId) {
    const payment = this.payments.find(p => String(p.id) === String(paymentId));
    if (!payment) return;

    const modalContainer = document.getElementById('modal-container-cash');
    const isImage = payment.comprobante_url && !payment.comprobante_url.toLowerCase().endsWith('.pdf');
    const receiptSrc = this.getProtectedReceiptUrl(payment);

    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--brand-navy); display: flex; align-items: center; gap: 0.5rem;">
              ${Icons.receipt(20, 'var(--soft-purple-primary)')}
              <span>Comprobante de Transferencia Bancaria</span>
            </h3>
            <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2" style="padding: 0.35rem 0.65rem;">${Icons.close(16)}</button>
          </div>

          <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem; font-size: 0.86rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
              <div><strong>Paciente:</strong> ${this.escapeHtml(payment.paciente_nombre)}</div>
              <div><strong>Arancel:</strong> <span style="color: var(--soft-purple-primary); font-weight: 700;">${this.formatMoney(payment.monto)}</span></div>
              <div><strong>Tutor:</strong> ${this.escapeHtml(payment.tutor_nombre)}</div>
              <div><strong>Especialista:</strong> ${this.escapeHtml(payment.terapeuta_nombre)}</div>
              ${payment.numero_transaccion ? `<div style="grid-column: span 2;"><strong>N° Referencia / Operación:</strong> <code>${this.escapeHtml(payment.numero_transaccion)}</code></div>` : ''}
              ${payment.observaciones ? `<div style="grid-column: span 2; color: var(--text-secondary);"><strong>Glosa/Nota:</strong> ${this.escapeHtml(payment.observaciones)}</div>` : ''}
            </div>
          </div>

          <div style="text-align: center; margin-bottom: 1.5rem; background: #F1F5F9; border-radius: 12px; padding: 1rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0);">
            ${isImage ? `
              <img src="${receiptSrc}" alt="Comprobante de Pago" style="max-width: 100%; max-height: 380px; object-fit: contain; border-radius: 8px;" />
            ` : `
              <div style="padding: 2rem 1rem;">
                <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto 1rem;">${Icons.filePdf(28, '#DC2626')}</div>
                <p style="margin: 0 0 1rem; font-weight: 600; color: var(--brand-navy);">Comprobante en Documento PDF</p>
                <a href="${receiptSrc}" target="_blank" class="soft-btn soft-btn-lvl-1" style="font-size: 0.85rem; display: inline-flex;">
                  ${Icons.externalLink(16, '#FFFFFF')}
                  <span>Abrir Documento PDF en Nueva Pestaña</span>
                </a>
              </div>
            `}
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2">Cerrar</button>
          </div>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });
  }

  // MODAL DE VALIDACIÓN Y APROBACIÓN DUAL (ADMIN, RECEPCION O TERAPEUTA)
  openReceiptVerificationModal(paymentId) {
    const payment = this.payments.find(p => String(p.id) === String(paymentId));
    if (!payment) return;

    const modalContainer = document.getElementById('modal-container-cash');
    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 620px; max-height: 90vh; overflow-y: auto; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--brand-navy); display: flex; align-items: center; gap: 0.5rem;">
              ${Icons.checkCircle(20, 'var(--soft-mint-deep)')}
              <span>Validación de Comprobante de Pago</span>
            </h3>
            <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2" style="padding: 0.35rem 0.65rem;">${Icons.close(16)}</button>
          </div>

          <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Verifique la coincidencia del arancel transferido con el importe oficial de la sesión. Al aprobar el pago, el recibo se registrará en caja institucional con fe pública interna.
          </p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem; background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 12px; padding: 1rem; font-size: 0.86rem;">
            <div><strong>Paciente:</strong> ${this.escapeHtml(payment.paciente_nombre)}</div>
            <div><strong>Arancel Oficial:</strong> <span style="font-weight: 800; color: var(--soft-purple-primary);">${this.formatMoney(payment.monto)}</span></div>
            <div><strong>Tutor Legal:</strong> ${this.escapeHtml(payment.tutor_nombre)}</div>
            <div><strong>Especialista:</strong> ${this.escapeHtml(payment.terapeuta_nombre)}</div>
            ${payment.numero_transaccion ? `<div style="grid-column: span 2;"><strong>Referencia Bancaria:</strong> <code>${this.escapeHtml(payment.numero_transaccion)}</code></div>` : ''}
          </div>

          ${payment.comprobante_url ? `
            <div style="text-align: center; margin-bottom: 1.25rem; background: #F8FAFC; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 12px; padding: 0.75rem;">
              <img src="${this.getProtectedReceiptUrl(payment)}" alt="Comprobante" style="max-height: 260px; max-width: 100%; object-fit: contain; border-radius: 6px;" />
            </div>
          ` : ''}

          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Observaciones de Verificación (Opcional):</label>
            <input type="text" id="verify-notes" class="form-input" placeholder="Ej: Depósito bancario verificado en extracto oficial Banco Unión" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%;" />
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1.25rem;">
            <button type="button" id="btn-reject-payment" class="soft-btn soft-btn-lvl-2" style="color: #DC2626; border-color: #FECACA;">
              ${Icons.close(16, '#DC2626')}
              <span>Rechazar Comprobante</span>
            </button>

            <div style="display: flex; gap: 0.75rem;">
              <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2">Cancelar</button>
              <button type="button" id="btn-approve-payment" class="soft-btn soft-btn-lvl-1" style="background: var(--soft-mint-deep); box-shadow: 0 4px 14px rgba(0, 135, 121, 0.3);">
                ${Icons.check(16, '#FFFFFF')}
                <span>Aprobar y Registrar en Caja</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });

    document.getElementById('btn-approve-payment')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const notas = document.getElementById('verify-notes').value.trim();
      btn.disabled = true;
      try {
        await apiClient.post(`/payments/${payment.id}/verify`, {
          estado: 'COMPLETADO',
          observaciones: notas || 'Pago QR validado conforme a arancel institucional'
        });
        Toast.success('¡Pago validado y aprobado exitosamente!');
        modalContainer.innerHTML = '';
        await this.loadData();
        this.renderContent();
      } catch (err) {
        btn.disabled = false;
        Toast.error(err.message || 'Error al validar el pago');
      }
    });

    document.getElementById('btn-reject-payment')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const motivo = prompt('Por favor, especifique el motivo del rechazo del comprobante (ej: Importe insuficiente o imagen ilegible):');
      if (!motivo) return;

      btn.disabled = true;
      try {
        await apiClient.post(`/payments/${payment.id}/verify`, {
          estado: 'RECHAZADO',
          motivo_rechazo: motivo
        });
        Toast.info('El comprobante fue marcado como Rechazado.');
        modalContainer.innerHTML = '';
        await this.loadData();
        this.renderContent();
      } catch (err) {
        btn.disabled = false;
        Toast.error(err.message || 'Error al rechazar comprobante');
      }
    });
  }

  // MODAL PARA EL TUTOR: PAGAR CON QR OFICIAL Y SUBIR COMPROBANTE
  openTutorPayQrModal(paymentId, appointmentId) {
    const payment = this.payments.find(p => String(p.id) === String(paymentId));
    const config = this.qrConfig || {};
    const qrImageUrl = config.PAGO_QR_IMAGEN || '/uploads/qr/default_qr_psi_aprende.svg';
    const amount = payment ? payment.monto : 150;
    const patientName = payment?.paciente_nombre || 'Paciente';
    const therapistName = payment?.terapeuta_nombre || 'Especialista Asignado';
    const serviceName = payment?.servicio_nombre || 'Consulta Clínica';

    const modalContainer = document.getElementById('modal-container-cash');
    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 580px; max-height: 92vh; overflow-y: auto; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--brand-navy); display: flex; align-items: center; gap: 0.5rem;">
              ${Icons.qrCode(20, 'var(--soft-purple-primary)')}
              <span>Pago de Consulta con QR Oficial</span>
            </h3>
            <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2" style="padding: 0.35rem 0.65rem;">${Icons.close(16)}</button>
          </div>

          <!-- MENSAJE INFORMATIVO AL TUTOR -->
          <div class="soft-card" style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 12px; padding: 1rem 1.15rem; margin-bottom: 1.25rem;">
            <p style="margin: 0; color: var(--brand-navy); font-size: 0.88rem; line-height: 1.5;">
              Estimado(a) tutor(a): El arancel correspondiente a la sesión de <strong>${this.escapeHtml(serviceName)}</strong> del paciente <strong>${this.escapeHtml(patientName)}</strong> con el/la especialista <strong>${this.escapeHtml(therapistName)}</strong> es de <strong style="color: var(--soft-purple-primary); font-size: 1rem;">${this.formatMoney(amount)}</strong>.
            </p>
            <p style="margin: 0.5rem 0 0; color: var(--text-secondary); font-size: 0.82rem;">
              Por favor, escanee el código QR oficial del centro con su aplicación bancaria móvil (Banco Unión, BCP, BNB, etc.) y adjunte la captura o foto de la transferencia.
            </p>
          </div>

          <!-- IMAGEN DEL QR INSTITUCIONAL -->
          <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; padding: 1.25rem; text-align: center; margin-bottom: 1.25rem;">
            <img src="${qrImageUrl}?t=${Date.now()}" alt="QR Oficial Banco" style="max-height: 220px; width: auto; object-fit: contain; border-radius: 8px; margin: 0 auto; display: block;" />
            <div style="margin-top: 0.75rem; font-size: 0.84rem; color: var(--brand-navy); font-weight: 700;">
              ${this.escapeHtml(config.PAGO_BANCO_NOMBRE || 'Banco Unión S.A.')} · Cta: ${this.escapeHtml(config.PAGO_CUENTA_NUMERO || '1000004829103')}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-secondary);">
              Titular: ${this.escapeHtml(config.PAGO_CUENTA_TITULAR || 'Centro PSI Aprende SRL')}
            </div>
          </div>

          <!-- FORMULARIO DE SUBIDA DEL COMPROBANTE -->
          <form id="form-upload-tutor-receipt">
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Adjuntar Captura o Foto del Comprobante (JPG, PNG, PDF):</label>
              <input type="file" id="tutor-receipt-file" class="form-input" accept="image/png,image/jpeg,image/webp,application/pdf" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem; font-size: 0.85rem; width: 100%;" />
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Número de Transacción / Referencia Bancaria (Opcional):</label>
              <input type="text" id="tutor-tx-number" class="form-input" placeholder="Ej: 94827103" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%;" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1rem;">
              <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2">Cancelar</button>
              <button type="submit" class="soft-btn soft-btn-lvl-1">
                ${Icons.upload(16, '#FFFFFF')}
                <span>Enviar Comprobante para Validación</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });

    const form = document.getElementById('form-upload-tutor-receipt');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('tutor-receipt-file');
      if (!fileInput.files || fileInput.files.length === 0) {
        Toast.error('Por favor adjunte el comprobante de su transferencia.');
        return;
      }

      const txNum = document.getElementById('tutor-tx-number').value.trim();
      const formData = new FormData();
      formData.append('comprobante', fileInput.files[0]);
      if (txNum) formData.append('numero_transaccion', txNum);

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        Toast.info('Subiendo comprobante de pago...');
        // Si no existe pago previo, asegurar con ensurePayment
        let actualPaymentId = paymentId;
        if (!actualPaymentId || actualPaymentId === 'null') {
          const ensureRes = await apiClient.get(`/payments/appointment/${appointmentId}`);
          actualPaymentId = ensureRes.data?.id;
        }

        await apiClient.request(`/payments/${actualPaymentId}/upload-receipt`, {
          method: 'POST',
          body: formData
        });

        Toast.success('¡Comprobante enviado exitosamente! Queda en revisión para su validación por el especialista o recepción.');
        modalContainer.innerHTML = '';
        await this.loadData();
        this.renderContent();
      } catch (err) {
        if (submitBtn) submitBtn.disabled = false;
        Toast.error(err.message || 'Error al subir el comprobante');
      }
    });
  }

  // MODAL REGISTRO DE COBRO EN EFECTIVO (ADMIN / RECEPCIÓN / TERAPEUTA)
  openCashPaymentModal(preselectedAppointmentId = null, preselectedAmount = null) {
    const modalContainer = document.getElementById('modal-container-cash');
    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 520px; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--brand-navy); display: flex; align-items: center; gap: 0.5rem;">
              ${Icons.wallet(20, 'var(--soft-purple-primary)')}
              <span>Registrar Cobro en Efectivo en Consultorio</span>
            </h3>
            <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2" style="padding: 0.35rem 0.65rem;">${Icons.close(16)}</button>
          </div>

          <form id="form-cash-register">
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">ID de la Cita Médica / Consulta:</label>
              <input type="number" min="1" step="1" id="cash-appointment-id" class="form-input" value="${preselectedAppointmentId || ''}" placeholder="Ej: 101" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%;" />
            </div>

            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Monto Percibido en Efectivo (Bs.):</label>
              <input type="number" min="0.01" max="50000" step="0.01" id="cash-amount" class="form-input" value="${preselectedAmount || '150.00'}" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%;" />
            </div>

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600;">Nota / Observaciones de Caja:</label>
              <input type="text" id="cash-notes" class="form-input" placeholder="Ej: Pago directo en recepción al ingresar a consulta" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%;" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1rem;">
              <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2">Cancelar</button>
              <button type="submit" class="soft-btn soft-btn-lvl-1">
                ${Icons.check(16, '#FFFFFF')}
                <span>Registrar Ingreso en Efectivo</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });

    document.getElementById('form-cash-register')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const apptId = document.getElementById('cash-appointment-id').value.trim();
      const monto = document.getElementById('cash-amount').value.trim();
      const notas = document.getElementById('cash-notes').value.trim();

      const apptNum = Number(apptId);
      const montoNum = Number(monto);
      if (!Number.isInteger(apptNum) || apptNum <= 0) {
        Toast.error('El ID de la cita debe ser un número entero positivo.');
        return;
      }
      if (!Number.isFinite(montoNum) || montoNum <= 0 || montoNum > 50000) {
        Toast.error('El monto en efectivo debe ser un importe mayor a 0 Bs.');
        return;
      }

      const submitBtn = e.currentTarget.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        await apiClient.post(`/payments/cash/${apptId}`, {
          monto: Number(monto),
          observaciones: notas
        });
        Toast.success('¡Cobro en efectivo asentado en caja exitosamente!');
        modalContainer.innerHTML = '';
        await this.loadData();
        this.renderContent();
      } catch (err) {
        if (submitBtn) submitBtn.disabled = false;
        Toast.error(err.message || 'Error al asentar cobro en efectivo');
      }
    });
  }

  // RECIBO OFICIAL DIGITAL PARA IMPRESIÓN BIOÉTICA
  openOfficialReceiptModal(paymentId) {
    const payment = this.payments.find(p => String(p.id) === String(paymentId));
    if (!payment) return;

    const modalContainer = document.getElementById('modal-container-cash');
    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card print-receipt-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 600px; max-height: 92vh; overflow-y: auto; padding: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
          <!-- CABECERA INSTITUCIONAL DEL RECIBO -->
          <div style="text-align: center; border-bottom: 2px solid var(--brand-purple); padding-bottom: 1rem; margin-bottom: 1.5rem;">
            <div style="font-size: 0.8rem; font-weight: 800; letter-spacing: 0.08em; color: var(--brand-purple); text-transform: uppercase;">
              Centro Psicopedagógico y de Atención Psicológica
            </div>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--brand-navy); margin: 0.25rem 0;">
              ${this.escapeHtml(store.getState().publicConfig?.INSTITUCION_NOMBRE || 'PSI APRENDE')}
            </h2>
            <div style="font-size: 0.78rem; color: var(--text-secondary);">
              ${this.escapeHtml(store.getState().publicConfig?.INSTITUCION_DIRECCION || 'Calle Ladislao Cabrera entre Calle Antezana y Calle 16 de Julio, Cochabamba, Bolivia')} · NIT 847291024
            </div>
            <div style="margin-top: 0.65rem; display: inline-block; background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 9999px; padding: 0.25rem 1rem; font-size: 0.78rem; font-weight: 700; color: var(--brand-navy);">
              RECIBO OFICIAL DE CAJA N° REC-${String(payment.id).padStart(6, '0')}
            </div>
          </div>

          <!-- DATOS DE LA ATENCIÓN -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem; font-size: 0.85rem;">
            <div><strong>Fecha de Emisión:</strong> ${this.formatDateTime(payment.fecha_aprobacion || payment.fecha_verificacion || payment.fecha_creacion || payment.created_at || payment.fecha_pago)}</div>
            <div><strong>Registro Asociado:</strong> ${payment.cita_id ? `Cita #${payment.cita_id}` : `Orden de Cobro #${payment.id}`}</div>
            <div><strong>Paciente:</strong> ${this.escapeHtml(payment.paciente_nombre)}</div>
            <div><strong>Tutor Responsable:</strong> ${this.escapeHtml(payment.tutor_nombre || 'No registrado')}</div>
            <div style="grid-column: span 2;"><strong>Especialista Asignado:</strong> ${this.escapeHtml(payment.terapeuta_nombre)} (${this.escapeHtml(payment.terapeuta_especialidad || 'Especialista')})</div>
          </div>

          <!-- DETALLE DEL SERVICIO Y MONTO -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.85rem;">
            <thead>
              <tr style="background: #F8F7FC; border-top: 1px solid var(--soft-border-card-inner, #E2DCF0); border-bottom: 1px solid var(--soft-border-card-inner, #E2DCF0);">
                <th style="padding: 0.65rem 0.75rem; text-align: left;">Concepto / Prestación Clínica</th>
                <th style="padding: 0.65rem 0.75rem; text-align: right;">Importe</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding: 0.75rem;">
                  <div style="font-weight: 600; color: var(--brand-navy);">${this.escapeHtml(payment.servicio_nombre || 'Consulta Clínica Especializada')}</div>
                  <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.15rem;">
                    Método: ${payment.metodo_pago === 'QR_BANCO' ? 'Transferencia QR Institucional' : 'Efectivo en Consultorio'}
                    ${payment.numero_transaccion ? ` · Ref: ${this.escapeHtml(payment.numero_transaccion)}` : ''}
                  </div>
                </td>
                <td style="padding: 0.75rem; text-align: right; font-weight: 800; color: var(--brand-navy); font-size: 1rem;">
                  ${this.formatMoney(payment.monto)}
                </td>
              </tr>
              <tr style="border-top: 1px solid var(--soft-border-card-inner, #E2DCF0); background: #FAF9FD;">
                <td style="padding: 0.75rem; font-weight: 700; color: var(--brand-navy);">TOTAL CANCELADO:</td>
                <td style="padding: 0.75rem; text-align: right; font-weight: 800; color: var(--soft-purple-primary); font-size: 1.1rem;">
                  ${this.formatMoney(payment.monto)}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- FIRMA BIOÉTICA Y CONSTANCIA -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; text-align: center; margin-top: 2.25rem; padding-top: 1rem; border-top: 1px dashed var(--soft-divider, #EAE5F5); font-size: 0.78rem;">
            <div>
              <div style="height: 55px;"></div>
              <div style="border-top: 1px solid #CBD5E1; padding-top: 0.35rem; font-weight: 600; color: var(--brand-navy);">
                ${this.escapeHtml(payment.aprobado_por_nombre || 'Caja / Recepción')}
              </div>
              <div style="color: var(--text-secondary); font-size: 0.72rem;">Validado y Asentado en Caja</div>
            </div>

            <div>
              <div style="height: 55px;"></div>
              <div style="border-top: 1px solid #CBD5E1; padding-top: 0.35rem; font-weight: 600; color: var(--brand-navy);">
                ${this.escapeHtml(payment.tutor_nombre || 'Tutor Responsable')}
              </div>
              <div style="color: var(--text-secondary); font-size: 0.72rem;">Conformidad de Atención</div>
            </div>
          </div>

          <!-- BOTONES DE ACCIÓN (Ocultos en impresión) -->
          <div class="no-print" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.75rem; border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1rem;">
            <button type="button" class="btn-close-modal soft-btn soft-btn-lvl-2">Cerrar</button>
            <button type="button" id="btn-trigger-print" class="soft-btn soft-btn-lvl-1">
              ${Icons.printer(16, '#FFFFFF')}
              <span>Imprimir Recibo</span>
            </button>
          </div>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.btn-close-modal').forEach(b => {
      b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });

    document.getElementById('btn-trigger-print')?.addEventListener('click', () => {
      this.printReceiptIsolated(payment);
    });
  }

  printReceiptIsolated(payment) {
    const instNombre = store.getState().publicConfig?.INSTITUCION_NOMBRE || 'Centro Psicopedagógico y de Atención Psicológica "PSI Aprende"';
    const instDireccion = store.getState().publicConfig?.INSTITUCION_DIRECCION || 'Calle Ladislao Cabrera entre Calle Antezana y Calle 16 de Julio, Cochabamba, Bolivia';
    const instTelefono = store.getState().publicConfig?.INSTITUCION_TELEFONO || '+591 4 4521234';

    const fechaEmision = this.formatDateTime(payment.fecha_aprobacion || payment.fecha_verificacion || payment.fecha_creacion || payment.created_at || payment.fecha_pago);
    const regAsociado = payment.cita_id ? `Cita #${payment.cita_id}` : `Orden de Cobro #${payment.id}`;

    const contentHtml = `
      <div style="max-width: 680px; margin: 0 auto; padding: 14px 22px; border: 1.5px solid #27345F; border-radius: 12px; page-break-inside: avoid; break-inside: avoid;">
        <!-- CABECERA INSTITUCIONAL -->
        <div style="text-align: center; border-bottom: 2px solid #27345F; padding-bottom: 10px; margin-bottom: 14px;">
          <div style="font-size: 8pt; font-weight: 800; letter-spacing: 0.08em; color: #584294; text-transform: uppercase;">
            Centro Psicopedagógico y de Atención Psicológica
          </div>
          <h2 style="font-size: 13.5pt; font-weight: 800; color: #27345F; margin: 3px 0 2px 0;">
            ${this.escapeHtml(instNombre)}
          </h2>
          <div style="font-size: 7.8pt; color: #64748B;">
            ${this.escapeHtml(instDireccion)} · NIT 847291024 · Telf: ${this.escapeHtml(instTelefono)}
          </div>
          <div style="margin-top: 8px; display: inline-block; background: #F8F7FC; border: 1.5px solid #584294; border-radius: 9999px; padding: 3px 14px; font-size: 8.5pt; font-weight: 800; color: #27345F;">
            RECIBO OFICIAL DE CAJA N° REC-${String(payment.id).padStart(6, '0')}
          </div>
        </div>

        <!-- DATOS DE LA ATENCIÓN -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin-bottom: 14px; font-size: 8pt; line-height: 1.35;">
          <div><strong style="color: #475569;">Fecha de Emisión:</strong> <span style="color: #0F172A;">${fechaEmision}</span></div>
          <div><strong style="color: #475569;">Registro Asociado:</strong> <span style="color: #0F172A;">${regAsociado}</span></div>
          <div><strong style="color: #475569;">Paciente:</strong> <strong style="color: #27345F;">${this.escapeHtml(payment.paciente_nombre)}</strong></div>
          <div><strong style="color: #475569;">Tutor Responsable:</strong> <span style="color: #0F172A;">${this.escapeHtml(payment.tutor_nombre || 'No registrado')}</span></div>
          <div style="grid-column: span 2;"><strong style="color: #475569;">Especialista Asignado:</strong> <span style="color: #0F172A;">${this.escapeHtml(payment.terapeuta_nombre)} (${this.escapeHtml(payment.terapeuta_especialidad || 'Especialista')})</span></div>
        </div>

        <!-- DETALLE DEL SERVICIO Y MONTO -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 8pt;">
          <thead>
            <tr style="background: #F1F5F9; border-top: 1px solid #CBD5E1; border-bottom: 1px solid #CBD5E1;">
              <th style="padding: 6px 8px; text-align: left; color: #334155;">Concepto / Prestación Clínica</th>
              <th style="padding: 6px 8px; text-align: right; color: #334155; width: 130px;">Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 8px;">
                <div style="font-weight: 700; color: #0F172A;">${this.escapeHtml(payment.servicio_nombre || 'Consulta Clínica Especializada')}</div>
                <div style="font-size: 7.4pt; color: #64748B; margin-top: 2px;">
                  Método: ${payment.metodo_pago === 'QR_BANCO' ? 'Transferencia QR Institucional' : 'Efectivo en Consultorio'}
                  ${payment.numero_transaccion ? ` · Ref: ${this.escapeHtml(payment.numero_transaccion)}` : ''}
                </div>
              </td>
              <td style="padding: 8px; text-align: right; font-weight: 800; color: #0F172A; font-size: 9.5pt;">
                ${this.formatMoney(payment.monto)}
              </td>
            </tr>
            <tr style="border-top: 1.5px solid #27345F; background: #FAF9FD;">
              <td style="padding: 8px; font-weight: 800; color: #27345F; font-size: 8.5pt;">TOTAL CANCELADO:</td>
              <td style="padding: 8px; text-align: right; font-weight: 800; color: #584294; font-size: 10.5pt;">
                ${this.formatMoney(payment.monto)}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- SEPARACIÓN Y ESPACIO GENEROSO PARA LA FIRMA -->
        <div style="margin-top: 28px; padding-top: 12px; border-top: 1px dashed #CBD5E1; page-break-inside: avoid; break-inside: avoid;">
          <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 7.8pt;">
            <tr>
              <td style="width: 46%; vertical-align: bottom; padding: 0 10px;">
                <!-- Espacio vertical despejado para firma y sello manual -->
                <div style="height: 58px;"></div>
                <div style="border-top: 1.5px solid #27345F; padding-top: 4px;">
                  <strong style="color: #0F172A; font-size: 8.5pt;">${this.escapeHtml(payment.aprobado_por_nombre || 'Caja / Recepción')}</strong>
                  <div style="color: #64748B; font-size: 7.2pt; margin-top: 1px;">Validado y Asentado en Caja</div>
                  <div style="color: #94A3B8; font-size: 6.8pt;">Centro "PSI Aprende"</div>
                </div>
              </td>
              <td style="width: 8%;"></td>
              <td style="width: 46%; vertical-align: bottom; padding: 0 10px;">
                <!-- Espacio vertical despejado para firma y sello manual -->
                <div style="height: 58px;"></div>
                <div style="border-top: 1.5px solid #27345F; padding-top: 4px;">
                  <strong style="color: #0F172A; font-size: 8.5pt;">${this.escapeHtml(payment.tutor_nombre || 'Tutor Responsable')}</strong>
                  <div style="color: #64748B; font-size: 7.2pt; margin-top: 1px;">Conformidad de Atención y Pago</div>
                  <div style="color: #94A3B8; font-size: 6.8pt;">Firma o Rúbrica</div>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <!-- PIE INSTITUCIONAL DE SEGURIDAD -->
        <div style="margin-top: 18px; text-align: center; font-size: 6.8pt; color: #94A3B8; border-top: 1px solid #F1F5F9; padding-top: 4px;">
          Documento oficial de caja emitido por la Plataforma Web PWA "PSI Aprende" · Ley 164 · Válido como constancia de prestación clínica.
        </div>
      </div>
    `;

    printIsolatedDocument({
      title: `Recibo de Caja - REC-${String(payment.id).padStart(6, '0')}`,
      contentHtml
    });
  }
}
