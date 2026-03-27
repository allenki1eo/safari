self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => caches.delete(key)));
    })
  );
});
self.addEventListener('fetch', (e) => {
  // Pass-through to network, no caching to prevent stale assets during dev
  e.respondWith(fetch(e.request));
});
