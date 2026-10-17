#!/usr/bin/env node
// Actual contract + isolated DOM checks. No browser profile, backend or real data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.argv[2] || path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'journal-records.js'), 'utf8');
const apiContext = { Date }; vm.createContext(apiContext); vm.runInContext(code, apiContext);
const api = apiContext.OvulunaJournal;
const now = new Date('2026-09-30T10:00:00Z');
const base = { date: '2026-09-28', mood: 'Good', energy: 'Steady', comfort: 'Comfortable', notes: 'Synthetic note' };
const passed = [];
function test(name, work) { work(); passed.push(name); }
function storage(initial = {}) { const data = new Map(Object.entries(initial)); return { data, getItem(key) { return data.get(key) ?? null; }, setItem(key, value) { data.set(key, value); } }; }
test('Read-only empty and legacy date-keyed entries remain unchanged', () => {
  const store = storage(); assert.equal(api.read(store).length, 0); assert.equal(store.data.size, 0);
  const raw = JSON.stringify([base]); store.data.set(api.KEY, raw); assert.equal(api.read(store)[0].notes, base.notes); assert.equal(store.getItem(api.KEY), raw);
});
test('New save, reload and explicit edit preserve other dates and existing metadata', () => {
  const store = storage({ [api.KEY]: JSON.stringify([{ ...base, originNote: 'Keep old metadata' }]), unrelated: 'keep' });
  const prior = api.snapshot(store); const saved = api.save(store, { ...base, mood: 'Low', notes: '<script>literal</script>' }, prior, base.date, now);
  assert.equal(saved.originNote, 'Keep old metadata'); assert.equal(saved.notes, '<script>literal</script>'); assert.equal(api.read(store).length, 1);
  api.save(store, { ...base, date: '2026-09-29' }, api.snapshot(store), null, now);
  assert.equal(api.read(store).length, 2); assert.equal(store.getItem('unrelated'), 'keep');
});
test('Invalid choices, impossible/future dates and oversized notes cannot write', () => {
  for (const input of [{ ...base, date: '2026-02-30' }, { ...base, date: '2026-10-02' }, { ...base, mood: 'super-healthy' }, { ...base, notes: 'x'.repeat(1001) }]) {
    const store = storage(); assert.throws(() => api.save(store, input, null, null, now)); assert.equal(store.data.size, 0);
  }
});
test('An existing date needs an explicit loaded edit, with no accidental rename or recreation', () => {
  const store = storage({ [api.KEY]: JSON.stringify([base]) }), snapshot = api.snapshot(store);
  assert.throws(() => api.save(store, base, snapshot, null, now), /already saved/);
  assert.throws(() => api.save(store, { ...base, date: '2026-09-29' }, snapshot, base.date, now), /removed or its date changed/);
  assert.equal(api.snapshot(store), snapshot);
});
test('Intervening save/deletion cannot be replaced by a stale draft', () => {
  const store = storage({ [api.KEY]: JSON.stringify([base]) }), loaded = api.snapshot(store);
  api.save(store, { ...base, mood: 'Low' }, loaded, base.date, now); const updated = api.snapshot(store);
  assert.throws(() => api.save(store, { ...base, mood: 'Mixed' }, loaded, base.date, now), /changed in another page/); assert.equal(api.snapshot(store), updated);
  store.data.delete(api.KEY);
  assert.throws(() => api.save(store, base, updated, base.date, now), /changed in another page/); assert.equal(store.data.size, 0);
});
test('Corrupt, duplicated, unsupported and denied stores are never silently repaired', () => {
  for (const raw of ['{broken', JSON.stringify({ records: [] }), JSON.stringify([base, base]), JSON.stringify([{ ...base, mood: 'unknown' }])]) {
    const store = storage({ [api.KEY]: raw }); assert.throws(() => api.read(store)); assert.throws(() => api.save(store, base, raw, base.date, now)); assert.equal(api.snapshot(store), raw);
  }
  assert.throws(() => api.read({ getItem() { throw Error('denied'); } }), /denied/);
});
test('Failed writes and a changed snapshot during validation do not report success', () => {
  const store = storage({ [api.KEY]: JSON.stringify([base]) }), loaded = api.snapshot(store);
  assert.throws(() => api.save({ getItem: store.getItem, setItem() { throw Error('quota'); } }, base, loaded, base.date, now), /quota/); assert.equal(api.snapshot(store), loaded);
  let reads = 0;
  assert.throws(() => api.save({ getItem() { reads++; return reads === 1 ? loaded : null; }, setItem() { throw Error('should not write'); } }, base, loaded, base.date, now), /changed in another page/);
});
test('Editing cannot move the recorded update time backwards', () => {
  const store = storage({ [api.KEY]: JSON.stringify([{ ...base, updatedAt: '2026-09-30T12:00:00Z' }]) });
  assert.throws(() => api.save(store, base, api.snapshot(store), base.date, now), /device clock/);
});

// JSDOM executes this local source only. External scripts/images are not loaded.
const { JSDOM } = require(process.env.OVULUNA_JSDOM_PATH || 'jsdom');
function ui(initial = {}, options = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'wellness-checkin.html'), 'utf8'), { url: 'https://synthetic-ovuluna.invalid/', runScripts: 'outside-only' });
  const { window } = dom;
  const store = storage(initial); let writes = 0;
  Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem(key) { if (options.readDenied) throw Error('denied'); return store.getItem(key); }, setItem(key, value) { if (options.writeDenied) throw Error('quota'); writes++; store.setItem(key, value); } } });
  window.confirm = () => options.confirm !== false;
  window.eval(code);
  const get = id => window.document.getElementById(id);
  const choose = date => { get('entry-date').value = date; get('entry-date').dispatchEvent(new window.Event('change', { bubbles: true })); };
  const submit = () => get('journal').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  return { dom, window, store, get, choose, submit, writes: () => writes };
}
test('Edit restores original values; saving changes updates one date and displays literal notes', () => {
  const view = ui({ [api.KEY]: JSON.stringify([base, { ...base, date: '2026-09-29', mood: 'Mixed' }]) });
  view.window.document.querySelector('[aria-label="Edit journal entry for 2026-09-28"]').click();
  assert.equal(view.get('entry-date').value, base.date); assert.equal(view.get('notes').value, base.notes); assert.equal(view.get('mood').value, 'Good');
  view.get('notes').value = '<b>Corrected literal note</b>'; view.submit();
  const records = JSON.parse(view.store.getItem(api.KEY)); assert.equal(records.length, 2); assert.equal(records.find(r => r.date === base.date).notes, '<b>Corrected literal note</b>');
  assert.equal(view.get('history').querySelector('b'), null); assert.match(view.get('journal-status').textContent, /saved for 2026-09-28/); view.dom.window.close();
});
test('Choosing dates restores saved values or clears fields for a new date; cancelling preserves data', () => {
  const raw = JSON.stringify([base]), view = ui({ [api.KEY]: raw }); view.choose(base.date);
  assert.equal(view.get('mood').value, base.mood); view.get('mood').value = 'Low'; view.get('journal-cancel').click();
  assert.equal(view.store.getItem(api.KEY), raw); view.choose('2026-09-29'); assert.equal(view.get('mood').value, ''); assert.equal(view.get('notes').value, ''); assert.equal(view.writes(), 0); view.dom.window.close();
});
test('Declining draft discard preserves typed values and the original selected date', () => {
  const view = ui({}, { confirm: false }), date = view.get('entry-date').value; view.get('notes').value = 'Unsaved draft'; view.choose(base.date);
  assert.equal(view.get('entry-date').value, date); assert.equal(view.get('notes').value, 'Unsaved draft'); assert.equal(view.writes(), 0); view.dom.window.close();
});
test('Other-tab deletion disables a loaded edit and cannot restore deleted data', () => {
  const view = ui({ [api.KEY]: JSON.stringify([base]) }); view.choose(base.date); view.get('notes').value = 'Stale draft'; view.store.data.delete(api.KEY);
  view.window.dispatchEvent(new view.window.StorageEvent('storage', { key: api.KEY, newValue: null }));
  assert.equal(view.get('journal-save').disabled, true); assert.equal(view.get('notes').value, 'Stale draft'); view.submit(); assert.equal(view.store.data.size, 0); assert.equal(view.writes(), 0); view.dom.window.close();
});
test('Corrupt/denied reads disable saving/export; failed writes keep the draft without success', () => {
  for (const view of [ui({ [api.KEY]: '{broken' }), ui({}, { readDenied: true })]) {
    assert.equal(view.get('journal-save').disabled, true); assert.equal(view.get('export').disabled, true); assert.equal(view.writes(), 0); view.dom.window.close();
  }
  const view = ui({}, { writeDenied: true }); view.choose(base.date); for (const key of ['mood', 'energy', 'comfort', 'notes']) view.get(key).value = base[key]; view.submit();
  assert.match(view.get('journal-status').textContent, /Could not save/); assert.equal(view.get('notes').value, base.notes); assert.equal(view.store.data.size, 0); view.dom.window.close();
});
console.log(JSON.stringify({ suite: 'Date-keyed journal edit and stale-write safeguards', groups: passed.length, passed, scope: 'Synthetic in-memory contracts and isolated DOM only. No user data, real login, device or clinical validation.' }, null, 2));
