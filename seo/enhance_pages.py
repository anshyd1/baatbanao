# -*- coding: utf-8 -*-
"""
BaatBanao — SEO / AdSense page enhancer (run AFTER seo/generate_pages.py).

Idempotent: every page gets a <!-- bb-enhanced:v2 --> marker; re-running only
refreshes the enhanced blocks. Adds to every guide/article page:
  * breadcrumb (visible + BreadcrumbList JSON-LD)
  * author byline (Person, links to /author/ansh-yadav) + updated date + read time
  * unique featured image (assets/blog/<slug>.jpg) + og:image/twitter:image
  * Article JSON-LD upgrade: author Person, publisher, image, dateModified
  * tightened meta descriptions (<=155 chars)
  * standard footer with About/Contact/Privacy/Terms/Disclaimer/Editorial links
  * mobile sticky "Free tool" CTA
Also writes: guides.html (hub page) and sitemap.xml (with lastmod + image tags).

Usage:  python3 seo/enhance_pages.py
"""
import re, json, os, html, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://www.baatbanao.shop"
TODAY = datetime.date.today().isoformat()
AUTHOR = {"@type": "Person", "name": "Ansh Yadav", "url": BASE + "/author/ansh-yadav"}
PUBLISHER = {"@type": "Organization", "name": "BaatBanao", "url": BASE,
             "logo": {"@type": "ImageObject", "url": BASE + "/assets/icon-512.png", "width": 512, "height": 512}}
MARK = "<!-- bb-enhanced:v2 -->"

TOOL_HTML = r"""<!-- bb-tool --><section class="bb-tool" id="tool" aria-labelledby="tool-h">
<h2 id="tool-h">UPI payment link banao — free, 10 second mein</h2>
<p class="hint">UPI ID aur amount daalo. Link + QR yahin banega, kuch bhi server par nahi jaata.</p>
<div class="bb-tool-grid">
<label>Aapki UPI ID <input id="t-upi" placeholder="naam@upi" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="email"></label>
<label>Payee naam <input id="t-name" placeholder="Ramesh Kirana Store" maxlength="40"></label>
<label>Amount ₹ (optional) <input id="t-amt" type="number" inputmode="decimal" min="1" step="1" placeholder="500"></label>
<label>Note (optional) <input id="t-note" placeholder="Sept ka udhaar" maxlength="40"></label>
</div>
<div class="err" id="t-err" role="alert"></div>
<button class="bb-btn" type="button" onclick="bbMakeUpi()">Link + QR banao →</button>
<div class="bb-out" id="t-out" hidden>
<div class="qrwrap"><div id="t-qr" aria-label="UPI QR code"></div><div style="flex:1;min-width:220px">
<small>UPI deep link (mobile par seedha app kholega):</small><code id="t-link"></code>
<small>Share link (kisi bhi phone/desktop par khulega — QR + Open UPI button):</small><code id="t-web"></code>
<div class="acts"><button type="button" onclick="bbCopy('t-web',this)">Copy share link</button><button type="button" onclick="bbCopy('t-link',this)">Copy UPI link</button><a class="wa" id="t-wa" target="_blank" rel="noopener">WhatsApp par bhejo</a><a class="pay" id="t-open">Open UPI app</a></div>
</div></div>
<p style="margin:14px 0 0;font-size:13.5px;color:#6b6058">Tip: reminder message ke saath link bhejna ho toh <a href="/#vasooli">Vasooli Mode</a> mein UPI ID save karo — har message ke neeche link auto-attach hoga.</p>
</div>
<script src="/vendor/qrcode.js" defer></script>
<script>
function bbMakeUpi(){var pa=(document.getElementById('t-upi').value||'').trim().toLowerCase(),pn=(document.getElementById('t-name').value||'').trim(),am=(document.getElementById('t-amt').value||'').trim(),tn=(document.getElementById('t-note').value||'').trim(),err=document.getElementById('t-err');
if(!/^[a-z0-9.\-_]{2,}@[a-z][a-z0-9]{1,}$/.test(pa)){err.textContent='Sahi UPI ID daalo, jaise naam@okaxis ya 98xxxxxxx@ybl';return;}
if(am&&(!(Number(am)>0)||Number(am)>1000000)){err.textContent='Amount 1 se 10,00,000 ke beech rakho';return;}
err.textContent='';var q='pa='+encodeURIComponent(pa)+'&pn='+encodeURIComponent(pn||'Payment')+(am?'&am='+encodeURIComponent(Number(am).toFixed(2)):'')+'&cu=INR'+(tn?'&tn='+encodeURIComponent(tn):'');
var upi='upi://pay?'+q,web='https://www.baatbanao.shop/pay?'+q;
document.getElementById('t-link').textContent=upi;document.getElementById('t-web').textContent=web;document.getElementById('t-open').href=upi;
var msg=(pn?pn+' ko ':'')+(am?'₹'+Number(am).toLocaleString('en-IN')+' ':'')+'pay karne ka link: '+web+(tn?'\n('+tn+')':'')+'\n\n— via BaatBanao';document.getElementById('t-wa').href='https://api.whatsapp.com/send?text='+encodeURIComponent(msg);
var box=document.getElementById('t-qr');box.innerHTML='';try{if(window.qrcode){var qr=qrcode(0,'M');qr.addData(upi);qr.make();box.innerHTML=qr.createSvgTag({cellSize:5,margin:2,scalable:true});}else{box.textContent='QR load ho raha hai…';setTimeout(bbMakeUpi,600);return;}}catch(e){box.textContent='QR nahi bana';}
var out=document.getElementById('t-out');out.hidden=false;out.scrollIntoView({behavior:'smooth',block:'nearest'});
try{if(typeof gtag==='function')gtag('event','upi_link_tool_generate',{has_amount:!!am});}catch(e){}}
function bbCopy(id,btn){var t=document.getElementById(id).textContent,done=function(){var o=btn.textContent;btn.textContent='Copied ✓';setTimeout(function(){btn.textContent=o},1500)};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,function(){bbCopyFallback(t);done();});}else{bbCopyFallback(t);done();}}
function bbCopyFallback(t){var ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}ta.remove();}
</script><!-- /bb-tool -->"""


# slug -> (category, short crumb title, new meta description, tool deep-link)
PAGES = {
 "dost-se-paise-wapas-message": ("Dosti & Personal", "Dost se paise wapas",
   "Dost se paise wapas maangne ke 12 ready Hinglish WhatsApp messages — friendly se firm tak, bina rishta kharab kiye. Free customize + UPI link.",
   "/#vasooli?rel=Dost&lang=Hinglish"),
 "paise-mangne-ke-message": ("Ready Messages", "Paise mangne ke message",
   "15+ paise mangne ke ready WhatsApp messages — friendly, polite, funny aur professional. Copy karo, naam-amount badlo, UPI link ke saath bhejo.",
   "/#vasooli"),
 "paise-wapas-mangne-ka-tarika": ("Dosti & Personal", "Paise wapas mangne ka tarika",
   "Paise wapas mangne ka sahi tarika: 5 steps, sahi timing aur ready messages — bina awkward hue, bina rishta kharab kiye. Free tool ke saath.",
   "/#vasooli"),
 "kirayedaar-rent-reminder-message": ("Rent & Property", "Rent reminder",
   "Kirayedaar ko rent reminder kaise bhejein — polite se firm tak ready WhatsApp messages, due date aur UPI link ke saath. Landlord guide 2026.",
   "/#vasooli?rel=Tenant&lang=Hindi"),
 "kirana-shop-udhaar-reminder": ("Dukaan & Shop", "Dukaan udhaar reminder",
   "Kirana/dukaan ka udhaar wapas maangne ke ready WhatsApp messages — customer naraz na ho, hisaab bhi clear. Free digital khata + UPI link.",
   "/#vasooli?rel=Shop%20Khata"),
 "tuition-fees-reminder-message": ("Tuition & Fees", "Tuition fees reminder",
   "Parents ko tuition fees reminder kaise bhejein — respectful ready messages (Hinglish/English), due date aur UPI link ke saath. Teachers ke liye.",
   "/#vasooli?rel=Student%2FParent"),
 "freelancer-payment-reminder-message": ("Freelance & Business", "Freelancer payment reminder",
   "Freelancer payment reminder message for clients — polite invoice follow-ups, overdue templates aur UPI link. Copy-paste ready, free tool.",
   "/#vasooli?rel=Client&lang=English"),
 "client-invoice-follow-up-message": ("Freelance & Business", "Client invoice follow-up",
   "Client invoice follow-up message templates — 1st reminder se final notice tak, professional aur polite. Copy-paste + free reminder tool.",
   "/#vasooli?rel=Client&lang=English&tone=Polite"),
 "payment-reminder-customer-whatsapp": ("Dukaan & Shop", "Customer payment reminder",
   "Customer ko WhatsApp par payment reminder kaise bhejein — shop, service aur B2B ke ready messages, UPI link ke saath. Free tool, no login.",
   "/#vasooli?rel=Customer"),
 "polite-payment-reminder-message-english": ("Freelance & Business", "Polite reminders (English)",
   "10 polite payment reminder messages in English for clients and customers — friendly, firm and professional templates you can copy today.",
   "/#vasooli?rel=Client&lang=English&tone=Polite"),
 "final-payment-reminder-message": ("Freelance & Business", "Final payment reminder",
   "How to write a firm final payment reminder without threats — professional WhatsApp and email examples with a clear deadline and next step.",
   "/#vasooli?rel=Client&lang=English&tone=Strong"),
 "payment-reminder-no-reply-message": ("Freelance & Business", "No reply follow-up",
   "No reply after a payment reminder? Use this 4-step follow-up sequence with ready messages — firm, professional and free of spam or threats.",
   "/#vasooli?rel=Client&lang=English&tone=Polite"),
 "udhar-funny-shayari": ("Funny & Shayari", "Udhar funny shayari",
   "20+ udhar wapas mangne ki funny shayari aur one-liners — WhatsApp status aur dost ke liye. Hasi mein hisaab clear, rishta bhi safe.",
   "/#vasooli?tone=Funny"),
 "bhojpuri-udhaar-message": ("Regional", "Bhojpuri udhaar message",
   "Bhojpuri mein udhaar wapas maangne ke ready WhatsApp messages — pyaar se, sammaan se aur thoda mazaak ke saath. Free tool, UPI link ke saath.",
   "/#vasooli?lang=Bhojpuri"),
 "upi-payment-link-generator": ("Tools", "UPI payment link generator",
   "Free UPI payment link generator — UPI ID aur amount daalo, 1-tap pay link + QR banao aur WhatsApp par bhejo. Koi login nahi, 100% free.",
   "#tool"),
 "udhaar-khata-kaise-banaayein": ("Tools", "Udhaar khata guide",
   "Udhaar khata kaise banaayein — bina app install, phone mein free digital khata: entries, reminders, UPI link. Dukaan aur personal dono ke liye.",
   "/#khata"),
}
# legal/info pages: only footer + css + schema touch-ups (no byline/hero)
INFO_PAGES = ["about", "contact", "privacy", "terms", "disclaimer", "editorial-policy", "author-ansh-yadav"]

FOOTER = """<footer class="bb-foot"><div class="in">
<div><div class="brand">🪙 BaatBanao</div><p>Free WhatsApp payment reminder + UPI link tool. Hinglish, Hindi, Bhojpuri aur English mein — paisa bhi wapas, rishta bhi safe. 100% client-side, koi login nahi.</p><p style="margin-top:8px"><a href="/" style="display:inline;color:#a53228;font-weight:800">Open the free tool →</a></p></div>
<div><h4>Guides</h4><a href="/guides">All guides</a><a href="/dost-se-paise-wapas-message">Dost se paise wapas</a><a href="/kirayedaar-rent-reminder-message">Rent reminder</a><a href="/freelancer-payment-reminder-message">Freelancer payment</a><a href="/upi-payment-link-generator">UPI link generator</a><a href="/udhaar-khata-kaise-banaayein">Udhaar khata</a></div>
<div><h4>BaatBanao</h4><a href="/about">About</a><a href="/author/ansh-yadav">Author</a><a href="/editorial-policy">Editorial policy</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/disclaimer">Disclaimer</a></div>
<div class="copy">© 2026 BaatBanao · Made in India 🇮🇳 · Content is general communication guidance, not legal or financial advice.</div>
</div></footer>"""

def read(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()
def write(p, s): open(os.path.join(ROOT, p), "w", encoding="utf-8").write(s)


def head_add(s, frag):
    """Insert `frag` at the end of <head>. Generator pages omit </head>, so fall back to before <body."""
    if "</head>" in s:
        return s.replace("</head>", frag + "\n</head>", 1)
    m = re.search(r"<body[\s>]", s)
    return s[:m.start()] + frag + "\n" + s[m.start():] if m else s + frag

def strip_old(s):
    """Remove blocks from a previous enhancer run so the script is idempotent."""
    s = re.sub(r"<!-- bb-crumb:v\d+ -->.*?<!-- /bb-crumb -->\n?", "", s, flags=re.S)
    s = re.sub(r"<!-- bb-enhanced:v\d+ -->.*?<!-- /bb-enhanced -->\n?", "", s, flags=re.S)
    s = re.sub(r"<!-- bb-tool -->.*?<!-- /bb-tool -->\n?", "", s, flags=re.S)
    s = re.sub(r'<script type="application/ld\+json" data-bb="[^"]+">.*?</script>\n?', "", s, flags=re.S)
    s = re.sub(r'<link rel="stylesheet" href="/blog\.css[^"]*"[^>]*>\n?', "", s)
    s = re.sub(r'<meta (?:property="og:image:(?:width|height)"|name="twitter:image"|name="author") content="[^"]*"\s*/?>\n?', "", s)
    s = re.sub(r'<footer class="bb-foot">.*?</footer>\n?', "", s, flags=re.S)
    s = re.sub(r'<div class="bb-sticky">.*?</div>\n?', "", s, flags=re.S)
    return s

def words(s):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return len(html.unescape(t).split())

def set_meta(s, attr, key, value):
    pat = re.compile(r'<meta %s="%s" content="[^"]*"\s*/?>' % (attr, re.escape(key)))
    tag = '<meta %s="%s" content="%s"/>' % (attr, key, html.escape(value, quote=True))
    return pat.sub(tag, s, count=1) if pat.search(s) else head_add(s, tag)

def upgrade_article_ld(s, slug, img_url, date_pub_default="2026-09-17"):
    def fix(m):
        raw = m.group(1)
        try: data = json.loads(raw)
        except Exception: return m.group(0)
        if data.get("@type") not in ("Article", "BlogPosting", "TechArticle"): return m.group(0)
        data["author"] = AUTHOR
        data["publisher"] = PUBLISHER
        data["image"] = {"@type": "ImageObject", "url": img_url, "width": 1200, "height": 630}
        data.setdefault("datePublished", date_pub_default)
        data["dateModified"] = TODAY
        data.setdefault("mainEntityOfPage", BASE + "/" + slug)
        data.setdefault("inLanguage", "hi")
        return '<script type="application/ld+json">%s</script>' % json.dumps(data, ensure_ascii=False)
    return re.sub(r'<script type="application/ld\+json">(.*?)</script>', fix, s, count=1, flags=re.S)

def breadcrumb_ld(slug, cat, title):
    data = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Guides", "item": BASE + "/guides"},
        {"@type": "ListItem", "position": 3, "name": title, "item": BASE + "/" + slug}]}
    return '<script type="application/ld+json" data-bb="crumb">%s</script>' % json.dumps(data, ensure_ascii=False)

def enhance_article(slug):
    fn = slug + ".html"
    s = strip_old(read(fn))
    cat, crumb, desc, tool = PAGES[slug]
    img_rel = "/assets/blog/%s.jpg" % slug
    img_url = BASE + img_rel
    h1m = re.search(r"<h1[^>]*>(.*?)</h1>", s, re.S)
    h1 = re.sub(r"<[^>]+>", "", h1m.group(1)).strip() if h1m else crumb
    pub = re.search(r'"datePublished"\s*:\s*"([^"]+)"', s)
    pub_h = datetime.date.fromisoformat(pub.group(1)[:10]).strftime("%d %b %Y") if pub else "17 Sep 2026"
    mins = max(2, round(words(s) / 200))
    # head
    s = set_meta(s, "name", "description", desc)
    s = set_meta(s, "property", "og:description", desc)
    s = set_meta(s, "name", "twitter:description", desc)
    s = set_meta(s, "property", "og:image", img_url)
    s = head_add(s, '<meta property="og:image:width" content="1200"/>\n<meta property="og:image:height" content="630"/>\n'
                  '<meta name="twitter:card" content="summary_large_image"/>\n<meta name="twitter:image" content="%s"/>\n'
                  '<meta name="author" content="Ansh Yadav"/>\n<link rel="stylesheet" href="/blog.css?v=3">' % img_url)
    s = re.sub(r'(<meta name="twitter:card" content="summary_large_image"/>\n)(?=[\s\S]*<meta name="twitter:card")', "", s, count=1)  # de-dupe if page already had it
    s = upgrade_article_ld(s, slug, img_url)
    s = head_add(s, breadcrumb_ld(slug, cat, crumb))
    # body blocks (after </h1>)
    crumb_html = ('<!-- bb-crumb:v2 --><nav class="bb-crumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><a href="/guides">Guides</a><span>›</span><span>%s</span></nav><!-- /bb-crumb -->' % html.escape(crumb))
    rest = (MARK +
      '\n<div class="bb-byline"><span class="av" aria-hidden="true">AY</span><span><b><a href="/author/ansh-yadav" rel="author">Ansh Yadav</a></b> · Creator, BaatBanao</span>'
      '<span class="sep">|</span><span>Published %s · Updated <time datetime="%s">%s</time></span><span class="sep">|</span><span>%d min read</span></div>' % (pub_h, TODAY, datetime.date.today().strftime("%d %b %Y"), mins) +
      '\n<img class="bb-hero" src="%s" width="1200" height="630" alt="%s" fetchpriority="high" decoding="async">' % (img_rel, html.escape(h1 + " — BaatBanao guide", quote=True)) +
      '\n<!-- /bb-enhanced -->')
    s = re.sub(r"(<h1[^>]*>.*?</h1>)", lambda m: crumb_html + "\n" + m.group(1) + "\n" + rest, s, count=1, flags=re.S)
    if slug == "upi-payment-link-generator":
        s = s.replace("<!-- /bb-enhanced -->", "<!-- /bb-enhanced -->\n" + TOOL_HTML, 1)
        s = s.replace("Free Tool + 5 Steps Guide", "Free Tool + 5 Steps Guide", 1)
    # footer + sticky cta
    s = re.sub(r"<footer>.*?</footer>", "", s, flags=re.S)  # old plain footer
    s = re.sub(r"<footer(?![^>]*bb-foot)[^>]*>.*?</footer>", "", s, flags=re.S)
    sticky = '<div class="bb-sticky"><a href="%s">⚡ Free reminder tool kholo →</a></div>' % (tool if tool.startswith("#") else BASE + tool)
    s = s.replace("</body>", FOOTER + "\n" + sticky + "\n</body>", 1)
    write(fn, s)
    return words(s), mins

def enhance_info(slug):
    fn = slug + ".html"
    s = strip_old(read(fn))
    s = head_add(s, '<link rel="stylesheet" href="/blog.css?v=3">')
    s = re.sub(r"<footer(?![^>]*bb-foot)[^>]*>.*?</footer>", "", s, flags=re.S)
    s = s.replace("</body>", FOOTER + "\n</body>", 1)
    write(fn, s)

def build_guides():
    cards = []
    for slug, (cat, crumb, desc, tool) in PAGES.items():
        cards.append('<a class="bb-card" href="/%s"><img src="/assets/blog/%s.jpg" alt="%s" loading="lazy" width="1200" height="630"><div class="b"><div class="k">%s</div><h3>%s</h3><p>%s</p></div></a>'
                     % (slug, slug, html.escape(crumb), html.escape(cat), html.escape(crumb), html.escape(desc)))
    ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "BaatBanao Guides — payment reminder messages, UPI & khata",
          "url": BASE + "/guides", "inLanguage": "hi", "publisher": PUBLISHER,
          "hasPart": [{"@type": "Article", "name": v[1], "url": BASE + "/" + k} for k, v in PAGES.items()]}
    page = f"""<!doctype html><html lang="hi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment Reminder Guides — WhatsApp messages, UPI link & Udhaar Khata | BaatBanao</title>
<meta name="description" content="Saare BaatBanao guides ek jagah: dost, kirayedaar, customer, client aur freelancer ke liye ready payment reminder messages, UPI link generator aur udhaar khata."/>
<link rel="canonical" href="{BASE}/guides"/><meta name="robots" content="index,follow"/>
<meta property="og:type" content="website"/><meta property="og:title" content="BaatBanao Guides — payment reminder messages, UPI & khata"/><meta property="og:description" content="Ready WhatsApp payment reminder messages, UPI link tool aur udhaar khata guides — sab free."/><meta property="og:url" content="{BASE}/guides"/><meta property="og:image" content="{BASE}/assets/og-share-card.jpg"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:image" content="{BASE}/assets/og-share-card.jpg"/>
<link rel="icon" href="/assets/icon-192.png"><link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><meta name="theme-color" content="#FFF9E8">
<style>*{{box-sizing:border-box}}body{{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#2b2420;background:#fffdfa;line-height:1.6}}.hd{{position:sticky;top:0;z-index:9;display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:rgba(255,253,250,.94);backdrop-filter:blur(8px);border-bottom:1px solid #eee0d6}}.lg{{font-weight:900;font-size:18px;text-decoration:none;color:#2b2420}}.cta{{background:#FF725F;color:#fff;text-decoration:none;font-weight:800;padding:10px 16px;border-radius:12px}}main{{max-width:1000px;margin:auto;padding:28px 20px 40px}}h1{{font-size:clamp(28px,5vw,40px);line-height:1.15;margin:8px 0 10px}}.lead{{font-size:17px;color:#665954;max-width:720px}}h2{{margin:34px 0 0;font-size:22px}}</style>
<link rel="stylesheet" href="/blog.css?v=3">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head><body>
<header class="hd"><a class="lg" href="/">🪙 BaatBanao</a><a class="cta" href="/#vasooli">Free Tool Kholo →</a></header>
<main>
<nav class="bb-crumb" aria-label="Breadcrumb"><a href="/">Home</a><span>›</span><span>Guides</span></nav>
<h1>Payment reminder guides — messages jo kaam karein</h1>
<p class="lead">Har situation ke liye ready WhatsApp messages, tone tips aur free tools: dost se paise wapas, kirayedaar ka rent, dukaan ka udhaar, client invoice follow-up, UPI link aur digital khata. Sab guides Ansh Yadav ne likhe aur real use-cases par test kiye hain.</p>
<div class="bb-grid">{''.join(cards)}</div>
<h2>Kaise use karein</h2>
<p>1) Apni situation wala guide kholo → 2) message copy karo ya <a href="/#vasooli">free tool</a> mein naam-amount daalke customize karo → 3) UPI link ke saath WhatsApp par bhejo. Koi login nahi, data phone mein hi rehta hai.</p>
</main>
{FOOTER}
</body></html>"""
    write("guides.html", page)

def build_sitemap():
    entries = [("", TODAY, "1.0", "/assets/og-share-card.jpg", "BaatBanao — WhatsApp payment reminder + UPI link"),
               ("guides", TODAY, "0.9", "/assets/og-share-card.jpg", "BaatBanao guides")]
    for slug, (cat, crumb, desc, tool) in PAGES.items():
        entries.append((slug, TODAY, "0.8", "/assets/blog/%s.jpg" % slug, crumb))
    for slug in INFO_PAGES:
        url_slug = "author/ansh-yadav" if slug == "author-ansh-yadav" else slug
        entries.append((url_slug, "2026-09-17", "0.4", None, None))
    xml = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
    for slug, mod, pri, img, title in entries:
        xml.append("  <url>\n    <loc>%s/%s</loc>\n    <lastmod>%s</lastmod>\n    <priority>%s</priority>" % (BASE, slug, mod, pri))
        if img:
            xml.append("    <image:image>\n      <image:loc>%s%s</image:loc>\n      <image:title>%s</image:title>\n    </image:image>" % (BASE, img, html.escape(title)))
        xml.append("  </url>")
    xml.append("</urlset>\n")
    write("sitemap.xml", "\n".join(xml))
    return len(entries)

if __name__ == "__main__":
    for slug in PAGES:
        w, m = enhance_article(slug)
        print("enhanced %-45s %5d words  %d min" % (slug, w, m))
    for slug in INFO_PAGES:
        enhance_info(slug); print("footer/css   %-45s" % slug)
    build_guides(); print("guides.html written")
    print("sitemap.xml written with %d urls" % build_sitemap())
