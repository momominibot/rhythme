# Local integrity fixes, 22 October 2026

Scope: the confirmed P1 broken behaviour and record-integrity findings in
`2026-10-22-codex-full-audit.md`. No sync, auth, consent or Supabase files changed.
No dependency, production, migration or publication changes.

## Reusable patterns

- Capture the originating run object in every clip and timed wait. Cancellation
  clears timers and media handlers, pauses audio and resolves the outstanding
  promise. Every continuation verifies identity before touching captions, HUD,
  pose or completion. Delayed mat restoration also checks the room activity
  generation, including garden and greenhouse HUD starts.
- Game completion changes game progress only. A journal record requires an
  explicit Yes after a full minute; No, closing or bedtime creates no record.
  Garden and greenhouse confirmations wait for an unfinished form and are
  invalidated by a newer activity. Existing Everyday acceptance stays unchanged.
- Copy nested state before calculating a mutation. Commit points, reward receipt
  and daily entitlement in one rollback-capable write. Purchases, free seeds and
  community actions likewise leave no unsaved mutation in live memory.
- Everyday completion passes its copied exploration count through `add`'s
  optional `statePatch`; the event and count share `commit`'s single write, and
  both roll back on failure. Keep the confirmation and pending practice until
  the write succeeds.
- Keep a failed game save payload for Retry. Once the entry exists, retain its
  identity while retrying rewards. `afterSave` reports reward failure separately
  from entry success, so a failed thank-you never creates a duplicate journal row.
- Capture both the meal draft and its picker when a photo starts. Check them
  after shrinking, barcode detection and recognition, and in error and permission
  callbacks, before applying any result.

## Regression evidence

All new checks are in `tools/test-core.js`, beside the related existing tests:

| Test group | Covered defects |
| --- | --- |
| `staleRunnersAndPracticeSave` | Session and Everyday replacement races; cancelled waits; bedtime audio/timers and one-minute threshold; delayed HUD ownership; failed session save cleanup; retryable, atomic Everyday confirmation. |
| `gameMinutesNeedConfirmation` | Synchronous garden activity/walk cancellation; stale callbacks; garden/greenhouse Yes and No; deferred confirmation identity; Light Flower and Koi opt-in saves; retained failed-save payload; reward retry with the saved event; preserved ripple count. |
| `rewardWritesAreAtomic` | Purchases and other reward mutation rollback; atomic receipt, entitlement and points; persisted reload and retry. |
| `freeSeedFailureIsAtomic` | Failed seed claims preserve inventory and allowance; retry writes once. |
| `communityFailedSavesKeepTheSheet` | Hello/pin rollback, retained text and later-save leak prevention. |
| `foodPhotoKeepsItsDraft` | Late shrink, barcode and recognition results; closed/replaced picker; stale errors; current-result success. |
| `savedEntryIsNotARewardFailure` | Journal success remains distinct from a failed hearts write and exposes the retry outcome. |

Final local verification:

- `node tools/test-core.js`: **1,709 passed, 0 failed**.
- Baseline before these fixes: **1,617 passed, 0 failed**; **92** new assertions.
- `python3 tools/check.py`: **81 pages, 0 problems**.
- `node --check` passed for all 11 changed JavaScript files.
- `git diff --check` passed.

These are local VM, store, syntax and page checks. No deployed or on-device
acceptance is claimed. Task triage returned `hold: local_state_unavailable`; no
external provider workflow was retried or substituted. Independent local agents
reviewed the game and runner integration against the source.

## Local commit limitation

The authorized `git add` of explicit changed paths failed because this worktree's
Git directory is outside the writable sandbox. Git could not create its
`index.lock` (`Operation not permitted`). No commit or push was made; the source,
tests and this note remain in the working tree.

Prepared commit message:

```text
Fix Rhythme activity ownership and journal save integrity

Bind runners and photo results to their originating state, require journal
confirmation after games, and commit local rewards and completion state atomically.
Cover confirmed P1 failures with 92 focused VM assertions.

Co-Authored-By: Codex <noreply@openai.com>
```
