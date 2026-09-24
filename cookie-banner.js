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
    // Compact, non-blocking consent chip (shown after a short delay so first CTA stays free).
    if(seen() || document.getElementById(ID)) return;
    setTimeout(function tryShow(){
      if(seen() || document.getElementById(ID)) return;
      if(document.getElementById('bb-update-banner')){ setTimeout(tryShow, 5000); return; }
      var inApp = !!document.querySelector('.bottom-nav');
      var el = document.createElement('div');
      el.id = ID;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', 'Cookie consent');
      el.style.cssText = 'position:fixed;left:10px;right:10px;bottom:' + (inApp ? '86px' : '12px') + ';z-index:100050;max-width:460px;margin:0 auto;background:#2b2420;color:#fff;border-radius:14px;padding:10px 12px;display:flex;align-items:center;gap:10px;font:600 12.5px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)';
      el.innerHTML = '<span style="flex:1">Hum analytics cookies se app behtar banate hain. <a href="/privacy" style="color:#ffc7bd">Privacy</a></span>' +
        '<button type="button" data-v="rejected" style="border:0;background:transparent;color:#d9cfc8;font:700 12.5px inherit;padding:8px 6px;cursor:pointer">Nahi</button>' +
        '<button type="button" data-v="accepted" style="border:0;background:#FF6B57;color:#fff;font:800 12.5px inherit;padding:8px 14px;border-radius:10px;cursor:pointer">OK</button>';
      el.addEventListener('click', function(e){
        var b = e.target.closest('button[data-v]');
        if(!b) return;
        markSeen(b.getAttribute('data-v'));
        closeBanner();
      });
      document.body.appendChild(el);
    }, 4000);
  }

  // expose for debug / QA
  try { window.BBConsent = { get: getConsent, hasOldSeen: hasOldSeen }; } catch(e){}

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
  else showBanner();
})();
