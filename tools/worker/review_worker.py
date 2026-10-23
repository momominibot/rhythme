#!/usr/bin/env python3
"""Rhythme staff review worker: runs on Jamie's Mac, started every 20 s by the LaunchAgent com.rhythme.review-worker.

One `--once` pass: reconcile anything left from a failed pass, check the local Codex runtime, then ask the server for a
queued review. With one, run the five stages in order (cycle, sleep, food, mind, orchestrator), each as exactly one
`codex exec` call on that stage's released aggregates, and post each report. Design and house rules:
docs/design/2026-10-23-review-worker-on-refresh.md.

Never: a retry, a second model or account, a test call to see whether a limit lifted, a model call while blocked.
Standard library only.

Each model call runs in a throwaway home: its own CODEX_HOME holding only this file's config (a provider with zero
request and stream retries and no websocket transport, every feature off) and a link to the real auth file, an empty
working folder and nothing else, so no AGENTS.md, rules, plugins, memories or tools are loaded. preflight() proves the
pinned CLI, the absolute path and the feature inventory before any claim.

Files (all under ~/.local/state/rhythme-worker unless RHYTHME_WORKER_STATE is set):
  lock           flock held for the whole pass
  attempt.json   written before a model call (with the child's process group and start time); found on start = the
                 pass died mid-call: the child is killed if still alive and the attempt is recorded as uncertain
  pending.json   a failure not yet recorded on the server; written before attempt.json is removed, sent first
  BLOCKED.json   the server block this worker is waiting on; removed only when the server shows that block cleared
Config: ~/.config/rhythme/worker.json {"url": ..., "anon_key": ...} and ~/.config/rhythme/worker_key (600).
"""
import fcntl, hashlib, json, os, re, signal, subprocess, sys, tempfile, threading, time, urllib.request

PROMPT_V = 'review-prompt-2'
SCHEMA_V = 'review-schema-2'
MODEL = os.environ.get('RHYTHME_WORKER_MODEL', 'gpt-6-astra')
CODEX = os.environ.get('RHYTHME_CODEX', os.path.expanduser('~/.local/bin/codex'))
PINNED = os.environ.get('RHYTHME_CODEX_VERSION', 'codex-cli 0.160.0')
AUTH = os.path.expanduser(os.environ.get('RHYTHME_CODEX_AUTH', '~/.codex/auth.json'))
MODELS = os.path.expanduser(os.environ.get('RHYTHME_CODEX_MODELS', '~/.codex/models_cache.json'))
# the model's own catalog entry asks for code mode, sub-agents, a shell and a search tool; this copy asks for none
MODEL_OVERRIDES = {'tool_mode': 'direct', 'shell_type': 'disabled', 'apply_patch_tool_type': None, 'supports_search_tool': False,
                   'experimental_supported_tools': [], 'node_repl_disabled': True, 'include_skills_usage_instructions': False,
                   'include_plugin_usage_instructions': False, 'include_apps_usage_instructions': False}
STATE = os.path.expanduser(os.environ.get('RHYTHME_WORKER_STATE', '~/.local/state/rhythme-worker'))
CONF = os.path.expanduser(os.environ.get('RHYTHME_WORKER_CONF', '~/.config/rhythme/worker.json'))
KEYFILE = os.path.expanduser(os.environ.get('RHYTHME_WORKER_KEYFILE', '~/.config/rhythme/worker_key'))
STAGE_TIMEOUT = float(os.environ.get('RHYTHME_STAGE_TIMEOUT', '240'))
BEAT_EVERY = float(os.environ.get('RHYTHME_BEAT_EVERY', '30'))
GRACE = float(os.environ.get('RHYTHME_KILL_GRACE', '5'))
MAX_OUT = 64 * 1024          # the -o answer file
MAX_STDOUT = 1024 * 1024     # all JSON events together
MAX_STDERR = 256 * 1024
MAX_LINE = 256 * 1024
ORDER = ['cycle', 'sleep', 'food', 'mind', 'orchestrator']
# every feature 0.160.0 lists; written false into the throwaway config. preflight() refuses to claim if any feature the
# CLI reports as on is outside ALLOW_ON (stages that are 'removed' still print true but do nothing).
FEATURES_OFF = [
    'apps', 'auth_elicitation', 'browser_use', 'browser_use_external', 'browser_use_full_cdp_access', 'chronicle', 'code_mode_host',
    'compaction_image_budget', 'computer_use', 'content_item_kinds', 'daemon_auto_start', 'enable_request_compression', 'fast_mode',
    'goals', 'guardian_approval', 'guardian_reuse_parent_compaction', 'hooks', 'image_generation', 'in_app_browser', 'in_app_chat',
    'in_app_dictation', 'in_app_local_automation', 'in_app_updates', 'memories', 'mentions_v2', 'multi_agent', 'plugin_sharing',
    'plugins', 'realtime_conversation', 'remote_plugin', 'shell_snapshot', 'shell_tool', 'skill_mcp_dependency_install',
    'skill_search', 'sleep_tool', 'system_proxy_fallback', 'tool_call_mcp_elicitation', 'tool_suggest', 'unbounded_connection_retries',
    'unified_exec', 'unified_exec_tty', 'view_image', 'workspace_dependencies', 'worktrees', 'write_stdin_approval']
ALLOW_ON_STAGES = {'removed'}
# 0.160.0 reports unified_exec on even with features.unified_exec=false; with shell_tool off and the catalog's shell_type
# 'disabled' no shell tool is offered, which test_codex_offline.py checks on the request the CLI actually sends
ALLOW_ON_NAMES = {'unified_exec'}
LIMIT = re.compile(r"usage limit|you've hit|rate[ _-]?limit|insufficient_quota|exceeded your current quota|quota|too many requests|\b429\b", re.I)
PROVIDER = re.compile(r"\b(401|403|5\d\d)\b|unauthori[sz]ed|authenticat|forbidden|stream error|stream disconnected|reconnect|retry|retrying|"
                      r"falling back|fallback|connection (failed|reset|refused)|timed? ?out|server error|overloaded|unavailable|error", re.I)
EVENT_TYPES = {'thread.started', 'turn.started', 'turn.completed', 'item.started', 'item.updated', 'item.completed'}
ITEM_TYPES = {'agent_message', 'reasoning'}
KEY_RE = re.compile(r'^[a-z][a-z_]{0,29}$')

NAMES = {'cycle': 'Bloom, who keeps the period and symptom days', 'sleep': 'Dozy, who counts the recorded nights',
         'food': 'Pudding, who keeps the meal days and tags', 'mind': 'Misty, who keeps the practice days and minutes',
         'orchestrator': 'Nimbus, who reads the four reports and ranks what they propose'}


class Stop(Exception):
    """the server ended the job (held run, switch off, lease lost): not a provider failure, nothing to record"""


class Fail(Exception):
    """a failure that must stop the job and be recorded as a block; .code is one of the server's fixed codes"""
    def __init__(self, code):
        super().__init__(code); self.code = code


class NotReady(Exception):
    """the local runtime is not as pinned: nothing is claimed and no model is called"""


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
    dfd = os.open(STATE, os.O_RDONLY)
    try:
        os.fsync(dfd)
    finally:
        os.close(dfd)


def remove(name):
    try:
        os.remove(path(name))
    except FileNotFoundError:
        pass


def take_lock():
    """an OS-held lock for the whole pass; released by the kernel if the pass dies, so no stale lock and no race"""
    os.makedirs(STATE, exist_ok=True)
    fd = os.open(path('lock'), os.O_RDWR | os.O_CREAT, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd); return None
    return fd


def drop_lock(fd):
    try:
        fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)


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


def to_change(pairs):
    """the model answers change as [{key, value}] (strict schemas allow no open objects); the server stores an object"""
    if not isinstance(pairs, list) or not 1 <= len(pairs) <= 4: raise Fail('bad_output')
    out = {}
    for kv in pairs:
        if not isinstance(kv, dict) or set(kv) != {'key', 'value'}: raise Fail('bad_output')
        k, v = kv['key'], kv['value']
        if not isinstance(k, str) or not KEY_RE.match(k) or k in out: raise Fail('bad_output')
        if not isinstance(v, str) or not 1 <= len(v) <= 120: raise Fail('bad_output')
        out[k] = v
    return out


def check_report(agent, rep, payload):
    """the same contract the server enforces (staff.review_report_error), checked first so a bad answer never reaches it;
    returns the report in the server's shape"""
    keys = {'summary', 'notes', 'proposals'} | ({'ranking'} if agent == 'orchestrator' else set())
    if not isinstance(rep, dict) or set(rep) != keys: raise Fail('bad_output')
    if not isinstance(rep['summary'], str) or not 1 <= len(rep['summary']) <= 280: raise Fail('bad_output')
    if not isinstance(rep['notes'], list) or len(rep['notes']) > 5 or any(not isinstance(n, str) or not 1 <= len(n) <= 200 for n in rep['notes']): raise Fail('bad_output')
    props = rep['proposals']
    if not isinstance(props, list) or len(props) > 3: raise Fail('bad_output')
    if agent == 'orchestrator':
        refs = [p['ref'] for p in payload.get('proposals', [])]
        rk = rep['ranking']
        if props or not isinstance(rk, list) or any(not isinstance(r, str) or r not in refs for r in rk) or len(set(rk)) != len(rk): raise Fail('bad_output')
        return {'summary': rep['summary'], 'notes': rep['notes'], 'proposals': [], 'ranking': rk}
    matrix = payload.get('matrix') or {}
    metrics = {m['metric'] for m in payload.get('registry', [])}
    out = []
    for p in props:
        if not isinstance(p, dict) or set(p) != {'kind', 'target', 'metric', 'change', 'rationale'}: raise Fail('bad_output')
        if not isinstance(p['kind'], str) or not isinstance(p['target'], str) or p['target'] not in (matrix.get(p['kind']) or []): raise Fail('bad_output')
        if p['metric'] is not None and p['metric'] not in metrics: raise Fail('bad_output')
        if p['kind'] == 'measurement_gap' and p['metric'] is None: raise Fail('bad_output')
        if not isinstance(p['rationale'], str) or not 1 <= len(p['rationale']) <= 300: raise Fail('bad_output')
        out.append({'kind': p['kind'], 'target': p['target'], 'metric': p['metric'], 'change': to_change(p['change']), 'rationale': p['rationale']})
    return {'summary': rep['summary'], 'notes': rep['notes'], 'proposals': out}


def schema(agent):
    """strict Structured Outputs: every object closed, every property required; lengths are checked in check_report"""
    kv = {'type': 'object', 'additionalProperties': False, 'required': ['key', 'value'],
          'properties': {'key': {'type': 'string'}, 'value': {'type': 'string'}}}
    prop = {'type': 'object', 'additionalProperties': False, 'required': ['kind', 'target', 'metric', 'change', 'rationale'], 'properties': {
        'kind': {'type': 'string'}, 'target': {'type': 'string'}, 'metric': {'type': ['string', 'null']},
        'change': {'type': 'array', 'items': kv}, 'rationale': {'type': 'string'}}}
    s = {'type': 'object', 'additionalProperties': False, 'required': ['summary', 'notes', 'proposals'], 'properties': {
        'summary': {'type': 'string'}, 'notes': {'type': 'array', 'items': {'type': 'string'}},
        'proposals': {'type': 'array', 'items': prop}}}
    if agent == 'orchestrator':
        s['required'].append('ranking'); s['properties']['ranking'] = {'type': 'array', 'items': {'type': 'string'}}
    return s


def prompt(agent, payload):
    rules = (
        'You are ' + NAMES[agent] + ', one of the Rhythme staff team. You read only the JSON below: released group numbers from one report run, '
        'already held back where fewer than the floor of people contributed. You have no tools and must not ask for any.\n'
        'Rules: describe only what these numbers show. A null value is held back or not collected, never zero. Do not guess at anything not measured here, '
        'do not name or describe any person, do not invent numbers, and do not claim health benefits. Proposals are suggestions for staff to approve; '
        'nothing is applied. Each proposal uses a kind and a target that the matrix pairs (matrix: kind -> allowed targets), only metrics in the registry '
        '(measurement_gap needs one), and change as 1 to 4 {key, value} pairs with short lower_case keys and short text values.\n'
        'Answer with one JSON object matching the schema: summary (one or two plain sentences, at most 280 characters), notes (up to 5 short observations), '
        'proposals (up to 3, or none).\n')
    if agent == 'orchestrator':
        rules = ('You are ' + NAMES[agent] + '. You read the four reports below and rank the proposals they made by how clearly the numbers support them. '
                 'You have no tools. You may not add proposals. Answer with one JSON object: summary (at most 280 characters), notes (up to 5), '
                 'proposals (always empty), ranking (refs, most supported first, each at most once, only refs listed).\n')
    return rules + '\nINPUT\n' + json.dumps(payload, sort_keys=True) + '\n'


# ---------- the throwaway runtime ----------
def toml_str(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


def model_catalog():
    """the model's entry from the CLI's own cache, with every tool-bearing field switched off"""
    try:
        with open(MODELS) as fh:
            c = json.load(fh)
    except (OSError, ValueError):
        raise NotReady('codex model cache missing at ' + MODELS)
    entry = next((m for m in (c.get('models') or []) if isinstance(m, dict) and m.get('slug') == MODEL), None)
    if not entry: raise NotReady('model ' + MODEL + ' not in the codex model cache')
    return {'models': [dict(entry, **MODEL_OVERRIDES)]}


def config_text(catalog_path, provider=None):
    lines = ['model = ' + toml_str(MODEL), 'model_provider = "rhythme"', 'approval_policy = "never"', 'sandbox_mode = "read-only"',
             'model_catalog_json = ' + toml_str(catalog_path), 'include_collaboration_mode_instructions = false', '',
             '[agents]', 'enabled = false', '', '[skills]', 'include_instructions = false', '', '[skills.bundled]', 'enabled = false', '',
             '[model_providers.rhythme]', 'name = "rhythme-openai"', 'wire_api = "responses"',
             'request_max_retries = 0', 'stream_max_retries = 0', 'supports_websockets = false']
    if provider:  # tests only: a local fake provider, never the real auth
        lines += ['base_url = ' + toml_str(provider['base_url']), 'env_key = ' + toml_str(provider['env_key']), 'requires_openai_auth = false']
    else:
        lines += ['requires_openai_auth = true']
    lines += ['', '[features]'] + [f + ' = false' for f in FEATURES_OFF]
    return '\n'.join(lines) + '\n'


def test_provider():
    base = os.environ.get('RHYTHME_TEST_PROVIDER_BASE')
    return {'base_url': base, 'env_key': 'RHYTHME_TEST_PROVIDER_KEY'} if base else None


class Home:
    """a fresh 0700 folder per call: home, codex_home (config + auth link), cwd; removed afterwards"""
    def __init__(self):
        self.root = tempfile.mkdtemp(prefix='rhythme-review-')
        os.chmod(self.root, 0o700)
        self.home = os.path.join(self.root, 'home'); self.codex_home = os.path.join(self.root, 'codex_home'); self.cwd = os.path.join(self.root, 'cwd')
        for d in (self.home, self.codex_home, self.cwd): os.mkdir(d, 0o700)
        prov = test_provider()
        cat = os.path.join(self.root, 'models.json')
        with open(cat, 'w') as f: json.dump(model_catalog(), f)
        with open(os.path.join(self.codex_home, 'config.toml'), 'w') as f: f.write(config_text(cat, prov))
        if not prov:
            os.symlink(AUTH, os.path.join(self.codex_home, 'auth.json'))  # a link, so a token refresh lands in the real file

    def env(self):
        e = {'HOME': self.home, 'CODEX_HOME': self.codex_home, 'PATH': '/usr/bin:/bin:/usr/sbin:/sbin', 'LANG': 'en_US.UTF-8',
             'TMPDIR': self.root + '/'}
        if test_provider(): e['RHYTHME_TEST_PROVIDER_KEY'] = os.environ.get('RHYTHME_TEST_PROVIDER_KEY', 'local-test')
        if os.environ.get('RHYTHME_FAKE_DIR'): e['RHYTHME_FAKE_DIR'] = os.environ['RHYTHME_FAKE_DIR']  # tests only: the fake codex's files
        return e

    def close(self):
        for root, dirs, files in os.walk(self.root, topdown=False):
            for n in files: os.remove(os.path.join(root, n))
            for n in dirs:
                p = os.path.join(root, n)
                os.remove(p) if os.path.islink(p) else os.rmdir(p)
        os.rmdir(self.root)


def preflight():
    """the pinned CLI at an absolute path, the config it will load, and nothing switched on that ALLOW_ON_STAGES does not
    cover; no network, no model"""
    if not os.path.isabs(CODEX) or not os.path.isfile(CODEX) or not os.access(CODEX, os.X_OK): raise NotReady('codex not found at ' + CODEX)
    if not test_provider() and not os.path.isfile(AUTH): raise NotReady('codex auth missing')
    h = Home()  # raises NotReady when the model cache lacks the model
    try:
        v = subprocess.run([CODEX, '--version'], capture_output=True, text=True, timeout=20, env=h.env(), cwd=h.cwd)
        if v.stdout.strip() != PINNED: raise NotReady('codex version ' + v.stdout.strip()[:40] + ', want ' + PINNED)
        fl = subprocess.run([CODEX, 'features', 'list'], capture_output=True, text=True, timeout=20, env=h.env(), cwd=h.cwd)
        if fl.returncode != 0: raise NotReady('codex rejected the worker config: ' + (fl.stderr or fl.stdout).strip()[:200])
        on = []
        for line in fl.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 3 and parts[-1] == 'true' and parts[-2] not in ALLOW_ON_STAGES and parts[0] not in ALLOW_ON_NAMES: on.append(parts[0])
        if on: raise NotReady('features still on: ' + ', '.join(on))
        return v.stdout.strip()
    finally:
        h.close()


# ---------- one model call ----------
def group_alive(pgid):
    """macOS answers EPERM for a group whose only member is an unreaped zombie: nothing left that can run"""
    try:
        os.killpg(pgid, 0); return True
    except (ProcessLookupError, PermissionError):
        return False


def signal_group(pgid, sig):
    try:
        os.killpg(pgid, sig)
    except (ProcessLookupError, PermissionError):
        pass


def kill_group(pgid, reap=lambda: None):
    """TERM the whole group, wait for every member to go (not only the leader), then KILL whatever is left;
    reap() collects our own child so its zombie does not count as alive"""
    signal_group(pgid, signal.SIGTERM)
    end = time.monotonic() + GRACE
    while time.monotonic() < end:
        reap()
        if not group_alive(pgid): return
        time.sleep(0.05)
    signal_group(pgid, signal.SIGKILL)
    end = time.monotonic() + GRACE
    while time.monotonic() < end:
        reap()
        if not group_alive(pgid): return
        time.sleep(0.05)


def start_time(pid):
    try:
        return subprocess.run(['/bin/ps', '-o', 'lstart=', '-p', str(pid)], capture_output=True, text=True, timeout=5).stdout.strip()
    except Exception:
        return ''


def run_codex(agent, payload, beat, on_start):
    h = Home()
    try:
        sch = os.path.join(h.root, 'schema.json'); out = os.path.join(h.root, 'out.json')
        with open(sch, 'w') as f: json.dump(schema(agent), f)
        argv = [CODEX, 'exec', '--strict-config', '--ephemeral', '--ignore-rules', '--skip-git-repo-check', '-s', 'read-only', '--json',
                '--output-schema', sch, '-o', out, '-m', MODEL, '-C', h.cwd, '-']
        state = {'fail': None, 'completed': False, 'stop': False, 'out_done': False, 'err_done': False}
        lock = threading.Lock()
        done = threading.Event()
        def first(code):
            with lock:
                if state['fail'] is None: state['fail'] = code
            done.set()
        def classify(text):
            if LIMIT.search(text): return 'provider_limit'
            if PROVIDER.search(text): return 'provider_error'
            return None
        deadline = time.monotonic() + STAGE_TIMEOUT
        p = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=h.cwd, env=h.env(), start_new_session=True)
        pgid = p.pid
        on_start(pgid, start_time(p.pid))
        def lines(fd, cap, total_key):
            """bounded reads: a line over MAX_LINE or a stream over cap ends the call"""
            buf, total = b'', 0
            while True:
                chunk = os.read(fd, 65536)
                if not chunk:
                    if buf: yield buf
                    return
                total += len(chunk)
                if total > cap: raise OverflowError(total_key)
                buf += chunk
                while b'\n' in buf:
                    ln, buf = buf.split(b'\n', 1)
                    yield ln
                if len(buf) > MAX_LINE: raise OverflowError(total_key)
        def read_out():
            try:
                for raw in lines(p.stdout.fileno(), MAX_STDOUT, 'stdout'):
                    line = raw.decode('utf-8', 'replace').strip()
                    if not line: continue
                    ev = json.loads(line)
                    if not isinstance(ev, dict) or ev.get('type') not in EVENT_TYPES:
                        first(classify(line) or 'provider_error'); continue
                    t = ev['type']
                    if t.startswith('item.'):
                        it = ev.get('item')
                        if not isinstance(it, dict) or it.get('type') not in ITEM_TYPES:
                            first(classify(line) or 'bad_output'); continue  # an error item, a tool, anything unexpected
                        txt = it.get('text')
                        if txt is not None and not isinstance(txt, str): first('bad_output'); continue
                        if it.get('type') == 'agent_message' and txt and LIMIT.search(txt): first('provider_limit'); continue
                    if t == 'turn.completed': state['completed'] = True
                state['out_done'] = True
            except Exception:
                first('bad_output')
        def read_err():
            try:
                for raw in lines(p.stderr.fileno(), MAX_STDERR, 'stderr'):
                    line = raw.decode('utf-8', 'replace').strip()
                    if not line: continue
                    first(classify(line) or 'provider_error')  # the pinned CLI writes nothing to stderr on a clean run
                state['err_done'] = True
            except Exception:
                first('bad_output')
        def write_in():
            try:
                p.stdin.write(prompt(agent, payload).encode()); p.stdin.close()
            except (BrokenPipeError, OSError):
                pass
        def beater():
            while not done.wait(BEAT_EVERY):
                try:
                    ok = beat()
                except Exception:
                    ok = True  # a missed beat is not a stop; the lease covers short outages
                if not ok:
                    state['stop'] = True; done.set(); return
        threads = [threading.Thread(target=f, daemon=True) for f in (read_out, read_err, write_in, beater)]
        for t in threads: t.start()
        while p.poll() is None and not done.is_set() and time.monotonic() < deadline:
            done.wait(0.1)
        if p.poll() is None and not done.is_set():
            first('timeout')
        done.set()
        kill_group(pgid, p.poll)
        try:
            p.wait(GRACE)
        except subprocess.TimeoutExpired:
            first('crash')  # the group would not die: never wait for ever, and never call this a success
        threads[0].join(2); threads[1].join(2)
        threads[3].join(25)  # a beat already sent finishes, so a stop it brings is seen together with any failure
        if state['fail']: raise Fail(state['fail'])  # a seen failure wins over a server stop: it must become a block
        if state['stop']: raise Stop('server stopped the job')
        if not (state['out_done'] and state['err_done']): raise Fail('bad_output')
        if p.returncode != 0 or not state['completed']: raise Fail('provider_error')
        try:
            size = os.path.getsize(out)
        except OSError:
            raise Fail('bad_output')
        if size > MAX_OUT or size == 0: raise Fail('bad_output')
        with open(out, 'rb') as fh:
            raw = fh.read()
        text = raw.decode('utf-8', 'replace')
        if LIMIT.search(text): raise Fail('provider_limit')
        try:
            rep = strict_loads(text)
        except ValueError:
            raise Fail('bad_output')
        return rep, hashlib.sha256(raw).hexdigest()[:40]
    finally:
        h.close()


# ---------- one pass ----------
def record_failure(srv, job, token, code):
    write_json('pending.json', {'job': job, 'token': token, 'code': code, 'at': time.time()})  # durable before the attempt goes
    remove('attempt.json')
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
    return False  # denied, unknown claim or a bad answer: keep it pending and claim nothing


def recover_attempt():
    """the last pass died while a model call may have been in flight: stop that exact child if it still runs"""
    att = read_json('attempt.json')
    if not att: return
    pg = att.get('pgid')
    if pg and group_alive(pg) and att.get('started_at') and start_time(pg) == att['started_at']:
        kill_group(pg)
    write_json('pending.json', {'job': att['job'], 'token': att['token'], 'code': 'uncertain', 'at': time.time()})
    remove('attempt.json')


def once(srv):
    recover_attempt()
    if read_json('pending.json') and not reconcile_pending(srv):
        return 'pending'
    blk = read_json('BLOCKED.json')
    if blk:
        try:
            r = srv.rpc('worker_claim', p_local_block=blk['block'])
        except Exception:
            return 'blocked'
        if isinstance(r, dict) and r.get('cleared') is True and r.get('local_block') == blk['block']:
            remove('BLOCKED.json'); return 'unblocked'
        return 'blocked'
    try:
        version = preflight()
    except NotReady as e:
        return 'not_ready: ' + str(e)
    try:
        cl = srv.rpc('worker_claim', p_local_block=None)
    except Exception:
        return 'offline'
    if not isinstance(cl, dict) or not cl.get('job'): return 'idle'
    job, token = cl['job'], cl['token']
    def beat_for(agent):
        def beat():
            r = srv.rpc('worker_beat', p_job=job, p_token=token, p_agent=agent)
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
            def started(pgid, st, agent=agent):
                write_json('attempt.json', {'job': job, 'token': token, 'stage': agent, 'started': time.time(), 'pgid': pgid, 'started_at': st})
            rep, out_hash = run_codex(agent, b['payload'], beat_for(agent), started)
            rep = check_report(agent, rep, b['payload'])
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
        record_failure(srv, job, token, e.code)
        return 'failed:' + e.code


def main(argv):
    if '--once' not in argv:
        print('usage: review_worker.py --once', file=sys.stderr); return 2
    conf = json.load(open(CONF))
    key = open(KEYFILE).read().strip()
    srv = Server(conf['url'], conf['anon_key'], key)
    fd = take_lock()
    if fd is None:
        return 0
    try:
        print(once(srv))
    finally:
        drop_lock(fd)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
