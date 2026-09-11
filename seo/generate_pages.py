# -*- coding: utf-8 -*-
"""BaatBanao static SEO page generator — writes Google-safe unique pages + sitemap."""
import os, json, html

BASE = "https://baatbanao.vercel.app"
APP = BASE + "/#vasooli"

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',Roboto,'Noto Sans',sans-serif;color:#2b2420;background:#fff;line-height:1.65}
.hd{display:flex;align-items:center;justify-content:space-between;max-width:860px;margin:0 auto;padding:16px 20px;position:sticky;top:0;background:rgba(255,255,255,.95);backdrop-filter:blur(6px);z-index:9;border-bottom:1px solid #f1e9e2}
.lg{font-weight:900;font-size:19px}
.cta{display:inline-block;background:#FF4E42;color:#fff;font-weight:800;padding:11px 20px;border-radius:14px;text-decoration:none;font-size:14.5px}
main{max-width:860px;margin:0 auto;padding:8px 20px 60px}
h1{font-size:27px;line-height:1.25;margin:20px 0 6px}
.sub{color:#6b6058;font-size:15.5px;margin-bottom:22px}
h2{font-size:20.5px;margin:30px 0 10px}
h3{font-size:16.5px;margin:18px 0 6px}
p{margin:10px 0;font-size:15.5px}
ul,ol{margin:10px 0 10px 22px}
li{margin:7px 0;font-size:15.5px}
.msg{background:#f7f3ef;border:1px solid #e8ded4;border-left:4px solid #FF4E42;border-radius:12px;padding:14px 16px;margin:12px 0;font-size:15px;position:relative;white-space:pre-wrap}
.cp{position:absolute;top:10px;right:10px;border:1px solid #e0d5c9;background:#fff;border-radius:8px;font-size:11.5px;font-weight:700;padding:4px 9px;cursor:pointer;color:#6b6058}
.cp:active{background:#ffe9e6}
.note{background:#fff8ef;border:1px solid #f3e2c4;border-radius:12px;padding:14px 16px;font-size:14.5px;margin:14px 0}
.cta-box{background:linear-gradient(135deg,#fff3f1,#fff);border:2px solid #ffd2cb;border-radius:18px;padding:22px;text-align:center;margin:34px 0}
.cta-box p{font-size:14.5px;color:#6b6058}
.rels{display:flex;flex-wrap:wrap;gap:9px;margin:14px 0}
.rels a{background:#fff;border:1px solid #e8ded4;border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:700;color:#8a3b32;text-decoration:none}
.rels a:hover{border-color:#FF4E42}
footer{border-top:1px solid #f1e9e2;padding:22px 20px 90px;font-size:13.5px;color:#8a8078;text-align:center}
footer a{color:#8a3b32;text-decoration:none;margin:0 7px;font-weight:600}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:14.5px}
th,td{border:1px solid #e8ded4;padding:9px 11px;text-align:left}
th{background:#f7f3ef}
@media(max-width:600px){h1{font-size:23px}.cp{position:static;display:block;margin-top:8px}}
"""

JS = """
function cp(btn){const t=btn.parentElement.textContent.replace('Copy','').trim();
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(()=>{btn.textContent='Copied ✅';setTimeout(()=>btn.textContent='Copy',1500)})}
else{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();btn.textContent='Copied ✅'}}
"""

def head(title, desc, slug, og_type="website"):
    url = f"{BASE}/{slug}"
    return f"""<!doctype html>
<html lang="hi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title}</title>
<meta name="description" content="{desc}"/>
<link rel="canonical" href="{url}"/>
<meta property="og:type" content="{og_type}"/>
<meta property="og:title" content="{title}"/>
<meta property="og:description" content="{desc}"/>
<meta property="og:url" content="{url}"/>
<meta property="og:image" content="{BASE}/assets/og-share-card.jpg"/>
<meta property="og:locale" content="hi_IN"/>
<meta name="twitter:card" content="summary_large_image"/>
<link rel="icon" type="image/png" href="/assets/icon-192.png"/>
<style>{CSS}</style>
"""

def faq_json(items):
    return {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[
        {"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in items]}

def page_json(slug, name, desc, faq_items):
    out = [{"@context":"https://schema.org","@type":"Article","headline":name,
            "description":desc,"inLanguage":"hi-IN",
            "author":{"@type":"Organization","name":"BaatBanao"},"url":f"{BASE}/{slug}",
            "publisher":{"@type":"Organization","name":"BaatBanao"}}]
    if faq_items: out.append(faq_json(faq_items))
    return "\n".join("<script type=\"application/ld+json\">" + json.dumps(x, ensure_ascii=False) + "</script>" for x in out)

def footer():
    return """<footer>
<p>BaatBanao 🪙 — Paisa bhi wapas, rishta bhi safe.</p>
<p><a href="/about">About</a>·<a href="/contact">Contact</a>·<a href="/privacy">Privacy</a>·<a href="/terms">Terms</a>·<a href="/disclaimer">Disclaimer</a></p>
<p>© 2026 BaatBanao · Made in India 🇮</p>
</footer>"""

def cta_box(rel="", lang="", tone=""):
    q = "&".join(f"{k}={v}" for k,v in [("rel",rel),("tone",tone),("lang",lang)] if v)
    href = f"{APP}?" + q if q else APP
    return f"""<div class="cta-box"><b style="font-size:17px">Naam, amount aur tone apne hisaab se daalo</b>
<p>Upar ke ready message se theek thaak ho toh copy karo. Warna 5 second me <b>apna khud ka</b> message banao — language (Hinglish/Hindi/Bhojpuri/English), tone (friendly/firm/funny) aur UPI pay link ke saath.</p>
<a class="cta" href="{href}">BaatBanao kholo — 100% Free →</a></div>"""

def rel_links(items):
    return '<div class="rels">' + "".join(f'<a href="/{s}">{t}</a>' for s,t in items) + "</div>"

def build(p):
    faq_html = ""
    if p.get("faq"):
        faq_html = "<h2>Aksar poochhe gaye sawaal (FAQ)</h2>" + "".join(
            f"<h3>{q}</h3><p>{a}</p>" for q,a in p["faq"])
    return f"""{head(p['title'], p['desc'], p['slug'], 'article')}
{page_json(p['slug'], p['h1'], p['desc'], p.get('faq'))}
</head>
<body>
<header class="hd"><span class="lg">🪙 BaatBanao</span><a class="cta" href="{APP}">Free Tool Kholo →</a></header>
<main>
<h1>{p['h1']}</h1>
<p class="sub">{p['sub']}</p>
{p['body']}
{cta_box(p.get('rel',''), p.get('lang',''), p.get('tone',''))}
{faq_html}
<h2>Related pages</h2>
{rel_links(p['related'])}
</main>
{footer()}
<script>{JS}</script>
</body>
</html>"""

M = lambda t: f'<div class="msg">{html.escape(t)}<button class="cp" onclick="cp(this)">Copy</button></div>'

PAGES = [
dict(slug="dost-se-paise-wapas-message", rel="Dost", lang="Hinglish",
 h1="Dost se Paise Wapas Kaise Mange: 12 WhatsApp Messages Jo Kaam Karein",
 title="Dost se Paise Wapas Kaise Mange — 12 WhatsApp Messages (Hinglish)",
 desc="Dost se paise wapas maangne ke 12 copy-paste Hinglish WhatsApp messages — friendly se firm tak. Bina rishta kharab kiye, bina gaali ke. BaatBanao par free customize karo + UPI pay link lagao.",
 sub="Paise mangne me sharam nahi, tarika ghalat hona hota hai. Yeh messages 'bhaiya, 500 wapas kar do' se upar level ke hain — jisme amount clear hai, aur dost ko 'nahi' bolne ki jagah hi nahi milti.",
 body="""<h2>Pehle yeh samjho: 3 rules</h2>
<ol>
<li><b>Amount likho, andaza mat do.</b> "Wo do-teen hazaar" ka matlab har kisi ke liye alag hota hai. ₹2,500 likho — ab negotiation ki jagah nahi bachi.</li>
<li><b>Date do.</b> "Jaldi bhej de" fail hota hai. "Pehle Sunday tak" ka jawab dena aasaan hai.</li>
<li><b>Channal: WhatsApp text, call nahi.</b> Text pe jawab dena mushkil hota hai; call pe insaan "bhai thoda time" bolke nikaal jaata hai.</li>
</ol>
<h2>Ready-to-copy messages (Hinglish)</h2>
<h3>Friendly (pehli baar pooch rahe ho)</h3>"""
 + M("Hey bhai! Chhoti si baat — jo ₹2,000 2 mahine pehle diye the, wo abhi toh? Mera hisaab thoda tight hai is mahine. Kal tak bhej de, UPI link main bhej raha hoon 👇\nUPI: upi://pay?pa=your@bank")
 + M("Bhai, reminder chod raha hoon 😄 — ₹1,500 wale hisaab ka. Koi tension nahi, bas is week tak mil jaye toh accha hoga.")
 + M("Yo! Ek quick thing — udhaar ka hisaab theek karte hain? Tera ₹2,000, aur tu mere paas ₹500 hai 😂 Net ₹1,500 tujhe dene ko milta hai. Jo bhi aasaan ho.")
 + """<h3>Firm (1-2 baar pooch chuke ho)</h3>"""
 + M("Bhai, is baar seedha baat karta hoon. ₹2,500 3 mahine pehle diye the, ab tak nahi mile. Is Sunday tak please bhej de — aur phir aage ke hisaab me thoda gap rakhenge. UPI: upi://pay?pa=your@bank")
 + M("Hey, main apne khate ko update kar raha hoon aur tera ₹1,500 abhi pending dikha raha hai. Aaj kal tak close karna please. Koi problem ho toh bata de, saath me soch lenge.")
 + M("Bhai main honest baat karta hoon — ye paisa mere liye bhi important hai, bas isliye baar baar na poochna pade. ₹2,000, Friday tak. Bas itna hi message aayega, phir main expect karunga ✅")
 + """<h3>"Bhaiya" wale (thoda respect wala)</h3>"""
 + M("Bhaiya, aapki ek chhoti madad chahiye — jo ₹3,000 aapko diye the, wo is week aap bhej dein toh mera month balance ho jayega. Jald hi bhej dijiye ga, UPI id chahiye toh bhejta hoon.")
 + M("Bhaiya, udhaar wala hisaab baitha rahega toh achcha hoga? ₹2,500 ka, 2 mahine purana. Aapke suvidha ke hisaab se main kisi din fix kar deta hoon, bas number settle ho jaye.")
 + """<h2>Agar phir bhi na de toh</h2>
<ul>
<li>Ek <b>final date</b> wali message do — "Agar Friday tak na aaye toh main ise aage ke kaam me adjust karunga." (Yeh line kaam karti hai, kyunki ab consequences dikhte hain.)</li>
<li>Chhota hisaab? ₹500 se kam hai toh kabhi-kabhi <b>gift ka pretense</b> chalta hai: "Bhai kal chai pe aaja, wo ₹300 yahan set ho jayenge 😄" — lekin sirf ek baar.</li>
<li>Bada hisaab (₹10,000+)? Ab WhatsApp nahi, <b>likhit settlement</b>: "1000 do aur 2000 Friday ko" — aur reply save rakhna. Yahi tumhara proof hai.</li>
<li>Haar maan lo (mental): ₹500 ke liye 2 saal ki dosti nahi. Kaunsa hisaab hai, yeh decide karke aage badho.</li>
</ul>""",
 faq=[("Kya paise maangne se dosti kharab hoti hai?","Naahi — <b>tarika</b> se kharab hoti hai. Amount + date + ek hi baar message = 90% cases me problem solve. Jo dost ₹500 le kar 6 mahine tak jawab na de, uski dosti me pehle se hi koi cheez kam thi."),
      ("Paise kaise maange bina sharm kiye?","Sharm tab hoti hai jab baat fuzzy hoti hai. '2-3 mahine se pending ₹2,000, is Sunday tak' jaisa clear message koi sharm nahi — professional hai."),
      ("UPI link dena sahi hai?","Bilkul. Message ke saath UPI link dene se insaan ka bahana ('bhai card number?') khatam ho jaata hai. BaatBanao free UPI link bana deta hai amount pre-filled ke saath.")],
 related=[("paise-mangne-ke-message","Paise mangne ke 15+ message"),("udhar-funny-shayari","Udhar funny shayari"),("paise-wapas-mangne-ka-tarika","Full guide: bina rishta kharab kiye")]),

dict(slug="paise-mangne-ke-message", rel="Dost", lang="Hinglish",
 h1="Paise Mangne Ke Message: 15+ Copy-Paste Templates (Har Situation)",
 title="Paise Mangne Ke Message — 15+ Copy-Paste Templates (Hinglish/Hindi)",
 desc="Paise mangne ke ready WhatsApp messages — dost, kirayedar, tuition, dukaan, customer — har situation ke liye. Hinglish aur Hindi me, copy karo aur bhejo. BaatBanao par free + UPI link ke saath customize karo.",
 sub="Ek page par sab: dost wala, rishtedaar wala, business wala. Copy karo, naam/amount badlo, bhej do.",
 body="""<h2>Dost / close friends ke liye</h2>"""
 + M("Bhai, hisaab set karte hain? ₹2,000 tera pending hai, main bhi busy hoon — is Sunday tak bhej de 👇 UPI link")
 + M("Reminder chala raha hoon bhai 😄 ₹1,500 wala. Is week tak mil jaye toh perfect.")
 + M("Yo, udhaar wala kaam? ₹3,000 ka. Tu bata ek date, usko main apne khate me fix karta hoon.")
 + """<h2>Rishtedaar / family ke liye (respect wala)</h2>"""
 + M("Bhaiya, chhoti si baat — jo ₹2,500 2 mahine pehle diye the, wo is week bhej dein toh mera account clear ho jayega. Jald hi kar dijiye ga.")
 + M("Didi, hisaab thoda tight hai is mahine. ₹1,500 jo pending hai, kya kal tak aa jayega? Koi tension nahi, bas pooch liya.")
 + """<h2>Kirayedar / tenant ke liye</h2>"""
 + M("Hello, rent ka gentle reminder — ₹8,000 ka July ka payment pending hai. Please 5 tareekh se pehle kar dijiye ga. UPI link: upi://pay?pa=your@bank. Shukriya!")
 + M("Namaste ji, rent ka reminder — ₹8,000, due 1st. Payment aaj tak ho jaye toh achcha hoga. Koi problem ho toh bata dijiye.")
 + """<h2>Tuition / fees (parents ko)</h2>"""
 + M("Parents ji, {child} ke tuition fees ka reminder — ₹3,000 (July) pending hai. Please is weekend tak payment kar dijiye ga. UPI link bhej raha hoon 👇")
 + M("Hello sir/madam, fees ka chhota sa reminder — ₹3,000 pending from 1st. Kripya 7 se pehle clear kar dijiye ga. Thank you!")
 + """<h2>Customer / client (business)</h2>"""
 + M("Namaste, aapka invoice #12 (₹12,500) 15 din purana hai. Please aaj tak payment kar dijiye ga, UPI link: upi://pay?pa=your@bank. Koi sawaal ho toh bata dijiye.")
 + M("Hi, gentle reminder — ₹12,500 ka payment pending hai (due 1st). Is week tak ho jaye toh achcha hoga. Link: upi://pay?pa=your@bank")
 + M("Dear {name}, invoice #12 ab 21 din ka ho gaya hai. Payment aaj tak kar dijiye ga please — warna agla order hold par rahega. UPI link ke saath turant confirm kar denge.")
 + """<h2>Dukaaan / kirana khata</h2>"""
 + M("Bhaiya, tera khata ₹1,850 ho gaya hai. Is Sunday tak set kar lena, phir naya khata khulta hai 😄")
 + M("Namaste, kirana khata ka hisaab ₹1,850 (12 items) pending hai. Jald se jald payment kar dijiye ga.")
 + """<h2>Pro tip</h2>
<p>Har message me <b>UPI link daalo</b>. 100 me se 40 log "bhai main bhejta hoon" bolke kabhi nahi bhejte — jab tak link unke phone me khula na ho. Link ke saath message = friction zero.</p>""",
 faq=[("Kis language me message dena chahiye?","Jabse insaan baat karta hai, wahi. Dost → Hinglish. Bade rishtedaar → thoda Hindi. Business → English ya Hindi formal. BaatBanao me saari 4 languages hain."),
      ("Kitni baar reminder bhejna chahiye?","Rule of 3: Day 1 gentle, Day 4 firm, Day 7 final date. Uske baad ek hi option bacha — settlement ya accept loss."),
      ("Message me gaali ya pressure dena chahiye?","Kabhi nahi. 'Savage safe' tone ka matlab hai: strong words, zero gaali. Pressure se insaan defensiveness me jaata hai; clarity se payment aati hai.")],
 related=[("dost-se-paise-wapas-message","Dost se paise wapas"),("kirayedaar-rent-reminder-message","Rent reminder"),("payment-reminder-customer-whatsapp","Customer payment reminder")]),

dict(slug="kirayedaar-rent-reminder-message", rel="Tenant", lang="Hindi",
 h1="Kirayedar Ko Rent Reminder Message (Hindi + Hinglish, Ready)",
 title="Kirayedar Se Rent Kaise Maange — 10 Reminder Messages (Hindi/Hinglish)",
 desc="Kirayedar ko rent reminder bhejne ke polite WhatsApp messages — Hindi aur Hinglish me, UPI link ke saath. Due date pehle, baad me, aur overdue ke liye alag tone. Copy-paste ready.",
 sub="Rent maangna business hai, personal nahi — isliye message me feelings nahi, facts hote hain: kitna, kab tak, kahan bhejna hai.",
 body="""<h2>3 rules rent reminder ke liye</h2>
<ol>
<li><b>Due date se pehle hi bhejo</b> (1-2 din pehle) — jab paisa account me hota hai, payment aasaan hai.</li>
<li><b>UPI link zaroor daalo</b> — kirayedar ke liye 'kahan bhejo' ka bahana khatam.</li>
<li><b>Har reminder me amount + month ka naam</b> — "July ka ₹8,000", kabhi sirf "rent" nahi.</li>
</ol>
<h2>Due date se pehle (gentle, har mahine wala)</h2>"""
 + M("Namaste ji, ek chhoti si reminder — July ka rent ₹8,000 kal due hai. Kripya aaj hi payment kar dijiye ga. UPI link: upi://pay?pa=your@bank. Dhanyavaad!")
 + M("Hello, rent reminder — ₹8,000 ka July ka payment, 1st tareekh tak. Jald hi kar dijiye ga toh achcha hoga. Link: upi://pay?pa=your@bank")
 + """<h2>Due date ke baad (firm, 2-4 din late)</h2>"""
 + M("Namaste ji, July ka rent ₹8,000 abhi pending hai (due 1st). Please aaj tak payment kar dijiye ga — 2 din late ho gaya hai. Koi problem ho toh turant batana.")
 + M("Hello, rent ₹8,000 (July) 4 din overdue hai. Kal tak kar dijiye ga please. Agla reminder final date ke saath jaayega.")
 + """<h2>1 hafte+ late (final notice tone)</h2>"""
 + M("Namaste ji, 3 baar yaad dila chuka hoon — July ka rent ₹8,000, due 1st, ab 9 din late. Please Friday 5 baje tak payment karein. Iske baad hum tenancy agreement ke clauses discuss karenge. UPI link wahi hai.")
 + M("Hi, final reminder — ₹8,000 (July) 10 din overdue hai. Payment Friday tak nahi aayi toh hum notice process shuru karenge. Koi payment arrangement discuss karna ho toh aaj baat kar lein.")
 + """<h2>Agar baar-baar late karta hai</h2>
<ul>
<li>Ek baar <b>likhit me advance/penalty fix karo</b>: "Ab se 5 din baad ₹200/din late fee" — friendly tone me likho, par likh hi do.</li>
<li>Har month ka reminder <b>same time par</b> (e.g. 28 ko) — routine ban jaye toh late aaya toh khud awkward lagega.</li>
<li>Payment receipt screenshot me "July rent received ✅" likhwa lo — khata clear, agla dispute nahi.</li>
</ul>""",
 faq=[("Rent reminder kitni baar bhejna chahiye?","28 ko advance reminder, 2 ko due reminder, 5 ko firm, 8 ko final. 15 din baad likhit notice. Is pattern se 80% kirayedar 2nd tak baad me bhej dete hain."),
      ("UPI link bhejna professional hai?","Haan — UPI ab officially standard hai. Link bhejna 'card number batao' se zyada professional aur safe hai dono taraf ke liye."),
      ("Kirayedar payment nahi kar raha, kya karein?","Pehle 3 likhit reminders (date + amount + due). Phir 7-din written notice. Phir legal route — yahan tak ki kisi bhi baar screenshots save rakho, yehi tumhara record hai.")],
 related=[("paise-mangne-ke-message","15+ message har situation ke liye"),("tuition-fees-reminder-message","Tuition fees reminder"),("udhaar-khata-kaise-banaayein","Udhaar khata kaise banaayein")]),

dict(slug="tuition-fees-reminder-message", rel="Student/Parent", lang="Hinglish",
 h1="Tuition Fees Reminder Message for Parents (10 Ready Messages)",
 title="Tuition Fees Reminder Message Parents Ko — Ready (Hinglish/Hindi)",
 desc="Tuition fees ka reminder message parents ke liye — polite, professional, UPI link ke saath. Month-end, overdue aur repeated late payers ke liye alag messages. Free customize karo BaatBanao par.",
 sub="Parent ko fee yaad dilana awkward lagta hai, lekin yeh business hai. Yeh messages aise likhe gaye hain ki parent ko 'reminder' nahi, 'service' lage.",
 body="""<h2>Tone kaisa hona chahiye</h2>
<ul>
<li><b>Student ka naam lo, parent ko blame mat karo.</b> "Aryan ki fees" > "aapki fees".</li>
<li><b>Amount + month + due date teeno likho</b> — har baar.</li>
<li><b>UPI link se friction zero</b> karo. Parent ka 90% bahana "bhai baad me bhejunga" hai.</li>
</ul>
<h2>Month-end gentle (sabse common)</h2>"""
 + M("Hello {parent name}, Aryan ki July ki tuition fees ₹3,000 5 tareekh ko due hai. Please payment kar dijiye ga — UPI link: upi://pay?pa=your@bank. Dhanyavaad! 🙏")
 + M("Namaste ji, ek chhoti si reminder — {child} ke fees ka July installment ₹3,000, 1st se due hai. Kripya is weekend tak clear kar dijiye ga. Link bhej raha hoon 👇")
 + """<h2>Overdue (1-2 hafte late)</h2>"""
 + M("Hello, Aryan ki fees ₹3,000 (July) abhi pending hai — 8 din late ho gaya. Please aaj tak payment kar dijiye ga. Koi dikkat ho toh bata dijiye ga, hum adjust kar lenge.")
 + M("Namaste ji, {child} ke fees ₹3,000 (July) due se 10 din late hai. Kripya Friday tak kar dijiye ga, warna August ka batch schedule me thoda affect hoga.")
 + """<h2>2+ month late (final tone)</h2>"""
 + M("Hello sir/madam, {child} ke fees ₹6,000 (July + August) abhi bhi pending hain, 3 baar reminder bheja hai. Please agle class se pehle payment clear kar dijiye ga. Koi arrangement discuss karna ho toh ek baar baat ho jaye toh achcha hoga.")
 + """<h2>Pro habits jo teachers use karte hain</h2>
<ol>
<li>Har mahine <b>28-29 ko same template</b> bhejo — parent ke liye routine ban jaata hai, tumhare liye zero awkwardness.</li>
<li>Payment milne par <b>"Received ✅" + receipt</b> bhejo — trust banata hai aur agla reminder bhi aasaan hota hai.</li>
<li>3+ month late ho toh <b>likhit: "fees clear hone tak classes pause"</b> — line ek baar kaho, phir repeat mat karo.</li>
</ol>""",
 faq=[("Fees reminder ka best time?","Subah 10-11 baje ya shaam 5-6 baje. Raat ko bhejna pushy lagta hai, subah 7 baje pe ignore ho jaata hai."),
      ("Parent baar-baar late karta hai, kya karein?","Ek baar me agreement fix karo: 'Ab se har mahine 28 ko auto-reminder, 5 din late par ₹200 late fee'. Likh kar. Uske baad consistent raho — exception mat do."),
      ("WhatsApp group me fees reminder dena chahiye?","Nahi. Hamesha private message — group me public shame = parent ki ego, aur baaki parents ko bhi tension. Har parent ko apna private link bhejo.")],
 related=[("kirayedaar-rent-reminder-message","Rent reminder (tenant)"),("payment-reminder-customer-whatsapp","Customer payment reminder"),("paise-mangne-ke-message","15+ message har situation ke liye")]),

dict(slug="kirana-shop-udhaar-reminder", rel="Shop Khata", lang="Hinglish",
 h1="Kirana / Dukaan Udhaar Reminder: Shop Khata Messages (Ready)",
 title="Dukaan Kirana Udhaar Reminder Message — 10 Copy-Paste Templates",
 desc="Kirana dukaan par customer ka udhaar wapas maangne ke ready messages — Hinglish + Hindi, UPI link ke saath. Chhota khata, bada khata, baar-baar late wale ke liye alag tone.",
 sub="Dukaandar ka sabse bada dard: udhaar diya, bhool gaya customer. Yeh messages aise hain ki customer sharma ke bhi payment kar de — aur wapas aaye.",
 body="""<h2>Dukaaan udhaar ki 3 cheezein</h2>
<ol>
<li><b>Khata likh ke rakho</b> (ya BaatBanao ka free Udhaar Khata use karo) — bina hisaab ke message bhejne me sharm aati hai.</li>
<li><b>Total amount kabhi mat bolo "do-teen hazaar"</b> — exact ₹1,850 bolo. Exact number = serious lagta hai.</li>
<li><b>UPI link ready rakho</b> — chhote dukaano par bhi UPI ka hisaab ab standard hai.</li>
</ol>
<h2>Regular customer, chhota khata (₹1,000-3,000)</h2>"""
 + M("Bhaiya, tera khata ₹1,850 ho gaya hai 😄 Is Sunday tak set kar lena, phir naya hisaab shuru karenge. UPI: upi://pay?pa=your@bank")
 + M("Namaste ji, kirana ka hisaab ₹1,850 pending hai (12 items). Jald se jald payment kar dijiye ga. Link: upi://pay?pa=your@bank")
 + M("Bhaiya, chhoti baat — ₹1,850 ka hisaab 2 hafte se pending hai. Kal tak kar dena please, aur agle mahine se thoda cash, thoda udhaar rakhna 😊")
 + """<h2>Bada khata (₹5,000+)</h2>"""
 + M("Bhaiya, tera total khata ₹6,400 ho gaya hai — isme June ka ₹2,200 bhi hai. Is Sunday tak kam se kam ₹3,000 kar dena, baaki 2 week me. UPI link bhej raha hoon.")
 + M("Namaste, dukaan ka hisaab ₹6,400 pending hai. Please is week ₹3,000 aur agle week ₹3,400 kar dijiye ga. Aise hi udhaar badhta gaya toh dono taraf mushkil hai.")
 + """<h2>Jo baar-baar late karta hai</h2>"""
 + M("Bhaiya, humara rule thoda strict karte hain — ab se 10 din me payment hoti hai warna agla saman cash pe milega. Tera ₹1,850 aaj bhi pending hai, UPI se set kar lena 🙏")
 + M("Namaste, 3 baar reminder bheja chuka. ₹2,500 abhi bhi pending hai. Please aaj tak payment karein, warna ab se saman sirf cash/online pe hi milega.")
 + """<h2>Customer bilkul gayab hai (phone nahi uthata)</h2>"""
 + M("Namaste ji, kai baar call kiye, nahi mile. Aapka khata ₹4,200 pending hai. Aaj raat 9 baje tak baat nahi hui toh hum ise final consider karenge. Payment link wahi hai: upi://pay?pa=your@bank")
 + """<h2>Udhaar system ko sehat mand karo</h2>
<ul>
<li><b>"Khata band kar rahe hain"</b> ek baar saal me announce karo — sabse effective reset. 1 week me sab hisaab settle hote hain.</li>
<li>Chhote customers ke liye <b>weekly khata day</b> (e.g. har Sunday) — routine = recovery.</li>
<li>Udhaar ke liye <b>interest mat bolo, "samman" bolo</b>: "Paisa wapas aane par agla saman 5% off" — positive loop.</li>
</ul>""",
 faq=[("Dukaaan udhaar me kitna dena chahiye?","Rule: daily turnover ka 10-15% se zyada udhaar mat do. Agar 20 logon ko ₹1,000-2,000 ka udhaar hai toh tumhara cashflow 40,000 band hai — yahi chhota business tootne ki wajah hai."),
      ("Khata kahan likhe?","Khatabook app bhi hai, lekin bina app install kiye — BaatBanao ka free Udhaar Khata phone me hi chalta hai, reminder ek tap me bhej deta hai."),
      ("Customer payment na kare toh kya karein?","Pehle 3 written reminder (date + amount). Phir likhit final notice. ₹5,000+ ke case me police station me written complaint ka option bhi hai — lekin pehle 2 step se 90% cases solve ho jaate hain.")],
 related=[("udhaar-khata-kaise-banaayein","Udhaar khata kaise banaayein (free)"),("paise-mangne-ke-message","15+ message har situation ke liye"),("dost-se-paise-wapas-message","Dost se paise wapas")]),

dict(slug="payment-reminder-customer-whatsapp", rel="Customer", lang="Hinglish",
 h1="Customer Payment Reminder WhatsApp Message (10 Polite + Firm)",
 title="Customer Se Payment Kaise Maange — 10 WhatsApp Reminder (Hinglish)",
 desc="Customer/client se pending payment maangne ke polite WhatsApp messages — invoice number, due date, UPI link ke saath. 3-day, 7-day, 14-day aur overdue tone ke saath. Free tool se customize karo.",
 sub="Payment reminder bhejne se business nahi toot-ta, <b>bhejne se chhodne se toot-ta hai</b>. Yeh sequence follow karo — polite se firm, bina awkwardness ke.",
 body="""<h2>Professional sequence (copy this flow)</h2>
<table>
<tr><th>Day</th><th>Tone</th><th>Message ka matlab</th></tr>
<tr><td>Due -2 din</td><td>Friendly</td><td>"Invoice #12 kal due hai, UPI link bhej raha hoon"</td></tr>
<tr><td>Due +1</td><td>Gentle</td><td>"Reminder — payment aaj tak nahi aayi"</td></tr>
<tr><td>Due +5</td><td>Firm</td><td>"5 din late, please aaj karo"</td></tr>
<tr><td>Due +10</td><td>Final</td><td>"10 din late, agla order hold"</td></tr>
</table>
<h2>Due -2 din (preventive, sabse important!)</h2>"""
 + M("Namaste {name}, invoice #12 (₹12,500) kal due hai. UPI link bhej raha hoon taaki aaj hi kar dijiye — upi://pay?pa=your@bank. Koi sawaal ho toh bata dijiye!")
 + """<h2>Due +1 din (gentle nudge)</h2>"""
 + M("Hi {name}, chhoti si reminder — invoice #12 (₹12,500) kal due thi. Payment ho gayi toh bata dijiye ga, warna link yahan hai: upi://pay?pa=your@bank. Dhanyavaad!")
 + M("Hello, invoice #12 abhi pending hai (due yesterday). Kya payment bhej di hai? Link: upi://pay?pa=your@bank")
 + """<h2>Due +5 din (firm, business-like)</h2>"""
 + M("Namaste {name}, invoice #12 (₹12,500) 5 din overdue hai. Please aaj tak payment karein — link: upi://pay?pa=your@bank. Koi problem ho toh turant batana, main adjust kar dunga.")
 + M("Hi, payment ₹12,500 (invoice #12) 5 din late hai. Aaj tak clear karna please. 10 din baad hum agle deliverables pause kar denge.")
 + """<h2>Due +10+ din (final, consequences clear)</h2>"""
 + M("Namaste {name}, 3 reminders ke baad bhi invoice #12 (₹12,500) pending hai (10 din overdue). Aaj tak payment na hone par agla work/service hold par rahega. Link: upi://pay?pa=your@bank. Final baar yahi message jaayega.")
 + """<h2>Jo "thoda time" bolke phir nahi bhejta</h2>"""
 + M("Bhai, samajh gaya — par 'thoda time' ab 3 mahine ho gaya. Invoice #12 (₹12,500) Friday tak milega, warna service hold. Ek hi baar pooch raha hoon, phir expect karunga ✅")
 + """<h2>2 tips</h2>
<ul>
<li><b>Invoice number + amount hamesha</b> — customer ko "kaunsa payment" ka doubt nahi hona chahiye.</li>
<li><b>UPI link me amount pre-fill karo</b> — 1 tap me payment. BaatBanao ye free karta hai.</li>
</ul>""",
 faq=[("Payment reminder kitni baar bhejna chahiye?","4 baar max (table dekho). Uske baar baat — call ya meeting. 5+ WhatsApp reminder = customer ko pushy lagta hai, na payment aati hai."),
      ("English me dena chahiye ya Hinglish?","Customer ka level dekho. Local business → Hinglish. Corporate/agency → English. Dono me bhi UPI link same kaam karta hai."),
      ("Late fee leni chahiye?","Contract me likha ho toh lo. Nahi likha toh pehli baar mat lo — par aage ke invoices me add kar do: '10 din late par 1.5%/month late fee'")],
 related=[("paise-mangne-ke-message","15+ message har situation ke liye"),("kirayedaar-rent-reminder-message","Rent reminder"),("upi-payment-link-generator","UPI payment link generator")]),

dict(slug="udhar-funny-shayari", rel="Dost", tone="Funny", lang="Hinglish",
 h1="Udhar Funny Shayari: Paise Wapas Mangne Ke Mazedaar Message",
 title="Udhar Funny Shayari + Mazedaar Paise Wapas Message (Copy-Paste)",
 desc="Udhar se paise wapas mangane ke funny shayari aur mazedaar WhatsApp message — dost ke liye, bina rishta kharab kiye. Share karne layak, copy-paste ready. Apna custom funny message BaatBanao par banao.",
 sub="Dost se paise maangne ka sabse safe tarika: usse <b>hasao</b>. Jab wo haste-haste hai, tab 'UPI link bhej raha hoon' bol do.",
 body="""<h2>Udhar shayari (dost ke liye)</h2>"""
 + M("Dosti mein sab milte hain, bas ek cheez nahi milti —\nTujhse wo ₹2,000 jo 3 mahine se pending hai, bhai!\nUPI link bhej raha hoon, bas itna hi message aayega 😄")
 + M("Tujhe toh har cheez yaad hai — birthday, anniversary, mera gaana bhi,\nBas teri apni udhaar ka toh tu hi bhool gaya!\nPaisa wapas kar, phir dushmani nahi, dosti hai 💸")
 + M("Chandni raat, chai, aur dost ka hisaab —\nTeesra sabse mushkil hota hai yaar!\n₹1,500 ka kaam, Sunday tak. Deal? 😄")
 + M("Paisa dekar dosti hoti hai, wapas le kar bhi dosti hoti hai,\nBas wapas <b>na lene</b> se dosti toot-ti hai!\nLink bhejta hoon, ab dekh tera kaam hai 🪙")
 + M("Na chandni raat, na dhoop wala din,\nBas ek kaam hai mera — udhaar ka hisaab!\nBhai, ₹2,500, is week. No drama, bas payment 😂")
 + """<h2>Funny direct messages (shayari nahi, seedha)</h2>"""
 + M("Bhai, maine tujhse ₹2,000 maange the. Tu bola 'thoda time'. 3 mahine ho gaye — time ab 2,000 ka ho gaya, time ka kya karein? UPI link 👇")
 + M("Ek survey: 50% log paise lete hain, 50% log wapas karte hain. Tujhe 50% me kaunsa lagta hai? Link bhej raha hoon 😄")
 + M("Mere paas tera ₹2,000 hai, tere paas mera patience hai — dono me se ek toh khatam hone wala hai. Link 👇")
 + M("Bhai, tujhe yaad hai? Nahi? Toh main yaad dila raha hoon: ₹2,000, 3 mahine, UPI. 3 cheezein, 1 message. Done. 😄")
 + M("Doston, humne paise diye the. Doston, paise abhi wapas nahi aaye. Doston, ab sirf yahi message aayega: [UPI LINK]. 🪙")
 + """<h2>Viral banane ka tarika</h2>
<ul>
<li>Yeh shayari <b>screenshot karke WhatsApp status</b> pe daalo (naam cover karke) — log apne hisaab ke liye copy karenge.</li>
<li>Message + <b>mascot card</b> banao → Instagram pe. "Jab dost ₹500 wapas na de" jaisa format hamesha chalta hai.</li>
<li>Group me bhejo, lekin <b>mention mat karo</b> — "isse pehle main bhi karke raha tha 😂" — indirect pressure, zero drama.</li>
</ul>""",
 faq=[("Funny message se dosti toot-ti hai?","Naahi — jo dost has ke 'bhai bhej raha hoon' bolta hai, wahi wapas karta hai. Jo has ke 'haan haan' bolta hai, wahi nahi karta. Message ka kaam bas bola hona hai, jawab ka kaam unka hai."),
      ("Bade rishtedaar ke liye bhi funny chalega?","Nahi — inke liye 'Bhaiya' wale section ke respectful messages use karo. Funny sirf dost + close friends ke liye hai."),
      ("Shayari me apna naam/amount kaise daalein?","BaatBanao par tone 'Funny' select karo — yehi type ke 3 personal messages milenge, jisme tera naam, amount aur language sab fit ho jayega.")],
 related=[("dost-se-paise-wapas-message","Dost se paise wapas (serious)"),("paise-mangne-ke-message","15+ message har situation ke liye"),("bhojpuri-udhaar-message","Bhojpuri me udhaar message")]),

dict(slug="paise-wapas-mangne-ka-tarika", rel="", lang="Hinglish",
 h1="Paise Wapas Kaise Mangen Bina Rishta Kharab Kiye — Full Guide",
 title="Paise Wapas Kaise Mangen Bina Rishta Kharab Kiye (2026 Guide)",
 desc="Dost ya rishtedaar se paise wapas maangne ka complete tarika — kab, kaise, kitni baar. Psychology, ready messages, aur 'agar na de' ka plan. India me sabse zyada search kiya jaane wala sawaal, seedha jawab ke saath.",
 sub="Yeh sawaal India me har mahine lakhon baar search hota hai. Short answer: <b>clear message + date + UPI link</b> — teeno ka combination, bina gaali ke, bina call ke.",
 body="""<h2>Pehle yeh accept karo</h2>
<p>Paise maangne se rishta nahi toot-ta — <b>3 cheezein toot-ti hain</b>: (1) fuzzy baat ("wo 2-3 mahine se kaam tha"), (2) call pe maangna (insaan 'bhai thoda time' bolke nikal jaata hai), (3) 7 baar poochna (phir tu hi pushy ban jaata hai). Yehi 3 cheezein chhod do, 90% cases solve.</p>
<h2>Step-by-step tarika (yahi sequence follow karo)</h2>
<ol>
<li><b>Day 0 — Apna khata clear karo.</b> Exact amount, exact date ("2 June ko ₹2,500 UPI se"). Bina iske message mat bhejo — number fuzzy hoga toh puri baat weak lagti hai.</li>
<li><b>Day 1 — Gentle WhatsApp message.</b> Example: "Bhai, chhoti baat — jo ₹2,500 2 June ko diye the, wo abhi toh? Is Sunday tak please. UPI link 👇" — note: 1 message me amount + date + link. 3 baar mat bhejo.</li>
<li><b>Day 4 — Agar 'thoda time' aaya.</b> Ab date lock karo: "Theek hai, par ek date fix karein — Friday. Usko main khate me bhar doonga." — ab uske paas 'haan haan' ka raasta nahi, usne khud date di hai.</li>
<li><b>Day 7 (Friday) — Reminder ek line me.</b> "Bhai, ₹2,500 aaj? Link 👇" — sirf itna. Baaki sab pehle message me tha.</li>
<li><b>Day 14 — Final message, consequences ke saath.</b> "Bhai, 3 baar pooch chuka. Agla ₹2,500 jab tak na mile, main isse apne aage ke kharche me adjust karunga. Bas itna message aayega." — yeh line kaam karti hai, kyunki ab <b>tu koi cheez karna wala hai</b>.</li>
<li><b>Day 21 — Decision.</b> Ab tak na aaya toh 2 raaste: (a) chhota amount hai toh <b>accept loss</b> — ₹500 ke liye 2 saal ki dosti nahi; (b) bada amount (₹10,000+) hai toh <b>likhit settlement</b> ya police station me written complaint. Yahan tak ki saare WhatsApp screenshots ek folder me save kar lo — yehi tumhara paper trail hai.</li>
</ol>
<h2>Messages ke liye golden rules</h2>
<ul>
<li><b>Amount hamesha exact</b> — "wo 2-3 hazaar" mat bolo.</li>
<li><b>Ek hi baar me 3 cheezein</b>: amount + date + UPI link.</li>
<li><b>Call mat karo</b> — call pe insaan defend karta hai; text pe insaan pay karta hai.</li>
<li><b>Gaali/pressure = 0</b> — "tu toh kachra hai" wale message se sirf 2 kaam hote hain: payment aati nahi, aur tu khud uncomfortable hota hai.</li>
<li><b>"Savage safe" tone use karo</b> — strong words, zero gaali. Example: "Patience mera bhi hai, par uska bhi expiry date hai." 😄</li>
</ul>
<h2>Jo log baar-baar paise lete hain</h2>
<p>Inke liye ek hi solution hai: <b>agla paise dena band</b>. Paise wapas lene se pehle pehle — agle baar paise hi mat do. Jo baar-baar leta hai, usse ek baar bol do: "Bhai, ab se paise sirf jab main de sakta hoon, tab. Aur yeh jo pehle wala hai, wo Friday ko bhej dena." — phir consistent raho. Isse rishta nahi toot-ta, <b>rishta seedha ho jaata hai</b>.</p>
<h2>Udhaar dena chahiye ya nahi?</h2>
<ul>
<li>Jo paise tumhare liye <b>doable loss</b> hain — wahi do. Jo nahi, wahan "bhai abhi nahi de sakta" bol do.</li>
<li>Bade amount (₹20,000+) par <b>likhit chittha</b> — "₹50,000, 3 mahine, interest nahi" — ek line, reply me 'done' bolwayo. Bina yeh kiye, wapas lene me 3 mahine nahi, 3 saal lagenge.</li>
<li>Khata likh ke rakho — <a href="/udhaar-khata-kaise-banaayein">free udhaar khata kaise banaayein →</a></li>
</ul>""",
 faq=[("Kitna wait karna chahiye paise wapas lene se pehle?","Due date ke 3-4 din baad pehla message. Usse pehle poochna pushy lagta hai; 2 hafte baad poochna toh usne paisa khud ka samajh liya."),
      ("Agar paise wapas nahi aaye, kya karein?","₹5,000 se kam — accept loss ka soch ke dekho, dosti ka hisaab aur hai. ₹10,000+ — likhit settlement pehla step, uske baad legal option. Har step me screenshots save rakho."),
      ("Udhaar dena hi ghalat hai kya?","Nahi — lekin 'wo paisa doable loss hai' yeh filter hamesha lagao. Jo doable nahi, wahan 'bhai abhi nahi' bol dena. Isse 90% udhaar problem kabhi shahi nahi hoti.")],
 related=[("dost-se-paise-wapas-message","Dost ke liye 12 message"),("paise-mangne-ke-message","15+ message har situation ke liye"),("udhaar-khata-kaise-banaayein","Udhaar khata kaise banaayein")]),

dict(slug="bhojpuri-udhaar-message", rel="General", lang="Bhojpuri",
 h1="भोजपुरी में उधार / पिस मांगने के मेसेज (Ready)",
 title="Bhojpuri Udhaar Message — पिस वापिस मांगे (Ready Copy-Paste)",
 desc="भोजपुरी में उधार लेने/पिस मांगने के ready WhatsApp message — dost, relative, shop ke liye. Bhojpuri belt me koi aur tool nahi banata. Apna custom message free banao BaatBanao par.",
 sub="Bhojpuri me paise maangna Hinglish se zyada 'apna' lagta hai — aur zyada kaam karta hai. Yeh messages Bhojpuri belt (UP/BIH/JH) ke liye likhe gaye hain.",
 body="""<h2>Dost ke liye (Bhojpuri)</h2>"""
 + M("Bhai, chhoti baat kareba — jo ₹2,000 do mahine pehle dekhela, o abhi toh? Is Sunday tak bhej de, UPI link bheja raha hoon 👇")
 + M("Bhaiya, hisaab khettha kareba? Tera ₹1,500 pending ahe. Is week tak mil jae toh bhalaa hawa.")
 + M("Arre bhai, udhaar wala kaam? ₹3,000 ka. Tu ek date de, main apna khata theek kareba 😄")
 + """<h2>Rishtedaar / bade log ke liye</h2>"""
 + M("Bhaiya, aapki ek chhoti madad chahiye — jo ₹2,500 aapko dekhela, o is week bhej dein toh mera hisaab balance ho jae ga. Jald bhej dibe ga, UPI id chahiye toh dekhala raha hoon.")
 + M("Didi, hisaab thoda tight ahe is mahine. ₹1,500 jo pending ahe, kya kal tak aa jae ga? Koi tension nahe, bas pooch liha.")
 + """<h2>Dukaaan / kirana ke liye</h2>"""
 + M("Bhaiya, tera khata ₹1,850 ho gila ahe. Is Sunday tak set karelena, phir naya hisaab khulha jae 😄 UPI link bheja raha hoon.")
 + M("Namaste, kirana ka hisaab ₹1,850 (12 item) pending ahe. Jald se jald payment karebe ga please.")
 + """<h2>Funny Bhojpuri (dost ke liye)</h2>"""
 + M("Bhai, maine tujhe ₹2,000 dekhela, tu bola 'ek thoda time'. Tin mahine ho gaya — time ab ₹2,000 ka ho gila, time ka kareba? Link 👇")
 + M("Dosti me sab milha, bas ek cheez na milha — tujhe o udhaar jo 3 mahine se pending ahe! Link bheja raha hoon, ab dekh tera kaam ahe 🪙")
 + """<h2>Custom Bhojpuri message banao</h2>
<p>Upar ke message se theek thaak ho toh copy karo. Warna BaatBanao par <b>language = Bhojpuri</b> select karo — naam, amount, tone daalke 5 second me tera apna message milega. Yeh feature duniya me aur koi nahi deta.</p>""",
 faq=[("Bhojpuri message dene me koi dikkat nahi?","Bilkul nahi — Bhojpuri belt me yehi sabse natural tone hai. Dost ke liye Hinglish se zyada Bhojphi kaam karti hai, kyunki 'apni bhasha' me baat hona = serious maana jaana."),
      ("Bhojpuri me UPI link bhejna chahiye?","Haan — Bhojpuri belt me bhi UPI ab standard hai. Link bhejne se 'kahan bhejo' ka bahana khatam."),
      ("Hindi me bhi option hai?","Haan — BaatBanao me Hinglish, Hindi, Bhojpuri, English chaari bhi hain, ek hi tool me.")],
 related=[("dost-se-paise-wapas-message","Dost se paise wapas"),("paise-mangne-ke-message","15+ message har situation ke liye"),("udhar-funny-shayari","Udhar funny shayari")]),

dict(slug="upi-payment-link-generator", rel="", lang="Hinglish",
 h1="UPI Payment Link Kaise Banaayein: Free Tool + 5 Steps Guide",
 title="UPI Payment Link Generator — Free (Guide + Tool, 2026)",
 desc="UPI payment link kaise banayein bina kisi paid tool ke — step-by-step guide. Naam, amount, note — sab pre-filled link ban jata hai. BaatBanao par reminder + UPI link ek saath milta hai.",
 sub="UPI link ka matlab: customer/dost ko 'card number batao' bolne ki zaroorat nahi. Bas link bhejo — 1 tap me payment.",
 body="""<h2>UPI link kya hai?</h2>
<p>UPI link ek deep-link hai jo seedha UPI app (GPay/PhonePe/Paytm) me khol jaata hai, jisme <b>recipient + amount + note sab pre-filled</b> hota hai. Format: <code>upi://pay?pa=your@bank&pn=Your Name&am=500&note=July rent</code></p>
<h2>5 steps me apna UPI link banao (free)</h2>
<ol>
<li><b>Apni UPI ID confirm karo</b> — GPay/PhonePe me 'My UPI ID' (e.g. ansh@okaxis, name@ybl).</li>
<li><b>Link me amount + note daalo</b> — "₹2,500, July tuition" — yeh friction kam karta hai.</li>
<li><b>Link test karo</b> — apne doosre phone pe kholo, amount sahi dikh raha hai?</li>
<li><b>WhatsApp me bhejo</b> — message ke saath. "₹2,500 kaam, link 👇 [UPI LINK]"</li>
<li><b>QR code bhi bana lo</b> — dukaan ke bill pe lagane ke liye (BaatBanao me free QR option hai).</li>
</ol>
<h2>UPI link vs QR code — kab kya use karein</h2>
<table>
<tr><th>Cheez</th><th>UPI Link</th><th>UPI QR</th></tr>
<tr><td>WhatsApp/SMS</td><td>✅ Best</td><td>Photo bhejni padti hai</td></tr>
<tr><td>Dukaano / bill pe</td><td>—</td><td>✅ Best (lag ke rakha)</td></tr>
<tr><td>Amount fix karna</td><td>✅ Possible</td><td>Partial (note se)</td></tr>
</table>
<h2>3 mistakes jo log karte hain</h2>
<ul>
<li><b>Link bhejne se pehle test nahi karte</b> — galti se galat amount pre-fill = payment galat hoti hai. Hamesha ek baar kholke dekho.</li>
<li><b>Note khali chhod dete hain</b> — note me "July rent" / "Invoice #12" daalo — customer ko pata hota hai kya bhej raha hai, aur tumhare bank me bhi clear entry.</li>
<li><b>Link + message alag-alag bhejte hain</b> — dono ek hi message me daalo. Do message = do baar scroll, do baar ignore.</li>
</ul>
<h2>Reminder + UPI link ek saath kaise bhejein</h2>
<p>BaatBanao ka kaam yahi hai: ek hi message me <b>reminder text + amount + UPI link</b> — 5 second me ready, WhatsApp pe bhej do. Free, bina app install, bina login.</p>""",
 faq=[("UPI link banana kitna time leta hai?","Manual me 2 minute (upi://pay?pa=... format me). BaatBanao me 10 second — amount + note + recipient sab auto fill."),
      ("UPI link me maximum kitna amount daal sakte hain?","UPI link me amount limit nahi hoti (recipient ke UPI account limit ke according). ₹1 se ₹1,00,000+ tak chalega."),
      ("Kya UPI link se payment bina PIN ke ho jati hai?","Nahi — recipient ka PIN/OTP hamesha zaroori hai. Link sirf pre-fill karta hai, payment ka control recipient ke paas hota hai. Yahi iski safety hai.")],
 related=[("payment-reminder-customer-whatsapp","Customer payment reminder"),("kirayedaar-rent-reminder-message","Rent reminder"),("paise-mangne-ke-message","15+ message har situation ke liye")]),

dict(slug="udhaar-khata-kaise-banaayein", rel="", lang="Hinglish",
 h1="Udhaar Khata Mobile Me Kaise Banaayein (Free, Bina App Install)",
 title="Udhaar Khata Kaise Banaayein — Free Mobile Me (No App Install)",
 desc="Udhaar ka khata mobile me kaise banaayein bina kisi paid app install kiye — 2 minute me. Khata, reminder, aur UPI link — sab ek jagah. Free PWA, offline bhi chalta hai.",
 sub="Khatabook bhi accha hai, lekin uske liye app install + login + registration chahiye. Agar bas <b>apne 10-15 logon ka hisaab</b> rakhna hai toh yeh tarika use karo.",
 body="""<h2>Udhaar khata ke 3 levels</h2>
<table>
<tr><th>Level</th><th>Kitne log</th><th>Kya use karo</th></tr>
<tr><td>Chhota</td><td>5-10 (dost/rishtedaar)</td><td>Notebook ya WhatsApp note — par <b>bhool jaoge</b></td></tr>
<tr><td>Medium</td><td>10-50 (dost + dukaan)</td><td>Free PWA khata (BaatBanao wala) — phone me, bina install</td></tr>
<tr><td>Bada</td><td>50+ (business)</td><td>Khatabook/Vyapar jaise full app</td></tr>
</table>
<h2>BaatBanao ka free Udhaar Khata kaise kaam karta hai</h2>
<ol>
<li><b>PWA kholo</b> — phone me "Add to Home Screen" karo, ab app jaisa dikhega (bina Play Store download).</li>
<li><b>Har udhaar ka entry daalo</b> — naam, amount, relation, note ("2 mahine se pending").</li>
<li><b>Reminder ek tap me</b> — kisi bhi entry pe "Remind" dabao, message + UPI link ready.</li>
<li><b>Payment aaye toh tick karo</b> — hisaab clear, agla reminder nahi jayega.</li>
<li><b>Offline bhi chalta hai</b> — network na ho toh bhi khata khulega.</li>
</ol>
<h2>Khata rakhe ke 4 rules</h2>
<ul>
<li><b>Entry aate-hi karo</b> — "kal daalunga" = kal bhool jayega. 30 second ki entry hai.</li>
<li><b>Amount exact</b> — "₹2,000", "₹1,850", "wo 2-3 hazaar" nahi.</li>
<li><b>Date zaroor likho</b> — "kab diya tha" bina, reminder message weak hota hai.</li>
<li><b>Har Sunday 10 min review</b> — kaun pending hai, kaun late hai. Ek Sunday me ₹50,000 ka khata clear ho jaata hai.</li>
</ul>
<h2>Udhaar dena band karna chahiye kya?</h2>
<p>Band nahi, <b>filter</b> lagao. 3 sawaal paise dene se pehle:</p>
<ol>
<li>Kya yeh paisa doable loss hai? (Haan → de do. Nahi → "bhai abhi nahi".)</li>
<li>Kya isne pehle paise wapas kiye the? (Haan → do. Nahi → yeh pehla "test" hai, chhota amount do.)</li>
<li>Kya main likh ke rakhunga? (Haan → do. Nahi → mat do, kyunki likh ke nahi rakhoge.)</li>
</ol>""",
 faq=[("Khata mobile me kahan save hota hai?","BaatBanao ka khata tumhare phone me hi save hota hai (offline, no server, no login). Privacy ka matlab: koi data kisi ko nahi jaata."),
      ("Khatabook se farak kya hai?","Khatabook = business tool (app install, login, registration, ads). BaatBanao ka khata = personal tool (bina install, bina login, 30 second me ready). Dono ka use case alag hai."),
      ("Reminder bhejna kitna free hai?","Unlimited — free me 8 message/din. Pro (₹149 lifetime) me unlimited + watermark nahi.")],
 related=[("paise-mangne-ke-message","15+ message har situation ke liye"),("dost-se-paise-wapas-message","Dost se paise wapas"),("upi-payment-link-generator","UPI payment link guide")]),

dict(slug="paise-mangne-ke-message", rel="Dost", lang="Hinglish",
 h1="Paise Mangne Ke Message: 15+ Copy-Paste Templates (Har Situation)",
 title="Paise Mangne Ke Message — 15+ Copy-Paste Templates (Hinglish/Hindi)",
 desc="Paise mangne ke ready WhatsApp messages — dost, kirayedar, tuition, dukaan, customer — har situation ke liye. Hinglish aur Hindi me, copy karo aur bhejo. BaatBanao par free customize karo + UPI link ke saath.",
 sub="Ek page par sab: dost wala, rishtedaar wala, business wala. Copy karo, naam/amount badlo, bhej do.",
 body="""<h2>Dost / close friends ke liye</h2>"""
 + M("Bhai, hisaab set karte hain? ₹2,000 tera pending hai, main bhi busy hoon — is Sunday tak bhej de 👇 UPI link")
 + M("Reminder chala raha hoon bhai 😄 ₹1,500 wala. Is week tak mil jaye toh perfect.")
 + M("Yo, udhaar wala kaam? ₹3,000 ka. Tu bata ek date, usko main apne khate me fix karta hoon.")
 + """<h2>Rishtedaar / family ke liye (respect wala)</h2>"""
 + M("Bhaiya, aapki ek chhoti madad chahiye — jo ₹2,500 2 mahine pehle diye the, wo is week aap bhej dein toh mera account clear ho jayega. Jald hi bhej dijiye ga.")
 + M("Didi, hisaab thoda tight hai is mahine. ₹1,500 jo pending hai, kya kal tak aa jayega? Koi tension nahi, bas pooch liya.")
 + """<h2>Kirayedar / tenant ke liye</h2>"""
 + M("Hello, rent ka gentle reminder — ₹8,000 ka July ka payment pending hai. Please 5 tareekh se pehle kar dijiye ga. UPI link: upi://pay?pa=your@bank. Shukriya!")
 + M("Namaste ji, rent ka reminder — ₹8,000, due 1st. Payment aaj tak ho jaye toh achcha hoga. Koi problem ho toh bata dijiye.")
 + """<h2>Tuition / fees (parents ko)</h2>"""
 + M("Parents ji, {child} ke tuition fees ka reminder — ₹3,000 (July) pending hai. Please is weekend tak payment kar dijiye ga. UPI link bhej raha hoon 👇")
 + M("Hello sir/madam, fees ka chhota sa reminder — ₹3,000 pending from 1st. Kripya 7 se pehle clear kar dijiye ga. Thank you!")
 + """<h2>Customer / client (business)</h2>"""
 + M("Namaste, aapka invoice #12 (₹12,500) 15 din purana hai. Please aaj tak payment kar dijiye ga, UPI link: upi://pay?pa=your@bank. Koi sawaal ho toh bata dijiye.")
 + M("Hi, gentle reminder — ₹12,500 ka payment pending hai (due 1st). Is week tak ho jaye toh achcha hoga. Link: upi://pay?pa=your@bank")
 + M("Dear {name}, invoice #12 ab 21 din ka ho gaya hai. Payment aaj tak kar dijiye ga please — warna agla order hold par rahega. UPI link ke saath turant confirm kar denge.")
 + """<h2>Dukaaan / kirana khata</h2>"""
 + M("Bhaiya, tera khata ₹1,850 ho gaya hai. Is Sunday tak set kar lena, phir naya khata khulta hai 😄")
 + M("Namaste, kirana khata ka hisaab ₹1,850 (12 items) pending hai. Jald se jald payment kar dijiye ga.")
 + """<h2>Pro tip</h2>
<p>Har message me <b>UPI link daalo</b>. 100 me se 40 log "bhai main bhejta hoon" bolke kabhi nahi bhejte — jab tak link unke phone me khula na ho. Link ke saath message = friction zero.</p>""",
 faq=[("Kis language me message dena chahiye?","Jabse insaan baat karta hai, wahi. Dost → Hinglish. Bade rishtedaar → thoda Hindi. Business → English ya Hindi formal. BaatBanao me saari 4 languages hain."),
      ("Kitni baar reminder bhejna chahiye?","Rule of 3: Day 1 gentle, Day 4 firm, Day 7 final date. Uske baad ek hi option bacha — settlement ya accept loss."),
      ("Message me gaali ya pressure dena chahiye?","Kabhi nahi. 'Savage safe' tone ka matlab hai: strong words, zero gaali. Pressure se insaan defensiveness me jaata hai; clarity se payment aati hai.")],
 related=[("dost-se-paise-wapas-message","Dost se paise wapas"),("kirayedaar-rent-reminder-message","Rent reminder"),("payment-reminder-customer-whatsapp","Customer payment reminder")]),
]

LEGAL = {
"about": dict(h1="About BaatBanao",
 title="About — BaatBanao | Dost se Paise Wapas, Rishta Safe",
 desc="BaatBanao kya hai — India ka free Hinglish/Hindi/Bhojpuri payment reminder tool. Hamari kahani, kyun banaya, aur kya offer karte hain.",
 sub="Ek chhota sa problem se shuru hua.",
 body="""<h2>Kahani</h2>
<p>BaatBanao banaya gaya ek simple problem ke liye: <b>dost se paise maangne me sharm aati hai, lekin paise maangne padte hain.</b> Humne socha — agar ek tool ho jo 5 second me aapka perfect message bana de, aapki bhasha me (Hinglish/Hindi/Bhojpuri/English), aapke tone me (friendly/firm/funny), UPI pay link ke saath — toh poora awkwardness khatam ho jaata hai.</p>
<h2>Hum kya offer karte hain</h2>
<ul>
<li><b>Vasooli Mode</b> — 5 second me WhatsApp-ready reminder message</li>
<li><b>4 languages</b> — Hinglish, Hindi, Bhojpuri, English</li>
<li><b>UPI link + QR</b> — amount pre-filled, 1 tap payment</li>
<li><b>Udhaar Khata</b> — phone me free khata, bina app install</li>
<li><b>100% Free</b> — daily 8 message free; Pro (₹149 lifetime) me unlimited + no watermark</li>
</ul>
<h2>Humara promise</h2>
<p>Tumhara data tumhare phone me rehta hai (localStorage). Koi server pe data upload nahi hota, koi login nahi chahiye, koi tracking nahi. Bas ek kaam — aapka message ready hona.</p>
<p>Made in India 🇮, by a small team jo khud bhi udhaar me paise mangati hai.</p>""",
 faq=None, related=None),
"contact": dict(h1="Contact BaatBanao",
 title="Contact — BaatBanao | Feedback, Pro Code, Partnership",
 desc="BaatBanao se contact karein — feedback, Pro unlock code, partnership, ya koi bhi sawaal. WhatsApp pe direct baat karein, 24 ghante me reply.",
 sub="Koi bhi sawaal, feedback, ya Pro unlock — yahan likho.",
 body="""<h2>WhatsApp (sabse fast)</h2>
<p><a href="https://wa.me/919918996096" class="cta" style="display:inline-block">WhatsApp: +91 99189 96096 →</a></p>
<p>Feedback, bug, Pro redeem code, partnership — sab yahan. Reply 24 ghante me aata hai.</p>
<h2>Email</h2>
<p><a href="mailto:anshyd1@gmail.com">anshyd1@gmail.com</a></p>
<h2>Pro unlock code kaise milega?</h2>
<p>Pro (₹149 lifetime) ke liye: <a href="/#pro">Pro page kholo</a> → UPI se ₹149 bhejo → screenshot WhatsApp pe bhejo → 10 min me redeem code mil jaata hai.</p>""",
 faq=None, related=None),
"privacy": dict(h1="Privacy Policy",
 title="Privacy Policy — BaatBanao",
 desc="BaatBanao ka privacy policy — tumhara data kahan save hota hai, kya collect hota hai, aur kya nahi. Short + seedha, bina legal jargon ke.",
 sub="Last updated: September 2026. Short + seedha, bina legal jargon ke.",
 body="""<h2>Kya hum collect karte hain</h2>
<ul>
<li><b>Aapke data (naam, amount, phone, message) — KAHAN BHI NAHI jaata.</b> Sab kuch aapke phone ke browser storage (localStorage) me save hota hai. Koi server pe upload nahi hota.</li>
<li><b>Analytics</b> — page views / clicks ka basic count (Google Analytics). Yeh data anonymous hai, naam/phone/message ka data nahi jaata.</li>
<li><b>Cookies</b> — ads (AdSense) ke liye zaroori cookies. Aap browser me cookies block kar sakte hain.</li>
</ul>
<h2>Kya hum NAHI karte</h2>
<ul>
<li>Aapka data sell nahi karte</li>
<li>Aapka data kisi third party me share nahi karte (ads network ke alawa)</li>
<li>Aapke message/phone/amount kisi server pe save nahi karte</li>
<li>Children (18-) ka data intentionally collect nahi karte</li>
</ul>
<h2>Third-party services</h2>
<ul>
<li><b>Google AdSense</b> — ads dikhane ke liye, unki apni privacy policy lagti hai.</li>
<li><b>Google Analytics</b> — page view tracking, anonymous.</li>
<li><b>Vercel</b> — website hosting (India ke bahar servers, par sirf website files, aapka data nahi).</li>
</ul>
<h2>Aapke rights</h2>
<p>Aap kisi bhi waqt apne phone me site clear karke saara data delete kar sakte hain (browser storage clear karo). Koi account nahi hai, kisi server pe kuch nahi hai.</p>
<p>Sawaal? <a href="/contact">Contact page</a> se likho.</p>""",
 faq=None, related=None),
"terms": dict(h1="Terms of Use",
 title="Terms of Use — BaatBanao",
 desc="BaatBanao ke terms of use — service kya hai, aapki zimmedari kya hai, aur Pro plan ke rules. Short + simple, bina legal jargon ke.",
 sub="Last updated: September 2026.",
 body="""<h2>Service kya hai</h2>
<p>BaatBanao ek free tool hai jo aapke liye payment reminder message banata hai (Hinglish/Hindi/Bhojpuri/English), UPI link deta hai, aur udhaar khata ka record rakhta hai. Yeh financial advice nahi hai, legal service nahi hai, aur kisi bhi bank/institution se affiliated nahi hai.</p>
<h2>Aapki zimmedari</h2>
<ul>
<li>Banaaya gaya message <b>aapki zimmedari</b> hai — bhejne se pehle ek baar padh lo. Gaali, harassment, ya illegal content banane ke liye tool use nahi karna (humne basic safety filter lagaya hai).</li>
<li>Paisa wapas nahi aaya toh yeh <b>legal matter</b> hai — police court ya consumer court me jaana padega. Hum koi recovery agent nahi hain.</li>
<li>UPI link me galat amount/recipient daal diya toh loss aapka — test karke bhejo.</li>
</ul>
<h2>Pro plan (₹149 lifetime)</h2>
<ul>
<li>₹149 ek baar me, lifetime. Koi subscription nahi, koi hidden fee nahi.</li>
<li>Refund policy: redeem code use hone ke baad refund nahi (digital product). Code use nahi hua toh 7 din me refund.</li>
<li>Pro ka benefit: unlimited message + watermark off. Free plan me daily 8 message, watermark on.</li>
</ul>
<h2>Liability</h2>
<p>BaatBanao "as-is" me milta hai. Koi guarantee nahi — service band ho sakti hai, features badal sakte hain. Hum koi financial loss (udhaar nahi wapas aana) ke liye responsible nahi hain.</p>
<p>Sawaal? <a href="/contact">Contact page</a>.</p>""",
 faq=None, related=None),
"disclaimer": dict(h1="Disclaimer",
 title="Disclaimer — BaatBanao",
 desc="BaatBanao ka disclaimer — yeh financial/legal advice nahi hai, udhaar recovery guarantee nahi milti, aur content ka use aapki zimmedari hai.",
 sub="Seedha baat, 30 second me padh lo.",
 body="""<h2>Important baatein</h2>
<ul>
<li><b>Financial/legal advice nahi</b> — BaatBanao sirf message banata hai. Paisa wapas aayega ya nahi, yeh hum guarantee nahi kar sakte.</li>
<li><b>Recovery agent nahi</b> — hum kisi bhi insaan ke paise wapas nahi laate. Message aap bhejta ho, baat aap karta ho, legal action aap leta ho.</li>
<li><b>Content use = aapki zimmedari</b> — humne safety filter lagaya hai (gaali/block words), lekin aap jo bhi message banao aur bhejo, uski zimmedari aapki hai.</li>
<li><b>UPI link</b> — galat amount/recipient daal ke bheja toh loss aapka. Hamesha test karo.</li>
<li><b>Third-party links</b> — agar kisi aur site/YouTube pe ja rahe ho, unki policy alag hoti hai.</li>
</ul>
<p>Koi bhi sawaal? <a href="/contact">Contact karo</a>.</p>""",
 faq=None, related=None),
}

SITEMAP_EXTRA = [("", "1.0", "weekly"), ("pay", "0.5", "monthly")]

def main():
    out = "/home/user/baatbanao"
    urls = [""]
    for p in PAGES:
        slug = p["slug"]
        htmlout = build(p)
        with open(f"{out}/{slug}.html", "w", encoding="utf-8") as f:
            f.write(htmlout)
        urls.append(slug)
        print(f"  wrote {slug}.html ({len(htmlout)} bytes)")
    for slug, p in LEGAL.items():
        # legal pages: simple, no CTA box / no related
        faq_html = ""
        htmlout = head(p["title"], p["desc"], slug) + f"""
{page_json(slug, p['h1'], p['desc'], None)}
</head>
<body>
<header class="hd"><span class="lg">🪙 BaatBanao</span><a class="cta" href="{APP}">Free Tool →</a></header>
<main>
<h1>{p['h1']}</h1>
<p class="sub">{p['sub']}</p>
{p['body']}
</main>
{footer()}
</body>
</html>"""
        with open(f"{out}/{slug}.html", "w", encoding="utf-8") as f:
            f.write(htmlout)
        urls.append(slug)
        print(f"  wrote {slug}.html ({len(htmlout)} bytes)")
    # sitemap
    urls.append("pay")
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        loc = f"{BASE}/{u}" if u else f"{BASE}/"
        pr = "1.0" if u=="" else "0.8"
        cf = "weekly" if u=="" else "monthly"
        lines.append(f"  <url><loc>{loc}</loc><changefreq>{cf}</changefreq><priority>{pr}</priority></url>")
    lines.append("</urlset>")
    with open(f"{out}/sitemap.xml", "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  sitemap: {len(urls)} urls")

if __name__ == "__main__":
    main()
