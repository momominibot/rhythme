#!/usr/bin/env node
/* Dependency-free regressions for the published-coefficient PhenoAge reference.
 * Run: node scripts/check-bio-age.cjs
 * These verify implementation behavior, not clinical validation of the app/model.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'bio-age.js'), 'utf8');
let count = 0;
const test = (label, run) => { run(); count++; console.log('PASS ' + label); };
const clone = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≠ ${expected}`);
function engine() {
  const values = new Map();
  const reads = [];
  let blocked = false;
  const localStorage = {
    getItem(key) { if (blocked) throw new Error('blocked'); reads.push(key); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { if (blocked) throw new Error('blocked'); values.set(key, value); }
  };
  const window = { localStorage };
  vm.runInNewContext(code, { window }, { filename: 'bio-age.js' });
  return { api: window.OvulunaWellness, values, reads, block: value => { blocked = value; } };
}
const nativePanel = {
  albumin: { value: 43, unit: 'g/L' }, creatinine: { value: 70, unit: 'µmol/L' },
  glucose: { value: 5, unit: 'mmol/L' }, crp: { value: 0.1, unit: 'mg/dL' },
  lymphocyte_pct: { value: 30, unit: '%' }, mcv: { value: 90, unit: 'fL' },
  rdw: { value: 13, unit: '%' }, alkaline_phosphatase: { value: 60, unit: 'U/L' },
  wbc: { value: 5, unit: '10³/µL' }
};
const { api } = engine();
const input = () => ({ biomarkers: clone(nativePanel), chronologicalAge: 40, panelDate: '2025-02-10' });

test('published source fixture matches the original CDF transformation', () => {
  // Independent fixture: Table S1 rounded weights, Supplement 1 pp.1–2 constants.
  // Evaluate original CDF here, instead of copying the engine's stable log algebra.
  const xb = -19.9067 + .0804 * 40 - .0336 * 43 + .0095 * 70 + .1953 * 5 +
    .0954 * Math.log(.1) - .0120 * 30 + .0268 * 90 + .3306 * 13 + .0019 * 60 + .0554 * 5;
  const mortalityCDF = 1 - Math.exp(-Math.exp(xb) * (Math.exp(120 * .0076927) - 1) / .0076927);
  const original = 141.50225 + Math.log(-.00553 * Math.log(1 - mortalityCDF)) / .090165;
  const result = api.calculatePhenoAge(nativePanel, 40);
  close(original, 31.85745939379771);
  close(result.phenoAge, original);
  assert.equal(result.isApproximation, true);
  assert.equal(result.displayStatus, 'research-approximation');
});
test('independent 65-digit Decimal fixture matches the published model', () => {
  // Independently evaluated by the coordinating reviewer using Python Decimal
  // with 65-digit precision and the original CDF + inverse, not this engine.
  const panel = clone(nativePanel);
  panel.albumin.value = 42; panel.glucose.value = 5.1; panel.lymphocyte_pct.value = 32;
  panel.alkaline_phosphatase.value = 70; panel.wbc.value = 6;
  close(api.calculatePhenoAge(panel, 40).phenoAge, 33.00568764200931521198);
});
test('SI inputs remain SI; equivalent explicit US units give the same result', () => {
  const us = clone(nativePanel);
  us.albumin = { value: 4.3, unit: 'g/dL' };
  us.creatinine = { value: 70 / 88.4, unit: 'mg/dL' };
  us.glucose = { value: 5 * 18.0182, unit: 'mg/dL' };
  us.crp = { value: 1, unit: 'mg/L' };
  us.wbc.unit = '10⁹/L';
  const before = JSON.stringify(us);
  close(api.calculatePhenoAge(us, 40).phenoAge, api.calculatePhenoAge(nativePanel, 40).phenoAge);
  assert.equal(JSON.stringify(us), before);
  assert.equal(api.convertToPhenoUnits(nativePanel).values.albumin, 43);
});
test('each missing marker prevents a numeric result', () => {
  for (const key of Object.keys(nativePanel)) {
    const panel = clone(nativePanel); delete panel[key];
    const result = api.calculatePhenoAge(panel, 40);
    assert.ok(result.error); assert.equal(result.phenoAge, undefined); assert.ok(result.missing.includes(key));
  }
});
test('ambiguous legacy bare values and unsupported units are rejected', () => {
  const bare = Object.fromEntries(Object.entries(nativePanel).map(([key, entry]) => [key, entry.value]));
  assert.equal(api.calculatePhenoAge(bare, 40).invalid.length, 9);
  for (const unit of ['', 'mg/L', 'toString', '__proto__', null, undefined, ['g/L'], 1]) {
    const panel = clone(nativePanel); panel.albumin.unit = unit;
    assert.ok(api.calculatePhenoAge(panel, 40).invalid.includes('albumin'));
  }
});
test('non-numeric, non-finite, absent and out-of-range values never coerce to readings', () => {
  for (const value of ['', '43', null, undefined, NaN, Infinity, -Infinity, 0, -1, 100000]) {
    const panel = clone(nativePanel); panel.albumin.value = value;
    assert.ok(api.calculatePhenoAge(panel, 40).error);
  }
  assert.ok(api.calculatePhenoAge(null, 40).error);
  assert.ok(api.calculatePhenoAge([], 40).error);
});
test('CRP is positive, converted before log, and never silently clamped', () => {
  const first = clone(nativePanel); const second = clone(nativePanel);
  first.crp.value = .0001; second.crp.value = .001;
  close(api.calculatePhenoAge(second, 40).phenoAge - api.calculatePhenoAge(first, 40).phenoAge, .0954 * Math.log(10) / .090165);
  first.crp.value = 0; assert.ok(api.calculatePhenoAge(first, 40).error);
  first.crp.value = -1; assert.ok(api.calculatePhenoAge(first, 40).error);
});
test('supported age boundary is explicit and finite', () => {
  for (const age of [undefined, null, '40', 0, 19, 101, NaN, Infinity]) assert.ok(api.calculatePhenoAge(nativePanel, age).error);
  for (const age of [20, 40.5, 100]) assert.ok(Number.isFinite(api.calculatePhenoAge(nativePanel, age).phenoAge));
});
test('extreme accepted panel avoids floating-point Infinity and suppresses outlier headline', () => {
  const extreme = clone(nativePanel);
  const values = { albumin: 20, creatinine: 400, glucose: 30, crp: 50, lymphocyte_pct: 5, mcv: 120, rdw: 25, alkaline_phosphatase: 500, wbc: 30 };
  Object.keys(values).forEach(key => { extreme[key].value = values[key]; });
  const result = api.calculatePhenoAge(extreme, 100);
  assert.ok(Number.isFinite(result.phenoAge)); assert.ok(result.phenoAge > 120);
  assert.equal(result.displayable, false); assert.equal(result.displayStatus, 'unsupported-outlier');
  const xb = -19.9067 + .0804 * 100 - .0336 * 20 + .0095 * 400 + .1953 * 30 + .0954 * Math.log(50) - .0120 * 5 + .0268 * 120 + .3306 * 25 + .0019 * 500 + .0554 * 30;
  assert.equal(1 - Math.exp(-Math.exp(xb) * (Math.exp(120 * .0076927) - 1) / .0076927), 1);
  const wrapper = api.calculateWellness({ biomarkers: extreme, chronologicalAge: 100 });
  assert.equal(wrapper.phenoAge.available, false); assert.equal(wrapper.phenoAge.value, null);
});
test('very small positive CRP yields finite math without a negative age headline', () => {
  const panel = clone(nativePanel); panel.crp.value = Number.MIN_VALUE;
  const result = api.calculatePhenoAge(panel, 20);
  assert.ok(Number.isFinite(result.phenoAge)); assert.ok(result.phenoAge < 0);
  assert.equal(result.displayable, false);
});
test('unsupported habit composite retains only observed values, including explicit zero/false', () => {
  const partial = api.calculateWellnessScore({ sleepHours: 8 });
  assert.equal(partial.score, null); assert.equal(partial.available, false);
  assert.equal(partial.observations.smoker, undefined);
  const observed = api.calculateWellnessScore({ smoker: false, alcoholPerWeek: 0, hrvRmssd: 15, sleepHours: '8' });
  assert.equal(observed.observations.smoker, false); assert.equal(observed.observations.alcoholPerWeek, 0);
  assert.equal(observed.observations.sleepHours, undefined); assert.equal(observed.score, null);
  assert.equal(api.calculateWellness(undefined).phenoAge.available, false);
});
test('invalid, future and non-calendar blood-draw dates are rejected', () => {
  for (const panelDate of ['', '2099-01-01', '2025-02-29', '2024-02-30', '2024-13-01', '2024-2-01', null]) assert.ok(api.createRecord({ ...input(), panelDate }).error);
  assert.ok(!api.createRecord({ ...input(), panelDate: '2024-02-29' }).error);
});
test('calculation is ephemeral until explicit save; original values and units persist', () => {
  const env = engine();
  const data = input(); data.biomarkers.albumin = { value: 4.3, unit: 'g/dL' };
  const record = env.api.createRecord(data);
  assert.equal(env.values.size, 0);
  assert.equal(env.api.saveResult(record), true);
  const loaded = env.api.getHistory()[0];
  assert.equal(loaded.biomarkers.albumin.value, 4.3); assert.equal(loaded.biomarkers.albumin.unit, 'g/dL');
  assert.equal(loaded.panelDate, data.panelDate); assert.equal(loaded.modelVersion, env.api.MODEL_VERSION);
  assert.ok(loaded.result.source.startsWith('https://www.aging-us.com/'));
  assert.equal(env.api.saveResult(record), true); assert.equal(env.api.getHistory().length, 1);
  assert.ok(env.reads.every(key => key === env.api.STORAGE_KEY));
});
test('legacy demo data is never silently imported or overwritten', () => {
  const env = engine(); env.values.set('ovuluna_wellness_data', '[{"score":80}]');
  assert.equal(env.api.getHistory().length, 0);
  env.api.saveResult(env.api.createRecord(input()));
  assert.equal(env.values.get('ovuluna_wellness_data'), '[{"score":80}]');
});
test('changed, unknown-version and tampered results cannot be saved', () => {
  const env = engine();
  const record = env.api.createRecord(input());
  const tampered = clone(record); tampered.result.phenoAge = 18; assert.equal(env.api.saveResult(tampered), false);
  const old = clone(record); old.modelVersion = 'old-demo'; assert.equal(env.api.saveResult(old), false);
  assert.equal(env.api.saveResult({}), false);
  assert.equal(env.api.saveResult(record), true);
  const collision = env.api.createRecord({ ...input(), chronologicalAge: 41 }); collision.id = record.id;
  assert.equal(env.api.saveResult(collision), false); assert.equal(env.api.getHistory().length, 1);
});
test('stored derived display data is recomputed from the original panel', () => {
  const env = engine(); const record = env.api.createRecord(input());
  record.result.normalizedBiomarkers = { albumin: '<img src=x>' }; record.result.displayable = false;
  assert.equal(env.api.saveResult(record), true);
  assert.equal(env.api.getHistory()[0].result.normalizedBiomarkers.albumin, 43);
  assert.equal(env.api.getHistory()[0].result.displayable, true);
});
test('corrupt saved data is untouched and blocks writes instead of being reset', () => {
  for (const raw of ['{bad', '{}', 'null', '[null]', '[{"schemaVersion":0}]']) {
    const env = engine(); env.values.set(env.api.STORAGE_KEY, raw);
    assert.equal(env.api.getHistory().length, 0);
    assert.equal(env.api.saveResult(env.api.createRecord(input())), false);
    assert.equal(env.values.get(env.api.STORAGE_KEY), raw);
  }
});
test('blocked storage does not prevent calculation and reports failed save', () => {
  const env = engine(); env.block(true);
  const record = env.api.createRecord(input()); assert.ok(!record.error);
  assert.equal(env.api.saveResult(record), false); assert.equal(env.api.getHistory().length, 0);
});
test('history never silently prunes records; individual deletion is explicit', () => {
  const env = engine(); const record = env.api.createRecord(input());
  const records = Array.from({ length: 500 }, (_, i) => ({ ...clone(record), id: 'record-' + i }));
  env.values.set(env.api.STORAGE_KEY, JSON.stringify(records));
  assert.equal(env.api.saveResult(record), false); assert.equal(env.api.getHistory().length, 500);
  assert.equal(env.api.deleteRecord('record-40'), true); assert.equal(env.api.getHistory().length, 499);
  assert.equal(env.api.deleteRecord('missing'), false); assert.equal(env.api.saveResult(record), true);
});
test('page links real routes, starts with no personal numbers and loads the engine', () => {
  const html = fs.readFileSync(path.join(root, 'bio-age.html'), 'utf8');
  assert.match(html, /<script src="bio-age\.js" defer/);
  assert.match(html, /id="pheno-number">—</);
  assert.match(html, /id="chronological-age"[^>]*required/);
  assert.match(html, /data-evidence="phenoage-2018-method"/);
  assert.doesNotMatch(html, /href="#"|Recalibrated from 42|lowered your bio-age|CHRONO 35|Last recalculated May/);
  for (const [, target] of html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)) {
    if (/^(https?:|data:)/.test(target)) continue;
    assert.ok(fs.existsSync(path.resolve(root, target.split(/[?#]/)[0])), 'Missing target: ' + target);
  }
});
console.log(`\n${count} Bio-Age regression groups passed. These are software checks, not clinical validation.`);
