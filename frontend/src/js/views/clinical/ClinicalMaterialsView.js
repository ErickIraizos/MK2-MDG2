import { apiClient } from '../../api/apiClient.js';
import { store } from '../../store.js';
import { Icons } from '../../components/Icons.js';
import { Toast } from '../../components/Toast.js';

export class ClinicalMaterialsView {
  constructor(container) {
    this.container = container;
    this.folders = [];
    this.selectedFolderId = null;
    this.files = [];
    this.searchQuery = '';
    this.activeCategory = 'ALL';
    this.activeScope = 'public'; // 'public' (compartido) | 'private' (mi baúl personal)
    this.isLoading = false;
  }

  get user() {
    return store.getState().user || {};
  }

  get isAdmin() {
    return this.user.rol === 'ADMIN';
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-container panel-general" style="max-width: 1400px; margin: 0 auto; padding-bottom: 3rem;">
        <div style="text-align: center; padding: 3.5rem 1.5rem;">
          <div class="soft-spinner soft-spinner-lg" style="margin: 0 auto 1.25rem auto;"></div>
          <p style="color: var(--soft-text-body); font-size: 0.92rem;">Cargando repositorio de materiales terapéuticos...</p>
        </div>
      </div>
    `;

    try {
      await this.loadFolders();
      await this.loadFiles();
      this.renderMain();
    } catch (err) {
      console.error('Error al cargar materiales:', err);
      this.container.innerHTML = `
        <div class="page-container panel-general" style="text-align: center; padding: 3.5rem 1.5rem;">
          <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1rem auto;">
            ${Icons.alertTriangle(28, 'var(--soft-purple-primary)')}
          </div>
          <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800;">No se pudo cargar el repositorio</h3>
          <p style="color: var(--soft-text-body); font-size: 0.88rem; margin-bottom: 1.25rem;">${this._escapeHtml(err.message)}</p>
          <button type="button" id="btn-retry-materials" class="soft-btn soft-btn-lvl-1">Reintentar</button>
        </div>
      `;
      document.getElementById('btn-retry-materials')?.addEventListener('click', () => this.render());
    }
  }

  async loadFolders() {
    try {
      const res = await apiClient.get(`/materials/folders?scope=${this.activeScope}`);
      this.folders = res?.data || [];
      if (!this.selectedFolderId && this.folders.length > 0) {
        this.selectedFolderId = this.folders[0].id;
      } else if (!this.folders.some(f => f.id === this.selectedFolderId) && this.folders.length > 0) {
        this.selectedFolderId = this.folders[0].id;
      }
    } catch (err) {
      console.warn('Error al cargar carpetas:', err);
      this.folders = [];
    }
  }

  async loadFiles() {
    if (!this.selectedFolderId) {
      this.files = [];
      return;
    }
    try {
      const res = await apiClient.get(`/materials/folders/${this.selectedFolderId}/files?scope=${this.activeScope}&search=${encodeURIComponent(this.searchQuery)}`);
      this.files = res?.data || [];
    } catch (err) {
      console.warn('Error al cargar archivos de la carpeta:', err);
      this.files = [];
    }
  }

  renderMain() {
    const activeFolder = this.folders.find(f => f.id === this.selectedFolderId) || this.folders[0] || null;
    
    // Filtrar archivos por categoría activa
    const filteredFiles = this.files.filter(file => {
      if (this.activeCategory === 'ALL') return true;
      return file.categoria === this.activeCategory;
    });

    this.container.innerHTML = `
      <div class="page-container panel-general" style="max-width: 1400px; margin: 0 auto; padding-bottom: 3.5rem;">
        
        <!-- ENCABEZADO DE LA VISTA (SOFT UI MÉDICA) -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                <span class="soft-status-dot"></span>
                <span>${this.activeScope === 'public' ? 'Biblioteca Digital Compartida' : 'Espacio Personal Confidencial'}</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende" · Repositorio Clínico</span>
            </div>
            <h1 class="soft-page-title">
              Materiales &amp; Recursos Terapéuticos
            </h1>
            <p class="soft-page-subtitle">
              ${this.activeScope === 'public' 
                ? 'Recursos clínicos compartidos accesibles para todos los terapeutas y administración del centro.' 
                : 'Mi baúl privado y exclusivo: únicamente tú puedes consultar y gestionar estos archivos clínicos.'}
            </p>
          </div>

          <div class="soft-header-actions">
            <button type="button" id="btn-new-folder" class="soft-btn soft-btn-lvl-1-muted">
              ${Icons.folderPlus(16, 'var(--soft-purple-primary)')}
              <span>Nueva Carpeta</span>
            </button>
            <button type="button" id="btn-upload-file" class="soft-btn soft-btn-lvl-1">
              ${Icons.plus(16, '#FFFFFF')}
              <span>Subir Material</span>
            </button>
          </div>
        </div>

        <!-- SELECTOR PRINCIPAL DE ÁMBITO: PÚBLICO VS PRIVADO -->
        <div style="display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
          <button
            type="button"
            id="btn-scope-public"
            class="soft-btn ${this.activeScope === 'public' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}"
            style="padding: 0.65rem 1.25rem; font-size: 0.88rem;"
          >
            ${Icons.users(16, this.activeScope === 'public' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
            <span>Repositorio Compartido · Todo el Centro</span>
            <span class="soft-badge soft-badge-lavender" style="font-size: 0.7rem; margin-left: 0.35rem;">Público</span>
          </button>

          <button
            type="button"
            id="btn-scope-private"
            class="soft-btn ${this.activeScope === 'private' ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}"
            style="padding: 0.65rem 1.25rem; font-size: 0.88rem;"
          >
            ${Icons.lock(16, this.activeScope === 'private' ? '#FFFFFF' : 'var(--soft-purple-primary)')}
            <span>Mi Baúl Privado · Confidencial</span>
            <span class="soft-badge soft-badge-coral" style="font-size: 0.7rem; margin-left: 0.35rem;">Solo para Mí</span>
          </button>
        </div>

        <!-- SELECTOR DE CARPETAS EN PESTAÑAS HORIZONTALES CON PROTECCIÓN ANTI-RECORTE -->
        <div class="tabs-scroll-container" style="margin-bottom: 1.35rem;">
          ${this.folders.map(folder => {
            const isSelected = folder.id === this.selectedFolderId;
            return `
              <button 
                type="button" 
                class="soft-btn btn-folder-pill ${isSelected ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" 
                data-folder-id="${folder.id}"
                style="flex-shrink: 0;"
              >
                ${Icons.folder(15, isSelected ? '#FFFFFF' : 'var(--soft-purple-primary)')}
                <span>${this._escapeHtml(folder.nombre)}</span>
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.7rem; padding: 0.05rem 0.35rem; margin-left: 0.35rem;">${folder.total_archivos || 0}</span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- TARJETA PRINCIPAL DEL CONTENEDOR DE LA CARPETA ACTIVA -->
        ${activeFolder ? `
          <div class="soft-section-card" style="margin-bottom: 1.5rem;">
            <div class="soft-section-header" style="flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.85rem;">
                <div class="soft-icon-box soft-icon-box-lavender" style="background: ${activeFolder.color ? activeFolder.color + '1A' : 'var(--soft-lavender-bg)'};">
                  ${Icons.folder(24, activeFolder.color || 'var(--soft-purple-primary)')}
                </div>
                <div>
                  <h3 class="soft-section-title" style="margin-bottom: 0.2rem;">
                    ${this._escapeHtml(activeFolder.nombre)}
                  </h3>
                  <p class="soft-section-subtitle" style="margin-bottom: 0;">
                    ${this._escapeHtml(activeFolder.descripcion || 'Carpeta libre para material psicoterapéutico y pedagógico')}
                  </p>
                </div>
              </div>

              <!-- BUSCADOR INTERNO DE ARCHIVOS -->
              <div style="display: flex; align-items: center; gap: 0.65rem; width: 100%; max-width: 380px;">
                <div class="soft-search-box" style="flex: 1; position: relative;">
                  <span class="soft-search-box-icon" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: var(--soft-text-muted);">
                    ${Icons.search ? Icons.search(16) : Icons.pulse(16)}
                  </span>
                  <input 
                    type="text" 
                    id="search-materials-input"
                    class="soft-input" 
                    style="padding-left: 2.35rem; font-size: 0.85rem;"
                    placeholder="Buscar por nombre o descripción..."
                    value="${this._escapeHtml(this.searchQuery)}"
                  />
                </div>
              </div>
            </div>

            <!-- FILTRO DE CATEGORÍAS CLÍNICAS -->
            <div class="tabs-scroll-container" style="border-bottom: 1px solid var(--soft-divider); padding-bottom: 0.85rem; margin-bottom: 1.25rem;">
              ${[
                { id: 'ALL', label: 'Todos los Materiales' },
                { id: 'FICHA_TRABAJO', label: 'Fichas de Estimulación' },
                { id: 'EVALUACION', label: 'Protocolos y Baremos' },
                { id: 'GUIA_PADRES', label: 'Guías para Familias' },
                { id: 'PICTOGRAMAS', label: 'Pictogramas y Apoyos' },
                { id: 'OTRO', label: 'Otros Recursos' }
              ].map(c => `
                <button 
                  type="button" 
                  class="soft-btn btn-filter-cat ${this.activeCategory === c.id ? 'soft-btn-lvl-1' : 'soft-btn-lvl-1-muted'}" 
                  data-cat="${c.id}"
                  style="font-size: 0.8rem; padding: 0.35rem 0.85rem;"
                >
                  <span>${c.label}</span>
                </button>
              `).join('')}
            </div>

            <!-- LISTADO DE MATERIALES EN TABLA SATINADA -->
            ${filteredFiles.length === 0 ? `
              <div style="text-align: center; padding: 3.5rem 1.5rem;">
                <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1.15rem auto;">
                  ${Icons.folder(32, 'var(--soft-purple-primary)')}
                </div>
                <h4 style="color: var(--soft-text-title); font-size: 1.1rem; font-weight: 800; margin-bottom: 0.4rem;">
                  ${this.activeScope === 'public' ? 'No hay archivos públicos en esta carpeta' : 'No tienes archivos privados en esta carpeta'}
                </h4>
                <p style="color: var(--soft-text-body); font-size: 0.85rem; max-width: 480px; margin: 0 auto 1.25rem auto;">
                  ${this.activeScope === 'public' 
                    ? 'Sube fichas en PDF, láminas ilustradas o documentos Word para que tú y tu equipo puedan usarlos en sus sesiones.'
                    : 'Sube tus propios recursos confidenciales de uso individual. Solo tú podrás verlos aquí.'}
                </p>
                <button type="button" id="btn-empty-upload" class="soft-btn soft-btn-lvl-1">
                  ${Icons.plus(15, '#FFFFFF')}
                  <span>Subir Primer Archivo</span>
                </button>
              </div>
            ` : `
              <div class="soft-table-wrap">
                <table class="soft-table">
                  <thead>
                    <tr>
                      <th>Documento / Material</th>
                      <th>Categoría</th>
                      <th style="text-align: center;">Visibilidad</th>
                      <th>Tamaño</th>
                      <th>Subido Por</th>
                      <th>Fecha</th>
                      <th style="text-align: right;">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredFiles.map(file => {
                      const isPdf = file.tipo_mime.includes('pdf');
                      const isImage = file.tipo_mime.includes('image');
                      const isWord = file.tipo_mime.includes('word') || file.nombre_original.endsWith('.docx');
                      const sizeFormatted = file.tamano_bytes < 1024 * 1024 
                        ? (file.tamano_bytes / 1024).toFixed(1) + ' KB' 
                        : (file.tamano_bytes / (1024 * 1024)).toFixed(1) + ' MB';

                      let badgeClass = 'soft-badge-lavender';
                      if (file.categoria === 'FICHA_TRABAJO') badgeClass = 'soft-badge-mint';
                      if (file.categoria === 'EVALUACION') badgeClass = 'soft-badge-indigo';
                      if (file.categoria === 'GUIA_PADRES') badgeClass = 'soft-badge-emerald';

                      // REGLA DE PROPIEDAD ESTRICTA: Solo el que subió el archivo o el Administrador pueden eliminarlo
                      const isAuthor = Number(file.subido_por_usuario_id) === Number(this.user.id);
                      const isAdmin = this.user.rol === 'ADMIN';
                      const canDelete = isAuthor || isAdmin;
                      const token = store.getState().token || localStorage.getItem('psi_token') || '';
                      const isPublicHttps = Number(file.es_publico) === 1 && String(file.nombre_almacenado || '').startsWith('http');
                      const viewUrl = isPublicHttps
                        ? file.nombre_almacenado
                        : `/api/materials/files/${file.id}/view?token=${encodeURIComponent(token)}`;
                      const downloadUrl = isPublicHttps
                        ? file.nombre_almacenado
                        : `/api/materials/files/${file.id}/view?download=1&token=${encodeURIComponent(token)}`;

                      return `
                        <tr>
                          <td>
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                              <div class="soft-icon-box soft-icon-box-sm ${isPdf ? 'soft-icon-box-lavender' : (isImage ? 'soft-icon-box-mint' : 'soft-icon-box-lavender')}">
                                ${isPdf ? Icons.filePdf(18, 'var(--soft-purple-primary)') : (isImage ? Icons.eye(18, 'var(--soft-mint-deep)') : Icons.fileText(18, 'var(--soft-purple-primary)'))}
                              </div>
                              <div>
                                <strong style="color: var(--soft-text-title); display: block; font-size: 0.92rem; line-height: 1.3;">
                                  ${this._escapeHtml(file.nombre_original)}
                                </strong>
                                ${file.descripcion ? `
                                  <span style="font-size: 0.77rem; color: var(--soft-text-body); display: block; margin-top: 0.12rem;">
                                    ${this._escapeHtml(file.descripcion)}
                                  </span>
                                ` : ''}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span class="soft-badge ${badgeClass}" style="text-transform: uppercase; font-size: 0.7rem;">
                              ${this._escapeHtml(file.categoria.replace(/_/g, ' '))}
                            </span>
                          </td>
                          <td style="text-align: center;">
                            ${file.es_publico === 1 ? `
                              <span class="soft-badge soft-badge-lavender" title="Compartido con todo el centro">
                                <span class="soft-status-dot-green"></span>
                                <span>Público</span>
                              </span>
                            ` : `
                              <span class="soft-badge soft-badge-coral" title="Solo visible para ti">
                                <span>Privado</span>
                              </span>
                            `}
                          </td>
                          <td>
                            <span style="color: var(--soft-text-muted); font-size: 0.82rem; font-weight: 600;">
                              ${sizeFormatted}
                            </span>
                          </td>
                          <td>
                            <div style="font-size: 0.83rem; color: var(--soft-text-title); font-weight: 600;">
                              ${this._escapeHtml(file.subido_por_nombre || 'Especialista')}
                            </div>
                          </td>
                          <td>
                            <span style="font-size: 0.8rem; color: var(--soft-text-muted);">
                              ${new Date(file.created_at).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
                            </span>
                          </td>
                          <td style="text-align: right;">
                            <div style="display: inline-flex; align-items: center; gap: 0.45rem;">
                              <button 
                                type="button" 
                                class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-preview-file" 
                                data-file-url="${this._escapeHtml(viewUrl)}"
                                data-file-name="${this._escapeHtml(file.nombre_original)}"
                                data-file-type="${file.tipo_mime}"
                                title="Previsualizar en pantalla"
                              >
                                ${Icons.eye(14, 'var(--soft-purple-primary)')}
                                <span>Ver</span>
                              </button>
                              <a 
                                href="${this._escapeHtml(downloadUrl)}" 
                                target="_blank"
                                rel="noopener noreferrer"
                                download="${this._escapeHtml(file.nombre_original)}" 
                                class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-download-file"
                                data-file-id="${file.id}"
                                title="Descargar archivo"
                              >
                                ${Icons.download(14, '#FFFFFF')}
                                <span>Descargar</span>
                              </a>
                              ${canDelete ? `
                                <button 
                                  type="button" 
                                  class="soft-btn soft-btn-sm soft-btn-lvl-2-soft btn-delete-file" 
                                  data-file-id="${file.id}"
                                  data-file-name="${this._escapeHtml(file.nombre_original)}"
                                  title="Eliminar este recurso"
                                  style="color: #DC2626;"
                                >
                                  ${Icons.close(13)}
                                </button>
                              ` : `
                                <span 
                                  class="soft-btn soft-btn-sm" 
                                  style="opacity: 0.45; cursor: not-allowed; padding: 0.35rem 0.55rem; color: var(--soft-text-muted);" 
                                  title="Solo el autor que subió este material puede eliminarlo"
                                >
                                  ${Icons.lock(12)}
                                </span>
                              `}
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        ` : ''}

      </div>
      <div id="modal-container-materials"></div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    // Selector de Ámbito: Público vs Privado
    document.getElementById('btn-scope-public')?.addEventListener('click', async () => {
      if (this.activeScope !== 'public') {
        this.activeScope = 'public';
        await this.loadFolders();
        await this.loadFiles();
        this.renderMain();
      }
    });

    document.getElementById('btn-scope-private')?.addEventListener('click', async () => {
      if (this.activeScope !== 'private') {
        this.activeScope = 'private';
        await this.loadFolders();
        await this.loadFiles();
        this.renderMain();
      }
    });

    // Pestañas de carpetas
    this.container.querySelectorAll('.btn-folder-pill').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.currentTarget.getAttribute('data-folder-id'));
        if (id && id !== this.selectedFolderId) {
          this.selectedFolderId = id;
          this.searchQuery = '';
          this.activeCategory = 'ALL';
          await this.loadFiles();
          this.renderMain();
        }
      });
    });

    // Filtros de categoría
    this.container.querySelectorAll('.btn-filter-cat').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cat = e.currentTarget.getAttribute('data-cat');
        if (cat) {
          this.activeCategory = cat;
          this.renderMain();
        }
      });
    });

    // Buscador interactivo
    const searchInput = document.getElementById('search-materials-input');
    if (searchInput) {
      let timeout = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        this.searchQuery = e.target.value;
        timeout = setTimeout(async () => {
          await this.loadFiles();
          this.renderMain();
        }, 300);
      });
    }

    // Botones de acción
    document.getElementById('btn-new-folder')?.addEventListener('click', () => this.openNewFolderModal());
    document.getElementById('btn-upload-file')?.addEventListener('click', () => this.openUploadModal());
    document.getElementById('btn-empty-upload')?.addEventListener('click', () => this.openUploadModal());

    // Previsualización de archivos
    this.container.querySelectorAll('.btn-preview-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = e.currentTarget.getAttribute('data-file-url');
        const name = e.currentTarget.getAttribute('data-file-name');
        const type = e.currentTarget.getAttribute('data-file-type');
        this.openPreviewModal(url, name, type);
      });
    });

    // Registrar descarga
    this.container.querySelectorAll('.btn-download-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileId = e.currentTarget.getAttribute('data-file-id');
        if (fileId) {
          apiClient.post(`/materials/files/${fileId}/download`).catch(() => {});
        }
      });
    });

    // Eliminar archivo
    this.container.querySelectorAll('.btn-delete-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileId = e.currentTarget.getAttribute('data-file-id');
        const fileName = e.currentTarget.getAttribute('data-file-name');
        this.confirmDeleteFile(fileId, fileName);
      });
    });
  }

  openNewFolderModal() {
    const modalContainer = document.getElementById('modal-container-materials');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="modal-folder-backdrop" style="position: fixed; inset: 0; background: rgba(36, 40, 91, 0.45); backdrop-filter: blur(6px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 520px; width: 100%;">
          
          <div style="padding: 1.25rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.folderPlus(18, 'var(--soft-purple-primary)')}
              </div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title);">
                Nueva Carpeta de Materiales
              </h3>
            </div>
            <button type="button" id="btn-close-folder-modal" class="soft-modal-close-btn" title="Cerrar">${Icons.close(18)}</button>
          </div>

          <div style="padding: 1.4rem 1.65rem;">
            <form id="form-new-folder">
              <div style="margin-bottom: 1.15rem;">
                <label class="soft-label">Nombre de la Carpeta <span class="required">*</span></label>
                <input type="text" name="nombre" required class="soft-input" placeholder="Ej. Fichas de Conciencia Fonológica" />
              </div>

              <div style="margin-bottom: 1.15rem;">
                <label class="soft-label">Descripción Clínica o Pautas</label>
                <textarea name="descripcion" rows="2" class="soft-textarea" placeholder="Ej. Material orientado a niños de 4 a 8 años con dislalia..."></textarea>
              </div>

              <div style="margin-bottom: 1.35rem;">
                <label class="soft-label">Color Temático</label>
                <div style="display: flex; gap: 0.65rem; align-items: center;">
                  ${['#584294', '#15968D', '#4B53A6', '#F59E0B', '#10B981', '#E97669'].map((c, i) => `
                    <label style="cursor: pointer;">
                      <input type="radio" name="color" value="${c}" ${i === 0 ? 'checked' : ''} style="display: none;" />
                      <div class="color-circle-pill" style="width: 28px; height: 28px; border-radius: 50%; background: ${c}; border: 2px solid ${i === 0 ? '#24285B' : 'transparent'}; transition: all 0.2s ease;"></div>
                    </label>
                  `).join('')}
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-folder" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(14, '#FFFFFF')}
                  <span>Crear Carpeta</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-folder-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-folder')?.addEventListener('click', closeModal);

    document.querySelectorAll('input[name="color"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        document.querySelectorAll('.color-circle-pill').forEach(pill => {
          pill.style.borderColor = 'transparent';
        });
        if (e.target.checked) {
          e.target.nextElementSibling.style.borderColor = '#24285B';
        }
      });
    });

    document.getElementById('form-new-folder')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const nombre = formData.get('nombre');
      const descripcion = formData.get('descripcion');
      const color = formData.get('color');

      try {
        const res = await apiClient.post('/materials/folders', {
          nombre,
          descripcion,
          color,
          es_publico: 1
        });

        if (res.success) {
          Toast.success('Carpeta creada exitosamente.');
          closeModal();
          this.selectedFolderId = res.data.id;
          await this.loadFolders();
          await this.loadFiles();
          this.renderMain();
        }
      } catch (err) {
        Toast.error(err.message || 'Error al crear carpeta.');
      }
    });
  }

  openUploadModal() {
    const modalContainer = document.getElementById('modal-container-materials');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="modal-upload-backdrop" style="position: fixed; inset: 0; background: rgba(36, 40, 91, 0.45); backdrop-filter: blur(6px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 540px; width: 100%;">
          
          <div style="padding: 1.25rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                ${Icons.upload ? Icons.upload(18, 'var(--soft-mint-deep)') : Icons.plus(18, 'var(--soft-mint-deep)')}
              </div>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title);">
                Subir Material al Repositorio
              </h3>
            </div>
            <button type="button" id="btn-close-upload-modal" class="soft-modal-close-btn" title="Cerrar">${Icons.close(18)}</button>
          </div>

          <div style="padding: 1.4rem 1.65rem;">
            <form id="form-upload-material">
              
              <div style="margin-bottom: 1.15rem;">
                <label class="soft-label">Carpeta de Destino <span class="required">*</span></label>
                <select name="carpetaId" class="soft-select" required>
                  ${this.folders.map(f => `
                    <option value="${f.id}" ${f.id === this.selectedFolderId ? 'selected' : ''}>
                      ${this._escapeHtml(f.nombre)}
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- SELECTOR DE VISIBILIDAD: PÚBLICO O PRIVADO -->
              <div style="margin-bottom: 1.15rem;">
                <label class="soft-label">Visibilidad y Privacidad del Recurso <span class="required">*</span></label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem;">
                  <label style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.75rem 0.85rem; border-radius: 12px; border: 1.5px solid var(--soft-divider); background: var(--soft-lavender-surface); cursor: pointer;">
                    <input type="radio" name="es_publico" value="1" ${this.activeScope === 'public' ? 'checked' : ''} style="accent-color: var(--soft-purple-primary); margin-top: 0.15rem;" />
                    <div>
                      <strong style="display: block; font-size: 0.82rem; color: var(--soft-text-title);">Público · Todo el Centro</strong>
                      <span style="font-size: 0.72rem; color: var(--soft-text-muted);">Visible para terapeutas y administración</span>
                    </div>
                  </label>

                  <label style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.75rem 0.85rem; border-radius: 12px; border: 1.5px solid var(--soft-divider); background: var(--soft-lavender-surface); cursor: pointer;">
                    <input type="radio" name="es_publico" value="0" ${this.activeScope === 'private' ? 'checked' : ''} style="accent-color: var(--soft-purple-primary); margin-top: 0.15rem;" />
                    <div>
                      <strong style="display: block; font-size: 0.82rem; color: var(--soft-text-title);">Privado · Solo para Mí</strong>
                      <span style="font-size: 0.72rem; color: var(--soft-text-muted);">Solo visible en mi baúl personal</span>
                    </div>
                  </label>
                </div>
              </div>

              <div style="margin-bottom: 1.15rem;">
                <label class="soft-label">Categoría del Recurso <span class="required">*</span></label>
                <select name="categoria" class="soft-select" required>
                  <option value="FICHA_TRABAJO">Ficha de Estimulación / Trabajo Práctico</option>
                  <option value="EVALUACION">Protocolo o Baremo de Evaluación</option>
                  <option value="GUIA_PADRES">Guía Psicoeducativa para Familias</option>
                  <option value="PICTOGRAMAS">Pictogramas & Apoyos Visuales</option>
                  <option value="OTRO">Otro Recurso Clínico</option>
                </select>
              </div>

              <div style="margin-bottom: 1.15rem;">
                <label class="soft-label">Descripción Breve o Notas de Uso</label>
                <input type="text" name="descripcion" class="soft-input" placeholder="Ej. Ejercicios de discriminación visual para sesión 3" />
              </div>

              <div style="margin-bottom: 1.35rem;">
                <label class="soft-label">Archivo clínico: PDF, Imagen o Word <span class="required">*</span></label>
                <input type="file" id="input-material-file" name="archivo" required class="soft-input" accept=".pdf,image/png,image/jpeg,image/webp,.docx,.doc" style="padding: 0.6rem 0.85rem;" />
                <small style="color: var(--soft-text-muted); font-size: 0.74rem; display: block; margin-top: 0.25rem;">
                  Formatos permitidos: PDF, PNG, JPG, Word DOCX hasta 10 MB.
                </small>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-upload" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" id="btn-submit-upload" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(14, '#FFFFFF')}
                  <span>Subir Archivo</span>
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-upload-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-upload')?.addEventListener('click', closeModal);

    document.getElementById('form-upload-material')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-submit-upload');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<div class="soft-spinner soft-spinner-sm" style="display: inline-block;"></div> Subiendo...`;
      }

      const formData = new FormData(e.target);
      const token = store.getState().token || localStorage.getItem('psi_token') || '';

      try {
        const response = await fetch('/api/materials/upload', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token
          },
          body: formData
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data?.error?.message || 'Error al subir material');
        }

        Toast.success('Material subido exitosamente al repositorio.');
        closeModal();
        await this.loadFolders();
        await this.loadFiles();
        this.renderMain();
      } catch (err) {
        Toast.error(err.message);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Subir Archivo`;
        }
      }
    });
  }

  openPreviewModal(fileUrl, fileName, mimeType) {
    const modalContainer = document.getElementById('modal-container-materials');
    if (!modalContainer) return;

    const isPdf = mimeType.includes('pdf');
    const isImage = mimeType.includes('image');

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="modal-preview-backdrop" style="position: fixed; inset: 0; background: rgba(36, 40, 91, 0.6); backdrop-filter: blur(8px); z-index: 2100; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 900px; width: 100%; height: 85vh; display: flex; flex-direction: column;">
          
          <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${isPdf ? Icons.filePdf(18, 'var(--soft-purple-primary)') : (isImage ? Icons.eye(18, 'var(--soft-mint-deep)') : Icons.fileText(18, 'var(--soft-purple-primary)'))}
              </div>
              <div>
                <h4 style="margin: 0; font-size: 1rem; font-weight: 800; color: var(--soft-text-title);">
                  ${this._escapeHtml(fileName)}
                </h4>
                <div style="font-size: 0.75rem; color: var(--soft-text-muted);">Previsualización integrada en navegador</div>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <a href="${fileUrl}" download="${this._escapeHtml(fileName)}" class="soft-btn soft-btn-sm soft-btn-lvl-1">
                ${Icons.download(14, '#FFFFFF')}
                <span>Descargar</span>
              </a>
              <button type="button" id="btn-close-preview" class="soft-modal-close-btn" title="Cerrar">${Icons.close(18)}</button>
            </div>
          </div>

          <div style="flex: 1; overflow: hidden; background: #0f172a; display: flex; align-items: center; justify-content: center; padding: 0.5rem;">
            ${isPdf ? `
              <iframe src="${fileUrl}#toolbar=0" style="width: 100%; height: 100%; border: none; border-radius: 6px;"></iframe>
            ` : (isImage ? `
              <img src="${fileUrl}" alt="${this._escapeHtml(fileName)}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px;" />
            ` : `
              <div style="text-align: center; color: #FFFFFF; padding: 2rem;">
                <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1rem auto;">
                  ${Icons.fileText(28, 'var(--soft-purple-primary)')}
                </div>
                <h4 style="font-size: 1.05rem; margin-bottom: 0.5rem;">Vista previa no disponible para este formato</h4>
                <p style="font-size: 0.85rem; opacity: 0.8; margin-bottom: 1.25rem;">
                  Los documentos Word (.docx) deben descargarse para visualizarse en su procesador de texto local.
                </p>
                <a href="${fileUrl}" download="${this._escapeHtml(fileName)}" class="soft-btn soft-btn-lvl-1">
                  ${Icons.download(15, '#FFFFFF')}
                  <span>Descargar Archivo Word</span>
                </a>
              </div>
            `)}
          </div>

          <div style="padding: 0.85rem 1.5rem; border-top: 1px solid var(--soft-divider); display: flex; justify-content: flex-end; background: #FFFFFF;">
            <button type="button" id="btn-close-preview-footer" class="soft-btn soft-btn-lvl-2-soft">Cerrar</button>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-close-preview')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-preview-footer')?.addEventListener('click', closeModal);
  }

  confirmDeleteFile(fileId, fileName) {
    const modalContainer = document.getElementById('modal-container-materials');
    if (!modalContainer) return;

    // ALERTA 1: PRIMERA ADVERTENCIA DE SEGURIDAD
    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="delete-backdrop" style="position: fixed; inset: 0; background: rgba(36, 40, 91, 0.55); z-index: 2200; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 460px; width: 100%;">
          <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; align-items: center; gap: 0.75rem; background: var(--soft-lavender-surface);">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender" style="color: #F59E0B;">
              ${Icons.alertTriangle(18, '#F59E0B')}
            </div>
            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--soft-text-title);">Alerta 1 · ¿Retirar Recurso Clínico?</h4>
          </div>
          <div style="padding: 1.35rem 1.5rem;">
            <p style="font-size: 0.88rem; color: var(--soft-text-body); margin: 0 0 0.85rem 0; line-height: 1.45;">
              Has solicitado retirar el archivo <strong>${this._escapeHtml(fileName)}</strong> del repositorio clínico.
            </p>
            <div style="background: rgba(245, 158, 11, 0.09); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 0.75rem 0.95rem; margin-bottom: 1.25rem; font-size: 0.82rem; color: var(--soft-text-title); line-height: 1.35;">
              <strong>Atención:</strong> En este repositorio no existe papelera de reciclaje ni bandeja de inactivos. Una vez eliminado, ningún especialista podrá volver a consultar este archivo.
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
              <button type="button" id="btn-cancel-delete-1" class="soft-btn soft-btn-lvl-2-soft">Cancelar y Conservar</button>
              <button type="button" id="btn-proceed-delete-2" class="soft-btn soft-btn-lvl-2">
                <span>Continuar a Confirmación</span>
                ${Icons.chevronRight ? Icons.chevronRight(14) : ''}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-cancel-delete-1')?.addEventListener('click', closeModal);

    // PASO A LA ALERTA 2: SEGUNDA CONFIRMACIÓN CRÍTICA E IRREVERSIBLE
    document.getElementById('btn-proceed-delete-2')?.addEventListener('click', () => {
      modalContainer.innerHTML = `
        <div class="modal-backdrop" id="delete-backdrop-2" style="position: fixed; inset: 0; background: rgba(36, 40, 91, 0.65); z-index: 2200; display: flex; align-items: center; justify-content: center; padding: 1rem;">
          <div class="soft-modal-card" style="max-width: 480px; width: 100%; border: 1.5px solid rgba(220, 38, 38, 0.35);">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--soft-divider); display: flex; align-items: center; gap: 0.75rem; background: rgba(220, 38, 38, 0.06);">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender" style="background: rgba(220, 38, 38, 0.12); color: #DC2626;">
                ${Icons.alertTriangle(18, '#DC2626')}
              </div>
              <div>
                <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #DC2626;">Alerta 2 · Confirmación Definitiva e Irreversible</h4>
                <div style="font-size: 0.74rem; color: var(--soft-text-muted);">Eliminación física permanente del servidor</div>
              </div>
            </div>
            <div style="padding: 1.35rem 1.5rem;">
              <p style="font-size: 0.88rem; color: var(--soft-text-body); margin: 0 0 1rem 0; line-height: 1.45;">
                Estás a punto de destruir definitivamente <strong>${this._escapeHtml(fileName)}</strong>. Esta operación es permanente y no podrá deshacerse bajo ninguna circunstancia.
              </p>

              <label style="display: flex; align-items: flex-start; gap: 0.65rem; cursor: pointer; font-size: 0.83rem; color: var(--soft-text-title); background: var(--soft-lavender-surface); padding: 0.75rem; border-radius: 10px; border: 1px solid var(--soft-divider); margin-bottom: 1.25rem;">
                <input type="checkbox" id="chk-permanent-confirm" style="margin-top: 0.15rem; width: 16px; height: 16px; accent-color: #DC2626; cursor: pointer;" />
                <span>Comprendo que este recurso no pasará a inactivos y autorizo su purga definitiva del centro.</span>
              </label>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
                <button type="button" id="btn-cancel-delete-2" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="button" id="btn-final-destroy" class="soft-btn soft-btn-lvl-3" style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); opacity: 0.5; cursor: not-allowed;" disabled>
                  ${Icons.trash ? Icons.trash(14, '#FFFFFF') : ''}
                  <span>Eliminar Definitivamente</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      const chk = document.getElementById('chk-permanent-confirm');
      const btnDestroy = document.getElementById('btn-final-destroy');
      document.getElementById('btn-cancel-delete-2')?.addEventListener('click', closeModal);

      chk?.addEventListener('change', (e) => {
        if (e.target.checked) {
          btnDestroy.disabled = false;
          btnDestroy.style.opacity = '1';
          btnDestroy.style.cursor = 'pointer';
        } else {
          btnDestroy.disabled = true;
          btnDestroy.style.opacity = '0.5';
          btnDestroy.style.cursor = 'not-allowed';
        }
      });

      btnDestroy?.addEventListener('click', async () => {
        if (!chk?.checked) return;
        btnDestroy.disabled = true;
        btnDestroy.textContent = 'Eliminando...';

        try {
          await apiClient.delete(`/materials/files/${fileId}`);
          Toast.success('Material purgado definitivamente del repositorio.');
          closeModal();
          await this.loadFolders();
          await this.loadFiles();
          this.renderMain();
        } catch (err) {
          Toast.error('Error al eliminar: ' + err.message);
          closeModal();
        }
      });
    });
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
