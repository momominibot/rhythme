#!/usr/bin/env python3
"""Static checks for the Ovumind site: inline <script> syntax (node --check) on every
HTML page, external .js syntax, and local link/asset targets. Usage: python3 tools/check.py"""
import os, re, sys, subprocess, tempfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = sorted(f for f in os.listdir(root) if f.endswith('.html'))
bad = 0
for page in html:
    text = open(os.path.join(root, page), encoding='utf-8', errors='replace').read()
    for i, (attrs, s) in enumerate(re.findall(r'<script((?![^>]*\bsrc=)[^>]*)>([\s\S]*?)</script>', text, re.I)):
        if not s.strip() or 'ld+json' in attrs or 'importmap' in attrs or 'text/template' in attrs: continue
        ext = '.mjs' if 'module' in attrs else '.js'
        with tempfile.NamedTemporaryFile('w', suffix=ext, delete=False) as tf: tf.write(s); tmp = tf.name
        r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True); os.unlink(tmp)
        if r.returncode:
            bad += 1; lines = [l for l in r.stderr.strip().splitlines() if l.strip() and not l.startswith('Node.js') and 'node:internal' not in l]
            print('INLINE SCRIPT ERROR %s #%d: %s' % (page, i, ' | '.join(lines[-3:])[:260]))
for js in sorted(f for f in os.listdir(root) if f.endswith('.js')):
    r = subprocess.run(['node', '--check', os.path.join(root, js)], capture_output=True, text=True)
    if r.returncode: bad += 1; print('JS ERROR %s: %s' % (js, r.stderr.strip().splitlines()[-1][:160]))
attr = re.compile(r'(?:href|src|poster)\s*=\s*["\']([^"\']+)["\']', re.I)
missing = {}
for page in html:
    text = open(os.path.join(root, page), encoding='utf-8', errors='replace').read()
    for m in attr.finditer(text):
        u = m.group(1).strip()
        if not u or u.startswith('#') or re.match(r'^(https?:|mailto:|tel:|sms:|data:|javascript:|blob:|//)', u): continue
        path = u.split('#')[0].split('?')[0]
        if path and not os.path.exists(os.path.normpath(os.path.join(root, path))): missing.setdefault(u, []).append(page)
for u, pages in missing.items(): bad += 1; print('MISSING %s (e.g. %s)' % (u, pages[0]))
print('%d pages, %d problems' % (len(html), bad)); sys.exit(1 if bad else 0)
