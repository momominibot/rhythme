/* ovu-petwalk.js: the pets walk. Each placed pet rests a while, picks a free spot of floor the walk engine can route it
 * to around the furniture, the other props and her feet, walks there with its own eight-frame walk cycle (side, mirrored
 * for left; away; towards), and rests again; every fourth trip goes home, so pets drift but never wander off. Every step
 * is checked against the floor and the furniture as it is right then, so a pet stops rather than pass through anything.
 * Nothing moves while a sheet is open, during a session or practice, while arranging (pets go home for that), at night
 * or while she sleeps; a tap, Enter or Space on a pet stops it and holds it while its care bubble is open. A worn piece
 * rides on the frame's head anchor. The sitting sprite stays until a strip has decoded; without a strip a pet steps with
 * a small bob. "Walk together" in a pet's bubble takes it along: it follows her trail into every scene until Home time.
 * Design, sources and review outcomes: docs/design/2026-10-19-pets-walk.md. The maths comes first and has
 * no DOM, so tools/test-core.js can load this file and check it. */
(function (root) {
  'use strict';
  var FRAMES = 8, FPS = 8;                                 /* eight frames per stride, eight a second at full speed */
  var SPEED = { cat: 11, dog: 13 };                        /* iso units (percent of plate width) per second */
  var KIND = { cat: 'cat', catblack: 'cat', catginger: 'cat', dog: 'dog', shiba: 'dog', mewmew: 'dog' };
  var RADIUS = 22, LEASH = 34, MIN_TRIP = 5;               /* iso units: reach of one trip, how far from home a pet strays, shortest trip worth taking */
  var REST = [5, 16], HOME_EVERY = 4, EASE = 4, MIN_EASE = 0.4, SAMPLE = 0.5;
  var Y_SCALE = 0.5;
  function kindOf(id) { return KIND[id] || 'cat'; }
  function speedFor(id) { return SPEED[kindOf(id)]; }
  function strideFor(id) { return speedFor(id) / FPS * FRAMES; }
  function cycleAdvance(acc, distIso, id) { return acc + distIso / strideFor(id); }
  function frameOf(acc) { return Math.floor(((acc % 1) + 1) % 1 * FRAMES); }
  function restSeconds(rand) { return REST[0] + (rand || Math.random)() * (REST[1] - REST[0]); }
  function isoDist(a, b) { return Math.hypot(a.x - b.x, (a.y - b.y) / Y_SCALE); }
  function onFloor(W, world, x, y) { return W.inZones(world.zones, x, y) && !W.blocked(world.solids, x, y); }
  /* every segment of a route, sampled every half iso unit, must be on the floor and off the furniture; the first segment
   * may start off the floor (a pet placed on the rim walks onto it) */
  function segmentsClear(W, world, pts, skipFirst) {
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(isoDist(a, b) / SAMPLE));
      for (var k = (i === 1 && skipFirst) ? 1 : 0; k <= n; k++) { var t = k / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; if (i === 1 && skipFirst && k < n && !onFloor(W, world, x, y)) continue; if (!onFloor(W, world, x, y)) return false; }
    }
    return true;
  }
  /* the nearest floor cell to a point: where a pet placed on the plate's rim steps onto the floor */
  function floorStart(W, world, p) { var m = W.rasterise(world), c = W.cellOf(p.x, p.y, m), n = W.nearestFree(m, c.c, c.r, 8); return n ? W.centre(n.c, n.r) : null; }
  /* a route from where the pet stands; off the floor it first steps to the nearest floor cell, then the planner takes over */
  function planFrom(W, world, from, to, snap, startOff) {
    if (!startOff) return W.plan(world, from, to, snap);
    var fs = floorStart(W, world, from); if (!fs) return null;
    var res = W.plan(world, fs, to, snap); if (!res || !res.pts.length) return null;
    return { pts: [{ x: from.x, y: from.y }].concat(res.pts), snapped: res.snapped, cost: res.cost + isoDist(from, fs) };
  }
  /* a trip: a free floor point within RADIUS of where the pet stands and LEASH of its home, at least MIN_TRIP away, that
   * the walk engine can plan a route to whose every segment is clear; W is the walk engine's pure API; null when nothing
   * suits after a few tries. The endpoint actually returned (the planner may snap it) is what is checked */
  /* the free floor cells a trip could end on: within RADIUS of where the pet stands, within LEASH of home, at least
   * MIN_TRIP away; shuffled with the given random source, so a pet on a thin strip of floor still finds its spots */
  function candidates(W, world, from, home, rand) {
    var m = W.rasterise(world), out = [];
    for (var r = 0; r < W.ROWS; r++) for (var c = 0; c < W.COLS; c++) {
      if (!W.cellFree(m, c, r)) continue;
      var p = W.centre(c, r), d = isoDist(p, from);
      if (d < MIN_TRIP || d > RADIUS || isoDist(p, home) > LEASH || p.x < 1 || p.x > 99 || p.y < 1 || p.y > 99) continue;
      out.push(p);
    }
    for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; }
    return out;
  }
  function pickTarget(W, world, from, home, rand, tries, startOff) {
    rand = rand || Math.random; tries = tries || 8;
    var cands = candidates(W, world, from, home, rand);
    for (var i = 0; i < Math.min(tries, cands.length); i++) {
      var t = cands[i];
      var res = planFrom(W, world, from, t, 2, startOff); if (!res || res.pts.length < 2) continue;
      var end = res.pts[res.pts.length - 1];
      if (isoDist(end, from) < MIN_TRIP || isoDist(end, from) > RADIUS + 2 || isoDist(end, home) > LEASH) continue;
      if (!segmentsClear(W, world, res.pts, startOff)) continue;
      return res;
    }
    return null;
  }
  function homeTrip(W, world, from, home, startOff) {
    var goal = onFloor(W, world, home.x, home.y) ? home : floorStart(W, world, home); if (!goal || isoDist(from, goal) < 2) return null;
    var res = planFrom(W, world, from, goal, 3, startOff); if (!res || res.pts.length < 2) return null;
    var end = res.pts[res.pts.length - 1]; if (isoDist(end, goal) > 2.5 || !segmentsClear(W, world, res.pts, startOff)) return null;
    return res;
  }
  /* a worn piece on a walking frame: its sitting spot (pixels of the sitting sprite), expressed from the sitting head,
   * moved to the frame's head and scaled by the heads' widths; all in cell pixels, so the box's flip carries it along */
  function wornOn(spotPx, sitHead, frameHead) {
    var k = frameHead.w / Math.max(1, sitHead.w);
    return { x: frameHead.x + (spotPx.x - sitHead.x) * k, y: frameHead.y + (spotPx.y - sitHead.y) * k, w: spotPx.w * k };
  }
  /* walking together: the pet walks her own trail of footsteps a few steps behind, so it goes round whatever she went
   * round; it speeds up when she runs ahead and eases to a stop when she stops (pure, so tools/test-core.js checks it) */
  var LAG = 7, LOST = 45, CRUMB = 0.6, MAX_CRUMBS = 400;
  function pathLen(from, crumbs, her) { var d = 0, a = from; for (var i = 0; i < crumbs.length; i++) { d += isoDist(a, crumbs[i]); a = crumbs[i]; } return d + isoDist(a, her); }
  function followSpeed(gap) { return Math.max(8, Math.min(32, 12 + gap * 4)); }
  /* move dist iso units along from, then each crumb, then her; returns the new point and how many crumbs it passed */
  function along(from, crumbs, her, dist) {
    var p = { x: from.x, y: from.y }, used = 0;
    while (dist > 1e-9) {
      var t = used < crumbs.length ? crumbs[used] : her, d = isoDist(p, t);
      if (d <= dist) { p = { x: t.x, y: t.y }; dist -= d; if (used < crumbs.length) used++; else break; }
      else { var f = dist / d; p = { x: p.x + (t.x - p.x) * f, y: p.y + (t.y - p.y) * f }; dist = 0; }
    }
    return { x: p.x, y: p.y, used: used };
  }
  /* where the pet stands when she arrives somewhere: a little behind her (the side she is not facing), else beside her */
  function behindSpots(her, left) { var s = left ? 1 : -1; return [{ x: her.x + 5 * s, y: her.y + 1 }, { x: her.x + 4 * s, y: her.y - 1.5 }, { x: her.x + 6 * s, y: her.y + 2.5 }, { x: her.x - 5 * s, y: her.y + 1 }, { x: her.x, y: her.y + 3.5 }, { x: her.x, y: her.y - 3 }]; }
  function validMeta(m) { return !!(m && m.frames === FRAMES && isFinite(m.w) && m.w > 0 && isFinite(m.h) && m.h > 0 && isFinite(m.standW) && m.standW > 0 && m.heads && m.heads.length === FRAMES && m.standHead); }
  var M = { FRAMES: FRAMES, FPS: FPS, SPEED: SPEED, KIND: KIND, RADIUS: RADIUS, LEASH: LEASH, MIN_TRIP: MIN_TRIP, REST: REST, HOME_EVERY: HOME_EVERY, kindOf: kindOf, speedFor: speedFor, strideFor: strideFor, cycleAdvance: cycleAdvance, frameOf: frameOf, restSeconds: restSeconds, isoDist: isoDist, onFloor: onFloor, floorStart: floorStart, planFrom: planFrom, candidates: candidates, segmentsClear: segmentsClear, pickTarget: pickTarget, homeTrip: homeTrip, wornOn: wornOn, validMeta: validMeta };
  M.LAG = LAG; M.LOST = LOST; M.CRUMB = CRUMB; M.pathLen = pathLen; M.followSpeed = followSpeed; M.along = along; M.behindSpots = behindSpots;
  root.OvuPetWalk = { M: M };

  var R = root.OvuRoom, W = root.OvuWalk, P = root.OvuPets, RW = root.OvuRewards;
  if (!R || !W || !W.plan || !root.document || !root.document.createElement) return;
  var doc = root.document, reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var ART = R.ART, scene, props, bubble, pets = {}, raf = 0, last = 0, metas = {}, holds = {}, arranging = false, auto = true, BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  function now() { return root.performance && root.performance.now ? root.performance.now() : Date.now(); }
  function sceneOf(L) { return W.sceneOf ? W.sceneOf(L) : (L && L.scene) || 'home'; }
  function wanderHere(L) { return !!L && !R.visiting() && (sceneOf(L) === 'home' || L.id === 'garden'); }
  function quiet() { return doc.hidden || R.busy() || R.isNight() || (R.asleep && R.asleep()) || arranging || scene.classList.contains('arranging'); }
  /* the floor for one pet right now: the layout's zones and solids, every other prop's feet box, and her live feet */
  function worldFor(id) {
    var L = R.layout(), others = Array.prototype.slice.call(props.querySelectorAll('.prop.owned, .nb')).filter(function (el) { return el.dataset.id !== id && !el.classList.contains('plot') && !el.classList.contains('sitter'); })
      .map(function (el) { var p = pets[el.dataset.id]; return { id: el.dataset.id, x: p ? p.x : parseFloat(el.style.left), y: p ? p.y : parseFloat(el.style.top), w: parseFloat(el.style.width) || 8 }; }).filter(function (p) { return isFinite(p.x) && isFinite(p.y); });
    var w = W.world(L, others), a = W.livePos ? W.livePos() : R.pos();
    w.solids = w.solids.concat([{ id: 'her', x0: a.x - 3, x1: a.x + 3, y0: a.y - 1.5, y1: a.y + 1.2 }]);
    return w;
  }
  /* strips and their sidecars, fetched on first need per pet and direction; the decoded image is kept with the sidecar.
   * A failed fetch is forgotten after a while, so a flaky moment does not cost a pet its walk for the whole session */
  function meta(id, dir) {
    var k = id + '-' + dir, e = metas[k]; if (e && (e.m || e.pending || now() - e.at < 60000)) return e;
    e = metas[k] = { m: null, img: null, pending: true, at: now() };
    root.fetch(ART + 'pet-walk-' + id + '-' + dir + '.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
      e.pending = false; e.at = now(); if (!validMeta(m)) return;
      var im = new Image(); im.src = ART + 'pet-walk-' + id + '-' + dir + '.webp';
      var ready = function () { e.m = m; e.img = im; Object.keys(pets).forEach(function (pid) { var pet = pets[pid]; if (pet.id === id && pet.state === 'walk' && pet.dir === dir && !pet.cycle) showCycle(pet, dir); }); };
      if (im.decode) im.decode().then(ready).catch(function () { }); else im.onload = ready;
    }).catch(function () { e.pending = false; e.at = now(); });
    return e;
  }
  function dirFor(dx, dy) { return W.dirFor ? W.dirFor(dx, dy) : 'side'; }
  /* the strip box inside the pet's body, sized from the sitting image's rendered width (untransformed, so the camera's
   * zoom applies once); the sitting sprite is hidden only once the strip has decoded */
  function showCycle(pet, dir) {
    pet.dir = dir; pet.el.classList.add('walking');
    var e = meta(pet.id, dir), m = e && e.m; if (!m) { hideStrip(pet); return; }
    var body = pet.el.querySelector('.petbody'), img = body && body.querySelector('img'); if (!body || !img) return;
    var box = body.querySelector('.petwalk');
    if (!box) { box = doc.createElement('span'); box.className = 'petwalk'; box.setAttribute('aria-hidden', 'true'); box.innerHTML = '<span class="petclip"><img class="strip" alt=""></span><img class="worn" alt="">'; body.appendChild(box); }
    var s = Math.max(1, img.clientWidth) / m.standW;
    box.style.width = (m.w * s).toFixed(1) + 'px'; box.style.height = (m.h * s).toFixed(1) + 'px';
    var strip = box.querySelector('.strip'), src = ART + 'pet-walk-' + pet.id + '-' + dir + '.webp';
    if (strip.getAttribute('src') !== src) strip.setAttribute('src', src);
    var worn = box.querySelector('.worn'), wearing = RW && RW.wearing ? RW.wearing(pet.id) : null, spot = wearing && P && P.wearSpot ? P.wearSpot(pet.id, wearing.wear) : null;
    if (wearing && spot) { worn.style.display = 'block'; if (worn.getAttribute('src') !== ART + wearing.img) worn.setAttribute('src', ART + wearing.img); pet.worn = { spotPx: { x: spot.x * m.standW, y: spot.y * (m.standH || m.h), w: spot.w * m.standW }, el: worn }; }
    else { worn.style.display = 'none'; if (worn.getAttribute('src') !== BLANK) worn.setAttribute('src', BLANK); pet.worn = null; }
    pet.cycle = { m: m, box: box, strip: strip, dir: dir, frame: -1 };
    pet.el.classList.add('cycling');
    face(pet, pet.heading);
    setFrame(pet, frameOf(pet.acc), true);
  }
  function hideStrip(pet) { pet.el.classList.remove('cycling'); pet.cycle = null; }
  function setFrame(pet, f, force) {
    var c = pet.cycle; if (!c || (c.frame === f && !force)) return; c.frame = f;
    c.strip.style.transform = 'translateX(' + (-(f * 100 / c.m.frames)).toFixed(3) + '%)';
    if (pet.worn && c.m.heads[f]) { var p = wornOn(pet.worn.spotPx, c.m.standHead, c.m.heads[f]); pet.worn.el.style.left = (p.x / c.m.w * 100).toFixed(2) + '%'; pet.worn.el.style.top = (p.y / c.m.h * 100).toFixed(2) + '%'; pet.worn.el.style.width = (p.w / c.m.w * 100).toFixed(2) + '%'; }
  }
  /* facing: a saved flip turns the whole prop, box included, so the strip's own mirror is the difference between the two */
  function face(pet, dx) { if (dx) pet.heading = dx; if (!pet.cycle) return; var left = (pet.heading || 1) < 0, parent = pet.el.classList.contains('flip'); pet.cycle.box.classList.toggle('left', left !== parent); }
  function hideCycle(pet) { pet.el.classList.remove('walking', 'cycling'); if (pet.cycle) pet.cycle.frame = -1; pet.cycle = null; }
  function place(pet) { pet.el.style.left = pet.x.toFixed(2) + '%'; pet.el.style.top = pet.y.toFixed(2) + '%'; }
  /* rest, then a trip; the timer is the pet's own and checks that the pet is still the one it was set for */
  function schedule(pet, secs) {
    clearTimeout(pet.timer);
    if (isPal(pet) && pets[pet.id] === pet) { pet.state = 'follow'; palGo(); return; } /* the pet out walking with her never wanders off on its own */
    pet.state = 'rest';
    pet.timer = root.setTimeout(function () { if (pets[pet.id] === pet) trip(pet); }, (secs === undefined ? restSeconds() : secs) * 1000);
  }
  function trip(pet) {
    if (pets[pet.id] !== pet || !pet.el.isConnected) return;
    if (pet.sleeping || isPal(pet)) return;
    if (reduced) return; /* the pets stay put under reduced motion */
    if (!auto && !pet.force) { schedule(pet, 30); return; } pet.force = false; /* the tests switch wandering off and nudge one pet at a time */
    if (holds[pet.id] || !wanderHere(R.layout()) || (quiet() && !pet.bedtime)) { schedule(pet, 4); return; }
    var w = worldFor(pet.id), from = { x: pet.x, y: pet.y }, startOff = !onFloor(W, w, from.x, from.y);
    var res = (pet.trips + 1) % HOME_EVERY === 0 ? (homeTrip(W, w, from, pet.home, startOff) || pickTarget(W, w, from, pet.home, null, 8, startOff)) : pickTarget(W, w, from, pet.home, null, 8, startOff);
    if (!res) { pet.lastReason = 'no route'; schedule(pet); return; }
    pet.route = { pts: res.pts.slice(1), i: 0 }; pet.state = 'walk'; pet.acc = 0; pet.onFloorYet = !startOff; pet.lastReason = '';
    var d0 = pet.route.pts[0]; pet.heading = (d0.x - pet.x) || pet.heading || 1; showCycle(pet, dirFor(d0.x - pet.x, d0.y - pet.y));
    if (!raf) { last = 0; raf = root.requestAnimationFrame(tick); }
  }
  function stop(pet, why) { if (pet.state !== 'walk') return; pet.route = null; pet.bedtime = false; pet.lastReason = why || 'stopped'; hideCycle(pet); place(pet); schedule(pet); }
  /* one frame of one pet along its route at constant speed, an ease-out at the end; every position is checked against
   * the floor as it is now (her live feet, the other pets), and the pet stops short rather than cross anything */
  function stepPet(pet, dt, w) {
    var r = pet.route, sp = speedFor(pet.id), moved = 0;
    while (r && dt > 0) {
      var tgt = r.pts[r.i]; if (!tgt) { r = pet.route = null; break; }
      var dx = tgt.x - pet.x, dy = tgt.y - pet.y, dist = Math.hypot(dx, dy / Y_SCALE);
      if (dist < 0.05) { r.i++; if (r.i >= r.pts.length) { r = pet.route = null; } continue; }
      var k = r.i === r.pts.length - 1 ? Math.max(MIN_EASE, Math.min(1, dist / EASE)) : 1, adv = Math.min(dist, sp * k * dt), f = adv / dist;
      var nx = pet.x + dx * f, ny = pet.y + dy * f, clear = onFloor(W, w, nx, ny);
      if (!clear && pet.onFloorYet) { pet.route = null; pet.lastReason = 'blocked'; break; } /* something stands in the way now: stop here */
      if (clear) pet.onFloorYet = true;
      var dirNow = dirFor(dx, dy); if (dirNow !== pet.dir) showCycle(pet, dirNow); face(pet, dx);
      pet.x = nx; pet.y = ny; moved += adv; dt -= adv / (sp * k);
      if (adv >= dist - 1e-6) { r.i++; if (r.i >= r.pts.length) r = pet.route = null; }
    }
    return moved;
  }
  function tick(t) {
    raf = 0;
    var dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t; var any = false, movedAny = false;
    Object.keys(pets).forEach(function (id) {
      var pet = pets[id]; if (pet.state !== 'walk') return;
      if (!pet.el.isConnected) { pet.state = 'rest'; return; }
      if (holds[id] || (quiet() && !pet.bedtime)) { stop(pet, holds[id] ? 'held' : 'quiet'); return; } /* a bedtime walk home is the one walk the night allows */
      if (dt) { var moved = stepPet(pet, dt, worldFor(id)); if (moved) { pet.acc = cycleAdvance(pet.acc, moved, pet.id); setFrame(pet, frameOf(pet.acc)); place(pet); movedAny = true; } }
      if (!pet.route) { hideCycle(pet); place(pet); if (pet.lastReason !== 'blocked') pet.trips++; if (pet.bedtime) { if (!atHome(pet)) { pet.x = pet.home.x; pet.y = pet.home.y; place(pet); } curlUp(pet); } else schedule(pet); } else any = true;
    });
    if (movedAny && W.sortDepth) W.sortDepth();
    if (any) raf = root.requestAnimationFrame(tick); else last = 0;
  }
  /* after every props render: pick up the pet elements again; a pet keeps its live spot in the same layout unless the
   * person has been arranging, in which case the saved spots win and become home */
  function sync(L, reset) {
    var seen = {};
    Array.prototype.slice.call(props.querySelectorAll('.prop.owned.pet')).forEach(function (el) {
      var id = el.dataset.id, x = parseFloat(el.style.left), y = parseFloat(el.style.top); if (!isFinite(x) || !isFinite(y)) return;
      seen[id] = true; var pet = pets[id];
      if (!pet || pet.layout !== L.id || reset) { if (pet) clearTimeout(pet.timer); pet = pets[id] = { id: id, el: el, x: x, y: y, home: { x: x, y: y }, layout: L.id, state: 'rest', trips: 0, acc: 0, route: null, cycle: null, timer: 0, heading: 1, dir: null, lastReason: '' }; }
      else { pet.el = el; pet.home = { x: x, y: y }; pet.cycle = null; pet.route = null; pet.state = 'rest'; place(pet); }
      schedule(pet);
    });
    Object.keys(pets).forEach(function (id) { if (!seen[id]) { clearTimeout(pets[id].timer); delete pets[id]; } });
    if (W.sortDepth) W.sortDepth();
  }
  /* ---------- sleeping: at night, or while she sleeps, a pet goes home and curls up ---------- */
  var sleepImgs = {};
  function nightNow() { return !!(R.isNight() || (R.asleep && R.asleep())); }
  function sleepSprite(id, cb) {
    var e = sleepImgs[id]; if (e) { if (e.ok !== undefined) cb(e.ok); else e.cbs.push(cb); return; }
    e = sleepImgs[id] = { ok: undefined, cbs: [cb] };
    var im = new Image(); im.onload = function () { e.ok = true; e.cbs.splice(0).forEach(function (f) { f(true); }); }; im.onerror = function () { e.ok = false; e.cbs.splice(0).forEach(function (f) { f(false); }); };
    im.src = ART + 'pet-sleep-' + id + '.webp';
  }
  function atHome(pet) { return Math.abs(pet.x - pet.home.x) < 1.5 && Math.abs(pet.y - pet.home.y) < 1; }
  function curlUp(pet) {
    if (pet.sleeping) return; pet.sleeping = true; pet.bedtime = false; clearTimeout(pet.timer); pet.state = 'rest';
    pet.el.classList.add('napping');
    sleepSprite(pet.id, function (ok) {
      if (!ok || !pet.sleeping || pets[pet.id] !== pet) return;
      var body = pet.el.querySelector('.petbody'); if (!body) return;
      var img = body.querySelector('img.petsleep');
      if (!img) { img = doc.createElement('img'); img.className = 'petsleep'; img.alt = ''; body.appendChild(img); }
      img.src = ART + 'pet-sleep-' + pet.id + '.webp'; pet.el.classList.add('sleeping');
    });
  }
  function wakeUp(pet) { if (!pet.sleeping) return; pet.sleeping = false; pet.el.classList.remove('sleeping', 'napping'); schedule(pet); }
  function bedtime() {
    if (pal && R.asleep && R.asleep()) endWalk(true); /* she went to bed: the walk is over and the pet goes home to sleep too */
    var night = nightNow();
    Object.keys(pets).forEach(function (id) {
      var pet = pets[id];
      if (isPal(pet)) return; /* a walk in the evening keeps the pet awake beside her */
      if (!night) { if (pet.sleeping) wakeUp(pet); pet.bedtime = false; return; }
      if (pet.sleeping || holds[id] || arranging) return;
      if (atHome(pet) && pet.state !== 'walk') { curlUp(pet); return; }
      if (pet.state === 'walk') { if (!pet.bedtime) { stop(pet, 'bedtime'); } else return; }
      /* walk home first: a bedtime trip is allowed through the night check; arrival (or no route) curls up */
      var w = worldFor(id), from = { x: pet.x, y: pet.y }, res = homeTrip(W, w, from, pet.home, !onFloor(W, w, from.x, from.y));
      if (!res || !res.pts || res.pts.length < 2) { pet.x = pet.home.x; pet.y = pet.home.y; place(pet); if (W.sortDepth) W.sortDepth(); curlUp(pet); return; }
      clearTimeout(pet.timer); pet.bedtime = true; pet.force = true; pet.route = { pts: res.pts.slice(1), i: 0 }; pet.state = 'walk'; pet.acc = 0; pet.onFloorYet = onFloor(W, w, from.x, from.y); pet.lastReason = '';
      var d0 = pet.route.pts[0]; pet.heading = (d0.x - pet.x) || pet.heading || 1; showCycle(pet, dirFor(d0.x - pet.x, d0.y - pet.y));
      if (!raf) { last = 0; raf = root.requestAnimationFrame(tick); }
    });
  }
  /* ---------- walking together (Jamie, 19 Oct): a tap on a pet offers "Walk together"; she says "Let's go for a walk!
   * Shall we?", the pet hops with floating hearts, and then follows her everywhere: the garden, Dream Street, the
   * stores and the plaza. In a scene that does not draw your pets, the walking pet gets its own element. A tap on the
   * pet offers "Home time". Going to bed ends the walk ---------- */
  var pal = null, palRaf = 0, palLast = 0;
  function isPal(pet) { return !!(pal && pet && pal.id === pet.id); }
  function herNow() { return W.livePos ? W.livePos() : R.pos(); }
  function herLeft() { return !!(R.els.avatar && R.els.avatar.classList.contains('flip')); }
  function petName(id) { return (P && P.NAMES && P.NAMES[id]) || 'Your pet'; }
  function shopItem(id) { return RW && RW.SHOP ? RW.SHOP.filter(function (o) { return o.id === id; })[0] : null; }
  function ensurePalEl(L) {
    if (!pal || !props || props.querySelector('.prop.owned.pet[data-id="' + pal.id + '"]')) return;
    var it = shopItem(pal.id); if (!it) return;
    var G = root.OvuGarden && root.OvuGarden.LAYOUT, gp = G && G.props && (G.props[it.id] || (it.posAs && G.props[it.posAs])), base = gp || it.pos || { w: 8 };
    var w = base.w * (it.wk || 1) * ((L && L.avatarW) || 12) / ((G && G.avatarW) || 12);
    var worn = RW.wearing ? RW.wearing(it.id) : null, file = worn && P && P.wornSprite ? P.wornSprite(it.id, worn.id) : null;
    var d = doc.createElement('div'); d.className = 'prop owned pet palclone'; d.dataset.id = it.id;
    var at = pal.at || herNow(); d.style.left = at.x.toFixed(2) + '%'; d.style.top = at.y.toFixed(2) + '%'; d.style.width = w.toFixed(2) + '%';
    d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0'); d.setAttribute('aria-label', petName(it.id) + ' is out walking with you. Tap for care or home time.');
    d.innerHTML = '<span class="petbody"><img src="' + ART + (file || it.img) + '" alt=""></span>';
    props.appendChild(d);
  }
  /* she arrived somewhere (a new scene, or the pet fell far behind): the pet stands just behind her */
  function palArrive() {
    if (!pal) return; var pet = pets[pal.id]; if (!pet) return;
    var her = herNow(), w = worldFor(pet.id), spot = null;
    behindSpots(her, herLeft()).some(function (p) { if (onFloor(W, w, p.x, p.y)) { spot = p; return true; } return false; });
    if (!spot) spot = floorStart(W, w, her) || { x: her.x, y: her.y + 3 };
    clearTimeout(pet.timer); hideCycle(pet); pet.route = null; pet.state = 'follow'; pet.sleeping = false; pet.bedtime = false;
    pet.el.classList.remove('sleeping', 'napping'); pet.x = spot.x; pet.y = spot.y; place(pet);
    pal.crumbs = []; pal.at = { x: spot.x, y: spot.y }; pal.her = { x: her.x, y: her.y };
    if (W.sortDepth) W.sortDepth(her.y);
    palGo();
  }
  function palGo() { if (pal && !palRaf) { clearTimeout(pal.poll); palLast = 0; palRaf = root.requestAnimationFrame(palTick); } }
  function palWait() { if (!pal) return; clearTimeout(pal.poll); pal.poll = root.setTimeout(palGo, 150); }
  function palTick(t) {
    palRaf = 0; if (!pal) return;
    var dt = palLast ? Math.min(0.1, (t - palLast) / 1000) : 0; palLast = t;
    if (R.asleep && R.asleep()) { endWalk(true); bedtime(); return; }
    var pet = pets[pal.id]; if (!pet || !pet.el.isConnected) { palWait(); return; }
    var her = herNow(), herMoved = !pal.her || isoDist(her, pal.her) > 1e-4, last = pal.crumbs.length ? pal.crumbs[pal.crumbs.length - 1] : pal.her;
    if (!last || isoDist(her, last) >= CRUMB) { pal.crumbs.push({ x: her.x, y: her.y }); if (pal.crumbs.length > MAX_CRUMBS) pal.crumbs.splice(0, pal.crumbs.length - MAX_CRUMBS); }
    pal.her = { x: her.x, y: her.y };
    var paused = !pal.ready || holds[pet.id] || doc.hidden || arranging || R.busy();
    var len = pathLen(pet, pal.crumbs, her), from = { x: pet.x, y: pet.y }, moved = 0;
    if (len > LOST) { palArrive(); return; }
    if (!paused && dt && len > LAG + 0.05) {
      if (reduced) { if (!herMoved && len > LAG + 2) { palArrive(); return; } } /* no gliding under reduced motion: once she stops, the pet is simply beside her */
      else {
        var res = along(pet, pal.crumbs, her, Math.min(followSpeed(len - LAG) * dt, len - LAG));
        if (res.used) pal.crumbs.splice(0, res.used);
        moved = isoDist(from, res); pet.x = res.x; pet.y = res.y; pal.at = { x: pet.x, y: pet.y };
      }
    }
    if (moved > 1e-4) {
      var dx = pet.x - from.x, dy = pet.y - from.y, dir = dirFor(dx, dy);
      if (!pet.cycle || pet.dir !== dir) showCycle(pet, dir); else pet.el.classList.add('walking');
      face(pet, dx); pet.acc = cycleAdvance(pet.acc, moved, pet.id); setFrame(pet, frameOf(pet.acc)); place(pet);
      if (W.sortDepth) W.sortDepth(her.y);
      pal.still = 0;
    } else {
      pal.still = (pal.still || 0) + dt;
      if (pal.still > 0.12 && (pet.cycle || pet.el.classList.contains('walking'))) { hideCycle(pet); place(pet); } /* she stopped: the pet sits */
    }
    if (!moved && !herMoved && pal.still > 1) palWait(); else palRaf = root.requestAnimationFrame(palTick);
  }
  /* her line goes in the thought bubble above her head */
  function say(text, ms) {
    var th = doc.getElementById('thought'); if (!th || !R.showThought) return;
    th.classList.add('say'); R.showThought(text); if (R.joy) R.joy();
    root.setTimeout(function () { if (th.textContent !== text) return; R.hideThought(); root.setTimeout(function () { if (th.textContent === text && !th.classList.contains('on')) th.classList.remove('say'); }, 350); }, ms || 2600);
  }
  /* the pet's answer: little jumps and a float of hearts */
  function cheer(id) {
    var pet = pets[id]; if (!pet) return; var el = pet.el, w = parseFloat(el.style.width) || 8;
    el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); root.setTimeout(function () { el.classList.remove('hop'); }, 1900);
    for (var i = 0; i < 5; i++) {
      var h = doc.createElement('span'); h.className = 'petheart palheart ms'; h.textContent = 'favorite'; h.setAttribute('aria-hidden', 'true');
      h.style.left = (pet.x - w * 0.4 + i * w * 0.2) + '%'; h.style.top = (pet.y - w * (0.9 + (i % 2) * 0.25)) + '%'; h.style.animationDelay = (i * 0.16) + 's';
      props.appendChild(h); (function (n) { root.setTimeout(function () { n.remove(); }, 2300); })(h);
    }
  }
  function walkWith(id) {
    var pet = pets[id]; if (!pet) return false;
    if (R.asleep && R.asleep()) { if (R.toast) R.toast('She is asleep. A walk can wait until morning.', 'bedtime'); return false; }
    if (pal && pal.id === id) return true;
    if (pal) endWalk(true);
    clearTimeout(pet.timer); if (pet.state === 'walk') { pet.route = null; hideCycle(pet); place(pet); }
    if (pet.sleeping) { pet.sleeping = false; pet.el.classList.remove('sleeping', 'napping'); }
    pet.bedtime = false; pet.el.classList.remove('napping'); delete holds[id];
    var her = herNow(); pal = { id: id, crumbs: [], her: { x: her.x, y: her.y }, at: { x: pet.x, y: pet.y }, ready: false, still: 0, poll: 0 };
    pet.state = 'follow';
    say('Let\u2019s go for a walk! Shall we?', 2600);
    root.setTimeout(function () { if (pal && pal.id === id) cheer(id); }, 650);
    root.setTimeout(function () { if (!pal || pal.id !== id) return; pal.ready = true; if (R.toast) R.toast(petName(id) + ' is coming along. Walk at ' + petName(id) + '\u2019s pace and notice what catches her eye.', 'pets'); palGo(); }, 1900);
    palGo(); return true;
  }
  function endWalk(quietly) {
    if (!pal) return; var id = pal.id, pet = pets[id]; clearTimeout(pal.poll); pal = null;
    if (palRaf) { root.cancelAnimationFrame(palRaf); palRaf = 0; }
    if (!pet) return;
    hideCycle(pet); place(pet); pet.state = 'rest';
    var clone = pet.el.classList.contains('palclone');
    if (clone) { var el = pet.el; clearTimeout(pet.timer); delete pets[id]; el.classList.add('palbye'); root.setTimeout(function () { el.remove(); if (W.sortDepth) W.sortDepth(); }, 650); }
    else schedule(pet, 2);
    if (!quietly && R.toast) R.toast((clone ? petName(id) + ' trots home for a nap.' : petName(id) + ' had a lovely walk.') + ' One slow breath for the walk you shared.', 'pets');
    if (!clone) bedtime();
  }
  /* the pet's care bubble gets one more choice: Walk together, or Home time for the pet already out with her */
  function addWalkButton() {
    if (!bubble || !bubble.classList.contains('on') || !bubble.classList.contains('petbub')) return;
    var id = bubble.dataset.pet; if (!id || !pets[id] || bubble.querySelector('[data-petwalk]')) return;
    var on = !!(pal && pal.id === id), b = doc.createElement('button'); b.type = 'button'; b.dataset.petwalk = on ? 'end' : 'start';
    b.innerHTML = '<span class="ms">' + (on ? 'home' : 'pets') + '</span>' + (on ? 'Home time' : 'Walk together');
    bubble.appendChild(b);
  }
  function stopAll(why) { Object.keys(pets).forEach(function (id) { stop(pets[id], why); }); }
  function goHomeAll() { Object.keys(pets).forEach(function (id) { var pet = pets[id]; if (pet.state === 'walk') { pet.route = null; hideCycle(pet); } pet.x = pet.home.x; pet.y = pet.home.y; place(pet); clearTimeout(pet.timer); pet.state = 'rest'; }); if (W.sortDepth) W.sortDepth(); }
  function hold(id) { var pet = pets[id]; if (!pet) return; holds[id] = true; stop(pet, 'held'); }
  function release() { Object.keys(holds).forEach(function (id) { delete holds[id]; if (pets[id]) schedule(pets[id]); }); }
  function mount() {
    scene = R.els.scene; props = R.els.props; bubble = doc.getElementById('bubble');
    R.on('layout', function (L) {
      Object.keys(pets).forEach(function (id) { clearTimeout(pets[id].timer); }); pets = {}; holds = {}; ensurePalEl(L); sync(L, true);
      if (pal) { palArrive(); root.setTimeout(function () { if (pal && pal.her && isoDist(herNow(), pal.her) > 2) palArrive(); }, 120); } /* the walk engine may set her at the door just after */
    });
    R.on('props', function (L) { ensurePalEl(L || R.layout()); sync(L || R.layout(), arranging); if (pal && pets[pal.id]) pets[pal.id].el.classList.remove('napping', 'sleeping'); });
    /* a tap, Enter or Space on a pet opens its care bubble: the pet stops and stays while the bubble is up */
    var act = function (e) { var el = e.target.closest && e.target.closest('.prop.owned.pet'); if (!el || !pets[el.dataset.id]) return; if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return; hold(el.dataset.id); };
    props.addEventListener('pointerdown', act, true); props.addEventListener('click', act, true); props.addEventListener('keydown', act, true);
    if (bubble) bubble.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-petwalk]'); if (!b) return; var id = bubble.dataset.pet; if (b.dataset.petwalk === 'end') endWalk(); else walkWith(id); }, true);
    if (root.MutationObserver) {
      if (bubble) new MutationObserver(function () { if (bubble.classList.contains('on') && bubble.classList.contains('petbub') && bubble.dataset.pet) { hold(bubble.dataset.pet); addWalkButton(); } else if (!bubble.classList.contains('on')) release(); }).observe(bubble, { attributes: true, attributeFilter: ['class', 'data-pet'], childList: true });
      new MutationObserver(function () {
        var a = scene.classList.contains('arranging'); if (a === arranging) return; arranging = a;
        if (arranging) { endWalk(true); goHomeAll(); } else sync(R.layout(), true); /* arranging works on the saved spots; afterwards those are home */
      }).observe(scene, { attributes: true, attributeFilter: ['class'] });
    }
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) { stopAll('hidden'); Object.keys(pets).forEach(function (id) { clearTimeout(pets[id].timer); }); }
      else { last = 0; Object.keys(pets).forEach(function (id) { if (!pets[id].sleeping) schedule(pets[id]); }); bedtime(); }
    });
    root.addEventListener('resize', function () { Object.keys(pets).forEach(function (id) { var pet = pets[id]; if (pet.cycle) showCycle(pet, pet.dir); }); });
    sync(R.layout(), true);
    bedtime(); root.setInterval(function () { if (!doc.hidden) bedtime(); }, 20000);
    R.on('layout', function () { root.setTimeout(bedtime, 300); });
  }
  root.OvuPetWalk.bedtime = bedtime;
  root.OvuPetWalk.nudge = function (id, secs) { var pet = pets[id]; if (!pet) return false; if (pet.sleeping) wakeUp(pet); stop(pet, 'nudged'); delete holds[id]; pet.force = true; schedule(pet, secs || 0); return true; };
  root.OvuPetWalk.auto = function (on) { auto = !!on; };
  root.OvuPetWalk.stop = function (id) { if (pets[id]) stop(pets[id], 'stopped'); };
  root.OvuPetWalk.state = function (id) { var pet = pets[id]; if (!pet) return null; return { x: pet.x, y: pet.y, home: pet.home, state: pet.state, sleeping: !!pet.sleeping, trips: pet.trips, dir: pet.dir, frame: pet.cycle ? pet.cycle.frame : -1, cycle: !!pet.cycle, walking: pet.el.classList.contains('walking'), cycling: pet.el.classList.contains('cycling'), held: !!holds[id], reason: pet.lastReason, heading: pet.heading }; };
  root.OvuPetWalk.pets = function () { return Object.keys(pets); };
  root.OvuPetWalk.walkWith = walkWith; root.OvuPetWalk.endWalk = endWalk;
  root.OvuPetWalk.pal = function () { if (!pal) return null; var pet = pets[pal.id]; return { id: pal.id, ready: !!pal.ready, x: pet ? pet.x : null, y: pet ? pet.y : null, state: pet ? pet.state : null, clone: !!(pet && pet.el.classList.contains('palclone')), crumbs: pal.crumbs.length }; };
  R.on('boot', mount);
})(window);
