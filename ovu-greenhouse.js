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
    id: 'greenhouse', scene: 'garden', name: 'The greenhouse', mapIcon: 'local_florist', img: 'greenhouse-v1.webp', w: 1248, h: 1560, avatarW: 12, only: [],
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
  var GH = { LAYOUT: LAYOUT, PLANTS: PLANTS, HOUSE: HOUSE, ASK: ASK, CARE_SECONDS: CARE_SECONDS, CARE_STEP: CARE_STEP, careLines: careLines, plant: plant, sprite: sprite, info: info,
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
    Array.prototype.slice.call(wrap.querySelectorAll('.ghplant')).forEach(function (el) { el.remove(); });
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
  function busyToast() { R.toast('Finish the minute with the plant first.', 'potted_plant'); }
  function startCare(id) {
    var p = plant(id); if (!p || caring || napping()) return;
    R.hideSheet();
    if (other() || R.busy()) { R.toast('Finish what you are doing first.', 'info'); return; }
    var lines = careLines(p), it = info(p, root.OvuHerbs);
    caring = { id: id, name: it ? it.name : 'a plant', startedAt: Date.now(), timers: [], done: false };
    R.hudOn(true, it ? it.name : 'A plant'); R.caption(lines[0]);
    R.setPose('plants'); R.els.avatar.classList.add('acting');
    lines.forEach(function (line, i) { if (i) caring.timers.push(root.setTimeout(function () { if (!caring || caring.done) return; if (other()) return stepAside(); R.caption(line); R.chime('bell', true); }, i * stepMs)); });
    caring.timers.push(root.setTimeout(function () { if (!caring || caring.done) return; if (other()) return stepAside(); finishCare(true); }, lines.length * stepMs));
    R.setHudStop(function () { if (!caring) return false; finishCare(false); return true; });
  }
  function stepAside() { var c = caring; if (!c) return; c.done = true; c.timers.forEach(root.clearTimeout); caring = null; R.setHudStop(null); }
  /* leaving, walking off, or anything else that cuts it short: if a practice or session now owns the HUD, just step aside */
  function cutShort() { if (!caring) return; if (other()) stepAside(); else finishCare(false); }
  function finishCare(completed) {
    var c = caring; if (!c || c.done) return; c.done = true;
    c.timers.forEach(root.clearTimeout); caring = null; R.setHudStop(null);
    R.hudOn(false); R.els.avatar.classList.remove('acting'); R.restorePose();
    if (!completed) { R.toast('Stopped. Thank you for the moment you gave it.', 'potted_plant'); return; }
    var ever = S.list('mindfulness').some(function (e) { return e.data && e.data.practice === 'greenhouse'; }), ev = null;
    try { ev = S.add('mindfulness', S.today(), { kind: 'informal', first: !ever, practice: 'greenhouse', plant: c.id, minutes: 1, completed: true, startedAt: new Date(c.startedAt).toISOString(), guide: 'Greenhouse, one mindful minute with the ' + c.name.toLowerCase() }); } catch (e) { R.toast('The minute could not be saved: ' + e.message, 'error'); }
    if (ev) R.afterSave(ev, 'One mindful minute in the greenhouse.');
  }
  R.hotspotHandlers.ghdoor = function (id, L) { if (!inside(L)) return false; root.OvuWalk.travel('garden'); return true; };
  R.hotspotHandlers.teatable = function (id, L) { if (!inside(L)) return false; if (caring) { busyToast(); return true; } if (root.OvuGarden && root.OvuGarden.openGreenhouse) root.OvuGarden.openGreenhouse(); return true; };
  R.on('boot', function () {
    R.on('props', function (L) { render(L); });
    R.on('layout', function (L) { cutShort(); render(L); });
    R.on('beforeWalk', cutShort); /* walking away ends the minute (a practice that moves her takes over instead) */
    R.on('activity', function () { stepAside(); }); /* a practice or session is starting: hand the HUD over now */
    R.els.props.addEventListener('click', function (e) { var p = e.target.closest('.ghplant.tappable'); if (p) { e.stopPropagation(); tapPlant(p); } });
    R.els.props.addEventListener('keydown', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; var p = e.target.closest('.ghplant.tappable'); if (p) { e.preventDefault(); tapPlant(p); } });
  });
  GH.render = render; GH.openCard = openCard; GH.startCare = startCare; GH.finishCare = finishCare; GH.caring = function () { return caring ? caring.id : null; };
  GH.setPace = function (ms) { stepMs = ms > 0 ? ms : CARE_STEP * 1000; }; /* tests only: the same four lines, faster */
})(window);
