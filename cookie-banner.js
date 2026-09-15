(function(){
  'use strict';
  var KEY = 'bb_cookie_notice_seen_v1';
  var ID = 'bb-cookie-banner';

  function seen(){
    try { return localStorage.getItem(KEY) === '1'; }
    catch(e){ return false; }
  }
  function markSeen(){
    try { localStorage.setItem(KEY, '1'); } catch(e){}
  }
  function closeBanner(){
    var el = document.getElementById(ID);
    if(el) el.remove();
  }
  function showBanner(){
    if(seen() || document.getElementById(ID)) return;
    var el = document.createElement('div');
    el.id = ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99998;background:#fffdf8;border:1px solid #f0dfcf;border-radius:18px;box-shadow:0 14px 36px rgba(38,24,24,.16);padding:14px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#261818;';
    el.innerHTML = '' +
      '<div style="font-weight:900;font-size:14px;margin-bottom:6px;">🍪 Cookies notice</div>' +
      '<div style="font-size:12.8px;line-height:1.5;color:#6b6058;">Ye site analytics aur ads ke liye cookies ya similar browser storage use kar sakti hai. Naam, phone, ya reminder content cookie banner ke through collect nahi hota.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
        '<button id="bb-cookie-ok" style="border:none;border-radius:12px;padding:10px 14px;background:#FF725F;color:#fff;font-weight:800;cursor:pointer;">OK</button>' +
        '<a href="/privacy" style="text-decoration:none;border:1px solid #eadccf;border-radius:12px;padding:10px 14px;background:#fff6ef;color:#261818;font-weight:800;">Privacy</a>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('bb-cookie-ok').onclick = function(){ markSeen(); closeBanner(); };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
  else showBanner();
})();
