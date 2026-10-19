/* Koi Pond (was Moon Tap): a no-fail breath break. A ring opens on the in-breath and closes on the out-breath over a
 * still pond where three koi swim (Jamie, 19 Oct: koi, not the moon). Tap the water and a ripple spreads and the koi turn and glide to it;
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
  function soundOn() { try { var s = store(); return !s || !!s.state().sound; } catch (e) { return true; } }
  function build() {
    if (el) return el;
    reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el = h('<div class="btap" id="btap" role="dialog" aria-label="Koi Pond, a breath break" hidden>' +
      '<div class="w-stars" aria-hidden="true"></div>' +
      '<div class="btap-card" id="btapCard">' +
        '<h2>Koi Pond</h2>' +
        '<p>Breathe comfortably. Tap the water and the koi come to see, or simply watch them. You don’t need to match the ring.</p>' +
        '<div class="btap-chips" id="btapPresets" role="group" aria-label="Pace"></div>' +
        '<div class="btap-chips" id="btapLengths" role="group" aria-label="How long"></div>' +
        '<p class="safe">Breathe gently, without forcing a deeper or longer breath. Stop if you feel dizzy, tingly, short of breath or distressed, and return to your usual breathing.</p>' +
        '<div class="row"><button type="button" class="btn primary" id="btapBegin"><span class="ms">blur_on</span>Begin</button><button type="button" class="btn ghost" id="btapClose">Close</button></div>' +
      '</div>' +
      '<div class="btap-stage" id="btapStage" hidden>' +
        '<canvas class="btap-water" id="btapWater" aria-hidden="true"></canvas>' +
        '<div class="btap-koi" id="btapKoi" aria-hidden="true"><img src="assets/room/dream/koi-1.webp" alt=""><img src="assets/room/dream/koi-2.webp" alt=""><img src="assets/room/dream/koi-3.webp" alt=""></div>' +
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
    $('#btapDone b').textContent = ev ? 'Your pause is saved.' : 'That was a short one.';
    $('#btapSum').textContent = (ev ? 'Practice time ' + (m ? m + ' min ' : '') + sec + ' s' : 'Stay a little longer next time and it will count as practice time') + (data.taps ? ' · ' + data.taps + (data.taps === 1 ? ' ripple' : ' ripples') : '') + '.';
    return ev;
  }

  /* ---- the koi: three fish wander the pond; a tap calls them to the ripple, faster at first, then they drift on.
   * Heading 0 points right; the sprites face up, so they turn a quarter more. Reduced motion: they rest in place. */
  var koi = [], koiLast = 0, KOI_W = 54;
  function koiStart(w, h) {
    var imgs = el ? el.querySelectorAll('#btapKoi img') : [];
    koi = Array.prototype.map.call(imgs, function (im, i) {
      var a = (i / 3) * Math.PI * 2 + 0.6;
      return { el: im, x: w * (0.3 + 0.2 * i), y: h * (0.62 + 0.08 * (i % 2)), a: a, v: 22 + 6 * i, tx: null, ty: null, until: 0, ph: i * 2.1, w: w, h: h };
    });
    koiLast = 0; koi.forEach(koiDraw);
  }
  function koiDraw(f) {
    var wag = reduced ? 0 : Math.sin(f.ph) * 7;
    f.el.style.transform = 'translate(' + (f.x - KOI_W / 2).toFixed(1) + 'px,' + (f.y - KOI_W * 0.8).toFixed(1) + 'px) rotate(' + (f.a * 180 / Math.PI + 90 + wag).toFixed(1) + 'deg)';
  }
  function turnToward(f, ang, rate) { var d = Math.atan2(Math.sin(ang - f.a), Math.cos(ang - f.a)); f.a += Math.max(-rate, Math.min(rate, d)); }
  function koiStep() {
    if (!koi.length || reduced) return;
    var now = Date.now(), dt = koiLast ? Math.min(0.05, (now - koiLast) / 1000) : 0; koiLast = now; if (!dt) return;
    koi.forEach(function (f, i) {
      var chasing = f.tx !== null && now < f.until, speed = chasing ? 70 : f.v, m = 40;
      if (chasing) { var dx = f.tx - f.x, dy = f.ty - f.y; if (Math.hypot(dx, dy) < 18) { f.tx = null; } else turnToward(f, Math.atan2(dy, dx), 3.2 * dt); }
      else { f.a += Math.sin(now / 1700 + i * 2) * 0.5 * dt; }
      /* stay in the pond: turn back toward the middle near an edge */
      if (f.x < m || f.x > f.w - m || f.y < m * 2 || f.y > f.h - m * 2) turnToward(f, Math.atan2(f.h * 0.55 - f.y, f.w / 2 - f.x), 2.4 * dt);
      f.x += Math.cos(f.a) * speed * dt; f.y += Math.sin(f.a) * speed * dt;
      f.ph += dt * (chasing ? 14 : 6);
      koiDraw(f);
    });
  }
  function koiCall(x, y) {
    var now = Date.now();
    koi.forEach(function (f, i) { f.tx = x + (i - 1) * 22; f.ty = y + (i % 2 ? 16 : -12); f.until = now + 2600 + i * 300; });
    if (reduced) koi.forEach(function (f) { f.x = f.tx; f.y = f.ty; koiDraw(f); });
  }
  root.OvuBreathTap = { PRESETS: PRESETS, LENGTHS: LENGTHS, MIN_SAVE_S: MIN_SAVE_S, phaseAt: phaseAt, entryFor: entryFor, open: open, close: close, start: start, stop: stop, makeWater: makeWater, drop: drop, stepWater: stepWater, koi: function () { return koi.map(function (f) { return { x: f.x, y: f.y, chasing: f.tx !== null && Date.now() < f.until }; }); } };
})(typeof window !== 'undefined' ? window : this);
