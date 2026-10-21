/* Rhythme map: where she is and how the places join (Jamie, 20 Oct: "take away the shortcut ... user can explore the
 * space and figure their way home. We can have a map showing where they are"). There are no place shortcuts: she walks
 * through doors. The map shows the place she is in with her dot and its exits, every place she can walk to, and the way
 * there, starting with the way home. It never moves her.
 * The places are found by walking the doors from home, so a new door-connected place (a zone) appears by itself. */
(function (root) {
  'use strict';
  var doc = root.document;

  /* where each known place sits on the world map (x 0-100, y 0-80); a new place is set beside a neighbour */
  var POS = { home: [10, 34], garden: [34, 34], farm: [34, 58], street: [66, 34], plaza: [88, 58], 'shop-pet': [50, 10], 'shop-furniture': [66, 10], 'shop-homes': [82, 10], greenhouse: [20, 12], barn: [56, 60], barninside: [44, 71], heninside: [66, 71], cave: [86, 70] }; /* the barn below the street, the hidden spring beside it once found */ /* the greenhouse up beside the garden, away from the row of shops */
  var ICON = { barn: 'cottage', barninside: 'cottage', heninside: 'egg', cave: 'auto_awesome', home: 'home', garden: 'yard', farm: 'agriculture', street: 'storefront', plaza: 'groups', 'shop-pet': 'pets', 'shop-furniture': 'chair', 'shop-homes': 'cottage' };
  var H = 80; /* the world map's height in its own units */
  /* a little clay drawing for each known place on the painted map (Jamie, 20 Oct: "a damn cute map"); a new place keeps its icon */
  var ART_FOR = { harbour: 'map-harbour.webp', barn: 'map-barn.webp', cave: 'map-cave.webp', home: 'map-home.webp', garden: 'map-garden.webp', greenhouse: 'map-greenhouse.webp', farm: 'map-farm.webp', street: 'map-street.webp', plaza: 'map-plaza.webp', 'shop-pet': 'map-shop-pet.webp', 'shop-furniture': 'map-shop-furniture.webp', 'shop-homes': 'map-shop-homes.webp' };

  /* ---------- pure parts (tested in tools/test-core.js) ---------- */
  function nodeOf(id, homeId) { return id === 'home' || id === homeId ? 'home' : id; }
  function placeName(L, id) {
    if (id === 'home') return 'Home';
    var n = String((L && L.name) || id);
    if (!(L && L.store)) n = n.replace(/^(?:your|the)\s+/i, ''); /* "Your garden" is the Garden; a shop keeps its own name */
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  function graph(layouts, homeId) {
    var nodes = {}, edges = [], q = ['home'], seen = { home: true };
    var lay = function (n) { return layouts[n === 'home' ? homeId : n]; };
    while (q.length) {
      var n = q.shift(), L = lay(n); if (!L) continue;
      nodes[n] = { id: n, name: placeName(L, n), icon: ICON[n] || L.mapIcon || 'park', img: L.img, store: L.store || null, w: L.w, h: L.h, span: L.span > 1 ? L.span : 1 };
      (L.doors || []).forEach(function (d) {
        var to = nodeOf(d.to, homeId); if (!lay(to) || lay(to).mapHide) return; /* the inside of a building is not a place on the map (Jamie, 21 Oct: "just the overview of the world") */
        var key = d.tap || d.id, hs = (L.hotspots || []).filter(function (x) { return x.id === key; })[0];
        edges.push({ from: n, to: to, door: key, x: d.x, y: d.y, label: hs && hs.label ? hs.label : key });
        if (!seen[to]) { seen[to] = true; q.push(to); }
      });
    }
    return { nodes: nodes, edges: edges };
  }
  /* the fewest doors from one place to another (doors can be one-way: the plaza's gate goes home, home's door does not) */
  function route(g, from, to) {
    if (!g.nodes[from] || !g.nodes[to]) return null;
    if (from === to) return [];
    var prev = {}, q = [from], seen = {}; seen[from] = true;
    while (q.length) {
      var n = q.shift();
      for (var i = 0; i < g.edges.length; i++) {
        var e = g.edges[i]; if (e.from !== n || seen[e.to]) continue;
        seen[e.to] = true; prev[e.to] = e;
        if (e.to === to) { var path = [], c = to; while (c !== from) { path.unshift(prev[c]); c = prev[c].from; } return path; }
        q.push(e.to);
      }
    }
    return null;
  }
  function place(g) {
    var P = {}, ids = Object.keys(g.nodes);
    ids.forEach(function (id) { if (POS[id]) P[id] = POS[id].slice(); });
    var far = function (x, y) { return Object.keys(P).every(function (k) { return Math.hypot(P[k][0] - x, P[k][1] - y) > 13; }); };
    ids.forEach(function (id) {
      if (P[id]) return;
      var nb = g.edges.filter(function (e) { return (e.from === id && P[e.to]) || (e.to === id && P[e.from]); })[0];
      var base = nb ? P[nb.from === id ? nb.to : nb.from] : [50, 40], tries = [[0, -24], [-14, -24], [14, -24], [0, 24], [-14, 24], [14, 24], [-22, 0], [22, 0]];
      for (var i = 0; i < tries.length; i++) {
        var x = Math.max(8, Math.min(92, base[0] + tries[i][0])), y = Math.max(8, Math.min(H - 10, base[1] + tries[i][1]));
        if (far(x, y)) { P[id] = [x, y]; return; }
      }
      P[id] = [Math.max(8, Math.min(92, base[0] + 10)), Math.max(8, Math.min(H - 10, base[1] + 12))];
    });
    return P;
  }
  /* each joined pair once; a line that would pass through another place bends below them */
  function lines(g, P) {
    var done = {}, out = [];
    g.edges.forEach(function (e) {
      var k = [e.from, e.to].sort().join('|'); if (done[k] || !P[e.from] || !P[e.to]) return; done[k] = true;
      var a = P[e.from], b = P[e.to], hit = Object.keys(P).some(function (id) {
        if (id === e.from || id === e.to) return false;
        var p = P[id], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]) < 8;
      });
      out.push(hit ? { a: a, b: b, curve: Math.max(a[1], b[1]) + 22 } : { a: a, b: b });
    });
    return out;
  }
  var AT = { home: 'at home', garden: 'in the garden', farm: 'on the farm', street: 'on Dream Street', plaza: 'in the plaza' };
  function at(g, id) { var n = g.nodes[id]; return AT[id] || (n && n.store ? 'in ' + n.name : 'in the ' + String(n ? n.name : id).toLowerCase()); }
  function stepText(g, e) { return { where: g.nodes[e.from] ? g.nodes[e.from].name : e.from, door: e.label }; }

  /* the wider world (Jamie, 21 Oct: "a map to entice people that there are more to come so the map will be in the middle
   * where can we zoom in, the surrounding will be ???"): the known world sits in the middle third of a canvas three times
   * its size; the ring around it is fog with ??? patches. Three carry a hint of what may come; none names a partner, a
   * product or a promise. Positions are percentages of the wide canvas; the known world is the square from 33.3 to 66.7. */
  var FOG = [
    { id: 'north', x: 50, y: 12, hint: 'A city of tomorrow, some day.' },
    { id: 'east', x: 87, y: 50, hint: 'A kingdom of stories, some day.' },
    { id: 'south', x: 50, y: 88, hint: 'A place for check-ups, some day.' },
    { id: 'nw', x: 15, y: 15, hint: '' }, { id: 'ne', x: 85, y: 15, hint: '' }, { id: 'west', x: 13, y: 50, hint: '' }, { id: 'sw', x: 15, y: 85, hint: '' }, { id: 'se', x: 85, y: 85, hint: '' }
  ];
  var ZOOM = { min: 0.36, max: 1.6, start: 0.5, names: 0.75 }; /* names show from 0.75; at 0.5 the whole known world and the fog around it fit */
  /* the wide canvas is 3 by 3 viewports; keep it covering the viewport, or centred when smaller than it */
  function zoomClamp(s, tx, ty, vw, vh) {
    s = Math.max(ZOOM.min, Math.min(ZOOM.max, s));
    var ww = 3 * vw * s, wh = 3 * vh * s;
    tx = ww <= vw ? (vw - ww) / 2 : Math.max(vw - ww, Math.min(0, tx));
    ty = wh <= vh ? (vh - wh) / 2 : Math.max(vh - wh, Math.min(0, ty));
    return { s: s, tx: tx, ty: ty };
  }
  function fogText(f) { return f.hint ? '<b>???</b> ' + f.hint + ' Nothing to do here yet; the known places are in the middle.' : '<b>???</b> Still unexplored. Something may be built here one day.'; }

  var M = { POS: POS, FOG: FOG, ZOOM: ZOOM, zoomClamp: zoomClamp, fogText: fogText, at: at, nodeOf: nodeOf, placeName: placeName, graph: graph, route: route, place: place, lines: lines, stepText: stepText };
  root.OvuMap = M;

  /* ---------- the sheet ---------- */
  var R = root.OvuRoom; if (!R || !doc) return;
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function storeShut(n) { var ST = root.OvuStreet; return !!(n && n.store && ST && ST.openNow && !ST.openNow(n.store)); }
  function hereNow(g) { var L = R.layout(); if (R.visiting()) return null; var h = nodeOf(L.id, R.homeId()); if (!g.nodes[h] && L.mapParent && g.nodes[L.mapParent]) h = L.mapParent; /* inside the barn she is at the barn */ return g.nodes[h] ? h : null; }
  M.hereName = function () {
    var L = R.layout(); if (!L) return '';
    if (R.visiting()) return 'Visiting';
    var h = nodeOf(L.id, R.homeId()); return placeName(L, h);
  };
  function routeHTML(g, here, to) {
    var n = g.nodes[to]; if (!n) return '';
    if (to === here) return '<b>You are here, ' + esc(at(g, to)) + '.</b> Tap another place to see the way there.';
    var r = route(g, here, to);
    if (!r) return '<b>' + esc(n.name) + '</b> No path from here yet.';
    return '<b>' + (to === 'home' ? 'The way home' : 'The way to ' + esc(n.name)) + '</b>' + (storeShut(n) ? '<small>It is closed right now; the hours are on its door.</small>' : '') +
      '<ol>' + r.map(function (e) { var s = stepText(g, e); return '<li><span>' + esc(s.where) + '</span>' + esc(s.door) + '</li>'; }).join('') + '</ol>';
  }
  function open() {
    var L = R.layout(), g = graph(R.LAYOUTS, R.homeId()), here = hereNow(g), P = place(g), p = R.pos();
    var span = L.span > 1 ? L.span : 1, aspect = (L.w && L.h ? L.w / L.h : 0.8) * span;
    var exits = here ? g.edges.filter(function (e) { return e.from === here; }) : [];
    var plate = '<div class="mapplate" style="aspect-ratio:' + aspect.toFixed(4) + '"><img src="' + esc(R.ART + L.img) + '" alt="">' +
      exits.map(function (e) { return '<span class="mapexit" style="left:' + (e.x / span).toFixed(1) + '%;top:' + e.y.toFixed(1) + '%"><span class="ms">' + esc(g.nodes[e.to] ? g.nodes[e.to].icon : 'door_open') + '</span>' + esc(g.nodes[e.to] ? g.nodes[e.to].name : e.to) + '</span>'; }).join('') +
      '<i class="mapme" style="left:' + (p.x / span).toFixed(1) + '%;top:' + p.y.toFixed(1) + '%" aria-hidden="true"></i></div>';
    var svg = '<svg class="worldlines" viewBox="0 0 100 ' + H + '" preserveAspectRatio="none" aria-hidden="true">' + lines(g, P).map(function (l) {
      return l.curve ? '<path d="M' + l.a[0] + ',' + l.a[1] + ' C' + l.a[0] + ',' + l.curve + ' ' + l.b[0] + ',' + l.curve + ' ' + l.b[0] + ',' + l.b[1] + '"/>' : '<path d="M' + l.a[0] + ',' + l.a[1] + ' L' + l.b[0] + ',' + l.b[1] + '"/>';
    }).join('') + '</svg>';
    var nodes = Object.keys(g.nodes).map(function (id) {
      var n = g.nodes[id], q = P[id];
      return '<button type="button" class="mapnode' + (id === here ? ' here' : '') + (storeShut(n) ? ' shut' : '') + '" data-node="' + esc(id) + '" style="left:' + q[0] + '%;top:' + (q[1] / H * 100).toFixed(2) + '%" aria-label="' + esc(n.name) + (id === here ? ', you are here' : ', show the way there') + '">' +
        (ART_FOR[id] ? '<img class="mapart" src="' + esc(R.ART + ART_FOR[id]) + '" alt="">' : '<span class="ms">' + esc(n.icon) + '</span>') + '<b>' + esc(n.name) + '</b>' + (id === here ? '<em>You are here</em>' : '') + '</button>';
    }).join('');
    var first = here === 'home' || !here ? here : 'home';
    var head = here ? 'You are ' + at(g, here) : 'You are visiting a neighbour';
    R.openSheet('map', 'Map', 'Where you are, and the way around', 'map',
      '<div class="mapnow"><span class="ms">location_on</span><div><b>' + esc(head) + '</b><small>' + (here ? 'The pins show the ways out. Walk to one and through it.' : 'Tap Back when you are ready to return to the plaza.') + '</small></div></div>' +
      plate + '<div class="worldzoom far" id="worldZoom" style="aspect-ratio:100/' + H + '"><div class="worldwide" id="worldWide">' +
        FOG.map(function (f) { return '<button type="button" class="fog" data-fog="' + f.id + '" style="left:' + f.x + '%;top:' + f.y + '%" aria-label="Unknown place, not built yet">???</button>'; }).join('') +
        '<div class="worldmap known">' + svg + nodes + '</div></div></div>' +
      '<div class="zoomctl"><button type="button" id="mapZoomOut" aria-label="Zoom out"><span class="ms" aria-hidden="true">remove</span></button><button type="button" id="mapZoomIn" aria-label="Zoom in"><span class="ms" aria-hidden="true">add</span></button><span class="zoomnote">The known world is in the middle. Pinch or drag to look around; the ??? places are not built yet.</span></div>' +
      '<div class="maproute" id="mapRoute" aria-live="polite">' + (here ? routeHTML(g, here, first) : '') + '</div>' +
      '<p class="help">The map shows the way; it does not move you. Doors and paths are labelled in each place.</p>');
    wireZoom();
    var b = doc.getElementById('sheetBody');
    if (b) b.addEventListener('click', function (e) {
      var fg = e.target.closest('[data-fog]');
      if (fg) { var f = FOG.filter(function (x) { return x.id === fg.dataset.fog; })[0], out0 = doc.getElementById('mapRoute'); if (out0 && f) out0.innerHTML = fogText(f); if (R.chime) R.chime('tap'); return; }
      var n = e.target.closest('[data-node]'); if (!n || !here) return;
      Array.prototype.slice.call(b.querySelectorAll('.mapnode')).forEach(function (x) { x.classList.toggle('picked', x === n); });
      var out = doc.getElementById('mapRoute'); if (out) out.innerHTML = routeHTML(g, here, n.dataset.node);
      if (R.chime) R.chime('tap');
    });
  }
  M.open = open;
  /* zoom and pan on the wide canvas: buttons, a drag, or two fingers; names appear once zoomed in */
  var zoom = null;
  function wireZoom() {
    var vp = doc.getElementById('worldZoom'), wide = doc.getElementById('worldWide'); if (!vp || !wide) return;
    var vw = vp.clientWidth || 300, vh = vp.clientHeight || 240, st = zoomClamp(ZOOM.start, 0, 0, vw, vh), ptrs = {}, pinch = null;
    zoom = st;
    function paint() { wide.style.transform = 'translate(' + zoom.tx.toFixed(1) + 'px,' + zoom.ty.toFixed(1) + 'px) scale(' + zoom.s.toFixed(3) + ')'; vp.classList.toggle('far', zoom.s < ZOOM.names); }
    function zoomTo(s, cx, cy) { /* keep the point under (cx, cy) in place */
      var k = Math.max(ZOOM.min, Math.min(ZOOM.max, s)) / zoom.s, tx = cx - (cx - zoom.tx) * k, ty = cy - (cy - zoom.ty) * k;
      zoom = zoomClamp(zoom.s * k, tx, ty, vp.clientWidth || vw, vp.clientHeight || vh); paint();
    }
    paint();
    var zi = doc.getElementById('mapZoomIn'), zo = doc.getElementById('mapZoomOut');
    if (zi) zi.addEventListener('click', function () { zoomTo(zoom.s * 1.4, (vp.clientWidth || vw) / 2, (vp.clientHeight || vh) / 2); if (R.chime) R.chime('tap'); });
    if (zo) zo.addEventListener('click', function () { zoomTo(zoom.s / 1.4, (vp.clientWidth || vw) / 2, (vp.clientHeight || vh) / 2); if (R.chime) R.chime('tap'); });
    vp.addEventListener('pointerdown', function (e) { ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, moved: false }; try { vp.setPointerCapture(e.pointerId); } catch (x) { } var ids = Object.keys(ptrs); if (ids.length === 2) { var a = ptrs[ids[0]], c = ptrs[ids[1]]; pinch = { d: Math.hypot(a.x - c.x, a.y - c.y), s: zoom.s }; } });
    vp.addEventListener('pointermove', function (e) {
      var p = ptrs[e.pointerId]; if (!p) return; var ids = Object.keys(ptrs), r = vp.getBoundingClientRect();
      if (ids.length >= 2 && pinch) {
        var a = ptrs[ids[0]], c = ptrs[ids[1]]; if (e.pointerId === Number(ids[0])) a = { x: e.clientX, y: e.clientY }; else c = { x: e.clientX, y: e.clientY };
        var d = Math.hypot(a.x - c.x, a.y - c.y); if (d > 0) zoomTo(pinch.s * d / pinch.d, (a.x + c.x) / 2 - r.left, (a.y + c.y) / 2 - r.top);
      } else if (ids.length === 1) {
        var dx = e.clientX - p.x, dy = e.clientY - p.y; if (Math.abs(dx) + Math.abs(dy) > 3) p.moved = true;
        zoom = zoomClamp(zoom.s, zoom.tx + dx, zoom.ty + dy, vp.clientWidth || vw, vp.clientHeight || vh); paint();
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    function up(e) { var p = ptrs[e.pointerId]; delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch = null; if (p && p.moved) { var stop = function (ev) { ev.stopPropagation(); ev.preventDefault(); vp.removeEventListener('click', stop, true); }; vp.addEventListener('click', stop, true); root.setTimeout(function () { vp.removeEventListener('click', stop, true); }, 0); } }
    vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
  }
  M.zoomState = function () { return zoom ? { s: zoom.s, tx: zoom.tx, ty: zoom.ty } : null; };
  /* the pill was drawn before this file loaded: name the place now, and on every move after (ovu-walk.js) */
  function name() { var t = doc.getElementById('mapHere'), b = doc.getElementById('mapBtn'), n = M.hereName(); if (t && n) t.textContent = n; if (b && n) b.setAttribute('aria-label', 'Map. You are ' + (n === 'Home' ? 'at home' : 'in ' + n) + '.'); }
  if (R.layout && R.layout()) name();
  if (R.on) R.on('boot', name);
})(window);
