-- Plaza groups instead of places. Jamie, 19 Oct: "I don't want location because I'm rolling out to worldwide so maybe
-- menopausal or trying to get pregnant or PCOS group". Nobody had joined the three Singapore places (0 presence rows,
-- 0 daily rows when this ran), so they are replaced outright.
-- Groups are about health, so joining one tells Rhythme something about the account while she is there; the app says
-- so before she joins, and anyone may join any group. A full topic group suggests only the general group, never another
-- health topic. Undo: delete the four rows, re-insert orchard / tiong-bahru / punggol, and restore the v2 bodies.

alter table public.plaza_servers add column if not exists blurb text not null default '' check (length(blurb) <= 80);
alter table public.plaza_servers add column if not exists general boolean not null default false;

delete from staff.plaza_daily where server in ('orchard', 'tiong-bahru', 'punggol');
delete from public.plaza_servers where id in ('orchard', 'tiong-bahru', 'punggol'); -- presence rows cascade (there were none)
insert into public.plaza_servers (id, name, blurb, capacity, sort, general) values
  ('everyone', 'Everyone', 'Any stage, any cycle', 24, 1, true),
  ('trying-to-conceive', 'Trying to conceive', 'Planning or trying for a baby', 24, 2, false),
  ('pcos', 'PCOS', 'Living with polycystic ovary syndrome', 24, 3, false),
  ('menopause', 'Menopause', 'Perimenopause, menopause and after', 24, 4, false)
on conflict (id) do update set name = excluded.name, blurb = excluded.blurb, capacity = excluded.capacity, sort = excluded.sort, general = excluded.general;

create or replace function public.plaza_list() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform staff.plaza_sweep();
  return jsonb_build_object(
    'servers', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'blurb', s.blurb, 'general', s.general, 'capacity', s.capacity, 'open', s.open,
        'people', (select count(*) from public.plaza_presence p where p.server = s.id)) order by s.sort), '[]'::jsonb)
      from public.plaza_servers s),
    'mine', (select p.server from public.plaza_presence p where p.user_id = uid),
    'beat_seconds', 25);
end $$;

create or replace function public.plaza_join(p_server text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); srv public.plaza_servers%rowtype; prev_server text; n integer; fresh boolean; alt jsonb;
        v_day date := (now() at time zone 'Asia/Singapore')::date;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into srv from public.plaza_servers where id = p_server;
  if not found or not srv.open then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform staff.plaza_sweep(); -- takes the one membership lock for the rest of this transaction
  select server into prev_server from public.plaza_presence where user_id = uid;
  fresh := prev_server is distinct from srv.id;
  if fresh then
    select count(*) into n from public.plaza_presence where server = srv.id;
    if n >= srv.capacity then
      -- only a general group is suggested: pointing someone from one health topic to another would be wrong
      select jsonb_build_object('id', s.id, 'name', s.name) into alt from public.plaza_servers s
        where s.open and s.general and s.id <> srv.id and (select count(*) from public.plaza_presence p where p.server = s.id) < s.capacity
        order by s.sort limit 1;
      return jsonb_build_object('ok', false, 'why', 'full', 'server', srv.id, 'name', srv.name, 'capacity', srv.capacity, 'people', n, 'suggest', alt, 'still', prev_server);
    end if;
  end if;
  insert into public.plaza_presence (user_id, server, joined_at, seen_at) values (uid, srv.id, now(), now())
    on conflict (user_id) do update set server = excluded.server, seen_at = now(),
      joined_at = case when public.plaza_presence.server = excluded.server then public.plaza_presence.joined_at else now() end;
  select count(*) into n from public.plaza_presence where server = srv.id;
  insert into staff.plaza_daily (day, server, joins, peak) values (v_day, srv.id, case when fresh then 1 else 0 end, n)
    on conflict (day, server) do update set joins = staff.plaza_daily.joins + excluded.joins, peak = greatest(staff.plaza_daily.peak, excluded.peak);
  return jsonb_build_object('ok', true, 'server', srv.id, 'name', srv.name, 'capacity', srv.capacity, 'people', n, 'beat_seconds', 25);
end $$;

create or replace function staff.plaza_snapshot(p_days integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_day date := (now() at time zone 'Asia/Singapore')::date;
begin
  perform staff.plaza_sweep();
  return jsonb_build_object(
    'stale_seconds', 75,
    'today', v_day,
    'at', now(),
    'now', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'blurb', s.blurb, 'capacity', s.capacity, 'open', s.open,
        'people', (select count(*) from public.plaza_presence p where p.server = s.id)) order by s.sort), '[]'::jsonb)
      from public.plaza_servers s),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'server', d.server, 'joins', d.joins, 'peak', d.peak) order by d.day desc, d.server), '[]'::jsonb)
      from staff.plaza_daily d
      where d.day > v_day - greatest(1, least(coalesce(p_days, 14), 90))));
end $$;

alter function public.plaza_list() owner to postgres;
alter function public.plaza_join(text) owner to postgres;
alter function staff.plaza_snapshot(integer) owner to postgres;
revoke all on function public.plaza_list() from public, anon;
revoke all on function public.plaza_join(text) from public, anon;
revoke all on function staff.plaza_snapshot(integer) from public;
grant execute on function public.plaza_list() to authenticated;
grant execute on function public.plaza_join(text) to authenticated;
grant execute on function staff.plaza_snapshot(integer) to rhythme_staff_fn;
