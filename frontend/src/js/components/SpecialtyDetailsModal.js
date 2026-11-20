import { Icons } from './Icons.js';
import { escapeHtml } from '../utils/sanitize.js';

/**
 * Modal Clínico Interactivo de Especialidades Soft UI Médica
 * Despliega información detallada con ilustración temática con animación flotante continua (acelerada por GPU).
 */
export class SpecialtyDetailsModal {
  static show(specialty) {
    if (!specialty) return;

    // Eliminar modal previo si existiese
    const existing = document.getElementById('global-specialty-details-backdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'global-specialty-details-backdrop';
    backdrop.className = 'modal-backdrop';
    backdrop.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(26, 32, 64, 0.75) !important;
      backdrop-filter: blur(10px) !important;
      -webkit-backdrop-filter: blur(10px) !important;
      z-index: 99999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 1.25rem !important;
      box-sizing: border-box !important;
      animation: fadeIn 0.22s ease-out;
    `;

    // Generar ilustración temática según la especialidad
    let illustrationHtml = '';
    let accentGradient = '';

    if (specialty.id === 'neuropsicologia') {
      accentGradient = 'linear-gradient(135deg, #7B66B5 0%, #4E3A70 100%)';
      illustrationHtml = `
        <div class="specialty-floating-element" style="width: 140px; height: 140px; border-radius: 36px; background: linear-gradient(135deg, rgba(88,66,148,0.15) 0%, rgba(139,114,214,0.25) 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 16px 36px rgba(88,66,148,0.18); border: 2px solid rgba(255,255,255,0.9);">
          <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="var(--soft-purple-primary)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.2 4.7 3 6v3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3c1.8-1.3 3-3.5 3-6a7 7 0 0 0-7-7z"/>
            <path d="M9 22h6"/>
            <path d="M10 9a2 2 0 1 1 4 0"/>
            <path d="M12 13v1"/>
          </svg>
        </div>
      `;
    } else if (specialty.id === 'psicopedagogia') {
      accentGradient = 'linear-gradient(135deg, #0D9488 0%, #15968D 100%)';
      illustrationHtml = `
        <div class="specialty-floating-element" style="width: 140px; height: 140px; border-radius: 36px; background: linear-gradient(135deg, rgba(21,150,141,0.15) 0%, rgba(79,209,197,0.25) 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 16px 36px rgba(21,150,141,0.18); border: 2px solid rgba(255,255,255,0.9);">
          <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="var(--soft-mint-deep)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
            <path d="M6 6h10"/>
            <path d="M6 10h10"/>
            <path d="M6 14h7"/>
          </svg>
        </div>
      `;
    } else if (specialty.id === 'psicoterapia') {
      accentGradient = 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)';
      illustrationHtml = `
        <div class="specialty-floating-element" style="width: 140px; height: 140px; border-radius: 36px; background: linear-gradient(135deg, rgba(79,70,229,0.15) 0%, rgba(129,140,248,0.25) 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 16px 36px rgba(79,70,229,0.18); border: 2px solid rgba(255,255,255,0.9);">
          <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="var(--soft-indigo-accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        </div>
      `;
    } else {
      // psicogerontologia
      accentGradient = 'linear-gradient(135deg, #8B5CF6 0%, #584294 100%)';
      illustrationHtml = `
        <div class="specialty-floating-element" style="width: 140px; height: 140px; border-radius: 36px; background: linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(196,181,253,0.25) 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 16px 36px rgba(139,92,246,0.18); border: 2px solid rgba(255,255,255,0.9);">
          <svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="var(--soft-purple-primary)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
      `;
    }

    backdrop.innerHTML = `
      <style>
        @keyframes softFloatAnimation {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-10px) rotate(1.4deg);
          }
        }
        .specialty-floating-element {
          animation: softFloatAnimation 4.2s ease-in-out infinite;
          will-change: transform;
        }
      </style>

      <div class="soft-modal-card" style="max-width: 860px; width: 100%; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 50px -10px rgba(50, 40, 95, 0.45); background: #FFFFFF; border-radius: var(--soft-radius-3xl, 24px); border: 1px solid rgba(139, 114, 214, 0.22); animation: modalIn 0.24s cubic-bezier(0.16, 1, 0.3, 1);">
        
        <!-- CABECERA FIJA -->
        <div style="padding: 1.15rem 1.65rem; border-bottom: 1px solid var(--soft-divider, #F0EEF9); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface, #F8F6FE); gap: 1rem; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="soft-icon-box soft-icon-box-sm ${specialty.iconBoxClass}">
              ${Icons.stethoscope(20, specialty.iconColor)}
            </div>
            <div>
              <span class="soft-badge ${specialty.badgeClass}" style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">
                ${escapeHtml(specialty.badge)}
              </span>
              <h3 style="color: var(--soft-text-title, #24285B); font-size: 1.18rem; font-weight: 800; margin: 0.2rem 0 0 0; letter-spacing: -0.015em; line-height: 1.25;">
                ${escapeHtml(specialty.title)}
              </h3>
            </div>
          </div>

          <button type="button" class="soft-modal-close-btn" id="btn-close-specialty-modal" title="Cerrar ventana">
            ${Icons.close(18)}
          </button>
        </div>

        <!-- CUERPO DIVIDIDO EN 2 COLUMNAS (DESKTOP) CON SCROLL -->
        <div class="soft-modal-scroll" style="padding: 1.75rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr)); gap: 1.75rem; overflow-y: auto; max-height: calc(92vh - 145px); align-items: start; background: #FFFFFF;">
          
          <!-- COLUMNA IZQUIERDA: ILUSTRACIÓN EN MOVIMIENTO SUAVE Y DATOS CLAVE -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 1.25rem; background: var(--soft-lavender-surface); border-radius: 20px; padding: 1.75rem 1.35rem; border: 1px solid var(--soft-border-card-inner); text-align: center;">
            
            ${illustrationHtml}

            <div>
              <h4 style="margin: 0.35rem 0 0.25rem 0; font-size: 1.05rem; font-weight: 800; color: var(--soft-text-title);">
                ${escapeHtml(specialty.subtitle)}
              </h4>
              <p style="margin: 0; font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.45;">
                Protocolo estandarizado de atención clínica bajo normativa de la Ley 3131 y el Colegio de Psicólogos de Bolivia.
              </p>
            </div>

            <!-- CHIPS CLÍNICOS -->
            <div style="display: flex; flex-direction: column; gap: 0.55rem; width: 100%; text-align: left;">
              <div style="display: flex; align-items: center; gap: 0.55rem; background: #FFFFFF; border-radius: 12px; padding: 0.65rem 0.85rem; font-size: 0.8rem; border: 1px solid var(--soft-border-card-inner);">
                <span style="color: var(--soft-mint-deep); flex-shrink: 0;">${Icons.check(14, 'var(--soft-mint-deep)')}</span>
                <span style="color: var(--soft-text-title); font-weight: 600;">Evaluación con Baterías Baremadas</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.55rem; background: #FFFFFF; border-radius: 12px; padding: 0.65rem 0.85rem; font-size: 0.8rem; border: 1px solid var(--soft-border-card-inner);">
                <span style="color: var(--soft-mint-deep); flex-shrink: 0;">${Icons.check(14, 'var(--soft-mint-deep)')}</span>
                <span style="color: var(--soft-text-title); font-weight: 600;">Plan Terapéutico Individualizado PTI</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.55rem; background: #FFFFFF; border-radius: 12px; padding: 0.65rem 0.85rem; font-size: 0.8rem; border: 1px solid var(--soft-border-card-inner);">
                <span style="color: var(--soft-mint-deep); flex-shrink: 0;">${Icons.check(14, 'var(--soft-mint-deep)')}</span>
                <span style="color: var(--soft-text-title); font-weight: 600;">Seguimiento Familiar &amp; Escolar Continuo</span>
              </div>
            </div>

            <!-- BOTÓN DIRECTO DE CONSULTA -->
            <a 
              href="https://wa.me/59162717425?text=${encodeURIComponent(`Hola Centro PSI Aprende, solicito información sobre la especialidad de ${specialty.title}.`)}" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="soft-btn soft-btn-lvl-1"
              style="width: 100%; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; padding: 0.72rem 1.15rem; font-size: 0.86rem;"
            >
              ${Icons.whatsapp(16, '#FFFFFF')}
              <span>Solicitar Turno en Esta Área</span>
            </a>

          </div>

          <!-- COLUMNA DERECHA: INFORMACIÓN CLÍNICA DETALLADA -->
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            
            <!-- ¿QUÉ ES? -->
            <div>
              <span style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-text-overline); display: block; margin-bottom: 0.35rem;">
                Definición y Enfoque Clínico
              </span>
              <p style="margin: 0; font-size: 0.92rem; color: var(--soft-text-body); line-height: 1.6;">
                ${escapeHtml(specialty.queEs)}
              </p>
            </div>

            <!-- SEÑALES OBSERVABLES -->
            <div style="background: var(--soft-lavender-surface); border-radius: 16px; padding: 1.15rem 1.25rem; border: 1px solid var(--soft-border-card-inner);">
              <div style="display: flex; align-items: center; gap: 0.45rem; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-mint-deep); margin-bottom: 0.65rem;">
                ${Icons.alertTriangle(14, 'var(--soft-mint-deep)')}
                <span>¿Cuándo es oportuno acudir a consulta?</span>
              </div>
              <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.86rem; color: var(--soft-text-title); line-height: 1.65;">
                ${specialty.cuandoConsultar.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
              </ul>
            </div>

            <!-- PRUEBAS Y HERRAMIENTAS -->
            <div style="border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
              <strong style="color: var(--soft-text-title); font-size: 0.88rem; display: block; margin-bottom: 0.25rem;">
                Baterías Diagnósticas y Materiales Estructurados:
              </strong>
              <div style="font-size: 0.84rem; color: var(--soft-text-body); line-height: 1.48;">
                ${escapeHtml(specialty.pruebas)}
              </div>
            </div>

            <!-- RESULTADO Y BENEFICIOS PARA LA FAMILIA -->
            <div style="border-top: 1px solid var(--soft-divider); padding-top: 1rem;">
              <strong style="color: var(--soft-text-title); font-size: 0.88rem; display: block; margin-bottom: 0.25rem;">
                Impacto Terapéutico y Beneficio Familiar:
              </strong>
              <div style="font-size: 0.84rem; color: var(--soft-text-body); line-height: 1.48;">
                ${escapeHtml(specialty.beneficio)}
              </div>
            </div>

          </div>

        </div>

        <!-- PIE FIJO -->
        <div style="padding: 0.95rem 1.65rem; border-top: 1px solid var(--soft-divider, #F0EEF9); background: var(--soft-lavender-surface, #F8F6FE); display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-shrink: 0; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--soft-text-muted);">
            ${Icons.shield(15, 'var(--soft-purple-primary)')}
            <span>Equipo Colegiado · Matrícula CPB Oficial</span>
          </div>

          <button type="button" id="btn-close-specialty-footer" class="soft-btn soft-btn-lvl-1-muted">
            Cerrar Guía
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(backdrop);

    const closeModal = () => {
      backdrop.style.opacity = '0';
      backdrop.style.transition = 'opacity 0.18s ease-out';
      setTimeout(() => backdrop.remove(), 190);
    };

    backdrop.querySelector('#btn-close-specialty-modal')?.addEventListener('click', closeModal);
    backdrop.querySelector('#btn-close-specialty-footer')?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  }
}
