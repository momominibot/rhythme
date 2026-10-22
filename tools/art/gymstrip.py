#!/usr/bin/env python3
"""Frames on chroma green into one normalised strip for the gym (ovu-gym.js), at her standing sprite's scale.

Usage: gymstrip.py OUT.webp --stand STAND.webp (--sheet SHEET.png --frames N | --images A.png B.png ...)
                   [--match height|head] [--from K] [--align canvas|head] [--contact contact.png]

- each frame is keyed with keyflood.py (the backdrop joined to the border goes; a mint top inside the outline stays);
- one scale for the whole strip: --match height makes frame K's figure as tall as the standing figure (a standing pose);
  --match head makes her head as wide as on the standing sprite (a seated pose, where the bike makes the box taller): the
  head is the widest row in the figure's top band, the band being 0.28 of her standing height at the frame's own scale;
- --align canvas keeps every frame where it was on its own canvas (edits of one picture: the bike and the dumbbell pairs, so
  the bike never jumps); --align head puts each frame's head on the cell's middle (a sheet of separate poses);
- feet (or the bike's base) on the strip's bottom edge; the sidecar .json carries frames, cell w and h, and the standing
  sprite's width and height, which ovu-gym.js STRIPS copies (test-core checks them). Nothing leaves the machine."""
import argparse, json, os, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from keyflood import key2  # noqa: E402
from walkcycle import columns, head_x  # noqa: E402

def alpha_box(img, t=24):
    a = np.asarray(img)[..., 3] > t; ys, xs = np.where(a)
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1) if len(ys) else None

def head_w(img, band_px):
    a = np.asarray(img)[..., 3] > 24; ys, xs = np.where(a)
    if not len(ys): return 0
    y0 = ys.min(); rows = a[y0:y0 + max(1, int(band_px))]
    w = [(np.where(r)[0].max() - np.where(r)[0].min() + 1) if r.any() else 0 for r in rows]
    return float(max(w))

def keyed(img, crop=True):
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        img.convert('RGB').save(f.name)
        try: return key2(f.name, size=None, crop=crop)
        finally: os.unlink(f.name)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out'); ap.add_argument('--stand', required=True)
    ap.add_argument('--sheet'); ap.add_argument('--frames', type=int, default=0); ap.add_argument('--images', nargs='*')
    ap.add_argument('--match', choices=['height', 'head'], default='height'); ap.add_argument('--from', dest='frm', type=int, default=0)
    ap.add_argument('--align', choices=['canvas', 'head'], default='head'); ap.add_argument('--contact'); ap.add_argument('--quality', type=int, default=86)
    a = ap.parse_args()
    stand = Image.open(a.stand).convert('RGBA'); sb = alpha_box(stand); stand_h = sb[3] - sb[1]
    srcs = []
    if a.sheet:
        sheet = Image.open(a.sheet).convert('RGB'); runs = columns(sheet)
        if len(runs) != a.frames: sys.exit('found %d frames, expected %d: %s' % (len(runs), a.frames, runs))
        for x0, x1 in runs: srcs.append(sheet.crop((max(0, x0 - 8), 0, min(sheet.width, x1 + 8), sheet.height)))
    else:
        srcs = [Image.open(p).convert('RGB') for p in a.images]
    frames = [keyed(s, crop=a.align != 'canvas') for s in srcs]
    boxes = [alpha_box(f) for f in frames]
    if a.match == 'height':
        s = stand_h / float(boxes[a.frm][3] - boxes[a.frm][1])
    else:
        sw = head_w(stand, 0.28 * stand_h); s = 1.0
        for _ in range(8): s = sw / max(1.0, head_w(frames[a.frm], 0.28 * stand_h / s))
    if a.align == 'canvas':  # one crop for all, so an unchanged bike stays put
        u = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        frames = [f.crop(u) for f in frames]
    else:
        frames = [f.crop(b) for f, b in zip(frames, boxes)]
    frames = [f.resize((max(1, round(f.width * s)), max(1, round(f.height * s))), Image.LANCZOS) for f in frames]
    W = int(max(f.width for f in frames) * 1.06) + 8; W += W % 2
    H = max(f.height for f in frames) + 2
    strip = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        if a.align == 'canvas': cx = f.width / 2.0
        else: bb = alpha_box(f); cx = head_x(f, bb)
        strip.paste(f, (int(round(i * W + W / 2.0 - cx)), H - f.height), f)
    strip.save(a.out, 'WEBP', quality=a.quality, method=6)
    meta = {'frames': len(frames), 'w': W, 'h': H, 'stand': os.path.basename(a.stand), 'standW': stand.width, 'standH': stand.height, 'match': a.match, 'scale': round(s, 4), 'align': a.align}
    json.dump(meta, open(os.path.splitext(a.out)[0] + '.json', 'w'))
    if a.contact:
        cs = Image.new('RGB', (strip.width, H + 20), (200, 190, 220)); cs.paste(strip, (0, 0), strip); d = ImageDraw.Draw(cs)
        for i in range(len(frames)): d.line([(i * W, 0), (i * W, H)], fill=(255, 0, 0)); d.text((i * W + 4, H + 4), str(i), fill=(60, 30, 90))
        cs.save(a.contact)
    print(json.dumps(meta))

if __name__ == '__main__': main()
