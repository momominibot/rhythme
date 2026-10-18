# A camera that follows her (19 October 2026)

Jamie, after the walk cycle shipped: "Since now we have walking capability of the avatar shall we have bigger space to
walk? We will follow the screen as the avatar walks so it's not just within the small space fixed in mobile. It will be
like a game." This page is the research pass and the plan. The reading taken: the space feels small because the whole
plate is squeezed into a 390 px phone box; a game shows a window onto the world and moves that window with the
character. So the first step is a camera that follows her, with every scene seen closer; a longer world (wider plates)
is the step after, noted at the end.

## What games do, from the sources

1. **Position locking, camera window, lerp smoothing.** Itay Keren's survey of 2D cameras names the basic moves: the
   camera locked to the player's position; a *camera window* that moves only when the player pushes against its edge
   (originally a cost saving, still used to avoid unnecessary movement); and *lerp smoothing*, where the camera
   continuously closes the distance to its target by linear interpolation, which he calls "probably the most effective
   and ubiquitous smoothing technique", with the caveat that a large fast character "can easily hit the edges of screen
   before the camera can catch up". *Edge snapping* sets a hard edge for the camera at the level's edge. *Manual
   control* lets the player adjust the camera directly. His general advice: "Avoid sudden camera speed and direction
   changes", since conflicting visual and vestibular signals "may lead to discomfort and nausea"
   ([Scroll Back](https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers)).
2. **Phaser's follow camera.** `startFollow(target, roundPixels, lerpX, lerpY, offsetX, offsetY)`: "The closer the value
   to 1, the faster the camera will track"; 1 snaps, "A value of zero will disable tracking on that axis". A
   *deadzone* rectangle is "re-positioned every frame so that it is centered on the mid-point" of the camera; while the
   target is inside it the camera does not scroll, once it leaves "the camera will begin scrolling in order to follow
   it", and the lerp values "also apply when using a deadzone". The follow offset is subtracted from the target's
   position; rounding to whole pixels "can still be broken if you have specified a non-integer zoom"
   ([Phaser 3 Camera](https://docs.phaser.io/api-documentation/3.88.2/class/cameras-scene2d-camera)).
3. **Godot's Camera2D.** Position smoothing (off by default, speed 5) makes "the camera's view smoothly move towards its
   target position"; drag margins (0.2 of the screen each side, off by default) mean "the camera only moves when
   reaching the" margin; limits are hard edges where "The camera stops moving when reaching this value", and
   `limit_smoothed` makes it stop smoothly at them; `align()` snaps the camera onto the tracked node
   ([Godot Camera2D](https://docs.godotengine.org/en/stable/classes/class_camera2d.html)).
4. **Cinemachine's Position Composer.** A *dead zone* where the camera "will not adjust when the target is within this
   range of the Screen Position"; a *soft zone* around it where the camera moves the target back into the dead zone at a
   speed set by *damping* (small values respond quickly, large values feel like a heavier camera); *Screen Position*
   says where on screen the target is held; *Center On Activate* moves the camera to centre the target when the camera
   becomes live; *lookahead* predicts the target's position but "is sensitive to noisy animation and can amplify the
   noise" ([Cinemachine Position Composer](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/CinemachinePositionComposer.html)).

## The plan for Rhythme

- **The camera already exists.** `#sceneInner` carries `translate(x, y) scale(z)` with origin 0 0, clamped so the plate
  never leaves the `#scene` box; pinch, drag, double tap, trackpad pinch and the + / − / fit buttons drive it; floor
  taps and hotspots already read positions through the transformed rectangle, so nothing in walking, tapping or props
  needs to know a camera is moving. The follow camera only *drives* this transform.
- **A window onto the world.** Each layout has a default zoom: the home scenes keep the whole room in view (zoom 1, as
  today, so every hotspot stays a tap away), the garden, the street, the plaza and the store interiors open at 1.6
  (the view shows 62 % of the plate across and down, she stands about 1.6 times taller on screen). One number per
  layout, `cam.z`, overridable in the layout. Pressing fit shows the whole scene; pressing + from there brings the
  window back around her.
- **Following.** Her feet are the target, held at a *screen position* of 50 % across and 58 % down the box (head room
  above, since her sprite stands up from her feet). A *dead zone* of ±6 % of the box width and ±5 % of its height means
  turning to tap a nearby thing moves nothing; once she pushes past it the camera's target shifts by the overshoot and
  the camera closes on that target with exponential smoothing, time constant 0.16 s, which is Keren's lerp made
  frame-rate independent (`k = 1 − e^(−dt/τ)`). The target is clamped to the plate edges before smoothing, so near an
  edge the camera stops and she walks on towards it (Godot's limits, Keren's edge snapping). No lookahead: her routes
  turn at string-pulled corners and the prediction would jitter, as the Cinemachine page warns.
- **One source of her position.** Each frame reads her feet from the avatar's own rectangle relative to the plate's,
  which covers the walk engine's per-frame transform, the room's own CSS walks to hotspots and stairs, and any jump
  (sitting down, arriving through a door). The loop runs only while the box is zoomed and stops itself 0.6 s after
  she and the camera come to rest; it wakes on any change to the avatar's class or style, a pointer down on the scene,
  a key, a layout change, a resize or a camera button.
- **The person wins.** A drag, a pinch or a double tap is manual control: the camera holds where they left it until her
  next walk (a floor tap, a hotspot walk, a key), when it eases back onto her. The + and − buttons zoom about her, not
  the box centre, and keep following. Fit sets zoom 1 (nothing to follow). Entering a scene snaps the camera onto her
  at the layout's zoom under the fade, like Cinemachine's centre-on-activate and Phaser's advice to set the scroll
  before following so there is no visible jump.
- **Reduced motion.** No per-frame camera motion: the camera moves once, with the existing 0.35 s eased transition,
  each time she comes to rest.
- **Files.** New `ovu-camera.js` (the follow loop, the zoom per layout, the hold rule, the pure maths exported for
  tests) loaded last. `room.js` gains four small seams only: read the camera state, set it, a focus point hook for the
  + / − buttons, and a `cam` event when a person pans, pinches, double taps, zooms or fits. A new marked CSS block if
  anything needs styling. Untouched: outfits, the night and sky rules, `#welcome` and `#consent`, `ovu-rewards.js`,
  `ovu-podcast.js`, the Listen section, the walk engine's planning, the hotspots.
- **Not yet: longer plates.** A street or park two or three screens wide (a 2:1 or 3:1 plate, the inner wider than the
  box, the same percent coordinates) is the natural next step once the camera works; it needs new art and new floors,
  so it is proposed separately rather than folded in here.

## Tests

- `tools/test-core.js`: the camera target for a focus point is clamped to the plate at every edge and is (0, 0) at zoom
  1; a focus inside the dead zone leaves the target unchanged and one outside shifts it by the overshoot only; the
  smoothing is frame-rate independent (two half steps land where one full step lands, within 1e-6) and never overshoots;
  the default zoom is 1 for the home layouts and 1.6 for the garden, street, plaza and stores; a layout's own `cam.z`
  wins.
- `tools/e2e_smoke.py`: the room opens at zoom 1 with no transform; the garden opens zoomed with her inside the window;
  a floor tap across the lawn moves the camera and she stays inside the window on arrival; fit clears the transform;
  + brings the window back around her; a drag holds the camera until the next floor tap; no console errors.

## What the Codex read-only opinion changed (19 Oct, against this page and the code)

- **The HUD lived inside the plate.** Codex pointed out that the session HUD with its Stop button, the visit bar's Back,
  the top bar, the phase chip, the greeting and the hint are children of `#sceneInner`, so any zoom would scale and crop
  them; a z-index cannot escape the box's clipping. The camera module now lifts those six nodes into the box at mount
  (same offsets, same boxes at zoom 1, never cropped at zoom); the smoke suite starts a watering minute at zoom and
  checks the Stop button is on screen and stops it.
- **An explicit walk signal.** Instead of inferring a new walk from the avatar's class changes (which fire for every
  stair leg, pose and retarget), the walk engine now announces an accepted walk (`walk`: a floor tap, a key, a retarget)
  and the room's own legs still announce `beforeWalk`; only those release a manual hold. A finger down on a zoomed scene
  freezes the loop until it lifts, so a pan never starts from a stale origin.
- **Snap after the final placement.** Travel places her at the entry point after the layout event; the camera now snaps
  once more on the `scene` event, synchronously, before the fade lifts, as well as during a short snap window.
- **Reduced motion opens fitted.** No eased flights either: if the person zooms in by hand the view steps once,
  unanimated, each time she comes to rest.
- **Arranging fits the room.** Prop dragging measures by the untransformed box, so the camera fits and holds while the
  person arranges, and returns afterwards.
- **Sleep and hours on every opener.** Codex listed the entry points; every sheet opener and action in the scene modules
  now refuses while she sleeps in the room's own words (plot, watering, bench, sitting, pond, greenhouse, store cards and
  shelf taps, neighbours, board, stall, fountain, and every travel), travel re-checks sleep and the shutters after its
  fade delay and backs out cleanly, and the garden's "tap to get up" ignores the click the camera swallowed after a drag.
- **Kept, with Codex's agreement:** the dead-zone target is a fixed point (it does not depend on where the camera is,
  only on its zoom), so smoothing cannot pile corrections up; at a plate edge the clamped target is the rest state and
  the loop sleeps there without centring her; home stays at zoom 1 so its dense hotspots and the bed stay discoverable;
  longer plates remain the separate next step.
- **For room.js (not changed here):** the closed-shop card still offers Arrange while she sleeps, and a central hours
  check in `shopAct` would close the last gaps; prop drags could convert through the plate's rectangle instead of
  fitting. A note for Jamie: outdoors the scene opens zoomed, so a vertical swipe on the scene pans the view; swiping
  below the scene still scrolls the page.
