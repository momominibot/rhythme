#!/usr/bin/env python3
"""Render Rhythme's music offline and measure it (design docs/design/2026-10-21-game-music.md, section 8).

Serves the repo, opens tools/fixtures/music_render.html in headless Chromium, renders every theme and band for two loops
into an OfflineAudioContext through the module's own render(), and reports peak and sustained RMS in dBFS on the music
bus, the loop seam, a crossfade and a duck. Writes WAV previews (the first N seconds) when --out is given.

Usage: python3 tools/music_render.py [--out DIR] [--preview 40] [--quick]
Exit code 1 when a level target is missed: peaks above -24 dBFS, the loudest sustained second outside -44 to -34 dBFS, a duck
window louder than -60 dBFS, a crossfade whose one-second levels span more than 12 dB, or a seam step more than three times
the largest step elsewhere. (Measured 21 Oct 2026 at the default slider: peaks -24 to -26, loud seconds -37 to -42.)"""
import argparse, asyncio, base64, os, socket, subprocess, sys, time, wave
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEMES = ['home', 'garden', 'farm', 'street', 'plaza', 'harbour', 'cave']
BANDS = ['morning', 'day', 'evening', 'night']

def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--out', default=''); ap.add_argument('--preview', type=float, default=40); ap.add_argument('--quick', action='store_true'); ap.add_argument('--themes', default=''); a = ap.parse_args()
    global THEMES
    if a.themes: THEMES = a.themes.split(',')
    port = free_port(); base = "http://127.0.0.1:%d/" % port
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.6)
    bad = []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
            await page.goto(base + 'tools/fixtures/music_render.html', wait_until='load')
            await page.wait_for_function("()=>window.OvuMusic && window.renderCase")
            cases = []
            for t in THEMES:
                for b in (['day', 'night'] if a.quick else BANDS):
                    cases.append({'name': '%s-%s' % (t, b), 'theme': t, 'band': b, 'loops': 2})
            cases.append({'name': 'duck-home-day', 'theme': 'home', 'band': 'day', 'loops': 1, 'duckAt': 20})
            cases.append({'name': 'crossfade-home-garden', 'theme': 'home', 'band': 'day', 'loops': 1, 'crossfadeTo': 'garden', 'crossfadeAt': 15})
            print('%-26s %8s %8s %9s %9s %7s %s' % ('case', 'peak', 'rms', 'loud 1s', 'quiet 1s', 'seam', 'notes'))
            for c in cases:
                beat = 60.0 / tempo(c['theme'], c['band'])
                secs = 0.1 + 128 * beat * c['loops'] + 3
                opts = dict(c); opts['seconds'] = secs; opts['previewSeconds'] = min(a.preview, secs) if a.out else 0
                r = await page.evaluate("(o)=>renderCase(o)", opts)
                w = r['windowsDb']; sustained = [x for x in w[1:-4]] or w
                loud = max(sustained); quiet = min(sustained)
                notes = []
                if r['peakDb'] > -24: notes.append('PEAK HIGH'); bad.append(c['name'] + ' peak %.1f' % r['peakDb'])
                if not c.get('duckAt') and not c.get('crossfadeTo') and not (-44 <= loud <= -34): notes.append('LOUD SECOND OUT'); bad.append(c['name'] + ' loud second %.1f' % loud)
                if c['loops'] >= 2 and r['seamStep'] > 3 * r['maxStep']: notes.append('SEAM'); bad.append(c['name'] + ' seam')
                if c.get('duckAt'):
                    dw = w[int(c['duckAt']) + 1: int(c['duckAt']) + 4]
                    if max(dw) > -60: notes.append('DUCK LOUD %.1f' % max(dw)); bad.append(c['name'] + ' duck %.1f' % max(dw))
                    else: notes.append('duck %.1f dB' % max(dw))
                if c.get('crossfadeTo'):
                    cw = w[int(c['crossfadeAt']) - 2: int(c['crossfadeAt']) + 4]
                    if max(cw) - min(cw) > 12: notes.append('CROSSFADE JUMP %.1f' % (max(cw) - min(cw))); bad.append(c['name'] + ' jump')
                    else: notes.append('crossfade span %.1f dB' % (max(cw) - min(cw)))
                print('%-26s %7.1f %8.1f %9.1f %9.1f %7.4f %s' % (c['name'], r['peakDb'], r['rmsDb'], loud, quiet, r['seamStep'], ' '.join(notes)))
                if a.out and r.get('pcm'):
                    os.makedirs(a.out, exist_ok=True)
                    with wave.open(os.path.join(a.out, c['name'] + '.wav'), 'wb') as wf:
                        wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(r['sampleRate']); wf.writeframes(base64.b64decode(r['pcm']))
            if errs: bad.append('page errors: ' + '; '.join(errs[:3]))
            await browser.close()
    finally:
        srv.terminate()
    print('\n' + ('all level targets met' if not bad else 'targets missed: ' + '; '.join(bad)))
    sys.exit(1 if bad else 0)

def tempo(theme, band):
    # kept in step with THEMES in ovu-music.js (22 Oct: slower tempos and the cave)
    T = {'home': {'morning': 61, 'day': 61, 'evening': 56, 'night': 49}, 'garden': {'morning': 65, 'day': 65, 'evening': 60, 'night': 51}, 'farm': {'morning': 60, 'day': 60, 'evening': 54, 'night': 49}, 'street': {'morning': 68, 'day': 68, 'evening': 61, 'night': 51}, 'plaza': {'morning': 71, 'day': 71, 'evening': 65, 'night': 53}, 'cave': {'morning': 48, 'day': 48, 'evening': 46, 'night': 44}, 'harbour': {'morning': 54, 'day': 54, 'evening': 51, 'night': 48}}
    return T[theme][band]

if __name__ == '__main__':
    asyncio.run(main())
