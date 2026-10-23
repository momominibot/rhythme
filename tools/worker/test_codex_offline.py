#!/usr/bin/env python3
"""The real pinned codex CLI, run by the worker's own run_codex against a local stand-in provider (fake_provider.py):
one request per call for every failure the provider can give, the right failure code, no tools offered, and none of
this Mac's own instructions in what is sent. No model is ever called and the real auth file is never read.

Usage: python3 tools/worker/test_codex_offline.py   (skips when the pinned CLI is not installed)
"""
import json, os, socket, subprocess, sys, tempfile, time, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import review_worker as w

PERSONAL = ('Jamie', 'momominibot', 'michiyomimi', 'Hermes', 'jevtriage', 'Doubao', 'Rhythme staff' + ' dashboard')


@unittest.skipUnless(os.path.isfile(w.CODEX) and os.path.isfile(w.MODELS), 'pinned codex CLI or its model cache not installed')
class RealCli(unittest.TestCase):
    def call(self, mode):
        s = socket.socket(); s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]; s.close()
        log = tempfile.mktemp(suffix='.jsonl')
        ans = json.dumps({'summary': 'Steady.', 'notes': [], 'proposals': []})
        srv = subprocess.Popen([sys.executable, os.path.join(HERE, 'fake_provider.py'), '--port', str(port), '--log', log, '--mode', mode, '--answer', ans])
        try:
            for _ in range(50):
                try:
                    socket.create_connection(('127.0.0.1', port), 0.2).close(); break
                except OSError:
                    time.sleep(0.1)
            os.environ['RHYTHME_TEST_PROVIDER_BASE'] = 'http://127.0.0.1:%d/v1' % port
            try:
                res = ('ok', w.run_codex('cycle', {'findings': [], 'matrix': {}, 'registry': []}, lambda: True, lambda pg, st: None))
            except w.Fail as e:
                res = ('fail', e.code)
        finally:
            os.environ.pop('RHYTHME_TEST_PROVIDER_BASE', None)
            srv.terminate(); srv.wait()
        rows = [json.loads(l) for l in open(log)] if os.path.exists(log) else []
        return res, [r for r in rows if r['method'] == 'POST']

    def test_preflight_passes_on_the_pinned_cli(self):
        os.environ['RHYTHME_TEST_PROVIDER_BASE'] = 'http://127.0.0.1:9/v1'
        try:
            self.assertEqual(w.preflight(), w.PINNED)
        finally:
            os.environ.pop('RHYTHME_TEST_PROVIDER_BASE', None)

    def test_each_failure_is_one_request_and_the_right_code(self):
        for mode, code in [('500', 'provider_error'), ('429', 'provider_limit'), ('401', 'provider_error'), ('drop', 'provider_error')]:
            res, posts = self.call(mode)
            self.assertEqual(res, ('fail', code), mode)
            self.assertEqual(len(posts), 1, mode + ': exactly one request, no retry, no fallback')

    def test_a_clean_answer_parses_and_offers_no_usable_tools(self):
        res, posts = self.call('ok')
        self.assertEqual(res[0], 'ok'); self.assertEqual(res[1][0]['summary'], 'Steady.')
        self.assertEqual(len(posts), 1)
        body = posts[0]['body']
        self.assertEqual(body.get('tools', []), [])
        names = []
        for it in body['input']:
            if it.get('type') == 'additional_tools':
                def walk(t):
                    for x in t.get('tools', []):
                        names.append(x.get('name')); walk(x)
                walk(it)
        self.assertTrue(set(names) <= {'functions', 'request_user_input'}, names)  # Plan-mode only; any tool event is refused anyway
        text = json.dumps(body)
        for word in PERSONAL:
            self.assertNotIn(word, text, word)
        self.assertNotIn('skills_instructions', text); self.assertNotIn('multi_agent_role', text)


if __name__ == '__main__':
    unittest.main(verbosity=1)
