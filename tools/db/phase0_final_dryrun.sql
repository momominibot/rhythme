do $$
declare u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); o1 uuid := gen_random_uuid(); r jsonb; ov jsonb; c1 jsonb; c2 jsonb; c3 jsonb; out jsonb := '{}'::jsonb; e text; pol jsonb; base integer;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at, instance_id, encrypted_password, raw_app_meta_data, raw_user_meta_data, is_sso_user)
    select x, 'dryrun-' || x || '@example.invalid', 'authenticated', 'authenticated', now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '{}'::jsonb, '{}'::jsonb, false from unnest(array[u1, u2, o1]) x;
  insert into public.consent_events (user_id, purpose, action, notice_version, method) values (u1, 'age_18', 'grant', 5, 'sheet'), (u1, 'cloud_sync', 'grant', 5, 'sheet');
  insert into staff.admin_accounts (user_id, email, role) values (o1, 'dryrun-owner@example.invalid', 'owner');
  out := out || jsonb_build_object('setter_args', (select pronargs from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'analysis_consent_set'),
    'notices', (select jsonb_object_agg(version, accepted) from staff.notice_registry where purpose = 'improve_logging'), 'metric_version', staff.metric_version(),
    'overview_one_statement', (select pg_get_functiondef('public.admin_overview()'::regprocedure) like '%with v as%'));
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true); set local role authenticated;
  begin c1 := public.analysis_consent_set(true, 3, '30-34', 'from_now', null, null, 'dry-r0', false); out := out || '{"v3":"accepted (wrong)"}'; exception when others then out := out || jsonb_build_object('v3', left(sqlerrm, 60)); end;
  c1 := public.analysis_consent_set(true, 5, '30-34', 'from_now', null, null, 'dry-r1', false);
  c2 := public.analysis_consent_set(true, 5, '30-34', 'from_now', null, null, 'dry-r1', false);
  begin c3 := public.analysis_consent_set(false, null, null, 'from_now', null, null, 'dry-r1', false); out := out || '{"reused_id":"accepted (wrong)"}'; exception when others then out := out || jsonb_build_object('reused_id', left(sqlerrm, 60)); end;
  begin c3 := public.analysis_consent_set(true, 5, '30-34', 'from_now', null, null, 'dry-r2', true); out := out || '{"expect_none":"accepted (wrong)"}'; exception when others then out := out || jsonb_build_object('expect_none', sqlstate); end;
  reset role;
  out := out || jsonb_build_object('v5_ok', c1 -> 'notice_version', 'replayed', c2 -> 'replayed');
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true); set local role authenticated;
  c3 := public.analysis_consent_set(false, null, null, 'from_now', null, null, 'dry-first-refusal', true);
  reset role;
  out := out || jsonb_build_object('first_refusal_row', (select withdrawn_at is not null from public.analysis_consent where user_id = u2));
  perform set_config('request.jwt.claims', json_build_object('sub', o1, 'role', 'authenticated')::text, true); set local role authenticated;
  r := public.admin_run(28); ov := public.admin_overview(); base := (ov ->> 'floor')::integer;
  out := out || jsonb_build_object('run_ok', r -> 'ok', 'latest_is_run', ov ->> 'latest_run' = r ->> 'run_id', 'floor', base, 'scheduled', ov -> 'scheduled');
  pol := public.admin_policy_set('k_floor', '20.5'::jsonb); out := out || jsonb_build_object('fraction', pol ->> 'error');
  pol := public.admin_policy_set('k_floor', to_jsonb(base + 10)); ov := public.admin_overview();
  out := out || jsonb_build_object('raise_ok', pol -> 'ok', 'held_after_raise', ov -> 'held_runs', 'latest_after_raise', ov -> 'latest_run');
  pol := public.admin_policy_set('k_floor', to_jsonb(base));
  reset role;
  out := out || jsonb_build_object('stored_floor', (select value::text from staff.agent_policy where key = 'k_floor'));
  raise exception 'RESULT %', out::text;
end $$;
