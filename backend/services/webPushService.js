import * as webpush from 'web-push';
import { DatabaseConnection } from '../core/DatabaseConnection.js';
import { config } from '../config/environment.js';

class WebPushService {
  constructor() {
    this.db = null;
    this.vapidPublicKey = null;
    this.vapidPrivateKey = null;
    this.vapidEmail = process.env.VAPID_SUBJECT || 'mailto:contacto@psi-aprende.com';
    this.isInitialized = false;
  }

  getDb() {
    if (!this.db) {
      this.db = DatabaseConnection.getInstance();
    }
    return this.db;
  }

  init() {
    if (this.isInitialized) return;

    const db = this.getDb();

    // 1. Intentar cargar claves de variables de entorno
    let pubKey = process.env.VAPID_PUBLIC_KEY;
    let privKey = process.env.VAPID_PRIVATE_KEY;

    // 2. Si no están en .env, buscar en configuraciones_sistema de SQLite
    if (!pubKey || !privKey) {
      try {
        const rowPub = db.prepare("SELECT valor FROM configuraciones_sistema WHERE clave = 'VAPID_PUBLIC_KEY'").get();
        const rowPriv = db.prepare("SELECT valor FROM configuraciones_sistema WHERE clave = 'VAPID_PRIVATE_KEY'").get();
        if (rowPub && rowPriv) {
          pubKey = rowPub.valor;
          privKey = rowPriv.valor;
        }
      } catch (err) {
        console.warn('[WebPush] Error consultando claves en BD:', err.message);
      }
    }

    // 3. Si no existen en ningún lado, generar par VAPID persistente automáticamente
    if (!pubKey || !privKey) {
      console.log('[WebPush] Claves VAPID no encontradas. Generando nuevo par criptográfico...');
      const keys = webpush.generateVAPIDKeys();
      pubKey = keys.publicKey;
      privKey = keys.privateKey;

      try {
        const insertStmt = db.prepare(`
          INSERT INTO configuraciones_sistema (clave, valor, descripcion, categoria, es_secreto)
          VALUES (?, ?, ?, 'NOTIFICACIONES', ?)
          ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, updated_at = CURRENT_TIMESTAMP
        `);
        insertStmt.run('VAPID_PUBLIC_KEY', pubKey, 'Clave pública VAPID para Web Push PWA', 0);
        insertStmt.run('VAPID_PRIVATE_KEY', privKey, 'Clave privada VAPID para Web Push PWA', 1);
        console.log('[WebPush] Claves VAPID guardadas permanentemente en base de datos.');
      } catch (err) {
        console.error('[WebPush] Error al persistir claves VAPID:', err.message);
      }
    }

    this.vapidPublicKey = pubKey;
    this.vapidPrivateKey = privKey;

    try {
      webpush.setVapidDetails(this.vapidEmail, this.vapidPublicKey, this.vapidPrivateKey);
      this.isInitialized = true;
      console.log('[WebPush] Servicio Web Push inicializado correctamente (VAPID OK).');
    } catch (err) {
      console.error('[WebPush] Error configurando VAPID en web-push:', err.message);
    }
  }

  getPublicKey() {
    this.init();
    return this.vapidPublicKey;
  }

  saveSubscription(userId, subscriptionData, userAgent = '') {
    this.init();
    const db = this.getDb();
    const { endpoint, keys } = subscriptionData;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      throw new Error('Datos de suscripción Web Push incompletos (requiere endpoint, p256dh y auth).');
    }

    const stmt = db.prepare(`
      INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh_key, auth_key, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(endpoint) DO UPDATE SET
        usuario_id = excluded.usuario_id,
        p256dh_key = excluded.p256dh_key,
        auth_key = excluded.auth_key,
        user_agent = excluded.user_agent,
        created_at = CURRENT_TIMESTAMP
    `);

    stmt.run(userId, endpoint, keys.p256dh, keys.auth, userAgent || '');
    return { success: true, message: 'Suscripción guardada exitosamente.' };
  }

  deleteSubscription(endpoint) {
    this.init();
    const db = this.getDb();
    const stmt = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?');
    stmt.run(endpoint);
    return { success: true };
  }

  getSubscriptionsByUserId(userId) {
    this.init();
    const db = this.getDb();
    return db.prepare('SELECT * FROM push_subscriptions WHERE usuario_id = ?').all(userId);
  }

  async sendNotification(subscription, payload) {
    this.init();
    const pushSub = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh_key || subscription.keys?.p256dh,
        auth: subscription.auth_key || subscription.keys?.auth
      }
    };

    const stringPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);

    try {
      await webpush.sendNotification(pushSub, stringPayload);
      return { success: true };
    } catch (err) {
      // 404 o 410 indica que la suscripción ya no existe o caducó en el navegador
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.warn(`[WebPush] Suscripción caducada (${err.statusCode}). Purgando endpoint:`, subscription.endpoint);
        this.deleteSubscription(subscription.endpoint);
      } else {
        console.error('[WebPush] Error al despachar notificación:', err.message);
      }
      return { success: false, error: err.message, statusCode: err.statusCode };
    }
  }

  async sendNotificationToUser(userId, payload) {
    this.init();
    const subscriptions = this.getSubscriptionsByUserId(userId);
    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0, reason: 'El usuario no tiene dispositivos suscritos a Web Push.' };
    }

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      const res = await this.sendNotification(sub, payload);
      if (res.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed, total: subscriptions.length };
  }
}

export const webPushService = new WebPushService();
