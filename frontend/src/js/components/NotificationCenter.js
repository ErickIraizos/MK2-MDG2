import { apiClient } from '../api/apiClient.js';
import { PushClient } from '../api/pushClient.js';
import { Icons } from './Icons.js';
import { Toast } from './Toast.js';
import { store } from '../store.js';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize.js';

export class NotificationCenter {
  static unreadCount = 0;
  static isOpen = false;
  static isSubscribedPush = false;
  static pollTimer = null;
  static eventSource = null;
  static sseConnected = false;
  static _docClickHandler = null;
  static _winFocusHandler = null;
  static _visChangeHandler = null;
  static _swMessageHandler = null;

  static renderButton() {
    return `
      <div class="notification-center-wrapper" style="position: relative;">
        <button id="btn-toggle-notif-center" type="button" class="btn-notif-bell" 
          title="Centro de Alertas & Notificaciones" aria-label="Notificaciones" aria-haspopup="true">
          ${Icons.bell(20, 'var(--soft-purple-primary, #584294)')}
          <span id="notif-badge-counter" class="soft-notif-counter" style="display: none;">0</span>
        </button>

        <div id="notification-center-dropdown" class="soft-notification-dropdown" style="display: none;">
          <div style="padding: 2rem; text-align: center; color: var(--soft-text-muted);">
            <div class="soft-spinner soft-spinner-sm" style="margin: 0 auto 0.5rem auto;"></div>
            <span>Cargando notificaciones...</span>
          </div>
        </div>
      </div>
    `;
  }

  static init() {
    this.cleanup();

    const btn = document.getElementById('btn-toggle-notif-center');
    const dropdown = document.getElementById('notification-center-dropdown');

    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle();
      });
    }

    // Cerrar al hacer clic fuera (referencia única sin acumular listeners)
    this._docClickHandler = (e) => {
      if (this.isOpen && dropdown && !dropdown.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
        this.close();
      }
    };
    document.addEventListener('click', this._docClickHandler);

    // Conectar canal SSE en tiempo real para notificaciones (elimina el polling continuo de 6s)
    this.connectSse();

    // Escuchar notificaciones push nativas emitidas por el Service Worker
    if ('serviceWorker' in navigator) {
      this._swMessageHandler = (event) => {
        if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
          this.refreshUnreadCount();
          window.dispatchEvent(new CustomEvent('appointment-status-changed'));
        }
      };
      navigator.serviceWorker.addEventListener('message', this._swMessageHandler);
    }

    // Respaldo de sincronización al volver el foco si SSE no está conectado
    this._winFocusHandler = () => {
      if (store.isAuthenticated() && !this.sseConnected) {
        this.refreshUnreadCount();
      }
    };
    window.addEventListener('focus', this._winFocusHandler);

    this._visChangeHandler = () => {
      if (!document.hidden && store.isAuthenticated() && !this.sseConnected) {
        this.connectSse();
        this.refreshUnreadCount();
      }
    };
    document.addEventListener('visibilitychange', this._visChangeHandler);
  }

  static connectSse() {
    if (!store.isAuthenticated()) return;
    const token = store.getState().token;
    if (!token || typeof EventSource === 'undefined') {
      this.startFallbackPolling();
      return;
    }

    if (this.eventSource) {
      try { this.eventSource.close(); } catch {}
      this.eventSource = null;
    }

    const baseUrl = apiClient.baseUrl || '/api';
    const streamUrl = `${baseUrl}/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(streamUrl);
    this.eventSource = es;

    es.addEventListener('connected', (event) => {
      this.sseConnected = true;
      this.stopFallbackPolling();
      try {
        const data = JSON.parse(event.data || '{}');
        if (typeof data.unreadCount === 'number') {
          this.unreadCount = data.unreadCount;
          this.updateBadgeUI(data.unreadCount);
        }
      } catch {}
    });

    es.addEventListener('notification', () => {
      this.refreshUnreadCount();
      window.dispatchEvent(new CustomEvent('appointment-status-changed'));
    });

    es.addEventListener('appointment_changed', () => {
      window.dispatchEvent(new CustomEvent('appointment-status-changed'));
    });

    es.onerror = () => {
      this.sseConnected = false;
      if (!store.isAuthenticated()) {
        try { es.close(); } catch {}
        return;
      }
      // Respaldo de baja frecuencia (45s) pausado si la pestaña está oculta
      this.startFallbackPolling();
    };
  }

  static startFallbackPolling() {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (!document.hidden && store.isAuthenticated() && !this.sseConnected) {
        this.refreshUnreadCount();
      }
    }, 45000);
  }

  static stopFallbackPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  static cleanup() {
    this.stopFallbackPolling();
    this.sseConnected = false;
    if (this.eventSource) {
      try { this.eventSource.close(); } catch {}
      this.eventSource = null;
    }
    if (this._docClickHandler) {
      document.removeEventListener('click', this._docClickHandler);
      this._docClickHandler = null;
    }
    if (this._winFocusHandler) {
      window.removeEventListener('focus', this._winFocusHandler);
      this._winFocusHandler = null;
    }
    if (this._visChangeHandler) {
      document.removeEventListener('visibilitychange', this._visChangeHandler);
      this._visChangeHandler = null;
    }
    if (this._swMessageHandler && 'serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', this._swMessageHandler);
      this._swMessageHandler = null;
    }
  }

  static async refreshUnreadCount() {
    if (!store.isAuthenticated()) return;
    try {
      const res = await apiClient.get('/notifications/unread-count');
      const count = res.data?.unreadCount || 0;
      const previousCount = this.unreadCount || 0;
      this.unreadCount = count;
      this.updateBadgeUI(count);

      // Si entraron nuevas notificaciones (ej. confirmación del tutor), notificar a las vistas en caliente
      if (count > previousCount) {
        window.dispatchEvent(new CustomEvent('appointment-status-changed', {
          detail: { newCount: count, previousCount }
        }));
      }
    } catch (e) {
      // Silencioso en segundo plano
    }
  }

  static updateBadgeUI(count) {
    const badge = document.getElementById('notif-badge-counter');
    if (!badge) return;

    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
      badge.textContent = '0';
    }
  }

  static toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  static async open() {
    const dropdown = document.getElementById('notification-center-dropdown');
    if (!dropdown) return;

    dropdown.style.display = 'block';
    this.isOpen = true;

    await this.renderDropdownContent();
  }

  static close() {
    const dropdown = document.getElementById('notification-center-dropdown');
    if (!dropdown) return;

    dropdown.style.display = 'none';
    this.isOpen = false;
  }

  static formatTimeAgo(isoStr) {
    return this.formatNotificationTimestamp(isoStr);
  }

  static formatNotificationTimestamp(isoStr) {
    if (!isoStr) return '';
    // SQLite CURRENT_TIMESTAMP se almacena en UTC (ej: '2026-11-10 20:02:51')
    // Aseguramos indicador UTC 'Z' para que el motor JS no lo interprete como hora local desfasada
    const cleanStr = (isoStr.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(isoStr))
      ? isoStr
      : (isoStr.includes('T') ? `${isoStr}Z` : `${isoStr.replace(' ', 'T')}Z`);

    const date = new Date(cleanStr);
    if (isNaN(date.getTime())) {
      return isoStr;
    }

    // Hora exacta formateada en zona horaria de Bolivia (UTC-4 / America/La_Paz)
    const timeOptions = { timeZone: 'America/La_Paz', hour12: false, hour: '2-digit', minute: '2-digit' };
    const exactTime = new Intl.DateTimeFormat('es-BO', timeOptions).format(date);

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    // Comparación calendárica en Bolivia (America/La_Paz)
    const getBoliviaDateParts = (d) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/La_Paz',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      }).formatToParts(d);
      return {
        y: parts.find(p => p.type === 'year')?.value,
        m: parts.find(p => p.type === 'month')?.value,
        d: parts.find(p => p.type === 'day')?.value
      };
    };

    const notifDate = getBoliviaDateParts(date);
    const todayDate = getBoliviaDateParts(now);

    const isToday = (
      notifDate.y === todayDate.y &&
      notifDate.m === todayDate.m &&
      notifDate.d === todayDate.d
    );

    if (diffMins < 1) {
      return `Hace un momento · ${exactTime}`;
    }
    if (diffMins < 60) {
      return `Hace ${diffMins} min · ${exactTime}`;
    }
    if (isToday) {
      return `Hoy · ${exactTime}`;
    }

    // Verificar si fue ayer en Bolivia
    const yesterday = new Date(now.getTime() - 24 * 3600000);
    const yesterdayDate = getBoliviaDateParts(yesterday);
    const isYesterday = (
      notifDate.y === yesterdayDate.y &&
      notifDate.m === yesterdayDate.m &&
      notifDate.d === yesterdayDate.d
    );

    if (isYesterday) {
      return `Ayer · ${exactTime}`;
    }

    const day = String(notifDate.d).padStart(2, '0');
    const month = String(notifDate.m).padStart(2, '0');
    return `${day}/${month} · ${exactTime}`;
  }

  static formatBoliviaFullDateTime(isoStr) {
    if (!isoStr) return '';
    try {
      const cleanStr = (isoStr.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(isoStr))
        ? isoStr
        : (isoStr.includes('T') ? `${isoStr}Z` : `${isoStr.replace(' ', 'T')}Z`);
      const date = new Date(cleanStr);
      return date.toLocaleString('es-BO', { timeZone: 'America/La_Paz' });
    } catch (e) {
      return isoStr;
    }
  }

  static async renderDropdownContent() {
    const dropdown = document.getElementById('notification-center-dropdown');
    if (!dropdown) return;

    dropdown.innerHTML = `
      <div style="padding: 2.5rem 1.5rem; text-align: center; color: var(--soft-text-muted);">
        <div class="soft-spinner soft-spinner-sm" style="margin: 0 auto 0.5rem auto;"></div>
        <span style="font-size: 0.85rem; font-weight: 600;">Cargando notificaciones clínicas...</span>
      </div>
    `;

    try {
      // 1. Consulta del estado de Web Push sin bloquear la carga de la bandeja
      let isSubscribed = false;
      try {
        isSubscribed = await PushClient.isSubscribed();
      } catch (pushErr) {
        console.warn('[NotificationCenter] No se pudo verificar suscripción Push:', pushErr);
      }
      this.isSubscribedPush = isSubscribed;

      // 2. Consulta de notificaciones clínicas con fallback seguro
      let notifsRes = null;
      try {
        notifsRes = await apiClient.get('/notifications?limit=20');
      } catch (apiErr) {
        console.warn('[NotificationCenter] Falló /notifications?limit=20, probando /notifications:', apiErr);
        try {
          notifsRes = await apiClient.get('/notifications');
        } catch (apiErr2) {
          console.error('[NotificationCenter] Fallback de notificaciones:', apiErr2);
          notifsRes = { data: { notifications: [], unreadCount: 0 } };
        }
      }

      const notifications = notifsRes?.data?.notifications || notifsRes?.notifications || [];
      const unread = notifsRes?.data?.unreadCount ?? notifsRes?.unreadCount ?? 0;
      this.updateBadgeUI(unread);

      const isPushSupported = PushClient.isSupported();

      dropdown.innerHTML = `
        <!-- Encabezado del Centro de Notificaciones -->
        <div class="soft-notif-header">
          <div style="display: flex; align-items: center; gap: 0.55rem;">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.bell(16, 'var(--soft-purple-primary)')}
            </div>
            <div>
              <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.96rem; letter-spacing: -0.015em;">
                Notificaciones &amp; Alertas
              </div>
              <div style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 600;">
                Recordatorios 24h/2h y avisos en tiempo real
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.45rem;">
            ${unread > 0 ? `
              <button type="button" id="btn-mark-all-read" class="soft-btn-link-action" title="Marcar todas como leídas">
                ${Icons.check(13, 'var(--soft-purple-primary)')}
                <span>Leer todas</span>
              </button>
            ` : ''}
            ${notifications.length > 0 ? `
              <button type="button" id="btn-clear-read" class="soft-btn-link-action" title="Eliminar notificaciones leídas para liberar espacio" style="color: var(--soft-text-muted);">
                ${Icons.trash(13, 'var(--soft-text-muted)')}
                <span>Limpiar</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Banner de Notificaciones Web Push Nativas (Sprint 8) -->
        ${isPushSupported ? `
          <div class="soft-push-banner">
            ${this.isSubscribedPush ? `
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; width: 100%;">
                <div style="display: flex; align-items: center; gap: 0.45rem;">
                  <span class="soft-status-dot-green" title="Alertas de pantalla activas"></span>
                  <div style="font-size: 0.78rem; font-weight: 700; color: var(--soft-emerald-dark, #065F46);">
                    Web Push Activo en este Móvil / PC
                  </div>
                </div>
                <button type="button" id="btn-test-push-now" class="soft-btn soft-btn-xs soft-btn-lvl-2-soft" title="Enviar prueba Web Push al dispositivo">
                  ${Icons.pulse(12, 'var(--soft-purple-primary)')}
                  <span>Probar</span>
                </button>
              </div>
            ` : `
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.65rem; width: 100%; flex-wrap: wrap;">
                <div style="font-size: 0.76rem; color: var(--soft-text-title); line-height: 1.35; flex: 1; min-width: min(100%, 170px);">
                  <strong>¿Recibir alertas en pantalla?</strong><br>
                  <span style="color: var(--soft-text-body); font-size: 0.72rem;">Active avisos 24h/2h incluso con la PWA cerrada.</span>
                </div>
                <button type="button" id="btn-enable-push-now" class="soft-btn soft-btn-xs soft-btn-lvl-2">
                  ${Icons.bell(12, '#FFFFFF')}
                  <span>Activar Alertas</span>
                </button>
              </div>
            `}
          </div>
        ` : ''}

        <!-- Lista de Notificaciones -->
        <div class="soft-notif-list-body">
          ${notifications.length === 0 ? `
            <div style="padding: 2.8rem 1rem; text-align: center; color: var(--soft-text-muted);">
              <div class="soft-icon-box soft-icon-box-mint" style="margin: 0 auto 0.65rem auto;">
                ${Icons.checkCircle(22, 'var(--soft-mint-deep)')}
              </div>
              <div style="font-weight: 800; font-size: 0.95rem; color: var(--soft-text-title);">¡Bandeja al día!</div>
              <div style="font-size: 0.78rem; margin-top: 0.2rem;">No tienes notificaciones pendientes en este momento.</div>
            </div>
          ` : `
            ${notifications.map(n => {
              const isUnread = (n.leida === 0);
              const is24h = n.tipo === 'RECORDATORIO_24H';
              const is2h = n.tipo === 'RECORDATORIO_2H';

              let iconBox = `
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.calendar(15, 'var(--soft-purple-primary)')}
                </div>
              `;

              if (is2h) {
                iconBox = `
                  <div class="soft-icon-box soft-icon-box-sm soft-icon-box-rose">
                    ${Icons.clock(15, 'var(--soft-rose)')}
                  </div>
                `;
              } else if (is24h) {
                iconBox = `
                  <div class="soft-icon-box soft-icon-box-sm soft-icon-box-indigo">
                    ${Icons.calendar(15, 'var(--soft-indigo-accent)')}
                  </div>
                `;
              }

              return `
                <div class="soft-notif-item ${isUnread ? 'is-unread' : ''}" data-id="${n.id}" data-url="${escapeHtml(sanitizeUrl(n.link_url || '#/appointments'))}">
                  ${iconBox}

                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 0.45rem; margin-bottom: 0.15rem;">
                      <div style="font-size: 0.82rem; font-weight: ${isUnread ? '800' : '700'}; color: var(--soft-text-title); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${escapeHtml(n.titulo)}
                      </div>
                      <span style="font-size: 0.68rem; color: var(--soft-text-muted); flex-shrink: 0; font-weight: 600;" title="${escapeHtml(this.formatBoliviaFullDateTime(n.created_at))}">
                        ${escapeHtml(this.formatNotificationTimestamp(n.created_at))}
                      </span>
                    </div>

                    <div style="font-size: 0.76rem; color: var(--soft-text-body); line-height: 1.38; white-space: pre-line;">
                      ${escapeHtml(n.mensaje)}
                    </div>

                    ${n.cita_id && (n.tipo === 'RECORDATORIO' || n.tipo === 'RECORDATORIO_24H' || n.tipo === 'RECORDATORIO_2H' || n.tipo === 'RECORDATORIO_MANUAL_PWA' || n.tipo === 'CITA_PROGRAMADA') ? `
                      <div class="notif-quick-actions" style="display: flex; gap: 0.45rem; margin-top: 0.55rem; flex-wrap: wrap;">
                        <button type="button" class="soft-btn soft-btn-xs soft-btn-lvl-2 btn-notif-confirm-cita" data-cita-id="${n.cita_id}" data-notif-id="${n.id}" title="Confirmar asistencia a esta sesión clínica">
                          ${Icons.check(12, '#FFFFFF')}
                          <span>Confirmar Cita</span>
                        </button>
                        <button type="button" class="soft-btn soft-btn-xs soft-btn-lvl-2-soft btn-notif-reschedule-cita" data-cita-id="${n.cita_id}" data-notif-id="${n.id}" title="Solicitar cambio de horario / reprogramar">
                          ${Icons.clock(12, 'var(--soft-purple-primary)')}
                          <span>Reprogramar</span>
                        </button>
                      </div>
                    ` : ''}
                  </div>

                  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; flex-shrink: 0;">
                    ${isUnread ? `
                      <span class="soft-notif-unread-dot" title="No leída"></span>
                    ` : ''}
                    <button type="button" class="btn-delete-single-notif" data-id="${n.id}" title="Eliminar de la bandeja" style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 6px; color: var(--soft-text-muted); opacity: 0.5; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
                      ${Icons.trash(12, 'currentColor')}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          `}
        </div>

        <!-- Pie del Dropdown -->
        <div class="soft-notif-footer">
          <a href="#/appointments" class="soft-notif-footer-link" id="link-view-all-agenda">
            <span>Ver Agenda Completa</span>
            ${Icons.chevronRight(13)}
          </a>
        </div>
      `;

      this.attachDropdownListeners(dropdown);
    } catch (err) {
      console.error('[NotificationCenter] Error cargando notificaciones:', err);
      dropdown.innerHTML = `
        <div style="padding: 2rem 1rem; text-align: center; color: var(--soft-text-muted);">
          <div style="color: #ef4444; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.35rem;">
            No se pudieron sincronizar las notificaciones
          </div>
          <button type="button" id="btn-retry-notifs" class="soft-btn soft-btn-xs soft-btn-lvl-1">
            ${Icons.refresh(12, '#FFFFFF')}
            <span>Reintentar</span>
          </button>
        </div>
      `;
      document.getElementById('btn-retry-notifs')?.addEventListener('click', () => this.renderDropdownContent());
    }
  }

  static attachDropdownListeners(dropdown) {
    // 1. Activar Web Push
    dropdown.querySelector('#btn-enable-push-now')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      try {
        btn.disabled = true;
        btn.textContent = 'Activando...';
        await PushClient.subscribe();
        Toast.success('¡Alertas Web Push activadas en este dispositivo!');
        await this.renderDropdownContent();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Activar Alertas';
        Toast.error(err.message || 'No se pudo activar Web Push.');
      }
    });

    // 2. Probar Notificación Web Push
    dropdown.querySelector('#btn-test-push-now')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      try {
        btn.disabled = true;
        btn.textContent = 'Despachando...';
        await PushClient.sendTestPush();
        Toast.success('Notificación de prueba enviada al dispositivo.');
        setTimeout(() => this.renderDropdownContent(), 1000);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Probar';
        Toast.error(err.message || 'Error al enviar prueba push.');
      }
    });

    // 3. Marcar todas como leídas
    dropdown.querySelector('#btn-mark-all-read')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await apiClient.patch('/notifications/read-all');
        this.updateBadgeUI(0);
        await this.renderDropdownContent();
        Toast.info('Todas las alertas fueron marcadas como leídas.');
      } catch (err) {
        Toast.error('No se pudieron actualizar las notificaciones.');
      }
    });

    // 3b. Limpiar notificaciones para liberar espacio (vaciar bandeja completa)
    dropdown.querySelector('#btn-clear-read')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await apiClient.delete('/notifications/clear?all=true');
        this.updateBadgeUI(0);
        await this.renderDropdownContent();
        Toast.info('Bandeja de notificaciones vaciada exitosamente.');
      } catch (err) {
        Toast.error('No se pudieron limpiar las notificaciones.');
      }
    });

    // 3c. Eliminar notificación individual
    dropdown.querySelectorAll('.btn-delete-single-notif').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        try {
          await apiClient.delete(`/notifications/${id}`);
          await this.renderDropdownContent();
          this.refreshUnreadCount();
        } catch (err) {
          Toast.error('No se pudo eliminar la notificación.');
        }
      });
    });

    // 3d. Confirmar cita directamente desde la notificación
    dropdown.querySelectorAll('.btn-notif-confirm-cita').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const citaId = btn.dataset.citaId;
        const notifId = btn.dataset.notifId;
        const origHtml = btn.innerHTML;
        try {
          btn.disabled = true;
          btn.innerHTML = `<span class="soft-spinner soft-spinner-sm" style="margin-right: 0.25rem;"></span> <span>Confirmando...</span>`;
          await apiClient.patch(`/appointments/${citaId}/status`, { estado: 'CONFIRMADA' });
          Toast.success('¡Cita médica confirmada exitosamente!');
          if (notifId) {
            await apiClient.patch(`/notifications/${notifId}/read`).catch(() => {});
          }
          window.dispatchEvent(new CustomEvent('appointment-status-changed', {
            detail: { citaId: Number(citaId), estado: 'CONFIRMADA' }
          }));
          await this.renderDropdownContent();
          this.refreshUnreadCount();
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = origHtml;
          Toast.error(err.message || 'Error al confirmar la cita.');
        }
      });
    });

    // 3e. Reprogramar cita desde la notificación
    dropdown.querySelectorAll('.btn-notif-reschedule-cita').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const citaId = btn.dataset.citaId;
        const notifId = btn.dataset.notifId;
        if (notifId) {
          apiClient.patch(`/notifications/${notifId}/read`).catch(() => {});
        }
        this.close();
        window.location.hash = `#/appointments?action=reschedule&citaId=${citaId}`;
      });
    });

    // 4. Clic en un elemento de notificación
    dropdown.querySelectorAll('.soft-notif-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        const url = item.dataset.url;

        // Marcar como leída de forma optimista
        if (item.classList.contains('is-unread')) {
          apiClient.patch(`/notifications/${id}/read`).catch(() => {});
          this.refreshUnreadCount();
        }

        this.close();
        if (url) {
          window.location.hash = url;
        }
      });
    });

    // 5. Enlace al pie
    dropdown.querySelector('#link-view-all-agenda')?.addEventListener('click', () => {
      this.close();
    });
  }
}

