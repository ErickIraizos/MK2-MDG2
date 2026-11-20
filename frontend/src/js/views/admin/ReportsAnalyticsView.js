import { apiClient } from '../../api/apiClient.js';
import { store } from '../../store.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';
import Chart from 'chart.js/auto';
import ExcelJS from 'exceljs';
import { printIsolatedDocument } from '../../utils/printHelper.js';

export class ReportsAnalyticsView {
  constructor(container) {
    this.container = container;
    this.currentPeriod = 'month'; // 'month' | 'week' | 'quarter' | 'year' | 'all'
    this.analyticsData = null;
    this.chartInstances = [];
  }

  get user() {
    return store.getState().user || {};
  }

  get isAdmin() {
    return this.user.rol === 'ADMIN';
  }

  destroyCharts() {
    if (this.chartInstances && this.chartInstances.length > 0) {
      this.chartInstances.forEach(c => {
        try { c.destroy(); } catch (e) {}
      });
      this.chartInstances = [];
    }
  }

  async render() {
    this.destroyCharts();

    this.container.innerHTML = `
      <div class="page-container panel-general" style="max-width: 1400px; margin: 0 auto; padding-bottom: 3.5rem;">
        <div style="text-align: center; padding: 4rem 1.5rem;">
          <div class="soft-spinner soft-spinner-lg" style="margin: 0 auto 1.25rem auto;"></div>
          <p style="color: var(--soft-text-body); font-size: 0.95rem;">Compilando métricas analíticas e informes clínicos...</p>
        </div>
      </div>
    `;

    try {
      const endpoint = this.isAdmin 
        ? `/analytics/reports/admin?period=${this.currentPeriod}`
        : `/analytics/reports/therapist?period=${this.currentPeriod}`;

      const res = await apiClient.get(endpoint);
      this.analyticsData = res?.data || null;
      this.renderView();
    } catch (err) {
      console.error('Error al cargar reporte:', err);
      this.container.innerHTML = `
        <div class="page-container panel-general" style="text-align: center; padding: 3.5rem 1.5rem;">
          <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800;">Error al compilar el informe</h3>
          <p style="color: var(--soft-text-body); font-size: 0.88rem; margin-bottom: 1.25rem;">${this._escapeHtml(err.message)}</p>
          <button type="button" id="btn-retry-reports" class="soft-btn soft-btn-lvl-1">Reintentar</button>
        </div>
      `;
      document.getElementById('btn-retry-reports')?.addEventListener('click', () => this.render());
    }
  }

  renderView() {
    const data = this.analyticsData;
    const kpis = data?.kpis || {};
    const signer = data?.signer || {};
    const periodMap = {
      week: 'Esta Semana',
      month: 'Este Mes',
      quarter: 'Trimestre',
      year: 'Año 2026',
      all: 'Histórico Total'
    };

    const headerTitle = this.isAdmin
      ? 'Reportes Estadísticos & Auditoría Clínica Global'
      : `Mi Informe Estadístico & Auditoría Clínica · ${data?.therapist?.nombre_completo || this.user.nombre_completo || 'Especialista'}`;

    const headerSubtitle = this.isAdmin
      ? 'Análisis demográfico de pacientes, prevalencia de diagnósticos clínicos, distribución semanal de la demanda asistencial y control de calidad documental de notas SOAP.'
      : 'Perfil demográfico de pacientes bajo mi seguimiento, diagnósticos de mi cartera, distribución de horas terapéuticas de lunes a sábado y control de notas SOAP.';

    this.container.innerHTML = `
      <div class="page-container panel-general" style="max-width: 1400px; margin: 0 auto; padding-bottom: 4rem;">
        
        <!-- CABECERA DEL REPORTE -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                <span class="soft-status-dot"></span>
                <span>Auditoría &amp; Estadísticas Clínicas Oficiales</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende" · Sede Cochabamba</span>
            </div>
            <h1 class="soft-page-title">${headerTitle}</h1>
            <p class="soft-page-subtitle">${headerSubtitle}</p>
          </div>

          <div class="soft-header-actions">
            <button type="button" id="btn-export-excel" class="soft-btn soft-btn-lvl-1-muted">
              ${Icons.download(16, 'var(--soft-purple-primary)')}
              <span>Exportar Excel XLSX</span>
            </button>
            <button type="button" id="btn-print-report" class="soft-btn soft-btn-lvl-1">
              ${Icons.printer(16, '#FFFFFF')}
              <span>Imprimir Informe Oficial</span>
            </button>
          </div>
        </div>

        <!-- SELECTOR DE PERÍODO HORIZONTAL (ANTI-RECORTE) -->
        <div class="tabs-scroll-container" style="margin-bottom: 1.45rem;">
          ${[
            { id: 'month', label: 'Este Mes' },
            { id: 'week', label: 'Esta Semana' },
            { id: 'quarter', label: 'Trimestre' },
            { id: 'year', label: 'Año 2026' },
            { id: 'all', label: 'Histórico Total' }
          ].map(p => `
            <button 
              type="button" 
              class="soft-btn btn-period-tab ${this.currentPeriod === p.id ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" 
              data-period="${p.id}"
            >
              ${Icons.calendar(15, this.currentPeriod === p.id ? '#FFFFFF' : 'var(--soft-purple-primary)')}
              <span>${p.label}</span>
            </button>
          `).join('')}
        </div>

        <!-- CUADRO DE KPIS DE AUDITORÍA Y ESTADÍSTICA -->
        <div class="soft-kpi-grid" style="margin-bottom: 1.6rem;">
          <div class="soft-kpi-card">
            <span class="soft-status-dot-green"></span>
            <div class="soft-icon-box soft-icon-box-lavender">${Icons.patient(24, 'var(--soft-purple-primary)')}</div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">${this.isAdmin ? 'Población Clínica Activa' : 'Mis Pacientes Asignados'}</span>
              <div class="soft-kpi-value">${kpis.total_pacientes_activos || 0} Pacientes</div>
              <div class="soft-kpi-sub">${this.isAdmin ? 'Casos clínicos bajo seguimiento multidisciplinar' : 'Pacientes directos bajo mi atención'}</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <span class="soft-status-dot-green"></span>
            <div class="soft-icon-box soft-icon-box-mint">${Icons.calendar(24, 'var(--soft-mint-deep)')}</div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Sesiones Clínicas Atendidas</span>
              <div class="soft-kpi-value">${kpis.total_sesiones_impartidas || 0} Sesiones</div>
              <div class="soft-kpi-sub">Turnos efectivamente concluidos en el período</div>
            </div>
          </div>

          <div class="soft-kpi-card">
            <span class="soft-status-dot-green"></span>
            <div class="soft-icon-box soft-icon-box-lavender">${Icons.clock(24, 'var(--soft-purple-primary)')}</div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Horas Clínicas Efectivas</span>
              <div class="soft-kpi-value">${kpis.total_horas_atencion || 0} Horas</div>
              <div class="soft-kpi-sub">Tiempo dedicado a intervención y evaluación</div>
            </div>
          </div>

          <div class="soft-kpi-card soft-kpi-mint">
            <span class="soft-status-dot-green"></span>
            <div class="soft-icon-box soft-icon-box-mint">${Icons.fileText(24, 'var(--soft-mint-deep)')}</div>
            <div class="soft-kpi-body">
              <span class="soft-kpi-overline">Cumplimiento Documental SOAP</span>
              <div class="soft-kpi-value">${kpis.cumplimiento_soap_pct || 100}% Concluido</div>
              <div class="soft-kpi-sub">Notas clínicas selladas según norma RN-07</div>
            </div>
          </div>
        </div>

        <!-- 4 GRÁFICAS ESTADÍSTICAS AVANZADAS NO REDUNDANTES -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 460px), 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
          
          <!-- GRÁFICO 1: DEMOGRAFÍA POR GRUPOS ETARIOS -->
          <div class="soft-section-card">
            <div class="soft-section-header">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">${Icons.users(18, 'var(--soft-purple-primary)')}</div>
                <div>
                  <h3 class="soft-section-title">Demografía de Pacientes por Rango Etario</h3>
                  <div class="soft-section-subtitle">Distribución poblacional: primera infancia, escolares, adolescentes y adultos</div>
                </div>
              </div>
            </div>
            <div style="height: 280px; position: relative; padding: 0.5rem 0.25rem;">
              <canvas id="chart-reports-demographics"></canvas>
            </div>
          </div>

          <!-- GRÁFICO 2: PREVALENCIA DIAGNÓSTICA Y MOTIVOS DE CONSULTA -->
          <div class="soft-section-card">
            <div class="soft-section-header">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">${Icons.stethoscope(18, 'var(--soft-mint-deep)')}</div>
                <div>
                  <h3 class="soft-section-title">Prevalencia Diagnóstica &amp; Motivos Clínicos</h3>
                  <div class="soft-section-subtitle">Clasificación CIE-11 y DSM-5 de casos activos en seguimiento</div>
                </div>
              </div>
            </div>
            <div style="height: 280px; position: relative; padding: 0.5rem 0.25rem;">
              <canvas id="chart-reports-diagnostics"></canvas>
            </div>
          </div>

          <!-- GRÁFICO 3: DISTRIBUCIÓN SEMANAL DE LA DEMANDA ASISTENCIAL -->
          <div class="soft-section-card">
            <div class="soft-section-header">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">${Icons.calendar(18, 'var(--soft-purple-primary)')}</div>
                <div>
                  <h3 class="soft-section-title">Distribución Semanal de Sesiones</h3>
                  <div class="soft-section-subtitle">Volumen de atención de lunes a sábado y días de mayor concurrencia</div>
                </div>
              </div>
            </div>
            <div style="height: 280px; position: relative; padding: 0.5rem 0.25rem;">
              <canvas id="chart-reports-weekly"></canvas>
            </div>
          </div>

          <!-- GRÁFICO 4: CONTROL DE CALIDAD Y AUDITORÍA DOCUMENTAL SOAP -->
          <div class="soft-section-card">
            <div class="soft-section-header">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">${Icons.fileText(18, 'var(--soft-mint-deep)')}</div>
                <div>
                  <h3 class="soft-section-title">Auditoría Documental de Notas SOAP</h3>
                  <div class="soft-section-subtitle">Control de calidad de notas selladas frente a sesiones pendientes</div>
                </div>
              </div>
            </div>
            <div style="height: 280px; position: relative; padding: 0.5rem 0.25rem;">
              <canvas id="chart-reports-soap"></canvas>
            </div>
          </div>

        </div>

        <!-- TABLA DETALLADA SEGÚN EL ROL -->
        <div class="soft-section-card" style="margin-bottom: 2rem;">
          <div class="soft-section-header">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${this.isAdmin ? Icons.therapist(18, 'var(--soft-purple-primary)') : Icons.patient(18, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 class="soft-section-title">
                  ${this.isAdmin ? 'Auditoría de Rendimiento del Plantel de Especialistas' : 'Cartera de Pacientes Asignados &amp; Estado de Sesiones'}
                </h3>
                <div class="soft-section-subtitle">
                  ${this.isAdmin ? 'Desglose auditable de matrícula profesional, sesiones brindadas y apego documental' : 'Listado de expedientes clínicos activos bajo mi atención y último diagnóstico registrado'}
                </div>
              </div>
            </div>
          </div>

          <div class="soft-table-responsive" style="overflow-x: auto;">
            <table class="soft-table" style="width: 100%; border-collapse: collapse;">
              ${this.isAdmin ? `
                <thead>
                  <tr>
                    <th>Profesional</th>
                    <th>Especialidad</th>
                    <th>Matrícula CPB</th>
                    <th style="text-align: center;">Citas Programadas</th>
                    <th style="text-align: center;">Citas Atendidas</th>
                    <th style="text-align: center;">Horas Terapia</th>
                    <th style="text-align: center;">Notas SOAP</th>
                    <th style="text-align: right;">Cumplimiento SOAP</th>
                  </tr>
                </thead>
                <tbody>
                  ${(data?.staff_audit || []).map(s => `
                    <tr>
                      <td><strong>${this._escapeHtml(s.nombre_completo)}</strong></td>
                      <td><span class="soft-specialty-tag">${this._escapeHtml(s.especialidad)}</span></td>
                      <td><span class="soft-badge soft-badge-lavender">${this._escapeHtml(s.registro_profesional)}</span></td>
                      <td style="text-align: center;">${s.citas_programadas}</td>
                      <td style="text-align: center;"><span class="soft-badge soft-badge-emerald">${s.citas_atendidas}</span></td>
                      <td style="text-align: center;">${s.horas_terapia} h</td>
                      <td style="text-align: center;">${s.notas_soap_registradas}</td>
                      <td style="text-align: right;">
                        <span class="soft-badge ${s.cumplimiento_soap_pct >= 80 ? 'soft-badge-emerald' : 'soft-badge-lavender'}">
                          ${s.cumplimiento_soap_pct}%
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              ` : `
                <thead>
                  <tr>
                    <th>Expediente</th>
                    <th>Nombre del Paciente</th>
                    <th style="text-align: center;">Edad</th>
                    <th style="text-align: center;">Sexo</th>
                    <th style="text-align: center;">Estado Clínico</th>
                    <th style="text-align: center;">Sesiones Conmigo</th>
                    <th>Último Diagnóstico o Impresión Clínica</th>
                  </tr>
                </thead>
                <tbody>
                  ${(data?.my_patients_list || []).map(p => `
                    <tr>
                      <td><span class="soft-badge soft-badge-lavender">${this._escapeHtml(p.codigo_expediente)}</span></td>
                      <td><strong>${this._escapeHtml(p.paciente_nombre)}</strong></td>
                      <td style="text-align: center;">${p.edad} años</td>
                      <td style="text-align: center;">${p.sexo}</td>
                      <td style="text-align: center;">
                        <span class="soft-badge soft-badge-emerald">${this._escapeHtml(p.estado_clinico)}</span>
                      </td>
                      <td style="text-align: center;"><strong>${p.sesiones_conmigo}</strong></td>
                      <td>${this._escapeHtml(p.ultimo_diagnostico || 'Evaluación inicial en curso')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              `}
            </table>
          </div>
        </div>

        <!-- PLANTILLA INVISIBLE PARA IMPRESIÓN OFICIAL DEL INFORME -->
        <div id="printable-executive-report" style="display: none;">
          <div style="border-bottom: 2px solid #584294; padding-bottom: 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; color: #24285B; font-size: 1.35rem;">CENTRO PSICOPEDAGÓGICO Y PSICOLÓGICO "PSI APRENDE"</h2>
              <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">
                ${this.isAdmin ? 'Informe Estadístico Oficial de Gestión Clínica Global' : 'Informe Estadístico Individual de Rendimiento Clínico'} · ${this._escapeHtml(store.getState().publicConfig?.INSTITUCION_DIRECCION || 'Cochabamba, Bolivia')}
              </div>
            </div>
            <div style="text-align: right; font-size: 0.78rem; color: #64748b;">
              <div><strong>Fecha de emisión:</strong> ${new Date().toLocaleDateString('es-BO')}</div>
              <div><strong>Período evaluado:</strong> ${periodMap[this.currentPeriod]}</div>
            </div>
          </div>

          <h3 style="color: #24285B; font-size: 1.1rem; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.4rem; margin-top: 1.25rem;">
            1. Resumen de Indicadores Clave de Desempeño Clínico
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.86rem;">
            <tr>
              <td style="padding: 0.5rem; border: 1px solid #e2e8f0; background: #f8fafc;"><strong>Población Clínica Evaluada:</strong></td>
              <td style="padding: 0.5rem; border: 1px solid #e2e8f0;">${kpis.total_pacientes_activos || 0} Pacientes</td>
              <td style="padding: 0.5rem; border: 1px solid #e2e8f0; background: #f8fafc;"><strong>Sesiones Atendidas:</strong></td>
              <td style="padding: 0.5rem; border: 1px solid #e2e8f0;">${kpis.total_sesiones_impartidas || 0} Turnos</td>
            </tr>
            <tr>
              <td style="padding: 0.5rem; border: 1px solid #e2e8f0; background: #f8fafc;"><strong>Horas Clínicas Brindadas:</strong></td>
              <td style="padding: 0.5rem; border: 1px solid #e2e8f0;">${kpis.total_horas_atencion || 0} Horas</td>
              <td style="padding: 0.5rem; border: 1px solid #e2e8f0; background: #f8fafc;"><strong>Cumplimiento Documental SOAP:</strong></td>
              <td style="padding: 0.5rem; border: 1px solid #e2e8f0;">${kpis.cumplimiento_soap_pct || 100}% Concluido</td>
            </tr>
          </table>

          <h3 style="color: #24285B; font-size: 1.1rem; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.4rem; margin-top: 1.25rem;">
            ${this.isAdmin ? '2. Productividad y Cumplimiento del Plantel de Especialistas' : '2. Detalle de Pacientes Asignados y Proceso Terapéutico'}
          </h3>
          
          ${this.isAdmin ? `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.84rem;">
              <thead>
                <tr style="background: #f1f5f9;">
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: left;">Profesional</th>
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: left;">Especialidad</th>
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: center;">Matrícula CPB</th>
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: center;">Citas Atendidas</th>
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: center;">Horas Terapia</th>
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: right;">Cumplimiento SOAP</th>
                </tr>
              </thead>
              <tbody>
                ${(data?.staff_audit || []).map(s => `
                  <tr>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0;">${s.nombre_completo}</td>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0;">${s.especialidad}</td>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0; text-align: center;">${s.registro_profesional}</td>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0; text-align: center;">${s.citas_atendidas}</td>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0; text-align: center;">${s.horas_terapia} h</td>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0; text-align: right;">${s.cumplimiento_soap_pct}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.84rem;">
              <thead>
                <tr style="background: #f1f5f9;">
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: left;">Expediente</th>
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: left;">Paciente</th>
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: center;">Edad</th>
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: center;">Sexo</th>
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: center;">Sesiones</th>
                  <th style="padding: 0.5rem; border: 1px solid #cbd5e1; text-align: left;">Diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                ${(data?.my_patients_list || []).map(p => `
                  <tr>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0;">${p.codigo_expediente}</td>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0;">${p.paciente_nombre}</td>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0; text-align: center;">${p.edad} años</td>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0; text-align: center;">${p.sexo}</td>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0; text-align: center;">${p.sesiones_conmigo}</td>
                    <td style="padding: 0.45rem; border: 1px solid #e2e8f0;">${p.ultimo_diagnostico || 'En proceso'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}

          <!-- BLOQUE DE FIRMA DINÁMICA ÚNICA CON ESPACIO DESPEJADO -->
          <div style="margin-top: 2.5rem; padding-top: 1rem; border-top: 1px dashed #cbd5e1; display: flex; justify-content: center; text-align: center; page-break-inside: avoid; break-inside: avoid;">
            ${this.isAdmin ? `
              <div style="width: 320px;">
                <div style="height: 55px;"></div>
                <div style="border-top: 2px solid #24285B; padding-top: 0.6rem; font-size: 0.85rem; line-height: 1.45;">
                  <strong style="color: #24285B; font-size: 0.95rem;">${this._escapeHtml(signer.admin_name || 'Mgr. Grisel Aguilar Apaza')}</strong><br>
                  <span style="color: #475569; font-weight: 600;">${this._escapeHtml(signer.cargo || 'Directora General · Auditoría y Gestión Clínica')}</span><br>
                  <span style="color: #64748b; font-size: 0.78rem;">${this._escapeHtml(signer.institucion || 'Centro "PSI Aprende" · Sede Cochabamba')}</span>
                </div>
              </div>
            ` : `
              <div style="width: 320px;">
                <div style="height: 55px;"></div>
                <div style="border-top: 2px solid #24285B; padding-top: 0.6rem; font-size: 0.85rem; line-height: 1.45;">
                  <strong style="color: #24285B; font-size: 0.95rem;">${this._escapeHtml(signer.therapist_name || this.user.nombre_completo)}</strong><br>
                  <span style="color: #475569; font-weight: 600;">${this._escapeHtml(signer.especialidad || 'Especialista Clínico')} · Matrícula ${this._escapeHtml(signer.matricula || 'CPB')}</span><br>
                  <span style="color: #64748b; font-size: 0.78rem;">${this._escapeHtml(signer.institucion || 'Especialista Clínico Acreditado · PSI Aprende')}</span>
                </div>
              </div>
            `}
          </div>

        </div>

      </div>
    `;

    this.attachEvents();
    this.renderCharts(data);
  }

  attachEvents() {
    this.container.querySelectorAll('.btn-period-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const p = e.currentTarget.getAttribute('data-period');
        if (p && p !== this.currentPeriod) {
          this.currentPeriod = p;
          this.render();
        }
      });
    });

    document.getElementById('btn-export-excel')?.addEventListener('click', () => {
      this.exportToExcel();
    });

    document.getElementById('btn-print-report')?.addEventListener('click', () => {
      this.printOfficialReport();
    });
  }

  renderCharts(data) {
    if (!data) return;

    Chart.defaults.font.family = "'Outfit', 'Inter', system-ui, -apple-system, sans-serif";
    Chart.defaults.color = '#696F8C';

    // 1. GRÁFICO DE DEMOGRAFÍA POR RANGO ETARIO
    const demoCanvas = document.getElementById('chart-reports-demographics');
    if (demoCanvas && data.demographics) {
      const labels = data.demographics.map(d => d.label);
      const counts = data.demographics.map(d => d.count);
      const colors = data.demographics.map(d => d.color);

      const c = new Chart(demoCanvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Pacientes',
            data: counts,
            backgroundColor: colors,
            borderRadius: 8
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(110, 86, 176, 0.08)' },
              ticks: { stepSize: 1 }
            },
            y: { grid: { display: false } }
          }
        }
      });
      this.chartInstances.push(c);
    }

    // 2. GRÁFICO DE PREVALENCIA DIAGNÓSTICA
    const diagCanvas = document.getElementById('chart-reports-diagnostics');
    if (diagCanvas && data.diagnostic_prevalence) {
      const labels = data.diagnostic_prevalence.map(d => d.label);
      const counts = data.diagnostic_prevalence.map(d => d.count);
      const colors = data.diagnostic_prevalence.map(d => d.color);

      const c = new Chart(diagCanvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: counts,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { size: 10, weight: 600 } }
            }
          }
        }
      });
      this.chartInstances.push(c);
    }

    // 3. GRÁFICO DE DISTRIBUCIÓN SEMANAL (LUNES A SÁBADO)
    const weekCanvas = document.getElementById('chart-reports-weekly');
    if (weekCanvas && data.weekly_distribution) {
      const labels = data.weekly_distribution.map(w => w.dia);
      const programadas = data.weekly_distribution.map(w => w.citas_programadas);
      const atendidas = data.weekly_distribution.map(w => w.citas_atendidas);

      const c = new Chart(weekCanvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Programadas',
              data: programadas,
              backgroundColor: '#584294',
              borderRadius: 6
            },
            {
              label: 'Atendidas',
              data: atendidas,
              backgroundColor: '#15968D',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { font: { size: 11, weight: 600 } }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(110, 86, 176, 0.08)' },
              ticks: { stepSize: 1 }
            },
            x: { grid: { display: false } }
          }
        }
      });
      this.chartInstances.push(c);
    }

    // 4. GRÁFICO DE AUDITORÍA SOAP (COMPLETADAS VS PENDIENTES)
    const soapCanvas = document.getElementById('chart-reports-soap');
    if (soapCanvas && data.soap_compliance) {
      const labels = data.soap_compliance.map(s => s.label);
      const counts = data.soap_compliance.map(s => s.count);
      const colors = data.soap_compliance.map(s => s.color);

      const c = new Chart(soapCanvas, {
        type: 'pie',
        data: {
          labels,
          datasets: [{
            data: counts,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#FFFFFF'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { size: 11, weight: 600 } }
            }
          }
        }
      });
      this.chartInstances.push(c);
    }
  }

  async exportToExcel() {
    if (!this.analyticsData) {
      Toast.error('No hay datos para exportar.');
      return;
    }
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Centro PSI Aprende - Sede Cochabamba';
      wb.created = new Date();

      const signer = this.analyticsData.signer || {};
      const kpis = this.analyticsData.kpis || {};
      const periodLabelMap = {
        week: 'Esta Semana',
        month: 'Este Mes',
        quarter: 'Trimestre',
        year: 'Año 2026',
        all: 'Histórico Total'
      };
      const friendlyPeriod = periodLabelMap[this.currentPeriod] || 'Este Mes';
      const fechaEmision = new Date().toLocaleDateString('es-BO');

      // PALETA INSTITUCIONAL MÉDICA (IDÉNTICA A HONORARIOS / CASH REGISTER)
      const COLOR_NAVY = 'FF27345F';
      const COLOR_PURPLE = 'FF584294';
      const COLOR_CARD_BG = 'FFF4F1FA';
      const COLOR_ZEBRA = 'FFFAF9FD';
      const COLOR_WHITE = 'FFFFFFFF';
      const COLOR_TOTAL_BG = 'FFEDE9FE';
      const COLOR_BORDER = 'FFE2DCF0';
      const COLOR_SUCCESS = 'FF059669';
      const COLOR_AMBER = 'FFD97706';

      const borderThin = {
        top: { style: 'thin', color: { argb: COLOR_BORDER } },
        left: { style: 'thin', color: { argb: COLOR_BORDER } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER } }
      };

      const borderHeader = {
        top: { style: 'thin', color: { argb: COLOR_NAVY } },
        left: { style: 'thin', color: { argb: COLOR_NAVY } },
        bottom: { style: 'medium', color: { argb: COLOR_NAVY } },
        right: { style: 'thin', color: { argb: COLOR_NAVY } }
      };

      const borderTotal = {
        top: { style: 'thin', color: { argb: COLOR_PURPLE } },
        bottom: { style: 'double', color: { argb: COLOR_NAVY } },
        left: { style: 'thin', color: { argb: COLOR_BORDER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER } }
      };

      // =========================================================
      // HOJA 1: RESUMEN EJECUTIVO & AUDITORÍA CLÍNICA
      // =========================================================
      const ws1 = wb.addWorksheet('Resumen Ejecutivo', {
        views: [{ showGridLines: true }]
      });

      ws1.columns = [
        { width: 44 }, // A: Indicador o Título
        { width: 22 }, // B: Cifra
        { width: 22 }, // C: Unidad
        { width: 22 }, // D: Estado / Código
        { width: 46 }  // E: Interpretación
      ];

      // Fila 1: Banner Institucional Principal
      ws1.mergeCells('A1:E1');
      const t1 = ws1.getCell('A1');
      t1.value = 'CENTRO PSICOPEDAGÓGICO Y DE ATENCIÓN PSICOLÓGICA "PSI APRENDE"';
      t1.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLOR_WHITE } };
      t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
      t1.alignment = { horizontal: 'center', vertical: 'middle' };
      ws1.getRow(1).height = 32;

      // Fila 2: Subtítulo
      ws1.mergeCells('A2:E2');
      const t2 = ws1.getCell('A2');
      t2.value = this.isAdmin 
        ? `INFORME ESTADÍSTICO OFICIAL DE GESTIÓN CLÍNICA GLOBAL · ${friendlyPeriod.toUpperCase()}`
        : `INFORME ESTADÍSTICO INDIVIDUAL DE RENDIMIENTO CLÍNICO · ${friendlyPeriod.toUpperCase()}`;
      t2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_WHITE } };
      t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PURPLE } };
      t2.alignment = { horizontal: 'center', vertical: 'middle' };
      ws1.getRow(2).height = 22;

      // Fila 3: Separador
      ws1.getRow(3).height = 10;

      // Fila 4 y 5: Tarjeta de Metadatos
      const respName = this.isAdmin ? (signer.admin_name || 'Mgr. Grisel Aguilar Apaza') : (signer.therapist_name || this.user.nombre_completo || 'Terapeuta');
      const respCargo = this.isAdmin ? (signer.cargo || 'Dirección General') : (signer.especialidad || 'Especialista Clínico');
      const respMat = this.isAdmin ? 'CPB-1402' : (signer.matricula || 'CPB');

      ws1.mergeCells('B4:C4');
      ws1.getCell('A4').value = 'Responsable Emisor:';
      ws1.getCell('B4').value = respName;
      ws1.getCell('D4').value = 'Fecha Emisión:';
      ws1.getCell('E4').value = fechaEmision;

      ws1.mergeCells('B5:C5');
      ws1.getCell('A5').value = 'Cargo / Matrícula:';
      ws1.getCell('B5').value = `${respCargo} · Matrícula ${respMat}`;
      ws1.getCell('D5').value = 'Período Auditado:';
      ws1.getCell('E5').value = friendlyPeriod;

      [4, 5].forEach(rNum => {
        const row = ws1.getRow(rNum);
        row.height = 22;
        ['A', 'B', 'C', 'D', 'E'].forEach(col => {
          const cell = ws1.getCell(`${col}${rNum}`);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_CARD_BG } };
          cell.border = borderThin;
          const isLabel = ['A4', 'D4', 'A5', 'D5'].includes(`${col}${rNum}`);
          cell.font = {
            name: 'Segoe UI',
            size: 9,
            bold: isLabel,
            color: { argb: isLabel ? COLOR_NAVY : 'FF334155' }
          };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        });
      });

      // Fila 6: Separador
      ws1.getRow(6).height = 12;

      // Fila 7: Título Sección 1
      ws1.mergeCells('A7:E7');
      const s1 = ws1.getCell('A7');
      s1.value = '1. INDICADORES CLAVE DE GESTIÓN Y AUDITORÍA CLÍNICA';
      s1.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_WHITE } };
      s1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PURPLE } };
      s1.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      ws1.getRow(7).height = 24;

      // Fila 8: Cabeceras Tabla 1
      const headers1 = ['Indicador Clínico', 'Cifra Registrada', 'Unidad de Medida', 'Apego / Calidad', 'Interpretación Institucional'];
      const hRow1 = ws1.getRow(8);
      hRow1.values = headers1;
      hRow1.height = 26;
      hRow1.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_WHITE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderHeader;
      });

      // Filas 9-12: Datos Indicadores
      const kpiItems = [
        ['Población Clínica Activa', kpis.total_pacientes_activos || 0, 'Pacientes', 'ACTIVO', 'Pacientes bajo seguimiento clínico activo'],
        ['Sesiones Clínicas Atendidas', kpis.total_sesiones_impartidas || 0, 'Sesiones', 'COMPLETADO', 'Turnos efectivamente concluidos en consultorio'],
        ['Horas Clínicas Efectivas', kpis.total_horas_atencion || 0, 'Horas', 'EFECTIVO', 'Tiempo acumulado de atención e intervención directa'],
        ['Cumplimiento Documental SOAP', (kpis.cumplimiento_soap_pct || 100) + '%', 'Porcentaje', (kpis.cumplimiento_soap_pct || 100) >= 80 ? 'CONFORME' : 'EN REVISIÓN', 'Notas clínicas selladas bajo estricta norma RN-07']
      ];

      kpiItems.forEach((item, idx) => {
        const rowNum = 9 + idx;
        const row = ws1.getRow(rowNum);
        row.values = item;
        row.height = 22;
        const bg = idx % 2 === 0 ? COLOR_WHITE : COLOR_ZEBRA;
        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1E293B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border = borderThin;
          cell.alignment = { vertical: 'middle' };
          if (colNum === 1) {
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
          }
          if (colNum === 2) {
            cell.alignment.horizontal = 'center';
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
          }
          if (colNum === 3) {
            cell.alignment.horizontal = 'center';
          }
          if (colNum === 4) {
            cell.alignment.horizontal = 'center';
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_SUCCESS } };
          }
        });
      });

      // Fila 13: Separador
      ws1.getRow(13).height = 12;

      // Fila 14: Título Sección 2
      ws1.mergeCells('A14:E14');
      const s2 = ws1.getCell('A14');
      s2.value = '2. DISTRIBUCIÓN DEMOGRÁFICA DE PACIENTES POR RANGO ETARIO';
      s2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_WHITE } };
      s2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PURPLE } };
      s2.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      ws1.getRow(14).height = 24;

      // Fila 15: Cabeceras Tabla 2
      const headers2 = ['Estrato Etario', 'Pacientes Activos', 'Proporción (%)', 'Población Objetivo', 'Enfoque de Intervención'];
      const hRow2 = ws1.getRow(15);
      hRow2.values = headers2;
      hRow2.height = 26;
      hRow2.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_WHITE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderHeader;
      });

      let curRow = 16;
      (this.analyticsData.demographics || []).forEach((d, idx) => {
        const row = ws1.getRow(curRow);
        row.values = [
          d.label,
          d.count,
          d.percentage + '%',
          'Atención Especializada',
          'Intervención psicopedagógica y neurocognitiva'
        ];
        row.height = 22;
        const bg = idx % 2 === 0 ? COLOR_WHITE : COLOR_ZEBRA;
        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1E293B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border = borderThin;
          cell.alignment = { vertical: 'middle' };
          if (colNum === 1) cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
          if (colNum === 2 || colNum === 3) cell.alignment.horizontal = 'center';
        });
        curRow++;
      });

      // Separador
      ws1.getRow(curRow).height = 12;
      curRow++;

      // Título Sección 3
      ws1.mergeCells(`A${curRow}:E${curRow}`);
      const s3 = ws1.getCell(`A${curRow}`);
      s3.value = '3. PREVALENCIA DE MOTIVOS DE CONSULTA Y DIAGNÓSTICOS CLÍNICOS';
      s3.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_WHITE } };
      s3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PURPLE } };
      s3.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      ws1.getRow(curRow).height = 24;
      curRow++;

      // Cabeceras Tabla 3
      const headers3 = ['Categoría Clínica Diagnóstica', 'Casos Registrados', 'Código Identificador', 'Clasificación Nosológica', 'Observaciones Clínicas'];
      const hRow3 = ws1.getRow(curRow);
      hRow3.values = headers3;
      hRow3.height = 26;
      hRow3.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_WHITE } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = borderHeader;
      });
      curRow++;

      (this.analyticsData.diagnostic_prevalence || []).forEach((dp, idx) => {
        const row = ws1.getRow(curRow);
        row.values = [
          dp.label,
          dp.count,
          dp.key || 'CIE-11',
          'Criterios clínicos CIE-11 y DSM-5',
          'Seguimiento longitudinal continuo'
        ];
        row.height = 22;
        const bg = idx % 2 === 0 ? COLOR_WHITE : COLOR_ZEBRA;
        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1E293B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border = borderThin;
          cell.alignment = { vertical: 'middle' };
          if (colNum === 1) cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
          if (colNum === 2 || colNum === 3) cell.alignment.horizontal = 'center';
        });
        curRow++;
      });

      // =========================================================
      // HOJA 2: DETALLE AUDITABLE (PLANTEL O CARTERA DE PACIENTES)
      // =========================================================
      const ws2 = wb.addWorksheet(this.isAdmin ? 'Auditoría Especialistas' : 'Mis Pacientes', {
        views: [{ showGridLines: true }]
      });

      if (this.isAdmin) {
        ws2.columns = [
          { width: 30 },
          { width: 34 },
          { width: 18 },
          { width: 18 },
          { width: 18 },
          { width: 18 },
          { width: 22 },
          { width: 22 }
        ];

        ws2.mergeCells('A1:H1');
        const h1 = ws2.getCell('A1');
        h1.value = 'CENTRO PSICOPEDAGÓGICO Y DE ATENCIÓN PSICOLÓGICA "PSI APRENDE"';
        h1.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLOR_WHITE } };
        h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
        h1.alignment = { horizontal: 'center', vertical: 'middle' };
        ws2.getRow(1).height = 32;

        ws2.mergeCells('A2:H2');
        const h2 = ws2.getCell('A2');
        h2.value = `AUDITORÍA Y RENDIMIENTO DEL PLANTEL DE ESPECIALISTAS - ${friendlyPeriod.toUpperCase()}`;
        h2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_WHITE } };
        h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PURPLE } };
        h2.alignment = { horizontal: 'center', vertical: 'middle' };
        ws2.getRow(2).height = 22;

        ws2.getRow(3).height = 10;

        const headers = ['Profesional', 'Especialidad Clínica', 'Matrícula CPB', 'Citas Programadas', 'Citas Atendidas', 'Horas Terapia', 'Notas SOAP', 'Cumplimiento SOAP'];
        const rHeader = ws2.getRow(4);
        rHeader.values = headers;
        rHeader.height = 26;
        rHeader.eachCell(c => {
          c.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_WHITE } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
          c.alignment = { horizontal: 'center', vertical: 'middle' };
          c.border = borderHeader;
        });

        let rIdx = 5;
        let totProg = 0;
        let totAtend = 0;
        let totHoras = 0;
        let totSoap = 0;

        (this.analyticsData.staff_audit || []).forEach((s, idx) => {
          const row = ws2.getRow(rIdx);
          totProg += Number(s.citas_programadas || 0);
          totAtend += Number(s.citas_atendidas || 0);
          totHoras += Number(s.horas_terapia || 0);
          totSoap += Number(s.notas_soap_registradas || 0);

          row.values = [
            s.nombre_completo,
            s.especialidad,
            s.registro_profesional,
            s.citas_programadas,
            s.citas_atendidas,
            s.horas_terapia + ' h',
            s.notas_soap_registradas,
            s.cumplimiento_soap_pct + '%'
          ];
          row.height = 22;
          const bg = idx % 2 === 0 ? COLOR_WHITE : COLOR_ZEBRA;
          row.eachCell((cell, colNum) => {
            cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1E293B' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.border = borderThin;
            cell.alignment = { vertical: 'middle' };
            if (colNum === 1) cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
            if ([3, 4, 5, 6, 7, 8].includes(colNum)) cell.alignment.horizontal = 'center';
            if (colNum === 8) {
              cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: s.cumplimiento_soap_pct >= 80 ? COLOR_SUCCESS : COLOR_AMBER } };
            }
          });
          rIdx++;
        });

        // Fila Total
        const totRow = ws2.getRow(rIdx);
        ws2.mergeCells(`A${rIdx}:C${rIdx}`);
        totRow.getCell(1).value = 'TOTAL CONSOLIDADO DEL PLANTEL:';
        totRow.getCell(4).value = totProg;
        totRow.getCell(5).value = totAtend;
        totRow.getCell(6).value = totHoras.toFixed(1) + ' h';
        totRow.getCell(7).value = totSoap;
        totRow.getCell(8).value = totAtend > 0 ? Math.round((totSoap / totAtend) * 100) + '%' : '100%';
        totRow.height = 26;

        for (let col = 1; col <= 8; col++) {
          const c = totRow.getCell(col);
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
          c.border = borderTotal;
          c.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
          c.alignment = { vertical: 'middle', horizontal: col === 1 ? 'right' : 'center' };
        }
      } else {
        // TERAPEUTA: CARTERA DE PACIENTES
        ws2.columns = [
          { width: 22 },
          { width: 34 },
          { width: 14 },
          { width: 12 },
          { width: 18 },
          { width: 20 },
          { width: 48 }
        ];

        ws2.mergeCells('A1:G1');
        const h1 = ws2.getCell('A1');
        h1.value = 'CENTRO PSICOPEDAGÓGICO Y DE ATENCIÓN PSICOLÓGICA "PSI APRENDE"';
        h1.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLOR_WHITE } };
        h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
        h1.alignment = { horizontal: 'center', vertical: 'middle' };
        ws2.getRow(1).height = 32;

        ws2.mergeCells('A2:G2');
        const h2 = ws2.getCell('A2');
        h2.value = `CARTERA INDIVIDUAL DE PACIENTES Y DIAGNÓSTICOS - ${friendlyPeriod.toUpperCase()}`;
        h2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_WHITE } };
        h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PURPLE } };
        h2.alignment = { horizontal: 'center', vertical: 'middle' };
        ws2.getRow(2).height = 22;

        ws2.getRow(3).height = 10;

        const headers = ['Expediente', 'Nombre del Paciente', 'Edad', 'Sexo', 'Estado Clínico', 'Sesiones Conmigo', 'Diagnóstico / Impresión Clínica'];
        const rHeader = ws2.getRow(4);
        rHeader.values = headers;
        rHeader.height = 26;
        rHeader.eachCell(c => {
          c.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_WHITE } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
          c.alignment = { horizontal: 'center', vertical: 'middle' };
          c.border = borderHeader;
        });

        let rIdx = 5;
        let totSesiones = 0;
        (this.analyticsData.my_patients_list || []).forEach((p, idx) => {
          const row = ws2.getRow(rIdx);
          totSesiones += Number(p.sesiones_conmigo || 0);
          row.values = [
            p.codigo_expediente,
            p.paciente_nombre,
            p.edad + ' años',
            p.sexo,
            p.estado_clinico,
            p.sesiones_conmigo,
            p.ultimo_diagnostico || 'Evaluación inicial en curso'
          ];
          row.height = 22;
          const bg = idx % 2 === 0 ? COLOR_WHITE : COLOR_ZEBRA;
          row.eachCell((cell, colNum) => {
            cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1E293B' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
            cell.border = borderThin;
            cell.alignment = { vertical: 'middle' };
            if (colNum === 1) cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
            if ([1, 3, 4, 5, 6].includes(colNum)) cell.alignment.horizontal = 'center';
            if (colNum === 5) {
              cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_SUCCESS } };
            }
          });
          rIdx++;
        });

        // Fila Total
        const totRow = ws2.getRow(rIdx);
        ws2.mergeCells(`A${rIdx}:E${rIdx}`);
        totRow.getCell(1).value = 'TOTAL SESIONES CON MIS PACIENTES:';
        totRow.getCell(6).value = totSesiones;
        totRow.getCell(7).value = `${(this.analyticsData.my_patients_list || []).length} pacientes en seguimiento`;
        totRow.height = 26;

        for (let col = 1; col <= 7; col++) {
          const c = totRow.getCell(col);
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
          c.border = borderTotal;
          c.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
          c.alignment = { vertical: 'middle', horizontal: col === 1 ? 'right' : 'center' };
        }
      }

      // =========================================================
      // HOJA 3: DEMANDA SEMANAL (LUNES A SÁBADO)
      // =========================================================
      const ws3 = wb.addWorksheet('Demanda Semanal', {
        views: [{ showGridLines: true }]
      });

      ws3.columns = [
        { width: 24 },
        { width: 22 },
        { width: 22 },
        { width: 24 },
        { width: 34 }
      ];

      ws3.mergeCells('A1:E1');
      const w1 = ws3.getCell('A1');
      w1.value = 'CENTRO PSICOPEDAGÓGICO Y DE ATENCIÓN PSICOLÓGICA "PSI APRENDE"';
      w1.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: COLOR_WHITE } };
      w1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
      w1.alignment = { horizontal: 'center', vertical: 'middle' };
      ws3.getRow(1).height = 32;

      ws3.mergeCells('A2:E2');
      const w2 = ws3.getCell('A2');
      w2.value = `DISTRIBUCIÓN SEMANAL DE LA DEMANDA ASISTENCIAL (LUNES A SÁBADO) - ${friendlyPeriod.toUpperCase()}`;
      w2.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: COLOR_WHITE } };
      w2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PURPLE } };
      w2.alignment = { horizontal: 'center', vertical: 'middle' };
      ws3.getRow(2).height = 22;

      ws3.getRow(3).height = 10;

      const headersW = ['Día de la Semana', 'Citas Programadas', 'Citas Atendidas', 'Tasa de Asistencia (%)', 'Nivel de Demanda Operativa'];
      const rHeaderW = ws3.getRow(4);
      rHeaderW.values = headersW;
      rHeaderW.height = 26;
      rHeaderW.eachCell(c => {
        c.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_WHITE } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.border = borderHeader;
      });

      let wIdx = 5;
      let totSemProg = 0;
      let totSemAtend = 0;

      (this.analyticsData.weekly_distribution || []).forEach((w, idx) => {
        totSemProg += Number(w.citas_programadas || 0);
        totSemAtend += Number(w.citas_atendidas || 0);
        const tasa = w.citas_programadas > 0 
          ? Math.round((w.citas_atendidas / w.citas_programadas) * 100) + '%'
          : '100%';
        const nivel = w.citas_programadas >= 6 ? 'Alta Demanda' : (w.citas_programadas >= 3 ? 'Demanda Media' : 'Demanda Moderada');

        const row = ws3.getRow(wIdx);
        row.values = [
          w.dia,
          w.citas_programadas,
          w.citas_atendidas,
          tasa,
          nivel
        ];
        row.height = 22;
        const bg = idx % 2 === 0 ? COLOR_WHITE : COLOR_ZEBRA;
        row.eachCell((cell, colNum) => {
          cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1E293B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border = borderThin;
          cell.alignment = { vertical: 'middle' };
          if (colNum === 1) cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
          if ([2, 3, 4, 5].includes(colNum)) cell.alignment.horizontal = 'center';
        });
        wIdx++;
      });

      // Fila Total
      const totRowW = ws3.getRow(wIdx);
      totRowW.getCell(1).value = 'TOTAL SEMANAL:';
      totRowW.getCell(2).value = totSemProg;
      totRowW.getCell(3).value = totSemAtend;
      totRowW.getCell(4).value = totSemProg > 0 ? Math.round((totSemAtend / totSemProg) * 100) + '%' : '100%';
      totRowW.getCell(5).value = 'Cierre de ciclo semanal';
      totRowW.height = 26;

      for (let col = 1; col <= 5; col++) {
        const c = totRowW.getCell(col);
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_TOTAL_BG } };
        c.border = borderTotal;
        c.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: COLOR_NAVY } };
        c.alignment = { vertical: 'middle', horizontal: col === 1 ? 'right' : 'center' };
      }

      // Descarga de archivo XLSX idéntica a CashRegisterView
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const rolePrefix = this.isAdmin ? 'Global_Direccion' : 'Individual_Terapeuta';
      const cleanPeriodName = friendlyPeriod.replace(/\s+/g, '_');
      const fileName = `PSI_Aprende_Reporte_Estadistico_${rolePrefix}_${cleanPeriodName}_2026.xlsx`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      Toast.success('¡Planilla Excel institucional descargada exitosamente!');
    } catch (e) {
      console.error('Error al exportar Excel:', e);
      Toast.error('No se pudo generar la planilla en Excel.');
    }
  }

  printOfficialReport() {
    const reportEl = document.getElementById('printable-executive-report');
    if (!reportEl) return;

    printIsolatedDocument({
      title: 'Informe Oficial de Gestión Clínica · PSI Aprende',
      contentHtml: reportEl.innerHTML,
      styles: `
        table { font-size: 8pt; width: 100%; border-collapse: collapse; }
        th, td { padding: 4px 6px !important; }
      `
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
