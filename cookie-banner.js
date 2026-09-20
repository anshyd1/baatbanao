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
    // Disabled to prevent blocking mobile CTAs and lower bounce rate
    return;
  }

  // expose for debug / QA
  try { window.BBConsent = { get: getConsent, hasOldSeen: hasOldSeen }; } catch(e){}

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
  else showBanner();
})();
