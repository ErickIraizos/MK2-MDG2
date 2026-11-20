import { apiClient } from '../../api/apiClient.js';
import { store } from '../../store.js';
import { Toast } from '../../components/Toast.js';
import { Icons } from '../../components/Icons.js';

export class LoginView {
  constructor(container) {
    this.container = container;
    this.activeTab = 'login'; // 'login' | 'register'
  }

  async render() {
    this.container.innerHTML = `
      <div class="page-container panel-general" style="min-height: calc(100vh - 175px); display: flex; align-items: center; justify-content: center; padding: 1.75rem 1rem;">
        <div class="soft-card-static" style="position: relative; max-width: 475px; width: 100%; padding: 2.35rem 2.25rem; border-radius: 28px; background: linear-gradient(165deg, #FFFFFF 0%, #FFFFFF 68%, #F8F5FE 100%);">
          
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <img src="/assets/logo-brand.png" alt="PSI Aprende Logo Oficial" style="max-width: 205px; height: auto; margin: 0 auto 0.9rem auto; display: block;" />
            <div style="margin-bottom: 0.55rem;">
              <span class="soft-badge soft-badge-lavender">
                ${Icons.shield(13, 'var(--soft-purple-primary)')}
                <span>Acceso Institucional Seguro</span>
              </span>
            </div>
            <h2 id="auth-title" style="font-size: 1.48rem; font-weight: 800; color: var(--soft-text-title); letter-spacing: -0.02em; margin: 0 0 0.3rem 0;">
              Portal de Acceso Clínico
            </h2>
            <p id="auth-subtitle" style="font-size: 0.88rem; color: var(--soft-text-body); margin: 0; line-height: 1.45;">
              Ingrese sus credenciales registradas para acceder al sistema
            </p>
          </div>

          <!-- PESTAÑAS DE NAVEGACIÓN (INICIAR SESIÓN / REGISTRO — Nivel 1 Monocromático Morado) -->
          <div class="soft-segmented-bar" style="display: flex; width: 100%; margin-bottom: 1.55rem; box-sizing: border-box;">
            <button
              id="tab-btn-login"
              type="button"
              class="soft-btn soft-btn-sm soft-btn-lvl-1"
              style="flex: 1;"
            >
              Iniciar Sesión
            </button>
            <button
              id="tab-btn-register"
              type="button"
              class="soft-btn soft-btn-sm soft-btn-lvl-1-muted"
              style="flex: 1;"
            >
              Registrarse
            </button>
          </div>

          <!-- FORMULARIO 1: INICIO DE SESIÓN -->
          <form id="login-form" novalidate>
            <div style="margin-bottom: 1.15rem;">
              <label class="soft-label" for="login-email">
                Correo Electrónico <span class="required">*</span>
              </label>
              <input
                type="email"
                id="login-email"
                class="soft-input"
                placeholder="usuario@psi-aprende.com"
                autocomplete="email"
                required
              />
              <div id="email-feedback" class="form-feedback"></div>
            </div>

            <div style="margin-bottom: 1.25rem;">
              <label class="soft-label" for="login-password">
                Contraseña <span class="required">*</span>
              </label>
              <div style="position: relative;">
                <input
                  type="password"
                  id="login-password"
                  class="soft-input"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  style="padding-right: 2.85rem;"
                  required
                />
                <button
                  type="button"
                  id="btn-toggle-password"
                  class="soft-modal-close-btn"
                  style="position: absolute; right: 0.48rem; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; border-radius: 10px;"
                  title="Mostrar u ocultar contraseña"
                >
                  <span id="eye-icon" style="display: inline-flex;">${Icons.eye(16)}</span>
                </button>
              </div>
              <div id="password-feedback" class="form-feedback"></div>
            </div>

            <button
              type="submit"
              id="btn-submit-login"
              class="soft-btn soft-btn-lvl-1"
              style="width: 100%; margin-top: 0.35rem; padding: 0.8rem 1.2rem; font-size: 0.9rem;"
            >
              <span id="btn-text">Iniciar Sesión</span>
              <span id="btn-spinner" style="display: none;">Verificando credenciales...</span>
            </button>
          </form>

          <!-- FORMULARIO 2: REGISTRO DE PADRES / TUTORES O PACIENTE ADULTO -->
          <form id="register-form" style="display: none;" novalidate>
            
            <!-- SELECTOR VISUAL DE TIPO DE USUARIO -->
            <div style="margin-bottom: 1.15rem;">
              <label class="soft-label" style="font-weight: 700; color: var(--soft-text-title); margin-bottom: 0.45rem; display: block;">
                ¿Para quién es la atención o acompañamiento clínico? <span class="required">*</span>
              </label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
                <button
                  type="button"
                  id="btn-reg-type-tutor"
                  class="soft-btn soft-btn-sm soft-btn-lvl-1"
                  style="padding: 0.65rem 0.5rem; justify-content: center; font-size: 0.78rem; text-align: center; border-radius: 12px; display: flex; flex-direction: column; gap: 0.15rem;"
                >
                  <span style="font-weight: 800;">Para mi Hijo/a o Menor</span>
                  <span style="font-size: 0.68rem; opacity: 0.9;">Padre, Madre o Tutor Legal</span>
                </button>
                <button
                  type="button"
                  id="btn-reg-type-adult"
                  class="soft-btn soft-btn-sm soft-btn-lvl-1-muted"
                  style="padding: 0.65rem 0.5rem; justify-content: center; font-size: 0.78rem; text-align: center; border-radius: 12px; display: flex; flex-direction: column; gap: 0.15rem;"
                >
                  <span style="font-weight: 800;">Para Mí Mismo/a</span>
                  <span style="font-size: 0.68rem; opacity: 0.9;">Paciente Adulto (Mayor de 18)</span>
                </button>
              </div>
            </div>

            <div class="auth-grid-2" style="margin-bottom: 1rem;">
              <div>
                <label class="soft-label" for="reg-nombres" id="lbl-reg-nombres">
                  Nombres del Titular <span class="required">*</span>
                </label>
                <input
                  type="text"
                  id="reg-nombres"
                  class="soft-input"
                  placeholder="Ej. Ana María"
                  required
                />
              </div>

              <div>
                <label class="soft-label" for="reg-apellidos" id="lbl-reg-apellidos">
                  Apellidos del Titular <span class="required">*</span>
                </label>
                <input
                  type="text"
                  id="reg-apellidos"
                  class="soft-input"
                  placeholder="Ej. Rojas Méndez"
                  required
                />
              </div>
            </div>

            <div class="auth-grid-2" style="margin-bottom: 1rem;">
              <div>
                <label class="soft-label" for="reg-ci">
                  Cédula de Identidad (C.I.) <span class="required">*</span>
                </label>
                <input
                  type="text"
                  id="reg-ci"
                  class="soft-input"
                  placeholder="Ej. 6543210 CB"
                  required
                />
              </div>

              <!-- CAMPO CONDICIONAL: PARENTESCO PARA TUTOR -->
              <div id="field-wrap-parentesco">
                <label class="soft-label" for="reg-parentesco">
                  Parentesco <span class="required">*</span>
                </label>
                <select id="reg-parentesco" class="soft-select">
                  <option value="MADRE" selected>Madre</option>
                  <option value="PADRE">Padre</option>
                  <option value="TUTOR_LEGAL">Tutor / Apoderado Legal</option>
                  <option value="ABUELO_A">Abuelo / Abuela</option>
                </select>
              </div>

              <!-- CAMPO CONDICIONAL: FECHA DE NACIMIENTO PARA PACIENTE ADULTO -->
              <div id="field-wrap-adult-dob" style="display: none;">
                <label class="soft-label" for="reg-adult-dob">
                  Fecha de Nacimiento <span class="required">*</span>
                </label>
                <input
                  type="date"
                  id="reg-adult-dob"
                  class="soft-input"
                />
              </div>
            </div>

            <!-- SECCIÓN CONDICIONAL: DATOS DEL MENOR SI ES TUTOR -->
            <div id="section-child-data" style="background: var(--soft-lavender-surface); border: 1px solid var(--soft-border-card-inner); border-radius: 14px; padding: 0.95rem 1rem; margin-bottom: 1rem;">
              <strong style="color: var(--soft-text-title); font-size: 0.82rem; display: block; margin-bottom: 0.45rem;">
                Datos de su hijo/a o persona a evaluar (Opcional):
              </strong>
              <div class="auth-grid-2" style="gap: 0.65rem;">
                <div>
                  <label class="soft-label" for="reg-child-name" style="font-size: 0.75rem;">Nombre Completo del Menor</label>
                  <input type="text" id="reg-child-name" class="soft-input" placeholder="Ej. Mateo Rojas Méndez" style="font-size: 0.82rem; padding: 0.5rem 0.75rem;" />
                </div>
                <div>
                  <label class="soft-label" for="reg-child-dob" style="font-size: 0.75rem;">Fecha de Nacimiento</label>
                  <input type="date" id="reg-child-dob" class="soft-input" style="font-size: 0.82rem; padding: 0.5rem 0.75rem;" />
                </div>
              </div>
            </div>

            <div style="margin-bottom: 1rem;">
              <label class="soft-label" for="reg-email">
                Correo Electrónico <span class="required">*</span>
              </label>
              <input
                type="email"
                id="reg-email"
                class="soft-input"
                placeholder="correo@ejemplo.com"
                required
              />
            </div>

            <div style="margin-bottom: 1rem;">
              <label class="soft-label" for="reg-telefono">
                Teléfono Celular / WhatsApp <span class="required">*</span>
              </label>
              <input
                type="tel"
                id="reg-telefono"
                class="soft-input"
                placeholder="+591 7XXXXXXX"
                required
              />
            </div>

            <div style="margin-bottom: 1.15rem;">
              <label class="soft-label" for="reg-password">
                Contraseña (mínimo 8 caracteres) <span class="required">*</span>
              </label>
              <input
                type="password"
                id="reg-password"
                class="soft-input"
                placeholder="Mínimo 8 caracteres"
                required
              />
            </div>

            <div style="background: #F1FBF9; padding: 0.85rem 1rem; border-radius: 14px; border: 1px solid rgba(21, 150, 141, 0.18); font-size: 0.77rem; color: var(--soft-text-body); margin-bottom: 1.2rem; line-height: 1.45; display: flex; align-items: flex-start; gap: 0.6rem;">
              <span style="color: var(--soft-mint-deep); flex-shrink: 0; margin-top: 0.1rem;">${Icons.shield(16, 'var(--soft-mint-deep)')}</span>
              <div><strong style="color: var(--soft-text-title);">Protección Legal Bioética:</strong> Datos protegidos bajo la Ley N° 548 / Ley N° 3131 del Estado Plurinacional de Bolivia y resguardo inalterable en el expediente del Centro "PSI Aprende".</div>
            </div>

            <button
              type="submit"
              id="btn-submit-register"
              class="soft-btn soft-btn-lvl-1"
              style="width: 100%; padding: 0.8rem 1.2rem; font-size: 0.9rem;"
            >
              <span id="btn-reg-text">Crear Cuenta y Continuar</span>
              <span id="btn-reg-spinner" style="display: none;">Registrando en el sistema...</span>
            </button>
          </form>

          <!-- ACCESOS DEMO CLÍNICOS ELEGANTES (SOLO VISIBLE EN PESTAÑA LOGIN) -->
          <div id="demo-credentials-block" style="margin-top: 1.75rem; padding-top: 1.3rem; border-top: 1px solid var(--soft-divider); text-align: center;">
            <div style="font-size: 0.71rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--soft-text-overline); margin-bottom: 0.8rem; font-weight: 700;">
              Credenciales de Demostración
            </div>
            <div class="auth-grid-2" style="gap: 0.55rem;">
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-demo" data-email="admin@psi-aprende.com" style="justify-content: flex-start; padding: 0.45rem 0.6rem;">
                <span class="soft-badge soft-badge-lavender" style="font-size: 0.62rem; padding: 0.14rem 0.45rem;">ADMIN</span>
                <span style="font-size: 0.78rem;">Dirección</span>
              </button>
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-demo" data-email="terapeuta@psi-aprende.com" style="justify-content: flex-start; padding: 0.45rem 0.6rem;">
                <span class="soft-badge soft-badge-mint" style="font-size: 0.62rem; padding: 0.14rem 0.45rem;">CLÍNICO</span>
                <span style="font-size: 0.78rem;">Terapeuta</span>
              </button>
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-demo" data-email="recepcion@psi-aprende.com" style="justify-content: flex-start; padding: 0.45rem 0.6rem;">
                <span class="soft-badge soft-badge-indigo" style="font-size: 0.62rem; padding: 0.14rem 0.45rem;">CAJA</span>
                <span style="font-size: 0.78rem;">Recepción</span>
              </button>
              <button type="button" class="soft-btn soft-btn-sm soft-btn-lvl-1-muted btn-demo" data-email="tutor@psi-aprende.com" style="justify-content: flex-start; padding: 0.45rem 0.6rem;">
                <span class="soft-badge soft-badge-emerald" style="font-size: 0.62rem; padding: 0.14rem 0.45rem;">FAMILIA</span>
                <span style="font-size: 0.78rem;">Tutor Legal</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    const tabLogin = document.getElementById('tab-btn-login');
    const tabRegister = document.getElementById('tab-btn-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const demoBlock = document.getElementById('demo-credentials-block');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');

    // Cambiar entre Pestañas Login / Registro manteniendo jerarquía morada Nivel 1
    const setTab = (tab) => {
      this.activeTab = tab;
      const isLogin = tab === 'login';

      tabLogin.classList.toggle('soft-btn-lvl-1', isLogin);
      tabLogin.classList.toggle('soft-btn-lvl-1-muted', !isLogin);

      tabRegister.classList.toggle('soft-btn-lvl-1', !isLogin);
      tabRegister.classList.toggle('soft-btn-lvl-1-muted', isLogin);

      loginForm.style.display = isLogin ? 'block' : 'none';
      registerForm.style.display = isLogin ? 'none' : 'block';
      demoBlock.style.display = isLogin ? 'block' : 'none';

      authTitle.textContent = isLogin ? 'Portal de Acceso Clínico' : 'Registro de Nueva Cuenta';
      authSubtitle.textContent = isLogin
        ? 'Ingrese sus credenciales registradas para acceder al sistema'
        : 'Complete sus datos para crear su cuenta en el centro';
    };

    tabLogin.addEventListener('click', () => setTab('login'));
    tabRegister.addEventListener('click', () => setTab('register'));

    // Si la ruta inicial es #/register, activar pestaña de registro automáticamente
    if (window.location.hash.startsWith('#/register')) {
      setTab('register');
    }

    // Toggle Contraseña
    const passwordInput = document.getElementById('login-password');
    const togglePassBtn = document.getElementById('btn-toggle-password');
    const eyeIcon = document.getElementById('eye-icon');
    if (togglePassBtn) {
      togglePassBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        eyeIcon.innerHTML = isPassword ? Icons.eyeOff(16) : Icons.eye(16);
      });
    }

    // Validación Login
    const emailInput = document.getElementById('login-email');
    const emailFeedback = document.getElementById('email-feedback');
    const passwordFeedback = document.getElementById('password-feedback');
    const submitLoginBtn = document.getElementById('btn-submit-login');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const validateLoginEmail = () => {
      const val = emailInput.value.trim();
      if (!val || !emailRegex.test(val)) {
        emailInput.classList.add('is-invalid');
        emailFeedback.textContent = 'Ingrese un formato de correo válido.';
        emailFeedback.className = 'form-feedback error';
        return false;
      }
      emailInput.classList.remove('is-invalid');
      emailFeedback.textContent = '';
      return true;
    };

    const validateLoginPassword = () => {
      const val = passwordInput.value;
      if (!val || val.length < 6) {
        passwordInput.classList.add('is-invalid');
        passwordFeedback.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        passwordFeedback.className = 'form-feedback error';
        return false;
      }
      passwordInput.classList.remove('is-invalid');
      passwordFeedback.textContent = '';
      return true;
    };

    emailInput.addEventListener('input', validateLoginEmail);
    passwordInput.addEventListener('input', validateLoginPassword);

    // Botones de presets demo
    document.querySelectorAll('.btn-demo').forEach(btn => {
      btn.addEventListener('click', () => {
        emailInput.value = btn.dataset.email;
        passwordInput.value = 'Password123!';
        validateLoginEmail();
        validateLoginPassword();
      });
    });

    // Envío Login
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateLoginEmail() || !validateLoginPassword()) {
        Toast.error('Por favor complete los campos requeridos correctamente.');
        return;
      }

      submitLoginBtn.disabled = true;
      btnText.style.display = 'none';
      btnSpinner.style.display = 'inline';

      try {
        const response = await apiClient.post('/auth/login', {
          email: emailInput.value.trim(),
          password: passwordInput.value
        });

        if (response.success && response.data) {
          const { token, user } = response.data;
          store.setSession(token, user);
          Toast.success(`Bienvenido/a, ${user.nombre_completo}`);
          if (window.router) {
            window.router.navigate('/dashboard');
          } else if (window.location.hash === '#/dashboard') {
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          } else {
            window.location.hash = '#/dashboard';
          }
        }
      } catch (err) {
        Toast.error(err.message || 'Error al iniciar sesión.');
      } finally {
        submitLoginBtn.disabled = false;
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
      }
    });

    // Envío Registro
    let currentRegType = 'TUTOR_MENOR'; // 'TUTOR_MENOR' | 'PACIENTE_ADULTO'
    const btnTypeTutor = document.getElementById('btn-reg-type-tutor');
    const btnTypeAdult = document.getElementById('btn-reg-type-adult');
    const fieldWrapParentesco = document.getElementById('field-wrap-parentesco');
    const fieldWrapAdultDob = document.getElementById('field-wrap-adult-dob');
    const sectionChildData = document.getElementById('section-child-data');
    const lblNombres = document.getElementById('lbl-reg-nombres');
    const lblApellidos = document.getElementById('lbl-reg-apellidos');

    btnTypeTutor?.addEventListener('click', () => {
      currentRegType = 'TUTOR_MENOR';
      btnTypeTutor.className = 'soft-btn soft-btn-sm soft-btn-lvl-1';
      btnTypeAdult.className = 'soft-btn soft-btn-sm soft-btn-lvl-1-muted';
      if (fieldWrapParentesco) fieldWrapParentesco.style.display = 'block';
      if (fieldWrapAdultDob) fieldWrapAdultDob.style.display = 'none';
      if (sectionChildData) sectionChildData.style.display = 'block';
      if (lblNombres) lblNombres.innerHTML = 'Nombres del Tutor/a <span class="required">*</span>';
      if (lblApellidos) lblApellidos.innerHTML = 'Apellidos del Tutor/a <span class="required">*</span>';
    });

    btnTypeAdult?.addEventListener('click', () => {
      currentRegType = 'PACIENTE_ADULTO';
      btnTypeAdult.className = 'soft-btn soft-btn-sm soft-btn-lvl-1';
      btnTypeTutor.className = 'soft-btn soft-btn-sm soft-btn-lvl-1-muted';
      if (fieldWrapParentesco) fieldWrapParentesco.style.display = 'none';
      if (fieldWrapAdultDob) fieldWrapAdultDob.style.display = 'block';
      if (sectionChildData) sectionChildData.style.display = 'none';
      if (lblNombres) lblNombres.innerHTML = 'Mis Nombres <span class="required">*</span>';
      if (lblApellidos) lblApellidos.innerHTML = 'Mis Apellidos <span class="required">*</span>';
    });

    const regNombres = document.getElementById('reg-nombres');
    const regApellidos = document.getElementById('reg-apellidos');
    const regCi = document.getElementById('reg-ci');
    const regParentesco = document.getElementById('reg-parentesco');
    const regAdultDob = document.getElementById('reg-adult-dob');
    const regChildName = document.getElementById('reg-child-name');
    const regChildDob = document.getElementById('reg-child-dob');
    const regEmail = document.getElementById('reg-email');
    const regTelefono = document.getElementById('reg-telefono');
    const regPassword = document.getElementById('reg-password');
    const submitRegBtn = document.getElementById('btn-submit-register');
    const btnRegText = document.getElementById('btn-reg-text');
    const btnRegSpinner = document.getElementById('btn-reg-spinner');

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombres = regNombres ? regNombres.value.trim() : '';
      const apellidos = regApellidos ? regApellidos.value.trim() : '';
      const ci = regCi ? regCi.value.trim() : '';
      const email = regEmail.value.trim();
      const pass = regPassword.value;
      const tel = regTelefono.value.trim();
      const adultDob = regAdultDob ? regAdultDob.value : '';

      if (!nombres || nombres.length < 2) {
        Toast.error('Por favor ingrese sus nombres.');
        return;
      }
      if (!apellidos || apellidos.length < 2) {
        Toast.error('Por favor ingrese sus apellidos.');
        return;
      }
      if (!ci || ci.length < 4) {
        Toast.error('Por favor ingrese su Cédula de Identidad (C.I.) con extensión.');
        return;
      }
      if (currentRegType === 'PACIENTE_ADULTO') {
        if (!adultDob) {
          Toast.error('Debe ingresar su fecha de nacimiento.');
          return;
        }
        const birth = new Date(adultDob);
        const ageYears = (new Date().getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (ageYears < 18) {
          Toast.error('Para menores de 18 años, el registro debe ser realizado por el padre, madre o tutor legal.');
          return;
        }
      }
      if (!email || !emailRegex.test(email)) {
        Toast.error('Ingrese un correo electrónico válido.');
        return;
      }
      if (!pass || pass.length < 8) {
        Toast.error('La contraseña debe tener un mínimo de 8 caracteres.');
        return;
      }

      submitRegBtn.disabled = true;
      btnRegText.style.display = 'none';
      btnRegSpinner.style.display = 'inline';

      try {
        const nombre_completo = `${nombres} ${apellidos}`.trim();
        const res = await apiClient.post('/auth/register', {
          tipo_registro: currentRegType,
          nombre_completo,
          ci,
          email,
          password: pass,
          telefono: tel,
          parentesco: regParentesco ? regParentesco.value : 'TUTOR_LEGAL',
          fecha_nacimiento: adultDob || null,
          menor_nombre: regChildName ? regChildName.value.trim() : null,
          menor_fecha_nacimiento: regChildDob ? regChildDob.value : null
        });

        if (res.success && res.data) {
          const { token, user } = res.data;
          store.setSession(token, user);
          Toast.success(`Cuenta creada exitosamente. Bienvenido/a ${user.nombre_completo}`);
          if (window.router) {
            window.router.navigate('/dashboard');
          } else if (window.location.hash === '#/dashboard') {
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          } else {
            window.location.hash = '#/dashboard';
          }
        }
      } catch (err) {
        Toast.error(err.message || 'Error al registrar usuario.');
      } finally {
        submitRegBtn.disabled = false;
        btnRegText.style.display = 'inline';
        btnRegSpinner.style.display = 'none';
      }
    });
  }
}
