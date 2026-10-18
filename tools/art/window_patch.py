#!/usr/bin/env python3
"""Cut the room window's opening out of the day plate and paint sky states into it, pixel for pixel.
The opening is found from the plate itself (bluish-white interior, cream or pink frame), so the patch
follows the tilted isometric oval exactly. Writes room-v3-win-{night,sunset,sunrise}.webp and prints
the CSS placement in percent of the plate. Usage: window_patch.py assets/room/dream/room-v3.webp outdir"""
import sys, math, numpy as np
from PIL import Image
from scipy import ndimage
src, outdir = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); W, H = im.size; a = np.asarray(im).astype(int)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
cx, cy = int(W * 0.3544), int(H * 0.3141)
inner = (B > 170) & ((R - B) < 14) & ((R - G) < 20)   # sky, clouds and sun, but not the cream or pink frame
lab, n = ndimage.label(inner); k = lab[cy, cx]
if not k: raise SystemExit('centre is not inside the opening')
m = lab == k
m = ndimage.binary_closing(m, iterations=4); m = ndimage.binary_fill_holes(m)
m = ndimage.binary_opening(m, iterations=3); m = ndimage.binary_fill_holes(m)
# the opening is a convex oval: clouds that touch the frame bite into the colour mask, the convex hull restores the true outline
from scipy.spatial import ConvexHull
from PIL import ImageDraw
pts = np.stack(np.where(m)[::-1], 1)
hull = ConvexHull(pts); poly = [tuple(map(float, pts[v])) for v in hull.vertices]
pm = Image.new('L', (W, H), 0); ImageDraw.Draw(pm).polygon(poly, fill=255)
m = np.asarray(pm) > 0
m = ndimage.binary_erosion(m, iterations=1)
ys, xs = np.where(m); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
pad = 2; x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(W - 1, x1 + pad), min(H - 1, y1 + pad)
sub = m[y0:y1 + 1, x0:x1 + 1]; h, w = sub.shape
# soft edge: alpha from the distance to the outside, over 2.5 px
dist = ndimage.distance_transform_edt(sub)
alpha = np.clip(dist / 2.5, 0, 1)
yy, xx = np.mgrid[0:h, 0:w].astype(float); t = yy / max(1, h - 1)
def paint(name, top, bottom, extras):
    img = np.zeros((h, w, 4), float)
    for c in range(3): img[..., c] = top[c] + (bottom[c] - top[c]) * t
    for fn in extras: fn(img)
    img[..., 3] = alpha * 255
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGBA').save(f'{outdir}/room-v3-win-{name}.webp', 'WEBP', quality=90, method=6)
def moon(img):
    mx, my, r = w * 0.62, h * 0.30, w * 0.11
    d = np.sqrt((xx - mx) ** 2 + (yy - my) ** 2); d2 = np.sqrt((xx - (mx - r * 0.55)) ** 2 + (yy - (my - r * 0.25)) ** 2)
    disc = np.clip(1 - (d - r) / 1.5, 0, 1) * (1 - np.clip(1 - (d2 - r * 0.92) / 1.5, 0, 1))
    glow = np.exp(-((d - r) / (r * 1.6)) ** 2) * 0.55 * (d > r)
    for c, v in enumerate((255, 243, 207)): img[..., c] = img[..., c] * (1 - disc) + v * disc + glow * (v - img[..., c]) * 0.35
def stars(img):
    rng = np.random.default_rng(11)
    for _ in range(26):
        sx, sy = rng.uniform(0.08, 0.92) * w, rng.uniform(0.06, 0.94) * h; sr = rng.uniform(0.9, 2.2)
        d = np.sqrt((xx - sx) ** 2 + (yy - sy) ** 2); s = np.clip(1 - (d - sr) / 1.2, 0, 1) * rng.uniform(0.5, 1.0)
        for c in range(3): img[..., c] = img[..., c] * (1 - s) + 255 * s
def sun(y_frac, col, rad):
    def f(img):
        sx, sy, r = w * 0.5, h * y_frac, w * rad
        d = np.sqrt((xx - sx) ** 2 + (yy - sy) ** 2); disc = np.clip(1 - (d - r) / 2, 0, 1); glow = np.exp(-((d - r) / (r * 1.8)) ** 2) * 0.6 * (d > r)
        for c, v in enumerate(col): img[..., c] = img[..., c] * (1 - disc) + v * disc + glow * (v - img[..., c]) * 0.5
    return f
paint('night', (34, 26, 72), (74, 59, 120), [stars, moon])
paint('sunset', (111, 92, 171), (255, 208, 139), [sun(0.80, (255, 232, 190), 0.16)])
paint('sunrise', (169, 189, 233), (255, 234, 204), [sun(0.84, (255, 244, 220), 0.14)])
import math as _m
print('mask pixels', int(m.sum()), 'bbox', x0, y0, x1, y1, 'fill vs ellipse', round(m.sum() / (_m.pi * (x1 - x0) / 2 * (y1 - y0) / 2), 3))
print('PLACE x: %.3f, y: %.3f, w: %.3f' % (x0 / W * 100, y0 / H * 100, (x1 - x0 + 1) / W * 100))
# a check image: the night patch composited on the day plate crop
crop = im.crop((x0 - 60, y0 - 60, x1 + 60, y1 + 60)).convert('RGBA')
patch = Image.open(f'{outdir}/room-v3-win-night.webp'); crop.alpha_composite(patch, (60, 60))
crop.resize((crop.width * 2, crop.height * 2)).save(f'{outdir}/../../../window_check.png') if False else crop.resize((crop.width * 2, crop.height * 2)).save('/tmp/window_check.png')
