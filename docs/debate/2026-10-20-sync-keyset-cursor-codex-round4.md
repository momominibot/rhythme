# Shared pull keyset cursor: Codex read-only review, round four (20 Oct 2026)

Round four was approved by Jamie for main. Reviewer: codex exec -s read-only (gpt-6.1-sol), on commit 2edf19e (branch claude/sync-round-four). Verbatim:

VERDICT: REJECT

1. **major · REPEAT (round-three finding 3: legacy cursor rollback) · `ovu-sync.js:303,315-316`**  
   Migration still follows the token wait. With Web Locks enabled, I started with legacy cursor T2 and no pull key, stalled `a.token()`, then applied another tab’s stale main-object snapshot at T1. After token resolution, the sync restored the deliberately cleared T2 row and returned success.  
   **Fix:** materialize the captured legacy position, including typed-recovery fields, under the lock before awaiting the token. Add this token-wait interleaving.

2. **major · REPEAT (round-three findings 1 and 2: reset cancellation) · `ovu-sync.js:309,507`**  
   An old invocation can supersede a reset through the account-switch branch. A passes its generation check and reads main state naming an old account; B resets to generation 1; A then executes `gen0 = bumpGen()`, adopts generation 2 and continues. B’s locked completion skips repair because its generation no longer matches. I reproduced restored history, account, cursor and completion markers surviving the reset.  
   **Fix:** prevent a running sync from replacing an intervening reset’s invalidation marker. Protect account transitions separately or transactionally; another check followed by an unconditional bump leaves the same window.

3. **major · NEW · `ovu-sync.js:310-314`**  
   A stale account field can erase the protected pull position. B captures main state with `userId:null` before A’s first activation. A completes and saves cursor T1; B’s delayed whole-object write restores the null account. After the person clears the diary, the next same-account sync enters activation, calls `savePull({})` and downloads T1 again. I reproduced this with Web Locks enabled.  
   **Fix:** protect the pull position’s account ownership too. An established same-account cursor must not be discarded solely because the independently writable main object says no account. Test snapshots captured before activation.

4. **major · NEW · `ovu-sync.js:54,500`**  
   Concurrent resets can reuse a generation. A reads 0 and pauses before writing; B resets to 1 and queues a sync capturing 1; A resumes and also writes 1. With FIFO locks, B’s sync can run between the reset completions, pass cancellation and restore history. The final reset clears progress but leaves the restored diary row. I reproduced this with two tabs.  
   **Fix:** give every reset a unique invalidation token or use a transactional generation update. Add overlapping-reset coverage.

5. **major · NEW, pre-existing gap · `ovu-sync.js:337-339`**  
   Consent preflight processes an awaited response without rechecking the captured account or generation. I reproduced this using the real consent module: A’s request waits; reset and sign into B; grant B backup consent; resolve A’s response with `cloud_sync.on=false`. The old continuation records a withdrawal under **B**, marks it `sent:true`, and switches B’s backup off.  
   **Fix:** validate cancellation before processing the response or flushing, and bind consent application to the response’s captured account rather than the current UID.

Round-three disposition:

| Finding | Result |
|---|---|
| 1: reset/write race | Ordinary completion is repaired; finding 2 above bypasses repair. |
| 2: late generation capture | Original token/queue cases pass; reset invalidation remains vulnerable. |
| 3: migration rollback | Still open during token acquisition. |
| 4: unlocked cursor race | Intentionally unchanged; acceptable residual risk under the stated policy. |
| 5: requests holding the lock indefinitely | Fixed for the inspected `runSync()` request paths. |

I independently reproduced **849 passed, 0 failed** and the **81-page static checks** using stdin instead of temporary files. The nine new checks fail against main in isolation, and the individual mutations reproduce the reported **4/1/1/2** failures. They are sensitive to the intended changes but miss the interleavings above.

The pretend manager faithfully models the used exclusive, FIFO, asynchronous and promise-held behavior. Its single-thread storage shim needs explicitly injected interleavings. This matches the relevant [Web Locks semantics](https://w3c.github.io/web-locks/).

I found no additional defect in timeout settlement, timer cleanup, response-body coverage or abort/success races. `withLock()` avoids rerunning a failed callback. `wipeCloud()` and `deleteAccount()` retain pre-existing unbounded waits outside the sync lock; I do not treat those as round-four blockers. PR 16’s server commit-order issue remains outside scope.

During review, an uncommitted amendment appeared that fixes the original browser abort assertion’s cleanup ordering by inspection. I did not make that change or rerun Chromium against it; the supplied **187/0** browser result remains supplied evidence. I made no file changes.
## After the review
- The browser abort check Codex saw being amended was committed with the round-four PR. It now inspects only failures
  recorded before the harness lets go of the held request. Re-run on the branch: 187 passed, 0 failed. Re-run with
  main's ovu-sync.js: both real-browser checks fail (185 passed, 2 failed).

## Status: held at AGENTS gate 6, third time

Findings 1 and 2 repeat round three's. Findings 3 and 4 are new and of the same family. Finding 5 is new to the review,
but the code was already like this before round four, and it is the most consequential: an old consent pre-flight
response can switch off another account's backup after a sign-out and sign-in. Round four fixed round three's finding
5 (a stalled request holding the lock for every tab).

Why the family keeps coming back: the sync position still has writers outside the lock. These are the immediate half of
a reset, the account-switch bump inside a sync, the activation that trusts `userId` from the main object (which
onStoreChange writes whole in any tab), and numeric generations that two tabs can both compute.

Proposed round five (not applied): one writer for the position.
1. Everything that says where this phone is (userId, pushedAt, held, profilePulledAt, lastSyncAt, the cursor and the
   typed recovery) moves into the locked position key. The main object keeps only what onStoreChange owns: shadow,
   tombstones, profileDirty.
2. A reset publishes a fresh random token in its own key. Nothing else writes that key, the account switch included,
   and two resets never share a value. The position records the token it was written under; a position whose token
   is not the current one reads as empty. So a reset needs no immediate position write, and only the lock holder
   ever writes the position.
3. A sync reads the token before queuing, and at grant (before the token wait) moves an older version's position
   into the new key and makes the activation decision from the position key, never from the main object.
4. The consent pre-flight checks the token and the account before it uses a response, and records any withdrawal for
   the account it asked about, not the one signed in now.
