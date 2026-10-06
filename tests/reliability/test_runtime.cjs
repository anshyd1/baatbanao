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
 const s={URL,Response,console,fetch:async()=>{if(offline)throw Error('offline');return new Response('network');},caches:{open:async()=>cache,keys:async()=>['baatbanao-v1.1.0','baatbanao-v1.1.1-seo-privacy','baatbanao-v1.1.2-reliability-consent','flutter-app-cache','other-cache'],delete:async k=>deleted.push(k),match:async()=>new Response('fallback')},self:{location:{origin:'https://www.baatbanao.shop'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting:async()=>{},clients:{claim:async()=>{},matchAll:async()=>[]}}};
 vm.runInNewContext(fs.readFileSync(path.join(R,'service-worker.js'),'utf8'),s);return {handlers,puts,deleted,matches};
}
(async()=>{
 for(const offline of [false,true])for(const path of ['/pay?pa=AUDIT&pn=AUDIT_NAME','/?name=AUDIT_NAME&phone=AUDIT_PHONE']){
  const w=worker(offline);let response;w.handlers.fetch({request:{method:'GET',url:'https://www.baatbanao.shop'+path,mode:'navigate',destination:'document',headers:{get:()=> 'text/html'}},respondWith:p=>response=p});await response;
  check('Private URL never cached: '+path+' offline='+offline,()=>assert.equal(w.puts.length,0));
  if(path.startsWith('/pay')&&offline)check('Offline payment still uses payment-only shell',()=>assert.deepEqual(w.matches,['./pay.html']));
 }
 const w=worker();let promise;w.handlers.activate({waitUntil:p=>promise=p});await promise;
 check('SW clears only old BaatBanao caches; keeps Flutter and other apps',()=>assert.deepEqual(w.deleted,['baatbanao-v1.1.0','baatbanao-v1.1.1-seo-privacy']));
 check('SW never resets localStorage',()=>assert(!fs.readFileSync(path.join(R,'service-worker.js'),'utf8').includes('localStorage')));
 fs.writeFileSync(path.join(__dirname,'results/runtime-tests.json'),JSON.stringify(results,null,2));console.log('TOTAL',results.length,'PASSED',results.filter(x=>x.passed).length);if(results.some(x=>!x.passed))process.exitCode=1;
})();
