import { store } from './store.js';
import { Router } from './router.js';
import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { NotificationCenter } from './components/NotificationCenter.js';
import { apiClient } from './api/apiClient.js';
import { Icons } from './components/Icons.js';

// Vistas
import { HomeView } from './views/public/HomeView.js';
import { LoginView } from './views/public/LoginView.js';
import { DashboardView } from './views/admin/DashboardView.js';
import { RoomsView, RoomsAndConfigView } from './views/admin/RoomsAndConfigView.js';
import { SettingsView } from './views/admin/SettingsView.js';
import { PatientsView } from './views/admin/PatientsView.js';
import { TherapistsView } from './views/admin/TherapistsView.js';
import { TutorTherapistsView } from './views/tutor/TutorTherapistsView.js';
import { TutorDocumentsView } from './views/tutor/TutorDocumentsView.js';
import { TutorPaymentsView } from './views/tutor/TutorPaymentsView.js';
import { UsersView } from './views/admin/UsersView.js';
import { ProfileView } from './views/ProfileView.js';
import { ClinicalRecordsView } from './views/clinical/ClinicalRecordsView.js';
import { ClinicalGlossaryView } from './views/clinical/ClinicalGlossaryView.js';
import { AppointmentsView } from './views/admin/AppointmentsView.js';
import { WhatsAppSessionsView } from './views/admin/WhatsAppSessionsView.js';
import { CashRegisterView } from './views/admin/CashRegisterView.js';
import { BatteryInventoryView } from './views/admin/BatteryInventoryView.js';
import { TutorConveniosView } from './views/tutor/TutorConveniosView.js';
import { AdminConveniosView } from './views/admin/AdminConveniosView.js';
import { TutorLocationView } from './views/tutor/TutorLocationView.js';
import { TutorAboutUsView } from './views/tutor/TutorAboutUsView.js';
import { TutorSpecialtiesCatalogView } from './views/tutor/TutorSpecialtiesCatalogView.js';
import { TutorWorkshopsView } from './views/tutor/TutorWorkshopsView.js';
import { AdminWorkshopsView } from './views/admin/AdminWorkshopsView.js';
import { ClinicalMaterialsView } from './views/clinical/ClinicalMaterialsView.js';
import { ReportsAnalyticsView } from './views/admin/ReportsAnalyticsView.js';
import { FloatingAiBot } from './components/FloatingAiBot.js';

class App {
  constructor() {
    this.appElement = document.getElementById('app');
    this.router = null;
    this._lastShellSignature = null;
  }

  init() {
    // 1. Cargar configuración institucional dinámica (Sede, Nombre, Teléfono)
    this.loadPublicConfig();

    // 2. Renderizar estructura inicial del Shell SPA
    this.renderShell();

    // 2. Configurar rutas del sistema (incluyendo Deep Links para navegación asistida por IA)
    const routes = [
      { path: '/', view: HomeView, requireAuth: false },
      { path: '/login', view: LoginView, requireAuth: false },
      { path: '/register', view: LoginView, requireAuth: false },
      { path: '/dashboard', view: DashboardView, requireAuth: true },
      { path: '/appointments', view: AppointmentsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION', 'TUTOR'] },
      { path: '/agenda', view: AppointmentsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION', 'TUTOR'] },
      { path: '/appointments/new', view: AppointmentsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/whatsapp', view: WhatsAppSessionsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/admin/whatsapp', view: WhatsAppSessionsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/portal/therapists', view: TutorTherapistsView, requireAuth: true, allowedRoles: ['TUTOR', 'ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/portal/documents', view: TutorDocumentsView, requireAuth: true, allowedRoles: ['TUTOR', 'ADMIN', 'RECEPCION'] },
      { path: '/documents', view: TutorDocumentsView, requireAuth: true, allowedRoles: ['TUTOR', 'ADMIN', 'RECEPCION'] },
      { path: '/patients', view: PatientsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/patients/new', view: PatientsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/patients/archived', view: PatientsView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/patients/assigned', view: PatientsView, requireAuth: true, allowedRoles: ['TERAPEUTA'] },
      { path: '/clinical-records', view: ClinicalRecordsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/clinical', view: ClinicalRecordsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/soap', view: ClinicalRecordsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/clinical/glossary', view: ClinicalGlossaryView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/glossary', view: ClinicalGlossaryView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/therapists', view: TherapistsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/admin/rooms', view: RoomsView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/rooms', view: RoomsView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/admin/settings', view: SettingsView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/settings', view: SettingsView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/admin/config', view: SettingsView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/config', view: SettingsView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/admin/users', view: UsersView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/admin/users/inactive', view: UsersView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/admin/users/tutors', view: UsersView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/admin/users/new', view: UsersView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/users', view: UsersView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/admin/audit', view: UsersView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/audit', view: UsersView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/caja', view: CashRegisterView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/pagos', view: CashRegisterView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/portal/pagos', view: TutorPaymentsView, requireAuth: true, allowedRoles: ['TUTOR', 'ADMIN', 'RECEPCION'] },
      { path: '/baterias', view: BatteryInventoryView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/inventario', view: BatteryInventoryView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/portal/convenios', view: TutorConveniosView, requireAuth: false },
      { path: '/convenios', view: TutorConveniosView, requireAuth: false },
      { path: '/admin/convenios', view: AdminConveniosView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/portal/ubicacion', view: TutorLocationView, requireAuth: false },
      { path: '/ubicacion', view: TutorLocationView, requireAuth: false },
      { path: '/portal/nosotros', view: TutorAboutUsView, requireAuth: false },
      { path: '/nosotros', view: TutorAboutUsView, requireAuth: false },
      { path: '/portal/especialidades', view: TutorSpecialtiesCatalogView, requireAuth: false },
      { path: '/especialidades', view: TutorSpecialtiesCatalogView, requireAuth: false },
      { path: '/portal/talleres', view: TutorWorkshopsView, requireAuth: false },
      { path: '/talleres', view: TutorWorkshopsView, requireAuth: false },
      { path: '/admin/talleres', view: AdminWorkshopsView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/admin/workshops', view: AdminWorkshopsView, requireAuth: true, allowedRoles: ['ADMIN'] },
      { path: '/materiales', view: ClinicalMaterialsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/recursos', view: ClinicalMaterialsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA', 'RECEPCION'] },
      { path: '/reportes', view: ReportsAnalyticsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA'] },
      { path: '/reports', view: ReportsAnalyticsView, requireAuth: true, allowedRoles: ['ADMIN', 'TERAPEUTA'] },
      { path: '/profile', view: ProfileView, requireAuth: true },
      { path: '*', view: HomeView }
    ];

    const mainContainer = document.getElementById('main-view');
    this.router = new Router(routes);
    window.router = this.router;
    this.router.init(mainContainer);

    // 3. Suscribirse a cambios de estado y rutas para actualizar Navbar y Sidebar en tiempo real
    store.subscribe(() => {
      this.updateNavigation();
    });
    window.addEventListener('hashchange', () => {
      this.updateNavigation();
    });

    // Revalidar sesión al restaurar desde caché del navegador (botón Atrás / BFCache)
    window.addEventListener('pageshow', (event) => {
      const wasAuthenticatedBefore = Boolean(store.getState().token);
      const isAuthenticatedNow = store.isAuthenticated();
      if (event.persisted || (wasAuthenticatedBefore && !isAuthenticatedNow)) {
        this.updateNavigation();
        this.router?.handleRoute();
      }
    });

    // Sincronizar cierre/cambio de sesión entre pestañas del mismo navegador
    window.addEventListener('storage', (event) => {
      if (event.key === 'psi_token' || event.key === 'psi_user') {
        store.syncFromStorage();
        this.router?.handleRoute();
      }
    });

    // 4. Registro del Service Worker PWA
    this.registerServiceWorker();

    // 5. Soporte de instalación PWA
    this.setupInstallPrompt();

    // 6. Inicializar Asistente MindBot IA en Botón Flotante (FAB - Módulo D)
    const mindBot = new FloatingAiBot();
    mindBot.init();

    // 7. Guardas globales de teclado y entrada numérica en formularios (evita negativos o letras en campos numéricos/teléfono)
    this.setupGlobalInputSanitizers();

    console.log('[PSI Aprende PWA] Aplicación inicializada con diseño institucional profesional.');
  }

  setupGlobalInputSanitizers() {
    document.addEventListener('keydown', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type === 'number') {
        const minAttr = target.getAttribute('min');
        const allowsNegative = minAttr !== null && Number(minAttr) < 0;
        if (!allowsNegative && (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E')) {
          e.preventDefault();
        }
      }
    });

    document.addEventListener('input', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;

      if (target.type === 'number') {
        const minAttr = target.getAttribute('min');
        const allowsNegative = minAttr !== null && Number(minAttr) < 0;
        if (!allowsNegative && target.value && Number(target.value) < 0) {
          target.value = String(Math.abs(Number(target.value)));
        }
        return;
      }

      const phoneIds = ['new-tutor-whatsapp', 'new-tutor-inline-whatsapp', 'inst-telefono', 'inst-whatsapp', 'new-user-phone'];
      if (target.type === 'tel' || phoneIds.includes(target.id)) {
        const cleaned = target.value.replace(/[^\d+\-\s()]/g, '');
        if (cleaned !== target.value) {
          target.value = cleaned;
        }
        return;
      }

      const ciIds = ['form-ci-num', 'new-tutor-ci', 'new-tutor-inline-ci'];
      if (ciIds.includes(target.id)) {
        const cleaned = target.value.replace(/[^0-9A-Za-z\-\s]/g, '');
        if (cleaned !== target.value) {
          target.value = cleaned;
        }
      }
    });
  }

  renderShell() {
    this.appElement.innerHTML = `
      <div id="navbar-container"></div>
      
      <div class="app-container">
        <div id="sidebar-container"></div>
        <div class="main-wrapper">
          <main id="main-view" class="main-content"></main>
          <footer id="app-footer" class="footer"></footer>
        </div>
      </div>
    `;

    this.updateNavigation();
  }

  updateNavigation() {
    const navbarContainer = document.getElementById('navbar-container');
    const sidebarContainer = document.getElementById('sidebar-container');
    const isAuth = store.isAuthenticated();
    const user = store.getState().user;
    const publicConfig = store.getState().publicConfig;
    const showSidebar = Boolean(isAuth && user);

    if (this.appElement) {
      this.appElement.classList.toggle('tutor-mode', user?.rol === 'TUTOR');
      this.appElement.classList.toggle('has-sidebar', showSidebar);
    }

    const shellSignature = JSON.stringify({
      isAuth,
      id: user?.id || null,
      rol: user?.rol || null,
      nombre: user?.nombre_completo || null,
      centro: publicConfig?.NOMBRE_CENTRO || null
    });

    if (shellSignature === this._lastShellSignature) {
      const currentHash = window.location.hash || '#/';
      Navbar.updateActiveLink(currentHash);
      Sidebar.updateActiveLink(currentHash);
      return;
    }

    this._lastShellSignature = shellSignature;

    if (!isAuth) {
      NotificationCenter.cleanup();
    }

    if (navbarContainer) {
      navbarContainer.innerHTML = Navbar.render();
      Navbar.attachEvents();
    }

    if (sidebarContainer) {
      sidebarContainer.innerHTML = Sidebar.render();
      Sidebar.attachEvents();
    }

    const footer = document.getElementById('app-footer');
    if (footer && !footer.hasChildNodes()) {
      this.renderFooter();
    } else if (!footer || footer.innerHTML.trim() === '') {
      this.renderFooter();
    }
  }

  renderFooter() {
    const footer = document.getElementById('app-footer');
    if (!footer) return;

    footer.innerHTML = `
      <div class="footer-legal-text">
        &copy; 2026 PSI Aprende · Todos los derechos reservados · Cochabamba, Bolivia
      </div>
    `;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      const doRegister = () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('[ServiceWorker] Registrado con alcance:', registration.scope);
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[ServiceWorker] Nueva versión de la plataforma instalada y lista.');
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.warn('[ServiceWorker] Error al registrar:', error);
          });
      };

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        doRegister();
      } else {
        window.addEventListener('load', doRegister);
      }
    }
  }

  async loadPublicConfig() {
    try {
      const res = await apiClient.get('/config/public');
      if (res && res.data) {
        store.setPublicConfig(res.data);
      }
    } catch (err) {
      console.warn('[App] Configuración institucional no cargada:', err.message);
    }
  }

  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
      const installBtn = document.getElementById('btn-install-pwa');
      if (installBtn) {
        installBtn.style.display = 'inline-flex';
      }
    });

    window.addEventListener('appinstalled', () => {
      window.deferredPrompt = null;
      const installBtn = document.getElementById('btn-install-pwa');
      if (installBtn) {
        installBtn.style.display = 'none';
      }
      const homeInstallCard = document.getElementById('home-mobile-install-card');
      if (homeInstallCard) {
        homeInstallCard.style.setProperty('display', 'none', 'important');
      }
      console.log('[PWA] Aplicación PSI Aprende instalada con éxito.');
    });
  }
}

// Inicializar la aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
