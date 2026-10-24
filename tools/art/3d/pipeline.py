#!/usr/bin/env python3
"""Rhythme 3D pipeline on the Meshy API (24 Oct 2026): one outfit picture -> textured model (30K triangles, A-pose)
-> skeleton -> a few moves, downloaded as GLB. Guarded like every model batch here: one run at a time (lock file),
finished steps are skipped from the log, the first failure stops the whole run and is written to BLOCKED.json, and
nothing is retried automatically.
Usage: python3 pipeline.py <outfit> [<outfit> ...]      (outfit: base, cozy, gown, ...)"""
import base64, json, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, '..', '..', '..', 'assets', 'room', 'dream')
WORK = os.environ.get('MESHY_WORK', os.path.join(os.path.expanduser('~'), '.cache', 'rhythme-3d'))   # downloads and the run log stay outside the repo
os.makedirs(WORK, exist_ok=True)
OUT = os.path.join(WORK, 'out'); LOG = os.path.join(WORK, 'log.json'); LOCK = os.path.join(WORK, 'RUN.lock'); BLOCK = os.path.join(WORK, 'BLOCKED.json')
API = 'https://api.meshy.ai/openapi/v1/'
KEY = open(os.path.expanduser('~/.config/meshy/api_key')).read().strip()
MOVES = [0, 551, 278, 280, 1]   # idle, carry heavy object walk, pick fruit basket, crouch pick throw, walking woman
CAP_CREDITS = 80                 # per outfit; a run that would spend more stops

def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        raise RuntimeError('%s %s -> HTTP %s %s' % (method, path, e.code, e.read()[:300].decode('utf8', 'replace')))

def wait(kind, tid, limit=1200):
    t0 = time.time()
    while time.time() - t0 < limit:
        t = call('GET', '%s/%s' % (kind, tid))
        st = t.get('status')
        if st == 'SUCCEEDED': return t
        if st in ('FAILED', 'CANCELED'): raise RuntimeError('%s %s %s: %s' % (kind, tid, st, json.dumps(t.get('task_error'))[:300]))
        time.sleep(10)
    raise RuntimeError('%s %s timed out after %ss' % (kind, tid, limit))

def fetch(url, path):
    with urllib.request.urlopen(url, timeout=300) as r, open(path, 'wb') as f: f.write(r.read())
    return os.path.getsize(path)

def picture(outfit):
    from PIL import Image
    look = outfit.rsplit('-', 1)[0] if outfit.endswith(('-n', '-pbr')) else outfit
    name = 'avatar-base.webp' if look == 'base' else 'avatar-%s.webp' % look
    im = Image.open(os.path.join(ART, name)).convert('RGBA'); im = im.crop(im.getbbox())
    H = 1600; im = im.resize((int(im.width * H / im.height), H), Image.LANCZOS)
    c = Image.new('RGBA', (max(1200, im.width + 200), 1800), (0, 0, 0, 0)); c.alpha_composite(im, ((c.width - im.width) // 2, 100))
    p = os.path.join(OUT, outfit, 'source.png'); c.save(p)
    return 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()

def run(outfit, log):
    rec = log.setdefault(outfit, {}); os.makedirs(os.path.join(OUT, outfit), exist_ok=True); spent = rec.get('credits', 0)
    if not rec.get('model'):
        tid = call('POST', 'image-to-3d', {'image_url': picture(outfit), 'ai_model': 'latest', 'should_texture': True, 'should_remesh': True,
                                         'target_polycount': 200000 if outfit.endswith('-pbr') else 30000, 'topology': 'triangle', 'enable_pbr': outfit.endswith('-pbr'),
                                         'pose_mode': '' if outfit.endswith(('-n', '-pbr')) else 'a-pose'})['result']   # -pbr: natural pose, 200K, with normal/roughness maps for the folds   # -n: her natural pose, as the website made it (the A-pose run shifted her hair colour)
        rec['model_task'] = tid; save(log)
        t = wait('image-to-3d', tid); spent += t.get('consumed_credits', 0)
        fetch(t['model_urls']['glb'], os.path.join(OUT, outfit, 'model.glb'))
        if t.get('thumbnail_url'): fetch(t['thumbnail_url'], os.path.join(OUT, outfit, 'thumb.png'))
        rec['model'] = tid; rec['credits'] = spent; save(log)
    if spent > CAP_CREDITS: raise RuntimeError('%s spent %s credits, over the cap' % (outfit, spent))
    if not rec.get('rig'):
        tid = call('POST', 'rigging', {'input_task_id': rec['model'], 'height_meters': 1.0})['result']
        rec['rig_task'] = tid; save(log)
        t = wait('rigging', tid); spent += t.get('consumed_credits', 0)
        fetch(t['result']['rigged_character_glb_url'], os.path.join(OUT, outfit, 'rigged.glb'))
        rec['rig'] = tid; rec['credits'] = spent; save(log)
    if outfit.endswith('-pbr'): return spent   # pictures only: poses are set by hand in Blender
    for a in MOVES:
        k = 'move_%d' % a
        if rec.get(k): continue
        if spent + 3 > CAP_CREDITS: raise RuntimeError('%s would pass the credit cap' % outfit)
        tid = call('POST', 'animations', {'rig_task_id': rec['rig'], 'action_id': a})['result']
        t = wait('animations', tid); spent += t.get('consumed_credits', 0)
        fetch(t['result']['animation_glb_url'], os.path.join(OUT, outfit, 'move-%d.glb' % a))
        rec[k] = tid; rec['credits'] = spent; save(log)
    return spent

def save(log): json.dump(log, open(LOG, 'w'), indent=1)

if __name__ == '__main__':
    if os.path.exists(BLOCK): sys.exit('BLOCKED: ' + open(BLOCK).read())
    if os.path.exists(LOCK): sys.exit('another run holds the lock')
    os.makedirs(OUT, exist_ok=True); open(LOCK, 'w').write(str(os.getpid()))
    try:
        log = json.load(open(LOG)) if os.path.exists(LOG) else {}
        for o in sys.argv[1:]:
            print(o, 'credits', run(o, log), flush=True)
    except Exception as e:
        json.dump({'at': time.time(), 'error': str(e)}, open(BLOCK, 'w')); print('STOPPED:', e); sys.exit(1)
    finally:
        os.remove(LOCK)
