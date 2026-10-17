/* A reading filter only. No storage writes, scores or inferred life stage. */
(function () {
  'use strict';
  var select = document.getElementById('record-context');
  if (!select) return;
  function filter() {
    document.querySelectorAll('[data-record-context]').forEach(function (section) {
      section.hidden = select.value !== 'all' && section.dataset.recordContext !== select.value;
    });
  }
  select.addEventListener('change', filter);
  filter();
})();
