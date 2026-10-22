#!/usr/bin/env python3
"""Closed-eye frames for her blink, made locally (no model call). Each standing sprite gets a copy in which her two eyes are
filled from the skin around them and redrawn as a clean closed lid in her own lash colour; nothing else changes.

How (second version, 21 Oct 2026, after a Codex review found pale oval rings, a lash rim and stub on the tudung, crossed corner
lashes and a square cut across a blushed cheek in the first one):
- each eye is found from the violet of its iris and lash line; everything of the eye that is not skin (lash line, iris, whites,
  the lilac crease above, the thin lower rim) is masked by colour inside an ellipse around it, keeping only pieces that belong to
  the eye (hair and a headscarf reach into the ellipse from outside, so a piece mostly outside it is left alone);
- the mask is filled with a harmonic (membrane) fill: every masked pixel becomes the average of its neighbours, with the skin at
  the mask's edge held fixed and hair or the transparent background left out. The fill meets the skin exactly at the edge, so
  there is no ring, no flat patch and no square, and a blush that reaches the mask carries on into it;
- a lid is drawn at four times the size and scaled down: one tapered curve where the lids meet and two short lashes that fan
  outward from the outer corner, never crossing.
The result keeps the original's size and alpha exactly and is saved losslessly, so every pixel outside the eyes is the original.

usage: make_blink.py ART_DIR OUT_DIR [--debug DIR] [ids...]"""
import sys, os, json
import numpy as np, cv2
from PIL import Image, ImageDraw
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import spsolve
from skimage.color import rgb2lab

args = sys.argv[1:]
ART, OUT = args[0], args[1]; rest = args[2:]
DEBUG = None
if '--debug' in rest: k = rest.index('--debug'); DEBUG = rest[k + 1]; rest = rest[:k] + rest[k + 2:]
IDS = rest or ['base', 'cozy', 'gown', 'kebaya-blue', 'kebaya-green', 'kebaya-red', 'pajamas', 'party', 'sundress', 'tudung', 'yoga']
os.makedirs(OUT, exist_ok=True)
if DEBUG: os.makedirs(DEBUG, exist_ok=True)


def eye_clusters(rgba):
    """her two eyes: the violet of the irises and lash lines inside the face band, grouped into a left and a right cluster"""
    a = rgba.astype(np.float32) / 255; rgb, al = a[..., :3], a[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    H = rgba.shape[0]; band = np.zeros(al.shape, bool); band[int(H * 0.15):int(H * 0.34)] = True
    viol = (b > g + 0.10) & (r > g + 0.02) & (sat > 0.28) & (al > 0.9) & band
    n, lab_, stats, cent = cv2.connectedComponentsWithStats(viol.astype(np.uint8), 8)
    comps = sorted([(stats[i, cv2.CC_STAT_AREA], i) for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= 12], reverse=True)
    if len(comps) < 2: return None
    c1, c2 = cent[comps[0][1]][0], cent[comps[1][1]][0]; mid = (c1 + c2) / 2
    out = []
    for side in (0, 1):
        core = min(c1, c2) if side == 0 else max(c1, c2); m = np.zeros(al.shape, bool)
        for area, i in comps:
            cx = cent[i][0]
            if (cx < mid) != (side == 0) or abs(cx - core) > 40: continue
            m |= lab_ == i
        ys, xs = np.nonzero(m)
        out.append({'viol': m, 'box': (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)})
    return sorted(out, key=lambda e: e['box'][0])


def harmonic_fill(img, unknown, known):
    """every unknown pixel becomes the mean of its usable neighbours (unknown or known); known pixels are held fixed;
    anything else (hair, the background, the other eye) is left out of the average"""
    H, W = unknown.shape; ys, xs = np.nonzero(unknown); idx = -np.ones((H, W), np.int64); idx[ys, xs] = np.arange(len(ys))
    A = lil_matrix((len(ys), len(ys))); rhs = np.zeros((len(ys), img.shape[2]))
    for k, (y, x) in enumerate(zip(ys, xs)):
        n = 0
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            yy, xx = y + dy, x + dx
            if not (0 <= yy < H and 0 <= xx < W): continue
            if unknown[yy, xx]: A[k, idx[yy, xx]] = -1; n += 1
            elif known[yy, xx]: rhs[k] += img[yy, xx]; n += 1
        A[k, k] = max(n, 1)
    sol = spsolve(A.tocsr(), rhs)
    out = img.copy(); out[ys, xs] = sol.reshape(len(ys), -1); return out


def tapered(d, pts, w0, w1, wmid, S, col):
    """a stroke along pts whose width runs w0 -> wmid -> w1, drawn as one polygon (clean edges, no overlapping caps)"""
    pts = np.array(pts, np.float64); n = len(pts); left, right = [], []
    for k in range(n):
        p = pts[k]; q = pts[min(k + 1, n - 1)] - pts[max(k - 1, 0)]; q = q / (np.hypot(*q) or 1); nx, ny = -q[1], q[0]
        t = k / (n - 1); base = w0 + (w1 - w0) * t; wd = (base + (wmid - base) * np.sin(np.pi * t)) / 2   # half-width: the ends' widths, swelling to wmid in the middle
        left.append(((p[0] + nx * wd) * S, (p[1] + ny * wd) * S)); right.append(((p[0] - nx * wd) * S, (p[1] - ny * wd) * S))
    d.polygon(left + right[::-1], fill=col)


def make(id_):
    src = os.path.join(ART, 'avatar-%s.webp' % id_)
    rgba = np.array(Image.open(src).convert('RGBA')); H, W = rgba.shape[:2]
    E = eye_clusters(rgba)
    if not E: return {'id': id_, 'ok': False, 'why': 'eyes not found'}
    rgb = rgba[..., :3].astype(np.float64); lab = rgb2lab(rgb / 255.0); Lc, ac, bc = lab[..., 0], lab[..., 1], lab[..., 2]
    chroma = np.hypot(ac, bc); opaque = rgba[..., 3] > 250
    (lx0, ly0, lx1, ly1), (rx0, ry0, rx1, ry1) = E[0]['box'], E[1]['box']
    bridge = lab[min(ly0, ry0):max(ly1, ry1), lx1 + 3:rx0 - 3].reshape(-1, 3)   # the skin between the eyes
    sL, sa, sb = np.median(bridge, 0)
    # not skin: lilac and violet (low yellow), the whites and highlights, dark rims and lashes; a blush (red, still yellow) is skin
    hue = np.degrees(np.arctan2(bc, ac))
    # not skin, by hue rather than closeness to one skin colour (pale skin lower on the face is still skin): skin and blush sit
    # near 30 to 60 degrees; the lilac crease, the violet iris and lash line and pink hair sit below, and hair is paler; the whites and their
    # grey shadow have almost no colour, or are lighter than skin and paler; the drawn outline of hair or a headscarf is very dark
    hairpink = (chroma > 5) & (hue >= 8) & (hue < 32) & (chroma < 26) & (Lc > 55) & opaque   # pink hair: never part of an eye, wherever it reaches
    notskin = (((chroma > 5) & ((hue < 26) | ((hue < 34) & (chroma < 20)))) | (bc < 3) | (chroma < 6) | ((Lc > sL + 3) & (chroma < 8)) | (Lc < 45)) & opaque   # a blush and the reddish shadow hair casts on skin are redder but stronger than pink hair: skin
    lash_rgb = []; mask = np.zeros((H, W), bool); lids = []; away = np.zeros((H, W), bool); hairall = np.zeros((H, W), bool)
    for e in E:
        x0, y0, x1, y1 = e['box']; w, h = x1 - x0, y1 - y0; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        lim = np.zeros((H, W), np.uint8)   # the eye with its lash flick and the crease above it
        cv2.ellipse(lim, (int(round(cx)), int(round(cy))), (int(round(w / 2 * 1.32 + 4)), int(round(h / 2 * 1.42 + 4))), 0, 0, 360, 255, -1)
        dirx = -1 if e is E[0] else 1   # her lash line ends in a flick past the outer corner, a little above the middle
        cv2.ellipse(lim, (int(round(cx + dirx * (w / 2 * 1.32 + 2))), int(round(cy - 0.12 * h))), (int(round(0.22 * w + 3)), int(round(0.24 * h + 3))), 0, 0, 360, 255, -1)
        big = cv2.dilate(lim, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
        n, lb, st, _ = cv2.connectedComponentsWithStats((notskin & (big > 0)).astype(np.uint8), 8)
        keep = np.zeros((H, W), bool)
        for k in range(1, n):
            comp = lb == k; inside = (comp & (lim > 0)).sum()
            if inside >= 2 and inside >= 0.6 * comp.sum(): keep |= comp   # mostly inside the eye's ellipse: hers, not hair or scarf
            elif (comp & e['viol']).any(): keep |= comp & (lim > 0)        # the lash line itself, cut where it meets anything outside
        core = np.zeros((H, W), np.uint8); cv2.ellipse(core, (int(round(cx)), int(round(cy))), (int(round(w / 2 * 1.12 + 1)), int(round(h / 2 * 1.12 + 1))), 0, 0, 360, 255, -1)
        # hair: a pink piece reaching well outside the eye is a strand (a small pink piece inside it, the lower lid's rim, is hers)
        # pink right beside a dark or violet line is the soft fringe of a lash or an iris, not hair, so it never links an eye to hair
        darkviol = ((Lc < 60) | (bc < 3) | ((chroma > 5) & (hue < 8))) & opaque
        hpc = hairpink & ~(cv2.dilate(darkviol.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & (big > 0)
        hn_, hlb, hst, _ = cv2.connectedComponentsWithStats(hpc.astype(np.uint8), 8)
        hair = np.zeros((H, W), bool)
        for k in range(1, hn_):
            comp = hlb == k; out_ = (comp & ~(lim > 0)).sum()
            if out_ > 40 or out_ >= 0.5 * (comp & (lim > 0)).sum(): hair |= comp
        for _ in range(3):   # a pink piece lying close to a strand (cut off by a shading line) is that strand too
            near_h = cv2.dilate(hair.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0
            add = np.isin(hlb, np.unique(hlb[near_h & hpc])) & (hlb > 0) & ~hair
            if not add.any(): break
            hair |= add
        hair = (hair | (hairpink & (cv2.dilate(hair.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~(cv2.dilate(darkviol.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) )) & (core == 0)
        # the lash line: dark pixels joined to the violet of the iris through dark pixels (a strand's outline never is); its soft
        # pink edge is hers, even where it meets a scarf
        dk_n, dk_l = cv2.connectedComponents((((Lc < 60) & opaque) | e['viol']).astype(np.uint8) & (lim > 0).astype(np.uint8), connectivity=8)
        lashline = np.isin(dk_l, np.unique(dk_l[e['viol'] & (lim > 0)])) & (dk_l > 0)
        hair &= ~(cv2.dilate(lashline.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0)
        hairall |= hair
        keep &= ~hair
        keep |= notskin & (core > 0)   # inside the eye itself everything not skin is hers, even where it touches hair or a scarf outline
        near = cv2.dilate(keep.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))) > 0
        for k in range(1, n):   # small pieces just past the eye (a lower lash at the outer corner, a fleck of the crease) are hers too
            comp = lb == k
            if not (comp & keep).any() and st[k, cv2.CC_STAT_AREA] <= 60 and (comp & near).any(): keep |= comp
        keep &= cv2.dilate(lim, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0   # nothing well outside the eye's ellipse is hers (a shaded strand of hair can look like skin)
        foreign = (notskin & ~keep) | hair   # hair, a headscarf, their outlines: not skin and not part of the eye, never filled
        m = cv2.morphologyEx(keep.astype(np.uint8) * 255, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        ff = m.copy(); mm = np.zeros((H + 2, W + 2), np.uint8); cv2.floodFill(ff, mm, (0, 0), 255); m = m | cv2.bitwise_not(ff)   # holes (the iris highlight) filled
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        # the soft shading that rings an open eye (the socket above the lash line, the shadow under the whites, the pale rim of the
        # lower lid) goes too, so the fill is held by plain skin: pixels next to the eye that are darker or lighter than the skin
        # between the eyes, grown out step by step while they stay so, and never far past the eye
        ring = (cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))) > 0) & (cv2.dilate(lim, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) > 0)
        below = np.zeros((H, W), bool); below[int(cy):] = True
        shade = ring & opaque & (np.abs(Lc - sL) > 4.5) & (Lc > sL - 22) & ~(below & (ac > sa + 6) & (bc > sb - 2)) & ~(cv2.dilate(foreign.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0)   # the socket's shadow and the lower lid's pale rim; not the blush, and never the shadow hair casts beside it
        rim = ring & opaque & (Lc > sL + 4) & ~hair & (cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0)   # the lower lid's pale rim at the eye's own edge, even beside hair (a cast shadow is darker, so it stays)
        for _ in range(4): m = np.where((shade | rim) & (cv2.dilate(m, np.ones((3, 3), np.uint8)) > 0), 255, m).astype(np.uint8)
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0   # and three pixels more, into clean skin
        m &= ~((cv2.dilate(foreign.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~keep)   # never into a headscarf or a foreign line: a pixel of her own skin is left beside them, so the fill is held by skin
        hn, hl, hs, _ = cv2.connectedComponentsWithStats((~m).astype(np.uint8), 4)
        for k in range(1, hn):   # a speck the mask closes around (a lash end left as a hole by the hair margin) goes too
            if hs[k, cv2.CC_STAT_AREA] <= 16: m |= hl == k
        away |= foreign
        mask |= m
        ys, xs = np.nonzero(m)
        dark = m & (Lc < sL - 30)
        lash_rgb.append(rgb[dark]) if dark.any() else None
        # where the lids meet: across the eye at the middle of the iris, from just inside the inner corner to the outer corner
        # measured on the eye itself (its iris and lash line), never on the mask, which can reach towards the hair
        vy, vx = np.nonzero(e['viol']); iy = np.median(vy); out_ = -1 if e is E[0] else 1; xin, xout = (x1, x0) if out_ < 0 else (x0, x1)
        lids.append({'outer': out_, 'xa': xin - out_ * 0.10 * w, 'xb': xout - out_ * 0.06 * w, 'y': iy + 0.06 * h, 'w': w, 'h': h})
    lash = np.concatenate(lash_rgb); lum = lash @ np.array([0.3, 0.59, 0.11]); lash = lash[lum <= np.percentile(lum, 25)].mean(0)
    # fixed: the skin around the mask; hair, scarf and background next to the mask are left out of the average
    known = opaque & ~mask & ~away   # the skin around the eye holds the fill; hair, a headscarf and the background are left out of the average
    mn, mlb = cv2.connectedComponents(mask.astype(np.uint8), connectivity=4)
    held = cv2.dilate(known.astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)) > 0
    for k in range(1, mn):   # a patch with no skin around it to hold a fill is left exactly as it was
        if not (held & (mlb == k)).any(): mask &= mlb != k
    def solvable(mask, known):   # a patch with no skin around it to hold a fill is left exactly as it was
        mn, mlb = cv2.connectedComponents(mask.astype(np.uint8), connectivity=4)
        held = cv2.dilate(known.astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)) > 0
        for k in range(1, mn):
            if not (held & (mlb == k)).any(): mask = mask & (mlb != k)
        return mask
    filled = harmonic_fill(rgb, mask, known)
    # a sweep along the edge: a pixel just outside the mask that stands out from the skin filled next to it (a white of the
    # eye left beside hair, the pale rim of the lower lid) joins the mask and the fill runs again; hair never does
    for _ in range(6):
        mf = mask.astype(np.float64); flab = rgb2lab(np.clip(filled, 0, 255) / 255.0)
        den = cv2.GaussianBlur(mf, (0, 0), 2.0); ref = np.stack([cv2.GaussianBlur(flab[..., c] * mf, (0, 0), 2.0) for c in range(3)], -1) / np.maximum(den, 1e-6)[..., None]
        ring5 = (cv2.dilate(mask.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) > 0) & ~mask & opaque & (den > 0.05) & ~hairall
        nearhair = cv2.dilate(hairall.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) > 0
        white = (Lc > sL + 3) & (chroma < 7)   # a white of the eye: hair is never this colourless, so it goes even right beside hair
        rem = ring5 & (np.sqrt(((lab - ref) ** 2).sum(-1)) > 7) & (Lc > sL - 15) & (~nearhair | white)   # pale or lilac leftovers; a dark line by hair is its outline and stays
        if not rem.any(): break
        mask |= (cv2.dilate(rem.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0) & ~hairall & opaque
        known = opaque & ~mask & ~away; mask = solvable(mask, known)
        filled = harmonic_fill(rgb, mask, known)
    if not np.isfinite(filled).all(): return {'id': id_, 'ok': False, 'why': 'the fill did not solve'}
    out = rgba.copy(); out[..., :3] = np.clip(np.round(filled), 0, 255).astype(np.uint8)
    pim = Image.fromarray(out, 'RGBA')
    S = 4; layer = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    col = tuple(int(round(v)) for v in lash) + (255,)
    for L_ in lids:
        xa, xb, y, h, w = L_['xa'], L_['xb'], L_['y'], L_['h'], L_['w']; sag = 0.085 * h
        pts = [(xa + (xb - xa) * t, y + sag * 4 * t * (1 - t) - 0.02 * h * t) for t in np.linspace(0, 1, 48)]   # a soft downward bow, its outer end a touch higher
        tapered(d, pts, 0.8, 1.6, max(2.6, 0.06 * h), S, col)
        ox, oy = pts[-1]; dx = L_['outer']; ix, iy_ = pts[-7]
        tapered(d, [(ox - dx * 0.4, oy), (ox + dx * 0.075 * w, oy + 0.01 * h), (ox + dx * 0.12 * w, oy + 0.045 * h)], 1.4, 0.35, 1.2, S, col)   # the outer lash, out and a little down
        tapered(d, [(ix, iy_ + 0.2), (ix + dx * 0.035 * w, iy_ + 0.07 * h), (ix + dx * 0.06 * w, iy_ + 0.12 * h)], 1.3, 0.3, 1.1, S, col)        # a shorter one before it, more down: the two fan out
    layer = layer.resize((W, H), Image.LANCZOS)
    pim.alpha_composite(layer)
    res = np.array(pim); res[..., 3] = rgba[..., 3]
    Image.fromarray(res, 'RGBA').save(os.path.join(OUT, 'avatar-%s-blink.webp' % id_), 'WEBP', lossless=True, method=6)
    back = np.array(Image.open(os.path.join(OUT, 'avatar-%s-blink.webp' % id_)).convert('RGBA'))
    reach = cv2.dilate(mask.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0   # the lid's soft edge may touch a pixel or two past the mask
    outside = (np.abs(back[..., :3].astype(int) - rgba[..., :3].astype(int)).sum(-1) > 0) & ~reach & (rgba[..., 3] > 0)   # visible pixels only: the encoder may rewrite colour under full transparency
    rep = {'id': id_, 'ok': True, 'boxes': [e['box'] for e in E], 'masked_px': int(mask.sum()), 'changed_outside': int(outside.sum()), 'alpha_same': bool((back[..., 3] == rgba[..., 3]).all()), 'size': [W, H], 'lash': [int(v) for v in lash]}
    if DEBUG:
        ov = rgba[..., :3].copy(); ov[mask] = (ov[mask] * 0.4 + np.array([0, 200, 255]) * 0.6).astype(np.uint8); ov[known & (cv2.dilate(mask.astype(np.uint8), np.ones((3, 3))) > 0) & ~mask] = [0, 255, 0]
        Image.fromarray(ov).save(os.path.join(DEBUG, 'mask-%s.png' % id_))
    return rep


rep = [make(i) for i in IDS]
if DEBUG: json.dump(rep, open(os.path.join(DEBUG, 'report.json'), 'w'), indent=1)   # never into the art folder
for r in rep: print(r)
