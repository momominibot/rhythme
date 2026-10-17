/* A nickname is a local preference, never an account or health measurement.
   Preserve unknown preference fields; refuse damaged data or stale-page writes. */
(function () {
  'use strict';
  var KEY = 'ovuluna_preferences_v1';
  var form = document.getElementById('local-profile-form');
  if (!form) return;
  var input = document.getElementById('local-nickname');
  var status = document.getElementById('local-profile-status');
  var expected = null, ready = false;
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function parse(raw) {
    if (raw === null) return {};
    var result = JSON.parse(raw);
    if (!object(result) || (result.version !== undefined && result.version !== 1)) throw new Error('Unsupported preference data');
    if (result.nickname !== undefined && (typeof result.nickname !== 'string' || result.nickname.length > 40)) throw new Error('Invalid nickname');
    return result;
  }
  function restore() {
    try {
      var raw = localStorage.getItem(KEY), record = parse(raw);
      expected = raw; ready = true; input.value = record.nickname || '';
      status.textContent = raw === null ? 'No nickname saved yet. Your other records are unchanged.' : 'Your saved nickname is restored. Your other records are unchanged.';
    } catch (_) {
      ready = false;
      status.textContent = 'Preferences could not be read. Existing data is unchanged. Your draft stays here; review local data in Settings before trying again.';
    }
  }
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var nickname = input.value.trim();
    if (nickname.length > 40 || /[\u0000-\u001f\u007f]/.test(nickname)) { status.textContent = 'Use a nickname of up to 40 characters without control characters. Your draft is not saved.'; return; }
    if (!ready) { status.textContent = 'Preferences are unavailable. Your draft is not saved; existing data is unchanged. Restore saved nickname after reviewing Settings.'; return; }
    try {
      var current = localStorage.getItem(KEY);
      if (current !== expected) throw new Error('stale');
      var record = parse(current);
      record.nickname = nickname; record.updatedAt = new Date().toISOString();
      var next = JSON.stringify(record);
      localStorage.setItem(KEY, next);
      if (localStorage.getItem(KEY) !== next) throw new Error('verify');
      expected = next;
      input.value = nickname;
      status.textContent = 'Nickname saved on this browser. No account or health assessment was changed.';
    } catch (error) {
      status.textContent = error.message === 'stale' ? 'Saved preferences changed or were deleted in another tab. Your draft is not saved. Restore saved nickname to review the latest version.' : 'Your nickname could not be saved. Your draft stays here. Check browser storage, then retry.';
    }
  });
  document.getElementById('restore-local-profile').addEventListener('click', restore);
  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) status.textContent = 'Saved preferences changed in another tab. Your draft stays here. Restore saved nickname before saving.';
  });
  restore();
})();
