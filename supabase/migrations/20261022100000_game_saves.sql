-- Game save (22 Oct 2026): hearts, farm, bag, villagers, home and pets follow the signed-in account. One row per
-- account. People read their own row; every write goes through the two functions below, which check a revision so a
-- phone can never overwrite a newer save (it takes the newer one instead), and a deletion stays visible to every phone
-- (deleted = true, rev moves on) instead of disappearing and being recreated by a phone that missed it.
-- Nothing in the save is diary data: the client saves only game fields (no letters, no diary dates, no hearts log).
create table if not exists public.game_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  save jsonb not null default '{}'::jsonb check (jsonb_typeof(save) = 'object' and pg_column_size(save) <= 262144),
  rev bigint not null default 0 check (rev >= 0),
  deleted boolean not null default false,
  ops text[] not null default '{}'::text[] check (cardinality(ops) <= 20),
  saved_at timestamptz not null default now()
);
alter table public.game_saves enable row level security;
revoke all on public.game_saves from anon, authenticated, public;
grant select on public.game_saves to authenticated;
drop policy if exists game_saves_own_select on public.game_saves;
create policy game_saves_own_select on public.game_saves for select to authenticated using (user_id = (select auth.uid()));

-- Write when the phone saw the latest revision; otherwise return the current row, which the phone takes as the true copy.
-- p_op names the write; the last twenty are kept, so a write sent again after a lost answer is reported as done and never
-- applied twice, even when another phone saved in between.
create or replace function public.game_save_put(p_save jsonb, p_base bigint, p_op text default null)
returns table (ok boolean, rev bigint, save jsonb, deleted boolean)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cur public.game_saves;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if p_save is null or jsonb_typeof(p_save) <> 'object' or pg_column_size(p_save) > 262144 then raise exception 'bad save' using errcode = '22023'; end if;
  insert into public.game_saves (user_id, save, rev, deleted) values (uid, '{}'::jsonb, 0, false) on conflict (user_id) do nothing;
  select * into cur from public.game_saves g where g.user_id = uid for update;
  if p_op is not null and p_op = any(cur.ops) then
    return query select true, cur.rev, cur.save, cur.deleted; return;
  end if;
  if cur.rev <> coalesce(p_base, -1) then
    return query select false, cur.rev, cur.save, cur.deleted; return;
  end if;
  update public.game_saves g set save = p_save, rev = cur.rev + 1, deleted = false, ops = case when p_op is null then cur.ops else (array[left(p_op, 64)] || cur.ops)[1:20] end, saved_at = now() where g.user_id = uid;
  return query select true, cur.rev + 1, p_save, false;
end $$;

-- "Delete my cloud copy": empty the save and mark it deleted; the revision moves on so every phone sees it.
create or replace function public.game_save_delete()
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r bigint;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  insert into public.game_saves as g (user_id, save, rev, deleted) values (uid, '{}'::jsonb, 1, true)
    on conflict (user_id) do update set save = '{}'::jsonb, rev = g.rev + 1, deleted = true, ops = '{}'::text[], saved_at = now()
    returning g.rev into r;
  return r;
end $$;

revoke all on function public.game_save_put(jsonb, bigint, text) from public, anon;
revoke all on function public.game_save_delete() from public, anon;
grant execute on function public.game_save_put(jsonb, bigint, text) to authenticated;
grant execute on function public.game_save_delete() to authenticated;
