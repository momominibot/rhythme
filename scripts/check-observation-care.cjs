#!/usr/bin/env node
/* Actual observation form/controller, synthetic storage. Context notes never save,
   reinterpret, clear or modify a reading. Native layout needs browser validation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2] || path.resolve(__dirname, '..');
const { JSDOM } = require(process.env.OVULUNA_JSDOM_PATH || 'jsdom');
const html = fs.readFileSync(path.join(root, 'cycle-log.html'), 'utf8');
const passed = [];
function test(name, work) { work(); passed.push(name); }
function harness({ appearance = 'wisdom', saved = false } = {}) {
  const dom = new JSDOM(html, { url: 'https://synthetic-ovuluna.invalid/cycle-log.html', runScripts: 'outside-only' });
  const { window } = dom, d = window.document, data = new Map([['ovuluna_persona', appearance], ['unrelated', 'keep']]), writes = [], reads = [];
  let locked = false;
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem(key) { reads.push(key); return data.get(key) ?? null; },
    setItem(key, value) { if (locked) { writes.push(key); throw Error('A context note must not save data'); } data.set(key, value); }
  } });
  d.documentElement.dataset.persona = appearance;
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
  window.eval(fs.readFileSync(path.join(root, 'observation-records.js'), 'utf8'));
  if (saved) window.OvulunaObservations.save(window.localStorage, { kind: 'bleeding', observedOn: '2026-09-29', values: { amount: 'Spotting' }, contextFlags: ['Postmenopause (self-reported)'], notes: 'Synthetic saved context' }, null, new window.Date('2026-09-30T10:00:00Z'));
  locked = true; reads.length = 0; const before = JSON.stringify([...data]);
  window.eval(fs.readFileSync(path.join(root, 'observations-ui.js'), 'utf8'));
  const get = id => d.getElementById('observation-' + id);
  const choose = (name, value) => { const input = get(name); input.value = value; input.dispatchEvent(new window.Event('change', { bubbles: true })); };
  const flag = (value, checked = true) => { const input = [...get('context-flags').querySelectorAll('input')].find(node => node.value === value); assert.ok(input, value); input.checked = checked; input.dispatchEvent(new window.Event('change', { bubbles: true })); };
  return { dom, window, d, data, reads, writes, get, choose, flag, note: () => get('care-note'), unchanged() { assert.deepEqual(writes, []); assert.equal(JSON.stringify([...data]), before); } };
}
test('Appearance alone and blank observation/context do not produce a postmenopause or postpartum care note', () => {
  for (const appearance of ['bloom', 'grow', 'nurture', 'wisdom']) {
    const view = harness({ appearance }); assert.equal(view.note().hidden, true); view.choose('value-amount', 'Spotting');
    assert.equal(view.note().hidden, true); assert.equal(view.reads.includes('ovuluna_persona'), false); view.unchanged(); view.dom.window.close();
  }
});
test('Explicit postmenopause plus any available bleeding choice shows bounded sourced guidance next to Save', () => {
  const view = harness(); view.flag('Postmenopause (self-reported)'); assert.equal(view.note().hidden, true);
  for (const amount of ['Spotting', 'Light flow', 'Moderate flow', 'Heavy flow', 'Unsure']) {
    view.choose('value-amount', amount); assert.equal(view.note().hidden, false);
    assert.match(view.note().textContent, /Arrange medical assessment for any vaginal bleeding after menopause, even slight spotting or a single episode\. Logging it does not replace assessment\./);
    assert.equal(view.note().querySelector('button').dataset.evidence, 'life-post-bleeding');
    assert.equal(view.note().querySelector('button').type, 'button');
    assert.ok(view.note().querySelector('button').getAttribute('aria-label'));
    assert.equal(view.note().querySelector('a').getAttribute('href'), 'journey-post.html');
  }
  assert.equal(view.note().nextElementSibling, view.get('save').closest('.observation-actions')); view.unchanged(); view.dom.window.close();
});
test('No bleeding, missed/withheld readings and withheld context hide the note without clearing draft fields', () => {
  const view = harness(); view.flag('Postmenopause (self-reported)'); view.choose('value-amount', 'None observed'); assert.equal(view.note().hidden, true);
  view.choose('value-amount', 'Spotting');
  for (const missing of ['Not observed', 'Missed measurement', 'Unable to interpret', 'Prefer not to say']) {
    view.choose('missing', missing); assert.equal(view.note().hidden, true); assert.equal(view.get('value-amount').value, 'Spotting');
  }
  view.choose('missing', ''); assert.equal(view.note().hidden, false);
  view.flag('Prefer not to say'); assert.equal(view.note().hidden, true);
  view.flag('Prefer not to say', false); view.flag('Postmenopause (self-reported)', false); assert.equal(view.note().hidden, true);
  view.unchanged(); view.dom.window.close();
});
test('Explicit postpartum bleeding shows after-birth context and preserves the entered full-flow choice', () => {
  const view = harness({ appearance: 'grow' }); view.choose('value-amount', 'Moderate flow'); view.choose('value-firstFullFlow', 'Yes');
  view.flag('Postpartum'); assert.equal(view.note().hidden, false);
  assert.match(view.note().textContent, /Bleeding after birth is not automatically the start of a menstrual cycle/);
  assert.equal(view.note().querySelector('button').dataset.evidence, 'life-postnatal-bleeding');
  assert.equal(view.note().querySelector('a').getAttribute('href'), 'journey-nurture.html');
  assert.equal(view.get('value-firstFullFlow').value, 'Yes'); assert.equal(view.get('value-amount').value, 'Moderate flow');
  view.flag('Postpartum', false); assert.equal(view.note().hidden, true); view.unchanged(); view.dom.window.close();
});
test('Editing a saved bleeding entry restores its care note without changing any saved fields', () => {
  const view = harness({ saved: true }); view.d.querySelector('#observation-history button[aria-label^="Edit bleeding"]').click();
  assert.equal(view.note().hidden, false); assert.equal(view.get('value-amount').value, 'Spotting'); assert.equal(view.get('notes').value, 'Synthetic saved context');
  view.unchanged(); view.dom.window.close();
});
test('Care notes are scoped to available bleeding, never another observation type', () => {
  const view = harness(); view.d.querySelector('[data-observation-kind="bbt"]').click(); view.flag('Postmenopause (self-reported)');
  assert.equal(view.note().hidden, true); assert.equal(view.note().textContent, ''); view.unchanged(); view.dom.window.close();
});
test('Dynamic care-note source controls resolve to existing records and open the shared evidence dialog without saving', () => {
  const view = harness();
  for (const file of ['evidence-db.js', 'evidence-reconciled.js', 'evidence-lifecycle.js', 'evidence-acupoint.js', 'evidence-safety.js', 'evidence-core.js', 'evidence-merge.js', 'evidence.js']) view.window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
  view.choose('value-amount', 'Spotting'); view.flag('Postmenopause (self-reported)');
  const trigger = view.note().querySelector('button'); assert.ok(view.window.EVIDENCE_DB[trigger.dataset.evidence]); trigger.click();
  const evidenceDialog = view.d.querySelector('dialog[open]'); assert.ok(evidenceDialog); assert.match(evidenceDialog.textContent, /bleeding after menopause/i);
  view.unchanged(); view.dom.window.close();
});
console.log(JSON.stringify({ suite: 'Explicit bleeding-context care notes', groups: passed.length, passed, scope: 'Actual local observation/evidence controllers in isolated DOM, synthetic records only. No medical diagnosis, inference, live storage, browser layout or clinical validation.' }, null, 2));
