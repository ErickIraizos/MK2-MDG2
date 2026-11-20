import { apiClient } from './apiClient.js';
import { Toast } from '../components/Toast.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class PushClient {
  static isSupported() {
    try {
      return ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
    } catch (e) {
      return false;
    }
  }

  static getPermission() {
    try {
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission; // 'default' | 'granted' | 'denied'
    } catch (e) {
      return 'unsupported';
    }
  }

  static async getSubscription() {
    if (!this.isSupported()) return null;
    try {
      // Timeout defensivo de 1.5s para no bloquear si el Service Worker aún está activándose
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SW_TIMEOUT')), 1500))
      ]);
      if (!reg?.pushManager) return null;
      return await reg.pushManager.getSubscription();
    } catch (e) {
      console.warn('[PushClient] Aviso al consultar suscripción Web Push:', e.message || e);
      return null;
    }
  }

  static async isSubscribed() {
    try {
      const sub = await this.getSubscription();
      return !!sub;
    } catch (e) {
      return false;
    }
  }

  static async subscribe() {
    if (!this.isSupported()) {
      throw new Error('Su navegador o dispositivo no soporta Notificaciones Web Push.');
    }

    // 1. Solicitar permiso al usuario si está en 'default'
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      throw new Error('Debe conceder permiso de notificaciones en su navegador para recibir alertas.');
    }

    // 2. Obtener clave pública VAPID desde el backend
    const keyRes = await apiClient.get('/notifications/vapid-public-key');
    const vapidPublicKey = keyRes.data?.publicKey;
    if (!vapidPublicKey) {
      throw new Error('No se pudo obtener la clave VAPID pública del servidor.');
    }

    // 3. Suscribir a través del Service Worker y PushManager
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    // 4. Registrar la suscripción en el backend
    await apiClient.post('/notifications/subscribe', {
      subscription: subscription.toJSON()
    });

    return subscription;
  }

  static async unsubscribe() {
    if (!this.isSupported()) return false;

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await apiClient.post('/notifications/unsubscribe', { endpoint }).catch(() => {});
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PushClient] Error al desuscribir:', err);
      throw err;
    }
  }

  static async sendTestPush() {
    return await apiClient.post('/notifications/test-push');
  }
}

