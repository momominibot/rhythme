/* Rhythme sound kit (Jamie, 20 Oct: "i need audio and cute relaxing sound for the app"; design with Codex in
 * docs/design/2026-10-20-light-flower.md). Every sound is drawn here in the browser: soft sine and triangle tones on a
 * D major pentatonic scale, a little room from a generated echo, and a quiet pad of air. No recordings, so nothing to
 * license, nothing to download, and it works offline.
 * One switch rules them all (S.state().sound); never chosen counts as on, a quiet default. Fast taps never stack:
 * each sound has a minimum gap and the flower note keeps at most two voices.
 * Jamie (20 Oct): "cute sitting and activity sounds like animal crossing / harvest moon". So the small sounds are bubbly
 * and pitched: footsteps that change with the ground (wood indoors, grass in the garden and farm, stone on the street),
 * a cushion poof when she sits, nom nom, a little dig, a watering sprinkle, a harvest bloop, a coin, a pet's pyon, a page
 * turning, a door's ding-dong, and a rising three-note sparkle when something is saved. */
(function (root) {
  'use strict';
  var SCALE = [294, 330, 370, 440, 494, 587, 659]; /* D, E, F#, A, B, D, E: no two notes clash */
  var DEFAULT_VOL = 0.25;
  /* peak levels at the default volume (Codex: -26 to -32 dBFS for notes, about -40 for the air) */
  var KIT = {
    petal: { gap: 1200, peak: 0.05 },
    tap: { gap: 120, peak: 0.025 },
    save: { gap: 400, peak: 0.04 },
    sleep: { gap: 400, peak: 0.04 },
    bell: { gap: 600, peak: 0.04 },
    alert: { gap: 800, peak: 0.05 },
    drop: { gap: 140, peak: 0.032 },
    step: { gap: 150, peak: 0.016 },
    sit: { gap: 600, peak: 0.03 },
    hup: { gap: 500, peak: 0.024 },
    munch: { gap: 600, peak: 0.022 },
    dig: { gap: 500, peak: 0.03 },
    water: { gap: 800, peak: 0.016 },
    pop: { gap: 300, peak: 0.028 },
    coin: { gap: 400, peak: 0.024 },
    pet: { gap: 300, peak: 0.022 },
    page: { gap: 400, peak: 0.016 },
    swish: { gap: 400, peak: 0.015 },
    boop: { gap: 500, peak: 0.022 },
    door: { gap: 800, peak: 0.02 }
  };
  /* which small sound goes with which moment (ovu-moments.js); logging moments stay quiet, the save already sparkled */
  var FOR_MOMENT = { food: 'munch', farmmeal: 'munch', tea: 'munch', petfeed: 'munch', plant: 'dig', weed: 'dig', farmwater: 'water', greenhouse: 'water', harvest: 'pop', shop: 'coin', adopt: 'pet', petplay: 'pet', petcuddle: 'pet', pettidy: 'swish', petdress: 'swish', wardrobe: 'swish', learn: 'page', journal: 'page', reflection: 'page', hello: 'boop', friend: 'boop', plaza: 'boop', exercise: 'hup', wake: 'hup' };
  function forMoment(key) { return FOR_MOMENT[key] || null; }
  /* the ground under her feet: wood at home and in shops, grass outdoors, stone on the street and in the plaza */
  function surfaceFor(L) { var sc = L && L.scene; if (L && L.store) return 'wood'; if (sc === 'street' || sc === 'plaza') return 'stone'; if (sc === 'garden' || sc === 'farm' || (L && /garden|farm|greenhouse/.test(L.id || ''))) return 'grass'; return 'wood'; }
  var ctx = null, master = null, dry = null, wet = null, last = {}, voices = 0, air = null, petalIdx = 2;

  function store() { return root.OvuStore || null; }
  function enabled() { try { var s = store(); if (!s) return false; var v = s.state().sound; return v === undefined || v === null ? true : !!v; } catch (e) { return false; } }
  function volume() { try { var v = Number(store().state().soundVol); return isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_VOL; } catch (e) { return DEFAULT_VOL; } }
  /* the slider runs 0 to 1; the default quarter gives the peaks above, full volume is twelve decibels louder */
  function gainFor(v) { return v * 4; }
  /* a sound may play if the switch is on and its last one was long enough ago (pure, tested) */
  function allowed(kind, now, lastAt) { var k = KIT[kind]; if (!k) return false; return !(lastAt && now - lastAt < k.gap); }
  function nextPetal(i, r) { var step = r < 0.5 ? -1 : 1, n = i + step; if (n < 0 || n >= SCALE.length) n = i - step; return n; } /* a gentle walk: always a neighbour note */

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () { }); return ctx; }
    var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = gainFor(volume()); master.connect(ctx.destination);
    dry = ctx.createGain(); dry.gain.value = 0.88; dry.connect(master);
    wet = ctx.createGain(); wet.gain.value = 0.12;
    /* a soft room: two seconds of decaying noise as the echo's shape */
    try {
      var len = Math.round(ctx.sampleRate * 2), imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) { var d = imp.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
      var verb = ctx.createConvolver(); verb.buffer = imp; wet.connect(verb); verb.connect(master);
    } catch (e) { wet.connect(master); }
    return ctx;
  }
  /* one soft tone: attack, then an exponential fade, through the room */
  function tone(f, type, attack, decay, peak, when, harm) {
    var t0 = ctx.currentTime + (when || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    o.connect(g); g.connect(dry); g.connect(wet); o.start(t0); o.stop(t0 + attack + decay + 0.05);
    if (harm) { var o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.type = 'sine'; o2.frequency.setValueAtTime(f * 2, t0); g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * harm), t0 + attack); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay * 0.6); o2.connect(g2); g2.connect(dry); g2.connect(wet); o2.start(t0); o2.stop(t0 + attack + decay + 0.05); }
    return o;
  }
  /* a short burst of soft noise through a filter: grass, a puff of air, a page, a sprinkle */
  function noise(dur, type, freq, q, peak, when, sweepTo) {
    var t0 = ctx.currentTime + (when || 0), len = Math.max(1, Math.round(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = buf; f.type = type; f.frequency.setValueAtTime(freq, t0); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur); f.Q.value = q || 0.8;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(f); f.connect(g); g.connect(dry); g.connect(wet); n.start(t0); n.stop(t0 + dur + 0.02);
  }
  /* a pitch that slides, the bubbly sound of a cute game */
  function glide(f0, f1, dur, attack, decay, peak, when, type) {
    var t0 = ctx.currentTime + (when || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    o.connect(g); g.connect(dry); g.connect(wet); o.start(t0); o.stop(t0 + attack + decay + 0.05);
  }
  var stepSide = 0;
  function play(kind, opt) {
    opt = opt || {};
    if (!enabled() || !KIT[kind]) return false;
    var now = Date.now(); if (!allowed(kind, now, last[kind])) return false;
    try { if (!ensure()) return false; } catch (e) { return false; }
    last[kind] = now; var p = KIT[kind].peak;
    try {
      if (kind === 'petal') {
        if (voices >= 2) return false;
        petalIdx = typeof opt.i === 'number' ? Math.max(0, Math.min(SCALE.length - 1, opt.i)) : nextPetal(petalIdx, Math.random());
        voices += 1; var o = tone(SCALE[petalIdx], 'sine', 0.02, 3, p, 0, 0.18); o.onended = function () { voices = Math.max(0, voices - 1); };
      } else if (kind === 'tap') glide(520, 780, 0.045, 0.006, 0.09, p); /* a bubbly blip */
      else if (kind === 'save') { [587, 740, 880].forEach(function (f, i) { tone(f, 'triangle', 0.008, 0.35, p * (1 - i * 0.12), i * 0.075); }); tone(294, 'sine', 0.02, 0.6, p * 0.5, 0.15); } /* a little "you got it" sparkle */
      else if (kind === 'sleep') { [440, 370, 294].forEach(function (f, i) { tone(f, 'sine', 0.03, 1.2, p * (1 - i * 0.15), i * 0.16); }); } /* a lullaby falling to rest */
      else if (kind === 'step') {
        var w = opt.when || 0, side = (stepSide = 1 - stepSide) ? 1.06 : 0.95, surf = opt.surface || 'wood';
        if (surf === 'grass') noise(0.05, 'bandpass', 1300 * side, 0.9, p * 3, w);
        else if (surf === 'stone') { tone(900 * side, 'sine', 0.002, 0.03, p * 0.5, w); tone(300 * side, 'sine', 0.003, 0.05, p * 0.8, w); }
        else { tone(190 * side, 'triangle', 0.004, 0.06, p, w); noise(0.025, 'highpass', 2500, 0.7, p * 0.3, w); }
      }
      else if (kind === 'sit') { glide(520, 240, 0.14, 0.01, 0.2, p); noise(0.12, 'lowpass', 900, 0.7, p * 0.5, 0.02); } /* a cushion poof */
      else if (kind === 'hup') glide(300, 620, 0.09, 0.01, 0.12, p);
      else if (kind === 'munch') { var d0 = opt.when || 0.25; tone(760, 'triangle', 0.005, 0.07, p, d0); tone(640, 'triangle', 0.005, 0.07, p, d0 + 0.11); } /* nom nom, just after the save sparkle */
      else if (kind === 'dig') { var d1 = opt.when || 0.25; [0, 0.14].forEach(function (t) { glide(150, 90, 0.06, 0.004, 0.08, p, d1 + t); noise(0.06, 'lowpass', 500, 0.7, p * 0.6, d1 + t); }); }
      else if (kind === 'water') { var d2 = opt.when || 0.25; noise(0.5, 'bandpass', 3000, 1.2, p, d2); [0.12, 0.27, 0.41].forEach(function (t, i) { tone(1800 + i * 300 + Math.random() * 200, 'sine', 0.004, 0.08, p * 0.8, d2 + t); }); }
      else if (kind === 'pop') { var d3 = opt.when || 0.25; glide(380, 920, 0.07, 0.006, 0.12, p, d3); tone(1175, 'triangle', 0.005, 0.2, p * 0.6, d3 + 0.08); tone(1480, 'triangle', 0.005, 0.25, p * 0.5, d3 + 0.15); }
      else if (kind === 'coin') { var d4 = opt.when || 0.2; tone(988, 'triangle', 0.004, 0.18, p, d4); tone(1319, 'triangle', 0.004, 0.3, p, d4 + 0.08); }
      else if (kind === 'pet') { var d5 = opt.when || 0.2; glide(620, 1250, 0.12, 0.008, 0.15, p, d5); }
      else if (kind === 'page') { var d6 = opt.when || 0.2; noise(0.15, 'highpass', 3000, 0.7, p, d6); }
      else if (kind === 'swish') { var d7 = opt.when || 0.2; noise(0.22, 'bandpass', 800, 1.4, p * 3.5, d7, 2500); }
      else if (kind === 'boop') { var d8 = opt.when || 0.2; tone(659, 'sine', 0.008, 0.18, p, d8); tone(880, 'sine', 0.008, 0.25, p, d8 + 0.09); }
      else if (kind === 'door') { tone(784, 'sine', 0.01, 0.6, p); tone(587, 'sine', 0.01, 0.8, p, 0.18); }
      else if (kind === 'bell') tone(294, 'sine', 0.02, 2.2, p, 0, 0.22);
      else if (kind === 'alert') { tone(294, 'triangle', 0.01, 0.35, p); tone(294, 'triangle', 0.01, 0.35, p, 0.4); }
      else if (kind === 'drop') {
        /* the koi pond's water drop: a quick falling sine, then a quieter higher drip */
        var t0 = ctx.currentTime, d1 = ctx.createOscillator(), g1 = ctx.createGain();
        d1.type = 'sine'; d1.frequency.setValueAtTime(820 + Math.random() * 160, t0); d1.frequency.exponentialRampToValueAtTime(230, t0 + 0.17);
        g1.gain.setValueAtTime(0.0001, t0); g1.gain.exponentialRampToValueAtTime(p, t0 + 0.012); g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
        d1.connect(g1); g1.connect(dry); g1.connect(wet); d1.start(t0); d1.stop(t0 + 0.65);
        tone(1500, 'sine', 0.01, 0.45, p * 0.3, 0.09);
      }
      return true;
    } catch (e) { return false; }
  }
  /* the air: a low pad (D and A) breathing slowly, and a whisper of filtered noise, faded in and out over three seconds */
  function ambience(on) {
    if (!on || !enabled()) { if (air && ctx) { var a = air; air = null; var t = ctx.currentTime; a.g.gain.cancelScheduledValues(t); a.g.gain.setValueAtTime(Math.max(0.0001, a.g.gain.value), t); a.g.gain.exponentialRampToValueAtTime(0.0001, t + 3); root.setTimeout(function () { a.nodes.forEach(function (n) { try { n.stop(); } catch (e) { } }); }, 3200); } return false; }
    if (air) return true;
    try { if (!ensure()) return false; } catch (e) { return false; }
    var t0 = ctx.currentTime, g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.0126, t0 + 3); g.connect(dry); g.connect(wet);
    var nodes = [];
    [147, 220].forEach(function (f, i) {
      var o = ctx.createOscillator(), og = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; og.gain.value = i ? 0.5 : 0.8;
      lfo.frequency.value = 0.08 + i * 0.03; lg.gain.value = 0.25; lfo.connect(lg); lg.connect(og.gain); /* a slow swell, like breathing */
      o.connect(og); og.connect(g); o.start(t0); lfo.start(t0); nodes.push(o, lfo);
    });
    try {
      var len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      n.buffer = buf; n.loop = true; bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.7; ng.gain.value = 0.35;
      n.connect(bp); bp.connect(ng); ng.connect(g); n.start(t0); nodes.push(n);
    } catch (e) { }
    air = { g: g, nodes: nodes };
    return true;
  }
  /* the switch or the slider changed: follow it at once, tails included */
  function sync() {
    if (!ctx) return;
    var t = ctx.currentTime, on = enabled();
    master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(on ? gainFor(volume()) : 0, t + 0.08);
    if (!on) { ambience(false); root.setTimeout(function () { if (!enabled() && ctx && ctx.suspend) ctx.suspend().catch(function () { }); }, 200); }
    else if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () { });
  }
  function setVolume(v) { var s = store(); v = Math.max(0, Math.min(1, Number(v) || 0)); if (s) s.setState({ soundVol: v }); sync(); return v; }
  /* iOS starts audio only from a tap: the first touch anywhere wakes the kit, quietly */
  function unlock() { if (!enabled()) return; try { ensure(); } catch (e) { } }
  if (root.document) { root.document.addEventListener('pointerdown', unlock, true); root.document.addEventListener('keydown', unlock, true); }
  root.OvuSound = { SCALE: SCALE, KIT: KIT, DEFAULT_VOL: DEFAULT_VOL, forMoment: forMoment, surfaceFor: surfaceFor, enabled: enabled, volume: volume, gainFor: gainFor, allowed: allowed, nextPetal: nextPetal, play: play, ambience: ambience, sync: sync, setVolume: setVolume };
})(typeof window !== 'undefined' ? window : this);
