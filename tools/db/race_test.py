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
"""
import json, os, re, sys, threading, time, uuid
import psycopg

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DSN = os.environ.get('RACE_DSN', 'host=127.0.0.1 port=55432 user=postgres')
DB = 'friends_race'
MIG = os.path.join(ROOT, 'supabase', 'migrations')
PLAZA = ['20261019080000_plaza_presence.sql', '20261019090000_plaza_presence_v2.sql', '20261019100000_plaza_groups.sql', '20261019110000_plaza_visits.sql']
FRIENDS = '20261019130000_plaza_friends.sql'
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('  ok   ' if ok else '  FAIL ') + name + ('' if ok else '  ' + str(detail)[:300]))


def fresh(mutate=False):
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
    if mutate:
        c.execute("create or replace function social.lock(p_a uuid, p_b uuid default null) returns void language plpgsql as $$ begin end $$")
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
    seen['block_vs_note'] = (w and r2.get('why') == 'gone' and note == 0, {'block': r1, 'note': r2, 'waited': w, 'notes': note})

    # 2. a note against Plaza friends turned off by the recipient (any route: the general consent call)
    A = person(c, 'Ada', 'pcos'); B = person(c, 'Bo', 'pcos', friends_with=A)
    r1, r2, w = race((B['id'], "select public.consent_record('social', 'withdraw', 3)", []), (A['id'], 'select public.social_note(%s, %s)', [B['handle'], 'tea']))
    note = one(c, 'select count(*) from public.social_notes where to_user = %s', [B['id']])
    seen['withdraw_vs_note'] = (w and r2.get('why') == 'gone' and note == 0, {'note': r2, 'waited': w, 'notes': note})

    # 3. accepting an ask against the asker withdrawing 18+
    A = person(c, 'Aya', 'pcos'); B = person(c, 'Bel', 'pcos')
    c.execute("insert into public.social_requests (from_user, to_user) values (%s, %s)", [B['id'], A['id']])
    r1, r2, w = race((B['id'], "select public.consent_record('age_18', 'withdraw', 3)", []), (A['id'], 'select public.social_answer(%s, true)', [B['handle']]))
    fr = one(c, 'select count(*) from public.social_friends where a = least(%s::uuid, %s::uuid) and b = greatest(%s::uuid, %s::uuid)', [A['id'], B['id'], A['id'], B['id']])
    seen['age_withdraw_vs_accept'] = (w and r2.get('why') == 'gone' and fr == 0, {'answer': r2, 'waited': w, 'friends': fr})

    # 4. one account accepting two asks from two phones at 199 friends: the second waits and finds 200
    X = person(c, 'Xia', 'pcos')
    c.execute("insert into auth.users (id, email) select gen_random_uuid(), 'race-filler-' || g || '@example.invalid' from generate_series(1, 199) g")
    c.execute("insert into public.social_friends (a, b) select least(%s::uuid, u.id), greatest(%s::uuid, u.id) from auth.users u where u.email like 'race-filler-%%' and u.id not in (select a from public.social_friends where b = %s union select b from public.social_friends where a = %s) limit 199", [X['id'], X['id'], X['id'], X['id']])
    P1 = person(c, 'Pia', 'pcos'); P2 = person(c, 'Pam', 'pcos')
    c.execute("insert into public.social_requests (from_user, to_user) values (%s, %s), (%s, %s)", [P1['id'], X['id'], P2['id'], X['id']])
    r1, r2, w = race((X['id'], 'select public.social_answer(%s, true)', [P1['handle']]), (X['id'], 'select public.social_answer(%s, true)', [P2['handle']]))
    n = one(c, 'select count(*) from public.social_friends where a = %s or b = %s', [X['id'], X['id']])
    seen['capacity_two_phones'] = (w and r1.get('status') == 'friends' and r2.get('why') == 'full' and n == 200, {'first': r1, 'second': r2, 'waited': w, 'friends': n})

    # 5. two staff decisions on one report: the second waits, then finds it decided; the pause stands
    O = person(c, 'Own'); T = person(c, 'Tam', 'pcos'); Rr = person(c, 'Rae', 'pcos')
    c.execute("insert into staff.admin_accounts (user_id, email, role) values (%s, 'owner@example.invalid', 'owner')", [O['id']])
    rid = one(c, "insert into staff.social_reports (reporter, target, target_handle, target_name, reason) values (%s, %s, %s, 'Tam', 'unkind') returning id", [Rr['id'], T['id'], T['handle']])
    r1, r2, w = race((O['id'], 'select public.admin_social_decide(%s, %s, 3)', [rid, 'pause']), (O['id'], 'select public.admin_social_decide(%s, %s, null)', [rid, 'dismiss']))
    st = one(c, 'select status from staff.social_reports where id = %s', [rid]); held = one(c, 'select count(*) from public.social_holds where user_id = %s', [T['id']])
    seen['staff_decisions'] = (w and r1.get('ok') is True and r2.get('ok') is False and st == 'paused' and held == 1, {'first': r1, 'second': r2, 'waited': w, 'status': st, 'hold': held})

    # 6. two people asking each other at once: friends once, no ask left over
    A = person(c, 'Amy', 'pcos'); B = person(c, 'Bex', 'pcos')
    r1, r2, w = race((A['id'], 'select public.social_ask(%s, %s, %s, null)', [B['handle'], 'pcos', A['visit']]), (B['id'], 'select public.social_ask(%s, %s, %s, null)', [A['handle'], 'pcos', B['visit']]))
    fr = one(c, 'select count(*) from public.social_friends where a = least(%s::uuid, %s::uuid) and b = greatest(%s::uuid, %s::uuid)', [A['id'], B['id'], A['id'], B['id']])
    left = one(c, 'select count(*) from public.social_requests where from_user in (%s, %s)', [A['id'], B['id']])
    seen['mutual_asks'] = (w and r1.get('status') == 'asked' and r2.get('status') == 'friends' and fr == 1 and left == 0, {'first': r1, 'second': r2, 'waited': w, 'friends': fr, 'left': left})

    # 7. a note against an unfriend
    A = person(c, 'Ari', 'pcos'); B = person(c, 'Bay', 'pcos', friends_with=A)
    r1, r2, w = race((B['id'], 'select public.social_unfriend(%s)', [A['handle']]), (A['id'], 'select public.social_note(%s, %s)', [B['handle'], 'hug']))
    note = one(c, 'select count(*) from public.social_notes where from_user = %s', [A['id']])
    seen['unfriend_vs_note'] = (w and r2.get('why') == 'gone' and note == 0, {'note': r2, 'waited': w, 'notes': note})

    # 8. an ask against the other person turning Plaza friends off
    A = person(c, 'Abi', 'pcos'); B = person(c, 'Bia', 'pcos')
    r1, r2, w = race((B['id'], 'select public.social_off(3)', []), (A['id'], 'select public.social_ask(%s, %s, %s, null)', [B['handle'], 'pcos', A['visit']]))
    req = one(c, 'select count(*) from public.social_requests where from_user = %s', [A['id']])
    seen['off_vs_ask'] = (w and r2.get('why') == 'gone' and req == 0, {'ask': r2, 'waited': w, 'requests': req})
    return seen


def main():
    mutate, dry = '--mutate' in sys.argv, '--dryrun' in sys.argv
    print('Plaza friends races on a local copy (two real sessions each)')
    c = fresh()
    for name, (ok, detail) in scenarios(c).items():
        check('race: ' + name.replace('_', ' '), ok, detail)
    c.close()
    if mutate:
        print('the same races with social.lock() made a no-op: they should go wrong, which shows the tests see the bug')
        c = fresh(mutate=True)
        seen = scenarios(c, expect_safe=False)
        wrong = [k for k, (ok, _) in seen.items() if not ok]
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
