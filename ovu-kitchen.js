/* Rhythme farm kitchen (farm-loop design step 3, 21 Oct): kitchen staples bought at Hay & Harvest, recipes made from the
 * basket, the barn's eggs and those staples, and cooking as a short guided practice (wash, chop, smell, taste) with Stop
 * at any time. It ends with the dish and "Did you eat something like this today?": Yes opens the food diary filled in,
 * and only her own save there writes anything; No opens nothing. Cooking uses up its ingredients in one save, earns no
 * hearts, costs no energy (the design lists it with tea, as a practice) and writes no diary entry. Staples cost hearts
 * through OvuRewards.spend, the hearts and the staple in one save. Staples live in state.farm.kitchen; eggs are the barn's
 * pantry eggs (state.farm.pantry.egg), never a second count.
 * Fish and the Learn dishes (Jamie, 23 Oct: "those dishes are learn can we cook those dishes in the app? like cod fish dishes then
 * we should be fishing for codfish.. or purchase at the grocers"): six Learn recipes cook here too. Cod does not swim in
 * Singapore's harbour, so Hay & Harvest sells cod fillets; a white fish caught at the harbour can be kept for the kitchen
 * (state.farm.kitchen.fish), and a recipe's `fish` is either, the caught fish used first.
 * Design: docs/design/2026-10-21-farm-kitchen.md. Pure rules first (testable in node), then the sheets. */
(function (root) {
  'use strict';
  /* one purchase is one portion, enough for one dish; eggs go to the barn's pantry */
  /* each staple's picture (assets/food): the grocer shows it on the tile (Jamie, 22 Oct: "I need pic") */
  var STAPLE_PIC = { rice: 'staple-rice', egg: 'eggs', noodles: 'staple-noodles', tofu: 'staple-tofu', garlic: 'staple-garlic', coconut: 'staple-coconut', honey: 'staple-honey', yoghurt: 'greek-yogurt',
    cod: 'staple-cod', salmon: 'salmon', olives: 'staple-olives', chickpeas: 'chickpeas', broccoli: 'broccoli', sesame: 'sesame-seeds', lemon: 'citrus', fish: 'staple-cod' }; /* cod and olives: made from the salmon and blueberry pictures (tools/art/kitchen_art.py) */
  function staplePic(k) { return '<img class="croppic" src="assets/food/' + (STAPLE_PIC[k] || 'eggs') + '.webp" alt="">'; }
  var STAPLES = {
    rice: { name: 'Rice', cost: 2, icon: 'rice_bowl' },
    egg: { name: 'Eggs', cost: 3, icon: 'egg', pantry: true, pl: true },
    noodles: { name: 'Noodles', cost: 2, icon: 'ramen_dining', pl: true },
    tofu: { name: 'Tofu', cost: 3, icon: 'square' },
    garlic: { name: 'Garlic', cost: 2, icon: 'spa' },
    coconut: { name: 'Coconut milk', cost: 3, icon: 'water_full' },
    honey: { name: 'Honey', cost: 4, icon: 'emoji_nature' },
    yoghurt: { name: 'Yoghurt', cost: 3, icon: 'icecream' },
    /* for the Learn dishes (23 Oct) */
    cod: { name: 'Cod fillet', cost: 5, icon: 'set_meal' },
    salmon: { name: 'Canned salmon', cost: 4, icon: 'set_meal' },
    olives: { name: 'Olives', cost: 3, icon: 'eco' },
    chickpeas: { name: 'Chickpeas', cost: 2, icon: 'grain' },
    broccoli: { name: 'Broccoli', cost: 2, icon: 'nature' },
    sesame: { name: 'Sesame seeds', cost: 2, icon: 'grain' },
    lemon: { name: 'Lemon', cost: 2, icon: 'nutrition' }
  };
  /* a white fish kept from the harbour (ovu-harbour.js keep), counted in the kitchen beside the staples; never sold */
  var FISH = { fish: 'White fish' };
  var KEEP = Object.keys(STAPLES).filter(function (k) { return !STAPLES[k].pantry; }).concat(Object.keys(FISH));
  /* herbs a recipe needs: grown in the greenhouse planters (ovu-greenhouse.js, farm-loop step 4) and picked into the farm basket under these keys */
  var HERBS = { ginger: 'Ginger', pandan: 'Pandan' };
  var STEPS = [
    { id: 'wash', name: 'Wash', icon: 'water_drop', moment: 'cookwash' },
    { id: 'chop', name: 'Chop', icon: 'restaurant', moment: 'cookchop' },
    { id: 'smell', name: 'Smell', icon: 'air', moment: 'cooksmell' },
    { id: 'taste', name: 'Taste', icon: 'soup_kitchen', moment: 'cooktaste' }
  ];
  var STEP_MS = 15000; /* four steps, about a minute in all */
  /* the design's first recipes, with the farm's crops (its bok choy is the farm's pak choy). `soon` waits for a herb;
   * `added` marks the two dishes that give the noodles and the tofu a use (not in the design: a question for Jamie) */
  var RECIPES = [
    { id: 'garlicpakchoy', name: 'Garlic pak choy', icon: 'skillet', needs: { pakchoy: 2, garlic: 1 }, steps: ['Rinsing the pak choy, leaf by leaf…', 'Slicing the garlic thinly…', 'Garlic warming in the pan…', 'Tasting one soft leaf…'] },
    { id: 'kangkongfry', name: 'Kangkong stir-fry', icon: 'skillet', needs: { kangkong: 2, garlic: 1 }, steps: ['Rinsing the kangkong under cool water…', 'Cutting the stems, then the leaves…', 'The kangkong wilting with the garlic…', 'Tasting one bite…'] },
    { id: 'tomatoegg', name: 'Tomato and egg', icon: 'egg_alt', needs: { tomato: 2, egg: 1, rice: 1 }, steps: ['Rinsing the tomatoes and the rice…', 'Cutting the tomatoes into wedges…', 'Tomato and egg in the warm pan…', 'Tasting it with a little rice…'] },
    { id: 'pumpkinsoup', name: 'Pumpkin soup', icon: 'soup_kitchen', needs: { pumpkin: 1, coconut: 1 }, steps: ['Washing the pumpkin skin…', 'Cutting the pumpkin into chunks…', 'The soup simmering with coconut milk…', 'Tasting one warm spoonful…'] },
    { id: 'carrotradish', name: 'Carrot and radish salad', icon: 'nutrition', needs: { carrot: 1, radish: 1, honey: 1 }, steps: ['Scrubbing the carrot and the radish…', 'Cutting thin rounds…', 'A drizzle of honey over the bowl…', 'Tasting one crisp slice…'] },
    { id: 'strawberrybowl', name: 'Strawberry yoghurt bowl', icon: 'icecream', needs: { strawberry: 2, yoghurt: 1, honey: 1 }, steps: ['Rinsing the strawberries…', 'Halving each strawberry…', 'Honey over the cool yoghurt…', 'Tasting one spoonful…'] },
    { id: 'pakchoynoodles', name: 'Pak choy noodle soup', icon: 'ramen_dining', added: true, needs: { pakchoy: 1, noodles: 1, garlic: 1 }, steps: ['Rinsing the pak choy…', 'Slicing the garlic…', 'The broth and noodles steaming…', 'Tasting one slow sip…'] },
    { id: 'tomatotofu', name: 'Tomato tofu with rice', icon: 'rice_bowl', added: true, needs: { tomato: 2, tofu: 1, rice: 1 }, steps: ['Rinsing the tomatoes and the rice…', 'Cutting the tofu into cubes…', 'Tomato and tofu bubbling gently…', 'Tasting it with a little rice…'] },
    { id: 'sweetpotatoginger', name: 'Sweet potato ginger soup', icon: 'soup_kitchen', needs: { sweetpotato: 1, ginger: 1 }, steps: ['Scrubbing the sweet potato…', 'Cutting it into chunks, slicing the ginger…', 'The soup simmering, ginger rising in the steam…', 'Tasting one warm spoonful…'] },
    /* the Learn dishes (ovu-recipes.js): `learn` is the Learn card, whose page holds the real recipe; the needs are its main
     * ingredients as the farm and Hay & Harvest have them, and `whitefish` is a cod fillet or a white fish she kept */
    { id: 'codtomato', learn: 'cod', name: 'Cod with tomatoes and olives', icon: 'set_meal', needs: { whitefish: 1, tomato: 2, olives: 1 }, steps: ['Rinsing the tomatoes, patting the fish dry…', 'Cutting the tomatoes, halving the olives…', 'The fish simmering in tomato and olive oil…', 'Tasting one soft flake…'] },
    { id: 'fishkebabs', learn: 'kebabs', name: 'Fish and vegetable kebabs', icon: 'outdoor_grill', needs: { whitefish: 1, tomato: 1, lemon: 1 }, steps: ['Rinsing the tomatoes and the lemon…', 'Cutting the fish into cubes, threading the skewers…', 'The kebabs on the grill, lemon squeezed over…', 'Tasting one piece…'] },
    { id: 'salmoncroquettes', learn: 'salmon', name: 'Gingered salmon croquettes', icon: 'set_meal', needs: { salmon: 1, ginger: 1, egg: 1 }, steps: ['Draining the salmon, keeping the soft bones…', 'Grating the ginger, beating the egg…', 'Little cakes browning in the pan…', 'Tasting one warm croquette…'] },
    { id: 'tofusesame', learn: 'tofu', name: 'Tofu and sesame stir-fry', icon: 'ramen_dining', needs: { tofu: 1, broccoli: 1, sesame: 1 }, steps: ['Rinsing the broccoli…', 'Cutting the tofu into cubes, the broccoli into florets…', 'Tofu and broccoli in the hot pan, sesame on top…', 'Tasting one bite…'] },
    { id: 'frittata', learn: 'frittata', name: 'Vegetable frittata', icon: 'egg', needs: { egg: 2, tomato: 1, pumpkin: 1 }, steps: ['Washing the tomato and the pumpkin…', 'Slicing the vegetables, whisking the eggs…', 'The frittata setting slowly in the pan…', 'Tasting one warm slice…'] },
    { id: 'hummus', learn: 'hummus', name: 'Chunky hummus with carrot sticks', icon: 'tapas', needs: { chickpeas: 1, garlic: 1, carrot: 1 }, steps: ['Rinsing the chickpeas, scrubbing the carrot…', 'Crushing the garlic, cutting carrot sticks…', 'Mashing the chickpeas, chunky, with the garlic…', 'Tasting one dip…'] },
    { id: 'pandanrice', name: 'Pandan rice', icon: 'rice_bowl', needs: { pandan: 1, rice: 1 }, steps: ['Rinsing the rice, knotting the pandan leaf…', 'Rice and pandan into the pot…', 'The rice steaming, the pandan scent filling the kitchen…', 'Tasting one spoonful…'] }
  ];

  function FM() { return root.OvuFarm; }
  function recipe(id) { return RECIPES.filter(function (r) { return r.id === id; })[0] || null; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function n0(v) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? n : 0; }
  function cap() { return (FM() && FM().PANTRY_CAP) || 99; }
  /* the staples she keeps, cleaned on every read: known staples, whole numbers, at most the pantry's cap */
  function kitchenOf(f) {
    var k = (f && f.kitchen) || {}, out = {};
    Object.keys(k).forEach(function (id) { if (!STAPLES[id] && /^[a-z]{1,24}$/.test(id) && n0(k[id])) out[id] = Math.min(cap(), n0(k[id])); }); /* a newer build's staple is carried, never dropped */
    KEEP.forEach(function (id) { out[id] = Math.min(cap(), n0(k[id])); }); return out;
  }
  function farm(S) { var f = FM().farmState(S); f.kitchen = kitchenOf(f); return f; }
  /* how many of one ingredient she has: a crop from the basket, an egg from the pantry, a staple from the kitchen */
  function have(f, key) {
    if (FM().CROPS[key]) return n0(f.harvest && f.harvest[key]);
    if (key === 'egg') return n0(f.pantry && f.pantry.egg);
    if (STAPLES[key]) return n0(f.kitchen && f.kitchen[key]);
    if (HERBS[key]) return n0(f.harvest && f.harvest[key]); /* greenhouse herbs are picked into the basket */
    if (FISH[key]) return n0(f.kitchen && f.kitchen[key]);
    if (key === 'whitefish') return n0(f.kitchen && f.kitchen.fish) + n0(f.kitchen && f.kitchen.cod); /* a caught white fish or a cod fillet */
    return 0;
  }
  function label(key, n) {
    var c = FM().CROPS[key];
    if (c) return n === 1 ? c.name.toLowerCase() : c.plural;
    if (key === 'egg') return n === 1 ? 'egg' : 'eggs';
    if (STAPLES[key]) return STAPLES[key].name.toLowerCase();
    if (key === 'whitefish') return n === 1 ? 'white fish (a cod fillet, or one you caught)' : 'white fish';
    if (FISH[key]) return FISH[key].toLowerCase();
    return HERBS[key] ? HERBS[key].toLowerCase() : key;
  }
  function needsText(r) { return Object.keys(r.needs).map(function (k) { return r.needs[k] + ' ' + label(k, r.needs[k]); }).join(' · '); }
  function missing(f, r) { return Object.keys(r.needs).filter(function (k) { return have(f, k) < r.needs[k]; }).map(function (k) { return { key: k, need: r.needs[k], have: have(f, k), herb: !!HERBS[k], crop: !!FM().CROPS[k] }; }); }
  function canCook(S, id) {
    var r = recipe(id); if (!r) return { ok: false, why: 'Not a recipe here.' };
    if (r.soon) return { ok: false, soon: true, why: r.name + ' arrives with the greenhouse herbs.' };
    var m = missing(farm(S), r);
    if (m.length) return { ok: false, missing: m, why: 'Still needed: ' + m.map(function (x) { return (x.need - x.have) + ' ' + label(x.key, x.need - x.have); }).join(', ') + '.' };
    return { ok: true, recipe: r };
  }
  function ready(S) { return RECIPES.filter(function (r) { return canCook(S, r.id).ok; }).map(function (r) { return r.id; }); }
  /* the dish is made: every ingredient goes in one save, or nothing does; no hearts, no energy, no diary entry */
  function cook(S, id) {
    var c = canCook(S, id); if (!c.ok) return c;
    var r = c.recipe, f = copy(farm(S)), RN = root.OvuRanch;
    if (n0(f.dishes && f.dishes[r.id]) >= 99) return { ok: false, why: 'Your bag already holds 99 of this dish. Give some away first.' }; /* refuse before anything is used (Codex, 22 Oct) */
    Object.keys(r.needs).forEach(function (k) {
      var n = r.needs[k];
      if (FM().CROPS[k] || HERBS[k]) { f.harvest[k] = n0(f.harvest[k]) - n; if (!f.harvest[k]) delete f.harvest[k]; }
      else if (k === 'egg') { f.pantry.egg = n0(f.pantry.egg) - n; if (RN) f = RN.takeProduct(f, 'egg', n).farm; /* the size mix follows the eggs out */ }
      else if (k === 'whitefish') { var own = Math.min(n, n0(f.kitchen.fish)); f.kitchen.fish = n0(f.kitchen.fish) - own; f.kitchen.cod = n0(f.kitchen.cod) - (n - own); } /* her own catch first, then a bought fillet */
      else f.kitchen[k] = n0(f.kitchen[k]) - n;
    });
    /* the dish stays in her bag, Harvest Moon style (Jamie, 22 Oct: "dishes can be used to court the NPC"): up to 99 of each; game state only */
    f.dishes = Object.assign({}, f.dishes || {}); f.dishes[r.id] = Math.min(99, n0(f.dishes[r.id]) + 1);
    try { if (S.commit) S.commit({ farm: f }); else S.setState({ farm: f }); } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; } /* commit: a failed save leaves memory as it was */
    return { ok: true, recipe: r };
  }
  /* a staple from the grocer: the hearts and the staple in one save (OvuRewards.spend writes both) */
  function buyStaple(S, RW, id) {
    var st = STAPLES[id]; if (!st) return { ok: false, why: 'Not on the shelf.' };
    var f = copy(farm(S)), n = st.pantry ? n0(f.pantry.egg) : n0(f.kitchen[id]);
    if (n >= cap()) return { ok: false, why: 'The kitchen has all the ' + st.name.toLowerCase() + ' it can hold.' };
    if (st.pantry) { f.pantry.egg = n + 1; if (root.OvuRanch) f = root.OvuRanch.addProduct(f, 'egg', 'small', 1); } else f.kitchen[id] = n + 1; /* a grocer egg is a small one */
    try { RW.spend(st.cost, 'staple:' + id, { farm: f }); } catch (e) { return { ok: false, why: e.message }; }
    return { ok: true, id: id, have: n + 1 };
  }
  /* a white fish kept at the harbour goes in the kitchen; refused at the pantry's cap, before anything else changes */
  function keepFish(S, extra) {
    var f = copy(farm(S)), n = n0(f.kitchen.fish);
    if (n >= cap()) return { ok: false, why: 'The kitchen already holds all the fish it can.' };
    f.kitchen.fish = n + 1;
    var patch = Object.assign({ farm: f }, extra || {});
    try { if (S.commit) S.commit(patch); else S.setState(patch); } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; }
    return { ok: true, have: n + 1 };
  }
  function forLearn(id) { return RECIPES.filter(function (r) { return r.learn === id; })[0] || null; }
  function staplesOf(S) { var f = farm(S), out = {}; Object.keys(STAPLES).forEach(function (k) { out[k] = have(f, k); }); return out; }
  /* where she can cook: the farm's basket, and a home whose plate draws a kitchen (only the family home today) */
  var STOVES = ['familyhome'];
  var K = { STAPLES: STAPLES, FISH: FISH, keepFish: keepFish, forLearn: forLearn, HERBS: HERBS, STEPS: STEPS, STEP_MS: STEP_MS, RECIPES: RECIPES, STOVES: STOVES, recipe: recipe, kitchenOf: kitchenOf, have: have, label: label, needsText: needsText, missing: missing, canCook: canCook, ready: ready, cook: cook, buyStaple: buyStaple, staplesOf: staplesOf, stepMs: null };
  root.OvuKitchen = K; K.staplePic = staplePic; K.STAPLE_PIC = STAPLE_PIC;

  /* ---------- the sheets ---------- */
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, doc = root.document;
  if (!R || !S || !doc || !doc.createElement || !FM()) return;
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mind(text) { return text ? '<p class="mindline"><span class="ms">spa</span><span>' + esc(text) + '</span></p>' : ''; }
  function where() { var L = R.layout(); return L ? L.id : null; }
  function stockLine(S) {
    var s = staplesOf(S), bits = Object.keys(STAPLES).filter(function (k) { return s[k] > 0; }).map(function (k) { return STAPLES[k].name.toLowerCase() + ' ' + s[k]; }), fish = have(farm(S), 'fish');
    if (fish) bits.push('white fish you kept ' + fish);
    return '<p class="help pantryline"><span class="ms">kitchen</span>' + (bits.length ? 'In the kitchen: ' + esc(bits.join(', ')) + '.' : 'No staples yet. Hay & Harvest on Harbour Lane sells rice, eggs, garlic and more.') + '</p>';
  }
  function state(r, c) {
    if (r.soon) return 'Arrives with the greenhouse herbs';
    if (c.ok) return 'Ready to cook';
    var m = c.missing || [], hint = function (x) { return x.herb ? 'greenhouse' : x.crop ? 'grow' : x.key === 'egg' ? 'hen house or Hay & Harvest' : x.key === 'whitefish' ? 'Hay & Harvest, or keep one at the harbour' : 'Hay & Harvest'; }; /* a herb is picked in the greenhouse; the grocer sells only its start (Codex re-check) */
    return 'Needs ' + m.map(function (x) { return (x.need - x.have) + ' ' + label(x.key, x.need - x.have) + ' (' + hint(x) + ')'; }).join(', ');
  }
  function openKitchen() {
    var here = where();
    var list = RECIPES.map(function (r) { var c = canCook(S, r.id); return '<button type="button" class="btn soft" data-recipe="' + r.id + '"' + (c.ok ? '' : ' disabled') + '><img class="croppic dishlist" src="assets/food/dish-' + r.id + '.webp" alt=""><span><b>' + esc(r.name) + '</b><small>' + esc(needsText(r)) + ' · ' + esc(state(r, c)) + '</small></span></button>'; }).join('');
    R.openSheet('kitchen', here === 'farm' ? 'Cook from the basket' : 'The kitchen', 'A dish, one step at a time', 'skillet',
      mind('Choose one dish. Cooking here is slow on purpose.') + '<div class="seedlist one" id="kitchenList">' + list + '</div>' + stockLine(S) +
      '<p class="help">Cooking uses what the dish needs from the basket and the pantry. It earns no hearts, takes no energy and logs nothing for you.</p>');
    var box = doc.getElementById('kitchenList'); if (box) box.addEventListener('click', function (e) { var b = e.target.closest('[data-recipe]'); if (!b || b.disabled) return; R.chime('tap'); openRecipe(b.dataset.recipe); });
  }
  function stepsHTML(r, at) { return '<ol class="farmsteps cooksteps" id="cookSteps">' + STEPS.map(function (s, i) { return '<li class="' + (i < at ? 'done' : i === at ? 'on' : '') + '"><span class="ms">' + (i < at ? 'check' : s.icon) + '</span><span><b>' + s.name + '</b><small>' + esc(r.steps[i]) + '</small></span></li>'; }).join('') + '</ol>'; }
  /* a Learn dish names its real recipe and opens the source's own page; the cooking here is the game's short version */
  function learnLine(r) {
    var L = r.learn && root.OvuRecipes && root.OvuRecipes.byId(r.learn); if (!L) return '';
    return '<p class="help learnline"><span class="ms">menu_book</span><span>From Learn: <b>' + esc(L.title) + '</b> (' + esc(L.src) + '), the full recipe for your real kitchen.</span><button type="button" class="srcinfo" data-src="' + esc(L.url) + '" data-srct="' + esc(L.title) + '" aria-label="About this source"><span class="ms">info</span></button></p>';
  }
  function openRecipe(id) {
    var r = recipe(id); if (!r) return; var c = canCook(S, id);
    R.openSheet('kitchen-recipe', r.name, needsText(r), r.icon, '<div class="dishpic"><img src="assets/food/dish-' + r.id + '.webp" alt="' + esc(r.name) + '"></div>' + stepsHTML(r, -1) +
      '<div class="row" id="cookActs">' + (c.ok ? '<button type="button" class="btn primary" id="cookBegin"><span class="ms">skillet</span>Begin cooking</button>' : '') + '<button type="button" class="btn soft" id="cookBack"><span class="ms">arrow_back</span>All dishes</button></div>' +
      (c.ok ? '' : '<p class="help">' + esc(c.why) + '</p>') +
      learnLine(r) +
      '<p class="help">Four short steps, about a minute. Stop at any time and nothing is used.</p>');
    var bk = doc.getElementById('cookBack'); if (bk) bk.addEventListener('click', function () { R.chime('tap'); openKitchen(); });
    var go = doc.getElementById('cookBegin'); if (go) go.addEventListener('click', function () { if (root.OvuCare && root.OvuCare.live && root.OvuCare.live()) return; runStep(r, 0, where()); });
  }
  /* each step is a care step (ovu-care.js): her pose and one line, a soft bar, and Stop, which uses nothing */
  function runStep(r, i, scene) {
    var acts = doc.getElementById('cookActs'), list = doc.getElementById('cookSteps');
    if (!acts) return; /* the sheet was closed or replaced: nothing to run */
    var c = canCook(S, r.id); if (!c.ok) { R.toast(c.why, 'info'); openKitchen(); return; } /* the basket changed under her: nothing is taken */
    if (list) list.outerHTML = stepsHTML(r, i);
    var o = { scene: scene, ms: K.stepMs != null ? K.stepMs : STEP_MS, moment: STEPS[i].moment, verb: STEPS[i].name + ' · ' + r.steps[i], cancel: function () { openRecipe(r.id); } };
    var next = function () { if (i + 1 < STEPS.length) runStep(r, i + 1, scene); else finish(r); };
    if (!(root.OvuCare && root.OvuCare.step)) { next(); return; }
    if (!root.OvuCare.step(acts, o, next)) openRecipe(r.id); /* a step that cannot start leaves the recipe as it was */
  }
  function finish(r) {
    var go = function () { var res = cook(S, r.id); if (!res.ok) { R.toast(res.why, 'info'); openKitchen(); return; } R.chime('save'); openDish(r); };
    if (FM().locked) FM().locked(S, go); else go(); /* the farm lock: another tab's purchase or harvest lands first, then the pot is checked again */
  }
  /* the dish, and one question; Yes opens the food diary filled in, and nothing is saved unless she saves it there */
  function openDish(r) {
    var line = R.moment ? R.moment('cookdish', { quiet: true }) : '';
    R.openSheet('kitchen-dish', r.name, 'On the table', r.icon,
      '<div class="dishpic"><img src="assets/food/dish-' + r.id + '.webp" alt="' + esc(r.name) + '"></div><p>' + esc(r.name) + ' is ready.</p>' + mind(line) +
      '<p><b>Did you eat something like this today?</b></p>' +
      '<div class="row"><button type="button" class="btn primary" id="dishYes"><span class="ms">restaurant</span>Yes, open the diary</button><button type="button" class="btn soft" id="dishNo">No</button></div>' +
      '<p class="help">It is in your bag now, to share. The diary only gets a meal you really ate.</p>');
    var y = doc.getElementById('dishYes'), n = doc.getElementById('dishNo');
    if (y) y.addEventListener('click', function () { R.chime('tap'); if (R.openDiary) R.openDiary('add', { notes: r.name + ', cooked at home', tags: ['home-cooked'] }); else R.hideSheet(); });
    if (n) n.addEventListener('click', function () { R.chime('tap'); R.hideSheet(); });
  }
  /* the counter in a home that draws one: the family home's stove */
  R.hotspotHandlers.stove = function (id, L) { if (!L || STOVES.indexOf(L.id) < 0) return false; if ((W && W.napping && W.napping()) || R.busy()) return true; openKitchen(); return true; };
  K.openKitchen = openKitchen; K.openRecipe = openRecipe; K.openDish = openDish;
})(typeof window !== 'undefined' ? window : this);
