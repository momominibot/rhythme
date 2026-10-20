-- A small stand-in for what the live Supabase project already has, so the plaza and Plaza friends migrations load into a
-- throwaway local Postgres for tests that need two sessions at once (tools/db/race_test.py). Copied from the live
-- definitions where it matters (auth.uid, consent_events and its two functions, staff.require and friends); everything
-- else the migrations do not touch is left out. pg_cron is not available locally: `cron` is a table and a function with
-- the same shape, and the harness drops the migration's `create extension pg_cron` line.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated;
create table if not exists auth.users (id uuid primary key, email text, aud text, role text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

-- consent, as live after 20261019050000..070000 (consent rebuild)
create table if not exists public.consent_events (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('health_tracking', 'cloud_sync', 'ai_reading', 'food_photo_ai', 'ai_summaries', 'improve_logging', 'personalisation', 'research', 'age_18')),
  action text not null check (action in ('grant', 'withdraw')),
  notice_version integer not null check (notice_version >= 1),
  notice_hash text,
  method text not null check (method in ('sheet', 'you', 'jit', 'settings', 'import', 'server')),
  device_id text,
  client_at timestamptz,
  at timestamptz not null default now(),
  client_id text
);
alter table public.consent_events enable row level security;
revoke all on table public.consent_events from anon, public;
create or replace function public.consent_record(p_purpose text, p_action text, p_notice integer, p_hash text default null, p_method text default 'you', p_device text default null, p_client_at timestamptz default null, p_client_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); row_out public.consent_events;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  insert into public.consent_events (user_id, purpose, action, notice_version, notice_hash, method, device_id, client_at, client_id)
    values (uid, p_purpose, p_action, p_notice, left(coalesce(p_hash, ''), 64), p_method, left(coalesce(p_device, ''), 64), p_client_at, p_client_id)
    returning * into row_out;
  return to_jsonb(row_out);
end $$;
revoke all on function public.consent_record(text, text, integer, text, text, text, timestamptz, text) from public, anon;
grant execute on function public.consent_record(text, text, integer, text, text, text, timestamptz, text) to authenticated;
create or replace function public.consent_allows(p_uid uuid, p_purpose text) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select action = 'grant' from public.consent_events where user_id = p_uid and purpose = p_purpose order by at desc, id desc limit 1), false)
$$;
revoke all on function public.consent_allows(uuid, text) from public, anon, authenticated;

-- staff, as live after 20261019030000 (only the parts the plaza and friends migrations call)
create schema if not exists staff;
revoke all on schema staff from public;
do $$ begin if not exists (select 1 from pg_roles where rolname = 'rhythme_staff_fn') then create role rhythme_staff_fn nologin; end if; end $$;
grant rhythme_staff_fn to postgres;
grant usage, create on schema staff to rhythme_staff_fn;
grant create on schema public to rhythme_staff_fn;
create table if not exists staff.admin_accounts (user_id uuid primary key references auth.users (id) on delete cascade, email text not null, role text not null check (role in ('owner', 'analyst')), revoked_at timestamptz);
create table if not exists staff.admin_audit (id bigserial primary key, at timestamptz not null default now(), actor uuid, role text, rpc text not null, decision text not null, detail jsonb not null default '{}'::jsonb);
grant select, insert, update on all tables in schema staff to rhythme_staff_fn;
grant usage, select on all sequences in schema staff to rhythme_staff_fn;
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
alter function staff.caller() owner to rhythme_staff_fn;
alter function staff.role_of(uuid) owner to rhythme_staff_fn;
alter function staff.require(text, jsonb, boolean) owner to rhythme_staff_fn;

-- pg_cron's shape
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create or replace function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid
$$;
