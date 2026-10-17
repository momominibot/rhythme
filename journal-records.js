/* Local, date-keyed journal. Explicit edits preserve other dates and reject stale
   drafts. Snapshot comparisons are defensive checks, not atomic transactions. */
(function (root) {
  'use strict';
  const KEY = 'ovuluna_wellness_journal_v1';
  const CHOICES = { mood: ['Low', 'Mixed', 'Steady', 'Good'], energy: ['Low', 'Some', 'Steady', 'High'], comfort: ['Uncomfortable', 'Some discomfort', 'Comfortable'] };
  function day(now = new Date()) { return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-'); }
  function calendar(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false; const parsed = new Date(value + 'T12:00:00Z'); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; }
  function validEntry(record) {
    return record && typeof record === 'object' && !Array.isArray(record) && calendar(record.date) &&
      Object.keys(CHOICES).every(key => CHOICES[key].includes(record[key])) && typeof record.notes === 'string' && record.notes.length <= 1000 &&
      (record.updatedAt === undefined || (typeof record.updatedAt === 'string' && Number.isFinite(Date.parse(record.updatedAt))));
  }
  function decode(raw) {
    if (raw === null) return [];
    let records; try { records = JSON.parse(raw); } catch (_) { throw Error('Saved journal data is unreadable. It has not been changed.'); }
    if (!Array.isArray(records) || records.some(record => !validEntry(record)) || new Set(records.map(record => record.date)).size !== records.length) throw Error('Saved journal data has an unsupported entry. It has not been changed.');
    return records;
  }
  function snapshot(storage) { return storage.getItem(KEY); }
  function read(storage) { return decode(snapshot(storage)); }
  function validate(input, now = new Date()) {
    if (!input || !calendar(input.date) || input.date > day(now)) throw Error('Choose a real entry date, on or before today.');
    for (const key of Object.keys(CHOICES)) if (!CHOICES[key].includes(input[key])) throw Error('Choose a listed answer for ' + key + '.');
    if (typeof input.notes !== 'string' || input.notes.length > 1000) throw Error('Keep your note within 1,000 characters.');
    return { date: input.date, mood: input.mood, energy: input.energy, comfort: input.comfort, notes: input.notes.trim() };
  }
  function assertSnapshot(storage, expected) {
    if (expected !== null && typeof expected !== 'string') throw Error('The loaded journal snapshot is missing. Reopen the entry before saving.');
    const raw = snapshot(storage);
    if (raw !== expected) throw Error('Journal data changed in another page. Your draft is kept. Reopen the saved entry or start a new entry before saving.');
    return raw;
  }
  function save(storage, input, expected, editingDate, now = new Date()) {
    const entry = validate(input, now), records = decode(assertSnapshot(storage, expected));
    const index = records.findIndex(record => record.date === entry.date);
    if (editingDate && (editingDate !== entry.date || index < 0)) throw Error('This entry was removed or its date changed. Reopen a saved entry before editing.');
    if (!editingDate && index >= 0) throw Error('An entry is already saved for this date. Open it to review before saving changes.');
    const previous = index < 0 ? null : records[index];
    const stamp = now.toISOString();
    if (previous?.updatedAt && stamp < previous.updatedAt) throw Error('The device clock is earlier than this entry. Correct it before editing.');
    const saved = { ...(previous || {}), ...entry, updatedAt: stamp };
    if (index < 0) records.push(saved); else records[index] = saved;
    assertSnapshot(storage, expected);
    storage.setItem(KEY, JSON.stringify(records));
    return saved;
  }
  const api = { KEY, CHOICES, day, calendar, validEntry, snapshot, read, validate, save };
  root.OvulunaJournal = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  const d = root.document, form = d?.getElementById('journal'); if (!form) return;
  const date = d.getElementById('entry-date'), status = d.getElementById('journal-status'), history = d.getElementById('history');
  const saveButton = d.getElementById('journal-save'), cancel = d.getElementById('journal-cancel'), mode = d.getElementById('journal-mode');
  const inputs = Object.fromEntries(['mood', 'energy', 'comfort', 'notes'].map(key => [key, d.getElementById(key)]));
  let expected = null, editingDate = null, loadedDate = day(), baseline = '', stale = false;
  function current() { return JSON.stringify({ date: date.value, ...Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value])) }); }
  function message(text) { status.textContent = text; }
  function invalidate(text) { stale = true; saveButton.disabled = true; message(text); }
  function mount(selectedDate) {
    try {
      const raw = snapshot(root.localStorage), records = decode(raw), existing = records.find(record => record.date === selectedDate);
      expected = raw; editingDate = existing ? existing.date : null; loadedDate = selectedDate; date.value = selectedDate; date.max = day();
      for (const key of Object.keys(inputs)) inputs[key].value = existing ? existing[key] : '';
      mode.textContent = existing ? 'Editing saved entry for ' + selectedDate : 'New entry for ' + selectedDate;
      saveButton.textContent = existing ? 'Save changes' : 'Save journal entry'; cancel.hidden = !existing;
      stale = false; saveButton.disabled = false; baseline = current();
      return true;
    } catch (_) { if (!baseline) baseline = current(); invalidate('This browser could not read the saved journal. Existing data has not been changed.'); return false; }
  }
  function render() {
    history.replaceChildren(); d.getElementById('export').disabled = true;
    try {
      const records = read(root.localStorage).slice().sort((a, b) => b.date.localeCompare(a.date));
      if (!records.length) { history.textContent = 'No entries yet. Your first saved check-in will appear here.'; return; }
      d.getElementById('export').disabled = false;
      if (records.length > 30) { const note = d.createElement('p'); note.textContent = 'Showing the latest 30 entries. Export includes every saved date.'; history.append(note); }
      for (const record of records.slice(0, 30)) {
        const article = d.createElement('article'); article.className = 'journal-entry';
        const heading = d.createElement('h3'); heading.textContent = record.date;
        const detail = d.createElement('p'); detail.textContent = 'Mood: ' + record.mood + ' · Energy: ' + record.energy + ' · Body: ' + record.comfort;
        article.append(heading, detail);
        if (record.notes) { const note = d.createElement('p'); note.textContent = record.notes; article.append(note); }
        const edit = d.createElement('button'); edit.type = 'button'; edit.className = 'btn ghost'; edit.textContent = 'Edit entry'; edit.setAttribute('aria-label', 'Edit journal entry for ' + record.date);
        edit.addEventListener('click', () => {
          if (current() !== baseline && !root.confirm('Discard the unsaved journal draft and open this saved entry?')) return;
          if (mount(record.date)) { message('Saved values restored for ' + record.date + '. Review your changes before saving.'); date.focus(); }
        });
        article.append(edit); history.append(article);
      }
    } catch (_) { history.textContent = 'This browser could not read the saved journal. Existing data has not been changed.'; }
  }
  date.addEventListener('change', () => {
    const next = date.value;
    date.value = loadedDate; const dirty = current() !== baseline; date.value = next;
    if (dirty && !root.confirm('Discard this unsaved draft and open the selected date?')) { date.value = loadedDate; return; }
    if (mount(next)) message(editingDate ? 'Restored the saved entry for ' + next + '.' : 'No entry is saved for ' + next + '. Start a new entry here.');
  });
  cancel.addEventListener('click', () => {
    if (current() !== baseline && !root.confirm('Discard unsaved changes? Your saved entries will stay.')) return;
    if (mount(day())) message('Unsaved changes discarded. Saved entries are unchanged.');
  });
  form.addEventListener('submit', event => {
    event.preventDefault(); if (stale) return message('Your draft cannot overwrite changed journal data. Open a saved entry or choose a date to refresh it.');
    if (!form.reportValidity()) return;
    try {
      const saved = save(root.localStorage, { date: date.value, ...Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value])) }, expected, editingDate);
      mount(saved.date); render(); message('Journal entry saved for ' + saved.date + ' on this browser.');
    } catch (error) { message('Could not save: ' + error.message); }
  });
  d.getElementById('export').addEventListener('click', () => {
    try {
      const records = read(root.localStorage), blob = new root.Blob([JSON.stringify({ kind: 'Self-reported wellness journal', exportedAt: new Date().toISOString(), entries: records }, null, 2)], { type: 'application/json' });
      const url = root.URL.createObjectURL(blob), link = d.createElement('a'); link.href = url; link.download = 'ovuluna-wellness-journal.json'; link.click(); root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
      message('Journal download requested. Keep the file somewhere private.');
    } catch (_) { message('Could not export the journal. Existing data has not been changed.'); }
  });
  function changed() { try { if (snapshot(root.localStorage) !== expected) { invalidate('Journal data changed in another page. Your draft is kept but cannot overwrite those changes. Open a saved entry or select a date before saving.'); render(); } } catch (_) { invalidate('Browser storage is unavailable. Your draft has not been saved.'); } }
  root.addEventListener('storage', event => { if (event.key === KEY || event.key === null) { invalidate('Journal data changed in another page. Your draft is kept but cannot overwrite those changes. Open a saved entry or select a date before saving.'); render(); } });
  root.addEventListener('pageshow', changed); d.addEventListener('visibilitychange', () => { if (!d.hidden) changed(); });
  root.addEventListener('beforeunload', event => { if (current() !== baseline) { event.preventDefault(); event.returnValue = ''; } });
  mount(day()); render();
})(typeof window !== 'undefined' ? window : globalThis);
