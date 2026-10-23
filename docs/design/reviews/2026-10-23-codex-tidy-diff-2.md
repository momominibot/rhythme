# Codex diff review, round two: Tidy up your room (23 Oct 2026)

Reviewer: codex exec -s read-only (gpt-6.1-sol) on e68a77c (branch claude/magic-broom-93770c, rebased on 903e02d). Verbatim. The one P3 (the entrance animation's fill kept a swept thing opaque) was fixed in the next commit with a browser check for the fade.

All nine round-one findings are **FIXED**. No new P1 or P2 found.

| # | Finding | Status and current evidence |
|---|---|---|
| 1 | Full-minute boundary | **FIXED**, raw milliseconds checked at `room.js:3154`. |
| 2 | Queued hidden/asleep removal | **FIXED**, deferral and inside-lock revalidation at `ovu-tidy.js:270–288`. |
| 3 | Reduced-motion reach and movement | **FIXED**, planned endpoint at `ovu-tidy.js:299`, segment validation at `:307`. |
| 4 | Restored clutter becoming invisible | **FIXED**, fade readback at `ovu-tidy.js:282`, remaining-floor comparison at `:348`. |
| 5 | Rollback-safe creation | **FIXED**, commit at `ovu-tidy.js:76`, initialization after listeners at `:353`. |
| 6 | Entry during Arrange mode | **FIXED**, guard at `ovu-tidy.js:336`. |
| 7 | Downward shadows | **FIXED**, zero offsets at `room.css:2479` and `:2487`. |
| 8 | Spoken-guide promise | **FIXED**, qualified introduction at `room.js:3099`. |
| 9 | Spark CSS affecting benches | **FIXED**, scoped selectors at `room.css:2491–2498`. |

The additional sweep found one nonblocking defect:

- **P3: Swept items disappear abruptly instead of fading.** At [room.css:2480](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/magic-broom-93770c/room.css:2480), `tidyin ... both` retains animated `opacity:1`, overriding `.tidyitem.swept`’s `opacity:0`. Under normal motion, the item remains opaque until `ovu-tidy.js:282` removes it after 520 ms. Remove the entrance animation’s forwards fill, or clear that animation when marking the item swept.

Validation: **1,857 core checks passed**. The static command was blocked by temporary-file restrictions; the same checker with inline scripts passed through Node stdin reported **81 pages, zero problems**. Browser suite not run. No files changed.

VERDICT: MERGE


## What was done about the P3 (23 Oct, after the review)

The first fix (`animation:none` on `.tidyitem.swept` beside an opacity transition) was not enough: a new browser check that reads a swept thing 300 ms after its write failed. Sampling the floor every 30 ms during a fast sweep showed two separate causes.

1. The write goes through the shared game-save lock, and `ovu-gamesave.js` calls `OvuRoom.renderProps()` after it. Its `props` event redraws the floor, and `draw()` removed the swept thing at once because the model no longer had it: about 150 ms after the write, long before its 520 ms timer.
2. Chromium does not start an opacity transition in the same style change that removes a filling keyframe animation, so the thing read `opacity: 0` on the very next frame instead of fading.

Fix: the fade is its own keyframe animation (`tidyout`, 0.5 s ease-in, `both`), which replaces the entrance animation instead of relying on a transition; `draw()` and `end()` leave an element with the `swept` class alone so its own timer finishes the removal; the reduced-motion block turns `tidyout` off as well, so a swept thing simply goes. The browser check now follows the first swept thing by id and wants it still present, mid-fade (opacity between 0.02 and 0.9) and in `tidyout` at 300 ms.
