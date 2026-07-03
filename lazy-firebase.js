/* ===========================================================
   BaatBanao — Lazy Firebase Loader
   =========================================================== */
/* Firebase's Auth + Firestore + Realtime DB SDKs weigh ~880 KB combined.
   They're only needed for the Chat feature, but firebase-config.js used
   to be imported unconditionally on every page load — even Home, Vasooli
   Mode, Khata — stealing bandwidth from app.js/style.css/fonts. On a slow
   connection (2G/3G, common for this app's audience) that alone could
   delay the entire home page render by 45-60+ seconds, leaving a blank
   screen below the static topbar.

   Strategy:
   - If the user lands directly on #chat / #connect, load Firebase right
     away (they need it immediately).
   - Otherwise, load it once the browser is idle after first paint, so it
     never competes with the critical rendering path.
   - Only ever loads once, no matter how many times triggered. */
(function () {
  'use strict';
  var loaded = false;

  function loadFirebase() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.type = 'module';
    s.src = 'firebase-config.js';
    document.head.appendChild(s);
  }

  window.BB_loadFirebase = loadFirebase; // exposed so app.js can force-load on chat navigation

  var hash = (window.location.hash || '').replace('#', '');
  if (hash === 'chat' || hash === 'connect') {
    loadFirebase();
  } else if ('requestIdleCallback' in window) {
    requestIdleCallback(loadFirebase, { timeout: 4000 });
  } else {
    setTimeout(loadFirebase, 1500);
  }
})();
