# BaatBanao Vault — product poster set + planning sheets (PIL). Fonts: Poppins (OFL).
# Re-render with another feature name:  FEATURE_NAME=Treasury python3 make_posters_v2.py
import os, glob, math, random
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
FD = os.environ.get('FONT_DIR', '/home/user/.cache/fonts/')
NAME = os.environ.get('FEATURE_NAME', 'Vault')
BRAND = 'BaatBanao'
def font(n, s): return ImageFont.truetype(os.path.join(FD, n), s)
PBL, PB, PS, PR, PL = 'Poppins-Black.ttf', 'Poppins-Bold.ttf', 'Poppins-SemiBold.ttf', 'Poppins-Regular.ttf', 'Poppins-Light.ttf'
GOLD, TEAL, WHITE, GREY, NAVY = (232, 184, 92), (32, 178, 150), (255, 255, 255), (205, 210, 220), (18, 28, 48)
INK, MUTED, RED, GREEN, ORANGE, BLUE = (34, 38, 46), (110, 116, 128), (200, 60, 50), (36, 150, 92), (214, 112, 30), (52, 110, 230)

def cover(im, W, H, focus=0.5):
    s = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = (im.width - W) // 2; y = int((im.height - H) * focus)
    return im.crop((x, y, x + W, y + H))

class Poster:
    def __init__(self, src, W, H, focus=0.5):
        self.W, self.H = W, H
        self.im = cover(Image.open(src).convert('RGB'), W, H, focus).convert('RGBA')
        self.ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); self.od = ImageDraw.Draw(self.ov); self.texts = []
    def grad(self, y0, y1, maxa=210, dark_at='bottom'):
        n = max(y1 - y0, 1)
        for i in range(n):
            t = i / max(n - 1, 1); a = int(maxa * (t if dark_at == 'bottom' else 1 - t))
            self.od.line([(0, y0 + i), (self.W, y0 + i)], fill=(0, 0, 0, a))
    def hgrad(self, x0, x1, maxa=140):
        n = max(x1 - x0, 1)
        for i in range(n): self.od.line([(x0 + i, 0), (x0 + i, self.H)], fill=(0, 0, 0, int(maxa * i / max(n - 1, 1))))
    def text(self, xy, s, fname, size, fill, anchor='la', maxw=None, shadow=True):
        f = font(fname, size)
        if maxw:
            while size > 12 and self.od.textlength(s, font=f) > maxw: size -= 2; f = font(fname, size)
        if shadow: self.od.text((xy[0] + 2, xy[1] + 3), s, font=f, fill=(0, 0, 0, 140), anchor=anchor)
        self.texts.append((xy, s, f, fill, anchor)); return f
    def width(self, s, fname, size): return self.od.textlength(s, font=font(fname, size))
    def pill(self, xy, s, fname, size, fg, bg, pad=(26, 12), align='l', outline=None):
        f = font(fname, size); tw = self.od.textlength(s, font=f)
        w = int(tw + 2 * pad[0]); h = int(size * 1.15 + 2 * pad[1]); x, y = xy
        if align == 'c': x -= w // 2
        elif align == 'r': x -= w
        self.od.rounded_rectangle([x, y - h // 2, x + w, y + h // 2], radius=h // 2, fill=bg, outline=outline, width=2)
        self.texts.append(((x + w // 2, y), s, f, fg, 'mm')); return w, h
    def rule(self, x0, y, x1, fill=(232, 184, 92, 255), w=3): self.od.line([(x0, y), (x1, y)], fill=fill, width=w)
    def save(self, path):
        out = Image.alpha_composite(self.im, self.ov); d = ImageDraw.Draw(out)
        for xy, s, f, fill, anchor in self.texts: d.text(xy, s, font=f, fill=fill, anchor=anchor)
        out.convert('RGB').save(path, quality=90, subsampling=0); print('saved', path)

A = f'{ROOT}/art'; P = f'{ROOT}/posters'; S = f'{ROOT}/sketches'; os.makedirs(P, exist_ok=True); os.makedirs(S, exist_ok=True)
EYEBROW = f'{BRAND.upper()} {NAME.upper()}'
TAG = 'Every rupee, in its place.'
SITE = 'baatbanao.shop'

# 01 FEED 1080x1350 — hero tray
p = Poster(f'{A}/hero_tray.jpg', 1080, 1350, 0.5); p.grad(860, 1350, 235)
p.pill((60, 86), f'{BRAND.upper()} 2.0', PS, 26, WHITE, (0, 0, 0, 110), outline=(255, 255, 255, 120))
p.text((56, 1150), NAME, PBL, 190, WHITE, anchor='ls', maxw=800)
p.rule(60, 1178, 300)
p.text((60, 1196), TAG, PS, 50, GOLD, maxw=960)
p.text((60, 1268), 'Cash · Bank · UPI · Receivables — one clear view.', PR, 30, GREY, maxw=960)
p.text((1020, 1315), SITE, PS, 24, GREY, anchor='rs')
p.save(f'{P}/01_feed_hero.jpg')

# 02 FEATURE — locked box 1080x1080
p = Poster(f'{A}/locked_box.jpg', 1080, 1080, 0.5); p.grad(0, 420, 205, dark_at='top'); p.grad(960, 1080, 160)
p.text((60, 78), EYEBROW, PS, 26, GOLD)
p.text((56, 190), 'Money owed to you,', PBL, 80, WHITE, anchor='ls', maxw=960)
p.text((56, 282), 'kept in view.', PBL, 80, GOLD, anchor='ls', maxw=960)
p.text((60, 318), 'Pending receivables stay frozen in the Locked Box until they are collected.', PR, 28, GREY, maxw=960)
p.text((1020, 1046), SITE, PS, 22, GREY, anchor='rs')
p.save(f'{P}/02_feature_locked_box.jpg')

# 03 FEATURE — collection flow 1080x1350
p = Poster(f'{A}/pour_flow.jpg', 1080, 1350, 0.5); p.grad(940, 1350, 235)
p.pill((60, 86), EYEBROW, PS, 24, WHITE, (0, 0, 0, 110), outline=(255, 255, 255, 120))
p.text((56, 1130), 'Collected.', PBL, 96, WHITE, anchor='ls', maxw=960)
p.text((56, 1236), 'Poured. Done.', PBL, 96, GOLD, anchor='ls', maxw=960)
p.text((60, 1262), 'Mark a payment received and watch it flow into the right account.', PR, 28, GREY, maxw=960)
p.text((1020, 1315), SITE, PS, 24, GREY, anchor='rs')
p.save(f'{P}/03_feature_collection_flow.jpg')

# 04 PRODUCT — phone 1080x1350
p = Poster(f'{A}/phone_product.jpg', 1080, 1350, 0.5); p.grad(0, 470, 190, dark_at='top'); p.grad(1200, 1350, 170)
p.text((540, 84), EYEBROW, PS, 26, GOLD, anchor='ma')
p.text((540, 150), 'Your money,', PBL, 88, WHITE, anchor='ma', maxw=980)
p.text((540, 256), 'in clear view.', PBL, 88, GOLD, anchor='ma', maxw=980)
p.text((540, 372), 'Eight boxes. Every account. One glance.', PR, 30, GREY, anchor='ma', maxw=980)
w1, h1 = p.pill((540 - 8, 1272), 'ANDROID', PS, 22, WHITE, (0, 0, 0, 110), align='r', outline=(255, 255, 255, 140))
p.pill((540 + 8, 1272), 'WEB', PS, 22, WHITE, (0, 0, 0, 110), align='l', outline=(255, 255, 255, 140))
p.text((1020, 1322), SITE, PS, 22, GREY, anchor='rs')
p.save(f'{P}/04_product_phone.jpg')

# 05 WEB BANNER 1600x680
p = Poster(f'{A}/wide_row.jpg', 1600, 680, 0.5); p.hgrad(900, 1600, 190)
x = 1085
p.text((x, 140), BRAND, PS, 40, GREY, anchor='ls')
p.text((x - 6, 300), NAME, PBL, 150, WHITE, anchor='ls', maxw=470)
p.rule(x, 326, x + 200)
p.text((x, 350), TAG, PS, 40, GOLD, maxw=470)
p.text((x, 412), 'Cash, bank, UPI and receivables —', PR, 26, GREY, maxw=470)
p.text((x, 448), 'one clear view, offline.', PR, 26, GREY, maxw=470)
w1, h1 = p.pill((x, 548), 'ANDROID APK', PS, 20, WHITE, (0, 0, 0, 110), outline=(255, 255, 255, 150))
p.pill((x + w1 + 14, 548), 'WEB APP', PS, 20, WHITE, (0, 0, 0, 110), outline=(255, 255, 255, 150))
p.text((1550, 640), SITE, PS, 22, GREY, anchor='rs')
p.save(f'{P}/05_web_banner.jpg')

# 06 STORY 1080x1920 — counter scene
p = Poster(f'{ROOT}/art/counter_scene.jpg', 1080, 1920, 0.5); p.grad(0, 420, 180, dark_at='top'); p.grad(1180, 1920, 235)
p.pill((540, 120), f'{BRAND.upper()} 2.0', PS, 28, NAVY, GOLD, align='c')
p.text((540, 176), EYEBROW, PS, 28, WHITE, anchor='ma')
p.text((66, 1540), 'Built for', PBL, 118, WHITE, anchor='ls', maxw=950)
p.text((66, 1668), 'the counter.', PBL, 118, GOLD, anchor='ls', maxw=950)
p.text((70, 1700), 'Cash, bank, UPI and receivables — one clear view, even offline.', PR, 32, GREY, maxw=950)
p.text((70, 1846), f'{SITE}  ·  Android & Web', PS, 26, GREY, anchor='ls')
p.save(f'{P}/06_story_counter.jpg')

# ================= PLANNING SHEETS (clean typography on paper) =================
def paper(W, H):
    im = Image.new('RGB', (W, H), (249, 247, 243)); d = ImageDraw.Draw(im)
    for x in range(0, W, 40): d.line([(x, 0), (x, H)], fill=(236, 233, 227))
    for y in range(0, H, 40): d.line([(0, y), (W, y)], fill=(236, 233, 227))
    return im, d
def T(d, xy, s, fn, size, fill=INK, anchor='la'): d.text(xy, s, font=font(fn, size), fill=fill, anchor=anchor)
def mark(d, xy, kind):
    x, y = xy
    if kind == 'ok': d.line([(x, y + 14), (x + 11, y + 26), (x + 32, y + 2)], fill=GREEN, width=6, joint='curve')
    elif kind == 'no': d.line([(x + 2, y + 2), (x + 28, y + 28)], fill=RED, width=6); d.line([(x + 28, y + 2), (x + 2, y + 28)], fill=RED, width=6)
    else: d.polygon([(x + 15, y), (x + 32, y + 28), (x - 2, y + 28)], outline=ORANGE, width=5)
def box(d, b, outline=INK, fill=(255, 255, 255), w=3, r=14): d.rounded_rectangle(b, radius=r, fill=fill, outline=outline, width=w)
def arrow(d, p0, p1, fill=INK, w=4):
    d.line([p0, p1], fill=fill, width=w); ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    for s in (-1, 1): d.line([p1, (p1[0] - 20 * math.cos(ang + s * .5), p1[1] - 20 * math.sin(ang + s * .5))], fill=fill, width=w)

# 05 NAMING BOARD
im, d = paper(1600, 1000)
T(d, (60, 44), 'Feature naming — decision board', PB, 54)
T(d, (62, 116), f'Module name for the visual multi-account balance feature in {BRAND} 2.0', PR, 26, MUTED)
d.line([(60, 168), (920, 168)], fill=INK, width=2)
rows = [('ok', NAME, "All money — cash, bank, UPI. One syllable; understood across India ('bank vault', 'locker')."),
        ('no', 'Tijori', 'Regional; not aligned with the professional English brand voice adopted for 2.0'),
        ('no', 'Treasury', 'Corporate / government tone; heavy for a merchant audience'),
        ('no', 'Reservoir', 'Fits the liquid metaphor, but low comprehension in the target market'),
        ('no', 'Wallet', 'Saturated category term; implies small sums'),
        ('no', 'Cashbox / Galla', 'Cash-only connotation'),
        ('tri', 'Balance Board', 'Descriptive fallback if validation fails')]
y = 196
for k, n, why in rows:
    mark(d, (66, y + 10), k); T(d, (120, y), n, PB, 34, INK if k == 'ok' else (80, 84, 92))
    T(d, (122, y + 46), why, PR, 20, MUTED); y += 96
d.rounded_rectangle((108, 186, 300, 250), radius=30, outline=RED, width=4); T(d, (318, 202), 'FINAL', PB, 26, RED)
box(d, (980, 190, 1540, 520), outline=INK, fill=(255, 255, 255), w=3, r=18)
T(d, (1260, 226), BRAND, PS, 40, MUTED, anchor='ma')
T(d, (1260, 280), NAME.upper(), PBL, 118, TEAL, anchor='ma')
T(d, (1260, 428), TAG, PS, 30, INK, anchor='ma')
T(d, (1260, 472), f'{BRAND} 2.0  —  {NAME}', PR, 24, ORANGE, anchor='ma')
notes = [f'Master brand unchanged: {BRAND}', f'Feature: {NAME} · Box 1–8 · receivables = Locked Box',
         f'Home tab: {NAME} · Khata · Baat', 'Retired: PaaniKhata (codename), Tijori (interim)',
         'Validation: 10 users, proceed at 7+ comprehension', 'Trademark check: class 9 / 36 before launch']
y = 560
for n in notes: d.ellipse((986, y + 10, 998, y + 22), fill=INK); T(d, (1012, y), n, PR, 21); y += 48
T(d, (1540, 972), f'{BRAND} {NAME} — naming board · 28 Sep 2026', PR, 18, (150, 150, 158), anchor='rs')
im.save(f'{S}/05_naming_board.jpg', quality=88); print('saved naming board')

# 06 INTEGRATION MAP
im, d = paper(1600, 1000)
T(d, (60, 40), 'One roof, three modules — how money flows', PB, 50)
T(d, (62, 106), f'Baat (remind)  ->  Khata (record)  ->  {NAME} (see the balance move)', PR, 26, MUTED)
d.line([(100, 205), (800, 150), (1500, 205)], fill=INK, width=3); T(d, (800, 158), BRAND.upper(), PB, 30, INK, anchor='ma')
mods = [((110, 232, 520, 450), 'BAAT', ['Reminder messages (4 languages)', 'UPI payment link + QR', 'Bulk reminder queue', 'existing'], BLUE),
        ((595, 232, 1005, 450), 'KHATA', ['Receivables ledger', 'pending / partial / paid', 'Due date, customer, template', 'existing'], ORANGE),
        ((1080, 232, 1490, 450), NAME.upper(), ['8 balance boxes (ice-cube tray)', 'Flick · Align · Find · Detail', 'Box 8 = Locked Box (receivables)', 'new'], TEAL)]
for b, n, lines, col in mods:
    box(d, b, outline=col, w=4); T(d, (b[0] + 22, b[1] + 16), n, PB, 38, col); yy = b[1] + 80
    for ln in lines: T(d, (b[0] + 24, yy), ln, PR, 23, INK if ln not in ('existing', 'new') else MUTED); yy += 36
arrow(d, (522, 340), (592, 340)); arrow(d, (1007, 340), (1077, 340))
T(d, (557, 300), 'remind', PR, 18, MUTED, anchor='ma'); T(d, (1042, 296), 'PAID', PB, 20, RED, anchor='ma')
T(d, (110, 484), f'{NAME} home — tray', PB, 26)
cols = [BLUE, TEAL, ORANGE, (120, 70, 200), (60, 170, 240), (70, 80, 190), (220, 170, 40), (130, 140, 150)]
lv = [.10, 1.0, .80, .22, .45, .60, 1.0, .15]
for i in range(8):
    cx = 120 + (i % 4) * 128; cy = 526 + (i // 4) * 116; b = (cx, cy, cx + 104, cy + 98); h = int(86 * lv[i])
    if i == 7:
        d.rectangle((cx + 4, cy + 4, cx + 100, cy + 94), fill=(226, 232, 240))
        for k in range(0, 100, 12): d.line([(cx + 4 + k, cy + 4), (cx + 4, cy + 4 + k)], fill=(196, 206, 218), width=2)
        T(d, (cx + 52, cy + 30), 'LOCKED', PB, 15, INK, anchor='ma'); T(d, (cx + 52, cy + 52), 'receivables', PR, 14, MUTED, anchor='ma')
    else: d.rectangle((cx + 4, cy + 94 - h, cx + 100, cy + 94), fill=cols[i])
    d.rectangle(b, outline=INK, width=3); T(d, (cx + 8, cy + 4), str(i + 1), PB, 18, INK)
arrow(d, (640, 786), (600, 762), RED, 4); T(d, (120, 768), "PAID  ->  'Which box?'  ->  Box 8 thaws, liquid flows into Cash / UPI", PR, 21, RED)
T(d, (740, 484), 'Automatic links (what stand-alone apps cannot do)', PB, 26)
magic = ['1.  New credit entry in Khata  ->  Box 8 rises (frost forms)',
         "2.  Reminder sent from Baat  ->  '3 pending' chip on Box 8",
         "3.  Marked paid  ->  'Which box?'  ->  pour into Cash / UPI / bank",
         '4.  Partial payment  ->  proportional thaw',
         '5.  Monthly strip: In · Out · Collected',
         '6.  Find a box by number or voice']
y = 526
for m in magic: T(d, (745, y), m, PR, 23); y += 38
d.line([(110, 862), (1490, 862)], fill=INK, width=3)
ph = [(110, 'Week 1', 'naming + design'), (330, 'Weeks 2–3', 'Flutter shell: Khata + Baat port, Hive'),
      (740, 'Week 4', 'integration'), (980, 'Week 5', 'release: APK + Play + web'), (1270, 'Week 6', 'Diwali launch · 8 Nov')]
for x, a, b in ph: d.line([(x, 848), (x, 876)], fill=INK, width=3); T(d, (x, 882), a, PB, 22); T(d, (x, 910), b, PR, 20, MUTED)
d.ellipse((1435, 834, 1493, 854), fill=(180, 90, 40)); d.polygon([(1464, 830), (1452, 804), (1464, 774), (1476, 804)], fill=(250, 170, 40))
T(d, (60, 956), 'Technical basis: Flutter (one codebase = APK + web)  ·  Hive, offline-first  ·  PWA frozen  ·  same-origin localStorage auto-import', PR, 21, MUTED)
im.save(f'{S}/06_integration_map.jpg', quality=88); print('saved integration map')

# roadmap sketch carried over (no text inside)
if os.path.exists(f'{ROOT}/sketches/04_roadmap_diwali.jpg'):
    Image.open(f'{ROOT}/sketches/04_roadmap_diwali.jpg').save(f'{S}/04_roadmap.jpg', quality=88)
for f in sorted(glob.glob(f'{S}/*.png')):
    Image.open(f).convert('RGB').save(f[:-4] + '.jpg', quality=88); os.remove(f)

# contact sheets
def sheet_posters():
    files = ['01_feed_hero.jpg', '03_feature_collection_flow.jpg', '04_product_phone.jpg', '02_feature_locked_box.jpg', '06_story_counter.jpg']
    H = 620; ims = [Image.open(f'{P}/{f}') for f in files]
    ims = [i.resize((round(i.width * H / i.height), H), Image.LANCZOS) for i in ims]
    W = sum(i.width for i in ims) + 20 * (len(ims) + 1)
    ban = Image.open(f'{P}/05_web_banner.jpg'); ban = ban.resize((W - 40, round(ban.height * (W - 40) / ban.width)), Image.LANCZOS)
    sh = Image.new('RGB', (W, H + ban.height + 120), (22, 22, 28)); dd = ImageDraw.Draw(sh)
    dd.text((20, 16), f'{BRAND} {NAME} — product poster set', font=font(PB, 30), fill=WHITE)
    x = 20
    for i in ims: sh.paste(i, (x, 64)); x += i.width + 20
    sh.paste(ban, (20, H + 96)); sh.save(f'{ROOT}/00_SHEET_posters_v2.jpg', quality=85)
def sheet_sketches():
    files = sorted(glob.glob(f'{S}/*.jpg')); tw, th = 780, 440
    sh = Image.new('RGB', (20 + 2 * (tw + 20), 70 + 3 * (th + 20)), (249, 247, 243)); dd = ImageDraw.Draw(sh)
    dd.text((20, 16), f'{BRAND} {NAME} — planning sketches', font=font(PB, 32), fill=INK)
    for k, f in enumerate(files):
        i = Image.open(f); i.thumbnail((tw, th)); sh.paste(i, (20 + (k % 2) * (tw + 20), 70 + (k // 2) * (th + 20)))
    sh.save(f'{ROOT}/00_SHEET_sketches_v2.jpg', quality=85)
sheet_posters(); sheet_sketches(); print('sheets done')
