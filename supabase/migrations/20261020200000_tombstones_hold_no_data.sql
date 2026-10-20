-- Rhythme launch sweep, 20 Oct 2026. NOT APPLIED YET: production migrations wait for Jamie.
-- A deleted entry keeps no contents on the server, whichever app version sent the deletion: the database empties
-- data whenever a row is written as deleted, and empties any deleted row that still has some.
create or replace function public.entries_tombstone_empty() returns trigger language plpgsql as $$
begin
  if new.deleted then new.data := '{}'::jsonb; end if;
  return new;
end $$;
drop trigger if exists entries_tombstone_empty on public.entries;
create trigger entries_tombstone_empty before insert or update on public.entries
  for each row execute function public.entries_tombstone_empty();
update public.entries set data = '{}'::jsonb where deleted and data <> '{}'::jsonb;
