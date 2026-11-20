import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';

export class HomeView {
  constructor(container) {
    this.container = container;
  }

  async render() {
    let institutionName = 'Centro Psicopedagógico y de Atención Psicológica "PSI Aprende"';
    let address = 'Calle Ladislao Cabrera entre Calle Antezana y Calle 16 de Julio, Cochabamba, Bolivia';
    let phone = '+591 4 4521234';
    let horario = 'Lunes a Viernes: 08:30 a 12:30 y 14:30 a 18:30 · Sábados: 09:00 a 13:00';
    let directora = 'Mgr. Grisel Aguilar Apaza';

    try {
      const res = await apiClient.get('/config/public');
      if (res && res.data) {
        institutionName = res.data.INSTITUCION_NOMBRE || institutionName;
        address = res.data.INSTITUCION_DIRECCION || address;
        phone = res.data.INSTITUCION_TELEFONO || phone;
        horario = res.data.INSTITUCION_HORARIO || horario;
        directora = res.data.INSTITUCION_DIRECTORA || directora;
      }
    } catch (err) {
      console.warn('[HomeView] Usando configuración base para la portada');
    }

    document.body.classList.add('home-bg-active');

    this.container.innerHTML = `
      <div class="page-container panel-general" style="max-width: 1240px; margin: 0 auto; padding-bottom: 3.5rem;">
        
        <!-- HERO INSTITUCIONAL PRINCIPAL (CSS GPU ULTRA-LIGERO) -->
        <section class="soft-hero-surface" style="padding: 3rem 2.2rem 2.75rem 2.2rem; margin-bottom: 2rem; position: relative; overflow: hidden; border-radius: 28px; background: linear-gradient(135deg, #FFFFFF 0%, #F5F1FD 60%, #EDE6F9 100%); border: 1px solid var(--soft-border-card, #EDE8F5); box-shadow: 0 10px 32px rgba(88, 66, 148, 0.06);">
          
          <div style="position: relative; z-index: 2; display: flex; align-items: center; justify-content: space-between; gap: 2.5rem; flex-wrap: wrap;">
            
            <!-- Columna Izquierda: Mensaje y Acciones -->
            <div style="flex: 1 1 380px; min-width: min(100%, 280px);">
              
              <!-- Badges de Certificación Médica -->
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.15rem; flex-wrap: wrap;">
                <span class="soft-badge soft-badge-lavender" style="padding: 0.35rem 0.85rem; font-size: 0.77rem; font-weight: 700;">
                  ${Icons.shield(14, 'var(--soft-purple-primary)')}
                  <span>Sede Central · ${this.escapeHtml((address || 'Cochabamba').split(',')[0])}</span>
                </span>
                <span class="soft-badge soft-badge-emerald" style="padding: 0.35rem 0.85rem; font-size: 0.77rem; font-weight: 700;">
                  ${Icons.check(14, 'var(--soft-emerald-dark)')}
                  <span>100% Especialistas Colegiados CPB</span>
                </span>
              </div>

              <!-- Título Principal -->
              <h1 style="font-size: clamp(1.85rem, 3.8vw, 2.75rem); font-weight: 800; line-height: 1.16; color: var(--soft-text-title); margin: 0 0 1.15rem 0; letter-spacing: -0.028em;">
                Atención Clínica, Neurocognitiva &amp; Psicopedagógica Integral
              </h1>

              <!-- Subtítulo -->
              <p style="font-size: 1.02rem; color: var(--soft-text-body); line-height: 1.62; margin: 0 0 1.85rem 0; max-width: 660px;">
                Bajo la Dirección General de la <strong style="color: var(--soft-text-title);">${this.escapeHtml(directora)}</strong> en Cochabamba, Bolivia. Acompañamos a niños, adolescentes, adultos y personas de la tercera edad con protocolos basados en neurociencia y metodología personalizada.
              </p>

              <!-- Botones de Acción (Nivel 1 Soft UI) -->
              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
                <a href="#/login" class="soft-btn soft-btn-primary soft-btn-lvl-1" style="padding: 0.78rem 1.45rem; font-size: 0.92rem; display: inline-flex; align-items: center; gap: 0.45rem;">
                  ${Icons.lock(17, '#FFFFFF')}
                  <span>Acceso al Portal Clínico</span>
                </a>
                
                <a href="#/portal/ubicacion" class="soft-btn soft-btn-lvl-1-muted" style="padding: 0.78rem 1.35rem; font-size: 0.92rem; display: inline-flex; align-items: center; gap: 0.45rem;">
                  ${Icons.mapPin(17, 'currentColor')}
                  <span>¿Cómo Llegar? · Fotos &amp; Mapa</span>
                </a>

                <a href="#/portal/especialidades" class="soft-btn soft-btn-lvl-1-muted" style="padding: 0.78rem 1.35rem; font-size: 0.92rem; display: inline-flex; align-items: center; gap: 0.45rem;">
                  ${Icons.stethoscope(17, 'currentColor')}
                  <span>Catálogo de Especialidades</span>
                </a>
              </div>

              <!-- Sellos de Respaldo Real (Verdaderos y Éticos) -->
              <div style="display: flex; align-items: center; gap: 1.25rem; font-size: 0.8rem; color: var(--soft-text-muted); font-weight: 600; flex-wrap: wrap;">
                <span style="display: inline-flex; align-items: center; gap: 0.35rem;">
                  ${Icons.shield(13, 'var(--soft-purple-primary)')} Secreto Profesional Ley 3131
                </span>
                <span style="display: inline-flex; align-items: center; gap: 0.35rem;">
                  ${Icons.rooms(13, 'var(--soft-mint-deep)')} 3 Consultorios Equipados
                </span>
                <span style="display: inline-flex; align-items: center; gap: 0.35rem;">
                  ${Icons.check(13, 'var(--soft-indigo-accent)')} Evaluación con Baremos Validados
                </span>
              </div>

            </div>

            <!-- Columna Derecha: Tarjeta Institucional de Bienvenida -->
            <div style="flex: 0 1 350px; display: flex; justify-content: center; margin: 0 auto;">
              <div class="soft-card-static" style="background: #FFFFFF; border-radius: 24px; padding: 2rem 1.8rem; text-align: center; max-width: 350px; width: 100%; box-shadow: 0 14px 34px rgba(88,66,148,0.1); border: 1px solid var(--soft-border-card-inner);">
                
                <span class="soft-status-dot-green" title="Centro abierto y en atención" aria-hidden="true" style="top: 1.15rem; right: 1.15rem;"></span>
                
                <img src="/assets/logo-brand.png" alt="PSI Aprende Logo" style="max-width: 220px; width: 100%; height: auto; margin: 0.5rem auto 1.35rem auto; display: block;" />
                
                <div style="border-top: 1px solid var(--soft-divider); padding-top: 1.1rem; text-align: left;">
                  <div style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-purple-primary); margin-bottom: 0.25rem;">
                    Sede Institucional
                  </div>
                  <div style="font-size: 0.86rem; font-weight: 700; color: var(--soft-text-title); line-height: 1.35; margin-bottom: 0.3rem;">
                    Centro PSI Aprende
                  </div>
                  <div style="font-size: 0.78rem; color: var(--soft-text-body); line-height: 1.45;">
                    Calle Ladislao Cabrera e/ Antezana y 16 de Julio<br/>
                    Tel. <strong>${this.escapeHtml(phone)}</strong>
                  </div>
                </div>

                <div style="margin-top: 1.15rem; display: flex; gap: 0.5rem;">
                  <a href="#/portal/nosotros" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm" style="flex: 1; font-size: 0.78rem; text-align: center;">
                    Sobre Nosotros
                  </a>
                  <a href="#/portal/convenios" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm" style="flex: 1; font-size: 0.78rem; text-align: center;">
                    Convenios
                  </a>
                </div>

              </div>
            </div>

          </div>
        </section>

        <!-- SECCIÓN DE ACCESO RÁPIDO A LAS NUEVAS SECCIONES INSTITUCIONALES -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1.35rem; margin-bottom: 2.25rem;">
          
          <!-- Tarjeta 1: Ubicación & Galería -->
          <a href="#/portal/ubicacion" class="soft-card-static" style="padding: 1.55rem 1.65rem; text-decoration: none; color: inherit; display: flex; flex-direction: column; justify-content: space-between; border-radius: 20px; transition: transform 0.22s ease, box-shadow 0.22s ease; cursor: pointer;">
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <div class="soft-icon-box soft-icon-box-lavender" style="width: 44px; height: 44px; border-radius: 14px;">
                  ${Icons.mapPin(22, 'var(--soft-purple-primary)')}
                </div>
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.7rem; font-weight: 700;">GUÍA VISUAL</span>
              </div>
              <h3 style="font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.45rem 0;">
                Ubicación &amp; Instalaciones
              </h3>
              <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52; margin: 0;">
                Dirección exacta, croquis interactivo, líneas de transporte y fotografías de la fachada y consultorios.
              </p>
            </div>
            <div style="margin-top: 1.15rem; font-size: 0.82rem; font-weight: 700; color: var(--soft-purple-primary); display: inline-flex; align-items: center; gap: 0.35rem;">
              <span>Ver cómo llegar y fotos</span>
              ${Icons.chevronRight ? Icons.chevronRight(13) : '→'}
            </div>
          </a>

          <!-- Tarjeta 2: Equipo de Terapeutas -->
          <a href="#/portal/nosotros" class="soft-card-static" style="padding: 1.55rem 1.65rem; text-decoration: none; color: inherit; display: flex; flex-direction: column; justify-content: space-between; border-radius: 20px; transition: transform 0.22s ease, box-shadow 0.22s ease; cursor: pointer;">
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <div class="soft-icon-box soft-icon-box-mint" style="width: 44px; height: 44px; border-radius: 14px;">
                  ${Icons.users(22, 'var(--soft-mint-deep)')}
                </div>
                <span class="soft-badge soft-badge-mint" style="font-size: 0.7rem; font-weight: 700;">PROFESIONALES</span>
              </div>
              <h3 style="font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.45rem 0;">
                Sobre Nosotros &amp; Equipo
              </h3>
              <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52; margin: 0;">
                Misión, visión institucional y el directorio de terapeutas con sus matrículas CPB y logros académicos.
              </p>
            </div>
            <div style="margin-top: 1.15rem; font-size: 0.82rem; font-weight: 700; color: var(--soft-mint-deep); display: inline-flex; align-items: center; gap: 0.35rem;">
              <span>Conocer al equipo</span>
              ${Icons.chevronRight ? Icons.chevronRight(13) : '→'}
            </div>
          </a>

          <!-- Tarjeta 3: Catálogo Didáctico -->
          <a href="#/portal/especialidades" class="soft-card-static" style="padding: 1.55rem 1.65rem; text-decoration: none; color: inherit; display: flex; flex-direction: column; justify-content: space-between; border-radius: 20px; transition: transform 0.22s ease, box-shadow 0.22s ease; cursor: pointer;">
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <div class="soft-icon-box soft-icon-box-indigo" style="width: 44px; height: 44px; border-radius: 14px;">
                  ${Icons.stethoscope(22, 'var(--soft-indigo-accent)')}
                </div>
                <span class="soft-badge soft-badge-indigo" style="font-size: 0.7rem; font-weight: 700;">PARA FAMILIAS</span>
              </div>
              <h3 style="font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.45rem 0;">
                Catálogo de Especialidades
              </h3>
              <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52; margin: 0;">
                Explicación sencilla de cada área médica y señales claras para saber cuándo acudir por tu hijo o familiar.
              </p>
            </div>
            <div style="margin-top: 1.15rem; font-size: 0.82rem; font-weight: 700; color: var(--soft-indigo-accent); display: inline-flex; align-items: center; gap: 0.35rem;">
              <span>Explorar especialidades</span>
              ${Icons.chevronRight ? Icons.chevronRight(13) : '→'}
            </div>
          </a>

          <!-- Tarjeta 4: Talleres & Webinars -->
          <a href="#/portal/talleres" class="soft-card-static" style="padding: 1.55rem 1.65rem; text-decoration: none; color: inherit; display: flex; flex-direction: column; justify-content: space-between; border-radius: 20px; transition: transform 0.22s ease, box-shadow 0.22s ease; cursor: pointer;">
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <div class="soft-icon-box soft-icon-box-lavender" style="width: 44px; height: 44px; border-radius: 14px;">
                  ${Icons.calendar(22, 'var(--soft-purple-primary)')}
                </div>
                <span class="soft-badge soft-badge-mint" style="font-size: 0.7rem; font-weight: 700;">COMUNIDAD</span>
              </div>
              <h3 style="font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.45rem 0;">
                Talleres &amp; Cursos
              </h3>
              <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52; margin: 0;">
                Charlas prácticas para padres, webinars escolares y círculos de estimulación con aranceles accesibles y cupos limitados.
              </p>
            </div>
            <div style="margin-top: 1.15rem; font-size: 0.82rem; font-weight: 700; color: var(--soft-purple-primary); display: inline-flex; align-items: center; gap: 0.35rem;">
              <span>Explorar cartelera</span>
              ${Icons.chevronRight ? Icons.chevronRight(13) : '→'}
            </div>
          </a>

        </div>

        <!-- LAS 4 ÁREAS DE ATENCIÓN CLÍNICA DESTACADAS -->
        <div class="soft-card-static" style="padding: 2rem 2.2rem; margin-bottom: 2rem; border-radius: 24px;">
          <div style="text-align: center; margin-bottom: 1.85rem;">
            <span class="soft-badge soft-badge-mint" style="font-size: 0.72rem; margin-bottom: 0.45rem;">Servicios Acreditados</span>
            <h2 class="soft-section-title" style="font-size: 1.55rem; margin-bottom: 0.35rem;">
              Áreas de Intervención Especializada
            </h2>
            <p class="soft-section-subtitle" style="max-width: 620px; margin: 0 auto;">
              Tratamientos individualizados formulados a partir de evaluaciones objetivas y metodología SOAP
            </p>
          </div>

          <div class="soft-quick-grid" style="margin-bottom: 0;">
            
            <!-- Área 1 -->
            <div class="soft-room-card soft-room-mint" style="border-radius: 18px; padding: 1.45rem;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                  <div class="soft-icon-box soft-icon-box-mint">
                    ${Icons.brain(22, 'var(--soft-mint-deep)')}
                  </div>
                  <span class="soft-badge soft-badge-mint">Infantil &amp; Juvenil</span>
                </div>
                <h3 style="font-size: 1.12rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.45rem 0;">
                  Neuropsicología &amp; Psicopedagogía
                </h3>
                <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52; margin: 0;">
                  Diagnóstico e intervención en TDAH, Autismo TEA, dislexia, discalculia y estimulación de funciones ejecutivas escolares.
                </p>
              </div>
            </div>

            <!-- Área 2 -->
            <div class="soft-room-card" style="border-radius: 18px; padding: 1.45rem;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                  <div class="soft-icon-box soft-icon-box-lavender">
                    ${Icons.users(22, 'var(--soft-purple-primary)')}
                  </div>
                  <span class="soft-badge soft-badge-lavender">Adulto Mayor</span>
                </div>
                <h3 style="font-size: 1.12rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.45rem 0;">
                  Psicogerontología &amp; Memoria
                </h3>
                <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52; margin: 0;">
                  Programa <em>Horizontes Plateados</em>, evaluación VGI, gimnasia cerebral y preservación de la autonomía en el adulto mayor.
                </p>
              </div>
            </div>

            <!-- Área 3 -->
            <div class="soft-room-card soft-room-mint" style="border-radius: 18px; padding: 1.45rem;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                  <div class="soft-icon-box soft-icon-box-mint">
                    ${Icons.pulse(22, 'var(--soft-mint-deep)')}
                  </div>
                  <span class="soft-badge soft-badge-emerald">Psicología Clínica</span>
                </div>
                <h3 style="font-size: 1.12rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.45rem 0;">
                  Psicoterapia &amp; Apoyo Familiar
                </h3>
                <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52; margin: 0;">
                  Modificación de conducta en adolescentes, psicoterapia individual, regulación de la ansiedad y orientación para padres.
                </p>
              </div>
            </div>

            <!-- Área 4 -->
            <div class="soft-room-card" style="border-radius: 18px; padding: 1.45rem;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                  <div class="soft-icon-box soft-icon-box-indigo">
                    ${Icons.handshake(22, 'var(--soft-indigo-accent)')}
                  </div>
                  <span class="soft-badge soft-badge-indigo">Articulación</span>
                </div>
                <h3 style="font-size: 1.12rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.45rem 0;">
                  Convenios Escolares &amp; Médicos
                </h3>
                <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52; margin: 0;">
                  Alianzas con unidades educativas y centros de salud de Cochabamba para adaptaciones curriculares y beneficios exclusivos.
                </p>
              </div>
            </div>

          </div>
        </div>

        <!-- FOOTER / BANNER DE CONTACTO RÁPIDO -->
        <div class="soft-quick-card soft-quick-card-lavender" style="padding: 1.75rem 2.1rem; justify-content: space-between; flex-wrap: wrap; gap: 1.5rem; cursor: default; border-radius: 22px;">
          <div style="display: flex; align-items: center; gap: 1.25rem; flex: 1 1 340px; min-width: 0;">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="width: 52px; height: 52px; border-radius: 16px;">
              ${Icons.mapPin(26, 'var(--soft-purple-primary)')}
            </div>
            <div style="min-width: 0;">
              <div class="soft-kpi-overline" style="color: var(--soft-purple-primary); font-size: 0.76rem;">
                SEDE CENTRAL COCHABAMBA
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title); margin: 0.15rem 0 0.35rem 0; line-height: 1.35;">
                ${this.escapeHtml(address)}
              </h3>
              <div style="font-size: 0.85rem; color: var(--soft-text-body);">
                Teléfono: <strong style="color: var(--soft-text-title);">${this.escapeHtml(phone)}</strong> · Atención Previa Cita
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
            <a href="#/portal/ubicacion" class="soft-btn soft-btn-lvl-1-muted" style="padding: 0.72rem 1.25rem; font-size: 0.88rem;">
              Ver Cómo Llegar
            </a>
            <a href="#/login" class="soft-btn soft-btn-lvl-1" style="padding: 0.72rem 1.4rem; font-size: 0.88rem;">
              Ingresar al Portal
            </a>
          </div>
        </div>

      </div>
    `;
  }

  unmount() {
    document.body.classList.remove('home-bg-active');
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

  _escapeHtml(str) {
    return this.escapeHtml(str);
  }
}
