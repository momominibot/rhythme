/* User-transcribed lab records. No conversion, age inference or clinical cutoffs. */
(function (root) {
  'use strict';
  const KEY = 'ovuluna_lab_records_v1';
  const LEGACY_KEY = 'ovuluna_labs';
  const MARKERS = {
    amh: { label: 'AMH', units: ['ng/mL', 'pmol/L'] },
    fsh: { label: 'FSH', units: ['IU/L', 'mIU/mL'] },
    lh: { label: 'Luteinizing hormone (LH)', units: ['IU/L', 'mIU/mL'] },
    p4: { label: 'Progesterone (P4)', units: ['ng/mL', 'nmol/L'] },
    e2: { label: 'Estradiol (E2)', units: ['pg/mL', 'pmol/L'] },
    afc: { label: 'Antral follicle count (AFC)', units: ['follicles'] },
    vitd: { label: 'Vitamin D', units: ['ng/mL', 'nmol/L'] }
  };
  const QUALIFIERS = ['=', '<', '>', '≤', '≥'];
  function localDate(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function realDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function numberInput(value, label, optional) {
    const text = String(value == null ? '' : value).trim();
    if (!text && optional) return null;
    if (!text || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) || !Number.isFinite(Number(text))) {
      throw new Error(label + ' must be a non-negative, finite number from your report.');
    }
    return Number(text);
  }
  function optionalText(value, label, max) {
    if (value == null) return '';
    if (typeof value !== 'string' || value.trim().length > max) throw new Error(label + ' is too long or unreadable.');
    return value.trim();
  }
  function parseInput(input, now = new Date()) {
    if (!input || !Object.hasOwn(MARKERS, input.analyte)) throw new Error('Choose the test shown on your report.');
    if (!MARKERS[input.analyte].units.includes(input.unit)) throw new Error('Choose the exact unit printed on your report.');
    if (!QUALIFIERS.includes(input.qualifier)) throw new Error('Choose the result symbol printed on your report.');
    if (!realDate(input.collectedOn) || input.collectedOn > localDate(now)) throw new Error('Enter the actual collection date, on or before today.');
    const value = numberInput(input.value, 'Result', false);
    const referenceLow = numberInput(input.referenceLow, 'Lower report limit', true);
    const referenceHigh = numberInput(input.referenceHigh, 'Upper report limit', true);
    if (input.analyte === 'afc' && [value, referenceLow, referenceHigh].some(n => n !== null && !Number.isInteger(n))) throw new Error('A follicle count and its entered limits must be whole numbers.');
    if (referenceLow !== null && referenceHigh !== null && referenceLow > referenceHigh) throw new Error('The lower report limit cannot exceed the upper report limit.');
    return {
      analyte: input.analyte, value, qualifier: input.qualifier, unit: input.unit,
      collectedOn: input.collectedOn, referenceLow, referenceHigh,
      sourceName: optionalText(input.sourceName, 'Lab or report source', 160),
      assay: optionalText(input.assay, 'Assay or test method', 160),
      context: optionalText(input.context, 'Report context', 1000)
    };
  }
  function validStoredRecord(record) {
    if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id ||
        typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt)) ||
        typeof record.updatedAt !== 'string' || !Number.isFinite(Date.parse(record.updatedAt)) ||
        !Number.isFinite(record.value) || record.value < 0 || !realDate(record.collectedOn)) return false;
    for (const key of ['referenceLow', 'referenceHigh']) if (record[key] !== null && (!Number.isFinite(record[key]) || record[key] < 0)) return false;
    if (['sourceName', 'assay', 'context'].some(key => typeof record[key] !== 'string')) return false;
    try {
      // Validate stored metadata without silently normalizing or replacing records.
      parseInput(record, new Date(Math.max(Date.now(), Date.parse(record.collectedOn + 'T12:00:00Z'))));
      return true;
    } catch (_) { return false; }
  }
  function loadRecords(storage) {
    const raw = storage.getItem(KEY);
    if (raw === null) return { version: 1, records: [] };
    let data;
    try { data = JSON.parse(raw); } catch (_) { throw new Error('The saved lab log is unreadable. It has not been changed.'); }
    if (!data || data.version !== 1 || !Array.isArray(data.records) || data.records.some(record => !validStoredRecord(record)) ||
        new Set(data.records.map(record => record.id)).size !== data.records.length) {
      throw new Error('The saved lab log has an unsupported record format. It has not been changed.');
    }
    return data;
  }
  function saveRecord(storage, input, editingId, now = new Date()) {
    const values = parseInput(input, now);
    const data = loadRecords(storage);
    const index = editingId ? data.records.findIndex(record => record.id === editingId) : -1;
    if (editingId && index < 0) throw new Error('This entry is no longer available. Reload the page before editing.');
    const stamp = now.toISOString();
    const previous = index < 0 ? null : data.records[index];
    const id = previous ? previous.id : (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : 'lab-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    const record = { ...previous, ...values, id, createdAt: previous ? previous.createdAt : stamp, updatedAt: stamp };
    const records = data.records.slice();
    if (index < 0) records.push(record); else records[index] = record;
    // No write to legacy storage and no success until the storage operation succeeds.
    storage.setItem(KEY, JSON.stringify({ ...data, records }));
    return record;
  }
  function compareLimits(record) {
    if (record.qualifier !== '=') return 'Reported as a bound, so there is no automatic range comparison.';
    const low = record.referenceLow, high = record.referenceHigh;
    if (low === null && high === null) return 'No report limits entered.';
    if (low !== null && record.value < low) return 'Below your entered lower limit.';
    if (high !== null && record.value > high) return 'Above your entered upper limit.';
    if (low !== null && high !== null) return 'Within your entered numeric limits.';
    return low !== null ? 'At or above your entered lower limit; no upper limit entered.' : 'At or below your entered upper limit; no lower limit entered.';
  }
  const api = { KEY, LEGACY_KEY, MARKERS, parseInput, loadRecords, saveRecord, compareLimits };
  root.OvumindLabs = api;
  if (!root.document) return;
  const document = root.document;
  const form = document.getElementById('lab-record-form');
  if (!form) return;
  const status = document.getElementById('lab-status');
  const history = document.getElementById('lab-history');
  const fields = ['analyte', 'value', 'qualifier', 'unit', 'collectedOn', 'referenceLow', 'referenceHigh', 'sourceName', 'assay', 'context'];
  let editingId = null;
  const get = name => document.getElementById('lab-' + name);
  get('collectedOn').max = localDate(new Date());
  function message(text, error) { status.textContent = text; status.classList.toggle('is-error', !!error); }
  function units() {
    const select = get('unit'); select.replaceChildren();
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose report unit'; select.append(placeholder);
    const marker = MARKERS[get('analyte').value];
    if (marker) marker.units.forEach(unit => { const option = document.createElement('option'); option.value = unit; option.textContent = unit; select.append(option); });
  }
  get('analyte').addEventListener('change', units);
  function formInput() { const input = {}; fields.forEach(key => { input[key] = get(key).value; }); return input; }
  function resetForm() {
    editingId = null; form.reset(); units();
    document.getElementById('lab-save').textContent = 'Save lab result';
    document.getElementById('lab-cancel-edit').hidden = true;
  }
  function textNode(tag, text, className) {
    const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
  }
  function renderHistory() {
    history.replaceChildren();
    try {
      const records = loadRecords(root.localStorage).records;
      document.getElementById('lab-export').disabled = !records.length;
      if (!records.length) { history.textContent = 'No dated lab results saved yet.'; return true; }
      records.slice().sort((a, b) => b.collectedOn.localeCompare(a.collectedOn) || b.createdAt.localeCompare(a.createdAt)).forEach(record => {
        const article = document.createElement('article'); article.className = 'lab-entry';
        article.append(textNode('h3', MARKERS[record.analyte].label + ' · ' + record.collectedOn));
        article.append(textNode('p', (record.qualifier === '=' ? '' : record.qualifier + ' ') + record.value + ' ' + record.unit, 'result-value'));
        article.append(textNode('p', compareLimits(record), 'lab-comparison'));
        if (record.referenceLow !== null || record.referenceHigh !== null) article.append(textNode('p', 'Entered report limits: ' + (record.referenceLow === null ? 'not given' : record.referenceLow) + ' to ' + (record.referenceHigh === null ? 'not given' : record.referenceHigh) + ' ' + record.unit, 'lab-note'));
        if (record.sourceName) article.append(textNode('p', 'Report source: ' + record.sourceName, 'lab-note'));
        if (record.assay) article.append(textNode('p', 'Assay / method: ' + record.assay, 'lab-note'));
        if (record.context) article.append(textNode('p', record.context, 'lab-note'));
        const edit = textNode('button', 'Edit this entry', 'lab-edit'); edit.type = 'button';
        edit.addEventListener('click', () => {
          editingId = record.id; get('analyte').value = record.analyte; units();
          fields.forEach(key => { get(key).value = record[key] === null ? '' : record[key]; });
          document.getElementById('lab-save').textContent = 'Save changes'; document.getElementById('lab-cancel-edit').hidden = false;
          message('Editing the ' + record.collectedOn + ' ' + MARKERS[record.analyte].label + ' entry.'); get('value').focus();
        });
        article.append(edit); history.append(article);
      });
      return true;
    } catch (error) { history.textContent = 'Saved results could not be read. Existing records remain unchanged.'; document.getElementById('lab-export').disabled = true; message(error.message || 'Browser storage is unavailable.', true); return false; }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) { message('Complete the required result, unit and collection-date fields.', true); return; }
    try {
      const edited = !!editingId;
      saveRecord(root.localStorage, formInput(), editingId);
      resetForm(); if (renderHistory()) message(edited ? 'Changes saved on this browser.' : 'Lab result saved on this browser.');
    } catch (error) { message('Could not save: ' + (error.message || 'Browser storage is unavailable. Existing records are unchanged.'), true); }
  });
  document.getElementById('lab-cancel-edit').addEventListener('click', () => { resetForm(); message('Edit cancelled. Saved records are unchanged.'); });
  function download(text, filename, type) {
    const url = root.URL.createObjectURL(new root.Blob([text], { type }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
  }
  document.getElementById('lab-export').addEventListener('click', () => {
    try { const data = loadRecords(root.localStorage); download(JSON.stringify({ ...data, exportedAt: new Date().toISOString(), description: 'User-transcribed lab records. Report-limit comparisons are numeric only, not clinical interpretation.' }, null, 2), 'ovuluna-lab-records.json', 'application/json'); message('Lab-record download requested.'); }
    catch (error) { message('Could not export: ' + error.message, true); }
  });
  const legacyPanel = document.getElementById('lab-legacy');
  try {
    const legacyRaw = root.localStorage.getItem(LEGACY_KEY);
    if (legacyRaw !== null) {
      legacyPanel.hidden = false;
      // Preserve/display the prior snapshot verbatim; its date was a save timestamp.
      document.getElementById('lab-legacy-value').textContent = legacyRaw;
      document.getElementById('lab-legacy-export').addEventListener('click', () => {
        try { download(legacyRaw, 'ovuluna-legacy-lab-snapshot.txt', 'text/plain'); message('Earlier snapshot download requested.'); }
        catch (error) { message('Could not download the earlier snapshot: ' + error.message, true); }
      });
    }
  } catch (_) { legacyPanel.hidden = false; document.getElementById('lab-legacy-value').textContent = 'This browser could not read the earlier snapshot.'; document.getElementById('lab-legacy-export').disabled = true; }
  units(); renderHistory();
})(typeof window !== 'undefined' ? window : globalThis);
