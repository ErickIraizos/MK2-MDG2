import { store } from '../store.js';
import { Icons } from './Icons.js';

export class Sidebar {
  static render() {
    const isAuth = store.isAuthenticated();
    if (!isAuth) return '';

    const state = store.getState();
    const user = state.user;
    // Navegación específica y escalable para tutores (en móvil como drawer y en escritorio limpia)
    if (user?.rol === 'TUTOR') {
      const currentHash = window.location.hash || '#/dashboard';
      return `
        <!-- Overlay móvil -->
        <div id="sidebar-backdrop" class="sidebar-backdrop"></div>

        <aside class="sidebar sidebar-tutor">
          <div class="sidebar-section-title">Portal Familiar</div>
          
          <a href="#/dashboard" class="sidebar-item ${currentHash.startsWith('#/dashboard') ? 'active' : ''}" title="Seguimiento Clínico">
            <span class="sidebar-item-icon">${Icons.dashboard(19)}</span>
            <span class="sidebar-item-text">Seguimiento Clínico</span>
          </a>

          <a href="#/portal/documents" class="sidebar-item ${currentHash.startsWith('#/portal/documents') || currentHash.startsWith('#/documents') ? 'active' : ''}" title="Documentos & Consentimientos">
            <span class="sidebar-item-icon">${Icons.fileText(19)}</span>
            <span class="sidebar-item-text">Documentos & Actas</span>
          </a>

          <a href="#/portal/therapists" class="sidebar-item ${currentHash.startsWith('#/portal/therapists') ? 'active' : ''}" title="Especialistas Acreditados">
            <span class="sidebar-item-icon">${Icons.therapist(19)}</span>
            <span class="sidebar-item-text">Especialistas Acreditados</span>
          </a>

          <a href="#/portal/nosotros" class="sidebar-item ${currentHash.startsWith('#/portal/nosotros') || currentHash.startsWith('#/nosotros') ? 'active' : ''}" title="Sobre Nosotros &amp; Equipo">
            <span class="sidebar-item-icon">${Icons.users(19)}</span>
            <span class="sidebar-item-text">Sobre Nosotros &amp; Equipo</span>
          </a>

          <a href="#/portal/especialidades" class="sidebar-item ${currentHash.startsWith('#/portal/especialidades') || currentHash.startsWith('#/especialidades') ? 'active' : ''}" title="Catálogo de Especialidades">
            <span class="sidebar-item-icon">${Icons.stethoscope(19)}</span>
            <span class="sidebar-item-text">Especialidades &amp; Guía</span>
          </a>

          <a href="#/portal/talleres" class="sidebar-item ${currentHash.startsWith('#/portal/talleres') || currentHash.startsWith('#/talleres') ? 'active' : ''}" title="Talleres &amp; Webinars">
            <span class="sidebar-item-icon">${Icons.calendar(19)}</span>
            <span class="sidebar-item-text">Talleres &amp; Webinars</span>
          </a>

          <a href="#/portal/ubicacion" class="sidebar-item ${currentHash.startsWith('#/portal/ubicacion') || currentHash.startsWith('#/ubicacion') ? 'active' : ''}" title="Ubicación &amp; Instalaciones">
            <span class="sidebar-item-icon">${Icons.mapPin(19)}</span>
            <span class="sidebar-item-text">Ubicación &amp; Fotos</span>
          </a>

          <a href="#/appointments" class="sidebar-item ${currentHash.startsWith('#/appointments') ? 'active' : ''}" title="Mis Citas Agendadas">
            <span class="sidebar-item-icon">${Icons.calendar(19)}</span>
            <span class="sidebar-item-text">Mis Citas Agendadas</span>
          </a>

          <a href="#/portal/pagos" class="sidebar-item ${currentHash.startsWith('#/portal/pagos') || currentHash.startsWith('#/pagos') ? 'active' : ''}" title="Pagos & Aranceles QR">
            <span class="sidebar-item-icon">${Icons.wallet(19)}</span>
            <span class="sidebar-item-text">Pagos & Aranceles QR</span>
          </a>

          <a href="#/portal/convenios" class="sidebar-item ${currentHash.startsWith('#/portal/convenios') || currentHash.startsWith('#/convenios') ? 'active' : ''}" title="Alianzas & Convenios">
            <span class="sidebar-item-icon">${Icons.handshake(19)}</span>
            <span class="sidebar-item-text">Alianzas & Convenios</span>
          </a>

          <a href="#/profile" class="sidebar-item ${currentHash === '#/profile' ? 'active' : ''}" title="Mi Perfil Familiar">
            <span class="sidebar-item-icon">${Icons.users(19)}</span>
            <span class="sidebar-item-text">Mi Perfil Familiar</span>
          </a>

          <a href="#/" class="sidebar-item ${currentHash === '#/' ? 'active' : ''}" title="Inicio Institucional">
            <span class="sidebar-item-icon">${Icons.home(19)}</span>
            <span class="sidebar-item-text">Inicio Institucional</span>
          </a>

          <div class="sidebar-footer-badge">
            <div class="sidebar-footer-icon">${Icons.patient(16, 'currentColor')}</div>
            <div class="sidebar-footer-info">
              <div class="sidebar-footer-title">Familia "PSI Aprende"</div>
              <div class="sidebar-footer-desc">Atención y Acompañamiento</div>
            </div>
          </div>
        </aside>
      `;
    }

    const currentHash = window.location.hash || '#/dashboard';

    return `
      <!-- Overlay móvil -->
      <div id="sidebar-backdrop" class="sidebar-backdrop"></div>

      <aside class="sidebar">
        <div class="sidebar-section-title">Navegación</div>
        
        <a href="#/dashboard" class="sidebar-item ${currentHash.startsWith('#/dashboard') ? 'active' : ''}" title="${user.rol === 'ADMIN' ? 'Dashboard Ejecutivo' : (user.rol === 'TERAPEUTA' ? 'Mi Panel Clínico' : 'Panel General')}">
          <span class="sidebar-item-icon">${Icons.dashboard(19)}</span>
          <span class="sidebar-item-text">${user.rol === 'ADMIN' ? 'Dashboard Ejecutivo' : (user.rol === 'TERAPEUTA' ? 'Mi Panel Clínico' : 'Panel General')}</span>
        </a>

        <a href="#/profile" class="sidebar-item ${currentHash === '#/profile' ? 'active' : ''}" title="Mi Perfil Institucional">
          <span class="sidebar-item-icon">${Icons.users(19)}</span>
          <span class="sidebar-item-text">Mi Perfil Institucional</span>
        </a>

        <div class="sidebar-section-title">
          ${user.rol === 'TUTOR' ? 'Servicios del Centro' : 'Gestión Clínica'}
        </div>

        ${user.rol === 'TUTOR' ? `
          <a href="#/portal/documents" class="sidebar-item ${currentHash.startsWith('#/portal/documents') || currentHash.startsWith('#/documents') ? 'active' : ''}" title="Documentos & Consentimientos">
            <span class="sidebar-item-icon">${Icons.fileText(19)}</span>
            <span class="sidebar-item-text">Documentos & Actas</span>
          </a>

          <a href="#/portal/therapists" class="sidebar-item ${currentHash.startsWith('#/portal/therapists') ? 'active' : ''}" title="Especialistas Acreditados">
            <span class="sidebar-item-icon">${Icons.therapist(19)}</span>
            <span class="sidebar-item-text">Especialistas Acreditados</span>
          </a>

          <a href="#/portal/nosotros" class="sidebar-item ${currentHash.startsWith('#/portal/nosotros') || currentHash.startsWith('#/nosotros') ? 'active' : ''}" title="Sobre Nosotros &amp; Equipo">
            <span class="sidebar-item-icon">${Icons.users(19)}</span>
            <span class="sidebar-item-text">Sobre Nosotros &amp; Equipo</span>
          </a>

          <a href="#/portal/especialidades" class="sidebar-item ${currentHash.startsWith('#/portal/especialidades') || currentHash.startsWith('#/especialidades') ? 'active' : ''}" title="Catálogo de Especialidades">
            <span class="sidebar-item-icon">${Icons.stethoscope(19)}</span>
            <span class="sidebar-item-text">Especialidades &amp; Guía</span>
          </a>

          <a href="#/portal/ubicacion" class="sidebar-item ${currentHash.startsWith('#/portal/ubicacion') || currentHash.startsWith('#/ubicacion') ? 'active' : ''}" title="Ubicación &amp; Instalaciones">
            <span class="sidebar-item-icon">${Icons.mapPin(19)}</span>
            <span class="sidebar-item-text">Ubicación &amp; Fotos</span>
          </a>

          <a href="#/appointments" class="sidebar-item ${currentHash.startsWith('#/appointments') ? 'active' : ''}" title="Mis Citas Agendadas">
            <span class="sidebar-item-icon">${Icons.calendar(19)}</span>
            <span class="sidebar-item-text">Mis Citas Agendadas</span>
          </a>

          <a href="#/portal/pagos" class="sidebar-item ${currentHash.startsWith('#/portal/pagos') || currentHash.startsWith('#/pagos') ? 'active' : ''}" title="Pagos & Aranceles QR">
            <span class="sidebar-item-icon">${Icons.wallet(19)}</span>
            <span class="sidebar-item-text">Pagos & Aranceles QR</span>
          </a>

          <a href="#/portal/convenios" class="sidebar-item ${currentHash.startsWith('#/portal/convenios') || currentHash.startsWith('#/convenios') ? 'active' : ''}" title="Alianzas & Convenios">
            <span class="sidebar-item-icon">${Icons.handshake(19)}</span>
            <span class="sidebar-item-text">Alianzas & Convenios</span>
          </a>
        ` : ''}

        ${['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(user.rol) ? `
          <a href="#/appointments" class="sidebar-item ${currentHash.startsWith('#/appointments') || currentHash.startsWith('#/agenda') ? 'active' : ''}" title="Agenda & Consultorios">
            <span class="sidebar-item-icon">${Icons.calendar(19)}</span>
            <span class="sidebar-item-text">Agenda & Consultorios</span>
          </a>

          <a href="#/patients" class="sidebar-item ${currentHash.startsWith('#/patients') ? 'active' : ''}" title="Pacientes & Familias">
            <span class="sidebar-item-icon">${Icons.patient(19)}</span>
            <span class="sidebar-item-text">Pacientes & Familias</span>
          </a>

          ${['ADMIN', 'TERAPEUTA'].includes(user.rol) ? `
            <a href="#/clinical-records" class="sidebar-item ${currentHash.startsWith('#/clinical-records') ? 'active' : ''}" title="Historias Clínicas & SOAP">
              <span class="sidebar-item-icon">${Icons.stethoscope(19)}</span>
              <span class="sidebar-item-text">Historias Clínicas & SOAP</span>
            </a>
          ` : ''}

          <a href="#/therapists" class="sidebar-item ${currentHash.startsWith('#/therapists') ? 'active' : ''}" title="Especialistas & Consultorios">
            <span class="sidebar-item-icon">${Icons.therapist(19)}</span>
            <span class="sidebar-item-text">Especialistas & Consultorios</span>
          </a>

          ${['ADMIN', 'TERAPEUTA'].includes(user.rol) ? `
            <a href="#/clinical/glossary" class="sidebar-item ${currentHash.startsWith('#/clinical/glossary') || currentHash.startsWith('#/glossary') ? 'active' : ''}" title="Glosario Clínico & Guía">
              <span class="sidebar-item-icon">${Icons.bookOpen(19)}</span>
              <span class="sidebar-item-text">Glosario & Términos</span>
            </a>
          ` : ''}

          <a href="#/whatsapp" class="sidebar-item ${currentHash.startsWith('#/whatsapp') ? 'active' : ''}" title="WhatsApp & Mensajería Multi-Cuenta">
            <span class="sidebar-item-icon">${Icons.whatsapp(19)}</span>
            <span class="sidebar-item-text">WhatsApp & Mensajería</span>
          </a>

          <a href="#/caja" class="sidebar-item ${currentHash.startsWith('#/caja') || currentHash.startsWith('#/pagos') ? 'active' : ''}" title="${user.rol === 'TERAPEUTA' ? 'Mis Honorarios & Cobros QR' : 'Caja Diaria & Cobros QR'}">
            <span class="sidebar-item-icon">${Icons.wallet(19)}</span>
            <span class="sidebar-item-text">${user.rol === 'TERAPEUTA' ? 'Mis Honorarios & Pagos QR' : 'Caja & Cobros QR'}</span>
          </a>

          <a href="#/baterias" class="sidebar-item ${currentHash.startsWith('#/baterias') || currentHash.startsWith('#/inventario') ? 'active' : ''}" title="Inventario de Baterías Psicométricas & Custodia RN-06">
            <span class="sidebar-item-icon">${Icons.package(19)}</span>
            <span class="sidebar-item-text">Baterías & Custodia RN-06</span>
          </a>

          <a href="${user.rol === 'ADMIN' ? '#/admin/convenios' : '#/portal/convenios'}" class="sidebar-item ${currentHash.startsWith('#/admin/convenios') || currentHash.startsWith('#/portal/convenios') || currentHash.startsWith('#/convenios') ? 'active' : ''}" title="Convenios & Alianzas Institucionales">
            <span class="sidebar-item-icon">${Icons.handshake(19)}</span>
            <span class="sidebar-item-text">Convenios & Alianzas</span>
          </a>

          <a href="${user.rol === 'ADMIN' ? '#/admin/talleres' : '#/portal/talleres'}" class="sidebar-item ${currentHash.startsWith('#/admin/talleres') || currentHash.startsWith('#/portal/talleres') || currentHash.startsWith('#/talleres') ? 'active' : ''}" title="Talleres & Eventos Psicoeducativos">
            <span class="sidebar-item-icon">${Icons.calendar(19)}</span>
            <span class="sidebar-item-text">Talleres & Eventos</span>
          </a>

          ${['ADMIN', 'TERAPEUTA'].includes(user.rol) ? `
            <a href="#/materiales" class="sidebar-item ${currentHash.startsWith('#/materiales') || currentHash.startsWith('#/recursos') ? 'active' : ''}" title="Repositorio Libre de Materiales & Recursos">
              <span class="sidebar-item-icon">${Icons.folder(19)}</span>
              <span class="sidebar-item-text">Materiales & Recursos</span>
            </a>

            <a href="#/reportes" class="sidebar-item ${currentHash.startsWith('#/reportes') || currentHash.startsWith('#/reports') ? 'active' : ''}" title="Reportes Analíticos & Informes Oficiales">
              <span class="sidebar-item-icon">${Icons.barChart(19)}</span>
              <span class="sidebar-item-text">Reportes & Estadísticas</span>
            </a>
          ` : ''}
        ` : ''}

        ${user.rol === 'ADMIN' ? `
          <div class="sidebar-section-title">Administración</div>
          <a href="#/admin/users" class="sidebar-item ${currentHash.startsWith('#/admin/users') || currentHash.startsWith('#/users') ? 'active' : ''}" title="Gestión de Usuarios y Roles">
            <span class="sidebar-item-icon">${Icons.users(19)}</span>
            <span class="sidebar-item-text">Usuarios y Roles</span>
          </a>
          <a href="#/admin/rooms" class="sidebar-item ${currentHash.startsWith('#/admin/rooms') || currentHash.startsWith('#/rooms') ? 'active' : ''}" title="Consultorios y Salas">
            <span class="sidebar-item-icon">${Icons.rooms(19)}</span>
            <span class="sidebar-item-text">Consultorios y Salas</span>
          </a>
          <a href="#/admin/settings" class="sidebar-item ${currentHash.startsWith('#/admin/settings') || currentHash.startsWith('#/settings') || currentHash.startsWith('#/admin/config') || currentHash.startsWith('#/config') ? 'active' : ''}" title="Ajustes del Sistema">
            <span class="sidebar-item-icon">${Icons.settings(19)}</span>
            <span class="sidebar-item-text">Ajustes del Sistema</span>
          </a>
        ` : ''}

        <div class="sidebar-footer-badge">
          <div class="sidebar-footer-icon">${Icons.rooms(16, 'currentColor')}</div>
          <div class="sidebar-footer-info">
            <div class="sidebar-footer-title">Centro "PSI Aprende"</div>
            <div class="sidebar-footer-desc">Sede Central · Cochabamba</div>
          </div>
        </div>
      </aside>
    `;
  }

  static attachEvents() {
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        const app = document.getElementById('app');
        if (app) app.classList.remove('mobile-sidebar-open');
      });
    }

    // Al hacer click en cualquier enlace del sidebar en móvil, cerrar el drawer
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
      item.addEventListener('click', () => {
        const app = document.getElementById('app');
        if (app && window.innerWidth <= 900) {
          app.classList.remove('mobile-sidebar-open');
        }
      });
    });
  }

  static updateActiveLink(currentHash = window.location.hash || '#/dashboard') {
    const cleanHash = currentHash.split('?')[0] || '#/dashboard';
    const items = document.querySelectorAll('#sidebar-container .sidebar-item');
    items.forEach((el) => {
      const href = el.getAttribute('href') || '';
      let isActive = false;
      if (href === '#/' || href === '#/profile') {
        isActive = cleanHash === href;
      } else if (href === '#/portal/documents') {
        isActive = cleanHash.startsWith('#/portal/documents') || cleanHash.startsWith('#/documents');
      } else if (href === '#/portal/nosotros') {
        isActive = cleanHash.startsWith('#/portal/nosotros') || cleanHash.startsWith('#/nosotros');
      } else if (href === '#/portal/especialidades') {
        isActive = cleanHash.startsWith('#/portal/especialidades') || cleanHash.startsWith('#/especialidades');
      } else if (href === '#/portal/talleres' || href === '#/admin/talleres') {
        isActive = cleanHash.startsWith('#/admin/talleres') || cleanHash.startsWith('#/portal/talleres') || cleanHash.startsWith('#/talleres');
      } else if (href === '#/portal/ubicacion') {
        isActive = cleanHash.startsWith('#/portal/ubicacion') || cleanHash.startsWith('#/ubicacion');
      } else if (href === '#/appointments') {
        isActive = cleanHash.startsWith('#/appointments') || cleanHash.startsWith('#/agenda');
      } else if (href === '#/portal/pagos') {
        isActive = cleanHash.startsWith('#/portal/pagos') || cleanHash.startsWith('#/pagos');
      } else if (href === '#/caja') {
        isActive = cleanHash.startsWith('#/caja') || cleanHash.startsWith('#/pagos');
      } else if (href === '#/portal/convenios' || href === '#/admin/convenios') {
        isActive = cleanHash.startsWith('#/admin/convenios') || cleanHash.startsWith('#/portal/convenios') || cleanHash.startsWith('#/convenios');
      } else if (href === '#/clinical/glossary') {
        isActive = cleanHash.startsWith('#/clinical/glossary') || cleanHash.startsWith('#/glossary');
      } else if (href === '#/baterias') {
        isActive = cleanHash.startsWith('#/baterias') || cleanHash.startsWith('#/inventario');
      } else if (href === '#/materiales') {
        isActive = cleanHash.startsWith('#/materiales') || cleanHash.startsWith('#/recursos');
      } else if (href === '#/reportes') {
        isActive = cleanHash.startsWith('#/reportes') || cleanHash.startsWith('#/reports');
      } else if (href === '#/admin/users') {
        isActive = cleanHash.startsWith('#/admin/users') || cleanHash.startsWith('#/users');
      } else if (href === '#/admin/rooms') {
        isActive = cleanHash.startsWith('#/admin/rooms') || cleanHash.startsWith('#/rooms');
      } else if (href === '#/admin/settings') {
        isActive = cleanHash.startsWith('#/admin/settings') || cleanHash.startsWith('#/settings') || cleanHash.startsWith('#/admin/config') || cleanHash.startsWith('#/config');
      } else if (href) {
        isActive = cleanHash.startsWith(href);
      }
      el.classList.toggle('active', isActive);
    });
  }
}
