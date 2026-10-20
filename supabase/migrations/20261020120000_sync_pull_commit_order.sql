-- Rhythme sync: pull in the order writes become final, not in the order transactions started.
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
-- can ever appear behind a cursor that stays below that fence. A row from a transaction still running waits for the
-- next pull, so the cost is a delay while an older write is still open (usually milliseconds), never a lost row.
--
-- Rows written before this migration all get sync_xid 0 (no real transaction has id 0). Their order is final already:
-- this ALTER waits for every transaction writing entries to finish, and blocks new ones until it commits. A phone that
-- still holds an older (synced_at, id) cursor passes it as p_since/p_since_id: that filter applies to those rows only,
-- so it takes the rows it has not seen yet and is not handed its whole diary again. Every row written after this
-- migration reaches it once, including rows an older app version missed through the very gap closed here.
--
-- Old app versions keep working unchanged: they still page entries by synced_at, which is still stamped as before.

-- 1. The writing transaction's id. A constant default only records it in the catalog: the table is not rewritten and
--    the sync trigger does not fire, so no existing row's synced_at changes and no phone pulls anything again. New
--    inserts default to their own transaction id; the trigger below also stamps it on every insert and update.
alter table public.entries add column if not exists sync_xid xid8 not null default '0'::xid8;
alter table public.entries alter column sync_xid set default pg_current_xact_id();

-- 2. The pull walks one person's rows in (sync_xid, id) order.
create index if not exists entries_user_sync_xid on public.entries (user_id, sync_xid, id);

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
--    p_since, p_since_id: an older app version's (synced_at, id) cursor, for rows from before this migration only.
--    Returns {"fence": "<xid8>", "rows": [...]}, each row with its sync_xid as text.
--    STABLE: PostgREST runs it in a READ ONLY transaction. SECURITY INVOKER (the default), so the "own entries" row
--    level policy applies as well as the explicit user_id test the index needs. pg_current_snapshot() reads the
--    statement's own snapshot, so the fence and the rows come from the same view of the table.
create or replace function public.entries_pull(
  p_after_xid text default null,
  p_after_id text default null,
  p_since timestamptz default null,
  p_since_id text default null,
  p_limit integer default 1000
) returns jsonb language sql stable set search_path = '' as $$
  with fence as (
    select pg_snapshot_xmin(pg_current_snapshot()) as xmin
  ), page as (
    select e.*
    from public.entries e, fence f
    where e.user_id = auth.uid()
      and e.sync_xid < f.xmin
      and (p_after_xid is null
           or (p_after_id is null and e.sync_xid >= p_after_xid::xid8)
           or (p_after_id is not null and (e.sync_xid, e.id) > (p_after_xid::xid8, p_after_id)))
      and (p_since is null
           or e.sync_xid <> '0'::xid8
           or (p_since_id is null and e.synced_at >= p_since)
           or (p_since_id is not null and (e.synced_at, e.id) > (p_since, p_since_id)))
    order by e.sync_xid, e.id
    limit greatest(1, least(coalesce(p_limit, 1000), 1000))
  )
  select jsonb_build_object(
    'fence', (select xmin from fence)::text,
    'rows', coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object('sync_xid', p.sync_xid::text) order by p.sync_xid, p.id) from page p), '[]'::jsonb)
  )
$$;

revoke all on function public.entries_pull(text, text, timestamptz, text, integer) from public, anon;
grant execute on function public.entries_pull(text, text, timestamptz, text, integer) to authenticated;
