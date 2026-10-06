/* Visible Vault loading/recovery state. Never reads or clears ledger storage. */
(function(){
  'use strict';
  var box = document.createElement('div');
  box.id = 'vault-loading';
  box.setAttribute('role','status');
  box.style.cssText = 'position:fixed;inset:0;display:grid;place-content:center;text-align:center;padding:24px;background:#0b132b;color:#fff;font:16px/1.6 system-ui;z-index:9999';
  box.innerHTML = '<strong>BaatBanao Vault</strong><span id="vault-load-message">Loading your local ledger…</span><a id="vault-recovery" href="/download" style="color:#7dd3fc;display:none">Download options / retry</a>';
  document.body.appendChild(box);
  var timeout;
  function ready(){
    clearTimeout(timeout);
    var box = document.getElementById('vault-loading');
    if (box) box.remove();
  }
  function failed(){
    var message = document.getElementById('vault-load-message');
    var link = document.getElementById('vault-recovery');
    if (message) message.textContent = 'Vault is taking longer to load. Check your connection or try again. Do not clear browser storage—your ledger is stored on this device.';
    if (link) link.style.display = 'block';
  }
  window.addEventListener('flutter-first-frame', ready, {once:true});
  window.addEventListener('unhandledrejection', failed);
  timeout = setTimeout(failed, 20000);
})();
