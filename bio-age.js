/* Ovuluna · Clinical PhenoAge research reference.
 * Explicit lab units are required. Nothing is inferred from wearable, cycle or habit data.
 * This is the clinical (blood-marker) model, NOT DNAm PhenoAge or an ovarian-age model.
 * Primary source: Levine et al., Aging (2018), doi:10.18632/aging.101414,
 * Supplement 1, pp. 1–2 and Table S1. Published rounded coefficients are used
 * deliberately; the result is labeled an approximation, not a validated app assessment.
 */
(function () {
  'use strict';

  const MODEL_VERSION = 'levine-2018-published-coefficients-v1';
  const STORAGE_KEY = 'ovuluna_phenoage_records_v1';
  const SOURCE = 'https://www.aging-us.com/article/101414/text';
  const NOTE = 'Approximation using the published, rounded clinical PhenoAge coefficients. It is not ovarian age, a diagnosis, or a validated Ovuluna health assessment.';
  const WELLNESS_DISCLAIMER = 'No validated habit-to-age or composite wellness scoring rule is available. Self-reports remain observations, not measured health outcomes.';

  const PHENO_COEFFS = Object.freeze({
    intercept: -19.9067, age: 0.0804, albumin: -0.0336,
    creatinine: 0.0095, glucose: 0.1953, crp_log: 0.0954,
    lymphocyte_pct: -0.0120, mcv: 0.0268, rdw: 0.3306,
    alkaline_phosphatase: 0.0019, wbc: 0.0554
  });
  const PHENO_CONSTANTS = Object.freeze({ gamma: 0.0076927, months: 120, a: 141.50225, b: 0.00553, c: 0.090165 });

  // These are software entry guards, not clinical reference intervals or validation ranges.
  // Glucose conversion follows the Society for Biomedical Diabetes Research unit table;
  // creatinine conversion follows NIDDK's adult eGFR unit conversion (×88.4).
  const FIELDS = Object.freeze([
    { key: 'albumin', label: 'Albumin', units: { 'g/L': 1, 'g/dL': 10 }, min: 20, max: 60 },
    { key: 'creatinine', label: 'Creatinine', units: { 'µmol/L': 1, 'mg/dL': 88.4 }, min: 20, max: 400 },
    { key: 'glucose', label: 'Serum glucose', units: { 'mmol/L': 1, 'mg/dL': 1 / 18.0182 }, min: 2, max: 30 },
    { key: 'crp', label: 'C-reactive protein (CRP)', units: { 'mg/dL': 1, 'mg/L': 0.1 }, min: 0, max: 50 },
    { key: 'lymphocyte_pct', label: 'Lymphocytes', units: { '%': 1 }, min: 5, max: 70 },
    { key: 'mcv', label: 'Mean cell volume (MCV)', units: { 'fL': 1 }, min: 60, max: 120 },
    { key: 'rdw', label: 'Red cell distribution width (RDW-CV)', units: { '%': 1 }, min: 10, max: 25 },
    { key: 'alkaline_phosphatase', label: 'Alkaline phosphatase (ALP)', units: { 'U/L': 1 }, min: 20, max: 500 },
    { key: 'wbc', label: 'White blood cell count (WBC)', units: { '10³/µL': 1, '10⁹/L': 1 }, min: 2, max: 30 }
  ].map(function (field) { Object.freeze(field.units); return Object.freeze(field); }));
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  /** Input contract: { albumin: {value: 42, unit: 'g/L'}, ...all nine markers }. */
  function convertToPhenoUnits(biomarkers) {
    const values = {};
    const missing = [];
    const invalid = [];
    FIELDS.forEach(function (field) {
      const entry = isObject(biomarkers) && owns(biomarkers, field.key) ? biomarkers[field.key] : undefined;
      if (entry === undefined || entry === null || (isObject(entry) && (entry.value === null || entry.value === undefined || entry.value === ''))) {
        missing.push(field.key);
        return;
      }
      if (!isObject(entry) || typeof entry.value !== 'number' || !Number.isFinite(entry.value) || typeof entry.unit !== 'string' || !owns(field.units, entry.unit)) {
        invalid.push(field.key);
        return;
      }
      const converted = entry.value * field.units[entry.unit];
      if (!Number.isFinite(converted) || converted <= 0 || converted < field.min || converted > field.max) {
        invalid.push(field.key);
        return;
      }
      values[field.key] = converted;
    });
    return { values, missing, invalid };
  }

  function validateBiomarkers(biomarkers) {
    const result = convertToPhenoUnits(biomarkers);
    return Object.assign(result, { valid: result.missing.length === 0 && result.invalid.length === 0 });
  }

  function calculatePhenoAge(biomarkers, chronologicalAge) {
    if (typeof chronologicalAge !== 'number' || !Number.isFinite(chronologicalAge) || chronologicalAge < 20 || chronologicalAge > 100) {
      return { error: 'Enter age at the blood draw between 20 and 100 years. This is the supported age range of this calculator.' };
    }
    const validation = validateBiomarkers(biomarkers);
    if (!validation.valid) {
      return { error: 'All nine numeric lab results and their supported units are required. Check the entry limits below.', missing: validation.missing, invalid: validation.invalid };
    }
    const b = validation.values;
    const c = PHENO_COEFFS;
    // CRP is strictly positive and converted to mg/dL before its natural logarithm.
    // Values below a lab's detection limit must not be substituted or silently clamped.
    const xb = c.intercept + c.age * chronologicalAge + c.albumin * b.albumin +
      c.creatinine * b.creatinine + c.glucose * b.glucose + c.crp_log * Math.log(b.crp) +
      c.lymphocyte_pct * b.lymphocyte_pct + c.mcv * b.mcv + c.rdw * b.rdw +
      c.alkaline_phosphatase * b.alkaline_phosphatase + c.wbc * b.wbc;
    const k = PHENO_CONSTANTS;
    // Original: H = exp(xb) * expm1(120γ)/γ; M = 1-exp(-H).
    // Since -log(1-M) = H, evaluate log(H) directly. This avoids cancellation
    // when M rounds to 1 and never exponentiates the potentially large xb.
    const logH = xb + Math.log(Math.expm1(k.months * k.gamma)) - Math.log(k.gamma);
    const phenoAge = k.a + (Math.log(k.b) + logH) / k.c;
    if (!Number.isFinite(phenoAge)) return { error: 'The calculation could not produce a finite result. Check the panel values.' };
    return {
      phenoAge, chronologicalAge, normalizedBiomarkers: b,
      displayable: phenoAge >= 0 && phenoAge <= 120,
      displayStatus: phenoAge >= 0 && phenoAge <= 120 ? 'research-approximation' : 'unsupported-outlier',
      modelVersion: MODEL_VERSION, source: SOURCE, isResearchModel: true,
      isApproximation: true, note: NOTE
    };
  }

  // Retain the public API while retiring unsupported absolute-HRV bands and invented weights.
  // Missing, false and zero are distinct. Observed values remain available to the caller.
  function calculateWellnessScore(lifestyle) {
    const observations = {};
    const numeric = ['sleepHours', 'sleepQuality', 'exerciseMinPerWeek', 'nutritionQuality', 'hrvRmssd', 'dailyBreathworkMin', 'waterGlassesPerDay', 'alcoholPerWeek'];
    if (isObject(lifestyle)) {
      numeric.forEach(function (key) {
        if (owns(lifestyle, key) && typeof lifestyle[key] === 'number' && Number.isFinite(lifestyle[key])) observations[key] = lifestyle[key];
      });
      if (owns(lifestyle, 'smoker') && typeof lifestyle.smoker === 'boolean') observations.smoker = lifestyle.smoker;
    }
    return { score: null, available: false, observations, note: WELLNESS_DISCLAIMER };
  }

  function calculateWellness(input) {
    const data = isObject(input) ? input : {};
    const pheno = calculatePhenoAge(data.biomarkers, data.chronologicalAge);
    return {
      wellnessScore: calculateWellnessScore(data.lifestyle), suggestions: [],
      phenoAge: pheno.error ? { available: false, reason: pheno.error, missing: pheno.missing, invalid: pheno.invalid } : { available: pheno.displayable, value: pheno.displayable ? pheno.phenoAge : null, displayStatus: pheno.displayStatus, modelVersion: MODEL_VERSION, note: NOTE },
      disclaimer: WELLNESS_DISCLAIMER
    };
  }

  function localDate() {
    const date = new Date();
    return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function validPanelDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > localDate()) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function createRecord(input) {
    if (!isObject(input) || !validPanelDate(input.panelDate)) return { error: 'Enter a valid blood-draw date that is not in the future.' };
    const result = calculatePhenoAge(input.biomarkers, input.chronologicalAge);
    if (result.error) return result;
    const biomarkers = {};
    FIELDS.forEach(function (field) {
      biomarkers[field.key] = { value: input.biomarkers[field.key].value, unit: input.biomarkers[field.key].unit };
    });
    return {
      schemaVersion: 1, modelVersion: MODEL_VERSION,
      id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
      recordedAt: new Date().toISOString(), panelDate: input.panelDate,
      chronologicalAge: input.chronologicalAge, biomarkers, result
    };
  }

  function validRecord(record) {
    if (!isObject(record) || record.schemaVersion !== 1 || record.modelVersion !== MODEL_VERSION ||
        typeof record.id !== 'string' || !record.id || record.id.length > 100 || !validPanelDate(record.panelDate) ||
        typeof record.recordedAt !== 'string' || !Number.isFinite(Date.parse(record.recordedAt)) ||
        !isObject(record.result) || record.result.modelVersion !== MODEL_VERSION) return false;
    const calculated = calculatePhenoAge(record.biomarkers, record.chronologicalAge);
    return !calculated.error && Number.isFinite(record.result.phenoAge) && Math.abs(calculated.phenoAge - record.result.phenoAge) < 1e-9;
  }

  function canonicalRecord(record) {
    const biomarkers = {};
    FIELDS.forEach(function (field) { biomarkers[field.key] = { value: record.biomarkers[field.key].value, unit: record.biomarkers[field.key].unit }; });
    return { schemaVersion: 1, modelVersion: MODEL_VERSION, id: record.id, recordedAt: record.recordedAt, panelDate: record.panelDate, chronologicalAge: record.chronologicalAge, biomarkers, result: calculatePhenoAge(biomarkers, record.chronologicalAge) };
  }

  // Never migrate old demonstration/wellness records or import another feature's lab store.
  // Invalid stored data is left intact and blocks writes, instead of being silently replaced.
  function readHistory() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) return { records: [], error: null };
      const records = JSON.parse(raw);
      if (!Array.isArray(records) || records.some(record => !validRecord(record)) || new Set(records.map(record => record.id)).size !== records.length) {
        return { records: [], error: 'Saved research records need review and have been left untouched. You can still calculate without saving.' };
      }
      return { records: records.map(canonicalRecord), error: null };
    } catch (_) {
      return { records: [], error: 'Browser storage is unavailable or unreadable. You can still calculate without saving.' };
    }
  }
  function getHistory() { return readHistory().records; }
  function saveResult(record) {
    if (!validRecord(record)) return false;
    const history = readHistory();
    if (history.error) return false;
    const existing = history.records.find(item => item.id === record.id);
    if (existing) return JSON.stringify(existing) === JSON.stringify(canonicalRecord(record));
    // No silent pruning of a user's records.
    if (history.records.length >= 500) return false;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history.records.concat([canonicalRecord(record)]))); return true; }
    catch (_) { return false; }
  }
  function deleteRecord(id) {
    const history = readHistory();
    if (history.error || !history.records.some(record => record.id === id)) return false;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history.records.filter(record => record.id !== id))); return true; }
    catch (_) { return false; }
  }

  window.OvulunaWellness = Object.freeze({
    calculateWellness, calculateWellnessScore, calculatePhenoAge,
    convertToPhenoUnits, validateBiomarkers, PHENO_COEFFS, PHENO_CONSTANTS,
    WELLNESS_DISCLAIMER, MODEL_VERSION, STORAGE_KEY, FIELDS,
    createRecord, saveResult, getHistory, deleteRecord
  });

  function initPage() {
    const form = document.getElementById('pheno-form');
    if (!form) return;
    const fieldsRoot = document.getElementById('biomarker-fields');
    const message = document.getElementById('pheno-message');
    const save = document.getElementById('save-pheno');
    const historyRoot = document.getElementById('pheno-history');
    let currentRecord = null;
    const controls = {};
    const make = (tag, text, className) => {
      const element = document.createElement(tag);
      if (text !== undefined) element.textContent = text;
      if (className) element.className = className;
      return element;
    };
    const announce = text => { message.textContent = text; };
    const prettyDate = value => new Date(value + 'T12:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    document.getElementById('panel-date').max = localDate();

    FIELDS.forEach(function (field) {
      const group = make('div', undefined, 'pheno-field');
      const label = make('label', field.label);
      label.htmlFor = 'pheno-' + field.key;
      const input = make('input');
      input.id = label.htmlFor; input.name = field.key; input.type = 'number'; input.step = 'any';
      input.required = true; input.inputMode = 'decimal';
      input.setAttribute('aria-describedby', 'panel-help');
      const unitLabel = make('label', 'Unit for ' + field.label, 'pheno-sr-only');
      unitLabel.htmlFor = input.id + '-unit';
      const unit = make('select'); unit.id = unitLabel.htmlFor; unit.name = field.key + '-unit'; unit.required = true;
      const placeholder = make('option', 'Select unit'); placeholder.value = ''; unit.append(placeholder);
      Object.keys(field.units).forEach(function (name) { const option = make('option', name); option.value = name; unit.append(option); });
      const pair = make('div', undefined, 'pheno-input-pair'); pair.append(input, unitLabel, unit);
      group.append(label, pair); fieldsRoot.append(group);
      controls[field.key] = { input, unit };
    });

    function resetCurrent() {
      currentRecord = null;
      FIELDS.forEach(function (field) { controls[field.key].input.removeAttribute('aria-invalid'); controls[field.key].unit.removeAttribute('aria-invalid'); });
      document.getElementById('pheno-number').textContent = '—';
      document.getElementById('pheno-age-value').textContent = '—';
      document.getElementById('pheno-result-label').textContent = 'Awaiting your panel';
      document.getElementById('pheno-result-detail').textContent = 'Enter all nine results from one blood draw to calculate a research reference.';
      document.getElementById('pheno-normalized').replaceChildren();
      document.getElementById('pheno-normalized-wrap').hidden = true;
      save.hidden = true; save.disabled = true;
    }
    function displayRecord(record) {
      currentRecord = record;
      document.getElementById('pheno-number').textContent = record.result.displayable ? record.result.phenoAge.toFixed(1) : '—';
      document.getElementById('pheno-age-value').textContent = String(record.chronologicalAge);
      document.getElementById('pheno-result-label').textContent = record.result.displayable ? 'PhenoAge approximation · years' : 'Reference unavailable · outlier';
      document.getElementById('pheno-result-detail').textContent = record.result.displayable ? 'Based only on your manually entered panel dated ' + prettyDate(record.panelDate) + '. This result does not show why a value changed or whether your health improved.' : 'The formula output is outside this calculator’s display range of 0–120 years. No supported interpretation is available. Check the values and units against your lab report. You can still save this panel.';
      const normalized = document.getElementById('pheno-normalized'); normalized.replaceChildren();
      FIELDS.forEach(function (field) {
        const row = make('div'); row.append(make('dt', field.label), make('dd', Number(record.result.normalizedBiomarkers[field.key].toPrecision(8)).toString() + ' ' + Object.keys(field.units)[0])); normalized.append(row);
      });
      document.getElementById('pheno-normalized-wrap').hidden = false;
      save.hidden = false; save.disabled = false; save.textContent = 'Save this panel on this browser';
    }
    function showHistory() {
      const history = readHistory(); historyRoot.replaceChildren();
      document.getElementById('pheno-history-status').textContent = history.error || (history.records.length ? history.records.length + ' saved panel' + (history.records.length === 1 ? '' : 's') + '. Select a panel to review its original values.' : 'No saved panels yet. Calculating alone does not save your lab results.');
      history.records.slice().sort((a, b) => b.panelDate.localeCompare(a.panelDate) || b.recordedAt.localeCompare(a.recordedAt)).forEach(function (record) {
        const item = make('li', undefined, 'pheno-history-item');
        item.append(make('h3', prettyDate(record.panelDate)), make('p', (record.result.displayable ? 'PhenoAge approximation: ' + record.result.phenoAge.toFixed(1) + ' years' : 'Reference unavailable: formula outlier') + ' · Age at draw: ' + record.chronologicalAge));
        const actions = make('div', undefined, 'pheno-actions');
        const load = make('button', 'Review panel', 'btn ghost'); load.type = 'button';
        load.setAttribute('aria-label', 'Review panel dated ' + prettyDate(record.panelDate));
        load.addEventListener('click', function () {
          form.elements.namedItem('chronologicalAge').value = String(record.chronologicalAge);
          form.elements.namedItem('panelDate').value = record.panelDate;
          FIELDS.forEach(function (field) { controls[field.key].input.value = String(record.biomarkers[field.key].value); controls[field.key].unit.value = record.biomarkers[field.key].unit; });
          displayRecord(record); save.disabled = true; save.textContent = 'Saved on this browser';
          announce('Loaded your saved panel. Editing a value clears the displayed result until you calculate again.');
          document.getElementById('pheno-result').focus();
        });
        const remove = make('button', 'Delete', 'btn ghost'); remove.type = 'button';
        remove.setAttribute('aria-label', 'Delete saved panel dated ' + prettyDate(record.panelDate));
        remove.addEventListener('click', function () {
          if (!window.confirm('Delete this saved panel dated ' + prettyDate(record.panelDate) + ' from this browser?')) return;
          if (!deleteRecord(record.id)) { announce('This panel could not be deleted. Browser storage may be unavailable.'); return; }
          if (currentRecord && currentRecord.id === record.id) { resetCurrent(); form.reset(); }
          showHistory(); announce('Panel deleted from this browser.'); document.getElementById('history-title').focus();
        });
        actions.append(load, remove); item.append(actions); historyRoot.append(item);
      });
    }

    form.addEventListener('input', function () {
      if (currentRecord) { resetCurrent(); announce('Inputs changed. Calculate again to see a result for these values.'); }
    });
    form.addEventListener('change', function () {
      if (currentRecord) { resetCurrent(); announce('Inputs changed. Calculate again to see a result for these values.'); }
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault(); resetCurrent();
      if (!form.reportValidity()) return;
      const biomarkers = {};
      FIELDS.forEach(function (field) {
        controls[field.key].input.removeAttribute('aria-invalid'); controls[field.key].unit.removeAttribute('aria-invalid');
        biomarkers[field.key] = { value: controls[field.key].input.valueAsNumber, unit: controls[field.key].unit.value };
      });
      const record = createRecord({ chronologicalAge: form.elements.namedItem('chronologicalAge').valueAsNumber, panelDate: form.elements.namedItem('panelDate').value, biomarkers });
      if (record.error) {
        const errors = (record.missing || []).concat(record.invalid || []);
        errors.forEach(function (key) { controls[key].input.setAttribute('aria-invalid', 'true'); controls[key].unit.setAttribute('aria-invalid', 'true'); });
        announce(record.error + (errors.length ? ' Review: ' + FIELDS.filter(field => errors.includes(field.key)).map(field => field.label).join(', ') + '.' : ''));
        if (errors.length) controls[errors[0]].input.focus();
        return;
      }
      displayRecord(record); announce(record.result.displayable ? 'Research approximation calculated. It has not been saved.' : 'The result is outside the supported display range. Your entered panel can still be saved.'); document.getElementById('pheno-result').focus();
    });
    save.addEventListener('click', function () {
      if (!currentRecord) return;
      if (!saveResult(currentRecord)) { announce('This result could not be saved. Storage may be blocked, full, or contain a record requiring review. Your current result remains visible.'); return; }
      save.disabled = true; save.textContent = 'Saved on this browser'; announce('Panel and research result saved on this browser.'); showHistory();
    });
    document.getElementById('clear-pheno').addEventListener('click', function () {
      form.reset(); resetCurrent(); announce('Form cleared. Saved panels remain in your history.'); form.elements.namedItem('chronologicalAge').focus();
    });
    window.addEventListener('storage', function (event) { if (event.key === STORAGE_KEY || event.key === null) showHistory(); });
    showHistory();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPage, { once: true });
    else initPage();
  }
})();
