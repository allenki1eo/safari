/* ─── Service Worker — Roho ya Tanzania ─────────────────── */
const VERSION = 'v1';
const CACHE   = `roho-ya-tanzania-${VERSION}`;

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/main.js',
  '/src/Player.js',
  '/src/Level.js',
  '/src/UI.js',
];

/* Install ─ cache core assets */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

/* Activate ─ clean up old caches */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Fetch ─ serve cached assets, generate icons on the fly */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Dynamically generate PWA icons using OffscreenCanvas */
  if (url.pathname.startsWith('/icons/icon-')) {
    const size = url.pathname.includes('512') ? 512 : 192;
    event.respondWith(generateIcon(size));
    return;
  }

  /* Network-first for Three.js CDN assets */
  if (url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  /* Cache-first for everything else */
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      })
    )
  );
});

/* ─── Icon generator (Tanzania flag-inspired) ────────────── */
async function generateIcon(size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const s      = size;
  const r      = s / 2;

  /* Clip to circle */
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.clip();

  /* Tanzania flag — 4 triangles meeting at a diagonal stripe */
  /* Top-left: green */
  ctx.fillStyle = '#006B3C';
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(s,0); ctx.lineTo(0,s); ctx.closePath(); ctx.fill();

  /* Bottom-right: blue */
  ctx.fillStyle = '#00A3DD';
  ctx.beginPath(); ctx.moveTo(s,0); ctx.lineTo(s,s); ctx.lineTo(0,s); ctx.closePath(); ctx.fill();

  /* Diagonal black stripe */
  ctx.save();
  ctx.translate(r, r);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = '#111111';
  ctx.fillRect(-s * 0.75, -s * 0.13, s * 1.5, s * 0.26);

  /* Gold borders on stripe */
  ctx.fillStyle = '#FCD116';
  ctx.fillRect(-s * 0.75, -s * 0.17, s * 1.5, s * 0.04);
  ctx.fillRect(-s * 0.75,  s * 0.13, s * 1.5, s * 0.04);
  ctx.restore();

  /* Runner silhouette */
  const fs = s * 0.38;
  ctx.font = `${fs}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🏃🏿', r, r + s * 0.04);

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Response(blob, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=86400' } });
}
