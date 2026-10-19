/* Rhythme Dream Street: the three stores from the heart shop as real buildings on a cobbled street
 * between the garden and the plaza. Walking up to a storefront door (or tapping it) opens that store's
 * sheet through the room's own openShop; closing the sheet leaves the avatar on the street outside.
 * The catalogue itself stays in ovu-rewards.js and the sheet in room.js; this file is only the scene. */
(function (root) {
  'use strict';
  /* A wide plate (docs/design/2026-10-19-wide-street.md): rendered 19 Oct 2026 (Seedream 5.0 pro, seed 7311, 2048x1024)
   * and drawn 2.5 box widths wide (span), so every position below is a percent of the BOX: x runs 0 to 250, y 0 to 100.
   * Read off a 5-unit grid. Like every scene it opens fitted to the screen (zoom 1, Jamie 19 Oct): the whole height in view
   * and two and a half screens of street to walk, the camera following her sideways. If the person zooms in, her feet are
   * held a little lower on the box (cam.sy) so the shopfronts stay whole. The Cosy Nook is a big lit window with the bench
   * in front of it, so its doorstep is the cobbles in front of the bench. */
  var STORES = [
    { id: 'petshop', tab: 'pet', layout: 'shop-pet', name: 'Whisker & Paw', hours: [10, 19], x: 98.5, y: 50, label: 'Whisker & Paw · adopt a friend', wp: { x: 98.5, y: 62.6, flip: false } },
    { id: 'furniture', tab: 'furniture', layout: 'shop-furniture', name: 'The Cosy Nook', hours: [11, 21], x: 129.5, y: 45, label: 'The Cosy Nook · pieces for your room', wp: { x: 128, y: 68.2, flip: false } },
    { id: 'homes', tab: 'home', layout: 'shop-homes', name: 'Moonrise Homes', hours: [9, 18], x: 166, y: 52, label: 'Moonrise Homes · dream houses', wp: { x: 166, y: 68.6, flip: true } }
  ];
  var BENCH_WP = { x: 141, y: 68.8, flip: true }; /* beside the bench, on the cobbles below the right-hand pot */
  var STREET = {
    id: 'street', scene: 'street', name: 'Dream Street', img: 'street-wide-v1.webp', w: 2048, h: 1024, span: 2.5, cam: { sy: 0.68 }, avatarW: 12, only: [],
    hotspots: STORES.map(function (s) { return { id: s.id, x: s.x, y: s.y, label: s.label, icon: 'storefront', wp: s.wp }; }).concat([
      { id: 'arch', x: 38, y: 42, label: 'Arch · back to the garden', icon: 'park', wp: { x: 38, y: 60.2, flip: true } },
      { id: 'arch2', x: 216, y: 50, label: 'Arch · on to the plaza', icon: 'park', wp: { x: 222, y: 73.6, flip: false } },
      { id: 'bench', x: 128.5, y: 57, label: 'Bench · sit a while', icon: 'chair', wp: BENCH_WP }
    ]),
    home: { x: 47, y: 61.5, flip: false },
    /* the cobbles between the shopfronts (back) and the slab's front edge, y = 63 + 0.0964 (x - 15) less a margin */
    zones: [[[31, 58.5], [44, 57.8], [58, 58], [70, 59.2], [72, 60.8], [107, 62], [150, 63.5], [152, 67], [198, 68.2], [212, 70], [217, 71.2], [225, 71.8],
      [225.5, 75.5], [214, 79.8], [100, 70], [60, 66.1], [33, 63.5], [26, 62.9]]],
    solids: [{ id: 'arch', x0: 22, x1: 31, y0: 59.5, y1: 64 }, { id: 'arch', x0: 45, x1: 55, y0: 53, y1: 57.5 }, { id: 'tree', x0: 58, x1: 68, y0: 56, y1: 60 },
      { id: 'lamp', x0: 72, x1: 77, y0: 60, y1: 63.5 }, { id: 'pot', x0: 108.5, x1: 120.5, y0: 60, y1: 64 }, { id: 'bench', x0: 119, x1: 138, y0: 60, y1: 65.5 },
      { id: 'pot', x0: 138, x1: 148.5, y0: 61, y1: 66 }, { id: 'lamp', x0: 146.5, x1: 153, y0: 65, y1: 68.5 },
      { id: 'arch', x0: 199, x1: 211, y0: 72.5, y1: 82 }, { id: 'arch', x0: 218, x1: 230, y0: 66, y1: 70.8 }], /* the plaza arch's front pillar reaches up the cobbles so she passes behind it, never stops there */
    doors: [{ id: 'arch', to: 'garden', x: 38, y: 60.2, r: 4.5, flip: true }, { id: 'arch2', to: 'plaza', x: 222, y: 73.6, r: 4, flip: false }].concat(STORES.map(function (s) { return { id: s.id, to: s.layout, tap: s.id, x: s.wp.x, y: s.wp.y, r: 3, flip: !!s.wp.flip }; })),
    meditator: { x: 126, y: 63, w: 11, seat: { x: 126, seatY: 60, groundY: 65.3, face: 'left' } }, aura: { x: 128, y: 61, w: 17 }, holo: { x: 142, y: 64, w: 13 },
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
