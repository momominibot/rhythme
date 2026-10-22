/* The ranch (Jamie, 22 Oct: "go to the farm (new land again) to buy cow and chicken ... facilities upgrade for bigger space
 * ... they can have babies too ... all rebuilt from Harvest Moon"; design docs/design/2026-10-22-harvest-moon-life.md phase 3,
 * Codex design review docs/design/reviews/2026-10-22-codex-ranch-design.md).
 *
 * Everything lives under state.farm.ranch, so the game save carries it with the farm:
 *   { v: 1, lastDay, nextId, barnLevel 0|1, coopLevel 0|1, herd: [{ id, kind: 'cow'|'hen', name, born, adultOn }],
 *     incubator: { childId, started, due } | null, calf: { childId, motherId, started, due } | null, calves: { cowId: lastCalfDay },
 *     sizes: { egg: { small, medium, large }, milk: { small, medium, large } } }
 * Love stays in farm.love[id] and the last collection day in farm.animals[id], as the barn already keeps them, so the
 * three starter animals (Clover, Mochi, Kaya) keep everything they have. Days are date strings and only move forward:
 * a clock set back changes nothing. Babies make nothing until they grow up; love never drops; nothing gets sick.
 * Product size follows love (Harvest Moon): 0 to 3 small, 4 to 7 medium, 8 to 10 large. The pantry's egg and milk
 * counts stay the one true total; sizes is the mix inside that total, used smallest first. */
(function (root) {
  'use strict';
  var KINDS = { cow: { name: 'cow', plural: 'cows', building: 'barn', product: 'milk', grow: 14, cost: 240 }, hen: { name: 'hen', plural: 'hens', building: 'coop', product: 'egg', grow: 7, cost: 120 } };
  var CAPACITY = { barn: [1, 4], coop: [2, 6] }, UPGRADE_COST = { barn: 300, coop: 300 };
  var HATCH_DAYS = 3, CALF_FULL_DAYS = 7, STARTERS = [{ id: 'clover', kind: 'cow', name: 'Clover' }, { id: 'mochi', kind: 'hen', name: 'Mochi' }, { id: 'kaya', kind: 'hen', name: 'Kaya' }];
  var SIZES = ['small', 'medium', 'large'], DAYRX = /^\d{4}-\d{2}-\d{2}$/, NAME_MAX = 16;
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function n0(v) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? n : 0; }
  function day(s) { return typeof s === 'string' && DAYRX.test(s) ? s : null; }
  function addDays(d, n) { var t = new Date(d + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function later(a, b) { return !a ? b : !b ? a : (a > b ? a : b); }
  function cleanName(s) { s = String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX); return s; }
  /* the ranch as it is read, every field made safe; a missing ranch is made from the starters (once; see migrate) */
  function sizesOf(o) { var out = {}; ['egg', 'milk'].forEach(function (p) { var s = o && o[p] || {}; out[p] = { small: n0(s.small), medium: n0(s.medium), large: n0(s.large) }; }); return out; }
  function animal(a) {
    if (!a || typeof a !== 'object' || !KINDS[a.kind] || typeof a.id !== 'string' || !/^[a-z][a-z0-9]{0,23}$/.test(a.id)) return null;
    var out = { id: a.id, kind: a.kind, name: cleanName(a.name) || KINDS[a.kind].name, born: day(a.born), adultOn: day(a.adultOn) };
    if (a.grown) out.grown = true; /* its growing up has been announced */
    return out;
  }
  function timer(t, keys) { if (!t || typeof t !== 'object') return null; var out = {}; for (var i = 0; i < keys.length; i++) { var v = t[keys[i]]; if (keys[i] === 'childId' || keys[i] === 'motherId') { if (typeof v !== 'string') return null; out[keys[i]] = v; } else { if (!day(v)) return null; out[keys[i]] = v; } } return out; }
  function ranchOf(farm) {
    var r = farm && farm.ranch;
    if (!r || typeof r !== 'object') return null;
    var herd = [], seen = {}; (Array.isArray(r.herd) ? r.herd : []).forEach(function (a) { var c = animal(a); if (c && !seen[c.id]) { seen[c.id] = 1; herd.push(c); } });
    return { v: 1, lastDay: day(r.lastDay), nextId: Math.max(1, n0(r.nextId)), barnLevel: r.barnLevel ? 1 : 0, coopLevel: r.coopLevel ? 1 : 0, herd: herd,
      incubator: timer(r.incubator, ['childId', 'started', 'due']), calf: timer(r.calf, ['childId', 'motherId', 'started', 'due']), sizes: sizesOf(r.sizes),
      calves: (function () { var out = {}, c = r.calves && typeof r.calves === 'object' ? r.calves : {}; Object.keys(c).forEach(function (k) { if (day(c[k])) out[k] = c[k]; }); return out; })() };
  }
  /* once: the three starters become the herd, and the pantry's eggs and milk are counted as small (their size is unknown) */
  function migrate(farm, today) {
    if (ranchOf(farm)) return farm;
    var f = copy(farm || {}), p = f.pantry || {};
    f.ranch = { v: 1, lastDay: today, nextId: 1, barnLevel: 0, coopLevel: 0, herd: copy(STARTERS).map(function (a) { a.born = null; a.adultOn = null; return a; }),
      incubator: null, calf: null, sizes: { egg: { small: n0(p.egg), medium: 0, large: 0 }, milk: { small: n0(p.milk), medium: 0, large: 0 } } };
    return f;
  }
  function isAdult(a, today) { return !a.adultOn || today >= a.adultOn; }
  function list(r, kind) { return r.herd.filter(function (a) { return !kind || a.kind === kind; }); }
  function capacity(r, building) { return CAPACITY[building][building === 'barn' ? r.barnLevel : r.coopLevel]; }
  /* animals in a building, counting the baby on its way */
  function occupied(r, building) { var kind = building === 'barn' ? 'cow' : 'hen'; return list(r, kind).length + (building === 'barn' && r.calf ? 1 : 0) + (building === 'coop' && r.incubator ? 1 : 0); }
  function room(r, building) { return Math.max(0, capacity(r, building) - occupied(r, building)); }
  function productSize(love) { love = n0(love); return love >= 8 ? 'large' : love >= 4 ? 'medium' : 'small'; }
  /* the day moves forward only; on a new day due babies arrive (same commit as their timer clears) */
  function advance(farm, today) {
    var f = copy(farm), r = ranchOf(f); if (!r || !day(today)) return farm;
    if (r.lastDay && today < r.lastDay) return farm;
    var changed = r.lastDay !== today; r.lastDay = today;
    if (r.incubator && today >= r.incubator.due) { r.herd.push({ id: r.incubator.childId, kind: 'hen', name: 'Chick', born: r.incubator.due, adultOn: addDays(r.incubator.due, KINDS.hen.grow) }); r.incubator = null; changed = true; }
    if (r.calf && today >= r.calf.due) { r.herd.push({ id: r.calf.childId, kind: 'cow', name: 'Calf', born: r.calf.due, adultOn: addDays(r.calf.due, KINDS.cow.grow) }); r.calf = null; changed = true; }
    r.herd.forEach(function (a) { if (a.adultOn && today >= a.adultOn && !a.grown) { a.grown = true; changed = true; } });
    if (!changed) return farm;
    f.ranch = r; return f;
  }
  /* what changed between two ranch records: babies that arrived and animals that grew up (for a word from Erin) */
  function news(before, after) {
    var b = ranchOf({ ranch: before }) || { herd: [] }, a = ranchOf({ ranch: after }) || { herd: [] }, had = {}, grown = {};
    b.herd.forEach(function (x) { had[x.id] = 1; if (x.grown) grown[x.id] = 1; });
    return { born: a.herd.filter(function (x) { return !had[x.id] && x.born; }), grown: a.herd.filter(function (x) { return x.grown && !grown[x.id] && x.born; }) };
  }
  function newId(r, kind) { var id = kind + r.nextId; r.nextId += 1; while (r.herd.some(function (a) { return a.id === id; })) { id = kind + r.nextId; r.nextId += 1; } return id; }
  /* buy an adult: it produces from tomorrow (farm.animals[id] = today) */
  function buy(farm, kind, name, today) {
    var K = KINDS[kind]; if (!K) return { ok: false, why: 'unknown animal' };
    var f = copy(farm), r = ranchOf(f); if (!r) return { ok: false, why: 'no ranch yet' };
    if (room(r, K.building) < 1) return { ok: false, why: 'The ' + K.building + ' is full. An upgrade makes room for more.' };
    var id = newId(r, kind), a = { id: id, kind: kind, name: cleanName(name) || K.name, born: null, adultOn: null };
    r.herd.push(a); f.ranch = r; f.animals = Object.assign({}, f.animals || {}); f.animals[id] = today;
    return { ok: true, farm: f, animal: a, cost: K.cost };
  }
  function upgrade(farm, building) {
    if (!CAPACITY[building]) return { ok: false, why: 'unknown building' };
    var f = copy(farm), r = ranchOf(f); if (!r) return { ok: false, why: 'no ranch yet' };
    if ((building === 'barn' ? r.barnLevel : r.coopLevel) >= 1) return { ok: false, why: 'The ' + building + ' is already at its biggest.' };
    if (building === 'barn') r.barnLevel = 1; else r.coopLevel = 1;
    f.ranch = r; return { ok: true, farm: f, cost: UPGRADE_COST[building], capacity: capacity(r, building) };
  }
  /* an egg of any size goes into the incubator; it takes one coop place; it hatches after three days */
  function incubate(farm, size, today) {
    var f = copy(farm), r = ranchOf(f); if (!r) return { ok: false, why: 'no ranch yet' };
    if (r.incubator) return { ok: false, why: 'The incubator already has an egg in it.' };
    if (room(r, 'coop') < 1) return { ok: false, why: 'The coop is full. A chick needs a place of its own.' };
    size = SIZES.indexOf(size) > -1 ? size : SIZES.filter(function (s) { return r.sizes.egg[s] > 0; })[0];
    if (!size || !(r.sizes.egg[size] > 0) || !n0(f.pantry && f.pantry.egg)) return { ok: false, why: 'No egg in the pantry to put in.' };
    r.sizes.egg[size] -= 1; f.pantry = Object.assign({}, f.pantry); f.pantry.egg = n0(f.pantry.egg) - 1;
    r.incubator = { childId: newId(r, 'hen'), started: today, due: addDays(today, HATCH_DAYS) }; f.ranch = r;
    return { ok: true, farm: f, due: r.incubator.due };
  }
  /* a cow at full love for seven days (or since a last calf) can expect a calf; the calf takes a barn place while it is on its way */
  function calfDue(farm, motherId, today) {
    var r = ranchOf(farm), m = r && list(r, 'cow').filter(function (a) { return a.id === motherId; })[0]; if (!m || !isAdult(m, today)) return null;
    var love = (farm.love || {})[motherId], full = love && n0(love.n) >= 10 ? day(love.full) : null;
    if (!full) return null;
    var last = r.calves[motherId] || null;
    return later(later(today, addDays(full, CALF_FULL_DAYS)), last ? addDays(last, CALF_FULL_DAYS) : null);
  }
  function startCalf(farm, motherId, today) {
    var f = copy(farm), r = ranchOf(f); if (!r) return { ok: false, why: 'no ranch yet' };
    if (r.calf) return { ok: false, why: 'A calf is already on the way.' };
    if (room(r, 'barn') < 1) return { ok: false, why: 'The barn is full. A calf needs a stall of its own.' };
    var due = calfDue(f, motherId, today); if (!due) return { ok: false, why: 'She needs ten hearts of love first.' };
    r.calf = { childId: newId(r, 'cow'), motherId: motherId, started: today, due: due }; r.calves[motherId] = today; f.ranch = r;
    return { ok: true, farm: f, due: due };
  }
  /* the size mix follows the pantry total: a product added at a size, or taken smallest first; the mix is trimmed to the total */
  function addProduct(farm, product, size, n) {
    var f = copy(farm), r = ranchOf(f); if (!r) return farm; n = n0(n); if (!n || !r.sizes[product]) return farm;
    r.sizes[product][SIZES.indexOf(size) > -1 ? size : 'small'] += n; f.ranch = r; return f;
  }
  /* returns the farm and what was taken by size, e.g. { small: 3, large: 1 } */
  function takeProduct(farm, product, n) {
    var f = copy(farm), r = ranchOf(f); n = n0(n); if (!r || !n || !r.sizes[product]) return { farm: farm, taken: {} };
    var taken = {}; SIZES.forEach(function (s) { var t = Math.min(n, r.sizes[product][s]); r.sizes[product][s] -= t; n -= t; if (t) taken[s] = t; });
    f.ranch = r; return { farm: f, taken: taken };
  }
  function reconcile(farm) { /* the mix never exceeds the pantry total; a gap is filled as small */
    var f = copy(farm), r = ranchOf(f); if (!r) return farm; var changed = false;
    ['egg', 'milk'].forEach(function (p) { var total = n0(f.pantry && f.pantry[p]), s = r.sizes[p], have = s.small + s.medium + s.large;
      if (have > total) { var over = have - total; SIZES.forEach(function (k) { var t = Math.min(over, s[k]); s[k] -= t; over -= t; }); changed = true; }
      else if (have < total) { s.small += total - have; changed = true; } });
    if (!changed) return farm; f.ranch = r; return f;
  }
  function sizeWord(size) { return size === 'large' ? 'large' : size === 'medium' ? 'medium' : 'small'; }
  root.OvuRanch = { KINDS: KINDS, CAPACITY: CAPACITY, UPGRADE_COST: UPGRADE_COST, HATCH_DAYS: HATCH_DAYS, CALF_FULL_DAYS: CALF_FULL_DAYS, STARTERS: STARTERS, SIZES: SIZES,
    ranchOf: ranchOf, migrate: migrate, advance: advance, isAdult: isAdult, list: list, capacity: capacity, occupied: occupied, room: room, productSize: productSize,
    buy: buy, upgrade: upgrade, incubate: incubate, calfDue: calfDue, startCalf: startCalf, addProduct: addProduct, takeProduct: takeProduct, reconcile: reconcile, news: news, sizeWord: sizeWord, addDays: addDays, cleanName: cleanName };
})(typeof window !== 'undefined' ? window : this);
