#!/usr/bin/env node
// Local page/controller in isolated DOM. Storage writes throw after fixture setup.
// This checks record integration and reading filters, not clinical validity or layout.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || path.resolve(__dirname, '..');
const { JSDOM } = require(process.env.OVULUNA_JSDOM_PATH || 'jsdom');
const html = fs.readFileSync(path.join(root, 'ovarian-health.html'), 'utf8');
const codes = Object.fromEntries(['observation-records.js', 'home-records.js', 'labs-records.js', 'insights-records.js', 'records-health.js'].map(name => [name, fs.readFileSync(path.join(root, name), 'utf8')]));
const KEYS = { observations: 'ovuluna_observations_v1', checkins: 'ovuluna_daily_checkins_v1', labs: 'ovuluna_lab_records_v1', journal: 'ovuluna_wellness_journal_v1' };
const passed = [];
function test(name, work) { work(); passed.push(name); }
function harness({ appearance = 'nurture', populated = true, denied = false, corrupt = false } = {}) {
  const dom = new JSDOM(html, { url: 'https://synthetic-ovuluna.invalid/ovarian-health.html', runScripts: 'outside-only' });
  const { window } = dom, d = window.document, data = new Map([['ovuluna_persona', appearance], ['unrelated', 'preserve']]), reads = [], attemptedWrites = [];
  const now = new window.Date('2026-09-30T10:00:00Z');
  let locked = false;
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem(key) { reads.push(key); if (locked && denied) throw Error('Storage denied'); return data.get(key) ?? null; },
    setItem(key, value) { if (locked) { attemptedWrites.push(key); throw Error('This page must not write saved records'); } data.set(key, value); },
    removeItem(key) { attemptedWrites.push(key); throw Error('This page must not delete saved records'); }
  } });
  d.documentElement.dataset.persona = appearance;
  for (const name of ['observation-records.js', 'home-records.js', 'labs-records.js']) window.eval(codes[name]);
  if (populated) {
    const api = window.OvulunaObservations;
    api.save(window.localStorage, { kind: 'bleeding', observedOn: '2026-09-29', values: { amount: 'Spotting' }, contextFlags: ['Postmenopause (self-reported)'], notes: '<b>Synthetic literal note</b>' }, null, now);
    api.save(window.localStorage, { kind: 'bbt', observedOn: '2026-09-28', missingReason: 'Missed measurement', values: {}, contextFlags: ['Perimenopause (self-reported)'] }, api.snapshot(window.localStorage), now);
    window.OvulunaCheckins.save(window.localStorage, { category: 'symptoms', observedOn: '2026-09-29', values: { pain: 0, notes: 'Synthetic context, no diagnosis' } }, now);
    window.OvulunaLabs.saveRecord(window.localStorage, { analyte: 'amh', qualifier: '<', value: '0.1', unit: 'ng/mL', collectedOn: '2026-09-28', context: 'Synthetic bounded lab report', sourceName: 'Fixture lab', assay: 'Fixture assay', referenceLow: '', referenceHigh: '' }, null, now);
    data.set(KEYS.journal, JSON.stringify([{ date: '2026-09-29', mood: 'Mixed', energy: 'Low', comfort: 'Some discomfort', notes: 'Synthetic journal' }]));
  }
  if (corrupt) for (const key of Object.values(KEYS)) data.set(key, '{broken');
  locked = true; reads.length = 0;
  const before = JSON.stringify([...data]);
  window.eval(codes['insights-records.js']); window.eval(codes['records-health.js']);
  return {
    dom, window, d, data, reads, attemptedWrites, before,
    count(kind) { return d.querySelector('[data-summary="' + kind + '-count"]').textContent; },
    collection(kind) { return d.querySelector('[data-records="' + kind + '"]').textContent; },
    select(value) { const select = d.getElementById('record-context'); select.value = value; select.dispatchEvent(new window.Event('change', { bubbles: true })); },
    visible() { return [...d.querySelectorAll('[data-record-context]')].filter(card => !card.hidden).map(card => card.dataset.recordContext); },
    unchanged() { assert.deepEqual(attemptedWrites, []); assert.equal(JSON.stringify([...data]), before); }
  };
}
test('All five chapter cards are reachable through a labeled native reading selector', () => {
  const view = harness();
  assert.equal(view.d.querySelector('label[for="record-context"]').textContent, 'Your context for this page');
  assert.equal(view.d.querySelectorAll('[data-record-context]').length, 5);
  assert.deepEqual(view.visible(), ['bloom', 'grow', 'nurture', 'peri', 'post']);
  for (const chapter of ['bloom', 'grow', 'nurture', 'peri', 'post']) {
    view.select(chapter); assert.deepEqual(view.visible(), [chapter]);
    const card = view.d.querySelector('[data-record-context="' + chapter + '"]');
    assert.ok(card.querySelector('h2')); assert.ok(card.querySelector('a[href]'));
    assert.ok(card.querySelector('button.qi[aria-label][data-ev]'));
  }
  view.select('all'); assert.equal(view.visible().length, 5); view.unchanged(); view.dom.window.close();
});
test('Reading context is never inferred from a persona preference and changing it never modifies records', () => {
  for (const appearance of ['bloom', 'grow', 'nurture', 'wisdom']) {
    const view = harness({ appearance });
    assert.equal(view.d.getElementById('record-context').value, 'all'); assert.equal(view.reads.includes('ovuluna_persona'), false);
    view.select('post'); view.select('grow'); view.select('all');
    assert.match(view.collection('observations'), /Postmenopause \(self-reported\)/);
    assert.match(view.collection('observations'), /Perimenopause \(self-reported\)/);
    view.unchanged(); view.dom.window.close();
  }
});
test('Actual collection summaries retain entered inequalities, units, zero, missingness and safe literal text', () => {
  const view = harness();
  assert.equal(view.count('observation'), '2'); assert.equal(view.count('checkin'), '1'); assert.equal(view.count('lab'), '1'); assert.equal(view.count('journal'), '1');
  assert.match(view.collection('observations'), /Spotting/); assert.match(view.collection('observations'), /Missed measurement/);
  assert.match(view.collection('observations'), /<b>Synthetic literal note<\/b>/); assert.equal(view.d.querySelector('[data-records="observations"] b'), null);
  assert.match(view.collection('labs'), /< 0\.1 ng\/mL/); assert.match(view.collection('labs'), /Collected 2026-09-28/);
  assert.match(view.collection('checkins'), /Cramp pain.*: 0/); assert.match(view.collection('journal'), /Mood: Mixed/);
  view.unchanged(); view.dom.window.close();
});
test('Source buttons resolve to source records and have accessible labels', () => {
  const view = harness();
  for (const name of ['evidence-db.js', 'evidence-reconciled.js', 'evidence-lifecycle.js', 'evidence-acupoint.js', 'evidence-safety.js', 'evidence-core.js', 'evidence-merge.js']) view.window.eval(fs.readFileSync(path.join(root, name), 'utf8'));
  const buttons = [...view.d.querySelectorAll('button.qi[data-evidence]')]; assert.ok(buttons.length >= 9);
  for (const button of buttons) {
    assert.ok(button.getAttribute('aria-label')?.startsWith('Sources:'));
    assert.ok(view.window.EVIDENCE_DB[button.dataset.evidence], 'Missing source record: ' + button.dataset.evidence);
  }
  view.unchanged(); view.dom.window.close();
});
test('Empty, corrupt and denied stores remain explicit without inserting healthy defaults or writing data', () => {
  const empty = harness({ populated: false });
  for (const kind of ['observation', 'checkin', 'lab', 'journal']) assert.equal(empty.count(kind), '0');
  assert.match(empty.collection('observations'), /No cycle observations saved/); empty.unchanged(); empty.dom.window.close();
  for (const view of [harness({ corrupt: true }), harness({ denied: true })]) {
    for (const kind of ['observation', 'checkin', 'lab', 'journal']) assert.equal(view.count(kind), 'Unavailable');
    assert.match(view.collection('observations'), /could not be read/); view.select('nurture'); view.unchanged(); view.dom.window.close();
  }
});
test('Other-tab deletion and back navigation refresh collections without duplicate or stale personal values', () => {
  const view = harness(); view.data.delete(KEYS.observations); view.window.dispatchEvent(new view.window.StorageEvent('storage', { key: KEYS.observations }));
  assert.equal(view.count('observation'), '0'); assert.doesNotMatch(view.collection('observations'), /Spotting/);
  view.window.dispatchEvent(new view.window.Event('pageshow')); assert.equal(view.d.querySelectorAll('[data-records="labs"] article').length, 1);
  assert.deepEqual(view.attemptedWrites, []); assert.equal(view.data.get('unrelated'), 'preserve'); view.dom.window.close();
});
console.log(JSON.stringify({ suite: 'Understand records reading-context and no-write integration', groups: passed.length, passed, scope: 'Synthetic in-memory records and isolated DOM; no live user data, login, layout, accessibility certification or clinical validation.' }, null, 2));
