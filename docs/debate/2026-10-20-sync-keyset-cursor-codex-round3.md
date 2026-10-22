# Shared pull keyset cursor: Codex read-only review, round three (20 Oct 2026)

Round three was approved by Jamie after the gate-6 hold. Reviewer: codex exec -s read-only (gpt-6.1-sol), on commit 155a8ec. Verbatim:

VERDICT: REJECT

1. **major · REPEAT (round-two finding 2: incomplete reset cancellation) · `ovu-sync.js:363–388, 391, 442–445, 476`**  
   A reset can still land between `live()` and the following storage write. I reproduced this with Web Locks enabled: A passes the check, B resets, then A reads the new pull object and commits its old cursor under B’s epoch. The deferred reset sees equal epochs and skips repair. Equivalent interleavings restore `profilePulledAt`; at line 391, A restores `lastSyncAt` and returns success after the reset.  
   **Fix:** invalidate immediately through a marker sync commits cannot overwrite, then complete the latest reset under the shared lock. Epoch equality alone cannot prove the reset remains intact.

2. **major · REPEAT (round-two finding 2: same-account reactivation) · `ovu-sync.js:274–291`**  
   The generation is captured after waiting for both the lock and token. I reproduced both cases: reset while `token()` waits, and queue a sync before resetting and reactivating the same account. The old invocation adopts the new epoch, restores history and writes completion markers. The deferred repair again skips it.  
   **Fix:** capture the invocation’s generation before enqueueing; validate upon lock grant and after token acquisition, before activation writes or requests.

3. **major · REPEAT (round-two finding 1: cursor rollback) · `ovu-sync.js:50–53, 363–373`**  
   Migration remains vulnerable even with Web Locks. Start with a legacy main-object cursor at T2 and no dedicated pull key. During an empty pull, another tab saves a stale main object at T1. Because `incRows.length === 0`, the commit permanently migrates T1. I verified that the next sync restores a deliberately cleared T2 row.  
   **Fix:** materialize the captured legacy position in its dedicated key before network waits, under the lock and reset guard. Preserve typed-recovery metadata too.

4. **major · REPEAT (round-two finding 1: non-atomic cursor update) · `ovu-sync.js:69–71, 363–373`**  
   Missing or rejected Web Locks requests run unlocked, preserving the original race between sync commits. I injected B’s T2 cursor after A read its position but before A saved T1; A overwrote T2.  
   **Fix:** provide transactional serialization for this path, or return an unavailable result when serialization cannot be acquired.

5. **major · NEW · `ovu-sync.js:70, 209–218, 285`**  
   A pending token, fetch or response-body promise now holds the origin-wide lock indefinitely. I stalled A’s fetch and verified that B could not reach token acquisition; deferred reset repair also remained queued. Previously, the stalled sync blocked its own tab.  
   **Fix:** bound and cancel network work so the callback settles and releases the lock. A timeout must also prevent late continuation writes.

The supplied reset-during-POST and same-account reactivation tests now pass, but the findings remain open through these narrower interleavings.

Verified mutation results match exactly:

| Sync source | Passed | Failed |
|---|---:|---:|
| PR 5 head | 613 | 14 |
| `f38599b` | 618 | 9 |
| `81e43f5` | 621 | 6 |
| `155a8ec` | 627 | 0 |

The pretend manager correctly implements the used exclusive, FIFO, asynchronous-grant and promise-settlement behavior. Its microtask scheduling and single-thread storage shim do not reproduce independent tab interleavings automatically. This matches the relevant [Web Locks semantics](https://w3c.github.io/web-locks/#locks).

Ordinary profile edits continue syncing; withdrawal cancels with idle status. Account switching preserves `lastSyncAt`, while reset clears it. Both JavaScript syntax checks pass. No further defects found in the full diff. The 139 browser checks remain supplied evidence. No files edited.
## Status: held at AGENTS gate 6 again

Findings 1 to 4 repeat round two's, through narrower interleavings. Finding 5 is new and was introduced by round
three. Nothing below is applied.

Why the repeats keep coming: localStorage has no compare-and-set. Every "check, then write" that is not inside the
one cross-tab mutex (the Web Lock) leaves a window, however small, for another tab to write in between. Round three
put syncs inside the lock but left resets, the lock-free fallback and the migration read outside it.

Proposed round four (not applied):
1. Resets apply under the lock. `resetPosition()` writes only an immediate reset marker (its own key, which a sync
   never writes), then performs the reset of the pull key and main state inside the lock. A sync that slips a write
   in just before the marker is overwritten when the reset runs, because the reset's lock request is queued ahead of
   any later sync. Commits write the epoch they started with, never one they read.
2. The generation is captured when `syncNow()` is called, before queuing for the lock, and checked at grant, after
   the token, and before every request and write.
3. The legacy position is written to its own key under the lock at the start of the first sync, before any network
   wait, typed-recovery fields included.
4. Every request (the token refresh, each REST call and its body) gets a time limit through AbortController. A sync
   that times out stops as cancelled and writes nothing late, so the lock is always released.
5. Browsers without Web Locks (Safari before 15.4): keep the unlocked fallback and document the remaining window, or
   refuse to sync there with a message. Recommendation: keep the fallback; the window needs two tabs of an old
   browser syncing in the same millisecond.

## What happened next
PR 11 had already been closed as superseded by PR 13 when round three landed on its branch, so round three never
reached main. Main carries PR 13's own lock and generation (8fecd86), which has the same open findings. Jamie approved
round four for main ("Port round four to main as a new draft PR", 20 Oct): see the round-four PR and
docs/debate/2026-10-20-sync-keyset-cursor-codex-round4.md.
