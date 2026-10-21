#!/usr/bin/env python3
"""The wider-world plate, drawn from the known map without a model call (21 Oct 2026: the Ark reference edit of this
plate hit the 60-second cut twice, so the surround is painted here). One square picture: the known map (map-bg.webp)
sits in the middle, the ground colours run on outward from its edges, the paths continue as dotted stone into thick
mist at the edges, and the mist hides the unexplored lands. The ??? markers in ovu-map.js sit where each path ends.

    python3 tools/art/world_plate.py            # writes assets/room/dream/map-world.webp and prints the path ends

Known box (percent of the plate): x 26.95, y 31.64, w 46, h 36.72 (the same fractions the CSS places the overlay at).
"""
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'assets/room/dream/map-bg.webp')
OUT = os.path.join(ROOT, 'assets/room/dream/map-world.webp')
W = 1536
KNOWN = (0.2695, 0.3164, 0.46, 0.3672)
# each path: where it leaves the known map (fraction of the known box) and where it ends in the mist (percent of the plate)
PATHS = [
    ('north', (0.42, 0.0), (50, 8)),
    ('ne', (0.86, 0.0), (84, 13)),
    ('east', (1.0, 0.46), (91, 50)),
    ('se', (1.0, 0.88), (85, 86)),
    ('south', (0.6, 1.0), (50, 92)),
    ('sw', (0.14, 1.0), (15, 86)),
    ('west', (0.0, 0.62), (9, 50)),
    ('nw', (0.0, 0.14), (15, 13)),
]

def main():
    random.seed(2110)
    bg = Image.open(SRC).convert('RGB')
    kx, ky, kw, kh = int(KNOWN[0] * W), int(KNOWN[1] * W), int(KNOWN[2] * W), int(KNOWN[3] * W)
    # the ground: the known map stretched over the whole plate and blurred, so the surround carries its own palette
    ground = bg.resize((W, W), Image.LANCZOS).filter(ImageFilter.GaussianBlur(46))
    tint = Image.new('RGB', (W, W), (214, 232, 208))
    plate = Image.blend(ground, tint, 0.3)
    # soft meadow texture: pale blotches, blurred
    tex = Image.new('L', (W, W), 0); td = ImageDraw.Draw(tex)
    for _ in range(140):
        x, y = random.randint(0, W), random.randint(0, W); r = random.randint(40, 150)
        td.ellipse([x - r, y - int(r * 0.55), x + r, y + int(r * 0.55)], fill=random.randint(40, 110))
    tex = tex.filter(ImageFilter.GaussianBlur(28))
    meadow = Image.new('RGB', (W, W), (198, 224, 196))
    plate = Image.composite(meadow, plate, tex.point(lambda v: int(v * 0.6)))
    # tree clusters in the near surround: soft pastel rounds with a darker base, like the known map's trees
    tdraw = ImageDraw.Draw(plate, 'RGBA')
    pal = [(176, 212, 186), (200, 180, 226), (236, 190, 206), (188, 220, 214), (226, 206, 170), (170, 206, 190)]
    for _ in range(160):
        ang = random.random() * math.tau; dist = W * (0.3 + random.random() * 0.22)
        x, y = W / 2 + math.cos(ang) * dist, W / 2 + math.sin(ang) * dist * 0.92
        if kx - 10 < x < kx + kw + 10 and ky - 10 < y < ky + kh + 10: continue
        r = random.randint(9, 22); c = random.choice(pal)
        tdraw.ellipse([x - r * 0.9, y + r * 0.35, x + r * 0.9, y + r * 0.95], fill=(110, 100, 130, 40))
        tdraw.ellipse([x - r, y - r, x + r, y + r], fill=c + (255,))
        tdraw.ellipse([x - r * 0.55, y - r * 0.75, x + r * 0.25, y - r * 0.05], fill=(255, 255, 255, 70))
    # a river: a soft pale blue ribbon that passes behind the known map
    riv = Image.new('L', (W, W), 0); rd = ImageDraw.Draw(riv)
    pts = [(int(W * 0.02), int(W * 0.78)), (int(W * 0.22), int(W * 0.70)), (int(W * 0.40), int(W * 0.74)), (int(W * 0.62), int(W * 0.66)), (int(W * 0.80), int(W * 0.72)), (int(W * 0.99), int(W * 0.64))]
    rd.line(pts, fill=200, width=int(W * 0.028), joint='curve')
    riv = riv.filter(ImageFilter.GaussianBlur(10))
    plate = Image.composite(Image.new('RGB', (W, W), (196, 216, 238)), plate, riv)
    # the known map, feathered into the ground
    known = bg.resize((kw, kh), Image.LANCZOS)
    mask = Image.new('L', (kw, kh), 0); md = ImageDraw.Draw(mask)
    pad = int(kw * 0.045)
    md.rounded_rectangle([pad, pad, kw - pad, kh - pad], radius=int(kw * 0.05), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(pad * 0.9))
    plate.paste(known, (kx, ky), mask)
    # the paths: dotted stone, fading as they enter the mist
    draw = ImageDraw.Draw(plate, 'RGBA')
    ends = []
    for pid, (fx, fy), (ex, ey) in PATHS:
        x0, y0 = kx + fx * kw, ky + fy * kh
        x1, y1 = ex / 100 * W, ey / 100 * W
        # a gentle curve: control point pushed sideways
        cx, cy = (x0 + x1) / 2 + (y1 - y0) * 0.18, (y0 + y1) / 2 - (x1 - x0) * 0.18
        n = 26
        for i in range(n + 1):
            t = i / n
            x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1
            y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1
            r = max(3, int(W * 0.0062 * (1 - 0.35 * t)))
            a = int(235 * (1 - 0.55 * max(0.0, t - 0.45) / 0.55))
            draw.ellipse([x - r, y + 2 - r, x + r, y + 2 + r], fill=(120, 100, 140, int(a * 0.25)))
            draw.ellipse([x - r, y - r, x + r, y + r], fill=(252, 246, 236, a))
        ends.append((pid, round(ex, 1), round(ey, 1)))
    # the mist: thick at the edges, clear over the known map
    mist = Image.new('L', (W, W), 0); mdraw = ImageDraw.Draw(mist)
    for i in range(60):
        f = i / 59
        rad = int(W * (0.95 - 0.5 * f))
        mdraw.ellipse([W / 2 - rad, W / 2 - rad * 0.9, W / 2 + rad, W / 2 + rad * 0.9], fill=int(255 * f * 0.55))
    mist = mist.point(lambda v: 0)  # reset: build the mist as an inverted radial gradient instead
    g = Image.radial_gradient('L').resize((W, W))  # 0 at centre, 255 at the corners
    mist = g.point(lambda v: 0 if v < 178 else min(255, int((v - 178) / 77 * 255 * 0.86)))
    clouds = Image.new('L', (W, W), 0); cd = ImageDraw.Draw(clouds)
    for _ in range(90):
        ang = random.random() * math.tau; dist = W * (0.46 + random.random() * 0.16)
        x, y = W / 2 + math.cos(ang) * dist, W / 2 + math.sin(ang) * dist * 0.95
        r = random.randint(60, 170)
        cd.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6], fill=random.randint(120, 230))
    clouds = clouds.filter(ImageFilter.GaussianBlur(34))
    mist = Image.composite(Image.new('L', (W, W), 255), mist, clouds.point(lambda v: int(v * 0.38)))
    mist = mist.filter(ImageFilter.GaussianBlur(6))
    white = Image.new('RGB', (W, W), (250, 248, 253))
    plate = Image.composite(white, plate, mist)
    # faint silhouettes in the mist, as shapes only (no text): towers top right, castle top left, a round clinic bottom right, a lighthouse bottom left
    sil = Image.new('RGBA', (W, W), (0, 0, 0, 0)); sd = ImageDraw.Draw(sil)
    col = (150, 140, 180, 46)
    def towers(x, y):
        for i, (w_, h_) in enumerate([(26, 170), (34, 240), (22, 150), (30, 200)]):
            xx = x + i * 44; sd.rectangle([xx, y - h_, xx + w_, y], fill=col); sd.polygon([(xx, y - h_), (xx + w_ / 2, y - h_ - 40), (xx + w_, y - h_)], fill=col)
    def castle(x, y):
        sd.rectangle([x, y - 110, x + 190, y], fill=col)
        for xx in (x, x + 80, x + 160): sd.rectangle([xx, y - 170, xx + 30, y], fill=col); sd.polygon([(xx - 6, y - 170), (xx + 15, y - 215), (xx + 36, y - 170)], fill=col)
        sd.ellipse([x + 230, y - 150, x + 340, y - 40], outline=col, width=6)  # a wheel
    def clinic(x, y):
        sd.rounded_rectangle([x, y - 120, x + 170, y], radius=40, fill=col); sd.ellipse([x + 60, y - 160, x + 110, y - 110], fill=col)
    def lighthouse(x, y):
        sd.polygon([(x, y), (x + 44, y), (x + 34, y - 170), (x + 10, y - 170)], fill=col); sd.rectangle([x + 4, y - 190, x + 40, y - 170], fill=col)
    towers(int(W * 0.80), int(W * 0.14)); castle(int(W * 0.06), int(W * 0.17)); clinic(int(W * 0.82), int(W * 0.90)); lighthouse(int(W * 0.14), int(W * 0.92))
    sil = sil.filter(ImageFilter.GaussianBlur(5))
    plate = Image.alpha_composite(plate.convert('RGBA'), sil).convert('RGB')
    plate.save(OUT, 'WEBP', quality=88, method=6)
    print('wrote', OUT, plate.size, os.path.getsize(OUT) // 1024, 'KB')
    print('path ends (percent of the plate):', ends)

if __name__ == '__main__':
    main()
