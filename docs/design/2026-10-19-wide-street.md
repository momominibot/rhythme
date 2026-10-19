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
any detail. At 2:1 in a 0.8 box the street is 2.5 screens wide at zoom 1. The zoom it opens at is picked from the render
so that she stands as tall on screen as she does in the garden, without blowing the plate up past about 1.8 times its
pixels on a 3x phone.

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

- **Zoom 1.25, her size 15.4.** At 1.25 the plate is drawn at 1.8 times its pixels on a 3x phone (Codex measured 2.3 at
  1.6). Her width times zoom matches the garden's (12 x 1.6), so she is the same size on screen in both; she stands about
  1.3 times the height of a shop door, the same chibi proportion as the other scenes.
- **Feet held at 68 % down the box (`cam.sy`)** instead of 58 %: the street has empty lavender below the slab and roofs
  above, so holding her lower keeps the shopfronts whole. `centreOn` and `target` take the screen height as an optional
  last argument; every other layout keeps 58 %.
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
| 9 | 4680 x 2340 device pixels at zoom 1.6 on a 3x phone, 2.3x the image | Opens at 1.25 instead (1.8x, about 26 MiB for one surface); profiling on a real phone is still to do |
| 10 | 60 iso units is a fair threshold; share one helper; fade when unreachable | `walkOrFade()` shared by both mini-map handlers, decided after committing a live walk; unreachable or far fades |
| 11 | pure maths cannot prove the DOM; independent route checks; real taps | Route segments are checked against the floor polygons directly, plus a wall beyond x 100; smoke taps the real viewport, checks the menu, focus, both arches, right-end entry, the night veil's width and the bench |

Not covered: an iOS Safari device run and a 3x-phone memory profile (Chromium at 390 px, DPR 2 and 3, only).
