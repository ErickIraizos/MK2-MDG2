import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';
import { store } from '../../store.js';

export class ClinicalGlossaryView {
  constructor(container) {
    this.container = container;
    this.searchTerm = '';
    this.activeCategory = 'ALL';
    this.terms = [];
    this.loading = true;
    this.modalEl = null;
    this.deactivateModalEl = null;
  }

  get userRole() {
    return store.getUserRole();
  }

  get isAdmin() {
    return this.userRole === 'ADMIN';
  }

  get canEdit() {
    return ['ADMIN', 'TERAPEUTA', 'RECEPCION'].includes(this.userRole);
  }

  get canDeactivate() {
    return ['ADMIN', 'TERAPEUTA'].includes(this.userRole);
  }

  get canReactivate() {
    return this.isAdmin;
  }

  getChipClass(isActive) {
    return `soft-btn soft-btn-sm btn-category-chip ${isActive ? 'soft-btn-lvl-1 active' : 'soft-btn-lvl-1-muted'}`;
  }

  getCategoryTheme(category) {
    if (category === 'TESTS' || category === 'STUDIES' || category === 'AI' || category === 'TECH_BILLING') {
      return { cardClass: 'soft-room-mint', badgeClass: 'soft-badge-mint', iconBoxClass: 'soft-icon-box-mint', iconColor: 'var(--soft-mint-deep)' };
    }
    if (category === 'LEGAL' || category === 'SPECIALTIES') {
      return { cardClass: '', badgeClass: 'soft-badge-indigo', iconBoxClass: 'soft-icon-box-indigo', iconColor: 'var(--soft-indigo-accent)' };
    }
    return { cardClass: '', badgeClass: 'soft-badge-lavender', iconBoxClass: 'soft-icon-box-lavender', iconColor: 'var(--soft-purple-primary)' };
  }

  async fetchTerms() {
    this.loading = true;
    try {
      // Si el usuario es Administrador, solicita todos los términos (activos e inactivos)
      const url = this.isAdmin ? '/glosario?status=ALL' : '/glosario';
      const res = await apiClient.get(url);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        this.terms = res.data;
      } else {
        this.terms = this.getFallbackTerms();
      }
    } catch (err) {
      console.warn('[ClinicalGlossaryView] Error al consultar API, usando términos base:', err);
      this.terms = this.getFallbackTerms();
    } finally {
      this.loading = false;
    }
  }

  async render() {
    await this.fetchTerms();

    const activeTermsCount = this.terms.filter(t => t.activo !== 0).length;
    const inactiveTermsCount = this.terms.filter(t => t.activo === 0).length;

    this.container.innerHTML = `
      <div class="page-container panel-general" style="max-width: 1240px; margin: 0 auto; padding-bottom: 3rem;">
        
        <!-- CABECERA PRINCIPAL SOFT UI -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.bookOpen ? Icons.bookOpen(13, 'var(--soft-purple-primary)') : Icons.fileText(13, 'var(--soft-purple-primary)')}
                <span>Referencia Clínica &amp; Operativa</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende" · Guía Integral Institucional</span>
            </div>
            <h1 class="soft-page-title">Glosario Clínico &amp; Guía de Términos</h1>
            <p class="soft-page-subtitle" style="max-width: 860px;">
              Diccionario interactivo en lenguaje accesible sobre códigos de expedientes (PSI-A-XXXX / PSI-007), reglas operativas (RN-01 a RN-07), manuales diagnósticos (CIE-11, DSM-5), metodología SOAP y protocolos de PSI Aprende.
            </p>
          </div>

          <div class="soft-header-actions" style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            ${this.canEdit ? `
              <button type="button" id="btn-add-new-term" class="soft-btn soft-btn-primary soft-btn-lvl-1" style="display: inline-flex; align-items: center; gap: 0.45rem;">
                ${Icons.plus(16, '#FFFFFF')}
                <span>+ Nuevo Término</span>
              </button>
            ` : ''}
            <span class="soft-badge soft-badge-emerald" style="padding: 0.45rem 0.9rem; font-size: 0.77rem;">
              ${Icons.shield(14, 'var(--soft-emerald-dark)')}
              <span>Atención bajo Secreto Profesional (Ley 3131)</span>
            </span>
          </div>
        </div>

        <!-- BARRA DE BÚSQUEDA Y FILTROS SOFT UI -->
        <div class="soft-card-static" style="padding: 1.4rem 1.65rem; margin-bottom: 1.65rem;">
          <div style="display: flex; flex-direction: column; gap: 1.1rem;">
            <!-- Input Buscador -->
            <div class="soft-search-box" style="width: 100%; position: relative;">
              <span class="soft-search-box-icon" style="left: 1rem; position: absolute; top: 50%; transform: translateY(-50%); color: var(--soft-text-muted);">
                ${Icons.search(18)}
              </span>
              <input
                type="text"
                id="glossary-search-input"
                class="soft-input"
                placeholder="Buscar por código (ej. PSI-007, RN-01), sigla (CIE-11, DSM-5, SOAP, WISC-V), prueba, baremo o concepto..."
                style="padding-left: 2.75rem; padding-right: 2.6rem; font-size: 0.92rem; height: 46px; width: 100%;"
                value="${this.searchTerm}"
              />
              <button
                type="button"
                id="glossary-search-clear"
                class="soft-modal-close-btn"
                style="position: absolute; right: 0.55rem; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border-radius: 10px; display: ${this.searchTerm ? 'inline-flex' : 'none'};"
                title="Limpiar búsqueda"
              >
                ${Icons.close(14)}
              </button>
            </div>

            <!-- Chips de Categorías (Nivel 1 Monocromático Morado) -->
            <div style="display: flex; gap: 0.48rem; flex-wrap: wrap; align-items: center;" id="glossary-category-chips">
              <button type="button" class="${this.getChipClass(this.activeCategory === 'ALL')}" data-cat="ALL" style="border-radius: 9999px;">
                Todos los Términos (<span id="cat-count-all">${activeTermsCount}</span>)
              </button>
              <button type="button" class="${this.getChipClass(this.activeCategory === 'RULES')}" data-cat="RULES" style="border-radius: 9999px;">
                Códigos &amp; Reglas (RN/PSI)
              </button>
              <button type="button" class="${this.getChipClass(this.activeCategory === 'SOAP')}" data-cat="SOAP" style="border-radius: 9999px;">
                Metodología SOAP &amp; PTI
              </button>
              <button type="button" class="${this.getChipClass(this.activeCategory === 'MANUALS')}" data-cat="MANUALS" style="border-radius: 9999px;">
                Manuales &amp; Diagnósticos
              </button>
              <button type="button" class="${this.getChipClass(this.activeCategory === 'TESTS')}" data-cat="TESTS" style="border-radius: 9999px;">
                Pruebas &amp; Baremos
              </button>
              <button type="button" class="${this.getChipClass(this.activeCategory === 'STUDIES')}" data-cat="STUDIES" style="border-radius: 9999px;">
                Estudios Externos (EEG/TAC)
              </button>
              <button type="button" class="${this.getChipClass(this.activeCategory === 'SPECIALTIES')}" data-cat="SPECIALTIES" style="border-radius: 9999px;">
                Especialidades
              </button>
              <button type="button" class="${this.getChipClass(this.activeCategory === 'LEGAL')}" data-cat="LEGAL" style="border-radius: 9999px;">
                Normativa &amp; Ley 3131
              </button>
              <button type="button" class="${this.getChipClass(this.activeCategory === 'TECH_BILLING')}" data-cat="TECH_BILLING" style="border-radius: 9999px;">
                Caja, Alianzas &amp; IA
              </button>

              ${this.isAdmin ? `
                <button type="button" class="${this.getChipClass(this.activeCategory === 'INACTIVE')}" data-cat="INACTIVE" style="border-radius: 9999px; ${inactiveTermsCount > 0 ? 'border: 1px dashed var(--soft-purple-primary);' : ''}">
                  ${Icons.archive(13, this.activeCategory === 'INACTIVE' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
                  <span>Inactivos / Ocultos (<span id="cat-count-inactive">${inactiveTermsCount}</span>)</span>
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- RESUMEN DE RESULTADOS -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; font-size: 0.85rem; color: var(--soft-text-body); padding: 0 0.25rem;">
          <div>
            Mostrando <strong id="glossary-visible-count" style="color: var(--soft-text-title); font-weight: 800;">0</strong> términos
            ${this.activeCategory === 'INACTIVE' ? '<span class="soft-badge soft-badge-lavender" style="margin-left: 0.5rem; font-size: 0.72rem;">Modo de Auditoría: Solo Inactivos</span>' : ''}
          </div>
          <div style="font-size: 0.79rem; color: var(--soft-text-muted);">
            ${this.isAdmin ? 'Los términos inactivos están protegidos y solo pueden ser reactivados por el Administrador' : 'Los términos no se eliminan permanentemente; pasan a custodia inactiva'}
          </div>
        </div>

        <!-- CONTENEDOR DE TARJETAS DE TÉRMINOS -->
        <div id="glossary-cards-container" class="soft-rooms-grid" style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 1.35rem;">
          <!-- Generado dinámicamente -->
        </div>

      </div>
    `;

    this.renderCards();
    this.attachEvents();
  }

  getFilteredTerms() {
    let list = this.terms;

    if (this.isAdmin) {
      if (this.activeCategory === 'INACTIVE') {
        list = list.filter(item => item.activo === 0);
      } else {
        // En vistas normales se muestran los activos; si seleccionó una categoría específica se filtra
        list = list.filter(item => item.activo !== 0);
        if (this.activeCategory !== 'ALL') {
          list = list.filter(item => item.category === this.activeCategory);
        }
      }
    } else {
      // Terapeutas y otros usuarios sólo ven términos activos
      list = list.filter(item => item.activo !== 0);
      if (this.activeCategory !== 'ALL') {
        list = list.filter(item => item.category === this.activeCategory);
      }
    }

    if (this.searchTerm.trim().length > 0) {
      const q = this.searchTerm.toLowerCase().trim();
      list = list.filter(item => {
        const title = (item.title || '').toLowerCase();
        const subtitle = (item.subtitle || '').toLowerCase();
        const queEs = (item.que_es || item.queEs || '').toLowerCase();
        const aplicacion = (item.aplicacion || '').toLowerCase();
        const ejemplo = (item.ejemplo || '').toLowerCase();
        const catName = (item.category_name || item.categoryName || '').toLowerCase();

        return title.includes(q) ||
          subtitle.includes(q) ||
          queEs.includes(q) ||
          aplicacion.includes(q) ||
          ejemplo.includes(q) ||
          catName.includes(q);
      });
    }

    return list;
  }

  renderCards() {
    const container = document.getElementById('glossary-cards-container');
    const countEl = document.getElementById('glossary-visible-count');
    const countAllEl = document.getElementById('cat-count-all');
    const countInactiveEl = document.getElementById('cat-count-inactive');

    const activeTermsCount = this.terms.filter(t => t.activo !== 0).length;
    const inactiveTermsCount = this.terms.filter(t => t.activo === 0).length;

    if (countAllEl) countAllEl.textContent = activeTermsCount;
    if (countInactiveEl) countInactiveEl.textContent = inactiveTermsCount;

    if (!container) return;

    const filtered = this.getFilteredTerms();
    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      const isInactiveView = this.activeCategory === 'INACTIVE';
      container.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1; padding: 3rem 1.5rem; text-align: center;">
          <div class="empty-state-icon" style="margin: 0 auto 1rem auto; width: 56px; height: 56px; border-radius: 18px; display: flex; align-items: center; justify-content: center; background: var(--soft-lavender-surface); color: var(--soft-purple-primary);">
            ${isInactiveView ? Icons.check(28, 'var(--soft-mint-deep)') : Icons.info(28, 'var(--soft-purple-primary)')}
          </div>
          <h3 class="empty-state-title" style="font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title); margin-bottom: 0.5rem;">
            ${isInactiveView ? 'No hay términos inactivos u ocultos' : `No se encontraron términos coincidentes con "${this.escapeHtml(this.searchTerm)}"`}
          </h3>
          <p class="empty-state-desc" style="max-width: 500px; margin: 0 auto 1.25rem auto; font-size: 0.88rem; color: var(--soft-text-body); line-height: 1.5;">
            ${isInactiveView ? 'Todos los términos clínicos y operativos se encuentran actualmente activos y visibles en el sistema.' : 'Prueba buscando por siglas (ej. PSI-007, RN-01, CIE-11, DSM-5, SOAP, WISC-V) o restablece los filtros para ver todos los conceptos.'}
          </p>
          <div style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" id="btn-reset-glossary-search" class="soft-btn soft-btn-lvl-1">
              Ver Todos los Términos
            </button>
            ${(!isInactiveView && this.canEdit) ? `
              <button type="button" id="btn-empty-add-term" class="soft-btn soft-btn-primary soft-btn-lvl-1">
                + Crear este Término
              </button>
            ` : ''}
          </div>
        </div>
      `;

      document.getElementById('btn-reset-glossary-search')?.addEventListener('click', () => {
        this.searchTerm = '';
        this.activeCategory = 'ALL';
        const input = document.getElementById('glossary-search-input');
        if (input) input.value = '';
        const clearBtn = document.getElementById('glossary-search-clear');
        if (clearBtn) clearBtn.style.display = 'none';
        this.updateChipStyles();
        this.renderCards();
      });

      document.getElementById('btn-empty-add-term')?.addEventListener('click', () => {
        this.openEditModal({ title: this.searchTerm });
      });

      return;
    }

    container.innerHTML = filtered.map(item => {
      const isInactive = item.activo === 0;
      const theme = this.getCategoryTheme(item.category);
      const queEsText = item.que_es || item.queEs || '';
      const catLabel = item.category_name || item.categoryName || item.category;

      return `
        <div class="soft-room-card ${theme.cardClass}" style="padding: 1.45rem 1.5rem; display: flex; flex-direction: column; justify-content: space-between; border-radius: 18px; border: ${isInactive ? '1px dashed #94A3B8' : '1px solid var(--soft-border-card, #EDE8F5)'}; background: ${isInactive ? '#F8FAFC' : '#FFFFFF'}; box-shadow: 0 4px 18px rgba(88, 66, 148, 0.05); transition: transform 0.2s ease, box-shadow 0.2s ease; opacity: ${isInactive ? '0.88' : '1'};">
          <div>
            <!-- Cabecera de la Tarjeta -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.65rem;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                  <span class="soft-badge ${theme.badgeClass}" style="font-size: 0.68rem; padding: 0.22rem 0.65rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">
                    ${this.escapeHtml(catLabel)}
                  </span>
                  ${isInactive ? `
                    <span class="soft-badge" style="font-size: 0.68rem; padding: 0.22rem 0.65rem; background: #F1F5F9; color: #475569; font-weight: 800; border: 1px solid #CBD5E1;">
                      Inactivo · Oculto
                    </span>
                  ` : ''}
                </div>
                <h3 style="margin: 0.48rem 0 0.18rem 0; font-size: 1.2rem; font-weight: 800; color: ${isInactive ? '#475569' : 'var(--soft-text-title)'}; letter-spacing: -0.02em; line-height: 1.24;">
                  ${this.escapeHtml(item.title)}
                </h3>
              </div>

              <!-- Botones de Acción según estado y rol -->
              <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
                ${isInactive ? `
                  ${this.canReactivate ? `
                    <button type="button" class="btn-card-reactivate-term soft-btn soft-btn-primary soft-btn-sm" data-id="${item.id}" title="Reactivar y hacer visible para todos" style="padding: 0.35rem 0.65rem; border-radius: 9px; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.77rem; font-weight: 700;">
                      ${Icons.refresh(13, '#FFFFFF')}
                      <span>Reactivar</span>
                    </button>
                  ` : `
                    <span class="soft-badge" style="font-size: 0.72rem; color: #64748B;">Solo Admin reactiva</span>
                  `}
                ` : `
                  ${this.canEdit ? `
                    <button type="button" class="btn-card-edit-term soft-btn soft-btn-lvl-1-muted soft-btn-sm" data-id="${item.id}" title="Editar término" style="padding: 0.32rem 0.52rem; border-radius: 9px;">
                      ${Icons.edit(14, 'var(--soft-purple-primary)')}
                    </button>
                  ` : ''}
                  ${this.canDeactivate ? `
                    <button type="button" class="btn-card-deactivate-term soft-btn soft-btn-lvl-1-muted soft-btn-sm" data-id="${item.id}" title="Pasar a inactivo (ocultar sin borrar)" style="padding: 0.32rem 0.52rem; border-radius: 9px; color: #64748B;">
                      ${Icons.archive(14, '#64748B')}
                    </button>
                  ` : ''}
                  <div class="soft-icon-box soft-icon-box-sm ${theme.iconBoxClass}" style="width: 32px; height: 32px; border-radius: 9px;">
                    ${Icons.info(15, theme.iconColor)}
                  </div>
                `}
              </div>
            </div>

            <!-- Subtítulo -->
            <div style="font-size: 0.81rem; font-weight: 600; color: ${isInactive ? '#64748B' : 'var(--soft-purple-primary)'}; margin-bottom: 0.95rem; line-height: 1.38;">
              ${this.escapeHtml(item.subtitle)}
            </div>

            <!-- Sección 1: En palabras sencillas -->
            <div style="margin-bottom: 0.9rem;">
              <div style="font-size: 0.71rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.045em; color: var(--soft-text-overline); margin-bottom: 0.3rem;">
                En palabras sencillas:
              </div>
              <p style="margin: 0; font-size: 0.86rem; color: var(--soft-text-body); line-height: 1.5;">
                ${this.escapeHtml(queEsText)}
              </p>
            </div>

            <!-- Sección 2: ¿Cómo se aplica en el sistema? -->
            <div style="margin-bottom: 0.9rem;">
              <div style="font-size: 0.71rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.045em; color: var(--soft-mint-deep); margin-bottom: 0.3rem;">
                ¿Cómo se aplica en PSI Aprende?:
              </div>
              <p style="margin: 0; font-size: 0.83rem; color: var(--soft-text-title); line-height: 1.48; background: var(--soft-lavender-surface); padding: 0.65rem 0.82rem; border-radius: 12px; border: 1px solid var(--soft-border-card-inner);">
                ${this.escapeHtml(item.aplicacion || '')}
              </p>
            </div>
          </div>

          <!-- Sección 3: Ejemplo de caso -->
          <div style="border-top: 1px solid var(--soft-divider); padding-top: 0.75rem; margin-top: 0.35rem; font-size: 0.79rem; color: var(--soft-text-body); line-height: 1.45;">
            <strong style="color: var(--soft-text-title); font-weight: 700;">Ejemplo:</strong> ${this.escapeHtml(item.ejemplo || '')}
          </div>
        </div>
      `;
    }).join('');

    // Eventos de edición
    container.querySelectorAll('.btn-card-edit-term').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-id'));
        const term = this.terms.find(t => Number(t.id) === id);
        if (term) {
          this.openEditModal(term);
        }
      });
    });

    // Eventos de desactivación (pasar a inactivo)
    container.querySelectorAll('.btn-card-deactivate-term').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.getAttribute('data-id'));
        const term = this.terms.find(t => Number(t.id) === id);
        if (term) {
          this.openDeactivateModal(term);
        }
      });
    });

    // Eventos de reactivación (solo Admin)
    container.querySelectorAll('.btn-card-reactivate-term').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.currentTarget.getAttribute('data-id'));
        const term = this.terms.find(t => Number(t.id) === id);
        if (term) {
          await this.reactivateTerm(term);
        }
      });
    });
  }

  updateChipStyles() {
    document.querySelectorAll('.btn-category-chip').forEach(btn => {
      const cat = btn.getAttribute('data-cat');
      const isActive = cat === this.activeCategory;
      btn.className = this.getChipClass(isActive);
    });
  }

  attachEvents() {
    const searchInput = document.getElementById('glossary-search-input');
    const clearBtn = document.getElementById('glossary-search-clear');
    const addNewBtn = document.getElementById('btn-add-new-term');

    let debounceTimer = null;

    searchInput?.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const val = e.target.value;
      this.searchTerm = val;
      if (clearBtn) {
        clearBtn.style.display = val.trim().length > 0 ? 'inline-flex' : 'none';
      }
      debounceTimer = setTimeout(() => {
        this.renderCards();
      }, 180);
    });

    clearBtn?.addEventListener('click', () => {
      this.searchTerm = '';
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      clearBtn.style.display = 'none';
      this.renderCards();
    });

    // Filtros por categoría
    document.querySelectorAll('.btn-category-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeCategory = e.currentTarget.getAttribute('data-cat') || 'ALL';
        this.updateChipStyles();
        this.renderCards();
      });
    });

    // Botón + Nuevo Término
    addNewBtn?.addEventListener('click', () => {
      this.openEditModal();
    });
  }

  openEditModal(term = null) {
    this.closeModal();

    const isEdit = !!(term && term.id);
    const modalWrapper = document.createElement('div');
    modalWrapper.id = 'modal-glossary-wrapper';

    modalWrapper.innerHTML = `
      <div class="modal-backdrop" id="modal-term-backdrop" style="position: fixed; inset: 0; background: rgba(36, 40, 91, 0.58); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); z-index: 99990; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        
        <div class="soft-modal-card" style="max-width: 680px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; background: #FFFFFF; border-radius: 20px; box-shadow: 0 16px 48px rgba(36, 40, 91, 0.22); border: 1px solid var(--soft-border-card, #EDE8F5);">
          
          <!-- CABECERA DEL MODAL (NIVEL 2) -->
          <div style="padding: 1.25rem 1.65rem; border-bottom: 1px solid var(--soft-divider, #F0EEF9); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface, #F8F6FE); gap: 1rem; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender" style="width: 38px; height: 38px; border-radius: 12px;">
                ${Icons.bookOpen(20, 'var(--soft-purple-primary, #584294)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title, #24285B); font-size: 1.16rem; font-weight: 800; margin: 0; letter-spacing: -0.015em;">
                  ${isEdit ? 'Editar Término Clínico u Operativo' : 'Nuevo Término Clínico u Operativo'}
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body, #696F8C); margin-top: 0.15rem;">
                  ${isEdit ? 'Actualice la información y ejemplos prácticos para el equipo' : 'Defina el concepto en lenguaje claro para terapeutas y personal de PSI Aprende'}
                </div>
              </div>
            </div>

            <button type="button" class="soft-modal-close-btn" id="btn-close-term-modal" title="Cerrar ventana">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- FORMULARIO SCROLLABLE (NIVEL 2) -->
          <form id="form-glossary-term" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; margin: 0;">
            
            <div class="soft-modal-scroll" style="padding: 1.35rem 1.65rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem; max-height: calc(90vh - 145px);">
              
              <!-- Título / Sigla -->
              <div>
                <label class="soft-label" style="font-weight: 700; font-size: 0.84rem; color: var(--soft-text-title); display: block; margin-bottom: 0.35rem;">
                  Nombre del Término, Sigla o Código <span class="required" style="color: #EF4444;">*</span>
                </label>
                <input 
                  type="text" 
                  name="title" 
                  id="term-input-title"
                  class="soft-input" 
                  placeholder="Ej: WISC-V, PSI-007, RN-01, TEA, Baremos..." 
                  value="${this.escapeHtml(term?.title || '')}" 
                  required 
                  style="width: 100%; height: 42px;"
                />
              </div>

              <!-- Subtítulo / Nombre Descriptivo -->
              <div>
                <label class="soft-label" style="font-weight: 700; font-size: 0.84rem; color: var(--soft-text-title); display: block; margin-bottom: 0.35rem;">
                  Subtítulo o Definición Rápida <span class="required" style="color: #EF4444;">*</span>
                </label>
                <input 
                  type="text" 
                  name="subtitle" 
                  id="term-input-subtitle"
                  class="soft-input" 
                  placeholder="Ej: Escala de Inteligencia de Wechsler para Niños (5.ª edición)" 
                  value="${this.escapeHtml(term?.subtitle || '')}" 
                  required 
                  style="width: 100%; height: 42px;"
                />
              </div>

              <!-- Categoría -->
              <div>
                <label class="soft-label" style="font-weight: 700; font-size: 0.84rem; color: var(--soft-text-title); display: block; margin-bottom: 0.35rem;">
                  Categoría del Término <span class="required" style="color: #EF4444;">*</span>
                </label>
                <select name="category" id="term-input-category" class="soft-select" required style="width: 100%; height: 42px;">
                  <option value="RULES" ${(term?.category === 'RULES' || this.activeCategory === 'RULES') ? 'selected' : ''}>Códigos & Reglas Operativas (PSI / RN)</option>
                  <option value="SOAP" ${(term?.category === 'SOAP' || this.activeCategory === 'SOAP') ? 'selected' : ''}>Metodología SOAP & PTI</option>
                  <option value="MANUALS" ${(term?.category === 'MANUALS' || this.activeCategory === 'MANUALS') ? 'selected' : ''}>Manuales & Diagnósticos (CIE-11, DSM-5)</option>
                  <option value="TESTS" ${(term?.category === 'TESTS' || this.activeCategory === 'TESTS') ? 'selected' : ''}>Pruebas Psicométricas & Baremos</option>
                  <option value="STUDIES" ${(term?.category === 'STUDIES' || this.activeCategory === 'STUDIES') ? 'selected' : ''}>Estudios Médicos Externos (EEG, TAC)</option>
                  <option value="SPECIALTIES" ${(term?.category === 'SPECIALTIES' || this.activeCategory === 'SPECIALTIES') ? 'selected' : ''}>Especialidades Clínicas</option>
                  <option value="LEGAL" ${(term?.category === 'LEGAL' || this.activeCategory === 'LEGAL') ? 'selected' : ''}>Normativa & Marco Legal (Ley 3131)</option>
                  <option value="TECH_BILLING" ${(term?.category === 'TECH_BILLING' || this.activeCategory === 'TECH_BILLING') ? 'selected' : ''}>Caja, Alianzas & MindBot IA</option>
                </select>
              </div>

              <!-- ¿Qué es en palabras sencillas? -->
              <div>
                <label class="soft-label" style="font-weight: 700; font-size: 0.84rem; color: var(--soft-text-title); display: block; margin-bottom: 0.35rem;">
                  ¿Qué es en palabras sencillas? <span class="required" style="color: #EF4444;">*</span>
                </label>
                <textarea 
                  name="que_es" 
                  id="term-input-que-es"
                  class="soft-textarea" 
                  rows="3" 
                  placeholder="Explique el concepto sin tecnicismos excesivos para que un nuevo terapeuta o un tutor comprenda de qué se trata..." 
                  required 
                  style="width: 100%; resize: vertical; padding: 0.75rem 0.95rem; font-size: 0.88rem;"
                >${this.escapeHtml(term?.que_es || term?.queEs || '')}</textarea>
              </div>

              <!-- ¿Cómo se aplica en PSI Aprende? -->
              <div>
                <label class="soft-label" style="font-weight: 700; font-size: 0.84rem; color: var(--soft-mint-deep); display: block; margin-bottom: 0.35rem;">
                  ¿Cómo se aplica en PSI Aprende? <span class="required" style="color: #EF4444;">*</span>
                </label>
                <textarea 
                  name="aplicacion" 
                  id="term-input-aplicacion"
                  class="soft-textarea" 
                  rows="3" 
                  placeholder="Detalle en qué pantalla, protocolo, tipo de sesión, sala o regla del sistema se aplica..." 
                  required 
                  style="width: 100%; resize: vertical; padding: 0.75rem 0.95rem; font-size: 0.88rem;"
                >${this.escapeHtml(term?.aplicacion || '')}</textarea>
              </div>

              <!-- Ejemplo práctico de caso -->
              <div>
                <label class="soft-label" style="font-weight: 700; font-size: 0.84rem; color: var(--soft-text-title); display: block; margin-bottom: 0.35rem;">
                  Ejemplo práctico de caso <span class="required" style="color: #EF4444;">*</span>
                </label>
                <textarea 
                  name="ejemplo" 
                  id="term-input-ejemplo"
                  class="soft-textarea" 
                  rows="2" 
                  placeholder="Ejemplo real: 'En la sesión 3 se administraron las subpruebas de cubos y vocabulario para obtener el índice...' " 
                  required 
                  style="width: 100%; resize: vertical; padding: 0.75rem 0.95rem; font-size: 0.88rem;"
                >${this.escapeHtml(term?.ejemplo || '')}</textarea>
              </div>

            </div>

            <!-- BOTONES DE ACCIÓN (NIVEL 2) -->
            <div style="padding: 1.1rem 1.65rem; border-top: 1px solid var(--soft-divider, #F0EEF9); display: flex; justify-content: flex-end; gap: 0.75rem; background: var(--soft-lavender-surface, #F8F6FE); flex-shrink: 0;">
              <button type="button" class="soft-btn soft-btn-lvl-2-secondary" id="btn-cancel-term-modal">
                Cancelar
              </button>
              <button type="submit" class="soft-btn soft-btn-primary soft-btn-lvl-2" id="btn-submit-term-modal" style="display: inline-flex; align-items: center; gap: 0.45rem;">
                ${Icons.check(16, '#FFFFFF')}
                <span>${isEdit ? 'Guardar Cambios' : 'Registrar Término'}</span>
              </button>
            </div>

          </form>

        </div>
      </div>
    `;

    document.body.appendChild(modalWrapper);
    this.modalEl = modalWrapper;

    const closeBtn = modalWrapper.querySelector('#btn-close-term-modal');
    const cancelBtn = modalWrapper.querySelector('#btn-cancel-term-modal');
    const backdrop = modalWrapper.querySelector('#modal-term-backdrop');
    const form = modalWrapper.querySelector('#form-glossary-term');

    const handleClose = () => this.closeModal();

    closeBtn?.addEventListener('click', handleClose);
    cancelBtn?.addEventListener('click', handleClose);
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) handleClose();
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('#btn-submit-term-modal');
      const originalText = submitBtn.innerHTML;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Guardando...</span>`;

        const formData = new FormData(form);
        const payload = {
          title: formData.get('title')?.toString().trim(),
          subtitle: formData.get('subtitle')?.toString().trim(),
          category: formData.get('category')?.toString().trim(),
          que_es: formData.get('que_es')?.toString().trim(),
          aplicacion: formData.get('aplicacion')?.toString().trim(),
          ejemplo: formData.get('ejemplo')?.toString().trim()
        };

        if (!payload.title || !payload.subtitle || !payload.que_es || !payload.aplicacion || !payload.ejemplo) {
          Toast.error('Por favor complete todos los campos obligatorios (*)');
          return;
        }

        let res;
        if (isEdit) {
          res = await apiClient.put(`/glosario/${term.id}`, payload);
        } else {
          res = await apiClient.post('/glosario', payload);
        }

        if (res && res.success) {
          Toast.success(res.message || (isEdit ? 'Término actualizado correctamente.' : 'Término registrado exitosamente.'));
          this.closeModal();
          await this.fetchTerms();
          this.renderCards();
        } else {
          throw new Error(res?.message || 'No se pudo guardar el término');
        }
      } catch (err) {
        console.error('[ClinicalGlossaryView] Error al guardar:', err);
        Toast.error(err.message || 'Error al guardar el término.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        }
      }
    });
  }

  openDeactivateModal(term) {
    this.closeDeactivateModal();

    const modalWrapper = document.createElement('div');
    modalWrapper.id = 'modal-glossary-deactivate-wrapper';

    modalWrapper.innerHTML = `
      <div class="modal-backdrop" id="modal-deactivate-backdrop" style="position: fixed; inset: 0; background: rgba(36, 40, 91, 0.58); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); z-index: 99995; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        
        <div class="soft-modal-card" style="max-width: 460px; width: 100%; background: #FFFFFF; border-radius: 20px; box-shadow: 0 16px 48px rgba(36, 40, 91, 0.22); border: 1px solid var(--soft-border-card, #EDE8F5); padding: 1.8rem 1.8rem 1.5rem 1.8rem; text-align: center;">
          
          <div class="soft-icon-box soft-icon-box-lg" style="margin: 0 auto 1.1rem auto; width: 52px; height: 52px; border-radius: 16px; background: #FEF3C7; color: #D97706; display: flex; align-items: center; justify-content: center;">
            ${Icons.archive(24, '#D97706')}
          </div>
          
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title);">
            ¿Pasar término a estado inactivo?
          </h3>
          
          <p style="margin: 0 0 1.25rem 0; font-size: 0.88rem; color: var(--soft-text-body); line-height: 1.52;">
            El término <strong>"${this.escapeHtml(term.title)}"</strong> pasará a estado <strong>inactivo</strong> y dejará de ser visible para los usuarios.
          </p>

          <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.75rem 0.9rem; margin-bottom: 1.4rem; text-align: left; font-size: 0.8rem; color: var(--soft-purple-primary); line-height: 1.45;">
            <strong>Protección Institucional:</strong> Los términos no se destruyen permanentemente. Para evitar eliminaciones por error, <strong>solo un Administrador</strong> podrá reactivarlo y hacerlo visible de nuevo.
          </div>
          
          <div style="display: flex; justify-content: center; gap: 0.75rem;">
            <button type="button" class="soft-btn soft-btn-lvl-2-secondary" id="btn-cancel-deactivate-term">
              Cancelar
            </button>
            <button type="button" class="soft-btn soft-btn-lvl-2" id="btn-confirm-deactivate-term" style="background: #D97706; color: #FFFFFF; border: none; display: inline-flex; align-items: center; gap: 0.4rem;">
              ${Icons.archive(15, '#FFFFFF')}
              <span>Pasar a Inactivo</span>
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(modalWrapper);
    this.deactivateModalEl = modalWrapper;

    const cancelBtn = modalWrapper.querySelector('#btn-cancel-deactivate-term');
    const confirmBtn = modalWrapper.querySelector('#btn-confirm-deactivate-term');
    const backdrop = modalWrapper.querySelector('#modal-deactivate-backdrop');

    const handleClose = () => this.closeDeactivateModal();

    cancelBtn?.addEventListener('click', handleClose);
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) handleClose();
    });

    confirmBtn?.addEventListener('click', async () => {
      try {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span>Inactivando...</span>`;

        const res = await apiClient.post(`/glosario/${term.id}/deactivate`);
        if (res && res.success) {
          Toast.success(res.message || 'Término pasado a estado inactivo. Solo el Administrador puede reactivarlo.');
          this.closeDeactivateModal();
          await this.fetchTerms();
          this.renderCards();
        } else {
          throw new Error(res?.message || 'No se pudo desactivar el término');
        }
      } catch (err) {
        console.error('[ClinicalGlossaryView] Error al desactivar:', err);
        Toast.error(err.message || 'Error al desactivar el término.');
      } finally {
        if (confirmBtn) confirmBtn.disabled = false;
      }
    });
  }

  async reactivateTerm(term) {
    if (!this.canReactivate) {
      Toast.error('Solo el Administrador tiene autorización para reactivar términos del glosario.');
      return;
    }

    try {
      const res = await apiClient.post(`/glosario/${term.id}/reactivate`);
      if (res && res.success) {
        Toast.success(res.message || `Término "${term.title}" reactivado exitosamente.`);
        await this.fetchTerms();
        this.renderCards();
      } else {
        throw new Error(res?.message || 'No se pudo reactivar el término');
      }
    } catch (err) {
      console.error('[ClinicalGlossaryView] Error al reactivar:', err);
      Toast.error(err.message || 'Error al reactivar el término.');
    }
  }

  closeModal() {
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
    }
    this.modalEl = null;
  }

  closeDeactivateModal() {
    if (this.deactivateModalEl && this.deactivateModalEl.parentNode) {
      this.deactivateModalEl.parentNode.removeChild(this.deactivateModalEl);
    }
    this.deactivateModalEl = null;
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

  getFallbackTerms() {
    return [
      {
        id: 1,
        title: 'Código de Paciente / Expediente (PSI-A-XXXX / PSI-007)',
        subtitle: 'Identificador institucional correlativo de historia clínica',
        category: 'RULES',
        category_name: 'Códigos & Reglas Operativas',
        que_es: 'Es el código correlativo oficial e irrepetible asignado a cada paciente registrado en el centro PSI Aprende (por ejemplo: PSI-A-0001, PSI-007).',
        aplicacion: 'Identifica de forma unificada la historia clínica, notas SOAP, consentimientos informados firmados y carpetas de estudios externos en todo el sistema, protegiendo la confidencialidad del paciente.',
        ejemplo: 'Expediente PSI-007 correspondiente a evaluación psicopedagógica infantil en Consultorio 1.',
        activo: 1
      },
      {
        id: 2,
        title: 'RN-01: Algoritmo Anti-Colisión Multi-Sala',
        subtitle: 'Control estricto de concurrencia y aforo en salas físicas',
        category: 'RULES',
        category_name: 'Códigos & Reglas Operativas',
        que_es: 'Regla de negocio automática que impide que dos terapeutas agenden consultas en el mismo consultorio físico (Sala 1, 2 o 3) a la misma hora.',
        aplicacion: 'El motor del calendario bloquea inmediatamente cualquier intento de solapamiento de horarios o de terapeutas en un mismo ambiente.',
        ejemplo: 'Si la Sala 1 (Infantil) está ocupada a las 10:00 AM, el sistema impide reservar otra cita allí en ese horario.',
        activo: 1
      },
      {
        id: 10,
        title: 'Estructura SOAP',
        subtitle: 'Subjetivo, Objetivo, Análisis y Plan',
        category: 'SOAP',
        category_name: 'Metodología SOAP & PTI',
        que_es: 'Es el formato médico y psicoterapéutico más extendido en el mundo para redactar notas de evolución de cada sesión de manera ordenada y legalmente defendible.',
        aplicacion: 'Cada sesión terapéutica en PSI Aprende se redacta obligatoriamente con estos 4 cuadrantes antes de registrar la firma profesional del especialista.',
        ejemplo: 'S: Madre relata desobediencia; O: Test d2 con 42 aciertos; A: Mayor control inhibitorio; P: Introducir reforzador positivo.',
        activo: 1
      },
      {
        id: 18,
        title: 'CIE-11',
        subtitle: 'Clasificación Internacional de Enfermedades (11.ª edición)',
        category: 'MANUALS',
        category_name: 'Manuales & Diagnósticos',
        que_es: 'Es el catálogo médico oficial publicado por la OMS. Asigna un código alfanumérico estandarizado a cada enfermedad, condición o trastorno del neurodesarrollo.',
        aplicacion: 'En PSI Aprende se utiliza para registrar formalmente el diagnóstico principal en la Evaluación Inicial / Anamnesis y en los Planes PTI.',
        ejemplo: 'Código 6A05.0: Trastorno por déficit de atención con hiperactividad, presentación predominantemente inatenta.',
        activo: 1
      },
      {
        id: 24,
        title: 'WISC-V',
        subtitle: 'Escala de Inteligencia de Wechsler para Niños (5.ª edición)',
        category: 'TESTS',
        category_name: 'Pruebas & Baremos',
        que_es: 'Es la prueba estándar de oro a nivel mundial para evaluar el funcionamiento cognitivo e intelectual global en niños y adolescentes de 6 a 16 años.',
        aplicacion: 'Arroja un Cociente Intelectual Total (CIT) y 5 índices: Comprensión Verbal, Visoespacial, Razonamiento Fluido, Memoria de Trabajo y Velocidad de Procesamiento.',
        ejemplo: 'Permite identificar si una dificultad escolar se debe a velocidad de procesamiento o a memoria de trabajo operativa.',
        activo: 1
      }
    ];
  }
}
