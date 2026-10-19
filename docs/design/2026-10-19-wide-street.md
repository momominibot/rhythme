# A wide Dream Street (19 October 2026)

Jamie asked for "bigger space to walk ... like a game". Step one was the follow camera
([2026-10-19-follow-camera.md](2026-10-19-follow-camera.md)): every outdoor scene opens closer and the view keeps her
in frame. This is step two: one plate that is genuinely longer than the phone, so the camera has somewhere to go.
Dream Street becomes a 2:1 panorama (three storefronts in a row, the arch to the garden at the left end, the arch to the
plaza at the right end, the bench, lamps and pots along the front), drawn two and a half box widths wide.

## How a wide plate maps

Today `#scene` takes the plate's own aspect (`aspect-ratio: L.w / L.h`), `#sceneInner` is `inset: 0` (the same box),
every overlay is placed in percent of that box, and the camera transform on the inner is clamped so the plate always
covers the box (`x` in `[W - W z, 0]`, `y` in `[H - H z, 0]`).

Two ways to make the street wider than the box:

**A. A wider inner.** `#sceneInner` becomes `span` box widths wide, and every coordinate stays a percent of the inner
(0 to 100 on both axes). Everything `inset: 0` inside it (plate, night veil, stars, sparkles) follows for free. The cost
is that x and y percent stop being the same size on screen: on the street one percent across would be 2.5 times longer
than on every other plate. Every distance the walk engine measures assumes they are comparable: the floor
foreshortening (`Y_SCALE`), walking speed, door ellipses, the 2 % planner cells, the prop and pet foot boxes, the walk
cycle's stride, route costs and the CSS walk timing. Each would need a per-layout correction, and so would every width
in percent (her size, the bench sitter, the hologram, props).

**B. A box-sized inner with a plate that runs past it (chosen).** `#sceneInner` stays the size of the box and stays the
camera's frame of reference. The plate image is drawn `span` box widths wide inside it, and coordinates stay a percent
of the box: on the wide street x runs from 0 to `100 * span` (250), y from 0 to 100. Absolutely positioned children
with `left: 180%` simply sit to the right of the inner's own box; the scene's `overflow: hidden` crops them until the
camera translates them into view, and hit testing works on them as on anything else. One percent is the same length on
every plate, so the walk engine, her size, the doors and the bench need no correction at all.

What B needs, and nothing more:

1. **Layout data.** `L.span` (default 1). The street: plate 2048 x 1024, `span: 2.5`.
2. **Scene box.** `aspect-ratio: L.w / (L.h * span)`, which is 0.8 for the street, the same box as the garden, the plaza,
   the room and the stores, so nothing below the scene jumps when she travels.
3. **Full-cover layers.** A custom property `--span` on `#scene` and one rule:
   `.scene-inner > :is(.room-img, .night-veil, .stars, .sparkles) { width: calc(var(--span, 1) * 100%) }`. The plate
   keeps `object-fit: cover` at its own aspect; the veil, stars and sparkles cover the whole street at night. The night
   and sky rules themselves (opacity, filters, colours) are untouched; the veil's two soft glows stretch with it.
4. **room.js camera (three seams).** `camClamp`: `x` in `[W - W * span * z, 0]`, `y` unchanged. `camApply` writes the
   transform whenever it is not the identity (`z > 1` or `x`, `y` not 0), since at zoom 1 a wide plate still pans.
   A pan gesture may start when `z > 1` or `span > 1` (at zoom 1 only sideways moves pan; `touch-action: pan-y` stays,
   so a vertical drag still scrolls the page to the deck). The fit button on a wide plate zooms to 1 about her
   instead of jumping to the street's left end.
5. **ovu-camera.js.** `clamp`, `centreOn` and `target` take `span` (default 1, every existing caller and test keeps its
   meaning). Following is on when the view can move: `(z > 1.01 || span > 1)`, not held, not fitting. Reduced motion
   still opens at zoom 1 and steps the view once each time she comes to rest; on the street that step is sideways.
   `focus()` already measures her against the inner's rendered box, which in B gives 0 to 250 directly.
6. **ovu-walk.js.** The planner grid spans `ceil(100 * span / CELL)` columns (125 on the street, about 12,500 cells,
   a few ms per plan); the mask carries its own column count and `cellOf`, `cellFree`, `astar` and `plan` read it. The
   debug overlay's viewBox widens to `100 * span`. Speeds, doors, prop boxes and the walk cycle are unchanged.
7. **The mini-map.** A stop whose door is a long walk away (route cost over `FAR` = 60 iso units, about two and a half
   seconds at walking speed) fades straight there instead of making her cross the whole street first; a near door still walks
   then fades. The map is a shortcut; walking is for the street itself. The store sub-stops follow the same rule.
8. **Doors and entry points.** Unchanged in kind: the garden arch's stand point at the left end, the plaza arch's at the
   right end, three storefront tap doors (hours card when that store is shut, the two-storey interiors when open),
   `entryFor` picks the door back to where she came from. Arriving from the plaza she stands at the right end; the
   camera's `arrive` centres on her under the fade and the clamp holds the plate's right edge.
9. **Hours and sleep.** Unchanged: `OvuStreet.openNow(tab)` per store, `hoursCard`, `travel()` refusing interiors after
   hours and re-checking after the fade, nothing starting while she sleeps. No plaques on the street.

## Why not 3:1

Seedream 5.0 pro returns 2048 x 1024 inside the gateway's time limit; a denser 1472 x 1840 job has died at the cutoff,
and a 3:1 plate at the same pixel count would be 2508 x 836, too short to hold storefronts and a walkable street with
any detail. At 2:1 in a 0.8 box the street is 2.5 screens wide at zoom 1, which is where it opens (see below).

## Tests

- `tools/test-core.js`: every hotspot, door and the home spot on the wide street is walkable (`checkLayout`); a route
  exists from the street's home spot to every door and hotspot stand point (`plan`, grid 125 columns); the planner's
  route crosses x = 100 without stepping off the floor; camera maths with `span = 2.5`: the clamp's right edge is
  `W - 2.5 W z`, `centreOn` at either arch holds the plate edge, the target never leaves the clamp, and span 1 gives the
  old answers exactly.
- `tools/e2e_smoke.py`: on the street the box keeps its 0.8 aspect and the plate is 2.5 boxes wide; a walk from the
  garden arch toward the plaza moves the camera sideways and keeps her on screen; both arches are reachable and take her
  to the garden and the plaza; a storefront door still opens its interior and the door mat puts her back on its step.

## The plate as rendered

`street-wide-v1.webp`, Seedream 5.0 pro, seed 7311, 2048 x 1024, 72 s, first attempt (prompt in the art sidecar; front
three-quarter view, one long slab, shops along the back, open cobbles along the front). Read off a 5-unit grid in box
units. The slab's front edge runs on `y = 63 + 0.0964 (x - 15)` (perspective), the shopfronts sit on a parallel line, so
the floor polygon follows both with a margin. What the render decided:

- **Zoom 1, her size 12.** First built at zoom 1.25 with her drawn at 15.4 (her width times zoom matching the garden's
  12 x 1.6). While this was in review Jamie asked for every scene to open "always zoomed out fit to screen" (main,
  19 Oct), so the street opens at zoom 1 like the rest: the plate's full height in view, two and a half screens of street
  across, the camera following her sideways, and her standard width of 12 (about the height of a shop door, the same
  proportion as the other scenes). At zoom 1 the plate is drawn at 1.43 times its pixels on a 3x phone.
- **Feet held at 68 % down the box (`cam.sy`) once zoomed in** instead of 58 %: the street has empty lavender below the
  slab and roofs above, so holding her lower keeps the shopfronts whole. `centreOn` and `target` take the screen height
  as an optional last argument; every other layout keeps 58 %. At zoom 1 the view cannot move up or down, so it does not
  apply until the person zooms in with +.
- **The Cosy Nook has no door**, only its big lit window with the bench in front. Its doorstep is the cobbles in front of
  the bench (128, 68.2), its pin on the window.
- **Storefronts open where a walk ends.** On a street 2.5 screens long she passes doorsteps all the time, so a storefront
  door (a door with `tap`) no longer opens when a walk crosses it; it opens when a tapped walk ends on it or when keys
  stop there. Arches and gates still take her the moment she steps in. Routed hotspot walks (`quietDoors`) never stop at
  a door on the way.
- **The plaza arch's doorstep is inside the arch** (222, 73.6), right of its front pillar, and that pillar's solid reaches
  up the cobbles: the plate is flat, so anything standing behind the pillar would draw over it.

## Codex review (design, read-only, gpt-6-astra)

Verdict: proceed with changes. Outcomes:

| # | Finding | Outcome |
|---|---|---|
| 1 | blocker: a routed hotspot walk stops at any door on the way even with `quietDoors`, and `commit()` then treats the cut-short route as arrival and fires the callback | Fixed: the on-the-way door break skips `quietDoors` walks and storefronts; `routeEnded` is set only when the last point is reached, and `commit()` fires the callback only then |
| 2 | blocker: `#bubble` (her menu, the pet menus) stays in the transformed inner but is placed in box pixels | Fixed: lifted into the box with the other screen UI; `fitBubble()` in room.js keeps it inside the box when she stands tall on screen (it ran off the top at zoom before) |
| 3 | B is sound; keep the overflow visible on the inner, keep the wide plate hit-testable | Kept; floor taps past x 100 are tested with real viewport taps |
| 4 | keep `.zoomed` zoom-only; at zoom 1 claim only sideways drags; fit as recentre | Done: pan at zoom 1 starts only when the drag is mostly sideways; `.zoomed` unchanged; fit on a wide plate zooms to 1 about her |
| 5 | the pointer-down gesture guard and reduced-motion settle need span too | Done: the guard holds the loop on a wide plate at any zoom; `settle()` waits while a finger is down |
| 6 | `seatPlace()` uses the plate aspect, so the street bench sizes her wrong; duplicated return point | Fixed in ovu-garden.js (box aspect); the street bench uses one shared stand point (`OvuStreet.BENCH_WP`); smoke checks the seated width (10.5, not the clamped 7) |
| 7 | grid contract: span, allocation, blocked start, every index; pets use global columns | Done for the walk engine; pets keep their home and garden limit (span 1), unchanged |
| 8 | focus or `scrollIntoView` can scroll an `overflow: hidden` box | `.scene { overflow: clip }`, a scroll reset, and keyboard focus on an off-screen pin moves the camera to it (smoke) |
| 9 | 4680 x 2340 device pixels at zoom 1.6 on a 3x phone, 2.3x the image | Opens at zoom 1 (1.43x, 2925 x 1463 device pixels, about 16 MiB for one surface); + can still zoom to 3; profiling on a real phone is still to do |
| 10 | 60 iso units is a fair threshold; share one helper; fade when unreachable | `walkOrFade()` shared by both mini-map handlers, decided after committing a live walk; unreachable or far fades |
| 11 | pure maths cannot prove the DOM; independent route checks; real taps | Route segments are checked against the floor polygons directly, plus a wall beyond x 100; smoke taps the real viewport, checks the menu, focus, both arches, right-end entry, the night veil's width and the bench |

## Codex review (the diff, read-only, gpt-6-astra)

Verdict: ship with fixes. All five taken:

| # | Finding | Outcome |
|---|---|---|
| 1 | after a key walk she can stand on valid floor in a grid cell whose centre is off the floor or in a solid (198, 78 beside the plaza arch pillar); every route from there was null | `plan()` now starts from free cells she can reach in a straight line checked in true geometry (`startCells`, `segClear`); the old forced start cell is the fallback. Core test reproduces it (fails on the old planner, passes now) |
| 2 | from just left of the Nook's pot (108.04, 63.5) the first leg of a route clipped the pot, and the "independent" test only checked floor polygons | the first leg is pulled only as far as true geometry allows; the core route check samples the solids too (strict on the first leg, a 0.6 margin for grid-precision corner grazes in the middle). Reproduced and fixed |
| 3 | fit while she sits on the street bench reset the view to the left end (her figure is hidden, so no focus) | on a wide plate fit zooms to 1 about the box centre when she is hidden |
| 4 | fit was disabled at zoom 1 though the street still pans, so after a drag nothing brought the view back | fit stays on for a wide plate and resumes following; its label says "Zoom out and find her" there; smoke drags, then fits |
| 5 | a floor tap replacing a hotspot walk kept the hotspot's callback and door quiet, so the old action fired where she stopped | a floor tap or a key takeover drops the pending action and the door quiet; smoke taps Moonrise Homes then the floor |

Also from main while this was built: pets now walk with her into every scene. Their fallback placement (`floorStart` in
ovu-petwalk.js) read the grid without the mask's column count, which clamps at x 99 on the street; it now passes the mask.

Not covered: an iOS Safari device run and a 3x-phone memory profile (Chromium at 390 px, DPR 2 and 3, only).

## Foreground cutouts (19 October, evening)

The plate is flat, so anything drawn in it sits under her. Moving the plaza arch's doorstep inside the arch avoided the
common case, but walking past either arch or a lamp post still drew her over the pillar she was walking behind. Four
objects on the street can stand in front of her: the front pillar of each flower arch and the two lamps. (The back
pillars stand at the very back of the floor, so she is always in front of them; the trees, pots and bench sit where the
floor polygon keeps her in front or beside them.)

**What it is.** Each of the four is cut from `street-wide-v1.webp` by `tools/art/occluders.py` and saved at the plate's
own pixels (`street-occ-arch.webp`, `-lamp1`, `-lamp2`, `-arch2`, 51 KB together, WebP q94, mean colour difference
under 2 of 255 against the plate). `L.occluders` in ovu-street.js records each one's box-percent placement
(x, y, w, h, with x on the 0 to 250 scale), the solid it belongs to, and its `base`: the centre of the object's footprint
on the cobbles, read off the plate (garden arch 62, west lamp 61.9, east lamp 68.2, plaza arch 77). Each base lies inside
its solid.

**How it is cut.** GrabCut inside a hand outline, seeded with a hand core that is certainly the object. Above the
cobbles a flowered pillar stands against lavender sky, and GrabCut alone drops the cream buds on its edges (the cobbles
in the same crop teach it that cream is background), so above the floor line anything inside the outline that is not
lavender (hue 240 to 320 degrees, saturation over 0.05) joins the shape. The largest shape is kept, holes filled, eroded
2 px so the edge sits just inside the silhouette, and feathered 2 px. Each cut stops above the highest point her head
can reach behind it: she is 12 wide and 21.7 tall, so at the back of the floor behind the garden arch her head is at
y 36.3 and the cut starts at 30.9; behind the plaza arch 46.5 against 39.4. `--check dir` writes each cutout over
magenta, its edge on the plate, and a "she stands behind it" composite (a dark shape under the cutout: anything the cut
misses shows dark).

**How it draws.** `renderOcc()` in ovu-walk.js builds the layout's cutouts in `#plateOcc`, a layer of its own placed
just before `#ownedProps` with no position and no z-index, so it makes no stacking context and its children are ranked in
the same context as her and the pets. It is rebuilt only when the layout changes; a props render (pet care, a sky change)
leaves it alone. Each cutout is a `div.plate-occ` (left, top, width and height in box percent, `pointer-events: none`)
holding `img.occ-img` and `i.occ-veil`. `sprites()` ranks a cutout by `data-base` instead of its top edge and never counts
it as a solid, so the one `depthRank` that already orders her, the walking pet, neighbours and props orders the cutouts
too: her feet above a base, she draws behind it; below, in front. On the street that is seven items at most (four
cutouts, a walking pet, her, a bench sitter), so the 2 to 9 ranks never tie.

Lighting: the image joins the window patches in the plate's own filter lists (`:is(.room-img.day, .win-patch,
.occ-img)`) and the plate's transition rule (`:is(.room-img.day, .occ-img)`), so it dims and tints exactly as the plate
does, with or without reduced motion. The night veil paints under anything with a z, so a cutout needs its own copy:
`.occ-veil` shares the veil's rules (`:is(.night-veil, .occ-veil)` for its gradient, opacity and timing), is masked by the
sprite's own alpha, and carries a background size and offset that line its gradient up with the veil across the whole
street. No value in any night or sky rule changed. Layouts without `occluders` (every home, the garden, the plaza, the
stores) render nothing new.

Depth after the room's own moves: the walk engine re-ranks every frame of its own walks, but the room can also move her
itself (a reduced-motion step, the straight-line fallback, a door, a seat). `placeAvatar` now emits `placed`, the engine
re-ranks on it, and during the room's CSS slide it ranks her by her live computed `top` each frame. A pet re-ranks after
settling on the floor and after its bedtime hop home. Travel preloads the destination's cutouts with its plate; a missing
cutout only leaves the plate as it was.

**Tests.** `tools/test-core.js`: four cutouts on disk whose pixel size matches their box placement; each lines up with
its own solid (middle inside the cutout, base inside the footprint, the cutout reaching down past its base); her head
never rises above a cutout's top from any floor point behind it; at x 205, y 73 the plaza arch outranks her and at y 79
she outranks it; a pet passes behind the east lamp just above its base; no ties; no other layout has cutouts; the cut
script and the layout agree on ids, files, solids and bases. `tools/e2e_smoke.py`: on the street the four cutouts load, sit at their box placement within a pixel in an unstacked
layer, and a tap on a lamp reaches the plate beneath; placed at (205, 73) she is behind the plaza pillar and at (205, 79)
in front, re-ranked by the placement alone; the same on cobbles she can really stand on, (212.6, 71.2) and (212.8, 77.6);
behind the west lamp at (79.5, 61.2); a sky change with a props render keeps the same nodes, their filter mid-transition
with the plate's; with reduced motion their transitions equal the plate's and the veil's; at night a screenshot of the
west lamp with the cutouts equals one with them hidden (mean difference under 3 of 255, decoded with a stdlib PNG
reader); the garden draws none.

## Codex review (the cutouts, read-only, gpt-6-astra)

Verdict: ship with fixes. All taken:

| # | Finding | Outcome |
|---|---|---|
| 1 | a pet settling on the floor can cross a lamp's base without a re-sort | `W.sortDepth()` after the settle and after the bedtime hop home |
| 2 | the night veil paints under positive-z cutouts, so matching filters still leaves them unveiled at night | each cutout carries the veil masked to its own alpha, aligned to the street-wide veil; smoke compares rendered pixels at night |
| 3 | a sky change re-renders props, which recreated the cutouts at the destination filter while the plate transitioned | the cutouts moved to `#plateOcc`, rebuilt only on a layout change; smoke samples the filter mid-transition |
| 4 | under reduced motion the plate's more specific `.room-img.day` transition survives while the cutouts snapped | the image shares that rule instead of a reduced-motion override; smoke compares the transitions with reduced motion |
| 5 | travel preloads only the plate, so the street could appear before its cutouts | round one preloaded them (resolving on error or a timeout, never decoding); open after round two, then fixed as decided below |
| 6 | (205, 73) and (205, 79) lie inside the pillar's solid; tests feed `depthRank` synthetic values | the task's two points stay, and smoke adds two reachable spots; the pet settle path itself is not driven by a test yet |

Also found here: moves the room makes itself (reduced motion, the CSS fallback) never re-ranked her; fixed with the
`placed` event and live ranking during the CSS slide.

Round two (the fix diff): findings 1 to 4 closed (pet settle re-ranks, the masked veil lines up with the street veil and
the unmaskable fallback keeps an unveiled cutout rather than a dark box, `#plateOcc` survives props renders, both
transitions match under reduced motion). New: `W.sortDepth()` from a pet's frame during the room's CSS slide ranked her
by her destination; fixed by `herY()` (the engine's position while it walks, her live computed top during a CSS slide,
else where she stands), with a smoke check that fails without it.

**Gate 6 and the decision.** Finding 5 was still open after round two (travel could reveal the street before a cutout
had decoded), which is AGENTS gate 6. The decision, relayed by the session that leads this family (not by Jamie
directly): wait for the cutouts under the existing fade, capped at about 1.5 s. Done: one kept image element per cutout
file (`occImg`, so the bitmap travel waited for is the one drawn; a failed file is dropped and asked for again next
visit), `occReady` resolves true once loaded and decoded and false on failure, and `travel()` waits for
`Promise.all([plate, occWait(T)])`, where `occWait` races the cutouts against `OCC_CAP` (1500 ms) from the start of the
fade. Smoke, each in a fresh context with the service worker blocked: sprites 0.7 s late, the fade lifts after them
with all four decoded; sprites failing, it lifts at once; sprites hung for 4 s, it lifts at the cap and they draw when
they arrive. Without the wait the first and third fail. The real pet settle path is still not driven by a test.

**Round three (the decode wait, read-only): changes needed, finding 5 not fully closed.** Held again at gate 6.
Four edge cases, none a deadlock: (1) a sprite that fails during the wait is dropped from the cache, so `renderOcc`
makes a new request at once and the cutout can pop in after the fade instead of waiting for the next visit; (2) a
rejected `decode()` with a non-zero `naturalWidth` counts as ready and is not retried; (3) while a request hangs, each
capped wait adds a load and an error listener that stay until it settles; (4) the smoke cases do not prove decoding
(only `complete` and size), and their 2600 ms upper bound would accept a 2.5 s cap.

Jamie's decision: do the four small fixes, rerun the gates and push without another review. Done: each image element
carries one readiness promise made with its own listeners (`occReady` on the element), so waits on a hung request add
nothing; a decode rejection counts as failure; a failed element stays in the layer, drawing nothing, until the next
visit's wait asks for the file again, so no request starts behind the fade. Smoke: the hung case's upper bound is
2.2 s, and a new case fails each file's first request and serves the rest after 0.7 s: the failed element is still the
one in the layer 1.5 s later, and the next visit makes a fresh request and waits for it (the previous code popped the
cutout in behind the fade and did not wait on the next visit). Decoding itself is still not observable from the page;
`complete` and size stand in for it.
