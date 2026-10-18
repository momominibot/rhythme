-- Monotonic pull order + atomic last-write-wins for entries.
-- Applied 19 Oct 2026 to project zodkohwaznqgrfrcfdkf.
--
-- updated_at is the client's own edit time and drives conflict resolution, but
-- it is not a safe cursor for incremental pull: an edit made offline on one
-- phone can be uploaded later with an earlier updated_at and be missed forever.
-- So we add synced_at, a server-stamped arrival time, and the client pulls by
-- it in order. A single BEFORE trigger (a) stamps synced_at on every write and
-- (b) makes a stale update lose at the database boundary, so a slow write that
-- lands after a newer one cannot overwrite it (and a stale tombstone cannot
-- delete newer data).

alter table public.entries add column if not exists synced_at timestamptz not null default now();
create index if not exists entries_user_synced on public.entries (user_id, synced_at);

create or replace function public.entries_sync_guard() returns trigger language plpgsql as $$
begin
  if (tg_op = 'UPDATE') then
    -- a write whose edit time is older than the stored row loses; keep the row
    if new.updated_at < old.updated_at then
      return old;
    end if;
  end if;
  new.synced_at = now();
  return new;
end $$;

drop trigger if exists entries_sync_guard on public.entries;
create trigger entries_sync_guard before insert or update on public.entries
  for each row execute function public.entries_sync_guard();
