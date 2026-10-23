-- Rolled-back check of supabase/migrations/20261022120000_plaza_rooms_chat.sql (22 Oct 2026).
-- Run as ONE batch: the migration text, then this file (python3 tools/db/dryrun.py MIGRATION THIS). The last statement
-- raises 'RESULT {...}', so the implicit transaction rolls back (groups, rooms, messages, consent events, synthetic
-- accounts, the cron job: nothing is kept). Every expected check must be present and true; a missing or null one fails.
-- The text cases are the same list as tools/fixtures/plaza_text_cases.json (the core suite checks each one is here).

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
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  e uuid := gen_random_uuid(); f uuid := gen_random_uuid(); g uuid := gen_random_uuid(); h uuid := gen_random_uuid(); k uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid(); o uuid := gen_random_uuid(); q uuid := gen_random_uuid(); y uuid := gen_random_uuid(); z uuid := gen_random_uuid();
  va uuid; vb uuid; vc uuid; vd uuid; ve uuid; vf uuid; vg uuid; vh uuid; vk uuid; vm1 uuid; vq uuid; vy uuid;
  ea uuid; eb uuid; ec uuid; eg uuid; eh uuid; ek uuid; ey uuid; e2 uuid;
  r jsonb; r2 jsonb; r3 jsonb; out jsonb := '{}'; ok boolean; i integer; mid bigint; mid2 bigint; mid3 bigint; hid bigint; ev bigint; fillers uuid[];
  expected text[] := array['groups', 'rooms', 'wins_and_vent', 'loss_has_no_wins', 'no_news_rooms', 'review_by_default', 'live_unavailable', 'anon_refused', 'no_sub_refused',
    'tables_closed', 'list_not_here', 'list_rooms', 'list_no_card', 'list_adult_shows_nothing', 'join_needs_card', 'hidden_cannot_read', 'join_room',
    'join_retry_same_entry', 'join_locks_account', 'join_full_suggests', 'say_needs_notice', 'chat_on_needs_opt_in', 'chat_on_stale_card',
    'chat_on_stale_event', 'chat_on', 'review_holds', 'held_only_to_writer', 'staff_queue', 'staff_decide_needs_owner', 'staff_show', 'say_locks_account', 'feed_locks_account',
    'grant_only_through_rooms', 'queue_held_only', 'approval_reaches_old_view', 'off_twice_stales_form', 'last_at_hides_blocked',
    'peek_without_joining', 'live_shows', 'say_without_entry', 'old_entry_refused', 'late_leave_harmless', 'text_cases', 'hold_cases', 'care_held_then_marked',
    'advice_held', 'news_held_in_quiet_room', 'grief_shown_in_quiet_room', 'news_shown_in_everyone', 'asked_hold_is_private', 'same_twice', 'too_fast',
    'hourly_limit', 'feed_same', 'block_hides_both_ways', 'paused_author_hidden', 'paused_cannot_say', 'hidden_author_hidden', 'report_bad_reason',
    'report_own_refused', 'report_held_refused', 'report', 'report_again_not_counted', 'three_reports_hide', 'report_staff_view', 'staff_hide_closes_reports',
    'other_group_refused', 'room_ends_with_visit', 'chat_off_deletes', 'withdraw_social_ends_chat', 'retention', 'open_report_limit', 'chat_flag_off',
    'quiet_full_no_suggest', 'topic_full_suggests_everyone', 'hourly_cleanup_scheduled', 'account_delete', 'stale_decision_refused',
    'hidden_card_keeps_place', 'expired_decision_refused'];
begin
  -- a synthetic owner for the staff calls (rolled back with everything else)
  insert into auth.users (id, email, aud, role) values (o, 'dryrun-owner-' || o || '@example.invalid', 'authenticated', 'authenticated');
  insert into staff.admin_accounts (user_id, email, role) values (o, 'dryrun-owner-' || o || '@example.invalid', 'owner');

  -- the groups and their rooms
  out := out || jsonb_build_object('groups', (select string_agg(id || '=' || name, '|' order by sort) from public.plaza_servers) =
      'everyone=Everyone|pcos=PCOS and endometriosis|trying-to-conceive=Trying to conceive|after-a-loss=After a loss|new-mothers=New mothers|menopause=Perimenopause and menopause'
    and (select bool_and(quiet = (id = 'after-a-loss')) from public.plaza_servers));
  out := out || jsonb_build_object('rooms', (select count(*) from public.plaza_rooms) = 27 and (select bool_and(capacity = 12 and open) from public.plaza_rooms)
    and exists (select 1 from public.plaza_rooms where id = 'everyone-cycle' and name = 'Cycle and PMDD' and server = 'everyone'));
  out := out || jsonb_build_object('wins_and_vent', (select bool_and(exists (select 1 from public.plaza_rooms r where r.server = s.id and r.kind = 'wins')
      and exists (select 1 from public.plaza_rooms r where r.server = s.id and r.kind = 'vent')) from public.plaza_servers s where not s.quiet));
  out := out || jsonb_build_object('loss_has_no_wins', not exists (select 1 from public.plaza_rooms where server = 'after-a-loss' and kind in ('wins', 'chat'))
    and (select count(*) from public.plaza_rooms where server = 'after-a-loss') = 2);
  out := out || jsonb_build_object('no_news_rooms', (select bool_and(no_news = (server in ('after-a-loss', 'trying-to-conceive'))) from public.plaza_rooms));
  out := out || jsonb_build_object('review_by_default', not plaza.live() and plaza.chat_on());

  -- signed out and anonymous callers; tables closed
  r := pg_temp.anon('select public.plaza_rooms_list(''everyone'', null)');
  out := out || jsonb_build_object('anon_refused', r ? 'error');
  r := pg_temp.call(null, 'select public.plaza_rooms_list(''everyone'', null)');
  out := out || jsonb_build_object('no_sub_refused', r ? 'error');
  r := pg_temp.call(null, 'select to_jsonb(count(*)) from public.plaza_messages');
  r2 := pg_temp.call(null, 'select to_jsonb(count(*)) from public.plaza_room_presence');
  r3 := pg_temp.call(null, 'select to_jsonb(count(*)) from public.plaza_flags');
  out := out || jsonb_build_object('tables_closed', r ? 'error' and r2 ? 'error' and r3 ? 'error');

  -- people: A, B, C in Everyone with Room chat on; D has no card; E a hidden card; F in PCOS; M1 has no 18+ on record
  va := pg_temp.person(a, 'Ann', 'everyone', true); vb := pg_temp.person(b, 'Bea', 'everyone', true); vc := pg_temp.person(c, 'Cai', 'everyone', true);
  insert into auth.users (id, email, aud, role) values (d, 'dryrun-' || d || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.consent_events (user_id, purpose, action, notice_version, method) values (d, 'age_18', 'grant', 3, 'sheet');
  insert into public.plaza_presence (user_id, server, visit, joined_at, seen_at) values (d, 'everyone', gen_random_uuid(), clock_timestamp(), clock_timestamp()) returning visit into vd;
  ve := pg_temp.person(e, 'Eve', 'everyone', true); update public.social_profiles set hidden = true where user_id = e;
  vf := pg_temp.person(f, 'Fay', 'pcos', true);
  insert into auth.users (id, email, aud, role) values (q, 'dryrun-' || q || '@example.invalid', 'authenticated', 'authenticated');
  insert into auth.users (id, email, aud, role) values (m1, 'dryrun-' || m1 || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.plaza_presence (user_id, server, visit, joined_at, seen_at) values (m1, 'everyone', gen_random_uuid(), clock_timestamp(), clock_timestamp()) returning visit into vm1;

  r := pg_temp.call(a, format('select public.plaza_rooms_list(%L, %L::uuid)', 'everyone', gen_random_uuid()));
  out := out || jsonb_build_object('list_not_here', r ->> 'why' = 'not_here');
  r := pg_temp.call(a, format('select public.plaza_rooms_list(%L, %L::uuid)', 'everyone', va));
  out := out || jsonb_build_object('list_rooms', (r ->> 'ok')::boolean and jsonb_array_length(r -> 'rooms') = 5 and (r ->> 'read')::boolean and (r ->> 'talk')::boolean
    and r ->> 'mode' = 'review' and r -> 'rooms' -> 0 ->> 'id' = 'everyone-chat' and (r -> 'rooms' -> 0 ->> 'people')::int = 0 and r ->> 'room' is null
    and r ->> 'card' = (select handle::text from public.social_profiles where user_id = a));
  r := pg_temp.call(d, format('select public.plaza_rooms_list(%L, %L::uuid)', 'everyone', vd));
  out := out || jsonb_build_object('list_no_card', (r ->> 'ok')::boolean and not (r ->> 'read')::boolean and r ->> 'why' = 'card' and jsonb_array_length(r -> 'rooms') = 5);
  r := pg_temp.call(m1, format('select public.plaza_rooms_list(%L, %L::uuid)', 'everyone', vm1));
  out := out || jsonb_build_object('list_adult_shows_nothing', r ->> 'why' = 'adult' and jsonb_array_length(r -> 'rooms') = 0);
  r := pg_temp.call(d, format('select public.plaza_room_join(%L, %L::uuid, %L)', 'everyone', vd, 'everyone-chat'));
  out := out || jsonb_build_object('join_needs_card', r ->> 'why' = 'card');
  r := pg_temp.call(e, format('select public.plaza_room_join(%L, %L::uuid, %L)', 'everyone', ve, 'everyone-chat'));
  r2 := pg_temp.feed(e, 'everyone', ve, 'everyone-chat');
  out := out || jsonb_build_object('hidden_cannot_read', r ->> 'why' = 'hidden' and r2 ->> 'why' = 'hidden');

  -- joining a room: an entry; the same room again keeps it; her account lock and the membership lock are both held
  r := pg_temp.call(a, format('select public.plaza_room_join(%L, %L::uuid, %L)', 'everyone', va, 'everyone-chat'));
  ea := (r ->> 'entry')::uuid;
  out := out || jsonb_build_object('join_room', (r ->> 'ok')::boolean and ea is not null and (r ->> 'people')::int = 1);
  -- lock checks use accounts that made no call before in this transaction, so they show acquisition, not possession; the
  -- order (account before membership) and the checks under the locks are shown by the two-session races
  -- (tools/db/race_test.py --rooms), which a single transaction cannot show
  declare x1 uuid := gen_random_uuid(); vx1 uuid; x2 uuid := gen_random_uuid(); vx2 uuid; x3 uuid := gen_random_uuid(); vx3 uuid; ex2 uuid; begin
    vx1 := pg_temp.person(x1, 'Lia', 'everyone', true); vx2 := pg_temp.person(x2, 'Lin', 'everyone', true); vx3 := pg_temp.person(x3, 'Lou', 'everyone', true);
    ok := pg_temp.locked(x1);
    perform pg_temp.call(x1, format('select public.plaza_room_join(%L, %L::uuid, %L)', 'everyone', vx1, 'everyone-cycle'));
    out := out || jsonb_build_object('join_locks_account', not ok and pg_temp.locked(x1));
    ex2 := pg_temp.seat(x2, 'everyone-cycle'); ok := pg_temp.locked(x2);
    perform pg_temp.say(x2, ex2, 'a first hello', false);
    out := out || jsonb_build_object('say_locks_account', not ok and pg_temp.locked(x2));
    ok := pg_temp.locked(x3);
    perform pg_temp.feed(x3, 'everyone', vx3, 'everyone-cycle');
    out := out || jsonb_build_object('feed_locks_account', not ok and pg_temp.locked(x3));
    delete from public.plaza_room_presence where user_id in (x1, x2);
    delete from public.plaza_messages where author = x2;
  end;
  r := pg_temp.call(a, format('select public.plaza_room_join(%L, %L::uuid, %L)', 'everyone', va, 'everyone-chat'));
  out := out || jsonb_build_object('join_retry_same_entry', (r ->> 'entry')::uuid = ea);
  -- a full room names the rooms with space
  fillers := array(select gen_random_uuid() from generate_series(1, 12));
  for i in 1 .. 12 loop perform pg_temp.person(fillers[i], 'Fill' || i, 'everyone', false); perform pg_temp.seat(fillers[i], 'everyone-vent'); end loop;
  r := pg_temp.call(b, format('select public.plaza_room_join(%L, %L::uuid, %L)', 'everyone', vb, 'everyone-vent'));
  out := out || jsonb_build_object('join_full_suggests', r ->> 'why' = 'full' and (r ->> 'people')::int = 12
    and (r -> 'suggest') @> '[{"id":"everyone-chat"}]' and not (r -> 'suggest') @> '[{"id":"everyone-vent"}]');
  delete from public.plaza_room_presence where user_id = any (fillers);
  -- a hidden card keeps its place: showing it again cannot put a room over its twelve (Codex diff review round 3)
  declare fl uuid[] := array(select gen_random_uuid() from generate_series(1, 13)); vz uuid; begin
    for i in 1 .. 12 loop perform pg_temp.person(fl[i], 'Seat' || i, 'everyone', false); perform pg_temp.seat(fl[i], 'everyone-vent'); end loop;
    update public.social_profiles set hidden = true where user_id = fl[1];
    vz := pg_temp.person(fl[13], 'Zia', 'everyone', true);
    r := pg_temp.call(fl[13], format('select public.plaza_room_join(%L, %L::uuid, %L)', 'everyone', vz, 'everyone-vent'));
    out := out || jsonb_build_object('hidden_card_keeps_place', r ->> 'why' = 'full' and plaza.room_count('everyone-vent') = 12);
    delete from public.plaza_room_presence where user_id = any (fl); delete from public.plaza_presence where user_id = any (fl);
  end;

  -- Room chat needs her own fresh yes, on the card and Room chat history the form was opened with
  vg := pg_temp.person(g, 'Gia', 'everyone', false); eg := pg_temp.seat(g, 'everyone-chat');
  r := pg_temp.say(g, eg, 'hello all', false);
  out := out || jsonb_build_object('say_needs_notice', r ->> 'why' = 'notice');
  r := pg_temp.call(g, format('select public.plaza_chat_on(1, null, null, false, %L::uuid, null)', (select handle from public.social_profiles where user_id = g)));
  out := out || jsonb_build_object('chat_on_needs_opt_in', r ->> 'why' = 'consent');
  r := pg_temp.call(g, format('select public.plaza_chat_on(1, null, null, true, %L::uuid, null)', gen_random_uuid()));
  out := out || jsonb_build_object('chat_on_stale_card', r ->> 'why' = 'stale');
  perform set_config('plaza.chat_on', 'yes', true);
  insert into public.consent_events (user_id, purpose, action, notice_version, method) values (g, 'plaza_chat', 'grant', 1, 'jit'), (g, 'plaza_chat', 'withdraw', 1, 'you');
  perform set_config('plaza.chat_on', '', true);
  r := pg_temp.call(g, format('select public.plaza_chat_on(1, null, null, true, %L::uuid, null)', (select handle from public.social_profiles where user_id = g)));
  out := out || jsonb_build_object('chat_on_stale_event', r ->> 'why' = 'stale' and not public.consent_allows(g, 'plaza_chat'));
  select max(id) into ev from public.consent_events where user_id = g and purpose = 'plaza_chat';
  r := pg_temp.call(g, format('select public.plaza_chat_on(1, %L, %L, true, %L::uuid, %s)', 'abc', 'dev', (select handle from public.social_profiles where user_id = g), ev));
  out := out || jsonb_build_object('chat_on', (r ->> 'ok')::boolean and public.consent_allows(g, 'plaza_chat') and (r ->> 'chat_event')::bigint > ev);
  -- the general consent call cannot grant Room chat (it skips the form, card and history checks); it can withdraw it
  r := pg_temp.call(q, 'select public.consent_record(''plaza_chat'', ''grant'', 3)');
  out := out || jsonb_build_object('grant_only_through_rooms', coalesce(r ->> 'error', '') like '%turned on from the rooms%' and not exists (select 1 from public.consent_events where user_id = q and purpose = 'plaza_chat'));
  -- Off while already off is recorded too, so a Room chat form opened between the two is stale (Codex round 2, B2)
  declare x4 uuid := gen_random_uuid(); e1 bigint; c0 bigint; begin
    perform pg_temp.person(x4, 'Oli', 'everyone', true);
    select count(*) into c0 from public.consent_events where user_id = x4 and purpose = 'plaza_chat';
    r := pg_temp.call(x4, 'select public.plaza_chat_off(1, null)'); e1 := (r ->> 'chat_event')::bigint;
    r2 := pg_temp.call(x4, 'select public.plaza_chat_off(1, null)');
    r3 := pg_temp.call(x4, format('select public.plaza_chat_on(1, null, null, true, %L::uuid, %s)', (select handle from public.social_profiles where user_id = x4), e1));
    out := out || jsonb_build_object('off_twice_stales_form', e1 is not null and (r2 ->> 'chat_event')::bigint > e1
      and (select count(*) from public.consent_events where user_id = x4 and purpose = 'plaza_chat') = c0 + 2
      and r3 ->> 'why' = 'stale' and not public.consent_allows(x4, 'plaza_chat'));
    delete from public.plaza_presence where user_id = x4; -- keeps Everyone under its 24 for the full-group checks
  end;
  r := pg_temp.call(o, 'select public.admin_plaza_messages(''shown'')'); r2 := pg_temp.call(o, 'select public.admin_plaza_messages(''hidden'')');
  r3 := pg_temp.call(o, 'select public.admin_plaza_messages(null)');
  out := out || jsonb_build_object('queue_held_only', r ? 'error' and r2 ? 'error' and r3 ? 'error' and not (r ? 'messages'));

  -- review mode: every message waits; only its writer sees it, marked held; staff see it; an owner shows it
  r := pg_temp.say(a, ea, '  Hello   everyone, first time here  ', false);
  mid := (r -> 'message' ->> 'id')::bigint;
  out := out || jsonb_build_object('review_holds', (r ->> 'ok')::boolean and (r ->> 'held')::boolean and r ->> 'held_why' = 'review'
    and r -> 'message' ->> 'body' = 'Hello everyone, first time here' and (r -> 'message' ->> 'mine')::boolean and (r -> 'message' ->> 'held')::boolean);
  r := pg_temp.feed(a, 'everyone', va, 'everyone-chat'); r2 := pg_temp.feed(b, 'everyone', vb, 'everyone-chat');
  out := out || jsonb_build_object('held_only_to_writer', pg_temp.has(r, mid) and (r -> 'messages' -> 0 ->> 'held')::boolean and not pg_temp.has(r2, mid));
  r := pg_temp.call(o, 'select public.admin_plaza_messages(''held'')');
  out := out || jsonb_build_object('staff_queue', exists (select 1 from jsonb_array_elements(r -> 'messages') x where (x ->> 'id')::bigint = mid and x ->> 'why' = 'review'
    and x ->> 'group' = 'Everyone' and x ->> 'room' = 'Chat' and x ->> 'name' = 'Ann'));
  r := pg_temp.call(b, format('select public.admin_plaza_decide(%s, %L, %s)', mid, 'show', (select rev from public.plaza_messages where id = mid)));
  out := out || jsonb_build_object('staff_decide_needs_owner', (r ->> 'denied')::boolean and (select status from public.plaza_messages where id = mid) = 'held');
  r := pg_temp.call(o, format('select public.admin_plaza_decide(%s, %L, %s)', mid, 'show', (select rev from public.plaza_messages where id = mid)));
  r2 := pg_temp.feed(b, 'everyone', vb, 'everyone-chat');
  out := out || jsonb_build_object('staff_show', (r ->> 'ok')::boolean and pg_temp.has(r2, mid));

  -- B peeks without joining
  out := out || jsonb_build_object('peek_without_joining', (r2 ->> 'ok')::boolean and not (r2 ->> 'joined')::boolean and pg_temp.bodies(r2) = array['Hello everyone, first time here']
    and not (r2 -> 'messages' -> 0 ->> 'mine')::boolean and (r2 ->> 'people')::int = 2 and r2 -> 'messages' -> 0 ->> 'name' = 'Ann');

  -- live mode is not in this migration: the switch refuses it (Codex diff review round 4, A7). From here on this run lifts
  -- that check inside its own rolled-back transaction, so shown messages can be said quickly; staff Show makes the same rows
  begin
    update public.plaza_flags set value = 'live' where key = 'mode';
    out := out || jsonb_build_object('live_unavailable', false);
  exception when check_violation then
    out := out || jsonb_build_object('live_unavailable', (select value from public.plaza_flags where key = 'mode') = 'review');
  end;
  alter table public.plaza_flags drop constraint plaza_flags_review_only;

  -- an older held message shown after newer ones: a reader and the writer, each looking with the fingerprint they had,
  -- get the whole window back with it shown (Codex diff review, 3; the commit-order race is in tools/db/race_test.py)
  declare h1 bigint; sb text; sa text; begin
    update public.social_rate set at = at - interval '1 minute' where user_id = a;
    r := pg_temp.say(a, ea, 'an older note, waiting', false); h1 := (r -> 'message' ->> 'id')::bigint;
    update public.plaza_flags set value = 'live' where key = 'mode';
    update public.social_rate set at = at - interval '1 minute' where user_id = a;
    perform pg_temp.say(a, ea, 'a newer note, shown', false);
    r := pg_temp.feed(b, 'everyone', vb, 'everyone-chat'); sb := r ->> 'seen';
    r3 := pg_temp.feed(a, 'everyone', va, 'everyone-chat'); sa := r3 ->> 'seen';
    perform pg_temp.call(o, format('select public.admin_plaza_decide(%s, %L, %s)', h1, 'show', (select rev from public.plaza_messages where id = h1)));
    r2 := pg_temp.call(b, format('select public.plaza_room_feed(%L, %L::uuid, %L, %L)', 'everyone', vb, 'everyone-chat', sb));
    r3 := pg_temp.call(a, format('select public.plaza_room_feed(%L, %L::uuid, %L, %L)', 'everyone', va, 'everyone-chat', sa));
    out := out || jsonb_build_object('approval_reaches_old_view', not pg_temp.has(r, h1) and not (r2 ->> 'same')::boolean and pg_temp.has(r2, h1)
      and exists (select 1 from jsonb_array_elements(r2 -> 'messages') x where (x ->> 'id')::bigint = h1 and not (x ->> 'held')::boolean)
      and jsonb_array_length(r2 -> 'messages') = jsonb_array_length(r2 -> 'ids')
      and exists (select 1 from jsonb_array_elements(r3 -> 'messages') x where (x ->> 'id')::bigint = h1 and not (x ->> 'held')::boolean));
    delete from public.plaza_messages where id = h1 or (author = a and body = 'a newer note, shown');
    update public.plaza_flags set value = 'review' where key = 'mode';
  end;

  -- live mode: shown at once
  update public.plaza_flags set value = 'live' where key = 'mode';
  update public.social_rate set at = at - interval '1 minute' where user_id = a;
  r := pg_temp.say(a, ea, 'second thought', false); mid2 := (r -> 'message' ->> 'id')::bigint;
  r2 := pg_temp.feed(b, 'everyone', vb, 'everyone-chat');
  out := out || jsonb_build_object('live_shows', (r ->> 'ok')::boolean and not (r ->> 'held')::boolean and pg_temp.has(r2, mid2));

  -- entries: none, an old one, a late leave of an old one
  r := pg_temp.say(b, gen_random_uuid(), 'hi Ann', false);
  out := out || jsonb_build_object('say_without_entry', r ->> 'why' = 'not_in_room');
  r := pg_temp.call(b, format('select public.plaza_room_join(%L, %L::uuid, %L)', 'everyone', vb, 'everyone-chat')); eb := (r ->> 'entry')::uuid;
  perform pg_temp.call(b, format('select public.plaza_room_leave(%L::uuid)', eb));
  r := pg_temp.call(b, format('select public.plaza_room_join(%L, %L::uuid, %L)', 'everyone', vb, 'everyone-chat')); e2 := (r ->> 'entry')::uuid;
  r := pg_temp.say(b, eb, 'hi Ann', false);
  out := out || jsonb_build_object('old_entry_refused', r ->> 'why' = 'not_in_room' and e2 <> eb);
  perform pg_temp.call(b, format('select public.plaza_room_leave(%L::uuid)', eb));
  out := out || jsonb_build_object('late_leave_harmless', exists (select 1 from public.plaza_room_presence where user_id = b and entry = e2));
  eb := e2;

  -- the text rules (same list as tools/fixtures/plaza_text_cases.json)
  out := out || jsonb_build_object('text_cases',
    plaza.text_problem('') = 'empty' and plaza.text_problem('   ') = 'empty' and plaza.text_problem(repeat('a', 281)) = 'long'
    and plaza.text_problem(repeat('a', 280)) is null
    and plaza.text_problem('see https://example.org/x') = 'link' and plaza.text_problem('go to www.shop now') = 'link'
    and plaza.text_problem('my site is pcoshelp.com') = 'link' and plaza.text_problem('bit.ly/abc') = 'link'
    and plaza.text_problem('findahelpline.com has numbers for every country') is null
    and plaza.text_problem('email me at mei@example.org') = 'contact' and plaza.text_problem('find me @mei_sg') = 'contact'
    and plaza.text_problem('call 9123 4567 anytime') = 'contact' and plaza.text_problem('+65 9123-4567') = 'contact'
    and plaza.text_problem('dm me for tips') = 'contact' and plaza.text_problem('join my telegram group') = 'contact'
    and plaza.text_problem('Day 2026-10-22 was rough') is null and plaza.text_problem('I was 38 weeks, 3 days') is null
    and plaza.text_problem('call me crazy but it helped') is null and plaza.text_problem('my phone died mid-appointment') is null
    and plaza.text_problem('sex hurts since the baby') is null and plaza.text_problem('I keep thinking about suicide') is null
    and plaza.text_problem('this fucking cramp') is null and plaza.text_problem('what a slut') = 'word'
    and plaza.text_problem('I saw it on Instagram') is null and plaza.text_problem('it.in my back hurts') is null
    and plaza.text_problem('see example.co for more') = 'link' and plaza.text_problem('myprofile.me') = 'link' and plaza.text_problem('x.com/mei') = 'link'
    and plaza.text_problem('t.me/alice') = 'link' and plaza.text_problem('t.co/hello') = 'link' and plaza.text_problem('example.health') = 'link'
    and plaza.text_problem('I need some self care today') is null and plaza.text_problem('half/half and 1/2 a day') is null
    and plaza.text_problem('medlineplus.gov has it') = 'link' and plaza.text_problem('see hse.ie') = 'link' and plaza.text_problem('ok.thanks for that') is null
    and plaza.text_problem('nhsinform.scot has a guide') = 'link' and plaza.text_problem('Email support@findahelpline.com') = 'contact' and plaza.text_problem('try findahelpline.company') = 'link' and plaza.text_problem('see findahelpline.com.') is null and plaza.text_problem('https://findahelpline.com/countries lists them') is null and plaza.text_problem('Call me on 555 1234') = 'contact' and plaza.text_problem('my number is 91 234') = 'contact' and plaza.text_problem('she did not text me back') is null and plaza.text_problem('my phone is broken again') is null and plaza.text_problem('Day 23.10.2026 was rough') is null and plaza.text_problem('my no 1 tip is rest') is null and plaza.text_problem('Dr.Tan said 3.5kg is fine') is null
    and plaza.text_problem('NHSINFORM.SCOT has a guide') = 'link' and plaza.text_problem('go.help') = 'link' and plaza.text_problem('findahelpline.com.evil.scot') = 'link' and plaza.text_problem('Call 5551234') = 'contact' and plaza.text_problem('My appointments are 2026-10-22 - 2026-10-23') is null and plaza.text_problem('fine.thanks for that') is null and plaza.text_problem('Seen 23.10.2026 and 24.10.2026') is null);
  out := out || jsonb_build_object('hold_cases',
    plaza.hold_why('I keep thinking about suicide', false) = 'care' and plaza.hold_why('some days I want to die', false) = 'care'
    and plaza.hold_why('I don’t want to be here any more', false) = 'care' and plaza.hold_why('I used to self-harm', false) = 'care'
    and plaza.hold_why('Stop your HRT and double your supplement dose', false) = 'advice' and plaza.hold_why('I take 50 mg at night', false) = 'advice'
    and plaza.hold_why('I’m pregnant!', true) = 'news' and plaza.hold_why('we are expecting in May', true) = 'news' and plaza.hold_why('BFP this morning', true) = 'news'
    and plaza.hold_why('I’m pregnant!', false) is null and plaza.hold_why('we lost the heartbeat at 9 weeks', true) is null
    and plaza.hold_why('my due date would have been today', true) is null and plaza.hold_why('I gave birth to my son sleeping', true) is null
    and plaza.hold_why('I''m not pregnant again this month', true) is null and plaza.hold_why('my doctor finally listened', false) is null
    and plaza.hold_why('this cramp is killing me', false) is null
    and plaza.hold_why('Take 4 ibuprofen every 2 hours', false) = 'advice' and plaza.hold_why('Start taking aspirin every day', false) = 'advice'
    and plaza.hold_why('two tablets twice a day helps', false) = 'advice' and plaza.hold_why('I take metformin', false) = 'advice'
    and plaza.hold_why('I walk every day now', false) is null and plaza.hold_why('my doctor said to stop worrying', false) is null
    and plaza.hold_why('Take insulin before meals', false) = 'advice' and plaza.hold_why('Stop taking antibiotics', false) = 'advice'
    and plaza.hold_why('You should try melatonin', false) = 'advice' and plaza.hold_why('Avoid ibuprofen on an empty stomach', false) = 'advice'
    and plaza.hold_why('my meds make me sleepy', false) is null and plaza.hold_why('I stopped the pill last year', false) is null
    and plaza.hold_why('Stop citalopram', false) = 'advice' and plaza.hold_why('Take amoxicillin', false) = 'advice'
    and plaza.hold_why('Honestly, take amoxicillin for it', false) = 'advice' and plaza.hold_why('the nurse said you should stop the antibiotics', false) = 'advice'
    and plaza.hold_why('Try a heat pad', false) = 'advice' and plaza.hold_why('Take care of yourself', false) is null
    and plaza.hold_why('Take it easy today', false) is null and plaza.hold_why('Try to rest tonight', false) is null
    and plaza.hold_why('Stop. Breathe.', false) is null
    and plaza.hold_why('Take a break from citalopram', false) = 'advice' and plaza.hold_why('Don''t take citalopram', false) = 'advice' and plaza.hold_why('Never stop your meds', false) = 'advice' and plaza.hold_why('Don’t worry, it gets better', false) is null and plaza.hold_why('Don''t take it personally', false) is null and plaza.hold_why('You should take care of yourself', false) is null and plaza.hold_why('Take care of yourself today x', false) is null and plaza.hold_why('my friend said you could try ginger', false) = 'advice');

  -- holds in live mode: crisis words (then the help reminder once shown), advice, news in a quiet room; grief and news elsewhere shown
  ec := pg_temp.seat(c, 'everyone-vent');
  r := pg_temp.say(c, ec, 'I do not want to be here any more', false); mid3 := (r -> 'message' ->> 'id')::bigint;
  r2 := pg_temp.feed(b, 'everyone', vb, 'everyone-vent');
  perform pg_temp.call(o, format('select public.admin_plaza_decide(%s, %L, %s)', mid3, 'show', (select rev from public.plaza_messages where id = mid3)));
  r3 := pg_temp.feed(b, 'everyone', vb, 'everyone-vent');
  out := out || jsonb_build_object('care_held_then_marked', r ->> 'held_why' = 'care' and not (r -> 'message' ->> 'care')::boolean and not pg_temp.has(r2, mid3)
    and pg_temp.has(r3, mid3) and (r3 -> 'messages' -> 0 ->> 'care')::boolean);
  update public.social_rate set at = at - interval '1 minute' where user_id = c;
  r := pg_temp.say(c, ec, 'Stop your HRT and see what happens', false);
  out := out || jsonb_build_object('advice_held', r ->> 'held_why' = 'advice');
  vh := pg_temp.person(h, 'Hana', 'after-a-loss', true); eh := pg_temp.seat(h, 'loss-quiet');
  r := pg_temp.say(h, eh, 'Update: I''m pregnant again', false);
  out := out || jsonb_build_object('news_held_in_quiet_room', r ->> 'held_why' = 'news');
  update public.social_rate set at = at - interval '1 minute' where user_id = h;
  r := pg_temp.say(h, eh, 'We lost the heartbeat at 9 weeks. My due date would have been today.', false);
  out := out || jsonb_build_object('grief_shown_in_quiet_room', (r ->> 'ok')::boolean and not (r ->> 'held')::boolean);
  update public.social_rate set at = at - interval '1 minute' where user_id = c;
  ec := pg_temp.seat(c, 'everyone-wins');
  r := pg_temp.say(c, ec, 'I''m pregnant! After two years', false);
  out := out || jsonb_build_object('news_shown_in_everyone', (r ->> 'ok')::boolean and not (r ->> 'held')::boolean);
  update public.social_rate set at = at - interval '1 minute' where user_id = c;
  r := pg_temp.say(c, ec, 'rough night, it all feels heavy', true);
  out := out || jsonb_build_object('asked_hold_is_private', r ->> 'held_why' = 'asked' and not (r -> 'message' ->> 'care')::boolean
    and not pg_temp.has(pg_temp.feed(b, 'everyone', vb, 'everyone-wins'), (r -> 'message' ->> 'id')::bigint));

  -- same text twice, too fast, the hourly limit
  update public.social_rate set at = at - interval '1 minute' where user_id = a;
  r := pg_temp.say(a, ea, 'SECOND thought', false);
  out := out || jsonb_build_object('same_twice', r ->> 'why' = 'same');
  r := pg_temp.say(a, ea, 'third thought', false);
  r2 := pg_temp.say(a, ea, 'fourth thought', false);
  out := out || jsonb_build_object('too_fast', (r ->> 'ok')::boolean and r2 ->> 'why' = 'fast');
  update public.social_rate set at = at - interval '1 minute' where user_id = a;
  insert into public.social_rate (user_id, kind, at) select a, 'say', clock_timestamp() - interval '10 minutes' from generate_series(1, 30);
  r := pg_temp.say(a, ea, 'fifth thought', false);
  out := out || jsonb_build_object('hourly_limit', r ->> 'why' = 'hour');
  delete from public.social_rate where user_id = a;

  -- the same window answers `same` and sends no rows; the ids still come
  r := pg_temp.feed(b, 'everyone', vb, 'everyone-chat');
  r2 := pg_temp.call(b, format('select public.plaza_room_feed(%L, %L::uuid, %L, %L)', 'everyone', vb, 'everyone-chat', r ->> 'seen'));
  out := out || jsonb_build_object('feed_same', jsonb_array_length(r -> 'ids') = 3 and jsonb_array_length(r -> 'messages') = 3 and not (r ->> 'same')::boolean
    and (r2 ->> 'same')::boolean and jsonb_array_length(r2 -> 'messages') = 0 and r2 -> 'ids' = r -> 'ids' and r2 ->> 'seen' = r ->> 'seen');

  -- a block hides messages both ways
  insert into public.social_blocks (blocker, blocked) values (b, a);
  r := pg_temp.feed(b, 'everyone', vb, 'everyone-chat'); r3 := pg_temp.feed(c, 'everyone', vc, 'everyone-chat');
  update public.social_rate set at = at - interval '1 minute' where user_id = b;
  r2 := pg_temp.say(b, eb, 'hello from Bea', false);
  out := out || jsonb_build_object('block_hides_both_ways', jsonb_array_length(r -> 'ids') = 0 and jsonb_array_length(r3 -> 'ids') = 3
    and not pg_temp.has(pg_temp.feed(a, 'everyone', va, 'everyone-chat'), (r2 -> 'message' ->> 'id')::bigint));
  delete from public.social_blocks where blocker = b;
  -- the rooms list's last message time counts only what she could read (Codex round 2, B8)
  declare x5 uuid := gen_random_uuid(); e5 uuid; begin
    perform pg_temp.person(x5, 'Pia', 'everyone', true); e5 := pg_temp.seat(x5, 'everyone-doctor');
    perform pg_temp.say(x5, e5, 'my clinic visit went fine', false);
    insert into public.social_blocks (blocker, blocked) values (b, x5);
    r := pg_temp.call(b, format('select public.plaza_rooms_list(%L, %L::uuid)', 'everyone', vb));
    r2 := pg_temp.call(c, format('select public.plaza_rooms_list(%L, %L::uuid)', 'everyone', vc));
    out := out || jsonb_build_object('last_at_hides_blocked',
      (select x ->> 'last_at' from jsonb_array_elements(r -> 'rooms') x where x ->> 'id' = 'everyone-doctor') is null
      and (select x ->> 'last_at' from jsonb_array_elements(r2 -> 'rooms') x where x ->> 'id' = 'everyone-doctor') is not null);
    delete from public.social_blocks where blocker = b and blocked = x5;
    delete from public.plaza_room_presence where user_id = x5; delete from public.plaza_presence where user_id = x5;
  end;

  -- a paused author's messages are hidden and she cannot say; a hidden card's messages are hidden
  insert into public.social_holds (user_id, until) values (a, now() + interval '3 days');
  r := pg_temp.feed(c, 'everyone', vc, 'everyone-chat'); r2 := pg_temp.say(a, ea, 'paused words', false);
  out := out || jsonb_build_object('paused_author_hidden', not pg_temp.has(r, mid) and pg_temp.has(r, (select max(id) from public.plaza_messages where author = b)),
    'paused_cannot_say', r2 ->> 'why' = 'paused');
  delete from public.social_holds where user_id = a;
  update public.social_profiles set hidden = true where user_id = a;
  r := pg_temp.feed(c, 'everyone', vc, 'everyone-chat');
  out := out || jsonb_build_object('hidden_author_hidden', not pg_temp.has(r, mid));
  update public.social_profiles set hidden = false where user_id = a;

  -- reports: reasons, not her own, not one she cannot see, once per reporter, three people hide it, staff see the text
  r := pg_temp.call(b, format('select public.plaza_report_message(%s, %L, false)', mid, 'rude'));
  out := out || jsonb_build_object('report_bad_reason', r ->> 'why' = 'reason');
  r := pg_temp.call(a, format('select public.plaza_report_message(%s, %L, false)', mid, 'unkind'));
  out := out || jsonb_build_object('report_own_refused', r ->> 'why' = 'gone');
  r := pg_temp.call(b, format('select public.plaza_report_message(%s, %L, false)', (select max(id) from public.plaza_messages where author = c and status = 'held'), 'unkind'));
  out := out || jsonb_build_object('report_held_refused', r ->> 'why' = 'gone');
  r := pg_temp.call(b, format('select public.plaza_report_message(%s, %L, false)', mid, 'advice'));
  r2 := pg_temp.call(b, format('select public.plaza_report_message(%s, %L, false)', mid, 'advice'));
  out := out || jsonb_build_object('report', (r ->> 'ok')::boolean and not (r ->> 'hidden')::boolean,
    'report_again_not_counted', (r2 ->> 'again')::boolean and (select count(*) from staff.social_reports where message_id = mid) = 1);
  perform pg_temp.call(c, format('select public.plaza_report_message(%s, %L, false)', mid, 'unkind'));
  r := pg_temp.call(g, format('select public.plaza_report_message(%s, %L, true)', mid, 'spam'));
  r2 := pg_temp.feed(c, 'everyone', vc, 'everyone-chat');
  out := out || jsonb_build_object('three_reports_hide', (r ->> 'hidden')::boolean and not pg_temp.has(r2, mid)
    and (select status = 'held' and held_why = 'reports' from public.plaza_messages where id = mid) and social.blocked(g, a));
  r := pg_temp.call(o, 'select public.admin_social_reports(''open'')');
  out := out || jsonb_build_object('report_staff_view', exists (select 1 from jsonb_array_elements(r -> 'reports') x
    where x ->> 'phrase' = 'Everyone, Chat: Hello everyone, first time here' and x ->> 'name' = 'Ann' and (x ->> 'about_message')::boolean));
  r := pg_temp.call(o, format('select public.admin_plaza_decide(%s, %L, %s)', mid, 'hide', (select rev from public.plaza_messages where id = mid)));
  out := out || jsonb_build_object('staff_hide_closes_reports', (r ->> 'ok')::boolean and (select status from public.plaza_messages where id = mid) = 'hidden'
    and not exists (select 1 from staff.social_reports where message_id = mid and status = 'open'));

  -- a decision made on an older view of the queue is refused: another owner's Hide is never silently reversed
  declare x6 uuid := gen_random_uuid(); e6 uuid; m6 bigint; r0 bigint; begin
    perform pg_temp.person(x6, 'Uma', 'everyone', true); e6 := pg_temp.seat(x6, 'everyone-wins');
    r := pg_temp.say(x6, e6, 'a long day, glad it is over', true); m6 := (r -> 'message' ->> 'id')::bigint;
    select rev into r0 from public.plaza_messages where id = m6;
    r2 := pg_temp.call(o, format('select public.admin_plaza_decide(%s, %L, %s)', m6, 'hide', r0));
    r3 := pg_temp.call(o, format('select public.admin_plaza_decide(%s, %L, %s)', m6, 'show', r0));
    out := out || jsonb_build_object('stale_decision_refused', (r2 ->> 'ok')::boolean and not (r3 ->> 'ok')::boolean and (r3 ->> 'stale')::boolean
      and (select status from public.plaza_messages where id = m6) = 'hidden');
    delete from public.plaza_room_presence where user_id = x6; delete from public.plaza_presence where user_id = x6;
  end;

  -- a decision on a message past its 24 hours is refused: nobody could see it any more (Codex diff review round 5, 5)
  declare x7 uuid := gen_random_uuid(); m7 bigint; begin
    perform pg_temp.person(x7, 'Ivy', 'everyone', true);
    insert into public.plaza_messages (room, server, author, handle, name, look, body, status, held_why, at)
      select 'everyone-chat', 'everyone', x7, s.handle, s.name, s.look, 'from a day ago', 'held', 'review', clock_timestamp() - interval '25 hours'
      from public.social_profiles s where s.user_id = x7 returning id into m7;
    r := pg_temp.call(o, format('select public.admin_plaza_decide(%s, %L, %s)', m7, 'show', (select rev from public.plaza_messages where id = m7)));
    out := out || jsonb_build_object('expired_decision_refused', not (r ->> 'ok')::boolean and (select status from public.plaza_messages where id = m7) = 'held');
    delete from public.plaza_messages where id = m7; delete from public.plaza_presence where user_id = x7;
  end;

  -- another group's room is closed to her; reading needs her own group
  r := pg_temp.feed(f, 'pcos', vf, 'everyone-chat'); r2 := pg_temp.feed(f, 'everyone', vf, 'everyone-chat');
  out := out || jsonb_build_object('other_group_refused', r ->> 'why' = 'closed' and r2 ->> 'why' = 'not_here');

  -- leaving the group ends the room at once; the next sweep deletes the row
  vk := pg_temp.person(k, 'Kim', 'everyone', true); ek := pg_temp.seat(k, 'everyone-wins');
  i := plaza.room_count('everyone-wins');
  delete from public.plaza_presence where user_id = k;
  ok := plaza.room_count('everyone-wins') = i - 1;
  perform plaza.sweep();
  out := out || jsonb_build_object('room_ends_with_visit', ok and not exists (select 1 from public.plaza_room_presence where user_id = k));

  -- Room chat off deletes her messages; Plaza friends off ends Room chat, her room and her messages
  r := pg_temp.call(h, 'select public.plaza_chat_off(1, null)');
  out := out || jsonb_build_object('chat_off_deletes', (r ->> 'ok')::boolean and not exists (select 1 from public.plaza_messages where author = h)
    and not public.consent_allows(h, 'plaza_chat'));
  perform pg_temp.call(c, 'select public.consent_record(''social'', ''withdraw'', 3)');
  out := out || jsonb_build_object('withdraw_social_ends_chat', not exists (select 1 from public.plaza_messages where author = c)
    and not exists (select 1 from public.plaza_room_presence where user_id = c) and not public.consent_allows(c, 'plaza_chat')
    and exists (select 1 from public.consent_events where user_id = c and purpose = 'plaza_chat' and action = 'withdraw' and method = 'server'));

  -- retention: a message older than 24 hours is never read, and the sweep deletes it; open message reports end at 90 days
  vy := pg_temp.person(y, 'Yan', 'everyone', true); ey := pg_temp.seat(y, 'everyone-chat');
  insert into public.plaza_messages (room, server, author, handle, name, look, body, status, at)
    select 'everyone-chat', 'everyone', y, s.handle, s.name, s.look, 'from yesterday', 'shown', clock_timestamp() - interval '25 hours' from public.social_profiles s where s.user_id = y
    returning id into hid;
  r := pg_temp.feed(b, 'everyone', vb, 'everyone-chat');
  ok := not pg_temp.has(r, hid);
  perform plaza.sweep();
  out := out || jsonb_build_object('retention', ok and not exists (select 1 from public.plaza_messages where id = hid),
    'hourly_cleanup_scheduled', exists (select 1 from cron.job where jobname = 'rhythme-plaza-chat-sweep' and command = 'select plaza.sweep()' and schedule = '7 * * * *'));
  insert into staff.social_reports (reporter, target, target_handle, target_name, reason, message_id, room, at) values (b, y, gen_random_uuid(), 'Yan', 'spam', 999999999, 'everyone-chat', now() - interval '91 days');
  perform plaza.sweep();
  out := out || jsonb_build_object('open_report_limit', not exists (select 1 from staff.social_reports where message_id = 999999999));

  -- the chat switch off closes rooms, joining and saying
  update public.plaza_flags set value = 'off' where key = 'chat';
  r := pg_temp.call(b, format('select public.plaza_rooms_list(%L, %L::uuid)', 'everyone', vb));
  r2 := pg_temp.call(y, format('select public.plaza_room_join(%L, %L::uuid, %L)', 'everyone', vy, 'everyone-wins'));
  update public.social_rate set at = at - interval '1 minute' where user_id = b;
  r3 := pg_temp.say(b, eb, 'anyone here?', false);
  out := out || jsonb_build_object('chat_flag_off', not (r ->> 'chat_on')::boolean and not (r -> 'rooms' -> 0 ->> 'open')::boolean and r2 ->> 'why' = 'closed' and r3 ->> 'why' = 'closed');
  update public.plaza_flags set value = 'on' where key = 'chat';

  -- a full quiet group suggests nothing; a full topic group suggests Everyone
  fillers := array(select gen_random_uuid() from generate_series(1, 48));
  for i in 1 .. 24 loop perform pg_temp.person(fillers[i], 'Loss' || i, 'after-a-loss', false); end loop;
  for i in 25 .. 48 loop perform pg_temp.person(fillers[i], 'Meno' || i, 'menopause', false); end loop;
  delete from public.plaza_presence where user_id = h;
  insert into public.consent_events (user_id, purpose, action, notice_version, method) values (q, 'age_18', 'grant', 3, 'sheet'), (q, 'social', 'grant', 3, 'jit');
  insert into public.social_profiles (user_id, name, look) values (q, 'Quin', 'base');
  r := pg_temp.call(q, 'select public.plaza_join(''after-a-loss'')');
  r2 := pg_temp.call(q, 'select public.plaza_join(''menopause'')');
  out := out || jsonb_build_object('quiet_full_no_suggest', r ->> 'why' = 'full' and (r -> 'suggest') = 'null'::jsonb,
    'topic_full_suggests_everyone', r2 ->> 'why' = 'full' and r2 -> 'suggest' ->> 'id' = 'everyone');

  -- an account deletion removes her messages and her room
  vy := null;
  delete from auth.users where id = y;
  out := out || jsonb_build_object('account_delete', not exists (select 1 from public.plaza_messages where author = y) and not exists (select 1 from public.plaza_room_presence where user_id = y));

  -- every expected check present and true; a null counts as a failure
  select coalesce(bool_and(coalesce(value::boolean, false)), false) into ok from jsonb_each_text(out);
  ok := ok and (select count(*) from unnest(expected) x where out ? x) = array_length(expected, 1)
    and (select count(*) from jsonb_object_keys(out)) = array_length(expected, 1);
  raise exception 'RESULT %', jsonb_build_object('all', ok, 'count', (select count(*) from jsonb_object_keys(out)), 'expected', array_length(expected, 1),
    'missing', (select jsonb_agg(x) from unnest(expected) x where not out ? x),
    'failing', (select jsonb_agg(key) from jsonb_each_text(out) where not coalesce(value::boolean, false)),
    'errors', (select jsonb_agg(jsonb_build_object('q', de.qry, 'e', de.err)) from pg_temp.dry_errors de),
    'bodies', (select jsonb_object_agg(ns.nspname || '.' || pr.proname, md5(pr.prosrc))
      from pg_proc pr join pg_namespace ns on ns.oid = pr.pronamespace
      where ns.nspname = 'plaza' or (ns.nspname = 'public' and (pr.proname like 'plaza\_%' or pr.proname like 'admin\_plaza\_%'))
        or (ns.nspname = 'staff' and pr.proname in ('plaza_queue', 'plaza_decide', 'social_reports_list'))));
end $t$;
