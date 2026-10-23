-- Rhythme staff team on refresh (23 Oct 2026). Design: docs/design/2026-10-23-review-worker-on-refresh.md; review:
-- docs/design/reviews/2026-10-23-review-worker-design-review.md. A refresh runs the deterministic report and, only when
-- both switches are on, queues one review for a worker on Jamie's Mac that runs each agent through codex exec on that
-- run's released aggregates. This migration calls no model and turns nothing on: review_on and review_transfer_cleared
-- both start false, and review_transfer_cleared has no setter here (it is set by a separate approved statement after the
-- legal read accepts the provider route). The worker key's hash is inserted separately, never in this file.
--
-- Additive and reversible: new tables and functions; admin_proposals, admin_decide, admin_policy_set, admin_block_clear
-- and staff.prune are replaced from their earlier definitions (team_dashboard, staff_data_contract_v3).

-- ---------- 1. policy ----------
insert into staff.agent_policy (key, value) values
  ('review_on', 'false'::jsonb),
  ('review_transfer_cleared', 'false'::jsonb),
  ('review_kinds', '["prompt_copy", "reminder_timing", "surface_order", "measurement_gap"]'::jsonb),
  ('review_targets', '["calendar_tap", "symptom_chips", "period_question", "bed_tap", "sleep_import", "food_tab_mode", "portion_prompt", "meal_tags", "mat_first_practice", "bench_order", "reminder_time", "metric_registry"]'::jsonb)
on conflict (key) do nothing;

-- ---------- 2. tables ----------
create table if not exists staff.worker_keys (
  id bigserial primary key,
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  label text not null default '',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
-- a bad key is counted per minute, so a flood of public requests cannot write a row each
create table if not exists staff.worker_denials (
  minute timestamptz primary key,
  n integer not null default 0
);
create table if not exists staff.review_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references staff.agent_runs (id) on delete cascade,
  requested_by uuid,
  requested_at timestamptz not null default now(),
  state text not null default 'queued' check (state in ('queued', 'claimed', 'done', 'blocked', 'dropped', 'expired', 'superseded')),
  code text check (code is null or code ~ '^[a-z_]{1,40}$'),
  claim_token uuid,
  key_id bigint references staff.worker_keys (id),
  claimed_at timestamptz,
  lease_until timestamptz,
  deadline timestamptz,
  finished_at timestamptz
);
create unique index if not exists review_jobs_one_open on staff.review_jobs ((true)) where state in ('queued', 'claimed');
create index if not exists review_jobs_requested on staff.review_jobs (requested_at desc);
create table if not exists staff.review_stages (
  job_id uuid not null references staff.review_jobs (id) on delete cascade,
  agent text not null check (agent in ('cycle', 'sleep', 'food', 'mind', 'orchestrator')),
  seq integer not null,
  state text not null check (state in ('admitted', 'accepted')),
  admitted_at timestamptz not null default now(),
  accepted_at timestamptz,
  input_hash text not null,
  report jsonb,
  report_hash text,
  provenance jsonb not null default '{}'::jsonb,
  primary key (job_id, agent)
);
create table if not exists staff.worker_heartbeats (
  agent text primary key check (agent in ('worker', 'cycle', 'sleep', 'food', 'mind', 'orchestrator')),
  job_id uuid references staff.review_jobs (id) on delete set null,
  state text not null check (state in ('claimed', 'reading', 'posted', 'done', 'stopped')),
  at timestamptz not null default now()
);
create table if not exists staff.refresh_receipts (
  user_id uuid not null,
  request_id text not null,
  at timestamptz not null default now(),
  answer jsonb not null,
  primary key (user_id, request_id)
);
alter table staff.agent_proposals add column if not exists job_id uuid references staff.review_jobs (id) on delete cascade;
alter table staff.agent_proposals add column if not exists ref text;
create unique index if not exists agent_proposals_job_ref on staff.agent_proposals (job_id, ref) where job_id is not null;
alter table staff.provider_blocks add column if not exists code text;
alter table staff.provider_blocks add column if not exists job_id uuid references staff.review_jobs (id) on delete set null;
create unique index if not exists provider_blocks_one_per_job on staff.provider_blocks (job_id) where job_id is not null;

grant select, insert, update, delete on staff.worker_keys, staff.worker_denials, staff.review_jobs, staff.review_stages,
  staff.worker_heartbeats, staff.refresh_receipts to rhythme_staff_fn;
grant usage, select on sequence staff.worker_keys_id_seq to rhythme_staff_fn;
revoke all on staff.worker_keys, staff.worker_denials, staff.review_jobs, staff.review_stages, staff.worker_heartbeats,
  staff.refresh_receipts from public, anon, authenticated;

-- ---------- 3. helpers ----------
create or replace function staff.worker_key(p_key text) returns bigint language plpgsql security definer set search_path = '' as $$
declare kid bigint;
begin
  if p_key is not null and length(p_key) between 32 and 128 then
    select id into kid from staff.worker_keys where key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex') and revoked_at is null;
  end if;
  if kid is null then
    insert into staff.worker_denials (minute, n) values (date_trunc('minute', now()), 1)
      on conflict (minute) do update set n = staff.worker_denials.n + 1;
  end if;
  return kid;
end $$;

-- the reasons a review may not run now, as fixed codes; null means it may
create or replace function staff.review_why_not(p_run uuid) returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce((staff.policy('review_on'))::text, 'false') <> 'true' then return 'review_off'; end if;
  if coalesce((staff.policy('review_transfer_cleared'))::text, 'false') <> 'true' then return 'transfer_not_cleared'; end if;
  if exists (select 1 from staff.provider_blocks where cleared_at is null) then return 'blocked'; end if;
  if not exists (select 1 from staff.agent_runs where id = p_run and status = 'ok' and invalidated_at is null) then return 'run_held'; end if;
  return null;
end $$;

-- a run worth a model call has at least one measured finding beyond the eligibility count
create or replace function staff.review_worth(p_run uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from staff.agent_findings where run_id = p_run and state = 'measured' and metric <> 'eligible_people')
$$;

-- stale jobs end on their own: queued ones after 10 minutes unclaimed, claimed ones when the lease or deadline passes
create or replace function staff.review_expire() returns void language sql security definer set search_path = '' as $$
  update staff.review_jobs set state = 'expired', code = 'queue_expired', finished_at = now() where state = 'queued' and requested_at < now() - interval '10 minutes';
  update staff.review_jobs set state = 'dropped', code = 'lease_lost', finished_at = now() where state = 'claimed' and (lease_until < now() or deadline < now());
$$;

-- the claimed job a worker names, or null; never extends anything
create or replace function staff.review_claimed(p_kid bigint, p_job uuid, p_token uuid) returns staff.review_jobs language sql stable security definer set search_path = '' as $$
  select * from staff.review_jobs where id = p_job and claim_token = p_token and key_id = p_kid
$$;

create or replace function staff.review_order() returns text[] language sql immutable set search_path = '' as $$
  select array['cycle', 'sleep', 'food', 'mind', 'orchestrator']
$$;

-- ---------- 4. staff RPCs ----------
create or replace function public.admin_refresh(p_days integer default 28, p_request_id text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; uid uuid := staff.caller(); rid text := nullif(left(coalesce(p_request_id, ''), 64), ''); prior jsonb; run_id uuid; r jsonb; why text; j staff.review_jobs; review jsonb; answer jsonb;
begin
  d := staff.require('admin_refresh', jsonb_build_object('days', p_days, 'request', rid)); if d is not null then return d; end if;
  if rid is null then return jsonb_build_object('error', 'A refresh needs a request id.'); end if;
  select rr.answer into prior from staff.refresh_receipts rr where rr.user_id = uid and rr.request_id = rid;
  if found then return prior || jsonb_build_object('replayed', true); end if;
  run_id := staff.run_begin('run_now', 'staff', uid); /* takes the worker lock for the rest of this transaction */
  if run_id is null then
    answer := jsonb_build_object('error', 'A run is already going. Give it a minute.');
  else
    r := staff.run_core(run_id, p_days);
    perform staff.review_expire();
    if coalesce(r ->> 'ok', '') <> 'true' then
      review := jsonb_build_object('state', 'not_queued', 'code', 'run_failed');
    else
      why := staff.review_why_not(run_id);
      if why is null and not staff.review_worth(run_id) then why := 'nothing_to_review'; end if;
      if why is not null then
        review := jsonb_build_object('state', 'not_queued', 'code', why);
      else
        select * into j from staff.review_jobs where state in ('queued', 'claimed') for update;
        if found and j.state = 'claimed' then
          review := jsonb_build_object('state', 'busy', 'job', j.id, 'run', j.run_id);
        else
          if found then update staff.review_jobs set state = 'superseded', code = 'superseded', finished_at = now() where id = j.id; end if;
          insert into staff.review_jobs (run_id, requested_by) values (run_id, uid) returning * into j;
          perform staff.event(run_id, 'orchestrator', 'review', 'orchestrator: review queued for the team', jsonb_build_object('job', j.id, 'state', 'queued'));
          review := jsonb_build_object('state', 'queued', 'job', j.id, 'run', run_id);
        end if;
      end if;
    end if;
    answer := r || jsonb_build_object('review', review);
  end if;
  insert into staff.refresh_receipts (user_id, request_id, answer) values (uid, rid, answer);
  return answer;
end $$;

create or replace function public.admin_review_status() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; o staff.review_jobs; l staff.review_jobs; latest uuid;
begin
  d := staff.require('admin_review_status', '{}'::jsonb); if d is not null then return d; end if;
  perform staff.review_expire();
  select * into o from staff.review_jobs where state in ('queued', 'claimed');
  select * into l from staff.review_jobs where state not in ('queued', 'claimed') order by coalesce(finished_at, requested_at) desc limit 1;
  select id into latest from staff.agent_runs where status = 'ok' and invalidated_at is null order by started_at desc limit 1;
  return jsonb_build_object(
    'review_on', coalesce((staff.policy('review_on'))::text, 'false') = 'true',
    'transfer_cleared', coalesce((staff.policy('review_transfer_cleared'))::text, 'false') = 'true',
    'block', (select jsonb_build_object('id', id, 'at', at, 'code', coalesce(code, 'provider_error')) from staff.provider_blocks where cleared_at is null order by id desc limit 1),
    'open', case when o.id is null then null else jsonb_build_object('id', o.id, 'state', o.state, 'run', o.run_id, 'requested_at', o.requested_at, 'claimed_at', o.claimed_at,
      'stages', (select coalesce(jsonb_agg(jsonb_build_object('agent', agent, 'state', state) order by seq), '[]'::jsonb) from staff.review_stages where job_id = o.id),
      'heartbeats', (select coalesce(jsonb_agg(jsonb_build_object('agent', agent, 'state', state, 'age_s', round(extract(epoch from (now() - at)))::integer)), '[]'::jsonb) from staff.worker_heartbeats where job_id = o.id)) end,
    'last', case when l.id is null then null else jsonb_build_object('id', l.id, 'state', l.state, 'code', l.code, 'run', l.run_id, 'finished_at', l.finished_at,
      'run_held', not exists (select 1 from staff.agent_runs where id = l.run_id and status = 'ok' and invalidated_at is null)) end,
    'latest_run', latest);
end $$;

-- proposals: a held run keeps its proposals' kind, target and status, but their change and rationale are withheld
create or replace function public.admin_proposals(p_status text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_proposals', jsonb_build_object('status', p_status)); if d is not null then return d; end if;
  return (select coalesce(jsonb_agg(to_jsonb(p) order by p.id desc), '[]'::jsonb) from (
    select pr.id, pr.at, pr.run_id, pr.job_id, pr.ref, pr.agent, pr.kind, pr.target, pr.metric, pr.priority, pr.requires_human, pr.status, pr.decided_by, pr.decided_at, pr.note,
      (r.invalidated_at is not null or r.status is distinct from 'ok') as held,
      case when r.invalidated_at is null and r.status = 'ok' then pr.change else null end as change,
      case when r.invalidated_at is null and r.status = 'ok' then pr.rationale else '(held: the run behind this proposal was withdrawn)' end as rationale
    from staff.agent_proposals pr left join staff.agent_runs r on r.id = pr.run_id
    where p_status is null or pr.status = p_status order by pr.id desc limit 300) p);
end $$;

-- a decision waits for any report or hold in flight, refuses evidence that was held, and moves only open or held proposals
create or replace function public.admin_decide(p_id bigint, p_decision text, p_note text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; p staff.agent_proposals%rowtype; uid uuid := staff.caller();
begin
  d := staff.require('admin_decide', jsonb_build_object('id', p_id, 'decision', p_decision), true); if d is not null then return d; end if;
  if p_decision not in ('approve', 'hold', 'reject') then return jsonb_build_object('error', 'decision must be approve, hold or reject'); end if;
  perform pg_advisory_xact_lock(hashtext('staff.run_begin'));
  select * into p from staff.agent_proposals where id = p_id for update;
  if not found then return jsonb_build_object('error', 'no such proposal'); end if;
  if p.status not in ('open', 'held') then return jsonb_build_object('error', 'That proposal was already decided.'); end if;
  if p.run_id is not null and not exists (select 1 from staff.agent_runs where id = p.run_id and status = 'ok' and invalidated_at is null) and p_decision = 'approve' then
    return jsonb_build_object('error', 'The run behind this proposal was withdrawn, so it cannot be approved.');
  end if;
  update staff.agent_proposals set status = case p_decision when 'approve' then 'approved' when 'hold' then 'held' else 'rejected' end, decided_by = uid, decided_at = now(), note = left(coalesce(p_note, ''), 400) where id = p_id;
  perform staff.event(p.run_id, 'staff', 'decision', 'staff ' || p_decision || 'd proposal #' || p_id || ' (' || p.kind || ' on ' || p.target || ')', jsonb_build_object('proposal', p_id, 'decision', p_decision));
  return jsonb_build_object('ok', true);
end $$;

-- the phase 0 setter plus review_on (owner only, a boolean); review_transfer_cleared is deliberately not settable here
create or replace function public.admin_policy_set(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; uid uuid := staff.caller(); old_floor numeric;
begin
  d := staff.require('admin_policy_set', jsonb_build_object('key', p_key, 'value', p_value), true); if d is not null then return d; end if;
  if p_key not in ('k_floor', 'lever_days', 'model_on', 'autonomy_on', 'review_on') then return jsonb_build_object('error', 'that setting is not changeable here'); end if;
  if p_key = 'k_floor' and (jsonb_typeof(p_value) <> 'number' or (p_value::text) !~ '^[0-9]{2,4}$' or (p_value::text)::integer not between 20 and 1000) then return jsonb_build_object('error', 'the floor is a whole number of people from 20 to 1000'); end if;
  if p_key = 'lever_days' and (jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 1 or (p_value::text)::numeric > 30) then return jsonb_build_object('error', 'lever days must be between 1 and 30'); end if;
  if p_key in ('model_on', 'autonomy_on', 'review_on') and jsonb_typeof(p_value) <> 'boolean' then return jsonb_build_object('error', 'that setting is on or off'); end if;
  if p_key in ('k_floor', 'review_on') then
    perform pg_advisory_xact_lock(hashtext('staff.run_begin')); /* the worker lock first, so no report or review stage is admitted under the old setting after this */
  end if;
  if p_key = 'k_floor' then
    select case when value::text ~ '^[0-9]+$' then (value::text)::numeric end into old_floor from staff.agent_policy where key = 'k_floor'; /* read raw, so a malformed stored value can still be corrected here */
    p_value := to_jsonb((p_value::text)::integer); /* stored in its canonical whole-number form */
  end if;
  insert into staff.agent_policy (key, value, updated_at, updated_by) values (p_key, p_value, now(), uid)
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  perform staff.event(null, 'staff', 'policy', 'staff set ' || p_key || ' to ' || p_value::text, jsonb_build_object('key', p_key, 'value', p_value));
  if p_key = 'k_floor' and (old_floor is null or (p_value::text)::numeric > old_floor) then /* an unreadable old floor counts as raised: hold rather than guess */
    perform staff.invalidate_runs('people floor raised to ' || (p_value::text) || '; the next run recomputes under it');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- clearing a block is one owner action on one block; the worker sees that block's id cleared and may run again
create or replace function public.admin_block_clear(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; uid uuid := staff.caller();
begin
  d := staff.require('admin_block_clear', jsonb_build_object('id', p_id), true); if d is not null then return d; end if;
  perform pg_advisory_xact_lock(hashtext('staff.run_begin'));
  update staff.provider_blocks set cleared_at = now(), cleared_by = uid where id = p_id and cleared_at is null;
  if not found then return jsonb_build_object('error', 'That block is already cleared or does not exist.'); end if;
  perform staff.event(null, 'staff', 'block', 'staff cleared provider block #' || p_id || '; one review may be tried on the next refresh', jsonb_build_object('id', p_id));
  return jsonb_build_object('ok', true);
end $$;

create or replace function staff.prune(p_days integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a integer; e integer; j integer; r integer;
begin
  delete from staff.admin_audit where at < now() - make_interval(days => greatest(coalesce(p_days, 365), 90)); get diagnostics a = row_count;
  delete from staff.agent_events where at < now() - interval '365 days'; get diagnostics e = row_count;
  delete from staff.review_jobs where state not in ('queued', 'claimed') and requested_at < now() - interval '90 days'; get diagnostics j = row_count;
  delete from staff.refresh_receipts where at < now() - interval '30 days'; get diagnostics r = row_count;
  delete from staff.worker_denials where minute < now() - interval '30 days';
  return jsonb_build_object('audit_removed', a, 'events_removed', e, 'review_jobs_removed', j, 'receipts_removed', r);
end $$;

-- ---------- 5. worker RPCs (anon with the worker key; every body checks the key first) ----------
-- one call per poll: with a local block id it only reports whether that block was cleared and claims nothing
create or replace function public.worker_claim(p_key text, p_local_block bigint default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare kid bigint := staff.worker_key(p_key); j staff.review_jobs; why text;
begin
  if kid is null then return jsonb_build_object('error', 'denied'); end if;
  if p_local_block is not null then
    return jsonb_build_object('local_block', p_local_block, 'cleared', exists (select 1 from staff.provider_blocks where id = p_local_block and cleared_at is not null));
  end if;
  perform pg_advisory_xact_lock(hashtext('staff.run_begin'));
  perform staff.review_expire();
  select * into j from staff.review_jobs where state = 'queued' order by requested_at limit 1 for update;
  if not found then return jsonb_build_object('job', null); end if;
  why := staff.review_why_not(j.run_id);
  if why is not null then
    update staff.review_jobs set state = 'dropped', code = why, finished_at = now() where id = j.id;
    return jsonb_build_object('job', null, 'dropped', why);
  end if;
  update staff.review_jobs set state = 'claimed', claim_token = gen_random_uuid(), key_id = kid, claimed_at = now(),
    lease_until = now() + interval '30 minutes', deadline = now() + interval '25 minutes' where id = j.id returning * into j;
  insert into staff.worker_heartbeats (agent, job_id, state, at) values ('worker', j.id, 'claimed', now())
    on conflict (agent) do update set job_id = excluded.job_id, state = excluded.state, at = excluded.at;
  return jsonb_build_object('job', j.id, 'token', j.claim_token, 'run', j.run_id, 'deadline', j.deadline, 'stages', to_jsonb(staff.review_order()));
end $$;

-- admission for one stage: every switch, block, key and the run checked now, under the worker lock; returns that stage's input only
create or replace function public.worker_stage_begin(p_key text, p_job uuid, p_token uuid, p_agent text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare kid bigint := staff.worker_key(p_key); j staff.review_jobs; why text; expected text; payload jsonb; s jsonb; n integer;
begin
  if kid is null then return jsonb_build_object('error', 'denied'); end if;
  perform pg_advisory_xact_lock(hashtext('staff.run_begin'));
  perform staff.review_expire();
  j := staff.review_claimed(kid, p_job, p_token);
  if j.id is null then return jsonb_build_object('error', 'no_such_claim'); end if;
  if j.state <> 'claimed' then return jsonb_build_object('stop', coalesce(j.code, j.state)); end if;
  why := staff.review_why_not(j.run_id);
  if why is not null then
    update staff.review_jobs set state = 'dropped', code = why, finished_at = now() where id = j.id;
    return jsonb_build_object('stop', why);
  end if;
  select a into expected from unnest(staff.review_order()) with ordinality as o(a, i)
    where not exists (select 1 from staff.review_stages st where st.job_id = j.id and st.agent = o.a and st.state = 'accepted') order by i limit 1;
  if expected is null or p_agent is distinct from expected then return jsonb_build_object('error', 'out_of_order', 'expected', expected); end if;
  if exists (select 1 from staff.review_stages where job_id = j.id and agent = p_agent) then
    return jsonb_build_object('error', 'already_admitted'); /* one attempt per stage: a second admission would be a second model call */
  end if;
  select summary into s from staff.agent_runs where id = j.run_id;
  if p_agent = 'orchestrator' then
    payload := jsonb_build_object('reports', (select coalesce(jsonb_object_agg(agent, report), '{}'::jsonb) from staff.review_stages where job_id = j.id and state = 'accepted'),
      'proposals', (select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'agent', agent, 'kind', kind, 'target', target, 'metric', metric) order by ref), '[]'::jsonb) from staff.agent_proposals where job_id = j.id));
  else
    payload := jsonb_build_object(
      'floor', s -> 'floor', 'report_tz', s -> 'report_tz', 'window_start', s -> 'window_start', 'window_end_exclusive', s -> 'window_end_exclusive', 'metric_version', s -> 'metric_version',
      'findings', (select coalesce(jsonb_agg(jsonb_build_object('metric', f.metric, 'window', f."window", 'value', f.value, 'people', f.people, 'suppressed', f.suppressed, 'state', f.state) order by f.metric), '[]'::jsonb)
        from staff.agent_findings f where f.run_id = j.run_id and f.agent = p_agent),
      'registry', (select coalesce(jsonb_agg(jsonb_build_object('metric', m.metric, 'unit', m.unit, 'denominator', m.denominator, 'people_rule', m.people_rule, 'window_rule', m.window_rule, 'computation_version', m.computation_version, 'note', m.note) order by m.metric), '[]'::jsonb)
        from staff.metric_registry m where m.agent = p_agent or m.metric = 'eligible_people'),
      'kinds', staff.policy('review_kinds'), 'targets', staff.policy('review_targets'));
  end if;
  select count(*) into n from staff.review_stages where job_id = j.id;
  insert into staff.review_stages (job_id, agent, seq, state, input_hash) values (j.id, p_agent, n + 1, 'admitted', md5(payload::text));
  update staff.review_jobs set lease_until = least(now() + interval '30 minutes', deadline + interval '5 minutes') where id = j.id;
  insert into staff.worker_heartbeats (agent, job_id, state, at) values (p_agent, j.id, 'reading', now())
    on conflict (agent) do update set job_id = excluded.job_id, state = excluded.state, at = excluded.at;
  return jsonb_build_object('agent', p_agent, 'run', j.run_id, 'payload', payload, 'input_hash', md5(payload::text));
end $$;

create or replace function public.worker_beat(p_key text, p_job uuid, p_token uuid, p_agent text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare kid bigint := staff.worker_key(p_key); j staff.review_jobs;
begin
  if kid is null then return jsonb_build_object('error', 'denied'); end if;
  if p_agent not in ('worker', 'cycle', 'sleep', 'food', 'mind', 'orchestrator') then return jsonb_build_object('error', 'bad_agent'); end if;
  j := staff.review_claimed(kid, p_job, p_token);
  if j.id is null then return jsonb_build_object('error', 'no_such_claim'); end if;
  if j.state <> 'claimed' then return jsonb_build_object('stop', coalesce(j.code, j.state)); end if;
  if j.lease_until < now() or j.deadline < now() then return jsonb_build_object('stop', 'lease_lost'); end if; /* the next locked call drops it */
  update staff.review_jobs set lease_until = least(now() + interval '30 minutes', deadline + interval '5 minutes') where id = j.id;
  update staff.worker_heartbeats set at = now() where agent in ('worker', p_agent) and job_id = j.id;
  return jsonb_build_object('ok', true);
end $$;

-- the report contract, checked on the server whatever the worker checked
create or replace function staff.review_report_error(p_agent text, p_report jsonb) returns text language plpgsql stable security definer set search_path = '' as $$
declare p jsonb; k text; kinds jsonb := staff.policy('review_kinds'); targets jsonb := staff.policy('review_targets'); n integer := 0;
begin
  if jsonb_typeof(p_report) <> 'object' then return 'not_object'; end if;
  for k in select jsonb_object_keys(p_report) loop
    if k not in ('summary', 'notes', 'proposals', 'ranking') or (k = 'ranking' and p_agent <> 'orchestrator') then return 'unknown_key'; end if;
  end loop;
  if jsonb_typeof(p_report -> 'summary') <> 'string' or length(p_report ->> 'summary') not between 1 and 400 then return 'summary'; end if;
  if jsonb_typeof(p_report -> 'notes') <> 'array' or jsonb_array_length(p_report -> 'notes') > 5 then return 'notes'; end if;
  if exists (select 1 from jsonb_array_elements(p_report -> 'notes') x where jsonb_typeof(x) <> 'string' or length(x #>> '{}') > 200) then return 'notes'; end if;
  if jsonb_typeof(p_report -> 'proposals') <> 'array' or jsonb_array_length(p_report -> 'proposals') > 3 then return 'proposals'; end if;
  if p_agent = 'orchestrator' and jsonb_array_length(p_report -> 'proposals') > 0 then return 'orchestrator_proposes'; end if;
  for p in select * from jsonb_array_elements(p_report -> 'proposals') loop
    n := n + 1;
    if jsonb_typeof(p) <> 'object' then return 'proposal_shape'; end if;
    if (select count(*) from jsonb_object_keys(p)) <> 5 or not (p ?& array['kind', 'target', 'metric', 'change', 'rationale']) then return 'proposal_keys'; end if;
    if jsonb_typeof(p -> 'kind') <> 'string' or not (kinds ? (p ->> 'kind')) then return 'proposal_kind'; end if;
    if jsonb_typeof(p -> 'target') <> 'string' or not (targets ? (p ->> 'target')) then return 'proposal_target'; end if;
    if jsonb_typeof(p -> 'metric') <> 'null' and (jsonb_typeof(p -> 'metric') <> 'string'
       or not exists (select 1 from staff.metric_registry m where m.metric = p ->> 'metric' and (m.agent = p_agent or m.metric = 'eligible_people'))) then return 'proposal_metric'; end if;
    if jsonb_typeof(p -> 'change') <> 'object' or octet_length((p -> 'change')::text) > 1024 or jsonb_path_exists(p -> 'change', 'strict $.*.*.*', '{}', true) then return 'proposal_change'; end if;
    if jsonb_typeof(p -> 'rationale') <> 'string' or length(p ->> 'rationale') not between 1 and 300 then return 'proposal_rationale'; end if;
  end loop;
  if p_agent = 'orchestrator' then
    if jsonb_typeof(p_report -> 'ranking') <> 'array' then return 'ranking'; end if;
    if exists (select 1 from jsonb_array_elements(p_report -> 'ranking') x where jsonb_typeof(x) <> 'string') then return 'ranking'; end if;
    if (select count(*) from jsonb_array_elements_text(p_report -> 'ranking')) <> (select count(distinct x) from jsonb_array_elements_text(p_report -> 'ranking') x) then return 'ranking_duplicate'; end if;
  end if;
  return null;
end $$;

create or replace function public.worker_post(p_key text, p_job uuid, p_token uuid, p_agent text, p_report jsonb, p_provenance jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare kid bigint := staff.worker_key(p_key); j staff.review_jobs; st staff.review_stages; why text; err text; h text; p jsonb; i integer := 0; refs jsonb := '[]'::jsonb; v_ref text; prov jsonb; x text; pos integer := 0;
begin
  if kid is null then return jsonb_build_object('error', 'denied'); end if;
  perform pg_advisory_xact_lock(hashtext('staff.run_begin'));
  perform staff.review_expire();
  j := staff.review_claimed(kid, p_job, p_token);
  if j.id is null then return jsonb_build_object('error', 'no_such_claim'); end if;
  select * into st from staff.review_stages where job_id = j.id and agent = p_agent;
  if not found then return jsonb_build_object('error', 'not_admitted'); end if;
  h := md5(coalesce(p_report, 'null'::jsonb)::text);
  if st.state = 'accepted' then
    if st.report_hash = h then
      return jsonb_build_object('ok', true, 'replayed', true, 'refs', (select coalesce(jsonb_agg(ap.ref order by ap.ref), '[]'::jsonb) from staff.agent_proposals ap where ap.job_id = j.id and ap.agent = p_agent));
    end if;
    return jsonb_build_object('error', 'report_differs');
  end if;
  if j.state <> 'claimed' then return jsonb_build_object('stop', coalesce(j.code, j.state)); end if;
  why := staff.review_why_not(j.run_id);
  if why is not null then
    update staff.review_jobs set state = 'dropped', code = why, finished_at = now() where id = j.id;
    return jsonb_build_object('stop', why);
  end if;
  err := staff.review_report_error(p_agent, p_report);
  if err is not null then return jsonb_build_object('error', 'bad_report', 'why', err); end if;
  if p_agent = 'orchestrator' then
    for x in select * from jsonb_array_elements_text(p_report -> 'ranking') loop
      if not exists (select 1 from staff.agent_proposals ap where ap.job_id = j.id and ap.ref = x) then return jsonb_build_object('error', 'bad_report', 'why', 'ranking_ref'); end if;
    end loop;
  end if;
  for p in select * from jsonb_array_elements(p_report -> 'proposals') loop
    i := i + 1; v_ref := p_agent || '-' || i;
    insert into staff.agent_proposals (run_id, job_id, ref, agent, kind, target, metric, change, rationale, priority, requires_human, status)
      values (j.run_id, j.id, v_ref, p_agent, p ->> 'kind', p ->> 'target', p ->> 'metric', p -> 'change', p ->> 'rationale', 0, true, 'open');
    refs := refs || to_jsonb(v_ref);
  end loop;
  if p_agent = 'orchestrator' then
    for x in select * from jsonb_array_elements_text(p_report -> 'ranking') loop
      pos := pos + 1;
      update staff.agent_proposals ap set priority = 100 - pos where ap.job_id = j.id and ap.ref = x;
    end loop;
  end if;
  prov := (select coalesce(jsonb_object_agg(key, left(value #>> '{}', 40)), '{}'::jsonb) from jsonb_each(coalesce(p_provenance, '{}'::jsonb))
    where key in ('cli', 'model', 'prompt_v', 'schema_v', 'output_hash') and jsonb_typeof(value) = 'string');
  update staff.review_stages set state = 'accepted', accepted_at = now(), report = p_report, report_hash = h, provenance = prov where job_id = j.id and agent = p_agent;
  perform staff.event(j.run_id, p_agent, 'review', p_agent || ': ' || left(p_report ->> 'summary', 280),
    jsonb_build_object('job', j.id, 'notes', p_report -> 'notes', 'refs', refs, 'ranking', p_report -> 'ranking'));
  update staff.worker_heartbeats set state = 'posted', at = now() where agent = p_agent and job_id = j.id;
  return jsonb_build_object('ok', true, 'refs', refs);
end $$;

-- a failure is recorded for the exact claim even after its lease or a drop, so the shared block always lands; idempotent
create or replace function public.worker_fail(p_key text, p_job uuid, p_token uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare kid bigint := staff.worker_key(p_key); j staff.review_jobs; b bigint;
begin
  if kid is null then return jsonb_build_object('error', 'denied'); end if;
  if p_code not in ('timeout', 'provider_limit', 'provider_error', 'bad_output', 'crash', 'uncertain', 'lease_lost', 'transport') then return jsonb_build_object('error', 'bad_code'); end if;
  perform pg_advisory_xact_lock(hashtext('staff.run_begin'));
  j := staff.review_claimed(kid, p_job, p_token);
  if j.id is null then return jsonb_build_object('error', 'no_such_claim'); end if;
  select id into b from staff.provider_blocks where job_id = j.id;
  if found then return jsonb_build_object('ok', true, 'block', b, 'replayed', true); end if;
  update staff.review_jobs set state = 'blocked', code = p_code, finished_at = coalesce(finished_at, now()) where id = j.id;
  insert into staff.provider_blocks (source, error, code, run_id, job_id) values ('codex-worker', p_code, p_code, j.run_id, j.id) returning id into b;
  update staff.worker_heartbeats set state = 'stopped', at = now() where job_id = j.id;
  perform staff.event(j.run_id, 'orchestrator', 'blocked', 'orchestrator: the review stopped (' || p_code || '); nothing runs again until an owner clears block #' || b, jsonb_build_object('job', j.id, 'block', b, 'code', p_code));
  return jsonb_build_object('ok', true, 'block', b);
end $$;

create or replace function public.worker_finish(p_key text, p_job uuid, p_token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare kid bigint := staff.worker_key(p_key); j staff.review_jobs;
begin
  if kid is null then return jsonb_build_object('error', 'denied'); end if;
  perform pg_advisory_xact_lock(hashtext('staff.run_begin'));
  j := staff.review_claimed(kid, p_job, p_token);
  if j.id is null then return jsonb_build_object('error', 'no_such_claim'); end if;
  if j.state = 'done' then return jsonb_build_object('ok', true, 'replayed', true); end if;
  if j.state <> 'claimed' then return jsonb_build_object('stop', coalesce(j.code, j.state)); end if;
  if (select count(*) from staff.review_stages where job_id = j.id and state = 'accepted') <> 5 then return jsonb_build_object('error', 'stages_missing'); end if;
  update staff.review_jobs set state = 'done', code = 'done', finished_at = now() where id = j.id;
  update staff.worker_heartbeats set state = 'done', at = now() where job_id = j.id;
  perform staff.event(j.run_id, 'orchestrator', 'review', 'orchestrator: the team review is done', jsonb_build_object('job', j.id, 'state', 'done'));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 6. ownership and grants ----------
do $$
declare f text;
begin
  foreach f in array array['staff.worker_key(text)', 'staff.review_why_not(uuid)', 'staff.review_worth(uuid)', 'staff.review_expire()',
    'staff.review_claimed(bigint, uuid, uuid)', 'staff.review_order()', 'staff.review_report_error(text, jsonb)', 'staff.prune(integer)'] loop
    execute 'alter function ' || f || ' owner to rhythme_staff_fn';
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['public.admin_refresh(integer, text)', 'public.admin_review_status()', 'public.admin_proposals(text)',
    'public.admin_decide(bigint, text, text)', 'public.admin_policy_set(text, jsonb)', 'public.admin_block_clear(bigint)'] loop
    execute 'alter function ' || f || ' owner to rhythme_staff_fn';
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
  foreach f in array array['public.worker_claim(text, bigint)', 'public.worker_stage_begin(text, uuid, uuid, text)', 'public.worker_beat(text, uuid, uuid, text)',
    'public.worker_post(text, uuid, uuid, text, jsonb, jsonb)', 'public.worker_fail(text, uuid, uuid, text)', 'public.worker_finish(text, uuid, uuid)'] loop
    execute 'alter function ' || f || ' owner to rhythme_staff_fn';
    execute 'revoke all on function ' || f || ' from public, authenticated';
    execute 'grant execute on function ' || f || ' to anon';
  end loop;
end $$;
-- Rollback: revoke the worker RPCs from anon and set review_on false; the tables can stay (they hold no diary data).
