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

# Every page she can reach from the room (tools/page_inventory.py) looks like the room and has a way back to it
# (Jamie, 22 Oct: "can you do something to all these inconsistency"). A page with content of its own links the room's
# stylesheet for pages (ovu-pages.css) or for the older pages (rhythme-legacy.css), and either links back to room.html
# itself or loads appnav.js with a .top bar for it to turn into the room's back button and title. A retired page is a
# stub in three parts (location.replace, a meta refresh, a plain link). No reachable page opens one of Rhythme's own
# pages in a new tab, wears the old night palette or shows an em dash.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import page_inventory
inv = page_inventory.crawl()
stubs = {j['page']: (j['target'] or '').split('#')[0] for j in inv if j['kind'] == 'stub'}
own_blank = re.compile(r'<a\b(?=[^>]*\btarget\s*=\s*["\']_blank)(?=[^>]*\bhref\s*=\s*["\'](?!https?:|mailto:|tel:)[^"\']*\.html)[^>]*>', re.I)
for i in inv:
    name = i['page']; text = open(os.path.join(root, name), encoding='utf-8', errors='replace').read()
    if i['kind'] == 'page':
        if not ({'ovu-pages.css', 'rhythme-legacy.css'} & set(i['styles'])): bad += 1; print('LOOK %s does not link ovu-pages.css or rhythme-legacy.css' % name)
        back = re.search(r'href\s*=\s*["\']room\.html', text) or ('appnav.js' in i['scripts'] and re.search(r'class\s*=\s*["\'][^"\']*\btop\b', text))
        if not back: bad += 1; print('BACK %s has no way back to the room (no room.html link, no appnav.js with a .top bar)' % name)
    if i['kind'] != 'stub':
        for m in own_blank.finditer(text): bad += 1; print('NEWTAB %s opens its own page in a new tab: %s' % (name, m.group(0)[:120]))
        if 'ovu-night-palette.css' in i['styles']: bad += 1; print('NIGHT %s links the retired night palette' % name)
        vis = re.sub(r'<[^>]+>', ' ', re.sub(r'<!--[\s\S]*?-->|<script[\s\S]*?</script>|<style[\s\S]*?</style>', '', text))
        if '\u2014' in vis: bad += 1; print('DASH %s shows an em dash: %s' % (name, re.search(r'.{0,30}\u2014.{0,20}', vis).group(0).strip()))
        # a link to a retired page that only sends her back to this same page goes nowhere
        for href in set(re.findall(r'href\s*=\s*["\']([a-z0-9-]+\.html)', text)):
            if stubs.get(href) == name: bad += 1; print('LOOP %s links %s, which only leads back to %s' % (name, href, name))
    else:
        t = i['target']
        if not (re.search(r'<meta http-equiv="refresh" content="0;\s*url=' + re.escape(t) + '"', text) and re.search(r'<a href="' + re.escape(t) + '"', text)):
            bad += 1; print('STUB %s needs location.replace, a meta refresh and a plain link to %s' % (name, t))
print('%d pages, %d reachable from the room (%d with their own content), %d problems' % (len(html), len(inv), sum(1 for i in inv if i['kind'] == 'page'), bad)); sys.exit(1 if bad else 0)
