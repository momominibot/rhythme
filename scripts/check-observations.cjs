/* Uses only synthetic observations and isolated in-memory browser storage. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const obs = require(path.join(__dirname, '..', 'observation-records.js'));
const NOW = new Date('2026-09-12T12:00:00.000Z');
let passed = 0;
function test(name, work) {
  try { work(); passed++; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + '\n'); throw error; }
}
function storage() {
  const data = new Map();
  return { data, getItem(key) { return data.has(key) ? data.get(key) : null; }, setItem(key, value) { data.set(key, String(value)); }, removeItem(key) { data.delete(key); } };
}
function input(kind = 'bbt', values = {}) {
  const defaults = {
    bleeding: { amount: 'Spotting' },
    bbt: { value: '36.52', unit: '°C', site: 'Oral', thermometer: 'Synthetic thermometer', beforeActivity: 'Yes' },
    mucus: { appearance: 'Unsure', sensation: 'Dry', method: 'Toilet tissue' },
    urine: { analyte: 'LH', brand: 'Synthetic brand', model: 'Synthetic strip', format: 'Qualitative', result: 'Negative' },
    treatment: { type: 'Medicine', name: 'Synthetic prescribed medicine' },
    device: { manufacturer: 'Synthetic maker', model: 'Synthetic watch', measurementType: 'Wrist temperature', outputType: 'Raw reading', originalOutput: '35.80', unit: '°C' }
  };
  return { kind, observedOn: '2026-09-11', observedTime: '07:30', utcOffsetMinutes: 480, contextFlags: [], notes: '', values: { ...defaults[kind], ...values } };
}
function save(store, raw = input(), now = NOW) { return obs.save(store, raw, obs.snapshot(store), now); }
function original(store, attempt, pattern) {
  const before = obs.snapshot(store);
  assert.throws(attempt, pattern);
  assert.equal(obs.snapshot(store), before, 'rejected mutation changed storage');
}
test('browser global loads without Node bindings or a DOM', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'observation-records.js'), 'utf8'), context);
  assert.equal(context.OvulunaObservations.KEY, obs.KEY);
  assert.deepEqual(Array.from(context.OvulunaObservations.MISSING_REASONS), obs.MISSING_REASONS);
});
test('a read or validation never creates storage', () => {
  const store = storage();
  assert.deepEqual(obs.read(store), { version: 1, records: [] });
  assert.equal(obs.snapshot(store), null);
  obs.validate(input(), NOW);
  assert.equal(store.data.size, 0);
});
test('save, reload, edit and remove preserve canonical identity and provenance', () => {
  const store = storage();
  const record = save(store);
  assert.equal(record.sourceType, 'user-transcribed');
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.createdAt, NOW.toISOString());
  assert.equal(record.recordedAt, record.createdAt);
  assert.deepEqual(obs.read(store).records, [record]);
  const edit = obs.save(store, { ...input('bbt', { value: 36.7 }), id: record.id }, obs.snapshot(store), new Date('2026-09-12T12:01:00Z'));
  assert.equal(edit.id, record.id); assert.equal(edit.createdAt, record.createdAt); assert.notEqual(edit.updatedAt, record.updatedAt);
  assert.equal(obs.read(store).records.length, 1);
  assert.equal(obs.remove(store, record.id, obs.snapshot(store)).id, record.id);
  assert.deepEqual(obs.read(store).records, []);
});
test('multiple events on one day and original unknown offset are preserved', () => {
  const store = storage();
  const first = save(store);
  const second = save(store, { ...input(), observedTime: '08:10', utcOffsetMinutes: '' });
  assert.notEqual(first.id, second.id);
  assert.equal(second.observedOn, first.observedOn);
  assert.equal(second.utcOffsetMinutes, null);
  assert.equal(obs.read(store).records.length, 2);
});
test('every observation kind survives JSON export and reload with complete metadata', () => {
  const store = storage();
  Object.keys(obs.FIELDS).forEach(kind => save(store, input(kind)));
  const exported = JSON.parse(obs.snapshot(store));
  assert.equal(exported.version, 1);
  assert.equal(exported.records.length, 6);
  exported.records.forEach(record => {
    assert.deepEqual(Object.keys(record.values).sort(), obs.FIELDS[record.kind].fields.map(field => field.key).sort());
    assert.equal(record.sourceType, ['bleeding', 'mucus'].includes(record.kind) ? 'self-observed' : 'user-transcribed');
    assert.equal(record.utcOffsetMinutes, 480);
    assert.equal(record.observedTime, '07:30');
    assert.equal(record.recordedAt, NOW.toISOString());
  });
  const copy = storage(); copy.setItem(obs.KEY, JSON.stringify(exported));
  assert.deepEqual(obs.read(copy), exported);
});
test('unsure differs from missing and omitted context never becomes a negative answer', () => {
  const record = obs.validate(input('mucus', { appearance: 'Unsure', sensation: 'Unsure' }), NOW);
  assert.equal(record.missingReason, null);
  assert.equal(record.values.stretch, null);
  assert.deepEqual(record.contextFlags, []);
  const missing = obs.validate({ kind: 'bbt', observedOn: '2026-09-11', missingReason: 'Missed measurement', values: { thermometer: 'Synthetic thermometer' } }, NOW);
  assert.equal(missing.values.value, null); assert.equal(missing.values.beforeActivity, null);
  assert.equal(missing.observedTime, null); assert.equal(missing.utcOffsetMinutes, null);
  assert.equal(missing.values.thermometer, 'Synthetic thermometer');
  assert.throws(() => obs.validate({ ...input(), missingReason: 'Missed measurement' }, NOW), /missing observation/);
});
test('all missing observations permit no result and reject contradictory filled results', () => {
  const outputs = { bleeding: { amount: 'None observed' }, bbt: { value: '36.5' }, mucus: { appearance: 'Unsure' }, urine: { format: 'Qualitative', result: 'Invalid' }, treatment: { name: 'Medicine' }, device: { originalOutput: '0' } };
  Object.keys(obs.FIELDS).forEach(kind => {
    assert.equal(obs.validate({ kind, observedOn: '2026-09-11', missingReason: 'Not observed' }, NOW).missingReason, 'Not observed');
    assert.throws(() => obs.validate({ kind, observedOn: '2026-09-11', missingReason: 'Not observed', values: outputs[kind] }, NOW), /missing observation/);
  });
});
test('zero is retained for concentrations and ratios; blank and unsupported units are rejected', () => {
  const numeric = { analyte: 'LH', brand: 'Brand', model: 'Model', format: 'Numeric concentration', qualifier: '=', numericValue: '0', unit: 'mIU/mL' };
  const raw = { kind: 'urine', observedOn: '2026-09-11', values: numeric };
  assert.equal(obs.validate(raw, NOW).values.numericValue, 0);
  assert.equal(obs.validate({ ...raw, values: { ...numeric, qualifier: '<' } }, NOW).values.qualifier, '<');
  assert.throws(() => obs.validate({ ...raw, values: { ...numeric, qualifier: '' } }, NOW), /Enter Result symbol/);
  assert.throws(() => obs.validate({ ...raw, values: { ...numeric, qualifier: '~' } }, NOW), /listed value/);
  assert.throws(() => obs.validate({ ...raw, values: { ...numeric, numericValue: '' } }, NOW), /Enter Original numeric/);
  assert.throws(() => obs.validate({ ...raw, values: { ...numeric, unit: 'ng/mL' } }, NOW), /does not match/);
  assert.throws(() => obs.validate({ ...raw, values: { ...numeric, unit: 'mg/dL' } }, NOW), /listed value/);
  const pdg = obs.validate({ ...raw, values: { ...numeric, analyte: 'PdG', unit: 'µg/mL', numericValue: 2.35 } }, NOW);
  assert.equal(pdg.values.numericValue, 2.35); assert.equal(pdg.values.unit, 'µg/mL');
  const ratio = { ...raw, values: { analyte: 'LH', brand: 'Brand', model: 'Model', format: 'App line ratio', ratio: '0', readerApp: 'Original reader' } };
  assert.equal(obs.validate(ratio, NOW).values.ratio, 0);
  assert.equal(obs.validate(ratio, NOW).values.unit, null);
  assert.throws(() => obs.validate({ ...ratio, values: { ...ratio.values, unit: 'mIU/mL' } }, NOW), /does not match the selected result format/);
  assert.throws(() => obs.validate({ ...ratio, values: { ...ratio.values, readerApp: '' } }, NOW), /Enter Strip-reading app/);
});
test('urine formats never mix outputs and invalid or uncertain exact text stays descriptive', () => {
  assert.equal(obs.validate(input('urine', { result: 'Invalid - no control line' }), NOW).values.result, 'Invalid - no control line');
  assert.equal(obs.validate(input('urine', { result: 'Uncertain' }), NOW).values.result, 'Uncertain');
  assert.throws(() => obs.validate(input('urine', { ratio: 0.5 }), NOW), /does not match the selected result format/);
  const invalid = obs.validate({ kind: 'urine', observedOn: '2026-09-11', missingReason: 'Invalid test', values: { brand: 'Brand', model: 'Model' } }, NOW);
  assert.equal(invalid.values.result, null);
  assert.throws(() => obs.validate({ kind: 'mucus', observedOn: '2026-09-11', missingReason: 'Invalid test' }, NOW), /applies to a urine/);
});
test('temperature units remain original, wrist readings and baseline changes remain separate', () => {
  const c = obs.validate(input(), NOW), f = obs.validate(input('bbt', { value: '97.736', unit: '°F' }), NOW);
  assert.equal(c.values.value, 36.52); assert.equal(f.values.value, 97.736); assert.equal(f.values.unit, '°F');
  assert.throws(() => obs.validate(input('bbt', { value: '36.52', unit: '°F' }), NOW), /original temperature/);
  assert.throws(() => obs.validate(input('bbt', { site: 'Wrist' }), NOW), /listed value/);
  const wrist = obs.validate(input('device'), NOW); assert.equal(wrist.kind, 'device');
  const delta = obs.validate(input('device', { measurementType: 'Temperature change from baseline', outputType: 'Derived estimate', originalOutput: '-0.20', sourceApp: 'Source app', appVersion: '1.2.3' }), NOW);
  assert.equal(delta.values.originalOutput, '-0.20'); assert.equal(delta.values.appVersion, '1.2.3');
  assert.throws(() => obs.validate(input('device', { measurementType: 'Temperature change from baseline' }), NOW), /derived output/);
  assert.throws(() => obs.validate(input('device', { appVersion: '1.2.3' }), NOW), /source app/);
});
test('spotting is distinct from full flow and contradictory dates cannot be saved', () => {
  assert.equal(obs.validate(input('bleeding'), NOW).values.firstFullFlow, null);
  assert.throws(() => obs.validate(input('bleeding', { firstFullFlow: 'Yes' }), NOW), /first full-flow day/);
  assert.throws(() => obs.validate(input('bleeding', { amount: 'Light flow', firstFullFlow: 'Yes', firstFullFlowOn: '2026-09-10' }), NOW), /must match/);
  assert.throws(() => obs.validate(input('bleeding', { firstFullFlowOn: '2026-09-12' }), NOW), /cannot follow/);
});
test('treatment notes remain user transcribed, ordered dates and withheld context are explicit', () => {
  const treatment = obs.validate(input('treatment', { startedOn: '2026-09-01', stoppedOn: '2026-09-10', clinicianPlan: 'User copied their plan' }), NOW);
  assert.equal(treatment.sourceType, 'user-transcribed');
  assert.equal(treatment.values.clinicianPlan, 'User copied their plan');
  assert.throws(() => obs.validate(input('treatment', { startedOn: '2026-09-10', stoppedOn: '2026-09-01' }), NOW), /before the start/);
  assert.throws(() => obs.validate(input('treatment', { startedOn: '2026-09-12' }), NOW), /on or before this observation/);
  const withheld = obs.validate({ kind: 'treatment', observedOn: '2026-09-11', values: { type: 'Prefer not to say' } }, NOW);
  assert.equal(withheld.values.name, null);
  assert.throws(() => obs.validate(input('treatment', { type: 'Prefer not to say' }), NOW), /Leave treatment details empty/);
});
test('multiline plan and notes survive editing; single-line fields reject hidden line breaks', () => {
  const store = storage();
  const plan = 'First line\nSecond line';
  const record = save(store, { ...input('treatment', { clinicianPlan: plan }), notes: 'Note one\nNote two' });
  assert.equal(record.values.clinicianPlan, plan);
  assert.equal(obs.read(store).records[0].values.clinicianPlan, plan);
  assert.equal(obs.FIELDS.treatment.fields.find(field => field.key === 'clinicianPlan').multiline, true);
  assert.throws(() => obs.validate(input('bbt', { thermometer: 'One\nTwo' }), NOW), /single line/);
  assert.throws(() => obs.validate(input('device', { originalOutput: '35\r80' }), NOW), /single line/);
});
test('invalid dates, times, NaN, infinity, coercions, options and oversized text fail', () => {
  ['2026-02-29', '2026-04-31', '2026-09-13', '0000-01-01', '09/11/2026'].forEach(observedOn => assert.throws(() => obs.validate({ ...input(), observedOn }, NOW), /calendar date/));
  assert.equal(obs.validate({ ...input(), observedOn: '2024-02-29' }, NOW).observedOn, '2024-02-29');
  ['24:00', '12:60', '7:30', '08:00:00'].forEach(observedTime => assert.throws(() => obs.validate({ ...input(), observedTime }, NOW), /24-hour/));
  [NaN, Infinity, 'NaN', '36.5abc', '0x24', true, [], {}, ' ', '1e4'].forEach(value => assert.throws(() => obs.validate(input('bbt', { value }), NOW), /finite decimal|finite number/));
  [841, -841, 330.5].forEach(utcOffsetMinutes => assert.throws(() => obs.validate({ ...input(), utcOffsetMinutes }, NOW), /whole minutes/));
  assert.throws(() => obs.validate(input('mucus', { appearance: 'Fertile' }), NOW), /listed value/);
  assert.throws(() => obs.validate({ ...input(), notes: 'a'.repeat(2001) }, NOW), /too long/);
  assert.throws(() => obs.validate({ ...input(), contextFlags: ['Not pregnant'] }, NOW), /listed context/);
  assert.throws(() => obs.validate({ ...input(), contextFlags: ['Fever or illness', 'Fever or illness'] }, NOW), /at most once/);
  assert.throws(() => obs.validate({ ...input(), contextFlags: ['Prefer not to say', 'Fever or illness'] }, NOW), /on its own/);
});
test('spoofed provenance, unknown fields and inherited-type injection fail closed', () => {
  ['device-import', 'clinician-entered', 'self-observed'].forEach(sourceType => assert.throws(() => obs.validate({ ...input(), sourceType }, NOW), /user-entered observations/));
  assert.throws(() => obs.validate({ ...input(), verified: true }, NOW), /unsupported fields/);
  assert.throws(() => obs.validate(input('bbt', { ovulationConfirmed: true }), NOW), /unsupported fields/);
  assert.throws(() => obs.validate({ ...input(), kind: '__proto__' }, NOW), /observation type/);
  assert.throws(() => obs.validate(JSON.parse('{"kind":"bbt","observedOn":"2026-09-11","__proto__":{"verified":true}}'), NOW), /unsupported fields/);
});
test('stale new and edit drafts cannot restore data after Settings clears the store', () => {
  const store = storage(), existing = save(store), stale = obs.snapshot(store);
  store.removeItem(obs.KEY);
  original(store, () => obs.save(store, input(), stale, NOW), /changed in another page/);
  original(store, () => obs.save(store, { ...input(), id: existing.id }, stale, NOW), /changed in another page/);
  original(store, () => obs.save(store, { ...input(), id: existing.id }, null, NOW), /cannot be recreated/);
  // An explicit fresh blank draft can add a new entry after deletion.
  const fresh = obs.save(store, input(), null, NOW);
  assert.notEqual(fresh.id, existing.id);
});
test('stale update and delete cannot overwrite an intervening save', () => {
  const store = storage(), existing = save(store), stale = obs.snapshot(store);
  save(store, input('mucus'));
  original(store, () => obs.save(store, { ...input(), id: existing.id }, stale, NOW), /changed in another page/);
  original(store, () => obs.remove(store, existing.id, stale), /changed in another page/);
  original(store, () => obs.save(store, input(), undefined, NOW), /original snapshot is missing/);
});
test('the immediate prewrite check catches a change during validation/read', () => {
  const store = storage(); const initial = save(store), expected = obs.snapshot(store);
  const get = store.getItem.bind(store); let calls = 0;
  store.getItem = key => { calls++; if (calls === 2) store.setItem(key, JSON.stringify({ version: 1, records: [] })); return get(key); };
  assert.throws(() => obs.save(store, { ...input(), id: initial.id }, expected, NOW), /changed in another page/);
  assert.deepEqual(JSON.parse(get(obs.KEY)).records, []);
});
test('corrupt or future stores and malformed records cannot be silently repaired', () => {
  const good = storage(); save(good);
  const cases = ['{broken', JSON.stringify({ version: 2, records: [] }), JSON.stringify({ version: 1, records: [], extra: true })];
  const mutations = [record => { record.sourceType = 'clinician-entered'; }, record => { record.schemaVersion = 2; }, record => { record.values.value = null; }, record => { record.values.unit = 'K'; }, record => { record.values.value = '36.52'; }, record => { record.notes = ' trailing '; }, record => { record.recordedAt = 'invalid'; }, record => { delete record.missingReason; }, record => { record.values.extra = true; }];
  mutations.forEach(mutate => { const data = JSON.parse(obs.snapshot(good)); mutate(data.records[0]); cases.push(JSON.stringify(data)); });
  const duplicate = JSON.parse(obs.snapshot(good)); duplicate.records.push(duplicate.records[0]); cases.push(JSON.stringify(duplicate));
  cases.forEach(raw => {
    const store = storage(); store.setItem(obs.KEY, raw);
    assert.throws(() => obs.read(store));
    original(store, () => obs.save(store, input(), raw, NOW));
    original(store, () => obs.remove(store, 'id', raw));
  });
});
test('denied reads and failed writes do not report save or deletion success', () => {
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('should not write'); } };
  assert.throws(() => obs.read(denied), /denied/);
  assert.throws(() => obs.save(denied, input(), null, NOW), /denied/);
  const store = storage(); const existing = save(store), originalRaw = obs.snapshot(store);
  store.setItem = () => { throw new Error('quota exceeded'); };
  assert.throws(() => obs.save(store, input(), originalRaw, NOW), /quota exceeded/);
  assert.equal(obs.snapshot(store), originalRaw);
  assert.throws(() => obs.remove(store, existing.id, originalRaw), /quota exceeded/);
  assert.equal(obs.snapshot(store), originalRaw);
});
test('editing cannot move update time backwards', () => {
  const store = storage(), record = save(store);
  obs.save(store, { ...input(), id: record.id }, obs.snapshot(store), new Date('2026-09-12T13:00:00Z'));
  original(store, () => obs.save(store, { ...input(), id: record.id }, obs.snapshot(store), NOW), /device clock/);
});
process.stdout.write(JSON.stringify({ passed, storeKey: obs.KEY, scope: 'Synthetic local observation contract; no clinical validation, real user data, backend or browser atomic-write claim.' }) + '\n');
