#!/usr/bin/env python3
"""A stand-in for `codex` in the worker tests. It never calls a model. Its files live in $RHYTHME_FAKE_DIR (the
worker passes only that through its scrubbed environment): fake_modes.json is a list, one mode per exec call, the
last repeated; every exec call is logged to calls.jsonl with its argv, environment keys and CODEX_HOME files.
`--version` prints version.txt (default the pinned version); `features list` prints features.txt (default: all off)."""
import json, os, signal, subprocess, sys, time

d = os.environ.get('RHYTHME_FAKE_DIR', '')
def f(name): return os.path.join(d, name)
def read(name, default):
    try:
        return open(f(name)).read()
    except OSError:
        return default

if sys.argv[1:2] == ['--version']:
    print(read('version.txt', 'codex-cli 0.160.0').strip()); sys.exit(0)
if sys.argv[1:3] == ['features', 'list']:
    sys.stdout.write(read('features.txt', 'shell_tool  stable  false\nsqlite  removed  true\n')); sys.exit(0)

log = f('calls.jsonl')
modes = json.load(open(f('fake_modes.json')))
n = sum(1 for _ in open(log)) if os.path.exists(log) else 0
mode = modes[min(n, len(modes) - 1)]
ch = os.environ.get('CODEX_HOME', '')
cfg = open(os.path.join(ch, 'config.toml')).read() if ch and os.path.exists(os.path.join(ch, 'config.toml')) else ''
entry = {'argv': sys.argv[1:], 'env': sorted(os.environ), 'mode': mode, 'home_files': sorted(os.listdir(ch)) if ch else [], 'config': cfg,
         'cwd_files': os.listdir(os.getcwd())}
if mode != 'no_stdin':
    prompt = sys.stdin.read()
    entry.update({'nimbus': 'Nimbus' in prompt[:200], 'prompt_has_key': 'p_key' in prompt, 'prompt_len': len(prompt)})
with open(log, 'a') as fh:
    fh.write(json.dumps(entry) + '\n')
out = sys.argv[sys.argv.index('-o') + 1]


def ev(o):
    print(json.dumps(o), flush=True)


rep = {'summary': 'The numbers look steady.', 'notes': [], 'proposals': []}
if entry.get('nimbus'): rep['ranking'] = []
def ok_answer(r=None, msg=None):
    open(out, 'w').write(json.dumps(r or rep))
    ev({'type': 'item.completed', 'item': {'id': 'i1', 'type': 'agent_message', 'text': msg if msg is not None else json.dumps(r or rep)}})
    ev({'type': 'turn.completed', 'usage': {}})
ev({'type': 'thread.started', 'thread_id': 't1'}); ev({'type': 'turn.started'})
if mode == 'ok':
    ok_answer()
elif mode == 'ok_proposal':
    r = dict(rep, proposals=[{'kind': 'prompt_copy', 'target': 'bed_tap', 'metric': None, 'change': [{'key': 'copy', 'value': 'Tap the bed'}], 'rationale': 'r'}])
    ok_answer(r)
elif mode == 'limit_stderr_exit0':
    ok_answer(); print("You've hit your usage limit. Try again later.", file=sys.stderr)
elif mode == 'stderr_429_exit0':
    ok_answer(); print('HTTP 429 from upstream', file=sys.stderr)
elif mode == 'stderr_401_exit0':
    ok_answer(); print('401 Unauthorized', file=sys.stderr)
elif mode == 'limit_in_message':
    ev({'type': 'item.completed', 'item': {'id': 'i0', 'type': 'agent_message', 'text': "You've hit your usage limit for today."}}); ok_answer()
elif mode == 'limit_in_answer':
    ok_answer(dict(rep, summary='Usage limit reached, try again later.'), msg='done')
elif mode == 'warning_event':
    ev({'type': 'warning', 'message': 'Falling back from WebSockets to HTTPS transport.'}); ok_answer()
elif mode == 'early_error_then_more':
    ev({'type': 'error', 'message': 'stream error: 500'}); open(out, 'w').write(json.dumps(rep))
    for _ in range(50): ev({'type': 'item.completed', 'item': {'id': 'x', 'type': 'agent_message', 'text': 'filler'}})
    ev({'type': 'turn.completed'})
elif mode == 'reconnect':
    ev({'type': 'item.completed', 'item': {'id': 'x', 'type': 'error', 'message': 'Reconnecting... 1/5'}}); ok_answer()
elif mode == 'tool_item':
    ev({'type': 'item.started', 'item': {'id': 'x', 'type': 'command_execution', 'command': 'cat /etc/passwd'}}); ok_answer()
elif mode == 'garbage_line':
    ok_answer(); print('not json at all', flush=True)
elif mode == 'reader_crash':
    ok_answer(); ev({'type': 'item.completed', 'item': ['not', 'an', 'object']})
elif mode == 'huge_line':
    sys.stdout.write('x' * (3 * 1024 * 1024)); sys.stdout.flush(); time.sleep(5)
elif mode == 'no_completed':
    open(out, 'w').write(json.dumps(rep))
elif mode == 'bad_json':
    open(out, 'w').write('{"summary": "x", '); ev({'type': 'turn.completed'})
elif mode == 'dup_keys':
    open(out, 'w').write('{"summary": "a", "summary": "b", "notes": [], "proposals": []}'); ev({'type': 'turn.completed'})
elif mode == 'nan':
    open(out, 'w').write('{"summary": "a", "notes": [], "proposals": [], "x": 1e999}'); ev({'type': 'turn.completed'})
elif mode == 'bad_contract':
    ok_answer(dict(rep, proposals=[{'kind': 'reminder_timing', 'target': 'metric_registry', 'metric': None, 'change': [], 'rationale': 'r'}]))
elif mode == 'exit1':
    sys.exit(1)
elif mode == 'hang':
    child = subprocess.Popen(['sleep', '120'])
    open(f('child.pid'), 'w').write(str(child.pid))
    time.sleep(120)
elif mode == 'term_resistant':
    signal.signal(signal.SIGTERM, lambda *a: None)
    child = subprocess.Popen([sys.executable, '-c', 'import signal,time; signal.signal(signal.SIGTERM, lambda *a: None); time.sleep(120)'])
    open(f('child.pid'), 'w').write(str(child.pid))
    time.sleep(120)
elif mode == 'no_stdin':
    time.sleep(120)
elif mode == 'slow_ok':
    time.sleep(1.5); ok_answer()
elif mode == 'slow_error':
    time.sleep(0.5); ev({'type': 'error', 'message': 'stream error: 500'}); time.sleep(2)
