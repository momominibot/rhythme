/* The wide Dream Street layout (19 Oct 2026, docs/design/2026-10-19-wide-street.md), kept as a test fixture after Jamie
 * chose the one-screen street again (20 Oct). The wide-plate machinery (span, the wider planner grid, the sideways camera
 * clamp, foreground cutouts) stays in the engine and is still tested against this layout. */
module.exports = function () {
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
    props: {},
    /* foreground cutouts (docs/design/2026-10-19-wide-street.md, "Foreground cutouts"): the plate is flat, so the front
     * pillar of each arch and the two lamps are cut from it (tools/art/occluders.py) and drawn again exactly over themselves.
     * The walk engine ranks each by `base`, the centre of its footprint on the cobbles, inside the solid named by `solid`:
     * with her feet (or a pet's) above the base she passes behind it, below it in front. Box percent, like everything here */
    occluders: [
      { id: 'garden-arch', solid: 'arch', img: 'street-occ-arch.webp', x: 21.118, y: 30.859, w: 14.893, h: 32.129, base: 62 },
      { id: 'lamp-west', solid: 'lamp', img: 'street-occ-lamp1.webp', x: 70.068, y: 29.297, w: 7.69, h: 33.496, base: 61.9 },
      { id: 'lamp-east', solid: 'lamp', img: 'street-occ-lamp2.webp', x: 145.874, y: 34.082, w: 8.179, h: 35.156, base: 68.2 },
      { id: 'plaza-arch', solid: 'arch', img: 'street-occ-arch2.webp', x: 197.021, y: 39.355, w: 17.7, h: 39.844, base: 77 }
    ]
  };
  return STREET;
};
