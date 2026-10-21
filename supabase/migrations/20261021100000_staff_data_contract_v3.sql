-- Rhythme staff pipeline, phase 0 of the data capture plan (21 Oct 2026). Design: docs/design/2026-10-21-data-capture-
-- live-path-and-future-proofing.md; reviews: docs/design/reviews/2026-10-21-codex-data-capture-analysis.md and
-- 2026-10-21-deepseek-data-capture-second-review.md. Nothing here schedules a run, reads a diary row before the separate
-- "help improve logging" consent exists, or calls a model. Reversible: every object is additive or a function replaced
-- from its previous definition in 20261019040000_team_dashboard_floor.sql.
--
-- What changes:
--  1. one consent contract: analysis_consent_set writes the consent event and its current-state row in one transaction,
--     keeps the original accepted date on a repeat grant, needs a notice at least as new as the registry's, and records
--     how adulthood was attested (the server's age_18 event, or the adult band the phone sent);
--  2. a metric registry is the single authority for each metric's unit, denominator, people rule, window and
--     computation version (agent_policy.metric_version now mirrors it);
--  3. metrics_build v3: 28 completed Singapore dates with both bounds, a minimised projection (no notes, no whole
--     JSON), the phone's own period-episode rule, person-level medians over completed plausible cycles, missing is not
--     zero, multiple sleep records are not called conflicts, no entries read when nobody is eligible, and findings
--     distinguish no data from missing from zero;
--  4. deletion and withdrawal reach derived outputs: a withdrawal, a tombstoned or deleted entry of a consenting
--     account, or an account deletion marks every published run invalidated, and the overview holds results until the
--     next run recomputes; a persistent participant-to-finding map is deliberately not kept;
--  5. cloud-copy counts come from backup receipts kept by a trigger, so the counting function never reads entries;
--  6. a run contract: one worker lock shared by staff and scheduled runs, a unique due key per scheduled day, a private
--     scheduled entry point that no API role can call (the schedule itself is a later, approved migration), durations
--     by clock_timestamp, invalidation status.

-- ---------- 1. registries ----------
create table if not exists staff.notice_registry (
  purpose text not null,
  version integer not null check (version >= 1),
  hash text,
  note text,
  created_at timestamptz not null default now(),
  primary key (purpose, version)
);
insert into staff.notice_registry (purpose, version, note) values ('improve_logging', 3, 'Help improve logging, as worded in ovu-consent.js (notice v3)') on conflict do nothing;
create or replace function staff.notice_current(p_purpose text) returns integer language sql stable set search_path = '' as $$
  select max(version) from staff.notice_registry where purpose = p_purpose
$$;

create table if not exists staff.metric_registry (
  metric text primary key,
  agent text not null,
  unit text not null,
  denominator text not null,
  people_rule text not null,
  window_rule text not null,
  computation_version integer not null,
  note text
);
insert into staff.metric_registry (metric, agent, unit, denominator, people_rule, window_rule, computation_version, note) values
  ('eligible_people', 'all', 'accounts', 'active improvement consents in an adult band', 'the count itself', 'as of the run', 3, 'exact only at zero or at the floor and above'),
  ('period_days', 'cycle', 'account-days', 'account-days with a flow that is not none or spotting', 'accounts with at least one such day', '28 completed Singapore dates', 3, 'spotting is an observation, never a period day'),
  ('symptom_days', 'cycle', 'account-days', 'account-days with a symptom entry', 'accounts with at least one such day', '28 completed Singapore dates', 3, null),
  ('people_with_two_starts', 'cycle', 'accounts', 'accounts with at least two episode starts in the eligible history', 'the count itself', 'eligible history', 3, 'an episode joins bleeding days up to two days apart, as the phone does'),
  ('median_cycle_days', 'cycle', 'days', 'completed cycles of 15 to 90 days between episode starts', 'accounts with at least one completed plausible cycle', 'eligible history', 3, 'median of each account''s own median, so one account never outweighs another'),
  ('nights_recorded', 'sleep', 'account-nights', 'account-nights with at least one sleep record', 'accounts with at least one such night', '28 completed Singapore dates', 3, null),
  ('nights_with_several_records', 'sleep', 'account-nights', 'account-nights with more than one sleep record', 'accounts with at least one such night', '28 completed Singapore dates', 3, 'naps and split sleep are records, not conflicts'),
  ('imported_record_share', 'sleep', 'per cent of sleep records', 'sleep records in the window', 'accounts with at least one sleep record', '28 completed Singapore dates', 3, 'sources apple-health, google-fit and takeout count as imported'),
  ('meal_days', 'food', 'account-days', 'account-days with a saved meal', 'accounts with at least one such day', '28 completed Singapore dates', 3, 'no nutrient, health or quality score is derived'),
  ('meals_saved', 'food', 'meals', 'saved meals', 'accounts with at least one saved meal', '28 completed Singapore dates', 3, null),
  ('tagged_share', 'food', 'per cent of meals', 'saved meals', 'accounts with at least one saved meal', '28 completed Singapore dates', 3, 'a meal with at least one tag'),
  ('practice_days', 'mind', 'account-days', 'account-days with a practice', 'accounts with at least one such day', '28 completed Singapore dates', 3, null),
  ('practice_minutes', 'mind', 'minutes', 'practices with a valid duration of 1 to 600 minutes', 'accounts with at least one valid duration', '28 completed Singapore dates', 3, 'practices without a valid duration are counted separately as missing, never as zero'),
  ('practices_missing_duration', 'mind', 'practices', 'practices with no valid duration', 'accounts with at least one such practice', '28 completed Singapore dates', 3, null),
  ('completed_share', 'mind', 'per cent of practices', 'practices that carry a completed field', 'accounts with at least one such practice', '28 completed Singapore dates', 3, 'practices without the field are left out of the denominator'),
  ('reflection_days', 'mind', 'account-days', 'account-days with a reflection', 'accounts with at least one such day', '28 completed Singapore dates', 3, 'the text is never read'),
  ('weight_days', 'inventory', 'account-days', 'account-days with a weigh-in', 'accounts with at least one such day', '28 completed Singapore dates', 3, 'listed, never optimised')
on conflict (metric) do update set agent = excluded.agent, unit = excluded.unit, denominator = excluded.denominator, people_rule = excluded.people_rule, window_rule = excluded.window_rule, computation_version = excluded.computation_version, note = excluded.note;
create or replace function staff.metric_version() returns integer language sql stable set search_path = '' as $$
  select max(computation_version) from staff.metric_registry
$$;
insert into staff.agent_policy (key, value) values ('metric_version', to_jsonb(3)) on conflict (key) do update set value = to_jsonb(3);
insert into staff.agent_policy (key, value) values ('report_tz', to_jsonb('Asia/Singapore'::text)) on conflict (key) do nothing;
grant select on staff.notice_registry, staff.metric_registry to rhythme_staff_fn;
grant execute on function staff.notice_current(text), staff.metric_version() to rhythme_staff_fn;

-- ---------- 2. backup receipts: counts never read the diary ----------
create table if not exists staff.backup_receipts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create or replace function staff.note_backup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into staff.backup_receipts (user_id, first_at, last_at) values (new.user_id, now(), now())
    on conflict (user_id) do update set last_at = now();
  return new;
end $$;
drop trigger if exists entries_backup_receipt on public.entries;
create trigger entries_backup_receipt after insert or update on public.entries for each row execute function staff.note_backup();
insert into staff.backup_receipts (user_id, first_at, last_at)
  select user_id, min(created_at), max(coalesce(updated_at, created_at)) from public.entries group by user_id
  on conflict (user_id) do nothing;
grant select on staff.backup_receipts to rhythme_staff_fn;

-- ---------- 3. run contract: invalidation, due keys, clock durations, one lock for every path ----------
alter table staff.agent_runs add column if not exists due_key text;
alter table staff.agent_runs add column if not exists invalidated_at timestamptz;
alter table staff.agent_runs add column if not exists invalidation_reason text;
alter table staff.agent_runs add column if not exists started_clock timestamptz;
alter table staff.agent_runs add column if not exists finished_clock timestamptz;
create unique index if not exists agent_runs_due_key on staff.agent_runs (due_key) where due_key is not null;
alter table staff.agent_runs drop constraint if exists agent_runs_kind_check;
alter table staff.agent_runs add constraint agent_runs_kind_check check (kind in ('pulse', 'review', 'run_now', 'scheduled'));
alter table staff.agent_findings drop constraint if exists agent_findings_state_check;
alter table staff.agent_findings add constraint agent_findings_state_check check (state in ('measured', 'not_enabled', 'not_collected', 'insufficient', 'incomplete_window', 'no_data'));

-- every published run is held after a withdrawal or a deletion: the next run recomputes from what is still authorised
create or replace function staff.invalidate_runs(p_reason text) returns integer language plpgsql set search_path = '' as $$
declare n integer;
begin
  update staff.agent_runs set invalidated_at = now(), invalidation_reason = left(p_reason, 120)
    where status = 'ok' and invalidated_at is null;
  get diagnostics n = row_count;
  if n > 0 then insert into staff.agent_events (agent, kind, title, detail) values ('orchestrator', 'invalidated', 'orchestrator: ' || n || ' published run' || case when n = 1 then '' else 's' end || ' held until the next run (' || left(p_reason, 80) || ')', jsonb_build_object('runs', n, 'reason', left(p_reason, 120))); end if;
  return n;
end $$;
alter function staff.invalidate_runs(text) owner to rhythme_staff_fn;

-- a tombstoned or removed entry of an account that ever consented holds the published runs
create or replace function staff.on_entry_removed() returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid := coalesce(old.user_id, new.user_id);
begin
  if (tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.deleted and not old.deleted))
     and exists (select 1 from public.analysis_consent c where c.user_id = uid) then
    perform staff.invalidate_runs('an entry of a consenting account was deleted');
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists entries_invalidate_runs on public.entries;
create trigger entries_invalidate_runs after update of deleted or delete on public.entries for each row execute function staff.on_entry_removed();
-- an account that disappears (auth cascade) takes its consent row with it; that removal holds the runs too
create or replace function staff.on_consent_removed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform staff.invalidate_runs('a consenting account was deleted');
  return old;
end $$;
drop trigger if exists consent_invalidate_runs on public.analysis_consent;
create trigger consent_invalidate_runs after delete on public.analysis_consent for each row execute function staff.on_consent_removed();

-- one worker lock for staff presses and scheduled attempts alike; a scheduled day runs at most once
create or replace function staff.run_begin(p_kind text, p_trigger text, p_actor uuid, p_due_key text default null) returns uuid
language plpgsql set search_path = '' as $$
declare rid uuid;
begin
  perform pg_advisory_xact_lock(hashtext('staff.run_begin'));
  update staff.agent_runs set status = 'failed', error = coalesce(error, 'abandoned'), finished_at = now(), finished_clock = clock_timestamp() where status = 'running' and started_at <= now() - interval '10 minutes';
  if exists (select 1 from staff.agent_runs where status = 'running') then return null; end if;
  if p_due_key is not null and exists (select 1 from staff.agent_runs where due_key = p_due_key) then return null; end if;
  insert into staff.agent_runs (kind, trigger, actor, due_key, started_clock) values (p_kind, p_trigger, p_actor, p_due_key, clock_timestamp()) returning id into rid;
  return rid;
end $$;
alter function staff.run_begin(text, text, uuid, text) owner to rhythme_staff_fn;
drop function if exists staff.run_begin(text, text, uuid);

-- ---------- 4. the consent contract ----------
drop function if exists public.analysis_consent_set(boolean, integer, text, text, text, timestamptz);
create or replace function public.analysis_consent_set(p_on boolean, p_notice integer default null, p_age_band text default null, p_scope text default 'from_now', p_hash text default null, p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cur timestamptz; need integer; bands text[]; adult_event boolean; band_ok boolean; row_out public.analysis_consent;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select updated_at into cur from public.analysis_consent where user_id = uid for update;
  if p_expected_updated_at is not null and cur is not null and cur <> p_expected_updated_at then
    raise exception 'This choice was changed on another phone just now. Reload and look again.' using errcode = '40001';
  end if;
  if p_on then
    need := staff.notice_current('improve_logging');
    if p_notice is null or p_notice < coalesce(need, 1) then raise exception 'This phone shows an older notice. Update the app and read the current one first.' using errcode = '22023'; end if;
    bands := array(select jsonb_array_elements_text(staff.policy('adult_bands')));
    adult_event := public.consent_allows(uid, 'age_18');
    band_ok := p_age_band = any (bands);
    if not adult_event and not band_ok then raise exception 'Confirm you are 18 or older first.' using errcode = '22023'; end if;
    insert into public.analysis_consent (user_id, notice_version, notice_hash, age_band, history_scope, accepted_at, withdrawn_at, updated_at)
      values (uid, p_notice, left(coalesce(p_hash, ''), 64), left(coalesce(p_age_band, case when adult_event then 'adult' else '' end), 12), case when p_scope = 'all' then 'all' else 'from_now' end, now(), null, now())
      on conflict (user_id) do update set
        notice_version = excluded.notice_version, notice_hash = excluded.notice_hash, age_band = excluded.age_band, history_scope = excluded.history_scope,
        accepted_at = case when public.analysis_consent.withdrawn_at is null then public.analysis_consent.accepted_at else now() end, /* a repeat grant keeps its original start; a grant after a withdrawal starts again */
        withdrawn_at = null, updated_at = now();
    insert into public.consent_events (user_id, purpose, action, notice_version, notice_hash, method) values (uid, 'improve_logging', 'grant', p_notice, left(coalesce(p_hash, ''), 64), 'server');
  else
    update public.analysis_consent set withdrawn_at = now(), updated_at = now() where user_id = uid and withdrawn_at is null;
    if found then
      insert into public.consent_events (user_id, purpose, action, notice_version, method) values (uid, 'improve_logging', 'withdraw', coalesce(p_notice, staff.notice_current('improve_logging'), 1), 'server');
      perform staff.invalidate_runs('an account withdrew the improvement choice');
    end if;
  end if;
  select * into row_out from public.analysis_consent c where c.user_id = uid;
  return coalesce(to_jsonb(row_out) || jsonb_build_object('adult_attested_by', case when adult_event then 'age_18 event' when band_ok then 'age band' else null end), jsonb_build_object('user_id', uid, 'on', false));
end $$;
revoke all on function public.analysis_consent_set(boolean, integer, text, text, text, timestamptz) from public, anon;
grant execute on function public.analysis_consent_set(boolean, integer, text, text, text, timestamptz) to authenticated;

-- ---------- 5. counts without a diary read ----------
create or replace function staff.svc_counts() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'accounts_with_cloud_copy', (select count(*) from staff.backup_receipts),
    'consent_active', (select count(*) from public.analysis_consent c where c.withdrawn_at is null),
    'consent_eligible', (select count(*) from public.analysis_consent c where c.withdrawn_at is null and c.age_band = any (array(select jsonb_array_elements_text(staff.policy('adult_bands'))))),
    'consent_withdrawn', (select count(*) from public.analysis_consent c where c.withdrawn_at is not null),
    'relay_buckets_today', (select coalesce(sum(count), 0) from public.luna_usage where day = current_date))
$$;
revoke all on function staff.svc_counts() from public;
grant execute on function staff.svc_counts() to rhythme_staff_fn;

-- ---------- 6. metrics_build v3 ----------
create or replace function staff.metrics_build(p_run uuid, p_days integer default 28) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k integer := staff.k_floor();
  bands text[] := array(select jsonb_array_elements_text(staff.policy('adult_bands')));
  tz text := coalesce(staff.policy('report_tz') #>> '{}', 'Asia/Singapore');
  days integer := least(greatest(coalesce(p_days, 28), 7), 365);
  report_date date; win_start date; win_end date; win text;
  mv integer := staff.metric_version();
  elig integer; consenting integer; shown numeric; shown_people integer; under boolean;
  rec record; summary jsonb := '{}'::jsonb; agent_name text;
begin
  report_date := (now() at time zone tz)::date; /* the reporting day in Singapore; the window is the completed dates before it */
  win_end := report_date; win_start := report_date - days; win := days || ' completed dates to ' || (win_end - 1);
  create temp table if not exists pg_temp.elig_users (user_id uuid primary key, scope_from timestamptz) on commit drop;
  delete from pg_temp.elig_users;
  insert into pg_temp.elig_users select c.user_id, case when c.history_scope = 'all' then '1970-01-01'::timestamptz else c.accepted_at end
    from public.analysis_consent c where c.withdrawn_at is null and c.age_band = any (bands);
  select count(*) into elig from pg_temp.elig_users;
  select count(*) into consenting from public.analysis_consent c where c.withdrawn_at is null;
  under := elig > 0 and elig < k;
  shown := case when under then null else elig end; shown_people := case when under then null else elig end;
  foreach agent_name in array array['cycle', 'sleep', 'food', 'mind'] loop
    insert into staff.agent_findings (run_id, agent, metric, "window", value, people, suppressed, state, detail)
      values (p_run, agent_name, 'eligible_people', 'now', shown, shown_people, under, case when elig = 0 then 'not_enabled' when under then 'insufficient' else 'measured' end,
        jsonb_build_object('unit', 'accounts', 'stream', 'backup', 'floor', k, 'metric_version', mv, 'report_tz', tz, 'report_date', report_date,
          'prerequisite', case when elig = 0 then 'No eligible adult has the separate "help improve logging" choice on, so this agent reads no diary rows.' when under then 'Fewer than ' || k || ' eligible adults have opted in: values are held back until the floor is reached.' else null end));
    perform staff.event(p_run, agent_name, 'readiness',
      case when elig = 0 then agent_name || ': nothing it may read; no eligible adult has the improvement choice on.'
           when under then agent_name || ': fewer than ' || k || ' eligible adults have opted in; values held back.'
           else agent_name || ': ' || elig || ' eligible adults; measuring ' || win || '.' end,
      jsonb_build_object('floor', k, 'under_floor', under));
  end loop;
  summary := jsonb_build_object('eligible', shown, 'under_floor', under, 'floor', k, 'window', win, 'window_start', win_start, 'window_end_exclusive', win_end, 'report_tz', tz, 'metric_version', mv, 'consent_notice', staff.notice_current('improve_logging'));
  if elig = 0 then return summary || jsonb_build_object('measured', false); end if; /* no diary row is read when nobody is eligible */

  /* the minimised projection: the date, the type, and only the fields a registered metric needs; never notes or the whole JSON */
  create temp table if not exists pg_temp.elig_rows (user_id uuid, type text, date date, flow text, source text, minutes numeric, has_completed boolean, completed boolean, has_tags boolean) on commit drop;
  delete from pg_temp.elig_rows;
  insert into pg_temp.elig_rows
    select e.user_id, e.type, e.date,
      case when e.type = 'period' then nullif(e.data ->> 'flow', '') end,
      case when e.type = 'sleep' then e.source end,
      case when e.type = 'mindfulness' and (e.data ->> 'minutes') ~ '^[0-9]+(\.[0-9]+)?$' then (e.data ->> 'minutes')::numeric end,
      case when e.type = 'mindfulness' then e.data ? 'completed' end,
      case when e.type = 'mindfulness' then (e.data ->> 'completed') = 'true' end,
      case when e.type = 'food' then jsonb_typeof(e.data -> 'tags') = 'array' and jsonb_array_length(e.data -> 'tags') > 0 end
    from public.entries e join pg_temp.elig_users u on u.user_id = e.user_id
    where not e.deleted and e.created_at >= u.scope_from and e.date < win_end and e.date >= least(win_start, date '1970-01-01') and e.type in ('period', 'symptom', 'sleep', 'food', 'mindfulness', 'reflection', 'weight');
  /* history for cycles: all eligible dates up to the window end (the "from now" boundary still applies through scope_from) */

  for rec in
    with
    bleed as (select user_id, date from pg_temp.elig_rows where type = 'period' and flow is not null and flow not in ('none', 'spotting') group by user_id, date),
    -- the phone's rule (ovu-store.js periodEpisodes): a bleeding day within two days of the episode's last day joins it
    marked as (select user_id, date, case when lag(date) over (partition by user_id order by date) is null or date - lag(date) over (partition by user_id order by date) > 2 then 1 else 0 end starts_new from bleed),
    starts as (select user_id, date from marked where starts_new = 1),
    cycles as (select user_id, date - lag(date) over (partition by user_id order by date) len from starts),
    good_cycles as (select user_id, len from cycles where len between 15 and 90),
    person_median as (select user_id, percentile_cont(0.5) within group (order by len) med from good_cycles group by user_id),
    sleep_rows as (select user_id, date, source from pg_temp.elig_rows where type = 'sleep' and date >= win_start),
    food_rows as (select user_id, date, has_tags from pg_temp.elig_rows where type = 'food' and date >= win_start),
    mind_rows as (select user_id, date, minutes, has_completed, completed from pg_temp.elig_rows where type = 'mindfulness' and date >= win_start),
    m as (
      select 'cycle' agent, 'period_days' metric, win "window", count(*)::numeric value, count(distinct user_id) people from bleed where date >= win_start
      union all select 'cycle', 'symptom_days', win, count(*), count(distinct user_id) from (select user_id, date from pg_temp.elig_rows where type = 'symptom' and date >= win_start group by 1, 2) s
      union all select 'cycle', 'people_with_two_starts', 'eligible history', count(*), count(*) from (select user_id from starts group by user_id having count(*) >= 2) t
      union all select 'cycle', 'median_cycle_days', 'eligible history', percentile_cont(0.5) within group (order by med), count(*) from person_median
      union all select 'sleep', 'nights_recorded', win, count(*), count(distinct user_id) from (select user_id, date from sleep_rows group by 1, 2) n
      union all select 'sleep', 'nights_with_several_records', win, count(*), count(distinct user_id) from (select user_id, date from sleep_rows group by 1, 2 having count(*) > 1) c
      union all select 'sleep', 'imported_record_share', win, case when count(*) = 0 then null else round(100.0 * count(*) filter (where source in ('apple-health', 'google-fit', 'takeout')) / count(*), 1) end, count(distinct user_id) from sleep_rows
      union all select 'food', 'meal_days', win, count(*), count(distinct user_id) from (select user_id, date from food_rows group by 1, 2) d
      union all select 'food', 'meals_saved', win, count(*), count(distinct user_id) from food_rows
      union all select 'food', 'tagged_share', win, case when count(*) = 0 then null else round(100.0 * count(*) filter (where has_tags) / count(*), 1) end, count(distinct user_id) from food_rows
      union all select 'mind', 'practice_days', win, count(*), count(distinct user_id) from (select user_id, date from mind_rows group by 1, 2) d
      union all select 'mind', 'practice_minutes', win, sum(minutes), count(distinct user_id) from mind_rows where minutes between 1 and 600
      union all select 'mind', 'practices_missing_duration', win, count(*), count(distinct user_id) from mind_rows where minutes is null or minutes < 1 or minutes > 600
      union all select 'mind', 'completed_share', win, case when count(*) = 0 then null else round(100.0 * count(*) filter (where completed) / count(*), 1) end, count(distinct user_id) from mind_rows where has_completed
      union all select 'mind', 'reflection_days', win, count(*), count(distinct user_id) from (select user_id, date from pg_temp.elig_rows where type = 'reflection' and date >= win_start group by 1, 2) r
      union all select 'inventory', 'weight_days', win, count(*), count(distinct user_id) from (select user_id, date from pg_temp.elig_rows where type = 'weight' and date >= win_start group by 1, 2) w
    ) select m.*, r.unit, r.denominator, r.people_rule, r.note from m left join staff.metric_registry r on r.metric = m.metric
  loop
    insert into staff.agent_findings (run_id, agent, metric, "window", value, people, suppressed, state, detail)
      values (p_run, rec.agent, rec.metric, rec."window",
        case when rec.people < k then null else rec.value end,
        case when rec.people < k then null else rec.people end,
        rec.people < k,
        case when rec.people = 0 then 'no_data' when rec.people < k then 'insufficient' when rec.value is null then 'not_collected' else 'measured' end,
        jsonb_build_object('unit', coalesce(rec.unit, 'count'), 'denominator', rec.denominator, 'people_rule', rec.people_rule, 'stream', 'backup', 'floor', k, 'metric_version', mv,
          'report_tz', tz, 'window_start', win_start, 'window_end_exclusive', win_end, 'note', rec.note));
  end loop;
  for rec in select agent, count(*) n, count(*) filter (where suppressed) held, count(*) filter (where state = 'no_data') empty from staff.agent_findings where run_id = p_run and agent in ('cycle', 'sleep', 'food', 'mind') and metric <> 'eligible_people' group by agent loop
    perform staff.event(p_run, rec.agent, 'findings', rec.agent || ': ' || rec.n || ' metrics for ' || win || (case when rec.held > 0 then ', ' || rec.held || ' held back under the ' || k || '-person floor' else '' end) || (case when rec.empty > 0 then ', ' || rec.empty || ' with no data' else '' end), jsonb_build_object('metrics', rec.n, 'held', rec.held, 'no_data', rec.empty));
  end loop;
  return summary || jsonb_build_object('measured', true);
end $$;
revoke all on function staff.metrics_build(uuid, integer) from public;
grant execute on function staff.metrics_build(uuid, integer) to rhythme_staff_fn;

-- ---------- 7. the runs: staff press, and a private scheduled entry point (not scheduled by this migration) ----------
create or replace function staff.run_core(p_run uuid, p_days integer) returns jsonb language plpgsql set search_path = '' as $$
declare s jsonb; blocked integer; open_n integer; auto boolean;
begin
  perform staff.event(p_run, 'orchestrator', 'start', 'orchestrator: run started; four agents measure, nothing is applied on its own (autonomy ' || (case when (staff.policy('autonomy_on'))::text = 'true' then 'on' else 'off' end) || ', model ' || (case when (staff.policy('model_on'))::text = 'true' then 'on' else 'off' end) || ')', '{}'::jsonb);
  s := staff.metrics_build(p_run, p_days);
  select count(*) into blocked from staff.provider_blocks where cleared_at is null;
  select count(*) into open_n from staff.agent_proposals where status in ('open', 'held');
  auto := (staff.policy('autonomy_on'))::text = 'true' and jsonb_array_length(coalesce(staff.policy('autonomous_kinds'), '[]'::jsonb)) > 0;
  perform staff.event(p_run, 'orchestrator', 'done',
    'orchestrator: ' || (case when (s ->> 'measured') = 'true' then 'findings written for ' || coalesce(s ->> 'eligible', 'fewer than ' || (s ->> 'floor')) || ' eligible adults' else 'no eligible adults yet, readiness recorded' end)
    || '; ' || open_n || ' proposals open; ' || (case when auto then 'autonomy on' else 'nothing applied (autonomy off)' end) || (case when blocked > 0 then '; model runs blocked until an owner clears the block' else '' end),
    jsonb_build_object('summary', s, 'open_proposals', open_n, 'blocked', blocked));
  update staff.agent_runs set status = 'ok', finished_at = now(), finished_clock = clock_timestamp(), summary = s where id = p_run;
  return jsonb_build_object('ok', true, 'run_id', p_run, 'summary', s);
exception when others then
  update staff.agent_runs set status = 'failed', finished_at = now(), finished_clock = clock_timestamp(), error = left(sqlerrm, 400) where id = p_run;
  perform staff.event(p_run, 'orchestrator', 'failed', 'orchestrator: run failed: ' || left(sqlerrm, 160), jsonb_build_object('error', left(sqlerrm, 400)));
  return jsonb_build_object('error', 'The run failed: ' || left(sqlerrm, 200), 'run_id', p_run);
end $$;
alter function staff.run_core(uuid, integer) owner to rhythme_staff_fn;

create or replace function public.admin_run(p_days integer default 28) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; uid uuid := staff.caller(); rid uuid;
begin
  d := staff.require('admin_run', jsonb_build_object('days', p_days)); if d is not null then return d; end if;
  rid := staff.run_begin('run_now', 'staff', uid);
  if rid is null then return jsonb_build_object('error', 'A run is already going. Give it a minute.'); end if;
  return staff.run_core(rid, p_days);
end $$;

-- the scheduled attempt: callable only by the database owner (pg_cron runs as postgres); one attempt per Singapore day, never retried by this function
create or replace function staff.run_scheduled(p_due date default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare due date := coalesce(p_due, (now() at time zone coalesce(staff.policy('report_tz') #>> '{}', 'Asia/Singapore'))::date); rid uuid;
begin
  if current_setting('request.jwt.claims', true) is not null and current_setting('request.jwt.claims', true) <> '' then
    return jsonb_build_object('error', 'the scheduled run is not for API callers'); /* belt and braces: the grant below already keeps API roles out */
  end if;
  rid := staff.run_begin('scheduled', 'cron', null, 'daily:' || due);
  if rid is null then return jsonb_build_object('skipped', true, 'due', due, 'why', 'already attempted today, or a run is going'); end if;
  return staff.run_core(rid, 28);
end $$;
revoke all on function staff.run_scheduled(date) from public, anon, authenticated, service_role, rhythme_staff_fn;

-- ---------- 8. the overview: the latest valid run, and the hold when runs are invalidated ----------
create or replace function public.admin_overview() returns jsonb language plpgsql security definer set search_path = '' as $$
declare d jsonb; valid uuid; held integer;
begin
  d := staff.require('admin_overview', '{}'::jsonb); if d is not null then return d; end if;
  select id into valid from staff.agent_runs where status = 'ok' and invalidated_at is null order by started_at desc limit 1;
  select count(*) into held from staff.agent_runs where status = 'ok' and invalidated_at is not null and started_at > coalesce((select started_at from staff.agent_runs where id = valid), '1970-01-01'::timestamptz);
  return jsonb_build_object(
    'counts', staff.svc_counts(),
    'floor', staff.k_floor(),
    'policy', (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from staff.agent_policy),
    'metric_version', staff.metric_version(),
    'runs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'status', status, 'started_at', started_at, 'finished_at', finished_at, 'seconds', case when started_clock is not null and finished_clock is not null then round(extract(epoch from (finished_clock - started_clock))::numeric, 2) end, 'due_key', due_key, 'invalidated_at', invalidated_at, 'invalidation_reason', invalidation_reason, 'error', error, 'summary', summary) order by started_at desc), '[]'::jsonb) from (select * from staff.agent_runs order by started_at desc limit 8) r),
    'open_proposals', (select count(*) from staff.agent_proposals where status in ('open', 'held')),
    'live_actions', (select count(*) from staff.agent_actions where expires_at > now() and reverted_at is null),
    'blocked', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at', at, 'source', source, 'error', left(error, 200))), '[]'::jsonb) from staff.provider_blocks where cleared_at is null),
    'held_runs', held,
    'latest_run', valid,
    'scheduled', (select exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') and exists (select 1 from staff.agent_runs where kind = 'scheduled')),
    'latest', (select coalesce(jsonb_object_agg(agent, f), '{}'::jsonb) from (
      select agent, jsonb_agg(jsonb_build_object('metric', metric, 'window', "window", 'value', value, 'people', people, 'suppressed', suppressed, 'state', state, 'note', detail ->> 'note', 'unit', detail ->> 'unit', 'metric_version', detail -> 'metric_version', 'prerequisite', detail ->> 'prerequisite') order by metric) f
      from staff.agent_findings where run_id = valid group by agent) x));
end $$;
