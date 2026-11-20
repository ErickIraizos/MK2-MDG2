import { Icons } from '../../components/Icons.js';
import { SpecialtyDetailsModal } from '../../components/SpecialtyDetailsModal.js';

export class TutorSpecialtiesCatalogView {
  constructor(container) {
    this.container = container;
  }

  async render() {
    const specialties = [
      {
        id: 'neuropsicologia',
        badge: 'Neurodesarrollo & Cerebro',
        badgeClass: 'soft-badge-lavender',
        iconBoxClass: 'soft-icon-box-lavender',
        iconColor: 'var(--soft-purple-primary)',
        title: 'Neuropsicología Infantil & Juvenil',
        subtitle: 'Estudio y estimulación de las funciones cerebrales superiores',
        queEs: 'Es la disciplina clínica que evalúa cómo las redes cerebrales influyen en la atención, la memoria, el autocontrol y la conducta de niños y adolescentes.',
        cuandoConsultar: [
          'Dificultad marcada para concentrarse o terminar tareas cortas · sospecha de TDAH.',
          'Impulsividad, inquietud motora constante o desbordes conductuales frecuentes.',
          'Dificultades en la interacción social, comunicación o flexibilidad de rutinas · sospecha de TEA.',
          'Olvidos constantes de instrucciones simples en la escuela o en el hogar.'
        ],
        pruebas: 'WISC-V · Escala Wechsler, CUMANES, BANFE-2, Test d2 y ADOS-2.',
        beneficio: 'Diagnóstico neurocognitivo certero y programas de rehabilitación atencional personalizados.'
      },
      {
        id: 'psicopedagogia',
        badge: 'Aprendizaje & Escuela',
        badgeClass: 'soft-badge-mint',
        iconBoxClass: 'soft-icon-box-mint',
        iconColor: 'var(--soft-mint-deep)',
        title: 'Psicopedagogía & Aprendizaje Escolar',
        subtitle: 'Superación de dificultades en lectura, escritura y matemáticas',
        queEs: 'Atiende y acompaña a los niños y jóvenes en sus procesos de aprendizaje, detectando bloqueos y diseñando adaptaciones pedagógicas adaptadas a su ritmo.',
        cuandoConsultar: [
          'Confusión de letras, lectura lenta o silábica y dificultad para comprender textos · Dislexia.',
          'Dificultades notorias con números, cálculo mental o nociones matemáticas · Discalculia.',
          'Trazos irregulares, dolor en la mano al escribir o desorganización gráfica · Disgrafía.',
          'Bajo rendimiento escolar o frustración persistente a la hora de hacer las tareas.'
        ],
        pruebas: 'Baterías pedagógicas estandarizadas, pruebas de madurez lectora y observación escolar.',
        beneficio: 'Estrategias de estudio eficaces, articulación con los colegios y recuperación de la confianza académica.'
      },
      {
        id: 'psicoterapia',
        badge: 'Salud Emocional & Familia',
        badgeClass: 'soft-badge-indigo',
        iconBoxClass: 'soft-icon-box-indigo',
        iconColor: 'var(--soft-indigo-accent)',
        title: 'Psicoterapia Individual, Adolescente y Familiar',
        subtitle: 'Acompañamiento emocional, manejo de conducta y vínculos familiares',
        queEs: 'Espacio clínico de escucha activa y orientación cognitivo-conductual para ayudar a niños, adolescentes y padres a resolver conflictos emocionales y conductuales.',
        cuandoConsultar: [
          'Ansiedad, miedos intensos, aislamiento o irritabilidad sin causa aparente.',
          'Dificultades de adaptación ante cambios familiares: separación, duelo o mudanzas.',
          'Problemas de límites, desobediencia recurrente o conductas desafiantes en casa.',
          'Baja autoestima, timidez extrema o desmotivación en la etapa adolescente.'
        ],
        pruebas: 'Entrevistas clínicas diagnósticas, escalas de ansiedad y depresión, y dinámicas sistémicas.',
        beneficio: 'Regulación emocional duradera, pautas claras de crianza respetuosa y armonía en el hogar.'
      },
      {
        id: 'psicogerontologia',
        badge: 'Adulto Mayor & Memoria',
        badgeClass: 'soft-badge-lavender',
        iconBoxClass: 'soft-icon-box-lavender',
        iconColor: 'var(--soft-purple-primary)',
        title: 'Psicogerontología · Programa Horizontes Plateados',
        subtitle: 'Preservación de la memoria, autonomía y envejecimiento activo',
        queEs: 'Especialidad médica dedicada al bienestar mental y cognitivo del adulto mayor, previniendo el deterioro de la memoria y promoviendo una vida activa y digna.',
        cuandoConsultar: [
          'Olvidos frecuentes de nombres, fechas, objetos o citas cotidianas.',
          'Desorientación en lugares conocidos o dificultad para realizar cuentas de compras.',
          'Cambios de humor, apatía, desinterés por actividades habituales o tristeza prolongada.',
          'Familiares que necesitan orientación y pautas para el cuidado cognitivo de su adulto mayor.'
        ],
        pruebas: 'Valoración Gerontológica Integral VGI, MoCA · Test Cognitivo Montreal y MMSE.',
        beneficio: 'Frenar el avance del deterioro cognitivo leve y brindar estimulación cognitiva gratificante.'
      }
    ];

    this.container.innerHTML = `
      <div class="page-container panel-general" style="max-width: 1240px; margin: 0 auto; padding-bottom: 3.5rem;">
        
        <!-- CABECERA INSTITUCIONAL SOFT UI -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.stethoscope(13, 'var(--soft-purple-primary)')}
                <span>Guía Didáctica para Familias</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende" · Servicios Especializados</span>
            </div>
            <h1 class="soft-page-title">Catálogo de Especialidades &amp; Enfoques Clínicos</h1>
            <p class="soft-page-subtitle" style="max-width: 840px;">
              Una guía clara y sin tecnicismos para entender cada área de atención de nuestro centro, identificar cuándo es oportuno consultar y conocer los beneficios para tu familia.
            </p>
          </div>

          <div class="soft-header-actions" style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
            <a href="#/portal/ubicacion" class="soft-btn soft-btn-lvl-1-muted" style="display: inline-flex; align-items: center; gap: 0.45rem;">
              ${Icons.mapPin(14, 'currentColor')}
              <span>Ver Ubicación &amp; Fotos</span>
            </a>
            <a href="#/portal/nosotros" class="soft-btn soft-btn-lvl-1" style="display: inline-flex; align-items: center; gap: 0.45rem;">
              ${Icons.users(14, '#FFFFFF')}
              <span>Ver Equipo Clínico</span>
            </a>
          </div>
        </div>

        <!-- RUTA CLÍNICA EN 4 PASOS DE LA FAMILIA EN PSI APRENDE -->
        <div class="soft-card-static" style="padding: 1.6rem 1.85rem; margin-bottom: 2.25rem;">
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <span class="soft-badge soft-badge-mint" style="font-size: 0.72rem; margin-bottom: 0.4rem;">Metodología Probada</span>
            <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.35rem 0; letter-spacing: -0.015em;">
              La Ruta de Acompañamiento para tu Familia
            </h3>
            <p style="font-size: 0.88rem; color: var(--soft-text-body); max-width: 600px; margin: 0 auto;">
              Desde tu primera consulta hasta el logro de objetivos, nuestro equipo interdisciplinario sigue un camino clínico ordenado y seguro.
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 1rem;">
            
            <!-- Paso 1 -->
            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.25rem; position: relative;">
              <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.65rem;">
                <div style="width: 32px; height: 32px; border-radius: 10px; background: var(--soft-purple-primary); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem;">
                  1
                </div>
                <h4 style="margin: 0; font-size: 0.96rem; font-weight: 800; color: var(--soft-text-title);">
                  Triaje &amp; Orientación
                </h4>
              </div>
              <p style="margin: 0; font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.5;">
                Recepción escucha el motivo de consulta o puedes orientarte con MindBot IA para definir la especialidad médica más idónea.
              </p>
            </div>

            <!-- Paso 2 -->
            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.25rem; position: relative;">
              <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.65rem;">
                <div style="width: 32px; height: 32px; border-radius: 10px; background: var(--soft-mint-deep); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem;">
                  2
                </div>
                <h4 style="margin: 0; font-size: 0.96rem; font-weight: 800; color: var(--soft-text-title);">
                  Evaluación Inicial
                </h4>
              </div>
              <p style="margin: 0; font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.5;">
                Anamnesis completa, pruebas baremadas como WISC-V o CUMANES, y emisión de diagnóstico nosológico bajo CIE-11 y DSM-5.
              </p>
            </div>

            <!-- Paso 3 -->
            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.25rem; position: relative;">
              <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.65rem;">
                <div style="width: 32px; height: 32px; border-radius: 10px; background: var(--soft-indigo-accent); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem;">
                  3
                </div>
                <h4 style="margin: 0; font-size: 0.96rem; font-weight: 800; color: var(--soft-text-title);">
                  Plan PTI Personalizado
                </h4>
              </div>
              <p style="margin: 0; font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.5;">
                Diseño de metas SMART medibles. Sesiones terapéuticas documentadas con metodología SOAP y coordinación con el colegio.
              </p>
            </div>

            <!-- Paso 4 -->
            <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.25rem; position: relative;">
              <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.65rem;">
                <div style="width: 32px; height: 32px; border-radius: 10px; background: #10B981; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem;">
                  4
                </div>
                <h4 style="margin: 0; font-size: 0.96rem; font-weight: 800; color: var(--soft-text-title);">
                  Bitácora &amp; Alta Clínica
                </h4>
              </div>
              <p style="margin: 0; font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.5;">
                Seguimiento en casa a través de la Bitácora Familiar, reevaluación de logros alcanzados y alta con informe membretado oficial.
              </p>
            </div>

          </div>
        </div>

        <!-- CUADRÍCULA DETALLADA DE LAS 4 ESPECIALIDADES -->
        <div style="display: flex; flex-direction: column; gap: 1.75rem;">
          ${specialties.map(s => `
            <div class="soft-card-static" style="padding: 1.85rem 2.1rem; border-radius: 20px;">
              
              <!-- Cabecera de Especialidad -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.15rem; flex-wrap: wrap;">
                <div>
                  <span class="soft-badge ${s.badgeClass}" style="font-size: 0.72rem; padding: 0.22rem 0.68rem; text-transform: uppercase; font-weight: 700; margin-bottom: 0.45rem;">
                    ${s.badge}
                  </span>
                  <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--soft-text-title); margin: 0.25rem 0 0.18rem 0; letter-spacing: -0.018em;">
                    ${s.title}
                  </h2>
                  <div style="font-size: 0.85rem; font-weight: 600; color: var(--soft-purple-primary);">
                    ${s.subtitle}
                  </div>
                </div>

                <div class="soft-icon-box soft-icon-box-lg ${s.iconBoxClass}" style="width: 48px; height: 48px; border-radius: 16px;">
                  ${Icons.stethoscope(24, s.iconColor)}
                </div>
              </div>

              <!-- ¿Qué es en palabras sencillas? -->
              <div style="margin-bottom: 1.25rem;">
                <div style="font-size: 0.74rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.045em; color: var(--soft-text-overline); margin-bottom: 0.35rem;">
                  ¿Qué es en palabras sencillas?
                </div>
                <p style="margin: 0; font-size: 0.9rem; color: var(--soft-text-body); line-height: 1.58;">
                  ${s.queEs}
                </p>
              </div>

              <!-- ¿Cuándo consultar? Señales observables -->
              <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.2rem 1.45rem; margin-bottom: 1.25rem;">
                <div style="font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--soft-mint-deep); margin-bottom: 0.65rem; display: flex; align-items: center; gap: 0.45rem;">
                  ${Icons.check(14, 'var(--soft-mint-deep)')}
                  <span>¿Cuándo es oportuno consultar? Señales observables:</span>
                </div>
                <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.86rem; color: var(--soft-text-title); line-height: 1.65;">
                  ${s.cuandoConsultar.map(item => `<li>${item}</li>`).join('')}
                </ul>
              </div>

              <!-- Pruebas y Beneficios - Dos Columnas -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 1rem; border-top: 1px solid var(--soft-divider); padding-top: 1.1rem; font-size: 0.84rem;">
                <div>
                  <strong style="color: var(--soft-text-title);">Pruebas &amp; Baremos Utilizados:</strong>
                  <div style="color: var(--soft-text-body); margin-top: 0.2rem; line-height: 1.45;">
                    ${s.pruebas}
                  </div>
                </div>
                <div>
                  <strong style="color: var(--soft-text-title);">Resultado para el Paciente:</strong>
                  <div style="color: var(--soft-text-body); margin-top: 0.2rem; line-height: 1.45;">
                    ${s.beneficio}
                  </div>
                </div>
              </div>

              <!-- Barra de Acción: Botón Guía Completa y Consulta -->
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; border-top: 1px solid var(--soft-divider); padding-top: 1.15rem; margin-top: 1.15rem; flex-wrap: wrap;">
                <button 
                  type="button" 
                  class="soft-btn soft-btn-lvl-1 btn-open-specialty-details" 
                  data-specialty-id="${s.id}"
                  style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.4rem;"
                >
                  ${Icons.eye(15, '#FFFFFF')}
                  <span>Ver Guía Completa &amp; Ilustración Interactiva</span>
                </button>

                <a 
                  href="https://wa.me/59162717425?text=${encodeURIComponent(`Hola Centro PSI Aprende, deseo consultar sobre la especialidad de ${s.title}.`)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="soft-btn soft-btn-lvl-1-muted"
                  style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.45rem;"
                >
                  ${Icons.whatsapp(15, 'var(--soft-purple-primary)')}
                  <span>Consultar por WhatsApp</span>
                </a>
              </div>

            </div>
          `).join('')}
        </div>

      </div>
    `;

    // Eventos interactivos para abrir la ventana modal con la ilustración flotante
    const buttons = this.container.querySelectorAll('.btn-open-specialty-details');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.specialtyId;
        const s = specialties.find(item => item.id === id);
        if (s) {
          SpecialtyDetailsModal.show(s);
        }
      });
    });
  }
}
