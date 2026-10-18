/* Rhythme store interiors: the pet shop, the furniture store and the property showroom on Dream Street are
 * walkable rooms. The catalogue items from ovu-rewards.js stand on the shelves, beds, platforms and pedestals as
 * tappable props; tapping one walks the avatar over and opens a small card whose buttons go through the room's
 * own shopAct (the same buy, place, visit and move-in code the store sheet uses). The sheet (openShop) stays as the
 * inventory view and as the fallback. Pets you own and have at home sit on the pet shop rug, visiting.
 * Pure data first (testable in node), then the scene wiring, which mounts on OvuRoom boot. */
(function (root) {
  'use strict';
  var OFF = { x: -50, y: -50 }, NOWIN = { x: -50, y: -50, rx: 0, ry: 0 }, NOSLEEP = { x: -50, y: -50, w: 1, rot: 0 };
  /* rendered 18 Oct 2026 (Seedream 5.0 pro, seeds 7311 to 7313): positions read off a 5% grid.
   * spots: where catalogue items of each kind stand, in catalogue order; each has a stand point (wp) for the avatar. */
  var PET = {
    id: 'shop-pet', scene: 'street', store: 'pet', name: 'Pet shop', img: 'shop-pet-int-v1.webp', w: 1472, h: 1840, avatarW: 12, only: ['pet'],
    hotspots: [{ id: 'mat', x: 50, y: 77, label: 'Door mat · back to the street', icon: 'door_open', wp: { x: 46, y: 75, flip: false } }],
    home: { x: 46, y: 75, flip: false },
    zones: [[[47, 44], [86, 58], [50, 80], [10, 63]]],
    solids: [{ id: 'beds', x0: 8, x1: 50, y0: 42, y1: 60 }, { id: 'shelf', x0: 54, x1: 71, y0: 40, y1: 60 }, { id: 'shelf2', x0: 74, x1: 90, y0: 48, y1: 65 }, { id: 'counter', x0: 22, x1: 38, y0: 58, y1: 70 }],
    doors: [{ id: 'mat', to: 'street', x: 46, y: 75, r: 4, flip: false }],
    spots: {
      pet: [{ x: 19, y: 56, w: 8, wp: { x: 40, y: 67, flip: true } }, { x: 30, y: 51, w: 8, wp: { x: 40, y: 65, flip: true } }, { x: 42, y: 46, w: 8, wp: { x: 46, y: 62, flip: true } }, { x: 56, y: 64, w: 8, wp: { x: 52, y: 71, flip: false } }, { x: 63, y: 69.5, w: 8, wp: { x: 58, y: 74, flip: false } }, { x: 67, y: 60.5, w: 8, wp: { x: 62, y: 68, flip: false } }],
      treat: [{ x: 58, y: 45, w: 5, wp: { x: 60, y: 64, flip: false } }, { x: 65, y: 47, w: 5, wp: { x: 60, y: 64, flip: false } }, { x: 61, y: 52, w: 5, wp: { x: 60, y: 64, flip: false } }, { x: 67, y: 54, w: 5, wp: { x: 60, y: 64, flip: false } }],
      accessory: [{ x: 78, y: 56.5, w: 4.6, wp: { x: 72, y: 64, flip: false } }, { x: 84, y: 58, w: 4.6, wp: { x: 72, y: 64, flip: false } }, { x: 79, y: 63.5, w: 4.6, wp: { x: 72, y: 64, flip: false } }, { x: 85.5, y: 65, w: 4.6, wp: { x: 72, y: 64, flip: false } }]
    },
    meditator: { x: 50, y: 70, w: 11 }, aura: { x: 50, y: 68, w: 17 }, holo: { x: 60, y: 68, w: 14 }, sleeper: NOSLEEP, zzz: OFF, window: NOWIN,
    props: { cat: { x: 30, y: 71, w: 9 }, dog: { x: 56, y: 74, w: 9.5 }, mewmew: { x: 36, y: 72, w: 12 } }
  };
  var FURNITURE = {
    id: 'shop-furniture', scene: 'street', store: 'furniture', name: 'Furniture store', img: 'shop-furniture-int-v1.webp', w: 1248, h: 1560, avatarW: 12, only: [],
    hotspots: [{ id: 'mat', x: 50, y: 75, label: 'Door mat · back to the street', icon: 'door_open', wp: { x: 50, y: 72, flip: false } }],
    home: { x: 50, y: 72, flip: false },
    zones: [[[49, 44], [88, 57], [50, 78], [11, 60]]],
    solids: [{ id: 'platform', x0: 14, x1: 48, y0: 44, y1: 60 }, { id: 'platform2', x0: 50, x1: 76, y0: 46, y1: 58 }, { id: 'stool', x0: 68, x1: 80, y0: 58, y1: 66 }, { id: 'counter', x0: 24, x1: 40, y0: 58, y1: 70 }],
    doors: [{ id: 'mat', to: 'street', x: 50, y: 72, r: 4, flip: false }],
    /* catalogue order: plant, bookshelf, lamp, mushlamp (cream platform), starlamp, beanbag, armchair (lilac platform), scale (the stool) */
    spots: { furniture: [{ x: 18, y: 55.5, w: 7, wp: { x: 20, y: 63, flip: true } }, { x: 26, y: 52.5, w: 7, wp: { x: 44, y: 63, flip: true } }, { x: 34, y: 49.5, w: 5.5, wp: { x: 44, y: 63, flip: true } }, { x: 41, y: 47, w: 5.8, wp: { x: 44, y: 63, flip: true } }, { x: 56, y: 53.5, w: 5, wp: { x: 56, y: 62, flip: false } }, { x: 64, y: 52.5, w: 8, wp: { x: 64, y: 62, flip: false } }, { x: 72, y: 51.5, w: 8.5, wp: { x: 66, y: 64, flip: false } }, { x: 73, y: 60.5, w: 6, wp: { x: 66, y: 68, flip: false } }] },
    meditator: { x: 50, y: 68, w: 11 }, aura: { x: 50, y: 66, w: 17 }, holo: { x: 60, y: 66, w: 14 }, sleeper: NOSLEEP, zzz: OFF, window: NOWIN,
    props: {}
  };
  var HOMES = {
    id: 'shop-homes', scene: 'street', store: 'home', name: 'Property showroom', img: 'shop-homes-int-v1.webp', w: 1472, h: 1840, avatarW: 12, only: [],
    hotspots: [{ id: 'mat', x: 36, y: 75, label: 'Door mat · back to the street', icon: 'door_open', wp: { x: 44, y: 75, flip: false } }],
    home: { x: 44, y: 75, flip: false },
    zones: [[[47, 42], [88, 58], [50, 78], [10, 62]]],
    solids: [{ id: 'bench', x0: 12, x1: 33, y0: 52, y1: 66 }, { id: 'stand', x0: 36, x1: 48, y0: 56, y1: 66 }, { id: 'stand', x0: 47, x1: 59, y0: 58, y1: 69 }, { id: 'stand', x0: 57, x1: 69, y0: 62, y1: 71 }, { id: 'desk', x0: 68, x1: 88, y0: 54, y1: 66 }, { id: 'plant', x0: 44, x1: 54, y0: 48, y1: 56 }],
    doors: [{ id: 'mat', to: 'street', x: 44, y: 75, r: 4, flip: false }],
    spots: { home: [{ x: 42, y: 57, w: 9, wp: { x: 34, y: 70, flip: true } }, { x: 53, y: 59.5, w: 9, wp: { x: 52, y: 74, flip: false } }, { x: 63, y: 63.5, w: 9, wp: { x: 60, y: 72, flip: false } }] },
    meditator: { x: 22, y: 60, w: 11 }, aura: { x: 22, y: 58, w: 17 }, holo: { x: 32, y: 58, w: 14 }, sleeper: NOSLEEP, zzz: OFF, window: NOWIN,
    props: {}
  };
  var LAYOUTS = { 'shop-pet': PET, 'shop-furniture': FURNITURE, 'shop-homes': HOMES };
  /* which catalogue kinds stand in which store */
  var KINDS = { 'shop-pet': ['pet', 'treat', 'accessory'], 'shop-furniture': ['furniture'], 'shop-homes': ['home'] };
  /* the model sprites that stand for the houses on the showroom pedestals (the shop thumbnails are opaque cards) */
  var MODELS = { house: 'model-house.webp', bathhouse: 'model-bathhouse.webp', familyhome: 'model-familyhome.webp' };
  /* items of one store with the spot each gets, in catalogue order; items beyond the spots stay in the sheet only */
  function placements(layoutId, SHOP) {
    var L = LAYOUTS[layoutId], out = []; if (!L) return out;
    (KINDS[layoutId] || []).forEach(function (kind) {
      var spots = (L.spots || {})[kind] || [], n = 0;
      SHOP.forEach(function (it) { if (it.kind !== kind || !spots[n]) return; out.push({ item: it, spot: spots[n], kind: kind }); n++; });
    });
    return out;
  }
  var SH = { LAYOUTS: LAYOUTS, KINDS: KINDS, MODELS: MODELS, placements: placements };
  root.OvuShops = SH;

  /* ---------- the scenes ---------- */
  var R = root.OvuRoom; if (!R || !root.document || !root.document.createElement) return;
  var S = root.OvuStore, RW = root.OvuRewards, doc = root.document, ART = R.ART;
  Object.keys(LAYOUTS).forEach(function (id) { R.LAYOUTS[id] = LAYOUTS[id]; });
  function esc(s) { return R.esc(s); }
  function inStore(L) { return !!(L && LAYOUTS[L.id]); }
  function ledger() { var l = RW.ledger(); if (RW.tester && RW.tester()) l = Object.assign({}, l, { hearts: 999999 }); return l; }
  function spriteFor(it) { return it.kind === 'home' ? (MODELS[it.id] || it.img) : it.img; }
  /* what the card and the tag should say for an item right now */
  function status(it, l) {
    var owned = l.owned.indexOf(it.id) > -1, placed = !!l.placed[it.id], home = R.homeId();
    if (it.kind === 'treat') { var have = (l.treats || {})[it.id] || 0; return { tag: have ? have + ' left' : it.cost + ' ♥', owned: false, have: have }; }
    if (it.kind === 'accessory') { var by = Object.keys(l.wear || {}).filter(function (p) { return l.wear[p] === it.id; })[0]; return { tag: owned ? (by ? 'Worn' : 'Yours') : it.cost + ' ♥', owned: owned, by: by }; }
    if (it.kind === 'home') return { tag: owned ? (home === it.id ? 'Your home' : 'Yours') : it.cost + ' ♥', owned: owned, current: home === it.id };
    if (it.kind === 'pet') return { tag: owned ? (placed ? 'At home' : 'Yours') : it.cost + ' ♥', owned: owned, placed: placed };
    return { tag: owned ? (placed ? 'Placed' : 'Yours') : it.cost + ' ♥', owned: owned, placed: placed };
  }
  /* props on the shelves: display-only nodes (class .nb keeps them out of the room's pet handling), tappable */
  function renderStore(L) {
    if (!inStore(L)) return; var wrap = R.els.props, l = ledger();
    Array.prototype.slice.call(wrap.querySelectorAll('.shopprop')).forEach(function (el) { el.remove(); });
    placements(L.id, RW.SHOP).forEach(function (p) {
      var it = p.item, st = status(it, l);
      if (it.kind === 'pet' && st.owned && st.placed) return; /* she is on the rug already, visiting */
      var d = doc.createElement('div'); d.className = 'nb shopprop kind-' + it.kind + (st.owned ? ' owned' : ''); d.dataset.id = 'shop-' + it.id; d.dataset.item = it.id;
      d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0'); d.setAttribute('aria-label', it.name + ', ' + st.tag + '. Tap for details.');
      d.style.left = p.spot.x + '%'; d.style.top = p.spot.y + '%'; d.style.width = p.spot.w + '%';
      d.innerHTML = '<img src="' + ART + spriteFor(it) + '" alt=""><span class="shoptag' + (st.owned || st.have ? ' mine' : '') + '">' + esc(st.tag) + '</span>';
      wrap.appendChild(d);
    });
  }
  function openCard(itemId) {
    var it = RW.item(itemId); if (!it) return; var l = ledger(), st = status(it, l), can = l.hearts >= it.cost, btns = '', note = '';
    if (it.kind === 'pet') btns = st.owned ? (st.placed ? '<button type="button" class="btn soft" data-act="toggle"><span class="ms">inventory_2</span>Put away for now</button>' : '<button type="button" class="btn primary" data-act="toggle"><span class="ms">home</span>Bring her home</button>') : '<button type="button" class="btn primary" data-act="buy"' + (can ? '' : ' disabled') + '><span class="ms">favorite</span>Adopt · ' + it.cost + ' ♥</button>';
    else if (it.kind === 'treat') { btns = '<button type="button" class="btn primary" data-act="buy"' + (can ? '' : ' disabled') + '><span class="ms">cookie</span>Buy a pack · ' + it.cost + ' ♥</button>'; note = (st.have ? st.have + ' in your cupboard. ' : '') + 'A pack holds ' + (it.qty || 1) + '. Give one from a pet’s care bubble at home.'; }
    else if (it.kind === 'accessory') { btns = st.owned ? '<span class="ownchip">' + (st.by ? 'Worn by ' + esc((root.OvuPets && root.OvuPets.NAMES[st.by]) || st.by) : 'In your drawer') + '</span>' : '<button type="button" class="btn primary" data-act="buy"' + (can ? '' : ' disabled') + '><span class="ms">checkroom</span>Buy · ' + it.cost + ' ♥</button>'; note = 'Dress a pet from its care bubble at home. One pet wears it at a time.'; }
    else if (it.kind === 'home') btns = st.owned ? (st.current ? '<button type="button" class="btn soft" data-act="home" data-to="room">Back to my room</button>' : '<button type="button" class="btn primary" data-act="home" data-to="' + it.id + '"><span class="ms">home</span>Move in</button>') : '<button type="button" class="btn primary" data-act="buy"' + (can ? '' : ' disabled') + '><span class="ms">cottage</span>Move in · ' + it.cost + ' ♥</button><button type="button" class="btn ghost" data-act="visit"><span class="ms">visibility</span>Visit first</button>';
    else { var slotBusy = it.slot && !st.placed && RW.SHOP.some(function (o) { return o.slot === it.slot && o.id !== it.id && l.placed[o.id]; }); btns = st.owned ? '<button type="button" class="btn soft" data-act="toggle"><span class="ms">' + (st.placed ? 'inventory_2' : 'chair') + '</span>' + (st.placed ? 'Put away' : (slotBusy ? 'Swap in' : 'Place at home')) + '</button>' : '<button type="button" class="btn primary" data-act="buy"' + (can ? '' : ' disabled') + '><span class="ms">favorite</span>Buy · ' + it.cost + ' ♥</button>'; if (it.slot && RW.SLOTS) note = RW.SLOTS[it.slot] + '. Pieces that share a spot swap with each other.'; }
    if (!can && !st.owned && it.kind !== 'accessory') note = (note ? note + ' ' : '') + 'You need ' + (it.cost - l.hearts) + ' more hearts; logging earns them.';
    R.openSheet('shopcard', it.name, { pet: 'Pet shop', treat: 'Treats shelf', accessory: 'Accessories shelf', home: 'Property showroom', furniture: 'Furniture store' }[it.kind] || 'Dream Street', { pet: 'pets', treat: 'cookie', accessory: 'checkroom', home: 'cottage' }[it.kind] || 'chair',
      '<div class="itemcard"><img src="' + ART + spriteFor(it) + '" alt=""><div><p>' + esc(it.note || '') + '</p><small><span class="ms fill">favorite</span>' + it.cost + ' · you have ' + (RW.tester && RW.tester() ? '∞' : l.hearts) + '</small></div></div>' +
      '<div class="row">' + btns + '</div>' + (note ? '<p class="help">' + esc(note) + '</p>' : '') +
      '<div class="row"><button type="button" class="btn ghost" data-act="sheet"><span class="ms">list</span>See the whole shelf</button></div><div class="msg" id="cardMsg"></div>');
    doc.getElementById('sheetBody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return; var act = b.dataset.act;
      try {
        if (act === 'sheet') { R.openShop(it.kind === 'treat' || it.kind === 'accessory' ? 'pet' : it.kind); return; }
        if (act === 'buy') { R.shopAct('buy', it.id, { go: function (lid, asVisit) { root.OvuWalk.travel(lid, { visit: asVisit }); } }); if (it.kind !== 'home') { R.hideSheet(); renderStore(R.layout()); } return; }
        if (act === 'toggle') { R.shopAct('toggle', it.id); R.hideSheet(); renderStore(R.layout()); return; }
        if (act === 'visit') { R.shopAct('visit', it.id, { go: function (lid, asVisit) { root.OvuWalk.travel(lid, { visit: asVisit }); } }); return; }
        if (act === 'home') { R.hideSheet(); R.shopAct('home', b.dataset.to, { go: function (lid, asVisit) { root.OvuWalk.travel(lid, { visit: asVisit }); } }); }
      } catch (err) { var m = doc.getElementById('cardMsg'); if (m) { m.textContent = err.message; m.className = 'msg on err'; } }
    });
  }
  /* tap a prop: walk over, then the card */
  function tapProp(el) {
    var id = el.dataset.item, L = R.layout(), p = placements(L.id, RW.SHOP).filter(function (x) { return x.item.id === id; })[0];
    if (!p) return; R.chime('tap'); R.cancelIdle(); if (root.OvuWalk.walking()) root.OvuWalk.stop();
    L.home.x = p.spot.wp.x; L.home.y = p.spot.wp.y; L.home.flip = !!p.spot.wp.flip; /* after the card she stays by the shelf */
    R.walkTo(p.spot.wp, function () { if (!R.busy()) openCard(id); });
  }
  R.hotspotHandlers.mat = function (id, L) { if (!inStore(L)) return false; root.OvuWalk.travel('street'); return true; };
  R.on('boot', function () {
    R.on('props', function (L) { renderStore(L); });
    R.on('layout', function (L) { renderStore(L); });
    R.els.props.addEventListener('click', function (e) { var p = e.target.closest('.shopprop'); if (p) { e.stopPropagation(); tapProp(p); } });
    R.els.props.addEventListener('keydown', function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; var p = e.target.closest('.shopprop'); if (p) { e.preventDefault(); tapProp(p); } });
  });
  SH.openCard = openCard; SH.renderStore = renderStore; SH.status = status;
})(window);
