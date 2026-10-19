#!/usr/bin/env python3
"""Slice a chroma-green walk-cycle sheet (one row of frames) into a normalised sprite strip.

Usage: walkcycle.py sheet.png out.webp --stand assets/room/dream/avatar-base.webp [--frames 8] [--contact contact.png]
       [--match height|head] [--ratio 1.0] [--centre head|box]

- frames are found as runs of non-green columns separated by green gaps (at least 8 px wide);
- each frame is keyed with the same greenness matte and despill as keyout.py (largest shape kept);
- the sheet is scaled once: with --match height (her walks) the median frame is as tall as the standing figure; with
  --match head (the pets) the median frame's head band is as wide as the sitting sprite's, because a walking cat is lower
  and longer than a sitting one but keeps its head; --ratio scales that result;
- each frame's feet sit on the strip's bottom edge; --centre head puts the head centre on the cell's middle (so she does
  not bob sideways), --centre box centres the frame's box (a walking quadruped keeps its length);
- the strip is frames x W wide and H tall (H is the stand image's height, or taller if a frame needs it); the sidecar
  .json carries the frame count, cell size, and a head anchor per frame and for the stand sprite (cell pixels), so a worn
  piece can ride on a walking pet; --contact writes a labelled contact sheet for a quick visual check.
No key is used here; nothing leaves the machine."""
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageDraw

def greenness(rgb):
    a = rgb.astype(np.float32) / 255.0
    return a[..., 1] - np.maximum(a[..., 0], a[..., 2])

def key(img, lo=0.18, hi=0.42):
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    green = g - np.maximum(r, b)
    alpha = np.clip((hi - green) / (hi - lo), 0, 1)
    alpha[(g > 0.75) & (r < 0.45) & (b < 0.45)] = 0
    spill = np.clip(g - np.maximum(r, b), 0, 1)
    g2 = g - spill * np.clip(1.0 - alpha * 0.4, 0, 1)
    out = np.stack([r, g2, b, alpha], axis=-1)
    return Image.fromarray((out * 255).round().astype(np.uint8), "RGBA")

def largest(rgba, thresh=40):
    """keep only the biggest connected blob of alpha (drops stray specks)"""
    from scipy import ndimage  # optional; fall back to the whole matte if scipy is missing
    a = np.asarray(rgba)
    mask = a[..., 3] > thresh
    lab, n = ndimage.label(mask)
    if n <= 1: return rgba
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    keep = lab == (int(np.argmax(sizes)) + 1)
    out = a.copy(); out[..., 3] = np.where(keep, out[..., 3], 0)
    return Image.fromarray(out, "RGBA")

def columns(sheet, gap=8, thresh=0.25):
    """[(x0, x1)] runs of columns that hold something that is not chroma green"""
    g = greenness(np.asarray(sheet.convert("RGB")))
    solid = (g < thresh).any(axis=0)
    runs, start = [], None
    for x, s in enumerate(solid):
        if s and start is None: start = x
        if not s and start is not None:
            if x - start > 2: runs.append([start, x])
            start = None
    if start is not None: runs.append([start, len(solid)])
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < gap: merged[-1][1] = r[1]
        else: merged.append(r)
    return merged

def bbox(rgba, thresh=24):
    a = np.asarray(rgba)[..., 3] > thresh
    ys, xs = np.where(a)
    if not len(ys): return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1

def head_x(rgba, box, frac=0.3):
    a = np.asarray(rgba)[..., 3].astype(np.float32)
    x0, y0, x1, y1 = box; h = max(1, int((y1 - y0) * frac))
    part = a[y0:y0 + h, x0:x1]
    xs = np.arange(x0, x1, dtype=np.float32)
    w = part.sum(axis=0)
    return float((xs * w).sum() / max(1e-6, w.sum()))

def head_band(rgba, box, frac=0.35, thresh=24):
    """the head as the box of alpha in the upper band of the figure: centre x, the band's bottom as y, and its width.
    The same rule on the sitting sprite and on every frame makes the anchors comparable."""
    a = np.asarray(rgba)[..., 3] > thresh
    x0, y0, x1, y1 = box; h = max(1, int((y1 - y0) * frac))
    sub = a[y0:y0 + h, x0:x1]
    yy, xx = np.where(sub)
    if not len(yy): return {"x": (x0 + x1) / 2, "y": y0 + h, "w": x1 - x0}
    return {"x": float(x0 + (xx.min() + xx.max() + 1) / 2), "y": float(y0 + yy.max() + 1), "w": float(xx.max() + 1 - xx.min())}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet"); ap.add_argument("out")
    ap.add_argument("--stand", required=True, help="the standing or sitting sprite the walk must match")
    ap.add_argument("--frames", type=int, default=8)
    ap.add_argument("--contact")
    ap.add_argument("--quality", type=int, default=85)
    ap.add_argument("--match", choices=["height", "head"], default="height")
    ap.add_argument("--ratio", type=float, default=1.0, help="scale on top of the match (0.9 makes the walk a little smaller)")
    ap.add_argument("--centre", choices=["head", "box"], default="head")
    a = ap.parse_args()
    sheet = Image.open(a.sheet).convert("RGB")
    stand = Image.open(a.stand).convert("RGBA")
    sb = bbox(stand); stand_h = sb[3] - sb[1]; stand_w = stand.width; H = stand.height
    stand_head = head_band(stand, sb)
    runs = columns(sheet)
    g = greenness(np.asarray(sheet.convert("RGB"))); density = (g < 0.25).sum(axis=0)
    while len(runs) < a.frames:  # two frames touching at the feet: split the widest run at its thinnest column
        i = max(range(len(runs)), key=lambda k: runs[k][1] - runs[k][0]); x0, x1 = runs[i]
        third = (x1 - x0) // 3; seg = density[x0 + third:x1 - third]
        cut = x0 + third + int(np.argmin(seg))
        runs[i:i + 1] = [[x0, cut], [cut, x1]]
        print("split a merged run at x=%d" % cut, file=sys.stderr)
    if len(runs) > a.frames:
        print("found %d frames, expected %d: %s" % (len(runs), a.frames, runs), file=sys.stderr)
        runs = sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:a.frames]; runs.sort()
    frames = []
    for x0, x1 in runs:
        pad = 6
        crop = sheet.crop((max(0, x0 - pad), 0, min(sheet.width, x1 + pad), sheet.height))
        k = key(crop)
        try: k = largest(k)
        except Exception: pass
        b = bbox(k)
        if not b: sys.exit("empty frame at %d..%d" % (x0, x1))
        frames.append((k, b))
    heights = [b[3] - b[1] for _, b in frames]
    if a.match == "head":
        widths = [head_band(k, b)["w"] for k, b in frames]
        s = stand_head["w"] / float(sorted(widths)[len(widths) // 2])  # the median frame's head as wide as the sitting head
    else:
        s = stand_h / float(sorted(heights)[len(heights) // 2])  # one scale for the whole sheet: the median frame matches the standing figure
    s *= a.ratio
    scaled = []
    for k, b in frames:
        img = k.crop(b).resize((max(1, round((b[2] - b[0]) * s)), max(1, round((b[3] - b[1]) * s))), Image.LANCZOS)
        bb = bbox(img) or (0, 0, img.width, img.height)
        cx = head_x(img, bb) if a.centre == "head" else (bb[0] + bb[2]) / 2.0
        scaled.append((img, cx, head_band(img, bb)))
    W = int(max(img.width for img, _, _ in scaled) * 1.12) + 8
    W += W % 2
    H = max(H, max(img.height for img, _, _ in scaled) + 2)
    strip = Image.new("RGBA", (W * len(scaled), H), (0, 0, 0, 0))
    heads = []
    for i, (img, cx, hb) in enumerate(scaled):
        ox = int(round(i * W + W / 2 - cx)); oy = H - img.height
        strip.paste(img, (ox, oy), img)
        heads.append({"x": round(ox - i * W + hb["x"], 1), "y": round(oy + hb["y"], 1), "w": round(hb["w"], 1)})
    strip.save(a.out, "WEBP", quality=a.quality, method=6)
    meta = {"frames": len(scaled), "w": W, "h": H, "stand": os.path.basename(a.stand), "heights": [int(h) for h in heights], "standW": int(stand_w), "standH": int(stand.height),
            "match": a.match, "ratio": a.ratio, "scale": round(s, 4), "heads": heads, "standHead": {k: round(v, 1) for k, v in stand_head.items()}}
    with open(os.path.splitext(a.out)[0] + ".json", "w") as f: json.dump(meta, f)
    if a.contact:
        cs = Image.new("RGB", (W * len(scaled), H + 24), (200, 190, 220)); cs.paste(strip, (0, 0), strip)
        d = ImageDraw.Draw(cs)
        for i in range(len(scaled)):
            d.line([(i * W, 0), (i * W, H)], fill=(255, 0, 0)); d.text((i * W + 4, H + 4), str(i), fill=(60, 30, 90))
            hd = heads[i]; d.ellipse([(i * W + hd["x"] - 4, hd["y"] - 4), (i * W + hd["x"] + 4, hd["y"] + 4)], outline=(0, 120, 255), width=2)
        d.line([(0, H - 1), (cs.width, H - 1)], fill=(255, 0, 0))
        cs.save(a.contact)
    print(json.dumps(meta))

if __name__ == "__main__": main()
