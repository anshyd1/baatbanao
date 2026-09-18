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
    el.style.cssText = 'position:fixed;left:50%;right:auto;bottom:10px;transform:translateX(-50%);width:calc(100% - 20px);max-width:520px;z-index:99998;background:#fffdf8;border:1px solid #f0dfcf;border-radius:14px;box-shadow:0 10px 28px rgba(38,24,24,.16);padding:8px 10px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#261818;display:flex;align-items:center;gap:10px;';
    el.innerHTML = '' +
      '<div style="flex:1;min-width:0;font-size:11.5px;line-height:1.35;color:#6b6058;"><b style="color:#261818;">🍪 Cookies:</b> analytics/ads ke liye use hote hain.</div>' +
      '<div style="display:flex;gap:6px;flex:none;">' +
        '<button id="bb-cookie-ok" style="border:none;border-radius:12px;padding:7px 12px;background:#FF725F;color:#fff;font-weight:800;cursor:pointer;">OK</button>' +
        '<a href="/privacy" style="text-decoration:none;border:1px solid #eadccf;border-radius:12px;padding:7px 12px;background:#fff6ef;color:#261818;font-weight:800;">Privacy</a>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('bb-cookie-ok').onclick = function(){ markSeen(); closeBanner(); };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
  else showBanner();
})();
