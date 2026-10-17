/* Ovumind ovarian assessment contract. Clinical predictions require a validated model.
   Keep real observations and missingness; never turn these fields into age offsets. */
(function (g) {
  'use strict';
  var VERSION = 'ovarian-assessment-2.0.0';
  var KEY = 'ovuluna_ovarian_assessments_v2';
  var EVIDENCE_VERSION = '2026-09-11';
  var options = {
    cycle: ['regular', 'variable', 'skipped', 'post12', 'contraceptive', 'unsure'],
    context: ['none', 'pregnant', 'postpartum', 'hormonal', 'other', 'unsure'],
    smoke: ['never', 'former', 'current', 'unsure'],
    circ: ['low', 'some', 'chronic', 'unsure'],
    sleep: ['good', 'poor', 'unsure']
  };
  function isObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function blank(v) { return v === '' || v === null || v === undefined; }
  function number(v) {
    if (blank(v)) return null;
    if (typeof v !== 'number' && (typeof v !== 'string' || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v.trim()))) return NaN;
    return Number(v);
  }
  function localDay(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function validDay(value, today) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var d = new Date(value + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value && value <= today && value >= '1900-01-01';
  }
  function assess(raw, config) {
    var now = config && config.now instanceof Date ? config.now : new Date();
    var input = isObject(raw) ? raw : {};
    var errors = {};
    var missing = [];
    var normalized = { age: number(input.age), cycle: null, context: null, amh: null, momMeno: number(input.momMeno), smoke: null, circ: null, sleep: null };
    if (normalized.age === null) missing.push('age');
    else if (!Number.isInteger(normalized.age) || normalized.age < 13 || normalized.age > 100) errors.age = 'Enter your actual age as a whole number from 13 to 100.';
    if (normalized.momMeno !== null && (!Number.isInteger(normalized.momMeno) || normalized.momMeno < 13 || normalized.momMeno > 100)) errors.momMeno = 'Enter a whole age from 13 to 100, or leave this optional field blank.';
    Object.keys(options).forEach(function (key) {
      if (blank(input[key])) { if (key === 'cycle' || key === 'context') missing.push(key); return; }
      if (options[key].indexOf(input[key]) < 0) errors[key] = 'Choose an option from this list.';
      else normalized[key] = input[key];
    });
    if (!blank(input.amh)) {
      if (!isObject(input.amh)) errors.amh = 'Enter AMH with its unit and collection date.';
      else {
        var v = number(input.amh.value);
        if (v === null || !Number.isFinite(v) || v < 0) errors.amh = 'Enter a finite, non-negative AMH value exactly as reported.';
        if (['ng/mL', 'pmol/L'].indexOf(input.amh.unit) < 0) errors.amhUnit = 'Choose the unit shown on your lab report.';
        if (!validDay(input.amh.collectedOn, localDay(now))) errors.amhDate = 'Enter a valid collection date that is not in the future.';
        if (!errors.amh && !errors.amhUnit && !errors.amhDate) normalized.amh = { value: v, unit: input.amh.unit, collectedOn: input.amh.collectedOn };
      }
    }
    var status, reason;
    if (Object.keys(errors).length) { status = 'invalid-input'; reason = 'Correct the highlighted fields before saving.'; }
    else if (missing.length) { status = 'insufficient-data'; reason = 'Add your age, cycle pattern and current context to review this assessment.'; }
    else if (normalized.age < 18 || normalized.context !== 'none' || normalized.cycle === 'contraceptive') {
      status = 'unsupported-context'; reason = 'Your records can be saved, but this context cannot be used for an ovarian-age or menopause prediction.';
    } else {
      status = 'unavailable-model'; reason = 'A validated ovarian-age model is not available in this build. Your inputs do not establish an ovarian age or menopause date.';
    }
    return {
      modelVersion: VERSION, evidenceVersion: EVIDENCE_VERSION, status: status, reason: reason,
      input: normalized, errors: errors, missing: missing,
      prediction: { ovarianAge: null, menopauseInYears: null, confidenceInterval: null, reproductiveStage: null },
      evidenceIds: ['ovarian-age-concept'],
      questions: { answered: 3 - missing.length - ['age', 'cycle', 'context'].filter(function (key) { return !!errors[key]; }).length, total: 3 }
    };
  }
  function record(raw, config) {
    var now = config && config.now instanceof Date ? config.now : new Date();
    var result = assess(raw, { now: now });
    if (result.status === 'invalid-input' || result.status === 'insufficient-data') return { ok: false, result: result };
    return { ok: true, record: {
      id: g.crypto && typeof g.crypto.randomUUID === 'function' ? g.crypto.randomUUID() : 'assessment-' + now.getTime() + '-' + Math.random().toString(36).slice(2),
      recordedAt: now.toISOString(), source: 'self-reported', result: result
    } };
  }
  function read(storage) {
    var raw = storage.getItem(KEY);
    if (raw === null) return { version: 2, records: [] };
    var log = JSON.parse(raw);
    if (!isObject(log) || log.version !== 2 || !Array.isArray(log.records)) throw new Error('The saved assessment log could not be read. It has not been overwritten.');
    var ids = new Set();
    if (log.records.some(function (r) {
      if (!isObject(r) || typeof r.id !== 'string' || !r.id || ids.has(r.id) || r.source !== 'self-reported' ||
          typeof r.recordedAt !== 'string' || !Number.isFinite(Date.parse(r.recordedAt)) ||
          !isObject(r.result) || r.result.modelVersion !== VERSION || !isObject(r.result.input) || !isObject(r.result.prediction)) return true;
      ids.add(r.id);
      var current = assess(r.result.input, { now: new Date(r.recordedAt) });
      return ['unavailable-model', 'unsupported-context'].indexOf(current.status) < 0 || current.status !== r.result.status ||
        ['ovarianAge', 'menopauseInYears', 'confidenceInterval', 'reproductiveStage'].some(function (key) { return r.result.prediction[key] !== null; });
    })) throw new Error('The saved assessment log has an unsupported record. It has not been overwritten.');
    return log;
  }
  function save(storage, raw, config) {
    var made = record(raw, config);
    if (!made.ok) return made;
    var log = read(storage); // Do not silently overwrite malformed or newer storage.
    log.records.unshift(made.record);
    storage.setItem(KEY, JSON.stringify(log));
    return made;
  }
  g.OvarianModel = Object.freeze({ version: VERSION, storageKey: KEY, assess: assess, createRecord: record, read: read, save: save, localDay: localDay });
})(typeof window !== 'undefined' ? window : globalThis);
