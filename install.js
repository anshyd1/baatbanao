/* ===========================================================
   BaatBanao — Professional Install Experience
   - Registers Service Worker
   - Custom Install Button (Android / Desktop Chrome)
   - iOS Safari "Add to Home Screen" instructions modal
   - Trust cues: size, offline, safe, made in India
   =========================================================== */

(function () {
  'use strict';

  /* ---------- Register Service Worker ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('[BB] SW registered', reg.scope))
        .catch(err => console.warn('[BB] SW failed', err));
    });
  }

  /* ---------- Detection helpers ---------- */
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/i.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://');

  const STORAGE_KEY = 'bb_install_dismissed_at';
  const HIDE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days snooze

  function wasRecentlyDismissed() {
    const ts = Number(localStorage.getItem(STORAGE_KEY) || 0);
    return ts && (Date.now() - ts) < HIDE_MS;
  }

  /* ---------- Deferred prompt (Android / Chrome) ---------- */
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallUI('android');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallUI();
    toast('BaatBanao install ho gaya! 🎉 Home screen check karo.');
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  });

  /* ---------- Public API ---------- */
  window.BB_Install = {
    trigger: triggerInstall,
    show: () => {
      if (isIOS && !isStandalone) showInstallUI('ios');
      else if (deferredPrompt) triggerInstall();
      else showInstallUI(isIOS ? 'ios' : 'generic');
    },
    isStandalone: () => isStandalone
  };

  function triggerInstall() {
    if (!deferredPrompt) {
      if (isIOS) return showInstallUI('ios');
      return showInstallUI('generic');
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        toast('BaatBanao install ho raha hai... ⏳');
      } else {
        try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (e) {}
      }
      deferredPrompt = null;
      hideInstallUI();
    });
  }

  /* ---------- UI ---------- */
  function createBannerHTML(mode) {
    const iosSteps = `
      <ol class="bb-ios-steps">
        <li><span class="bb-step-num">1</span> Neeche <b>Share</b> button dabaayein
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M20 21H4a1 1 0 0 1-1-1v-9"/></svg>
        </li>
        <li><span class="bb-step-num">2</span> Scroll karke <b>“Add to Home Screen”</b> chunein</li>
        <li><span class="bb-step-num">3</span> <b>Add</b> pe tap karein — bas ho gaya! ✅</li>
      </ol>`;

    const genericSteps = `
      <p class="bb-note">Aapka browser install button abhi support nahi karta.<br>
      Menu (⋮) → <b>"Install app"</b> ya <b>"Add to Home Screen"</b> select karein.</p>`;

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
          <li>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            <span>Sirf <b>~1&nbsp;MB</b> — data bachega</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>
            <span><b>100% safe</b> — koi login nahi, data phone mein rehta hai</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            <span>Offline bhi chalega, ek tap mein khulega</span>
          </li>
          <li>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/></svg>
            <span>Made in India 🇮🇳 — Bharat ke liye</span>
          </li>
        </ul>

        ${inner}

        <div class="bb-install-actions">
          ${mode === 'android'
            ? `<button class="bb-primary" id="bb-install-go">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
                  Install BaatBanao
               </button>`
            : `<button class="bb-primary" data-bb-close>Samajh gaya</button>`
          }
          <button class="bb-ghost" data-bb-close>Baad mein</button>
        </div>

        <p class="bb-tiny">Ye ek Progressive Web App hai. Play Store ki zarurat nahi.</p>
      </div>`;
  }

  function showInstallUI(mode) {
    if (isStandalone) return;
    if (wasRecentlyDismissed() && !window._bbForceInstall) return;
    hideInstallUI();

    const wrap = document.createElement('div');
    wrap.className = 'bb-install-wrap';
    wrap.id = 'bb-install-wrap';
    wrap.innerHTML = createBannerHTML(mode);
    document.body.appendChild(wrap);

    // events
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

  /* ---------- Toast (falls back if app toast not ready) ---------- */
  function toast(msg) {
    if (typeof window.showToast === 'function') return window.showToast(msg);
    const t = document.createElement('div');
    t.className = 'bb-toast'; t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(()=>t.remove(),300); }, 2500);
  }

  /* ---------- Auto-nudge on iOS after real engagement ---------- */
  if (isIOS && !isStandalone && !wasRecentlyDismissed()) {
    // wait 25s or 2 page changes — whichever first
    let hashChanges = 0;
    window.addEventListener('hashchange', () => {
      hashChanges++;
      if (hashChanges >= 2) showInstallUI('ios');
    });
    setTimeout(() => showInstallUI('ios'), 25000);
  }

  /* ---------- Wire up header button if present ---------- */
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
