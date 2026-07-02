/* ===========================================================
   BaatBanao — Install + Splash + Update Manager v1.0.4
   FIXED IN v1.0.4:
   - Menu "Install App" item now auto-hides (uses class selector)
   - After uninstall, install flow works again (beforeinstallprompt clears flag)
   - Removed controllerchange auto-reload (no more "2 home page opening")
   - Native OS splash minimized via short manifest name
   - Install sheet no longer shown to installed users (better detection)
   =========================================================== */

(function () {
  'use strict';

  const APP_VERSION = '1.0.4';

  /* ---------- Service Worker registration + update handling ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => {
          console.log('[BB] SW v' + APP_VERSION, reg.scope);
          reg.update().catch(()=>{});
          if (reg.waiting) promptSwUpdate(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                promptSwUpdate(nw);
              }
            });
          });
        })
        .catch(err => console.warn('[BB] SW failed', err));

      // NOTE: Removed auto-reload on controllerchange - was causing double navigation
      // User will manually refresh via update banner button

      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'SW_UPDATED') {
          console.log('[BB] SW updated to', e.data.version);
        }
      });
    });
  }

  function promptSwUpdate(worker){
    if (document.getElementById('bb-update-banner')) return;
    const b = document.createElement('div');
    b.id = 'bb-update-banner';
    b.className = 'bb-update-banner';
    b.innerHTML = `
      <span>Naya update ready hai ✨</span>
      <button class="bb-update-btn" type="button">Refresh</button>`;
    document.body.appendChild(b);
    requestAnimationFrame(()=>b.classList.add('show'));
    b.querySelector('.bb-update-btn').addEventListener('click', () => {
      worker.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(() => window.location.reload(), 400);
    });
  }

  /* ---------- Detection helpers ---------- */
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

  function detectStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true ||
      document.referrer.startsWith('android-app://') ||
      /[?&]utm_source=pwa/.test(location.search);
  }
  const isStandalone = detectStandalone();

  const STORAGE_KEY = 'bb_install_dismissed_at';
  const INSTALLED_KEY = 'bb_installed';
  const HIDE_MS = 3 * 24 * 60 * 60 * 1000;

  function wasRecentlyDismissed() {
    const ts = Number(localStorage.getItem(STORAGE_KEY) || 0);
    return ts && (Date.now() - ts) < HIDE_MS;
  }

  // Persist install status on standalone launch
  if (isStandalone) {
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (e) {}
  }
  let isKnownInstalled = localStorage.getItem(INSTALLED_KEY) === '1';

  /* ---------- Hide install buttons if installed ---------- */
  function hideInstallButtons() {
    document.body.classList.add('bb-installed');
    // Hide by attribute
    document.querySelectorAll('[data-bb-install-trigger], .bb-install-menu-item').forEach(el => {
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('aria-hidden', 'true');
    });
    // Also hide any menu item whose text contains "Install"
    document.querySelectorAll('.drawer-link').forEach(el => {
      const txt = (el.textContent || '').toLowerCase();
      if (txt.includes('install app') || txt.includes('install karein') || txt.includes('📲')) {
        el.style.setProperty('display', 'none', 'important');
      }
    });
  }
  function showInstallButtons() {
    document.body.classList.remove('bb-installed');
    document.querySelectorAll('[data-bb-install-trigger], .bb-install-menu-item').forEach(el => {
      el.style.removeProperty('display');
      el.removeAttribute('aria-hidden');
    });
    document.querySelectorAll('.drawer-link').forEach(el => {
      const txt = (el.textContent || '').toLowerCase();
      if (txt.includes('install app') || txt.includes('install karein') || txt.includes('📲')) {
        el.style.removeProperty('display');
      }
    });
  }

  function refreshInstallUI(){
    if (isStandalone || isKnownInstalled) hideInstallButtons();
    else showInstallButtons();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshInstallUI);
  } else {
    refreshInstallUI();
  }

  // Watch DOM mutations for dynamically added menu items
  const mo = new MutationObserver(() => refreshInstallUI());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  /* ==========================================================
     BRANDED SPLASH
     ========================================================== */
  const SPLASH_SESSION_KEY = 'bb_splash_this_session';

  function showBrandedSplash(){
    const shownThisSession = sessionStorage.getItem(SPLASH_SESSION_KEY) === '1';
    const shouldShow = isStandalone || !shownThisSession;
    if(!shouldShow) return;
    try { sessionStorage.setItem(SPLASH_SESSION_KEY, '1'); } catch(e){}

    const old = document.getElementById('bb-splash');
    if (old) old.remove();

    const splash = document.createElement('div');
    splash.id = 'bb-splash';
    splash.innerHTML = `
      <div class="bb-splash-bg">
        <div class="bb-splash-blob bb-blob-1"></div>
        <div class="bb-splash-blob bb-blob-2"></div>
        <div class="bb-splash-blob bb-blob-3"></div>
      </div>
      <div class="bb-splash-content">
        <div class="bb-splash-mascot-wrap">
          <div class="bb-splash-ring"></div>
          <img src="assets/mascot-coin.png" alt="BaatBanao" class="bb-splash-mascot"/>
          <span class="bb-splash-coin bb-splash-coin-1">₹</span>
          <span class="bb-splash-coin bb-splash-coin-2">💸</span>
          <span class="bb-splash-coin bb-splash-coin-3">₹</span>
        </div>
        <h1 class="bb-splash-logo">
          <span>B</span><span>a</span><span>a</span><span>t</span><span>B</span><span>a</span><span>n</span><span>a</span><span>o</span>
        </h1>
        <p class="bb-splash-tag">Paisa bhi wapas, rishta bhi safe <span class="bb-emoji-wink">😄</span></p>
        <div class="bb-splash-dots"><span></span><span></span><span></span></div>
        <p class="bb-splash-madein">
          <span class="bb-flag" aria-label="India">
            <svg viewBox="0 0 60 40" width="18" height="12">
              <rect width="60" height="13.3" y="0" fill="#FF9933"/>
              <rect width="60" height="13.3" y="13.3" fill="#FFFFFF"/>
              <rect width="60" height="13.4" y="26.6" fill="#138808"/>
              <circle cx="30" cy="20" r="4" fill="none" stroke="#000080" stroke-width="0.6"/>
            </svg>
          </span>
          Made in Bharat with ❤️
        </p>
      </div>`;
    document.body.appendChild(splash);
    setTimeout(() => splash.classList.add('bb-fade-out'), 1700);
    setTimeout(() => splash.remove(), 2300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBrandedSplash);
  } else {
    showBrandedSplash();
  }

  /* ---------- Deferred prompt ---------- */
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // 🔑 CRITICAL FIX: If browser fires this event, app is NOT installed.
    // Clear stale INSTALLED_KEY (handles uninstall case).
    if (!isStandalone) {
      try { localStorage.removeItem(INSTALLED_KEY); } catch (err) {}
      isKnownInstalled = false;
      refreshInstallUI();
    }
    e.preventDefault();
    deferredPrompt = e;
    console.log('[BB] Install available');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallUI();
    try {
      localStorage.setItem(INSTALLED_KEY, '1');
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    isKnownInstalled = true;
    hideInstallButtons();
    toast('BaatBanao install ho gaya! 🎉 Home screen check karo.');
  });

  const mm = window.matchMedia('(display-mode: standalone)');
  const onDisplayChange = (e) => {
    if (e.matches) {
      hideInstallButtons();
      try { localStorage.setItem(INSTALLED_KEY, '1'); } catch(err){}
      isKnownInstalled = true;
    }
  };
  if (mm.addEventListener) mm.addEventListener('change', onDisplayChange);
  else if (mm.addListener) mm.addListener(onDisplayChange);

  /* ---------- Public API ---------- */
  window.BB_Install = {
    trigger: triggerInstall,
    show: () => {
      // If app is genuinely open in installed mode → just say so
      if (isStandalone) {
        return toast('Aap already installed app use kar rahe hain! 🎉');
      }
      // If we THINK it's installed but browser fires beforeinstallprompt → it's not
      // Check deferredPrompt: if available, definitely can install
      if (deferredPrompt) return triggerInstall();
      // If iOS → show iOS instructions
      if (isIOS) return showInstallUI('ios');
      // Fallback
      if (isKnownInstalled) {
        return toast('App shayad already installed hai. Home screen check karo 🏠');
      }
      showInstallUI('generic');
    },
    isInstalled: () => isStandalone || isKnownInstalled,
    reset: () => {
      // For debugging — reset install state
      try {
        localStorage.removeItem(INSTALLED_KEY);
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      isKnownInstalled = false;
      showInstallButtons();
      toast('Install state reset ho gaya ✅');
    },
    version: APP_VERSION
  };

  function triggerInstall() {
    if (!deferredPrompt) {
      if (isIOS) return showInstallUI('ios');
      return showInstallUI('generic');
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        toast('BaatBanao install ho raha hai ⏳');
      } else {
        try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) {}
      }
      deferredPrompt = null;
      hideInstallUI();
    });
  }

  /* ---------- Install bottom sheet ---------- */
  function createBannerHTML(mode) {
    const iosSteps = `
      <ol class="bb-ios-steps">
        <li><span class="bb-step-num">1</span> Neeche <b>Share</b> button dabaayein
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M20 21H4a1 1 0 0 1-1-1v-9"/></svg>
        </li>
        <li><span class="bb-step-num">2</span> Scroll karke <b>"Add to Home Screen"</b> chunein</li>
        <li><span class="bb-step-num">3</span> <b>Add</b> pe tap karein — bas ho gaya! ✅</li>
      </ol>`;
    const genericSteps = `
      <p class="bb-note">Chrome ke <b>menu (⋮)</b> se <b>"Install app"</b> ya <b>"Add to Home Screen"</b> select karein.</p>`;

    const inner = mode === 'ios' ? iosSteps : (mode === 'android' ? '' : genericSteps);

    return `
      <div class="bb-install-scrim" data-bb-close></div>
      <div class="bb-install-sheet" role="dialog" aria-labelledby="bb-install-title">
        <button class="bb-close" aria-label="Close" data-bb-close>&times;</button>
        <div class="bb-install-head">
          <img src="assets/icon-192.png" alt="BaatBanao" class="bb-install-icon"/>
          <div>
            <h3 id="bb-install-title">BaatBanao install karein</h3>
            <p class="bb-install-sub">Phone ki home screen pe app jaisa icon milega</p>
          </div>
        </div>
        <ul class="bb-trust">
          <li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>Sirf <b>~1&nbsp;MB</b> — data bachega</span></li>
          <li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg><span><b>100% safe</b> — koi login nahi, data phone mein rehta hai</span></li>
          <li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg><span>Offline bhi chalega, ek tap mein khulega</span></li>
          <li><span class="bb-flag" style="display:inline-flex;align-items:center;flex-shrink:0"><svg viewBox="0 0 60 40" width="18" height="12"><rect width="60" height="13.3" y="0" fill="#FF9933"/><rect width="60" height="13.3" y="13.3" fill="#FFFFFF"/><rect width="60" height="13.4" y="26.6" fill="#138808"/><circle cx="30" cy="20" r="4" fill="none" stroke="#000080" stroke-width="0.6"/></svg></span><span>Made in <b>Bharat</b> — apne desh ke liye</span></li>
        </ul>
        ${inner}
        <div class="bb-install-actions">
          ${mode === 'android'
            ? `<button class="bb-primary" id="bb-install-go" type="button">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
                  Install BaatBanao
               </button>`
            : `<button class="bb-primary" type="button" data-bb-close>Samajh gaya</button>`
          }
          <button class="bb-ghost" type="button" data-bb-close>Baad mein</button>
        </div>
        <p class="bb-tiny">Ye ek Progressive Web App hai. Play Store ki zarurat nahi.</p>
      </div>`;
  }

  function showInstallUI(mode) {
    if (isStandalone) return;
    if (wasRecentlyDismissed() && !window._bbForceInstall) return;
    hideInstallUI();

    const finalMode = (mode === 'android' && !deferredPrompt) ? 'generic' : mode;

    const wrap = document.createElement('div');
    wrap.className = 'bb-install-wrap';
    wrap.id = 'bb-install-wrap';
    wrap.innerHTML = createBannerHTML(finalMode);
    document.body.appendChild(wrap);

    wrap.querySelectorAll('[data-bb-close]').forEach(el => {
      el.addEventListener('click', () => {
        try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) {}
        hideInstallUI();
      });
    });
    const go = wrap.querySelector('#bb-install-go');
    if (go) go.addEventListener('click', triggerInstall);

    requestAnimationFrame(() => wrap.classList.add('bb-show'));
  }

  function hideInstallUI() {
    const el = document.getElementById('bb-install-wrap');
    if (el) { el.classList.remove('bb-show'); setTimeout(() => el.remove(), 220); }
  }

  /* ---------- TOAST QUEUE ---------- */
  const toastQueue = [];
  let toastActive = false;
  function toast(msg) {
    // De-dupe: don't queue same message back-to-back
    if (toastQueue[toastQueue.length - 1] === msg) return;
    toastQueue.push(msg);
    if (!toastActive) processToast();
  }
  function processToast(){
    if (!toastQueue.length) { toastActive = false; return; }
    toastActive = true;
    const msg = toastQueue.shift();
    if (typeof window.showToast === 'function') {
      window.showToast(msg);
      setTimeout(processToast, 2600);
      return;
    }
    const t = document.createElement('div');
    t.className = 'bb-toast'; t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(()=>{ t.remove(); processToast(); }, 300);
    }, 2400);
  }

  /* ---------- iOS auto-nudge ---------- */
  if (isIOS && !isStandalone && !isKnownInstalled && !wasRecentlyDismissed()) {
    let hashChanges = 0;
    window.addEventListener('hashchange', () => {
      hashChanges++;
      if (hashChanges >= 2) showInstallUI('ios');
    });
    setTimeout(() => showInstallUI('ios'), 25000);
  }

  /* ---------- Install trigger buttons ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bb-install-trigger]');
    if (btn) {
      e.preventDefault();
      window._bbForceInstall = true;
      window.BB_Install.show();
      window._bbForceInstall = false;
    }
  });

})();
