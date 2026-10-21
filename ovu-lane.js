/* Rhythme Harbour Lane: the grocer (Hay & Harvest), the boutique (Petal & Thread), the gym (Tideline Gym), the fish store
 * (Bait & Fin) and the post box. Until the lane's plate is drawn, the harbour's signpost opens the lane as a sheet and
 * every place is a sheet, the way Dream Street's stores were before their interiors existed. No place here awards hearts,
 * and the gym and the post box never spend them. Nothing here writes a diary entry: the gym opens the movement log and
 * only her own save writes. Design: docs/design/2026-10-21-harbour-lane.md. Pure rules first (testable in node), then
 * the sheets. */
(function (root) {
  'use strict';
  /* names are placeholders Jamie can change here (Bait & Fin and Hay & Harvest are Codex's, from the harbour review) */
  var PLACES = [
    { id: 'grocer', name: 'Hay & Harvest', kind: 'Grocer', icon: 'storefront', hours: [8, 20], blurb: 'Seed packs, new crops, kitchen staples and the seed swap' },
    { id: 'boutique', name: 'Petal & Thread', kind: 'Boutique', icon: 'checkroom', hours: [10, 21], blurb: 'The fitting room and a new rail' },
    { id: 'gym', name: 'Tideline Gym', kind: 'Gym', icon: 'fitness_center', hours: [6, 22], blurb: 'Four stations, always free' },
    { id: 'fish', name: 'Bait & Fin', kind: 'Fish store', icon: 'phishing', hours: [7, 19], blurb: 'Float colours and the catch book' },
    { id: 'post', name: 'The post box', kind: 'Post', icon: 'markunread_mailbox', hours: null, blurb: 'A postcard to a friend, a letter to future you' }
  ];
  /* the harbour float: cosmetic only, bought once and kept, one in use, swapped free; blush is everyone's from the start */
  var FLOATS = [
    { id: 'blush', name: 'Blush', cost: 0, top: '#e58aa8' },
    { id: 'mint', name: 'Mint', cost: 15, top: '#8fd1b5' },
    { id: 'lilac', name: 'Lilac', cost: 15, top: '#b79be6' },
    { id: 'sunshine', name: 'Sunshine', cost: 15, top: '#f2c94c' },
    { id: 'moon', name: 'Moonlight', cost: 25, top: '#f6efc4', glow: true, note: 'Glows softly after dark.' }
  ];
  /* things that wait for the art run: an outfit needs every sprite before anyone can wear it (test-core 2g holds that line
   * for the tudung), and the aquarium needs its prop. Shown with their price; they cannot be bought until `ready`. */
  var RAIL = [
    { id: 'batik', name: 'Batik shirt dress', cost: 120, note: 'Soft lilac batik with a tie at the waist, and pockets.', ready: false },
    { id: 'raincape', name: 'Rain cape and boots', cost: 120, note: 'A pastel cape for monsoon walks, with little yellow boots.', ready: false }
  ];
  var AQUARIUM = { id: 'aquarium', name: 'Little aquarium', cost: 140, note: 'A round glass tank with pale sand and soft plants, for your room.', ready: false };
  /* the gym's stations open the movement log with the activity chosen (ovu-exercise.js ids); the gym adds no clinical words */
  var STATIONS = [
    { id: 'treadmill', name: 'Treadmill', act: 'walk', icon: 'directions_walk', line: 'Walk at your own pace. Notice each foot as it lands.' },
    { id: 'bike', name: 'Bike', act: 'cycle', icon: 'directions_bike', line: 'Let your breath set the pace. There is nowhere to arrive.' },
    { id: 'mat', name: 'Mat', act: 'yoga', icon: 'self_improvement', line: 'Move slowly. Notice where your body feels soft, and where it holds on.' },
    { id: 'weights', name: 'Weights', act: 'strength', icon: 'fitness_center', line: 'Lift slowly, lower slowly. Feel the muscles doing their work.' }
  ];
  /* a letter to future you: sealed until its day, kept on this phone (the cloud backup carries diary entries only) */
  var LETTER = { max: 600, waiting: 12, keep: 60, after: { week: 7, month: 30, season: 91 } };
  var WHEN = [['week', 'In a week'], ['month', 'In a month'], ['season', 'In three months']];
  var DAY = /^\d{4}-\d{2}-\d{2}$/;

  function place(id) { return PLACES.filter(function (p) { return p.id === id; })[0] || null; }
  function floatById(id) { return FLOATS.filter(function (f) { return f.id === id; })[0] || null; }
  function fmtHour(h) { var ST = root.OvuStreet; if (ST && ST.fmtHour) return ST.fmtHour(h); return h === 12 ? '12 noon' : h === 0 || h === 24 ? 'midnight' : h < 12 ? h + ' am' : (h - 12) + ' pm'; }
  /* each place keeps its own hours; the post box never shuts. Pure, so the tests can pass a date */
  function openAt(id, d) { var p = place(id); if (!p) return false; if (!p.hours) return true; var h = d.getHours() + d.getMinutes() / 60; return h >= p.hours[0] && h < p.hours[1]; }
  function openNow(id, d) { var RW = root.OvuRewards; if (RW && RW.tester && RW.tester()) return true; return openAt(id, d || new Date()); }
  function hoursText(id) { var p = place(id); return !p ? '' : !p.hours ? 'Always open' : fmtHour(p.hours[0]) + ' to ' + fmtHour(p.hours[1]); }

  /* ---------- state: state.lane = { floats: { id: day bought }, float, letters: [...] }, cleaned on every read ---------- */
  function validLetter(x) { return !!x && typeof x.id === 'string' && typeof x.text === 'string' && DAY.test(x.written || '') && DAY.test(x.opens || ''); }
  function laneState(S) {
    var l = S.state().lane || {}, floats = {};
    FLOATS.forEach(function (f) { var d = l.floats && l.floats[f.id]; if (f.cost > 0 && typeof d === 'string' && DAY.test(d)) floats[f.id] = d; });
    var letters = (Array.isArray(l.letters) ? l.letters : []).filter(validLetter).slice(0, LETTER.keep).map(function (x) { var o = { id: x.id, written: x.written, opens: x.opens, text: x.text.slice(0, LETTER.max) }; if (typeof x.read === 'string' && DAY.test(x.read)) o.read = x.read; return o; }); /* a bad read mark is dropped, never her words (review, 21 Oct) */
    var use = floatById(l.float), st = { floats: floats, float: 'blush', letters: letters };
    if (use && owns(st, use.id)) st.float = use.id;
    return st;
  }
  function owns(st, id) { var f = floatById(id); return !!f && (f.cost === 0 || !!st.floats[id]); }
  function write(S, st) { try { if (S.commit) S.commit({ lane: st }); else S.setState({ lane: st }); return { ok: true }; } catch (e) { return { ok: false, why: 'That could not be saved just now.' }; } } /* commit: a failed save leaves memory as it was */
  function floatOf(S) { return floatById(laneState(S).float) || FLOATS[0]; }
  /* hearts and the float in one save (OvuRewards.spend writes both), so a failed save takes no hearts */
  function buyFloat(S, RW, id, day) {
    var f = floatById(id); if (!f) return { ok: false, why: 'unknown float' };
    var st = laneState(S); if (owns(st, id)) return { ok: false, why: 'Already yours.' };
    st.floats[id] = day; st.float = id;
    try { RW.spend(f.cost, 'float:' + id, { lane: st }); } catch (e) { return { ok: false, why: e.message }; }
    return { ok: true, float: f };
  }
  function useFloat(S, id) { var st = laneState(S); if (!owns(st, id)) return { ok: false, why: 'Not yours yet.' }; st.float = id; var w = write(S, st); return w.ok ? { ok: true, float: floatById(id) } : w; }
  /* the rail and the aquarium wait for their art: nothing is sold that she could not see or wear */
  function buyRail(id) { var it = RAIL.filter(function (o) { return o.id === id; })[0] || (id === AQUARIUM.id ? AQUARIUM : null); if (!it) return { ok: false, why: 'Not in the shop.' }; return { ok: false, why: it.name + ' arrives with the next art run.' }; } /* selling starts once `ready` items have their art and a place to go */

  function waiting(st, day) { return st.letters.filter(function (x) { return x.opens > day; }); }
  function arrived(st, day) { return st.letters.filter(function (x) { return x.opens <= day; }); }
  function unread(S, day) { return arrived(laneState(S), day).filter(function (x) { return !x.read; }); }
  function writeLetter(S, text, when, day, rnd) {
    var t = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim().slice(0, LETTER.max).trim();
    if (!t) return { ok: false, why: 'Write a few words first.' };
    var n = LETTER.after[when]; if (!n) return { ok: false, why: 'Choose when it arrives.' };
    var st = laneState(S);
    if (waiting(st, day).length >= LETTER.waiting) return { ok: false, why: 'Twelve letters are already on their way. Let one arrive first.' };
    if (st.letters.length >= LETTER.keep) return { ok: false, why: 'The post box holds sixty letters. Delete one you have read first.' };
    var r = typeof rnd === 'number' ? rnd : Math.random(), L = { id: 'l' + day.replace(/-/g, '') + Math.floor(r * 1e9).toString(36), written: day, opens: S.addDays(day, n), text: t };
    while (st.letters.some(function (x) { return x.id === L.id; })) L.id += 'x';
    st.letters = [L].concat(st.letters);
    var w = write(S, st); return w.ok ? { ok: true, letter: L } : w;
  }
  /* sealed until its day: an early tap says when it arrives and opens nothing */
  function openLetter(S, id, day) {
    var st = laneState(S), L = st.letters.filter(function (x) { return x.id === id; })[0];
    if (!L) return { ok: false, why: 'That letter is not here any more.' };
    if (L.opens > day) return { ok: false, sealed: true, opens: L.opens, why: 'Sealed until ' + L.opens + '.' };
    if (!L.read) { L.read = day; if (!write(S, st).ok) { delete L.read; return { ok: true, letter: L, unsaved: true }; } } /* a full phone still opens her letter; it stays new */
    return { ok: true, letter: L };
  }
  function deleteLetter(S, id) {
    var st = laneState(S), n = st.letters.length; st.letters = st.letters.filter(function (x) { return x.id !== id; });
    if (st.letters.length === n) return { ok: false, why: 'That letter is not here any more.' };
    return write(S, st);
  }
  var LN = { PLACES: PLACES, FLOATS: FLOATS, RAIL: RAIL, AQUARIUM: AQUARIUM, STATIONS: STATIONS, LETTER: LETTER, WHEN: WHEN,
    place: place, openAt: openAt, openNow: openNow, hoursText: hoursText, laneState: laneState, owns: owns, floatOf: floatOf, buyFloat: buyFloat, useFloat: useFloat, buyRail: buyRail,
    waiting: waiting, arrived: arrived, unread: unread, writeLetter: writeLetter, openLetter: openLetter, deleteLetter: deleteLetter };
  root.OvuLane = LN;

  /* ---------- the sheets ---------- */
  var S = root.OvuStore, R = root.OvuRoom, W = root.OvuWalk, doc = root.document;
  if (!R || !S || !doc || !doc.createElement) return;
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { return S.today(); } /* letters and floats keep real calendar dates */
  function farmDay() { var GT = root.OvuGameTime; return GT ? GT.dayKey() : S.today(); }
  function RW() { return root.OvuRewards; }
  function F() { return root.OvuFarm; }
  function KT() { return root.OvuKitchen; } /* the farm kitchen's staples (ovu-kitchen.js) */
  function hearts() { var rw = RW(); return rw ? (rw.tester && rw.tester() ? Infinity : rw.ledger().hearts) : 0; }
  function heartTxt(n) { return n + ' ♥'; }
  function num(v) { var x = Math.floor(Number(v)); return isFinite(x) && x > 0 ? x : 0; } /* a restored backup's counts reach the page as numbers only (review, 21 Oct) */
  function dateText(d) { try { return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' }); } catch (e) { return d; } }
  /* the back row: with the hearts she has (a shop), "Free" (the gym) or nothing beside it */
  function nav(mode) { var h = hearts(), side = mode === 'hearts' ? '<span class="heartsmini"><span class="ms fill">favorite</span>' + (h === Infinity ? '∞' : h) + '</span>' : mode === 'free' ? '<span class="heartsmini"><span class="ms">volunteer_activism</span>Free</span>' : ''; return '<div class="streetnav"><button type="button" class="back" data-lane="back"><span class="ms">arrow_back</span>Harbour Lane</button>' + side + '</div>'; }
  function mind(text) { return text ? '<p class="mindline"><span class="ms">spa</span><span>' + esc(text) + '</span></p>' : ''; }
  /* every place sheet: Back goes to the lane; a closed place shows its hours instead */
  function wireBack() { var b = doc.querySelector('#sheet [data-lane=back]'); if (b) b.addEventListener('click', function () { R.chime('tap'); openLane(); }); }
  function shut(id) {
    var p = place(id), now = new Date(), h = now.getHours() + now.getMinutes() / 60, when = h < p.hours[0] ? 'It opens at ' + fmtHour(p.hours[0]) + ' today.' : 'It opens again at ' + fmtHour(p.hours[0]) + ' tomorrow.';
    R.openSheet('lane-closed', p.name, 'Opening hours', 'schedule', nav() +
      '<div class="closedcard"><span class="ms">schedule</span><b>' + esc(p.name) + ' is closed right now.</b><p>Open ' + esc(hoursText(id)) + ', every day. ' + when + '</p></div>');
    wireBack();
  }
  function stillOpen(id) { if (R.asleep && R.asleep()) { R.hideSheet(); return false; } if (!openNow(id)) { shut(id); return false; } return true; }

  function openLane() {
    var post = unread(S, today()).length;
    R.openSheet('lane', 'Harbour Lane', 'Four shops and a post box, up from the harbour', 'signpost',
      '<div class="street lane">' + PLACES.map(function (p) {
        var on = openNow(p.id); return '<button type="button" class="store' + (on ? '' : ' closed') + '" data-place="' + p.id + '"><span class="ms storeic">' + p.icon + '</span><span><b>' + esc(p.name) + '</b><small>' + esc(p.kind) + ' · ' + esc(p.blurb) + (p.id === 'post' && post ? ' · <em class="postnew">post for you</em>' : '') + '</small><small class="hours">' + (on ? (p.hours ? 'Open now · ' : '') : 'Closed · opens ') + esc(hoursText(p.id)) + '</small></span><span class="ms">chevron_right</span></button>';
      }).join('') + '</div>' +
      '<p class="help">The lane itself is still being drawn. Until then the signpost brings each place to you, and everything in it works.</p>');
    var box = doc.querySelector('#sheet .lane'); if (box) box.addEventListener('click', function (e) { var b = e.target.closest('[data-place]'); if (!b) return; R.chime('tap'); openPlace(b.dataset.place); });
  }
  function openPlace(id) {
    if (!place(id)) return;
    if (R.asleep && R.asleep()) { R.toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return; }
    if (!openNow(id)) { shut(id); return; }
    swapGive = null;
    ({ grocer: openGrocer, boutique: openBoutique, gym: openGym, fish: openFishStore, post: openPost })[id]();
  }

  /* Hay & Harvest: the packs and new crops the shed sold until 21 Oct (same prices, same one-save rules) and the swap */
  var swapGive = null;
  function openGrocer() {
    var FM = F(); if (!FM) return;
    var f = FM.farmState(S), h = hearts(), grow = FM.growable(f), locked = Object.keys(FM.CROPS).filter(function (k) { return !FM.canGrow(f, k) && !FM.CROPS[k].moved; }), GH = root.OvuGreenhouse, gs = GH ? GH.herbState(S) : null, free = !!GH && GH.freeStartOpen(S), give = GH ? GH.swapGivableAll(S) : FM.swapGivable(S), takes = GH ? GH.swapTakeable(S) : grow; /* lemongrass moved to the greenhouse, and the swap takes herbs too (21 Oct) */
    var kind = function (k) { return (GH && GH.HERBS[k]) || FM.CROPS[k]; }, need = function (k) { return GH ? GH.swapNeedAny(k) : FM.swapNeed(k); }, have = function (k) { return GH && GH.HERBS[k] ? num(gs.seeds[k]) : num(f.seeds[k]); };
    if (swapGive && give.indexOf(swapGive) < 0) swapGive = null;
    var html = nav('hearts') + mind('Choose one thing you would like to grow in yourself this week.') +
      '<h4 class="shedh"><span class="ms">redeem</span>Seed packs <small>' + FM.PACK.seeds + ' seeds · ' + heartTxt(FM.PACK.cost) + '</small></h4>' +
      '<div class="seedlist" id="grocerBuy">' + grow.map(function (k) { var c = FM.CROPS[k]; return '<button type="button" class="btn soft" data-pack="' + k + '"' + (h >= FM.PACK.cost ? '' : ' disabled') + '><span class="ms">redeem</span><span><b>' + esc(c.name) + '</b><small>' + c.days + ' days · have ' + num(f.seeds[k]) + '</small></span></button>'; }).join('') +
      locked.map(function (k) { var c = FM.CROPS[k]; return '<button type="button" class="btn soft" data-unlock="' + k + '"' + (h >= c.cost ? '' : ' disabled') + '><span class="ms">lock_open</span><span><b>Grow ' + esc(c.name.toLowerCase()) + '</b><small>' + c.days + ' days · for good, one seed to start · ' + heartTxt(c.cost) + '</small></span></button>'; }).join('') + '</div>' +
      (KT() ? (function () { var kt = KT(), have = kt.staplesOf(S); return '<h4 class="shedh"><span class="ms">kitchen</span>Kitchen staples <small>one portion each</small></h4>' +
        '<div class="seedlist" id="grocerStaples">' + Object.keys(kt.STAPLES).map(function (k) { var st = kt.STAPLES[k]; return '<button type="button" class="btn soft" data-staple="' + k + '"' + (h >= st.cost ? '' : ' disabled') + '><span class="ms">' + st.icon + '</span><span><b>' + esc(st.name) + '</b><small>have ' + num(have[k]) + ' · ' + heartTxt(st.cost) + '</small></span></button>'; }).join('') + '</div>' +
        '<p class="help" style="margin-top:6px">For cooking what you grow: open the basket on the farm, or the stove in the family home.</p>'; })() : '') +
      (GH ? '<h4 class="shedh"><span class="ms">local_florist</span>For the greenhouse <small>' + (free ? 'your first one is free' : 'for the planters') + '</small></h4>' +
        (free ? '<p class="help" style="margin-top:0">Choose any one to start with, free. After that, each costs what it says.</p>' : '') +
        '<div class="seedlist" id="grocerHerbs">' + GH.HERB_IDS.map(function (k) { var hb = GH.HERBS[k]; return '<button type="button" class="btn soft" data-herbstart="' + k + '"' + (free || h >= hb.cost ? '' : ' disabled') + '><span class="ms">spa</span><span><b>' + esc(hb.start) + '</b><small>ready in ' + hb.ripe + ' days, again every ' + hb.regrow + ' · have ' + num(gs.seeds[k]) + ' · ' + (free ? 'free' : heartTxt(hb.cost)) + '</small></span></button>'; }).join('') + '</div>' : '') +
      '<h4 class="shedh"><span class="ms">swap_horiz</span>Seed swap <small>no hearts</small></h4>' +
      '<p class="help" style="margin-top:0">Three from your basket for one seed of any crop you grow' + (GH ? ', or a start of any herb. Herbs count too' : '') + '. A pumpkin counts as three.</p>';
    if (!give.length) html += '<p class="help pantryline"><span class="ms">shopping_basket</span>Nothing to swap yet: the basket needs three of one kind, or a pumpkin.</p>';
    else {
      html += '<div class="chips" id="swapGive">' + give.map(function (k) { var c = kind(k), n = need(k); return '<button type="button" class="chipbtn' + (k === swapGive ? ' on' : '') + '" data-give="' + k + '" aria-pressed="' + (k === swapGive) + '">' + n + ' ' + esc(n === 1 ? c.name.toLowerCase() : c.plural) + ' <small>of ' + num(f.harvest[k]) + '</small></button>'; }).join('') + '</div>' +
        (swapGive ? '<div class="seedlist" id="swapTake">' + takes.map(function (k) { var herb = !!(GH && GH.HERBS[k]); return '<button type="button" class="btn soft" data-take="' + k + '"><span class="ms">' + (herb ? 'local_florist' : 'spa') + '</span><span><b>' + esc(herb ? GH.HERBS[k].start : FM.CROPS[k].name + ' seed') + '</b><small>' + (herb ? 'for the greenhouse · ' : '') + 'have ' + have(k) + '</small></span></button>'; }).join('') + '</div>' : '<p class="help">Choose what to give, then which seed to take.</p>');
    }
    R.openSheet('lane-grocer', 'Hay & Harvest', 'Grocer · ' + hoursText('grocer'), 'storefront', html + '<p class="help">Hearts come from logging. The shed still gives its free seeds each day.</p>');
    wireBack();
    var buy = doc.getElementById('grocerBuy'); if (buy) buy.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-pack],[data-unlock]'); if (!btn || btn.disabled || !stillOpen('grocer')) return;
      var res = btn.dataset.pack ? FM.buyPack(S, RW(), btn.dataset.pack) : FM.unlockCrop(S, RW(), btn.dataset.unlock);
      if (!res.ok) { R.toast(res.why, 'info'); return; }
      R.chime('save'); var line = R.moment ? R.moment('shop', { quiet: true }) : '';
      R.toast(btn.dataset.pack ? res.n + ' ' + FM.CROPS[btn.dataset.pack].name.toLowerCase() + ' seeds are in the shed.' : FM.CROPS[res.crop].name + ' grows on your farm now.', 'redeem', line);
      if (R.renderDeck) R.renderDeck(); openGrocer();
    });
    var sp = doc.getElementById('grocerStaples'); if (sp) sp.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-staple]'); if (!btn || btn.disabled || !stillOpen('grocer')) return;
      var res = KT().buyStaple(S, RW(), btn.dataset.staple); if (!res.ok) { R.toast(res.why, 'info'); return; }
      R.chime('save'); var line = R.moment ? R.moment('shop', { quiet: true }) : '', st = KT().STAPLES[res.id];
      R.toast(st.pantry ? 'An egg is in the pantry.' : st.name + (st.pl ? ' are' : ' is') + ' in the kitchen.', 'kitchen', line);
      if (R.renderDeck) R.renderDeck(); openGrocer();
    });
    var hs = doc.getElementById('grocerHerbs'); if (hs) hs.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-herbstart]'); if (!btn || btn.disabled || !stillOpen('grocer')) return;
      var res = GH.freeStartOpen(S) ? GH.freeStart(S, btn.dataset.herbstart, today()) : GH.buyStart(S, RW(), btn.dataset.herbstart); if (!res.ok) { R.toast(res.why, 'info'); return; }
      R.chime('save'); var line = R.moment ? R.moment('shop', { quiet: true }) : '';
      R.toast(GH.HERBS[res.herb].start + ' for the greenhouse. Plant it in a planter by the door.', 'local_florist', line);
      if (R.renderDeck) R.renderDeck(); openGrocer();
    });
    var gv = doc.getElementById('swapGive'); if (gv) gv.addEventListener('click', function (e) { var b = e.target.closest('[data-give]'); if (!b) return; R.chime('tap'); swapGive = b.dataset.give === swapGive ? null : b.dataset.give; openGrocer(); });
    var tk = doc.getElementById('swapTake'); if (tk) tk.addEventListener('click', function (e) {
      var b = e.target.closest('[data-take]'); if (!b || !swapGive || !stillOpen('grocer')) return;
      var res = GH ? GH.swapAny(S, swapGive, b.dataset.take) : FM.swapSeed(S, swapGive, b.dataset.take); swapGive = null;
      if (!res.ok) { R.toast(res.why, 'info'); openGrocer(); return; }
      R.chime('save'); var line = R.moment ? R.moment('seedswap', { quiet: true }) : '';
      var gc = kind(res.give), took = res.take || res.crop; R.toast('Swapped ' + res.gave + ' ' + (res.gave === 1 ? gc.name.toLowerCase() : gc.plural) + (res.herb ? ' for ' + GH.HERBS[took].start.toLowerCase() + '. It is ready for the greenhouse.' : ' for a ' + FM.CROPS[took].name.toLowerCase() + ' seed. It is in the shed.'), 'swap_horiz', line);
      openGrocer();
    });
  }

  /* Petal & Thread: the fitting room is her wardrobe (every outfit she has stays free); the new rail waits for its art */
  function openBoutique() {
    R.openSheet('lane-boutique', 'Petal & Thread', 'Boutique · ' + hoursText('boutique'), 'checkroom', nav('hearts') +
      '<div class="row"><button type="button" class="btn primary" id="fitRoom"><span class="ms">checkroom</span>The fitting room</button></div>' +
      '<p class="help">Every outfit you have is free to wear, and always will be.</p>' +
      '<p class="shelf"><span class="ms">new_releases</span>The new rail</p>' +
      '<div class="seedlist one" id="railList">' + RAIL.map(function (o) { return '<button type="button" class="btn soft" data-rail="' + o.id + '" disabled><span class="ms">checkroom</span><span><b>' + esc(o.name) + '</b><small>' + esc(o.note) + ' · ' + heartTxt(o.cost) + ' · Arriving with the next art run</small></span></button>'; }).join('') + '</div>' +
      mind('Notice how the fabric feels. Nothing to fix about you.'));
    wireBack();
    var fr = doc.getElementById('fitRoom'); if (fr) fr.addEventListener('click', function () { R.chime('tap'); if (R.openWardrobe) R.openWardrobe(); });
  }

  /* Tideline Gym: free, earns nothing by itself, logs nothing; a station opens the movement log with its activity chosen */
  function openGym() {
    R.openSheet('lane-gym', 'Tideline Gym', 'Gym · ' + hoursText('gym'), 'fitness_center', nav('free') +
      '<p class="help">Free, always. Nothing here is counted unless you log it yourself, and only what you really did.</p>' +
      '<div class="gymlist" id="gymList">' + STATIONS.map(function (s) { return '<div class="gymst"><span class="ms">' + s.icon + '</span><span><b>' + esc(s.name) + '</b><small>' + esc(s.line) + '</small></span><button type="button" class="btn sm soft" data-station="' + s.id + '"><span class="ms">add</span>Log movement</button></div>'; }).join('') + '</div>' +
      '<div class="row"><button type="button" class="btn ghost" id="gymGuide"><span class="ms">menu_book</span>Movement and your cycle</button></div>');
    wireBack();
    var gl = doc.getElementById('gymList'); if (gl) gl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-station]'); if (!b) return; var st = STATIONS.filter(function (x) { return x.id === b.dataset.station; })[0]; if (!st) return;
      if (R.openExercise) R.openExercise(st.act); if (R.moment) R.moment('gym', { quiet: true }); /* choosing the activity in the movement sheet chimes once */
    });
    var gg = doc.getElementById('gymGuide'); if (gg) gg.addEventListener('click', function () { R.chime('tap'); if (R.openMoveGuide) R.openMoveGuide(); });
  }

  /* Bait & Fin: catch and release only, so no bait and no fish for sale; floats are for looks */
  function openFishStore() {
    var st = laneState(S), h = hearts();
    R.openSheet('lane-fish', 'Bait & Fin', 'Fish store · ' + hoursText('fish'), 'phishing', nav('hearts') +
      '<p class="help">Catch and release only, so there is no bait and no fish for sale. A float is just for looks.</p>' +
      '<p class="shelf"><span class="ms">palette</span>Floats</p>' +
      '<div class="seedlist" id="floatList">' + FLOATS.map(function (f) {
        var mine = owns(st, f.id), using = st.float === f.id;
        return '<button type="button" class="btn soft' + (using ? ' on' : '') + '" data-float="' + f.id + '"' + (!mine && h < f.cost ? ' disabled' : '') + ' aria-pressed="' + using + '"><span class="floatdot' + (f.glow ? ' glow' : '') + '" style="--floatc:' + f.top + '"></span><span><b>' + esc(f.name) + '</b><small>' + (using ? 'In use' : mine ? 'Yours · tap to use' : heartTxt(f.cost)) + (f.note ? ' · ' + esc(f.note) : '') + '</small></span></button>';
      }).join('') + '</div>' +
      '<p class="shelf"><span class="ms">chair</span>For your room</p>' +
      '<div class="seedlist one"><button type="button" class="btn soft" data-rail="aquarium" disabled><span class="ms">water</span><span><b>' + esc(AQUARIUM.name) + '</b><small>' + esc(AQUARIUM.note) + ' · ' + heartTxt(AQUARIUM.cost) + ' · Arriving with the next art run</small></span></button></div>' +
      '<div class="row"><button type="button" class="btn ghost" id="fishBook"><span class="ms">menu_book</span>The catch book</button></div>');
    wireBack();
    var fl = doc.getElementById('floatList'); if (fl) fl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-float]'); if (!b || b.disabled) return; var id = b.dataset.float;
      if (owns(laneState(S), id)) { var u = useFloat(S, id); if (!u.ok) { R.toast(u.why, 'info'); return; } R.chime('tap'); R.toast(u.float.name + ' float on the line.', 'phishing'); openFishStore(); return; }
      if (!stillOpen('fish')) return;
      var r = buyFloat(S, RW(), id, today()); if (!r.ok) { R.toast(r.why, 'info'); return; }
      R.chime('save'); var line = R.moment ? R.moment('shop', { quiet: true }) : '';
      R.toast(r.float.name + ' float is yours, and on the line.', 'phishing', line); if (R.renderDeck) R.renderDeck(); openFishStore();
    });
    var fb = doc.getElementById('fishBook'); if (fb) fb.addEventListener('click', function () { R.chime('tap'); if (root.OvuHarbour && root.OvuHarbour.openBook) root.OvuHarbour.openBook(null); });
  }

  /* the post box: a kind postcard goes through Plaza friends (set phrases, block and report, the server's rules); a letter
   * to future you is sealed until its day and stays on this phone */
  var when = 'week';
  function openPost(note) {
    var day = today(), st = laneState(S), come = arrived(st, day), wait = waiting(st, day);
    var row = function (L, sealed) {
      return '<li class="letterrow' + (sealed ? ' sealed' : L.read ? '' : ' new') + '"><span class="ms">' + (sealed ? 'mail_lock' : L.read ? 'drafts' : 'mail') + '</span><span><b>' + (sealed ? 'Arrives ' + esc(dateText(L.opens)) : (L.read ? 'Written ' : 'Arrived · written ') + esc(dateText(L.written))) + '</b><small>' + (sealed ? 'Sealed. Written ' + esc(dateText(L.written)) + '.' : !L.read ? 'Waiting to be read.' : esc(L.text.slice(0, 60)) + (L.text.length > 60 ? '…' : '')) + '</small></span>' +
        (sealed ? '' : '<button type="button" class="btn sm soft" data-read="' + esc(L.id) + '">Read</button>') + '<button type="button" class="btn sm ghost" data-del="' + esc(L.id) + '" aria-label="Delete this letter">Delete</button></li>';
    };
    R.openSheet('lane-post', 'The post box', 'Always open', 'markunread_mailbox', nav() +
      (come.length ? '<p class="shelf"><span class="ms">mail</span>Post for you</p><ul class="letterlist" id="lettersIn">' + come.map(function (L) { return row(L, false); }).join('') + '</ul>' : '') +
      '<p class="shelf"><span class="ms">favorite</span>A postcard to a friend</p>' +
      '<div class="row"><button type="button" class="btn soft" id="postCard"><span class="ms">mail</span>Send a kind postcard</button></div>' +
      '<p class="help">Postcards go to friends you met in the plaza, as a kind note: set phrases only, and they can block or report.</p>' +
      '<p class="shelf"><span class="ms">edit_note</span>A letter to future you</p>' +
      '<textarea class="input lettertext" id="letterText" maxlength="' + LETTER.max + '" rows="4" placeholder="Dear me," aria-label="Your letter">' + esc(note || '') + '</textarea>' +
      '<div class="chips" id="letterWhen">' + WHEN.map(function (w) { return '<button type="button" class="chipbtn' + (w[0] === when ? ' on' : '') + '" data-when="' + w[0] + '" aria-pressed="' + (w[0] === when) + '">' + w[1] + '</button>'; }).join('') + '</div>' +
      '<div class="row"><button type="button" class="btn primary" id="letterSend"><span class="ms">send</span>Post it</button></div><div class="msg" id="letterMsg"></div>' +
      (wait.length ? '<ul class="letterlist" id="lettersOut">' + wait.map(function (L) { return row(L, true); }).join('') + '</ul>' : '') +
      '<p class="help">Kept on this phone only and sealed until the day it arrives. Luna never reads it, and it is never in a report.</p>');
    wireBack();
    var pc = doc.getElementById('postCard'); if (pc) pc.addEventListener('click', function () { R.chime('tap'); if (root.OvuFriends && root.OvuFriends.open) root.OvuFriends.open(); else R.toast('Plaza friends are not available right now.', 'info'); });
    var wh = doc.getElementById('letterWhen'); if (wh) wh.addEventListener('click', function (e) { var b = e.target.closest('[data-when]'); if (!b) return; when = b.dataset.when; [].forEach.call(wh.querySelectorAll('[data-when]'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); });
    var send = doc.getElementById('letterSend'); if (send) send.addEventListener('click', function () {
      var ta = doc.getElementById('letterText'), r = writeLetter(S, ta ? ta.value : '', when, today());
      if (!r.ok) { var m = doc.getElementById('letterMsg'); if (m) { m.textContent = r.why; m.className = 'msg on err'; } return; }
      R.chime('save'); var line = R.moment ? R.moment('letter', { quiet: true }) : '';
      R.toast('Posted. It arrives ' + dateText(r.letter.opens) + '.', 'send', line); openPost();
    });
    [doc.getElementById('lettersIn'), doc.getElementById('lettersOut')].forEach(function (box) {
      if (box) box.addEventListener('click', function (e) {
        var rd = e.target.closest('[data-read]'), dl = e.target.closest('[data-del]');
        if (rd) { R.chime('tap'); readLetter(rd.dataset.read); return; }
        if (!dl) return;
        if (!dl.classList.contains('confirm')) { dl.classList.add('confirm'); dl.textContent = 'Delete?'; dl.setAttribute('aria-label', 'Tap again to delete'); return; }
        var r = deleteLetter(S, dl.dataset.del); if (!r.ok) { R.toast(r.why, 'info'); return; }
        R.chime('tap'); R.toast('Letter deleted.', 'delete'); openPost(doc.getElementById('letterText') ? doc.getElementById('letterText').value : '');
      });
    });
  }
  function readLetter(id) {
    var r = openLetter(S, id, today()); if (!r.ok) { R.toast(r.sealed ? 'Sealed until ' + dateText(r.opens) + '.' : r.why, 'mail_lock'); return; }
    var L = r.letter, line = R.moment ? R.moment('letterread', { quiet: true }) : '';
    if (r.unsaved) R.toast('The phone is full, so it stays marked new.', 'info');
    R.openSheet('lane-letter', 'A letter from you', 'Written ' + dateText(L.written) + ' · arrived ' + dateText(L.opens), 'drafts',
      '<blockquote class="letterbody">' + esc(L.text).replace(/\n/g, '<br>') + '</blockquote>' + mind(line) +
      '<div class="row"><button type="button" class="btn soft" id="letterBack"><span class="ms">markunread_mailbox</span>Back to the post box</button></div>');
    var b = doc.getElementById('letterBack'); if (b) b.addEventListener('click', function () { R.chime('tap'); openPost(); });
  }

  R.hotspotHandlers.hblane = function (id, L) {
    if (!L || L.id !== 'harbour') return false;
    if ((W && W.napping && W.napping()) || R.busy()) return true;
    openLane(); return true;
  };
  LN.openLane = openLane; LN.openPlace = openPlace; LN.openGrocer = openGrocer; LN.openBoutique = openBoutique; LN.openGym = openGym; LN.openFishStore = openFishStore; LN.openPost = openPost; LN.readLetter = readLetter;
})(typeof window !== 'undefined' ? window : this);
