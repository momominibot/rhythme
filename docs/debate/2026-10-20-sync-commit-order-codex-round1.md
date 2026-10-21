# Codex read-only review, round one: sync pull in transaction id order

20 Oct 2026. `codex exec -s read-only` on commit b8daca2 (the first version of this branch). Verdict: NOT READY. The fixes are in the next commit; see the review record in docs/design/2026-10-20-sync-commit-order.md.

## Prompt

```
You are reviewing one commit in the Rhythme PWA repository (current directory), read-only. Do not modify files.

Commit: HEAD (b8daca2) on top of origin/main. See it with `git show HEAD` and read the full files it touches:
ovu-sync.js, supabase/migrations/20261020120000_sync_pull_commit_order.sql, tools/test-core.js (functions withoutCommitPull,
syncServer, syncWorld, sharedPullCommitOrder, and the earlier sync tests that use them), tools/db/pull_order_test.py,
docs/design/2026-10-20-sync-commit-order.md. Context: supabase/migrations/20261019010000_accounts_sync_order_guard.sql
(the trigger), docs/debate/2026-10-20-sync-keyset-cursor-codex-round1.md and round2.md if present (the earlier reviews of
the keyset cursor this builds on).

The problem being fixed: the trigger stamps synced_at = now() (transaction START). A long upload that starts first and
commits after a short one lands behind a cursor that already moved past the short one, and is never pulled.
The fix: stamp sync_xid = pg_current_xact_id(); pull (sync_xid, id) keyset below pg_snapshot_xmin(pg_current_snapshot());
rows from before the migration get sync_xid 0 and an older (synced_at, id) cursor filters only those; the client falls back
to the old time-ordered pull on PostgREST 404 PGRST202 (live server today, migration not applied).

Find real defects. For each: severity (blocker / should-fix / nit), file:line, the concrete failing scenario, and the fix.
Check in particular:
1. Is the fence reasoning sound in PostgreSQL 17 under PostgREST (READ COMMITTED, STABLE SQL function via POST, read only)?
   Same snapshot for fence and rows? Any way a row can appear below a cursor the client holds (including the jump of the
   cursor to the fence on a short page, subtransactions, the stale-update `return old` path, prepared transactions,
   writers blocked on the ALTER's lock, PostgREST plan caching)?
2. The migration: lock behaviour, constant default then volatile default, index, grants, search_path, RLS (security
   invoker), the xid8 casts from text, jsonb shape. Anything that breaks old clients or the consent guard trigger?
3. The hand-over from the time cursor (p_since only for sync_xid 0): can it skip a row or re-send a whole diary?
   Multi-tab and older-version-tab interplay with pulledSeq/pulledId vs pulledXid/pulledXidId.
4. ovu-sync.js: forward-only rule (xidLater) and the movedX check, generation/cancel checks, typed recovery (newTypes now
   also when only pulledXid is set), held rows, the fallback (PGRST202 only, cached per page), error handling, xid text
   comparison, any regression to the time-ordered path.
5. Tests: do the new checks really fail on origin/main's ovu-sync.js and pass here (you may run `node tools/test-core.js`;
   to test against main, compare logic rather than writing files)? Is the pretend server faithful to the SQL function?
   Do the earlier tests still test what they claimed (two hooks were narrowed from /\/entries/ to /\/entries\?on_conflict/)?
6. Is the design note accurate against the PostgreSQL docs it cites? Flag any claim that is wrong or overstated.

End with one line: VERDICT: READY or VERDICT: NOT READY (blockers or should-fix items remain).
```

## Reply

Two should-fix defects remain. Both restore deliberately cleared history. No files changed.

1. **should-fix · [ovu-sync.js:273](ovu-sync.js): cached fallback ignores another tab’s XID progress.**

   Tab A receives PGRST202 before migration and caches `commitPull = false`. After migration, tab B pulls using XIDs, then the person clears the local diary. A still immediately calls `byTime()` using the stale or null time cursor, restoring cleared rows. Reproduced with HEAD code: **zero new RPC attempts, one cleared row restored**.

   An `origin/main` tab has the same problem because commit-mode sync leaves `pulledSeq` unchanged at line 409. A null cursor can re-fetch the whole diary.

   **Fix:** invalidate cached fallback when shared state contains `pulledXid`. Once XID progress exists, an unavailable RPC needs a safe transition policy rather than silently using stale time progress. Older clients require a compatibility rollout or enforced upgrade. Add mixed-tab regression tests.

2. **should-fix · [20261020120000_sync_pull_commit_order.sql:74](supabase/migrations/20261020120000_sync_pull_commit_order.sql): upgrading replays cleared postmigration rows.**

   A legacy client runs against the migrated server, pulls row `r` with `sync_xid = 200`, then the person clears it locally. Its time cursor includes `r`. On upgrading, `e.sync_xid <> '0'` bypasses that cursor, returns `r`, and the empty local store restores it. Reproduced directly.

   **Fix:** preserve local clear intent independently of pull cursors and suppress those replayed rows, with an explicit transition policy for existing installations lacking that record. Applying `p_since` to every XID would reintroduce the original missing-row bug.

   Consequently, the design note’s “harmless” replay claims at lines 124 and 142 are incorrect.

3. **nit · [tools/test-core.js:1102](tools/test-core.js): the pretend server loses XID precision.**

   Its `Number()` conversions and `hi + 1` do not model `xid8`. With one committed row at `"9007199254740992"`, it returns that same value as the fence and **no rows**. PostgreSQL would include the row once the fence advances.

   **Fix:** use `BigInt` internally and decimal strings externally; add adjacent large-XID fixtures. The production text comparator itself looks correct.

4. **nit · [2026-10-20-sync-commit-order.md:1](docs/design/2026-10-20-sync-commit-order.md): the ordering claim is overstated.**

   If A receives the smaller XID but B commits first, the eventual pull returns A before B. This is commit-safe XID order, not chronological commit order. **Fix:** correct that terminology throughout the note and comments. [PostgreSQL transaction identifiers](https://www.postgresql.org/docs/17/transaction-id.html).

The fence reasoning otherwise looks sound under the stated PostgreSQL 17/PostgREST assumptions. STABLE SQL uses the calling statement’s snapshot; POST STABLE runs read-only. Top-level XIDs cover subtransactions, prepared transactions remain in progress, and the inclusive fence jump is safe. I found no additional defect in ALTER locking, defaults, grants, RLS, consent-trigger preservation, stale `RETURN OLD`, or plan caching. [PostgreSQL snapshots](https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-PG-SNAPSHOT), [function volatility](https://www.postgresql.org/docs/17/xfunc-volatility.html), [PostgREST transactions](https://docs.postgrest.org/en/stable/references/transactions.html).

Verification: **832 passed, 0 failed**. Main-source substitution produced **820 passed, 12 failed**; I also independently reproduced those 12 failures in the isolated new checks. The narrowed upload hooks remain meaningful. The PostgreSQL harness was read, not run, because it drops and recreates a database.

VERDICT: NOT READY