#!/usr/bin/env python3
"""The staff pipeline, end to end, on a throwaway local Postgres (never the live project): synthetic accounts only.

Loads the stand-in (tools/db/local_stub.sql), the real sync, consent and staff migrations in order, then the phase 0 data
contract (20261021100000_staff_data_contract_v3.sql), and drives the path a real account would take: consent through
analysis_consent_set as that account, entries written as that account, a run as a staff owner, findings read through
admin_overview. Cases (docs/design/2026-10-21-data-capture-live-path-and-future-proofing.md, phase 0 step 6): no consent,
backup only, 19 and 20 contributors, malformed values, history after consent, a repeat grant, an old notice, no adult
attestation, withdrawal, a deleted entry after publication, one-person numerators, the phone's period rule, the window
bounds, units, missing is not zero, several sleep records, the shared run lock, the scheduled entry point and its due
key, and the API roles that may not call it.

Setup (once):  brew install postgresql@17; LC_ALL=C initdb -D DIR -U postgres --auth=trust --locale=C;
               LC_ALL=C pg_ctl -D DIR -l DIR/pg.log -o "-p 55432 -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" start
               python -m pip install "psycopg[binary]"
Usage:         python3 tools/db/test_team_pipeline.py      (PIPE_DSN overrides host/port/user)
"""
import datetime, json, os, sys, threading, time, uuid
import psycopg

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DSN = os.environ.get('PIPE_DSN', "host=127.0.0.1 port=55432 user=postgres options='-c statement_timeout=30000 -c lock_timeout=10000'")
DB = 'team_pipeline'
MIG = os.path.join(ROOT, 'supabase', 'migrations')
ORDER = ['20261018110000_sync.sql', '20261019000000_accounts_sync_tombstones.sql', '20261019010000_accounts_sync_order_guard.sql',
         '20261019030000_team_dashboard.sql', '20261019040000_team_dashboard_floor.sql', '20261019050000_consent_events.sql', '20261019060000_consent_events_v2.sql',
         '20261019070000_consent_guard_v3.sql', '20261019120000_exercise_entries.sql', '20261019140000_consent_guard_until_release.sql', '20261019150000_consent_guard_v3_after_release.sql',
         '20261021100000_staff_data_contract_v3.sql']
results = []
TODAY = None


def check(name, ok, detail=''):
    results.append((name, bool(ok)))
    print(('  ok   ' if ok else '  FAIL ') + name + ('' if ok else '  ' + str(detail)[:400]))


def load_sql(c, path):
    sql = open(path).read()
    sql = sql.replace('create extension if not exists pg_cron;', '-- (pg_cron is a stand-in locally)')
    c.execute(sql)


def fresh():
    with psycopg.connect(DSN + ' dbname=postgres', autocommit=True) as c:
        c.execute('drop database if exists %s with (force)' % DB)
        c.execute('create database %s' % DB)
    c = psycopg.connect(DSN + ' dbname=' + DB, autocommit=True)
    c.execute(open(os.path.join(ROOT, 'tools', 'db', 'local_stub.sql')).read())
    # the Luna relay migration needs Supabase Vault; the staff code only counts its usage buckets, so a stand-in table does
    c.execute("alter table auth.users add column if not exists email_confirmed_at timestamptz default now(), add column if not exists created_at timestamptz default now(), add column if not exists raw_user_meta_data jsonb default '{}'::jsonb")
    c.execute("create table if not exists public.luna_usage (bucket text not null, day date not null default current_date, count integer not null default 0, primary key (bucket, day))")
    for f in ORDER:
        try:
            load_sql(c, os.path.join(MIG, f))
        except Exception as e:
            print('migration failed:', f, str(e)[:300]); raise
    return c


def as_user(c, uid):
    """run the next statements as that signed-in account (RLS and auth.uid() see the claims)"""
    c.execute("select set_config('request.jwt.claims', %s, false)", [json.dumps({'sub': str(uid), 'role': 'authenticated'})])
    c.execute("set role authenticated")


def as_server(c):
    c.execute("reset role")
    c.execute("select set_config('request.jwt.claims', '', false)")


def person(c, band='30-34', attest=True):
    u = uuid.uuid4()
    as_server(c)
    c.execute("insert into auth.users (id, email, aud, role) values (%s, %s, 'authenticated', 'authenticated')", [u, 'pipe-%s@example.invalid' % u])
    if attest:
        c.execute("insert into public.consent_events (user_id, purpose, action, notice_version, method) values (%s, 'age_18', 'grant', 3, 'sheet'), (%s, 'cloud_sync', 'grant', 3, 'sheet')", [u, u])
    return {'id': u, 'band': band}


def consent(c, p, on=True, notice=3, band=None, scope='from_now'):
    as_user(c, p['id'])
    try:
        r = c.execute("select public.analysis_consent_set(%s, %s, %s, %s)", [on, notice, band if band is not None else p['band'], scope]).fetchone()[0]
        as_server(c); return r
    except Exception as e:
        as_server(c); return {'error': str(e)}


def entry(c, p, typ, date, data, created=None, source='room'):
    as_server(c)
    eid = 'e-' + uuid.uuid4().hex[:12]
    c.execute("insert into public.entries (id, user_id, type, date, data, source, created_at, updated_at) values (%s, %s, %s, %s, %s, %s, coalesce(%s, now()), now())", [eid, p['id'], typ, date, json.dumps(data), source, created])
    return eid


def staff_owner(c):
    o = person(c)
    c.execute("insert into staff.admin_accounts (user_id, email, role) values (%s, %s, 'owner')", [o['id'], 'owner-%s@example.invalid' % o['id']])
    return o


def run(c, owner, days=28):
    as_user(c, owner['id'])
    r = c.execute("select public.admin_run(%s)", [days]).fetchone()[0]
    as_server(c); return r


def overview(c, owner):
    as_user(c, owner['id'])
    r = c.execute("select public.admin_overview()").fetchone()[0]
    as_server(c); return r


def finding(ov, agent, metric):
    for f in (ov.get('latest') or {}).get(agent, []):
        if f['metric'] == metric: return f
    return None


def d(n):
    return (TODAY - datetime.timedelta(days=n)).isoformat()


def main():
    global TODAY
    c = fresh()
    TODAY = c.execute("select (now() at time zone 'Asia/Singapore')::date").fetchone()[0]
    owner = staff_owner(c)
    k = c.execute("select staff.k_floor()").fetchone()[0]
    check('the floor stays 20 and the registry is the metric version authority', k == 20 and c.execute("select staff.metric_version()").fetchone()[0] == 3 and c.execute("select value from staff.agent_policy where key = 'metric_version'").fetchone()[0] == 3)

    # 1. no consent: a run reads nothing and says so
    r = run(c, owner); ov = overview(c, owner)
    e = finding(ov, 'cycle', 'eligible_people')
    check('no consent: the run records readiness only, every stream not_enabled, no diary table was projected', r.get('ok') and r['summary']['measured'] is False and e and e['state'] == 'not_enabled' and 'No eligible adult' in (e.get('prerequisite') or ''), r)

    # 2. the consent contract
    p = person(c)
    old = consent(c, p, notice=2)
    check('an older notice than the registry is refused', 'error' in old and 'older notice' in old['error'], old)
    nob = person(c, attest=False)
    noa = consent(c, nob, band='')
    check('no adult attestation and no adult band is refused', 'error' in noa and '18 or older' in noa['error'], noa)
    ok1 = consent(c, p)
    acc1 = c.execute("select accepted_at from public.analysis_consent where user_id = %s", [p['id']]).fetchone()[0]
    time.sleep(0.05); ok2 = consent(c, p)
    acc2 = c.execute("select accepted_at from public.analysis_consent where user_id = %s", [p['id']]).fetchone()[0]
    ev = c.execute("select count(*) from public.consent_events where user_id = %s and purpose = 'improve_logging' and action = 'grant'", [p['id']]).fetchone()[0]
    check('a grant writes the consent event in the same transaction, and a repeat grant keeps its original accepted date', ok1.get('adult_attested_by') == 'age_18 event' and acc1 == acc2 and ev == 2, {'ok1': ok1, 'acc': [str(acc1), str(acc2)], 'events': ev})
    band_only = person(c, attest=False); bo = consent(c, band_only, band='25-29')
    check('an adult band from the phone attests when no age_18 event exists, and is recorded as such', bo.get('adult_attested_by') == 'age band', bo)
    consent(c, band_only, on=False)  # out again, so the counts below are exact

    # 3. under the floor: 19 consenting adults with entries are held back, exact count never shown
    people = [p] + [person(c) for _ in range(18)]
    for q in people[1:]: consent(c, q)
    def diary(q):
        # three bleeding episodes: days 60, 59, 57 (one episode: 57 is within two days of 59, the phone's rule), 30 and 29, then 3 and 2;
        # a spotting day at 45 that must never start a cycle; cycles 30 and 27 days, so each account's median is 28.5
        for n in (60, 59, 57, 30, 29, 3, 2): entry(c, q, 'period', d(n), {'flow': 'heavy' if n in (60, 30, 3) else 'light'})
        entry(c, q, 'period', d(45), {'flow': 'spotting'})
        entry(c, q, 'sleep', d(5), {'hours': 7}); entry(c, q, 'sleep', d(9), {'hours': 6}); entry(c, q, 'sleep', d(9), {'hours': 1, 'nap': True})
        entry(c, q, 'mindfulness', d(4), {'minutes': 10, 'completed': True}); entry(c, q, 'mindfulness', d(6), {'minutes': 'abc', 'completed': True})
    for q in people: diary(q)
    r = run(c, owner); ov = overview(c, owner); e = finding(ov, 'cycle', 'eligible_people'); pdays = finding(ov, 'cycle', 'period_days')
    check('19 eligible adults: readiness says insufficient with no exact count, every metric is held back with null value and people', e['state'] == 'insufficient' and e['value'] is None and pdays['suppressed'] and pdays['value'] is None and pdays['people'] is None and r['summary']['under_floor'] is True and r['summary']['eligible'] is None, {'e': e, 'p': pdays})

    # 4. the twentieth adult: measured, with the phone's period rule, units, bounds, missing not zero
    p20 = person(c); consent(c, p20); diary(p20)
    entry(c, p20, 'period', d(0), {'flow': 'medium'})     # today: outside the completed-dates window
    entry(c, p20, 'mindfulness', d(7), {'minutes': 900, 'completed': True})     # implausible: missing, not zero
    entry(c, p20, 'mindfulness', d(8), {'minutes': 20})                         # no completed field: out of the completed denominator
    r = run(c, owner); ov = overview(c, owner); e = finding(ov, 'cycle', 'eligible_people')
    pdays = finding(ov, 'cycle', 'period_days'); starts = finding(ov, 'cycle', 'people_with_two_starts'); med = finding(ov, 'cycle', 'median_cycle_days')
    mins = finding(ov, 'mind', 'practice_minutes'); miss = finding(ov, 'mind', 'practices_missing_duration'); comp = finding(ov, 'mind', 'completed_share'); sev = finding(ov, 'sleep', 'nights_with_several_records')
    check('20 eligible adults: readiness measured, exact count shown, window has both bounds in Singapore dates', e['state'] == 'measured' and e['value'] == 20 and r['summary']['window_start'] == d(28) and r['summary']['window_end_exclusive'] == d(0) and r['summary']['report_tz'] == 'Asia/Singapore', r['summary'])
    check("period days count bleeding account-days inside 28 completed dates (today's entry and spotting excluded): 20 x 2 = 40", pdays['value'] == 40 and pdays['people'] == 20 and pdays['unit'] == 'account-days', pdays)
    check("every account has three episode starts, so people_with_two_starts is 20", starts['value'] == 20 and starts['state'] == 'measured', starts)
    check("the phone's episode rule and the spotting rule: cycles are 30 and 27 days, median of each account's median 28.5 (a start at day 57 would give 27, a start on the spotting day 15)", med['value'] is not None and float(med['value']) == 28.5 and med['unit'] == 'days', med)
    check('practice minutes count only valid durations; malformed and implausible durations are counted as missing, never as zero', mins['value'] == 20 * 10 + 20 and miss['value'] == 21 and mins['unit'] == 'minutes', {'mins': mins, 'miss': miss})
    check('completed share leaves practices without the field out of its denominator', comp['value'] == 100.0 and comp['unit'] == 'per cent of practices', comp)
    check('two sleep records on one night are counted as several records, not conflicts', sev['value'] == 20 and sev['state'] == 'measured' and 'naps' in (sev.get('note') or ''), sev)
    check('the latest overview is the valid run and nothing is held', ov['held_runs'] == 0 and ov['latest_run'] == r['run_id'] and ov['scheduled'] is False, {'held': ov['held_runs']})

    # 5. history after consent: a record created before consent never qualifies unless scope is all
    late = person(c); entry(c, late, 'period', d(10), {'flow': 'medium'}, created=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=20))
    consent(c, late)
    r = run(c, owner); ov = overview(c, owner); pdays = finding(ov, 'cycle', 'period_days')
    check('an entry recorded before the consent date is left out under from_now (period days stay 40 with 21 eligible)', pdays['value'] == 40 and finding(ov, 'cycle', 'eligible_people')['value'] == 21, pdays)
    consent(c, late, scope='all')
    r = run(c, owner); ov = overview(c, owner); pdays = finding(ov, 'cycle', 'period_days')
    check('with all history approved that entry counts (41)', pdays['value'] == 41, pdays)

    # 6. withdrawal and deletion hold published runs until the next run
    w = consent(c, people[1], on=False)
    ov = overview(c, owner)
    check('a withdrawal invalidates every published run: the overview holds its results and names the reason', ov['latest_run'] is None and ov['held_runs'] >= 1 and (ov['latest'] or {}) == {} and any(x.get('invalidation_reason') and 'withdrew' in x['invalidation_reason'] for x in ov['runs']), {'held': ov['held_runs'], 'runs': [x.get('invalidation_reason') for x in ov['runs']][:3]})
    r = run(c, owner); ov = overview(c, owner); e = finding(ov, 'cycle', 'eligible_people')
    check('the next run recomputes from what is still authorised (20 eligible) and becomes the valid run', e['value'] == 20 and ov['latest_run'] == r['run_id'] and ov['held_runs'] == 0, e)
    c.execute("update public.entries set deleted = true, deleted_at = now() where user_id = %s and type = 'sleep'", [p20['id']])
    ov = overview(c, owner)
    check('a tombstoned entry of a consenting account holds the published runs too', ov['latest_run'] is None and ov['held_runs'] >= 1, ov['held_runs'])
    run(c, owner)
    c.execute("delete from public.analysis_consent where user_id = %s", [people[2]['id']])
    ov = overview(c, owner)
    check('an account whose consent row disappears (account deletion) holds the runs', ov['latest_run'] is None, ov['held_runs'])

    # 7. counts never read the diary: cloud copies come from receipts
    cnt = overview(c, owner)['counts']
    rec = c.execute("select count(*) from staff.backup_receipts").fetchone()[0]
    check('cloud-copy count comes from backup receipts kept by a trigger, one per account with any entry (19 + p20 + late)', cnt['accounts_with_cloud_copy'] == rec == 21, {'counts': cnt, 'receipts': rec})
    src = open(os.path.join(MIG, ORDER[-1])).read()
    check('svc_counts no longer reads public.entries', 'from public.entries' not in src[src.index('create or replace function staff.svc_counts'):src.index('-- ---------- 6. metrics_build v3')])

    # 8. the scheduled entry point: a due key runs once, API roles cannot call it, the lock is shared with staff presses
    r1 = c.execute("select staff.run_scheduled(current_date)").fetchone()[0]
    r2 = c.execute("select staff.run_scheduled(current_date)").fetchone()[0]
    check('a scheduled attempt runs once per due key; the second is skipped, not retried', r1.get('ok') and r2.get('skipped') is True, {'r1': r1, 'r2': r2})
    for role in ('authenticated', 'anon', 'service_role'):
        c.execute("set role " + role)
        try:
            c.execute("select staff.run_scheduled(current_date)"); denied = False
        except Exception:
            denied = True
        c.execute("reset role")
        check('the %s role cannot call the scheduled entry point' % role, denied)
    as_user(c, owner['id']); cron_like = c.execute("select public.admin_run(28)").fetchone()[0]; as_server(c)
    check('a staff press still works after a scheduled run and reports its duration by clock', cron_like.get('ok') and any(x.get('seconds') is not None for x in overview(c, owner)['runs']), cron_like)
    # a run holds the lock while another path tries to begin
    rid = c.execute("select staff.run_begin('run_now', 'staff', null)").fetchone()[0]  # a staff run left 'running' (its transaction committed)
    blocked = c.execute("select staff.run_scheduled(current_date + 1)").fetchone()[0]
    c.execute("update staff.agent_runs set status = 'failed', error = 'test cleanup', finished_at = now() where id = %s", [rid])
    check('while a staff run is still running the scheduled attempt is skipped (one worker lock and one running run across both paths)', rid is not None and blocked.get('skipped') is True, blocked)

    # 9. one-person numerator and no_data states
    solo = person(c); consent(c, solo); entry(c, solo, 'weight', d(1), {'kg': 60})
    r = run(c, owner); ov = overview(c, owner); wd = finding(ov, 'inventory', 'weight_days'); refl = finding(ov, 'mind', 'reflection_days')
    check('a metric only one account contributes to is held back; a metric nobody contributes to says no_data', wd['suppressed'] and wd['value'] is None and refl['state'] == 'no_data', {'wd': wd, 'refl': refl})

    # 10. the minimised projection never carries notes or the whole JSON
    body = src[src.index('create temp table if not exists pg_temp.elig_rows'):src.index('for rec in')]
    check('the staging projection carries only the fields registered metrics need (no data column, no notes)', 'data jsonb' not in body and "'note'" not in body and 'reflection' not in body.split('insert into pg_temp.elig_rows')[1].split('from public.entries')[0])

    passed = sum(1 for _, ok in results if ok); failed = len(results) - passed
    print('\n%d passed, %d failed' % (passed, failed))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
