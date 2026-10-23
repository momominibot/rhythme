#!/usr/bin/env python3
"""A stand-in for `codex` in the worker tests. It never calls a model. Its behaviour for each call comes from
$HOME/fake_modes.json (a list, one mode per call, the last repeated), and every call is logged to $HOME/calls.jsonl
with its argv and environment keys, so a test can count calls and check flags. (The worker scrubs the environment,
so files under HOME are the only channel.)"""
import json, os, subprocess, sys, time

home = os.environ.get('HOME', '')
if sys.argv[1:2] == ['--version']:
    print('codex-cli 0.160.0-fake'); sys.exit(0)
log = os.path.join(home, 'calls.jsonl')
modes = json.load(open(os.path.join(home, 'fake_modes.json')))
n = sum(1 for _ in open(log)) if os.path.exists(log) else 0
mode = modes[min(n, len(modes) - 1)]
prompt = sys.stdin.read()
out = sys.argv[sys.argv.index('-o') + 1]
with open(log, 'a') as f:
    f.write(json.dumps({'argv': sys.argv[1:], 'env': sorted(os.environ), 'mode': mode, 'nimbus': 'Nimbus' in prompt[:200], 'prompt_has_key': 'p_key' in prompt}) + '\n')


def ev(o):
    print(json.dumps(o), flush=True)


rep = {'summary': 'The numbers look steady.', 'notes': [], 'proposals': []}
if 'Nimbus' in prompt[:200]: rep['ranking'] = []
ev({'type': 'thread.started', 'thread_id': 't1'}); ev({'type': 'turn.started'})
if mode == 'ok':
    open(out, 'w').write(json.dumps(rep)); ev({'type': 'item.completed', 'item': {'type': 'agent_message', 'text': 'ok'}}); ev({'type': 'turn.completed', 'usage': {}})
elif mode == 'limit_stderr_exit0':
    open(out, 'w').write(json.dumps(rep)); ev({'type': 'turn.completed'}); print("You've hit your usage limit. Try again later.", file=sys.stderr)
elif mode == 'early_error_then_more':
    ev({'type': 'error', 'message': 'stream error: 500'}); open(out, 'w').write(json.dumps(rep))
    for _ in range(50): ev({'type': 'item.completed', 'item': {'type': 'agent_message', 'text': 'filler'}})
    ev({'type': 'turn.completed'})
elif mode == 'reconnect':
    ev({'type': 'item.completed', 'item': {'type': 'error', 'message': 'Reconnecting... 1/5'}}); open(out, 'w').write(json.dumps(rep)); ev({'type': 'turn.completed'})
elif mode == 'tool_item':
    ev({'type': 'item.started', 'item': {'type': 'command_execution', 'command': 'cat /etc/passwd'}}); open(out, 'w').write(json.dumps(rep)); ev({'type': 'turn.completed'})
elif mode == 'no_completed':
    open(out, 'w').write(json.dumps(rep))
elif mode == 'bad_json':
    open(out, 'w').write('{"summary": "x", '); ev({'type': 'turn.completed'})
elif mode == 'dup_keys':
    open(out, 'w').write('{"summary": "a", "summary": "b", "notes": [], "proposals": []}'); ev({'type': 'turn.completed'})
elif mode == 'nan':
    open(out, 'w').write('{"summary": "a", "notes": [], "proposals": [{"kind": "prompt_copy", "target": "bed_tap", "metric": null, "change": {"x": 1e999}, "rationale": "r"}]}'); ev({'type': 'turn.completed'})
elif mode == 'bad_contract':
    open(out, 'w').write(json.dumps({'summary': 'a', 'notes': [], 'proposals': [{'kind': 'points_rule', 'target': 'bed_tap', 'metric': None, 'change': {}, 'rationale': 'r'}]})); ev({'type': 'turn.completed'})
elif mode == 'exit1':
    sys.exit(1)
elif mode == 'hang':
    child = subprocess.Popen(['sleep', '120'])
    open(os.path.join(home, 'child.pid'), 'w').write(str(child.pid))
    time.sleep(120)
elif mode == 'slow_ok':
    time.sleep(1.5); open(out, 'w').write(json.dumps(rep)); ev({'type': 'turn.completed'})
