-- Grants tied to a signed-in email: Rhythme Plus and tester mode (unlimited hearts). Service role only.
create table if not exists public.account_grants (
  email text primary key,
  plus boolean not null default false,
  tester boolean not null default false,
  grant_id uuid,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.account_grants enable row level security;

-- A signed-in email with plus = true gets a regular ten-year Plus grant, created once and reused, so the
-- existing token and signed-URL path serves it unchanged.
create or replace function public.plus_account_grant(p_email text, p_uid uuid)
returns table (status text, grant_id uuid, expires_at timestamptz, tester boolean)
language plpgsql security definer set search_path = public as $$
declare
  g public.account_grants%rowtype;
  h text;
  gid uuid;
  exp timestamptz;
begin
  select * into g from public.account_grants where email = lower(p_email);
  if not found then return query select 'none'::text, null::uuid, null::timestamptz, false; return; end if;
  if g.grant_id is not null then
    select pg.expires_at into exp from public.plus_grants pg where pg.id = g.grant_id and not pg.revoked;
    if exp is not null and exp > now() then return query select 'ok'::text, g.grant_id, exp, g.tester; return; end if;
  end if;
  if not g.plus then return query select 'none'::text, null::uuid, null::timestamptz, g.tester; return; end if;
  h := 'account:' || p_uid::text;
  insert into public.plus_codes (code_hash, label, max_uses, uses, access_days) values (h, 'account grant', 1, 1, 3650) on conflict (code_hash) do nothing;
  gid := gen_random_uuid();
  exp := now() + interval '3650 days';
  insert into public.plus_grants (id, code_hash, expires_at) values (gid, h, exp);
  update public.account_grants set grant_id = gid, updated_at = now() where email = g.email;
  return query select 'ok'::text, gid, exp, g.tester;
end $$;
revoke all on function public.plus_account_grant(text, uuid) from public, anon, authenticated;
grant execute on function public.plus_account_grant(text, uuid) to service_role;
