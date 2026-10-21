/* Rhythme greenhouse (Jamie, 20 Oct 2026: "I want to upgrade the greenhouse a big one with all herbs and tea, aesthetic
 * plants like variegated monstera and pink princess plants"). A glass room she walks into through the garden greenhouse
 * door and leaves the same way. Every tea from ovu-herbs.js grows on the potting bench and the centre table, the herbs to
 * ask a doctor or pharmacist about sit together on the shelf, and the houseplants fill the shelf and the corner. Tapping a
 * plant walks her over and opens its card: a tea keeps exactly the wording of the tea list (the card pieces come from
 * ovu-garden.js), a houseplant says one true thing about it and whether it is safe around cats and dogs. Any plant can be
 * cared for in one mindful minute (water or mist, a leaf, one thing to notice), saved like the garden watering: a practice
 * earns the small flat practice thank-you, never more, and there are no streaks. The tea table opens the full tea list and
 * Erin's own "Morning coffee or tea" practice. Pure data first (testable in node), then the scene. */
(function (root) {
  'use strict';
  var OFF = { x: -50, y: -50 }, NOWIN = { x: -50, y: -50, rx: 0, ry: 0 }, NOSLEEP = { x: -50, y: -50, w: 1, rot: 0 };
  /* where she stands to look at each group: the bench's left and right halves, the centre table, the monstera's corner and
   * the shelf's left end (the tea set closes off the shelf's front right, so the whole shelf is seen from its left end) */
  var BENCH_L = { x: 31, y: 67.5, flip: true }, BENCH_R = { x: 40, y: 63, flip: true }, TABLE = { x: 50, y: 60.5, flip: false }, CORNER = { x: 42, y: 61.5, flip: false }, SHELF = { x: 67, y: 58.5, flip: false };
  /* rendered 20 Oct 2026 (Seedream 5.0 pro, seed 7401, 1248x1560, text only): bench, table, shelf and tea table drawn empty
   * on purpose; positions read off 5% and 2.5% grids. The plants are keyed sprites from three 3x3 sheets (gh-*.webp). */
  var LAYOUT = {
    id: 'greenhouse', scene: 'garden', name: 'The greenhouse', mapIcon: 'local_florist', surface: 'stone', img: 'greenhouse-v1.webp', w: 1248, h: 1560, avatarW: 12, only: [],
    hotspots: [
      { id: 'ghdoor', x: 49.5, y: 77, label: 'Door · back to the garden', prompt: 'Tap to go back to the garden', icon: 'door_open', wp: { x: 49.5, y: 74.5, flip: false } },
      { id: 'teatable', x: 64.5, y: 61, label: 'Tea table · a mindful cup', prompt: 'Tap for the teas and a mindful cup', icon: 'local_cafe', wp: { x: 49, y: 66, flip: false } }
    ],
    home: { x: 49.5, y: 72.5, flip: false },
    zones: [[[50, 46.5], [89, 62.5], [66, 72.5], [56, 79], [42, 79], [37, 72], [11, 63.5]]],
    solids: [{ id: 'bench', x0: 13, x1: 27, y0: 52, y1: 66 }, { id: 'bench', x0: 27, x1: 41, y0: 46, y1: 61 }, { id: 'monstera', x0: 41, x1: 46, y0: 52, y1: 57.5 },
      { id: 'table', x0: 45, x1: 66, y0: 47, y1: 57 }, { id: 'shelf', x0: 68, x1: 88, y0: 42, y1: 61 },
      { id: 'chair', x0: 52, x1: 60, y0: 63, y1: 69.5 }, { id: 'teatable', x0: 59, x1: 71, y0: 62, y1: 69.5 }, { id: 'chair', x0: 70, x1: 77.5, y0: 61.5, y1: 67.5 }],
    doors: [{ id: 'ghdoor', to: 'garden', x: 49.5, y: 75, r: 4, flip: false }],
    meditator: { x: 49, y: 66, w: 11 }, aura: { x: 49, y: 64, w: 17 }, holo: { x: 59, y: 64, w: 14 }, sleeper: NOSLEEP, zzz: OFF, window: NOWIN,
    props: {}
  };
  /* kind: 'tea' (a tea in ovu-herbs.js TEAS, same id), 'ask' (ovu-herbs.js TAKE_CARE, by name), 'house' (a houseplant) or
   * 'tool' (decoration only). at: where the pot stands (bottom centre, plate percent); w: drawn width, percent of plate */
  var PLANTS = [
    /* the potting bench, top: the taller teas */
    { id: 'ginger', kind: 'tea', at: [18, 54.2], w: 4.6, wp: BENCH_L }, { id: 'cinnamon', kind: 'tea', at: [22, 53.1], w: 4.6, wp: BENCH_L },
    { id: 'greentea', kind: 'tea', at: [26, 52.0], w: 4.6, wp: BENCH_L }, { id: 'jujube', kind: 'tea', at: [30, 50.9], w: 4.6, wp: BENCH_R },
    { id: 'tulsi', kind: 'tea', at: [34, 49.8], w: 4.6, wp: BENCH_R }, { id: 'water', kind: 'tea', at: [38, 48.6], w: 4.6, wp: BENCH_R },
    /* the potting bench, lower tier: the low teas */
    { id: 'chamomile', kind: 'tea', at: [20, 62.25], w: 4, wp: BENCH_L }, { id: 'peppermint', kind: 'tea', at: [24, 61.25], w: 4, wp: BENCH_L },
    { id: 'saffron', kind: 'tea', at: [28, 60.25], w: 4, wp: BENCH_L }, { id: 'spearmint', kind: 'tea', at: [32, 59.25], w: 4, wp: BENCH_R },
    { id: 'lemonbalm', kind: 'tea', at: [36, 58.25], w: 4, wp: BENCH_R },
    /* the centre table */
    { id: 'lavender', kind: 'tea', at: [48.5, 51.0], w: 4.4, wp: TABLE }, { id: 'rose', kind: 'tea', at: [52.5, 51.6], w: 4.4, wp: TABLE },
    { id: 'fennel', kind: 'tea', at: [56.5, 52.3], w: 4.4, wp: TABLE }, { id: 'vitex', kind: 'tea', at: [60.5, 52.9], w: 4.4, wp: TABLE },
    /* the shelf: houseplants on the top two boards, the herbs to ask about first below */
    { id: 'hoya', kind: 'house', at: [72.5, 44.9], w: 4.2, wp: SHELF }, { id: 'pearls', kind: 'house', at: [78, 45.5], w: 3.6, wp: SHELF }, { id: 'calathea', kind: 'house', at: [83.5, 46.1], w: 4.4, wp: SHELF },
    { id: 'anthurium', kind: 'house', at: [72.5, 50.7], w: 4.2, wp: SHELF }, { id: 'pinkprincess', kind: 'house', at: [78, 51.3], w: 4.4, wp: SHELF },
    { id: 'stjohns', kind: 'ask', at: [72.5, 55.9], w: 4, wp: SHELF }, { id: 'dongquai', kind: 'ask', at: [78, 56.6], w: 4, wp: SHELF }, { id: 'licorice', kind: 'ask', at: [83.5, 57.2], w: 4, wp: SHELF },
    { id: 'raspberry', kind: 'ask', at: [83.5, 62.2], w: 4, wp: SHELF },
    /* the big one in the corner, and the tools */
    { id: 'monstera', kind: 'house', at: [43.5, 57.2], w: 8.5, wp: CORNER },
    { id: 'mister', kind: 'tool', at: [63.8, 53.5], w: 2.4 }, { id: 'can', kind: 'tool', at: [18.5, 66.3], w: 4.2 }
  ];
  /* ovu-herbs.js TAKE_CARE names for the herbs to ask about first */
  var ASK = { stjohns: 'St John’s wort', dongquai: 'Dong quai', licorice: 'Licorice root', raspberry: 'Raspberry leaf' };
  /* the houseplants: one true thing, one thing to notice while caring for it, and pet safety from a named source
   * (checked 20 Oct 2026: ASPCA toxic and non-toxic plant pages; NC State Extension for string of pearls, which the ASPCA
   * list does not include) */
  var ASPCA = 'https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants/', ASPCA2 = 'https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/';
  var HOUSE = {
    monstera: { name: 'Variegated monstera', about: 'Each leaf is marbled differently, so no two look the same.', notice: 'Find the leaf with the most white. Trace one of its splits with your eyes.',
      pets: 'toxic', petText: 'Toxic to cats and dogs if chewed: it can irritate the mouth and cause drooling and vomiting.', src: 'ASPCA, Cutleaf philodendron (Monstera deliciosa)', url: ASPCA + 'cutleaf-philodendron' },
    pinkprincess: { name: 'Pink princess philodendron', about: 'Its pink splashes differ from leaf to leaf; some new leaves come out almost all green.', notice: 'Look for the newest leaf. Notice where the pink begins and ends.',
      pets: 'toxic', petText: 'The ASPCA lists philodendrons as toxic to cats and dogs if chewed: mouth irritation, drooling and vomiting. This one is not listed by name; its close relative is.', src: 'ASPCA, Red Princess philodendron', url: ASPCA2 + 'red-princess' },
    calathea: { name: 'Calathea', about: 'Its leaves lift a little in the evening and lower again by morning.', notice: 'Follow the stripes on one leaf, from the middle out to the edge.',
      pets: 'safe', petText: 'Listed as non-toxic to cats and dogs. Any plant can still upset a tummy if eaten.', src: 'ASPCA, Calathea lancifolia', url: ASPCA2 + 'calathea-lancifolia-2' },
    /* a succulent that dislikes humidity: never misted (RHS, "never mist them"), so its minute is soil, a strand and the pearls */
    pearls: { name: 'String of pearls', about: 'Each round leaf stores water, so it likes its soil to dry out between drinks.', notice: 'Count five pearls along one strand, slowly, one by one.',
      steps: 'Touch the soil, lift a strand, notice one thing.', lines: ['Touch the soil with one finger. It likes to dry out between drinks.', 'Lift one strand gently. Feel how light it is.', 'Count five pearls along one strand, slowly, one by one.', 'Step back and take in the whole plant. Nothing to fix.'],
      pets: 'toxic', petText: 'Poisonous to pets if eaten, usually mildly: vomiting and diarrhoea. The sap can irritate skin.', src: 'NC State Extension, Senecio rowleyanus', url: 'https://plants.ces.ncsu.edu/plants/senecio-rowleyanus/' },
    anthurium: { name: 'Pink anthurium', about: 'The glossy pink heart is a leaf-like spathe; the true flowers are tiny, on the spike.', notice: 'Notice the shine on the pink heart, and the little spike inside it.',
      pets: 'toxic', petText: 'Toxic to cats and dogs if chewed: mouth pain and swelling, and drooling.', src: 'ASPCA, Flamingo flower (Anthurium)', url: ASPCA + 'flamingo-flower' },
    hoya: { name: 'Hoya', about: 'Its waxy, star-shaped flowers grow in round clusters.', notice: 'Look closely at one cluster. Each tiny flower is a star.',
      pets: 'safe', petText: 'Listed as non-toxic to cats and dogs. Any plant can still upset a tummy if eaten.', src: 'ASPCA, Wax plant (Hoya)', url: ASPCA + 'wax-plant' }
  };
  /* one mindful minute with a plant: four lines, fifteen seconds apart (at most 18 words each, no em dashes, no claims) */
  var CARE_SECONDS = 60, CARE_STEP = 15;
  function careLines(p) {
    if (p.kind === 'house' && HOUSE[p.id].lines) return HOUSE[p.id].lines.slice();
    if (p.kind === 'house') return ['Mist the leaves slowly. Watch the drops gather and run.', 'Wipe one leaf with a soft cloth. Feel how cool and smooth it is.', HOUSE[p.id].notice, 'Step back and take in the whole plant. Nothing to fix.'];
    return ['Water the soil slowly. Watch it darken.', 'Touch one leaf lightly, then notice any scent on your fingers.', 'Notice its colours: the greens, the stems, any flower or fruit.', 'Step back and take in the whole plant. Nothing to fix.'];
  }
  function plant(id) { return PLANTS.filter(function (p) { return p.id === id; })[0] || null; }
  function sprite(p) { return 'gh-' + p.id + '.webp'; }
  /* a plant's card data, from the shared tea list for teas and from TAKE_CARE for the ones to ask about */
  function info(p, H) {
    if (!p) return null;
    if (p.kind === 'tea') { var t = H && H.TEAS.filter(function (x) { return x.id === p.id; })[0]; return t ? { name: t.name, tea: t } : null; }
    if (p.kind === 'ask') { var c = H && H.TAKE_CARE.filter(function (x) { return x.name === ASK[p.id]; })[0]; return c ? { name: c.name, ask: c } : null; }
    if (p.kind === 'house') return { name: HOUSE[p.id].name, house: HOUSE[p.id] };
    return null;
  }
  /* ---------- the herb beds (21 Oct; farm-loop design, step 4: docs/design/2026-10-21-greenhouse-herbs.md) ----------
   * Four small planters by the door grow ginger, lemongrass, pandan and chamomile. A start (a piece of root, a stalk, a
   * cutting or a pinch of seed) is bought at Hay & Harvest, planted in an empty planter, and grows by the real days it was
   * watered: a missed day adds nothing and takes nothing away. Each herb comes back after a harvest on its own shorter
   * cadence, for as long as she keeps it. The harvest goes into the farm's basket (state.farm.harvest, the same key as the
   * farm's lemongrass), so one basket holds everything she picked. Planting, watering and picking cost energy like the
   * farm's and are saved with it; no hearts are ever paid here. Brewing a cup from the basket is a one-minute tea practice
   * that writes no diary entry and earns only the flat practice thank-you (OvuRewards.thank). No weeds under glass.
   * cost: hearts for one start at Hay & Harvest; ripe: watered days to the first harvest; regrow: watered days to each
   * harvest after that; yield: what one harvest puts in the basket; tea: the tea list's id when the herb has a research
   * card (ovu-herbs.js), else null: lemongrass and pandan have none, so their cup says nothing about what it does */
  var HERBS = {
    ginger: { name: 'Ginger', plural: 'pieces of ginger', start: 'A piece of ginger root', cost: 6, ripe: 6, regrow: 3, yield: 2, tea: 'ginger', cup: 'Ginger tea', noun: 'ginger slices', scent: 'ginger', colour: '#e3b46a', top: '#6fae7c' },
    lemongrass: { name: 'Lemongrass', plural: 'stalks of lemongrass', start: 'A lemongrass stalk', cost: 4, ripe: 4, regrow: 2, yield: 3, tea: null, cup: 'Lemongrass tea', noun: 'bruised lemongrass', scent: 'lemongrass', colour: '#dfe6a0', top: '#8fbf6a' },
    pandan: { name: 'Pandan', plural: 'pandan leaves', start: 'A pandan cutting', cost: 4, ripe: 4, regrow: 2, yield: 3, tea: null, cup: 'Pandan tea', noun: 'knotted pandan leaves', scent: 'pandan', colour: '#5fae6a', top: '#3f8f57' },
    chamomile: { name: 'Chamomile', plural: 'handfuls of chamomile flowers', start: 'A pinch of chamomile seed', cost: 5, ripe: 4, regrow: 2, yield: 2, tea: 'chamomile', cup: 'Chamomile tea', noun: 'chamomile flowers', scent: 'chamomile', colour: '#f2d16b', top: '#8fbf7a' }
  };
  var HERB_IDS = ['ginger', 'lemongrass', 'pandan', 'chamomile'];
  /* read off greenhouse-v1.webp on a 5% grid (21 Oct): the front of the tiled floor runs level at about y 72.5 between the
   * two steps down, either side of the doormat, so two planters stand each side of the way in, leaving the door clear.
   * at: bottom centre of the planter; box: its footprint (a solid); wp: where she stands to tend it. The chairs and the tea
   * table come down to y 69.5, so the right pair are tended from their sides. */
  var HERB_BEDS = [
    { id: 'hb1', at: [39, 72.3], w: 5, box: [36.8, 41.2, 69.6, 72.4], wp: { x: 39, y: 68.6, flip: false } },
    { id: 'hb2', at: [44, 72.3], w: 5, box: [41.8, 46.2, 69.6, 72.4], wp: { x: 45, y: 68.8, flip: false } },
    { id: 'hb3', at: [55, 72.3], w: 5, box: [52.8, 57.2, 69.6, 72.4], wp: { x: 51.2, y: 71, flip: true } },
    { id: 'hb4', at: [60, 72.3], w: 5, box: [57.8, 62.2, 69.6, 72.4], wp: { x: 63.8, y: 71.2, flip: true } }
  ];
  HERB_BEDS.forEach(function (b) { LAYOUT.solids.push({ id: 'herbbed', x0: b.box[0], x1: b.box[1], y0: b.box[2], y1: b.box[3] }); });
  var DAYRX = /^\d{4}-\d{2}-\d{2}$/;
  function herbBed(id) { return HERB_BEDS.filter(function (b) { return b.id === id; })[0] || null; }
  function whole(v) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? Math.min(99, n) : 0; }
  /* state.greenhouse = { seeds: { herb: n }, beds: { hbN: { herb, planted, watered: [days since the last harvest], last, cuts } } },
   * cleaned on every read so a restored backup can only hold known herbs, whole counts and real dates */
  function herbState(S) {
    var g = S.state().greenhouse || {}, seeds = {}, beds = {};
    HERB_IDS.forEach(function (k) { var n = whole(g.seeds && g.seeds[k]); if (n) seeds[k] = n; });
    HERB_BEDS.forEach(function (hb) {
      var b = g.beds && g.beds[hb.id]; if (!b || !HERBS[b.herb] || !DAYRX.test(b.planted || '')) return;
      var w = (Array.isArray(b.watered) ? b.watered : []).filter(function (d) { return typeof d === 'string' && DAYRX.test(d); }).slice(-40);
      var last = typeof b.last === 'string' && DAYRX.test(b.last) ? b.last : (w.slice(-1)[0] || null);
      beds[hb.id] = { herb: b.herb, planted: b.planted, watered: w, last: last, cuts: whole(b.cuts) };
    });
    return { seeds: seeds, beds: beds };
  }
  function herbNeed(b) { return b && HERBS[b.herb] ? (b.cuts ? HERBS[b.herb].regrow : HERBS[b.herb].ripe) : 0; }
  function herbDays(b) { return b && b.herb ? b.watered.length : 0; }
  function herbRipe(b) { return !!(b && b.herb && herbDays(b) >= herbNeed(b)); }
  /* 0 soil, 1 sprout, 2 young, 3 ripe; a herb that has been picked starts again from young, not from a sprout */
  function herbStage(b) { if (!b || !b.herb) return 0; if (herbRipe(b)) return 3; var n = herbDays(b); if (b.cuts || n >= Math.ceil(herbNeed(b) / 2)) return 2; return n >= 1 ? 1 : 0; }
  function herbWateredToday(b, day) { return !!(b && b.last === day); }
  var TIRED = 'Too tired for that. Energy comes back with a night’s sleep, or with the new day.', UNSAVED = 'That could not be saved just now.';
  /* the greenhouse (and the basket, for a harvest) and the energy land in one save, or nothing changes (S.commit) */
  function herbSave(S, patch, ST, action) {
    try {
      if (ST && ST.spendWith && action) { if (!ST.spendWith(action, patch)) return { ok: false, tired: true, why: TIRED }; return { ok: true, charged: true }; }
      if (S.commit) S.commit(patch); else S.setState(patch);
      return { ok: true, charged: false };
    } catch (e) { return { ok: false, why: UNSAVED }; }
  }
  /* Hay & Harvest: one start for its hearts, the hearts and the start in one save (OvuRewards.spend) */
  function buyStart(S, RW, herb) {
    var h = HERBS[herb]; if (!h) return { ok: false, why: 'Not in the shop.' };
    var g = herbState(S); if ((g.seeds[herb] || 0) >= 99) return { ok: false, why: 'Your bag holds plenty of ' + h.name.toLowerCase() + ' already.' }; /* never pay for one the bag cannot hold */
    g.seeds[herb] = (g.seeds[herb] || 0) + 1;
    try { RW.spend(h.cost, 'herb:' + herb, { greenhouse: g }); } catch (e) { return { ok: false, why: e.message }; }
    return { ok: true, herb: herb, have: g.seeds[herb] };
  }
  function plantHerb(S, id, herb, day, ST) {
    var hb = herbBed(id), h = HERBS[herb]; if (!hb || !h) return { ok: false, why: 'unknown herb' };
    var g = herbState(S); if (g.beds[id]) return { ok: false, why: 'This planter already has ' + HERBS[g.beds[id].herb].name.toLowerCase() + ' in it.' };
    if (!(g.seeds[herb] > 0)) return { ok: false, why: 'No ' + h.name.toLowerCase() + ' to plant. Hay & Harvest on Harbour Lane sells it.' };
    g.seeds[herb] -= 1; if (!g.seeds[herb]) delete g.seeds[herb];
    g.beds[id] = { herb: herb, planted: day, watered: [], last: null, cuts: 0 };
    var sv = herbSave(S, { greenhouse: g }, ST, 'plant'); if (!sv.ok) return sv;
    return { ok: true, herb: herb, charged: sv.charged };
  }
  /* once a day; a date before the last watering or the planting is a clock set back, and counts nothing */
  function waterHerb(S, id, day, ST) {
    var g = herbState(S), b = g.beds[id]; if (!b) return { ok: false, why: 'Nothing is planted here yet.' };
    if (herbRipe(b)) return { ok: false, why: 'Ready to pick. It needs no more water until then.' };
    if (day < b.planted) return { ok: false, why: 'The date is earlier than the planting. Check the phone’s clock.' };
    if (b.last && day <= b.last) return { ok: false, why: 'Watered already today. Tomorrow counts again.' };
    b.watered = b.watered.concat([day]).slice(-40); b.last = day;
    var sv = herbSave(S, { greenhouse: g }, ST, 'water'); if (!sv.ok) return sv;
    return { ok: true, days: b.watered.length, need: herbNeed(b), ripe: herbRipe(b), charged: sv.charged };
  }
  /* into the basket; the herb stays and grows again from young on its regrow cadence */
  function harvestHerb(S, id, ST) {
    var FM = root.OvuFarm; if (!FM) return { ok: false, why: 'The basket is not here.' };
    var g = herbState(S), b = g.beds[id]; if (!herbRipe(b)) return { ok: false, why: b ? 'Not ready yet.' : 'Nothing to pick.' };
    var h = HERBS[b.herb], f = JSON.parse(JSON.stringify(FM.farmState(S))), had = Math.floor(Number(f.harvest[b.herb])) || 0;
    if (had >= 99) return { ok: false, why: 'The basket is full of ' + h.plural + '. Brew a cup or two first.' }; /* a pick that could not fit costs nothing, and the farm's own count is never cut */
    f.harvest[b.herb] = had + h.yield;
    b.watered = []; b.cuts = Math.min(99, b.cuts + 1);
    var sv = herbSave(S, { greenhouse: g, farm: f }, ST, 'harvest'); if (!sv.ok) return sv;
    return { ok: true, herb: b.herb, n: h.yield, total: f.harvest[b.herb], again: h.regrow, charged: sv.charged };
  }
  /* an empty planter for another herb: free, no energy; what grew there is let go */
  function clearHerb(S, id) {
    var g = herbState(S); if (!g.beds[id]) return { ok: false, why: 'This planter is empty already.' };
    delete g.beds[id]; var sv = herbSave(S, { greenhouse: g }); return sv.ok ? { ok: true } : sv;
  }
  function inBasket(S, herb) { var FM = root.OvuFarm; if (!FM || !HERBS[herb]) return 0; return Math.max(0, Math.floor(Number(FM.farmState(S).harvest[herb])) || 0); }
  /* a finished cup: one from the basket, and the flat practice thank-you if the day's practice rules still allow one, in one
   * save (OvuRewards.thank runs the same practicePoints as every practice). No diary entry is written. */
  function brewCup(S, RW, herb) {
    var FM = root.OvuFarm; if (!FM || !HERBS[herb]) return { ok: false, why: 'unknown herb' };
    var f = JSON.parse(JSON.stringify(FM.farmState(S))), n = Math.floor(Number(f.harvest[herb])) || 0;
    if (n < 1) return { ok: false, why: 'No ' + HERBS[herb].name.toLowerCase() + ' in the basket now.' };
    f.harvest[herb] = n - 1; if (!f.harvest[herb]) delete f.harvest[herb];
    if (!RW || !RW.thank) return { ok: false, why: UNSAVED };
    var t; try { t = RW.thank('tea:' + herb, { farm: f }); } catch (e) { return { ok: false, why: UNSAVED }; }
    return { ok: true, herb: herb, points: t.points || 0, left: f.harvest[herb] || 0 };
  }
  /* the tea practice: warmth, steam, the first sip; four lines, fifteen seconds apart, like the plant minute */
  function brewLines(herb) {
    var h = HERBS[herb]; if (!h) return [];
    return ['Pour the hot water over the ' + h.noun + '. Watch the colour change.', 'Hold the cup in both hands. Notice its warmth.', 'Breathe in the steam. Notice the scent of the ' + h.scent + '.', 'Take the first sip slowly. Notice the taste, and the warmth.'];
  }
  /* a planter drawn as a small SVG in the farm beds' style: a wooden box, its soil (darker when watered today) and the herb
   * at its stage. Placeholder art until the herb sprites are drawn (design note, Art). */
  function r1(n) { return Math.round(n * 10) / 10; }
  function leaf(x, y, len, deg, w, col, op) {
    var a = deg * Math.PI / 180, tx = x + len * Math.sin(a), ty = y - len * Math.cos(a), nx = Math.cos(a) * w, ny = Math.sin(a) * w, mx = (x + tx) / 2, my = (y + ty) / 2;
    return '<path d="M' + r1(x) + ' ' + r1(y) + ' Q' + r1(mx + nx) + ' ' + r1(my + ny) + ' ' + r1(tx) + ' ' + r1(ty) + ' Q' + r1(mx - nx) + ' ' + r1(my - ny) + ' ' + r1(x) + ' ' + r1(y) + 'Z" fill="' + col + '"' + (op ? ' opacity="' + op + '"' : '') + '/>';
  }
  function herbArt(herb, st) {
    var h = HERBS[herb], s = '', g = h.top, k = st === 1 ? 0.45 : st === 2 ? 0.75 : 1;
    if (herb === 'ginger') {
      if (st === 3) s += '<ellipse cx="38" cy="57" rx="7" ry="3.5" fill="' + h.colour + '"/><ellipse cx="60" cy="57.5" rx="6" ry="3" fill="' + h.colour + '"/>';
      (st === 1 ? [50] : st === 2 ? [40, 54, 64] : [34, 46, 56, 66]).forEach(function (x, i) {
        var tall = 38 * k * (i % 2 ? 0.85 : 1); s += '<path d="M' + x + ' 57 v -' + r1(tall) + '" stroke="#7fae6a" stroke-width="2.4" stroke-linecap="round"/>';
        for (var j = 1; j <= (st === 1 ? 1 : 3); j++) { var yy = 57 - tall * j / 3.4; s += leaf(x, yy, 13 * k + 4, j % 2 ? -62 : 62, 3, g); }
      });
    } else if (herb === 'lemongrass') {
      [-34, -20, -8, 4, 16, 28, 40].slice(st === 1 ? 2 : 0, st === 1 ? 5 : 7).forEach(function (deg, i) { s += leaf(50 + deg / 6, 57, (st === 1 ? 16 : 30 + (i % 3) * 7) * k + 6, deg, 2.6, i % 2 ? g : '#a8cf78'); });
      if (st === 3) s += '<rect x="44" y="47" width="12" height="10" rx="3" fill="#eef0c8" opacity=".9"/>';
    } else if (herb === 'pandan') {
      [-58, -38, -18, 0, 18, 38, 58].slice(st === 1 ? 2 : 0, st === 1 ? 5 : 7).forEach(function (deg, i) { s += leaf(50, 57, (st === 1 ? 14 : 26 + (i % 2) * 8) * k + 6, deg, 4.2, i % 2 ? g : h.colour); });
    } else {
      (st === 1 ? [50] : st === 2 ? [36, 48, 60] : [30, 40, 50, 60, 70]).forEach(function (x, i) {
        var tall = (24 + (i % 2) * 6) * k; s += '<path d="M' + x + ' 57 q 2 -' + r1(tall / 2) + ' 0 -' + r1(tall) + '" stroke="' + g + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
        s += leaf(x, 57 - tall * 0.35, 7 * k + 3, -55, 1.6, g) + leaf(x, 57 - tall * 0.55, 7 * k + 3, 55, 1.6, g);
        if (st === 3) { var cy = 57 - tall; for (var p = 0; p < 8; p++) { var a = p * Math.PI / 4; s += '<ellipse cx="' + r1(x + Math.cos(a) * 3.6) + '" cy="' + r1(cy + Math.sin(a) * 3.6) + '" rx="2" ry="1.3" transform="rotate(' + (p * 45) + ' ' + r1(x + Math.cos(a) * 3.6) + ' ' + r1(cy + Math.sin(a) * 3.6) + ')" fill="#fffaf0" stroke="#e7dcc0" stroke-width=".4"/>'; } s += '<circle cx="' + x + '" cy="' + r1(cy) + '" r="2.4" fill="#f2c94c"/>'; }
      });
    }
    if (st === 3) s += '<path d="M20 22 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6Z" fill="#fff8d6" opacity=".95"/><path d="M80 30 l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2Z" fill="#fff8d6" opacity=".9"/>';
    return s;
  }
  function herbSVG(b, day) {
    var st = herbStage(b), wet = herbWateredToday(b, day);
    return '<svg viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M12 60 L50 52 L88 60 L88 80 Q88 86 82 86 L18 86 Q12 86 12 80Z" fill="#d6a173"/><path d="M12 60 L50 52 L88 60 L50 68Z" fill="#e9c49a"/>' +
      '<path d="M12 70 H88 M12 78 H88" stroke="#c18a5c" stroke-width="1.4" opacity=".7"/><path d="M50 68 V86" stroke="#c18a5c" stroke-width="1.2" opacity=".5"/>' +
      '<ellipse cx="50" cy="59" rx="33" ry="6" fill="' + (wet ? '#4f3828' : '#7a5a42') + '"/>' + (wet ? '<ellipse cx="42" cy="58" rx="6" ry="1.4" fill="#8fc6ea" opacity=".55"/>' : '') +
      (b && b.herb && st ? herbArt(b.herb, st) : '') + '</svg>';
  }
  var GH = { LAYOUT: LAYOUT, PLANTS: PLANTS, HOUSE: HOUSE, ASK: ASK, CARE_SECONDS: CARE_SECONDS, CARE_STEP: CARE_STEP, careLines: careLines, plant: plant, sprite: sprite, info: info,
    HERBS: HERBS, HERB_IDS: HERB_IDS, HERB_BEDS: HERB_BEDS, herbBed: herbBed, herbState: herbState, herbNeed: herbNeed, herbDays: herbDays, herbRipe: herbRipe, herbStage: herbStage, herbWateredToday: herbWateredToday,
    buyStart: buyStart, plantHerb: plantHerb, waterHerb: waterHerb, harvestHerb: harvestHerb, clearHerb: clearHerb, inBasket: inBasket, brewCup: brewCup, brewLines: brewLines, herbSVG: herbSVG,
    /* for a map: where this place sits and how to get in (no shortcut button of its own) */
    PLACE: { id: 'greenhouse', name: 'The greenhouse', icon: 'local_florist', within: 'garden', door: 'greenhouse' } };
  root.OvuGreenhouse = GH;

  /* ---------- the scene ---------- */
  var R = root.OvuRoom; if (!R || !root.document || !root.document.createElement) return;
  var S = root.OvuStore, doc = root.document, ART = R.ART;
  R.LAYOUTS.greenhouse = LAYOUT;
  function esc(s) { return R.esc(s); }
  function inside(L) { return !!(L && L.id === 'greenhouse'); }
  function napping() { return root.OvuWalk && root.OvuWalk.napping(); }
  function render(L) {
    var wrap = R.els.props;
    Array.prototype.slice.call(wrap.querySelectorAll('.ghplant, .ghbed')).forEach(function (el) { el.remove(); });
    if (!inside(L)) return;
    var H = root.OvuHerbs;
    PLANTS.forEach(function (p) {
      var d = doc.createElement('div'), it = info(p, H);
      d.className = 'nb ghplant kind-' + p.kind; d.dataset.id = 'gh-' + p.id; d.dataset.plant = p.id;
      if (it) { d.classList.add('tappable'); d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0'); d.setAttribute('aria-label', it.name + '. Tap to look closer.'); }
      d.style.left = p.at[0] + '%'; d.style.top = p.at[1] + '%'; d.style.width = p.w + '%';
      d.innerHTML = '<img src="' + ART + sprite(p) + '" alt="">';
      wrap.appendChild(d);
    });
    renderBeds(L);
  }
  /* the four planters by the door, drawn over the plate (depth-sorted with her, like the pots) */
  function day() { var GT = root.OvuGameTime; return GT ? GT.dayKey() : S.today(); } /* the farm's day, so a herb and a crop count the same days */
  function bedLabel(hb, b, d) {
    var n = HERB_BEDS.indexOf(hb) + 1;
    if (!b) return 'Planter ' + n + ', empty. Tap to plant.';
    var h = HERBS[b.herb]; return 'Planter ' + n + ': ' + h.name.toLowerCase() + (herbRipe(b) ? ', ready to pick' : ', ' + herbDays(b) + ' of ' + herbNeed(b) + ' watered days, ' + (herbWateredToday(b, d) ? 'watered today' : 'not watered today')) + '.';
  }
  function renderBeds(L) {
    var wrap = R.els.props;
    Array.prototype.slice.call(wrap.querySelectorAll('.ghbed')).forEach(function (el) { el.remove(); });
    if (!inside(L || R.layout())) return;
    var g = herbState(S), d = day();
    HERB_BEDS.forEach(function (hb) {
      var el = doc.createElement('div'), b = g.beds[hb.id];
      el.className = 'nb ghbed tappable' + (herbRipe(b) ? ' ripe' : ''); el.dataset.id = 'gh-' + hb.id; el.dataset.bed = hb.id;
      el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); el.setAttribute('aria-label', bedLabel(hb, b, d));
      el.style.left = hb.at[0] + '%'; el.style.top = hb.at[1] + '%'; el.style.width = hb.w + '%';
      el.innerHTML = herbSVG(b, d);
      wrap.appendChild(el);
    });
  }
  /* the card: a tea says what the tea list says, a herb to ask about says why, a houseplant one true thing and pet safety */
  function openCard(id) {
    if (napping()) return;
    var p = plant(id), H = root.OvuHerbs, it = info(p, H), Gd = root.OvuGarden && root.OvuGarden.herb; if (!it || !Gd) return;
    var pf = S.profile() || {}, body = '';
    if (it.tea) body = (Gd.careful(pf) ? Gd.carefulHTML(pf) : '') + '<section class="dsec teas">' + Gd.teaHTML(it.tea, true) + '</section>';
    else if (it.ask) body = '<div class="teacare first"><b><span class="ms">health_and_safety</span>Check with a doctor or pharmacist first</b><p><b>' + esc(it.ask.name) + '</b>' + esc(it.ask.text) + ' <span class="evrefs">' + Gd.refsHTML(it.ask.refs) + '</span></p><p class="help">' + esc(Gd.ASK_FIRST) + '</p></div>' +
      '<p class="help">It grows here so you can recognise it, not as a tea to try.</p>';
    else body = '<div class="itemcard"><img src="' + ART + sprite(p) + '" alt=""><div><p>' + esc(it.house.about) + '</p></div></div>' +
      '<div class="petsafe ' + (it.house.pets === 'safe' ? 'ok' : 'warn') + '"><b><span class="ms">pets</span>' + (it.house.pets === 'safe' ? 'Pets' : 'Pets, take care') + '</b><p>' + esc(it.house.petText) + ' <a href="' + it.house.url + '" target="_blank" rel="noopener">' + esc(it.house.src) + '</a></p></div>';
    R.openSheet('ghcard', it.name, { tea: 'On the potting bench', ask: 'Ask first, before any herb', house: 'A houseplant' }[p.kind] || 'The greenhouse', p.kind === 'house' ? 'potted_plant' : 'local_florist',
      body + '<div class="row"><button type="button" class="btn primary" data-act="care"><span class="ms">' + (p.kind === 'house' ? 'water_drop' : 'yard') + '</span>One mindful minute with it</button>' +
      (p.kind === 'tea' && R.openEveryday ? '<button type="button" class="btn soft" data-act="cup"><span class="ms">local_cafe</span>A mindful cup with Erin</button>' : '') + '</div>' +
      '<p class="help">' + (p.kind === 'house' ? (it.house.steps || 'Mist, wipe a leaf, notice one thing.') : 'Water, touch a leaf, notice one thing.') + ' Saved to your journal as one minute of calm.</p>');
    doc.getElementById('sheetBody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'care') startCare(id);
      if (b.dataset.act === 'cup') { if (caring) return busyToast(); R.openEveryday('coffee'); }
    });
  }
  /* tap a plant: walk over (around the furniture), then the card; she stays by it afterwards */
  function tapPlant(el) {
    var p = plant(el.dataset.plant); if (!p || !p.wp || napping() || caring) return;
    R.chime('tap'); R.cancelIdle(); if (root.OvuWalk.walking()) root.OvuWalk.stop();
    LAYOUT.home.x = p.wp.x; LAYOUT.home.y = p.wp.y; LAYOUT.home.flip = !!p.wp.flip;
    R.walkTo(p.wp, function () { if (!R.busy()) openCard(p.id); });
  }
  /* the minute: like the garden watering, one completion path, one saved entry, however it ends. It never runs alongside
   * one of Erin's practices or a session: it will not start over one, and if one starts while it runs (from the Mind tab, say)
   * it steps aside at that very moment (the room's 'activity' event fires before a practice or session claims the HUD), quietly,
   * leaving the HUD, her pose and the stop button to it (Codex reviews, 20 Oct: waiting for a timer let a practice start and
   * stop unseen, the hidden minute still saved, and a Stop tap in that window reached the minute instead of the session).
   * Walking away ends it. */
  var caring = null, stepMs = CARE_STEP * 1000;
  function other() { return !!(R.sessionOn() || (R.practiceOn && R.practiceOn())); }
  function busyToast() { if (caring && caring.kind === 'brew') R.toast('Finish the cup first.', 'local_cafe'); else R.toast('Finish the minute with the plant first.', 'potted_plant'); }
  /* one minute on the HUD, for a plant (care) or a cup of tea (brew): four lines a quarter-minute apart, Stop at any time */
  function runMinute(c, lines, pose) {
    caring = Object.assign(c, { startedAt: Date.now(), timers: [], done: false });
    R.hudOn(true, c.title); R.caption(lines[0]);
    R.setPose(pose); R.els.avatar.classList.add('acting');
    lines.forEach(function (line, i) { if (i) caring.timers.push(root.setTimeout(function () { if (!caring || caring.done) return; if (other()) return stepAside(); R.caption(line); R.chime('bell', true); }, i * stepMs)); });
    caring.timers.push(root.setTimeout(function () { if (!caring || caring.done) return; if (other()) return stepAside(); finishCare(true); }, lines.length * stepMs));
    R.setHudStop(function () { if (!caring) return false; finishCare(false); return true; });
  }
  function startCare(id) {
    var p = plant(id); if (!p || caring || napping()) return;
    R.hideSheet();
    if (other() || R.busy()) { R.toast('Finish what you are doing first.', 'info'); return; }
    var it = info(p, root.OvuHerbs);
    runMinute({ kind: 'care', id: id, name: it ? it.name : 'a plant', title: it ? it.name : 'A plant' }, careLines(p), 'plants');
  }
  /* the tea practice: warmth, steam, the first sip. Nothing is used or saved until the minute is done; Stop keeps the herb */
  function startBrew(herb) {
    var h = HERBS[herb]; if (!h || caring || napping()) return;
    R.hideSheet();
    if (other() || R.busy()) { R.toast('Finish what you are doing first.', 'info'); return; }
    if (inBasket(S, herb) < 1) { R.toast('No ' + h.name.toLowerCase() + ' in the basket yet. Pick some from a planter first.', 'shopping_basket'); return; }
    runMinute({ kind: 'brew', id: herb, name: h.cup, title: h.cup }, brewLines(herb), 'coffee');
  }
  function stepAside() { var c = caring; if (!c) return; c.done = true; c.timers.forEach(root.clearTimeout); caring = null; R.setHudStop(null); }
  /* leaving, walking off, or anything else that cuts it short: if a practice or session now owns the HUD, just step aside */
  function cutShort() { if (!caring) return; if (other()) stepAside(); else finishCare(false); }
  function finishCare(completed) {
    var c = caring; if (!c || c.done) return; c.done = true;
    c.timers.forEach(root.clearTimeout); caring = null; R.setHudStop(null);
    R.hudOn(false); R.els.avatar.classList.remove('acting'); R.restorePose();
    if (c.kind === 'brew') return finishBrew(c, completed);
    if (!completed) { R.toast('Stopped. Thank you for the moment you gave it.', 'potted_plant'); return; }
    var ever = S.list('mindfulness').some(function (e) { return e.data && e.data.practice === 'greenhouse'; }), ev = null;
    try { ev = S.add('mindfulness', S.today(), { kind: 'informal', first: !ever, practice: 'greenhouse', plant: c.id, minutes: 1, completed: true, startedAt: new Date(c.startedAt).toISOString(), guide: 'Greenhouse, one mindful minute with the ' + c.name.toLowerCase() }); } catch (e) { R.toast('The minute could not be saved: ' + e.message, 'error'); }
    if (ev) R.afterSave(ev, 'One mindful minute in the greenhouse.');
  }
  /* a finished cup uses one from the basket and says the practice thank-you if today still has one; it writes no diary entry */
  function finishBrew(c, completed) {
    if (!completed) { R.toast('Stopped. The ' + HERBS[c.id].name.toLowerCase() + ' is still in your basket.', 'local_cafe'); return; }
    var r = brewCup(S, root.OvuRewards, c.id);
    if (!r.ok) { R.toast(r.why, 'info'); return; }
    var line = R.moment ? R.moment('brew', { quiet: true }) : '';
    R.chime('save'); if (R.renderDeck) R.renderDeck();
    R.toast(c.name + ', sipped slowly.' + (r.points ? ' A thank-you of ' + r.points + ' hearts for the practice.' : ''), 'local_cafe', line);
  }

  /* ---------- the herb planters: tap one, she walks over, and its sheet opens ---------- */
  var ST = function () { return root.OvuStamina; };
  function liveSlow() { return root.OvuCare && root.OvuCare.live ? root.OvuCare.live() : null; }
  function canAct(name) { var st = ST(); if (!st || st.can(name)) return true; R.toast('Too tired for that. Energy comes back with a night’s sleep, or with the new day.', 'bedtime'); return false; }
  function tapBed(el) {
    var hb = herbBed(el.dataset.bed); if (!hb || napping() || caring || liveSlow()) return;
    R.chime('tap'); R.cancelIdle(); if (root.OvuWalk.walking()) root.OvuWalk.stop();
    LAYOUT.home.x = hb.wp.x; LAYOUT.home.y = hb.wp.y; LAYOUT.home.flip = !!hb.wp.flip;
    R.walkTo(hb.wp, function () { if (!R.busy()) openHerbBed(hb.id); });
  }
  function slowStep(box, o, done) {
    if (!root.OvuCare || !root.OvuCare.step) { done(); return; }
    root.OvuCare.step(box, Object.assign({ scene: 'greenhouse' }, o, { ms: GH.slowMs == null ? o.ms : GH.slowMs }), done);
  }
  function openHerbBed(id) {
    var hb = herbBed(id); if (!hb || napping()) return;
    var d = day(), g = herbState(S), b = g.beds[id], h = b ? HERBS[b.herb] : null, n = HERB_BEDS.indexOf(hb) + 1;
    var html = '<div class="bedcard"><div class="bedpic herbpic">' + herbSVG(b, d) + '</div><div class="bedtext">';
    if (h) html += '<b>' + esc(h.name) + '</b><span>' + (herbRipe(b) ? 'Ready to pick.' : herbDays(b) + ' of ' + herbNeed(b) + ' watered days' + (b.cuts ? ' until it is ready again' : '') + '. ' + (herbWateredToday(b, d) ? 'Watered today.' : 'Not watered yet today.')) + '</span>' +
      '<span class="canline"><span class="ms">shopping_basket</span>In the basket: ' + inBasket(S, b.herb) + '</span>';
    else html += '<b>An empty planter</b><span>' + (HERB_IDS.some(function (k) { return g.seeds[k] > 0; }) ? 'Plant one of your herbs.' : 'Herbs to plant come from Hay & Harvest on Harbour Lane: ginger, lemongrass, pandan and chamomile.') + '</span>';
    html += '</div></div><div class="' + (h ? 'row' : 'seedlist') + '" id="herbActs">';
    if (!h) HERB_IDS.forEach(function (k) { if (g.seeds[k] > 0) html += '<button type="button" class="btn soft" data-herb="plant" data-kind="' + k + '"><span class="ms">spa</span><span><b>' + esc(HERBS[k].name) + '</b><small>ready in ' + HERBS[k].ripe + ' watered days · have ' + g.seeds[k] + '</small></span></button>'; });
    else if (herbRipe(b)) html += '<button type="button" class="btn primary" data-herb="pick"><span class="ms">shopping_basket</span>Pick slowly</button>';
    else if (herbWateredToday(b, d)) html += '<button type="button" class="btn primary" disabled><span class="ms">water_drop</span>Watered today</button>';
    else html += '<button type="button" class="btn primary" data-herb="water"><span class="ms">water_drop</span>Water slowly</button>';
    if (h && inBasket(S, b.herb) > 0) html += '<button type="button" class="btn soft" data-herb="brew"><span class="ms">local_cafe</span>Brew a cup</button>';
    html += '</div>';
    if (h) html += '<p class="help">' + esc(h.name) + ' comes back after each picking, ready again in ' + h.regrow + ' watered days. A missed day adds nothing and takes nothing away. <button type="button" class="linkbtn" id="herbClear">Let this planter go</button></p>';
    else html += '<p class="help">A herb grows by the days it is watered, and comes back after each picking. Planting, watering and picking take a little energy.</p>';
    R.openSheet('ghbed', 'Planter ' + n, 'The greenhouse herbs', 'yard', html);
    var clr = doc.getElementById('herbClear'); if (clr) clr.addEventListener('click', function () {
      if (!clr.classList.contains('confirm')) { clr.classList.add('confirm'); clr.textContent = 'Tap again: the ' + h.name.toLowerCase() + ' here is let go'; return; }
      var r = clearHerb(S, id); if (!r.ok) { R.toast(r.why, 'info'); return; }
      R.chime('tap'); renderBeds(); R.toast('The planter is empty, ready for something new.', 'yard'); openHerbBed(id);
    });
    var acts = doc.getElementById('herbActs'); if (!acts) return;
    acts.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-herb]'); if (!btn || btn.disabled || liveSlow()) return;
      var kind = btn.dataset.herb, now = day();
      if (kind === 'brew') { openBrew(b.herb); return; }
      if (now !== d) { openHerbBed(id); return; } /* midnight passed with the sheet open: redraw it for today first */
      var cost = { plant: 'plant', water: 'water', pick: 'harvest' }[kind]; if (!canAct(cost)) return;
      var herb = btn.dataset.kind, seen = JSON.stringify(herbState(S).beds[id] || null);
      var o = kind === 'plant' ? { ms: 2200, moment: 'herbplant', verb: 'Pressing it into the soil…' } : kind === 'water' ? { ms: 3000, moment: 'herbwater', verb: 'Pouring slowly…' } : { ms: 3000, moment: 'herbharvest', verb: 'Picking slowly…' };
      o.cancel = function () { openHerbBed(id); };
      slowStep(acts, o, function () {
        var t = day(); if (t !== now) { openHerbBed(id); return; }
        if (JSON.stringify(herbState(S).beds[id] || null) !== seen) { R.toast('The planter changed in the meantime. Have another look.', 'info'); openHerbBed(id); return; } /* another tab or phone moved first */
        var res = kind === 'plant' ? plantHerb(S, id, herb, t, ST()) : kind === 'water' ? waterHerb(S, id, t, ST()) : harvestHerb(S, id, ST());
        if (!res.ok) { R.toast(res.why, res.tired ? 'bedtime' : 'info'); openHerbBed(id); return; }
        R.chime('save'); renderBeds();
        if (kind === 'plant') R.toast(HERBS[herb].name + ' planted. Water it when you are ready.', 'spa');
        if (kind === 'water') R.toast(res.ripe ? 'Ready to pick. Tap the planter again.' : 'Watered. ' + res.days + ' of ' + res.need + ' days.', 'water_drop');
        if (kind === 'pick') R.toast(res.n + ' ' + HERBS[res.herb].plural + ' into the basket. It grows again in ' + res.again + ' watered days.', 'shopping_basket');
        openHerbBed(id);
      });
    });
  }
  /* before the cup: what is in the basket, and the research card when the tea list has one for this herb */
  function openBrew(herb) {
    var h = HERBS[herb]; if (!h || napping()) return;
    var have = inBasket(S, herb), Hb = root.OvuHerbs, Gd = root.OvuGarden && root.OvuGarden.herb, pf = S.profile() || {};
    var tea = h.tea && Hb ? Hb.TEAS.filter(function (t) { return t.id === h.tea; })[0] : null;
    var html = '<p class="mindline"><span class="ms">local_cafe</span><span>Warmth in your hands, the steam, then the first sip. One minute; stop whenever you like.</span></p>' +
      (Gd && Gd.careful(pf) ? Gd.carefulHTML(pf) : '') +
      '<div class="row"><button type="button" class="btn primary" id="brewGo"' + (have ? '' : ' disabled') + '><span class="ms">local_cafe</span>Brew a cup</button>' +
      (tea ? '<button type="button" class="btn soft" id="brewCard"><span class="ms">menu_book</span>What research says</button>' : '') + '</div>' +
      '<p class="help">' + (have ? 'A finished cup uses one from your basket (' + have + ' there now). Stopping keeps it.' : 'Nothing in the basket yet. Pick some from a planter first.') + ' Nothing is written in your diary.</p>' +
      (tea ? '' : '<p class="help">The tea list has no research card for ' + esc(h.name.toLowerCase()) + ' yet, so this cup is simply for the moment.</p>');
    R.openSheet('ghbrew', h.cup, 'A mindful cup in the greenhouse', 'local_cafe', html);
    var go = doc.getElementById('brewGo'); if (go) go.addEventListener('click', function () { if (caring) return busyToast(); startBrew(herb); });
    var cd = doc.getElementById('brewCard'); if (cd) cd.addEventListener('click', function () { R.chime('tap'); openCard(h.tea); });
  }
  /* the tea table: the full tea list as before, with a row to brew from the basket when there is something to brew */
  function brewRow() {
    if (R.sheetId && R.sheetId() !== 'greenhouse') return; /* only on the tea list itself, never on a plant card that shares its classes */
    var sec = doc.querySelector('#sheetBody .dsec.teas'); if (!sec) return;
    var ready = HERB_IDS.filter(function (k) { return inBasket(S, k) > 0; });
    var row = doc.createElement('div'); row.className = 'ghbrewrow';
    row.innerHTML = '<p class="shelf"><span class="ms">shopping_basket</span>Brew from your harvest</p>' + (ready.length ? '<div class="chips">' + ready.map(function (k) { return '<button type="button" class="chipbtn" data-brew="' + k + '">' + esc(HERBS[k].cup) + ' <small>' + inBasket(S, k) + ' in the basket</small></button>'; }).join('') + '</div>'
      : '<p class="help">Ginger, lemongrass, pandan and chamomile grow in the planters by the door. Pick some, and brew it here.</p>');
    var ml = sec.querySelector('.mindline'); sec.insertBefore(row, ml ? ml.nextSibling : sec.firstChild);
    row.addEventListener('click', function (e) { var b = e.target.closest('[data-brew]'); if (!b) return; R.chime('tap'); openBrew(b.dataset.brew); });
  }
  R.hotspotHandlers.ghdoor = function (id, L) { if (!inside(L)) return false; root.OvuWalk.travel('garden'); return true; };
  R.hotspotHandlers.teatable = function (id, L) { if (!inside(L)) return false; if (caring) { busyToast(); return true; } if (root.OvuGarden && root.OvuGarden.openGreenhouse) { root.OvuGarden.openGreenhouse(); brewRow(); } return true; };
  R.on('boot', function () {
    R.on('props', function (L) { render(L); });
    R.on('layout', function (L) { cutShort(); render(L); });
    R.on('beforeWalk', cutShort);
    doc.addEventListener('visibilitychange', function () { if (doc.hidden && caring) cutShort(); }); /* away from the app is not a mindful minute (persona walk, 21 Oct) */ /* walking away ends the minute (a practice that moves her takes over instead) */
    R.on('activity', function () { stepAside(); }); /* a practice or session is starting: hand the HUD over now */
    if (root.OvuGameTime && root.OvuGameTime.onNewDay) root.OvuGameTime.onNewDay(function () { renderBeds(); }); /* a new day dries the soil */
    if (S.subscribe) S.subscribe(function (reason) { if (reason === 'external' || String(reason).indexOf('sync') === 0) renderBeds(); }); /* another tab moved a planter */
    R.els.props.addEventListener('click', function (e) { var p = e.target.closest('.ghplant.tappable'); if (p) { e.stopPropagation(); tapPlant(p); return; } var hb = e.target.closest('.ghbed'); if (hb) { e.stopPropagation(); tapBed(hb); } });
    R.els.props.addEventListener('keydown', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; var p = e.target.closest('.ghplant.tappable'); if (p) { e.preventDefault(); tapPlant(p); return; } var hb = e.target.closest('.ghbed'); if (hb) { e.preventDefault(); tapBed(hb); } });
  });
  GH.render = render; GH.openCard = openCard; GH.startCare = startCare; GH.finishCare = finishCare; GH.caring = function () { return caring ? caring.id : null; };
  GH.brewing = function () { return caring && caring.kind === 'brew' ? caring.id : null; };
  GH.renderBeds = renderBeds; GH.openHerbBed = openHerbBed; GH.openBrew = openBrew; GH.startBrew = startBrew; GH.slowMs = null;
  GH.setPace = function (ms) { stepMs = ms > 0 ? ms : CARE_STEP * 1000; }; /* tests only: the same four lines, faster */
})(window);
