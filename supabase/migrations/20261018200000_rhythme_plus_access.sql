-- Rhythme Plus preview: access codes unlock Erin's premium episodes until payments exist.
-- Applied to project zodkohwaznqgrfrcfdkf on 18 Oct 2026 (migration name rhythme_plus_access).
-- Codes are stored only as SHA-256 hashes; each redemption is its own revocable grant.
create table if not exists public.plus_codes (
  code_hash text primary key,
  label text not null default '',
  max_uses integer not null default 1 check (max_uses > 0),
  uses integer not null default 0,
  revoked boolean not null default false,
  redeem_by timestamptz,
  access_days integer not null default 365 check (access_days between 1 and 3650),
  created_at timestamptz not null default now()
);
create table if not exists public.plus_grants (
  id uuid primary key,
  code_hash text not null references public.plus_codes(code_hash),
  revoked boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.plus_codes enable row level security;
alter table public.plus_grants enable row level security;
revoke all on table public.plus_codes from anon, authenticated;
revoke all on table public.plus_grants from anon, authenticated;

create or replace function public.plus_redeem(p_hash text, p_grant uuid)
returns table(grant_id uuid, expires_at timestamptz, status text)
language plpgsql security definer set search_path = public as $$
declare g public.plus_grants%rowtype; c public.plus_codes%rowtype;
begin
  select * into g from public.plus_grants where id = p_grant;
  if found then
    if g.code_hash = p_hash then
      return query select g.id, g.expires_at, case when g.revoked then 'revoked' else 'ok' end; return;
    end if;
    return query select null::uuid, null::timestamptz, 'conflict'::text; return;
  end if;
  update public.plus_codes set uses = uses + 1
    where code_hash = p_hash and not revoked and (redeem_by is null or redeem_by > now()) and uses < max_uses
    returning * into c;
  if not found then return query select null::uuid, null::timestamptz, 'invalid'::text; return; end if;
  insert into public.plus_grants (id, code_hash, expires_at) values (p_grant, p_hash, now() + make_interval(days => c.access_days));
  return query select p_grant, now() + make_interval(days => c.access_days), 'ok'::text;
end $$;

create or replace function public.plus_grant_ok(p_grant uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.plus_grants g join public.plus_codes c on c.code_hash = g.code_hash
    where g.id = p_grant and not g.revoked and not c.revoked and g.expires_at > now()
  )
$$;

create or replace function public.plus_key_get()
returns text language sql security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'rhythme_plus_token_key' limit 1
$$;
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'rhythme_plus_token_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'rhythme_plus_token_key', 'HMAC key for Rhythme Plus access tokens');
  end if;
end $$;

revoke all on function public.plus_redeem(text, uuid) from public, anon, authenticated;
revoke all on function public.plus_grant_ok(uuid) from public, anon, authenticated;
revoke all on function public.plus_key_get() from public, anon, authenticated;
grant execute on function public.plus_redeem(text, uuid) to service_role;
grant execute on function public.plus_grant_ok(uuid) to service_role;
grant execute on function public.plus_key_get() to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('erin-premium', 'erin-premium', false, 20971520, array['audio/mpeg'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = array['audio/mpeg'];
