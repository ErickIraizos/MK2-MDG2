import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';
import { store } from '../../store.js';

export class WhatsAppSessionsView {
  constructor(container) {
    this.container = container;
    this.user = store.getState().user;
    this.sessions = [];
    this.appointments = [];
    this.selectedDay = this.getBoliviaDateString();
    this.selectedMonth = this.selectedDay.slice(0, 7); // 'YYYY-MM'
    this.appointmentSearch = '';
    this.selectedCitaForModal = null;
    this.isLoading = false;
    this.activeQrTherapistId = null;
    this.qrPollingInterval = null;
  }

  getBoliviaDateString(d = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/La_Paz',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  }

  get isAdmin() {
    return this.user?.rol === 'ADMIN';
  }

  get isTerapeuta() {
    return this.user?.rol === 'TERAPEUTA';
  }

  async render() {
    this.user = store.getState().user;
    this.container.innerHTML = `
      <div class="page-container panel-general">
        
        <!-- CABECERA INSTITUCIONAL SOFT UI (NIVEL 1) -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.whatsapp(14, 'var(--soft-purple-primary)')}
                <span>Módulo H · Mensajería Clínica Multi-Cuenta</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende" · Sesiones Aisladas LocalAuth</span>
            </div>
            <h1 class="soft-page-title">Canales de WhatsApp &amp; Vinculación Móvil</h1>
            <p class="soft-page-subtitle" style="max-width: 820px;">
              Canal de mensajería independiente por especialista. Los recordatorios se despachan desde el número oficial del profesional asignado a cada sesión con protección anti-bloqueo (1.5s - 3s).
            </p>
          </div>

          <div class="soft-header-actions">
            <a href="#/profile" class="soft-btn soft-btn-lvl-1-muted" title="Cambiar mi número de teléfono">
              ${Icons.phone(16, 'var(--soft-purple-primary)')}
              <span>Mi Número en Perfil</span>
            </a>
            <button id="btn-refresh-sessions" type="button" class="soft-btn soft-btn-lvl-1">
              ${Icons.pulse(16, '#FFFFFF')}
              <span>Actualizar Conexiones</span>
            </button>
          </div>
        </div>

        <!-- CONTENEDOR DINÁMICO DE MI CANAL PERSONAL Y DIRECTORIO -->
        <div id="whatsapp-content-area">
          <div style="text-align: center; padding: 3rem 1rem;">
            <div class="soft-spinner soft-spinner-md" style="margin: 0 auto 0.75rem auto;"></div>
            <p style="color: var(--soft-text-body); font-size: 0.9rem;">Sincronizando instancias de mensajería...</p>
          </div>
        </div>

      </div>

      <!-- MODAL NIVEL 2: VINCULACIÓN MEDIANTE CÓDIGO QR -->
      <div id="qr-modal-backdrop" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(36, 40, 91, 0.45); backdrop-filter: blur(8px); z-index: 2000; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 520px; width: 100%;">
          
          <div style="padding: 1.25rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.whatsapp(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 id="qr-modal-title" style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Vincular Dispositivo WhatsApp
                </h3>
                <div id="qr-modal-sub" style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Apunta tu cámara de WhatsApp para vincular este número
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-qr-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <div style="padding: 1.5rem 1.65rem; text-align: center;">
            <div id="qr-display-container" style="min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #FFFFFF; border: 2px dashed var(--soft-border-card-inner); border-radius: 20px; padding: 1.25rem; margin-bottom: 1.2rem;">
              <div class="soft-spinner soft-spinner-lg"></div>
              <p style="margin-top: 1rem; font-size: 0.88rem; font-weight: 700; color: var(--soft-purple-primary);">Generando código QR oficial...</p>
              <p style="margin-top: 0.2rem; font-size: 0.78rem; color: var(--soft-text-muted);">Iniciando navegador seguro en tiempo real...</p>
            </div>

            <!-- Pasos guiados -->
            <div style="background: var(--soft-lavender-surface); border-radius: 14px; padding: 0.95rem 1.1rem; border: 1px solid var(--soft-border-card-inner); text-align: left; font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.5; margin-bottom: 1.35rem;">
              <div style="font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.35rem;">Pasos en tu teléfono:</div>
              <ol style="margin: 0; padding-left: 1.25rem;">
                <li>Abre WhatsApp en tu teléfono móvil.</li>
                <li>Toca <strong>Menú (⋮)</strong> en Android o <strong>Ajustes</strong> en iPhone.</li>
                <li>Selecciona <strong>Dispositivos vinculados</strong> y luego <strong>Vincular un dispositivo</strong>.</li>
                <li>Escanea el código QR que se muestra arriba.</li>
              </ol>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
              <button type="button" id="btn-cancel-qr-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
              <button type="button" id="btn-check-qr-status" class="soft-btn soft-btn-lvl-2">
                ${Icons.pulse(15, '#FFFFFF')}
                <span>Verificar Estado</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- MODAL NIVEL 2: ENVIAR MENSAJE MANUAL CON CITA RÁPIDA Y PACIENTES ASIGNADOS -->
      <div id="test-modal-backdrop" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(36, 40, 91, 0.45); backdrop-filter: blur(8px); z-index: 2000; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 560px; width: 100%; max-height: 92vh; display: flex; flex-direction: column;">
          
          <div style="padding: 1.25rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.send(18, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Mensaje Manual WhatsApp
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Despacho clínico asistido · Retardo preventivo anti-ban (1.5s - 3s)
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-test-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <form id="form-test-message" style="padding: 1.4rem 1.65rem; overflow-y: auto; flex: 1;">
            
            <!-- ALERTA DINÁMICA DE ESTADO (RECONECTANDO / DESCONECTADO) -->
            <div id="test-channel-status-alert" style="display: none; margin-bottom: 1.15rem;"></div>

            <!-- CANAL REMITENTE OFICIAL: FIJO CON EL NOMBRE DEL USUARIO (AISLAMIENTO TOTAL) -->
            <div style="margin-bottom: 1.15rem;">
              <label class="soft-label">Canal Remitente Oficial</label>
              <div id="test-sender-card" style="background: var(--soft-lavender-surface); border: 1.5px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.85rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                    ${Icons.whatsapp(18, 'var(--soft-purple-primary)')}
                  </div>
                  <div>
                    <div id="test-sender-name" style="font-weight: 800; color: var(--soft-text-title); font-size: 0.95rem;">
                      ${this.user.nombre_completo}
                    </div>
                    <div id="test-sender-sub" style="font-size: 0.76rem; color: var(--soft-text-body);">
                      ${this.user.rol} · Teléfono: ${this.user.telefono || 'Sin registrar'}
                    </div>
                  </div>
                </div>
                <span id="test-sender-badge" class="soft-badge soft-badge-emerald">
                  <span class="soft-status-dot"></span>
                  <span>En Línea</span>
                </span>
              </div>
              <input type="hidden" id="test-therapist-id" value="" />
            </div>

            <!-- SELECCIÓN DE PACIENTE TUTELADO O INGRESO MANUAL -->
            <div style="margin-bottom: 1.1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <label class="soft-label" style="margin-bottom: 0;" for="manual-patient-select">Destinatario / Paciente Asignado</label>
                <span style="font-size: 0.72rem; color: var(--soft-text-muted);">Solo sus pacientes asignados</span>
              </div>
              <select id="manual-patient-select" class="soft-select" style="margin-bottom: 0.65rem;">
                <option value="">-- Ingresar Número Manualmente o Seleccionar Paciente --</option>
              </select>

              <div class="soft-phone-group">
                <select id="test-country-code" class="soft-phone-prefix-select" title="Código internacional de país">
                  <option value="+591" selected>+591 (Bolivia)</option>
                  <option value="+54">+54 (Argentina)</option>
                  <option value="+51">+51 (Perú)</option>
                  <option value="+56">+56 (Chile)</option>
                  <option value="+55">+55 (Brasil)</option>
                  <option value="+57">+57 (Colombia)</option>
                  <option value="+595">+595 (Paraguay)</option>
                  <option value="+598">+598 (Uruguay)</option>
                  <option value="+1">+1 (EE.UU. / Can)</option>
                  <option value="+34">+34 (España)</option>
                </select>
                <input 
                  type="tel" 
                  id="test-phone-local" 
                  class="soft-input soft-phone-number-input" 
                  placeholder="Ej. 79706755" 
                  maxlength="15" 
                  required 
                />
              </div>
              <div style="font-size: 0.74rem; color: var(--soft-text-muted); margin-top: 0.32rem;">
                Al seleccionar un paciente, su tutor y teléfono de WhatsApp se vinculan de inmediato.
              </div>
            </div>

            <!-- CITA RÁPIDA (SOLO FECHA Y HORA) -->
            <div style="background: var(--soft-lavender-surface); border: 1.5px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.85rem 1rem; margin-bottom: 1.15rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 0.84rem; font-weight: 700; color: var(--soft-text-title); display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin: 0;">
                  <input type="checkbox" id="manual-quick-apt-toggle" style="accent-color: var(--soft-purple-primary); width: 16px; height: 16px;" checked />
                  <span>Incluir Cita Rápida (Solo Fecha y Hora)</span>
                </label>
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.68rem;">Opcional</span>
              </div>

              <div id="manual-quick-apt-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem; padding-top: 0.65rem; border-top: 1px dashed var(--soft-divider);">
                <div>
                  <label class="soft-label" style="font-size: 0.74rem;" for="manual-quick-date">Fecha de Sesión</label>
                  <input type="date" id="manual-quick-date" class="soft-input" />
                </div>
                <div>
                  <label class="soft-label" style="font-size: 0.74rem;" for="manual-quick-time">Hora de Sesión</label>
                  <input type="time" id="manual-quick-time" class="soft-input" />
                </div>
              </div>
            </div>

            <!-- PLANTILLA PREESTABLECIDA PROFESIONAL -->
            <div style="margin-bottom: 0.95rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <label class="soft-label" style="margin-bottom: 0;" for="manual-template-select">Plantilla Predeterminada Profesional</label>
                <button type="button" id="btn-reset-manual-template" class="soft-btn-link-action" style="font-size: 0.72rem;">
                  Restablecer
                </button>
              </div>
              <select id="manual-template-select" class="soft-select">
                <option value="reminder">1. Recordatorio con Confirmación (Responda 1 o 2)</option>
                <option value="reserved">2. Confirmación de Horario / Espacio Clínico Reservado</option>
                <option value="coordination">3. Aviso de Coordinación Terapéutica / Secretaría</option>
                <option value="custom">4. Mensaje Personalizado Libre</option>
              </select>
            </div>

            <!-- TEXTAREA DEL MENSAJE -->
            <div style="margin-bottom: 1.25rem;">
              <label class="soft-label" for="test-message-text">Contenido del Mensaje</label>
              <textarea id="test-message-text" rows="5" class="soft-textarea" placeholder="Redacte el mensaje..."></textarea>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem; font-size: 0.72rem; color: var(--soft-text-muted);">
                <span>El tutor podrá responder para confirmar asistencia o solicitar reprogramación.</span>
                <span id="manual-msg-chars">0 caracteres</span>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
              <button type="button" id="btn-cancel-test-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
              <button type="submit" id="btn-submit-test-message" class="soft-btn soft-btn-lvl-2">
                ${Icons.send(15, '#FFFFFF')}
                <span>Enviar Ahora</span>
              </button>
            </div>
          </form>

        </div>
      </div>

        </div>
      </div>

      <!-- MODAL NIVEL 2: GESTIÓN Y ENVÍO DE RECORDATORIO DE CITA (SPRINT 9) -->
      <div id="appointment-reminder-modal-backdrop" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(36, 40, 91, 0.45); backdrop-filter: blur(8px); z-index: 2000; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 580px; width: 100%;">
          
          <div style="padding: 1.25rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.whatsapp(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 id="rem-modal-title" style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Notificación Familiar por WhatsApp
                </h3>
                <div id="rem-modal-sub" style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Despacho directo o programado vía canal oficial
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-rem-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <form id="form-appointment-reminder" style="padding: 1.4rem 1.65rem;">
            <input type="hidden" id="rem-cita-id" value="" />

            <!-- FICHA RESUMEN DE LA CITA -->
            <div id="rem-cita-summary" style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.85rem 1rem; margin-bottom: 1.15rem; font-size: 0.83rem;">
              <!-- Llenado dinámico -->
            </div>

            <!-- CANAL REMITENTE (FIJO CON NOMBRE DEL ESPECIALISTA) -->
            <div style="margin-bottom: 1.15rem;">
              <label class="soft-label">Canal Remitente Oficial</label>
              <div style="background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.65rem 0.9rem; font-size: 0.85rem; font-weight: 700; color: var(--soft-text-title); display: flex; align-items: center; gap: 0.5rem;">
                <span style="color: var(--soft-emerald-dark); display: inline-flex;">${Icons.checkCircle(16, 'var(--soft-emerald-dark)')}</span>
                <span id="rem-sender-name">${this.user?.nombre_completo || 'Especialista Asignado'}</span>
              </div>
            </div>

            <!-- NÚMERO DESTINATARIO (CON PREFIJO FIJO +591) -->
            <div style="margin-bottom: 1.15rem;">
              <label class="soft-label">Número de WhatsApp del Tutor (Destinatario) *</label>
              <div style="display: flex; gap: 0.5rem; align-items: stretch;">
                <select id="rem-country-code" class="soft-select" style="width: 110px; font-weight: 700; color: var(--soft-text-title); flex-shrink: 0; background: var(--soft-lavender-surface);">
                  <option value="+591" selected>+591</option>
                  <option value="+54">+54</option>
                  <option value="+55">+55</option>
                  <option value="+56">+56</option>
                  <option value="+51">+51</option>
                  <option value="+593">+593</option>
                  <option value="+595">+595</option>
                  <option value="+57">+57</option>
                  <option value="+1">+1</option>
                  <option value="+34">+34</option>
                </select>
                <input type="tel" id="rem-phone-local" class="soft-input" style="flex: 1;" placeholder="Ej. 70000000" maxlength="15" required />
              </div>
            </div>

            <!-- TIEMPO DE ANTICIPACIÓN / MODO DE ENVÍO -->
            <div style="margin-bottom: 1.15rem;">
              <label class="soft-label">Modo / Horario de Envío</label>
              <select id="rem-timing-select" class="soft-select">
                <option value="NOW">Enviar Ahora Mismo (Despacho Inmediato)</option>
                <option value="30" selected>Programar a 30 minutos antes de la sesión (Recomendado)</option>
                <option value="60">Programar a 1 hora antes</option>
                <option value="120">Programar a 2 horas antes</option>
                <option value="1440">Programar a 24 horas antes (Día anterior)</option>
              </select>
            </div>

            <!-- MENSAJE DE RECORDATORIO (EDITABLE CON PLANTILLA FORMAL) -->
            <div style="margin-bottom: 1.35rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <label class="soft-label" style="margin: 0;">Mensaje Estructurado</label>
                <button type="button" id="btn-reset-rem-modal-msg" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="padding: 0.15rem 0.5rem; font-size: 0.7rem;">
                  Restablecer Plantilla
                </button>
              </div>
              <textarea id="rem-message-text" rows="5" class="soft-textarea" style="font-size: 0.8rem; line-height: 1.45;"></textarea>
              <div style="font-size: 0.71rem; color: var(--soft-text-muted); margin-top: 0.3rem;">
                El tutor podrá responder <strong>1</strong> para confirmar o <strong>2</strong> para solicitar reprogramación.
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.65rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem; flex-wrap: wrap; align-items: center;">
              <button type="button" id="btn-cancel-rem-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
              <button type="button" id="btn-rem-send-pwa-now" class="soft-btn soft-btn-lvl-2-soft" title="Enviar notificación Web Push PWA al móvil/PC del tutor de forma inmediata">
                ${Icons.bell(15, 'var(--soft-purple-primary)')}
                <span>Notificar PWA Inmediata</span>
              </button>
              <button type="submit" id="btn-submit-rem-modal" class="soft-btn soft-btn-lvl-2">
                ${Icons.send(15, '#FFFFFF')}
                <span id="rem-submit-btn-text">Confirmar Acción</span>
              </button>
            </div>
          </form>

        </div>
      </div>

      <!-- MODAL NIVEL 2: CONFIRMACIÓN DE DESVINCULACIÓN WHATSAPP (REEMPLAZA EL CONFIRM NATIVO) -->
      <div id="disconnect-modal-backdrop" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(36, 40, 91, 0.45); backdrop-filter: blur(8px); z-index: 2000; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 480px; width: 100%;">
          
          <div style="padding: 1.25rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-rose">
                ${Icons.wifiOff(18, 'var(--soft-rose)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0;">
                  Desvincular Canal WhatsApp
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Confirmación de desconexión de sesión clínica
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-disconnect-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <div style="padding: 1.45rem 1.65rem;">
            <p style="font-size: 0.9rem; color: var(--soft-text-body); line-height: 1.5; margin: 0 0 1rem 0;">
              ¿Está seguro de que desea desvincular el canal de WhatsApp de <strong id="disconnect-therapist-name" style="color: var(--soft-text-title);">este especialista</strong>?
            </p>
            
            <div style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.22); border-radius: 12px; padding: 0.85rem 1.05rem; font-size: 0.82rem; color: #BE123C; line-height: 1.48; margin-bottom: 1.35rem;">
              <strong>Advertencia institucional:</strong> Los recordatorios automáticos de citas hacia las familias quedarán pausados para este profesional hasta que vuelva a escanear el código QR.
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
              <button type="button" id="btn-cancel-disconnect-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
              <button type="button" id="btn-confirm-disconnect-action" class="soft-btn soft-btn-lvl-2" style="background: linear-gradient(135deg, #E11D48 0%, #BE123C 100%);">
                ${Icons.wifiOff(15, '#FFFFFF')}
                <span>Desvincular Canal</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    await this.loadSessions({ silent: true });
    this.attachEvents();
  }

  async loadSessions(options = {}) {
    const silent = options.silent === true;
    try {
      this.isLoading = true;
      const res = await apiClient.get('/whatsapp/sessions');
      this.sessions = res.data || [];
      this.renderDynamicContent();

      // Si algún canal se encuentra reconectando, activar sondeo reactivo suave cada 3s en modo silencioso
      if (this.sessions.some(s => s.estado_en_vivo === 'RECONECTANDO')) {
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.loadSessions({ silent: true });
          }, 3000);
        }
      } else if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Si el modal de prueba está abierto, actualizar su estado dinámicamente
      if (document.getElementById('test-modal-backdrop')?.style.display === 'flex') {
        this.updateTestModalState();
      }
    } catch (err) {
      console.warn('[WhatsAppSessionsView] Aviso sincronizando estado de WhatsApp:', err.message);
      if (!silent) {
        Toast.error('No se pudo sincronizar el estado de WhatsApp.');
      }
      const area = document.getElementById('whatsapp-content-area');
      if (area && (!this.sessions || this.sessions.length === 0)) {
        area.innerHTML = `
          <div class="soft-card-static" style="text-align: center; padding: 2.5rem 1.5rem; margin: 1.5rem 0;">
            <div class="soft-icon-box soft-icon-box-rose" style="margin: 0 auto 0.75rem auto;">
              ${Icons.alertTriangle(24, '#BE123C')}
            </div>
            <h4 style="font-weight: 800; color: var(--soft-text-title); margin-bottom: 0.35rem;">
              Conexión con Servicio de Mensajería en Espera
            </h4>
            <p style="color: var(--soft-text-body); font-size: 0.84rem; max-width: 480px; margin: 0 auto 1.25rem auto;">
              El servidor se encuentra restableciendo los canales de WhatsApp en segundo plano. Puede pulsar el botón para reintentar de inmediato.
            </p>
            <button type="button" id="btn-retry-wa-sync" class="soft-btn soft-btn-lvl-2">
              ${Icons.refresh(15, '#FFFFFF')}
              <span>Reintentar Conexión</span>
            </button>
          </div>
        `;
        document.getElementById('btn-retry-wa-sync')?.addEventListener('click', () => {
          this.loadSessions({ silent: false });
        });
      }

      // Auto-reintento reactivo en 3s por si el backend estaba iniciando
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.loadSessions({ silent: true });
        }, 3000);
      }
    } finally {
      this.isLoading = false;
    }
  }

  splitPhone(raw) {
    if (!raw) return { code: '+591', number: '' };
    const str = String(raw).trim();
    const codes = ['+591', '+54', '+51', '+56', '+55', '+57', '+595', '+598', '+1', '+34'];
    for (const c of codes) {
      if (str.startsWith(c)) {
        return { code: c, number: str.slice(c.length).replace(/[^\d]/g, '') };
      }
      const cleanC = c.replace('+', '');
      if (str.startsWith(cleanC)) {
        return { code: c, number: str.slice(cleanC.length).replace(/[^\d]/g, '') };
      }
    }
    return { code: '+591', number: str.replace(/[^\d]/g, '') };
  }

  renderDynamicContent() {
    const area = document.getElementById('whatsapp-content-area');
    if (!area) return;

    try {
      this.user = this.user || store.getState().user || {};

      // Localizar la sesión individual del usuario logueado
      const myTherapistRecord = this.sessions.find(s => s.usuario_id === this.user?.id || s.terapeuta_id === this.user?.id);
      const myPhone = this.user?.telefono || myTherapistRecord?.terapeuta_telefono_oficial || 'Sin registrar';
      const myLiveStatus = myTherapistRecord?.estado_en_vivo || (myTherapistRecord?.estado === 'CONECTADO' ? 'CONECTADO' : 'DESCONECTADO');
      const isMyConnected = myLiveStatus === 'CONECTADO';
      const isMyReconnecting = myLiveStatus === 'RECONECTANDO';
      const myTherapistId = myTherapistRecord ? myTherapistRecord.terapeuta_id : 1;

    const connectedTotal = this.sessions.filter(s => s.estado_en_vivo === 'CONECTADO').length;

    let myBadge = `
      <span class="soft-badge soft-badge-rose">
        <span class="soft-status-dot"></span>
        <span>Desconectado</span>
      </span>
    `;

    if (isMyConnected) {
      myBadge = `
        <span class="soft-badge soft-badge-emerald">
          <span class="soft-status-dot"></span>
          <span>Conectado / En Línea</span>
        </span>
      `;
    } else if (isMyReconnecting) {
      myBadge = `
        <span class="soft-badge-amber-pulse">
          <span class="soft-spinner soft-spinner-sm soft-spinner-amber"></span>
          <span>Reconectando Sesión...</span>
        </span>
      `;
    }

    let myActions = '';
    if (isMyConnected) {
      myActions = `
        <button type="button" class="soft-btn soft-btn-lvl-1-muted btn-test-session" data-id="${myTherapistId}" title="Redactar y despachar mensaje manual de WhatsApp">
          ${Icons.send(15, 'var(--soft-purple-primary)')}
          <span>Mensaje Manual</span>
        </button>
        <button type="button" class="soft-btn soft-btn-lvl-2-soft btn-disconnect-session" data-id="${myTherapistId}" title="Cerrar sesión de WhatsApp">
          ${Icons.wifiOff(15, 'var(--soft-purple-primary)')}
          <span>Desvincular</span>
        </button>
      `;
    } else if (isMyReconnecting) {
      myActions = `
        <button type="button" class="soft-btn soft-btn-lvl-1-muted" disabled style="opacity: 0.88; cursor: wait;">
          <span class="soft-spinner soft-spinner-sm" style="margin-right: 0.45rem;"></span>
          <span>Reconectando WhatsApp...</span>
        </button>
        <button type="button" class="soft-btn soft-btn-lvl-2-soft btn-disconnect-session" data-id="${myTherapistId}" title="Cancelar enlace">
          ${Icons.wifiOff(15, 'var(--soft-purple-primary)')}
          <span>Desvincular</span>
        </button>
      `;
    } else {
      myActions = `
        <button type="button" class="soft-btn soft-btn-lvl-1 btn-open-qr" data-id="${myTherapistId}">
          ${Icons.qrCode(16, '#FFFFFF')}
          <span>Vincular Mi WhatsApp Móvil (QR)</span>
        </button>
      `;
    }

    area.innerHTML = `
      <!-- FRANJA DE RESUMEN OPERATIVO DINÁMICO (CERO NÚMEROS FIJOS) -->
      <div class="soft-kpi-grid" style="margin-bottom: 1.6rem;">
        <div class="soft-kpi-card">
          <div class="soft-icon-box soft-icon-box-lavender">
            ${Icons.users(22, 'var(--soft-purple-primary)')}
          </div>
          <div class="soft-kpi-body">
            <span class="soft-kpi-overline">Canales Registrados</span>
            <div class="soft-kpi-value">${this.sessions.length} Especialistas</div>
            <div class="soft-kpi-sub">Capacidad dinámica escalable</div>
          </div>
        </div>

        <div class="soft-kpi-card soft-kpi-mint">
          <span class="soft-status-dot-green" title="Canales activos"></span>
          <div class="soft-icon-box soft-icon-box-mint">
            ${Icons.wifi(22, 'var(--soft-mint-deep)')}
          </div>
          <div class="soft-kpi-body">
            <span class="soft-kpi-overline">Canales en Línea</span>
            <div class="soft-kpi-value" style="color: var(--soft-emerald-dark);">${connectedTotal} de ${this.sessions.length} Activos</div>
            <div class="soft-kpi-sub">Listos para avisos a tutores</div>
          </div>
        </div>

        <div class="soft-kpi-card">
          <div class="soft-icon-box soft-icon-box-indigo">
            ${Icons.shield(22, 'var(--soft-indigo-accent)')}
          </div>
          <div class="soft-kpi-body">
            <span class="soft-kpi-overline">Control Anti-Bloqueo</span>
            <div class="soft-kpi-value">1.5s - 3.0s</div>
            <div class="soft-kpi-sub">Pausa de seguridad obligatoria</div>
          </div>
        </div>

        <div class="soft-kpi-card">
          <div class="soft-icon-box soft-icon-box-lavender">
            ${Icons.smartphone(22, 'var(--soft-purple-primary)')}
          </div>
          <div class="soft-kpi-body">
            <span class="soft-kpi-overline">Mi Número Activo</span>
            <div class="soft-kpi-value" style="font-size: 1.15rem; word-break: break-all;">${myPhone}</div>
            <div class="soft-kpi-sub">Configurable en Mi Perfil</div>
          </div>
        </div>
      </div>

      <!-- TARJETA DESTACADA: MI CANAL PERSONAL DE WHATSAPP -->
      <div class="soft-section-card" style="margin-bottom: 2rem; border: 1.5px solid ${isMyConnected ? 'var(--soft-emerald)' : (isMyReconnecting ? 'var(--soft-amber, #F59E0B)' : 'var(--soft-purple-primary)')}; background: linear-gradient(145deg, #FFFFFF 0%, #FFFFFF 65%, #F8F5FE 100%);">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; flex-wrap: wrap; margin-bottom: 1.2rem;">
          <div style="display: flex; align-items: center; gap: 1.1rem;">
            <div style="width: 58px; height: 58px; border-radius: 18px; background: ${isMyConnected ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : (isMyReconnecting ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'var(--soft-btn-lvl-1-bg)')}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.35rem; flex-shrink: 0; box-shadow: 0 8px 20px -4px rgba(88, 66, 148, 0.28);">
              ${(this.user.nombre_completo || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span class="soft-badge soft-badge-lavender">Mi Canal Oficial</span>
                ${myBadge}
              </div>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--soft-text-title); margin: 0;">
                ${this.user.nombre_completo}
              </h2>
              <div style="font-size: 0.85rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                Rol: <strong style="color: var(--soft-text-title);">${this.user.rol}</strong> · Teléfono registrado: <strong style="color: var(--soft-purple-primary);">${myPhone}</strong>
              </div>
            </div>
          </div>

          <!-- Acciones de mi canal -->
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            ${myActions}
          </div>
        </div>

        <div style="font-size: 0.82rem; color: var(--soft-text-muted); border-top: 1px solid var(--soft-divider); padding-top: 0.8rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <span>Este número se utiliza para remitir los avisos automáticos a las familias de tus pacientes asignados.</span>
          <a href="#/profile" style="color: var(--soft-purple-primary); font-weight: 700; text-decoration: none;">Cambiar número en mi perfil &rarr;</a>
        </div>
      </div>

      <!-- SECCIÓN ADMINISTRATIVA: DIRECTO GENERAL DINÁMICO DE ESPECIALISTAS (SOLO ADMIN O SUPERVISIÓN) -->
      ${this.isAdmin ? `
        <div class="soft-section-card">
          <div class="soft-section-header">
            <div>
              <h2 class="soft-section-title">Directorio General de Canales del Personal</h2>
              <p class="soft-section-subtitle">
                Supervisión institucional del estado de WhatsApp de los especialistas clínicos activos en el centro.
              </p>
            </div>
            <span class="soft-badge soft-badge-lavender">
              ${this.sessions.length} Especialistas Registrados
            </span>
          </div>

          <div id="sessions-grid" class="soft-rooms-grid" style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 1.35rem;">
            ${this.renderTherapistCards()}
          </div>
        </div>
      ` : ''}

      <!-- SECCIÓN: AGENDA DE SESIONES & DESPACHO DE NOTIFICACIONES (SPRINT 9) -->
      <div class="soft-section-card" style="margin-top: 2rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div class="soft-icon-box soft-icon-box-lavender">
              ${Icons.calendar(22, 'var(--soft-purple-primary)')}
            </div>
            <div>
              <h3 class="soft-section-title" style="margin: 0; font-size: 1.15rem; font-weight: 800;">
                Agenda Secuencial de Sesiones & Despacho de WhatsApp
              </h3>
              <div style="font-size: 0.82rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                Visualice las citas ordenadas cronológicamente en franjas horizontales: próximas por llegar y cumplidas.
              </div>
            </div>
          </div>

          <!-- Navegador de Días, Selector y Buscador -->
          <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
            <!-- Controles de navegación diaria -->
            <div style="display: inline-flex; align-items: center; background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.25rem 0.4rem; gap: 0.35rem;">
              <button type="button" id="btn-wa-prev-day" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="padding: 0.35rem 0.6rem;" title="Día Anterior">
                ${Icons.chevronLeft(14)}
              </button>
              <input type="date" id="input-wa-agenda-date" class="soft-input" value="${this.selectedDay}" style="font-size: 0.82rem; padding: 0.35rem 0.5rem; width: auto; border: none; background: transparent; font-weight: 700; color: var(--soft-text-title);" />
              <button type="button" id="btn-wa-next-day" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="padding: 0.35rem 0.6rem;" title="Día Siguiente">
                ${Icons.chevronRight(14)}
              </button>
              <button type="button" id="btn-wa-today" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="padding: 0.35rem 0.75rem; font-size: 0.74rem;">
                Hoy
              </button>
            </div>

            <div class="soft-search-box" style="min-width: min(100%, 200px);">
              <span class="soft-search-box-icon">${Icons.search(14)}</span>
              <input type="text" id="input-wa-agenda-search" class="soft-input" value="${this.escapeHtml(this.appointmentSearch)}" placeholder="Buscar paciente o tutor..." style="font-size: 0.82rem;" />
            </div>

            <button type="button" id="btn-wa-reload-appointments" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" title="Sincronizar Citas">
              ${Icons.refresh(14)}
            </button>
          </div>
        </div>

        <!-- Contenedor dinámico de citas de WhatsApp con 2 franjas horizontales -->
        <div id="wa-agenda-content-area">
          <div style="text-align: center; padding: 2.5rem 1rem;">
            <div class="soft-spinner soft-spinner-sm" style="margin: 0 auto 0.5rem auto;"></div>
            <p style="color: var(--soft-text-muted); font-size: 0.82rem;">Sincronizando agenda diaria...</p>
          </div>
        </div>
      </div>
    `;

    this.attachCardListeners(area);
    this.loadAppointments();
    } catch (renderErr) {
      console.error('[WhatsAppSessionsView] Error al renderizar contenido dinámico:', renderErr);
      area.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--soft-text-muted);">
          <div style="color: var(--soft-rose); font-weight: 700; margin-bottom: 0.5rem;">
            Ocurrió un inconveniente al desplegar las sesiones de mensajería.
          </div>
          <button type="button" id="btn-retry-render-wa" class="soft-btn soft-btn-sm soft-btn-lvl-1">
            Reintentar Carga
          </button>
        </div>
      `;
      document.getElementById('btn-retry-render-wa')?.addEventListener('click', () => this.loadSessions({ silent: false }));
    }
  }

  renderTherapistCards() {
    return this.sessions.map((s, idx) => {
      const isConnected = s.estado_en_vivo === 'CONECTADO';
      const isReconnecting = s.estado_en_vivo === 'RECONECTANDO';
      const isWaitingQr = s.estado_en_vivo === 'ESPERANDO_QR';
      const isMintAccent = idx % 2 === 1;

      const initials = `${(s.nombres || '').charAt(0)}${(s.apellidos || '').charAt(0)}`.toUpperCase();
      const avatarBg = isConnected
        ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
        : (isReconnecting ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' : 'var(--soft-btn-lvl-1-bg)');

      let badgeMarkup = `
        <span class="soft-badge soft-badge-rose">
          <span class="soft-status-dot"></span>
          <span>Desconectado</span>
        </span>
      `;

      if (isConnected) {
        badgeMarkup = `
          <span class="soft-badge soft-badge-emerald">
            <span class="soft-status-dot"></span>
            <span>En Línea</span>
          </span>
        `;
      } else if (isReconnecting) {
        badgeMarkup = `
          <span class="soft-badge-amber-pulse">
            <span class="soft-spinner soft-spinner-sm soft-spinner-amber"></span>
            <span>Reconectando</span>
          </span>
        `;
      } else if (isWaitingQr) {
        badgeMarkup = `
          <span class="soft-badge soft-badge-amber">
            <span class="soft-status-dot"></span>
            <span>Esperando QR</span>
          </span>
        `;
      }

      let statusFooter = '';
      if (isConnected) {
        statusFooter = `
          <div style="font-size: 0.8rem; color: var(--soft-emerald-dark); font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.75rem; background: rgba(16, 185, 129, 0.08); border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.2); width: 100%; box-sizing: border-box;">
            ${Icons.checkCircle(15, 'var(--soft-emerald-dark)')}
            <span>Canal Activo en Móvil</span>
          </div>
        `;
      } else if (isReconnecting) {
        statusFooter = `
          <div style="font-size: 0.8rem; color: #B45309; font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.75rem; background: rgba(245, 158, 11, 0.08); border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.2); width: 100%; box-sizing: border-box;">
            <span class="soft-spinner soft-spinner-sm soft-spinner-amber"></span>
            <span>Reconectando en móvil...</span>
          </div>
        `;
      } else {
        statusFooter = `
          <div style="font-size: 0.8rem; color: var(--soft-text-muted); font-weight: 600; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.75rem; background: var(--soft-lavender-surface); border-radius: 12px; border: 1px solid var(--soft-border-card-inner); width: 100%; box-sizing: border-box;">
            ${Icons.wifiOff(15, 'var(--soft-text-muted)')}
            <span>Sin canal activo vinculado</span>
          </div>
        `;
      }

      return `
        <div class="soft-room-card ${isConnected ? 'soft-room-mint' : ''}" style="position: relative; display: flex; flex-direction: column; justify-content: space-between;">
          ${isConnected ? '<span class="soft-status-dot-green" title="WhatsApp en línea" aria-hidden="true"></span>' : ''}
          
          <div>
            <!-- Cabecera de Tarjeta -->
            <div style="display: flex; align-items: center; gap: 0.85rem; margin-bottom: 0.95rem;">
              <div style="width: 48px; height: 48px; border-radius: 15px; background: ${avatarBg}; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.02rem; flex-shrink: 0; box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 16px -4px rgba(62, 48, 118, 0.2);">
                ${initials}
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.15rem;">
                  <span class="soft-badge soft-badge-lavender" style="padding: 0.12rem 0.5rem; font-size: 0.68rem;">
                    ${s.registro_profesional || 'CPB'}
                  </span>
                </div>
                <h3 style="font-size: 1.02rem; font-weight: 800; color: var(--soft-text-title); margin: 0; line-height: 1.25;">
                  ${s.nombres} ${s.apellidos}
                </h3>
              </div>
            </div>

            <!-- Especialidad y Consultorio -->
            <div style="margin-bottom: 0.8rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
              <span class="soft-badge ${isMintAccent ? 'soft-badge-mint' : 'soft-badge-indigo'}">
                ${s.especialidad_nombre || 'Especialista Clínico'}
              </span>
              <span style="font-size: 0.77rem; font-weight: 600; color: var(--soft-text-muted);">
                ${s.ambiente_codigo || 'Consultorio General'}
              </span>
            </div>

            <!-- Ficha de Estado -->
            <div style="background: var(--soft-lavender-surface); border-radius: 14px; padding: 0.8rem 0.95rem; border: 1px solid var(--soft-border-card-inner); margin-bottom: 0.95rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                <span style="font-size: 0.79rem; color: var(--soft-text-body);">Estado:</span>
                ${badgeMarkup}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.79rem;">
                <span style="color: var(--soft-text-body);">Número:</span>
                <strong style="color: var(--soft-text-title); font-weight: 700;">
                  ${s.telefono_vinculado || s.terapeuta_telefono_oficial || 'Sin asignar'}
                </strong>
              </div>
            </div>
          </div>

          <!-- Estado en Vivo del Canal del Especialista -->
          <div style="margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid var(--soft-divider);">
            ${statusFooter}
          </div>

        </div>
      `;
    }).join('');
  }

  attachCardListeners(container) {
    container.querySelectorAll('.btn-open-qr').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tid = e.currentTarget.getAttribute('data-id');
        this.openQrModal(tid);
      });
    });

    container.querySelectorAll('.btn-test-session').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tid = e.currentTarget.getAttribute('data-id');
        this.openTestModal(tid);
      });
    });

    container.querySelectorAll('.btn-disconnect-session').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tid = e.currentTarget.getAttribute('data-id');
        this.openDisconnectModal(tid);
      });
    });
  }

  attachEvents() {
    const refreshBtn = document.getElementById('btn-refresh-sessions');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await this.loadSessions({ silent: false });
        Toast.info('Estados de mensajería actualizados.');
      });
    }

    // Modal QR
    const closeQrBtn = document.getElementById('btn-close-qr-modal');
    const cancelQrBtn = document.getElementById('btn-cancel-qr-modal');
    const checkQrBtn = document.getElementById('btn-check-qr-status');

    if (closeQrBtn) closeQrBtn.addEventListener('click', () => this.closeQrModal());
    if (cancelQrBtn) cancelQrBtn.addEventListener('click', () => this.closeQrModal());
    if (checkQrBtn) {
      checkQrBtn.addEventListener('click', async () => {
        if (this.activeQrTherapistId) {
          await this.checkQrStatus(this.activeQrTherapistId);
        }
      });
    }

    // Modal Test
    const closeTestBtn = document.getElementById('btn-close-test-modal');
    const cancelTestBtn = document.getElementById('btn-cancel-test-modal');
    const testForm = document.getElementById('form-test-message');

    if (closeTestBtn) closeTestBtn.addEventListener('click', () => this.closeTestModal());
    if (cancelTestBtn) cancelTestBtn.addEventListener('click', () => this.closeTestModal());
    if (testForm) {
      testForm.addEventListener('submit', (e) => this.handleTestSubmit(e));
    }

    // Modal Desconexión Soft UI
    const closeDisconnectBtn = document.getElementById('btn-close-disconnect-modal');
    const cancelDisconnectBtn = document.getElementById('btn-cancel-disconnect-modal');
    const confirmDisconnectBtn = document.getElementById('btn-confirm-disconnect-action');

    if (closeDisconnectBtn) closeDisconnectBtn.addEventListener('click', () => this.closeDisconnectModal());
    if (cancelDisconnectBtn) cancelDisconnectBtn.addEventListener('click', () => this.closeDisconnectModal());
    if (confirmDisconnectBtn) {
      confirmDisconnectBtn.addEventListener('click', () => this.confirmDisconnect());
    }

    // Modal Recordatorio de Cita (Sprint 9)
    const closeRemBtn = document.getElementById('btn-close-rem-modal');
    const cancelRemBtn = document.getElementById('btn-cancel-rem-modal');
    const remForm = document.getElementById('form-appointment-reminder');
    const resetRemMsgBtn = document.getElementById('btn-reset-rem-modal-msg');

    if (closeRemBtn) closeRemBtn.addEventListener('click', () => this.closeAppointmentReminderModal());
    if (cancelRemBtn) cancelRemBtn.addEventListener('click', () => this.closeAppointmentReminderModal());
    if (remForm) {
      remForm.addEventListener('submit', (e) => this.handleAppointmentReminderSubmit(e));
    }
    if (resetRemMsgBtn) {
      resetRemMsgBtn.addEventListener('click', () => this.resetAppointmentReminderTemplate());
    }

    // Botón para despachar notificación Web Push PWA inmediata al tutor
    const sendPwaNowBtn = document.getElementById('btn-rem-send-pwa-now');
    if (sendPwaNowBtn) {
      sendPwaNowBtn.addEventListener('click', async () => {
        const citaId = document.getElementById('rem-cita-id')?.value;
        const message = document.getElementById('rem-message-text')?.value.trim();
        if (!citaId) return;

        const originalHtml = sendPwaNowBtn.innerHTML;
        try {
          sendPwaNowBtn.disabled = true;
          sendPwaNowBtn.innerHTML = `
            <span class="soft-spinner soft-spinner-sm" style="margin-right: 0.35rem;"></span>
            <span>Enviando PWA...</span>
          `;
          const res = await apiClient.post(`/appointments/${citaId}/notify-pwa`, { mensaje: message });
          Toast.success(res.message || 'Alerta Web Push PWA enviada al tutor.');
          this.closeAppointmentReminderModal();
          await this.loadAppointments();
        } catch (err) {
          Toast.error(err.message || 'Error al despachar notificación PWA.');
        } finally {
          sendPwaNowBtn.disabled = false;
          sendPwaNowBtn.innerHTML = originalHtml;
        }
      });
    }

    // Escuchar eventos en caliente de cambio de estado de citas
    if (!this._onAppointmentStatusChanged) {
      this._onAppointmentStatusChanged = () => this.loadAppointments();
      window.addEventListener('appointment-status-changed', this._onAppointmentStatusChanged);
    }

    // Navegación Diaria y Buscador de la Agenda de Mensajería
    const dateInput = document.getElementById('input-wa-agenda-date');
    const prevDayBtn = document.getElementById('btn-wa-prev-day');
    const nextDayBtn = document.getElementById('btn-wa-next-day');
    const todayBtn = document.getElementById('btn-wa-today');
    const reloadAptsBtn = document.getElementById('btn-wa-reload-appointments');

    const handleDateChange = (newDateStr) => {
      this.selectedDay = newDateStr;
      if (dateInput) dateInput.value = this.selectedDay;
      const newMonth = this.selectedDay.slice(0, 7);
      if (newMonth !== this.selectedMonth) {
        this.selectedMonth = newMonth;
        this.loadAppointments();
      } else {
        this.renderAppointmentsSection();
      }
    };

    if (dateInput) {
      dateInput.addEventListener('change', (e) => handleDateChange(e.target.value));
    }

    if (prevDayBtn) {
      prevDayBtn.addEventListener('click', () => {
        const cur = new Date(`${this.selectedDay}T00:00:00`);
        cur.setDate(cur.getDate() - 1);
        const pad = (n) => String(n).padStart(2, '0');
        handleDateChange(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
      });
    }

    if (nextDayBtn) {
      nextDayBtn.addEventListener('click', () => {
        const cur = new Date(`${this.selectedDay}T00:00:00`);
        cur.setDate(cur.getDate() + 1);
        const pad = (n) => String(n).padStart(2, '0');
        handleDateChange(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        handleDateChange(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      });
    }

    if (reloadAptsBtn) {
      reloadAptsBtn.addEventListener('click', () => this.loadAppointments());
    }

    const searchInput = document.getElementById('input-wa-agenda-search');
    if (searchInput) {
      let searchTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          this.appointmentSearch = e.target.value.trim().toLowerCase();
          this.renderAppointmentsSection();
        }, 250);
      });
    }
  }

  async openQrModal(therapistId) {
    this.activeQrTherapistId = therapistId;
    const session = this.sessions.find(s => s.terapeuta_id == therapistId) || {
      nombres: this.user.nombre_completo || 'Usuario',
      apellidos: '',
      registro_profesional: this.user.rol
    };

    const titleEl = document.getElementById('qr-modal-title');
    const subEl = document.getElementById('qr-modal-sub');
    const container = document.getElementById('qr-display-container');

    if (titleEl) {
      titleEl.textContent = `Vincular: ${session.nombres} ${session.apellidos}`.trim();
    }
    if (subEl) {
      subEl.textContent = `${session.registro_profesional} · Escanea el código con tu WhatsApp`;
    }

    const modal = document.getElementById('qr-modal-backdrop');
    if (modal) modal.style.display = 'flex';

    if (container) {
      container.innerHTML = `
        <div class="soft-spinner soft-spinner-lg"></div>
        <p style="margin-top: 1rem; font-size: 0.88rem; font-weight: 700; color: var(--soft-purple-primary);">Generando código QR oficial...</p>
        <p style="margin-top: 0.2rem; font-size: 0.78rem; color: var(--soft-text-muted);">Iniciando cliente y conectando con WhatsApp Web...</p>
      `;
    }

    try {
      const res = await apiClient.post(`/whatsapp/${therapistId}/init`);
      if (res.data && res.data.qrDataUrl) {
        this.renderQrCode(res.data.qrDataUrl);
      } else if (res.data && res.data.status === 'CONECTADO') {
        Toast.success('¡La sesión ya está conectada y activa!');
        this.closeQrModal();
        await this.loadSessions();
        return;
      }

      this.startQrPolling(therapistId);
    } catch (err) {
      console.error(err);
      if (container) {
        container.innerHTML = `
          <div style="color: #ef4444; font-size: 0.88rem; padding: 1.5rem;">
            No se pudo generar el código QR: ${err.message || 'Error de conexión'}
          </div>
        `;
      }
    }
  }

  renderQrCode(dataUrl) {
    const container = document.getElementById('qr-display-container');
    if (!container) return;

    if (this.currentQrDataUrl === dataUrl && container.querySelector('img')) {
      return; // Mantiene el QR visible sin parpadeos mientras apunta la cámara
    }
    this.currentQrDataUrl = dataUrl;

    container.innerHTML = `
      <div style="background: #FFFFFF; padding: 0.85rem; border-radius: 16px; border: 1px solid var(--soft-border-card-inner); display: inline-block; box-shadow: 0 4px 20px rgba(39, 52, 95, 0.08);">
        <img src="${dataUrl}" alt="Código QR WhatsApp Oficial" style="max-width: 240px; width: 100%; height: auto; display: block; border-radius: 8px;" />
      </div>
      <div style="margin-top: 0.95rem; font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.45;">
        <span style="display: block; font-weight: 800; color: var(--soft-purple-primary); margin-bottom: 0.25rem;">
          Código Oficial de Vinculación WhatsApp
        </span>
        Apunta tu cámara desde <strong>WhatsApp &gt; Dispositivos vinculados &gt; Vincular un dispositivo</strong>.
      </div>
    `;
  }

  startQrPolling(therapistId) {
    this.stopQrPolling();
    this.qrPollingInterval = setInterval(async () => {
      await this.checkQrStatus(therapistId, true);
    }, 2500);
  }

  stopQrPolling() {
    if (this.qrPollingInterval) {
      clearInterval(this.qrPollingInterval);
      this.qrPollingInterval = null;
    }
  }

  async checkQrStatus(therapistId, silent = false) {
    try {
      const res = await apiClient.get(`/whatsapp/${therapistId}`);
      const data = res.data;

      if (data.estado_en_vivo === 'CONECTADO' || data.estado === 'CONECTADO') {
        this.stopQrPolling();
        Toast.success('¡Dispositivo WhatsApp vinculado exitosamente!');
        this.closeQrModal();
        await this.loadSessions();
      } else if (data.qr_data_url) {
        this.renderQrCode(data.qr_data_url);
        if (!silent) Toast.info('Código QR actualizado.');
      } else if (!silent) {
        Toast.info('Aún esperando escaneo del dispositivo móvil.');
      }
    } catch (e) {
      if (!silent) Toast.error('Error al consultar estado de la sesión.');
    }
  }

  closeQrModal() {
    this.stopQrPolling();
    this.activeQrTherapistId = null;
    this.currentQrDataUrl = null;
    const modal = document.getElementById('qr-modal-backdrop');
    if (modal) modal.style.display = 'none';
  }

  generateManualMessageText() {
    const patientSelect = document.getElementById('manual-patient-select');
    const selectedOption = patientSelect?.selectedOptions?.[0];
    const childName = selectedOption?.getAttribute('data-child') || 'su hijo/a';
    const tutorName = selectedOption?.getAttribute('data-tutor') || 'Tutor/a';
    const childFirst = childName.split(' ')[0].toUpperCase();

    const quickAptChecked = document.getElementById('manual-quick-apt-toggle')?.checked;
    const quickDate = document.getElementById('manual-quick-date')?.value;
    const quickTime = document.getElementById('manual-quick-time')?.value;

    let fechaStr = '[Fecha]';
    if (quickDate) {
      const parts = quickDate.split('-');
      if (parts.length === 3) fechaStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const horaStr = quickTime || '[Hora]';
    const terapeutaNom = this.user.nombre_completo || 'Especialista';
    const templateType = document.getElementById('manual-template-select')?.value || 'reminder';

    let msg = '';
    if (templateType === 'reminder') {
      msg = 
`*RECORDATORIO DE SESIÓN CLÍNICA - PSI APRENDE*

Estimado/a *${tutorName}*,
Le recordamos la sesión terapéutica programada para *${childName}*:

• *Fecha:* ${quickAptChecked ? fechaStr : 'Coordinada'}
• *Hora:* ${quickAptChecked ? horaStr : 'Horario programado'}
• *Especialista:* Lic. ${terapeutaNom}

Por favor responda a este mensaje con:
*1 ${childFirst}* para Confirmar asistencia
*2 ${childFirst}* para Solicitar reprogramación
(O simplemente responda *1* o *2*).

_Centro Psicopedagógico y de Atención Psicológica PSI Aprende_
_Cochabamba - Bolivia_`;
    } else if (templateType === 'reserved') {
      msg = 
`*PSI APRENDE - CONFIRMACIÓN DE ESPACIO CLÍNICO*

Estimado/a *${tutorName}*,
Le confirmamos que el espacio clínico para *${childName}* se encuentra formalmente reservado ${quickAptChecked ? `para el día *${fechaStr}* a las *${horaStr}*` : 'en su horario habitual'} con Lic. *${terapeutaNom}*.

Los esperamos puntualmente con 5 minutos de anticipación. Muchas gracias por su colaboración.
_Centro Integral Psicopedagógico PSI Aprende_`;
    } else if (templateType === 'coordination') {
      msg = 
`*PSI APRENDE - COMUNICACIÓN TERAPÉUTICA*

Estimado/a *${tutorName}*,
Le saluda cordialmente Lic. *${terapeutaNom}* del Centro PSI Aprende. Nos comunicamos en relación al proceso de atención y seguimiento de *${childName}*.

Por favor indíquenos en qué horario le es más oportuno que nos comuniquemos brevemente con usted.
_Centro Integral Psicopedagógico PSI Aprende_`;
    } else {
      msg = '';
    }

    const textInput = document.getElementById('test-message-text');
    if (textInput) {
      textInput.value = msg;
      this.updateManualMsgChars();
    }
  }

  updateManualMsgChars() {
    const textInput = document.getElementById('test-message-text');
    const charsEl = document.getElementById('manual-msg-chars');
    if (textInput && charsEl) {
      charsEl.textContent = `${textInput.value.length} caracteres`;
    }
  }

  attachManualModalEvents() {
    if (this._manualEventsAttached) return;
    this._manualEventsAttached = true;

    const patientSelect = document.getElementById('manual-patient-select');
    const phoneInput = document.getElementById('test-phone-local');
    const quickToggle = document.getElementById('manual-quick-apt-toggle');
    const quickFields = document.getElementById('manual-quick-apt-fields');
    const quickDate = document.getElementById('manual-quick-date');
    const quickTime = document.getElementById('manual-quick-time');
    const templateSelect = document.getElementById('manual-template-select');
    const textInput = document.getElementById('test-message-text');
    const btnReset = document.getElementById('btn-reset-manual-template');

    patientSelect?.addEventListener('change', () => {
      const selected = patientSelect.value;
      if (selected && phoneInput) {
        phoneInput.value = selected.slice(-8);
      }
      this.generateManualMessageText();
    });

    quickToggle?.addEventListener('change', () => {
      if (quickFields) {
        quickFields.style.display = quickToggle.checked ? 'grid' : 'none';
      }
      this.generateManualMessageText();
    });

    quickDate?.addEventListener('change', () => this.generateManualMessageText());
    quickTime?.addEventListener('change', () => this.generateManualMessageText());
    templateSelect?.addEventListener('change', () => this.generateManualMessageText());
    btnReset?.addEventListener('click', () => this.generateManualMessageText());

    textInput?.addEventListener('input', () => this.updateManualMsgChars());
  }

  async openTestModal(therapistId = null) {
    const modal = document.getElementById('test-modal-backdrop');
    const myTherapistRecord = this.sessions.find(s => s.usuario_id === this.user.id || s.terapeuta_id === this.user.id);
    const myPhone = this.user.telefono || myTherapistRecord?.terapeuta_telefono_oficial || 'Sin registrar';
    const myTherapistId = myTherapistRecord ? myTherapistRecord.terapeuta_id : (this.user.rol === 'ADMIN' ? 1 : (therapistId || 1));

    const idInput = document.getElementById('test-therapist-id');
    const nameEl = document.getElementById('test-sender-name');
    const subEl = document.getElementById('test-sender-sub');
    const countrySelect = document.getElementById('test-country-code');
    const phoneLocalInput = document.getElementById('test-phone-local');
    const patientSelect = document.getElementById('manual-patient-select');
    const quickAptToggle = document.getElementById('manual-quick-apt-toggle');
    const quickDateInput = document.getElementById('manual-quick-date');
    const quickTimeInput = document.getElementById('manual-quick-time');
    const templateSelect = document.getElementById('manual-template-select');

    if (idInput) idInput.value = myTherapistId;
    if (nameEl) nameEl.textContent = this.user.nombre_completo || 'Usuario';
    if (subEl) subEl.textContent = `${this.user.rol} · Teléfono oficial: ${myPhone}`;
    if (countrySelect) countrySelect.value = '+591';
    if (phoneLocalInput) phoneLocalInput.value = '';

    // Configurar fecha y hora sugeridas
    const todayStr = this.getBoliviaDateString();
    if (quickDateInput) quickDateInput.value = todayStr;
    if (quickTimeInput) quickTimeInput.value = '10:00';
    if (quickAptToggle) quickAptToggle.checked = true;
    const quickFields = document.getElementById('manual-quick-apt-fields');
    if (quickFields) quickFields.style.display = 'grid';

    // Cargar pacientes tutelados asignados
    if (patientSelect) {
      try {
        if (!this.myAssignedPatients || this.myAssignedPatients.length === 0) {
          const res = await apiClient.get('/patients');
          this.myAssignedPatients = res.data || [];
        }
        let optionsHtml = '<option value="">-- Ingresar Número Manualmente o Seleccionar Paciente --</option>';
        for (const p of this.myAssignedPatients) {
          const tutor = (p.tutores && p.tutores.length > 0) ? p.tutores[0] : null;
          const tutorName = tutor ? `${tutor.nombres} ${tutor.apellidos || ''}`.trim() : 'Tutor no registrado';
          const tutorPhone = tutor?.whatsapp ? tutor.whatsapp.replace(/[^\d]/g, '') : '';
          const childName = `${p.nombres} ${p.apellidos || ''}`.trim();
          optionsHtml += `<option value="${tutorPhone}" data-child="${childName}" data-tutor="${tutorName}">
            ${childName} — Tutor: ${tutorName} ${tutorPhone ? `(${tutorPhone})` : '(Sin WhatsApp)'}
          </option>`;
        }
        patientSelect.innerHTML = optionsHtml;
      } catch (err) {
        console.warn('[WhatsAppSessionsView] Error cargando pacientes:', err.message);
      }
    }

    if (templateSelect) templateSelect.value = 'reminder';
    this.attachManualModalEvents();
    this.generateManualMessageText();

    this.updateTestModalState();
    if (modal) modal.style.display = 'flex';
  }

  updateTestModalState() {
    const idInput = document.getElementById('test-therapist-id');
    const alertBox = document.getElementById('test-channel-status-alert');
    const badgeEl = document.getElementById('test-sender-badge');
    const submitBtn = document.getElementById('btn-submit-test-message');
    if (!alertBox || !submitBtn) return;

    const tid = idInput ? idInput.value : 1;
    const session = this.sessions.find(s => s.terapeuta_id == tid || s.usuario_id == this.user.id);
    const status = session ? session.estado_en_vivo : 'DESCONECTADO';

    if (badgeEl) {
      if (status === 'CONECTADO') {
        badgeEl.className = 'soft-badge soft-badge-emerald';
        badgeEl.innerHTML = `<span class="soft-status-dot"></span><span>En Línea</span>`;
      } else if (status === 'RECONECTANDO') {
        badgeEl.className = 'soft-badge-amber-pulse';
        badgeEl.innerHTML = `<span class="soft-spinner soft-spinner-sm soft-spinner-amber"></span><span>Reconectando...</span>`;
      } else {
        badgeEl.className = 'soft-badge soft-badge-rose';
        badgeEl.innerHTML = `<span class="soft-status-dot"></span><span>Desconectado</span>`;
      }
    }

    if (status === 'RECONECTANDO') {
      alertBox.style.display = 'flex';
      alertBox.innerHTML = `
        <div style="background: rgba(245, 158, 11, 0.1); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 14px; padding: 0.85rem 1rem; width: 100%; display: flex; align-items: center; gap: 0.75rem;">
          <div class="soft-spinner soft-spinner-sm soft-spinner-amber"></div>
          <div style="font-size: 0.82rem; color: #B45309; line-height: 1.45;">
            <strong>Reconectando su canal personal...</strong><br>
            El navegador headless está restaurando el enlace oficial con WhatsApp. El botón de envío se habilitará automáticamente al finalizar.
          </div>
        </div>
      `;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="soft-spinner soft-spinner-sm soft-spinner-white" style="margin-right: 0.45rem;"></span>
        <span>Reconectando...</span>
      `;
    } else if (status === 'CONECTADO') {
      alertBox.style.display = 'none';
      alertBox.innerHTML = '';
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        ${Icons.send(15, '#FFFFFF')}
        <span>Enviar Ahora</span>
      `;
    } else {
      alertBox.style.display = 'flex';
      alertBox.innerHTML = `
        <div style="background: rgba(244, 63, 94, 0.08); border: 1.5px solid rgba(244, 63, 94, 0.25); border-radius: 14px; padding: 0.85rem 1rem; width: 100%; display: flex; align-items: center; gap: 0.75rem;">
          <div class="soft-icon-box soft-icon-box-sm soft-icon-box-rose">
            ${Icons.wifiOff(16, 'var(--soft-rose)')}
          </div>
          <div style="font-size: 0.82rem; color: #BE123C; line-height: 1.45;">
            <strong>Canal Desconectado:</strong> Debe vincular su WhatsApp mediante el código QR antes de enviar mensajes de prueba.
          </div>
        </div>
      `;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span>Canal Desconectado</span>
      `;
    }
  }

  closeTestModal() {
    const modal = document.getElementById('test-modal-backdrop');
    if (modal) modal.style.display = 'none';
  }

  async handleTestSubmit(e) {
    e.preventDefault();
    const idInput = document.getElementById('test-therapist-id');
    const countrySelect = document.getElementById('test-country-code');
    const phoneLocalInput = document.getElementById('test-phone-local');
    const textInput = document.getElementById('test-message-text');
    const submitBtn = document.getElementById('btn-submit-test-message');

    const therapistId = idInput ? idInput.value : 1;
    const countryCode = countrySelect ? countrySelect.value : '+591';
    const localPhone = phoneLocalInput ? phoneLocalInput.value.replace(/[^\d]/g, '') : '';
    const message = textInput ? textInput.value.trim() : '';

    if (!localPhone || localPhone.length < 7) {
      Toast.error('Por favor ingrese un número telefónico válido (mínimo 7-8 dígitos).');
      return;
    }

    const fullPhone = `${countryCode.replace('+', '')}${localPhone}`;

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <span class="soft-spinner soft-spinner-sm soft-spinner-white" style="margin-right: 0.45rem;"></span>
          <span>Despachando...</span>
        `;
      }

      if (message) {
        await apiClient.post('/whatsapp/send', {
          therapistId,
          toPhone: fullPhone,
          message
        });
      } else {
        await apiClient.post(`/whatsapp/${therapistId}/test`, {
          phone: fullPhone
        });
      }

      Toast.success(`Mensaje manual enviado exitosamente a ${countryCode} ${localPhone}`);
      this.closeTestModal();
      await this.loadSessions();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Error al enviar el mensaje manual.');
    } finally {
      this.updateTestModalState();
    }
  }

  openDisconnectModal(therapistId) {
    this.targetDisconnectTherapistId = therapistId;
    const session = this.sessions.find(s => s.terapeuta_id == therapistId);
    const nameEl = document.getElementById('disconnect-therapist-name');
    if (nameEl) {
      nameEl.textContent = session ? `${session.nombres} ${session.apellidos}` : 'este especialista';
    }
    const modal = document.getElementById('disconnect-modal-backdrop');
    if (modal) modal.style.display = 'flex';
  }

  closeDisconnectModal() {
    this.targetDisconnectTherapistId = null;
    const modal = document.getElementById('disconnect-modal-backdrop');
    if (modal) modal.style.display = 'none';
  }

  async confirmDisconnect() {
    if (!this.targetDisconnectTherapistId) return;
    const btn = document.getElementById('btn-confirm-disconnect-action');
    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
          <span class="soft-spinner soft-spinner-sm soft-spinner-white" style="margin-right: 0.45rem;"></span>
          <span>Desvinculando...</span>
        `;
      }
      await apiClient.post(`/whatsapp/${this.targetDisconnectTherapistId}/disconnect`);
      Toast.success('Sesión de WhatsApp desvinculada exitosamente.');
      this.closeDisconnectModal();
      await this.loadSessions();
    } catch (err) {
      console.error(err);
      Toast.error('No se pudo desvincular la sesión.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          ${Icons.wifiOff(15, '#FFFFFF')}
          <span>Desvincular Canal</span>
        `;
      }
    }
  }

  // =========================================================================
  // GESTIÓN DE CITAS & NOTIFICACIONES EN WHATSAPP (SPRINT 9)
  // =========================================================================

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  formatTime(isoStr) {
    if (!isoStr) return '--:--';
    return isoStr.slice(11, 16);
  }

  formatDate(isoStr) {
    if (!isoStr) return '';
    const parts = isoStr.slice(0, 10).split('-');
    if (parts.length !== 3) return isoStr.slice(0, 10);
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  async loadAppointments() {
    const area = document.getElementById('wa-agenda-content-area');
    if (area) {
      area.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem;">
          <div class="soft-spinner soft-spinner-sm" style="margin: 0 auto 0.5rem auto;"></div>
          <p style="color: var(--soft-text-muted); font-size: 0.82rem;">Sincronizando agenda de citas del mes...</p>
        </div>
      `;
    }

    try {
      const [year, month] = this.selectedMonth.split('-').map(Number);
      const pad = (n) => String(n).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      const fechaDesde = `${year}-${pad(month)}-01`;
      const fechaHasta = `${year}-${pad(month)}-${pad(lastDay)}`;

      const res = await apiClient.get(`/appointments?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`);
      this.appointments = res.data || [];
      this.renderAppointmentsSection();
    } catch (err) {
      console.error('[WhatsAppSessionsView] Error al cargar citas:', err);
      if (area) {
        area.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--soft-text-muted); font-size: 0.82rem;">
            No se pudieron sincronizar las citas para mensajería.
          </div>
        `;
      }
    }
  }

  formatFullDayTitle(dayStr) {
    if (!dayStr) return '';
    try {
      const [y, m, d] = dayStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const formatted = dateObj.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (e) {
      return dayStr;
    }
  }

  renderAppointmentsSection() {
    const area = document.getElementById('wa-agenda-content-area');
    if (!area) return;

    const dayAppointments = (this.appointments || []).filter(a => {
      const aptDate = (a.fecha_hora_inicio || '').slice(0, 10);
      return aptDate === this.selectedDay;
    });

    let filtered = dayAppointments;
    if (this.appointmentSearch) {
      filtered = filtered.filter(a => {
        const text = `${a.paciente_nombres || ''} ${a.paciente_apellidos || ''} ${a.tutor_nombre_completo || ''} ${a.tutor_whatsapp || ''}`.toLowerCase();
        return text.includes(this.appointmentSearch);
      });
    }

    const fullDayTitle = this.formatFullDayTitle(this.selectedDay);

    if (filtered.length === 0) {
      area.innerHTML = `
        <div class="soft-card-static" style="text-align: center; padding: 2.5rem 1.5rem; background: var(--soft-lavender-surface); border-radius: 16px;">
          <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender" style="margin: 0 auto 0.65rem auto;">
            ${Icons.calendar(20, 'var(--soft-purple-primary)')}
          </div>
          <div style="font-weight: 800; font-size: 1rem; color: var(--soft-text-title); margin-bottom: 0.25rem;">
            No hay citas registradas para ${this.escapeHtml(fullDayTitle)}
          </div>
          <p style="font-size: 0.82rem; color: var(--soft-text-muted); margin: 0 0 1rem 0;">
            ${this.appointmentSearch ? 'Ninguna cita coincide con su criterio de búsqueda en esta fecha.' : 'No se encontraron sesiones agendadas para el día seleccionado.'}
          </p>
          <div style="display: flex; justify-content: center; gap: 0.5rem;">
            <button type="button" id="btn-wa-empty-today" class="soft-btn soft-btn-sm soft-btn-lvl-2">
              Ver Citas de Hoy
            </button>
          </div>
        </div>
      `;
      document.getElementById('btn-wa-empty-today')?.addEventListener('click', () => {
        const today = this.getBoliviaDateString();
        this.selectedDay = today;
        const dateInput = document.getElementById('input-wa-agenda-date');
        if (dateInput) dateInput.value = today;
        const newMonth = today.slice(0, 7);
        if (newMonth !== this.selectedMonth) {
          this.selectedMonth = newMonth;
          this.loadAppointments();
        } else {
          this.renderAppointmentsSection();
        }
      });
      return;
    }

    const now = new Date();
    const upcoming = [];
    const past = [];

    filtered.forEach(apt => {
      const endStr = apt.fecha_hora_fin ? apt.fecha_hora_fin.replace(' ', 'T') : '';
      const end = new Date(endStr);
      const isConcluded = apt.estado === 'ATENDIDA' || apt.estado === 'AUSENTE' || apt.estado === 'CANCELADA';
      if (isConcluded || (endStr && end < now)) {
        past.push(apt);
      } else {
        upcoming.push(apt);
      }
    });

    // Próximas: orden secuencial cronológico (la más próxima a la hora actual de primero a la izquierda)
    upcoming.sort((a, b) => new Date(a.fecha_hora_inicio.replace(' ', 'T')) - new Date(b.fecha_hora_inicio.replace(' ', 'T')));

    // Cumplidas: orden secuencial cronológico (las más recientes primero a la izquierda)
    past.sort((a, b) => new Date(b.fecha_hora_inicio.replace(' ', 'T')) - new Date(a.fecha_hora_inicio.replace(' ', 'T')));

    area.innerHTML = `
      <!-- SUBTÍTULO DEL DÍA SELECCIONADO -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.15rem; flex-wrap: wrap; gap: 0.5rem; background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.65rem 1rem;">
        <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.calendar(16)}</span>
          <span>${this.escapeHtml(fullDayTitle)}</span>
        </div>
        <div style="display: flex; gap: 0.6rem; align-items: center;">
          <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem;">
            Total del Día: ${filtered.length}
          </span>
          <span class="soft-badge soft-badge-emerald" style="font-size: 0.72rem;">
            ${upcoming.length} Por Llegar
          </span>
          <span class="soft-badge soft-badge-slate" style="font-size: 0.72rem;">
            ${past.length} Cumplidas
          </span>
        </div>
      </div>

      <!-- FRANJA SUPERIOR: CITAS DEL DÍA POR LLEGAR (PRÓXIMAS) -->
      <div style="margin-bottom: 2rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.clock(16, 'var(--soft-purple-primary)')}
            </div>
            <div>
              <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: var(--soft-text-title);">
                Citas del Día por Llegar (Próximas)
              </h4>
              <div style="font-size: 0.74rem; color: var(--soft-text-muted);">
                Orden secuencial: la cita más próxima a atender a la izquierda con borde brillante
              </div>
            </div>
          </div>
          <span class="soft-badge ${upcoming.length > 0 ? 'soft-badge-emerald' : 'soft-badge-lavender'}" style="font-weight: 800; font-size: 0.73rem;">
            ${upcoming.length} pendientes
          </span>
        </div>

        ${upcoming.length > 0 ? `
          <div class="wa-horizontal-scroll-row">
            ${upcoming.map((apt, idx) => this.renderAppointmentCard(apt, { isNext: idx === 0, isUpcoming: true })).join('')}
          </div>
        ` : `
          <div class="soft-card-static" style="padding: 1.5rem; text-align: center; background: var(--soft-lavender-surface); border-radius: 14px; border: 1px solid var(--soft-border-card-inner);">
            <p style="margin: 0; font-size: 0.82rem; color: var(--soft-text-muted);">
              No hay citas pendientes por llegar para este día (todas concluidas o no programadas).
            </p>
          </div>
        `}
      </div>

      <!-- FRANJA INFERIOR: CITAS DEL DÍA YA CUMPLIDAS (HISTORIAL) -->
      <div style="border-top: 1px dashed var(--soft-divider); padding-top: 1.5rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div class="soft-icon-box soft-icon-box-sm" style="background: rgba(148, 163, 184, 0.15); color: #475569;">
              ${Icons.checkCircle(16, '#475569')}
            </div>
            <div>
              <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: var(--soft-text-title);">
                Citas del Día ya Cumplidas (Historial)
              </h4>
              <div style="font-size: 0.74rem; color: var(--soft-text-muted);">
                Sesiones que ya se atendieron o cuya hora programada ya concluyó
              </div>
            </div>
          </div>
          <span class="soft-badge soft-badge-slate" style="font-weight: 800; font-size: 0.73rem;">
            ${past.length} concluidas
          </span>
        </div>

        ${past.length > 0 ? `
          <div class="wa-horizontal-scroll-row">
            ${past.map(apt => this.renderAppointmentCard(apt, { isNext: false, isUpcoming: false })).join('')}
          </div>
        ` : `
          <div class="soft-card-static" style="padding: 1.5rem; text-align: center; background: var(--soft-lavender-surface); border-radius: 14px; border: 1px solid var(--soft-border-card-inner);">
            <p style="margin: 0; font-size: 0.82rem; color: var(--soft-text-muted);">
              Aún no se registran citas concluidas en este día.
            </p>
          </div>
        `}
      </div>
    `;

    // Vincular clicks a los botones de recordatorio
    area.querySelectorAll('.btn-open-appointment-reminder').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const citaId = e.currentTarget.getAttribute('data-cita-id');
        this.openAppointmentReminderModal(citaId);
      });
    });

    // Vincular clicks a reprogramación de cita acordada
    area.querySelectorAll('.btn-wa-reschedule-cita').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const citaId = e.currentTarget.getAttribute('data-cita-id');
        this.openRescheduleModal(citaId);
      });
    });
  }

  renderAppointmentCard(apt, { isNext, isUpcoming }) {
    const horaInicio = this.formatTime(apt.fecha_hora_inicio);
    const horaFin = this.formatTime(apt.fecha_hora_fin);
    const tutorPhone = apt.tutor_whatsapp || 'Sin WhatsApp';
    const hasPhone = Boolean(apt.tutor_whatsapp);

    let statusBadge = `<span class="soft-badge soft-badge-lavender">Programada</span>`;
    if (apt.estado === 'CONFIRMADA') {
      statusBadge = `<span class="soft-badge soft-badge-emerald">Confirmada</span>`;
    } else if (apt.estado === 'REPROGRAMADA') {
      statusBadge = `<span class="soft-badge soft-badge-amber">Reprogramación</span>`;
    } else if (apt.estado === 'CANCELADA') {
      statusBadge = `<span class="soft-badge soft-badge-rose">Cancelada</span>`;
    } else if (apt.estado === 'ATENDIDA') {
      statusBadge = `<span class="soft-badge soft-badge-slate">Atendida</span>`;
    } else if (apt.estado === 'AUSENTE') {
      statusBadge = `<span class="soft-badge soft-badge-rose">Ausente</span>`;
    }

    const cardClass = isNext 
      ? 'soft-card-static wa-appointment-card soft-next-appointment-glowing' 
      : 'soft-card-static wa-appointment-card';

    return `
      <div class="${cardClass}" style="display: flex; flex-direction: column; justify-content: space-between; padding: 1.15rem; border-radius: 16px; border: 1px solid var(--soft-border-card-inner); background: #FFFFFF; box-shadow: var(--soft-shadow-subcard);">
        <div>
          <!-- Cabecera de la tarjeta con hora y estado -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.4rem;">
            ${isNext ? `
              <span class="soft-badge" style="background: var(--soft-purple-primary); color: #FFFFFF; font-weight: 800; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.6rem; border-radius: 999px;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: #4ADE80; display: inline-block;"></span>
                SIGUIENTE SESIÓN
              </span>
            ` : `
              <span class="soft-badge soft-badge-indigo" style="font-size: 0.72rem; font-weight: 700;">
                ${horaInicio} - ${horaFin}
              </span>
            `}
            ${statusBadge}
          </div>

          ${isNext ? `
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--soft-purple-primary); margin-bottom: 0.45rem;">
              Horario: ${horaInicio} - ${horaFin}
            </div>
          ` : ''}

          <!-- Paciente y Consultorio -->
          <div style="margin-bottom: 0.65rem;">
            <div style="font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-text-overline); font-weight: 700;">Paciente:</div>
            <strong style="color: var(--soft-text-title); font-size: 1.02rem; font-weight: 800; display: block; line-height: 1.25;">
              ${this.escapeHtml(apt.paciente_nombre_completo || `${apt.paciente_nombres} ${apt.paciente_apellidos}`)}
            </strong>
            <div style="font-size: 0.76rem; color: var(--soft-text-muted); margin-top: 0.2rem;">
              Exp: <strong>${this.escapeHtml(apt.paciente_codigo || 'EXP')}</strong> · ${this.escapeHtml(apt.ambiente_nombre?.split(' - ')[0] || apt.ambiente_codigo)}
            </div>
          </div>

          <!-- Especialista y Tutor -->
          <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 0.85rem; font-size: 0.78rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
              <span style="color: var(--soft-text-muted);">Terapeuta:</span>
              <strong style="color: var(--soft-text-title); text-align: right;">Lic. ${this.escapeHtml(apt.terapeuta_nombres || apt.terapeuta_nombre_completo || 'Asignado')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
              <span style="color: var(--soft-text-muted);">Tutor:</span>
              <strong style="color: var(--soft-text-title); text-align: right;">${this.escapeHtml(apt.tutor_nombre_completo || 'Familiar')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--soft-text-muted);">WhatsApp:</span>
              <strong style="color: ${hasPhone ? 'var(--soft-purple-primary)' : 'var(--soft-rose)'};">${this.escapeHtml(tutorPhone)}</strong>
            </div>
          </div>
        </div>

        <!-- Botón de Acción -->
        <div style="border-top: 1px solid var(--soft-divider); padding-top: 0.8rem;">
          ${apt.estado === 'REPROGRAMADA' ? `
            <div style="display: flex; gap: 0.45rem;">
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2 btn-wa-reschedule-cita" data-cita-id="${apt.id}" style="flex: 1; justify-content: center; background: #d97706; border-color: #b45309; color: #FFFFFF;" title="Actualizar fecha y hora acordada con el tutor">
                ${Icons.calendar(14, '#FFFFFF')}
                <span>Reprogramar Horario</span>
              </button>
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-open-appointment-reminder" data-cita-id="${apt.id}" title="Coordinar o enviar mensaje por WhatsApp">
                ${Icons.whatsapp(14, 'var(--soft-purple-primary)')}
              </button>
            </div>
          ` : apt.estado === 'CONFIRMADA' ? `
            <div style="display: flex; gap: 0.45rem; width: 100%;">
              <button type="button" class="soft-btn soft-btn-sm soft-btn-confirmed" style="flex: 1; justify-content: center;" title="Asistencia confirmada por el tutor">
                ${Icons.check(14, '#FFFFFF')}
                <span>Confirmada</span>
              </button>
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-open-appointment-reminder" data-cita-id="${apt.id}" title="Enviar mensaje adicional por WhatsApp">
                ${Icons.whatsapp(14, 'var(--soft-purple-primary)')}
              </button>
            </div>
          ` : `
            <button type="button" class="soft-btn soft-btn-sm ${isUpcoming ? 'soft-btn-lvl-2' : 'soft-btn-lvl-2-soft'} btn-open-appointment-reminder" data-cita-id="${apt.id}" style="width: 100%; justify-content: center;" ${apt.estado === 'CANCELADA' ? 'disabled' : ''}>
              ${Icons.whatsapp(14, isUpcoming ? '#FFFFFF' : 'var(--soft-purple-primary)')}
              <span>${isUpcoming ? 'Enviar / Programar Recordatorio' : 'Consultar Recordatorio'}</span>
            </button>
          `}
        </div>
      </div>
    `;
  }

  openAppointmentReminderModal(citaId) {
    const apt = this.appointments.find(a => a.id == citaId);
    if (!apt) return;
    this.selectedCitaForModal = apt;

    const modal = document.getElementById('appointment-reminder-modal-backdrop');
    const citaIdInput = document.getElementById('rem-cita-id');
    const summaryEl = document.getElementById('rem-cita-summary');
    const senderNameEl = document.getElementById('rem-sender-name');
    const countrySelect = document.getElementById('rem-country-code');
    const phoneInput = document.getElementById('rem-phone-local');
    const timingSelect = document.getElementById('rem-timing-select');
    const messageInput = document.getElementById('rem-message-text');

    if (citaIdInput) citaIdInput.value = apt.id;
    if (senderNameEl) senderNameEl.textContent = this.user?.nombre_completo || apt.terapeuta_nombre_completo || 'Especialista Asignado';

    const hora = this.formatTime(apt.fecha_hora_inicio);
    const fecha = this.formatDate(apt.fecha_hora_inicio);
    const pacienteNombre = (apt.paciente_nombre_completo || `${apt.paciente_nombres} ${apt.paciente_apellidos}`).trim();
    const tutorNombre = (apt.tutor_nombre_completo || 'Estimado/a Tutor/a').trim();
    const consultorio = apt.ambiente_nombre?.split(' - ')[0] || apt.ambiente_codigo || 'Consultorio';
    const terapeuta = apt.terapeuta_nombre_completo || 'Especialista';

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <strong style="color: var(--soft-text-title); font-size: 0.95rem;">${this.escapeHtml(pacienteNombre)}</strong>
          <span class="soft-badge soft-badge-indigo" style="font-size: 0.7rem;">${fecha} a las ${hora}</span>
        </div>
        <div style="color: var(--soft-text-body); font-size: 0.77rem;">
          Tutor: <strong>${this.escapeHtml(tutorNombre)}</strong> · Consultorio: <strong>${this.escapeHtml(consultorio)}</strong>
        </div>
      `;
    }

    // Procesar teléfono del tutor
    const rawPhone = (apt.tutor_whatsapp || '').trim();
    if (countrySelect && phoneInput) {
      if (rawPhone.startsWith('+591')) {
        countrySelect.value = '+591';
        phoneInput.value = rawPhone.slice(4).trim();
      } else if (rawPhone.startsWith('591')) {
        countrySelect.value = '+591';
        phoneInput.value = rawPhone.slice(3).trim();
      } else {
        countrySelect.value = '+591';
        phoneInput.value = rawPhone.replace(/[^\d]/g, '');
      }
    }

    if (timingSelect) timingSelect.value = '30';

    // Prefill con la plantilla oficial clínica con nombres reales y desambiguación
    if (messageInput) {
      messageInput.value = 
`*RECORDATORIO DE SESIÓN CLÍNICA - PSI APRENDE*

Estimado/a *${tutorNombre}*,
Le recordamos la sesión terapéutica programada para *${pacienteNombre}*:

• *Fecha:* ${fecha}
• *Hora:* ${hora}
• *Consultorio:* ${consultorio}
• *Especialista:* Lic. ${terapeuta}

Por favor responda a este mensaje con:
*1 ${apt.paciente_nombres.toUpperCase()}* para Confirmar asistencia
*2 ${apt.paciente_nombres.toUpperCase()}* para Solicitar reprogramación
(O simplemente responda *1* o *2*).

_Centro Psicopedagógico y de Atención Psicológica PSI Aprende_
_Cochabamba - Bolivia_`;
    }

    if (modal) modal.style.display = 'flex';
  }

  closeAppointmentReminderModal() {
    this.selectedCitaForModal = null;
    const modal = document.getElementById('appointment-reminder-modal-backdrop');
    if (modal) modal.style.display = 'none';
  }

  resetAppointmentReminderTemplate() {
    if (!this.selectedCitaForModal) return;
    const apt = this.selectedCitaForModal;
    const messageInput = document.getElementById('rem-message-text');
    if (!messageInput) return;

    const hora = this.formatTime(apt.fecha_hora_inicio);
    const fecha = this.formatDate(apt.fecha_hora_inicio);
    const pacienteNombre = (apt.paciente_nombre_completo || `${apt.paciente_nombres} ${apt.paciente_apellidos}`).trim();
    const tutorNombre = (apt.tutor_nombre_completo || 'Estimado/a Tutor/a').trim();
    const consultorio = apt.ambiente_nombre?.split(' - ')[0] || apt.ambiente_codigo || 'Consultorio';
    const terapeuta = apt.terapeuta_nombre_completo || 'Especialista';

    messageInput.value = 
`*RECORDATORIO DE SESIÓN CLÍNICA - PSI APRENDE*

Estimado/a *${tutorNombre}*,
Le recordamos la sesión terapéutica programada para *${pacienteNombre}*:

• *Fecha:* ${fecha}
• *Hora:* ${hora}
• *Consultorio:* ${consultorio}
• *Especialista:* Lic. ${terapeuta}

Por favor responda a este mensaje con:
*1 ${apt.paciente_nombres.toUpperCase()}* para Confirmar asistencia
*2 ${apt.paciente_nombres.toUpperCase()}* para Solicitar reprogramación
(O simplemente responda *1* o *2*).

_Centro Psicopedagógico y de Atención Psicológica PSI Aprende_
_Cochabamba - Bolivia_`;
  }

  async handleAppointmentReminderSubmit(e) {
    e.preventDefault();
    const citaId = document.getElementById('rem-cita-id')?.value;
    const countryCode = document.getElementById('rem-country-code')?.value || '+591';
    const localPhone = document.getElementById('rem-phone-local')?.value.replace(/[^\d]/g, '');
    const timing = document.getElementById('rem-timing-select')?.value || '30';
    const message = document.getElementById('rem-message-text')?.value.trim();
    const submitBtn = document.getElementById('btn-submit-rem-modal');

    if (!localPhone || localPhone.length < 7) {
      Toast.warning('Por favor ingrese un número de WhatsApp válido para el tutor.');
      return;
    }
    if (!message) {
      Toast.warning('El mensaje de recordatorio no puede estar vacío.');
      return;
    }

    const fullPhone = `${countryCode}${localPhone}`;

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <span class="soft-spinner soft-spinner-sm soft-spinner-white" style="margin-right: 0.45rem;"></span>
          <span>Procesando...</span>
        `;
      }

      if (timing === 'NOW') {
        await apiClient.post(`/whatsapp/appointments/${citaId}/dispatch-now`, {
          message,
          customPhone: fullPhone
        });
        Toast.success('Mensaje despachado de inmediato por WhatsApp.');
      } else {
        await apiClient.post(`/whatsapp/appointments/${citaId}/schedule-reminder`, {
          anticipacionMinutos: parseInt(timing, 10),
          canal: 'WHATSAPP_Y_PUSH',
          mensajePersonalizado: message
        });
        Toast.success(`Recordatorio programado a ${timing} minutos antes de la sesión.`);
      }

      this.closeAppointmentReminderModal();
      await this.loadAppointments();
    } catch (err) {
      console.error(err);
      Toast.error(err.message || 'Error al procesar el recordatorio.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          ${Icons.send(15, '#FFFFFF')}
          <span id="rem-submit-btn-text">Confirmar Acción</span>
        `;
      }
    }
  }

  async openRescheduleModal(citaId) {
    const apt = this.appointments.find(a => a.id == citaId);
    if (!apt) return;

    if (!this.rooms || this.rooms.length === 0) {
      try {
        const roomsRes = await apiClient.get('/rooms');
        this.rooms = roomsRes.data || [];
      } catch (e) {
        this.rooms = [];
      }
    }

    const modalId = 'modal-wa-reschedule-appointment';
    document.getElementById(modalId)?.remove();

    const curFecha = (apt.fecha_hora_inicio || '').slice(0, 10) || this.getBoliviaDateString();
    const curHora = (apt.fecha_hora_inicio || '').slice(11, 16) || '10:00';
    const pacienteNom = apt.paciente_nombre_completo || `${apt.paciente_nombres} ${apt.paciente_apellidos}`;

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal-backdrop';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(39, 52, 95, 0.55); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1200; padding: 1rem;';
    modal.innerHTML = `
      <div class="soft-modal-card" style="max-width: 520px; width: 100%; max-height: 90vh;">
        <div style="background: var(--soft-lavender-surface); padding: 1.2rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.calendar(20, 'var(--soft-purple-primary)')}
            </div>
            <div>
              <h3 style="margin: 0; color: var(--soft-text-title); font-size: 1.12rem; font-weight: 800;">Reprogramar Cita Terapéutica</h3>
              <div style="font-size: 0.76rem; color: var(--soft-text-body); margin-top: 0.15rem;">Cita #${apt.id} · Paciente: <strong>${this.escapeHtml(pacienteNom)}</strong></div>
            </div>
          </div>
          <button id="btn-close-wa-reschedule" type="button" class="soft-modal-close-btn" aria-label="Cerrar">${Icons.close(18)}</button>
        </div>

        <form id="form-wa-reschedule" style="padding: 1.35rem 1.5rem;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 1rem;">
            <div class="form-group">
              <label class="soft-label" style="font-size: 0.78rem; font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.35rem; display: block;">
                Nueva Fecha <span style="color: #ef4444;">*</span>
              </label>
              <input type="date" id="wa-reschedule-date" class="soft-input" value="${curFecha}" required style="font-size: 0.88rem;" />
            </div>

            <div class="form-group">
              <label class="soft-label" style="font-size: 0.78rem; font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.35rem; display: block;">
                Nueva Hora <span style="color: #ef4444;">*</span>
              </label>
              <input type="time" id="wa-reschedule-time" class="soft-input" value="${curHora}" required style="font-size: 0.88rem;" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="soft-label" style="font-size: 0.78rem; font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.35rem; display: block;">
              Consultorio / Sala <span style="color: #ef4444;">*</span>
            </label>
            <select id="wa-reschedule-room" class="soft-select" required style="font-size: 0.88rem;">
              ${(this.rooms || []).map(r => `
                <option value="${r.id}" ${r.id == apt.ambiente_id ? 'selected' : ''}>
                  ${this.escapeHtml(r.nombre?.split(' - ')[0] || r.codigo)} · ${this.escapeHtml(r.tipo || 'General')}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label class="soft-label" style="font-size: 0.78rem; font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.35rem; display: block;">
              Notas de Reprogramación · Acuerdo con Tutor
            </label>
            <textarea id="wa-reschedule-notes" class="soft-textarea" rows="2" placeholder="Ej: Se acordó nuevo horario por solicitud del tutor vía WhatsApp..." style="font-size: 0.84rem;"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.65rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
            <button type="button" id="btn-cancel-wa-reschedule" class="soft-btn soft-btn-lvl-1-muted">Cancelar</button>
            <button type="submit" id="btn-submit-wa-reschedule" class="soft-btn soft-btn-lvl-2" style="background: #d97706; border-color: #b45309; color: #FFFFFF;">
              ${Icons.calendar(15, '#FFFFFF')}
              <span>Guardar Nueva Fecha &amp; Hora</span>
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#btn-close-wa-reschedule')?.addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-wa-reschedule')?.addEventListener('click', closeModal);

    modal.querySelector('#form-wa-reschedule')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = modal.querySelector('#btn-submit-wa-reschedule');
      const newDate = modal.querySelector('#wa-reschedule-date')?.value;
      const newTime = modal.querySelector('#wa-reschedule-time')?.value;
      const newRoom = modal.querySelector('#wa-reschedule-room')?.value;
      const notes = modal.querySelector('#wa-reschedule-notes')?.value?.trim();

      if (!newDate || !newTime || !newRoom) {
        Toast.warning('Por favor complete la fecha, hora y consultorio.');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="soft-spinner soft-spinner-sm soft-spinner-white" style="margin-right: 0.35rem;"></span> <span>Guardando...</span>`;

        await apiClient.put(`/appointments/${apt.id}`, {
          fecha_hora_inicio: `${newDate} ${newTime}:00`,
          ambiente_id: parseInt(newRoom, 10),
          estado: 'PROGRAMADA',
          notas_internas: notes || apt.notas_internas
        });

        Toast.success(`¡Cita reprogramada exitosamente para el ${newDate} a las ${newTime}!`);
        closeModal();

        this.selectedDay = newDate;
        const dateInput = document.getElementById('input-wa-agenda-date');
        if (dateInput) dateInput.value = newDate;

        window.dispatchEvent(new CustomEvent('appointment-status-changed', {
          detail: { citaId: apt.id, estado: 'PROGRAMADA' }
        }));

        await this.loadAppointments();
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${Icons.calendar(15, '#FFFFFF')} <span>Guardar Nueva Fecha &amp; Hora</span>`;
        Toast.error(err.message || 'Error al reprogramar la cita.');
      }
    });
  }

  unmount() {
    this.stopQrPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this._onAppointmentStatusChanged) {
      window.removeEventListener('appointment-status-changed', this._onAppointmentStatusChanged);
      this._onAppointmentStatusChanged = null;
    }
  }
}
