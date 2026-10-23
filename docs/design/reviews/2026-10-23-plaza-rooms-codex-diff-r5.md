MERGE

## A. Round-4 items

No remaining P0/P1 found. FIXED rows retain their original severity and need no further fix for that finding.

`SQL` means `supabase/migrations/20261022120000_plaza_rooms_chat.sql`.

| Item | Verdict | Severity | Evidence, result and smallest fix |
|---|---|---|---|
| A7 | **FIXED** | P1 | `SQL:231`, `SQL:551`: the constraint prevents live mode, so every accepted message waits for human review. |
| A10 | **NOT FIXED** | P2 | `ovu-rooms.js:83`, `SQL:324`: `NHSINFORM.SCOT` and `go.help` still pass the refusal rules. **Fix:** recognize hostnames case-insensitively, including short labels, with explicit prose exceptions. |
| Item 4 | **FIXED** | P2 | `ovu-rooms.js:628`, `ovu-friends.js:464`: delayed consent continuations and Friends redraws require the initiating sheet to remain current. |
| B1 | **FIXED** | P2 | `ovu-rooms.js:622`, `ovu-rooms.js:641`: older consent replies cannot override the newer Off state. A separate equality regression appears below. |
| B2 | **FIXED** | P2 | `ovu-consent.js:109`, `ovu-rooms.js:721`: local social, age and chat withdrawals synchronously invalidate pending room results. |
| B3 | **NOT FIXED** | P2 | `ovu-rooms.js:84`, `SQL:322`: `https://findahelpline.com.evil.scot` passes because the exception strips the permitted hostname from a different hostname. **Fix:** validate the complete hostname before exempting it; a following dot cannot terminate the exception. |
| B4 | **NOT FIXED** | P2 | `ovu-rooms.js:95`, `SQL:309`: `Call 5551234` passes because contiguous seven-digit numbers require the additional “me” grammar. **Fix:** recognize contact commands followed by local-number grammar on both sides. |
| B5 | **FIXED** | P2 | `admin.js:308`, `admin.js:367`: post-decision reads create a fresh generation and discard pre-decision replies. |
| B6 | **FIXED** | P2 | `ovu-rooms.js:508`: successful Join updates the currently viewed feed’s membership and invalidates older reads. |
| B7 | **FIXED** | P2 | `admin.js:327`: mode and availability changes participate in the redraw comparison. |
| B8 | **FIXED** | P3 | `ovu-rooms.js:258`, `ovu-rooms.js:355`, `ovu-rooms.js:720`: cached messages expire during outages and on visibility restoration. Its new interaction defect is below. |

The remaining A10, B3 and B4 examples were reproduced against the actual JavaScript module. Their SQL rules contain the same gaps. **Dry run, races, smoke and core all miss these examples.** They reach moderation rather than publishing automatically.

The test-only constraint removal does **not** weaken the shipped review-only boundary: the dry run exercises review submission, writer-only visibility and owner approval before asserting live-mode rejection (`tools/db/plaza_rooms_dryrun.sql:221`, `:243`). The races likewise assert rejection before changing their throwaway database (`tools/db/race_test.py:58`). Post-removal results prove shared behavior under hypothetical live mode, not live-mode safety or approval.

## B. New findings

1. **P2: expiry during an in-flight unchanged-feed response disables all rooms until reload.**  
   `ovu-rooms.js:262`, `:344`: pruning mutates the pending request’s shared `had.seen`, so a valid `same:true, messages:[]` response fails validation and sets `broken:true`.  
   **Smallest fix:** invalidate the pending feed when pruning, or retain an immutable request snapshot and reconcile expiry before installing it.  
   **Tests:** all four suites miss this; reproduced with the actual functions in memory.

2. **P2: a delayed Send restores deleted text after remote Room chat Off has already been observed.**  
   `ovu-rooms.js:320`, `:565`, `:578`: the rooms poll records the newer withdrawal without invalidating pending Send results, allowing the older reply to restore its message and announce Sent.  
   **Smallest fix:** apply withdrawal invalidation when a newly observed server event says Off.  
   **Tests:** all four miss this; smoke covers local withdrawals only. Reproduced in memory.

3. **P2: polling can silently cancel the first message after successful consent.**  
   `ovu-rooms.js:267`, `:622`: if polling observes the successful On event before its HTTP reply arrives, strict event comparison rejects that equal receipt, closes consent and skips the waiting-send continuation and feedback.  
   **Smallest fix:** accept an equal event already known to be On as idempotent success, while rejecting older or conflicting events.  
   **Tests:** all four miss this ordering; actual-function reproduction produced zero continuations and no toast.

4. **P2: ordinary date ranges are refused as contact details.**  
   `ovu-rooms.js:88`, `SQL:309`: `My appointments are 2026-10-22 - 2026-10-23` is rejected because the greedy numeric run combines both dates before checking whether it is a date.  
   **Smallest fix:** recognize date tokens before combining telephone-like numeric runs.  
   **Tests:** all four miss this; reproduced against `textProblem()`.

5. **P3: staff can successfully Show a message that has already expired.**  
   `SQL:649`, `SQL:654`: a decision crossing the 24-hour boundary returns success although the feed’s expiry predicate prevents anyone seeing the message.  
   **Smallest fix:** reject expired rows after locking and before applying the decision.  
   **Tests:** all four miss this boundary; source-derived.

6. **P3: an old account’s cancelled proposal request erases the new staff account’s proposals.**  
   `admin.js:415`: after staff account B loads its proposals, account A’s cancelled request reaches the unconditional catch and replaces B’s list with `[]`.  
   **Smallest fix:** ignore cancelled or obsolete-generation failures before mutating proposal state.  
   **Tests:** all four miss this overlap; reproduced with the actual loader and RPC. The existing loader is exposed by the new cancellation behavior.

Verification: **1,946 core checks passed, zero failed**, and changed JavaScript syntax checks passed. Dry run, database races and browser smoke were inspected, not rerun. No files were edited and no migration was applied.