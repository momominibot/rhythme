"""Fit a keyed character onto her standing canvas so the two read the same height (villagers, 22 Oct 2026).

Her standing sprites are 318 x 720 with the figure 712 px tall and 4 px of air above and below. A character fitted the
same way and drawn at the layout's avatarW reads exactly her height. A wider pose (a basket on an arm) keeps the height
and gets a wider canvas; the script prints wk = canvas width / 318, the factor the page multiplies avatarW by.

It also traces the figure's outline (alpha > 40, dilated 5 px, simplified) as a CSS polygon in canvas percent, checks
that every opaque pixel is inside it, and prints it: the page clips the picture to it so only the figure takes a tap.

usage: python3 tools/art/fit_figure.py <keyed.png> <out.webp> [--flip]
       python3 tools/art/fit_figure.py --trace <sprite.webp>...   (outline only, for sprites already on her canvas)
"""
import json, sys
import cv2
import numpy as np
from PIL import Image

H, FIG, PAD, BASE_W, MARGIN = 720, 712, 4, 318, 4


def fit(src, out, flip=False):
    im = Image.open(src).convert('RGBA')
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > 40)
    fig = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    s = FIG / fig.height
    fw = round(fig.width * s)
    fig = fig.resize((fw, FIG), Image.LANCZOS)
    W = max(BASE_W, fw + 2 * MARGIN)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(fig, ((W - fw) // 2, H - PAD - FIG))
    canvas.save(out, 'WEBP', quality=92, method=6)
    return dict(trace(canvas), out=out)


def trace(canvas):
    """the outline: every opaque pixel inside, as little of the empty canvas as is easy"""
    K = np.array(canvas.convert('RGBA')); H, W = K.shape[:2]
    m = (K[..., 3] > 40).astype(np.uint8) * 255
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    ap = cv2.approxPolyDP(c, 4.0, True)[:, 0, :]
    pct = lambda v, n: ('%.1f' % (v / n * 100)).rstrip('0').rstrip('.')
    poly = ','.join('%s%% %s%%' % (pct(x, W), pct(y, H)) for x, y in ap)
    pm = np.zeros((H, W), np.uint8)
    cv2.fillPoly(pm, [ap.astype(np.int32)], 255)
    miss = int(((K[..., 3] > 40) & (pm == 0)).sum())
    ys, xs = np.where(K[..., 3] > 40)
    return {'size': [W, H], 'wk': round(W / BASE_W, 3), 'figure': [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
            'opaque_outside_outline': miss, 'canvas_inside_outline': round(float(pm.mean() / 255), 3), 'points': len(ap), 'outline': poly}


if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    if '--trace' in sys.argv:
        print(json.dumps({a: trace(Image.open(a)) for a in args}, indent=1))
    else:
        print(json.dumps(fit(args[0], args[1], '--flip' in sys.argv), indent=1))
