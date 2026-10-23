#!/usr/bin/env python3
"""A local stand-in for the model provider, for offline checks of the real pinned codex CLI. It never forwards
anything. Each POST is logged (path, headers without Authorization, body) to the JSONL file named by --log, then
answered by --mode: 500, 429, 401, drop (close without a reply), or ok (a minimal Responses stream whose answer is
--answer). Run: fake_provider.py --port N --log FILE --mode M [--answer JSON]"""
import argparse, json, http.server, socketserver

ap = argparse.ArgumentParser()
ap.add_argument('--port', type=int, required=True); ap.add_argument('--log', required=True)
ap.add_argument('--mode', required=True); ap.add_argument('--answer', default='{}')
a = ap.parse_args()


def sse(events):
    return ''.join('event: %s\ndata: %s\n\n' % (e['type'], json.dumps(e)) for e in events).encode()


class H(http.server.BaseHTTPRequestHandler):
    def log_message(self, *x):
        pass

    def do_GET(self):
        with open(a.log, 'a') as f: f.write(json.dumps({'method': 'GET', 'path': self.path}) + '\n')
        self.send_response(404); self.end_headers()

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(n).decode('utf-8', 'replace')
        try:
            parsed = json.loads(body)
        except ValueError:
            parsed = body
        hdr = {k: v for k, v in self.headers.items() if k.lower() not in ('authorization', 'cookie')}
        with open(a.log, 'a') as f: f.write(json.dumps({'method': 'POST', 'path': self.path, 'headers': hdr, 'body': parsed}) + '\n')
        if a.mode == 'drop':
            self.connection.close(); return
        if a.mode in ('500', '429', '401'):
            msg = {'500': 'server error', '429': 'Rate limit reached', '401': 'Unauthorized'}[a.mode]
            b = json.dumps({'error': {'message': msg, 'type': 'test'}}).encode()
            self.send_response(int(a.mode)); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b)))
            self.end_headers(); self.wfile.write(b); return
        text = a.answer
        rid, mid = 'resp_test', 'msg_test'
        item = {'id': mid, 'type': 'message', 'role': 'assistant', 'status': 'completed', 'content': [{'type': 'output_text', 'text': text, 'annotations': []}]}
        events = [
            {'type': 'response.created', 'response': {'id': rid, 'status': 'in_progress', 'output': []}},
            {'type': 'response.output_item.added', 'output_index': 0, 'item': dict(item, status='in_progress', content=[])},
            {'type': 'response.output_text.delta', 'item_id': mid, 'output_index': 0, 'content_index': 0, 'delta': text},
            {'type': 'response.output_item.done', 'output_index': 0, 'item': item},
            {'type': 'response.completed', 'response': {'id': rid, 'status': 'completed', 'output': [item],
                                                        'usage': {'input_tokens': 1, 'output_tokens': 1, 'total_tokens': 2}}},
        ]
        b = sse(events)
        self.send_response(200); self.send_header('Content-Type', 'text/event-stream'); self.send_header('Content-Length', str(len(b)))
        self.end_headers(); self.wfile.write(b)


class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


S(('127.0.0.1', a.port), H).serve_forever()
