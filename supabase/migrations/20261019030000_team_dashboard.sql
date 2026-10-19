-- Rhythme staff dashboard and the agent team, phase 1 (19 Oct 2026).
-- Design and review record: docs/design/2026-10-19-data-capture-dashboard-agents.md
--
-- Shape, after the Codex review:
--  * schema `staff` holds every staff and agent table; PostgREST never exposes it, so the only way in is a public RPC.
--  * the public RPCs are owned by a dedicated NOLOGIN role, rhythme_staff_fn, which can read and write the staff
--    tables and nothing else: by construction a staff function cannot read a diary row even through a bug.
--  * the one function that reads diary tables, staff.metrics_build, is owned by postgres, runs fixed queries over
--    accounts that recorded the separate "help improve logging" consent (public.analysis_consent), adult age bands
--    only, within the history scope each person accepted, and writes only aggregates with a 20-person floor.
--  * staff membership is by auth user id (never by email claim); owner and analyst are distinct; the last owner
--    cannot be removed; every call is audited, and a denial is audited without raising so the row commits.
--  * no model call, no public nudge, no autonomous lever and no cron in phase 1: those come with the consent switch.

-- ---------- schema and the staff role ----------
create schema if not exists staff;
revoke all on schema staff from public;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'rhythme_staff_fn') then create role rhythme_staff_fn nologin; end if;
end $$;
grant rhythme_staff_fn to postgres;
grant usage, create on schema staff to rhythme_staff_fn;
grant create on schema public to rhythme_staff_fn;

-- ---------- tables ----------
create table if not exists staff.admin_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'analyst')),
  added_by uuid,
  added_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  note text not null default ''
);
create table if not exists staff.admin_audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid,
  role text,
  rpc text not null,
  decision text not null check (decision in ('ok', 'denied', 'error')),
  detail jsonb not null default '{}'::jsonb
);
create index if not exists admin_audit_at on staff.admin_audit (at desc);
create table if not exists staff.agent_policy (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into staff.agent_policy (key, value) values
  ('k_floor', '20'),              -- buckets under this many people are held back; a disclosure control, not anonymity
  ('autonomy_on', 'false'),       -- phase 1: the orchestrator records and ranks, it applies nothing
  ('autonomous_kinds', '[]'),     -- the only kinds it may ever apply on its own (approved content ids on non-clinical surfaces)
  ('model_on', 'false'),          -- phase 1 has no model step
  ('lever_days', '14'),
  ('adult_bands', '["18-24","25-29","30-34","35-39","40-44","45-49","50+"]'),
  ('policy_version', '1')
on conflict (key) do nothing;
create table if not exists staff.provider_blocks (
  id bigserial primary key,
  at timestamptz not null default now(),
  source text not null,
  error text not null,
  run_id uuid,
  cleared_at timestamptz,
  cleared_by uuid
);
create table if not exists staff.agent_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pulse', 'review', 'run_now')),
  trigger text not null default 'staff',
  actor uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'blocked', 'failed')),
  error text,
  summary jsonb not null default '{}'::jsonb
);
create index if not exists agent_runs_started on staff.agent_runs (started_at desc);
create table if not exists staff.agent_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  run_id uuid references staff.agent_runs (id) on delete cascade,
  agent text not null,
  kind text not null,
  title text not null,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists agent_events_id on staff.agent_events (id desc);
create table if not exists staff.agent_findings (
  id bigserial primary key,
  at timestamptz not null default now(),
  run_id uuid references staff.agent_runs (id) on delete cascade,
  agent text not null,
  metric text not null,
  "window" text not null,
  value numeric,
  people integer,
  suppressed boolean not null default false,
  state text not null default 'measured' check (state in ('measured', 'not_enabled', 'not_collected', 'insufficient', 'incomplete_window')),
  detail jsonb not null default '{}'::jsonb
);
create index if not exists agent_findings_run on staff.agent_findings (run_id);
create index if not exists agent_findings_metric on staff.agent_findings (agent, metric, at desc);
create table if not exists staff.agent_proposals (
  id bigserial primary key,
  at timestamptz not null default now(),
  run_id uuid references staff.agent_runs (id) on delete cascade,
  agent text not null,
  kind text not null,
  target text not null,
  change jsonb not null default '{}'::jsonb,
  rationale text not null default '',
  metric text,
  priority integer not null default 0,
  requires_human boolean not null default true,
  status text not null default 'open' check (status in ('open', 'applied', 'held', 'approved', 'rejected', 'dropped', 'expired')),
  decided_by uuid,
  decided_at timestamptz,
  note text not null default ''
);
create index if not exists agent_proposals_status on staff.agent_proposals (status, at desc);
create table if not exists staff.agent_actions (
  id bigserial primary key,
  at timestamptz not null default now(),
  proposal_id bigint references staff.agent_proposals (id) on delete set null,
  run_id uuid references staff.agent_runs (id) on delete set null,
  kind text not null,
  target text not null,
  change jsonb not null default '{}'::jsonb,
  applied_by uuid,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  policy_version integer not null default 1,
  metric text,
  baseline numeric,
  baseline_people integer,
  outcome text check (outcome in ('up', 'flat', 'down', 'too few people', 'no metric')),
  outcome_value numeric,
  outcome_at timestamptz,
  reverted_at timestamptz,
  reverted_by uuid
);
grant select, insert, update on all tables in schema staff to rhythme_staff_fn;
grant usage, select on all sequences in schema staff to rhythme_staff_fn;

-- ---------- the separate improvement consent (public, own row) ----------
-- The app's "help improve logging" switch calls analysis_consent_set(); the server stamps the times. Withdrawal keeps the
-- row with withdrawn_at so the history scope and the notice version stay on record. Account deletion cascades.
create table if not exists public.analysis_consent (
  user_id uuid primary key references auth.users (id) on delete cascade,
  purpose text not null default 'improve_logging' check (purpose = 'improve_logging'),
  notice_version integer not null check (notice_version >= 1),
  notice_hash text,
  age_band text,
  history_scope text not null default 'from_now' check (history_scope in ('from_now', 'all')),
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.analysis_consent enable row level security;
drop policy if exists "own consent" on public.analysis_consent;
create policy "own consent" on public.analysis_consent for select to authenticated using (auth.uid() = user_id);
revoke all on table public.analysis_consent from anon;
grant select on table public.analysis_consent to authenticated;
create or replace function public.analysis_consent_set(p_on boolean, p_notice integer default null, p_age_band text default null, p_scope text default 'from_now', p_hash text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_on then
    if p_notice is null or p_notice < 1 then raise exception 'the notice version is required'; end if;
    insert into public.analysis_consent (user_id, notice_version, notice_hash, age_band, history_scope, accepted_at, withdrawn_at, updated_at)
      values (uid, p_notice, left(coalesce(p_hash, ''), 64), left(coalesce(p_age_band, ''), 12), case when p_scope = 'all' then 'all' else 'from_now' end, now(), null, now())
      on conflict (user_id) do update set notice_version = excluded.notice_version, notice_hash = excluded.notice_hash, age_band = excluded.age_band, history_scope = excluded.history_scope, accepted_at = now(), withdrawn_at = null, updated_at = now();
  else
    update public.analysis_consent set withdrawn_at = now(), updated_at = now() where user_id = uid and withdrawn_at is null;
  end if;
  return coalesce((select to_jsonb(c) from public.analysis_consent c where c.user_id = uid), jsonb_build_object('user_id', uid, 'on', false));
end $$;
revoke all on function public.analysis_consent_set(boolean, integer, text, text, text) from public, anon;
grant execute on function public.analysis_consent_set(boolean, integer, text, text, text) to authenticated;

-- ---------- helpers owned by the staff role (they touch staff tables only) ----------
create or replace function staff.caller() returns uuid language plpgsql stable set search_path = '' as $$
declare c jsonb; s text;
begin
  begin c := nullif(current_setting('request.jwt.claims', true), '')::jsonb; exception when others then return null; end;
  if c is null or coalesce(c ->> 'role', '') <> 'authenticated' then return null; end if;
  s := c ->> 'sub'; if s is null then return null; end if;
  begin return s::uuid; exception when others then return null; end;
end $$;
create or replace function staff.role_of(p_uid uuid) returns text language sql stable set search_path = '' as $$
  select a.role from staff.admin_accounts a where a.user_id = p_uid and a.revoked_at is null
$$;
create or replace function staff.policy(p_key text) returns jsonb language sql stable set search_path = '' as $$
  select value from staff.agent_policy where key = p_key
$$;
create or replace function staff.k_floor() returns integer language sql stable set search_path = '' as $$
  select greatest(20, coalesce((staff.policy('k_floor'))::text::integer, 20))
$$;
-- null when the caller may proceed; otherwise a denial object, audited and committed because nothing is raised
create or replace function staff.require(p_rpc text, p_detail jsonb, p_owner boolean default false) returns jsonb
language plpgsql set search_path = '' as $$
declare uid uuid := staff.caller(); r text;
begin
  r := staff.role_of(uid);
  if r is null then
    insert into staff.admin_audit (actor, role, rpc, decision, detail) values (uid, null, p_rpc, 'denied', jsonb_build_object('why', 'staff only'));
    return jsonb_build_object('error', 'This page is for Rhythme staff.', 'denied', true);
  end if;
  if p_owner and r <> 'owner' then
    insert into staff.admin_audit (actor, role, rpc, decision, detail) values (uid, r, p_rpc, 'denied', jsonb_build_object('why', 'owner only'));
    return jsonb_build_object('error', 'Only an owner can do that.', 'denied', true);
  end if;
  insert into staff.admin_audit (actor, role, rpc, decision, detail) values (uid, r, p_rpc, 'ok', coalesce(p_detail, '{}'::jsonb));
  return null;
end $$;
create or replace function staff.event(p_run uuid, p_agent text, p_kind text, p_title text, p_detail jsonb default '{}'::jsonb) returns void
language sql set search_path = '' as $$
  insert into staff.agent_events (run_id, agent, kind, title, detail) values (p_run, p_agent, p_kind, left(p_title, 300), coalesce(p_detail, '{}'::jsonb))
$$;
-- one run at a time: a run still 'running' and younger than ten minutes blocks a new one; older ones are marked abandoned
create or replace function staff.run_begin(p_kind text, p_trigger text, p_actor uuid) returns uuid
language plpgsql set search_path = '' as $$
declare rid uuid;
begin
  perform pg_advisory_xact_lock(hashtext('staff.run_begin'));
  update staff.agent_runs set status = 'failed', error = coalesce(error, 'abandoned'), finished_at = now() where status = 'running' and started_at <= now() - interval '10 minutes';
  if exists (select 1 from staff.agent_runs where status = 'running') then return null; end if;
  insert into staff.agent_runs (kind, trigger, actor) values (p_kind, p_trigger, p_actor) returning id into rid;
  return rid;
end $$;
alter function staff.caller() owner to rhythme_staff_fn;
alter function staff.role_of(uuid) owner to rhythme_staff_fn;
alter function staff.policy(text) owner to rhythme_staff_fn;
alter function staff.k_floor() owner to rhythme_staff_fn;
alter function staff.require(text, jsonb, boolean) owner to rhythme_staff_fn;
alter function staff.event(uuid, text, text, text, jsonb) owner to rhythme_staff_fn;
alter function staff.run_begin(text, text, uuid) owner to rhythme_staff_fn;

-- ---------- helpers owned by postgres: the only code that looks outside the staff schema ----------
-- counts of accounts and consent, no diary content
create or replace function staff.svc_counts() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'accounts_with_cloud_copy', (select count(*) from (select user_id from public.profiles union select user_id from public.entries) u),
    'consent_active', (select count(*) from public.analysis_consent c where c.withdrawn_at is null),
    'consent_eligible', (select count(*) from public.analysis_consent c where c.withdrawn_at is null and c.age_band = any (array(select jsonb_array_elements_text(staff.policy('adult_bands'))))),
    'consent_withdrawn', (select count(*) from public.analysis_consent c where c.withdrawn_at is not null),
    'relay_calls_today', (select coalesce(sum(count), 0) from public.luna_usage where day = current_date))
$$;
revoke all on function staff.svc_counts() from public;
grant execute on function staff.svc_counts() to rhythme_staff_fn;
-- an invitation binds a confirmed account by its id; the email is only the lookup key
create or replace function staff.user_by_email(p_email text) returns table (user_id uuid, confirmed boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email_confirmed_at is not null from auth.users u where lower(u.email) = lower(p_email) limit 1
$$;
revoke all on function staff.user_by_email(text) from public;
grant execute on function staff.user_by_email(text) to rhythme_staff_fn;
-- bounded retention: audit rows older than p_days (at least 90) and feed rows older than a year
create or replace function staff.prune(p_days integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a integer; e integer;
begin
  delete from staff.admin_audit where at < now() - make_interval(days => greatest(coalesce(p_days, 365), 90)); get diagnostics a = row_count;
  delete from staff.agent_events where at < now() - interval '365 days'; get diagnostics e = row_count;
  return jsonb_build_object('audit_removed', a, 'events_removed', e);
end $$;
revoke all on function staff.prune(integer) from public;
grant execute on function staff.prune(integer) to rhythme_staff_fn;

-- The metrics builder: the only reader of diary tables. Fixed queries; eligible accounts only (consent on, adult band,
-- entries inside the accepted history scope, not deleted); every number carries its people count; buckets under the
-- floor are held back with value and people both null. Weight is listed and never optimised.
create or replace function staff.metrics_build(p_run uuid, p_days integer default 28) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k integer := staff.k_floor();
  bands text[] := array(select jsonb_array_elements_text(staff.policy('adult_bands')));
  days integer := least(greatest(coalesce(p_days, 28), 7), 365);
  since date := current_date - least(greatest(coalesce(p_days, 28), 7), 365);
  win text := 'last ' || least(greatest(coalesce(p_days, 28), 7), 365) || ' days';
  elig integer; consenting integer;
  rec record; summary jsonb := '{}'::jsonb; per jsonb;
  procedure_note text;
begin
  -- who may be counted
  create temp table if not exists pg_temp.elig_users (user_id uuid primary key, scope_from timestamptz) on commit drop;
  delete from pg_temp.elig_users;
  insert into pg_temp.elig_users select c.user_id, case when c.history_scope = 'all' then '1970-01-01'::timestamptz else c.accepted_at end
    from public.analysis_consent c where c.withdrawn_at is null and c.age_band = any (bands);
  select count(*) into elig from pg_temp.elig_users;
  select count(*) into consenting from public.analysis_consent c where c.withdrawn_at is null;
  create temp table if not exists pg_temp.elig_entries (user_id uuid, id text, type text, date date, data jsonb, source text, created_at timestamptz) on commit drop;
  delete from pg_temp.elig_entries;
  insert into pg_temp.elig_entries select e.user_id, e.id, e.type, e.date, e.data, e.source, e.created_at
    from public.entries e join pg_temp.elig_users u on u.user_id = e.user_id where not e.deleted and e.created_at >= u.scope_from;

  -- a readiness finding for every agent first
  foreach procedure_note in array array['cycle', 'sleep', 'food', 'mind'] loop
    insert into staff.agent_findings (run_id, agent, metric, "window", value, people, suppressed, state, detail)
      values (p_run, procedure_note, 'eligible_people', 'now', elig, elig, false, case when elig = 0 then 'not_enabled' when elig < k then 'insufficient' else 'measured' end,
        jsonb_build_object('unit', 'accounts', 'stream', 'backup', 'consenting', consenting, 'floor', k, 'metric_version', 1,
          'prerequisite', case when elig = 0 then 'Nobody has turned on the separate "help improve logging" choice yet (the app switch is not built); until then this agent has nothing it may read.' when elig < k then 'Under the ' || k || '-person floor: values are held back until enough adults have opted in.' else null end));
    perform staff.event(p_run, procedure_note, 'readiness',
      case when elig = 0 then procedure_note || ': nothing it may read yet. 0 of ' || consenting || ' consenting accounts are eligible adults; the improvement switch is not built.'
           when elig < k then procedure_note || ': ' || elig || ' eligible adults, under the ' || k || '-person floor; values held back.'
           else procedure_note || ': ' || elig || ' eligible adults; measuring ' || win || '.' end,
      jsonb_build_object('eligible', elig, 'floor', k));
  end loop;
  summary := jsonb_build_object('eligible', elig, 'consenting', consenting, 'floor', k, 'window', win);
  if elig = 0 then return summary || jsonb_build_object('measured', false); end if;

  -- each metric: numerator, denominator unit and people; held back under the floor
  for rec in
    with
    period_days as (select user_id, date from pg_temp.elig_entries where type = 'period' and date >= since and coalesce(data ->> 'flow', '') not in ('', 'none') group by user_id, date),
    starts as (select user_id, date from (select user_id, date, lag(date) over (partition by user_id order by date) prev from (select user_id, date from pg_temp.elig_entries where type = 'period' and coalesce(data ->> 'flow', '') not in ('', 'none', 'spotting') group by user_id, date) d) s where prev is null or date - prev > 1),
    intervals as (select user_id, date - lag(date) over (partition by user_id order by date) iv from starts),
    sleep_rows as (select user_id, date, source from pg_temp.elig_entries where type = 'sleep' and date >= since),
    food_rows as (select user_id, date, data from pg_temp.elig_entries where type = 'food' and date >= since),
    mind_rows as (select user_id, date, data from pg_temp.elig_entries where type = 'mindfulness' and date >= since),
    m as (
      select 'cycle' agent, 'period_days' metric, win "window", count(*)::numeric value, count(distinct user_id) people, 'period days recorded (distinct account-days with a flow)' note from period_days
      union all select 'cycle', 'symptom_days', win, count(*), count(distinct user_id), 'symptom days recorded' from (select user_id, date from pg_temp.elig_entries where type = 'symptom' and date >= since group by 1, 2) s
      union all select 'cycle', 'people_with_two_starts', 'all history', count(*), count(*), 'accounts with at least two recorded period starts (two starts make one interval)' from (select user_id from starts group by user_id having count(*) >= 2) t
      union all select 'cycle', 'median_interval_days', 'all history', percentile_cont(0.5) within group (order by iv), count(distinct user_id), 'median days between recorded starts, across accounts with intervals; spotting and flow none do not start a cycle' from intervals where iv is not null
      union all select 'sleep', 'nights_recorded', win, count(*), count(distinct user_id), 'distinct account-nights with a sleep record' from (select user_id, date from sleep_rows group by 1, 2) n
      union all select 'sleep', 'nights_with_two_records', win, count(*), count(distinct user_id), 'account-nights with more than one sleep record (conflicts to reconcile)' from (select user_id, date from sleep_rows group by 1, 2 having count(*) > 1) c
      union all select 'sleep', 'imported_record_share', win, case when count(*) = 0 then null else round(100.0 * count(*) filter (where source in ('apple-health', 'google-fit', 'takeout')) / count(*), 1) end, count(distinct user_id), 'per cent of sleep records that came from an import, not a tap or a typed entry' from sleep_rows
      union all select 'food', 'meal_days', win, count(*), count(distinct user_id), 'distinct account-days with a saved meal' from (select user_id, date from food_rows group by 1, 2) d
      union all select 'food', 'meals_saved', win, count(*), count(distinct user_id), 'meals saved' from food_rows
      union all select 'food', 'tagged_share', win, case when count(*) = 0 then null else round(100.0 * count(*) filter (where jsonb_typeof(data -> 'tags') = 'array' and jsonb_array_length(data -> 'tags') > 0) / count(*), 1) end, count(distinct user_id), 'per cent of meals with at least one tag (missing nutrients are not zero)' from food_rows
      union all select 'mind', 'practice_days', win, count(*), count(distinct user_id), 'distinct account-days with a practice' from (select user_id, date from mind_rows group by 1, 2) d
      union all select 'mind', 'practice_minutes', win, coalesce(sum(coalesce((data ->> 'minutes')::numeric, 0)), 0), count(distinct user_id), 'minutes of practice recorded' from mind_rows
      union all select 'mind', 'completed_share', win, case when count(*) = 0 then null else round(100.0 * count(*) filter (where (data ->> 'completed') = 'true') / count(*), 1) end, count(distinct user_id), 'per cent of practices marked completed' from mind_rows
      union all select 'mind', 'reflection_days', win, count(*), count(distinct user_id), 'distinct account-days with a reflection (text is never read)' from (select user_id, date from pg_temp.elig_entries where type = 'reflection' and date >= since group by 1, 2) r
      union all select 'inventory', 'weight_days', win, count(*), count(distinct user_id), 'weigh-in days; listed, never optimised' from (select user_id, date from pg_temp.elig_entries where type = 'weight' and date >= since group by 1, 2) w
    ) select * from m
  loop
    insert into staff.agent_findings (run_id, agent, metric, "window", value, people, suppressed, state, detail)
      values (p_run, rec.agent, rec.metric, rec."window",
        case when rec.people < k then null else rec.value end,
        case when rec.people < k then null else rec.people end,
        rec.people < k,
        case when rec.people < k then 'insufficient' when rec.value is null then 'not_collected' else 'measured' end,
        jsonb_build_object('unit', 'accounts', 'stream', 'backup', 'floor', k, 'metric_version', 1, 'note', rec.note, 'eligible', elig));
  end loop;
  -- one honest line per agent in the feed
  for rec in select agent, count(*) n, count(*) filter (where suppressed) held from staff.agent_findings where run_id = p_run and agent in ('cycle', 'sleep', 'food', 'mind') and metric <> 'eligible_people' group by agent loop
    perform staff.event(p_run, rec.agent, 'findings', rec.agent || ': ' || rec.n || ' metrics for ' || win || (case when rec.held > 0 then ', ' || rec.held || ' held back under the ' || k || '-person floor' else '' end), jsonb_build_object('metrics', rec.n, 'held', rec.held));
  end loop;
  return summary || jsonb_build_object('measured', true);
end $$;
revoke all on function staff.metrics_build(uuid, integer) from public;
grant execute on function staff.metrics_build(uuid, integer) to rhythme_staff_fn;

-- ---------- the public RPCs (owned by the staff role) ----------
create or replace function public.admin_me() returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := staff.caller(); r text;
begin
  r := staff.role_of(uid);
  if r is null then
    if uid is not null then insert into staff.admin_audit (actor, role, rpc, decision, detail) values (uid, null, 'admin_me', 'denied', '{}'::jsonb); end if;
    return jsonb_build_object('admin', false);
  end if;
  insert into staff.admin_audit (actor, role, rpc, decision) values (uid, r, 'admin_me', 'ok');
  return jsonb_build_object('admin', true, 'role', r, 'uid', uid);
end $$;

create or replace function public.admin_overview() returns jsonb language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_overview', '{}'::jsonb); if d is not null then return d; end if;
  return jsonb_build_object(
    'counts', staff.svc_counts(),
    'floor', staff.k_floor(),
    'policy', (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from staff.agent_policy),
    'runs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'status', status, 'started_at', started_at, 'finished_at', finished_at, 'error', error, 'summary', summary) order by started_at desc), '[]'::jsonb) from (select * from staff.agent_runs order by started_at desc limit 8) r),
    'open_proposals', (select count(*) from staff.agent_proposals where status in ('open', 'held')),
    'live_actions', (select count(*) from staff.agent_actions where expires_at > now() and reverted_at is null),
    'blocked', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at', at, 'source', source, 'error', left(error, 200))), '[]'::jsonb) from staff.provider_blocks where cleared_at is null),
    'latest', (select coalesce(jsonb_object_agg(agent, f), '{}'::jsonb) from (
      select agent, jsonb_agg(jsonb_build_object('metric', metric, 'window', "window", 'value', value, 'people', people, 'suppressed', suppressed, 'state', state, 'note', detail ->> 'note', 'prerequisite', detail ->> 'prerequisite', 'at', at) order by id) f
      from staff.agent_findings where run_id = (select id from staff.agent_runs where status = 'ok' order by started_at desc limit 1) group by agent) x));
end $$;

create or replace function public.admin_feed(p_limit integer default 60, p_before bigint default null, p_after bigint default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_feed', jsonb_build_object('limit', p_limit, 'before', p_before, 'after', p_after)); if d is not null then return d; end if;
  return (select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc), '[]'::jsonb) from (
    select id, at, run_id, agent, kind, title, detail from staff.agent_events
    where (p_before is null or id < p_before) and (p_after is null or id > p_after) order by id desc limit least(greatest(coalesce(p_limit, 60), 1), 200)) e);
end $$;

create or replace function public.admin_findings(p_agent text default null, p_limit integer default 200) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_findings', jsonb_build_object('agent', p_agent)); if d is not null then return d; end if;
  return (select coalesce(jsonb_agg(to_jsonb(f) order by f.id desc), '[]'::jsonb) from (
    select id, at, run_id, agent, metric, "window", value, people, suppressed, state, detail from staff.agent_findings
    where p_agent is null or agent = p_agent order by id desc limit least(greatest(coalesce(p_limit, 200), 1), 500)) f);
end $$;

create or replace function public.admin_proposals(p_status text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_proposals', jsonb_build_object('status', p_status)); if d is not null then return d; end if;
  return (select coalesce(jsonb_agg(to_jsonb(p) order by p.id desc), '[]'::jsonb) from (
    select * from staff.agent_proposals where p_status is null or status = p_status order by id desc limit 300) p);
end $$;

create or replace function public.admin_actions(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_actions', '{}'::jsonb); if d is not null then return d; end if;
  return (select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc), '[]'::jsonb) from (
    select * from staff.agent_actions order by id desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) a);
end $$;

-- phase 1 decisions only change a proposal's status; applying a lever arrives with the approved content set
create or replace function public.admin_decide(p_id bigint, p_decision text, p_note text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; p staff.agent_proposals%rowtype; uid uuid := staff.caller();
begin
  d := staff.require('admin_decide', jsonb_build_object('id', p_id, 'decision', p_decision), true); if d is not null then return d; end if;
  if p_decision not in ('approve', 'hold', 'reject') then return jsonb_build_object('error', 'decision must be approve, hold or reject'); end if;
  select * into p from staff.agent_proposals where id = p_id for update;
  if not found then return jsonb_build_object('error', 'no such proposal'); end if;
  update staff.agent_proposals set status = case p_decision when 'approve' then 'approved' when 'hold' then 'held' else 'rejected' end, decided_by = uid, decided_at = now(), note = left(coalesce(p_note, ''), 400) where id = p_id;
  perform staff.event(p.run_id, 'staff', 'decision', 'staff ' || p_decision || 'd proposal #' || p_id || ' (' || p.kind || ' on ' || p.target || ')', jsonb_build_object('proposal', p_id, 'decision', p_decision));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_policy() returns jsonb language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_policy', '{}'::jsonb); if d is not null then return d; end if;
  return (select coalesce(jsonb_object_agg(key, jsonb_build_object('value', value, 'updated_at', updated_at)), '{}'::jsonb) from staff.agent_policy);
end $$;

create or replace function public.admin_policy_set(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; uid uuid := staff.caller();
begin
  d := staff.require('admin_policy_set', jsonb_build_object('key', p_key, 'value', p_value), true); if d is not null then return d; end if;
  if p_key not in ('k_floor', 'lever_days', 'model_on', 'autonomy_on') then return jsonb_build_object('error', 'that setting is not changeable here'); end if;
  if p_key = 'k_floor' and (jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 20) then return jsonb_build_object('error', 'the floor cannot go below 20 people'); end if;
  if p_key = 'lever_days' and (jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 1 or (p_value::text)::numeric > 30) then return jsonb_build_object('error', 'lever days must be between 1 and 30'); end if;
  if p_key in ('model_on', 'autonomy_on') and jsonb_typeof(p_value) <> 'boolean' then return jsonb_build_object('error', 'that setting is on or off'); end if;
  update staff.agent_policy set value = p_value, updated_at = now(), updated_by = uid where key = p_key;
  perform staff.event(null, 'staff', 'policy', 'staff set ' || p_key || ' to ' || p_value::text, jsonb_build_object('key', p_key, 'value', p_value));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_invite(p_email text, p_role text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; uid uuid := staff.caller(); e text := lower(trim(coalesce(p_email, ''))); v_uid uuid; v_conf boolean;
begin
  d := staff.require('admin_invite', jsonb_build_object('email', e, 'role', p_role), true); if d is not null then return d; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('error', 'that is not an email address'); end if;
  if p_role not in ('owner', 'analyst') then return jsonb_build_object('error', 'role must be owner or analyst'); end if;
  select user_id, confirmed into v_uid, v_conf from staff.user_by_email(e);
  if not found or v_uid is null then return jsonb_build_object('error', 'No Rhythme account uses that email yet. Ask them to sign in to the app once, then invite them.'); end if;
  if not coalesce(v_conf, false) then return jsonb_build_object('error', 'That account has not confirmed its email yet.'); end if;
  perform pg_advisory_xact_lock(hashtext('staff.admin_accounts'));
  insert into staff.admin_accounts (user_id, email, role, added_by) values (v_uid, e, p_role, uid)
    on conflict (user_id) do update set role = excluded.role, email = excluded.email, revoked_at = null, revoked_by = null, added_by = excluded.added_by, added_at = now();
  perform staff.event(null, 'staff', 'admins', 'staff invited ' || e || ' as ' || p_role, jsonb_build_object('role', p_role));
  return public.admin_list();
end $$;

create or replace function public.admin_revoke(p_user uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; uid uuid := staff.caller(); owners integer; a staff.admin_accounts%rowtype;
begin
  d := staff.require('admin_revoke', jsonb_build_object('user', p_user), true); if d is not null then return d; end if;
  perform pg_advisory_xact_lock(hashtext('staff.admin_accounts'));
  select * into a from staff.admin_accounts where user_id = p_user and revoked_at is null;
  if not found then return jsonb_build_object('error', 'no such active staff account'); end if;
  if a.role = 'owner' then
    select count(*) into owners from staff.admin_accounts where role = 'owner' and revoked_at is null;
    if owners <= 1 then return jsonb_build_object('error', 'the last owner cannot be removed'); end if;
  end if;
  update staff.admin_accounts set revoked_at = now(), revoked_by = uid where user_id = p_user;
  perform staff.event(null, 'staff', 'admins', 'staff revoked ' || a.email, jsonb_build_object('role', a.role));
  return public.admin_list();
end $$;

create or replace function public.admin_list() returns jsonb language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_list', '{}'::jsonb, true); if d is not null then return d; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'email', email, 'role', role, 'added_at', added_at, 'revoked_at', revoked_at) order by added_at), '[]'::jsonb) from staff.admin_accounts);
end $$;

create or replace function public.admin_audit_tail(p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_audit_tail', '{}'::jsonb, true); if d is not null then return d; end if;
  return (select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc), '[]'::jsonb) from (
    select a.id, a.at, a.actor, a.role, a.rpc, a.decision, a.detail, s.email from staff.admin_audit a left join staff.admin_accounts s on s.user_id = a.actor order by a.id desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) a);
end $$;

-- a deterministic run now: the four agents measure what they may, the orchestrator records what it would do
create or replace function public.admin_run(p_days integer default 28) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; uid uuid := staff.caller(); rid uuid; s jsonb; blocked integer; open_n integer; auto boolean;
begin
  d := staff.require('admin_run', jsonb_build_object('days', p_days)); if d is not null then return d; end if;
  rid := staff.run_begin('run_now', 'staff', uid);
  if rid is null then return jsonb_build_object('error', 'A run is already going. Give it a minute.'); end if;
  begin
    perform staff.event(rid, 'orchestrator', 'start', 'orchestrator: run started by staff; four agents measure, nothing is applied on its own (autonomy ' || (case when (staff.policy('autonomy_on'))::text = 'true' then 'on' else 'off' end) || ', model off)', jsonb_build_object('days', p_days));
    s := staff.metrics_build(rid, p_days);
    select count(*) into blocked from staff.provider_blocks where cleared_at is null;
    select count(*) into open_n from staff.agent_proposals where status in ('open', 'held');
    auto := (staff.policy('autonomy_on'))::text = 'true' and jsonb_array_length(coalesce(staff.policy('autonomous_kinds'), '[]'::jsonb)) > 0;
    perform staff.event(rid, 'orchestrator', 'done',
      'orchestrator: ' || (case when (s ->> 'measured') = 'true' then 'findings written for ' || (s ->> 'eligible') || ' eligible adults' else 'no eligible adults yet, readiness recorded' end)
      || '; ' || open_n || ' proposals open; ' || (case when auto then 'autonomy on' else 'nothing applied (autonomy off)' end) || (case when blocked > 0 then '; model runs blocked until an owner clears the block' else '' end),
      jsonb_build_object('summary', s, 'open_proposals', open_n, 'blocked', blocked));
    update staff.agent_runs set status = 'ok', finished_at = now(), summary = s where id = rid;
    return jsonb_build_object('ok', true, 'run_id', rid, 'summary', s);
  exception when others then
    update staff.agent_runs set status = 'failed', finished_at = now(), error = left(sqlerrm, 400) where id = rid;
    perform staff.event(rid, 'orchestrator', 'failed', 'orchestrator: run failed: ' || left(sqlerrm, 160), jsonb_build_object('error', left(sqlerrm, 400)));
    return jsonb_build_object('error', 'The run failed: ' || left(sqlerrm, 200), 'run_id', rid);
  end;
end $$;

create or replace function public.admin_block_clear(p_id bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; uid uuid := staff.caller();
begin
  d := staff.require('admin_block_clear', jsonb_build_object('id', p_id), true); if d is not null then return d; end if;
  update staff.provider_blocks set cleared_at = now(), cleared_by = uid where id = p_id and cleared_at is null;
  perform staff.event(null, 'staff', 'block', 'staff cleared provider block #' || p_id || '; one model run may be tried again', jsonb_build_object('id', p_id));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_prune(p_days integer default 365) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_prune', jsonb_build_object('days', p_days), true); if d is not null then return d; end if;
  return staff.prune(p_days);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_me()', 'public.admin_overview()', 'public.admin_feed(integer, bigint, bigint)', 'public.admin_findings(text, integer)',
    'public.admin_proposals(text)', 'public.admin_actions(integer)', 'public.admin_decide(bigint, text, text)', 'public.admin_policy()',
    'public.admin_policy_set(text, jsonb)', 'public.admin_invite(text, text)', 'public.admin_revoke(uuid)', 'public.admin_list()',
    'public.admin_audit_tail(integer)', 'public.admin_run(integer)', 'public.admin_block_clear(bigint)', 'public.admin_prune(integer)'] loop
    execute 'alter function ' || f || ' owner to rhythme_staff_fn';
    execute 'revoke all on function ' || f || ' from public, anon';
    execute 'grant execute on function ' || f || ' to authenticated';
  end loop;
end $$;
