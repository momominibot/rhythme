<!-- Codex diff review round three, 23 Oct 2026, on commit 4591f4f (PR 84). Reviewer: codex exec -s read-only (gpt-6.1-sol). Verbatim. Both P2s were fixed before the merge. -->

No remaining P1 reproduced. One P2 test gap remains, plus a P2 timer bug that predates this branch.

1. **P2: The bed-arrival scenario still accepts silent playback.**  
   [tools/tones_render.py:35](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/tools/tones_render.py:35) sets `loud: []`. I executed the actual acceptance block with successful start receipts and entirely silent measurements. This scenario passed; the other four correctly failed. Add `loud: [0]` to check the second before the slider reaches zero. Round-two finding 5 is therefore only partially closed.

2. **P2, preexisting follow-up: Stopping quiet sitting leaves its timer armed.**  
   [ovu-tones.js:215](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/soothing-tones-751441/ovu-tones.js:215) returns before `clearTimer()` when no sound graph is active. Reproduced through the sheet handler: timed Just sit, Stand up, then untimed Just sit. The former deadline stands her up. `remaining()` also retains the old deadline. This reproduces on `origin/main`, so it is not a regression from this diff. Move timer cleanup before the early return and add scene-level coverage.

The round-two findings reconcile as follows:

| Finding | Round-three result |
|---|---|
| Switch-off paths and terminal hush | Fixed at `ovu-tones.js:263–273,353–354`. Actual subscription probes passed for `state`, `external`, `clear`, `import` and `sync`. Hushing an active graph also remains terminal across slider changes; a fresh explicit start gets its own volume. |
| Generation ownership | Fixed at `ovu-tones.js:147–165,181–183,215,228–230`. Same-tick tone-to-bed replacement survives the earlier tone’s refusal. Native Promise callbacks cannot interrupt the synchronous generation assignment. |
| Constructor failures | Both starters catch `ensure()` failures and return false. Tests cover both. |
| Released-graph housekeeping | Fixed at `ovu-tones.js:157–161`. Released graphs cannot re-arm cleanup. |
| Scripted render acceptance | Refused starts and audible replacement segments are checked. The bed-arrival gap remains as finding 1. |

The bed construction catch and six-second 44.1 kHz peak tests pass. A stale resume refusal preserves a newer timed quiet sit correctly; its later Stop exposes the separate preexisting timer bug above.

`node tools/test-core.js`: **1,861 passed, 0 failed**. Additional offline probes passed. No new owner-rule violation found. No files changed or network operations ran. Browser audio renders and listening were not repeated.

VERDICT: MERGE

