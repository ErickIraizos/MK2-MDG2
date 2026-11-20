import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';
import { ImageLightboxModal } from '../../components/ImageLightboxModal.js';

export class TutorLocationView {
  constructor(container) {
    this.container = container;
    this.config = null;
    this.loading = true;
  }

  async loadConfig() {
    try {
      const res = await apiClient.get('/config/public');
      if (res && res.success && res.data) {
        this.config = res.data;
      }
    } catch (err) {
      console.warn('[TutorLocationView] Error al cargar configuración pública:', err);
    } finally {
      this.loading = false;
    }
  }

  async render() {
    await this.loadConfig();

    const address = this.config?.INSTITUCION_DIRECCION || 'Calle Ladislao Cabrera entre Calle Antezana y Calle 16 de Julio, Cochabamba, Bolivia';
    const phone = this.config?.INSTITUCION_TELEFONO || '+591 4 4521234';
    const whatsapp = this.config?.INSTITUCION_WHATSAPP || '+591 70012345';
    const cleanWhatsapp = whatsapp.replace(/[^\d]/g, '');
    const horario = this.config?.INSTITUCION_HORARIO || 'Lunes a Viernes: 08:30 a 12:30 y 14:30 a 18:30 · Sábados: 09:00 a 13:00';
    const mapsUrl = this.config?.INSTITUCION_GOOGLE_MAPS_URL || 'https://maps.google.com/?q=-17.396611,-66.150722';

    // Galería referencial de las instalaciones con fotos dinámicas configurables
    const photos = [
      {
        id: 'fachada',
        title: 'Fachada Exterior del Centro',
        subtitle: 'Ingreso Principal',
        desc: `El centro cuenta con acceso cómodo y señalizado sobre ${address}.`,
        imageUrl: this.config?.INSTITUCION_FOTO_FACHADA || '/uploads/instalaciones/fachada_edificio_guiller.svg',
        tag: 'Acceso Exterior'
      },
      {
        id: 'recepcion',
        title: 'Recepción y Sala de Espera Familiar',
        subtitle: 'Ambiente Seguro y Cálido',
        desc: 'Espacio acondicionado con mobiliario ergonómico, libros ilustrados y juegos sensoriales para que los niños y familias esperen cómodamente.',
        imageUrl: this.config?.INSTITUCION_FOTO_RECEPCION || '/uploads/instalaciones/recepcion_piso7.svg',
        tag: 'Recepción y Espera'
      },
      {
        id: 'consultorio_1',
        title: 'Consultorio 1 · Estimulación y Evaluación Infantil',
        subtitle: 'Neuropsicología y Psicopedagogía',
        desc: 'Equipado con mesas adaptadas, baterías estandarizadas WISC-V, CUMANES, BANFE-2 y materiales didácticos de estimulación neurocognitiva.',
        imageUrl: this.config?.INSTITUCION_FOTO_CONS1 || '/uploads/instalaciones/consultorio_1_infantil.svg',
        tag: 'Consultorio Infantil'
      },
      {
        id: 'consultorio_2',
        title: 'Consultorio 2 · Psicoterapia y Apoyo Familiar',
        subtitle: 'Psicología Clínica y Dinámica Familiar',
        desc: 'Ambiente privado, silencioso y confortable diseñado para psicoterapia individual, adolescente y sesiones de orientación familiar.',
        imageUrl: this.config?.INSTITUCION_FOTO_CONS2 || '/uploads/instalaciones/consultorio_2_psicoterapia.svg',
        tag: 'Psicoterapia'
      },
      {
        id: 'consultorio_3',
        title: 'Consultorio 3 · Adulto Mayor y Estimulación VGI',
        subtitle: 'Programa Horizontes Plateados',
        desc: 'Consultorio tranquilo y accesible enfocado en evaluación geriátrica integral VGI, estimulación de memoria y gimnasia cerebral.',
        imageUrl: this.config?.INSTITUCION_FOTO_CONS3 || '/uploads/instalaciones/consultorio_3_adultos.svg',
        tag: 'Psicogerontología'
      }
    ];

    this.container.innerHTML = `
      <div class="page-container panel-general" style="max-width: 1240px; margin: 0 auto; padding-bottom: 3.5rem;">
        
        <!-- CABECERA INSTITUCIONAL SOFT UI -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.mapPin(13, 'var(--soft-purple-primary)')}
                <span>Sede Central Cochabamba</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende" · Ubicación &amp; Acceso</span>
            </div>
            <h1 class="soft-page-title">Ubicación &amp; Instalaciones del Centro</h1>
            <p class="soft-page-subtitle" style="max-width: 820px;">
              Encuentra la dirección exacta, mapas de navegación, líneas de transporte y fotografías de referencia de la fachada e interiores para ubicarte con facilidad en tu visita.
            </p>
          </div>

          <div class="soft-header-actions" style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="soft-btn soft-btn-primary soft-btn-lvl-1" style="display: inline-flex; align-items: center; gap: 0.45rem;">
              ${Icons.externalLink(15, '#FFFFFF')}
              <span>Abrir en Google Maps</span>
            </a>
            <span class="soft-badge soft-badge-emerald" style="padding: 0.45rem 0.9rem; font-size: 0.77rem;">
              ${Icons.shield(14, 'var(--soft-emerald-dark)')}
              <span>Ambiente Cómodo, Seguro y Accesible</span>
            </span>
          </div>
        </div>

        <!-- TARJETA PRINCIPAL DE UBICACIÓN & ACCIONES RÁPIDAS -->
        <div class="soft-card-static" style="padding: 1.6rem 1.85rem; margin-bottom: 1.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem; flex-wrap: wrap;">
            
            <div style="flex: 1 1 380px; min-width: min(100%, 280px);">
              <span class="soft-badge soft-badge-lavender" style="margin-bottom: 0.65rem; font-size: 0.72rem;">
                Dirección Oficial de Atención
              </span>
              <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.5rem 0; line-height: 1.35; letter-spacing: -0.018em;">
                ${this.escapeHtml(address)}
              </h2>
              <div style="display: flex; align-items: center; gap: 0.65rem; color: var(--soft-text-body); font-size: 0.88rem; margin-bottom: 1.15rem;">
                <span style="display: inline-flex; align-items: center; gap: 0.35rem;">
                  ${Icons.clinic(15, 'var(--soft-purple-primary)')}
                  <strong>Centro PSI Aprende</strong>
                </span>
                <span style="color: var(--soft-divider);">·</span>
                <span>Zona Central, Cochabamba</span>
              </div>

              <!-- Botones de Acción de 1 Clic -->
              <div style="display: flex; gap: 0.65rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
                <button type="button" id="btn-copy-address" class="soft-btn soft-btn-lvl-1" style="display: inline-flex; align-items: center; gap: 0.45rem;">
                  ${Icons.copy(15, '#FFFFFF')}
                  <span>Copiar Dirección</span>
                </button>
                <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="soft-btn soft-btn-lvl-1-muted" style="display: inline-flex; align-items: center; gap: 0.45rem;">
                  ${Icons.mapPin(15, 'currentColor')}
                  <span>Navegar con GPS</span>
                </a>
                <a href="https://wa.me/${cleanWhatsapp}?text=Hola%20PSI%20Aprende,%20quisiera%20consultar%20sobre%20c%C3%B3mo%20llegar%20al%20centro" target="_blank" rel="noopener noreferrer" class="soft-btn soft-btn-lvl-1-muted" style="display: inline-flex; align-items: center; gap: 0.45rem;">
                  ${Icons.whatsapp(15, '#25D366')}
                  <span>Consultar por WhatsApp</span>
                </a>
              </div>
            </div>

            <!-- Columna lateral: Horarios & Teléfonos -->
            <div style="flex: 0 1 340px; min-width: min(100%, 260px); background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.15rem 1.35rem; display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="display: flex; align-items: flex-start; gap: 0.65rem;">
                <div style="color: var(--soft-purple-primary); margin-top: 2px;">
                  ${Icons.clock(16)}
                </div>
                <div>
                  <div style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-purple-primary);">
                    Horario de Atención
                  </div>
                  <div style="font-size: 0.85rem; color: var(--soft-text-title); font-weight: 600; line-height: 1.45; margin-top: 0.15rem;">
                    ${this.escapeHtml(horario)}
                  </div>
                </div>
              </div>

              <div style="border-top: 1px solid var(--soft-divider); padding-top: 0.65rem; display: flex; align-items: flex-start; gap: 0.65rem;">
                <div style="color: var(--soft-mint-deep); margin-top: 2px;">
                  ${Icons.phone(16)}
                </div>
                <div>
                  <div style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-mint-deep);">
                    Teléfono &amp; Recepción
                  </div>
                  <div style="font-size: 0.85rem; color: var(--soft-text-title); font-weight: 700; margin-top: 0.15rem;">
                    ${this.escapeHtml(phone)} · ${this.escapeHtml(whatsapp)}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- MAPA REAL INTERACTIVO & CROQUIS URBANO -->
        <div class="soft-card-static" style="padding: 1.45rem 1.65rem; margin-bottom: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.15rem; flex-wrap: wrap; gap: 0.75rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span class="soft-badge soft-badge-mint" style="font-size: 0.72rem;">Ubicación GPS Satelital</span>
                <span class="soft-badge soft-badge-indigo" style="font-size: 0.72rem;">-17.396611, -66.150722</span>
              </div>
              <h3 style="font-size: 1.22rem; font-weight: 800; color: var(--soft-text-title); margin: 0;">
                Mapa Interactivo en Tiempo Real
              </h3>
            </div>
            
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <!-- Selector de vista: Mapa Interactivo / Croquis Esquemático -->
              <div class="soft-btn-group" style="display: inline-flex; background: var(--soft-lavender-surface); padding: 3px; border-radius: 12px; border: 1px solid var(--soft-border-card-inner);">
                <button type="button" id="btn-view-map-live" class="soft-btn-tab active" style="padding: 0.4rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 9px; border: none; background: #FFFFFF; color: var(--soft-purple-primary); box-shadow: 0 2px 6px rgba(88,66,148,0.12); cursor: pointer;">
                  Mapa Interactivo
                </button>
                <button type="button" id="btn-view-map-schema" class="soft-btn-tab" style="padding: 0.4rem 0.85rem; font-size: 0.78rem; font-weight: 600; border-radius: 9px; border: none; background: transparent; color: var(--soft-text-body); cursor: pointer;">
                  Croquis Esquemático
                </button>
              </div>

              <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm" style="display: inline-flex; align-items: center; gap: 0.4rem;">
                ${Icons.externalLink(14)}
                <span>Abrir en Google Maps</span>
              </a>
              <button type="button" id="btn-copy-coords" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm" style="display: inline-flex; align-items: center; gap: 0.4rem;" title="Copiar coordenadas exactas para Waze o GPS">
                ${Icons.copy(14)}
                <span>Copiar Coordenadas</span>
              </button>
            </div>
          </div>

          <!-- CONTENEDOR 1: MAPA REAL INTERACTIVO (OPENSTREETMAP / GPS EMBED) -->
          <div id="container-map-live" style="position: relative; width: 100%; height: 420px; border-radius: 16px; overflow: hidden; border: 1px solid var(--soft-border-card-inner); box-shadow: 0 4px 18px rgba(88,66,148,0.06); background: #E2E8F0;">
            <iframe 
              id="real-map-iframe"
              title="Mapa de Ubicación - PSI Aprende"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-66.1547%2C-17.3996%2C-66.1467%2C-17.3936&amp;layer=mapnik&amp;marker=-17.396611%2C-66.150722" 
              style="width: 100%; height: 100%; border: 0;"
              loading="lazy"
              allowfullscreen>
            </iframe>
            <!-- Pin flotante informativo en Soft UI sobre el mapa -->
            <div style="position: absolute; bottom: 14px; left: 14px; background: rgba(255, 255, 255, 0.94); backdrop-filter: blur(8px); padding: 0.7rem 1.05rem; border-radius: 14px; border: 1px solid var(--soft-border-card-inner); box-shadow: 0 8px 24px rgba(88,66,148,0.14); display: flex; align-items: center; gap: 0.75rem; pointer-events: auto; max-width: 90%;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender" style="flex-shrink: 0;">
                ${Icons.mapPin(18, 'var(--soft-purple-primary)')}
              </div>
              <div style="font-size: 0.8rem; color: var(--soft-text-title); line-height: 1.35;">
                <strong>Centro PSI Aprende</strong><br/>
                <span style="color: var(--soft-text-muted); font-size: 0.74rem;">${this.escapeHtml(address)}</span>
              </div>
            </div>
          </div>

          <!-- CONTENEDOR 2: CROQUIS ESQUEMÁTICO URBANO (OCULTO INICIALMENTE) -->
          <div id="container-map-schema" style="display: none; position: relative; width: 100%; border-radius: 16px; overflow: hidden; border: 1px solid var(--soft-border-card-inner); box-shadow: inset 0 2px 8px rgba(88,66,148,0.04); background: #F1F5F9;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 360" style="display: block; width: 100%; height: auto;">
              <!-- Fondo del plano -->
              <rect width="900" height="360" fill="#E2E8F0"/>

              <!-- Manzanas Norte -->
              <!-- Manzana Noroeste (Oeste de Antezana) -->
              <rect x="25" y="25" width="130" height="115" rx="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
              <text x="90" y="80" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#64748B" text-anchor="middle">Bar Restaurante</text>
              <text x="90" y="96" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#64748B" text-anchor="middle">Las Américas</text>

              <!-- Manzana Norte Central 1 (Casa Misteriosa) -->
              <rect x="220" y="25" width="220" height="115" rx="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
              <text x="330" y="85" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#94A3B8" text-anchor="middle">Casa Misteriosa</text>
              <text x="330" y="100" font-family="system-ui, sans-serif" font-size="9" font-weight="500" fill="#94A3B8" text-anchor="middle">by Criket</text>

              <!-- Manzana Norte Central 2 (CESAVET Veterinaria) -->
              <rect x="470" y="25" width="220" height="115" rx="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
              <text x="580" y="80" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#94A3B8" text-anchor="middle">CESAVET</text>
              <text x="580" y="96" font-family="system-ui, sans-serif" font-size="9" font-weight="500" fill="#94A3B8" text-anchor="middle">Veterinaria y Farmacia</text>

              <!-- Manzana Noreste (Este de 16 de Julio) -->
              <rect x="755" y="25" width="120" height="115" rx="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
              <text x="815" y="88" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#94A3B8" text-anchor="middle">Supermercado</text>

              <!-- Manzanas Sur -->
              <!-- Manzana Suroeste (Oeste de Antezana) -->
              <rect x="25" y="210" width="130" height="125" rx="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
              <text x="90" y="275" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#94A3B8" text-anchor="middle">Fotografías Seven</text>

              <!-- Manzana Sur Central 1 (Fisioterapia Ahyre & Arte Lazer) -->
              <rect x="220" y="210" width="180" height="125" rx="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
              <text x="310" y="265" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#94A3B8" text-anchor="middle">Fisioterapia Ahyre</text>
              <text x="310" y="285" font-family="system-ui, sans-serif" font-size="9" font-weight="500" fill="#94A3B8" text-anchor="middle">Arte Lazer</text>

              <!-- Manzana Centro PSI APRENDE (Destacada en Soft UI Morado) -->
              <rect x="425" y="205" width="275" height="130" rx="10" fill="#FFFFFF" stroke="#7B66B5" stroke-width="3" filter="drop-shadow(0 6px 14px rgba(88,66,148,0.15))"/>
              <rect x="438" y="218" width="249" height="104" rx="8" fill="#F8F6FE"/>
              <text x="562" y="254" font-family="system-ui, sans-serif" font-size="13" font-weight="800" fill="#584294" text-anchor="middle">CENTRO PSI APRENDE</text>
              <text x="562" y="274" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#15968D" text-anchor="middle">Calle Ladislao Cabrera</text>
              <text x="562" y="293" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#696F8C" text-anchor="middle">Entre Antezana y 16 de Julio</text>

              <!-- Manzana Sureste (Este de 16 de Julio) -->
              <rect x="755" y="210" width="120" height="125" rx="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
              <text x="815" y="275" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#94A3B8" text-anchor="middle">Zona Comercial</text>

              <!-- Calles -->
              <!-- Calle Ladislao Cabrera (Horizontal Principal) -->
              <rect x="0" y="152" width="900" height="46" fill="#64748B"/>
              <text x="450" y="180" font-family="system-ui, sans-serif" font-size="12" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">CALLE LADISLAO CABRERA</text>

              <!-- Calle Antezana (Vertical Izquierda) -->
              <rect x="165" y="0" width="46" height="360" fill="#94A3B8"/>
              <text x="188" y="180" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#FFFFFF" text-anchor="middle" transform="rotate(-90 188 180)" letter-spacing="2">CALLE ANTEZANA</text>

              <!-- Calle 16 de Julio (Vertical Derecha) -->
              <rect x="700" y="0" width="46" height="360" fill="#94A3B8"/>
              <text x="723" y="180" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#FFFFFF" text-anchor="middle" transform="rotate(-90 723 180)" letter-spacing="2">CALLE 16 DE JULIO</text>

              <!-- Pin Clínico en la Puerta del Centro PSI Aprende -->
              <circle cx="490" cy="198" r="14" fill="#584294" opacity="0.3"/>
              <circle cx="490" cy="198" r="9" fill="#584294"/>
              <circle cx="490" cy="198" r="4" fill="#FFFFFF"/>
            </svg>
          </div>
        </div>

        <!-- GALERÍA DE FOTOGRAFÍAS REFERENCIALES (FACHADA E INTERIORES) -->
        <div style="margin-bottom: 2.25rem;">
          <div style="margin-bottom: 1.25rem;">
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.eye(13, 'var(--soft-purple-primary)')}
                <span>Galería Referencial</span>
              </span>
            </div>
            <h2 class="soft-section-title" style="font-size: 1.45rem; margin-bottom: 0.35rem;">
              Reconoce el Centro antes de tu Visita
            </h2>
            <p class="soft-section-subtitle" style="margin: 0;">
              Haz clic en cualquier imagen para ampliarla en alta resolución y orientarte con precisión al llegar al edificio y a nuestros consultorios.
            </p>
          </div>

          <div class="soft-rooms-grid" style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 1.4rem;">
            ${photos.map(p => `
              <div 
                class="soft-room-card photo-card-clickable" 
                data-id="${p.id}"
                data-title="${this.escapeHtml(p.title)}"
                data-subtitle="${this.escapeHtml(p.subtitle)}"
                data-desc="${this.escapeHtml(p.desc)}"
                data-img="${p.imageUrl}"
                style="padding: 1.15rem; cursor: pointer; transition: transform 0.22s ease, box-shadow 0.22s ease; border-radius: 18px;"
                title="Toca para ampliar fotografía"
              >
                <!-- Contenedor Imagen con Overlay sutil -->
                <div style="position: relative; width: 100%; height: 195px; border-radius: 14px; overflow: hidden; background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); margin-bottom: 1rem;">
                  <img 
                    src="${p.imageUrl}" 
                    alt="${this.escapeHtml(p.title)}" 
                    style="width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease;"
                  />
                  <div style="position: absolute; top: 0.65rem; left: 0.65rem;">
                    <span class="soft-badge soft-badge-lavender" style="font-size: 0.68rem; font-weight: 700; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
                      ${this.escapeHtml(p.tag)}
                    </span>
                  </div>
                  <div style="position: absolute; bottom: 0.65rem; right: 0.65rem; background: rgba(36, 40, 91, 0.72); backdrop-filter: blur(4px); color: #FFFFFF; border-radius: 8px; padding: 0.3rem 0.55rem; font-size: 0.72rem; display: flex; align-items: center; gap: 0.35rem;">
                    ${Icons.eye(13, '#FFFFFF')}
                    <span>Ampliar</span>
                  </div>
                </div>

                <!-- Título y Descripción -->
                <h3 style="font-size: 1.08rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.25rem 0; line-height: 1.3;">
                  ${this.escapeHtml(p.title)}
                </h3>
                <div style="font-size: 0.8rem; font-weight: 600; color: var(--soft-purple-primary); margin-bottom: 0.55rem;">
                  ${this.escapeHtml(p.subtitle)}
                </div>
                <p style="font-size: 0.84rem; color: var(--soft-text-body); line-height: 1.5; margin: 0;">
                  ${this.escapeHtml(p.desc)}
                </p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- GUÍA DE LLEGADA, TRANSPORTE & ACCESIBILIDAD -->
        <div class="soft-card-static" style="padding: 1.6rem 1.85rem;">
          <div style="margin-bottom: 1.25rem;">
            <span class="soft-badge soft-badge-mint" style="font-size: 0.72rem;">Indicaciones Prácticas</span>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--soft-text-title); margin: 0.35rem 0 0 0;">
              ¿Cómo Llegar al Centro?
            </h3>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1.25rem;">
            
            <!-- Transporte Público -->
            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 1.2rem 1.35rem;">
              <div style="display: flex; align-items: center; gap: 0.55rem; margin-bottom: 0.65rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.rooms(16, 'var(--soft-purple-primary)')}
                </div>
                <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: var(--soft-text-title);">
                  Líneas de Transporte
                </h4>
              </div>
              <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52; margin: 0;">
                Por la Calle Ladislao Cabrera, Calle Antezana y Calle 16 de Julio transitan múltiples líneas de trufis y micros de Cochabamba. Descender sobre la calle Ladislao Cabrera entre Antezana y 16 de Julio.
              </p>
            </div>

            <!-- Puntos de Referencia -->
            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 1.2rem 1.35rem;">
              <div style="display: flex; align-items: center; gap: 0.55rem; margin-bottom: 0.65rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                  ${Icons.mapPin(16, 'var(--soft-mint-deep)')}
                </div>
                <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: var(--soft-text-title);">
                  Puntos de Referencia
                </h4>
              </div>
              <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52; margin: 0;">
                Ubicado en ${this.escapeHtml(address)}, a pasos de comercios, farmacias y centros de salud.
              </p>
            </div>

            <!-- Accesibilidad en el Edificio -->
            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 1.2rem 1.35rem;">
              <div style="display: flex; align-items: center; gap: 0.55rem; margin-bottom: 0.65rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-indigo">
                  ${Icons.check(16, 'var(--soft-indigo-accent)')}
                </div>
                <h4 style="margin: 0; font-size: 0.98rem; font-weight: 800; color: var(--soft-text-title);">
                  Accesibilidad &amp; Seguridad
                </h4>
              </div>
              <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52; margin: 0;">
                Ambientes en planta accesible y cómoda, con pasillos y puertas amplias adaptadas para coches de niños y personas con movilidad reducida.
              </p>
            </div>

          </div>
        </div>

      </div>
    `;

    this.attachEvents(address);
  }

  attachEvents(address) {
    // Botón copiar dirección
    const copyBtn = document.getElementById('btn-copy-address');
    copyBtn?.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(address);
        } else {
          // Fallback para navegadores antiguos
          const input = document.createElement('textarea');
          input.value = address;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
        }
        Toast.success('Dirección copiada al portapapeles.');
      } catch (e) {
        Toast.error('No se pudo copiar automáticamente. Por favor selecciónela manualmente.');
      }
    });

    // Botón copiar coordenadas GPS
    const copyCoordsBtn = document.getElementById('btn-copy-coords');
    copyCoordsBtn?.addEventListener('click', async () => {
      const coords = '-17.396611, -66.150722';
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(coords);
        } else {
          const input = document.createElement('textarea');
          input.value = coords;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
        }
        Toast.success('Coordenadas GPS: -17.396611, -66.150722 copiadas al portapapeles.');
      } catch (e) {
        Toast.info('Coordenadas GPS: -17.396611, -66.150722');
      }
    });

    // Alternar entre Mapa Interactivo y Croquis Esquemático
    const btnMapLive = document.getElementById('btn-view-map-live');
    const btnMapSchema = document.getElementById('btn-view-map-schema');
    const containerMapLive = document.getElementById('container-map-live');
    const containerMapSchema = document.getElementById('container-map-schema');

    if (btnMapLive && btnMapSchema && containerMapLive && containerMapSchema) {
      btnMapLive.addEventListener('click', () => {
        containerMapLive.style.display = 'block';
        containerMapSchema.style.display = 'none';
        btnMapLive.style.background = '#FFFFFF';
        btnMapLive.style.color = 'var(--soft-purple-primary)';
        btnMapLive.style.boxShadow = '0 2px 6px rgba(88,66,148,0.12)';
        btnMapLive.style.fontWeight = '700';

        btnMapSchema.style.background = 'transparent';
        btnMapSchema.style.color = 'var(--soft-text-body)';
        btnMapSchema.style.boxShadow = 'none';
        btnMapSchema.style.fontWeight = '600';
      });

      btnMapSchema.addEventListener('click', () => {
        containerMapLive.style.display = 'none';
        containerMapSchema.style.display = 'block';
        btnMapSchema.style.background = '#FFFFFF';
        btnMapSchema.style.color = 'var(--soft-purple-primary)';
        btnMapSchema.style.boxShadow = '0 2px 6px rgba(88,66,148,0.12)';
        btnMapSchema.style.fontWeight = '700';

        btnMapLive.style.background = 'transparent';
        btnMapLive.style.color = 'var(--soft-text-body)';
        btnMapLive.style.boxShadow = 'none';
        btnMapLive.style.fontWeight = '600';
      });
    }

    // Clic en tarjetas de fotografía para abrir Lightbox
    const cards = this.container.querySelectorAll('.photo-card-clickable');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const title = card.getAttribute('data-title');
        const subtitle = card.getAttribute('data-subtitle');
        const desc = card.getAttribute('data-desc');
        const img = card.getAttribute('data-img');

        ImageLightboxModal.show({
          imageUrl: img,
          title: title,
          subtitle: subtitle,
          description: desc
        });
      });
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/[()]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
