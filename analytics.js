(function(){
  'use strict';
  var config = window.BAATBANAO_ANALYTICS || {};
  var GA_ID = String(config.ga4MeasurementId || '').trim();
  var CONSENT_KEY = 'bb_analytics_consent_v3';
  var scriptLoaded = false, lastPage = null, bound = false;
  var routes = ['home','hisaab','vasooli','templates','billing','invoice-new','bulk','business','masti','khata','customer-ledger','khata-form','history','profile','settings','privacy','terms','pro'];
  var events = ['message_generate','template_generate','whatsapp_open','copy_output','copy_text','share_app','export_khata_csv','ledger_transaction_add','ledger_transaction_delete','clear_all_data','pro_checkout_start','pro_unlock_success','upi_qr_share','invoice_image_share','invoice_payment_add','invoice_pdf_share','invoice_preview','invoice_print','invoice_save','invoice_share','hisaab_add','voice_command_parsed','voice_command_start','voice_khata_save','install_prompt_open','article_copy_click','install_cta_click','whatsapp_link_click','article_cta_click','related_article_click','download_click'];
  var enums = {
    route: routes, source_route: routes,
    relation: ['Dost','Customer','Client','Relative','Family','Tenant','Student','Other'],
    language: ['Hinglish','Hindi','English','Bhojpuri'],
    tone: ['Friendly','Professional','Polite','Strict','Funny','Mummy Style','Savage Safe','Emotional','Formal'],
    category: ['friend','customer','freelancer','rent','tuition','family','savage'],
    plan: ['shagun','pro','business','monthly','yearly','lifetime'],
    type: ['lena','dena','income','expense','payment','credit','debit'],
    mode: ['cash','upi','card','bank','other'],
    placement: ['topbar','menu','hero','footer','download'],
    download_type: ['apk','exe','web'],
    text_length_bucket: ['short','medium','long'],
    action: ['add','remind','lena','dena','received','paid','unknown']
  };
  function getConsent(){try{return localStorage.getItem(CONSENT_KEY);}catch(e){return null;}}
  function granted(){return getConsent() === 'accepted';}
  function payment(){return /^\/pay(?:\.html|\/index\.html)?\/?$/.test(location.pathname) || /^#pay(?:[?\/&]|$)/i.test(location.hash);}
  function eligible(){return location.protocol === 'https:' && location.hostname === 'www.baatbanao.shop' && !payment();}
  function allowedPath(path){
    if(path === '/index.html') return '/';
    path = path.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    return (config.allowedPaths || ['/']).indexOf(path) !== -1 ? path : '/other';
  }
  function safePath(url){
    var path = allowedPath(url.pathname);
    var route = url.hash.slice(1).split('?')[0];
    return path + ((path === '/' && routes.indexOf(route) !== -1) ? '#' + route : '');
  }
  function referrer(){
    try{var u = new URL(document.referrer);return /^https?:$/.test(u.protocol) ? u.origin + '/' : '';}catch(e){return '';}
  }
  function context(){
    var path = safePath(new URL(location.href));
    return {page_location:location.origin + path, page_path:path, page_referrer:referrer(), page_title:'BaatBanao · ' + path};
  }
  function attribution(){
    var query = new URLSearchParams(location.search), out = {};
    var allowed = config.allowedAttribution || {};
    ['source','medium','campaign','content'].forEach(function(key){
      var value = query.get('utm_' + key);
      if(value && (allowed[key] || []).indexOf(value) !== -1) out['campaign_' + key] = value;
    });
    return out;
  }
  function cleanParams(params){
    var out = {};
    Object.keys(params || {}).forEach(function(key){
      var value = params[key];
      if(enums[key] && enums[key].indexOf(value) !== -1) out[key] = value;
      else if (/^(has_amount|has_phone|has_name|has_upi|has_tax|has_prompt|cleared|ios|in_app)$/.test(key) && typeof value === 'boolean') out[key] = value ? 1 : 0;
      else if (/^(item_count|entries)$/.test(key) && Number.isInteger(value) && value >= 0 && value <= 100000) out[key] = value;
      else if(key === 'target_path') {
        try{var u = new URL(value,location.origin);if(u.origin === location.origin && !/^\/pay(?:[/.]|$)/.test(u.pathname)) out[key] = safePath(u);}catch(e){}
      }
    });
    return out;
  }
  function ready(){return scriptLoaded && eligible() && granted() && typeof window.gtag === 'function';}
  function track(name,params){
    if(!ready() || events.indexOf(name) === -1) return;
    var ctx = context();
    window.gtag('set',ctx);
    window.gtag('event',name,Object.assign(cleanParams(params),ctx));
  }
  function pageview(){
    if(!ready()) return;
    var ctx = context();
    window.gtag('set',ctx);
    if(lastPage === ctx.page_path) return;
    lastPage = ctx.page_path;
    window.gtag('event','page_view',ctx);
  }
  function clicks(e){
    var el = e.target.closest ? e.target : e.target.parentElement;
    if(!el) return;
    if(el.closest('button.cp, button.copy, [data-bb-copy]')) track('article_copy_click');
    var install = el.closest('[data-bb-install-trigger]');
    if(install) track('install_cta_click',{placement:install.closest('.topbar') ? 'topbar' : 'menu'});
    var link = el.closest('a[href]');
    if(!link) return;
    var href = link.getAttribute('href') || '';
    if(/^(?:https:\/\/(?:wa\.me|(?:api|web)\.whatsapp\.com)\/|whatsapp:)/i.test(href)) track('whatsapp_link_click');
    if(/\.(apk|exe)(?:[?#]|$)/i.test(href)) track('download_click',{download_type:/\.apk(?:[?#]|$)/i.test(href) ? 'apk' : 'exe'});
    if(location.pathname !== '/' && location.pathname !== '/index.html'){
      if(link.classList.contains('cta') || link.closest('.cta-box') || link.closest('header')) track('article_cta_click',{target_path:href});
      if(link.closest('.rels')) track('related_article_click',{target_path:href});
    }
  }
  function load(){
    if(scriptLoaded || !GA_ID || !eligible() || !granted()) return;
    scriptLoaded = true;
    window['ga-disable-' + GA_ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
    window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    window.gtag('set','ads_data_redaction',true);
    window.gtag('set',context());
    window.gtag('js',new Date());
    window.gtag('config',GA_ID,Object.assign({send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false},context(),attribution()));
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(script);
    if(!bound){
      bound = true;
      window.addEventListener('hashchange',pageview);
      window.addEventListener('popstate',pageview);
      document.addEventListener('click',clicks,true);
    }
    pageview();
  }
  function revoke(){
    window['ga-disable-' + GA_ID] = true;
    document.cookie.split(';').forEach(function(cookie){
      var name = cookie.split('=')[0].trim();
      if(!/^(_ga(?:_|$)|_gid$|_gat(?:_|$))/.test(name)) return;
      ['',location.hostname,'.' + location.hostname,'.baatbanao.shop'].forEach(function(domain){
        document.cookie = name + '=; Max-Age=0; Path=/;' + (domain ? ' Domain=' + domain + ';' : '') + ' SameSite=Lax; Secure';
      });
    });
    if(scriptLoaded) location.reload();
  }
  window.BBAnalytics = {
    status:function(){return {measurementId:GA_ID || null,enabled:eligible() && granted(),gtagLoaded:scriptLoaded,consent:getConsent(),consentGranted:granted(),reason:payment() ? 'payment-page' : !eligible() ? 'non-production-host' : !granted() ? 'consent-required' : 'enabled'};},
    track:track,pageview:pageview,_load:load
  };
  window.addEventListener('bb-consent-accepted',load);
  window.addEventListener('bb-consent-rejected',revoke);
  window.addEventListener('storage',function(e){if(e.key === CONSENT_KEY || e.key === null){if(granted()) load();else revoke();}});
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',load);
  else load();
})();
