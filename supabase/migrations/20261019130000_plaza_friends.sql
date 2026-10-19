-- Plaza friends, phase 1 (docs/design/2026-10-19-plaza-chat-friends.md). Written 19 Oct 2026 and checked in a
-- transaction on the live project that rolled itself back (tools/db/plaza_friends_dryrun.sql); NOT applied: applying
-- it is Jamie's call.
--
-- * A person who turns on Plaza friends (consent purpose `social`, with 18+ on record) makes a plaza card: a name she
--   picks and one of the avatar looks. Others see only the card and a random handle, never the account id.
-- * Cards are seen only by people in the same plaza group at the same time who have a card of their own (mutual).
-- * Friend requests need that shared moment; answering "not now" is silent; a request lives 30 days from sending in
--   every case, so the sender cannot tell a decline from no answer.
-- * Friends send kind notes from a fixed list of phrases. No free text anywhere except the card's name, which the server
--   checks. Block and report on every card and note; staff review reports through audited calls.
-- * Every table is closed to the app's roles; every call is a security-definer function owned by postgres that checks
--   the caller, her consent and her card. Withdrawing `social`, by any route, deletes the card, friendships, requests and
--   notes (a trigger on consent_events); blocks stay, so a pause never reopens contact.
-- Undo: at the bottom.

-- ---------- the consent purpose ----------
alter table public.consent_events drop constraint if exists consent_events_purpose_check;
alter table public.consent_events add constraint consent_events_purpose_check check (purpose in ('health_tracking', 'cloud_sync', 'ai_reading', 'food_photo_ai', 'ai_summaries', 'improve_logging', 'personalisation', 'research', 'age_18', 'social'));

-- ---------- private helpers live in their own schema, which the app's roles cannot use ----------
create schema if not exists social;
revoke all on schema social from public, anon, authenticated;

-- ---------- tables ----------
create table if not exists public.social_phrases (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,30}$'),
  text text not null check (char_length(text) between 2 and 80),
  kind text not null check (kind in ('note', 'hello')),
  sort integer not null default 0,
  active boolean not null default true
);
insert into public.social_phrases (id, text, kind, sort) values
  ('tea', 'Sending you a warm cup of tea.', 'note', 1),
  ('gentle', 'Hope today is gentle with you.', 'note', 2),
  ('thinking', 'Thinking of you today.', 'note', 3),
  ('breath', 'Taking a slow breath with you.', 'note', 4),
  ('glad', 'Glad you’re here.', 'note', 5),
  ('same', 'Same here. You’re not alone.', 'note', 6),
  ('hug', 'Sending a soft hug.', 'note', 7),
  ('bench', 'Saved you a spot on the bench.', 'note', 8),
  ('here', 'I’m here if you want company.', 'note', 9),
  ('morning', 'Good morning. Take it slow.', 'note', 10),
  ('rest', 'Rest well tonight.', 'note', 11),
  ('thanks', 'Thank you. That was kind.', 'note', 12),
  ('hello', 'Hello, nice to see you here.', 'hello', 1),
  ('friends', 'Would you like to be friends?', 'hello', 2),
  ('wave', 'A little wave from across the plaza.', 'hello', 3)
on conflict (id) do nothing;

-- words a plaza name may not contain as a whole word; staff extend the list without a release
create table if not exists public.social_words (
  word text primary key check (word = lower(word) and char_length(word) between 2 and 40)
);
insert into public.social_words (word) values
  ('sex'), ('sexy'), ('porn'), ('nude'), ('nudes'), ('naked'), ('onlyfans'), ('fuck'), ('shit'), ('bitch'), ('cunt'), ('slut'),
  ('whore'), ('dick'), ('cock'), ('pussy'), ('rape'), ('nazi'), ('hitler'), ('kill'), ('suicide'),
  ('whatsapp'), ('telegram'), ('wechat'), ('instagram'), ('insta'), ('snapchat'), ('tiktok'), ('discord'), ('kik')
on conflict (word) do nothing;

create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle uuid not null unique default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 20),
  look text not null check (look ~ '^[a-z][a-z0-9-]{1,29}$'),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- a pause by staff belongs to the account, not the card, so turning Plaza friends off and on again does not lift it
create table if not exists public.social_holds (
  user_id uuid primary key references auth.users (id) on delete cascade,
  until timestamptz not null,
  at timestamptz not null default now()
);

create table if not exists public.social_requests (
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  hello text references public.social_phrases (id),
  status text not null default 'pending' check (status in ('pending', 'declined')),
  at timestamptz not null default now(),
  decided_at timestamptz,
  primary key (from_user, to_user),
  check (from_user <> to_user)
);
create index if not exists social_requests_to on public.social_requests (to_user, at desc);
create index if not exists social_requests_at on public.social_requests (at);

create table if not exists public.social_friends (
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  since timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index if not exists social_friends_b on public.social_friends (b);

create table if not exists public.social_blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  id uuid not null unique default gen_random_uuid(), -- unblock names this, so the list works after her card is gone
  name text, -- her card as it was when blocked, so the Blocked list can say who
  look text,
  at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists social_blocks_blocked on public.social_blocks (blocked);

create table if not exists public.social_notes (
  id bigserial primary key,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  phrase text not null references public.social_phrases (id),
  at timestamptz not null default now(),
  read_at timestamptz,
  check (from_user <> to_user)
);
create index if not exists social_notes_to on public.social_notes (to_user, at desc);
create index if not exists social_notes_from on public.social_notes (from_user, to_user, at desc);
create index if not exists social_notes_at on public.social_notes (at);

create table if not exists public.social_rate (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('ask', 'note', 'report', 'card')),
  at timestamptz not null default now()
);
create index if not exists social_rate_user on public.social_rate (user_id, kind, at desc);
create index if not exists social_rate_at on public.social_rate (at);

create table if not exists staff.social_reports (
  id bigserial primary key,
  reporter uuid references auth.users (id) on delete set null,
  reporter_handle uuid,
  reporter_name text,
  target uuid references auth.users (id) on delete set null,
  target_handle uuid not null,
  target_name text not null,
  target_look text,
  note_id bigint,
  phrase text,
  phrase_text text,
  reason text not null check (reason in ('unkind', 'spam', 'pretending', 'under18', 'worried', 'other')),
  status text not null default 'open' check (status in ('open', 'dismissed', 'paused', 'removed')),
  at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  days integer
);
create index if not exists social_reports_status on staff.social_reports (status, at desc);
create index if not exists social_reports_target on staff.social_reports (target, status);

alter table public.social_phrases enable row level security;
alter table public.social_words enable row level security;
alter table public.social_profiles enable row level security;
alter table public.social_holds enable row level security;
alter table public.social_requests enable row level security;
alter table public.social_friends enable row level security;
alter table public.social_blocks enable row level security;
alter table public.social_notes enable row level security;
alter table public.social_rate enable row level security;
alter table staff.social_reports enable row level security;
revoke all on table public.social_phrases, public.social_words, public.social_profiles, public.social_holds, public.social_requests, public.social_friends,
  public.social_blocks, public.social_notes, public.social_rate from public, anon, authenticated;
revoke all on sequence public.social_notes_id_seq from public, anon, authenticated;
revoke all on table staff.social_reports from public, anon, authenticated;

-- ---------- helpers (schema social, owned by postgres, callable only by the functions below) ----------
-- until when staff paused this account, or null
create or replace function social.paused(p_uid uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select h.until from public.social_holds h where h.user_id = p_uid and h.until > now()
$$;

-- 18+ and Plaza friends on record, a card, and no pause
create or replace function social.ok(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_uid is not null
     and public.consent_allows(p_uid, 'social') and public.consent_allows(p_uid, 'age_18')
     and exists (select 1 from public.social_profiles s where s.user_id = p_uid)
     and social.paused(p_uid) is null
$$;

create or replace function social.blocked(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.social_blocks b where (b.blocker = p_a and b.blocked = p_b) or (b.blocker = p_b and b.blocked = p_a))
$$;

create or replace function social.friends(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.social_friends f where f.a = least(p_a, p_b) and f.b = greatest(p_a, p_b))
$$;

create or replace function social.friend_count(p_uid uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.social_friends f where f.a = p_uid or f.b = p_uid
$$;

-- in this group now: checked in within the plaza's 75 seconds (and, for the caller, on the visit she names)
create or replace function social.present(p_uid uuid, p_server text, p_visit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plaza_presence p where p.user_id = p_uid and p.server = p_server
    and (p_visit is null or p.visit = p_visit) and p.seen_at > clock_timestamp() - interval '75 seconds')
$$;

-- one more of `kind` if fewer than p_max happened inside p_window; records it and says yes, or says no and records nothing
create or replace function social.hit(p_uid uuid, p_kind text, p_max integer, p_window interval) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('social:rate:' || p_uid::text || ':' || p_kind));
  if (select count(*) from public.social_rate r where r.user_id = p_uid and r.kind = p_kind and r.at > clock_timestamp() - p_window) >= p_max then return false; end if;
  insert into public.social_rate (user_id, kind, at) values (p_uid, p_kind, clock_timestamp());
  return true;
end $$;

create or replace function social.clean_name(p_name text) returns text
language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(normalize(coalesce(p_name, ''), NFC), '\s+', ' ', 'g'))
$$;

-- null when the name is fine; otherwise why not: length, chars, contact, reserved, word
create or replace function social.name_problem(p_name text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare n text := social.clean_name(p_name); low text; tok text; compact text;
begin
  if char_length(n) < 2 or char_length(n) > 20 then return 'length'; end if;
  if n !~ '^[[:alpha:][:digit:] ''’.-]+$' then return 'chars'; end if;
  if char_length(regexp_replace(n, '[^[:digit:]]', '', 'g')) > 3 then return 'contact'; end if;
  low := lower(n);
  if low ~ '(^|[^[:alpha:]])(www|http|https|com|net|org)([^[:alpha:]]|$)' then return 'contact'; end if;
  compact := regexp_replace(low, '[^[:alpha:]]', '', 'g');
  if compact ~ '^(rhythme|staff|admin|administrator|moderator|mod|erin|erinlee|luna|host|support|official|team|system)$'
     or compact ~ '^(rhythme|admin|moderator|official)' or compact ~ '(rhythme|official)$' then return 'reserved'; end if;
  foreach tok in array regexp_split_to_array(low, '[^[:alpha:]]+') loop
    if tok <> '' and exists (select 1 from public.social_words w where w.word = tok) then return 'word'; end if;
  end loop;
  if exists (select 1 from public.social_words w where char_length(w.word) >= 5 and position(w.word in compact) > 0) then return 'word'; end if;
  return null;
end $$;

-- everything older than its time goes; reads filter by age too, so nothing shown depends on this having run
create or replace function social.sweep() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.social_notes where at < now() - interval '30 days';
  delete from public.social_requests where at < now() - interval '30 days';
  delete from public.social_rate where at < now() - interval '2 days';
  delete from staff.social_reports where status <> 'open' and decided_at < now() - interval '365 days';
end $$;

-- block: end everything between the two, quietly, and remember the card as it was
create or replace function social.block(p_blocker uuid, p_blocked uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.social_blocks (blocker, blocked, name, look)
    select p_blocker, p_blocked, s.name, s.look from (select 1) x left join public.social_profiles s on s.user_id = p_blocked
  on conflict (blocker, blocked) do nothing;
  delete from public.social_friends where a = least(p_blocker, p_blocked) and b = greatest(p_blocker, p_blocked);
  delete from public.social_requests where (from_user = p_blocker and to_user = p_blocked) or (from_user = p_blocked and to_user = p_blocker);
  delete from public.social_notes where (from_user = p_blocker and to_user = p_blocked) or (from_user = p_blocked and to_user = p_blocker);
end $$;

-- the card a person shows, or null
create or replace function social.card(p_uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('handle', s.handle, 'name', s.name, 'look', s.look, 'hidden', s.hidden, 'paused_until', social.paused(p_uid))
  from public.social_profiles s where s.user_id = p_uid
$$;

-- withdrawing Plaza friends, by any route, deletes what it allowed; blocks stay
create or replace function social.on_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.purpose = 'social' and new.action = 'withdraw' then
    delete from public.social_notes where from_user = new.user_id or to_user = new.user_id;
    delete from public.social_requests where from_user = new.user_id or to_user = new.user_id;
    delete from public.social_friends where a = new.user_id or b = new.user_id;
    delete from public.social_profiles where user_id = new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists consent_social_withdraw on public.consent_events;
create trigger consent_social_withdraw after insert on public.consent_events for each row execute function social.on_consent();

-- ---------- the person's calls (signed in only) ----------
create or replace function public.social_me() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform social.sweep();
  return jsonb_build_object(
    'card', social.card(uid),
    'paused_until', social.paused(uid),
    'on', public.consent_allows(uid, 'social'),
    'adult', public.consent_allows(uid, 'age_18'),
    'phrases', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'text', p.text, 'kind', p.kind) order by p.kind, p.sort), '[]'::jsonb) from public.social_phrases p where p.active));
end $$;

-- make or change the card; the first time also records 18+ (if she ticked it) and Plaza friends, in the same step
create or replace function public.social_card_save(p_name text, p_look text, p_hidden boolean default false, p_adult boolean default false,
  p_notice integer default 1, p_hash text default null, p_device text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n text := social.clean_name(p_name); why text; prev public.social_profiles%rowtype; recorded text[] := '{}';
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if social.paused(uid) is not null then return jsonb_build_object('ok', false, 'why', 'paused', 'until', social.paused(uid)); end if;
  select * into prev from public.social_profiles where user_id = uid;
  why := social.name_problem(n);
  if why is not null then return jsonb_build_object('ok', false, 'why', 'name', 'problem', why); end if;
  if p_look is null or p_look !~ '^[a-z][a-z0-9-]{1,29}$' then return jsonb_build_object('ok', false, 'why', 'look'); end if;
  if not public.consent_allows(uid, 'age_18') then
    if not coalesce(p_adult, false) then return jsonb_build_object('ok', false, 'why', 'adult'); end if;
  end if;
  -- a new name or look counts towards six a day; hiding and showing do not
  if (prev.user_id is null or prev.name <> n or prev.look <> p_look) and not social.hit(uid, 'card', 6, interval '1 day') then
    return jsonb_build_object('ok', false, 'why', 'today');
  end if;
  if not public.consent_allows(uid, 'age_18') then
    insert into public.consent_events (user_id, purpose, action, notice_version, notice_hash, method, device_id, client_at)
      values (uid, 'age_18', 'grant', greatest(coalesce(p_notice, 1), 1), left(coalesce(p_hash, ''), 64), 'jit', left(coalesce(p_device, ''), 64), now());
    recorded := array_append(recorded, 'age_18');
  end if;
  if not public.consent_allows(uid, 'social') then
    insert into public.consent_events (user_id, purpose, action, notice_version, notice_hash, method, device_id, client_at)
      values (uid, 'social', 'grant', greatest(coalesce(p_notice, 1), 1), left(coalesce(p_hash, ''), 64), 'jit', left(coalesce(p_device, ''), 64), now());
    recorded := array_append(recorded, 'social');
  end if;
  insert into public.social_profiles (user_id, name, look, hidden) values (uid, n, p_look, coalesce(p_hidden, false))
    on conflict (user_id) do update set name = excluded.name, look = excluded.look, hidden = excluded.hidden, updated_at = now();
  return jsonb_build_object('ok', true, 'card', social.card(uid), 'recorded', to_jsonb(recorded));
end $$;

-- turn Plaza friends off: one withdrawal event; the trigger deletes the card, friends, requests and notes
create or replace function public.social_off(p_notice integer default 1, p_device text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  insert into public.consent_events (user_id, purpose, action, notice_version, method, device_id, client_at)
    values (uid, 'social', 'withdraw', greatest(coalesce(p_notice, 1), 1), 'you', left(coalesce(p_device, ''), 64), now());
  return jsonb_build_object('ok', true);
end $$;

-- the people in her group now, if she shows herself too
create or replace function public.social_people(p_server text, p_visit uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not social.ok(uid) then return jsonb_build_object('ok', false, 'why', 'off'); end if;
  if (select hidden from public.social_profiles where user_id = uid) then return jsonb_build_object('ok', false, 'why', 'hidden'); end if;
  if p_visit is null or not social.present(uid, p_server, p_visit) then return jsonb_build_object('ok', false, 'why', 'away'); end if;
  return jsonb_build_object('ok', true, 'people', coalesce((
    select jsonb_agg(x.j order by x.friend desc, x.joined_at) from (
      select jsonb_build_object('handle', s.handle, 'name', s.name, 'look', s.look,
               'friend', social.friends(uid, p.user_id),
               'asked', exists (select 1 from public.social_requests r where r.from_user = uid and r.to_user = p.user_id and r.at > now() - interval '30 days'),
               'asks', exists (select 1 from public.social_requests r where r.from_user = p.user_id and r.to_user = uid and r.status = 'pending' and r.at > now() - interval '14 days')) as j,
             social.friends(uid, p.user_id) as friend, p.joined_at
      from public.plaza_presence p join public.social_profiles s on s.user_id = p.user_id
      where p.server = p_server and p.user_id <> uid and p.seen_at > clock_timestamp() - interval '75 seconds'
        and not s.hidden and social.ok(p.user_id) and not social.blocked(uid, p.user_id)
      order by social.friends(uid, p.user_id) desc, p.joined_at
      limit 24) x), '[]'::jsonb));
end $$;

-- ask to be friends: only while both are in the same group; asking someone who asked you makes you friends
create or replace function public.social_ask(p_handle uuid, p_server text, p_visit uuid, p_hello text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); other uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not social.ok(uid) then return jsonb_build_object('ok', false, 'why', 'off'); end if;
  if p_visit is null or not social.present(uid, p_server, p_visit) then return jsonb_build_object('ok', false, 'why', 'away'); end if;
  select user_id into other from public.social_profiles where handle = p_handle;
  if other is null or other = uid or not social.ok(other) or social.blocked(uid, other) or not social.present(other, p_server, null)
     or (select hidden from public.social_profiles where user_id = other) then
    return jsonb_build_object('ok', false, 'why', 'gone');
  end if;
  perform pg_advisory_xact_lock(hashtext('social:pair:' || least(uid, other)::text || greatest(uid, other)::text));
  if social.friends(uid, other) then return jsonb_build_object('ok', true, 'status', 'friends'); end if;
  if exists (select 1 from public.social_requests r where r.from_user = other and r.to_user = uid and r.status = 'pending' and r.at > now() - interval '30 days') then
    if social.friend_count(uid) >= 200 or social.friend_count(other) >= 200 then return jsonb_build_object('ok', false, 'why', 'full'); end if;
    insert into public.social_friends (a, b) values (least(uid, other), greatest(uid, other)) on conflict do nothing;
    delete from public.social_requests where (from_user = uid and to_user = other) or (from_user = other and to_user = uid);
    return jsonb_build_object('ok', true, 'status', 'friends');
  end if;
  if exists (select 1 from public.social_requests r where r.from_user = uid and r.to_user = other and r.at > now() - interval '30 days') then
    return jsonb_build_object('ok', true, 'status', 'asked'); -- the same answer whether she said not now or has not answered
  end if;
  if p_hello is not null and not exists (select 1 from public.social_phrases p where p.id = p_hello and p.kind = 'hello' and p.active) then
    return jsonb_build_object('ok', false, 'why', 'phrase');
  end if;
  if (select count(*) from public.social_requests r where r.from_user = uid and r.status = 'pending' and r.at > now() - interval '14 days') >= 20 then
    return jsonb_build_object('ok', false, 'why', 'many');
  end if;
  if not social.hit(uid, 'ask', 10, interval '1 day') then return jsonb_build_object('ok', false, 'why', 'today'); end if;
  delete from public.social_requests where from_user = uid and to_user = other; -- a lapsed one the sweep has not reached
  insert into public.social_requests (from_user, to_user, hello) values (uid, other, p_hello);
  return jsonb_build_object('ok', true, 'status', 'asked');
end $$;

-- accept, or not now (silent)
create or replace function public.social_answer(p_handle uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); other uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not social.ok(uid) then return jsonb_build_object('ok', false, 'why', 'off'); end if;
  select user_id into other from public.social_profiles where handle = p_handle;
  if other is null then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  perform pg_advisory_xact_lock(hashtext('social:pair:' || least(uid, other)::text || greatest(uid, other)::text));
  if not exists (select 1 from public.social_requests r where r.from_user = other and r.to_user = uid and r.status = 'pending' and r.at > now() - interval '14 days') then
    return jsonb_build_object('ok', false, 'why', 'gone');
  end if;
  if not coalesce(p_accept, false) then
    update public.social_requests set status = 'declined', decided_at = now() where from_user = other and to_user = uid;
    return jsonb_build_object('ok', true, 'status', 'declined');
  end if;
  if not social.ok(other) or social.blocked(uid, other) then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  if social.friend_count(uid) >= 200 or social.friend_count(other) >= 200 then return jsonb_build_object('ok', false, 'why', 'full'); end if;
  insert into public.social_friends (a, b) values (least(uid, other), greatest(uid, other)) on conflict do nothing;
  delete from public.social_requests where (from_user = uid and to_user = other) or (from_user = other and to_user = uid);
  return jsonb_build_object('ok', true, 'status', 'friends');
end $$;

create or replace function public.social_unfriend(p_handle uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); other uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not social.ok(uid) then return jsonb_build_object('ok', false, 'why', 'off'); end if;
  select user_id into other from public.social_profiles where handle = p_handle;
  if other is null then return jsonb_build_object('ok', true); end if;
  delete from public.social_friends where a = least(uid, other) and b = greatest(uid, other);
  delete from public.social_notes where (from_user = uid and to_user = other) or (from_user = other and to_user = uid);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.social_block(p_handle uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); other uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not social.ok(uid) then return jsonb_build_object('ok', false, 'why', 'off'); end if;
  select user_id into other from public.social_profiles where handle = p_handle;
  if other is null or other = uid then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  perform social.block(uid, other);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.social_unblock(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not social.ok(uid) then return jsonb_build_object('ok', false, 'why', 'off'); end if;
  delete from public.social_blocks where blocker = uid and id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- a kind note to a friend, from the list
create or replace function public.social_note(p_handle uuid, p_phrase text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); other uuid; v_id bigint;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not social.ok(uid) then return jsonb_build_object('ok', false, 'why', 'off'); end if;
  select user_id into other from public.social_profiles where handle = p_handle;
  if other is null or not social.friends(uid, other) or not social.ok(other) or social.blocked(uid, other) then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  if not exists (select 1 from public.social_phrases p where p.id = p_phrase and p.kind = 'note' and p.active) then return jsonb_build_object('ok', false, 'why', 'phrase'); end if;
  perform pg_advisory_xact_lock(hashtext('social:rate:' || uid::text || ':note'));
  if exists (select 1 from public.social_notes n where n.from_user = uid and n.at > clock_timestamp() - interval '5 seconds') then return jsonb_build_object('ok', false, 'why', 'slow'); end if;
  if (select count(*) from public.social_notes n where n.from_user = uid and n.to_user = other and n.at > now() - interval '1 day') >= 20 then return jsonb_build_object('ok', false, 'why', 'today'); end if;
  if not social.hit(uid, 'note', 60, interval '1 day') then return jsonb_build_object('ok', false, 'why', 'today'); end if;
  insert into public.social_notes (from_user, to_user, phrase, at) values (uid, other, p_phrase, clock_timestamp()) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- mark notes she has seen (for her own badge only; the sender is never told)
create or replace function public.social_read(p_upto bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  update public.social_notes set read_at = now() where to_user = uid and id <= p_upto and read_at is null;
  return jsonb_build_object('ok', true);
end $$;

-- everything her friends sheet shows
create or replace function public.social_inbox() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform social.sweep();
  if not social.ok(uid) then
    return jsonb_build_object('ok', false, 'why', case when social.paused(uid) is not null then 'paused' else 'off' end, 'card', social.card(uid), 'paused_until', social.paused(uid));
  end if;
  return jsonb_build_object('ok', true, 'card', social.card(uid),
    'friends', coalesce((select jsonb_agg(jsonb_build_object('handle', s.handle, 'name', s.name, 'look', s.look, 'since', f.since) order by lower(s.name))
      from public.social_friends f join public.social_profiles s on s.user_id = case when f.a = uid then f.b else f.a end
      where (f.a = uid or f.b = uid) and social.ok(s.user_id)), '[]'::jsonb),
    'asks', coalesce((select jsonb_agg(jsonb_build_object('handle', s.handle, 'name', s.name, 'look', s.look, 'hello', r.hello, 'at', r.at) order by r.at desc)
      from public.social_requests r join public.social_profiles s on s.user_id = r.from_user
      where r.to_user = uid and r.status = 'pending' and r.at > now() - interval '14 days' and social.ok(r.from_user) and not social.blocked(uid, r.from_user)), '[]'::jsonb),
    'asked', coalesce((select jsonb_agg(jsonb_build_object('handle', s.handle, 'name', s.name, 'look', s.look, 'at', r.at) order by r.at desc)
      from public.social_requests r join public.social_profiles s on s.user_id = r.to_user
      where r.from_user = uid and r.at > now() - interval '30 days'), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(x.j order by x.id desc) from (
      select n.id, jsonb_build_object('id', n.id, 'handle', s.handle, 'name', s.name, 'look', s.look, 'phrase', n.phrase, 'at', n.at, 'read', n.read_at is not null) as j
      from public.social_notes n join public.social_profiles s on s.user_id = n.from_user
      where n.to_user = uid and n.at > now() - interval '30 days'
      order by n.id desc limit 100) x), '[]'::jsonb),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'look', b.look, 'at', b.at) order by b.at desc)
      from public.social_blocks b where b.blocker = uid), '[]'::jsonb));
end $$;

-- report a card, or a note she received; optionally block in the same step
create or replace function public.social_report(p_handle uuid, p_reason text, p_note bigint default null, p_block boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); other uuid; t public.social_profiles%rowtype; me public.social_profiles%rowtype; ph text; pt text;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not social.ok(uid) then return jsonb_build_object('ok', false, 'why', 'off'); end if;
  if p_reason is null or p_reason not in ('unkind', 'spam', 'pretending', 'under18', 'worried', 'other') then return jsonb_build_object('ok', false, 'why', 'reason'); end if;
  select * into t from public.social_profiles where handle = p_handle;
  if not found or t.user_id = uid then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  other := t.user_id;
  if p_note is not null then
    select n.phrase, p.text into ph, pt from public.social_notes n join public.social_phrases p on p.id = n.phrase where n.id = p_note and n.to_user = uid and n.from_user = other;
    if ph is null then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  end if;
  if not social.hit(uid, 'report', 20, interval '1 day') then return jsonb_build_object('ok', false, 'why', 'today'); end if;
  select * into me from public.social_profiles where user_id = uid;
  insert into staff.social_reports (reporter, reporter_handle, reporter_name, target, target_handle, target_name, target_look, note_id, phrase, phrase_text, reason)
    values (uid, me.handle, me.name, other, t.handle, t.name, t.look, p_note, ph, pt, p_reason);
  if coalesce(p_block, false) then perform social.block(uid, other); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- staff: reports, reviewed through audited calls; no account ids, emails, groups or diaries ----------
create or replace function staff.social_reports_list(p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform social.sweep();
  return jsonb_build_object('at', clock_timestamp(), 'reports', coalesce((select jsonb_agg(x.j order by x.at desc) from (
    select r.at, jsonb_build_object('id', r.id, 'at', r.at, 'reason', r.reason, 'status', r.status, 'decided_at', r.decided_at, 'days', r.days,
      'card', left(r.target_handle::text, 8), 'name', r.target_name, 'look', r.target_look, 'phrase', r.phrase_text, 'about_note', r.note_id is not null,
      'from_card', left(coalesce(r.reporter_handle::text, ''), 8), 'from_name', r.reporter_name,
      'open_on_card', (select count(*) from staff.social_reports o where o.status = 'open' and o.target_handle = r.target_handle),
      'card_now', (select case when r.target is null then 'account deleted' when social.paused(r.target) is not null then 'paused' when s.user_id is null then 'no card'
                     when s.handle <> r.target_handle then 'new card' else 'active' end
                   from (select 1) z left join public.social_profiles s on s.user_id = r.target)) as j
    from staff.social_reports r where (p_status is null or r.status = p_status) order by r.at desc limit 200) x), '[]'::jsonb));
end $$;

create or replace function staff.social_decide(p_id bigint, p_decision text, p_days integer, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r staff.social_reports%rowtype; d integer;
begin
  select * into r from staff.social_reports where id = p_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'No such report.'); end if;
  if r.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'That report is already decided.'); end if;
  if p_decision = 'dismiss' then
    update staff.social_reports set status = 'dismissed', decided_at = now(), decided_by = p_actor where id = p_id;
  elsif p_decision = 'pause' then
    if r.target is null then return jsonb_build_object('ok', false, 'error', 'That account no longer exists; dismiss the report.'); end if;
    d := least(greatest(coalesce(p_days, 7), 1), 365);
    insert into public.social_holds (user_id, until) values (r.target, now() + make_interval(days => d))
      on conflict (user_id) do update set until = greatest(public.social_holds.until, excluded.until), at = now();
    update staff.social_reports set status = 'paused', decided_at = now(), decided_by = p_actor, days = d where status = 'open' and (target = r.target or target_handle = r.target_handle);
  elsif p_decision = 'remove' then
    delete from public.social_profiles where user_id = r.target and handle = r.target_handle;
    update staff.social_reports set status = 'removed', decided_at = now(), decided_by = p_actor where status = 'open' and target_handle = r.target_handle;
  else
    return jsonb_build_object('ok', false, 'error', 'Unknown decision.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_social_reports(p_status text default 'open') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_social_reports', jsonb_build_object('status', p_status)); if d is not null then return d; end if;
  return staff.social_reports_list(p_status);
end $$;

create or replace function public.admin_social_decide(p_id bigint, p_decision text, p_days integer default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_social_decide', jsonb_build_object('id', p_id, 'decision', p_decision, 'days', p_days), true); if d is not null then return d; end if;
  return staff.social_decide(p_id, p_decision, p_days, staff.caller());
end $$;

-- ---------- owners and grants ----------
alter function social.paused(uuid) owner to postgres;
alter function social.ok(uuid) owner to postgres;
alter function social.blocked(uuid, uuid) owner to postgres;
alter function social.friends(uuid, uuid) owner to postgres;
alter function social.friend_count(uuid) owner to postgres;
alter function social.present(uuid, text, uuid) owner to postgres;
alter function social.hit(uuid, text, integer, interval) owner to postgres;
alter function social.clean_name(text) owner to postgres;
alter function social.name_problem(text) owner to postgres;
alter function social.sweep() owner to postgres;
alter function social.block(uuid, uuid) owner to postgres;
alter function social.card(uuid) owner to postgres;
alter function social.on_consent() owner to postgres;
alter function staff.social_reports_list(text) owner to postgres;
alter function staff.social_decide(bigint, text, integer, uuid) owner to postgres;
alter function public.social_me() owner to postgres;
alter function public.social_card_save(text, text, boolean, boolean, integer, text, text) owner to postgres;
alter function public.social_off(integer, text) owner to postgres;
alter function public.social_people(text, uuid) owner to postgres;
alter function public.social_ask(uuid, text, uuid, text) owner to postgres;
alter function public.social_answer(uuid, boolean) owner to postgres;
alter function public.social_unfriend(uuid) owner to postgres;
alter function public.social_block(uuid) owner to postgres;
alter function public.social_unblock(uuid) owner to postgres;
alter function public.social_note(uuid, text) owner to postgres;
alter function public.social_read(bigint) owner to postgres;
alter function public.social_inbox() owner to postgres;
alter function public.social_report(uuid, text, bigint, boolean) owner to postgres;
alter function public.admin_social_reports(text) owner to rhythme_staff_fn;
alter function public.admin_social_decide(bigint, text, integer) owner to rhythme_staff_fn;

revoke all on function social.paused(uuid), social.ok(uuid), social.blocked(uuid, uuid), social.friends(uuid, uuid), social.friend_count(uuid),
  social.present(uuid, text, uuid), social.hit(uuid, text, integer, interval), social.clean_name(text), social.name_problem(text),
  social.sweep(), social.block(uuid, uuid), social.card(uuid), social.on_consent() from public, anon, authenticated;
revoke all on function staff.social_reports_list(text), staff.social_decide(bigint, text, integer, uuid) from public, anon, authenticated;
grant execute on function staff.social_reports_list(text), staff.social_decide(bigint, text, integer, uuid) to rhythme_staff_fn;
revoke all on function public.social_me(), public.social_card_save(text, text, boolean, boolean, integer, text, text), public.social_off(integer, text),
  public.social_people(text, uuid), public.social_ask(uuid, text, uuid, text), public.social_answer(uuid, boolean), public.social_unfriend(uuid),
  public.social_block(uuid), public.social_unblock(uuid), public.social_note(uuid, text), public.social_read(bigint), public.social_inbox(),
  public.social_report(uuid, text, bigint, boolean), public.admin_social_reports(text), public.admin_social_decide(bigint, text, integer) from public, anon;
grant execute on function public.social_me(), public.social_card_save(text, text, boolean, boolean, integer, text, text), public.social_off(integer, text),
  public.social_people(text, uuid), public.social_ask(uuid, text, uuid, text), public.social_answer(uuid, boolean), public.social_unfriend(uuid),
  public.social_block(uuid), public.social_unblock(uuid), public.social_note(uuid, text), public.social_read(bigint), public.social_inbox(),
  public.social_report(uuid, text, bigint, boolean), public.admin_social_reports(text), public.admin_social_decide(bigint, text, integer) to authenticated;

-- Undo:
--   drop trigger if exists consent_social_withdraw on public.consent_events;
--   drop function if exists public.admin_social_decide(bigint, text, integer), public.admin_social_reports(text),
--     public.social_report(uuid, text, bigint, boolean), public.social_inbox(), public.social_read(bigint), public.social_note(uuid, text),
--     public.social_unblock(uuid), public.social_block(uuid), public.social_unfriend(uuid), public.social_answer(uuid, boolean),
--     public.social_ask(uuid, text, uuid, text), public.social_people(text, uuid), public.social_off(integer, text),
--     public.social_card_save(text, text, boolean, boolean, integer, text, text), public.social_me(),
--     staff.social_decide(bigint, text, integer, uuid), staff.social_reports_list(text);
--   drop schema if exists social cascade;
--   drop table if exists staff.social_reports, public.social_rate, public.social_notes, public.social_blocks, public.social_friends,
--     public.social_requests, public.social_holds, public.social_profiles, public.social_words, public.social_phrases;
--   (consent events with purpose 'social' must be deleted or kept with the old check restored NOT VALID)
--   alter table public.consent_events drop constraint consent_events_purpose_check;
--   alter table public.consent_events add constraint consent_events_purpose_check check (purpose in ('health_tracking', 'cloud_sync',
--     'ai_reading', 'food_photo_ai', 'ai_summaries', 'improve_logging', 'personalisation', 'research', 'age_18')) not valid;
