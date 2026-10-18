-- Rhythme accounts + cloud backup: prepare entries/profiles for client-driven,
-- last-write-wins sync. Applied 19 Oct 2026 to project zodkohwaznqgrfrcfdkf.
--
-- The local store (ovu-store.js) is the source of truth. The browser sends each
-- row's own updated_at (its edit time in the diary), so conflict resolution runs
-- on one clock and the server must NOT stamp its own now() on upsert: the
-- touch_updated_at triggers from 20261018110000_sync are dropped. Deletions are
-- tombstones (deleted = true plus deleted_at). The 'weight' entry type the local
-- store already writes is allowed. RLS from the sync migration is unchanged:
-- each authenticated user reads and writes only rows where auth.uid() = user_id.

-- 1. let 'weight' entries sync (OvuStore.TYPES includes it)
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.entries'::regclass and contype = 'c' loop
    execute 'alter table public.entries drop constraint ' || quote_ident(c);
  end loop;
end $$;
alter table public.entries
  add constraint entries_type_check
  check (type in ('sleep','period','symptom','food','reflection','mindfulness','weight'));

-- 2. tombstone timestamp for last-write-wins deletions
alter table public.entries add column if not exists deleted_at timestamptz;

-- 3. the client owns updated_at (its event edit time), so the server must not
--    overwrite it on upsert; drop the touch triggers added by the sync migration
drop trigger if exists entries_touch on public.entries;
drop trigger if exists profiles_touch on public.profiles;

-- 4. the (user_id, updated_at) index the incremental pull needs (idempotent)
create index if not exists entries_user_updated on public.entries (user_id, updated_at);
