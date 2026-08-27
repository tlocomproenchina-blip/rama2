// TLEC CARGO Service Worker
const CACHE_NAME = 'tlec-cargo-v8';
const APP_SHELL = ['/'];

const SHIP_BADGE = 'https://base44.app/api/apps/695da428c9924ef9b68e8866/files/mp/public/695da428c9924ef9b68e8866/f98391e7a_badge-ship.png';

// Dev-only path segments that must NEVER be served from cache.
// Vite dev server serves these with versioned hashes (?v=...) and caching
// them causes stale JS chunks (duplicate React → "Cannot read properties of null").
const DEV_PATH_MARKERS = ['/@vite', '/@react-refresh', '/node_modules/.vite', '/src/'];

function isDevAsset(url) {
  try {
    const u = new URL(url, self.location.origin);
    const pathname = u.pathname;
    // Also check for ?v= query param which is a Vite dev signature
    const hasViteHash = u.searchParams.has('v');
    return DEV_PATH_MARKERS.some((seg) => pathname.includes(seg)) || hasViteHash;
  } catch (_) {
    return false;
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Never intercept Vite dev / HMR requests — always go straight to network.
  if (isDevAsset(req.url)) {
    return;
  }

  // Network-first for navigations (offline fallback to cache)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Cache-first with background revalidation for static assets (prod only)
  const dest = req.destination;
  if (['script', 'style', 'font', 'image'].includes(dest)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'TLEC CARGO', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'TLEC CARGO';
  const options = {
    body: data.body || '',
    badge: data.badge || SHIP_BADGE,
    tag: data.tag || `tlec-${Date.now()}`,
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
