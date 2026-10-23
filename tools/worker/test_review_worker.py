#!/usr/bin/env python3
"""The review worker's stop rules, with a fake codex and an in-process fake server. No model is ever called.
The real pinned CLI is checked separately, offline, by test_codex_offline.py.

Usage: python3 tools/worker/test_review_worker.py
"""
import importlib, json, os, shutil, signal, subprocess, sys, tempfile, threading, time, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
FAKE = os.path.join(HERE, 'fake_codex.py')
KEY = 'test-key-' + 'z' * 40
ALLOWED_ENV = {'HOME', 'PATH', 'LANG', 'CODEX_HOME', 'TMPDIR', 'RHYTHME_FAKE_DIR', '__CF_USER_TEXT_ENCODING',
               'CPATH', 'LIBRARY_PATH', 'MANPATH', 'SDKROOT', 'LC_CTYPE'}  # the last five come from macOS's python3 shim that runs the fake
MATRIX = {'prompt_copy': ['bed_tap', 'calendar_tap'], 'reminder_timing': ['reminder_time'], 'measurement_gap': ['metric_registry']}


class FakeServer:
    """the worker RPCs as a small state machine, with hooks a test can set to make a call fail or stop"""
    def __init__(self):
        self.calls = []; self.job = None; self.stages = {}; self.blocks = {}; self.cleared = set(); self.fail_next = {}; self.stop_at = {}
        self.beat_stop = False; self.beat_delay = 0; self.fail_answer = None

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
                    'registry': [{'metric': 'period_days'}], 'matrix': MATRIX, 'floor': 20}}
        if fn == 'worker_beat':
            time.sleep(self.beat_delay)
            return {'stop': 'review_off'} if self.beat_stop else {'ok': True}
        if fn == 'worker_post':
            self.stages[a['p_agent']] = 'accepted'; return {'ok': True, 'refs': []}
        if fn == 'worker_finish':
            if sum(1 for v in self.stages.values() if v == 'accepted') != 5: return {'error': 'stages_missing'}
            self.job['state'] = 'done'; return {'ok': True}
        if fn == 'worker_fail':
            if self.fail_answer is not None: return self.fail_answer
            b = self.blocks.setdefault(a['p_job'], 100 + len(self.blocks)); self.job['state'] = 'blocked'
            return {'ok': True, 'block': b}
        raise AssertionError(fn)

    def names(self):
        return [f for f, _ in self.calls]


class Base(unittest.TestCase):
    def setUp(self):
        self.home = tempfile.mkdtemp(prefix='rw-home-')
        self.bin = os.path.join(self.home, 'bin'); os.mkdir(self.bin)
        self.fake = os.path.join(self.home, 'fake'); os.mkdir(self.fake)
        shutil.copy(FAKE, os.path.join(self.bin, 'codex')); os.chmod(os.path.join(self.bin, 'codex'), 0o755)
        models = os.path.join(self.home, 'models_cache.json')
        json.dump({'models': [{'slug': 'gpt-6-astra', 'tool_mode': 'code_mode_only', 'shell_type': 'unified_exec', 'supports_search_tool': True}]}, open(models, 'w'))
        open(os.path.join(self.home, 'auth.json'), 'w').write('{}')
        os.environ.update({'HOME': self.home, 'RHYTHME_CODEX': os.path.join(self.bin, 'codex'), 'RHYTHME_WORKER_STATE': os.path.join(self.home, 'state'),
                           'RHYTHME_STAGE_TIMEOUT': '3', 'RHYTHME_BEAT_EVERY': '0.3', 'RHYTHME_KILL_GRACE': '0.5', 'SECRET_IN_PARENT': 'do-not-pass',
                           'PATH': self.bin + ':/usr/bin:/bin', 'RHYTHME_FAKE_DIR': self.fake, 'RHYTHME_CODEX_MODELS': models,
                           'RHYTHME_CODEX_AUTH': os.path.join(self.home, 'auth.json')})
        os.environ.pop('RHYTHME_TEST_PROVIDER_BASE', None)
        import review_worker; self.w = importlib.reload(review_worker)
        self.srv = FakeServer()

    def tearDown(self):
        shutil.rmtree(self.home, ignore_errors=True)

    def modes(self, *m):
        json.dump(list(m), open(os.path.join(self.fake, 'fake_modes.json'), 'w'))

    def calls(self):
        p = os.path.join(self.fake, 'calls.jsonl')
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

    def test_isolated_home_config_and_scrubbed_environment(self):
        self.modes('ok'); self.srv.queue(); self.w.once(self.srv)
        c = self.calls()[0]; argv = c['argv']
        for flag in ['--strict-config', '--ephemeral', '--ignore-rules', '--json', '--output-schema']:
            self.assertIn(flag, argv)
        self.assertNotIn('--ignore-user-config', argv, 'the throwaway config must load')
        self.assertEqual(argv[argv.index('-s') + 1], 'read-only')
        self.assertEqual(c['home_files'], ['auth.json', 'config.toml'], 'nothing else in CODEX_HOME: no AGENTS.md, rules, skills or memories')
        self.assertEqual(c['cwd_files'], [])
        cfg = c['config']
        for line in ['request_max_retries = 0', 'stream_max_retries = 0', 'supports_websockets = false', 'unbounded_connection_retries = false',
                     'model_provider = "rhythme"', '[agents]\nenabled = false', 'include_instructions = false', '[skills.bundled]\nenabled = false']:
            self.assertIn(line, cfg)
        self.assertNotIn('SECRET_IN_PARENT', c['env']); self.assertTrue(set(c['env']) <= ALLOWED_ENV, sorted(c['env']))
        self.assertFalse(c['prompt_has_key'])
        self.assertTrue(self.calls()[-1]['nimbus'])

    def test_model_catalog_switches_every_tool_off(self):
        h = self.w.Home()
        try:
            cat = json.load(open(os.path.join(h.root, 'models.json')))['models'][0]
            self.assertEqual((cat['tool_mode'], cat['shell_type'], cat['supports_search_tool']), ('direct', 'disabled', False))
        finally:
            h.close()

    def test_no_job_means_no_model_call(self):
        self.modes('ok')
        self.assertEqual(self.w.once(self.srv), 'idle')
        self.assertEqual(self.calls(), [])

    def test_change_pairs_become_an_object_for_the_server(self):
        self.modes('ok_proposal', 'ok'); self.srv.queue(); self.w.once(self.srv)
        rep = [a['p_report'] for f, a in self.srv.calls if f == 'worker_post'][0]
        self.assertEqual(rep['proposals'][0]['change'], {'copy': 'Tap the bed'})


class Preflight(Base):
    def test_wrong_version_claims_nothing(self):
        open(os.path.join(self.fake, 'version.txt'), 'w').write('codex-cli 0.161.0')
        self.modes('ok'); self.srv.queue()
        self.assertTrue(self.w.once(self.srv).startswith('not_ready'))
        self.assertNotIn('worker_claim', self.srv.names()); self.assertEqual(self.calls(), [])

    def test_a_feature_left_on_claims_nothing(self):
        open(os.path.join(self.fake, 'features.txt'), 'w').write('shell_tool  stable  true\n')
        self.modes('ok'); self.srv.queue()
        self.assertIn('shell_tool', self.w.once(self.srv))
        self.assertNotIn('worker_claim', self.srv.names())

    def test_relative_codex_path_claims_nothing(self):
        os.environ['RHYTHME_CODEX'] = 'codex'; w = importlib.reload(self.w)
        self.srv.queue()
        self.assertTrue(w.once(self.srv).startswith('not_ready'))
        self.assertNotIn('worker_claim', self.srv.names())

    def test_model_missing_from_the_cache_claims_nothing(self):
        json.dump({'models': [{'slug': 'other'}]}, open(os.environ['RHYTHME_CODEX_MODELS'], 'w'))
        self.srv.queue()
        self.assertTrue(self.w.once(self.srv).startswith('not_ready'))
        self.assertNotIn('worker_claim', self.srv.names())


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
    def test_http_429_on_stderr_with_exit_zero(self): self.run_fail('stderr_429_exit0', 'provider_limit')
    def test_http_401_on_stderr_with_exit_zero(self): self.run_fail('stderr_401_exit0', 'provider_error')
    def test_limit_in_an_ordinary_message(self): self.run_fail('limit_in_message', 'provider_limit')
    def test_limit_in_the_final_answer(self): self.run_fail('limit_in_answer', 'provider_limit')
    def test_an_unknown_event_such_as_a_transport_warning(self): self.run_fail('warning_event', 'provider_error')
    def test_early_error_event_followed_by_more_output(self): self.run_fail('early_error_then_more', 'provider_error')
    def test_reconnect_is_a_retry_and_stops(self): self.run_fail('reconnect', 'provider_error')
    def test_a_tool_event_stops(self): self.run_fail('tool_item', 'bad_output')
    def test_a_malformed_item_is_a_failure_not_a_success(self): self.run_fail('reader_crash', 'bad_output')
    def test_a_reader_exception_is_a_failure_not_a_success(self): self.run_fail('garbage_line', 'bad_output')
    def test_an_unterminated_huge_line_is_bounded(self): self.run_fail('huge_line', 'bad_output')
    def test_missing_turn_completed(self): self.run_fail('no_completed', 'provider_error')
    def test_invalid_json(self): self.run_fail('bad_json', 'bad_output')
    def test_duplicate_keys(self): self.run_fail('dup_keys', 'bad_output')
    def test_non_finite_number(self): self.run_fail('nan', 'bad_output')
    def test_kind_target_pair_outside_the_matrix_with_empty_change(self):
        self.run_fail('bad_contract', 'bad_output')
        self.assertNotIn('worker_post', self.srv.names())
    def test_non_zero_exit(self): self.run_fail('exit1', 'provider_error')

    def test_timeout_kills_the_whole_process_group(self):
        self.run_fail('hang', 'timeout')
        pid = int(open(os.path.join(self.fake, 'child.pid')).read())
        time.sleep(0.3)
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)

    def test_term_resistant_descendants_are_killed(self):
        self.run_fail('term_resistant', 'timeout')
        pid = int(open(os.path.join(self.fake, 'child.pid')).read())
        time.sleep(0.3)
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)

    def test_a_child_that_never_reads_stdin_still_times_out_with_heartbeats(self):
        self.modes('no_stdin'); self.srv.queue()
        big = 'x' * 400000
        orig = self.w.prompt
        self.w.prompt = lambda a, p: orig(a, p) + big
        try:
            t = time.monotonic()
            self.assertEqual(self.w.once(self.srv), 'failed:timeout')
            self.assertLess(time.monotonic() - t, 8)
        finally:
            self.w.prompt = orig
        self.assertIn('worker_beat', self.srv.names())

    def test_heartbeats_run_during_a_call_and_a_server_stop_kills_it_without_a_block(self):
        self.modes('slow_ok'); self.srv.queue(); self.srv.beat_stop = True
        self.assertEqual(self.w.once(self.srv), 'stopped')
        self.assertIn('worker_beat', self.srv.names())
        self.assertNotIn('worker_fail', self.srv.names()); self.assertIsNone(self.state('BLOCKED.json'))

    def test_a_provider_failure_seen_while_a_stop_arrives_still_becomes_a_block(self):
        self.modes('slow_error'); self.srv.queue(); self.srv.beat_stop = True; self.srv.beat_delay = 0.5  # the stop lands while the failure is handled
        self.assertEqual(self.w.once(self.srv), 'failed:provider_error')
        self.assertEqual(self.state('BLOCKED.json')['block'], 100)

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
        self.assertIsNone(self.state('attempt.json'))
        before = len(self.srv.calls)
        self.assertEqual(self.w.once(self.srv), 'blocked')
        self.assertEqual(self.srv.calls[before][0], 'worker_fail')
        self.assertIsNone(self.state('pending.json')); self.assertEqual(self.state('BLOCKED.json')['block'], 100)

    def test_a_refused_failure_record_stays_pending_and_claims_nothing(self):
        self.modes('exit1'); self.srv.queue(); self.srv.fail_answer = {'error': 'denied'}
        self.w.once(self.srv)
        self.assertEqual(self.state('pending.json')['code'], 'provider_error')
        self.srv.queue()
        self.assertEqual(self.w.once(self.srv), 'pending')
        self.assertEqual(self.srv.names().count('worker_claim'), 1)

    def test_pending_is_written_before_the_attempt_is_removed(self):
        order = []
        ow, orm = self.w.write_json, self.w.remove
        self.w.write_json = lambda n, o: (order.append(('w', n)), ow(n, o))[1]
        self.w.remove = lambda n: (order.append(('r', n)), orm(n))[1]
        try:
            self.modes('exit1'); self.srv.queue(); self.w.once(self.srv)
        finally:
            self.w.write_json, self.w.remove = ow, orm
        self.assertLess(order.index(('w', 'pending.json')), order.index(('r', 'attempt.json')))

    def test_a_pass_that_died_mid_call_is_recorded_as_uncertain_and_its_child_killed(self):
        self.modes('ok'); self.srv.queue()
        child = subprocess.Popen(['sleep', '60'], start_new_session=True)
        try:
            os.makedirs(os.path.join(self.home, 'state'), exist_ok=True)
            json.dump({'job': 'job-1', 'token': 'tok-1', 'stage': 'cycle', 'started': 0, 'pgid': child.pid, 'started_at': self.w.start_time(child.pid)},
                      open(os.path.join(self.home, 'state', 'attempt.json'), 'w'))
            threading.Thread(target=child.wait, daemon=True).start()
            self.assertEqual(self.w.once(self.srv), 'blocked')
            time.sleep(0.2)
            self.assertIsNotNone(child.poll(), 'the orphaned call is stopped')
        finally:
            if child.poll() is None: child.kill()
        fails = [a for f, a in self.srv.calls if f == 'worker_fail']
        self.assertEqual(fails[0]['p_code'], 'uncertain'); self.assertEqual(self.calls(), [])

    def test_a_recorded_child_whose_start_time_differs_is_left_alone(self):
        child = subprocess.Popen(['sleep', '60'], start_new_session=True)
        try:
            os.makedirs(os.path.join(self.home, 'state'), exist_ok=True)
            json.dump({'job': 'job-1', 'token': 'tok-1', 'stage': 'cycle', 'pgid': child.pid, 'started_at': 'Mon Jan  1 00:00:00 2001'},
                      open(os.path.join(self.home, 'state', 'attempt.json'), 'w'))
            self.w.recover_attempt()
            time.sleep(0.2)
            self.assertIsNone(child.poll(), 'a reused pid is not ours to kill')
        finally:
            child.kill(); child.wait()
        self.assertEqual(self.state('pending.json')['code'], 'uncertain')

    def test_the_lock_is_exclusive_and_released(self):
        fd = self.w.take_lock(); self.assertIsNotNone(fd)
        out = subprocess.run([sys.executable, '-c', 'import sys; sys.path.insert(0, %r); import review_worker as w; print(w.take_lock() is None)' % HERE],
                             capture_output=True, text=True, env=dict(os.environ))
        self.assertEqual(out.stdout.strip(), 'True')
        self.w.drop_lock(fd)
        fd2 = self.w.take_lock(); self.assertIsNotNone(fd2); self.w.drop_lock(fd2)

    def test_transport_failure_during_a_job_is_a_block(self):
        self.modes('ok'); self.srv.queue(); self.srv.fail_next['worker_post'] = 1
        self.assertEqual(self.w.once(self.srv), 'failed:transport')
        self.assertEqual(len(self.calls()), 1)


class Contract(Base):
    def test_strict_json(self):
        L = self.w.strict_loads
        self.assertEqual(L('{"a": 1.5}'), {'a': 1.5})
        for bad in ['{"a": 1, "a": 2}', '{"a": NaN}', '{"a": Infinity}', '{"a": -1e999}', '{"a": {"b": {"c": 1e400}}}', '[[[[[[[[1]]]]]]]]']:
            with self.assertRaises(ValueError, msg=bad):
                L(bad)

    def test_schema_is_strict_everywhere(self):
        def walk(s):
            if isinstance(s, dict):
                if s.get('type') == 'object':
                    self.assertIs(s.get('additionalProperties'), False, s)
                    self.assertEqual(set(s['required']), set(s['properties']), s)
                for v in s.values(): walk(v)
            elif isinstance(s, list):
                for v in s: walk(v)
        walk(self.w.schema('cycle')); walk(self.w.schema('orchestrator'))

    def test_matrix_metric_and_change_rules(self):
        C = self.w.check_report
        pay = {'matrix': MATRIX, 'registry': [{'metric': 'period_days'}]}
        good = {'kind': 'prompt_copy', 'target': 'bed_tap', 'metric': None, 'change': [{'key': 'copy', 'value': 'v'}], 'rationale': 'r'}
        C('cycle', {'summary': 's', 'notes': [], 'proposals': [good]}, pay)
        for bad in [dict(good, target='reminder_time'), dict(good, kind='measurement_gap', target='metric_registry'), dict(good, change=[]),
                    dict(good, change=[{'key': 'copy', 'value': 'a'}, {'key': 'copy', 'value': 'b'}]), dict(good, change=[{'key': 'Bad-Key', 'value': 'v'}]),
                    dict(good, metric='sleep_hours')]:
            with self.assertRaises(self.w.Fail, msg=bad):
                C('cycle', {'summary': 's', 'notes': [], 'proposals': [bad]}, pay)
        with self.assertRaises(self.w.Fail):
            C('cycle', {'summary': 'x' * 281, 'notes': [], 'proposals': []}, pay)
        with self.assertRaises(self.w.Fail):
            C('orchestrator', {'summary': 's', 'notes': [], 'proposals': []}, {'proposals': []})  # ranking is required


if __name__ == '__main__':
    unittest.main(verbosity=1)
