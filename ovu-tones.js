/* Rhythme pure tones (Jamie, 21 Oct 2026: "sounds frequency like this without any voiceover just sound in the cave").
 * The crystals in the hidden spring hum at one pitch she chooses: the nine pitches many apps sell as "Solfeggio
 * frequencies" (174 to 963 Hz). Rhythme makes no claim about what a tone does: the names those apps attach to them
 * have no evidence behind them (docs/design/2026-10-21-cave-tones.md), so they are not used here; some people simply
 * find a steady tone restful. Web Audio synthesis, so nothing is downloaded or streamed: a sine at the pitch with a soft
 * octave above it for body on small speakers, a slow fade in and out, the app's own volume setting, never loud. It stops
 * when she leaves the cave, when sleep begins, when the page is hidden, when the chosen time is up, or at Stop.
 * Nothing here writes a diary entry, costs energy or earns hearts. Pure parts first (testable in node), then the scene. */
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
  /* the crystals are a hotspot of the hidden spring (its layout is data, so this holds in node too) */
  var CAVE0 = root.OvuBarn && root.OvuBarn.CAVE;
  if (CAVE0 && !CAVE0.hotspots.some(function (h) { return h.id === 'crystals'; })) CAVE0.hotspots.push({ id: 'crystals', x: 24, y: 40, label: 'The crystals · a steady tone', prompt: 'Tap to hear the crystals', icon: 'graphic_eq', wp: { x: 24, y: 58, flip: false } });

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
  function stop() { if (!playing && !gain) return; stopNodes(2); playing = null; endAt = null; clearTimeout(endT); endT = null; notify(); }
  function remaining() { return endAt ? Math.max(0, Math.round((endAt - Date.now()) / 1000)) : null; }
  function setVolume() { if (!ctx || !gain) return; try { gain.gain.setTargetAtTime(gainFor(appVolume()), ctx.currentTime, 0.3); } catch (e) { } }
  T.start = start; T.stop = stop; T.playing = function () { return playing; }; T.remaining = remaining; T.setVolume = setVolume; T.onChange = function (f) { fns.push(f); };

  /* ---------- the crystals in the hidden spring ---------- */
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, B = root.OvuBarn, doc = root.document;
  if (!R || !S || !doc || !B || !B.CAVE) return;
  var CAVE = B.CAVE;
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inCave() { var L = R.layout(); return !!L && L.id === 'cave'; }
  var pick = { hz: 528, min: null }, pill = null;
  function minsLabel(m) { return m ? m + ' min' : 'Until I stop'; }
  function openTones() {
    var on = playing;
    R.openSheet('cavetones', 'The crystals', 'A steady tone, nothing more', 'graphic_eq',
      '<p class="mindline"><span class="ms">graphic_eq</span><span>' + (on ? 'The crystals are humming at ' + esc(label(on)) + '.' : 'Choose a pitch. The crystals hum at that one note while you stay by the spring.') + '</span></p>' +
      '<div class="field sqf"><span class="lbl">Pitch</span><div class="chips tonechips" role="group" aria-label="Pitch" id="toneHz">' + FREQS.map(function (f) { return '<button type="button" class="chipbtn' + (pick.hz === f ? ' on' : '') + '" data-hz="' + f + '" aria-pressed="' + (pick.hz === f ? 'true' : 'false') + '">' + f + ' Hz</button>'; }).join('') + '</div></div>' +
      '<div class="field sqf"><span class="lbl">For how long</span><div class="chips" role="group" aria-label="For how long" id="toneMin">' + MINUTES.map(function (m) { return '<button type="button" class="chipbtn' + (pick.min === m ? ' on' : '') + '" data-min="' + (m || 0) + '" aria-pressed="' + (pick.min === m ? 'true' : 'false') + '">' + minsLabel(m) + '</button>'; }).join('') + '</div></div>' +
      '<div class="row" id="toneActs"><button type="button" class="btn primary" data-tone="start"><span class="ms">play_arrow</span>' + (on ? 'Change the pitch' : 'Start') + '</button>' + (on ? '<button type="button" class="btn ghost" data-tone="stop"><span class="ms">stop_circle</span>Stop</button>' : '') + '</div>' +
      '<p class="help">These are plain tones, one pitch each, made on your phone. Rhythme makes no claim about what a tone does; some people find a steady note restful, and that is all it is for. It follows the room’s volume. Keep it gentle, and stop if it is unpleasant or your ears ring. It stops when you leave the spring.</p>');
    var hzBox = doc.getElementById('toneHz'), minBox = doc.getElementById('toneMin'), acts = doc.getElementById('toneActs');
    function paint(box, attr, val) { Array.prototype.forEach.call(box.querySelectorAll('.chipbtn'), function (b) { var v = Number(b.dataset[attr]); var isOn = attr === 'hz' ? v === val : (v || null) === val; b.classList.toggle('on', isOn); b.setAttribute('aria-pressed', isOn ? 'true' : 'false'); }); }
    if (hzBox) hzBox.addEventListener('click', function (e) { var b = e.target.closest('[data-hz]'); if (!b) return; pick.hz = Number(b.dataset.hz); paint(hzBox, 'hz', pick.hz); R.chime('tap'); });
    if (minBox) minBox.addEventListener('click', function (e) { var b = e.target.closest('[data-min]'); if (!b) return; pick.min = Number(b.dataset.min) || null; paint(minBox, 'min', pick.min); R.chime('tap'); });
    if (acts) acts.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tone]'); if (!b) return;
      if (b.dataset.tone === 'stop') { stop(); openTones(); return; }
      if (!inCave()) { R.hideSheet(); return; }
      if (!start(pick.hz, pick.min)) { R.toast('This phone could not make the tone just now.', 'info'); return; }
      openTones();
    });
  }
  function renderPill() {
    if (!playing || !inCave()) { if (pill) { pill.remove(); pill = null; } return; }
    if (!pill) { pill = doc.createElement('button'); pill.type = 'button'; pill.className = 'springstop tonepill'; pill.id = 'tonePill'; pill.addEventListener('click', function (e) { e.stopPropagation(); stop(); }); R.els.scene.appendChild(pill); }
    var rem = remaining(); pill.innerHTML = '<span class="ms">graphic_eq</span>' + esc(String(playing)) + ' Hz · Stop' + (rem !== null ? ' <small>' + Math.ceil(rem / 60) + ' min</small>' : '');
    pill.setAttribute('aria-label', 'Stop the ' + playing + ' Hz tone');
  }
  T.onChange(renderPill);
  R.hotspotHandlers.crystals = function (id, L) { if (!L || L.id !== 'cave') return false; if ((W.napping && W.napping()) || R.busy()) return true; openTones(); return true; };
  R.on('boot', function () {
    R.on('layout', function (L) { if (!L || L.id !== 'cave') stop(); renderPill(); });
    R.on('props', renderPill);
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); });
    S.subscribe(function (reason) { if (S.state().sleeping && playing) stop(); if (reason === 'state') setVolume(); });
    setInterval(function () { if (playing) renderPill(); }, 15000);
  });
  T.openTones = openTones;
})(typeof window !== 'undefined' ? window : this);
