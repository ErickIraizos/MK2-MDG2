import { Icons } from './Icons.js';
import { escapeHtml, sanitizeUrl } from '../utils/sanitize.js';

/**
 * Modal Interactivo con Carrusel de Información e Imágenes para Convenios Soft UI Médica
 * Despliega la articulación institucional, beneficios arancelarios y requisitos de acceso en diapositivas con transición automática y controles sincronizados.
 */
export class ConvenioCarouselModal {
  static show(convenio) {
    if (!convenio) return;

    // Eliminar modal previo si existiese
    const existing = document.getElementById('global-convenio-carousel-backdrop');
    if (existing) existing.remove();

    const cleanPhone = convenio.telefono_contacto ? String(convenio.telefono_contacto).replace(/[^\d]/g, '') : '';
    const whatsappLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('591') ? cleanPhone : '591' + cleanPhone}` : null;
    const rawWebLink = convenio.sitio_web ? (convenio.sitio_web.startsWith('http') ? convenio.sitio_web : `https://${convenio.sitio_web}`) : null;
    const webLink = rawWebLink ? sanitizeUrl(rawWebLink) : null;
    const safeImgUrl = convenio.imagen_url ? sanitizeUrl(convenio.imagen_url, { allowDataImage: true }) : '';

    let currentSlide = 0;
    const totalSlides = 3;
    let autoPlayTimer = null;

    const backdrop = document.createElement('div');
    backdrop.id = 'global-convenio-carousel-backdrop';
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

    backdrop.innerHTML = `
      <style>
        .convenio-carousel-nav-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--soft-purple-primary, #584294) !important;
          color: #FFFFFF !important;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 18px rgba(88, 66, 148, 0.35);
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 30;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s ease, box-shadow 0.2s ease;
        }
        .convenio-carousel-nav-btn:hover {
          transform: translateY(-50%) scale(1.08);
          background: var(--soft-purple-deep, #463479) !important;
          box-shadow: 0 8px 22px rgba(88, 66, 148, 0.45);
        }
        .convenio-carousel-nav-btn:active {
          transform: translateY(-50%) scale(0.96);
        }
        .convenio-slide-content {
          padding: 1.5rem 4.5rem !important;
          box-sizing: border-box;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          width: 33.3333% !important;
          min-width: 33.3333% !important;
          max-width: 33.3333% !important;
          flex: 0 0 33.3333% !important;
          height: 100%;
        }
        #convenio-slides-track {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          width: 300% !important;
          min-width: 300% !important;
          max-width: none !important;
          height: 100%;
        }
        @media (max-width: 640px) {
          .convenio-slide-content {
            padding: 1.15rem 1.15rem !important;
          }
          .convenio-carousel-nav-btn {
            width: 34px !important;
            height: 34px !important;
            opacity: 0.92;
          }
          #btn-carousel-prev {
            left: 6px !important;
          }
          #btn-carousel-next {
            right: 6px !important;
          }
        }
      </style>

      <div id="convenio-carousel-modal-surface" class="soft-modal-card" style="max-width: 820px; width: 100%; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 50px -10px rgba(50, 40, 95, 0.45); background: #FFFFFF; border-radius: var(--soft-radius-3xl, 24px); border: 1px solid rgba(139, 114, 214, 0.22); animation: modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
        
        <!-- CABECERA INSTITUCIONAL -->
        <div style="padding: 1.15rem 1.65rem; border-bottom: 1px solid var(--soft-divider, #F0EEF9); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface, #F8F6FE); gap: 1rem; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
              ${Icons.handshake(20, 'var(--soft-purple-primary, #584294)')}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <h3 style="color: var(--soft-text-title, #24285B); font-size: 1.14rem; font-weight: 800; margin: 0; letter-spacing: -0.015em; line-height: 1.3;">
                  ${escapeHtml(convenio.nombre_institucion)}
                </h3>
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.7rem; font-weight: 700;">
                  ${escapeHtml(convenio.tipo_institucion || 'Alianza Institucional')}
                </span>
              </div>
              <div id="convenio-carousel-phase-label" style="font-size: 0.76rem; color: var(--soft-purple-primary, #584294); font-weight: 700; margin-top: 0.15rem; text-transform: uppercase; letter-spacing: 0.04em;">
                Paso 1 de 3: Identidad y Alianza
              </div>
            </div>
          </div>

          <button type="button" class="soft-modal-close-btn" id="btn-close-convenio-modal" title="Cerrar ventana">
            ${Icons.close(18)}
          </button>
        </div>

        <!-- CONTENEDOR DEL CARRUSEL (VIEWPORT) -->
        <div id="convenio-carousel-viewport" style="position: relative; overflow: hidden; flex: 1; min-height: 390px; max-height: calc(92vh - 145px); background: #FFFFFF; display: flex; flex-direction: column;">
          
          <!-- PISTA DE DIAPOSITIVAS (SLIDES TRACK) -->
          <div id="convenio-slides-track" style="display: flex; width: 300%; height: 100%; transition: transform 0.42s cubic-bezier(0.16, 1, 0.3, 1);">
            
            <!-- DIAPOSITIVA 1: FOTOGRAFÍA INSTITUCIONAL Y ARTICULACIÓN -->
            <div class="convenio-slide convenio-slide-content" style="width: 33.3333%; flex-shrink: 0;">
              
              <div style="width: 100%; height: 210px; border-radius: 16px; overflow: hidden; background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); position: relative; display: flex; align-items: center; justify-content: center;">
                ${safeImgUrl ? `
                  <img 
                    src="${escapeHtml(safeImgUrl)}" 
                    alt="${escapeHtml(convenio.nombre_institucion)}" 
                    style="width: 100%; height: 100%; object-fit: cover;" 
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                  />
                  <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; background: linear-gradient(135deg, #7B66B5 0%, #9682CC 100%); color: #FFFFFF;">
                    ${Icons.building(52, '#FFFFFF')}
                  </div>
                ` : `
                  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; color: var(--soft-purple-primary);">
                    ${Icons.building(48, 'var(--soft-purple-primary)')}
                    <span style="font-size: 0.85rem; font-weight: 600;">Sede Oficial del Aliado</span>
                  </div>
                `}
              </div>

              <div>
                <span class="soft-badge soft-badge-mint" style="font-size: 0.74rem; font-weight: 700; margin-bottom: 0.45rem;">
                  Articulación Clínica y Escolar
                </span>
                <h4 style="margin: 0.2rem 0 0.45rem 0; font-size: 1.12rem; font-weight: 800; color: var(--soft-text-title);">
                  Sobre la Institución y el Convenio
                </h4>
                <p style="margin: 0; font-size: 0.9rem; color: var(--soft-text-body); line-height: 1.56;">
                  ${escapeHtml(convenio.descripcion_convenio || 'Alianza activa de colaboración multidisciplinaria orientada al bienestar integral de niños, jóvenes y sus familias.')}
                </p>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 0.85rem; background: var(--soft-lavender-surface); border-radius: 14px; padding: 1rem 1.15rem; border: 1px solid var(--soft-border-card-inner);">
                ${convenio.direccion ? `
                  <div style="display: flex; align-items: flex-start; gap: 0.55rem; font-size: 0.84rem;">
                    <span style="color: var(--soft-purple-primary); flex-shrink: 0; margin-top: 2px;">${Icons.mapPin(15, 'var(--soft-purple-primary)')}</span>
                    <span style="color: var(--soft-text-title); font-weight: 500;">${escapeHtml(convenio.direccion)}</span>
                  </div>
                ` : ''}

                ${convenio.telefono_contacto ? `
                  <div style="display: flex; align-items: center; gap: 0.55rem; font-size: 0.84rem;">
                    <span style="color: var(--soft-mint-deep); flex-shrink: 0;">${Icons.phone(15, 'var(--soft-mint-deep)')}</span>
                    <span style="color: var(--soft-text-title); font-weight: 700;">${escapeHtml(convenio.telefono_contacto)}</span>
                  </div>
                ` : ''}
              </div>

            </div>

            <!-- DIAPOSITIVA 2: BENEFICIOS EXCLUSIVOS Y DESCUENTOS -->
            <div class="convenio-slide convenio-slide-content" style="width: 33.3333%; flex-shrink: 0;">
              
              <div style="background: linear-gradient(135deg, rgba(88, 66, 148, 0.08) 0%, rgba(21, 150, 141, 0.08) 100%); border: 1px solid var(--soft-border-card-inner); border-radius: 18px; padding: 1.35rem 1.6rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.65rem;">
                  <div class="soft-icon-box soft-icon-box-mint">
                    ${Icons.gift(22, 'var(--soft-mint-deep)')}
                  </div>
                  <div>
                    <span style="font-size: 0.74rem; font-weight: 800; color: var(--soft-mint-deep); text-transform: uppercase; letter-spacing: 0.04em;">Beneficio Arancelario Oficial</span>
                    <h4 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title);">
                      Tarifas Preferenciales y Descuentos
                    </h4>
                  </div>
                </div>

                <div style="background: #FFFFFF; border-radius: 14px; padding: 1.1rem 1.25rem; border: 1.5px dashed var(--soft-purple-primary); margin-top: 0.85rem;">
                  <div style="font-size: 0.98rem; font-weight: 800; color: var(--soft-purple-primary); line-height: 1.45;">
                    ${escapeHtml(convenio.beneficio_familias || 'Descuentos preferenciales en diagnósticos y terapias continuas.')}
                  </div>
                </div>
              </div>

              <div>
                <h5 style="margin: 0 0 0.65rem 0; font-size: 0.92rem; font-weight: 800; color: var(--soft-text-title); text-transform: uppercase; letter-spacing: 0.03em;">
                  Ventajas Adicionales de la Alianza:
                </h5>
                <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                  <div style="display: flex; align-items: flex-start; gap: 0.65rem; background: var(--soft-lavender-surface); border-radius: 12px; padding: 0.75rem 1rem;">
                    <span style="color: var(--soft-mint-deep); flex-shrink: 0; margin-top: 2px;">${Icons.check(15, 'var(--soft-mint-deep)')}</span>
                    <span style="font-size: 0.86rem; color: var(--soft-text-title);">Prioridad en asignación de cupos y horarios de consulta en nuestras 3 salas especializadas.</span>
                  </div>
                  <div style="display: flex; align-items: flex-start; gap: 0.65rem; background: var(--soft-lavender-surface); border-radius: 12px; padding: 0.75rem 1rem;">
                    <span style="color: var(--soft-mint-deep); flex-shrink: 0; margin-top: 2px;">${Icons.check(15, 'var(--soft-mint-deep)')}</span>
                    <span style="font-size: 0.86rem; color: var(--soft-text-title);">Articulación directa entre nuestros terapeutas y el gabinete psicopedagógico o médico del aliado.</span>
                  </div>
                  <div style="display: flex; align-items: flex-start; gap: 0.65rem; background: var(--soft-lavender-surface); border-radius: 12px; padding: 0.75rem 1rem;">
                    <span style="color: var(--soft-mint-deep); flex-shrink: 0; margin-top: 2px;">${Icons.check(15, 'var(--soft-mint-deep)')}</span>
                    <span style="font-size: 0.86rem; color: var(--soft-text-title);">Acceso preferencial a talleres, charlas preventivas y webinars organizados por el centro.</span>
                  </div>
                </div>
              </div>

            </div>

            <!-- DIAPOSITIVA 3: REQUISITOS Y PASOS DE ACCESO -->
            <div class="convenio-slide convenio-slide-content" style="width: 33.3333%; flex-shrink: 0;">
              
              <div>
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.74rem; font-weight: 700; margin-bottom: 0.45rem;">
                  Guía Rápida para Familias
                </span>
                <h4 style="margin: 0.2rem 0 0.5rem 0; font-size: 1.12rem; font-weight: 800; color: var(--soft-text-title);">
                  ¿Cómo activar este beneficio en su consulta?
                </h4>
                <p style="margin: 0; font-size: 0.88rem; color: var(--soft-text-body); line-height: 1.5;">
                  Siga estos tres sencillos pasos para aplicar el descuento del convenio en su próxima cita o evaluación diagnóstica.
                </p>
              </div>

              <!-- PASOS NUMERADOS SOFT UI -->
              <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                <div style="display: flex; align-items: flex-start; gap: 0.85rem; background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.95rem 1.1rem; box-shadow: 0 2px 8px rgba(88,66,148,0.04);">
                  <div style="width: 30px; height: 30px; border-radius: 9px; background: var(--soft-purple-primary); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; flex-shrink: 0;">
                    1
                  </div>
                  <div>
                    <strong style="color: var(--soft-text-title); font-size: 0.9rem;">Presente su Acreditación de Afiliación</strong>
                    <div style="font-size: 0.82rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                      Carnet de estudiante, libreta escolar, credencial laboral o carta de derivación del colegio o centro aliado.
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: flex-start; gap: 0.85rem; background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.95rem 1.1rem; box-shadow: 0 2px 8px rgba(88,66,148,0.04);">
                  <div style="width: 30px; height: 30px; border-radius: 9px; background: var(--soft-mint-deep); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; flex-shrink: 0;">
                    2
                  </div>
                  <div>
                    <strong style="color: var(--soft-text-title); font-size: 0.9rem;">Mencione el Convenio al Agendar su Cita</strong>
                    <div style="font-size: 0.82rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                      Indique en recepción o por WhatsApp que pertenece a la institución asociada para registrar el arancel preferencial en su ficha.
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: flex-start; gap: 0.85rem; background: #FFFFFF; border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.95rem 1.1rem; box-shadow: 0 2px 8px rgba(88,66,148,0.04);">
                  <div style="width: 30px; height: 30px; border-radius: 9px; background: #10B981; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; flex-shrink: 0;">
                    3
                  </div>
                  <div>
                    <strong style="color: var(--soft-text-title); font-size: 0.9rem;">Atención Especializada y Seguimiento Articulado</strong>
                    <div style="font-size: 0.82rem; color: var(--soft-text-body); margin-top: 0.15rem;">
                      Reciba la atención en nuestro centro con coordinación directa con su institución educativa o médica.
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

          <!-- BOTONES LATERALES DE NAVEGACIÓN (MISMO COLOR, Z-INDEX ELEVADO, SIN TAPAR TEXTO) -->
          <button 
            type="button" 
            id="btn-carousel-prev" 
            class="convenio-carousel-nav-btn"
            style="left: 14px;"
            title="Diapositiva anterior"
          >
            ${Icons.chevronLeft(22, '#FFFFFF')}
          </button>

          <button 
            type="button" 
            id="btn-carousel-next" 
            class="convenio-carousel-nav-btn"
            style="right: 14px;"
            title="Siguiente diapositiva"
          >
            ${Icons.chevronRight(22, '#FFFFFF')}
          </button>
        </div>

        <!-- PIE CON PUNTOS INDICADORES Y ACCIONES -->
        <div style="padding: 1rem 1.65rem; border-top: 1px solid var(--soft-divider, #F0EEF9); background: var(--soft-lavender-surface, #F8F6FE); display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-shrink: 0; flex-wrap: wrap;">
          
          <!-- PUNTOS INDICADORES Y BOTONES COMPACTOS -->
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.55rem;">
              <button type="button" class="carousel-dot active" data-slide="0" style="width: 24px; height: 8px; border-radius: 4px; background: var(--soft-purple-primary); border: none; cursor: pointer; transition: all 0.25s ease;" title="Ir al paso 1"></button>
              <button type="button" class="carousel-dot" data-slide="1" style="width: 8px; height: 8px; border-radius: 4px; background: rgba(88,66,148,0.25); border: none; cursor: pointer; transition: all 0.25s ease;" title="Ir al paso 2"></button>
              <button type="button" class="carousel-dot" data-slide="2" style="width: 8px; height: 8px; border-radius: 4px; background: rgba(88,66,148,0.25); border: none; cursor: pointer; transition: all 0.25s ease;" title="Ir al paso 3"></button>
            </div>
            <span id="convenio-carousel-auto-badge" style="font-size: 0.72rem; color: var(--soft-text-muted); font-weight: 600;">
              Transición automática
            </span>
          </div>

          <!-- BOTONES DE ACCIÓN DIRECTOS -->
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            ${whatsappLink ? `
              <a 
                href="${whatsappLink}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="soft-btn soft-btn-sm soft-btn-lvl-1"
                style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.45rem;"
              >
                ${Icons.whatsapp(15, '#FFFFFF')}
                <span>Consultar por WhatsApp</span>
              </a>
            ` : ''}

            ${webLink ? `
              <a 
                href="${webLink}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="soft-btn soft-btn-sm soft-btn-lvl-1-muted"
                style="text-decoration: none;"
                title="Visitar sitio web oficial"
              >
                ${Icons.externalLink(14, 'currentColor')}
                <span>Sitio Web</span>
              </a>
            ` : ''}

            <button type="button" id="btn-close-convenio-footer" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted">
              Cerrar
            </button>
          </div>

        </div>

      </div>
    `;

    document.body.appendChild(backdrop);

    // Lógica interactiva del carrusel
    const track = backdrop.querySelector('#convenio-slides-track');
    const prevBtn = backdrop.querySelector('#btn-carousel-prev');
    const nextBtn = backdrop.querySelector('#btn-carousel-next');
    const phaseLabel = backdrop.querySelector('#convenio-carousel-phase-label');
    const dots = backdrop.querySelectorAll('.carousel-dot');
    const viewport = backdrop.querySelector('#convenio-carousel-viewport');

    const updateCarousel = (index) => {
      // Bucle infinito bidireccional
      if (index < 0) {
        currentSlide = totalSlides - 1;
      } else if (index >= totalSlides) {
        currentSlide = 0;
      } else {
        currentSlide = index;
      }

      if (track) {
        track.style.transform = `translateX(-${currentSlide * 33.3333}%)`;
      }

      // Actualizar etiqueta
      const phases = [
        'Paso 1 de 3: Identidad y Alianza',
        'Paso 2 de 3: Beneficios y Descuentos',
        'Paso 3 de 3: Requisitos de Acceso'
      ];
      if (phaseLabel) phaseLabel.textContent = phases[currentSlide];

      // Actualizar dots
      dots.forEach((d, i) => {
        if (i === currentSlide) {
          d.style.width = '24px';
          d.style.background = 'var(--soft-purple-primary)';
        } else {
          d.style.width = '8px';
          d.style.background = 'rgba(88,66,148,0.25)';
        }
      });
    };

    // Auto-play cada 4.5 segundos
    const startAutoPlay = () => {
      stopAutoPlay();
      autoPlayTimer = setInterval(() => {
        updateCarousel(currentSlide + 1);
      }, 4500);
    };

    const stopAutoPlay = () => {
      if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
      }
    };

    startAutoPlay();

    // Pausar auto-play al pasar el cursor o interactuar + soporte swipe táctil en móvil
    let touchStartX = 0;
    let touchStartY = 0;
    if (viewport) {
      viewport.addEventListener('mouseenter', stopAutoPlay);
      viewport.addEventListener('mouseleave', startAutoPlay);
      viewport.addEventListener('touchstart', (e) => {
        stopAutoPlay();
        if (e.touches && e.touches.length > 0) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });
      viewport.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches.length > 0) {
          const dx = e.changedTouches[0].clientX - touchStartX;
          const dy = e.changedTouches[0].clientY - touchStartY;
          if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) {
              updateCarousel(currentSlide + 1);
            } else {
              updateCarousel(currentSlide - 1);
            }
          }
        }
        startAutoPlay();
      }, { passive: true });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopAutoPlay();
        updateCarousel(currentSlide - 1);
        startAutoPlay();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        stopAutoPlay();
        updateCarousel(currentSlide + 1);
        startAutoPlay();
      });
    }

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        stopAutoPlay();
        updateCarousel(idx);
        startAutoPlay();
      });
    });

    // Cerrar modal y limpiar temporizadores
    const closeModal = () => {
      stopAutoPlay();
      document.removeEventListener('keydown', handleKeyDown);
      backdrop.style.opacity = '0';
      backdrop.style.transition = 'opacity 0.18s ease-out';
      setTimeout(() => backdrop.remove(), 190);
    };

    backdrop.querySelector('#btn-close-convenio-modal')?.addEventListener('click', closeModal);
    backdrop.querySelector('#btn-close-convenio-footer')?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      } else if (e.key === 'ArrowLeft') {
        stopAutoPlay();
        updateCarousel(currentSlide - 1);
        startAutoPlay();
      } else if (e.key === 'ArrowRight') {
        stopAutoPlay();
        updateCarousel(currentSlide + 1);
        startAutoPlay();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  }
}
