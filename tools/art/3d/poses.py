#!/usr/bin/env python3
"""Every room pose of Rhea in her sweater, as a 3D model made from that pose's own painted picture (24 Oct 2026, Jamie:
"try all actions in the room first, show it to me before we mass produce"). Still pictures only: no skeleton, so nothing
bends or stretches. One guarded run: lock, finished poses skipped, submitted together (Meshy allows parallel tasks), the
first failure stops the run and writes BLOCKED.json, a credit cap, no automatic retry."""
import json, os, sys, time
import pipeline as P

POSES = ['act-bed', 'act-coffee', 'act-dishes', 'act-eat', 'act-listen', 'act-note', 'act-outfit', 'act-pets', 'act-phone',
         'act-plants', 'act-press', 'act-read', 'act-scale', 'act-shop', 'act-shower', 'act-stretch-base', 'act-teeth',
         'act-tend', 'act-wave', 'meditate', 'sleeping']
CAP = 800

def create(name):
    return P.call('POST', 'image-to-3d', {'image_url': P.picture(name), 'ai_model': 'latest', 'should_texture': True, 'enable_pbr': True,
                                          'should_remesh': True, 'target_polycount': 200000, 'topology': 'triangle', 'pose_mode': ''})['result']

if __name__ == '__main__':
    if os.path.exists(P.BLOCK): sys.exit('BLOCKED: ' + open(P.BLOCK).read())
    if os.path.exists(P.LOCK): sys.exit('another run holds the lock')
    open(P.LOCK, 'w').write(str(os.getpid()))
    try:
        log = json.load(open(P.LOG)) if os.path.exists(P.LOG) else {}
        spent = sum(v.get('credits', 0) for k, v in log.items() if k.startswith('pose:'))
        todo = [p for p in POSES if not log.get('pose:' + p, {}).get('model')]
        if spent + 35 * len(todo) > CAP: raise RuntimeError('would pass the credit cap: %d spent, %d to do' % (spent, len(todo)))
        tasks = {}
        for p in todo:
            os.makedirs(os.path.join(P.OUT, p), exist_ok=True)
            rec = log.setdefault('pose:' + p, {})
            tasks[p] = rec.get('task') or create(p); rec['task'] = tasks[p]; P.save(log)
        pending = dict(tasks)
        while pending:
            time.sleep(15)
            for p, tid in list(pending.items()):
                t = P.call('GET', 'image-to-3d/' + tid); st = t.get('status')
                if st in ('FAILED', 'CANCELED'): raise RuntimeError('%s %s: %s' % (p, st, json.dumps(t.get('task_error'))[:200]))
                if st == 'SUCCEEDED':
                    P.fetch(t['model_urls']['glb'], os.path.join(P.OUT, p, 'model.glb'))
                    rec = log['pose:' + p]; rec['model'] = tid; rec['credits'] = t.get('consumed_credits', 0); P.save(log)
                    del pending[p]; print('done', p, flush=True)
        print('all poses done, credits', sum(v.get('credits', 0) for k, v in log.items() if k.startswith('pose:')))
    except Exception as e:
        json.dump({'at': time.time(), 'error': 'poses: ' + str(e)}, open(P.BLOCK, 'w')); print('STOPPED:', e); sys.exit(1)
    finally:
        os.remove(P.LOCK)
