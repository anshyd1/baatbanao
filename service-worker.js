/* ===========================================================
   BaatBanao Service Worker v1.0.3
   - Auto-update strategy: version bump = fresh cache
   - skipWaiting + clients.claim for instant activation
   - Message channel to notify client of updates
   =========================================================== */

const CACHE_VERSION = 'baatbanao-v1.0.3';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './install.js',
  './install.css',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png',
  './assets/mascot-coin.png',
  './favicon.ico'
];

/* Install — pre-cache the app shell and take over immediately */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* Activate — clean old caches and claim all clients */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
    .then(() => {
      // Notify all open clients about the update
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
      });
    })
  );
});

/* Fetch — network-first for HTML (fresh content), cache-first for assets */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' ||
                 req.destination === 'document' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Network-first: always try to get fresh HTML so updates propagate
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for JS/CSS/images
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Update in background (stale-while-revalidate)
        fetch(req).then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            caches.open(CACHE_VERSION).then(c => c.put(req, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

/* Listen for skipWaiting message from client */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
