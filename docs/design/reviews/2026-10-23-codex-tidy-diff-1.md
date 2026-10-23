# Codex diff review, round one: Tidy up your room (23 Oct 2026)

Reviewer: codex exec -s read-only (gpt-6.1-sol) on 77f922c (branch claude/magic-broom-93770c). Verbatim. Every finding was applied in the next commit: the minute judged in milliseconds; removals revalidated inside the lock (practice on, awake, same home, same layout) and deferred while the page is hidden; reduced motion stops where the planned leg ends and normal movement checks the travelled segment; the replacement check compares the whole floor set and a delayed element removal re-reads the store; creation writes through commit(); a tap while arranging does nothing; no shadow offset; spark and puff styles scoped to #tidyLayer; the sheet intro qualified; the fallback cell keeps the ground-floor rule; the smoke checks it called hollow were rewritten (no offset required, puff count asserted, no manual redraw, a slow broom so Stop lands mid-sweep after the minute, a hidden-page deferral check).

Reviewed `77f922c` read-only. No P1 found, but two P2 findings violate the minute and sleep rules.

The ordinary-use sweep found:

1. **P2: Less than a full minute can save and earn hearts.** [room.js:3083](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/room.js:3083) rounds active time before the save check at line 3091. A naturally completed guide with **59,500 ms** active time saves as 60 seconds, reproduced locally. Compare raw milliseconds with `60000`; round only for display.

2. **P2: A queued removal can run while hidden or asleep.** [ovu-tidy.js:265](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/ovu-tidy.js:265) checks sweep identity before reload, then commits without rechecking visibility, sleep, layout or practice. Local probes reproduced deletion and a puff after backgrounding, and after reload adopted sleeping state. Revalidate inside the lock immediately before committing; defer hidden writes.

3. **P2: Reduced motion bypasses the planner’s reach protection.** [ovu-tidy.js:290](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/ovu-tidy.js:290) jumps to `leg.to`, rather than the planned endpoint. Reproduced with a sock beneath her: planning stopped outside brush reach, but reduced motion moved onto her and cleared it. Use the verified endpoint and live geometry. Normal movement at line 298 also needs the requested `segClear`, rather than checking only the next point.

4. **P2: Account replacement can leave saved clutter invisible.** [ovu-tidy.js:338](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/ovu-tidy.js:338) ignores restored IDs already in `swept`. If an account copy restores an item during its fade, the timer at line 273 still removes its element. A local probe reproduced “item present in state, absent from the floor.” Detect replacement beyond missing unswept IDs, and recheck state before delayed DOM removal.

5. **P2: Clutter creation is not rollback-safe.** [ovu-tidy.js:76](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/ovu-tidy.js:76) uses `setState`. A storage-failure probe left one item in memory and none persisted. Failure during the initial `draw()` at line 324 also prevents subsequent lifecycle listeners from mounting. Use rollback-safe commits and attach listeners before fallible initialization.

6. **P2: Clutter opens a practice during Arrange mode.** [ovu-tidy.js:325](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/ovu-tidy.js:325) lacks the arranging guard used by existing prop interactions. Arrange mode remains active, with furniture draggable while the broom retains captured targets. Refuse this entry during arranging, or exit arranging before starting.

7. **P3: Forbidden downward shadows.** [room.css:2474](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/room.css:2474) and line 2482 add a `1px` downward drop-shadow offset. Remove that offset; retain the contact shadows.

8. **P3: The sheet still promises spoken guides.** [room.js:3036](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/room.js:3036) contradicts tidy’s correctly labelled text-only card and journal entry. Qualify the shared introduction.

9. **P3: New spark CSS affects existing bench effects.** [room.css:2486](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/room.css:2486) uses global `.spark` selectors already used by `#seatfx`. It changes their dimensions and hides their static reduced-motion effects. Scope the new selectors to `#tidyLayer`.

The design-review findings reconcile as follows. **NOT FIXED** includes partially completed findings:

| Design finding | Status | Built evidence |
|---|---|---|
| 1. Cancel before confirmation | **FIXED** | `room.js:3082,3110`; idempotent cleanup `ovu-tidy.js:254` |
| 2. Full active minute; hidden phases | **NOT FIXED** | Rounded boundary and queued hidden writes above |
| 3. Separate slot from kind | **FIXED** | `ovu-tidy.js:33,44,62`; rotation persisted |
| 4. Ground floor and live furniture | **NOT FIXED** | Initial picker corrected at `:91`; fallback at `:127` drops ground-floor/stair restrictions. The documented hedge overlap also remains |
| 5. Reach and travelled segments | **NOT FIXED** | Reduced-motion bypass at `:290`; no segment check at `:298` |
| 6. Persistence and account replacement | **NOT FIXED** | Removal commits added, but findings 2, 4 and 5 remain |
| 7. Null-pose presentation | **FIXED** | `ovu-mindful.js:205`; `room.js:540,3032,3068` |
| 8. Daily anchor and backward clock | **FIXED** | `ovu-tidy.js:51–57,70` |
| 9. Truthful text-only presentation | **NOT FIXED** | Card/journal corrected; shared introduction remains |
| 10. Animation and behavioural tests | **NOT FIXED** | Sizing, stationary wrapper and opacity entrance corrected; important test gaps remain |

The five Q6 copy edits are **FIXED** at `ovu-mindful.js:189,192,197–199`. I found no new user-facing emoji, em dash, provider name, clutter nag or separate heart-award path.

Checks passed: **1,856 core checks**. The static command could not create temporary files under the read-only sandbox; the same checker using stdin for inline scripts passed **81 pages, zero problems**. Screenshots inspected; browser suite not run.

Several smoke checks can pass on broken behaviour:

- `e2e_smoke.py:3323` explicitly requires the forbidden downward shadow.
- `:3391` checks Stop after 66 seconds with the accelerated broom, normally after sweeping has finished.
- `:3365` never asserts the collected puff count despite claiming no false puff.
- `:3357` manually redraws, masking missing automatic redraw.
- Core checks `test-core.js:5322–5325` inspect source strings rather than those behaviours.

VERDICT: HOLD

