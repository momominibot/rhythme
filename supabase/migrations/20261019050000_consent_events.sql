-- Consent as an event log, with server-side checks (Jamie's build prompt, 19 Oct 2026, section 4.2).
-- Not yet applied. Rollback at the bottom.
--
-- The phone keeps the same log in profile.consentEvents (ovu-consent.js). A signed-in person's choices are
-- recorded here through consent_record(); the current state is the latest event per purpose. The functions
-- that read a diary (luna, insight) ask consent_allows() when the caller is signed in. Sync writes are
-- refused while cloud backup is withdrawn, and a write edited before the withdrawal is refused even after a
-- later grant, so an offline phone cannot slip old rows past a withdrawal. Accounts with no events at all
-- (made before this release) are allowed until their phone records its first event, which the app does on
-- its first sync after the release.

create table if not exists public.consent_events (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('health_tracking', 'cloud_sync', 'ai_reading', 'food_photo_ai', 'ai_summaries', 'improve_logging', 'personalisation', 'research', 'age_18')),
  action text not null check (action in ('grant', 'withdraw')),
  notice_version integer not null check (notice_version >= 1),
  notice_hash text,
  method text not null check (method in ('sheet', 'you', 'jit', 'import', 'server')),
  device_id text,
  client_at timestamptz,
  at timestamptz not null default now()
);
create index if not exists consent_events_user_purpose on public.consent_events (user_id, purpose, at desc);
alter table public.consent_events enable row level security;
drop policy if exists "own consent events" on public.consent_events;
create policy "own consent events" on public.consent_events for select to authenticated using (auth.uid() = user_id);
revoke all on table public.consent_events from anon, public;
grant select on table public.consent_events to authenticated;

-- append one event for the signed-in person; returns the receipt row
create or replace function public.consent_record(p_purpose text, p_action text, p_notice integer, p_hash text default null, p_method text default 'you', p_device text default null, p_client_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); row_out public.consent_events;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_notice is null or p_notice < 1 then raise exception 'the notice version is required'; end if;
  insert into public.consent_events (user_id, purpose, action, notice_version, notice_hash, method, device_id, client_at)
    values (uid, p_purpose, p_action, p_notice, left(coalesce(p_hash, ''), 64), p_method, left(coalesce(p_device, ''), 64), p_client_at)
    returning * into row_out;
  return to_jsonb(row_out);
end $$;
revoke all on function public.consent_record(text, text, integer, text, text, text, timestamptz) from public, anon;
grant execute on function public.consent_record(text, text, integer, text, text, text, timestamptz) to authenticated;

-- the latest event per purpose for one account: {purpose: {on, at, notice, method}}
create or replace function public.consent_state(p_uid uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(purpose, jsonb_build_object('on', action = 'grant', 'at', at, 'notice', notice_version, 'method', method)), '{}'::jsonb)
  from (select distinct on (purpose) purpose, action, at, notice_version, method from public.consent_events where user_id = p_uid order by purpose, at desc, id desc) t
$$;
revoke all on function public.consent_state(uuid) from public, anon, authenticated;
grant execute on function public.consent_state(uuid) to service_role;

-- a signed-in person's own state (the phone reconciles with it)
create or replace function public.consent_state_mine() returns jsonb language sql stable security definer set search_path = '' as $$
  select public.consent_state(auth.uid())
$$;
revoke all on function public.consent_state_mine() from public, anon;
grant execute on function public.consent_state_mine() to authenticated;

-- true when the latest event for the purpose is a grant
create or replace function public.consent_allows(p_uid uuid, p_purpose text) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select action = 'grant' from public.consent_events where user_id = p_uid and purpose = p_purpose order by at desc, id desc limit 1), false)
$$;
revoke all on function public.consent_allows(uuid, text) from public, anon, authenticated;
grant execute on function public.consent_allows(uuid, text) to service_role;

-- sync writes need cloud backup to be on; a row edited before the last withdrawal is refused even after a new grant
create or replace function public.consent_sync_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare last_grant timestamptz; last_withdraw timestamptz; n integer;
begin
  select count(*) into n from public.consent_events where user_id = new.user_id and purpose = 'cloud_sync';
  if n = 0 then return new; end if; /* an account from before this release, until its phone records its first event */
  select max(at) filter (where action = 'grant'), max(at) filter (where action = 'withdraw') into last_grant, last_withdraw
    from public.consent_events where user_id = new.user_id and purpose = 'cloud_sync';
  if last_grant is null or (last_withdraw is not null and last_withdraw > last_grant) then
    raise exception 'Cloud backup is off for this account.' using errcode = '42501';
  end if;
  if last_withdraw is not null and new.updated_at is not null and new.updated_at < last_withdraw then
    raise exception 'This change is from before cloud backup was turned off.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists entries_consent_guard on public.entries;
create trigger entries_consent_guard before insert or update on public.entries for each row execute function public.consent_sync_guard();
drop trigger if exists profiles_consent_guard on public.profiles;
create trigger profiles_consent_guard before insert or update on public.profiles for each row execute function public.consent_sync_guard();

-- Rollback:
--   drop trigger if exists entries_consent_guard on public.entries;
--   drop trigger if exists profiles_consent_guard on public.profiles;
--   drop function if exists public.consent_sync_guard();
--   drop function if exists public.consent_allows(uuid, text);
--   drop function if exists public.consent_state_mine();
--   drop function if exists public.consent_state(uuid);
--   drop function if exists public.consent_record(text, text, integer, text, text, text, timestamptz);
--   drop table if exists public.consent_events;
