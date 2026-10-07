const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const R=path.resolve(__dirname,'../..'),results=[];
fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});
function check(name,fn){try{fn();results.push({test:name,passed:true});console.log('PASS',name);}catch(e){results.push({test:name,passed:false,detail:e.message});console.log('FAIL',name,e.message);}}
function analytics(url,store={}){
 const events={},docEvents={},scripts=[],dataLayer=[],cookies=[];const storage=new Map(Object.entries(store));let reloads=0;
 const location=new URL(url);location.reload=()=>reloads++;
 const box={URL,URLSearchParams,Number,String,Object,console,location,setTimeout:f=>f(),localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},dataLayer};
 box.window=box;box.addEventListener=(n,f)=>events[n]=f;
 box.document={readyState:'complete',title:'AUDIT_PRIVATE_TITLE',referrer:'https://captionstudio.in/tool?phone=AUDIT_PRIVATE_PHONE#name=AUDIT_PRIVATE_NAME',createElement:()=>({}),head:{appendChild:s=>scripts.push(s)},addEventListener:(n,f)=>docEvents[n]=f};
 Object.defineProperty(box.document,'cookie',{get:()=> '_ga=123; session=keep',set:v=>cookies.push(v)});
 vm.runInNewContext(fs.readFileSync(path.join(R,'analytics-config.js'),'utf8'),box);
 vm.runInNewContext(fs.readFileSync(path.join(R,'analytics.js'),'utf8'),box);
 return {box,events,docEvents,scripts,dataLayer,storage,cookies,reloads:()=>reloads};
}
const CONSENT='bb_analytics_consent_v3',accepted={[CONSENT]:'accepted'};
for(const state of [{},{[CONSENT]:'rejected'},{bb_cookie_notice_seen_v1:'1'},{bb_cookie_consent_v2:'accepted'}])check('No GA before explicit v3 consent: '+JSON.stringify(state),()=>{const a=analytics('https://www.baatbanao.shop/',state);assert.equal(a.scripts.length,0);assert.equal(a.dataLayer.length,0);a.box.BBAnalytics.track('message_generate');assert.equal(a.dataLayer.length,0);});
for(const host of ['localhost','127.0.0.1','baatbanao.vercel.app','preview.example.com','www.baatbanao.shop.attacker.example'])check('Production tag blocked on '+host,()=>{const a=analytics('https://'+host+'/',accepted);a.box.BBAnalytics._load();assert.equal(a.scripts.length,0);});
for(const route of ['/pay?pa=AUDIT','/pay/','/pay.html','/pay/index.html','/#pay?pn=AUDIT','/#pay'])check('No payment analytics '+route,()=>{const a=analytics('https://www.baatbanao.shop'+route,accepted);assert.equal(a.scripts.length,0);assert.equal(a.box.BBAnalytics.status().reason,'payment-page');});
for(const route of ['/','/guides','/download','/payment-reminder-customer-whatsapp','/payment-reminder-no-reply-message'])check('Consented public page works '+route,()=>{const a=analytics('https://www.baatbanao.shop'+route,accepted);assert.equal(a.scripts.length,1);assert.equal(a.dataLayer.filter(x=>x[0]==='event'&&x[1]==='page_view').length,1);});
check('Consent acceptance loads once without replaying past events',()=>{const a=analytics('https://www.baatbanao.shop/');a.box.BBAnalytics.track('message_generate');a.storage.set(CONSENT,'accepted');a.events['bb-consent-accepted']();a.events['bb-consent-accepted']();assert.equal(a.scripts.length,1);assert.equal(a.dataLayer.filter(x=>x[1]==='message_generate').length,0);});
check('Private query/hash/referrer/title and arbitrary event fields excluded',()=>{const a=analytics('https://www.baatbanao.shop/?name=AUDIT_PRIVATE_NAME&phone=AUDIT_PRIVATE_PHONE&amount=986543&upi=AUDIT_PRIVATE_UPI&utm_source=captionstudio#customer-ledger?id=AUDIT_PRIVATE_ID',accepted);a.box.BBAnalytics.track('message_generate',{name:'AUDIT_PRIVATE_NAME',phone:'AUDIT_PRIVATE_PHONE',message:'AUDIT_PRIVATE_MESSAGE',amount:986543,has_amount:true,relation:'AUDIT_PRIVATE_RELATION',language:'Hinglish',object:{secret:'AUDIT_PRIVATE_OBJECT'},page_location:'AUDIT_PRIVATE_URL'});const serial=JSON.stringify(a.dataLayer);assert(!serial.includes('AUDIT_PRIVATE'));assert(!serial.includes('986543'));const event=a.dataLayer.find(x=>x[1]==='message_generate');assert.equal(event[2].has_amount,1);assert.equal(event[2].page_location,'https://www.baatbanao.shop/#customer-ledger');assert.equal(event[2].page_referrer,'https://captionstudio.in/');});
check('Only approved campaign values accepted',()=>{const a=analytics('https://www.baatbanao.shop/?utm_source=captionstudio&utm_medium=referral&utm_campaign=AUDIT_PRIVATE_CAMPAIGN&utm_content=tool_bio_gen',accepted);const c=a.dataLayer.find(x=>x[0]==='config')[2];assert.equal(c.campaign_source,'captionstudio');assert.equal(c.campaign_medium,'referral');assert.equal(c.campaign_content,'tool_bio_gen');assert(!JSON.stringify(a.dataLayer).includes('AUDIT_PRIVATE'));});
check('Unknown paths and hash identifiers cannot enter telemetry',()=>{const a=analytics('https://www.baatbanao.shop/AUDIT_PRIVATE_NAME#AUDIT_PRIVATE_HASH',accepted);assert(!JSON.stringify(a.dataLayer).includes('AUDIT_PRIVATE'));assert.equal(a.dataLayer.find(x=>x[1]==='page_view')[2].page_path,'/other');});
check('Unknown event names are dropped',()=>{const a=analytics('https://www.baatbanao.shop/',accepted),before=a.dataLayer.length;a.box.BBAnalytics.track('AUDIT_PRIVATE_EVENT',{});assert.equal(a.dataLayer.length,before);});
check('SPA pageviews dedupe popstate plus hashchange',()=>{const a=analytics('https://www.baatbanao.shop/',accepted);a.box.location.hash='#vasooli?name=AUDIT_PRIVATE';a.events.hashchange();a.events.popstate();assert.equal(a.dataLayer.filter(x=>x[1]==='page_view').length,2);assert(!JSON.stringify(a.dataLayer).includes('AUDIT_PRIVATE'));});
check('Payment entered after GA load produces no custom telemetry',()=>{const a=analytics('https://www.baatbanao.shop/',accepted);const n=a.dataLayer.length;a.box.location.hash='#pay?pa=AUDIT_PRIVATE';a.events.hashchange();a.box.BBAnalytics.track('whatsapp_open');assert.equal(a.dataLayer.length,n);});
check('Consent withdrawal disables GA, clears only analytics cookies, reloads and keeps ledger',()=>{const a=analytics('https://www.baatbanao.shop/',{...accepted,bb_khata:'KEEP_LEDGER'});a.storage.set(CONSENT,'rejected');a.events['bb-consent-rejected']();assert(a.box['ga-disable-G-VG7Y7ND2PW']);assert.equal(a.reloads(),1);assert.equal(a.storage.get('bb_khata'),'KEEP_LEDGER');assert(a.cookies.every(s=>s.startsWith('_ga=')));const n=a.dataLayer.length;a.box.BBAnalytics.track('message_generate');assert.equal(a.dataLayer.length,n);});
check('Cross-tab consent removal disables loaded tag',()=>{const a=analytics('https://www.baatbanao.shop/',accepted);a.storage.delete(CONSENT);a.events.storage({key:CONSENT});assert.equal(a.reloads(),1);});
check('Copy selector does not match copyright text',()=>{const a=analytics('https://www.baatbanao.shop/guides',accepted);let first='';a.docEvents.click({target:{closest:s=>{if(!first)first=s;return null;}}});assert.equal(first,'button.cp, button.copy, [data-bb-copy]');});
function worker(offline=false){
 const handlers={},puts=[],deleted=[],matches=[];const cache={addAll:async()=>{},put:async(...args)=>puts.push(args),match:async p=>{matches.push(p);return new Response('payment shell');}};
 const s={URL,Response,console,fetch:async()=>{if(offline)throw Error('offline');return new Response('network');},caches:{open:async()=>cache,keys:async()=>['baatbanao-v1.1.0','baatbanao-v1.1.1-seo-privacy','baatbanao-v1.1.2-reliability-consent','baatbanao-v1.1.3-financial-validation','flutter-app-cache','other-cache'],delete:async k=>deleted.push(k),match:async()=>new Response('fallback')},self:{location:{origin:'https://www.baatbanao.shop'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>[]}}};
 vm.runInNewContext(fs.readFileSync(path.join(R,'service-worker.js'),'utf8'),s);return {handlers,puts,deleted,matches};
}
(async()=>{
 for(const offline of [false,true])for(const path of ['/pay?pa=AUDIT&pn=AUDIT_NAME','/?name=AUDIT_NAME&phone=AUDIT_PHONE']){
  const w=worker(offline);let response;w.handlers.fetch({request:{method:'GET',url:'https://www.baatbanao.shop'+path,mode:'navigate',destination:'document',headers:{get:()=> 'text/html'}},respondWith:p=>response=p});await response;
  check('Private URL never cached: '+path+' offline='+offline,()=>assert.equal(w.puts.length,0));
  if(path.startsWith('/pay')&&offline)check('Offline payment still uses payment-only shell',()=>assert.deepEqual(w.matches,['./pay.html']));
 }
 const w=worker();let promise;w.handlers.activate({waitUntil:p=>promise=p});await promise;
 check('SW clears only old BaatBanao caches; keeps Flutter and other apps',()=>assert.deepEqual(w.deleted,['baatbanao-v1.1.0','baatbanao-v1.1.1-seo-privacy','baatbanao-v1.1.2-reliability-consent','baatbanao-v1.1.3-financial-validation']));
 check('SW never resets localStorage',()=>assert(!fs.readFileSync(path.join(R,'service-worker.js'),'utf8').includes('localStorage')));
 // The ~10 MB OCR engine cache must survive SW upgrades, otherwise "works
 // offline after first scan" breaks on every deploy.
 const wOcr=worker();let ocrPromise;wOcr.handlers.activate({waitUntil:p=>ocrPromise=p});await ocrPromise;
 check('SW upgrade preserves the OCR engine cache',()=>assert(!wOcr.deleted.includes('baatbanao-ocr-v1')));
 // ---- voice-ocr.js: parsers, review gate, mic fallback, ledger actions ----
 const recLog={starts:[],stops:0};
 class FakeRecognition{
  constructor(){this.lang='';this.continuous=false;this.interimResults=false;this.maxAlternatives=1;}
  start(){recLog.starts.push(this.lang);}
  stop(){recLog.stops++;if(this.onend)this.onend();}
  abort(){if(this.onend)this.onend();}
 }
 function voiceBox(opts={}){
  const els={};
  const el=()=>({style:{},classList:{add(){},remove(){}},addEventListener(){},appendChild(){},remove(){},querySelector:()=>null,querySelectorAll:()=>[],focus(){},get innerHTML(){return ''},set innerHTML(v){},textContent:'',value:'',id:'',checked:false,disabled:false,dataset:{}});
  const cacheObj={addAll:async()=>{},put:async()=>{},match:async()=>undefined};
  const box={console,setTimeout:(f)=>f(),clearTimeout,setInterval,clearInterval,Date,Math,JSON,String,Number,Object,Array,Promise,RegExp,Error,isFinite,parseFloat,parseInt,TextEncoder,TextDecoder,Uint8Array,Blob:class{},FileReader:class{},Image:class{},URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},
   navigator:Object.assign({onLine:opts.onLine!==false,mediaDevices:{},userAgent:'node',serviceWorker:{}},opts.navigator||{}),
   location:{href:'https://x/',origin:'https://x',protocol:'https:',search:'',hash:''},
   localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
   matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
   fetch:()=>Promise.reject(new Error('no net')),
   caches:{open:async()=>cacheObj,keys:async()=>[],delete:async()=>{},match:async()=>undefined},
   SpeechRecognition:FakeRecognition,webkitSpeechRecognition:FakeRecognition,
   confirm:()=>opts.confirm!==false,alert(){},showToast(){},open(){},
   bbTrack(){},bbShowUndo(){},persist(){},renderApp(){},addKhataEntry(){},
   state:opts.state||{khata:[]}};
  box.window=box;box.globalThis=box;box.self=box;
  box.document={readyState:'complete',title:'t',referrer:'',hidden:false,visibilityState:'visible',createElement:el,getElementById:(id)=>els[id]||(els[id]=el()),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){},head:el(),body:el(),cookie:''};
  box.addEventListener=()=>{};box.removeEventListener=()=>{};
  vm.runInNewContext(fs.readFileSync(path.join(R,'voice-ocr.js'),'utf8'),box,{filename:'voice-ocr.js'});
  return {box,els};
 }
 {
  const {box}=voiceBox();
  const VA=box.bbVoiceAssistant;
  const voice=VA.parseVoiceTranscript, ocr=VA.parseOcrText;
  // P1-04: a date number must never be read as the amount
  check('Voice: date before amount does not become the amount',()=>assert.equal(voice('Ravi 15 ko 500 dena hai').amount,500));
  check('Voice: devanagari day reference is not the amount',()=>assert.equal(voice('Ravi 15 tarikh 500 dena hai').amount,500));
  // P1-04: compound spoken amounts
  check('Voice: "1 hazar paanch sau" composes to 1500',()=>assert.equal(voice('Ravi ke 1 hazar paanch sau rupaye lena').amount,1500));
  check('Voice: "do hazar" composes to 2000',()=>assert.equal(voice('Mohan ko do hazar rupaye dena hai').amount,2000));
  check('Voice: "dedh hazar" composes to 1500',()=>assert.equal(voice('Ravi se dedh hazar lena hai').amount,1500));
  check('Voice: "1 lakh" composes to 100000',()=>assert.equal(voice('Ravi se 1 lakh lena hai').amount,100000));
  check('Voice: stray words like "kar do" are not an amount',()=>assert.equal(voice('Ravi ka hisaab clear kar do').amount,undefined));
  check('Voice: plain amount still parses',()=>assert.equal(voice('Ravi se 500 lena hai kal tak').amount,500));
  // P2-03: paise preserved
  check('Voice: paise decimals are preserved',()=>assert.equal(voice('Mohan ko 1200.50 dena hai').amount,1200.5));
  check('OCR: paise decimals are preserved',()=>assert.equal(ocr('Grand Total Rs. 1450.75').amount,1450.75));
  // P2-05: relative dates come from the local calendar, ISO format
  check('Voice: kal gives tomorrow in local ISO',()=>{const d=voice('Ravi se 500 lena hai kal tak').dueDate;const t=new Date();t.setDate(t.getDate()+1);assert.equal(d,`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`);});
  check('Voice: aaj gives today in local ISO',()=>{const d=voice('Ravi se 500 lena hai aaj tak').dueDate;const t=new Date();assert.equal(d,`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`);});
  check('Voice: "15 tarikh" is text-only and never persisted as a date',()=>{const r=voice('Ravi se 500 lena hai 15 tarikh tak');assert.equal(r.dueDate,'');assert.ok(/15 tarikh/.test(r.dueText||''));});
  // P1-01: due date only from a labelled line, converted to ISO
  check('OCR: labelled due date wins over invoice date',()=>assert.equal(ocr('Bill No 104 Date: 22/09/2026\nCustomer: Ravi Kumar\nPayment Pending - Due Date: 25/09/2026\nGRAND TOTAL: Rs 1450').dueDate,'2026-09-25'));
  check('OCR: due date converts to validated ISO',()=>assert.equal(ocr('Mob 9811223344 Due Date: 23-09-2026').dueDate,'2026-09-23'));
  check('OCR: month-name due date converts to ISO',()=>assert.equal(ocr('Payment due 25 Sep 2026').dueDate,'2026-09-25'));
  check('OCR: invoice date is never used as the due date',()=>{const r=ocr('Date: 21-09-2026\nNaam: Raju Bhai\nTotal: 1500');assert.equal(r.dueDate,'');assert.equal(r._dateSource,'bill-invoice-date');});
  check('OCR: impossible date is rejected',()=>assert.equal(ocr('Due Date: 45/45/2026').dueDate,''));
  check('OCR: two-digit year expands to 20xx',()=>assert.equal(ocr('Due Date: 25/09/26').dueDate,'2026-09-25'));
  // P1-02: store/header phone is never the customer phone
  check('OCR: store header phone is not the customer phone',()=>assert.equal(ocr('STORE\nMobile: 9999999999\nCustomer: Ravi Kumar\nAmount Due: INR 1450').phone,''));
  check('OCR: phone inside the customer block is accepted',()=>assert.equal(ocr('Customer Name: Ramesh Kumar\nPhone: 9876543210\nTotal: 1450').phone,'9876543210'));
  check('OCR: phone on the customer line itself is accepted',()=>assert.equal(ocr('Customer: Ravi Kumar 9876543210\nTotal: 1450').phone,'9876543210'));
  check('OCR: tenant block phone is accepted, owner phone is not',()=>assert.equal(ocr('Owner: Suresh Sharma\nMob 9988776655\nTenant Name: Rahul Singh\nMob 9812345678').phone,'9812345678'));
  // P1-04 support: invoice/year digits are not amounts
  check('OCR: invoice number is not an amount',()=>assert.equal(ocr('Invoice 123456\nCustomer: Ravi Kumar\nDate 06/10/2026').amount,''));
  // Name: owner is not the customer on a rent receipt
  check('OCR: tenant wins over owner for the customer name',()=>assert.equal(ocr('HOUSE RENT RECEIPT\nOwner: Suresh Sharma\nTenant Name: Rahul Singh\nRent: 8500').name,'Rahul Singh'));
 }
 // Review gate (P1-03)
 {
  const {box,els}=voiceBox();
  const VA=box.bbVoiceAssistant;
  VA.showResultModal({name:'Test',amount:'500',phone:'9876543210',type:'lena',dueDate:'2026-10-10',_isOcr:true});
  check('Review gate: actions are locked before verification',()=>{assert.equal(VA.isReviewed(),false);assert.equal(VA.requireReview('save'),false);});
  VA.setReviewed(true);
  check('Review gate: actions unlock after verification',()=>assert.equal(VA.requireReview('save'),true));
  els['bb-edit-amount'].value='600';
  VA.syncActiveEntry();
  check('Review gate: editing a field re-locks the actions',()=>assert.equal(VA.isReviewed(),false));
  VA.setReviewed(true);els['bb-edit-amount'].value='600';VA.syncActiveEntry();
  check('Review gate: unchanged sync does not re-lock',()=>assert.equal(VA.isReviewed(),true));
  VA.toggleType();
  check('Review gate: direction change re-locks the actions',()=>assert.equal(VA.isReviewed(),false));
 }
 // Mic fallback + cancel (P2-04/P2-08)
 {
  recLog.starts.length=0;recLog.stops=0;
  const {box}=voiceBox();
  const VA=box.bbVoiceAssistant;
  VA.init();
  const rec=VA.recognition;
  VA._startRecognition();
  check('Mic: starts in the primary language',()=>assert.deepEqual(recLog.starts,['hi-IN']));
  rec.onerror({error:'no-speech'});
  check('Mic: fallback retry runs in the fallback language',()=>{assert.deepEqual(recLog.starts,['hi-IN','en-IN']);assert.equal(rec.lang,'en-IN');assert.equal(VA._pendingRetryLang,null);});
  rec.onend();
  check('Mic: after the fallback attempt ends, language resets to primary',()=>{assert.equal(VA.langIndex,0);assert.equal(rec.lang,'hi-IN');});
 }
 {
  recLog.starts.length=0;recLog.stops=0;
  const {box}=voiceBox();
  const VA=box.bbVoiceAssistant;
  VA.init();
  const rec=VA.recognition;
  VA._startRecognition();
  VA.isListening=true;
  VA.stopVoice();
  rec.onerror({error:'aborted'});
  check('Mic: explicit cancel stops once and never auto-restarts',()=>{assert.equal(recLog.stops,1);assert.deepEqual(recLog.starts,['hi-IN']);});
 }
 // Offline engine load (P2-01)
 {
  const {box}=voiceBox({onLine:false});
  const VA=box.bbVoiceAssistant;
  VA.loadScript=()=>Promise.reject(new Error('offline'));
  check('Offline engine: uncached engine still fails honestly',()=>VA.loadEngine().then(()=>{throw new Error('should have thrown')},e=>assert.equal(e.message,'OFFLINE_OCR')));
 }
 {
  const {box}=voiceBox({onLine:false});
  const VA=box.bbVoiceAssistant;
  VA.loadScript=()=>{box.Tesseract={createWorker:()=>{}};return Promise.resolve();};
  check('Offline engine: cached engine loads while offline',()=>VA.loadEngine().then(()=>assert.ok(box.Tesseract)));
 }
 // Ledger actions (P1-05/P1-06)
 {
  const khata=[{id:'k1',name:'Ledger Cust',amount:1000,paidAmount:400,status:'partial',transactions:[
    {id:'t1',type:'gave',amount:1000,date:'2026-10-01',createdAt:1},
    {id:'t2',type:'received',amount:400,date:'2026-10-02',createdAt:2}]}];
  const {box}=voiceBox({state:{khata}});
  const VA=box.bbVoiceAssistant;
  box.outstandingAmount=(k)=>Math.max((Number(k.amount)||0)-(Number(k.paidAmount)||0),0);
  box.syncKhataFromLedger=(k)=>{const gave=k.transactions.filter(t=>t.type==='gave').reduce((s,t)=>s+Number(t.amount||0),0);const rec=k.transactions.filter(t=>t.type==='received').reduce((s,t)=>s+Number(t.amount||0),0);k.amount=gave;k.paidAmount=Math.min(rec,gave);k.status=gave>0&&rec>=gave?'paid':rec>0?'partial':'pending';};
  let undoFn=null;box.bbShowUndo=(l,fn)=>{undoFn=fn;};
  VA.handleClearHisaab('Ledger Cust');
  const k=khata[0];
  check('Ledger clear: settles through a received transaction',()=>assert.equal(k.transactions.filter(t=>t.type==='received').reduce((s,t)=>s+t.amount,0),1000));
  check('Ledger clear: entry reconciles to paid with zero balance',()=>assert.equal(k.status,'paid')&&assert.equal(k.paidAmount,1000));
  undoFn();
  check('Ledger undo: restores the full ledger snapshot',()=>assert.equal(khata[0].transactions.length,2)&&assert.equal(khata[0].status,'partial')&&assert.equal(khata[0].paidAmount,400));
 }
 {
  const khata=[{id:'k2',name:'Partial Cust',amount:1000,paidAmount:400,status:'partial',transactions:[]}];
  const {box}=voiceBox({state:{khata}});
  const VA=box.bbVoiceAssistant;
  box.outstandingAmount=(k)=>Math.max((Number(k.amount)||0)-(Number(k.paidAmount)||0),0);
  VA.handleQuickReminder('Partial Cust');
  check('Quick reminder: asks only the outstanding balance',()=>assert.equal(VA.activeEntry.amount,600));
  VA.activeEntry=null;
  khata[0].status='paid';khata[0].paidAmount=1000;
  VA.handleQuickReminder('Partial Cust');
  check('Quick reminder: blocked on a fully paid entry',()=>assert.equal(VA.activeEntry,null));
 }
 fs.writeFileSync(path.join(__dirname,'results/runtime-tests.json'),JSON.stringify(results,null,2));console.log('TOTAL',results.length,'PASSED',results.filter(x=>x.passed).length);if(results.some(x=>!x.passed))process.exitCode=1;
})();
