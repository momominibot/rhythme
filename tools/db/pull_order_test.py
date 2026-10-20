#!/usr/bin/env python3
"""Commit-order tests for the cloud pull, on a throwaway local Postgres (never the live project).

The live trigger stamps synced_at = now(), the start time of the writing transaction. These tests hold one real
transaction open while another commits, then pull the way each client version does:
  - the (synced_at, id) keyset the app sends today through PostgREST, which these tests show losing rows, and
  - public.entries_pull from 20261020120000_sync_pull_commit_order.sql, which must lose none.
`--mutate` reloads entries_pull without its fence (the sync_xid < pg_snapshot_xmin(...) test) and expects the first race
to lose rows again, which shows the tests can see the bug the fence guards against.

Setup (once):  brew install postgresql@17; initdb -D DIR -U postgres --auth=trust;
               LC_ALL=en_US.UTF-8 pg_ctl -D DIR -o "-p 55432 -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" start
               python -m pip install "psycopg[binary]"
Usage:         python3 tools/db/pull_order_test.py [--mutate]      (RACE_DSN overrides host/port/user)
"""
import json, os, sys, time, uuid
from datetime import datetime, timedelta
import psycopg

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DSN = os.environ.get('RACE_DSN', 'host=127.0.0.1 port=55432 user=postgres')
DB = 'pull_order'
MIG = os.path.join(ROOT, 'supabase', 'migrations')
BEFORE = ['20261018110000_sync.sql', '20261019000000_accounts_sync_tombstones.sql', '20261019010000_accounts_sync_order_guard.sql', '20261019120000_exercise_entries.sql']
NEW = '20261020120000_sync_pull_commit_order.sql'
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('  ok   ' if ok else '  FAIL ') + name + ('' if ok else '  ' + str(detail)[:400]))


def admin():
    return psycopg.connect(DSN + ' dbname=' + DB, autocommit=True)


class Phone:
    """One signed-in person's connection. Each call runs as that person (role authenticated, auth.uid() = who), in its
    own transaction unless `keep` leaves it open, as a long upload would."""
    def __init__(self, who):
        self.who = who
        self.c = psycopg.connect(DSN + ' dbname=' + DB)
        self.open = False

    def _as_me(self):
        if not self.open:
            self.c.execute("select set_config('request.jwt.claims', %s, true)", [json.dumps({'sub': str(self.who), 'role': 'authenticated'})])
            self.c.execute('set local role authenticated')
            self.open = True

    def run(self, sql, params=(), keep=False):
        self._as_me()
        cur = self.c.execute(sql, params)
        out = cur.fetchall() if cur.description else None
        if not keep:
            self.commit()
        return out

    def upload(self, ids, keep=False):
        self._as_me()
        for i in ids:
            self.c.execute("insert into public.entries (id, user_id, type, date, data, source, created_at, updated_at) values (%s, %s, 'reflection', '2026-10-20', '{}'::jsonb, 'test', now(), now())", [i, self.who])
        if not keep:
            self.commit()

    def commit(self):
        self.c.commit()
        self.open = False

    def close(self):
        self.c.close()


def legacy_pull(phone, cur):
    """What the app sends today: GET /entries?order=synced_at.asc,id.asc&or=(synced_at.gt.X,and(synced_at.eq.X,id.gt.Y)).
    Returns (rows, new cursor). PostgREST adds nothing but the row level policy, which the role switch applies here."""
    sql = 'select id, synced_at from public.entries'
    params = []
    if cur:
        sql += ' where (synced_at > %s or (synced_at = %s and id > %s))'
        params = [cur[0], cur[0], cur[1]]
    rows = phone.run(sql + ' order by synced_at, id limit 1000', params)
    return [r[0] for r in rows], ((rows[-1][1], rows[-1][0]) if rows else cur)


def new_pull(phone, cur, since=None, limit=1000, handover=None, tcur=None):
    """One entries_pull page, and the cursor ovu-sync.js keeps after it: the last row of a full page; otherwise the fence,
    unless the cursor is already there."""
    res = phone.run('select public.entries_pull(%s, %s, %s, %s, %s, %s, %s, %s)', [cur[0] if cur else None, cur[1] if cur else None, since[0] if since else None, since[1] if since else None, handover, tcur[0] if tcur else None, tcur[1] if tcur else None, limit])[0][0]
    rows = res['rows']
    last = (rows[-1]['sync_xid'], rows[-1]['id']) if rows else cur
    if len(rows) == limit:
        cur = last
    elif not last or int(res['fence']) > int(last[0]):
        cur = (res['fence'], None)
    else:
        cur = last
    return rows, cur, res


def sync_pull(phone, cur, since=None, hand=None, tcur=None, limit=1000, cap=20000):
    """One sync the way ovu-sync.js runs it: pages until one comes back short or the cap is reached, starting a hand-over
    with the first page's snapshot when an older time cursor is given, and dropping the hand-over once the cursor reaches
    that snapshot's xmax. Returns (rows, cursor, (since, snapshot) or None, the last page's time_safe)."""
    got = []
    while True:
        rows, cur, res = new_pull(phone, cur, since, limit, hand, tcur)
        if since and hand is None:
            hand = res['snapshot']
        got += rows
        if len(rows) < limit or len(got) >= cap:
            break
    if hand and int(cur[0]) >= int(hand.split(':')[1]):
        since, hand = None, None
    ts = res['time_safe']
    return got, cur, ((since, hand) if since else None), ((datetime.fromisoformat(ts['at']), ts['id']) if ts else None)


def new_pull_all(phone, cur, since=None, limit=1000):
    got, cur, _, _ = sync_pull(phone, cur, since, limit=limit)
    return got, cur


def fresh(mutate=False):
    with psycopg.connect(DSN + ' dbname=postgres', autocommit=True) as c:
        c.execute('drop database if exists %s with (force)' % DB)
        c.execute('create database %s' % DB)
    c = admin()
    c.execute(open(os.path.join(ROOT, 'tools', 'db', 'local_stub.sql')).read())
    for f in BEFORE:
        c.execute(open(os.path.join(MIG, f)).read())
    c.execute('grant select, insert, update, delete on public.entries to authenticated')
    return c


def person(c):
    u = uuid.uuid4()
    c.execute("insert into auth.users (id, email, aud, role) values (%s, %s, 'authenticated', 'authenticated')", [u, 'pull-%s@example.invalid' % u])
    return u


def apply_new(c, mutate=False):
    sql = open(os.path.join(MIG, NEW)).read()
    if mutate:
        fence = '      and e.sync_xid < fence\n'
        assert sql.count(fence) == 1
        sql = sql.replace(fence, '')
    c.execute(sql)


def main():
    mutate = '--mutate' in sys.argv
    c = fresh()
    ann, bea = person(c), person(c)

    # ---- before the migration: Ann's older rows, written one transaction at a time, and an older phone's cursor ----
    A0 = Phone(ann)
    for i in ['o1', 'o2', 'o3', 'o4']:
        A0.upload([i]); time.sleep(0.002)
    before = dict(c.execute("select id, synced_at::text from public.entries where user_id = %s", [ann]).fetchall())
    old_cursor = c.execute("select synced_at, id from public.entries where id = 'o2'").fetchone()
    rewritten = c.execute("select relfilenode from pg_class where oid = 'public.entries'::regclass").fetchone()[0]
    apply_new(c, mutate)
    print('the migration%s' % (' (MUTATED: no fence)' if mutate else ''))
    after = dict(c.execute("select id, synced_at::text from public.entries where user_id = %s", [ann]).fetchall())
    xids = set(r[0] for r in c.execute('select sync_xid::text from public.entries').fetchall())
    check('rows written before it get sync_xid 0 and keep their synced_at exactly (no trigger fired, no row moves)', xids == {'0'} and before == after, {'xids': xids, 'changed': [k for k in before if before[k] != after.get(k)]})
    check('entries_pull is STABLE (PostgREST runs it READ ONLY) and only signed-in people may call it', c.execute("select provolatile = 's' and has_function_privilege('authenticated', oid, 'execute') and not has_function_privilege('anon', oid, 'execute') from pg_proc where proname = 'entries_pull'").fetchone()[0])
    A0.upload(['p1'])
    got, _ = new_pull_all(A0, None)
    check('the fence and each sync_xid come back as text, a new row with its own transaction id', all(isinstance(r['sync_xid'], str) for r in got) and [r['id'] for r in got] == ['o1', 'o2', 'o3', 'o4', 'p1'] and got[-1]['sync_xid'] != '0', [(r['id'], r['sync_xid']) for r in got])
    got, _ = new_pull_all(A0, None, since=(old_cursor[0], old_cursor[1]))
    check('an older phone\'s (synced_at, id) cursor: the rows after it, nothing it already had', [r['id'] for r in got] == ['o3', 'o4', 'p1'], [r['id'] for r in got])
    got, _ = new_pull_all(A0, None, since=(old_cursor[0], None))
    check('an older millisecond cursor (no id) takes that instant inclusively', [r['id'] for r in got] == ['o2', 'o3', 'o4', 'p1'], [r['id'] for r in got])

    # ---- race 1: a long upload starts first and commits after a small one from another phone ----
    print('race 1: a long upload commits behind the cursor')
    R = Phone(ann)
    leg_cur = legacy_pull(R, None)[1]
    _, new_cur = new_pull_all(R, None)
    big, small = Phone(ann), Phone(ann)
    big.upload(['big%03d' % i for i in range(300)], keep=True)       # 300 rows, its transaction stays open
    time.sleep(0.01)
    small.upload(['small'])                                           # starts later, commits first
    leg_rows, leg_cur = legacy_pull(R, leg_cur)
    new_rows, new_cur, res = new_pull(R, new_cur)
    check('while the long upload is open, today\'s pull already moves past the small upload', leg_rows == ['small'], leg_rows)
    if not mutate:
        check('entries_pull holds the small upload back behind the fence (its id is above the open one)', new_rows == [] and new_cur[1] is None, {'rows': [r['id'] for r in new_rows], 'cursor': new_cur, 'fence': res['fence']})
    big.commit()
    leg_rows2, _ = legacy_pull(R, leg_cur)
    got, new_cur = new_pull_all(R, new_cur)
    got_ids = [r['id'] for r in new_rows] + [r['id'] for r in got]
    check('today\'s pull never sees the 300 rows that committed behind its cursor (the gap, on real Postgres)', leg_rows2 == [], leg_rows2[:5])
    want = sorted(['big%03d' % i for i in range(300)] + ['small'])
    if mutate:
        check('MUTATED (no fence): entries_pull loses the long upload too', sorted(got_ids) != want, len(got_ids))
    else:
        check('entries_pull delivers all 301 rows once the long upload commits, each exactly once', sorted(got_ids) == want and len(got_ids) == len(set(got_ids)), len(got_ids))

    # ---- race 2: a transaction that starts first but writes last (its id comes at its first write) ----
    print('race 2: a transaction that reads first and writes last')
    late, quick = Phone(ann), Phone(ann)
    late.run('select 1', keep=True)                                   # its now() is fixed here, it has no id yet
    time.sleep(0.01)
    quick.upload(['quick'])
    leg_rows, leg_cur = legacy_pull(R, leg_cur)
    new_rows, new_cur = new_pull_all(R, new_cur)
    late.upload(['late'])                                             # synced_at before 'quick', id after it
    leg_rows2, _ = legacy_pull(R, leg_cur)
    new_rows2, new_cur = new_pull_all(R, new_cur)
    check('today\'s pull loses the row stamped with the earlier start time', leg_rows == ['quick'] and leg_rows2 == [], {'first': leg_rows, 'then': leg_rows2})
    if not mutate:
        check('entries_pull delivers both, in the order their writes became final', [r['id'] for r in new_rows] == ['quick'] and [r['id'] for r in new_rows2] == ['late'], {'first': [r['id'] for r in new_rows], 'then': [r['id'] for r in new_rows2]})

    if not mutate:
        # ---- race 3: the hand-over from an older phone's time cursor, with a write still open (Codex round two, nit) ----
        print('race 3: the hand-over from the time cursor, with a write still open below it')
        cara = person(c)

        def race3(second_since, second_hand):
            """The open write starts first and writes first (its id below the two later writes), then the older version
            pulls seen1 and seen2 and its cursor sits on seen2. Returns what each of two syncs delivered, and the state."""
            ow = Phone(cara); ow.run('select 1', keep=True)
            time.sleep(0.01)
            ow.upload(['inflight-%s' % second_hand], keep=True)
            x_open = ow.run('select pg_current_xact_id()::text', keep=True)[0][0]
            a1 = Phone(cara); a1.upload(['seen1-%s' % second_hand])
            a2 = Phone(cara); a2.upload(['seen2-%s' % second_hand])
            c_old = c.execute("select synced_at, id from public.entries where id = %s", ['seen2-%s' % second_hand]).fetchone()
            P = Phone(cara)
            got1, cur, hs, _ = sync_pull(P, None, since=c_old)
            ow.commit()
            since2 = {'keep': c_old, 'drop': None}.get(second_since, hs[0] if hs else None)
            hand2 = (hs[1] if hs else None) if second_hand == 'keep' else None
            got2, cur2, hs2, _ = sync_pull(P, cur, since=since2, hand=hand2)
            for ph in (ow, a1, a2, P):
                ph.close()
            return [r['id'] for r in got1], [r['id'] for r in got2], x_open, hs, hs2, cur, cur2

        g1, g2, x_open, hs, hs2, cur, cur2 = race3('client', 'keep')
        xip = hs[1].split(':')[2].split(',') if hs else []
        check('the open write\'s transaction is in the hand-over snapshot\'s xip, and the first sync keeps the hand-over (cursor below xmax)', hs is not None and x_open in xip and int(cur[0]) < int(hs[1].split(':')[1]), {'hs': hs, 'x_open': x_open, 'cursor': cur})
        check('the next sync delivers the open write once it commits, never the two rows the older version pulled, then drops the hand-over', g1 == [] and g2 == ['inflight-keep'] and hs2 is None, {'first': g1, 'second': g2, 'hs2': hs2})
        g1, g2, _, _, _, _, _ = race3('keep', 'own')
        check('without the carried snapshot (the second sync uses its own) that open write is dropped', 'inflight-own' not in g1 + g2, {'first': g1, 'second': g2})
        g1, g2, _, _, _, _, _ = race3('drop', 'drop')
        check('and ending the hand-over at the first short page (the first fix) would send the pulled rows again', 'seen1-drop' in g2 and 'seen2-drop' in g2, {'first': g1, 'second': g2})

        # ---- race 4: the time cursor the server certifies (Codex round two, findings 1 and 2) ----
        print('race 4: time_safe')
        dana = person(c)
        T3 = Phone(dana)
        T3.upload(['ta', 'tb', 'tc'])                                   # one transaction: one synced_at for all three
        at = c.execute("select synced_at from public.entries where id = 'ta'").fetchone()[0]
        D = Phone(dana)
        got, _, _, ts = sync_pull(D, None, since=(at, 'ta'), tcur=(at, 'ta'))
        check('three rows on one instant, older cursor on the first: the hand-over sends the other two and certifies the last of them', [r['id'] for r in got] == ['tb', 'tc'] and ts is not None and ts[1] == 'tc', {'got': [r['id'] for r in got], 'time_safe': ts})
        got, _, _, ts2 = sync_pull(D, None, tcur=(at + timedelta(days=1), 'zz'))
        check('time_safe never goes back past the time cursor the phone sent', ts2 is not None and ts2[1] == 'zz', ts2)
        erin = person(c)
        Y = Phone(erin); Y.run('select 1', keep=True)                    # begins first, writes last
        time.sleep(0.01)
        X = Phone(erin); X.upload(['x%04d' % i for i in range(1500)])   # 1,500 rows, committed, lower id
        Y.upload(['early'])                                             # stamped before X's rows, id after them
        E = Phone(erin)
        got, cur, _, ts = sync_pull(E, None, cap=1000)                  # the cap stops after one page
        early_at = c.execute("select synced_at from public.entries where id = 'early'").fetchone()[0]
        check('with backlog past the cap, time_safe stays before the undelivered earlier row', len(got) == 1000 and (ts is None or ts[0] < early_at), {'n': len(got), 'time_safe': ts, 'early': str(early_at)})
        leg, _ = legacy_pull(E, ts)
        check('so a pull by time from it still brings that row', 'early' in leg, leg[:3])
        got2, cur, _, ts3 = sync_pull(E, cur, tcur=ts)
        last = c.execute("select synced_at, id from public.entries where user_id = %s order by synced_at desc, id desc limit 1", [erin]).fetchone()
        check('once everything is delivered, time_safe is the last row by (synced_at, id)', ts3 == (last[0], last[1]) and 'early' in [r['id'] for r in got2], {'time_safe': ts3, 'last': last})
        for ph in (T3, D, Y, X, E):
            ph.close()

    if not mutate:
        # ---- paging inside one transaction, other people's rows, read only, the order guard ----
        print('paging, privacy and the order guard')
        P = Phone(bea)
        P.upload(['bea%04d' % i for i in range(2500)])
        pages, cur = [], None
        while True:
            rows, cur, _ = new_pull(P, cur)
            pages.append(len(rows))
            if len(rows) < 1000:
                break
        seen = [r['id'] for r in new_pull_all(P, None)[0]]
        check('2,500 rows from one transaction (one sync_xid) page by id: 1000, 1000, 500, each once', pages == [1000, 1000, 500] and len(seen) == 2500 == len(set(seen)), pages)
        check('Bea never receives Ann\'s rows, nor Ann Bea\'s', all(i.startswith('bea') for i in seen) and not any(r['id'].startswith('bea') for r in new_pull_all(R, None)[0]))
        ro = psycopg.connect(DSN + ' dbname=' + DB)
        ro.execute('set transaction read only')
        ro.execute("select set_config('request.jwt.claims', %s, true)", [json.dumps({'sub': str(bea), 'role': 'authenticated'})])
        ro.execute('set local role authenticated')
        n = len(ro.execute('select public.entries_pull(null, null, null, null, null, null, null, 10)').fetchone()[0]['rows'])
        ro.rollback(); ro.close()
        check('it runs in a READ ONLY transaction, as PostgREST runs a STABLE function', n == 10, n)
        try:
            anon = psycopg.connect(DSN + ' dbname=' + DB)
            anon.execute('set local role anon')
            anon.execute('select public.entries_pull()')
            check('anonymous callers are refused', False, 'it ran')
        except psycopg.errors.InsufficientPrivilege:
            check('anonymous callers are refused', True)
        x0 = c.execute("select sync_xid::text from public.entries where id = 'p1'").fetchone()[0]
        A0.run("update public.entries set data = '{\"stale\":1}', updated_at = updated_at - interval '1 day' where id = 'p1'")
        x1 = c.execute("select sync_xid::text, data from public.entries where id = 'p1'").fetchone()
        A0.run("update public.entries set data = '{\"newer\":1}', updated_at = updated_at + interval '1 day' where id = 'p1'")
        x2 = c.execute("select sync_xid::text from public.entries where id = 'p1'").fetchone()[0]
        check('a stale write that loses keeps the row\'s sync_xid; a newer write moves it on', x1[0] == x0 and x1[1] == {} and int(x2) > int(x0), {'x0': x0, 'stale': x1, 'newer': x2})
        idx = c.execute("select count(*) from pg_indexes where indexname = 'entries_user_sync_xid'").fetchone()[0]
        check('the (user_id, sync_xid, id) index exists (xid8 has a btree operator class)', idx == 1)
        check('adding the column did not rewrite the table (a constant default)', c.execute("select relfilenode from pg_class where oid = 'public.entries'::regclass").fetchone()[0] == rewritten)

    for p in (A0, R, big, small, late, quick):
        p.close()
    c.close()
    failed = [n for n, ok in results if not ok]
    print('\n%d passed, %d failed' % (len(results) - len(failed), len(failed)))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
