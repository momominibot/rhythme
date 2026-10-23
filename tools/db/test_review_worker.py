#!/usr/bin/env python3
"""The review worker's server side, on the same throwaway local Postgres as test_team_pipeline.py (never the live project).

Loads every staff migration plus 20261023140000_staff_review_worker.sql, makes 20 consenting synthetic adults so a run
publishes measured findings, then drives the worker RPCs as anon with a test key and the staff RPCs as an owner: the two
switches, refresh receipts, the claim, per-stage admission and its order, the report contract, idempotent reposts,
finishing, held runs and proposals, failure recording after a lost lease, blocks and their clearing, queue expiry,
superseding, a busy worker, grants, and a two-session race between a withdrawal and a stage admission.

Usage: TZ=UTC python3 tools/db/test_review_worker.py     (same Postgres setup as test_team_pipeline.py)
"""
import hashlib, json, os, sys, threading, time, uuid
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import test_team_pipeline as tp
import psycopg

tp.ORDER = tp.ORDER + ['20261023140000_staff_review_worker.sql']
check = tp.check
KEY = 'k' * 8 + uuid.uuid4().hex + uuid.uuid4().hex  # a test key only
BAD = 'x' * 64


def j(c, sql, args=()):
    return c.execute(sql, list(args)).fetchone()[0]


def as_anon(c):
    c.execute("select set_config('request.jwt.claims', %s, false)", [json.dumps({'role': 'anon'})]); c.execute("set role anon")


def worker(c, fn, *args):
    as_anon(c)
    try:
        ph = ', '.join(['%s'] * len(args))
        return j(c, 'select public.%s(%s)' % (fn, ph), args)
    finally:
        tp.as_server(c)


def staff(c, owner, sql, args=()):
    tp.as_user(c, owner['id'])
    try:
        return j(c, sql, args)
    finally:
        tp.as_server(c)


def refresh(c, owner, rid=None):
    return staff(c, owner, "select public.admin_refresh(28, %s)", [rid or uuid.uuid4().hex])


def report(summary='Period days look steady.', proposals=None, ranking=None):
    r = {'summary': summary, 'notes': [], 'proposals': proposals or []}
    if ranking is not None: r['ranking'] = ranking
    return json.dumps(r)


PROPOSAL = {'kind': 'prompt_copy', 'target': 'calendar_tap', 'metric': 'period_days', 'change': {'line': 'Tap a day to log it'}, 'rationale': 'Logging is steady; a clearer tap line may help people who start late.'}


def run_all_stages(c, job, tok, cycle_props=None, ranking=None):
    out = {}
    for a in ['cycle', 'sleep', 'food', 'mind']:
        b = worker(c, 'worker_stage_begin', KEY, job, tok, a); out[a + '_begin'] = b
        out[a] = worker(c, 'worker_post', KEY, job, tok, a, report(proposals=(cycle_props if a == 'cycle' else None)), json.dumps({'cli': 'codex-cli 0.160.0', 'model': 'gpt-6-astra'}))
    out['orch_begin'] = worker(c, 'worker_stage_begin', KEY, job, tok, 'orchestrator')
    out['orchestrator'] = worker(c, 'worker_post', KEY, job, tok, 'orchestrator', report('Nimbus ranks one proposal.', ranking=ranking if ranking is not None else []), '{}')
    return out


def main():
    c = tp.fresh()
    tp.TODAY = j(c, "select (now() at time zone 'Asia/Singapore')::date")
    owner = tp.staff_owner(c)
    c.execute("insert into staff.worker_keys (key_hash, label) values (%s, 'test')", [hashlib.sha256(KEY.encode()).hexdigest()])
    people = [tp.person(c) for _ in range(20)]
    for q in people:
        tp.consent(c, q)
        for n in (60, 59, 30, 29, 3, 2): tp.entry(c, q, 'period', tp.d(n), {'flow': 'heavy'})
        tp.entry(c, q, 'sleep', tp.d(5), {'hours': 7})
        tp.entry(c, q, 'mindfulness', tp.d(4), {'minutes': 10, 'completed': True})

    # 1. both switches start off; only the owner setter can turn review_on on, and nothing can set the transfer switch
    r = refresh(c, owner)
    check('switches off: a refresh runs the report and queues nothing (review_off)', r.get('ok') and r['review'] == {'state': 'not_queued', 'code': 'review_off'}, r)
    setr = staff(c, owner, "select public.admin_policy_set('review_on', 'true'::jsonb)")
    sett = staff(c, owner, "select public.admin_policy_set('review_transfer_cleared', 'true'::jsonb)")
    r = refresh(c, owner)
    check('the transfer switch cannot be set by any staff RPC, and with it off nothing is queued (transfer_not_cleared)', setr.get('ok') and 'error' in sett and r['review']['code'] == 'transfer_not_cleared', {'set': sett, 'r': r['review']})
    c.execute("update staff.agent_policy set value = 'true'::jsonb where key = 'review_transfer_cleared'")  # what the separate approved statement would do

    # 2. a refresh queues one review, and a replayed request id runs nothing twice
    runs0 = j(c, "select count(*) from staff.agent_runs")
    r = refresh(c, owner, 'tap-1'); r2 = refresh(c, owner, 'tap-1')
    runs1 = j(c, "select count(*) from staff.agent_runs")
    check('a refresh with both switches on queues a review for its run; the same request id replays the answer without a second run', r['review']['state'] == 'queued' and r2.get('replayed') and r2['review'] == r['review'] and runs1 == runs0 + 1, {'r': r['review'], 'runs': [runs0, runs1]})
    job1 = r['review']['job']

    # 3. keys, claims, grants
    den0 = j(c, "select coalesce(sum(n), 0) from staff.worker_denials"); aud0 = j(c, "select count(*) from staff.admin_audit")
    bad = worker(c, 'worker_claim', BAD, None); short = worker(c, 'worker_claim', 'short', None)
    den1 = j(c, "select coalesce(sum(n), 0) from staff.worker_denials"); rows = j(c, "select count(*) from staff.worker_denials"); aud1 = j(c, "select count(*) from staff.admin_audit")
    check('a wrong or short key is denied, counted per minute in one row, and writes no audit rows', bad == {'error': 'denied'} and short == {'error': 'denied'} and den1 == den0 + 2 and rows == 1 and aud1 == aud0, {'den': [den0, den1], 'rows': rows})
    cl = worker(c, 'worker_claim', KEY, None)
    cl2 = worker(c, 'worker_claim', KEY, None)
    check('the worker claims the queued job with a token, a lease and the stage order; a second claim finds nothing', cl.get('job') == job1 and cl.get('token') and cl['stages'] == ['cycle', 'sleep', 'food', 'mind', 'orchestrator'] and cl2 == {'job': None}, {'cl': cl, 'cl2': cl2})
    tok = cl['token']
    tp.as_user(c, owner['id'])
    try:
        c.execute("select public.worker_claim(%s, null)", [KEY]); auth_ok = True
    except Exception:
        auth_ok = False
    tp.as_server(c)
    as_anon(c)
    try:
        c.execute("select public.admin_refresh(28, 'x')"); anon_ok = True
    except Exception:
        anon_ok = False
    tp.as_server(c)
    check('grants: a signed-in account cannot call worker RPCs, and anon cannot call staff RPCs', not auth_ok and not anon_ok)

    # 4. stage admission: order, one attempt, only that agent's aggregates
    oo = worker(c, 'worker_stage_begin', KEY, job1, tok, 'sleep')
    b = worker(c, 'worker_stage_begin', KEY, job1, tok, 'cycle')
    again = worker(c, 'worker_stage_begin', KEY, job1, tok, 'cycle')
    pl = b.get('payload') or {}
    mets = sorted(f['metric'] for f in pl.get('findings', []))
    keys = sorted(pl.keys())
    check('stages are admitted in order only, and a stage cannot be admitted twice (one attempt per stage)', oo.get('error') == 'out_of_order' and oo.get('expected') == 'cycle' and again.get('error') == 'already_admitted', {'oo': oo, 'again': again})
    check("the cycle payload holds only cycle findings (and the eligibility count), the registry entries for them, the floor and window, and nothing else", keys == ['findings', 'floor', 'matrix', 'metric_version', 'registry', 'report_tz', 'window_end_exclusive', 'window_start'] and set(pl['matrix']) == {'prompt_copy', 'surface_order', 'reminder_timing', 'measurement_gap'} and 'bed_tap' not in json.dumps(pl['matrix'])
          and 'eligible_people' in mets and 'period_days' in mets and 'nights_recorded' not in mets and all(set(f) == {'metric', 'window', 'value', 'people', 'suppressed', 'state'} for f in pl['findings']), {'keys': keys, 'mets': mets})
    blob = json.dumps(pl)
    check('the payload carries no account ids, emails, entry ids or diary fields', not any(str(q['id']) in blob for q in people) and 'example.invalid' not in blob and '"flow"' not in blob and 'e-' not in blob.replace('"metric_version"', ''), blob[:300])

    # 5. the report contract on the server
    def bad_post(rep):
        return worker(c, 'worker_post', KEY, job1, tok, 'cycle', json.dumps(rep), '{}')
    cases = {
        'unknown_key': {'summary': 's', 'notes': [], 'proposals': [], 'extra': 1},
        'proposal_kind': {'summary': 's', 'notes': [], 'proposals': [dict(PROPOSAL, kind='points_rule')]},
        'proposal_target': {'summary': 's', 'notes': [], 'proposals': [dict(PROPOSAL, target='payments')]},
        'proposal_metric': {'summary': 's', 'notes': [], 'proposals': [dict(PROPOSAL, metric='nights_recorded')]},
        'proposal_change': {'summary': 's', 'notes': [], 'proposals': [dict(PROPOSAL, change={'a': {'b': {'c': 1}}})]},
        'missing_key': {'summary': 's', 'notes': []},
        'proposal_keys': {'summary': 's', 'notes': [], 'proposals': [dict(PROPOSAL, apply=True)]},
        'summary': {'summary': '', 'notes': [], 'proposals': []},
        'notes': {'summary': 's', 'notes': ['x' * 201], 'proposals': []},
    }
    got = {k: (bad_post(v) or {}).get('why') for k, v in cases.items()}
    check('the server refuses every malformed report with its own reason: unknown keys, kinds, targets, another agent\'s metric, deep changes, extra proposal keys, a missing key, empty summary, long notes', all(got[k] == k for k in cases), got)
    more = {
        'pair': dict(PROPOSAL, kind='reminder_timing'),  # a real kind and a real target, but not a pair the matrix allows
        'other_agent_target': dict(PROPOSAL, target='bed_tap'),
        'empty_change': dict(PROPOSAL, change={}),
        'number_change': dict(PROPOSAL, change={'line': 3}),
        'bad_change_key': dict(PROPOSAL, change={'Line': 'x'}),
        'gap_without_metric': dict(PROPOSAL, kind='measurement_gap', target='metric_registry', metric=None),
    }
    want = {'pair': 'proposal_target', 'other_agent_target': 'proposal_target', 'empty_change': 'proposal_change', 'number_change': 'proposal_change',
            'bad_change_key': 'proposal_change', 'gap_without_metric': 'proposal_metric'}
    got2 = {k: (bad_post({'summary': 's', 'notes': [], 'proposals': [v]}) or {}).get('why') for k, v in more.items()}
    long = (bad_post({'summary': 'x' * 281, 'notes': [], 'proposals': []}) or {}).get('why')
    norank = worker(c, 'worker_post', KEY, job1, tok, 'orchestrator', report(), '{}')
    check('the matrix, change and length rules hold on the server too: pairs per agent, 1 to 4 short text values, a metric for measurement gaps, a 280-character summary', got2 == want and long == 'summary', {'got': got2, 'long': long})
    ok = worker(c, 'worker_post', KEY, job1, tok, 'cycle', report(proposals=[PROPOSAL]), json.dumps({'cli': 'codex-cli 0.160.0', 'model': 'gpt-6-astra', 'secret': 'x'}))
    rep = worker(c, 'worker_post', KEY, job1, tok, 'cycle', report(proposals=[PROPOSAL]), '{}')
    diff = worker(c, 'worker_post', KEY, job1, tok, 'cycle', report('Something else.'), '{}')
    prov = j(c, "select provenance from staff.review_stages where job_id = %s and agent = 'cycle'", [job1])
    check('a valid report is accepted with a stable ref, a repost of the same report replays it, a different one is refused, and provenance keeps only known keys', ok.get('refs') == ['cycle-1'] and rep.get('replayed') and rep.get('refs') == ['cycle-1'] and diff.get('error') == 'report_differs' and 'secret' not in prov and prov.get('model') == 'gpt-6-astra', {'ok': ok, 'rep': rep, 'diff': diff, 'prov': prov})
    early = worker(c, 'worker_finish', KEY, job1, tok)
    check('the job cannot be finished before all five stages are accepted', early.get('error') == 'stages_missing', early)
    for a in ['sleep', 'food', 'mind']:
        worker(c, 'worker_stage_begin', KEY, job1, tok, a); worker(c, 'worker_post', KEY, job1, tok, a, report(), '{}')
    ob = worker(c, 'worker_stage_begin', KEY, job1, tok, 'orchestrator')
    check("Nimbus's payload is the four accepted reports and their proposal refs, no findings", set(ob['payload'].keys()) == {'reports', 'proposals'} and set(ob['payload']['reports'].keys()) == {'cycle', 'sleep', 'food', 'mind'} and [p['ref'] for p in ob['payload']['proposals']] == ['cycle-1'], ob.get('payload'))
    np_ = worker(c, 'worker_post', KEY, job1, tok, 'orchestrator', report(proposals=[PROPOSAL], ranking=[]), '{}')
    nr = worker(c, 'worker_post', KEY, job1, tok, 'orchestrator', report(ranking=['sleep-9']), '{}')
    nd = worker(c, 'worker_post', KEY, job1, tok, 'orchestrator', report(ranking=['cycle-1', 'cycle-1']), '{}')
    on = worker(c, 'worker_post', KEY, job1, tok, 'orchestrator', report('Nimbus ranks one.', ranking=['cycle-1']), '{}')
    check('Nimbus may not propose, may rank only refs accepted in this job, each once', np_.get('why') == 'orchestrator_proposes' and nr.get('why') == 'ranking_ref' and nd.get('why') == 'ranking_duplicate' and on.get('ok'), {'np': np_, 'nr': nr, 'nd': nd, 'on': on})
    fin = worker(c, 'worker_finish', KEY, job1, tok); fin2 = worker(c, 'worker_finish', KEY, job1, tok)
    st = staff(c, owner, "select public.admin_review_status()")
    feed = staff(c, owner, "select public.admin_feed(60)")
    revs = [e for e in feed if e['kind'] == 'review' and e['agent'] in ('cycle', 'orchestrator')]
    props = staff(c, owner, "select public.admin_proposals()")
    pr = [p for p in props if p.get('job_id') == job1]
    check('finishing marks the job done once; the status shows the last review and its run; reports reach the feed; the proposal is open with its change and a priority from the ranking',
          fin.get('ok') and fin2.get('replayed') and st['last']['state'] == 'done' and st['last']['run'] == r['run_id'] and st['open'] is None and len(revs) >= 2 and len(pr) == 1 and pr[0]['status'] == 'open' and pr[0]['change'] == PROPOSAL['change'] and pr[0]['priority'] == 99 and pr[0]['requires_human'],
          {'fin': fin, 'last': st.get('last'), 'revs': len(revs), 'pr': pr})

    # 6. a hold during a review: the post is refused, the job dropped, held proposals withheld and not approvable
    r = refresh(c, owner); cl = worker(c, 'worker_claim', KEY, None); job2, tok2 = cl['job'], cl['token']
    worker(c, 'worker_stage_begin', KEY, job2, tok2, 'cycle')
    tp.consent(c, people[0], on=False)  # a withdrawal holds every published run
    post = worker(c, 'worker_post', KEY, job2, tok2, 'cycle', report(), '{}')
    jst = j(c, "select state || ':' || code from staff.review_jobs where id = %s", [job2])
    props = staff(c, owner, "select public.admin_proposals()"); pr = [p for p in props if p.get('job_id') == job1][0]
    dec = staff(c, owner, "select public.admin_decide(%s, 'approve', '')", [pr['id']])
    feed = staff(c, owner, "select public.admin_feed(60)")
    held_rev = [e for e in feed if e['kind'] == 'review' and e['agent'] == 'cycle']
    check('a withdrawal during a review refuses the next post and drops the job (run_held)', post.get('stop') == 'run_held' and jst == 'dropped:run_held', {'post': post, 'job': jst})
    check('proposals of a held run keep their kind and status but withhold change and rationale, and cannot be approved', pr['held'] and pr['change'] is None and 'held' in pr['rationale'] and 'error' in dec, {'pr': pr, 'dec': dec})
    check('review reports of a held run are redacted in the feed like every other event of that run', held_rev and all('held' in e['title'] and e['detail'] == {'held': True} for e in held_rev), held_rev[:1])
    tp.consent(c, people[0])

    # 7. failure after a lost lease still lands as a block; blocks stop refreshes; the worker sees the block cleared
    r = refresh(c, owner); cl = worker(c, 'worker_claim', KEY, None); job3, tok3 = cl['job'], cl['token']
    worker(c, 'worker_stage_begin', KEY, job3, tok3, 'cycle')
    c.execute("update staff.review_jobs set lease_until = now() - interval '1 minute' where id = %s", [job3])
    beat = worker(c, 'worker_beat', KEY, job3, tok3, 'cycle')
    sb = worker(c, 'worker_stage_begin', KEY, job3, tok3, 'sleep')
    f1 = worker(c, 'worker_fail', KEY, job3, tok3, 'provider_limit'); f2 = worker(c, 'worker_fail', KEY, job3, tok3, 'provider_limit')
    badc = worker(c, 'worker_fail', KEY, job3, tok3, 'the model said something long')
    r = refresh(c, owner)
    lb = worker(c, 'worker_claim', KEY, f1.get('block'))
    st = staff(c, owner, "select public.admin_review_status()")
    check('after the lease is lost a beat and a stage are refused, yet the failure is still recorded as one block, idempotently, and only fixed codes are accepted', beat.get('stop') == 'lease_lost' and sb.get('stop') == 'lease_lost' and f1.get('block') and f2.get('block') == f1['block'] and f2.get('replayed') and badc.get('error') == 'bad_code', {'beat': beat, 'sb': sb, 'f1': f1, 'f2': f2})
    check('an open block stops the next refresh from queueing, the status shows the block by code only, and a blocked worker learns the block is not cleared', r['review'] == {'state': 'not_queued', 'code': 'blocked'} and st['block']['code'] == 'provider_limit' and set(st['block'].keys()) == {'id', 'at', 'code'} and lb == {'local_block': f1['block'], 'cleared': False}, {'r': r['review'], 'st': st.get('block'), 'lb': lb})
    clr = staff(c, owner, "select public.admin_block_clear(%s)", [f1['block']]); clr2 = staff(c, owner, "select public.admin_block_clear(%s)", [f1['block']])
    lb2 = worker(c, 'worker_claim', KEY, f1['block'])
    check('an owner clears that block once, and the worker then sees exactly that block cleared', clr.get('ok') and 'error' in clr2 and lb2 == {'local_block': f1['block'], 'cleared': True}, {'clr': clr, 'clr2': clr2, 'lb2': lb2})

    # 8. queue expiry, superseding, a busy worker, a switch turned off between stages, nothing to review
    r1 = refresh(c, owner); r2 = refresh(c, owner)
    s1 = j(c, "select state from staff.review_jobs where id = %s", [r1['review']['job']])
    check('a second refresh while a review is still unclaimed supersedes it with the newer run', s1 == 'superseded' and r2['review']['state'] == 'queued', {'s1': s1, 'r2': r2['review']})
    c.execute("update staff.review_jobs set requested_at = now() - interval '11 minutes' where id = %s", [r2['review']['job']])
    none = worker(c, 'worker_claim', KEY, None); s2 = j(c, "select state || ':' || code from staff.review_jobs where id = %s", [r2['review']['job']])
    check('a review left unclaimed for 10 minutes expires instead of reviewing old numbers', none == {'job': None} and s2 == 'expired:queue_expired', {'none': none, 's2': s2})
    r3 = refresh(c, owner); cl = worker(c, 'worker_claim', KEY, None); job4, tok4 = cl['job'], cl['token']
    r4 = refresh(c, owner)
    check('a refresh while the worker holds a review says busy and queues nothing', r4['review']['state'] == 'busy' and r4['review']['job'] == job4, r4['review'])
    worker(c, 'worker_stage_begin', KEY, job4, tok4, 'cycle'); worker(c, 'worker_post', KEY, job4, tok4, 'cycle', report(), '{}')
    staff(c, owner, "select public.admin_policy_set('review_on', 'false'::jsonb)")
    off = worker(c, 'worker_stage_begin', KEY, job4, tok4, 'sleep')
    check('turning review_on off between stages stops the next stage before any input is handed out', off.get('stop') == 'review_off' and 'payload' not in off, off)
    staff(c, owner, "select public.admin_policy_set('review_on', 'true'::jsonb)")
    empty = j(c, "insert into staff.agent_runs (kind, trigger, status, finished_at, summary) values ('run_now', 'staff', 'ok', now(), '{}'::jsonb) returning id")
    c.execute("insert into staff.agent_findings (run_id, agent, metric, \"window\", value, people, suppressed, state) values (%s, 'cycle', 'eligible_people', 'now', 20, 20, false, 'measured'), (%s, 'cycle', 'period_days', 'w', null, null, true, 'insufficient')", [empty, empty])
    check('a run with no measured finding beyond eligibility is not worth a model call', j(c, "select staff.review_worth(%s)", [empty]) is False and j(c, "select staff.review_worth(%s)", [r3['run_id']]) is True)

    # 8b. a beat notices a switch turned off mid-stage; finish refuses after the switch went off; prune keeps proposals
    r6 = refresh(c, owner); cl = worker(c, 'worker_claim', KEY, None); job6, tok6 = cl['job'], cl['token']
    worker(c, 'worker_stage_begin', KEY, job6, tok6, 'cycle')
    staff(c, owner, "select public.admin_policy_set('review_on', 'false'::jsonb)")
    bt = worker(c, 'worker_beat', KEY, job6, tok6, 'cycle')
    js6 = j(c, "select state || ':' || code from staff.review_jobs where id = %s", [job6])
    check('a heartbeat during a stage stops the call as soon as review is switched off, and the job is dropped', bt.get('stop') == 'review_off' and js6 == 'dropped:review_off', {'bt': bt, 'job': js6})
    staff(c, owner, "select public.admin_policy_set('review_on', 'true'::jsonb)")
    r7 = refresh(c, owner); cl = worker(c, 'worker_claim', KEY, None); job7, tok7 = cl['job'], cl['token']
    run_all_stages(c, job7, tok7)
    staff(c, owner, "select public.admin_policy_set('review_on', 'false'::jsonb)")
    fz = worker(c, 'worker_finish', KEY, job7, tok7)
    check('a delayed finish after the switch went off is refused, not marked done', fz.get('stop') == 'review_off' and j(c, "select state from staff.review_jobs where id = %s", [job7]) == 'dropped', fz)
    staff(c, owner, "select public.admin_policy_set('review_on', 'true'::jsonb)")
    np0 = j(c, "select count(*) from staff.agent_proposals where job_id = %s", [job1])
    c.execute("update staff.review_jobs set requested_at = now() - interval '100 days' where id = %s", [job1])
    pr0 = j(c, "select staff.prune(365)")
    np1 = j(c, "select count(*) from staff.agent_proposals where ref = 'cycle-1'")
    check('pruning a 90-day-old job keeps its proposals and decisions (the link is cleared, the proposal stays)', np0 == 1 and np1 >= 1 and pr0['review_jobs_removed'] >= 1 and j(c, "select count(*) from staff.review_jobs where id = %s", [job1]) == 0, {'np0': np0, 'np1': np1, 'pr': pr0})

    # 8c. key revocation and rotation
    r8 = refresh(c, owner); cl = worker(c, 'worker_claim', KEY, None); job8, tok8 = cl['job'], cl['token']
    worker(c, 'worker_stage_begin', KEY, job8, tok8, 'cycle')
    c.execute("update staff.worker_keys set revoked_at = now() where key_hash = %s", [hashlib.sha256(KEY.encode()).hexdigest()])
    rv = worker(c, 'worker_beat', KEY, job8, tok8, 'cycle'); rp = worker(c, 'worker_post', KEY, job8, tok8, 'cycle', report(), '{}')
    KEY2 = 'r' * 8 + uuid.uuid4().hex + uuid.uuid4().hex
    c.execute("insert into staff.worker_keys (key_hash, label) values (%s, 'rotated')", [hashlib.sha256(KEY2.encode()).hexdigest()])
    nf = worker(c, 'worker_fail', KEY2, job8, tok8, 'uncertain')
    nb = worker(c, 'worker_stage_begin', KEY2, job8, tok8, 'sleep')
    wrongtok = worker(c, 'worker_fail', KEY2, job8, str(uuid.uuid4()), 'uncertain')
    check('a revoked key is refused on every call; after rotation the new key can record the old claim as a block (with its token) but cannot run it', rv == {'error': 'denied'} and rp == {'error': 'denied'} and nf.get('block') and nb.get('error') == 'no_such_claim' and wrongtok.get('error') == 'no_such_claim', {'rv': rv, 'rp': rp, 'nf': nf, 'nb': nb})
    staff(c, owner, "select public.admin_block_clear(%s)", [nf['block']])
    c.execute("update staff.worker_keys set revoked_at = null where key_hash = %s", [hashlib.sha256(KEY.encode()).hexdigest()])

    # 8c2. a key revoked while a beat waits on the worker lock: the beat rechecks after the lock and is refused (two sessions)
    r9 = refresh(c, owner); cl = worker(c, 'worker_claim', KEY, None); job9, tok9 = cl['job'], cl['token']
    worker(c, 'worker_stage_begin', KEY, job9, tok9, 'cycle')
    hold = psycopg.connect(tp.DSN + ' dbname=' + tp.DB, autocommit=False)
    hold.execute("select pg_advisory_xact_lock(hashtext('staff.run_begin'))")
    got9 = {}
    def beat_wait():
        cc = psycopg.connect(tp.DSN + ' dbname=' + tp.DB, autocommit=True)
        try:
            cc.execute("select set_config('request.jwt.claims', %s, false)", [json.dumps({'role': 'anon'})]); cc.execute("set role anon")
            got9['r'] = cc.execute("select public.worker_beat(%s, %s, %s, 'cycle')", [KEY, job9, tok9]).fetchone()[0]
        finally:
            cc.close()
    tw = threading.Thread(target=beat_wait); tw.start()
    for _ in range(100):
        time.sleep(0.05)
        if j(c, "select count(*) from pg_stat_activity where wait_event_type = 'Lock' and query like '%%worker_beat%%'") >= 1: break
    hold.execute("update staff.worker_keys set revoked_at = now() where key_hash = %s", [hashlib.sha256(KEY.encode()).hexdigest()])
    hold.commit(); hold.close(); tw.join(15)
    check('a key revoked while a call waits for the worker lock is refused once the lock is free (two real sessions)', got9.get('r') == {'error': 'denied'}, got9)
    c.execute("update staff.worker_keys set revoked_at = null where key_hash = %s", [hashlib.sha256(KEY.encode()).hexdigest()])
    worker(c, 'worker_fail', KEY, job9, tok9, 'uncertain'); b9 = j(c, "select id from staff.provider_blocks where job_id = %s", [job9])
    staff(c, owner, "select public.admin_block_clear(%s)", [b9])

    # 8d. two identical refreshes at once: the second waits for the lock, then replays the first answer
    owner_conn = []
    res = {}
    def press(name):
        cc = psycopg.connect(tp.DSN + ' dbname=' + tp.DB, autocommit=True)
        try:
            cc.execute("select set_config('request.jwt.claims', %s, false)", [json.dumps({'sub': str(owner['id']), 'role': 'authenticated'})]); cc.execute("set role authenticated")
            res[name] = cc.execute("select public.admin_refresh(28, 'same-tap')").fetchone()[0]
        except Exception as e:
            res[name] = {'exception': str(e)[:200]}
        finally:
            cc.close()
    hold = psycopg.connect(tp.DSN + ' dbname=' + tp.DB, autocommit=False)
    hold.execute("select pg_advisory_xact_lock(hashtext('staff.run_begin'))")
    ta = threading.Thread(target=press, args=('a',)); tb = threading.Thread(target=press, args=('b',)); ta.start(); tb.start()
    for _ in range(100):
        time.sleep(0.05)
        if j(c, "select count(*) from pg_stat_activity where wait_event_type = 'Lock' and query like '%%admin_refresh%%'") >= 2: break
    hold.commit(); hold.close(); ta.join(30); tb.join(30)
    a_, b_ = res.get('a') or {}, res.get('b') or {}
    one = [x for x in (a_, b_) if not x.get('replayed')]; two = [x for x in (a_, b_) if x.get('replayed')]
    check('two identical refreshes at once: one runs, the other waits and replays the same answer instead of failing', len(one) == 1 and len(two) == 1 and one[0].get('run_id') == two[0].get('run_id'), res)

    # 9. two sessions: a withdrawal in flight holds the worker lock; a stage admission waits for it and then stops
    r5 = refresh(c, owner); cl = worker(c, 'worker_claim', KEY, None); job5, tok5 = cl['job'], cl['token']
    a_conn = psycopg.connect(tp.DSN + ' dbname=' + tp.DB, autocommit=False)
    a_conn.execute("select staff.invalidate_runs('a test withdrawal in flight')")
    outcome = {}
    def admit():
        b_conn = psycopg.connect(tp.DSN + ' dbname=' + tp.DB, autocommit=True)
        try:
            b_conn.execute("select set_config('request.jwt.claims', %s, false)", [json.dumps({'role': 'anon'})]); b_conn.execute("set role anon")
            outcome['r'] = b_conn.execute("select public.worker_stage_begin(%s, %s, %s, 'cycle')", [KEY, job5, tok5]).fetchone()[0]
        except Exception as e:
            outcome['err'] = str(e)
        finally:
            b_conn.close()
    t = threading.Thread(target=admit); t.start()
    waited = False
    for _ in range(100):
        time.sleep(0.05)
        if j(c, "select count(*) from pg_stat_activity where wait_event_type = 'Lock' and query like '%%worker_stage_begin%%'") > 0: waited = True; break
    a_conn.commit(); t.join(15); a_conn.close()
    check('a stage admission waits on the worker lock while a withdrawal is in flight, then stops because the run is held (two real sessions)', waited and (outcome.get('r') or {}).get('stop') == 'run_held', {'waited': waited, 'outcome': outcome})

    passed = sum(1 for _, ok in tp.results if ok); failed = len(tp.results) - passed
    print('\n%d passed, %d failed' % (passed, failed))
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
