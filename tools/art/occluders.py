#!/usr/bin/env python3
"""Foreground cutouts for the wide Dream Street (docs/design/2026-10-19-wide-street.md, "Foreground cutouts").

The street plate is one flat image, so a pillar or a lamp drawn in it can never cover her. Each object she can walk
behind is cut out of the plate here as a small sprite that sits pixel-exact over the same plate pixels, and the walk
engine depth-sorts it by its base like any prop: her feet above the base, she is behind it; below, in front.

Each cutout is a GrabCut inside a hand outline (everything outside it is plate), seeded with a hand core that is
certainly the object. Above the cobbles a flowered pillar stands against the lavender sky, which GrabCut confuses with
the cream buds (the cobbles teach it that cream is background), so there anything inside the outline that is not
lavender joins the shape (sky: hue 240 to 320 degrees, saturation over 0.05). The result keeps the largest shape, is eroded 2 px so the edge sits just inside the silhouette,
and is feathered 2 px. The crop is saved as WebP at the plate's own pixels and the placement is printed in percent of
the box (x 0 to 250, y 0 to 100), ready for OCC in ovu-street.js.

  python3 tools/art/occluders.py [--plate assets/room/dream/street-wide-v1.webp] [--out assets/room/dream] [--check dir]

--check writes, for each cutout, the sprite over magenta and the plate with the cutout's edge drawn on it.
"""
import argparse
import json
import os


import cv2
import numpy as np
from PIL import Image, ImageDraw

SPAN = 2.5            # the plate is drawn 2.5 box widths wide
ERODE = 2             # px inside the silhouette
FEATHER = 1.0         # Gaussian sigma in px: the edge fades over about 2 px either side of the eroded line

# Box units throughout: x 0 to 250, y 0 to 100. outline: GrabCut never looks outside it. core: certainly the object.
# top: nothing above this line is cut (her head never reaches it: she is 12 wide and 21.7 tall, so standing at the
# back of the floor behind the garden arch her head is at y 36.8, behind the plaza arch at 46.8). base: the centre of
# the object's footprint on the cobbles, the y the walk engine ranks it by; each lies inside its solid in ovu-street.js.
# sky: above this y the background behind the object is lavender sky, so the hue rule applies.
OCC = [
    {'id': 'garden-arch', 'solid': 'arch', 'file': 'street-occ-arch.webp', 'base': 62.0, 'top': 31.0, 'sky': 57.0,
     'outline': [(20.2, 31), (36.0, 31), (34.6, 37), (34.0, 45), (34.0, 58), (33.6, 62), (32.6, 63.8), (21.8, 63.8), (20.2, 61), (20.0, 40)],
     'core': [[(25.2, 32.5), (30.6, 32.5), (30.0, 61.6), (24.6, 61.6)]]},
    {'id': 'lamp-west', 'solid': 'lamp', 'file': 'street-occ-lamp1.webp', 'base': 61.9, 'top': 28.6,
     'outline': [(72.6, 28.6), (75.3, 28.6), (76.5, 31.2), (78.5, 32.2), (78.5, 34.6), (77.7, 38.4), (76.2, 39.2), (76.1, 52.4),
                 (77.4, 55.5), (78.2, 60.2), (78.5, 63.4), (70.4, 63.4), (70.6, 60.2), (71.0, 55.5), (71.8, 52.4), (71.7, 39.2),
                 (70.2, 38.4), (69.4, 34.6), (69.4, 32.2), (71.4, 31.2)],
     'core': [[(73.4, 30.2), (74.4, 30.2), (74.4, 61.8), (73.4, 61.8)], [(72.2, 33.6), (75.6, 33.6), (75.6, 36.6), (72.2, 36.6)],
              [(72.4, 60.8), (76.6, 60.8), (76.6, 62.0), (72.4, 62.0)], [(72.6, 55.5), (75.6, 55.5), (75.8, 60.2), (72.4, 60.2)]]},
    {'id': 'lamp-east', 'solid': 'lamp', 'file': 'street-occ-lamp2.webp', 'base': 68.2, 'top': 33.4,
     'outline': [(148.9, 33.4), (151.4, 33.4), (152.7, 36.0), (155.0, 37.0), (155.0, 39.0), (154.0, 43.5), (152.2, 44.2), (152.0, 58.6),
                 (153.0, 61.2), (153.6, 66.4), (154.4, 67.2), (154.4, 69.8), (145.8, 69.8), (145.8, 67.2), (146.8, 66.4), (147.4, 61.2),
                 (148.4, 58.6), (148.2, 44.2), (146.4, 43.5), (145.2, 39.0), (145.2, 37.0), (147.6, 36.0)],
     'core': [[(149.7, 35.0), (150.6, 35.0), (150.6, 68.6), (149.7, 68.6)], [(148.0, 38.6), (152.2, 38.6), (152.2, 41.6), (148.0, 41.6)],
              [(147.6, 67.6), (152.6, 67.6), (152.6, 68.7), (147.6, 68.7)], [(148.8, 61.5), (151.4, 61.5), (151.8, 67.0), (148.4, 67.0)]]},
    {'id': 'plaza-arch', 'solid': 'arch', 'file': 'street-occ-arch2.webp', 'base': 77.0, 'top': 39.5, 'sky': 64.5,
     'outline': [(200.2, 39.5), (214.6, 39.5), (212.8, 46), (212.6, 60), (212.4, 64.5), (211.4, 66), (211.2, 79.8), (196.0, 79.8), (196.0, 66), (198.6, 62), (198.4, 43)],
     'core': [[(203.6, 41.0), (210.0, 41.0), (208.6, 77.4), (201.6, 77.4)]]},
]


def px(plate, x, y):
    w, h = plate.size
    return x * w / (100.0 * SPAN), y * h / 100.0


def poly_px(plate, pts):
    return np.array([px(plate, x, y) for x, y in pts], dtype=np.float64)


def cut(plate, rgb, o):
    w, h = plate.size
    out = poly_px(plate, o['outline'])
    x0, y0 = np.floor(out.min(axis=0)).astype(int) - 4
    x1, y1 = np.ceil(out.max(axis=0)).astype(int) + 4
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
    crop = np.ascontiguousarray(rgb[y0:y1, x0:x1, ::-1])  # BGR for OpenCV
    mask = np.full(crop.shape[:2], cv2.GC_BGD, np.uint8)
    cv2.fillPoly(mask, [np.round(out - (x0, y0)).astype(np.int32)], cv2.GC_PR_FGD)
    for c in o['core']:
        cv2.fillPoly(mask, [np.round(poly_px(plate, c) - (x0, y0)).astype(np.int32)], cv2.GC_FGD)
    cv2.setRNGSeed(7311)
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(crop, mask, None, bg, fg, 8, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    if o.get('sky'):
        inside = np.zeros_like(m)
        cv2.fillPoly(inside, [np.round(out - (x0, y0)).astype(np.int32)], 255)
        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        hue, sat = hsv[..., 0].astype(int) * 2, hsv[..., 1] / 255.0
        sky = (hue >= 240) & (hue <= 320) & (sat > 0.05)
        above = np.zeros_like(m, bool)
        above[:max(0, int(round(px(plate, 0, o['sky'])[1])) - y0)] = True
        warm = (inside > 0) & above & ~sky
        warm = cv2.morphologyEx(warm.astype(np.uint8) * 255, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        m = np.maximum(m, warm)
    # the largest shape only, with its holes filled
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    if n > 1:
        keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        m = np.where(lab == keep, 255, 0).astype(np.uint8)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    m = np.zeros_like(m)
    cv2.drawContours(m, cnts, -1, 255, -1)
    # nothing above the top line
    top = int(round(px(plate, 0, o['top'])[1])) - y0
    if top > 0:
        m[:top] = 0
    hard = m.copy()
    m = cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * ERODE + 1, 2 * ERODE + 1)))
    a = cv2.GaussianBlur(m.astype(np.float32), (0, 0), FEATHER)
    a = np.clip(np.round(a), 0, 255).astype(np.uint8)
    ys, xs = np.nonzero(a)
    bx0, by0, bx1, by1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    sprite = np.dstack([rgb[y0 + by0:y0 + by1, x0 + bx0:x0 + bx1], a[by0:by1, bx0:bx1]])
    ax, ay = x0 + bx0, y0 + by0
    sw, sh = bx1 - bx0, by1 - by0
    place = {'id': o['id'], 'solid': o['solid'], 'img': o['file'], 'x': round(ax * 100.0 * SPAN / w, 3), 'y': round(ay * 100.0 / h, 3),
             'w': round(sw * 100.0 * SPAN / w, 3), 'h': round(sh * 100.0 / h, 3), 'base': o['base']}
    return sprite, place, hard, (x0, y0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--plate', default='assets/room/dream/street-wide-v1.webp')
    ap.add_argument('--out', default='assets/room/dream')
    ap.add_argument('--check', default='')
    ap.add_argument('--lossless', action='store_true')
    a = ap.parse_args()
    plate = Image.open(a.plate).convert('RGB')
    rgb = np.asarray(plate)
    places = []
    for o in OCC:
        sprite, place, hard, (cx, cy) = cut(plate, rgb, o)
        im = Image.fromarray(sprite, 'RGBA')
        dest = os.path.join(a.out, o['file'])
        # exact keeps the colour under fully transparent pixels; lossless keeps every opaque pixel identical to the plate
        im.save(dest, 'WEBP', lossless=True, exact=True, method=6) if a.lossless else im.save(dest, 'WEBP', quality=94, alpha_quality=100, method=6, exact=True)
        back = np.asarray(Image.open(dest).convert('RGBA')).astype(int)
        opaque = back[..., 3] == 255
        diff = np.abs(back[..., :3] - sprite[..., :3].astype(int))[opaque]
        place['bytes'] = os.path.getsize(dest)
        place['maxdiff'] = int(diff.max()) if diff.size else 0
        place['meandiff'] = round(float(diff.mean()), 2) if diff.size else 0
        places.append(place)
        if a.check:
            os.makedirs(a.check, exist_ok=True)
            mag = Image.new('RGBA', im.size, (255, 0, 255, 255))
            mag.alpha_composite(im)
            mag.convert('RGB').resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(a.check, o['file'].replace('.webp', '-on-magenta.png')))
            ov = np.array(plate)
            x0 = int(round(place['x'] * plate.width / (100 * SPAN))); y0 = int(round(place['y'] * plate.height / 100))
            region = ov[y0 - 20:y0 + im.height + 20, x0 - 20:x0 + im.width + 20].copy()
            alpha = np.asarray(im)[..., 3]
            cnts, _ = cv2.findContours((alpha > 127).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            for c in cnts:
                cv2.drawContours(region, [c + (20, 20)], -1, (0, 200, 255), 1)
            Image.fromarray(region).resize((region.shape[1] * 3, region.shape[0] * 3), Image.NEAREST).save(os.path.join(a.check, o['file'].replace('.webp', '-edge.png')))
            # as if she stood right behind it: a dark shape over the whole outline, then the cutout on top. Any part of
            # the object the cutout misses shows dark; any plate it wrongly took shows light outside the object
            beh = Image.fromarray(np.array(plate)[y0 - 20:y0 + im.height + 20, x0 - 20:x0 + im.width + 20].copy()).convert('RGBA')
            sh = Image.new('L', beh.size, 0)
            ImageDraw.Draw(sh).polygon([(px(plate, x, y)[0] - x0 + 20, px(plate, x, y)[1] - y0 + 20) for x, y in o['outline']], fill=230)
            dark = Image.new('RGBA', beh.size, (40, 30, 110, 0)); dark.putalpha(sh)
            beh.alpha_composite(dark)
            beh.alpha_composite(im, (20, 20))
            beh.convert('RGB').resize((beh.width * 3, beh.height * 3), Image.LANCZOS).save(os.path.join(a.check, o['file'].replace('.webp', '-behind.png')))
    print(json.dumps(places, indent=1))


if __name__ == '__main__':
    main()
