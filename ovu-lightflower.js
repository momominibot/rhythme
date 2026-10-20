/* Light Flower: a listening and attention practice (Jamie, 20 Oct, with a picture of a glass flower made of light;
 * designed with Codex, docs/design/2026-10-20-light-flower.md). One luminous flower, drawn here from points of light.
 * A tap lights one petal and sounds one soft glass note that fades; she notices it fading and, when her mind wanders,
 * gently comes back. Nothing fills, grows or scores: the flower is whole from the start, fast taps never stack light or
 * sound, and stopping at any moment saves the practice time. No fast flashing: a petal brightens over 300 ms and settles
 * over four seconds, and a new petal can light at most every 400 ms. Reduced motion: a still flower, no drifting light. */
(function (root) {
  'use strict';
  var LENGTHS = [{ min: 0, name: 'Open' }, { min: 2, name: '2 min' }, { min: 5, name: '5 min' }];
  var PETALS = 6, RISE_MS = 300, SETTLE_MS = 4000, MIN_GAP_MS = 400;
  /* how bright a petal is t ms after it was lit: up over RISE_MS, then a slow settle (pure, tested) */
  function glowAt(t) {
    if (t < 0) return 0;
    if (t < RISE_MS) { var a = t / RISE_MS; return 0.5 - 0.5 * Math.cos(Math.PI * a); }
    var b = (t - RISE_MS) / SETTLE_MS; return b >= 1 ? 0 : Math.pow(1 - b, 1.6);
  }
  /* lighting a petal again: if it is still settling, carry on from the brightness it has now (no jump), else rise from dark */
  function holdFrom(t) {
    var g = glowAt(t); if (g <= 0.02) return 0;
    if (t < RISE_MS) return t;
    return RISE_MS + (1 - Math.pow(g, 1 / 1.6)) * SETTLE_MS;
  }
  /* which petal a tap lights: the one under the tap if it is on the flower, else the next one round (pure, tested) */
  function petalFor(dx, dy, r, prev, rot) {
    if (Math.hypot(dx, dy) <= r * 1.15 && Math.hypot(dx, dy) > r * 0.12) {
      var a = Math.atan2(dy, dx) - rot, k = Math.round(((a + Math.PI / 2) / (2 * Math.PI)) * PETALS);
      return ((k % PETALS) + PETALS) % PETALS;
    }
    return ((prev | 0) + 1) % PETALS;
  }
  /* the saved entry: practice time and the plan, nothing about taps */
  function entryFor(seconds, planned, startedAt, endedAt) {
    seconds = Math.max(0, Math.round(Number(seconds) || 0));
    return { kind: 'lightflower', seconds: seconds, minutes: Math.round(seconds / 6) / 10, planned: planned || 0, completed: !!(planned && seconds >= planned * 60), startedAt: startedAt, endedAt: endedAt };
  }

  /* ---- the screen ---- */
  var el = null, st = null, raf = 0, opts = {}, reduced = false, pending = null;
  function h(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function $(s) { return el ? el.querySelector(s) : null; }
  function store() { return root.OvuStore || null; }
  function sound() { return root.OvuSound || null; }
  function build() {
    if (el) return el;
    reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    el = h('<div class="btap lflower" id="lflower" role="dialog" aria-label="Light Flower, a listening practice" hidden>' +
      '<div class="btap-card" id="lfCard">' +
        '<h2>Light Flower</h2>' +
        '<p>Tap to hear a soft note and watch a petal glow. Notice it fading, and gently return whenever your attention wanders.</p>' +
        '<div class="btap-chips" id="lfLengths" role="group" aria-label="How long"></div>' +
        '<label class="lf-air"><input type="checkbox" id="lfAir" checked> Soft air in the background</label>' +
        '<p class="safe">There is nothing to get right. Watching quietly works too, and you can stop whenever you like.</p>' +
        '<div class="row"><button type="button" class="btn primary" id="lfBegin"><span class="ms">local_florist</span>Begin</button><button type="button" class="btn ghost" id="lfClose">Close</button></div>' +
      '</div>' +
      '<div class="btap-stage lf-stage" id="lfStage" hidden>' +
        '<canvas class="lf-canvas" id="lfCanvas" aria-hidden="true"></canvas>' +
        '<button type="button" class="lf-flower" id="lfFlower" aria-label="Light a petal"></button>' +
        '<div class="btap-word lf-word" id="lfWord" aria-live="polite"></div>' +
        '<button type="button" class="btn btap-stop" id="lfStop">Stop</button>' +
      '</div>' +
      '<div class="btap-card btap-done" id="lfDone" hidden><b></b><p id="lfSum"></p><div class="row"><button type="button" class="btn primary" id="lfRetry" hidden>Try saving again</button><button type="button" class="btn primary" id="lfDoneClose">Close</button></div></div>' +
    '</div>');
    document.body.appendChild(el);
    $('#lfLengths').innerHTML = LENGTHS.map(function (L, i) { return '<button type="button" data-min="' + L.min + '" class="' + (i === 0 ? 'on' : '') + '" aria-pressed="' + (i === 0) + '">' + L.name + '</button>'; }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-min]'); if (!b) return;
      Array.prototype.forEach.call(b.parentNode.children, function (c) { c.classList.toggle('on', c === b); c.setAttribute('aria-pressed', c === b); });
    });
    $('#lfBegin').addEventListener('click', start);
    $('#lfClose').addEventListener('click', close);
    $('#lfDoneClose').addEventListener('click', close);
    $('#lfRetry').addEventListener('click', function () { if (pending) finishSave(pending); });
    $('#lfStop').addEventListener('click', function () { stop(false); });
    $('#lfStage').addEventListener('pointerdown', function (e) { if (e.target.closest('#lfStop')) return; e.preventDefault(); light(e.clientX, e.clientY); });
    $('#lfFlower').addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); light(null, null); } });
    document.addEventListener('keydown', function (e) { if (st && !el.hidden && e.key === 'Escape') stop(false); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && st) stop(false); }); /* leaving the app ends and saves the pause */
    root.addEventListener('resize', function () { if (st) { size(); paintBase(); } });
    return el;
  }
  function open(o) {
    opts = o || {}; build();
    $('#lfCard').hidden = false; $('#lfStage').hidden = true; $('#lfDone').hidden = true; el.hidden = false;
    var s = sound(); $('#lfAir').closest('label').hidden = !(s && s.enabled());
    document.body.classList.add('btap-open');
    try { $('#lfBegin').focus({ preventScroll: true }); } catch (e) { }
  }
  function close() {
    if (st) stop(false, true);
    if (el) el.hidden = true; document.body.classList.remove('btap-open');
    var s = sound(); if (s) s.ambience(false);
    var f = opts.onClose; opts = {}; if (f) f();
  }
  function asleep() { try { var s = store(); return !!(s && s.state().sleeping); } catch (e) { return false; } }
  function start() {
    if (asleep()) { close(); return; } /* a real sleep stops every game until she wakes */
    var plan = Number(($('#lfLengths .on') || { dataset: { min: 0 } }).dataset.min) || 0;
    st = { plan: plan, t0: root.performance.now(), startedAt: new Date().toISOString(), lit: new Array(PETALS).fill(-1e9), lastLit: -1e9, prev: PETALS - 1, sparks: [], hinted: false };
    $('#lfCard').hidden = true; $('#lfDone').hidden = true; $('#lfStage').hidden = false;
    size(); paintBase();
    var s = sound(); if (s && $('#lfAir').checked) s.ambience(true);
    $('#lfWord').textContent = 'Tap the flower, then listen.'; /* focus stays where it was: no ring drawn round the flower */
    tick();
  }
  function light(x, y) {
    if (!st) return;
    var now = root.performance.now(), c = st.geo, k;
    if (x === null) k = (st.prev + 1) % PETALS;
    else { var r = $('#lfCanvas').getBoundingClientRect(); k = petalFor(x - r.left - c.cx, y - r.top - c.cy, c.R, st.prev, c.rot); }
    if (now - st.lastLit < MIN_GAP_MS) return; /* fast taps keep the glow as it is: no stacking, no flashing */
    st.lit[k] = now - holdFrom(now - st.lit[k]); /* a petal still glowing keeps its brightness and settles again from there: never re-flashed */
    st.lastLit = now; st.prev = k;
    var s = sound(); if (s) s.play('petal');
    if (!reduced) spark(k);
    try { if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(8); } catch (e) { }
    if (!st.hinted) { st.hinted = true; $('#lfWord').textContent = ''; root.setTimeout(function () { if (st) $('#lfWord').textContent = 'Notice the note fading.'; }, 600); root.setTimeout(function () { if (st) $('#lfWord').textContent = ''; }, 6000); }
  }
  function tick() {
    if (!st) return;
    var now = root.performance.now();
    if (st.plan && now - st.t0 >= st.plan * 60000) { var s = sound(); if (s) s.play('save'); stop(true); return; }
    draw(now);
    raf = root.requestAnimationFrame(tick);
  }
  function stop(completed, silent) {
    if (!st) return null;
    root.cancelAnimationFrame(raf);
    var seconds = (root.performance.now() - st.t0) / 1000, data = entryFor(seconds, st.plan, st.startedAt, new Date().toISOString());
    st = null; var s = sound(); if (s) s.ambience(false);
    if (data.seconds < 1) { if (!silent) showDone(null, data); return null; }
    var ev = finishSave(data, silent);
    return ev;
  }
  function finishSave(data, silent) {
    var S = store(), ev = null;
    try { ev = S ? S.add('mindfulness', S.today(), data, 'room') : null; } catch (e) { ev = null; }
    pending = ev ? null : data;
    if (ev && opts.onSaved) { try { opts.onSaved(ev); } catch (e) { } }
    if (!silent) showDone(ev, data);
    return ev;
  }
  function showDone(ev, data) {
    $('#lfStage').hidden = true; $('#lfDone').hidden = false;
    var m = Math.floor(data.seconds / 60), sec = data.seconds % 60;
    $('#lfDone b').textContent = ev ? 'Your pause is saved.' : pending ? 'This pause could not be saved yet.' : 'A brief pause still belongs to you.';
    $('#lfSum').textContent = ev ? 'Practice time ' + (m ? m + ' min ' : '') + sec + ' s.' : pending ? 'Your practice time is kept here. Try again, or close and it is let go.' : 'Nothing to save this time.';
    $('#lfRetry').hidden = !pending;
    try { $(pending ? '#lfRetry' : '#lfDoneClose').focus({ preventScroll: true }); } catch (e) { }
  }

  /* ---- drawing: everything is points of light on a near-black night, composed once, then lit per petal ---- */
  var cv = null, ctx = null, base = null, petalCv = [], bokeh = [], W = 0, H = 0, dpr = 1;
  function rnd(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function size() {
    cv = $('#lfCanvas'); var r = $('#lfStage').getBoundingClientRect();
    W = Math.max(280, r.width || root.innerWidth); H = Math.max(400, r.height || root.innerHeight); dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx = cv.getContext('2d');
    var R = Math.min(W * 0.36, H * 0.25), geo = { cx: W / 2, cy: H * 0.4, R: R, rot: 0.14 };
    if (st) st.geo = geo; else return;
    var fl = $('#lfFlower'); fl.style.left = (geo.cx - R * 1.15) + 'px'; fl.style.top = (geo.cy - R * 1.15) + 'px'; fl.style.width = fl.style.height = (R * 2.3) + 'px';
    var g = rnd(11); bokeh = [];
    for (var i = 0; i < 20; i++) bokeh.push({ x: g() * W, y: g() * H, r: 5 + g() * 22, a: 0.06 + g() * 0.16, hue: g(), vx: (g() - 0.5) * 3, vy: -1 - g() * 3 });
  }
  function petalPath(c, L, Wd) {
    /* a petal pointing along +x from the centre: wide in the middle, a soft rounded tip with a little ruffle */
    var pts = [], n = 48;
    for (var i = 0; i <= n; i++) { var u = i / n, hw = Wd * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.04)), 0.75) * (1 - 0.18 * u) * (1 + 0.05 * Math.sin(u * 20)); pts.push([u * L, hw]); }
    for (var j = n; j >= 0; j--) { var v = j / n, hv = Wd * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.04)), 0.75) * (1 - 0.18 * v) * (1 + 0.05 * Math.sin(v * 17 + 1)); pts.push([v * L, -hv]); }
    return pts;
  }
  function dot(c, x, y, r, col) { var g = c.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, col); g.addColorStop(0.35, col.replace(/[\d.]+\)$/, function (a) { return (parseFloat(a) * 0.45) + ')'; })); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3, 0, Math.PI * 2); c.fill(); }
  /* one petal, drawn once on its own small canvas so lighting it costs one extra draw */
  function makePetal(k, geo) {
    var L = geo.R * (0.96 + 0.06 * Math.sin(k * 2.1)), Wd = geo.R * 0.4, pad = 18, p = document.createElement('canvas');
    p.width = Math.round((L + pad * 2) * dpr); p.height = Math.round((Wd * 2 + pad * 2) * dpr);
    var c = p.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.translate(pad, Wd + pad); c.globalCompositeOperation = 'lighter';
    var pts = petalPath(c, L, Wd);
    var fill = c.createLinearGradient(0, 0, L, 0); fill.addColorStop(0, 'rgba(255,214,150,0.32)'); fill.addColorStop(0.35, 'rgba(200,176,255,0.16)'); fill.addColorStop(1, 'rgba(150,170,255,0.10)');
    c.beginPath(); pts.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); c.fillStyle = fill; c.fill();
    var g = rnd(101 + k * 7);
    for (var i = 0; i < pts.length; i += 1) { var q = pts[i]; if (g() < 0.85) dot(c, q[0], q[1], 0.8 + g() * 0.9, g() < 0.5 ? 'rgba(255,236,214,0.85)' : 'rgba(214,200,255,0.8)'); }
    for (var v = -2; v <= 2; v++) { for (var u = 0.08; u < 0.92; u += 0.035) { var y = v * Wd * 0.32 * Math.sin(Math.PI * u) * (1 - 0.2 * u); if (g() < 0.7) dot(c, u * L, y, 0.5 + g() * 0.6, 'rgba(230,214,255,0.38)'); } }
    return { cv: p, L: L, Wd: Wd, pad: pad };
  }
  function paintBase() {
    var geo = st.geo; base = document.createElement('canvas'); base.width = cv.width; base.height = cv.height;
    var c = base.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var bg = c.createRadialGradient(geo.cx, geo.cy, 0, geo.cx, geo.cy, Math.max(W, H) * 0.75); bg.addColorStop(0, '#1d1636'); bg.addColorStop(0.5, '#0f0c20'); bg.addColorStop(1, '#07060f'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    var g = rnd(5), sx = geo.cx, sy = geo.cy + geo.R * 0.2, ex = geo.cx + geo.R * 0.25, ey = H - 120; /* the stem ends above the Stop button */
    /* the stem and one leaf, traced in light */
    for (var t = 0; t <= 1; t += 0.012) { var x = sx + (ex - sx) * t + Math.sin(t * 3) * geo.R * 0.12, y = sy + (ey - sy) * t; dot(c, x - 2, y, 0.7 + g() * 0.6, 'rgba(200,220,255,0.6)'); dot(c, x + 2, y, 0.7 + g() * 0.6, 'rgba(255,220,200,0.5)'); }
    var lx = geo.cx + geo.R * 0.2, ly = geo.cy + geo.R * 1.45, ll = geo.R * 0.9;
    for (var u = 0; u <= 1; u += 0.02) { var hw = geo.R * 0.2 * Math.sin(Math.PI * u), ax = lx + u * ll * 0.8, ay = ly - u * ll * 0.45; dot(c, ax - hw * 0.45, ay - hw * 0.8, 0.7 + g() * 0.6, 'rgba(190,210,255,0.55)'); dot(c, ax + hw * 0.45, ay + hw * 0.8, 0.7 + g() * 0.6, 'rgba(210,200,255,0.5)'); if (g() < 0.5) dot(c, ax, ay, 0.5, 'rgba(230,220,255,0.35)'); }
    petalCv = []; for (var k = 0; k < PETALS; k++) petalCv.push(makePetal(k, geo));
    drawPetals(c, geo, null);
    /* the golden heart and its stamens */
    var cg = c.createRadialGradient(geo.cx, geo.cy, 0, geo.cx, geo.cy, geo.R * 0.42); cg.addColorStop(0, 'rgba(255,236,190,0.9)'); cg.addColorStop(0.3, 'rgba(255,200,140,0.45)'); cg.addColorStop(1, 'rgba(255,170,120,0)'); c.fillStyle = cg; c.beginPath(); c.arc(geo.cx, geo.cy, geo.R * 0.42, 0, Math.PI * 2); c.fill();
    for (var s = 0; s < 18; s++) { var a = (s / 18) * Math.PI * 2 + g() * 0.2, len = geo.R * (0.22 + g() * 0.18); for (var f = 0.15; f < 1; f += 0.12) dot(c, geo.cx + Math.cos(a) * len * f, geo.cy + Math.sin(a) * len * f, 0.45, 'rgba(255,226,170,0.55)'); dot(c, geo.cx + Math.cos(a) * len, geo.cy + Math.sin(a) * len, 1.4 + g() * 0.8, 'rgba(255,232,180,0.95)'); }
  }
  function drawPetals(c, geo, only, alpha) {
    for (var k = 0; k < PETALS; k++) {
      if (only !== null && only !== undefined && only !== k) continue;
      var P = petalCv[k], a = geo.rot + (k / PETALS) * Math.PI * 2 - Math.PI / 2;
      c.save(); c.translate(geo.cx, geo.cy); c.rotate(a); if (alpha !== undefined) c.globalAlpha = alpha;
      c.drawImage(P.cv, -P.pad, -P.Wd - P.pad, P.cv.width / dpr, P.cv.height / dpr); c.restore();
    }
  }
  function spark(k) {
    var geo = st.geo, a = geo.rot + (k / PETALS) * Math.PI * 2 - Math.PI / 2, g = Math.random;
    for (var i = 0; i < 12; i++) { var d = geo.R * (0.3 + g() * 0.7); st.sparks.push({ x: geo.cx + Math.cos(a) * d + (g() - 0.5) * 14, y: geo.cy + Math.sin(a) * d + (g() - 0.5) * 14, vy: -(6 + g() * 10), vx: (g() - 0.5) * 6, born: root.performance.now(), life: 2200 + g() * 900, r: 0.8 + g() * 1.1 }); }
    if (st.sparks.length > 90) st.sparks.splice(0, st.sparks.length - 90);
  }
  function draw(now) {
    if (!ctx || !base) return;
    var geo = st.geo; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalCompositeOperation = 'lighter';
    /* soft bokeh drifting upward, slower than a breath */
    bokeh.forEach(function (b, i) {
      if (!reduced) { b.x += b.vx / 60; b.y += b.vy / 60; if (b.y < -30) { b.y = H + 30; b.x = Math.random() * W; } if (b.x < -30) b.x = W + 30; if (b.x > W + 30) b.x = -30; }
      var col = b.hue < 0.4 ? '255,190,160' : b.hue < 0.75 ? '190,170,255' : '150,200,255', gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      gr.addColorStop(0, 'rgba(' + col + ',' + b.a + ')'); gr.addColorStop(0.7, 'rgba(' + col + ',' + (b.a * 0.6) + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    });
    /* the lit petals: one extra draw each, at most as bright as one light */
    for (var k = 0; k < PETALS; k++) {
      var gl = glowAt(now - st.lit[k]); if (gl <= 0.01) continue;
      var pa = geo.rot + (k / PETALS) * Math.PI * 2 - Math.PI / 2, px = geo.cx + Math.cos(pa) * geo.R * 0.55, py = geo.cy + Math.sin(pa) * geo.R * 0.55, halo = ctx.createRadialGradient(px, py, 0, px, py, geo.R * 0.62);
      halo.addColorStop(0, 'rgba(255,226,190,' + (0.22 * gl) + ')'); halo.addColorStop(0.45, 'rgba(214,196,255,' + (0.16 * gl) + ')'); halo.addColorStop(1, 'rgba(160,150,255,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(px, py, geo.R * 0.62, 0, Math.PI * 2); ctx.fill(); /* a soft glow round the petal */
      drawPetals(ctx, geo, k, Math.min(1, gl));
    }
    /* star glints at a few petal tips, twinkling slowly (a full cycle takes about four seconds) */
    for (var s = 0; s < PETALS; s += 2) {
      var a = geo.rot + (s / PETALS) * Math.PI * 2 - Math.PI / 2, x = geo.cx + Math.cos(a) * geo.R * 0.93, y = geo.cy + Math.sin(a) * geo.R * 0.93, tw = reduced ? 0.6 : 0.45 + 0.35 * Math.sin(now / 650 + s), len = 6 + 4 * tw;
      ctx.strokeStyle = 'rgba(255,240,220,' + (0.55 * tw) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - len, y); ctx.lineTo(x + len, y); ctx.moveTo(x, y - len); ctx.lineTo(x, y + len); ctx.stroke();
    }
    /* light rising gently from a lit petal */
    st.sparks = st.sparks.filter(function (p) {
      var t = now - p.born; if (t > p.life) return false; var f = 1 - t / p.life;
      var x = p.x + p.vx * t / 1000, y = p.y + p.vy * t / 1000; dot(ctx, x, y, p.r, 'rgba(255,238,214,' + (0.7 * f) + ')'); return true;
    });
  }
  root.OvuLightFlower = { LENGTHS: LENGTHS, PETALS: PETALS, RISE_MS: RISE_MS, SETTLE_MS: SETTLE_MS, MIN_GAP_MS: MIN_GAP_MS, glowAt: glowAt, holdFrom: holdFrom, petalFor: petalFor, entryFor: entryFor, open: open, close: close, start: start, stop: stop, running: function () { return !!st; } };
})(typeof window !== 'undefined' ? window : this);
