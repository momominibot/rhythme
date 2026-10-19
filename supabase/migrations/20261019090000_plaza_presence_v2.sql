-- Plaza servers, phase 1, second cut after review (Codex, 19 Oct):
-- * every change of membership (join, the stale sweep) takes one global lock, so two joins can never lock each other's
--   rows in opposite orders (the per-plaza lock alone allowed a deadlock between a join into A and a join into B);
-- * stale rows (no check-in for 75 s) are swept by every call, the staff view included, not only by joins;
-- * leave names the plaza being left, so a late leave cannot remove a newer membership;
-- * a check-in raises the day's peak too, so people who stay past Singapore midnight are counted on the new day;
-- * the staff view returns the database's own Singapore date and time, so the card never trusts the browser clock;
-- * ownership is explicit.
-- Undo: restore the bodies from 20261019080000_plaza_presence.sql and recreate public.plaza_leave() without arguments.

create or replace function staff.plaza_sweep() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('plaza:membership'));
  delete from public.plaza_presence where seen_at <= now() - interval '75 seconds';
end $$;
alter function staff.plaza_sweep() owner to postgres;
revoke all on function staff.plaza_sweep() from public;
grant execute on function staff.plaza_sweep() to rhythme_staff_fn;

create or replace function staff.plaza_peak(p_server text) returns void
language sql security definer set search_path = '' as $$
  insert into staff.plaza_daily (day, server, joins, peak)
    values ((now() at time zone 'Asia/Singapore')::date, p_server, 0,
            (select count(*) from public.plaza_presence p where p.server = p_server and p.seen_at > now() - interval '75 seconds'))
  on conflict (day, server) do update set peak = greatest(staff.plaza_daily.peak, excluded.peak);
$$;
alter function staff.plaza_peak(text) owner to postgres;
revoke all on function staff.plaza_peak(text) from public;

-- no longer stable: it sweeps
create or replace function public.plaza_list() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform staff.plaza_sweep();
  return jsonb_build_object(
    'servers', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'capacity', s.capacity, 'open', s.open,
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
      select jsonb_build_object('id', s.id, 'name', s.name) into alt from public.plaza_servers s
        where s.open and s.id <> srv.id and (select count(*) from public.plaza_presence p where p.server = s.id) < s.capacity
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

create or replace function public.plaza_beat(p_server text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform staff.plaza_sweep();
  update public.plaza_presence set seen_at = now() where user_id = uid and server = p_server;
  if not found then return jsonb_build_object('ok', false, 'rejoin', true); end if; -- gone quiet too long, or moved: join again
  perform staff.plaza_peak(p_server);
  select count(*) into n from public.plaza_presence where server = p_server;
  return jsonb_build_object('ok', true, 'server', p_server, 'people', n);
end $$;

drop function if exists public.plaza_leave();
create or replace function public.plaza_leave(p_server text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform staff.plaza_sweep();
  delete from public.plaza_presence where user_id = uid and (p_server is null or server = p_server);
  return jsonb_build_object('ok', true);
end $$;

alter function public.plaza_list() owner to postgres;
alter function public.plaza_join(text) owner to postgres;
alter function public.plaza_beat(text) owner to postgres;
alter function public.plaza_leave(text) owner to postgres;
revoke all on function public.plaza_list() from public, anon;
revoke all on function public.plaza_join(text) from public, anon;
revoke all on function public.plaza_beat(text) from public, anon;
revoke all on function public.plaza_leave(text) from public, anon;
grant execute on function public.plaza_list() to authenticated;
grant execute on function public.plaza_join(text) to authenticated;
grant execute on function public.plaza_beat(text) to authenticated;
grant execute on function public.plaza_leave(text) to authenticated;

create or replace function staff.plaza_snapshot(p_days integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_day date := (now() at time zone 'Asia/Singapore')::date;
begin
  perform staff.plaza_sweep();
  return jsonb_build_object(
    'stale_seconds', 75,
    'today', v_day,
    'at', now(),
    'now', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'capacity', s.capacity, 'open', s.open,
        'people', (select count(*) from public.plaza_presence p where p.server = s.id)) order by s.sort), '[]'::jsonb)
      from public.plaza_servers s),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'server', d.server, 'joins', d.joins, 'peak', d.peak) order by d.day desc, d.server), '[]'::jsonb)
      from staff.plaza_daily d
      where d.day > v_day - greatest(1, least(coalesce(p_days, 14), 90))));
end $$;
alter function staff.plaza_snapshot(integer) owner to postgres;
revoke all on function staff.plaza_snapshot(integer) from public;
grant execute on function staff.plaza_snapshot(integer) to rhythme_staff_fn;
