# Codex diff review 4: Tideline Gym workouts (23 Oct 2026)

gpt-6.1-sol, read-only, through commit 588967c over 903e02d. Verbatim below; how each point was answered is in
docs/design/2026-10-22-gym-workouts.md, section "After diff review 4".

| Diff review 3 finding | Status | Evidence |
|---|---|---|
| P2: Floor tap during restoration strands the log | **FIXED** | `room.js:624-635` settles restoration when the workout picture is gone, including when a cut twirl skips its callback. |
| P2: Log opens underneath Light Flower or Koi Pond | **FIXED for the reported sequence** | `ovu-gym.js:261-264` drops offers beneath their shared overlay and waits while she sits. A different stranded-offer path remains below. |
| P3: “Opening Mind” tests only a synthetic event | **FIXED** | `tools/test-core.js:4093` now names the hook accurately; `tools/e2e_smoke.py:399-401` clicks the actual Mind tab and checks refusal. |

The review-2 P1 sequences remain fixed: `dressFor()` inherits the original fallback at `room.js:602`; superseding pictures retain watchdog recovery at `room.js:626-627`. Actual-function probes confirmed both second-workout and newer-picture recovery.

Remaining defects, ranked:

1. **P2: Closing a sheet reached from Mind strands the workout log.**

   **Functions:** `finish().ask()`, `openEveryday()`, `closeSheet()`.

   **Sequence:** Accumulate a minute, open Calendar, Stop, open Mind, choose Everyday practice, then close without beginning.

   **Failure:** `openEveryday()` replaces the Mind sheet without clearing meditation (`room.js:3176-3193`). Closing only exits meditation for sheets named `mind` or `morning` (`room.js:719`). The new guard at `ovu-gym.js:263` consequently waits indefinitely. Reproduced after sixty simulated seconds: no sheet, `meditating:true`, pending offer, zero movement-log openings.

   **Fix:** Ensure leaving idle Mind through its child sheets releases meditation, or explicitly cancel the gym offer when Mind takes ownership. Test the actual Mind → Everyday → Close and Mind → You → Close paths.

2. **P3: A never-settling outfit request has no restoration deadline.**

   **Functions:** `turnInto()`, `undress()`, `watchRestore()`, gym `ask()`.

   **Sequence:** Choose an uncached outfit during a workout, Stop after a minute, and leave its restoration request unresolved.

   **Failure:** `room.js:626` continually reschedules while the request owns the image generation. `ovu-gym.js:264` keeps the log waiting. An actual-function probe remained in yoga clothes with `restoring:true` after 120 simulated seconds.

   **Fix:** Bound restoration waiting, invalidate the stalled request, and restore the retained decoded fallback. Existing browser cases abort held requests, so they do not test this condition.

3. **P3: A rare failed-image sequence leaves restoration without a fallback.**

   **Functions:** `dressFor()`, `wearOwn()`.

   **Sequence:** An entry-save moment displays an action pose; an uncached wardrobe choice fails, leaving that pose displayed. Begin a workout, then Stop while the chosen standing image still fails.

   **Failure:** `room.js:602` discards action poses as fallbacks, recording `from:''`. `wearOwn()` then assigns the failing URL without recovery (`room.js:639-644`). The actual-function probe produced a broken outfit URL with `restoring:false`. Full browser reproduction of this sequence was not run.

   **Fix:** Retain a valid decoded standing fallback independently of the currently displayed pose.

The tests miss item 1 because `tools/test-core.js:4097-4099` manually clears `meditating`; browser cleanup similarly calls `exitMeditation()` at `tools/e2e_smoke.py:371`. Grounding still compares against the same station coordinates used for placement, and external-tab coverage does not exercise an actual server game-save pull.

No additional confirmed defects emerged from the requested timing, lifecycle, activity, wardrobe, camera, minimap, tudung, reduced-motion and sign-out sweep.

Reviewed all four commits through `588967c`. **Core suite: 1,870 passed, zero failed.** Browser smoke inspected, not rerun. No files changed.

VERDICT: HOLD

