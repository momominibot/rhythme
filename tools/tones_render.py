#!/usr/bin/env python3
"""Render the hidden spring's tones offline and measure them (docs/design/2026-10-22-soothing-tones.md, section 4).

Serves the repo, opens tools/fixtures/tones_render.html in headless Chromium and renders every pitch and every bed through a
version of ovu-tones.js in an OfflineAudioContext: the module as it is on disk (the default) or from a git ref (--before REF,
for example origin/main). Each render is 140 s with Stop at 132 s; the steady part measured is 10 to 130 s (two minutes, as the
Codex review asked), the first --preview seconds are written as WAV when --out is given, plus a loudness-matched copy (named
-matched, scaled to --match LUFS-like so timbres compare at one level; the raw files keep the real level differences).

Reports: sample peak and a 4x true-peak estimate, the mono-average peak, RMS of each channel and of the mono average, a K-weighted
ungated LUFS-like level, spectral centroid, the share of energy above 2 kHz, amplitude-modulation depth and dominant rate, the
share of modulation power that is a wobble (1.5 to 8 Hz), and the largest sample step at start and around Stop against the steady
state's own largest step (a diagnostic, since a high carrier's own slope can hide a small step), the level of the last half second.

Usage: python3 tools/tones_render.py [--before origin/main] [--rate 44100] [--out DIR] [--pitches 174,528,963] [--beds rain]
       [--scenarios none|name,name] [--json FILE] [--volume 0.25] [--selftest] [--compare BEFORE.json AFTER.json]
Scripted cases (replacement, the slider during a fade, the switch off during a fade, the slider to zero during a bed's
arrival) run with the on-disk module and must keep the peak under the loudest ceiling in play and go quiet when told.
Exit code 1 (for the on-disk module) when a target is missed: a sample or true peak above gainFor(volume), a nonzero first sample,
a start or stop step larger than the steady maximum, a wobble share above 0.5, a modulation depth above 4 dB for a tone, a tone's two channels more than 1.5 dB apart in RMS, or sound
left in the last half second (Stop on the audio clock must have silenced it)."""
import argparse, asyncio, base64, json, math, os, socket, subprocess, sys, time, wave
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PITCHES = [174, 285, 396, 417, 528, 639, 741, 852, 963]
BEDS = ['rain', 'stream', 'waves']
# scripted cases (Codex, 22 Oct): what a single start and Stop never shows. Each is a list of acts at render seconds; `quiet`
# names one-second windows that must be under -70 dBFS (a fading sound must follow the slider to zero and the switch to off)
SCENARIOS = [
    {'name': 'switch-pitch-bed-pitch', 'seconds': 100, 'script': [{'t': 0, 'op': 'start', 'arg': 528}, {'t': 20, 'op': 'start', 'arg': 963}, {'t': 40, 'op': 'bed', 'arg': 'rain'}, {'t': 60, 'op': 'start', 'arg': 174}, {'t': 80, 'op': 'stop'}], 'quiet': []},
    {'name': 'slider-up-down-zero-in-fade', 'seconds': 60, 'script': [{'t': 0, 'op': 'start', 'arg': 528}, {'t': 15, 'op': 'volume', 'arg': 1}, {'t': 30, 'op': 'volume', 'arg': 0.25}, {'t': 45, 'op': 'stop'}, {'t': 47, 'op': 'volume', 'arg': 0}], 'quiet': [49, 50, 51]},
    {'name': 'switch-off-in-fade', 'seconds': 30, 'script': [{'t': 0, 'op': 'start', 'arg': 528}, {'t': 20, 'op': 'stop'}, {'t': 21, 'op': 'off'}], 'quiet': [22, 23, 24]},
    {'name': 'bed-slider-zero-in-fade-in', 'seconds': 30, 'script': [{'t': 0, 'op': 'bed', 'arg': 'stream'}, {'t': 1, 'op': 'volume', 'arg': 0}], 'quiet': [3, 4, 5, 10, 20]}
]
# the estimator's own check: a plain sine must read as unmodulated, a sine modulated at 3 Hz by 30 per cent must read as a wobble near 3 Hz
SELFTEST = """(function (root) { var ctx = null, o = null, g = null;
  function gainFor(v) { return Math.round(v * 0.35 * 1000) / 1000; }
  root.OvuTones = { gainFor: gainFor, liveNodes: function () { return 0; }, start: function (hz) { ctx = new (root.AudioContext)(); var now = ctx.currentTime; g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gainFor(0.25), now + 2); g.connect(ctx.destination);
      o = ctx.createOscillator(); o.frequency.value = hz; var am = ctx.createGain(); am.gain.value = 1; o.connect(am); am.connect(g); o.start(now);
      if (root.AM) { var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = root.AM; lg.gain.value = 0.3; l.connect(lg); lg.connect(am.gain); l.start(now); }
      return true; }, startBed: function () { return false; }, stop: function () { var now = ctx.currentTime; g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(0, now + 2); o.stop(now + 2.1); } };
})(window);"""

def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p

def source(ref):
    if not ref: return open(os.path.join(ROOT, 'ovu-tones.js'), encoding='utf-8').read()
    return subprocess.check_output(['git', 'show', ref + ':ovu-tones.js'], cwd=ROOT).decode('utf-8')

def db(x): return 20 * math.log10(x) if x > 0 else -999

def write_wav(path, raw, sr, scale=1.0):
    if scale != 1.0:
        import array
        a = array.array('h'); a.frombytes(raw)
        for i in range(len(a)): a[i] = max(-32768, min(32767, int(round(a[i] * scale))))
        raw = a.tobytes()
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(sr); wf.writeframes(raw)

def compare(before, after):
    B = {r['case']: r for r in json.load(open(before))}; A = {r['case']: r for r in json.load(open(after))}
    print('%-12s %14s %14s %14s %14s %14s %14s' % ('case', 'peak dBFS', 'LUFS-like', 'centroid Hz', 'above 2k %', 'mod depth dB', 'beat Hz'))
    for k in A:
        if k not in B: continue
        b, a = B[k], A[k]
        print('%-12s %6.1f > %6.1f %6.1f > %6.1f %6.0f > %6.0f %6.1f > %6.1f %6.1f > %6.1f %6.2f > %6.2f' % (k, b['peakDb'], a['peakDb'], b['lufs'], a['lufs'], b['centroidHz'], a['centroidHz'], 100 * b['hiShare'], 100 * a['hiShare'], b['modDepthDb'], a['modDepthDb'], b['modRateHz'], a['modRateHz']))

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--before', default=''); ap.add_argument('--rate', type=int, default=48000); ap.add_argument('--out', default=''); ap.add_argument('--preview', type=float, default=22); ap.add_argument('--match', type=float, default=-26.0); ap.add_argument('--pitches', default=''); ap.add_argument('--beds', default=''); ap.add_argument('--json', default=''); ap.add_argument('--seconds', type=float, default=140); ap.add_argument('--volume', type=float, default=0.25); ap.add_argument('--selftest', action='store_true'); ap.add_argument('--scenarios', default=''); ap.add_argument('--compare', nargs=2); a = ap.parse_args()
    if a.compare: compare(a.compare[0], a.compare[1]); return
    pitches = [int(x) for x in a.pitches.split(',')] if a.pitches and a.pitches != 'none' else ([] if a.pitches == 'none' else PITCHES)
    beds = a.beds.split(',') if a.beds and a.beds != 'none' else ([] if a.beds == 'none' else BEDS)
    label = ('selftest' if a.selftest else (a.before or 'disk')); src = SELFTEST if a.selftest else source(a.before)
    port = free_port(); base = "http://127.0.0.1:%d/" % port
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.6)
    bad = []; rows = []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
            await page.goto(base + 'tools/fixtures/tones_render.html', wait_until='load')
            await page.wait_for_function("()=>window.renderTone")
            if a.selftest:
                cases = [{'name': 'plain-sine-528', 'hz': 528}, {'name': 'am-3hz-sine-528', 'hz': 528, 'am': 3}]
                ITU = [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585], [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621]]
                got = await page.evaluate("()=>kCoeffs(48000)")
                dev = max(abs(got[i][j] - ITU[i][j]) for i in range(2) for j in range(5))
                print('K-weighting at 48 kHz against the published tables: largest deviation %.2e %s' % (dev, 'ok' if dev < 1e-9 else 'FAILED'))
                if dev >= 1e-9: bad.append('K-weighting coefficients')
            else:
                cases = [{'name': 'tone-%d' % hz, 'hz': hz} for hz in pitches] + [{'name': 'bed-%s' % b, 'bed': b} for b in beds]
                if not a.before and not a.scenarios == 'none': cases += [dict(sc) for sc in SCENARIOS if not a.scenarios or sc['name'] in a.scenarios.split(',')]
            print('module: %s at %d Hz, %.0f s renders, steady %.0f to %.0f s, volume %.2f' % (label, a.rate, a.seconds, 10, a.seconds - 8, a.volume))
            print('%-14s %6s %6s %6s %6s %6s %6s %6s %7s %6s %6s %6s %6s %6s %6s %6s %s' % ('case', 'peak', 'tpeak', 'mono', 'rmsL', 'rmsR', 'rmsM', 'lufs', 'centrd', 'hi2k%', 'moddB', 'modHz', 'wobbl', 'start', 'stop', 'end', 'notes'))
            for c in cases:
                opts = dict(c); opts.update({'src': src, 'label': label, 'sampleRate': a.rate, 'seconds': c.get('seconds', a.seconds), 'stopAt': c.get('seconds', a.seconds) - 8, 'volume': a.volume, 'previewSeconds': a.preview if (a.out and not c.get('script')) else 0})
                if c.get('am'): opts['src'] = src.replace('root.AM', str(c['am']))
                r = await page.evaluate("(o)=>renderTone(o)", opts)
                if r.get('refused'): print('%-14s refused' % c['name']); bad.append(c['name'] + ' refused'); continue
                notes = []
                if c.get('script'):
                    ceil = db(r['gainMax']); wins = r['winPeaksDb']
                    if r['peakDb'] > ceil + 0.05: notes.append('PEAK OVER CEILING %.1f' % ceil); bad.append(c['name'] + ' peak %.1f > ceiling %.1f' % (r['peakDb'], ceil))
                    if r['truePeakDb'] > ceil + 0.3: notes.append('TRUE PEAK OVER'); bad.append(c['name'] + ' true peak %.1f' % r['truePeakDb'])
                    loud = [w for w in c['quiet'] if w < len(wins) and wins[w] > -70]
                    if loud: notes.append('NOT QUIET AT ' + ','.join('%ds %.0f' % (w, wins[w]) for w in loud)); bad.append(c['name'] + ' loud windows ' + ','.join(str(w) for w in loud))
                    if r['endDb'] > -80: notes.append('STILL SOUNDING AT END %.1f' % r['endDb']); bad.append(c['name'] + ' end %.1f dB' % r['endDb'])
                    print('%-28s peak %6.1f  true %6.1f  end %5.0f  ceiling %6.1f  %s' % (c['name'], r['peakDb'], r['truePeakDb'], r['endDb'], ceil, ' '.join(notes) or 'ok'))
                    rows.append({'case': c['name'], 'module': label, 'peakDb': r['peakDb'], 'truePeakDb': r['truePeakDb'], 'endDb': r['endDb'], 'winPeaksDb': wins}); continue
                ceil = db(r['gainFor'])
                if a.selftest: pass
                elif r['gainFor'] == 0:
                    if r['peakDb'] > -100: notes.append('NOT SILENT AT VOLUME 0'); bad.append(c['name'] + ' peak %.1f at volume 0' % r['peakDb'])
                elif r['peakDb'] > ceil + 0.05: notes.append('PEAK OVER CEILING %.1f' % ceil); bad.append(c['name'] + ' peak %.1f > ceiling %.1f' % (r['peakDb'], ceil))
                if not a.selftest and r['gainFor'] > 0 and r['truePeakDb'] > ceil + 0.3: notes.append('TRUE PEAK OVER'); bad.append(c['name'] + ' true peak %.1f > ceiling %.1f' % (r['truePeakDb'], ceil))
                if r['firstSample'] > 1e-4: notes.append('NONZERO FIRST SAMPLE'); bad.append(c['name'] + ' first sample %.4f' % r['firstSample'])
                if r['startStep'] > r['steadyStep'] * 1.05: notes.append('START STEP'); bad.append(c['name'] + ' start step %.4f > steady %.4f' % (r['startStep'], r['steadyStep']))
                if r['stopStep'] > r['steadyStep'] * 1.05: notes.append('STOP STEP'); bad.append(c['name'] + ' stop step %.4f > steady %.4f' % (r['stopStep'], r['steadyStep']))
                if c.get('hz') and not c.get('am') and r['wobbleShare'] > 0.5: notes.append('WOBBLE'); bad.append(c['name'] + ' wobble share %.2f' % r['wobbleShare'])
                if c.get('hz') and not c.get('am') and not a.selftest and r['modDepthDb'] > 4: notes.append('DEEP MODULATION'); bad.append(c['name'] + ' modulation depth %.1f dB' % r['modDepthDb'])
                if c.get('hz') and not a.selftest and abs(r['rmsLDb'] - r['rmsRDb']) > 1.5: notes.append('STEREO OFF BALANCE'); bad.append(c['name'] + ' channels %.1f dB apart' % abs(r['rmsLDb'] - r['rmsRDb']))
                if r['endDb'] > -80: notes.append('STILL SOUNDING AT END %.1f' % r['endDb']); bad.append(c['name'] + ' end %.1f dB' % r['endDb'])
                if a.selftest:
                    if c.get('am'): ok = 2.5 <= r['modRateHz'] <= 3.5 and r['wobbleShare'] > 0.8 and 2.5 <= r['modDepthDb'] <= 6.5
                    else: ok = r['modDepthDb'] < 0.3 and r['wobbleShare'] < 0.3
                    notes.append('selftest ' + ('ok' if ok else 'FAILED'))
                    if not ok: bad.append(c['name'] + ' estimator')
                print('%-14s %6.1f %6.1f %6.1f %6.1f %6.1f %6.1f %6.1f %7.0f %6.1f %6.1f %6.2f %6.2f %6.3f %6.3f %6.0f %s' % (c['name'], r['peakDb'], r['truePeakDb'], r['monoPeakDb'], r['rmsLDb'], r['rmsRDb'], r['rmsMonoDb'], r['lufs'], r['centroidHz'], 100 * r['hiShare'], r['modDepthDb'], r['modRateHz'], r['wobbleShare'], r['startStep'], r['stopStep'], r['endDb'], ' '.join(notes)))
                row = {k: v for k, v in r.items() if k != 'pcm'}; row['case'] = c['name']; row['module'] = label; rows.append(row)
                if a.out and r.get('pcm'):
                    os.makedirs(a.out, exist_ok=True)
                    raw = base64.b64decode(r['pcm']); stem = os.path.join(a.out, '%s-%dk-%s' % (label.replace('/', '-'), a.rate // 1000, c['name']))
                    write_wav(stem + '.wav', raw, r['sampleRate'])
                    write_wav(stem + '-matched.wav', raw, r['sampleRate'], 10 ** ((a.match - r['lufs']) / 20))
            if errs: bad.append('page errors: ' + '; '.join(errs[:3]))
            await browser.close()
    finally:
        srv.terminate()
    if a.json:
        with open(a.json, 'w') as f: json.dump(rows, f, indent=1)
    print('\n' + ('all targets met' if not bad else 'targets missed: ' + '; '.join(bad)))
    sys.exit(1 if (bad and not a.before) else 0)

if __name__ == '__main__':
    asyncio.run(main())
