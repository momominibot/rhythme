-- Pending staff admins (22 Oct 2026). An invite turns into a staff.admin_accounts row the moment an account with that
-- email exists with a confirmed email (Google sign-in, Apple, or a used email code). Nothing is granted to an
-- unconfirmed address. Invites are written only by the database owner (no grants to anon or authenticated).
create table if not exists staff.admin_invites (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('owner', 'analyst')),
  note text not null default '',
  invited_at timestamptz not null default now(),
  claimed_by uuid,
  claimed_at timestamptz
);
revoke all on staff.admin_invites from public, anon, authenticated;

create or replace function staff.claim_admin_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
declare inv staff.admin_invites;
begin
  if new.email is null or new.email_confirmed_at is null then return new; end if;
  select * into inv from staff.admin_invites where email = lower(new.email) and claimed_at is null for update;
  if not found then return new; end if;
  insert into staff.admin_accounts (user_id, email, role, note)
    values (new.id, lower(new.email), inv.role, inv.note)
    on conflict (user_id) do nothing;
  update staff.admin_invites set claimed_by = new.id, claimed_at = now() where email = inv.email;
  return new;
end $$;
revoke all on function staff.claim_admin_invite() from public, anon, authenticated;

drop trigger if exists staff_claim_admin_invite on auth.users;
create trigger staff_claim_admin_invite after insert or update of email_confirmed_at, email on auth.users
  for each row execute function staff.claim_admin_invite();

insert into staff.admin_invites (email, role, note)
values ('vernece.lss@gmail.com', 'owner', 'invited 22 Oct 2026 at Jamie''s request (Dr Vernece)')
on conflict (email) do nothing;
