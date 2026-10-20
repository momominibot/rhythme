# Codex read-only review, round two: sync pull in transaction id order

20 Oct 2026. `codex exec -s read-only` on caf13a7 + d75251b (rebased on a49701d). Verdict: NOT READY. Round-one finding 1 failed a second time (PARTLY FIXED), so the branch is **held at AGENTS gate 6**: no round-three repair is applied until Jamie decides.

## Independent reproduction (Claude, scratch copy of tools/test-core.js, not committed)

- Finding 1 (equal timestamps): older cursor (T, a), cloud rows a, b, c all at T. After the hand-over the time cursor stayed at (T, a) with b, c on the phone. The person clears the phone, turns backup on again, and the server loses entries_pull: the time-ordered pull restored b, c (pulls 2, 0, 2). Confirmed.
- Finding 2 (backlog skip): transaction 100 with 20,000 rows at 10:00, transaction 101 with one row at 09:00, both committed. A new phone takes 20,000 (the cap) and its time cursor moves to 10:00; with entries_pull gone for good, the 09:00 row never arrives (pulls 20 x 1000, then 0, 0). Confirmed.
- Finding 3 (race 3 does not exercise the client's snapshot retention): accepted as stated; the JavaScript fixture covers the retained-xip case.

## Proposed round three (NOT applied, for Jamie)

Both defects sit in the compatibility path only (a server that loses entries_pull again, or a tab still running an older version). The transaction-ordered pull itself, the fence and the hand-over were found sound.

- **Option A (recommended): a server-certified time prefix.** entries_pull also returns `time_safe`, computed in SQL with the server's own collation: the latest (synced_at, id) such that every visible row of the caller at or before it has been delivered or was covered by the hand-over (the minimum (synced_at, id) over undelivered visible rows bounds it). The client moves pulledSeq/pulledId to it, only forward. That fixes equal timestamps (finding 1) and skipped backlog (finding 2); the fallback and older tabs are then never worse than today's pull, whose only gap is writes still open. Cost: one more index probe per page, using the existing (user_id, synced_at) index, and a more complex function.
- **Option B: stop following the time cursor.** Once a phone holds a transaction-ordered cursor, a missing entries_pull fails the sync instead of falling back. Tabs on an older version keep their own stale cursor (round-one finding 1 stays open for them until they reload); this version would add a reload when a new service worker takes over (sw.js already calls skipWaiting and clients.claim, but nothing reloads an open tab), so future hand-overs do not linger. Simpler, weaker.
- Either way: finding 3 (give race 3's open writer its id before the later commits, assert it is in xip, and mirror the client's release rule), and validate the returned snapshot text only when a hand-over begins (today every page checks it; a very large snapshot on a busy server would fail every pull).

## Prompt

```
You are reviewing a branch in the Rhythme PWA repository (current directory), read-only. Do not modify files.

Branch claude/sync-commit-order, two commits on top of origin/main: `git log --oneline origin/main..HEAD`, `git diff origin/main..HEAD`.
Round one of your review (on the first commit) is in docs/debate/2026-10-20-sync-commit-order-codex-round1.md; the second
commit answers it. The design and the review record are in docs/design/2026-10-20-sync-commit-order.md.

Problem: the trigger stamps synced_at = now() (transaction START), so a long upload that commits after a short one lands
behind a cursor that already moved past the short one and is never pulled. Fix: sync_xid = pg_current_xact_id(); pull by
(sync_xid, id) below pg_snapshot_xmin(pg_current_snapshot()); fall back to the time-ordered pull on PostgREST 404 PGRST202.

Round two, please:
A. For each round-one finding (1 cached fallback / mixed tabs, 2 hand-over replaying cleared rows, 3 pretend-server
   precision, 4 terminology), say FIXED, PARTLY FIXED or NOT FIXED, with the reason. For finding 2 the new rule is: the
   older (synced_at, id) cursor applies only to rows whose transaction was completed in the hand-over snapshot (the first
   page's pg_current_snapshot(), returned as text and sent back as p_handover, kept in pullSince until the cursor reaches
   its xmax). For finding 1: the transaction-ordered pull also moves pulledSeq/pulledId forward (by instant), and a page
   that cached PGRST202 asks again once pulledXid exists.
B. Look for NEW defects these changes introduced, in particular: can the hand-over now skip a row that the older version
   never pulled (other than rows it had already lost to the gap before the hand-over, which the note says stay lost)?
   Is ending the hand-over at xmax correct when the cursor jumps to the fence, or when the 20,000 cap stops mid-way?
   Can the time cursor that now follows along make an older-version tab or the fallback skip rows that the
   transaction-ordered pull has not delivered yet, and is that acceptable as described in the note? Any problem with the
   pg_snapshot text round trip (size, validation, an attacker-controlled p_handover: it is the caller's own RLS-scoped
   rows, but check), the extra function argument, or PostgREST passing it?
C. Re-check the tests: the new checks fail on origin/main's ovu-sync.js and pass here (you may run node tools/test-core.js);
   the pretend server's snapshot model (xmax one past the highest ended id, xip the running ids below it, xmin the lowest
   of those or xmax) against PostgreSQL; tools/db/pull_order_test.py race 3 (read it; it drops and recreates a database
   named pull_order on whatever RACE_DSN points to, so do not run it).

For each defect: severity (blocker / should-fix / nit), file:line, the concrete failing scenario, and the fix.
End with one line: VERDICT: READY or VERDICT: NOT READY (blockers or should-fix items remain).
```

## Reply

Two **should-fix** defects remain. Reviewed `caf13a7` and `d75251b` read-only. No files changed.

| Round-one finding | Status | Reason |
|---|---|---|
| 1. Cached fallback / mixed tabs | **PARTLY FIXED** | Cached PGRST202 is retried once `pulledXid` exists. The followed time cursor still permits replay and skips, detailed below. |
| 2. Hand-over replays cleared rows | **FIXED** | The frozen snapshot distinguishes completed transactions from transactions still open or future at hand-over. Previously lost legacy-gap rows remain excluded as documented. |
| 3. Pretend-server precision | **FIXED** | XID arithmetic uses `BigInt`; adjacent near-2⁶⁴ fixtures pass. |
| 4. Terminology | **FIXED** | The design and production comments correctly describe transaction ID order once final. |

1. **should-fix · [ovu-sync.js:435](ovu-sync.js): equal timestamps leave the compatibility cursor behind.**

   Start with legacy cursor `(T,a)` and cloud rows `a,b,c`, all stamped `T`. Hand-over delivers `b,c`, but the strictly later-instant condition keeps `pulledId=a`. Clear the local diary, then receive PGRST202: fallback restores `b,c`.

   Reproduced with the actual client: pulls **`[2,2]`**, with both cleared rows restored. A single upload crossing the 20,000 cap has the same problem.

   **Fix:** advance equal-timestamp IDs using the server’s ordering and shared-state reconciliation. Also, `timeLast` currently chooses the last XID-ordered row among timestamp ties, which need not have the greatest time-key ID. Add clear-then-fallback and older-tab regressions.

2. **should-fix · [ovu-sync.js:271](ovu-sync.js): the followed time cursor can skip committed, undelivered backlog.**

   XID 100 contains 20,000 rows stamped 10:00. XID 101 contains a row stamped 09:00 because that transaction began reading earlier and wrote later. Both are committed before pulling.

   The cap stops after XID 100, but the time cursor advances to 10:00. Fallback or an older tab then excludes the undelivered 09:00 row. Reproduced pulls: **`[20000,0,1]`** for XID mode, fallback, then restored RPC.

   XID mode eventually recovers it; persistent fallback does not. This exceeds the note’s stated limitation of **still-open** writes. A normal legacy restore from the original cursor would have delivered this row.

   **Fix:** maintain a server-certified contiguous time prefix, or prevent unsafe fallback and enforce a compatible-version transition. Maximum delivered timestamp alone cannot provide the claimed compatibility guarantee.

3. **nit · [tools/db/pull_order_test.py:205](tools/db/pull_order_test.py): race 3 does not exercise the client’s snapshot-retention path.**

   `open_w` receives its XID after `seen2` commits. In this isolated race it is at or above hand-over `xmax`, so the real client drops hand-over after the first fence jump. The Python helper instead keeps supplying it. The mutation therefore demonstrates SQL filtering behavior, but not the client’s need to retain that snapshot.

   **Fix:** assign the open writer’s XID before the later completed writers, assert it appears in `xip`, and mirror the client’s release rule. The JavaScript fixture already covers the retained-`xip` case.

The hand-over release rule itself is correct. At `cursor.xid >= snapshot.xmax`, every remaining transaction was invisible at hand-over. This holds for a fence jump and a cap stopping inside the `xmax` transaction. Below that boundary, the snapshot remains saved. I found no additional hand-over skip beyond the explicitly accepted legacy losses.

The pretend server’s `xmax`, `xip`, and `xmin` model matches [PostgreSQL’s snapshot definition](https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-PG-SNAPSHOT). Native snapshot casting validates input; caller-controlled snapshots affect only the caller’s filtering, with RLS and the current fence intact. The six named JSON arguments match [PostgREST’s POST argument handling](https://docs.postgrest.org/en/stable/references/api/functions.html#calling-with-post). The client’s 64 KiB snapshot limit rejects oversized replies without advancing progress; it can reject a legitimate large snapshot, but I found no deployment-specific size failure.

Verification: **838 passed, 0 failed** here. Substituting only `origin/main:ovu-sync.js` in memory produced **822 passed, 16 failed**, all within the new checks. The destructive database harness was read, never run.

VERDICT: NOT READY

