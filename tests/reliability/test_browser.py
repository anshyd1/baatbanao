import asyncio,json,mimetypes,base64,io,importlib.util
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from bs4 import BeautifulSoup
from PIL import Image,ImageDraw,ImageFont
from playwright.async_api import async_playwright
R=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent/'results';OUT.mkdir(exist_ok=True);BASE='https://www.baatbanao.shop';V=json.loads((R/'vercel.json').read_text());results=[]
def check(name,ok,detail=''):
 results.append({'test':name,'passed':bool(ok),'detail':detail});print(('PASS' if ok else 'FAIL'),name,detail,flush=True)
def static():
 spec=importlib.util.spec_from_file_location('generator',R/'seo/generate_pages.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 for slug,n in [('tuition-fees-reminder-message',10),('dost-se-paise-wapas-message',12),('payment-reminder-customer-whatsapp',10),('paise-mangne-ke-message',15)]:
  p=[p for p in m.PAGES if p['slug']==slug][-1]
  check(slug+' delivered count matches promise',len(BeautifulSoup((R/(slug+'.html')).read_text(),'html.parser').select('.msg'))==n)
  check(slug+' generator preserves corrected count',len(BeautifulSoup(m.build(p),'html.parser').select('.msg'))==n)
 for file in ['guides.html','download.html']:
  soup=BeautifulSoup((R/file).read_text(),'html.parser');check(file+' exactly one consent-gated analytics include',len(soup.select('script[src="/analytics.js"]'))==1 and len(soup.select('script[src="/cookie-banner.js"]'))==1)
 check('Vault loading helper matches build source',(R/'app/load-status.js').read_bytes()==(R/'app-load-status.js').read_bytes())
 check('Future Vault CI copies the recovery helper','cp ../../app-load-status.js web/load-status.js' in (R/'.github/workflows/build-vault.yml').read_text())
 global_csp=next(h['value'] for r in V['headers'] if r['source']=='/(.*)' for h in r['headers'] if h['key']=='Content-Security-Policy')
 check('CanvasKit/CDN permissions are not added globally','flutter-canvaskit' not in global_csp and 'cdn.jsdelivr.net' not in global_csp)

class Site:
 def __init__(self):self.collect=[];self.tags=[];self.fail_ocr=False;self.fail_vault=False
 async def route(self,route):
  req=route.request;u=urlsplit(req.url)
  if 'google-analytics.com' in u.netloc or u.netloc=='www.google.com' or 'doubleclick.net' in u.netloc or 'googleadservices.com' in u.netloc:
   self.collect.append({'url':req.url,'body':req.post_data or ''});await route.fulfill(status=204);return
  if u.netloc=='www.googletagmanager.com':self.tags.append(req.url)
  if self.fail_ocr and ('cdn.jsdelivr.net' in u.netloc or '/vendor/tesseract/' in u.path):await route.abort();return
  if self.fail_vault and ('flutter-canvaskit' in req.url or u.path=='/app/main.dart.js'):await route.abort();return
  if u.netloc!='www.baatbanao.shop':await route.continue_();return
  path=u.path;file=R/('index.html' if path=='/' else 'app/index.html' if path=='/app' else path.lstrip('/'))
  if file.is_dir():file=file/'index.html'
  if not file.is_file():
   for rw in V.get('rewrites',[]):
    if rw['source']==path:file=R/rw['destination'].lstrip('/');break
  if not file.is_file():await route.fulfill(status=404,body='Not found');return
  h={}
  for rule in V['headers']:
   src=rule['source']
   if src=='/(.*)' or src==path or (src.endswith('/:path*') and path.startswith(src[:-8]+'/')):h.update({x['key']:x['value'] for x in rule['headers']})
  await route.fulfill(status=200,headers=h,content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream',body=file.read_bytes())
async def context(browser,site):
 ctx=await browser.new_context(viewport={'width':390,'height':844},service_workers='block');await ctx.route('**/*',site.route);return ctx,await ctx.new_page()
def image_data():
 im=Image.new('RGB',(1200,600),'white');d=ImageDraw.Draw(im);f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',44)
 for i,line in enumerate(['AUDIT TEST BILL','Customer: Ravi Kumar','Amount Due: INR 1450','Date: 06/10/2026']):d.text((50,65+i*105),line,fill='black',font=f)
 out=io.BytesIO();im.save(out,format='PNG');(OUT/'synthetic-ocr-bill.png').write_bytes(out.getvalue());return 'data:image/png;base64,'+base64.b64encode(out.getvalue()).decode()
async def browser_tests():
 async with async_playwright() as p:
  browser=await p.chromium.launch(args=['--no-sandbox'])
  site=Site();ctx,page=await context(browser,site);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script("localStorage.setItem('bb_cookie_consent_v2','accepted');localStorage.setItem('bb_cookie_notice_seen_v1','1');")
  await page.goto(BASE+'/?name=AUDIT_PRIVATE_NAME&phone=AUDIT_PRIVATE_PHONE#vasooli?name=AUDIT_PRIVATE_HASH',wait_until='load');await page.wait_for_timeout(4300)
  check('Legacy accepted/seen flags do not start GA in real browser',not site.tags and not site.collect)
  check('Explicit choice is shown again for legacy users',await page.locator('#bb-cookie-banner').count()==1)
  await page.locator('[data-v="accepted"]').click();await page.wait_for_timeout(2200)
  check('Allow stores explicit v3 consent',await page.evaluate("localStorage.getItem('bb_analytics_consent_v3')")=='accepted')
  # Count our initialization, not every auxiliary request Google's SDK may make.
  main_tag_requests = lambda: sum(urlsplit(url).path == '/gtag/js' for url in site.tags)
  tag_elements = await page.locator('script[src^="https://www.googletagmanager.com/gtag/js?"]').count()
  config_calls = await page.evaluate("dataLayer.filter(x=>x[0]==='config' && x[1]==='G-VG7Y7ND2PW').length")
  check('Allow initializes exactly one real Google tag',tag_elements==1 and config_calls==1 and main_tag_requests()>=1,str(site.tags))
  await page.evaluate("""()=>{BBAnalytics.track('message_generate',{name:'AUDIT_PRIVATE_NAME',phone:'AUDIT_PRIVATE_PHONE',message:'AUDIT_PRIVATE_TEXT',amount:998877,has_amount:true});const a=document.createElement('a');a.href='https://wa.me/0000000000?text=AUDIT_PRIVATE_MESSAGE';a.textContent='AUDIT_PRIVATE_LINK';a.addEventListener('click',e=>e.preventDefault());document.body.append(a);a.click();const f=document.createElement('form');f.id='AUDIT_PRIVATE_FORM';f.innerHTML='<input name="AUDIT_PRIVATE_FIELD" value="AUDIT_PRIVATE_FORM_VALUE">';f.addEventListener('submit',e=>e.preventDefault());document.body.append(f);f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));location.hash='#templates?name=AUDIT_PRIVATE_ROUTE';} """)
  await page.wait_for_timeout(6500)
  check('Real gtag emits intercepted collection requests',bool(site.collect))
  payload=json.dumps(site.collect)
  check('Real outgoing URL/body contains no private markers or customer amount','AUDIT_PRIVATE' not in payload and '998877' not in payload,payload[:400] if 'AUDIT_PRIVATE' in payload else '')
  parsed=[]
  for r in site.collect:
   q=parse_qs(urlsplit(r['url']).query)
   for line in (r['body'].splitlines() or ['']):parsed.append({**q,**parse_qs(line)})
  pv=[r for r in parsed if r.get('en')==['page_view']]
  check('Exactly two real pageviews for initial page plus one SPA route',len(pv)==2,str([r.get('en') for r in parsed]))
  check('Automatic enhanced form/click measurements are absent',not any(r.get('en') in [['form_start'],['form_submit'],['click']] for r in parsed))
  check('No JS errors on consented generator page',not errors,str(errors))
  (OUT/'intercepted-ga-requests.json').write_text(json.dumps(site.collect,indent=2))
  await page.evaluate("localStorage.setItem('bb_khata',JSON.stringify([{id:'audit-local',name:'AUDIT_LOCAL',amount:1}]));BBConsent.open();")
  before_reject_tag_requests = main_tag_requests()
  await page.locator('[data-v="rejected"]').click();await page.wait_for_timeout(1700)
  check('Reject reloads with no new Google tag',main_tag_requests()==before_reject_tag_requests and await page.locator('script[src^="https://www.googletagmanager.com/gtag/js?"]').count()==0,str(site.tags))
  check('Reject preserves saved ledger',await page.evaluate("JSON.parse(localStorage.getItem('bb_khata'))[0].id")=='audit-local')
  await ctx.close()
  # Actual application validation and event timing; no external WhatsApp opening.
  site=Site();ctx,page=await context(browser,site);await page.goto(BASE,wait_until='load')
  await page.evaluate("window.auditEvents=[];BBAnalytics.track=(n,p)=>auditEvents.push({n,p});navigate('vasooli');state.vasooliForm={name:'Audit',amount:'100',phone:'',relation:'Dost',language:'Hinglish',tone:'Friendly'};window.auditCanGenerate=bbCanGenerate;bbCanGenerate=()=>({allowed:false,remaining:0});handleGenerate();")
  check('Quota-rejected generation does not log success',await page.evaluate("auditEvents.filter(e=>e.n==='message_generate').length")==0)
  await page.evaluate("bbCanGenerate=auditCanGenerate;state.vasooliForm.phone='123';handleGenerate();")
  check('Invalid phone does not log generation success',await page.evaluate("auditEvents.filter(e=>e.n==='message_generate').length")==0)
  await page.evaluate("state.vasooliForm.phone='';handleGenerate();")
  check('Generation click does not prematurely count success',await page.evaluate("auditEvents.filter(e=>e.n==='message_generate').length")==0)
  await page.wait_for_timeout(650)
  check('Rendered successful generation logs exactly one event',await page.evaluate("auditEvents.filter(e=>e.n==='message_generate').length")==1)
  check('Successful generation actually produced message cards',await page.locator('#vasooli-output textarea').count()>0)
  await page.evaluate("window.auditWhatsAppCalls=0;triggerWhatsAppDirect=()=>auditWhatsAppCalls++;openWhatsAppWithText('Audit','123',{});")
  check('Invalid WhatsApp number is not counted',await page.evaluate("auditEvents.filter(e=>e.n==='whatsapp_open').length")==0)
  await page.evaluate("openWhatsAppWithText('Audit','',{});")
  check('Valid WhatsApp intent is counted once after handoff',await page.evaluate("auditEvents.filter(e=>e.n==='whatsapp_open').length===1 && auditWhatsAppCalls===1"))
  await page.evaluate("navigate('templates');state.templateForm={category:'friend',name:'Audit',phone:'123',amount:'100',language:'Hinglish'};handleTemplateGenerate();")
  check('Invalid template input does not count success',await page.evaluate("auditEvents.filter(e=>e.n==='template_generate').length")==0)
  await page.evaluate("state.templateForm.phone='';handleTemplateGenerate();")
  check('Rendered template generation counts exactly once',await page.evaluate("auditEvents.filter(e=>e.n==='template_generate').length")==1 and await page.locator('#template-output textarea').count()>0)
  await ctx.close()
  # Real OCR model + worker + WASM, not a stubbed recognizer.
  site=Site();ctx,page=await context(browser,site);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));await page.goto(BASE,wait_until='load')
  entry=await page.evaluate("async(data)=>{const blob=new Blob([Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0))],{type:'image/png'});await bbVoiceAssistant.runOcrOnImage(blob,'');await new Promise(r=>setTimeout(r,500));return bbVoiceAssistant.activeEntry;}",image_data())
  check('Real OCR recognizes clean synthetic amount',entry.get('amount')==1450,str(entry))
  check('Real OCR recognizes clean synthetic customer name',entry.get('name','').lower()=='ravi kumar')
  check('OCR does not automatically save a ledger transaction',await page.evaluate("state.khata.length")==0)
  check('Actual OCR has no uncaught worker/JS error',not errors,str(errors))
  await page.screenshot(path=str(OUT/'candidate-ocr-clean.png'),full_page=True)
  await page.evaluate("async()=>{const b=await(await fetch('/assets/sample-bills/sample-bill-1-kirana.jpg')).blob();await bbVoiceAssistant.runOcrOnImage(b,'');}");await page.wait_for_timeout(500)
  entry=await page.evaluate('bbVoiceAssistant.activeEntry')
  check('Shipped kirana bill takes the labelled due date, not the invoice date',entry.get('dueDate')=='2026-09-25',str(entry))
  check('Shipped kirana bill extracts amount and customer name',entry.get('amount')==1450 and entry.get('name','').lower()=='ramesh kumar',str(entry))
  check('Shipped kirana bill takes the phone from the customer block',entry.get('phone')=='9876543210',str(entry))
  check('Bill header phone is not misidentified as customer phone',await page.evaluate("bbVoiceAssistant.parseOcrText('STORE\\nMobile: 9999999999\\nCustomer: Ravi Kumar\\nAmount Due: INR 1450').phone")=='')
  # Genuinely uncertain scan (worker reports low confidence) must not prefill money.
  lowconf=await page.evaluate("""async()=>{bbVoiceAssistant._destroyWorker();const oldCreate=Tesseract.createWorker;Tesseract.createWorker=async()=>({recognize:async()=>({data:{text:'Customer: Someone\\nAmount Due: INR 100',confidence:40}}),terminate:async()=>{}});const b=await(await fetch('/assets/sample-bills/sample-bill-1-kirana.jpg')).blob();await bbVoiceAssistant.runOcrOnImage(b,'');await new Promise(r=>setTimeout(r,400));Tesseract.createWorker=oldCreate;return bbVoiceAssistant.activeEntry;}""")
  check('Low-confidence scan drops the amount but keeps labelled details',lowconf.get('_lowConfidence') and lowconf.get('amount')=='' and (lowconf.get('_amountSuspect') or {}).get('value')==100 and lowconf.get('name')=='Someone',str(lowconf))
  check('Unlabelled invoice/year digits are not guessed as an amount',await page.evaluate("bbVoiceAssistant.parseOcrText('Invoice 123456\\nCustomer: Ravi Kumar\\nDate 06/10/2026').amount")=='')
  # Simulated delayed completion exercises cancellation; the OCR above was real.
  cancelled=await page.evaluate("""async()=>{bbVoiceAssistant._destroyWorker();const oldCreate=Tesseract.createWorker;let finish;Tesseract.createWorker=async()=>({recognize:()=>new Promise(r=>finish=r),terminate:async()=>{}});const b=await(await fetch('/assets/sample-bills/sample-bill-1-kirana.jpg')).blob();const task=bbVoiceAssistant.runOcrOnImage(b,'');while(!finish)await new Promise(r=>setTimeout(r,10));bbVoiceAssistant.skipOcrToManual();finish({data:{text:'Customer: OLD RESULT\\nAmount Due: INR 100',confidence:99}});await task;await new Promise(r=>setTimeout(r,450));Tesseract.createWorker=oldCreate;return bbVoiceAssistant.activeEntry;}""")
  check('Cancelled OCR cannot overwrite manual entry',cancelled.get('_manual') and not cancelled.get('amount'))
  gate=await page.evaluate("""async()=>{const before=state.khata.length;bbVoiceAssistant.showResultModal({name:'Gate Test',amount:'500',phone:'9876543210',type:'lena',dueDate:'2026-10-10',_isOcr:true});bbVoiceAssistant.saveToKhataAction();const blocked=state.khata.length===before;const copyDisabled=document.querySelector('.bb-msg-copy-btn').disabled;bbVoiceAssistant.setReviewed(true);bbVoiceAssistant.saveToKhataAction();const saved=state.khata.length===before+1;const savedRow=state.khata[0];return {blocked,copyDisabled,saved,row:{name:savedRow.name,amount:savedRow.amount,dueDate:savedRow.dueDate}};}""")
  check('Review gate blocks save/copy before verification and allows after',gate['blocked'] and gate['saved'] and gate['copyDisabled'],str(gate))
  check('Review gate saves the reviewed values',gate['row']['amount']==500 and gate['row']['dueDate']=='2026-10-10',str(gate))
  relock=await page.evaluate("""()=>{bbVoiceAssistant.showResultModal({name:'Gate Test 2',amount:'100',type:'lena',_isOcr:true});bbVoiceAssistant.setReviewed(true);document.getElementById('bb-edit-amount').value='200';bbVoiceAssistant.syncActiveEntry();return bbVoiceAssistant.isReviewed();}""")
  check('Review gate re-locks after a field edit',relock==False)
  await ctx.close()
  site=Site();site.fail_ocr=True;ctx,page=await context(browser,site);await page.goto(BASE,wait_until='load');await page.evaluate("async(data)=>{await bbVoiceAssistant.runOcrOnImage(new Blob([Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0))],{type:'image/png'}),'');}",image_data())
  check('Blocked OCR dependencies produce honest manual fallback','Manual Entry' in await page.locator('#bb-assist-head-title').inner_text())
  await ctx.close()
  site=Site();ctx,page=await context(browser,site);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));await page.goto(BASE+'/app',wait_until='load');await page.wait_for_timeout(4500)
  check('Vault renders a real Flutter view under scoped CSP',await page.locator('flutter-view').count()==1)
  check('Vault first-frame event removes loading cover',await page.locator('#vault-loading').count()==0)
  check('Vault has no uncaught JS error',not errors,str(errors));await page.screenshot(path=str(OUT/'candidate-vault.png'),full_page=True);await ctx.close()
  site=Site();site.fail_vault=True;ctx,page=await context(browser,site);await page.goto(BASE+'/app',wait_until='load');await page.wait_for_timeout(20500)
  check('Blocked Vault build gives a visible recovery link',await page.locator('#vault-recovery').is_visible())
  check('Vault recovery warns against clearing local ledger storage','Do not clear browser storage' in await page.locator('#vault-load-message').inner_text())
  await ctx.close();await browser.close()
if __name__=='__main__':
 static()
 try:asyncio.run(browser_tests())
 except Exception as e:check('Browser test runner completed',False,str(e))
 (OUT/'browser-tests.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
 print('TOTAL',len(results),'PASSED',sum(x['passed'] for x in results),'FAILED',sum(not x['passed'] for x in results))
 raise SystemExit(0 if all(x['passed'] for x in results) else 1)
