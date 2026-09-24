(function(){
  'use strict';
  var OLD_KEY = 'bb_cookie_notice_seen_v1';
  var CONSENT_KEY = 'bb_cookie_consent_v2';
  var ID = 'bb-cookie-banner';

  function getConsent(){
    try { return localStorage.getItem(CONSENT_KEY); } catch(e){ return null; }
  }
  function hasOldSeen(){
    try { return localStorage.getItem(OLD_KEY) === '1'; } catch(e){ return false; }
  }
  function seen(){
    var c = getConsent();
    if(c === 'accepted' || c === 'rejected') return true;
    if(hasOldSeen()){
      // migrate old OK to accepted to avoid re-prompting existing users
      try { localStorage.setItem(CONSENT_KEY, 'accepted'); } catch(e){}
      return true;
    }
    return false;
  }
  function markSeen(val){
    try {
      localStorage.setItem(OLD_KEY, '1');
      localStorage.setItem(CONSENT_KEY, val);
    } catch(e){}
    try {
      var evName = val === 'accepted' ? 'bb-consent-accepted' : 'bb-consent-rejected';
      window.dispatchEvent(new CustomEvent(evName, { detail: { consent: val } }));
    } catch(e){}
  }
  function closeBanner(){
    var el = document.getElementById(ID);
    if(el) el.remove();
  }
  function showBanner(){
    // FIX: banner was disabled (return) — that broke GA4 (0 requests) and AdSense CMP requirement.
    // Re-enabled with small, non-blocking bottom sheet. Does not block CTAs.
    if(seen() || document.getElementById(ID)) return;
    var el = document.createElement('div');
    el.id = ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Cookie consent');
    el.style.cssText = 'position:fixed;left:50%;right:auto;bottom:10px;transform:translateX(-50%);width:calc(100% - 20px);max-width:560px;z-index:99998;background:#fffdf8;border:1px solid #f0dfcf;border-radius:14px;box-shadow:0 10px 28px rgba(38,24,24,.16);padding:8px 10px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#261818;display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
    el.innerHTML = '' +
      '<div style="flex:1;min-width:160px;font-size:11.5px;line-height:1.35;color:#6b6058;"><b style="color:#261818;">🍪 Cookies:</b> analytics & ads ke liye use hote hain. Accept = better experience. <a href="/privacy" style="color:#8a3b32;text-decoration:underline;">Privacy</a></div>' +
      '<div style="display:flex;gap:6px;flex:none;align-items:center;">' +
        '<button id="bb-cookie-reject" style="border:1px solid #eadccf;border-radius:12px;padding:7px 12px;background:#fff6ef;color:#261818;font-weight:800;cursor:pointer;">Reject</button>' +
        '<button id="bb-cookie-ok" style="border:none;border-radius:12px;padding:7px 14px;background:#FF725F;color:#fff;font-weight:800;cursor:pointer;">Accept</button>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('bb-cookie-ok').onclick = function(){ markSeen('accepted'); closeBanner(); };
    document.getElementById('bb-cookie-reject').onclick = function(){ markSeen('rejected'); closeBanner(); };
  }

  // expose for debug / QA
  try { window.BBConsent = { get: getConsent, hasOldSeen: hasOldSeen }; } catch(e){}

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
  else showBanner();
})();
