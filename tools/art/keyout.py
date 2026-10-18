#!/usr/bin/env python3
"""Chroma-key a green-screen render to a trimmed RGBA sprite with edge despill.
Usage: keyout.py in.png out.png [--preview preview.png] [--pad 8] [--height 900]
Alpha comes from distance to the key colour in a chroma-ish space, so soft hair
edges keep partial transparency instead of a hard halo."""
import sys, argparse
import numpy as np
from PIL import Image, ImageFilter

def key(img, tol_lo=0.18, tol_hi=0.42):
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # "greenness": how much green exceeds the other two channels
    green = g - np.maximum(r, b)
    # alpha: 0 where strongly green, 1 where not green at all
    alpha = np.clip((tol_hi - green) / (tol_hi - tol_lo), 0, 1)
    # kill saturated pure-green noise pixels fully
    alpha[(g > 0.75) & (r < 0.45) & (b < 0.45)] = 0
    # despill: cap green to the max of red/blue on semi-transparent edges and
    # slightly inside the matte so hair edges do not glow green
    spill = np.clip(g - np.maximum(r, b), 0, 1)
    g2 = g - spill * np.clip(1.0 - alpha * 0.4, 0, 1)
    out = np.stack([r, g2, b, alpha], axis=-1)
    return Image.fromarray((out * 255).round().astype(np.uint8), "RGBA")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inp"); ap.add_argument("out")
    ap.add_argument("--preview"); ap.add_argument("--pad", type=int, default=8)
    ap.add_argument("--height", type=int, default=0, help="downscale so content height equals this")
    ap.add_argument("--lo", type=float, default=0.18); ap.add_argument("--hi", type=float, default=0.42)
    ap.add_argument("--largest", action="store_true", help="keep only the largest opaque shape (drops shaded floor and corner noise)")
    a = ap.parse_args()
    img = Image.open(a.inp)
    rgba = key(img, a.lo, a.hi)
    if a.largest:
        from scipy import ndimage
        arr = np.asarray(rgba).copy(); al = arr[..., 3]
        lab, n = ndimage.label(al > 128)
        if n:
            sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); keep = lab == (int(np.argmax(sizes)) + 1)
            keep = ndimage.binary_fill_holes(keep); keep = ndimage.binary_dilation(keep, iterations=3)
            arr[..., 3] = np.where(keep, al, 0)
            rgba = Image.fromarray(arr, "RGBA")
    # soften alpha a touch to avoid aliasing, then trim
    alpha = rgba.split()[3].filter(ImageFilter.GaussianBlur(0.6))
    rgba.putalpha(alpha)
    bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        l, t, r, b = bbox
        rgba = rgba.crop((max(0, l - a.pad), max(0, t - a.pad), min(rgba.width, r + a.pad), min(rgba.height, b + a.pad)))
    if a.height and rgba.height > a.height:
        w = round(rgba.width * a.height / rgba.height)
        rgba = rgba.resize((w, a.height), Image.LANCZOS)
    rgba.save(a.out, optimize=True)
    if a.preview:
        # side by side on light lilac and deep plum to inspect fringes
        pw = rgba.width * 2 + 30
        prev = Image.new("RGBA", (pw, rgba.height + 20), (247, 242, 250, 255))
        prev.paste((42, 31, 61, 255), (rgba.width + 20, 0, pw, rgba.height + 20))
        prev.alpha_composite(rgba, (10, 10)); prev.alpha_composite(rgba, (rgba.width + 20, 10))
        prev.convert("RGB").save(a.preview)
    print({"out": a.out, "size": rgba.size, "bbox": bbox})

if __name__ == "__main__":
    main()
