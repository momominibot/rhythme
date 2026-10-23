# Codex design review: Tideline Gym workouts (22 Oct 2026)

gpt-6.1-sol, read-only, against baseline 0f2177c, on docs/design/2026-10-22-gym-workouts.md. Verbatim:

1. **VERDICT: BUILD WITH CHANGES.**

Reviewed against baseline `0f2177c`. Another session started implementation during this review; that unfinished code is excluded. I made no edits.

2. **Defects, ranked**

- **P1: Costume transitions need explicit ownership and cancellation.** `room.js:showOutfit()` loads asynchronously; `twirl()` swaps later, and `finishTwirl()` skips its completion callback. Meanwhile, `setOutfit()` immediately redraws through `showOutfit()` and `redress()`. Define preparing/running/ending phases with cancellation tokens. Wardrobe choices must save without replacing the costume. Hide her only after the workout image is decoded; invalidate every pending swap on cancellation.

- **P1: “Always show her at the stand point” breaks layout and sleep transitions.** `room.js:applyLayout()` places her in the destination **before** emitting `layout`. Gym cleanup must not then restore the old gym coordinates. Similarly, cleanup must not remove visibility owned by `enterNight()` or meditation. Restore position and visibility only while the gym still owns them.

- **P1: The proposed bedtime exception cannot reach the bed.** `room.js:tap()` calls `openSheetFor('bed')`; away from home, `ovu-walk.js`’s `HOME_ONLY` handler calls `travel('home')`, which refuses `R.busy()`. Cancel the workout before requesting this journey.

- **P2: Closing another sheet can unexpectedly end the workout.** `room.js:closeSheet()` schedules `goHome()`. Its exclusions omit gym; `walkTo()` then falls back to a straight walk when `ovu-walk.js:routeTo()` refuses busy movement. Guard both idle return and room-owned walks. The `beforeWalk` safety net alone would merely turn this into an unwanted early finish.

- **P2: Deferred log offers can interrupt a newer activity.** `ovu-seats.js:finish()` waits only for no sheet and no sleep. Copying that permits an old offer over Morning start, PULSE or another workout. Cancel pending offers on every takeover, even after `run` becomes null; recheck `activityNow()` before opening. Also cancel on account changes: `room.js`’s auth subscriber does not call `stopEverything()`, and `wallInert()` does not include a new gym panel.

- **P2: Listening to `sync` does not cover game-save redraws.** `ovu-gamesave.js:apply()` commits `state` and calls `room.js:renderProps()` directly, deleting the strip. Reattach on `props`, checking the originating layout first. Preserve the existing clock and frame state.

- **P2: Rendering art does not complete costume integration.** `ovu-walk.js:sheet()` requires `gym-tudung` in `STRIPS`; `outfitNow()` reads the displayed filename, not `wearing()`. External strips also need explicit cell sizing equivalent to `cycleShow()` and a measured `room.js:AVATAR_FIT`. Additionally, `sprites()` treats every `.nb` as solid: mark this visual overlay non-colliding.

- **P2: The seats clock can manufacture active minutes.** `ovu-seats.js:makeClock()` uses unrestricted `Date.now()` differences. Use monotonic time, exclude dressing and pauses, clamp at the selected duration, and handle suspension gaps as `room.js:openPulse()` does.

- **P2: Dumbbell curls must not pre-confirm a whole strength day.** `openExercise():renderVars()` prechecks strength; `ovu-exercise.js:week()` interprets that as all main muscle groups worked. Leave that checkbox unchecked for the gym offer and let her affirm it.

3. **Open questions**

- **Hidden page:** Keep pause with explicit Resume. Locking the phone is ordinary use. Say clearly that background time is excluded; the editable log can reflect what she actually did.
- **Confirmation:** Use the prefilled movement log directly. Another “Save?” adds no protection. Extend `openExercise(pre)` to accept optional minutes, date and introductory text; currently it accepts only an activity and defaults to 30 minutes.
- **Non-wardrobe costume:** Keep it separate from `trying`; never permit `keepTryOn()` to save it. Preserve exact-sprite accessory matching in `ovu-boutique.js:spotFor()`. Missing mappings should hide accessories. Missing poses should retain her covered standing costume.

4. **Ordinary-use coverage missing**

Add checks for:

- Begin while its own setup sheet is open: `R.busy()` includes that sheet, so use a competing-owner guard.
- Camera and minimap: `ovu-camera.js:focus()` ignores the hidden avatar; `ovu-map.js:open()` uses `R.pos()`. Define the workout’s visual focus without putting walk coordinates outside the floor.
- Morning start, PULSE, greenhouse care and a second Begin during dressing or restoration.
- Avatar-menu bedtime from inside the gym, wardrobe changes, failed images, props rebuilds, second-tab sign-out/reset, midnight and a pending offer followed by another activity.
- Reduced motion throughout dressing and restoration, plus the exact worldwide care copy.

