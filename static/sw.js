// Kimbia service worker — network-first pages, cache-first hashed assets.
// Replaces the previous "safari-v1" worker and clears its cache on activate.
const CACHE = 'kimbia-v15';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  // Scores are live data. Never cache the API, and never fall back to the app shell for it.
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })),
    );
    return;
  }

  // Character models keep their names between releases: fetch fresh, but keep a copy for offline runs.
  if (url.pathname.startsWith('/models/')) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  e.respondWith(
    fetch(request)
      .then((res) => {
        if (request.mode === 'navigate') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('/'))),
  );
});

// Notifications: prize news, challenge results and come-back reminders (server/push.js).
self.addEventListener('push', (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { body: e.data?.text() };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Kimbia!', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || 'kimbia',
      renotify: !!data.tag,
      data: { url: data.url || '/' },
      vibrate: [80, 40, 80],
    }),
  );
});

// Tapping a notification brings an open game to the front, or opens it.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus();
      return self.clients.openWindow(url);
    }),
  );
});
