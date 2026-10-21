-- Rhythme sync: pull only writes that are final, in transaction id order, not by the time their transaction started.
-- NOT APPLIED. Applying it to the live project is Jamie's call (AGENTS gate 3). Design: docs/design/2026-10-20-sync-commit-order.md
--
-- The gap. entries_sync_guard (20261019010000) stamps synced_at = now(), which is the START time of the writing
-- transaction. A large upload can start first and commit seconds after a small upload from another phone. A pull that
-- runs between the two commits sees only the small one and moves its cursor past it; the large upload then becomes
-- visible behind the cursor and is never pulled.
--
-- The fix (the transactional outbox pattern). Every write also records the id of the transaction that made it
-- (sync_xid, xid8: 64 bits, never wraps). entries_pull returns rows in (sync_xid, id) order, but only rows whose
-- transaction id is below pg_snapshot_xmin(pg_current_snapshot()): the lowest transaction id still running. Every
-- transaction below it has committed or rolled back, and any transaction that writes later gets a higher id, so no row
-- can ever appear behind a cursor that stays below that fence. This is transaction id order, not the order of commits:
-- a transaction with a lower id that commits later is still delivered before one with a higher id, once both are
-- final. A row from a transaction still running waits for the next pull, so the cost is a delay while an older write
-- is still open (usually milliseconds), never a lost row.
--
-- Rows written before this migration all get sync_xid 0 (no real transaction has id 0). This ALTER takes an ACCESS
-- EXCLUSIVE lock, so it waits for every transaction writing entries to finish and blocks new ones until it commits.
-- The hand-over. A phone that still holds an older (synced_at, id) cursor passes it as p_since/p_since_id. The filter
-- applies only to rows whose transaction had already finished when the hand-over began, the only rows the older
-- version could have pulled: the first page returns its own snapshot, and the phone passes it back as p_handover on
-- every page until its cursor reaches that snapshot's xmax. So nothing the older version already pulled is sent again
-- (rows someone cleared from that phone on purpose stay cleared), while a write that was still open when the hand-over
-- began arrives once it ends, whatever its synced_at. Rows the older version had already lost to the gap stay lost,
-- as before: they look exactly like rows it pulled. From the hand-over's first page on, nothing is lost: the app saves
-- that page's snapshot at once and sends it again on every retry, also after a failed page or upload.
--
-- Ship order (Jamie, R5-B). The app version that uses this function never pulls by time: on a server without it, its
-- sync pauses with a message and nothing is pulled. So this migration is applied first, then the app is released.
--
-- The time cursor. Older app versions (a tab left open, a phone not updated yet) keep paging entries by synced_at,
-- which is still stamped as before. So each page also returns time_safe, a forward-only (synced_at, id) position the
-- new app keeps for them. From the page's own view it is the latest (synced_at, id) before which every visible row of
-- the caller has been delivered to the phone or was covered by the hand-over, bounded by the earliest visible row
-- still after the cursor the phone will hold (rows the 20,000 cap has not reached, rows held behind the fence) and
-- compared in the server's own collation, so ties on one instant and backlog are both handled. But it never moves back
-- past the time cursor the phone sent, so a row that became visible behind an earlier position can stay behind it.
-- It is a compatibility cursor with known gaps for older tabs (docs/design/2026-10-20-sync-commit-order.md,
-- premortem 5), not a guarantee.

-- 1. The writing transaction's id. A constant default only records it in the catalog: the table is not rewritten and
--    the sync trigger does not fire, so no existing row's synced_at changes and no phone pulls anything again. New
--    inserts default to their own transaction id; the trigger below also stamps it on every insert and update.
alter table public.entries add column if not exists sync_xid xid8 not null default '0'::xid8;
alter table public.entries alter column sync_xid set default pg_current_xact_id();

-- 2. The pull walks one person's rows in (sync_xid, id) order; synced_at rides along so time_safe can read the rows
--    still to come from the index alone.
create index if not exists entries_user_sync_xid on public.entries (user_id, sync_xid, id) include (synced_at);

-- 3. The order guard from 20261019010000, unchanged except that each write also records its transaction id.
--    pg_current_xact_id() returns the top-level id inside a subtransaction, which is what snapshots list.
create or replace function public.entries_sync_guard() returns trigger language plpgsql as $$
begin
  if (tg_op = 'UPDATE') then
    -- a write whose edit time is older than the stored row loses; keep the row
    if new.updated_at < old.updated_at then
      return old;
    end if;
  end if;
  new.synced_at = now();
  new.sync_xid = pg_current_xact_id();
  return new;
end $$;

-- 4. One page of the caller's own rows after the cursor, below the fence, with the fence itself.
--    p_after_xid, p_after_id: the cursor. A null id means "from this transaction id on" (the client sets it to the
--      fence when a page comes back short). Ids travel as text, because xid8 can exceed what a JSON number holds.
--    p_since, p_since_id: an older app version's (synced_at, id) cursor, during the hand-over only; a null id is that
--      version's millisecond cursor, taken inclusively.
--    p_handover: the snapshot (pg_snapshot text, 'xmin:xmax:xip_list') the hand-over began with, as this function
--      returned it; null on the hand-over's first page, which uses its own.
--    p_time_at, p_time_id: the phone's time cursor as it stood when this sync began; time_safe never goes back past it.
--    Returns {"fence", "snapshot", "rows", "time_safe": {"at", "id"} or null}, transaction ids as text.
--    The next cursor below is the one the client keeps after this page (the last row of a full page; otherwise the
--    fence, unless the cursor sent is already there), so time_safe describes exactly the position the phone will hold.
--    STABLE: PostgREST runs it in a READ ONLY transaction, and every statement in it uses the snapshot of the calling
--    query, so the fence, the snapshot, the rows and time_safe all come from one view of the table. SECURITY INVOKER
--    (the default), so the "own entries" row level policy applies as well as the explicit user_id test the indexes
--    need. pg_visible_in_snapshot() is exact here because sync_xid is always a top-level transaction id.
-- An earlier draft of this file declared other signatures; drop them in case one was ever applied (two versions with
-- the same argument names would make PostgREST refuse the call as ambiguous).
drop function if exists public.entries_pull(text, text, timestamptz, text, integer);
drop function if exists public.entries_pull(text, text, timestamptz, text, text, integer);
create or replace function public.entries_pull(
  p_after_xid text default null,
  p_after_id text default null,
  p_since timestamptz default null,
  p_since_id text default null,
  p_handover text default null,
  p_time_at timestamptz default null,
  p_time_id text default null,
  p_limit integer default 1000
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  me uuid := auth.uid();
  snap pg_snapshot := pg_current_snapshot();
  fence xid8 := pg_snapshot_xmin(snap);
  hand pg_snapshot := coalesce(p_handover::pg_snapshot, snap);
  ax xid8 := p_after_xid::xid8;
  lim integer := greatest(1, least(coalesce(p_limit, 1000), 1000));
  page jsonb;
  n integer;
  nx xid8;
  nid text;
  low_at timestamptz;
  low_id text;
  safe_at timestamptz;
  safe_id text;
begin
  -- a row is covered by the hand-over when its transaction had ended at the hand-over (so the older version could have
  -- pulled it) and it does not come after the older cursor; covered rows are never sent and count as delivered
  select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('sync_xid', p.sync_xid::text) order by p.sync_xid, p.id), '[]'::jsonb), count(*)
    into page, n
  from (
    select e.*
    from public.entries e
    where e.user_id = me
      and e.sync_xid < fence
      and (ax is null
           or (p_after_id is null and e.sync_xid >= ax)
           or (p_after_id is not null and (e.sync_xid, e.id) > (ax, p_after_id)))
      and not (p_since is not null and pg_visible_in_snapshot(e.sync_xid, hand)
               and case when p_since_id is null then e.synced_at < p_since else (e.synced_at, e.id) <= (p_since, p_since_id) end)
    order by e.sync_xid, e.id
    limit lim
  ) p;

  -- the cursor the client keeps after this page
  if n = lim then
    nx := (page -> (n - 1) ->> 'sync_xid')::xid8;
    nid := page -> (n - 1) ->> 'id';
  elsif n > 0 or ax is null or fence > ax then
    nx := fence;
    nid := null;
  else
    nx := ax;
    nid := p_after_id;
  end if;

  -- the earliest (synced_at, id) of a visible row still to come after that cursor, at or above the fence or not
  with still as materialized (
    select e.synced_at, e.id
    from public.entries e
    where e.user_id = me
      and ((nid is null and e.sync_xid >= nx) or (nid is not null and (e.sync_xid, e.id) > (nx, nid)))
      and not (p_since is not null and pg_visible_in_snapshot(e.sync_xid, hand)
               and case when p_since_id is null then e.synced_at < p_since else (e.synced_at, e.id) <= (p_since, p_since_id) end)
  )
  select s.synced_at, s.id into low_at, low_id from still s order by s.synced_at, s.id limit 1;

  -- every visible row before it has been delivered or was covered: the latest of those is a safe time cursor
  if low_at is null then
    select e.synced_at, e.id into safe_at, safe_id from public.entries e
      where e.user_id = me order by e.synced_at desc, e.id desc limit 1;
  else
    select e.synced_at, e.id into safe_at, safe_id from public.entries e
      where e.user_id = me and (e.synced_at, e.id) < (low_at, low_id) order by e.synced_at desc, e.id desc limit 1;
  end if;

  -- never back past the phone's own time cursor ((T, no id) is an older version's millisecond cursor: rows before T)
  if p_time_at is not null and (safe_at is null
      or (p_time_id is null and safe_at < p_time_at)
      or (p_time_id is not null and (safe_at, safe_id) <= (p_time_at, p_time_id))) then
    safe_at := p_time_at;
    safe_id := p_time_id;
  end if;

  return jsonb_build_object(
    'fence', fence::text,
    'snapshot', snap::text,
    'rows', page,
    'time_safe', case when safe_at is null then null else jsonb_build_object('at', safe_at, 'id', safe_id) end
  );
end $$;

revoke all on function public.entries_pull(text, text, timestamptz, text, text, timestamptz, text, integer) from public, anon;
grant execute on function public.entries_pull(text, text, timestamptz, text, text, timestamptz, text, integer) to authenticated;
