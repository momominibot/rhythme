-- Consent events, second cut after the Codex review of the rebuild (19 Oct 2026). Applied the same day.
--
-- 1. 'settings' is a method (Luna's own settings sheet records where a change was made).
-- 2. Every event carries the phone's own id, so a resend of an already recorded choice changes nothing: a grant whose
--    reply was lost cannot come back later and undo a withdrawal made in between.
-- 3. The sync guard picks the latest event by (at, id) like consent_allows, applies the stale-write rule to entries only
--    (a profile upload carries its transmission time, not an edit time), and bounds the allowance for accounts from
--    before this release: an account with no cloud_sync event may continue only if it already has a profile row or other
--    entries on the server; a brand-new account must have its choice on record before its first write.

alter table public.consent_events drop constraint if exists consent_events_method_check;
alter table public.consent_events add constraint consent_events_method_check check (method in ('sheet', 'you', 'jit', 'settings', 'import', 'server'));
alter table public.consent_events add column if not exists client_id text;
create unique index if not exists consent_events_client_id on public.consent_events (user_id, client_id) where client_id is not null;

drop function if exists public.consent_record(text, text, integer, text, text, text, timestamptz);
create or replace function public.consent_record(p_purpose text, p_action text, p_notice integer, p_hash text default null, p_method text default 'you', p_device text default null, p_client_at timestamptz default null, p_client_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); row_out public.consent_events; cid text := nullif(left(coalesce(p_client_id, ''), 64), '');
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_notice is null or p_notice < 1 then raise exception 'the notice version is required'; end if;
  if cid is not null then
    select * into row_out from public.consent_events where user_id = uid and client_id = cid;
    if found then return to_jsonb(row_out); end if; /* already on record: a resend changes nothing */
  end if;
  insert into public.consent_events (user_id, purpose, action, notice_version, notice_hash, method, device_id, client_at, client_id)
    values (uid, p_purpose, p_action, p_notice, left(coalesce(p_hash, ''), 64), p_method, left(coalesce(p_device, ''), 64), p_client_at, cid)
    returning * into row_out;
  return to_jsonb(row_out);
end $$;
revoke all on function public.consent_record(text, text, integer, text, text, text, timestamptz, text) from public, anon;
grant execute on function public.consent_record(text, text, integer, text, text, text, timestamptz, text) to authenticated;

create or replace function public.consent_sync_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare latest_action text; latest_at timestamptz; last_withdraw timestamptz;
begin
  select action, at into latest_action, latest_at from public.consent_events
    where user_id = new.user_id and purpose = 'cloud_sync' order by at desc, id desc limit 1;
  if latest_action is null then
    /* an account from before this release keeps working until its phone records its first event; a new account records its choice first */
    if exists (select 1 from public.profiles pr where pr.user_id = new.user_id)
       or exists (select 1 from public.entries e where e.user_id = new.user_id and (tg_table_name <> 'entries' or e.id <> new.id)) then
      return new;
    end if;
    raise exception 'Cloud backup needs your choice on record first.' using errcode = '42501';
  end if;
  if latest_action <> 'grant' then
    raise exception 'Cloud backup is off for this account.' using errcode = '42501';
  end if;
  if tg_table_name = 'entries' then
    select max(at) into last_withdraw from public.consent_events
      where user_id = new.user_id and purpose = 'cloud_sync' and action = 'withdraw' and at < latest_at;
    if last_withdraw is not null and new.updated_at is not null and new.updated_at < last_withdraw then
      raise exception 'This change is from before cloud backup was turned off.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Rollback (keeps every receipt: history is never dropped once real choices exist):
--   drop trigger if exists entries_consent_guard on public.entries;
--   drop trigger if exists profiles_consent_guard on public.profiles;
--   drop function if exists public.consent_sync_guard();
--   drop function if exists public.consent_allows(uuid, text);
--   drop function if exists public.consent_state_mine();
--   drop function if exists public.consent_state(uuid);
--   drop function if exists public.consent_record(text, text, integer, text, text, text, timestamptz, text);
--   alter table public.consent_events rename to consent_events_retired_20261019;
