-- Consent sync guard, third cut (19 Oct 2026), after the rolled-back check of the second: the profiles branch no
-- longer refers to a column profiles do not have, and a withdrawal recorded at the same instant as the current grant
-- (lower id) still counts as the cut-off for stale entry writes. Applied the same day. Rollback: re-apply the function
-- from 20261019060000_consent_events_v2.sql.

create or replace function public.consent_sync_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare latest_action text; latest_at timestamptz; latest_id bigint; last_withdraw timestamptz; legacy boolean;
begin
  select action, at, id into latest_action, latest_at, latest_id from public.consent_events
    where user_id = new.user_id and purpose = 'cloud_sync' order by at desc, id desc limit 1;
  if latest_action is null then
    /* an account from before this release keeps working until its phone records its first event; a new account records its choice first */
    if tg_table_name = 'entries' then
      select exists (select 1 from public.profiles pr where pr.user_id = new.user_id) or exists (select 1 from public.entries e where e.user_id = new.user_id and e.id <> new.id) into legacy;
    else
      select exists (select 1 from public.profiles pr where pr.user_id = new.user_id) or exists (select 1 from public.entries e where e.user_id = new.user_id) into legacy;
    end if;
    if legacy then return new; end if;
    raise exception 'Cloud backup needs your choice on record first.' using errcode = '42501';
  end if;
  if latest_action <> 'grant' then
    raise exception 'Cloud backup is off for this account.' using errcode = '42501';
  end if;
  if tg_table_name = 'entries' then
    /* the last withdrawal before the current grant, including one recorded at the same instant with a lower id */
    select max(at) into last_withdraw from public.consent_events
      where user_id = new.user_id and purpose = 'cloud_sync' and action = 'withdraw' and (at < latest_at or (at = latest_at and id < latest_id));
    if last_withdraw is not null and new.updated_at is not null and new.updated_at < last_withdraw then
      raise exception 'This change is from before cloud backup was turned off.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
