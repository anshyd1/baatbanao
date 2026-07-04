/* ===========================================================
   BaatBanao — Install + Update Manager v1.0.6
   NUCLEAR TOAST FIX:
   - No queue — max 1 toast at a time (new replaces old)
   - "Installing..." toast REMOVED forever (only success shows)
   - App's own showToast() overridden to prevent duplicates
   - Aggressive ghost toast cleanup on load
   =========================================================== */

(function () {
  'use strict';

  const APP_VERSION = '1.0.19';

  /* ---------- NUKE ALL EXISTING TOASTS ON LOAD ---------- */
  function nukeAllToasts(){
    // Remove all rogue toast elements
    document.querySelectorAll('.bb-toast, #toast, [class*="toast"]').forEach(el => {
      if (el.id === 'toast') {
        el.textContent = '';
        el.className = el.className.replace(/\bshow\b/g, '').trim();
      } else if (el.classList && el.classList.contains('bb-toast')) {
        el.remove();
      }
    });
  }
  // Nuke immediately + after DOM ready + after 500ms + after 2s (catch delayed)
  nukeAllToasts();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', nukeAllToasts);
  }
  setTimeout(nukeAllToasts, 500);
  setTimeout(nukeAllToasts, 2000);

  /* ---------- Override app.js showToast if it exists (prevent old messages) ---------- */
  let _origShowToast = null;
  function installToastGuard(){
    if (typeof window.showToast === 'function' && !window.showToast.__bbGuarded) {
      _origShowToast = window.showToast;
      const guardedToast = function(msg){
        // Block known ghost messages
        if (typeof msg === 'string' && (
          msg.includes('Installing BaatBanao') ||
          msg.includes('install ho raha')
        )) {
          console.log('[BB] Blocked ghost toast:', msg);
          return;
        }
        // Show through native, but ensure only 1 at a time
        nukeAllToasts();
        return _origShowToast(msg);
      };
      guardedToast.__bbGuarded = true;
      window.showToast = guardedToast;
    }
  }
  installToastGuard();
  setTimeout(installToastGuard, 200);
  setTimeout(installToastGuard, 1000);

  /* ---------- Service Worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => {
          console.log('[BB] SW v' + APP_VERSION);
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

  /* ---------- Detection ---------- */
  const ua = navigator.userAgent || '';

  // Bug fix #3: iPadOS 13+ reports itself as "Macintosh" in the UA string
  // (desktop-mode default), so the old /iPad|iPhone|iPod/ regex alone
  // misses newer iPads. Add a touch-capable Mac check as a fallback.
  const isIOS = (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Bug fix #1: In-app browsers (Instagram, Facebook, WhatsApp, Line,
  // WeChat) never fire `beforeinstallprompt` and often hide/restrict the
  // native browser chrome (Share button etc.), so PWA install is not
  // actually possible inside them — even though our button still shows.
  // Detect these via known UA substrings so we can show an honest message
  // instead of broken/misleading install instructions.
  const isInAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|WhatsApp\/|Snapchat|Pinterest/i.test(ua);

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

  if (isStandalone) {
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (e) {}
  }
  let isKnownInstalled = localStorage.getItem(INSTALLED_KEY) === '1';

  /* ---------- Hide/show install buttons ---------- */
  function hideInstallButtons() {
    document.body.classList.add('bb-installed');
    document.querySelectorAll('[data-bb-install-trigger], .bb-install-menu-item').forEach(el => {
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('.drawer-link').forEach(el => {
      const txt = (el.textContent || '').toLowerCase();
      if (txt.includes('install app') || txt.includes('📲')) {
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
      if (txt.includes('install app') || txt.includes('📲')) {
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

  const mo = new MutationObserver(() => refreshInstallUI());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- Deferred prompt (DEBOUNCED) ---------- */
  let deferredPrompt = null;
  let promptEventCount = 0;

  window.addEventListener('beforeinstallprompt', (e) => {
    promptEventCount++;
    if (!isStandalone && promptEventCount === 1) {
      try { localStorage.removeItem(INSTALLED_KEY); } catch (err) {}
      isKnownInstalled = false;
      refreshInstallUI();
    }
    e.preventDefault();
    deferredPrompt = e;
    // NO TOAST HERE — user hasn't asked yet
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
    // Chrome ka native "Installing BaatBanao..." toast enough hai.
    // Apni koi toast nahi — sirf background me stray toasts clean karo.
    nukeAllToasts();
    setTimeout(nukeAllToasts, 500);
    setTimeout(nukeAllToasts, 1500);
    setTimeout(nukeAllToasts, 3000);
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
      if (isStandalone) return showSingleToast('Aap already installed app use kar rahe hain! 🎉');
      // Bug fix #1: check in-app browser FIRST — even if a stray
      // `deferredPrompt` somehow exists, most in-app webviews will not
      // actually complete an install, so we must not attempt it silently.
      if (isInAppBrowser) return showInstallUI('inapp');
      if (deferredPrompt) return triggerInstall();
      if (isIOS) return showInstallUI('ios');
      if (isKnownInstalled) return showSingleToast('App shayad already installed hai 🏠');
      showInstallUI('generic');
    },
    isInstalled: () => isStandalone || isKnownInstalled,
    reset: () => {
      try {
        localStorage.removeItem(INSTALLED_KEY);
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      isKnownInstalled = false;
      showInstallButtons();
      showSingleToast('Install state reset ✅');
    },
    nukeToasts: nukeAllToasts,
    version: APP_VERSION
  };

  function triggerInstall() {
    if (isInAppBrowser) return showInstallUI('inapp');
    if (!deferredPrompt) {
      if (isIOS) return showInstallUI('ios');
      return showInstallUI('generic');
    }
    // NO "installing" toast — user sees native Chrome prompt anyway
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      if (choice.outcome !== 'accepted') {
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

    // Bug fix #2: Old copy hardcoded "Chrome ke menu se..." which is wrong
    // for Firefox, Samsung Internet, Edge, Opera, etc. Made browser-agnostic.
    const genericSteps = `
      <p class="bb-note">Apne browser ke <b>menu (⋮ ya ≡)</b> se <b>"Install app"</b> ya <b>"Add to Home Screen"</b> dhoondh kar select karein.</p>`;

    // Bug fix #1: In-app browsers (Instagram/Facebook/WhatsApp webviews)
    // cannot install PWAs at all — show an honest message telling the user
    // to open the link in their real browser first, instead of broken/
    // misleading install steps.
    const inAppSteps = `
      <p class="bb-note">Ye link ek app (Instagram/Facebook/WhatsApp) ke andar khula hai, jahan install karna possible nahi hai.</p>
      <ol class="bb-ios-steps">
        <li><span class="bb-step-num">1</span> Upar-right corner mein <b>⋮</b> ya <b>"..."</b> button dhoondein</li>
        <li><span class="bb-step-num">2</span> <b>"Browser mein kholein"</b> ya <b>"Open in Chrome/Safari"</b> chunein</li>
        <li><span class="bb-step-num">3</span> Wahan se dubara <b>Install</b> try karein ✅</li>
      </ol>`;

    const inner = mode === 'inapp' ? inAppSteps : (mode === 'ios' ? iosSteps : (mode === 'android' ? '' : genericSteps));

    return `
      <div class="bb-install-scrim" data-bb-close></div>
      <div class="bb-install-sheet" role="dialog" aria-labelledby="bb-install-title">
        <button class="bb-close" aria-label="Close" data-bb-close>&times;</button>
        <div class="bb-install-head">
          <img src="assets/icon-192.png" alt="BaatBanao" class="bb-install-icon"/>
          <div>
            <h3 id="bb-install-title">${mode === 'inapp' ? 'Pehle browser mein kholein' : 'BaatBanao install karein'}</h3>
            <p class="bb-install-sub">${mode === 'inapp' ? 'In-app browser se install nahi ho sakta' : 'Phone ki home screen pe app jaisa icon milega'}</p>
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

  /* ---------- SINGLE TOAST (no queue, always replaces) ---------- */
  let currentToastEl = null;
  let currentToastTimer = null;

  function showSingleToast(msg) {
    // Kill any existing toast (mine OR app's)
    nukeAllToasts();
    if (currentToastTimer) { clearTimeout(currentToastTimer); currentToastTimer = null; }
    if (currentToastEl) { try { currentToastEl.remove(); } catch(e){} }

    const t = document.createElement('div');
    t.className = 'bb-toast'; t.textContent = msg;
    document.body.appendChild(t);
    currentToastEl = t;
    requestAnimationFrame(() => t.classList.add('show'));
    currentToastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(()=>{ t.remove(); if (currentToastEl === t) currentToastEl = null; }, 300);
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
