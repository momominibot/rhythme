# Codex diff review 3: Tideline Gym workouts (23 Oct 2026)

gpt-6.1-sol, read-only, against commits 2ee296f, 4f80cc1 and fc5c0a2 over 903e02d (after the rebase onto PR 82). Verbatim below; how
each point was answered is in docs/design/2026-10-22-gym-workouts.md, section "After diff review 3".

| Review-2 defect | Status | Evidence |
|---|---|---|
| Restoration captures workout clothes as the next fallback | **FIXED for the reported sequence** | `dressFor()` inherits `lastCostume.back`; `undress()` retains the restoration record and watches superseding pictures. `room.js:597-629`. A separate completion defect remains below. |
| Same-diary backup replacement does not cancel the workout | **FIXED** | Replace and Delete everything generate an independent epoch before saving; `born()` reads it. `ovu-store.js:21,576,596,656`. |
| Strength reselection overwrites her explicit untick | **FIXED** | `st.tick` records her checkbox choice, and `renderVars()` preserves it through activity reselection. `room.js:2744,2774,2781`. |

| Review-2 test overclaim | Status | Evidence |
|---|---|---|
| Restoration covered only by source patterns and mocked dressing | **FIXED at suite level** | Browser cases exercise real held/failing outfit requests, a subsequent workout and a superseding pose. `tools/e2e_smoke.py:317-343`. Core dressing remains mocked. |
| Replacement behavior assumed through manually changed `born` | **FIXED at suite level** | Two actual store instances share storage and test Merge, same-diary Replace and Clear. `tools/test-core.js:3963-3971`. |
| Strength tick, untick and reselection never exercised | **FIXED** | Browser clicks and checks `[true,true,false,false,false,false]`, then verifies the saved value. `tools/e2e_smoke.py:275-281`. |
| Alpha bounds establish equipment grounding and every-kit scale | **NOT FIXED completely** | Scale coverage now includes all eight combinations. Grounding still compares the element against the same configured `STATIONS[id].on` used to position it, rather than an independent equipment anchor. `tools/e2e_smoke.py:238-267`; `ovu-gym.js:158`. This is an evidence gap, not confirmed floating. |
| Props/takeover checks establish actual game-save pulls and competing controls | **NOT FIXED completely** | Real breathing-session cases were added at `tools/e2e_smoke.py:358-369`. Props still use direct `renderProps()` at line 354; the core “cloud pull” case uses fake notifications and element removal at `tools/test-core.js:4070-4071`. |

The remaining defects, ranked:

1. **P2: A floor tap during restoration permanently strands the movement-log offer.**

   Functions: `undress()`, `twirl().end()`, `finishTwirl()`, `watchRestore()`, `restoring()` and gym `finish().ask()`.

   **Sequence:** Complete at least one active minute, tap Stop, then tap free floor during the normal change-back twirl.

   **Failure:** Walking calls `finishTwirl()` (`room.js:3703`). The cut twirl successfully swaps to her own clothes but skips its completion callback (`room.js:3008`). That callback alone clears `rec.pending` (`room.js:616`). The watchdog exits because her own clothes now show (`room.js:624`), while `restoring()` remains true (`room.js:629`). The log consequently waits forever at `ovu-gym.js:262`.

   **Evidence:** An in-memory probe executing the actual restoration and twirl functions produced `avatar-base.webp` with both `pending:true` and `restoring:true` after the cut and watchdog.

   **Fix:** Settle restoration whenever its target picture lands, including a successfully cut twirl. Add a regression covering Stop, a floor tap during restoration, and eventual log opening.

2. **P2: A waiting workout log opens underneath Light Flower or Koi Pond.**

   Functions: gym `finish().ask()` and its `meditate` handler; `openMindfulness()` overlay handlers; `openExercise()`.

   **Sequence:** Keep You open after accumulating a minute, then Stop. Let restoration finish while You remains open. Tap Mind, then Light Flower or Koi Pond.

   **Failure:** The pending offer survives `meditate`, whose gym handler only handles an active run (`ovu-gym.js:289`). The overlay buttons hide the sheet and open their overlay without emitting `activity` (`room.js:2624-2625`). `ask()` sees no sheet or tracked activity and opens Movement underneath it (`ovu-gym.js:258-263`). `openExercise()` also exits meditation (`room.js:2741`). Closing the overlay reveals the stale gym form.

   **Evidence:** The actual gym runner, exercised in memory with the repository harness, called `openExercise('walk', {minutes:1,...})` while `btap-open` remained set.

   **Fix:** Cancel the pending offer when another mindfulness experience begins. Connect both overlays to the activity lifecycle and guard offers against open overlays. Test the actual controls.

   Both P2 sequences require ordinary taps, with no failing network.

3. **P3, test accuracy: “opening Mind” does not test opening Mind.**

   `tools/test-core.js:4092-4093` fires a synthetic `meditate` event and claims Mind ends the workout. Actual Mind taps pass through `room.js:1703` and `openMindfulness()`’s refusal at `room.js:2585`, preserving the running workout.

   **Fix:** Rename the existing case as a cleanup-hook test and add an actual Mind-control test asserting refusal and restored workout controls.

No additional confirmed P1 or P2 emerged from the sweep of timing, phone lock, scene changes, bedtime, sheets, second-tab changes, game-save application, reduced motion, tudung assets, Morning start, PULSE, greenhouse care, seats, soaks, shopkeepers, wardrobe, boutique, camera, minimap and sign-out.

Reviewed `2ee296f`, `4f80cc1` and `fc5c0a2` against `903e02d`. Core suite: **1,868 passed, zero failed**. Browser smoke was inspected, not rerun. No files changed.

VERDICT: HOLD

