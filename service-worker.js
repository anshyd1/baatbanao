/* ===========================================================
   BaatBanao Service Worker (version = CACHE_VERSION below)
   v2.0.2: UI v2 polish — 5-tab nav, lazy billing vendors, single-render navigation.
   v1.1.0: Security hardening, canonical redirect fix, Vault v0.4.2 integration
   =========================================================== */

const CACHE_VERSION = 'baatbanao-v2.0.2-ui-polish';
const CORE_ASSETS = [
  './',
  './index.html',
  './pay.html',
  './pay/index.html',
  './pay.js',
  './style.css',
  './app.js',
  './money.js',
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

/* OCR engine — ~10 MB. Deliberately NOT in CORE_ASSETS: it is only fetched
   the first time someone actually scans a bill, then cached by the
   CACHE_OCR message so OCR keeps working offline afterwards. */
const OCR_CACHE = 'baatbanao-ocr-v1';
const OCR_ASSETS = [
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
  './vendor/tesseract/tesseract-core-lstm.wasm.js',
  './vendor/tesseract/tessdata/eng.traineddata.gz'
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
      // OCR cache (baatbanao-ocr-v1, ~10MB) ko jaan-boojh ke rakho: warna har
      // update pe offline OCR engine phir se download hota hai. Sirf app shell
      // caches delete karo.
      Promise.all(keys.filter(k => k.startsWith('baatbanao-') && k !== CACHE_VERSION && k !== OCR_CACHE).map(k => caches.delete(k)))
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

  // Never retain recipient fields in a Cache Storage request key.
  const privateQuery = ['pa','pn','am','tn','upi','name','phone','amount','note'].some(key => url.searchParams.has(key));
  if (privateQuery) {
    event.respondWith(fetch(req, { cache:'no-store' }).catch(() => caches.match('./index.html')));
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

  // OCR engine: cache-first + background refresh.
  // Once downloaded these never change, and a shop may have no signal.
  if (url.pathname.indexOf('/vendor/tesseract/') === 0) {
    event.respondWith(
      caches.open(OCR_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) {
          fetch(req).then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
          }).catch(() => {});
          return cached;
        }
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      })
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
  // voice-ocr.js calls this after the engine has loaded once, so the next
  // scan works with no network at all.
  if (event.data && event.data.type === 'CACHE_OCR') {
    event.waitUntil(
      caches.open(OCR_CACHE).then((cache) => cache.addAll(OCR_ASSETS)).catch(() => {})
    );
  }
});
