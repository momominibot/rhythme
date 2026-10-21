# Cloud sync: Codex read-only review, round five (20 Oct 2026)

Round five was approved by Jamie. Reviewer: codex exec -s read-only (gpt-6.1-sol), on commit 5d2a0f8 (branch claude/sync-round-four, PR 22). Verbatim:

VERDICT: REJECT

1. **major · NEW · [ovu-sync.js:524](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/affectionate-dijkstra-e9307c/ovu-sync.js:524): reset cleanup can erase valid post-reset progress.**  
   A publishes reset token R, then pauses before queuing its tidy-up. B observes R and queues a sync first. B completes successfully under R; A’s subsequent tidy-up sees R still current and replaces B’s valid position with `emptyPos()`.

   I reproduced B returning success, followed by null account, cursor and completion markers. Clearing the diary and syncing again restored the cleared row.

   **Suggested fix:** remove the optional tidy-up, or preserve any position already stamped with R. Add the publish-before-enqueue interleaving. An in-memory conditional-cleanup variant prevented the reproduction.

2. **major · REPEAT, round-four finding 5: consent account binding · [ovu-sync.js:353](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/affectionate-dijkstra-e9307c/ovu-sync.js:353).**  
   The ordinary awaited-response case is fixed, but switching accounts after the liveness check can still affect B. A’s response says backup is off; its guard passes; another tab resets, signs into B and grants backup; A then records its withdrawal with `uid:A`.

   Using the **real auth, store and consent modules**, I reproduced B’s persisted cloud flag changing from `{v:1,uid:B}` to `{v:0}`. Explicit UID attribution does not prevent this: `ovu-consent.js:59,76,94` derives the local switch from the latest purpose event, without account filtering. A stale store snapshot can also overwrite B’s grant.

   **Suggested fix:** make consent reconciliation commit and derive state per account, so recording A’s historical withdrawal cannot overwrite B’s live choice. Coordinate account transitions and reconciliation writes. Another check alone leaves the same window.

   The test double at `tools/test-core.js:1710` hides this distinction by applying withdrawals per UID. Removing both response-liveness guards while retaining explicit UID binding still passes **all six** round-five checks.

The original round-four interleavings now behave as follows:

| Finding | Result |
|---|---|
| 1. Migration during token acquisition | Fixed: position copied before the wait. |
| 2. Account switch superseding reset | Fixed: switches cannot publish reset tokens. |
| 3. Stale null account restarting sync | Fixed: activation uses position ownership. |
| 4. Overlapping resets sharing a generation | Fixed by independent random tokens. |
| 5. Old consent response affecting B | Original case fixed; narrower race remains above. |

I found no additional defect in legacy fallback after reset or first copy, empty-token handling, account-switch versus first-sync rules, held rows, `pushedAt`, profile position writes or `status()`. Every inspected position write carries its invocation’s own token. `wipeCloud()` and `deleteAccount()` inherit finding 1 through `resetPosition()`; their existing token/deletion waits outside the sync lock remain pre-existing limitations. No other new defect found in the remaining diff, including the icons and service-worker version change.

Verification reproduced **925 passed, 0 failed**, and **919 passed, 6 failed** with round-four sync source. Individual mutation results match the reported **1/1/1/1/2** failures, subject to the consent fidelity gap above. Equivalent static checks using stdin passed **81 pages, 0 problems**. The **240 browser checks remain supplied evidence**.

Acceptable residual risk for this patch: the explicitly retained unlocked fallback and whole-outbox races. The latter also affects `profileDirty`: I reproduced a profile edit remaining unsent on both main and this branch. That is a pre-existing follow-up. PR #16’s server commit-order hazard remains separately scoped. Findings 1 and 2 are not acceptable residuals.

No files changed.


## After the review
- Finding 1 (new, introduced by round five's optional tidy-up) is fixed in 9f6ae5b: the tidy-up is gone. A new check
  ("a sync that finishes after a reset keeps its position") fails with the tidy-up restored and passes without it:
  926 passed, 0 failed. Static checks 0 problems, smoke 240 passed. A focused Codex check of that commit is recorded
  below.
- Finding 2 repeats round four's finding 5, so it is held at AGENTS gate 6. Codex is right that the test double hid it:
  it tracked consent per account, while the real ovu-consent.js works out the local cloud switch from the latest
  cloud_sync event of any account (state() over all events, lines 57 to 62), and apply() writes that to the profile.

## Status: held at AGENTS gate 6 (finding 2)

Proposed next step (not applied), in ovu-consent.js rather than the sync:
1. Work out the consent state per account: the current account's own events, plus events made before any account
   (uid null) that bindAccount() has not yet given to an account. A withdrawal recorded for account A then cannot
   change B's switch.
2. apply() updates the profile's cloud flag only from the current account's state.
3. Test with the real ovu-consent.js module, not a double: the late "backup is off" answer for A, the reset, B signing
   in and granting, then A's withdrawal recorded. B's flag must stay on.
Still outside this PR: OvuStore writes its whole store from each tab's in-memory copy, so a stale tab can overwrite
another tab's consent grant (or any other profile change). That is a store-wide multi-tab issue for its own PR. The
outbox's whole writes can also leave a profile edit unsent (profileDirty rolled back), on main and on this branch.

## Focused check of 9f6ae5b (the tidy-up removal), verbatim

VERDICT: ACCEPT

No findings in this commit.

Finding 1 is fixed, including publish-before-enqueue. `status()`, `wipeCloud()`, `deleteAccount()` and legacy fallback do not depend on the removed cleanup. The new test faithfully reproduces the interleaving; the `syncView()` change correctly returns an empty position when a reset key exists without a position.

Reproduced **926 passed, 0 failed**. Restoring cleanup in memory produces **925 passed, 1 failed**, specifically the new regression test.

The consent finding remains held and outside this verdict. No files changed.