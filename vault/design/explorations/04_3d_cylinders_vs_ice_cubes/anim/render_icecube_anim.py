# Ice-Cube Boxes — animated demo renderer (PIL + numpy -> MP4/GIF via ffmpeg)
# Sequence: idle -> FLICK (physics bump) -> DRAG -> ALIGN (spring snap) -> FIND #6 (glow) -> +AAYA (pour)
import math, os, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import imageio_ffmpeg

W, H, FPS = 540, 1080, 30
DUR = 16.5
OUT = '/home/user/cube_3d_views/anim'
FR = '/tmp/frames'
os.makedirs(FR, exist_ok=True)
for f in os.listdir(FR):
    os.remove(os.path.join(FR, f))

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
_fc = {}
def F(sz, b=False):
    k = (sz, b)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(FONTB if b else FONT, sz)
    return _fc[k]

ACC = [
    dict(n=1, name='SBI',     amt=200,  pct=0.10, col=(52, 120, 246)),
    dict(n=2, name='HDFC',    amt=2000, pct=1.00, col=(32, 178, 150)),
    dict(n=3, name='Cash',    amt=1600, pct=0.80, col=(255, 140, 40)),
    dict(n=4, name='PhonePe', amt=450,  pct=0.22, col=(120, 70, 200)),
    dict(n=5, name='Paytm',   amt=900,  pct=0.45, col=(60, 170, 240)),
    dict(n=6, name='ICICI',   amt=1200, pct=0.60, col=(70, 80, 190)),
    dict(n=7, name='Gold',    amt=2500, pct=1.00, col=(220, 170, 40)),
    dict(n=8, name='Udhaar',  amt=300,  pct=0.15, col=(130, 140, 150)),
]
S, R, HS, RAD = 150, 28, 75, 73          # cube size, corner radius, half size, collision radius
TX0, TY0, TX1, TY1 = 40, 110, 500, 820   # tray
COLS = [TX0 + (TX1 - TX0) * 0.28, TX0 + (TX1 - TX0) * 0.72]
ROWS = [TY0 + (TY1 - TY0) * f for f in (0.14, 0.38, 0.62, 0.86)]
SLOT = {a['n']: (COLS[(a['n'] - 1) % 2], ROWS[(a['n'] - 1) // 2]) for a in ACC}

def ease(t):  # smoothstep
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)
def ease_out(t):
    t = max(0.0, min(1.0, t)); return 1 - (1 - t) ** 3
def lerp(a, b, t): return a + (b - a) * t
def inr(n): return '₹' + f"{int(round(n)):,}"

# ---------- pre-rendered tiles ----------
def shadow_tile(lifted):
    pad = 70
    im = Image.new('RGBA', (S + 2 * pad, S + 2 * pad), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    off = 18 if lifted else 8
    d.rounded_rectangle([pad, pad + off, pad + S, pad + S + off], R, fill=(20, 40, 80, 95 if lifted else 70))
    return im.filter(ImageFilter.GaussianBlur(26 if lifted else 12))
SH_N, SH_L = shadow_tile(False), shadow_tile(True)
def glow_tile():
    pad = 60
    im = Image.new('RGBA', (S + 2 * pad, S + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([pad - 10, pad - 10, pad + S + 10, pad + S + 10], R + 8, fill=(70, 220, 255, 230))
    return im.filter(ImageFilter.GaussianBlur(22))
GLOW = glow_tile()
MASK = Image.new('L', (S, S), 0)
ImageDraw.Draw(MASK).rounded_rectangle([0, 0, S - 1, S - 1], R, fill=255)

def cube_tile(a, pct, amt, phase, slope, amp):
    col = a['col']
    base = tuple(int(255 * 0.87 + c * 0.13) for c in col)
    tile = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle([0, 0, S - 1, S - 1], R, fill=base + (255,))
    # liquid with wavy / tilted surface
    liq = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ld = ImageDraw.Draw(liq)
    level = S - 4 - pct * (S - 8)
    pts = []
    for x in range(0, S + 1, 5):
        y = level + slope * (x - S / 2) + amp * math.sin(2 * math.pi * x / 95 + phase)
        pts.append((x, y))
    ld.polygon(pts + [(S, S + 5), (0, S + 5)], fill=col + (210,))
    ld.line(pts, fill=(255, 255, 255, 170), width=3)
    tile = Image.alpha_composite(tile, liq)
    # gloss
    gl = Image.new('RGBA', (S, S), (0, 0, 0, 0)); gd = ImageDraw.Draw(gl)
    gd.rounded_rectangle([12, 9, int(S * 0.6), 30], 12, fill=(255, 255, 255, 95))
    gd.rounded_rectangle([S - 22, 24, S - 13, S - 44], 5, fill=(255, 255, 255, 70))
    tile = Image.alpha_composite(tile, gl)
    tile.putalpha(ImageChops.multiply(tile.getchannel('A'), MASK))
    d = ImageDraw.Draw(tile)
    d.rounded_rectangle([0, 0, S - 1, S - 1], R, outline=tuple(int(c * 0.72) for c in col) + (170,), width=2)
    d.rounded_rectangle([2, 2, S - 3, S - 3], R - 2, outline=(255, 255, 255, 140), width=1)
    # label pill + texts
    d.rounded_rectangle([S / 2 - 62, S / 2 - 26, S / 2 + 62, S / 2 + 36], 14, fill=(255, 255, 255, 175))
    d.ellipse([8, 8, 36, 36], fill=(255, 255, 255, 240), outline=(80, 80, 80, 220), width=1)
    d.text((22, 22), str(a['n']), font=F(15, True), fill=(25, 25, 25, 255), anchor='mm')
    d.text((S - 12, 22), f"{int(round(pct * 100))}%", font=F(15, True), fill=(50, 50, 50, 255), anchor='rm')
    d.text((S / 2, S / 2 - 8), a['name'], font=F(19, True), fill=(20, 20, 20, 255), anchor='mm')
    d.text((S / 2, S / 2 + 18), inr(amt), font=F(19, True), fill=(20, 20, 20, 255), anchor='mm')
    return tile

# ---------- physics state ----------
class Cube:
    def __init__(self, a):
        self.a = a; self.x, self.y = SLOT[a['n']]; self.vx = self.vy = 0.0
        self.ang = 0.0; self.angv = 0.0; self.pct = a['pct']; self.amt = a['amt']
        self.lifted = False; self.kinematic = False
cubes = {a['n']: Cube(a) for a in ACC}
bumps = []   # (x, y, t0, strength)

def step_physics(t, collide=True):
    for c in cubes.values():
        if c.kinematic: continue
        c.x += c.vx; c.y += c.vy; c.ang += c.angv
        c.vx *= 0.965; c.vy *= 0.965; c.angv *= 0.95
        if abs(c.vx) < 0.03: c.vx = 0
        if abs(c.vy) < 0.03: c.vy = 0
        # tray walls
        if c.x - HS < TX0 + 6:
            c.x = TX0 + 6 + HS
            if c.vx < -1.5: bumps.append((c.x - HS, c.y, t, abs(c.vx)))
            c.vx = -c.vx * 0.55; c.angv += -c.vy * 0.02
        if c.x + HS > TX1 - 6:
            c.x = TX1 - 6 - HS
            if c.vx > 1.5: bumps.append((c.x + HS, c.y, t, abs(c.vx)))
            c.vx = -c.vx * 0.55; c.angv += c.vy * 0.02
        if c.y - HS < TY0 + 6:
            c.y = TY0 + 6 + HS
            if c.vy < -1.5: bumps.append((c.x, c.y - HS, t, abs(c.vy)))
            c.vy = -c.vy * 0.55; c.angv += c.vx * 0.02
        if c.y + HS > TY1 - 6:
            c.y = TY1 - 6 - HS
            if c.vy > 1.5: bumps.append((c.x, c.y + HS, t, abs(c.vy)))
            c.vy = -c.vy * 0.55; c.angv += -c.vx * 0.02
    if not collide: return
    cl = list(cubes.values())
    for _ in range(2):
        for i in range(len(cl)):
            for j in range(i + 1, len(cl)):
                a, b = cl[i], cl[j]
                dx, dy = b.x - a.x, b.y - a.y
                dist = math.hypot(dx, dy)
                if dist == 0 or dist >= 2 * RAD: continue
                nx, ny = dx / dist, dy / dist
                ov = 2 * RAD - dist
                if a.kinematic: b.x += nx * ov; b.y += ny * ov
                elif b.kinematic: a.x -= nx * ov; a.y -= ny * ov
                else:
                    a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2
                rvn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
                if rvn < 0:
                    e = 0.5
                    if a.kinematic:
                        jn = -(1 + e) * rvn; b.vx += jn * nx; b.vy += jn * ny
                    elif b.kinematic:
                        jn = -(1 + e) * rvn; a.vx -= jn * nx; a.vy -= jn * ny
                    else:
                        jn = -(1 + e) * rvn / 2
                        a.vx -= jn * nx; a.vy -= jn * ny; b.vx += jn * nx; b.vy += jn * ny
                    tang = (b.vx - a.vx) * (-ny) + (b.vy - a.vy) * nx
                    a.angv += tang * 0.03; b.angv -= tang * 0.03
                    if abs(rvn) > 1.0:
                        bumps.append((a.x + nx * RAD, a.y + ny * RAD, t, abs(rvn)))

def spring_to_slots():
    k, cdmp = 0.08, 0.42
    for c in cubes.values():
        tx, ty = SLOT[c.a['n']]
        c.vx += k * (tx - c.x) - cdmp * c.vx; c.vy += k * (ty - c.y) - cdmp * c.vy
        c.x += c.vx; c.y += c.vy
        c.angv += k * (0 - c.ang) - cdmp * c.angv; c.ang += c.angv

# ---------- UI drawing helpers ----------
def draw_static(d, total, caption):
    d.rectangle([0, 0, W, H], fill=(243, 246, 250))
    d.text((W / 2, 46), f"Total {inr(total)} · 8 boxes", font=F(26, True), fill=(20, 24, 30), anchor='mm')
    d.text((W / 2, 86), caption, font=F(16), fill=(90, 100, 115), anchor='mm')
    # tray
    d.rounded_rectangle([TX0 - 4, TY0 - 4, TX1 + 4, TY1 + 4], 30, fill=(214, 220, 228))
    d.rounded_rectangle([TX0, TY0, TX1, TY1], 26, fill=(230, 234, 240))
    d.rounded_rectangle([TX0 + 3, TY0 + 3, TX1 - 3, TY0 + 14], 12, fill=(220, 225, 232))

def chip(d, x0, x1, y0, y1, label, icon, active):
    d.rounded_rectangle([x0, y0, x1, y1], 22, fill=(225, 232, 244) if active else (255, 255, 255),
                        outline=(70, 110, 190) if active else (200, 206, 216), width=2)
    cx = x0 + 26; cy = (y0 + y1) / 2
    if icon == 'grid':
        for i in range(2):
            for j in range(2):
                d.rounded_rectangle([cx - 9 + j * 10, cy - 9 + i * 10, cx - 1 + j * 10, cy - 1 + i * 10], 2, fill=(40, 60, 100))
    else:
        d.text((cx, cy), '#', font=F(20, True), fill=(40, 60, 100), anchor='mm')
    d.text((cx + 22, cy), label, font=F(18), fill=(30, 36, 46), anchor='lm')

def button(d, x0, x1, y0, y1, label, col, flash):
    c = tuple(min(255, int(v * (1.25 if flash else 1))) for v in col)
    d.rounded_rectangle([x0, y0, x1, y1], 34, fill=c)
    d.text(((x0 + x1) / 2, (y0 + y1) / 2), label, font=F(24, True), fill='white', anchor='mm')

def draw_finger(img, x, y, pressed, alpha):
    if alpha <= 0: return
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    r = 20 if pressed else 27
    d.ellipse([x - r - 6, y - r - 6, x + r + 6, y + r + 6], fill=(255, 255, 255, int(70 * alpha)))
    d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, int(120 * alpha)), outline=(40, 44, 52, int(220 * alpha)), width=3)
    d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=(40, 44, 52, int(230 * alpha)))
    img.alpha_composite(lay)

def draw_bumps(img, t):
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for (x, y, t0, s) in bumps:
        age = (t - t0) / 0.35
        if age < 0 or age > 1: continue
        rr = 8 + 42 * age * min(1.5, 0.5 + s / 10)
        d.ellipse([x - rr, y - rr, x + rr, y + rr], outline=(255, 110, 70, int(200 * (1 - age))), width=3)
    img.alpha_composite(lay)

def paste_center(img, tile, cx, cy):
    img.alpha_composite(tile, (int(cx - tile.width / 2), int(cy - tile.height / 2)))

def draw_cube(img, c, t, scale=1.0):
    speed = math.hypot(c.vx, c.vy)
    slope = max(-0.28, min(0.28, -c.vx * 0.03))
    amp = 2.2 + min(6, speed * 0.6) + c.a.get('extra_amp', 0)
    tile = cube_tile(c.a, c.pct, c.amt, t * 2.4 + c.a['n'], slope, amp)
    if scale != 1.0:
        n = int(S * scale); tile = tile.resize((n, n), Image.LANCZOS)
    if abs(c.ang) > 0.05:
        tile = tile.rotate(-c.ang, resample=Image.BICUBIC, expand=True)
    paste_center(img, tile, c.x, c.y)

# ---------- keypad sheet ----------
SHEET_H = 420
def draw_sheet(img, yoff, typed, key_flash):
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    y0 = H - SHEET_H + yoff
    d.rounded_rectangle([0, y0, W, H + 40], 34, fill=(255, 255, 255, 250), outline=(215, 220, 228), width=1)
    d.rounded_rectangle([W / 2 - 24, y0 + 10, W / 2 + 24, y0 + 15], 3, fill=(200, 205, 212))
    d.rounded_rectangle([28, y0 + 26, W - 28, y0 + 76], 16, fill=(246, 248, 251), outline=(205, 212, 222), width=2)
    if typed:
        d.text((44, y0 + 51), typed, font=F(28, True), fill=(20, 140, 170), anchor='lm')
        cx = 44 + F(28, True).getlength(typed) + 3
        d.line([cx, y0 + 38, cx, y0 + 64], fill=(20, 140, 170), width=2)
    else:
        d.text((44, y0 + 51), 'Box number bolo ya type karo', font=F(16), fill=(150, 158, 170), anchor='lm')
        d.line([40, y0 + 38, 40, y0 + 64], fill=(20, 140, 170), width=2)
    mx, my = W - 60, y0 + 51
    d.rounded_rectangle([mx - 6, my - 14, mx + 6, my + 4], 6, fill=(20, 140, 170))
    d.arc([mx - 12, my - 10, mx + 12, my + 10], 0, 180, fill=(20, 140, 170), width=2)
    d.line([mx, my + 10, mx, my + 16], fill=(20, 140, 170), width=2)
    names = [a['name'] for a in ACC]
    for i in range(8):
        r_, c_ = divmod(i, 4)
        x0 = 28 + c_ * 122; y1 = y0 + 92 + r_ * 38
        sel = (typed == str(i + 1))
        d.rounded_rectangle([x0, y1, x0 + 112, y1 + 32], 16, fill=(25, 40, 70) if sel else (238, 241, 246))
        d.text((x0 + 56, y1 + 16), f"{i + 1} {names[i]}", font=F(14, True), fill='white' if sel else (40, 46, 56), anchor='mm')
    keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']
    for i, k in enumerate(keys):
        if k == '': continue
        r_, c_ = divmod(i, 3)
        x0 = 28 + c_ * 166; y1 = y0 + 176 + r_ * 58
        fl = (k == key_flash)
        d.rounded_rectangle([x0, y1, x0 + 152, y1 + 50], 25, fill=(200, 235, 245) if fl else (255, 255, 255),
                            outline=(20, 140, 170) if fl else (215, 220, 228), width=2)
        d.text((x0 + 76, y1 + 25), k, font=F(24, True), fill=(30, 34, 42), anchor='mm')
    img.alpha_composite(lay)

# ---------- timeline ----------
def caption_for(t):
    if t < 1.5: return "8 boxes · liquid level = balance %"
    if t < 4.5: return "1/5  FLICK — haath se maro · physics + haptic bump"
    if t < 7.0: return "2/5  DRAG — press karke kheencho, baaki hat jaate hain"
    if t < 8.9: return "3/5  ALIGN — ek tap, sab line me (spring snap)"
    if t < 12.6: return "4/5  FIND BOX — number type/bolo → box glow"
    return "5/5  + AAYA ₹300 → Box 3 bharta hai"

def finger_state(t):
    """returns (x, y, pressed, alpha) or None"""
    c5, c2 = cubes[5], cubes[2]
    # P1 flick
    if 1.2 <= t < 2.1:
        if t < 1.5:
            a = ease((t - 1.2) / 0.3); return (c5.x - 40 * (1 - a) - 10, c5.y + 40 * (1 - a) + 10, False, a)
        if t < 1.75:
            return (c5.x, c5.y, True, 1.0)
        a = 1 - ease((t - 1.75) / 0.35); return (c5.x + 30, c5.y - 40, False, a)
    # P2 drag
    if 4.3 <= t < 6.6:
        if t < 4.6:
            a = ease((t - 4.3) / 0.3); return (c2.x + 30 * (1 - a), c2.y + 40 * (1 - a), False, a)
        if t < 6.2:
            return (c2.x, c2.y, True, 1.0)
        a = 1 - ease((t - 6.2) / 0.4); return (c2.x + 20, c2.y + 30, False, a)
    # P3 align tap
    if 6.9 <= t < 7.6:
        x, y = 150, 872
        if t < 7.1: a = ease((t - 6.9) / 0.2); return (x, y + 30 * (1 - a), False, a)
        if t < 7.3: return (x, y, True, 1.0)
        a = 1 - ease((t - 7.3) / 0.3); return (x, y, False, a)
    # P4 find tap + key 6
    if 8.9 <= t < 10.6:
        if t < 9.1: a = ease((t - 8.9) / 0.2); return (360, 872 + 30 * (1 - a), False, a)
        if t < 9.3: return (360, 872, True, 1.0)
        if t < 10.0:
            a = ease((t - 9.3) / 0.7); return (lerp(360, 28 + 2 * 166 + 76, a), lerp(872, H - SHEET_H + 176 + 58 + 25, a), False, 1.0)
        if t < 10.35: return (28 + 2 * 166 + 76, H - SHEET_H + 176 + 58 + 25, True, 1.0)
        a = 1 - ease((t - 10.35) / 0.25); return (28 + 2 * 166 + 76, H - SHEET_H + 176 + 58 + 25, False, a)
    # P5 aaya tap
    if 12.6 <= t < 13.3:
        x, y = 150, 962
        if t < 12.8: a = ease((t - 12.6) / 0.2); return (x, y + 30 * (1 - a), False, a)
        if t < 13.0: return (x, y, True, 1.0)
        a = 1 - ease((t - 13.0) / 0.3); return (x, y, False, a)
    return None

def bezier(p0, p1, p2, p3, u):
    v = 1 - u
    return (v ** 3 * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u ** 3 * p3[0],
            v ** 3 * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u ** 3 * p3[1])

drag_start = None
N = int(DUR * FPS)
for fi in range(N):
    t = fi / FPS
    c5, c2, c3, c6 = cubes[5], cubes[2], cubes[3], cubes[6]

    # ----- control -----
    if 1.5 <= t < 1.75:                     # finger pushes cube 5 (kinematic)
        c5.kinematic = True
        u = (t - 1.5) / 0.25
        nx, ny = SLOT[5][0] + 60 * u, SLOT[5][1] - 70 * u
        c5.vx, c5.vy = (nx - c5.x) * 1.6, (ny - c5.y) * 1.6
        c5.x, c5.y = nx, ny
    elif c5.kinematic and t >= 1.75:
        c5.kinematic = False; c5.angv = -6.0

    if 4.6 <= t < 6.2:                      # drag cube 2
        if drag_start is None: drag_start = (c2.x, c2.y)
        c2.kinematic = True; c2.lifted = True
        u = ease((t - 4.7) / 1.4)
        p0 = drag_start; p3 = (245, 640)
        p1 = (p0[0] - 160, p0[1] + 120); p2 = (p3[0] + 120, p3[1] - 200)
        nx, ny = bezier(p0, p1, p2, p3, u)
        c2.vx, c2.vy = (nx - c2.x) * 0.7, (ny - c2.y) * 0.7
        c2.x, c2.y = nx, ny
        c2.ang = max(-8, min(8, -c2.vx * 0.9))
    elif c2.kinematic and t >= 6.2:
        c2.kinematic = False; c2.lifted = False

    align_phase = 7.2 <= t < 9.0
    if align_phase:
        spring_to_slots()
    else:
        step_physics(t, collide=True)

    # +Aaya pour on cube 3
    pour = 0.0
    if 13.3 <= t < 14.6:
        pour = ease((t - 13.3) / 1.3)
    elif t >= 14.6:
        pour = 1.0
    c3.pct = 0.80 + 0.15 * pour; c3.amt = 1600 + 300 * pour
    c3.a['extra_amp'] = 5 * math.sin(math.pi * min(1, max(0, (t - 13.3) / 1.3))) if 13.3 <= t < 14.6 else 0
    total = 9150 + 300 * pour

    # ----- render -----
    img = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(img)
    draw_static(d, total, caption_for(t))

    find_dim = 0.0
    if 10.2 <= t < 11.8: find_dim = ease((t - 10.2) / 0.3)
    elif 11.8 <= t < 12.2: find_dim = 1 - ease((t - 11.8) / 0.4)
    glow = 0.0
    if 10.2 <= t < 12.8:
        glow = min(1, (t - 10.2) / 0.3) * (1 - max(0, (t - 12.0) / 0.8))

    order = sorted(cubes.values(), key=lambda c: (c.lifted, c.a['n'] == 6 and glow > 0))
    for c in order:
        if c.lifted or (c.a['n'] == 6 and glow > 0): continue
        paste_center(img, SH_N, c.x, c.y + 6)
    for c in order:
        if c.lifted or (c.a['n'] == 6 and glow > 0): continue
        draw_cube(img, c, t)
    if find_dim > 0:
        lay = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(lay).rounded_rectangle([TX0, TY0, TX1, TY1], 26, fill=(20, 30, 50, int(150 * find_dim)))
        img.alpha_composite(lay)
    if glow > 0:
        g = GLOW.copy(); g.putalpha(g.getchannel('A').point(lambda v: int(v * (0.55 + 0.45 * math.sin(t * 6)) * glow)))
        paste_center(img, g, c6.x, c6.y)
        paste_center(img, SH_L, c6.x, c6.y + 6)
        draw_cube(img, c6, t, scale=1.0 + 0.06 * glow)
        if find_dim > 0.5:
            lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
            bx, by = c6.x, c6.y - 118
            ld.rounded_rectangle([bx - 105, by - 24, bx + 105, by + 24], 14, fill=(255, 255, 255, int(240 * find_dim)))
            ld.polygon([(bx - 10, by + 24), (bx + 10, by + 24), (bx, by + 36)], fill=(255, 255, 255, int(240 * find_dim)))
            ld.text((bx, by), '6 · ICICI  ₹1,200 · 60%', font=F(17, True), fill=(20, 24, 30, int(255 * find_dim)), anchor='mm')
            img.alpha_composite(lay)
    for c in order:
        if c.lifted:
            paste_center(img, SH_L, c.x, c.y + 10)
            draw_cube(img, c, t, scale=1.08)

    # pour stream for +Aaya
    if 13.3 <= t < 14.6:
        lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
        col = c3.a['col']
        top = c3.y - HS - 40
        surf = c3.y - HS + 4 + (1 - c3.pct) * (S - 8)
        a = int(230 * math.sin(math.pi * min(1, (t - 13.3) / 1.3)))
        ld.rounded_rectangle([c3.x - 5, top, c3.x + 5, surf + 4], 5, fill=col + (a,))
        for k in range(3):
            rr = 8 + 10 * k + 6 * math.sin(t * 9 + k)
            ld.ellipse([c3.x - rr, surf - rr / 3, c3.x + rr, surf + rr / 3], outline=(255, 255, 255, int(a * 0.6)), width=2)
        img.alpha_composite(lay)

    draw_bumps(img, t)

    # toolbar + buttons
    d = ImageDraw.Draw(img)
    chip(d, 66, 236, 850, 894, 'Align', 'grid', 7.1 <= t < 7.45)
    chip(d, 276, 476, 850, 894, 'Find box', 'hash', 9.1 <= t < 9.45)
    button(d, 40, 260, 928, 998, '+  Aaya', (46, 160, 90), 12.8 <= t < 13.1)
    button(d, 280, 500, 928, 998, '−  Kharch', (225, 70, 70), False)

    # toast
    if 13.0 <= t < 15.8:
        a = ease((t - 13.0) / 0.25) * (1 - ease((t - 15.4) / 0.4))
        lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
        ld.rounded_rectangle([W / 2 - 150, 118, W / 2 + 150, 158], 20, fill=(30, 36, 46, int(235 * a)))
        ld.text((W / 2, 138), 'Box 3 · Cash   +₹300', font=F(17, True), fill=(120, 230, 150, int(255 * a)), anchor='mm')
        img.alpha_composite(lay)

    # keypad sheet
    if 9.15 <= t < 12.1:
        if t < 9.5: yoff = SHEET_H * (1 - ease_out((t - 9.15) / 0.35))
        elif t < 11.8: yoff = 0
        else: yoff = SHEET_H * ease((t - 11.8) / 0.3)
        typed = '6' if t >= 10.15 else ''
        draw_sheet(img, yoff, typed, '6' if 10.1 <= t < 10.35 else None)

    fs = finger_state(t)
    if fs: draw_finger(img, *fs)

    img.convert('RGB').save(f'{FR}/{fi:04d}.png', compress_level=1)
    if fi % 60 == 0: print('frame', fi, '/', N, flush=True)

ff = imageio_ffmpeg.get_ffmpeg_exe()
mp4 = f'{OUT}/icecube_boxes_demo.mp4'
gif = f'{OUT}/icecube_boxes_demo.gif'
subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{FR}/%04d.png',
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4], check=True)
subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{FR}/%04d.png',
                '-vf', 'fps=15,scale=360:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
                gif], check=True)
print('done', mp4, os.path.getsize(mp4) // 1024, 'KB;', gif, os.path.getsize(gif) // 1024, 'KB')
