# Codex diff review 2: Tideline Gym workouts (23 Oct 2026)

gpt-6.1-sol, read-only, against commits 923c5cf and 7cc37de over 752f577. Verbatim below; how each point was answered is in
docs/design/2026-10-22-gym-workouts.md, section "After diff review 2".

| Review 1 finding | Status | Evidence |
|---|---|---|
| 1. Failed outfit restoration | **NOT FIXED** | The immediate error now falls back, but `undress()` still clears ownership before restoration completes. A second workout can capture the gym kit as its fallback. [room.js:603](./room.js#L603) |
| 2. Another tab’s bedtime leaves her invisible | **FIXED** | `unmount()` preserves hiding only when this tab’s meditation or night renderer owns it. [ovu-gym.js:176](./ovu-gym.js#L176) |
| 3. Locking during dressing credits hidden time | **FIXED** | Hidden mounting starts paused without running the clock. [ovu-gym.js:166](./ovu-gym.js#L166) |
| 4. Delayed Pause credits suspension | **FIXED** | Pause and finish use suspension-aware `holdClock()`. [ovu-gym.js:230](./ovu-gym.js#L230) |
| 5. Another tab’s reset/import survives | **NOT FIXED** | A backup of the same diary retains `createdAt`, so `born()` cannot identify its replacement. [ovu-store.js:565](./ovu-store.js#L565), [ovu-gym.js:293](./ovu-gym.js#L293) |
| 6. Zoom crops the working avatar | **FIXED** | Camera focus now uses the workout strip’s centre while the standing avatar is hidden. [ovu-camera.js:53](./ovu-camera.js#L53), [ovu-gym.js:281](./ovu-gym.js#L281) |
| 7. Reselecting Strength restores the tick | **FIXED for the original sequence** | Initial reselection respects `noTick`. An explicit untick can still be overwritten, described below. [room.js:2692](./room.js#L2692) |
| 8. Pause continues the crossfade | **FIXED** | Pause removes transitions and selects the current frame fully drawn. [ovu-gym.js:234](./ovu-gym.js#L234) |

Remaining defects, ranked:

1. **P1: Restoration can still leave her permanently in workout clothes.**

   Functions: `dressFor()`, `undress()`, `turnInto()` and `wearOwn()` in [room.js:593](./room.js#L593).

   **Trigger:** Begin in base clothes, choose an uncached outfit through Wardrobe during the workout, then Stop. While that outfit’s restoration request remains pending, begin another workout. Cancel the second workout and let the chosen outfit request fail.

   **Failure:** The first `undress()` already cleared `costume`. The second `dressFor()` captures the still-displayed yoga kit as `costume.from`. Its fallback therefore restores yoga, leaving `costume === null` and the saved outfit different from the picture. Further cancellation cannot repair it. Reproduced with the actual room functions and controlled image responses.

   The same ownership gap permits an entry-save moment to invalidate a pending restore: the log opens after a fixed delay at [ovu-gym.js:265](./ovu-gym.js#L265), and `setPose()` advances `imgGen`, suppressing the restore’s error recovery.

   **Fix:** Retain restoration ownership and a decoded own-clothes fallback until restoration resolves. Explicitly handle superseding pictures and subsequent workouts. Open the log after restoration resolves.

2. **P2: Another tab’s ordinary backup replacement does not cancel the workout.**

   Functions: `importJSON()` / `born()` in [ovu-store.js:560](./ovu-store.js#L560), and the gym subscriber at [ovu-gym.js:290](./ovu-gym.js#L290).

   **Trigger:** Export this diary, start a workout in tab A, then restore that backup using Replace in tab B.

   **Failure:** The backup retains the same creation timestamp. A receives `external` with unchanged `born()`, so its workout and pending log offer survive the replacement. Reproduced with two actual store instances sharing in-memory storage.

   **Fix:** Persist an explicit reset/restore generation changed by every replacement, independently of the backup’s historical creation timestamp.

3. **P2: Strength reselection overwrites an explicit untick.**

   Function: `openExercise()` / `renderVars()` in [room.js:2692](./room.js#L2692).

   **Trigger:** Finish weights, tick the strength-day checkbox, untick it, then tap the selected Strength tile again and Save.

   **Failure:** Both checkbox changes set `noTick = false` at line 2699. Reselection consequently checks the box again, overriding her refusal. Reproduced with the actual `renderVars()` function.

   **Fix:** Preserve her explicit checkbox choice throughout the form. Reselecting an activity must not restore its default over that choice.

The tests still overclaim several protections:

- [test-core.js:3971](./tools/test-core.js#L3971) checks restoration through source patterns; the runner mocks `dressFor()` and `undress()` at line 4002. It does not exercise image races.
- [test-core.js:4076](./tools/test-core.js#L4076) manually changes `born`, assuming the behavior that real same-diary replacement lacks.
- [e2e_smoke.py:131](./tools/e2e_smoke.py#L131) never exercises Strength’s tick, untick, reselection sequence.
- [e2e_smoke.py:130](./tools/e2e_smoke.py#L130) checks yoga weights’ alpha bounds against the cell edge. It does not establish grounding against equipment or scale across every station and kit.
- Props and takeover checks use `renderProps()` and a synthetic activity event. They do not exercise actual game-save pulls or all competing activity controls.

The animation checks now require real frame changes. Source inspection found no additional confirmed defects in Coach Ren taps, meditation cleanup, activity admission, scene guards, wardrobe deferral or strip reattachment.

Reviewed commits `923c5cf` and `7cc37de` against `752f577`. Core suite: **1,867 passed, zero failed**. Browser smoke was inspected, not rerun. No files changed.

VERDICT: HOLD

