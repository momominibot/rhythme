#!/usr/bin/env python3
"""Closed-eye frames for her blink, made locally (no model call): each standing sprite gets a copy whose two eyes are filled
with the skin around them (OpenCV inpainting) and redrawn as a soft closed lid in her own lash colour. Only the eye areas
change, so the swap during a blink never moves anything else.
usage: make_blink.py ART_DIR OUT_DIR [ids...]"""
import sys, os, json
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFilter

ART, OUT = sys.argv[1], sys.argv[2]
IDS = sys.argv[3:] or ['base', 'cozy', 'gown', 'kebaya-blue', 'kebaya-green', 'kebaya-red', 'pajamas', 'party', 'sundress', 'tudung', 'yoga']
os.makedirs(OUT, exist_ok=True)

def lab(rgb):
    return cv2.cvtColor(rgb.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2LAB).reshape(rgb.shape).astype(np.float32)

def eye_boxes(rgba):
    """her two eyes: the violet of the irises and lash lines (blue and red above green) inside the face band, grouped
    into a left and a right cluster, each widened to take in the whites and the upper lash line"""
    a = rgba.astype(np.float32) / 255; rgb, al = a[..., :3], a[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    H = rgba.shape[0]; y0b, y1b = int(H * 0.17), int(H * 0.34)
    band = np.zeros(al.shape, bool); band[y0b:y1b] = True
    viol = (b > g + 0.10) & (r > g + 0.02) & (sat > 0.28) & (al > 0.9) & band
    n, lab_, stats, cent = cv2.connectedComponentsWithStats(viol.astype(np.uint8), 8)
    comps = [(stats[i, cv2.CC_STAT_AREA], i) for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= 12]
    if len(comps) < 2: return None
    comps.sort(reverse=True)
    c1, c2 = cent[comps[0][1]][0], cent[comps[1][1]][0]
    mid = (c1 + c2) / 2
    boxes = []
    for side in (0, 1):
        xs0, ys0, xs1, ys1 = 1e9, 1e9, -1, -1
        for area, i in comps:
            cx = cent[i][0]
            if (cx < mid) != (side == 0): continue
            if abs(cx - (min(c1, c2) if side == 0 else max(c1, c2))) > 40: continue
            x, y, w, h = stats[i, :4]
            xs0, ys0, xs1, ys1 = min(xs0, x), min(ys0, y), max(xs1, x + w), max(ys1, y + h)
        w, h = xs1 - xs0, ys1 - ys0
        boxes.append((int(xs0 - 0.30 * w), int(ys0 - 0.42 * h), int(xs1 + 0.30 * w), int(ys1 + 0.30 * h)))  # the whites, the lash line above and the lower iris below
    return sorted(boxes)

def make(id_):
    src = os.path.join(ART, 'avatar-%s.webp' % id_)
    im = Image.open(src).convert('RGBA'); rgba = np.array(im)
    B = eye_boxes(rgba)
    if not B: return {'id': id_, 'ok': False, 'why': 'eyes not found'}
    (lx0, ly0, lx1, ly1), (rx0, ry0, rx1, ry1) = B
    # skin: the strip between the eyes, level with them (the bridge of the nose)
    bx0, bx1 = lx1 + 2, rx0 - 2; by0, by1 = int(min(ly0, ry0) + 0.25 * (ly1 - ly0)), int(max(ly1, ry1) - 0.2 * (ly1 - ly0))
    patch = rgba[by0:by1, bx0:bx1, :3].reshape(-1, 3)
    skin = np.median(patch, 0) if len(patch) else np.array([245, 222, 205])
    hsv = cv2.cvtColor(rgba[..., :3], cv2.COLOR_RGB2HSV).astype(np.int32); Hh, Ss, Vv = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    violet = (Hh >= 118) & (Hh <= 168) & (Ss >= 14)          # irises, lash lines, the lilac lower iris and the pale crease above
    white = (Ss < 34) & (Vv > 205)                          # the whites and the highlights
    dark = (Vv < 160) & ~((Hh < 18) | (Hh > 168))          # rims and lashes, never the blush
    blush = ((Hh < 18) | (Hh > 168)) & (Ss > 42)            # cheek blush and skin shadows stay as they are
    eyeish = (violet | white | dark) & ~blush
    mask = np.zeros(rgba.shape[:2], np.uint8)
    for (x0, y0, x1, y1) in B:
        sub = (eyeish[y0:y1, x0:x1]).astype(np.uint8) * 255
        sub = cv2.morphologyEx(sub, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        n, lab_, st, ce = cv2.connectedComponentsWithStats(sub, 8)
        keep = np.zeros_like(sub)
        if n > 1:
            big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); keep[lab_ == big] = 255
        ff = keep.copy(); h_, w_ = ff.shape; m2 = np.zeros((h_ + 2, w_ + 2), np.uint8); cv2.floodFill(ff, m2, (0, 0), 255)
        keep = keep | cv2.bitwise_not(ff)
        mask[y0:y1, x0:x1] = np.maximum(mask[y0:y1, x0:x1], keep)
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2)
    vi = rgba[mask > 0][:, :3].astype(np.float32); lum = vi @ np.array([0.3, 0.59, 0.11])
    lash = vi[lum <= np.percentile(lum, 5)].mean(0)
    # the whole eye goes under one soft ellipse of her skin, a touch darker near the top for the closed lid; blush pixels
    # inside it are kept, and the edge is feathered into the face
    ell = np.zeros(rgba.shape[:2], np.uint8)
    for (x0, y0, x1, y1) in B:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + 0.02 * (y1 - y0)
        cv2.ellipse(ell, (int(round(cx)), int(round(cy))), (int(round((x1 - x0) / 2 * 1.10)), int(round((y1 - y0) / 2 * 1.08))), 0, 0, 360, 255, -1)
    # every eye-coloured piece touching an eye's ellipse goes too (lash ends and corner flicks are often separate pieces)
    near = cv2.dilate(ell, np.ones((9, 9), np.uint8), iterations=1)
    n_, lab2, st2, ce2 = cv2.connectedComponentsWithStats((eyeish & (near > 0)).astype(np.uint8), 8)
    for k_ in range(1, n_):
        if st2[k_, cv2.CC_STAT_AREA] >= 3: ell[lab2 == k_] = 255
    ell = np.where(blush, 0, ell).astype(np.uint8)
    ell = np.maximum(ell, mask)                         # anything eye-coloured the ellipse missed goes too
    yy = np.arange(rgba.shape[0], dtype=np.float32)[:, None]
    shade = np.ones(rgba.shape[:2], np.float32)
    for (x0, y0, x1, y1) in B:
        t = np.clip((yy - y0) / max(1, (y1 - y0)), 0, 1)
        band = np.zeros(rgba.shape[:2], bool); band[y0:y1 + 1, x0:x1 + 1] = True
        shade = np.where(band, 0.955 + 0.045 * np.broadcast_to(t, shade.shape), shade)
    # each eye takes the skin just around it (a ring outside its ellipse, without blush or anything eye-coloured)
    fillrgb = np.zeros(rgba.shape[:2] + (3,), np.float32) + skin.astype(np.float32)[None, None, :]
    for (x0, y0, x1, y1) in B:
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        ring = np.zeros(rgba.shape[:2], np.uint8)
        ax, ay = int(round((x1 - x0) / 2 * 1.30)), int(round((y1 - y0) / 2 * 1.26))
        cv2.ellipse(ring, (int(round(cx)), int(round(cy))), (ax, ay), 0, 0, 360, 255, -1)
        inner = np.zeros_like(ring); cv2.ellipse(inner, (int(round(cx)), int(round(cy))), (int(round((x1 - x0) / 2 * 1.10)), int(round((y1 - y0) / 2 * 1.10))), 0, 0, 360, 255, -1)
        sel = (ring > 0) & (inner == 0) & ~blush & ~eyeish & (rgba[..., 3] > 240)
        hsv_s = Ss[sel]; vv = Vv[sel]
        pick = rgba[..., :3][sel][(hsv_s > 25) & (hsv_s < 90) & (vv > 170)]
        if len(pick) > 20:
            local = np.median(pick.astype(np.float32), 0)
            box = np.zeros(rgba.shape[:2], bool); box[max(0, y0 - 4):y1 + 5, max(0, x0 - 4):x1 + 5] = True
            fillrgb[box] = local
    fillrgb = fillrgb * shade[..., None]
    fm = cv2.GaussianBlur(cv2.dilate(ell, np.ones((3, 3), np.uint8), iterations=1).astype(np.float32) / 255, (0, 0), 3.2)[..., None]  # a softer edge, so the eye's own shading never reads as a ring
    orig = rgba[..., :3].astype(np.float32)
    filled = cv2.cvtColor((fillrgb * fm + orig * (1 - fm)).clip(0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
    out = rgba.copy(); out[..., :3] = cv2.cvtColor(filled, cv2.COLOR_BGR2RGB)
    pim = Image.fromarray(out, 'RGBA')
    S = 4; big = Image.new('RGBA', (pim.width * S, pim.height * S), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    col = tuple(int(v) for v in lash) + (255,)
    for side, (x0, y0, x1, y1) in zip((-1, 1), B):
        w, h = x1 - x0, y1 - y0
        ya = y0 + 0.55 * h; sag = 0.11 * h; xa, xb = x0 + 0.16 * w, x1 - 0.16 * w
        pts = []
        for k in range(61):
            t = k / 60; X = xa + (xb - xa) * t; Y = ya + sag * 4 * t * (1 - t)
            pts.append((X, Y))
        for k in range(60):
            t = (k + 0.5) / 60; wd = (0.35 + 0.65 * np.sin(np.pi * t)) * max(2.4, 0.058 * h)
            (xA, yA), (xB, yB) = pts[k], pts[k + 1]
            d.line([(xA * S, yA * S), (xB * S, yB * S)], fill=col, width=max(1, int(round(wd * S))))
        ox, oy = pts[0] if side < 0 else pts[-1]; dx = -1 if side < 0 else 1
        for (lx, ly) in [(0.08, -0.05), (0.065, 0.04)]:
            d.line([(ox * S, oy * S), ((ox + dx * lx * w) * S, (oy + ly * h) * S)], fill=col, width=max(1, int(1.4 * S)))
    big = big.filter(ImageFilter.GaussianBlur(S * 0.45)).resize(pim.size, Image.LANCZOS)
    pim.alpha_composite(big)
    res = np.array(pim); res[..., 3] = rgba[..., 3]
    # lossless, so every pixel outside the eyes stays exactly what the browser shows for the original (lossy re-encoding
    # shimmered the kebayas' batik during a blink)
    Image.fromarray(res, 'RGBA').save(os.path.join(OUT, 'avatar-%s-blink.webp' % id_), 'WEBP', lossless=True, method=6)
    changed = int((np.abs(res[..., :3].astype(int) - rgba[..., :3].astype(int)).sum(-1) > 6).sum())
    return {'id': id_, 'ok': True, 'boxes': B, 'changed_px': changed, 'lash': [int(v) for v in lash], 'skin': [int(v) for v in skin]}

rep = [make(i) for i in IDS]
json.dump(rep, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)
for r in rep: print(r)
