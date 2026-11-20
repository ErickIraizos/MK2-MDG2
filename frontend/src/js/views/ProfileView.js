import { apiClient } from '../api/apiClient.js';
import { Toast } from '../components/Toast.js';
import { Icons } from '../components/Icons.js';
import { store } from '../store.js';
import { SignatureCanvas } from '../components/SignatureCanvas.js';

export class ProfileView {
  constructor(container) {
    this.container = container;
    this.modalSignatureCanvasInstance = null;
    this.modalUploadedImageBlob = null;
    this.modalSignatureMode = 'draw'; // 'draw' | 'upload'
  }

  escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/[()]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  _escapeHtml(str) {
    return this.escapeHtml(str);
  }

  splitPhone(raw) {
    if (!raw) return { code: '+591', number: '' };
    const str = String(raw).trim();
    const codes = ['+591', '+54', '+51', '+56', '+55', '+57', '+595', '+598', '+1', '+34'];
    for (const c of codes) {
      if (str.startsWith(c)) {
        return { code: c, number: str.slice(c.length).replace(/[^\d]/g, '') };
      }
      const cleanC = c.replace('+', '');
      if (str.startsWith(cleanC)) {
        return { code: c, number: str.slice(cleanC.length).replace(/[^\d]/g, '') };
      }
    }
    return { code: '+591', number: str.replace(/[^\d]/g, '') };
  }

  async render() {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem;">
        <div class="soft-icon-box soft-icon-box-lavender" style="margin: 0 auto;">
          <div style="display: inline-flex; animation: spin 1.1s linear infinite;">${Icons.pulse(24, 'var(--soft-purple-primary)')}</div>
        </div>
        <p style="color: var(--soft-text-body); margin-top: 0.9rem; font-weight: 500; font-size: 0.9rem;">Cargando perfil de usuario institucional...</p>
      </div>
    `;

    try {
      // Consultar datos actualizados del usuario autenticado
      let user = store.getState().user;
      try {
        const res = await apiClient.get('/auth/me');
        if (res.data) {
          user = { ...user, ...res.data };
          store.setUser(user);
        }
      } catch (e) {
        // En caso de modo offline o error de red, usar datos del store
      }

      let therapistData = null;
      if (user && user.rol === 'TERAPEUTA') {
        try {
          const tRes = await apiClient.get('/therapists/me');
          if (tRes?.data) {
            therapistData = tRes.data;
          }
        } catch (te) {
          console.warn('[ProfileView] No se pudo cargar perfil de terapeuta:', te);
        }
      }

      if (!user) {
        this.container.innerHTML = `
          <div class="page-container panel-general" style="max-width: 640px; margin: 0 auto;">
            <div class="soft-card-static" style="text-align: center; padding: 2.75rem 2rem;">
              <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 1rem auto;">
                ${Icons.lock(24, 'var(--soft-purple-primary)')}
              </div>
              <p style="color: var(--soft-text-title); font-weight: 700; font-size: 1.05rem; margin: 0 0 1.25rem 0;">No se encontró una sesión activa.</p>
              <a href="#/login" class="soft-btn soft-btn-lvl-1">
                ${Icons.lock(15, '#FFFFFF')}
                <span>Iniciar Sesión</span>
              </a>
            </div>
          </div>
        `;
        return;
      }

      // Desglose de C.I. para tutores
      let ciNum = '';
      let ciDep = 'CB';
      if (user.tutor && user.tutor.ci) {
        const parts = String(user.tutor.ci).trim().split(/\s+/);
        ciNum = parts[0] || '';
        ciDep = parts[1] ? parts[1].toUpperCase() : 'CB';
      }

      // Desglose telefónico
      const staffPhoneSplitted = this.splitPhone(user.telefono);
      const tutorPhoneSplitted = this.splitPhone(user.tutor?.whatsapp || user.telefono);

      // Iniciales para el avatar
      const initials = (user.nombre_completo || 'Usuario')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(n => n[0].toUpperCase())
        .join('');

      // Estilos según el rol
      let roleBadgeClass = 'soft-badge-lavender';
      let roleDescription = 'Dirección General y Control Total del Sistema';
      if (user.rol === 'TERAPEUTA') {
        roleBadgeClass = 'soft-badge-mint';
        roleDescription = 'Personal Clínico Especialista · Atención y Fichas Demográficas';
      } else if (user.rol === 'RECEPCION') {
        roleBadgeClass = 'soft-badge-indigo';
        roleDescription = 'Admisión, Cobros y Recepción de Pacientes';
      } else if (user.rol === 'TUTOR') {
        roleBadgeClass = 'soft-badge-indigo';
        roleDescription = 'Familia y Tutor Legal · Seguimiento de Paciente';
      }

      let mainContentHtml = '';

      if (user.rol === 'TERAPEUTA') {
        mainContentHtml = `
          <!-- CABECERA TERAPEUTA -->
          <div class="soft-header-row">
            <div>
              <div class="soft-header-meta">
                <span class="soft-badge soft-badge-mint" style="text-transform: uppercase; font-size: 0.71rem; letter-spacing: 0.05em;">
                  Rol: Especialista Clínico Colegiado
                </span>
                <span class="soft-location-label">
                  Centro PSI Aprende · Credenciales Sanitarias
                </span>
              </div>
              <h1 class="soft-page-title">
                Perfil Profesional del Terapeuta
              </h1>
              <p class="soft-page-subtitle">
                Acreditación oficial, matrícula profesional, firma digital colegiada y configuración de seguridad.
              </p>
            </div>
          </div>

          <!-- BANNER SUPERIOR: CÓDIGO QR Y TARIFARIO DE HONORARIOS -->
          <div class="soft-card-static" style="background: linear-gradient(135deg, rgba(88, 66, 148, 0.06) 0%, rgba(21, 150, 141, 0.06) 100%); border: 1px solid var(--soft-border-card-inner); border-radius: 16px; padding: 1.25rem 1.6rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 1rem; min-width: min(100%, 280px); flex: 1;">
              <div class="soft-icon-box soft-icon-box-lavender" style="flex-shrink: 0;">
                ${Icons.wallet(24, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title);">
                    Mi Código QR de Cobro &amp; Tarifario Clínico
                  </h3>
                  <span class="soft-badge soft-badge-mint" style="font-size: 0.7rem; font-weight: 700;">
                    Cobro Directo de Pacientes
                  </span>
                </div>
                <p style="margin: 0.25rem 0 0; font-size: 0.83rem; color: var(--soft-text-body); line-height: 1.45;">
                  Fije sus aranceles en bolivianos Bs para diagnósticos, terapias completas e intervenciones, y actualice la imagen y fecha de caducidad de su código QR bancario.
                </p>
              </div>
            </div>
            <a href="#/caja?tab=my_config" class="soft-btn soft-btn-lvl-1" style="text-decoration: none; padding: 0.65rem 1.25rem; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.5rem; white-space: nowrap;">
              ${Icons.qrCode(16, '#FFFFFF')}
              <span>Abrir Mi Tarifario &amp; QR</span>
            </a>
          </div>

          <!-- BLOQUE SUPERIOR EN 2 PANELES HORIZONTALES: IDENTIDAD Y CONTACTO / FIRMA -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 1.5rem; align-items: stretch; margin-bottom: 1.5rem;">
            
            <!-- TARJETA 1: IDENTIDAD Y MATRÍCULA PROFESIONAL -->
            <div class="soft-card-static" style="position: relative; display: flex; flex-direction: column; justify-content: space-between;">
              <span class="soft-status-dot-green" title="Especialista activo" aria-hidden="true"></span>

              <div>
                <div style="display: flex; align-items: center; gap: 1.15rem; margin-bottom: 1.2rem; padding-bottom: 1.15rem; border-bottom: 1px solid var(--soft-divider);">
                  <div style="position: relative; width: 68px; height: 68px; flex-shrink: 0;">
                    ${therapistData?.foto_url ? `
                      <img id="profile-therapist-photo-img" src="${this.escapeHtml(therapistData.foto_url)}" alt="Foto de perfil" style="width: 100%; height: 100%; border-radius: 20px; object-fit: cover; border: 2px solid var(--soft-purple-primary); box-shadow: 0 4px 14px rgba(88,66,148,0.2);" />
                    ` : `
                      <div id="profile-therapist-avatar-fallback" class="soft-avatar-lg" style="width: 100%; height: 100%; font-size: 1.3rem;">
                        ${initials}
                      </div>
                    `}
                  </div>
                  <div style="min-width: 0; padding-right: 0.85rem; flex: 1;">
                    <h3 style="margin: 0 0 0.35rem 0; font-size: 1.24rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em; word-break: break-word;">
                      ${user.nombre_completo}
                    </h3>
                    <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
                      <span class="soft-badge soft-badge-mint" style="text-transform: uppercase; font-size: 0.7rem;">
                        ${user.rol}
                      </span>
                      <span class="soft-badge soft-badge-emerald" style="font-size: 0.72rem;">
                        <span class="soft-status-dot"></span>
                        <span>Habilitado Clínico</span>
                      </span>
                    </div>
                    <div>
                      <input type="file" id="therapist-file-photo" accept="image/*" style="display: none;" />
                      <button type="button" id="btn-upload-therapist-photo" class="soft-btn soft-btn-lvl-1-muted soft-btn-sm" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                        ${Icons.upload(13, 'currentColor')}
                        <span>${therapistData?.foto_url ? 'Cambiar Foto de Perfil' : 'Subir Mi Foto de Perfil'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- SUBCARD ESPECIALIDAD Y REGISTRO CPB -->
                <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.95rem 1.1rem; margin-bottom: 1.15rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.45rem; flex-wrap: wrap;">
                    <span style="font-size: 0.76rem; color: var(--soft-text-overline); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Especialidad Acreditada:</span>
                    <span style="font-size: 0.82rem; font-weight: 800; color: var(--soft-purple-primary);">${user.terapeuta?.especialidad || 'Neuropsicología / Psicología Clínica'}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <span style="font-size: 0.76rem; color: var(--soft-text-overline); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Matrícula Profesional CPB:</span>
                    <span class="soft-badge soft-badge-indigo" style="font-family: monospace; font-size: 0.78rem; font-weight: 700;">${user.terapeuta?.registro_profesional || 'CPB Oficial'}</span>
                  </div>
                </div>

                <!-- DETALLES DE LA CUENTA EN CUADRÍCULA HORIZONTAL -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr)); gap: 0.8rem; font-size: 0.86rem;">
                  <div style="border-bottom: 1px solid var(--soft-divider); padding-bottom: 0.55rem;">
                    <span style="display: block; font-size: 0.74rem; color: var(--soft-text-overline); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;">Correo Institucional:</span>
                    <span style="font-weight: 700; color: var(--soft-text-title); word-break: break-all;">${user.email}</span>
                  </div>

                  <div style="border-bottom: 1px solid var(--soft-divider); padding-bottom: 0.55rem;">
                    <span style="display: block; font-size: 0.74rem; color: var(--soft-text-overline); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem;">Código de Personal:</span>
                    <span class="soft-specialty-tag" style="font-family: monospace; margin-left: 0;">USR-${String(user.id).padStart(4, '0')}</span>
                  </div>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--soft-divider); margin-top: 0.85rem;">
                <span style="color: var(--soft-text-overline); font-weight: 600; font-size: 0.82rem;">Marco Bioético:</span>
                <span class="soft-badge soft-badge-mint" style="font-size: 0.75rem;">Ley 3131 / CPB Oficial</span>
              </div>
            </div>

            <!-- TARJETA 2: CONTACTO PROFESIONAL Y FIRMA DIGITAL COLEGIADA -->
            <div class="soft-card-static" style="display: flex; flex-direction: column; justify-content: space-between; gap: 1.25rem;">
              
              <!-- CONTACTO Y WHATSAPP COMPACTO -->
              <div>
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.45rem;">
                  <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                    ${Icons.whatsapp(18, 'var(--soft-mint-deep)')}
                  </div>
                  <div>
                    <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--soft-text-title);">
                      Contacto Profesional &amp; WhatsApp
                    </h4>
                    <span style="font-size: 0.72rem; color: var(--soft-mint-deep); font-weight: 700; text-transform: uppercase;">
                      Canal Directo de Pacientes
                    </span>
                  </div>
                </div>
                <p style="font-size: 0.82rem; color: var(--soft-text-body); margin: 0 0 0.85rem 0; line-height: 1.42;">
                  Número utilizado para enlazar recordatorios y avisos con sus pacientes.
                </p>

                <form id="profile-staff-phone-form">
                  <div style="display: flex; gap: 0.5rem; align-items: stretch; flex-wrap: wrap;">
                    <div class="soft-phone-group" style="flex: 1; min-width: min(100%, 220px);">
                      <select id="staff-phone-country" class="soft-phone-prefix-select" title="Código internacional">
                        <option value="+591" ${staffPhoneSplitted.code === '+591' ? 'selected' : ''}>🇧🇴 +591</option>
                        <option value="+54" ${staffPhoneSplitted.code === '+54' ? 'selected' : ''}>🇦🇷 +54</option>
                        <option value="+51" ${staffPhoneSplitted.code === '+51' ? 'selected' : ''}>🇵🇪 +51</option>
                        <option value="+56" ${staffPhoneSplitted.code === '+56' ? 'selected' : ''}>🇨🇱 +56</option>
                        <option value="+55" ${staffPhoneSplitted.code === '+55' ? 'selected' : ''}>🇧🇷 +55</option>
                        <option value="+57" ${staffPhoneSplitted.code === '+57' ? 'selected' : ''}>🇨🇴 +57</option>
                        <option value="+595" ${staffPhoneSplitted.code === '+595' ? 'selected' : ''}>🇵🇾 +595</option>
                        <option value="+598" ${staffPhoneSplitted.code === '+598' ? 'selected' : ''}>🇺🇾 +598</option>
                        <option value="+1" ${staffPhoneSplitted.code === '+1' ? 'selected' : ''}>🇺🇸 +1</option>
                        <option value="+34" ${staffPhoneSplitted.code === '+34' ? 'selected' : ''}>🇪🇸 +34</option>
                      </select>
                      <input 
                        type="tel" 
                        id="staff-phone-number" 
                        class="soft-input soft-phone-number-input" 
                        placeholder="Ej: 62717425" 
                        value="${staffPhoneSplitted.number}" 
                        maxlength="15" 
                        required 
                      />
                    </div>
                    <button 
                      type="submit" 
                      id="btn-staff-save-phone" 
                      class="soft-btn soft-btn-lvl-1" 
                      style="padding: 0.55rem 1.15rem; font-size: 0.85rem; white-space: nowrap;"
                    >
                      ${Icons.check(15, '#FFFFFF')}
                      <span>Guardar</span>
                    </button>
                  </div>
                </form>
              </div>

              <!-- SEPARADOR -->
              <div style="border-top: 1px solid var(--soft-divider); padding-top: 0.95rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.45rem;">
                  <div style="display: flex; align-items: center; gap: 0.65rem;">
                    <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                      ${Icons.signature(18, 'var(--soft-purple-primary)')}
                    </div>
                    <div>
                      <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--soft-text-title);">
                        Firma Digital &amp; Rúbrica Colegiada
                      </h4>
                      <span style="font-size: 0.72rem; color: var(--soft-purple-primary); font-weight: 700; text-transform: uppercase;">
                        Estampado en Fichas e Informes
                      </span>
                    </div>
                  </div>
                </div>

                ${user.firma_digital_blob ? `
                  <div id="sig-current-preview-box" style="background: #FFFFFF; border: 1.5px solid var(--soft-border-card-inner); border-radius: 12px; padding: 0.75rem 1rem; text-align: center; margin: 0.75rem 0; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                    <img src="${user.firma_digital_blob}" alt="Firma Colegiada Registrada" style="max-height: 52px; max-width: 160px; object-fit: contain;" />
                    <div style="display: flex; gap: 0.5rem;">
                      <button type="button" id="btn-open-signature-modal" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted">
                        ${Icons.signature(13, 'currentColor')}
                        <span>Actualizar</span>
                      </button>
                      <button type="button" id="btn-delete-signature" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="color: #E11D48;" title="Eliminar rúbrica">
                        ${Icons.trash(13)}
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                ` : `
                  <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 0.75rem 1rem; margin: 0.75rem 0; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                    <span style="font-size: 0.8rem; color: #92400E;">Sin rúbrica registrada. Regístrela para validar informes.</span>
                    <button type="button" id="btn-open-signature-modal" class="soft-btn soft-btn-sm soft-btn-lvl-1" style="white-space: nowrap;">
                      ${Icons.signature(14, '#FFFFFF')}
                      <span>Registrar</span>
                    </button>
                  </div>
                `}
              </div>

            </div>
          </div>

          <!-- BLOQUE INTERMEDIO A TODO EL ANCHO: LOGROS ACADÉMICOS Y PERFIL PÚBLICO HORIZONTAL -->
          <div class="soft-card-static" style="background: #FFFFFF; margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.65rem; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 0.8rem;">
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                  ${Icons.badge(20, 'var(--soft-mint-deep)')}
                </div>
                <div>
                  <h3 style="margin: 0; font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em;">
                    Logros Académicos &amp; Perfil Público
                  </h3>
                  <div style="font-size: 0.74rem; color: var(--soft-mint-deep); font-weight: 700; text-transform: uppercase;">
                    Visible para Familias y Tutores en Sobre Nosotros y Directorio
                  </div>
                </div>
              </div>
              <span class="soft-badge soft-badge-mint" style="font-size: 0.74rem;">
                ${Icons.check(13, 'currentColor')}
                <span>Sincronización en Tiempo Real con Portal Tutor</span>
              </span>
            </div>
            <p style="font-size: 0.84rem; color: var(--soft-text-body); margin: 0 0 1.35rem 0; line-height: 1.48;">
              Esta información se exhibe en la vitrina institucional para generar confianza y transparencia clínica en los padres de familia.
            </p>

            <form id="therapist-achievements-form">
              <input type="hidden" id="therapist-id-hidden" value="${therapistData?.id || ''}" />
              
              <!-- FILA 1 HORIZONTAL: TÍTULOS Y DIPLOMADOS -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 1.25rem; margin-bottom: 1.15rem;">
                <div>
                  <label class="soft-label" for="therapist-titulos">
                    Títulos Académicos y Grados Oficiales
                  </label>
                  <input 
                    type="text" 
                    id="therapist-titulos" 
                    class="soft-input" 
                    placeholder="Ej: Licenciada en Psicología por la UMSS, Maestría en Neuropsicología Infantil" 
                    value="${this.escapeHtml(therapistData?.titulos_academicos || '')}" 
                  />
                  <div style="font-size: 0.73rem; color: var(--soft-text-muted); margin-top: 0.25rem;">
                    Licenciaturas, Maestrías y Especialidades universitarias concluidas.
                  </div>
                </div>

                <div>
                  <label class="soft-label" for="therapist-diplomados">
                    Diplomados, Certificaciones &amp; Cursos de Especialidad
                  </label>
                  <input 
                    type="text" 
                    id="therapist-diplomados" 
                    class="soft-input" 
                    placeholder="Ej: Certificación ADOS-2 y WISC-V, Diplomado en Neurodesarrollo y TCC" 
                    value="${this.escapeHtml(therapistData?.diplomados_certificaciones || '')}" 
                  />
                  <div style="font-size: 0.73rem; color: var(--soft-text-muted); margin-top: 0.25rem;">
                    Diplomados clínicos, pruebas estandarizadas certificadas y formación continua.
                  </div>
                </div>
              </div>

              <!-- FILA 2 HORIZONTAL: EXPERIENCIA Y ENFOQUE -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 1.25rem; margin-bottom: 1.15rem;">
                <div>
                  <label class="soft-label" for="therapist-experiencia">
                    Años de Experiencia Clínica
                  </label>
                  <input 
                    type="text" 
                    id="therapist-experiencia" 
                    class="soft-input" 
                    placeholder="Ej: 10 años de trayectoria clínica en diagnóstico e intervención" 
                    value="${this.escapeHtml(therapistData?.experiencia_anios || '')}" 
                  />
                </div>

                <div>
                  <label class="soft-label" for="therapist-enfoque">
                    Enfoque o Corriente Terapéutica
                  </label>
                  <input 
                    type="text" 
                    id="therapist-enfoque" 
                    class="soft-input" 
                    placeholder="Ej: Cognitivo-Conductual, Neurocognitivo y Sistémico Familiar" 
                    value="${this.escapeHtml(therapistData?.enfoque_terapeutico || '')}" 
                  />
                </div>
              </div>

              <!-- FILA 3 HORIZONTAL: BIOGRAFÍA -->
              <div style="margin-bottom: 1.35rem;">
                <label class="soft-label" for="therapist-bio">
                  Biografía y Presentación Profesional
                </label>
                <textarea 
                  id="therapist-bio" 
                  class="soft-textarea" 
                  rows="3" 
                  placeholder="Resumen de su vocación profesional y áreas de atención clínica..."
                >${this.escapeHtml(therapistData?.bio || '')}</textarea>
              </div>

              <!-- FILA 4: BARRA DE GUARDADO HORIZONTAL -->
              <div style="display: flex; justify-content: flex-end; align-items: center; gap: 1rem; border-top: 1px solid var(--soft-divider); padding-top: 1.15rem;">
                <button 
                  type="submit" 
                  id="btn-save-therapist-achievements" 
                  class="soft-btn soft-btn-lvl-1" 
                  style="padding: 0.75rem 1.75rem;"
                >
                  ${Icons.check(16, '#FFFFFF')}
                  <span>Guardar Logros Académicos y Perfil Público</span>
                </button>
              </div>
            </form>
          </div>

          <!-- BLOQUE INFERIOR A TODO EL ANCHO: SEGURIDAD Y CAMBIO DE CONTRASEÑA HORIZONTAL -->
          <div class="soft-card-static">
            <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.55rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                ${Icons.lock(20, 'var(--soft-purple-primary)')}
              </div>
              <div>
                <h3 style="margin: 0; font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em;">
                  Seguridad y Contraseña
                </h3>
                <div style="font-size: 0.74rem; color: var(--soft-purple-primary); font-weight: 700; text-transform: uppercase;">
                  Protección de Datos Clínicos · Auditoría en Tiempo Real
                </div>
              </div>
            </div>
            <p style="font-size: 0.84rem; color: var(--soft-text-body); margin: 0 0 1.25rem 0; line-height: 1.48;">
              Por políticas de protección de datos clínicos del Centro PSI Aprende, se recomienda actualizar su clave de forma periódica.
            </p>

            <form id="profile-change-pass-form">
              <!-- FILA DE 3 COLUMNAS HORIZONTALES PARA CONTRASEÑAS -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 1.25rem; margin-bottom: 1.25rem;">
                <div>
                  <label class="soft-label" for="profile-current-pass">
                    Contraseña Actual <span class="required">*</span>
                  </label>
                  <input 
                    type="password" 
                    id="profile-current-pass" 
                    class="soft-input" 
                    placeholder="Ingrese su contraseña actual" 
                    required 
                  />
                </div>

                <div>
                  <label class="soft-label" for="profile-new-pass">
                    Nueva Contraseña <span class="required">*</span>
                  </label>
                  <input 
                    type="password" 
                    id="profile-new-pass" 
                    class="soft-input" 
                    placeholder="Mínimo 8 caracteres" 
                    minlength="8" 
                    required 
                  />
                  <div style="font-size: 0.73rem; color: var(--soft-text-muted); margin-top: 0.25rem;">
                    Al menos 8 caracteres con letras y números.
                  </div>
                </div>

                <div>
                  <label class="soft-label" for="profile-confirm-pass">
                    Confirmar Nueva Contraseña <span class="required">*</span>
                  </label>
                  <input 
                    type="password" 
                    id="profile-confirm-pass" 
                    class="soft-input" 
                    placeholder="Repita la nueva contraseña" 
                    minlength="8" 
                    required 
                  />
                </div>
              </div>

              <!-- BARRA DE ACCIÓN Y AUDITORÍA HORIZONTAL -->
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 1.25rem; flex-wrap: wrap; border-top: 1px solid var(--soft-divider); padding-top: 1.15rem;">
                <div style="display: flex; align-items: center; gap: 0.55rem; font-size: 0.78rem; color: var(--soft-text-muted); max-width: 540px;">
                  <span style="color: var(--soft-purple-vivid); flex-shrink: 0;">
                    ${Icons.shield(16, 'var(--soft-purple-vivid)')}
                  </span>
                  <span><strong>Confidencialidad Clínica:</strong> Cualquier modificación queda debidamente registrada en la bitácora de auditoría con marca de tiempo e IP de origen.</span>
                </div>

                <button 
                  type="submit" 
                  id="btn-profile-save-pass" 
                  class="soft-btn soft-btn-lvl-1" 
                  style="padding: 0.72rem 1.6rem; white-space: nowrap;"
                >
                  <span id="btn-save-pass-text" style="display: inline-flex; align-items: center; gap: 0.48rem;">
                    ${Icons.check(16, '#FFFFFF')}
                    <span>Guardar Nueva Contraseña</span>
                  </span>
                  <span id="btn-save-pass-spinner" style="display: none;">
                    Actualizando credenciales...
                  </span>
                </button>
              </div>
            </form>
          </div>
        `;
      } else {
        // DISEÑO EQUILIBRADO EN 2 COLUMNAS PARA OTROS ROLES (TUTOR, ADMIN, RECEPCION)
        mainContentHtml = `
          <!-- CABECERA -->
          <div class="soft-header-row">
            <div>
              <div class="soft-header-meta">
                <span class="soft-badge ${roleBadgeClass}" style="text-transform: uppercase; font-size: 0.71rem; letter-spacing: 0.05em;">
                  Rol: ${user.rol}
                </span>
                <span class="soft-location-label">
                  Centro PSI Aprende · Identidad y Credenciales
                </span>
              </div>
              <h1 class="soft-page-title">
                ${user.rol === 'TUTOR' ? 'Perfil Familiar del Tutor' : 'Perfil Institucional de Usuario'}
              </h1>
              <p class="soft-page-subtitle">
                Información de la cuenta, rol asignado en el centro y configuración de seguridad.
              </p>
            </div>
          </div>

          <!-- GRID DE 2 COLUMNAS BALANCEADAS -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 1.5rem; align-items: start;">
            
            <!-- COLUMNA IZQUIERDA: IDENTIDAD Y ACCESOS -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              
              <!-- TARJETA 1: IDENTIDAD Y DATOS PERSONALES -->
              <div class="soft-card-static" style="position: relative;">
                <span class="soft-status-dot-green" title="Cuenta activa en línea" aria-hidden="true"></span>

                <div style="display: flex; align-items: center; gap: 1.15rem; margin-bottom: 1.3rem; padding-bottom: 1.2rem; border-bottom: 1px solid var(--soft-divider);">
                  <div class="soft-avatar-lg">
                    ${initials}
                  </div>
                  <div style="min-width: 0; padding-right: 0.85rem;">
                    <h3 style="margin: 0 0 0.35rem 0; font-size: 1.24rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em; word-break: break-word;">
                      ${user.nombre_completo}
                    </h3>
                    <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                      <span class="soft-badge ${roleBadgeClass}" style="text-transform: uppercase; font-size: 0.7rem;">
                        ${user.rol}
                      </span>
                      <span class="soft-badge soft-badge-emerald" style="font-size: 0.72rem;">
                        <span class="soft-status-dot"></span>
                        <span>Cuenta Activa</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.85rem 1rem; margin-bottom: 1.3rem; display: flex; align-items: center; gap: 0.75rem;">
                  <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                    ${Icons.shield(18, 'var(--soft-purple-primary)')}
                  </div>
                  <div style="font-size: 0.82rem; line-height: 1.44; color: var(--soft-text-body);">
                    <strong style="color: var(--soft-text-title);">Nivel de Acceso:</strong> ${roleDescription}
                  </div>
                </div>

                <!-- DETALLES DE LA CUENTA -->
                <div style="display: flex; flex-direction: column; gap: 0.8rem; font-size: 0.86rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 0.65rem; flex-wrap: wrap;">
                    <span style="color: var(--soft-text-overline); font-weight: 600;">Correo Electrónico:</span>
                    <span style="font-weight: 700; color: var(--soft-text-title); word-break: break-all;">${user.email}</span>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 0.65rem; flex-wrap: wrap;">
                    <span style="color: var(--soft-text-overline); font-weight: 600;">Teléfono o WhatsApp:</span>
                    <span style="font-weight: 700; color: var(--soft-text-title);">${user.telefono || '<span style="color: var(--soft-text-muted); font-weight: 500;">No registrado</span>'}</span>
                  </div>

                  ${user.rol === 'TUTOR' ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 0.65rem; flex-wrap: wrap;">
                      <span style="color: var(--soft-text-overline); font-weight: 600;">Cédula de Identidad:</span>
                      <span style="font-weight: 700; color: ${user.tutor?.ci ? 'var(--soft-text-title)' : 'var(--soft-purple-primary)'};">
                        ${user.tutor?.ci || '<span style="font-style: italic; font-weight: 500; color: var(--soft-text-muted);">Sin registrar · Opcional</span>'}
                      </span>
                    </div>
                  ` : ''}

                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; border-bottom: 1px solid var(--soft-divider); padding-bottom: 0.65rem;">
                    <span style="color: var(--soft-text-overline); font-weight: 600;">Identificador Único:</span>
                    <span class="soft-specialty-tag" style="font-family: monospace; margin-left: 0;">USR-${String(user.id).padStart(4, '0')}</span>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; padding-top: 0.1rem;">
                    <span style="color: var(--soft-text-overline); font-weight: 600;">Persistencia Local:</span>
                    <span class="soft-badge soft-badge-mint">SQLite WAL Habilitado</span>
                  </div>
                </div>

                ${user.rol === 'TUTOR' ? `
                  <div class="soft-subcard" style="margin-top: 1.35rem; padding: 1rem 1.1rem;">
                    <div style="display: align-items: center; gap: 0.55rem; margin-bottom: 0.35rem; display: flex;">
                      <span style="color: var(--soft-purple-primary); display: inline-flex;">${Icons.patient(18, 'var(--soft-purple-primary)')}</span>
                      <span style="font-weight: 800; color: var(--soft-text-title); font-size: 0.88rem;">Portal de Familia</span>
                    </div>
                    <div style="font-size: 0.82rem; color: var(--soft-text-body); line-height: 1.45; margin-bottom: 0.85rem;">
                      Usted puede verificar el progreso, asistencias y terapeutas a cargo de su paciente desde el Panel General.
                    </div>
                    <a href="#/dashboard" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="width: 100%;">
                      ${Icons.dashboard(15, 'currentColor')}
                      <span>Ir al Panel de Familia</span>
                    </a>
                  </div>
                ` : ''}
              </div>

              ${user.rol === 'ADMIN' ? `
                <!-- TARJETA FIRMA DIGITAL ADMIN -->
                <div class="soft-card-static">
                  <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.55rem;">
                    <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                      ${Icons.signature(20, 'var(--soft-purple-primary)')}
                    </div>
                    <div>
                      <h3 style="margin: 0; font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em;">
                        Firma Digital y Rúbrica de Dirección
                      </h3>
                      <div style="font-size: 0.74rem; color: var(--soft-purple-primary); font-weight: 700; text-transform: uppercase;">
                        Dirección General PSI Aprende
                      </div>
                    </div>
                  </div>
                  <p style="font-size: 0.84rem; color: var(--soft-text-body); margin: 0 0 1.25rem 0; line-height: 1.48;">
                    Rúbrica oficial para validación de actas institucionales, certificados y documentos administrativos.
                  </p>

                  ${user.firma_digital_blob ? `
                    <div id="sig-current-preview-box" style="background: #FFFFFF; border: 1.5px solid var(--soft-border-card-inner); border-radius: 14px; padding: 1.1rem; text-align: center; margin-bottom: 1.1rem;">
                      <img src="${user.firma_digital_blob}" alt="Firma Registrada" style="max-height: 90px; max-width: 100%; object-fit: contain;" />
                    </div>
                    <div style="display: flex; gap: 0.6rem;">
                      <button type="button" id="btn-open-signature-modal" class="soft-btn soft-btn-lvl-1-muted" style="flex: 1;">
                        ${Icons.signature(14, 'var(--soft-purple-primary)')}
                        <span>Actualizar Rúbrica</span>
                      </button>
                      <button type="button" id="btn-delete-signature" class="soft-btn soft-btn-lvl-1-muted" style="color: #E11D48;" title="Eliminar">
                        ${Icons.trash(14)}
                        <span>Eliminar</span>
                      </button>
                    </div>
                  ` : `
                    <button type="button" id="btn-open-signature-modal" class="soft-btn soft-btn-lvl-1" style="width: 100%; padding: 0.72rem 1.15rem;">
                      ${Icons.signature(16, '#FFFFFF')}
                      <span>Registrar Firma Digital</span>
                    </button>
                  `}
                </div>
              ` : ''}

            </div>

            <!-- COLUMNA DERECHA: FORMULARIOS Y SEGURIDAD -->
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              
              ${user.rol === 'TUTOR' ? `
                <!-- TARJETA FILIACIÓN Y CÉDULA DE IDENTIDAD (TUTOR) -->
                <div class="soft-card-static soft-card-mint">
                  <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.55rem;">
                    <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                      ${Icons.family(20, 'var(--soft-mint-deep)')}
                    </div>
                    <h3 style="margin: 0; font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em;">
                      Filiación y Cédula de Identidad
                    </h3>
                  </div>
                  <p style="font-size: 0.84rem; color: var(--soft-text-body); margin: 0 0 1.35rem 0; line-height: 1.48;">
                    Complete o actualice su documento de identidad de forma opcional para formalizar las fichas y expedientes clínicos oficiales de sus hijos o pacientes a cargo.
                  </p>

                  <form id="profile-tutor-ci-form">
                    <div style="margin-bottom: 1.1rem;">
                      <label class="soft-label" for="tutor-ci-num">
                        Cédula de Identidad del Tutor <span style="font-size: 0.74rem; color: var(--soft-text-muted); font-weight: 500;">Opcional y Recomendado</span>
                      </label>
                      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 0.6rem;">
                        <input 
                          type="text" 
                          id="tutor-ci-num" 
                          class="soft-input" 
                          placeholder="Ej: 5432109" 
                          value="${ciNum}" 
                        />
                        <select id="tutor-ci-dep" class="soft-select">
                          <option value="CB" ${ciDep === 'CB' ? 'selected' : ''}>CB</option>
                          <option value="LP" ${ciDep === 'LP' ? 'selected' : ''}>LP</option>
                          <option value="SC" ${ciDep === 'SC' ? 'selected' : ''}>SC</option>
                          <option value="CH" ${ciDep === 'CH' ? 'selected' : ''}>CH</option>
                          <option value="OR" ${ciDep === 'OR' ? 'selected' : ''}>OR</option>
                          <option value="PT" ${ciDep === 'PT' ? 'selected' : ''}>PT</option>
                          <option value="TJ" ${ciDep === 'TJ' ? 'selected' : ''}>TJ</option>
                          <option value="BE" ${ciDep === 'BE' ? 'selected' : ''}>BE</option>
                          <option value="PD" ${ciDep === 'PD' ? 'selected' : ''}>PD</option>
                          <option value="EXT" ${ciDep === 'EXT' ? 'selected' : ''}>EXT</option>
                        </select>
                      </div>
                    </div>

                    <div style="margin-bottom: 1.1rem;">
                      <label class="soft-label" for="tutor-phone-number">
                        Teléfono o WhatsApp de Contacto
                      </label>
                      <div class="soft-phone-group">
                        <select id="tutor-phone-country" class="soft-phone-prefix-select" title="Código internacional">
                          <option value="+591" ${tutorPhoneSplitted.code === '+591' ? 'selected' : ''}>🇧🇴 +591 Bolivia</option>
                          <option value="+54" ${tutorPhoneSplitted.code === '+54' ? 'selected' : ''}>🇦🇷 +54 Argentina</option>
                          <option value="+51" ${tutorPhoneSplitted.code === '+51' ? 'selected' : ''}>🇵🇪 +51 Perú</option>
                          <option value="+56" ${tutorPhoneSplitted.code === '+56' ? 'selected' : ''}>🇨🇱 +56 Chile</option>
                          <option value="+55" ${tutorPhoneSplitted.code === '+55' ? 'selected' : ''}>🇧🇷 +55 Brasil</option>
                          <option value="+57" ${tutorPhoneSplitted.code === '+57' ? 'selected' : ''}>🇨🇴 +57 Colombia</option>
                          <option value="+595" ${tutorPhoneSplitted.code === '+595' ? 'selected' : ''}>🇵🇾 +595 Paraguay</option>
                          <option value="+598" ${tutorPhoneSplitted.code === '+598' ? 'selected' : ''}>🇺🇾 +598 Uruguay</option>
                          <option value="+1" ${tutorPhoneSplitted.code === '+1' ? 'selected' : ''}>🇺🇸 +1 Estados Unidos</option>
                          <option value="+34" ${tutorPhoneSplitted.code === '+34' ? 'selected' : ''}>🇪🇸 +34 España</option>
                        </select>
                        <input 
                          type="tel" 
                          id="tutor-phone-number" 
                          class="soft-input soft-phone-number-input" 
                          placeholder="Ej: 70000004" 
                          value="${tutorPhoneSplitted.number}" 
                          maxlength="15" 
                        />
                      </div>
                    </div>

                    <div style="margin-bottom: 1.45rem;">
                      <label class="soft-label" for="tutor-parentesco">
                        Parentesco Primario con el Paciente
                      </label>
                      <select id="tutor-parentesco" class="soft-select">
                        <option value="MADRE" ${(user.tutor?.parentesco === 'MADRE') ? 'selected' : ''}>Madre</option>
                        <option value="PADRE" ${(user.tutor?.parentesco === 'PADRE') ? 'selected' : ''}>Padre</option>
                        <option value="TUTOR_LEGAL" ${(user.tutor?.parentesco === 'TUTOR_LEGAL' || !user.tutor?.parentesco) ? 'selected' : ''}>Tutor Legal</option>
                        <option value="ABUELO_A" ${(user.tutor?.parentesco === 'ABUELO_A') ? 'selected' : ''}>Abuelo o Abuela</option>
                        <option value="TIO_A" ${(user.tutor?.parentesco === 'TIO_A') ? 'selected' : ''}>Tío o Tía</option>
                        <option value="HERMANO_MAYOR" ${(user.tutor?.parentesco === 'HERMANO_MAYOR') ? 'selected' : ''}>Hermano o Hermana Mayor</option>
                        <option value="OTRO" ${(user.tutor?.parentesco === 'OTRO') ? 'selected' : ''}>Otro</option>
                      </select>
                    </div>

                    <button 
                      type="submit" 
                      id="btn-tutor-save-ci" 
                      class="soft-btn soft-btn-lvl-1" 
                      style="width: 100%; padding: 0.72rem 1.15rem;"
                    >
                      <span id="btn-tutor-save-text" style="display: inline-flex; align-items: center; gap: 0.48rem;">
                        ${Icons.check(16, '#FFFFFF')}
                        <span>Guardar Filiación y Documento</span>
                      </span>
                    </button>
                  </form>
                </div>
              ` : `
                <!-- TARJETA CONTACTO Y WHATSAPP (PERSONAL CLÍNICO / ADMIN / RECEPCIÓN) -->
                <div class="soft-card-static soft-card-mint">
                  <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.55rem;">
                    <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                      ${Icons.whatsapp(20, 'var(--soft-mint-deep)')}
                    </div>
                    <h3 style="margin: 0; font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em;">
                      Contacto Oficial y WhatsApp
                    </h3>
                  </div>
                  <p style="font-size: 0.84rem; color: var(--soft-text-body); margin: 0 0 1.35rem 0; line-height: 1.48;">
                    Mantenga actualizado su número telefónico profesional. Este número se utilizará para enlazar su sesión de WhatsApp y remitir avisos a sus pacientes y tutores.
                  </p>

                  <form id="profile-staff-phone-form">
                    <div style="margin-bottom: 1.25rem;">
                      <label class="soft-label" for="staff-phone-number">
                        Número de Teléfono o WhatsApp Profesional <span class="required">*</span>
                      </label>
                      <div class="soft-phone-group">
                        <select id="staff-phone-country" class="soft-phone-prefix-select" title="Código internacional">
                          <option value="+591" ${staffPhoneSplitted.code === '+591' ? 'selected' : ''}>🇧🇴 +591 Bolivia</option>
                          <option value="+54" ${staffPhoneSplitted.code === '+54' ? 'selected' : ''}>🇦🇷 +54 Argentina</option>
                          <option value="+51" ${staffPhoneSplitted.code === '+51' ? 'selected' : ''}>🇵🇪 +51 Perú</option>
                          <option value="+56" ${staffPhoneSplitted.code === '+56' ? 'selected' : ''}>🇨🇱 +56 Chile</option>
                          <option value="+55" ${staffPhoneSplitted.code === '+55' ? 'selected' : ''}>🇧🇷 +55 Brasil</option>
                          <option value="+57" ${staffPhoneSplitted.code === '+57' ? 'selected' : ''}>🇨🇴 +57 Colombia</option>
                          <option value="+595" ${staffPhoneSplitted.code === '+595' ? 'selected' : ''}>🇵🇾 +595 Paraguay</option>
                          <option value="+598" ${staffPhoneSplitted.code === '+598' ? 'selected' : ''}>🇺🇾 +598 Uruguay</option>
                          <option value="+1" ${staffPhoneSplitted.code === '+1' ? 'selected' : ''}>🇺🇸 +1 Estados Unidos</option>
                          <option value="+34" ${staffPhoneSplitted.code === '+34' ? 'selected' : ''}>🇪🇸 +34 España</option>
                        </select>
                        <input 
                          type="tel" 
                          id="staff-phone-number" 
                          class="soft-input soft-phone-number-input" 
                          placeholder="Ej: 62717425" 
                          value="${staffPhoneSplitted.number}" 
                          maxlength="15" 
                          required 
                        />
                      </div>
                      <div style="font-size: 0.74rem; color: var(--soft-text-muted); margin-top: 0.35rem;">
                        Ingrese únicamente los dígitos locales. El prefijo internacional se gestionará automáticamente.
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      id="btn-staff-save-phone" 
                      class="soft-btn soft-btn-lvl-1" 
                      style="width: 100%; padding: 0.72rem 1.15rem;"
                    >
                      ${Icons.check(16, '#FFFFFF')}
                      <span>Guardar Teléfono y WhatsApp</span>
                    </button>
                  </form>
                </div>
              `}

              <!-- TARJETA SEGURIDAD Y CAMBIO DE CONTRASEÑA HORIZONTAL -->
              <div class="soft-card-static">
                <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 0.55rem;">
                  <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender">
                    ${Icons.lock(20, 'var(--soft-purple-primary)')}
                  </div>
                  <div>
                    <h3 style="margin: 0; font-size: 1.18rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.015em;">
                      Seguridad y Contraseña
                    </h3>
                    <div style="font-size: 0.74rem; color: var(--soft-purple-primary); font-weight: 700; text-transform: uppercase;">
                      Protección de Datos Clínicos · Auditoría en Tiempo Real
                    </div>
                  </div>
                </div>
                <p style="font-size: 0.84rem; color: var(--soft-text-body); margin: 0 0 1.25rem 0; line-height: 1.48;">
                  Por políticas de protección de datos clínicos del Centro PSI Aprende, se recomienda actualizar su clave de forma periódica.
                </p>

                <form id="profile-change-pass-form">
                  <!-- FILA DE 3 COLUMNAS HORIZONTALES PARA CONTRASEÑAS -->
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 1.25rem; margin-bottom: 1.25rem;">
                    <div>
                      <label class="soft-label" for="profile-current-pass">
                        Contraseña Actual <span class="required">*</span>
                      </label>
                      <input 
                        type="password" 
                        id="profile-current-pass" 
                        class="soft-input" 
                        placeholder="Ingrese su contraseña actual" 
                        required 
                      />
                    </div>

                    <div>
                      <label class="soft-label" for="profile-new-pass">
                        Nueva Contraseña <span class="required">*</span>
                      </label>
                      <input 
                        type="password" 
                        id="profile-new-pass" 
                        class="soft-input" 
                        placeholder="Mínimo 8 caracteres" 
                        minlength="8" 
                        required 
                      />
                      <div style="font-size: 0.73rem; color: var(--soft-text-muted); margin-top: 0.25rem;">
                        Al menos 8 caracteres con letras y números.
                      </div>
                    </div>

                    <div>
                      <label class="soft-label" for="profile-confirm-pass">
                        Confirmar Nueva Contraseña <span class="required">*</span>
                      </label>
                      <input 
                        type="password" 
                        id="profile-confirm-pass" 
                        class="soft-input" 
                        placeholder="Repita la nueva contraseña" 
                        minlength="8" 
                        required 
                      />
                    </div>
                  </div>

                  <!-- BARRA DE ACCIÓN Y AUDITORÍA HORIZONTAL -->
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 1.25rem; flex-wrap: wrap; border-top: 1px solid var(--soft-divider); padding-top: 1.15rem;">
                    <div style="display: flex; align-items: center; gap: 0.55rem; font-size: 0.78rem; color: var(--soft-text-muted); max-width: 540px;">
                      <span style="color: var(--soft-purple-vivid); flex-shrink: 0;">
                        ${Icons.shield(16, 'var(--soft-purple-vivid)')}
                      </span>
                      <span><strong>Confidencialidad Clínica:</strong> Cualquier modificación queda debidamente registrada en la bitácora de auditoría con marca de tiempo e IP de origen.</span>
                    </div>

                    <button 
                      type="submit" 
                      id="btn-profile-save-pass" 
                      class="soft-btn soft-btn-lvl-1" 
                      style="padding: 0.72rem 1.6rem; white-space: nowrap;"
                    >
                      <span id="btn-save-pass-text" style="display: inline-flex; align-items: center; gap: 0.48rem;">
                        ${Icons.check(16, '#FFFFFF')}
                        <span>Guardar Nueva Contraseña</span>
                      </span>
                      <span id="btn-save-pass-spinner" style="display: none;">
                        Actualizando credenciales...
                      </span>
                    </button>
                  </div>
                </form>
              </div>          </div>
        `;
      }

      this.container.innerHTML = `
        <div class="page-container panel-general" style="max-width: ${user.rol === 'TUTOR' ? '1180px' : '1100px'}; margin: 0 auto;">
          ${mainContentHtml}
        </div>
        <div id="modal-container-profile"></div>
      `;

      this.attachEvents();
    } catch (err) {
      this.container.innerHTML = `
        <div class="page-container panel-general" style="max-width: 680px; margin: 0 auto;">
          <div class="soft-card-static" style="text-align: center; padding: 2.5rem 2rem;">
            <div class="soft-icon-box soft-icon-box-lg soft-icon-box-lavender" style="margin: 0 auto 0.9rem auto;">
              ${Icons.alert(24, 'var(--soft-purple-primary)')}
            </div>
            <h3 style="color: var(--soft-text-title); font-weight: 800; margin: 0 0 0.45rem 0;">Error al cargar el perfil de usuario</h3>
            <p style="color: var(--soft-text-body); margin: 0;">${err.message}</p>
          </div>
        </div>
      `;
    }
  }

  attachEvents() {
    const tutorCiForm = document.getElementById('profile-tutor-ci-form');
    if (tutorCiForm) {
      tutorCiForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ciNumInput = document.getElementById('tutor-ci-num');
        const ciDepSelect = document.getElementById('tutor-ci-dep');
        const countrySelect = document.getElementById('tutor-phone-country');
        const phoneInput = document.getElementById('tutor-phone-number');
        const parentescoSelect = document.getElementById('tutor-parentesco');
        const submitBtn = document.getElementById('btn-tutor-save-ci');

        const ciRaw = ciNumInput ? ciNumInput.value.trim() : '';
        const ciDep = ciDepSelect ? ciDepSelect.value : 'CB';
        const fullCi = ciRaw ? `${ciRaw} ${ciDep}` : null;
        
        const country = countrySelect ? countrySelect.value : '+591';
        const localNum = phoneInput ? phoneInput.value.replace(/[^\d]/g, '') : '';
        const fullWhatsapp = localNum ? `${country} ${localNum}` : null;
        const parentesco = parentescoSelect ? parentescoSelect.value : 'TUTOR_LEGAL';

        if (submitBtn) submitBtn.disabled = true;

        try {
          const res = await apiClient.put('/auth/profile', {
            ci: fullCi,
            telefono: fullWhatsapp,
            whatsapp: fullWhatsapp,
            parentesco
          });

          if (res.success && res.data) {
            store.setUser(res.data);
            Toast.success('Filiación y datos actualizados exitosamente.');
            await this.render();
          }
        } catch (err) {
          Toast.error(err.message || 'Error al actualizar información de filiación.');
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    const staffPhoneForm = document.getElementById('profile-staff-phone-form');
    if (staffPhoneForm) {
      staffPhoneForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const countrySelect = document.getElementById('staff-phone-country');
        const phoneInput = document.getElementById('staff-phone-number');
        const submitBtn = document.getElementById('btn-staff-save-phone');
        
        const country = countrySelect ? countrySelect.value : '+591';
        const localNum = phoneInput ? phoneInput.value.replace(/[^\d]/g, '') : '';

        if (!localNum || localNum.length < 7) {
          Toast.error('Por favor ingrese un número local válido, mínimo 7 dígitos.');
          return;
        }

        const fullPhone = `${country} ${localNum}`;

        if (submitBtn) submitBtn.disabled = true;

        try {
          const res = await apiClient.put('/auth/profile', {
            telefono: fullPhone
          });

          if (res.success && res.data) {
            store.setUser(res.data);
            Toast.success('Teléfono profesional actualizado exitosamente.');
            await this.render();
          }
        } catch (err) {
          Toast.error(err.message || 'Error al actualizar el teléfono.');
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    const passForm = document.getElementById('profile-change-pass-form');
    if (passForm) {
      passForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassInput = document.getElementById('profile-current-pass');
        const newPassInput = document.getElementById('profile-new-pass');
        const confirmPassInput = document.getElementById('profile-confirm-pass');
        const submitBtn = document.getElementById('btn-profile-save-pass');
        const btnText = document.getElementById('btn-save-pass-text');
        const btnSpinner = document.getElementById('btn-save-pass-spinner');

        const currentPassword = currentPassInput.value;
        const newPassword = newPassInput.value;
        const confirmPassword = confirmPassInput.value;

        if (!currentPassword) {
          Toast.error('Por favor ingrese su contraseña actual.');
          currentPassInput.focus();
          return;
        }

        if (newPassword.length < 8) {
          Toast.error('La nueva contraseña debe tener un mínimo de 8 caracteres.');
          newPassInput.focus();
          return;
        }

        if (newPassword !== confirmPassword) {
          Toast.error('La confirmación no coincide con la nueva contraseña.');
          confirmPassInput.focus();
          return;
        }

        submitBtn.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnSpinner) btnSpinner.style.display = 'inline';

        try {
          const res = await apiClient.post('/auth/change-password', {
            currentPassword,
            newPassword
          });

          Toast.success(res.message || 'Contraseña actualizada correctamente.');
          passForm.reset();
        } catch (err) {
          Toast.error(err.message || 'Error al actualizar contraseña. Verifique su clave actual.');
        } finally {
          submitBtn.disabled = false;
          if (btnText) btnText.style.display = 'inline-flex';
          if (btnSpinner) btnSpinner.style.display = 'none';
        }
      });
    }

    // Modal para Registrar o Actualizar Firma Digital Colegiada
    const btnOpenSigModal = document.getElementById('btn-open-signature-modal');
    if (btnOpenSigModal) {
      btnOpenSigModal.addEventListener('click', () => {
        this.openSignatureModal();
      });
    }

    // Modal para Eliminar Firma Digital
    const btnDeleteSig = document.getElementById('btn-delete-signature');
    if (btnDeleteSig) {
      btnDeleteSig.addEventListener('click', () => {
        this.openDeleteSignatureModal();
      });
    }

    // Subida de Foto de Perfil del Terapeuta
    const btnUploadPhoto = document.getElementById('btn-upload-therapist-photo');
    const filePhotoInput = document.getElementById('therapist-file-photo');
    if (btnUploadPhoto && filePhotoInput) {
      btnUploadPhoto.addEventListener('click', () => filePhotoInput.click());

      filePhotoInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const hiddenId = document.getElementById('therapist-id-hidden')?.value;
        const formData = new FormData();
        formData.append('foto', file);

        try {
          Toast.info('Subiendo fotografía de perfil profesional...');
          const endpoint = hiddenId ? `/therapists/${hiddenId}/photo` : '/therapists/upload-photo';
          const res = await apiClient.upload(endpoint, formData);

          if (res?.data?.url) {
            Toast.success('Foto de perfil actualizada exitosamente.');
            await this.render();
          } else {
            throw new Error(res?.error?.message || 'Error al procesar la imagen.');
          }
        } catch (uploadErr) {
          console.error('[Upload Therapist Photo Error]', uploadErr);
          Toast.error(uploadErr.message || 'Error al subir fotografía de perfil.');
        }
      });
    }

    // Guardado de Logros Académicos y Perfil Público
    const achievementsForm = document.getElementById('therapist-achievements-form');
    if (achievementsForm) {
      achievementsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const hiddenId = document.getElementById('therapist-id-hidden')?.value;
        if (!hiddenId) {
          Toast.error('No se pudo identificar el registro de terapeuta vinculado.');
          return;
        }

        const titulos_academicos = document.getElementById('therapist-titulos')?.value.trim();
        const diplomados_certificaciones = document.getElementById('therapist-diplomados')?.value.trim();
        const experiencia_anios = document.getElementById('therapist-experiencia')?.value.trim();
        const enfoque_terapeutico = document.getElementById('therapist-enfoque')?.value.trim();
        const bio = document.getElementById('therapist-bio')?.value.trim();

        const submitBtn = document.getElementById('btn-save-therapist-achievements');
        if (submitBtn) submitBtn.disabled = true;

        try {
          await apiClient.put(`/therapists/${hiddenId}`, {
            titulos_academicos,
            diplomados_certificaciones,
            experiencia_anios,
            enfoque_terapeutico,
            bio
          });

          Toast.success('Logros académicos y perfil público guardados exitosamente.');
          await this.render();
        } catch (err) {
          console.error('[Save Achievements Error]', err);
          Toast.error(err.message || 'Error al guardar logros académicos.');
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  /**
   * Ventana emergente (Modal Nivel 2) cómoda para trazar o subir firma digital
   */
  openSignatureModal() {
    const modalContainer = document.getElementById('modal-container-profile');
    if (!modalContainer) return;

    this.modalSignatureMode = 'draw';
    this.modalUploadedImageBlob = null;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="modal-signature-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2200; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 640px; width: 100%; max-height: 90vh; display: flex; flex-direction: column;">
          
          <!-- CABECERA MODAL (NIVEL 2) -->
          <div style="padding: 1.2rem 1.65rem; border-bottom: 1px solid var(--soft-divider); display: flex; justify-content: space-between; align-items: center; background: var(--soft-lavender-surface); gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="soft-icon-box soft-icon-box-sm soft-icon-box-mint">
                ${Icons.signature(20, 'var(--soft-mint-deep)')}
              </div>
              <div>
                <h3 style="color: var(--soft-text-title); font-size: 1.15rem; font-weight: 800; margin: 0; letter-spacing: -0.015em;">
                  Firma Digital y Rúbrica Profesional
                </h3>
                <div style="font-size: 0.78rem; color: var(--soft-text-body); margin-top: 0.12rem;">
                  Especialista colegiado del Centro PSI Aprende
                </div>
              </div>
            </div>
            <button type="button" id="btn-close-sig-modal" class="soft-modal-close-btn" title="Cerrar">
              ${Icons.close(18)}
            </button>
          </div>

          <!-- PESTAÑAS DE MODALIDAD (TRAZAR VS SUBIR ARCHIVO) -->
          <div style="padding: 0.75rem 1.65rem 0 1.65rem; background: var(--soft-lavender-surface); border-bottom: 1px solid var(--soft-divider); display: flex; gap: 0.6rem;">
            <button type="button" id="tab-modal-sig-draw" class="soft-btn soft-btn-sm soft-btn-lvl-1" style="border-radius: 10px 10px 0 0;">
              ${Icons.signature(13, '#FFFFFF')}
              <span>Trazar en Pantalla</span>
            </button>
            <button type="button" id="tab-modal-sig-upload" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted" style="border-radius: 10px 10px 0 0;">
              ${Icons.upload(13, 'var(--soft-purple-primary)')}
              <span>Subir Archivo de Imagen</span>
            </button>
          </div>

          <!-- CUERPO MODAL -->
          <div style="padding: 1.4rem 1.65rem; overflow-y: auto; flex: 1;">
            
            <!-- PANEL 1: TRAZAR CON MOUSE O TOUCH -->
            <div id="pane-modal-sig-draw" style="display: block;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-size: 0.8rem; color: var(--soft-text-title); font-weight: 700;">
                  Recuadro de Trazo Digital
                </span>
                <button type="button" id="btn-modal-clear-sig" class="soft-btn soft-btn-sm soft-btn-lvl-2-soft" style="font-size: 0.74rem; padding: 0.28rem 0.65rem;">
                  ${Icons.trash(12)}
                  <span>Limpiar Trazo</span>
                </button>
              </div>

              <div style="background: #FFFFFF; border: 2px dashed var(--soft-purple-primary); border-radius: 14px; padding: 0.35rem; box-shadow: inset 0 2px 6px rgba(0,0,0,0.03);">
                <canvas id="modal-therapist-canvas" style="width: 100%; height: 180px; display: block; border-radius: 12px; background: #FFFFFF; touch-action: none; cursor: crosshair;"></canvas>
              </div>

              <div style="font-size: 0.74rem; color: var(--soft-text-muted); margin-top: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
                ${Icons.info(13, 'var(--soft-purple-primary)')}
                <span>Trace su firma con el ratón, lápiz óptico o pantalla táctil. Se guardará con nitidez y fondo transparente.</span>
              </div>
            </div>

            <!-- PANEL 2: SUBIR IMAGEN -->
            <div id="pane-modal-sig-upload" style="display: none;">
              <div id="modal-dropzone-sig" style="border: 2px dashed var(--soft-border-card-inner); border-radius: 14px; padding: 2rem 1.2rem; text-align: center; background: #FFFFFF; cursor: pointer; transition: all 0.2s ease;">
                <input type="file" id="input-modal-sig-file" accept="image/png,image/jpeg,image/webp" style="display: none;" />
                <div class="soft-icon-box soft-icon-box-sm soft-icon-box-lavender" style="margin: 0 auto 0.65rem auto;">
                  ${Icons.upload(20, 'var(--soft-purple-primary)')}
                </div>
                <div style="font-size: 0.88rem; font-weight: 700; color: var(--soft-text-title);" id="txt-modal-sig-upload-label">
                  Haga clic aquí para seleccionar imagen o escaneo de su firma
                </div>
                <div style="font-size: 0.74rem; color: var(--soft-text-muted); margin-top: 0.25rem;">
                  Formatos permitidos: PNG o JPG, tamaño máximo 5 MB
                </div>
              </div>

              <div id="modal-preview-sig-wrap" style="display: none; margin-top: 1rem; text-align: center;">
                <div style="font-size: 0.74rem; color: var(--soft-text-muted); margin-bottom: 0.35rem; font-weight: 600;">Vista previa de imagen cargada:</div>
                <img id="img-modal-sig-preview" src="" alt="Vista previa de firma" style="max-height: 95px; max-width: 100%; border: 1.5px solid var(--soft-border-card-inner); border-radius: 10px; padding: 8px; background: #FFFFFF; object-fit: contain;" />
              </div>
            </div>

          </div>

          <!-- PIE DE MODAL (NIVEL 2) -->
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--soft-divider); padding: 1.1rem 1.65rem; background: var(--soft-lavender-surface);">
            <button type="button" id="btn-cancel-signature-modal" class="soft-btn soft-btn-lvl-2-soft">
              Cancelar
            </button>
            <button type="button" id="btn-confirm-save-signature" class="soft-btn soft-btn-lvl-2">
              ${Icons.check(16, '#FFFFFF')}
              <span>Guardar Firma Digital</span>
            </button>
          </div>

        </div>
      </div>
    `;

    const closeModal = () => {
      if (this.modalSignatureCanvasInstance) {
        this.modalSignatureCanvasInstance.destroy();
        this.modalSignatureCanvasInstance = null;
      }
      modalContainer.innerHTML = '';
    };

    document.getElementById('btn-close-sig-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-signature-modal')?.addEventListener('click', closeModal);

    // Inicializar SignatureCanvas en el canvas del modal
    const canvasEl = document.getElementById('modal-therapist-canvas');
    if (canvasEl) {
      this.modalSignatureCanvasInstance = new SignatureCanvas(canvasEl, {
        strokeColor: '#24285B',
        lineWidth: 2.8
      });
      // Ajuste de dimensiones tras renderizado
      setTimeout(() => {
        if (this.modalSignatureCanvasInstance) {
          this.modalSignatureCanvasInstance.setupCanvasDimensions();
        }
      }, 80);
    }

    // Botón Limpiar Trazo
    document.getElementById('btn-modal-clear-sig')?.addEventListener('click', () => {
      if (this.modalSignatureCanvasInstance) {
        this.modalSignatureCanvasInstance.clear();
      }
    });

    // Alternar pestañas en el modal
    const tabDraw = document.getElementById('tab-modal-sig-draw');
    const tabUpload = document.getElementById('tab-modal-sig-upload');
    const paneDraw = document.getElementById('pane-modal-sig-draw');
    const paneUpload = document.getElementById('pane-modal-sig-upload');

    tabDraw?.addEventListener('click', () => {
      this.modalSignatureMode = 'draw';
      tabDraw.className = 'soft-btn soft-btn-sm soft-btn-lvl-1';
      tabUpload.className = 'soft-btn soft-btn-sm soft-btn-lvl-1-muted';
      if (paneDraw) paneDraw.style.display = 'block';
      if (paneUpload) paneUpload.style.display = 'none';
      setTimeout(() => {
        if (this.modalSignatureCanvasInstance) {
          this.modalSignatureCanvasInstance.setupCanvasDimensions();
        }
      }, 50);
    });

    tabUpload?.addEventListener('click', () => {
      this.modalSignatureMode = 'upload';
      tabUpload.className = 'soft-btn soft-btn-sm soft-btn-lvl-1';
      tabDraw.className = 'soft-btn soft-btn-sm soft-btn-lvl-1-muted';
      if (paneDraw) paneDraw.style.display = 'none';
      if (paneUpload) paneUpload.style.display = 'block';
    });

    // Subida de imagen
    const dropzone = document.getElementById('modal-dropzone-sig');
    const inputFile = document.getElementById('input-modal-sig-file');
    const previewWrap = document.getElementById('modal-preview-sig-wrap');
    const imgPreview = document.getElementById('img-modal-sig-preview');
    const txtLabel = document.getElementById('txt-modal-sig-upload-label');

    if (dropzone && inputFile) {
      dropzone.addEventListener('click', () => inputFile.click());
      inputFile.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
          Toast.error('El archivo de imagen no debe superar 5 MB.');
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          this.modalUploadedImageBlob = event.target.result;
          if (imgPreview && previewWrap) {
            imgPreview.src = this.modalUploadedImageBlob;
            previewWrap.style.display = 'block';
          }
          if (txtLabel) {
            txtLabel.textContent = `Archivo seleccionado: ${file.name}`;
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // Confirmar y Guardar Firma
    const btnSave = document.getElementById('btn-confirm-save-signature');
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        let finalDataUrl = null;
        if (this.modalSignatureMode === 'draw') {
          if (!this.modalSignatureCanvasInstance || this.modalSignatureCanvasInstance.isEmpty()) {
            Toast.error('Por favor trace su firma en el recuadro blanco antes de guardar.');
            return;
          }
          finalDataUrl = this.modalSignatureCanvasInstance.toDataURL('image/png');
        } else {
          if (!this.modalUploadedImageBlob) {
            Toast.error('Por favor seleccione una imagen de su firma.');
            return;
          }
          finalDataUrl = this.modalUploadedImageBlob;
        }

        btnSave.disabled = true;
        btnSave.innerHTML = `<span>Guardando en perfil...</span>`;

        try {
          const res = await apiClient.put('/auth/profile', {
            firma_digital_blob: finalDataUrl
          });

          if (res.success && res.data) {
            store.setUser(res.data);
            Toast.success('Firma digital colegiada guardada con éxito.');
            closeModal();
            await this.render();
          }
        } catch (err) {
          Toast.error(err.message || 'Error al guardar la firma digital.');
          btnSave.disabled = false;
          btnSave.innerHTML = `${Icons.check(16, '#FFFFFF')} <span>Guardar Firma Digital</span>`;
        }
      });
    }
  }

  /**
   * Modal Nivel 2 para confirmar eliminación de rúbrica
   */
  openDeleteSignatureModal() {
    const modalContainer = document.getElementById('modal-container-profile');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="modal-del-sig-backdrop" style="position: fixed; inset: 0; background: rgba(39, 52, 95, 0.65); backdrop-filter: blur(4px); z-index: 2200; display: flex; align-items: center; justify-content: center; padding: 1rem;">
        <div class="soft-modal-card" style="max-width: 440px; width: 100%;">
          <div style="padding: 1.5rem 1.65rem; text-align: center;">
            <div class="soft-icon-box soft-icon-box-md" style="margin: 0 auto 0.95rem auto; background: rgba(225, 29, 72, 0.1); color: #E11D48;">
              ${Icons.trash(24)}
            </div>
            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.15rem; font-weight: 800; color: var(--soft-text-title);">
              ¿Eliminar Firma Digital Colegiada?
            </h3>
            <p style="font-size: 0.85rem; color: var(--soft-text-body); margin: 0 0 1.4rem 0; line-height: 1.45;">
              Si elimina su rúbrica registrada, no podrá estampar informes clínicos directamente hasta que vuelva a guardar una nueva firma.
            </p>
            <div style="display: flex; gap: 0.75rem; justify-content: center;">
              <button type="button" id="btn-cancel-del-sig" class="soft-btn soft-btn-lvl-2-soft" style="flex: 1;">
                Cancelar
              </button>
              <button type="button" id="btn-confirm-del-sig" class="soft-btn soft-btn-lvl-2" style="flex: 1; background: #E11D48; color: #FFFFFF;">
                ${Icons.trash(14, '#FFFFFF')}
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeDel = () => { modalContainer.innerHTML = ''; };
    document.getElementById('btn-cancel-del-sig')?.addEventListener('click', closeDel);
    document.getElementById('btn-confirm-del-sig')?.addEventListener('click', async () => {
      closeDel();
      try {
        const res = await apiClient.put('/auth/profile', { firma_digital_blob: null });
        if (res.success && res.data) {
          store.setUser(res.data);
          Toast.success('Firma digital eliminada del perfil.');
          await this.render();
        }
      } catch (err) {
        Toast.error(err.message || 'Error al eliminar firma digital.');
      }
    });
  }
}
