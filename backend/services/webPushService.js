import * as webpush from 'web-push';
import { RepositoryFactory } from '../core/RepositoryFactory.js';

class WebPushService {
  constructor() {
    this.vapidPublicKey = null;
    this.vapidPrivateKey = null;
    this.vapidEmail = process.env.VAPID_SUBJECT || 'mailto:contacto@psi-aprende.com';
    this.isInitialized = false;
    this._initPromise = null;
  }

  _notifRepo() {
    return RepositoryFactory.getNotificationRepository();
  }

  _configRepo() {
    return RepositoryFactory.getConfigRepository();
  }

  async init() {
    if (this.isInitialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      let pubKey = process.env.VAPID_PUBLIC_KEY;
      let privKey = process.env.VAPID_PRIVATE_KEY;

      if (!pubKey || !privKey) {
        try {
          const configRepo = this._configRepo();
          pubKey = await configRepo.getByKey('VAPID_PUBLIC_KEY');
          privKey = await configRepo.getByKey('VAPID_PRIVATE_KEY');
        } catch (err) {
          console.warn('[WebPush] Error consultando claves en BD:', err.message);
        }
      }

      if (!pubKey || !privKey) {
        console.log('[WebPush] Claves VAPID no encontradas. Generando nuevo par criptográfico...');
        const keys = webpush.generateVAPIDKeys();
        pubKey = keys.publicKey;
        privKey = keys.privateKey;

        try {
          const configRepo = this._configRepo();
          await configRepo.setKey('VAPID_PUBLIC_KEY', pubKey, null);
          await configRepo.setKey('VAPID_PRIVATE_KEY', privKey, null);
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
    })();

    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  async getPublicKey() {
    await this.init();
    return this.vapidPublicKey;
  }

  async saveSubscription(userId, subscriptionData, userAgent = '') {
    await this.init();
    const { endpoint, keys } = subscriptionData;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      throw new Error('Datos de suscripción Web Push incompletos (requiere endpoint, p256dh y auth).');
    }

    return this._notifRepo().savePushSubscription(userId, endpoint, keys.p256dh, keys.auth, userAgent || '');
  }

  async deleteSubscription(endpoint) {
    await this.init();
    return this._notifRepo().deletePushSubscription(endpoint);
  }

  async getSubscriptionsByUserId(userId) {
    await this.init();
    return this._notifRepo().getPushSubscriptionsByUserId(userId);
  }

  async sendNotification(subscription, payload) {
    await this.init();
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
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.warn(`[WebPush] Suscripción caducada (${err.statusCode}). Purgando endpoint:`, subscription.endpoint);
        await this.deleteSubscription(subscription.endpoint);
      } else {
        console.error('[WebPush] Error al despachar notificación:', err.message);
      }
      return { success: false, error: err.message, statusCode: err.statusCode };
    }
  }

  async sendNotificationToUser(userId, payload) {
    await this.init();
    const subscriptions = await this.getSubscriptionsByUserId(userId);
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
