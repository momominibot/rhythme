/* Rhythme farm: a plate behind the garden's path with twelve soil beds, a shed, a well and a basket. Seeds come free
 * from the shed (three a day), a bed grows by the real days it was watered (a missed day adds nothing and takes nothing
 * away), weeds appear on a couple of beds each morning and pause growth until pulled, and a ripe bed is harvested into
 * the basket. Watering, pulling and harvesting cost energy (ovu-stamina.js). Nothing here writes a diary entry: a
 * harvest offers "Log a meal?" and only a tap on that opens the food diary, which saves what she chooses to save.
 * Hearts are not awarded here (the ledger is ovu-rewards.js's); that lever waits for its helper. Pure rules first
 * (testable in node), then the scene wiring. */
(function (root) {
  'use strict';
  var CROPS = {
    radish: { name: 'Radish', plural: 'radishes', days: 2, yield: 2, colour: '#e58fa8', top: '#8fcfae' },
    carrot: { name: 'Carrot', plural: 'carrots', days: 3, yield: 2, colour: '#f3a56e', top: '#7fb894' },
    strawberry: { name: 'Strawberry', plural: 'strawberries', days: 4, yield: 3, colour: '#e35d7a', top: '#6ba88a' },
    tomato: { name: 'Tomato', plural: 'tomatoes', days: 5, yield: 3, colour: '#e0624e', top: '#5f9c7a' },
    pumpkin: { name: 'Pumpkin', plural: 'pumpkins', days: 7, yield: 1, colour: '#f0a04b', top: '#6ba88a' }
  };
  var SEEDS_A_DAY = 3;
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
      { id: 'well', x: 70, y: 38, label: 'Well · fill the watering can', prompt: 'Tap to fill the can', icon: 'water_drop', wp: { x: 66, y: 48, flip: false } },
      { id: 'basket', x: 49, y: 69, label: 'Basket · your harvest', prompt: 'Tap to look in the basket', icon: 'shopping_basket', wp: { x: 41, y: 66, flip: false } }
    ],
    home: { x: 19, y: 56, flip: false },
    zones: [[[48, 30], [95, 52], [86, 61], [68, 70], [50, 74], [6, 56]]], /* the island; its lower-right shore bows out past the bed frame's path */
    solids: [{ id: 'shed', x0: 8, x1: 30, y0: 33, y1: 46 }, { id: 'well', x0: 62, x1: 76, y0: 33, y1: 46 }, { id: 'scarecrow', x0: 45, x1: 57, y0: 25, y1: 36 }, { id: 'tree', x0: 84, x1: 95, y0: 44, y1: 52 } /* the trunk; she may walk under the canopy, and the path to the well runs between the beds and the trunk */, { id: 'basket', x0: 42, x1: 56, y0: 65, y1: 72 },
      { id: 'beds1', x0: 30, x1: 50, y0: 48, y1: 58 }, { id: 'beds2', x0: 44, x1: 64, y0: 44, y1: 62 }, { id: 'beds3', x0: 60, x1: 78, y0: 50, y1: 58 }],
    doors: [{ id: 'farmgate', to: 'garden', x: 15, y: 57, r: 5, flip: true }],
    /* the beds are not hotspots (twelve orbs would smother the plate): they are drawn by this module and offered as prompts */
    prompts: STANDS.map(function (s) { return { id: s.id, wp: s.wp, beds: s.beds, prompt: s.beds.length > 1 ? 'Tap to tend the beds' : 'Tap to tend the bed', bed: true }; }),
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 }, props: {}
  };

  /* ---------- rules (no DOM) ---------- */
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function farmState(S) { var f = S.state().farm || {}; return { beds: f.beds || {}, harvest: f.harvest || {}, seeds: f.seeds || {}, seedsByDay: f.seedsByDay || {} }; }
  function bed(S, id) { return farmState(S).beds[id] || null; }
  function growthDays(b) { return b && b.crop ? (b.watered || []).length : 0; }
  function ripe(b) { return !!(b && b.crop && CROPS[b.crop] && growthDays(b) >= CROPS[b.crop].days); }
  function stage(b) { if (!b || !b.crop) return 0; var n = growthDays(b), need = CROPS[b.crop].days; if (ripe(b)) return 3; if (n >= Math.ceil(need / 2)) return 2; if (n >= 1) return 1; return 0; }
  /* weeds: two beds in twelve on an average morning, the same ones all day on every phone; pulled ones stay clear that day */
  function hasWeeds(b, id, day) { if (b && b.cleared === day) return false; return hash(day + ':' + id) % 6 === 0; }
  function wateredToday(b, day) { return !!(b && (b.watered || []).indexOf(day) > -1); }
  /* the shed remembers each date it gave seeds on, so a clock that goes back to a claimed date gives nothing twice */
  function seedsLeftToday(S, day) { var f = farmState(S); return Math.max(0, SEEDS_A_DAY - (f.seedsByDay[day] || 0)); }
  function write(S, f) { S.setState({ farm: f }); }
  function takeSeed(S, crop, day) {
    if (!CROPS[crop]) return { ok: false, why: 'unknown crop' };
    var f = farmState(S), taken = f.seedsByDay[day] || 0;
    if (taken >= SEEDS_A_DAY) return { ok: false, why: 'The shed has given out its seeds for today. More tomorrow.' };
    f.seedsByDay[day] = taken + 1; f.seeds[crop] = (f.seeds[crop] || 0) + 1;
    Object.keys(f.seedsByDay).forEach(function (k) { if (k < S.addDays(day, -30)) delete f.seedsByDay[k]; }); /* a month of dates is plenty */
    write(S, f); return { ok: true, left: SEEDS_A_DAY - f.seedsByDay[day] };
  }
  function plant(S, id, crop, day) {
    var f = farmState(S), b = f.beds[id];
    if (!CROPS[crop]) return { ok: false, why: 'unknown crop' };
    if (b && b.crop) return { ok: false, why: 'This bed already has ' + CROPS[b.crop].name.toLowerCase() + ' in it.' };
    if (hasWeeds(b, id, day)) return { ok: false, why: 'Pull the weeds first.' };
    if (!(f.seeds[crop] > 0)) return { ok: false, why: 'No ' + CROPS[crop].name.toLowerCase() + ' seeds left. The shed gives three a day.' };
    f.seeds[crop] -= 1; f.beds[id] = { crop: crop, planted: day, watered: [], cleared: b && b.cleared === day ? day : undefined }; write(S, f); return { ok: true };
  }
  function water(S, id, day) {
    var f = farmState(S), b = f.beds[id];
    if (!b || !b.crop) return { ok: false, why: 'Nothing is planted here yet.' };
    if (hasWeeds(b, id, day)) return { ok: false, why: 'Pull the weeds first; watered weeds only grow.' };
    if (b.planted && day < b.planted) return { ok: false, why: 'The date is earlier than the planting. Check the phone\u2019s clock.' };
    var lastW = (b.watered || []).slice(-1)[0]; if (lastW && day <= lastW) return { ok: false, why: 'Watered already today. Tomorrow counts again.' }; /* a date before the last watering counts as today: the clock went back */
    b.watered = (b.watered || []).concat([day]); write(S, f); return { ok: true, days: b.watered.length, ripe: ripe(b) };
  }
  function clearWeeds(S, id, day) {
    var f = farmState(S), b = f.beds[id] || {};
    if (!hasWeeds(b, id, day)) return { ok: false, why: 'No weeds here.' };
    b.cleared = day; f.beds[id] = b; write(S, f); return { ok: true };
  }
  function harvest(S, id) {
    var f = farmState(S), b = f.beds[id];
    if (!ripe(b)) return { ok: false, why: b && b.crop ? 'Not ripe yet.' : 'Nothing to harvest.' };
    var crop = b.crop, n = CROPS[crop].yield;
    f.harvest[crop] = (f.harvest[crop] || 0) + n; f.beds[id] = { cleared: b.cleared }; write(S, f); return { ok: true, crop: crop, n: n, total: f.harvest[crop] };
  }
  function summary(S, day) {
    var f = farmState(S), out = { planted: 0, ripe: 0, weeds: 0, dry: 0, harvest: f.harvest, seeds: f.seeds, seedsLeft: seedsLeftToday(S, day) };
    BEDS.forEach(function (bb) { var b = f.beds[bb.id]; if (hasWeeds(b, bb.id, day)) out.weeds++; if (b && b.crop) { out.planted++; if (ripe(b)) out.ripe++; else if (!wateredToday(b, day)) out.dry++; } });
    return out;
  }

  var F = { CROPS: CROPS, BEDS: BEDS, STANDS: STANDS, LAYOUT: FARM, SEEDS_A_DAY: SEEDS_A_DAY, bedAt: bedAt, standFor: standFor, farmState: farmState, bed: bed, growthDays: growthDays, ripe: ripe, stage: stage, hasWeeds: hasWeeds, wateredToday: wateredToday, seedsLeftToday: seedsLeftToday, takeSeed: takeSeed, plant: plant, water: water, clearWeeds: clearWeeds, harvest: harvest, summary: summary, hash: hash };
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
  /* a logged sleep stops the farm with the room's own words (napping toasts); any other busy state stays quiet */
  function goTend(bb) {
    if ((W.napping && W.napping()) || R.busy()) return;
    R.walkTo(bb.wp, function () { openBed(bb.id); });
  }
  /* energy: checked before the rule runs, charged only when the rule says yes, so a refused action costs nothing */
  function canAct(name) { if (!ST || ST.can(name)) return true; R.toast('Too tired for that. A rest first.', 'bedtime'); return false; }
  function act(name) { return !ST || ST.spend(name, true); }
  var lastBed = null;
  function openBed(id) {
    var bb = BEDS.filter(function (x) { return x.id === id; })[0]; if (!bb) return;
    lastBed = id;
    var day = today(), b = bed(S, id), f = farmState(S), weeds = hasWeeds(b, id, day), crop = b && b.crop ? CROPS[b.crop] : null;
    var html = '<div class="bedcard"><div class="bedpic">' + bedSVG(b, id, day) + '</div><div class="bedtext">';
    if (crop) {
      html += '<b>' + esc(crop.name) + '</b><span>' + (ripe(b) ? 'Ripe and ready to pick.' : growthDays(b) + ' of ' + crop.days + ' watered days. ' + (wateredToday(b, day) ? 'Watered today.' : 'Not watered yet today.')) + '</span>';
    } else {
      /* an empty bed plants straight from today's shed seeds too (Jamie, 20 Oct: "where is the shed?"): no trip needed */
      var own = Object.keys(CROPS).some(function (k) { return (f.seeds[k] || 0) > 0; }), left = seedsLeftToday(S, day);
      html += '<b>An empty bed</b><span>' + (own ? 'Plant one of your seeds.' : left ? 'Pick a seed to plant. The shed gives ' + SEEDS_A_DAY + ' a day; ' + left + ' left today.' : 'No seeds left today. The shed has more tomorrow.') + '</span>';
    }
    if (weeds) html += '<span class="weedy">Weeds. Pull them before anything else.</span>';
    html += '</div></div><div class="' + (!weeds && !crop ? 'seedlist' : 'row') + '" id="bedActs">';
    if (weeds) html += '<button type="button" class="btn primary" data-bed="clear"><span class="ms">grass</span>Pull the weeds</button>';
    else if (crop && ripe(b)) html += '<button type="button" class="btn primary" data-bed="harvest"><span class="ms">shopping_basket</span>Harvest</button>';
    else if (crop) html += '<button type="button" class="btn primary" data-bed="water"' + (wateredToday(b, day) ? ' disabled' : '') + '><span class="ms">water_drop</span>Water</button>';
    else if (!Object.keys(CROPS).some(function (k) { return (f.seeds[k] || 0) > 0; }) && seedsLeftToday(S, day) > 0) Object.keys(CROPS).forEach(function (k) { html += '<button type="button" class="btn soft" data-bed="shedplant" data-crop="' + k + '"><span class="ms">spa</span><span><b>' + esc(CROPS[k].name) + '</b><small>' + CROPS[k].days + ' days to ripen</small></span></button>'; });
    else Object.keys(CROPS).forEach(function (k) { if (f.seeds[k] > 0) html += '<button type="button" class="btn soft" data-bed="plant" data-crop="' + k + '"><span class="ms">spa</span><span><b>' + esc(CROPS[k].name) + '</b><small>' + CROPS[k].days + ' days · ' + f.seeds[k] + ' seed' + (f.seeds[k] > 1 ? 's' : '') + '</small></span></button>'; });
    html += '</div><p class="help">Watering costs a little energy; a missed day adds nothing and takes nothing away. Weeds pause a bed until they are pulled.</p>';
    R.openSheet('farmbed', 'Bed ' + (BEDS.indexOf(bb) + 1), 'Your farm', 'yard', html);
    var acts = doc.getElementById('bedActs'); if (!acts) return;
    acts.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-bed]'); if (!btn) return;
      var kind = btn.dataset.bed, res, now = today(); /* the date at the tap, not at the sheet's opening: midnight may have passed */
      if (now !== day) { openBed(id); return; } /* the sheet showed yesterday: redraw it for today before anything is done */
      if (!canAct(kind === 'shedplant' ? 'plant' : kind)) return;
      if (kind === 'clear') res = clearWeeds(S, id, now);
      else if (kind === 'water') res = water(S, id, now);
      else if (kind === 'harvest') res = harvest(S, id);
      else if (kind === 'plant') res = plant(S, id, btn.dataset.crop, now);
      else if (kind === 'shedplant') { var got = takeSeed(S, btn.dataset.crop, now); res = got && got.ok ? plant(S, id, btn.dataset.crop, now) : got; if (res && res.ok) kind = 'plant'; }
      if (!res) return;
      if (!res.ok) { R.toast(res.why, 'info'); return; }
      act(kind); R.chime('save'); renderBeds();
      if (kind === 'harvest') { afterHarvest(res); return; }
      if (kind === 'plant') R.toast('Planted. Set one small intention for this week as it grows.', 'spa');
      if (kind === 'water') R.toast(res.ripe ? 'Ripe! Tap the bed again to harvest.' : 'Watered. ' + res.days + ' of ' + CROPS[bed(S, id).crop].days + ' days.', 'water_drop');
      openBed(id);
    });
  }
  /* a harvest never writes a diary entry on its own: she is asked, and the food diary saves what she chooses */
  function afterHarvest(res) {
    var crop = CROPS[res.crop];
    var what = res.n + ' ' + (res.n > 1 ? crop.plural : crop.name.toLowerCase());
    R.openSheet('farmharvest', 'Harvested!', what + ' into the basket', 'shopping_basket',
      '<p>' + esc(what) + ' picked. You have ' + esc(res.total) + ' in the basket now.</p>' +
      '<p class="help">If you are about to cook or eat something real, you can log the meal; the farm never logs anything for you.</p>' +
      '<div class="row"><button type="button" class="btn primary" id="harvestLog"><span class="ms">restaurant</span>Log a meal</button><button type="button" class="btn soft" id="harvestNo">Not now</button></div>');
    var lg = doc.getElementById('harvestLog'), no = doc.getElementById('harvestNo');
    if (lg) lg.addEventListener('click', function () { R.hideSheet(); var a = doc.querySelector('nav a[data-tab="food"]'); if (a) a.click(); });
    if (no) no.addEventListener('click', function () { R.hideSheet(); });
  }
  function openShed() {
    var day = today(), left = seedsLeftToday(S, day), f = farmState(S);
    var html = '<p>The shed keeps the tools and gives out three seed packets a day. ' + (left ? left + ' left today.' : 'All given out for today; more tomorrow.') + '</p><div class="seedlist" id="shedActs">' +
      Object.keys(CROPS).map(function (k) { var c = CROPS[k]; return '<button type="button" class="btn soft" data-seed="' + k + '"' + (left ? '' : ' disabled') + '><span class="ms">spa</span><span><b>' + esc(c.name) + '</b><small>' + c.days + ' days · have ' + (f.seeds[k] || 0) + '</small></span></button>'; }).join('') +
      '</div><p class="help">A crop grows by the days it was watered. Pumpkins take a week; radishes two days.</p>';
    R.openSheet('farmshed', 'The shed', 'Seeds and tools', 'home_repair_service', html);
    var acts = doc.getElementById('shedActs'); if (!acts) return;
    acts.addEventListener('click', function (e) { var btn = e.target.closest('[data-seed]'); if (!btn) return; var res = takeSeed(S, btn.dataset.seed, today()); if (!res.ok) { R.toast(res.why, 'info'); return; } R.chime('tap'); openShed(); });
  }
  function openBasket() {
    var f = farmState(S), rows = Object.keys(f.harvest).filter(function (k) { return f.harvest[k] > 0; });
    R.openSheet('farmbasket', 'Your harvest', rows.length ? 'In the basket' : 'Nothing picked yet', 'shopping_basket',
      (rows.length ? '<ul class="basketlist">' + rows.map(function (k) { return '<li><span class="dot" style="background:' + CROPS[k].colour + '"></span>' + esc(CROPS[k].name) + ' <b>×' + esc(f.harvest[k]) + '</b></li>'; }).join('') + '</ul>' : '<p>Plant, water and pick, and the basket fills.</p>') +
      '<p class="help">Selling and gifting come with the market. For now the basket is yours to admire.</p>');
  }
  function openWell() { R.toast('The can is full. Tap a bed to water it.', 'water_drop'); }
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
    R.on('layout', function (L) { if (inFarm(L)) renderBeds(); });
    R.on('props', function (L) { if (inFarm(L || R.layout())) renderBeds(); });
    if (GT) GT.onNewDay(function () { renderBeds(); if (doc.getElementById('bedActs') && lastBed) openBed(lastBed); else if (doc.getElementById('shedActs')) openShed(); }); /* a farm sheet left open over midnight redraws for the new day */
    S.subscribe(function (reason) { if (reason === 'external' || String(reason).indexOf('sync') === 0) renderBeds(); });
  });
  F.renderBeds = renderBeds; F.openBed = openBed; F.openShed = openShed; F.openBasket = openBasket;
})(typeof window !== 'undefined' ? window : this);
