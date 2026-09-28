# Preview 2 — Tap box -> DETAIL flow (Frame 7 inside an ice cube)
# idle -> tap box 3 -> open transition -> IN bands stack -> band tap highlight -> OUT notches -> ALL
# -> swipe row delete + UNDO (liquid reacts) -> swipe left = next box (4 PhonePe) -> back to home
import math, os, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import imageio_ffmpeg

W, H, FPS, DUR = 540, 1080, 30, 17.5
OUT = '/home/user/cube_3d_views/anim'
FR = '/tmp/frames2'
os.makedirs(FR, exist_ok=True)
for f in os.listdir(FR):
    os.remove(os.path.join(FR, f))

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
_fc = {}
def F(sz, b=False):
    k = (sz, b)
    if k not in _fc: _fc[k] = ImageFont.truetype(FONTB if b else FONT, sz)
    return _fc[k]
def ease(t): t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)
def ease_out(t): t = max(0.0, min(1.0, t)); return 1 - (1 - t) ** 3
def lerp(a, b, t): return a + (b - a) * t
def inr(n): return '₹' + f"{int(round(n)):,}"
def A(img, layer): img.alpha_composite(layer)

ACC = [
    dict(n=1, name='SBI', amt=200, pct=0.10, col=(52, 120, 246)),
    dict(n=2, name='HDFC', amt=2000, pct=1.00, col=(32, 178, 150)),
    dict(n=3, name='Cash', amt=1600, pct=0.80, col=(255, 140, 40)),
    dict(n=4, name='PhonePe', amt=450, pct=0.22, col=(120, 70, 200)),
    dict(n=5, name='Paytm', amt=900, pct=0.45, col=(60, 170, 240)),
    dict(n=6, name='ICICI', amt=1200, pct=0.60, col=(70, 80, 190)),
    dict(n=7, name='Gold', amt=2500, pct=1.00, col=(220, 170, 40)),
    dict(n=8, name='Udhaar', amt=300, pct=0.15, col=(130, 140, 150)),
]
BY = {a['n']: a for a in ACC}
GOAL = 2000
# per-account ledger (newest first). sign + = aaya, - = gaya
LEDGER = {
    3: [(+500, 'Salary', '26 Sep'), (-300, 'Kirana', '25 Sep'), (+800, 'Udhaar wapas', '24 Sep'),
        (-200, 'Chai', '23 Sep'), (-150, 'Auto', '22 Sep'), (+300, 'Shop sale', '21 Sep')],
    4: [(+150, 'Cashback', '25 Sep'), (-120, 'Recharge', '24 Sep'), (+300, 'UPI aaya', '22 Sep')],
}
S, R, HS = 150, 28, 75
TX0, TY0, TX1, TY1 = 40, 110, 500, 820
COLS = [TX0 + (TX1 - TX0) * 0.28, TX0 + (TX1 - TX0) * 0.72]
ROWS = [TY0 + (TY1 - TY0) * f for f in (0.14, 0.38, 0.62, 0.86)]
SLOT = {n: (COLS[(n - 1) % 2], ROWS[(n - 1) // 2]) for n in BY}
# detail geometry
CX0, CY0, CS = 150, 165, 330           # big cube rect (left, top, size)
CR = 40
LX0, LY0, LX1 = 40, 528, 500           # timeline card
ROW_H = 62
GREEN, RED, DARK, GREY = (30, 140, 70), (200, 50, 50), (20, 24, 30), (95, 105, 120)

MASK = Image.new('L', (S, S), 0); ImageDraw.Draw(MASK).rounded_rectangle([0, 0, S - 1, S - 1], R, fill=255)

def small_cube_tile(a, pct, amt, phase):
    col = a['col']; base = tuple(int(255 * 0.87 + c * 0.13) for c in col)
    tile = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(tile)
    d.rounded_rectangle([0, 0, S - 1, S - 1], R, fill=base + (255,))
    liq = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ld = ImageDraw.Draw(liq)
    level = S - 4 - pct * (S - 8)
    pts = [(x, level + 2.2 * math.sin(2 * math.pi * x / 95 + phase)) for x in range(0, S + 1, 5)]
    ld.polygon(pts + [(S, S + 5), (0, S + 5)], fill=col + (210,)); ld.line(pts, fill=(255, 255, 255, 170), width=3)
    tile = Image.alpha_composite(tile, liq)
    gl = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(gl)
    gd.rounded_rectangle([12, 9, int(S * 0.6), 30], 12, fill=(255, 255, 255, 95))
    tile = Image.alpha_composite(tile, gl)
    tile.putalpha(ImageChops.multiply(tile.getchannel('A'), MASK))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle([0, 0, S - 1, S - 1], R, outline=tuple(int(c * 0.72) for c in col) + (170,), width=2)
    d.rounded_rectangle([S / 2 - 62, S / 2 - 26, S / 2 + 62, S / 2 + 36], 14, fill=(255, 255, 255, 175))
    d.ellipse([8, 8, 36, 36], fill=(255, 255, 255, 240), outline=(80, 80, 80, 220), width=1)
    d.text((22, 22), str(a['n']), font=F(15, True), fill=(25, 25, 25, 255), anchor='mm')
    d.text((S - 12, 22), f"{int(round(pct * 100))}%", font=F(15, True), fill=(50, 50, 50, 255), anchor='rm')
    d.text((S / 2, S / 2 - 8), a['name'], font=F(19, True), fill=(20, 20, 20, 255), anchor='mm')
    d.text((S / 2, S / 2 + 18), inr(amt), font=F(19, True), fill=(20, 20, 20, 255), anchor='mm')
    return tile

def shadow(size, blur=12, alpha=70):
    pad = 60; im = Image.new('RGBA', (size + 2 * pad, size + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([pad, pad + 8, pad + size, pad + size + 8], int(size * 0.18), fill=(20, 40, 80, alpha))
    return im.filter(ImageFilter.GaussianBlur(blur))
SH_SMALL = shadow(S); SH_BIG = shadow(CS, 18, 80)

def paste_center(img, tile, cx, cy):
    img.alpha_composite(tile, (int(cx - tile.width / 2), int(cy - tile.height / 2)))

def home_layer(t, alpha=1.0, skip=None, ring=None, ring_a=0.0):
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.rounded_rectangle([TX0 - 4, TY0 - 4, TX1 + 4, TY1 + 4], 30, fill=(214, 220, 228, 255))
    d.rounded_rectangle([TX0, TY0, TX1, TY1], 26, fill=(230, 234, 240, 255))
    for a in ACC:
        if a['n'] == skip: continue
        x, y = SLOT[a['n']]
        paste_center(lay, SH_SMALL, x, y + 6)
        paste_center(lay, small_cube_tile(a, a['pct'], a['amt'], t * 2.4 + a['n']), x, y)
    if ring and ring_a > 0:
        x, y = SLOT[ring]; d = ImageDraw.Draw(lay)
        d.rounded_rectangle([x - HS - 6, y - HS - 6, x + HS + 6, y + HS + 6], R + 6, outline=(70, 220, 255, int(230 * ring_a)), width=4)
    if alpha < 1: lay.putalpha(lay.getchannel('A').point(lambda v: int(v * alpha)))
    return lay

def y_for(v): return CY0 + CS - 4 - (v / GOAL) * (CS - 8)

def big_cube(a, bal, t, view, band_prog, notch_prog, band_hl=None, amp_extra=0.0):
    """big detail cube as RGBA layer sized CS x CS (0,0 = CX0,CY0)"""
    col = a['col']; base = tuple(int(255 * 0.88 + c * 0.12) for c in col)
    tile = Image.new('RGBA', (CS, CS), (0, 0, 0, 0)); d = ImageDraw.Draw(tile)
    mask = Image.new('L', (CS, CS), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, CS - 1, CS - 1], CR, fill=255)
    d.rounded_rectangle([0, 0, CS - 1, CS - 1], CR, fill=base + (255,))
    pct = max(0, min(1, bal / GOAL))
    level = CS - 4 - pct * (CS - 8)
    liq = Image.new('RGBA', (CS, CS), (0, 0, 0, 0)); ld = ImageDraw.Draw(liq)
    amp = 3 + amp_extra
    pts = [(x, level + amp * math.sin(2 * math.pi * x / 120 + t * 2.2)) for x in range(0, CS + 1, 5)]
    ld.polygon(pts + [(CS, CS + 5), (0, CS + 5)], fill=col + (215,)); ld.line(pts, fill=(255, 255, 255, 170), width=3)
    ov = Image.new('RGBA', (CS, CS), (0, 0, 0, 0)); ld = ImageDraw.Draw(ov)   # overlay: bands + notches (composited, not replaced)
    # IN bands (stacked bottom-up)
    if view in ('IN', 'ALL'):
        base_v = 0
        ins = [e for e in reversed(LEDGER[a['n']]) if e[0] > 0]
        for amt, note, _ in ins:
            p = band_prog.get(note, 0.0)
            if p <= 0: base_v += amt; continue
            yb = CS - 4 - (base_v / GOAL) * (CS - 8); yt = CS - 4 - ((base_v + amt) / GOAL) * (CS - 8)
            ytp = yb - (yb - yt) * p
            hl = (band_hl == note)
            ld.rectangle([0, ytp, CS, yb], fill=(255, 255, 255, 120 if hl else 62))
            ld.line([(0, ytp), (CS, ytp)], fill=(255, 255, 255, 220 if hl else 150), width=3 if hl else 2)
            if hl: ld.rectangle([2, ytp + 1, CS - 3, yb - 1], outline=(255, 255, 255, 240), width=3)
            if p > 0.6 and yb - ytp > 22:
                ld.text((CS / 2, (ytp + yb) / 2), f"+{amt}", font=F(19, True), fill=(255, 255, 255, int(255 * (p - 0.6) / 0.4)), anchor='mm')
            base_v += amt
    # OUT notches (right edge, from surface downward)
    if view in ('OUT', 'ALL'):
        lv = bal
        outs = [e for e in LEDGER[a['n']] if e[0] < 0]
        for amt, note, _ in outs:
            p = notch_prog.get(note, 0.0)
            if p <= 0: lv += amt; continue
            yt = CS - 4 - (lv / GOAL) * (CS - 8); yb = CS - 4 - ((lv + amt) / GOAL) * (CS - 8)
            ybp = yt + (yb - yt) * p
            ld.rectangle([CS - 18, yt, CS, ybp], fill=(225, 60, 60, 230))
            ld.line([(CS - 18, yt), (CS, yt)], fill=(255, 255, 255, 200), width=2)
            if p > 0.6:
                lab = f"−{abs(amt)} {note}"
                tw = F(15, True).getlength(lab)
                ld.rounded_rectangle([CS - 28 - tw - 12, (yt + ybp) / 2 - 12, CS - 24, (yt + ybp) / 2 + 12], 10, fill=(255, 255, 255, int(220 * (p - 0.6) / 0.4)))
                ld.text((CS - 30, (yt + ybp) / 2), lab, font=F(15, True), fill=(200, 40, 40, int(255 * (p - 0.6) / 0.4)), anchor='rm')
            lv += amt
    liq = Image.alpha_composite(liq, ov)
    tile = Image.alpha_composite(tile, liq)
    gl = Image.new('RGBA', (CS, CS), (0, 0, 0, 0)); gd = ImageDraw.Draw(gl)
    gd.rounded_rectangle([16, 12, int(CS * 0.55), 40], 14, fill=(255, 255, 255, 90))
    gd.rounded_rectangle([CS - 30, 40, CS - 18, CS - 60], 6, fill=(255, 255, 255, 60))
    tile = Image.alpha_composite(tile, gl)
    tile.putalpha(ImageChops.multiply(tile.getchannel('A'), mask))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle([0, 0, CS - 1, CS - 1], CR, outline=tuple(int(c * 0.7) for c in col) + (180,), width=3)
    d.rounded_rectangle([3, 3, CS - 4, CS - 4], CR - 3, outline=(255, 255, 255, 140), width=1)
    # amount pill (top-left, never collides with band/notch labels)
    tw = F(24, True).getlength(inr(bal))
    pill = Image.new('RGBA', (CS, CS), (0, 0, 0, 0)); pd = ImageDraw.Draw(pill)
    pd.rounded_rectangle([14, 14, 14 + tw + 28, 52], 19, fill=(20, 24, 30, 150))
    pd.text((28, 33), inr(bal), font=F(24, True), fill=(255, 255, 255, 255), anchor='lm')
    tile = Image.alpha_composite(tile, pill); d = ImageDraw.Draw(tile)
    d.ellipse([CS - 46, 10, CS - 10, 46], fill=(255, 255, 255, 240), outline=(80, 80, 80, 220), width=1)
    d.text((CS - 28, 28), str(a['n']), font=F(18, True), fill=(25, 25, 25, 255), anchor='mm')
    return tile

def rows_for(n, view):
    led = LEDGER[n]
    if view == 'IN': return [e for e in led if e[0] > 0]
    if view == 'OUT': return [e for e in led if e[0] < 0]
    return led

def row_tile(entry, hl=False, dx=0.0, deleting=False):
    amt, note, date = entry
    tile = Image.new('RGBA', (LX1 - LX0, ROW_H), (0, 0, 0, 0)); d = ImageDraw.Draw(tile)
    if dx < 0:
        d.rectangle([0, 0, tile.width, ROW_H], fill=(225, 60, 60, 255))
        d.text((tile.width - 24, ROW_H / 2), 'Delete', font=F(17, True), fill=(255, 255, 255, 255), anchor='rm')
    body = Image.new('RGBA', tile.size, (0, 0, 0, 0)); bd = ImageDraw.Draw(body)
    bd.rectangle([0, 0, tile.width, ROW_H], fill=(255, 248, 215, 255) if hl else (255, 255, 255, 255))
    bd.line([(16, ROW_H - 1), (tile.width - 16, ROW_H - 1)], fill=(232, 236, 242, 255), width=1)
    c = GREEN if amt > 0 else RED
    bd.ellipse([18, ROW_H / 2 - 6, 30, ROW_H / 2 + 6], fill=c + (255,))
    bd.text((42, ROW_H / 2), f"{'+' if amt > 0 else '−'}{inr(abs(amt))}", font=F(19, True), fill=c + (255,), anchor='lm')
    bd.text((150, ROW_H / 2), note, font=F(18), fill=DARK + (255,), anchor='lm')
    bd.text((tile.width - 18, ROW_H / 2), date, font=F(14), fill=GREY + (255,), anchor='rm')
    tile.alpha_composite(body, (int(dx), 0)) if dx else tile.alpha_composite(body)
    return tile

def detail_content(a, st, t):
    """everything that slides on account swipe: scale, cube, timeline card, strip. RGBA W x H"""
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    # scale
    for i in range(5):
        v = GOAL * i / 4; y = y_for(v)
        d.line([(CX0 - 14, y), (CX0 - 4, y)], fill=(140, 150, 165, 255), width=2)
        d.text((CX0 - 20, y), inr(v), font=F(13), fill=GREY + (255,), anchor='rm')
        if i: d.line([(CX0, y), (CX0 + CS, y)], fill=(0, 0, 0, 14), width=1)
    paste_center(lay, SH_BIG, CX0 + CS / 2, CY0 + CS / 2 + 4)
    cube = big_cube(a, st['bal'], t, st['view'], st['band_prog'], st['notch_prog'], st.get('band_hl'), st.get('amp', 0))
    lay.alpha_composite(cube, (CX0, CY0))
    # timeline card
    rows = rows_for(a['n'], st['view'])
    card_h = 292
    d.rounded_rectangle([LX0, LY0, LX1, LY0 + card_h], 18, fill=(255, 255, 255, 255))
    la = st.get('list_alpha', 1.0)
    lst = Image.new('RGBA', (LX1 - LX0, card_h), (0, 0, 0, 0))
    y = 8; shown = 0
    for e in rows:
        if shown >= 4: break
        hf = st.get('row_h', {}).get(e[1], 1.0)
        if hf <= 0: continue
        rt = row_tile(e, hl=(st.get('row_hl') == e[1]), dx=st.get('row_dx', {}).get(e[1], 0.0))
        if hf < 1: rt = rt.crop((0, 0, rt.width, max(1, int(ROW_H * hf))))
        lst.alpha_composite(rt, (0, int(y))); y += ROW_H * hf; shown += 1
    if len(rows) > 4:
        ld = ImageDraw.Draw(lst); ld.text((lst.width / 2, y + 22), 'Purana dekho', font=F(15, True), fill=(50, 90, 160, 255), anchor='mm')
        ld.line([(lst.width / 2 - 52, y + 32), (lst.width / 2 + 52, y + 32)], fill=(50, 90, 160, 255), width=1)
    # clip list to rounded card
    cm = Image.new('L', lst.size, 0); ImageDraw.Draw(cm).rounded_rectangle([0, 0, lst.width - 1, card_h - 1], 18, fill=255)
    lst.putalpha(ImageChops.multiply(lst.getchannel('A'), cm))
    if la < 1: lst.putalpha(lst.getchannel('A').point(lambda v: int(v * la)))
    lay.alpha_composite(lst, (LX0, LY0))
    # month strip
    aaya = sum(e[0] for e in LEDGER[a['n']] if e[0] > 0 and st.get('row_h', {}).get(e[1], 1.0) > 0)
    gaya = -sum(e[0] for e in LEDGER[a['n']] if e[0] < 0 and st.get('row_h', {}).get(e[1], 1.0) > 0)
    sy = LY0 + card_h + 12
    d.rounded_rectangle([LX0, sy, LX1, sy + 42], 12, fill=(255, 255, 255, 255))
    parts = [('Is mahine — ', DARK), (f"Aaya {inr(aaya)}", GREEN), (' · ', GREY), (f"Gaya {inr(gaya)}", RED), (' · ', GREY), (f"Net +{inr(aaya - gaya)}", DARK)]
    tw = sum(F(16, True).getlength(p) for p, _ in parts); x = W / 2 - tw / 2
    for p, c in parts:
        d.text((x, sy + 21), p, font=F(16, True), fill=c + (255,), anchor='lm'); x += F(16, True).getlength(p)
    return lay

def chrome(img, d, title, dots_active, view, toggle_flash=None, alpha=1.0):
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
    ld.text((W / 2, 46), title, font=F(22, True), fill=DARK + (255,), anchor='mm')
    ld.line([(36, 46), (24, 46)], fill=DARK + (255,), width=3); ld.line([(24, 46), (33, 37)], fill=DARK + (255,), width=3); ld.line([(24, 46), (33, 55)], fill=DARK + (255,), width=3)
    for k in range(3): ld.ellipse([W - 34, 36 + k * 8, W - 29, 41 + k * 8], fill=DARK + (255,))
    for i in range(8):
        x = W / 2 - 7 * 9 + i * 18
        ld.ellipse([x - 4, 74, x + 4, 82], fill=DARK + (255,) if i == dots_active else (200, 205, 215, 255))
    # toggle
    ld.rounded_rectangle([W / 2 - 120, 104, W / 2 + 120, 142], 19, fill=(226, 230, 237, 255))
    for i, v in enumerate(('IN', 'OUT', 'ALL')):
        x0 = W / 2 - 116 + i * 78
        if v == view: ld.rounded_rectangle([x0, 108, x0 + 76, 138], 15, fill=(255, 255, 255, 255))
        if v == toggle_flash: ld.rounded_rectangle([x0, 108, x0 + 76, 138], 15, fill=(200, 235, 245, 255))
        ld.text((x0 + 38, 123), v, font=F(16, True), fill=DARK + (255,) if v == view else GREY + (255,), anchor='mm')
    if alpha < 1: lay.putalpha(lay.getchannel('A').point(lambda v: int(v * alpha)))
    A(img, lay)

def draw_finger(img, x, y, pressed, alpha):
    if alpha <= 0: return
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    r = 20 if pressed else 27
    d.ellipse([x - r - 6, y - r - 6, x + r + 6, y + r + 6], fill=(255, 255, 255, int(70 * alpha)))
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, int(120 * alpha)), outline=(40, 44, 52, int(220 * alpha)), width=3)
    d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(40, 44, 52, int(230 * alpha)))
    A(img, lay)

def buttons(d):
    d.rounded_rectangle([40, 928, 232, 998], 34, fill=(46, 160, 90)); d.text((136, 963), '+  Aaya', font=F(22, True), fill='white', anchor='mm')
    d.ellipse([248, 938, 298, 988], fill=(255, 255, 255), outline=(200, 206, 216), width=2)
    d.rounded_rectangle([268, 950, 278, 966], 5, fill=DARK); d.arc([262, 954, 284, 976], 0, 180, fill=DARK, width=2); d.line([273, 976, 273, 981], fill=DARK, width=2)
    d.rounded_rectangle([314, 928, 500, 998], 34, fill=(225, 70, 70)); d.text((407, 963), '−  Kharch', font=F(22, True), fill='white', anchor='mm')

def caption(img, text):
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    tw = F(15, True).getlength(text)
    d.rounded_rectangle([W / 2 - tw / 2 - 16, 1022, W / 2 + tw / 2 + 16, 1058], 18, fill=(30, 36, 46, 225))
    d.text((W / 2, 1040), text, font=F(15, True), fill=(255, 255, 255, 255), anchor='mm')
    A(img, lay)

def caption_for(t):
    if t < 1.6: return 'Tap any box → Detail'
    if t < 4.0: return "IN view — har band = ek 'aaya' entry, neeche se stack"
    if t < 5.6: return 'Band tap → matching entry highlight'
    if t < 7.6: return 'OUT view — kharch = right edge pe red notches'
    if t < 9.0: return 'ALL — aaya + gaya dono saath'
    if t < 12.6: return 'Swipe row = delete · no popup · 5s UNDO'
    if t < 15.4: return 'Swipe ← → = agla box (4 · PhonePe)'
    return 'Back / pull-down = Home'

# ---------- finger choreography ----------
ROWY = lambda idx: LY0 + 8 + idx * ROW_H + ROW_H / 2
def finger_state(t):
    def tap(t0, x, y):
        if t0 - 0.3 <= t < t0: a = ease((t - t0 + 0.3) / 0.3); return (x, y + 30 * (1 - a), False, a)
        if t0 <= t < t0 + 0.2: return (x, y, True, 1.0)
        if t0 + 0.2 <= t < t0 + 0.5: return (x, y, False, 1 - ease((t - t0 - 0.2) / 0.3))
        return None
    for (t0, x, y) in [(1.5, SLOT[3][0], SLOT[3][1]), (4.4, CX0 + CS / 2, (y_for(300) + y_for(800)) / 2),
                       (5.9, W / 2 - 116 + 78 + 38, 123), (7.9, W / 2 - 116 + 156 + 38, 123),
                       (11.6, 392, 789), (15.6, 30, 46)]:
        r = tap(t0, x, y)
        if r: return r
    # swipe row (Chai, index 3 in ALL) 9.3 -> 9.8
    if 9.0 <= t < 10.1:
        y = ROWY(3)
        if t < 9.3: a = ease((t - 9.0) / 0.3); return (400, y + 30 * (1 - a), False, a)
        if t < 9.8: return (lerp(400, 190, ease((t - 9.3) / 0.5)), y, True, 1.0)
        return (190, y, False, 1 - ease((t - 9.8) / 0.3))
    # swipe cube left 12.9 -> 13.5
    if 12.6 <= t < 13.8:
        y = CY0 + CS / 2
        if t < 12.9: a = ease((t - 12.6) / 0.3); return (440, y + 30 * (1 - a), False, a)
        if t < 13.5: return (lerp(440, 90, ease((t - 12.9) / 0.6)), y, True, 1.0)
        return (90, y, False, 1 - ease((t - 13.5) / 0.3))
    return None

# ---------- main loop ----------
N = int(DUR * FPS)
for fi in range(N):
    t = fi / FPS
    img = Image.new('RGBA', (W, H), (243, 246, 250, 255)); d = ImageDraw.Draw(img)

    # ----- state for Cash (box 3) -----
    view = 'IN' if t < 6.0 else ('OUT' if t < 8.0 else 'ALL')
    band_prog = {'Shop sale': ease_out((t - 2.5) / 0.4), 'Salary': ease_out((t - 2.9) / 0.4), 'Udhaar wapas': ease_out((t - 3.3) / 0.4)}
    notch_prog = {'Kirana': ease_out((t - 6.1) / 0.4), 'Chai': ease_out((t - 6.4) / 0.4), 'Auto': ease_out((t - 6.7) / 0.4)}
    band_hl = 'Salary' if 4.5 <= t < 5.7 else None
    row_hl = 'Salary' if 4.5 <= t < 5.7 else None
    list_alpha = 1.0
    for t0 in (6.0, 8.0):   # crossfade on toggle
        if t0 - 0.15 <= t < t0: list_alpha = 1 - (t - t0 + 0.15) / 0.15
        if t0 <= t < t0 + 0.15: list_alpha = (t - t0) / 0.15
    row_dx = {}; row_h = {}
    if 9.3 <= t < 9.8: row_dx['Chai'] = -210 * ease((t - 9.3) / 0.5)
    elif 9.8 <= t < 10.1: row_dx['Chai'] = -210; row_h['Chai'] = 1 - ease((t - 9.8) / 0.3)
    elif 10.1 <= t < 11.8: row_h['Chai'] = 0.0
    elif 11.8 <= t < 12.1: row_h['Chai'] = ease((t - 11.8) / 0.3)
    # liquid reacts: Chai deleted -> balance 1,800 ; undo -> 1,600
    if t < 10.1: bal = 1600
    elif t < 10.9: bal = lerp(1600, 1800, ease((t - 10.1) / 0.8))
    elif t < 11.8: bal = 1800
    elif t < 12.5: bal = lerp(1800, 1600, ease((t - 11.8) / 0.7))
    else: bal = 1600
    amp = 4 * math.sin(math.pi * (t - 10.1) / 0.8) if 10.1 <= t < 10.9 else (4 * math.sin(math.pi * (t - 11.8) / 0.7) if 11.8 <= t < 12.5 else 0)
    st3 = dict(view=view, bal=bal, band_prog=band_prog, notch_prog=notch_prog, band_hl=band_hl, row_hl=row_hl,
               list_alpha=list_alpha, row_dx=row_dx, row_h=row_h, amp=amp)
    st4 = dict(view='ALL', bal=450, band_prog={'UPI aaya': 1.0, 'Cashback': 1.0}, notch_prog={'Recharge': 1.0})

    # ----- phases -----
    if t < 1.6:   # home
        A(img, home_layer(t)); d = ImageDraw.Draw(img)
        d.text((W / 2, 46), 'Total ₹9,150 · 8 boxes', font=F(24, True), fill=DARK, anchor='mm')
        buttons(d)
    elif t < 2.3:  # open transition box 3 -> detail
        p = ease((t - 1.6) / 0.7)
        A(img, home_layer(t, alpha=1 - p, skip=3))
        d = ImageDraw.Draw(img)
        # header crossfade
        hl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); hd = ImageDraw.Draw(hl)
        hd.text((W / 2, 46), 'Total ₹9,150 · 8 boxes', font=F(24, True), fill=DARK + (int(255 * max(0, 1 - 2 * p)),), anchor='mm'); A(img, hl)
        chrome(img, d, 'Box 3 · Cash ₹1,600', 2, 'IN', alpha=max(0, 2 * p - 1))
        content = detail_content(BY[3], st3, t)
        # hide cube region from content (we draw morphing cube separately): fade content in
        content.putalpha(content.getchannel('A').point(lambda v: int(v * p)))
        # shift content up as it fades in
        img.alpha_composite(content, (0, int(40 * (1 - p))))
        # morphing cube
        sx, sy = SLOT[3]; cx, cy = lerp(sx, CX0 + CS / 2, p), lerp(sy, CY0 + CS / 2, p); size = lerp(S, CS, p)
        small = small_cube_tile(BY[3], 0.8, 1600, t * 2.4 + 3).resize((int(size), int(size)), Image.LANCZOS)
        small.putalpha(small.getchannel('A').point(lambda v: int(v * (1 - p))))
        big = big_cube(BY[3], 1600, t, 'IN', {}, {}).resize((int(size), int(size)), Image.LANCZOS)
        big.putalpha(big.getchannel('A').point(lambda v: int(v * p)))
        paste_center(img, SH_BIG.resize((int(SH_BIG.width * size / CS), int(SH_BIG.height * size / CS))), cx, cy + 4)
        paste_center(img, big, cx, cy); paste_center(img, small, cx, cy)
        d = ImageDraw.Draw(img); buttons(d)
    elif t < 12.9:  # detail Cash
        d = ImageDraw.Draw(img)
        chrome(img, d, f"Box 3 · Cash {inr(bal)}", 2, view, toggle_flash=('OUT' if 5.9 <= t < 6.2 else ('ALL' if 7.9 <= t < 8.2 else None)))
        A(img, detail_content(BY[3], st3, t))
        d = ImageDraw.Draw(img); buttons(d)
        # undo toast
        if 10.1 <= t < 11.9:
            a = ease((t - 10.1) / 0.25) * (1 - ease((t - 11.7) / 0.2))
            lay = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
            ld.rounded_rectangle([60, 768, 480, 810], 21, fill=(30, 36, 46, int(240 * a)))
            ld.text((84, 789), 'Delete ho gaya', font=F(16), fill=(255, 255, 255, int(255 * a)), anchor='lm')
            ld.text((392, 789), 'UNDO', font=F(17, True), fill=(120, 230, 150, int(255 * a)), anchor='mm')
            secs = max(0, 5 - (t - 10.1)); frac = secs / 5
            ld.arc([436, 775, 464, 803], -90, -90 + 360 * frac, fill=(120, 230, 150, int(255 * a)), width=3)
            ld.text((450, 789), f"{int(math.ceil(secs))}", font=F(12, True), fill=(255, 255, 255, int(255 * a)), anchor='mm')
            A(img, lay)
    elif t < 15.6:  # swipe to PhonePe + hold
        p = ease((t - 12.9) / 0.6) if t < 13.5 else 1.0
        d = ImageDraw.Draw(img)
        # title crossfade
        chrome(img, d, 'Box 4 · PhonePe ₹450' if p > 0.5 else 'Box 3 · Cash ₹1,600', 3 if p > 0.5 else 2, 'ALL')
        if p < 1:
            c3 = detail_content(BY[3], st3, t); img.alpha_composite(c3, (int(-W * p), 0))
        c4 = detail_content(BY[4], st4, t); img.alpha_composite(c4, (int(W * (1 - p)), 0))
        d = ImageDraw.Draw(img); buttons(d)
    else:  # close transition to home (box 4 ring)
        p = ease((t - 15.6) / 0.6)
        d = ImageDraw.Draw(img)
        chrome(img, d, 'Box 4 · PhonePe ₹450', 3, 'ALL', alpha=1 - p)
        content = detail_content(BY[4], st4, t)
        content.putalpha(content.getchannel('A').point(lambda v: int(v * (1 - p))))
        img.alpha_composite(content, (0, int(40 * p)))
        A(img, home_layer(t, alpha=p, skip=4 if p < 1 else None, ring=4, ring_a=max(0, 1 - (t - 16.2) / 0.8) if t > 16.2 else 0))
        sx, sy = SLOT[4]; cx, cy = lerp(CX0 + CS / 2, sx, p), lerp(CY0 + CS / 2, sy, p); size = lerp(CS, S, p)
        big = big_cube(BY[4], 450, t, 'ALL', st4['band_prog'], st4['notch_prog']).resize((int(size), int(size)), Image.LANCZOS)
        big.putalpha(big.getchannel('A').point(lambda v: int(v * (1 - p))))
        small = small_cube_tile(BY[4], 0.22, 450, t * 2.4 + 4).resize((int(size), int(size)), Image.LANCZOS)
        small.putalpha(small.getchannel('A').point(lambda v: int(v * p)))
        paste_center(img, big, cx, cy); paste_center(img, small, cx, cy)
        hl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); hd = ImageDraw.Draw(hl)
        hd.text((W / 2, 46), 'Total ₹9,150 · 8 boxes', font=F(24, True), fill=DARK + (int(255 * p),), anchor='mm'); A(img, hl)
        d = ImageDraw.Draw(img); buttons(d)

    fs = finger_state(t)
    if fs: draw_finger(img, *fs)
    caption(img, caption_for(t))
    img.convert('RGB').save(f'{FR}/{fi:04d}.png', compress_level=1)
    if fi % 75 == 0: print('frame', fi, '/', N, flush=True)

ff = imageio_ffmpeg.get_ffmpeg_exe()
mp4 = f'{OUT}/icecube_detail_flow_demo.mp4'; gif = f'{OUT}/icecube_detail_flow_demo.gif'
subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{FR}/%04d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4], check=True)
subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{FR}/%04d.png', '-vf', 'fps=15,scale=360:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3', gif], check=True)
print('done', mp4, os.path.getsize(mp4) // 1024, 'KB;', gif, os.path.getsize(gif) // 1024, 'KB')
