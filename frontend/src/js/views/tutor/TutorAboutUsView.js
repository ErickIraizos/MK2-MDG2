import { apiClient } from '../../api/apiClient.js';
import { Icons } from '../../components/Icons.js';

export class TutorAboutUsView {
  constructor(container) {
    this.container = container;
    this.config = null;
    this.therapists = [];
    this.rooms = [];
    this.loading = true;
  }

  async loadData() {
    try {
      const [configRes, therapistsRes, roomsRes] = await Promise.all([
        apiClient.get('/config/public').catch(() => ({ data: {} })),
        apiClient.get('/therapists').catch(() => ({ data: [] })),
        apiClient.get('/rooms').catch(() => ({ data: [] }))
      ]);

      if (configRes && configRes.data) {
        this.config = configRes.data;
      }
      if (therapistsRes && therapistsRes.data) {
        this.therapists = Array.isArray(therapistsRes.data) ? therapistsRes.data : [];
      }
      if (roomsRes && roomsRes.data) {
        this.rooms = Array.isArray(roomsRes.data) ? roomsRes.data : [];
      }
    } catch (err) {
      console.warn('[TutorAboutUsView] Error cargando datos institucionales:', err);
    } finally {
      this.loading = false;
    }
  }

  async render() {
    await this.loadData();

    const institucionNombre = this.config?.INSTITUCION_NOMBRE || 'Centro Psicopedagógico y de Atención Psicológica "PSI Aprende"';
    const mision = this.config?.INSTITUCION_MISION || 'Brindar evaluación diagnóstica neurocognitiva y psicopedagógica integral, basada en evidencia científica y calidez humana, potenciando el aprendizaje y bienestar emocional de cada paciente y su familia.';
    const vision = this.config?.INSTITUCION_VISION || 'Ser el centro psicopedagógico y neurocognitivo de mayor prestigio y referencia en Cochabamba y Bolivia, reconocido por su rigor ético, metodologías personalizadas y articulación con familias y colegios.';
    const metas = this.config?.INSTITUCION_METAS || '1. Detección temprana de dificultades del aprendizaje y neurodesarrollo. 2. Tratamientos individualizados con metodología SOAP y metas SMART. 3. Respaldo ético con 100% de terapeutas colegiados y secreto profesional bajo Ley 3131.';
    const directora = this.config?.INSTITUCION_DIRECTORA || 'Mgr. Grisel Aguilar Apaza';

    this.container.innerHTML = `
      <div class="page-container panel-general" style="max-width: 1240px; margin: 0 auto; padding-bottom: 3.5rem;">
        
        <!-- CABECERA INSTITUCIONAL SOFT UI -->
        <div class="soft-header-row">
          <div>
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.award ? Icons.award(13, 'var(--soft-purple-primary)') : Icons.shield(13, 'var(--soft-purple-primary)')}
                <span>Identidad &amp; Equipo Profesional</span>
              </span>
              <span class="soft-location-label">Centro "PSI Aprende" · Trayectoria Clínica</span>
            </div>
            <h1 class="soft-page-title">Sobre Nosotros &amp; Equipo Especializado</h1>
            <p class="soft-page-subtitle" style="max-width: 840px;">
              Conoce los fundamentos éticos, misión, visión y las credenciales académicas del equipo de especialistas colegiados que acompañan el desarrollo de tu familia en Cochabamba.
            </p>
          </div>

          <div class="soft-header-actions">
            <span class="soft-badge soft-badge-emerald" style="padding: 0.45rem 0.95rem; font-size: 0.77rem;">
              ${Icons.shield(14, 'var(--soft-emerald-dark)')}
              <span>100% Colegiados en el CPB · Ley 3131</span>
            </span>
          </div>
        </div>

        <!-- SECCIÓN 1: IDENTIDAD INSTITUCIONAL - MISIÓN, VISIÓN Y METAS -->
        <div style="margin-bottom: 2.25rem;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 1.35rem;">
            
            <!-- Misión -->
            <div class="soft-card-static" style="padding: 1.6rem 1.75rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                  <div class="soft-icon-box soft-icon-box-lavender" style="width: 44px; height: 44px; border-radius: 14px;">
                    ${Icons.target ? Icons.target(22, 'var(--soft-purple-primary)') : Icons.bookOpen(22, 'var(--soft-purple-primary)')}
                  </div>
                  <span class="soft-badge soft-badge-lavender" style="font-size: 0.7rem; font-weight: 700;">NUESTRO PROPÓSITO</span>
                </div>
                <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.65rem 0; letter-spacing: -0.015em;">
                  Misión Institucional
                </h3>
                <p style="font-size: 0.88rem; color: var(--soft-text-body); line-height: 1.58; margin: 0;">
                  ${this.escapeHtml(mision)}
                </p>
              </div>
              <div style="margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid var(--soft-divider); font-size: 0.78rem; color: var(--soft-purple-primary); font-weight: 600;">
                Enfoque clínico interdisciplinario centrado en el paciente
              </div>
            </div>

            <!-- Visión -->
            <div class="soft-card-static" style="padding: 1.6rem 1.75rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                  <div class="soft-icon-box soft-icon-box-mint" style="width: 44px; height: 44px; border-radius: 14px;">
                    ${Icons.sparkles ? Icons.sparkles(22, 'var(--soft-mint-deep)') : Icons.star(22, 'var(--soft-mint-deep)')}
                  </div>
                  <span class="soft-badge soft-badge-mint" style="font-size: 0.7rem; font-weight: 700;">HORIZONTE CLÍNICO</span>
                </div>
                <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.65rem 0; letter-spacing: -0.015em;">
                  Visión de Excelencia
                </h3>
                <p style="font-size: 0.88rem; color: var(--soft-text-body); line-height: 1.58; margin: 0;">
                  ${this.escapeHtml(vision)}
                </p>
              </div>
              <div style="margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid var(--soft-divider); font-size: 0.78rem; color: var(--soft-mint-deep); font-weight: 600;">
                Referencia en neurodesarrollo y gerontología en Bolivia
              </div>
            </div>

            <!-- Metas y Compromiso Ético -->
            <div class="soft-card-static" style="padding: 1.6rem 1.75rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                  <div class="soft-icon-box soft-icon-box-indigo" style="width: 44px; height: 44px; border-radius: 14px;">
                    ${Icons.shield(22, 'var(--soft-indigo-accent)')}
                  </div>
                  <span class="soft-badge soft-badge-indigo" style="font-size: 0.7rem; font-weight: 700;">RIGOR BIOÉTICO</span>
                </div>
                <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.65rem 0; letter-spacing: -0.015em;">
                  Objetivos &amp; Metas Clave
                </h3>
                <p style="font-size: 0.88rem; color: var(--soft-text-body); line-height: 1.58; margin: 0;">
                  ${this.escapeHtml(metas)}
                </p>
              </div>
              <div style="margin-top: 1.25rem; padding-top: 0.75rem; border-top: 1px solid var(--soft-divider); font-size: 0.78rem; color: var(--soft-indigo-accent); font-weight: 600;">
                Cumplimiento estricto de secreto médico y Ley 3131
              </div>
            </div>

          </div>
        </div>

        <!-- SECCIÓN 2: DIRECCIÓN GENERAL DEL CENTRO -->
        <div class="soft-card-static" style="padding: 1.85rem 2rem; margin-bottom: 2.25rem; background: linear-gradient(135deg, #FFFFFF 0%, var(--soft-lavender-surface) 100%);">
          <div style="display: flex; align-items: center; gap: 1.8rem; flex-wrap: wrap;">
            
            <div style="width: 90px; height: 90px; border-radius: 28px; background: linear-gradient(135deg, var(--soft-purple-primary) 0%, var(--soft-purple-dark, #3E3076) 100%); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; font-weight: 800; flex-shrink: 0; box-shadow: 0 8px 24px rgba(88,66,148,0.22); border: 2px solid #FFFFFF;">
              GA
            </div>

            <div style="flex: 1 1 360px; min-width: min(100%, 260px);">
              <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem; font-weight: 700;">
                  DIRECCIÓN GENERAL &amp; FUNDACIÓN
                </span>
                <span class="soft-badge soft-badge-mint" style="font-size: 0.72rem; font-weight: 700;">
                  MATRÍCULA CPB-1402
                </span>
              </div>
              <h2 style="font-size: 1.45rem; font-weight: 800; color: var(--soft-text-title); margin: 0 0 0.45rem 0; letter-spacing: -0.02em;">
                ${this.escapeHtml(directora)}
              </h2>
              <p style="font-size: 0.9rem; color: var(--soft-text-body); line-height: 1.6; margin: 0;">
                Máster en Neuropsicología Clínica e intervención en el neurodesarrollo infantil y juvenil. Lidera la dirección técnica de PSI Aprende garantizando que cada protocolo de evaluación y plan terapéutico individualizado PTI responda a baremos científicos actualizados y a un trato empático hacia las familias.
              </p>
            </div>

          </div>
        </div>

        <!-- SECCIÓN 3: EQUIPO CLÍNICO DE TERAPEUTAS ACREDITADOS -->
        <div>
          <div style="margin-bottom: 1.35rem;">
            <div class="soft-header-meta">
              <span class="soft-badge soft-badge-mint">
                ${Icons.users ? Icons.users(13, 'var(--soft-mint-deep)') : Icons.check(13, 'var(--soft-mint-deep)')}
                <span>Cuerpo Profesional Colegiado</span>
              </span>
            </div>
            <h2 class="soft-section-title" style="font-size: 1.45rem; margin-bottom: 0.35rem;">
              Directorio de Terapeutas &amp; Logros Académicos
            </h2>
            <p class="soft-section-subtitle" style="margin: 0;">
              Cada especialista cuenta con matrícula habilitada ante el Colegio de Psicólogos de Bolivia y formación continua en su área de intervención.
            </p>
          </div>

          <!-- Cuadrícula de Terapeutas -->
          <div class="soft-rooms-grid" style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 1.4rem;">
            ${this.renderTherapistCards()}
          </div>
        </div>

      </div>
    `;
  }

  renderTherapistCards() {
    if (this.therapists.length === 0) {
      return `
        <div class="empty-state-card" style="grid-column: 1 / -1; padding: 2.5rem 1.5rem; text-align: center;">
          <h4 style="color: var(--soft-text-title); font-weight: 800; margin-bottom: 0.5rem;">Cargando directorio de profesionales...</h4>
          <p style="color: var(--soft-text-muted); font-size: 0.88rem; margin: 0;">Obteniendo información del equipo clínico.</p>
        </div>
      `;
    }

    return this.therapists.map(t => {
      const initials = ((t.nombres || '').charAt(0) + (t.apellidos || '').charAt(0)).toUpperCase() || 'TP';
      const cpb = t.registro_profesional || 'CPB-Habilitado';
      const specialty = t.especialidad_nombre || 'Especialista Clínico';
      const bio = t.bio || 'Especialista dedicado a la evaluación neuropsicológica, psicopedagogía y apoyo clínico integral en PSI Aprende.';

      // Consultorio preferido
      const room = this.rooms.find(r => r.id === t.ambiente_preferido_id);
      const roomName = room ? `${room.codigo} · ${room.nombre}` : 'Consultorios Centrales';

      // Turno
      let turnoText = 'Lunes a Viernes';
      if (t.turnos_atencion === 'MAÑANA') turnoText = 'Turno Mañana: 08:30 a 12:30';
      else if (t.turnos_atencion === 'TARDE') turnoText = 'Turno Tarde: 14:30 a 18:30';
      else if (t.turnos_atencion === 'COMPLETO') turnoText = 'Turno Completo Mañana y Tarde';

      return `
        <div class="soft-room-card" style="padding: 1.5rem 1.55rem; display: flex; flex-direction: column; justify-content: space-between; border-radius: 18px; border: 1px solid var(--soft-border-card, #EDE8F5); background: #FFFFFF; box-shadow: 0 4px 18px rgba(88, 66, 148, 0.05); transition: transform 0.2s ease, box-shadow 0.2s ease;">
          <div>
            <!-- Header Terapeuta con Foto Real -->
            <div style="display: flex; align-items: flex-start; gap: 0.95rem; margin-bottom: 0.9rem;">
              <div style="width: 62px; height: 62px; border-radius: 18px; overflow: hidden; flex-shrink: 0; border: 2px solid var(--soft-purple-primary); box-shadow: 0 6px 16px rgba(88,66,148,0.18);">
                ${t.foto_url ? `
                  <img src="${this.escapeHtml(t.foto_url)}" alt="${this.escapeHtml(t.nombres)}" style="width: 100%; height: 100%; object-fit: cover;" />
                ` : `
                  <div style="width: 100%; height: 100%; background: linear-gradient(135deg, var(--soft-purple-primary) 0%, #2DB9AE 100%); color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800;">
                    ${initials}
                  </div>
                `}
              </div>
              
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.22rem; flex-wrap: wrap;">
                  <span class="soft-badge soft-badge-lavender" style="font-size: 0.68rem; padding: 0.18rem 0.58rem; font-weight: 700;">
                    ${this.escapeHtml(cpb)}
                  </span>
                  <span class="soft-badge soft-badge-mint" style="font-size: 0.68rem; padding: 0.18rem 0.58rem; font-weight: 700;">
                    ${this.escapeHtml(specialty)}
                  </span>
                  ${t.experiencia_anios ? `
                    <span class="soft-badge soft-badge-indigo" style="font-size: 0.68rem; padding: 0.18rem 0.55rem; font-weight: 600;">
                      ${this.escapeHtml(t.experiencia_anios)}
                    </span>
                  ` : ''}
                </div>
                <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title); margin: 0; line-height: 1.28; letter-spacing: -0.015em;">
                  Lic. ${this.escapeHtml(t.nombres)} ${this.escapeHtml(t.apellidos)}
                </h3>
              </div>
            </div>

            <!-- Enfoque Terapéutico Destacado -->
            ${t.enfoque_terapeutico ? `
              <div style="margin-bottom: 0.75rem;">
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.72rem; padding: 0.22rem 0.65rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
                  <span style="color: var(--soft-purple-primary);">&#9679;</span>
                  <span>Enfoque: ${this.escapeHtml(t.enfoque_terapeutico)}</span>
                </span>
              </div>
            ` : ''}

            <!-- Logros Académicos, Títulos y Diplomados -->
            <div style="margin-bottom: 1.05rem;">
              ${t.titulos_academicos ? `
                <div style="font-size: 0.8rem; font-weight: 700; color: var(--soft-text-title); line-height: 1.4; margin-bottom: 0.35rem;">
                  ${this.escapeHtml(t.titulos_academicos)}
                </div>
              ` : ''}
              ${t.diplomados_certificaciones ? `
                <div style="font-size: 0.76rem; color: var(--soft-text-body); line-height: 1.42; margin-bottom: 0.5rem; background: var(--soft-lavender-surface); padding: 0.55rem 0.75rem; border-radius: 10px; border: 1px solid var(--soft-border-card-inner);">
                  ${this.escapeHtml(t.diplomados_certificaciones)}
                </div>
              ` : ''}
              <p style="margin: 0; font-size: 0.83rem; color: var(--soft-text-body); line-height: 1.52;">
                ${this.escapeHtml(bio)}
              </p>
            </div>
          </div>

          <!-- Info Consultorio & Turno -->
          <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 13px; padding: 0.75rem 0.95rem; font-size: 0.8rem; display: flex; flex-direction: column; gap: 0.35rem;">
            <div style="display: flex; align-items: center; gap: 0.45rem; color: var(--soft-text-title); font-weight: 600;">
              <span style="color: var(--soft-purple-primary);">${Icons.clinic(13)}</span>
              <span>${this.escapeHtml(roomName)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.45rem; color: var(--soft-text-body); font-size: 0.78rem;">
              <span style="color: var(--soft-mint-deep);">${Icons.clock(13)}</span>
              <span>${this.escapeHtml(turnoText)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/[()]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
