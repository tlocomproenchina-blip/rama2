/* TLEC CARGO Service Worker
 *
 * REGLA CRÍTICA: este SW NUNCA debe cachear ni interceptar JavaScript, CSS,
 * ni ningún asset del bundler. Cachear chunks provoca que el navegador mezcle
 * módulos de dos builds/optimizaciones distintas, lo que crea DOS copias de
 * React y rompe la app con "Cannot read properties of null (reading 'useState')".
 *
 * Solo cachea imágenes/fuentes/manifest y gestiona notificaciones push.
 */

const CACHE_NAME = 'tlec-static-v10';

// Extensiones seguras para cachear (nunca código ejecutable)
const CACHEABLE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.otf'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isCacheable(url) {
  // Nunca tocar nada del bundler ni del código de la app
  if (url.pathname.startsWith('/src')) return false;
  if (url.pathname.startsWith('/node_modules')) return false;
  if (url.pathname.startsWith('/@vite')) return false;
  if (url.pathname.startsWith('/@react-refresh')) return false;
  if (url.pathname.startsWith('/@id')) return false;
  if (url.pathname.startsWith('/@fs')) return false;
  if (url.pathname.startsWith('/assets')) return false;
  if (url.pathname.startsWith('/functions')) return false;
  if (url.pathname.startsWith('/api')) return false;
  if (url.search.includes('v=')) return false; // chunks versionados de Vite

  return CACHEABLE_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Todo lo que no sea una imagen/fuente cacheable pasa directo a la red.
  // Esto incluye navegaciones (HTML), JS, CSS y llamadas a la API.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (!isCacheable(url)) return; // sin respondWith => el navegador maneja la petición

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      });
    }).catch(() => fetch(request))
  );
});

/* ===== Notificaciones Push ===== */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'TLEC CARGO', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'TLEC CARGO';
  const options = {
    body: payload.body || payload.content || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/icon-192.png',
    data: { url: payload.url || payload.action_url || '/' },
    tag: payload.tag || undefined,
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
