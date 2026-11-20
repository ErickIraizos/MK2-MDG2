import { store } from '../../store.js';
import { apiClient } from '../../api/apiClient.js';
import { Toast } from '../../components/Toast.js';
import { Icons } from '../../components/Icons.js';
import { SignatureCanvas } from '../../components/SignatureCanvas.js';
import mammoth from 'mammoth';
import Chart from 'chart.js/auto';

export class DashboardView {
  constructor(container) {
    this.container = container;
    this.currentPeriod = 'month'; // 'week' | 'month' | 'quarter' | 'year' | 'all'
    this.chartInstances = [];
    
    // Estado para rol TUTOR
    this.familyPlans = [];
    this.selectedChildId = null;
    this.childConsents = [];
    this.childReports = [];
    this.hasActiveConsent = false;
    this.signatureCanvasInstance = null;
  }

  /**
   * Destruye de forma segura los gráficos activos de Chart.js para evitar fugas o conflictos de canvas
   */
  destroyCharts() {
    if (this.chartInstances && this.chartInstances.length > 0) {
      this.chartInstances.forEach(chart => {
        try {
          chart.destroy();
        } catch (e) {
          console.warn('Error al destruir gráfico Chart.js:', e);
        }
      });
      this.chartInstances = [];
    }
  }

  _getInstLocationLabel() {
    const raw = store.getState().publicConfig?.INSTITUCION_DIRECCION;
    if (raw) {
      return `Centro "PSI Aprende" · ${raw.split(',')[0]}`;
    }
    return 'Centro "PSI Aprende" · Sede Central';
  }

  async render() {
    const user = store.getState().user;
    if (!user) {
      window.location.hash = '#/login';
      return;
    }

    this.destroyCharts();

    // Renderizar spinner inicial Soft UI
    this.container.innerHTML = `
      <div class="page-container panel-general" style="text-align: center; padding: 4rem 1.5rem;">
        <div class="soft-spinner soft-spinner-lg" style="margin: 0 auto 1.25rem auto;"></div>
        <p style="color: var(--soft-text-body); font-size: 0.95rem; font-weight: 500;">
          Cargando panel de información institucional...
        </p>
      </div>
    `;

    try {
      let roomsStatus = [];
      let adminAnalytics = null;
      let therapistAnalytics = null;
      let familyPlans = [];

      // Llamada base para estado de consultorios
      const roomsRes = await apiClient.get('/rooms/status').catch(() => ({ success: false, data: [] }));
      roomsStatus = roomsRes?.data || [];

      if (user.rol === 'ADMIN') {
        const res = await apiClient.get(`/analytics/admin?period=${this.currentPeriod}`).catch(err => {
          console.warn('Error al cargar analítica ejecutiva:', err);
          return { success: false, data: null };
        });
        adminAnalytics = res?.data || null;
        this.renderAdminView(user, adminAnalytics, roomsStatus);
      } else if (user.rol === 'TERAPEUTA') {
        const res = await apiClient.get(`/analytics/therapist/my-summary?period=${this.currentPeriod}`).catch(err => {
          console.warn('Error al cargar analítica del terapeuta:', err);
          return { success: false, data: null };
        });
        therapistAnalytics = res?.data || null;
        this.renderTherapistView(user, therapistAnalytics, roomsStatus);
      } else if (user.rol === 'TUTOR') {
        const famRes = await apiClient.get('/clinical-records/portal/family-plans').catch(() => ({ success: false, data: [] }));
        familyPlans = famRes?.data || [];
        this.familyPlans = familyPlans;
        if (!this.selectedChildId && familyPlans.length > 0) {
          this.selectedChildId = familyPlans[0].paciente.id;
        }
        if (this.selectedChildId) {
          const [checkRes, consentsRes, reportsRes] = await Promise.all([
            apiClient.get('/consents/check/' + this.selectedChildId).catch(() => ({ success: false, data: { hasActiveConsent: false } })),
            apiClient.get('/consents/patient/' + this.selectedChildId).catch(() => ({ success: false, data: [] })),
            apiClient.get('/reports/patient/' + this.selectedChildId).catch(() => ({ success: false, data: [] }))
          ]);
          this.hasActiveConsent = !!checkRes?.data?.hasActiveConsent;
          this.childConsents = consentsRes?.data || [];
          this.childReports = reportsRes?.data || [];
        } else {
          this.hasActiveConsent = false;
          this.childConsents = [];
          this.childReports = [];
        }
        this.renderTutorView(user, familyPlans, roomsStatus);
      } else {
        // RECEPCION u otros roles
        this.renderReceptionView(user, roomsStatus);
      }
    } catch (err) {
      console.error('Error al inicializar dashboard:', err);
      this.container.innerHTML = `
        <div class="page-container panel-general" style="text-align: center; padding: 3rem 1.5rem;">
          <div style="color: var(--soft-text-title); margin-bottom: 0.5rem; font-size: 1.1rem; font-weight: 700;">
            No se pudo cargar el panel de control
          </div>
          <p style="color: var(--soft-text-body); font-size: 0.88rem; margin-bottom: 1.25rem;">
            ${this._escapeHtml(err.message || 'Error de conexión con el servidor')}
          </p>
          <button type="button" id="btn-retry-dashboard" class="soft-btn soft-btn-lvl-1">
            Reintentar
          </button>
        </div>
      `;
      document.getElementById('btn-retry-dashboard')?.addEventListener('click', () => this.render());
    }
  }

  // ==============================================================================
  // VISTA 1: DASHBOARD EJECUTIVO GLOBAL (EXCLUSIVO PARA ADMIN · MGR. GRISEL AGUILAR)
  // ==============================================================================
  renderAdminView(user, data, roomsStatus) {
    const kpis = data?.kpis || {
      total_verificado_bob: 0,
      total_pendiente_bob: 0,
      total_historico_bob: 0,
      total_pacientes_activos: 0,
      total_terapeutas_activos: 0,
      total_ambientes_activos: 3,
      total_citas: 0,
      tasa_asistencia_pct: 100
    };

    const periodLabels = {
      week: 'Esta Semana',
      month: 'Este Mes',
      quarter: 'Trimestre',
      year: 'Año en Curso',
      all: 'Todo el Histórico'
    };

    this.container.innerHTML = `
      <div class="page-container panel-general">
        
        <!-- CABECERA EJECUTIVA SOFT UI MÉDICA -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                <span class="soft-status-dot"></span>
                <span>Dirección General · Acceso Ejecutivo</span>
              </span>
              <span class="soft-location-label">
                ${this._escapeHtml(this._getInstLocationLabel())}
              </span>
            </div>
            <h1 class="soft-page-title">
              Panel Ejecutivo &amp; Inteligencia Clínica
            </h1>
            <p class="soft-page-subtitle">
              Supervisión de salud financiera, tasa de ocupación de consultorios físicos, distribución de especialidades y productividad del equipo.
            </p>
          </div>

          <div class="soft-header-actions">
            <a href="#/appointments" class="soft-btn soft-btn-lvl-1">
              ${Icons.calendar(16, '#FFFFFF')}
              <span>Agenda &amp; Consultorios</span>
            </a>
            <a href="#/admin/rooms" class="soft-btn soft-btn-lvl-1">
              ${Icons.rooms(16, '#FFFFFF')}
              <span>Consultorios y Salas</span>
            </a>
            <a href="#/admin/settings" class="soft-btn soft-btn-lvl-1-muted">
              ${Icons.settings(16, 'var(--soft-purple-primary)')}
              <span>Ajustes del Sistema</span>
            </a>
          </div>
        </div>

        <!-- SELECTOR DE PERÍODO HORIZONTAL CON PROTECCIÓN ANTI-RECORTE -->
        <div class="tabs-scroll-container" style="margin-bottom: 1.35rem;">
          <button type="button" class="soft-btn btn-period-tab ${this.currentPeriod === 'month' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-period="month">
            ${Icons.calendar(15, this.currentPeriod === 'month' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
            <span>Este Mes</span>
          </button>
          <button type="button" class="soft-btn btn-period-tab ${this.currentPeriod === 'week' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-period="week">
            ${Icons.pulse(15, this.currentPeriod === 'week' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
            <span>Esta Semana</span>
          </button>
          <button type="button" class="soft-btn btn-period-tab ${this.currentPeriod === 'quarter' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-period="quarter">
            <span>Trimestre</span>
          </button>
          <button type="button" class="soft-btn btn-period-tab ${this.currentPeriod === 'year' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-period="year">
            <span>Año 2026</span>
          </button>
          <button type="button" class="soft-btn btn-period-tab ${this.currentPeriod === 'all' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-period="all">
            <span>Histórico Total</span>
          </button>
        </div>

        <!-- FRANJA DE KPIS EJECUTIVOS SOFT UI (4 TARJETAS) -->
        <div class="soft-kpi-grid">
          
          <div class="soft-kpi-card">
            <span class="soft-status-dot-green" title="Flujo financiero activo"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.wallet(24, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Recaudación en Caja · ${periodLabels[this.currentPeriod]}</span>
              <div class="soft-kpi-value">
                Bs. ${kpis.total_verificado_bob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
              </div>
              <div class="soft-kpi-sub">
                Pendiente de conciliar: Bs. ${kpis.total_pendiente_bob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <span class="soft-status-dot-green" title="Pacientes en seguimiento"></span>
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.patient(24, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Población Clínica Activa</span>
              <div class="soft-kpi-value">
                ${kpis.total_pacientes_activos} Pacientes
              </div>
              <div class="soft-kpi-sub">
                ${kpis.total_terapeutas_activos} especialistas acreditados CPB
              </div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <span class="soft-status-dot-green" title="Adherencia a sesiones"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.pulse(24, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Tasa de Asistencia Global</span>
              <div class="soft-kpi-value">
                ${kpis.tasa_asistencia_pct}% Cumplimiento
              </div>
              <div class="soft-kpi-sub">
                ${kpis.total_citas} citas programadas en el período
              </div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <span class="soft-status-dot-green" title="Infraestructura habilitada"></span>
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.rooms(24, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Capacidad Instalada</span>
              <div class="soft-kpi-value">
                ${roomsStatus.length} Consultorios
              </div>
              <div class="soft-kpi-sub">
                Ambientes físicos con algoritmo RN-01
              </div>
            </div>
          </div>

        </div>

        <!-- CUADRÍCULA DE GRÁFICOS BUSINESS INTELLIGENCE (CHART.JS) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 1.35rem; margin-bottom: 1.5rem;">
          
          <!-- GRÁFICO 1: DISTRIBUCIÓN POR ESPECIALIDAD CLÍNICA -->
          <div class="soft-section-card" style="margin-bottom: 0;">
            <div class="soft-section-header">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.pieChart ? Icons.pieChart(18, 'var(--soft-purple-primary)') : Icons.pulse(18, 'var(--soft-purple-primary)')}
                </div>
                <div>
                  <h3 class="soft-section-title">Distribución de Pacientes por Especialidad</h3>
                  <p class="soft-section-subtitle">Población activa distribuida según área clínica de tratamiento</p>
                </div>
              </div>
              <span class="soft-badge soft-badge-lavender">Módulo M · BI</span>
            </div>
            <div style="position: relative; height: 280px; width: 100%; display: flex; align-items: center; justify-content: center; padding: 0.5rem 0;">
              <canvas id="chart-admin-specialties"></canvas>
            </div>
          </div>

          <!-- GRÁFICO 2: TASA DE OCUPACIÓN DE LOS 3 CONSULTORIOS -->
          <div class="soft-section-card" style="margin-bottom: 0;">
            <div class="soft-section-header">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                  ${Icons.rooms(18, 'var(--soft-mint-deep)')}
                </div>
                <div>
                  <h3 class="soft-section-title">Ocupación de Consultorios Físicos</h3>
                  <p class="soft-section-subtitle">Porcentaje de uso y horas en los 3 ambientes de atención (RN-01)</p>
                </div>
              </div>
              <span class="soft-badge soft-badge-mint">3 Salas Físicas</span>
            </div>
            <div style="position: relative; height: 280px; width: 100%; display: flex; align-items: center; justify-content: center; padding: 0.5rem 0;">
              <canvas id="chart-admin-rooms"></canvas>
            </div>
          </div>

          <!-- GRÁFICO 3: TENDENCIA DE INGRESOS Y MODALIDADES DE COBRO -->
          <div class="soft-section-card" style="margin-bottom: 0;">
            <div class="soft-section-header">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.wallet(18, 'var(--soft-purple-primary)')}
                </div>
                <div>
                  <h3 class="soft-section-title">Tendencia de Ingresos en Bolivianos (BOB)</h3>
                  <p class="soft-section-subtitle">Recaudación verificada por Simple QR, transferencias y efectivo</p>
                </div>
              </div>
              <span class="soft-badge soft-badge-emerald">
                <span class="soft-status-dot"></span>
                <span>Caja y Finanzas</span>
              </span>
            </div>
            <div style="position: relative; height: 280px; width: 100%; display: flex; align-items: center; justify-content: center; padding: 0.5rem 0;">
              <canvas id="chart-admin-revenue"></canvas>
            </div>
          </div>

          <!-- GRÁFICO 4: MATRIZ DE ADHERENCIA CLÍNICA & AUSENTISMO -->
          <div class="soft-section-card" style="margin-bottom: 0;">
            <div class="soft-section-header">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                  ${Icons.calendar(18, 'var(--soft-mint-deep)')}
                </div>
                <div>
                  <h3 class="soft-section-title">Adherencia Clínica &amp; Asistencia</h3>
                  <p class="soft-section-subtitle">Proporción de sesiones atendidas frente a ausentismos y cancelaciones</p>
                </div>
              </div>
              <span class="soft-badge soft-badge-lavender">WhatsApp Scheduler</span>
            </div>
            <div style="position: relative; height: 280px; width: 100%; display: flex; align-items: center; justify-content: center; padding: 0.5rem 0;">
              <canvas id="chart-admin-adherence"></canvas>
            </div>
          </div>

        </div>

        <!-- TABLA DE PRODUCTIVIDAD Y BALANCE DE ESPECIALISTAS -->
        <div class="soft-section-card">
          <div class="soft-section-header">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.therapist(18, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 class="soft-section-title">Rendimiento y Liquidación de Especialistas</h3>
                <p class="soft-section-subtitle">Balance de horas clínicas, sesiones cobradas y comisiones por terapeuta</p>
              </div>
            </div>
            <span class="soft-badge soft-badge-lavender">Equipo Colegiado CPB</span>
          </div>

          <div class="soft-table-wrap">
            <table class="soft-table">
              <thead>
                <tr>
                  <th>Especialista</th>
                  <th>Especialidad</th>
                  <th>Matrícula CPB</th>
                  <th>Citas Atendidas</th>
                  <th>Horas Clínicas</th>
                  <th>Recaudación Bruta</th>
                  <th>Honorarios (%)</th>
                  <th style="text-align: right;">Margen Centro</th>
                </tr>
              </thead>
              <tbody>
                ${(data?.therapists_productivity || []).length === 0 ? `
                  <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: var(--soft-text-muted);">
                      No se registran datos de productividad en el período seleccionado.
                    </td>
                  </tr>
                ` : (data.therapists_productivity || []).map(t => `
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <div class="soft-avatar-sm">${t.nombre_completo.split(' ').map(n => n[0]).slice(0, 2).join('')}</div>
                        <strong>${this._escapeHtml(t.nombre_completo)}</strong>
                      </div>
                    </td>
                    <td>
                      <span class="soft-specialty-tag">${this._escapeHtml(t.especialidad)}</span>
                    </td>
                    <td>
                      <span class="soft-badge soft-badge-lavender">${this._escapeHtml(t.registro_profesional)}</span>
                    </td>
                    <td><strong>${t.citas_atendidas}</strong> de ${t.total_citas}</td>
                    <td>${t.horas_atendidas} h</td>
                    <td><strong>Bs. ${t.recaudado_bruto_bob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</strong></td>
                    <td>
                      <span style="color: var(--soft-purple-primary); font-weight: 700;">
                        Bs. ${t.honorarios_terapeuta_bob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                      </span>
                      <small style="color: var(--soft-text-muted);"> (${t.porcentaje_honorarios}%)</small>
                    </td>
                    <td style="text-align: right;">
                      <span class="soft-badge soft-badge-emerald">
                        Bs. ${t.margen_centro_bob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- ESTADO OPERATIVO DE CONSULTORIOS FÍSICOS (CON .soft-status-dot Y SIN EMOJIS) -->
        <div class="soft-section-card">
          <div class="soft-section-header">
            <div>
              <h3 class="soft-section-title">
                Estado Operativo de Consultorios Físicos (${roomsStatus.length})
              </h3>
              <p class="soft-section-subtitle">
                Monitoreo en tiempo real de disponibilidad para evitar colisiones entre especialistas (RN-01)
              </p>
            </div>
            <a href="#/admin/rooms" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted">
              Gestionar Salas
            </a>
          </div>

          <div class="soft-rooms-grid">
            ${roomsStatus.map((room, index) => {
              const isMintAccent = index % 2 !== 0;
              const codeBadgeClass = isMintAccent ? 'soft-badge-mint' : 'soft-badge-lavender';
              const roomAccentClass = isMintAccent ? 'soft-room-mint' : '';
              const formattedTipo = (room.tipo || '').replace(/_/g, ' ');

              return `
                <div class="soft-room-card ${roomAccentClass}">
                  <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; gap: 0.5rem;">
                      <span class="soft-badge ${codeBadgeClass}" style="font-weight: 800;">
                        ${this._escapeHtml(room.codigo)}
                      </span>
                      <span class="soft-badge ${room.activo ? 'soft-badge-emerald' : 'soft-badge-amber'}">
                        <span class="soft-status-dot"></span>
                        <span>${room.activo ? 'Disponible' : 'Mantenimiento'}</span>
                      </span>
                    </div>

                    <h4 style="font-size: 1.06rem; font-weight: 800; color: var(--soft-text-title); margin-bottom: 0.45rem; line-height: 1.32;">
                      ${this._escapeHtml(room.nombre)}
                    </h4>
                    <div style="font-size: 0.83rem; color: var(--soft-text-body); display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem;">
                      <span>Especialidad:</span>
                      <span class="soft-specialty-tag">${this._escapeHtml(formattedTipo)}</span>
                    </div>
                  </div>

                  <div class="soft-room-footer">
                    <span>Control de Turnos</span>
                    <span style="font-weight: 700; color: var(--soft-emerald-dark);">Libre</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

      </div>
    `;

    this.attachPeriodEvents();
    this.renderAdminCharts(data);
  }

  /**
   * Instancia los 4 gráficos Chart.js del Dashboard Ejecutivo
   */
  renderAdminCharts(data) {
    if (!data) return;

    // Configuración tipográfica y de temas Soft UI
    Chart.defaults.font.family = "'Outfit', 'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = '#696F8C';

    // 1. Gráfico de Especialidades (Dona satinada)
    const specCanvas = document.getElementById('chart-admin-specialties');
    if (specCanvas && data.specialties && data.specialties.length > 0) {
      const labels = data.specialties.map(s => s.label);
      const counts = data.specialties.map(s => s.count);
      const colors = ['#584294', '#15968D', '#4B53A6', '#F59E0B', '#E97669', '#10B981'];

      const chartSpec = new Chart(specCanvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: counts,
            backgroundColor: colors.slice(0, counts.length),
            borderWidth: 2,
            borderColor: '#FFFFFF',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                borderRadius: 4,
                useBorderRadius: true,
                padding: 12,
                font: { size: 11, weight: 600 }
              }
            },
            tooltip: {
              backgroundColor: '#24285B',
              titleColor: '#FFFFFF',
              bodyColor: '#F8F6FE',
              cornerRadius: 10,
              padding: 10
            }
          },
          cutout: '68%'
        }
      });
      this.chartInstances.push(chartSpec);
    }

    // 2. Gráfico de Ocupación de Consultorios (Barras horizontales)
    const roomCanvas = document.getElementById('chart-admin-rooms');
    if (roomCanvas && data.room_occupancy && data.room_occupancy.length > 0) {
      const labels = data.room_occupancy.map(r => r.codigo + ' · ' + r.nombre.split(' - ')[0]);
      const pcts = data.room_occupancy.map(r => r.ocupacion_pct);
      const colors = ['#584294', '#15968D', '#7B66B5'];

      const chartRooms = new Chart(roomCanvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Ocupación (%)',
            data: pcts,
            backgroundColor: colors.slice(0, pcts.length),
            borderRadius: 8,
            maxBarThickness: 34
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          scales: {
            x: {
              min: 0,
              max: 100,
              grid: { color: 'rgba(110, 86, 176, 0.07)' },
              ticks: { callback: v => v + '%' }
            },
            y: {
              grid: { display: false }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#24285B',
              cornerRadius: 10,
              padding: 10,
              callbacks: {
                label: ctx => `Ocupación: ${ctx.raw}% de la capacidad operativa`
              }
            }
          }
        }
      });
      this.chartInstances.push(chartRooms);
    }

    // 3. Gráfico de Tendencia de Ingresos (Líneas con curva satinada morada)
    const revCanvas = document.getElementById('chart-admin-revenue');
    if (revCanvas) {
      const timeline = data.revenue_timeline || [];
      const labels = timeline.length > 0 ? timeline.map(t => t.fecha_label) : ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
      const amounts = timeline.length > 0 ? timeline.map(t => t.total_bob) : [200, 350, 480, 850];

      const chartRev = new Chart(revCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Ingresos Verificados (BOB)',
            data: amounts,
            borderColor: '#584294',
            backgroundColor: 'rgba(88, 66, 148, 0.08)',
            borderWidth: 3,
            fill: true,
            tension: 0.38,
            pointBackgroundColor: '#584294',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              grid: { display: false }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(110, 86, 176, 0.07)' },
              ticks: { callback: v => 'Bs. ' + v }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#24285B',
              cornerRadius: 10,
              padding: 10,
              callbacks: {
                label: ctx => `Total Verificado: Bs. ${Number(ctx.raw).toFixed(2)}`
              }
            }
          }
        }
      });
      this.chartInstances.push(chartRev);
    }

    // 4. Gráfico de Matriz de Adherencia (Barras)
    const adhCanvas = document.getElementById('chart-admin-adherence');
    if (adhCanvas && data.appointment_status) {
      const labels = data.appointment_status.map(s => s.label);
      const counts = data.appointment_status.map(s => s.count);
      const colors = data.appointment_status.map(s => s.color);

      const chartAdh = new Chart(adhCanvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: counts,
            backgroundColor: colors,
            borderRadius: 8,
            maxBarThickness: 40
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(110, 86, 176, 0.07)' },
              ticks: { stepSize: 1 }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#24285B',
              cornerRadius: 10,
              padding: 10
            }
          }
        }
      });
      this.chartInstances.push(chartAdh);
    }
  }

  // ==============================================================================
  // VISTA 2: DASHBOARD CLÍNICO & RENDIMIENTO PERSONAL (TERAPEUTA)
  // ==============================================================================
  renderTherapistView(user, data, roomsStatus) {
    const kpis = data?.kpis || {
      pacientes_asignados: 0,
      total_citas: 0,
      citas_atendidas: 0,
      horas_impartidas: 0,
      honorarios_verificados_bob: 0,
      honorarios_pendientes_bob: 0
    };

    const therapist = data?.therapist || {
      nombre_completo: user.nombre_completo,
      especialidad: 'Especialista Clínico',
      registro_profesional: 'CPB-Oficial',
      porcentaje_honorarios: 70
    };

    const upcoming = data?.upcoming_appointments || [];
    const pendingTasks = data?.pending_tasks || { pending_soap_count: 0, pending_soap_list: [], pending_plans_count: 0, pending_plans_list: [] };

    this.container.innerHTML = `
      <div class="page-container panel-general">
        
        <!-- CABECERA PERSONAL DEL TERAPEUTA -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-mint">
                <span class="soft-status-dot"></span>
                <span>${this._escapeHtml(therapist.especialidad)} · Matrícula ${this._escapeHtml(therapist.registro_profesional)}</span>
              </span>
              <span class="soft-location-label">
                Consultorio Personal · Centro "PSI Aprende"
              </span>
            </div>
            <h1 class="soft-page-title">
              Mi Panel Clínico &amp; Consultorio Digital
            </h1>
            <p class="soft-page-subtitle">
              Resumen confidencial de tus pacientes asignados, citas agendadas, sesiones atendidas y liquidación de honorarios acumulados.
            </p>
          </div>

          <div class="soft-header-actions">
            <a href="#/appointments" class="soft-btn soft-btn-lvl-1">
              ${Icons.calendar(16, '#FFFFFF')}
              <span>Mi Agenda de Citas</span>
            </a>
            <a href="#/clinical-records" class="soft-btn soft-btn-lvl-1">
              ${Icons.fileText(16, '#FFFFFF')}
              <span>Historias Clínicas</span>
            </a>
            <a href="#/patients" class="soft-btn soft-btn-lvl-1-muted">
              ${Icons.patient(16, 'var(--soft-purple-primary)')}
              <span>Mis Pacientes</span>
            </a>
          </div>
        </div>

        <!-- SELECTOR DE PERÍODO HORIZONTAL ANTI-RECORTE -->
        <div class="tabs-scroll-container" style="margin-bottom: 1.35rem;">
          <button type="button" class="soft-btn btn-period-tab ${this.currentPeriod === 'month' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-period="month">
            ${Icons.calendar(15, this.currentPeriod === 'month' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
            <span>Este Mes</span>
          </button>
          <button type="button" class="soft-btn btn-period-tab ${this.currentPeriod === 'week' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-period="week">
            ${Icons.pulse(15, this.currentPeriod === 'week' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
            <span>Esta Semana</span>
          </button>
          <button type="button" class="soft-btn btn-period-tab ${this.currentPeriod === 'quarter' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-period="quarter">
            <span>Trimestre</span>
          </button>
          <button type="button" class="soft-btn btn-period-tab ${this.currentPeriod === 'all' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" data-period="all">
            <span>Histórico Total</span>
          </button>
        </div>

        <!-- KPIS PERSONALES DEL ESPECIALISTA (4 TARJETAS) -->
        <div class="soft-kpi-grid">
          
          <div class="soft-kpi-card soft-kpi-mint">
            <span class="soft-status-dot-green" title="Casos asignados"></span>
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.patient(24, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Mis Pacientes Asignados</span>
              <div class="soft-kpi-value">
                ${kpis.pacientes_asignados} Pacientes
              </div>
              <div class="soft-kpi-sub">
                Casos bajo tu seguimiento directo
              </div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <span class="soft-status-dot-green" title="Sesiones clínicas"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.calendar(24, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Sesiones Atendidas</span>
              <div class="soft-kpi-value">
                ${kpis.citas_atendidas} Sesiones
              </div>
              <div class="soft-kpi-sub">
                De ${kpis.total_citas} citas agendadas en el período
              </div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <span class="soft-status-dot-green" title="Horas de terapia"></span>
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.pulse(24, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Horas Clínicas Impartidas</span>
              <div class="soft-kpi-value">
                ${kpis.horas_impartidas} Horas
              </div>
              <div class="soft-kpi-sub">
                Tiempo efectivo en consultorio
              </div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <span class="soft-status-dot-green" title="Liquidación personal"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.wallet(24, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Mis Honorarios Acumulados</span>
              <div class="soft-kpi-value" style="color: var(--soft-purple-primary);">
                Bs. ${kpis.honorarios_verificados_bob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
              </div>
              <div class="soft-kpi-sub">
                Por cobrar en caja: Bs. ${kpis.honorarios_pendientes_bob.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

        </div>

        <!-- CUADRÍCULA INTERMEDIA: GRÁFICO PERSONAL Y TAREAS PENDIENTES -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 1.35rem; margin-bottom: 1.5rem;">
          
          <!-- GRÁFICO PERSONAL: DISTRIBUCIÓN DE MIS SESIONES -->
          <div class="soft-section-card" style="margin-bottom: 0;">
            <div class="soft-section-header">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.pulse(18, 'var(--soft-purple-primary)')}
                </div>
                <div>
                  <h3 class="soft-section-title">Distribución de Mis Citas</h3>
                  <p class="soft-section-subtitle">Sesiones atendidas, por atender y cumplimiento de turnos</p>
                </div>
              </div>
              <span class="soft-badge soft-badge-lavender">Mi Consulta</span>
            </div>
            <div style="position: relative; height: 260px; width: 100%; display: flex; align-items: center; justify-content: center;">
              <canvas id="chart-therapist-sessions"></canvas>
            </div>
          </div>

          <!-- TAREAS CLÍNICAS PENDIENTES (NOTAS SOAP Y PLANES) -->
          <div class="soft-section-card" style="margin-bottom: 0;">
            <div class="soft-section-header">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                  ${Icons.edit(18, 'var(--soft-mint-deep)')}
                </div>
                <div>
                  <h3 class="soft-section-title">Alertas Clínicas Pendientes</h3>
                  <p class="soft-section-subtitle">Documentación que requiere tu atención y firma legal</p>
                </div>
              </div>
              <span class="soft-badge ${(pendingTasks.pending_soap_count + pendingTasks.pending_plans_count) > 0 ? 'soft-badge-amber' : 'soft-badge-emerald'}">
                <span class="soft-status-dot"></span>
                <span>${pendingTasks.pending_soap_count + pendingTasks.pending_plans_count} pendientes</span>
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              
              <!-- Alerta Notas SOAP -->
              <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.85rem 1.1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                <div>
                  <strong style="color: var(--soft-text-title); font-size: 0.88rem; display: block; margin-bottom: 0.15rem;">
                    Notas de Evolución SOAP por Redactar
                  </strong>
                  <span style="font-size: 0.78rem; color: var(--soft-text-body);">
                    ${pendingTasks.pending_soap_count > 0 
                      ? `${pendingTasks.pending_soap_count} sesiones completadas sin nota clínica registrada` 
                      : 'Todas tus notas de sesión están al día con firma indisoluble'}
                  </span>
                </div>
                <a href="#/clinical-records?tab=soap" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="white-space: nowrap;">
                  Redactar SOAP
                </a>
              </div>

              <!-- Alerta Planes PTI -->
              <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.85rem 1.1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                <div>
                  <strong style="color: var(--soft-text-title); font-size: 0.88rem; display: block; margin-bottom: 0.15rem;">
                    Planes de Intervención (Metas SMART)
                  </strong>
                  <span style="font-size: 0.78rem; color: var(--soft-text-body);">
                    ${pendingTasks.pending_plans_count > 0 
                      ? `${pendingTasks.pending_plans_count} pacientes asignados requieren plan formal PTI` 
                      : 'Todos tus pacientes asignados tienen plan terapéutico vigente'}
                  </span>
                </div>
                <a href="#/clinical-records?tab=plans" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="white-space: nowrap;">
                  Ver Planes
                </a>
              </div>

              <!-- Acceso a Glosario Clínico -->
              <div style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.85rem 1.1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                <div>
                  <strong style="color: var(--soft-text-title); font-size: 0.88rem; display: block; margin-bottom: 0.15rem;">
                    Glosario de Términos &amp; Diagnósticos CIE-11 / DSM-5
                  </strong>
                  <span style="font-size: 0.78rem; color: var(--soft-text-body);">
                    Consulta criterios nosológicos estandarizados para tus notas
                  </span>
                </div>
                <a href="#/clinical/glossary" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="white-space: nowrap;">
                  Abrir Glosario
                </a>
              </div>

            </div>
          </div>

        </div>

        <!-- PRÓXIMAS SESIONES PROGRAMADAS DE MI AGENDA -->
        <div class="soft-section-card">
          <div class="soft-section-header">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.calendar(18, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 class="soft-section-title">Mis Próximas Citas Convocadas</h3>
                <p class="soft-section-subtitle">Sesiones de hoy y de la semana programadas en los consultorios</p>
              </div>
            </div>
            <a href="#/appointments" class="soft-btn soft-btn-sm soft-btn-lvl-1">
              Ver Agenda Completa
            </a>
          </div>

          ${upcoming.length === 0 ? `
            <div style="text-align: center; padding: 2.25rem 1.5rem; color: var(--soft-text-muted); background: var(--soft-lavender-surface); border-radius: 16px;">
              No tienes citas próximas agendadas para los siguientes días.
            </div>
          ` : `
            <div class="soft-table-wrap">
              <table class="soft-table">
                <thead>
                  <tr>
                    <th>Fecha &amp; Hora</th>
                    <th>Paciente</th>
                    <th>Expediente</th>
                    <th>Consultorio Físico</th>
                    <th>Estado</th>
                    <th style="text-align: right;">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${upcoming.map(c => `
                    <tr>
                      <td>
                        <strong style="color: var(--soft-purple-primary);">
                          ${new Date(c.fecha_hora_inicio).toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </strong>
                        <span style="color: var(--soft-text-muted); font-size: 0.8rem; margin-left: 0.3rem;">
                          ${new Date(c.fecha_hora_inicio).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <strong>${this._escapeHtml(c.paciente_nombres + ' ' + c.paciente_apellidos)}</strong>
                      </td>
                      <td>
                        <span class="soft-badge soft-badge-lavender">${this._escapeHtml(c.codigo_expediente)}</span>
                      </td>
                      <td>
                        <span class="soft-badge soft-badge-mint">${this._escapeHtml(c.ambiente_codigo)} · ${this._escapeHtml(c.ambiente_nombre.split(' - ')[0])}</span>
                      </td>
                      <td>
                        <span class="soft-badge soft-badge-${c.estado === 'ATENDIDA' ? 'emerald' : (c.estado === 'CONFIRMADA' ? 'lavender' : 'amber')}">
                          <span class="soft-status-dot"></span>
                          <span>${this._escapeHtml(c.estado)}</span>
                        </span>
                      </td>
                      <td style="text-align: right;">
                        <a href="#/clinical-records?patientId=${c.paciente_id}&action=soap" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted">
                          Ficha Clínica
                        </a>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- ESTADO DE SALAS PARA EL TERAPEUTA -->
        <div class="soft-section-card">
          <div class="soft-section-header">
            <div>
              <h3 class="soft-section-title">Disponibilidad de Consultorios Físicos (${roomsStatus.length})</h3>
              <p class="soft-section-subtitle">Estado de ocupación de las salas para tus sesiones y evaluaciones</p>
            </div>
          </div>
          <div class="soft-rooms-grid">
            ${roomsStatus.map((room, index) => {
              const isMintAccent = index % 2 !== 0;
              const codeBadgeClass = isMintAccent ? 'soft-badge-mint' : 'soft-badge-lavender';
              const roomAccentClass = isMintAccent ? 'soft-room-mint' : '';
              return `
                <div class="soft-room-card ${roomAccentClass}">
                  <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; gap: 0.5rem;">
                      <span class="soft-badge ${codeBadgeClass}" style="font-weight: 800;">${this._escapeHtml(room.codigo)}</span>
                      <span class="soft-badge ${room.activo ? 'soft-badge-emerald' : 'soft-badge-amber'}">
                        <span class="soft-status-dot"></span>
                        <span>${room.activo ? 'Disponible' : 'Mantenimiento'}</span>
                      </span>
                    </div>
                    <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--soft-text-title); margin-bottom: 0.45rem;">
                      ${this._escapeHtml(room.nombre)}
                    </h4>
                  </div>
                  <div class="soft-room-footer">
                    <span>Ambiente</span>
                    <span style="font-weight: 700; color: var(--soft-emerald-dark);">Habilitado</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

      </div>
    `;

    this.attachPeriodEvents();
    this.renderTherapistCharts(data);
  }

  /**
   * Instancia los gráficos personales del Terapeuta
   */
  renderTherapistCharts(data) {
    if (!data) return;

    Chart.defaults.font.family = "'Outfit', 'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = '#696F8C';

    const canvas = document.getElementById('chart-therapist-sessions');
    if (canvas && data.personal_status_distribution) {
      const labels = data.personal_status_distribution.map(d => d.label);
      const counts = data.personal_status_distribution.map(d => d.count);
      const colors = data.personal_status_distribution.map(d => d.color);

      const chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: counts,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#FFFFFF',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                boxHeight: 12,
                borderRadius: 4,
                useBorderRadius: true,
                padding: 12,
                font: { size: 11, weight: 600 }
              }
            },
            tooltip: {
              backgroundColor: '#24285B',
              cornerRadius: 10,
              padding: 10
            }
          },
          cutout: '66%'
        }
      });
      this.chartInstances.push(chart);
    }
  }

  // ==============================================================================
  // VISTA 3: RECEPCIÓN Y ADMISIÓN
  // ==============================================================================
  renderReceptionView(user, roomsStatus) {
    this.container.innerHTML = `
      <div class="page-container panel-general">
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                <span class="soft-status-dot"></span>
                <span>Recepción &amp; Admisión</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende"</span>
            </div>
            <h1 class="soft-page-title">${this._escapeHtml(user.nombre_completo)}</h1>
            <p class="soft-page-subtitle">Control de sala de espera, asignación de consultorios y caja diaria.</p>
          </div>
          <div class="soft-header-actions">
            <a href="#/appointments" class="soft-btn soft-btn-lvl-1">
              ${Icons.calendar(16, '#FFFFFF')}
              <span>Agenda de Citas</span>
            </a>
            <a href="#/caja" class="soft-btn soft-btn-lvl-1">
              ${Icons.wallet(16, '#FFFFFF')}
              <span>Caja &amp; Pagos QR</span>
            </a>
          </div>
        </div>

        <div class="soft-quick-grid" style="margin-bottom: 1.5rem;">
          <a href="#/patients" class="soft-quick-card soft-quick-card-lavender soft-quick-card-link">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender">${Icons.patient(26, 'var(--soft-purple-primary)')}</div>
            <div>
              <h4 class="soft-quick-title">Expedientes &amp; Familias</h4>
              <p class="soft-quick-desc">Admisión de pacientes, datos de tutores y código PSI.</p>
            </div>
          </a>
          <a href="#/caja" class="soft-quick-card soft-quick-card-mint soft-quick-card-link">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-mint">${Icons.wallet(26, 'var(--soft-mint-deep)')}</div>
            <div>
              <h4 class="soft-quick-title">Caja &amp; Comprobantes Simple QR</h4>
              <p class="soft-quick-desc">Validación de pagos bancarios y emisión de recibos oficiales.</p>
            </div>
          </a>
        </div>

        <div class="soft-section-card">
          <div class="soft-section-header">
            <div>
              <h3 class="soft-section-title">Estado de Salas de Atención (${roomsStatus.length})</h3>
              <p class="soft-section-subtitle">Monitoreo de ambientes físicos en tiempo real (RN-01)</p>
            </div>
          </div>
          <div class="soft-rooms-grid">
            ${roomsStatus.map(room => `
              <div class="soft-room-card">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span class="soft-badge soft-badge-lavender">${this._escapeHtml(room.codigo)}</span>
                  <span class="soft-badge ${room.activo ? 'soft-badge-emerald' : 'soft-badge-amber'}">
                    <span class="soft-status-dot"></span>
                    <span>${room.activo ? 'Disponible' : 'Mantenimiento'}</span>
                  </span>
                </div>
                <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--soft-text-title);">${this._escapeHtml(room.nombre)}</h4>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ==============================================================================
  // VISTA 4: PORTAL FAMILIAR (TUTOR)
  // ==============================================================================
  renderTutorView(user, familyPlans, roomsStatus) {
    const roleBadgeClass = 'soft-badge-indigo';
    const activeChildPlan = familyPlans.find(item => item.paciente?.id === this.selectedChildId) || familyPlans[0] || null;
    const activePlan = (activeChildPlan?.planes && activeChildPlan.planes.length > 0) ? activeChildPlan.planes[0] : (activeChildPlan?.plan || null);
    const activeMetas = (activePlan?.metas && Array.isArray(activePlan.metas)) ? activePlan.metas : (activeChildPlan?.metas || []);

    let therapistName = 'Especialista Asignado';
    if (activePlan?.terapeuta_nombres) {
      therapistName = `${activePlan.terapeuta_nombres} ${activePlan.terapeuta_apellidos || ''}`.trim();
    } else if (activePlan?.terapeuta_nombre) {
      therapistName = activePlan.terapeuta_nombre;
    } else if (activeChildPlan?.paciente?.terapeuta_asignado) {
      therapistName = `${activeChildPlan.paciente.terapeuta_asignado.nombres} ${activeChildPlan.paciente.terapeuta_asignado.apellidos || ''}`.trim();
    }

    this.container.innerHTML = `
      <div class="page-container panel-general">
        
        <!-- ENCABEZADO DEL PORTAL FAMILIAR -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge ${roleBadgeClass}">
                <span class="soft-status-dot"></span>
                <span>Portal Familiar de Acompañamiento</span>
              </span>
              <span class="soft-location-label">
                ${this._escapeHtml(this._getInstLocationLabel())}
              </span>
            </div>
            <h1 class="soft-page-title">
              ${this._escapeHtml(user.nombre_completo)}
            </h1>
            <p class="soft-page-subtitle">
              Portal familiar de acompañamiento, consultas de triaje y directorio de especialistas acreditados.
            </p>
          </div>

          <div class="soft-header-actions">
            <a href="#/appointments" class="soft-btn soft-btn-lvl-1">
              ${Icons.calendar(17, '#FFFFFF')}
              <span>Mis Citas Agendadas</span>
            </a>
            <a href="#/portal/therapists" class="soft-btn soft-btn-lvl-1">
              ${Icons.therapist(17, '#FFFFFF')}
              <span>Ver Especialistas Acreditados</span>
            </a>
            <a href="#/portal/convenios" class="soft-btn soft-btn-lvl-2">
              ${Icons.handshake(17, '#FFFFFF')}
              <span>Alianzas &amp; Convenios</span>
            </a>
          </div>
        </div>

        <!-- KPIS FAMILIARES -->
        <div class="soft-kpi-grid">
          <div class="soft-kpi-card">
            <span class="soft-status-dot-green" title="Servicio en línea"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.pulse(24, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Atención Clínica</span>
              <div class="soft-kpi-value">Servicio Activo</div>
              <div class="soft-kpi-sub">Turnos y consultas en desarrollo</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <span class="soft-status-dot-green" title="Protección activa"></span>
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.shield(24, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Historias Clínicas</span>
              <div class="soft-kpi-value">Expedientes Seguros</div>
              <div class="soft-kpi-sub">Confidencialidad y secreto médico Ley 3131</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <span class="soft-status-dot-green" title="Infraestructura operativa"></span>
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.rooms(24, 'var(--soft-purple-primary)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Capacidad Instalada</span>
              <div class="soft-kpi-value">${roomsStatus.length} Consultorios</div>
              <div class="soft-kpi-sub">Ambientes de atención clínica especializada</div>
            </div>
          </div>

          <a href="#/portal/therapists" class="soft-kpi-card soft-kpi-mint" style="cursor: pointer; text-decoration: none;">
            <span class="soft-status-dot-green" title="Turnos activos"></span>
            <div class="soft-icon-box soft-icon-box-mint">
              ${Icons.therapist(24, 'var(--soft-mint-deep)')}
            </div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Equipo Profesional</span>
              <div class="soft-kpi-value">Especialistas Acreditados</div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.26rem;">
                <span style="font-size: 0.79rem; color: var(--soft-text-body);">Colegiados CPB · Turnos activos</span>
                <span style="font-size: 0.75rem; font-weight: 700; color: var(--soft-purple-primary);">Ver Directorio &rarr;</span>
              </div>
            </div>
          </a>
        </div>

        <!-- ACCESOS RÁPIDOS FAMILIARES -->
        <div class="soft-quick-grid">
          <a href="#/portal/therapists" class="soft-quick-card soft-quick-card-mint soft-quick-card-tutor">
            <div>
              <div style="display: flex; align-items: center; gap: 1.05rem; margin-bottom: 0.95rem;">
                <div class="soft-icon-box soft-icon-box-mint">${Icons.therapist(25, 'var(--soft-mint-deep)')}</div>
                <div>
                  <h4 class="soft-quick-title" style="margin-bottom: 0.25rem;">Directorio de Especialistas</h4>
                  <span class="soft-badge soft-badge-mint" style="font-size: 0.7rem;">Profesionales Colegiados</span>
                </div>
              </div>
              <p class="soft-quick-desc" style="margin-bottom: 1.15rem;">
                Conoce los perfiles profesionales, matrículas oficiales CPB, áreas de especialidad y turnos de atención del equipo de PSI Aprende.
              </p>
            </div>
            <div style="padding-top: 0.9rem; border-top: 1px solid rgba(21, 150, 141, 0.14); display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
              <span style="font-size: 0.79rem; color: var(--soft-text-muted); font-weight: 500;">Información para familias</span>
              <span class="soft-btn soft-btn-sm soft-btn-lvl-1">
                <span>Ver Especialistas</span>
                ${Icons.arrowRight(13, '#FFFFFF')}
              </span>
            </div>
          </a>

          <div id="btn-trigger-mindbot-dashboard" class="soft-quick-card soft-quick-card-lavender soft-quick-card-tutor" style="cursor: pointer;">
            <div>
              <div style="display: flex; align-items: center; gap: 1.05rem; margin-bottom: 0.95rem;">
                <div class="soft-icon-box soft-icon-box-lavender">${Icons.sparkles(25, 'var(--soft-purple-primary)')}</div>
                <div>
                  <h4 class="soft-quick-title" style="margin-bottom: 0.25rem;">MindBot IA: Triaje &amp; Guía</h4>
                  <span class="soft-badge soft-badge-lavender" style="font-size: 0.7rem;">Asistente Clínico 24/7</span>
                </div>
              </div>
              <p class="soft-quick-desc" style="margin-bottom: 1.15rem;">
                Describe dificultades o inquietudes sobre tu familiar para recibir orientación preliminar de triaje, aranceles oficiales y recomendaciones institucionales.
              </p>
            </div>
            <div style="padding-top: 0.9rem; border-top: 1px solid rgba(110, 86, 176, 0.14); display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
              <span style="font-size: 0.79rem; color: var(--soft-text-muted); font-weight: 500;">Secreto profesional Ley 3131</span>
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1">
                ${Icons.sparkles(13, '#FFFFFF')}
                <span>Abrir Asistente IA</span>
              </button>
            </div>
          </div>

          <a href="#/portal/documents" class="soft-quick-card soft-quick-card-lavender soft-quick-card-tutor">
            <div>
              <div style="display: flex; align-items: center; gap: 1.05rem; margin-bottom: 0.95rem;">
                <div class="soft-icon-box soft-icon-box-lavender">${Icons.fileText(25, 'var(--soft-purple-primary)')}</div>
                <div>
                  <h4 class="soft-quick-title" style="margin-bottom: 0.25rem;">Documentos &amp; Actas Legales</h4>
                  <span class="soft-badge soft-badge-lavender" style="font-size: 0.7rem;">Consentimientos e Informes Word</span>
                </div>
              </div>
              <p class="soft-quick-desc" style="margin-bottom: 1.15rem;">
                Firma consentimientos informados, consulta actas y descarga informes clínicos oficiales (.docx).
              </p>
            </div>
            <div style="padding-top: 0.9rem; border-top: 1px solid rgba(110, 86, 176, 0.14); display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
              <span style="font-size: 0.79rem; color: var(--soft-text-muted); font-weight: 500;">Ley 548 / 3131</span>
              <span class="soft-btn soft-btn-sm soft-btn-lvl-1">
                <span>Ver Repositorio</span>
                ${Icons.arrowRight(13, '#FFFFFF')}
              </span>
            </div>
          </a>

          <a href="#/portal/pagos" class="soft-quick-card soft-quick-card-mint soft-quick-card-tutor">
            <div>
              <div style="display: flex; align-items: center; gap: 1.05rem; margin-bottom: 0.95rem;">
                <div class="soft-icon-box soft-icon-box-mint">${Icons.wallet(25, 'var(--soft-mint-deep)')}</div>
                <div>
                  <h4 class="soft-quick-title" style="margin-bottom: 0.25rem;">Pagos &amp; Comprobantes QR</h4>
                  <span class="soft-badge soft-badge-mint" style="font-size: 0.7rem;">Aranceles &amp; Simple QR</span>
                </div>
              </div>
              <p class="soft-quick-desc" style="margin-bottom: 1.15rem;">
                Consulta el arancel pactado por tus sesiones clínicas, escanea el código QR de cobro, sube tus comprobantes y descarga recibos oficiales.
              </p>
            </div>
            <div style="padding-top: 0.9rem; border-top: 1px solid rgba(21, 150, 141, 0.14); display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
              <span style="font-size: 0.79rem; color: var(--soft-text-muted); font-weight: 500;">Validación por especialista</span>
              <span class="soft-btn soft-btn-sm soft-btn-lvl-1">
                <span>Ir a Pagos</span>
                ${Icons.arrowRight(13, '#FFFFFF')}
              </span>
            </div>
          </a>
        </div>

        <!-- ALERTA DE CONSENTIMIENTO PENDIENTE (RN-03) -->
        ${!this.hasActiveConsent ? `
          <div style="background: #FFFBEB; border: 1.5px solid #F59E0B; border-radius: 16px; padding: 1.15rem 1.4rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.08);">
            <div style="display: flex; align-items: center; gap: 0.95rem;">
              <div style="color: #D97706; flex-shrink: 0;">${Icons.alertTriangle(28, '#D97706')}</div>
              <div>
                <strong style="color: #92400E; font-size: 0.96rem; display: block; margin-bottom: 0.2rem;">
                  Atención Requerida: Consentimiento Informado Pendiente (RN-03)
                </strong>
                <span style="color: #B45309; font-size: 0.82rem; line-height: 1.4; display: block;">
                  Para formalizar el expediente de su familiar y habilitar la entrega de informes oficiales, suscriba el acta de consentimiento digital o formulario impreso.
                </span>
              </div>
            </div>
            <a href="#/portal/documents" class="soft-btn soft-btn-sm soft-btn-lvl-1" style="background: #D97706; border-color: #D97706; font-size: 0.82rem; white-space: nowrap;">
              ${Icons.fileCheck(15, '#FFFFFF')}
              <span>Completar Firma / Ver Plantilla</span>
            </a>
          </div>
        ` : ''}

        <!-- PLANES TERAPÉUTICOS (PTI) Y PAUTAS PARA EL HOGAR (HU-09) -->
        <div class="soft-section-card">
          <div class="soft-section-header">
            <div style="display: flex; align-items: center; gap: 0.95rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.target(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 class="soft-section-title">Plan de Estimulación en el Hogar &amp; Metas SMART</h3>
                <p class="soft-section-subtitle">Acompañamiento interactivo: registra el cumplimiento de pautas en casa y consulta el avance de objetivos.</p>
              </div>
            </div>
            <span class="soft-badge soft-badge-lavender">Seguimiento Clínico Continuo</span>
          </div>

          ${familyPlans.length === 0 ? `
            <div style="text-align: center; padding: 2.25rem 1.5rem; color: var(--soft-text-muted); font-size: 0.9rem; background: var(--soft-lavender-surface); border-radius: 18px;">
              No se registran pacientes o planes activos vinculados a este usuario familiar.
            </div>
          ` : `
            <!-- SELECTOR DE HIJOS / FAMILIARES (PESTAÑAS ANTI-RECORTE) -->
            ${familyPlans.length > 1 ? `
              <div class="tabs-scroll-container" style="margin-bottom: 1.25rem;">
                ${familyPlans.map(item => `
                  <button 
                    type="button" 
                    class="soft-btn btn-switch-child ${item.paciente.id === this.selectedChildId ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" 
                    data-child-id="${item.paciente.id}"
                  >
                    ${Icons.patient(15, item.paciente.id === this.selectedChildId ? '#FFFFFF' : 'var(--soft-purple-primary)')}
                    <span>${this._escapeHtml(item.paciente.nombres + ' ' + item.paciente.apellidos)}</span>
                  </button>
                `).join('')}
              </div>
            ` : ''}

            <!-- TARJETA DEL PLAN ACTIVO -->
            ${activeChildPlan ? `
              <div style="background: #FFFFFF; border: 1.5px solid var(--soft-border-card-inner); border-radius: 20px; padding: 1.4rem 1.6rem; margin-bottom: 1.2rem; box-shadow: var(--soft-shadow-subcard);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.8rem; margin-bottom: 1rem;">
                  <div>
                    <span class="soft-badge soft-badge-mint" style="margin-bottom: 0.4rem; display: inline-flex;">
                      Expediente: ${this._escapeHtml(activeChildPlan.paciente?.codigo_expediente || 'S/N')}
                    </span>
                    <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.25rem 0;">
                      ${this._escapeHtml(activePlan?.titulo || 'Plan de Intervención Clínico')}
                    </h3>
                    <div style="font-size: 0.82rem; color: var(--soft-text-body);">
                      Terapeuta responsable: <strong>${this._escapeHtml(therapistName)}</strong>
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 0.72rem; color: var(--soft-text-muted); text-transform: uppercase; font-weight: 700;">Diagnóstico</div>
                    <span class="soft-badge soft-badge-lavender" style="font-size: 0.74rem;">
                      ${this._escapeHtml(activePlan?.diagnostico_codigo || 'En Valoración')}
                    </span>
                  </div>
                </div>

                <!-- METAS SMART -->
                <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                  ${activeMetas.length === 0 ? `
                    <div style="text-align: center; padding: 1.5rem 1rem; color: var(--soft-text-muted); font-size: 0.88rem; background: var(--soft-lavender-surface); border-radius: 14px;">
                      El plan terapéutico está en proceso de formulación de metas y pautas para el hogar por parte del especialista.
                    </div>
                  ` : activeMetas.map((meta, idx) => {
                    const pct = meta.porcentaje_logro || 0;
                    return `
                      <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 1rem 1.15rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.45rem;">
                          <div style="font-size: 0.88rem; font-weight: 700; color: var(--soft-text-title); line-height: 1.4;">
                            ${idx + 1}. ${this._escapeHtml(meta.descripcion_meta)}
                          </div>
                          <span class="soft-badge ${pct >= 75 ? 'soft-badge-emerald' : 'soft-badge-lavender'}" style="flex-shrink: 0;">
                            ${pct}% Logro
                          </span>
                        </div>

                        <!-- Barra de Progreso -->
                        <div style="height: 7px; background: rgba(110, 86, 176, 0.12); border-radius: 9999px; overflow: hidden; margin-bottom: 0.65rem;">
                          <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, #584294, #15968D); border-radius: 9999px; transition: width 0.4s ease;"></div>
                        </div>

                        ${meta.pautas_hogar ? `
                          <div style="font-size: 0.8rem; color: var(--soft-text-body); background: #FFFFFF; border: 1px solid rgba(110, 86, 176, 0.08); border-radius: 10px; padding: 0.65rem 0.85rem; margin-bottom: 0.65rem; line-height: 1.45;">
                            <strong style="color: var(--soft-purple-primary);">Pauta para casa:</strong> ${this._escapeHtml(meta.pautas_hogar)}
                          </div>
                        ` : ''}

                        <div style="display: flex; justify-content: flex-end;">
                          <button 
                            type="button" 
                            class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-open-family-checkin"
                            data-meta-id="${meta.id}"
                            data-patient-id="${activeChildPlan.paciente?.id || ''}"
                            data-child-name="${this._escapeHtml(activeChildPlan.paciente?.nombres || 'Paciente')}"
                            data-meta-desc="${this._escapeHtml(meta.descripcion_meta)}"
                            data-pauta="${this._escapeHtml(meta.pautas_hogar || '')}"
                          >
                            ${Icons.check(13, 'var(--soft-purple-primary)')}
                            <span>Registrar Práctica en Casa</span>
                          </button>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            ` : ''}
          `}
        </div>

      </div>
      <div id="modal-container-dashboard"></div>
    `;

    this.attachTutorEvents();
  }

  // ==============================================================================
  // EVENTOS Y MODALES
  // ==============================================================================
  attachPeriodEvents() {
    this.container.querySelectorAll('.btn-period-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const period = e.currentTarget.getAttribute('data-period');
        if (period && period !== this.currentPeriod) {
          this.currentPeriod = period;
          this.render();
        }
      });
    });
  }

  attachTutorEvents() {
    const triggerMindBot = document.getElementById('btn-trigger-mindbot-dashboard');
    if (triggerMindBot) {
      triggerMindBot.addEventListener('click', () => {
        const fabBtn = document.getElementById('mindbot-fab-btn');
        const chatWindow = document.getElementById('mindbot-chat-window');
        if (chatWindow && !chatWindow.classList.contains('active')) {
          fabBtn?.click();
        }
      });
    }

    // Selector de hijos
    this.container.querySelectorAll('.btn-switch-child').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const childId = Number(e.currentTarget.getAttribute('data-child-id'));
        if (childId && childId !== this.selectedChildId) {
          this.selectedChildId = childId;
          this.render();
        }
      });
    });

    // Abrir modal de práctica en el hogar
    this.container.querySelectorAll('.btn-open-family-checkin').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const metaId = Number(e.currentTarget.getAttribute('data-meta-id'));
        const patientId = Number(e.currentTarget.getAttribute('data-patient-id'));
        const childName = e.currentTarget.getAttribute('data-child-name') || 'Familiar';
        const metaDesc = e.currentTarget.getAttribute('data-meta-desc') || '';
        const pauta = e.currentTarget.getAttribute('data-pauta') || '';

        this.openFamilyCheckinModal({ metaId, patientId, childName, metaDesc, pauta });
      });
    });
  }

  openFamilyCheckinModal({ metaId, patientId, childName, metaDesc, pauta }) {
    const modalContainer = document.getElementById('modal-container-dashboard');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="checkin-backdrop" style="position: fixed; inset: 0; background: rgba(36, 40, 91, 0.45); backdrop-filter: blur(6px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card">
          <div style="padding: 1.35rem 1.75rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.8rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.checkCircle(21, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0 0 0.15rem 0;">
                  Bitácora de Refuerzo en el Hogar
                </h3>
                <span style="font-size: 0.8rem; color: var(--soft-text-body);">
                  Acompañamiento familiar para ${this._escapeHtml(childName)}
                </span>
              </div>
            </div>
            <button type="button" id="btn-close-checkin-modal" class="soft-modal-close-btn" aria-label="Cerrar ventana">
              ${Icons.close(18)}
            </button>
          </div>

          <div style="padding: 1.4rem 1.75rem;">
            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 0.95rem 1.1rem; margin-bottom: 1.3rem;">
              <div style="font-size: 0.73rem; font-weight: 700; color: var(--soft-purple-primary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.25rem;">
                Objetivo Clínico
              </div>
              <div style="font-size: 0.9rem; font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.45rem; line-height: 1.4;">
                ${this._escapeHtml(metaDesc)}
              </div>
              ${pauta ? `
                <div style="font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.45; border-top: 1px dashed rgba(110, 86, 176, 0.2); padding-top: 0.5rem;">
                  <strong style="color: var(--soft-purple-vivid);">Pauta asignada:</strong> ${this._escapeHtml(pauta)}
                </div>
              ` : ''}
            </div>

            <form id="form-family-checkin">
              <label style="display: block; font-size: 0.84rem; font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.55rem;">
                ¿Cómo respondió ${this._escapeHtml(childName)} durante la práctica? *
              </label>

              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.65rem; margin-bottom: 1.3rem;">
                <label class="checkin-option-label" style="border: 1.5px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.8rem 0.5rem; text-align: center; cursor: pointer; transition: all 0.2s ease; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <input type="radio" name="nivelRespuesta" value="FLUIDO" checked style="display: none;">
                  <span style="font-size: 0.83rem; font-weight: 800; color: var(--soft-emerald-dark); display: block; margin-bottom: 0.2rem;">Fluido</span>
                  <span style="font-size: 0.72rem; color: var(--soft-text-muted); line-height: 1.25;">Autónomo y motivado</span>
                </label>

                <label class="checkin-option-label" style="border: 1.5px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.8rem 0.5rem; text-align: center; cursor: pointer; transition: all 0.2s ease; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <input type="radio" name="nivelRespuesta" value="CON_APOYO" style="display: none;">
                  <span style="font-size: 0.83rem; font-weight: 800; color: var(--soft-mint-deep); display: block; margin-bottom: 0.2rem;">Con Apoyo</span>
                  <span style="font-size: 0.72rem; color: var(--soft-text-muted); line-height: 1.25;">Requirió guía continua</span>
                </label>

                <label class="checkin-option-label" style="border: 1.5px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.8rem 0.5rem; text-align: center; cursor: pointer; transition: all 0.2s ease; background: #FFFFFF; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                  <input type="radio" name="nivelRespuesta" value="DIFICIL" style="display: none;">
                  <span style="font-size: 0.83rem; font-weight: 800; color: var(--soft-purple-primary); display: block; margin-bottom: 0.2rem;">Dificultad</span>
                  <span style="font-size: 0.72rem; color: var(--soft-text-muted); line-height: 1.25;">Resistencia o cansancio</span>
                </label>
              </div>

              <div style="margin-bottom: 1.3rem;">
                <label style="display: block; font-size: 0.83rem; font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.4rem;">
                  Observación o nota para el terapeuta (Opcional)
                </label>
                <textarea 
                  name="observacionHogar" 
                  rows="3" 
                  class="soft-textarea"
                  placeholder="Ej: Logró mantener el foco durante 15 minutos jugando memoria; le costó la última consigna..."
                ></textarea>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1.1rem;">
                <button type="button" id="btn-cancel-checkin" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(14, '#FFFFFF')}
                  <span>Guardar en Bitácora</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-checkin-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-checkin')?.addEventListener('click', closeModal);

    const radioLabels = modalContainer.querySelectorAll('.checkin-option-label');
    const updateRadioStyles = () => {
      radioLabels.forEach(label => {
        const input = label.querySelector('input');
        if (input.checked) {
          label.style.borderColor = 'var(--soft-purple-primary)';
          label.style.background = 'var(--soft-lavender-surface)';
        } else {
          label.style.borderColor = 'var(--soft-border-card-inner)';
          label.style.background = '#FFFFFF';
        }
      });
    };
    updateRadioStyles();
    radioLabels.forEach(label => {
      label.addEventListener('click', () => {
        setTimeout(updateRadioStyles, 20);
      });
    });

    document.getElementById('form-family-checkin')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nivel = e.target.nivelRespuesta.value;
      const obs = e.target.observacionHogar.value.trim();

      try {
        await apiClient.post('/clinical-records/portal/family-checkin', {
          meta_id: metaId,
          paciente_id: patientId,
          nivel_respuesta: nivel,
          observaciones: obs
        });
        Toast.success('¡Registro guardado con éxito! Tu terapeuta podrá revisarlo.');
        closeModal();
      } catch (err) {
        Toast.error('Error al registrar práctica: ' + err.message);
      }
    });
  }

  _escapeHtml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
