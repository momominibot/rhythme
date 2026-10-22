/* Rhythme: Harbour Lane as a place (Jamie, 21 Oct: "All five stores' logic works (grocer, fashion store, gym, fish store,
 * post box), can draw these ?"). The lane's plate (lane-v1.webp, one guarded Seedream run, 21 Oct) is a scene reached from
 * the harbour's signpost: four shopfronts and the post box stand on it. The grocer, the boutique and the gym are walkable
 * interiors; the fish store keeps its sheet until its interior is drawn (that render was cut by the service at 62 s and the
 * run stopped, as the guard requires). Every counter, rail and station opens what ovu-lane.js already has, so nothing new
 * is sold, paid or counted here: this file is only the places. Positions were read off a 1% grid of each plate.
 * Pure data first (testable in node), then the scene wiring, which mounts on load like the other scene files. */
(function (root) {
  'use strict';
  var OFF = { x: -50, y: -50 }, NOWIN = { x: -50, y: -50, rx: 0, ry: 0 }, NOSLEEP = { x: -50, y: -50, w: 1, rot: 0 };
  /* the shopfronts on the lane: the place in ovu-lane.js (its name, hours and sheet), the interior if one is drawn, where
   * the front is and where she stands at its door */
  var FRONTS = [
    { id: 'lanegrocer', place: 'grocer', layout: 'lane-grocer', x: 37, y: 30, label: 'Hay & Harvest · seeds and staples', prompt: 'Tap to go into the grocer', icon: 'storefront', wp: { x: 47, y: 36, flip: true } },
    { id: 'laneboutique', place: 'boutique', layout: 'lane-boutique', x: 45, y: 53, label: 'Petal & Thread · the fitting room', prompt: 'Tap to go into the boutique', icon: 'checkroom', wp: { x: 54, y: 59, flip: true } },
    { id: 'lanegym', place: 'gym', layout: 'lane-gym', x: 67, y: 36, label: 'Tideline Gym · always free', prompt: 'Tap to go into the gym', icon: 'fitness_center', wp: { x: 55, y: 36, flip: false } },
    { id: 'lanefish', place: 'fish', layout: null, x: 70, y: 64, label: 'Bait & Fin · floats for your line', prompt: 'Tap to visit the fish store', icon: 'phishing', wp: { x: 57, y: 64, flip: false } }
  ];
  var LANE = {
    id: 'lane', scene: 'lane', name: 'Harbour Lane', img: 'lane-v1.webp', w: 1024, h: 1280, avatarW: 9, only: [], mapIcon: 'storefront', surface: 'stone',
    hotspots: FRONTS.map(function (f) { return { id: f.id, x: f.x, y: f.y, label: f.label, prompt: f.prompt, icon: f.icon, wp: f.wp }; }).concat([
      { id: 'lanepost', x: 40, y: 74, label: 'The post box · a postcard or a letter', prompt: 'Tap to open the post box', icon: 'markunread_mailbox', wp: { x: 48, y: 80, flip: true } },
      { id: 'laneexit', x: 51, y: 88, label: 'Path · back to the harbour', prompt: 'Tap to go back to the harbour', icon: 'sailing', wp: { x: 51, y: 84, flip: false } }
    ]),
    home: { x: 51, y: 84, flip: false },
    /* the cobbles: from the grocer's step at the top, down past the bench, the boutique's door and the tackle shop's shelf, to
     * the island's edge; the bench, the post box, the lamp and the flower pots stand on them */
    zones: [[[45, 33], [55, 29], [60, 35], [58, 40], [66, 52], [64, 57], [60, 61], [60, 76], [66, 79], [64, 86], [38, 87], [31, 82], [31, 70], [36, 64], [42, 63], [48, 62], [50, 56], [50, 40], [46, 37]]],
    solids: [{ id: 'bench', x0: 52, x1: 71, y0: 39, y1: 51 }, { id: 'postbox', x0: 36, x1: 45, y0: 73, y1: 83 }, { id: 'lamp', x0: 29, x1: 35, y0: 79, y1: 85 },
      { id: 'pot', x0: 38, x1: 43, y0: 60, y1: 66 }, { id: 'pot2', x0: 55, x1: 61, y0: 67, y1: 74 }, { id: 'roses', x0: 63, x1: 81, y0: 73, y1: 83 }],
    /* the path home takes her the moment she steps on it; a shopfront opens only where a walk ends (ovu-walk.js passing) */
    doors: [{ id: 'laneexit', to: 'harbour', x: 51, y: 84, r: 4, flip: false }].concat(FRONTS.map(function (f) {
      var d = { id: f.id, tap: f.id, x: f.wp.x, y: f.wp.y, r: 3, flip: !!f.wp.flip }; if (f.layout) d.to = f.layout; return d;
    })),
    meditator: { x: 47, y: 72, w: 8.3 }, aura: { x: 47, y: 70, w: 12.5 }, holo: { x: 56, y: 70, w: 10 }, /* meditation sits on the cobbles here, never where the last scene had it (Codex, 21 Oct) */
    sleeper: NOSLEEP, zzz: OFF, window: NOWIN, props: {}
  };
  /* the interiors (1024x1280, drawn without goods on purpose). The grocer is open at the front, so she walks in off the
   * mat; the boutique and the gym have a front wall, so she walks the floor behind it (kept above the wall's top edge, so
   * she is never drawn over it): out of the boutique through its arch to the mat, out of the gym by tapping its door */
  function inside(o) { return Object.assign({ w: 1024, h: 1280, avatarW: 9, only: [], mapHide: true, mapParent: 'lane', indoor: true, sleeper: NOSLEEP, zzz: OFF, window: NOWIN, props: {} }, o); }
  var GROCER = inside({
    id: 'lane-grocer', scene: 'lane-grocer', name: 'Hay & Harvest', img: 'shop-grocer-2f-v1.webp', mapIcon: 'storefront',
    hotspots: [
      { id: 'grocermat', x: 46, y: 81, label: 'Door · back to the lane', prompt: 'Tap to go back outside', icon: 'door_open', wp: { x: 50, y: 80, flip: false } },
      { id: 'grocercounter', x: 31, y: 62, label: 'Counter · seed packs and staples', prompt: 'Tap to see what is for sale', icon: 'storefront', wp: { x: 50, y: 61, flip: true } },
      { id: 'grocerrack', x: 21, y: 46, label: 'Seed rack · the seed swap', prompt: 'Tap to look at the seeds', icon: 'grass', wp: { x: 45, y: 60, flip: true } }
    ],
    home: { x: 50, y: 80, flip: false },
    zones: [[[46, 47], [84, 66], [54, 84], [13, 64]]],
    solids: [{ id: 'counter', x0: 25, x1: 46, y0: 62, y1: 76 }, { id: 'crates', x0: 12, x1: 31, y0: 55, y1: 67 }, { id: 'sacks', x0: 28, x1: 43, y0: 48, y1: 58 },
      { id: 'bench', x0: 47, x1: 66, y0: 44, y1: 57 }, { id: 'baskets', x0: 61, x1: 76, y0: 60, y1: 71 }, { id: 'stairs', x0: 64, x1: 92, y0: 40, y1: 68 }, { id: 'door', x0: 44, x1: 56, y0: 63, y1: 76 }],
    doors: [{ id: 'grocermat', to: 'lane', x: 50, y: 80, r: 4, flip: false }],
    meditator: { x: 60, y: 76, w: 8.3 }, aura: { x: 60, y: 74, w: 12.5 }, holo: { x: 69, y: 74, w: 10 }
  });
  var BOUTIQUE = inside({
    id: 'lane-boutique', scene: 'lane-boutique', name: 'Petal & Thread', img: 'shop-boutique-2f-v1.webp', mapIcon: 'checkroom',
    hotspots: [
      { id: 'boutiquemat', x: 50, y: 79, label: 'Door · back to the lane', prompt: 'Tap to go back outside', icon: 'door_open', wp: { x: 50, y: 75, flip: false } },
      { id: 'boutiquefit', x: 20, y: 56, label: 'Fitting room · everything you have', prompt: 'Tap to try something on', icon: 'checkroom', wp: { x: 40, y: 57, flip: true } },
      { id: 'boutiquerail', x: 38, y: 52, label: 'The rail · new looks', prompt: 'Tap to look at the rail', icon: 'apparel', wp: { x: 45, y: 57, flip: true } },
      { id: 'boutiquecounter', x: 66, y: 59, label: 'Counter · Petal & Thread', prompt: 'Tap to see the shop', icon: 'storefront', wp: { x: 57, y: 57, flip: false } }
    ],
    home: { x: 50, y: 58, flip: false },
    zones: [[[36, 49], [60, 49], [60, 58], [57, 59], [57, 77], [44, 77], [44, 59], [36, 58]]],
    solids: [{ id: 'rail', x0: 32, x1: 46, y0: 47, y1: 56 }, { id: 'table', x0: 49, x1: 59, y0: 49, y1: 55 }],
    doors: [{ id: 'boutiquemat', to: 'lane', x: 50, y: 76, r: 3, flip: false }],
    meditator: { x: 50, y: 58, w: 8.3 }, aura: { x: 50, y: 56, w: 12.5 }, holo: { x: 59, y: 56, w: 10 }
  });
  /* the gym's four stations are ovu-lane.js STATIONS (treadmill, bike, mat, weights): each opens the movement log */
  var GYMSPOTS = [
    { id: 'treadmill', x: 26, y: 60, label: 'Treadmill · a walk', prompt: 'Tap to log a walk', icon: 'directions_walk', wp: { x: 33, y: 58, flip: true } },
    { id: 'bike', x: 37, y: 68, label: 'Bike · a ride', prompt: 'Tap to log a ride', icon: 'directions_bike', wp: { x: 39, y: 60, flip: true } },
    { id: 'mat', x: 44, y: 57, label: 'Mats · a stretch', prompt: 'Tap to log a stretch', icon: 'self_improvement', wp: { x: 46, y: 56, flip: false } },
    { id: 'weights', x: 55, y: 50, label: 'Weights · lift slowly', prompt: 'Tap to log strength work', icon: 'fitness_center', wp: { x: 55, y: 56, flip: false } }
  ];
  var GYM = inside({
    id: 'lane-gym', scene: 'lane-gym', name: 'Tideline Gym', img: 'shop-gym-2f-v1.webp', mapIcon: 'fitness_center',
    hotspots: [{ id: 'gymdoor', x: 50, y: 72, label: 'Door · back to the lane', prompt: 'Tap to go back outside', icon: 'door_open', wp: { x: 47, y: 60, flip: false } }].concat(GYMSPOTS.map(function (g) {
      return { id: 'gym' + g.id, x: g.x, y: g.y, label: g.label, prompt: g.prompt, icon: g.icon, wp: g.wp };
    })),
    home: { x: 46, y: 57, flip: false },
    zones: [[[30, 51], [47, 47], [60, 50], [60, 59], [44, 61], [30, 60]]],
    solids: [{ id: 'rack', x0: 50, x1: 61, y0: 46, y1: 53 }, { id: 'shelf', x0: 33, x1: 47, y0: 43, y1: 49 }],
    doors: [], /* the drawn door is shut: she arrives on the floor and goes out by tapping it */
    mapExits: [{ id: 'gymdoor', to: 'lane', x: 50, y: 70 }], /* the map's pin for that door, since it is a tap and not a doorstep */
    meditator: { x: 46, y: 57, w: 8.3 }, aura: { x: 46, y: 55, w: 12.5 }, holo: { x: 55, y: 55, w: 10 }
  });
  var LAYOUTS = { lane: LANE, 'lane-grocer': GROCER, 'lane-boutique': BOUTIQUE, 'lane-gym': GYM };
  /* on the harbour: the post by the hut, a door that opens only where a walk ends */
  var SIGNPOST = { id: 'hblane', to: 'lane', tap: 'hblane', x: 23, y: 51, r: 3, flip: true };
  function onLane(L) { return !!L && (L.id === 'lane' || L.mapParent === 'lane'); }
  root.OvuLaneScene = { LAYOUTS: LAYOUTS, FRONTS: FRONTS, GYMSPOTS: GYMSPOTS, SIGNPOST: SIGNPOST, onLane: onLane };

  /* ---------- the scenes ---------- */
  var R = root.OvuRoom, W = root.OvuWalk, Z = root.OvuZones, LN = root.OvuLane, doc = root.document;
  if (!R || !W || !Z || !LN || !doc || !doc.createElement) return;
  Z.register(LANE, { label: 'Harbour Lane', icon: 'storefront', after: 'harbour' });
  Z.register(GROCER, { label: 'Hay & Harvest', icon: 'storefront', after: 'lane' });
  Z.register(BOUTIQUE, { label: 'Petal & Thread', icon: 'checkroom', after: 'lane' });
  Z.register(GYM, { label: 'Tideline Gym', icon: 'fitness_center', after: 'lane' });
  var HB = R.LAYOUTS.harbour; if (HB && HB.doors && !HB.doors.some(function (d) { return d.id === SIGNPOST.id; })) HB.doors.push(SIGNPOST);
  function at(L, id) { return !!L && L.id === id; }
  function napping() { return !!(W.napping && W.napping()); }
  function asleep() { return !!(R.asleep && R.asleep()); }
  /* a session, practice or meditation that is running keeps the room: no counter or station opens over it (Codex, 21 Oct) */
  function busy() { if (!(R.busy && R.busy())) return false; if (R.toast) R.toast('Finish what you are doing first.', 'info'); return true; }
  var sign = HB && (HB.hotspots || []).filter(function (h) { return h.id === 'hblane'; })[0]; if (sign) sign.prompt = 'Tap to walk up Harbour Lane';
  /* a shop that shuts, or a sleep that starts, while she is on her way in keeps her outside (the walk engine asks again at the end of the fade) */
  FRONTS.forEach(function (f) { var T = f.layout && LAYOUTS[f.layout]; if (!T) return; T.admit = function () { return !asleep() && LN.openNow(f.place); }; T.refused = function () { LN.openPlace(f.place); }; });
  /* the signpost walks her up the lane (it was the lane's sheet before the plate was drawn) */
  R.hotspotHandlers.hblane = function (id, L) { if (!at(L, 'harbour')) return false; if (napping()) return true; W.travel('lane'); return true; };
  /* a shopfront: in its hours she goes in; asleep, shut, or with no interior drawn yet, the place's own sheet says why or
   * serves (ovu-lane.js openPlace checks asleep, then the hours, then opens the sheet) */
  FRONTS.forEach(function (f) {
    R.hotspotHandlers[f.id] = function (id, L) {
      if (!at(L, 'lane')) return false; if (napping() || busy()) return true;
      if (asleep() || !LN.openNow(f.place) || !f.layout || !R.LAYOUTS[f.layout]) { LN.openPlace(f.place); return true; }
      W.travel(f.layout); return true;
    };
  });
  R.hotspotHandlers.lanepost = function (id, L) { if (!at(L, 'lane')) return false; if (busy()) return true; LN.openPlace('post'); return true; };
  R.hotspotHandlers.laneexit = function (id, L) { if (!at(L, 'lane')) return false; if (napping()) return true; W.travel('harbour'); return true; };
  /* inside, each counter, rail and station opens the sheet or log the lane already has; the mats and the gym's door go out */
  function out(layoutId) { return function (id, L) { if (!at(L, layoutId)) return false; if (napping()) return true; W.travel('lane'); return true; }; }
  function counter(layoutId, placeId) { return function (id, L) { if (!at(L, layoutId)) return false; if (busy()) return true; LN.openPlace(placeId); return true; }; }
  R.hotspotHandlers.grocermat = out('lane-grocer');
  R.hotspotHandlers.grocercounter = counter('lane-grocer', 'grocer');
  R.hotspotHandlers.grocerrack = counter('lane-grocer', 'grocer');
  R.hotspotHandlers.boutiquemat = out('lane-boutique');
  R.hotspotHandlers.boutiquerail = counter('lane-boutique', 'boutique');
  R.hotspotHandlers.boutiquecounter = counter('lane-boutique', 'boutique');
  /* the fitting room is her wardrobe (every outfit she has is free to wear), as the boutique sheet's own button opens */
  R.hotspotHandlers.boutiquefit = function (id, L) {
    if (!at(L, 'lane-boutique')) return false; if (busy()) return true;
    if (asleep() || !LN.openNow('boutique') || !R.openWardrobe) { LN.openPlace('boutique'); return true; }
    R.chime('tap'); R.openWardrobe(); return true;
  };
  R.hotspotHandlers.gymdoor = out('lane-gym');
  GYMSPOTS.forEach(function (g) {
    R.hotspotHandlers['gym' + g.id] = function (id, L) {
      if (!at(L, 'lane-gym')) return false; if (busy()) return true;
      var st = (LN.STATIONS || []).filter(function (s) { return s.id === g.id; })[0];
      if (asleep() || !LN.openNow('gym') || !st || !R.openExercise) { LN.openPlace('gym'); return true; }
      R.openExercise(st.act); if (R.moment) R.moment('gym', { quiet: true }); /* as the gym sheet's own buttons do; only her save logs anything */
      return true;
    };
  });
})(typeof window !== 'undefined' ? window : this);
