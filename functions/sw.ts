Deno.serve(async (_req) => {
  const js = `self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {};
  }

  const title = data.title || 'Notificación';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/icon-72x72.png',
    data: { url: data.url || '/' },
    tag: data.tag || 'general',
    renotify: true,
    vibrate: [100, 50, 100]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            client.navigate(targetUrl);
            return client.focus();
          }
        } catch (_) {}
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});`;

  return new Response(js, {
    status: 200,
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      // Allow registering with scope "/" though script is under /functions/
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
});