-- Self-cancelling dry run of 20261023140000_staff_review_worker.sql on the live project: sent after the migration in one
-- batch (tools/db/dryrun.py), it ends by raising 'RESULT {...}', so the migration and everything below roll back.
-- Synthetic owner and worker key only; no diary rows are read or written, and no model is called.
do $$
declare o1 uuid := gen_random_uuid(); wkey text := 'dryrun-worker-key-' || md5(random()::text); out jsonb := '{}'::jsonb; r jsonb; run uuid; job uuid; c jsonb; s jsonb;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at, instance_id, encrypted_password, raw_app_meta_data, raw_user_meta_data, is_sso_user)
    values (o1, 'dryrun-' || o1 || '@example.invalid', 'authenticated', 'authenticated', now(), now(), now(), '00000000-0000-0000-0000-000000000000', '', '{}'::jsonb, '{}'::jsonb, false);
  insert into staff.admin_accounts (user_id, email, role) values (o1, 'dryrun-owner@example.invalid', 'owner');
  insert into staff.worker_keys (key_hash, label) values (encode(sha256(convert_to(wkey, 'UTF8')), 'hex'), 'dryrun');
  out := out || jsonb_build_object(
    'bodies', (select jsonb_object_agg(n.nspname || '.' || p.proname, md5(p.prosrc)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname, p.proname) in (('staff','worker_key'),('staff','review_why_not'),('staff','review_worth'),('staff','review_expire'),('staff','review_claimed'),('staff','review_order'),
        ('public','admin_refresh'),('public','admin_review_status'),('public','admin_proposals'),('public','admin_decide'),('public','admin_policy_set'),('public','admin_block_clear'),('staff','prune'),
        ('public','worker_claim'),('public','worker_stage_begin'),('public','worker_beat'),('staff','review_report_error'),('public','worker_post'),('public','worker_fail'),('public','worker_finish'))),
    'defaults', (select jsonb_object_agg(key, value) from staff.agent_policy where key in ('review_on', 'review_transfer_cleared')),
    'grants', jsonb_build_object(
      'anon_claim', has_function_privilege('anon', 'public.worker_claim(text, bigint)', 'execute'),
      'auth_claim', has_function_privilege('authenticated', 'public.worker_claim(text, bigint)', 'execute'),
      'anon_refresh', has_function_privilege('anon', 'public.admin_refresh(integer, text)', 'execute'),
      'auth_refresh', has_function_privilege('authenticated', 'public.admin_refresh(integer, text)', 'execute'),
      'anon_jobs_table', has_table_privilege('anon', 'staff.review_jobs', 'select'),
      'auth_keys_table', has_table_privilege('authenticated', 'staff.worker_keys', 'select'),
      'transfer_setter', (select count(*) from pg_proc where prosrc like '%review_transfer_cleared%' and proname like 'admin_%')));
  -- the owner refreshes: off, then on but not cleared, then a replay of the same request id
  perform set_config('request.jwt.claims', json_build_object('sub', o1, 'role', 'authenticated')::text, true); set local role authenticated;
  r := public.admin_refresh(28, 'dry-1'); out := out || jsonb_build_object('refresh_off', r -> 'review');
  s := public.admin_policy_set('review_on', 'true'::jsonb); out := out || jsonb_build_object('set_review_on', s -> 'ok');
  begin s := public.admin_policy_set('review_transfer_cleared', 'true'::jsonb); out := out || jsonb_build_object('set_cleared', coalesce(s ->> 'error', 'accepted (wrong)')); exception when others then out := out || jsonb_build_object('set_cleared', left(sqlerrm, 60)); end;
  r := public.admin_refresh(28, 'dry-2'); out := out || jsonb_build_object('refresh_not_cleared', r -> 'review');
  r := public.admin_refresh(28, 'dry-2'); out := out || jsonb_build_object('replayed', r -> 'replayed', 'replay_review', r -> 'review');
  reset role;
  -- the clearance only through SQL, as the separate approved step would
  update staff.agent_policy set value = 'true'::jsonb where key = 'review_transfer_cleared';
  set local role authenticated;
  r := public.admin_refresh(28, 'dry-3'); out := out || jsonb_build_object('refresh_cleared', r -> 'review'); run := (r ->> 'run_id')::uuid;
  reset role;
  -- a measured finding of its own so the queued path runs (no real numbers exist yet)
  insert into staff.agent_findings (run_id, agent, metric, "window", value, people, state) values (run, 'cycle', 'dryrun_metric', '28d', 1, 25, 'measured');
  out := out || jsonb_build_object('worth_with_finding', staff.review_worth(run), 'why_not_now', coalesce(staff.review_why_not(run), 'none'));
  insert into staff.review_jobs (run_id, requested_by) values (run, o1); /* the job admin_refresh would queue for this run */
  -- the worker, as the public anon role with its key
  set local role anon;
  c := public.worker_claim('wrong-key-wrong-key-wrong-key-wrong-key'); out := out || jsonb_build_object('claim_bad_key', c);
  c := public.worker_claim(wkey); out := out || jsonb_build_object('claim_has_job', c ? 'token', 'claim_run_matches', (c ->> 'run')::uuid = run); job := (c ->> 'job')::uuid;
  s := public.worker_stage_begin(wkey, job, (c ->> 'token')::uuid, 'sleep'); out := out || jsonb_build_object('stage_out_of_order', s);
  s := public.worker_stage_begin(wkey, job, (c ->> 'token')::uuid, 'cycle');
  out := out || jsonb_build_object('stage_keys', (select jsonb_agg(k order by k) from jsonb_object_keys(s -> 'payload') k), 'stage_findings', s -> 'payload' -> 'findings');
  s := public.worker_stage_begin(wkey, job, (c ->> 'token')::uuid, 'cycle'); out := out || jsonb_build_object('stage_again', s);
  s := public.worker_beat(wkey, job, (c ->> 'token')::uuid, 'cycle'); out := out || jsonb_build_object('beat', s);
  s := public.worker_fail(wkey, job, (c ->> 'token')::uuid, 'provider_limit'); out := out || jsonb_build_object('fail_blocks', s ? 'block');
  c := public.worker_claim(wkey); out := out || jsonb_build_object('claim_after_block', c);
  begin perform count(*) from staff.review_jobs; out := out || '{"anon_reads_jobs":"yes (wrong)"}'; exception when others then out := out || jsonb_build_object('anon_reads_jobs', sqlstate); end;
  reset role;
  set local role authenticated;
  s := public.admin_review_status(); out := out || jsonb_build_object('status_block', s -> 'block', 'status_open', s -> 'open');
  r := public.admin_refresh(28, 'dry-5'); out := out || jsonb_build_object('refresh_blocked', r -> 'review');
  reset role;
  out := out || jsonb_build_object('denials_counted', (select coalesce(sum(n), 0) from staff.worker_denials where minute >= date_trunc('minute', now()) - interval '1 minute'));
  raise exception 'RESULT %', out::text;
end $$;
