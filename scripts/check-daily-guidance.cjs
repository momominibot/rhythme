#!/usr/bin/env node
// Actual record readers and daily controller, isolated DOM and synthetic storage.
// No network, login, browser automation, clinical validation or production writes.
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { JSDOM, VirtualConsole } = require(process.env.OVULUNA_JSDOM_PATH || 'jsdom');
const root = process.env.OVULUNA_TEST_ROOT || path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'daily.html'), 'utf8');
const files = ['observation-records.js', 'home-records.js', 'journal-records.js', 'daily-guidance.js'];
const code = Object.fromEntries(files.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const sourceFiles = ['evidence-db.js', 'evidence-reconciled.js', 'evidence-lifecycle.js', 'evidence-acupoint.js', 'evidence-safety.js', 'evidence-core.js', 'evidence-daily.js', 'evidence-merge.js'];
const keys = { context: 'ovuluna_daily_context_v1', routine: 'ovuluna_daily_routine_v1', completions: 'ovuluna_daily_completions_v1', observations: 'ovuluna_observations_v1', checkins: 'ovuluna_daily_checkins_v1', journal: 'ovuluna_wellness_journal_v1' };
const results = [];
process.env.TZ = 'Asia/Singapore';
function test(name, work) { try { work(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.stack }); } }
function harness(options = {}) {
  const errors = [], virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error.message));
  const page = options.page || 'api', markup = page === 'full' ? html : page === 'home' ? fs.readFileSync(path.join(root, 'home.html'), 'utf8') : page === 'preview' ? '<main><section id="daily-home-preview"></section></main>' : '<main></main>';
  const dom = new JSDOM(markup, { url: 'https://synthetic-ovuluna.invalid/' + (page === 'preview' ? 'home.html' : 'daily.html'), runScripts: 'outside-only', virtualConsole });
  const w = dom.window, d = w.document, NativeDate = w.Date;
  let now = Date.parse(options.now || '2026-10-01T04:00:00Z'), nextTimer = 0, deniedRead = false, deniedWrite = false, writes = 0;
  const timers = new Map(), data = new Map([['unrelated', 'preserve'], ['ovuluna_persona', options.appearance || 'bloom']]), reads = [];
  w.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
  w.setTimeout = (fn, delay = 0) => { const id = ++nextTimer; timers.set(id, { fn, at: now + Number(delay) }); return id; }; w.clearTimeout = id => timers.delete(id);
  w.confirm = () => true;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  Object.defineProperty(w, 'localStorage', { configurable: true, value: {
    getItem(key) { reads.push(key); if (deniedRead) throw Error('Storage access denied'); return data.get(key) ?? null; },
    setItem(key, value) { writes++; if (deniedWrite) throw Error('Storage quota exceeded'); data.set(key, String(value)); },
    removeItem(key) { writes++; if (deniedWrite) throw Error('Storage quota exceeded'); data.delete(key); }
  } });
  d.documentElement.dataset.persona = options.appearance || 'bloom';
  if (page === 'home') w.eval(fs.readFileSync(path.join(root, 'ovarian-model.js'), 'utf8'));
  for (const name of files.slice(0, 3)) w.eval(code[name]);
  const today = [new w.Date().getFullYear(), String(new w.Date().getMonth() + 1).padStart(2, '0'), String(new w.Date().getDate()).padStart(2, '0')].join('-');
  if (options.stage) {
    data.set(keys.context, JSON.stringify({ version: 1, source: 'self-reported', stage: options.stage, contraception: 'undisclosed', statusOn: options.statusOn || today, confirmed: true, confirmedAt: options.confirmedAt || new w.Date().toISOString(), utcOffsetMinutes: options.contextOffset ?? new w.Date().getTimezoneOffset() }));
  }
  if (options.seed) options.seed(w, data, today);
  if (options.corrupt) for (const key of options.corrupt) data.set(key, '{unreadable');
  deniedRead = !!options.denyReads; deniedWrite = !!options.denyWrites; writes = 0; reads.length = 0;
  w.eval(code['daily-guidance.js']);
  const api = w.OvulunaDailyGuidance;
  function advance(ms) { const end = now + ms; let count = 0; while (true) { const first = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!first) break; if (++count > 20) throw Error('Unexpected timer loop'); const [id, timer] = first; now = timer.at; timers.delete(id); timer.fn(); } now = end; }
  const view = {
    dom, w, d, api, data, reads, timers, errors, today, by: id => d.getElementById('daily-' + id),
    plan: () => api.plan(w.localStorage, new w.Date()), writes: () => writes, advance,
    event(name, key) { w.dispatchEvent(name === 'storage' ? new w.StorageEvent(name, { key }) : new w.Event(name)); },
    submit(id) { this.by(id).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); },
    deny(read, write) { deniedRead = read; deniedWrite = write; },
    setNow(value) { now = Date.parse(value); },
    context(stage, extra = {}) { return api.saveContext(w.localStorage, { stage, contraception: 'undisclosed', statusOn: api.day(new w.Date()), confirmed: true, ...extra }, api.snapshot(w.localStorage, keys.context), new w.Date()); },
    checkin(category, values, observedOn = today) { return w.OvulunaCheckins.save(w.localStorage, { category, observedOn, values }, new w.Date()); },
    observation(input) { return w.OvulunaObservations.save(w.localStorage, { observedOn: today, values: {}, contextFlags: [], notes: '', ...input }, w.OvulunaObservations.snapshot(w.localStorage), new w.Date()); },
    sources() { for (const name of sourceFiles) w.eval(fs.readFileSync(path.join(root, name), 'utf8')); },
    close() { dom.window.close(); }
  };
  return view;
}
function cards(view) { return JSON.parse(JSON.stringify(view.plan().cards)); }
function bleeding(view, flags = [], amount = 'Spotting', observedOn = view.today) { return view.observation({ kind: 'bleeding', observedOn, values: { amount }, contextFlags: flags }); }

test('Five life contexts are explicitly self-reported and theme cannot change any daily card', () => {
  for (const stage of ['teen', 'ttc', 'postpartum', 'peri', 'post']) {
    let reference;
    for (const appearance of ['bloom', 'grow', 'nurture', 'wisdom']) {
      const view = harness({ stage, appearance });
      assert.equal(view.plan().contextStatus, 'current'); assert.ok(cards(view).some(card => card.id === 'stage-' + stage));
      assert.match(cards(view).find(card => card.id === 'stage-' + stage).why, /You confirmed/);
      assert.equal(view.reads.includes('ovuluna_persona'), false);
      const actual = cards(view); if (reference) assert.deepEqual(actual, reference); else reference = actual;
      assert.equal(view.writes(), 0); view.close();
    }
  }
});
test('No-data and undisclosed context remain useful without clinical defaults', () => {
  const absent = harness({ appearance: 'wisdom' });
  assert.equal(absent.plan().contextStatus, 'missing'); assert.deepEqual(cards(absent).map(card => card.id), ['check-context', 'one-note']);
  assert.match(cards(absent)[1].why, /Missing data does not mean everything is normal/);
  assert.ok(Object.values(absent.plan().sources).every(source => source.status === 'missing' && source.total === 0));
  absent.context('unspecified'); assert.ok(cards(absent).some(card => card.id === 'stage-unspecified')); assert.equal(absent.data.get('ovuluna_persona'), 'wisdom'); absent.close();
});
test('Thirty-day freshness is labeled a product rule and stale context pauses stage prompts until reconfirmed', () => {
  const view = harness({ stage: 'ttc', statusOn: '2026-09-01', confirmedAt: '2026-09-01T04:00:00.000Z' });
  assert.equal(view.plan().contextStatus, 'current'); view.setNow('2026-10-02T04:00:00Z');
  assert.equal(view.plan().contextStatus, 'stale'); assert.ok(!cards(view).some(card => card.id === 'stage-ttc')); assert.match(cards(view)[0].body, /app freshness rule, not a clinical threshold/);
  view.context('ttc'); assert.equal(view.plan().contextStatus, 'current'); assert.ok(cards(view).some(card => card.id === 'stage-ttc')); view.close();
});
test('Invalid input, unknown metadata and corrupt stores cannot be overwritten by a save', () => {
  const view = harness(); const valid = { stage: 'ttc', contraception: 'undisclosed', statusOn: view.today, confirmed: true };
  for (const altered of [{ ...valid, stage: '__proto__' }, { ...valid, confirmed: false }, { ...valid, statusOn: '2026-02-30' }, { ...valid, statusOn: '2026-10-02' }, { ...valid, score: 1 }]) assert.throws(() => view.api.saveContext(view.w.localStorage, altered, null, new view.w.Date()));
  assert.equal(view.writes(), 0);
  for (const [key, work] of [[keys.context, raw => view.api.saveContext(view.w.localStorage, valid, raw, new view.w.Date())], [keys.routine, raw => view.api.saveRoutine(view.w.localStorage, { time: '00:00', enabled: true }, raw, new view.w.Date())], [keys.completions, raw => view.api.toggleCompletion(view.w.localStorage, 'one-note', true, raw, new view.w.Date())]]) {
    view.data.set(key, '{unreadable'); assert.throws(() => work('{unreadable')); assert.equal(view.data.get(key), '{unreadable');
  }
  view.close();
});
test('Snapshots block other-tab changes, deletion and missing snapshots without losing records', () => {
  const view = harness(); view.context('ttc'); const original = view.data.get(keys.context);
  view.context('peri'); const current = view.data.get(keys.context);
  assert.throws(() => view.api.saveContext(view.w.localStorage, { stage: 'post', contraception: 'undisclosed', statusOn: view.today, confirmed: true }, original, new view.w.Date()), /changed in another page/);
  assert.equal(view.data.get(keys.context), current); view.data.delete(keys.context);
  assert.throws(() => view.api.saveContext(view.w.localStorage, { stage: 'post', contraception: 'undisclosed', statusOn: view.today, confirmed: true }, current, new view.w.Date()), /changed in another page/);
  assert.throws(() => view.api.saveRoutine(view.w.localStorage, { time: '09:00', enabled: true }, undefined, new view.w.Date()), /snapshot is missing/); assert.equal(view.data.has(keys.context), false); view.close();
});
test('A backward device clock cannot silently replace a newer context or routine', () => {
  const view = harness({ stage: 'ttc' }); view.api.saveRoutine(view.w.localStorage, { time: '09:00', enabled: true }, null, new view.w.Date());
  const before = JSON.stringify([...view.data]); view.setNow('2026-10-01T03:00:00Z');
  assert.throws(() => view.context('ttc'), /clock is earlier/); assert.throws(() => view.api.saveRoutine(view.w.localStorage, { time: '10:00', enabled: false }, view.data.get(keys.routine), new view.w.Date()), /clock is earlier/);
  assert.equal(JSON.stringify([...view.data]), before); view.close();
});
test('All six actual Home categories preserve entered zero, null and original units without constructing scores', () => {
  const view = harness();
  const input = { mood: { mood: 'Neutral' }, sleep: { hours: '0' }, symptoms: { pain: '0' }, water: { ml: '0' }, activity: { kind: 'Rest day', minutes: '0' }, food: { notes: '<b>Synthetic meal note</b>', kcal: '0' } };
  for (const [category, values] of Object.entries(input)) view.checkin(category, values);
  const model = view.plan(), get = category => model.sources.checkins.recent.find(record => record.category === category).values;
  assert.equal(model.sources.checkins.recent.length, 6); assert.equal(get('sleep').hours, 0); assert.equal(get('sleep').quality, null); assert.equal(get('water').ml, 0); assert.equal(get('food').kcal, 0); assert.equal(get('activity').minutes, 0); assert.equal(get('symptoms').pain, 0);
  assert.match(cards(view).find(card => card.id === 'comfort').why, /0 hours slept; quality was not recorded/); assert.match(cards(view).find(card => card.id === 'one-note').why, /6 readable/);
  assert.ok(!Object.hasOwn(model, 'score')); view.close();
});
test('Old observations and previous-day check-ins stay saved but do not drive todays prompts', () => {
  const view = harness({ stage: 'post' }); bleeding(view, ['Postmenopause (self-reported)'], 'Spotting', '2026-09-24');
  view.checkin('mood', { mood: 'Low' }, '2026-09-30'); view.checkin('sleep', { hours: 0, quality: 'Poor' }, '2026-09-30');
  view.data.set(keys.journal, JSON.stringify([{ date: '2026-09-30', mood: 'Low', energy: 'Low', comfort: 'Uncomfortable', notes: 'Old synthetic note' }, { date: '2026-10-02', mood: 'Low', energy: 'Low', comfort: 'Uncomfortable', notes: 'Future synthetic note' }]));
  const before = JSON.stringify([...view.data]), model = view.plan();
  assert.equal(model.sources.observations.recent.length, 0); assert.equal(model.sources.observations.omitted, 1); assert.equal(model.sources.checkins.recent.length, 0); assert.equal(model.sources.journal.recent.length, 0);
  assert.ok(!cards(view).some(card => ['bleeding-care', 'comfort', 'connection'].includes(card.id))); assert.equal(JSON.stringify([...view.data]), before); view.close();
});
test('Observation window is exactly today plus six calendar days and preserves missing readings', () => {
  const view = harness();
  view.observation({ kind: 'bbt', observedOn: '2026-09-25', missingReason: 'Missed measurement' }); view.observation({ kind: 'bbt', observedOn: '2026-09-24', missingReason: 'Not observed' });
  assert.equal(view.plan().sources.observations.recent.length, 1); assert.equal(view.plan().sources.observations.omitted, 1);
  const card = cards(view).find(card => card.id === 'review-observation'); assert.match(card.why, /2026-09-25.*Missed measurement/); assert.equal(card.evidence, 'daily-record-method'); assert.match(card.body, /does not confirm ovulation/); view.close();
});
test('Recent postmenopausal bleeding is source-linked, undismissable and labeled historical when appropriate', () => {
  const view = harness({ stage: 'post' }); bleeding(view, ['Postmenopause (self-reported)'], 'Spotting', '2026-09-30');
  const before = JSON.stringify([...view.data]), card = cards(view)[0]; assert.equal(card.id, 'bleeding-care'); assert.equal(card.completable, false); assert.match(card.body, /logged on 2026-09-30, not a finding that you have symptoms today/); assert.match(card.body, /single episode/); assert.equal(card.evidence, 'life-post-bleeding'); assert.equal(card.href, 'cycle-log.html');
  assert.throws(() => view.api.toggleCompletion(view.w.localStorage, 'bleeding-care', true, null, new view.w.Date()), /cannot be dismissed/); assert.equal(JSON.stringify([...view.data]), before); view.close();
});
test('No bleeding, missed reading and undisclosed observation context never create an after-menopause bleeding finding', () => {
  for (const fixture of ['none', 'missed', 'private']) {
    const view = harness({ stage: 'post' });
    if (fixture === 'none') bleeding(view, ['Postmenopause (self-reported)'], 'None observed');
    if (fixture === 'missed') view.observation({ kind: 'bleeding', missingReason: 'Not observed', contextFlags: ['Postmenopause (self-reported)'] });
    if (fixture === 'private') bleeding(view, ['Prefer not to say']);
    assert.ok(!cards(view).some(card => card.id === 'bleeding-care')); view.close();
  }
});
test('Newer ordinary, private or absent bleeding entries cannot hide earlier explicit care-relevant bleeding', () => {
  for (const flag of ['Postmenopause (self-reported)', 'Postpartum']) {
    const view = harness({ stage: 'ttc' }); bleeding(view, [flag], 'Spotting', '2026-09-29'); bleeding(view, [], 'Light flow', '2026-09-30'); bleeding(view, ['Prefer not to say'], 'Moderate flow');
    view.observation({ kind: 'bleeding', missingReason: 'Not observed', contextFlags: ['Prefer not to say'] });
    const care = cards(view)[0]; assert.equal(care.id, 'bleeding-care'); assert.equal(care.evidence, flag === 'Postpartum' ? 'life-postnatal-bleeding' : 'life-post-bleeding'); assert.match(care.why, /Spotting on 2026-09-29/); assert.match(care.body, /not a finding that you have symptoms today/); assert.equal(view.plan().contextConflict, true); view.close();
  }
});
test('All-window care priority favors explicit postmenopausal context and never borrows conflicted daily context', () => {
  const view = harness({ stage: 'post' }); bleeding(view, ['Postmenopause (self-reported)'], 'Spotting', '2026-09-25'); bleeding(view, ['Postpartum'], 'Light flow', '2026-09-30'); bleeding(view, [], 'Moderate flow');
  const care = cards(view)[0]; assert.equal(care.evidence, 'life-post-bleeding'); assert.match(care.why, /2026-09-25/); assert.doesNotMatch(care.why, /Moderate flow/);
  const old = view.w.OvulunaObservations.read(view.w.localStorage).records.find(record => record.observedOn === '2026-09-25'); view.w.OvulunaObservations.remove(view.w.localStorage, old.id, view.w.OvulunaObservations.snapshot(view.w.localStorage));
  const remaining = cards(view)[0]; assert.equal(remaining.evidence, 'life-postnatal-bleeding'); assert.match(remaining.why, /2026-09-30/); assert.doesNotMatch(remaining.why, /separate daily context/); view.close();
});
test('After-birth bleeding stays in after-birth context and is never used to reset a cycle', () => {
  const view = harness({ stage: 'postpartum' }); bleeding(view, ['Postpartum'], 'Light flow');
  const before = JSON.stringify([...view.data]), card = cards(view)[0]; assert.equal(card.id, 'bleeding-care'); assert.match(card.body, /not automatically a new menstrual cycle/); assert.doesNotMatch(card.body, /not a finding that you have symptoms today/); assert.equal(card.evidence, 'life-postnatal-bleeding'); assert.equal(JSON.stringify([...view.data]), before); view.close();
});
test('Contradictory explicit observation context invites review and suppresses context-specific comfort', () => {
  for (const flag of ['Pregnant', 'Postpartum', 'Postmenopause (self-reported)']) {
    const view = harness({ stage: 'ttc' }); view.observation({ kind: 'bbt', missingReason: 'Missed measurement', contextFlags: [flag] }); view.checkin('symptoms', { pain: 2 });
    assert.equal(view.plan().contextConflict, true); assert.ok(cards(view).some(card => card.id === 'check-context' && /different life context/.test(card.body))); assert.ok(!cards(view).some(card => ['comfort', 'stage-ttc'].includes(card.id)));
    assert.equal(view.api.readContext(view.w.localStorage).stage, 'ttc'); view.close();
  }
});
test('An entered pain number does not choose treatment, identify a period or use an arbitrary clinical threshold', () => {
  const view = harness({ stage: 'cycling' }); let previousBody;
  for (const pain of [1, 5, 10]) { view.checkin('symptoms', { pain }); const card = cards(view).find(card => card.id === 'comfort'); assert.match(card.why, new RegExp('pain ' + pain + ' out of 10')); assert.match(card.body, /number alone does not choose a treatment or rule out a concern/); if (previousBody) assert.equal(card.body, previousBody); previousBody = card.body; assert.equal(card.evidence, 'daily-period-care'); }
  view.checkin('symptoms', { pain: 0 }); assert.ok(!cards(view).some(card => card.id === 'comfort')); view.close();
});
test('Poor sleep in explicitly reported menopause context offers comfort without claiming a hot-flush treatment', () => {
  for (const stage of ['peri', 'post', 'ttc']) {
    const view = harness({ stage }); view.checkin('sleep', { hours: 0, quality: 'Poor' }); const card = cards(view).find(card => card.id === 'comfort');
    if (stage === 'ttc') { assert.equal(card.evidence, 'daily-record-method'); assert.doesNotMatch(card.body, /cooler bedroom/); }
    else { assert.equal(card.evidence, 'daily-menopause-comfort'); assert.match(card.body, /Cooling is not established treatment for hot flushes/); }
    assert.match(card.why, /0 hours slept and poor quality/); view.close();
  }
});
test('TTC folic-acid prompt asks a professional and does not prescribe a dose or quantify fertility', () => {
  const view = harness({ stage: 'ttc' }), card = cards(view).find(card => card.id === 'stage-ttc');
  assert.equal(card.evidence, 'daily-preconception'); assert.match(card.body, /ask your pharmacist or clinician/); assert.doesNotMatch(card.body, /\d+\s*(mg|mcg|µg)|fertility chance|egg quality/i); assert.ok(card.url.startsWith('https://www.nhs.uk/')); view.close();
});
test('Low mood uses worldwide support only for a current dated self-report', () => {
  const view = harness(); view.checkin('mood', { mood: 'Low' }); const card = cards(view).find(card => card.id === 'connection'); assert.equal(card.url, 'https://findahelpline.com/'); assert.match(card.body, /someone you trust/); assert.doesNotMatch(card.body, /Singapore|diagnosed|depression detected/);
  view.checkin('mood', { mood: 'Neutral' }); assert.ok(!cards(view).some(card => card.id === 'connection')); view.close();
});
test('Unreadable and denied source stores are reported without recovery writes or false reassuring prompts', () => {
  for (const options of [{ corrupt: [keys.observations, keys.checkins, keys.journal, keys.context, keys.routine, keys.completions] }, { denyReads: true }]) {
    const view = harness({ page: 'full', ...options }), before = JSON.stringify([...view.data]);
    assert.ok(Object.values(view.plan().sources).every(source => source.status === 'unreadable')); assert.equal(view.by('save-context').disabled, true); assert.equal(view.by('save-routine').disabled, true); assert.match(view.by('record-status').textContent, /could not be read/); assert.ok([...view.d.querySelectorAll('.daily-completion input')].every(input => input.disabled));
    assert.equal(view.writes(), 0); assert.equal(JSON.stringify([...view.data]), before); assert.deepEqual(view.errors, []); view.close();
  }
});
test('Routine completion is reversible per local day, protects stale writers and never completes a care note', () => {
  const view = harness({ stage: 'ttc' }), api = view.api;
  api.toggleCompletion(view.w.localStorage, 'one-note', true, null, new view.w.Date()); let raw = view.data.get(keys.completions);
  assert.equal(cards(view).find(card => card.id === 'one-note').complete, true); assert.equal(api.readCompletions(view.w.localStorage).records.length, 1);
  api.toggleCompletion(view.w.localStorage, 'one-note', false, raw, new view.w.Date()); assert.equal(cards(view).find(card => card.id === 'one-note').complete, false);
  raw = view.data.get(keys.completions); api.toggleCompletion(view.w.localStorage, 'one-note', true, raw, new view.w.Date());
  assert.throws(() => api.toggleCompletion(view.w.localStorage, 'stage-ttc', true, raw, new view.w.Date()), /changed in another page/);
  view.setNow('2026-10-02T04:00:00Z'); assert.equal(cards(view).find(card => card.id === 'one-note').complete, false); assert.equal(api.readCompletions(view.w.localStorage).records[0].completedOn, '2026-10-01'); view.close();
});
test('International travel and DST retain original local completion dates and context without corrupting history', () => {
  try {
    process.env.TZ = 'Asia/Singapore'; const view = harness({ now: '2026-10-01T00:15:00Z', stage: 'ttc' }); view.api.toggleCompletion(view.w.localStorage, 'one-note', true, null, new view.w.Date());
    const before = view.data.get(keys.completions); assert.equal(view.api.readCompletions(view.w.localStorage).records[0].utcOffsetMinutes, -480);
    process.env.TZ = 'Pacific/Honolulu'; assert.equal(view.api.day(new view.w.Date()), '2026-09-30'); assert.equal(view.api.readCompletions(view.w.localStorage).records[0].completedOn, '2026-10-01'); assert.equal(view.api.readContext(view.w.localStorage).statusOn, '2026-10-01'); assert.equal(view.data.get(keys.completions), before); view.close();
    process.env.TZ = 'America/New_York'; const dst = harness({ now: '2026-11-01T05:30:00Z', stage: 'peri' });
    dst.api.toggleCompletion(dst.w.localStorage, 'one-note', true, null, new dst.w.Date()); assert.equal(dst.api.readCompletions(dst.w.localStorage).records[0].utcOffsetMinutes, 240);
    dst.setNow('2026-11-01T06:30:00Z'); assert.equal(new dst.w.Date().getTimezoneOffset(), 300); assert.equal(cards(dst).find(card => card.id === 'one-note').complete, true);
    process.env.TZ = 'Pacific/Kiritimati'; assert.equal(dst.api.readCompletions(dst.w.localStorage).records[0].completedOn, '2026-11-01'); assert.equal(dst.api.readContext(dst.w.localStorage).stage, 'peri'); dst.close();
  } finally { process.env.TZ = 'Asia/Singapore'; }
});
test('Routine times include midnight, validate strictly and only produce an in-app local cue', () => {
  const view = harness(); view.api.saveRoutine(view.w.localStorage, { time: '00:00', enabled: true }, null, new view.w.Date());
  assert.match(view.api.routineCue(view.plan(), new view.w.Date()), /time has arrived: 00:00 local time/); assert.match(view.api.routineCue(view.plan(), new view.w.Date()), /no push, email or device alarm/);
  for (const time of ['24:00', '9:01', '12:60', '']) assert.throws(() => view.api.saveRoutine(view.w.localStorage, { time, enabled: true }, view.data.get(keys.routine), new view.w.Date()));
  view.close();
});
test('Full-page form saves and restores explicit context, edits contraception and requires fresh confirmation', () => {
  const view = harness({ page: 'full', appearance: 'nurture' }); view.by('stage').value = 'ttc'; view.by('contraception').value = 'hormonal'; view.by('confirm').checked = false; view.submit('context-form');
  assert.equal(view.data.has(keys.context), false); assert.match(view.by('message').textContent, /Confirm that these/);
  view.by('confirm').checked = true; view.submit('context-form'); assert.equal(view.api.readContext(view.w.localStorage).stage, 'ttc'); assert.equal(view.by('confirm').checked, false); assert.equal(view.by('stage').value, 'ttc'); assert.ok(view.d.querySelector('[data-task="stage-ttc"]'));
  view.by('contraception').value = 'nonhormonal'; view.by('confirm').checked = true; view.submit('context-form'); assert.equal(view.api.readContext(view.w.localStorage).contraception, 'nonhormonal');
  assert.equal(view.data.get('ovuluna_persona'), 'nurture'); assert.equal(view.d.documentElement.dataset.persona, 'nurture'); assert.deepEqual(view.errors, []); view.close();
});
test('Dirty context and routine drafts survive denied writes and other-tab changes until explicitly reopened', () => {
  const view = harness({ page: 'full', stage: 'ttc' }); view.by('stage').value = 'peri'; view.by('confirm').checked = true; const before = view.data.get(keys.context); view.deny(false, true); view.submit('context-form');
  assert.equal(view.data.get(keys.context), before); assert.equal(view.by('stage').value, 'peri'); assert.match(view.by('message').textContent, /quota/); view.deny(false, false);
  view.data.delete(keys.context); view.event('storage', keys.context); assert.equal(view.by('save-context').disabled, true); assert.equal(view.by('stage').value, 'peri'); view.submit('context-form'); assert.equal(view.data.has(keys.context), false);
  view.w.confirm = () => false; view.by('reload-context').click(); assert.equal(view.by('stage').value, 'peri'); view.w.confirm = () => true; view.by('reload-context').click(); assert.equal(view.by('stage').value, ''); assert.equal(view.by('save-context').disabled, false);
  view.by('routine-time').value = '19:30'; view.data.set(keys.routine, JSON.stringify({ version: 1, time: '08:00', enabled: true, updatedAt: new view.w.Date().toISOString() })); view.event('storage', keys.routine); assert.equal(view.by('save-routine').disabled, true); assert.equal(view.by('routine-time').value, '19:30');
  view.w.confirm = () => false; view.by('reload-routine').click(); assert.equal(view.by('routine-time').value, '19:30'); view.w.confirm = () => true; view.by('reload-routine').click(); assert.equal(view.by('routine-time').value, '08:00'); view.close();
});
test('Stale rendered completion controls cannot recreate deleted completion data', () => {
  const view = harness({ page: 'full', stage: 'ttc' }); const checkbox = view.d.querySelector('[data-task="one-note"] input'); checkbox.checked = true; checkbox.dispatchEvent(new view.w.Event('change')); assert.ok(view.data.has(keys.completions));
  const staleCheckbox = view.d.querySelector('[data-task="one-note"] input'); view.data.delete(keys.completions); staleCheckbox.checked = false; staleCheckbox.dispatchEvent(new view.w.Event('change'));
  assert.equal(view.data.has(keys.completions), false); assert.match(view.by('message').textContent, /changed in another page/); view.close();
});
test('Home preview needs no forms, prioritizes care, exposes why/source/edit links and never writes data', () => {
  const view = harness({ page: 'preview', stage: 'post', seed(w, data, today) { w.OvulunaObservations.save(w.localStorage, { kind: 'bleeding', observedOn: today, values: { amount: 'Spotting' }, contextFlags: ['Postmenopause (self-reported)'], notes: '' }, null, new w.Date()); } });
  const before = JSON.stringify([...view.data]), preview = view.d.getElementById('daily-home-preview'), actions = [...preview.querySelectorAll('[data-task]')];
  assert.equal(actions.length, 2); assert.equal(actions[0].dataset.task, 'bleeding-care'); assert.match(actions[0].textContent, /Why: You recorded Spotting/); assert.ok(actions[0].querySelector('a[href="cycle-log.html"]')); assert.ok(actions[0].querySelector('button[data-evidence="life-post-bleeding"][aria-label]')); assert.ok(preview.querySelector('a[href="daily.html"]')); assert.equal(preview.querySelector('input'), null);
  for (const name of ['focus', 'pageshow', 'storage']) view.event(name, null); assert.equal(view.writes(), 0); assert.equal(JSON.stringify([...view.data]), before); assert.equal(preview.querySelectorAll('[data-task]').length, 2); assert.deepEqual(view.errors, []); view.close();
});
test('An actual same-page Home form save immediately updates the daily preview and failed saves emit no success event', () => {
  const view = harness({ page: 'home', stage: 'ttc' }), preview = view.d.getElementById('daily-home-preview'); let events = 0;
  view.w.addEventListener('ovuluna:records-changed', event => { events++; assert.equal(event.detail.key, keys.checkins); assert.equal(event.detail.category, 'mood'); assert.equal(event.detail.observedOn, view.today); });
  assert.equal(preview.querySelector('[data-task="connection"]'), null);
  function saveMood(mood) {
    view.d.querySelector('[data-checkin="mood"] span:not(.ms)').click();
    view.d.getElementById('checkin-mood').value = mood;
    view.d.getElementById('checkin-form').dispatchEvent(new view.w.Event('submit', { bubbles: true, cancelable: true }));
  }
  saveMood('Low'); assert.equal(events, 1); assert.match(preview.querySelector('[data-task="connection"]').textContent, /Today you reported mood Low/); assert.equal(view.d.getElementById('logProgress').textContent, '1 of 6 recorded');
  saveMood('Good'); assert.equal(events, 2); assert.equal(preview.querySelector('[data-task="connection"]'), null); assert.match(preview.querySelector('[data-task="one-note"]').textContent, /1 readable check-in/);
  const before = view.data.get(keys.checkins); view.deny(false, true); saveMood('Low'); assert.equal(events, 2); assert.equal(view.data.get(keys.checkins), before); assert.equal(preview.querySelector('[data-task="connection"]'), null); assert.match(view.d.getElementById('checkin-error').textContent, /quota/); assert.equal(preview.querySelectorAll('[data-task]').length, 2);
  assert.deepEqual(view.errors, []); view.close();
});
test('Same-page record changes refresh daily reading output without replacing unsaved context or routine drafts', () => {
  const view = harness({ page: 'full', stage: 'ttc' }); view.by('stage').value = 'peri'; view.by('contraception').value = 'hormonal'; view.by('confirm').checked = true; view.by('routine-time').value = '22:30'; view.by('routine-enabled').checked = true;
  const beforeContext = view.data.get(keys.context); view.checkin('mood', { mood: 'Low' });
  assert.ok(view.d.querySelector('[data-task="connection"]')); assert.equal(view.by('stage').value, 'peri'); assert.equal(view.by('contraception').value, 'hormonal'); assert.equal(view.by('confirm').checked, true); assert.equal(view.by('routine-time').value, '22:30'); assert.equal(view.by('routine-enabled').checked, true); assert.equal(view.by('save-context').disabled, false); assert.equal(view.data.get(keys.context), beforeContext); assert.equal(view.data.has(keys.routine), false); view.close();
});
test('Routine cue updates while open at the selected time, clears on pagehide and refreshes on return', () => {
  const view = harness({ page: 'preview', stage: 'ttc', now: '2026-10-01T11:59:00Z', seed(w, data) { data.set(keys.routine, JSON.stringify({ version: 1, time: '20:00', enabled: true, updatedAt: new w.Date().toISOString() })); } });
  const cue = () => view.d.querySelector('.daily-routine-cue').textContent; assert.match(cue(), /time today: 20:00/); assert.equal(view.timers.size, 1); view.advance(60025); assert.match(cue(), /time has arrived: 20:00/); assert.equal(view.writes(), 0);
  view.event('pagehide'); assert.equal(view.timers.size, 0); view.setNow('2026-10-02T00:00:00Z'); view.event('pageshow'); assert.equal(view.timers.size, 1); assert.match(cue(), /time today: 20:00/); view.close();
});
test('Midnight, focus and back navigation refresh dated records and completion without duplicates or writes', () => {
  const view = harness({ page: 'full', stage: 'ttc', now: '2026-10-01T15:59:00Z', seed(w, data, today) { w.OvulunaCheckins.save(w.localStorage, { category: 'mood', observedOn: today, values: { mood: 'Low' } }, new w.Date()); data.set(keys.completions, JSON.stringify({ version: 1, records: [{ taskId: 'one-note', completedOn: today, completedAt: new w.Date().toISOString(), utcOffsetMinutes: new w.Date().getTimezoneOffset() }] })); } });
  assert.ok(view.d.querySelector('[data-task="connection"]')); assert.equal(view.d.querySelector('[data-task="one-note"] input').checked, true);
  view.advance(60025); assert.equal(view.api.day(new view.w.Date()), '2026-10-02'); assert.equal(view.d.querySelector('[data-task="connection"]'), null); assert.equal(view.d.querySelector('[data-task="one-note"] input').checked, false); assert.equal(view.by('status-date').max, '2026-10-02');
  view.checkin('mood', { mood: 'Low' }, '2026-10-02'); const writes = view.writes(); view.event('focus'); view.event('pageshow'); assert.equal(view.d.querySelectorAll('[data-task="connection"]').length, 1); assert.equal(view.writes(), writes); view.close();
});
test('Every static and dynamic source button resolves; local record links exist and readable assets are present', () => {
  for (const stage of ['teen', 'cycling', 'ttc', 'pregnant', 'postpartum', 'peri', 'post', 'unspecified']) {
    const view = harness({ page: 'full', stage }); view.checkin('sleep', { hours: 0, quality: 'Poor' }); view.checkin('mood', { mood: 'Low' }); if (stage === 'post') bleeding(view, ['Postmenopause (self-reported)']); view.event('focus'); view.sources();
    for (const button of view.d.querySelectorAll('.qi[data-evidence]')) { assert.ok(view.w.EVIDENCE_DB[button.dataset.evidence], 'Missing source: ' + button.dataset.evidence); assert.ok(button.getAttribute('aria-label')); assert.equal(button.type, 'button'); }
    for (const anchor of view.d.querySelectorAll('.daily-page a[href]')) { const href = anchor.getAttribute('href'); if (!href.startsWith('https:') && !href.startsWith('#')) assert.ok(fs.existsSync(path.join(root, href.split('#')[0])), 'Missing link: ' + href); }
    for (const image of view.d.querySelectorAll('.daily-page img[src]')) assert.ok(fs.existsSync(path.join(root, image.getAttribute('src'))));
    const scripts = [...view.d.querySelectorAll('script[src]')].map(script => script.getAttribute('src')); assert.ok(scripts.indexOf('evidence-daily.js') < scripts.indexOf('evidence-merge.js')); assert.deepEqual(view.errors, []); view.close();
  }
});
console.log(JSON.stringify({ suite: 'Daily companion and independent Home preview', groups: results.length, passed: results.filter(result => result.passed).length, results, scope: 'Synthetic records, actual strict readers and isolated DOM. No clinical validity, screen-reader or visual-layout claim.' }, null, 2));
if (results.some(result => !result.passed)) process.exitCode = 1;
