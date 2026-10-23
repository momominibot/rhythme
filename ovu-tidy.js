/* Rhythme tidy up (Jamie, 22 Oct 2026: "tidy up your room can have a magical broom animation"). A little clutter appears
 * in her home over the day, on the pets' poop pattern: a pure time model under state.tidy (so it syncs with the account
 * copy like the pets), at most two new things a day and three on the floor at once, a sock, a mug on its side, a tumbled
 * stack of books, a cushion askew. Nothing nags: no toast, badge or count. Tapping a thing, or "Tidy up your room" in
 * Everyday mindfulness, starts the practice (room.js runPractice, the one-activity rule, Stop, hearts, the save question are
 * all the existing practice path), and while she does the real tidy a magical broom sweeps the picture of her room by
 * itself along a route the walk engine plans, each thing vanishing in a small puff as the broom passes.
 * The model, the spot picker and the sweep route are pure (no DOM) so tools/test-core.js checks them; the DOM part mounts
 * once room.js announces boot. Design and Codex review: docs/design/2026-10-23-tidy-up-broom.md. */
(function (root) {
  'use strict';
  var KINDS = ['sock', 'cup', 'books', 'cushion'];
  var MAX_ITEMS = 3, PER_DAY = 2, GAP_MIN = 150; /* on the floor at once; new things a calendar day; minutes after the last tidy, the last thing or the first visit */
  /* each kind's picture: width in percent of the room's plate at her usual scale (avatarW 12, scaled by the layout's avatarW),
   * the footprint share for the ground shadow (room.css --cs), and the words a screen reader hears */
  var LOOK = {
    sock: { img: 'tidy-sock.webp', w: 4.4, cs: 0.8, label: 'A pair of socks on the floor' },
    cup: { img: 'tidy-cup.webp', w: 3.6, cs: 0.7, label: 'A mug on its side on the floor' },
    books: { img: 'tidy-books.webp', w: 4.4, cs: 0.9, label: 'A tumbled stack of books on the floor' },
    cushion: { img: 'tidy-cushion.webp', w: 5.0, cs: 0.9, label: 'A cushion dropped on the floor' }
  };
  var BROOM = { img: 'tidy-broom.webp', w: 3.0, cs: 0.34 }, PUFF = { img: 'tidy-puff.webp' };
  var Y_SCALE = 0.5;
  function now(t) { return typeof t === 'number' ? t : Date.now(); }
  function iso(t) { return new Date(t).toISOString(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayOf(t) { var d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); } /* the local calendar day, as the store writes dates; computed here so a pinned test clock cannot hide a day change */
  function isDay(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function validItem(it) { return !!(it && typeof it === 'object' && typeof it.id === 'string' && KINDS.indexOf(it.kind) > -1 && typeof it.at === 'string' && isFinite(Date.parse(it.at))); }
  /* the saved state, made safe: a missing or edited save becomes an empty floor with the anchor kept where it is valid */
  function normalise(s) {
    s = s && typeof s === 'object' ? s : {};
    var items = (Array.isArray(s.items) ? s.items : []).filter(validItem).slice(0, MAX_ITEMS).map(function (it) { return { id: it.id, kind: it.kind, at: it.at, slot: isFinite(it.slot) ? Math.max(0, Math.floor(it.slot)) : 0 }; });
    var seen = {}; items = items.filter(function (it) { if (seen[it.id] || seen['k' + it.kind]) return false; seen[it.id] = seen['k' + it.kind] = true; return true; }); /* one of each kind, no repeats */
    return {
      items: items,
      last: typeof s.last === 'string' && isFinite(Date.parse(s.last)) ? s.last : null,
      day: s.day && isDay(s.day.d) ? { d: s.day.d, n: Math.max(0, Math.floor(Number(s.day.n) || 0)) } : null,
      tidiedAt: typeof s.tidiedAt === 'string' && isFinite(Date.parse(s.tidiedAt)) ? s.tidiedAt : null,
      n: Math.max(0, Math.floor(Number(s.n) || 0))
    };
  }
  function nextKind(s) { for (var i = 0; i < KINDS.length; i++) { var k = KINDS[(s.n + i) % KINDS.length]; if (!s.items.some(function (it) { return it.kind === k; })) return k; } return null; }
  function nextSlot(s) { for (var i = 0; i < MAX_ITEMS; i++) if (!s.items.some(function (it) { return it.slot === i; })) return i; return 0; }
  /* The floor as of time t, from a saved state: the anchor is set on the first call ever; while fewer than MAX_ITEMS things
   * are out, fewer than PER_DAY appeared on the day the next one would land, and a full gap has passed, the next thing
   * appears a gap after the last event. Forward-only: a clock set back spawns nothing, and never reopens a day's count. */
  function advance(saved, t) {
    t = now(t); var s = normalise(saved), changed = false;
    if (!s.last) { s.last = iso(t); changed = true; }
    var lastMs = Date.parse(s.last); if (t < lastMs) t = lastMs;
    var today = dayOf(t), lastDay = dayOf(lastMs);
    if (s.day && s.day.d > today) return { state: s, changed: changed }; /* the saved day is later than this one (the clock went back across midnight): nothing new */
    /* a later day starts at its first visit: the first thing comes a gap after that, never backfilled from yesterday's anchor
     * (Codex design review, 23 Oct); the day watermark only moves forward */
    if (today > lastDay) { s.last = iso(t); s.day = { d: today, n: 0 }; changed = true; }
    else if (!s.day || s.day.d !== today) { s.day = { d: today, n: 0 }; changed = true; }
    var guard = 0;
    while (s.items.length < MAX_ITEMS && s.day.n < PER_DAY && guard++ < 6) {
      var at = Date.parse(s.last) + GAP_MIN * 60000; if (at > t) break;
      var kind = nextKind(s); if (!kind) break;
      s.items.push({ id: 't' + at.toString(36) + s.n.toString(36), kind: kind, at: iso(at), slot: nextSlot(s) });
      s.last = iso(at); s.day.n++; s.n++; changed = true;
    }
    return { state: s, changed: changed };
  }
  /* some things are gone: the next one is a full gap after the tidy; a clock set back cannot rewind the anchor */
  function remove(saved, ids, t) {
    t = now(t); var s = normalise(saved), before = s.items.length;
    if (s.last && t < Date.parse(s.last)) t = Date.parse(s.last);
    s.items = s.items.filter(function (it) { return ids.indexOf(it.id) < 0; });
    if (s.items.length !== before) { s.tidiedAt = iso(t); s.last = iso(t); }
    return { state: s, removed: before - s.items.length };
  }
  /* store-backed: the floor now, written only when it changed */
  function write(S, st) { (S.commit || S.setState)({ tidy: st }); } /* rollback-safe: a failed save leaves the store as it was */
  function current(S, t) { var r = advance(S.state().tidy, t); if (r.changed) write(S, r.state); return r.state; }
  function tidy(S, ids, t) { var r = remove(S.state().tidy, ids, t); if (r.removed) write(S, r.state); return r; }

  /* ---------- spots: open floor on each home plate, from the geometry, never hand-placed ---------- */
  function iso2(a, b) { return Math.hypot(a.x - b.x, (a.y - b.y) / Y_SCALE); }
  var spotCache = {};
  /* the floor clutter may lie on: the ground-floor polygon of a house (never the stairs strip or upstairs), any floor zone elsewhere */
  function ground(L, K, x, y) { var floor = L.stairs ? [L.zones[0]] : (L.zones || []), stairsZone = L.stairs && L.zones.length > 2 ? L.zones[2] : null; return K.inZones(floor, x, y) && !(stairsZone && K.inPoly(stairsZone, x, y)); }
  /* K is the walk engine's pure API (OvuWalk). Houses: the ground floor polygon only, never the stairs strip or upstairs.
   * A candidate cell is open floor with at least 3 iso units of clear floor around it in every direction, 6 or more from
   * her home spot, every stand point, door and stair, 7 or more from every hotspot pin (so never on the mat the pin marks),
   * and with no painted piece starting just below it (a sock drawn over a sofa's back would look like it sat on the sofa).
   * Three spots are picked by clearance plus spread, at least 10 units apart. */
  function spots(L, K) {
    if (!L || !K || !K.world) return [];
    if (spotCache[L.id]) return spotCache[L.id];
    var world = K.world(L, []), mk = K.rasterise(world), cols = mk.cols;
    function onFloor(x, y) { return ground(L, K, x, y) && !K.blocked(world.solids, x, y); }
    function clearance(p) { var best = 8; for (var a = 0; a < 16; a++) { var ca = Math.cos(a * Math.PI / 8), sa = Math.sin(a * Math.PI / 8); for (var d = 0.5; d < best; d += 0.5) { if (!onFloor(p.x + d * ca, p.y + d * Y_SCALE * sa)) { best = Math.min(best, d); break; } } } return best; }
    var avoid = [L.home].concat((L.hotspots || []).map(function (h) { return h.wp; }).filter(Boolean), L.doors || [], L.stairs || []);
    /* never behind her where she usually stands: her standing picture would cover it and take its taps (a sock behind her head) */
    var aw = L.avatarW || 12, herBox = L.home ? { x0: L.home.x - aw * 0.6, x1: L.home.x + aw * 0.6, y0: L.home.y - aw * 2.264 * ((L.w || 1) / (L.h || 1)) - 2, y1: L.home.y + 2 } : null;
    var cand = [];
    for (var r = 0; r < K.ROWS; r++) for (var c = 0; c < cols; c++) {
      if (!K.cellFree(mk, c, r)) continue;
      var p = K.centre(c, r);
      if (!onFloor(p.x, p.y)) continue;
      if (avoid.some(function (a) { return iso2(p, a) < 6; })) continue;
      if ((L.hotspots || []).some(function (h) { return iso2(p, h) < 7; })) continue;
      if (herBox && p.x >= herBox.x0 && p.x <= herBox.x1 && p.y >= herBox.y0 && p.y <= herBox.y1) continue;
      var cl = clearance(p); if (cl < 3) continue;
      if ((L.solids || []).some(function (b) { return !b.poly && p.x >= b.x0 - 2 && p.x <= b.x1 + 2 && p.y < b.y0 && b.y0 <= p.y + 14; })) continue;
      cand.push({ x: p.x, y: p.y, cl: cl });
    }
    var out = [];
    while (out.length < MAX_ITEMS && cand.length) {
      var best = null, bs = -1;
      cand.forEach(function (q) { var spread = out.length ? Math.min.apply(null, out.map(function (o) { return iso2(q, o); })) : 20; if (spread < 10) return; var sc = Math.min(q.cl, 6) + 0.1 * Math.min(spread, 30); if (sc > bs) { bs = sc; best = q; } });
      if (!best) break;
      out.push({ x: best.x, y: best.y }); cand = cand.filter(function (q) { return q !== best; });
    }
    return (spotCache[L.id] = out);
  }
  function spotOf(L, K, item) { var sp = spots(L, K); return sp.length ? sp[(item.slot || 0) % sp.length] : null; }
  /* where each thing is drawn right now: its slot's spot, unless a placed piece of furniture (world carries the props'
   * footprints) covers it or another thing already took it, in which case the nearest free cell of the live floor,
   * deterministically; null when no floor is free near it (the thing is then not drawn in this layout) */
  function placeItems(L, K, items, world) {
    var m = K.rasterise(world), taken = [], out = [];
    items.forEach(function (it) {
      var p = spotOf(L, K, it); if (!p) { out.push(null); return; }
      var free = ground(L, K, p.x, p.y) && !K.blocked(world.solids, p.x, p.y) && !taken.some(function (q) { return iso2(p, q) < 3; });
      if (!free) { var c = K.cellOf(p.x, p.y, m), list = K.nearestFreeList(m, c.c, c.r, 5).filter(function (k) { var q = K.centre(k.c, k.r); return ground(L, K, q.x, q.y) && !taken.some(function (z) { return iso2(q, z) < 3; }); }); p = list.length ? K.centre(list[0].c, list[0].r) : null; } /* the fallback keeps the same floor rule as the picker (Codex diff review) */
      if (p) taken.push(p); out.push(p ? { x: p.x, y: p.y } : null);
    });
    return out;
  }
  var REACH = 2.5; /* iso units: the broom must end a leg this close to a thing to sweep it; a snapped or blocked route leaves it */
  function reached(at, target) { return iso2(at, target) <= REACH; }

  /* ---------- the sweep route: nearest thing first, then the empty spots (a once-over), then a rest by the door ---------- */
  /* world is the floor as it is now (OvuWalk.world with the props and her feet); returns legs [{to, item, pts}] from `from`,
   * each pts a planned route (first point = the previous target). A target the planner cannot reach is left out. */
  function route(K, world, from, items, L) {
    var legs = [], at = { x: from.x, y: from.y }, left = items.slice();
    while (left.length) {
      var best = null, bd = Infinity;
      left.forEach(function (it) { var d = iso2(at, it); if (d < bd) { bd = d; best = it; } });
      left = left.filter(function (it) { return it !== best; });
      var r = K.plan(world, at, { x: best.x, y: best.y }, 2); if (!r || r.pts.length < 2) continue;
      legs.push({ to: { x: best.x, y: best.y }, item: best.id, pts: r.pts }); at = r.pts[r.pts.length - 1];
    }
    var extra = spots(L, K).filter(function (s) { return !items.some(function (it) { return Math.abs(it.x - s.x) < 0.5 && Math.abs(it.y - s.y) < 0.5; }); });
    extra.sort(function (a, b) { return iso2(at, a) - iso2(at, b); });
    extra.forEach(function (s) { var r = K.plan(world, at, s, 2); if (!r || r.pts.length < 2) return; legs.push({ to: s, item: null, pts: r.pts }); at = r.pts[r.pts.length - 1]; });
    var door = (L.doors || [])[0]; if (door) { var rd = K.plan(world, at, { x: door.x, y: door.y }, 3); if (rd && rd.pts.length >= 2) legs.push({ to: { x: door.x, y: door.y }, item: null, rest: true, pts: rd.pts }); }
    return legs;
  }
  /* where the broom appears: a free floor point five to seven units to the side she is not facing, else behind, else at her feet */
  function startNear(K, world, her, left) {
    var s = left ? 1 : -1, tries = [{ x: her.x + 6 * s, y: her.y + 1 }, { x: her.x + 5 * s, y: her.y - 1.5 }, { x: her.x + 7 * s, y: her.y + 2 }, { x: her.x - 6 * s, y: her.y + 1 }, { x: her.x, y: her.y + 3.5 }, { x: her.x, y: her.y - 3 }];
    for (var i = 0; i < tries.length; i++) if (K.inZones(world.zones, tries[i].x, tries[i].y) && !K.blocked(world.solids, tries[i].x, tries[i].y)) return tries[i];
    return { x: her.x, y: her.y };
  }
  var M = { KINDS: KINDS, MAX_ITEMS: MAX_ITEMS, PER_DAY: PER_DAY, GAP_MIN: GAP_MIN, LOOK: LOOK, BROOM: BROOM, PUFF: PUFF, normalise: normalise, advance: advance, remove: remove, current: current, tidy: tidy, spots: spots, spotOf: spotOf, ground: ground, placeItems: placeItems, REACH: REACH, reached: reached, route: route, startNear: startNear, dayOf: dayOf, _resetSpots: function () { spotCache = {}; } };
  root.OvuTidy = { M: M };

  /* ---------- DOM wiring (only in the room page): the things on the floor, and the broom while she tidies ---------- */
  var R = root.OvuRoom, W = root.OvuWalk, S = root.OvuStore, doc = root.document;
  if (!R || !W || !W.plan || !S || !doc || !doc.createElement) return;
  var ART = R.ART, HER = 720 / 318; /* her standing canvas, height over width: the broom is fitted to a share of her height */
  var BROOM_SHARE = 0.6, SPEED = 6, DWELL = 1.4, DWELL_STILL = 1.2, APPEAR = 0.6, DISSOLVE = 0.8, SPARK_EVERY = 0.12, SPARK_MAX = 14;
  var layer = null, els = {}, sweep = null, runSeq = 0, fast = false, raf = 0, last = 0, broomAspect = 560 / 235, aspectAsked = false;
  function reducedMo() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function k() { return typeof fast === 'number' ? fast : (fast ? 8 : 1); } /* the smoke suite runs the sweep faster or slower (OvuTidy.fast(true) is eight times); nothing else changes */
  function atHome(L) { return !!L && W.sceneOf(L) === 'home' && !R.visiting(); }
  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = doc.getElementById('tidyLayer');
    if (!layer) { layer = doc.createElement('div'); layer.id = 'tidyLayer'; R.els.props.parentNode.insertBefore(layer, R.els.props); } /* a layer of its own beside the props, no stacking context: the one depth sort ranks its children with her and the pets */
    return layer;
  }
  /* the floor with the placed furniture (never the pets, which step over a sock): where things may lie */
  function worldProps(L) {
    var props = Array.prototype.slice.call(R.els.props.querySelectorAll('.prop.owned:not(.pet), .nb, .keeper')).map(function (el) { return { id: el.dataset.id, x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: parseFloat(el.style.width) || 8 }; }).filter(function (p) { return isFinite(p.x) && isFinite(p.y); });
    return W.world(L, props);
  }
  /* the floor as the broom sees it: furniture, pets and her feet are all in the way */
  function worldNow(L) {
    var props = Array.prototype.slice.call(R.els.props.querySelectorAll('.prop.owned, .nb, .keeper')).map(function (el) { return { id: el.dataset.id, x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: parseFloat(el.style.width) || 8 }; }).filter(function (p) { return isFinite(p.x) && isFinite(p.y); });
    var w = W.world(L, props), a = W.livePos ? W.livePos() : R.pos();
    w.solids = w.solids.concat([{ id: 'her', x0: a.x - 3, x1: a.x + 3, y0: a.y - 1.5, y1: a.y + 1.2 }]);
    return w;
  }
  function onFloor(w, x, y) { return W.inZones(w.zones, x, y) && !W.blocked(w.solids, x, y); }
  function widthFor(L, kind) { return LOOK[kind].w * ((L && L.avatarW) || 12) / 12; }
  function broomWidth(L) { return BROOM_SHARE * ((L && L.avatarW) || 12) * HER / broomAspect; }
  function make(it) {
    var el = doc.createElement('button'); el.type = 'button'; el.className = 'tidy tidyitem ' + it.kind; el.dataset.id = it.id; el.style.setProperty('--cs', String(LOOK[it.kind].cs));
    el.setAttribute('aria-label', LOOK[it.kind].label + '. Tap to tidy up.');
    el.innerHTML = '<img src="' + ART + LOOK[it.kind].img + '" alt="" draggable="false">';
    return el;
  }
  /* draw the floor as the model says, in this layout; during a sweep the model is read, not advanced, so nothing new lands
   * under the broom */
  function draw() {
    var L = R.layout(); ensureLayer();
    if (!atHome(L)) { Object.keys(els).forEach(function (id) { els[id].remove(); delete els[id]; }); return; }
    var st = sweep ? normalise(S.state().tidy) : current(S), pos = placeItems(L, W, st.items, worldProps(L));
    Object.keys(els).forEach(function (id) { if (!st.items.some(function (it) { return it.id === id; })) { els[id].remove(); delete els[id]; } });
    st.items.forEach(function (it, i) {
      var p = pos[i], el = els[it.id];
      if (!p) { if (el) { el.remove(); delete els[it.id]; } return; }
      if (!el) { el = els[it.id] = make(it); layer.appendChild(el); }
      el.style.left = p.x.toFixed(2) + '%'; el.style.top = p.y.toFixed(2) + '%'; el.style.width = widthFor(L, it.kind).toFixed(2) + '%';
    });
    if (W.sortDepth) W.sortDepth();
  }
  /* ---------- the sweep ---------- */
  function sparkAt(x, y) {
    if (!sweep || reducedMo()) return;
    if (layer.querySelectorAll('.spark').length >= SPARK_MAX) return;
    var sp = doc.createElement('span'); sp.className = 'spark'; sp.setAttribute('aria-hidden', 'true');
    sp.style.left = (x + (Math.random() - 0.5) * 2.4).toFixed(2) + '%'; sp.style.top = (y - Math.random() * 1.2).toFixed(2) + '%';
    layer.appendChild(sp); root.setTimeout(function () { sp.remove(); }, 750);
  }
  function burst(x, y, n) { for (var i = 0; i < n; i++) sparkAt(x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 1.5); }
  function puffAt(x, y, w) {
    if (reducedMo()) return;
    var pf = doc.createElement('span'); pf.className = 'puff'; pf.setAttribute('aria-hidden', 'true'); pf.innerHTML = '<img src="' + ART + PUFF.img + '" alt="">';
    pf.style.left = x.toFixed(2) + '%'; pf.style.top = y.toFixed(2) + '%'; pf.style.width = (w * 1.7).toFixed(2) + '%';
    layer.appendChild(pf); root.setTimeout(function () { pf.remove(); }, 700);
  }
  function placeBroom(sw) { sw.el.style.left = sw.x.toFixed(2) + '%'; sw.el.style.top = sw.y.toFixed(2) + '%'; }
  function askAspect() {
    if (aspectAsked) return; aspectAsked = true;
    var im = new Image(); im.onload = function () { if (im.naturalWidth && im.naturalHeight) broomAspect = im.naturalHeight / im.naturalWidth; if (sweep) sweep.el.style.width = broomWidth(R.layout()).toFixed(2) + '%'; }; im.src = ART + BROOM.img;
  }
  function begin() {
    var L = R.layout(); if (sweep || !atHome(L)) return false;
    ensureLayer(); askAspect();
    var st = normalise(S.state().tidy), pos = placeItems(L, W, st.items, worldProps(L));
    var targets = st.items.map(function (it, i) { return pos[i] ? { id: it.id, kind: it.kind, x: pos[i].x, y: pos[i].y } : null; }).filter(Boolean);
    var her = W.livePos ? W.livePos() : R.pos(), facingLeft = R.els.avatar.classList.contains('flip');
    var world = worldNow(L), start = startNear(W, world, her, facingLeft), legs = route(W, world, start, targets, L);
    var el = doc.createElement('div'); el.className = 'tidy broom'; el.setAttribute('aria-hidden', 'true'); el.style.setProperty('--cs', String(BROOM.cs));
    el.innerHTML = '<img src="' + ART + BROOM.img + '" alt="" draggable="false">'; el.style.width = broomWidth(L).toFixed(2) + '%';
    layer.appendChild(el);
    sweep = { tok: ++runSeq, el: el, x: start.x, y: start.y, legs: legs, li: 0, pi: 1, phase: 'appear', t: 0, spark: 0, swept: [], expected: targets.map(function (t) { return t.id; }), floor: st.items.map(function (it) { return it.id; }), replanned: false, layout: L.id, still: reducedMo() };
    var tg = {}; legs.forEach(function (lg) { if (lg.item) tg[lg.item] = lg.to; }); var kinds = {}; targets.forEach(function (t) { kinds[t.id] = t.kind; });
    sweep.targetOf = function (id) { return tg[id] ? { id: id, kind: kinds[id] || 'sock', x: tg[id].x, y: tg[id].y } : null; }; /* each sweep remembers its targets by id for the reach check */
    placeBroom(sweep); if (W.sortDepth) W.sortDepth();
    if (root.OvuSound) root.OvuSound.play('boop');
    root.requestAnimationFrame(function () { if (sweep && sweep.el === el) el.classList.add('on'); });
    burst(start.x, start.y, 8);
    last = 0; if (!raf) raf = root.requestAnimationFrame(tick);
    return true;
  }
  /* one idempotent end: the broom, every spark and puff go at once; things not yet swept stay where they are */
  function end() {
    if (!sweep) return;
    var sw = sweep; sweep = null;
    if (raf) { root.cancelAnimationFrame(raf); raf = 0; } last = 0;
    try { sw.el.remove(); } catch (e) { }
    if (layer) Array.prototype.slice.call(layer.querySelectorAll('.spark, .puff')).forEach(function (n) { n.remove(); });
    var st = normalise(S.state().tidy); Object.keys(els).forEach(function (id) { if (!st.items.some(function (it) { return it.id === id; })) { els[id].remove(); delete els[id]; } }); /* a thing already written away finishes going; the rest stay as they are */
    if (W.sortDepth) W.sortDepth();
  }
  /* the thing under the broom goes: written first (a copy, through the farm lock the game save shares, the store re-read
   * inside it), and only then the puff; a write that fails, a replaced copy or a sweep that ended meanwhile leave it */
  function sweepItem(sw, target, cb) {
    var go = function () {
      if (sweep !== sw) { cb(false); return; }
      if (doc.hidden) { /* the page went away while the write waited for the lock: nothing happens unseen; it is tried once more when she is back */
        if (sw.deferred) { cb(false); return; } sw.deferred = true;
        var again = function () { doc.removeEventListener('visibilitychange', again); if (sweep === sw) sweepItem(sw, target, cb); else cb(false); };
        doc.addEventListener('visibilitychange', again); return;
      }
      try { if (S.reload) S.reload(); } catch (e) { }
      /* the room as it is right now, inside the lock: asleep, left, or the practice over means nothing is written (Codex diff review) */
      if (!R.practiceOn() || R.asleep() || !R.layout() || R.layout().id !== sw.layout || !atHome(R.layout())) { cb(false); return; }
      var st = normalise(S.state().tidy); if (!st.items.some(function (it) { return it.id === target.id; })) { cb(false); return; }
      var r = remove(st, [target.id]);
      sw.swept.push(target.id); /* before the write: the store tells its listeners synchronously, and this sweep's own removal must not read as a replaced floor */
      try { (S.commit || S.setState)({ tidy: r.state }); } catch (e) { sw.swept.pop(); cb(false); return; }
      var el = els[target.id]; if (el) { el.classList.add('swept'); root.setTimeout(function () { if (els[target.id] !== el) return; if (normalise(S.state().tidy).items.some(function (it) { return it.id === target.id; })) { el.classList.remove('swept'); return; } /* put back by an account copy meanwhile: it stays */ el.remove(); delete els[target.id]; }, 520); }
      puffAt(target.x, target.y, widthFor(R.layout(), target.kind)); if (root.OvuSound) root.OvuSound.play('swish');
      if (!sw.still) burst(target.x, target.y, 6);
      cb(true);
    };
    var FMl = root.OvuFarm;
    if (FMl && FMl.locked) { try { var p = FMl.locked(S, go); if (p && p.catch) p.catch(function () { cb(false); }); } catch (e) { go(); } } else go();
  }
  function tick(t) {
    raf = 0; var sw = sweep; if (!sw) return;
    if (!R.practiceOn() || R.layout().id !== sw.layout || R.asleep()) { end(); return; } /* belt and braces: the events below end it first */
    var dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t; /* a hidden page stops frames; the clamp means no jump on return */
    var L = R.layout(), K = k();
    if (sw.phase === 'appear') { sw.t += dt * K; if (sw.still || sw.t >= APPEAR) { sw.phase = 'move'; sw.t = 0; sw.el.classList.add('sweeping'); } }
    else if (sw.phase === 'move') {
      var leg = sw.legs[sw.li];
      if (!leg) { sw.phase = 'dissolve'; sw.t = 0; sw.el.classList.remove('sweeping', 'dwell'); sw.el.classList.remove('on'); if (!sw.still) burst(sw.x, sw.y, 6); }
      else if (sw.still) { var endp = leg.pts[leg.pts.length - 1], wv = worldNow(L); if (!onFloor(wv, endp.x, endp.y)) { sw.li++; sw.pi = 1; } else { sw.x = endp.x; sw.y = endp.y; placeBroom(sw); if (W.sortDepth) W.sortDepth(); sw.phase = 'dwell'; sw.t = 0; sw.el.classList.add('dwell'); } } /* reduced motion: the broom appears where the planned route ends, never further; the reach check at the dwell decides as usual */
      else {
        var w = worldNow(L), left = dt * K, moved = 0;
        while (leg && left > 0) {
          var tgt = leg.pts[sw.pi]; if (!tgt) { sw.phase = 'dwell'; sw.t = 0; sw.el.classList.add('dwell'); break; }
          var dx = tgt.x - sw.x, dy = tgt.y - sw.y, dist = Math.hypot(dx, dy / Y_SCALE);
          if (dist < 0.05) { sw.pi++; continue; }
          var adv = Math.min(dist, SPEED * left), f = adv / dist, nx = sw.x + dx * f, ny = sw.y + dy * f;
          if (!W.segClear(w, { x: sw.x, y: sw.y }, { x: nx, y: ny }, null)) { /* the whole step is checked, not only its end (Codex): something stands in the way now, so plan this leg again once from here, else leave the thing and move on */
            if (!sw.replanned) { sw.replanned = true; var r2 = W.plan(w, { x: sw.x, y: sw.y }, leg.to, 2); if (r2 && r2.pts.length >= 2) { leg.pts = r2.pts; sw.pi = 1; continue; } }
            sw.li++; sw.pi = 1; sw.replanned = false; leg = sw.legs[sw.li]; break;
          }
          sw.x = nx; sw.y = ny; moved += adv; left -= adv / SPEED;
          if (adv >= dist - 1e-6) sw.pi++;
        }
        if (moved) { placeBroom(sw); if (W.sortDepth) W.sortDepth(); sw.spark += dt * K; if (sw.spark >= SPARK_EVERY) { sw.spark = 0; sparkAt(sw.x, sw.y); } }
      }
    }
    else if (sw.phase === 'dwell') {
      sw.t += dt * K;
      if (sw.t >= (sw.still ? DWELL_STILL : DWELL)) {
        var lg = sw.legs[sw.li]; sw.el.classList.remove('dwell');
        var next = function () { if (sweep !== sw) return; sw.li++; sw.pi = 1; sw.replanned = false; sw.phase = lg && lg.rest ? 'dissolve' : 'move'; sw.t = 0; if (sw.phase === 'dissolve') { sw.el.classList.remove('sweeping'); sw.el.classList.remove('on'); } if (!raf) raf = root.requestAnimationFrame(tick); };
        var target = lg && lg.item ? sw.targetOf(lg.item) : null;
        if (target && reached({ x: sw.x, y: sw.y }, target)) { sw.phase = 'write'; sweepItem(sw, target, function () { next(); }); return; }
        next(); return;
      }
    }
    else if (sw.phase === 'dissolve') { sw.t += dt * K; if (sw.still || sw.t >= DISSOLVE) { end(); return; } }
    else if (sw.phase === 'write') { return; } /* waiting for the lock: the frame loop resumes when the write answers */
    raf = root.requestAnimationFrame(tick);
  }
  /* ---------- wiring ---------- */
  function mount() {
    ensureLayer();
    layer.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.tidyitem'); if (!b) return; e.stopPropagation();
      if (R.els.scene.classList.contains('arranging')) return; /* arranging the room: a tap on a sock moves nothing and starts nothing */
      if (W.napping && W.napping()) return; /* asleep: the room's own line */
      if (R.refuseBusy && R.refuseBusy()) return; /* the one-activity rule, in the room's words */
      R.chime('tap'); R.openEveryday('tidy');
    });
    R.on('activity', function (kind, id) { end(); if (kind === 'practice' && id === 'tidy') root.setTimeout(function () { if (R.practiceOn() && !sweep) begin(); }, 0); }); /* the practice claims the HUD first; the broom appears right after */
    R.on('practiceStop', end); /* the moment the runner stops, before any save question (Codex design review, 23 Oct) */
    R.on('layout', function () { end(); draw(); });
    R.on('props', function () { draw(); });
    if (S.subscribe) S.subscribe(function (reason) {
      if (reason === 'clear' || reason === 'import') { end(); draw(); return; }
      if (sweep && R.asleep && R.asleep()) { end(); return; } /* she went to bed under the broom */
      if (sweep) { var st = normalise(S.state().tidy), ids = st.items.map(function (it) { return it.id; }), want = sweep.floor.filter(function (id) { return sweep.swept.indexOf(id) < 0; }); if (ids.length !== want.length || want.some(function (id) { return ids.indexOf(id) < 0; })) { end(); draw(); return; } } /* the floor is not what this sweep left it (an account copy arrived, another tab tidied, a thing came back): the picture stops and the floor redraws */
      if (!sweep && (reason === 'external' || String(reason || '').indexOf('sync') === 0)) draw();
    });
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) { last = 0; if (sweep && !raf && sweep.phase !== 'write') raf = root.requestAnimationFrame(tick); else if (!sweep) draw(); } });
    root.addEventListener('pageshow', function () { if (!sweep) draw(); });
    try { draw(); } catch (e) { console.error('tidy', e); } /* after the listeners: a first draw that cannot save still leaves the floor wired */
  }
  root.OvuTidy.draw = draw; root.OvuTidy.begin = begin; root.OvuTidy.end = end; root.OvuTidy.fast = function (on) { fast = typeof on === 'number' && on > 0 ? on : !!on; return fast; };
  root.OvuTidy.sweeping = function () { return sweep ? { phase: sweep.phase, x: sweep.x, y: sweep.y, leg: sweep.li, legs: sweep.legs.length, swept: sweep.swept.slice(), expected: sweep.expected.slice(), still: sweep.still } : null; };
  root.OvuTidy.items = function () { return Object.keys(els).map(function (id) { var el = els[id]; return { id: id, x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: parseFloat(el.style.width), swept: el.classList.contains('swept') }; }); };
  R.on('boot', mount);
})(typeof window !== 'undefined' ? window : this);
