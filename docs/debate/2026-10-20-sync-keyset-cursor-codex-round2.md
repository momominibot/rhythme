# Shared pull keyset cursor: Codex read-only review, round two (20 Oct 2026)

Reviewer: codex exec -s read-only (gpt-6.1-sol), on commit 81e43f5. Verbatim:

VERDICT: REJECT

1. **major · REPEAT (round-one finding 1) · ovu-sync.js:324**  
   The cursor update remains non-atomic across tabs. A reads `cur` at 10:00; B commits 12:00 before A reaches `saveState()` at line 341; A then saves 11:00 from its stale snapshot. I reproduced this interleaving in memory: the cursor regressed and the next sync restored cleared row `r2`. The exact POST-time regression test is fixed, but this narrower race remains.  
   **Suggested fix:** serialize sync-state writes across tabs, or commit the cursor transactionally with conflict detection.

2. **major · REPEAT (round-one finding 3) · ovu-sync.js:317, 390–393**  
   Cancellation protection is incomplete. Resetting during `/profiles` POST still lets its completion restore `profilePulledAt` and report success. I reproduced the consequence: signing into account B afterward skipped B’s first profile restore and uploaded account A’s local profile over B’s cloud profile. Separately, another tab’s same-account activation makes `cur.userId === uid` again, allowing a pre-reset entry upload to restore its cursor and watermarks.  
   **Suggested fix:** capture a persistent reset generation and validate identity plus generation before subsequent requests and every completion write, including `syncProfile()` and `lastSyncAt`.

Verified independently, without editing files:

- Current suite: **493 passed, 0 failed**.
- Current tests with `f38599b` sync source substituted in memory: **490 passed, 3 failed**, matching the reported failures.
- No NEW defects found in `micros()`, legacy/null cursor handling, tie handling, or typed-recovery changes.
- Both changed JavaScript files pass syntax checks. Static/browser totals remain supplied evidence.


## Status: held at AGENTS gate 6

Both findings repeat round one, so no third repair round runs without Jamie. Nothing below is applied.

Notes on scope:
- Finding 1's remaining gap (another tab saves between this tab's `loadState()` and `saveState()`) is also in the
  base code: the old `maxIso(cur.pulledSeq, seqMax)` read-modify-write regresses the same way. Any whole-object
  write of `ovumind_sync_v1` from another tab, `onStoreChange` included, can do the same.
- Finding 2 (a reset during the profile step, or a reset followed by the same account's reactivation in another
  tab) is in the sync lifecycle, not the pull. It was there before this branch.

Proposed round three (not applied):
1. Serialise syncs across tabs with the Web Locks API (`navigator.locks.request('ovumind-sync', ...)`, Safari 15.4+,
   Chrome 69+), and keep the pull cursor in its own localStorage key that only the sync commit writes, under that
   lock, so other whole-state writes cannot overwrite it. Test: two pretend tabs sharing one storage, with B's save
   landing between A's read and write.
2. A persistent reset generation (`epoch`), raised by `resetPosition()`, account switch and wipe. `syncNow` captures
   it at the start and checks it, together with the account, before every later request and every completion
   write: the entries commit, `syncProfile()` and `lastSyncAt`. Tests: a reset during the profile POST, and a reset
   followed by the same account's reactivation during the upload.
