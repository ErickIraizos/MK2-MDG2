import { apiClient } from '../../api/apiClient.js';
import { Toast } from '../../components/Toast.js';
import { Icons } from '../../components/Icons.js';
import { ConfirmModal } from '../../components/ConfirmModal.js';

export class RoomsAndConfigView {
  constructor(container) {
    this.container = container;
    this.rooms = [];
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async render() {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem;">
        <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto;">
          <div style="display: inline-flex; animation: spin 1.1s linear infinite;">${Icons.pulse(24, 'var(--soft-purple-primary)')}</div>
        </div>
        <p style="color: var(--soft-text-body); margin-top: 0.9rem; font-weight: 500; font-size: 0.9rem;">Cargando infraestructura de consultorios clínicos...</p>
      </div>
    `;

    try {
      const roomsRes = await apiClient.get('/rooms?includeInactive=true');
      this.rooms = roomsRes.data || [];

      const activeRoomsCount = this.rooms.filter(r => r.activo === 1 || r.activo === true).length;
      const maintenanceRoomsCount = this.rooms.length - activeRoomsCount;

      this.container.innerHTML = `
        <div class="page-container panel-general">
          <!-- CABECERA -->
          <div class="soft-header-row">
            <div>
              <div class="soft-header-meta">
                <a href="#/dashboard" class="soft-back-link">
                  &larr; Volver al Panel Principal
                </a>
                <span class="soft-badge soft-badge-mint">Infraestructura Clínica</span>
              </div>
              <h1 class="soft-page-title">
                Gestión de Consultorios y Salas Clínicas
              </h1>
              <p class="soft-page-subtitle" style="max-width: 760px;">
                Administración elástica de ambientes físicos de atención diagnóstica y terapéutica. Configure salas, capacidades, equipamiento sensorial y disponibilidad operativa en tiempo real.
              </p>
            </div>

            <div class="soft-header-actions">
              <a href="#/admin/settings" class="soft-btn soft-btn-lvl-1-muted">
                ${Icons.settings(16, 'currentColor')}
                <span>Ajustes del Sistema</span>
              </a>
              <button type="button" id="btn-create-room" class="soft-btn soft-btn-lvl-1">
                ${Icons.plus(16, '#FFFFFF')}
                <span>Nuevo Consultorio</span>
              </button>
            </div>
          </div>

          <!-- FRANJA DE RESUMEN OPERATIVO -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 1.35rem; margin-bottom: 2rem;">
            <div class="soft-kpi-card">
              <div class="soft-icon-box soft-icon-box-lavender">
                ${Icons.rooms(22, 'var(--soft-purple-primary)')}
              </div>
              <div class="soft-kpi-body">
                <span class="soft-kpi-overline">Capacidad Instalada Total</span>
                <div class="soft-kpi-value" style="font-size: 1.35rem;">${this.rooms.length} Salas</div>
              </div>
            </div>

            <div class="soft-kpi-card soft-kpi-mint">
              ${activeRoomsCount > 0 ? '<span class="soft-status-dot-green" title="Consultorios operativos" aria-hidden="true"></span>' : ''}
              <div class="soft-icon-box soft-icon-box-mint">
                ${Icons.checkCircle(22, 'var(--soft-mint-deep)')}
              </div>
              <div class="soft-kpi-body">
                <span class="soft-kpi-overline">Disponibles para Turnos</span>
                <div class="soft-kpi-value" style="font-size: 1.35rem; color: var(--soft-emerald-dark);">${activeRoomsCount} Operativos</div>
              </div>
            </div>

            <div class="soft-kpi-card">
              <div class="soft-icon-box soft-icon-box-indigo">
                ${Icons.pulse(22, 'var(--soft-indigo-accent)')}
              </div>
              <div class="soft-kpi-body">
                <span class="soft-kpi-overline">Pausa Temporal</span>
                <div class="soft-kpi-value" style="font-size: 1.35rem;">${maintenanceRoomsCount} Mantenimiento</div>
              </div>
            </div>
          </div>

          <!-- CUADRÍCULA DE CONSULTORIOS -->
          <div class="soft-section-card">
            <div class="soft-section-header">
              <div>
                <h3 class="soft-section-title">
                  Directorio de Ambientes Físicos de Atención
                </h3>
                <p class="soft-section-subtitle">
                  Espacios clínicos asignables con control anti-colisión en tiempo real (Regla RN-01)
                </p>
              </div>
              <span class="soft-badge soft-badge-mint">Sede Central · Cochabamba</span>
            </div>

            <div class="soft-rooms-grid">
              ${this.rooms.map((room, idx) => {
                const isMint = idx % 2 === 0;
                const isActivo = room.activo === 1 || room.activo === true;
                const cleanSpecialty = String(room.tipo || 'Integral').replace(/_/g, ' ');

                return `
                  <div class="soft-room-card ${isMint ? 'soft-room-mint' : ''}">
                    <div>
                      <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.9rem;">
                        <span class="soft-badge ${isMint ? 'soft-badge-mint' : 'soft-badge-lavender'}">
                          ${this.escapeHtml(room.codigo)}
                        </span>
                        <span class="soft-badge ${isActivo ? 'soft-badge-emerald' : 'soft-badge-amber'}">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
                          <span>${isActivo ? 'Disponible' : 'Fuera de Servicio'}</span>
                        </span>
                      </div>

                      <h4 style="font-size: 1.1rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.45rem 0; line-height: 1.3; letter-spacing: -0.015em;">
                        ${this.escapeHtml(room.nombre)}
                      </h4>
                      <div style="font-size: 0.82rem; color: var(--soft-text-overline); font-weight: 600; margin-bottom: 0.65rem; display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem;">
                        <span>Especialidad:</span>
                        <span class="soft-specialty-tag">${this.escapeHtml(cleanSpecialty)}</span>
                      </div>
                      <p style="font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.5; margin: 0 0 0.5rem 0;">
                        ${this.escapeHtml(room.descripcion) || 'Sin descripción u observaciones adicionales.'}
                      </p>
                    </div>

                    <div style="margin-top: 1.15rem; padding-top: 0.9rem; border-top: 1px solid var(--soft-divider);">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; font-size: 0.83rem;">
                        <span style="color: var(--soft-text-muted); font-weight: 500;">Capacidad en sala:</span>
                        <strong style="color: var(--soft-text-title); font-weight: 700;">${room.capacidad} personas</strong>
                      </div>
                      <div style="display: flex; gap: 0.55rem; justify-content: flex-end;">
                        <button 
                          type="button"
                          class="soft-btn soft-btn-sm soft-btn-lvl-1 btn-edit-room" 
                          data-id="${room.id}" 
                          data-codigo="${this.escapeHtml(room.codigo)}"
                          data-nombre="${this.escapeHtml(room.nombre)}" 
                          data-tipo="${this.escapeHtml(room.tipo || '')}"
                          data-capacidad="${room.capacidad}"
                          data-activo="${isActivo ? '1' : '0'}"
                          data-descripcion="${this.escapeHtml(room.descripcion || '')}"
                          title="Editar consultorio"
                        >
                          ${Icons.edit(14, '#FFFFFF')}
                          <span>Editar</span>
                        </button>
                        <button 
                          type="button"
                          class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-delete-room" 
                          data-id="${room.id}" 
                          data-codigo="${this.escapeHtml(room.codigo)}"
                          data-nombre="${this.escapeHtml(room.nombre)}"
                          title="Eliminar consultorio"
                        >
                          ${Icons.trash(14, 'currentColor')}
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- TARJETA INFORMATIVA: POLÍTICAS DE SALAS -->
          <div class="soft-section-card" style="margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.25rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                ${Icons.clinic(20, 'var(--soft-mint-deep)')}
              </div>
              <h3 class="soft-section-title" style="font-size: 1.15rem; margin: 0;">
                Normativas Clínicas sobre el Uso de Consultorios
              </h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)); gap: 1.15rem; font-size: 0.85rem; color: var(--soft-text-body); line-height: 1.52;">
              <div class="soft-subcard">
                <div>
                  <strong style="color: var(--soft-text-title); display: block; margin-bottom: 0.25rem;">Regla RN-01 (Exclusividad Física):</strong>
                  Ningún consultorio puede albergar dos citas simultáneas en el mismo bloque horario. El algoritmo anti-colisión rechaza cruces de forma matemática.
                </div>
              </div>
              <div class="soft-subcard">
                <div>
                  <strong style="color: var(--soft-text-title); display: block; margin-bottom: 0.25rem;">Regla RN-02 (Margen de Ventilación):</strong>
                  Se contempla un margen preventivo obligatorio de 10 minutos entre sesiones para ventilación acústica, desinfección y recolocación de reactivos.
                </div>
              </div>
              <div class="soft-subcard">
                <div>
                  <strong style="color: var(--soft-text-title); display: block; margin-bottom: 0.25rem;">Capacidad Incremental:</strong>
                  Para habilitar un nuevo ambiente ante el crecimiento del centro, use el botón superior <em>"Nuevo Consultorio"</em>. Se integrará de inmediato en la agenda.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- MODAL CRUD DE CONSULTORIO (CREAR / EDITAR — NIVEL 2) -->
        <div id="room-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(36, 40, 91, 0.45); backdrop-filter: blur(8px); z-index: 1050; align-items: center; justify-content: center; padding: 1rem;">
          <div class="soft-modal-card" style="max-width: 530px; width: 100%;">
            <div style="padding: 1.35rem 1.75rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 0.8rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                  ${Icons.rooms(20, 'var(--soft-purple-primary)')}
                </div>
                <h3 id="room-modal-title" style="font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title); margin: 0; letter-spacing: -0.015em;">
                  Consultorio
                </h3>
              </div>
              <button type="button" id="modal-close" class="soft-modal-close-btn" aria-label="Cerrar">
                ${Icons.close(18)}
              </button>
            </div>

            <form id="room-crud-form" style="padding: 1.45rem 1.75rem;">
              <input type="hidden" id="room-form-id" />

              <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 1rem; margin-bottom: 1.05rem;">
                <div>
                  <label class="soft-label" for="room-codigo">Código <span class="required">*</span></label>
                  <input type="text" id="room-codigo" class="soft-input" placeholder="CONS-04" required />
                  <div style="font-size: 0.73rem; color: var(--soft-text-muted); margin-top: 0.25rem;">Identificador único</div>
                </div>

                <div>
                  <label class="soft-label" for="room-nombre">Nombre de la Sala <span class="required">*</span></label>
                  <input type="text" id="room-nombre" class="soft-input" placeholder="Ej. Sala Sensorial y Juego" required />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 1rem; margin-bottom: 1.05rem;">
                <div>
                  <label class="soft-label" for="room-tipo">Especialidad / Enfoque</label>
                  <select id="room-tipo" class="soft-select">
                    <option value="Infantil / Neuropsicología">Infantil / Neuropsicología</option>
                    <option value="Psicopedagogía y Aprendizaje">Psicopedagogía y Aprendizaje</option>
                    <option value="Evaluación Integral / Conductual">Evaluación Integral / Conductual</option>
                    <option value="Adultos y Psicogerontología">Adultos y Psicogerontología</option>
                    <option value="Terapia de Lenguaje / Fonoaudiología">Terapia de Lenguaje / Fonoaudiología</option>
                    <option value="Polivalente / General">Polivalente / General</option>
                  </select>
                </div>

                <div>
                  <label class="soft-label" for="room-capacidad">Capacidad <span class="required">*</span></label>
                  <input type="number" id="room-capacidad" class="soft-input" min="1" max="25" value="4" required />
                </div>
              </div>

              <div style="margin-bottom: 1.05rem;">
                <label class="soft-label" for="room-activo">Estado Operativo</label>
                <select id="room-activo" class="soft-select">
                  <option value="1">Disponible (Operativo para Turnos)</option>
                  <option value="0">Fuera de Servicio (En Mantenimiento)</option>
                </select>
              </div>

              <div style="margin-bottom: 1.45rem;">
                <label class="soft-label" for="room-descripcion">Descripción u Observaciones Clínicas</label>
                <textarea id="room-descripcion" class="soft-textarea" rows="2" placeholder="Equipamiento lúdico, reactivos o materiales neurocognitivos disponibles..."></textarea>
              </div>

              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding-top: 1.15rem;">
                <button type="button" id="btn-cancel-modal" class="soft-btn soft-btn-lvl-2-soft">Cancelar</button>
                <button type="submit" id="btn-submit-room" class="soft-btn soft-btn-lvl-2">
                  ${Icons.check(15, '#FFFFFF')}
                  <span>Guardar Consultorio</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      this.attachEvents();
    } catch (err) {
      this.container.innerHTML = `
        <div class="page-container panel-general">
          <div class="soft-card-static" style="margin-top: 1.5rem; text-align: center; padding: 2.75rem 2rem;">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1rem auto;">
              ${Icons.alert(26, 'var(--soft-purple-primary)')}
            </div>
            <h3 style="color: var(--soft-text-title); font-size: 1.22rem; font-weight: 800; margin: 0 0 0.45rem 0;">Error al cargar consultorios</h3>
            <p style="color: var(--soft-text-body); margin: 0 auto 1.4rem auto; max-width: 480px;">${this.escapeHtml(err.message)}</p>
            <a href="#/dashboard" class="soft-btn soft-btn-lvl-1">Volver al Panel</a>
          </div>
        </div>
      `;
    }
  }

  attachEvents() {
    const modal = document.getElementById('room-modal');
    const modalTitle = document.getElementById('room-modal-title');
    const modalClose = document.getElementById('modal-close');
    const btnCancel = document.getElementById('btn-cancel-modal');
    const btnCreateRoom = document.getElementById('btn-create-room');
    const roomForm = document.getElementById('room-crud-form');
    
    const idInput = document.getElementById('room-form-id');
    const codigoInput = document.getElementById('room-codigo');
    const nombreInput = document.getElementById('room-nombre');
    const tipoInput = document.getElementById('room-tipo');
    const capacidadInput = document.getElementById('room-capacidad');
    const activoInput = document.getElementById('room-activo');
    const descripcionInput = document.getElementById('room-descripcion');

    const openModal = (isEdit = false, roomData = {}) => {
      if (!modal) return;
      modal.style.display = 'flex';
      
      if (isEdit) {
        modalTitle.textContent = `Editar ${roomData.codigo}`;
        idInput.value = roomData.id;
        codigoInput.value = roomData.codigo;
        codigoInput.disabled = true;
        nombreInput.value = roomData.nombre;
        tipoInput.value = roomData.tipo || 'Integral';
        capacidadInput.value = roomData.capacidad || 4;
        activoInput.value = (roomData.activo === true || roomData.activo === '1' || roomData.activo === 1) ? '1' : '0';
        descripcionInput.value = roomData.descripcion || '';
      } else {
        modalTitle.textContent = 'Nuevo Consultorio Clínico';
        idInput.value = '';
        codigoInput.value = '';
        codigoInput.disabled = false;
        nombreInput.value = '';
        tipoInput.value = 'Infantil / Neuropsicología';
        capacidadInput.value = 4;
        activoInput.value = '1';
        descripcionInput.value = '';
      }
    };

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
      if (roomForm) roomForm.reset();
    };

    btnCreateRoom?.addEventListener('click', () => openModal(false));
    modalClose?.addEventListener('click', closeModal);
    btnCancel?.addEventListener('click', closeModal);

    // Botones de editar en cada tarjeta
    document.querySelectorAll('.btn-edit-room').forEach(btn => {
      btn.addEventListener('click', () => {
        openModal(true, {
          id: btn.dataset.id,
          codigo: btn.dataset.codigo,
          nombre: btn.dataset.nombre,
          tipo: btn.dataset.tipo,
          capacidad: btn.dataset.capacidad,
          activo: btn.dataset.activo,
          descripcion: btn.dataset.descripcion
        });
      });
    });

    // Botones de eliminar en cada tarjeta con ConfirmModal
    document.querySelectorAll('.btn-delete-room').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const codigo = btn.dataset.codigo;
        const nombre = btn.dataset.nombre;

        const confirmed = await ConfirmModal.show({
          title: `¿Eliminar ${codigo}?`,
          message: `¿Está seguro de eliminar permanentemente el consultorio "${nombre}" (${codigo})? Esta acción no se puede deshacer.`,
          confirmText: 'Sí, eliminar consultorio',
          cancelText: 'Cancelar'
        });

        if (confirmed) {
          try {
            await apiClient.delete(`/rooms/${id}`);
            Toast.success(`Consultorio ${codigo} eliminado exitosamente.`);
            await this.render();
          } catch (err) {
            Toast.error(err.message || 'Error al eliminar el consultorio.');
          }
        }
      });
    });

    // Envío del formulario (Crear o Actualizar)
    if (roomForm) {
      roomForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = idInput.value;
        const isEdit = Boolean(id);

        const payload = {
          nombre: nombreInput.value.trim(),
          tipo: tipoInput.value,
          capacidad: Number(capacidadInput.value),
          activo: activoInput.value === '1',
          descripcion: descripcionInput.value.trim()
        };

        if (!isEdit) {
          payload.codigo = codigoInput.value.trim().toUpperCase();
        }

        try {
          if (isEdit) {
            await apiClient.put(`/rooms/${id}`, payload);
            Toast.success('Consultorio actualizado exitosamente.');
          } else {
            await apiClient.post('/rooms', payload);
            Toast.success(`Consultorio ${payload.codigo} creado exitosamente.`);
          }
          closeModal();
          await this.render();
        } catch (err) {
          Toast.error(err.message || 'Ocurrió un error al guardar el consultorio.');
        }
      });
    }
  }
}

// Alias de exportación
export { RoomsAndConfigView as RoomsView };
