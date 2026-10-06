/* ===========================================================
   BaatBanao Service Worker (version = CACHE_VERSION below)
   v1.1.0: Security hardening, canonical redirect fix, Vault v0.4.2 integration
   =========================================================== */

const CACHE_VERSION = 'baatbanao-v1.1.1-seo-privacy';
const CORE_ASSETS = [
  './',
  './index.html',
  './pay.html',
  './pay/index.html',
  './pay.js',
  './style.css',
  './app.js',
  './vendor/qrcode.js',
  './blog.css',
  './voice-ocr.js',
  './billing.js',
  './hisaab.js',
  './backup.js',
  './analytics.js',
  './analytics-config.js',
  './cookie-banner.js',
  './vendor/html2canvas.min.js',
  './vendor/jspdf.umd.min.js',
  './install.js',
  './install.css',
  './manifest.json',
  './assets/sample-bills/sample-bill-1-kirana.jpg',
  './assets/sample-bills/sample-bill-2-freelance.jpg',
  './assets/sample-bills/sample-bill-3-parchi.jpg',
  './assets/sample-bills/sample-bill-4-rent.jpg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-192.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png',
  './assets/mascot-coin.webp',
  './assets/mascot-celebrate.webp',
  './assets/mascot-sleeping.webp',
  './assets/mascot-thinking.webp',
  './assets/mascot-paid.webp',
  './assets/vasooli-hero-banner.webp',
  './favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k.startsWith('baatbanao-') && k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
    .then(() => {
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never persist payment URLs (including their recipient query parameters).
  // Offline fallback is a cached parameter-free shell; pay.js reads the current
  // browser URL locally. Do not fall back to the analytics-enabled homepage.
  const isPayment = /^\/pay(?:\.html|\/index\.html)?\/?$/.test(url.pathname);
  if (isPayment) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(async () => {
        const cache = await caches.open(CACHE_VERSION);
        const shell = await cache.match('./pay.html');
        return shell || new Response('Payment page unavailable offline. Reconnect and open the link again.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer' }
        });
      })
    );
    return;
  }

  const isHTML = req.mode === 'navigate' ||
                 req.destination === 'document' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // JS/CSS: network-first so a new HTML never runs with old cached CSS/JS (menu toot jaata tha).
  // Offline: cache fallback (query string ignore karke).
  const isCode = req.destination === 'script' || req.destination === 'style' || /\.(js|css)$/.test(url.pathname);
  if (isCode) {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || Response.error()))
    );
    return;
  }

  // Images/fonts etc: cache-first + background refresh
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) {
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
      }).catch(() => Response.error());
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
