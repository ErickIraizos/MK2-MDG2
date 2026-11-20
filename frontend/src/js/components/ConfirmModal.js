import { Icons } from './Icons.js';
import { escapeHtml } from '../utils/sanitize.js';

/**
 * Modal de Confirmación Clínico Profesional
 * Despliega una advertencia antes de ejecutar acciones destructivas (eliminaciones)
 */
export class ConfirmModal {
  static show({
    title = '¿Está seguro de eliminar este registro?',
    message = 'Esta acción es permanente y no se podrá recuperar la información una vez borrada.',
    confirmText = 'Eliminar definitivamente',
    cancelText = 'Cancelar',
    type = 'danger'
  } = {}) {
    return new Promise((resolve) => {
      // Elimina cualquier modal previo si existiese
      const existing = document.getElementById('confirm-modal-backdrop');
      if (existing) existing.remove();

      // Detectar si ya existe un modal abierto en pantalla para aplicar jerarquía Nivel 3 (Sub-modal) o Nivel 2 (Modal)
      const hasOpenParentModal = Array.from(document.querySelectorAll('.modal-backdrop, .modal-overlay'))
        .some(el => window.getComputedStyle(el).display !== 'none');
      const confirmBtnLevelClass = hasOpenParentModal ? 'soft-btn-lvl-3' : 'soft-btn-lvl-2';

      const backdrop = document.createElement('div');
      backdrop.id = 'confirm-modal-backdrop';
      backdrop.className = 'modal-backdrop';
      backdrop.style.cssText = `
        position: fixed; inset: 0; background: rgba(36, 40, 91, 0.45);
        backdrop-filter: blur(8px); z-index: 9999; display: flex;
        align-items: center; justify-content: center; padding: 1.5rem;
      `;

      const isDanger = type === 'danger';
      const iconBoxCls = isDanger ? 'soft-icon-box soft-icon-box-lg soft-icon-box-rose' : 'soft-icon-box soft-icon-box-lg soft-icon-box-lavender';
      const iconSvg = isDanger ? Icons.trash(24, '#DC2626') : Icons.alert(24, 'var(--soft-purple-primary)');
      const confirmBtnStyle = isDanger 
        ? 'background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%) !important; color: #FFFFFF !important; border: 1px solid #DC2626; box-shadow: 0 4px 14px -2px rgba(220, 38, 38, 0.35);' 
        : '';

      backdrop.innerHTML = `
        <div class="soft-modal-card" style="max-width: 440px; width: 100%; padding: 2rem 1.85rem; text-align: center; position: relative;">
          <div class="${iconBoxCls}" style="margin: 0 auto 1.2rem auto;">
            ${iconSvg}
          </div>
          <h3 style="font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.55rem 0; line-height: 1.3; letter-spacing: -0.015em;">
            ${escapeHtml(title)}
          </h3>
          <p style="font-size: 0.88rem; color: var(--soft-text-body); margin: 0 0 1.65rem 0; line-height: 1.52;">
            ${escapeHtml(message)}
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center; padding-top: 1.1rem; border-top: 1px solid var(--soft-divider);">
            <button type="button" id="btn-confirm-cancel" class="soft-btn soft-btn-lvl-2-soft" style="flex: 1;">
              ${escapeHtml(cancelText)}
            </button>
            <button type="button" id="btn-confirm-ok" class="soft-btn ${confirmBtnLevelClass}" style="flex: 1.25; ${confirmBtnStyle}">
              ${escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);

      const cleanup = (result) => {
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.15s ease';
        setTimeout(() => {
          if (backdrop.parentElement) backdrop.parentElement.removeChild(backdrop);
          resolve(result);
        }, 150);
      };

      backdrop.querySelector('#btn-confirm-cancel').addEventListener('click', () => cleanup(false));
      backdrop.querySelector('#btn-confirm-ok').addEventListener('click', () => cleanup(true));
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) cleanup(false);
      });
    });
  }
}
