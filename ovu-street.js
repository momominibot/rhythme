/* Rhythme Dream Street: the three stores from the heart shop as real buildings on a cobbled street
 * between the garden and the plaza. Walking up to a storefront door (or tapping it) opens that store's
 * sheet through the room's own openShop; closing the sheet leaves the avatar on the street outside.
 * The catalogue itself stays in ovu-rewards.js and the sheet in room.js; this file is only the scene. */
(function (root) {
  'use strict';
  /* rendered 18 Oct 2026 (Seedream 5.0 pro, seed 7303, 1472x1840): positions read off a 5% grid */
  var STORES = [
    { id: 'petshop', tab: 'pet', layout: 'shop-pet', x: 27, y: 47, label: 'Pet shop · adopt a friend', wp: { x: 23, y: 58, flip: false } },
    { id: 'furniture', tab: 'furniture', layout: 'shop-furniture', x: 53, y: 46, label: 'Furniture store · pieces for your room', wp: { x: 52, y: 58, flip: false } },
    { id: 'homes', tab: 'home', layout: 'shop-homes', x: 70, y: 45, label: 'Property showroom · dream houses', wp: { x: 76, y: 57, flip: true } }
  ];
  var STREET = {
    id: 'street', scene: 'street', name: 'Dream Street', img: 'street-v1.webp', w: 1472, h: 1840, avatarW: 12, only: [],
    hotspots: STORES.map(function (s) { return { id: s.id, x: s.x, y: s.y, label: s.label, icon: 'storefront', wp: s.wp }; }).concat([
      { id: 'arch', x: 12, y: 50, label: 'Arch · back to the garden', icon: 'park', wp: { x: 16, y: 60, flip: true } },
      { id: 'arch2', x: 86, y: 50, label: 'Arch · on to the plaza', icon: 'park', wp: { x: 84, y: 60, flip: false } },
      { id: 'bench', x: 54, y: 66, label: 'Bench · sit a while', icon: 'chair', wp: { x: 44, y: 70, flip: false } }
    ]),
    home: { x: 16, y: 60, flip: false },
    zones: [[[14, 54], [86, 54], [92, 60], [50, 79], [7, 63]]],
    solids: [{ id: 'lamp', x0: 26, x1: 30, y0: 56, y1: 62 }, { id: 'bench', x0: 46, x1: 58, y0: 64, y1: 72 }, { id: 'tree', x0: 64, x1: 70, y0: 57, y1: 65 }, { id: 'pot', x0: 28, x1: 38, y0: 62, y1: 70 }, { id: 'pot', x0: 59, x1: 65, y0: 68, y1: 72 }, { id: 'bush', x0: 18, x1: 26, y0: 61, y1: 66 }, { id: 'arch', x0: 6, x1: 14, y0: 46, y1: 62 }, { id: 'arch', x0: 86, x1: 92, y0: 46, y1: 62 }],
    doors: [{ id: 'arch', to: 'garden', x: 16, y: 60, r: 4.5, flip: true }, { id: 'arch2', to: 'plaza', x: 84, y: 60, r: 4.5, flip: false }].concat(STORES.map(function (s) { return { id: s.id, to: s.layout, tap: s.id, x: s.wp.x, y: s.wp.y, r: 3.5, flip: !!s.wp.flip }; })),
    meditator: { x: 53, y: 65, w: 11 }, aura: { x: 53, y: 63, w: 17 }, holo: { x: 63, y: 63, w: 14 },
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 },
    props: {}
  };
  root.OvuStreet = { LAYOUT: STREET, STORES: STORES };
  var R = root.OvuRoom; if (!R || !root.document || !root.document.createElement) return;
  var doc = root.document;
  R.LAYOUTS.street = STREET;
  function onStreet(L) { return L && L.id === 'street'; }
  STORES.forEach(function (s) {
    R.hotspotHandlers[s.id] = function (id, L) {
      if (!onStreet(L)) return false;
      L.home.x = s.wp.x; L.home.y = s.wp.y; L.home.flip = !!s.wp.flip; /* back on the street she stands at this door */
      if (!root.OvuWalk.shopsOpen() || (R.asleep && R.asleep())) { if (R.openShop) R.openShop(s.tab); } /* after hours or asleep: the room's own closed card */
      else if (R.LAYOUTS[s.layout]) root.OvuWalk.travel(s.layout); else if (R.openShop) R.openShop(s.tab); /* the sheet is the fallback */
      return true;
    };
  });
  R.hotspotHandlers.arch2 = function (id, L) { if (!onStreet(L)) return false; root.OvuWalk.travel('plaza'); return true; };
  var prevArch = R.hotspotHandlers.arch, prevBench = R.hotspotHandlers.bench;
  R.hotspotHandlers.arch = function (id, L) { if (onStreet(L)) { root.OvuWalk.travel('garden'); return true; } return prevArch ? prevArch(id, L) : false; };
  R.hotspotHandlers.bench = function (id, L) { if (onStreet(L)) { root.OvuGarden.openBench(STREET.meditator, STREET.holo, { x: 44, y: 70, flip: false }); return true; } return prevBench ? prevBench(id, L) : false; };
  /* Dream Street keeps hours (room.js shopOpenNow, 9 am to 10 pm, tester mode may visit): outside them each storefront
   * wears a small closed sign on the plate, re-drawn with the props and checked once a minute while she is on the street */
  function renderSigns(L) {
    if (!L || !onStreet(L) || !R.els.props) return;
    Array.prototype.slice.call(R.els.props.querySelectorAll('.closedsign')).forEach(function (el) { el.remove(); });
    if (root.OvuWalk.shopsOpen()) return;
    STORES.forEach(function (s) {
      var el = doc.createElement('div'); el.className = 'closedsign'; el.setAttribute('aria-hidden', 'true');
      el.style.left = s.x + '%'; el.style.top = (s.y + 7) + '%'; el.innerHTML = '<span class="ms">nights_stay</span>Closed · 9 am to 10 pm';
      R.els.props.appendChild(el);
    });
  }
  R.on('boot', function () {
    R.on('layout', renderSigns); R.on('props', renderSigns);
    root.setInterval(function () { var L = R.layout(); if (onStreet(L)) renderSigns(L); }, 60000);
  });
})(window);
