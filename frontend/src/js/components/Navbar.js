import { store } from '../store.js';
import { Icons } from './Icons.js';
import { NotificationCenter } from './NotificationCenter.js';
import { Toast } from './Toast.js';
import { escapeHtml } from '../utils/sanitize.js';

export class Navbar {
  static render() {
    const isAuth = store.isAuthenticated();
    const user = store.getState().user;
    const currentHash = window.location.hash || '#/';

    let authSection = `
      <a href="#/login" class="btn-access-portal" title="Acceso al Portal Clínico">
        ${Icons.lock(15, '#FFFFFF')}
        <span class="btn-access-text">Acceso Clínico</span>
      </a>
    `;

    if (isAuth && user) {
      let roleBadgeClass = 'badge-purple';
      if (user.rol === 'ADMIN') roleBadgeClass = 'badge-purple';
      if (user.rol === 'TERAPEUTA') roleBadgeClass = 'badge-turquoise';
      if (user.rol === 'TUTOR') roleBadgeClass = 'badge-coral';

      const initials = (user.nombre_completo || 'U')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(n => n[0].toUpperCase())
        .join('');

      const avatarPhoto = user.foto_url || user.terapeuta?.foto_url || null;
      const safeAvatarPhoto = avatarPhoto && /^https?:\/\//i.test(avatarPhoto) ? avatarPhoto : null;

      authSection = `
        <div class="navbar-user-pill" style="display: flex; align-items: center; gap: 0.65rem;">
          ${NotificationCenter.renderButton()}
          <a href="#/profile" class="navbar-user-btn hover-glow-purple" title="Mi Perfil Institucional y Opciones de Seguridad">
            <div class="navbar-user-avatar-mini" style="overflow: hidden;">
              ${safeAvatarPhoto
                ? `<img src="${escapeHtml(safeAvatarPhoto)}" alt="${escapeHtml(initials)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;" />`
                : initials}
            </div>
            <div class="navbar-user-text" style="text-align: left; line-height: 1.15;">
              <div class="navbar-user-name" style="font-weight: 700; font-size: 0.84rem; color: var(--soft-indigo-heading, #24285B); white-space: nowrap;">${escapeHtml(user.nombre_completo)}</div>
              <span class="badge ${roleBadgeClass}" style="font-size: 0.64rem; padding: 0.1rem 0.45rem; text-transform: uppercase;">
                ${escapeHtml(user.rol)}
              </span>
            </div>
          </a>
          <button id="btn-logout" class="btn-logout" title="Cerrar Sesión">
            ${Icons.logout(15, 'currentColor')}
            <span class="btn-logout-label">Salir</span>
          </button>
        </div>
      `;
    }

    return `
      <header class="navbar">
        <div class="navbar-left">
          ${isAuth ? `
            <button id="btn-toggle-sidebar" class="btn-burger" title="Alternar menú de navegación" aria-label="Alternar menú de navegación">
              ${Icons.menu(20)}
            </button>
          ` : `
            <button id="btn-toggle-public-menu" class="btn-burger btn-burger-public" title="Alternar menú institucional" aria-label="Alternar menú institucional">
              ${Icons.menu(20)}
            </button>
          `}

          <a href="${isAuth && user && ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(user.rol) ? '#/dashboard' : '#/'}" class="navbar-brand-link">
            <img src="/assets/isotype-brand.png" alt="PSI Aprende Isotipo" class="brand-logo-img" />
            <div class="brand-text-block">
              <span class="brand-title">PSI <span>APRENDE</span></span>
              <span class="brand-subtitle">Centro Psicopedagógico y de Atención Psicológica</span>
            </div>
          </a>
        </div>

        <nav class="navbar-menu">
          ${!isAuth ? `
            <a href="#/" class="nav-link nav-link-public-desktop ${currentHash === '#/' ? 'active' : ''}">Inicio</a>
            
            <div class="tutor-nav-dropdown-wrapper">
              <button 
                id="btn-public-menu" 
                type="button" 
                class="nav-link tutor-menu-trigger ${['#/especialidades', '#/talleres', '#/nosotros', '#/ubicacion', '#/convenios'].some(h => currentHash.startsWith(h)) ? 'active' : ''}" 
                aria-haspopup="true" 
                aria-expanded="false"
                title="Módulos y Servicios del Centro"
              >
                ${Icons.menu(18)}
                <span>Menú</span>
                ${Icons.chevronDown(13)}
              </button>

              <div id="public-dropdown-menu" class="tutor-dropdown-menu" style="display: none;">
                <div class="tutor-dropdown-inner">
                  <div class="tutor-dropdown-header">
                    <span class="tutor-dropdown-header-title">Portal Institucional</span>
                    <span class="tutor-dropdown-header-sub">Servicios e Información del Centro</span>
                  </div>

                  <div class="tutor-dropdown-list">
                    <a href="#/especialidades" class="tutor-dropdown-item ${currentHash.startsWith('#/especialidades') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--soft-purple-primary, #584294);">${Icons.stethoscope(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Catálogo de Especialidades</div>
                        <div class="tutor-dropdown-item-desc">Áreas de atención psicopedagógica y clínica</div>
                      </div>
                    </a>

                    <a href="#/talleres" class="tutor-dropdown-item ${currentHash.startsWith('#/talleres') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--soft-purple-primary, #584294);">${Icons.calendar(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Talleres &amp; Cursos</div>
                        <div class="tutor-dropdown-item-desc">Charlas grupales, formación continua y eventos</div>
                      </div>
                    </a>

                    <a href="#/nosotros" class="tutor-dropdown-item ${currentHash.startsWith('#/nosotros') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-teal, #5C8EA0);">${Icons.users(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Sobre Nosotros &amp; Equipo</div>
                        <div class="tutor-dropdown-item-desc">Misión institucional, valores y trayectoria clínica</div>
                      </div>
                    </a>

                    <a href="#/ubicacion" class="tutor-dropdown-item ${currentHash.startsWith('#/ubicacion') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--soft-mint-deep, #15968D);">${Icons.mapPin(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Ubicación &amp; Instalaciones</div>
                        <div class="tutor-dropdown-item-desc">Dirección, mapa interactivo, transporte y fotos</div>
                      </div>
                    </a>

                    <a href="#/convenios" class="tutor-dropdown-item ${currentHash.startsWith('#/convenios') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--soft-purple-primary, #584294);">${Icons.handshake(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Alianzas &amp; Convenios</div>
                        <div class="tutor-dropdown-item-desc">Colegios, instituciones aliadas y beneficios</div>
                      </div>
                    </a>

                    <a href="#/" class="tutor-dropdown-item tutor-dropdown-item-mobile-only ${currentHash === '#/' ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--soft-purple-primary, #584294);">${Icons.home(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Inicio Institucional</div>
                        <div class="tutor-dropdown-item-desc">Página principal y servicios generales</div>
                      </div>
                    </a>

                    <a href="#/login" class="tutor-dropdown-item tutor-dropdown-item-mobile-only ${currentHash === '#/login' ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="background: linear-gradient(135deg, #584294 0%, #745BB8 100%) !important; color: #FFFFFF !important;">${Icons.lock(20, '#FFFFFF')}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title" style="color: #584294; font-weight: 800;">Acceso Clínico &amp; Iniciar Sesión</div>
                        <div class="tutor-dropdown-item-desc">Portal para familias, terapeutas y administración</div>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          ${(isAuth && user?.rol === 'TUTOR') ? `
            <a href="#/" class="nav-link nav-link-tutor-desktop ${currentHash === '#/' ? 'active' : ''}">Inicio</a>
            
            <div class="tutor-nav-dropdown-wrapper">
              <button 
                id="btn-tutor-menu" 
                type="button" 
                class="nav-link tutor-menu-trigger ${['#/dashboard', '#/portal/therapists', '#/portal/documents', '#/documents', '#/profile', '#/portal/ubicacion', '#/portal/nosotros', '#/portal/especialidades', '#/portal/talleres', '#/talleres'].some(h => currentHash.startsWith(h)) ? 'active' : ''}" 
                aria-haspopup="true" 
                aria-expanded="false"
                title="Módulos y Servicios del Centro"
              >
                ${Icons.menu(18)}
                <span>Menú</span>
                ${Icons.chevronDown(13)}
              </button>

              <div id="tutor-dropdown-menu" class="tutor-dropdown-menu" style="display: none;">
                <div class="tutor-dropdown-inner">
                  <div class="tutor-dropdown-header">
                    <span class="tutor-dropdown-header-title">Portal Familiar</span>
                    <span class="tutor-dropdown-header-sub">Servicios y Módulos Institucionales</span>
                  </div>

                  <div class="tutor-dropdown-list">
                    <a href="#/dashboard" class="tutor-dropdown-item ${currentHash.startsWith('#/dashboard') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-purple-deep);">${Icons.dashboard(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Seguimiento Clínico</div>
                        <div class="tutor-dropdown-item-desc">Panel general, salas y estado</div>
                      </div>
                    </a>

                    <a href="#/portal/documents" class="tutor-dropdown-item ${currentHash.startsWith('#/portal/documents') || currentHash.startsWith('#/documents') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-purple-deep);">${Icons.fileText(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Documentos &amp; Consentimientos</div>
                        <div class="tutor-dropdown-item-desc">Actas legales, firmas y reportes</div>
                      </div>
                    </a>

                    <a href="#/portal/therapists" class="tutor-dropdown-item ${currentHash.startsWith('#/portal/therapists') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-teal);">${Icons.therapist(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Especialistas Acreditados</div>
                        <div class="tutor-dropdown-item-desc">Equipo médico y turnos</div>
                      </div>
                    </a>

                    <a href="#/portal/nosotros" class="tutor-dropdown-item ${currentHash.startsWith('#/portal/nosotros') || currentHash.startsWith('#/nosotros') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-teal);">${Icons.users(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Sobre Nosotros &amp; Equipo</div>
                        <div class="tutor-dropdown-item-desc">Misión, visión y trayectoria clínica</div>
                      </div>
                    </a>

                    <a href="#/portal/especialidades" class="tutor-dropdown-item ${currentHash.startsWith('#/portal/especialidades') || currentHash.startsWith('#/especialidades') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-purple-deep);">${Icons.stethoscope(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Catálogo de Especialidades</div>
                        <div class="tutor-dropdown-item-desc">Áreas médicas y cuándo consultar</div>
                      </div>
                    </a>

                    <a href="#/portal/talleres" class="tutor-dropdown-item ${currentHash.startsWith('#/portal/talleres') || currentHash.startsWith('#/talleres') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-purple-deep);">${Icons.calendar(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Talleres &amp; Webinars</div>
                        <div class="tutor-dropdown-item-desc">Charlas grupales, cursos y eventos</div>
                      </div>
                    </a>

                    <a href="#/portal/ubicacion" class="tutor-dropdown-item ${currentHash.startsWith('#/portal/ubicacion') || currentHash.startsWith('#/ubicacion') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-turquoise);">${Icons.mapPin(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Ubicación &amp; Instalaciones</div>
                        <div class="tutor-dropdown-item-desc">Dirección, mapa, transporte y fotos</div>
                      </div>
                    </a>

                    <a href="#/appointments" class="tutor-dropdown-item ${currentHash.startsWith('#/appointments') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-turquoise);">${Icons.calendar(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Mis Citas Agendadas</div>
                        <div class="tutor-dropdown-item-desc">Horarios, salas y asistencia</div>
                      </div>
                    </a>

                    <a href="#/portal/pagos" class="tutor-dropdown-item ${currentHash.startsWith('#/portal/pagos') || currentHash.startsWith('#/pagos') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-purple-deep);">${Icons.wallet(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Pagos &amp; Comprobantes QR</div>
                        <div class="tutor-dropdown-item-desc">Aranceles, QR oficial y recibos</div>
                      </div>
                    </a>

                    <a href="#/portal/convenios" class="tutor-dropdown-item ${currentHash.startsWith('#/portal/convenios') || currentHash.startsWith('#/convenios') ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-teal, #0D9488);">${Icons.handshake(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Alianzas &amp; Convenios</div>
                        <div class="tutor-dropdown-item-desc">Colegios, centros médicos y beneficios</div>
                      </div>
                    </a>

                    <a href="#/profile" class="tutor-dropdown-item ${currentHash === '#/profile' ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-coral);">${Icons.users(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Mi Perfil Familiar</div>
                        <div class="tutor-dropdown-item-desc">Datos de contacto y seguridad</div>
                      </div>
                    </a>

                    <a href="#/" class="tutor-dropdown-item tutor-dropdown-item-mobile-only ${currentHash === '#/' ? 'active' : ''}">
                      <span class="tutor-dropdown-item-icon" style="color: var(--brand-turquoise);">${Icons.home(20)}</span>
                      <div class="tutor-dropdown-item-text">
                        <div class="tutor-dropdown-item-title">Inicio Institucional</div>
                        <div class="tutor-dropdown-item-desc">Portal público del centro</div>
                      </div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          <button 
            type="button" 
            id="btn-install-pwa" 
            class="btn-install-pwa" 
            title="Instalar aplicación en su dispositivo"
            style="display: none;"
          >
            ${Icons.download(14, '#FFFFFF')}
            <span>Instalar App</span>
          </button>

          <div class="navbar-status-indicator" id="navbar-pwa-badge" title="Sistema en línea · Base de Datos Sincronizada (SQLite WAL)">
            <span class="pulse-indicator-green" id="navbar-pulse-dot"></span>
            <span id="navbar-status-text">En línea</span>
          </div>

          <div class="navbar-auth-slot">
            ${authSection}
          </div>
        </nav>
      </header>
    `;
  }

  static attachEvents() {
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Modal Soft UI de confirmación de cierre de sesión
        const existingModal = document.getElementById('modal-app-logout');
        if (existingModal) existingModal.remove();

        const modalDiv = document.createElement('div');
        modalDiv.id = 'modal-app-logout';
        modalDiv.className = 'modal-backdrop';
        modalDiv.style.cssText = 'display: flex; position: fixed; inset: 0; background: rgba(36, 40, 91, 0.45); backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center; padding: 1rem;';
        
        modalDiv.innerHTML = `
          <div class="soft-modal-card" style="max-width: 440px; width: 100%;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.logout(18, 'var(--soft-purple-primary)')}
                </div>
                <div>
                  <h3 style="color: var(--soft-text-title); font-size: 1.12rem; font-weight: 800; margin: 0;">
                    Cerrar Sesión Institucional
                  </h3>
                  <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.1rem;">
                    Portal Clínico PSI Aprende
                  </div>
                </div>
              </div>
              <button type="button" id="btn-close-app-logout-x" class="soft-modal-close-btn" title="Cerrar">
                ${Icons.close(18)}
              </button>
            </div>

            <div style="padding: 1.35rem 1.5rem;">
              <p style="font-size: 0.88rem; color: var(--soft-text-body); line-height: 1.5; margin: 0 0 1.25rem 0;">
                ¿Está seguro de que desea salir de su cuenta? Se cerrará su acceso de sesión hasta que vuelva a ingresar sus credenciales.
              </p>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-app-logout" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="button" id="btn-confirm-app-logout" class="soft-btn soft-btn-lvl-2">
                  ${Icons.logout(15, '#FFFFFF')}
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </div>
        `;

        document.body.appendChild(modalDiv);

        const closeModal = () => modalDiv.remove();
        document.getElementById('btn-close-app-logout-x')?.addEventListener('click', closeModal);
        document.getElementById('btn-cancel-app-logout')?.addEventListener('click', closeModal);
        
        document.getElementById('btn-confirm-app-logout')?.addEventListener('click', () => {
          modalDiv.remove();
          const mainView = document.getElementById('main-view');
          if (mainView) mainView.innerHTML = '';
          store.clearSession();
          if (window.router) {
            window.router.navigate('/login');
          } else {
            window.location.hash = '#/login';
          }
        });
      });
    }

    const setupMenuDropdown = (triggerIds, dropdownId) => {
      const ids = Array.isArray(triggerIds) ? triggerIds : [triggerIds];
      const triggers = ids.map(id => document.getElementById(id)).filter(Boolean);
      const dropdown = document.getElementById(dropdownId);
      if (triggers.length === 0 || !dropdown) return;

      const toggleMenu = (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display === 'block';
        dropdown.style.display = isOpen ? 'none' : 'block';
        triggers.forEach(t => {
          t.setAttribute('aria-expanded', !isOpen);
          t.classList.toggle('menu-open', !isOpen);
        });
      };

      triggers.forEach(t => t.addEventListener('click', toggleMenu));

      // Cerrar al hacer clic en cualquier opción del menú y forzar navegación si es la misma ruta
      dropdown.querySelectorAll('.tutor-dropdown-item').forEach(link => {
        link.addEventListener('click', (e) => {
          dropdown.style.display = 'none';
          triggers.forEach(t => {
            t.setAttribute('aria-expanded', 'false');
            t.classList.remove('menu-open');
          });

          const href = link.getAttribute('href');
          if (href && href.startsWith('#')) {
            const targetPath = href.slice(1);
            if (window.location.hash === href && window.router) {
              e.preventDefault();
              window.router.navigate(targetPath);
            }
          }
        });
      });

      // Cerrar al hacer clic fuera del menú
      document.addEventListener('click', (e) => {
        const clickedInsideTrigger = triggers.some(t => t.contains(e.target));
        if (!clickedInsideTrigger && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
          triggers.forEach(t => {
            t.setAttribute('aria-expanded', 'false');
            t.classList.remove('menu-open');
          });
        }
      });

      // Cerrar con Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dropdown.style.display === 'block') {
          dropdown.style.display = 'none';
          triggers.forEach(t => {
            t.setAttribute('aria-expanded', 'false');
            t.classList.remove('menu-open');
            t.focus();
          });
        }
      });
    };

    setupMenuDropdown('btn-tutor-menu', 'tutor-dropdown-menu');
    setupMenuDropdown(['btn-public-menu', 'btn-toggle-public-menu'], 'public-dropdown-menu');

    const toggleSidebarBtn = document.getElementById('btn-toggle-sidebar');
    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const app = document.getElementById('app');
        if (!app) return;

        // Si es pantalla móvil (< 900px)
        if (window.innerWidth <= 900) {
          app.classList.toggle('mobile-sidebar-open');
        } else {
          // Si es escritorio (> 900px), colapsar/expandir suavemente
          app.classList.toggle('sidebar-collapsed');
        }
      });
    }

    // Instalación PWA
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (!isStandalone) {
        installBtn.style.display = 'inline-flex';
      }

      installBtn.addEventListener('click', async () => {
        if (window.deferredPrompt) {
          window.deferredPrompt.prompt();
          const choice = await window.deferredPrompt.userChoice;
          if (choice && choice.outcome === 'accepted') {
            Toast.success('Aplicación PSI Aprende instalada con éxito.');
          }
          window.deferredPrompt = null;
          installBtn.style.display = 'none';
        } else {
          Toast.info('Para instalar la aplicación en su dispositivo, use el menú de su navegador (icono de tres puntos) y seleccione "Instalar PSI Aprende" o use el icono de instalación de la barra de direcciones.');
        }
      });
    }

    // Reactividad de estado de red PWA
    const updateNetworkBadge = () => {
      const badgeText = document.getElementById('navbar-status-text');
      const pulseDot = document.getElementById('navbar-pulse-dot');
      const badge = document.getElementById('navbar-pwa-badge');
      if (!badgeText || !pulseDot) return;

      if (navigator.onLine) {
        badgeText.textContent = 'En línea';
        pulseDot.className = 'pulse-indicator-green';
        if (badge) badge.title = 'Sistema en línea · Base de Datos Sincronizada (SQLite WAL)';
      } else {
        badgeText.textContent = 'Sin conexión';
        pulseDot.className = 'pulse-indicator-amber';
        if (badge) badge.title = 'Modo sin conexión · Datos protegidos localmente';
      }
    };

    window.addEventListener('online', updateNetworkBadge);
    window.addEventListener('offline', updateNetworkBadge);

    // Inicializar centro de notificaciones y alertas si el usuario está autenticado
    if (store.isAuthenticated()) {
      NotificationCenter.init();
    }
  }

  static updateActiveLink(currentHash = window.location.hash || '#/') {
    const cleanHash = currentHash.split('?')[0] || '#/';
    const items = document.querySelectorAll('#navbar-container .tutor-dropdown-item');
    items.forEach((el) => {
      const href = el.getAttribute('href') || '';
      const isExact = href === '#/profile' || href === '#/';
      const isActive = isExact ? cleanHash === href : (href && cleanHash.startsWith(href));
      el.classList.toggle('active', isActive);
    });
    document.querySelectorAll('#navbar-container .tutor-dropdown-menu.open').forEach((menu) => {
      menu.classList.remove('open');
    });
  }
}
