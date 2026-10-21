/* Rhythme Harbour Lane (Jamie, 21 Oct 2026: "is my fashion store n gym fish store, grocer ready? My post mail too", then
 * "can you build what is not build within next few hours"). A short cobbled lane up from the harbour's signpost, with four
 * shops and a post box, all sheets in the room (no interiors), and a bench with its own practice (ovu-seats.js):
 * - Lilac Thread, the boutique: every look she owns, to try on. Nothing is sold.
 * - Mint Studio, the gym: log movement and a gentle stretch in Erin's voice. No targets, nothing to keep up.
 * - The Blue Fin, the fish shop: an aquarium window of the fish she has met (every one went back), and fish for the table.
 * - Hay & Harvest, the grocer: fruit, vegetables and pulses drawn for Ovuluna, with the foods for her part of the cycle.
 * - The post box: letters from the lane, Luna and the barn when something happens in her world. No hearts, no streaks.
 * Nothing here costs hearts, pays hearts or writes a diary entry by itself. Pure parts first (testable in node). */
(function (root) {
  'use strict';
  var LANE = {
    id: 'lane', scene: 'lane', name: 'Harbour Lane', img: 'lane-v1.webp', w: 1024, h: 1280, avatarW: 11, only: [], mapIcon: 'storefront',
    hotspots: [
      { id: 'laneexit', x: 52, y: 78, label: 'Path · down to the harbour', prompt: 'Tap to walk down to the harbour', icon: 'door_open', wp: { x: 52, y: 74, flip: false } },
      { id: 'boutique', x: 25, y: 43, label: 'Lilac Thread · the boutique', prompt: 'Tap to try on a look', icon: 'checkroom', wp: { x: 25, y: 51, flip: false } },
      { id: 'gym', x: 42, y: 40, label: 'Mint Studio · the gym', prompt: 'Tap to move at your own pace', icon: 'fitness_center', wp: { x: 41, y: 52, flip: false } },
      { id: 'fishshop', x: 57, y: 45, label: 'The Blue Fin · the fish shop', prompt: 'Tap to visit the fish shop', icon: 'set_meal', wp: { x: 55, y: 56, flip: false } },
      { id: 'grocer', x: 78, y: 54, label: 'Hay & Harvest · the grocer', prompt: 'Tap to look at the fruit and vegetables', icon: 'storefront', wp: { x: 80, y: 64.5, flip: false } },
      { id: 'postbox', x: 71, y: 61, label: 'Post box · your letters', prompt: 'Tap to open your letters', icon: 'markunread_mailbox', wp: { x: 64, y: 69, flip: false } },
      { id: 'lanebench', x: 22, y: 57, label: 'Bench · sit a while', prompt: 'Tap to sit a while', icon: 'chair', wp: { x: 31, y: 63, flip: true } },
      { id: 'lanecat', x: 87, y: 56, label: 'The grocer’s cat', prompt: 'Tap to say hello', icon: 'pets', wp: { x: 87, y: 65.5, flip: false } }
    ],
    home: { x: 52, y: 74, flip: false },
    zones: [[[6, 58], [9, 55], [17, 50], [20, 49.5], [30, 49.5], [34, 49], [46, 49], [50, 51], [58, 52], [62, 54], [63, 57], [72, 60], [82, 62], [92, 63], [95, 65], [93, 68], [85, 70.5], [75, 72.5], [66, 73], [61, 74], [60, 77], [46, 77], [43, 73], [36, 70.5], [28, 68], [18, 65], [11, 62]]],
    solids: [{ id: 'lamp', x0: 7, x1: 18, y0: 48, y1: 57 }, { id: 'bench', x0: 15, x1: 29, y0: 54, y1: 62 }, { id: 'postbox', x0: 67, x1: 76, y0: 60, y1: 70 }, { id: 'pot', x0: 43, x1: 49, y0: 46, y1: 51 }, { id: 'pots', x0: 58, x1: 65, y0: 49, y1: 55 }],
    doors: [{ id: 'laneexit', to: 'harbour', x: 52, y: 74, r: 4, flip: false }],
    meditator: { x: 22, y: 58, w: 11, seat: { x: 22, seatY: 57.5, groundY: 61.5, face: 'right' } }, aura: { x: 22, y: 56, w: 17 }, holo: { x: 32, y: 56, w: 14 },
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 }, props: {}
  };
  var BENCH_BACK = { x: 31, y: 63, flip: true };
  /* the way up: the harbour's round signpost by the hut (its layout is data, so this holds in node too) */
  var SIGN = { id: 'lanesign', x: 19, y: 44, label: 'Signpost · up to Harbour Lane', prompt: 'Tap to walk up to Harbour Lane', icon: 'storefront', wp: { x: 23, y: 51, flip: true } };
  var HB0 = root.OvuHarbour && root.OvuHarbour.LAYOUT;
  if (HB0 && !HB0.hotspots.some(function (h) { return h.id === SIGN.id; })) { HB0.hotspots.push(SIGN); HB0.doors.push({ id: 'lanesign', to: 'lane', x: 23, y: 51, r: 3, flip: true }); }

  var SHOPS = {
    boutique: { name: 'Lilac Thread', sub: 'The boutique on Harbour Lane', icon: 'checkroom' },
    gym: { name: 'Mint Studio', sub: 'Move at your own pace', icon: 'fitness_center' },
    fishshop: { name: 'The Blue Fin', sub: 'Fish you have met, and fish for the table', icon: 'set_meal' },
    grocer: { name: 'Hay & Harvest', sub: 'Fruit, vegetables and pulses', icon: 'storefront' }
  };
  /* the nineteen foods drawn for Ovuluna (assets/food), in shelf order */
  var SHELF = [
    ['spinach', 'Spinach'], ['kale', 'Kale'], ['broccoli', 'Broccoli'], ['sweet-potato', 'Sweet potato'], ['avocado', 'Avocado'], ['blueberries', 'Blueberries'],
    ['lentils', 'Lentils'], ['chickpeas', 'Chickpeas'], ['soy', 'Tofu and edamame'], ['oats', 'Oats'],
    ['almonds', 'Almonds'], ['walnuts', 'Walnuts'], ['pumpkin-seeds', 'Pumpkin seeds'], ['flaxseeds', 'Flaxseeds'],
    ['eggs', 'Eggs'], ['greek-yogurt', 'Greek yogurt'], ['salmon', 'Salmon'], ['turmeric', 'Turmeric'], ['dark-chocolate', 'Dark chocolate']
  ];
  /* letters: each arrives once, when its moment has happened; reading one is all there is to do */
  var LETTERS = [
    { id: 'lane-welcome', from: 'The shopkeepers of Harbour Lane', title: 'Welcome to the lane', when: function () { return true; },
      body: function () { return ['Welcome to Harbour Lane.', 'Lilac Thread has every look you own, ready to try on. Mint Studio is for moving at your own pace. The Blue Fin keeps a window for the fish you meet. Hay & Harvest has fruit and vegetables to look at, and ideas to take home.', 'Nothing here costs hearts. Come by whenever you like.']; } },
    { id: 'news-20261021', from: 'Luna', title: 'New in your world', when: function () { return true; },
      body: function () { return ['A few new things to find, whenever you like:', 'a harbour below the farm, where you can meet a fish and let it go; a hidden spring, where the crystals hum one steady note; a quiet practice on each bench; Erin’s morning of waking, brushing and a mindful sip; and this lane.', 'Take them at your own pace.']; } },
    { id: 'bluefin-first', from: 'The Blue Fin', title: 'Your first fish', when: function (f) { return f.fishMet > 0; },
      body: function (f) { return ['We hear you met ' + (f.firstFish ? 'a ' + f.firstFish.toLowerCase() : 'a fish') + ' at the harbour and let it go again.', 'Its picture is in our window now. There are six kinds to notice, and no hurry to meet them all.']; } },
    { id: 'grocer-harvest', from: 'Hay & Harvest', title: 'A full basket', when: function (f) { return f.basket > 0 || f.treated; },
      body: function () { return ['Something from your farm is in the basket.', 'Whatever you grow stays yours: carrots, pumpkins and sweet potatoes are treats for Clover, and the greens and strawberries for the hens.', 'When you cook at home, the food diary has ideas for each part of your cycle.']; } },
    { id: 'clover-thanks', from: 'Clover, with a little help from the barn', title: 'Moo', when: function (f) { return !!f.cloverTreat; },
      body: function () { return ['Moo.', 'Thank you for the treat. It was the best part of my day.', 'Clover']; } },
    { id: 'spring-found', from: 'Luna', title: 'The hidden spring', when: function (f) { return !!f.caveFound; },
      body: function () { return ['You found the hidden spring behind the barn.', 'Sit by the water whenever you like. The crystals hum one steady note while you rest, and nothing there is counted.']; } },
    { id: 'studio-first', from: 'Mint Studio', title: 'You moved', when: function (f) { return f.moved > 0; },
      body: function () { return ['You logged some movement.', 'However much or little, it is yours. There are no targets at Mint Studio and nothing to keep up.']; } }
  ];
  function letters(facts, arrived) { facts = facts || {}; arrived = arrived || {}; return LETTERS.filter(function (l) { if (arrived[l.id]) return true; try { return !!l.when(facts); } catch (e) { return false; } }).map(function (l) { return { id: l.id, from: l.from, title: l.title, body: l.body(facts) }; }); }
  function cleanMap(o) { var out = {}; if (o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).forEach(function (k) { if (typeof o[k] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o[k]) && /^[a-z0-9-]{1,40}$/.test(k)) out[k] = o[k]; }); return out; }
  function mailState(state) { var m = (state && state.mail) || {}; return { read: cleanMap(m.read), arrived: cleanMap(m.arrived) }; } /* a copy, cleaned: a failed save never leaves the live state changed (Codex sweep, 21 Oct) */
  function unread(list, mail) { return list.filter(function (l) { return !mail.read[l.id]; }).length; }
  var LN = { LAYOUT: LANE, SIGN: SIGN, SHOPS: SHOPS, SHELF: SHELF, LETTERS: LETTERS, letters: letters, mailState: mailState, unread: unread, BENCH_BACK: BENCH_BACK };
  root.OvuLane = LN;

  /* ---------- the scene (browser only) ---------- */
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, Z = root.OvuZones, doc = root.document;
  if (!R || !S || !doc || !W || !Z) return;
  Z.register(LANE, { label: 'Harbour Lane', icon: 'storefront', after: 'harbour' });
  var ART = R.ART;
  function $(id) { return doc.getElementById(id); }
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function here() { var L = R.layout(); return !!L && L.id === 'lane'; }
  var foods = null;
  function loadFoods() { if (foods) return Promise.resolve(foods); return fetch('assets/data/ovarian-foods.json').then(function (r) { if (!r.ok) throw new Error('food list ' + r.status); return r.json(); }).then(function (d) { if (!d || !Array.isArray(d.foods)) throw new Error('food list shape'); foods = d; return d; }).catch(function () { return null; }); } /* a failed or odd answer is never kept (Codex sweep, 21 Oct) */
  /* what has happened in her world, for the letters */
  function facts() {
    var f = {}, FM = root.OvuFarm, HB = root.OvuHarbour;
    try { var fs = FM ? FM.farmState(S) : {}; f.basket = Object.keys(fs.harvest || {}).reduce(function (a, k) { return a + (Number(fs.harvest[k]) || 0); }, 0); f.treated = !!(fs.treats && Object.keys(fs.treats).length); f.cloverTreat = !!(fs.treats && fs.treats.clover); f.caveFound = !!(fs.found && fs.found.cave); } catch (e) { }
    try { var hs = HB ? HB.harbourState(S) : null, book = (hs && hs.book) || {}, met = Object.keys(book); f.fishMet = met.length; if (met.length) { met.sort(function (a, b) { return String(book[a].first).localeCompare(String(book[b].first)); }); var sp = (HB.SPECIES || []).filter(function (x) { return x.id === met[0]; })[0]; f.firstFish = sp ? sp.name : null; } } catch (e) { f.fishMet = 0; }
    try { f.moved = S.list('exercise').length; } catch (e) { f.moved = 0; }
    return f;
  }
  function myLetters() {
    var mail = mailState(S.state()), list = letters(facts(), mail.arrived), today = S.today(), changed = false; /* a letter that arrived stays, even if its moment is later undone */
    list.forEach(function (l) { if (!mail.arrived[l.id]) { mail.arrived[l.id] = today; changed = true; } l.arrived = mail.arrived[l.id]; l.read = !!mail.read[l.id]; });
    if (changed) { try { S.setState({ mail: { read: mail.read, arrived: mail.arrived } }); } catch (e) { } }
    list.sort(function (a, b) { return (a.read === b.read ? 0 : a.read ? 1 : -1) || String(b.arrived).localeCompare(String(a.arrived)); });
    return list;
  }
  function markRead(id) { var mail = mailState(S.state()); if (mail.read[id]) return; mail.read[id] = S.today(); try { S.setState({ mail: { read: mail.read, arrived: mail.arrived } }); } catch (e) { } renderFlag(); }

  /* ---------- the shops ---------- */
  function openBoutique() {
    var sh = SHOPS.boutique, list = R.outfits ? R.outfits() : [], cur = S.profile().outfit || 'base';
    R.openSheet('boutique', sh.name, sh.sub, sh.icon,
      '<p class="help">Every look here is already yours. Try one on, and she wears it until you change again.</p>' +
      '<div class="outfits" id="lbOutfits">' + list.map(function (o) { return '<button type="button" class="outfit' + (o.id === cur ? ' on' : '') + '" data-id="' + esc(o.id) + '" aria-pressed="' + (o.id === cur ? 'true' : 'false') + '"><img src="' + ART + 'avatar-' + esc(o.id) + '.webp" alt=""><b>' + esc(o.name) + '</b><small>' + esc(o.note || '') + '</small></button>'; }).join('') + '</div>');
    var box = $('lbOutfits'); if (box) box.addEventListener('click', function (e) {
      var b = e.target.closest('.outfit'); if (!b || !R.setOutfit) return;
      if (R.asleep()) { R.toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return; } /* bedtime in another tab keeps her pyjamas */
      R.setOutfit(b.dataset.id); R.chime('tap');
      Array.prototype.forEach.call(box.querySelectorAll('.outfit'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      var o = list.filter(function (x) { return x.id === b.dataset.id; })[0]; R.toast((o ? o.name : 'That look') + ' it is.', 'checkroom');
    });
  }
  function openGym() {
    var sh = SHOPS.gym, today = S.today(), week = S.list('exercise', { from: S.addDays(today, -6), to: today }).length;
    R.openSheet('gym', sh.name, sh.sub, sh.icon,
      '<p class="mindline"><span class="ms">fitness_center</span><span>' + (week ? 'Movement logged this week: ' + week + (week === 1 ? ' time.' : ' times.') : 'Nothing logged this week yet, and that is fine.') + '</span></p>' +
      '<div class="row"><button type="button" class="btn primary" id="gymLog"><span class="ms">add</span>Log movement</button><button type="button" class="btn soft" id="gymStretch"><span class="ms">self_improvement</span>A gentle stretch</button></div>' +
      '<p class="help">No targets here and nothing to keep up: log what you did, if you like. The stretch is read in Erin’s voice; leave out any movement you do not want to do. If you are recovering from a birth, an operation or an injury, go at the pace your care team suggests.</p>');
    $('gymLog').addEventListener('click', function () { R.hideSheet(); if (R.openExercise) R.openExercise(); });
    $('gymStretch').addEventListener('click', function () {
      var MF = root.OvuMindful, a = MF && MF.byId('stretch'); if (!a || !R.runPractice) { R.hideSheet(); return; }
      var v = MF.nextVariation(a); R.runPractice('stretch', Math.max(0, a.variations.indexOf(v)));
    });
  }
  function openFishShop() {
    var sh = SHOPS.fishshop, HB = root.OvuHarbour, sp = (HB && HB.SPECIES) || [], book = {};
    try { book = (HB.harbourState(S) || {}).book || {}; } catch (e) { }
    var met = sp.filter(function (x) { return book[x.id]; }).length;
    R.openSheet('fishshop', sh.name, sh.sub, sh.icon,
      '<div class="aquarium" id="bfAquarium">' + sp.map(function (x) { return book[x.id] ? '<figure class="aqfish"><img src="' + ART + esc(x.img) + '" alt=""><figcaption>' + esc(x.name) + '</figcaption></figure>' : '<figure class="aqfish unseen"><span aria-hidden="true">?</span><figcaption>Not met yet</figcaption></figure>'; }).join('') + '</div>' +
      '<p class="help">' + (met ? 'The window shows the ' + met + ' kind' + (met > 1 ? 's' : '') + ' you have met at the harbour. Every one went back to the water.' : 'Fish you meet at the harbour swim in this window. Every fish goes back to the water.') + '</p>' +
      '<div id="bfTable"></div>' +
      '<div class="row"><button type="button" class="btn soft" id="bfBook"><span class="ms">menu_book</span>Open the catch book</button><button type="button" class="btn ghost" id="bfDiary"><span class="ms">restaurant</span>Open the food diary</button></div>');
    $('bfBook').addEventListener('click', function () { if (HB && HB.openBook) HB.openBook(null); });
    $('bfDiary').addEventListener('click', foodDiary);
    loadFoods().then(function (d) {
      var box = $('bfTable'); if (!box || !d) return;
      var fish = (d.foods || []).filter(function (f) { return /salmon/i.test(f.name); });
      box.innerHTML = fish.length ? '<div class="field"><span class="lbl">For the table</span>' + fish.map(foodCard).join('') + '</div>' : '';
    });
  }
  function foodCard(f) { return '<div class="lanefood">' + (f.img ? '<img src="' + esc(f.img) + '" alt="" loading="lazy">' : '<span class="emo" aria-hidden="true">' + esc(f.emoji || '') + '</span>') + '<div><b>' + esc(f.name) + '</b><small>' + esc(f.tags || '') + '</small></div></div>'; }
  function foodDiary() { R.hideSheet(); var a = doc.querySelector('nav a[data-tab="food"]'); if (a) a.click(); }
  function openGrocer() {
    var sh = SHOPS.grocer, cs = S.cycleStats(), phase = cs.mode === 'suspended' ? null : (cs.phase === 'late' ? 'luteal' : cs.phase);
    R.openSheet('grocer', sh.name, sh.sub, sh.icon,
      '<div id="hhPhase"></div>' +
      '<div class="field"><span class="lbl">On the shelves</span><div class="laneshelf" id="hhShelf">' + SHELF.map(function (s) { return '<button type="button" class="shelfitem" data-name="' + esc(s[1]) + '"><img src="assets/food/' + esc(s[0]) + '.webp" alt="" loading="lazy"><span>' + esc(s[1]) + '</span></button>'; }).join('') + '</div></div>' +
      '<div class="row"><button type="button" class="btn soft" id="hhDiary"><span class="ms">restaurant</span>Open the food diary</button></div>' +
      '<p class="help">Food ideas, not a diet or a treatment. To log something you ate, use Add a meal in the food diary. Pictures drawn for Ovuluna.</p>');
    $('hhDiary').addEventListener('click', foodDiary);
    $('hhShelf').addEventListener('click', function (e) { var b = e.target.closest('.shelfitem'); if (!b) return; R.chime('tap'); R.toast('To log ' + b.dataset.name.toLowerCase() + ', use Add a meal in the food diary and search for it.', 'restaurant'); });
    loadFoods().then(function (d) {
      var box = $('hhPhase'); if (!box || !d) return;
      var ph = phase && d.phases ? d.phases[phase] : null, list = (d.foods || []).filter(function (f) { return f.img && (!phase || (f.phase || []).indexOf(phase) > -1); }).slice(0, 6);
      if (!list.length) return;
      box.innerHTML = '<div class="field"><span class="lbl">' + (phase ? 'For where you are in your cycle' : 'A few favourites') + '</span>' + (ph && ph.text ? '<p class="help" style="margin:0 0 6px">' + esc(ph.text) + '</p>' : '') + list.map(foodCard).join('') + '</div>';
    });
  }
  /* ---------- the post box ---------- */
  function openPost() {
    var list = myLetters();
    R.openSheet('postbox', 'Your letters', list.length + ' letter' + (list.length === 1 ? '' : 's') + ' in the box', 'markunread_mailbox',
      '<div class="letters" id="pbList">' + list.map(function (l) { return '<button type="button" class="letter' + (l.read ? '' : ' unread') + '" data-id="' + esc(l.id) + '"><span class="ms">' + (l.read ? 'drafts' : 'mail') + '</span><span><b>' + esc(l.title) + '</b><small>From ' + esc(l.from) + '</small></span></button>'; }).join('') + '</div>' +
      '<p class="help">Letters arrive when something happens in your world. There is nothing to answer and nothing to keep up.</p>');
    $('pbList').addEventListener('click', function (e) { var b = e.target.closest('.letter'); if (!b) return; R.chime('tap'); openLetter(b.dataset.id); });
  }
  function openLetter(id) {
    var l = myLetters().filter(function (x) { return x.id === id; })[0]; if (!l) { openPost(); return; }
    markRead(id);
    R.openSheet('letter', l.title, 'From ' + l.from, 'drafts',
      '<div class="letterpaper">' + l.body.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('') + '</div>' +
      '<div class="row"><button type="button" class="btn soft" id="pbBack"><span class="ms">markunread_mailbox</span>Back to your letters</button></div>');
    $('pbBack').addEventListener('click', openPost);
  }
  var flag = null;
  function renderFlag() {
    if (!here()) { if (flag) { flag.remove(); flag = null; } return; }
    var n = unread(myLetters(), mailState(S.state()));
    var hs0 = doc.querySelector('.hotspot[data-id="postbox"]'); if (hs0) hs0.setAttribute('aria-label', n ? 'Post box, ' + n + ' new letter' + (n === 1 ? '' : 's') : 'Post box, your letters');
    if (!n) { if (flag) { flag.remove(); flag = null; } return; }
    if (!flag || !flag.isConnected) { flag = doc.createElement('span'); flag.className = 'laneflag'; flag.setAttribute('aria-hidden', 'true'); flag.style.left = '73.5%'; flag.style.top = '58%'; R.els.props.appendChild(flag); }
    flag.textContent = String(n);
    var hs = doc.querySelector('.hotspot[data-id="postbox"]'); if (hs) hs.setAttribute('aria-label', 'Post box, ' + n + ' new letter' + (n === 1 ? '' : 's'));
  }
  function napping() { return !!(W.napping && W.napping()); }
  var OPEN = { boutique: openBoutique, gym: openGym, fishshop: openFishShop, grocer: openGrocer, postbox: openPost };
  Object.keys(OPEN).forEach(function (id) { R.hotspotHandlers[id] = function (hid, L) { if (!L || L.id !== 'lane') return false; if (napping() || R.busy()) return true; OPEN[id](); return true; }; });
  R.hotspotHandlers.lanecat = function (id, L) { if (!L || L.id !== 'lane') return false; R.chime('tap'); R.toast('The grocer’s cat is fast asleep on a crate. Let her be.', 'pets'); return true; };
  R.hotspotHandlers.lanebench = function (id, L) { if (!L || L.id !== 'lane') return false; if (napping()) return true; if (root.OvuSeats && root.OvuSeats.open) root.OvuSeats.open('lane'); return true; };
  R.hotspotHandlers.laneexit = function (id, L) { if (!L || L.id !== 'lane') return false; if (root.OvuGarden && root.OvuGarden.standUp) root.OvuGarden.standUp(); W.travel('harbour'); return true; };
  R.hotspotHandlers.lanesign = function (id, L) { if (!L || L.id !== 'harbour') return false; if (napping()) return true; if (root.OvuHarbour && root.OvuHarbour.standUp) root.OvuHarbour.standUp(); W.travel('lane'); return true; };
  R.on('boot', function () {
    R.on('layout', function () { renderFlag(); });
    R.on('props', function () { renderFlag(); });
    S.subscribe(function (reason) { if (here() && (reason === 'state' || reason === 'add' || reason === 'external' || reason === 'clear' || reason === 'import')) renderFlag(); });
  });
  LN.openBoutique = openBoutique; LN.openGym = openGym; LN.openFishShop = openFishShop; LN.openGrocer = openGrocer; LN.openPost = openPost; LN.openLetter = openLetter; LN.myLetters = myLetters; LN.facts = facts;
})(typeof window !== 'undefined' ? window : this);
