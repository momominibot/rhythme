# Sync: pull in the order writes become final

20 Oct 2026. Follows the shared-pull keyset cursor (PR #11, merged into main through #13). Migration
`supabase/migrations/20261020120000_sync_pull_commit_order.sql` is a file only: applying it to the live project is
Jamie's call (AGENTS gate 3).

## The gap

`entries_sync_guard` (20261019010000) stamps `synced_at = now()`. In PostgreSQL `now()` is the start time of the
current transaction and does not change during it [1]. PostgREST runs each request in one READ COMMITTED transaction
[5], so every row of one upload carries the moment that upload's transaction began, not the moment it became visible.

A timeline with three phones:

| time | phone A (large upload) | phone C (one note) | phone B (pulls) |
|---|---|---|---|
| 09:00:00 | begins; 1,500 rows stamped 09:00:00 | | |
| 09:00:02 | still writing | begins, stamped 09:00:02, commits | |
| 09:00:03 | still writing | | pulls; sees only C's row; cursor moves to 09:00:02 |
| 09:00:05 | commits | | |
| later | | | pulls `synced_at > 09:00:02`: A's 1,500 rows are behind the cursor and never arrive |

The keyset cursor from #11 fixed the cut inside one timestamp. It kept this gap, and so did the code before it,
because both order by a time that can be earlier than an already-visible row's time. Two Codex rounds on #11 marked it
as a server-side problem that was there before #11. `tools/db/pull_order_test.py` reproduces it on a real
PostgreSQL 17: the query the app sends today misses all 300 rows of a transaction that commits behind its cursor, and
also misses a row from a transaction that read first and wrote last. That second case matters: transaction ids are
handed out at the first write, so their order can differ from the order transactions started [3].

## What a fix must keep

From #11 and its two review rounds: the server's values are used exactly as written (no rounding); one upload can be
split by a page or by the 20,000-row cap without skipping or re-fetching any of it; the cursor only moves forward, also
when another tab moved it meanwhile; a sync that a sign-out or account switch overtook writes nothing; a phone holding
an older cursor resumes without being handed its whole diary again (rows someone cleared from a phone on purpose must
not come back); and app versions still in the field keep working.

## Options

### A. A pull horizon

Only take rows with `synced_at < server_now - W`, with the server time from an RPC (phone clocks cannot be trusted).

- Correct only while no writing transaction stays open longer than W. PostgreSQL bounds nothing by default:
  `statement_timeout`, `transaction_timeout` and `idle_in_transaction_session_timeout` all default to 0, disabled
  [4]. Supabase sets `statement_timeout` to 8 s for `authenticated` [6], but that is per statement, not per transaction,
  and `service_role` falls back to the authenticator's 8 s while `postgres` is capped at 2 minutes [6]. PostgreSQL 17
  (the live project runs 17.6) has `transaction_timeout`, which could bound the app's role, but not a dashboard script,
  a migration or a prepared transaction ("Prepared transactions are not subject to this timeout" [4]). Breaking the
  assumption loses rows silently, the same failure we are fixing.
- It also assumes the server clock never steps backwards, because it compares wall-clock times (inference: `now()`
  follows the system clock).
- Latency: every row waits at least W, always. With W = 60 s, a note written on one phone stays invisible to the other
  for a minute, and then only shows on that phone's next sync.
- Complexity: low. One RPC and one filter.

### B. A commit-safe watermark (the transactional outbox pattern)

Each write records the id of its transaction, `sync_xid = pg_current_xact_id()`. The pull returns rows in
`(sync_xid, id)` order, but only those with `sync_xid < pg_snapshot_xmin(pg_current_snapshot())` [2][7].

- Correct from documented invariants, not from timing:
  - the snapshot's `xmin` is the "Lowest transaction ID that was still active. All transaction IDs less than xmin are
    either committed and visible, or rolled back and dead" [2];
  - non-virtual transaction ids "are assigned sequentially to transactions from a global counter", "when a transaction
    first writes to the database" [3], so any write that has not happened yet gets an id at or above the fence;
  - `xid8` "includes this epoch and therefore does not wrap around during the life of an installation" [3];
  - inside a subtransaction `pg_current_xact_id()` returns the top-level id, and snapshots list only top-level ids [2];
  - `pg_current_snapshot()` reads the statement's active snapshot (`GetActiveSnapshot()` in `xid8funcs.c` [8]), so in
    one SQL statement the fence and the rows come from the same view of the table.
  So a row below the fence is final, and no row can ever appear below a cursor that stays below the fence.
- Latency: rows wait only while an older writing transaction is still open, normally milliseconds. The outbox
  write-up says the same: queries "may be a bit delayed if our transactions last long" [7]. The worst case is a
  long-running writing transaction anywhere in the cluster (a migration, a dashboard session left open in a
  transaction, a stuck prepared transaction): every pull waits until it ends. Rows arrive late, none are lost. A
  transaction that only reads gets no transaction id [3], so long reads (a backup, a long report) do not hold the fence
  back.
- Complexity: medium. A column, an index, one more line in the trigger, one STABLE SQL function, a new client cursor
  (text, because an `xid8` can exceed what a JavaScript number holds exactly), a hand-over for phones on the time
  cursor, and a fallback for a server without the migration.
- Storage: 8 bytes a row plus an index.

### C. A commit-time sequence under a lock

A deferred constraint trigger takes a per-person advisory lock at commit and stamps a sequence number, so sequence order
is commit order and no fence is needed. It is exact too, but it serialises each person's uploads at commit, needs a
second write of every row (or a set-based rewrite) inside the upload's transaction, and interacts with the order guard's
`return old`. More moving parts than B for the same guarantee.

### D. Logical replication or Supabase Realtime

Commit order is native there, but a browser cannot hold a durable replication slot, and Realtime is a live feed, not a
catch-up log for a phone that was offline for a week. It does not replace the pull.

### Not enough on its own: `clock_timestamp()`

Stamping the actual current time [1] moves the stamp to when the row was written, which is still before the commit.
It narrows the gap and leaves it in place.

## Decision: B

| | A horizon | B xid fence | C commit sequence |
|---|---|---|---|
| no lost rows | only while every transaction is shorter than W | yes, by PostgreSQL's own invariants | yes |
| delay in normal use | W, every time | milliseconds | none |
| what goes wrong | rows lost silently | pulls wait for a stuck transaction | uploads wait on each other |
| moving parts | low | medium | high |

B is the only option that is both exact and cheap at runtime, and its failure mode is a delay rather than a loss. The
`jevauto` planner ranked A first (1.96 of 5 against 1.83 for B) on generic scores, and its plan read the problem as
"pull data modified within a window"; the documented invariants above decide it instead.

Premortem, assuming B failed:

1. *A stuck writing transaction stalls every pull.* Nothing is lost; rows arrive when it ends. To find it:
   `select pid, backend_xid, xact_start, state, left(query, 80) from pg_stat_activity where backend_xid is not null order by xact_start limit 5;`
2. *PostgREST's schema cache has not seen the new function yet.* PostgREST answers 404 `PGRST202` [9]; the app pulls by
   time for that page load, as it does today. Checked on the live project on 20 Oct: an anonymous call to
   `/rest/v1/rpc/entries_pull` returns exactly that.
3. *The migration is applied before the app ships.* Older versions keep paging by `synced_at`, which is still stamped
   as before. Nothing changes for them.
4. *The app ships before the migration.* Same fallback as 2.
5. *The migration is rolled back after phones moved over.* They fall back to the time cursor they kept, and receive
   again the rows since then (harmless: last write wins, and a deleted row arrives as a tombstone). A phone that started
   fresh after the migration has no time cursor and restores in full.
6. *Some other entries_pull failure* (a timeout, a malformed reply) fails the sync and moves nothing. It never falls
   back silently to the pull with the gap.

## The hand-over from the time cursor

Rows written before the migration get `sync_xid = 0`; no real transaction has id 0 (`InvalidTransactionId`). Their
order is already final: the `ALTER TABLE` takes an ACCESS EXCLUSIVE lock, so it waits for every transaction writing
`entries` to finish and blocks new ones until the migration commits. A constant default is stored in the catalog only,
so the table is not rewritten, the trigger does not fire, and no row's `synced_at` changes (checked in the local test).

A phone that still holds a `(synced_at, id)` cursor sends it as `p_since`/`p_since_id`. The server applies it to the
`sync_xid = 0` rows only:

- rows from before the migration that the phone already pulled are not sent again;
- every row written after the migration is sent once, including any that an older app version missed through this very
  gap while it was still running against the migrated server. Some of those the phone already has; receiving them
  again is harmless.
- What it cannot recover: rows from before the migration that an older version already lost to the gap. They sit
  behind the old cursor, mixed with rows the phone has, and only a full re-pull could find them. A full re-pull would
  also bring back rows someone cleared from the phone on purpose, so it is not done.

Once the cursor's transaction id is above 0 the filter has nothing left to apply to, and the phone stops sending it.

## The implementation

- `supabase/migrations/20261020120000_sync_pull_commit_order.sql`: `sync_xid xid8` (constant default 0 for existing
  rows, then `pg_current_xact_id()`), the `(user_id, sync_xid, id)` index, the trigger stamping it, and
  `entries_pull(p_after_xid, p_after_id, p_since, p_since_id, p_limit)`: STABLE (PostgREST runs it READ ONLY [5]),
  security invoker so the "own entries" policy applies, `search_path = ''`, execute for `authenticated` only. It
  returns `{fence, rows}` with ids as text, at most 1,000 rows a page.
- `ovu-sync.js`: `pullShared` tries `entries_pull` and falls back to the time-ordered `pullSince` only on `PGRST202`,
  once per page load. `pullCommitted` pages by `(sync_xid, id)`; when a page comes back short it moves the cursor up to
  the fence, with no id ("from this transaction id on"), so an empty pull is cheap and the hand-over ends cleanly. The
  new cursor lives in `pulledXid`/`pulledXidId`, keeps the forward-only rule across tabs (`xidLater`), and is cleared by
  every reset and account switch. The time cursor is left as it is, for a fallback or a tab still on an older version.
  The typed recovery now also starts for a phone whose only cursor is the new one.

## Verification

- `tools/db/pull_order_test.py` (local PostgreSQL 17, two real sessions, never the live project): 18 checks pass. Today's
  query loses the long upload and the read-first-write-last row; `entries_pull` delivers both, pages 2,500 rows of one
  transaction as 1,000/1,000/500, runs READ ONLY, refuses anonymous callers, never crosses people, and the stale-write
  guard keeps `sync_xid`. With `--mutate` (the fence removed) `entries_pull` loses the long upload again, so the tests
  see the bug the fence guards against.
- `tools/test-core.js`, `sharedPullCommitOrder`, on the shared `syncServer`/`syncWorld`/`syncRow` helpers (the pretend
  server now has open transactions and an `entries_pull` that matches the SQL): 16 checks. Against main's
  `ovu-sync.js`, 12 of them fail (a new phone ends with 3 of 1,503 rows); on this branch all pass, with every earlier
  sync test unchanged.

## Sources

1. PostgreSQL 18 docs, 9.9.5 Current Date/Time: https://www.postgresql.org/docs/current/functions-datetime.html
2. PostgreSQL 18 docs, System Information Functions (pg_current_xact_id, pg_current_snapshot, Table 9.85 Snapshot
   Components): https://www.postgresql.org/docs/current/functions-info.html
3. PostgreSQL 18 docs, 67.1 Transactions and Identifiers: https://www.postgresql.org/docs/current/transaction-id.html
4. PostgreSQL 18 docs, Client Connection Defaults (statement_timeout, transaction_timeout,
   idle_in_transaction_session_timeout): https://www.postgresql.org/docs/current/runtime-config-client.html
5. PostgREST docs, Transactions (access mode by volatility, READ COMMITTED):
   https://docs.postgrest.org/en/stable/references/transactions.html
6. Supabase docs, Timeouts: https://supabase.com/docs/guides/database/postgres/timeouts
7. Oskar Dudycz, Ordering in Postgres Outbox: https://event-driven.io/en/ordering_in_postgres_outbox/
8. PostgreSQL source, `src/backend/utils/adt/xid8funcs.c`, `pg_current_snapshot()`:
   https://doxygen.postgresql.org/xid8funcs_8c_source.html
9. PostgREST docs, Errors (PGRST202, 404): https://docs.postgrest.org/en/stable/references/errors.html

The docs pages above are for PostgreSQL 18; the functions and the `xid8` type used here were added in PostgreSQL 13, and
the live project runs 17.6 (checked 20 Oct with the Supabase project details).
