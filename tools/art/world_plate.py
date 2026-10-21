#!/usr/bin/env python3
"""The wider-world plate: the known map in the top-left corner, open unbuilt country everywhere else (Jamie, 21 Oct 2026:
"The whole map must be filled just that whatever we built will be at a corner of it, the rest of the area will be just
the field, the land unbuilt"). Local compositing only, no model call.

    python3 tools/art/world_plate.py            # writes assets/room/dream/map-world.webp

Inputs, all in the repo:
- assets/room/dream/map-bg.webp, the known map the places are drawn on. Its edge clouds are cropped off and the few that
  are left are painted over with land, so the world has no white or misty patch anywhere.
- tools/art/world-land/land-{fields,stream,woods}.webp, three open-country tiles drawn once in the same pastel watercolour
  style (text-only Seedream 5.0 pro renders at 1024x1024, seeds 52101-52103; the prompts are in
  tools/art/jobs/2026-10-21-world-land.json). Nothing is built on them: fields, hedgerows, a stream, woods, a pond, empty
  plots.

The plate is three of the map's boxes wide and three tall (ovu-map.js WORLD), 1800 x 1440 px, so one box is 600 x 480 px.
Each layer is laid with a soft mask whose edge wanders (smooth noise), so no seam is a straight line, and each tile's
colours are drawn halfway towards the known map's own palette so the tones run on. The places themselves are not in
the plate: ovu-map.js draws them, and their paths, over the top-left box.
"""
import os
import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, 'assets/room/dream')
LAND = os.path.join(ROOT, 'tools/art/world-land')
OUT = os.path.join(ART, 'map-world.webp')
W, H = 1800, 1440          # three boxes by three
BW, BH = W // 3, H // 3    # the built box at the top-left, 600 x 480
CROP = (228, 150, 883, 690)  # the middle of map-bg.webp, clear of its edge clouds; the box is its 5:4 top-left, the rest runs on under the blend
SCALE = BW / (773 - 228)     # 1.1: the known map's trees come out near the size of the land tiles' trees
KNOWN = (round((CROP[2] - CROP[0]) * SCALE), round((CROP[3] - CROP[1]) * SCALE))  # 720 x 594
# cloud edges the crop still touches, in map-bg pixels: (cx, cy, rx, ry) ellipses; the land shows there instead
CLOUDS = [(170, 712, 105, 62), (870, 712, 130, 72), (912, 380, 80, 78)]
SOFT = 30                    # px: how wide a seam between two land tiles blends
KEEP = 2.5                   # how strongly a tile keeps its own trees whole across a seam


def noise(seed, scale, w=W, h=H):
    """smooth value noise in 0..1: random coarse grid, upsampled and blurred"""
    rng = np.random.default_rng(seed)
    g = rng.random((h // scale + 2, w // scale + 2))
    im = Image.fromarray((g * 255).astype('uint8')).resize((w + 2 * scale, h + 2 * scale), Image.BICUBIC)
    im = im.crop((scale, scale, scale + w, scale + h)).filter(ImageFilter.GaussianBlur(scale / 3))
    return np.asarray(im, dtype=np.float32) / 255.0


def edge_mask(x0, y0, x1, y1, feather, sides, seed, wobble=0.5):
    """1 inside the box, falling to exactly 0 at the named sides (l, t, r, b) across `feather` px; the start of the fall
    wanders inward by up to wobble x feather (smooth noise), so no seam is a straight line and the mask still meets 0 at
    the box's edge, inside the tile's own pixels. Sides not named stay hard: they lie on the plate's edge."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.full((H, W), 1e6, np.float32)
    if 'l' in sides: d = np.minimum(d, xx - x0)
    if 't' in sides: d = np.minimum(d, yy - y0)
    if 'r' in sides: d = np.minimum(d, x1 - xx)
    if 'b' in sides: d = np.minimum(d, y1 - yy)
    m = np.clip(d / (feather * (1 + wobble * noise(seed, 90))), 0, 1)
    m[(xx < x0) | (xx >= x1) | (yy < y0) | (yy >= y1)] = 0
    return m


def tone(img, target_mean, target_std, k=0.5):
    """move a tile's per-channel mean and spread k of the way to the known map's"""
    a = np.asarray(img, dtype=np.float32)
    m, s = a.reshape(-1, 3).mean(0), a.reshape(-1, 3).std(0) + 1e-3
    tm, ts = m + (target_mean - m) * k, s + (target_std - s) * k
    return np.clip((a - m) / s * ts + tm, 0, 255)


def detail(im):
    """0..1, high over trees, hedges and banks (coloured, textured) and low over open grass and water: a seam is steered
    through open grass so a tree is drawn whole from one picture, never as a see-through ghost"""
    hsv = np.asarray(im.convert('HSV'), dtype=np.float32) / 255
    g = np.asarray(im.convert('L'), dtype=np.float32)
    mu = np.asarray(Image.fromarray(g.astype('uint8')).filter(ImageFilter.BoxBlur(9)), dtype=np.float32)
    sq = np.asarray(Image.fromarray(np.clip(g * g / 255, 0, 255).astype('uint8')).filter(ImageFilter.BoxBlur(9)), dtype=np.float32) * 255
    sd = np.sqrt(np.clip(sq - mu * mu, 0, None))
    t = np.clip((hsv[..., 1] - 0.13) / 0.12, 0, 1) * np.clip((sd - 4) / 8, 0, 1)
    t = Image.fromarray((t * 255).astype('uint8')).filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.GaussianBlur(10))
    return np.asarray(t, dtype=np.float32) / 255


def tile(name, scale, mirror=False, crop=None):
    im = Image.open(os.path.join(LAND, name)).convert('RGB')
    if crop: im = im.crop(crop)
    if mirror: im = ImageOps.mirror(im)
    return im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)


def place(im, x, y):
    """the tile's pixels on a full-plate array (zeros outside it)"""
    out = np.zeros((H, W, 3), np.float32)
    a = np.asarray(im, dtype=np.float32)
    sx0, sy0 = max(0, -x), max(0, -y)
    dx0, dy0 = max(0, x), max(0, y)
    w = min(a.shape[1] - sx0, W - dx0); h = min(a.shape[0] - sy0, H - dy0)
    out[dy0:dy0 + h, dx0:dx0 + w] = a[sy0:sy0 + h, sx0:sx0 + w]
    return out


def main():
    bg = Image.open(os.path.join(ART, 'map-bg.webp')).convert('RGB')
    ref = np.asarray(bg.crop(CROP), dtype=np.float32).reshape(-1, 3)
    tm, ts = ref.mean(0), ref.std(0)

    def toned(im):
        return Image.fromarray(tone(im, tm, ts).astype('uint8'))

    # the known map in the corner, its right and bottom edges wandering out into the land past the box, the cloud edges
    # the crop still touches left to the land
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    known = bg.crop(CROP).resize(KNOWN, Image.LANCZOS)
    km = edge_mask(0, 0, KNOWN[0], KNOWN[1], 76, 'rb', 21)  # the fall starts past the box, wobble included
    for cx, cy, rx, ry in CLOUDS:
        r = np.sqrt(((xx - (cx - CROP[0]) * SCALE) / (rx * SCALE)) ** 2 + ((yy - (cy - CROP[1]) * SCALE) / (ry * SCALE)) ** 2)
        km = km * np.clip((r - 0.75) / 0.6, 0, 1)  # gone inside, a soft rim
    kd = place(Image.fromarray((detail(known) * 255).astype('uint8')).convert('RGB'), 0, 0)[..., 0] / 255
    room = np.clip(np.minimum(KNOWN[0] - 24 - xx, KNOWN[1] - 24 - yy) / 30, 0, 1)  # a tree is kept whole only clear of the picture's own edge
    km = np.where(km > 0.02, np.maximum(km, kd * room), km)
    assert km[:BH, :BW].min() > 0.98, 'the box itself must stay the known map'

    # the land: each tile owns the part of the plate nearest its anchor, the borders between them wander (smooth noise)
    # and blend over SOFT px, and a tile's weight falls to nothing before its own edge wherever another tile is there,
    # so the land is painted everywhere and no seam is a line: (tile, its top-left on the plate, its anchors)
    F = (46, 46, 978, 978)  # the fields render came with a painted paper margin
    land = [
        (tile('land-stream.webp', 1.3, mirror=True), (-490, 137), [(150, 850), (300, 1400)]),     # the left: the stream runs on from the corner's bridge and off the left edge
        (tile('land-fields.webp', 1.3, crop=F), (588, -300), [(1400, 150), (900, 120)]),          # top right: a patchwork of empty fields
        (tile('land-woods.webp', 1.3), (469, 109), [(950, 1150), (1550, 1150)]),                  # bottom right: woods, the pond, empty hedged plots
    ]
    scores, pix = [], []
    for i, (im, (x, y), anchors) in enumerate(land):
        im = toned(im)
        inside = (xx >= x) & (xx < x + im.width) & (yy >= y) & (yy < y + im.height)
        edge = np.minimum(np.minimum(xx - x, x + im.width - 1 - xx), np.minimum(yy - y, y + im.height - 1 - yy))
        dt = place(Image.fromarray((detail(im) * 255).astype('uint8')).convert('RGB'), x, y)[..., 0] / 255
        near = np.min([np.hypot(xx - ax, yy - ay) for ax, ay in anchors], axis=0)
        sc = -(near + (noise(31 + i, 160) - 0.5) * 180) / SOFT + KEEP * dt + np.log(np.clip(edge / 90, 1e-4, 1))
        scores.append(np.where(inside, sc, -np.inf)); pix.append(place(im, x, y))
    S = np.stack(scores)
    top = S.max(0)
    assert np.isfinite(top[km < 0.99]).all(), 'some of the plate has neither the known map nor a land tile over it'
    E = np.exp(S - np.where(np.isfinite(top), top, 0)); E[~np.isfinite(S)] = 0
    Wt = E / np.maximum(E.sum(0), 1e-12)
    plate = sum(Wt[i][..., None] * pix[i] for i in range(len(land)))
    if os.environ.get('OWNERS'):  # a picture of which tile owns where, for tuning the anchors
        pal = np.array([[230, 80, 80], [80, 200, 80], [80, 80, 230], [220, 200, 60], [200, 80, 220], [60, 200, 200]], np.float32)
        Image.fromarray(np.clip(sum(Wt[i][..., None] * pal[i] for i in range(len(land))) * (1 - km[..., None]) + 255 * km[..., None], 0, 255).astype('uint8')).save(os.environ['OWNERS'])

    # the paper wash some renders carry at their corners: where the land's broad brightness rises above its own average,
    # take most of the rise away, so no corner of the world reads as white or misty
    low = np.asarray(Image.fromarray(np.clip(plate, 0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(90)), dtype=np.float32)
    lum, avg = low.mean(2, keepdims=True), low.mean()
    plate = plate - 0.75 * np.clip(lum - avg - 4, 0, None) * (1 - km[..., None])
    plate = plate * (1 - km[..., None]) + place(known, 0, 0) * km[..., None]

    # a few trees from the woods over the top of the corner's right edge, where the known map's own trees run off its
    # picture: a soft cut through them would read as mist, so the woods carry them on
    wd = tile('land-woods.webp', 1.05).crop((672, 63, 1008, 263))  # three lone trees on open grass in the woods picture
    gy, gx = np.mgrid[0:wd.height, 0:wd.width].astype(np.float32)
    rim = np.clip(np.minimum(np.minimum(gx, wd.width - 1 - gx), np.minimum(gy, wd.height - 1 - gy)) / 28, 0, 1)  # grass at its own edge
    wa = np.clip(detail(wd) * 1.5, 0, 1) * rim
    sx0, sy0 = 560, -60
    wal = np.zeros((H, W), np.float32); y0, x0 = max(0, sy0), max(0, sx0)
    wal[y0:sy0 + wd.height, x0:sx0 + wd.width] = wa[y0 - sy0:, x0 - sx0:]
    plate = plate * (1 - wal[..., None]) + place(toned(wd), sx0, sy0) * wal[..., None]

    out = Image.fromarray(np.clip(plate, 0, 255).astype('uint8'))
    out.save(OUT, 'WEBP', quality=84, method=6)
    print('wrote', OUT, out.size, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
