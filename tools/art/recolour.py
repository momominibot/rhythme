#!/usr/bin/env python3
"""Masked hair recolour test for the avatar looks plan (docs/design/2026-10-19-avatar-looks.md, step 2).

Usage: recolour.py sprite.webp out.png --to black|honey|auburn|"#rrggbb" [--mask mask.png] [--band 0.45]

- the hair mask is every opaque pixel in the top `band` of the figure whose hue sits within a window of the sprite's
  own hair hue (measured as the commonest saturated colour in that band) and which is not skin (peach hues are kept);
  the mask is dilated one pixel and feathered so the edge stays soft;
- the recolour keeps each pixel's lightness and the highlight shape (value is preserved, with a gentle curve towards
  the target's own lightness) and replaces hue and saturation with the target's, so strands and shading survive;
- nothing outside the mask changes: the script asserts that and prints the mask coverage.
No key is used; nothing leaves the machine."""
import argparse, colorsys, sys
import numpy as np
from PIL import Image, ImageFilter

TARGETS = {"black": (20, 17, 22), "honey": (214, 168, 92), "auburn": (142, 62, 40), "chestnut": (96, 58, 40), "silver": (200, 200, 208)}

def rgb_to_hsv(a):
    r, g, b = a[..., 0] / 255.0, a[..., 1] / 255.0, a[..., 2] / 255.0
    mx = np.max(a[..., :3], axis=-1) / 255.0; mn = np.min(a[..., :3], axis=-1) / 255.0
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.where(m, d, 1), 0); gc = np.where(m, (mx - g) / np.where(m, d, 1), 0); bc = np.where(m, (mx - b) / np.where(m, d, 1), 0)
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2.0 + rc - bc, 4.0 + gc - rc))
    h = (h / 6.0) % 1.0
    h = np.where(m, h, 0)
    s = np.where(mx > 0, d / np.where(mx > 0, mx, 1), 0)
    return h, s, mx

def hair_hue(a, band):
    al = a[..., 3] > 200
    ys = np.where(al.any(axis=1))[0]; y0, y1 = ys.min(), ys.max()
    top = slice(y0, y0 + int((y1 - y0) * band))
    h, s, v = rgb_to_hsv(a[top].astype(np.float32))
    sel = al[top] & (s > 0.12) & (v > 0.15)
    hs = h[sel]; ss = s[sel]
    # skin is peach: hue 0.02 to 0.11 with moderate saturation; drop it before taking the mode
    keep = ~((hs > 0.02) & (hs < 0.11) & (ss < 0.55))
    hs = hs[keep]
    hist, edges = np.histogram(hs, bins=72, range=(0, 1))
    i = int(np.argmax(hist)); return (edges[i] + edges[i + 1]) / 2, (y0, y1)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sprite"); ap.add_argument("out")
    ap.add_argument("--to", required=True); ap.add_argument("--mask"); ap.add_argument("--band", type=float, default=0.45)
    ap.add_argument("--window", type=float, default=0.06, help="hue window (fraction of the circle) either side of the hair hue")
    a = ap.parse_args()
    im = Image.open(a.sprite).convert("RGBA"); arr = np.asarray(im).astype(np.float32)
    hue0, (y0, y1) = hair_hue(arr, a.band)
    h, s, v = rgb_to_hsv(arr)
    dh = np.abs(((h - hue0 + 0.5) % 1.0) - 0.5)
    al = arr[..., 3] > 0
    rows = np.zeros(arr.shape[0], bool); rows[y0:y0 + int((y1 - y0) * a.band)] = True
    skin = (h > 0.02) & (h < 0.11) & (s < 0.55) & (v > 0.55)
    cand = al & rows[:, None] & (dh < a.window) & (s > 0.10) & ~skin
    # the blush shares the hair's hue but sits in two small blobs inside the skin; the hair is one large connected mass
    # (bun, fringe and side locks touch), so keep only the big components, then fill the pale highlights they enclose
    try:
        from scipy import ndimage
        lab, n = ndimage.label(cand)
        if n:
            sizes = ndimage.sum(cand, lab, range(1, n + 1)); big = sizes.max()
            keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz >= 0.08 * big])
            keep = ndimage.binary_closing(keep, iterations=2)
            keep = ndimage.binary_fill_holes(keep) & al
            # a filled hole must not swallow the face: anything inside the face hue (skin) stays out
            mask = keep & ~skin
        else: mask = cand
    except Exception:
        mask = cand
    mimg = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    m = np.asarray(mimg).astype(np.float32) / 255.0 * al
    if a.mask: mimg.save(a.mask)
    tgt = TARGETS.get(a.to) or tuple(int(a.to.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    th, ts, tv = colorsys.rgb_to_hsv(tgt[0] / 255.0, tgt[1] / 255.0, tgt[2] / 255.0)
    # keep the original value (lightness) but pull its middle towards the target's lightness so black reads dark and honey light
    mid = np.clip(v, 0, 1)
    if tv < 0.3: v_new = np.clip(0.03 + 0.32 * mid ** 2.6, 0, 1)            # black: deep, with soft highlights
    elif tv < 0.6: v_new = np.clip(0.10 + 0.55 * mid ** 1.2, 0, 1)          # auburn, chestnut: mid-dark
    else: v_new = np.clip(0.30 + 0.62 * mid, 0, 1)                           # honey, silver: light
    s_new = np.clip(ts * (0.7 + 0.6 * s), 0, 1)
    out = arr.copy()
    hh = np.full_like(h, th)
    # hsv -> rgb vectorised
    i = np.floor(hh * 6).astype(int) % 6; f = hh * 6 - np.floor(hh * 6)
    p = v_new * (1 - s_new); q = v_new * (1 - s_new * f); t = v_new * (1 - s_new * (1 - f))
    r = np.choose(i, [v_new, q, p, p, t, v_new]); g = np.choose(i, [t, v_new, v_new, q, p, p]); b = np.choose(i, [p, p, t, v_new, v_new, q])
    rgb_new = np.stack([r, g, b], axis=-1) * 255.0
    out[..., :3] = arr[..., :3] * (1 - m[..., None]) + rgb_new * m[..., None]
    assert np.array_equal(out[..., :3][m == 0], arr[..., :3][m == 0]), "pixels outside the mask changed"
    Image.fromarray(out.round().astype(np.uint8), "RGBA").save(a.out)
    print("hair hue %.3f, mask covers %.1f%% of the figure, rows %d..%d" % (hue0, 100.0 * (m > 0.5).sum() / max(1, al.sum()), y0, y0 + int((y1 - y0) * a.band)))

if __name__ == "__main__": main()
