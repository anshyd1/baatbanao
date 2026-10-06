"""Finance/download regressions on disposable browser profiles.
Default: candidate responses served locally under production CSP. --live: actual site.
No real-user records, payments, WhatsApp sends, or production analytics hits.
"""
import asyncio,json,sys,importlib.util
from pathlib import Path
from urllib.parse import urlsplit
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent/'results'/('finance-live' if '--live' in sys.argv else 'finance-local');OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('base',Path(__file__).with_name('test_browser.py'));base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
LIVE='--live' in sys.argv;RESULTS=[];BASE='https://www.baatbanao.shop'
def check(name,ok,detail=''):
 RESULTS.append({'test':name,'passed':bool(ok),'detail':detail});print(('PASS' if ok else 'FAIL'),name,detail,flush=True)
class Site(base.Site):
 def __init__(self,release=None):super().__init__();self.release=release
 async def route(self,r):
  u=urlsplit(r.request.url)
  if u.netloc=='api.github.com' and self.release:
   if self.release=='403':await r.fulfill(status=403,body='{"message":"rate limited"}',content_type='application/json');return
   if self.release=='network':await r.abort();return
   assets=[{'name':n,'browser_download_url':'https://github.com/anshyd1/baatbanao/releases/download/vault-v0.4.5/'+n} for n in ['app-arm64-v8a-release.apk','app-armeabi-v7a-release.apk','app-x86_64-release.apk']]
   if self.release=='partial':assets=assets[:1]
   if self.release=='unsafe':assets[0]['browser_download_url']='https://untrusted.example/app.apk'
   await r.fulfill(status=200,content_type='application/json',body=json.dumps({'tag_name':'vault-v0.4.5','draft':False,'prerelease':False,'assets':assets}));return
  if LIVE:
   if 'google-analytics.com' in u.netloc or u.netloc=='www.google.com':await r.fulfill(status=204);return
   await r.continue_();return
  await super().route(r)
async def open_page(b,site=None,path='/'):
 ctx=await b.new_context(viewport={'width':360,'height':800},service_workers='block');await ctx.route('**/*',(site or Site()).route);await ctx.add_init_script("localStorage.setItem('bb_analytics_consent_v3','rejected');")
 page=await ctx.new_page();page.on('dialog',lambda d:asyncio.create_task(d.accept()));await page.goto(BASE+path,wait_until='load');return ctx,page
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(args=['--no-sandbox']);ctx,page=await open_page(b);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.evaluate("""()=>{window.auditEvents=[];BBAnalytics.track=(n,p)=>auditEvents.push({n,p});window.auditInvoice=()=>({...bbNewInvoiceDraft(),seller:'Audit Seller',buyer:'Audit Buyer',items:[{description:'Synthetic item',qty:1,rate:100}],payments:[]});} """)
  values=await page.evaluate("({round:[bbRoundMoney(1.005),bbRoundMoney(10.075),bbRoundMoney(.1+.2),bbRoundMoney(-1.005)],invalid:[NaN,Infinity,-1,0,.001,1e20,'',null,true,{}].every(x=>!bbValidMoney(x)),valid:[.01,.3,100,'100.25'].every(x=>bbValidMoney(x)),zero:bbValidMoney(0,true)})")
  check('Paise rounding handles decimal boundaries',values['round']==[1.01,10.08,.3,-1.01])
  check('Money validator rejects non-finite/sub-paise/non-numeric values',values['invalid'])
  check('Valid rupees and optional zero accepted',values['valid'] and values['zero'])
  x=await page.evaluate("""()=>{const original={...auditInvoice(),id:'audit-original',dueDate:'2000-01-01',payments:[{id:'audit-pay',amount:100,date:todayISO()}],updatedAt:1};bbSaveInvoices([original]);window.auditOriginal=JSON.stringify(bbLoadInvoices()[0]);bbDuplicateInvoice(original.id);return {id:state.invoiceDraft.id,info:bbInvoicePaymentInfo(state.invoiceDraft),dueDate:state.invoiceDraft.dueDate,payments:state.invoiceDraft.payments,hasUpdatedAt:Object.hasOwn(state.invoiceDraft,'updatedAt')};}""")
  check('Duplicate paid bill starts unpaid with full balance',x['info']['paid']==0 and x['info']['due']==100 and x['info']['status']=='unpaid')
  check('Duplicate has fresh identity and no stale payment/deadline metadata',x['id']!='audit-original' and x['dueDate']=='' and x['payments']==[] and not x['hasUpdatedAt'])
  await page.evaluate('bbSaveInvoice(false)')
  check('Saving duplicate preserves original receipt and adds one new bill',await page.evaluate("bbLoadInvoices().length===2 && JSON.stringify(bbLoadInvoices().find(x=>x.id==='audit-original'))===auditOriginal"))
  x=await page.evaluate("bbInvoicePaymentInfo({...auditInvoice(),items:[{description:'A',qty:1,rate:.1},{description:'B',qty:1,rate:.2}],payments:[{amount:.3}]})")
  check('Exact 30-paise payment is paid with zero residual',x['total']==.3 and x['due']==0 and x['status']=='paid')
  cases=[('mixed negative quantity',"d.items.push({description:'Bad',qty:-1,rate:10})"),('empty item description',"d.items.push({description:'',qty:1,rate:10})"),('negative rate',"d.items[0].rate=-1"),('infinite rate',"d.items[0].rate=Infinity"),('sub-paise rate',"d.items[0].rate=.001"),('blank rate',"d.items[0].rate=''"),('zero quantity',"d.items[0].qty=0"),('negative discount',"d.discount=-1"),('over-discount',"d.discount=101"),('invalid tax',"d.taxRate=101"),('non-finite tax',"d.taxRate=Infinity"),('overpaid edited total',"d.payments=[{amount:101}]"),('overflowing total',"d.items[0].qty=1e300")]
  for name,mutation in cases:
   x=await page.evaluate("()=>{bbSaveInvoices([]);auditEvents=[];const d=auditInvoice();"+mutation+";state.invoiceDraft=d;bbSaveInvoice(false);return {saved:bbLoadInvoices().length,event:auditEvents.some(e=>e.n==='invoice_save')};}")
   check('Invalid invoice rejected without success event: '+name,x['saved']==0 and not x['event'])
  x=await page.evaluate("""()=>{bbSaveInvoices([]);state.invoiceDraft={...auditInvoice(),items:[{description:'A',qty:2,rate:10}],discount:5,taxRate:18};bbSaveInvoice(false);return bbInvoiceTotals(bbLoadInvoices()[0]);}""")
  check('Valid discount plus GST totals match',x=={'sub':20,'discount':5,'tax':2.7,'total':17.7})
  await page.evaluate("window.auditPayId=bbLoadInvoices()[0].id;auditEvents=[];bbSaveInvoicePayment(auditPayId,17.701)")
  check('Sub-paise payment rejected without receipt',await page.evaluate('bbLoadInvoices()[0].payments.length===0'))
  await page.evaluate("bbSaveInvoicePayment(auditPayId,18)")
  check('Invoice overpayment rejected',await page.evaluate('bbLoadInvoices()[0].payments.length===0'))
  await page.evaluate("bbSaveInvoicePayment(auditPayId,Infinity)")
  check('Non-finite invoice payment rejected',await page.evaluate('bbLoadInvoices()[0].payments.length===0'))
  await page.evaluate("bbSaveInvoicePayment(auditPayId,.1);bbSaveInvoicePayment(auditPayId,17.6)")
  check('Valid partial then final payment closes balance exactly',await page.evaluate("bbInvoicePaymentInfo(bbLoadInvoices()[0]).status==='paid' && bbInvoicePaymentInfo(bbLoadInvoices()[0]).due===0 && bbLoadInvoices()[0].payments.length===2"))
  await page.locator('#bb-undo-toast button').click()
  check('Payment Undo restores preceding receipt history',await page.evaluate('bbLoadInvoices()[0].payments.length===1 && bbInvoicePaymentInfo(bbLoadInvoices()[0]).due===17.6'))
  await page.evaluate("bbEditInvoice(auditPayId);bbSaveInvoicePayment(auditPayId,1);auditEvents=[];state.invoiceDraft.buyer='Edited stale draft';bbSaveInvoice(false)")
  check('Stale edit cannot overwrite a newly recorded payment',await page.evaluate("bbLoadInvoices()[0].payments.length===2 && bbLoadInvoices()[0].buyer==='Audit Buyer' && !auditEvents.some(e=>e.n==='invoice_save')"))
  await page.evaluate("bbSaveInvoices(Array.from({length:300},(_,i)=>({...auditInvoice(),id:'legacy-'+i,number:'LEGACY-'+i})));state.invoiceDraft=auditInvoice();bbSaveInvoice(false)")
  check('Saving bill 301 does not silently delete the oldest bill',await page.evaluate("bbLoadInvoices().length===301 && bbLoadInvoices().some(x=>x.id==='legacy-299')"))
  x=await page.evaluate("""()=>{bbSaveInvoices([]);navigate('invoice-new');state.invoiceDraft=auditInvoice();auditEvents=[];const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='bb_invoices_v1')throw new DOMException('Full','QuotaExceededError');return original.call(this,k,v);};try{bbSaveInvoice(false);return {saved:bbLoadInvoices().length,event:auditEvents.some(e=>e.n==='invoice_save'),draft:!!state.invoiceDraft};}finally{Storage.prototype.setItem=original;}}""")
  check('Quota failure keeps draft and does not report invoice success',x=={'saved':0,'event':False,'draft':True})
  x=await page.evaluate("async()=>{const inv=auditInvoice();const b=await bbCreateInvoicePdf(inv);const bytes=new Uint8Array(await b.arrayBuffer());return {pdf:String.fromCharCode(...bytes.slice(0,5)),size:b.size};}")
  check('Valid invoice still produces a real PDF',x['pdf']=='%PDF-' and x['size']>1000)
  x=await page.evaluate("async()=>{const inv=auditInvoice();inv.items[0].rate=-1;try{await bbCreateInvoicePdf(inv);return false;}catch(e){return true;}}")
  check('Invalid PDF request cannot reuse an old preview',x)
  await page.evaluate("document.getElementById('bb-invoice-preview')?.remove();bbSaveInvoices([auditInvoice()]);navigate('billing')")
  check('Billing layout fits 360px mobile viewport',await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  await page.screenshot(path=str(OUT/'billing-mobile.png'),full_page=True)
  await page.evaluate("""()=>{window.auditAdvance=()=>{const d=bbHisaabLoad();d.entries=[{id:'audit-advance',bookId:'business',type:'advance',amount:500,status:'open',date:todayISO(),name:'Audit',purpose:'Synthetic purchase'}];bbHisaabSave(d);};auditAdvance();navigate('hisaab');bbSettleHisaab('audit-advance','returned');}""")
  x=await page.evaluate("(()=>{const es=bbHisaabLoad().entries;return {incoming:es.filter(e=>bbHisaabInfo(e).sign>0).reduce((s,e)=>s+e.amount,0),outgoing:es.filter(e=>bbHisaabInfo(e).sign<0).reduce((s,e)=>s+e.amount,0),open:es.filter(e=>e.status==='open').length,linked:es.filter(e=>e.returnFor==='audit-advance').length};})()")
  check('Returned advance preserves both cash-out and cash-in',x=={'incoming':500,'outgoing':500,'open':0,'linked':1})
  await page.evaluate("bbSettleHisaab('audit-advance','returned')")
  check('Double settlement cannot create a duplicate credit',await page.evaluate('bbHisaabLoad().entries.length===2'))
  await page.locator('#bb-undo-toast button').click()
  check('Settlement Undo restores the one open advance',await page.evaluate("bbHisaabLoad().entries.length===1 && bbHisaabLoad().entries[0].status==='open'"))
  await page.evaluate("bbSettleHisaab('audit-advance','expense')")
  check('Expense settlement remains one cash-out, not a second debit',await page.evaluate("bbHisaabLoad().entries.length===1 && bbHisaabLoad().entries[0].type==='expense' && bbHisaabInfo(bbHisaabLoad().entries[0]).sign===-1"))
  await page.evaluate("auditAdvance();bbSettleHisaab('audit-advance','returned');bbDeleteHisaab(bbHisaabLoad().entries.find(e=>e.returnFor).id)")
  check('Deleting return reopens the original advance',await page.evaluate("bbHisaabLoad().entries.length===1 && bbHisaabLoad().entries[0].status==='open'"))
  await page.locator('#bb-undo-toast button').click()
  check('Delete-return Undo restores linked accounting pair',await page.evaluate('bbHisaabLoad().entries.length===2'))
  await page.evaluate("bbDeleteHisaab('audit-advance')")
  check('Deleting original advance removes its linked return together',await page.evaluate('bbHisaabLoad().entries.length===0'))
  await page.locator('#bb-undo-toast button').click()
  check('Delete-advance Undo restores both records',await page.evaluate('bbHisaabLoad().entries.length===2'))
  for value in ['-1','0','0.001']:
   await page.evaluate("bbOpenHisaabAdd();auditEvents=[]")
   await page.locator('#hisaab-amount').fill(value);await page.evaluate('bbSaveHisaab()')
   check('Hisaab rejects invalid amount '+value,await page.evaluate("!auditEvents.some(e=>e.n==='hisaab_add') && bbHisaabLoad().entries.length===2"))
  await page.locator('#hisaab-amount').fill('12.34');await page.evaluate('bbSaveHisaab()')
  check('Valid two-decimal Hisaab entry saves',await page.evaluate('bbHisaabLoad().entries.at(-1).amount===12.34'))
  await page.evaluate("navigate('templates');state.templateForm={category:'friend',name:'Audit',phone:'',amount:'-10',language:'Hinglish'};auditEvents=[];handleTemplateGenerate()")
  check('Template invalid amount does not generate success',await page.evaluate("!auditEvents.some(e=>e.n==='template_generate')"))
  await page.evaluate("navigate('khata-form');state.khataForm={name:'Audit',phone:'',amount:'100',paidAmount:'0.001'};saveKhataForm()")
  check('Khata rejects sub-paise paid amount',await page.evaluate('state.khata.length===0'))
  x=await page.evaluate("(()=>{const k={amount:.1+.2,paidAmount:.3,transactions:[{type:'gave',amount:.1},{type:'gave',amount:.2},{type:'received',amount:.3}]};syncKhataFromLedger(k);return {balance:ledgerBalance(k),outstanding:outstandingAmount(k),status:k.status};})()")
  check('Customer ledger exact decimal payment has no phantom debt',x=={'balance':0,'outstanding':0,'status':'paid'})
  await page.evaluate("bbVoiceAssistant.showResultModal({name:'Audit',amount:-1,phone:'',type:'lena',_manual:true});bbVoiceAssistant.saveToKhataAction()")
  check('Voice/manual assistant cannot save a negative amount',await page.evaluate("state.khata.length===0 && JSON.parse(localStorage.getItem('bb_khata')||'[]').length===0"))
  await page.evaluate('bbVoiceAssistant.closeModal()')
  check('Financial flows produce no uncaught JS errors',not errors,str(errors))
  await ctx.close()
  for mode in ['403','network','partial','unsafe','complete']:
   ctx,page=await open_page(b,Site(mode),'/download');await page.wait_for_timeout(200)
   label=await page.locator('#status-toast').inner_text();hrefs=[await page.locator('#'+x).get_attribute('href') for x in ['arm64','armv7','x64']]
   if mode=='complete':
    check('Complete release updates all three architectures consistently',all('/vault-v0.4.5/' in x for x in hrefs))
    check('Visible download version stays consistent', 'v0.4.5' in await page.locator('#version-pill').inner_text() and 'v0.4.5' in await page.locator('#release-version').inner_text())
   else:
    check('Download '+mode+' retains pinned usable links',all('/vault-v0.4.4/' in x for x in hrefs))
    check('Download '+mode+' shows honest unverified fallback','unavailable' in label and 'verified' not in label.lower())
   check('Download layout fits mobile: '+mode,await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   if mode=='403':await page.screenshot(path=str(OUT/'download-fallback-mobile.png'),full_page=True)
   await ctx.close()
  ctx=await b.new_context(service_workers='block');await ctx.route('**/*',Site().route)
  await ctx.add_init_script("localStorage.setItem('bb_analytics_consent_v3','rejected');localStorage.setItem('bb_khata',JSON.stringify([{id:'synthetic-not-demo',name:'Ramesh bhai',amount:2500,status:'pending'}]));")
  page=await ctx.new_page();await page.goto(BASE,wait_until='load')
  check('Startup never deletes a ledger because its name/amount resembles demo data',await page.evaluate("state.khata.length===1 && JSON.parse(localStorage.getItem('bb_khata'))[0].id==='synthetic-not-demo'"))
  await ctx.close()
  ctx=await b.new_context(java_script_enabled=False,viewport={'width':360,'height':800});site=Site();await ctx.route('**/*',site.route);page=await ctx.new_page();await page.goto(BASE+'/download')
  check('Downloads remain usable without JavaScript','/vault-v0.4.4/' in await page.locator('#arm64').get_attribute('href'))
  text=await page.locator('body').inner_text();check('Download no longer makes unsupported encrypted-SQLite claim','Encrypted On-Device Local SQLite' not in text and 'JSON/preferences' in text)
  await ctx.close();await b.close()
if __name__=='__main__':
 try:asyncio.run(main())
 except Exception as e:check('Finance test runner completed',False,str(e))
 (OUT/'results.json').write_text(json.dumps(RESULTS,indent=2));print('FINANCE',len(RESULTS),'PASSED',sum(x['passed'] for x in RESULTS),'FAILED',sum(not x['passed'] for x in RESULTS));raise SystemExit(0 if all(x['passed'] for x in RESULTS) else 1)
