/* Rhythme walk: a joystick and the keyboard move the avatar like a game inside each plate's
 * floor, sliding along furniture and stepping through doors into the next scene. The maths
 * (zones, solids, doors, depth) is pure so tools/test-core.js can check it without a DOM;
 * the DOM wiring mounts once room.js announces boot through window.OvuRoom.
 * Every position is a percent of the plate, the same unit the room already uses.
 * Reviewed by Codex (docs/design/2026-10-18-garden-community-walk.md): bounded substeps, one
 * owner for movement with a takeover check, busy rechecked every frame, rank-based depth. */
(function (root) {
  'use strict';
  var Y_SCALE = 0.5;      /* the floor is foreshortened: a stride up the plate covers fewer percent than one across */
  var SPEED = 26;         /* percent of plate width per second at full tilt */
  var SUBSTEP = 0.02;     /* seconds per collision substep, so a long frame can never jump a wall */

  /* ---------- geometry ---------- */
  function inPoly(poly, x, y) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function inZones(zones, x, y) { if (!zones || !zones.length) return true; for (var i = 0; i < zones.length; i++) if (inPoly(zones[i], x, y)) return true; return false; }
  function inBox(b, x, y) { return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; }
  function blocked(solids, x, y) { for (var i = 0; i < (solids || []).length; i++) if (inBox(solids[i], x, y)) return solids[i]; return null; }
  /* the box a prop or pet takes up at its feet: narrower than the sprite and shallow in y */
  function propBox(p) { var w = p.w || 8; return { id: p.id, x0: p.x - w * 0.34, x1: p.x + w * 0.34, y0: p.y - w * 0.22, y1: p.y + w * 0.12 }; }
  function free(world, x, y, ignoreSolids) { return inZones(world.zones, x, y) && (ignoreSolids || !blocked(world.solids, x, y)); }
  function tryMove(world, pos, dx, dy, stuck) {
    var tries = [[pos.x + dx, pos.y + dy], [pos.x + dx, pos.y], [pos.x, pos.y + dy]];
    for (var i = 0; i < tries.length; i++) if (free(world, tries[i][0], tries[i][1], stuck)) return { x: tries[i][0], y: tries[i][1] };
    return null;
  }
  /* One frame of walking. The frame is cut into substeps of at most SUBSTEP seconds; each tries the full
   * move, then x alone, then y alone, so the avatar slides along walls. If she already stands inside a
   * solid (a tap walk can end on furniture) solids are ignored, so she can always walk out. */
  function step(world, pos, dir, dt, speed) {
    var len = Math.hypot(dir.x || 0, dir.y || 0), out = { x: pos.x, y: pos.y, moved: false };
    if (!len || !dt) return out;
    var k = Math.min(1, len), ux = dir.x / len, uy = dir.y / len, sp = speed || SPEED;
    var n = Math.max(1, Math.ceil(dt / SUBSTEP)), h = dt / n;
    for (var s = 0; s < n; s++) {
      var stuck = !!blocked(world.solids, out.x, out.y);
      var nx = tryMove(world, out, ux * k * sp * h, uy * k * sp * h * Y_SCALE, stuck);
      if (!nx) break;
      out.x = nx.x; out.y = nx.y; out.moved = true;
    }
    return out;
  }
  /* a door triggers inside an ellipse around its stand point (radius in x percent, squashed in y) */
  function doorAt(doors, x, y) { for (var i = 0; i < (doors || []).length; i++) { var d = doors[i]; if (Math.hypot(x - d.x, (y - d.y) / Y_SCALE) <= (d.r || 4)) return d; } return null; }
  /* depth: things lower on the plate draw in front. Ranks are packed into z 2..9 so nothing ever rises
   * above the hotspot pins (10) or the HUD (11); ties keep DOM order. items: [{y, ...}] */
  function depthRank(items) {
    var idx = items.map(function (it, i) { return i; }).sort(function (a, b) { return (items[a].y - items[b].y) || (a - b); });
    var n = idx.length, z = new Array(n);
    idx.forEach(function (i, rank) { z[i] = 2 + (n <= 8 ? rank : Math.floor(rank * 8 / n)); });
    return z;
  }
  /* the world the avatar walks in: the layout's zones, its baked solids plus the props standing in it */
  function world(L, props) { return { zones: L.zones || [], solids: (L.solids || []).concat((props || []).map(propBox)), doors: L.doors || [] }; }

  /* ---------- floors, furniture and doors of the existing homes (percent of each plate) ---------- */
  var HOMES = {
    room: {
      zones: [[[50, 51], [95, 67.5], [50, 90], [5, 67.5]]],
      solids: [{ id: 'bed', x0: 5, x1: 22, y0: 44, y1: 66 }, { id: 'bed', x0: 22, x1: 39, y0: 44, y1: 70 }, { id: 'desk', x0: 48, x1: 68, y0: 44, y1: 57 }, { id: 'wardrobe', x0: 74, x1: 90, y0: 38, y1: 62 }, { id: 'table', x0: 60, x1: 74, y0: 70, y1: 78 }],
      door: { x: 86, y: 72, label: 'Gate · into the garden', wp: { x: 77, y: 75, flip: false }, r: 5 }
    },
    house: {
      zones: [[[12, 66], [50, 60], [88, 66], [88, 86], [50, 90], [12, 86]], [[14, 50], [50, 43], [86, 48], [86, 55], [50, 58], [14, 56]], [[42, 55], [60, 55], [54, 80], [40, 80]]],
      solids: [{ id: 'sofa', x0: 16, x1: 34, y0: 64, y1: 78 }, { id: 'table', x0: 32, x1: 44, y0: 73, y1: 79 }, { id: 'desk', x0: 59, x1: 76, y0: 62, y1: 78 }, { id: 'bed', x0: 20, x1: 56, y0: 36, y1: 51 }, { id: 'wardrobe', x0: 60, x1: 76, y0: 30, y1: 50 }],
      door: { x: 84, y: 66, label: 'Front door · into the garden', wp: { x: 78, y: 82, flip: false }, r: 5 }
    },
    bathhouse: {
      zones: [[[10, 66], [50, 58], [90, 66], [90, 84], [50, 90], [10, 84]], [[12, 50], [50, 42], [88, 50], [88, 56], [50, 58], [12, 56]], [[36, 55], [50, 55], [50, 78], [36, 78]]],
      solids: [{ id: 'armchair', x0: 14, x1: 31, y0: 64, y1: 78 }, { id: 'table', x0: 33, x1: 41, y0: 73, y1: 78 }, { id: 'desk', x0: 52, x1: 70, y0: 62, y1: 76 }, { id: 'wardrobe', x0: 70, x1: 86, y0: 56, y1: 78 }, { id: 'bed', x0: 16, x1: 50, y0: 36, y1: 49 }, { id: 'tub', x0: 56, x1: 80, y0: 38, y1: 49 }],
      door: { x: 86, y: 80, label: 'Gate · into the garden', wp: { x: 78, y: 82, flip: false }, r: 5 }
    },
    familyhome: {
      zones: [[[8, 62], [50, 54], [92, 62], [92, 84], [50, 90], [8, 84]], [[10, 48], [50, 40], [90, 48], [90, 54], [50, 57], [10, 54]], [[38, 54], [54, 54], [52, 80], [38, 80]]],
      solids: [{ id: 'kitchen', x0: 8, x1: 40, y0: 58, y1: 80 }, { id: 'desk', x0: 54, x1: 70, y0: 60, y1: 72 }, { id: 'sofa', x0: 64, x1: 92, y0: 64, y1: 80 }, { id: 'table', x0: 58, x1: 72, y0: 74, y1: 80 }, { id: 'bed', x0: 12, x1: 50, y0: 36, y1: 50 }, { id: 'wardrobe', x0: 50, x1: 62, y0: 30, y1: 46 }, { id: 'tub', x0: 72, x1: 90, y0: 38, y1: 50 }],
      door: { x: 86, y: 84, label: 'Gate · into the garden', wp: { x: 80, y: 84, flip: false }, r: 5 }
    }
  };
  /* ids that only exist at home; outdoors the room is sent home first, then the tap lands there */
  var HOME_ONLY = ['bed', 'clock', 'calendar', 'computer', 'wardrobe', 'diary', 'mat', 'coach', 'bath', 'fridge', 'sofa', 'window'];
  /* give each home layout its floor, furniture and a door into the garden; idempotent */
  function dressHomes(LAYOUTS) {
    Object.keys(HOMES).forEach(function (id) {
      var L = LAYOUTS[id], H = HOMES[id]; if (!L) return;
      L.zones = H.zones; L.solids = H.solids; L.scene = 'home';
      L.doors = [{ id: 'door', to: 'garden', x: H.door.wp.x, y: H.door.wp.y, r: H.door.r, flip: !!H.door.wp.flip }];
      if (!L.hotspots.some(function (h) { return h.id === 'door'; })) L.hotspots.push({ id: 'door', x: H.door.x, y: H.door.y, label: H.door.label, icon: 'door_open', wp: H.door.wp });
    });
  }
  /* which scene a layout belongs to on the mini-map */
  function sceneOf(L) { return L && L.scene ? L.scene : 'home'; }
  /* where to stand when arriving in `L` from scene `from`: the door that leads back there, else the layout's home spot */
  function entryFor(L, from) {
    var d = (L.doors || []).filter(function (x) { return x.to === from; })[0] || (L.doors || [])[0];
    return d ? { x: d.x, y: d.y, flip: !!d.flip } : (L.home || { x: 50, y: 80, flip: false });
  }
  /* every spot the engine will put the avatar on must be walkable: used by the tests and the debug overlay */
  function checkLayout(L) {
    var w = world(L, []), bad = [];
    function see(name, p) { if (!p) return; if (!inZones(w.zones, p.x, p.y)) bad.push(name + ' outside the floor'); else if (blocked(w.solids, p.x, p.y)) bad.push(name + ' inside ' + blocked(w.solids, p.x, p.y).id); }
    see('home', L.home);
    (L.hotspots || []).forEach(function (h) { see('hotspot ' + h.id, h.wp); });
    (L.doors || []).forEach(function (d) { see('door ' + (d.to || d.tap), d); });
    (L.stairs || []).forEach(function (s, i) { see('stair ' + i, s); });
    return bad;
  }

  var W = { Y_SCALE: Y_SCALE, SPEED: SPEED, SUBSTEP: SUBSTEP, inPoly: inPoly, inZones: inZones, blocked: blocked, propBox: propBox, step: step, doorAt: doorAt, depthRank: depthRank, world: world, HOMES: HOMES, HOME_ONLY: HOME_ONLY, dressHomes: dressHomes, sceneOf: sceneOf, entryFor: entryFor, checkLayout: checkLayout, SCENES: ['home', 'garden', 'street', 'plaza'] };
  root.OvuWalk = W;

  /* ---------- DOM wiring (only in the room page) ---------- */
  var R = root.OvuRoom; if (!R || !root.document || !root.document.createElement) return;
  dressHomes(R.LAYOUTS);
  var doc = root.document, reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var scene, inner, avatar, hud, pad, knob, mini, fade;
  var vec = { x: 0, y: 0 }, keys = {}, padId = null, padC = null, raf = 0, last = 0, active = false, anchor = null, cur = null, dims = null, inDoor = false, travelling = false, flip = false;
  var KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' };

  function sprites() {
    return Array.prototype.slice.call(doc.querySelectorAll('#ownedProps .prop.owned, #ownedProps .nb, #ownedProps .plot')).map(function (el) { return { el: el, id: el.dataset.id, x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: parseFloat(el.style.width) || 8, solid: !el.classList.contains('plot') }; }).filter(function (p) { return isFinite(p.x) && isFinite(p.y); });
  }
  function worldNow() { return world(R.layout(), sprites().filter(function (p) { return p.solid; })); }
  /* z order from the bottom of each sprite; the avatar joins the ranking at its live position */
  function sortDepth(avatarY) {
    var list = sprites(), ay = typeof avatarY === 'number' ? avatarY : R.pos().y;
    var items = list.map(function (p) { return { y: p.y }; }).concat([{ y: ay }]);
    var z = depthRank(items);
    list.forEach(function (p, i) { p.el.style.zIndex = z[i]; });
    avatar.style.zIndex = z[z.length - 1];
  }
  function inputVec() {
    var kx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), ky = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
    if (kx || ky) { var n = Math.hypot(kx, ky); return { x: kx / n, y: ky / n }; }
    return { x: vec.x, y: vec.y };
  }
  function clearInput() { keys = {}; vec.x = 0; vec.y = 0; }
  function start() {
    if (active || travelling) return;
    if (R.busy()) { clearInput(); return; }
    if (avatar.classList.contains('walking')) return; /* a tap walk is under way; let it land */
    active = true; anchor = R.pos(); cur = { x: anchor.x, y: anchor.y };
    dims = { w: inner.clientWidth, h: inner.clientHeight };
    R.cancelIdle(); R.hideThought();
    avatar.classList.remove('idle', 'landing'); if (!reduced) avatar.classList.add('walking');
    last = 0; raf = root.requestAnimationFrame(frame);
  }
  function render() {
    avatar.style.transform = 'translate(-50%,-100%) translate3d(' + ((cur.x - anchor.x) / 100 * dims.w).toFixed(1) + 'px,' + ((cur.y - anchor.y) / 100 * dims.h).toFixed(1) + 'px,0)';
    sortDepth(cur.y);
  }
  /* stop walking and write the position back through the room, with its slide transition suppressed */
  function commit() {
    if (!active) return;
    active = false; root.cancelAnimationFrame(raf); raf = 0; last = 0;
    avatar.style.transition = 'none'; R.placeAvatar({ x: cur.x, y: cur.y }, flip); avatar.style.transform = '';
    void avatar.offsetWidth; avatar.style.transition = '';
    avatar.classList.remove('walking'); avatar.classList.add('idle');
    sortDepth(cur.y);
  }
  /* someone else (a tap walk, a scene change, waking up) moved the avatar: let go without writing back */
  function yieldWalk() { active = false; root.cancelAnimationFrame(raf); raf = 0; last = 0; avatar.style.transform = ''; avatar.classList.remove('walking'); clearInput(); }
  function frame(t) {
    if (!active) return;
    var dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
    var p = R.pos(); if (p.x !== anchor.x || p.y !== anchor.y) { yieldWalk(); return; }
    var v = inputVec();
    if (!v.x && !v.y) { commit(); return; }
    if (R.busy()) { clearInput(); commit(); return; }
    if (dt) {
      var w = worldNow(), np = step(w, cur, v, dt);
      if (np.moved) {
        cur.x = np.x; cur.y = np.y;
        if (v.x) { flip = v.x < 0; avatar.classList.toggle('flip', flip); }
        render();
        var d = doorAt(w.doors, cur.x, cur.y);
        if (d && !inDoor) { inDoor = true; commit(); clearInput(); if (d.to) travel(d.to); else if (d.tap) R.tap(R.hotspot(d.tap)); return; }
        if (!d) inDoor = false;
      }
    }
    raf = root.requestAnimationFrame(frame);
  }

  /* ---------- scene changes: a short lavender fade, the next plate decoded first, the avatar at its door ---------- */
  function preload(src) {
    return new Promise(function (resolve) { var im = new Image(), done = false, fin = function () { if (!done) { done = true; resolve(); } }; im.onload = fin; im.onerror = fin; root.setTimeout(fin, 2500); im.src = src; });
  }
  function travel(to, opts) {
    opts = opts || {};
    if (travelling) return false;
    if (R.busy()) { R.toast('Finish what you are doing first.', 'info'); return false; }
    var from = sceneOf(R.layout()), target = to === 'home' ? R.homeId() : to, T = R.LAYOUTS[target];
    if (!T) return false;
    travelling = true; clearInput(); if (active) commit();
    scene.classList.add('fading'); R.chime('tap');
    var t0 = Date.now();
    preload(R.ART + T.img).then(function () {
      var left = Math.max(0, (reduced ? 80 : 380) - (Date.now() - t0));
      root.setTimeout(function () {
        R.applyLayout(target, !!opts.visit);
        var L = R.layout(), e = opts.entry || entryFor(L, from);
        avatar.style.transition = 'none'; R.placeAvatar(e, e.flip); flip = !!e.flip; void avatar.offsetWidth; avatar.style.transition = '';
        inDoor = !!doorAt(L.doors, e.x, e.y); sortDepth(e.y);
        if (opts.after) { try { opts.after(L); } catch (err) { console.error(err); } }
        R.emit('scene', sceneOf(L), L);
        root.requestAnimationFrame(function () { scene.classList.remove('fading'); travelling = false; });
      }, left);
    });
    return true;
  }
  /* mini-map tap: walk to the door that leads there, then fade; with no direct door, fade straight away */
  function goTo(sceneId) {
    var L = R.layout(); if (travelling || R.busy()) return;
    if (sceneOf(L) === sceneId && !R.visiting()) return;
    if (active) commit();
    var d = (L.doors || []).filter(function (x) { return x.to === sceneId; })[0];
    if (d && !R.visiting()) { R.chime('tap'); R.cancelIdle(); R.walkTo({ x: d.x, y: d.y, flip: !!d.flip }, function () { if (!R.busy()) travel(sceneId); }); }
    else travel(sceneId);
  }
  /* the door of every home leads into the garden */
  R.hotspotHandlers.door = function (id, L) { if (sceneOf(L) !== 'home') return false; travel('garden'); return true; };
  /* bed, wardrobe, mat and the rest are at home: from anywhere else, go home first and tap there */
  R.setFallbackHotspot(function (id) { return HOME_ONLY.indexOf(id) > -1 ? { id: id, label: id, wp: null, away: true } : undefined; });
  HOME_ONLY.forEach(function (id) {
    R.hotspotHandlers[id] = function (hid, L) {
      if (sceneOf(L) === 'home' && !(root.OvuCommunity && root.OvuCommunity.visiting())) return false; /* at home (or previewing a house to buy): the room handles it as before */
      if (id === 'window') return false; /* the sky is the same everywhere */
      return travel('home', { after: function () { root.setTimeout(function () { R.tap(R.hotspot(id)); }, 120); } });
    };
  });

  /* ---------- controls ---------- */
  function buildControls() {
    pad = doc.createElement('div'); pad.className = 'walkpad'; pad.id = 'walkpad'; pad.setAttribute('aria-label', 'Walk: drag to move your avatar, or use the arrow keys'); pad.setAttribute('role', 'application');
    pad.innerHTML = '<div class="walkpad-base"><div class="walkpad-knob" id="walkKnob"></div></div>';
    scene.appendChild(pad); knob = pad.querySelector('.walkpad-knob');
    mini = doc.createElement('nav'); mini.className = 'minimap'; mini.id = 'minimap'; mini.setAttribute('aria-label', 'Where you are');
    mini.innerHTML = [['home', 'home', 'Home'], ['garden', 'yard', 'Garden'], ['street', 'storefront', 'Street'], ['plaza', 'groups', 'Plaza']].map(function (s) { return '<button type="button" data-scene="' + s[0] + '" aria-label="' + s[2] + '"><span class="ms">' + s[1] + '</span><i>' + s[2] + '</i></button>'; }).join('');
    scene.appendChild(mini);
    fade = doc.createElement('div'); fade.className = 'scenefade'; fade.setAttribute('aria-hidden', 'true'); scene.appendChild(fade);
    mini.addEventListener('click', function (e) { var b = e.target.closest('[data-scene]'); if (b) { e.stopPropagation(); goTo(b.dataset.scene); } });
    mini.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

    var R0 = 34, DEAD = 6;
    function setKnob(x, y) { knob.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; }
    function onMove(e) {
      if (e.pointerId !== padId) return;
      var dx = e.clientX - padC.x, dy = e.clientY - padC.y, len = Math.hypot(dx, dy);
      if (len > R0) { dx *= R0 / len; dy *= R0 / len; len = R0; }
      setKnob(dx, dy);
      if (len < DEAD) { vec.x = 0; vec.y = 0; return; }
      var k = (len - DEAD) / (R0 - DEAD); vec.x = dx / len * k; vec.y = dy / len * k;
      start();
    }
    function onUp(e) { if (e.pointerId !== padId) return; padId = null; vec.x = 0; vec.y = 0; setKnob(0, 0); pad.classList.remove('live'); try { pad.releasePointerCapture(e.pointerId); } catch (err) { } }
    /* the pad claims its pointer before the scene's camera can see it (stopPropagation on the bubbling path) */
    pad.addEventListener('pointerdown', function (e) {
      e.stopPropagation(); e.preventDefault();
      if (padId !== null || R.busy() || travelling) return;
      padId = e.pointerId; var r = pad.querySelector('.walkpad-base').getBoundingClientRect(); padC = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      try { pad.setPointerCapture(e.pointerId); } catch (err) { }
      pad.classList.add('live'); onMove(e);
    });
    pad.addEventListener('pointermove', onMove);
    pad.addEventListener('pointerup', onUp); pad.addEventListener('pointercancel', onUp); pad.addEventListener('lostpointercapture', onUp);
    pad.addEventListener('click', function (e) { e.stopPropagation(); });

    doc.addEventListener('keydown', function (e) {
      var k = KEYS[e.key]; if (!k || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (R.busy()) return;
      e.preventDefault(); if (!keys[k]) { keys[k] = true; start(); }
    });
    doc.addEventListener('keyup', function (e) { var k = KEYS[e.key]; if (k) delete keys[k]; });
    root.addEventListener('blur', function () { keys = {}; });
    root.addEventListener('resize', function () { if (active) commit(); });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) { clearInput(); if (active) commit(); } });
    /* a hotspot tap while walking: land first, then let the room walk her there */
    var hs = doc.getElementById('hotspots'); if (hs) hs.addEventListener('pointerdown', function () { if (active) commit(); }, true);
    /* the HUD (sessions, practices, watering) hides the controls while it is on */
    if (root.MutationObserver && hud) new MutationObserver(function () { scene.classList.toggle('hudon', hud.classList.contains('on')); }).observe(hud, { attributes: true, attributeFilter: ['class'] });
  }
  function lightMini(L) {
    if (!mini) return; var s = sceneOf(L), visit = !!R.visiting();
    mini.classList.toggle('hidden', visit && s === 'home' && !!(root.OvuCommunity && root.OvuCommunity.visiting()));
    Array.prototype.slice.call(mini.querySelectorAll('[data-scene]')).forEach(function (b) { b.classList.toggle('on', b.dataset.scene === s); b.setAttribute('aria-current', b.dataset.scene === s ? 'location' : 'false'); });
    scene.classList.toggle('outdoors', s !== 'home');
  }
  /* opt-in overlay: zones, solids, door triggers and stand points over the plate (OvuWalk.debug(true)) */
  function debug(on) {
    var old = doc.getElementById('walkDebug'); if (old) old.remove(); if (!on) return;
    var L = R.layout(), w = worldNow(), s = '<svg id="walkDebug" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;z-index:50;pointer-events:none">';
    (w.zones || []).forEach(function (z) { s += '<polygon points="' + z.map(function (p) { return p.join(','); }).join(' ') + '" fill="rgba(80,200,120,.18)" stroke="#2a8" stroke-width=".4"/>'; });
    (w.solids || []).forEach(function (b) { s += '<rect x="' + b.x0 + '" y="' + b.y0 + '" width="' + (b.x1 - b.x0) + '" height="' + (b.y1 - b.y0) + '" fill="rgba(220,60,60,.2)" stroke="#c33" stroke-width=".3"/>'; });
    (w.doors || []).forEach(function (d) { s += '<ellipse cx="' + d.x + '" cy="' + d.y + '" rx="' + (d.r || 4) + '" ry="' + ((d.r || 4) * Y_SCALE) + '" fill="rgba(60,120,240,.25)" stroke="#36c" stroke-width=".3"/>'; });
    (L.hotspots || []).forEach(function (h) { if (h.wp) s += '<circle cx="' + h.wp.x + '" cy="' + h.wp.y + '" r=".8" fill="#fff" stroke="#639" stroke-width=".3"/>'; });
    if (L.home) s += '<circle cx="' + L.home.x + '" cy="' + L.home.y + '" r="1" fill="#fc0"/>';
    inner.insertAdjacentHTML('beforeend', s + '</svg>');
    return checkLayout(L);
  }
  function mount() {
    scene = R.els.scene; inner = R.els.inner; avatar = R.els.avatar; hud = R.els.hud;
    buildControls(); R.buildHotspots(); lightMini(R.layout()); sortDepth();
    R.on('layout', function (L) { if (active) yieldWalk(); inDoor = false; lightMini(L); sortDepth(); });
    R.on('props', function () { sortDepth(active ? cur.y : undefined); });
    R.on('scene', function (s, L) { lightMini(L); }); /* after a travel's own after() ran, e.g. a neighbour visit began */
  }
  W.travel = travel; W.goTo = goTo; W.mount = mount; W.walking = function () { return active; }; W.stop = commit; W.debug = debug; W.travelling = function () { return travelling; };
  R.on('boot', mount);
})(window);
