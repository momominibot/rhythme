/* Rhythme barn and the hidden spring (Jamie, 20 Oct 2026: "where is my farm house for cow and chicken where I get milk and
 * eggs.. I want a secret space - a cave with hot spring where I can cook my egg", and "mystical with universe pitch black
 * full of stars and crystals ... on the map it's secret"). Design: docs/design/2026-10-20-barn-and-hot-spring.md.
 * Clover the cow and the hens Mochi and Kaya live at the barn from the start. They have no needs: no hunger, no affection
 * to lose, nothing lost while she is away, and nothing here ever reminds her. A hen has one egg on a day after her last
 * collection, Clover has one pail of milk the same way; nothing spoils or stacks. Behind the barn a crack of starlight
 * leads to a cave like the night sky with a warm spring, where eggs become pretend onsen eggs. The spring never changes
 * energy, hearts or the diary. What she collects is play inventory kept in the farm on this device (the pantry).
 * Pure rules first (testable in node), then the two scenes. */
(function (root) {
  'use strict';
  var HENS = ['mochi', 'kaya'], NAMES = { mochi: 'Mochi', kaya: 'Kaya', clover: 'Clover' }, BATCH = 4;
  function FM() { return root.OvuFarm; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function farm(S) { return copy(FM().farmState(S)); }
  function cap() { return FM().PANTRY_CAP; }
  function save(S, f, ST, action) {
    if (ST && ST.spendWith) {
      if (!ST.COSTS || ST.COSTS[action] == null) return { ok: false, why: 'unknown action' }; /* an unregistered action would cost nothing */
      if (!ST.spendWith(action, { farm: f })) return { ok: false, why: 'Too tired for that. A rest first.' };
      return { ok: true, charged: true };
    }
    if (S.commit) S.commit({ farm: f }); else S.setState({ farm: f });
    return { ok: true, charged: false };
  }
  function attempt(fn) { try { return fn(); } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; } }
  /* a hen has an egg on any day after the day it was last collected (a clock set back gives nothing twice) */
  function hasEgg(f, hen, day) { var last = f.animals[hen]; return !last || day > last; }
  function eggsReady(S, day) { var f = FM().farmState(S); return HENS.filter(function (h) { return hasEgg(f, h, day); }); }
  function milkReady(S, day) { var f = FM().farmState(S); return hasEgg(f, 'clover', day); }
  function collectEggs(S, day, ST) {
    var f = farm(S), hens = HENS.filter(function (h) { return hasEgg(f, h, day); });
    if (!hens.length) return { ok: false, why: 'The nests are resting today.' };
    var room = cap() - f.pantry.egg; if (room < 1) return { ok: false, why: 'The pantry has all the eggs it can hold.' };
    hens = hens.slice(0, room);
    hens.forEach(function (h) { f.animals[h] = day; }); f.pantry.egg += hens.length;
    return attempt(function () { var sv = save(S, f, ST, 'egg'); if (!sv.ok) return sv; return { ok: true, n: hens.length, hens: hens, charged: sv.charged }; });
  }
  function milk(S, day, ST) {
    var f = farm(S); if (!hasEgg(f, 'clover', day)) return { ok: false, why: 'Clover is resting today.' };
    if (f.pantry.milk >= cap()) return { ok: false, why: 'The pantry has all the milk it can hold.' };
    f.animals.clover = day; f.pantry.milk += 1;
    return attempt(function () { var sv = save(S, f, ST, 'milk'); if (!sv.ok) return sv; return { ok: true, n: 1, charged: sv.charged }; });
  }
  /* pretend onsen eggs: up to four eggs in one save, eggs out and onsen eggs in; no energy */
  function cookable(f) { return Math.min(BATCH, f.pantry.egg, cap() - f.pantry.onsenegg); }
  function cookEggs(S, want) {
    var f = farm(S), n = cookable(f); if (want != null) { if (want < 1 || want > n) return { ok: false, why: 'The pantry changed in the meantime. Have another look.' }; n = want; }
    if (f.pantry.egg < 1) return { ok: false, why: 'Bring an egg from the hen house first.' };
    if (n < 1) return { ok: false, why: 'The pantry has all the onsen eggs it can hold.' };
    f.pantry.egg -= n; f.pantry.onsenegg += n;
    return attempt(function () { save(S, f, null); return { ok: true, n: n }; });
  }
  function caveFound(S) { return !!FM().farmState(S).found.cave; }
  function findCave(S, day) {
    var f = farm(S); if (f.found.cave) return { ok: true, first: false };
    f.found.cave = day;
    return attempt(function () { save(S, f, null); return { ok: true, first: true }; });
  }
  /* rendered 21 Oct 2026, the second plate after Jamie's "build bigger" (Seedream 5.0 pro, seed 21, 1024x1280, the
   * scene's own 4:5): positions read off a 5% grid */
  var BARN = {
    id: 'barn', scene: 'barn', name: 'The barn', img: 'barn-v2.webp', w: 1024, h: 1280, avatarW: 12, only: [], mapIcon: 'cottage',
    hotspots: [
      { id: 'barnexit', x: 47, y: 80, label: 'Path · back to the farm', prompt: 'Tap to go back to the farm', icon: 'agriculture', wp: { x: 47, y: 74, flip: false } },
      { id: 'barndoor', x: 29, y: 47, label: 'Barn · Clover\u2019s stall', prompt: 'Tap to go into the barn', icon: 'cottage', wp: { x: 33, y: 64, flip: true } },
      { id: 'hendoor', x: 80, y: 45, label: 'Hen house · Mochi and Kaya', prompt: 'Tap to go into the hen house', icon: 'egg', wp: { x: 70, y: 67, flip: false } },
      { id: 'crack', x: 53, y: 28, label: 'A crack of starlight', prompt: 'Tap to look closer', icon: 'auto_awesome', wp: { x: 55, y: 56, flip: false } }
    ],
    home: { x: 47, y: 74, flip: false },
    zones: [[[4, 62], [16, 61], [40, 58], [47, 53], [66, 52], [94, 58], [97, 64], [90, 71], [76, 76], [60, 78], [45, 78], [28, 75], [13, 70], [4, 66]]],
    solids: [{ id: 'barn', x0: 4, x1: 50, y0: 25, y1: 60.5 }, { id: 'henhouse', x0: 63, x1: 95, y0: 35, y1: 62.5 }, { id: 'fence', x0: 46, x1: 66, y0: 42, y1: 52 }, { id: 'stones', x0: 82, x1: 92, y0: 61, y1: 66 }],
    doors: [{ id: 'barnexit', to: 'farm', x: 47, y: 74, r: 4, flip: false }, { id: 'barndoor', to: 'barninside', tap: 'barndoor', x: 33, y: 64, r: 3, flip: true }, { id: 'hendoor', to: 'heninside', tap: 'hendoor', x: 70, y: 67, r: 3, flip: false }],
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 }, props: {}
  };
  /* the crack becomes a door only once she has found it, so the map and the walk know nothing of the cave before then */
  var CRACK_DOOR = { id: 'crack', to: 'cave', tap: 'crack', x: 55, y: 56, r: 3, flip: false };
  var CAVE = {
    id: 'cave', scene: 'cave', name: 'The hidden spring', img: 'cave-v1.webp', w: 1024, h: 1280, avatarW: 11, only: [], mapIcon: 'auto_awesome', starlit: true,
    hotspots: [
      { id: 'caveexit', x: 47, y: 80, label: 'Way out · back to the barn', prompt: 'Tap to go back to the barn', icon: 'door_open', wp: { x: 48, y: 73, flip: false } },
      { id: 'springbasket', x: 42, y: 42, label: 'The spring basket', prompt: 'Tap to use the basket', icon: 'egg', wp: { x: 33, y: 62, flip: true } },
      { id: 'warmstone', x: 66, y: 57, label: 'A warm stone', prompt: 'Tap to sit by the water', icon: 'chair', wp: { x: 55, y: 66, flip: true } }
    ],
    home: { x: 48, y: 73, flip: false },
    zones: [[[10, 60], [18, 52], [28, 47], [70, 46], [88, 53], [92, 61], [84, 69], [66, 74], [50, 77], [34, 75], [18, 70], [9, 65]]],
    solids: [{ id: 'pool', x0: 29, x1: 67, y0: 42, y1: 59 }, { id: 'crystals', x0: 14, x1: 34, y0: 30, y1: 49 }, { id: 'pillar', x0: 69, x1: 92, y0: 25, y1: 58 }, { id: 'plant', x0: 10, x1: 21, y0: 42, y1: 57 }, { id: 'stone', x0: 58, x1: 74, y0: 56, y1: 64 }],
    doors: [{ id: 'caveexit', to: 'barn', x: 48, y: 73, r: 4, flip: false }],
    seat: { x: 66, seatY: 59, groundY: 63.5, face: 'left' },
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 }, props: {}
  };
  /* inside the barn and the hen house (Jamie, 21 Oct: "we can enter barn and chicken house"), rendered 21 Oct 2026 */
  var BARN_IN = {
    id: 'barninside', scene: 'barninside', name: 'Inside the barn', img: 'barn-inside-v1.webp', w: 1024, h: 1280, avatarW: 14, only: [], mapIcon: 'cottage', indoor: true,
    hotspots: [
      { id: 'barninexit', x: 88, y: 66, label: 'Door · back to the yard', prompt: 'Tap to go back outside', icon: 'door_open', wp: { x: 85, y: 76, flip: false } },
      { id: 'clover', x: 33, y: 52, label: 'Clover · the cow', prompt: 'Tap to visit Clover', icon: 'pets', wp: { x: 46, y: 75, flip: true } }
    ],
    home: { x: 85, y: 76, flip: true },
    zones: [[[22, 76], [50, 67], [57, 63], [69, 67], [86, 73], [93, 77], [60, 85], [27, 88]]],
    solids: [{ id: 'stall', x0: 15, x1: 51, y0: 45, y1: 71 }, { id: 'stool', x0: 59, x1: 67, y0: 55, y1: 63 }, { id: 'door', x0: 70, x1: 80, y0: 45, y1: 70 }, { id: 'clover', x0: 24, x1: 42, y0: 66, y1: 71 }],
    doors: [{ id: 'barninexit', to: 'barn', x: 85, y: 76, r: 4, flip: true }],
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 }, props: {}
  };
  var HEN_IN = {
    id: 'heninside', scene: 'heninside', name: 'The hen house', img: 'hen-inside-v1.webp', w: 1024, h: 1280, avatarW: 15, only: [], mapIcon: 'egg', indoor: true,
    hotspots: [
      { id: 'heninexit', x: 40, y: 86, label: 'Door · back to the yard', prompt: 'Tap to go back outside', icon: 'door_open', wp: { x: 41, y: 80, flip: false } },
      { id: 'nests', x: 48, y: 39, label: 'The nests', prompt: 'Tap to look in the nests', icon: 'egg', wp: { x: 52, y: 68, flip: false } }
    ],
    home: { x: 41, y: 80, flip: false },
    zones: [[[30, 72], [45, 64], [60, 63], [78, 66], [80, 72], [62, 82], [42, 86], [32, 80]]],
    solids: [{ id: 'shelf', x0: 40, x1: 76, y0: 38, y1: 64.5 }, { id: 'bowl', x0: 55, x1: 61, y0: 72, y1: 76 }, { id: 'tray', x0: 68, x1: 77, y0: 69, y1: 74 }, { id: 'mochi', x0: 43, x1: 51, y0: 74, y1: 77 }, { id: 'kaya', x0: 66, x1: 74, y0: 68.5, y1: 71 }],
    doors: [{ id: 'heninexit', to: 'barn', x: 41, y: 80, r: 4, flip: false }],
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 }, props: {}
  };
  var B = { LAYOUT: BARN, CAVE: CAVE, BARN_IN: BARN_IN, HEN_IN: HEN_IN, CRACK_DOOR: CRACK_DOOR, HENS: HENS, NAMES: NAMES, BATCH: BATCH, eggsReady: eggsReady, milkReady: milkReady, collectEggs: collectEggs, milk: milk, cookEggs: cookEggs, cookable: cookable, caveFound: caveFound, findCave: findCave };
  root.OvuBarn = B;

  /* ---------- the scenes ---------- */
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, ST = root.OvuStamina, GT = root.OvuGameTime, Z = root.OvuZones, CARE = root.OvuCare, doc = root.document;
  if (!R || !S || !doc || !Z || !FM()) return;
  var ART = R.ART;
  function today() { return GT ? GT.dayKey() : S.today(); }
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function at(id) { var L = R.layout(); return !!L && L.id === id; }
  function idle() { return !((W.napping && W.napping()) || (CARE && CARE.live && CARE.live())); }

  function syncCrack() { var has = BARN.doors.some(function (d) { return d.id === 'crack'; }); if (caveFound(S) && !has) BARN.doors.push(CRACK_DOOR); if (!caveFound(S) && has) BARN.doors = BARN.doors.filter(function (d) { return d.id !== 'crack'; }); }
  syncCrack();
  Z.register(BARN, { label: 'Barn', icon: 'cottage', after: 'farm' });
  Z.register(BARN_IN, { label: 'Inside the barn', icon: 'cottage', after: 'barn' });
  Z.register(HEN_IN, { label: 'Hen house', icon: 'egg', after: 'barn' });
  Z.register(CAVE, { label: 'Hidden spring', icon: 'auto_awesome', after: 'barn' });

  /* ---------- the animals on the plate ---------- */
  var ANIMALS = [
    { id: 'clover', scene: 'barninside', img: 'animal-cow.webp', x: 33, y: 70, w: 21, flip: false, label: 'Clover the cow' },
    { id: 'mochi', scene: 'heninside', img: 'animal-hen.webp', x: 47, y: 76, w: 12, flip: false, label: 'Mochi the hen' },
    { id: 'kaya', scene: 'heninside', img: 'animal-hen-kaya.webp', x: 70, y: 70, w: 12, flip: true, label: 'Kaya the hen' }
  ];
  /* an egg sits in each nest box that has one */
  var NESTS = { mochi: { x: 52, y: 41 }, kaya: { x: 66, y: 45 } };
  function eggSVG() { return '<svg viewBox="0 0 20 24" aria-hidden="true"><ellipse cx="10" cy="13" rx="7.5" ry="9.5" fill="#fff8ee" stroke="#e6d3bd" stroke-width="1.2"/><ellipse cx="7.5" cy="9" rx="2" ry="3" fill="#fff"/></svg>'; }
  function renderBarn() {
    var L = R.layout(); if (!L || (L.id !== 'barninside' && L.id !== 'heninside')) return;
    var wrap = R.els.props, day = today();
    Array.prototype.slice.call(wrap.querySelectorAll('.barnthing')).forEach(function (el) { el.remove(); });
    ANIMALS.forEach(function (a) {
      if (a.scene !== L.id) return;
      var el = doc.createElement('button'); el.type = 'button'; el.className = 'nb barnthing animal' + (a.flip ? ' flip' : '') + ' a-' + a.id; el.dataset.id = a.id;
      el.style.left = a.x + '%'; el.style.top = a.y + '%'; el.style.width = a.w + '%'; el.setAttribute('aria-label', a.label);
      el.innerHTML = '<img src="' + ART + a.img + '" alt="">';
      el.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); go(a.id === 'clover' ? 'clover' : 'nests'); });
      wrap.appendChild(el);
    });
    var ready = L.id === 'heninside' ? eggsReady(S, day) : [];
    HENS.forEach(function (h) {
      if (ready.indexOf(h) < 0) return;
      var n = NESTS[h], el = doc.createElement('span'); el.className = 'barnthing nestegg'; el.style.left = n.x + '%'; el.style.top = n.y + '%'; el.innerHTML = eggSVG(); el.setAttribute('aria-hidden', 'true'); wrap.appendChild(el);
    });
    if (W.sortDepth) W.sortDepth(); /* the animals were just recreated: she stands in front of or behind them by her feet */
  }
  function hot(L, id) { return L.hotspots.filter(function (h) { return h.id === id; })[0]; }
  function go(id) {
    if (!idle()) return; if (R.sheetOpen()) R.hideSheet(); if (R.busy()) return;
    var L = R.layout(), h = L && L.hotspots && hot(L, id); if (!h) return;
    R.walkTo(h.wp, function () { if (R.layout() === L && OPEN[id]) OPEN[id](); });
  }
  function pantryLine() {
    var p = FM().farmState(S).pantry, bits = [];
    if (p.egg) bits.push(p.egg + ' egg' + (p.egg > 1 ? 's' : '')); if (p.milk) bits.push(p.milk + ' milk'); if (p.onsenegg) bits.push(p.onsenegg + ' onsen egg' + (p.onsenegg > 1 ? 's' : ''));
    return '<p class="help pantryline"><span class="ms">kitchen</span>' + (bits.length ? 'In the pantry: ' + esc(bits.join(', ')) + '.' : 'The pantry is empty for now.') + ' Kept on this device.</p>';
  }
  function step(box, o, done) { if (!CARE || !CARE.step) { done(); return; } CARE.step(box, Object.assign({ scene: R.layout().id }, o), done); }

  function openNests() {
    var day = today(), ready = eggsReady(S, day);
    var rows = HENS.map(function (h) { return '<li><span class="ms">' + (ready.indexOf(h) > -1 ? 'egg' : 'bedtime') + '</span>' + esc(NAMES[h]) + (ready.indexOf(h) > -1 ? ' laid an egg.' : '’s nest is resting today.') + '</li>'; }).join('');
    R.openSheet('barnnests', 'The hen house', 'Mochi and Kaya', 'egg',
      '<ul class="barnlist">' + rows + '</ul><div class="row" id="nestActs">' + (ready.length ? '<button type="button" class="btn primary" data-act="eggs"><span class="ms">egg</span>Collect ' + (ready.length > 1 ? 'the eggs' : 'the egg') + '</button>' : '') + '</div>' +
      pantryLine() + '<p class="help">The hens are fine on their own. An egg waits in the nest until you come by.</p>');
    var acts = doc.getElementById('nestActs'); if (!acts) return;
    acts.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]'); if (!btn || !idle()) return;
      if (ST && !ST.can('egg')) { R.toast('Too tired for that. A rest first.', 'bedtime'); return; }
      var seen = JSON.stringify(eggsReady(S, day));
      var lifts = [], putBack = function () { lifts.forEach(root.clearTimeout); lifts = []; renderBarn(); };
      step(acts, { ms: 2500, moment: 'eggs', verb: 'Lifting each egg from the straw…', stillLine: 'Notice the straw around each egg.', abort: putBack, cancel: openNests, start: function (ms) { Array.prototype.forEach.call(doc.querySelectorAll('#ownedProps .nestegg'), function (el, i) { lifts.push(root.setTimeout(function () { el.classList.add('lifted'); }, (i + 0.5) * ms / 3)); }); } }, function () {
        if (today() !== day || JSON.stringify(eggsReady(S, day)) !== seen) { renderBarn(); openNests(); return; } /* the day turned or another tab collected */
        var r = collectEggs(S, day, ST); if (!r.ok) { R.toast(r.why, 'info'); renderBarn(); openNests(); return; }
        R.chime('save'); renderBarn(); R.toast(r.n + ' egg' + (r.n > 1 ? 's' : '') + ' in the pantry.', 'egg'); openNests();
      });
    });
  }
  function pailSVG() { return '<svg viewBox="0 0 80 70" aria-hidden="true"><path d="M18 20 Q40 6 62 20" fill="none" stroke="#9d86c4" stroke-width="4"/><defs><clipPath id="pailBody"><path d="M16 22 L64 22 L58 64 L22 64 Z"/></clipPath></defs><path d="M16 22 L64 22 L58 64 L22 64 Z" fill="#efe8fb" stroke="#9d86c4" stroke-width="3"/><g clip-path="url(#pailBody)"><rect class="pailmilk" x="10" y="30" width="60" height="40" fill="#fffaf2" style="transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(0.04)"/></g></svg>'; }
  function basketSVG() { return '<svg viewBox="0 0 90 90" aria-hidden="true"><ellipse cx="45" cy="72" rx="38" ry="12" fill="#7ad9d3" opacity=".6"/><g class="sbasket" style="transform-box:fill-box;transform-origin:50% 0%"><path d="M45 2 V22" stroke="#b9956a" stroke-width="3"/><path d="M26 26 L64 26 L58 48 L32 48 Z" fill="#d6b48a" stroke="#a37c52" stroke-width="3"/><path d="M28 34 H62 M30 41 H60" stroke="#a37c52" stroke-width="2"/></g><g class="ssteam" opacity="0"><path d="M30 60 q 4 -8 0 -16 q -4 -8 0 -16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/><path d="M58 62 q 4 -8 0 -16 q -4 -8 0 -16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/></g></svg>'; }
  function openClover() {
    var day = today(), has = milkReady(S, day);
    R.openSheet('barnclover', 'Clover', 'The cow in the stall', 'pets',
      '<div class="bedcard"><div class="bedpic pailpic">' + pailSVG() + '</div><div class="bedtext"><b>' + (has ? 'Clover has milk today' : 'Clover is resting today') + '</b><span>' + (has ? 'One pail, when you are ready.' : 'She gives one pail on a new day.') + '</span></div></div><div class="row" id="cloverActs">' +
      (has ? '<button type="button" class="btn primary" data-act="milk"><span class="ms">water_full</span>Milk Clover</button>' : '') +
      '<button type="button" class="btn ' + (has ? 'soft' : 'primary') + '" data-act="brush"><span class="ms">brush</span>Brush Clover</button></div>' +
      pantryLine() + '<p class="help">Brushing is just for the two of you. Clover is fine while you are away.</p>');
    var acts = doc.getElementById('cloverActs'); if (!acts) return;
    acts.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]'); if (!btn || !idle()) return;
      if (btn.dataset.act === 'brush') { step(acts, { ms: 3000, moment: 'brush', verb: 'Brushing slowly…', cancel: openClover }, function () { R.chime('tap'); openClover(); }); return; }
      if (ST && !ST.can('milk')) { R.toast('Too tired for that. A rest first.', 'bedtime'); return; }
      step(acts, { ms: 3000, moment: 'milk', verb: 'Milking slowly…', stillLine: 'Notice how still Clover stands.', cancel: openClover, start: function (ms) { var m = doc.querySelector('#sheet .pailmilk'); if (m) root.requestAnimationFrame(function () { root.requestAnimationFrame(function () { m.style.transition = 'transform ' + ms + 'ms ease-in-out'; m.style.transform = 'scaleY(1)'; }); }); } }, function () {
        if (today() !== day || !milkReady(S, day)) { openClover(); return; }
        var r = milk(S, day, ST); if (!r.ok) { R.toast(r.why, 'info'); openClover(); return; }
        R.chime('save'); R.toast('A pail of milk in the pantry.', 'water_full'); openClover();
      });
    });
  }
  function openCrack() {
    if (caveFound(S)) { W.travel('cave'); return; }
    R.openSheet('barncrack', 'A crack of starlight', 'Behind the barn', 'auto_awesome',
      '<p class="mindline"><span class="ms">auto_awesome</span><span>There is a narrow path between the stones.</span></p><div class="row"><button type="button" class="btn primary" id="crackGo"><span class="ms">auto_awesome</span>Step through</button><button type="button" class="btn soft" id="crackNo">Not now</button></div>');
    doc.getElementById('crackNo').addEventListener('click', function () { R.hideSheet(); });
    doc.getElementById('crackGo').addEventListener('click', function () {
      if (!at('barn') || (CARE && CARE.asleepNow && CARE.asleepNow())) { R.hideSheet(); return; }
      var r = findCave(S, today()); if (!r.ok) { R.toast(r.why, 'info'); return; }
      syncCrack(); R.hideSheet(); W.travel('cave');
    });
  }
  /* pretend onsen eggs: lower, watch the steam, lift; Stop anywhere changes nothing, the eggs change only at the end */
  function openBasket() {
    var f0 = FM().farmState(S), p = f0.pantry, n = cookable(f0);
    R.openSheet('springbasket', 'The spring basket', 'Pretend onsen eggs', 'egg',
      '<div class="bedcard"><div class="bedpic springpic">' + basketSVG() + '</div><div class="bedtext"><b>' + (n ? n + ' egg' + (n > 1 ? 's' : '') + ' to lower' : p.egg ? 'The pantry is full of onsen eggs' : 'No eggs yet') + '</b><span>' + (n ? 'The warm water does the rest.' : p.egg ? 'Enjoy some first.' : 'Bring an egg from the hen house.') + '</span></div></div>' +
      '<div class="row" id="basketActs">' + (n ? '<button type="button" class="btn primary" data-act="cook"><span class="ms">egg</span>Make onsen eggs</button>' : '') + '</div>' +
      pantryLine() + '<p class="help">This is pretend cooking in a pretend spring. Nothing here changes your energy.</p>');
    var acts = doc.getElementById('basketActs'); if (!acts) return;
    acts.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]'); if (!btn || !idle()) return;
      var seen = JSON.stringify(FM().farmState(S).pantry), want = n;
      var anim = function (sel, prop, val, ms) { return function () { var el = doc.querySelector('#sheet ' + sel); if (el) root.requestAnimationFrame(function () { root.requestAnimationFrame(function () { el.style.transition = prop + ' ' + ms + 'ms ease-in-out'; el.style[prop] = val; }); }); }; };
      step(acts, { ms: 2500, moment: 'springlower', verb: 'Lowering the basket…', stillLine: 'Notice the glow of the water.', cancel: openBasket, start: function (ms) { anim('.sbasket', 'transform', 'translateY(26px)', ms)(); } }, function () {
        step(acts, { ms: 6000, moment: 'springsteam', verb: 'The eggs rest in the warm water…', stillLine: 'Notice the stars above the water.', cancel: openBasket, start: function (ms) { anim('.ssteam', 'opacity', '1', ms * 0.4)(); } }, function () {
          step(acts, { ms: 2500, moment: 'springlift', verb: 'Lifting the basket…', stillLine: 'Notice the glow of the water.', cancel: openBasket, start: function (ms) { anim('.ssteam', 'opacity', '0', ms)(); anim('.sbasket', 'transform', 'translateY(0)', ms)(); } }, function () {
            if (JSON.stringify(FM().farmState(S).pantry) !== seen) { openBasket(); return; } /* another tab changed the pantry */
            var r = cookEggs(S, want); if (!r.ok) { R.toast(r.why, 'info'); openBasket(); return; }
            R.chime('save'); afterCook(r.n);
          });
        });
      });
    });
  }
  function afterCook(n) {
    R.openSheet('springdone', 'Onsen eggs', n + ' in the pantry', 'egg',
      '<p>Your onsen egg' + (n > 1 ? 's are' : ' is') + ' in the pantry.</p>' + pantryLine() +
      '<div class="row"><button type="button" class="btn primary" id="cookDone">Done</button><button type="button" class="btn ghost" id="cookDiary">Open food diary</button></div>');
    doc.getElementById('cookDone').addEventListener('click', function () { R.hideSheet(); });
    doc.getElementById('cookDiary').addEventListener('click', function () { R.hideSheet(); var a = doc.querySelector('nav a[data-tab="food"]'); if (a) a.click(); });
  }
  /* sitting by the water: her seated sprite on the warm stone, no breathing animation, no timer, no save, Stop any time */
  var sitting = null;
  function openStone() {
    R.openSheet('warmstone', 'A warm stone', 'By the water', 'chair',
      '<p>Sit for as long as you like. Nothing is counted.</p><div class="row"><button type="button" class="btn primary" id="sitGo"><span class="ms">chair</span>Sit by the water</button></div>');
    doc.getElementById('sitGo').addEventListener('click', function () { R.hideSheet(); sitDown(); });
  }
  function sitDown() {
    if (sitting || !at('cave') || !idle()) return;
    var G = root.OvuGarden, el = doc.createElement('div'), outfit = S.profile().outfit || 'base';
    el.className = 'nb springsitter'; el.dataset.id = 'springsitter';
    el.innerHTML = '<img src="' + ART + 'avatar-' + outfit + '.webp" alt="">';
    var stop = doc.createElement('button'); stop.type = 'button'; stop.className = 'springstop'; stop.id = 'springStop'; stop.innerHTML = '<span class="ms">stop_circle</span>Stop sitting';
    R.els.props.appendChild(el); R.els.scene.appendChild(stop);
    if (G && G.seatPlace) { G.seatPlace(el, CAVE.seat); G.seatedImg(el.querySelector('img'), el.querySelector('img').src); }
    else { el.style.left = CAVE.seat.x + '%'; el.style.top = CAVE.seat.groundY + '%'; el.style.width = '9%'; }
    sitting = { el: el, stop: stop }; R.els.scene.classList.add('sitting', 'springsit');
    stop.addEventListener('click', function (e) { e.stopPropagation(); standUp(); });
    try { stop.focus({ preventScroll: true }); } catch (e) { }
    if (R.moment) R.moment('springsit', { quiet: true, pose: null });
  }
  function standUp() {
    if (!sitting) return; var s = sitting; sitting = null;
    if (s.el.parentNode) s.el.remove(); if (s.stop.parentNode) s.stop.remove();
    R.els.scene.classList.remove('sitting', 'springsit');
  }
  B.standUp = standUp; B.sitting = function () { return !!sitting; };
  var OPEN = { clover: openClover, nests: openNests, crack: openCrack, springbasket: openBasket, warmstone: openStone };
  function handler(scene, fn) { return function (id, L) { if (!L || L.id !== scene) return false; if ((W.napping && W.napping()) || R.busy() || !idle()) return true; fn(); return true; }; }
  R.hotspotHandlers.clover = handler('barninside', openClover);
  R.hotspotHandlers.nests = handler('heninside', openNests);
  R.hotspotHandlers.barndoor = function (id, L) { if (!L || L.id !== 'barn') return false; if (W.napping && W.napping()) return true; W.travel('barninside'); return true; };
  R.hotspotHandlers.hendoor = function (id, L) { if (!L || L.id !== 'barn') return false; if (W.napping && W.napping()) return true; W.travel('heninside'); return true; };
  R.hotspotHandlers.barninexit = function (id, L) { if (!L || L.id !== 'barninside') return false; W.travel('barn'); return true; };
  R.hotspotHandlers.heninexit = function (id, L) { if (!L || L.id !== 'heninside') return false; W.travel('barn'); return true; };
  R.hotspotHandlers.crack = handler('barn', openCrack);
  R.hotspotHandlers.barnexit = function (id, L) { if (!L || L.id !== 'barn') return false; W.travel('farm'); return true; };
  R.hotspotHandlers.springbasket = handler('cave', openBasket);
  R.hotspotHandlers.warmstone = handler('cave', openStone);
  R.hotspotHandlers.caveexit = function (id, L) { if (!L || L.id !== 'cave') return false; standUp(); W.travel('barn'); return true; };
  /* the farm's way to the barn: a signposted path on the farm island's right edge */
  R.hotspotHandlers.barnpath = function (id, L) { if (!L || L.id !== 'farm') return false; if (W.napping && W.napping()) return true; W.travel('barn'); return true; };
  /* Luna's one gentle hint, on a later barn visit, if the crack is still unfound; once only, never required */
  function maybeHint() {
    var f = FM().farmState(S); if (f.found.cave || f.lunaHint) return;
    var visits = (f.barnVisits | 0) + 1, g = copy(f); g.barnVisits = visits;
    if (visits >= 2) { g.lunaHint = true; root.setTimeout(function () { if (at('barn') && !caveFound(S)) R.toast('I saw starlight between the rocks behind the barn.', 'dark_mode', 'Luna'); }, 1800); }
    try { if (S.commit) S.commit({ farm: g }); else S.setState({ farm: g }); } catch (e) { }
  }
  R.on('boot', function () {
    R.on('layout', function (L) {
      if (!L || L.id !== 'cave') standUp();
      syncCrack();
      if (L && L.id === 'barn') maybeHint();
      renderBarn();
    });
    R.on('props', function () { renderBarn(); if (sitting && !sitting.el.isConnected) R.els.props.appendChild(sitting.el); });
    R.on('beforeWalk', standUp); R.on('walk', standUp);
    R.on('activity', standUp);
    var shown = null; /* which barn sheet is open, so a new day or another tab can redraw it as it is now */
    var SHEETS = { barnnests: openNests, barnclover: openClover, springbasket: openBasket };
    function redrawOpen() { var id = R.sheetId ? R.sheetId() : null; var fn = id && SHEETS[id]; if (!fn || !R.sheetOpen()) return; if (CARE && CARE.cancel) CARE.cancel(); fn(); }
    if (GT) GT.onNewDay(function () { renderBarn(); redrawOpen(); });
    var key = JSON.stringify(S.state().farm || null);
    S.subscribe(function (reason) {
      if (reason === 'clear' || reason === 'import') { if (CARE && CARE.cancel) CARE.cancel(); key = JSON.stringify(S.state().farm || null); syncCrack(); renderBarn(); redrawOpen(); return; } /* the diary was replaced here: nothing pending survives it */
      if (reason === 'state') { key = JSON.stringify(S.state().farm || null); return; } /* our own saves move the baseline */
      if (!(reason === 'external' || String(reason).indexOf('sync') === 0)) return;
      var k = JSON.stringify(S.state().farm || null), wiped = !S.state().farm; if (k === key && !wiped) return; key = k; /* a wipe (Delete everything elsewhere) always counts */
      syncCrack(); renderBarn(); redrawOpen();
    });
  });
  B.openNests = openNests; B.openClover = openClover; B.openBasket = openBasket; B.openCrack = openCrack; B.openStone = openStone; B.sitDown = sitDown; B.renderBarn = renderBarn; B.syncCrack = syncCrack;
})(typeof window !== 'undefined' ? window : this);
