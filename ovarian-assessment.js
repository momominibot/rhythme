/* Assessment UI consumes the versioned contract for preview, save and restoration. */
(function () {
  'use strict';
  var model = window.OvarianModel;
  var form = document.getElementById('assessmentForm');
  var ids = ['age', 'cycle', 'context', 'amh', 'amhUnit', 'amhDate', 'momMeno', 'smoke', 'circ', 'sleep'];
  var fields = {};
  ids.forEach(function (id) { fields[id] = document.getElementById(id); });
  var status = document.getElementById('saveStatus');
  var errorBox = document.getElementById('formError');
  var history = document.getElementById('assessmentHistory');
  var exportButton = document.getElementById('exportAssessments');
  fields.amhDate.max = model.localDay(new Date());
  function rawInput() {
    return {
      age: fields.age.value, cycle: fields.cycle.value, context: fields.context.value,
      amh: fields.amh.value || fields.amhUnit.value || fields.amhDate.value ? { value: fields.amh.value, unit: fields.amhUnit.value, collectedOn: fields.amhDate.value } : null,
      momMeno: fields.momMeno.value, smoke: fields.smoke.value, circ: fields.circ.value, sleep: fields.sleep.value
    };
  }
  function showError(message) { errorBox.hidden = !message; errorBox.textContent = message || ''; }
  function textRow(label, value) {
    var row = document.createElement('div'), title = document.createElement('dt'), content = document.createElement('dd');
    title.textContent = label; content.textContent = value; row.append(title, content); return row;
  }
  function optionText(id, value) {
    var option = Array.from(fields[id].options).find(function (o) { return o.value === value; });
    return option ? option.textContent : 'Not recorded';
  }
  function render(showRequired) {
    var result = model.assess(rawInput());
    ids.forEach(function (id) {
      var msg = result.errors[id] || (showRequired && result.missing.indexOf(id) !== -1 ? 'Please answer this question.' : '');
      document.getElementById(id + 'Error').textContent = msg;
      fields[id].setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
    document.getElementById('assessmentState').textContent = result.reason;
    var summary = document.getElementById('assessmentSummary'); summary.replaceChildren();
    summary.appendChild(textRow('Core questions answered', result.questions.answered + ' of ' + result.questions.total + ' (not a health score)'));
    summary.appendChild(textRow('Age at entry', result.input.age !== null && !result.errors.age ? result.input.age + ' years (self-reported)' : 'Not recorded'));
    summary.appendChild(textRow('Cycle pattern', optionText('cycle', result.input.cycle)));
    summary.appendChild(textRow('Current context', optionText('context', result.input.context)));
    summary.appendChild(textRow('AMH', result.input.amh ? result.input.amh.value + ' ' + result.input.amh.unit + ' · collected ' + result.input.amh.collectedOn : 'Not recorded'));
    return result;
  }
  function fill(input) {
    ['age','cycle','context','momMeno','smoke','circ','sleep'].forEach(function (id) { fields[id].value = input[id] === null || input[id] === undefined ? '' : input[id]; });
    fields.amh.value = input.amh ? input.amh.value : '';
    fields.amhUnit.value = input.amh ? input.amh.unit : '';
    fields.amhDate.value = input.amh ? input.amh.collectedOn : '';
    showError(''); render(false);
  }
  function refreshHistory() {
    history.replaceChildren(); exportButton.disabled = true;
    try {
      var log = model.read(localStorage);
      document.getElementById('historyStatus').textContent = log.records.length ? log.records.length + ' saved assessment' + (log.records.length === 1 ? '' : 's') + '. Showing the latest 20.' : 'No saved assessments yet.';
      exportButton.disabled = log.records.length === 0;
      log.records.slice(0, 20).forEach(function (record) {
        var current = model.assess(record.result.input);
        var item = document.createElement('article'); item.className = 'assessment-history-item';
        var date = document.createElement('strong'); date.textContent = new Date(record.recordedAt).toLocaleString();
        var caption = document.createElement('span');
        caption.textContent = current.errors.age || current.input.age === null ? 'Entry needs review' : 'Age at entry: ' + current.input.age + ' · self-reported';
        var load = document.createElement('button'); load.type = 'button'; load.textContent = 'Review these inputs';
        load.addEventListener('click', function () { fill(record.result.input); status.textContent = 'Loaded saved inputs. Check your age and answers before saving a new entry.'; fields.age.focus(); });
        item.append(date, caption, load); history.appendChild(item);
      });
      document.getElementById('legacyNotice').hidden = localStorage.getItem('ovuluna_ovarian_age') === null && localStorage.getItem('ov_result') === null;
    } catch (error) {
      document.getElementById('historyStatus').textContent = 'Saved assessments are unavailable. Existing data has not been changed.';
      showError('This browser could not read your saved assessment log. Export or saving may be unavailable.');
    }
  }
  form.addEventListener('input', function () { status.textContent = ''; showError(''); render(false); });
  form.addEventListener('change', function () { status.textContent = ''; showError(''); render(false); });
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var result = render(true);
    if (result.status === 'invalid-input' || result.status === 'insufficient-data') {
      showError('Your assessment has not been saved. Correct the highlighted fields.');
      var invalid = form.querySelector('[aria-invalid="true"]'); if (invalid) invalid.focus();
      return;
    }
    try {
      model.save(localStorage, rawInput()); refreshHistory();
      status.textContent = 'Assessment saved on this device. No ovarian-age prediction was calculated.'; showError('');
    } catch (error) { showError('Your assessment could not be saved. Existing records have not been overwritten. Check browser storage access and try again.'); }
  });
  exportButton.addEventListener('click', function () {
    try {
      var log = model.read(localStorage);
      var url = URL.createObjectURL(new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' }));
      var a = document.createElement('a'); a.href = url; a.download = 'ovuluna-assessments-' + model.localDay(new Date()) + '.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      status.textContent = 'Assessment export prepared. It contains your personal health entries.';
    } catch (error) { showError('The assessment export could not be prepared. Your saved records have not been changed.'); }
  });
  render(false); refreshHistory();
})();
