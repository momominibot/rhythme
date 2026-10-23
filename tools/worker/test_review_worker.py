#!/usr/bin/env python3
"""The review worker's stop rules, with a fake codex and an in-process fake server. No model is ever called.

Usage: python3 tools/worker/test_review_worker.py
"""
import importlib, json, os, shutil, signal, sys, tempfile, time, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
FAKE = os.path.join(HERE, 'fake_codex.py')
KEY = 'test-key-' + 'z' * 40
SHIM = {'CPATH', 'LIBRARY_PATH', 'MANPATH', 'SDKROOT', 'LC_CTYPE'}  # added by macOS's /usr/bin/python3 shim that runs the fake, not by the worker


class FakeServer:
    """the worker RPCs as a small state machine, with hooks a test can set to make a call fail or stop"""
    def __init__(self):
        self.calls = []; self.job = None; self.stages = {}; self.blocks = {}; self.cleared = set(); self.fail_next = {}; self.stop_at = {}; self.beat_stop = False

    def queue(self):
        self.job = {'job': 'job-1', 'token': 'tok-1', 'state': 'queued'}

    def rpc(self, fn, **a):
        self.calls.append((fn, a))
        if self.fail_next.get(fn):
            self.fail_next[fn] -= 1; raise OSError('network down')
        if fn == 'worker_claim':
            if a.get('p_local_block') is not None:
                return {'local_block': a['p_local_block'], 'cleared': a['p_local_block'] in self.cleared}
            if not self.job or self.job['state'] != 'queued': return {'job': None}
            self.job['state'] = 'claimed'
            return {'job': 'job-1', 'token': 'tok-1', 'run': 'run-1', 'stages': ['cycle', 'sleep', 'food', 'mind', 'orchestrator']}
        if fn == 'worker_stage_begin':
            ag = a['p_agent']
            if ag in self.stop_at: return {'stop': self.stop_at[ag]}
            if ag in self.stages: return {'error': 'already_admitted'}
            self.stages[ag] = 'admitted'
            if ag == 'orchestrator':
                return {'agent': ag, 'payload': {'reports': {}, 'proposals': []}}
            return {'agent': ag, 'payload': {'findings': [{'metric': 'period_days', 'window': 'w', 'value': 40, 'people': 20, 'suppressed': False, 'state': 'measured'}],
                    'registry': [{'metric': 'period_days'}], 'kinds': ['prompt_copy'], 'targets': ['bed_tap'], 'floor': 20}}
        if fn == 'worker_beat':
            return {'stop': 'review_off'} if self.beat_stop else {'ok': True}
        if fn == 'worker_post':
            self.stages[a['p_agent']] = 'accepted'; return {'ok': True, 'refs': []}
        if fn == 'worker_finish':
            if sum(1 for v in self.stages.values() if v == 'accepted') != 5: return {'error': 'stages_missing'}
            self.job['state'] = 'done'; return {'ok': True}
        if fn == 'worker_fail':
            b = self.blocks.setdefault(a['p_job'], 100 + len(self.blocks)); self.job['state'] = 'blocked'
            return {'ok': True, 'block': b}
        raise AssertionError(fn)

    def names(self):
        return [f for f, _ in self.calls]


class Base(unittest.TestCase):
    def setUp(self):
        self.home = tempfile.mkdtemp(prefix='rw-home-')
        self.bin = os.path.join(self.home, 'bin'); os.mkdir(self.bin)
        shutil.copy(FAKE, os.path.join(self.bin, 'codex')); os.chmod(os.path.join(self.bin, 'codex'), 0o755)
        os.environ.update({'HOME': self.home, 'RHYTHME_CODEX': os.path.join(self.bin, 'codex'), 'RHYTHME_WORKER_STATE': os.path.join(self.home, 'state'),
                           'RHYTHME_STAGE_TIMEOUT': '3', 'RHYTHME_BEAT_EVERY': '0.3', 'SECRET_IN_PARENT': 'do-not-pass', 'PATH': self.bin + ':/usr/bin:/bin'})
        import review_worker; self.w = importlib.reload(review_worker)
        self.srv = FakeServer()

    def tearDown(self):
        shutil.rmtree(self.home, ignore_errors=True)

    def modes(self, *m):
        json.dump(list(m), open(os.path.join(self.home, 'fake_modes.json'), 'w'))

    def calls(self):
        p = os.path.join(self.home, 'calls.jsonl')
        return [json.loads(l) for l in open(p)] if os.path.exists(p) else []

    def state(self, name):
        p = os.path.join(self.home, 'state', name)
        return json.load(open(p)) if os.path.exists(p) else None


class HappyPath(Base):
    def test_five_stages_in_order_then_finish(self):
        self.modes('ok'); self.srv.queue()
        self.assertEqual(self.w.once(self.srv), 'done')
        begins = [a['p_agent'] for f, a in self.srv.calls if f == 'worker_stage_begin']
        posts = [a['p_agent'] for f, a in self.srv.calls if f == 'worker_post']
        self.assertEqual(begins, ['cycle', 'sleep', 'food', 'mind', 'orchestrator'])
        self.assertEqual(posts, begins)
        self.assertEqual(self.srv.names()[-1], 'worker_finish')
        self.assertEqual(len(self.calls()), 5)
        self.assertIsNone(self.state('attempt.json')); self.assertIsNone(self.state('BLOCKED.json'))
        prov = [a['p_provenance'] for f, a in self.srv.calls if f == 'worker_post'][0]
        self.assertEqual(set(prov), {'cli', 'model', 'prompt_v', 'schema_v', 'output_hash'})

    def test_flags_and_scrubbed_environment(self):
        self.modes('ok'); self.srv.queue(); self.w.once(self.srv)
        c = self.calls()[0]; argv = c['argv']
        for flag in ['--ephemeral', '--ignore-user-config', '--ignore-rules', '--json', '--output-schema']:
            self.assertIn(flag, argv)
        self.assertEqual(argv[argv.index('-s') + 1], 'read-only')
        disabled = [argv[i + 1] for i, x in enumerate(argv) if x == '--disable']
        self.assertTrue({'shell_tool', 'unified_exec', 'apps', 'browser_use', 'computer_use', 'memories', 'plugins', 'multi_agent', 'hooks'} <= set(disabled))
        self.assertIn('model_providers.openai.request_max_retries=0', argv); self.assertIn('model_providers.openai.stream_max_retries=0', argv)
        self.assertNotIn('SECRET_IN_PARENT', c['env']); self.assertTrue(set(c['env']) <= {'HOME', 'PATH', 'LANG', 'CODEX_HOME', 'TMPDIR', '__CF_USER_TEXT_ENCODING'} | SHIM, sorted(c['env']))
        self.assertFalse(c['prompt_has_key'])
        self.assertTrue(self.calls()[-1]['nimbus'])

    def test_no_job_means_no_model_call(self):
        self.modes('ok')
        self.assertEqual(self.w.once(self.srv), 'idle')
        self.assertEqual(self.calls(), [])


class StopRules(Base):
    def run_fail(self, mode, code, at=0):
        self.modes(*(['ok'] * at + [mode, 'ok'])); self.srv.queue()
        self.assertEqual(self.w.once(self.srv), 'failed:' + code)
        self.assertEqual(len(self.calls()), at + 1, 'no further model call after the first failure')
        fails = [a for f, a in self.srv.calls if f == 'worker_fail']
        self.assertEqual(len(fails), 1); self.assertEqual(fails[0]['p_code'], code)
        self.assertEqual(self.state('BLOCKED.json')['block'], 100)
        self.assertIsNone(self.state('pending.json')); self.assertIsNone(self.state('attempt.json'))
        self.assertNotIn('worker_finish', self.srv.names())

    def test_limit_phrase_on_stderr_with_exit_zero(self): self.run_fail('limit_stderr_exit0', 'provider_limit', at=2)
    def test_early_error_event_followed_by_more_output(self): self.run_fail('early_error_then_more', 'provider_error')
    def test_reconnect_is_a_retry_and_stops(self): self.run_fail('reconnect', 'provider_error')
    def test_a_tool_event_stops(self): self.run_fail('tool_item', 'bad_output')
    def test_missing_turn_completed(self): self.run_fail('no_completed', 'provider_error')
    def test_invalid_json(self): self.run_fail('bad_json', 'bad_output')
    def test_duplicate_keys(self): self.run_fail('dup_keys', 'bad_output')
    def test_non_finite_number(self): self.run_fail('nan', 'bad_output')
    def test_contract_checked_before_posting(self):
        self.run_fail('bad_contract', 'bad_output')
        self.assertNotIn('worker_post', self.srv.names())
    def test_non_zero_exit(self): self.run_fail('exit1', 'provider_error')

    def test_timeout_kills_the_whole_process_group(self):
        self.run_fail('hang', 'timeout')
        pid = int(open(os.path.join(self.home, 'child.pid')).read())
        time.sleep(0.3)
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)

    def test_heartbeats_run_during_a_call_and_a_server_stop_kills_it_without_a_block(self):
        self.modes('slow_ok'); self.srv.queue(); self.srv.beat_stop = True
        self.assertEqual(self.w.once(self.srv), 'stopped')
        self.assertIn('worker_beat', self.srv.names())
        self.assertNotIn('worker_fail', self.srv.names()); self.assertIsNone(self.state('BLOCKED.json'))

    def test_server_stop_at_admission_calls_no_model(self):
        self.modes('ok'); self.srv.queue(); self.srv.stop_at['sleep'] = 'run_held'
        self.assertEqual(self.w.once(self.srv), 'stopped')
        self.assertEqual(len(self.calls()), 1)
        self.assertNotIn('worker_fail', self.srv.names())


class Recovery(Base):
    def test_blocked_worker_never_calls_a_model_and_unblocks_only_on_that_block_cleared(self):
        self.modes('exit1', 'ok'); self.srv.queue(); self.w.once(self.srv)
        self.srv.job = None; self.srv.queue(); self.srv.stages = {}
        self.assertEqual(self.w.once(self.srv), 'blocked')
        self.assertEqual(len(self.calls()), 1)
        self.srv.cleared.add(999)
        self.assertEqual(self.w.once(self.srv), 'blocked')
        self.srv.cleared.add(100)
        self.assertEqual(self.w.once(self.srv), 'unblocked')
        self.assertEqual(len(self.calls()), 1, 'unblocking itself claims nothing in the same pass')
        self.assertEqual(self.w.once(self.srv), 'done')

    def test_failure_record_survives_a_network_drop_and_is_sent_first(self):
        self.modes('exit1'); self.srv.queue(); self.srv.fail_next['worker_fail'] = 1
        self.assertEqual(self.w.once(self.srv), 'failed:provider_error')
        self.assertEqual(self.state('pending.json')['code'], 'provider_error'); self.assertIsNone(self.state('BLOCKED.json'))
        before = len(self.srv.calls)
        self.assertEqual(self.w.once(self.srv), 'blocked')
        self.assertEqual(self.srv.calls[before][0], 'worker_fail')
        self.assertIsNone(self.state('pending.json')); self.assertEqual(self.state('BLOCKED.json')['block'], 100)

    def test_a_pass_that_died_mid_call_is_recorded_as_uncertain(self):
        self.modes('ok'); self.srv.queue()
        os.makedirs(os.path.join(self.home, 'state'), exist_ok=True)
        json.dump({'job': 'job-1', 'token': 'tok-1', 'stage': 'cycle', 'started': 0}, open(os.path.join(self.home, 'state', 'attempt.json'), 'w'))
        self.assertEqual(self.w.once(self.srv), 'blocked')
        fails = [a for f, a in self.srv.calls if f == 'worker_fail']
        self.assertEqual(fails[0]['p_code'], 'uncertain'); self.assertEqual(self.calls(), [])

    def test_a_live_lock_holder_means_this_pass_does_nothing(self):
        os.makedirs(os.path.join(self.home, 'state', 'lock'))
        open(os.path.join(self.home, 'state', 'lock', 'pid'), 'w').write(str(os.getpid()))
        self.assertFalse(self.w.take_lock())
        open(os.path.join(self.home, 'state', 'lock', 'pid'), 'w').write('999999')
        self.assertTrue(self.w.take_lock()); self.w.drop_lock()

    def test_transport_failure_during_a_job_is_a_block(self):
        self.modes('ok'); self.srv.queue(); self.srv.fail_next['worker_post'] = 1
        self.assertEqual(self.w.once(self.srv), 'failed:transport')
        self.assertEqual(len(self.calls()), 1)


class StrictJson(Base):
    def test_cases(self):
        L = self.w.strict_loads
        self.assertEqual(L('{"a": 1.5}'), {'a': 1.5})
        for bad in ['{"a": 1, "a": 2}', '{"a": NaN}', '{"a": Infinity}', '{"a": -1e999}', '{"a": {"b": {"c": 1e400}}}', '[[[[[[[[1]]]]]]]]']:
            with self.assertRaises(ValueError, msg=bad):
                L(bad)


if __name__ == '__main__':
    unittest.main(verbosity=1)
