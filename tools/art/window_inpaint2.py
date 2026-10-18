#!/usr/bin/env python3
"""Same recipe as window_inpaint.py, for any window on any plate: the repaint owns the opening and its bevel,
the blend sits in the frame's flat band with matched colour, only the glass is softened, and at night the
daylight spill on the wall dims. Sizes scale with the plate (the room plate is 1472 px wide).
Usage: window_inpaint2.py plate.webp cropx cropy cropsize cx cy painted.jpg out.webp [boxpx]"""
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from scipy.spatial import ConvexHull
plate, cx0, cy0, csize, cx, cy, painted, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6]), sys.argv[7], sys.argv[8]
im = Image.open(plate).convert('RGB'); W, H = im.size; a = np.asarray(im).astype(int)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
k = W / 1472.0
inner = (B > 150) & ((R - B) < 14) & ((R - G) < 20)
lab, n = ndimage.label(inner)
if not lab[cy, cx]:
    # the exact centre may sit on the painted sun: take the biggest component within 40 px
    ys, xs = np.ogrid[0:H, 0:W]; near = ((xs - cx) ** 2 + (ys - cy) ** 2) < (40 * k) ** 2
    ids, counts = np.unique(lab[near & inner], return_counts=True); k_id = ids[np.argmax(counts)] if len(ids) else 0
else: k_id = lab[cy, cx]
if not k_id: raise SystemExit('no opening found at %d,%d' % (cx, cy))
m = lab == k_id
m = ndimage.binary_closing(m, iterations=max(2, int(4 * k))); m = ndimage.binary_fill_holes(m); m = ndimage.binary_opening(m, iterations=max(2, int(3 * k))); m = ndimage.binary_fill_holes(m)
pts = np.stack(np.where(m)[::-1], 1); hull = ConvexHull(pts); poly = [tuple(map(float, pts[v])) for v in hull.vertices]
pm = Image.new('L', (W, H), 0); ImageDraw.Draw(pm).polygon(poly, fill=255); opening = np.asarray(pm) > 0
dist_out = ndimage.distance_transform_edt(~opening)
BEVEL, FEATHER = max(2.0, 4 * k), max(4.0, 7 * k)
alpha = np.clip(1 - (dist_out - BEVEL) / FEATHER, 0, 1); alpha[opening] = 1
pv = Image.open(painted).convert('RGB').resize((csize, csize), Image.LANCZOS)
full = Image.new('RGB', (W, H)); full.paste(pv, (cx0, cy0)); rep = np.asarray(full).astype(float)
band = (dist_out > BEVEL) & (dist_out <= BEVEL + FEATHER)
for c in range(3): rep[..., c] += a[..., c][band].mean() - rep[..., c][band].mean()
blur = np.asarray(Image.fromarray(np.clip(rep, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.4 * k))).astype(float)
glass = ndimage.binary_erosion(opening, iterations=max(2, int(3 * k))); rep[glass] = blur[glass]
if 'night' in out:
    ring = dist_out > BEVEL + FEATHER
    fall = np.exp(-((dist_out - (BEVEL + FEATHER)) / (95.0 * k)) ** 2) * 0.22 * ring
    lum = (R * 0.299 + G * 0.587 + B * 0.114) / 255.0
    fall *= np.clip((0.86 - lum) / 0.12, 0, 1)
    for c in range(3): rep[..., c] = np.where(ring, a[..., c] * (1 - fall), rep[..., c])
    alpha = np.maximum(alpha, np.clip(fall / 0.22, 0, 1) * ring * (fall > 0.012))
box = dist_out <= 215 * k
ys, xs = np.where(box); x0, x1, y0, y1 = max(0, xs.min()), min(W - 1, xs.max()), max(0, ys.min()), min(H - 1, ys.max())
patch = np.dstack([np.clip(rep[y0:y1 + 1, x0:x1 + 1], 0, 255).astype(np.uint8), (alpha[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8)])
Image.fromarray(patch, 'RGBA').save(out, 'WEBP', quality=90, method=6)
print('PLACE x: %.3f, y: %.3f, w: %.3f' % (x0 / W * 100, y0 / H * 100, (x1 - x0 + 1) / W * 100))
