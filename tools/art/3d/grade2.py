"""Match a render to her painted picture part by part (hair, skin, sweater, skirt, socks, shoes, eyes...): both images are
split into the same colour families by k-means on the painted picture's Lab colours, and within each family the render's
L, a and b are histogram-matched to the painted picture's, blended softly across family borders. Then a gentle clarity
(local contrast) for the clay gloss. python3 grade2.py <reference> <render.png> [k] -> <render>-g2.png"""
import sys, numpy as np
from PIL import Image, ImageFilter
from skimage import color
from scipy.cluster.vq import kmeans2

def lab_of(p):
    im = np.array(Image.open(p).convert('RGBA')).astype(float) / 255
    return im, color.rgb2lab(im[..., :3]), im[..., 3] > 0.8

def match_hist(src, ref):
    s_idx = np.argsort(src); r_sorted = np.sort(ref)
    q = (np.arange(len(src)) + 0.5) / len(src)
    out = np.empty_like(src); out[s_idx] = np.interp(q, (np.arange(len(ref)) + 0.5) / len(ref), r_sorted)
    return out

ref_p, ren_p = sys.argv[1], sys.argv[2]; K = int(sys.argv[3]) if len(sys.argv) > 3 else 7
rim, rlab, rm = lab_of(ref_p); gim, glab, gm = lab_of(ren_p)
bl = float(__import__('os').environ.get('BLOOM', '0'))
if bl:   # a soft glow, screen-blended, like the painted pictures' light; done before matching so colours are restored after
    base = Image.fromarray((gim[..., :3] * 255).astype('uint8')); glowim = np.array(base.filter(ImageFilter.GaussianBlur(14))).astype(float) / 255
    gim[..., :3] = 1 - (1 - gim[..., :3]) * (1 - glowim * bl); glab = color.rgb2lab(gim[..., :3])
np.random.seed(1); centres, _ = kmeans2(rlab[rm][::4], K, minit='++', seed=1)
# soft membership of each render pixel to each colour family (by distance to the family centre)
X = glab[gm]; d = np.stack([np.linalg.norm(X - c, axis=1) for c in centres], 1)
w = np.exp(-(d - d.min(1, keepdims=True)) / 6.0); w /= w.sum(1, keepdims=True)
hard = d.argmin(1); RR = rlab[rm]; rlabels = np.stack([np.linalg.norm(RR - c, axis=1) for c in centres], 1).argmin(1)
out = np.zeros_like(X)
for k in range(K):
    R = rlab[rm][rlabels == k]; S = hard == k
    if S.sum() < 50 or len(R) < 50:
        out += w[:, k:k + 1] * X; continue
    mk = X.copy()
    for ch in range(3):
        # map the whole render through this family's curve, fitted on the pixels that belong to it
        src = X[S, ch]; curve_x = np.sort(src); curve_y = match_hist(curve_x, R[:, ch])
        mk[:, ch] = np.interp(X[:, ch], curve_x, curve_y)
    out += w[:, k:k + 1] * mk
# chroma to her picture's: scale a and b so the mean colour strength of the covered pixels matches
rc = np.hypot(rlab[rm][:, 1], rlab[rm][:, 2]).mean(); oc = np.hypot(out[:, 1], out[:, 2]).mean()
out[:, 1:] *= rc / max(oc, 1e-6)
warm = float(__import__('os').environ.get('WARM', '0'))   # warmer: towards gold (Lab b), a touch of red (a)
out[:, 2] += warm; out[:, 1] += warm * 0.2
lab = glab.copy(); lab[gm] = out
rgb = np.clip(color.lab2rgb(lab), 0, 1)
img = Image.fromarray((np.dstack([rgb, gim[..., 3]]) * 255).round().astype('uint8'), 'RGBA')
# clarity: a broad unsharp mask lifts the soft gloss and the shading inside each part
rgbimg = img.convert('RGB').filter(ImageFilter.UnsharpMask(radius=18, percent=int(__import__("os").environ.get("CLARITY", "15")), threshold=2))
img = Image.merge('RGBA', (*rgbimg.split(), img.split()[3]))
img.save(ren_p.replace('.png', '-g2.png')); print('ok', K)
