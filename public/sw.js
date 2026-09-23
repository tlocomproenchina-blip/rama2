// Service Worker para TLEC CARGO — permite que la app cargue offline.
// Network-first para HTML (recoge actualizaciones), cache-first para assets (hashed filenames).
const CACHE_NAME = 'tlec-warehouse-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Solo cachear GET same-origin
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first para HTML (navegación) — recoge actualizaciones al estar online
  if (e.request.mode === 'navigate' || url.pathname === '/index.html') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('/')))
    );
    return;
  }

  // Cache-first para assets (JS, CSS, imágenes — filenames con hash)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
