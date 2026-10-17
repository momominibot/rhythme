/* Optional, user-entered observations. No inferred ovulation, scores or unit conversion.
 * Snapshot checks detect changed storage, not an atomic lock or an intervening change
 * that returns to identical bytes. The UI must invalidate drafts on storage events.
 * Keep this store in the application's reviewed export and deletion inventory.
 */
(function (root) {
  'use strict';
  const KEY = 'ovuluna_observations_v1';
  const VERSION = 1;
  const CONTEXT_FLAGS = ['Disrupted sleep', 'Fever or illness', 'Different measurement time', 'Vaginal products or douching', 'Recent intercourse', 'Bleeding during observation', 'Symptoms affecting observation', 'Hormonal contraception', 'Fertility treatment', 'Pregnant', 'Postpartum', 'Breastfeeding', 'Perimenopause (self-reported)', 'Postmenopause (self-reported)', 'Prefer not to say'];
  const MISSING_REASONS = ['Not observed', 'Missed measurement', 'Unable to interpret', 'Invalid test', 'Prefer not to say'];
  const yesNo = ['Yes', 'No', 'Unsure'];
  const field = (key, label, type, extra) => ({ key, label, type, ...extra });
  const when = equals => ({ key: 'format', equals });
  const FIELDS = {
    bleeding: {
      title: 'Bleeding', sourceType: 'self-observed',
      hint: 'Record what you observed. Spotting and the first day of full flow are separate observations.',
      fields: [
        field('amount', 'Observed bleeding', 'select', { required: true, options: ['None observed', 'Spotting', 'Light flow', 'Moderate flow', 'Heavy flow', 'Unsure'] }),
        field('firstFullFlow', 'Was this the first full-flow day?', 'select', { options: yesNo }),
        field('firstFullFlowOn', 'Actual first full-flow date, if known', 'date')
      ]
    },
    bbt: {
      title: 'Waking temperature (BBT)', sourceType: 'user-transcribed',
      hint: 'Copy the original thermometer reading and unit. Record wrist or wearable temperature separately under Device or app.',
      fields: [
        field('value', 'Original thermometer reading', 'number', { required: true, min: 20, max: 122, step: 'any' }),
        field('unit', 'Original temperature unit', 'select', { required: true, options: ['°C', '°F'] }),
        field('site', 'Measurement site', 'select', { required: true, options: ['Oral', 'Vaginal', 'Rectal', 'Axillary', 'Other', 'Unsure'] }),
        field('thermometer', 'Thermometer brand / model', 'text', { required: true }),
        field('beforeActivity', 'Taken after waking, before activity, food or drink?', 'select', { required: true, options: yesNo })
      ]
    },
    mucus: {
      title: 'Mucus observation', sourceType: 'self-observed',
      hint: 'Appearance and sensation are separate. Choose unsure when you cannot tell; observations do not identify a diagnosis or confirm ovulation.',
      fields: [
        field('appearance', 'Appearance', 'select', { required: true, options: ['Dry / none seen', 'Sticky', 'Creamy', 'Watery', 'Clear / slippery', 'Other', 'Unsure'] }),
        field('sensation', 'Sensation', 'select', { required: true, options: ['Dry', 'Damp', 'Wet', 'Slippery', 'Other', 'Unsure'] }),
        field('method', 'Observation method', 'select', { required: true, options: ['At vulva / sensation', 'Toilet tissue', 'Underwear', 'Other', 'Unsure'] }),
        field('stretch', 'Stretch observation', 'select', { options: ['Not checked', 'No stretch noticed', 'Stretch noticed', 'Unsure'] })
      ]
    },
    urine: {
      title: 'Urine test', sourceType: 'user-transcribed',
      hint: 'Use your kit’s instructions. Copy its exact output; an app line ratio is not a laboratory concentration. LH and urinary PdG remain separate tests.',
      fields: [
        field('analyte', 'Analyte named on the urine test', 'select', { required: true, options: ['LH', 'PdG'] }),
        field('brand', 'Test brand', 'text', { required: true }),
        field('model', 'Test model / product name', 'text', { required: true }),
        field('format', 'Original result format', 'select', { required: true, options: ['Qualitative', 'Numeric concentration', 'App line ratio'] }),
        field('result', 'Exact qualitative output (including uncertain or invalid)', 'text', { required: true, showWhen: when('Qualitative') }),
        field('qualifier', 'Result symbol printed before the concentration', 'select', { required: true, options: ['=', '<', '>', '≤', '≥'], showWhen: when('Numeric concentration') }),
        field('numericValue', 'Original numeric concentration', 'number', { required: true, min: 0, step: 'any', showWhen: when('Numeric concentration') }),
        field('unit', 'Original concentration unit', 'select', { required: true, options: ['mIU/mL', 'IU/L', 'ng/mL', 'µg/mL', 'nmol/L', 'µmol/L'], showWhen: when('Numeric concentration') }),
        field('ratio', 'Original app line ratio', 'number', { required: true, min: 0, step: 'any', showWhen: when('App line ratio') }),
        field('readerApp', 'Strip-reading app', 'text', { required: true, showWhen: when('App line ratio') }),
        field('readerVersion', 'Strip-reading app version', 'text', { showWhen: when('App line ratio') }),
        field('collectedTime', 'Sample collection time, if known', 'time'),
        field('testedTime', 'Test time, if known', 'time'),
        field('readTime', 'Result read time, if known', 'time'),
        field('instructionsFollowed', 'Were this kit’s instructions followed?', 'select', { options: yesNo })
      ]
    },
    treatment: {
      title: 'Treatment context', sourceType: 'user-transcribed',
      hint: 'Record actual treatment and dates, or leave context undisclosed. A clinician plan entered here is your note, not a verified instruction or a treatment recommendation.',
      fields: [
        field('type', 'Treatment type', 'select', { required: true, options: ['Medicine', 'Hormonal contraception', 'Fertility treatment', 'Procedure', 'Other', 'Prefer not to say'] }),
        field('name', 'Medicine / treatment name as entered', 'text'),
        field('dose', 'Dose or administration as written, if known', 'text'),
        field('startedOn', 'Actual start / administration date', 'date'),
        field('stoppedOn', 'Actual stop date, if known', 'date'),
        field('clinicianPlan', 'Your note of the clinician’s plan', 'text', { maxLength: 1000, multiline: true })
      ]
    },
    device: {
      title: 'Device or app', sourceType: 'user-transcribed',
      hint: 'Manually copy the source’s original output. This is not a connected import. Wrist temperature, waking temperature and outside app estimates are different measurements.',
      fields: [
        field('manufacturer', 'Device manufacturer', 'text', { required: true }),
        field('model', 'Device model', 'text', { required: true }),
        field('sourceApp', 'Source app', 'text'),
        field('appVersion', 'Source app version', 'text'),
        field('measurementType', 'Type of output', 'select', { required: true, options: ['Wrist temperature', 'Skin temperature', 'Temperature change from baseline', 'Heart rate', 'Heart rate variability', 'External cycle estimate', 'Other'] }),
        field('outputType', 'Raw or derived output, as identified by the source', 'select', { required: true, options: ['Raw reading', 'Derived estimate', 'Unknown'] }),
        field('originalOutput', 'Exact original output', 'text', { required: true }),
        field('unit', 'Original unit, if shown', 'text'),
        field('sourceRecordId', 'Original source record identifier, if shown', 'text')
      ]
    }
  };
  // An absent day retains method/context metadata, but cannot contain a result as well.
  const RESULTS = {
    bleeding: ['amount', 'firstFullFlow', 'firstFullFlowOn'], bbt: ['value'],
    mucus: ['appearance', 'sensation', 'stretch'], urine: ['result', 'qualifier', 'numericValue', 'ratio'],
    treatment: ['name', 'dose', 'startedOn', 'stoppedOn', 'clinicianPlan'], device: ['originalOutput']
  };
  Object.entries(FIELDS).forEach(([kind, definition]) => {
    definition.fields.forEach(item => { item.measurement = RESULTS[kind].includes(item.key); });
  });
  const INPUT_KEYS = ['id', 'kind', 'observedOn', 'observedTime', 'utcOffsetMinutes', 'missingReason', 'contextFlags', 'notes', 'values', 'sourceType'];
  const STORED_KEYS = INPUT_KEYS.concat(['schemaVersion', 'createdAt', 'recordedAt', 'updatedAt']);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function fail(message) { throw new Error(message); }
  function day(date = new Date()) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) fail('A valid current date is required.');
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }
  function calendar(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === '0000') return false;
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function empty(value) { return value === undefined || value === null || value === ''; }
  function text(value, label, limit = 160) {
    if (empty(value)) return null;
    if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) fail(label + ' is too long or unreadable.');
    return value.trim() || null;
  }
  function numeric(value, label) {
    if (empty(value)) return null;
    if (typeof value !== 'number' && typeof value !== 'string') fail(label + ' must be a finite number.');
    const input = typeof value === 'string' ? value.trim() : String(value);
    // Reject partial parsing, locale ambiguity, hexadecimal and a blank string becoming zero.
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input) || !Number.isFinite(Number(input))) fail(label + ' must be a finite decimal number.');
    return Number(input);
  }
  function selected(value, options, label) {
    if (empty(value)) return null;
    if (typeof value !== 'string' || !options.includes(value)) fail('Choose a listed value for ' + label + '.');
    return value;
  }
  function clock(value, label) {
    if (empty(value)) return null;
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail(label + ' must use a real 24-hour time (HH:MM).');
    return value;
  }
  function dateValue(value, label, today) {
    if (empty(value)) return null;
    if (!calendar(value) || value > today) fail(label + ' must be an actual calendar date, on or before today.');
    return value;
  }
  function keys(value, allowed, label) {
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(label + ' contains unsupported fields.');
  }
  function validate(input, now = new Date()) {
    const today = day(now);
    keys(input, INPUT_KEYS, 'Observation');
    if (typeof input.kind !== 'string' || !own(FIELDS, input.kind)) fail('Choose an observation type.');
    const definition = FIELDS[input.kind];
    if (own(input, 'sourceType') && input.sourceType !== definition.sourceType) fail('This log only accepts user-entered observations, not verified clinician records or connected imports.');
    if (own(input, 'id') && (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.id))) fail('The entry identifier is unreadable.');
    const observedOn = dateValue(input.observedOn, 'Observation date', today);
    if (!observedOn) fail('Enter the actual observation date.');
    const observedTime = clock(input.observedTime, 'Observation time');
    const utcOffsetMinutes = numeric(input.utcOffsetMinutes, 'Original time-zone offset');
    if (utcOffsetMinutes !== null && (!Number.isInteger(utcOffsetMinutes) || Math.abs(utcOffsetMinutes) > 840)) fail('The original time-zone offset must be whole minutes between -840 and 840.');
    const missingReason = selected(input.missingReason, MISSING_REASONS, 'missing reason');
    if (missingReason === 'Invalid test' && input.kind !== 'urine') fail('Invalid test applies to a urine-test entry.');
    const flags = input.contextFlags === undefined ? [] : input.contextFlags;
    if (!Array.isArray(flags) || flags.some(flag => typeof flag !== 'string' || !CONTEXT_FLAGS.includes(flag)) || new Set(flags).size !== flags.length) fail('Choose each listed context flag at most once.');
    if (flags.includes('Prefer not to say') && flags.length > 1) fail('Use Prefer not to say on its own, or select the context you wish to share.');
    const rawValues = input.values === undefined ? {} : input.values;
    keys(rawValues, definition.fields.map(item => item.key), 'Observation details');
    const values = {};
    for (const item of definition.fields) {
      const raw = rawValues[item.key];
      let value;
      if (item.type === 'number') value = numeric(raw, item.label);
      else if (item.type === 'date') value = dateValue(raw, item.label, today);
      else if (item.type === 'time') value = clock(raw, item.label);
      else if (item.type === 'select') value = selected(raw, item.options, item.label);
      else {
        value = text(raw, item.label, item.maxLength || 160);
        if (value !== null && !item.multiline && /[\r\n]/.test(raw)) fail(item.label + ' must be a single line.');
      }
      const shown = !item.showWhen || rawValues[item.showWhen.key] === item.showWhen.equals;
      if (!shown && value !== null) fail(item.label + ' does not match the selected result format. Clear it before saving.');
      if (shown && item.required && !missingReason && value === null) fail('Enter ' + item.label + '.');
      if (value !== null && item.type === 'number' && ((item.min !== undefined && value < item.min) || (item.max !== undefined && value > item.max))) fail(item.label + ' is outside the supported entry range. Check the original value and unit.');
      values[item.key] = value;
    }
    if (missingReason && RESULTS[input.kind].some(key => values[key] !== null)) fail('A missing observation cannot also contain a result. Clear the result or the missing reason.');
    if (input.kind === 'bbt' && values.value !== null) {
      const [low, high] = values.unit === '°C' ? [20, 50] : [68, 122];
      if (values.value < low || values.value > high) fail('Check the original temperature and unit (supported entry range: 20–50 °C or 68–122 °F).');
    }
    if (input.kind === 'bleeding') {
      if (values.firstFullFlow === 'Yes' && !['Light flow', 'Moderate flow', 'Heavy flow'].includes(values.amount)) fail('A first full-flow day needs a full-flow observation rather than spotting, none or unsure.');
      if (values.firstFullFlowOn && values.firstFullFlowOn > observedOn) fail('The first full-flow date cannot follow this observation.');
      if (values.firstFullFlow === 'Yes' && values.firstFullFlowOn && values.firstFullFlowOn !== observedOn) fail('The first full-flow date must match this observation when you select Yes.');
      if (values.firstFullFlow === 'No' && values.firstFullFlowOn === observedOn) fail('The same date cannot also be marked as not the first full-flow day.');
    }
    if (input.kind === 'urine' && values.unit) {
      const units = values.analyte === 'LH' ? ['mIU/mL', 'IU/L'] : ['ng/mL', 'µg/mL', 'nmol/L', 'µmol/L'];
      if (!values.analyte || !units.includes(values.unit)) fail('The concentration unit does not match the selected urine analyte. Copy the original unit; no conversion is performed.');
    }
    if (input.kind === 'treatment') {
      if (!missingReason && values.type !== 'Prefer not to say' && !values.name) fail('Enter the medicine or treatment name as written.');
      if (values.type === 'Prefer not to say' && RESULTS.treatment.some(key => values[key] !== null)) fail('Leave treatment details empty when choosing Prefer not to say.');
      if (values.startedOn && values.stoppedOn && values.stoppedOn < values.startedOn) fail('The stop date cannot be before the start date.');
      if ([values.startedOn, values.stoppedOn].some(date => date && date > observedOn)) fail('Treatment dates must be on or before this observation date. Record actual events rather than future plans.');
    }
    if (input.kind === 'device') {
      if (values.appVersion && !values.sourceApp) fail('Enter the source app alongside its version.');
      if (['External cycle estimate', 'Temperature change from baseline'].includes(values.measurementType) && values.outputType === 'Raw reading') fail('A cycle estimate or change from baseline is derived output, not a raw reading.');
    }
    return {
      kind: input.kind, sourceType: definition.sourceType, observedOn, observedTime, utcOffsetMinutes,
      missingReason, contextFlags: flags.slice(), notes: text(input.notes, 'Notes', 2000) || '', values
    };
  }
  function timestamp(value) {
    if (typeof value !== 'string') return false;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
  }
  function validRecord(record) {
    keys(record, STORED_KEYS, 'Saved observation');
    if (record.schemaVersion !== VERSION || typeof record.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(record.id) || !timestamp(record.createdAt) || !timestamp(record.recordedAt) || !timestamp(record.updatedAt) || record.createdAt !== record.recordedAt || record.updatedAt < record.createdAt) fail('The saved observation has unsupported metadata.');
    const input = {};
    for (const key of INPUT_KEYS) if (own(record, key)) input[key] = record[key];
    // Existing dates stay readable even after travel or a clock correction. New entries
    // still use today's local date. There is no write, repair or silent normalization.
    const latestDate = [record.observedOn, ...Object.values(record.values || {}).filter(value => calendar(value))].sort().pop();
    const validationNow = new Date(Math.max(Date.now(), Date.parse(latestDate + 'T23:59:00Z')));
    const normalized = validate(input, validationNow);
    for (const key of Object.keys(normalized)) {
      if (!own(record, key)) fail('The saved observation is incomplete.');
      if (key === 'values') {
        if (Object.keys(record.values).length !== Object.keys(normalized.values).length || Object.keys(normalized.values).some(name => record.values[name] !== normalized.values[name])) fail('The saved observation contains unreadable details.');
      } else if (key === 'contextFlags') {
        if (JSON.stringify(record[key]) !== JSON.stringify(normalized[key])) fail('The saved observation contains unreadable context.');
      } else if (record[key] !== normalized[key]) fail('The saved observation contains unreadable values.');
    }
    return record;
  }
  function snapshot(storage) {
    const raw = storage.getItem(KEY);
    if (raw !== null && typeof raw !== 'string') fail('Browser storage returned an unreadable observation log.');
    return raw;
  }
  function decode(raw) {
    if (raw === null) return { version: VERSION, records: [] };
    let data;
    try { data = JSON.parse(raw); } catch (_) { fail('The observation log is unreadable. It has not been changed. Export it from Settings before recovery.'); }
    keys(data, ['version', 'records'], 'Observation log');
    if (data.version !== VERSION || !Array.isArray(data.records)) fail('This observation log uses an unsupported version. It has not been changed.');
    data.records.forEach(validRecord);
    if (new Set(data.records.map(record => record.id)).size !== data.records.length) fail('The observation log contains duplicate identifiers. It has not been changed.');
    return data;
  }
  function read(storage) { return decode(snapshot(storage)); }
  function assertSnapshot(storage, expectedSnapshot) {
    if (expectedSnapshot !== null && typeof expectedSnapshot !== 'string') fail('Reload this form before saving: its original snapshot is missing.');
    const current = snapshot(storage);
    if (current !== expectedSnapshot) fail('The observation log changed in another page or was deleted. Reload the saved records before continuing.');
    return current;
  }
  function save(storage, input, expectedSnapshot, now = new Date()) {
    const payload = validate(input, now);
    const data = decode(assertSnapshot(storage, expectedSnapshot));
    const index = own(input, 'id') ? data.records.findIndex(record => record.id === input.id) : -1;
    if (own(input, 'id') && index < 0) fail('This observation was removed. It cannot be recreated by a stale edit.');
    const previous = index < 0 ? null : data.records[index];
    const stamp = now.toISOString();
    if (previous && stamp < previous.updatedAt) fail('The device clock is earlier than this entry. Correct it before editing.');
    const id = previous ? previous.id : (root.crypto && typeof root.crypto.randomUUID === 'function' ? root.crypto.randomUUID() : 'obs-' + now.getTime() + '-' + Math.random().toString(36).slice(2));
    if (!previous && data.records.some(record => record.id === id)) fail('Could not create a unique observation identifier. Please try again.');
    const record = { id, schemaVersion: VERSION, ...payload, createdAt: previous ? previous.createdAt : stamp, recordedAt: previous ? previous.recordedAt : stamp, updatedAt: stamp };
    if (index < 0) data.records.push(record); else data.records[index] = record;
    // Recheck immediately before writing. localStorage offers no atomic compare-and-swap;
    // two tabs writing at exactly the same instant remain a documented limitation.
    assertSnapshot(storage, expectedSnapshot);
    storage.setItem(KEY, JSON.stringify(data));
    return record;
  }
  function remove(storage, id, expectedSnapshot) {
    const data = decode(assertSnapshot(storage, expectedSnapshot));
    const index = data.records.findIndex(record => record.id === id);
    if (typeof id !== 'string' || index < 0) fail('This observation is no longer available. Reload the saved records.');
    const removed = data.records.splice(index, 1)[0];
    assertSnapshot(storage, expectedSnapshot);
    storage.setItem(KEY, JSON.stringify(data));
    return removed;
  }
  const api = { KEY, VERSION, FIELDS, CONTEXT_FLAGS, MISSING_REASONS, day, validate, read, snapshot, save, remove };
  root.OvumindObservations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
