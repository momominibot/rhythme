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
  var BATCH = 4, STARTERS = [{ id: 'clover', kind: 'cow', name: 'Clover' }, { id: 'mochi', kind: 'hen', name: 'Mochi' }, { id: 'kaya', kind: 'hen', name: 'Kaya' }];
  function FM() { return root.OvuFarm; }
  function RN() { return root.OvuRanch; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  /* the herd (ovu-ranch.js, 22 Oct): the three starters until the ranch record exists, then whoever lives here */
  function herd(f) { var r = RN() && RN().ranchOf(f); return r ? r.herd : copy(STARTERS); }
  function idsOf(f, kind) { return herd(f).filter(function (a) { return a.kind === kind; }).map(function (a) { return a.id; }); }
  function adultsOf(f, kind, day) { var R0 = RN(); return herd(f).filter(function (a) { return a.kind === kind && (!R0 || R0.isAdult(a, day)); }).map(function (a) { return a.id; }); }
  function animalOf(f, id) { return herd(f).filter(function (a) { return a.id === id; })[0] || null; }
  function nameOf(f, id) { var a = animalOf(f, id); return a ? a.name : (id === 'hens' ? 'the hens' : id); }
  function isBaby(f, id, day) { var a = animalOf(f, id), R0 = RN(); return !!(a && R0 && !R0.isAdult(a, day)); }
  /* a copy of the farm for a write, with the ranch record made once and due babies arrived */
  function farm(S) { var f = copy(FM().farmState(S)), R0 = RN(), d = GT0() ? GT0().dayKey() : S.today(); return R0 ? R0.reconcile(R0.advance(R0.migrate(f, d), d)) : f; }
  function GT0() { return root.OvuGameTime; }
  function cap() { return FM().PANTRY_CAP; }
  function save(S, f, ST, action) {
    if (ST && ST.spendWith) {
      if (!ST.COSTS || ST.COSTS[action] == null) return { ok: false, why: 'unknown action' }; /* an unregistered action would cost nothing */
      if (!ST.spendWith(action, { farm: f })) return { ok: false, why: 'Not enough play energy for that just now. It comes back after a sleep saved from the bed, or with the new day.' };
      return { ok: true, charged: true };
    }
    if (S.commit) S.commit({ farm: f }); else S.setState({ farm: f });
    return { ok: true, charged: false };
  }
  function attempt(fn) { try { return fn(); } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; } }
  /* a grown animal has a product on any day after the day it was last collected (a clock set back gives nothing twice);
     babies make nothing; the size follows love (ovu-ranch.js productSize) and is kept beside the pantry total */
  function hasEgg(f, who, day) { var last = f.animals[who]; return !last || day > last; }
  function eggsReady(S, day) { var f = FM().farmState(S); return adultsOf(f, 'hen', day).filter(function (h) { return hasEgg(f, h, day); }); }
  function milkCows(S, day) { var f = FM().farmState(S); return adultsOf(f, 'cow', day).filter(function (c) { return hasEgg(f, c, day); }); }
  function milkReady(S, day) { return milkCows(S, day).length > 0; }
  function sizeFor(f, who) { var R0 = RN(); return R0 ? R0.productSize(loveOf(f, who).n) : 'small'; }
  function collectEggs(S, day, ST) {
    var f = farm(S), hens = adultsOf(f, 'hen', day).filter(function (h) { return hasEgg(f, h, day); });
    if (!hens.length) return { ok: false, why: 'The nests are resting today.' };
    var room = cap() - f.pantry.egg; if (room < 1) return { ok: false, why: 'The pantry has all the eggs it can hold.' };
    hens = hens.slice(0, room);
    var sizes = {}; hens.forEach(function (h) { f.animals[h] = day; var sz = sizeFor(f, h); sizes[sz] = (sizes[sz] || 0) + 1; if (RN()) f = RN().addProduct(f, 'egg', sz, 1); }); f.pantry.egg += hens.length;
    return attempt(function () { var sv = save(S, f, ST, 'egg'); if (!sv.ok) return sv; return { ok: true, n: hens.length, hens: hens, sizes: sizes, charged: sv.charged }; });
  }
  function milk(S, day, ST) {
    var f = farm(S), cows = adultsOf(f, 'cow', day).filter(function (c) { return hasEgg(f, c, day); });
    if (!cows.length) return { ok: false, why: (cowsLine(f) || 'The cow') + ' is resting today.' };
    var room = cap() - f.pantry.milk; if (room < 1) return { ok: false, why: 'The pantry has all the milk it can hold.' };
    cows = cows.slice(0, room);
    var sizes = {}; cows.forEach(function (c) { f.animals[c] = day; var sz = sizeFor(f, c); sizes[sz] = (sizes[sz] || 0) + 1; if (RN()) f = RN().addProduct(f, 'milk', sz, 1); }); f.pantry.milk += cows.length;
    return attempt(function () { var sv = save(S, f, ST, 'milk'); if (!sv.ok) return sv; return { ok: true, n: cows.length, cows: cows, sizes: sizes, charged: sv.charged }; });
  }
  function cowsLine(f) { var names = idsOf(f, 'cow').map(function (c) { return nameOf(f, c); }); return names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0] || ''; }
  /* pretend onsen eggs: up to four eggs in one save, eggs out and onsen eggs in; no energy */
  function cookable(f) { return Math.min(BATCH, f.pantry.egg, cap() - f.pantry.onsenegg); }
  function cookEggs(S, want) {
    var f = farm(S), n = cookable(f); if (want != null) { if (want < 1 || want > n) return { ok: false, why: 'The pantry changed in the meantime. Have another look.' }; n = want; }
    if (f.pantry.egg < 1) return { ok: false, why: 'Bring an egg from the hen house first.' };
    if (n < 1) return { ok: false, why: 'The pantry has all the onsen eggs it can hold.' };
    f.pantry.egg -= n; f.pantry.onsenegg += n;
    return attempt(function () { save(S, f, null); return { ok: true, n: n }; });
  }
  /* treats from the harvest basket (21 Oct: the basket needed somewhere to go): Clover likes carrots, pumpkins and sweet potatoes,
     the hens kangkong, pak choy and strawberries. A treat is only a treat: nothing is fed, nothing is owed, nothing changes but the basket. */
  var TREATS = { cow: ['carrot', 'pumpkin', 'sweetpotato'], hens: ['kangkong', 'pakchoy', 'strawberry'] }; TREATS.clover = TREATS.cow;
  function treatsFor(f, who) { if (who === 'hens') return TREATS.hens; var a = animalOf(f, who); return a && a.kind === 'cow' ? TREATS.cow : null; }
  /* friendship, Harvest Moon style (Jamie, 22 Oct: "I can pet my cow and chickens, brush them and they feel love by popping
   * heart"): each animal has a love meter of 0 to 10. Petting, brushing and a treat each add one a day; nothing takes it away.
   * It is game state under state.farm.love, apart from the hearts earned by logging, and it never touches the diary. */
  var LOVE_MAX = 10, LOVE_ACTS = { pet: 1, brush: 1, treat: 1 };
  function loveOf(f, who) {
    var l = (f.love || {})[who] || {};
    return { n: Math.max(0, Math.min(LOVE_MAX, Math.floor(Number(l.n) || 0))), day: typeof l.day === 'string' ? l.day : null, acts: l.acts && typeof l.acts === 'object' ? Object.assign({}, l.acts) : {} };
  }
  function addLove(f, who, act, day) {
    if (!animalOf(f, who) || !LOVE_ACTS[act]) return false;
    var l = loveOf(f, who);
    if (l.day && day < l.day) return false; /* a clock set back never pays a day twice */
    if (l.day !== day) { l.day = day; l.acts = {}; }
    if (l.acts[act]) return false;
    l.acts[act] = 1; var gained = l.n < LOVE_MAX; if (gained) l.n += 1;
    var full = (f.love || {})[who] && (f.love || {})[who].full; if (l.n >= LOVE_MAX && !full) full = day; /* the day love first filled: a cow's calf can come a week later */
    f.love = Object.assign({}, f.love || {}); f.love[who] = { n: l.n, day: l.day, acts: l.acts }; if (full) f.love[who].full = full;
    return gained;
  }
  function love(S, who) { return loveOf(FM().farmState(S), who).n; }
  function doneToday(S, who, act, day) { var l = loveOf(FM().farmState(S), who); return l.day === day && !!l.acts[act]; }
  function care(S, who, act, day) {
    var f = farm(S), g = addLove(f, who, act, day);
    return attempt(function () { if (g || f.love) save(S, f, null); return { ok: true, gained: g, n: loveOf(f, who).n }; });
  }
  function treatOptions(S, who) { var f = FM().farmState(S); return (treatsFor(f, who) || []).filter(function (c) { return (f.harvest[c] || 0) > 0; }); }
  function giveTreat(S, who, crop, day) {
    var f = farm(S), ok = treatsFor(f, who);
    if (!ok || ok.indexOf(crop) < 0) return { ok: false, why: 'Not something ' + (who === 'hens' ? 'the hens' : nameOf(f, who)) + ' would eat.' };
    if (!((f.harvest[crop] || 0) > 0)) return { ok: false, why: 'None left in the basket.' };
    f.harvest[crop] -= 1; if (!f.harvest[crop]) delete f.harvest[crop];
    f.treats = Object.assign({}, f.treats || {}); f.treats[who] = day;
    var gained = (who === 'hens' ? idsOf(f, 'hen') : [who]).map(function (a) { return addLove(f, a, 'treat', day); }).some(Boolean);
    return attempt(function () { save(S, f, null); return { ok: true, crop: crop, gained: gained }; });
  }
  function treatedToday(S, who, day) { var t = FM().farmState(S).treats; return !!(t && t[who] === day); }
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
      { id: 'barndoor', x: 29, y: 47, label: 'Barn · the cows', prompt: 'Tap to go into the barn', icon: 'cottage', wp: { x: 33, y: 64, flip: true } },
      { id: 'hendoor', x: 80, y: 45, label: 'Hen house · the hens', prompt: 'Tap to go into the hen house', icon: 'egg', wp: { x: 70, y: 67, flip: false } },
      { id: 'crack', x: 53, y: 28, label: 'A crack of starlight', prompt: 'Tap to look closer', icon: 'auto_awesome', wp: { x: 55, y: 56, flip: false } },
      { id: 'ranchsign', x: 56, y: 44, label: 'Ranch counter · animals and room for them', prompt: 'Tap to see the ranch counter', icon: 'storefront', wp: { x: 56, y: 57, flip: false } }
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
    id: 'barninside', scene: 'barninside', mapHide: true, mapParent: 'barn', name: 'Inside the barn', img: 'barn-inside-v1.webp', w: 1024, h: 1280, avatarW: 14, only: [], mapIcon: 'cottage', indoor: true,
    hotspots: [
      { id: 'barninexit', x: 88, y: 66, label: 'Door · back to the yard', prompt: 'Tap to go back outside', icon: 'door_open', wp: { x: 85, y: 76, flip: false } },
      { id: 'clover', x: 33, y: 52, label: 'The stalls · the cows', prompt: 'Tap to visit the cows', icon: 'pets', wp: { x: 46, y: 75, flip: true } }
    ],
    home: { x: 85, y: 76, flip: true },
    zones: [[[22, 76], [50, 67], [57, 63], [69, 67], [86, 73], [93, 77], [60, 85], [27, 88]]],
    solids: [{ id: 'stall', x0: 15, x1: 51, y0: 45, y1: 71 }, { id: 'stool', x0: 59, x1: 67, y0: 55, y1: 63 }, { id: 'door', x0: 70, x1: 80, y0: 45, y1: 70 }, { id: 'clover', x0: 24, x1: 42, y0: 66, y1: 71 }],
    doors: [{ id: 'barninexit', to: 'barn', x: 85, y: 76, r: 4, flip: true }],
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 }, props: {}
  };
  var HEN_IN = {
    id: 'heninside', scene: 'heninside', mapHide: true, mapParent: 'barn', name: 'The hen house', img: 'hen-inside-v1.webp', w: 1024, h: 1280, avatarW: 15, only: [], mapIcon: 'egg', indoor: true,
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
  var B = { LOVE_MAX: LOVE_MAX, love: love, care: care, doneToday: doneToday, LAYOUT: BARN, CAVE: CAVE, BARN_IN: BARN_IN, HEN_IN: HEN_IN, CRACK_DOOR: CRACK_DOOR, herd: herd, idsOf: idsOf, adultsOf: adultsOf, nameOf: nameOf, isBaby: isBaby, milkCows: milkCows, STARTERS: STARTERS, BATCH: BATCH, TREATS: TREATS, eggsReady: eggsReady, milkReady: milkReady, collectEggs: collectEggs, milk: milk, cookEggs: cookEggs, cookable: cookable, caveFound: caveFound, findCave: findCave, treatOptions: treatOptions, giveTreat: giveTreat, treatedToday: treatedToday };
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
  /* where each animal stands, in herd order (the starters keep their old places); a baby is drawn smaller until it grows */
  var SLOTS = {
    cow: [{ x: 33, y: 70, w: 21, flip: false }, { x: 57, y: 66, w: 19, flip: true }, { x: 20, y: 62, w: 17, flip: false }, { x: 44, y: 60, w: 16, flip: true }],
    hen: [{ x: 47, y: 76, w: 12, flip: false }, { x: 70, y: 70, w: 12, flip: true }, { x: 36, y: 72, w: 11, flip: false }, { x: 60, y: 79, w: 11, flip: true }, { x: 52, y: 69, w: 10, flip: false }, { x: 76, y: 78, w: 11, flip: true }]
  };
  var HEN_IMGS = ['animal-hen.webp', 'animal-hen-kaya.webp'];
  function sprites(f, day) {
    var out = [], ci = 0, hi = 0;
    herd(f).forEach(function (a) {
      var baby = isBaby(f, a.id, day), kind = a.kind;
      var sl = kind === 'cow' ? SLOTS.cow[ci++ % SLOTS.cow.length] : SLOTS.hen[hi++ % SLOTS.hen.length];
      out.push({ id: a.id, kind: kind, baby: baby, scene: kind === 'cow' ? 'barninside' : 'heninside', img: baby ? (kind === 'cow' ? 'animal-calf.webp' : 'animal-chick.webp') : kind === 'cow' ? 'animal-cow.webp' : HEN_IMGS[(hi - 1) % 2],
        x: sl.x, y: sl.y, w: baby ? Math.round(sl.w * 0.62) : sl.w, flip: sl.flip, label: (a.name === 'Calf' || a.name === 'Chick') ? (kind === 'cow' ? 'A calf, not yet named' : 'A chick, not yet named') : a.name + (baby ? (kind === 'cow' ? ' the calf' : ' the chick') : (kind === 'cow' ? ' the cow' : ' the hen')) });
    });
    return out;
  }
  /* an egg sits in each nest box that has one; nests along the shelf, in hen order */
  var NEST_SLOTS = [{ x: 52, y: 41 }, { x: 66, y: 45 }, { x: 46, y: 40 }, { x: 59, y: 43 }, { x: 72, y: 47 }, { x: 40, y: 39 }];
  function nestOf(f, hen) { var i = idsOf(f, 'hen').indexOf(hen); return NEST_SLOTS[(i < 0 ? 0 : i) % NEST_SLOTS.length]; }
  function eggSVG() { return '<svg viewBox="0 0 20 24" aria-hidden="true"><ellipse cx="10" cy="13" rx="7.5" ry="9.5" fill="#fff8ee" stroke="#e6d3bd" stroke-width="1.2"/><ellipse cx="7.5" cy="9" rx="2" ry="3" fill="#fff"/></svg>'; }
  /* hearts pop out of an animal she pets or brushes, with the soft pet sound; more hearts when the meter went up */
  function animalEl(who) { return doc.querySelector('#ownedProps .barnthing.animal[data-id="' + who + '"]'); }
  function heartPop(who, many) {
    if (root.OvuSound) root.OvuSound.play('pet');
    var el = animalEl(who); if (!el) return;
    var wrap = R.els.props, n = many ? 5 : 2;
    for (var i = 0; i < n; i++) {
      var h = doc.createElement('span'); h.className = 'lovepop'; h.setAttribute('aria-hidden', 'true');
      h.innerHTML = '<span class="ms fill">favorite</span>';
      h.style.left = el.style.left; h.style.top = 'calc(' + el.style.top + ' - ' + (Number(el.style.width.replace('%', '')) * 0.55).toFixed(1) + '%)';
      h.style.setProperty('--dx', ((i - (n - 1) / 2) * 14) + 'px'); h.style.animationDelay = (i * 90) + 'ms';
      wrap.appendChild(h); root.setTimeout(function (x) { return function () { x.remove(); }; }(h), 1500 + i * 90);
    }
    el.classList.remove('loved'); void el.offsetWidth; el.classList.add('loved');
  }
  function NM(who) { return nameOf(FM().farmState(S), who); }
  function meter(who) {
    var n = love(S, who), out = '', f = FM().farmState(S), baby = isBaby(f, who, today()), a = animalOf(f, who);
    for (var i = 0; i < B.LOVE_MAX; i++) out += '<span class="ms' + (i < n ? ' fill' : ' off') + '">favorite</span>';
    var grow = baby && a && a.adultOn && RN() ? ' <small>grows up in ' + Math.max(1, Math.round((Date.parse(a.adultOn) - Date.parse(today())) / 86400000)) + ' days</small>' : '';
    var rename = a && a.born ? ' <button type="button" class="chipbtn namebtn" data-rename="' + who + '" aria-label="Name ' + esc(NM(who)) + '"><span class="ms">edit</span></button>' : ''; /* an animal born here can be named */
    return '<div class="lovemeter" aria-label="' + esc(NM(who)) + ': ' + n + ' of ' + B.LOVE_MAX + ' hearts"><b>' + esc(NM(who)) + grow + rename + '</b><span class="lm">' + out + '</span></div>';
  }
  function petNow(who) {
    var r = care(S, who, 'pet', today()); heartPop(who, r.ok && r.gained);
    if (r.ok && r.gained) R.toast(NM(who) + ' loves that. ' + r.n + ' of ' + B.LOVE_MAX + ' hearts.', 'favorite');
  }
  /* the hens wander the floor and peck while she is in the hen house */
  var wander = null;
  var HEN_AREA = { x0: 34, x1: 78, y0: 68, y1: 82 };
  function startWander() {
    if (wander || !at('heninside')) return;
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduce) return;
    wander = root.setInterval(function () {
      if (!at('heninside')) { root.clearInterval(wander); wander = null; return; }
      idsOf(FM().farmState(S), 'hen').forEach(function (h) {
        if (Math.random() < 0.35) return; var el = animalEl(h); if (!el) return;
        if (Math.random() < 0.4) { el.classList.remove('peck'); void el.offsetWidth; el.classList.add('peck'); return; }
        var x0 = parseFloat(el.style.left), x = Math.max(HEN_AREA.x0, Math.min(HEN_AREA.x1, x0 + (Math.random() * 16 - 8))), y = Math.max(HEN_AREA.y0, Math.min(HEN_AREA.y1, parseFloat(el.style.top) + (Math.random() * 6 - 3)));
        el.classList.toggle('flip', x > x0); el.style.left = x.toFixed(1) + '%'; el.style.top = y.toFixed(1) + '%';
      });
      if (W.sortDepth) W.sortDepth();
    }, 2200);
  }
  function renderBarn() {
    var L = R.layout(); if (!L || (L.id !== 'barninside' && L.id !== 'heninside')) return;
    var wrap = R.els.props, day = today();
    Array.prototype.slice.call(wrap.querySelectorAll('.barnthing')).forEach(function (el) { el.remove(); });
    var f = FM().farmState(S);
    sprites(f, day).forEach(function (a) {
      if (a.scene !== L.id) return;
      var el = doc.createElement('button'); el.type = 'button'; el.className = 'nb barnthing animal' + (a.flip ? ' flip' : '') + (a.baby ? ' baby' : '') + ' a-' + a.id + ' k-' + a.kind; el.dataset.id = a.id;
      el.style.left = a.x + '%'; el.style.top = a.y + '%'; el.style.width = a.w + '%'; el.setAttribute('aria-label', a.label);
      el.innerHTML = '<img src="' + ART + a.img + '" alt="">';
      el.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); if (!idle() || R.busy()) return; petNow(a.id); go(a.kind === 'cow' ? 'clover' : 'nests'); });
      wrap.appendChild(el);
    });
    var ready = L.id === 'heninside' ? eggsReady(S, day) : [];
    ready.forEach(function (h) {
      var n = nestOf(f, h), el = doc.createElement('span'); el.className = 'barnthing nestegg'; el.dataset.hen = h; el.style.left = n.x + '%'; el.style.top = n.y + '%'; el.innerHTML = eggSVG(); el.setAttribute('aria-hidden', 'true'); wrap.appendChild(el);
    });
    if (W.sortDepth) W.sortDepth(); /* the animals were just recreated: she stands in front of or behind them by her feet */
    if (L.id === 'heninside') startWander();
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

  function treatButtons(who) { return treatOptions(S, who).map(function (c) { var n = FM().CROPS[c].name.toLowerCase(); return '<button type="button" class="btn soft" data-act="treat" data-who="' + who + '" data-crop="' + c + '"><span class="ms">nutrition</span>' + (who === 'hens' ? 'Give the hens ' + (c === 'strawberry' ? 'a strawberry' : 'some ' + esc(n)) : 'Give ' + esc(NM(who)) + ' a ' + esc(n)) + '</button>'; }).join(''); }
  function treatStep(acts, who, btn, reopen) {
    var crop = btn.dataset.crop, name = FM().CROPS[crop] ? FM().CROPS[crop].name.toLowerCase() : crop, seen = JSON.stringify(FM().farmState(S).harvest);
    step(acts, { ms: 3000, moment: who === 'hens' ? 'hentreat' : 'treat', verb: 'Holding it out…', cancel: reopen }, function () {
      if (JSON.stringify(FM().farmState(S).harvest) !== seen) { reopen(); return; } /* the basket changed in the meantime */
      who = btn.dataset.who || who;
      var r = giveTreat(S, who, crop, today()); if (!r.ok) { R.toast(r.why, 'info'); reopen(); return; }
      (who === 'hens' ? idsOf(FM().farmState(S), 'hen') : [who]).forEach(function (a) { heartPop(a, r.gained); }); R.toast(who === 'hens' ? 'The hens shared the ' + name + '.' : NM(who) + ' took the ' + name + ' slowly.', 'nutrition'); reopen();
    });
  }
  function openNests() {
    var day = today(), ready = eggsReady(S, day), f = FM().farmState(S), hens = idsOf(f, 'hen'), r0 = RN() && RN().ranchOf(f);
    var rows = hens.map(function (h) { var baby = isBaby(f, h, day); return '<li><span class="ms">' + (ready.indexOf(h) > -1 ? 'egg' : baby ? 'child_care' : 'bedtime') + '</span>' + esc(nameOf(f, h)) + (ready.indexOf(h) > -1 ? ' laid an egg.' : baby ? ' is a chick, too small to lay yet.' : '’s nest is resting today.') + '</li>'; }).join('');
    if (r0 && r0.incubator) rows += '<li><span class="ms">egg_alt</span>An egg is warm in the incubator, due ' + esc(r0.incubator.due === day ? 'today' : 'in ' + Math.max(1, Math.round((Date.parse(r0.incubator.due) - Date.parse(day)) / 86400000)) + ' days') + '.</li>';
    R.openSheet('barnnests', 'The hen house', hens.map(function (h) { return nameOf(f, h); }).join(', ') || 'The hens', 'egg',
      hens.map(meter).join('') + '<div class="row" id="henCare">' + hens.map(function (h) { return '<button type="button" class="btn soft" data-care="pet" data-who="' + h + '"' + (doneToday(S, h, 'pet', day) ? ' disabled' : '') + '><span class="ms">pan_tool</span>Pet ' + esc(nameOf(f, h)) + '</button><button type="button" class="btn soft" data-care="brush" data-who="' + h + '"' + (doneToday(S, h, 'brush', day) ? ' disabled' : '') + '><span class="ms">brush</span>Brush ' + esc(nameOf(f, h)) + '</button>'; }).join('') + '</div>' +
      '<ul class="barnlist">' + rows + (treatedToday(S, 'hens', day) ? '<li><span class="ms">nutrition</span>The hens had a treat from the basket today.</li>' : '') + '</ul><div class="row" id="nestActs">' + (ready.length ? '<button type="button" class="btn primary" data-act="eggs"><span class="ms">egg</span>Collect ' + (ready.length > 1 ? 'the eggs' : 'the egg') + '</button>' : '') + treatButtons('hens') + '</div>' +
      pantryLine() + '<p class="help">The hens are fine on their own. An egg waits in the nest until you come by; the pantry holds 99 of each thing.</p>');
    wireRename(openNests);
    var hc = doc.getElementById('henCare');
    if (hc) hc.addEventListener('click', function (e) {
      var b = e.target.closest('[data-care]'); if (!b || !idle()) return;
      var who = b.dataset.who, act = b.dataset.care;
      if (act === 'pet') { petNow(who); openNests(); return; }
      step(hc, { ms: 2500, moment: 'brush', verb: 'Smoothing ' + NM(who) + '’s feathers…', cancel: openNests }, function () { var r = care(S, who, 'brush', today()); heartPop(who, r.ok && r.gained); if (r.ok && r.gained) R.toast(NM(who) + ' fluffs up happily. ' + r.n + ' of ' + B.LOVE_MAX + ' hearts.', 'favorite'); openNests(); });
    });
    var acts = doc.getElementById('nestActs'); if (!acts) return;
    acts.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]'); if (!btn || !idle()) return;
      if (btn.dataset.act === 'treat') { treatStep(acts, 'hens', btn, openNests); return; }
      if (ST && !ST.can('egg')) { R.toast('Not enough play energy for that just now. It comes back after a sleep saved from the bed, or with the new day.', 'bedtime'); return; }
      var seen = JSON.stringify(eggsReady(S, day));
      var lifts = [], putBack = function () { lifts.forEach(root.clearTimeout); lifts = []; renderBarn(); };
      step(acts, { ms: 2500, moment: 'eggs', verb: 'Lifting each egg from the straw…', stillLine: 'Notice the straw around each egg.', abort: putBack, cancel: openNests, start: function (ms, still) { Array.prototype.forEach.call(doc.querySelectorAll('#ownedProps .nestegg'), function (el, i) { lifts.push(root.setTimeout(function () { el.classList.add('lifted'); }, still ? 0 : (i + 0.5) * ms / 3)); }); } }, function () {
        if (today() !== day || JSON.stringify(eggsReady(S, day)) !== seen) { renderBarn(); openNests(); return; } /* the day turned or another tab collected */
        var r = collectEggs(S, day, ST); if (!r.ok) { R.toast(r.why, 'info'); renderBarn(); openNests(); return; }
        R.chime('save'); renderBarn(); R.toast(r.n + ' egg' + (r.n > 1 ? 's' : '') + ' in the pantry' + sizesLine(r.sizes) + '.', 'egg'); openNests();
      });
    });
  }
  function pailSVG() { return '<svg viewBox="0 0 80 70" aria-hidden="true"><path d="M18 20 Q40 6 62 20" fill="none" stroke="#9d86c4" stroke-width="4"/><defs><clipPath id="pailBody"><path d="M16 22 L64 22 L58 64 L22 64 Z"/></clipPath></defs><path d="M16 22 L64 22 L58 64 L22 64 Z" fill="#efe8fb" stroke="#9d86c4" stroke-width="3"/><g clip-path="url(#pailBody)"><rect class="pailmilk" x="10" y="30" width="60" height="40" fill="#fffaf2" style="transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(0.04)"/></g></svg>'; }
  function basketSVG() { return '<svg viewBox="0 0 90 90" aria-hidden="true"><ellipse cx="45" cy="72" rx="38" ry="12" fill="#7ad9d3" opacity=".6"/><g class="sbasket" style="transform-box:fill-box;transform-origin:50% 0%"><path d="M45 2 V22" stroke="#b9956a" stroke-width="3"/><path d="M26 26 L64 26 L58 48 L32 48 Z" fill="#d6b48a" stroke="#a37c52" stroke-width="3"/><path d="M28 34 H62 M30 41 H60" stroke="#a37c52" stroke-width="2"/></g><g class="ssteam" opacity="0"><path d="M30 60 q 4 -8 0 -16 q -4 -8 0 -16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/><path d="M58 62 q 4 -8 0 -16 q -4 -8 0 -16" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/></g></svg>'; }
  function sizesLine(sizes) { var k = Object.keys(sizes || {}); if (!k.length) return ''; return ' (' + k.map(function (s) { return (sizes[s] > 1 ? sizes[s] + ' ' : '') + s; }).join(', ') + ')'; }
  function openClover() {
    var day = today(), f = FM().farmState(S), cows = idsOf(f, 'cow'), ready = milkCows(S, day), has = ready.length > 0, r0 = RN() && RN().ranchOf(f);
    var treats = cows.filter(function (c) { return !isBaby(f, c, day); }).map(treatButtons).join('');
    var calfLine = r0 && r0.calf ? '<p class="help pantryline"><span class="ms">child_care</span>A calf is on the way, due ' + esc(r0.calf.due === day ? 'today' : 'in ' + Math.max(1, Math.round((Date.parse(r0.calf.due) - Date.parse(day)) / 86400000)) + ' days') + '.</p>' : '';
    R.openSheet('barnclover', cows.length > 1 ? 'The stalls' : nameOf(f, cows[0] || 'clover'), cows.map(function (c) { return nameOf(f, c); }).join(', ') || 'The cows', 'pets',
      cows.map(meter).join('') + '<div class="bedcard"><div class="bedpic pailpic">' + pailSVG() + '</div><div class="bedtext"><b>' + (has ? (ready.length > 1 ? ready.length + ' pails today' : nameOf(f, ready[0]) + ' has milk today') : (cows.length > 1 ? 'The cows are resting today' : nameOf(f, cows[0] || 'clover') + ' is resting today')) + '</b><span>' + (has ? (ready.length > 1 ? 'One pail each, when you are ready.' : 'One pail, when you are ready.') : 'A grown cow gives one pail on a new day.') + '</span></div></div><div class="row" id="cloverActs">' +
      (has ? '<button type="button" class="btn primary" data-act="milk"><span class="ms">water_full</span>' + (ready.length > 1 ? 'Milk the cows' : 'Milk ' + esc(nameOf(f, ready[0]))) + '</button>' : '') +
      cows.map(function (c) { return '<button type="button" class="btn soft" data-act="pet" data-who="' + c + '"' + (doneToday(S, c, 'pet', day) ? ' disabled' : '') + '><span class="ms">pan_tool</span>Pet ' + esc(nameOf(f, c)) + '</button>' + '<button type="button" class="btn ' + (has ? 'soft' : 'primary') + '" data-act="brush" data-who="' + c + '"' + (doneToday(S, c, 'brush', day) ? ' disabled' : '') + '><span class="ms">brush</span>Brush ' + esc(nameOf(f, c)) + '</button>'; }).join('') + treats + '</div>' +
      cows.filter(function (c) { return treatedToday(S, c, day); }).map(function (c) { return '<p class="help pantryline"><span class="ms">nutrition</span>' + esc(nameOf(f, c)) + ' had a treat from the basket today.</p>'; }).join('') + calfLine +
      pantryLine());
    wireRename(openClover);
    var acts = doc.getElementById('cloverActs'); if (!acts) return;
    acts.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]'); if (!btn || !idle()) return;
      var who = btn.dataset.who || cows[0] || 'clover';
      if (btn.dataset.act === 'treat') { treatStep(acts, who, btn, openClover); return; }
      if (btn.dataset.act === 'pet') { petNow(who); openClover(); return; }
      if (btn.dataset.act === 'brush') { step(acts, { ms: 3000, moment: 'brush', verb: 'Brushing slowly…', cancel: openClover }, function () { var r = care(S, who, 'brush', today()); heartPop(who, r.ok && r.gained); if (r.ok && r.gained) R.toast(NM(who) + ' leans into the brush. ' + r.n + ' of ' + B.LOVE_MAX + ' hearts.', 'favorite'); openClover(); }); return; }
      if (ST && !ST.can('milk')) { R.toast('Not enough play energy for that just now. It comes back after a sleep saved from the bed, or with the new day.', 'bedtime'); return; }
      step(acts, { ms: 3000, moment: 'milk', verb: 'Milking slowly…', stillLine: 'Notice how still she stands.', cancel: openClover, start: function (ms, still) { var m = doc.querySelector('#sheet .pailmilk'); if (m) root.requestAnimationFrame(function () { root.requestAnimationFrame(function () { m.style.transition = still ? 'none' : 'transform ' + ms + 'ms ease-in-out'; m.style.transform = 'scaleY(1)'; }); }); } }, function () {
        if (today() !== day || !milkReady(S, day)) { openClover(); return; }
        var r = milk(S, day, ST); if (!r.ok) { R.toast(r.why, 'info'); openClover(); return; }
        R.chime('save'); R.toast((r.n > 1 ? r.n + ' pails' : 'A pail') + ' of milk in the pantry' + sizesLine(r.sizes) + '.', 'water_full'); openClover();
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
  /* ---------- the ranch counter (Jamie, 22 Oct: buy a cow or a hen, bigger barn and coop, babies) ----------
   * Hearts pay for animals and room (OvuRewards.spend writes the hearts and the farm in one save). Babies come from an egg in
   * the incubator (3 days) or a cow at full love for a week (a calf), and take a place of their own while on the way. */
  function RW() { return root.OvuRewards; }
  function daysTo(d, day) { return Math.max(0, Math.round((Date.parse(d) - Date.parse(day)) / 86400000)); }
  function dueText(d, day) { var n = daysTo(d, day); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : 'in ' + n + ' days'; }
  /* naming a baby born here (the hatch line promises it): a short name, cleaned the way the ranch cleans names */
  function openName(who, reopen) {
    var f = FM().farmState(S), a = animalOf(f, who); if (!a || !RN()) return;
    R.openSheet('ranchname', 'A name for ' + (a.kind === 'cow' ? 'the calf' : 'the chick'), a.name, 'edit',
      '<div class="field"><label for="rnName">Name</label><input class="input" id="rnName" maxlength="16" value="' + esc(a.name === 'Calf' || a.name === 'Chick' ? '' : a.name) + '" placeholder="' + (a.kind === 'cow' ? 'Buttercup' : 'Pip') + '"></div>' +
      '<div class="row"><button type="button" class="btn primary" id="rnSave"><span class="ms">check</span>Keep this name</button><button type="button" class="btn ghost" id="rnBack">Back</button></div>');
    doc.getElementById('rnBack').addEventListener('click', function () { reopen(); });
    doc.getElementById('rnSave').addEventListener('click', function () {
      var nm = RN().cleanName(doc.getElementById('rnName').value); if (!nm) { R.toast('A name needs at least one letter.', 'info'); return; }
      var f1 = farm(S), r = RN().ranchOf(f1); r.herd.forEach(function (x) { if (x.id === who) x.name = nm; }); f1.ranch = r;
      try { save(S, f1, null); } catch (e) { R.toast('That could not be saved just now.', 'info'); return; }
      R.chime('save'); renderBarn(); reopen();
    });
  }
  function wireRename(reopen) { var body = doc.getElementById('sheetBody'); if (!body) return; body.addEventListener('click', function (e) { var b = e.target.closest('[data-rename]'); if (!b || !idle()) return; e.stopPropagation(); openName(b.dataset.rename, reopen); }); }
  function settle() { /* the ranch record exists, and due babies have arrived or grown: written only when something changed */
    var f0 = FM().farmState(S), f = farm(S);
    if (JSON.stringify(f.ranch || null) === JSON.stringify(f0.ranch || null)) return false;
    try { save(S, f, null); } catch (e) { return false; }
    try { /* a word from Erin and a line for what happened while the day turned */
      var n = RN().news(f0.ranch, f.ranch);
      n.born.forEach(function (a) { R.toast((a.kind === 'cow' ? 'Your calf is here.' : 'A little chick has hatched.') + ' Tap it to give it a name.', 'child_care'); if (R.erin) R.erin(a.kind === 'cow' ? 'ranch-born' : 'ranch-hatch'); });
      n.grown.forEach(function (a) { R.toast(a.name + ' is all grown up.', 'favorite'); if (R.erin) R.erin('ranch-grown'); });
    } catch (e) { }
    return true;
  }
  function openRanch() {
    var R0 = RN(); if (!R0) return;
    settle();
    var day = today(), f = FM().farmState(S), r = R0.ranchOf(f) || R0.ranchOf(R0.migrate(f, day)), hearts = RW() ? RW().ledger().hearts : 0, K = R0.KINDS, free = !!(RW() && RW().tester && RW().tester());
    function afford(cost) { return free || hearts >= cost; } /* tester mode pays nothing, as in every shop */
    var cows = idsOf(f, 'cow'), hens = idsOf(f, 'hen');
    function priceBtn(id, label, icon, cost, can, why) { return '<button type="button" class="btn ' + (can ? 'primary' : 'soft') + '" data-ranch="' + id + '"' + (can ? '' : ' disabled') + '><span class="ms">' + icon + '</span>' + label + ' · ' + cost + ' <span class="ms">favorite</span></button>' + (can || !why ? '' : '<small class="help">' + esc(why) + '</small>'); }
    var barnFull = R0.room(r, 'barn') < 1, coopFull = R0.room(r, 'coop') < 1;
    var html = '<p class="mintro">You have <b>' + hearts + '</b> hearts. Hearts come from logging, never from the ranch.</p>' +
      '<section class="ranchsec"><h4><span class="ms">cottage</span>The barn · ' + cows.length + ' of ' + R0.capacity(r, 'barn') + ' stalls' + (r.calf ? ', a calf on the way' : '') + '</h4>' +
      (r.barnLevel ? '' : priceBtn('upgrade:barn', 'Build a bigger barn (4 stalls)', 'carpenter', R0.UPGRADE_COST.barn, afford(R0.UPGRADE_COST.barn), 'You need ' + (R0.UPGRADE_COST.barn - hearts) + ' more hearts.')) +
      '<div class="field"><label for="rnCow">Name a new cow</label><input class="input" id="rnCow" maxlength="16" placeholder="Daisy"></div>' +
      priceBtn('buy:cow', 'Bring home a cow', 'pets', K.cow.cost, !barnFull && afford(K.cow.cost), barnFull ? 'The barn is full.' : 'You need ' + (K.cow.cost - hearts) + ' more hearts.') + '</section>' +
      '<section class="ranchsec"><h4><span class="ms">egg</span>The hen house · ' + hens.length + ' of ' + R0.capacity(r, 'coop') + ' places' + (r.incubator ? ', an egg in the incubator' : '') + '</h4>' +
      (r.coopLevel ? '' : priceBtn('upgrade:coop', 'Build a bigger hen house (6 places)', 'carpenter', R0.UPGRADE_COST.coop, afford(R0.UPGRADE_COST.coop), 'You need ' + (R0.UPGRADE_COST.coop - hearts) + ' more hearts.')) +
      '<div class="field"><label for="rnHen">Name a new hen</label><input class="input" id="rnHen" maxlength="16" placeholder="Pip"></div>' +
      priceBtn('buy:hen', 'Bring home a hen', 'egg', K.hen.cost, !coopFull && afford(K.hen.cost), coopFull ? 'The hen house is full.' : 'You need ' + (K.hen.cost - hearts) + ' more hearts.') + '</section>' +
      '<section class="ranchsec"><h4><span class="ms">child_care</span>Babies</h4>' +
      (r.incubator ? '<p class="help">An egg is warm in the incubator, due ' + esc(dueText(r.incubator.due, day)) + '. The chick grows up seven days after it hatches.</p>'
        : '<button type="button" class="btn soft" data-ranch="incubate"' + ((f.pantry.egg || 0) > 0 && !coopFull ? '' : ' disabled') + '><span class="ms">egg_alt</span>Put an egg in the incubator (hatches in 3 days)</button>' + ((f.pantry.egg || 0) > 0 ? '' : '<small class="help">Bring an egg from the hen house first.</small>') + (coopFull ? '<small class="help">The hen house is full.</small>' : '')) +
      (r.calf ? '<p class="help">A calf is on the way, due ' + esc(dueText(r.calf.due, day)) + '. It grows up in fourteen days.</p>'
        : cows.filter(function (c) { return !isBaby(f, c, day); }).map(function (c) { var due = R0.calfDue(f, c, day); return '<button type="button" class="btn soft" data-ranch="calf:' + c + '"' + (due && !barnFull ? '' : ' disabled') + '><span class="ms">child_care</span>Plan a calf with ' + esc(nameOf(f, c)) + (due ? ' · due ' + esc(dueText(due, day)) : '') + '</button>' + (due ? (barnFull ? '<small class="help">The barn needs a free stall first.</small>' : '') : '<small class="help">' + esc(nameOf(f, c)) + ' needs ten hearts of love, kept for a week.</small>'); }).join('')) + '</section>' +
      '<p class="help">Animals here never get sick or leave, and love never goes down. Babies make nothing until they grow up.</p>';
    R.openSheet('ranch', 'Ranch counter', 'Animals, and room for them', 'storefront', html);
    if (R.erin) R.erin('ranch-open');
    var body = doc.getElementById('sheetBody'); if (!body) return;
    body.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ranch]'); if (!b || !idle()) return;
      var act = b.dataset.ranch.split(':'), f1 = farm(S), res, what;
      if (act[0] === 'buy') { var nm = (doc.getElementById(act[1] === 'cow' ? 'rnCow' : 'rnHen') || {}).value; res = R0.buy(f1, act[1], nm, day); what = 'ranch:' + act[1]; }
      else if (act[0] === 'upgrade') { res = R0.upgrade(f1, act[1]); what = 'ranch:' + act[1] + '-upgrade'; }
      else if (act[0] === 'incubate') { res = R0.incubate(f1, null, day); }
      else if (act[0] === 'calf') { res = R0.startCalf(f1, act[1], day); }
      if (!res || !res.ok) { R.toast(res ? res.why : 'That could not be done.', 'info'); openRanch(); return; }
      try {
        if (res.cost) RW().spend(res.cost, what, { farm: res.farm }); else save(S, res.farm, null);
      } catch (err) { R.toast(err.message || 'That could not be saved just now.', 'info'); openRanch(); return; }
      R.chime('save');
      if (act[0] === 'buy') { R.toast(res.animal.name + ' has come to live here. ' + (act[1] === 'cow' ? 'Milk' : 'Eggs') + ' from tomorrow.', act[1] === 'cow' ? 'pets' : 'egg'); if (R.erin) R.erin('ranch-arrive'); }
      else if (act[0] === 'upgrade') { R.toast('More room, ready for a new arrival.', 'carpenter'); if (R.erin) R.erin('ranch-room'); }
      else if (act[0] === 'incubate') { R.toast('One egg, tucked into a warm nest. It hatches ' + dueText(res.due, day) + '.', 'egg_alt'); if (R.erin) R.erin('ranch-egg'); }
      else { R.toast('A calf is on the way, due ' + dueText(res.due, day) + '.', 'child_care'); if (R.erin) R.erin('ranch-calf'); }
      renderBarn(); openRanch();
    });
  }
  /* pretend onsen eggs: lower, watch the steam, lift; Stop anywhere changes nothing, the eggs change only at the end */
  function openBasket() {
    var f0 = FM().farmState(S), p = f0.pantry, n = cookable(f0);
    R.openSheet('springbasket', 'The spring basket', 'Pretend onsen eggs', 'egg',
      '<div class="bedcard"><div class="bedpic springpic">' + basketSVG() + '</div><div class="bedtext"><b>' + (n ? n + ' egg' + (n > 1 ? 's' : '') + ' to lower' : p.egg ? 'The pantry is full of onsen eggs' : 'No eggs yet') + '</b><span>' + (n ? 'The warm water does the rest.' : p.egg ? 'It holds 99, and they stay as they are: pretend food, kept on this device.' : 'Bring an egg from the hen house.') + '</span></div></div>' +
      '<div class="row" id="basketActs">' + (n ? '<button type="button" class="btn primary" data-act="cook"><span class="ms">egg</span>Make onsen eggs</button>' : '') + '</div>' +
      pantryLine() + '<p class="help">This is pretend cooking in a pretend spring. Nothing here changes your energy.</p>');
    var acts = doc.getElementById('basketActs'); if (!acts) return;
    acts.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]'); if (!btn || !idle()) return;
      var seen = JSON.stringify(FM().farmState(S).pantry), want = n;
      var anim = function (sel, prop, val, ms, still) { return function () { var el = doc.querySelector('#sheet ' + sel); if (el) root.requestAnimationFrame(function () { root.requestAnimationFrame(function () { el.style.transition = still ? 'none' : prop + ' ' + ms + 'ms ease-in-out'; el.style[prop] = val; }); }); }; };
      step(acts, { ms: 2500, moment: 'springlower', verb: 'Lowering the basket…', stillLine: 'Notice the glow of the water.', cancel: openBasket, start: function (ms, still) { anim('.sbasket', 'transform', 'translateY(26px)', ms, still)(); } }, function () {
        step(acts, { ms: 6000, moment: 'springsteam', verb: 'The eggs rest in the warm water…', stillLine: 'Notice the stars above the water.', cancel: openBasket, start: function (ms, still) { anim('.ssteam', 'opacity', '1', ms * 0.4, still)(); } }, function () {
          step(acts, { ms: 2500, moment: 'springlift', verb: 'Lifting the basket…', stillLine: 'Notice the glow of the water.', cancel: openBasket, start: function (ms, still) { anim('.ssteam', 'opacity', '0', ms, still)(); anim('.sbasket', 'transform', 'translateY(0)', ms, still)(); } }, function () {
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
      '<p>Your onsen egg' + (n > 1 ? 's are' : ' is') + ' in the pantry.</p>' + pantryLine() + '<p class="help">Only log food you really ate; these eggs stay in the game.</p>' +
      '<div class="row"><button type="button" class="btn primary" id="cookDone">Done</button><button type="button" class="btn ghost" id="cookDiary">Open food diary</button></div>');
    doc.getElementById('cookDone').addEventListener('click', function () { R.hideSheet(); });
    doc.getElementById('cookDiary').addEventListener('click', function () { R.hideSheet(); var a = doc.querySelector('nav a[data-tab="food"]'); if (a) a.click(); });
  }
  /* sitting by the water: her seated sprite on the warm stone, no breathing animation, no timer, no save, Stop any time */
  var sitting = null;
  function openStone() {
    if (root.OvuTones && root.OvuTones.openSpring) return root.OvuTones.openSpring(); /* since 21 Oct sitting by the water is the crystals’ tone (ovu-tones.js) */
    R.openSheet('warmstone', 'A warm stone', 'By the water', 'chair',
      '<p>Sit for as long as you like. Nothing is counted.</p><div class="row"><button type="button" class="btn primary" id="sitGo"><span class="ms">chair</span>Sit by the water</button></div>');
    doc.getElementById('sitGo').addEventListener('click', function () { R.hideSheet(); sitDown(); });
  }
  function sitDown() {
    if (sitting || !at('cave') || !idle()) return;
    var G = root.OvuGarden, el = doc.createElement('div'), outfit = (function (o) { return /^[a-z0-9-]{1,32}$/.test(o || '') ? o : 'base'; })(S.profile().outfit); /* an imported outfit name never becomes markup (Codex sweep, 21 Oct) */
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
  R.hotspotHandlers.ranchsign = handler('barn', openRanch);
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
    R.on('outfit', function () { if (sitting && sitting.el && root.OvuGarden && root.OvuGarden.reseat) root.OvuGarden.reseat(sitting.el, CAVE.seat); });
    var shown = null; /* which barn sheet is open, so a new day or another tab can redraw it as it is now */
    var SHEETS = { barnnests: openNests, barnclover: openClover, springbasket: openBasket, ranch: openRanch, ranchname: null };
    function redrawOpen() { var id = R.sheetId ? R.sheetId() : null; var fn = id && SHEETS[id]; if (!fn || !R.sheetOpen()) return; if (CARE && CARE.cancel) CARE.cancel(); fn(); } /* a name box left open keeps her typing */
    if (GT) GT.onNewDay(function () { settle(); renderBarn(); redrawOpen(); });
    root.setTimeout(function () { if (settle()) renderBarn(); }, 1200); /* a baby due while the app was closed arrives at boot */
    var key = JSON.stringify(S.state().farm || null);
    S.subscribe(function (reason) {
      if (reason === 'clear' || reason === 'import') { if (CARE && CARE.cancel) CARE.cancel(); key = JSON.stringify(S.state().farm || null); syncCrack(); renderBarn(); redrawOpen(); return; } /* the diary was replaced here: nothing pending survives it */
      if (reason === 'state') { key = JSON.stringify(S.state().farm || null); return; } /* our own saves move the baseline */
      if (!(reason === 'external' || String(reason).indexOf('sync') === 0)) return;
      var k = JSON.stringify(S.state().farm || null), wiped = !S.state().farm; if (k === key && !wiped) return; key = k; /* a wipe (Delete everything elsewhere) always counts */
      syncCrack(); renderBarn(); redrawOpen();
    });
  });
  B.openNests = openNests; B.openClover = openClover; B.openRanch = openRanch; B.settle = settle; B.openBasket = openBasket; B.openCrack = openCrack; B.openStone = openStone; B.sitDown = sitDown; B.renderBarn = renderBarn; B.syncCrack = syncCrack;
})(typeof window !== 'undefined' ? window : this);
