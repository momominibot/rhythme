/* Rhythme walk: a joystick and the keyboard move the avatar like a game inside each plate's
 * floor, sliding along furniture and stepping through doors into the next scene. The maths
 * (zones, solids, doors, depth) is pure so tools/test-core.js can check it without a DOM;
 * the DOM wiring mounts once room.js announces boot through window.OvuRoom.
 * Every position is a percent of the plate, the same unit the room already uses. A wide plate (L.span box widths,
 * docs/design/2026-10-19-wide-street.md) keeps that unit: x runs to 100 * span, and only the planner grid grows.
 * Reviewed by Codex (docs/design/2026-10-18-garden-community-walk.md): bounded substeps, one
 * owner for movement with a takeover check, busy rechecked every frame, rank-based depth. */
(function (root) {
  'use strict';
  var Y_SCALE = 0.5;      /* the floor is foreshortened: a stride up the plate covers fewer percent than one across */
  var SPEED = 26;         /* percent of plate width per second at full tilt */
  var speedScale = 1;     /* stamina slows her when it is low (ovu-stamina.js) */
  var SUBSTEP = 0.02;     /* seconds per collision substep, so a long frame can never jump a wall */
  var FAR = 60;           /* iso units: a mini-map stop whose door is further than this (about 2.5 s of walking) fades straight there */
  var FRAMES = 8, FPS = 10, STRIDE = SPEED / FPS * FRAMES; /* walk cycle: 8 frames, 10 per second at full speed, so one cycle per STRIDE iso units */

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
  function inBox(b, x, y) { if (b.poly) return inPoly(b.poly, x, y); return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; } /* a solid may be a polygon: the farm's bed frame (22 Oct) */
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
    var k = Math.min(1, len), ux = dir.x / len, uy = dir.y / len, sp = (speed || SPEED) * speedScale;
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
  /* a storefront (a door that taps a store) opens only where a walk ends; walking past one along the street goes on by.
   * Arches and gates (doors that lead somewhere) still take her the moment she steps in. */
  function passing(d) { return !!(d && d.tap); }
  /* which strip for a movement direction: mostly vertical goes away or towards, otherwise the side strip, mirrored by flip */
  function dirFor(dx, dy) { var iy = dy / Y_SCALE; if (Math.abs(iy) > Math.abs(dx) * 1.25) return iy < 0 ? 'away' : 'towards'; return 'side'; }
  /* the walk cycle's phase: one full cycle (FRAMES frames) per STRIDE iso units of travel */
  function cycleAdvance(acc, distIso) { return acc + distIso / STRIDE; }
  function frameOf(acc) { return Math.floor(((acc % 1) + 1) % 1 * FRAMES); }
  /* depth: things lower on the plate draw in front. Ranks are packed into z 2..9 so nothing ever rises
   * above the hotspot pins (10) or the HUD (11); ties keep DOM order. items: [{y, x?, w?}]. Up to eight, each has its own
   * rank. More than eight (a busy plaza: the neighbours, their pets, a villager, her), only sprites that overlap across
   * need different levels, so each takes one more than the highest overlapping sprite behind it; a sprite without an x
   * (her) overlaps everything. Only a chain of more than eight overlapping sprites is packed, as before (Codex, 22 Oct:
   * a villager and her tied at z 2 in the plaza's crowd) */
  function overlapsAcross(a, b) { return !isFinite(a.x) || !isFinite(b.x) || Math.abs(a.x - b.x) < ((a.w || 8) + (b.w || 8)) / 2; }
  function depthRank(items) {
    var idx = items.map(function (it, i) { return i; }).sort(function (a, b) { return (items[a].y - items[b].y) || (a - b); });
    var n = idx.length, z = new Array(n);
    if (n <= 8) { idx.forEach(function (i, rank) { z[i] = 2 + rank; }); return z; }
    var lvl = new Array(n), top = 0;
    idx.forEach(function (i, k) { var l = 0; for (var m = 0; m < k; m++) { var j = idx[m]; if (lvl[j] >= l && overlapsAcross(items[i], items[j])) l = lvl[j] + 1; } lvl[i] = l; if (l > top) top = l; });
    idx.forEach(function (i) { z[i] = 2 + (top < 8 ? lvl[i] : Math.floor(lvl[i] * 8 / (top + 1))); });
    return z;
  }
  /* the world the avatar walks in: the layout's zones, its baked solids plus the props standing in it */
  function world(L, props) { return { zones: L.zones || [], solids: (L.solids || []).concat((props || []).map(propBox)), doors: L.doors || [], span: L.span > 1 ? L.span : 1 }; }

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
  /* where to stand when arriving in `L`: the door that leads back to the layout you came from (a store interior), else
   * to its scene (home, garden, street, plaza), else the first door, else the layout's home spot */
  function entryFor(L, from, fromScene) {
    var doors = L.doors || [], pick = function (key) { return key ? doors.filter(function (x) { return x.to === key || x.tap === key; })[0] : null; };
    var d = pick(from) || pick(fromScene) || doors[0];
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

  /* ---------- tap to walk: a coarse walkable grid per plate, A* with string pulling (docs/design/2026-10-19-tap-to-walk.md) ----------
   * Cells are CELL percent of plate width wide and CELL * Y_SCALE percent of plate height tall, so one row step costs the
   * same walking time as one column step. The mask is rasterised from the layout's zones, solids and prop boxes at plan
   * time (about 5,000 cells; 12,500 on the 2.5-wide street), cheap enough to do on every tap and keeps pets and props
   * current. A mask carries its own column count (m.cols), so a wide plate's grid simply has more columns. */
  var CELL = 2, ROWH = CELL * Y_SCALE, COLS = Math.ceil(100 / CELL), ROWS = Math.ceil(100 / ROWH), SQRT2 = Math.SQRT2;
  function colsOf(m) { return m && m.cols || COLS; }
  function cellOf(x, y, m) { return { c: Math.max(0, Math.min(colsOf(m) - 1, Math.floor(x / CELL))), r: Math.max(0, Math.min(ROWS - 1, Math.floor(y / ROWH))) }; }
  function centre(c, r) { return { x: c * CELL + CELL / 2, y: r * ROWH + ROWH / 2 }; }
  function rasterise(world) {
    var cols = Math.ceil(100 * (world.span > 1 ? world.span : 1) / CELL), m = new Uint8Array(cols * ROWS); m.cols = cols; m.rows = ROWS;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < cols; c++) { var p = centre(c, r); m[r * cols + c] = free(world, p.x, p.y, false) ? 1 : 0; }
    return m;
  }
  function cellFree(m, c, r) { var cols = colsOf(m); return c >= 0 && r >= 0 && c < cols && r < ROWS && m[r * cols + c] === 1; }
  /* the nearest free cell within `radius` cells of (c, r), by ring, else null */
  function nearestFree(m, c, r, radius) { var l = nearestFreeList(m, c, r, radius); return l.length ? l[0] : null; }
  /* free cells within `radius` columns (and twice as many rows, since rows are half as tall), nearest first in iso units */
  function nearestFreeList(m, c, r, radius) {
    if (cellFree(m, c, r)) return [{ c: c, r: r }];
    var out = [], rr = radius * 2;
    for (var dr = -rr; dr <= rr; dr++) for (var dc = -radius; dc <= radius; dc++) if ((dr || dc) && cellFree(m, c + dc, r + dr)) { var ix = dc * CELL, iy = dr * ROWH / Y_SCALE; out.push({ c: c + dc, r: r + dr, d: ix * ix + iy * iy }); }
    return out.sort(function (a, b) { return a.d - b.d; });
  }
  /* a straight line between two percent points stays on free cells (sampled every half cell) */
  function lineFree(m, a, b) {
    var dx = b.x - a.x, dy = (b.y - a.y) / Y_SCALE, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (CELL / 4)));
    for (var i = 0; i <= n; i++) { var t = i / n, k = cellOf(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, m); if (!cellFree(m, k.c, k.r)) return false; }
    return true;
  }
  /* a tiny binary heap keyed on f */
  function Heap() { this.a = []; }
  Heap.prototype.push = function (n) { var a = this.a; a.push(n); var i = a.length - 1; while (i > 0) { var p = (i - 1) >> 1; if (a[p].f <= a[i].f) break; var t = a[p]; a[p] = a[i]; a[i] = t; i = p; } };
  Heap.prototype.pop = function () { var a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, s = i; if (l < a.length && a[l].f < a[s].f) s = l; if (r < a.length && a[r].f < a[s].f) s = r; if (s === i) break; var t = a[s]; a[s] = a[i]; a[i] = t; i = s; } } return top; };
  /* 8-neighbour A* with the octile heuristic; diagonals may not cut a blocked corner; the start cell is allowed even if
   * blocked (a tap walk can end inside furniture). Returns the cell path start..goal, or null. */
  function astar(m, s, g) {
    var COLS = colsOf(m), N = COLS * ROWS, gScore = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    var si = s.r * COLS + s.c, gi = g.r * COLS + g.c, heap = new Heap();
    function h(i) { var dc = Math.abs((i % COLS) - g.c), dr = Math.abs(Math.floor(i / COLS) - g.r); return Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr); }
    gScore[si] = 0; heap.push({ i: si, f: h(si) });
    var steps = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2]];
    while (heap.a.length) {
      var cur = heap.pop(), i = cur.i; if (closed[i]) continue; closed[i] = 1;
      if (i === gi) { var out = []; for (var k = gi; k !== -1; k = from[k]) out.push({ c: k % COLS, r: Math.floor(k / COLS) }); return out.reverse(); }
      var c = i % COLS, r = Math.floor(i / COLS);
      for (var n = 0; n < 8; n++) {
        var nc = c + steps[n][0], nr = r + steps[n][1]; if (!cellFree(m, nc, nr)) continue;
        if (steps[n][0] && steps[n][1] && (!cellFree(m, c + steps[n][0], r) || !cellFree(m, c, r + steps[n][1]))) continue; /* no corner cutting */
        var ni = nr * COLS + nc, ng = gScore[i] + steps[n][2];
        if (ng < gScore[ni]) { gScore[ni] = ng; from[ni] = i; heap.push({ i: ni, f: ng + h(ni) }); }
      }
    }
    return null;
  }
  /* greedy string pulling: from each corner, jump to the farthest later point still in line of sight. `first` checks the
   * first leg and `legal` every later one in true geometry: the grid alone lets a shortcut clip a thin notch whose cell
   * centres sit on the floor, and the walk then stops where the line leaves it (Codex, 20 Oct, pet shop landing) */
  function pull(m, pts, first, legal) {
    if (pts.length < 3) return pts.slice();
    var out = [pts[0]], i = 0;
    while (i < pts.length - 1) { var j = pts.length - 1; while (j > i + 1 && !(lineFree(m, pts[i], pts[j]) && (i ? !legal || legal(pts[i], pts[j]) : !first || first(pts[0], pts[j])))) j--; out.push(pts[j]); i = j; }
    return out;
  }
  /* a straight segment in true geometry, not the grid: every quarter unit stays on the floor and out of the solids, except
   * the one piece she may be standing in (box) */
  function segClear(world, a, b, box) {
    var n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, (b.y - a.y) / Y_SCALE) / 0.25));
    for (var i = 1; i <= n; i++) { var t = i / n, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; if (!inZones(world.zones, x, y)) return false; var bl = blocked(world.solids, x, y); if (bl && bl !== box) return false; }
    return true;
  }
  /* where a grid route may start: free cells near her whose centres she reaches in a straight line in true geometry,
   * nearest first. A key walk can leave her on the floor in a cell whose centre is off it or inside a pot (Codex, 19 Oct);
   * starting from such a cell either finds no way out or clips the corner it hides */
  function startCells(m, world, from, box) {
    var s = cellOf(from.x, from.y, m), out = [];
    for (var dr = -6; dr <= 6; dr++) for (var dc = -3; dc <= 3; dc++) { var c = s.c + dc, r = s.r + dr; if (!cellFree(m, c, r)) continue; var p = centre(c, r); out.push({ c: c, r: r, d: Math.hypot(p.x - from.x, (p.y - from.y) / Y_SCALE) }); }
    out.sort(function (a, b) { return a.d - b.d; });
    var ok = []; for (var i = 0; i < out.length && ok.length < 4; i++) { var q = centre(out[i].c, out[i].r); if (segClear(world, from, q, box)) ok.push(out[i]); }
    return ok;
  }
  /* Plan a walk from `from` to the tapped `to` (both plate percent). The goal snaps to the nearest free cell within
   * `snap` cells when the tap lands on furniture or a wall. Returns { pts, snapped, cost } with pts starting at `from`,
   * or null when nothing walkable is near the tap or no route exists. cost is in iso units (percent across). */
  function plan(world, from, to, snap) {
    var m = rasterise(world), cols = m.cols, s = cellOf(from.x, from.y, m), g0 = cellOf(to.x, to.y, m), cands = nearestFreeList(m, g0.c, g0.r, snap === undefined ? 4 : snap);
    if (!cands.length) return null;
    /* a blocked start (a hotspot walk can end on furniture): she may cross the piece she stands in, nothing else */
    var box = blocked(world.solids, from.x, from.y);
    if (box) for (var r = 0; r < ROWS; r++) for (var c = 0; c < cols; c++) { var q = centre(c, r); if (inBox(box, q.x, q.y) && inZones(world.zones, q.x, q.y)) m[r * cols + c] = 1; }
    /* the route starts at a cell she can step to in a straight line (the first leg is checked in true geometry); with none,
     * the cell she stands in is forced open as before */
    var starts = startCells(m, world, from, box), forced = !starts.length;
    if (forced) { m[s.r * cols + s.c] = 1; starts = [s]; }
    var first = forced ? null : function (a, b) { return segClear(world, a, b, box); };
    for (var k = 0; k < Math.min(cands.length, 6); k++) {
      var g = cands[k], snapped = g.c !== g0.c || g.r !== g0.r, goal = snapped ? centre(g.c, g.r) : { x: to.x, y: to.y };
      if (g.c === s.c && g.r === s.r) return { pts: [{ x: from.x, y: from.y }, goal], snapped: snapped, cost: Math.hypot(goal.x - from.x, (goal.y - from.y) / Y_SCALE) };
      for (var q = 0; q < starts.length; q++) {
        var cells = astar(m, starts[q], g); if (!cells) continue; /* an unreachable pocket: try the next start, then the next goal */
        var pts = cells.map(function (x) { return centre(x.c, x.r); }); pts[pts.length - 1] = goal;
        if (forced) pts[0] = { x: from.x, y: from.y }; else pts.unshift({ x: from.x, y: from.y });
        var corners = pull(m, pts, first, function (a, b) { return segClear(world, a, b, box); }), cost = 0;
        for (var i = 1; i < corners.length; i++) cost += Math.hypot(corners[i].x - corners[i - 1].x, (corners[i].y - corners[i - 1].y) / Y_SCALE);
        return { pts: corners, snapped: snapped, cost: cost };
      }
    }
    return null;
  }

  var W = { Y_SCALE: Y_SCALE, SPEED: SPEED, FAR: FAR, SUBSTEP: SUBSTEP, CELL: CELL, ROWH: ROWH, COLS: COLS, ROWS: ROWS, rasterise: rasterise, cellOf: cellOf, centre: centre, cellFree: cellFree, nearestFree: nearestFree, nearestFreeList: nearestFreeList, inBox: inBox, lineFree: lineFree, astar: astar, pull: pull, segClear: segClear, startCells: startCells, plan: plan, inPoly: inPoly, inZones: inZones, blocked: blocked, propBox: propBox, step: step, doorAt: doorAt, passing: passing, depthRank: depthRank, world: world, HOMES: HOMES, HOME_ONLY: HOME_ONLY, dressHomes: dressHomes, sceneOf: sceneOf, entryFor: entryFor, checkLayout: checkLayout, SCENES: ['home', 'garden', 'street', 'plaza'], FRAMES: FRAMES, FPS: FPS, STRIDE: STRIDE, cycleAdvance: cycleAdvance, frameOf: frameOf, dirFor: dirFor };
  root.OvuWalk = W;

  /* ---------- DOM wiring (only in the room page) ---------- */
  var R = root.OvuRoom; if (!R || !root.document || !root.document.createElement) return;
  dressHomes(R.LAYOUTS);
  var doc = root.document, reduced = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var scene, inner, avatar, hud, mini, fade, ring, ringTimer = 0;
  var keys = {}, raf = 0, last = 0, active = false, anchor = null, cur = null, dims = null, inDoor = false, travelling = false, flip = false;
  var route = null; /* { pts, i, left } while following a tapped path */
  /* the walk cycle: one strip per outfit and direction (assets/room/dream/avatar-walk-<outfit>-<side|away|towards>.webp,
   * FRAMES frames in a row, made by tools/art/walkcycle.py); frames step at FPS only while she moves. A missing strip
   * falls back to the side strip, then to the room's own step bob, so her outfit never changes to get a walk. */
  var cyc = { box: null, img: null, sheets: {}, key: '', frame: -1, acc: 0, dir: 'side', on: false, cssFrom: null, cssRaf: 0 };
  var EASE = 6, MIN_EASE = 0.35, SNAP = 8, lastTap = { t: 0, x: -99, y: -99 };
  var KEYS = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r' };
  var INTERACTIVE = '.hotspot,.avatar,.prop.owned.pet,.prop.owned.tool,.poop,.nb,.tidy,.camctl,.topbar,.chip,.bubble,.visitbar,.propctl,.minimap,.hud,.sleeper,.meditator,.holo,.phase-chip,.greeting,.hint,button,a,input,textarea,select,label';

  /* a foreground cutout (.plate-occ) is ranked by its base, not its top edge, and is never a solid: its object's solid is
   * already in the layout. A shopkeeper (.keeper) is ranked by its feet and is not a solid either: its block is in the layout; so is a
   * villager (.villager, ovu-villagers.js) */
  function sprites() {
    return Array.prototype.slice.call(doc.querySelectorAll('#ownedProps .prop.owned, #ownedProps .nb, #ownedProps .plot, #ownedProps .keeper, #ownedProps .villager, #plateOcc .plate-occ, #tidyLayer .tidy')).map(function (el) { var occ = el.classList.contains('plate-occ'), x = parseFloat(el.style.left), w = parseFloat(el.style.width) || 8; return { el: el, id: el.dataset.id, x: x, cx: occ ? x + w / 2 : x, y: parseFloat(occ ? el.dataset.base : el.style.top), w: w, solid: !occ && !el.classList.contains('plot') && !el.classList.contains('keeper') && !el.classList.contains('villager') && !el.classList.contains('tidy') && !el.classList.contains('nosolid') }; }).filter(function (p) { return isFinite(p.x) && isFinite(p.y); }); /* cx: a cutout is placed by its left edge, the rest by their centre */
  }
  /* the layout's foreground cutouts (L.occluders; only the wide street has any). They live in #plateOcc, a layer of their own
   * beside #ownedProps with no stacking context, so the one depth sort covers them with her and the pets, while a props
   * render (a sky change, pet care) leaves them alone and their filter keeps transitioning with the plate's. Each is a
   * wrapper holding the image and a copy of the night veil masked to the image's own alpha, sized and offset so its
   * gradient lines up with the veil across the whole street. Rebuilt only when the layout changes */
  /* one image element per cutout file, kept between visits, so the bitmap travel waited to decode is the one drawn. Each
   * carries one readiness promise, made once with its own listeners, so any number of waits on a hung request add nothing.
   * It settles true once loaded and decoded, false on a load error or a decode rejection; a failed element is kept (and
   * simply draws nothing) until the next visit asks for the file again, so no new request starts behind the fade */
  var occImgs = {};
  function occImg(file, retry) {
    var im = occImgs[file]; if (im && !(retry && im.occFailed)) return im;
    im = occImgs[file] = doc.createElement('img'); im.className = 'occ-img'; im.alt = ''; im.draggable = false; im.decoding = 'async'; im.occFailed = false;
    im.occReady = new Promise(function (resolve) {
      function fail() { im.occFailed = true; resolve(false); }
      im.addEventListener('load', function () { if (im.decode) im.decode().then(function () { resolve(true); }, fail); else resolve(true); }, { once: true });
      im.addEventListener('error', fail, { once: true });
    });
    im.src = R.ART + file; return im;
  }
  /* a visit's wait on one cutout: a file that failed last time is asked for again here, and only here */
  function occReady(file) { return occImg(file, true).occReady; }
  /* travel holds the fade until the destination's cutouts are drawn-ready, at most OCC_CAP ms from the start of the fade:
   * a slow or failed sprite never holds the walk longer, and only leaves the plate as it was until it arrives */
  var OCC_CAP = 1500;
  function occWait(T) {
    var list = (T.occluders || []).map(function (o) { return occReady(o.img); }); if (!list.length) return Promise.resolve();
    return Promise.race([Promise.all(list), new Promise(function (r) { root.setTimeout(r, OCC_CAP); })]);
  }
  var occLayer = null, canMask = !!(root.CSS && root.CSS.supports && (root.CSS.supports('mask-image', 'url("a.webp")') || root.CSS.supports('-webkit-mask-image', 'url("a.webp")')));
  function renderOcc() {
    var L = R.layout(); if (!L || !R.els.props) return;
    if (!occLayer) { occLayer = doc.createElement('div'); occLayer.id = 'plateOcc'; occLayer.setAttribute('aria-hidden', 'true'); R.els.props.parentNode.insertBefore(occLayer, R.els.props); }
    if (occLayer.dataset.layout === L.id) return;
    occLayer.dataset.layout = L.id; occLayer.innerHTML = '';
    var S = 100 * (L.span > 1 ? L.span : 1);
    (L.occluders || []).forEach(function (o) {
      var d = doc.createElement('div'), im = occImg(o.img), v = doc.createElement('i'), url = 'url("' + R.ART + o.img + '")';
      d.className = 'plate-occ'; d.dataset.id = o.id; d.dataset.base = o.base;
      d.style.left = o.x + '%'; d.style.top = o.y + '%'; d.style.width = o.w + '%'; d.style.height = o.h + '%';
      v.className = 'occ-veil'; v.style.webkitMaskImage = url; v.style.maskImage = url;
      v.style.backgroundSize = (S / o.w * 100) + '% ' + (100 / o.h * 100) + '%';
      v.style.backgroundPosition = (o.x / (S - o.w) * 100) + '% ' + (o.y / (100 - o.h) * 100) + '%';
      d.appendChild(im); if (canMask) d.appendChild(v); occLayer.appendChild(d); /* unmasked, the veil copy would be a dark box at night: better an unveiled cutout */
    });
  }
  function worldNow() { return world(R.layout(), sprites().filter(function (p) { return p.solid; })); }
  /* z order from the bottom of each sprite; the avatar joins the ranking at its live position */
  /* where her feet are for the depth sort when a caller does not say: the engine's live position while it walks her, her
   * live computed top while the room's own CSS slide moves her (R.pos() already holds the destination then), else where
   * she stands. Every caller without a y (props renders, the pets' frames, travel) goes through here */
  function herY() { if (active && cur) return cur.y; if (cyc.cssRaf && avatar.classList.contains('walking')) return liveY(); return R.pos().y; }
  function sortDepth(avatarY) {
    var list = sprites(), ay = typeof avatarY === 'number' ? avatarY : herY();
    var items = list.map(function (p) { return { y: p.y, x: p.cx, w: p.w }; }).concat([{ y: ay }]);
    var z = depthRank(items);
    list.forEach(function (p, i) { if (p.el.style.zIndex !== String(z[i])) p.el.style.zIndex = z[i]; });
    if (avatar.style.zIndex !== String(z[z.length - 1])) avatar.style.zIndex = z[z.length - 1];
  }
  function keyVec() {
    var kx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), ky = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
    if (!kx && !ky) return null; var n = Math.hypot(kx, ky); return { x: kx / n, y: ky / n };
  }
  function clearInput() { keys = {}; }
  function livePos() { return active && cur ? { x: cur.x, y: cur.y } : R.pos(); }
  /* while she sleeps nothing starts: the room's rule, with its own words (room.js asleep()) */
  function napping() { if (!(R.asleep && R.asleep())) return false; R.toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return true; }
  function shopsOpen() { return !R.shopOpenNow || !!R.shopOpenNow(); }
  function storeOpen(tab) { var ST = root.OvuStreet; return ST && ST.openNow ? ST.openNow(tab) : shopsOpen(); }
  function hoursCard(tab) { var ST = root.OvuStreet; if (ST && ST.hoursCard) ST.hoursCard(tab); else R.toast('The shutters are down. Dream Street opens at 9 in the morning and closes at 10 at night.', 'storefront'); }
  function start() {
    if (active) return true;
    if (travelling) return false;
    if (R.busy()) { clearInput(); route = null; return false; }
    if (avatar.classList.contains('walking')) return false; /* a tap walk of the room's own is under way; let it land */
    active = true; anchor = R.pos(); cur = { x: anchor.x, y: anchor.y }; R.emit('walk', 'start');
    dims = { w: inner.clientWidth, h: inner.clientHeight };
    R.cancelIdle(); R.hideThought();
    avatar.classList.remove('idle', 'landing'); if (!reduced) avatar.classList.add('walking');
    last = 0; raf = root.requestAnimationFrame(frame);
    return true;
  }
  function render() {
    avatar.style.transform = 'translate(-50%,-100%) translate3d(' + ((cur.x - anchor.x) / 100 * dims.w).toFixed(1) + 'px,' + ((cur.y - anchor.y) / 100 * dims.h).toFixed(1) + 'px,0)';
    sortDepth(cur.y);
  }
  /* ---------- the walk cycle ---------- */
  function outfitNow() { var m = /avatar-([a-z0-9-]+?)(?:-blink)?\.webp/.exec(avatar.querySelector('#avatarImg').getAttribute('src') || ''); return m && m[1].indexOf('act-') !== 0 && m[1] !== 'meditate' && m[1] !== 'sleeping' ? m[1] : null; }
  /* the outfits with walk strips drawn (tools/art/walkcycle.py). An outfit missing here, or a missing direction, falls back
     without a request, so a drop without strips yet (the gown, the kebayas, the tudung) does not log a 404 per direction */
  var STRIPS = { base: 'side away towards', cozy: 'side away towards', pajamas: 'side away towards', party: 'side away', sundress: 'side away towards', yoga: 'side away towards', 'gym-tudung': 'side' }; /* the gym's covered-head kit walks on the treadmill (ovu-gym.js) */
  function sheet(outfit, dir) {
    var k = outfit + '-' + dir, e = cyc.sheets[k];
    if (!e && (!STRIPS[outfit] || STRIPS[outfit].indexOf(dir) < 0)) return (cyc.sheets[k] = { ok: false, img: { src: '' } });
    if (!e) { e = cyc.sheets[k] = { ok: null, img: new Image() }; e.img.onload = function () { if (e.img.decode) e.img.decode().then(function () { e.ok = true; }, function () { e.ok = true; }); else e.ok = true; }; e.img.onerror = function () { e.ok = false; }; e.img.src = R.ART + 'avatar-walk-' + k + '.webp'; }
    return e;
  }
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  function preloadCycle() {
    var o = outfitNow(); if (!o) return;
    if (cyc.on && cyc.key && cyc.key.indexOf(o + '-') !== 0) cycleHide(); /* a new outfit mid-walk: the old strip goes at once, and the walk shows the new one when it is ready (Codex verification, 21 Oct) */
    Object.keys(cyc.sheets).forEach(function (k) { if (k.indexOf(o + '-') !== 0) { cyc.sheets[k].img.src = BLANK; delete cyc.sheets[k]; } }); /* only her current outfit stays decoded; a blank data URI, not an empty src, so Safari lets go of the pixels */
    ['side', 'away', 'towards'].forEach(function (d) { sheet(o, d); });
  }
  function cycleShow(dir) {
    var o = outfitNow(); if (!o || reduced) { cycleHide(); return false; }
    var e = sheet(o, dir); if (e.ok === false || (e.ok === null && dir !== 'side')) e = sheet(o, 'side');
    if (e.ok !== true) { cycleHide(); return false; } /* not there (yet): the step bob carries the walk */
    if (!cyc.box) { cyc.box = doc.createElement('div'); cyc.box.className = 'walkcycle'; cyc.box.setAttribute('aria-hidden', 'true'); cyc.img = doc.createElement('img'); cyc.img.alt = ''; cyc.box.appendChild(cyc.img); avatar.appendChild(cyc.box); }
    var key = o + '-' + (e === cyc.sheets[o + '-' + dir] ? dir : 'side');
    if (cyc.key !== key) {
      cyc.key = key; cyc.img.src = e.img.src; var fw = e.img.naturalWidth / FRAMES, fh = e.img.naturalHeight;
      var imgW = parseFloat(avatar.querySelector('#avatarImg').style.width) || 100, standW = fh * (parseFloat(avatar.querySelector('#avatarImg').naturalWidth) / Math.max(1, avatar.querySelector('#avatarImg').naturalHeight)) || fw;
      cyc.box.style.width = (imgW * fw / Math.max(1, standW)).toFixed(2) + '%'; cyc.box.style.aspectRatio = fw + '/' + fh; cyc.frame = -1;
    }
    cyc.dir = dir; avatar.classList.add('cycling'); cyc.on = true; return true;
  }
  function cycleHide() { if (cyc.on) { avatar.classList.remove('cycling'); cyc.on = false; } cyc.acc = 0; }
  /* advance the cycle by distance walked (iso units), never by time, so blocked pushes and the ease-out read on the feet */
  /* a soft footstep every half stride, on the ground she is on (ovu-sound.js) */
  var stepAcc = 0;
  function footstep(distIso) { stepAcc += distIso; if (stepAcc < STRIDE / 2) return; stepAcc = 0; if (root.OvuSound) root.OvuSound.play('step', { surface: root.OvuSound.surfaceFor(R.layout()) }); }
  function cycleStep(distIso) {
    if (distIso > 0) footstep(distIso);
    if (!cyc.on || !(distIso > 0)) return; cyc.acc = cycleAdvance(cyc.acc, distIso);
    var f = frameOf(cyc.acc); if (f !== cyc.frame) { cyc.frame = f; cyc.img.style.transform = 'translate3d(-' + (f * 100 / FRAMES).toFixed(3) + '%,0,0)'; }
  }
  /* the room's own CSS walks (hotspot taps) play the cycle too: beforeWalk notes where she stands, the walking
   * class tells us the leg has started, and R.pos() the next frame says where it goes */
  /* her feet's y while the room's own CSS walk slides her (the transition is on top), so she passes behind a cutout mid-walk */
  function liveY() { var t = parseFloat(root.getComputedStyle(avatar).top), h = inner.clientHeight; return isFinite(t) && h ? t / h * 100 : R.pos().y; }
  function cssCycle() {
    if (active || !avatar.classList.contains('walking')) { cycleHide(); cyc.cssRaf = 0; return; }
    var from = cyc.cssFrom || R.pos(), to = R.pos(), dx = to.x - from.x, dy = to.y - from.y, t0 = performance.now();
    var total = Math.hypot(dx, dy / Y_SCALE), ms = parseFloat(avatar.style.transitionDuration) || Math.min(1100, Math.max(350, Math.hypot(dx, dy) * 22));
    if (dx || dy) { var dir = dirFor(dx, dy); cycleShow(dir); if (dir === 'side') avatar.classList.toggle('flip', dx < 0); }
    var last = t0;
    (function tick(t) { if (active || !avatar.classList.contains('walking')) { cycleHide(); cyc.cssRaf = 0; if (!active) sortDepth(); return; } cycleStep(total * Math.min(0.1, (t - last) / 1000) * 1000 / ms); last = t; sortDepth(liveY()); cyc.cssRaf = root.requestAnimationFrame(tick); })(t0);
  }
  /* stop walking and write the position back through the room, with its slide transition suppressed */
  function commit() {
    if (!active) return;
    var arrived = !route && routeEnded, cb = pendingDone; pendingDone = null; quietDoors = false; routeEnded = false;
    active = false; route = null; root.cancelAnimationFrame(raf); raf = 0; last = 0;
    avatar.style.transition = 'none'; R.placeAvatar({ x: cur.x, y: cur.y }, flip); avatar.style.transform = '';
    void avatar.offsetWidth; avatar.style.transition = '';
    avatar.classList.remove('walking'); avatar.classList.add('idle'); cycleHide();
    sortDepth(cur.y);
    if (cb && arrived) cb(); /* the room's walk reached its stand point: open the sheet, land the shelf tap */
  }
  /* someone else (a hotspot walk, a scene change, waking up) moved the avatar: let go without writing back */
  function yieldWalk() { pendingDone = null; quietDoors = false; active = false; route = null; root.cancelAnimationFrame(raf); raf = 0; last = 0; avatar.style.transform = ''; avatar.classList.remove('walking'); cycleHide(); clearInput(); }
  function face(dx) { if (dx) { flip = dx < 0; avatar.classList.toggle('flip', flip); } }
  /* the room's own walks (a hotspot, the walk home, a shelf): planned around the furniture, the pets and the pond like a
   * floor tap, with her walk cycle; the stairs are floor too, so a shelf upstairs is one route. Returns false to hand the
   * walk back to the room's straight line (busy, travelling, nothing plannable). The callback fires on arrival only. */
  var pendingDone = null, quietDoors = false, routeEnded = false; /* routeEnded: the route reached its last point (not cut short) */
  function routeTo(wp, done) {
    if (travelling || !wp || R.busy()) return false;
    pendingDone = null; if (active) commit();
    var from = R.pos(), res = plan(worldNow(), from, { x: wp.x, y: wp.y }, 2);
    if (!res || res.pts.length < 2) return false;
    if (!start()) return false;
    route = { pts: res.pts.slice(1), i: 0, left: res.cost }; routeEnded = false; quietDoors = true; pendingDone = done || null;
    var d0 = route.pts[0]; face(d0.x - cur.x);
    R.emit('walk', 'room');
    return true;
  }
  /* one frame along the tapped route: constant speed in iso units, easing out over the last EASE units */
  function followRoute(dt) {
    var w = worldNow();
    while (route && dt > 0) {
      var tgt = route.pts[route.i]; if (!tgt) { route = null; break; }
      var dx = tgt.x - cur.x, dy = tgt.y - cur.y, dist = Math.hypot(dx, dy / Y_SCALE);
      if (dist < 0.05) { route.i++; if (route.i >= route.pts.length) { cur.x = tgt.x; cur.y = tgt.y; route = null; routeEnded = true; } continue; }
      var remaining = route.left - 0 + dist, k = route.i === route.pts.length - 1 ? Math.max(MIN_EASE, Math.min(1, dist / EASE)) : 1;
      var adv = Math.min(dist, SPEED * speedScale * k * dt), f = adv / dist;
      var nx = cur.x + dx * f, ny = cur.y + dy * f;
      if (!free(w, nx, ny, true) && !inZones(w.zones, nx, ny)) { route = null; break; } /* never off the floor, even if the mask changed */
      face(dx); cur.x = nx; cur.y = ny; dt -= adv / (SPEED * speedScale * k); /* consume the time at the speed actually walked, or a slow walk loops the frame */
      if (adv >= dist - 1e-6) { route.i++; if (route.i >= route.pts.length) { route = null; routeEnded = true; } }
      var dw = !inDoor && !quietDoors && route ? doorAt(w.doors, cur.x, cur.y) : null;
      if (dw && !passing(dw)) { route = null; break; } /* an arch or a gate on the way: the frame takes her through. A routed hotspot walk (quietDoors) and a storefront she passes never stop her */
    }
    if (!route) return false;
    return true;
  }
  function frame(t) {
    if (!active) return;
    var dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
    var p = R.pos(); if (p.x !== anchor.x || p.y !== anchor.y) { yieldWalk(); return; }
    if (R.busy()) { clearInput(); commit(); return; }
    var v = keyVec(); if (v) route = null; /* keys take over from a tapped route */
    if (!v && !route) { if (!stopAtDoor()) commit(); return; }
    if (dt) {
      var before = { x: cur.x, y: cur.y }, w;
      if (route) { followRoute(dt); w = worldNow(); }
      else { w = worldNow(); var np = step(w, cur, v, dt); if (np.moved) { face(v.x); cur.x = np.x; cur.y = np.y; } }
      if (cur.x !== before.x || cur.y !== before.y) {
        var mdx = cur.x - before.x, mdy = cur.y - before.y, dirNow = dirFor(mdx, mdy);
        if (dirNow !== cyc.dir || !cyc.on) cycleShow(dirNow);
        cycleStep(Math.hypot(mdx, mdy / Y_SCALE));
        render();
        var d = doorAt(w.doors, cur.x, cur.y), going = !!(route || keyVec());
        if (d && !inDoor && !quietDoors && !(passing(d) && going)) { enterDoor(d); return; } /* a routed hotspot walk lets the hotspot's own action speak */
        if (!d) inDoor = false;
      }
      if (!route && !v) { if (!stopAtDoor()) commit(); return; }
    }
    raf = root.requestAnimationFrame(frame);
  }
  function enterDoor(d) { inDoor = true; commit(); clearInput(); if (d.tap) R.tap(R.hotspot(d.tap)); else if (d.to) travel(d.to); }
  /* she stopped walking: on a storefront's doorstep that she walked onto (not one she started on), she goes in */
  function stopAtDoor() { if (inDoor || quietDoors) return false; var d = doorAt(worldNow().doors, cur.x, cur.y); if (!d || !passing(d)) return false; enterDoor(d); return true; }
  /* the ring at the tapped spot: a div inside the plate so it scales with the camera */
  function showRing(x, y, bad) {
    if (!ring) { ring = doc.createElement('div'); ring.className = 'tapring'; ring.setAttribute('aria-hidden', 'true'); inner.appendChild(ring); }
    root.clearTimeout(ringTimer); ring.className = 'tapring'; void ring.offsetWidth;
    ring.style.left = x + '%'; ring.style.top = y + '%'; ring.className = 'tapring on' + (bad ? ' bad' : '');
    ringTimer = root.setTimeout(function () { ring.className = 'tapring'; }, reduced ? 420 : 700);
  }
  /* walk to a tapped plate point: plan around furniture and pets from the live position */
  function tapWalk(x, y) {
    if (napping()) return false; /* a logged sleep stops the game: she says so, and nothing moves until the bed wakes her */
    if (travelling || R.busy()) return false;
    if (avatar.classList.contains('walking') && !active) return false;
    var from = livePos(), res = plan(worldNow(), from, { x: x, y: y }, SNAP);
    if (!res) { showRing(x, y, true); return false; }
    var goal = res.pts[res.pts.length - 1]; showRing(goal.x, goal.y, false);
    if (!start()) return false;
    pendingDone = null; quietDoors = false; /* a floor tap replaces a hotspot walk under way: its action no longer waits at the end */
    route = { pts: res.pts.slice(1), i: 0, left: res.cost }; routeEnded = false; inDoor = !!doorAt(worldNow().doors, cur.x, cur.y); R.emit('walk', 'tap'); /* an accepted walk: the camera follows again */
    return true;
  }
  function isInteractive(t) { return !!(t && t.closest && t.closest(INTERACTIVE)); }
  function onFloorTap(e) {
    if (isInteractive(e.target)) return;
    var r = inner.getBoundingClientRect(); if (!r.width || !r.height) return;
    var x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
    if (e.detail > 1) return; /* the scene's double-tap zoom, not a second walk */
    var now = Date.now(); if (now - lastTap.t < 350 && Math.abs(x - lastTap.x) < 2 && Math.abs(y - lastTap.y) < 2) return; /* the same for Safari, which may not count clicks */
    lastTap = { t: now, x: x, y: y };
    tapWalk(x, y);
  }

  /* ---------- scene changes: a short lavender fade, the next plate decoded first, the avatar at its door ---------- */
  function preload(src) {
    return new Promise(function (resolve) { var im = new Image(), done = false, fin = function () { if (!done) { done = true; resolve(); } }; im.onload = fin; im.onerror = fin; root.setTimeout(fin, 2500); im.src = src; });
  }
  function travel(to, opts) {
    opts = opts || {};
    if (travelling) return false;
    if (napping()) return false;
    if (R.busy()) { R.toast('Finish what you are doing first.', 'info'); return false; }
    var fromL = R.layout(), from = fromL.id, fromScene = sceneOf(fromL), target = to === 'home' ? R.homeId() : to, T = R.LAYOUTS[target];
    if (!T) return false;
    if (T.store && !storeOpen(T.store)) { hoursCard(T.store); return false; } /* each interior keeps its own store's hours */
    if (T.admit && !T.admit()) { if (T.refused) T.refused(); return false; } /* a room with its own rule (Harbour Lane's shops keep their own hours) */
    travelling = true; clearInput(); if (active) commit();
    R.emit('travel', target, T); /* the music fades before the plate swaps (the cave is reached in silence) */
    scene.classList.add('fading'); if (root.OvuSound) root.OvuSound.play('door'); else R.chime('tap');
    var t0 = Date.now();
    Promise.all([preload(R.ART + T.img), occWait(T)]).then(function () { /* the plate, and its cutouts decoded or the cap reached */
      var left = Math.max(0, (reduced ? 80 : 380) - (Date.now() - t0));
      root.setTimeout(function () {
        var refused = !!(T.admit && !T.admit());
        if (napping() || (T.store && !storeOpen(T.store)) || refused) { /* she fell asleep or the store shut during the fade */
          if (T.store && !storeOpen(T.store) && !(R.asleep && R.asleep())) hoursCard(T.store);
          if (refused && !napping() && T.refused) T.refused();
          scene.classList.remove('fading'); travelling = false; return;
        }
        R.applyLayout(target, !!opts.visit);
        var L = R.layout(), e = opts.entry || entryFor(L, from, fromScene);
        avatar.style.transition = 'none'; R.placeAvatar(e, e.flip); flip = !!e.flip; void avatar.offsetWidth; avatar.style.transition = '';
        inDoor = !!doorAt(L.doors, e.x, e.y); sortDepth(e.y);
        if (opts.after) { try { opts.after(L); } catch (err) { console.error(err); } }
        R.emit('scene', sceneOf(L), L);
        root.requestAnimationFrame(function () { scene.classList.remove('fading'); travelling = false; });
      }, left);
    });
    return true;
  }
  /* there are no place shortcuts (Jamie, 20 Oct): she walks through doors, and the map (ovu-map.js) shows the way */
  /* the door of every home leads into the garden */
  R.hotspotHandlers.door = function (id, L) { if (sceneOf(L) !== 'home') return false; travel('garden'); return true; };
  /* bed, wardrobe, mat and the rest are at home: from anywhere else, go home first and tap there */
  R.setFallbackHotspot(function (id) { return HOME_ONLY.indexOf(id) > -1 ? { id: id, label: id, wp: null, away: true } : undefined; });
  HOME_ONLY.forEach(function (id) {
    R.hotspotHandlers[id] = function (hid, L) {
      if (sceneOf(L) === 'home') return false; /* at home (or previewing a house to buy): the room handles it as before */
      if (id === 'window') return false; /* the sky is the same everywhere */
      return travel('home', { after: function () { root.setTimeout(function () { R.tap(R.hotspot(id)); }, 120); } });
    };
  });

  /* ---------- controls: the where-you-are pill, keys for desktop, and floor taps ---------- */
  function buildControls() {
    /* one pill names the place she is in and opens the map; it never moves her */
    mini = doc.createElement('nav'); mini.className = 'minimap'; mini.id = 'minimap'; mini.setAttribute('aria-label', 'Where you are');
    mini.innerHTML = '<button type="button" id="mapBtn" aria-label="Map"><span class="ms">location_on</span><i id="mapHere">Home</i></button>';
    scene.appendChild(mini);
    fade = doc.createElement('div'); fade.className = 'scenefade'; fade.setAttribute('aria-hidden', 'true'); scene.appendChild(fade);
    mini.addEventListener('click', function (e) { if (!e.target.closest('#mapBtn')) return; e.stopPropagation(); if (travelling || R.busy()) return; if (root.OvuMap && root.OvuMap.open) { R.chime('tap'); root.OvuMap.open(); } });
    mini.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    /* a tap on the floor (the scene swallows the click that follows a pan or a pinch, so only real taps arrive) */
    inner.addEventListener('click', onFloorTap);
    doc.addEventListener('keydown', function (e) {
      var k = KEYS[e.key]; if (!k || e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (R.busy()) return;
      e.preventDefault(); if (!keys[k]) { keys[k] = true; route = null; pendingDone = null; quietDoors = false; start(); } /* keys take over: a hotspot walk's action is dropped */
    });
    doc.addEventListener('keyup', function (e) { var k = KEYS[e.key]; if (k) delete keys[k]; });
    root.addEventListener('blur', function () { keys = {}; });
    root.addEventListener('resize', function () { if (active) commit(); });
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) { clearInput(); if (active) commit(); } });
    /* a hotspot tap while walking: land first, then let the room walk her there */
    var hs = doc.getElementById('hotspots'); if (hs) hs.addEventListener('pointerdown', function () { if (active) commit(); }, true);
    /* the HUD (sessions, practices, watering) hides the mini-map while it is on */
    if (root.MutationObserver && hud) new MutationObserver(function () { scene.classList.toggle('hudon', hud.classList.contains('on')); }).observe(hud, { attributes: true, attributeFilter: ['class'] });
  }
  function lightMini(L) {
    if (!mini) return; var s = sceneOf(L);
    mini.classList.remove('hidden');
    var name = root.OvuMap && root.OvuMap.hereName ? root.OvuMap.hereName() : s === 'home' ? 'Home' : String((L && L.name) || '').replace(/^(?:your|the)\s+/i, ''), t = doc.getElementById('mapHere'), b = doc.getElementById('mapBtn');
    if (t) t.textContent = name; if (b) b.setAttribute('aria-label', 'Map. You are ' + (name === 'Home' ? 'at home' : 'in ' + name) + '.');
    scene.classList.toggle('outdoors', s !== 'home'); scene.classList.toggle('visiting', visit);
  }
  /* opt-in overlay: zones, solids, door triggers, stand points and the walkable cells over the plate (OvuWalk.debug(true)) */
  function debug(on) {
    var old = doc.getElementById('walkDebug'); if (old) old.remove(); if (!on) return;
    var L = R.layout(), w = worldNow(), m = rasterise(w), sw = 100 * w.span, s = '<svg id="walkDebug" viewBox="0 0 ' + sw + ' 100" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:' + sw + '%;height:100%;z-index:50;pointer-events:none">';
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < m.cols; c++) if (m[r * m.cols + c]) s += '<rect x="' + (c * CELL) + '" y="' + (r * ROWH) + '" width="' + CELL + '" height="' + ROWH + '" fill="rgba(80,200,120,.16)"/>';
    (w.solids || []).forEach(function (b) { s += b.poly ? '<polygon points="' + b.poly.map(function (p) { return p.join(','); }).join(' ') + '" fill="rgba(220,60,60,.2)" stroke="#c33" stroke-width=".3"/>' : '<rect x="' + b.x0 + '" y="' + b.y0 + '" width="' + (b.x1 - b.x0) + '" height="' + (b.y1 - b.y0) + '" fill="rgba(220,60,60,.2)" stroke="#c33" stroke-width=".3"/>'; });
    (w.doors || []).forEach(function (d) { s += '<ellipse cx="' + d.x + '" cy="' + d.y + '" rx="' + (d.r || 4) + '" ry="' + ((d.r || 4) * Y_SCALE) + '" fill="rgba(60,120,240,.25)" stroke="#36c" stroke-width=".3"/>'; });
    (L.hotspots || []).forEach(function (h) { if (h.wp) s += '<circle cx="' + h.wp.x + '" cy="' + h.wp.y + '" r=".8" fill="#fff" stroke="#639" stroke-width=".3"/>'; });
    if (L.home) s += '<circle cx="' + L.home.x + '" cy="' + L.home.y + '" r="1" fill="#fc0"/>';
    inner.insertAdjacentHTML('beforeend', s + '</svg>');
    return checkLayout(L);
  }
  function mount() {
    scene = R.els.scene; inner = R.els.inner; avatar = R.els.avatar; hud = R.els.hud;
    buildControls(); R.buildHotspots(); lightMini(R.layout()); renderOcc(); sortDepth();
    R.on('layout', function (L) { if (active) yieldWalk(); inDoor = false; lightMini(L); renderOcc(); sortDepth(); });
    R.on('props', function () { sortDepth(); });
    R.on('placed', function () { if (!active && !cyc.cssRaf) sortDepth(); }); /* the room put her somewhere itself (a reduced-motion step, a door, a seat): rank her there */
    R.on('scene', function (s, L) { lightMini(L); }); /* after a travel's own after() ran, e.g. a neighbour visit began */
    R.on('beforeWalk', function () { if (active) commit(); cyc.cssFrom = R.pos(); }); /* a hotspot walk starts from where she really is */
    preloadCycle(); avatar.querySelector('#avatarImg').addEventListener('load', preloadCycle);
    if (root.MutationObserver) new MutationObserver(function () { if (avatar.classList.contains('walking') && !active && !cyc.cssRaf) cyc.cssRaf = root.requestAnimationFrame(function () { cssCycle(); }); }).observe(avatar, { attributes: true, attributeFilter: ['class'] });
    R.setMoving(function () { return active || travelling; }); /* goHome waits while she is walking somewhere of her own choosing */
    if (R.setWalkTo) R.setWalkTo(routeTo); /* the room's own walks route around furniture */
  }
  W.setSpeedScale = function (k) { speedScale = Math.min(1, Math.max(0.4, Number(k) || 1)); }; W.speedScale = function () { return speedScale; };
  W.canWalkTo = function (wp) { return !!(wp && !travelling && plan(worldNow(), livePos(), { x: wp.x, y: wp.y }, 2)); }; /* a route exists from where she is (a villager's side, 22 Oct) */
  W.sortDepth = function () { sortDepth(); }; /* a scene that recreates its sprites after the props event (the barn's animals) ranks them itself */
  W.travel = travel; W.mount = mount; W.walking = function () { return active; }; W.travelling = function () { return !!travelling; }; W.stop = commit; W.debug = debug; W.travelling = function () { return travelling; }; W.tapWalk = tapWalk; W.napping = napping; W.shopsOpen = shopsOpen; W.storeOpen = storeOpen; W.livePos = livePos; W.sortDepth = function () { sortDepth(); }; W.routeTo = routeTo; W.OCC_CAP = OCC_CAP; W.route = function () { return route; }; W.cycle = function () { return { on: cyc.on, dir: cyc.dir, frame: cyc.frame, key: cyc.key, acc: cyc.acc }; };
  R.on('boot', mount);
})(window);
