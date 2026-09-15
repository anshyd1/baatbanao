(function(){
  'use strict';

  var config = window.BAATBANAO_ANALYTICS || {};
  var GA_ID = String(config.ga4MeasurementId || '').trim();
  var REQUIRE_CONSENT = config.requireConsent !== false;
  var CONSENT_KEY = 'bb_analytics_consent_v1';
  var BANNER_ID = 'bb-analytics-banner';
  var pageviewBound = false;

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
  function updateConsent(status){
    ensureDataLayer();
    var granted = status === 'granted';
    window.gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }
  function sendPageView(){
    if(typeof window.gtag !== 'function' || !GA_ID) return;
    if(getConsent() !== 'granted' && REQUIRE_CONSENT) return;
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: location.href,
      page_path: location.pathname + location.search + location.hash
    });
  }
  function bindPageViews(){
    if(pageviewBound) return;
    pageviewBound = true;
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
      '<div style="font-size:12.8px;line-height:1.5;color:#6b6058;">Hum site improve karne ke liye privacy-safe analytics use karna chahte hain. Aapka naam, phone, ya reminder content analytics me nahi bheja jayega.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
        '<button id="bb-analytics-allow" style="border:none;border-radius:12px;padding:10px 14px;background:#FF725F;color:#fff;font-weight:800;cursor:pointer;">Allow analytics</button>' +
        '<button id="bb-analytics-deny" style="border:1px solid #eadccf;border-radius:12px;padding:10px 14px;background:#fff6ef;color:#261818;font-weight:800;cursor:pointer;">Not now</button>' +
      '</div>';
    document.body.appendChild(wrap);
    document.getElementById('bb-analytics-allow').onclick = function(){
      setConsent('granted');
      updateConsent('granted');
      removeBanner();
      bindPageViews();
      sendPageView();
    };
    document.getElementById('bb-analytics-deny').onclick = function(){
      setConsent('denied');
      updateConsent('denied');
      removeBanner();
    };
  }

  window.BBAnalytics = {
    grant: function(){ setConsent('granted'); updateConsent('granted'); removeBanner(); bindPageViews(); sendPageView(); },
    deny: function(){ setConsent('denied'); updateConsent('denied'); removeBanner(); },
    reset: function(){ setConsent(''); updateConsent('denied'); removeBanner(); if(GA_ID) showBanner(); },
    status: function(){ return { measurementId: GA_ID || null, consent: getConsent() || 'unset', gtagLoaded: !!window.gtag }; }
  };

  if(!GA_ID) {
    console.info('[BaatBanao] GA4 disabled until a Measurement ID is added in analytics-config.js');
    return;
  }

  ensureDataLayer();
  bindPageViews();

  var consent = getConsent();
  if(!REQUIRE_CONSENT) {
    setConsent('granted');
    updateConsent('granted');
    sendPageView();
    return;
  }
  if(consent === 'granted') {
    updateConsent('granted');
    sendPageView();
    return;
  }
  updateConsent('denied');
  if(consent === 'denied') return;

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }
})();
