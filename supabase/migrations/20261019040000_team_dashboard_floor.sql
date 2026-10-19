-- Staff dashboard follow-up (19 Oct 2026), after the parent session built the "help improve logging" switch:
--  * the readiness finding and the feed never print an exact count of eligible adults under the floor (Codex: a count of
--    1 to 19 opted-in adults sat oddly with "k = 20 everywhere"); the run summary carries the same rule;
--  * the copy no longer says the switch is not built;
--  * analysis_consent_set takes an optional p_expected_updated_at: a phone that saw an older row cannot overwrite a
--    newer choice made on another phone (last write wins otherwise).

drop function if exists public.analysis_consent_set(boolean, integer, text, text, text);
create or replace function public.analysis_consent_set(p_on boolean, p_notice integer default null, p_age_band text default null, p_scope text default 'from_now', p_hash text default null, p_expected_updated_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cur timestamptz;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select updated_at into cur from public.analysis_consent where user_id = uid for update;
  if p_expected_updated_at is not null and cur is not null and cur <> p_expected_updated_at then
    raise exception 'This choice was changed on another phone just now. Reload and look again.' using errcode = '40001';
  end if;
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
revoke all on function public.analysis_consent_set(boolean, integer, text, text, text, timestamptz) from public, anon;
grant execute on function public.analysis_consent_set(boolean, integer, text, text, text, timestamptz) to authenticated;

create or replace function staff.metrics_build(p_run uuid, p_days integer default 28) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  k integer := staff.k_floor();
  bands text[] := array(select jsonb_array_elements_text(staff.policy('adult_bands')));
  since date := current_date - least(greatest(coalesce(p_days, 28), 7), 365);
  win text := 'last ' || least(greatest(coalesce(p_days, 28), 7), 365) || ' days';
  elig integer; consenting integer; shown numeric; shown_people integer; under boolean;
  rec record; summary jsonb := '{}'::jsonb;
  agent_name text;
begin
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

  -- the readiness finding: an exact count only at zero or at the floor and above; in between it is "fewer than k"
  under := elig > 0 and elig < k;
  shown := case when under then null else elig end; shown_people := case when under then null else elig end;
  foreach agent_name in array array['cycle', 'sleep', 'food', 'mind'] loop
    insert into staff.agent_findings (run_id, agent, metric, "window", value, people, suppressed, state, detail)
      values (p_run, agent_name, 'eligible_people', 'now', shown, shown_people, under, case when elig = 0 then 'not_enabled' when under then 'insufficient' else 'measured' end,
        jsonb_build_object('unit', 'accounts', 'stream', 'backup', 'floor', k, 'metric_version', 2,
          'prerequisite', case when elig = 0 then 'Nobody has turned on the separate "help improve logging" choice yet, so this agent has nothing it may read.' when under then 'Fewer than ' || k || ' eligible adults have opted in: values are held back until the floor is reached.' else null end));
    perform staff.event(p_run, agent_name, 'readiness',
      case when elig = 0 then agent_name || ': nothing it may read yet; nobody has turned on the improvement choice.'
           when under then agent_name || ': fewer than ' || k || ' eligible adults have opted in; values held back.'
           else agent_name || ': ' || elig || ' eligible adults; measuring ' || win || '.' end,
      jsonb_build_object('floor', k, 'under_floor', under));
  end loop;
  summary := jsonb_build_object('eligible', shown, 'under_floor', under, 'floor', k, 'window', win);
  if elig = 0 then return summary || jsonb_build_object('measured', false); end if;

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
        jsonb_build_object('unit', 'accounts', 'stream', 'backup', 'floor', k, 'metric_version', 2, 'note', rec.note));
  end loop;
  for rec in select agent, count(*) n, count(*) filter (where suppressed) held from staff.agent_findings where run_id = p_run and agent in ('cycle', 'sleep', 'food', 'mind') and metric <> 'eligible_people' group by agent loop
    perform staff.event(p_run, rec.agent, 'findings', rec.agent || ': ' || rec.n || ' metrics for ' || win || (case when rec.held > 0 then ', ' || rec.held || ' held back under the ' || k || '-person floor' else '' end), jsonb_build_object('metrics', rec.n, 'held', rec.held));
  end loop;
  return summary || jsonb_build_object('measured', true);
end $$;
revoke all on function staff.metrics_build(uuid, integer) from public;
grant execute on function staff.metrics_build(uuid, integer) to rhythme_staff_fn;

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
      'orchestrator: ' || (case when (s ->> 'measured') <> 'true' then 'no eligible adults yet, readiness recorded' when (s ->> 'under_floor') = 'true' then 'fewer than ' || (s ->> 'floor') || ' eligible adults, values held back' else 'findings written for ' || (s ->> 'eligible') || ' eligible adults' end)
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
alter function public.admin_run(integer) owner to rhythme_staff_fn;
revoke all on function public.admin_run(integer) from public, anon;
grant execute on function public.admin_run(integer) to authenticated;
