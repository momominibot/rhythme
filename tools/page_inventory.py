#!/usr/bin/env python3
"""Every page a person can reach from the room, found by following links the way the app does.

Starts at room.html and follows, page by page: href/location strings in the page itself, page names in the
local scripts it loads (room.js, the ovu-* modules, appnav.js's link router, journey.js's chapter links), and
the target of each redirect stub. Each reachable page is classed as
  room    the room itself
  stub    a retired page that only sends her on (location.replace), with its target
  page    a page with content of its own
Usage: python3 tools/page_inventory.py          (a table)
       python3 tools/page_inventory.py --json   (for the screenshot and check tools)
Imported by tools/check.py, which holds every page in the inventory to the room's look and a way back."""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = re.compile(r'(?<![\w/.-])([a-z0-9][a-z0-9-]*\.html)(?:#([a-z0-9_-]*))?', re.I)
SRC = re.compile(r'<script[^>]*\bsrc\s*=\s*["\']([^"\'?#]+\.js)', re.I)
CSS = re.compile(r'<link[^>]*\bhref\s*=\s*["\']([^"\'?#]+\.css)', re.I)
REPLACE = re.compile(r'location\.replace\(\s*["\']([^"\']+)["\']', re.I)

def read(name):
    try:
        with open(os.path.join(ROOT, name), encoding='utf-8', errors='replace') as f: return f.read()
    except OSError: return ''

def strip_comments(js):
    """block and line comments out of a script, so a page named in a comment is not a link"""
    js = re.sub(r'/\*[\s\S]*?\*/', '', js)
    return re.sub(r'(?m)(^|[^:\'"\\])//[^\n]*', r'\1', js)

def html_comments_out(text):
    return re.sub(r'<!--[\s\S]*?-->', '', text)

def scripts_of(text):
    return [s for s in SRC.findall(text) if not re.match(r'^(https?:)?//', s) and os.path.exists(os.path.join(ROOT, s))]

def styles_of(text):
    return [s for s in CSS.findall(text) if not re.match(r'^(https?:)?//', s)]

def stub_target(text):
    """a retired page: tiny, and its only job is location.replace to somewhere else"""
    m = REPLACE.search(text)
    if not m: return None
    body = re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>|<[^>]+>', ' ', text)
    words = len(re.findall(r'[A-Za-z]{2,}', body))
    return m.group(1) if text.count('\n') < 40 and words < 60 else None

def links_in(name, text):
    out = set()
    for m in PAGE.finditer(html_comments_out(text)): out.add(m.group(1).lower())
    for js in scripts_of(text):
        src = strip_comments(read(js))
        for m in PAGE.finditer(src): out.add(m.group(1).lower())
        if js == 'journey.js':  # chapter links are built as 'journey-' + id + '.html'
            out.update(f for f in os.listdir(ROOT) if re.match(r'^journey-[a-z]+\.html$', f))
    return {p for p in out if p != name and os.path.exists(os.path.join(ROOT, p))}

def crawl(start='room.html'):
    seen, order, todo = {}, [], [start]
    while todo:
        name = todo.pop(0)
        if name in seen: continue
        text = read(name)
        tgt = stub_target(text)
        kind = 'room' if name == 'room.html' else ('stub' if tgt else 'page')
        info = {'page': name, 'kind': kind, 'target': tgt, 'styles': styles_of(text), 'scripts': scripts_of(text)}
        title = re.search(r'<title>([^<]*)</title>', text, re.I); info['title'] = title.group(1).strip() if title else ''
        seen[name] = info; order.append(name)
        nxt = set()
        if tgt:
            m = PAGE.search(tgt)
            if m and os.path.exists(os.path.join(ROOT, m.group(1))): nxt.add(m.group(1))
        else:
            nxt = links_in(name, text)
        for p in sorted(nxt):
            if p not in seen: todo.append(p)
    return [seen[n] for n in order]

if __name__ == '__main__':
    inv = crawl()
    if '--json' in sys.argv: print(json.dumps(inv, indent=1)); sys.exit(0)
    for k in ('room', 'page', 'stub'):
        rows = [i for i in inv if i['kind'] == k]
        print('%s (%d)' % (k, len(rows)))
        for i in rows: print('  %-26s %s' % (i['page'], ('-> ' + i['target']) if i['target'] else i['title']))
    allp = sorted(f for f in os.listdir(ROOT) if f.endswith('.html'))
    print('not reachable from the room (%d): %s' % (len(set(allp) - {i['page'] for i in inv}), ' '.join(sorted(set(allp) - {i['page'] for i in inv}))))
