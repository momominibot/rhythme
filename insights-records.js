/* Read-only summaries for Insights and Overview.
   Only explicit record contracts are read. No inferred ovarian age, generated
   biometric value, numeric health score or treatment recommendation is produced. */
(function () {
  'use strict';
  var KEYS = {
    labs: 'ovuluna_lab_records_v1',
    journal: 'ovuluna_wellness_journal_v1',
    assessments: 'ovuluna_ovarian_assessments_v2',
    observations: 'ovuluna_observations_v1',
    checkins: 'ovuluna_daily_checkins_v1'
  };
  var ANALYTES = { amh: 'AMH', fsh: 'FSH', lh: 'Luteinizing hormone (LH)', p4: 'Progesterone (P4)', e2: 'Estradiol (E2)', afc: 'Antral follicle count', vitd: 'Vitamin D' };
  var UNITS = { amh: ['ng/mL', 'pmol/L'], fsh: ['IU/L', 'mIU/mL'], lh: ['IU/L', 'mIU/mL'], p4: ['ng/mL', 'nmol/L'], e2: ['pg/mL', 'pmol/L'], afc: ['follicles'], vitd: ['ng/mL', 'nmol/L'] };
  var QUALIFIERS = ['=', '<', '>', '≤', '≥'];

  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function localDate() {
    var now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }
  function dateOnly(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var parsed = new Date(value + 'T12:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value <= localDate();
  }
  function labRecord(record) {
    return object(record) && typeof record.id === 'string' && record.id.length > 0 &&
      Object.prototype.hasOwnProperty.call(ANALYTES, record.analyte) &&
      typeof record.value === 'number' && Number.isFinite(record.value) && record.value >= 0 &&
      UNITS[record.analyte].indexOf(record.unit) !== -1 && QUALIFIERS.indexOf(record.qualifier) !== -1 &&
      dateOnly(record.collectedOn) && typeof record.context === 'string' &&
      (record.analyte !== 'afc' || Number.isInteger(record.value));
  }
  function journalRecord(record) {
    return object(record) && dateOnly(record.date) && typeof record.notes === 'string' &&
      ['Low', 'Mixed', 'Steady', 'Good'].indexOf(record.mood) !== -1 &&
      ['Low', 'Some', 'Steady', 'High'].indexOf(record.energy) !== -1 &&
      ['Uncomfortable', 'Some discomfort', 'Comfortable'].indexOf(record.comfort) !== -1;
  }
  function assessmentRecord(record) {
    if (!object(record) || typeof record.id !== 'string' || !record.id || record.source !== 'self-reported' ||
        typeof record.recordedAt !== 'string' || !Number.isFinite(Date.parse(record.recordedAt)) ||
        !object(record.result) || record.result.modelVersion !== 'ovarian-assessment-2.0.0' ||
        ['unavailable-model', 'unsupported-context'].indexOf(record.result.status) === -1 ||
        !object(record.result.input) || !object(record.result.prediction)) return false;
    return ['ovarianAge', 'menopauseInYears', 'confidenceInterval', 'reproductiveStage'].every(function (key) {
      return record.result.prediction[key] === null;
    });
  }
  // Never repair, overwrite, migrate or erase data while reading a summary.
  function read(kind, validate, version) {
    try {
      var raw = localStorage.getItem(KEYS[kind]);
      if (raw === null) return { records: [], unreadable: false, omitted: 0 };
      var parsed = JSON.parse(raw);
      if (version !== undefined && (!object(parsed) || parsed.version !== version)) throw new Error('Unsupported record format');
      var records = version === undefined ? parsed : parsed.records;
      if (!Array.isArray(records)) throw new Error('Missing records array');
      var accepted = records.filter(validate);
      return { records: accepted, unreadable: false, omitted: records.length - accepted.length };
    } catch (_) {
      return { records: [], unreadable: true, omitted: 0 };
    }
  }
  // Reuse each record writer's strict reader. Summaries must never silently accept
  // a malformed entry that its own record page cannot open or edit.
  function contract(api) {
    try {
      if (!api || typeof api.read !== 'function') throw new Error('Record reader unavailable');
      return { records: api.read(localStorage).records, unreadable: false, omitted: 0 };
    } catch (_) { return { records: [], unreadable: true, omitted: 0 }; }
  }
  function set(key, value) {
    document.querySelectorAll('[data-summary="' + key + '"]').forEach(function (node) { node.textContent = value; });
  }
  function node(tag, className, text) {
    var element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }
  function note(container, text) { container.appendChild(node('p', 'record-copy', text)); }
  function collection(kind, state, emptyText, createRecord) {
    document.querySelectorAll('[data-records="' + kind + '"]').forEach(function (container) {
      container.replaceChildren();
      if (state.unreadable) {
        note(container, 'Saved records could not be read on this browser. Existing data has not been changed.');
        return;
      }
      if (state.omitted) note(container, state.omitted + ' saved ' + (state.omitted === 1 ? 'entry could' : 'entries could') + ' not be displayed because the record format is incomplete or unsupported. Existing data has not been changed.');
      if (!state.records.length) note(container, state.omitted ? 'No readable records are available to summarize.' : emptyText);
      state.records.slice(0, 3).forEach(function (record) { container.appendChild(createRecord(record)); });
      if (state.records.length > 3) note(container, 'Showing the latest 3 of ' + state.records.length + ' saved entries. Open the record page for the full history.');
    });
  }
  function counts(prefix, state, label, date) {
    set(prefix + '-count', state.unreadable ? 'Unavailable' : (state.omitted && !state.records.length ? 'Unavailable' : String(state.records.length)));
    var detail = state.unreadable ? 'Saved data could not be read.' :
      state.records.length ? label + date : state.omitted ? 'No readable records.' : 'No saved records yet.';
    if (state.omitted && state.records.length) detail += ' Some saved entries could not be displayed.';
    set(prefix + '-date', detail);
  }
  function labItem(record) {
    var item = node('article', 'record-item', '');
    var prefix = record.qualifier === '=' ? '' : record.qualifier + ' ';
    item.appendChild(node('h3', '', ANALYTES[record.analyte] + ' · ' + prefix + record.value + ' ' + record.unit));
    item.appendChild(node('p', 'record-meta', 'Collected ' + record.collectedOn + ' · Entered by you'));
    if (record.context.trim()) item.appendChild(node('p', 'record-note', 'Your context: ' + record.context));
    return item;
  }
  function journalItem(record) {
    var item = node('article', 'record-item', '');
    item.appendChild(node('h3', '', record.date));
    item.appendChild(node('p', '', 'Mood: ' + record.mood + ' · Energy: ' + record.energy + ' · Body: ' + record.comfort));
    if (record.notes) item.appendChild(node('p', 'record-note', record.notes));
    return item;
  }
  function observationItem(record) {
    var definition = window.OvumindObservations.FIELDS[record.kind];
    var item = node('article', 'record-item', '');
    item.appendChild(node('h3', '', definition.title + ' · ' + record.observedOn));
    item.appendChild(node('p', 'record-meta', (record.observedTime ? 'Observed at ' + record.observedTime + ' · ' : '') + (record.sourceType === 'self-observed' ? 'Self-observed' : 'Entered by you; not independently verified')));
    if (record.missingReason) item.appendChild(node('p', '', 'Reading status: ' + record.missingReason));
    var details = definition.fields.filter(function (field) { return (!field.showWhen || record.values[field.showWhen.key] === field.showWhen.equals) && record.values[field.key] !== null; });
    if (details.length) item.appendChild(node('p', '', details.map(function (field) { return field.label + ': ' + record.values[field.key]; }).join(' · ')));
    if (record.contextFlags.length) item.appendChild(node('p', 'record-note', 'Entered context: ' + record.contextFlags.join('; ')));
    if (record.notes) item.appendChild(node('p', 'record-note', record.notes));
    return item;
  }
  function checkinItem(record) {
    var definition = window.OvumindCheckins.FIELDS[record.category];
    var item = node('article', 'record-item', '');
    item.appendChild(node('h3', '', definition.title + ' · ' + record.observedOn));
    item.appendChild(node('p', 'record-meta', 'Self-reported Home check-in'));
    item.appendChild(node('p', 'record-note', definition.fields.filter(function (field) { return record.values[field.key] !== null; }).map(function (field) { return field.label + ': ' + record.values[field.key]; }).join(' · ')));
    return item;
  }
  function render() {
    var labs = read('labs', labRecord, 1);
    var journal = read('journal', journalRecord);
    var assessments = read('assessments', assessmentRecord, 2);
    var observations = contract(window.OvumindObservations);
    var checkins = contract(window.OvumindCheckins);
    labs.records.sort(function (a, b) { return b.collectedOn.localeCompare(a.collectedOn); });
    journal.records.sort(function (a, b) { return b.date.localeCompare(a.date); });
    assessments.records.sort(function (a, b) { return Date.parse(b.recordedAt) - Date.parse(a.recordedAt); });
    observations.records.sort(function (a, b) { return b.observedOn.localeCompare(a.observedOn) || (b.observedTime || '').localeCompare(a.observedTime || '') || b.updatedAt.localeCompare(a.updatedAt); });
    checkins.records.sort(function (a, b) { return b.observedOn.localeCompare(a.observedOn) || b.recordedAt.localeCompare(a.recordedAt); });
    counts('lab', labs, 'Latest collection: ', labs.records.length ? labs.records[0].collectedOn : '');
    counts('journal', journal, 'Latest entry: ', journal.records.length ? journal.records[0].date : '');
    counts('assessment', assessments, 'Latest saved: ', assessments.records.length ? new Date(assessments.records[0].recordedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
    counts('observation', observations, 'Latest observation: ', observations.records.length ? observations.records[0].observedOn : '');
    counts('checkin', checkins, 'Latest Home check-in: ', checkins.records.length ? checkins.records[0].observedOn : '');
    set('today', new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    var todayEntry = journal.records.find(function (record) { return record.date === localDate(); });
    set('today-journal', journal.unreadable ? 'Today’s saved entry could not be checked. Your existing data has not been changed.' :
      todayEntry ? 'Your saved check-in: mood ' + todayEntry.mood.toLowerCase() + ', energy ' + todayEntry.energy.toLowerCase() + ', body ' + todayEntry.comfort.toLowerCase() + '.' :
      journal.omitted ? 'No readable check-in for today. Some saved journal entries could not be displayed; open your journal to review them.' :
      'No check-in saved for today. Add a few words about your mood, energy and comfort.');
    collection('labs', labs, 'No lab records saved yet. Add a value, its unit and the date from your lab report.', labItem);
    collection('journal', journal, 'No journal entries saved yet. Your first check-in will appear here.', journalItem);
    collection('observations', observations, 'No cycle observations saved yet. Keep bleeding, temperature, mucus, test and treatment details with their date and context.', observationItem);
    collection('checkins', checkins, 'No Home check-ins saved yet. Mood, sleep, symptoms, water, activity and food records will appear here when you enter them.', checkinItem);
  }
  render();
  // Refresh after back navigation and edits from another tab, without storing new data.
  window.addEventListener('pageshow', render);
  window.addEventListener('storage', function (event) {
    if (event.key === null || Object.keys(KEYS).some(function (kind) { return KEYS[kind] === event.key; })) render();
  });
})();
