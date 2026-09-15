(function(){
  'use strict';

  var config = window.BAATBANAO_ANALYTICS || {};
  var GA_ID = String(config.ga4MeasurementId || '').trim();
  var REQUIRE_CONSENT = config.requireConsent !== false;
  var CONSENT_KEY = 'bb_analytics_consent_v1';
  var BANNER_ID = 'bb-analytics-banner';
  var gaLoaded = false;

  function getConsent(){
    try { return localStorage.getItem(CONSENT_KEY) || ''; }
    catch(e){ return ''; }
  }
  function setConsent(value){
    try { localStorage.setItem(CONSENT_KEY, value); }
    catch(e){}
  }
  function removeBanner(){
    var el = document.getElementById(BANNER_ID);
    if(el) el.remove();
  }
  function ensureDataLayer(){
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ dataLayer.push(arguments); };
  }
  function sendPageView(){
    if(typeof window.gtag !== 'function' || !GA_ID) return;
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: location.href,
      page_path: location.pathname + location.search + location.hash
    });
  }
  function loadGA(){
    if(gaLoaded || !GA_ID) return;
    gaLoaded = true;
    ensureDataLayer();
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      send_page_view: false,
      allow_google_signals: false
    });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    sendPageView();
    window.addEventListener('hashchange', function(){ setTimeout(sendPageView, 0); });
    window.addEventListener('popstate', sendPageView);
  }
  function showBanner(){
    if(!GA_ID || document.getElementById(BANNER_ID)) return;
    var wrap = document.createElement('div');
    wrap.id = BANNER_ID;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-live', 'polite');
    wrap.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#fffdf8;color:#261818;border:1px solid #f0dfcf;border-radius:18px;box-shadow:0 14px 36px rgba(38,24,24,.18);padding:14px 14px 12px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;';
    wrap.innerHTML = '' +
      '<div style="font-weight:900;font-size:14px;margin-bottom:6px;">📊 Analytics permission</div>' +
      '<div style="font-size:12.8px;line-height:1.5;color:#6b6058;">Hum site improve karne ke liye anonymous analytics use karna chahte hain. Aapka naam, phone, ya reminder content analytics me nahi bheja jayega.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
        '<button id="bb-analytics-allow" style="border:none;border-radius:12px;padding:10px 14px;background:#FF725F;color:#fff;font-weight:800;cursor:pointer;">Allow analytics</button>' +
        '<button id="bb-analytics-deny" style="border:1px solid #eadccf;border-radius:12px;padding:10px 14px;background:#fff6ef;color:#261818;font-weight:800;cursor:pointer;">Not now</button>' +
      '</div>';
    document.body.appendChild(wrap);
    document.getElementById('bb-analytics-allow').onclick = function(){
      setConsent('granted');
      removeBanner();
      loadGA();
    };
    document.getElementById('bb-analytics-deny').onclick = function(){
      setConsent('denied');
      removeBanner();
    };
  }

  window.BBAnalytics = {
    grant: function(){ setConsent('granted'); removeBanner(); loadGA(); },
    deny: function(){ setConsent('denied'); removeBanner(); },
    reset: function(){ setConsent(''); removeBanner(); if(GA_ID) showBanner(); },
    status: function(){ return { measurementId: GA_ID || null, consent: getConsent() || 'unset', loaded: gaLoaded }; }
  };

  if(!GA_ID) {
    console.info('[BaatBanao] GA4 disabled until a Measurement ID is added in analytics-config.js');
    return;
  }

  var consent = getConsent();
  if(!REQUIRE_CONSENT || consent === 'granted') {
    loadGA();
    return;
  }
  if(consent === 'denied') return;

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }
})();
