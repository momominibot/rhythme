/* Rhythme: the Today card's three tabs (Jamie, 21 Oct: "today check in should have 3 tabs today's, server chat once they
 * have joined the channel, inventory").
 *  - Today keeps the check-in exactly as it was (room.js draws it).
 *  - Channel is her plaza group's page. It opens once she has joined a group in the plaza; the group stays remembered on
 *    this device until she taps Leave, so the channel is there at home too, with an honest line that she is only counted
 *    while she stands in the plaza. It shows who is there, today's prompt from the noticeboard and Plaza friends, and
 *    (ovu-rooms.js, 22 Oct) every group with how many are there now and, in the plaza, its rooms and their chat.
 *  - Inventory lists what she owns, all read from this device's state: hearts, Dream Street things, pets and their drawer,
 *    outfits, the farm basket and shed, the greenhouse, the kitchen, the harbour book and the lane. Nothing here costs or
 *    earns hearts, and nothing is sent anywhere.
 * The models (channelModel, inventoryModel) are pure and tested in tools/test-core.js; the room part draws them. */
(function (root) {
  'use strict';
  /* the plaza groups by stage of life (docs/design/2026-10-22-plaza-rooms-and-live-channel.md); the live list from the
     server wins when it is known, these names cover the remembered group while she is away from the plaza */
  var GROUPS = { everyone: 'Everyone', pcos: 'PCOS and endometriosis', 'trying-to-conceive': 'Trying to conceive', 'after-a-loss': 'After a loss', 'new-mothers': 'New mothers', menopause: 'Perimenopause and menopause' };
  var ICONS = { everyone: 'groups', 'trying-to-conceive': 'favorite', pcos: 'water_drop', menopause: 'spa', 'after-a-loss': 'local_florist', 'new-mothers': 'crib' };
  var PANTRY = { egg: ['Egg', 'Eggs'], milk: ['Bottle of milk', 'Bottles of milk'], onsenegg: ['Onsen egg', 'Onsen eggs'] };
  /* every row carries a picture (Jamie, 22 Oct: "no words... category tab then picture of the inventory - fresh egg / hot
     spring cooked egg"): the room's own art where it exists, assets/room/inventory for the pantry, seeds and the shelf */
  var ART = 'assets/room/dream/', INV = 'assets/room/inventory/', FOOD = 'assets/food/';
  var PANTRY_PIC = { egg: INV + 'inv-egg.webp', milk: INV + 'inv-milk.webp', onsenegg: INV + 'inv-onsenegg.webp' };
  var TOOL_PIC = { shelf: INV + 'inv-shelf.webp', bigcan: ART + 'gh-can.webp' };
  function cropImg(k) { return FOOD + (k === 'sweetpotato' ? 'sweet-potato' : 'crop-' + k) + '.webp'; }
  function itemImg(it) { return it && it.img ? ART + it.img : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n0(v) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? n : 0; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function count(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function groupName(id, servers) {
    var s = (servers || []).filter(function (x) { return x && x.id === id; })[0];
    return s && s.name ? s.name : GROUPS[id] || cap(String(id || '').replace(/-/g, ' '));
  }
  function groupIcon(id) { return ICONS[id] || 'groups'; }
  /* she is counted in the group, so the count includes her */
  function hereText(n) { n = n0(n); return n <= 1 ? 'Just you here for now' : n + ' people here, with you'; }

  /* ---------- the channel ----------
   * ctx: signedIn; inPlaza; joined {id, name, people} while she is counted there; remembered (the group id this device
   * keeps for her account); servers [{id, name, people}]; offline; friends (the Plaza friends summary line); badge (new
   * asks and notes); prompt (today's noticeboard prompt). Returns what the tab shows and the buttons it offers. */
  function channelModel(ctx) {
    ctx = ctx || {};
    if (!ctx.signedIn) return { state: 'signedout', icon: 'groups', title: 'Your channel', text: 'Sign in from You, then join a group in the plaza. Each group has its own channel.', actions: [{ id: 'signin', label: 'Sign in from You', icon: 'person' }] };
    var id = ctx.joined && ctx.joined.id ? ctx.joined.id : ctx.remembered || null;
    if (!id) return { state: 'nogroup', icon: 'groups', title: 'Your channel', text: 'Join a group in the plaza to open its channel and its rooms. There is one for everyone, and groups by stage of life.', actions: [ctx.inPlaza ? { id: 'groups', label: 'Choose a group', icon: 'groups' } : { id: 'plaza', label: 'Walk to the plaza', icon: 'directions_walk' }] };
    var live = !!(ctx.joined && ctx.joined.id);
    var name = live && ctx.joined.name ? ctx.joined.name : groupName(id, ctx.servers);
    /* three states, named apart (Codex design review, 22 Oct): in the plaza now, or a saved group while she is away */
    var text = live ? (ctx.offline ? 'In the plaza · reconnecting to the group' : 'In the plaza · ' + hereText(ctx.joined.people)) : 'Saved group. You are counted, and can join its rooms, while you stand in the plaza.';
    var actions = [{ id: 'board', label: 'Open the board', icon: 'push_pin' }, { id: 'friends', label: 'Plaza friends', icon: 'diversity_1', badge: n0(ctx.badge) }];
    if (!live) actions.push({ id: 'plaza', label: 'Walk to the plaza', icon: 'directions_walk' });
    return { state: 'joined', id: id, live: live, icon: groupIcon(id), title: name, text: text, prompt: String(ctx.prompt || ''), friends: String(ctx.friends || ''), badge: n0(ctx.badge), actions: actions };
  }

  /* ---------- the inventory ----------
   * Everything comes in as plain data so the model never reads the store itself: hearts, earned; items (the shop list),
   * owned (ids), placed {id: true}, treats {treatId: n}, wear {petId: accessoryId}, petNames; homeId; farm (farmState),
   * crops, tools; herbs, herbSeeds {herb: n}, herbBeds {bedId: {herb}}; staples {id: n}, stapleNames; outfits, outfit;
   * book {species: {n}}, speciesNames, casts; floats {id: day}, float, floatNames; letters. */
  function inventoryModel(c) {
    c = c || {};
    var by = {}; (c.items || []).forEach(function (it) { if (it && it.id) by[it.id] = it; });
    var owned = (c.owned || []).filter(function (id) { return !!by[id]; }), placed = c.placed || {}, treats = c.treats || {}, wear = c.wear || {}, names = c.petNames || {};
    var mine = function (kind) { return owned.map(function (id) { return by[id]; }).filter(function (it) { return it.kind === kind; }); };
    var wornBy = {}; Object.keys(wear).forEach(function (p) { if (wear[p]) wornBy[wear[p]] = p; });
    var petName = function (id) { return names[id] || (by[id] ? by[id].name : id); };
    var things = mine('furniture').map(function (it) { return { name: it.name, sub: placed[it.id] ? 'In your room' : 'Put away', img: itemImg(it), icon: 'chair' }; })
      .concat(mine('home').map(function (it) { return { name: it.name, sub: c.homeId === it.id ? 'Where you live now' : 'Yours to visit', img: itemImg(it), icon: 'cottage' }; }));
    var pets = mine('pet').map(function (it) { var acc = wear[it.id] ? by[wear[it.id]] : null; return { name: petName(it.id), sub: (placed[it.id] ? 'At home' : 'Put away') + (acc ? ', wearing the ' + acc.name.toLowerCase() : ''), img: itemImg(it), icon: 'pets' }; })
      .concat(mine('accessory').map(function (it) { return { name: it.name, sub: wornBy[it.id] ? 'Worn by ' + petName(wornBy[it.id]) : 'In the drawer', img: itemImg(it), icon: 'diamond' }; }))
      .concat((c.items || []).filter(function (it) { return it && it.kind === 'treat' && n0(treats[it.id]); }).map(function (it) { return { name: it.name, count: n0(treats[it.id]), sub: 'left', img: itemImg(it), icon: 'cookie' }; }));
    /* each outfit she can wear, on its hanger (the boutique's rail pictures); a Plus drop she has not got stays out */
    var locked = c.locked || [], outfits = (c.outfits || []).filter(function (o) { return locked.indexOf(o.id) < 0; });
    var wardrobe = outfits.map(function (o) { return { name: o.name, sub: o.id === c.outfit ? 'Wearing now' : 'Yours to wear', img: 'assets/room/boutique/rail-' + o.id + '.webp', icon: 'checkroom' }; });
    var f = c.farm || {}, crops = c.crops || {}, herbs = c.herbs || {}, tools = c.tools || {};
    var basket = Object.keys(f.harvest || {}).filter(function (k) { return n0(f.harvest[k]) && (crops[k] || herbs[k]); })
      .map(function (k) { var d = crops[k] || herbs[k], n = n0(f.harvest[k]); return { name: n === 1 ? d.name : cap(d.plural || d.name), count: n, img: crops[k] ? cropImg(k) : ART + 'gh-' + k + '.webp' }; });
    var RN = root.OvuRanch, sz = RN && RN.viewSizes ? RN.viewSizes(f) : null; /* eggs and milk carry their size mix (small, medium, large follow the animal's love), trimmed to the pantry */
    function mix(k) { var m = sz && sz[k]; if (!m) return ''; var bits = ['large', 'medium', 'small'].filter(function (s) { return m[s] > 0; }).map(function (s) { return m[s] + ' ' + s; }); return bits.length ? ' (' + bits.join(', ') + ')' : ''; }
    var pantry = Object.keys(f.pantry || {}).filter(function (k) { return n0(f.pantry[k]) && PANTRY[k]; }).map(function (k) { var n = n0(f.pantry[k]); return { name: PANTRY[k][n === 1 ? 0 : 1] + mix(k), count: n, img: PANTRY_PIC[k] }; });
    var seeds = Object.keys(f.seeds || {}).filter(function (k) { return n0(f.seeds[k]) && crops[k]; }).map(function (k) { return { name: crops[k].name + ' seeds', count: n0(f.seeds[k]), img: INV + 'inv-seeds.webp', badge: cropImg(k) }; });
    var shed = Object.keys(f.tools || {}).filter(function (k) { return f.tools[k] && tools[k]; }).map(function (k) { return { name: tools[k].name, sub: 'In the shed', img: TOOL_PIC[k] || null, icon: tools[k].icon || 'handyman' }; });
    var farm = basket.concat(pantry, seeds, shed);
    var hs = c.herbSeeds || {}, hb = c.herbBeds || {}, growing = {};
    Object.keys(hb).forEach(function (b) { var h = hb[b] && hb[b].herb; if (h && herbs[h]) growing[h] = (growing[h] || 0) + 1; });
    var greenhouse = Object.keys(hs).filter(function (k) { return n0(hs[k]) && herbs[k]; }).map(function (k) { return { name: herbs[k].name + ' to plant', count: n0(hs[k]), img: ART + 'gh-' + k + '.webp' }; })
      .concat(Object.keys(growing).map(function (h) { return { name: herbs[h].name, sub: growing[h] === 1 ? 'Growing in a planter' : 'Growing in ' + growing[h] + ' planters', img: ART + 'gh-' + h + '.webp' }; }));
    var st = c.staples || {}, sn = c.stapleNames || {};
    var sp_ = c.staplePics || {};
    var kitchen = Object.keys(st).filter(function (k) { return n0(st[k]) && sn[k] && !sn[k].pantry; }).map(function (k) { return { name: sn[k].name, count: n0(st[k]), img: sp_[k] ? FOOD + sp_[k] + '.webp' : null, icon: 'skillet' }; });
    var dn = c.dishNames || {}, dishes = Object.keys(f.dishes || {}).filter(function (k) { return n0(f.dishes[k]) && dn[k]; }).map(function (k) { return { name: dn[k], count: n0(f.dishes[k]), img: 'assets/food/dish-' + k + '.webp' }; });
    var book = c.book || {}, sp = c.speciesNames || {};
    var harbour = Object.keys(book).filter(function (k) { return book[k] && n0(book[k].n) && sp[k]; }).map(function (k) { return { name: sp[k].name, count: n0(book[k].n), sub: 'met', img: sp[k].img ? ART + sp[k].img : null, icon: 'set_meal' }; });
    if (harbour.length && n0(c.casts)) harbour.push({ name: count(n0(c.casts), 'cast', 'casts'), sub: 'so far', icon: 'phishing' });
    var fl = c.floats || {}, fn = c.floatNames || {};
    var lane = Object.keys(fl).filter(function (k) { return fl[k] && fn[k]; }).map(function (k) { return { name: fn[k].name + ' float', sub: c.float === k ? 'On the line' : 'Yours', img: INV + 'inv-float.webp', tint: fn[k].top || null }; });
    var letters = n0((c.letters || []).length); if (letters) lane.push({ name: count(letters, 'letter', 'letters'), sub: 'waiting at the post box', icon: 'mail' });
    var sections = [
      { id: 'things', tab: 'Things', icon: 'chair', title: 'Dream Street things', rows: things, empty: 'Nothing bought yet. Hearts from your check-ins buy lamps, seats and homes on Dream Street.', go: { id: 'shop', label: 'Dream Street' } },
      { id: 'pets', tab: 'Pets', icon: 'pets', title: 'Pets and their drawer', rows: pets, empty: 'No pet yet. The pet shop on Dream Street has kittens and puppies.', go: { id: 'petshop', label: 'Pet shop' } },
      { id: 'wardrobe', tab: 'Wardrobe', icon: 'checkroom', title: 'Wardrobe', rows: wardrobe, empty: 'Your outfits live in the wardrobe.', go: { id: 'wardrobe', label: 'Wardrobe' } },
      { id: 'farm', tab: 'Farm', icon: 'agriculture', title: 'Farm basket and shed', rows: farm, empty: 'The basket is empty. The shed gives seeds every day.', go: { id: 'basket', label: 'Basket' } },
      { id: 'greenhouse', tab: 'Greenhouse', icon: 'potted_plant', title: 'Greenhouse', rows: greenhouse, empty: 'Nothing planted yet. The greenhouse gives a free start.' },
      { id: 'dishes', tab: 'Dishes', icon: 'restaurant', title: 'Dishes in your bag', rows: dishes, empty: 'No dishes yet. Cook in a kitchen and they stay here to share.', go: { id: 'kitchen', label: 'Kitchen' } },
      { id: 'kitchen', tab: 'Kitchen', icon: 'skillet', title: 'Kitchen staples', rows: kitchen, empty: 'No staples yet. The grocer on the lane sells rice, noodles, tofu and more.', go: { id: 'kitchen', label: 'Kitchen' } },
      { id: 'harbour', tab: 'Harbour', icon: 'sailing', title: 'Harbour and lane', rows: harbour.concat(lane), empty: 'No fish met yet. The harbour is past the lane.' }
    ];
    return { hearts: n0(c.hearts), earned: n0(c.earned), sections: sections, total: sections.reduce(function (a, s) { return a + s.rows.length; }, 0) };
  }

  var T = { GROUPS: GROUPS, ICONS: ICONS, groupName: groupName, groupIcon: groupIcon, hereText: hereText, channelModel: channelModel, inventoryModel: inventoryModel, esc: esc };
  root.OvuToday = T;

  /* ---------- the room ---------- */
  var R = root.OvuRoom, S = root.OvuStore, doc = root.document;
  if (!R || !S || !doc || !doc.createElement) return;
  var tab = 'today', timer = 0;
  function $(s) { return doc.querySelector(s); }
  function els() { return { tabs: $('#deckTabs'), today: $('#deckToday'), channel: $('#deckChannel'), inventory: $('#deckInventory'), badge: $('#deckChBadge') }; }
  function session() { var A = root.OvuAuth, s = A && A.session ? A.session() : null; return s && s.user ? s.user : null; }
  function inPlaza() { var L = R.layout && R.layout(); return !!(L && L.id === 'plaza'); }
  function friendsState() { var F = root.OvuFriends; try { return F && F.state ? F.state() : null; } catch (e) { return null; } }
  function badgeCount() { var F = root.OvuFriends, fs = friendsState(); try { return F && fs ? n0(F.badgeCount(fs.inbox)) : 0; } catch (e) { return 0; } }
  function channelCtx() {
    var P = root.OvuPlaza, F = root.OvuFriends, C = root.OvuCommunity, u = session();
    var ps = P && P.state ? P.state() : { signedIn: !!u, joined: null, servers: null, offline: false };
    var rem = S.state().plaza, fs = friendsState();
    var X = root.OvuRooms, xs = X && X.state ? X.state() : null; /* away from the plaza, the rooms module's group list names the saved group */
    return { signedIn: !!u, inPlaza: inPlaza(), joined: ps.joined, remembered: rem && rem.server && u && rem.uid === u.id ? rem.server : null, servers: ps.servers || (xs && xs.groups) || null, offline: ps.offline,
      friends: F && F.summary ? F.summary(fs || { signedIn: !!u }) : '', badge: badgeCount(), prompt: C && C.promptFor ? C.promptFor(S.today()) : '' };
  }
  function inventoryCtx() {
    var RW = root.OvuRewards, PT = root.OvuPets, FM = root.OvuFarm, GH = root.OvuGreenhouse, K = root.OvuKitchen, HB = root.OvuHarbour, LN = root.OvuLane;
    var l = RW ? RW.ledger() : {}, farm = FM && FM.farmState ? FM.farmState(S) : {}, g = GH && GH.herbState ? GH.herbState(S) : {};
    var hb = HB && HB.harbourState ? HB.harbourState(S) : {}, ln = LN && LN.laneState ? LN.laneState(S) : {}, species = {}, floats = {};
    ((HB && HB.SPECIES) || []).forEach(function (s) { species[s.id] = s; }); ((LN && LN.FLOATS) || []).forEach(function (f) { floats[f.id] = f; });
    return { hearts: l.hearts, earned: l.earned, items: RW ? RW.SHOP : [], owned: l.owned || [], placed: l.placed || {}, treats: l.treats || {}, wear: l.wear || {}, petNames: PT ? PT.NAMES : {}, homeId: R.homeId ? R.homeId() : null,
      farm: farm, crops: FM ? FM.CROPS : {}, tools: FM ? FM.TOOLS : {}, herbs: GH ? GH.HERBS : {}, herbSeeds: g.seeds || {}, herbBeds: g.beds || {}, staples: K && K.staplesOf ? K.staplesOf(S) : {}, stapleNames: K ? K.STAPLES : {}, dishNames: K && K.RECIPES ? K.RECIPES.reduce(function (o, r) { o[r.id] = r.name; return o; }, {}) : {},
      outfits: R.OUTFITS || [], locked: (R.OUTFITS || []).filter(function (o) { return R.outfitLocked && R.outfitLocked(o.id); }).map(function (o) { return o.id; }), staplePics: (K && K.STAPLE_PIC) || {}, outfit: S.profile().outfit || 'base', book: hb.book || {}, speciesNames: species, casts: hb.casts, floats: ln.floats || {}, float: ln.float, floatNames: floats, letters: ln.letters || [] };
  }
  /* which buttons can do something here: a missing module hides its button rather than showing one that does nothing */
  var OPENERS = {
    signin: function () { var a = doc.querySelector('nav a[data-tab="you"]'); if (a) a.click(); },
    plaza: function () { if (root.OvuWalk && root.OvuWalk.travel) root.OvuWalk.travel('plaza'); },
    groups: function () { if (root.OvuPlaza && root.OvuPlaza.open) root.OvuPlaza.open(); },
    board: function () { if (root.OvuCommunity && root.OvuCommunity.openBoard) root.OvuCommunity.openBoard(); },
    friends: function () { if (root.OvuFriends && root.OvuFriends.open) root.OvuFriends.open(); },
    shop: function () { if (R.openShop) R.openShop('street'); },
    petshop: function () { if (R.openShop) R.openShop('pet'); },
    wardrobe: function () { if (R.openWardrobe) R.openWardrobe(); },
    basket: function () { if (root.OvuFarm && root.OvuFarm.openBasket) root.OvuFarm.openBasket(); },
    kitchen: function () { if (root.OvuKitchen && root.OvuKitchen.openKitchen) root.OvuKitchen.openKitchen(); }
  };
  function can(id) {
    if (id === 'board') return !!(root.OvuCommunity && root.OvuCommunity.openBoard);
    if (id === 'friends') return !!(root.OvuFriends && root.OvuFriends.open);
    if (id === 'groups') return !!(root.OvuPlaza && root.OvuPlaza.open);
    if (id === 'plaza') return !!(root.OvuWalk && root.OvuWalk.travel);
    if (id === 'basket') return !!(root.OvuFarm && root.OvuFarm.openBasket);
    if (id === 'kitchen') return !!(root.OvuKitchen && root.OvuKitchen.openKitchen);
    return !!OPENERS[id];
  }
  function button(a, primary) {
    return '<button type="button" class="btn ' + (primary ? 'primary' : 'soft') + '" data-today="' + esc(a.id) + '"><span class="ms" aria-hidden="true">' + esc(a.icon) + '</span>' + esc(a.label) + (a.badge ? ' <span class="chbadge" aria-label="' + a.badge + ' new">' + a.badge + '</span>' : '') + '</button>';
  }
  /* what the note under the channel says: the rooms' own words once they exist on the server, the old line until then */
  function noteText() {
    var X = root.OvuRooms, on = !!(X && X.available && X.available());
    return on ? 'Rooms are peer support, not medical advice. Nothing you write here reaches your diary. Rhythme staff see counts, cards, reports and messages held for a check, never your diary.'
      : 'Typed chat is not open yet. Friends send kind notes from a set list, and nothing you write here travels anywhere. Rhythme staff see counts, cards and reports, never your diary.';
  }
  /* the pane is built once: the rooms module owns #chGroups and #chRooms (ovu-rooms.js), so the box she types in is never
     replaced by a redraw of the rest; only the head and the foot are drawn from the model */
  function renderChannel(el) {
    var m = channelModel(channelCtx());
    if (!el.querySelector('.chmain')) {
      el.innerHTML = '<h2>Channel</h2><div id="chGroups" class="chgroups" hidden></div><div class="chmain"></div><div id="chRooms" class="chrooms" hidden></div><div class="chfoot"></div>';
    }
    el.querySelector('.chmain').innerHTML = '<div class="chhead"><span class="ms" aria-hidden="true">' + esc(m.icon) + '</span><div><b>' + esc(m.title) + '</b><small>' + esc(m.text) + '</small></div></div>';
    var h = '';
    if (m.state === 'joined') {
      h += '<div class="chprompt"><span class="lbl">Today’s prompt on the noticeboard</span><p>' + esc(m.prompt) + '</p></div>';
      h += '<div class="chfriends"><span class="ms" aria-hidden="true">diversity_1</span><div><b>Plaza friends</b><small>' + esc(m.friends) + '</small></div></div>';
      h += '<p class="note chnote">' + esc(noteText()) + '</p>';
    }
    var acts = m.actions.filter(function (a) { return can(a.id); });
    h += acts.length ? '<div class="row chrow">' + acts.map(function (a, i) { return button(a, i === 0); }).join('') + '</div>' : '';
    el.querySelector('.chfoot').innerHTML = h;
    if (root.OvuRooms && root.OvuRooms.attach && session()) root.OvuRooms.attach(el.querySelector('#chGroups'), el.querySelector('#chRooms'));
    else { el.querySelector('#chGroups').hidden = true; el.querySelector('#chRooms').hidden = true; }
  }
  /* the inventory: her hearts, a row of category tabs, and the chosen category as pictures with counts (Jamie, 22 Oct) */
  var invTab = null;
  function pic(r) {
    var tint = /^#[0-9a-f]{3,8}$/i.test(r.tint || '') ? r.tint : null;
    var face = r.img ? '<img src="' + esc(r.img) + '" alt="" loading="lazy">' : '<span class="ms invicon" aria-hidden="true">' + esc(r.icon || 'inventory_2') + '</span>';
    return '<span class="invface"' + (tint ? ' style="--tint:' + tint + '"' : '') + '>' + face + (r.badge ? '<img class="invbadge" src="' + esc(r.badge) + '" alt="">' : '') + (tint ? '<i class="invtint" aria-hidden="true"></i>' : '') + '</span>';
  }
  function renderInventory(el) {
    var m = inventoryModel(inventoryCtx()), oldBar = el.querySelector('.invtabs'), keepX = oldBar ? oldBar.scrollLeft : 0; /* a redraw keeps the tab strip where she scrolled it */
    var first = m.sections.filter(function (s) { return s.rows.length; })[0];
    if (!invTab || !m.sections.some(function (s) { return s.id === invTab; })) invTab = first ? first.id : m.sections[0].id;
    var cur = m.sections.filter(function (s) { return s.id === invTab; })[0];
    var h = '<h2>Inventory</h2><div class="invhearts"><span class="ms" aria-hidden="true">favorite</span><div><b>' + m.hearts + ' hearts</b><small>' + (m.earned ? m.earned + ' earned in all' : 'Daily check-ins earn hearts') + '</small></div>' + (can('shop') ? '<button type="button" class="btn soft" data-today="shop"><span class="ms" aria-hidden="true">storefront</span>Dream Street</button>' : '') + '</div>';
    h += '<div class="invtabs" role="toolbar" aria-label="Inventory categories">' + m.sections.map(function (s) {
      return '<button type="button" class="invtab' + (s.id === invTab ? ' on' : '') + '" data-invtab="' + esc(s.id) + '" aria-pressed="' + (s.id === invTab) + '" aria-label="' + esc(s.title) + ', ' + s.rows.length + '"><span class="ms" aria-hidden="true">' + esc(s.icon) + '</span><b>' + esc(s.tab) + '</b>' + (s.rows.length ? '<i>' + s.rows.length + '</i>' : '') + '</button>';
    }).join('') + '</div>';
    h += '<section class="invsec" aria-label="' + esc(cur.title) + '">';
    h += cur.rows.length ? '<ul class="invgrid">' + cur.rows.map(function (r) {
      var said = r.name + (r.count ? ', ' + r.count : '') + (r.sub ? ', ' + r.sub : '');
      return '<li class="invtile' + (r.sub === 'Wearing now' || r.sub === 'On the line' || r.sub === 'Where you live now' ? ' on' : '') + '" aria-label="' + esc(said) + '" title="' + esc(said) + '">' + pic(r) + (r.count ? '<i class="invcount" aria-hidden="true">' + r.count + '</i>' : '') + '<b aria-hidden="true">' + esc(r.name) + '</b></li>';
    }).join('') + '</ul>' : '<p class="help">' + esc(cur.empty) + '</p>';
    if (cur.go && can(cur.go.id)) h += '<button type="button" class="invgo" data-today="' + esc(cur.go.id) + '">' + esc(cur.go.label) + '<span class="ms" aria-hidden="true">chevron_right</span></button>';
    h += '</section>';
    el.innerHTML = h;
    var tb = el.querySelector('.invtabs');
    if (tb) {
      tb.scrollLeft = keepX;
      var sel = tb.querySelector('.invtab.on'); if (sel) { var l = sel.offsetLeft, r = l + sel.offsetWidth; if (l < tb.scrollLeft || r > tb.scrollLeft + tb.clientWidth) tb.scrollLeft = Math.max(0, l - (tb.clientWidth - sel.offsetWidth) / 2); } /* the chosen tab is always in view (Codex, 22 Oct) */
      tb.addEventListener('click', function (e) { var b = e.target.closest('[data-invtab]'); if (!b) return; invTab = b.dataset.invtab; renderInventory(el); var nb = el.querySelector('[data-invtab="' + invTab + '"]'); if (nb) { try { nb.focus({ preventScroll: true }); } catch (x) { } } });
    }
  }
  function render() {
    var e = els(); if (!e.tabs) return;
    var b = badgeCount(); if (e.badge) { e.badge.hidden = !b; e.badge.textContent = b ? String(b) : ''; }
    if (tab === 'channel' && e.channel) renderChannel(e.channel); else if (tab === 'inventory' && e.inventory) renderInventory(e.inventory);
  }
  function show(id) {
    if (!/^(today|channel|inventory)$/.test(id)) id = 'today';
    tab = id; var e = els(); if (!e.tabs) return;
    e.tabs.querySelectorAll('[data-deck]').forEach(function (b) { var on = b.dataset.deck === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    if (e.today) e.today.hidden = id !== 'today'; if (e.channel) e.channel.hidden = id !== 'channel'; if (e.inventory) e.inventory.hidden = id !== 'inventory';
    render();
  }
  function schedule() { root.clearTimeout(timer); timer = root.setTimeout(render, 150); }
  function mount() {
    var e = els(); if (!e.tabs) return;
    e.tabs.addEventListener('click', function (ev) { var b = ev.target.closest('[data-deck]'); if (!b) return; if (R.chime) R.chime('tap'); show(b.dataset.deck); });
    e.tabs.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight' && ev.key !== 'Home' && ev.key !== 'End') return;
      var order = ['today', 'channel', 'inventory'], i = order.indexOf(tab), n = ev.key === 'Home' ? 0 : ev.key === 'End' ? order.length - 1 : (i + (ev.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length;
      ev.preventDefault(); show(order[n]); var nb = e.tabs.querySelector('[data-deck="' + order[n] + '"]'); if (nb) nb.focus();
    });
    [e.channel, e.inventory].forEach(function (pane) {
      if (!pane) return;
      pane.addEventListener('click', function (ev) { var b = ev.target.closest('[data-today]'); if (!b) return; var f = OPENERS[b.dataset.today]; if (!f) return; if (R.chime) R.chime('tap'); try { f(); } catch (err) { if (R.toast) R.toast('That could not open just now.', 'info'); } });
    });
    S.subscribe(schedule);
    R.on('layout', schedule);
    if (root.OvuPlaza && root.OvuPlaza.onChange) root.OvuPlaza.onChange(schedule);
    if (root.OvuAuth && root.OvuAuth.subscribe) root.OvuAuth.subscribe(schedule);
    render();
  }
  R.on('boot', mount);
  T.show = show; T.render = render; T.tab = function () { return tab; }; T.channelCtx = channelCtx; T.inventoryCtx = inventoryCtx;
  T.noteRooms = function () { var n = doc.querySelector('#deckChannel .chnote'); if (n) n.textContent = noteText(); };
})(typeof window !== 'undefined' ? window : this);
