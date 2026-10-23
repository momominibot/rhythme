#!/usr/bin/env python3
"""Rhythme staff review worker: runs on Jamie's Mac, started every 15 s by the LaunchAgent com.rhythme.review-worker.

One `--once` pass: reconcile anything left from a failed pass, then ask the server for a queued review. With one, run
the five stages in order (cycle, sleep, food, mind, orchestrator), each as exactly one `codex exec` call on that stage's
released aggregates, and post each report. Design and house rules: docs/design/2026-10-23-review-worker-on-refresh.md.

Never: a retry, a second model or account, a test call to see whether a limit lifted, a model call while blocked.
Standard library only.

Files (all under ~/.local/state/rhythme-worker unless RHYTHME_WORKER_STATE is set):
  lock/          one pass at a time (holds the pid)
  attempt.json   written before a model call, removed after its outcome is known; found on start = the pass died mid-call
  pending.json   a failure not yet recorded on the server; sent before anything else
  BLOCKED.json   the server block this worker is waiting on; removed only when the server shows that block cleared
Config: ~/.config/rhythme/worker.json {"url": ..., "anon_key": ...} and ~/.config/rhythme/worker_key (600).
"""
import json, os, re, signal, subprocess, sys, tempfile, threading, time, urllib.error, urllib.request, hashlib

PROMPT_V = 'review-prompt-1'
SCHEMA_V = 'review-schema-1'
MODEL = os.environ.get('RHYTHME_WORKER_MODEL', 'gpt-6-astra')
CODEX = os.environ.get('RHYTHME_CODEX', 'codex')
STATE = os.path.expanduser(os.environ.get('RHYTHME_WORKER_STATE', '~/.local/state/rhythme-worker'))
CONF = os.path.expanduser(os.environ.get('RHYTHME_WORKER_CONF', '~/.config/rhythme/worker.json'))
KEYFILE = os.path.expanduser(os.environ.get('RHYTHME_WORKER_KEYFILE', '~/.config/rhythme/worker_key'))
STAGE_TIMEOUT = float(os.environ.get('RHYTHME_STAGE_TIMEOUT', '240'))
BEAT_EVERY = float(os.environ.get('RHYTHME_BEAT_EVERY', '30'))
MAX_OUT = 64 * 1024
MAX_STDOUT = 1024 * 1024
ORDER = ['cycle', 'sleep', 'food', 'mind', 'orchestrator']
DISABLE = ['shell_tool', 'unified_exec', 'apps', 'browser_use', 'browser_use_external', 'computer_use', 'memories', 'plugins',
           'multi_agent', 'hooks', 'skill_search', 'tool_suggest', 'sleep_tool', 'goals', 'code_mode_host']
LIMIT = re.compile(r"hit your usage limit|You've hit|rate_limit_exceeded|insufficient_quota|usage_limit_reached|exceeded your current quota", re.I)
TOOL_ITEMS = {'command_execution', 'file_change', 'mcp_tool_call', 'web_search', 'collab_tool_call'}

NAMES = {'cycle': 'Bloom, who keeps the period and symptom days', 'sleep': 'Dozy, who counts the recorded nights',
         'food': 'Pudding, who keeps the meal days and tags', 'mind': 'Misty, who keeps the practice days and minutes',
         'orchestrator': 'Nimbus, who reads the four reports and ranks what they propose'}


class Stop(Exception):
    """the server ended the job (held run, switch off, lease lost): not a provider failure, nothing to record"""


class Fail(Exception):
    """a failure that must stop the job and be recorded as a block; .code is one of the server's fixed codes"""
    def __init__(self, code):
        super().__init__(code); self.code = code


# ---------- files ----------
def path(name):
    return os.path.join(STATE, name)


def read_json(name):
    try:
        with open(path(name)) as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def write_json(name, obj):
    os.makedirs(STATE, exist_ok=True)
    tmp = path(name + '.tmp')
    with open(tmp, 'w') as f:
        json.dump(obj, f); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, path(name))


def remove(name):
    try:
        os.remove(path(name))
    except FileNotFoundError:
        pass


def take_lock():
    os.makedirs(STATE, exist_ok=True)
    lock = path('lock')
    try:
        os.mkdir(lock)
    except FileExistsError:
        try:
            pid = int(open(os.path.join(lock, 'pid')).read().strip())
            os.kill(pid, 0)
            return False  # a live pass holds it
        except (ValueError, FileNotFoundError, ProcessLookupError):
            pass  # a dead pass left it; its attempt record (if any) is handled as uncertain below
        except PermissionError:
            return False
    with open(os.path.join(lock, 'pid'), 'w') as f:
        f.write(str(os.getpid()))
    return True


def drop_lock():
    lock = path('lock')
    try:
        os.remove(os.path.join(lock, 'pid'))
    except FileNotFoundError:
        pass
    try:
        os.rmdir(lock)
    except OSError:
        pass


# ---------- server ----------
class Server:
    def __init__(self, url, anon, key):
        self.url, self.anon, self.key = url.rstrip('/'), anon, key

    def rpc(self, fn, **args):
        body = json.dumps(dict({'p_key': self.key}, **args)).encode()
        req = urllib.request.Request(self.url + '/rest/v1/rpc/' + fn, data=body, method='POST', headers={
            'apikey': self.anon, 'Authorization': 'Bearer ' + self.anon, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode() or 'null')


# ---------- strict output ----------
def strict_loads(text):
    def pairs(items):
        seen = {}
        for k, v in items:
            if k in seen: raise ValueError('duplicate key')
            seen[k] = v
        return seen
    def const(_):
        raise ValueError('non-finite number')
    def flt(s):
        v = float(s)
        if v != v or v in (float('inf'), float('-inf')): raise ValueError('non-finite number')
        return v
    obj = json.loads(text, object_pairs_hook=pairs, parse_constant=const, parse_float=flt)
    def depth(o, d=0):
        if d > 6: raise ValueError('too deep')
        if isinstance(o, dict):
            for v in o.values(): depth(v, d + 1)
        elif isinstance(o, list):
            for v in o: depth(v, d + 1)
    depth(obj)
    return obj


def check_report(agent, rep, payload):
    """the same contract the server enforces, checked first so a bad answer never reaches it"""
    keys = {'summary', 'notes', 'proposals'} | ({'ranking'} if agent == 'orchestrator' else set())
    if not isinstance(rep, dict) or set(rep) - keys or not {'summary', 'notes', 'proposals'} <= set(rep): raise Fail('bad_output')
    if not isinstance(rep['summary'], str) or not 1 <= len(rep['summary']) <= 400: raise Fail('bad_output')
    if not isinstance(rep['notes'], list) or len(rep['notes']) > 5 or any(not isinstance(n, str) or len(n) > 200 for n in rep['notes']): raise Fail('bad_output')
    props = rep['proposals']
    if not isinstance(props, list) or len(props) > 3: raise Fail('bad_output')
    if agent == 'orchestrator':
        refs = [p['ref'] for p in payload.get('proposals', [])]
        rk = rep.get('ranking')
        if props or not isinstance(rk, list) or any(not isinstance(r, str) or r not in refs for r in rk) or len(set(rk)) != len(rk): raise Fail('bad_output')
        return
    kinds, targets = set(payload.get('kinds') or []), set(payload.get('targets') or [])
    metrics = {m['metric'] for m in payload.get('registry', [])}
    for p in props:
        if not isinstance(p, dict) or set(p) != {'kind', 'target', 'metric', 'change', 'rationale'}: raise Fail('bad_output')
        if p['kind'] not in kinds or p['target'] not in targets: raise Fail('bad_output')
        if p['metric'] is not None and p['metric'] not in metrics: raise Fail('bad_output')
        if not isinstance(p['change'], dict) or len(json.dumps(p['change'])) > 1024: raise Fail('bad_output')
        if not isinstance(p['rationale'], str) or not 1 <= len(p['rationale']) <= 300: raise Fail('bad_output')


def schema(agent):
    prop = {'type': 'object', 'additionalProperties': False, 'required': ['kind', 'target', 'metric', 'change', 'rationale'], 'properties': {
        'kind': {'type': 'string'}, 'target': {'type': 'string'}, 'metric': {'type': ['string', 'null']},
        'change': {'type': 'object', 'additionalProperties': {'type': ['string', 'number', 'boolean']}}, 'rationale': {'type': 'string', 'maxLength': 300}}}
    s = {'type': 'object', 'additionalProperties': False, 'required': ['summary', 'notes', 'proposals'], 'properties': {
        'summary': {'type': 'string', 'maxLength': 400}, 'notes': {'type': 'array', 'maxItems': 5, 'items': {'type': 'string', 'maxLength': 200}},
        'proposals': {'type': 'array', 'maxItems': 0 if agent == 'orchestrator' else 3, 'items': prop}}}
    if agent == 'orchestrator':
        s['required'].append('ranking'); s['properties']['ranking'] = {'type': 'array', 'items': {'type': 'string'}}
    return s


def prompt(agent, payload):
    rules = (
        'You are ' + NAMES[agent] + ', one of the Rhythme staff team. You read only the JSON below: released group numbers from one report run, '
        'already held back where fewer than the floor of people contributed. You have no tools and must not ask for any.\n'
        'Rules: describe only what these numbers show. A null value is held back or not collected, never zero. Do not guess at anything not measured here, '
        'do not name or describe any person, do not invent numbers, and do not claim health benefits. Proposals are suggestions for staff to approve; '
        'nothing is applied. Use only the kinds and targets listed, and only metrics in the registry.\n'
        'Answer with one JSON object matching the schema: summary (one or two plain sentences), notes (short observations), proposals (up to 3).\n')
    if agent == 'orchestrator':
        rules = ('You are ' + NAMES[agent] + '. You read the four reports below and rank the proposals they made by how clearly the numbers support them. '
                 'You have no tools. You may not add proposals. Answer with one JSON object: summary, notes, proposals (always empty), ranking (refs, most supported first, each at most once, only refs listed).\n')
    return rules + '\nINPUT\n' + json.dumps(payload, sort_keys=True) + '\n'


# ---------- one model call ----------
def run_codex(agent, payload, beat):
    work = tempfile.mkdtemp(prefix='rhythme-review-')
    try:
        sch = os.path.join(work, 'schema.json'); out = os.path.join(work, 'out.json')
        with open(sch, 'w') as f: json.dump(schema(agent), f)
        cwd = os.path.join(work, 'cwd'); os.mkdir(cwd)
        argv = [CODEX, 'exec', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '-s', 'read-only', '--json',
                '--output-schema', sch, '-o', out, '-m', MODEL, '-C', cwd,
                '-c', 'model_providers.openai.request_max_retries=0', '-c', 'model_providers.openai.stream_max_retries=0']
        for f in DISABLE: argv += ['--disable', f]
        argv.append('-')
        env = {k: os.environ[k] for k in ('HOME', 'PATH', 'LANG', 'CODEX_HOME', 'TMPDIR') if k in os.environ}
        p = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd, env=env, start_new_session=True)
        state = {'fail': None, 'completed': False, 'bytes': 0, 'stop': False}
        errbuf = []
        def kill():
            try:
                os.killpg(p.pid, signal.SIGTERM)
            except ProcessLookupError:
                return
            try:
                p.wait(5)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(p.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            p.wait()
        def first(code):
            if state['fail'] is None: state['fail'] = code; kill_now.set()
        kill_now = threading.Event()
        def read_out():
            for raw in p.stdout:
                state['bytes'] += len(raw)
                if state['bytes'] > MAX_STDOUT: first('bad_output'); return
                line = raw.decode('utf-8', 'replace').strip()
                if not line: continue
                try:
                    ev = json.loads(line)
                except ValueError:
                    first('bad_output'); return
                t = ev.get('type') if isinstance(ev, dict) else None
                if t in ('error', 'turn.failed'):
                    first('provider_limit' if LIMIT.search(json.dumps(ev)) else 'provider_error'); return
                if t == 'turn.completed':
                    state['completed'] = True
                if t in ('item.started', 'item.completed'):
                    it = ev.get('item') or {}
                    if it.get('type') in TOOL_ITEMS: first('bad_output'); return  # no tool may run
                    if it.get('type') == 'error' or 'reconnect' in json.dumps(it).lower(): first('provider_error'); return
        def read_err():
            n = 0
            for raw in p.stderr:
                n += len(raw)
                if n <= 65536: errbuf.append(raw.decode('utf-8', 'replace'))
                if LIMIT.search(raw.decode('utf-8', 'replace')): first('provider_limit')
        to = threading.Thread(target=read_out, daemon=True); te = threading.Thread(target=read_err, daemon=True)
        to.start(); te.start()
        try:
            p.stdin.write(prompt(agent, payload).encode()); p.stdin.close()
        except BrokenPipeError:
            pass
        start = time.monotonic(); last_beat = start
        while p.poll() is None:
            if kill_now.wait(0.2): break
            now = time.monotonic()
            if now - start > STAGE_TIMEOUT: state['fail'] = state['fail'] or 'timeout'; break
            if now - last_beat >= BEAT_EVERY:
                last_beat = now
                if not beat(): state['stop'] = True; break
        if p.poll() is None: kill()
        to.join(5); te.join(5)
        if state['stop']: raise Stop('server stopped the job')
        if state['fail']: raise Fail(state['fail'])
        if LIMIT.search(''.join(errbuf)): raise Fail('provider_limit')
        if p.returncode != 0: raise Fail('provider_error')
        if not state['completed']: raise Fail('provider_error')
        try:
            size = os.path.getsize(out)
        except OSError:
            raise Fail('bad_output')
        if size > MAX_OUT or size == 0: raise Fail('bad_output')
        try:
            rep = strict_loads(open(out, encoding='utf-8').read())
        except ValueError:
            raise Fail('bad_output')
        return rep, hashlib.sha256(open(out, 'rb').read()).hexdigest()[:40]
    finally:
        for root, dirs, files in os.walk(work, topdown=False):
            for n in files: os.remove(os.path.join(root, n))
            for n in dirs: os.rmdir(os.path.join(root, n))
        os.rmdir(work)


def cli_version():
    try:
        return subprocess.run([CODEX, '--version'], capture_output=True, text=True, timeout=10).stdout.strip()[:40]
    except Exception:
        return 'unknown'


# ---------- one pass ----------
def record_failure(srv, job, token, code):
    write_json('pending.json', {'job': job, 'token': token, 'code': code, 'at': time.time()})
    reconcile_pending(srv)


def reconcile_pending(srv):
    pend = read_json('pending.json')
    if not pend: return True
    try:
        r = srv.rpc('worker_fail', p_job=pend['job'], p_token=pend['token'], p_code=pend['code'])
    except Exception:
        return False  # stays pending; the next pass sends it before anything else
    if isinstance(r, dict) and r.get('block'):
        write_json('BLOCKED.json', {'block': r['block'], 'job': pend['job'], 'code': pend['code'], 'at': time.time()})
        remove('pending.json'); return True
    if isinstance(r, dict) and r.get('error') == 'no_such_claim':
        # the server does not know this claim (a pruned or foreign job): keep a local block the owner must look at
        write_json('BLOCKED.json', {'block': None, 'job': pend['job'], 'code': pend['code'], 'at': time.time(), 'unrecorded': True})
        remove('pending.json'); return True
    return False


def once(srv):
    att = read_json('attempt.json')
    if att:  # the last pass died while a model call may have been in flight
        write_json('pending.json', {'job': att['job'], 'token': att['token'], 'code': 'uncertain', 'at': time.time()})
        remove('attempt.json')
    if read_json('pending.json') and not reconcile_pending(srv):
        return 'pending'
    blk = read_json('BLOCKED.json')
    if blk:
        if blk.get('block') is None: return 'blocked'
        try:
            r = srv.rpc('worker_claim', p_local_block=blk['block'])
        except Exception:
            return 'blocked'
        if isinstance(r, dict) and r.get('cleared') is True and r.get('local_block') == blk['block']:
            remove('BLOCKED.json'); return 'unblocked'
        return 'blocked'
    try:
        cl = srv.rpc('worker_claim', p_local_block=None)
    except Exception:
        return 'offline'
    if not isinstance(cl, dict) or not cl.get('job'): return 'idle'
    job, token = cl['job'], cl['token']
    version = cli_version()
    def beat_for(agent):
        def beat():
            try:
                r = srv.rpc('worker_beat', p_job=job, p_token=token, p_agent=agent)
            except Exception:
                return True  # a missed beat is not a stop; the lease covers short outages
            return not (isinstance(r, dict) and ('stop' in r or r.get('error')))
        return beat
    try:
        for agent in ORDER:
            try:
                b = srv.rpc('worker_stage_begin', p_job=job, p_token=token, p_agent=agent)
            except Exception:
                raise Fail('transport')
            if isinstance(b, dict) and 'stop' in b: raise Stop(b['stop'])
            if not isinstance(b, dict) or 'payload' not in b: raise Fail('crash')
            write_json('attempt.json', {'job': job, 'token': token, 'stage': agent, 'started': time.time()})
            rep, out_hash = run_codex(agent, b['payload'], beat_for(agent))
            check_report(agent, rep, b['payload'])
            prov = {'cli': version, 'model': MODEL, 'prompt_v': PROMPT_V, 'schema_v': SCHEMA_V, 'output_hash': out_hash}
            try:
                r = srv.rpc('worker_post', p_job=job, p_token=token, p_agent=agent, p_report=rep, p_provenance=prov)
            except Exception:
                raise Fail('transport')
            remove('attempt.json')
            if isinstance(r, dict) and 'stop' in r: raise Stop(r['stop'])
            if not (isinstance(r, dict) and r.get('ok')): raise Fail('bad_output')
        try:
            f = srv.rpc('worker_finish', p_job=job, p_token=token)
        except Exception:
            raise Fail('transport')
        if isinstance(f, dict) and 'stop' in f: raise Stop(f['stop'])
        if not (isinstance(f, dict) and f.get('ok')): raise Fail('crash')
        return 'done'
    except Stop:
        remove('attempt.json')
        return 'stopped'
    except Fail as e:
        remove('attempt.json')
        record_failure(srv, job, token, e.code)
        return 'failed:' + e.code


def main(argv):
    if '--once' not in argv:
        print('usage: review_worker.py --once', file=sys.stderr); return 2
    conf = json.load(open(CONF))
    key = open(KEYFILE).read().strip()
    srv = Server(conf['url'], conf['anon_key'], key)
    if not take_lock():
        return 0
    try:
        print(once(srv))
    finally:
        drop_lock()
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
