/* Rhythme villagers, Harvest Moon style (Jamie, 22 Oct 2026: "we can have NPC ... like harvest moon courting", "dishes can
 * be used to court the NPC.. We can have a relationship dating"). Design: docs/design/2026-10-22-harvest-moon-life.md, phase 4.
 * Two original villagers (not based on any real person): Shen Yuan, a gentle bookseller in the plaza, and Lu Chen, a sunny
 * boat-builder at the harbour. Talk once a day and give one gift a day from her bag (a dish counts most); friendship is 0 to
 * 100 points shown as 0 to 10 hearts, black to red as in Harvest Moon. A short heart scene plays at 2, 4, 6, 8 and 10 hearts.
 * At a red heart, with every scene seen and a dream house of her own, a blue feather lets her propose. Friendship never goes
 * down and nobody is ever upset with her. Game state only (state.villagers): it never writes a diary entry, and the only
 * hearts it spends are the feather's, through OvuRewards.spend. Pure rules first (tested in node), then the scenes. */
(function (root) {
  'use strict';
  var VILLAGERS = [
    { id: 'shen', name: 'Shen Yuan', role: 'Bookseller', img: 'villager-shen.webp', scene: 'plaza', spot: { x: 72, y: 54, w: 7.5 },
      loves: ['pandanrice', 'pumpkinsoup', 'strawberrybowl'], likes: ['sweetpotatoginger', 'carrotradish', 'strawberry', 'milk'],
      talk: ['Good morning. I saved you the window seat.', 'This one has a happy ending. I checked.', 'Tea first, then stories.', 'The rain makes the shop smell of paper. I like it.', 'You look rested today. Good.'],
      events: {
        2: ['Shen is sorting a box of old books.', '"Someone left these at the door. Poems, mostly."', 'He hands you a thin one with a pressed flower inside.', '"Keep it. It suits you."'],
        4: ['Shen is reading aloud to no one.', '"I practise, in case someone asks."', 'You ask. He reads you a page, slowly, and does not look up once.'],
        6: ['Shen has made tea for two.', '"I guessed you would come by. I hoped, anyway."', 'You sit together until the pot is empty.'],
        8: ['Shen walks you to the fountain at dusk.', '"I wrote something. It is not very good."', 'It is a list of small things you said that he remembered.'],
        10: ['Shen is waiting by the fountain, nervous.', '"I am better with books than words."', '"But I would like every chapter to have you in it."']
      } },
    { id: 'lu', name: 'Lu Chen', role: 'Boat-builder', img: 'villager-lu.webp', scene: 'harbour', spot: { x: 22, y: 71, w: 8 },
      loves: ['tomatoegg', 'kangkongfry', 'pakchoynoodles'], likes: ['garlicpakchoy', 'tomatotofu', 'egg', 'carrot'],
      talk: ['Morning! The tide is gentle today.', 'I sanded this boat for a week. Look how smooth.', 'Breathe in. That is the sea, saying hello.', 'You walk like you have somewhere nice to be.', 'Come watch the boats with me one day.'],
      events: {
        2: ['Lu is painting a little boat lilac.', '"For you. Every harbour needs one in your colour."'],
        4: ['Lu teaches you a knot that will not slip.', '"Hold it, then let go. It holds on its own."', 'He grins when you get it right the first time.'],
        6: ['Lu has packed a picnic on the jetty.', '"I made the egg. It is lopsided. It tastes fine."', 'You eat with your feet over the water.'],
        8: ['Lu shows you a boat he has never finished.', '"I keep it for the right day."', '"I think that day is getting closer."'],
        10: ['Lu is waiting at the end of the jetty.', '"I built a lot of boats here."', '"I would like to build a life with you, if you will have me."']
      } }
  ];
  var LEVELS = [2, 4, 6, 8, 10], MAX = 100, FEATHER = 300;
  /* Harvest Moon's heart colours, black to red */
  var COLOURS = [['Black', '#4a4458'], ['Purple', '#9b6fd0'], ['Blue', '#5f8fd8'], ['Yellow', '#e6b93c'], ['Orange', '#f08a4b'], ['Red', '#e8506e']];
  function byId(id) { return VILLAGERS.filter(function (v) { return v.id === id; })[0] || null; }
  function n0(v) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? n : 0; }
  function stateOf(st, id) { var all = (st && st.villagers) || {}, v = all[id] || {}; return { points: Math.min(MAX, n0(v.points)), talked: typeof v.talked === 'string' ? v.talked : null, gifted: typeof v.gifted === 'string' ? v.gifted : null, seen: Array.isArray(v.seen) ? v.seen.filter(function (x) { return LEVELS.indexOf(x) > -1; }) : [], engaged: !!v.engaged }; }
  function hearts(points) { return Math.min(10, Math.floor(n0(points) / 10)); }
  function colour(h) { return COLOURS[Math.min(5, Math.floor(n0(h) / 2))]; }
  /* what a gift is worth: a loved thing 8 points, a liked one 5, any other dish 4, anything else 2 */
  function giftPoints(v, key, kind) { if (v.loves.indexOf(key) > -1) return 8; if (v.likes.indexOf(key) > -1) return 5; return kind === 'dish' ? 4 : 2; }
  function nextEvent(vs) { var h = hearts(vs.points); return LEVELS.filter(function (l) { return l <= h && vs.seen.indexOf(l) < 0; })[0] || null; }
  function canPropose(vs, ownsHome) { return hearts(vs.points) >= 10 && LEVELS.every(function (l) { return vs.seen.indexOf(l) > -1; }) && !!ownsHome && !vs.engaged; }
  /* pure: apply a talk or a gift to a copy of the villagers state; returns {state, gained, why} */
  function talk(all, id, day) {
    var v = byId(id); if (!v) return { ok: false, why: 'unknown villager' };
    var out = JSON.parse(JSON.stringify(all || {})), vs = stateOf({ villagers: out }, id);
    if (vs.talked && day < vs.talked) return { ok: false, why: 'clock' };
    var gained = vs.talked === day ? 0 : 3; vs.points = Math.min(MAX, vs.points + gained); vs.talked = day;
    out[id] = vs; return { ok: true, state: out, gained: gained };
  }
  function gift(all, id, day, key, kind) {
    var v = byId(id); if (!v) return { ok: false, why: 'unknown villager' };
    var out = JSON.parse(JSON.stringify(all || {})), vs = stateOf({ villagers: out }, id);
    if (vs.gifted === day) return { ok: false, why: v.name + ' already had a gift from you today.' };
    if (vs.gifted && day < vs.gifted) return { ok: false, why: 'clock' };
    var g = giftPoints(v, key, kind); vs.points = Math.min(MAX, vs.points + g); vs.gifted = day;
    out[id] = vs; return { ok: true, state: out, gained: g, loved: g === 8 };
  }
  var V = { VILLAGERS: VILLAGERS, LEVELS: LEVELS, MAX: MAX, FEATHER: FEATHER, COLOURS: COLOURS, byId: byId, stateOf: stateOf, hearts: hearts, colour: colour, giftPoints: giftPoints, nextEvent: nextEvent, canPropose: canPropose, talk: talk, gift: gift };
  root.OvuVillagers = V;

  /* ---------- the scenes (browser) ---------- */
  var S = root.OvuStore, R = root.OvuRoom, FM = root.OvuFarm, K = root.OvuKitchen, RW = root.OvuRewards, doc = root.document;
  if (!R || !S || !doc || !FM) return;
  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s); }
  function today() { return root.OvuGameTime ? root.OvuGameTime.dayKey() : S.today(); }
  function all() { return S.state().villagers || {}; }
  function ownsHome() { var o = (RW && RW.ledger && RW.ledger().owned) || []; return ['house', 'bathhouse', 'familyhome'].some(function (h) { return o.indexOf(h) > -1; }); }
  function heartRow(points) {
    var h = hearts(points), c = colour(h), out = '';
    for (var i = 0; i < 10; i++) out += '<span class="ms' + (i < h ? ' fill' : ' off') + '" style="color:' + (i < h ? c[1] : '') + '">favorite</span>';
    return '<div class="vhearts" aria-label="' + h + ' of 10 hearts, ' + c[0].toLowerCase() + '">' + out + '</div>';
  }
  /* what she could give: dishes, then the basket, then the pantry */
  function bag() {
    var f = FM.farmState(S), items = [], dn = {};
    if (K && K.RECIPES) K.RECIPES.forEach(function (r) { dn[r.id] = r.name; });
    Object.keys(f.dishes || {}).forEach(function (k) { if (n0(f.dishes[k]) && dn[k]) items.push({ key: k, kind: 'dish', name: dn[k], n: n0(f.dishes[k]), img: 'assets/food/dish-' + k + '.webp' }); });
    Object.keys(f.harvest || {}).forEach(function (k) { if (n0(f.harvest[k]) && FM.CROPS[k]) items.push({ key: k, kind: 'crop', name: FM.CROPS[k].name, n: n0(f.harvest[k]), img: FM.cropPic ? null : null }); });
    ['egg', 'milk'].forEach(function (k) { if (n0(f.pantry && f.pantry[k])) items.push({ key: k, kind: 'pantry', name: k === 'egg' ? 'Egg' : 'Milk', n: n0(f.pantry[k]) }); });
    return items;
  }
  function takeFromBag(f, it) {
    if (it.kind === 'dish') { f.dishes = Object.assign({}, f.dishes || {}); f.dishes[it.key] = n0(f.dishes[it.key]) - 1; if (!f.dishes[it.key]) delete f.dishes[it.key]; }
    else if (it.kind === 'crop') { f.harvest[it.key] = n0(f.harvest[it.key]) - 1; if (!f.harvest[it.key]) delete f.harvest[it.key]; }
    else { f.pantry[it.key] = n0(f.pantry[it.key]) - 1; if (root.OvuRanch) { var t = root.OvuRanch.takeProduct(f, it.key, 1).farm; f.ranch = t.ranch; } }
  }
  function save(patch) { if (S.commit) S.commit(patch); else S.setState(patch); }
  function openVillager(id) {
    var v = byId(id); if (!v) return;
    var vs = stateOf(S.state(), id), day = today(), ev = nextEvent(vs);
    if (ev) { playEvent(v, ev); return; }
    var h = hearts(vs.points), line = v.talk[(h + (day.charCodeAt(day.length - 1) || 0)) % v.talk.length];
    var items = bag(), propose = canPropose(vs, ownsHome());
    R.openSheet('villager-' + id, v.name, v.role + (vs.engaged ? ' · engaged to you' : ''), 'favorite',
      '<div class="vcard"><img src="' + R.ART + v.img + '" alt=""><div>' + heartRow(vs.points) + '<p class="vline">' + esc(line) + '</p></div></div>' +
      '<div class="row" id="vActs"><button type="button" class="btn primary" data-v="talk"' + (vs.talked === day ? ' disabled' : '') + '><span class="ms">chat</span>' + (vs.talked === day ? 'Talked today' : 'Talk') + '</button>' +
      (propose ? '<button type="button" class="btn soft" data-v="propose"><span class="ms">favorite</span>Propose (' + FEATHER + ' hearts, a blue feather)</button>' : '') + '</div>' +
      '<h4 class="shedh"><span class="ms">redeem</span>Give a gift' + (vs.gifted === day ? ' <small>given today</small>' : '') + '</h4>' +
      (items.length ? '<div class="seedlist" id="vGifts">' + items.map(function (it, i) { return '<button type="button" class="btn soft" data-gift="' + i + '"' + (vs.gifted === day ? ' disabled' : '') + '>' + (it.kind === 'dish' ? '<img class="croppic" src="' + it.img + '" alt="">' : it.kind === 'crop' && FM.cropPic ? FM.cropPic(it.key) : '<span class="ms">' + (it.key === 'milk' ? 'water_full' : 'egg') + '</span>') + '<span><b>' + esc(it.name) + '</b><small>have ' + it.n + '</small></span></button>'; }).join('') + '</div>' : '<p class="help">Your bag is empty. Cook a dish or pick something from the farm.</p>'));
    var acts = doc.getElementById('vActs'), gifts = doc.getElementById('vGifts');
    acts.addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]'); if (!b) return;
      if (b.dataset.v === 'talk') {
        var r = talk(all(), id, today()); if (!r.ok) return;
        try { save({ villagers: r.state }); } catch (er) { R.toast('That could not be saved just now.', 'info'); return; }
        if (R.moment) R.moment('hello', { quiet: true }); popHearts(id); openVillager(id); return;
      }
      if (b.dataset.v === 'propose') { propose_(v); }
    });
    if (gifts) gifts.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gift]'); if (!b) return; var it = items[Number(b.dataset.gift)]; if (!it) return;
      var go = function () {
        var f = JSON.parse(JSON.stringify(FM.farmState(S))), have = it.kind === 'dish' ? n0(f.dishes && f.dishes[it.key]) : it.kind === 'crop' ? n0(f.harvest[it.key]) : n0(f.pantry && f.pantry[it.key]);
        if (!have) { R.toast('That is no longer in your bag.', 'info'); openVillager(id); return; } /* another tab used it first */
        var r = gift(all(), id, today(), it.key, it.kind); if (!r.ok) { R.toast(r.why, 'info'); return; }
        takeFromBag(f, it);
        try { save({ villagers: r.state, farm: f }); } catch (er) { R.toast('That could not be saved just now.', 'info'); return; }
        if (R.moment) R.moment('friend', { quiet: true }); popHearts(id);
        R.toast(r.loved ? v.name + ' lights up. That is a favourite.' : v.name + ' smiles and keeps it close.', 'favorite'); openVillager(id);
      };
      if (FM.locked) FM.locked(S, go); else go(); /* the farm lock: the bag is read again after other tabs' saves */
    });
  }
  function playEvent(v, level) {
    var lines = v.events[level] || [];
    R.openSheet('villager-event', v.name, level + ' hearts', 'favorite',
      '<div class="vevent"><img src="' + R.ART + v.img + '" alt=""><div>' + lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div></div>' +
      '<div class="row"><button type="button" class="btn primary" id="vEvDone"><span class="ms">favorite</span>' + (level === 10 ? 'Smile back' : 'Keep this moment') + '</button></div>');
    doc.getElementById('vEvDone').addEventListener('click', function () {
      var out = JSON.parse(JSON.stringify(all())), vs = stateOf({ villagers: out }, v.id); if (vs.seen.indexOf(level) < 0) vs.seen.push(level); out[v.id] = vs;
      try { save({ villagers: out }); } catch (er) { } popHearts(v.id); openVillager(v.id);
    });
  }
  function propose_(v) {
    var vs = stateOf(S.state(), v.id); if (!canPropose(vs, ownsHome())) return;
    var out = JSON.parse(JSON.stringify(all())); out[v.id] = Object.assign({}, stateOf({ villagers: out }, v.id), { engaged: true });
    try { RW.spend(FEATHER, 'blue feather for ' + v.name, { villagers: out }); } catch (e) { R.toast(e.message, 'info'); return; }
    R.openSheet('villager-yes', v.name, 'Yes', 'favorite', '<div class="vevent"><img src="' + R.ART + v.img + '" alt=""><div><p>You hold out the blue feather.</p><p>' + esc(v.name.split(' ')[0]) + ' laughs, a little teary, and says yes.</p></div></div><div class="row"><button type="button" class="btn primary" id="vYes">Hold hands</button></div>');
    doc.getElementById('vYes').addEventListener('click', function () { R.hideSheet(); popHearts(v.id); });
  }
  /* hearts float up from a villager when friendship grows */
  function popHearts(id) {
    if (root.OvuSound) root.OvuSound.play('pet');
    var el = doc.querySelector('#ownedProps .villager[data-id="' + id + '"]'); if (!el) return;
    for (var i = 0; i < 3; i++) { var h = doc.createElement('span'); h.className = 'lovepop'; h.innerHTML = '<span class="ms fill">favorite</span>'; h.style.left = el.style.left; h.style.top = 'calc(' + el.style.top + ' - 14%)'; h.style.setProperty('--dx', ((i - 1) * 14) + 'px'); h.style.animationDelay = (i * 90) + 'ms'; R.els.props.appendChild(h); root.setTimeout(function (x) { return function () { x.remove(); }; }(h), 1600); }
  }
  function render() {
    var L = R.layout(); Array.prototype.slice.call(R.els.props.querySelectorAll('.villager')).forEach(function (el) { el.remove(); });
    if (!L || (R.visiting && R.visiting())) return;
    VILLAGERS.forEach(function (v) {
      if (v.scene !== L.id) return;
      var el = doc.createElement('button'); el.type = 'button'; el.className = 'nb villager'; el.dataset.id = v.id; el.setAttribute('aria-label', v.name + ', ' + v.role);
      el.style.left = v.spot.x + '%'; el.style.top = v.spot.y + '%'; el.style.width = v.spot.w + '%';
      el.innerHTML = '<img src="' + R.ART + v.img + '" alt=""><span class="vname">' + esc(v.name.split(' ')[0]) + '</span>';
      el.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); if (R.busy && R.busy()) return; if (R.walkTo) R.walkTo({ x: v.spot.x - 6, y: v.spot.y + 2, flip: false }, function () { if (R.layout() === L) openVillager(v.id); }); else openVillager(v.id); });
      R.els.props.appendChild(el);
    });
    if (root.OvuWalk && root.OvuWalk.sortDepth) root.OvuWalk.sortDepth();
  }
  R.on('boot', function () { render(); R.on('layout', render); R.on('props', function () { if (!R.els.props.querySelector('.villager')) render(); }); });
  V.openVillager = openVillager; V.render = render;
})(typeof window !== 'undefined' ? window : this);
