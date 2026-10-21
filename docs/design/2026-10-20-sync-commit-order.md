# Sync: pull only final writes, in transaction id order

20 Oct 2026. Follows the shared-pull keyset cursor (PR #11, merged into main through #13). Migration
`supabase/migrations/20261020120000_sync_pull_commit_order.sql` is a file only: applying it to the live project is
Jamie's call (AGENTS gate 3).

**Status: R5-B applied (Jamie, 21 Oct), Codex round five below.** Rounds two to four held the branch on the
compatibility path (premortem 5). Jamie chose option A (the server certifies the time cursor, `time_safe`, below);
round three proved that a single time cursor cannot be both skip-free and replay-free once the transaction-ordered pull
has delivered rows out of time order. Jamie then chose A2: a phone that pulls by transaction id stops instead of
pulling by time. Round four found two ways this version could still reach the time-ordered pull, and two defects in the
takeover handling. Jamie chose R5-B: this version has no time-ordered pull at all (a missing `entries_pull` always
pauses the sync), so the migration ships first and the app second; a newer version taking over a page reloads it only
when it is hidden and nothing is unsaved; and "update or first install" is decided from the registration state at load.
The transaction-ordered pull, the fence and the hand-over passed all four rounds.

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
  So a row below the fence is final, and no row can ever appear below a cursor that stays below the fence. This is
  transaction id order, not the order of commits: a transaction with a lower id that commits later is still delivered
  before one with a higher id, once both are final. What it guarantees is that nothing lands behind the cursor.
- Latency: rows wait only while an older writing transaction is still open, normally milliseconds. The outbox
  write-up says the same: queries "may be a bit delayed if our transactions last long" [7]. The worst case is a
  long-running writing transaction anywhere in the cluster (a migration, a dashboard session left open in a
  transaction, a stuck prepared transaction): every pull waits until it ends. Rows arrive late, none are lost. A
  transaction that only reads gets no transaction id [3], so long reads (a backup, a long report) do not hold the fence
  back.
- Complexity: medium. A column, an index, one more line in the trigger, one STABLE SQL function, a new client cursor
  (text, because an `xid8` can exceed what a JavaScript number holds exactly), a hand-over for phones on the time
  cursor, and a pause on a server without the migration (R5-B; earlier rounds fell back to the time-ordered pull).
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
2. *PostgREST's schema cache has not seen the new function yet.* PostgREST answers 404 `PGRST202` [9]. This version
   then pauses the sync with "Cloud backup is paused until the cloud is updated again. Everything stays safe on this
   phone." Nothing is pulled or pushed and no cursor moves; the next sync asks again. Checked on the live project on
   20 Oct: an anonymous call to `/rest/v1/rpc/entries_pull` returns exactly that 404.
3. *The migration is applied before the app ships* (the R5-B order). Older versions keep paging by `synced_at`, which is
   still stamped as before. Nothing changes for them.
4. *The app ships before the migration.* Every phone on the new version pauses its backup until the migration is
   applied (premortem 2): nothing is lost, everything stays on the phone, but nothing is backed up either. So the ship
   order is migration first, then the app.
5. *The migration is rolled back after phones moved over, or a tab still on an older version pulls by time.* Four
   review rounds went here. Following the time cursor from the client's own view (round one) left a tie's id behind and
   could pass rows the 20,000 cap had not reached (round two). A server-certified `time_safe` (round three) fixed ties,
   but no time cursor can keep `early` (09:00, held behind the fence) and exclude `d` (10:00, already delivered), so a
   pull by time either sends `d` again after a clear or, with a cursor kept from an earlier sync, skips `early`. A2
   (pause once a phone holds a transaction cursor) still left two ways back to the time-ordered pull (round four: a
   failed upload that left delivered rows with no saved cursor, and a tab deciding from a stale view of another tab's
   mode). **R5-B (Jamie, 21 Oct):** this version has no pull by time at all. On a server without `entries_pull`, new
   phone or old, the sync pauses with the message above; when `entries_pull` is back it carries on from its cursor or
   hands over from its time cursor. A rollback of the migration therefore pauses backup; it never mixes orders.
   `time_safe` is kept only for a tab still running an older version, which can only pull by time. Such a tab has a
   weaker guarantee, written down and tested: it can skip rows that were still open, or held behind the fence, when an
   earlier `time_safe` was certified, and after a clear it can receive again rows above a held-back row. Older tabs are
   transitional: see 8.
6. *A page asked for `entries_pull` before the migration and was told it is missing.* It remembers nothing about that:
   every sync asks again (round four found the remembered answer was one of the ways back to the time-ordered pull).
7. *Some other entries_pull failure* (a timeout, a malformed reply) fails the sync and moves nothing. It never falls
   back silently to the pull with the gap.
8. *A tab keeps running older code after a newer version ships.* `sw.js` already skips waiting and claims every open
   page, but nothing reloaded a page that was open. Now `ovu-sync.js` listens for `controllerchange` from the moment it
   loads, before the room registers the worker or boots, so an early takeover is not missed. A takeover is an update
   when the page had a controller at load, or had none but its registration already had an active worker (a force
   refresh leaves the page uncontrolled while a worker is active [11]); the first install claiming a fresh page is not.
   On an update the page stops syncing at once (`retire()`: a sync in flight is cancelled at its next check, and
   `syncNow()` answers `{ok: false, reason: 'update'}` with the words "A new version of Rhythme is ready. It opens next
   time you come back.", which the manual sync button shows). It reloads only when it is hidden **and** the room says
   nothing is unsaved: no sheet or form open (so no Luna card), no session, practice, meditation or Morning start
   running, no health file being read or waiting to be picked from, not arranging the room. If something is open it
   waits and checks again each time she leaves the app. The room's note and its safety test are handed over by
   `OvuSync.watchUpdates(onUpdate, canReload)`; an update seen before that gets its note when the room is ready, and no
   reload happens before the room's test exists. Limits: this cannot reach code already in the field before this
   change; it only fires when the service worker itself changes (an app-only change with an identical `sw.js` causes no
   takeover [12], which is why releases bump `VERSION` in `sw.js`; this branch leaves that bump to the merge, since main
   moves it often); and it was tested with a pretend
   service worker, document and location in Node, not in Safari on an iPhone.

## The hand-over from the time cursor

Rows written before the migration get `sync_xid = 0`; no real transaction has id 0 (`InvalidTransactionId`). The
`ALTER TABLE` takes an ACCESS EXCLUSIVE lock, so it waits for every transaction writing `entries` to finish and blocks
new ones until the migration commits. A constant default is stored in the catalog only, so the table is not rewritten,
the trigger does not fire, and no row's `synced_at` changes (checked in the local test).

A phone that still holds a `(synced_at, id)` cursor hands over from it. The older version may have pulled any row
written before, and any written after the migration while it still ran; the person may since have cleared those from
the phone on purpose ("Delete every Rhythme room entry on this device" keeps the cloud copy and the cursor), and they
must not come back. Codex round one found that the first version of this hand-over sent every post-migration row again,
which would restore such cleared rows. The rule now:

- The phone sends its time cursor as `p_since`/`p_since_id`. On the first page the server also returns its own snapshot
  (`pg_current_snapshot()`, text `xmin:xmax:xip_list` [2]); the phone keeps it (`pullSince.snap`) and sends it back as
  `p_handover` on every later page and sync of the hand-over.
- The server applies the time cursor only to rows whose transaction had ended when that snapshot was taken,
  `pg_visible_in_snapshot(sync_xid, handover)`, "was it completed before the snapshot was taken?" [2]. Those are the
  only rows the older version could have pulled. They are sent only if they come after its cursor.
- A row from a transaction still open at the hand-over (in the snapshot's `xip_list`, or at or above its `xmax`) could
  not have been pulled by the older version, so it is sent once it ends, whatever its `synced_at`. The local test shows
  that this snapshot is what keeps it: with each page using its own snapshot instead, that row is dropped.
- The phone stops sending the hand-over once its cursor reaches the snapshot's `xmax`. Every later transaction id was
  still to come at the hand-over, so no later row can be one the older version saw. Until then the hand-over stays
  saved, also across the 20,000-row cap and while an open transaction holds the fence back.

What it cannot recover: rows the older version had already lost to the gap before the hand-over. They sit behind its
cursor, from transactions that had ended, exactly like rows it pulled; only a full re-pull could find them, and that
would also bring back what someone cleared. So they stay lost, as they are today, and from the hand-over on nothing is
lost. Under R5-B the migration ships first, then the app: a phone that loads the new version hands over on its first
sync, so the window is the time between the two releases, during which older versions pull by time as they do today.

One case this does not cover: a tab still on the older version, open at the same time as a newer one, pulling rows after
the hand-over began, which the person then clears. The newer pull may send those again. It needs two versions open
side by side and a clear in between.

## The time cursor the server certifies (`time_safe`)

A `(synced_at, id)` cursor claims a contiguous prefix: every row at or before it has been seen. The transaction-ordered
pull delivers rows in another order, so the phone cannot tell on its own how far that prefix reaches: ids that share an
instant are ordered by the server's collation, and rows the 20,000 cap has not reached, or rows held behind the fence,
can sit earlier in time than rows already delivered. Every page of `entries_pull` therefore computes it:

1. the cursor the phone will hold after this page (the last row of a full page; otherwise the fence, unless the cursor
   sent is already there), exactly as `ovu-sync.js` moves it;
2. the earliest `(synced_at, id)` among the caller's visible rows still after that cursor and not covered by the
   hand-over, at or above the fence or not; a `MATERIALIZED` CTE over the `(user_id, sync_xid, id) include (synced_at)`
   index reads those rows from the index;
3. the latest `(synced_at, id)` before that row (or the latest of all, when nothing is still to come): every visible
   row before it has reached this phone or was covered;
4. never back past `p_time_at`/`p_time_id`, the time cursor this sync started from (a `(T, no id)` millisecond cursor
   counts as "rows before T").

This version never reads that cursor back for a pull of its own (R5-B, premortem 5), except as the start of a
hand-over: it is kept for a tab still on an older version during the transition, with the weaker guarantee in
premortem 5. Because of step 4 it is a forward-only position, not a fresh certificate against the current
snapshot: a row that was still open when an earlier `time_safe` was certified can sit behind it. The phone writes it as its time cursor. If another tab
or an older version moved that cursor meanwhile, ours is written only when it is later by instant. A tie between two writers on one instant keeps the stored one, which can at most send
again rows of that one instant to an older-version tab, after a clear, when two tabs synced at once. The
function is plpgsql and STABLE, so all four steps use the calling statement's snapshot [10]. Cost on a local
PostgreSQL 17 with 60,000 rows for one person: 61 pages, median 35 ms, worst 48 ms each.

## The implementation

- `supabase/migrations/20261020120000_sync_pull_commit_order.sql`: `sync_xid xid8` (constant default 0 for existing
  rows, then `pg_current_xact_id()`), the `(user_id, sync_xid, id)` index, the trigger stamping it, and
  `entries_pull(p_after_xid, p_after_id, p_since, p_since_id, p_handover, p_limit)`: STABLE (PostgREST runs it READ
  ONLY [5]), security invoker so the "own entries" policy applies, `search_path = ''`, execute for `authenticated`
  only. It returns `{fence, snapshot, rows, time_safe}` with transaction ids as text, at most 1,000 rows a page. It
  also takes `p_time_at`/`p_time_id` (above), and drops the two earlier draft signatures in case one was ever applied.
- `ovu-sync.js`: `pullShared` always pulls through `entries_pull`. On `PGRST202` it throws `PULL_PAUSED` and the sync
  stops with nothing moved (R5-B); the time-ordered `pullSince` and the page's remembered "missing" answer are gone.
  `pullCommitted` pages by `(sync_xid, id)`; when a page comes back short it moves the cursor up to the fence, with no
  id ("from this transaction id on"), so an empty pull is cheap. The cursor lives in `pulledXid`/`pulledXidId`, a
  hand-over in progress in `pullSince` (`{at, id, snap}`); the cursor keeps the forward-only rule across tabs
  (`xidLater`), and every reset and account switch clears all three. The time cursor (`pulledSeq`/`pulledId`) starts a
  hand-over and otherwise follows the server's `time_safe`, only for a tab still on an older version. The returned
  snapshot text is checked only when a hand-over begins. The cursor is saved after the uploads, as before: a sync whose
  upload fails pulls the same rows again next time, where they match what the phone already has, instead of finding
  them as unsent local rows and pushing them back up (on a first restore that could be 20,000 rows sent back and pulled
  again by every other phone). The cost is that rows delivered in a failed sync can come back after "Delete every
  entry on this device" if that happens before the next good sync. The update watcher (premortem 8) is armed at load;
  `canSync()` is false once retired. The typed recovery also starts for a phone whose only cursor is the new one. Any
  other `entries_pull` failure fails the sync.
- `room.js` hands `watchUpdates` the note and its "nothing unsaved" test; `ovu-auth.js` shows a retired page's reason
  on the manual sync button instead of "Sync failed".

## Verification

- `tools/db/pull_order_test.py` (local PostgreSQL 17, real concurrent sessions, never the live project): 27 checks pass.
  Today's query loses the long upload and the read-first-write-last row; `entries_pull` delivers both. The hand-over
  sends nothing the older cursor covers and still delivers a write that was open when it began, and the same race with
  each page using its own snapshot drops that write. `entries_pull` pages 2,500 rows of one transaction as
  1,000/1,000/500, runs READ ONLY, refuses anonymous callers, never crosses people, and the stale-write guard keeps
  `sync_xid`. Race 3 checks the open writer's id in the hand-over snapshot's `xip_list` and keeps or drops the
  hand-over by the client's own rule (and shows that ending it at the first short page sends pulled rows again);
  race 4 checks `time_safe` for three rows on one instant, for backlog past a cap (a pull by time from it still brings
  the earlier row), and that it never goes back past the cursor sent. With `--mutate` (the fence removed) `entries_pull` loses the long upload again, so the tests see the bug
  the fence guards against. At 60,000 rows the planner uses `entries_user_sync_xid` with the fence and the cursor as
  index conditions; with `time_safe`, a full 60,000-row restore took 61 pages at a median 35 ms (worst 48 ms).
- `tools/test-core.js`, `sharedPullCommitOrder`, on the shared `syncServer`/`syncWorld`/`syncRow` helpers (the pretend
  server has open transactions, PostgreSQL's snapshot rules with BigInt transaction ids, and an `entries_pull` that
  matches the SQL including `time_safe`, arguments checked against the migration file; with `commit: false` it answers
  `PGRST202` like a server without the migration): 41 checks, including both round-three counterexamples (cases 10 and
  11, case 10 now also proving that `d` first arrived once), the older-tab view of the time cursor, a new phone and an
  old phone on a server without `entries_pull` (cases 2c and 4: both pause, ask again each sync, never pull by time, and
  carry on by transaction id once it answers), and a newer version taking over a page (case 12: a first install is not
  an update; a force-refreshed page's first takeover is; an open form holds the reload until she leaves with nothing
  unsaved; a takeover before the room boots is caught). Tests that relied on the time-ordered pull now run on the
  pretend `entries_pull`. Against main's `ovu-sync.js` (5750a53) 34 of the 41 fail; against round four's (4e4a218)
  the 7 R5-B checks fail; on this branch all pass (1,037 in all).
- `tools/check.py`: 81 pages, 0 problems. `tools/e2e_smoke.py`: 265 of 266 on each of two runs, each failing a different walk or camera timing check (the bed walk's route, a zoomed floor tap) while the machine ran at a load average near 40; none touches sync. A run on untouched main is noted in the PR.

## Review record

- Codex read-only, round one (`docs/debate/2026-10-20-sync-commit-order-codex-round1.md`): NOT READY, two should-fix
  findings and two nits. The fence reasoning, locking, defaults, grants, RLS, the consent trigger and the stale-write
  path were found sound. Fixed: (1) a page that cached "no entries_pull", and tabs on an older version, used a stale
  time cursor after another tab moved over, restoring cleared rows: the time cursor now follows along and the page asks
  again; (2) the hand-over sent every post-migration row again, restoring cleared rows: it now uses the hand-over
  snapshot as above; (3) the pretend server lost precision past 2^53: BigInt, with a test near 2^64; (4) "commit order"
  overstated the guarantee: it is transaction id order once final.
- Codex read-only, round two (`docs/debate/2026-10-20-sync-commit-order-codex-round2.md`): NOT READY. Findings 2, 3 and 4
  of round one FIXED; the hand-over release rule and the pretend server's snapshot model confirmed. Finding 1 PARTLY
  FIXED, with two should-fix defects in the followed time cursor (equal timestamps; backlog past the cap) and one nit in
  the local Postgres race 3. Both defects reproduced independently. Same finding twice: held at AGENTS gate 6.
- Jamie, 20 Oct: option A. Applied: `time_safe` as above, both reproductions as tests (`sharedPullCommitOrder` cases 8
  and 9), race 3 tightened (the open writer takes its id before the later writes, its id is checked in the snapshot's
  `xip_list`, and the helper keeps or drops the hand-over by the client's own rule), race 4 for ties, backlog and
  "never backwards" on real PostgreSQL, and the snapshot checked only when a hand-over begins.
- Codex read-only, round three (`docs/debate/2026-10-20-sync-commit-order-codex-round3.md`): NOT READY. Round-two
  findings 1 and 3 FIXED, 2 PARTLY FIXED: two counterexamples (replay above a held-back row after a clear; a cursor kept
  from an earlier sync skipping a row that became visible behind the fence), both reproduced independently, and a
  proof that a single time cursor cannot avoid both. Third failure on the same path: held at AGENTS gate 6.
- Jamie, 20 Oct: option A2. Applied: `PULL_PAUSED` instead of a time-ordered pull once a phone holds a transaction
  cursor, `time_safe` kept only for older-version tabs with their weaker guarantee tested as such (cases 10 and 11),
  `watchUpdates()`/`retire()` with a reload when out of sight (case 12), and the note in `room.js`.
- Codex read-only, round four (`docs/debate/2026-10-20-sync-commit-order-codex-round4.md`): NOT READY. Round three's
  finding 2 FIXED for its reproduction; finding 1 PARTLY FIXED: a failed upload leaves delivered rows with no saved
  cursor, and a tab can fall back from a stale view of another tab's mode (the first reproduced independently, the
  second confirmed in the code). Two should-fix defects in the takeover handling (an unsaved form lost on a hidden
  reload; a force-refreshed page's first takeover taken for an install). Fourth failure on the same path: held at
  AGENTS gate 6 with options R5-B (recommended: no time-ordered pull in this version, migration first) and R5-A.
- Jamie, 21 Oct: R5-B. Applied: the time-ordered pull and the remembered "missing" answer removed, a missing
  `entries_pull` always pauses (cases 2c and 4), the ship order flipped to migration first; the update watcher armed
  at load, "update" decided from the controller or an active registration at load (a force refresh), and the reload
  held until the page is hidden with nothing unsaved (case 12, `room.js`); case 10 tightened; a retired page's reason
  shown on the manual sync button (round four's nit).
- Codex read-only, round five (`docs/debate/2026-10-20-sync-commit-order-codex-round5.md`): pending.

## Sources

1. PostgreSQL 18 docs, 9.9.5 Current Date/Time: https://www.postgresql.org/docs/current/functions-datetime.html
2. PostgreSQL 18 docs, System Information Functions (pg_current_xact_id, pg_current_snapshot, pg_visible_in_snapshot,
   the `xmin:xmax:xip_list` text form, Table 9.85 Snapshot Components):
   https://www.postgresql.org/docs/current/functions-info.html
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
10. PostgreSQL 18 docs, Function Volatility Categories (STABLE functions use the calling query's snapshot):
   https://www.postgresql.org/docs/current/xfunc-volatility.html
11. W3C Service Workers, 3.4.1 `controller` (returns null for a force refresh):
   https://www.w3.org/TR/service-workers/#navigator-service-worker-controller
12. W3C Service Workers editor's draft, Update algorithm (a byte-for-byte identical script and imports finish the job
   with no new worker): https://w3c.github.io/ServiceWorker/#update-algorithm

The docs pages above are for PostgreSQL 18; the functions and the `xid8` type used here were added in PostgreSQL 13, and
the live project runs 17.6 (checked 20 Oct with the Supabase project details).
