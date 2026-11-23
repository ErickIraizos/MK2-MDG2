const CACHE_NAME = 'psi-aprende-cache-v8';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/assets/isotype-brand.png'
];

// 1. Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-cargando activos estáticos esenciales...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. Activación y purga garantizada de cachés obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Eliminando caché desactualizado:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Estrategia de Fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass obligatorio para peticiones de API, Signed URLs privadas de Supabase Storage y llamadas externas IA
  if (
    url.pathname.startsWith('/api') ||
    url.hostname.includes('groq.com') ||
    url.pathname.includes('/storage/v1/object/sign/')
  ) {
    return; // Peticiones dinámicas/firmadas van directo a la red sin tocar caché
  }

  // ESTRATEGIA NETWORK-FIRST PARA NAVEGACIÓN Y DOCUMENTOS HTML (index.html, /)
  // Garantiza que cuando el servidor está encendido siempre se entregue el diseño más reciente y
  // se actualice la copia del caché. Si el servidor se apaga (offline), rescata la última versión vista.
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html') || caches.match('/');
          });
        })
    );
    return;
  }

  // ESTRATEGIA NETWORK-FIRST PARA SCRIPTS Y ESTILOS (.js, .css)
  // Actualiza en caliente cuando hay cambios en el código y almacena el respaldo offline.
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ESTRATEGIA CACHE-FIRST CON FALLBACK A RED PARA RECURSOS ESTÁTICOS (imágenes, fuentes, iconos)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      });
    })
  );
});

// ==============================================================================
// 4. RECEPCIÓN DE NOTIFICACIONES WEB PUSH NATIVAS PWA (SPRINT 8 - HU-12)
// Funciona en segundo plano en móviles Android/iOS y escritorios aún con PWA cerrada
// ==============================================================================
self.addEventListener('push', (event) => {
  let data = {
    title: 'PSI Aprende - Notificación',
    body: 'Tiene un nuevo aviso clínico o recordatorio de sesión.',
    url: '#/appointments',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const hasCitaActions = Boolean(data.data?.citaId);
  const defaultActions = hasCitaActions ? [
    { action: 'confirm_appointment', title: 'Confirmar Cita' },
    { action: 'reschedule_appointment', title: 'Reprogramar' }
  ] : [
    { action: 'open', title: 'Ver Cita / Alerta' },
    { action: 'close', title: 'Entendido' }
  ];

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-192x192.png',
    vibrate: [150, 60, 150],
    tag: `psi-notif-${data.data?.citaId || Date.now()}`,
    renotify: true,
    data: {
      url: data.url || '#/appointments',
      timestamp: Date.now(),
      ...(data.data || {})
    },
    actions: data.actions || defaultActions
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. INTERACCIÓN Y CLIC SOBRE LA NOTIFICACIÓN PWA
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const notifData = event.notification.data || {};
  const citaId = notifData.citaId;
  let targetPath = notifData.url || '#/appointments';

  if (event.action === 'confirm_appointment' && citaId) {
    targetPath = `#/appointments?action=confirm&citaId=${citaId}`;
  } else if (event.action === 'reschedule_appointment' && citaId) {
    targetPath = `#/appointments?action=reschedule&citaId=${citaId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si la ventana de la PWA ya está abierta, notificar, enfocar y navegar
      for (const client of windowClients) {
        if ('focus' in client && client.url.includes(self.location.origin)) {
          client.navigate(`${self.location.origin}/${targetPath}`);
          client.postMessage({
            type: 'NOTIFICATION_ACTION',
            action: event.action,
            citaId
          });
          return client.focus();
        }
      }
      // Si está cerrada, abrir una nueva ventana con la URL de destino
      if (clients.openWindow) {
        return clients.openWindow(`${self.location.origin}/${targetPath}`);
      }
    })
  );
});

