(function(){
  'use strict';

  var config = window.BAATBANAO_ANALYTICS || {};
  var GA_ID = String(config.ga4MeasurementId || '').trim();
  var pageviewBound = false;
  var scriptLoaded = false;
  var clickBound = false;

  function ensureDataLayer(){
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ dataLayer.push(arguments); };
  }

  function sanitizeValue(value){
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value.slice(0, 100);
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return String(value).slice(0, 100);
  }

  function track(eventName, params){
    if(typeof window.gtag !== 'function' || !GA_ID || !eventName) return;
    var clean = {};
    params = params || {};
    Object.keys(params).forEach(function(key){
      var val = sanitizeValue(params[key]);
      if (val !== undefined) clean[key] = val;
    });
    window.gtag('event', eventName, clean);
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

  function normalizeHref(href){
    try {
      return new URL(href, location.href).pathname + new URL(href, location.href).hash;
    } catch(e) {
      return String(href || '').slice(0, 100);
    }
  }

  function bindClickTracking(){
    if (clickBound) return;
    clickBound = true;

    document.addEventListener('click', function(e){
      var copyBtn = e.target.closest('.cp');
      if(copyBtn){
        track('article_copy_click', { page_path: location.pathname });
      }

      var installBtn = e.target.closest('[data-bb-install-trigger]');
      if(installBtn){
        track('install_cta_click', {
          page_path: location.pathname,
          placement: installBtn.closest('.topbar') ? 'topbar' : 'menu'
        });
      }

      var link = e.target.closest('a[href]');
      if(!link) return;
      var href = link.getAttribute('href') || '';
      var text = (link.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      var currentPath = location.pathname;

      if (/wa\.me|whatsapp/i.test(href)) {
        track('whatsapp_link_click', { page_path: currentPath, link_text: text });
      }

      if (currentPath !== '/' && currentPath !== '/index.html') {
        if (link.classList.contains('cta') || link.closest('.cta-box') || link.closest('header')) {
          track('article_cta_click', {
            page_path: currentPath,
            link_text: text,
            target_path: normalizeHref(href)
          });
        }
        if (link.closest('.rels')) {
          track('related_article_click', {
            page_path: currentPath,
            link_text: text,
            target_path: normalizeHref(href)
          });
        }
      }
    }, true);
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
    bindClickTracking();
    sendPageView();
  }

  window.BBAnalytics = {
    status: function(){ return { measurementId: GA_ID || null, gtagLoaded: !!window.gtag }; },
    pageview: sendPageView,
    track: track
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
