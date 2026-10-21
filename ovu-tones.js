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
  function label(hz) { hz = Number(hz); if (FREQS.indexOf(hz) < 0) return ''; var i = FREQS.indexOf(hz); return hz + ' Hz, ' + (i < 3 ? 'low' : i < 6 ? 'middle' : 'high'); }
  function valid(hz) { return FREQS.indexOf(Number(hz)) > -1; }
  function gainFor(appVolume) { var v = Number(appVolume); if (!isFinite(v) || v < 0) v = 0; if (v > 1) v = 1; return Math.round(v * CEILING * 1000) / 1000; }
  var T = { FREQS: FREQS, MINUTES: MINUTES, CEILING: CEILING, label: label, valid: valid, gainFor: gainFor };
  root.OvuTones = T;
  /* the crystals are a hotspot of the hidden spring (its layout is data, so this holds in node too); like the warm stone
   * it walks her to the stone, because the crystals and the stone are one seat */
  var STONE_WP = { x: 55, y: 66, flip: true };
  var CAVE0 = root.OvuBarn && root.OvuBarn.CAVE;
  if (CAVE0 && !CAVE0.hotspots.some(function (h) { return h.id === 'crystals'; })) CAVE0.hotspots.push({ id: 'crystals', x: 24, y: 40, label: 'The crystals · a steady tone', prompt: 'Tap to sit by the water with a tone', icon: 'graphic_eq', wp: { x: STONE_WP.x, y: STONE_WP.y, flip: STONE_WP.flip } });

  /* ---------- the synth (browser only) ---------- */
  var ctx = null, osc = null, osc2 = null, gain = null, playing = null, endAt = null, endT = null, fns = [];
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
      osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(hz, now); osc.connect(gain);
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
    setTimeout(function () { try { o1.stop(); o2.stop(); o1.disconnect(); o2.disconnect(); g.disconnect(); } catch (e) { } }, f * 1000 + 100);
    osc = osc2 = gain = null;
  }
  function stop() { if (!playing && !gain) { notify(); return; } stopNodes(2); playing = null; endAt = null; clearTimeout(endT); endT = null; notify(); }
  function remaining() { return endAt ? Math.max(0, Math.round((endAt - Date.now()) / 1000)) : null; }
  function setVolume() { if (!ctx || !gain) return; try { gain.gain.setTargetAtTime(gainFor(appVolume()), ctx.currentTime, 0.3); } catch (e) { } }
  T.start = start; T.stop = stop; T.playing = function () { return playing; }; T.remaining = remaining; T.setVolume = setVolume; T.onChange = function (f) { fns.push(f); };

  /* ---------- the hidden spring: sitting by the water is the tone ---------- */
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, B = root.OvuBarn, CARE = root.OvuCare, doc = root.document;
  if (!R || !S || !doc || !B || !B.CAVE) return;
  var CAVE = B.CAVE, ART = R.ART;
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inCave() { var L = R.layout(); return !!L && L.id === 'cave'; }
  function idle() { return !((W.napping && W.napping()) || (CARE && CARE.live && CARE.live())); }
  var pick = { hz: 528, min: null }, sitting = null;
  function minsLabel(m) { return m ? m + ' minutes' : 'Until I stop'; }
  function openSpring() {
    var on = playing;
    R.openSheet('cavetones', 'Sit by the water', on ? 'The crystals are humming' : 'A steady sound while she rests', 'graphic_eq',
      '<p class="mindline"><span class="ms">graphic_eq</span><span>' + (on ? 'The crystals hum at ' + esc(label(on)) + ' while she sits. No voice, nothing to record.' : 'Choose a pitch, and she sits on the warm stone while the crystals hum at it. No voice, nothing to record.') + '</span></p>' +
      '<div class="field sqf"><span class="lbl">Pitch</span><div class="chips tonechips" role="group" aria-label="Pitch" id="toneHz">' + FREQS.map(function (f) { return '<button type="button" class="chipbtn' + (pick.hz === f ? ' on' : '') + '" data-hz="' + f + '" aria-pressed="' + (pick.hz === f ? 'true' : 'false') + '">' + f + ' Hz</button>'; }).join('') + '</div></div>' +
      '<div class="field sqf"><span class="lbl">For how long</span><div class="chips" role="group" aria-label="For how long" id="toneMin">' + MINUTES.map(function (m) { return '<button type="button" class="chipbtn' + (pick.min === m ? ' on' : '') + '" data-min="' + (m || 0) + '" aria-pressed="' + (pick.min === m ? 'true' : 'false') + '">' + minsLabel(m) + '</button>'; }).join('') + '</div></div>' +
      '<div class="row" id="toneActs"><button type="button" class="btn primary" data-tone="start"><span class="ms">chair</span>' + (on ? 'Change the pitch' : 'Sit by the water') + '</button>' + (on ? '<button type="button" class="btn ghost" data-tone="stop"><span class="ms">stop_circle</span>Stop sound and stand up</button>' : '') + '</div>' +
      '<p class="help">Plain tones made on your phone: one pitch, with a quiet octave above it. Rhythme makes no claim about what a tone does; some people find a steady sound restful, and that is all it is for. It follows the room’s volume. Keep it comfortable, and stop if the sound feels unpleasant or your ears ring. Sitting and sound end when the time is up, when you leave the spring, when sleep begins, or when you hide the app.</p>');
    var hzBox = doc.getElementById('toneHz'), minBox = doc.getElementById('toneMin'), acts = doc.getElementById('toneActs');
    function paint(box, attr, val) { Array.prototype.forEach.call(box.querySelectorAll('.chipbtn'), function (b) { var v = Number(b.dataset[attr]); var isOn = attr === 'hz' ? v === val : (v || null) === val; b.classList.toggle('on', isOn); b.setAttribute('aria-pressed', isOn ? 'true' : 'false'); }); }
    if (hzBox) hzBox.addEventListener('click', function (e) { var b = e.target.closest('[data-hz]'); if (!b) return; pick.hz = Number(b.dataset.hz); paint(hzBox, 'hz', pick.hz); R.chime('tap'); });
    if (minBox) minBox.addEventListener('click', function (e) { var b = e.target.closest('[data-min]'); if (!b) return; pick.min = Number(b.dataset.min) || null; paint(minBox, 'min', pick.min); R.chime('tap'); });
    if (acts) acts.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tone]'); if (!b) return;
      if (b.dataset.tone === 'stop') { stop(); R.hideSheet(); return; }
      if (!inCave() || !idle()) { R.hideSheet(); return; }
      if (!start(pick.hz, pick.min)) { R.toast('This phone could not make the tone just now.', 'info'); return; } /* no sound, no seat: nothing half done */
      R.hideSheet(); sitDown();
    });
  }
  /* her seated sprite on the warm stone while the tone plays; one Stop for both */
  function sitDown() {
    if (sitting || !inCave()) return;
    var G = root.OvuGarden, el = doc.createElement('div'), outfit = (function (o) { return /^[a-z0-9-]{1,32}$/.test(o || '') ? o : 'base'; })(S.profile().outfit); /* an imported outfit name never becomes markup (Codex sweep, 21 Oct) */
    el.className = 'nb springsitter tonesitter'; el.dataset.id = 'tonesitter'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<img src="' + ART + 'avatar-' + outfit + '.webp" alt="">';
    var stopBtn = doc.createElement('button'); stopBtn.type = 'button'; stopBtn.className = 'springstop'; stopBtn.id = 'springStop'; stopBtn.innerHTML = '<span class="ms">stop_circle</span>Stop sound and stand up';
    R.els.props.appendChild(el); R.els.scene.appendChild(stopBtn);
    if (G && G.seatPlace) { G.seatPlace(el, CAVE.seat); G.seatedImg(el.querySelector('img'), el.querySelector('img').src); }
    else { el.style.left = CAVE.seat.x + '%'; el.style.top = CAVE.seat.groundY + '%'; el.style.width = '9%'; }
    sitting = { el: el, stop: stopBtn }; R.els.scene.classList.add('sitting', 'springsit');
    stopBtn.addEventListener('click', function (e) { e.stopPropagation(); stop(); });
    try { stopBtn.focus({ preventScroll: true }); } catch (e) { }
    if (R.moment) R.moment('springsit', { quiet: true, pose: null });
  }
  function standUp() {
    if (!sitting) return; var s = sitting; sitting = null;
    if (s.el.parentNode) s.el.remove(); if (s.stop.parentNode) s.stop.remove();
    R.els.scene.classList.remove('sitting', 'springsit');
  }
  T.onChange(function (hz) { if (!hz) standUp(); }); /* the sound ends (time up, Stop, leaving, sleep, hidden): she gets up */
  var opener = function (id, L) { if (!L || L.id !== 'cave') return false; if ((W.napping && W.napping()) || R.busy() || !idle()) return true; openSpring(); return true; };
  R.hotspotHandlers.crystals = opener; R.hotspotHandlers.warmstone = opener;
  R.on('boot', function () {
    R.on('layout', function (L) { if (!L || L.id !== 'cave') stop(); });
    R.on('props', function () { if (sitting && !sitting.el.isConnected) R.els.props.appendChild(sitting.el); });
    R.on('activity', function () { stop(); }); R.on('beforeWalk', function () { stop(); }); R.on('walk', function () { stop(); });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); });
    S.subscribe(function (reason) {
      if (reason === 'clear' || reason === 'import' || reason === 'external' || String(reason).indexOf('sync') === 0) stop();
      else if (reason === 'state') { if (S.state().sleeping) stop(); else setVolume(); }
    });
  });
  T.openSpring = openSpring; T.openTones = openSpring; T.sitDown = sitDown; T.standUp = function () { stop(); }; T.sitting = function () { return !!sitting; };
})(typeof window !== 'undefined' ? window : this);
