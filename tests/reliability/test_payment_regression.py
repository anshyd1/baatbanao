import asyncio,json,mimetypes,re,xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit,parse_qs,urlencode
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
R=Path(__file__).resolve().parents[2];OUT=Path(__file__).resolve().parent/'results/payment';OUT.mkdir(parents=True,exist_ok=True)
V=json.loads((R/'vercel.json').read_text());results=[]
def check(name,value,detail=''):
 results.append({'test':name,'passed':bool(value),'detail':detail});print(('PASS' if value else 'FAIL'),name,detail,flush=True)

def static():
 sitemap=ET.fromstring((R/'sitemap.xml').read_text());urls=[e.text for e in sitemap.findall('{*}url/{*}loc')]
 robot=(R/'robots.txt').read_text();general=robot.split('User-agent: *',1)[1].split('User-agent:',1)[0]
 disallows=[line.split(':',1)[1].strip() for line in general.splitlines() if line.startswith('Disallow:')]
 check('All 26 sitemap URLs allowed by generic robots rules',len(urls)==26 and all(not any(urlsplit(u).path.startswith(x) for x in disallows if x) for u in urls))
 check('API remains disallowed for generic crawlers','/api/' in disallows)
 check('Payment HTML entrypoints identical',(R/'pay.html').read_bytes()==(R/'pay/index.html').read_bytes())
 for file in ['pay.html','pay/index.html']:
  s=BeautifulSoup((R/file).read_text(),'html.parser')
  check(file+' noindex and no-referrer',s.find('meta',attrs={'name':'robots'})['content']=='noindex, follow' and s.find('meta',attrs={'name':'referrer'})['content']=='no-referrer')
  check(file+' no tracking scripts',all('analytics' not in t.get('src','') and 'cookie' not in t.get('src','') and t.get('src') for t in s.find_all('script')))
  check(file+' shared renderer',bool(s.select('script[src="/pay.js"]')))
 for path in ['/pay','/pay/','/pay.html','/pay/index.html']:
  h={x['key']:x['value'] for rule in V['headers'] if rule['source']==path for x in rule['headers']}
  check(path+' exact privacy headers',h.get('X-Robots-Tag')=='noindex, follow' and h.get('Referrer-Policy')=='no-referrer' and h.get('Cache-Control')=='private, no-store' and "connect-src 'none'" in h.get('Content-Security-Policy',''))
 check('Download self canonical',BeautifulSoup((R/'download.html').read_text(),'html.parser').select_one('link[rel=canonical]')['href']=='https://www.baatbanao.shop/download')
 for src in ['/vault-download','/download.html']:
  check(src+' permanent redirect to clean URL',any(x['source']==src and x['destination']=='/download' and x['permanent'] for x in V['redirects']))
 check('No contradictory vault-download rewrite',not any(x['source']=='/vault-download' for x in V['rewrites']))
 check('No payment URLs in sitemap',all(not re.match(r'^/pay(?:\.html|/|$)',urlsplit(u).path) for u in urls))
 check('No payment analytics dependencies in shared renderer',not re.search(r'gtag|google-analytics|googletagmanager|fetch\(', (R/'pay.js').read_text()))

async def browser():
 async with async_playwright() as p:
  b=await p.chromium.launch(args=['--no-sandbox'])
  for label,path in [('clean','/pay'),('html','/pay.html'),('directory','/pay/index.html'),('slash','/pay/')]:
   ctx=await b.new_context(viewport={'width':390,'height':844},accept_downloads=True,service_workers='block')
   page=await ctx.new_page();errors=[];outside=[];served=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   async def route(r):
    u=urlsplit(r.request.url)
    if u.hostname!='www.baatbanao.shop':outside.append(r.request.url);await r.abort();return
    served.append({'path':u.path,'referer':r.request.headers.get('referer')})
    if u.path=='/':await r.fulfill(status=200,content_type='text/html',body='<h1>Home</h1>');return
    f=R/('pay/index.html' if u.path in ['/pay','/pay/'] else u.path.lstrip('/'))
    if not f.is_file():await r.fulfill(status=404,body='Not found');return
    headers={}
    for rule in V['headers']:
     if rule['source']=='/(.*)' or rule['source']==u.path:
      headers.update({x['key']:x['value'] for x in rule['headers']})
    # Content type is supplied separately; local handler models intended headers,
    # not a certification of Vercel's deployment routing.
    await r.fulfill(status=200,content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream',headers=headers,body=f.read_bytes())
   await page.route('**/*',route)
   await page.add_init_script("Object.defineProperty(navigator,'share',{value:undefined}); Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__copied=text}}});")
   q=urlencode({'pa':'audit-test@example','pn':'<img src=x onerror=alert(1)> AUDIT_TEST','am':'123.45','tn':'AUDIT_NOTE'})
   await page.goto('https://www.baatbanao.shop'+path+'?'+q,wait_until='load')
   await page.wait_for_selector('#qrbox svg')
   href=await page.locator('#openUpi').get_attribute('href');parsed=parse_qs(urlsplit(href).query)
   check(label+' renders local SVG and preserves payment params',parsed.get('pa')==['audit-test@example'] and parsed.get('am')==['123.45'] and parsed.get('tn')==['AUDIT_NOTE'])
   check(label+' payee text escaped',await page.locator('.name img').count()==0 and 'AUDIT_TEST' in await page.locator('.name').inner_text())
   await page.locator('#copyBtn').click();check(label+' clipboard uses generated UPI URI',await page.evaluate('window.__copied')==href)
   async with page.expect_download() as event:await page.locator('#shareQr').click()
   download=await event.value;target=OUT/(label+'-qr.png');await download.save_as(target)
   from PIL import Image
   with Image.open(target) as image:check(label+' local PNG export',image.size==(800,800) and image.format=='PNG')
   check(label+' no third-party requests',not outside,str(outside))
   check(label+' no uncaught JS errors',not errors,str(errors))
   if label=='clean':await page.screenshot(path=str(OUT/'payment-mobile.png'),full_page=True)
   await page.locator('a[href="/"]').click();await page.wait_for_url('https://www.baatbanao.shop/')
   check(label+' no payment referrer sent to homepage',next(x for x in reversed(served) if x['path']=='/')['referer'] is None)
   # Missing/invalid amount and compatibility with short query aliases.
   for suffix,expected in [('?pa=invalid','Invalid UPI'),('?pa=audit-test@example&am=Infinity','Invalid payment amount'),('?pa=audit-test@example&am=-1','Invalid payment amount')]:
    await page.goto('https://www.baatbanao.shop'+path+suffix);check(label+' rejects '+suffix,expected in await page.locator('#app').inner_text())
   await page.goto('https://www.baatbanao.shop'+path+'?u=audit-test@example&n=AUDIT_USER&t=AUDIT_NOTE');await page.wait_for_selector('#openUpi')
   check(label+' legacy params and optional amount', 'AUDIT_USER' in await page.locator('.name').inner_text() and 'Amount payer can enter' in await page.locator('.amount').inner_text())
   await ctx.close()
  await b.close()
if __name__=='__main__':
 static()
 try:asyncio.run(browser())
 except Exception as e:check('Browser test runner completed',False,str(e))
 (OUT/'browser-static-results.json').write_text(json.dumps(results,indent=2))
 print('TOTAL',len(results),'PASSED',sum(x['passed'] for x in results),'FAILED',sum(not x['passed'] for x in results))
 raise SystemExit(0 if all(x['passed'] for x in results) else 1)
