# Codex read-only review, round three: the server-certified time cursor (option A)

20 Oct 2026. `codex exec -s read-only` on 8965914 + bbe75a8 (rebased on 66557f1). Verdict: NOT READY. Round-two findings 1 (ties) and 3 (race 3) FIXED; finding 2 (backlog) PARTLY FIXED, with two should-fix counterexamples in the same compatibility path. That path has now failed review three times: **held at AGENTS gate 6** for Jamie.

## Independent reproduction (Claude, scratch copy of tools/test-core.js, not committed)

- Counterexample 1 (replay): transaction 99 wrote d at 10:00 and committed, 100 is open, 101 wrote early at 09:00 and committed. The transaction-ordered pull delivers d and holds early behind the fence; time_safe is null, so the time cursor stays null. The person clears the phone and turns backup on again; entries_pull goes missing. The time-ordered pull restores early and d: d comes back. Confirmed.
- Counterexample 2 (inherited skip): as above, but 101 is still open at the first sync. Sync 1 delivers d and certifies (10:00, d). 101 commits; sync 2 sees early held behind fence 100, certifies nothing earlier, and step 4 keeps (10:00, d). A lasting fallback never brings early. Confirmed.

Codex's point stands: a single (synced_at, id) cursor cannot keep early eligible (cursor before 09:00) and exclude d (cursor at or after 10:00) while early < d. Whenever the transaction-ordered pull has delivered rows out of time order, some time cursor is either a skip or a replay for a time-ordered pull. Option A narrows both to that moment; it cannot remove them.

## Options for Jamie (none applied)

- **A2 (recommended): no time-ordered pull once this phone has moved over.** If entries_pull goes missing after a phone holds a transaction cursor (a rollback), the sync stops with a clear message and nothing is pulled until it is back: no replay, no skip. time_safe stays, only for tabs still running an older version during the hand-over, with the weaker guarantee written down (such a tab can skip rows that were still open at an earlier certification, as today's pull can, and after a clear can receive again rows above a held-back row). Add a reload when a new service worker takes over (sw.js already calls skipWaiting and clients.claim; nothing reloads an open tab), so older code does not stay open in future releases. Small change; closes both counterexamples for this version; the older-tab residue is transitional and needs a clear during a backlog.
- **D: an exact time horizon instead of transaction ids.** Pull by (synced_at, id) as today, but only below the start time of the oldest transaction still open (read from pg_stat_activity by a SECURITY DEFINER function), so delivery is contiguous in time and one cursor is right for every client, old or new. A redesign: it needs privileged access to other sessions' transaction start times, a long transaction (any session, read-only included) holds every pull back, and the read of pg_stat_activity races the start of a transaction at the microsecond edge.
- Codex also flagged, as a qualification rather than a failure, that a forced generic plan could turn the OR'd cursor predicates into filters. Measured on the local PostgreSQL 17 with 60,000 rows for one person, a full restore of 61 pages: automatic plans median 27 ms, worst 34 ms a page; `plan_cache_mode = force_generic_plan` median 35 ms, worst 41 ms. Slower, far inside the 8 s statement limit.

## Prompt

```
You are reviewing a branch in the Rhythme PWA repository (current directory), read-only. Do not modify files.

Branch claude/sync-commit-order on origin/main: `git log --oneline origin/main..HEAD`. Your earlier rounds are in
docs/debate/2026-10-20-sync-commit-order-codex-round1.md and round2.md; the design and review record are in
docs/design/2026-10-20-sync-commit-order.md. Round two held the branch at AGENTS gate 6 on round-one finding 1 (the
compatibility time cursor for a fallback or an older-version tab). Jamie chose option A from the round-two record; commit
8965914 implements it. Round three, please review that commit (and anything it touches) as a full independent review.

What option A does: entries_pull (now plpgsql, STABLE) takes the phone's time cursor (p_time_at, p_time_id) and returns
time_safe: the latest (synced_at, id) in the server's collation before which every visible row of the caller has been
delivered or was covered by the hand-over. Steps: (1) the cursor the client will hold after this page, mirroring
ovu-sync.js; (2) the earliest (synced_at, id) among visible rows still after that cursor and not covered (any xid,
above the fence or not); (3) the latest row before it, or the latest of all; (4) never back past the cursor sent
(a (T, null) millisecond cursor means rows before T). The client writes it to pulledSeq/pulledId; if another tab moved
that cursor meanwhile, ours is written only when later by instant (a tie keeps the stored one).

Please:
A. Say FIXED / PARTLY FIXED / NOT FIXED for round two's findings 1 (ties on one instant), 2 (backlog past the cap or
   behind the fence) and 3 (race 3 in tools/db/pull_order_test.py), with reasons.
B. Prove or refute: after any sync, a time-ordered pull from the stored time cursor (a fallback, or a tab on origin/main's
   ovu-sync.js) can skip only rows from transactions that were still running when that time_safe was computed, and
   never sends again a row that reached this phone through the transaction-ordered pull before that sync ended (other
   than the tie-between-two-writers case the note accepts). Look for counterexamples: the hand-over (covered rows,
   the millisecond cursor with a null id), updates that move a row to a later sync_xid and a new synced_at, deletions
   (tombstones), the next-cursor mirror (n = lim, short page, n = 0 with the cursor already at the fence), the
   20,000-row cap across pages within one sync (time_safe comes from the last page only), and the step-4 max.
C. The SQL: correctness of the covered predicate (now written as NOT (...)), NULL handling, the MATERIALIZED CTE, the
   generic-plan risk for the OR'd cursor predicates in plpgsql, timestamptz-to-text in jsonb, the dropped draft
   signatures, grants, and anything that changes behaviour for origin/main clients.
D. The client and tests: validation of time_safe, the movedT rule, the snapshot check now only at hand-over start, the
   new tests 8, 9 and 9b in sharedPullCommitOrder (they should fail on 7822e3c's ovu-sync.js and pass here; you may run
   `node tools/test-core.js`, about a minute), and the pretend server's time_safe against the SQL. Do not run
   tools/db/pull_order_test.py (it drops and recreates a database).

For each defect: severity (blocker / should-fix / nit), file:line, a concrete failing scenario, and the fix.
End with one line: VERDICT: READY or VERDICT: NOT READY (blockers or should-fix items remain).
```

## Reply

Two **should-fix** issues remain. The guarantee in B is false as written. Reviewed read-only; no files changed.

| Round-two finding | Status | Reason |
|---|---|---|
| 1. Ties on one instant | **FIXED** | Without a concurrent cursor writer, the server advances the complete time key using its own ordering. The original clear-then-fallback reproduction passes. |
| 2. Backlog past the cap or behind the fence | **PARTLY FIXED** | The supplied new-phone reproductions pass. An inherited time cursor plus step 4 can still skip committed backlog, as below. |
| 3. Python race 3 | **FIXED** | The open writer receives its XID before the later commits, membership in `xip` is asserted, and the helper follows the client’s hand-over retention/release rule. |

1. **should-fix · [migration:148](supabase/migrations/20261020120000_sync_pull_commit_order.sql), [ovu-sync.js:442](ovu-sync.js): a safe time prefix does not prevent replay above that prefix.**

   Concrete scenario:

   - XID 99 commits `d@10:00`.
   - XID 100 remains open.
   - XID 101 commits `early@09:00`.
   - The transaction pull delivers `d`, holds `early` behind the fence, and returns `time_safe:null`.
   - Clear the phone, restore backup consent, then make the RPC unavailable.

   Reproduced with the actual client and extracted test helpers:

   ```text
   transaction pull: [d]
   stored time:      null
   fallback pull:    [early, d]
   cleared d:        restored
   ```

   This needs one tab and no timestamp tie. The cap scenario has the same problem: keeping the cursor before an undelivered 09:00 row makes the delivered 10:00 rows eligible again.

   This is inherent in a scalar time cursor: keeping `early` eligible requires `cursor < early`; excluding delivered `d` requires `d <= cursor`. Both cannot hold when `early < d`.

   **Fix:** prevent incompatible time pulls while delivery is noncontiguous, including older tabs, or introduce durable delivery/clear acknowledgements honored by every pull path. Adjusting the scalar cursor alone cannot satisfy both guarantees. Extend test 9b with a clear and a duplicate-delivery assertion; its current checks only verify that the missing rows eventually arrive.

2. **should-fix · [migration:158](supabase/migrations/20261020120000_sync_pull_commit_order.sql): step 4 can return a cursor that is unsafe against the current snapshot.**

   Modify the preceding scenario so XID 101 is initially open:

   ```text
   Sync 1: d@10:00 delivered; early@09:00 invisible
           time_safe = (10:00,d), XID cursor = (100,null)

   Commit XID 101; XID 100 remains open.

   Sync 2: early@09:00 is visible but held behind fence 100
           computed prefix is before early
           step 4 restores (10:00,d)

   Fallback: []  // early is skipped
   ```

   This also reproduces with the actual client. XID 101 committed **before Sync 2’s certificate was computed**, disproving B’s current-computation condition. It occurs entirely in transaction mode, without a legacy hand-over.

   **Fix:** distinguish the forward-only inherited position from a currently certified safe prefix. If the current prefix would regress, mark compatibility pulling unsafe and enforce the transition policy. Keeping the maximum supports only a weaker guarantee allowing gaps inherited from earlier certifications. Moving backward alone would create replay.

The remaining SQL and client checks found no additional correctness defect:

- The `NOT (covered)` predicate is NULL-safe with the existing non-null `synced_at`, `id` and `sync_xid` columns. A null-ID millisecond cursor correctly covers rows strictly before T.
- The next-cursor calculation matches the client for full pages, short pages and zero rows when already at the fence. Using the last page’s certificate accounts for remaining backlog across the 20,000-row cap, subject to finding 2.
- Updates move the current row version to its new XID/time; tombstones participate in the same predicates. Neither introduces a separate fence or hand-over defect.
- `STABLE` PL/pgSQL gives all statements the calling query’s snapshot. The materialized CTE is not needed to establish that consistency. [PostgreSQL volatility documentation](https://www.postgresql.org/docs/17/xfunc-volatility.html).
- Signature drops, security-invoker behavior, caller filtering and grants appear correct. Native timestamp-to-JSON conversion retains a timestamp string; I found no serialization defect. [PostgreSQL JSON construction](https://www.postgresql.org/docs/17/functions-json.html).
- Origin/main clients keep their existing GET behavior and time-cursor semantics. They remain exposed to the compatibility failures above.
- `time_safe` validation rejects missing values, invalid timestamps and invalid ID types. `movedT` implements the documented concurrent-writer rule. Snapshot validation now occurs only when hand-over begins.

Performance remains a qualification, not a reproduced failure: `MATERIALIZED still` reads the remaining qualifying rows before finding their minimum. Generic PL/pgSQL plans can leave the OR cursor conditions as filters, causing repeated history scans. The reported benchmark does not establish behavior under a forced generic plan. Check that separately before relying on the index-condition claim. [Materialization](https://www.postgresql.org/docs/17/queries-with.html#QUERIES-WITH-CTE-MATERIALIZATION), [plan caching](https://www.postgresql.org/docs/17/plpgsql-implementation.html#PLPGSQL-PLAN-CACHING).

Verification: **867 passed, 0 failed**. Isolated `sharedPullCommitOrder`: **27/27** here; substituting only `7822e3c`’s client in memory gives **22 passed, 5 failed**, exactly the assertions in tests 8, 9 and 9b. The pretend server matches the relevant SQL branches, including both counterexamples. The destructive database harness was read, never run.

VERDICT: NOT READY