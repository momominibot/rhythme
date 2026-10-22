#!/usr/bin/env python3
"""Two-session race tests for Plaza friends, on a throwaway local Postgres (never the live project).

Each race opens two real sessions. The first runs a call and keeps its transaction open; the second runs the competing
call, and the harness confirms in pg_stat_activity that it is waiting on a lock before the first commits. Then the
outcome is checked. `--mutate` reloads the database with social.lock() turned into a no-op and expects the same races to
go wrong, which shows the tests can see the bug they guard against. `--dryrun` also runs tools/db/plaza_friends_dryrun.sql
against the local copy (its RESULT is printed; the live run stays authoritative).

Setup (once):  brew install postgresql@17; initdb -D DIR -U postgres --auth=trust;
               LC_ALL=en_US.UTF-8 pg_ctl -D DIR -o "-p 55432 -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" start
               python -m pip install "psycopg[binary]"
Usage:         python3 tools/db/race_test.py [--mutate] [--dryrun]      (RACE_DSN overrides host/port/user)
               python3 tools/db/race_test.py --rooms [--mutate] [--dryrun]  plaza rooms and room chat (20261022120000): six
               races; --mutate also takes the plaza membership lock out of staff.plaza_sweep(); --dryrun runs
               tools/db/plaza_rooms_dryrun.sql against the local copy
"""
import json, os, re, sys, threading, time, uuid
import psycopg

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DSN = os.environ.get('RACE_DSN', 'host=127.0.0.1 port=55432 user=postgres')
DB = 'friends_race'
MIG = os.path.join(ROOT, 'supabase', 'migrations')
PLAZA = ['20261019080000_plaza_presence.sql', '20261019090000_plaza_presence_v2.sql', '20261019100000_plaza_groups.sql', '20261019110000_plaza_visits.sql']
FRIENDS = '20261019130000_plaza_friends.sql'
ROOMS = '20261022120000_plaza_rooms_chat.sql'
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('  ok   ' if ok else '  FAIL ') + name + ('' if ok else '  ' + str(detail)[:300]))


def fresh(mutate=False, rooms=False):
    with psycopg.connect(DSN + ' dbname=postgres', autocommit=True) as c:
        c.execute('drop database if exists %s with (force)' % DB)
        c.execute('create database %s' % DB)
    c = psycopg.connect(DSN + ' dbname=' + DB, autocommit=True)
    c.execute(open(os.path.join(ROOT, 'tools', 'db', 'local_stub.sql')).read())
    for f in PLAZA:
        c.execute(open(os.path.join(MIG, f)).read())
    sql = open(os.path.join(MIG, FRIENDS)).read()
    assert sql.count('create extension if not exists pg_cron;') == 1
    c.execute(sql.replace('create extension if not exists pg_cron;', '-- (pg_cron is a stand-in locally)'))
    if rooms:
        c.execute(open(os.path.join(MIG, ROOMS)).read())
    if mutate:
        c.execute("create or replace function social.lock(p_a uuid, p_b uuid default null) returns void language plpgsql as $$ begin end $$")
        if rooms:  # the sweep without its membership lock, and without the daily-count upsert, whose shared row would
            # otherwise serialise two calls in the same group by accident and hide a missing lock
            c.execute("create or replace function staff.plaza_sweep() returns void language plpgsql security definer set search_path = '' as $$ "
                      "begin delete from public.plaza_presence where seen_at <= clock_timestamp() - interval '75 seconds'; end $$")
    return c


def person(c, name, server=None, friends_with=None):
    u = uuid.uuid4()
    c.execute("insert into auth.users (id, email, aud, role) values (%s, %s, 'authenticated', 'authenticated')", [u, 'race-%s@example.invalid' % u])
    c.execute("insert into public.consent_events (user_id, purpose, action, notice_version, method) values (%s, 'age_18', 'grant', 3, 'sheet'), (%s, 'social', 'grant', 3, 'jit')", [u, u])
    h = c.execute("insert into public.social_profiles (user_id, name, look) values (%s, %s, 'base') returning handle", [u, name]).fetchone()[0]
    v = None
    if server:
        v = c.execute("insert into public.plaza_presence (user_id, server, visit, joined_at, seen_at) values (%s, %s, gen_random_uuid(), clock_timestamp(), clock_timestamp()) returning visit", [u, server]).fetchone()[0]
    if friends_with:
        befriend(c, u, friends_with['id'])
    return {'id': u, 'handle': h, 'visit': v, 'name': name}


def befriend(c, a, b):
    c.execute('insert into public.social_friends (a, b) values (least(%s::uuid, %s::uuid), greatest(%s::uuid, %s::uuid)) on conflict do nothing', [a, b, a, b])


class Session:
    def __init__(self):
        self.c = psycopg.connect(DSN + ' dbname=' + DB)
        self.pid = self.c.info.backend_pid

    def call(self, who, sql, params=()):
        self.c.execute("select set_config('request.jwt.claims', %s, true)", [json.dumps({'sub': str(who), 'role': 'authenticated'})])
        self.c.execute('set local role authenticated')
        r = self.c.execute(sql, params).fetchone()[0]
        self.c.execute('reset role')
        return r


def race(first, second):
    """first and second are (who, sql, params). Returns (first result, second result, second waited on a lock)."""
    a, b = Session(), Session()
    mon = psycopg.connect(DSN + ' dbname=' + DB, autocommit=True)
    r1 = a.call(*first)  # its transaction stays open, holding whatever it locked
    out = {}

    def run():
        try:
            out['r'] = b.call(*second)
            b.c.commit()
        except Exception as e:  # noqa
            out['r'] = {'error': str(e)}
            b.c.rollback()
    t = threading.Thread(target=run)
    t.start()
    waited = False
    for _ in range(60):
        row = mon.execute('select wait_event_type from pg_stat_activity where pid = %s', [b.pid]).fetchone()
        if row and row[0] == 'Lock':
            waited = True
            break
        if not t.is_alive():
            break
        time.sleep(0.05)
    a.c.commit()
    t.join(15)
    for s in (a, b):
        s.c.close()
    mon.close()
    return r1, out.get('r'), waited


def one(c, sql, params=()):
    return c.execute(sql, params).fetchone()[0]


def scenarios(c, expect_safe=True):
    """Each scenario reports whether the outcome was the safe one. With expect_safe False (social.lock removed) the
    same scenarios are expected to go wrong."""
    seen = {}

    # 1. a note against a block: the block holds both accounts; the note waits, then finds the block
    A = person(c, 'Ann', 'pcos'); B = person(c, 'Bea', 'pcos', friends_with=A)
    r1, r2, w = race((B['id'], 'select public.social_block(%s)', [A['handle']]), (A['id'], 'select public.social_note(%s, %s)', [B['handle'], 'tea']))
    note = one(c, 'select count(*) from public.social_notes where from_user = %s and to_user = %s', [A['id'], B['id']])
    seen['block_vs_note'] = (r2.get('why') == 'gone' and note == 0, {'block': r1, 'note': r2, 'waited': w, 'notes': note}, w)

    # 2. a note against Plaza friends turned off by the recipient (any route: the general consent call)
    A = person(c, 'Ada', 'pcos'); B = person(c, 'Bo', 'pcos', friends_with=A)
    r1, r2, w = race((B['id'], "select public.consent_record('social', 'withdraw', 3)", []), (A['id'], 'select public.social_note(%s, %s)', [B['handle'], 'tea']))
    note = one(c, 'select count(*) from public.social_notes where to_user = %s', [B['id']])
    seen['withdraw_vs_note'] = (r2.get('why') == 'gone' and note == 0, {'note': r2, 'waited': w, 'notes': note}, w)

    # 3. accepting an ask against the asker withdrawing 18+
    A = person(c, 'Aya', 'pcos'); B = person(c, 'Bel', 'pcos')
    c.execute("insert into public.social_requests (from_user, to_user) values (%s, %s)", [B['id'], A['id']])
    r1, r2, w = race((B['id'], "select public.consent_record('age_18', 'withdraw', 3)", []), (A['id'], 'select public.social_answer(%s, true)', [B['handle']]))
    fr = one(c, 'select count(*) from public.social_friends where a = least(%s::uuid, %s::uuid) and b = greatest(%s::uuid, %s::uuid)', [A['id'], B['id'], A['id'], B['id']])
    seen['age_withdraw_vs_accept'] = (r2.get('why') == 'gone' and fr == 0, {'answer': r2, 'waited': w, 'friends': fr}, w)

    # 4. one account accepting two asks from two phones at 199 friends: the second waits and finds 200
    X = person(c, 'Xia', 'pcos')
    c.execute("insert into auth.users (id, email) select gen_random_uuid(), 'race-filler-' || g || '@example.invalid' from generate_series(1, 199) g")
    c.execute("insert into public.social_friends (a, b) select least(%s::uuid, u.id), greatest(%s::uuid, u.id) from auth.users u where u.email like 'race-filler-%%' and u.id not in (select a from public.social_friends where b = %s union select b from public.social_friends where a = %s) limit 199", [X['id'], X['id'], X['id'], X['id']])
    P1 = person(c, 'Pia', 'pcos'); P2 = person(c, 'Pam', 'pcos')
    c.execute("insert into public.social_requests (from_user, to_user) values (%s, %s), (%s, %s)", [P1['id'], X['id'], P2['id'], X['id']])
    r1, r2, w = race((X['id'], 'select public.social_answer(%s, true)', [P1['handle']]), (X['id'], 'select public.social_answer(%s, true)', [P2['handle']]))
    n = one(c, 'select count(*) from public.social_friends where a = %s or b = %s', [X['id'], X['id']])
    seen['capacity_two_phones'] = (r1.get('status') == 'friends' and r2.get('why') == 'full' and n == 200, {'first': r1, 'second': r2, 'waited': w, 'friends': n}, w)

    # 5. two staff decisions on one report: the second waits, then finds it decided; the pause stands
    O = person(c, 'Own'); T = person(c, 'Tam', 'pcos'); Rr = person(c, 'Rae', 'pcos')
    c.execute("insert into staff.admin_accounts (user_id, email, role) values (%s, 'owner@example.invalid', 'owner')", [O['id']])
    rid = one(c, "insert into staff.social_reports (reporter, target, target_handle, target_name, reason) values (%s, %s, %s, 'Tam', 'unkind') returning id", [Rr['id'], T['id'], T['handle']])
    r1, r2, w = race((O['id'], 'select public.admin_social_decide(%s, %s, 3)', [rid, 'pause']), (O['id'], 'select public.admin_social_decide(%s, %s, null)', [rid, 'dismiss']))
    st = one(c, 'select status from staff.social_reports where id = %s', [rid]); held = one(c, 'select count(*) from public.social_holds where user_id = %s', [T['id']])
    seen['staff_decisions'] = (r1.get('ok') is True and r2.get('ok') is False and st == 'paused' and held == 1, {'first': r1, 'second': r2, 'waited': w, 'status': st, 'hold': held}, w)

    # 6. two people asking each other at once: friends once, no ask left over
    A = person(c, 'Amy', 'pcos'); B = person(c, 'Bex', 'pcos')
    r1, r2, w = race((A['id'], 'select public.social_ask(%s, %s, %s, null)', [B['handle'], 'pcos', A['visit']]), (B['id'], 'select public.social_ask(%s, %s, %s, null)', [A['handle'], 'pcos', B['visit']]))
    fr = one(c, 'select count(*) from public.social_friends where a = least(%s::uuid, %s::uuid) and b = greatest(%s::uuid, %s::uuid)', [A['id'], B['id'], A['id'], B['id']])
    left = one(c, 'select count(*) from public.social_requests where from_user in (%s, %s)', [A['id'], B['id']])
    seen['mutual_asks'] = (r1.get('status') == 'asked' and r2.get('status') == 'friends' and fr == 1 and left == 0, {'first': r1, 'second': r2, 'waited': w, 'friends': fr, 'left': left}, w)

    # 7. a note against an unfriend
    A = person(c, 'Ari', 'pcos'); B = person(c, 'Bay', 'pcos', friends_with=A)
    r1, r2, w = race((B['id'], 'select public.social_unfriend(%s)', [A['handle']]), (A['id'], 'select public.social_note(%s, %s)', [B['handle'], 'hug']))
    note = one(c, 'select count(*) from public.social_notes where from_user = %s', [A['id']])
    seen['unfriend_vs_note'] = (r2.get('why') == 'gone' and note == 0, {'note': r2, 'waited': w, 'notes': note}, w)

    # 8. an ask against the other person turning Plaza friends off
    A = person(c, 'Abi', 'pcos'); B = person(c, 'Bia', 'pcos')
    r1, r2, w = race((B['id'], 'select public.social_off(3)', []), (A['id'], 'select public.social_ask(%s, %s, %s, null)', [B['handle'], 'pcos', A['visit']]))
    req = one(c, 'select count(*) from public.social_requests where from_user = %s', [A['id']])
    seen['off_vs_ask'] = (r2.get('why') == 'gone' and req == 0, {'ask': r2, 'waited': w, 'requests': req}, w)
    return seen


def rules(c):
    """Two rules from the Codex pre-merge review (20 Oct), items 6 and 7, outside any race."""
    out = {}
    s = Session()
    def do(who, sql, params=()):
        r = s.call(who, sql, params); s.c.commit(); return r
    # 6. a block and an unblock never reset the 30-day wait before asking the same person again
    A = person(c, 'Ada', 'pcos'); B = person(c, 'Bo', 'pcos')
    r1 = do(A['id'], 'select public.social_ask(%s, %s, %s, null)', [B['handle'], 'pcos', A['visit']])
    do(A['id'], 'select public.social_block(%s)', [B['handle']])
    bid = one(c, 'select id from public.social_blocks where blocker = %s and blocked = %s', [A['id'], B['id']])
    do(A['id'], 'select public.social_unblock(%s)', [bid])
    before = one(c, 'select count(*) from public.social_requests where from_user = %s and to_user = %s', [A['id'], B['id']])
    r2 = do(A['id'], 'select public.social_ask(%s, %s, %s, null)', [B['handle'], 'pcos', A['visit']])
    after = one(c, 'select count(*) from public.social_requests where from_user = %s and to_user = %s', [A['id'], B['id']])
    out['block_unblock_keeps_the_ask_wait'] = (r1.get('status') == 'asked' and before == 0 and r2.get('status') == 'asked' and after == 0, {'first': r1, 'again': r2, 'requests_before': before, 'requests_after': after})
    # 7. a declined ask to her does not let her look up the asker's current card
    C = person(c, 'Cy', 'pcos'); D = person(c, 'Di', 'pcos')
    do(C['id'], 'select public.social_ask(%s, %s, %s, null)', [D['handle'], 'pcos', C['visit']])
    do(D['id'], 'select public.social_answer(%s, false)', [C['handle']])
    c.execute('delete from public.plaza_presence where user_id in (%s, %s)', [C['id'], D['id']]); c.commit()  # both left the group
    vis_declined = one(c, 'select social.visible(%s, %s)', [D['id'], C['id']])
    vis_own = one(c, 'select social.visible(%s, %s)', [C['id'], D['id']])
    out['declined_ask_shows_no_card'] = (vis_declined is False and vis_own is True, {'declined_to_her_visible': vis_declined, 'own_ask_visible': vis_own})
    s.c.close()
    return out


def chatter(c, name, server, room=None):
    """A person with Room chat on, in a group now and, if a room is named, in that room; carries the room entry."""
    P = person(c, name, server)
    c.execute("insert into public.consent_events (user_id, purpose, action, notice_version, method) values (%s, 'plaza_chat', 'grant', 1, 'jit')", [P['id']])
    P['entry'] = None
    if room:
        P['entry'] = one(c, "insert into public.plaza_room_presence (user_id, server, visit, room) values (%s, %s, %s, %s) returning entry", [P['id'], server, P['visit'], room])
    return P


def room_scenarios(c):
    """Plaza rooms and room chat (20261022120000). Each reports (safe outcome, detail, the second session waited)."""
    seen = {}

    # 1. two people taking the last place in a room: the membership lock lets one in; the other hears it is full
    for i in range(11):
        chatter(c, 'Fill%d' % i, 'everyone', 'everyone-chat')
    A = chatter(c, 'Ana', 'everyone'); B = chatter(c, 'Bee', 'everyone')
    sql = 'select public.plaza_room_join(%s, %s, %s)'
    r1, r2, w = race((A['id'], sql, ['everyone', A['visit'], 'everyone-chat']), (B['id'], sql, ['everyone', B['visit'], 'everyone-chat']))
    n = one(c, "select plaza.room_count('everyone-chat')")
    seen['room_capacity_last_place'] = (r1.get('ok') is True and r2.get('why') == 'full' and n == 12, {'first': r1, 'second': r2, 'waited': w, 'count': n}, w)

    # 2. saying something while Room chat is turned off on another phone: the message never outlives the withdrawal
    A = chatter(c, 'Ava', 'pcos', 'pcos-chat')
    r1, r2, w = race((A['id'], 'select public.plaza_say(%s, %s, false)', [A['entry'], 'hello there']), (A['id'], 'select public.plaza_chat_off(3, null)', []))
    left = one(c, 'select count(*) from public.plaza_messages where author = %s', [A['id']])
    seen['say_vs_chat_off'] = (r1.get('ok') is True and r2.get('ok') is True and left == 0, {'say': r1, 'off': r2, 'waited': w, 'messages': left}, w)

    # 3. another phone takes her into another group while she is sending: the send waits, then finds her gone
    A = chatter(c, 'Amy', 'everyone', 'everyone-vent')
    r1, r2, w = race((A['id'], "select public.plaza_join('pcos')", []), (A['id'], 'select public.plaza_say(%s, %s, false)', [A['entry'], 'still here?']))
    sent = one(c, 'select count(*) from public.plaza_messages where author = %s', [A['id']])
    seen['displaced_vs_say'] = (r1.get('ok') is True and r2.get('why') == 'not_in_room' and sent == 0, {'join': r1, 'say': r2, 'waited': w, 'messages': sent}, w)

    # 4. the second and third reports of one message at once: counted one at a time, so the third hides it
    X = chatter(c, 'Xin', 'menopause', 'meno-chat'); R1 = chatter(c, 'Ria', 'menopause'); R2 = chatter(c, 'Rue', 'menopause'); R3 = chatter(c, 'Ros', 'menopause')
    c.execute("update public.plaza_flags set value = 'live' where key = 'mode'")
    s0 = Session(); m = s0.call(X['id'], 'select public.plaza_say(%s, %s, false)', [X['entry'], 'nobody listens to me here']); s0.c.commit(); s0.c.close()
    c.execute("update public.plaza_flags set value = 'review' where key = 'mode'")
    mid = int(m['message']['id'])
    s0 = Session(); s0.call(R1['id'], 'select public.plaza_report_message(%s, %s, false)', [mid, 'advice']); s0.c.commit(); s0.c.close()
    sql = 'select public.plaza_report_message(%s, %s, false)'
    r1, r2, w = race((R2['id'], sql, [mid, 'advice']), (R3['id'], sql, [mid, 'unkind']))
    st = one(c, 'select status from public.plaza_messages where id = %s', [mid])
    seen['third_report_hides'] = (r1.get('ok') is True and r2.get('hidden') is True and st == 'held', {'second': r1, 'third': r2, 'waited': w, 'status': st}, w)

    # 5. joining a room while Plaza friends is turned off: the join waits, then finds no card
    A = chatter(c, 'Abi', 'new-mothers')
    r1, r2, w = race((A['id'], "select public.consent_record('social', 'withdraw', 3)", []), (A['id'], 'select public.plaza_room_join(%s, %s, %s)', ['new-mothers', A['visit'], 'mothers-night']))
    rows = one(c, 'select count(*) from public.plaza_room_presence where user_id = %s', [A['id']])
    seen['withdraw_vs_room_join'] = (r2.get('why') == 'card' and rows == 0, {'join': r2, 'waited': w, 'rows': rows}, w)

    # 6. an owner showing a held message while its writer turns Room chat off: the decision finds it gone
    O = person(c, 'Own')
    c.execute("insert into staff.admin_accounts (user_id, email, role) values (%s, 'owner-rooms@example.invalid', 'owner')", [O['id']])
    A = chatter(c, 'Ada', 'everyone', 'everyone-wins')
    s0 = Session(); m = s0.call(A['id'], 'select public.plaza_say(%s, %s, false)', [A['entry'], 'waiting for a check']); s0.c.commit(); s0.c.close()
    mid = int(m['message']['id'])
    r1, r2, w = race((A['id'], 'select public.plaza_chat_off(3, null)', []), (O['id'], 'select public.admin_plaza_decide(%s, %s)', [mid, 'show']))
    left = one(c, 'select count(*) from public.plaza_messages where id = %s', [mid])
    seen['chat_off_vs_staff_show'] = (r2.get('ok') is False and left == 0, {'decide': r2, 'waited': w, 'left': left}, w)
    return seen


def main_rooms(mutate, dry):
    print('Plaza rooms and room chat races on a local copy (two real sessions each)')
    c = fresh(rooms=True)
    for name, (ok, detail, waited) in room_scenarios(c).items():
        check('race: ' + name.replace('_', ' '), ok, detail)
        check('race: ' + name.replace('_', ' ') + ', the second session waited on a lock', waited, detail)
    c.close()
    if mutate:
        print('the same races with social.lock() a no-op and the membership lock taken out of staff.plaza_sweep()')
        c = fresh(mutate=True, rooms=True)
        seen = room_scenarios(c)
        wrong = [k for k, (ok, _, _w) in seen.items() if not ok]
        check('without the locks, the races that write after a check go wrong (%d of %d: %s)' % (len(wrong), len(seen), ', '.join(wrong)),
              {'room_capacity_last_place', 'say_vs_chat_off', 'displaced_vs_say', 'withdraw_vs_room_join'} <= set(wrong), seen)
        c.close()
    if dry:
        print('the rolled-back dry run, against the local copy')
        c = fresh(rooms=True)
        c.autocommit = False
        try:
            c.execute(open(os.path.join(ROOT, 'tools', 'db', 'plaza_rooms_dryrun.sql')).read())
            check('local dry run raised its RESULT', False, 'no RESULT')
        except psycopg.Error as e:
            m = re.search(r'RESULT (\{.*\})', str(e), re.S)
            res = json.loads(m.group(1)) if m else {}
            check('local dry run: %s of %s checks, missing %s, failing %s' % (res.get('count'), res.get('expected'), res.get('missing'), res.get('failing')), res.get('all') is True, str(e)[:400])
        c.rollback(); c.close()
    failed = [r for r in results if not r[1]]
    print('\n%d passed, %d failed' % (len(results) - len(failed), len(failed)))
    sys.exit(1 if failed else 0)


def main():
    mutate, dry = '--mutate' in sys.argv, '--dryrun' in sys.argv
    if '--rooms' in sys.argv:
        return main_rooms(mutate, dry)
    print('Plaza friends races on a local copy (two real sessions each)')
    c = fresh()
    # the saved outcome and the lock wait are separate assertions (Codex pre-merge review, 20 Oct, item 8): a run where the
    # scheduler let the second session through before the harness saw it waiting still has its data checked on its own
    for name, (ok, detail, waited) in scenarios(c).items():
        check('race: ' + name.replace('_', ' '), ok, detail)
        check('race: ' + name.replace('_', ' ') + ', the second session waited on the account lock', waited, detail)
    for name, (ok, detail) in rules(c).items():
        check('rule: ' + name.replace('_', ' '), ok, detail)
    c.close()
    if mutate:
        print('the same races with social.lock() made a no-op: they should go wrong, which shows the tests see the bug')
        c = fresh(mutate=True)
        seen = scenarios(c, expect_safe=False)
        wrong = [k for k, (ok, _, _w) in seen.items() if not ok]
        check('without the account lock, the races that write after a check go wrong (%d of %d: %s)' % (len(wrong), len(seen), ', '.join(wrong)),
              {'block_vs_note', 'withdraw_vs_note', 'age_withdraw_vs_accept', 'capacity_two_phones', 'unfriend_vs_note'} <= set(wrong), seen)
        c.close()
    if dry:
        print('the rolled-back dry run, against the local copy')
        c = fresh()
        owner = uuid.uuid4()
        c.execute("insert into auth.users (id, email) values (%s, 'owner@example.invalid')", [owner])
        c.execute("insert into staff.admin_accounts (user_id, email, role) values (%s, 'owner@example.invalid', 'owner')", [owner])
        c.autocommit = False
        try:
            c.execute(open(os.path.join(ROOT, 'tools', 'db', 'plaza_friends_dryrun.sql')).read())
            check('local dry run raised its RESULT', False, 'no RESULT')
        except psycopg.Error as e:
            m = re.search(r'RESULT (\{.*\})', str(e), re.S)
            res = json.loads(m.group(1)) if m else {}
            bad = [k for k, v in (res.get('checks') or {}).items() if v is not True]
            check('local dry run: %s of %s checks, missing %s, failing %s' % (res.get('count'), res.get('expected'), res.get('missing'), bad), res.get('all') is True, str(e)[:400])
        c.rollback(); c.close()
    failed = [r for r in results if not r[1]]
    print('\n%d passed, %d failed' % (len(results) - len(failed), len(failed)))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
