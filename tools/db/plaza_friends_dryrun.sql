-- Rolled-back check of supabase/migrations/20261019130000_plaza_friends.sql (19-20 Oct 2026, third cut).
-- Run as ONE batch: the migration text, then this file. The last statement raises 'RESULT {...}', so the implicit
-- transaction rolls back (tables, functions, rows, consent events, the cron job: nothing is kept) and the message carries
-- the checks. Every expected check must be present and true; a missing or null one fails the run.
-- Usage: python3 tools/db/dryrun.py prints the combined batch for execute_sql.

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
  if r ? 'error' then insert into pg_temp.dry_errors (qry, err) values (left(q, 60), r->>'error'); end if; -- every refusal is listed in the result
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
-- does this transaction hold the account lock for u (advisory namespace 4242)
create function pg_temp.locked(u uuid) returns boolean language sql as $f$
  select exists (select 1 from pg_locks l where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.classid = 4242::oid and l.objsubid = 2
    and l.objid = ((hashtext('social:acct:' || u::text)::bigint) & 4294967295)::oid)
$f$;
-- a person made directly (no calls, so no locks): 18+ and Plaza friends on record, a card, and optionally in a group now
create function pg_temp.person(u uuid, nm text, srv text) returns uuid language plpgsql as $f$
declare h uuid;
begin
  insert into auth.users (id, email, aud, role) values (u, 'dryrun-' || u || '@example.invalid', 'authenticated', 'authenticated');
  insert into public.consent_events (user_id, purpose, action, notice_version, method) values (u, 'age_18', 'grant', 3, 'sheet'), (u, 'social', 'grant', 3, 'jit');
  insert into public.social_profiles (user_id, name, look) values (u, nm, 'base') returning handle into h;
  if srv is not null then insert into public.plaza_presence (user_id, server, visit, joined_at, seen_at) values (u, srv, gen_random_uuid(), clock_timestamp(), clock_timestamp()); end if;
  return h;
end $f$;

do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  e uuid := gen_random_uuid(); n uuid := gen_random_uuid(); m uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  y uuid := gen_random_uuid(); z uuid := gen_random_uuid(); w uuid := gen_random_uuid(); v uuid := gen_random_uuid(); q uuid := gen_random_uuid();
  ku uuid := gen_random_uuid(); ju uuid := gen_random_uuid(); hw uuid; hk uuid;
  owner uuid; va uuid; vb uuid; vc uuid; vd uuid; ve uuid; vn uuid; vy uuid; vw uuid; ha uuid; hb uuid; hc uuid; hd uuid; he uuid; hy uuid; hz uuid; hv uuid;
  r jsonb; r2 jsonb; out jsonb := '{}'; i integer; note_id bigint; rep_id bigint; blk uuid; ok boolean; pre boolean;
  expected text[] := array['names', 'anon_refused', 'no_sub_refused', 'tables_closed', 'minor_refused', 'bad_name_refused', 'no_opt_in_refused', 'card_a',
    'hide_show_keeps_handle', 'handles_not_ids', 'edit_needs_its_card', 'people_mutual_same_group', 'people_needs_her_visit', 'no_card_sees_nobody',
    'hidden_sees_nobody', 'hidden_cannot_ask', 'ask', 'ask_other_group_refused', 'ask_hidden_refused', 'ask_bad_hello_refused', 'inbox_asks', 'not_now_silent',
    'mutual_ask_friends', 'note', 'note_too_fast', 'note_not_friend', 'note_bad_phrase', 'note_in_inbox', 'note_read', 'report_bad_reason',
    'report_not_her_note', 'report', 'reports_staff_only', 'reports_owner_view', 'decide_owner_only', 'pause', 'pause_survives_off_on',
    'new_card_new_handle', 'stale_edit_after_withdraw', 'block', 'unblock', 'unfriend', 'withdraw_any_route', 'rate_limits', 'retention',
    'locks_pair', 'locks_withdrawal', 'reciprocal_needs_14_days', 'declines_keep_quota', 'block_snapshot_only_if_visible', 'inbox_only_friends_notes',
    'daily_cleanup_scheduled', 'account_delete', 'block_snapshot_not_if_blocked', 'block_snapshot_not_if_hidden', 'age_withdraw_deletes',
    'read_needs_ok', 'decide_rechecks'];
begin
  insert into auth.users (id, email, aud, role) select u, 'dryrun-' || u || '@example.invalid', 'authenticated', 'authenticated' from unnest(array[a, b, c, d, e, n, m, x]) u;
  -- B, C, D, E, N attested 18+ earlier (as the consent sheet does); A ticks it on her card; M never does
  insert into public.consent_events (user_id, purpose, action, notice_version, method) select u, 'age_18', 'grant', 3, 'sheet' from unnest(array[b, c, d, e, n, x]) u;
  select user_id into owner from staff.admin_accounts where role = 'owner' and revoked_at is null limit 1;

  -- the plaza name rules
  out := out || jsonb_build_object('names',
    social.name_problem('x') = 'length' and social.name_problem('Mei@home') = 'chars' and social.name_problem('Mei 98765') = 'contact'
    and social.name_problem('www mei') = 'contact' and social.name_problem('Staff') = 'reserved' and social.name_problem('Rhythme Team') = 'reserved'
    and social.name_problem('Admin Jo') = 'reserved' and social.name_problem('sexy mei') = 'word' and social.name_problem('ask on whatsapp') = 'word'
    and social.name_problem('Zoë') is null and social.name_problem('美玲') is null and social.name_problem('Ana-María O''Neil') is null
    and social.name_problem('  Mei   Ling ') is null and social.clean_name('  Mei   Ling ') = 'Mei Ling' and social.name_problem('Cassandra') is null);

  -- signed out and anonymous callers
  r := pg_temp.anon('select public.social_me()');
  r2 := pg_temp.call(null, 'select public.social_me()');
  out := out || jsonb_build_object('anon_refused', r->>'code' = '42501', 'no_sub_refused', r2->>'error' = 'sign in first');
  r := pg_temp.call(a, 'select to_jsonb(count(*)) from public.social_profiles');
  out := out || jsonb_build_object('tables_closed', r->>'code' = '42501');

  -- cards: 18+ and an explicit opt-in are required; A ticks both and both choices are recorded with the card
  r := pg_temp.call(m, $q$select public.social_card_save(p_name => 'Mia', p_look => 'base', p_opt_in => true)$q$);
  out := out || jsonb_build_object('minor_refused', r->>'why' = 'adult' and not exists (select 1 from public.social_profiles where user_id = m));
  r := pg_temp.call(a, $q$select public.social_card_save(p_name => 'sexy mei', p_look => 'base', p_adult => true, p_opt_in => true)$q$);
  out := out || jsonb_build_object('bad_name_refused', r->>'why' = 'name' and r->>'problem' = 'word' and not public.consent_allows(a, 'social'));
  r := pg_temp.call(a, $q$select public.social_card_save(p_name => 'Mei', p_look => 'base', p_adult => true)$q$);
  out := out || jsonb_build_object('no_opt_in_refused', r->>'why' = 'consent' and not public.consent_allows(a, 'social') and not public.consent_allows(a, 'age_18'));
  r := pg_temp.call(a, $q$select public.social_card_save(p_name => '  Mei ', p_look => 'kebaya-blue', p_adult => true, p_notice => 3, p_hash => 'abc', p_device => 'dev1', p_opt_in => true)$q$);
  out := out || jsonb_build_object('card_a', r->>'ok' = 'true' and r->'card'->>'name' = 'Mei' and r->'recorded' = '["age_18", "social"]'::jsonb
    and public.consent_allows(a, 'social') and public.consent_allows(a, 'age_18')
    and (select method from public.consent_events where user_id = a and purpose = 'social' order by id desc limit 1) = 'jit');
  ha := (r->'card'->>'handle')::uuid;
  r := pg_temp.call(a, format('select public.social_card_save(p_name => %L, p_look => %L, p_hidden => true, p_expect => %L)', 'Mei', 'kebaya-blue', ha));
  r2 := pg_temp.call(a, format('select public.social_card_save(p_name => %L, p_look => %L, p_hidden => false, p_expect => %L)', 'Mei', 'kebaya-blue', ha));
  out := out || jsonb_build_object('hide_show_keeps_handle', (r->'card'->>'hidden')::boolean and not (r2->'card'->>'hidden')::boolean and (r2->'card'->>'handle')::uuid = ha
    and (select count(*) from public.social_rate where user_id = a and kind = 'card') = 1);
  hb := (pg_temp.call(b, $q$select public.social_card_save(p_name => 'Nadia', p_look => 'kebaya-green', p_opt_in => true)$q$)->'card'->>'handle')::uuid;
  hc := (pg_temp.call(c, $q$select public.social_card_save(p_name => 'Priya', p_look => 'cozy', p_opt_in => true)$q$)->'card'->>'handle')::uuid;
  hd := (pg_temp.call(d, $q$select public.social_card_save(p_name => 'Sofia', p_look => 'party', p_opt_in => true)$q$)->'card'->>'handle')::uuid;
  he := (pg_temp.call(e, $q$select public.social_card_save(p_name => 'Lina', p_look => 'yoga', p_hidden => true, p_opt_in => true)$q$)->'card'->>'handle')::uuid;
  out := out || jsonb_build_object('handles_not_ids', ha <> a and hb <> b and hb is not null and he is not null);
  r := pg_temp.call(b, format('select public.social_card_save(p_name => %L, p_look => %L, p_expect => %L)', 'Nadia B', 'kebaya-green', gen_random_uuid()));
  r2 := pg_temp.call(b, $q$select public.social_card_save(p_name => 'Nadia B', p_look => 'kebaya-green')$q$);
  out := out || jsonb_build_object('edit_needs_its_card', r->>'why' = 'stale' and r2->>'why' = 'stale' and (select name from public.social_profiles where user_id = b) = 'Nadia');

  -- presence through the plaza's own join: A, B, C, E (hidden) and N (no card) in PCOS, D in Everyone
  va := (pg_temp.call(a, $q$select public.plaza_join('pcos')$q$)->>'visit')::uuid;
  vb := (pg_temp.call(b, $q$select public.plaza_join('pcos')$q$)->>'visit')::uuid;
  vc := (pg_temp.call(c, $q$select public.plaza_join('pcos')$q$)->>'visit')::uuid;
  ve := (pg_temp.call(e, $q$select public.plaza_join('pcos')$q$)->>'visit')::uuid;
  vn := (pg_temp.call(n, $q$select public.plaza_join('pcos')$q$)->>'visit')::uuid;
  vd := (pg_temp.call(d, $q$select public.plaza_join('everyone')$q$)->>'visit')::uuid;

  r := pg_temp.call(a, format('select public.social_people(%L, %L)', 'pcos', va));
  out := out || jsonb_build_object('people_mutual_same_group', r->>'ok' = 'true' and jsonb_array_length(r->'people') = 2
    and (select array_agg(p->>'name' order by p->>'name') from jsonb_array_elements(r->'people') p) = array['Nadia', 'Priya']
    and r::text not like '%' || b::text || '%' and r::text not like '%' || c::text || '%');
  r := pg_temp.call(a, format('select public.social_people(%L, %L)', 'pcos', gen_random_uuid()));
  r2 := pg_temp.call(a, format('select public.social_people(%L, %L)', 'everyone', va));
  out := out || jsonb_build_object('people_needs_her_visit', r->>'why' = 'away' and r2->>'why' = 'away');
  out := out || jsonb_build_object('no_card_sees_nobody', pg_temp.call(n, format('select public.social_people(%L, %L)', 'pcos', vn))->>'why' = 'off',
    'hidden_sees_nobody', pg_temp.call(e, format('select public.social_people(%L, %L)', 'pcos', ve))->>'why' = 'hidden',
    'hidden_cannot_ask', pg_temp.call(e, format('select public.social_ask(%L, %L, %L, null)', hb, 'pcos', ve))->>'why' = 'hidden' and not exists (select 1 from public.social_requests where from_user = e));

  -- asking: only in the same group; repeats are harmless; not now is silent
  r := pg_temp.call(a, format('select public.social_ask(%L, %L, %L, %L)', hb, 'pcos', va, 'hello'));
  r2 := pg_temp.call(a, format('select public.social_ask(%L, %L, %L, %L)', hb, 'pcos', va, 'hello'));
  out := out || jsonb_build_object('ask', r->>'status' = 'asked' and r2->>'status' = 'asked' and (select count(*) from public.social_requests where from_user = a) = 1);
  out := out || jsonb_build_object('ask_other_group_refused', pg_temp.call(a, format('select public.social_ask(%L, %L, %L, null)', hd, 'pcos', va))->>'why' = 'gone',
    'ask_hidden_refused', pg_temp.call(a, format('select public.social_ask(%L, %L, %L, null)', he, 'pcos', va))->>'why' = 'gone',
    'ask_bad_hello_refused', pg_temp.call(a, format('select public.social_ask(%L, %L, %L, %L)', hc, 'pcos', va, 'tea'))->>'why' = 'phrase');
  r := pg_temp.call(b, 'select public.social_inbox()');
  out := out || jsonb_build_object('inbox_asks', jsonb_array_length(r->'asks') = 1 and r->'asks'->0->>'name' = 'Mei' and r->'asks'->0->>'hello' = 'hello' and r::text not like '%' || a::text || '%');
  r := pg_temp.call(b, format('select public.social_answer(%L, false)', ha));
  r2 := pg_temp.call(a, format('select public.social_ask(%L, %L, %L, null)', hb, 'pcos', va));
  out := out || jsonb_build_object('not_now_silent', r->>'status' = 'declined' and r2->>'status' = 'asked'
    and (pg_temp.call(a, format('select public.social_people(%L, %L)', 'pcos', va))->'people') @> jsonb_build_array(jsonb_build_object('name', 'Nadia', 'asked', true))
    and jsonb_array_length(pg_temp.call(b, 'select public.social_inbox()')->'asks') = 0
    and (pg_temp.call(a, 'select public.social_inbox()')->'asked') @> jsonb_build_array(jsonb_build_object('name', 'Nadia')));

  -- asking someone who asked you makes you friends
  r := pg_temp.call(c, format('select public.social_ask(%L, %L, %L, null)', ha, 'pcos', vc));
  r2 := pg_temp.call(a, format('select public.social_ask(%L, %L, %L, null)', hc, 'pcos', va));
  out := out || jsonb_build_object('mutual_ask_friends', r->>'status' = 'asked' and r2->>'status' = 'friends' and social.friends(a, c)
    and not exists (select 1 from public.social_requests where (from_user = a and to_user = c) or (from_user = c and to_user = a))
    and (pg_temp.call(a, 'select public.social_inbox()')->'friends') @> jsonb_build_array(jsonb_build_object('name', 'Priya')));

  -- kind notes: friends only, from the list, not too fast
  r := pg_temp.call(a, format('select public.social_note(%L, %L)', hc, 'tea')); note_id := (r->>'id')::bigint;
  out := out || jsonb_build_object('note', r->>'ok' = 'true',
    'note_too_fast', pg_temp.call(a, format('select public.social_note(%L, %L)', hc, 'hug'))->>'why' = 'slow',
    'note_not_friend', pg_temp.call(a, format('select public.social_note(%L, %L)', hb, 'tea'))->>'why' = 'gone',
    'note_bad_phrase', pg_temp.call(c, format('select public.social_note(%L, %L)', ha, 'hello'))->>'why' = 'phrase');
  r := pg_temp.call(c, 'select public.social_inbox()');
  out := out || jsonb_build_object('note_in_inbox', r->'notes'->0->>'phrase' = 'tea' and r->'notes'->0->>'name' = 'Mei' and not (r->'notes'->0->>'read')::boolean);
  perform pg_temp.call(c, format('select public.social_read(%s)', note_id));
  out := out || jsonb_build_object('note_read', (pg_temp.call(c, 'select public.social_inbox()')->'notes'->0->>'read')::boolean);

  -- reports, and staff review that sees cards, never accounts
  out := out || jsonb_build_object('report_bad_reason', pg_temp.call(c, format('select public.social_report(%L, %L, %s, false)', ha, 'rude', note_id))->>'why' = 'reason',
    'report_not_her_note', pg_temp.call(b, format('select public.social_report(%L, %L, %s, false)', ha, 'unkind', note_id))->>'why' = 'gone');
  r := pg_temp.call(c, format('select public.social_report(%L, %L, %s, false)', ha, 'unkind', note_id));
  out := out || jsonb_build_object('report', r->>'ok' = 'true');
  r := pg_temp.call(b, $q$select public.admin_social_reports('open')$q$);
  out := out || jsonb_build_object('reports_staff_only', (r->>'denied')::boolean
    and exists (select 1 from staff.admin_audit where actor = b and rpc = 'admin_social_reports' and decision = 'denied'));
  if owner is not null then
    r := pg_temp.call(owner, $q$select public.admin_social_reports('open')$q$);
    rep_id := (r->'reports'->0->>'id')::bigint;
    out := out || jsonb_build_object('reports_owner_view', jsonb_array_length(r->'reports') >= 1 and r->'reports'->0->>'name' = 'Mei'
      and r->'reports'->0->>'phrase' = 'Sending you a warm cup of tea.' and length(r->'reports'->0->>'card') = 8 and r->'reports'->0->>'from_name' = 'Priya'
      and r::text not like '%' || a::text || '%' and r::text not like '%' || c::text || '%' and r::text not like '%' || ha::text || '%' and r::text not like '%pcos%');
    out := out || jsonb_build_object('decide_owner_only', (pg_temp.call(b, format('select public.admin_social_decide(%s, %L, 3)', rep_id, 'pause'))->>'denied')::boolean);
    r := pg_temp.call(owner, format('select public.admin_social_decide(%s, %L, 3)', rep_id, 'pause'));
    out := out || jsonb_build_object('pause', r->>'ok' = 'true' and social.paused(a) is not null
      and pg_temp.call(a, format('select public.social_people(%L, %L)', 'pcos', va))->>'why' = 'off'
      and pg_temp.call(a, 'select public.social_inbox()')->>'why' = 'paused'
      and not ((pg_temp.call(c, 'select public.social_inbox()')->'friends') @> jsonb_build_array(jsonb_build_object('name', 'Mei')))
      and not ((pg_temp.call(b, format('select public.social_people(%L, %L)', 'pcos', vb))->'people') @> jsonb_build_array(jsonb_build_object('name', 'Mei')))
      and (select status from staff.social_reports where id = rep_id) = 'paused');
    -- turning it off and on again does not lift a pause
    perform pg_temp.call(a, 'select public.social_off(3)');
    r := pg_temp.call(a, $q$select public.social_card_save(p_name => 'Mei', p_look => 'base', p_opt_in => true)$q$);
    out := out || jsonb_build_object('pause_survives_off_on', r->>'why' = 'paused' and not exists (select 1 from public.social_profiles where user_id = a) and not social.friends(a, c));
    delete from public.social_holds where user_id = a;
    r := pg_temp.call(a, $q$select public.social_card_save(p_name => 'Mei', p_look => 'base', p_opt_in => true)$q$);
    out := out || jsonb_build_object('new_card_new_handle', r->>'ok' = 'true' and (r->'card'->>'handle')::uuid <> ha);
    ha := (r->'card'->>'handle')::uuid;
    r := pg_temp.call(owner, format('select public.admin_social_decide(%s, %L, null)', rep_id, 'dismiss'));
    r2 := pg_temp.call(owner, format('select public.admin_social_decide(%s, %L, null)', rep_id, 'ban'));
    out := out || jsonb_build_object('decide_rechecks', r->>'error' = 'That report is already decided.' and r2->>'error' = 'Unknown decision.'
      and (select status from staff.social_reports where id = rep_id) = 'paused');
  else
    out := out || jsonb_build_object('owner_missing', true);
  end if;

  -- a form left open on another phone: after a withdrawal it can neither bring the choice back nor make a card
  perform pg_temp.call(e, 'select public.social_off(3)');
  r := pg_temp.call(e, format('select public.social_card_save(p_name => %L, p_look => %L, p_expect => %L)', 'Lina', 'yoga', he));
  r2 := pg_temp.call(e, $q$select public.social_card_save(p_name => 'Lina', p_look => 'yoga')$q$);
  out := out || jsonb_build_object('stale_edit_after_withdraw', r->>'why' = 'stale' and r2->>'why' = 'consent' and not public.consent_allows(e, 'social') and not exists (select 1 from public.social_profiles where user_id = e));

  -- block: two-way, silent, ends everything; unblock by the list's id
  perform pg_temp.call(c, format('select public.social_ask(%L, %L, %L, null)', hb, 'pcos', vc));
  r := pg_temp.call(b, format('select public.social_block(%L)', hc));
  out := out || jsonb_build_object('block', r->>'ok' = 'true'
    and not ((pg_temp.call(b, format('select public.social_people(%L, %L)', 'pcos', vb))->'people') @> jsonb_build_array(jsonb_build_object('name', 'Priya')))
    and not ((pg_temp.call(c, format('select public.social_people(%L, %L)', 'pcos', vc))->'people') @> jsonb_build_array(jsonb_build_object('name', 'Nadia')))
    and not exists (select 1 from public.social_requests where from_user = c and to_user = b)
    and pg_temp.call(c, format('select public.social_ask(%L, %L, %L, null)', hb, 'pcos', vc))->>'why' = 'gone');
  r := pg_temp.call(b, 'select public.social_inbox()'); blk := (r->'blocked'->0->>'id')::uuid;
  perform pg_temp.call(b, format('select public.social_unblock(%L)', blk));
  out := out || jsonb_build_object('unblock', r->'blocked'->0->>'name' = 'Priya'
    and (pg_temp.call(b, format('select public.social_people(%L, %L)', 'pcos', vb))->'people') @> jsonb_build_array(jsonb_build_object('name', 'Priya')));

  -- unfriend: silent, and the notes between them go
  perform pg_temp.call(d, 'select public.plaza_join(''pcos'')'); vd := (select visit from public.plaza_presence where user_id = d);
  perform pg_temp.call(c, format('select public.social_ask(%L, %L, %L, null)', hd, 'pcos', vc));
  perform pg_temp.call(d, format('select public.social_answer(%L, true)', hc));
  perform pg_temp.call(d, format('select public.social_note(%L, %L)', hc, 'gentle'));
  ok := social.friends(c, d) and exists (select 1 from public.social_notes where from_user = d and to_user = c);
  perform pg_temp.call(c, format('select public.social_unfriend(%L)', hd));
  out := out || jsonb_build_object('unfriend', ok and not social.friends(c, d) and not exists (select 1 from public.social_notes where from_user = d and to_user = c));

  -- withdrawing through the general consent call deletes the card, requests and friendships too (the trigger)
  perform pg_temp.call(c, format('select public.social_ask(%L, %L, %L, null)', hd, 'pcos', vc));
  perform pg_temp.call(d, $q$select public.consent_record('social', 'withdraw', 3)$q$);
  out := out || jsonb_build_object('withdraw_any_route', not exists (select 1 from public.social_profiles where user_id = d)
    and not exists (select 1 from public.social_requests where to_user = d or from_user = d) and not public.consent_allows(d, 'social'));

  -- limits
  ok := social.hit(x, 'ask', 2, interval '1 day') and social.hit(x, 'ask', 2, interval '1 day') and not social.hit(x, 'ask', 2, interval '1 day');
  for i in 1..5 loop perform pg_temp.call(b, format('select public.social_card_save(p_name => %L, p_look => %L, p_expect => %L)', 'Nadia ' || chr(64 + i), 'kebaya-green', hb)); end loop;
  r := pg_temp.call(b, format('select public.social_card_save(p_name => %L, p_look => %L, p_expect => %L)', 'Nadia Z', 'kebaya-green', hb));
  out := out || jsonb_build_object('rate_limits', ok and r->>'why' = 'today');

  -- locks: a call between two people holds both account locks before it checks; a withdrawal holds hers
  hy := pg_temp.person(y, 'Yuna', 'pcos'); hz := pg_temp.person(z, 'Zara', 'pcos');
  pre := pg_temp.locked(y) or pg_temp.locked(z);
  vy := (select visit from public.plaza_presence where user_id = y);
  insert into public.social_requests (from_user, to_user, status, at) values (z, y, 'pending', now() - interval '15 days'); -- her ask is past its 14 days
  r := pg_temp.call(y, format('select public.social_ask(%L, %L, %L, null)', hz, 'pcos', vy));
  out := out || jsonb_build_object('locks_pair', not pre and pg_temp.locked(y) and pg_temp.locked(z),
    'reciprocal_needs_14_days', r->>'status' = 'asked' and not social.friends(y, z));
  perform pg_temp.person(q, 'Quinn', null);
  pre := pg_temp.locked(q);
  perform pg_temp.call(q, $q$select public.consent_record('social', 'withdraw', 3)$q$);
  out := out || jsonb_build_object('locks_withdrawal', not pre and pg_temp.locked(q));

  -- quota: twenty asks in the last fortnight, all answered "not now", and the next one waits
  hw := pg_temp.person(w, 'Wren', 'pcos'); vw := (select visit from public.plaza_presence where user_id = w);
  insert into auth.users (id, email, aud, role) select g, 'dryrun-' || g || '@example.invalid', 'authenticated', 'authenticated' from (select gen_random_uuid() g from generate_series(1, 20)) s;
  insert into public.social_requests (from_user, to_user, status, at, decided_at)
    select w, u.id, 'declined', now() - interval '1 day', now()
    from (select id from auth.users where email like 'dryrun-%@example.invalid' and id not in (a, b, c, d, e, n, m, x, y, z, w, q) limit 20) u;
  -- the quota is counted from the ask log, which a block and an unblock cannot reset (Codex pre-merge review, 20 Oct, item 6)
  insert into public.social_ask_log (from_user, to_user, last_at) select from_user, to_user, at from public.social_requests where from_user = w;
  r := pg_temp.call(w, format('select public.social_ask(%L, %L, %L, null)', hy, 'pcos', vw));
  out := out || jsonb_build_object('declines_keep_quota', r->>'why' = 'many' and (select count(*) from public.social_requests where from_user = w and status = 'declined') = 20);

  -- a block copies her card only if it was visible: Yuna is in A's group, Vera (no group, no ties) is not
  hv := pg_temp.person(v, 'Vera', null);
  perform pg_temp.call(a, format('select public.social_block(%L)', hv));
  perform pg_temp.call(a, format('select public.social_block(%L)', hy));
  out := out || jsonb_build_object('block_snapshot_only_if_visible',
    (select name from public.social_blocks where blocker = a and blocked = v) is null and (select name from public.social_blocks where blocker = a and blocked = y) = 'Yuna');

  -- someone who blocked you cannot be looked up by blocking her back, and a hidden person cannot look anyone up that way
  perform pg_temp.call(z, format('select public.social_block(%L)', hw));
  perform pg_temp.call(w, format('select public.social_block(%L)', hz));
  hk := pg_temp.person(ku, 'Kai', 'pcos'); update public.social_profiles set hidden = true where user_id = ku;
  perform pg_temp.call(ku, format('select public.social_block(%L)', hy));
  out := out || jsonb_build_object('block_snapshot_not_if_blocked', (select name from public.social_blocks where blocker = z and blocked = w) = 'Wren'
      and (select name from public.social_blocks where blocker = w and blocked = z) is null,
    'block_snapshot_not_if_hidden', exists (select 1 from public.social_blocks where blocker = ku and blocked = y) and (select name from public.social_blocks where blocker = ku and blocked = y) is null);

  -- withdrawing 18+ by any route ends Plaza friends the same way
  perform pg_temp.person(ju, 'Jo', 'pcos');
  perform pg_temp.call(ju, $q$select public.consent_record('age_18', 'withdraw', 3)$q$);
  out := out || jsonb_build_object('age_withdraw_deletes', not exists (select 1 from public.social_profiles where user_id = ju) and pg_temp.locked(ju));

  -- marking notes read needs Plaza friends on (a paused account cannot)
  insert into public.social_holds (user_id, until) values (y, now() + interval '1 day');
  r := pg_temp.call(y, 'select public.social_read(1000)');
  delete from public.social_holds where user_id = y;
  out := out || jsonb_build_object('read_needs_ok', r->>'why' = 'off');

  -- the inbox shows notes only from friends she has not blocked, whatever a race left behind
  insert into public.social_notes (from_user, to_user, phrase) values (v, a, 'hug'), (z, a, 'rest');
  r := pg_temp.call(a, 'select public.social_inbox()');
  out := out || jsonb_build_object('inbox_only_friends_notes', r->>'ok' = 'true' and jsonb_array_length(r->'notes') = 0);

  -- retention: old notes go on the next sweep, reads ignore them before that, and the sweep is also scheduled daily
  insert into public.social_notes (from_user, to_user, phrase, at) values (b, c, 'rest', now() - interval '31 days');
  r := pg_temp.call(c, 'select public.social_inbox()');
  out := out || jsonb_build_object('retention', not ((r->'notes') @> jsonb_build_array(jsonb_build_object('phrase', 'rest')))
    and not exists (select 1 from public.social_notes where phrase = 'rest' and at < now() - interval '30 days'),
    'daily_cleanup_scheduled', exists (select 1 from cron.job where jobname = 'rhythme-social-sweep' and command = 'select social.sweep()' and schedule = '17 19 * * *'));

  -- an account deletion removes the rest
  delete from auth.users where id = c;
  out := out || jsonb_build_object('account_delete', not exists (select 1 from public.social_profiles where user_id = c) and not exists (select 1 from public.social_friends f where f.a = c or f.b = c)
    and exists (select 1 from staff.social_reports where reporter is null and reporter_name = 'Priya'));

  -- every expected check present and true; a null counts as a failure
  select coalesce(bool_and(coalesce(value::boolean, false)), false) into ok from jsonb_each_text(out) where key <> 'owner_missing';
  ok := ok and not (out ? 'owner_missing') and (select count(*) from unnest(expected) k where out ? k) = array_length(expected, 1)
    and (select count(*) from jsonb_object_keys(out)) = array_length(expected, 1);
  raise exception 'RESULT %', jsonb_build_object('all', ok, 'count', (select count(*) from jsonb_object_keys(out)), 'expected', array_length(expected, 1),
    'missing', (select jsonb_agg(k) from unnest(expected) k where not out ? k), 'checks', out,
    'errors', (select jsonb_agg(jsonb_build_object('q', de.qry, 'e', de.err)) from pg_temp.dry_errors de),
    'bodies', (select jsonb_object_agg(ns.nspname || '.' || pr.proname, md5(pr.prosrc))
    from pg_proc pr join pg_namespace ns on ns.oid = pr.pronamespace
    where ns.nspname = 'social' or (ns.nspname = 'public' and (pr.proname like 'social\_%' or pr.proname like 'admin\_social\_%')) or (ns.nspname = 'staff' and pr.proname like 'social\_%')));
end $t$;
