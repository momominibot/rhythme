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
--     by clock_timestamp, invalidation status. Invalidation takes the same worker lock, so a withdrawal or deletion that
--     lands while a report is being built waits for that report to publish and then holds it: no report can publish a
--     contribution that was withdrawn during its run.
--
-- Decisions recorded for the legal read (docs/design/2026-10-21-data-capture-live-path-and-future-proofing.md):
--  * "from now" means observations dated on or after the day the choice was made, recorded after it: a later import of
--    older observations does not qualify unless the person chose "all history";
--  * the one backfill below reads only user_id and timestamps of public.entries (no content), to seed cloud-copy receipts;
--  * every published result from before this contract (metric version 2) is held until the next run recomputes it.

-- ---------- 1. registries ----------
create table if not exists staff.notice_registry (
  purpose text not null,
  version integer not null check (version >= 1),
  hash text,
  note text,
  created_at timestamptz not null default now(),
  accepted boolean not null default true, /* a choice made under this version still counts; a version whose improve-logging words changed is retired */
  primary key (purpose, version)
);
alter table staff.notice_registry add column if not exists accepted boolean not null default true;
-- the app's notice version (OvuStore.NOTICE_V) moves when anything on the notice changes; the improve-logging words changed at v4
-- and not at v5 (v5 added an optional birthday), so v4 and v5 choices both stand and v3 is retired
insert into staff.notice_registry (purpose, version, accepted, note) values
  ('improve_logging', 3, false, 'notice v3, retired 20 Oct 2026: the improve-logging words changed at v4'),
  ('improve_logging', 4, true, 'Help improve logging, as worded in ovu-consent.js under notice v4 (20 Oct 2026: says who can reach records); hash registered when the legal read fixes the words'),
  ('improve_logging', 5, true, 'notice v5 (21 Oct 2026) added an optional birthday; the improve-logging words are unchanged since v4')
on conflict (purpose, version) do update set accepted = excluded.accepted, note = excluded.note;
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
  ('eligible_people', 'all', 'accounts', 'active improvement choices with an adult attestation, made under the current notice', 'the count itself', 'as of the run', 3, 'exact only at zero or at the floor and above'),
  ('period_days', 'cycle', 'account-days', 'account-days with a flow that is not none or spotting', 'accounts with at least one such day', '28 completed Singapore dates', 3, 'spotting is an observation, never a period day'),
  ('symptom_days', 'cycle', 'account-days', 'account-days with a symptom entry', 'accounts with at least one such day', '28 completed Singapore dates', 3, null),
  ('people_with_two_starts', 'cycle', 'accounts', 'accounts with at least two episode starts in the eligible history', 'the count itself', 'eligible history', 3, 'an episode joins bleeding days up to two days apart, as the phone does'),
  ('median_cycle_days', 'cycle', 'days', 'completed cycles of 15 to 90 days between episode starts', 'accounts with at least one completed plausible cycle', 'eligible history', 3, 'median of each account''s own median, so one account never outweighs another'),
  ('nights_recorded', 'sleep', 'account-nights', 'account-nights with at least one sleep record', 'accounts with at least one such night', '28 completed Singapore dates', 3, null),
  ('nights_with_several_records', 'sleep', 'account-nights', 'account-nights with more than one sleep record', 'everyone with a recorded night (so none is an observed zero); the accounts with such a night must also reach the floor', '28 completed Singapore dates', 3, 'naps and split sleep are records, not conflicts'),
  ('imported_record_share', 'sleep', 'per cent of sleep records', 'sleep records in the window', 'accounts with at least one sleep record', '28 completed Singapore dates', 3, 'sources apple-health, google-fit and takeout count as imported'),
  ('meal_days', 'food', 'account-days', 'account-days with a saved meal', 'accounts with at least one such day', '28 completed Singapore dates', 3, 'no nutrient, health or quality score is derived'),
  ('meals_saved', 'food', 'meals', 'saved meals', 'accounts with at least one saved meal', '28 completed Singapore dates', 3, null),
  ('tagged_share', 'food', 'per cent of meals', 'saved meals', 'accounts with at least one saved meal', '28 completed Singapore dates', 3, 'a meal with at least one tag'),
  ('practice_days', 'mind', 'account-days', 'account-days with a practice', 'accounts with at least one such day', '28 completed Singapore dates', 3, null),
  ('practice_minutes', 'mind', 'minutes', 'practices with a valid duration of 0.5 to 600 minutes (the phone floors a stopped practice at 0.5)', 'accounts with at least one valid duration', '28 completed Singapore dates', 3, 'practices without a valid duration are counted separately as missing, never as zero'),
  ('practices_missing_duration', 'mind', 'practices', 'practices with no valid duration', 'everyone with a practice (so none missing is an observed zero); the accounts with a missing duration must also reach the floor', '28 completed Singapore dates', 3, null),
  ('completed_share', 'mind', 'per cent of practices', 'practices that carry a completed field', 'accounts with at least one such practice', '28 completed Singapore dates', 3, 'practices without the field are left out of the denominator'),
  ('reflection_days', 'mind', 'account-days', 'account-days with a reflection', 'accounts with at least one such day', '28 completed Singapore dates', 3, 'the text is never read'),
  ('weight_days', 'inventory', 'account-days', 'account-days with a weigh-in', 'accounts with at least one such day', '28 completed Singapore dates', 3, 'listed, never optimised')
on conflict (metric) do update set agent = excluded.agent, unit = excluded.unit, denominator = excluded.denominator, people_rule = excluded.people_rule, window_rule = excluded.window_rule, computation_version = excluded.computation_version, note = excluded.note;
create or replace function staff.metric_version() returns integer language sql stable set search_path = '' as $$
  select max(computation_version) from staff.metric_registry
$$;
insert into staff.agent_policy (key, value) values ('metric_version', to_jsonb(3)) on conflict (key) do update set value = to_jsonb(3);
insert into staff.agent_policy (key, value) values ('report_tz', to_jsonb('Asia/Singapore'::text)) on conflict (key) do nothing;
-- the phone sends 'adult' when no age range was given (ovu-auth.js improveSend): that label is accepted only with the
-- server's age_18 event (below), so it is not listed as a band that attests on its own
update staff.agent_policy set value = value - 'adult' where key = 'adult_bands' and value ? 'adult';
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
-- seed: user_id and timestamps only, no content column is read (a decision recorded for the legal read, see the header)
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
  perform pg_advisory_xact_lock(hashtext('staff.run_begin')); /* a report being built holds this lock until it publishes: the hold then lands on it too */
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
  if tg_op = 'DELETE' and not exists (select 1 from public.entries e where e.user_id = uid) then
    delete from staff.backup_receipts where user_id = uid; /* the cloud copy is gone: the receipt goes with it */
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
alter table public.analysis_consent add column if not exists adult_attested_by text check (adult_attested_by in ('age_18 event', 'age band'));
-- rows made before this contract: say how adulthood was attested, or they are not eligible
update public.analysis_consent c set adult_attested_by = case
    when public.consent_allows(c.user_id, 'age_18') then 'age_18 event'
    when c.age_band = any (array(select jsonb_array_elements_text(staff.policy('adult_bands')))) then 'age band' end
  where c.adult_attested_by is null;
drop function if exists public.analysis_consent_set(boolean, integer, text, text, text, timestamptz);
drop function if exists public.analysis_consent_set(boolean, integer, text, text, text, timestamptz, text);
-- every request the phone names gets a receipt (its normalised payload), so a resend after a lost reply returns the same answer and writes nothing
create table if not exists staff.consent_requests (
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id text not null,
  action text not null,
  payload_hash text not null,
  at timestamptz not null default now(),
  primary key (user_id, request_id)
);
create or replace function public.analysis_consent_set(p_on boolean, p_notice integer default null, p_age_band text default null, p_scope text default 'from_now', p_hash text default null, p_expected_updated_at timestamptz default null, p_request_id text default null, p_expect_none boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cur timestamptz; cur_scope text; cur_withdrawn timestamptz; need integer; reg_hash text; bands text[]; adult_event boolean; band_ok boolean; notice_ok boolean; row_out public.analysis_consent; rid text := nullif(left(coalesce(p_request_id, ''), 64), ''); prior staff.consent_requests; want_action text := case when p_on then 'grant' else 'withdraw' end; want_hash text;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('analysis_consent_set'), hashtext(uid::text)); /* one transition at a time per account, row or no row yet */
  want_hash := md5(want_action || '|' || coalesce(p_notice::text, '') || '|' || coalesce(p_age_band, '') || '|' || coalesce(p_scope, '') || '|' || coalesce(p_hash, ''));
  if rid is not null then
    select * into prior from staff.consent_requests r where r.user_id = uid and r.request_id = rid;
    if found then
      if prior.action <> want_action or prior.payload_hash <> want_hash then raise exception 'This request id was already used for a different request.' using errcode = '22023'; end if;
      select * into row_out from public.analysis_consent c where c.user_id = uid;
      return coalesce(to_jsonb(row_out), jsonb_build_object('user_id', uid, 'on', false)) || jsonb_build_object('replayed', true);
    end if;
  end if;
  select updated_at, history_scope, withdrawn_at into cur, cur_scope, cur_withdrawn from public.analysis_consent where user_id = uid for update;
  if p_expect_none and cur is not null then
    /* an automatic first binding from a phone that read no row: another phone decided meanwhile, and that decision stands */
    raise exception 'This choice was already decided on another phone. Reload and look again.' using errcode = '40001';
  end if;
  if p_expected_updated_at is not null and cur is not null and cur <> p_expected_updated_at then
    raise exception 'This choice was changed on another phone just now. Reload and look again.' using errcode = '40001';
  end if;
  if p_on then
    select r.hash, r.accepted into reg_hash, notice_ok from staff.notice_registry r where r.purpose = 'improve_logging' and r.version = p_notice;
    if (p_notice is null or not found) and p_notice < coalesce(staff.notice_current('improve_logging'), 0) then notice_ok := false; /* below every registered version: an older notice */
    elsif p_notice is null or not found then raise exception 'This phone shows a notice the server does not know (version %).', coalesce(p_notice::text, 'none') using errcode = '22023'; end if;
    if notice_ok is not true then raise exception 'This phone shows an older notice. Update the app and read the current one first.' using errcode = '22023'; end if;
    if reg_hash is not null and p_hash is distinct from reg_hash then raise exception 'The notice text on this phone does not match the registered notice. Update the app.' using errcode = '22023'; end if;
    bands := array(select jsonb_array_elements_text(staff.policy('adult_bands')));
    adult_event := public.consent_allows(uid, 'age_18');
    band_ok := coalesce(p_age_band = any (bands) and p_age_band <> 'adult', false); /* a concrete range attests; the plain label, an empty or a missing band needs the event */
    if (adult_event or band_ok) is not true then raise exception 'Confirm you are 18 or older first.' using errcode = '22023'; end if;
    if cur_withdrawn is null and cur_scope = 'all' and coalesce(p_scope, 'from_now') <> 'all' then
      raise exception 'To stop sharing earlier history, turn the choice off first and then on again.' using errcode = '22023'; /* a narrowed scope needs its own boundary and a hold on published results; off then on gives both */
    end if;
    insert into public.analysis_consent (user_id, notice_version, notice_hash, age_band, history_scope, adult_attested_by, accepted_at, withdrawn_at, updated_at)
      values (uid, p_notice, left(coalesce(p_hash, ''), 64), left(coalesce(p_age_band, case when adult_event then 'adult' else '' end), 12), case when p_scope = 'all' then 'all' else 'from_now' end, case when adult_event then 'age_18 event' else 'age band' end, now(), null, now())
      on conflict (user_id) do update set
        notice_version = excluded.notice_version, notice_hash = excluded.notice_hash, age_band = excluded.age_band, history_scope = excluded.history_scope, adult_attested_by = excluded.adult_attested_by,
        accepted_at = case when public.analysis_consent.withdrawn_at is null then public.analysis_consent.accepted_at else now() end, /* a repeat grant keeps its original start; a grant after a withdrawal starts again */
        withdrawn_at = null, updated_at = now();
    insert into public.consent_events (user_id, purpose, action, notice_version, notice_hash, method, client_id) values (uid, 'improve_logging', 'grant', p_notice, left(coalesce(p_hash, ''), 64), 'server', rid);
  else
    update public.analysis_consent set withdrawn_at = now(), updated_at = now() where user_id = uid and withdrawn_at is null;
    if found then
      insert into public.consent_events (user_id, purpose, action, notice_version, method, client_id) values (uid, 'improve_logging', 'withdraw', coalesce(p_notice, staff.notice_current('improve_logging'), 1), 'server', rid);
      perform staff.invalidate_runs('an account withdrew the improvement choice');
    elsif cur is null then
      /* nothing was on: the refusal is a decision, kept as a withdrawn row so another phone never reads "never decided" and pushes its own tick */
      insert into public.analysis_consent (user_id, notice_version, age_band, history_scope, accepted_at, withdrawn_at, updated_at)
        values (uid, coalesce(p_notice, staff.notice_current('improve_logging'), 1), '', 'from_now', now(), now(), now());
      insert into public.consent_events (user_id, purpose, action, notice_version, method, client_id) values (uid, 'improve_logging', 'withdraw', coalesce(p_notice, staff.notice_current('improve_logging'), 1), 'server', rid);
    end if;
  end if;
  if rid is not null then insert into staff.consent_requests (user_id, request_id, action, payload_hash) values (uid, rid, want_action, want_hash) on conflict do nothing; end if; /* a receipt for every accepted request, no-ops included */
  select * into row_out from public.analysis_consent c where c.user_id = uid;
  return coalesce(to_jsonb(row_out) || jsonb_build_object('adult_attested_by', case when adult_event then 'age_18 event' when band_ok then 'age band' else null end), jsonb_build_object('user_id', uid, 'on', false));
end $$;
revoke all on function public.analysis_consent_set(boolean, integer, text, text, text, timestamptz, text, boolean) from public, anon;
grant execute on function public.analysis_consent_set(boolean, integer, text, text, text, timestamptz, text, boolean) to authenticated;
-- the one eligibility rule, shared by the counts and the cohort: on, attested, and made under the registered current notice
create or replace function staff.consent_eligible(c public.analysis_consent) returns boolean language sql stable set search_path = '' as $$
  select c.withdrawn_at is null and c.adult_attested_by is not null
    and exists (select 1 from staff.notice_registry r where r.purpose = 'improve_logging' and r.version = c.notice_version and r.accepted and (r.hash is null or r.hash = c.notice_hash)) /* once the words are registered, only a choice made over those words counts */
$$;
grant execute on function staff.consent_eligible(public.analysis_consent) to rhythme_staff_fn;

-- the phone also mirrors its consent events through consent_record (ovu-consent.js drain); for improve_logging the account's
-- row and event are written by analysis_consent_set only, so the mirror returns the server's latest event and writes nothing
create or replace function public.consent_record(p_purpose text, p_action text, p_notice integer, p_hash text default null, p_method text default 'you', p_device text default null, p_client_at timestamptz default null, p_client_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); row_out public.consent_events; cid text := nullif(left(coalesce(p_client_id, ''), 64), '');
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_notice is null or p_notice < 1 then raise exception 'the notice version is required'; end if;
  if p_purpose = 'improve_logging' then
    select * into row_out from public.consent_events where user_id = uid and purpose = 'improve_logging' and method = 'server' order by at desc, id desc limit 1;
    if found then return to_jsonb(row_out) || jsonb_build_object('mirror', true); end if;
    return jsonb_build_object('mirror', true, 'recorded', false, 'why', 'this choice is recorded by analysis_consent_set');
  end if;
  if cid is not null then
    select * into row_out from public.consent_events where user_id = uid and client_id = cid;
    if found then return to_jsonb(row_out); end if; /* already on record: a resend changes nothing */
  end if;
  insert into public.consent_events (user_id, purpose, action, notice_version, notice_hash, method, device_id, client_at, client_id)
    values (uid, p_purpose, p_action, p_notice, left(coalesce(p_hash, ''), 64), p_method, left(coalesce(p_device, ''), 64), p_client_at, cid)
    returning * into row_out;
  return to_jsonb(row_out);
end $$;

-- ---------- 5. counts without a diary read ----------
create or replace function staff.svc_counts() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'accounts_with_cloud_copy', (select count(*) from staff.backup_receipts),
    'consent_active', (select count(*) from public.analysis_consent c where c.withdrawn_at is null),
    'consent_eligible', (select count(*) from public.analysis_consent c where staff.consent_eligible(c)),
    'consent_withdrawn', (select count(*) from public.analysis_consent c where c.withdrawn_at is not null),
    'relay_increments_today', (select coalesce(sum(count), 0) from public.luna_usage where day = current_date)) /* counter increments: a relay call bumps an IP bucket and a global bucket */
$$;
revoke all on function staff.svc_counts() from public;
grant execute on function staff.svc_counts() to rhythme_staff_fn;

-- ---------- 6. metrics_build v3 ----------
create or replace function staff.metrics_build(p_run uuid, p_days integer default 28) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k integer := staff.k_floor();
  tz text := coalesce(staff.policy('report_tz') #>> '{}', 'Asia/Singapore');
  days integer := least(greatest(coalesce(p_days, 28), 7), 365);
  report_date date; win_start date; win_end date; win text;
  mv integer := staff.metric_version();
  elig integer; consenting integer; shown numeric; shown_people integer; under boolean;
  rec record; summary jsonb := '{}'::jsonb; agent_name text; small boolean;
begin
  report_date := (now() at time zone tz)::date; /* the reporting day in Singapore; the window is the completed dates before it */
  win_end := report_date; win_start := report_date - days; win := days || ' completed dates to ' || (win_end - 1);
  create temp table if not exists pg_temp.elig_users (user_id uuid primary key, scope_from timestamptz, scope_date date) on commit drop;
  delete from pg_temp.elig_users;
  /* eligible: the choice is on, adulthood was attested, and the choice was made under the current notice */
  insert into pg_temp.elig_users select c.user_id,
      case when c.history_scope = 'all' then '1970-01-01'::timestamptz else c.accepted_at end,
      case when c.history_scope = 'all' then date '1970-01-01' else (c.accepted_at at time zone tz)::date end
    from public.analysis_consent c where staff.consent_eligible(c);
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
      case when e.type = 'mindfulness' then jsonb_typeof(e.data -> 'completed') = 'boolean' end,
      case when e.type = 'mindfulness' and jsonb_typeof(e.data -> 'completed') = 'boolean' then (e.data -> 'completed')::boolean end,
      case when e.type = 'food' then jsonb_typeof(e.data -> 'tags') = 'array' and jsonb_array_length(e.data -> 'tags') > 0 end
    from public.entries e join pg_temp.elig_users u on u.user_id = e.user_id
    where not e.deleted and e.created_at >= u.scope_from and e.date >= u.scope_date and e.date < win_end
      and (e.type = 'period' or e.date >= win_start) /* only period history reaches back past the window (cycle lengths); every other stream is read for the window alone */
      and e.type in ('period', 'symptom', 'sleep', 'food', 'mindfulness', 'reflection', 'weight');

  for rec in
    with
    bleed as (select user_id, date from pg_temp.elig_rows where type = 'period' and flow is not null and flow not in ('none', 'spotting') group by user_id, date),
    -- the phone's rule (ovu-store.js periodEpisodes): a bleeding day within two days of the episode's last day joins it
    marked as (select user_id, date, case when lag(date) over (partition by user_id order by date) is null or date - lag(date) over (partition by user_id order by date) > 2 then 1 else 0 end starts_new from bleed),
    starts as (select user_id, date from marked where starts_new = 1),
    cycles as (select user_id, date - lag(date) over (partition by user_id order by date) len from starts),
    good_cycles as (select user_id, len from cycles where len between 15 and 90),
    person_median as (select user_id, percentile_cont(0.5) within group (order by len) med from good_cycles group by user_id),
    sleep_rows as (select user_id, date, source in ('apple-health', 'google-fit', 'takeout') imported from pg_temp.elig_rows where type = 'sleep' and date >= win_start),
    food_rows as (select user_id, date, has_tags from pg_temp.elig_rows where type = 'food' and date >= win_start),
    mind_rows as (select user_id, date, minutes, has_completed, completed from pg_temp.elig_rows where type = 'mindfulness' and date >= win_start),
    m as (
      /* value, the people it is over, and for a share the people in its numerator and in its complement (a share with one
         person on either side would tell on that person, so both sides are held to the floor) */
      select 'cycle' agent, 'period_days' metric, win "window", count(*)::numeric value, count(distinct user_id) people, null::integer people_num, null::integer people_comp from bleed where date >= win_start
      union all select 'cycle', 'symptom_days', win, count(*), count(distinct user_id), null, null from (select user_id, date from pg_temp.elig_rows where type = 'symptom' and date >= win_start group by 1, 2) s
      union all select 'cycle', 'people_with_two_starts', 'eligible history', count(*), count(*), null, null from (select user_id from starts group by user_id having count(*) >= 2) t
      union all select 'cycle', 'median_cycle_days', 'eligible history', percentile_cont(0.5) within group (order by med), count(*), null, null from person_median
      union all select 'sleep', 'nights_recorded', win, count(*), count(distinct user_id), null, null from (select user_id, date from sleep_rows group by 1, 2) n
      union all select 'sleep', 'nights_with_several_records', win, count(*) filter (where c > 1), count(distinct user_id), count(distinct user_id) filter (where c > 1), null from (select user_id, date, count(*) c from sleep_rows group by 1, 2) c /* people: everyone with a night, so none is an observed zero; the positive cell has its own contributor count */
      union all select 'sleep', 'imported_record_share', win, case when count(*) = 0 then null else round(100.0 * count(*) filter (where imported is true) / count(*), 1) end, count(distinct user_id), count(distinct user_id) filter (where imported is true), count(distinct user_id) filter (where imported is not true) from sleep_rows /* an unknown source is not imported */
      union all select 'food', 'meal_days', win, count(*), count(distinct user_id), null, null from (select user_id, date from food_rows group by 1, 2) d
      union all select 'food', 'meals_saved', win, count(*), count(distinct user_id), null, null from food_rows
      union all select 'food', 'tagged_share', win, case when count(*) = 0 then null else round(100.0 * count(*) filter (where has_tags is true) / count(*), 1) end, count(distinct user_id), count(distinct user_id) filter (where has_tags is true), count(distinct user_id) filter (where has_tags is not true) from food_rows /* no tags field is untagged */
      union all select 'mind', 'practice_days', win, count(*), count(distinct user_id), null, null from (select user_id, date from mind_rows group by 1, 2) d
      union all select 'mind', 'practice_minutes', win, sum(minutes), count(distinct user_id), null, null from mind_rows where minutes between 0.5 and 600
      union all select 'mind', 'practices_missing_duration', win, count(*) filter (where minutes is null or minutes < 0.5 or minutes > 600), count(distinct user_id), count(distinct user_id) filter (where minutes is null or minutes < 0.5 or minutes > 600), null from mind_rows /* people: everyone with a practice, so none missing is an observed zero; the positive cell has its own contributor count */
      union all select 'mind', 'completed_share', win, case when count(*) = 0 then null else round(100.0 * count(*) filter (where completed is true) / count(*), 1) end, count(distinct user_id), count(distinct user_id) filter (where completed is true), count(distinct user_id) filter (where completed is not true) from mind_rows where has_completed
      union all select 'mind', 'reflection_days', win, count(*), count(distinct user_id), null, null from (select user_id, date from pg_temp.elig_rows where type = 'reflection' and date >= win_start group by 1, 2) r
      union all select 'inventory', 'weight_days', win, count(*), count(distinct user_id), null, null from (select user_id, date from pg_temp.elig_rows where type = 'weight' and date >= win_start group by 1, 2) w
    ) select m.*, r.unit, r.denominator, r.people_rule, r.note from m left join staff.metric_registry r on r.metric = m.metric
  loop
    small := rec.people < k or coalesce(rec.people_num, 0) between 1 and k - 1 or coalesce(rec.people_comp, 0) between 1 and k - 1;
    insert into staff.agent_findings (run_id, agent, metric, "window", value, people, suppressed, state, detail)
      values (p_run, rec.agent, rec.metric, rec."window",
        case when small then null else rec.value end,
        case when small then null else rec.people end,
        rec.people > 0 and small, /* no data is not a suppression: nothing was held back */
        case when rec.people = 0 then 'no_data' when small then 'insufficient' when rec.value is null then 'not_collected' else 'measured' end,
        jsonb_build_object('unit', coalesce(rec.unit, 'count'), 'denominator', rec.denominator, 'people_rule', rec.people_rule, 'stream', 'backup', 'floor', k, 'metric_version', mv,
          'report_tz', tz, 'window_start', case when rec."window" = 'eligible history' then null else win_start end, 'window_end_exclusive', win_end,
          'history_from', case when rec."window" = 'eligible history' then 'each account''s own scope date' end, 'note', rec.note));
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
    return jsonb_build_object('error', 'the scheduled run is not for API callers');
  end if;
  if due <> (now() at time zone coalesce(staff.policy('report_tz') #>> '{}', 'Asia/Singapore'))::date then
    return jsonb_build_object('error', 'a scheduled attempt is for today only: its metrics are computed as of today, so a past or future due date would mislabel the run'); /* belt and braces: the grant below already keeps API roles out */
  end if;
  rid := staff.run_begin('scheduled', 'cron', null, 'daily:' || due);
  if rid is null then return jsonb_build_object('skipped', true, 'due', due, 'why', 'already attempted today, or a run is going'); end if;
  return staff.run_core(rid, 28);
end $$;
revoke all on function staff.run_scheduled(date) from public, anon, authenticated, service_role, rhythme_staff_fn;
-- is the daily job installed? (a later, approved migration installs it under this name)
create or replace function staff.schedule_installed() returns boolean language plpgsql stable security definer set search_path = '' as $$
declare b boolean;
begin
  execute 'select exists (select 1 from cron.job where jobname = $1 and active and command like $2)' into b using 'rhythme-daily-run', '%staff.run_scheduled%';
  return coalesce(b, false);
exception when others then return false;
end $$;
revoke all on function staff.schedule_installed() from public;
grant execute on function staff.schedule_installed() to rhythme_staff_fn;

-- ---------- 8. the overview: the latest valid run, and the hold when runs are invalidated ----------
create or replace function public.admin_overview() returns jsonb language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_overview', '{}'::jsonb); if d is not null then return d; end if;
  /* one statement, so one snapshot: the valid run, the hold count, the runs list and the findings can never disagree when a withdrawal commits mid-call */
  return (with v as (select id, started_at from staff.agent_runs where status = 'ok' and invalidated_at is null order by started_at desc limit 1)
  select jsonb_build_object(
    'counts', staff.svc_counts(),
    'floor', staff.k_floor(),
    'policy', (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from staff.agent_policy),
    'metric_version', staff.metric_version(),
    'runs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'status', status, 'started_at', started_at, 'finished_at', finished_at, 'seconds', case when started_clock is not null and finished_clock is not null then round(extract(epoch from (finished_clock - started_clock))::numeric, 2) end, 'due_key', due_key, 'invalidated_at', invalidated_at, 'invalidation_reason', invalidation_reason, 'error', error, 'summary', case when invalidated_at is null then summary end) order by started_at desc), '[]'::jsonb) from (select * from staff.agent_runs order by started_at desc limit 8) r),
    'open_proposals', (select count(*) from staff.agent_proposals where status in ('open', 'held')),
    'live_actions', (select count(*) from staff.agent_actions where expires_at > now() and reverted_at is null),
    'blocked', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'at', at, 'source', source, 'error', left(error, 200))), '[]'::jsonb) from staff.provider_blocks where cleared_at is null),
    'held_runs', (select count(*) from staff.agent_runs where status = 'ok' and invalidated_at is not null and started_at > coalesce((select started_at from v), '1970-01-01'::timestamptz)),
    'latest_run', (select id from v),
    'scheduled', staff.schedule_installed(),
    'latest', (select coalesce(jsonb_object_agg(agent, f), '{}'::jsonb) from (
      select agent, jsonb_agg(jsonb_build_object('metric', metric, 'window', "window", 'value', value, 'people', people, 'suppressed', suppressed, 'state', state, 'note', detail ->> 'note', 'unit', detail ->> 'unit', 'metric_version', detail -> 'metric_version', 'prerequisite', detail ->> 'prerequisite') order by metric) f
      from staff.agent_findings where run_id = (select id from v) group by agent) x)));
end $$;

-- findings are read through the same rule as the overview: only runs that published and were not held since
create or replace function public.admin_findings(p_agent text default null, p_limit integer default 200) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_findings', jsonb_build_object('agent', p_agent)); if d is not null then return d; end if;
  return (select coalesce(jsonb_agg(to_jsonb(f) order by f.id desc), '[]'::jsonb) from (
    select f.id, f.at, f.run_id, f.agent, f.metric, f."window", f.value, f.people, f.suppressed, f.state, f.detail from staff.agent_findings f
    join staff.agent_runs r on r.id = f.run_id
    where r.status = 'ok' and r.invalidated_at is null and (p_agent is null or f.agent = p_agent) order by f.id desc limit least(greatest(coalesce(p_limit, 200), 1), 500)) f);
end $$;

-- the feed reads under the same rule: an event of a held run keeps its time, agent and kind, but its derived words and detail are withheld
create or replace function public.admin_feed(p_limit integer default 60, p_before bigint default null, p_after bigint default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_feed', jsonb_build_object('limit', p_limit, 'before', p_before, 'after', p_after)); if d is not null then return d; end if;
  return (select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc), '[]'::jsonb) from (
    select ev.id, ev.at, ev.run_id, ev.agent, ev.kind,
      case when r.invalidated_at is null then ev.title else ev.agent || ': (held: ' || coalesce(r.invalidation_reason, 'results withdrawn') || ')' end title,
      case when r.invalidated_at is null then ev.detail else jsonb_build_object('held', true) end detail
    from staff.agent_events ev left join staff.agent_runs r on r.id = ev.run_id
    where (p_before is null or ev.id < p_before) and (p_after is null or ev.id > p_after) order by ev.id desc limit least(greatest(coalesce(p_limit, 60), 1), 200)) e);
end $$;

-- raising the people floor holds what was published under the lower one: a 21-person result must not stay up beside a floor of 30
create or replace function public.admin_policy_set(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb; uid uuid := staff.caller(); old_floor numeric;
begin
  d := staff.require('admin_policy_set', jsonb_build_object('key', p_key, 'value', p_value), true); if d is not null then return d; end if;
  if p_key not in ('k_floor', 'lever_days', 'model_on', 'autonomy_on') then return jsonb_build_object('error', 'that setting is not changeable here'); end if;
  if p_key = 'k_floor' and (jsonb_typeof(p_value) <> 'number' or (p_value::text) !~ '^[0-9]{2,4}$' or (p_value::text)::integer not between 20 and 1000) then return jsonb_build_object('error', 'the floor is a whole number of people from 20 to 1000'); end if;
  if p_key = 'lever_days' and (jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 1 or (p_value::text)::numeric > 30) then return jsonb_build_object('error', 'lever days must be between 1 and 30'); end if;
  if p_key in ('model_on', 'autonomy_on') and jsonb_typeof(p_value) <> 'boolean' then return jsonb_build_object('error', 'that setting is on or off'); end if;
  if p_key = 'k_floor' then
    perform pg_advisory_xact_lock(hashtext('staff.run_begin')); /* the worker lock first, so a report being built cannot publish under the old floor after this */
    select case when value::text ~ '^[0-9]+$' then (value::text)::numeric end into old_floor from staff.agent_policy where key = 'k_floor'; /* read raw, so a malformed stored value can still be corrected here */
  end if;
  if p_key = 'k_floor' then p_value := to_jsonb((p_value::text)::integer); end if; /* stored in its canonical whole-number form */
  update staff.agent_policy set value = p_value, updated_at = now(), updated_by = uid where key = p_key;
  perform staff.event(null, 'staff', 'policy', 'staff set ' || p_key || ' to ' || p_value::text, jsonb_build_object('key', p_key, 'value', p_value));
  if p_key = 'k_floor' and (old_floor is null or (p_value::text)::numeric > old_floor) then /* an unreadable old floor counts as raised: hold rather than guess */
    perform staff.invalidate_runs('people floor raised to ' || (p_value::text) || '; the next run recomputes under it');
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 9. the upgrade boundary: nothing computed under the previous contract stays published ----------
select staff.invalidate_runs('metric contract upgraded to version 3; the next run recomputes under it');
-- Rollback: there is no automatic rollback. Restoring the version 2 functions would reopen findings this migration held;
-- if a rollback is ever needed, hold the readers first (revoke admin_overview, admin_findings and admin_feed(integer, bigint, bigint) from authenticated),
-- then restore, then invalidate again.
