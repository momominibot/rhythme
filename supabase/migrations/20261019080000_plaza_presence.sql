-- Plaza servers, phase 1 (docs/design/2026-10-19-plaza-servers-and-hosts.md).
-- Which signed-in people are in which plaza right now, counted. No chat, no names, no diary.
-- A person is counted while her phone checks in (every 25 s); after 75 s of silence she is no longer counted and her
-- row is removed on the next call. Leaving the plaza, closing the app, sleeping or tapping Leave removes it at once.
-- Staff see counts per plaza and a daily tally (joins, peak) with no account ids, through one audited RPC.
-- Undo: drop function public.admin_plaza(integer), public.plaza_leave(), public.plaza_beat(text), public.plaza_join(text),
--       public.plaza_list(), staff.plaza_snapshot(integer); drop table staff.plaza_daily, public.plaza_presence, public.plaza_servers;

create table if not exists public.plaza_servers (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,30}$'),
  name text not null check (length(name) between 1 and 40),
  capacity integer not null check (capacity between 1 and 500),
  sort integer not null default 0,
  open boolean not null default true
);
alter table public.plaza_servers enable row level security;
revoke all on table public.plaza_servers from anon, authenticated;
insert into public.plaza_servers (id, name, capacity, sort) values
  ('orchard', 'Orchard', 24, 1), ('tiong-bahru', 'Tiong Bahru', 24, 2), ('punggol', 'Punggol', 24, 3)
on conflict (id) do nothing;

create table if not exists public.plaza_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  server text not null references public.plaza_servers (id) on delete cascade,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create index if not exists plaza_presence_server_seen on public.plaza_presence (server, seen_at);
create index if not exists plaza_presence_seen on public.plaza_presence (seen_at);
alter table public.plaza_presence enable row level security;
revoke all on table public.plaza_presence from anon, authenticated;

-- daily tally per plaza, Singapore date; no account ids
create table if not exists staff.plaza_daily (
  day date not null,
  server text not null,
  joins integer not null default 0 check (joins >= 0),
  peak integer not null default 0 check (peak >= 0),
  primary key (day, server)
);
alter table staff.plaza_daily enable row level security;

-- ---------- the person's calls (signed in only; the app sends nothing while signed out) ----------
create or replace function public.plaza_list() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  return jsonb_build_object(
    'servers', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'capacity', s.capacity, 'open', s.open,
        'people', (select count(*) from public.plaza_presence p where p.server = s.id and p.seen_at > now() - interval '75 seconds')) order by s.sort), '[]'::jsonb)
      from public.plaza_servers s),
    'mine', (select p.server from public.plaza_presence p where p.user_id = uid and p.seen_at > now() - interval '75 seconds'),
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
  perform pg_advisory_xact_lock(hashtext('plaza:' || srv.id)); -- one join at a time per plaza, so capacity holds
  delete from public.plaza_presence where seen_at <= now() - interval '75 seconds';
  select server into prev_server from public.plaza_presence where user_id = uid;
  fresh := prev_server is distinct from srv.id;
  if fresh then
    select count(*) into n from public.plaza_presence where server = srv.id;
    if n >= srv.capacity then
      select jsonb_build_object('id', s.id, 'name', s.name) into alt from public.plaza_servers s
        where s.open and s.id <> srv.id and (select count(*) from public.plaza_presence p where p.server = s.id) < s.capacity
        order by s.sort limit 1;
      return jsonb_build_object('ok', false, 'why', 'full', 'server', srv.id, 'name', srv.name, 'capacity', srv.capacity, 'people', n, 'suggest', alt);
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
  update public.plaza_presence set seen_at = now() where user_id = uid and server = p_server and seen_at > now() - interval '75 seconds';
  if not found then return jsonb_build_object('ok', false, 'rejoin', true); end if; -- gone quiet too long: join again (capacity is checked)
  select count(*) into n from public.plaza_presence where server = p_server and seen_at > now() - interval '75 seconds';
  return jsonb_build_object('ok', true, 'server', p_server, 'people', n);
end $$;

create or replace function public.plaza_leave() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  delete from public.plaza_presence where user_id = uid;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.plaza_list() from public, anon;
revoke all on function public.plaza_join(text) from public, anon;
revoke all on function public.plaza_beat(text) from public, anon;
revoke all on function public.plaza_leave() from public, anon;
grant execute on function public.plaza_list() to authenticated;
grant execute on function public.plaza_join(text) to authenticated;
grant execute on function public.plaza_beat(text) to authenticated;
grant execute on function public.plaza_leave() to authenticated;

-- ---------- staff: counts only, audited like every other staff call ----------
create or replace function staff.plaza_snapshot(p_days integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'stale_seconds', 75,
    'now', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'capacity', s.capacity, 'open', s.open,
        'people', (select count(*) from public.plaza_presence p where p.server = s.id and p.seen_at > now() - interval '75 seconds')) order by s.sort), '[]'::jsonb)
      from public.plaza_servers s),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'server', d.server, 'joins', d.joins, 'peak', d.peak) order by d.day desc, d.server), '[]'::jsonb)
      from staff.plaza_daily d
      where d.day > (now() at time zone 'Asia/Singapore')::date - greatest(1, least(coalesce(p_days, 14), 90))))
$$;
revoke all on function staff.plaza_snapshot(integer) from public;
grant execute on function staff.plaza_snapshot(integer) to rhythme_staff_fn;

create or replace function public.admin_plaza(p_days integer default 14) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_plaza', jsonb_build_object('days', p_days)); if d is not null then return d; end if;
  return staff.plaza_snapshot(p_days);
end $$;
alter function public.admin_plaza(integer) owner to rhythme_staff_fn;
revoke all on function public.admin_plaza(integer) from public, anon;
grant execute on function public.admin_plaza(integer) to authenticated;
