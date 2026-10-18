#!/usr/bin/env python3
"""Composite a model-painted window view back into the plate so it reads as part of the picture.
The model repaints a 512 px crop around the window (tools/art/gen.py --ref crop.png). This takes the opening
AND its inner bevel from the repaint (so the frame's lighting matches the sky: dark at night, warm at sunset),
blends inside the frame's flat cream band where a seam cannot show, matches the repaint's colour to the plate
along that band, and softens only the view through the glass to the plate's own soft focus.
Usage: window_inpaint.py plate.webp cropx cropy painted.jpg out.webp"""
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from scipy.spatial import ConvexHull
plate, cx0, cy0, painted, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
im = Image.open(plate).convert('RGB'); W, H = im.size; a = np.asarray(im).astype(int)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
cx, cy = int(W * 0.3544), int(H * 0.3141)
inner = (B > 170) & ((R - B) < 14) & ((R - G) < 20)
lab, n = ndimage.label(inner); m = lab == lab[cy, cx]
m = ndimage.binary_closing(m, iterations=4); m = ndimage.binary_fill_holes(m); m = ndimage.binary_opening(m, iterations=3); m = ndimage.binary_fill_holes(m)
pts = np.stack(np.where(m)[::-1], 1); hull = ConvexHull(pts); poly = [tuple(map(float, pts[v])) for v in hull.vertices]
pm = Image.new('L', (W, H), 0); ImageDraw.Draw(pm).polygon(poly, fill=255); opening = np.asarray(pm) > 0
dist_out = ndimage.distance_transform_edt(~opening)          # px outside the opening
BEVEL, FEATHER = 4, 7                                        # full repaint to 4 px into the frame, fade over the next 7 px
alpha = np.clip(1 - (dist_out - BEVEL) / FEATHER, 0, 1); alpha[opening] = 1
# the repaint, placed on a plate-sized canvas
pv = Image.open(painted).convert('RGB').resize((512, 512), Image.LANCZOS)
full = Image.new('RGB', (W, H)); full.paste(pv, (cx0, cy0))
rep = np.asarray(full).astype(float)
# colour match along the seam band (4 to 11 px outside the opening): per-channel offset so the band meets the plate
band = (dist_out > BEVEL) & (dist_out <= BEVEL + FEATHER)
for c in range(3):
    rep[..., c] += a[..., c][band].mean() - rep[..., c][band].mean()
# soft focus only inside the glass, like the daytime view
blur = np.asarray(Image.fromarray(np.clip(rep, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.4))).astype(float)
glass = ndimage.binary_erosion(opening, iterations=3)
rep[glass] = blur[glass]
# night only: the plate's daylight spill on the wall around the window dims with a broad soft falloff (never the bulbs)
if 'night' in out:
    ring = (dist_out > BEVEL + FEATHER)
    fall = np.exp(-((dist_out - (BEVEL + FEATHER)) / 95.0) ** 2) * 0.22 * ring
    lum = (R * 0.299 + G * 0.587 + B * 0.114) / 255.0
    fall *= np.clip((0.86 - lum) / 0.12, 0, 1)                      # fairy bulbs and highlights keep their light
    for c in range(3): rep[..., c] = np.where(ring, a[..., c] * (1 - fall), rep[..., c])
    alpha = np.maximum(alpha, np.clip(fall / 0.22, 0, 1) * ring * (fall > 0.012))
# every state shares one placement: the box is the opening grown by the spill radius, whatever the state paints
box = dist_out <= 215
ys, xs = np.where(box); x0, x1, y0, y1 = max(0, xs.min()), min(W - 1, xs.max()), max(0, ys.min()), min(H - 1, ys.max())
patch = np.dstack([np.clip(rep[y0:y1 + 1, x0:x1 + 1], 0, 255).astype(np.uint8), (alpha[y0:y1 + 1, x0:x1 + 1] * 255).astype(np.uint8)])
Image.fromarray(patch, 'RGBA').save(out, 'WEBP', quality=90, method=6)
print('PLACE x: %.3f, y: %.3f, w: %.3f' % (x0 / W * 100, y0 / H * 100, (x1 - x0 + 1) / W * 100))
