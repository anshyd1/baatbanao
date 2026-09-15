(function(){
  'use strict';

  var config = window.BAATBANAO_ANALYTICS || {};
  var GA_ID = String(config.ga4MeasurementId || '').trim();
  var pageviewBound = false;
  var scriptLoaded = false;

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

  function bindPageViews(){
    if(pageviewBound) return;
    pageviewBound = true;
    window.addEventListener('hashchange', function(){ setTimeout(sendPageView, 0); });
    window.addEventListener('popstate', sendPageView);
  }

  function loadGA(){
    if(scriptLoaded || !GA_ID) return;
    scriptLoaded = true;
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
    bindPageViews();
    sendPageView();
  }

  window.BBAnalytics = {
    status: function(){ return { measurementId: GA_ID || null, gtagLoaded: !!window.gtag }; },
    pageview: sendPageView
  };

  if(!GA_ID) {
    console.info('[BaatBanao] GA4 disabled until a Measurement ID is added in analytics-config.js');
    return;
  }

  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGA);
  } else {
    loadGA();
  }
})();
