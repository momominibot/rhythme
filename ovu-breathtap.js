/* Koi Pond (was Moon Tap): a no-fail breath break. A ring opens on the in-breath and closes on the out-breath over a
 * still pond where three koi swim (Jamie, 19 Oct: koi, not the moon). Tap the water and a ripple spreads and the koi nearby dart away, then glide on;
 * or only watch. Nothing is scored, tap timing
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
  function soundOn() { if (root.OvuSound) return root.OvuSound.enabled(); try { var s = store(); return !s || !!s.state().sound; } catch (e) { return true; } }
  function build() {
    if (el) return el;
    reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el = h('<div class="btap" id="btap" role="dialog" aria-label="Koi Pond, a breath break" hidden>' +
      '<div class="w-stars" aria-hidden="true"></div>' +
      '<div class="btap-card" id="btapCard">' +
        '<h2>Koi Pond</h2>' +
        '<p>Breathe comfortably. Watch the koi glide; tap the water and they slip away. You don’t need to match the ring.</p>' +
        '<details class="btap-how"><summary><span class="ms" aria-hidden="true">menu_book</span>How to practise</summary><ol>' +
          '<li>Sit or stand comfortably and let your shoulders drop. Let each breath be its own size.</li>' +
          '<li>Choose a pace, or keep your own. The ring widens as you breathe in and closes as you breathe out; follow it only while it feels easy.</li>' +
          '<li>Rest your eyes on the koi, the water or the ring. When your mind wanders, that is the practice working: notice it, and come back to the next breath.</li>' +
          '<li>A tap on the water is one way to come back, not a task. Watching quietly counts just as much.</li>' +
          '<li>When you stop, take one ordinary breath and notice how you feel before you carry on.</li></ol></details>' +
        '<div class="btap-chips" id="btapPresets" role="group" aria-label="Pace"></div>' +
        '<div class="btap-chips" id="btapLengths" role="group" aria-label="How long"></div>' +
        '<p class="safe">Breathe gently, without forcing a deeper or longer breath. Stop if you feel dizzy, tingly, short of breath or distressed, and return to your usual breathing.</p>' +
        '<div class="row"><button type="button" class="btn primary" id="btapBegin"><span class="ms">blur_on</span>Begin</button><button type="button" class="btn ghost" id="btapClose">Close</button></div>' +
      '</div>' +
      '<div class="btap-stage" id="btapStage" hidden>' +
        '<canvas class="btap-water" id="btapWater" aria-hidden="true"></canvas>' +
        '<canvas class="btap-koi" id="btapKoi" aria-hidden="true"></canvas>' +
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
    document.addEventListener('visibilitychange', function () { if (document.hidden && state) stop(false); }); /* leaving the app ends and saves the pause, as Light Flower does (Codex, 20 Oct) */
    $('#btapStage').addEventListener('pointerdown', function (e) { if (e.target.closest('#btapStop')) return; bloom(e.clientX, e.clientY); });
    document.addEventListener('keydown', function (e) { if (!state || el.hidden) return; if (e.key === ' ' || e.key === 'Enter') { if (e.target && /BUTTON|INPUT|TEXTAREA/.test(e.target.tagName)) return; e.preventDefault(); var r = $('#btapRing').getBoundingClientRect(); bloom(r.left + r.width / 2, r.top + r.height / 2); } if (e.key === 'Escape') stop(false); });
    return el;
  }
  function open(o) {
    opts = o || {}; build();
    var pet = $('#btapPet'); pet.hidden = true; pet.removeAttribute('src'); /* no moon: the koi are the company now */
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
    var stage = $('#btapStage'); water = reduced ? null : makeWater($('#btapWater'), stage.clientWidth || root.innerWidth, stage.clientHeight || root.innerHeight);
    if (water) { renderWater(water); drop(water, water.w / 2, water.h * 0.44, 12, 10); }
    koiStart(stage.clientWidth || root.innerWidth, stage.clientHeight || root.innerHeight);
    tick();
  }
  function tick() {
    if (!state) return;
    var t = Date.now() - state.startedAt, ph = phaseAt(state.preset, t), ring = $('#btapRing'), word = $('#btapWord');
    if (reduced) { ring.style.transform = 'translate(-50%,-50%) scale(.95)'; ring.style.opacity = String(0.55 + 0.45 * ph.size); }
    else ring.style.transform = 'translate(-50%,-50%) scale(' + (0.72 + 0.38 * ph.size).toFixed(3) + ')';
    if (ph.phase !== state.lastPhase) { state.lastPhase = ph.phase; if (!PRESETS[state.preset].quiet) word.textContent = ph.phase === 'in' ? 'in' : 'out'; if (water) drop(water, water.w / 2, water.h * 0.44, 14, 9); }
    if (water && water.active > 0) { stepWater(water); renderWater(water); water.active -= 1; }
    koiStep();
    if (state.plan && t >= state.plan * 60000) { stop(true); return; }
    raf = root.requestAnimationFrame(tick);
  }
  function bloom(x, y) {
    if (!state) return;
    state.taps += 1;
    var r = el.getBoundingClientRect();
    koiCall(x - r.left, y - r.top);
    if (water) drop(water, x - r.left, y - r.top, 4, 72);
    else { var p = document.createElement('span'); p.className = 'btap-petal'; p.style.left = (x - r.left) + 'px'; p.style.top = (y - r.top) + 'px'; $('#btapStage').appendChild(p); setTimeout(function () { p.remove(); }, 1500); }
    plink(); haptic();
  }
  /* a water drop: a quick falling sine, then a quieter higher drip a moment later, like a drop meeting a still pond */
  function plink() {
    if (root.OvuSound) { root.OvuSound.play('drop'); return; } /* the shared kit: one switch, one volume, no stacking */
    if (!soundOn()) return;
    try {
      audio = audio || new (root.AudioContext || root.webkitAudioContext)();
      var t0 = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(820 + Math.random() * 160, t0); o.frequency.exponentialRampToValueAtTime(230, t0 + 0.17);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + 0.65);
      var o2 = audio.createOscillator(), g2 = audio.createGain();
      o2.type = 'sine'; o2.frequency.setValueAtTime(1500, t0 + 0.09); o2.frequency.exponentialRampToValueAtTime(540, t0 + 0.24);
      g2.gain.setValueAtTime(0.0001, t0 + 0.09); g2.gain.exponentialRampToValueAtTime(0.022, t0 + 0.1); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      o2.connect(g2); g2.connect(audio.destination); o2.start(t0 + 0.09); o2.stop(t0 + 0.6);
    } catch (e) { /* no audio */ }
  }

  /* ---- the water: a still pond seen from above. Heights live on a coarse grid (one cell per three pixels);
   * each frame a cell moves toward the mean of its neighbours and loses a little energy, and the picture is
   * the moonlit background refracted by the slope of the surface, with a soft highlight on slopes facing the light. */
  var water = null;
  function makeWater(canvas, w, h) {
    var cell = 3, gw = Math.max(40, Math.round(w / cell)), gh = Math.max(40, Math.round(h / cell)), n = gw * gh;
    canvas.width = gw; canvas.height = gh; canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d'), bg = new Uint8ClampedArray(n * 4), seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++) {
      var t = y / gh, i = (y * gw + x) * 4, dx = (x - gw / 2) / gw, dy = (y - gh * 0.44) / gh, d2 = dx * dx + dy * dy * 1.7;
      var glow = Math.exp(-d2 * 16) * 118;
      glow *= 0.45; bg[i] = 16 + 18 * t + glow * 0.6; bg[i + 1] = 58 + 34 * t + glow; bg[i + 2] = 72 + 30 * t + glow * 0.9; bg[i + 3] = 255; /* a teal pond with a soft light, not moonlight */
    }
    for (var k = 0; k < 46; k++) { var sx = 1 + Math.floor(rnd() * (gw - 2)), sy = 1 + Math.floor(rnd() * (gh - 2)), a = 0.35 + rnd() * 0.65, j = (sy * gw + sx) * 4; bg[j] = Math.min(255, bg[j] + 110 * a); bg[j + 1] = Math.min(255, bg[j + 1] + 110 * a); bg[j + 2] = Math.min(255, bg[j + 2] + 130 * a); }
    return { ctx: ctx, gw: gw, gh: gh, w: w, h: h, cur: new Float32Array(n), prev: new Float32Array(n), bg: bg, img: ctx.createImageData(gw, gh), active: 0 };
  }
  function drop(wt, px, py, radius, strength) {
    var cx = Math.round(px / wt.w * wt.gw), cy = Math.round(py / wt.h * wt.gh), r2 = radius * radius;
    for (var y = -radius; y <= radius; y++) for (var x = -radius; x <= radius; x++) {
      var q = x * x + y * y; if (q > r2) continue; var X = cx + x, Y = cy + y; if (X < 1 || Y < 1 || X >= wt.gw - 1 || Y >= wt.gh - 1) continue;
      wt.prev[Y * wt.gw + X] += strength * (1 - q / (r2 + 1));
    }
    wt.active = 300;
  }
  function stepWater(wt) {
    var gw = wt.gw, gh = wt.gh, cur = wt.cur, prev = wt.prev;
    for (var y = 1; y < gh - 1; y++) { var row = y * gw; for (var x = 1; x < gw - 1; x++) { var i = row + x, v = (prev[i - 1] + prev[i + 1] + prev[i - gw] + prev[i + gw]) * 0.5 - cur[i]; cur[i] = v - v * 0.03; } }
    wt.cur = prev; wt.prev = cur;
  }
  function renderWater(wt) {
    var gw = wt.gw, gh = wt.gh, hgt = wt.prev, bg = wt.bg, out = wt.img.data;
    for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++) {
      var i = y * gw + x, o = i * 4, hx = 0, hy = 0;
      if (x > 0 && x < gw - 1) hx = hgt[i - 1] - hgt[i + 1];
      if (y > 0 && y < gh - 1) hy = hgt[i - gw] - hgt[i + gw];
      var sx = x + ((hx * 0.5) | 0), sy = y + ((hy * 0.5) | 0);
      if (sx < 0) sx = 0; else if (sx >= gw) sx = gw - 1; if (sy < 0) sy = 0; else if (sy >= gh) sy = gh - 1;
      var p = (sy * gw + sx) * 4, shade = (hx + hy) * 2.4;
      out[o] = bg[p] + shade; out[o + 1] = bg[p + 1] + shade; out[o + 2] = bg[p + 2] + shade * 1.15; out[o + 3] = 255;
    }
    wt.ctx.putImageData(wt.img, 0, 0);
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
    water = null; var m = Math.floor(data.seconds / 60), sec = data.seconds % 60;
    /* a short pause is still a pause (four-persona review, 20 Oct: "stay a little longer next time" read as a target) */
    $('#btapDone b').textContent = ev ? 'Your pause is saved.' : 'A brief pause still belongs to you.';
    $('#btapSum').textContent = (ev ? 'Practice time ' + (m ? m + ' min ' : '') + sec + ' s' : 'Short pauses are not saved as practice time, and they still count for you') + (data.taps ? ' · ' + data.taps + (data.taps === 1 ? ' ripple' : ' ripples') : '') + '.';
    return ev;
  }

  /* ---- the koi (Jamie, 20 Oct: big, beautiful, swimming elegantly, and shy of a tap). Three koi about 150 px long glide on
   * slowly curving paths. Each is drawn on one canvas in thin slices from head to tail, every slice shifted sideways along a
   * travelling wave that grows toward the tail, so the body bends the way a fish swims. A tap startles the nearby koi: they
   * turn away and dart, then ease back to a glide. Reduced motion: they rest in place, unbent. */
  var koi = [], koiLast = 0, koiCv = null, koiCtx = null, koiImgs = [], KOI_LEN = 150, SLICES = 22;
  function koiStart(w, h) {
    koiCv = el ? el.querySelector('#btapKoi') : null; if (!koiCv) return;
    var dpr = Math.min(2, root.devicePixelRatio || 1); koiCv.width = Math.round(w * dpr); koiCv.height = Math.round(h * dpr); koiCv.style.width = w + 'px'; koiCv.style.height = h + 'px';
    koiCtx = koiCv.getContext('2d'); koiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!koiImgs.length) koiImgs = [1, 2, 3].map(function (n) { var im = new Image(); im.src = 'assets/room/dream/koi-' + n + '.webp'; return im; });
    koi = koiImgs.map(function (im, i) {
      return { im: im, x: w * (0.25 + 0.25 * i), y: h * (0.3 + 0.22 * i), a: [0.4, 2.6, -1.9][i], turn: 0, base: 20 + 4 * i, v: 20 + 4 * i, ph: i * 2.3, flee: 0, w: w, h: h, len: KOI_LEN * (1 - 0.08 * i) };
    });
    koiLast = 0; koiDraw();
  }
  function koiDraw() {
    if (!koiCtx) return; var c = koiCtx; c.clearRect(0, 0, koiCv.width, koiCv.height);
    koi.forEach(function (f) {
      var im = f.im; if (!im.complete || !im.naturalWidth) return;
      var L = f.len, W = L * im.naturalWidth / im.naturalHeight, amp = reduced ? 0 : L * (0.05 + 0.04 * Math.min(1, f.flee));
      c.save(); c.translate(f.x, f.y); c.rotate(f.a + Math.PI / 2); /* the sprite's head points up the canvas: heading 0 is to the right */
      c.globalAlpha = 0.22; c.fillStyle = '#062431'; c.beginPath(); c.ellipse(6, 10, W * 0.32, L * 0.42, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; /* a soft shadow on the pond floor */
      for (var k = 0; k < SLICES; k++) {
        var t0 = k / SLICES, t1 = (k + 1) / SLICES, sy = im.naturalHeight * t0, sh = im.naturalHeight / SLICES + 0.5;
        var off = amp * Math.pow(t0, 1.6) * Math.sin(f.ph - t0 * 5.2);
        c.drawImage(im, 0, sy, im.naturalWidth, sh, -W / 2 + off, -L / 2 + L * t0, W, L / SLICES + 0.6);
      }
      c.restore();
    });
  }
  function turnToward(f, ang, rate) { var d = Math.atan2(Math.sin(ang - f.a), Math.cos(ang - f.a)); f.a += Math.max(-rate, Math.min(rate, d)); }
  function koiStep() {
    if (!koi.length) return;
    if (reduced) { koiDraw(); return; }
    var now = Date.now(), dt = koiLast ? Math.min(0.05, (now - koiLast) / 1000) : 0; koiLast = now; if (!dt) { koiDraw(); return; }
    koi.forEach(function (f, i) {
      /* a lazy curve: the turn rate drifts slowly, so paths are long arcs, never zigzags */
      f.turn += (Math.sin(now / 2300 + i * 1.7) * 0.35 - f.turn) * 0.6 * dt;
      f.a += f.turn * dt * (f.flee > 0 ? 0.3 : 1);
      var m = f.len * 0.5;
      if (f.x < m || f.x > f.w - m || f.y < m || f.y > f.h - m) turnToward(f, Math.atan2(f.h * 0.5 - f.y, f.w / 2 - f.x), 1.6 * dt);
      /* koi do not touch each other: a gentle turn away from a close neighbour */
      koi.forEach(function (g) { if (g === f) return; var dx = f.x - g.x, dy = f.y - g.y, d = Math.hypot(dx, dy); if (d < f.len * 0.7) turnToward(f, Math.atan2(dy, dx), 0.9 * dt); });
      f.flee = Math.max(0, f.flee - dt * 0.9);
      var target = f.base + 120 * f.flee; f.v += (target - f.v) * Math.min(1, 3 * dt);
      f.x += Math.cos(f.a) * f.v * dt; f.y += Math.sin(f.a) * f.v * dt;
      f.ph += dt * (2.2 + f.v * 0.09); /* the tail beats faster when it hurries */
    });
    koiDraw();
  }
  /* a tap startles: koi within reach turn away from it and dart; the nearest goes fastest */
  function koiCall(x, y) {
    koi.forEach(function (f) {
      var dx = f.x - x, dy = f.y - y, d = Math.hypot(dx, dy), reach = f.len * 1.4; if (d > reach) return;
      var away = Math.atan2(dy, dx); f.a = f.a + Math.atan2(Math.sin(away - f.a), Math.cos(away - f.a)) * (reduced ? 0 : 0.85);
      f.flee = Math.max(f.flee, 1 - d / reach * 0.5); f.turn = 0;
    });
  }
  root.OvuBreathTap = { running: function () { return !!state; }, PRESETS: PRESETS, LENGTHS: LENGTHS, MIN_SAVE_S: MIN_SAVE_S, phaseAt: phaseAt, entryFor: entryFor, open: open, close: close, start: start, stop: stop, makeWater: makeWater, drop: drop, stepWater: stepWater, koi: function () { return koi.map(function (f) { return { x: f.x, y: f.y, fleeing: f.flee > 0.05, len: f.len }; }); } };
})(typeof window !== 'undefined' ? window : this);
