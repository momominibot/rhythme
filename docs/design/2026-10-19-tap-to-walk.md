# Tap to walk (19 October 2026)

Jamie, on the live site with the joystick: "the toggle to walk the avatar doesn't work very well, maybe remove the toggle,
we click on the floor to move", and asked how 2D and 3D games do this. This page is the research pass and the plan.

## What games do, from the sources

1. **Point-and-click suits isometric views.** A Godot 4 devlog on an isometric point-and-click project argues that
   isometric tiles are skewed, which makes collision masks awkward even with y-sorting, so the author bakes a navigation
   region from the walkable area with static bodies as obstacles and gives the character a navigation agent
   ([Katana Kitsune devlog](https://9lives-k9.itch.io/katana-kitsune/devlog/747247/point-click-isometric-project-early-access)).
   The Tuts+ isometric primer keeps walkability per tile (each tile fully walkable or fully blocked), converts a screen
   click to tile coordinates, checks the tile before moving, and sorts characters by their y (and x) position, re-sorting
   whenever something moves ([Creating Isometric Worlds](https://code.tutsplus.com/creating-isometric-worlds-a-primer-for-game-developers--gamedev-6511t)).
2. **A grid is the simplest honest floor mask; its paths need smoothing.** Amit Patel's map representation notes: grids
   are simple and handle fine cost variation, but use many nodes, give jagged paths that must be post-processed, and fit
   less well when units are not restricted to the grid; navmeshes and visibility graphs let units move in straight lines
   between navigation points; small maps leave room for simple representations
   ([Map representations](https://theory.stanford.edu/~amitp/GameProgramming/MapRepresentations.html)).
3. **A\* on that grid.** A\* works on any graph; it finds an optimal path as long as the heuristic never overestimates;
   stop when the goal is dequeued, not enqueued; diagonal steps are just a costlier move
   ([Introduction to A\*](https://www.redblobgames.com/pathfinding/a-star/introduction.html)). Theta\* lets a vertex's
   parent be any vertex so paths are not limited to grid edges, giving "short and realistic looking paths", though not
   guaranteed shortest ([Nash, Daniel, Koenig, Felner](https://arxiv.org/abs/1401.3843)).
4. **String pulling.** Mononen's simple stupid funnel algorithm takes an ordered list of portals and returns the corner
   points of the straight path; he notes it assumes the corridor is already adjusted for the agent's radius, that it
   should stay fast because it is recomputed during path following, and that bad corridors are better fixed at the
   source ([Simple Stupid Funnel Algorithm](http://digestingduck.blogspot.com/2010/03/simple-stupid-funnel-algorithm.html)).
   A greedy line-of-sight string pull on a grid path is the common simpler form (Granberg's A\* project documents a grid
   string-pulling class as "conceptually similar" to funnel pulling; a 2021 SoCS paper improves on the greedy version)
   ([Grid string pulling](https://arongranberg.com/astar/documentation/stable/gridstringpulling.html),
   [Toward a String-Pulling Approach to Path Smoothing on Grid Graphs](https://ojs.aaai.org/index.php/SOCS/article/view/18541)).
5. **Feedback timing.** Nielsen's limits: feedback within 0.1 s feels instantaneous, within 1 s the train of thought is
   unbroken ([Response Times: The 3 Important Limits](https://www.nngroup.com/articles/response-times-3-important-limits/)).
   So the ring must appear on the tap itself, before the first step, and the first step must start within the same frame.
6. **Click markers in point-and-click engines** are usually a timed marker at the destination (Adventure Creator's click
   marker has a lifetime setting; developers also ask for it to vanish on arrival)
   ([Adventure Creator ClickMarker](https://adventurecreator.org/scripting-guide/class_a_c_1_1_click_marker.html),
   [forum](https://adventurecreator.org/forum/discussion/comment/45088/)). No standard for the ring's size exists in the
   sources; we use a thumb-sized ring (about 36 px) that scales up and fades over 600 ms, and goes solid-colour-only
   under reduced motion.

## The plan for Rhythme

- **Floor mask.** Each plate already carries `zones` (floor polygons), `solids` (furniture boxes) and the pets' and
  props' feet boxes, read off the plate on a 5 % grid and checked by the core suite. The tap-to-walk mask is that geometry
  rasterised at plan time into cells 2 % of plate width wide and 1 % of plate height tall (one row step costs the same
  walking time as one column step, since the floor is foreshortened by `Y_SCALE` 0.5), about 5,000 cells per plate.
- **Planning.** 8-neighbour A\* with the octile heuristic, corner cutting forbidden, early exit when the goal is dequeued.
  If the tapped cell is blocked (furniture, a wall, a pet) the goal snaps to the nearest free cell within a small radius,
  so a tap on the bed walks up to the bed. A start inside furniture (a hotspot walk can end there) is allowed, as the
  joystick did. The cell path is string-pulled greedily by line of sight against the same mask, and the exact tapped point
  replaces the last cell centre.
- **Walking.** The polyline is followed in the existing requestAnimationFrame loop at the joystick's speed (26 % of plate
  width per second in iso units), with an ease-out over the final 6 %; the avatar flips by leg direction and reuses the
  hop keyframes; position is committed once through `placeAvatar` at the end, as before. A new tap re-plans from the live
  position. Keys still work on desktop and take over from a route.
- **Reading the tap.** A `click` on the scene that did not land on anything interactive (hotspots, props, pets, chips,
  controls, the avatar) and was not swallowed by the camera's gesture suppression is a floor tap; its point is read from
  `#sceneInner`'s bounding rectangle, which already reflects the camera zoom. A second tap within 350 ms on the same spot
  is ignored so the scene's double-tap zoom does not start a second walk.
- **Doors and props coexist.** Walking into a door trigger travels as before. Tapping a hotspot keeps the room's own
  straight-line walk exactly as before. Tapping a shop prop or a neighbour walks there and acts, as already built.
- **Removed.** The on-screen joystick and its CSS. The mini-map stays.
- **Untouched.** Outfits (nothing here changes the outfit; the only outfit call is `restorePose`, which puts back the saved
  one after the watering pose), the night and sky rules, `#welcome` and `#consent`, `ovu-rewards.js`, `ovu-podcast.js`,
  the Listen section. The ring is a `div`, not an `img`, so the Safari quirk of an `<img>` keeping a removed `src` does not
  apply; where an image must be cleared, use a blank data URI.

## What the Codex read-only opinion changed (19 Oct, against this page and the engine)

- **Reachability, not just free points.** Codex reproduced that on the street the home spot could not reach the showroom
  or the plaza doorway on a fine grid: the tree canopy box plus a flower pot sealed the right half. The core suite now
  plans from each layout's home spot to every door and hotspot stand point and fails if a route is missing or leaves
  the floor; three boxes (the garden can and pond edge, the street tree and pot, the plaza gate) were trimmed to what the
  plate shows, and the plaza's second bench stand point moved to its open end.
- **One owner for movement.** The room's own walk legs now announce themselves (`beforeWalk`), so a floor walk in progress
  commits its live position before a hotspot walk starts from it; `goHome` asks the walk engine whether she is walking
  or travelling before taking her back to the home spot 1.4 s after a sheet closes, and a floor tap cancels that timer.
- **Endpoints.** A blocked tap snaps to the nearest free cell that A\* can actually reach (pockets are skipped for the next
  candidate); a blocked start may cross the piece she stands in and nothing else, instead of ignoring every solid.
- **Doors and double taps.** Doors are checked after every consumed leg, not only at the frame's end; the browser's own
  click count (`detail > 1`) rejects the second click of a double tap before the Safari time-and-distance guard.
- **Kept as proposed, with Codex's agreement:** grid A\* with greedy line-of-sight pulling over a visibility graph or
  waypoints; reading taps from `#sceneInner`'s bounding rectangle so zoom, pan and scroll are covered; `touch-action`
  untouched; the ring as a `div`; the hop keyframes, depth sorting and single `placeAvatar` commit; hotspot walks, the
  outfit, the night and sky rules, welcome and consent, rewards, podcasts and Listen untouched. Codex suggested 1 % cells;
  2 % by 1 % cells plan in about 2 ms and pass the corridor tests, so they stay, with the finer grid as the fallback.

## Tests

- `tools/test-core.js`: rasterise a diamond with a wall and plan around it (every point of the path free, fewer corners
  after string pulling than cells), snap a blocked target to the nearest free cell, refuse an unreachable target, no corner
  cutting through touching boxes, and in every real layout a plan from the home spot to each door stand point exists and
  stays on the floor.
- `tools/e2e_smoke.py`: tapping empty floor in the room walks the avatar there (position changes, a ring appears), the
  walk pad is gone, a tap on the bed hotspot still opens the bedtime sheet, a floor tap in the garden works, and no console
  errors.

## A real walk cycle instead of a hop (19 Oct, Jamie: "Can the avatar walk normally instead of hopping?")

What the sources say:

- **Eight frames is the standard basic walk.** Adobe's walk-cycle guide says the standard number of frames is eight, more
  for a brisker pace ([Adobe: animation walk cycle](https://www.adobe.com/uk/creativecloud/animation/discover/animation-walk-cycle.html)).
  Cornell's game design lab lists the four poses, contact, recoil, passing and high point, so a two-legged character needs
  at least eight images (four per leg); draw the key poses first, keep every frame the same size, draw a ground line so
  the feet step at the same height, and make the loop seamless ([Cornell CS 3152 design lab](https://www.cs.cornell.edu/courses/cs3152/2025sp/labs/design3)).
- **Timing in a web game engine.** Phaser 3 registers an animation per key with a frame range and a `frameRate`; its
  examples use 10 fps for a walk and 15 fps for a run, `repeat: -1` to loop, and `timeScale` to speed playback up or down
  ([Phaser 3 animation docs](https://tessl.io/registry/tessl/npm-phaser/3.90.0/files/docs/animation.md)). Directional
  walks are separate animation keys chosen from the velocity; the docs do not show that part, so it is practice, not doc.
- **Direction sets.** Isometric sprite packs ship four or eight directions with a standstill per direction, and name the
  directions relative to the screen, since isometric north is not screen up
  ([OpenGameArt isometric walking sprite](https://opengameart.org/content/isometric-walking-sprite),
  [8-direction walk cycle template](https://ordinary-bumblebee.itch.io/8-direction-walk-cycle)). Mirroring the side view
  for the other side is common practice; the sources do not settle it, so it is checked by eye here.

How Rhythme does it:

- **Sheets from the model, one image per direction so frames stay consistent.** `tools/art/gen.py` with the standing
  sprite composited on chroma green as the reference: "exactly 8 frames in a single horizontal row, evenly spaced, feet on
  the same ground line, SIDE VIEW facing RIGHT / walking AWAY seen from BEHIND / walking TOWARDS seen from the FRONT",
  2048x1024, about 40 s each. One sheet per outfit and direction, so her outfit never changes to get a walk.
- **Slicing** (`tools/art/walkcycle.py`): frames are runs of non-green columns (a touching pair is split at its thinnest
  column), each keyed with the same matte and despill as the props, scaled so the figure is as tall as the standing
  sprite's figure, feet on the strip's bottom edge, head centre on the frame's centre so she neither bobs sideways nor
  slides; a labelled contact sheet is written for a look.
- **Playback** (`ovu-walk.js`): a strip element inside the avatar shows one frame by translating the strip image
  (transform only); the standing sprite is hidden while she moves and shown again when she stops; frames step at 10 per
  second scaled by the walk's ease, only while moving; the strip is chosen from the movement direction (mostly vertical:
  away or towards, otherwise side, mirrored by the existing flip); the room's own hotspot walks play the cycle too,
  from the position noted at `beforeWalk` to the destination. A missing strip falls back to the side strip, then to the
  step bob. Reduced motion keeps the standing sprite.
