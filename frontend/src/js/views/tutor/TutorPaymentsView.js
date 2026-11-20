import { apiClient } from '../../api/apiClient.js';
import { Toast } from '../../components/Toast.js';
import { Icons } from '../../components/Icons.js';
import { store } from '../../store.js';
import { printIsolatedDocument } from '../../utils/printHelper.js';

export class TutorPaymentsView {
  constructor(container) {
    this.container = container;
    this.payments = [];
    this.qrConfig = null;
    this.activeTab = 'pending'; // 'pending' | 'in_review' | 'completed'
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

  async render() {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem;">
        <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto;">
          <div style="display: inline-flex; animation: spin 1.1s linear infinite;">${Icons.pulse(24, 'var(--soft-purple-primary)')}</div>
        </div>
        <p style="color: var(--soft-text-body); margin-top: 0.9rem; font-weight: 500; font-size: 0.9rem;">Cargando aranceles, consultas y pasarela QR familiar...</p>
      </div>
    `;

    try {
      await this.loadData();
      this.renderContent();
    } catch (error) {
      console.error('Error al cargar TutorPaymentsView:', error);
      this.container.innerHTML = `
        <div class="page-container panel-general" style="max-width: 900px; margin: 0 auto;">
          <div class="soft-card" style="text-align: center; padding: 2.5rem 1.5rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px;">
            <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto 1rem;">
              ${Icons.alertTriangle(28, '#DC2626')}
            </div>
            <h3 style="color: var(--brand-navy); font-size: 1.15rem; margin-bottom: 0.5rem;">No se pudo cargar su información de aranceles</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">${this.escapeHtml(error.message)}</p>
            <button type="button" class="soft-btn soft-btn-lvl-1" id="btn-retry-tutor-pay">
              ${Icons.refresh(16, '#FFFFFF')}
              <span>Reintentar</span>
            </button>
          </div>
        </div>
      `;
      document.getElementById('btn-retry-tutor-pay')?.addEventListener('click', () => this.render());
    }
  }

  async loadData() {
    const [paymentsRes, qrRes] = await Promise.all([
      apiClient.get('/payments'),
      apiClient.get('/payments/qr-config').catch(() => ({ data: null }))
    ]);

    this.payments = paymentsRes.data || [];
    this.qrConfig = qrRes.data || null;
  }

  renderContent() {
    const pendingList = this.payments.filter(p => p.estado === 'PENDIENTE');
    const inReviewList = this.payments.filter(p => p.estado === 'EN_REVISION');
    const completedList = this.payments.filter(p => p.estado === 'VERIFICADO' || p.estado === 'COMPLETADO');

    const config = this.qrConfig || {};
    const defaultQrUrl = config.PAGO_QR_IMAGEN || '/uploads/qr/default_qr_psi_aprende.svg';
    const bankName = config.PAGO_BANCO_NOMBRE || 'Banco Unión S.A.';
    const accountNum = config.PAGO_CUENTA_NUMERO || '1000004829103';
    const accountHolder = config.PAGO_CUENTA_TITULAR || 'Centro PSI Aprende SRL';

    this.container.innerHTML = `
      <div class="page-container panel-general" style="max-width: 1040px; margin: 0 auto;">
        <!-- CABECERA -->
        <div class="soft-header-row" style="margin-bottom: 1.5rem;">
          <div>
            <div class="soft-header-meta">
              <a href="#/dashboard" class="soft-back-link">&larr; Volver al Portal Familiar</a>
              <span class="soft-badge soft-badge-mint">Aranceles &amp; Pagos Digitales</span>
            </div>
            <h1 class="soft-page-title">
              Mis Pagos y Aranceles de Consulta
            </h1>
            <p class="soft-page-subtitle" style="max-width: 780px;">
              Consulte los aranceles habilitados por sus especialistas para sesiones diagnósticas o terapéuticas, escanee el código QR oficial de cobro correspondiente y suba su constancia de transferencia bancaria.
            </p>
          </div>
        </div>

        <!-- PESTAÑAS DE NAVEGACIÓN FAMILIAR -->
        <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--soft-border-card-inner, #E2DCF0); padding-bottom: 0.75rem; flex-wrap: wrap;">
          <button type="button" id="tab-tutor-pending" class="soft-btn ${this.activeTab === 'pending' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-2'}" style="padding: 0.5rem 1.15rem; font-size: 0.88rem;">
            ${Icons.wallet(16, 'currentColor')}
            <span>Pendientes de Pago (${pendingList.length})</span>
          </button>
          <button type="button" id="tab-tutor-in-review" class="soft-btn ${this.activeTab === 'in_review' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-2'}" style="padding: 0.5rem 1.15rem; font-size: 0.88rem;">
            ${Icons.clock(16, 'currentColor')}
            <span>Comprobantes en Revisión (${inReviewList.length})</span>
          </button>
          <button type="button" id="tab-tutor-completed" class="soft-btn ${this.activeTab === 'completed' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-2'}" style="padding: 0.5rem 1.15rem; font-size: 0.88rem;">
            ${Icons.checkCircle(16, 'currentColor')}
            <span>Pagos Verificados &amp; Recibos (${completedList.length})</span>
          </button>
        </div>

        <!-- CONTENIDO SEGÚN PESTAÑA -->
        ${this.activeTab === 'pending' ? this.renderPendingSection(pendingList) : ''}
        ${this.activeTab === 'in_review' ? this.renderInReviewSection(inReviewList) : ''}
        ${this.activeTab === 'completed' ? this.renderCompletedSection(completedList) : ''}

      </div>

      <!-- CONTENEDOR MODAL DE PAGO QR Y RECIBO -->
      <div id="modal-container-tutor-pay"></div>
    `;

    this.attachEvents(pendingList, inReviewList, completedList);
  }

  renderPendingSection(pendingList) {
    if (pendingList.length === 0) {
      return `
        <div class="soft-card" style="text-align: center; padding: 3rem 1.5rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF;">
          <div class="soft-icon-box soft-icon-box-mint" style="margin: 0 auto 0.85rem;">
            ${Icons.checkCircle(26, 'var(--soft-mint-deep)')}
          </div>
          <h3 style="color: var(--brand-navy); font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem 0;">¡Al día! No tiene pagos de consulta pendientes</h3>
          <p style="color: var(--text-secondary); font-size: 0.86rem; margin: 0;">Cuando su especialista habilite una orden de cobro por sesión clínica o evaluación, aparecerá aquí con su código QR correspondiente.</p>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${pendingList.map(item => {
          const fechaCita = item.cita_fecha ? `${item.cita_fecha} ${item.cita_hora_inicio ? item.cita_hora_inicio.slice(0, 5) : ''}` : this.formatDateTime(item.fecha_creacion || item.created_at);
          const montoNum = item.monto || item.monto_bob || 0;

          return `
            <div class="soft-card" style="padding: 1.4rem 1.65rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.03);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.85rem;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.35rem;">
                    <span class="soft-badge" style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); color: var(--soft-purple-primary); font-weight: 700; font-size: 0.76rem;">
                      ${item.cita_id ? `Cita #${item.cita_id}` : `Orden #${item.id}`}
                    </span>
                    <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">
                      ${this.escapeHtml(fechaCita)}
                    </span>
                  </div>

                  <h3 style="color: var(--brand-navy); font-size: 1.18rem; font-weight: 800; margin: 0 0 0.25rem 0;">
                    ${this.escapeHtml(item.servicio_nombre || 'Consulta Clínica Especializada')}
                  </h3>

                  <div style="font-size: 0.84rem; color: var(--text-secondary); line-height: 1.4;">
                    Paciente: <strong style="color: var(--brand-navy);">${this.escapeHtml(item.paciente_nombre)}</strong> · Especialista: <strong style="color: var(--brand-navy);">Lic. ${this.escapeHtml(item.terapeuta_nombre)}</strong>
                  </div>
                </div>

                <div style="text-align: right;">
                  <div style="font-size: 0.72rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; color: var(--text-secondary);">
                    Arancel a Pagar
                  </div>
                  <div style="font-size: 1.45rem; font-weight: 800; color: var(--soft-purple-primary); margin-top: 0.1rem;">
                    ${this.formatMoney(montoNum)}
                  </div>
                </div>
              </div>

              ${item.observaciones ? `
                <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 12px; padding: 0.8rem 1rem; margin-bottom: 1.15rem; font-size: 0.84rem; color: var(--brand-navy); line-height: 1.45;">
                  <strong style="color: var(--soft-purple-primary); display: block; font-size: 0.72rem; text-transform: uppercase; margin-bottom: 0.2rem;">
                    Indicación del Especialista:
                  </strong>
                  ${this.escapeHtml(item.observaciones)}
                </div>
              ` : ''}

              <div style="border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 0.95rem; display: flex; justify-content: flex-end; align-items: center;">
                <button type="button" class="btn-tutor-pay-action soft-btn soft-btn-lvl-1"
                  data-payment-id="${item.id}"
                  data-therapist-id="${item.terapeuta_id}"
                  data-amount="${montoNum}"
                  data-patient="${this.escapeHtml(item.paciente_nombre)}"
                  data-service="${this.escapeHtml(item.servicio_nombre || 'Consulta')}"
                  data-therapist-name="${this.escapeHtml(item.terapeuta_nombre)}"
                  data-notes="${this.escapeHtml(item.observaciones || '')}">
                  ${Icons.qrCode(15, '#FFFFFF')}
                  <span>Pagar con QR y Subir Comprobante</span>
                </button>
              </div>

            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderInReviewSection(inReviewList) {
    if (inReviewList.length === 0) {
      return `
        <div class="soft-card" style="text-align: center; padding: 3rem 1.5rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF;">
          <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto 0.85rem;">
            ${Icons.clock(26, 'var(--soft-purple-primary)')}
          </div>
          <h3 style="color: var(--brand-navy); font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem 0;">No tiene comprobantes en revisión</h3>
          <p style="color: var(--text-secondary); font-size: 0.86rem; margin: 0;">Cuando suba la captura de su transferencia QR, aparecerá aquí durante el proceso de verificación.</p>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${inReviewList.map(item => {
          return `
            <div class="soft-card" style="padding: 1.35rem 1.6rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.03); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.35rem;">
                  <span class="soft-badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; font-weight: 700; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                    ${Icons.clock(12, '#B45309')} En Revisión por el Especialista / Recepción
                  </span>
                  <span style="font-size: 0.78rem; color: var(--text-secondary);">
                    Enviado: ${this.formatDateTime(item.fecha_pago || item.fecha_creacion)}
                  </span>
                </div>

                <h3 style="color: var(--brand-navy); font-size: 1.1rem; font-weight: 800; margin: 0 0 0.25rem 0;">
                  ${this.escapeHtml(item.servicio_nombre || 'Consulta Clínica')} · ${this.escapeHtml(item.paciente_nombre)}
                </h3>

                <div style="font-size: 0.82rem; color: var(--text-secondary);">
                  Especialista: <strong>Lic. ${this.escapeHtml(item.terapeuta_nombre)}</strong>
                  ${item.numero_transaccion ? ` · Ref. Bancaria: <code style="color: var(--brand-purple); font-weight: 700;">${this.escapeHtml(item.numero_transaccion)}</code>` : ''}
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="text-align: right;">
                  <div style="font-size: 1.25rem; font-weight: 800; color: var(--brand-navy);">
                    ${this.formatMoney(item.monto)}
                  </div>
                </div>

                ${item.comprobante_url ? `
                  <button type="button" class="btn-tutor-view-uploaded soft-btn soft-btn-lvl-2" data-payment-id="${item.id}" style="font-size: 0.8rem; padding: 0.45rem 0.85rem;">
                    ${Icons.eye(14, 'currentColor')}
                    <span>Ver Comprobante</span>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  renderCompletedSection(completedList) {
    if (completedList.length === 0) {
      return `
        <div class="soft-card" style="text-align: center; padding: 3rem 1.5rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF;">
          <div class="soft-icon-box soft-icon-box-mint" style="margin: 0 auto 0.85rem;">
            ${Icons.receipt(26, 'var(--soft-mint-deep)')}
          </div>
          <h3 style="color: var(--brand-navy); font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem 0;">Aún no cuenta con pagos verificados</h3>
          <p style="color: var(--text-secondary); font-size: 0.86rem; margin: 0;">Los recibos oficiales de sus consultas aparecerán aquí una vez validados.</p>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${completedList.map(item => {
          return `
            <div class="soft-card" style="padding: 1.35rem 1.6rem; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(107, 70, 193, 0.03); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.35rem;">
                  <span class="soft-badge soft-badge-mint" style="font-weight: 700; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                    ${Icons.checkCircle(12, 'var(--soft-mint-deep)')} Pago Verificado &amp; Acreditado
                  </span>
                  <span style="font-size: 0.78rem; color: var(--text-secondary);">
                    Fecha: ${this.formatDateTime(item.fecha_verificacion || item.fecha_pago || item.fecha_creacion)}
                  </span>
                </div>

                <h3 style="color: var(--brand-navy); font-size: 1.1rem; font-weight: 800; margin: 0 0 0.25rem 0;">
                  ${this.escapeHtml(item.servicio_nombre || 'Consulta Clínica')} · ${this.escapeHtml(item.paciente_nombre)}
                </h3>

                <div style="font-size: 0.82rem; color: var(--text-secondary);">
                  Atendido por: <strong>Lic. ${this.escapeHtml(item.terapeuta_nombre)}</strong>
                  ${item.aprobado_por_nombre ? ` · Validado por: ${this.escapeHtml(item.aprobado_por_nombre)}` : ''}
                </div>
              </div>

              <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="text-align: right;">
                  <div style="font-size: 1.3rem; font-weight: 800; color: var(--soft-emerald-dark);">
                    ${this.formatMoney(item.monto)}
                  </div>
                </div>

                <button type="button" class="btn-tutor-print-receipt soft-btn soft-btn-lvl-2" data-payment-id="${item.id}" style="font-size: 0.82rem; padding: 0.45rem 0.95rem;">
                  ${Icons.printer(14, 'currentColor')}
                  <span>Recibo Oficial</span>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  attachEvents(pendingList, inReviewList, completedList) {
    // Pestañas
    document.getElementById('tab-tutor-pending')?.addEventListener('click', () => {
      this.activeTab = 'pending';
      this.renderContent();
    });
    document.getElementById('tab-tutor-in-review')?.addEventListener('click', () => {
      this.activeTab = 'in_review';
      this.renderContent();
    });
    document.getElementById('tab-tutor-completed')?.addEventListener('click', () => {
      this.activeTab = 'completed';
      this.renderContent();
    });

    // Copiar número de cuenta
    document.getElementById('btn-copy-account')?.addEventListener('click', () => {
      const accText = document.getElementById('text-bank-account')?.textContent?.trim();
      if (accText) {
        navigator.clipboard.writeText(accText).then(() => {
          const btnText = document.getElementById('btn-copy-account-text');
          if (btnText) btnText.textContent = '¡Copiado!';
          Toast.success('Número de cuenta copiado al portapapeles.');
          setTimeout(() => { if (btnText) btnText.textContent = 'Copiar Número'; }, 2000);
        }).catch(() => {
          Toast.info(`Número de cuenta: ${accText}`);
        });
      }
    });

    // Abrir modal de pago con QR
    document.querySelectorAll('.btn-tutor-pay-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const paymentId = e.currentTarget.getAttribute('data-payment-id');
        const therapistId = e.currentTarget.getAttribute('data-therapist-id');
        const amount = e.currentTarget.getAttribute('data-amount');
        const patient = e.currentTarget.getAttribute('data-patient');
        const service = e.currentTarget.getAttribute('data-service');
        const therapistName = e.currentTarget.getAttribute('data-therapist-name');
        const notes = e.currentTarget.getAttribute('data-notes') || '';

        await this.openPaymentModal({ paymentId, therapistId, amount, patient, service, therapistName, notes });
      });
    });

    // Ver comprobante subido (vía endpoint protegido con token)
    document.querySelectorAll('.btn-tutor-view-uploaded').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const paymentId = e.currentTarget.getAttribute('data-payment-id');
        const payment = this.payments.find(p => String(p.id) === String(paymentId));
        if (payment?.comprobante_url) {
          if (payment.comprobante_url.startsWith('data:')) {
            window.open(payment.comprobante_url, '_blank');
          } else {
            const token = store.getState().token || '';
            window.open(`/api/payments/${payment.id}/receipt-file?token=${encodeURIComponent(token)}`, '_blank');
          }
        }
      });
    });

    // Imprimir recibo oficial
    document.querySelectorAll('.btn-tutor-print-receipt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const paymentId = e.currentTarget.getAttribute('data-payment-id');
        this.openOfficialReceiptModal(paymentId);
      });
    });
  }

  // MODAL DE PAGO QR CON QR DEL TERAPEUTA O INSTITUCIONAL
  async openPaymentModal({ paymentId, therapistId, amount, patient, service, therapistName, notes = '' }) {
    const modalContainer = document.getElementById('modal-container-tutor-pay');
    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 580px; max-height: 92vh; overflow-y: auto; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15); text-align: center;">
          <div style="display: inline-flex; animation: spin 1s linear infinite;">${Icons.pulse(24, 'var(--soft-purple-primary)')}</div>
          <p style="color: var(--text-secondary); margin-top: 0.75rem; font-size: 0.88rem;">Obteniendo código QR y datos bancarios de ${this.escapeHtml(therapistName)}...</p>
        </div>
      </div>
    `;

    let payConfig = null;
    try {
      if (therapistId) {
        const res = await apiClient.get(`/payments/therapist-config/${therapistId}`);
        payConfig = res.data;
      }
    } catch (e) {
      console.warn('Fallback a QR institucional:', e);
    }

    if (!payConfig) {
      const config = this.qrConfig || {};
      payConfig = {
        qr_url: config.PAGO_QR_IMAGEN || '/uploads/qr/default_qr_psi_aprende.svg',
        banco_nombre: config.PAGO_BANCO_NOMBRE || 'Banco Unión S.A.',
        cuenta_numero: config.PAGO_CUENTA_NUMERO || '1000004829103',
        cuenta_titular: config.PAGO_CUENTA_TITULAR || 'Centro PSI Aprende SRL',
        es_qr_personal: false
      };
    }

    modalContainer.innerHTML = `
      <div class="modal-backdrop active" style="position: fixed; inset: 0; background: rgba(30, 27, 75, 0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 1rem;">
        <div class="soft-card" style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; width: 100%; max-width: 580px; max-height: 92vh; overflow-y: auto; padding: 1.75rem; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0; font-size: 1.18rem; font-weight: 800; color: var(--brand-navy); display: flex; align-items: center; gap: 0.5rem;">
              ${Icons.qrCode(22, 'var(--soft-purple-primary)')}
              <span>Pago de Consulta con QR Oficial</span>
            </h3>
            <button type="button" class="btn-close-tutor-pay-modal soft-btn soft-btn-lvl-2" style="padding: 0.35rem 0.65rem;">
              ${Icons.close(16)}
            </button>
          </div>

          <!-- MENSAJE PERSONALIZADO CON EL ARANCEL FIJADO POR EL TERAPEUTA -->
          <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 14px; padding: 1.1rem 1.25rem; margin-bottom: 1.25rem; text-align: left;">
            <p style="margin: 0; color: var(--brand-navy); font-size: 0.9rem; line-height: 1.55;">
              Estimado(a) tutor(a): El arancel correspondiente a la atención de <strong style="color: var(--brand-purple);">${this.escapeHtml(service)}</strong> del paciente <strong>${this.escapeHtml(patient)}</strong> con la especialista <strong>Lic. ${this.escapeHtml(therapistName)}</strong> es de <strong style="font-size: 1.15rem; color: var(--soft-purple-primary);">${this.formatMoney(amount)}</strong>.
            </p>
            ${notes ? `
              <div style="margin-top: 0.65rem; padding-top: 0.65rem; border-top: 1px dashed var(--soft-border-card-inner, #E2DCF0); font-size: 0.83rem; color: var(--text-secondary); line-height: 1.45;">
                <strong style="color: var(--soft-purple-primary); display: block; font-size: 0.72rem; text-transform: uppercase; margin-bottom: 0.15rem;">Indicación del Especialista:</strong>
                ${this.escapeHtml(notes)}
              </div>
            ` : `
              <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary); font-size: 0.82rem; line-height: 1.45;">
                Por favor, escanee el código QR provisto a continuación desde su aplicación de banco móvil y adjunte la captura de su transferencia para su validación.
              </p>
            `}
          </div>

          <!-- IMAGEN DEL QR (PERSONAL O INSTITUCIONAL) -->
          <div style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 16px; padding: 1.25rem; text-align: center; margin-bottom: 1.25rem;">
            ${payConfig.qr_vencido ? `
              <div style="background: #FFF1F2; border: 1px solid #FECACA; border-radius: 10px; padding: 0.65rem 0.85rem; margin-bottom: 0.75rem; font-size: 0.78rem; color: #9F1239; line-height: 1.4; text-align: left;">
                <strong>Aviso de Facturación:</strong> El código QR personal del especialista se encuentra en proceso de renovación. Este pago se canalizará temporalmente a través de la cuenta oficial institucional del Centro PSI Aprende.
              </div>
            ` : ''}

            <div style="margin-bottom: 0.5rem;">
              ${(payConfig.es_qr_personal && !payConfig.qr_vencido) ? `
                <span class="soft-badge soft-badge-mint" style="font-size: 0.74rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                  ${Icons.checkCircle(12, 'var(--soft-mint-deep)')} Código QR Personal de Lic. ${this.escapeHtml(therapistName)}
                </span>
              ` : `
                <span class="soft-badge" style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); color: var(--soft-purple-primary); font-size: 0.74rem;">
                  Código QR Oficial Centro PSI Aprende
                </span>
              `}
            </div>

            <div style="background: #FAF9FD; border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 12px; padding: 1rem; max-width: 220px; margin: 0 auto 0.75rem;">
              <img src="${(payConfig.qr_vencido ? (payConfig.qr_url_institucional || '/uploads/qr/default_qr_psi_aprende.svg') : payConfig.qr_url)}?t=${Date.now()}" alt="QR Transferencia" style="width: 100%; height: auto; object-fit: contain; border-radius: 6px; display: block;" onerror="this.onerror=null; this.src='/uploads/qr/default_qr_psi_aprende.svg';" />
            </div>

            <div style="font-weight: 800; color: var(--brand-navy); font-size: 0.92rem;">
              ${this.escapeHtml(payConfig.banco_nombre || 'Banca Móvil QR')} · Cta: <span style="font-family: monospace; color: var(--brand-purple);">${this.escapeHtml(payConfig.cuenta_numero || 'Según código QR')}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem;">
              Titular: <strong>${this.escapeHtml(payConfig.cuenta_titular || therapistName)}</strong>
            </div>
          </div>

          <!-- FORMULARIO DE SUBIDA DE COMPROBANTE -->
          <form id="form-submit-receipt-modal" style="text-align: left;">
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600; color: var(--brand-navy); margin-bottom: 0.35rem; display: block;">
                Adjuntar Captura o Foto del Comprobante - Formatos JPG, PNG o PDF: <span style="color: #DC2626;">*</span>
              </label>
              <input type="file" id="input-receipt-file" class="form-input" accept="image/png,image/jpeg,image/webp,application/pdf" required style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;" />
            </div>

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="font-size: 0.82rem; font-weight: 600; color: var(--brand-navy); margin-bottom: 0.35rem; display: block;">
                N° de Referencia o Transacción Bancaria - Opcional:
              </label>
              <input type="text" id="input-receipt-tx" class="form-input" placeholder="Ej: 94827103" style="border: 1px solid var(--soft-border-card-inner, #E2DCF0); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; width: 100%; box-sizing: border-box;" />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1rem;">
              <button type="button" class="btn-close-tutor-pay-modal soft-btn soft-btn-lvl-2">Cancelar</button>
              <button type="submit" id="btn-send-receipt-action" class="soft-btn soft-btn-lvl-1">
                ${Icons.upload(15, '#FFFFFF')}
                <span>Enviar Comprobante para Validación</span>
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.btn-close-tutor-pay-modal').forEach(b => {
      b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });

    const form = document.getElementById('form-submit-receipt-modal');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('input-receipt-file');
      if (!fileInput?.files?.[0]) {
        Toast.error('Por favor seleccione una imagen o archivo de comprobante.');
        return;
      }

      const txNum = document.getElementById('input-receipt-tx')?.value.trim();
      const formData = new FormData();
      formData.append('comprobante', fileInput.files[0]);
      if (txNum) formData.append('numero_transaccion', txNum);

      const submitBtn = document.getElementById('btn-send-receipt-action');
      if (submitBtn) submitBtn.disabled = true;

      try {
        Toast.info('Subiendo constancia de transferencia...');
        await apiClient.request(`/payments/${paymentId}/upload-receipt`, {
          method: 'POST',
          body: formData
        });

        Toast.success('¡Comprobante enviado con éxito! Queda en revisión para su validación por el especialista o recepción.');
        modalContainer.innerHTML = '';
        this.activeTab = 'in_review';
        await this.loadData();
        this.renderContent();
      } catch (err) {
        Toast.error(err.message || 'Error al subir el comprobante de pago.');
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // MODAL RECIBO OFICIAL PARA IMPRESIÓN BIOÉTICA
  openOfficialReceiptModal(paymentId) {
    const payment = this.payments.find(p => String(p.id) === String(paymentId));
    if (!payment) return;

    const modalContainer = document.getElementById('modal-container-tutor-pay');
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
            <div><strong>Fecha de Emisión:</strong> ${this.formatDateTime(payment.fecha_verificacion || payment.fecha_pago || payment.fecha_creacion || payment.created_at)}</div>
            <div><strong>Registro Asociado:</strong> ${payment.cita_id ? `CITA #${payment.cita_id}` : `ORDEN #${payment.id}`}</div>
            <div><strong>Paciente:</strong> ${this.escapeHtml(payment.paciente_nombre)}</div>
            <div><strong>Tutor Responsable:</strong> ${this.escapeHtml(payment.tutor_nombre)}</div>
            <div style="grid-column: span 2;"><strong>Especialista Asignado:</strong> Lic. ${this.escapeHtml(payment.terapeuta_nombre)}</div>
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
                  <div style="font-weight: 600; color: var(--brand-navy);">${this.escapeHtml(payment.servicio_nombre || 'Consulta Clínica')}</div>
                  <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.15rem;">
                    Modalidad: ${payment.metodo_pago === 'EFECTIVO' ? 'Efectivo en Consultorio' : 'Transferencia QR Bancario'}
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

          <!-- BOTONES DE ACCIÓN -->
          <div class="no-print" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.75rem; border-top: 1px solid var(--soft-divider, #EAE5F5); padding-top: 1rem;">
            <button type="button" class="btn-close-receipt-modal soft-btn soft-btn-lvl-2">Cerrar</button>
            <button type="button" id="btn-print-official-tutor-receipt" class="soft-btn soft-btn-lvl-1">
              ${Icons.printer(16, '#FFFFFF')}
              <span>Imprimir Recibo</span>
            </button>
          </div>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.btn-close-receipt-modal').forEach(b => {
      b.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });

    document.getElementById('btn-print-official-tutor-receipt')?.addEventListener('click', () => {
      this.printReceiptIsolated(payment);
    });
  }

  printReceiptIsolated(payment) {
    const instNombre = store.getState().publicConfig?.INSTITUCION_NOMBRE || 'Centro Psicopedagógico y de Atención Psicológica "PSI Aprende"';
    const instDireccion = store.getState().publicConfig?.INSTITUCION_DIRECCION || 'Calle Ladislao Cabrera entre Calle Antezana y Calle 16 de Julio, Cochabamba, Bolivia';
    const instTelefono = store.getState().publicConfig?.INSTITUCION_TELEFONO || '+591 4 4521234';

    const fechaEmision = this.formatDateTime(payment.fecha_verificacion || payment.fecha_pago || payment.fecha_creacion || payment.created_at);
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
          <div><strong style="color: #475569;">Tutor Responsable:</strong> <span style="color: #0F172A;">${this.escapeHtml(payment.tutor_nombre)}</span></div>
          <div style="grid-column: span 2;"><strong style="color: #475569;">Especialista Asignado:</strong> <span style="color: #0F172A;">Lic. ${this.escapeHtml(payment.terapeuta_nombre)}</span></div>
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
                <div style="font-weight: 700; color: #0F172A;">${this.escapeHtml(payment.servicio_nombre || 'Consulta Clínica')}</div>
                <div style="font-size: 7.4pt; color: #64748B; margin-top: 2px;">
                  Modalidad: ${payment.metodo_pago === 'EFECTIVO' ? 'Efectivo en Consultorio' : 'Transferencia QR Bancario'}
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
                  <div style="color: #64748B; font-size: 7.2pt; margin-top: 1px;">Conformidad de Pago</div>
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
