/* Rhythme pure tones (Jamie, 21 Oct 2026: "sounds frequency like this without any voiceover just sound in the cave", then
 * "for the sitting in the cave will be different - it's purely frequency sounds"). Sitting by the hidden spring IS the
 * tone: she chooses one of the nine pitches many apps sell as "Solfeggio frequencies" (174 to 963 Hz) and sits on the
 * warm stone while the crystals hum at it. Rhythme makes no claim about what a tone does: the names those apps attach to
 * them have no evidence behind them (docs/design/2026-10-21-cave-tones.md), so they are not used here; some people simply
 * find a steady sound restful. Web Audio synthesis, so nothing is downloaded or streamed.
 * Jamie, 22 Oct: "all the frequency sounds are very eerie". The first voice was a bare sine with a twin a third of a
 * percent away, which beat faster the higher the pitch (3.4 Hz at 963 Hz, right where the ear notices a wobble most).
 * The voice is now a sung bowl (docs/design/2026-10-22-soothing-tones.md): a fundamental, a soft octave, one soft
 * inharmonic partial and, for the higher pitches, a hum an octave below; each split into close sines a fixed fraction of a
 * hertz apart so every pitch shimmers at the same slow pace; low-passed, placed in a small room made from seeded decaying
 * noise, breathing at 0.1 Hz, and fading in and out over several seconds from exactly nothing, so no click. The app's own
 * volume setting bounds it, never loud. No voice in the cave. Sitting and sound end together: when the chosen time is up,
 * when she leaves the spring or walks, when sleep begins, when the page is hidden, on clear or import, or at Stop. Nothing
 * here writes a diary entry, costs energy or earns hearts. Pure parts first (testable in node), then the scene. */
(function (root) {
  'use strict';
  var FREQS = [174, 285, 396, 417, 528, 639, 741, 852, 963];
  var MINUTES = [null, 10, 20, 30]; /* open-ended, or a quiet stop after a while */
  var CEILING = 0.35; /* the loudest the tone ever is, as a share of the app volume: tones carry further than the room's soft sounds */
  /* what sound-bath tradition says about each pitch (Jamie, 22 Oct: "You need explanation for these frequency sounds"): shown as
   * tradition, with one honest line that research has not shown a pitch does any of this; never a health claim */
  var MEANING = { 174: 'grounding', 285: 'restoring', 396: 'letting go of worry', 417: 'fresh starts', 528: 'warmth', 639: 'connection', 741: 'clarity', 852: 'intuition', 963: 'stillness' };
  /* nature beds, made on the phone from soft noise (Jamie: "we can add in rain sounds and etc"): rain, a stream, waves */
  var BEDS = { rain: 'Rain', stream: 'Stream', waves: 'Waves' };
  function label(hz) { hz = Number(hz); if (FREQS.indexOf(hz) < 0) return ''; var i = FREQS.indexOf(hz); return hz + ' Hz, ' + (i < 3 ? 'low' : i < 6 ? 'middle' : 'high'); }
  function valid(hz) { return FREQS.indexOf(Number(hz)) > -1; }
  function gainFor(appVolume) { var v = Number(appVolume); if (!isFinite(v) || v < 0) v = 0; if (v > 1) v = 1; return Math.round(v * CEILING * 1000) / 1000; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  /* ---------- the voice, as data ---------- */
  /* A sung bowl's partials (Terwagne and Bush 2011; Golas and Filipek 2016): the fundamental, its octave (the harmonic a rubbed
   * bowl locks into), the struck bowl's next mode near 2.76 times the pitch, and a bell's hum an octave below for pitches
   * with room beneath them. Each partial is two or three sines a fixed fraction of a hertz apart (offset in Hz, relative
   * level, pan), so it shimmers at 0.2 to 0.7 Hz whatever the pitch. The twins are quiet (Codex, 22 Oct: a slow beat is
   * not a shallow one; equal twins cancel fully), so the fundamental's swing stays under 3 dB; its pattern repeats every
   * 100 s. Partial levels and the hum are listening hypotheses, to be judged by ear, not findings. */
  var PARTIALS = [
    { id: 'fundamental', ratio: 1, level: 1.0, voices: [[0, 1, 0], [0.21, 0.1, 0.35], [-0.37, 0.05, -0.35]] },
    { id: 'octave', ratio: 2, level: 0.24, voices: [[0, 1, 0], [0.5, 0.1, -0.2]] },
    { id: 'third', ratio: 2.76, level: 0.07, voices: [[0, 1, 0.25], [-0.7, 0.1, -0.25]] },
    { id: 'hum', ratio: 0.5, level: 0.25, voices: [[0, 1, 0], [0.3, 0.1, 0]], from: 300, full: 600 }
  ];
  var SWELL = { hz: 0.1, base: 0.92, depth: 0.08 }; /* the breath: six times a minute, under a decibel either way */
  /* the arrival: an exponential approach with a 2.5 s time constant, half way at 1.7 s and 95 per cent at 7.5 s, gentler than the
   * old 2.5 s line. The leaving: five seconds of exponential approach to nothing, then a 50 ms ramp to exactly zero, the sines
   * stopped on the audio clock just after, the master closed after them so the room's tail cannot escape; the nodes are let go
   * two seconds later as housekeeping (a wall-clock timer that may run late while the page is hidden never decides when sound ends) */
  var ENV = { attackTau: 2.5, releaseSeconds: 5, releaseAfter: 7 };
  var FILTER_Q_DB = -6; /* a Web Audio low-pass or high-pass takes its Q in decibels: -6 dB is the critically damped slope, no peak, so the filter never passes gain one */
  /* a small dark room from seeded decaying noise. A noise impulse answers each exact frequency with its own random gain, so the
   * room's share is set per pitch from the impulse's measured response at that pitch's sines (roomGain): the loudest sine
   * gets exactly `wet`, and dry + wet never passes one, whatever the sample rate */
  var ROOM = { seconds: 2.2, dry: 0.78, wet: 0.2, spread: 0.4, seed: 2210, cutoff: 2500 }; /* dry + wet is 0.98: a fifth of a decibel in hand for the room's memory while a voice leaves */
  /* `spread`: the two ears hear one room, not two. Each ear's impulse is a shared decaying noise plus half as much of its own, so
   * the room's answer to a sine is mostly the same in both channels (independent impulses left one ear up to 4 dB louder than the
   * other on some pitches in the offline measurement); the harness holds the channels within 1.5 dB.
   * The peak budget: the sines' gains sum to one in the louder channel; the filter never passes gain one; the swell tops at one;
   * dry 0.78 plus the room's loudest sine at 0.2 is under one; so the master gain (the ceiling) bounds the loudest sample. When a pitch
   * replaces another, the old voice leaves with a 0.12 s time constant while the new arrives with 2.5 s, so their sum falls from
   * one before it rises again and never exceeds it. */
  function humShare(hz) { var p = PARTIALS[3]; return clamp((hz - p.from) / (p.full - p.from), 0, 1); }
  function cutoffFor(hz) { return clamp(2.2 * hz, 700, 1800); } /* the octave of 963 Hz sits past the cutoff: softened, not bare */
  function panGains(pan) { var th = (clamp(pan, -1, 1) + 1) * Math.PI / 4; return [Math.cos(th), Math.sin(th)]; } /* equal power, as StereoPannerNode */
  /* every sine of one pitch: frequency, gain and pan, scaled so the loudest channel's gains sum to one (the pre-ceiling peak) */
  function voices(hz) {
    hz = Number(hz); if (!valid(hz)) return [];
    var out = [];
    PARTIALS.forEach(function (p) {
      var share = p.id === 'hum' ? humShare(hz) : 1; if (share <= 0) return;
      p.voices.forEach(function (v) { out.push({ partial: p.id, f: hz * p.ratio + v[0], gain: p.level * share * v[1], pan: v[2] }); });
    });
    var sumL = 0, sumR = 0; out.forEach(function (v) { var g = panGains(v.pan); sumL += v.gain * g[0]; sumR += v.gain * g[1]; });
    var k = 1 / Math.max(sumL, sumR); out.forEach(function (v) { v.gain = Math.round(v.gain * k * 1e4) / 1e4; });
    return out;
  }
  /* a small seeded generator (as in ovu-music.js), so the room and the beds are the same on the phone and in the offline render */
  function rng(seed) { var x = (seed * 2654435761) >>> 0 || 1; return function () { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  /* the room's impulse response: decaying noise, one-pole low-passed so the tail is dark, -60 dB at `seconds`; one shared sequence
   * plus `spread` of a sequence of each ear's own, so left and right are mostly one room and a little apart; both scaled by one peak */
  function impulse(sampleRate, seconds, seed) {
    var n = Math.round(sampleRate * seconds), a = 1 - Math.exp(-2 * Math.PI * ROOM.cutoff / sampleRate), seqs = [];
    for (var c = 0; c < 3; c++) {
      var r = rng(seed + c * 101), d = new Float32Array(n), y = 0;
      for (var i = 0; i < n; i++) { var w = r() * 2 - 1; y += a * (w - y); d[i] = y * Math.exp(-6.908 * i / n); }
      seqs.push(d);
    }
    var L = new Float32Array(n), R = new Float32Array(n), peak = 0;
    for (var j = 0; j < n; j++) { L[j] = seqs[0][j] + ROOM.spread * seqs[1][j]; R[j] = seqs[0][j] + ROOM.spread * seqs[2][j]; peak = Math.max(peak, Math.abs(L[j]), Math.abs(R[j])); }
    if (peak > 0) for (var k = 0; k < n; k++) { L[k] /= peak; R[k] /= peak; }
    return [L, R];
  }
  /* the impulse's steady gain for one sine: |H(f)| by a rotating phasor over the samples (no trig per sample); a pure function */
  function roomGain(ch, f, sampleRate) {
    var w = 2 * Math.PI * f / sampleRate, c = Math.cos(w), sn = Math.sin(w), re = 0, im = 0, cr = 1, ci = 0, n = ch.length;
    for (var i = 0; i < n; i++) { var x = ch[i]; re += x * cr; im -= x * ci; var t = cr * c - ci * sn; ci = cr * sn + ci * c; cr = t; }
    return Math.sqrt(re * re + im * im);
  }
  /* the room's share for a pitch: `wet` divided by the loudest response among its sines in either ear, so dry + wet bounds the peak */
  function wetFor(chans, hz, sampleRate) {
    var h = 0; voices(hz).forEach(function (v) { for (var c = 0; c < chans.length; c++) h = Math.max(h, roomGain(chans[c], v.f, sampleRate)); });
    return h > 0 ? ROOM.wet / h : 0;
  }
  /* a loopable buffer: the first `ov` samples are an equal-power blend of the start and the tail past `n`, so the loop point is
   * continuous and the level never dips (Codex: a plain fade at both ends would make a recurring hole) */
  function loopable(d, n, ov) {
    var out = new Float32Array(n);
    for (var i = 0; i < n; i++) { if (i < ov) { var th = Math.PI / 2 * i / ov; out[i] = d[i] * Math.sin(th) + d[n + i] * Math.cos(th); } else out[i] = d[i]; }
    return out;
  }
  /* pink noise by Paul Kellet's filter, brown by a leaky sum; scaled so the loudest sample is near a half */
  function noise(kind, n, seed) {
    var r = rng(seed), d = new Float32Array(n), b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, peak = 0;
    for (var i = 0; i < n; i++) {
      var w = r() * 2 - 1, v;
      if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980; v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; }
      else { last = (last + 0.02 * w) / 1.02; v = last; }
      d[i] = v; if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    if (peak > 0) for (var j = 0; j < n; j++) d[j] = d[j] * 0.5 / peak;
    return d;
  }
  var T = { MEANING: MEANING, BEDS: BEDS, FREQS: FREQS, MINUTES: MINUTES, CEILING: CEILING, PARTIALS: PARTIALS, SWELL: SWELL, ENV: ENV, ROOM: ROOM, label: label, valid: valid, gainFor: gainFor, voices: voices, humShare: humShare, cutoffFor: cutoffFor, panGains: panGains, impulse: impulse, roomGain: roomGain, wetFor: wetFor, noise: noise, loopable: loopable, FILTER_Q_DB: FILTER_Q_DB };
  root.OvuTones = T;
  /* the crystals are a hotspot of the hidden spring (its layout is data, so this holds in node too); like the warm stone
   * it walks her to the stone, because the crystals and the stone are one seat */
  var STONE_WP = { x: 55, y: 66, flip: true };
  var CAVE0 = root.OvuBarn && root.OvuBarn.CAVE;
  if (CAVE0 && !CAVE0.hotspots.some(function (h) { return h.id === 'crystals'; })) CAVE0.hotspots.push({ id: 'crystals', x: 24, y: 40, label: 'The crystals · a steady tone', prompt: 'Tap to sit by the water with a tone', icon: 'graphic_eq', wp: { x: STONE_WP.x, y: STONE_WP.y, flip: STONE_WP.flip } });

  /* ---------- the synth (browser only) ---------- */
  var ctx = null, gain = null, voice = null, playing = null, endAt = null, endT = null, fns = [], bed = null, bedNodes = null, held = [], roomBuf = null, roomChans = null, wets = {}, bufs = {};
  function AC() { return root.AudioContext || root.webkitAudioContext; }
  function notify() { fns.slice().forEach(function (f) { try { f(playing); } catch (e) { } }); }
  function appVolume() { var SND = root.OvuSound; try { return SND && SND.volume ? SND.volume() : 0.25; } catch (e) { return 0.25; } }
  /* the app's one sound switch rules the spring too (Codex, 22 Oct): off means nothing starts, and a sound already playing ends */
  function soundOn() { var SND = root.OvuSound; try { return SND && SND.enabled ? !!SND.enabled() : true; } catch (e) { return true; } }
  function ensure() { if (!ctx) ctx = new (AC())(); if (ctx.state === 'suspended' && ctx.resume) { try { var p = ctx.resume(); if (p && p.catch) p.catch(function () { }); } catch (e) { } } return ctx; }
  /* every node a start makes is held until its release, so a test can ask whether anything is still alive */
  function hold(nodes) { held.push(nodes); return nodes; }
  function release(nodes) { var i = held.indexOf(nodes); if (i > -1) held.splice(i, 1); nodes.forEach(function (x) { try { if (x.stop) x.stop(); } catch (e) { } try { x.disconnect(); } catch (e) { } }); }
  function liveNodes() { return held.reduce(function (n, a) { return n + a.length; }, 0); }
  function room(hz) {
    if (!roomBuf) { roomChans = impulse(ctx.sampleRate, ROOM.seconds, ROOM.seed); roomBuf = ctx.createBuffer(2, roomChans[0].length, ctx.sampleRate); roomBuf.getChannelData(0).set(roomChans[0]); roomBuf.getChannelData(1).set(roomChans[1]); }
    var key = hz + ':' + ctx.sampleRate; if (wets[key] == null) wets[key] = wetFor(roomChans, hz, ctx.sampleRate);
    var verb = ctx.createConvolver(); verb.normalize = false; verb.buffer = roomBuf; return { verb: verb, wet: wets[key] }; /* our own scale, not the browser's equal-power guess */
  }
  function start(hz, minutes) {
    hz = Number(hz); if (!valid(hz) || !AC() || !soundOn()) return false;
    var nodes = [];
    try {
      ensure();
      stopNodes(0.6); stopBed(0.6); bed = null; /* one sound by the water: a tone replaces a bed as a bed replaces a tone */
      var now = ctx.currentTime, g = gainFor(appVolume());
      gain = ctx.createGain(); nodes.push(gain); gain.gain.setValueAtTime(g, now); gain.connect(ctx.destination); /* the ceiling and the app's volume; every node joins `nodes` as it is made, so a failure half way releases all of them */
      var dry = ctx.createGain(), wet = ctx.createGain(), bus = ctx.createGain(); nodes.push(dry, wet, bus);
      var rm = room(hz), verb = rm.verb; nodes.push(verb);
      dry.gain.value = ROOM.dry; wet.gain.value = rm.wet; bus.connect(dry); dry.connect(gain); bus.connect(wet); wet.connect(verb); verb.connect(gain);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoffFor(hz); lp.Q.value = FILTER_Q_DB; lp.connect(bus);
      var swell = ctx.createGain(); swell.gain.value = SWELL.base; swell.connect(lp);
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = SWELL.hz; lg.gain.value = SWELL.depth; lfo.connect(lg); lg.connect(swell.gain); lfo.start(now);
      var env = ctx.createGain(); env.gain.setValueAtTime(0, now); env.gain.setTargetAtTime(1, now, ENV.attackTau); env.connect(swell); /* from exactly nothing, so no click */
      nodes.push(lp, swell, lfo, lg, env);
      voices(hz).forEach(function (v) {
        var o = ctx.createOscillator(), vg = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(v.f, now); vg.gain.value = v.gain; o.connect(vg);
        if (v.pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = v.pan; vg.connect(p); p.connect(env); nodes.push(p); } else vg.connect(env);
        o.start(now); nodes.push(o, vg);
      });
      voice = { nodes: hold(nodes), env: env, gain: gain };
    } catch (e) { release(nodes); voice = null; gain = null; playing = null; return false; } /* a half-built voice is torn down, never left humming */
    playing = hz; clearTimeout(endT); endAt = null;
    if (minutes && isFinite(minutes) && minutes > 0) { endAt = Date.now() + minutes * 60000; endT = setTimeout(function () { stop(); }, minutes * 60000); }
    notify(); return true;
  }
  /* let a sound go over `secs`: its envelope approaches nothing, then a short ramp to exactly zero; every source stops on the audio
   * clock just after; the master (after the room) closes last; the nodes are released as housekeeping two seconds on */
  function letGo(env, master, nodes, secs) {
    var now = ctx.currentTime, tau = Math.max(0.03, secs / 5), t0 = now + secs, p = env.gain, cur;
    try { cur = Math.max(0, p.value); p.cancelScheduledValues(now); p.setValueAtTime(cur, now); p.setTargetAtTime(0, now, tau); p.setValueAtTime(cur * Math.exp(-secs / tau), t0); p.linearRampToValueAtTime(0, t0 + 0.05); } catch (e) { }
    nodes.forEach(function (x) { if (x.stop && x !== env) { try { x.stop(t0 + 0.1); } catch (e) { } } });
    if (master && master !== env) { try { var m = master.gain; m.cancelScheduledValues(t0 + 0.1); m.setValueAtTime(Math.max(0, m.value), t0 + 0.1); m.linearRampToValueAtTime(0, t0 + 0.3); } catch (e) { } }
    setTimeout(function () { release(nodes); }, (secs + 2) * 1000);
  }
  function stopNodes(fade) {
    if (!ctx || !voice) return;
    var v = voice; voice = null; gain = null;
    letGo(v.env, v.gain, v.nodes, fade == null ? ENV.releaseSeconds : fade);
  }
  function stop() { if (!playing && !voice && !bed) { notify(); return; } stopNodes(); stopBed(2); playing = null; endAt = null; clearTimeout(endT); endT = null; notify(); }
  function noiseBuffer(kind) {
    var key = kind + ':' + ctx.sampleRate; if (bufs[key]) return bufs[key];
    var len = ctx.sampleRate * 6, ov = Math.round(ctx.sampleRate * 0.4), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) buf.getChannelData(c).set(loopable(noise(kind, len + ov, 610 + c * 7), len, ov));
    bufs[key] = buf; return buf;
  }
  /* a bed's peak budget: noise peaks near a half, a low-pass or high-pass at -3 dB never passes gain one, each bed's branches and
   * their modulation sum to at most 1.2, so a bed's loudest sample stays under 0.6 of the master (the ceiling itself) */
  function startBed(kind, minutes) {
    if (!BEDS[kind] || !AC() || !soundOn()) return false;
    var nodes = [];
    try {
      ensure();
      stopBed(0.4); stopNodes(0.4); playing = null;
      var now = ctx.currentTime, g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gainFor(appVolume()), now + 3); g.connect(ctx.destination); nodes.push(g);
      var ramp = ctx.createGain(); ramp.gain.setValueAtTime(0, now); ramp.gain.setTargetAtTime(1, now, 1); ramp.connect(g); nodes.push(ramp); /* the envelope the leaving uses, before the master */
      function source(k) { var s = ctx.createBufferSource(); s.buffer = noiseBuffer(k); s.loop = true; nodes.push(s); return s; }
      function filter(type, f, q) { var x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; nodes.push(x); return x; } /* Q: decibels for low and high pass, linear for a band pass */
      function lfo(hz, depth, param, base) { var o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = hz; og.gain.value = depth; o.connect(og); og.connect(param); if (base != null) param.value = base; o.start(now); nodes.push(o, og); return o; }
      if (kind === 'rain') { /* soft pink rain: nothing hisses above the roof; a slow drift like a gust (1 +/- 0.1) */
        var pr = source('pink'), hp = filter('highpass', 300, -3), lp = filter('lowpass', 3500, -3), drift = ctx.createGain(); nodes.push(drift);
        pr.connect(hp); hp.connect(lp); lp.connect(drift); drift.connect(ramp); lfo(0.04, 0.1, drift.gain, 1);
      } else if (kind === 'stream') { /* brown water (0.85 +/- 0.15) with a quiet burble, 14 dB under it, whose centre wanders */
        var sb = source('brown'), lp2 = filter('lowpass', 1100, -3), mod = ctx.createGain(); nodes.push(mod);
        sb.connect(lp2); lp2.connect(mod); mod.connect(ramp); lfo(0.3, 0.15, mod.gain, 0.85);
        var sb2 = source('brown'), bp = filter('bandpass', 700, 2), bg = ctx.createGain(); bg.gain.value = 0.2; nodes.push(bg);
        sb2.connect(bp); bp.connect(bg); bg.connect(mod); lfo(0.23, 200, bp.frequency, 700);
      } else { /* waves: a deep swell every eleven seconds (0.55 +/- 0.45) and a soft wash (0.06 +/- 0.05) that rises with it */
        var sw = source('brown'), lp3 = filter('lowpass', 520, -3), mod2 = ctx.createGain(); nodes.push(mod2);
        sw.connect(lp3); lp3.connect(mod2); mod2.connect(ramp); var swl = lfo(0.09, 0.45, mod2.gain, 0.55);
        var pw = source('pink'), bp2 = filter('bandpass', 1800, 0.6), wash = ctx.createGain(); nodes.push(wash);
        pw.connect(bp2); bp2.connect(wash); wash.connect(ramp); var wg = ctx.createGain(); wg.gain.value = 0.05; swl.connect(wg); wg.connect(wash.gain); wash.gain.value = 0.06; nodes.push(wg);
      }
      nodes.forEach(function (x) { if (x.start && x.buffer) x.start(now); });
      bedNodes = hold(nodes); bed = kind;
    } catch (e) { release(nodes); bedNodes = null; bed = null; return false; }
    clearTimeout(endT); endAt = null;
    if (minutes && isFinite(minutes) && minutes > 0) { endAt = Date.now() + minutes * 60000; endT = setTimeout(function () { stop(); }, minutes * 60000); }
    notify(); return true;
  }
  function stopBed(fade) {
    if (!bedNodes || !ctx) { bed = null; return; }
    var ns = bedNodes; bedNodes = null; bed = null;
    letGo(ns[1], ns[0], ns, fade == null ? 2 : fade);
  }
  function remaining() { return endAt ? Math.max(0, Math.round((endAt - Date.now()) / 1000)) : null; }
  function setVolume() { if (!ctx) return; try { if (gain) gain.gain.setTargetAtTime(gainFor(appVolume()), ctx.currentTime, 0.3); if (bedNodes) bedNodes[0].gain.setTargetAtTime(gainFor(appVolume()), ctx.currentTime, 0.3); } catch (e) { } }
  T.start = start; T.startBed = startBed; T.bed = function () { return bed; }; T.stop = stop; T.playing = function () { return playing; }; T.remaining = remaining; T.setVolume = setVolume; T.onChange = function (f) { fns.push(f); }; T.liveNodes = liveNodes; T.soundOn = soundOn;

  /* ---------- the hidden spring: sitting by the water is the tone ---------- */
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, B = root.OvuBarn, CARE = root.OvuCare, doc = root.document;
  if (!R || !S || !doc || !B || !B.CAVE) return;
  var CAVE = B.CAVE, ART = R.ART;
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inCave() { var L = R.layout(); return !!L && L.id === 'cave'; }
  function idle() { return !((W.napping && W.napping()) || (CARE && CARE.live && CARE.live())); }
  var pick = { snd: 'none', hz: 528, min: null }, sitting = null;
  function minsLabel(m) { return m ? m + ' minutes' : 'Until I stop'; }
  var SOUNDS = [['none', 'Just sit'], ['tone', 'Tone'], ['rain', 'Rain'], ['stream', 'Stream'], ['waves', 'Waves']];
  function meaningLine() { return pick.snd === 'tone' ? pick.hz + ' Hz: in sound-bath tradition, ' + MEANING[pick.hz] + '. Research has not shown that a pitch does this; keep it if it feels restful.' : pick.snd === 'none' ? 'Sit quietly by the water. Nothing plays.' : BEDS[pick.snd] + ', made softly on your phone.'; }
  /* the warm stone (Jamie, 22 Oct: "avatar can be sitted without listening to the frequency wave"): just sit, or sit with a
   * tone or a nature sound; Stop ends both */
  function openSpring() {
    var on = playing, hasBed = bed;
    if (on) pick.snd = 'tone'; else if (hasBed) pick.snd = hasBed;
    R.openSheet('cavetones', 'Sit by the water', 'By the warm spring', 'graphic_eq',
      '<div class="field sqf"><span class="lbl">Sound</span><div class="chips" role="group" aria-label="Sound" id="toneSnd">' + SOUNDS.map(function (x) { return '<button type="button" class="chipbtn' + (pick.snd === x[0] ? ' on' : '') + '" data-snd="' + x[0] + '" aria-pressed="' + (pick.snd === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="field sqf"><span class="lbl">Pitch</span><div class="chips tonechips" role="group" aria-label="Pitch" id="toneHz">' + FREQS.map(function (f) { return '<button type="button" class="chipbtn' + (pick.snd === 'tone' && pick.hz === f ? ' on' : '') + '" data-hz="' + f + '" aria-pressed="' + (pick.snd === 'tone' && pick.hz === f) + '">' + f + ' Hz</button>'; }).join('') + '</div></div>' +
      '<p class="help tonemean" id="toneMean">' + esc(meaningLine()) + '</p>' +
      '<div class="field sqf"><span class="lbl">For how long</span><div class="chips" role="group" aria-label="For how long" id="toneMin">' + MINUTES.map(function (m) { return '<button type="button" class="chipbtn' + (pick.min === m ? ' on' : '') + '" data-min="' + (m || 0) + '" aria-pressed="' + (pick.min === m) + '">' + minsLabel(m) + '</button>'; }).join('') + '</div></div>' +
      '<div class="row" id="toneActs"><button type="button" class="btn primary" data-tone="start"><span class="ms">chair</span>' + (on || hasBed || sitting ? 'Change the sound' : 'Sit by the water') + '</button>' + (on || hasBed || sitting ? '<button type="button" class="btn ghost" data-tone="stop"><span class="ms">stop_circle</span>Stand up</button>' : '') + '</div>' +
      '<p class="help">Keep it comfortable, and stop if a sound bothers you.</p>');
    var sndBox = doc.getElementById('toneSnd'), hzBox = doc.getElementById('toneHz'), minBox = doc.getElementById('toneMin'), acts = doc.getElementById('toneActs'), mean = doc.getElementById('toneMean');
    function repaint() {
      Array.prototype.forEach.call(sndBox.querySelectorAll('.chipbtn'), function (b) { var o = b.dataset.snd === pick.snd; b.classList.toggle('on', o); b.setAttribute('aria-pressed', String(o)); });
      Array.prototype.forEach.call(hzBox.querySelectorAll('.chipbtn'), function (b) { var o = pick.snd === 'tone' && Number(b.dataset.hz) === pick.hz; b.classList.toggle('on', o); b.setAttribute('aria-pressed', String(o)); });
      Array.prototype.forEach.call(minBox.querySelectorAll('.chipbtn'), function (b) { var o = (Number(b.dataset.min) || null) === pick.min; b.classList.toggle('on', o); b.setAttribute('aria-pressed', String(o)); });
      if (mean) mean.textContent = meaningLine();
    }
    sndBox.addEventListener('click', function (e) { var b = e.target.closest('[data-snd]'); if (!b) return; pick.snd = b.dataset.snd; repaint(); R.chime('tap'); });
    hzBox.addEventListener('click', function (e) { var b = e.target.closest('[data-hz]'); if (!b) return; pick.hz = Number(b.dataset.hz); pick.snd = 'tone'; repaint(); R.chime('tap'); });
    minBox.addEventListener('click', function (e) { var b = e.target.closest('[data-min]'); if (!b) return; pick.min = Number(b.dataset.min) || null; repaint(); R.chime('tap'); });
    acts.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tone]'); if (!b) return;
      if (b.dataset.tone === 'stop') { endAll(); R.hideSheet(); return; }
      if (!inCave() || !idle()) { R.hideSheet(); return; }
      if (pick.snd !== 'none' && !soundOn()) { R.toast('Sound is switched off in the room, so nothing would play. She can still just sit.', 'info'); return; }
      stop();
      var ok = pick.snd === 'tone' ? start(pick.hz, pick.min) : pick.snd === 'none' ? true : startBed(pick.snd, pick.min);
      if (!ok) { R.toast('This phone could not make that sound just now. She can still just sit.', 'info'); return; }
      if (pick.snd === 'none' && pick.min) { clearTimeout(endT); endAt = Date.now() + pick.min * 60000; endT = setTimeout(function () { endAll(); }, pick.min * 60000); }
      R.hideSheet(); sitDown(pick.snd);
    });
  }
  function endAll() { stop(); standUp(); }
  /* her seated sprite on the warm stone while the tone plays; one Stop for both */
  function sitDown(snd) {
    if (!inCave()) return;
    if (sitting) { sitting.snd = snd || 'none'; sitting.stop.innerHTML = '<span class="ms">stop_circle</span>' + (sitting.snd === 'none' ? 'Stand up' : 'Stop sound and stand up'); return; }
    var G = root.OvuGarden, el = doc.createElement('div'), outfit = (function (o) { return /^[a-z0-9-]{1,32}$/.test(o || '') ? o : 'base'; })(S.profile().outfit); /* an imported outfit name never becomes markup (Codex sweep, 21 Oct) */
    el.className = 'nb springsitter tonesitter'; el.dataset.id = 'tonesitter'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<img src="' + ART + 'avatar-' + outfit + '.webp" alt="">';
    var stopBtn = doc.createElement('button'); stopBtn.type = 'button'; stopBtn.className = 'springstop'; stopBtn.id = 'springStop'; stopBtn.innerHTML = '<span class="ms">stop_circle</span>' + (snd === 'none' ? 'Stand up' : 'Stop sound and stand up');
    R.els.props.appendChild(el); R.els.scene.appendChild(stopBtn);
    if (G && G.seatPlace) { G.seatPlace(el, CAVE.seat); G.seatedImg(el.querySelector('img'), el.querySelector('img').src); }
    else { el.style.left = CAVE.seat.x + '%'; el.style.top = CAVE.seat.groundY + '%'; el.style.width = '9%'; }
    sitting = { el: el, stop: stopBtn, snd: snd || 'none' }; R.els.scene.classList.add('sitting', 'springsit');
    stopBtn.addEventListener('click', function (e) { e.stopPropagation(); endAll(); });
    try { stopBtn.focus({ preventScroll: true }); } catch (e) { }
    if (R.moment) R.moment('springsit', { quiet: true, pose: null });
  }
  function standUp() {
    if (!sitting) return; var s = sitting; sitting = null;
    if (s.el.parentNode) s.el.remove(); if (s.stop.parentNode) s.stop.remove();
    R.els.scene.classList.remove('sitting', 'springsit');
  }
  T.onChange(function (hz) { if (!hz && !bed && sitting && sitting.snd !== 'none' && endAt === null) standUp(); }); /* the sound ends (time up, Stop, leaving, sleep, hidden): she gets up */
  var opener = function (id, L) { if (!L || L.id !== 'cave') return false; if ((W.napping && W.napping()) || R.busy() || !idle()) return true; openSpring(); return true; };
  R.hotspotHandlers.crystals = opener; R.hotspotHandlers.warmstone = opener;
  R.on('boot', function () {
    R.on('layout', function (L) { if (!L || L.id !== 'cave') endAll(); });
    R.on('props', function () { if (sitting && !sitting.el.isConnected) R.els.props.appendChild(sitting.el); });
    R.on('activity', function () { endAll(); }); R.on('meditate', function () { endAll(); }); R.on('beforeWalk', function () { endAll(); }); R.on('walk', function () { endAll(); });
    R.on('outfit', function () { if (sitting && sitting.el && root.OvuGarden && root.OvuGarden.reseat) root.OvuGarden.reseat(sitting.el, CAVE.seat); });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) endAll(); });
    S.subscribe(function (reason) {
      if (reason === 'clear' || reason === 'import' || reason === 'external' || String(reason).indexOf('sync') === 0) endAll();
      else if (reason === 'state') { if (S.state().sleeping || (!soundOn() && (playing || bed))) endAll(); else setVolume(); }
    });
  });
  T.openSpring = openSpring; T.openTones = openSpring; T.sitDown = sitDown; T.standUp = function () { endAll(); }; T.sitting = function () { return !!sitting; };
})(typeof window !== 'undefined' ? window : this);
