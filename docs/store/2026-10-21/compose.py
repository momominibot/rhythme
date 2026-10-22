#!/usr/bin/env python3
"""App Store frames for Rhythme (iOS 1320x2868). One continuous sky runs behind every frame: frame i shows the i-th window
of the wide sky, so the set reads as one picture from first to last. Frame 1 is the hero (her palm up, the floating
logo); the rest hold real screenshots in a drawn phone with a two-line caption above. Fonts: Newsreader (titles), Manrope (body)."""
import sys, os, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)); ART = os.path.join(H, 'art'); OUT = os.path.join(H, 'frames'); os.makedirs(OUT, exist_ok=True)
W, HH = 1320, 2868
NEWS = os.path.join(H, 'fonts', 'Newsreader.ttf'); MANR = os.path.join(H, 'fonts', 'Manrope.ttf')
def font(path, size, weight=None):
    f = ImageFont.truetype(path, size)
    if weight is not None:
        try: f.set_variation_by_axes([weight])
        except Exception: pass
    return f
def sky_window(i, n):
    sky = Image.open(os.path.join(ART, 'sky.png')).convert('RGB')
    sh = HH; sw = round(sky.width * sh / sky.height); sky = sky.resize((sw, sh), Image.LANCZOS)
    span = sw - W; x = round(span * i / max(1, n - 1)); return sky.crop((x, 0, x + W, HH))
def draw_text(im, text, xy, f, fill, anchor='ma', shadow=True):
    d = ImageDraw.Draw(im)
    if shadow: d.text((xy[0], xy[1] + 3), text, font=f, fill=(90, 60, 120, 60), anchor=anchor)
    d.text(xy, text, font=f, fill=fill, anchor=anchor)
def hero_frame(i, n, title, sub):
    bg = sky_window(i, n).convert('RGBA')
    hero = Image.open(os.path.join(ART, 'hero-cut.png')).convert('RGBA')  # the character and her floating logo, cut from their own sky
    hw = 1150; hh = round(hero.height * hw / hero.width); hero = hero.resize((hw, hh), Image.LANCZOS)
    x = (W - hw) // 2; y = HH - hh + 40
    # a soft light behind her, so she sits in the sky rather than on it
    glow = Image.new('RGBA', (W, HH), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    gd.ellipse((x + 120, y + 160, x + hw - 120, y + hh - 60), fill=(255, 248, 252, 110)); glow = glow.filter(ImageFilter.GaussianBlur(140))
    bg.alpha_composite(glow); bg.alpha_composite(hero, (x, y))
    draw_text(bg, title, (W // 2, 330), font(NEWS, 160, 500), (74, 52, 102))
    draw_text(bg, sub, (W // 2, 520), font(MANR, 58, 500), (96, 76, 126))
    return bg.convert('RGB')
def rounded_mask(size, r):
    m = Image.new('L', size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=r, fill=255); return m
def phone_frame(i, n, shot, title, sub):
    """a real screenshot in a drawn phone, caption above, the phone running off the bottom edge; the sky continues from the last frame"""
    bg = sky_window(i, n).convert('RGBA')
    im = Image.open(os.path.join(H, 'shots', shot + '.png')).convert('RGB')
    sw = 1040; sh = round(im.height * sw / im.width); im = im.resize((sw, sh), Image.LANCZOS)
    bez = 22; r_screen = 74; x = (W - sw) // 2; y = 700
    # shadow
    sh_layer = Image.new('RGBA', (W, HH), (0, 0, 0, 0)); ImageDraw.Draw(sh_layer).rounded_rectangle((x - bez + 10, y - bez + 40, x + sw + bez + 10, y + sh + bez + 40), radius=r_screen + bez, fill=(70, 40, 110, 90))
    bg.alpha_composite(sh_layer.filter(ImageFilter.GaussianBlur(40)))
    # bezel and screen
    frame = Image.new('RGBA', (W, HH), (0, 0, 0, 0)); ImageDraw.Draw(frame).rounded_rectangle((x - bez, y - bez, x + sw + bez, y + sh + bez), radius=r_screen + bez, fill=(58, 46, 80, 255))
    bg.alpha_composite(frame)
    screen = im.convert('RGBA'); screen.putalpha(rounded_mask(screen.size, r_screen)); bg.alpha_composite(screen, (x, y))
    draw_text(bg, title, (W // 2, 300), font(NEWS, 112, 500), (74, 52, 102))
    # the sub line wraps at about 34 characters
    words = sub.split(); lines = []; cur = ''
    for wd in words:
        if len(cur) + len(wd) + 1 > 34 and cur: lines.append(cur); cur = wd
        else: cur = (cur + ' ' + wd).strip()
    if cur: lines.append(cur)
    for k, ln in enumerate(lines): draw_text(bg, ln, (W // 2, 455 + k * 72), font(MANR, 54, 500), (96, 76, 126))
    return bg.convert('RGB')
FRAMES = [
    ('hero', None, 'Rhythme', 'Your cycle, your room, your pace'),
    ('room', 'room', 'A room of your own', 'Log a period, a meal, a night. The room grows with you.'),
    ('sleep', 'bed', 'Sleep, noticed gently', 'Nights and details when you want them. Never a score.'),
    ('erin', 'morning', 'Erin’s morning, in her voice', 'Wake, brush, sip. One part or all three.'),
    ('world', 'harbour', 'A world to breathe in', 'Garden, farm, harbour. Fish you meet and let go.'),
    ('spring', 'cave', 'A hidden spring', 'A steady tone by the water. No voice, no claims.'),
    ('clinician', 'doctor', 'Notes for your clinician', 'Your last four weeks, shared only when you choose.'),
    ('yours', 'you', 'Your diary stays yours', 'On your phone first. Cloud backup only if you turn it on.'),
]
if __name__ == '__main__':
    n = len(FRAMES); outs = []
    for i, (name, shot, title, sub) in enumerate(FRAMES):
        im = hero_frame(i, n, title, sub) if shot is None else phone_frame(i, n, shot, title, sub)
        p = os.path.join(OUT, 'frame-%02d-%s.png' % (i + 1, name)); im.save(p); outs.append(p); print(p, im.size)
    # a preview strip, all frames side by side, so the continuous sky can be judged at a glance
    th = [Image.open(p).resize((330, 717)) for p in outs]
    strip = Image.new('RGB', (330 * len(th) + 12 * (len(th) + 1), 717 + 24), (250, 246, 252))
    for k, t in enumerate(th): strip.paste(t, (12 + k * 342, 12))
    strip.save(os.path.join(OUT, 'preview-strip.png')); print('strip', strip.size)
