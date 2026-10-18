# Garden, community plaza and walking like a game (18 October 2026)

Jamie's words: "build a garden and community area at the same time. you see how we want to map it, can the avatar walk like game?"

## Scenes and the map between them

Three places, one engine. The room (or the house you moved into) stays the home; two new outdoor plates join it.

```
  [home: room / house / bath house / family home] <-gate-> [garden] <-arch-> [Dream Street] <-arch-> [plaza]
                     ^                                                                                  |
                     +---------------------------------- home gate --------------------------------------+
```

Dream Street was added on Jamie's request mid-build (via the parent session): the pet shop, furniture store and property showroom that `openShop('pet'|'furniture'|'home')` already draws in room.js stand as buildings on a cobbled street (`street-v1.webp`). Walking up to a storefront door, or tapping it, opens that store's sheet; closing the sheet leaves the avatar outside that door. The mini-map has four stops.

- **Home.** Every home layout gains one `door` hotspot (a gate marker on the open front edge of the slab, or the real front door in the house). Tapping it walks the avatar there and fades out to the garden. Nothing else in the homes changes.
- **Garden** (`garden-v1.webp`, portrait 1472x1840 like the room). Cream path, flower beds, a bench under a tree, a round pond, a little greenhouse, a lilac gate back home and an arch on to Dream Street, and an empty raised bed (the plot) with a watering can. Interactions: **water the plants** (a mindful minute, captions in the HUD, the watering-can pose sprite; saves one minute of calm, 2 hearts), **sit on the bench** (breathing with Erin through the existing `enterMeditation` + `runSession`, or the breathing orb with its soft bell; the meditator sprite sits on the bench), **the plot** (grows a stage for every day with any log or a watering; a missed day adds nothing and takes nothing away; stages are an inline SVG plant in the brand palette, so no sprite is keyed).
- **Plaza** (`plaza-v1.webp`). A fountain, strings of lanterns, a noticeboard, a tea stall, two benches, the arch back to Dream Street and a gate home. Interactions: **noticeboard** (a gentle prompt for today chosen by date, plus sample notes marked as samples), **tea stall** (a cup for your phase from `OvuHerbs.forPhase`), **benches** (sit, with the breathing orb), **fountain** (a small wish moment, no hearts), **neighbours** (tap: say hello, or visit).
- **Neighbours' homes.** `OvuCommunity.neighbours()` returns four sample neighbours (name, outfit sprite, pet, home layout, spot in the plaza, a line). Visiting applies that home layout as a read-only visit: hotspots are inert, the neighbour and her pet stand in, your own props are not drawn, and the visit bar says it is a sample until friends can join; Back returns to the plaza.

Only scene changes use a 350 ms lavender fade over the scene; the avatar appears at the door of the new scene.

## What the Codex review changed (18 Oct, read-only review of this page against room.js)

- `boot()` was not one-shot: the plate image kept its `load` listener, so every `applyLayout` on an uncached first load rebooted the room. Fixed with `{ once: true }` and a guard; `OvuRoom.on('boot')` fires immediately once booted so late modules never miss it.
- One owner for movement: the walk module keeps live coordinates apart from the resting `left/top`, commits once through `placeAvatar` with the transition suppressed, refuses to start during a tap walk, and yields without writing back if anything else moved the avatar (compared against the anchor each frame). A hotspot tap while walking commits first.
- `busy()` is defined in room.js over `current`, sleeping, meditating, session, practice, arranging, a prop drag, the welcome, consent and loading overlays; it is rechecked every frame and held keys are dropped when it turns true.
- Frames are cut into 20 ms substeps so a long frame cannot jump a wall; hidden tabs commit and reset timing.
- Depth is rank-based and packed into z 2..9 (never above pins or HUD); the arrange-mode `.lift` keeps 12 with `!important`.
- Travel is a single in-flight transaction: input cleared, the destination plate decoded before the fade lifts, the arrival door armed so you must leave it before it fires again, `home` resolved through `currentHomeId()`, and a sheet opening during the approach cancels the pending door.
- Personal actions (bed, wardrobe, mat, clock, calendar, diary, computer, coach, bath, fridge, sofa) outdoors or in a neighbour's home travel home first and then tap there, instead of dereferencing a missing hotspot.
- Neighbour visits are their own mode (`scene.nbvisit`): your props are never drawn, pets do not tick (`only: []`), hotspots are inert, the visit bar is replaced, and any other layout change ends the visit.
- Watering: one completion path, one saved entry and one award, and only the first watering of a day earns the 2 hearts of a one-minute calm entry; later waterings that day are welcome but unrewarded.
- Plot growth: a persisted set of credited dates (every diary date not in the future plus watering days) so a day counts once and deleting an entry never shrinks the plant.
- Export: `state.garden` and `state.community` ride along with `exportJSON` and the replace import; the merge import still merges events and profile only, so garden progress is not merged from a second device yet.

## Walk model

- Positions stay in percent of the plate, as the room already does. Each layout carries `zones` (one or more convex polygons the feet may be in: the floor diamond, and for the houses a downstairs polygon, an upstairs polygon and a stair strip), `solids` (axis-aligned boxes for furniture baked into the plate: bed, desk, wardrobe, table, beds, pond, stall) and `doors` (a target scene, a stand point and a trigger radius). Owned props and pets add a small box at their feet, rebuilt whenever props re-render.
- Input: an on-screen joystick (bottom-left of the scene, touch and mouse, pointer capture, `touch-action: none`, stops the camera gesture from starting) plus WASD and arrow keys. Keys are ignored while a sheet is open, while typing, while asleep, meditating, practising or arranging.
- A `requestAnimationFrame` loop runs only while there is input. Each frame moves the feet by speed x dt (y is foreshortened to 0.62 of x so the walk feels isometric), tries the full move, then x alone, then y alone (sliding along walls), and rejects any point outside every zone or inside a solid. Movement is transform-only: the avatar keeps its last rest `left/top` and walks with `translate3d` in pixels; when the input stops the position is committed once through `placeAvatar` with the transition suppressed, so the existing hotspot walk (`walkTo`) keeps working unchanged.
- Walking reuses the existing hop keyframes (`.walking`) and flips with direction; no new rig. Reduced motion: no hop, the avatar still moves.
- Depth: avatar, owned props, pets and neighbours get `z-index = 2 + floor(y/12)`, so things lower on the plate draw in front and nothing rises above the hotspot pins (10) or the HUD (11).
- Doors: entering a door's trigger radius under joystick or key control fades to the next scene; tapping the door hotspot walks there first (the room's own `tap`) and then fades.
- Mini-map: a chip of four icons (home, garden, street, plaza) at the bottom-right of the scene; the current one is lit; tapping another travels there (walks to the door, then fades). Hidden while a sheet, the HUD, night sleep or arranging is on.

## Hooks in room.js (kept minimal)

`window.OvuRoom` exposes what already exists: `LAYOUTS`, `applyLayout`, `buildHotspots`, `placeAvatar`, `walkTo`, `tap`, `hotspot`, `openSheet`, `closeSheet`, `toast`, `chime`, `esc`, `afterSave`, `enterMeditation`, `runSession`, `setPose`, `restorePose`, `caption`, `renderProps`, `propPosFor`, `isNight`, element refs, `pos()`, `layout()`, `visiting()`, `busy()`, an `on(event)` bus with `layout`, `props` and `boot`, a `hotspotHandlers` map consulted first in `openSheetFor`, and a `hudStop` slot. Plus a `only` filter on layouts so the garden shows pets only and the plaza none of your props, and `.joy,.minimap,.nb` added to the camera's interactive list. New code lives in `ovu-walk.js`, `ovu-garden.js`, `ovu-street.js`, `ovu-community.js` and one marked block at the end of `room.css`. `OvuWalk.debug(true)` draws zones, solids, door triggers and stand points over the plate for tuning.

## Stubbed until accounts land

- Neighbours, their homes, their pets and the noticeboard notes are samples generated locally; `OvuCommunity.neighbours()` is the single seam where real friends plug in.
- Visiting is read-only and nothing is sent anywhere; no presence, no chat, no shared plots.
- The plot and watering days live in `state.garden` in the local store, so they export and sync with everything else once cloud backup exists.
- The scene you are in is not persisted: a reload always starts at home.

## Tests

- `tools/test-core.js`: `OvuWalk` zone containment, sliding, substeps against a thin wall, walking out of furniture, door ellipses, depth rank; every layout's home, waypoints, doors and stairs checked walkable (the home layouts are lifted from room.js source); the scene map and entry points; `OvuGarden` stages, credited dates, watering once a day, no shrink after deletion, the 2-heart rule; `OvuCommunity.neighbours()` shape, floor placement and the daily prompt.
- `tools/e2e_smoke.py`: the door walks her into the garden, a joystick drag and the arrow key move her, the mini-map reaches Dream Street and the plaza, the pet shop door opens the pet store, the noticeboard shows today's prompt, Mei's home opens read-only and Back returns, home again, and no console errors.
