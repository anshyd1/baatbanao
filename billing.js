/* BaatBanao Offline Billing — all invoice data stays in this browser. */
const BB_INVOICE_KEY = 'bb_invoices_v1';

function bbLoadInvoices(){
  try { const v=JSON.parse(localStorage.getItem(BB_INVOICE_KEY)||'[]'); return Array.isArray(v)?v:[]; } catch(e){ return []; }
}
function bbSaveInvoices(list){ localStorage.setItem(BB_INVOICE_KEY,JSON.stringify(list.slice(0,300))); }
function bbInvoiceNumber(){
  const y=new Date().getFullYear(), list=bbLoadInvoices();
  const n=Math.max(0,...list.map(x=>{const m=String(x.number||'').match(new RegExp(`^BB-${y}-(\\d+)$`));return m?Number(m[1]):0;}))+1;
  return `BB-${y}-${String(n).padStart(3,'0')}`;
}
function bbNewInvoiceDraft(){
  return {id:'inv-'+Date.now().toString(36),number:bbInvoiceNumber(),date:todayISO(),dueDate:'',seller:state.settings.businessName||state.settings.upiName||'',sellerPhone:state.settings.businessPhone||'',sellerAddress:state.settings.businessAddress||'',gstin:state.settings.businessGstin||'',buyer:'',buyerPhone:'',buyerAddress:'',taxRate:0,discount:0,note:'Dhanyavaad! Payment ke baad confirmation share karein.',items:[{description:'',qty:1,rate:''}],createdAt:Date.now()};
}
function bbMoney(v){ const n=Number(v)||0; return n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function bbInvoiceTotals(inv){
  const sub=(inv.items||[]).reduce((s,i)=>s+(Math.max(0,Number(i.qty)||0)*Math.max(0,Number(i.rate)||0)),0);
  const discount=Math.min(sub,Math.max(0,Number(inv.discount)||0));
  const taxable=Math.max(0,sub-discount), tax=taxable*Math.max(0,Number(inv.taxRate)||0)/100;
  return {sub,discount,tax,total:taxable+tax};
}
function bbSetDraft(field,value){ if(!state.invoiceDraft) state.invoiceDraft=bbNewInvoiceDraft(); state.invoiceDraft[field]=value; bbRefreshTotals(); }
function bbSetItem(index,field,value){ if(!state.invoiceDraft) return; state.invoiceDraft.items[index][field]=value; bbRefreshTotals(); }
function bbAddInvoiceItem(){ state.invoiceDraft.items.push({description:'',qty:1,rate:''}); renderApp(); }
function bbRemoveInvoiceItem(index){ if(state.invoiceDraft.items.length===1){showToast('Kam se kam ek item rakhein');return;} state.invoiceDraft.items.splice(index,1);renderApp(); }
function bbRefreshTotals(){
  const inv=state.invoiceDraft, t=inv&&bbInvoiceTotals(inv), el=document.getElementById('invoice-live-total');
  if(el&&t) el.innerHTML=`<span>Subtotal ₹${bbMoney(t.sub)}</span>${t.discount?`<span>Discount −₹${bbMoney(t.discount)}</span>`:''}${t.tax?`<span>Tax ₹${bbMoney(t.tax)}</span>`:''}<b>Total ₹${bbMoney(t.total)}</b>`;
  document.querySelectorAll('[data-invoice-line]').forEach(node=>{ const i=Number(node.dataset.invoiceLine), item=inv.items[i]; if(item) node.querySelector('b').textContent='₹'+bbMoney((Number(item.qty)||0)*(Number(item.rate)||0)); });
}
function viewBilling(){
  const list=bbLoadInvoices(), total=list.reduce((s,x)=>s+bbInvoiceTotals(x).total,0);
  return `<div class="page-header"><button class="back-btn" onclick="navigate('home')">${ICONS.back}</button><h1>Offline Billing 🧾</h1></div>
  <div class="billing-hero"><div><small>Saved invoices</small><strong>${list.length}</strong></div><div><small>Total billed</small><strong>₹${bbMoney(total)}</strong></div></div>
  <button class="primary-btn" onclick="state.invoiceDraft=bbNewInvoiceDraft();navigate('invoice-new')">+ Naya Bill Banayein</button>
  <div class="privacy-mini">🔒 Bills isi browser mein save hote hain. Cloud par upload nahi hote. Backup khud rakhna zaroori hai.</div>
  <div class="section-title">Recent Bills</div>
  ${list.length?list.map(x=>{const t=bbInvoiceTotals(x);return `<div class="invoice-row"><div onclick="bbEditInvoice('${x.id}')"><b>${escapeHtml(x.buyer||'Cash Customer')}</b><span>${escapeHtml(x.number)} · ${escapeHtml(x.date)}</span></div><strong>₹${bbMoney(t.total)}</strong><button onclick="bbInvoiceMenu('${x.id}')" aria-label="Invoice options">⋮</button></div>`}).join(''):`<div class="empty-state"><p><b>Abhi koi bill nahi</b><br/>Pehla professional bill 1 minute mein banayein.</p></div>`}`;
}
function viewInvoiceForm(){
  const d=state.invoiceDraft||bbNewInvoiceDraft(); state.invoiceDraft=d; const t=bbInvoiceTotals(d);
  return `<div class="page-header"><button class="back-btn" onclick="navigate('billing')">${ICONS.back}</button><h1>Bill Banayein</h1></div>
  <div class="invoice-form-card"><div class="invoice-grid"><div class="field-block"><label class="field-label">Bill number</label><input type="text" value="${escapeHtml(d.number)}" oninput="bbSetDraft('number',this.value)"></div><div class="field-block"><label class="field-label">Bill date</label><input type="date" value="${escapeHtml(d.date)}" oninput="bbSetDraft('date',this.value)"></div><div class="field-block"><label class="field-label">Due date (optional)</label><input type="date" value="${escapeHtml(d.dueDate)}" oninput="bbSetDraft('dueDate',this.value)"></div></div>
  <details class="invoice-details" open><summary>Aapka business</summary><div class="invoice-grid"><div class="field-block"><label class="field-label">Business/name</label><input type="text" placeholder="Shree Balaji Traders" value="${escapeHtml(d.seller)}" oninput="bbSetDraft('seller',this.value)"></div><div class="field-block"><label class="field-label">Phone</label><input type="tel" inputmode="tel" value="${escapeHtml(d.sellerPhone)}" oninput="bbSetDraft('sellerPhone',this.value)"></div><div class="field-block"><label class="field-label">GSTIN (optional)</label><input type="text" maxlength="15" value="${escapeHtml(d.gstin)}" oninput="bbSetDraft('gstin',this.value.toUpperCase())"></div></div><div class="field-block"><label class="field-label">Address</label><textarea oninput="bbSetDraft('sellerAddress',this.value)">${escapeHtml(d.sellerAddress)}</textarea></div></details>
  <details class="invoice-details" open><summary>Customer</summary><div class="invoice-grid"><div class="field-block"><label class="field-label">Customer name</label><input type="text" placeholder="Customer" value="${escapeHtml(d.buyer)}" oninput="bbSetDraft('buyer',this.value)"></div><div class="field-block"><label class="field-label">Phone (optional)</label><input type="tel" inputmode="tel" value="${escapeHtml(d.buyerPhone)}" oninput="bbSetDraft('buyerPhone',this.value)"></div></div><div class="field-block"><label class="field-label">Address (optional)</label><textarea oninput="bbSetDraft('buyerAddress',this.value)">${escapeHtml(d.buyerAddress)}</textarea></div></details>
  <div class="section-title">Items</div><div class="invoice-items">${d.items.map((i,n)=>`<div class="invoice-item"><div class="item-head"><b>Item ${n+1}</b>${d.items.length>1?`<button onclick="bbRemoveInvoiceItem(${n})">Remove</button>`:''}</div><input type="text" class="item-desc" placeholder="Product/service description" value="${escapeHtml(i.description)}" oninput="bbSetItem(${n},'description',this.value)"><div class="item-numbers"><label>Qty<input type="number" inputmode="decimal" min="0" step="0.01" value="${escapeHtml(i.qty)}" oninput="bbSetItem(${n},'qty',this.value)"></label><label>Rate ₹<input type="number" inputmode="decimal" min="0" step="0.01" value="${escapeHtml(i.rate)}" oninput="bbSetItem(${n},'rate',this.value)"></label><div class="item-line-total" data-invoice-line="${n}"><small>Amount</small><b>₹${bbMoney((Number(i.qty)||0)*(Number(i.rate)||0))}</b></div></div></div>`).join('')}</div><button class="ghost-btn" onclick="bbAddInvoiceItem()">+ Item add karein</button>
  <div class="invoice-grid"><div class="field-block"><label class="field-label">Discount ₹</label><input type="number" inputmode="decimal" min="0" value="${escapeHtml(d.discount)}" oninput="bbSetDraft('discount',this.value)"></div><div class="field-block"><label class="field-label">Tax/GST %</label><select onchange="bbSetDraft('taxRate',this.value)">${[0,5,12,18,28].map(v=>`<option value="${v}" ${Number(d.taxRate)===v?'selected':''}>${v}%</option>`).join('')}</select></div></div>
  <div id="invoice-live-total" class="invoice-total"><span>Subtotal ₹${bbMoney(t.sub)}</span>${t.discount?`<span>Discount −₹${bbMoney(t.discount)}</span>`:''}${t.tax?`<span>Tax ₹${bbMoney(t.tax)}</span>`:''}<b>Total ₹${bbMoney(t.total)}</b></div>
  <div class="field-block"><label class="field-label">Note</label><textarea oninput="bbSetDraft('note',this.value)">${escapeHtml(d.note)}</textarea></div>
  <div class="invoice-actions"><button class="ghost-btn" onclick="bbPreviewInvoice(state.invoiceDraft)">👁 Preview</button><button class="ghost-btn share" onclick="bbShareInvoice(state.invoiceDraft)">↗ Share Bill</button><button class="primary-btn" onclick="bbSaveInvoice(false)">Save Bill</button><button class="ghost-btn" onclick="bbSaveInvoice(true)">PDF/Print</button></div></div>`;
}
function bbSaveInvoice(printAfter){
  const d=state.invoiceDraft;
  if(!d.seller.trim()){showToast('Apna business/name daalein');return;}
  if(!d.buyer.trim()){showToast('Customer name daalein');return;}
  if(!d.items.some(i=>i.description.trim()&&Number(i.qty)>0&&String(i.rate).trim()!==''&&Number(i.rate)>=0)){showToast('Kam se kam ek valid item daalein');return;}
  state.settings.businessName=d.seller;state.settings.businessPhone=d.sellerPhone;state.settings.businessAddress=d.sellerAddress;state.settings.businessGstin=d.gstin;persist();
  const list=bbLoadInvoices(), at=list.findIndex(x=>x.id===d.id), saved={...d,updatedAt:Date.now()}; if(at>=0)list[at]=saved;else list.unshift(saved);bbSaveInvoices(list);bbTrack('invoice_save',{has_tax:Number(d.taxRate)>0,item_count:d.items.length});showToast('Bill offline save ho gaya ✅');if(printAfter)bbPrintInvoice(saved);else navigate('billing');
}
function bbEditInvoice(id){ const x=bbLoadInvoices().find(v=>v.id===id);if(x){state.invoiceDraft=JSON.parse(JSON.stringify(x));navigate('invoice-new');} }
function bbInvoiceMenu(id){
  const x=bbLoadInvoices().find(v=>v.id===id);if(!x)return;
  document.getElementById('bb-invoice-sheet')?.remove();
  const el=document.createElement('div');el.id='bb-invoice-sheet';el.className='bb-sheet-wrap';
  el.innerHTML=`<div class="bb-sheet-backdrop" onclick="this.parentElement.remove()"></div><div class="bb-sheet"><div class="bb-sheet-handle"></div><h3>${escapeHtml(x.number)} · ${escapeHtml(x.buyer)}</h3><button onclick="bbPreviewInvoice(bbLoadInvoices().find(v=>v.id==='${id}'));this.closest('.bb-sheet-wrap').remove()">👁 Preview</button><button onclick="bbShareInvoice(bbLoadInvoices().find(v=>v.id==='${id}'));this.closest('.bb-sheet-wrap').remove()">↗ Share Bill</button><button onclick="bbPrintInvoice(bbLoadInvoices().find(v=>v.id==='${id}'));this.closest('.bb-sheet-wrap').remove()">🖨 PDF / Print</button><button onclick="bbDuplicateInvoice('${id}')">⧉ Duplicate</button><button onclick="bbEditInvoice('${id}');this.closest('.bb-sheet-wrap').remove()">✏️ Edit</button><button class="danger" onclick="bbDeleteInvoice('${id}')">🗑 Delete</button></div>`;document.body.appendChild(el);
}
function bbDuplicateInvoice(id){const x=bbLoadInvoices().find(v=>v.id===id);if(!x)return;state.invoiceDraft={...JSON.parse(JSON.stringify(x)),id:'inv-'+Date.now().toString(36),number:bbInvoiceNumber(),date:todayISO(),createdAt:Date.now()};document.getElementById('bb-invoice-sheet')?.remove();navigate('invoice-new');}
function bbDeleteInvoice(id){if(!confirm('Ye bill permanently delete karein?'))return;bbSaveInvoices(bbLoadInvoices().filter(v=>v.id!==id));document.getElementById('bb-invoice-sheet')?.remove();renderApp();showToast('Bill delete hua');}
function bbPreviewInvoice(inv){
  if(!inv)return;window._bbPreviewInvoice=inv;const t=bbInvoiceTotals(inv), rows=(inv.items||[]).map(i=>`<tr><td>${escapeHtml(i.description||'Item')}</td><td>${bbMoney(i.qty)}</td><td>₹${bbMoney(Number(i.qty)*Number(i.rate))}</td></tr>`).join('');
  document.getElementById('bb-invoice-preview')?.remove();const el=document.createElement('div');el.id='bb-invoice-preview';el.className='invoice-preview-wrap';el.innerHTML=`<div class="invoice-preview-backdrop" onclick="this.parentElement.remove()"></div><div class="invoice-preview-panel"><div class="preview-toolbar"><b>Bill Preview</b><button onclick="this.closest('.invoice-preview-wrap').remove()">✕</button></div><div class="invoice-paper"><div class="preview-head"><div><h2>${escapeHtml(inv.seller||'Your Business')}</h2><p>${escapeHtml(inv.sellerPhone||'')}<br>${escapeHtml(inv.gstin?`GSTIN: ${inv.gstin}`:'')}</p></div><div><strong>INVOICE</strong><p>${escapeHtml(inv.number)}<br>${escapeHtml(inv.date)}</p></div></div><div class="preview-parties"><div><small>FROM</small><b>${escapeHtml(inv.seller||'—')}</b><span>${escapeHtml(inv.sellerAddress||'')}</span></div><div><small>BILL TO</small><b>${escapeHtml(inv.buyer||'Customer')}</b><span>${escapeHtml(inv.buyerPhone||'')}</span></div></div><table><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${rows||'<tr><td>Item</td><td>1</td><td>₹0.00</td></tr>'}</tbody></table><div class="preview-total"><span>Total</span><b>₹${bbMoney(t.total)}</b></div>${inv.note?`<p class="preview-note">${escapeHtml(inv.note)}</p>`:''}</div><div class="preview-actions"><button class="ghost-btn" onclick="this.closest('.invoice-preview-wrap').remove()">Edit</button><button class="ghost-btn share" onclick="bbShareInvoice(window._bbPreviewInvoice)">↗ Text</button><button class="ghost-btn" onclick="bbShareInvoiceImage(window._bbPreviewInvoice)">🖼 Image</button><button class="primary-btn" onclick="bbPrintInvoice(window._bbPreviewInvoice)">PDF / Print</button></div></div>`;document.body.appendChild(el);bbTrack('invoice_preview',{item_count:(inv.items||[]).length});
}

function bbInvoiceShareText(inv){
  const t=bbInvoiceTotals(inv), lines=(inv.items||[]).map((i,n)=>`${n+1}. ${i.description||'Item'} — ${bbMoney(i.qty)} × ₹${bbMoney(i.rate)} = ₹${bbMoney(Number(i.qty)*Number(i.rate))}`);
  return `🧾 *${inv.seller||'BaatBanao'} — INVOICE*\nBill: ${inv.number||''}\nDate: ${inv.date||''}${inv.dueDate?`\nDue: ${inv.dueDate}`:''}\nCustomer: ${inv.buyer||'Customer'}\n\n${lines.join('\n')}\n\nSubtotal: ₹${bbMoney(t.sub)}${t.discount?`\nDiscount: -₹${bbMoney(t.discount)}`:''}${t.tax?`\nTax (${bbMoney(inv.taxRate)}%): ₹${bbMoney(t.tax)}`:''}\n*Total: ₹${bbMoney(t.total)}*${inv.note?`\n\nNote: ${inv.note}`:''}\n\nBill created with BaatBanao`;
}
async function bbShareInvoice(inv){
  if(!inv)return;
  const text=bbInvoiceShareText(inv), title=`Invoice ${inv.number||''}`;
  bbTrack('invoice_share',{item_count:(inv.items||[]).length,has_phone:!!inv.buyerPhone});
  if(navigator.share){
    try{await navigator.share({title,text});showToast('Bill share ho gaya ✅');return;}catch(e){if(e&&e.name==='AbortError')return;}
  }
  const phone=normalizeWhatsAppPhone(inv.buyerPhone||'');
  const url=phone?`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`:`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url,'_blank');
}
async function bbShareInvoiceImage(inv){
  if(!inv)return;
  bbPreviewInvoice(inv);await new Promise(r=>setTimeout(r,120));
  const paper=document.querySelector('#bb-invoice-preview .invoice-paper');
  if(!paper||!window.html2canvas){showToast('Photo library load nahi hui');return;}
  try{
    showToast('Bill image ban rahi hai…');
    const canvas=await window.html2canvas(paper,{scale:2,backgroundColor:'#ffffff',logging:false});
    const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
    const file=new File([blob],`${String(inv.number||'invoice').replace(/[^a-z0-9_-]/gi,'-')}.png`,{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:`Invoice ${inv.number||''}`,text:`Invoice from ${inv.seller||'BaatBanao'}`});showToast('Bill image share ho gayi ✅');}
    else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),3000);showToast('Bill image download ho gayi');}
    bbTrack('invoice_image_share',{item_count:(inv.items||[]).length});
  }catch(e){if(!e||e.name!=='AbortError')showToast('Image share nahi hui');}
}

function bbPrintInvoice(inv){
  const t=bbInvoiceTotals(inv), rows=inv.items.map((i,n)=>`<tr><td>${n+1}</td><td>${escapeHtml(i.description)}</td><td class="num">${bbMoney(i.qty)}</td><td class="num">₹${bbMoney(i.rate)}</td><td class="num">₹${bbMoney(Number(i.qty)*Number(i.rate))}</td></tr>`).join('');
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(inv.number)}</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#202020;margin:0}.top{display:flex;justify-content:space-between;border-bottom:3px solid #ef5b4c;padding-bottom:18px}.brand h1{margin:0;color:#ef5b4c;font-size:28px}.meta{text-align:right}.party{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:25px 0}.party h3{font-size:11px;letter-spacing:1px;color:#777;margin:0 0 6px}.party p{margin:2px 0;white-space:pre-line}table{width:100%;border-collapse:collapse}th{background:#2c2928;color:white;text-align:left}th,td{padding:11px 8px;border-bottom:1px solid #ddd}.num{text-align:right}.totals{width:310px;margin:18px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:7px}.grand{font-size:19px;font-weight:bold;background:#fff0ed;border-radius:8px;color:#b8392f}.note{margin-top:35px;padding:13px;background:#faf6f2;border-left:4px solid #ef5b4c}.foot{margin-top:45px;text-align:center;color:#777;font-size:11px}@media print{button{display:none}}</style></head><body><div class="top"><div class="brand"><h1>${escapeHtml(inv.seller)}</h1><div>${escapeHtml(inv.sellerPhone)}</div><div>${escapeHtml(inv.gstin?`GSTIN: ${inv.gstin}`:'')}</div></div><div class="meta"><h2>INVOICE</h2><b>${escapeHtml(inv.number)}</b><div>Date: ${escapeHtml(inv.date)}</div>${inv.dueDate?`<div>Due: ${escapeHtml(inv.dueDate)}</div>`:''}</div></div><div class="party"><div><h3>FROM</h3><p>${escapeHtml(inv.seller)}\n${escapeHtml(inv.sellerAddress||'')}</p></div><div><h3>BILL TO</h3><p>${escapeHtml(inv.buyer)}\n${escapeHtml(inv.buyerPhone||'')}\n${escapeHtml(inv.buyerAddress||'')}</p></div></div><table><thead><tr><th>#</th><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Subtotal</span><b>₹${bbMoney(t.sub)}</b></div>${t.discount?`<div><span>Discount</span><b>−₹${bbMoney(t.discount)}</b></div>`:''}${t.tax?`<div><span>Tax (${bbMoney(inv.taxRate)}%)</span><b>₹${bbMoney(t.tax)}</b></div>`:''}<div class="grand"><span>Total</span><span>₹${bbMoney(t.total)}</span></div></div>${inv.note?`<div class="note"><b>Note</b><br>${escapeHtml(inv.note)}</div>`:''}<div class="foot">Created offline with BaatBanao · Verify all details before sharing</div><script>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  const w=window.open('','_blank');if(!w){showToast('Popup allow karke dobara try karein');return;}w.document.open();w.document.write(html);w.document.close();bbTrack('invoice_print',{has_tax:Number(inv.taxRate)>0});
}
