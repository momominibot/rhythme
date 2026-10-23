# Tideline Gym: workouts she does on the equipment (22 Oct 2026)

Jamie asked for gym animations on the treadmill, the weights and the yoga mat, with her changing into a workout outfit
automatically, "Animal Crossing style". The session that started this one added the bike (pedalling) so all four stations
of `ovu-lanescene.js` GYMSPOTS become things she does. Today each station only opens the movement log with its activity
chosen (`R.openExercise(act)`).

## What she sees

1. She taps a station (treadmill, bike, mats, weights). The room's own tap walks her to its stand point (unchanged
   GYMSPOTS `wp`), then the station's sheet opens: its line from `OvuLane.STATIONS`, a length (5, 10, 15, 20 or 30 minutes,
   10 chosen), **Begin**, and **Just log movement** (today's path: the movement log with the activity chosen), plus one
   safety line and the world-wide emergency line.
2. Begin: she turns into her workout clothes with the existing twirl (room.js `twirl`, one and a half turns; no turn under
   reduced motion or on a hidden page). The clothes are the Mint yoga set (`yoga`); if her saved outfit is the tudung
   (`tudung`), a covered-head gym kit instead (`gym-tudung`: long-sleeved mint top to the hips, loose lilac trousers, white
   trainers, a lilac sports tudung covering hair, ears and neck). If she already wears the yoga set there is no turn.
3. She steps onto the equipment: her standing picture is hidden and a frame strip plays on the machine, in the same
   picture scale as her walk strips (one cell per frame, scaled so her head and height match her standing sprite):
   - treadmill: walking in place on the belt, facing the console (her existing 8-frame side walk strip for the yoga set;
     a new side strip for `gym-tudung`, which also gives that kit a walk cycle);
   - bike: seated and pedalling, two frames (her on a small pastel exercise bike, drawn to cover the plate's bike);
   - weights: slow curls with two small dumbbells, two frames cross-faded (about 2 s up, 2 s down);
   - mats: a slow standing flow of four poses (mountain, arms overhead, tree, warrior two), each held about 5 s and
     cross-faded. Standing poses only, so nothing reads as a clinical instruction and her size never changes.
   Under reduced motion each station shows one still frame and nothing moves.
4. A small panel (the seats panel's shape, its own ids) shows the station, a clock that counts up ("3:12 of 10 min"),
   the station line, **Pause** / **Resume** and **Stop**. The clock sits outside the spoken status.
5. When the length is reached, or she taps Stop: the strip goes, she stands at the stand point in her workout clothes, and
   turns back into her own saved outfit (`savedOutfit()` at that moment, so a pick made meanwhile wins). Then, if she was
   moving for a minute or more of active time (unrounded: 59.9 s is not a minute), the movement log opens with the activity
   chosen and the minutes filled in from the clock, and a line at the top: "About N minutes on the treadmill. Save it if
   you really moved too." Everything else in that sheet is today's contract unchanged: she picks how it went (variant),
   the strength tick is pre-ticked for strength work and never locked, the date, the note, **Save** is the only write
   (`EX.makeEntry` then `S.add('exercise', ...)` then `afterSave`, hearts as today). Under a minute: one toast, "Stopped.
   Nothing under a minute is recorded.", and no sheet. If another sheet is open when the workout ends, the log waits until
   it closes (the seats' rule), unless she falls asleep.

Nothing in the gym writes a store entry, state, hearts or energy by itself (checkpoint 29). The workout clothes are a
picture only and are never saved (checkpoint 2: the change happens because she began a workout, and it is undone).

## Ownership and endings

- **One activity at a time.** `room.js activityNow()` reports `{ kind: 'gym' }` while a workout runs; `refuseBusy()`
  brings its panel back; `R.busy()` includes it (no tap-walks, no travel, no relayout from a game-save pull); `tap()`
  answers other hotspots with "Stop to get off first." (the bed still opens, so bedtime ends it). Begin is refused while
  anything else runs. Starting emits `activity('gym', id)` first, so a try-on, a greenhouse minute or a care step steps
  aside; any other `activity` event cancels the workout.
- **Endings.** Stop or the planned length: finish with the turn back and the log offer. Pause: the clock holds and the
  frames freeze. A hidden page pauses (the clock never counts hidden time; she comes back to Resume or Stop). Leaving the
  gym (layout event), sleep (stopEverything, or a state change to sleeping), clearing or importing data, or another
  activity: cancel at once, her own clothes put back silently, nothing asked. A walk that starts anyway (beforeWalk; walks
  are refused while busy, so this is a safety net): finish early, clothes back silently, the log offered if a minute or more.
  A cloud pull (`sync`) changes nothing she is doing: it re-checks sleep (cancel if asleep) and redraws the strip if the
  props layer was rebuilt; the workout keeps going.
- **Never half dressed or invisible.** room.js owns the clothes: `dressFor(id)` sets a memory-only costume (like a try-on;
  `wearing()` returns it so a blink or a pose draws the right clothes), `undress(silent)` puts `savedOutfit()` back. room.js
  itself drops the costume on any layout change away from the room it began in and in `stopEverything`, so even a gym bug
  cannot leave her in it. The standing avatar is hidden only while the strip element is mounted; unmounting always shows
  her at the stand point. A strip that fails to load leaves her standing at the machine in her workout clothes, visible,
  with the clock still running.
- **setOutfit during a workout** (the wardrobe from You): the pick is saved and she turns into it when the workout ends.

## Placement

Positions read off a 1% grid of `shop-gym-2f-v1.webp` (1024x1280). The stand points stay where they are and clear of the
coach the shopkeepers branch adds (feet 40.5, 53.2, block x 38.5 to 42.5, y 51.8 to 54.6). The strip element is a `.nb`
in `#ownedProps`, depth-sorted with her and the pets by its feet:

| station  | stand point | on the machine (feet) | faces | hidden behind |
|----------|-------------|-----------------------|-------|---------------|
| treadmill| 33, 58      | 33.8, 64.6 (the belt's visible end) | left, to the console | the window arch's right column (x < 30.3) |
| bike     | 39, 60      | 36, 75.5 (her bike's base, behind the wall like the plate's bike, which hers covers) | left | the low front wall (its top edge, about y 70.3 at x 30 to 73.5 at x 40), the window arch (x < 30.2) and the door's arch (x > 42.3) |
| mats     | 46, 56      | about 48.5, 60.2 (the mint mat)           | viewer | nothing |
| weights  | 55, 56      | about 55.5, 56.5 (in front of the rack)   | viewer | nothing |

Occlusion is a CSS `clip-path` polygon on the strip element, given in plate percent per station and converted to the
element's own percent (pure, tested), so no plate cutout or night-veil copy is needed and night mode stays as it is.

## Art (one guarded run, Seedream 5.0 pro, 1024 or 2048x1024, prompts under 600 characters, no retries)

References are her sprites composited onto pure #00FF00 (gen.py sends references as JPEG, so transparency would be lost).

1. `gym-tudung` standing: two references (the yoga set standing, the tudung standing), the tudung renders' proven
   two-reference wording.
2. Yoga set: bike frame A (her on a small exercise bike, side view facing left, one knee up); bike frame B as an edit of
   A (only the legs, the pedals half a turn on); weights frame A (dumbbells down) and B as an edit of A (curled up); a
   2048x1024 sheet of the four flow poses.
3. `gym-tudung`: the same four with the yoga renders and the `gym-tudung` standing render as references, plus an 8-frame
   side walk sheet (the walk sheets' proven prompt).

Keyed with `keyflood.py`, sliced and scaled with `walkcycle.py` (`--match height` for standing frames, a head-band match
for the seated bike), so she never changes size. `gym-tudung` also gets its blink frame from `make_blink.py` (no model).
The run stops on its first failure and persists BLOCKED.json; nothing is retried.

## Tests

- Core (`tools/test-core.js`): stations match GYMSPOTS and STATIONS; every strip and its sidecar exist for both kits and
  have the frame count the station plays; frame maths (loop, cross-fade, still under reduced motion); clip conversion;
  minutes (59.9 s is nothing, 60 s is one minute, rounding); the workout kit (`tudung` -> `gym-tudung`, anything else ->
  `yoga`); stand points and machine spots clear of the coach's block; no store write, hearts or state in ovu-gym.js;
  room.js costume rules (layout drop, stopEverything, setOutfit leaves the costume, wearing()); handlers in a vm with
  stand-ins (Begin refused while busy or asleep or shut; any other activity cancels; the end offers the log only past a
  minute).
- Browser (`tools/e2e_smoke.py`): in the gym, tap the treadmill, Begin 5 minutes, she twirls into the yoga set, the
  strip plays on the belt and the avatar is hidden; Pause freezes the clock; Stop under a minute puts her own clothes
  back, shows her, writes nothing; a run with the clock advanced past a minute opens the movement log with walking and
  the minutes filled, and Save writes one exercise entry; the tudung kit for a tudung wearer; leaving the gym mid-run
  and bedtime mid-run put her own clothes back with nothing written; reduced motion shows one still frame.

## Open questions for review

- Is "hidden page pauses" right for a workout (a person may lock the phone on a treadmill), or should hiding end it with
  the log offer, as a PULSE break does?
- Is the movement log, prefilled, the right place to confirm, or should the gym ask "Save?" first like the seats?
- Any risk in a costume that is not a wardrobe outfit (`gym-tudung`) flowing through `wearing()` (walk strips, blink,
  poses, the boutique accessory layer)?

## After the Codex design review (BUILD WITH CHANGES, docs/design/reviews/2026-10-22-codex-gym-design.md)

- Costume ownership: room.js `dressFor`/`undress` own the picture through the same image generation counter as every
  other picture, so a newer picture or a cancel drops a pending turn; a wardrobe pick during a workout is saved and never
  replaces the costume; she is hidden only once the strip is decoded.
- Cleanup never moves her out of a new scene or shows her over bedtime or the mat: she is placed back at the stand point
  only while she is still in the gym and awake; a new scene does not show her by itself, so the gym shows her again.
- The bed ends the workout first (the walk home refuses while busy); `goHome`, `walkTo` and the idle moments leave her
  on the machine; sign-out or another account cancels it; the panel goes inert behind the sign-in wall.
- A log offer is tokened: anything else starting, bedtime, leaving the gym or the account changing drops it, and it is
  rechecked (no activity, still in the gym, awake, no other sheet) before it opens.
- A props rebuild (a game-save pull) re-attaches the strip with its clock and frame; the strip is never a solid.
- The clock is monotonic (performance.now), counts only while she is on the machine and running, stops where it was last
  seen after a frozen page, and never passes the chosen length.
- The gym's offer leaves the strength-day tick for her to give (`openExercise(act, { strengthTick: false })`).
- Hidden pages pause with Resume (her answer to open question 1), the panel saying that time away is not counted; the
  prefilled movement log is the confirmation (question 2); `gym-tudung` is never a wardrobe outfit, a try-on cannot keep
  it, and the boutique's exact-sprite accessory rule hides any piece over it (question 3).

## As built

Twelve renders in one guarded run (28 to 43 s each, no failure). Final placements: treadmill feet at 33.8, 64.6 (her
walk strip, flipped to face the console); bike base at 36, 75.5, so her bike covers the plate's and its base sits behind
the low wall; mat 48.5, 60.2; weights 55.5, 56.5. Strips: `tools/art/gymstrip.py` (new) for the bike, weights and mat,
`tools/art/walkcycle.py` for the covered-head kit's side walk. Known small art notes: the star brooch on the covered-head
kit shows in five of its eight walk frames, and its blink has faint smudges at the eye edges visible only when zoomed.

## After Codex diff review 1 (HOLD: 4 P1, 3 P2, 1 P3; docs/design/reviews/2026-10-22-codex-gym-diff-1.md)

- A restore whose picture will not load falls back to the picture she wore before the workout (`costume.from`, `wearOwn`),
  never the workout clothes. Browser check with service workers blocked so the route really fails; it fails with the
  fallback removed.
- Cleanup shows her again unless this tab's mat or night owns her picture, so bedtime in another tab no longer leaves her
  invisible.
- Every stop of the clock goes through `holdClock`: a Pause tap or hidden page delivered after a freeze ends at the last
  moment she was seen running; a workout reaching the machine while the phone is locked starts paused with nothing counted.
- Another tab's Delete everything or replacing restore is read from the stored diary's creation stamp (`OvuStore.born`);
  an ordinary save from another tab keeps the workout.
- The camera follows the middle of her strip (`OvuGym.focus`) while her standing picture is hidden.
- The strength-day tick stays off for the gym's offer until she ticks it, even if she taps Strength again.
- Pause freezes a cross-fade on the current frame. Main's new `meditate` event (Mind seats her on the mat) ends the workout
  first, the log still offered.
- Tests: frames must actually step; six code mutations each fail a check; browser checks added for a locked phone, reduced
  motion, a wardrobe pick, a blocked restore, a props rebuild, another tab's reset, sign-out, an offer overtaken by another
  activity, bedtime reaching home and the bed sheet, and Jamie's no-float rule (every weights frame within 2% of her standing
  height on screen, feet on the strip's bottom edge). Measured at phone width: standing 78.6 px, standing frames 77.9 to
  79.4 px, feet gap 0 px; the bike rider's head is her standing head's width.

## After Codex diff review 2 (HOLD: 1 P1, 2 P2; docs/design/reviews/2026-10-23-codex-gym-diff-2.md)

- Restoring her own clothes keeps ownership until her own picture is really on. room.js keeps `lastCostume` (the workout
  clothes and the picture she wore before them) after the costume is gone. Another workout begun while her own clothes still
  load takes that earlier picture as its way back, never the workout clothes on screen. If a newer picture takes over and
  the workout clothes are still showing 1.2 s later (`watchRestore`), she is put in the earlier picture. The gym's log offer
  waits for `OvuRoom.restoring()` to clear, so a save moment's pose cannot cut the restore short.
- Another tab's restore that replaces the diary is told apart even when the backup is this same diary: Replace and Delete
  everything write a fresh token (`ovumind_db_epoch_v1`, not diary data), and `OvuStore.born()` reads it. Core check with
  two real store instances sharing storage: an ordinary save and a merging restore keep it, a same-diary Replace and Delete
  everything change it.
- Her own strength-day choice stands through the form: once she ticks or unticks it, tapping Strength again (or another
  activity and back) never restores the default over it.
- Tests: the browser now runs the image races with the real room.js (her new pick's picture held, then failing: a second
  workout begun meanwhile, and a pose that will not load taking over), the tick, untick and reselect sequence, Jamie's sizing
  and no-float rule on all four machines in both kits (standing frames within 2% of her standing figure, the rider's head
  within 3% of her standing head, the strip's bottom within a pixel of the machine's spot, no gap), and a real breathing
  session: refused mid-workout, and dropping a waiting log offer when it starts.

## After Codex diff review 3 (HOLD: 2 P2, 1 P3; docs/design/reviews/2026-10-23-codex-gym-diff-3.md)

- A restore is settled as soon as the workout clothes are off her picture (`restoring()` and `watchRestore` read `leftOn()`),
  so a floor tap that cuts her turn back short no longer leaves the log offer waiting for ever.
- A waiting log offer goes when Light Flower or Koi Pond opens over the room (their `btap-open` overlay), and waits while she
  sits on the mat, so it never opens under an overlay or pulls her off the mat.
- The core meditate case now says what it tests (the hook, from any path); the browser checks the real Mind tab, refused
  mid-workout.
- Tests: browser checks for a floor tap mid-turn (the log still opens), Light Flower over a waiting offer (dropped, never
  opened after), and the Mind tab refused; core cases for the overlay and the mat. Each fails on a one-line mutation of its
  fix (the mat guard in core only: in the browser the Mind sheet already holds the offer).
- A props rebuild is now also checked through the real path: an ordinary save in a second tab reaches this one as `external`,
  the room rebuilds its props, and her strip and clock carry on.
- Not changed: grounding is measured against the station's own spot (an evidence gap Codex named, not a defect); the spots
  were placed by eye on zoomed screenshots of each pose on its machine, which Jamie has.

## After Codex diff review 4 (HOLD: 1 P2, 2 P3; docs/design/reviews/2026-10-23-codex-gym-diff-4.md)

- The P2 came from the round-3 mat guard: after Mind, then Everyday practice or You, then close, she can still be seated with
  no sheet open, so an offer waiting for her to stand waited for ever. The guard is gone. The offer waits only for an open
  sheet (Mind's included) and goes when Light Flower or Koi Pond opens or another activity starts; when it opens it stands
  her up, as the movement log always has. Browser check: Mind, then Everyday or You, then close, and the log opens.
- P3, fixed: a restore whose picture never answers no longer waits for ever. After about six seconds (`watchRestore`, five
  1.2 s waits) she wears the picture from before the workout and the offer opens. Browser check with the request held and
  never answered.
- P3, left as a follow-up: when an action pose is on screen as a workout begins and her saved outfit's picture also fails,
  there is no standing picture to go back to. It needs a pose on screen, a failing outfit picture, and a workout started
  in between.
