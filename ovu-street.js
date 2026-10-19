/* Rhythme Dream Street: the three stores from the heart shop as real buildings on a cobbled street
 * between the garden and the plaza. Walking up to a storefront door (or tapping it) opens that store's
 * sheet through the room's own openShop; closing the sheet leaves the avatar on the street outside.
 * The catalogue itself stays in ovu-rewards.js and the sheet in room.js; this file is only the scene. */
(function (root) {
  'use strict';
  /* One screen, one glance (Jamie, 20 Oct: the wide street felt odd): the 18 Oct plate is back; the wide one stays on disk.
   * rendered 18 Oct 2026 (Seedream 5.0 pro, seed 7303, 1472x1840): positions read off a 5% grid */
  var STORES = [
    { id: 'petshop', tab: 'pet', layout: 'shop-pet', name: 'Whisker & Paw', hours: [10, 19], x: 27, y: 47, label: 'Whisker & Paw · adopt a friend', wp: { x: 23, y: 58, flip: false } },
    { id: 'furniture', tab: 'furniture', layout: 'shop-furniture', name: 'The Cosy Nook', hours: [11, 21], x: 53, y: 46, label: 'The Cosy Nook · pieces for your room', wp: { x: 52, y: 58, flip: false } },
    { id: 'homes', tab: 'home', layout: 'shop-homes', name: 'Moonrise Homes', hours: [9, 18], x: 70, y: 45, label: 'Moonrise Homes · dream houses', wp: { x: 76, y: 57, flip: true } }
  ];
  var BENCH_WP = { x: 44, y: 70, flip: false };
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
    meditator: { x: 53, y: 65, w: 11, seat: { x: 53, seatY: 65.5, groundY: 69, face: 'left' } }, aura: { x: 53, y: 63, w: 17 }, holo: { x: 63, y: 63, w: 14 },
    sleeper: { x: -50, y: -50, w: 1, rot: 0 }, zzz: { x: -50, y: -50 }, window: { x: -50, y: -50, rx: 0, ry: 0 },
    props: {}
  };
  /* each store keeps its own hours (tester mode may visit any time, as the room allows); an attempt to go in outside them
   * shows the store's hours instead. Pure, so the tests can pass a date */
  function storeFor(tab) { return STORES.filter(function (s) { return s.tab === tab || s.id === tab || s.layout === tab; })[0] || null; }
  function hoursFor(tab) { var s = storeFor(tab); return s ? s.hours : [9, 22]; }
  function fmtHour(h) { return h === 12 ? '12 noon' : h === 0 || h === 24 ? 'midnight' : h < 12 ? h + ' am' : (h - 12) + ' pm'; }
  function openAt(tab, d) { var hr = hoursFor(tab), h = d.getHours() + d.getMinutes() / 60; return h >= hr[0] && h < hr[1]; }
  function openNow(tab, d) { var RW = root.OvuRewards; if (RW && RW.tester && RW.tester()) return true; return openAt(tab, d || new Date()); }
  function hoursText(tab) { var hr = hoursFor(tab); return fmtHour(hr[0]) + ' to ' + fmtHour(hr[1]); }
  root.OvuStreet = { LAYOUT: STREET, STORES: STORES, BENCH_WP: BENCH_WP, storeFor: storeFor, hoursFor: hoursFor, fmtHour: fmtHour, openAt: openAt, openNow: openNow, hoursText: hoursText };
  var R = root.OvuRoom; if (!R || !root.document || !root.document.createElement) return;
  var doc = root.document;
  R.LAYOUTS.street = STREET;
  function onStreet(L) { return L && L.id === 'street'; }
  /* the hours card: shown on any attempt to go in while a store is shut (a storefront tap, a walk through its door, a mini-map stop) */
  function hoursCard(tab) {
    var s = storeFor(tab); if (!s) return;
    var hr = s.hours, now = new Date(), h = now.getHours() + now.getMinutes() / 60, when = h < hr[0] ? 'It opens at ' + fmtHour(hr[0]) + ' today.' : 'It opens again at ' + fmtHour(hr[0]) + ' tomorrow.';
    R.openSheet('hours', s.name, 'Opening hours', 'schedule',
      '<div class="closedcard"><span class="ms">schedule</span><b>' + R.esc(s.name) + ' is closed right now.</b><p>Open ' + hoursText(tab) + ', every day. ' + when + '</p></div>' +
      '<p class="help">' + STORES.map(function (x) { return R.esc(x.name) + ': ' + hoursText(x.tab); }).join(' · ') + '.</p>');
  }
  root.OvuStreet.hoursCard = hoursCard;
  STORES.forEach(function (s) {
    R.hotspotHandlers[s.id] = function (id, L) {
      if (!onStreet(L)) return false;
      L.home.x = s.wp.x; L.home.y = s.wp.y; L.home.flip = !!s.wp.flip; /* back on the street she stands at this door */
      if (R.asleep && R.asleep()) { if (R.openShop) R.openShop(s.tab); } /* asleep: the room's own card */
      else if (!openNow(s.tab)) hoursCard(s.tab); /* outside this store's hours: its hours, and when to come back */
      else if (R.LAYOUTS[s.layout]) root.OvuWalk.travel(s.layout); else if (R.openShop) R.openShop(s.tab); /* the sheet is the fallback */
      return true;
    };
  });
  R.hotspotHandlers.arch2 = function (id, L) { if (!onStreet(L)) return false; root.OvuWalk.travel('plaza'); return true; };
  var prevArch = R.hotspotHandlers.arch, prevBench = R.hotspotHandlers.bench;
  R.hotspotHandlers.arch = function (id, L) { if (onStreet(L)) { root.OvuWalk.travel('garden'); return true; } return prevArch ? prevArch(id, L) : false; };
  R.hotspotHandlers.bench = function (id, L) { if (onStreet(L)) { root.OvuGarden.openBench(STREET.meditator, STREET.holo, BENCH_WP); return true; } return prevBench ? prevBench(id, L) : false; };
})(window);
