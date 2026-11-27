import { apiClient } from '../../api/apiClient.js';
import { Toast } from '../../components/Toast.js';
import { Icons } from '../../components/Icons.js';
import { ImageLightboxModal } from '../../components/ImageLightboxModal.js';
import { store } from '../../store.js';

export class SettingsView {
  constructor(container) {
    this.container = container;
    this.configs = [];
  }

  escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/[()]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async render() {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem;">
        <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto;">
          <div style="display: inline-flex; animation: spin 1.1s linear infinite;">${Icons.pulse(24, 'var(--soft-purple-primary)')}</div>
        </div>
        <p style="color: var(--soft-text-body); margin-top: 0.9rem; font-weight: 500; font-size: 0.9rem;">Cargando ajustes institucionales y del sistema...</p>
      </div>
    `;

    try {
      const configRes = await apiClient.get('/config/admin');
      this.configs = configRes.data || [];

      const groqKeyConfig = this.configs.find(c => c.clave === 'GROQ_API_KEY');
      const addressConfig = this.configs.find(c => c.clave === 'INSTITUCION_DIRECCION');
      const phoneConfig = this.configs.find(c => c.clave === 'INSTITUCION_TELEFONO');
      const whatsappConfig = this.configs.find(c => c.clave === 'INSTITUCION_WHATSAPP');
      const nameConfig = this.configs.find(c => c.clave === 'INSTITUCION_NOMBRE');
      const horarioConfig = this.configs.find(c => c.clave === 'INSTITUCION_HORARIO');
      const mapsConfig = this.configs.find(c => c.clave === 'INSTITUCION_GOOGLE_MAPS_URL');
      const misionConfig = this.configs.find(c => c.clave === 'INSTITUCION_MISION');
      const visionConfig = this.configs.find(c => c.clave === 'INSTITUCION_VISION');
      const metasConfig = this.configs.find(c => c.clave === 'INSTITUCION_METAS');
      const modelPrimaryConfig = this.configs.find(c => c.clave === 'GROQ_MODEL_PRIMARY');
      const modelFallbackConfig = this.configs.find(c => c.clave === 'GROQ_MODEL_FALLBACK');
      const marginConfig = this.configs.find(c => c.clave === 'VENTILACION_SALAS_MINUTOS');
      const fotoFachadaConfig = this.configs.find(c => c.clave === 'INSTITUCION_FOTO_FACHADA');
      const fotoRecepcionConfig = this.configs.find(c => c.clave === 'INSTITUCION_FOTO_RECEPCION');
      const fotoCons1Config = this.configs.find(c => c.clave === 'INSTITUCION_FOTO_CONS1');
      const fotoCons2Config = this.configs.find(c => c.clave === 'INSTITUCION_FOTO_CONS2');
      const fotoCons3Config = this.configs.find(c => c.clave === 'INSTITUCION_FOTO_CONS3');
      const directoraConfig = this.configs.find(c => c.clave === 'INSTITUCION_DIRECTORA');
      const direccionEtiquetaConfig = this.configs.find(c => c.clave === 'INSTITUCION_DIRECCION_ETIQUETA');
      const direccionMatriculaConfig = this.configs.find(c => c.clave === 'INSTITUCION_DIRECCION_MATRICULA');
      const direccionBioConfig = this.configs.find(c => c.clave === 'INSTITUCION_DIRECCION_BIO');
      const directoraFotoConfig = this.configs.find(c => c.clave === 'INSTITUCION_DIRECTORA_FOTO');

      const currentDirectora = (directoraConfig && directoraConfig.valor !== null && directoraConfig.valor !== '') ? directoraConfig.valor : 'Mgr. Grisel Aguilar Apaza';
      const currentDirEtiqueta = (direccionEtiquetaConfig && direccionEtiquetaConfig.valor !== null && direccionEtiquetaConfig.valor !== '') ? direccionEtiquetaConfig.valor : 'DIRECCIÓN GENERAL & FUNDACIÓN';
      const currentDirMatricula = direccionMatriculaConfig ? (direccionMatriculaConfig.valor || '') : 'MATRÍCULA CPB-1402';
      const currentDirBio = (direccionBioConfig && direccionBioConfig.valor !== null && direccionBioConfig.valor !== '') ? direccionBioConfig.valor : 'Máster en Neuropsicología Clínica e intervención en el neurodesarrollo infantil y juvenil. Lidera la dirección técnica de PSI Aprende garantizando que cada protocolo de evaluación y plan terapéutico individualizado PTI responda a baremos científicos actualizados y a un trato empático hacia las familias.';
      const currentDirFoto = directoraFotoConfig ? (directoraFotoConfig.valor || '') : '';

      const currentName = nameConfig ? nameConfig.valor : 'Centro Psicopedagógico y de Atención Psicológica PSI Aprende';
      const currentAddress = addressConfig ? addressConfig.valor : 'Calle Ladislao Cabrera entre Calle Antezana y Calle 16 de Julio, Cochabamba, Bolivia';
      const currentPhone = phoneConfig ? phoneConfig.valor : '+591 4 4521234';
      const currentWhatsapp = whatsappConfig ? whatsappConfig.valor : '+591 71234567';
      const currentHorario = horarioConfig ? horarioConfig.valor : 'Lunes a Viernes: 08:30 a 12:30 y 14:30 a 18:30 · Sábados: 09:00 a 13:00';
      const currentMaps = mapsConfig ? mapsConfig.valor : 'https://maps.google.com/?q=-17.396611,-66.150722';
      const currentMision = misionConfig ? misionConfig.valor : 'Brindar evaluación diagnóstica neurocognitiva y psicopedagógica integral, basada en evidencia científica y calidez humana, potenciando el aprendizaje y bienestar emocional de cada paciente y su familia.';
      const currentVision = visionConfig ? visionConfig.valor : 'Ser el centro psicopedagógico y neurocognitivo de mayor prestigio y referencia en Cochabamba y Bolivia, reconocido por su rigor ético, metodologías personalizadas y articulación con familias y colegios.';
      const currentMetas = metasConfig ? metasConfig.valor : '1. Detección temprana de dificultades del aprendizaje y neurodesarrollo. 2. Tratamientos individualizados con metodología SOAP y metas SMART. 3. Respaldo ético con 100% de terapeutas colegiados y secreto profesional bajo Ley 3131.';
      const currentFotoFachada = fotoFachadaConfig ? fotoFachadaConfig.valor : '/uploads/instalaciones/fachada_edificio_guiller.svg';
      const currentFotoRecepcion = fotoRecepcionConfig ? fotoRecepcionConfig.valor : '/uploads/instalaciones/recepcion_piso7.svg';
      const currentFotoCons1 = fotoCons1Config ? fotoCons1Config.valor : '/uploads/instalaciones/consultorio_1_infantil.svg';
      const currentFotoCons2 = fotoCons2Config ? fotoCons2Config.valor : '/uploads/instalaciones/consultorio_2_psicoterapia.svg';
      const currentFotoCons3 = fotoCons3Config ? fotoCons3Config.valor : '/uploads/instalaciones/consultorio_3_adultos.svg';
      const currentGroqKey = groqKeyConfig ? groqKeyConfig.valor : '';
      const currentModelPrimary = modelPrimaryConfig ? modelPrimaryConfig.valor : 'openai/gpt-oss-120b';
      const currentModelFallback = modelFallbackConfig ? modelFallbackConfig.valor : 'openai/gpt-oss-20b';
      const currentMargin = marginConfig ? marginConfig.valor : '10';

      this.container.innerHTML = `
        <div class="page-container panel-general" style="max-width: 1260px; margin: 0 auto; padding-bottom: 3.5rem;">
          
          <!-- CABECERA PRINCIPAL -->
          <div class="soft-header-row" style="margin-bottom: 2rem;">
            <div>
              <div class="soft-header-meta">
                <a href="#/dashboard" class="soft-back-link">
                  &larr; Volver al Panel Principal
                </a>
                <span class="soft-badge soft-badge-lavender">Dirección General</span>
                <span class="soft-location-label">Centro PSI Aprende · Cochabamba</span>
              </div>
              <h1 class="soft-page-title" style="letter-spacing: -0.025em;">
                Ajustes Institucionales y del Sistema
              </h1>
              <p class="soft-page-subtitle" style="max-width: 820px; font-size: 0.94rem; line-height: 1.6;">
                Panel de control de la Dirección General. Configura la sede física, credenciales del motor de IA GroqCloud, directivas operativas de los consultorios, galería de fachada y seguridad clínica.
              </p>
            </div>

            <div class="soft-header-actions" style="display: flex; gap: 0.65rem; flex-wrap: wrap; align-items: center;">
              <a href="#/admin/talleres" class="soft-btn soft-btn-lvl-1-muted" style="text-decoration: none;">
                ${Icons.calendar(16, 'currentColor')}
                <span>Gestión de Talleres &amp; Eventos</span>
              </a>
              <a href="#/admin/convenios" class="soft-btn soft-btn-lvl-1-muted" style="text-decoration: none;">
                ${Icons.handshake(16, 'currentColor')}
                <span>Gestión de Convenios &amp; Alianzas</span>
              </a>
              <a href="#/admin/rooms" class="soft-btn soft-btn-lvl-1-muted" style="text-decoration: none;">
                ${Icons.rooms(16, 'currentColor')}
                <span>Gestión de Consultorios</span>
              </a>
              <a href="#/admin/audit?from=settings" class="soft-btn soft-btn-lvl-1-muted" style="text-decoration: none;">
                ${Icons.shield(16, 'currentColor')}
                <span>Bitácora de Auditoría</span>
              </a>
            </div>
          </div>

          <!-- CONTENEDOR EN DISPOSICIÓN HORIZONTAL ESPACIOSA -->
          <div style="display: flex; flex-direction: column; gap: 2rem;">

            <!-- MÓDULO 1: SEDE CENTRAL Y DIRECCIÓN FÍSICA HORIZONTAL -->
            <div class="soft-card-static" style="padding: 1.75rem 2rem;">
              
              <!-- ENCABEZADO DEL MÓDULO -->
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 1.15rem;">
                <div style="display: flex; align-items: center; gap: 0.85rem;">
                  <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                    ${Icons.home(20, 'var(--soft-purple-primary)')}
                  </div>
                  <div>
                    <h3 style="margin: 0; font-size: 1.22rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em;">
                      Sede Central &amp; Dirección Física
                    </h3>
                    <div style="font-size: 0.82rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                      Actualizable ante traslados de oficinas o cambios de sede física del centro
                    </div>
                  </div>
                </div>
                <span class="soft-badge soft-badge-mint">Propagación Inmediata</span>
              </div>

              <form id="form-settings-institution">
                
                <!-- DOS COLUMNAS HORIZONTALES PRINCIPALES -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 1.6rem; margin-bottom: 1.5rem;">
                  
                  <!-- COLUMNA IZQUIERDA: NOMBRE Y DIRECCIÓN -->
                  <div style="display: flex; flex-direction: column; gap: 1.15rem;">
                    <div>
                      <label class="soft-label" for="inst-nombre">
                        Nombre Oficial de la Institución *
                      </label>
                      <input type="text" id="inst-nombre" class="soft-input" value="${this.escapeHtml(currentName)}" required />
                    </div>

                    <div>
                      <label class="soft-label" for="inst-direccion">
                        Dirección Física Completa *
                      </label>
                      <textarea id="inst-direccion" class="soft-textarea" rows="3" required
                        placeholder="Calle, edificio, piso, oficina, ciudad y país">${this.escapeHtml(currentAddress)}</textarea>
                      <div style="font-size: 0.75rem; color: var(--soft-text-muted); margin-top: 0.35rem; line-height: 1.4;">
                        Se actualiza en tiempo real en la página de inicio, notas SOAP y encabezados impresos.
                      </div>
                    </div>

                    <div>
                      <label class="soft-label" for="inst-google-maps">
                        Enlace a Google Maps *
                      </label>
                      <input type="text" id="inst-google-maps" class="soft-input" value="${this.escapeHtml(currentMaps)}" />
                    </div>
                  </div>

                  <!-- COLUMNA DERECHA: CONTACTOS Y HORARIOS -->
                  <div style="display: flex; flex-direction: column; gap: 1.15rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                      <div>
                        <label class="soft-label" for="inst-telefono">
                          Teléfono Fijo / Recepción
                        </label>
                        <input type="tel" inputmode="tel" maxlength="20" id="inst-telefono" class="soft-input" value="${this.escapeHtml(currentPhone)}" />
                      </div>

                      <div>
                        <label class="soft-label" for="inst-whatsapp">
                          WhatsApp Institucional
                        </label>
                        <input type="tel" inputmode="tel" maxlength="20" id="inst-whatsapp" class="soft-input" value="${this.escapeHtml(currentWhatsapp)}" />
                      </div>
                    </div>

                    <div>
                      <label class="soft-label" for="inst-horario">
                        Horarios Oficiales de Atención *
                      </label>
                      <input type="text" id="inst-horario" class="soft-input" value="${this.escapeHtml(currentHorario)}" />
                    </div>

                    <!-- CAJA INFORMATIVA DE GEOLOCALIZACIÓN -->
                    <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.95rem 1.15rem;">
                      <div style="font-size: 0.76rem; font-weight: 800; color: var(--soft-purple-primary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.4rem;">
                        ${Icons.mapPin(14, 'var(--soft-purple-primary)')}
                        <span>Coordenadas Georreferenciadas</span>
                      </div>
                      <div style="font-size: 0.83rem; color: var(--soft-text-body); line-height: 1.45;">
                        Latitud -17.396611 · Longitud -66.150722 · Cochabamba, Bolivia. Coordenadas oficiales configuradas en el mapa interactivo de las familias.
                      </div>
                    </div>
                  </div>

                </div>

                <!-- SECCIÓN HORIZONTAL INFERIOR: FILOSOFÍA INSTITUCIONAL EN 3 COLUMNAS -->
                <div style="border-top: 1px solid var(--soft-divider); padding-top: 1.35rem; margin-bottom: 1.25rem;">
                  <span style="display: block; font-size: 0.82rem; font-weight: 800; color: var(--soft-text-title); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.95rem;">
                    Filosofía Institucional · Publicada en el Portal de Nosotros
                  </span>

                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1.25rem;">
                    <div>
                      <label class="soft-label" for="inst-mision">
                        Misión Institucional
                      </label>
                      <textarea id="inst-mision" class="soft-textarea" rows="3">${this.escapeHtml(currentMision)}</textarea>
                    </div>

                    <div>
                      <label class="soft-label" for="inst-vision">
                        Visión Institucional
                      </label>
                      <textarea id="inst-vision" class="soft-textarea" rows="3">${this.escapeHtml(currentVision)}</textarea>
                    </div>

                    <div>
                      <label class="soft-label" for="inst-metas">
                        Metas y Objetivos Clave
                      </label>
                      <textarea id="inst-metas" class="soft-textarea" rows="3">${this.escapeHtml(currentMetas)}</textarea>
                    </div>
                  </div>
                </div>

                <!-- PIE DEL FORMULARIO CON BOTÓN DE GUARDADO -->
                <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--soft-divider); padding-top: 1.25rem;">
                  <button type="submit" id="btn-save-institution" class="soft-btn soft-btn-lvl-1" style="padding: 0.75rem 1.85rem;">
                    ${Icons.check(15, '#FFFFFF')}
                    <span>Guardar Datos de Sede</span>
                  </button>
                </div>

              </form>
            </div>

            <!-- MÓDULO 2: ASISTENCIA IA GROQCLOUD LPU HORIZONTAL -->
            <div class="soft-card-static" style="padding: 1.75rem 2rem; position: relative;">
              ${currentGroqKey ? '<span class="soft-status-dot-green" title="Motor IA activo" aria-hidden="true"></span>' : ''}
              
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 1.15rem; padding-right: ${currentGroqKey ? '1.2rem' : '0'};">
                <div style="display: flex; align-items: center; gap: 0.85rem;">
                  <div class="soft-icon-box soft-icon-box-sm soft-icon-box-indigo">
                    ${Icons.brain(20, 'var(--soft-indigo-accent)')}
                  </div>
                  <div>
                    <h3 style="margin: 0; font-size: 1.22rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em;">
                      Asistencia de Inteligencia Artificial · GroqCloud LPU
                    </h3>
                    <div style="font-size: 0.82rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                      MindBot IA · Triaje, derivaciones asistidas, análisis cualitativo y síntesis de notas SOAP
                    </div>
                  </div>
                </div>
                <span class="soft-badge ${currentGroqKey ? 'soft-badge-emerald' : 'soft-badge-amber'}">
                  <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
                  <span>${currentGroqKey ? 'API Key Activa' : 'Modo Heurístico Local'}</span>
                </span>
              </div>

              <!-- DISPOSICIÓN EN 2 COLUMNAS HORIZONTALES AMPLIAS -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr)); gap: 1.75rem; align-items: stretch;">
                
                <!-- COLUMNA IZQUIERDA: CREDENCIALES Y MODELOS -->
                <form id="form-settings-groq" style="display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="margin-bottom: 1.25rem;">
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.45rem;">
                        <label class="soft-label" for="settings-groq-key" style="margin: 0;">
                          Clave de API Privada · GROQ_API_KEY
                        </label>
                        <button type="button" id="btn-toggle-groq-visibility" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="padding: 0.24rem 0.68rem; font-size: 0.73rem; border-radius: 9px;">
                          Mostrar Clave
                        </button>
                      </div>

                      <div style="position: relative;">
                        <input type="password" id="settings-groq-key" class="soft-input"
                          value="${this.escapeHtml(currentGroqKey)}"
                          placeholder="gsk_..." style="padding-right: 2.5rem; width: 100%; font-family: monospace;" />
                      </div>
                      <div style="font-size: 0.74rem; color: var(--soft-text-muted); margin-top: 0.3rem;">
                        Inferencia ultrarrápida LPU para análisis clínico y triajes automatizados en milisegundos.
                      </div>
                    </div>

                    <!-- SELECTORES DE MODELO EN 2 COLUMNAS -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                      <div>
                        <label class="soft-label">Modelo Primario</label>
                        <input type="text" class="soft-input" value="${this.escapeHtml(currentModelPrimary)}" readonly style="background: var(--soft-lavender-surface); font-size: 0.8rem; font-family: monospace;" />
                      </div>
                      <div>
                        <label class="soft-label">Modelo Secundario</label>
                        <input type="text" class="soft-input" value="${this.escapeHtml(currentModelFallback)}" readonly style="background: var(--soft-lavender-surface); font-size: 0.8rem; font-family: monospace;" />
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; justify-content: flex-start; padding-top: 1rem; border-top: 1px solid var(--soft-divider);">
                    <button type="submit" id="btn-save-groq-settings" class="soft-btn soft-btn-lvl-1">
                      ${Icons.check(15, '#FFFFFF')}
                      <span>Guardar Parámetros de IA</span>
                    </button>
                  </div>
                </form>

                <!-- COLUMNA DERECHA: DIAGNÓSTICO EN VIVO Y PROTOCOLO RN-04 -->
                <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.35rem 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
                      <span style="font-size: 0.82rem; font-weight: 800; color: var(--soft-text-title); text-transform: uppercase; letter-spacing: 0.04em;">
                        Diagnóstico de Conectividad en Tiempo Real
                      </span>
                      <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem; font-weight: 700;">Protocolo RN-04</span>
                    </div>

                    <p style="font-size: 0.84rem; color: var(--soft-text-body); line-height: 1.5; margin: 0 0 1rem 0;">
                      Prueba en caliente la comunicación con los servidores de GroqCloud y verifica el tiempo de respuesta. Si la API no está configurada, el sistema activa automáticamente el motor heurístico local sin interrumpir las consultas.
                    </p>

                    <div id="settings-groq-test-result" style="display: none; margin-bottom: 1rem;"></div>
                  </div>

                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; padding-top: 1rem; border-top: 1px solid var(--soft-border-card-inner);">
                    <span style="font-size: 0.78rem; color: var(--soft-mint-deep); font-weight: 700;">
                      ${Icons.shield(13, 'var(--soft-mint-deep)')} Anonimización médica garantizada
                    </span>
                    <button type="button" id="btn-test-groq-settings" class="soft-btn soft-btn-lvl-1-muted">
                      ${Icons.pulse(15, 'currentColor')}
                      <span>Probar Conexión</span>
                    </button>
                  </div>
                </div>

              </div>

            </div>

            <!-- MÓDULOS 3 Y 4 EN PARALELO HORIZONTAL: DIRECTIVAS OPERATIVAS & SEGURIDAD -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 1.75rem; align-items: stretch;">

              <!-- MÓDULO 3: DIRECTIVAS OPERATIVAS -->
              <div class="soft-card-static" style="padding: 1.6rem 1.85rem; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.35rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.8rem;">
                      <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                        ${Icons.calendar(20, 'var(--soft-mint-deep)')}
                      </div>
                      <div>
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title);">
                          Directivas Operativas del Centro
                        </h3>
                        <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                          Parámetros de ventilación, moneda y agendas
                        </div>
                      </div>
                    </div>
                    <span class="soft-badge soft-badge-mint">Reglas RN-01 y RN-02</span>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                    <div class="soft-subcard" style="padding: 0.95rem 1.15rem;">
                      <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.87rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="color: var(--soft-mint-deep); display: inline-flex;">${Icons.rooms(16, 'var(--soft-mint-deep)')}</span>
                        <span>Margen Preventivo de Ventilación</span>
                      </div>
                      <div style="color: var(--soft-text-body); font-size: 0.82rem; margin-top: 0.35rem; line-height: 1.45;">
                        <strong style="color: var(--soft-text-title);">${currentMargin} minutos obligatorios</strong> entre sesiones sucesivas en el mismo consultorio para desinfección, ventilación acústica y preparación psicométrica.
                      </div>
                    </div>

                    <div class="soft-subcard" style="padding: 0.95rem 1.15rem;">
                      <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.87rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.shield(16, 'var(--soft-purple-primary)')}</span>
                        <span>Moneda Oficial &amp; Facturación</span>
                      </div>
                      <div style="color: var(--soft-text-body); font-size: 0.82rem; margin-top: 0.35rem; line-height: 1.45;">
                        Bolivianos · <strong style="color: var(--soft-text-title);">Bs BOB</strong>. Todos los aranceles, cobros con Simple QR y liquidaciones a especialistas se calculan en moneda nacional boliviana.
                      </div>
                    </div>

                    <div class="soft-subcard" style="padding: 0.95rem 1.15rem;">
                      <div style="font-weight: 800; color: var(--soft-text-title); font-size: 0.87rem; display: flex; align-items: center; gap: 0.5rem;">
                        <span style="color: var(--soft-mint-deep); display: inline-flex;">${Icons.calendar(16, 'var(--soft-mint-deep)')}</span>
                        <span>Horarios Oficiales de Atención</span>
                      </div>
                      <div style="color: var(--soft-text-body); font-size: 0.82rem; margin-top: 0.35rem; line-height: 1.45;">
                        Lunes a Viernes: 08:30 a 12:30 y 14:30 a 18:30<br>
                        Sábados: 08:30 a 12:30 · Jornada Continua<br>
                        Domingos y Feriados: Cerrado
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- MÓDULO 4: SEGURIDAD Y RESPALDO MÉDICO-LEGAL -->
              <div class="soft-card-static" style="padding: 1.6rem 1.85rem; display: flex; flex-direction: column; justify-content: space-between; position: relative;">
                <span class="soft-status-dot-green" title="Protección activa" aria-hidden="true"></span>
                
                <div>
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.35rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 1rem; padding-right: 1.1rem;">
                    <div style="display: flex; align-items: center; gap: 0.8rem;">
                      <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                        ${Icons.shield(20, 'var(--soft-purple-primary)')}
                      </div>
                      <div>
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title);">
                          Seguridad &amp; Respaldo Clínico
                        </h3>
                        <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                          Trazabilidad médico-legal y secreto profesional
                        </div>
                      </div>
                    </div>
                    <span class="soft-badge soft-badge-emerald">Seguro · Ley 3131</span>
                  </div>

                  <div style="display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.35rem;">
                    <div class="soft-subcard" style="padding: 0.95rem 1.15rem;">
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span style="font-weight: 700; color: var(--soft-text-title); font-size: 0.85rem;">Motor de Persistencia:</span>
                        <span class="soft-badge soft-badge-mint">SQLite WAL Activado</span>
                      </div>
                      <div style="font-size: 0.77rem; color: var(--soft-text-body); margin-top: 0.35rem; line-height: 1.42;">
                        Modo Write-Ahead Logging para concurrencia multi-usuario sin bloqueos en disco.
                      </div>
                    </div>

                    <div class="soft-subcard" style="padding: 0.95rem 1.15rem;">
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span style="font-weight: 700; color: var(--soft-text-title); font-size: 0.85rem;">Caché PWA Service Worker:</span>
                        <span class="soft-badge soft-badge-lavender">psi-aprende-cache-v3</span>
                      </div>
                      <div style="font-size: 0.77rem; color: var(--soft-text-body); margin-top: 0.35rem; line-height: 1.42;">
                        Estrategia Network-First con purga reactiva para evitar desactualizaciones en tutores.
                      </div>
                    </div>

                    <div class="soft-subcard" style="padding: 0.95rem 1.15rem;">
                      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                        <span style="font-weight: 700; color: var(--soft-text-title); font-size: 0.85rem;">Anonimización para IA · RN-04:</span>
                        <span class="soft-badge soft-badge-emerald">Activa 100%</span>
                      </div>
                      <div style="font-size: 0.77rem; color: var(--soft-text-body); margin-top: 0.35rem; line-height: 1.42;">
                        Nombres de pacientes, cédulas, teléfonos y direcciones jamás se envían a GroqCloud.
                      </div>
                    </div>
                  </div>
                </div>

                <div style="border-top: 1px solid var(--soft-divider); padding-top: 1.1rem;">
                  <a href="#/admin/audit?from=settings" class="soft-btn soft-btn-lvl-1" style="width: 100%; text-decoration: none; justify-content: center; display: inline-flex; align-items: center; gap: 0.5rem;">
                    ${Icons.shield(16, '#FFFFFF')}
                    <span>Abrir Bitácora Completa de Auditoría</span>
                  </a>
                </div>
              </div>

            </div>

            <!-- MÓDULO 5: GALERÍA FOTOGRÁFICA DE INSTALACIONES Y FACHADA -->
            <div class="soft-card-static" style="padding: 1.75rem 2rem;">
              
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.85rem;">
                  <div class="soft-icon-box soft-icon-box-lavender">
                    ${Icons.eye(22, 'var(--soft-purple-primary)')}
                  </div>
                  <div>
                    <h3 style="margin: 0; font-size: 1.22rem; font-weight: 800; color: var(--soft-text-title);">
                      Fotografías de las Instalaciones y Fachada
                    </h3>
                    <div style="font-size: 0.78rem; color: var(--soft-text-muted);">
                      Imágenes oficiales que ven los padres y tutores en el portal de Ubicación e Instalaciones
                    </div>
                  </div>
                </div>
                <a href="#/portal/ubicacion" target="_blank" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm" style="display: inline-flex; align-items: center; gap: 0.4rem; text-decoration: none;">
                  ${Icons.externalLink(14)}
                  <span>Previsualizar como Tutor</span>
                </a>
              </div>

              <p style="font-size: 0.85rem; color: var(--soft-text-body); margin: 0 0 1.5rem 0; line-height: 1.5;">
                Actualice las fotografías de referencia para que los tutores reconozcan la fachada del centro y los ambientes terapéuticos. Puede <strong>subir fotos reales desde su PC</strong> en formatos PNG, JPG o WEBP, o mantener las ilustraciones médicas.
              </p>

              <!-- CUADRÍCULA HORIZONTAL AMPLIA DE 5 FOTOGRAFÍAS -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1.35rem; margin-bottom: 1.5rem;">
                
                <!-- 1. FACHADA EXTERIOR -->
                <div class="soft-subcard" style="padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                      <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem; font-weight: 700;">1. Fachada Exterior</span>
                      <span style="font-size: 0.73rem; color: var(--soft-text-muted);">Acceso Exterior</span>
                    </div>
                    <div style="width: 100%; height: 140px; border-radius: 12px; overflow: hidden; background: #F1F5F9; border: 1px solid var(--soft-border-card-inner); margin-bottom: 0.85rem; position: relative;">
                      <img id="preview-foto-fachada" src="${this.escapeHtml(currentFotoFachada)}" alt="Fachada" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" title="Clic para agrandar" />
                    </div>
                    <label class="soft-label" style="font-size: 0.78rem;">Ruta o URL de Imagen</label>
                    <input type="text" id="input-foto-fachada" class="soft-input" style="font-size: 0.8rem; margin-bottom: 0.75rem;" value="${this.escapeHtml(currentFotoFachada)}" />
                  </div>
                  <div>
                    <input type="file" id="file-foto-fachada" accept="image/*" style="display: none;" />
                    <button type="button" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm btn-trigger-upload" data-target="fachada" style="width: 100%; justify-content: center; display: inline-flex; align-items: center; gap: 0.45rem;">
                      ${Icons.upload(14, 'currentColor')}
                      <span>Subir Foto desde PC</span>
                    </button>
                  </div>
                </div>

                <!-- 2. RECEPCIÓN & SALA DE ESPERA -->
                <div class="soft-subcard" style="padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                      <span class="soft-badge soft-badge-mint" style="font-size: 0.72rem; font-weight: 700;">2. Recepción &amp; Espera</span>
                      <span style="font-size: 0.73rem; color: var(--soft-text-muted);">Piso 7</span>
                    </div>
                    <div style="width: 100%; height: 140px; border-radius: 12px; overflow: hidden; background: #F1F5F9; border: 1px solid var(--soft-border-card-inner); margin-bottom: 0.85rem; position: relative;">
                      <img id="preview-foto-recepcion" src="${this.escapeHtml(currentFotoRecepcion)}" alt="Recepción" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" title="Clic para agrandar" />
                    </div>
                    <label class="soft-label" style="font-size: 0.78rem;">Ruta o URL de Imagen</label>
                    <input type="text" id="input-foto-recepcion" class="soft-input" style="font-size: 0.8rem; margin-bottom: 0.75rem;" value="${this.escapeHtml(currentFotoRecepcion)}" />
                  </div>
                  <div>
                    <input type="file" id="file-foto-recepcion" accept="image/*" style="display: none;" />
                    <button type="button" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm btn-trigger-upload" data-target="recepcion" style="width: 100%; justify-content: center; display: inline-flex; align-items: center; gap: 0.45rem;">
                      ${Icons.upload(14, 'currentColor')}
                      <span>Subir Foto desde PC</span>
                    </button>
                  </div>
                </div>

                <!-- 3. CONSULTORIO 1 (INFANTIL) -->
                <div class="soft-subcard" style="padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                      <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem; font-weight: 700;">3. Consultorio 1</span>
                      <span style="font-size: 0.73rem; color: var(--soft-text-muted);">Infantil &amp; Neurodesarrollo</span>
                    </div>
                    <div style="width: 100%; height: 140px; border-radius: 12px; overflow: hidden; background: #F1F5F9; border: 1px solid var(--soft-border-card-inner); margin-bottom: 0.85rem; position: relative;">
                      <img id="preview-foto-cons1" src="${this.escapeHtml(currentFotoCons1)}" alt="Consultorio 1" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" title="Clic para agrandar" />
                    </div>
                    <label class="soft-label" style="font-size: 0.78rem;">Ruta o URL de Imagen</label>
                    <input type="text" id="input-foto-cons1" class="soft-input" style="font-size: 0.8rem; margin-bottom: 0.75rem;" value="${this.escapeHtml(currentFotoCons1)}" />
                  </div>
                  <div>
                    <input type="file" id="file-foto-cons1" accept="image/*" style="display: none;" />
                    <button type="button" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm btn-trigger-upload" data-target="cons1" style="width: 100%; justify-content: center; display: inline-flex; align-items: center; gap: 0.45rem;">
                      ${Icons.upload(14, 'currentColor')}
                      <span>Subir Foto desde PC</span>
                    </button>
                  </div>
                </div>

                <!-- 4. CONSULTORIO 2 (PSICOTERAPIA) -->
                <div class="soft-subcard" style="padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                      <span class="soft-badge soft-badge-indigo" style="font-size: 0.72rem; font-weight: 700;">4. Consultorio 2</span>
                      <span style="font-size: 0.73rem; color: var(--soft-text-muted);">Psicoterapia &amp; Familia</span>
                    </div>
                    <div style="width: 100%; height: 140px; border-radius: 12px; overflow: hidden; background: #F1F5F9; border: 1px solid var(--soft-border-card-inner); margin-bottom: 0.85rem; position: relative;">
                      <img id="preview-foto-cons2" src="${this.escapeHtml(currentFotoCons2)}" alt="Consultorio 2" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" title="Clic para agrandar" />
                    </div>
                    <label class="soft-label" style="font-size: 0.78rem;">Ruta o URL de Imagen</label>
                    <input type="text" id="input-foto-cons2" class="soft-input" style="font-size: 0.8rem; margin-bottom: 0.75rem;" value="${this.escapeHtml(currentFotoCons2)}" />
                  </div>
                  <div>
                    <input type="file" id="file-foto-cons2" accept="image/*" style="display: none;" />
                    <button type="button" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm btn-trigger-upload" data-target="cons2" style="width: 100%; justify-content: center; display: inline-flex; align-items: center; gap: 0.45rem;">
                      ${Icons.upload(14, 'currentColor')}
                      <span>Subir Foto desde PC</span>
                    </button>
                  </div>
                </div>

                <!-- 5. CONSULTORIO 3 (ADULTOS & EVALUACIÓN) -->
                <div class="soft-subcard" style="padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                      <span class="soft-badge soft-badge-mint" style="font-size: 0.72rem; font-weight: 700;">5. Consultorio 3</span>
                      <span style="font-size: 0.73rem; color: var(--soft-text-muted);">Adulto Mayor &amp; Evaluación</span>
                    </div>
                    <div style="width: 100%; height: 140px; border-radius: 12px; overflow: hidden; background: #F1F5F9; border: 1px solid var(--soft-border-card-inner); margin-bottom: 0.85rem; position: relative;">
                      <img id="preview-foto-cons3" src="${this.escapeHtml(currentFotoCons3)}" alt="Consultorio 3" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" title="Clic para agrandar" />
                    </div>
                    <label class="soft-label" style="font-size: 0.78rem;">Ruta o URL de Imagen</label>
                    <input type="text" id="input-foto-cons3" class="soft-input" style="font-size: 0.8rem; margin-bottom: 0.75rem;" value="${this.escapeHtml(currentFotoCons3)}" />
                  </div>
                  <div>
                    <input type="file" id="file-foto-cons3" accept="image/*" style="display: none;" />
                    <button type="button" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm btn-trigger-upload" data-target="cons3" style="width: 100%; justify-content: center; display: inline-flex; align-items: center; gap: 0.45rem;">
                      ${Icons.upload(14, 'currentColor')}
                      <span>Subir Foto desde PC</span>
                    </button>
                  </div>
                </div>

              </div>

              <!-- BOTÓN GUARDAR FOTOGRAFÍAS -->
              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1.25rem;">
                <button type="button" id="btn-save-facility-photos" class="soft-btn soft-btn-lvl-1" style="padding: 0.75rem 1.85rem;">
                  ${Icons.check(16, '#FFFFFF')}
                  <span>Guardar Galería de Instalaciones</span>
                </button>
              </div>
            </div>

            <!-- MÓDULO 6: DIRECCIÓN GENERAL & FUNDACIÓN (SOBRE NOSOTROS) -->
            <div class="soft-card-static" style="padding: 1.75rem 2rem;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 1.15rem;">
                <div style="display: flex; align-items: center; gap: 0.85rem;">
                  <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                    ${Icons.users ? Icons.users(20, 'var(--soft-purple-primary)') : Icons.badge(20, 'var(--soft-purple-primary)')}
                  </div>
                  <div>
                    <h3 style="margin: 0; font-size: 1.22rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em;">
                      Dirección General &amp; Fundación (Sobre Nosotros)
                    </h3>
                    <div style="font-size: 0.82rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                      Texto y fotografía exhibidos en la cabecera de Sobre Nosotros para las familias
                    </div>
                  </div>
                </div>
                <span class="soft-badge soft-badge-mint">Visible en Portal Tutor</span>
              </div>

              <form id="form-settings-direccion">
                <div style="display: flex; gap: 1.75rem; align-items: flex-start; flex-wrap: wrap; margin-bottom: 1.35rem;">
                  
                  <!-- COLUMNA FOTO DE DIRECCIÓN -->
                  <div style="flex: 0 0 auto; min-width: min(100%, 220px); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.15rem;">
                    <div id="dir-photo-preview-box" style="width: 96px; height: 96px; border-radius: 26px; overflow: hidden; background: linear-gradient(135deg, var(--soft-purple-primary) 0%, #3E3076 100%); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 800; border: 2px solid #FFFFFF; box-shadow: 0 8px 20px rgba(88,66,148,0.2);">
                      ${currentDirFoto ? `
                        <img id="preview-dir-foto" src="${this.escapeHtml(currentDirFoto)}" alt="Foto Dirección General" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" title="Clic para agrandar" />
                      ` : `<span>GA</span>`}
                    </div>
                    <input type="hidden" id="input-dir-foto" value="${this.escapeHtml(currentDirFoto)}" />
                    <input type="file" id="file-dir-foto" accept="image/*" style="display: none;" />
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; width: 100%;">
                      <button type="button" id="btn-upload-dir-photo" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem;">
                        ${Icons.upload(14, 'currentColor')}
                        <span>${currentDirFoto ? 'Cambiar Foto' : 'Subir Foto'}</span>
                      </button>
                      <button type="button" id="btn-clear-dir-photo" class="soft-btn soft-btn-lvl-2-soft soft-btn-sm" style="color: #E11D48; ${currentDirFoto ? '' : 'display: none;'}">
                        ${Icons.trash(13)}
                        <span>Quitar</span>
                      </button>
                    </div>
                    <div style="font-size: 0.72rem; color: var(--soft-text-muted); text-align: center; line-height: 1.35;">
                      JPG, PNG o WEBP (máx. 4 MB). Si la quitas se mostrarán las iniciales.
                    </div>
                  </div>

                  <!-- COLUMNA TEXTOS EDITABLES -->
                  <div style="flex: 1 1 360px; min-width: min(100%, 280px); display: flex; flex-direction: column; gap: 1rem;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 1rem;">
                      <div>
                        <label class="soft-label" for="dir-etiqueta">
                          Etiqueta Principal
                        </label>
                        <input type="text" id="dir-etiqueta" class="soft-input" placeholder="Ej: DIRECCIÓN GENERAL & FUNDACIÓN" value="${this.escapeHtml(currentDirEtiqueta)}" />
                      </div>
                      <div>
                        <label class="soft-label" for="dir-matricula">
                          Insignia Secundaria / Matrícula (Opcional)
                        </label>
                        <input type="text" id="dir-matricula" class="soft-input" placeholder="Ej: MATRÍCULA CPB-1402" value="${this.escapeHtml(currentDirMatricula)}" />
                      </div>
                    </div>

                    <div>
                      <label class="soft-label" for="dir-nombre">
                        Nombre o Título Destacado *
                      </label>
                      <input type="text" id="dir-nombre" class="soft-input" placeholder="Ej: Mgr. Grisel Aguilar Apaza" value="${this.escapeHtml(currentDirectora)}" required />
                    </div>

                    <div>
                      <label class="soft-label" for="dir-bio">
                        Texto Descriptivo / Presentación del Centro *
                      </label>
                      <textarea id="dir-bio" class="soft-textarea" rows="4" placeholder="Escribe aquí el mensaje o presentación institucional que verán las familias..." required>${this.escapeHtml(currentDirBio)}</textarea>
                    </div>
                  </div>

                </div>

                <div style="display: flex; justify-content: flex-end; border-top: 1px solid var(--soft-divider); padding-top: 1.25rem;">
                  <button type="submit" id="btn-save-direccion" class="soft-btn soft-btn-lvl-1" style="padding: 0.75rem 1.85rem;">
                    ${Icons.check(15, '#FFFFFF')}
                    <span>Guardar Dirección General</span>
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      `;

      this.attachEvents();
    } catch (err) {
      console.error(err);
      this.container.innerHTML = `
        <div class="page-container panel-general">
          <div class="soft-card-static" style="margin-top: 1.5rem; text-align: center; padding: 2.75rem 2rem;">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1rem auto;">
              ${Icons.alert(26, 'var(--soft-purple-primary)')}
            </div>
            <h3 style="color: var(--soft-text-title); font-size: 1.22rem; font-weight: 800; margin: 0 0 0.45rem 0;">Error al cargar la configuración</h3>
            <p style="color: var(--soft-text-body); margin: 0 auto 1.4rem auto; max-width: 480px;">${this.escapeHtml(err.message)}</p>
            <a href="#/dashboard" class="soft-btn soft-btn-lvl-1">Volver al Panel</a>
          </div>
        </div>
      `;
    }
  }

  attachEvents() {
    // 1. Guardar Datos de Sede
    const formInst = document.getElementById('form-settings-institution');
    if (formInst) {
      formInst.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputNombre = document.getElementById('inst-nombre');
        const inputDir = document.getElementById('inst-direccion');
        const inputTel = document.getElementById('inst-telefono');
        const inputWs = document.getElementById('inst-whatsapp');
        const inputHorario = document.getElementById('inst-horario');
        const inputMaps = document.getElementById('inst-google-maps');
        const inputMision = document.getElementById('inst-mision');
        const inputVision = document.getElementById('inst-vision');
        const inputMetas = document.getElementById('inst-metas');
        const btnSave = document.getElementById('btn-save-institution');

        const nombre = inputNombre?.value.trim();
        const direccion = inputDir?.value.trim();
        const telefono = inputTel?.value.trim();
        const whatsapp = inputWs?.value.trim();
        const horario = inputHorario?.value.trim();
        const google_maps_url = inputMaps?.value.trim();
        const mision = inputMision?.value.trim();
        const vision = inputVision?.value.trim();
        const metas = inputMetas?.value.trim();

        if (!direccion || direccion.length < 5) {
          Toast.warning('La dirección debe contener al menos 5 caracteres.');
          return;
        }

        try {
          if (btnSave) btnSave.disabled = true;
          const resInst = await apiClient.put('/config/institution', {
            nombre,
            direccion,
            telefono,
            whatsapp,
            horario,
            google_maps_url,
            mision,
            vision,
            metas
          });
          if (resInst?.data) {
            store.setPublicConfig(resInst.data);
          }
          Toast.success('Dirección física y datos institucionales de sede actualizados correctamente.');
          await this.render();
        } catch (err) {
          Toast.error(err.message || 'Error al actualizar los datos de la sede.');
        } finally {
          if (btnSave) btnSave.disabled = false;
        }
      });
    }

    // 2. Guardar Clave Groq
    const formGroq = document.getElementById('form-settings-groq');
    const inputGroq = document.getElementById('settings-groq-key');
    const btnSaveGroq = document.getElementById('btn-save-groq-settings');
    const btnTestGroq = document.getElementById('btn-test-groq-settings');
    const btnToggleVis = document.getElementById('btn-toggle-groq-visibility');
    const testResult = document.getElementById('settings-groq-test-result');

    if (btnToggleVis && inputGroq) {
      btnToggleVis.addEventListener('click', () => {
        if (inputGroq.type === 'password') {
          inputGroq.type = 'text';
          btnToggleVis.textContent = 'Ocultar Clave';
        } else {
          inputGroq.type = 'password';
          btnToggleVis.textContent = 'Mostrar Clave';
        }
      });
    }

    if (formGroq) {
      formGroq.addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = inputGroq.value.trim();
        if (!key) {
          Toast.warning('Por favor ingrese una clave GROQ_API_KEY válida.');
          return;
        }

        try {
          if (btnSaveGroq) btnSaveGroq.disabled = true;
          await apiClient.put('/config/groq-key', { apiKey: key });
          Toast.success('Clave GROQ_API_KEY actualizada exitosamente en caliente.');
          await this.render();
        } catch (err) {
          Toast.error(err.message || 'Error al guardar la clave de GroqCloud.');
        } finally {
          if (btnSaveGroq) btnSaveGroq.disabled = false;
        }
      });
    }

    // 3. Probar Conexión Groq
    if (btnTestGroq) {
      btnTestGroq.addEventListener('click', async () => {
        btnTestGroq.disabled = true;
        btnTestGroq.innerHTML = `${Icons.pulse(15, 'currentColor')} <span>Probando API...</span>`;
        if (testResult) testResult.style.display = 'none';

        try {
          const keyToTest = inputGroq ? inputGroq.value.trim() : '';
          const res = await apiClient.post('/config/test-groq', { apiKey: keyToTest });
          const data = res.data;

          if (testResult) {
            testResult.style.display = 'block';
            if (data.online) {
              testResult.innerHTML = `
                <div style="background: var(--soft-emerald-bg); border: 1px solid rgba(16, 185, 129, 0.32); padding: 0.9rem 1.05rem; border-radius: 14px; font-size: 0.83rem; color: var(--soft-emerald-dark); line-height: 1.45;">
                  <strong>Conexión Exitosa:</strong> ${data.message} (${data.availableModelsCount} modelos detectados en GroqCloud).
                </div>
              `;
              Toast.success('Conexión con GroqCloud confirmada exitosamente.');
            } else {
              testResult.innerHTML = `
                <div style="background: #FEF3C7; border: 1px solid rgba(245, 158, 11, 0.32); padding: 0.9rem 1.05rem; border-radius: 14px; font-size: 0.83rem; color: #92400E; line-height: 1.45;">
                  <strong>Aviso de Contingencia:</strong><br>${data.message}
                </div>
              `;
              Toast.warning('La API de GroqCloud no respondió. El sistema operará con el motor heurístico local.');
            }
          }
        } catch (err) {
          if (testResult) {
            testResult.style.display = 'block';
            testResult.innerHTML = `
              <div style="background: #FFF1F2; border: 1px solid rgba(225, 29, 72, 0.25); padding: 0.9rem 1.05rem; border-radius: 14px; font-size: 0.83rem; color: #BE123C; line-height: 1.45;">
                Error: ${err.message}
              </div>
            `;
          }
          Toast.error(err.message || 'Error al probar conexión con GroqCloud.');
        } finally {
          btnTestGroq.disabled = false;
          btnTestGroq.innerHTML = `${Icons.pulse(15, 'currentColor')} <span>Probar Conexión</span>`;
        }
      });
    }

    // 4. Gestión de Fotografías de las Instalaciones
    const targets = ['fachada', 'recepcion', 'cons1', 'cons2', 'cons3'];
    const uploadButtons = this.container.querySelectorAll('.btn-trigger-upload');

    uploadButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        const fileInput = document.getElementById(`file-foto-${target}`);
        fileInput?.click();
      });
    });

    targets.forEach(target => {
      const fileInput = document.getElementById(`file-foto-${target}`);
      const textInput = document.getElementById(`input-foto-${target}`);
      const previewImg = document.getElementById(`preview-foto-${target}`);

      // Clic en imagen para Lightbox
      previewImg?.addEventListener('click', () => {
        ImageLightboxModal.show({
          imageUrl: previewImg.src,
          title: `Fotografía de Instalación · ${target.toUpperCase()}`,
          subtitle: 'Instalaciones del Centro PSI Aprende'
        });
      });

      // Modificación manual del input de texto
      textInput?.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val && previewImg) {
          previewImg.src = val;
        }
      });

      // Subida de archivo real desde PC
      fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Preview local instantánea
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (previewImg) previewImg.src = ev.target.result;
        };
        reader.readAsDataURL(file);

        // Envío al backend
        const formData = new FormData();
        formData.append('foto', file);

        try {
          Toast.info('Subiendo fotografía de instalación...');
          const res = await apiClient.upload('/config/facility-photo', formData);
          if (res?.data?.url) {
            if (textInput) textInput.value = res.data.url;
            if (previewImg) previewImg.src = res.data.url;
            Toast.success('Fotografía subida exitosamente.');
          } else {
            throw new Error(res?.error?.message || 'Error al subir la fotografía.');
          }
        } catch (uploadErr) {
          console.error('[Upload Facility Photo Error]', uploadErr);
          Toast.error(uploadErr.message || 'Error al subir fotografía.');
        }
      });
    });

    // Botón Guardar Galería Completa
    const btnSavePhotos = document.getElementById('btn-save-facility-photos');
    btnSavePhotos?.addEventListener('click', async () => {
      const foto_fachada = document.getElementById('input-foto-fachada')?.value.trim();
      const foto_recepcion = document.getElementById('input-foto-recepcion')?.value.trim();
      const foto_cons1 = document.getElementById('input-foto-cons1')?.value.trim();
      const foto_cons2 = document.getElementById('input-foto-cons2')?.value.trim();
      const foto_cons3 = document.getElementById('input-foto-cons3')?.value.trim();

      try {
        btnSavePhotos.disabled = true;
        await apiClient.put('/config/institution', {
          INSTITUCION_FOTO_FACHADA: foto_fachada,
          INSTITUCION_FOTO_RECEPCION: foto_recepcion,
          INSTITUCION_FOTO_CONS1: foto_cons1,
          INSTITUCION_FOTO_CONS2: foto_cons2,
          INSTITUCION_FOTO_CONS3: foto_cons3
        });
        Toast.success('Galería de fotografías de instalaciones actualizada exitosamente.');
      } catch (saveErr) {
        Toast.error(saveErr.message || 'Error al guardar la galería.');
      } finally {
        btnSavePhotos.disabled = false;
      }
    });

    // 5. Gestión de Dirección General & Fundación (Sobre Nosotros)
    const dirPhotoPreviewBox = document.getElementById('dir-photo-preview-box');
    const dirPhotoInput = document.getElementById('input-dir-foto');
    const dirFileInput = document.getElementById('file-dir-foto');
    const btnUploadDirPhoto = document.getElementById('btn-upload-dir-photo');
    const btnClearDirPhoto = document.getElementById('btn-clear-dir-photo');
    const formDireccion = document.getElementById('form-settings-direccion');
    const dirNombreInput = document.getElementById('dir-nombre');

    const renderDirPreview = (url) => {
      if (!dirPhotoPreviewBox) return;
      if (url) {
        dirPhotoPreviewBox.innerHTML = `<img id="preview-dir-foto" src="${this.escapeHtml(url)}" alt="Foto Dirección General" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" title="Clic para agrandar" />`;
        const imgEl = document.getElementById('preview-dir-foto');
        imgEl?.addEventListener('click', () => {
          ImageLightboxModal.show({
            imageUrl: url,
            title: 'Dirección General & Fundación',
            subtitle: dirNombreInput?.value.trim() || 'Centro PSI Aprende'
          });
        });
        if (btnClearDirPhoto) btnClearDirPhoto.style.display = 'inline-flex';
        const uploadSpan = btnUploadDirPhoto?.querySelector('span');
        if (uploadSpan) uploadSpan.textContent = 'Cambiar Foto';
      } else {
        const nameVal = dirNombreInput?.value.trim() || 'GA';
        const initials = nameVal
          .replace(/^(Mgr\.|Lic\.|Dr\.|Dra\.|Ps\.|MSc\.)\s*/i, '')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map(n => n[0].toUpperCase())
          .join('') || 'GA';
        dirPhotoPreviewBox.innerHTML = `<span>${this.escapeHtml(initials)}</span>`;
        if (btnClearDirPhoto) btnClearDirPhoto.style.display = 'none';
        const uploadSpan = btnUploadDirPhoto?.querySelector('span');
        if (uploadSpan) uploadSpan.textContent = 'Subir Foto';
      }
    };

    const existingDirImg = document.getElementById('preview-dir-foto');
    existingDirImg?.addEventListener('click', () => {
      ImageLightboxModal.show({
        imageUrl: existingDirImg.src,
        title: 'Dirección General & Fundación',
        subtitle: dirNombreInput?.value.trim() || 'Centro PSI Aprende'
      });
    });

    btnUploadDirPhoto?.addEventListener('click', () => dirFileInput?.click());

    btnClearDirPhoto?.addEventListener('click', () => {
      if (dirPhotoInput) dirPhotoInput.value = '';
      if (dirFileInput) dirFileInput.value = '';
      renderDirPreview('');
    });

    dirFileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          renderDirPreview(ev.target.result);
        }
      };
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append('foto', file);

      try {
        Toast.info('Subiendo fotografía de Dirección General...');
        const res = await apiClient.upload('/config/facility-photo', formData);
        if (res?.data?.url) {
          if (dirPhotoInput) dirPhotoInput.value = res.data.url;
          renderDirPreview(res.data.url);
          Toast.success('Fotografía subida. Pulsa "Guardar Dirección General" para publicarla.');
        } else {
          throw new Error(res?.error?.message || 'Error al subir fotografía.');
        }
      } catch (uploadErr) {
        console.error('[Upload Direccion Photo Error]', uploadErr);
        Toast.error(uploadErr.message || 'Error al subir fotografía.');
      }
    });

    formDireccion?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const etiqueta = document.getElementById('dir-etiqueta')?.value.trim() || '';
      const matricula = document.getElementById('dir-matricula')?.value.trim() || '';
      const nombre = dirNombreInput?.value.trim() || '';
      const bio = document.getElementById('dir-bio')?.value.trim() || '';
      const foto = dirPhotoInput?.value.trim() || '';
      const btnSaveDir = document.getElementById('btn-save-direccion');

      if (!nombre || !bio) {
        Toast.warning('El nombre destacado y el texto descriptivo son obligatorios.');
        return;
      }

      try {
        if (btnSaveDir) btnSaveDir.disabled = true;
        const resDir = await apiClient.put('/config/institution', {
          INSTITUCION_DIRECTORA: nombre,
          INSTITUCION_DIRECCION_ETIQUETA: etiqueta,
          INSTITUCION_DIRECCION_MATRICULA: matricula,
          INSTITUCION_DIRECCION_BIO: bio,
          INSTITUCION_DIRECTORA_FOTO: foto
        });
        if (resDir?.data) {
          store.setPublicConfig(resDir.data);
        }
        Toast.success('Sección Dirección General & Fundación actualizada y guardada permanentemente.');
        await this.render();
      } catch (err) {
        Toast.error(err.message || 'Error al guardar Dirección General.');
      } finally {
        if (btnSaveDir) btnSaveDir.disabled = false;
      }
    });
  }
}
