/* Shared payment renderer. No analytics, remote QR services or payment requests. */
(function(){
  'use strict';
  var app = document.getElementById('app');
  if (!app) return;
  function clean(value){ return String(value || '').trim(); }
  function esc(value){
    return String(value || '').replace(/[&<>"']/g, function(c){
      return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c];
    });
  }
  function showError(message){
    app.innerHTML = '<div class="brand">UPI Payment</div><div class="bad" role="alert">' + esc(message) + '</div>';
  }
  var query = new URLSearchParams(location.search);
  var pa = clean(query.get('pa') || query.get('u')).toLowerCase();
  var pn = clean(query.get('pn') || query.get('n')) || 'UPI User';
  var rawAmount = clean(query.get('am') || query.get('a'));
  var amount = rawAmount ? Number(rawAmount) : null;
  var note = clean(query.get('tn') || query.get('t')) || 'Payment request';
  if (!/^[a-z0-9._-]{2,}@[a-z0-9._-]{2,}$/i.test(pa)) {
    showError('Invalid UPI payment link. Check the link with the sender.');
    return;
  }
  if (rawAmount && (!Number.isFinite(amount) || amount <= 0)) {
    showError('Invalid payment amount. Check the link with the sender.');
    return;
  }
  var params = new URLSearchParams();
  params.set('pa', pa);
  params.set('pn', pn);
  if (amount !== null) params.set('am', String(amount));
  params.set('cu', 'INR');
  params.set('tn', note.slice(0, 70));
  var upi = 'upi://pay?' + params.toString();
  var amountLabel = amount !== null ? '₹' + amount.toLocaleString('en-IN') : 'Amount payer can enter';

  app.innerHTML = '<div class="brand">UPI Payment</div>' +
    '<div class="sub">Check the payee and amount before paying.</div>' +
    '<div class="qr" id="qrbox" role="img" aria-label="UPI payment QR"></div>' +
    '<div class="name">' + esc(pn) + '</div>' +
    '<div class="upi">' + esc(pa) + '</div>' +
    '<div class="amount">' + esc(amountLabel) + '</div>' +
    '<div class="btns">' +
      '<a class="btn primary" id="openUpi">Open UPI App</a>' +
      '<button class="btn secondary" id="copyBtn" type="button">Copy UPI Link</button>' +
      '<button class="btn secondary" id="shareQr" type="button" style="grid-column:1/-1;">Share / Download QR</button>' +
    '</div>' +
    '<div class="hint" id="paymentStatus" role="status" aria-live="polite">Tap “Open UPI App” or scan the QR using your UPI app. BaatBanao does not confirm whether a payment was received.</div>' +
    '<p class="small"><a href="/" rel="noreferrer">Create your own free payment reminder →</a></p>' +
    '<div class="small">QR generated on your device · Powered by BaatBanao</div>';
  document.getElementById('openUpi').href = upi;
  function status(text){ document.getElementById('paymentStatus').textContent = text; }

  try {
    if (typeof window.qrcode !== 'function') throw new Error('QR library unavailable');
    var qr = window.qrcode(0, 'M');
    qr.addData(upi);
    qr.make();
    document.getElementById('qrbox').innerHTML = qr.createSvgTag({cellSize:5, margin:4, scalable:true});
  } catch (e) {
    document.getElementById('qrbox').textContent = 'QR unavailable. You can still open or copy the UPI link.';
    document.getElementById('shareQr').disabled = true;
  }

  document.getElementById('copyBtn').onclick = async function(){
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(upi);
      status('UPI link copied. Share it only with the intended recipient.');
    } catch (e) {
      status('Clipboard unavailable. You can open your UPI app using the button above.');
    }
  };

  function qrPng(){
    return new Promise(function(resolve, reject){
      var svg = document.querySelector('#qrbox svg');
      if (!svg) { reject(new Error('QR unavailable')); return; }
      var copy = svg.cloneNode(true);
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', '800');
      copy.setAttribute('height', '800');
      var blob = new Blob([new XMLSerializer().serializeToString(copy)], {type:'image/svg+xml;charset=utf-8'});
      var localUrl = URL.createObjectURL(blob);
      var image = new Image();
      image.onload = function(){
        URL.revokeObjectURL(localUrl);
        try {
          var canvas = document.createElement('canvas');
          canvas.width = 800; canvas.height = 800;
          var ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas unavailable');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 800, 800);
          ctx.drawImage(image, 0, 0, 800, 800);
          canvas.toBlob(function(png){ png ? resolve(png) : reject(new Error('PNG unavailable')); }, 'image/png');
        } catch (e) { reject(e); }
      };
      image.onerror = function(){ URL.revokeObjectURL(localUrl); reject(new Error('QR image unavailable')); };
      image.src = localUrl;
    });
  }

  function downloadQr(blob){
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url; link.download = 'upi-qr.png';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
    status('QR downloaded. Share it only with the intended recipient.');
  }

  document.getElementById('shareQr').onclick = async function(){
    var button = this;
    button.disabled = true;
    try {
      var png = await qrPng();
      var file = new File([png], 'upi-qr.png', {type:'image/png'});
      if (navigator.share && navigator.canShare && navigator.canShare({files:[file]})) {
        try {
          await navigator.share({title:'UPI Payment', files:[file]});
          status('Share action completed. This does not confirm payment.');
        } catch (e) {
          if (e.name === 'AbortError') status('Sharing cancelled.');
          else downloadQr(png);
        }
      } else downloadQr(png);
    } catch (e) {
      status('QR export failed. You can still open or copy the UPI link.');
    } finally { button.disabled = false; }
  };
  // Do not auto-launch another app. The payer explicitly taps after checking details.
})();
