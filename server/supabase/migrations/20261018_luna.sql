-- Ovumind Luna proxy: usage counters and a Vault-held model key.
-- Applied to the Supabase project that hosts the `luna` edge function.
create extension if not exists supabase_vault;

create table if not exists public.luna_usage (
  bucket text primary key,
  day date not null default current_date,
  count integer not null default 0
);
alter table public.luna_usage enable row level security;

-- Count one call in a daily bucket; true while under the limit.
create or replace function public.luna_bump(p_bucket text, p_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  insert into public.luna_usage (bucket, day, count) values (p_bucket, current_date, 1)
  on conflict (bucket) do update
    set count = case when public.luna_usage.day = current_date then public.luna_usage.count + 1 else 1 end,
        day = current_date
  returning count into c;
  return c <= p_limit;
end $$;

-- The model key is written once and only ever read by the edge function.
create or replace function public.luna_secret_get()
returns text language sql security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'ovumind_ark_api_key' limit 1
$$;

create or replace function public.luna_secret_set_once(p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from vault.secrets where name = 'ovumind_ark_api_key') then return false; end if;
  perform vault.create_secret(p_key, 'ovumind_ark_api_key', 'Volcengine Ark key used by the Ovumind Luna proxy');
  return true;
end $$;

revoke all on function public.luna_bump(text, integer) from public, anon, authenticated;
revoke all on function public.luna_secret_get() from public, anon, authenticated;
revoke all on function public.luna_secret_set_once(text) from public, anon, authenticated;
grant execute on function public.luna_bump(text, integer) to service_role;
grant execute on function public.luna_secret_get() to service_role;
grant execute on function public.luna_secret_set_once(text) to service_role;
revoke all on table public.luna_usage from anon, authenticated;
