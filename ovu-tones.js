/* Rhythme pure tones (Jamie, 21 Oct 2026: "sounds frequency like this without any voiceover just sound in the cave", then
 * "for the sitting in the cave will be different - it's purely frequency sounds"). Sitting by the hidden spring IS the
 * tone: she chooses one of the nine pitches many apps sell as "Solfeggio frequencies" (174 to 963 Hz) and sits on the
 * warm stone while the crystals hum at it. Rhythme makes no claim about what a tone does: the names those apps attach to
 * them have no evidence behind them (docs/design/2026-10-21-cave-tones.md), so they are not used here; some people simply
 * find a steady sound restful. Web Audio synthesis, so nothing is downloaded or streamed: a sine at the pitch with a soft
 * octave above it for body on small speakers, a slow fade in and out, the app's own volume setting, never loud. No voice
 * in the cave. Sitting and sound end together: when the chosen time is up, when she leaves the spring or walks, when
 * sleep begins, when the page is hidden, on clear or import, or at Stop. Nothing here writes a diary entry, costs energy
 * or earns hearts. Pure parts first (testable in node), then the scene. */
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
  var T = { MEANING: MEANING, BEDS: BEDS, FREQS: FREQS, MINUTES: MINUTES, CEILING: CEILING, label: label, valid: valid, gainFor: gainFor };
  root.OvuTones = T;
  /* the crystals are a hotspot of the hidden spring (its layout is data, so this holds in node too); like the warm stone
   * it walks her to the stone, because the crystals and the stone are one seat */
  var STONE_WP = { x: 55, y: 66, flip: true };
  var CAVE0 = root.OvuBarn && root.OvuBarn.CAVE;
  if (CAVE0 && !CAVE0.hotspots.some(function (h) { return h.id === 'crystals'; })) CAVE0.hotspots.push({ id: 'crystals', x: 24, y: 40, label: 'The crystals · a steady tone', prompt: 'Tap to sit by the water with a tone', icon: 'graphic_eq', wp: { x: STONE_WP.x, y: STONE_WP.y, flip: STONE_WP.flip } });

  /* ---------- the synth (browser only) ---------- */
  var ctx = null, osc = null, osc2 = null, gain = null, playing = null, endAt = null, endT = null, fns = [], extra = [], bed = null, bedNodes = null;
  function AC() { return root.AudioContext || root.webkitAudioContext; }
  function notify() { fns.slice().forEach(function (f) { try { f(playing); } catch (e) { } }); }
  function appVolume() { var SND = root.OvuSound; try { return SND && SND.volume ? SND.volume() : 0.25; } catch (e) { return 0.25; } }
  function start(hz, minutes) {
    hz = Number(hz); if (!valid(hz) || !AC()) return false;
    try {
      if (!ctx) ctx = new (AC())();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      stopNodes(0.25);
      var now = ctx.currentTime, g = gainFor(appVolume());
      gain = ctx.createGain(); gain.gain.setValueAtTime(0.0001, now); gain.gain.linearRampToValueAtTime(g, now + 2.5); gain.connect(ctx.destination);
      var swell = ctx.createGain(); swell.gain.value = 0.85; swell.connect(gain); /* a slow breath in the sound, so it never feels like a test tone */
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 0.15; lfo.connect(lg); lg.connect(swell.gain); lfo.start(now); extra.push(lfo);
      osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(hz, now); osc.connect(swell);
      var o3 = ctx.createOscillator(), g3 = ctx.createGain(); o3.type = 'sine'; o3.frequency.setValueAtTime(hz * 1.0035, now); g3.gain.value = 0.35; o3.connect(g3); g3.connect(swell); o3.start(now); extra.push(o3); /* a twin a hair apart: a gentle shimmer */
      var g2 = ctx.createGain(); g2.gain.setValueAtTime(0.18, now); g2.connect(gain);
      osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.setValueAtTime(hz * 2, now); osc2.connect(g2);
      osc.start(now); osc2.start(now);
    } catch (e) { playing = null; return false; }
    playing = hz; clearTimeout(endT); endAt = null;
    if (minutes && isFinite(minutes) && minutes > 0) { endAt = Date.now() + minutes * 60000; endT = setTimeout(function () { stop(); }, minutes * 60000); }
    notify(); return true;
  }
  function stopNodes(fade) {
    if (!ctx || !gain) return;
    var g = gain, o1 = osc, o2 = osc2, now = ctx.currentTime, f = fade == null ? 2 : fade;
    try { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now); g.gain.exponentialRampToValueAtTime(0.0001, now + f); } catch (e) { }
    var ex = extra; extra = [];
    setTimeout(function () { try { o1.stop(); o2.stop(); o1.disconnect(); o2.disconnect(); g.disconnect(); ex.forEach(function (x) { x.stop(); x.disconnect(); }); } catch (e) { } }, f * 1000 + 100);
    osc = osc2 = gain = null;
  }
  function stop() { if (!playing && !gain && !bed) { notify(); return; } stopNodes(2); stopBed(2); playing = null; endAt = null; clearTimeout(endT); endT = null; notify(); }
  function noiseBuffer(kind) {
    var len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = buf.getChannelData(c), last = 0; for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w * 0.5; } }
    return buf;
  }
  function startBed(kind, minutes) {
    if (!BEDS[kind] || !AC()) return false;
    try {
      if (!ctx) ctx = new (AC())();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      stopBed(0.4); stopNodes(0.4); playing = null;
      var now = ctx.currentTime, g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(gainFor(appVolume()) * 0.7, now + 3); g.connect(ctx.destination);
      var src = ctx.createBufferSource(); src.buffer = noiseBuffer(kind === 'rain' ? 'white' : 'brown'); src.loop = true;
      var f1 = ctx.createBiquadFilter(), nodes = [src, g, f1];
      if (kind === 'rain') { f1.type = 'bandpass'; f1.frequency.value = 2400; f1.Q.value = 0.5; }
      else { f1.type = 'lowpass'; f1.frequency.value = kind === 'stream' ? 1100 : 520; }
      src.connect(f1); var tail = f1;
      if (kind !== 'rain') { /* a stream wanders, waves breathe in and out */
        var mod = ctx.createGain(); mod.gain.value = kind === 'waves' ? 0.55 : 0.85; tail.connect(mod); tail = mod;
        var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = kind === 'waves' ? 0.09 : 0.3; lg.gain.value = kind === 'waves' ? 0.45 : 0.15; lfo.connect(lg); lg.connect(mod.gain); lfo.start(now); nodes.push(mod, lfo, lg);
      }
      tail.connect(g); src.start(now);
      bedNodes = nodes; bed = kind;
    } catch (e) { bed = null; return false; }
    clearTimeout(endT); endAt = null;
    if (minutes && isFinite(minutes) && minutes > 0) { endAt = Date.now() + minutes * 60000; endT = setTimeout(function () { stop(); }, minutes * 60000); }
    notify(); return true;
  }
  function stopBed(fade) {
    if (!bedNodes || !ctx) { bed = null; return; }
    var ns = bedNodes, g = ns[1], now = ctx.currentTime, f = fade == null ? 2 : fade; bedNodes = null; bed = null;
    try { g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now); g.gain.exponentialRampToValueAtTime(0.0001, now + f); } catch (e) { }
    setTimeout(function () { ns.forEach(function (x) { try { if (x.stop) x.stop(); x.disconnect(); } catch (e) { } }); }, f * 1000 + 100);
  }
  function remaining() { return endAt ? Math.max(0, Math.round((endAt - Date.now()) / 1000)) : null; }
  function setVolume() { if (!ctx || !gain) return; try { gain.gain.setTargetAtTime(gainFor(appVolume()), ctx.currentTime, 0.3); } catch (e) { } }
  T.start = start; T.startBed = startBed; T.bed = function () { return bed; }; T.stop = stop; T.playing = function () { return playing; }; T.remaining = remaining; T.setVolume = setVolume; T.onChange = function (f) { fns.push(f); };

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
      else if (reason === 'state') { if (S.state().sleeping) endAll(); else setVolume(); }
    });
  });
  T.openSpring = openSpring; T.openTones = openSpring; T.sitDown = sitDown; T.standUp = function () { endAll(); }; T.sitting = function () { return !!sitting; };
})(typeof window !== 'undefined' ? window : this);
