"""tools/art/keyflood.py: Gradient-aware chroma key: the backdrop's colour is estimated per row from both side edges, a pixel is backdrop if it is
near its row's colour or is bright saturated green, and only backdrop connected to the border is removed (a green garment
inside the outline stays). Soft 2 px edge, green spill pulled down at the edge."""
import sys, colorsys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
def key2(src, size=240, pad=0.94, key='green', despill='edge', nokeyhue=False):
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32); H, W, _ = im.shape
    edge = np.concatenate([im[:, :10], im[:, -10:]], axis=1); rowbg = np.median(edge, axis=1)  # H x 3
    rowbg = ndimage.uniform_filter1d(rowbg, 31, axis=0)
    d = np.sqrt(((im - rowbg[:, None, :]) ** 2).sum(-1))
    r, g, b = im[..., 0] / 255, im[..., 1] / 255, im[..., 2] / 255
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    if key == 'magenta':  # a magenta backdrop and its darker pink shadows: hue between violet and rose, saturated, any brightness
        hue = np.where(mx == r, ((g - b) / np.maximum(mx - mn, 1e-6)) % 6, np.where(mx == g, (b - r) / np.maximum(mx - mn, 1e-6) + 2, (r - g) / np.maximum(mx - mn, 1e-6) + 4)) * 60
        greenish = ((hue > 290) | (hue < 0)) & (hue < 350) & (s > 0.30) & (mx > 0.25) & (b - g > 0.08)
    else:
        greenish = (g >= r) & (g >= b) & (g - np.maximum(r, b) > 0.12) & (s > 0.40) & (mx > 0.50)
    hue_k = np.where(mx == r, ((g - b) / np.maximum(mx - mn, 1e-6)) % 6, np.where(mx == g, (b - r) / np.maximum(mx - mn, 1e-6) + 2, (r - g) / np.maximum(mx - mn, 1e-6) + 4)) * 60
    shade = ((hue_k > 285) & (hue_k < 350) & (s > 0.25) & (mx > 0.03)) if key == 'magenta' else ((hue_k > 70) & (hue_k < 170) & (s > 0.22) & (mx < 0.55)) if nokeyhue else np.zeros_like(greenish)  # magenta's own shadows, however dark; never for green, where it eats dark green cloth
    cand = (d < 70) | greenish | shade
    lab, n = ndimage.label(cand); border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # enclosed pockets of the backdrop (inside a hanger's triangle, between two shoes): bright saturated green regions not joined to the border
    hl, hn = ndimage.label(greenish & ~bg); hs = ndimage.sum(greenish & ~bg, hl, range(1, hn + 1))
    bg = bg | np.isin(hl, [i + 1 for i, z in enumerate(hs) if z > 40])
    bg = bg | (ndimage.binary_dilation(bg, iterations=1) & (d < 90))
    fg = ~bg; fg = ndimage.binary_opening(fg, iterations=1)
    lab2, n2 = ndimage.label(fg); sz = ndimage.sum(fg, lab2, range(1, n2 + 1)); keep = np.isin(lab2, [i + 1 for i, z in enumerate(sz) if z > 0.004 * sz.max()]) if n2 else fg
    a = ndimage.gaussian_filter(keep.astype(np.float32), 1.0)
    a = np.where(keep, np.maximum(a, 0.5), a * 0.6); a = np.clip((a - 0.15) / 0.85, 0, 1)
    rgb = im.copy(); edgeband = (a < 0.98) if despill == 'edge' else np.ones_like(a, dtype=bool)
    if key == 'magenta':  # pull magenta spill at the edge: red and blue down toward green
        lim = rgb[..., 1] + 12; rgb[..., 0] = np.where(edgeband & (rgb[..., 0] > lim) & (rgb[..., 2] > lim), np.minimum(rgb[..., 0], lim + 20), rgb[..., 0]); rgb[..., 2] = np.where(edgeband & (rgb[..., 0] > lim) & (rgb[..., 2] > lim), np.minimum(rgb[..., 2], lim), rgb[..., 2])
    else:
        m2 = np.maximum(rgb[..., 0], rgb[..., 2]); sp = edgeband & (rgb[..., 1] > m2 + 6); rgb[..., 1] = np.where(sp, m2 + 6, rgb[..., 1])
    img = Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA'); img = img.crop(Image.fromarray((a > 0.05).astype(np.uint8) * 255).getbbox())
    if size:
        w, h = img.size; sc = size * pad / max(w, h); img = img.resize((round(w * sc), round(h * sc)), Image.LANCZOS)
        c = Image.new('RGBA', (size, size), (0, 0, 0, 0)); c.paste(img, ((size - img.width) // 2, (size - img.height) // 2)); return c
    return img
if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; k = 'magenta' if '--magenta' in sys.argv else 'green'
    ds = 'all' if '--despill-all' in sys.argv else 'edge'
    for s_, d_ in zip(args[::2], args[1::2]): key2(s_, key=k, despill=ds).save(d_, 'WEBP', quality=88, method=6)
