"""Kitchen art made locally from the app's own watercolour food pictures (no image model; 23 Oct 2026).

Staples: a cod fillet is the salmon fillet turned white, black olives are the blueberries turned olive-black.
Dishes: a soft watercolour plate with the dish's own ingredients arranged on it, so every new dish has a picture in
the same style as the rest. Run from the repo root: python3 tools/art/kitchen_art.py
"""
import colorsys, os
from PIL import Image, ImageDraw, ImageFilter

FOOD = 'assets/food'
S = 256

def load(name, size=None):
    im = Image.open(os.path.join(FOOD, name + '.webp')).convert('RGBA')
    return im.resize((size, size), Image.LANCZOS) if size else im.resize((S, S), Image.LANCZOS)

def recolour(im, fn):
    px = im.load(); w, h = im.size
    out = Image.new('RGBA', (w, h))
    po = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0: po[x, y] = (0, 0, 0, 0); continue
            po[x, y] = fn(r, g, b) + (a,)
    return out

def cod(r, g, b):
    # keep the line work (dark), lift the pink flesh to a cool cream white
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if l < 0.35: return (int(r * 0.55), int(g * 0.55), int(b * 0.6))
    nl = 0.80 + 0.17 * min(1, (l - 0.35) / 0.6)
    nr, ng, nb = colorsys.hls_to_rgb(0.11, nl, 0.18 * s + 0.05)
    return (int(nr * 255), int(ng * 255), int(nb * 255))

def olive(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    nr, ng, nb = colorsys.hls_to_rgb(0.20, max(0.07, l * 0.42), min(1, s * 0.45 + 0.12))
    return (int(nr * 255), int(ng * 255), int(nb * 255))

def plate():
    base = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(sh)
    d.ellipse((22, 160, 234, 232), fill=(120, 100, 130, 60))
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(6)))
    pl = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(pl)
    d.ellipse((14, 136, 242, 224), fill=(236, 214, 222, 255))
    d.ellipse((30, 144, 226, 214), fill=(253, 248, 243, 255))
    base.alpha_composite(pl.filter(ImageFilter.GaussianBlur(1.2)))
    return base

def put(canvas, im, size, cx, by):
    sm = im.resize((size, size), Image.LANCZOS)
    bb = sm.getbbox() or (0, 0, size, size)
    canvas.alpha_composite(sm, (int(cx - size / 2), int(by - bb[3])))

def dish(parts):
    c = plate()
    for name, size, cx, by in parts:
        put(c, name if isinstance(name, Image.Image) else load(name), size, cx, by)
    return c

def save(im, name):
    im.save(os.path.join(FOOD, name + '.webp'), 'WEBP', quality=90, method=6)

if __name__ == '__main__':
    codim = recolour(load('salmon'), cod); save(codim, 'staple-cod')
    olives = recolour(load('blueberries'), olive); save(olives, 'staple-olives')
    tom, lem = load('crop-tomato'), load('citrus')
    save(dish([(codim, 176, 128, 192), (tom, 104, 70, 212), (olives, 92, 188, 214)]), 'dish-codtomato')
    save(dish([(codim, 150, 104, 190), (tom, 100, 176, 202), (lem, 86, 84, 214), (load('crop-chilli'), 76, 182, 216)]), 'dish-fishkebabs')
    save(dish([(load('salmon'), 166, 128, 192), (load('ginger'), 92, 188, 212), (load('eggs'), 96, 66, 214)]), 'dish-salmoncroquettes')
    save(dish([(load('staple-tofu'), 150, 122, 192), (load('broccoli'), 110, 186, 210), (load('sesame-seeds'), 84, 66, 214)]), 'dish-tofusesame')
    save(dish([(load('eggs'), 160, 126, 192), (tom, 98, 64, 212), (load('crop-pumpkin'), 100, 190, 212)]), 'dish-frittata')
    save(dish([(load('chickpeas'), 160, 124, 192), (load('crop-carrot'), 104, 190, 212), (load('staple-garlic'), 88, 66, 214)]), 'dish-hummus')
    print('ok')
