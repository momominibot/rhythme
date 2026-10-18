/* Moon Tap: a no-fail breath break. A ring opens on the in-breath and closes on the out-breath around your
 * Luna companion. You may tap anywhere for a bloom of light, or only watch. Nothing is scored, tap timing
 * changes nothing, and stopping at any moment saves the practice time. The design and the review that shaped
 * it: docs/design/2026-10-18-breath-tap.md, docs/debate/2026-10-18-breath-tap-codex-review.md. */
(function (root) {
  'use strict';
  var PRESETS = {
    easy: { id: 'easy', name: 'Easy', sub: '3 in, 3 out', inMs: 3000, outMs: 3000 },
    steady: { id: 'steady', name: 'Steady', sub: '4 in, 4 out', inMs: 4000, outMs: 4000 },
    longout: { id: 'longout', name: 'Long out', sub: '4 in, 6 out', inMs: 4000, outMs: 6000 },
    own: { id: 'own', name: 'My own pace', sub: 'a gentle pulse, no words', inMs: 4000, outMs: 4000, quiet: true }
  };
  var LENGTHS = [{ min: 3, name: '3 min' }, { min: 4, name: '4 min' }, { min: 5, name: '5 min' }, { min: 0, name: 'Open' }];
  var MIN_SAVE_S = 5;
  function ease(x) { x = Math.max(0, Math.min(1, x)); return 0.5 - 0.5 * Math.cos(Math.PI * x); }
  /* where the ring is t ms into a session: the phase, progress through it, and the ring's size from 0 to 1 */
  function phaseAt(preset, t) {
    var p = PRESETS[preset] || PRESETS.easy, cycle = p.inMs + p.outMs, u = ((t % cycle) + cycle) % cycle, n = Math.floor(t / cycle);
    if (u < p.inMs) { var a = u / p.inMs; return { phase: 'in', progress: a, size: ease(a), cycle: n }; }
    var b = (u - p.inMs) / p.outMs; return { phase: 'out', progress: b, size: 1 - ease(b), cycle: n };
  }
  /* the saved entry: practice time, the preset, whether taps were used. Nothing about accuracy, no breath counts. */
  function entryFor(seconds, preset, taps, plannedMin) {
    seconds = Math.max(0, Math.round(Number(seconds) || 0));
    return { kind: 'breathtap', seconds: seconds, minutes: Math.round(seconds / 6) / 10, preset: PRESETS[preset] ? preset : 'easy', taps: Math.max(0, taps | 0), planned: plannedMin || 0, completed: !!(plannedMin && seconds >= plannedMin * 60 - 2) };
  }

  /* ---- the screen ---- */
  var el = null, state = null, raf = 0, opts = {}, audio = null, reduced = false;
  function h(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function $(s) { return el ? el.querySelector(s) : null; }
  function store() { return root.OvuStore || null; }
  function soundOn() { try { var s = store(); return !s || !!s.state().sound; } catch (e) { return true; } }
  function build() {
    if (el) return el;
    reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el = h('<div class="btap" id="btap" role="dialog" aria-label="Moon Tap, a breath break" hidden>' +
      '<div class="w-stars" aria-hidden="true"></div>' +
      '<div class="btap-card" id="btapCard">' +
        '<h2>Moon Tap</h2>' +
        '<p>Breathe comfortably. Tap if you like, or simply watch. You don’t need to match the ring.</p>' +
        '<div class="btap-chips" id="btapPresets" role="group" aria-label="Pace"></div>' +
        '<div class="btap-chips" id="btapLengths" role="group" aria-label="How long"></div>' +
        '<p class="safe">Breathe gently, without forcing a deeper or longer breath. Stop if you feel dizzy, tingly, short of breath or distressed, and return to your usual breathing.</p>' +
        '<div class="row"><button type="button" class="btn primary" id="btapBegin"><span class="ms">blur_on</span>Begin</button><button type="button" class="btn ghost" id="btapClose">Close</button></div>' +
      '</div>' +
      '<div class="btap-stage" id="btapStage" hidden>' +
        '<div class="btap-ring" id="btapRing"><img id="btapPet" alt=""></div>' +
        '<div class="btap-word" id="btapWord" aria-live="polite"></div>' +
        '<button type="button" class="btn btap-stop" id="btapStop">Stop</button>' +
      '</div>' +
      '<div class="btap-card btap-done" id="btapDone" hidden><b>Your pause is saved.</b><p id="btapSum"></p><div class="row"><button type="button" class="btn primary" id="btapDoneClose">Close</button></div></div>' +
    '</div>');
    document.body.appendChild(el);
    $('#btapPresets').innerHTML = Object.keys(PRESETS).map(function (k) { var p = PRESETS[k]; return '<button type="button" data-preset="' + k + '" class="' + (k === 'easy' ? 'on' : '') + '" aria-pressed="' + (k === 'easy') + '">' + p.name + '<small>' + p.sub + '</small></button>'; }).join('');
    $('#btapLengths').innerHTML = LENGTHS.map(function (L, i) { return '<button type="button" data-min="' + L.min + '" class="' + (i === 0 ? 'on' : '') + '" aria-pressed="' + (i === 0) + '">' + L.name + '</button>'; }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-preset],[data-min]'); if (!b) return;
      var group = b.parentNode; Array.prototype.forEach.call(group.children, function (c) { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', c === b); });
    });
    $('#btapBegin').addEventListener('click', start);
    $('#btapClose').addEventListener('click', close);
    $('#btapDoneClose').addEventListener('click', close);
    $('#btapStop').addEventListener('click', function () { stop(false); });
    $('#btapStage').addEventListener('pointerdown', function (e) { if (e.target.closest('#btapStop')) return; bloom(e.clientX, e.clientY); });
    document.addEventListener('keydown', function (e) { if (!state || el.hidden) return; if (e.key === ' ' || e.key === 'Enter') { if (e.target && /BUTTON|INPUT|TEXTAREA/.test(e.target.tagName)) return; e.preventDefault(); var r = $('#btapRing').getBoundingClientRect(); bloom(r.left + r.width / 2, r.top + r.height / 2); } if (e.key === 'Escape') stop(false); });
    return el;
  }
  function open(o) {
    opts = o || {}; build();
    var pet = $('#btapPet'); pet.src = opts.pet || (root.OvuMascot ? OvuMascot.src(null, false) : 'assets/room/dream/orb-bunny.webp');
    $('#btapCard').hidden = false; $('#btapStage').hidden = true; $('#btapDone').hidden = true; el.hidden = false;
    document.body.classList.add('btap-open');
  }
  function close() { if (state) stop(false, true); if (el) el.hidden = true; document.body.classList.remove('btap-open'); if (opts.onClose) opts.onClose(); }
  function start() {
    var preset = ($('#btapPresets .on') || {}).dataset ? $('#btapPresets .on').dataset.preset : 'easy';
    var plan = Number(($('#btapLengths .on') || { dataset: { min: 3 } }).dataset.min) || 0;
    state = { preset: preset, plan: plan, startedAt: Date.now(), taps: 0, lastPhase: '' };
    $('#btapCard').hidden = true; $('#btapDone').hidden = true; $('#btapStage').hidden = false;
    $('#btapWord').textContent = PRESETS[preset].quiet ? '' : 'in';
    tick();
  }
  function tick() {
    if (!state) return;
    var t = Date.now() - state.startedAt, ph = phaseAt(state.preset, t), ring = $('#btapRing'), word = $('#btapWord');
    if (reduced) { ring.style.transform = 'translate(-50%,-50%) scale(.95)'; ring.style.opacity = String(0.55 + 0.45 * ph.size); }
    else ring.style.transform = 'translate(-50%,-50%) scale(' + (0.72 + 0.38 * ph.size).toFixed(3) + ')';
    if (ph.phase !== state.lastPhase) { state.lastPhase = ph.phase; if (!PRESETS[state.preset].quiet) word.textContent = ph.phase === 'in' ? 'in' : 'out'; }
    if (state.plan && t >= state.plan * 60000) { stop(true); return; }
    raf = root.requestAnimationFrame(tick);
  }
  function bloom(x, y) {
    if (!state) return;
    state.taps += 1;
    var r = el.getBoundingClientRect(), p = document.createElement('span'); p.className = 'btap-petal'; p.style.left = (x - r.left) + 'px'; p.style.top = (y - r.top) + 'px';
    $('#btapStage').appendChild(p); setTimeout(function () { p.remove(); }, 1500);
    tone(); haptic();
  }
  function tone() {
    if (!soundOn()) return;
    try {
      audio = audio || new (root.AudioContext || root.webkitAudioContext)();
      [220, 330].forEach(function (f, i) {
        var o = audio.createOscillator(), g = audio.createGain(); o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, audio.currentTime); g.gain.exponentialRampToValueAtTime(i ? 0.03 : 0.05, audio.currentTime + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 1.1);
        o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + 1.2);
      });
    } catch (e) { /* no audio */ }
  }
  function haptic() { try { if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(12); } catch (e) { } }
  function stop(completed, silent) {
    if (!state) return null;
    root.cancelAnimationFrame(raf);
    var seconds = (Date.now() - state.startedAt) / 1000, data = entryFor(seconds, state.preset, state.taps, state.plan), ev = null, s = store();
    state = null;
    if (data.seconds >= MIN_SAVE_S && s) { try { ev = s.add('mindfulness', s.today(), data, 'room'); if (opts.onSaved) opts.onSaved(ev); } catch (e) { ev = null; } }
    if (silent) return ev;
    $('#btapStage').hidden = true; $('#btapDone').hidden = false;
    var m = Math.floor(data.seconds / 60), sec = data.seconds % 60;
    $('#btapDone b').textContent = ev ? 'Your pause is saved.' : 'That was a short one.';
    $('#btapSum').textContent = (ev ? 'Practice time ' + (m ? m + ' min ' : '') + sec + ' s' : 'Stay a little longer next time and it will count as practice time') + (data.taps ? ' · ' + data.taps + (data.taps === 1 ? ' bloom' : ' blooms') : '') + '.';
    return ev;
  }
  root.OvuBreathTap = { PRESETS: PRESETS, LENGTHS: LENGTHS, MIN_SAVE_S: MIN_SAVE_S, phaseAt: phaseAt, entryFor: entryFor, open: open, close: close, start: start, stop: stop };
})(typeof window !== 'undefined' ? window : this);
