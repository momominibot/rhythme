-- Game save (22 Oct 2026): hearts, farm, bag, villagers, home and pets follow the signed-in account. One row per account,
-- readable and writable only by that account. Nothing in it is diary data: the client scrubs the hearts log to times and
-- points before saving. Deleting the account deletes the row.
create table if not exists public.game_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  save jsonb not null check (jsonb_typeof(save) = 'object' and pg_column_size(save) <= 262144),
  saved_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.game_saves enable row level security;
revoke all on public.game_saves from anon, public;
grant select, insert, update on public.game_saves to authenticated;
drop policy if exists game_saves_own_select on public.game_saves;
drop policy if exists game_saves_own_insert on public.game_saves;
drop policy if exists game_saves_own_update on public.game_saves;
create policy game_saves_own_select on public.game_saves for select to authenticated using (user_id = (select auth.uid()));
create policy game_saves_own_insert on public.game_saves for insert to authenticated with check (user_id = (select auth.uid()));
create policy game_saves_own_update on public.game_saves for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create or replace function public.game_saves_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists game_saves_touch on public.game_saves;
create trigger game_saves_touch before update on public.game_saves for each row execute function public.game_saves_touch();
grant delete on public.game_saves to authenticated;
drop policy if exists game_saves_own_delete on public.game_saves;
create policy game_saves_own_delete on public.game_saves for delete to authenticated using (user_id = (select auth.uid()));
