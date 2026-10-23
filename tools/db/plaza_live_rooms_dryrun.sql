-- Rolled-back check of supabase/migrations/20261023160000_plaza_live_rooms.sql (23 Oct 2026). One batch:
-- python3 tools/db/dryrun.py MIGRATION THIS. It ends by raising 'RESULT {...}', so nothing is kept.

create temp table dry_errors (qry text, err text);
create function pg_temp.call(u uuid, q text) returns jsonb language plpgsql as $f$
declare r jsonb;
begin
  perform set_config('request.jwt.claims', case when u is null then '{"role":"authenticated"}' else json_build_object('sub', u, 'role', 'authenticated')::text end, true);
  execute 'set local role authenticated';
  begin
    execute q into r;
  exception when others then
    r := jsonb_build_object('error', sqlerrm, 'code', sqlstate);
  end;
  execute 'reset role';
  if r ? 'error' then insert into pg_temp.dry_errors (qry, err) values (left(q, 60), r->>'error'); end if;
  return r;
end $f$;
create function pg_temp.anon(q text) returns jsonb language plpgsql as $f$
declare r jsonb;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin execute q into r; exception when others then r := jsonb_build_object('error', sqlerrm, 'code', sqlstate); end;
  execute 'reset role';
  return r;
end $f$;
-- does this transaction hold the account lock for u (advisory namespace 4242), or the plaza membership lock
create function pg_temp.locked(u uuid) returns boolean language sql as $f$
  select exists (select 1 from pg_locks l where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.classid = 4242::oid and l.objsubid = 2
    and l.objid = ((hashtext('social:acct:' || u::text)::bigint) & 4294967295)::oid)
$f$;
create function pg_temp.member_locked() returns boolean language sql as $f$
  select exists (select 1 from pg_locks l where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.objsubid = 1
    and l.objid = ((hashtext('plaza:membership')::bigint) & 4294967295)::oid)
$f$;
-- a person made directly (no calls, so no locks): 18+ and Plaza friends on record, a card, in a group now; returns the visit
create function pg_temp.person(u uuid, nm text, srv text, chat boolean) returns uuid language plpgsql as $f$
declare v uuid;
begin
  insert into auth.users (id, email, aud, role) values (u, 'dryrun-' || u || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.consent_events (user_id, purpose, action, notice_version, method) values (u, 'age_18', 'grant', 3, 'sheet'), (u, 'social', 'grant', 3, 'jit');
  if chat then
    perform set_config('plaza.chat_on', 'yes', true); -- as plaza_chat_on does; the guard refuses any other grant
    insert into public.consent_events (user_id, purpose, action, notice_version, method) values (u, 'plaza_chat', 'grant', 1, 'jit');
    perform set_config('plaza.chat_on', '', true);
  end if;
  insert into public.social_profiles (user_id, name, look) values (u, nm, 'base');
  if srv is not null then insert into public.plaza_presence (user_id, server, visit, joined_at, seen_at) values (u, srv, gen_random_uuid(), clock_timestamp(), clock_timestamp()) returning visit into v; end if;
  return v;
end $f$;
-- put someone in a room directly; returns the entry
create function pg_temp.seat(u uuid, rm text) returns uuid language sql as $f$
  insert into public.plaza_room_presence (user_id, server, visit, room, entry) select p.user_id, p.server, p.visit, rm, gen_random_uuid() from public.plaza_presence p where p.user_id = u
  on conflict (user_id) do update set server = excluded.server, visit = excluded.visit, room = excluded.room, entry = excluded.entry returning entry
$f$;
create function pg_temp.say(u uuid, e uuid, body text, ask boolean) returns jsonb language sql as $f$
  select pg_temp.call(u, format('select public.plaza_say(%L::uuid, %L, %L::boolean)', e, body, ask))
$f$;
create function pg_temp.feed(u uuid, srv text, v uuid, rm text) returns jsonb language sql as $f$
  select pg_temp.call(u, format('select public.plaza_room_feed(%L, %L::uuid, %L, null)', srv, v, rm))
$f$;
create function pg_temp.bodies(f jsonb) returns text[] language sql as $f$
  select coalesce(array_agg(x ->> 'body' order by (x ->> 'id')::bigint), '{}') from jsonb_array_elements(f -> 'messages') x
$f$;
create function pg_temp.has(f jsonb, id bigint) returns boolean language sql as $f$ select coalesce((f -> 'ids') @> to_jsonb(id), false) $f$;

do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); va uuid; vb uuid; ea uuid; eb uuid; r jsonb; f jsonb; l jsonb; out jsonb := '{}'; ok boolean;
  expected text[] := array['live_rooms', 'loss_reviewed', 'flag_still_review', 'chat_shows_now', 'vent_waits', 'crisis_held_in_live', 'advice_held_in_live',
    'news_held_in_live_no_news', 'reader_sees_live', 'list_marks_live', 'feed_mode'];
begin
  out := out || jsonb_build_object('live_rooms', (select string_agg(id, ',' order by id) from public.plaza_rooms where live) =
    'everyone-chat,everyone-wins,meno-chat,meno-wins,mothers-chat,mothers-wins,pcos-chat,pcos-wins,ttc-chat,ttc-wins');
  out := out || jsonb_build_object('loss_reviewed', not exists (select 1 from public.plaza_rooms where server = 'after-a-loss' and live));
  out := out || jsonb_build_object('flag_still_review', not plaza.live());
  va := pg_temp.person(a, 'Asha', 'everyone', true); vb := pg_temp.person(b, 'Bee', 'everyone', true);
  ea := pg_temp.seat(a, 'everyone-chat');
  r := pg_temp.say(a, ea, 'Good morning everyone, slept well for once', false);
  out := out || jsonb_build_object('chat_shows_now', (r ->> 'ok')::boolean and not (r ->> 'held')::boolean);
  update public.social_rate set at = at - interval '1 minute' where user_id = a;
  r := pg_temp.say(a, ea, 'I want to die today', false);
  out := out || jsonb_build_object('crisis_held_in_live', (r ->> 'held')::boolean and r ->> 'held_why' = 'care');
  update public.social_rate set at = at - interval '1 minute' where user_id = a;
  r := pg_temp.say(a, ea, 'Stop taking your metformin, it does nothing', false);
  out := out || jsonb_build_object('advice_held_in_live', (r ->> 'held')::boolean and r ->> 'held_why' = 'advice');
  eb := pg_temp.seat(b, 'everyone-vent');
  r := pg_temp.say(b, eb, 'Rough day at work, just need to say it', false);
  out := out || jsonb_build_object('vent_waits', (r ->> 'held')::boolean and r ->> 'held_why' = 'review');
  -- a reader in the group sees the live message at once, and only that one
  f := pg_temp.feed(b, 'everyone', vb, 'everyone-chat');
  out := out || jsonb_build_object('reader_sees_live', pg_temp.bodies(f) = array['Good morning everyone, slept well for once']);
  out := out || jsonb_build_object('feed_mode', f ->> 'mode' = 'live' and pg_temp.feed(b, 'everyone', vb, 'everyone-vent') ->> 'mode' = 'review');
  l := pg_temp.call(b, format('select public.plaza_rooms_list(%L, %L::uuid)', 'everyone', vb));
  out := out || jsonb_build_object('list_marks_live', (select bool_and(((x ->> 'live')::boolean) = (x ->> 'id' in ('everyone-chat', 'everyone-wins'))) from jsonb_array_elements(l -> 'rooms') x)
    and l ->> 'mode' = 'review');
  -- trying to conceive Chat is live, and still keeps pregnancy news out
  perform pg_temp.call(b, 'select public.plaza_join(''trying-to-conceive'')');
  select visit into vb from public.plaza_presence where user_id = b;
  eb := pg_temp.seat(b, 'ttc-chat');
  update public.social_rate set at = at - interval '1 minute' where user_id = b;
  r := pg_temp.say(b, eb, 'I am pregnant!!', false);
  out := out || jsonb_build_object('news_held_in_live_no_news', (r ->> 'held')::boolean and r ->> 'held_why' = 'news');
  select coalesce(bool_and(coalesce(value::boolean, false)), false) into ok from jsonb_each_text(out);
  ok := ok and (select count(*) from unnest(expected) x where out ? x) = array_length(expected, 1);
  raise exception 'RESULT %', jsonb_build_object('all', ok, 'count', (select count(*) from jsonb_object_keys(out)), 'expected', array_length(expected, 1),
    'failing', (select jsonb_agg(key) from jsonb_each_text(out) where not coalesce(value::boolean, false)),
    'errors', (select jsonb_agg(jsonb_build_object('q', de.qry, 'e', de.err)) from pg_temp.dry_errors de),
    'bodies', (select jsonb_object_agg(ns.nspname || '.' || pr.proname, md5(pr.prosrc)) from pg_proc pr join pg_namespace ns on ns.oid = pr.pronamespace
      where ns.nspname = 'public' and pr.proname in ('plaza_say', 'plaza_room_feed', 'plaza_rooms_list')));
end $t$;
