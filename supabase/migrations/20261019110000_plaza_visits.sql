-- Plaza groups, third cut (Jamie approved one more round after the second Codex review, 19 Oct):
-- * every membership is a visit with its own id: join returns it, check-in and leave must name it, so a late or
--   duplicate request can only touch its own visit, never a newer visit to the same group;
-- * a check-in whose visit was replaced while the row still exists answers "displaced" (the same account joined from
--   another phone), and the displaced phone stops instead of taking the row back;
-- * the sweep that every call runs records the busiest count seen today before it removes anyone, so a group that
--   empties just after midnight still has its day, and it deletes daily counts older than a year;
-- * times are read after the lock is taken (clock_timestamp), so a long wait cannot make a check-in look old.
-- Undo: drop column visit, restore the v2 / groups bodies, recreate plaza_beat(text) and plaza_leave(text).

alter table public.plaza_presence add column if not exists visit uuid not null default gen_random_uuid();

create or replace function staff.plaza_sweep() returns void
language plpgsql security definer set search_path = '' as $$
declare t timestamptz; v_day date;
begin
  perform pg_advisory_xact_lock(hashtext('plaza:membership'));
  t := clock_timestamp(); v_day := (t at time zone 'Asia/Singapore')::date;
  insert into staff.plaza_daily (day, server, joins, peak)
    select v_day, p.server, 0, count(*) from public.plaza_presence p where p.seen_at > t - interval '75 seconds' group by p.server
  on conflict (day, server) do update set peak = greatest(staff.plaza_daily.peak, excluded.peak);
  delete from public.plaza_presence where seen_at <= t - interval '75 seconds';
  delete from staff.plaza_daily where day < v_day - 365; -- daily counts are kept for a year
end $$;
drop function if exists staff.plaza_peak(text);

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
        t timestamptz; v_day date; v_visit uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into srv from public.plaza_servers where id = p_server;
  if not found or not srv.open then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform staff.plaza_sweep(); -- takes the one membership lock for the rest of this transaction
  t := clock_timestamp(); v_day := (t at time zone 'Asia/Singapore')::date;
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
  -- the same group again keeps its visit (a repeated join is harmless); a different group, or a lapsed one, is a new visit
  insert into public.plaza_presence (user_id, server, visit, joined_at, seen_at) values (uid, srv.id, gen_random_uuid(), t, t)
    on conflict (user_id) do update set
      visit = case when public.plaza_presence.server = excluded.server then public.plaza_presence.visit else excluded.visit end,
      joined_at = case when public.plaza_presence.server = excluded.server then public.plaza_presence.joined_at else excluded.joined_at end,
      server = excluded.server, seen_at = excluded.seen_at
    returning visit into v_visit;
  select count(*) into n from public.plaza_presence where server = srv.id;
  insert into staff.plaza_daily (day, server, joins, peak) values (v_day, srv.id, case when fresh then 1 else 0 end, n)
    on conflict (day, server) do update set joins = staff.plaza_daily.joins + excluded.joins, peak = greatest(staff.plaza_daily.peak, excluded.peak);
  return jsonb_build_object('ok', true, 'server', srv.id, 'name', srv.name, 'capacity', srv.capacity, 'people', n, 'visit', v_visit, 'beat_seconds', 25);
end $$;

drop function if exists public.plaza_beat(text);
create or replace function public.plaza_beat(p_server text, p_visit uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform staff.plaza_sweep();
  update public.plaza_presence set seen_at = clock_timestamp() where user_id = uid and server = p_server and visit = p_visit;
  if not found then
    if exists (select 1 from public.plaza_presence where user_id = uid) then
      return jsonb_build_object('ok', false, 'displaced', true); -- this account joined again elsewhere (another phone): stop, do not take it back
    end if;
    return jsonb_build_object('ok', false, 'rejoin', true); -- quiet too long: join again, capacity is checked again
  end if;
  select count(*) into n from public.plaza_presence where server = p_server;
  return jsonb_build_object('ok', true, 'server', p_server, 'visit', p_visit, 'people', n);
end $$;

drop function if exists public.plaza_leave(text);
create or replace function public.plaza_leave(p_server text default null, p_visit uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform staff.plaza_sweep();
  delete from public.plaza_presence where user_id = uid and (p_visit is null or visit = p_visit) and (p_server is null or server = p_server);
  return jsonb_build_object('ok', true);
end $$;

create or replace function staff.plaza_snapshot(p_days integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_day date;
begin
  perform staff.plaza_sweep();
  v_day := (clock_timestamp() at time zone 'Asia/Singapore')::date;
  return jsonb_build_object(
    'stale_seconds', 75,
    'kept_days', 365,
    'today', v_day,
    'at', clock_timestamp(),
    'now', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'blurb', s.blurb, 'capacity', s.capacity, 'open', s.open,
        'people', (select count(*) from public.plaza_presence p where p.server = s.id)) order by s.sort), '[]'::jsonb)
      from public.plaza_servers s),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'server', d.server, 'joins', d.joins, 'peak', d.peak) order by d.day desc, d.server), '[]'::jsonb)
      from staff.plaza_daily d
      where d.day > v_day - greatest(1, least(coalesce(p_days, 14), 90))));
end $$;

alter function staff.plaza_sweep() owner to postgres;
alter function staff.plaza_snapshot(integer) owner to postgres;
alter function public.plaza_list() owner to postgres;
alter function public.plaza_join(text) owner to postgres;
alter function public.plaza_beat(text, uuid) owner to postgres;
alter function public.plaza_leave(text, uuid) owner to postgres;
revoke all on function staff.plaza_sweep() from public;
revoke all on function staff.plaza_snapshot(integer) from public;
revoke all on function public.plaza_list() from public, anon;
revoke all on function public.plaza_join(text) from public, anon;
revoke all on function public.plaza_beat(text, uuid) from public, anon;
revoke all on function public.plaza_leave(text, uuid) from public, anon;
grant execute on function staff.plaza_sweep() to rhythme_staff_fn;
grant execute on function staff.plaza_snapshot(integer) to rhythme_staff_fn;
grant execute on function public.plaza_list() to authenticated;
grant execute on function public.plaza_join(text) to authenticated;
grant execute on function public.plaza_beat(text, uuid) to authenticated;
grant execute on function public.plaza_leave(text, uuid) to authenticated;
