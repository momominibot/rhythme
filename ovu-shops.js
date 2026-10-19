/* Rhythme store interiors: the pet shop, the furniture store and the property showroom on Dream Street are
 * walkable rooms. The catalogue items from ovu-rewards.js stand on the shelves, beds, platforms and pedestals as
 * tappable props; tapping one walks the avatar over and opens a small card whose buttons go through the room's
 * own shopAct (the same buy, place, visit and move-in code the store sheet uses). The sheet (openShop) stays as the
 * inventory view and as the fallback. Pets you own and have at home sit on the pet shop rug, visiting.
 * Pure data first (testable in node), then the scene wiring, which mounts on OvuRoom boot. */
(function (root) {
  'use strict';
  var OFF = { x: -50, y: -50 }, NOWIN = { x: -50, y: -50, rx: 0, ry: 0 }, NOSLEEP = { x: -50, y: -50, w: 1, rot: 0 };
  /* two-storey plates rendered 19 Oct 2026 (Seedream 5.0 pro, seeds 7331 to 7333, 1248x1560), surfaces drawn empty on
   * purpose; positions read off a 5% grid. Each store has a ground floor, a staircase on the right and a gallery along the
   * back walls (zones: ground, gallery, stairs; stairs and upstairsY let the room's own hotspot walks climb too).
   * spots: where catalogue items stand, per kind (or per slot for furniture), in order, with spares for new stock; every
   * spot sits on a drawn surface (bed, shelf, platform, pedestal) and its wp is where she stands to look at it. */
  var PET = {
    id: 'shop-pet', scene: 'street', store: 'pet', name: 'Whisker & Paw', img: 'shop-pet-2f-v1.webp', w: 1248, h: 1560, avatarW: 12, only: [],
    hotspots: [{ id: 'mat', x: 46, y: 79, label: 'Door mat · back to the street', icon: 'door_open', wp: { x: 46, y: 76, flip: false } }],
    home: { x: 46, y: 76, flip: false },
    stairs: [{ x: 66, y: 74 }, { x: 58, y: 53 }], upstairsY: 60,
    zones: [[[47, 62], [82, 70], [47, 80], [12, 70]], [[20, 46], [50, 36], [50, 43], [20, 53]], [[50, 36], [85, 50], [85, 62], [50, 48]], [[56, 50], [66, 50], [70, 76], [58, 76]]],
    solids: [{ id: 'beds', x0: 17, x1: 50, y0: 58, y1: 70 }, { id: 'counter', x0: 18, x1: 40, y0: 70, y1: 78 }, { id: 'awning', x0: 52, x1: 65, y0: 38, y1: 49 }, { id: 'shelf', x0: 67, x1: 83, y0: 36, y1: 55 }],
    doors: [{ id: 'mat', to: 'street', x: 46, y: 76, r: 4, flip: false }],
    spots: {
      pet: [{ x: 27, y: 65, wp: { x: 42, y: 73, flip: true } }, { x: 35, y: 62, wp: { x: 42, y: 73, flip: true } }, { x: 44, y: 59.5, wp: { x: 52, y: 69, flip: true } }, { x: 28, y: 47.5, wp: { x: 26, y: 49.5, flip: false } }, { x: 36, y: 45, wp: { x: 32, y: 48, flip: false } }, { x: 44, y: 42.3, wp: { x: 40, y: 45.5, flip: false } }, { x: 76, y: 70, wp: { x: 70, y: 68, flip: false } }],
      treat: [{ x: 55, y: 40.5, w: 4.4, wp: { x: 58, y: 50, flip: false } }, { x: 59, y: 41.8, w: 4.4, wp: { x: 58, y: 50, flip: false } }, { x: 63, y: 43, w: 4.4, wp: { x: 58, y: 50, flip: false } }, { x: 55, y: 46.5, w: 4.4, wp: { x: 58, y: 50, flip: false } }, { x: 59, y: 47.8, w: 4.4, wp: { x: 58, y: 50, flip: false } }, { x: 63, y: 49, w: 4.4, wp: { x: 58, y: 50, flip: false } }],
      accessory: [{ x: 71, y: 38.5, w: 4, wp: { x: 74, y: 56, flip: false } }, { x: 77, y: 40.3, w: 4, wp: { x: 74, y: 56, flip: false } }, { x: 71, y: 45.5, w: 4, wp: { x: 74, y: 56, flip: false } }, { x: 77, y: 47.3, w: 4, wp: { x: 74, y: 56, flip: false } }, { x: 71, y: 52.5, w: 4, wp: { x: 74, y: 56, flip: false } }, { x: 77, y: 54.3, w: 4, wp: { x: 74, y: 56, flip: false } }]
    },
    meditator: { x: 46, y: 72, w: 11 }, aura: { x: 46, y: 70, w: 17 }, holo: { x: 56, y: 70, w: 14 }, sleeper: NOSLEEP, zzz: OFF, window: NOWIN,
    props: {}
  };
  var FURNITURE = {
    id: 'shop-furniture', scene: 'street', store: 'furniture', name: 'The Cosy Nook', img: 'shop-furniture-2f-v1.webp', w: 1248, h: 1560, avatarW: 12, only: [],
    hotspots: [{ id: 'mat', x: 49, y: 79, label: 'Door mat · back to the street', icon: 'door_open', wp: { x: 48, y: 76, flip: false } }],
    home: { x: 48, y: 76, flip: false },
    stairs: [{ x: 64, y: 72 }, { x: 60, y: 46 }], upstairsY: 52,
    zones: [[[47, 56], [82, 67], [47, 79], [13, 67]], [[14, 42], [47, 30], [47, 37], [14, 49]], [[47, 30], [84, 42], [84, 49], [47, 37]], [[57, 44], [68, 44], [72, 75], [60, 75]]],
    solids: [{ id: 'platform', x0: 14, x1: 45, y0: 56, y1: 66 }, { id: 'block', x0: 40, x1: 56, y0: 54, y1: 62 }, { id: 'counter', x0: 22, x1: 38, y0: 66, y1: 78 }, { id: 'upleft', x0: 18, x1: 40, y0: 31, y1: 40 }, { id: 'upright', x0: 56, x1: 80, y0: 29, y1: 41 }],
    doors: [{ id: 'mat', to: 'street', x: 48, y: 76, r: 4, flip: false }],
    spots: { furniture: {
      corner: [{ x: 18, y: 61, wp: { x: 40, y: 68, flip: true } }, { x: 26, y: 58.5, wp: { x: 40, y: 68, flip: true } }, { x: 34, y: 56.3, wp: { x: 40, y: 68, flip: true } }],
      seat: [{ x: 45, y: 58.5, wp: { x: 48, y: 66, flip: true } }, { x: 51, y: 57, wp: { x: 48, y: 66, flip: false } }],
      lamp: [{ x: 22, y: 38, wp: { x: 30, y: 41, flip: true } }, { x: 29, y: 35.6, wp: { x: 30, y: 41, flip: true } }, { x: 36, y: 33.2, wp: { x: 30, y: 41, flip: false } }],
      other: [{ x: 60, y: 38.5, wp: { x: 68, y: 42, flip: true } }, { x: 68, y: 36, wp: { x: 68, y: 42, flip: false } }, { x: 76, y: 33.5, wp: { x: 68, y: 42, flip: false } }]
    } },
    meditator: { x: 48, y: 72, w: 11 }, aura: { x: 48, y: 70, w: 17 }, holo: { x: 58, y: 70, w: 14 }, sleeper: NOSLEEP, zzz: OFF, window: NOWIN,
    props: {}
  };
  var HOMES = {
    id: 'shop-homes', scene: 'street', store: 'home', name: 'Moonrise Homes', img: 'shop-homes-2f-v1.webp', w: 1248, h: 1560, avatarW: 12, only: [],
    hotspots: [{ id: 'mat', x: 40, y: 78, label: 'Door mat · back to the street', icon: 'door_open', wp: { x: 35, y: 73, flip: false } }],
    home: { x: 35, y: 73, flip: false },
    stairs: [{ x: 66, y: 72 }, { x: 62, y: 48 }], upstairsY: 52,
    zones: [[[47, 55], [82, 66], [47, 78], [12, 66]], [[22, 40], [47, 30], [47, 37], [22, 47]], [[47, 30], [80, 42], [80, 49], [47, 37]], [[59, 46], [70, 46], [73, 75], [61, 75]]],
    solids: [{ id: 'bench', x0: 12, x1: 36, y0: 56, y1: 68 }, { id: 'stand', x0: 38, x1: 48, y0: 55, y1: 63 }, { id: 'stand', x0: 48, x1: 58, y0: 52, y1: 60 }, { id: 'stand', x0: 47, x1: 57, y0: 61, y1: 69 }, { id: 'stand', x0: 31, x1: 41, y0: 36, y1: 43 }, { id: 'stand', x0: 42, x1: 51, y0: 33, y1: 40 }, { id: 'desk', x0: 48, x1: 60, y0: 29, y1: 36 }],
    doors: [{ id: 'mat', to: 'street', x: 35, y: 73, r: 4, flip: false }],
    spots: { home: [{ x: 44.5, y: 60, w: 9, wp: { x: 38, y: 70, flip: true } }, { x: 53, y: 57, w: 9, wp: { x: 50, y: 74, flip: false } }, { x: 52, y: 66, w: 9, wp: { x: 50, y: 74, flip: false } }, { x: 36, y: 40, w: 8, wp: { x: 28, y: 42, flip: false } }, { x: 46.5, y: 37, w: 8, wp: { x: 52, y: 37.5, flip: true } }] },
    meditator: { x: 24, y: 61, w: 11 }, aura: { x: 24, y: 59, w: 17 }, holo: { x: 34, y: 59, w: 14 }, sleeper: NOSLEEP, zzz: OFF, window: NOWIN,
    props: {}
  };
  var LAYOUTS = { 'shop-pet': PET, 'shop-furniture': FURNITURE, 'shop-homes': HOMES };
  /* which catalogue kinds stand in which store */
  var KINDS = { 'shop-pet': ['pet', 'treat', 'accessory'], 'shop-furniture': ['furniture'], 'shop-homes': ['home'] };
  /* the model sprites that stand for the houses on the showroom pedestals (the shop thumbnails are opaque cards) */
  var MODELS = { house: 'model-house.webp', bathhouse: 'model-bathhouse.webp', familyhome: 'model-familyhome.webp' };
  /* the width a shelf item is drawn at: the room's own prop widths (percent of plate, the same rule as at home), else the spot's */
  function widthFor(it, spot, roomProps) {
    var base = roomProps && (roomProps[it.id] || (it.posAs && roomProps[it.posAs]));
    return base ? base.w * (it.wk || 1) : (spot.w || 8);
  }
  /* items of one store with the spot each gets, in catalogue order; items beyond the spots stay in the sheet only.
   * Bought things are gone from the shelf (they live in the inventory sheet and at home); treats restock. */
  function placements(layoutId, SHOP, ledger, roomProps) {
    var L = LAYOUTS[layoutId], out = []; if (!L) return out;
    var owned = (ledger && ledger.owned) || [];
    (KINDS[layoutId] || []).forEach(function (kind) {
      var spots = (L.spots || {})[kind] || [], used = {};
      SHOP.forEach(function (it) {
        if (it.kind !== kind) return;
        if (it.kind !== 'treat' && owned.indexOf(it.id) > -1) return; /* sold: off the shelf, into the inventory */
        var list = Array.isArray(spots) ? spots : (spots[it.slot] || spots.other || []), key = Array.isArray(spots) ? '' : (spots[it.slot] ? it.slot : 'other');
        var n = used[key] || 0; if (!list[n]) return; used[key] = n + 1;
        out.push({ item: it, spot: list[n], kind: kind, group: key, w: widthFor(it, list[n], roomProps) });
      });
    });
    return out;
  }
  /* how many spots each store keeps for its kinds (spares included) */
  function capacity(layoutId) { var L = LAYOUTS[layoutId], out = {}; if (!L) return out; Object.keys(L.spots || {}).forEach(function (k) { var sp = L.spots[k]; out[k] = Array.isArray(sp) ? sp.length : Object.keys(sp).reduce(function (a, g) { return a + sp[g].length; }, 0); }); return out; }
  var SH = { LAYOUTS: LAYOUTS, KINDS: KINDS, MODELS: MODELS, placements: placements, capacity: capacity, widthFor: widthFor };
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
    placements(L.id, RW.SHOP, l, R.LAYOUTS.room.props).forEach(function (p) {
      var it = p.item, st = status(it, l);
      var d = doc.createElement('div'); d.className = 'nb shopprop kind-' + it.kind; d.dataset.id = 'shop-' + it.id; d.dataset.item = it.id;
      d.setAttribute('role', 'button'); d.setAttribute('tabindex', '0'); d.setAttribute('aria-label', it.name + (it.kind === 'treat' && st.have ? ', ' + st.have + ' in your cupboard' : '') + '. Tap for details.');
      d.style.left = p.spot.x + '%'; d.style.top = p.spot.y + '%'; d.style.width = p.w + '%';
      d.innerHTML = '<img src="' + ART + spriteFor(it) + '" alt="">';
      wrap.appendChild(d);
    });
  }
  /* a bought thing leaves the shelf with a little sparkle, then the shelf re-renders without it */
  function soldAway(itemId) {
    var el = R.els.props.querySelector('.shopprop[data-item="' + itemId + '"]'); if (!el) { renderStore(R.layout()); return; }
    el.classList.add('sold'); el.insertAdjacentHTML('beforeend', '<span class="soldfx" aria-hidden="true"><i></i><i></i><i></i><i></i></span>');
    root.setTimeout(function () { renderStore(R.layout()); }, 720);
  }
  function openCard(itemId) {
    if (root.OvuWalk.napping()) return;
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
        if (act === 'buy') { R.shopAct('buy', it.id, { go: function (lid, asVisit) { root.OvuWalk.travel(lid, { visit: asVisit }); } }); if (it.kind !== 'home') { R.hideSheet(); if (it.kind === 'treat') renderStore(R.layout()); else soldAway(it.id); } return; }
        if (act === 'toggle') { R.shopAct('toggle', it.id); R.hideSheet(); renderStore(R.layout()); return; }
        if (act === 'visit') { R.shopAct('visit', it.id, { go: function (lid, asVisit) { root.OvuWalk.travel(lid, { visit: asVisit }); } }); return; }
        if (act === 'home') { R.hideSheet(); R.shopAct('home', b.dataset.to, { go: function (lid, asVisit) { root.OvuWalk.travel(lid, { visit: asVisit }); } }); }
      } catch (err) { var m = doc.getElementById('cardMsg'); if (m) { m.textContent = err.message; m.className = 'msg on err'; } }
    });
  }
  /* tap a prop: walk over, then the card */
  function tapProp(el) {
    var id = el.dataset.item, L = R.layout(), p = placements(L.id, RW.SHOP, ledger(), R.LAYOUTS.room.props).filter(function (x) { return x.item.id === id; })[0];
    if (!p || root.OvuWalk.napping()) return; R.chime('tap'); R.cancelIdle(); if (root.OvuWalk.walking()) root.OvuWalk.stop();
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
