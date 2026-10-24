"""Rhea's 3D walk strips (24 Oct 2026): Meshy's preset walk (Walking_Woman, id 1) on her repaired base-pbr rig, rendered by
render.py at 8 frames over one step cycle per direction, then fitted like the painted strips: one scale per direction so
her height matches the 3D standing picture, feet on the cell's floor, the render's own sway kept (one camera per
direction), the side view mirrored to face right. python3 build_walk3d.py <meshy dir> <app root>"""
import sys, os, json, subprocess
import numpy as np
from PIL import Image, ImageOps
M, APP = sys.argv[1], sys.argv[2]
ART = os.path.join(APP, 'assets/room/dream'); OUT = os.path.join(ART, '3d')
stand = Image.open(os.path.join(OUT, 'avatar-base.webp')).convert('RGBA'); sb = stand.getbbox(); stand_h = sb[3] - sb[1]
H, FLOOR, TARGET = 720, sb[3], stand_h * 0.995
CELL = {'side': 346, 'towards': 308, 'away': 312}
SRC = {'side': ('sb-65', True), 'towards': ('towards', False), 'away': ('away', False)}
for d, (src, mirror) in SRC.items():
    fr = [Image.open(os.path.join(M, 'out/walk3d-%s/f%02d.png' % (src, i))).convert('RGBA') for i in range(8)]
    if mirror: fr = [ImageOps.mirror(f) for f in fr]
    boxes = [f.getbbox() for f in fr]; hs = sorted(b[3] - b[1] for b in boxes); s = TARGET / hs[len(hs) // 2]
    ux0, uy1 = min(b[0] for b in boxes), max(b[3] for b in boxes); ux1 = max(b[2] for b in boxes)
    cw = max(CELL[d], int((ux1 - ux0) * s) + 12)
    strip = Image.new('RGBA', (cw * 8, H), (0, 0, 0, 0)); heights = []
    for i, f in enumerate(fr):
        g = f.resize((round(f.width * s), round(f.height * s)), Image.LANCZOS)
        ox = round(cw / 2 - (ux0 + ux1) / 2 * s); oy = round(FLOOR - uy1 * s)
        cell = Image.new('RGBA', (cw, H), (0, 0, 0, 0)); cell.alpha_composite(g, (ox, oy)) if ox >= 0 and oy >= 0 else cell.paste(g, (ox, oy), g)
        bb = cell.getbbox(); heights.append(bb[3] - bb[1]); strip.alpha_composite(cell, (i * cw, 0))
    raw = os.path.join(M, 'walk3d-strip-%s.png' % d); strip.save(raw)
    env = dict(os.environ, WARM='4', BLOOM='0.3')
    subprocess.run([sys.executable, os.path.join(M, 'grade2.py'), os.path.join(ART, 'avatar-base.webp'), raw], check=True, env=env)
    graded = Image.open(raw.replace('.png', '-g2.png')).convert('RGBA')
    graded.save(os.path.join(OUT, 'avatar-walk-base-%s.webp' % d), 'WEBP', quality=90, method=6)
    json.dump({'frames': 8, 'w': cw, 'h': H, 'stand': 'avatar-base.webp', 'heights': heights, 'standW': stand.width, 'source': 'Meshy Walking_Woman (1) on base-pbr rigged-fixed, render.py yaw %s' % ({'sb-65': '-65 mirrored', 'towards': '-10', 'away': '180'}[src])},
              open(os.path.join(OUT, 'avatar-walk-base-%s.json' % d), 'w'))
    print(d, 'cell', cw, 'scale', round(s, 3), 'heights', heights)
