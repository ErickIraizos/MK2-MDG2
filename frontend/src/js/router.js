import { store } from './store.js';
import { Toast } from './components/Toast.js';

export class Router {
  constructor(routes = []) {
    this.routes = routes;
    this.currentView = null;
    this.container = null;
  }

  init(containerElement) {
    this.container = containerElement;
    window.router = this;
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  getCurrentPath() {
    const hash = window.location.hash.slice(1);
    return hash.split('?')[0] || '/';
  }

  navigate(path) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const targetHash = `#${path.startsWith('/') ? path : `/${path}`}`;
    if (window.location.hash === targetHash) {
      this.handleRoute();
    } else {
      window.location.hash = targetHash;
    }
  }

  async handleRoute() {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    const path = this.getCurrentPath();
    const route = this.routes.find(r => r.path === path) || this.routes.find(r => r.path === '*');

    if (!route) {
      console.warn(`[Router] No route match for: ${path}`);
      return;
    }

    // Redirección para personal del centro: su vista principal es el Dashboard, no el Inicio público
    if (path === '/' && store.isAuthenticated() && ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(store.getUserRole())) {
      this.navigate('/dashboard');
      return;
    }

    // Redirección adaptativa para Tutores hacia su directorio y portal específico
    if (path === '/therapists' && store.getUserRole() === 'TUTOR') {
      this.navigate('/portal/therapists');
      return;
    }

    if ((path === '/caja' || path === '/pagos') && store.getUserRole() === 'TUTOR') {
      this.navigate('/portal/pagos');
      return;
    }

    if (path === '/portal/pagos' && store.getUserRole() !== 'TUTOR' && store.isAuthenticated()) {
      this.navigate('/caja');
      return;
    }

    if (path === '/convenios' && store.getUserRole() === 'ADMIN') {
      this.navigate('/admin/convenios');
      return;
    }

    if (path === '/convenios' && store.getUserRole() === 'TUTOR') {
      this.navigate('/portal/convenios');
      return;
    }

    // Control de Guardia de Autenticación
    if (route.requireAuth && !store.isAuthenticated()) {
      if (this.container) {
        this.container.innerHTML = '';
      }
      Toast.info('Debe iniciar sesión para acceder a este módulo.');
      this.navigate('/login');
      return;
    }

    // Control de Guardia de Roles RBAC
    if (route.allowedRoles && route.allowedRoles.length > 0) {
      const userRole = store.getUserRole();
      if (!route.allowedRoles.includes(userRole)) {
        Toast.error(`Acceso restringido. Su rol [${userRole}] no tiene permisos para ver esta sección.`);
        this.navigate('/dashboard');
        return;
      }
    }

    // Si ya está logueado e intenta ir al login, redirigir al dashboard
    if (path === '/login' && store.isAuthenticated()) {
      this.navigate('/dashboard');
      return;
    }

    // Desmontar vista previa si implementa unmount()
    if (this.currentView && typeof this.currentView.unmount === 'function') {
      try {
        this.currentView.unmount();
      } catch (e) {
        console.warn('[Router] Error al desmontar vista:', e);
      }
    }

    // Renderizar nueva vista con captura de errores
    if (this.container && route.view) {
      try {
        const ViewClass = route.view;
        this.currentView = new ViewClass(this.container);
        await this.currentView.render();
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      } catch (err) {
        console.error('[Router] Error al renderizar la vista:', err);
        Toast.error('Error al cargar la página: ' + (err.message || 'Error inesperado'));
      }
    }
  }
}
