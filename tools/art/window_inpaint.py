#!/usr/bin/env python3
"""Composite a model-painted window view back into the plate, inside the exact opening only.
The model repaints a 512 px crop around the window (tools/art, reference edit); this takes the pixels inside
the opening's convex outline (same mask as window_patch.py), feathers the edge, and writes the sky patch.
Usage: window_inpaint.py plate.webp cropx cropy painted.jpg out.webp"""
import sys, numpy as np
from PIL import Image, ImageDraw
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
pm = Image.new('L', (W, H), 0); ImageDraw.Draw(pm).polygon(poly, fill=255); m = np.asarray(pm) > 0
m = ndimage.binary_erosion(m, iterations=3)             # stay inside the frame's inner edge
ys, xs = np.where(m); x0, x1, y0, y1 = xs.min() - 2, xs.max() + 2, ys.min() - 2, ys.max() + 2
sub = m[y0:y1 + 1, x0:x1 + 1]; h, w = sub.shape
alpha = np.clip(ndimage.distance_transform_edt(sub) / 3.0, 0, 1)
pv = Image.open(painted).convert('RGB').resize((512, 512), Image.LANCZOS)
full = np.zeros((H, W, 3), np.uint8); full[cy0:cy0 + 512, cx0:cx0 + 512] = np.asarray(pv)
rgb = full[y0:y1 + 1, x0:x1 + 1]
patch = np.dstack([rgb, (alpha * 255).astype(np.uint8)])
Image.fromarray(patch, 'RGBA').save(out, 'WEBP', quality=90, method=6)
print('PLACE x: %.3f, y: %.3f, w: %.3f' % (x0 / W * 100, y0 / H * 100, (x1 - x0 + 1) / W * 100))
