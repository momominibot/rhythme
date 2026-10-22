/* Rhythme farm: a plate behind the garden's path with twelve soil beds, a shed, a well and a basket. Seeds come free
 * from the shed (three a day), a bed grows by the real days it was watered (a missed day adds nothing and takes nothing
 * away), weeds appear on a couple of beds each morning and pause growth until pulled, and a ripe bed is harvested into
 * the basket. Watering, pulling and harvesting cost energy (ovu-stamina.js). Nothing here writes a diary entry: a
 * harvest offers "Log a meal?" and only a tap on that opens the food diary, which saves what she chooses to save.
 * Hearts are not awarded here (the ledger is ovu-rewards.js's), but they are spent here (Jamie, 20 Oct: logging earns
 * the points that let her play): a seed shelf and a big watering can in the shed; seed packs and local crops to grow for
 * good are sold at Hay & Harvest on Harbour Lane (ovu-lane.js, 21 Oct; Jamie, 19 Oct: "the avatar needs to go to the
 * grocery store to purchase seeds"), which also swaps three from the basket for one seed. The five first crops and three
 * seeds a day stay free, and tending what she has never costs hearts. Pure rules first (testable in node), then the
 * scene wiring. */
(function (root) {
  'use strict';
  var CROPS = {
    radish: { name: 'Radish', plural: 'radishes', days: 2, yield: 2, colour: '#e58fa8', top: '#8fcfae' },
    carrot: { name: 'Carrot', plural: 'carrots', days: 3, yield: 2, colour: '#f3a56e', top: '#7fb894' },
    strawberry: { name: 'Strawberry', plural: 'strawberries', days: 4, yield: 3, colour: '#e35d7a', top: '#6ba88a' },
    tomato: { name: 'Tomato', plural: 'tomatoes', days: 5, yield: 3, colour: '#e0624e', top: '#5f9c7a' },
    pumpkin: { name: 'Pumpkin', plural: 'pumpkins', days: 7, yield: 1, colour: '#f0a04b', top: '#6ba88a' },
    /* local crops, unlocked with hearts and then grown for good (Codex, 20 Oct: locally familiar crops for Singapore) */
    kangkong: { name: 'Kangkong', plural: 'bunches of kangkong', days: 2, yield: 3, colour: '#8fcf86', top: '#4f9a62', cost: 40 },
    pakchoy: { name: 'Pak choy', plural: 'pak choy', days: 3, yield: 3, colour: '#b5e0a0', top: '#5f9c6a', cost: 40 },
    lemongrass: { name: 'Lemongrass', plural: 'stalks of lemongrass', days: 4, yield: 3, colour: '#dfe6a0', top: '#8fbf6a', cost: 60, moved: 'greenhouse' }, /* grows in the greenhouse planters since 21 Oct (ovu-greenhouse.js); a farm that unlocked it keeps it */
    chilli: { name: 'Chilli padi', plural: 'chilli padi', days: 5, yield: 4, colour: '#e2483d', top: '#5f9c6a', cost: 70 },
    sweetpotato: { name: 'Sweet potato', plural: 'sweet potatoes', days: 6, yield: 2, colour: '#b0607e', top: '#7fb894', cost: 80 }
  };
  /* the crop's picture, drawn 22 Oct in the Ovuluna food style (assets/food/crop-*.webp; sweet potato reuses the food card) */
  function cropPic(k) { return '<img class="croppic" src="assets/food/' + (k === 'sweetpotato' ? 'sweet-potato' : 'crop-' + k) + '.webp" alt="">'; }
  var STARTER = ['radish', 'carrot', 'strawberry', 'tomato', 'pumpkin']; /* everyone has grown these from the start: never locked */
  var SEEDS_A_DAY = 3;
  var PACK = { seeds: 3, cost: 10 }; /* a seed pack: three seeds of a crop she can grow */
  var TOOLS = {
    shelf: { name: 'Seed shelf', note: '5 free seeds a day.', cost: 150, icon: 'shelves' },
    bigcan: { name: 'Big watering can', note: 'Waters every bed at once.', cost: 120, icon: 'water_drop' }
  };
  /* the bed grid on the plate: corner A (left), B (top), C (right); four beds along AB, three along BC */
  var A = { x: 24, y: 53 }, B = { x: 51, y: 41 }, C = { x: 81, y: 54 };
  function bedAt(i, j) { var u = (i + 0.5) / 4, v = (j + 0.5) / 3; return { x: round(A.x + u * (B.x - A.x) + v * (C.x - B.x)), y: round(A.y + u * (B.y - A.y) + v * (C.y - B.y)) }; }
  /* she tends a bed from the slab's margin: the front-left edge for the beds nearer it, the front-right edge otherwise */
  function standFor(i, j) {
    var u = (i + 0.5) / 4, v = (j + 0.5) / 3;
    if (i <= 2 - j) return { x: round(A.x - 0.3 * (B.x - A.x) + v * (C.x - B.x)), y: round(A.y - 0.3 * (B.y - A.y) + v * (C.y - B.y)), flip: false };
    return { x: round(A.x + u * (B.x - A.x) + 1.24 * (C.x - B.x)), y: round(A.y + u * (B.y - A.y) + 1.24 * (C.y - B.y)), flip: true };
  }
  function round(n) { return Math.round(n * 10) / 10; }
  var BEDS = []; for (var jj = 0; jj < 3; jj++) for (var ii = 0; ii < 4; ii++) BEDS.push({ id: 'bed' + (jj * 4 + ii + 1), i: ii, j: jj, at: bedAt(ii, jj), wp: standFor(ii, jj) });
  /* beds that share a stand point share one prompt, so the nearest prompt never shadows a bed: with several beds the prompt opens a picker */
  var STANDS = []; BEDS.forEach(function (b) { var k = b.wp.x + ',' + b.wp.y, st = STANDS.filter(function (s) { return s.key === k; })[0]; if (!st) { st = { id: 'stand' + (STANDS.length + 1), key: k, wp: b.wp, beds: [] }; STANDS.push(st); } st.beds.push(b.id); });
  var FARM = {
    id: 'farm', scene: 'farm', name: 'Your farm', img: 'farm-v1.webp', w: 1472, h: 1840, avatarW: 12, only: [],
    hotspots: [
      { id: 'farmgate', x: 13, y: 60, label: 'Gate · back to the garden', prompt: 'Tap to go back to the garden', icon: 'door_open', wp: { x: 19, y: 56, flip: true } },
      { id: 'shed', x: 18, y: 41, label: 'Shed · seeds and tools', prompt: 'Tap to open the shed', icon: 'home_repair_service', wp: { x: 25, y: 50, flip: true } },
      { id: 'well', x: 70, y: 38, label: 'Well · water for the can', prompt: 'Tap to draw water', icon: 'water_drop', wp: { x: 66, y: 48, flip: false } },
      { id: 'basket', x: 49, y: 69, label: 'Basket · your harvest', prompt: 'Tap to look in the basket', icon: 'shopping_basket', wp: { x: 41, y: 66, flip: false } },
      { id: 'barnpath', x: 83, y: 65, label: 'Path · to the barn', prompt: 'Tap to walk to the barn', icon: 'cottage', wp: { x: 79, y: 62, flip: false } }, /* the barn (ovu-barn.js), 21 Oct */
      { id: 'harboursteps', x: 72, y: 74, label: 'Steps · down to the harbour', prompt: 'Tap to go down to the harbour', icon: 'sailing', wp: { x: 70, y: 67, flip: false } } /* the harbour (ovu-harbour.js), 21 Oct */
    ],
    home: { x: 19, y: 56, flip: false },
    zones: [[[48, 30], [95, 52], [86, 61], [68, 70], [50, 74], [6, 56]]], /* the island; its lower-right shore bows out past the bed frame's path */
    solids: [{ id: 'shed', x0: 8, x1: 30, y0: 33, y1: 46 }, { id: 'well', x0: 62, x1: 76, y0: 33, y1: 46 }, { id: 'scarecrow', x0: 45, x1: 57, y0: 25, y1: 36 }, { id: 'tree', x0: 84, x1: 95, y0: 44, y1: 52 } /* the trunk; she may walk under the canopy, and the path to the well runs between the beds and the trunk */, { id: 'basket', x0: 42, x1: 56, y0: 65, y1: 72 },
      { id: 'beds1', x0: 30, x1: 50, y0: 48, y1: 58 }, { id: 'beds2', x0: 44, x1: 64, y0: 44, y1: 62 }, { id: 'beds3', x0: 60, x1: 78, y0: 50, y1: 58 }],
    doors: [{ id: 'farmgate', to: 'garden', x: 15, y: 57, r: 5, flip: true }, { id: 'barnpath', to: 'barn', x: 79, y: 62, r: 4, flip: false }, { id: 'harboursteps', to: 'harbour', x: 70, y: 67, r: 4, flip: false }],
    /* the beds are not hotspots (twelve orbs would smother the plate): they are drawn by this module and offered as prompts */
    prompts: STANDS.map(function (s) { return { id: s.id, wp: s.wp, beds: s.beds, prompt: s.beds.length > 1 ? 'Tap to tend the beds' : 'Tap to tend the bed', bed: true }; }),
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 }, props: {}
  };

  /* ---------- rules (no DOM) ---------- */
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  /* one canonical farm: fields this file does not know about (the barn's pantry, animals and places) are kept, and the
   * shared ones are validated, so an old action such as filling the can never drops the barn's things (Codex, 21 Oct) */
  var PANTRY = ['egg', 'milk', 'onsenegg'], ANIMALS = ['mochi', 'kaya', 'clover'], PLACES = ['cave'], PANTRY_CAP = 99;
  function counts(o, keys) { var out = {}; keys.forEach(function (k) { var n = Math.floor(Number(o && o[k])); out[k] = isFinite(n) && n > 0 ? Math.min(PANTRY_CAP, n) : 0; }); return out; }
  function dates(o, keys) { var out = {}; keys.forEach(function (k) { var d = o && o[k]; if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) out[k] = d; }); return out; }
  function farmState(S) {
    var f = S.state().farm || {};
    return Object.assign({}, f, { beds: f.beds || {}, harvest: f.harvest || {}, seeds: f.seeds || {}, seedsByDay: f.seedsByDay || {}, unlocked: f.unlocked || {}, tools: f.tools || {}, can: f.can || 0, guided: !!f.guided,
      pantry: counts(f.pantry, PANTRY), animals: dates(f.animals, ANIMALS), found: dates(f.found, PLACES) });
  }
  function canGrow(f, crop) { return !!CROPS[crop] && (STARTER.indexOf(crop) > -1 || !!(f.unlocked && f.unlocked[crop])); }
  function growable(f) { return Object.keys(CROPS).filter(function (k) { return canGrow(f, k); }); }
  function seedsADay(f) { return SEEDS_A_DAY + (f.tools && f.tools.shelf ? 2 : 0); }
  function bed(S, id) { return farmState(S).beds[id] || null; }
  function growthDays(b) { return b && b.crop ? (b.watered || []).length : 0; }
  function ripe(b) { return !!(b && b.crop && CROPS[b.crop] && growthDays(b) >= CROPS[b.crop].days); }
  function stage(b) { if (!b || !b.crop) return 0; var n = growthDays(b), need = CROPS[b.crop].days; if (ripe(b)) return 3; if (n >= Math.ceil(need / 2)) return 2; if (n >= 1) return 1; return 0; }
  /* weeds: two beds in twelve on an average morning, the same ones all day on every phone; pulled ones stay clear that day */
  function hasWeeds(b, id, day) { if (b && b.cleared === day) return false; return hash(day + ':' + id) % 6 === 0; }
  function wateredToday(b, day) { return !!(b && (b.watered || []).indexOf(day) > -1); }
  /* the shed remembers each date it gave seeds on, so a clock that goes back to a claimed date gives nothing twice */
  function seedsLeftToday(S, day) { var f = farmState(S); return Math.max(0, seedsADay(f) - (f.seedsByDay[day] || 0)); }
  function write(S, f) { S.setState({ farm: f }); }
  function takeSeed(S, crop, day) {
    if (!CROPS[crop]) return { ok: false, why: 'unknown crop' };
    var f = copy(farmState(S)), taken = f.seedsByDay[day] || 0;
    if (!canGrow(f, crop)) return { ok: false, why: CROPS[crop].name + ' is not in the shed yet. Hay & Harvest on Harbour Lane sells it.' };
    if (taken >= seedsADay(f)) return { ok: false, why: 'The shed has given out its seeds for today. More tomorrow.' };
    f.seedsByDay[day] = taken + 1; f.seeds[crop] = (f.seeds[crop] || 0) + 1;
    Object.keys(f.seedsByDay).forEach(function (k) { if (k < S.addDays(day, -30)) delete f.seedsByDay[k]; }); /* a month of dates is plenty */
    /* Both the seed and its allowance stay unused if storage refuses the claim. */
    try { if (S.commit) S.commit({ farm: f }); else write(S, f); } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; }
    return { ok: true, left: seedsADay(f) - f.seedsByDay[day] };
  }
  function plant(S, id, crop, day, ST) {
    var f = copy(farmState(S)), b = f.beds[id];
    if (!CROPS[crop]) return { ok: false, why: 'unknown crop' };
    if (b && b.crop) return { ok: false, why: 'This bed already has ' + CROPS[b.crop].name.toLowerCase() + ' in it.' };
    if (hasWeeds(b, id, day)) return { ok: false, why: 'Pull the weeds first.' };
    if (!(f.seeds[crop] > 0)) return { ok: false, why: 'No ' + CROPS[crop].name.toLowerCase() + ' seeds left. The shed gives ' + seedsADay(f) + ' a day, and Hay & Harvest by the harbour sells packs.' };
    f.seeds[crop] -= 1; f.beds[id] = { crop: crop, planted: day, watered: [], cleared: b && b.cleared === day ? day : undefined };
    try { var sv = save(S, f, ST, 'plant'); if (!sv.ok) return sv; return { ok: true, charged: sv.charged }; } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; } /* the seed, the bed and the energy land together or not at all (Codex, 21 Oct) */
  }
  /* the bed's own rule on a farm object (no save): weeds, the planting date and once a day */
  function waterBed(f, id, day) {
    var b = f.beds[id];
    if (!b || !b.crop) return { ok: false, why: 'Nothing is planted here yet.' };
    if (hasWeeds(b, id, day)) return { ok: false, why: 'Pull the weeds first; watered weeds only grow.' };
    if (b.planted && day < b.planted) return { ok: false, why: 'The date is earlier than the planting. Check the phone\u2019s clock.' };
    var lastW = (b.watered || []).slice(-1)[0]; if (lastW && day <= lastW) return { ok: false, why: 'Watered already today. Tomorrow counts again.' }; /* a date before the last watering counts as today: the clock went back */
    b.watered = (b.watered || []).concat([day]); return { ok: true, days: b.watered.length, ripe: ripe(b) };
  }
  /* a free shed seed planted straight into a bed: both rules run on one copy and are saved once, so a refused planting
   * never uses up a seed of the day (Codex review, 20 Oct) */
  function plantFromShed(S, id, crop, day, ST) {
    var fc = copy(S.state().farm || {}), shadow = { state: function () { return { farm: fc }; }, setState: function (o) { if (o.farm) fc = o.farm; }, addDays: S.addDays };
    var got = takeSeed(shadow, crop, day); if (!got.ok) return got;
    var r = plant(shadow, id, crop, day); if (!r.ok) return r;
    try { var sv = save(S, fc, ST, 'plant'); if (!sv.ok) return sv; r.charged = sv.charged; } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; }
    return r;
  }
  function water(S, id, day) { var f = farmState(S), r = waterBed(f, id, day); if (r.ok) write(S, f); return r; }
  /* the watering can (Jamie, 20 Oct: "I can't fill the watering can"): she draws water at the well, and each bed she waters
   * takes one pour from the can. The can holds three pours, the big can twelve (one for every bed). Water stays in the can
   * overnight. Drawing water is free; a pour costs the energy of a watering, charged in the same save as the bed and the
   * can, so a failed save changes nothing (the big can's rule, Codex review 20 Oct). */
  var CAN = 3, BIG_CAN = 12;
  function canCap(f) { return f.tools && f.tools.bigcan ? BIG_CAN : CAN; }
  function canLevel(S) { var f = farmState(S); return Math.max(0, Math.min(canCap(f), Math.floor(Number(f.can) || 0))); }
  function save(S, f, ST, action) {
    if (ST && ST.spendWith) { if (!ST.spendWith(action, { farm: f })) return { ok: false, why: 'Not enough play energy for that just now. It comes back after a sleep saved from the bed, or with the new day.' }; return { ok: true, charged: true }; }
    if (S.commit) S.commit({ farm: f }); else S.setState({ farm: f });
    return { ok: true, charged: false };
  }
  function fillCan(S) {
    var f = copy(farmState(S)), cap = canCap(f); if (canLevel(S) >= cap) return { ok: false, why: 'The can is already full.' };
    f.can = cap; try { if (S.commit) S.commit({ farm: f }); else write(S, f); } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; } /* commit: a failed save leaves memory as it was (Codex, 20 Oct) */
    return { ok: true, n: cap };
  }
  function pour(S, id, day, ST) {
    var level = canLevel(S); if (level < 1) return { ok: false, empty: true, why: 'The can is empty. Draw water at the well first.' };
    var f = copy(farmState(S)), r = waterBed(f, id, day); if (!r.ok) return r;
    f.can = level - 1;
    try { var sv = save(S, f, ST, 'water'); if (!sv.ok) return sv; r.charged = sv.charged; } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; }
    r.left = f.can; return r;
  }

  function clearWeeds(S, id, day, ST) {
    var f = copy(farmState(S)), b = f.beds[id] || {};
    if (!hasWeeds(b, id, day)) return { ok: false, why: 'No weeds here.' };
    b.cleared = day; f.beds[id] = b;
    try { var sv = save(S, f, ST, 'clear'); if (!sv.ok) return sv; return { ok: true, charged: sv.charged }; } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; }
  }
  function harvest(S, id, ST) {
    var f = copy(farmState(S)), b = f.beds[id];
    if (!ripe(b)) return { ok: false, why: b && b.crop ? 'Not ripe yet.' : 'Nothing to harvest.' };
    var crop = b.crop, n = CROPS[crop].yield;
    f.harvest[crop] = (f.harvest[crop] || 0) + n; f.beds[id] = { cleared: b.cleared };
    try { var sv = save(S, f, ST, 'harvest'); if (!sv.ok) return sv; return { ok: true, crop: crop, n: n, total: f.harvest[crop], charged: sv.charged }; } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; }
  }
  /* ---------- spending hearts (RW is OvuRewards): the farm and the hearts are written in one save ---------- */
  function copy(f) { return JSON.parse(JSON.stringify(f)); }
  function pay(RW, cost, what, f) { try { RW.spend(cost, what, { farm: f }); return { ok: true }; } catch (e) { return { ok: false, why: e.message }; } }
  function buyPack(S, RW, crop) {
    var f = copy(farmState(S)); if (!canGrow(f, crop)) return { ok: false, why: CROPS[crop] ? 'Unlock ' + CROPS[crop].name.toLowerCase() + ' first.' : 'unknown crop' };
    f.seeds[crop] = (f.seeds[crop] || 0) + PACK.seeds;
    var r = pay(RW, PACK.cost, 'seeds:' + crop, f); if (!r.ok) return r; return { ok: true, n: PACK.seeds, have: f.seeds[crop] };
  }
  function unlockCrop(S, RW, crop) {
    var c = CROPS[crop], f = copy(farmState(S));
    if (!c || STARTER.indexOf(crop) > -1) return { ok: false, why: 'That one is free already.' };
    if (f.unlocked[crop]) return { ok: false, why: 'Already growing in your shed.' };
    if (c.moved) return { ok: false, why: c.name + ' grows in the greenhouse now. Hay & Harvest sells it for the planters.' };
    f.unlocked[crop] = true; f.seeds[crop] = (f.seeds[crop] || 0) + 1; /* one seed to start */
    var r = pay(RW, c.cost, 'crop:' + crop, f); if (!r.ok) return r; return { ok: true, crop: crop };
  }
  /* the grocer's seed swap (Harbour Lane, 21 Oct; farm-loop design section 1): three from the basket for one seed of a crop
   * she can grow, a pumpkin counting as three. No hearts change hands either way, so a harvest never turns into hearts and a
   * quiet logging week never stops the farm. One save: the basket and the seed move together or not at all. */
  var SWAP = 3;
  function swapWorth(crop) { return crop === 'pumpkin' ? 3 : 1; }
  function swapNeed(crop) { return Math.ceil(SWAP / swapWorth(crop)); }
  function swapGivable(S) { var f = farmState(S); return Object.keys(CROPS).filter(function (k) { return (f.harvest[k] || 0) >= swapNeed(k); }); }
  function swapSeed(S, give, crop) {
    var f = copy(farmState(S));
    if (!CROPS[give] || !CROPS[crop]) return { ok: false, why: 'unknown crop' };
    if (!canGrow(f, crop)) return { ok: false, why: CROPS[crop].name + ' is not growing on your farm yet.' };
    var need = swapNeed(give), have = f.harvest[give] || 0;
    if (have < need) return { ok: false, why: 'The swap takes ' + need + ' ' + (need === 1 ? CROPS[give].name.toLowerCase() : CROPS[give].plural) + '. The basket has ' + have + '.' };
    f.harvest[give] = have - need; if (!f.harvest[give]) delete f.harvest[give];
    f.seeds[crop] = (f.seeds[crop] || 0) + 1;
    try { if (S.commit) S.commit({ farm: f }); else write(S, f); } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; }
    return { ok: true, give: give, gave: need, crop: crop, have: f.seeds[crop] };
  }
  function buyTool(S, RW, id) {
    var t = TOOLS[id], f = copy(farmState(S));
    if (!t) return { ok: false, why: 'unknown tool' };
    if (f.tools[id]) return { ok: false, why: 'Already yours.' };
    f.tools[id] = true; var r = pay(RW, t.cost, 'tool:' + id, f); if (!r.ok) return r; return { ok: true, tool: id };
  }
  /* the big watering can: every planted, weed-free bed not yet watered today gets its day, for the energy of one watering */
  /* the beds a big-can watering reaches: the one she is looking at first, then the rest in order, as far as the water goes */
  function bulkTargets(S, day, first, n) { var d = dryBeds(S, day); if (first && d.indexOf(first) > -1) d = [first].concat(d.filter(function (x) { return x !== first; })); return d.slice(0, Math.max(0, n)); }
  function dryBeds(S, day) { var f = farmState(S); return BEDS.filter(function (bb) { var b = f.beds[bb.id]; return b && b.crop && !ripe(b) && !hasWeeds(b, bb.id, day) && !wateredToday(b, day) && !(b.planted && day < b.planted) && !((b.watered || []).slice(-1)[0] >= day); }).map(function (bb) { return bb.id; }); }
  /* every dry bed gets its day on a copy, and the copy is written once: with ST (OvuStamina) the energy of one watering is
   * charged in the same save, so a failed save waters nothing and charges nothing (Codex review, 20 Oct) */
  function waterAll(S, day, ST, opt) {
    var f = copy(farmState(S)); if (!f.tools.bigcan) return { ok: false, why: 'The big watering can is in the shed, for hearts.' };
    var ids = dryBeds(S, day); if (!ids.length) return { ok: false, why: 'Every bed has had its water today.' };
    if (opt && opt.ids) { if (!opt.ids.length || opt.ids.some(function (id) { return ids.indexOf(id) < 0; })) return { ok: false, changed: true, why: 'The beds changed in the meantime. Have another look.' }; ids = opt.ids.slice(); } /* exactly the beds she was shown */
    if (opt && opt.can) { var lv = canLevel(S); if (lv < 1) return { ok: false, empty: true, why: 'The can is empty. Draw water at the well first.' }; if (opt.ids && ids.length > lv) return { ok: false, changed: true, why: 'There is less water in the can now. Have another look.' }; ids = ids.slice(0, lv); f.can = lv - ids.length; } /* one pour a bed, as far as the water goes */
    ids.forEach(function (id) { var b = f.beds[id]; b.watered = (b.watered || []).concat([day]); });
    var charged = false;
    try {
      if (ST && ST.spendWith) { if (!ST.spendWith('water', { farm: f })) return { ok: false, why: 'Not enough play energy for that just now. It comes back after a sleep saved from the bed, or with the new day.' }; charged = true; }
      else if (S.commit) S.commit({ farm: f }); else S.setState({ farm: f }); /* an older energy module: the caller charges the watering itself */
    } catch (e) { return { ok: false, why: e.message }; }
    return { ok: true, n: ids.length, charged: charged };
  }
  function summary(S, day) {
    var f = farmState(S), out = { planted: 0, ripe: 0, weeds: 0, dry: 0, harvest: f.harvest, seeds: f.seeds, seedsLeft: seedsLeftToday(S, day) };
    BEDS.forEach(function (bb) { var b = f.beds[bb.id]; if (hasWeeds(b, bb.id, day)) out.weeds++; if (b && b.crop) { out.planted++; if (ripe(b)) out.ripe++; else if (!wateredToday(b, day)) out.dry++; } });
    return out;
  }

  var F = { cropPic: cropPic, PANTRY: PANTRY, ANIMALS: ANIMALS, PANTRY_CAP: PANTRY_CAP, CROPS: CROPS, STARTER: STARTER, PACK: PACK, TOOLS: TOOLS, canGrow: canGrow, growable: growable, seedsADay: seedsADay, buyPack: buyPack, unlockCrop: unlockCrop, buyTool: buyTool, SWAP: SWAP, swapWorth: swapWorth, swapNeed: swapNeed, swapGivable: swapGivable, swapSeed: swapSeed, dryBeds: dryBeds, waterAll: waterAll, CAN: CAN, BIG_CAN: BIG_CAN, canCap: canCap, canLevel: canLevel, fillCan: fillCan, pour: pour, plantFromShed: plantFromShed, bulkTargets: bulkTargets, BEDS: BEDS, STANDS: STANDS, LAYOUT: FARM, SEEDS_A_DAY: SEEDS_A_DAY, bedAt: bedAt, standFor: standFor, farmState: farmState, bed: bed, growthDays: growthDays, ripe: ripe, stage: stage, hasWeeds: hasWeeds, wateredToday: wateredToday, seedsLeftToday: seedsLeftToday, takeSeed: takeSeed, plant: plant, water: water, clearWeeds: clearWeeds, harvest: harvest, summary: summary, hash: hash };
  root.OvuFarm = F;

  /* ---------- scene wiring ---------- */
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, ST = root.OvuStamina, GT = root.OvuGameTime, Z = root.OvuZones, doc = root.document;
  if (!R || !S || !doc || !Z) return;
  var ART = R.ART;
  function today() { return GT ? GT.dayKey() : S.today(); }
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inFarm(L) { return !!L && L.id === 'farm'; }
  Z.register(FARM, { label: 'Farm', icon: 'agriculture', after: 'garden' });

  /* each bed is drawn on top of the plate as a small SVG: soil, sprouts, fruit, weeds, a drop when watered today */
  function bedSVG(b, id, day) {
    var s = '<svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    var st = stage(b), weeds = hasWeeds(b, id, day), wet = wateredToday(b, day), crop = b && b.crop ? CROPS[b.crop] : null;
    if (wet) s += '<ellipse cx="50" cy="44" rx="30" ry="12" fill="rgba(70,50,120,.22)"/>';
    if (weeds) { [22, 48, 74].forEach(function (x, k) { s += '<path d="M' + x + ' 50 c -4 -8, -2 -14, 2 -18 M' + x + ' 50 c 4 -8, 7 -12, 10 -14 M' + x + ' 50 c -1 -10, 3 -16, 5 -20" stroke="#6f9a62" stroke-width="3" fill="none" stroke-linecap="round"/>'; }); }
    if (crop && st >= 1) {
      var xs = st >= 2 ? [26, 50, 74] : [50];
      xs.forEach(function (x) {
        var h = st === 1 ? 10 : st === 2 ? 20 : 24;
        s += '<path d="M' + x + ' 48 v -' + h + '" stroke="' + crop.top + '" stroke-width="3.5" stroke-linecap="round"/>';
        s += '<path d="M' + x + ' ' + (48 - h * 0.6) + ' c -9 -2, -12 -10, -10 -15 c 7 2, 10 8, 10 15 Z" fill="' + crop.top + '"/><path d="M' + x + ' ' + (48 - h * 0.75) + ' c 9 -2, 12 -9, 10 -14 c -7 2, -10 8, -10 14 Z" fill="' + crop.top + '" opacity=".85"/>';
        if (st === 3) s += '<circle cx="' + x + '" cy="' + (48 - h * 0.3) + '" r="7" fill="' + crop.colour + '"/><circle cx="' + (x - 2) + '" cy="' + (48 - h * 0.3 - 2) + '" r="2" fill="rgba(255,255,255,.6)"/>';
      });
    }
    return s + '</svg>';
  }
  function renderBeds() {
    if (!inFarm(R.layout())) return;
    var wrap = R.els.props, day = today();
    Array.prototype.slice.call(wrap.querySelectorAll('.bed')).forEach(function (el) { el.remove(); });
    var f = farmState(S);
    BEDS.forEach(function (bb) {
      var el = doc.createElement('button'); el.type = 'button'; el.className = 'bed'; el.dataset.id = bb.id;
      var b = f.beds[bb.id], label = 'Bed ' + (BEDS.indexOf(bb) + 1) + ': ' + (b && b.crop ? CROPS[b.crop].name.toLowerCase() + (ripe(b) ? ', ripe' : ', growing, ' + growthDays(b) + ' of ' + CROPS[b.crop].days + ' watered days' + (wateredToday(b, day) ? ', watered today' : ', not watered today')) : 'empty');
      el.setAttribute('aria-label', label + (hasWeeds(b, bb.id, day) ? ', weeds' : ''));
      el.style.left = bb.at.x + '%'; el.style.top = bb.at.y + '%'; el.style.width = '8.5%';
      el.innerHTML = bedSVG(b, bb.id, day);
      el.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); goTend(bb); });
      wrap.appendChild(el);
    });
  }

  /* ---------- mindful care (Jamie, 20 Oct: "instil mindfulness to farming") ----------
   * Each care step is done slowly, on purpose: a line to notice, a soft bar that fills once (it never pulses, so it is
   * not a breathing pacer), and Stop, which changes nothing. The step is saved only when the bar is full and the sheet is
   * still open; closing the sheet halfway saves nothing and costs nothing. F.slowMs = 0 runs steps at once (tests). */
  /* the care step itself lives in ovu-care.js (shared with the barn and the spring); the farm's steps belong to the farm */
  function liveSlow() { return root.OvuCare && root.OvuCare.live ? root.OvuCare.live() : null; }
  function cancelSlow() { if (root.OvuCare && root.OvuCare.cancel) root.OvuCare.cancel(); }
  function slowStep(box, o, done) {
    if (!root.OvuCare || !root.OvuCare.step) { done(); return; }
    root.OvuCare.step(box, Object.assign({}, o, { scene: 'farm', ms: F.slowMs == null ? o.ms : F.slowMs }), done);
  }
  /* the can, drawn with its water: a little lilac can whose water rises with the pours left */
  function canSVG(level, cap) {
    return '<svg viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><clipPath id="canBody"><rect x="20" y="16" width="34" height="34" rx="6"/></clipPath></defs>' +
      '<path d="M54 26 L72 14" stroke="#9d86c4" stroke-width="5" stroke-linecap="round"/><ellipse cx="73" cy="13" rx="4" ry="3" fill="#9d86c4"/>' +
      '<path d="M26 16 C 26 4, 48 4, 48 16" fill="none" stroke="#9d86c4" stroke-width="4"/>' +
      '<rect x="20" y="16" width="34" height="34" rx="6" fill="#efe8fb" stroke="#9d86c4" stroke-width="3"/>' +
      '<g clip-path="url(#canBody)"><g class="canwater" style="transform-box:fill-box;transform-origin:50% 100%;transform:scaleY(' + (cap ? (level / cap).toFixed(3) : 0) + ')"><rect x="20" y="20" width="34" height="30" fill="#8fc6ea"/><path d="M20 21 q 8.5 -3 17 0 t 17 0" stroke="#d8f0ff" stroke-width="2" fill="none"/></g></g></svg>';
  }
  function dots(level, cap) { if (cap > 3) return level + ' of ' + cap; var s = ''; for (var i = 0; i < cap; i++) s += '<i class="' + (i < level ? 'on' : '') + '"></i>'; return s; }
  /* the can on screen, on the farm only: how many pours are left; a tap walks her to the well */
  var canEl = null, shown = null, farmKey = ''; /* the farm sheet on screen, so an outside change can redraw it */
  function renderCan() {
    var on = inFarm(R.layout());
    if (!on) { if (canEl) { canEl.remove(); canEl = null; } return; }
    if (!canEl) {
      canEl = doc.createElement('button'); canEl.type = 'button'; canEl.className = 'farmcan'; canEl.id = 'farmCan';
      canEl.addEventListener('click', function (e) { e.stopPropagation(); goWell(); });
      R.els.scene.appendChild(canEl);
    }
    var f = farmState(S), cap = canCap(f), lv = canLevel(S);
    canEl.classList.toggle('empty', lv < 1);
    canEl.setAttribute('aria-label', 'Watering can, ' + lv + ' of ' + cap + ' pours. Tap to go to the well.');
    canEl.innerHTML = '<span class="ms">water_drop</span><b>Can</b><span class="cdots">' + dots(lv, cap) + '</span>';
  }
  function wellHot() { return FARM.hotspots.filter(function (h) { return h.id === 'well'; })[0]; }
  function goWell(back) {
    if ((W.napping && W.napping()) || liveSlow()) return;
    if (R.sheetOpen()) R.hideSheet(); /* an open sheet counts as busy: close it, then ask again */
    if (R.busy()) return;
    R.walkTo(wellHot().wp, function () { openWell(back); });
  }
  function bedNo(id) { var bb = BEDS.filter(function (x) { return x.id === id; })[0]; return bb ? BEDS.indexOf(bb) + 1 : ''; }
  function openWell(back, justFilled) {
    interacted = true; shown = { kind: 'well', arg: back };
    var f = farmState(S), cap = canCap(f), lv = canLevel(S), full = lv >= cap;
    var html = '<div class="bedcard"><div class="bedpic canpic">' + canSVG(lv, cap) + '</div><div class="bedtext"><b>' + (justFilled ? 'The can is full' : full ? 'The can is full' : lv ? 'Top up the can' : 'The can is empty') + '</b>' +
      '<span>' + lv + ' of ' + cap + ' pours. One pour waters one bed for the day.</span></div></div>' +
      '<div class="row" id="wellActs">' + (full ? '' : '<button type="button" class="btn primary" data-well="draw"><span class="ms">water_drop</span>Draw water</button>') +
      (back && lv ? '<button type="button" class="btn ' + (full ? 'primary' : 'soft') + '" data-well="back"><span class="ms">yard</span>Back to bed ' + bedNo(back) + '</button>' : '') +
      (!back && lv ? '<button type="button" class="btn ' + (full ? 'primary' : 'soft') + '" data-well="beds"><span class="ms">yard</span>Choose a bed</button>' : '') + '</div>' +
      '<p class="help">Drawing water is free, and water stays in the can until you pour it.</p>';
    R.openSheet('farmwell', 'The well', 'Water for the can', 'water_drop', html);
    var acts = doc.getElementById('wellActs'); if (!acts) return;
    acts.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-well]'); if (!btn) return;
      if (btn.dataset.well === 'beds') { R.hideSheet(); R.toast('Tap a bed to water it.', 'yard'); return; }
      if (btn.dataset.well === 'back') { var bb = BEDS.filter(function (x) { return x.id === back; })[0]; R.hideSheet(); if (bb) goTend(bb); return; }
      slowStep(acts, { ms: 3000, moment: 'well', verb: 'Drawing water slowly…', cancel: function () { openWell(back); }, start: function (ms, still) { var wv = doc.querySelector('#sheet .canpic .canwater'); if (wv) root.requestAnimationFrame(function () { root.requestAnimationFrame(function () { wv.style.transition = still ? 'none' : 'transform ' + ms + 'ms ease-in-out'; wv.style.transform = 'scaleY(1)'; }); }); } }, function () {
        var r = fillCan(S); if (!r.ok) { R.toast(r.why, 'info'); openWell(back); return; }
        R.chime('save'); renderCan(); openWell(back, true);
      });
    });
  }
  /* the guide waits until she stands still with nothing open (a sheet would stop her walk), and is skipped once she has
   * opened the well, a bed or the shed herself: she has found her way, and How the farm works stays one tap away */
  var interacted = false;
  function maybeGuide(n) {
    root.setTimeout(function () {
      if (interacted || farmState(S).guided || !inFarm(R.layout())) return;
      var moving = (W.walking && W.walking()) || (W.travelling && W.travelling()) || (R.els.avatar && R.els.avatar.classList.contains('walking')); /* reduced motion walks without the class (Codex round two) */
      if (moving || R.sheetOpen() || R.busy()) { if (n < 20) maybeGuide(n + 1); return; }
      openGuide();
    }, 1400);
  }
  /* the first visit: four steps, once (kept in the farm on this phone) */
  function openGuide() {
    var steps = [['spa', 'Seeds', 'The shed gives free seeds each day. You can also tap an empty bed and plant straight away.'],
      ['water_drop', 'Water', 'Draw water at the well. The can holds ' + (canCap(farmState(S)) > CAN ? 'twelve pours' : 'three pours') + ', one for each bed.'],
      ['yard', 'Tend', 'Water each planted bed once a day. Pull any weeds first. Crops wait safely, so you need not tend every bed every day.'],
      ['shopping_basket', 'Pick', 'When a bed is ripe, harvest it into the basket. Some of it is treats for the barn animals; the rest is yours to admire.']];
    R.openSheet('farmguide', 'Your farm', 'How it works', 'agriculture',
      '<ol class="farmsteps">' + steps.map(function (s) { return '<li><span class="ms">' + s[0] + '</span><span><b>' + s[1] + '</b><small>' + s[2] + '</small></span></li>'; }).join('') + '</ol>' +
      '<p class="mindline"><span class="ms">spa</span><span>Each step here is slow on purpose. Notice the soil, the water and the weight of what you pick.</span></p>' +
      '<div class="row"><button type="button" class="btn primary" id="guideGo">Begin</button></div>');
    var f = copy(farmState(S)); if (!f.guided) { f.guided = true; try { write(S, f); } catch (e) { } }
    var go = doc.getElementById('guideGo'); if (go) go.addEventListener('click', function () { R.hideSheet(); });
  }
  /* a logged sleep stops the farm with the room's own words (napping toasts); any other busy state stays quiet */
  function goTend(bb) {
    if ((W.napping && W.napping()) || R.busy() || liveSlow()) return;
    R.walkTo(bb.wp, function () { openBed(bb.id); });
  }
  /* energy: checked before the rule runs, charged only when the rule says yes, so a refused action costs nothing */
  function canAct(name) { if (!ST || ST.can(name)) return true; R.toast('Not enough play energy for that just now. It comes back after a sleep saved from the bed, or with the new day.', 'bedtime'); return false; }
  function act(name) { return !ST || ST.spend(name, true); }
  var lastBed = null;
  function openBed(id) {
    var bb = BEDS.filter(function (x) { return x.id === id; })[0]; if (!bb) return;
    lastBed = id; interacted = true; shown = { kind: 'bed', arg: id };
    var day = today(), b = bed(S, id), f = farmState(S), weeds = hasWeeds(b, id, day), crop = b && b.crop ? CROPS[b.crop] : null;
    var html = '<div class="bedcard"><div class="bedpic">' + bedSVG(b, id, day) + '</div><div class="bedtext">';
    if (crop) {
      html += '<b>' + esc(crop.name) + '</b><span>' + (ripe(b) ? 'Ripe and ready to pick.' : growthDays(b) + ' of ' + crop.days + ' watered days. ' + (wateredToday(b, day) ? 'Watered today.' : 'Not watered yet today.')) + '</span>';
      if (!ripe(b) && !wateredToday(b, day)) html += '<span class="canline"><span class="ms">water_drop</span>Can: ' + (canLevel(S) ? canLevel(S) + ' of ' + canCap(f) + ' pours' : 'empty') + '</span>';
    } else {
      /* an empty bed plants straight from today's shed seeds too (Jamie, 20 Oct: "where is the shed?"): no trip needed */
      var own = Object.keys(CROPS).some(function (k) { return (f.seeds[k] || 0) > 0; }), left = seedsLeftToday(S, day);
      html += '<b>An empty bed</b><span>' + (own ? 'Plant one of your seeds.' : left ? 'Pick a seed to plant. The shed gives ' + seedsADay(f) + ' a day; ' + left + ' left today.' : 'No free seeds left today. The shed has more tomorrow, and Hay & Harvest by the harbour sells packs.') + '</span>';
    }
    if (weeds) html += '<span class="weedy">Weeds. Pull them before anything else.</span>';
    html += '</div></div><div class="' + (!weeds && !crop ? 'seedlist' : 'row') + '" id="bedActs">';
    if (weeds) html += '<button type="button" class="btn primary" data-bed="clear"><span class="ms">grass</span>Pull the weeds</button>';
    else if (crop && ripe(b)) html += '<button type="button" class="btn primary" data-bed="harvest"><span class="ms">shopping_basket</span>Harvest</button>';
    else if (crop && wateredToday(b, day)) html += '<button type="button" class="btn primary" disabled><span class="ms">water_drop</span>Watered today</button>';
    else if (crop && canLevel(S) < 1) html += '<button type="button" class="btn primary" data-bed="well"><span class="ms">water_drop</span>Fill the can at the well</button>';
    else if (crop) html += '<button type="button" class="btn primary" data-bed="water"><span class="ms">water_drop</span>Water slowly</button>' +
      (f.tools.bigcan && dryBeds(S, day).length > 1 && canLevel(S) > 1 ? '<button type="button" class="btn soft" data-bed="waterall"><span class="ms">water_drop</span><span><b>Water ' + bulkTargets(S, day, id, canLevel(S)).length + ' dry beds</b><small>This one first, then beds ' + bulkTargets(S, day, id, canLevel(S)).slice(1).map(bedNo).join(', ') + '</small></span></button>' : '');
    else if (!Object.keys(CROPS).some(function (k) { return (f.seeds[k] || 0) > 0; }) && seedsLeftToday(S, day) > 0) growable(f).forEach(function (k) { html += '<button type="button" class="btn soft" data-bed="shedplant" data-crop="' + k + '">' + cropPic(k) + '<span><b>' + esc(CROPS[k].name) + '</b><small>' + CROPS[k].days + ' days to ripen</small></span></button>'; });
    else Object.keys(CROPS).forEach(function (k) { if (f.seeds[k] > 0) html += '<button type="button" class="btn soft" data-bed="plant" data-crop="' + k + '">' + cropPic(k) + '<span><b>' + esc(CROPS[k].name) + '</b><small>' + CROPS[k].days + ' days · ' + f.seeds[k] + ' seed' + (f.seeds[k] > 1 ? 's' : '') + '</small></span></button>'; });
    html += '</div><p class="help">Watering costs a little energy; a missed day adds nothing and takes nothing away. Each day a few beds need weeding before they can be tended. You need not tend every bed every day. <button type="button" class="linkbtn" id="farmHow">How the farm works</button></p>';
    R.openSheet('farmbed', 'Bed ' + (BEDS.indexOf(bb) + 1), 'Your farm', 'yard', html);
    var how = doc.getElementById('farmHow'); if (how) how.addEventListener('click', openGuide);
    var acts = doc.getElementById('bedActs'); if (!acts) return;
    acts.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-bed]'); if (!btn || liveSlow()) return;
      var kind = btn.dataset.bed, now = today(); /* the date at the tap, not at the sheet's opening: midnight may have passed */
      if (now !== day) { openBed(id); return; } /* the sheet showed yesterday: redraw it for today before anything is done */
      if (kind === 'well') { goWell(id); return; }
      if (kind === 'harvest') { if (!canAct('harvest')) return; finish('harvest', harvest(S, id, ST)); return; }
      var cost = kind === 'shedplant' ? 'plant' : kind === 'waterall' ? 'water' : kind;
      if (!canAct(cost)) return;
      var crop0 = btn.dataset.crop, seen = JSON.stringify(bed(S, id)), lv0 = canLevel(S), targets = kind === 'waterall' ? bulkTargets(S, now, id, lv0) : null;
      var o = kind === 'clear' ? { ms: 2200, moment: 'weed', verb: 'Pulling them, one at a time…' }
        : kind === 'water' || kind === 'waterall' ? { ms: 3000, moment: 'farmwater', verb: 'Pouring slowly…' }
        : { ms: 2200, moment: 'plant', verb: 'Pressing the seed into the soil…' };
      o.cancel = function () { openBed(id); };
      if (kind === 'plant' || kind === 'shedplant') o.start = function (ms, still) { if (still) return; var svg = doc.querySelector('#sheet .bedpic svg'); if (!svg) return; var c = CROPS[crop0] || {}, el = doc.createElementNS('http://www.w3.org/2000/svg', 'ellipse'); el.setAttribute('cx', '50'); el.setAttribute('cy', '14'); el.setAttribute('rx', '4'); el.setAttribute('ry', '5.5'); el.setAttribute('fill', '#c9a27a'); el.setAttribute('stroke', '#8a6440'); svg.appendChild(el); root.requestAnimationFrame(function () { root.requestAnimationFrame(function () { el.style.transition = 'transform ' + (ms * 0.7) + 'ms ease-in, opacity ' + (ms * 0.3) + 'ms ease ' + (ms * 0.7) + 'ms'; el.style.transform = 'translateY(30px)'; el.style.opacity = '0'; }); }); };
      if (kind === 'clear') o.start = function (ms, still) { if (still) { Array.prototype.forEach.call(doc.querySelectorAll('#sheet .bedpic svg path[stroke="#6f9a62"]'), function (w) { w.style.opacity = '0'; }); return; } var weeds = doc.querySelectorAll('#sheet .bedpic svg path[stroke="#6f9a62"]'); Array.prototype.forEach.call(weeds, function (w, i) { root.setTimeout(function () { w.style.transition = 'opacity ' + (ms / 4) + 'ms ease'; w.style.opacity = '0'; }, (i + 0.4) * ms / (weeds.length + 1)); }); };
      if (kind === 'water' || kind === 'waterall') o.start = function (ms, still) { if (still) return; var svg = doc.querySelector('#sheet .bedpic svg'); if (!svg) return; var el = doc.createElementNS('http://www.w3.org/2000/svg', 'ellipse'); el.setAttribute('cx', '50'); el.setAttribute('cy', '44'); el.setAttribute('rx', '30'); el.setAttribute('ry', '12'); el.setAttribute('fill', 'rgba(70,50,120,.22)'); el.style.opacity = '0'; svg.insertBefore(el, svg.firstChild); root.requestAnimationFrame(function () { root.requestAnimationFrame(function () { el.style.transition = 'opacity ' + ms + 'ms ease-in'; el.style.opacity = '1'; }); }); };
      slowStep(acts, o, function () {
        var t = today(), res; if (t !== now) { openBed(id); return; }
        if (JSON.stringify(bed(S, id)) !== seen || ((kind === 'water' || kind === 'waterall') && canLevel(S) !== lv0)) { R.toast('The bed changed in the meantime. Have another look.', 'info'); openBed(id); return; } /* another tab or phone moved first */
        if (!(ST ? ST.can(cost) : true)) { canAct(cost); openBed(id); return; } /* energy is checked again at the end of the step */
        if (kind === 'clear') res = clearWeeds(S, id, t, ST);
        else if (kind === 'water') res = pour(S, id, t, ST);
        else if (kind === 'waterall') { res = waterAll(S, t, ST, { can: true, ids: targets }); if (res.ok) res.all = res.n; }
        else if (kind === 'plant') res = plant(S, id, crop0, t, ST);
        else if (kind === 'shedplant') res = plantFromShed(S, id, crop0, t, ST);
        finish(kind === 'shedplant' ? 'plant' : kind === 'waterall' ? 'water' : kind, res);
      });
    });
    function finish(kind, res) {
      if (!res) return;
      if (!res.ok) { R.toast(res.why, 'info'); openBed(id); return; }
      if (!res.charged) act(kind); R.chime('save'); renderBeds(); renderCan(); /* a pour from the can already paid its energy in the same save */
      if (kind === 'harvest') { afterHarvest(res); return; }
      if (kind === 'plant') R.toast('Planted. Water it when you are ready.', 'spa');
      if (kind === 'clear') R.toast('Weeds pulled. The bed can grow again.', 'grass');
      if (kind === 'water') R.toast(res.all ? res.all + ' beds watered.' : res.ripe ? 'Ripe! Tap the bed again to harvest.' : 'Watered. ' + res.days + ' of ' + CROPS[bed(S, id).crop].days + ' days.', 'water_drop', canLevel(S) ? canLevel(S) + ' of ' + canCap(farmState(S)) + ' pours left in the can.' : 'The can is empty now. The well is by the tree.');
      openBed(id);
    }
  }
  /* a harvest never writes a diary entry on its own: she is asked, and the food diary saves what she chooses */
  function afterHarvest(res) {
    var crop = CROPS[res.crop];
    var what = res.n + ' ' + (res.n > 1 ? crop.plural : crop.name.toLowerCase());
    var line = R.moment ? R.moment('harvest', { quiet: true }) : '';
    R.openSheet('farmharvest', 'Harvested!', what + ' into the basket', 'shopping_basket',
      '<p>' + esc(what) + ' picked. You have ' + esc(res.total) + ' in the basket now.</p>' + (line ? '<p class="mindline"><span class="ms">spa</span>' + esc(line) + '</p>' : '') +
      '<p class="help">If you are about to cook or eat something real, you can log the meal; the farm never logs anything for you.</p>' +
      '<div class="row"><button type="button" class="btn primary" id="harvestLog"><span class="ms">restaurant</span>Log a meal</button><button type="button" class="btn soft" id="harvestNo">Not now</button></div>');
    var lg = doc.getElementById('harvestLog'), no = doc.getElementById('harvestNo');
    if (lg) lg.addEventListener('click', function () { R.hideSheet(); var a = doc.querySelector('nav a[data-tab="food"]'); if (a) a.click(); if (R.moment) setTimeout(function () { R.toast('Only what you really ate.', 'restaurant', R.moment('farmmeal', { quiet: true })); }, 400); });
    if (no) no.addEventListener('click', function () { R.hideSheet(); });
  }
  function openShed() {
    interacted = true; shown = { kind: 'shed' };
    var day = today(), left = seedsLeftToday(S, day), f = farmState(S), RW = root.OvuRewards, hearts = RW ? (RW.tester() ? Infinity : RW.ledger().hearts) : 0;
    var heartTxt = function (n) { return n + ' \u2665'; };
    /* short on purpose (Jamie, 22 Oct: "too wordy ... How the farm works should be fine") */
    var html = '<p>' + (left ? left + ' free seed packet' + (left === 1 ? '' : 's') + ' left today.' : 'Free seeds are all given out today. More tomorrow.') + '</p><div class="seedlist" id="shedActs">' +
      growable(f).map(function (k) { var c = CROPS[k]; return '<button type="button" class="btn soft" data-seed="' + k + '"' + (left ? '' : ' disabled') + '>' + cropPic(k) + '<span><b>' + esc(c.name) + '</b><small>' + c.days + ' days · have ' + (Math.floor(Number(f.seeds[k])) > 0 ? Math.floor(Number(f.seeds[k])) : 0) + '</small></span></button>'; }).join('') +
      '</div>';
    if (RW) {
      var tools = Object.keys(TOOLS);
      html += '<h4 class="shedh"><span class="ms fill">favorite</span>With hearts <small>' + (hearts === Infinity ? 'tester' : heartTxt(hearts)) + '</small></h4>' +
        '<div class="seedlist" id="shedBuy">' +
        tools.map(function (id) { var t = TOOLS[id], have = !!f.tools[id]; return '<button type="button" class="btn soft" data-tool="' + id + '"' + (have || hearts < t.cost ? ' disabled' : '') + '><span class="ms">' + t.icon + '</span><span><b>' + esc(t.name) + (have ? ' · yours' : '') + '</b><small>' + esc(t.note) + (have ? '' : ' · ' + heartTxt(t.cost)) + '</small></span></button>'; }).join('') +
        '</div>' +
        '<p class="help pantryline" id="shedGrocer"><span class="ms">storefront</span>More seeds at Hay & Harvest on Harbour Lane.</p>';
    }
    html += '<p class="help"><button type="button" class="linkbtn" id="farmHow">How the farm works</button></p>';
    R.openSheet('farmshed', 'The shed', 'Seeds and tools', 'home_repair_service', html);
    var how = doc.getElementById('farmHow'); if (how) how.addEventListener('click', openGuide);
    var acts = doc.getElementById('shedActs'); if (acts) acts.addEventListener('click', function (e) { var btn = e.target.closest('[data-seed]'); if (!btn) return; var res = takeSeed(S, btn.dataset.seed, today()); if (!res.ok) { R.toast(res.why, 'info'); return; } R.chime('tap'); openShed(); });
    var buy = doc.getElementById('shedBuy'); if (buy) buy.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tool]'); if (!btn || btn.disabled) return;
      var res = buyTool(S, RW, btn.dataset.tool);
      if (!res.ok) { R.toast(res.why, 'info'); return; }
      R.chime('save'); var line = R.moment ? R.moment('shop', { quiet: true }) : '';
      R.toast(TOOLS[res.tool].name + ' is yours.', 'redeem', line);
      if (R.renderDeck) R.renderDeck(); renderCan(); openShed();
    });
  }
  function openBasket() {
    var HB = root.OvuGreenhouse && root.OvuGreenhouse.HERBS, kind = function (k) { return CROPS[k] || (HB && HB[k]) || null; }; /* the greenhouse herbs share the basket */
    var f = farmState(S), rows = Object.keys(f.harvest).filter(function (k) { return f.harvest[k] > 0 && kind(k); });
    R.openSheet('farmbasket', 'Your harvest', rows.length ? 'In the basket' : 'Nothing picked yet', 'shopping_basket',
      (rows.length ? '<ul class="basketlist">' + rows.map(function (k) { return '<li><span class="dot" style="background:' + kind(k).colour + '"></span>' + esc(kind(k).name) + ' <b>×' + esc(f.harvest[k]) + '</b></li>'; }).join('') + '</ul>' : '<p>Plant, water and pick, and the basket fills.</p>') +
      (function () { var p = farmState(S).pantry, bits = []; if (p.egg) bits.push(p.egg + ' egg' + (p.egg > 1 ? 's' : '')); if (p.milk) bits.push(p.milk + ' milk'); if (p.onsenegg) bits.push(p.onsenegg + ' onsen egg' + (p.onsenegg > 1 ? 's' : '')); return bits.length ? '<p class="help pantryline"><span class="ms">kitchen</span>From the barn: ' + esc(bits.join(', ')) + '.</p>' : ''; })() +
      '<p class="help">Carrots, pumpkins and sweet potatoes are treats for Clover at the barn; kangkong, pak choy and strawberries for the hens. The rest is yours to admire.</p>' +
      (root.OvuKitchen && root.OvuKitchen.openKitchen ? '<div class="row"><button type="button" class="btn soft" id="basketCook"><span class="ms">skillet</span>Cook a dish</button></div>' : '')); /* the farm kitchen (ovu-kitchen.js) */
    var ck = doc.getElementById('basketCook'); if (ck) ck.addEventListener('click', function () { R.chime('tap'); root.OvuKitchen.openKitchen(); });
  }
  /* several beds share this spot: ask which one */
  function openPicker(ids) {
    var day = today(), f = farmState(S);
    var html = '<div class="seedlist" id="bedPick">' + ids.map(function (id) {
      var bb = BEDS.filter(function (x) { return x.id === id; })[0], b = f.beds[id], crop = b && b.crop ? CROPS[b.crop] : null;
      var state = hasWeeds(b, id, day) ? 'weeds' : crop ? crop.name.toLowerCase() + (ripe(b) ? ', ripe' : ', ' + growthDays(b) + ' of ' + crop.days + ' days') : 'empty';
      return '<button type="button" class="btn soft" data-pick="' + id + '"><span class="ms">yard</span><span><b>Bed ' + (BEDS.indexOf(bb) + 1) + '</b><small>' + esc(state) + '</small></span></button>';
    }).join('') + '</div>';
    R.openSheet('farmpick', 'Which bed?', 'The beds beside you', 'yard', html);
    var pick = doc.getElementById('bedPick'); if (!pick) return;
    pick.addEventListener('click', function (e) { var btn = e.target.closest('[data-pick]'); if (!btn) return; openBed(btn.dataset.pick); });
  }
  R.hotspotHandlers.farmgate = function (id, L) { if (!inFarm(L)) return false; W.travel('garden'); return true; };
  R.hotspotHandlers.shed = function (id, L) { if (!inFarm(L)) return false; if ((W.napping && W.napping()) || R.busy()) return true; openShed(); return true; };
  R.hotspotHandlers.well = function (id, L) { if (!inFarm(L)) return false; if ((W.napping && W.napping()) || R.busy()) return true; openWell(); return true; };
  R.hotspotHandlers.basket = function (id, L) { if (!inFarm(L)) return false; if ((W.napping && W.napping()) || R.busy()) return true; openBasket(); return true; };
  /* the proximity prompt offers the nearest bed by its stand point; "Tap to tend the bed" opens that bed */
  if (root.OvuInteract && root.OvuInteract.setActor) root.OvuInteract.setActor('farm', function (p) { var ids = p.beds || [p.id]; if (ids.length === 1) openBed(ids[0]); else openPicker(ids); });
  R.on('boot', function () {
    farmKey = JSON.stringify([S.state().farm || null, !!S.state().sleeping]);
    R.on('layout', function (L) {
      renderCan();
      if (!inFarm(L)) return; renderBeds();
      if (!farmState(S).guided) maybeGuide(0); /* the first visit explains the four steps once */
      else cancelSlow();
    });
    R.on('props', function (L) { if (inFarm(L || R.layout())) renderBeds(); });
    if (GT) GT.onNewDay(function () { renderBeds(); if (!inFarm(R.layout()) || !R.sheetOpen()) return; cancelSlow(); if (doc.querySelector('#sheet[aria-hidden="false"] #bedActs') && lastBed) openBed(lastBed); else if (doc.querySelector('#sheet[aria-hidden="false"] #shedActs')) openShed(); else if (shown && shown.kind === 'well' && doc.querySelector('#sheet[aria-hidden="false"] .canpic')) openWell(shown.arg); }); /* a farm sheet open over midnight redraws for the new day; a closed one stays closed (Codex follow-up) */
    S.subscribe(function (reason) {
      if (!(reason === 'external' || String(reason).indexOf('sync') === 0)) return;
      var key = JSON.stringify([S.state().farm || null, !!S.state().sleeping]); if (key === farmKey) return; farmKey = key; /* a diary sync that leaves the farm as it was changes nothing here */
      renderBeds(); renderCan();
      if (!inFarm(R.layout()) || !R.sheetOpen() || !shown) return;
      var sel = shown.kind === 'bed' ? '#bedActs, .slowbox' : shown.kind === 'well' ? '#wellActs, .slowbox' : '#shedActs';
      if (!doc.querySelector('#sheet[aria-hidden="false"] ' + sel.split(', ').join(', #sheet[aria-hidden="false"] '))) return;
      cancelSlow(); /* the farm moved under her: show it as it is now */
      if (shown.kind === 'bed') openBed(shown.arg); else if (shown.kind === 'well') openWell(shown.arg); else openShed();
    });
  });
  F.renderBeds = renderBeds; F.renderCan = renderCan; F.openWell = openWell; F.openGuide = openGuide; F.openBed = openBed; F.openShed = openShed; F.openBasket = openBasket;
})(typeof window !== 'undefined' ? window : this);
