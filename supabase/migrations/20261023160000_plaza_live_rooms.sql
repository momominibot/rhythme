-- Live Chat and Wins rooms (Jamie, 23 Oct 2026: "the channel can be a live chat? can it shows how many online?", then
-- "whichever apple app store approve and is easy for you to deploy, then go ahead"). Applied the same night after the
-- rolled-back check in tools/db/plaza_live_rooms_dryrun.sql.
--
-- 20261022120000_plaza_rooms_chat.sql holds every message for a person to read first. This lets the light rooms run live:
-- each group's Chat and Wins rooms (never After a loss) show a message at once. Everything else is unchanged and still
-- holds in every room, live or not: crisis and self-harm words (held, then shown with the help reminder), instructions
-- about medicines and doses, pregnancy and birth news in rooms that keep it out, and anything her phone asked to check.
-- Vent, Doctor visits, the topic rooms and both After a loss rooms stay reviewed. Contact details, links and the refused
-- words are refused before any of this. Three reports hide a message at once; block, report and the staff queue are as
-- they were. The app-wide switch plaza_flags.mode stays held at 'review' by its check.
-- Apple App Review Guideline 1.2 (user-generated content): filtering, reporting, blocking and a published contact.
-- Each function below is the applied one with one change, marked in a comment.

alter table public.plaza_rooms add column if not exists live boolean not null default false;
update public.plaza_rooms set live = (kind in ('chat', 'wins') and server <> 'after-a-loss');

-- 1. saying: a live room shows a message the hold rules let through
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
  if hold is null and not (plaza.live() or r.live) then hold := 'review'; end if; -- a live room shows it now (the hold rules above still apply)
  select * into card from public.social_profiles where user_id = uid;
  insert into public.plaza_messages (room, server, author, handle, name, look, body, status, held_why, care)
    values (r.id, rp.server, uid, card.handle, card.name, card.look, v_body, case when hold is null then 'shown' else 'held' end, hold,
            coalesce(plaza.hold_why(v_body, false) = 'care', false))
    returning * into m;
  return jsonb_build_object('ok', true, 'message', plaza.row(m, uid), 'held', hold is not null, 'held_why', hold);
end $$;

-- 2. the feed says the room's own mode
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
  return jsonb_build_object('ok', true, 'room', r.id, 'people', plaza.room_count(r.id), 'capacity', r.capacity, 'mode', case when plaza.live() or r.live then 'live' else 'review' end,
    'open', r.open and plaza.chat_on() and coalesce((select s.open from public.plaza_servers s where s.id = p_server), false),
    'joined', e is not null, 'entry', e, 'ids', v_ids, 'seen', v_seen, 'same', coalesce(v_seen = p_seen, false),
    'messages', case when v_seen = p_seen then '[]'::jsonb else v_rows end);
end $$;

-- 3. the room list marks each live room
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
        'open', r.open and s.open and plaza.chat_on(), 'no_news', r.no_news, 'live', r.live or plaza.live(), 'people', plaza.room_count(r.id),
        'last_at', (select max(m.at) from public.plaza_messages m where m.room = r.id and m.status = 'shown' and plaza.shows(m, uid))) order by r.sort), '[]'::jsonb)
      from public.plaza_rooms r join public.plaza_servers s on s.id = r.server where r.server = p_server));
end $$;

-- Undo: update public.plaza_rooms set live = false; (the functions then behave exactly as before)
