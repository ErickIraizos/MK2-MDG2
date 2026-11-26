import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { RepositoryFactory } from '../core/RepositoryFactory.js';
import { AppError } from '../core/AppError.js';
import { notificationService } from './notificationService.js';
import { webPushService } from './webPushService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, '../../.wwebjs_auth');

// Asegurar directorio auth
if (!fs.existsSync(AUTH_DIR)) {
  try {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  } catch (err) {
    console.warn('[WhatsAppManager] Aviso al crear directorio auth:', err.message);
  }
}

class WhatsAppManager {
  constructor() {
    this.sessions = new Map(); // identifier -> { client, qr, qrDataUrl, status, phone, error, lastMessageAt }
    this.pendingDisambiguations = new Map(); // phone -> { appointments, action, expiresAt }
  }

  _repo() {
    return RepositoryFactory.getWhatsappRepository();
  }

  /**
   * Construye la configuración unificada de Client (Puppeteer + webVersionCache remoto)
   * compartida entre initializeSession y autoResumeSession.
   */
  _buildClientConfig(LocalAuth, id) {
    return {
      authStrategy: new LocalAuth({
        clientId: `session_${id}`,
        dataPath: AUTH_DIR
      }),
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
        strict: false
      },
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      }
    };
  }

  cleanSessionLocks(id) {
    try {
      const sessionDir = path.resolve(AUTH_DIR, `session-session_${id}`);
      if (!fs.existsSync(sessionDir)) return;

      if (process.platform === 'win32') {
        try {
          execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*session-session_${id}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`, { stdio: 'ignore', timeout: 3500 });
        } catch (e) {}
      }

      const lockFiles = [
        path.join(sessionDir, 'lockfile'),
        path.join(sessionDir, 'SingletonLock'),
        path.join(sessionDir, 'SingletonCookie'),
        path.join(sessionDir, 'SingletonSocket'),
        path.join(sessionDir, 'Default', 'SingletonLock'),
        path.join(sessionDir, 'Default', 'SingletonCookie'),
        path.join(sessionDir, 'Default', 'SingletonSocket')
      ];

      for (const f of lockFiles) {
        try {
          // Usar lstatSync para detectar symlinks rotos de Chromium (SingletonLock en Linux/EC2)
          fs.lstatSync(f);
          fs.unlinkSync(f);
        } catch (e) {}
      }
    } catch (err) {
      console.warn(`[WhatsAppManager] Aviso al limpiar locks de sesión ${id}:`, err.message);
    }
  }

  // Sincronizar dinámicamente: asegurar que todo terapeuta y administrador tenga registro en whatsapp_sesiones
  async ensureDynamicSessions() {
    await this._repo().ensureDynamicSessions();
  }

  // 1. Obtener todas las sesiones dinámicamente (sin límite de 5)
  async getAllSessions() {
    await this.ensureDynamicSessions();
    const rows = await this._repo().getAllSessionsWithTherapists();

    return rows.map(row => {
      const live = this.sessions.get(row.terapeuta_id);
      let liveStatus = 'DESCONECTADO';
      if (live) {
        liveStatus = live.status; // 'CONECTADO', 'RECONECTANDO', 'ESPERANDO_QR', 'INICIALIZANDO'
      } else {
        const sessionDir = path.resolve(AUTH_DIR, `session-session_${row.terapeuta_id}`);
        if (fs.existsSync(sessionDir) && row.estado === 'CONECTADO') {
          liveStatus = 'RECONECTANDO';
          this.autoResumeSession(row.terapeuta_id).catch(() => {});
        }
      }

      return {
        ...row,
        estado_en_vivo: liveStatus,
        tiene_qr_pendiente: Boolean(live && live.qrDataUrl),
        qr_data_url: live ? live.qrDataUrl : null,
        error_en_vivo: live ? live.error : null
      };
    });
  }

  // 2. Obtener estado y QR de una sesión específica (por terapeuta_id o usuario_id)
  async getSession(therapistId) {
    await this.ensureDynamicSessions();
    const id = parseInt(therapistId, 10);
    const repo = this._repo();

    let row = await repo.getSessionRowByTherapistOrUserId(id);

    // Si es un admin puro sin perfil de terapeuta
    if (!row) {
      const user = await repo.getUserFallbackById(id);
      if (user) {
        const parts = (user.nombre_completo || 'Usuario').split(' ');
        row = {
          id: 99000 + user.id,
          terapeuta_id: user.id,
          usuario_id: user.id,
          estado: 'DESCONECTADO',
          telefono_vinculado: user.telefono,
          nombres: parts[0] || 'Admin',
          apellidos: parts.slice(1).join(' ') || 'General',
          registro_profesional: 'DIRECCIÓN',
          terapeuta_telefono_oficial: user.telefono
        };
      } else {
        throw new AppError(`No se encontró registro para el identificador ${id}`, 404);
      }
    }

    const live = this.sessions.get(row.terapeuta_id || id);
    let liveStatus = 'DESCONECTADO';
    if (live) {
      liveStatus = live.status;
    } else {
      const sessionDir = path.resolve(AUTH_DIR, `session-session_${row.terapeuta_id || id}`);
      if (fs.existsSync(sessionDir) && row.estado === 'CONECTADO') {
        liveStatus = 'RECONECTANDO';
        this.autoResumeSession(row.terapeuta_id || id).catch(() => {});
      }
    }

    return {
      ...row,
      estado_en_vivo: liveStatus,
      qr_data_url: live ? live.qrDataUrl : null,
      error_en_vivo: live ? live.error : null
    };
  }

  // 3. Inicializar o solicitar vinculación QR individual
  async initializeSession(therapistId) {
    await this.ensureDynamicSessions();
    const id = parseInt(therapistId, 10);
    const repo = this._repo();

    const existing = this.sessions.get(id);
    if (existing && existing.status === 'CONECTADO') {
      return {
        success: true,
        status: 'CONECTADO',
        message: 'La sesión ya se encuentra activa y conectada.',
        qrDataUrl: null
      };
    }

    // Si ya existe un código QR REAL emitido por WhatsApp esperando escaneo
    if (existing && existing.status === 'ESPERANDO_QR' && existing.qrDataUrl && existing.qr && !existing.qr.startsWith('PSI-APRENDE')) {
      return {
        success: true,
        status: 'ESPERANDO_QR',
        message: 'Código QR oficial listo para vinculación.',
        qrDataUrl: existing.qrDataUrl
      };
    }

    const QR_INIT_TIMEOUT_MS = 45000; // 45s timeout

    // Si ya hay un proceso inicializando activamente (< 15s y sin timeout/error previo), aguardar su promesa
    if (
      existing &&
      existing.status === 'INICIALIZANDO' &&
      existing.qrPromise &&
      !existing.qrTimedOut &&
      !existing.error &&
      existing.client &&
      (Date.now() - (existing.startedAt || 0) < 15000)
    ) {
      const waitQr = await existing.qrPromise;
      if (waitQr && existing.qrDataUrl) {
        return {
          success: true,
          status: 'ESPERANDO_QR',
          message: 'Código QR oficial listo para vinculación.',
          qrDataUrl: existing.qrDataUrl
        };
      }
    }

    // Si había una sesión anterior colgada, expirada, con error o sin conectar, cerrarla limpiamente
    if (existing) {
      console.log(`[WhatsAppManager] Reiniciando cliente previo para Usuario ID ${id} (estado=${existing.status}, timeout=${Boolean(existing.qrTimedOut)}, error=${existing.error || 'ninguno'})`);
      if (existing.qrTimer) {
        clearTimeout(existing.qrTimer);
        existing.qrTimer = null;
      }
      if (existing.client) {
        try {
          await existing.client.destroy();
        } catch (e) {}
        existing.client = null;
      }
    }

    // Liberar locks/procesos antes de purgar la carpeta para evitar EBUSY / SingletonLock residual
    this.cleanSessionLocks(id);

    // Purgar cualquier caché de perfil no autenticado previo para evitar que Puppeteer
    // intente restaurar sesiones rotas que provocan "Cannot read properties of null (reading 'Socket')"
    const sessionDir = path.resolve(AUTH_DIR, `session-session_${id}`);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        console.log(`[WhatsAppManager] Directorio temporal de sesión no autenticada limpiado: session-session_${id}`);
      } catch (rmErr) {
        console.warn(`[WhatsAppManager] Aviso al limpiar carpeta de sesión ${id}:`, rmErr.message);
      }
    }

    // Actualizar estado en DB
    await repo.setSessionStatus(id, 'INICIALIZANDO');

    let resolveQr = null;
    let qrSettled = false;
    let qrTimer = null;
    const settleQr = (value) => {
      if (qrSettled) return;
      qrSettled = true;
      if (qrTimer) {
        clearTimeout(qrTimer);
        qrTimer = null;
      }
      if (resolveQr) resolveQr(value);
    };

    const qrPromise = new Promise((resolve) => {
      resolveQr = resolve;
    });

    const sessionState = {
      client: null,
      qr: null,
      qrDataUrl: null,
      status: 'INICIALIZANDO',
      phone: null,
      error: null,
      qrTimedOut: false,
      startedAt: Date.now(),
      lastMessageAt: null,
      qrPromise,
      qrTimer: null
    };
    this.sessions.set(id, sessionState);

    qrTimer = setTimeout(async () => {
      if (this.sessions.get(id) !== sessionState || qrSettled) return;
      if (sessionState.status === 'INICIALIZANDO' && !sessionState.qrDataUrl) {
        console.warn(`[WhatsAppManager] Timeout de ${QR_INIT_TIMEOUT_MS / 1000}s esperando QR para Usuario ID ${id}. Marcando como DESCONECTADO.`);
        sessionState.qrTimedOut = true;
        sessionState.status = 'DESCONECTADO';
        sessionState.error = 'Tiempo de espera agotado (45s) esperando el código QR de WhatsApp Web. Intenta vincular nuevamente.';
        const staleClient = sessionState.client;
        sessionState.client = null;
        repo.setSessionStatus(id, 'DESCONECTADO').catch(() => {});
        settleQr(null);
        if (staleClient) {
          try {
            await staleClient.destroy();
          } catch (e) {}
        }
      } else {
        settleQr(null);
      }
    }, QR_INIT_TIMEOUT_MS);
    sessionState.qrTimer = qrTimer;

    try {
      // Importación compatible con CommonJS y ESM para whatsapp-web.js
      const pkg = await import('whatsapp-web.js');
      const Client = pkg.Client || pkg.default?.Client;
      const LocalAuth = pkg.LocalAuth || pkg.default?.LocalAuth;
      const qrcode = (await import('qrcode')).default;

      if (!Client || !LocalAuth) {
        throw new Error('No se pudo resolver Client o LocalAuth de whatsapp-web.js');
      }

      // Limpiar bloqueos previos huérfanos antes de instanciar
      this.cleanSessionLocks(id);

      // Instanciar cliente Puppeteer de forma protegida
      const client = new Client(this._buildClientConfig(LocalAuth, id));

      sessionState.client = client;

      client.on('qr', async (qr) => {
        if (this.sessions.get(id) !== sessionState) return;
        sessionState.qr = qr;
        sessionState.status = 'ESPERANDO_QR';
        sessionState.error = null;
        sessionState.qrTimedOut = false;
        try {
          // QR oficial de WhatsApp: contraste puro en blanco y negro para escaneo móvil veloz
          sessionState.qrDataUrl = await qrcode.toDataURL(qr, {
            width: 320,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
        } catch (qrErr) {
          console.error('[WhatsAppManager] Error al generar DataURL:', qrErr);
        }

        repo.setSessionStatus(id, 'ESPERANDO_QR').catch(() => {});

        console.log(`[WhatsAppManager] Código QR OFICIAL recibido de WhatsApp Web para Usuario ID ${id}`);
        settleQr(qr);
      });

      client.on('ready', () => {
        if (this.sessions.get(id) !== sessionState) return;
        sessionState.status = 'CONECTADO';
        sessionState.qr = null;
        sessionState.qrDataUrl = null;
        sessionState.error = null;
        sessionState.qrTimedOut = false;

        const wid = client.info?.wid?.user || '';
        const phone = wid ? `+${wid}` : null;
        sessionState.phone = phone;

        repo.setSessionStatus(id, 'CONECTADO', { phone }).catch(() => {});

        console.log(`[WhatsAppManager] ¡Sesión WhatsApp CONECTADA para Usuario ID ${id}! (${phone})`);
        settleQr(null);
      });

      client.on('message', async (msg) => {
        try {
          await this.handleIncomingMessage(id, msg);
        } catch (msgErr) {
          console.error(`[WhatsAppManager] Error procesando mensaje entrante en sesión ${id}:`, msgErr);
        }
      });

      client.on('authenticated', () => {
        console.log(`[WhatsAppManager] Sesión autenticada para Usuario ID ${id}`);
      });

      client.on('auth_failure', (msg) => {
        if (this.sessions.get(id) !== sessionState) return;
        console.warn(`[WhatsAppManager] Fallo auth Usuario ID ${id}:`, msg);
        sessionState.status = 'DESCONECTADO';
        sessionState.error = msg || 'Error de autenticación en WhatsApp Web.';
        repo.setSessionStatus(id, 'DESCONECTADO').catch(() => {});
        settleQr(null);
      });

      client.on('disconnected', (reason) => {
        if (this.sessions.get(id) !== sessionState) return;
        console.log(`[WhatsAppManager] Sesión desconectada Usuario ID ${id}:`, reason);
        if (sessionState.status === 'INICIALIZANDO' && !sessionState.error) {
          sessionState.error = `Sesión desconectada durante el inicio (${reason || 'sin motivo'}).`;
        }
        sessionState.status = 'DESCONECTADO';
        sessionState.client = null;
        sessionState.qrDataUrl = null;
        repo.setSessionStatus(id, 'DESCONECTADO').catch(() => {});
        settleQr(null);
      });

      // Iniciar Puppeteer de forma protegida
      client.initialize().catch((initErr) => {
        if (this.sessions.get(id) !== sessionState) return;
        console.warn(`[WhatsAppManager] Error inicializando cliente Puppeteer para ID ${id}:`, initErr.message);
        sessionState.status = 'DESCONECTADO';
        sessionState.client = null;
        sessionState.qrDataUrl = null;
        sessionState.error = initErr.message || 'Error al inicializar Chromium/Puppeteer.';
        repo.setSessionStatus(id, 'DESCONECTADO').catch(() => {});
        settleQr(null);

        // Si falló por corrupción de perfil ('Socket'), purgar directorio para permitir reintento limpio
        if (initErr.message && initErr.message.includes('Socket')) {
          const sDir = path.resolve(AUTH_DIR, `session-session_${id}`);
          if (fs.existsSync(sDir)) {
            try {
              fs.rmSync(sDir, { recursive: true, force: true });
            } catch (e) {}
          }
        }
      });

      // Aguardar la llegada del código QR oficial emitido por WhatsApp
      const realQr = await qrPromise;

      if (realQr && sessionState.qrDataUrl) {
        return {
          success: true,
          status: 'ESPERANDO_QR',
          message: 'Código QR oficial de WhatsApp generado.',
          qrDataUrl: sessionState.qrDataUrl
        };
      }

      return {
        success: true,
        status: sessionState.status,
        message: sessionState.error || 'Iniciando WhatsApp Web. El código QR aparecerá en pantalla en unos segundos.',
        qrDataUrl: sessionState.qrDataUrl || null,
        error_en_vivo: sessionState.error || null
      };

    } catch (err) {
      if (qrTimer) clearTimeout(qrTimer);
      console.error(`[WhatsAppManager] Error al preparar sesión ${id}:`, err);
      sessionState.status = 'DESCONECTADO';
      sessionState.client = null;
      sessionState.error = err.message;

      await repo.setSessionStatus(id, 'DESCONECTADO');

      throw new AppError(`Error al iniciar la sesión de WhatsApp: ${err.message}`, 500);
    }
  }

  // 4. Desconectar y cerrar sesión
  async disconnectSession(therapistId) {
    const id = parseInt(therapistId, 10);
    const repo = this._repo();
    const live = this.sessions.get(id);

    if (live && live.client) {
      try {
        await live.client.logout();
      } catch (e) {}
      try {
        await live.client.destroy();
      } catch (e) {}
    }

    this.sessions.delete(id);
    this.cleanSessionLocks(id);

    const sessionDir = path.resolve(AUTH_DIR, `session-session_${id}`);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch (e) {}
    }

    await repo.setSessionStatus(id, 'DESCONECTADO', { clearConnectedAt: true });

    return {
      success: true,
      status: 'DESCONECTADO',
      message: 'Sesión de WhatsApp cerrada exitosamente.'
    };
  }

  /**
   * Monitoreo básico de memoria y cierre limpio de clientes Puppeteer / Chromium activos.
   */
  getRuntimeResourceStats() {
    const mem = process.memoryUsage();
    const activeSessions = [];
    for (const [id, s] of this.sessions.entries()) {
      if (s && s.status && s.status !== 'DESCONECTADO') {
        activeSessions.push({ therapistId: id, status: s.status });
      }
    }
    return {
      activeChromiumSessions: activeSessions.length,
      sessions: activeSessions,
      nodeRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10
    };
  }

  async shutdownAllSessions() {
    for (const [id, live] of this.sessions.entries()) {
      if (live && live.client) {
        try {
          await live.client.destroy();
        } catch {}
      }
      this.cleanSessionLocks(id);
    }
    this.sessions.clear();
  }

  // 4b. Auto-reanudar sesión existente en disco (LocalAuth) sin requerir nuevo QR
  async autoResumeSession(therapistId) {
    const id = parseInt(therapistId, 10);
    const repo = this._repo();

    const existing = this.sessions.get(id);
    if (existing && existing.status === 'CONECTADO') {
      return existing;
    }

    if (existing && (existing.status === 'INICIALIZANDO' || existing.status === 'RECONECTANDO') && existing.readyPromise) {
      return await existing.readyPromise;
    }

    const sessionDir = path.resolve(AUTH_DIR, `session-session_${id}`);
    if (!fs.existsSync(sessionDir)) {
      return null;
    }

    try {
      const pkg = await import('whatsapp-web.js');
      const Client = pkg.Client || pkg.default?.Client;
      const LocalAuth = pkg.LocalAuth || pkg.default?.LocalAuth;
      const qrcode = (await import('qrcode')).default;

      if (!Client || !LocalAuth) return null;

      let resolveReady = null;
      let sessionState = null;
      const readyPromise = new Promise((resolve) => {
        resolveReady = resolve;
        setTimeout(() => {
          if (sessionState && sessionState.status === 'RECONECTANDO') {
            console.warn(`[WhatsAppManager] Tiempo de espera de reconexión agotado para sesión ${id}. Marcando como DESCONECTADO.`);
            sessionState.status = 'DESCONECTADO';
          }
          resolve(null);
        }, 25000); // 25s timeout
      });

      // Limpiar bloqueos previos huérfanos antes de instanciar
      this.cleanSessionLocks(id);

      const client = new Client(this._buildClientConfig(LocalAuth, id));

      sessionState = {
        client,
        qr: null,
        qrDataUrl: null,
        status: 'RECONECTANDO',
        phone: null,
        error: null,
        lastMessageAt: null,
        readyPromise
      };
      this.sessions.set(id, sessionState);

      client.on('ready', () => {
        sessionState.status = 'CONECTADO';
        sessionState.qr = null;
        sessionState.qrDataUrl = null;
        sessionState.error = null;

        const wid = client.info?.wid?.user || '';
        const phone = wid ? `+${wid}` : null;
        sessionState.phone = phone;

        repo.setSessionStatus(id, 'CONECTADO', { phone, preserveConnectedAt: true }).catch(() => {});

        console.log(`[WhatsAppManager] Sesión auto-reanudada exitosamente para ID ${id} (${phone})`);
        if (resolveReady) resolveReady(sessionState);
      });

      client.on('message', async (msg) => {
        try {
          await this.handleIncomingMessage(id, msg);
        } catch (msgErr) {
          console.error(`[WhatsAppManager] Error procesando mensaje entrante en sesión reanudada ${id}:`, msgErr);
        }
      });

      client.on('qr', async (qr) => {
        sessionState.qr = qr;
        sessionState.status = 'ESPERANDO_QR';
        try {
          sessionState.qrDataUrl = await qrcode.toDataURL(qr, {
            width: 320,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
        } catch (e) {}

        repo.setSessionStatus(id, 'ESPERANDO_QR').catch(() => {});

        if (resolveReady) resolveReady(null);
      });

      client.on('auth_failure', (msg) => {
        console.warn(`[WhatsAppManager] Fallo de auth en sesión reanudada ${id}:`, msg);
        sessionState.status = 'DESCONECTADO';
        sessionState.error = msg;
        repo.setSessionStatus(id, 'DESCONECTADO').catch(() => {});
        if (resolveReady) resolveReady(null);
      });

      client.on('disconnected', () => {
        sessionState.status = 'DESCONECTADO';
        sessionState.client = null;
        repo.setSessionStatus(id, 'DESCONECTADO').catch(() => {});
      });

      client.initialize().catch((err) => {
        console.warn(`[WhatsAppManager] Aviso al auto-reanudar sesión ${id}:`, err.message);
        sessionState.status = 'DESCONECTADO';
        if (resolveReady) resolveReady(null);
      });

      return await readyPromise;
    } catch (err) {
      console.warn(`[WhatsAppManager] Error en auto-reanudación ${id}:`, err.message);
      return null;
    }
  }

  // 4c. Auto-restaurar todas las sesiones vinculadas al arrancar el servidor
  async autoRestoreConnectedSessions() {
    try {
      await this.ensureDynamicSessions();
      const repo = this._repo();
      const connectedRows = await repo.getConnectedSessions();

      for (const row of connectedRows) {
        const sessionDir = path.resolve(AUTH_DIR, `session-session_${row.terapeuta_id}`);
        if (fs.existsSync(sessionDir)) {
          console.log(`[WhatsAppManager] Auto-restaurando sesión vinculada para especialista ${row.terapeuta_id}...`);
          this.autoResumeSession(row.terapeuta_id).catch(() => {});
        } else {
          await repo.setSessionStatus(row.terapeuta_id, 'DESCONECTADO');
        }
      }
    } catch (e) {
      console.warn('[WhatsAppManager] Aviso al auto-restaurar sesiones:', e.message);
    }
  }

  // 5. Enviar mensaje de WhatsApp respetando pausas anti-ban (1.5s a 3.0s)
  async sendMessage(therapistId, toPhone, messageText) {
    const id = parseInt(therapistId, 10);
    let live = this.sessions.get(id);

    // Si el cliente no está en memoria pero existe sesión previa en disco, intentar auto-conexión
    if (!live || live.status !== 'CONECTADO') {
      const sessionDir = path.resolve(AUTH_DIR, `session-session_${id}`);
      if (fs.existsSync(sessionDir)) {
        console.log(`[WhatsAppManager] Detectada sesión guardada para ID ${id}. Intentando auto-conexión...`);
        const resumed = await this.autoResumeSession(id);
        if (resumed && resumed.status === 'CONECTADO') {
          live = resumed;
        }
      }
    }

    if (live && live.status === 'RECONECTANDO' && live.readyPromise) {
      console.log(`[WhatsAppManager] Esperando a que finalice reconexión de sesión para ID ${id}...`);
      const resumed = await live.readyPromise;
      if (resumed && resumed.status === 'CONECTADO') {
        live = resumed;
      }
    }

    if (!live || !live.client || live.status !== 'CONECTADO') {
      if (live && live.status === 'RECONECTANDO') {
        throw new AppError(
          'El canal de WhatsApp aún se encuentra reconectando con el servidor en segundo plano. Por favor espere unos segundos mientras se establece el enlace oficial.',
          409
        );
      }
      throw new AppError(
        'El canal de WhatsApp no se encuentra conectado en vivo en este momento. Por favor abra "Vincular Mi WhatsApp Móvil" y escanee el código QR oficial con su teléfono para enlazar la sesión activa antes de despachar mensajes.',
        400
      );
    }

    // Normalizar número telefónico
    let cleanPhone = String(toPhone || '').replace(/[^\d]/g, '');
    if (!cleanPhone.startsWith('591') && cleanPhone.length === 8) {
      cleanPhone = `591${cleanPhone}`;
    }

    const chatId = `${cleanPhone}@c.us`;

    // Pausa anti-ban obligatoria (1500ms a 3000ms)
    const delay = Math.floor(1500 + Math.random() * 1500);
    await new Promise(resolve => setTimeout(resolve, delay));

    if (live && live.client && live.status === 'CONECTADO') {
      try {
        let targetChatId = chatId;

        // 1. Intentar resolver WID oficial o LID antes de enviar para evitar "No LID for..."
        try {
          if (typeof live.client.getContactLidAndPhone === 'function') {
            const lidInfo = await live.client.getContactLidAndPhone([chatId]);
            if (lidInfo && lidInfo[0] && lidInfo[0].lid) {
              targetChatId = lidInfo[0].lid;
              console.log(`[WhatsAppManager] Destinatario ${cleanPhone} resuelto a LID: ${targetChatId}`);
            }
          }
        } catch (lidErr) {
          console.warn('[WhatsAppManager] Aviso al consultar LID de contacto:', lidErr.message);
        }

        if (targetChatId === chatId) {
          try {
            const numberId = await live.client.getNumberId(cleanPhone);
            if (numberId && numberId._serialized) {
              targetChatId = numberId._serialized;
            } else if (numberId === null) {
              throw new AppError(
                `El número telefónico +${cleanPhone} no se encuentra registrado en WhatsApp o la cuenta no está activa. Verifique el número de teléfono del tutor o ingrese un número válido.`,
                400
              );
            }
          } catch (widErr) {
            if (widErr instanceof AppError) throw widErr;
            console.warn('[WhatsAppManager] Aviso al resolver WID oficial:', widErr.message);
          }
        }

        const getOrRefreshActivePage = async () => {
          if (live.client?.pupBrowser) {
            try {
              const pages = await live.client.pupBrowser.pages();
              for (const p of pages) {
                if (!p.isClosed()) {
                  try {
                    const isAlive = await p.evaluate(() => typeof window.WWebJS !== 'undefined' && typeof window.require === 'function');
                    if (isAlive) {
                      live.client.pupPage = p;
                      return p;
                    }
                  } catch (e) {}
                }
              }
              const validFallback = pages.find(p => !p.isClosed());
              if (validFallback) {
                live.client.pupPage = validFallback;
                return validFallback;
              }
            } catch (e) {}
          }
          return live.client?.pupPage;
        };

        let messageId = `WA_${Date.now()}`;
        try {
          // Asegurar página activa válida antes de enviar
          await getOrRefreshActivePage();
          const result = await live.client.sendMessage(targetChatId, messageText);
          if (result && result.id && result.id._serialized) {
            messageId = result.id._serialized;
          }
        } catch (sendErr) {
          if (sendErr instanceof AppError) {
            throw sendErr;
          }
          // Si el mensaje fue entregado al DOM de WhatsApp Web con éxito pero la librería no pudo
          // serializar el modelo de retorno por el nuevo layout de WhatsApp
          if (sendErr.message && (sendErr.message.includes("'id'") || sendErr.message.includes("reading 'id'"))) {
            console.log(`[WhatsAppManager] Mensaje despachado exitosamente a ${targetChatId} (id autogenerado)`);
          } else if (
            sendErr.message && (
              sendErr.message.toLowerCase().includes('detached') ||
              sendErr.message.toLowerCase().includes('execution context') ||
              sendErr.message.toLowerCase().includes('lid')
            )
          ) {
            console.warn(`[WhatsAppManager] Inconsistencia en contexto/LID (${sendErr.message}). Re-vinculando página activa y reintentando con evaluate directo...`);
            await new Promise(r => setTimeout(r, 1200));
            const activePage = await getOrRefreshActivePage();

            if (activePage) {
              try {
                const res = await activePage.evaluate(async (cleanPhone, targetChat, text) => {
                  const wid = window.require('WAWebWidFactory').createWid(`${cleanPhone}@c.us`);
                  let target = wid;
                  try {
                    const queryResult = await window.require('WAWebQueryExistsJob').queryWidExists(wid);
                    if (queryResult && queryResult.wid) {
                      target = queryResult.wid;
                    }
                  } catch (qErr) {}

                  try {
                    const { lid } = await window.WWebJS.enforceLidAndPnRetrieval(`${cleanPhone}@c.us`);
                    if (lid) {
                      target = typeof lid === 'string' ? window.require('WAWebWidFactory').createWid(lid) : lid;
                    }
                  } catch (e) {}

                  let chat = window.require('WAWebCollections').Chat.get(target);
                  if (!chat) {
                    try {
                      chat = (await window.require('WAWebFindChatAction').findOrCreateLatestChat(target))?.chat;
                    } catch (e) {
                      try {
                        const ChatCollection = window.require('WAWebCollections').Chat;
                        const ChatModel = ChatCollection.modelClass;
                        chat = new ChatModel({ id: target });
                        ChatCollection.add(chat);
                      } catch (modelErr) {
                        chat = window.require('WAWebCollections').Chat.get(wid);
                      }
                    }
                  }
                  if (chat) {
                    return await window.WWebJS.sendMessage(chat, text);
                  }
                  throw new Error('CHAT_NOT_FOUND');
                }, cleanPhone, targetChatId, messageText);

                if (res && res.id && res.id._serialized) {
                  messageId = res.id._serialized;
                }
                console.log(`[WhatsAppManager] Mensaje despachado exitosamente vía evaluate directo a ${cleanPhone}`);
              } catch (evalErr) {
                if (evalErr.message && (evalErr.message.includes("'id'") || evalErr.message.includes("reading 'id'"))) {
                  console.log(`[WhatsAppManager] Mensaje entregado vía evaluate directo a ${cleanPhone}`);
                } else if (evalErr.message && evalErr.message.includes('NOT_REGISTERED')) {
                  throw new AppError(
                    `El número +${cleanPhone} no se encuentra registrado en WhatsApp o la cuenta no está activa.`,
                    400
                  );
                } else {
                  console.warn('[WhatsAppManager] Reintento evaluate advirtió:', evalErr.message);
                  // Intento final con client.sendMessage tras estabilizar
                  try {
                    const finalResult = await live.client.sendMessage(targetChatId, messageText);
                    if (finalResult && finalResult.id && finalResult.id._serialized) {
                      messageId = finalResult.id._serialized;
                    }
                  } catch (finalErr) {
                    if (finalErr.message && (finalErr.message.includes("'id'") || finalErr.message.includes("reading 'id'"))) {
                      console.log(`[WhatsAppManager] Mensaje final entregado a ${targetChatId}`);
                    } else {
                      // Disparar auto-recuperación de la sesión en segundo plano
                      this.initSession(id).catch(() => {});
                      throw new AppError(
                        'El navegador de WhatsApp se estaba sincronizando en segundo plano. La sesión se ha re-estabilizado automáticamente; por favor confirme el envío en 3 segundos.',
                        409
                      );
                    }
                  }
                }
              }
            } else {
              this.initSession(id).catch(() => {});
              throw new AppError(
                'El navegador de WhatsApp se estaba sincronizando en segundo plano. La sesión se ha re-estabilizado automáticamente; por favor confirme el envío en 3 segundos.',
                409
              );
            }
          } else {
            const cleanErrMsg = sendErr.message ? sendErr.message.replace(/https?:\/\/[^\s)]+/g, '').replace(/\([^)]*\)/g, '').trim() : '';
            throw new AppError(
              `No se pudo despachar el mensaje por WhatsApp: ${cleanErrMsg || 'Error en la conexión con el canal oficial.'}`,
              400
            );
          }
        }
        
        await this._repo().touchLastMessageAt(id);

        return {
          success: true,
          mode: 'DIRECT_WHATSAPP_WEB',
          messageId,
          to: cleanPhone,
          fromTherapistId: id,
          delayAppliedMs: delay
        };
      } catch (sendErr) {
        if (sendErr instanceof AppError) throw sendErr;
        console.error(`[WhatsAppManager] Error al enviar mensaje vía especialista ${id}:`, sendErr);
        const cleanMsg = sendErr.message ? sendErr.message.replace(/https?:\/\/[^\s)]+/g, '').replace(/\([^)]*\)/g, '').trim() : '';
        throw new AppError(`No se pudo despachar el mensaje por WhatsApp: ${cleanMsg || 'Error interno de conexión.'}`, 500);
      }
    }

    // Si el cliente no está conectado en memoria con Puppeteer activo
    throw new AppError(
      'El canal de WhatsApp no se encuentra conectado en vivo en este momento. Por favor abra "Vincular Mi WhatsApp Móvil" y escanee el código QR oficial con su teléfono para enlazar la sesión activa antes de despachar mensajes.',
      400
    );
  }

  // 6. Mensaje de prueba interactivo
  async sendTestMessage(therapistId, customPhone = null) {
    const id = parseInt(therapistId, 10);
    const session = await this.getSession(id);

    const targetPhone = customPhone || session.telefono_vinculado || session.terapeuta_telefono_oficial || '59170000001';
    const message = `*Centro Psicopedagógico "PSI Aprende"*\n\nHola estimado(a) profesional,\n\nEste es un mensaje de prueba para confirmar que tu WhatsApp oficial está vinculado y activo en el sistema.\n\nEspecialista: *${session.nombres} ${session.apellidos}*\nMatrícula: *${session.registro_profesional}*\nFecha: _${new Date().toLocaleString('es-BO')}_\n\n_Mensaje automático de verificación._`;

    return this.sendMessage(id, targetPhone, message);
  }

  // =========================================================================
  // BOT BIDIRECCIONAL INTELIGENTE & DESAMBIGUACIÓN MULTI-HIJO (SPRINT 9)
  // =========================================================================

  formatTime(isoStr) {
    if (!isoStr) return '--:--';
    return isoStr.slice(11, 16);
  }

  formatDate(isoStr) {
    if (!isoStr) return '';
    const parts = isoStr.slice(0, 10).split('-');
    if (parts.length !== 3) return isoStr.slice(0, 10);
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  async handleIncomingMessage(therapistId, msg) {
    if (!msg || msg.fromMe || msg.from?.includes('@g.us') || msg.from?.includes('status')) return;

    let fromRaw = (msg.from || '').replace('@c.us', '');
    let cleanDigits = fromRaw.replace(/[^\d]/g, '');

    // Si viene de identificador @lid o número no estándar, intentar resolver teléfono real con Puppeteer / WWebJS
    if (msg.from?.endsWith('@lid') || !cleanDigits || cleanDigits.length > 14) {
      const live = this.sessions.get(therapistId);
      if (live?.client?.pupPage) {
        try {
          const resolvedPn = await live.client.pupPage.evaluate(async (targetId) => {
            try {
              const wid = window.require('WAWebWidFactory').createWid(targetId);
              const chat = window.require('WAWebCollections').Chat.get(wid);
              if (chat?.contact?.phoneNumber) return chat.contact.phoneNumber;
              if (chat?.phoneNumber) return chat.phoneNumber;
            } catch (e) {}
            try {
              const res = await window.WWebJS.enforceLidAndPnRetrieval(targetId);
              if (res?.pn) return res.pn;
            } catch (e) {}
            return null;
          }, msg.from);
          if (resolvedPn) {
            cleanDigits = resolvedPn.replace(/[^\d]/g, '');
          }
        } catch (e) {}
      }

      if (!cleanDigits || cleanDigits.length > 14) {
        try {
          if (typeof msg.getContact === 'function') {
            const contact = await msg.getContact();
            if (contact && contact.number && contact.number.length <= 14) {
              cleanDigits = contact.number.replace(/[^\d]/g, '');
            }
          }
        } catch (e) {
          console.warn('[WhatsAppManager] Error al resolver contacto de msg:', e.message);
        }
      }
    }

    const body = (msg.body || '').trim();
    if (!body) return;

    const lower = body.toLowerCase();
    const repo = this._repo();

    // 1. Determinar la acción solicitada por el tutor
    const isConfirm = lower === '1' || lower.startsWith('1') || lower.includes('confirm') || lower.includes('asist') || lower.includes('si');
    const isReschedule = lower === '2' || lower.startsWith('2') || lower.includes('reprogram') || lower.includes('cambi') || lower.includes('no puedo');

    if (!isConfirm && !isReschedule) {
      // Si no es un comando de acción clínica (1 o 2), no procesar
      return;
    }
    const requestedAction = isConfirm ? 'CONFIRM' : 'RESCHEDULE';

    const localPhone = cleanDigits && cleanDigits.startsWith('591') ? cleanDigits.slice(3) : cleanDigits;

    // 2. Buscar si el remitente es un tutor registrado (búsqueda bidireccional segura)
    let tutor = null;
    if (cleanDigits && cleanDigits.length >= 7) {
      tutor = await repo.findTutorByPhoneDigits(cleanDigits, localPhone);
    }

    // 3. Fallback inteligente de contexto: Si WhatsApp ofusca el número en @lid y no se encontró tutor por dígitos
    if (!tutor) {
      console.log(`[WhatsAppManager] Número no mapeado directamente (${cleanDigits || msg.from}). Buscando última cita recordada por especialista ID ${therapistId}...`);
      const recentAppointment = await repo.getLatestSentReminderAppointmentByTherapist(therapistId);

      if (recentAppointment) {
        tutor = {
          id: recentAppointment.tutor_id,
          nombres: recentAppointment.tutor_nombres,
          apellidos: recentAppointment.tutor_apellidos,
          whatsapp: recentAppointment.tutor_whatsapp,
          usuario_id: recentAppointment.tutor_usuario_id
        };
        console.log(`[WhatsAppManager] Cita #${recentAppointment.id} vinculada exitosamente con tutor ${tutor.nombres} ${tutor.apellidos} vía fallback de terapeuta`);
        await this.applyAppointmentAction(therapistId, recentAppointment, tutor, requestedAction, msg.from);
        return;
      }

      console.log(`[WhatsAppManager] Mensaje recibido de remitente sin cita o tutor activo: ${msg.from} (${cleanDigits})`);
      return;
    }

    console.log(`[WhatsAppManager] Mensaje entrante de tutor ${tutor.nombres} ${tutor.apellidos} (${cleanDigits || msg.from}): "${body}"`);

    // 4. Verificar si había una consulta de desambiguación interactiva pendiente (caso multi-hijo)
    const pendingDisambiguation = this.pendingDisambiguations.get(cleanDigits) || this.pendingDisambiguations.get(localPhone);
    if (pendingDisambiguation && Date.now() < pendingDisambiguation.expiresAt) {
      const { appointments, action } = pendingDisambiguation;

      if (lower === 'a' || lower === '1') {
        this.pendingDisambiguations.delete(cleanDigits);
        this.pendingDisambiguations.delete(localPhone);
        await this.applyAppointmentAction(therapistId, appointments[0], tutor, action, msg.from);
        return;
      } else if (lower === 'b' || lower === '2') {
        this.pendingDisambiguations.delete(cleanDigits);
        this.pendingDisambiguations.delete(localPhone);
        await this.applyAppointmentAction(therapistId, appointments[1], tutor, action, msg.from);
        return;
      } else if (lower === 'ambas' || lower === 'ambos' || lower === 'todas' || lower === 'todos') {
        this.pendingDisambiguations.delete(cleanDigits);
        this.pendingDisambiguations.delete(localPhone);
        for (const apt of appointments) {
          await this.applyAppointmentAction(therapistId, apt, tutor, action, msg.from);
        }
        const client = this.sessions.get(therapistId)?.client;
        if (client) {
          const actionText = action === 'CONFIRM' ? 'confirmadas' : 'registradas para reprogramación';
          await client.sendMessage(msg.from, `*PSI APRENDE:* Las citas de sus hijos han sido ${actionText} exitosamente en el sistema. Muchas gracias.`);
        }
        return;
      }
    }

    // 5. PRIORIDAD 1: Buscar la cita vinculada al recordatorio más reciente enviado a este tutor
    const lastReminderCita = await repo.getLatestSentReminderAppointmentByTutor(tutor.id);

    if (lastReminderCita) {
      console.log(`[WhatsAppManager] Respuesta vinculada al recordatorio reciente de Cita #${lastReminderCita.id} (${lastReminderCita.paciente_nombres})`);
      await this.applyAppointmentAction(therapistId, lastReminderCita, tutor, requestedAction, msg.from);
      return;
    }

    // 6. PRIORIDAD 2: Si no hubo recordatorio directo reciente, buscar citas próximas activas en fecha de hoy o futuro
    const upcoming = await repo.getUpcomingTutorAppointments(tutor.id);

    if (upcoming.length === 0) {
      // Cita fuera de plazo o no encontrada
      const client = this.sessions.get(therapistId)?.client;
      if (client) {
        await client.sendMessage(msg.from, `*PSI APRENDE*\n\nEstimado/a ${tutor.nombres}, no cuenta con sesiones pendientes de confirmación en este momento. Si requiere una nueva cita o consulta, comuníquese con su especialista asignado en PSI Aprende.`);
      }
      return;
    }

    // 6. Caso A: Solo 1 cita activa próxima -> Cero ambigüedad
    if (upcoming.length === 1) {
      await this.applyAppointmentAction(therapistId, upcoming[0], tutor, requestedAction, msg.from);
      return;
    }

    // 7. Caso B: Múltiples citas (Multi-hijo o múltiples citas de la semana)
    // Verificar si el mensaje del tutor incluyó el nombre del hijo (ej. "1 mateo", "confirmar camila", "1 jr")
    const matchedByChildName = upcoming.find(apt => {
      const childFirst = apt.paciente_nombres.toLowerCase().split(' ')[0];
      return lower.includes(childFirst);
    });

    if (matchedByChildName) {
      await this.applyAppointmentAction(therapistId, matchedByChildName, tutor, requestedAction, msg.from);
      return;
    }

    // 8. Ambigüedad detectada: Guardar estado y solicitar desambiguación interactiva
    this.pendingDisambiguations.set(cleanDigits, {
      appointments: upcoming.slice(0, 2),
      action: requestedAction,
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutos para responder A o B
    });
    this.pendingDisambiguations.set(localPhone, {
      appointments: upcoming.slice(0, 2),
      action: requestedAction,
      expiresAt: Date.now() + 15 * 60 * 1000
    });

    const client = this.sessions.get(therapistId)?.client;
    if (client) {
      const apt1 = upcoming[0];
      const apt2 = upcoming[1];
      const hora1 = this.formatTime(apt1.fecha_hora_inicio);
      const fecha1 = this.formatDate(apt1.fecha_hora_inicio);
      const hora2 = this.formatTime(apt2.fecha_hora_inicio);
      const fecha2 = this.formatDate(apt2.fecha_hora_inicio);
      const actionVerb = requestedAction === 'CONFIRM' ? 'confirmar' : 'reprogramar';

      const promptMsg = 
`*PSI APRENDE - CONFIRMACIÓN FAMILIAR*

Estimado/a *${tutor.nombres}*, detectamos que tiene varias citas programadas para sus hijos:

*A)* *${apt1.paciente_nombres}* — ${fecha1} a las ${hora1} (Lic. ${apt1.terapeuta_nombres})
*B)* *${apt2.paciente_nombres}* — ${fecha2} a las ${hora2} (Lic. ${apt2.terapeuta_nombres})

Por favor responda a este mensaje con:
*A* para ${actionVerb} la sesión de ${apt1.paciente_nombres}
*B* para ${actionVerb} la sesión de ${apt2.paciente_nombres}
*AMBAS* para ${actionVerb} las dos sesiones`;

      await client.sendMessage(msg.from, promptMsg);
    }
  }

  async applyAppointmentAction(therapistId, cita, tutor, action, fromChatId) {
    const repo = this._repo();
    const pacienteNombre = `${cita.paciente_nombres} ${cita.paciente_apellidos || ''}`.trim();
    const tutorNombre = `${tutor.nombres} ${tutor.apellidos || ''}`.trim();
    const hora = this.formatTime(cita.fecha_hora_inicio);
    const fecha = this.formatDate(cita.fecha_hora_inicio);
    const ambienteNombre = cita.ambiente_codigo || cita.ambiente_nombre || 'Consultorio';
    const client = this.sessions.get(therapistId)?.client;

    if (action === 'CONFIRM') {
      // 1. Actualizar cita a CONFIRMADA
      await repo.updateAppointmentStateFromWhatsapp(cita.id, 'CONFIRMADA');

      // 2. Notificación humana al terapeuta (no solo un 1)
      const notifMsg = `El tutor ${tutorNombre} confirmó la cita de ${pacienteNombre}: 'Confirmo mi cita'`;
      if (cita.terapeuta_usuario_id) {
        await notificationService.createNotification({
          userId: cita.terapeuta_usuario_id,
          tipo: 'CITA_CONFIRMADA',
          titulo: 'Cita Confirmada por WhatsApp',
          mensaje: notifMsg,
          linkUrl: '#/appointments',
          citaId: cita.id
        });

        try {
          await webPushService.sendNotificationToUser(cita.terapeuta_usuario_id, {
            title: 'Asistencia Confirmada',
            body: notifMsg,
            icon: '/icons/icon-192x192.png',
            url: '#/appointments',
            data: { citaId: cita.id, tipo: 'CITA_CONFIRMADA' }
          });
        } catch (e) {}
      }

      // 3. Respuesta automática formal al tutor por WhatsApp (Doble confirmación oficial)
      const reply = 
`*PSI APRENDE - ASISTENCIA CONFIRMADA*

Estimado/a *${tutor.nombres}*, la sesión terapéutica de *${pacienteNombre}* ha sido confirmada en el sistema:

• *Fecha:* ${fecha}
• *Hora:* ${hora}
• *Consultorio:* ${ambienteNombre}
• *Especialista:* Lic. ${cita.terapeuta_nombres}

Confirmado, los estaremos esperando puntualmente con 5 minutos de anticipación. Muchas gracias por su colaboración con el tratamiento.`;

      let sentDirectly = false;
      if (client && fromChatId) {
        try {
          await client.sendMessage(fromChatId, reply);
          sentDirectly = true;
          console.log(`[WhatsAppManager] Doble confirmación despachada instantáneamente a chat ${fromChatId}`);
        } catch (directErr) {
          console.warn('[WhatsAppManager] client.sendMessage directo advirtió:', directErr.message);
        }
      }

      if (!sentDirectly) {
        try {
          const targetPhone = tutor.whatsapp || fromChatId;
          await this.sendMessage(therapistId, targetPhone, reply);
          console.log(`[WhatsAppManager] Doble confirmación despachada vía sendMessage a ${targetPhone}`);
        } catch (sendErr) {
          console.warn('[WhatsAppManager] Intento final de doble confirmación no pudo enviarse:', sendErr.message);
        }
      }

    } else if (action === 'RESCHEDULE') {
      // 1. Actualizar cita a REPROGRAMADA
      await repo.updateAppointmentStateFromWhatsapp(cita.id, 'REPROGRAMADA');

      // 2. Notificación formal al terapeuta y recepción
      const notifMsg = `El tutor ${tutorNombre} solicitó reprogramar la cita de ${pacienteNombre}: 'Solicito reprogramar mi cita'`;
      if (cita.terapeuta_usuario_id) {
        await notificationService.createNotification({
          userId: cita.terapeuta_usuario_id,
          tipo: 'CITA_REPROGRAMADA',
          titulo: 'Solicitud de Reprogramación (WhatsApp)',
          mensaje: notifMsg,
          linkUrl: '#/appointments',
          citaId: cita.id
        });

        try {
          await webPushService.sendNotificationToUser(cita.terapeuta_usuario_id, {
            title: 'Solicitud de Reprogramación',
            body: notifMsg,
            icon: '/icons/icon-192x192.png',
            url: '#/appointments',
            data: { citaId: cita.id, tipo: 'CITA_REPROGRAMADA' }
          });
        } catch (e) {}
      }

      // 3. Respuesta automática cordial al tutor (Doble confirmación oficial)
      const reply = 
`*PSI APRENDE - SOLICITUD DE REPROGRAMACIÓN*

Estimado/a *${tutor.nombres}*, hemos registrado su solicitud de cambio de horario para la sesión de *${pacienteNombre}*.

Su especialista Lic. *${cita.terapeuta_nombres}* se comunicará a la brevedad con usted para coordinar una nueva fecha y hora. Muchas gracias por avisarnos con antelación.`;

      let sentDirectly = false;
      if (client && fromChatId) {
        try {
          await client.sendMessage(fromChatId, reply);
          sentDirectly = true;
          console.log(`[WhatsAppManager] Aviso de reprogramación despachado instantáneamente a chat ${fromChatId}`);
        } catch (directErr) {
          console.warn('[WhatsAppManager] client.sendMessage directo advirtió:', directErr.message);
        }
      }

      if (!sentDirectly) {
        try {
          const targetPhone = tutor.whatsapp || fromChatId;
          await this.sendMessage(therapistId, targetPhone, reply);
          console.log(`[WhatsAppManager] Aviso de reprogramación despachado vía sendMessage a ${targetPhone}`);
        } catch (sendErr) {
          console.warn('[WhatsAppManager] Intento final de confirmación de reprogramación no pudo enviarse:', sendErr.message);
        }
      }
    }
  }
}

export const whatsappManager = new WhatsAppManager();
