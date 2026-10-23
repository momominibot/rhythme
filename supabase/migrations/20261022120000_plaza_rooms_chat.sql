-- Plaza rooms and room chat (docs/design/2026-10-22-plaza-rooms-and-live-channel.md). Written 22 Oct 2026, changed after
-- the Codex design review the same day, and checked in a transaction on the live project that rolled itself back
-- (tools/db/plaza_rooms_dryrun.sql) and in two-session races on a local copy (tools/db/race_test.py --rooms). APPLIED to
-- the live project on 23 Oct 2026 (Jamie: "whichever apple app store approve and is easy for you to deploy, then go
-- ahead"); all 32 function bodies matched this file's md5s after it ran. Chat and Wins went live the same night
-- (20261023160000_plaza_live_rooms.sql).
--
-- * Groups by stage of life, from the research note (2026-10-22-plaza-groups-research.md): PCOS becomes PCOS and
--   endometriosis, Menopause becomes Perimenopause and menopause, and After a loss and New mothers are added. Ids stay,
--   so a group a phone remembers keeps working. A full After a loss suggests no other group.
-- * Rooms by intent inside each group (Chat, Wins, Vent, Doctor visits, ...), 12 joined each. A room membership has its
--   own entry id and lives only while its group visit does, so leaving the plaza, another phone or the 75 s lapse ends it.
-- * Reading: a signed-in adult with a shown plaza card reads the rooms of the group she is in now. Writing also needs the
--   consent purpose `plaza_chat` (Room chat), asked just in time and never granted by sending.
-- * Review only: every message waits until a person on the Rhythme team shows it (`plaza_flags.mode` is held at
--   'review' by a check). The hold rules label why one needs care first: words of self-harm or crisis, treatment
--   instructions and doses, pregnancy or birth news in rooms that keep it out (After a loss, Trying to conceive). Word
--   rules cannot catch every way of telling someone to stop a medicine, so a live mode, where most messages show at once,
--   needs its own migration and its own review (Codex diff review round 4, A7). The functions keep the live branch for it.
--   The writer's phone may also ask for a hold (its warning-sign rules matched); it can never make a message show.
--   A held message is seen only by its writer ("waiting for a check") and by staff, in an audited queue.
-- * A shown message whose own words matched the crisis list carries an automatic, labelled help reminder for everyone;
--   nothing about her profile is published. There are no scripted host replies: nobody is on duty to stand behind one.
-- * Up to 280 characters, visible for 24 hours (enforced on read), deleted within an hour after that by an hourly job.
--   No links, emails, phone numbers or private-app names; a short word list for slurs and solicitation. Health words
--   ("sex", "rape", "suicide") are allowed; the plaza name list is not used for messages.
-- * Block (both ways) hides messages; paused, hidden or withdrawn authors are hidden; three reports from different people
--   hide a message at once; staff show or hide one message, or pause or remove the card through the friends reports.
--   An open report on a message is kept at most 90 days; decided reports a year, as friends reports.
-- * Locks, in one order: her account (social.lock) before the plaza membership lock (staff.plaza_sweep), then a message
--   row. Joining a room and saying take both; withdrawal and staff pauses take the account; group joins take membership.
-- * Every table is closed to the app's roles; every call is a security-definer function that checks the caller.
-- Undo: at the bottom.

-- ---------- consent purpose, rate kinds, report reasons ----------
alter table public.consent_events drop constraint if exists consent_events_purpose_check;
alter table public.consent_events add constraint consent_events_purpose_check check (purpose in ('health_tracking', 'cloud_sync', 'ai_reading', 'food_photo_ai', 'ai_summaries', 'improve_logging', 'personalisation', 'research', 'age_18', 'social', 'plaza_chat'));
alter table public.social_rate drop constraint if exists social_rate_kind_check;
alter table public.social_rate add constraint social_rate_kind_check check (kind in ('ask', 'note', 'report', 'card', 'say'));
alter table staff.social_reports drop constraint if exists social_reports_reason_check;
alter table staff.social_reports add constraint social_reports_reason_check check (reason in ('unkind', 'spam', 'pretending', 'under18', 'worried', 'other', 'advice', 'news'));
alter table staff.social_reports add column if not exists message_id bigint;
alter table staff.social_reports add column if not exists room text;
create index if not exists social_reports_message on staff.social_reports (message_id) where message_id is not null;

-- ---------- groups ----------
alter table public.plaza_servers add column if not exists quiet boolean not null default false;
update public.plaza_servers set sort = 1 where id = 'everyone';
update public.plaza_servers set name = 'PCOS and endometriosis', blurb = 'Living with PCOS or endometriosis', sort = 2 where id = 'pcos';
update public.plaza_servers set sort = 3 where id = 'trying-to-conceive';
update public.plaza_servers set name = 'Perimenopause and menopause', sort = 6 where id = 'menopause';
insert into public.plaza_servers (id, name, blurb, capacity, sort, open, general, quiet) values
  ('after-a-loss', 'After a loss', 'Pregnancy loss and grief. No pregnancy or birth news here', 24, 4, true, false, true),
  ('new-mothers', 'New mothers', 'The first year with a baby', 24, 5, true, false, false)
on conflict (id) do update set name = excluded.name, blurb = excluded.blurb, sort = excluded.sort, quiet = excluded.quiet;

-- the live plaza_join (20261019110000_plaza_visits.sql), with one change: a full quiet group suggests no other group
create or replace function public.plaza_join(p_server text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); srv public.plaza_servers%rowtype; prev_server text; n integer; fresh boolean; alt jsonb;
        t timestamptz; v_day date; v_visit uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into srv from public.plaza_servers where id = p_server;
  if not found or not srv.open then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  perform staff.plaza_sweep(); -- takes the one membership lock for the rest of this transaction
  t := clock_timestamp(); v_day := (t at time zone 'Asia/Singapore')::date;
  select server into prev_server from public.plaza_presence where user_id = uid;
  fresh := prev_server is distinct from srv.id;
  if fresh then
    select count(*) into n from public.plaza_presence where server = srv.id;
    if n >= srv.capacity then
      -- only a general group is suggested: pointing someone from one health topic to another would be wrong; and a
      -- quiet group (After a loss) suggests nothing, since the general group's Wins room may hold pregnancy news
      if not srv.quiet then
        select jsonb_build_object('id', s.id, 'name', s.name) into alt from public.plaza_servers s
          where s.open and s.general and s.id <> srv.id and (select count(*) from public.plaza_presence p where p.server = s.id) < s.capacity
          order by s.sort limit 1;
      end if;
      return jsonb_build_object('ok', false, 'why', 'full', 'server', srv.id, 'name', srv.name, 'capacity', srv.capacity, 'people', n, 'suggest', alt, 'still', prev_server);
    end if;
  end if;
  -- the same group again keeps its visit (a repeated join is harmless); a different group, or a lapsed one, is a new visit
  insert into public.plaza_presence (user_id, server, visit, joined_at, seen_at) values (uid, srv.id, gen_random_uuid(), t, t)
    on conflict (user_id) do update set
      visit = case when public.plaza_presence.server = excluded.server then public.plaza_presence.visit else excluded.visit end,
      joined_at = case when public.plaza_presence.server = excluded.server then public.plaza_presence.joined_at else excluded.joined_at end,
      server = excluded.server, seen_at = excluded.seen_at
    returning visit into v_visit;
  select count(*) into n from public.plaza_presence where server = srv.id;
  insert into staff.plaza_daily (day, server, joins, peak) values (v_day, srv.id, case when fresh then 1 else 0 end, n)
    on conflict (day, server) do update set joins = staff.plaza_daily.joins + excluded.joins, peak = greatest(staff.plaza_daily.peak, excluded.peak);
  return jsonb_build_object('ok', true, 'server', srv.id, 'name', srv.name, 'capacity', srv.capacity, 'people', n, 'visit', v_visit, 'beat_seconds', 25);
end $$;

-- ---------- rooms ----------
create table if not exists public.plaza_rooms (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,40}$'),
  server text not null references public.plaza_servers (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  blurb text not null check (char_length(blurb) <= 120),
  kind text not null check (kind in ('chat', 'wins', 'vent', 'doctor', 'topic', 'quiet')),
  capacity integer not null default 12 check (capacity between 1 and 100),
  sort integer not null default 0,
  open boolean not null default true,
  no_news boolean not null default false -- pregnancy and birth announcements are held here
);
insert into public.plaza_rooms (id, server, name, blurb, kind, sort, no_news) values
  ('everyone-chat', 'everyone', 'Chat', 'Anything on your mind today', 'chat', 1, false),
  ('everyone-wins', 'everyone', 'Wins', 'Small wins and good news, cheered on', 'wins', 2, false),
  ('everyone-vent', 'everyone', 'Vent', 'Let it out. No fixing needed', 'vent', 3, false),
  ('everyone-doctor', 'everyone', 'Doctor visits', 'Getting ready for a visit, and being heard', 'doctor', 4, false),
  ('everyone-cycle', 'everyone', 'Cycle and PMDD', 'Luteal days, PMS and PMDD. Humour welcome', 'topic', 5, false),
  ('pcos-chat', 'pcos', 'Chat', 'Day to day with PCOS or endometriosis', 'chat', 1, false),
  ('pcos-body', 'pcos', 'Body and hair', 'Hair, skin, weight and how it feels', 'topic', 2, false),
  ('pcos-doctor', 'pcos', 'Doctor visits', 'Getting ready for a visit, and being heard', 'doctor', 3, false),
  ('pcos-wins', 'pcos', 'Wins', 'Check-ins and small wins, cheered on', 'wins', 4, false),
  ('pcos-vent', 'pcos', 'Vent', 'Let it out. No fixing needed', 'vent', 5, false),
  ('ttc-chat', 'trying-to-conceive', 'Chat', 'Trying, waiting and everything between. Pregnancy news goes to Everyone, Wins', 'chat', 1, true),
  ('ttc-clinic', 'trying-to-conceive', 'Clinic and doctors', 'Appointments, tests and being heard', 'doctor', 2, true),
  ('ttc-wins', 'trying-to-conceive', 'Small wins', 'A kept appointment, a kind day. Pregnancy news goes to Everyone, Wins', 'wins', 3, true),
  ('ttc-vent', 'trying-to-conceive', 'Vent', 'Other people''s comments and hard days. No fixing needed', 'vent', 4, true),
  ('loss-quiet', 'after-a-loss', 'Quiet room', 'Say what you need to. No fixing, no advice', 'quiet', 1, true),
  ('loss-remember', 'after-a-loss', 'Remembering', 'Names, dates and the ones you carry', 'quiet', 2, true),
  ('mothers-chat', 'new-mothers', 'Chat', 'The first year, one day at a time', 'chat', 1, false),
  ('mothers-night', 'new-mothers', 'Night feeds', 'Company for the small hours', 'topic', 2, false),
  ('mothers-mind', 'new-mothers', 'Mental health', 'How you are really doing. Gently', 'topic', 3, false),
  ('mothers-wins', 'new-mothers', 'Wins', 'Small wins, cheered on', 'wins', 4, false),
  ('mothers-vent', 'new-mothers', 'Vent', 'Let it out. No fixing needed', 'vent', 5, false),
  ('meno-chat', 'menopause', 'Chat', 'Perimenopause, menopause and after', 'chat', 1, false),
  ('meno-sleep', 'menopause', 'Sleep at 3am', 'Awake again? Company here', 'topic', 2, false),
  ('meno-relationships', 'menopause', 'Relationships', 'Partners, family and libido', 'topic', 3, false),
  ('meno-treatment', 'menopause', 'HRT and treatment', 'Experiences, and getting ready for appointments', 'doctor', 4, false),
  ('meno-wins', 'menopause', 'Wins', 'Small wins, cheered on', 'wins', 5, false),
  ('meno-vent', 'menopause', 'Vent', 'Let it out. No fixing needed', 'vent', 6, false)
on conflict (id) do update set server = excluded.server, name = excluded.name, blurb = excluded.blurb, kind = excluded.kind, sort = excluded.sort, no_news = excluded.no_news;

-- she is in at most one room; the entry id names this time in this room (a late Leave cannot end a later entry)
create table if not exists public.plaza_room_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  server text not null references public.plaza_servers (id) on delete cascade,
  visit uuid not null,
  room text not null references public.plaza_rooms (id) on delete cascade,
  entry uuid not null default gen_random_uuid(),
  joined_at timestamptz not null default now()
);
create index if not exists plaza_room_presence_room on public.plaza_room_presence (room);

-- a message belongs to her plaza card, so withdrawing Plaza friends, 18+ or a removed card deletes it with the card.
-- `rev` is new on insert and on every change of status (shown, held, hidden); the feed's fingerprint covers each visible
-- id with its rev, so any change to the window, in whatever order it commits, reaches every reader (Codex diff review)
create sequence if not exists public.plaza_messages_rev_seq;
create table if not exists public.plaza_messages (
  id bigserial primary key,
  rev bigint not null default nextval('public.plaza_messages_rev_seq'),
  room text not null references public.plaza_rooms (id) on delete cascade,
  server text not null references public.plaza_servers (id) on delete cascade,
  author uuid not null references public.social_profiles (user_id) on delete cascade,
  handle uuid not null,
  name text not null,
  look text not null,
  body text not null check (char_length(body) between 1 and 280),
  status text not null check (status in ('shown', 'held', 'hidden')),
  held_why text check (held_why in ('review', 'care', 'advice', 'news', 'asked', 'reports')),
  care boolean not null default false, -- its own words matched the crisis list: shown with the help reminder
  at timestamptz not null default clock_timestamp(),
  decided_at timestamptz,
  decided_by uuid
);
create index if not exists plaza_messages_room on public.plaza_messages (room, id desc);
create index if not exists plaza_messages_at on public.plaza_messages (at);
create index if not exists plaza_messages_author on public.plaza_messages (author);
create index if not exists plaza_messages_held on public.plaza_messages (status, id) where status = 'held';
create index if not exists plaza_messages_rev on public.plaza_messages (room, rev);

-- phrases that hold a message for a person to read first (lower case, straight apostrophes, hyphens as spaces), matched
-- as whole words. 'care': self-harm and crisis; 'advice': instructions about treatment; 'med': medicines and supplements,
-- which hold a message only together with an instruction word (take, start, stop, try, use, double, ...); 'news':
-- pregnancy and birth announcements, only in rooms that keep news out. Doses and schedules hold on their own, and so
-- does any sentence that opens by telling someone to take, stop, start or try something, whatever the medicine is
-- called ("Stop citalopram", "Don't take citalopram"); 'ok': everyday kindness that opens the same way ("take care",
-- "try to rest") and clears its clause only when it is the whole clause ("take a break from citalopram" still waits). This is deliberately cautious ("I take metformin" and "Try a heat pad" wait too): a person shows it in
-- a moment, and review mode is the default. Grief ("we lost the heartbeat", "my due date would have been today",
-- "I gave birth to my son sleeping") is on no list. Staff can add or remove rows without a release.
create table if not exists public.plaza_hold_phrases (
  phrase text primary key check (phrase = lower(phrase) and char_length(phrase) between 3 and 60),
  kind text not null check (kind in ('care', 'advice', 'med', 'news', 'ok'))
);
insert into public.plaza_hold_phrases (phrase, kind) values
  ('kill myself', 'care'), ('killing myself', 'care'), ('end it all', 'care'), ('end my life', 'care'), ('take my life', 'care'), ('suicide', 'care'),
  ('suicidal', 'care'), ('want to die', 'care'), ('wanna die', 'care'), ('don''t want to be here', 'care'), ('dont want to be here', 'care'),
  ('do not want to be here', 'care'), ('don''t want to live', 'care'), ('dont want to live', 'care'), ('hurt myself', 'care'), ('harm myself', 'care'),
  ('self harm', 'care'), ('cutting myself', 'care'), ('overdose', 'care'), ('no reason to live', 'care'), ('better off without me', 'care'),
  ('hurt my baby', 'care'), ('harm my baby', 'care'),
  ('stop your', 'advice'), ('stop taking your', 'advice'), ('come off your', 'advice'), ('double your', 'advice'), ('double the dose', 'advice'),
  ('instead of your doctor', 'advice'), ('don''t listen to your doctor', 'advice'), ('dont listen to your doctor', 'advice'),
  ('no need for a doctor', 'advice'), ('don''t take your', 'advice'), ('dont take your', 'advice'), ('skip your', 'advice'), ('cures pcos', 'advice'),
  ('cure for', 'advice'), ('buy it from', 'advice'),
  ('ibuprofen', 'med'), ('paracetamol', 'med'), ('acetaminophen', 'med'), ('panadol', 'med'), ('aspirin', 'med'), ('naproxen', 'med'),
  ('mefenamic', 'med'), ('ponstan', 'med'), ('tranexamic', 'med'), ('codeine', 'med'), ('tramadol', 'med'), ('metformin', 'med'),
  ('letrozole', 'med'), ('clomid', 'med'), ('clomiphene', 'med'), ('progesterone', 'med'), ('estrogen', 'med'), ('oestrogen', 'med'),
  ('estradiol', 'med'), ('oestradiol', 'med'), ('testosterone', 'med'), ('hrt', 'med'), ('inositol', 'med'), ('spironolactone', 'med'),
  ('vitex', 'med'), ('berberine', 'med'), ('semaglutide', 'med'), ('ozempic', 'med'), ('wegovy', 'med'), ('tirzepatide', 'med'),
  ('mounjaro', 'med'), ('sertraline', 'med'), ('fluoxetine', 'med'), ('antidepressant', 'med'), ('antidepressants', 'med'),
  ('the pill', 'med'), ('supplement', 'med'), ('supplements', 'med'), ('pills', 'med'), ('tablets', 'med'), ('painkillers', 'med'),
  ('insulin', 'med'), ('antibiotic', 'med'), ('antibiotics', 'med'), ('medication', 'med'), ('medications', 'med'), ('medicine', 'med'),
  ('medicines', 'med'), ('meds', 'med'), ('drug', 'med'), ('drugs', 'med'), ('dose', 'med'), ('doses', 'med'), ('steroid', 'med'),
  ('steroids', 'med'), ('birth control', 'med'), ('contraceptive', 'med'), ('contraceptives', 'med'), ('hormones', 'med'),
  ('vitamin', 'med'), ('vitamins', 'med'), ('melatonin', 'med'), ('magnesium', 'med'), ('folic acid', 'med'), ('ashwagandha', 'med'),
  ('cbd', 'med'), ('antihistamine', 'med'), ('antihistamines', 'med'), ('laxative', 'med'), ('laxatives', 'med'), ('prednisone', 'med'),
  ('levothyroxine', 'med'), ('misoprostol', 'med'), ('mifepristone', 'med'),
  ('take care', 'ok'), ('take it easy', 'ok'), ('take your time', 'ok'), ('take a break', 'ok'), ('take a breath', 'ok'),
  ('take a deep breath', 'ok'), ('take a nap', 'ok'), ('take a rest', 'ok'), ('take a moment', 'ok'), ('take a minute', 'ok'),
  ('take it slow', 'ok'), ('take it one day at a time', 'ok'), ('take each day as it comes', 'ok'), ('take care of yourself', 'ok'),
  ('try to rest', 'ok'), ('try to sleep', 'ok'), ('try to relax', 'ok'), ('try again', 'ok'), ('try your best', 'ok'),
  ('stop blaming yourself', 'ok'), ('stop being so hard on yourself', 'ok'), ('start small', 'ok'), ('take it personally', 'ok'), ('stop trying', 'ok'),
  ('i''m pregnant', 'news'), ('im pregnant', 'news'), ('i am pregnant', 'news'), ('we''re pregnant', 'news'), ('we are pregnant', 'news'),
  ('i''m expecting', 'news'), ('i am expecting', 'news'), ('we''re expecting', 'news'), ('we are expecting', 'news'), ('bfp', 'news'),
  ('big fat positive', 'news'), ('got my positive', 'news'), ('it''s a girl', 'news'), ('it''s a boy', 'news'), ('its a girl', 'news'),
  ('its a boy', 'news'), ('gender reveal', 'news'), ('pregnancy announcement', 'news'), ('birth announcement', 'news'), ('baby is here', 'news')
on conflict (phrase) do update set kind = excluded.kind;

-- words refused in messages: slurs, sexual solicitation and private messaging apps (contact). Ordinary swearing and
-- body words are allowed: venting is what Vent is for.
create table if not exists public.plaza_words (word text primary key check (word = lower(word)), kind text not null check (kind in ('word', 'contact')));
insert into public.plaza_words (word, kind) values
  ('cunt', 'word'), ('whore', 'word'), ('slut', 'word'), ('nudes', 'word'), ('onlyfans', 'word'), ('porn', 'word'), ('nazi', 'word'), ('hitler', 'word'),
  ('telegram', 'contact'), ('whatsapp', 'contact'), ('kik', 'contact'), ('wechat', 'contact'), ('discord', 'contact'), ('snapchat', 'contact')
on conflict (word) do update set kind = excluded.kind;

-- switches: chat on or off (a missing row reads as off) and the mode, held at 'review' (see the top of this file)
create table if not exists public.plaza_flags (key text primary key check (key in ('chat', 'mode')), value text not null,
  constraint plaza_flags_review_only check (key <> 'mode' or value = 'review'));
insert into public.plaza_flags (key, value) values ('chat', 'on'), ('mode', 'review') on conflict (key) do nothing;

alter table public.plaza_rooms enable row level security;
alter table public.plaza_room_presence enable row level security;
alter table public.plaza_messages enable row level security;
alter table public.plaza_hold_phrases enable row level security;
alter table public.plaza_words enable row level security;
alter table public.plaza_flags enable row level security;
revoke all on table public.plaza_rooms, public.plaza_room_presence, public.plaza_messages, public.plaza_hold_phrases, public.plaza_words,
  public.plaza_flags from public, anon, authenticated;
revoke all on sequence public.plaza_messages_id_seq, public.plaza_messages_rev_seq from public, anon, authenticated;

-- ---------- helpers (schema plaza, callable only by the functions below) ----------
create schema if not exists plaza;
revoke all on schema plaza from public;

create or replace function plaza.chat_on() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select f.value = 'on' from public.plaza_flags f where f.key = 'chat'), false)
$$;
create or replace function plaza.live() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select f.value = 'live' from public.plaza_flags f where f.key = 'mode'), false)
$$;

-- why she cannot read the rooms, or null: 18+ not on record, paused, no card or Plaza friends off, card hidden
create or replace function plaza.read_problem(p_uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_uid is null then 'signin'
    when not public.consent_allows(p_uid, 'age_18') then 'adult'
    when social.paused(p_uid) is not null then 'paused'
    when not public.consent_allows(p_uid, 'social') or not exists (select 1 from public.social_profiles s where s.user_id = p_uid) then 'card'
    when exists (select 1 from public.social_profiles s where s.user_id = p_uid and s.hidden) then 'hidden'
    else null end
$$;
create or replace function plaza.can_read(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select plaza.read_problem(p_uid) is null
$$;

-- in the group now, on this visit (the plaza's own 75 s rule)
create or replace function plaza.here(p_uid uuid, p_server text, p_visit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_visit is not null and social.present(p_uid, p_server, p_visit)
$$;

-- joined a room now: a room membership counts while its own group visit is still present. A hidden or paused card keeps
-- its place, so showing it again can never put a room over its capacity (Codex diff review round 3)
create or replace function plaza.room_count(p_room text) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.plaza_room_presence r join public.plaza_presence p on p.user_id = r.user_id and p.server = r.server and p.visit = r.visit
  where r.room = p_room and p.seen_at > clock_timestamp() - interval '75 seconds'
$$;

-- the text as the phrase lists see it: lower case, straight apostrophes, anything else a space, padded with spaces
create or replace function plaza.flat(p_body text) returns text
language sql immutable security definer set search_path = '' as $$
  select ' ' || btrim(regexp_replace(regexp_replace(lower(translate(coalesce(p_body, ''), '’‘', '''''')), '[^a-z0-9'']+', ' ', 'g'), '\s+', ' ', 'g')) || ' '
$$;

-- every top-level domain of three or more letters (IANA list, 23 Oct 2026; ovu-rooms.js TLDS is the same string)
create or replace function plaza.tlds() returns text
language sql immutable security definer set search_path = '' as $$
  select ' aaa aarp abb abbott abbvie abc able abogado abudhabi academy accenture accountant accountants aco actor ads adult aeg aero aetna afl africa agakhan agency aig airbus airforce airtel akdn alibaba alipay allfinanz allstate ally alsace alstom amazon americanexpress americanfamily amex amfam amica amsterdam analytics android anquan anz aol apartments app apple aquarelle arab aramco archi army arpa art arte asda asia associates athleta attorney auction audi audible audio auspost author auto autos aws axa azure baby baidu banamex band bank bar barcelona barclaycard barclays barefoot bargains baseball basketball bauhaus bayern bbc bbt bbva bcg bcn beats beauty beer berlin best bestbuy bet bharti bible bid bike bing bingo bio biz black blackfriday blockbuster blog bloomberg blue bms bmw bnpparibas boats boehringer bofa bom bond boo book booking bosch bostik boston bot boutique box bradesco bridgestone broadway broker brother brussels build builders business buy buzz bzh cab cafe cal call calvinklein cam camera camp canon capetown capital capitalone car caravan cards care career careers cars casa case cash casino cat catering catholic cba cbn cbre center ceo cern cfa cfd chanel channel charity chase chat cheap chintai christmas chrome church cipriani circle cisco citadel citi citic city claims cleaning click clinic clinique clothing cloud club clubmed coach codes coffee college cologne com commbank community company compare computer comsec condos construction consulting contact contractors cooking cool coop corsica country coupon coupons courses cpa credit creditcard creditunion cricket crown crs cruise cruises cuisinella cymru cyou dad dance data date dating datsun day dclk dds deal dealer deals degree delivery dell deloitte delta democrat dental dentist desi design dev dhl diamonds diet digital direct directory discount discover dish diy dnp docs doctor dog domains dot download drive dtv dubai dupont durban dvag dvr earth eat eco edeka edu education email emerck energy engineer engineering enterprises epson equipment ericsson erni esq estate eurovision eus events exchange expert exposed express extraspace fage fail fairwinds faith family fan fans farm farmers fashion fast fedex feedback ferrari ferrero fidelity fido film final finance financial fire firestone firmdale fish fishing fit fitness flickr flights flir florist flowers fly foo food football ford forex forsale forum foundation fox free fresenius frl frogans frontier ftr fujitsu fun fund furniture futbol fyi gal gallery gallo gallup game games gap garden gay gbiz gdn gea gent genting george ggee gift gifts gives giving glass gle global globo gmail gmbh gmo gmx godaddy gold goldpoint golf goodyear goog google gop got gov grainger graphics gratis green gripe grocery group gucci guge guide guitars guru hair hamburg hangout haus hbo hdfc hdfcbank health healthcare help helsinki here hermes hiphop hisamitsu hitachi hiv hkt hockey holdings holiday homedepot homegoods homes homesense honda horse hospital host hosting hot hotels hotmail house how hsbc hughes hyatt hyundai ibm icbc ice icu ieee ifm ikano imamat imdb immo immobilien inc industries infiniti info ing ink institute insurance insure int international intuit investments ipiranga irish ismaili ist istanbul itau itv jaguar java jcb jeep jetzt jewelry jio jll jmp jnj jobs joburg jot joy jpmorgan jprs juegos kaufen kddi kerryhotels kerryproperties kfh kia kids kim kindle kitchen kiwi koeln komatsu kosher kpmg kpn krd kred kuokgroup kyoto lacaixa lamborghini lamer land landrover lanxess lasalle lat latino latrobe law lawyer lds lease leclerc lefrak legal lego lexus lgbt lidl life lifeinsurance lifestyle lighting like lilly limited limo lincoln link live living llc llp loan loans locker locus lol london lotte lotto love lpl lplfinancial ltd ltda lundbeck luxe luxury madrid maif maison makeup man management mango map market marketing markets marriott marshalls mattel mba mckinsey med media meet melbourne meme memorial men menu merck merckmsd miami microsoft mil mini mint mit mitsubishi mlb mls mma mobi mobile moda moe moi mom monash money monster mormon mortgage moscow moto motorcycles mov movie msd mtn mtr museum music nab nagoya name navy nba nec net netbank netflix network neustar new news next nextdirect nexus nfl ngo nhk nico nike nikon ninja nissan nissay nokia norton now nowruz nowtv nra nrw ntt nyc obi observer office okinawa olayan olayangroup ollo omega one ong onl online ooo open oracle orange org organic origins osaka otsuka ott ovh page panasonic paris pars partners parts party pay pccw pet pfizer pharmacy phd philips phone photo photography photos physio pics pictet pictures pid pin ping pink pioneer pizza place play playstation plumbing plus pnc pohl poker politie porn post praxi press prime pro prod productions prof progressive promo properties property protection pru prudential pub pwc qpon quebec quest racing radio read realestate realtor realty recipes red redumbrella rehab reise reisen reit reliance ren rent rentals repair report republican rest restaurant review reviews rexroth rich richardli ricoh ril rio rip rocks rodeo rogers room rsvp rugby ruhr run rwe ryukyu saarland safe safety sakura sale salon samsclub samsung sandvik sandvikcoromant sanofi sap sarl sas save saxo sbi sbs scb schaeffler schmidt scholarships school schule schwarz science scot search seat secure security seek select sener services seven sew sex sexy sfr shangrila sharp shell shia shiksha shoes shop shopping shouji show silk sina singles site ski skin sky skype sling smart smile sncf soccer social softbank software sohu solar solutions song sony soy spa space sport spot srl stada staples star statebank statefarm stc stcgroup stockholm storage store stream studio study style sucks supplies supply support surf surgery suzuki swatch swiss sydney systems tab taipei talk taobao target tatamotors tatar tattoo tax taxi tci tdk team tech technology tel temasek tennis teva thd theater theatre tiaa tickets tienda tips tires tirol tjmaxx tjx tkmaxx tmall today tokyo tools top toray toshiba total tours town toyota toys trade trading training travel travelers travelersinsurance trust trv tube tui tunes tushu tvs ubank ubs unicom university uno uol ups vacations vana vanguard vegas ventures verisign versicherung vet viajes video vig viking villas vin vip virgin visa vision viva vivo vlaanderen vodka volvo vote voting voto voyage wales walmart walter wang wanggou watch watches weather weatherchannel web webcam weber website wed wedding weibo weir whoswho wien wiki williamhill win windows wine winners wme woodside work works world wow wtc wtf xbox xerox xihuan xin xxx xyz yachts yahoo yamaxun yandex yodobashi yoga yokohama you youtube yun zappos zara zero zip zone zuerich '::text
$$;
-- dates (2026-10-22, 23.10.2026) set aside before digits are counted: a date is never part of a phone number
create or replace function plaza.undate(p_text text) returns text
language sql immutable security definer set search_path = '' as $$
  select regexp_replace(coalesce(p_text, ''), '(?<![0-9.])([0-9]{4}[-.](0?[1-9]|1[0-2])[-.](0?[1-9]|[12][0-9]|3[01])|(0?[1-9]|[12][0-9]|3[01])[-.](0?[1-9]|1[0-2])[-.]([0-9]{4}|[0-9]{2}))(?![0-9])', ' ', 'g')
$$;
-- a web address anywhere in her words, in any case: a name of two or more before a listed ending, or three or more
-- before a two-letter one (so a missed space, "it.in my back", stays a sentence; Codex diff review round 5, A10)
create or replace function plaza.has_host(p_text text) returns boolean
language plpgsql immutable security definer set search_path = '' as $$
declare tok text; parts text[]; i integer; tld text; prev text;
begin
  foreach tok in array regexp_split_to_array(coalesce(p_text, ''), '[^A-Za-z0-9.-]+') loop
    parts := string_to_array(regexp_replace(tok, '^[.-]+|[.-]+$', '', 'g'), '.');
    for i in 2 .. coalesce(array_length(parts, 1), 0) loop
      tld := lower(parts[i]); prev := parts[i - 1];
      if tld ~ '^[a-z]{2,24}$' and prev ~ '^[A-Za-z0-9-]+$'
         and ((char_length(tld) = 2 and char_length(prev) >= 3)
              or (char_length(tld) >= 3 and (char_length(prev) >= 2 or lower(prev) not in ('i', 'a')) and position(' ' || tld || ' ' in plaza.tlds()) > 0)) then
        return true;
      end if;
    end loop;
  end loop;
  return false;
end $$;

-- what a message may not carry, or null; the phone runs the same rules first (ovu-rooms.js textProblem)
create or replace function plaza.text_problem(p_body text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare t text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g')); low text; nd text; bare text; tok text; run text; k text;
begin
  if t = '' then return 'empty'; end if;
  if char_length(t) > 280 then return 'long'; end if;
  low := lower(translate(t, '’‘', ''''''));
  -- contact details first, on all of her words, so no exception can hide one (Codex diff review round 4, B3 and B4)
  if low ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' or low ~ '(^|[^a-z0-9])@[a-z0-9_.]{2,}' then return 'contact'; end if;
  -- a number with a country code is a phone number whatever its digits look like (+45 20-12-2012; round 6), but a plus
  -- right after a digit is a pregnancy week (12+3), not a country code (round 7)
  for run in select m[1] from regexp_matches(low, '(?<![0-9])(\+[0-9][0-9 ().-]*[0-9])', 'g') as m loop
    if char_length(regexp_replace(run, '[^0-9]', '', 'g')) >= 7 then return 'contact'; end if;
  end loop;
  nd := plaza.undate(low);
  for run in select m[1] from regexp_matches(nd, '(\+?[0-9][0-9 ().-]*[0-9])', 'g') as m loop
    if char_length(regexp_replace(run, '[^0-9]', '', 'g')) >= 8 then return 'contact'; end if;
  end loop;
  if nd ~ '(^|[^0-9])[0-9]{3}[ .-][0-9]{4}($|[^0-9])' then return 'contact'; end if;
  -- contact grammar ("call me on", "my number is", or a bare "call", "text") with a number of five digits or more right
  -- after it, at most one word between ("after the phone call I managed 10000 steps" is not one; round 6)
  for run in select m[1] from regexp_matches(nd, '\y(?:(?:call|text|ring|phone|whatsapp|sms|msg|message|reach|contact|email|e-mail|telegram|wechat|signal|line|add|find) me|my (?:phone number|number|no|phone|hp|handphone|mobile|cell|contact|whatsapp|telegram|wechat|line|insta|ig|email|e-mail|handle|id)|call|text|ring|dial|sms|whatsapp|phone)\y[^0-9a-z+]*(?:[a-z'']+[^0-9a-z+]+)?(\+?[0-9][0-9 ().-]*[0-9])', 'g') as m loop
    if char_length(regexp_replace(run, '[^0-9]', '', 'g')) >= 5 then return 'contact'; end if;
  end loop;
  if low ~ '\y(dm|pm|message|add) me\y' or low ~ '\ymy (number|handle|ig|insta) is\y' then return 'contact'; end if;
  -- then links: the help card's one address is set aside exactly (its own host, nothing before it, no further label
  -- after it: findahelpline.com.evil.scot stays an address; round 5, B3); any other web address counts
  bare := regexp_replace(t, '(^|[^a-z0-9.@_-])(https?://)?(www\.)?findahelpline\.com(/[a-z0-9/_-]*)?(?=$|[^a-z0-9@_.-]|\.($|[^a-z0-9]))', '\1 ', 'gi');
  if lower(translate(bare, '’‘', '''''')) ~ '(https?:|www\.|[a-z0-9-]+\.[a-z]{2,}/[a-z0-9])' or plaza.has_host(bare) then return 'link'; end if;
  foreach tok in array regexp_split_to_array(low, '[^a-z0-9]+') loop
    if tok <> '' then
      select w.kind into k from public.plaza_words w where w.word = tok;
      if k is not null then return k; end if;
    end if;
  end loop;
  return null;
end $$;

-- why a message waits for a person to read it first, or null; 'care' first, so the help reminder follows the crisis words
create or replace function plaza.hold_why(p_body text, p_no_news boolean) returns text
language plpgsql stable security definer set search_path = '' as $$
declare f text := plaza.flat(p_body); cl text; c text;
begin
  if exists (select 1 from public.plaza_hold_phrases h where h.kind = 'care' and position(' ' || replace(h.phrase, '-', ' ') || ' ' in f) > 0) then return 'care'; end if;
  if exists (select 1 from public.plaza_hold_phrases h where h.kind = 'advice' and position(' ' || h.phrase || ' ' in f) > 0)
     or f ~ ' [0-9]+ ?(mg|mcg|iu|ml|g|tablets?|pills?|capsules?|caps|drops?|puffs?|units?) '
     or f ~ ' every [0-9]+ ?(hours?|hrs?|h|days?) ' or f ~ ' ([0-9]+|once|twice|three|four) times? (a|per) day ' or f ~ ' (once|twice) (a|per) day '
     or (exists (select 1 from public.plaza_hold_phrases h where h.kind = 'med' and position(' ' || h.phrase || ' ' in f) > 0)
         and f ~ ' (take|taking|start|starting|stop|stopping|try|use|double|increase|up|skip|quit|buy|swap|switch|avoid|reduce|lower|halve|drop|cut|add) ') then return 'advice'; end if;
  -- a clause that tells someone to take, stop, start or try something, whatever it is called (Codex diff review round 3):
  -- what leads in ("honestly", "you should", "the nurse said you could") is set aside, a "don't" or "never" too, and an
  -- everyday kindness clears its clause only when it is the whole clause (round 4, A7)
  foreach cl in array regexp_split_to_array(lower(translate(coalesce(p_body, ''), '’‘', '''''')), '[.!?;:,\n]+') loop
    c := regexp_replace(plaza.flat(cl), '^ ((i think|honestly|so|and|but|just|please|maybe|definitely|really|seriously|i would|i d|you (should|must|need to|have to|could|can|might want to|gotta|ought to)) )+', ' ');
    c := regexp_replace(c, '^.*? you (should|must|need to|have to|gotta|ought to|could|can|might want to) ', ' ');
    c := regexp_replace(c, '^ (don''t|dont|do not|never) ', ' ');
    if c ~ '^ (take|stop|start|quit|skip|double|halve|increase|decrease|reduce|lower|switch|swap|avoid|try|use|buy|come off|go off|get off) [a-z0-9]'
       and not exists (select 1 from public.plaza_hold_phrases h where h.kind = 'ok' and position(' ' || h.phrase || ' ' in c) = 1
                       and substr(c, char_length(h.phrase) + 2) ~ '^ ((today|tonight|now|please|ok|okay|x|xx|xxx|love|lovely|dear|hun|hon|mama|ladies|everyone|all|friend|friends|sis|babe|girl|girls|too) )*$') then
      return 'advice';
    end if;
  end loop;
  if coalesce(p_no_news, false) and exists (select 1 from public.plaza_hold_phrases h where h.kind = 'news' and position(' ' || h.phrase || ' ' in f) > 0) then return 'news'; end if;
  return null;
end $$;

-- one message every 3 s, 30 an hour, 150 a day; counted in social_rate, one row per message said
create or replace function plaza.say_rate(p_uid uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare t timestamptz := clock_timestamp();
begin
  if exists (select 1 from public.social_rate r where r.user_id = p_uid and r.kind = 'say' and r.at > t - interval '3 seconds') then return 'fast'; end if;
  if (select count(*) from public.social_rate r where r.user_id = p_uid and r.kind = 'say' and r.at > t - interval '1 hour') >= 30 then return 'hour'; end if;
  if (select count(*) from public.social_rate r where r.user_id = p_uid and r.kind = 'say' and r.at > t - interval '1 day') >= 150 then return 'day'; end if;
  insert into public.social_rate (user_id, kind, at) values (p_uid, 'say', t);
  return null;
end $$;

-- 24 hours for messages; room memberships whose visit has gone; open message reports after 90 days
create or replace function plaza.sweep() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.plaza_messages where at < clock_timestamp() - interval '24 hours';
  delete from public.plaza_room_presence r where not exists (select 1 from public.plaza_presence p where p.user_id = r.user_id and p.server = r.server and p.visit = r.visit);
  delete from staff.social_reports where message_id is not null and status = 'open' and at < clock_timestamp() - interval '90 days';
end $$;

-- a message as a reader sees it (her own held message says so; nobody else ever receives one)
create or replace function plaza.row(m public.plaza_messages, p_viewer uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'rev', m.rev, 'at', m.at, 'body', m.body, 'care', m.care and m.status = 'shown', 'mine', m.author = p_viewer,
    'held', m.status = 'held', 'handle', m.handle, 'name', m.name, 'look', m.look)
$$;

-- visible to this reader: shown (or her own and held), within 24 h, its author still eligible and not blocked either way
create or replace function plaza.shows(m public.plaza_messages, p_viewer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select m.at > clock_timestamp() - interval '24 hours'
    and ((m.status = 'shown' and plaza.can_read(m.author) and not social.blocked(p_viewer, m.author)) or (m.status = 'held' and m.author = p_viewer))
$$;

-- withdrawing Room chat deletes her messages at once. Withdrawing Plaza friends or 18+ deletes her card (social.on_consent)
-- and with it her messages; here it also ends her room and her Room chat, so a new card needs a fresh yes to chat.
create or replace function plaza.on_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.action = 'withdraw' and new.purpose in ('plaza_chat', 'social', 'age_18') then
    perform social.lock(new.user_id); -- waits for any call in flight for her account
    delete from public.plaza_messages where author = new.user_id;
    if new.purpose <> 'plaza_chat' then
      delete from public.plaza_room_presence where user_id = new.user_id;
      if public.consent_allows(new.user_id, 'plaza_chat') then
        insert into public.consent_events (user_id, purpose, action, notice_version, method, client_at)
          values (new.user_id, 'plaza_chat', 'withdraw', new.notice_version, 'server', now());
      end if;
    end if;
  end if;
  return new;
end $$;
-- a Room chat yes is recorded only by plaza_chat_on (its own form, card and history checks); the general consent call may
-- still record a withdrawal (Codex diff review, 13)
create or replace function plaza.guard_chat_grant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.purpose = 'plaza_chat' and new.action = 'grant' and coalesce(current_setting('plaza.chat_on', true), '') <> 'yes' then
    raise exception 'Room chat is turned on from the rooms' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists consent_plaza_chat_grant_guard on public.consent_events;
create trigger consent_plaza_chat_grant_guard before insert on public.consent_events for each row execute function plaza.guard_chat_grant();
drop trigger if exists consent_plaza_chat_withdraw on public.consent_events;
create trigger consent_plaza_chat_withdraw after insert on public.consent_events for each row execute function plaza.on_consent();

-- ---------- the person's calls ----------
-- the rooms of her group with their counts, her room and entry, what she may do, and the mode
create or replace function public.plaza_rooms_list(p_server text, p_visit uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); mine public.plaza_room_presence%rowtype; why text; chat_ev bigint;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform plaza.sweep();
  if not plaza.here(uid, p_server, p_visit) then return jsonb_build_object('ok', false, 'why', 'not_here'); end if;
  why := plaza.read_problem(uid);
  if why = 'adult' then return jsonb_build_object('ok', true, 'server', p_server, 'read', false, 'why', why, 'rooms', '[]'::jsonb); end if;
  select * into mine from public.plaza_room_presence r where r.user_id = uid and r.server = p_server and r.visit = p_visit;
  select max(id) into chat_ev from public.consent_events where user_id = uid and purpose = 'plaza_chat';
  return jsonb_build_object('ok', true, 'server', p_server, 'room', mine.room, 'entry', mine.entry, 'chat_on', plaza.chat_on(), 'mode', case when plaza.live() then 'live' else 'review' end,
    'read', why is null, 'why', why, 'talk', why is null and public.consent_allows(uid, 'plaza_chat'), 'chat_event', chat_ev,
    'card', (select s.handle from public.social_profiles s where s.user_id = uid),
    'rooms', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'blurb', r.blurb, 'kind', r.kind, 'capacity', r.capacity,
        'open', r.open and s.open and plaza.chat_on(), 'no_news', r.no_news, 'people', plaza.room_count(r.id),
        'last_at', (select max(m.at) from public.plaza_messages m where m.room = r.id and m.status = 'shown' and plaza.shows(m, uid))) order by r.sort), '[]'::jsonb)
      from public.plaza_rooms r join public.plaza_servers s on s.id = r.server where r.server = p_server));
end $$;

-- join a room of her group: her account, then the membership lock (capacity); the same room again keeps its entry, so a
-- retried join is harmless; another room is a new entry. A full room names the rooms in the group with space.
create or replace function public.plaza_room_join(p_server text, p_visit uuid, p_room text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.plaza_rooms%rowtype; srv_open boolean; n integer; why text; alt jsonb; e uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform social.lock(uid);
  perform staff.plaza_sweep(); -- the one membership lock, for the rest of this transaction
  perform plaza.sweep();
  if not plaza.here(uid, p_server, p_visit) then return jsonb_build_object('ok', false, 'why', 'not_here'); end if;
  why := plaza.read_problem(uid);
  if why is not null then return jsonb_build_object('ok', false, 'why', why); end if;
  select * into r from public.plaza_rooms where id = p_room and server = p_server;
  select s.open into srv_open from public.plaza_servers s where s.id = p_server;
  if r.id is null or not r.open or not coalesce(srv_open, false) or not plaza.chat_on() then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  select x.entry into e from public.plaza_room_presence x where x.user_id = uid and x.room = r.id and x.server = p_server and x.visit = p_visit;
  if e is not null then return jsonb_build_object('ok', true, 'room', r.id, 'entry', e, 'people', plaza.room_count(r.id), 'capacity', r.capacity); end if;
  n := plaza.room_count(r.id);
  if n >= r.capacity then
    select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.sort), '[]'::jsonb) into alt from public.plaza_rooms o
      where o.server = p_server and o.id <> r.id and o.open and plaza.room_count(o.id) < o.capacity;
    return jsonb_build_object('ok', false, 'why', 'full', 'room', r.id, 'name', r.name, 'people', n, 'capacity', r.capacity, 'suggest', alt);
  end if;
  insert into public.plaza_room_presence (user_id, server, visit, room, entry, joined_at) values (uid, p_server, p_visit, r.id, gen_random_uuid(), clock_timestamp())
    on conflict (user_id) do update set server = excluded.server, visit = excluded.visit, room = excluded.room, entry = excluded.entry, joined_at = excluded.joined_at
    returning entry into e;
  return jsonb_build_object('ok', true, 'room', r.id, 'entry', e, 'people', plaza.room_count(r.id), 'capacity', r.capacity);
end $$;

-- leave the room this entry names (the group membership stays)
create or replace function public.plaza_room_leave(p_entry uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_entry is null then return jsonb_build_object('ok', false, 'why', 'entry'); end if;
  delete from public.plaza_room_presence where user_id = uid and entry = p_entry;
  return jsonb_build_object('ok', true);
end $$;

-- a room's latest messages, read-only, for anyone who may read in that group (a peek or the room she is in). Each look
-- reads the whole visible window (the latest 40) in one statement, so ids, rows and fingerprint share one snapshot.
-- `seen` fingerprints the window (each id with its rev): a phone that sends the one it has gets `same` and no rows when
-- nothing changed, and the whole window, every row as it is now, when anything did (a new message, one shown after a
-- check, hidden, blocked, withdrawn or expired), in whatever order those changes committed (Codex diff review round 2)
create or replace function public.plaza_room_feed(p_server text, p_visit uuid, p_room text, p_seen text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); why text; r public.plaza_rooms%rowtype; e uuid; v_rows jsonb; v_ids jsonb; v_seen text;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform social.lock(uid); -- a withdrawal or pause of her account cannot land between these checks and the rows
  perform pg_advisory_xact_lock_shared(hashtext('plaza:membership')); -- nor a group move (shared: readers never wait on each other)
  if not plaza.here(uid, p_server, p_visit) then return jsonb_build_object('ok', false, 'why', 'not_here'); end if;
  why := plaza.read_problem(uid);
  if why is not null then return jsonb_build_object('ok', false, 'why', why); end if;
  select * into r from public.plaza_rooms where id = p_room and server = p_server;
  if r.id is null then return jsonb_build_object('ok', false, 'why', 'closed'); end if;
  with w as (select m from public.plaza_messages m where m.room = r.id and plaza.shows(m, uid) order by m.id desc limit 40)
  select coalesce(jsonb_agg(plaza.row(w.m, uid) order by (w.m).id), '[]'::jsonb), coalesce(jsonb_agg((w.m).id order by (w.m).id), '[]'::jsonb),
         md5(coalesce(string_agg((w.m).id::text || '.' || (w.m).rev::text, ',' order by (w.m).id), ''))
    into v_rows, v_ids, v_seen from w;
  select x.entry into e from public.plaza_room_presence x where x.user_id = uid and x.room = r.id and x.server = p_server and x.visit = p_visit;
  return jsonb_build_object('ok', true, 'room', r.id, 'people', plaza.room_count(r.id), 'capacity', r.capacity, 'mode', case when plaza.live() then 'live' else 'review' end,
    'open', r.open and plaza.chat_on() and coalesce((select s.open from public.plaza_servers s where s.id = p_server), false),
    'joined', e is not null, 'entry', e, 'ids', v_ids, 'seen', v_seen, 'same', coalesce(v_seen = p_seen, false),
    'messages', case when v_seen = p_seen then '[]'::jsonb else v_rows end);
end $$;

-- say something in the room her entry names. p_hold: her phone's warning-sign rules matched and she chose to send it for
-- a check; it can only hold a message, never show one.
create or replace function public.plaza_say(p_entry uuid, p_body text, p_hold boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); why text; hold text; rp public.plaza_room_presence%rowtype; r public.plaza_rooms%rowtype; card public.social_profiles%rowtype;
        v_body text; m public.plaza_messages%rowtype;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform social.lock(uid); -- withdrawal, staff pauses and her other calls wait for this one
  perform staff.plaza_sweep(); -- then the membership lock: another phone cannot take her visit between this check and the write
  why := plaza.read_problem(uid);
  if why is not null then return jsonb_build_object('ok', false, 'why', why); end if;
  if not public.consent_allows(uid, 'plaza_chat') then return jsonb_build_object('ok', false, 'why', 'notice'); end if;
  select * into rp from public.plaza_room_presence x where x.user_id = uid and x.entry = p_entry;
  if rp.user_id is null or not plaza.here(uid, rp.server, rp.visit) then return jsonb_build_object('ok', false, 'why', 'not_in_room'); end if;
  select * into r from public.plaza_rooms where id = rp.room;
  if not r.open or not plaza.chat_on() or not coalesce((select s.open from public.plaza_servers s where s.id = rp.server), false) then
    return jsonb_build_object('ok', false, 'why', 'closed');
  end if;
  why := plaza.text_problem(p_body);
  if why is not null then return jsonb_build_object('ok', false, 'why', 'text', 'problem', why); end if;
  v_body := btrim(regexp_replace(p_body, '\s+', ' ', 'g'));
  if exists (select 1 from (select x.body from public.plaza_messages x where x.author = uid and x.room = r.id and x.at > clock_timestamp() - interval '10 minutes'
             order by x.id desc limit 1) last where lower(last.body) = lower(v_body)) then
    return jsonb_build_object('ok', false, 'why', 'same');
  end if;
  why := plaza.say_rate(uid);
  if why is not null then return jsonb_build_object('ok', false, 'why', why); end if;
  hold := plaza.hold_why(v_body, r.no_news);
  if hold is null and coalesce(p_hold, false) then hold := 'asked'; end if;
  if hold is null and not plaza.live() then hold := 'review'; end if;
  select * into card from public.social_profiles where user_id = uid;
  insert into public.plaza_messages (room, server, author, handle, name, look, body, status, held_why, care)
    values (r.id, rp.server, uid, card.handle, card.name, card.look, v_body, case when hold is null then 'shown' else 'held' end, hold,
            coalesce(plaza.hold_why(v_body, false) = 'care', false))
    returning * into m;
  return jsonb_build_object('ok', true, 'message', plaza.row(m, uid), 'held', hold is not null, 'held_why', hold);
end $$;

-- Room chat on (just in time, at her first message) and off; off deletes her messages through the consent trigger.
-- The form names the card it was opened with and the last Room chat event it knew, so an old form cannot turn chat back
-- on after it was turned off elsewhere.
create or replace function public.plaza_chat_on(p_notice integer, p_hash text, p_device text, p_opt_in boolean, p_expect uuid, p_seen bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); why text; last_ev bigint;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform social.lock(uid);
  why := plaza.read_problem(uid);
  if why is not null then return jsonb_build_object('ok', false, 'why', why); end if;
  if p_expect is distinct from (select s.handle from public.social_profiles s where s.user_id = uid) then return jsonb_build_object('ok', false, 'why', 'stale'); end if;
  select max(id) into last_ev from public.consent_events where user_id = uid and purpose = 'plaza_chat';
  if last_ev is distinct from p_seen then return jsonb_build_object('ok', false, 'why', 'stale'); end if;
  if public.consent_allows(uid, 'plaza_chat') then return jsonb_build_object('ok', true, 'recorded', '[]'::jsonb); end if;
  if not coalesce(p_opt_in, false) then return jsonb_build_object('ok', false, 'why', 'consent'); end if;
  perform set_config('plaza.chat_on', 'yes', true);
  insert into public.consent_events (user_id, purpose, action, notice_version, notice_hash, method, device_id, client_at)
    values (uid, 'plaza_chat', 'grant', greatest(coalesce(p_notice, 1), 1), left(coalesce(p_hash, ''), 64), 'jit', left(coalesce(p_device, ''), 64), now())
    returning id into last_ev;
  perform set_config('plaza.chat_on', '', true);
  return jsonb_build_object('ok', true, 'recorded', '["plaza_chat"]'::jsonb, 'chat_event', last_ev);
end $$;
create or replace function public.plaza_chat_off(p_notice integer default 1, p_device text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ev bigint;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  perform social.lock(uid);
  -- every Off is recorded, also when Room chat was already off, so a Room chat form opened before it is stale
  insert into public.consent_events (user_id, purpose, action, notice_version, method, device_id, client_at)
    values (uid, 'plaza_chat', 'withdraw', greatest(coalesce(p_notice, 1), 1), 'you', left(coalesce(p_device, ''), 64), now())
    returning id into ev;
  delete from public.plaza_messages where author = uid; -- also when no grant was on record, so nothing of hers is left
  return jsonb_build_object('ok', true, 'chat_event', ev);
end $$;

-- report a message she can see in her group now; each account counts once; three different people hide it at once
create or replace function public.plaza_report_message(p_message bigint, p_reason text, p_block boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); other uuid; m public.plaza_messages%rowtype; me public.social_profiles%rowtype; rn text; n integer;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_reason is null or p_reason not in ('unkind', 'spam', 'pretending', 'under18', 'worried', 'advice', 'news', 'other') then return jsonb_build_object('ok', false, 'why', 'reason'); end if;
  select author into other from public.plaza_messages where id = p_message;
  if other is null or other = uid then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  perform social.lock(uid, other);
  select * into m from public.plaza_messages where id = p_message and author = other for update; -- reports of one message count one at a time
  if not found then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  if not plaza.can_read(uid) or not social.present(uid, m.server, null) or not plaza.shows(m, uid) then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  if exists (select 1 from staff.social_reports x where x.message_id = m.id and x.reporter = uid) then
    if coalesce(p_block, false) then perform social.block(uid, other); end if;
    return jsonb_build_object('ok', true, 'again', true);
  end if;
  if not social.hit(uid, 'report', 20, interval '1 day') then return jsonb_build_object('ok', false, 'why', 'today'); end if;
  select * into me from public.social_profiles where user_id = uid;
  select r.name into rn from public.plaza_rooms r where r.id = m.room;
  insert into staff.social_reports (reporter, reporter_handle, reporter_name, target, target_handle, target_name, target_look, note_id, phrase, phrase_text, reason, message_id, room)
    values (uid, me.handle, me.name, other, m.handle, m.name, m.look, null, 'message',
            left((select s.name from public.plaza_servers s where s.id = m.server) || ', ' || coalesce(rn, m.room) || ': ' || m.body, 400), p_reason, m.id, m.room);
  select count(distinct x.reporter) into n from staff.social_reports x where x.message_id = m.id and x.status = 'open';
  if n >= 3 and m.status = 'shown' then update public.plaza_messages set status = 'held', held_why = 'reports', rev = nextval('public.plaza_messages_rev_seq') where id = m.id; end if;
  if coalesce(p_block, false) then perform social.block(uid, other); end if;
  return jsonb_build_object('ok', true, 'hidden', n >= 3);
end $$;

-- ---------- staff: the held messages, shown or hidden one at a time (audited through staff.require) ----------
create or replace function staff.plaza_queue(p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform plaza.sweep();
  return jsonb_build_object('at', clock_timestamp(), 'mode', case when plaza.live() then 'live' else 'review' end, 'chat_on', plaza.chat_on(),
    'messages', coalesce((select jsonb_agg(x.j order by x.id) from (
      select m.id, jsonb_build_object('id', m.id, 'rev', m.rev, 'at', m.at, 'status', m.status, 'why', m.held_why, 'care', m.care, 'body', m.body,
        'group', s.name, 'room', r.name, 'name', m.name, 'card', left(m.handle::text, 8),
        'reports', (select count(*) from staff.social_reports x where x.message_id = m.id and x.status = 'open')) as j
      from public.plaza_messages m join public.plaza_rooms r on r.id = m.room join public.plaza_servers s on s.id = m.server
      where m.status = 'held' order by m.id limit 200) x), '[]'::jsonb));
end $$;
-- a decision names the revision the queue showed: a message decided or changed since (another owner, a third report, its
-- writer turning Room chat off) is refused, never silently reversed (Codex diff review round 3)
create or replace function staff.plaza_decide(p_id bigint, p_decision text, p_actor uuid, p_rev bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a uuid; m public.plaza_messages%rowtype;
begin
  if p_decision is null or p_decision not in ('show', 'hide') then return jsonb_build_object('ok', false, 'error', 'Unknown decision.'); end if;
  select author into a from public.plaza_messages where id = p_id;
  if a is null then return jsonb_build_object('ok', false, 'error', 'That message is gone (deleted, expired or withdrawn).'); end if;
  perform social.lock(a);
  select * into m from public.plaza_messages where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'That message is gone (deleted, expired or withdrawn).'); end if;
  if m.status <> 'held' or p_rev is null or m.rev <> p_rev then
    return jsonb_build_object('ok', false, 'stale', true, 'error', 'Someone decided or changed this message since the queue was shown. The queue has been refreshed.');
  end if;
  if m.at <= clock_timestamp() - interval '24 hours' then -- nobody could read it now; the hourly clean-up deletes it (round 5, 5)
    return jsonb_build_object('ok', false, 'error', 'That message is past its 24 hours, so nobody can see it any more. It is deleted within the hour.');
  end if;
  update public.plaza_messages set status = case when p_decision = 'show' then 'shown' else 'hidden' end, decided_at = now(), decided_by = p_actor,
    rev = nextval('public.plaza_messages_rev_seq') where id = p_id;
  if p_decision = 'hide' then
    update staff.social_reports set status = 'removed', decided_at = now(), decided_by = p_actor where message_id = p_id and status = 'open';
  else
    update staff.social_reports set status = 'dismissed', decided_at = now(), decided_by = p_actor where message_id = p_id and status = 'open';
  end if;
  return jsonb_build_object('ok', true);
end $$;
create or replace function public.admin_plaza_messages(p_status text default 'held') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_plaza_messages', jsonb_build_object('status', p_status)); if d is not null then return d; end if;
  -- held messages only: staff read a room message when it waits for a person or someone reports it, never otherwise
  if p_status is distinct from 'held' then return jsonb_build_object('error', 'Only messages waiting for a check are listed.'); end if;
  return staff.plaza_queue('held');
end $$;
create or replace function public.admin_plaza_decide(p_id bigint, p_decision text, p_rev bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb;
begin
  d := staff.require('admin_plaza_decide', jsonb_build_object('id', p_id, 'decision', p_decision, 'rev', p_rev), true); if d is not null then return d; end if;
  return staff.plaza_decide(p_id, p_decision, staff.caller(), p_rev);
end $$;

-- the friends reports list also says when a report is about a room message
create or replace function staff.social_reports_list(p_status text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform social.sweep();
  return jsonb_build_object('at', clock_timestamp(), 'reports', coalesce((select jsonb_agg(x.j order by x.at desc) from (
    select r.at, jsonb_build_object('id', r.id, 'at', r.at, 'reason', r.reason, 'status', r.status, 'decided_at', r.decided_at, 'days', r.days,
      'card', left(r.target_handle::text, 8), 'name', r.target_name, 'look', r.target_look, 'phrase', r.phrase_text, 'about_note', r.note_id is not null,
      'about_message', r.message_id is not null,
      'from_card', left(coalesce(r.reporter_handle::text, ''), 8), 'from_name', r.reporter_name,
      'open_on_card', (select count(*) from staff.social_reports o where o.status = 'open' and o.target_handle = r.target_handle),
      'card_now', (select case when r.target is null then 'account deleted' when social.paused(r.target) is not null then 'paused' when s.user_id is null then 'no card'
                     when s.handle <> r.target_handle then 'new card' else 'active' end
                   from (select 1) z left join public.social_profiles s on s.user_id = r.target)) as j
    from staff.social_reports r where (p_status is null or r.status = p_status) order by r.at desc limit 200) x), '[]'::jsonb));
end $$;

-- ---------- grants ----------
revoke all on function plaza.guard_chat_grant(), plaza.chat_on(), plaza.live(), plaza.read_problem(uuid), plaza.can_read(uuid), plaza.here(uuid, text, uuid), plaza.room_count(text),
  plaza.flat(text), plaza.tlds(), plaza.undate(text), plaza.has_host(text), plaza.text_problem(text), plaza.hold_why(text, boolean), plaza.say_rate(uuid), plaza.sweep(), plaza.row(public.plaza_messages, uuid),
  plaza.shows(public.plaza_messages, uuid), plaza.on_consent() from public, anon, authenticated;
revoke all on function staff.plaza_queue(text), staff.plaza_decide(bigint, text, uuid, bigint) from public, anon, authenticated;
grant execute on function staff.plaza_queue(text), staff.plaza_decide(bigint, text, uuid, bigint) to rhythme_staff_fn;
revoke all on function public.plaza_rooms_list(text, uuid), public.plaza_room_join(text, uuid, text), public.plaza_room_leave(uuid),
  public.plaza_room_feed(text, uuid, text, text), public.plaza_say(uuid, text, boolean), public.plaza_chat_on(integer, text, text, boolean, uuid, bigint),
  public.plaza_chat_off(integer, text), public.plaza_report_message(bigint, text, boolean), public.plaza_join(text),
  public.admin_plaza_messages(text), public.admin_plaza_decide(bigint, text, bigint) from public, anon;
grant execute on function public.plaza_rooms_list(text, uuid), public.plaza_room_join(text, uuid, text), public.plaza_room_leave(uuid),
  public.plaza_room_feed(text, uuid, text, text), public.plaza_say(uuid, text, boolean), public.plaza_chat_on(integer, text, text, boolean, uuid, bigint),
  public.plaza_chat_off(integer, text), public.plaza_report_message(bigint, text, boolean), public.plaza_join(text),
  public.admin_plaza_messages(text), public.admin_plaza_decide(bigint, text, bigint) to authenticated;

-- ---------- the hourly clean-up: the 24-hour promise holds even when nobody opens a room ----------
select cron.schedule('rhythme-plaza-chat-sweep', '7 * * * *', 'select plaza.sweep()');

-- Undo:
--   select cron.unschedule('rhythme-plaza-chat-sweep');
--   drop trigger if exists consent_plaza_chat_withdraw on public.consent_events;
--   drop trigger if exists consent_plaza_chat_grant_guard on public.consent_events;
--   drop function if exists public.admin_plaza_decide(bigint, text, bigint), public.admin_plaza_messages(text), staff.plaza_decide(bigint, text, uuid, bigint),
--     staff.plaza_queue(text), public.plaza_report_message(bigint, text, boolean), public.plaza_chat_off(integer, text),
--     public.plaza_chat_on(integer, text, text, boolean, uuid, bigint), public.plaza_say(uuid, text, boolean), public.plaza_room_feed(text, uuid, text, text),
--     public.plaza_room_leave(uuid), public.plaza_room_join(text, uuid, text), public.plaza_rooms_list(text, uuid);
--   drop schema if exists plaza cascade;
--   drop sequence if exists public.plaza_messages_rev_seq (after the table);
--   drop table if exists public.plaza_messages, public.plaza_room_presence, public.plaza_rooms, public.plaza_hold_phrases, public.plaza_words, public.plaza_flags;
--   restore plaza_join from 20261019110000_plaza_visits.sql and staff.social_reports_list from 20261019130000_plaza_friends.sql;
--   delete the two new groups (after-a-loss, new-mothers) and their presence rows; set the old names (PCOS, Menopause) and
--   sorts back; alter table public.plaza_servers drop column quiet; alter table staff.social_reports drop column message_id,
--   drop column room; restore the three check constraints without 'plaza_chat', 'say', 'advice' and 'news' (NOT VALID if
--   rows with them exist).
