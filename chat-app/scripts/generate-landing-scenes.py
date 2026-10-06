"""Procedural engraved-style misty landscapes for the Nullchat landing page."""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter

SS = 1.5  # supersample factor


def noise2(rng, h, w, layers):
    """Sum of upscaled random grids. layers: [(cell_y, cell_x, amp)]"""
    out = np.zeros((h, w), np.float32)
    for cy, cx, amp in layers:
        gh, gw = max(2, int(h / cy) + 2), max(2, int(w / cx) + 2)
        g = rng.random((gh, gw)).astype(np.float32)
        out += amp * np.asarray(Image.fromarray(g, "F").resize((w, h), Image.BICUBIC))
    return out


def ridge(rng, w, base, octaves):
    """1D fbm ridgeline. octaves: [(period_px, amp_px)]"""
    x = np.arange(w)
    y = np.full(w, float(base))
    for period, amp in octaves:
        n = int(w / period) + 3
        pts = rng.uniform(-1, 1, n)
        y += amp * np.interp(x / period, np.arange(n), pts)
    return gaussian_filter(y, 2)


def below(h, yline, soft=1.0):
    Y = np.arange(h, dtype=np.float32)[:, None]
    return np.clip((Y - yline[None, :]) / soft + 0.5, 0, 1)


def comp(img, mask, color):
    img *= 1 - mask
    img += mask * color


def fog_band(img, y0, y1, strength, fogc=0.955, rng=None, streak=True):
    h, w = img.shape
    Y = np.arange(h, dtype=np.float32)[:, None]
    f = np.clip((Y - y0) / max(1, (y1 - y0)), 0, 1)
    f = np.sin(f * np.pi) * strength
    if streak and rng is not None:
        n = noise2(rng, h, w, [(40 * SS, 500 * SS, 0.6), (14 * SS, 180 * SS, 0.4)])
        f = np.clip(f * (0.55 + 0.9 * n), 0, 1)
    img *= 1 - f
    img += f * fogc


def strokes(shape, mask, rng, n, size, light=True):
    """Short curved grass/leaf strokes inside mask. Returns ink layer 0..1."""
    h, w = shape
    layer = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(layer)
    ys, xs = np.nonzero(mask > 0.6)
    if len(xs) == 0:
        return np.zeros(shape, np.float32)
    idx = rng.integers(0, len(xs), n)
    for i in idx:
        x, y = int(xs[i]), int(ys[i])
        r = rng.uniform(size * 0.5, size)
        a0 = rng.uniform(0, 360)
        span = rng.uniform(50, 150)
        d.arc([x - r, y - r * 0.7, x + r, y + r * 0.7], a0, a0 + span, fill=int(rng.uniform(150, 255)), width=max(1, int(1.6 * SS)))
    return np.asarray(layer, np.float32) / 255.0


def specks(shape, mask, rng, density, val=1.0):
    s = (rng.random(shape) < density).astype(np.float32) * mask
    return gaussian_filter(s, 0.5 * SS) * 3 * val


def leafy_blob(shape, rng, circles, fringe=0.45):
    h, w = shape
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    for cx, cy, r in circles:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    a = gaussian_filter(np.asarray(m, np.float32) / 255.0, 6 * SS)
    nz = noise2(rng, h, w, [(5 * SS, 5 * SS, 0.6), (14 * SS, 14 * SS, 0.4)])
    return np.clip((a + fringe * (nz - 0.5) - 0.5) * 10, 0, 1)


def mound_circles(rng, x0, x1, yline, height, n, rmin=0.10, rmax=0.20):
    """Clumps whose tops follow a mound profile and whose bottoms sit on yline."""
    out = []
    for _ in range(n):
        cx = rng.uniform(x0, x1)
        t = (cx - x0) / (x1 - x0)
        prof = height * (0.35 + 0.65 * np.sin(np.pi * t) ** 0.7)
        base = yline[int(np.clip(cx, 0, len(yline) - 1))]
        cy = base - rng.uniform(0.0, 0.85) ** 1.6 * prof
        out.append((cx, cy, rng.uniform(rmin, rmax) * height))
    return out


def ellipse_circles(rng, cx, cy, rx, ry, n, rmin, rmax):
    out = []
    for _ in range(n):
        a, d = rng.uniform(0, 2 * np.pi), np.sqrt(rng.uniform(0, 1))
        out.append((cx + np.cos(a) * d * rx, cy + np.sin(a) * d * ry, rng.uniform(rmin, rmax)))
    return out


def canopy_circles(rng, x0, x1, ybase, height, n):
    out = []
    for _ in range(n):
        cx = rng.uniform(x0, x1)
        t = (cx - x0) / (x1 - x0)
        top = height * (0.55 + 0.45 * np.sin(np.pi * min(1, t * 1.15)))
        cy = ybase - rng.uniform(0.1, 1.0) * top
        out.append((cx, cy, rng.uniform(0.035, 0.10) * height + 6))
    return out


def clump_light(shape, circles):
    """Each clump lit like a sphere from the upper left; lower clumps drawn in front."""
    h, w = shape
    buf = np.zeros(shape, np.float32)
    for cx, cy, r in sorted(circles, key=lambda c: c[1]):
        x0, x1 = int(max(0, cx - r)), int(min(w, cx + r + 1))
        y0, y1 = int(max(0, cy - r)), int(min(h, cy + r + 1))
        if x0 >= x1 or y0 >= y1:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        dx, dy = (xx - cx) / r, (yy - cy) / r
        inside = dx * dx + dy * dy <= 1
        v = np.clip(0.55 - 0.45 * (dx * 0.6 + dy * 0.8), 0, 1)
        sub = buf[y0:y1, x0:x1]
        sub[inside] = v[inside]
    return buf


def shade_foliage(img, m, rng, circles, tone=0.15):
    h, w = img.shape
    lit = gaussian_filter(clump_light(img.shape, circles), 1.5 * SS)
    nz = noise2(rng, h, w, [(4 * SS, 4 * SS, 1.0)])
    col = tone + 0.30 * lit ** 1.4 + 0.10 * (nz - 0.5)
    comp(img, m, col)
    leaves = strokes(img.shape, m, rng, int(m.sum() / (22 * SS * SS)), 4 * SS)
    img += 0.22 * leaves * m * (0.4 + lit)
    img -= 0.08 * strokes(img.shape, m, rng, int(m.sum() / (40 * SS * SS)), 3 * SS) * m
    img += 0.6 * specks(img.shape, m * lit, rng, 0.004)


def hill(img, rng, yline, tone, rim=0.55, density=1.0, fringe=0.35):
    h, w = img.shape
    m = below(h, yline, 1.2)
    Y = np.arange(h, dtype=np.float32)[:, None]
    depth = np.clip(Y - yline[None, :], 0, None)
    nz = noise2(rng, h, w, [(30 * SS, 60 * SS, 0.6), (8 * SS, 8 * SS, 0.4)])
    col = tone + rim * np.exp(-depth / (7 * SS)) + 0.22 * np.exp(-depth / (140 * SS)) - 0.08 * np.clip(depth / (500 * SS), 0, 1) + 0.10 * (nz - 0.5)
    comp(img, m, col)
    area = m.sum()
    # stroke size grows toward the viewer (lower on screen)
    near = np.clip(Y / h, 0, 1)
    for sz, k in [(7, 0.5), (12, 0.5)]:
        sel = m * (near > 0.75 if sz == 12 else near <= 0.75)
        light = strokes(img.shape, sel, rng, int(density * k * area / (34 * SS * SS)), sz * SS)
        dark = strokes(img.shape, sel, rng, int(density * k * area / (50 * SS * SS)), sz * SS)
        img += 0.30 * light * m * (0.30 + 0.70 * np.exp(-depth / (260 * SS)))
        img -= 0.16 * dark * m
    img += 0.9 * specks(img.shape, m, rng, 0.003)
    # fuzzy backlit grass fringe above the ridge
    fr = np.clip(1 - np.abs(Y - yline[None, :] + 3 * SS) / (5 * SS), 0, 1) * noise2(rng, h, w, [(3 * SS, 2 * SS, 1.0)])
    img += fringe * fr
    return m


def sky(rng, h, w, top=0.975, bottom=0.92):
    Y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    img = np.repeat(top + (bottom - top) * Y, w, axis=1)
    streaks = noise2(rng, h, w, [(26 * SS, 700 * SS, 0.6), (10 * SS, 260 * SS, 0.4)])
    img -= 0.05 * (streaks - 0.5) * np.clip(Y * 2.2, 0, 1)
    return img


def finish(img, rng, out, size):
    img += rng.normal(0, 0.022, img.shape).astype(np.float32)
    img = np.clip(img, 0, 1)
    im = Image.fromarray((img * 255).astype(np.uint8), "L").resize(size, Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    im.save(out, "WEBP", quality=80, method=6)
    print("saved", out, im.size)


# --------------------------------------------------------------- hero ----

def city(img, rng, x0, x1, base):
    h, w = img.shape
    ink = np.zeros_like(img)
    win = np.zeros_like(img)
    x = x0
    span = x1 - x0
    while x < x1:
        bw = rng.uniform(14, 34) * SS
        t = (x - x0) / span
        tall = 0.35 + 0.65 * np.exp(-((t - 0.55) ** 2) / 0.06)
        bh = rng.uniform(25, 150) * SS * tall + 12 * SS
        if rng.random() < 0.15:
            bh *= 1.5
        y = int(base - bh)
        xi, xe = int(x), int(x + bw)
        ink[y:int(base), xi:xe] = max(ink[y:int(base), xi:xe].max(initial=0), rng.uniform(0.75, 1.0))
        for wy in range(y + int(4 * SS), int(base), int(5 * SS)):
            for wx in range(xi + int(3 * SS), xe - int(2 * SS), int(4 * SS)):
                if rng.random() < 0.5:
                    win[wy:wy + int(SS) + 1, wx:wx + int(SS) + 1] = 1
        x += bw + rng.uniform(-6, 4) * SS
    # spire
    sx = x0 + span * 0.6
    poly = Image.new("L", (w, h), 0)
    ImageDraw.Draw(poly).polygon([(sx - 22 * SS, base), (sx, base - 270 * SS), (sx + 22 * SS, base)], fill=255)
    ink = np.maximum(ink, np.asarray(poly, np.float32) / 255)
    Y = np.arange(h, dtype=np.float32)[:, None]
    fade = np.clip((base - Y) / (70 * SS), 0, 1)  # bases dissolve into fog
    tone = 0.40 + 0.18 * (1 - fade) + 0.12 * win
    comp(img, ink * (0.25 + 0.75 * fade), tone)


def bridge(img, rng, xa, x1, x2, xb, deck, top):
    h, w = img.shape
    L = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(L)
    tw = 46 * SS  # tower width
    for tx in (x1, x2):
        leg = 11 * SS
        for side in (-1, 1):
            # legs taper toward the top and carry recessed ribs
            ox, ix = tx + side * tw / 2, tx + side * (tw / 2 - leg)
            d.polygon([(ox, deck + 140 * SS), (ix, deck + 140 * SS), (tx + side * (tw / 2 - leg - 2 * SS), top), (tx + side * (tw / 2 - 2 * SS), top)], fill=255)
            d.line([(tx + side * (tw / 2 - leg / 2), top + 10 * SS), (tx + side * (tw / 2 - leg / 2), deck + 140 * SS)], fill=150, width=int(1.5 * SS))
        levels = np.linspace(top + 4 * SS, deck - 14 * SS, 5)
        for k, yy in enumerate(levels):
            d.rectangle([tx - tw / 2, yy, tx + tw / 2, yy + (9 if k == 0 else 5) * SS], fill=255)
            if k < len(levels) - 1:
                # portal: arched opening between beams
                ny = levels[k + 1]
                d.rectangle([tx - tw / 2 + leg, yy + 5 * SS, tx + tw / 2 - leg, ny], fill=0)
                d.chord([tx - tw / 2 + leg, ny - 16 * SS, tx + tw / 2 - leg, ny + 6 * SS], 180, 360, fill=255)
        d.rectangle([tx - tw / 2 - 3 * SS, top - 8 * SS, tx + tw / 2 + 3 * SS, top + 2 * SS], fill=255)
        d.rectangle([tx - 6 * SS, top - 14 * SS, tx + 6 * SS, top - 8 * SS], fill=255)
    # cables: main span sag + side spans
    def cable(xs, ys, xe, ye, sag):
        pts = []
        for t in np.linspace(0, 1, 160):
            pts.append((xs + (xe - xs) * t, ys + (ye - ys) * t + sag * 4 * t * (1 - t)))
        return pts
    spans = [cable(xa, deck - 4 * SS, x1, top + 4 * SS, 30 * SS), cable(x1, top + 4 * SS, x2, top + 4 * SS, (deck - top) * 0.88), cable(x2, top + 4 * SS, xb, deck - 4 * SS, 30 * SS)]
    for pts in spans:
        d.line(pts, fill=255, width=int(3 * SS))
        for px, py in pts[4:-4:5]:
            if py < deck - 6 * SS:
                d.line([(px, py), (px, deck)], fill=150, width=max(1, int(SS * 0.8)))
    d.rectangle([xa - 40 * SS, deck, xb + 60 * SS, deck + 9 * SS], fill=255)
    d.line([(xa - 40 * SS, deck + 13 * SS), (xb + 60 * SS, deck + 13 * SS)], fill=200, width=int(2 * SS))
    ink = np.asarray(L, np.float32) / 255
    Y = np.arange(h, dtype=np.float32)[:, None]
    fade = np.clip((deck + 50 * SS - Y) / (90 * SS), 0, 1)
    grain = noise2(rng, h, w, [(2 * SS, 2 * SS, 1.0)])
    comp(img, ink * fade, 0.26 + 0.25 * (1 - fade) + 0.12 * (grain - 0.5))


def hero(out):
    rng = np.random.default_rng(7)
    W, H = int(2400 * SS), int(1000 * SS)
    img = sky(rng, H, W)
    # far ranges
    for base, tone, amp in [(0.47, 0.84, 34), (0.52, 0.80, 26)]:
        y = ridge(rng, W, base * H, [(420 * SS, amp * SS), (120 * SS, amp * 0.35 * SS), (30 * SS, 3 * SS)])
        m = below(H, y, 1.5)
        Y = np.arange(H, dtype=np.float32)[:, None]
        comp(img, m, tone + 0.13 * np.clip((Y - y[None, :]) / (55 * SS), 0, 1))
    fog_band(img, 0.50 * H, 0.66 * H, 0.75, rng=rng)
    city(img, rng, 0.24 * W, 0.50 * W, 0.585 * H)
    bridge(img, rng, 0.60 * W, 0.66 * W, 0.86 * W, 0.94 * W, 0.575 * H, 0.38 * H)
    fog_band(img, 0.54 * H, 0.80 * H, 0.95, rng=rng)
    fog_band(img, 0.57 * H, 0.70 * H, 0.55, rng=rng)

    x = np.arange(W, dtype=np.float32)
    # right hill rising to the right edge
    yr = 0.98 * H - (x - 0.42 * W).clip(0) / (0.58 * W) * 0.50 * H
    yr = yr + ridge(rng, W, 0, [(200 * SS, 10 * SS), (40 * SS, 2 * SS)])
    yr[x < 0.42 * W] = H + 50
    hill(img, rng, yr, 0.36)
    # left bush canopy sitting on the left hill
    yl = 0.60 * H + (x / (0.75 * W)) ** 1.25 * 0.42 * H + ridge(rng, W, 0, [(180 * SS, 8 * SS), (40 * SS, 2 * SS)])
    circ = mound_circles(rng, -0.05 * W, 0.34 * W, yl + 30 * SS, 0.25 * H, 260) + mound_circles(rng, 0.30 * W, 0.47 * W, yl + 20 * SS, 0.12 * H, 70)
    bush = leafy_blob(img.shape, rng, circ, 0.3)
    core = below(H, yl - 0.10 * H, 4 * SS) * (x[None, :] < 0.30 * W)
    bush = np.maximum(bush, core)
    shade_foliage(img, bush, rng, circ)
    fog_band(img, 0.72 * H, 0.86 * H, 0.35, rng=rng)
    hill(img, rng, yl, 0.33)
    # low foreground swell
    finish(img, rng, out, (2400, 1000))


# ------------------------------------------------------------- footer ----

def footer(out):
    rng = np.random.default_rng(11)
    W, H = int(2400 * SS), int(900 * SS)
    img = sky(rng, H, W, 0.965, 0.93)
    Y = np.arange(H, dtype=np.float32)[:, None]
    # forested ridges, nearer = darker; fog pooled between them
    for base, tone, amp, k in [(0.40, 0.80, 50, 0), (0.50, 0.70, 60, 1), (0.60, 0.58, 55, 2), (0.70, 0.47, 45, 3)]:
        y = ridge(rng, W, base * H, [(520 * SS, amp * SS), (160 * SS, amp * 0.4 * SS)])
        y -= np.abs(ridge(rng, W, 0, [(9 * SS, 7 * SS), (4 * SS, 3 * SS)]))  # treetop crown bumps
        m = below(H, y, 1.5)
        nz = noise2(rng, H, W, [(6 * SS, 6 * SS, 1.0)])
        comp(img, m, tone + 0.1 * (nz - 0.5) + 0.12 * np.clip((Y - y[None, :]) / (90 * SS), 0, 1))
        img += 0.05 * strokes(img.shape, m, rng, int(m.sum() / (260 * SS * SS)), 4 * SS) * m
        fog_band(img, (base + 0.02) * H, (base + 0.20) * H, 0.85 - 0.08 * k, rng=rng)
    # road/plaza ground
    yg = 0.84 * H + ridge(rng, W, 0, [(600 * SS, 26 * SS), (120 * SS, 6 * SS)])
    hill(img, rng, yg, 0.34, rim=0.0, density=0.45, fringe=0.0)
    # lone tree on the left
    L = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(L)
    tx = 0.09 * W
    d.polygon([(tx - 16 * SS, 0.90 * H), (tx - 9 * SS, 0.60 * H), (tx - 5 * SS, 0.34 * H), (tx + 5 * SS, 0.34 * H), (tx + 7 * SS, 0.60 * H), (tx + 18 * SS, 0.90 * H)], fill=255)
    for (by, ex, ey, wd) in [(0.56, -95, 0.30, 9), (0.50, 105, 0.26, 8), (0.44, -55, 0.16, 6), (0.42, 60, 0.12, 6), (0.38, 10, 0.08, 6)]:
        d.line([(tx, by * H), (tx + ex * SS, ey * H)], fill=255, width=int(wd * SS))
    trunk = np.asarray(L, np.float32) / 255
    comp(img, trunk, 0.24)
    circ = ellipse_circles(rng, tx - 50 * SS, 0.27 * H, 125 * SS, 0.10 * H, 70, 22 * SS, 46 * SS) + ellipse_circles(rng, tx + 60 * SS, 0.20 * H, 120 * SS, 0.09 * H, 70, 22 * SS, 44 * SS) + ellipse_circles(rng, tx, 0.12 * H, 90 * SS, 0.07 * H, 50, 18 * SS, 36 * SS)
    shade_foliage(img, leafy_blob(img.shape, rng, circ, 0.35), rng, circ, tone=0.20)
    # low fog over the ground so the copyright line stays readable
    img = img * 1.0
    f = np.clip((Y - 0.74 * H) / (0.24 * H), 0, 1) ** 0.8 * 0.72
    img = img * (1 - f) + 0.90 * f
    finish(img, rng, out, (2400, 900))


# --------------------------------------------------------------- pier ----

def pier(out):
    """A jetty walking off into fog over still water, seen from the shore."""
    rng = np.random.default_rng(23)
    W, H = int(2400 * SS), int(900 * SS)
    hy = 0.50 * H  # horizon
    cx = 0.47 * W  # vanishing point
    NEAR = 4.5
    F = (H - hy) * NEAR / 1.6  # deck meets the bottom edge NEAR metres away
    HC, WATER = 1.6, 2.7  # camera height above deck / above water
    fogc = 0.93

    def sy(z, height):  # screen y of a point `height` metres above the deck
        return hy + F * (HC - height) / z

    def sx(z, X):
        return cx + F * X / z

    def fogged(tone, z, k=26.0):
        f = 1 - np.exp(-z / k)
        return tone * (1 - f) + fogc * f

    # sky + distant ranges sitting on the horizon
    img = sky(rng, H, W, 0.975, 0.935)
    Y = np.arange(H, dtype=np.float32)[:, None]
    for base, tone, amp in [(hy - 95 * SS, 0.87, 70), (hy - 40 * SS, 0.80, 45), (hy - 12 * SS, 0.74, 18)]:
        y = ridge(rng, W, base, [(620 * SS, amp * SS), (160 * SS, amp * 0.35 * SS), (30 * SS, 3 * SS)])
        y = np.minimum(y, hy - 2)
        m = below(H, y, 1.5) * (Y < hy)
        comp(img, m, tone + 0.10 * np.clip((Y - y[None, :]) / (60 * SS), 0, 1))
        # mirrored range in the water
        yr = 2 * hy - y
        mr = (Y >= hy) * np.clip((yr[None, :] - Y) / 1.5 + 0.5, 0, 1)
        comp(img, mr, tone + 0.06)
    # water: brighter at the horizon, darker toward the viewer
    t = np.clip((Y - hy) / (H - hy), 0, 1)
    water = fogc - 0.36 * t ** 0.9
    wm = (Y >= hy).astype(np.float32)
    img = img * (1 - wm) + wm * np.where(wm > 0, np.minimum(img, 1) * 0.35 + water * 0.65, 0)
    fog_band(img, hy - 60 * SS, hy + 70 * SS, 0.9, fogc=fogc, rng=rng)

    canvas = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "L")
    d = ImageDraw.Draw(canvas)
    XL, XR = 1.3, 3.9  # pier edges, metres to the right of the camera
    zs = np.arange(160, NEAR - 0.6, -0.45)

    def v(tone):
        return int(np.clip(tone, 0, 1) * 255)

    # reflections first, so the ripple pass can break them up
    for z in np.arange(158, NEAR - 1, -3.0):
        w = max(1, F * 0.16 / z)
        x = sx(z, XL)
        top, bot = hy + F * (WATER) / z, hy + F * (WATER + 1.1 - 0.0) / z
        d.rectangle([x - w / 2, top, x + w / 2, hy + F * (WATER + 1.0) / z * 1.0], fill=v(fogged(0.40, z) * 0.5 + 0.35))
    for z in np.arange(150, 15, -12):
        x = sx(z, XL)
        w = max(1, F * 0.07 / z)
        d.rectangle([x - w / 2, hy + F * WATER / z, x + w / 2, hy + F * (WATER + 3.2 + 1.1) / z], fill=v(fogged(0.42, z) * 0.5 + 0.38))
    arr = np.asarray(canvas, np.float32) / 255
    # ripples: shift each water row sideways a little, more near the viewer
    rows = np.arange(H)
    near = np.clip((rows - hy) / (H - hy), 0, 1)
    off = (np.sin(rows * 0.9 / SS) * 1.5 + rng.normal(0, 1.0, H)) * SS * (0.5 + 5 * near ** 1.5)
    off[rows < hy] = 0
    cols = np.clip(np.arange(W)[None, :] + off[:, None], 0, W - 1).astype(int)
    arr = arr[rows[:, None], cols]
    # glinting horizontal ripple strokes
    lines = Image.new("L", (W, H), 0)
    ld = ImageDraw.Draw(lines)
    for _ in range(9000):
        yy = hy + (H - hy) * rng.random() ** 1.6
        n = (yy - hy) / (H - hy)
        L = (4 + 90 * n) * SS * rng.uniform(0.4, 1.0)
        xx = rng.uniform(0, W)
        ld.line([(xx, yy), (xx + L, yy)], fill=int(rng.uniform(120, 255)), width=max(1, int(SS * (0.6 + 1.2 * n))))
    lines = np.asarray(lines, np.float32) / 255
    arr += 0.10 * lines * (Y >= hy)
    dark = Image.new("L", (W, H), 0)
    dd = ImageDraw.Draw(dark)
    for _ in range(6000):
        yy = hy + (H - hy) * rng.random() ** 1.3
        n = (yy - hy) / (H - hy)
        L = (6 + 120 * n) * SS * rng.uniform(0.4, 1.0)
        xx = rng.uniform(0, W)
        dd.line([(xx, yy), (xx + L, yy)], fill=255, width=max(1, int(SS * (0.8 + 1.6 * n))))
    arr -= 0.07 * (np.asarray(dark, np.float32) / 255) * (Y >= hy)

    canvas = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "L")
    d = ImageDraw.Draw(canvas)

    # pier, painted far to near
    for i in range(len(zs) - 1):
        z0, z1 = zs[i], zs[i + 1]
        # deck plank strip
        quad = [(sx(z0, XL), sy(z0, 0)), (sx(z0, XR), sy(z0, 0)), (sx(z1, XR), sy(z1, 0)), (sx(z1, XL), sy(z1, 0))]
        d.polygon(quad, fill=v(fogged(0.50 + 0.05 * rng.random(), z1)))
        # fascia: the deck's side face toward the viewer
        face = [(sx(z0, XL), sy(z0, 0)), (sx(z1, XL), sy(z1, 0)), (sx(z1, XL), sy(z1, -0.35)), (sx(z0, XL), sy(z0, -0.35))]
        d.polygon(face, fill=v(fogged(0.24, z1)))
        if i % 1 == 0:
            d.line([(sx(z1, XL), sy(z1, 0)), (sx(z1, XR), sy(z1, 0))], fill=v(fogged(0.36, z1)), width=max(1, int(F * 0.012 / z1)))
    for z in np.arange(158, 1.4, -3.0):
        # pilings into the water
        w = max(1, F * 0.16 / z)
        x = sx(z, XL)
        d.rectangle([x - w / 2, sy(z, -0.35), x + w / 2, hy + F * WATER / z], fill=v(fogged(0.20, z)))
        # railing posts on both edges
        for X in (XL + 0.08, XR - 0.08):
            xp, wp = sx(z, X), max(1, F * 0.07 / z)
            d.rectangle([xp - wp / 2, sy(z, 1.0), xp + wp / 2, sy(z, 0)], fill=v(fogged(0.22, z)))
    for X in (XL + 0.08, XR - 0.08):
        for hgt, wd in ((1.0, 0.07), (0.55, 0.045)):
            zr = np.arange(160, 1.2, -0.5)
            pts = [(sx(z, X), sy(z, hgt)) for z in zr]
            for (a, b), z in zip(zip(pts, pts[1:]), zr):
                d.line([a, b], fill=v(fogged(0.20, z)), width=max(1, int(F * wd / z)))
    # lamp posts on the near edge, with a soft glow
    glow = np.zeros((H, W), np.float32)
    for z in np.arange(150, 15, -12):
        x = sx(z, XL + 0.08)
        w = max(1, F * 0.07 / z)
        d.rectangle([x - w / 2, sy(z, 3.2), x + w / 2, sy(z, 0)], fill=v(fogged(0.22, z)))
        r = max(2, F * 0.13 / z)
        d.rectangle([x - r, sy(z, 3.45), x + r, sy(z, 3.15)], fill=v(fogged(0.30, z)))
        d.polygon([(x - r * 1.4, sy(z, 3.45)), (x + r * 1.4, sy(z, 3.45)), (x, sy(z, 3.62))], fill=v(fogged(0.22, z)))
        gx, gy = int(x), int(sy(z, 3.3))
        if 0 <= gx < W and 0 <= gy < H:
            glow[gy, gx] = np.exp(-z / 60)
    # someone walking away
    z, X = 22.0, 2.4
    s = F / z
    fx, fy = sx(z, X), sy(z, 0)
    tone = v(fogged(0.16, z, 40))
    d.polygon([(fx - 0.22 * s, fy - 0.95 * s), (fx + 0.22 * s, fy - 0.95 * s), (fx + 0.18 * s, fy - 1.5 * s), (fx - 0.18 * s, fy - 1.5 * s)], fill=tone)
    d.ellipse([fx - 0.11 * s, fy - 1.75 * s, fx + 0.11 * s, fy - 1.5 * s], fill=tone)
    d.polygon([(fx - 0.15 * s, fy - 0.95 * s), (fx - 0.02 * s, fy - 0.95 * s), (fx - 0.06 * s, fy), (fx - 0.16 * s, fy)], fill=tone)
    d.polygon([(fx + 0.02 * s, fy - 0.95 * s), (fx + 0.15 * s, fy - 0.95 * s), (fx + 0.13 * s, fy - 0.05 * s), (fx + 0.03 * s, fy - 0.05 * s)], fill=tone)

    img = np.asarray(canvas, np.float32) / 255
    img += np.clip(gaussian_filter(glow, 16 * SS) * 2 * np.pi * (16 * SS) ** 2 * 0.22, 0, 0.3)
    # plank texture on the near deck
    deckm = np.zeros((H, W), np.float32)
    dm = ImageDraw.Draw(m_img := Image.new("L", (W, H), 0))
    dm.polygon([(sx(40, XL), sy(40, 0)), (sx(40, XR), sy(40, 0)), (sx(NEAR - 0.6, XR), sy(NEAR - 0.6, 0)), (sx(NEAR - 0.6, XL), sy(NEAR - 0.6, 0))], fill=255)
    deckm = np.asarray(m_img, np.float32) / 255
    img -= 0.07 * strokes(img.shape, deckm, rng, int(deckm.sum() / (60 * SS * SS)), 9 * SS) * deckm
    img += 0.05 * strokes(img.shape, deckm, rng, int(deckm.sum() / (90 * SS * SS)), 9 * SS) * deckm
    # darken the near water and corners a touch
    Xn = np.linspace(-1, 1, W, dtype=np.float32)[None, :]
    img -= 0.10 * np.clip((Y - hy) / (H - hy), 0, 1) ** 2 + 0.05 * Xn ** 2 * np.clip((Y - hy) / (H - hy), 0, 1)
    # a few birds
    for bx, by, bs in [(0.22, 0.20, 9), (0.25, 0.17, 7), (0.28, 0.215, 6), (0.70, 0.12, 6)]:
        x0, y0, r = bx * W, by * H, bs * SS
        d2 = ImageDraw.Draw(bimg := Image.new("L", (W, H), 0))
        d2.arc([x0 - r, y0, x0, y0 + r], 200, 330, fill=255, width=int(1.5 * SS))
        d2.arc([x0, y0, x0 + r, y0 + r], 210, 340, fill=255, width=int(1.5 * SS))
        img -= 0.5 * np.asarray(bimg, np.float32) / 255
    fog_band(img, hy - 40 * SS, hy + 30 * SS, 0.5, fogc=fogc, rng=rng)
    finish(img, rng, out, (2400, 900))


if __name__ == "__main__":
    which = sys.argv[1]
    {"hero": hero, "footer": footer, "pier": pier}[which](sys.argv[2])
