-- Applied 19 Oct 2026, evening. The live front end does not record consent events yet, so the bounded guard from
-- 20261019070000 refused the first backup of every new account (found by the scene session in a rolled-back test;
-- the project's only account had no profile or entries). Until the consent front end is live, an account with no
-- cloud_sync event backs up as before. Accounts that do have events keep every rule: refused while withdrawn, and
-- entry rows edited before the last withdrawal refused.
--
-- AFTER RELEASE: once this branch's front end is live on Pages, re-apply the function from
-- 20261019070000_consent_guard_v3.sql so a new account must record its choice before its first write.
-- Verified in a rolled-back transaction: real account first backup ok, new account first backup ok, withdrawn refused.
create or replace function public.consent_sync_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare latest_action text; latest_at timestamptz; latest_id bigint; last_withdraw timestamptz;
begin
  select action, at, id into latest_action, latest_at, latest_id from public.consent_events
    where user_id = new.user_id and purpose = 'cloud_sync' order by at desc, id desc limit 1;
  if latest_action is null then return new; end if;
  if latest_action <> 'grant' then
    raise exception 'Cloud backup is off for this account.' using errcode = '42501';
  end if;
  if tg_table_name = 'entries' then
    select max(at) into last_withdraw from public.consent_events
      where user_id = new.user_id and purpose = 'cloud_sync' and action = 'withdraw' and (at < latest_at or (at = latest_at and id < latest_id));
    if last_withdraw is not null and new.updated_at is not null and new.updated_at < last_withdraw then
      raise exception 'This change is from before cloud backup was turned off.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
