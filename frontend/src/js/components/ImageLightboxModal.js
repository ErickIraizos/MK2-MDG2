import { Icons } from './Icons.js';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize.js';

/**
 * Modal Visor de Imagen Clínico Institucional (Lightbox)
 * Despliega fotografías y logotipos en alta resolución en una ventana emergente Soft UI Médica (Nivel 2)
 */
export class ImageLightboxModal {
  static show({
    imageUrl = '',
    title = 'Institución Aliada',
    subtitle = 'Convenio Institucional',
    description = '',
    benefit = ''
  } = {}) {
    if (!imageUrl) return;

    // Eliminar lightbox previo si existiese en el DOM
    const existing = document.getElementById('global-image-lightbox-backdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'global-image-lightbox-backdrop';
    backdrop.className = 'modal-backdrop';
    backdrop.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(26, 32, 64, 0.72) !important;
      backdrop-filter: blur(10px) !important;
      -webkit-backdrop-filter: blur(10px) !important;
      z-index: 99999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 1.25rem !important;
      box-sizing: border-box !important;
      animation: fadeIn 0.2s ease-out;
    `;

    backdrop.innerHTML = `
      <div class="soft-modal-card" style="max-width: 720px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 50px -10px rgba(50, 40, 95, 0.45); background: #FFFFFF; border-radius: var(--soft-radius-3xl, 24px); border: 1px solid rgba(139, 114, 214, 0.22); animation: modalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);">
        
        <!-- CABECERA FIJA (NIVEL 2) -->
        <div style="padding: 1.15rem 1.55rem; border-bottom: 1px solid var(--soft-divider, #F0EEF9); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface, #F8F6FE); gap: 1rem; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.eye(20, 'var(--soft-purple-primary, #584294)')}
            </div>
            <div>
              <h3 style="color: var(--soft-text-title, #24285B); font-size: 1.12rem; font-weight: 800; margin: 0; letter-spacing: -0.015em; line-height: 1.3;">
                ${escapeHtml(title)}
              </h3>
              ${subtitle ? `
                <div style="font-size: 0.78rem; color: var(--soft-text-body, #696F8C); margin-top: 0.15rem;">
                  ${escapeHtml(subtitle)}
                </div>
              ` : ''}
            </div>
          </div>

          <button type="button" class="soft-modal-close-btn" id="btn-close-img-lightbox" title="Cerrar ventana">
            ${Icons.close(18)}
          </button>
        </div>

        <!-- CUERPO CON SCROLL SUAVE Y VISOR DE IMAGEN -->
        <div class="soft-modal-scroll" style="padding: 1.45rem 1.65rem; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #FFFFFF; overflow-y: auto; max-height: calc(90vh - 130px);">
          
          <div style="width: 100%; max-width: 640px; display: flex; justify-content: center; align-items: center; background: var(--soft-lavender-surface, #F8F6FE); border-radius: 16px; padding: 1.25rem; border: 1px solid var(--soft-border-card-inner, rgba(110, 86, 176, 0.12)); box-shadow: inset 0 2px 6px rgba(88, 66, 148, 0.04);">
            <img 
              src="${escapeHtml(sanitizeUrl(imageUrl, { allowDataImage: true }))}" 
              alt="${escapeHtml(title)}" 
              style="max-width: 100%; max-height: 52vh; object-fit: contain; border-radius: 10px; box-shadow: 0 4px 18px rgba(88, 66, 148, 0.12); background: #FFFFFF;" 
            />
          </div>

          ${description ? `
            <p style="margin-top: 1.1rem; font-size: 0.88rem; color: var(--soft-text-body, #696F8C); text-align: center; max-width: 600px; line-height: 1.5; margin-bottom: 0;">
              ${escapeHtml(description)}
            </p>
          ` : ''}

          ${benefit ? `
            <div style="margin-top: 0.85rem; background: var(--soft-lavender-surface, #F8F6FE); border: 1px dashed var(--soft-purple-primary, #7B66B5); border-radius: 12px; padding: 0.65rem 1.15rem; font-size: 0.83rem; color: var(--soft-purple-primary, #584294); font-weight: 600; display: inline-flex; align-items: center; gap: 0.45rem;">
              ${Icons.gift(15, 'var(--soft-purple-primary, #584294)')}
              <span>Beneficio: ${escapeHtml(benefit)}</span>
            </div>
          ` : ''}
        </div>

        <!-- PIE FIJO (NIVEL 2) -->
        <div style="padding: 0.9rem 1.65rem; border-top: 1px solid var(--soft-divider, #F0EEF9); background: var(--soft-lavender-surface, #F8F6FE); display: flex; justify-content: flex-end; gap: 0.75rem; flex-shrink: 0;">
          <button type="button" id="btn-close-img-lightbox-footer" class="soft-btn soft-btn-lvl-2-soft">
            Cerrar
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(backdrop);

    const close = () => {
      document.removeEventListener('keydown', handleKey);
      backdrop.remove();
    };

    const handleKey = (e) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('keydown', handleKey);

    const closeBtn = backdrop.querySelector('#btn-close-img-lightbox');
    const footerBtn = backdrop.querySelector('#btn-close-img-lightbox-footer');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (footerBtn) footerBtn.addEventListener('click', close);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }
}
