import { apiClient } from '../api/apiClient.js';
import { store } from '../store.js';
import { Icons } from './Icons.js';

export class FloatingAiBot {
  constructor() {
    this.isOpen = false;
    this.isLoading = false;
    this.sessionId = this._getOrCreateSessionId();
    this.messages = [];
    this.lastLoadedRole = null;
    this.unsubscribeStore = null;
  }

  _getOrCreateSessionId() {
    let sid = sessionStorage.getItem('psi_mindbot_session_id');
    if (!sid) {
      sid = 'mb_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      sessionStorage.setItem('psi_mindbot_session_id', sid);
    }
    return sid;
  }

  init(container = document.body) {
    if (document.getElementById('mindbot-fab-btn')) {
      this.updateVisibility();
      return; // Ya inyectado
    }

    // 1. Inyectar contenedor del botón flotante y ventana de chat
    const botWrapper = document.createElement('div');
    botWrapper.id = 'mindbot-root';
    botWrapper.innerHTML = `
      <!-- Botón Flotante Circular (FAB) -->
      <button id="mindbot-fab-btn" class="mindbot-fab" title="MindBot IA · Triaje Clínico & Orientación" aria-label="Abrir Asistente MindBot IA">
        <span class="mindbot-fab-pulse"></span>
        <span class="mindbot-tooltip">MindBot IA · Triaje Clínico</span>
        ${Icons.bot(28, '#FFFFFF')}
      </button>

      <!-- Ventana de Chat Flotante -->
      <div id="mindbot-chat-window" class="mindbot-window" role="dialog" aria-hidden="true">
        <!-- Encabezado Institucional -->
        <div class="mindbot-header">
          <div class="mindbot-brand">
            <div class="mindbot-avatar">
              ${Icons.bot(22, '#54B8B0')}
            </div>
            <div class="mindbot-title-block">
              <div class="mindbot-title">
                MindBot IA
                <span class="mindbot-tag">Triaje & Guía</span>
              </div>
              <div class="mindbot-status">
                <span class="mindbot-status-dot"></span>
                <span id="mindbot-engine-label">En línea · GroqCloud LLaMA / Resiliente</span>
              </div>
            </div>
          </div>
          <div class="mindbot-actions">
            <button id="mindbot-btn-reset" class="mindbot-btn-action" title="Reiniciar conversación" aria-label="Reiniciar">
              ${Icons.refresh(15, 'currentColor')}
            </button>
            <button id="mindbot-btn-minimize" class="mindbot-btn-action" title="Minimizar" aria-label="Minimizar">
              ${Icons.minimize(16, 'currentColor')}
            </button>
            <button id="mindbot-btn-close" class="mindbot-btn-action" title="Cerrar" aria-label="Cerrar">
              ${Icons.close(16, 'currentColor')}
            </button>
          </div>
        </div>

        <!-- Área de Conversación con Scroll -->
        <div id="mindbot-messages-box" class="mindbot-messages">
          <!-- Mensajes dinámicos según el rol -->
        </div>

        <!-- Pie de Entrada de Texto -->
        <form id="mindbot-input-form" class="mindbot-footer">
          <div class="mindbot-input-row">
            <input 
              type="text" 
              id="mindbot-text-input" 
              class="mindbot-input" 
              placeholder="Describe el motivo de consulta o pregunta..." 
              autocomplete="off"
              maxlength="2000"
            />
            <button type="submit" id="mindbot-send-btn" class="mindbot-btn-send" title="Enviar consulta" aria-label="Enviar">
              ${Icons.send(16, '#FFFFFF')}
            </button>
          </div>
          <div class="mindbot-privacy-note">
            ${Icons.shield(12, 'var(--text-muted)')}
            <span>Confidencialidad biomédica · Anonimización automática de datos</span>
          </div>
        </form>
      </div>
    `;

    container.appendChild(botWrapper);

    // 2. Controlar visibilidad inicial según estado de autenticación (Regla: solo usuarios logueados)
    this.updateVisibility();

    // 3. Suscribirse a cambios de sesión (Login / Logout)
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
    }
    this.unsubscribeStore = store.subscribe(() => {
      this.updateVisibility();
    });

    // 4. Vincular eventos de la interfaz
    this.attachEvents();
  }

  /**
   * Controla la visibilidad del botón FAB:
   * Solo visible cuando el usuario haya iniciado sesión (store.isAuthenticated() === true).
   */
  updateVisibility() {
    const botRoot = document.getElementById('mindbot-root');
    if (!botRoot) return;

    const isAuth = store.isAuthenticated();
    if (!isAuth) {
      botRoot.style.display = 'none';
      if (this.isOpen) {
        this.isOpen = false;
        const chatWindow = document.getElementById('mindbot-chat-window');
        chatWindow?.classList.remove('active');
        chatWindow?.setAttribute('aria-hidden', 'true');
      }
      this.messages = [];
      this.lastLoadedRole = null;
    } else {
      botRoot.style.display = 'block';
      const currentRole = store.getUserRole() || 'TUTOR';
      if (this.lastLoadedRole !== currentRole) {
        this.lastLoadedRole = currentRole;
        this.loadInitialGreeting(currentRole);
      }
    }
  }

  /**
   * Carga el saludo institucional personalizado según el Rol del usuario logueado.
   * Para TUTOR: Mensaje exacto especificado por la Dirección.
   * Para TERAPEUTA, ADMIN y RECEPCION: Mensajes contextuales a sus atribuciones.
   */
  loadInitialGreeting(role = 'TUTOR') {
    const messagesBox = document.getElementById('mindbot-messages-box');
    if (!messagesBox) return;

    this.messages = [];
    messagesBox.innerHTML = '';

    let headerTitle = '';
    let introText = '';
    let bullets = [];
    let footerNote = '';
    let chips = [];

    if (role === 'TUTOR') {
      // Mensaje oficial exacto solicitado para Tutores/Familias
      headerTitle = `¡Bienvenido(a) a "PSI Aprende"!`;
      introText = `Soy <strong>MindBot IA</strong>, el asistente de triaje clínico y orientación del centro. Puedo ayudarte con:`;
      bullets = [
        `<strong>Triaje preliminar:</strong> Cuéntame qué dificultades tú o tu familiar experimentan y te orientaré hacia el especialista idóneo.`,
        `<strong>Guía del centro:</strong> Consultorios, terapeutas acreditados, aranceles y horarios de atención.`
      ];
      footerNote = `<em>Tus datos son anonimizados automáticamente bajo secreto profesional.</em>`;
      chips = [
        { label: 'TDAH e Inquietud Infantil', icon: Icons.sparkles(13, 'var(--brand-purple-deep)'), prompt: 'Mi hijo de 8 años tiene problemas de concentración, inquietud y sospecha de TDAH' },
        { label: 'Lectura / Dislexia', icon: Icons.fileText(13, 'var(--brand-purple-deep)'), prompt: 'Dificultad notoria en lectura, escritura y bajo rendimiento escolar' },
        { label: 'Adulto Mayor / Memoria', icon: Icons.brain(13, 'var(--brand-purple-deep)'), prompt: 'Mi abuela tiene olvidos frecuentes de memoria y desorientación leve' },
        { label: 'Terapia del Lenguaje', icon: Icons.phone(13, 'var(--brand-purple-deep)'), prompt: 'Dificultades en pronunciación y retraso en el habla' },
        { label: 'Consultorios y Horarios', icon: Icons.clinic(13, 'var(--brand-purple-deep)'), prompt: '¿Cuáles son los consultorios y horarios de atención del centro?' }
      ];
    } else if (role === 'TERAPEUTA') {
      headerTitle = `¡Bienvenido(a) al Asistente Clínico de PSI Aprende!`;
      introText = `Soy <strong>MindBot IA</strong>, tu asistente de apoyo profesional en sala. Puedo orientarte en:`;
      bullets = [
        `<strong>Expedientes y Pacientes:</strong> Consulta de historias clínicas, notas SOAP y seguimiento.`,
        `<strong>Salas y Consultorios:</strong> Disponibilidad, protocolos de uso y características de los ambientes.`
      ];
      footerNote = `<em>Consultas tratadas bajo secreto profesional y ética médica colegiada.</em>`;
      chips = [
        { label: 'Mis Pacientes Asignados', icon: Icons.fileText(13, 'var(--brand-purple-deep)'), prompt: '¿Dónde puedo ver mis pacientes asignados y sus expedientes?' },
        { label: 'Distribución de Consultorios', icon: Icons.clinic(13, 'var(--brand-purple-deep)'), prompt: '¿Cuáles son las características de los consultorios del centro?' },
        { label: 'Criterios TDAH / Neuropsicología', icon: Icons.brain(13, 'var(--brand-purple-deep)'), prompt: '¿Cuáles son los criterios y pruebas recomendadas para valoración de TDAH infantil?' },
        { label: 'Estructuración de Notas SOAP', icon: Icons.sparkles(13, 'var(--brand-purple-deep)'), prompt: '¿Cómo estructurar adecuadamente las notas clínicas de evolución?' }
      ];
    } else if (role === 'ADMIN') {
      headerTitle = `Consola de Asistencia Institucional · PSI Aprende`;
      introText = `Soy <strong>MindBot IA</strong>, asistente para la supervisión y gestión global del centro:`;
      bullets = [
        `<strong>Supervisión de Triajes:</strong> Registro de casos atendidos, derivaciones y niveles de urgencia.`,
        `<strong>Gestión y Configuración:</strong> Accesos directos a usuarios, consultorios y auditoría del sistema.`
      ];
      footerNote = `<em>Modo Administrador · Autorización y auditoría integral del sistema.</em>`;
      chips = [
        { label: 'Gestión de Usuarios', icon: Icons.sparkles(13, 'var(--brand-purple-deep)'), prompt: '¿Dónde puedo gestionar usuarios, crear cuentas o cambiar roles?' },
        { label: 'Configuración de Consultorios', icon: Icons.clinic(13, 'var(--brand-purple-deep)'), prompt: '¿Dónde configuro los consultorios y su disponibilidad?' },
        { label: 'Resumen de Triajes', icon: Icons.brain(13, 'var(--brand-purple-deep)'), prompt: '¿Cuáles son los casos de triaje clínico y niveles de urgencia registrados?' },
        { label: 'Aranceles Oficiales', icon: Icons.fileText(13, 'var(--brand-purple-deep)'), prompt: '¿Cuáles son los aranceles vigentes de las consultas en el centro?' }
      ];
    } else { // RECEPCION
      headerTitle = `Asistente de Recepción y Admisión · PSI Aprende`;
      introText = `Soy <strong>MindBot IA</strong>, tu apoyo para la atención ágil a usuarios y familias:`;
      bullets = [
        `<strong>Admisión y Pacientes:</strong> Guía de registro de nuevos pacientes y asignación inicial.`,
        `<strong>Información del Centro:</strong> Aranceles por sesión, Simple QR, turnos y consultorios.`
      ];
      footerNote = `<em>Atención al usuario y gestión administrativa de salas.</em>`;
      chips = [
        { label: 'Registro de Pacientes', icon: Icons.fileText(13, 'var(--brand-purple-deep)'), prompt: '¿Cómo realizo la admisión y registro de un nuevo paciente?' },
        { label: 'Consultorios y Horarios', icon: Icons.clinic(13, 'var(--brand-purple-deep)'), prompt: '¿Cuáles son los horarios de atención y consultorios disponibles?' },
        { label: 'Aranceles y Pagos QR', icon: Icons.sparkles(13, 'var(--brand-purple-deep)'), prompt: '¿Cuáles son los costos de consulta y formas de pago con Simple QR?' },
        { label: 'Directorio de Terapeutas', icon: Icons.phone(13, 'var(--brand-purple-deep)'), prompt: '¿Quiénes son los especialistas acreditados y sus especialidades?' }
      ];
    }

    const welcomeHtml = `
      <div class="mindbot-msg bot">
        <div class="mindbot-bubble">
          <div style="font-weight: 700; color: var(--brand-navy); margin-bottom: 4px;">
            ${headerTitle}
          </div>
          <div>
            ${introText}
          </div>
          <ul style="margin: 6px 0 6px 16px; padding: 0; font-size: 0.81rem; line-height: 1.45;">
            ${bullets.map(b => `<li>${b}</li>`).join('')}
          </ul>
          <div style="font-size: 0.74rem; color: var(--text-secondary); margin-top: 4px;">
            ${footerNote}
          </div>

          <!-- Chips de Sugerencia Rápida Contextual -->
          <div class="mindbot-chips-container">
            <div class="mindbot-chips-title">Sugerencias rápidas:</div>
            <div class="mindbot-chips">
              ${chips.map(c => `
                <button type="button" class="mindbot-chip" data-prompt="${this._escapeHtml(c.prompt)}">
                  ${c.icon} <span>${this._escapeHtml(c.label)}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
        <span class="mindbot-time">${this._getCurrentTime()}</span>
      </div>
    `;

    messagesBox.innerHTML = welcomeHtml;
  }

  attachEvents() {
    const fabBtn = document.getElementById('mindbot-fab-btn');
    const chatWindow = document.getElementById('mindbot-chat-window');
    const closeBtn = document.getElementById('mindbot-btn-close');
    const minimizeBtn = document.getElementById('mindbot-btn-minimize');
    const resetBtn = document.getElementById('mindbot-btn-reset');
    const form = document.getElementById('mindbot-input-form');
    const textInput = document.getElementById('mindbot-text-input');
    const messagesBox = document.getElementById('mindbot-messages-box');

    // Toggle ventana de chat
    const toggleChat = () => {
      this.isOpen = !this.isOpen;
      chatWindow.classList.toggle('active', this.isOpen);
      chatWindow.setAttribute('aria-hidden', !this.isOpen);
      if (this.isOpen) {
        setTimeout(() => textInput?.focus(), 200);
      }
    };

    fabBtn?.addEventListener('click', toggleChat);
    closeBtn?.addEventListener('click', () => {
      this.isOpen = false;
      chatWindow.classList.remove('active');
      chatWindow.setAttribute('aria-hidden', 'true');
    });

    minimizeBtn?.addEventListener('click', () => {
      this.isOpen = false;
      chatWindow.classList.remove('active');
      chatWindow.setAttribute('aria-hidden', 'true');
    });

    resetBtn?.addEventListener('click', () => {
      this.loadInitialGreeting(store.getUserRole() || 'TUTOR');
    });

    // Envío del formulario
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = textInput.value.trim();
      if (!message || this.isLoading) return;

      textInput.value = '';
      await this.sendMessage(message);
    });

    // Delegación unificada de eventos en mensajes (chips, enlaces SPA y botones de navegación)
    messagesBox?.addEventListener('click', async (e) => {
      // 1. Click en chips de sugerencia rápida
      const chip = e.target.closest('.mindbot-chip');
      if (chip && !this.isLoading) {
        const prompt = chip.getAttribute('data-prompt');
        if (prompt) {
          await this.sendMessage(prompt);
        }
        return;
      }

      // 2. Click en cualquier enlace interno o botón de acción con data-nav
      const navTarget = e.target.closest('[data-nav]');
      if (navTarget) {
        e.preventDefault();
        const targetHash = navTarget.getAttribute('data-nav');
        if (targetHash) {
          const formattedHash = targetHash.startsWith('#') ? targetHash : `#${targetHash}`;
          if (window.location.hash === formattedHash) {
            // Forzar re-ejecución del evento hashchange si ya se encuentra en la misma URL exacta
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          } else {
            window.location.hash = formattedHash;
          }

          // Minimizar la ventana de chat para que el usuario vea la sección y el modal de inmediato
          this.isOpen = false;
          chatWindow.classList.remove('active');
          chatWindow.setAttribute('aria-hidden', 'true');
        }
        return;
      }
    });
  }

  async sendMessage(text) {
    const messagesBox = document.getElementById('mindbot-messages-box');
    const textInput = document.getElementById('mindbot-text-input');
    if (!messagesBox) return;

    // 1. Renderizar mensaje del usuario en el DOM
    this.appendUserMessage(text);
    this.messages.push({ sender: 'user', text });

    // 2. Mostrar indicador de escritura
    this.setLoading(true);
    this.scrollToBottom();

    try {
      // 3. Llamada HTTP a la API de Triaje en backend (con token automático vía apiClient)
      const response = await apiClient.post('/triage/chat', {
        message: text,
        sessionId: this.sessionId,
        conversationHistory: this.messages.slice(-6)
      });

      const data = response.data;

      // 4. Actualizar etiqueta del motor en cabecera
      this.updateEngineBadge(data.motor_utilizado);

      // 5. Renderizar respuesta estructurada según el tipo
      this.appendBotResponse(data);
      this.messages.push({ sender: 'bot', data, rawText: data.respuesta_conversacional || data.motivo_sintetizado });

    } catch (err) {
      console.error('[MindBot IA] Error en chat:', err);
      this.appendErrorMessage(err.message || 'No se pudo procesar la consulta en este momento.');
    } finally {
      this.setLoading(false);
      this.scrollToBottom();
      textInput?.focus();
    }
  }

  appendUserMessage(text) {
    const messagesBox = document.getElementById('mindbot-messages-box');
    if (!messagesBox) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'mindbot-msg user';
    msgEl.innerHTML = `
      <div class="mindbot-bubble">${this._escapeHtml(text)}</div>
      <span class="mindbot-time">${this._getCurrentTime()}</span>
    `;
    messagesBox.appendChild(msgEl);
  }

  appendBotResponse(data) {
    const messagesBox = document.getElementById('mindbot-messages-box');
    if (!messagesBox) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'mindbot-msg bot';

    // CASO A: ALERTA DETERMINISTA DE CRISIS (HARD RULE)
    if (data.es_crisis) {
      msgEl.innerHTML = `
        <div class="mindbot-bubble">
          <div class="crisis-alert-card">
            <div class="crisis-alert-header">
              ${Icons.alertTriangle(20, '#DC2626')}
              <span>Líneas de Atención en Crisis y Emergencia</span>
            </div>
            <div class="crisis-alert-msg">
              <strong>${this._escapeHtml(data.motivo_sintetizado || 'Situación de alto riesgo detectada')}</strong>
              <div style="margin-top: 6px;">${this._escapeHtml(data.recomendacion_accion || '')}</div>
            </div>

            <!-- Listado de Teléfonos Oficiales de Cochabamba -->
            <div class="crisis-lines-list">
              ${(data.lineas_auxilio || []).map(linea => `
                <div class="crisis-line-item">
                  <div class="crisis-line-info">
                    <span class="crisis-line-name">${this._escapeHtml(linea.nombre)}</span>
                    <span class="crisis-line-hours">${this._escapeHtml(linea.horario)}</span>
                  </div>
                  <a href="tel:${linea.numero.replace(/[^0-9+]/g, '')}" class="crisis-line-call">
                    ${Icons.phone(12, '#FFFFFF')}
                    <span>${this._escapeHtml(linea.numero)}</span>
                  </a>
                </div>
              `).join('')}
            </div>

            <div class="crisis-alert-footer">
              No estás solo(a). La ayuda profesional y confidencial está disponible ahora mismo.
            </div>
          </div>
        </div>
        <span class="mindbot-time">${this._getCurrentTime()}</span>
      `;
      messagesBox.appendChild(msgEl);
      return;
    }

    // CASO GENERAL: RESPUESTA CONVERSACIONAL NATURAL DE IA
    const conversationalText = data.respuesta_conversacional || data.motivo_sintetizado || data.recomendacion_accion || '¿En qué más puedo orientarte?';
    const formattedText = this._formatMarkdown(conversationalText);

    let extraHtml = '';

    // 1. Aviso Ético Profesional (para consultas psicoeducativas o conceptuales)
    if (data.requiere_aviso_profesional && data.aviso_profesional) {
      extraHtml += `
        <div class="mindbot-disclaimer-box">
          <span class="mindbot-disclaimer-icon">${Icons.shield(15, 'var(--brand-purple-deep)')}</span>
          <div class="mindbot-disclaimer-text">
            <strong>Aviso Clínico Ético (PSI Aprende):</strong>
            ${this._escapeHtml(data.aviso_profesional)}
          </div>
        </div>
      `;
    }

    // 2. Reorientación Institucional (solo cuando la pregunta es genuinamente off-topic)
    if (data.reorientacion_institucional) {
      extraHtml += `
        <div class="mindbot-reorient-box">
          <span class="mindbot-reorient-icon">${Icons.clinic(15, 'var(--brand-teal)')}</span>
          <div class="mindbot-reorient-text">
            <strong>Enfoque Institucional:</strong>
            ${this._escapeHtml(data.reorientacion_institucional)}
          </div>
        </div>
      `;
    }

    // 3. Ficha Estructurada de Triaje Clínico Inicial (Solo si es un caso nuevo con es_triaje === true)
    if (data.es_triaje && data.area_sugerida) {
      const urgencyClass = (data.nivel_urgencia || 'Baja').toLowerCase().replace(/\s+/g, '-');
      const questions = data.preguntas_orientadoras || [];

      extraHtml += `
        <div class="triage-card">
          <div class="triage-card-header">
            <span class="triage-area-badge">${this._escapeHtml(data.area_sugerida)}</span>
            <span class="triage-urgency-badge ${urgencyClass}">Prioridad: ${this._escapeHtml(data.nivel_urgencia || 'Media')}</span>
          </div>

          ${questions.length > 0 ? `
            <div class="triage-questions-box">
              <div class="triage-questions-title">
                ${Icons.fileText(13, 'var(--brand-purple-deep)')}
                <span>Preguntas Orientadoras para la Consulta:</span>
              </div>
              <ul class="triage-questions-list">
                ${questions.map(q => `<li>${this._escapeHtml(q)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="triage-action-box">
            <div class="triage-action-text">${this._escapeHtml(data.recomendacion_accion || 'Te recomendamos coordinar una cita con nuestro equipo de especialistas.')}</div>
            <button type="button" class="triage-btn-link" data-nav="${store.getUserRole() === 'TUTOR' ? '#/portal/therapists' : '#/therapists'}">
              ${Icons.therapist(14, '#FFFFFF')}
              <span>Consultar Especialistas y Agendar Cita</span>
              ${Icons.arrowRight(13, '#FFFFFF')}
            </button>
          </div>
        </div>
      `;
    }

    // 4. Botones de Acción Rápida para Navegación del Sistema (Action Chips)
    if (Array.isArray(data.enlaces_rapidos) && data.enlaces_rapidos.length > 0) {
      extraHtml += `
        <div class="mindbot-action-chips-container">
          ${data.enlaces_rapidos.map(link => `
            <button type="button" class="mindbot-action-chip" data-nav="${this._escapeHtml(link.url)}">
              ${Icons.externalLink(13, 'var(--brand-purple-deep)')}
              <span>${this._escapeHtml(link.label)}</span>
            </button>
          `).join('')}
        </div>
      `;
    } else if (data.enlace_sugerido && !data.es_triaje) {
      extraHtml += `
        <div style="margin-top: 10px;">
          <button type="button" class="triage-btn-link" data-nav="#${data.enlace_sugerido}">
            ${Icons.externalLink(13, '#FFFFFF')}
            <span>Ir a la sección recomendada</span>
          </button>
        </div>
      `;
    }

    msgEl.innerHTML = `
      <div class="mindbot-bubble">
        <div class="mindbot-conversational-body">${formattedText}</div>
        ${extraHtml}
      </div>
      <span class="mindbot-time">${this._getCurrentTime()}</span>
    `;

    messagesBox.appendChild(msgEl);
  }

  _formatMarkdown(text) {
    if (!text) return '';
    let escaped = this._escapeHtml(text);

    // Enlaces Markdown [Texto](#/ruta) hacia la SPA interna
    escaped = escaped.replace(/\[([^\]]+)\]\((#[^)]+)\)/g, '<a href="$2" class="mindbot-inline-link" data-nav="$2">$1</a>');

    // Negritas **texto**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Listas con viñeta • o - o *
    escaped = escaped.replace(/(?:^|\n)[•*-]\s+(.+)/g, '<br>• $1');

    // Saltos de línea dobles y simples
    escaped = escaped.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');

    return `<p>${escaped}</p>`;
  }

  appendErrorMessage(errorText) {
    const messagesBox = document.getElementById('mindbot-messages-box');
    if (!messagesBox) return;

    const msgEl = document.createElement('div');
    msgEl.className = 'mindbot-msg bot';
    msgEl.innerHTML = `
      <div class="mindbot-bubble" style="border-color: #FCA5A5; background: #FFF5F5;">
        <div style="color: #991B1B; font-weight: 600; display: flex; align-items: center; gap: 5px; margin-bottom: 4px;">
          ${Icons.alert(14, '#DC2626')}
          <span>Aviso del Asistente</span>
        </div>
        <div style="font-size: 0.8rem; color: #7F1D1D;">
          ${this._escapeHtml(errorText)}
        </div>
      </div>
      <span class="mindbot-time">${this._getCurrentTime()}</span>
    `;
    messagesBox.appendChild(msgEl);
  }

  setLoading(loading) {
    this.isLoading = loading;
    const messagesBox = document.getElementById('mindbot-messages-box');
    const sendBtn = document.getElementById('mindbot-send-btn');
    const textInput = document.getElementById('mindbot-text-input');

    if (sendBtn) sendBtn.disabled = loading;
    if (textInput) textInput.disabled = loading;

    const existingTyping = document.getElementById('mindbot-typing-indicator');
    if (loading && !existingTyping && messagesBox) {
      const typingEl = document.createElement('div');
      typingEl.id = 'mindbot-typing-indicator';
      typingEl.className = 'mindbot-msg bot';
      typingEl.innerHTML = `
        <div class="mindbot-typing">
          <span style="font-size: 0.72rem; color: var(--text-secondary); margin-right: 4px;">Analizando caso...</span>
          <span class="mindbot-typing-dot"></span>
          <span class="mindbot-typing-dot"></span>
          <span class="mindbot-typing-dot"></span>
        </div>
      `;
      messagesBox.appendChild(typingEl);
    } else if (!loading && existingTyping) {
      existingTyping.remove();
    }
  }

  updateEngineBadge(motor) {
    const label = document.getElementById('mindbot-engine-label');
    if (!label) return;

    if (motor === 'GROQ_CLOUD') {
      label.textContent = 'En línea · GroqCloud LLaMA 3.3';
    } else if (motor === 'GROQ_CLOUD_FALLBACK') {
      label.textContent = 'En línea · GroqCloud 20B Fallback';
    } else if (motor === 'FALLBACK_HEURISTICO_OFFLINE') {
      label.textContent = 'Modo Resiliente · Fallback Local';
    } else if (motor === 'FILTRO_CRISIS') {
      label.textContent = 'Protocolo de Crisis Activado';
    }
  }

  scrollToBottom() {
    const messagesBox = document.getElementById('mindbot-messages-box');
    if (messagesBox) {
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
  }

  _getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
