/* Explicit, origin-scoped local storage controls. This controller never
   writes, migrates or removes data merely because the page is opened. Export retains raw strings, including damaged
   JSON, rather than silently repairing a person's record. */
(function (root) {
  'use strict';
  const STORES = [
    /* the room's own stores (launch sweep, 20 Oct 2026: the list used to start at the earlier pages and missed the diary) */
    ['ovumind_db_v1', 'Your Rhythme diary: entries, answers, choices, room, water records and the water questions (water stays on this phone even with cloud backup on)', 'current'],
    ['ovumind_food_journal', 'Older copy of your meals', 'current'],
    ['ovumind_cycle', 'Older copy of your cycle summary', 'current'],
    ['ovumind_ai_v1', "Luna's AI settings", 'preferences'],
    ['ovumind_reminders_v1', 'Reminder settings', 'preferences'],
    ['ovumind_nova_words', 'Food processing word view', 'preferences'],
    ['ovumind_room', 'Older room settings', 'legacy'],
    ['ovumind_room_skipped', 'Skipped room welcome', 'preferences'],
    ['ovumind_device_v1', 'This phone\'s Rhythme device code', 'preferences'],
    ['rhythme_podcast_v1', "Erin's podcast listening on this phone", 'additional'],
    ['rhythme_voice_muted', 'Voice on or off', 'preferences'],
    ['ovumind_sync_v1', 'Cloud backup bookkeeping (no entries)', 'preferences'],
    ['ovumind_sync_pos_v1', 'Cloud backup position: which account and how far it has synced (no entries)', 'preferences'],
    ['ovumind_sync_reset_v1', 'Cloud backup reset marker (no entries)', 'preferences'],
    ['ovumind_desk_v1', 'Desk layout', 'preferences'],
    ['rhythme_plus_v1', 'Rhythme Plus access on this phone', 'preferences'],
    ['rhythme_plus_v1_pending', 'A Rhythme Plus code being checked', 'preferences'],
    /* never listed: ovumind_auth_v1 holds sign-in tokens, so it is not exported; sign out from Your account instead */
    ['ovuluna_observations_v1', 'Cycle observations, treatment and device notes', 'current'],
    ['ovuluna_lab_records_v1', 'Lab records', 'current'],
    ['ovuluna_wellness_journal_v1', 'Wellness journal', 'current'],
    ['ovuluna_daily_checkins_v1', 'Daily check-ins', 'current'],
    ['ovuluna_daily_context_v1', 'Confirmed daily guidance context', 'current'],
    ['ovuluna_daily_routine_v1', 'In-app routine reminder preference', 'preferences'],
    ['ovuluna_daily_completions_v1', 'Daily guidance checklist history', 'current'],
    ['ovuluna_ovarian_assessments_v2', 'Ovarian assessment inputs and history', 'current'],
    ['ovuluna_phenoage_records_v1', 'PhenoAge research inputs and history', 'current'],
    ['ovuluna_profile', 'Health profile', 'additional'],
    ['ovuluna_label_scans', 'Label scan history', 'additional'],
    ['ovuluna_medas14', 'Diet questionnaire', 'additional'],
    ['ovuluna_pss10', 'Stress questionnaire history', 'additional'],
    ['ovuluna_sleep_logs', 'Sleep diary', 'additional'],
    ['ov_hydro', 'Hydration log', 'additional'],
    ['ov_acupoint_routine', 'Acupoint routine', 'additional'],
    ['ovuluna_footsoak_reminder', 'Footsoak reminder preference', 'additional'],
    ['ovuluna_luna', 'Legacy Luna conversation and credit settings', 'legacy'],
    ['ovuluna_ovarian_age', 'Legacy ovarian-age data', 'legacy'],
    ['ov_result', 'Legacy assessment result', 'legacy'],
    ['ovuluna_labs', 'Legacy lab data', 'legacy'],
    ['ovuluna_wellness_data', 'Legacy wellness engine data', 'legacy'],
    ['ovuluna_cycle_data', 'Legacy cycle data', 'legacy'],
    ['ovuluna_onboarding', 'Self-reported onboarding answers', 'additional'],
    ['ovuluna_language', 'Language preference', 'preferences'],
    ['ovuluna_units', 'Measurement units preference', 'preferences'],
    ['ovuluna_auth', 'Legacy local sign-in appearance (not a verified account)', 'legacy'],
    ['ovuluna_preferences_v1', 'Welcome preferences', 'preferences'],
    ['ovuluna_persona', 'Your life chapter (Settings)', 'preferences'],
    ['ovuluna_theme', 'Color theme', 'preferences'],
    ['ovuluna_fontsize', 'Text size', 'preferences'],
    ['ovuluna_hormone_view', 'Hormone chart view', 'preferences'],
    ['ov_mascot_hide', 'Mascot visibility', 'preferences'],
    ['ovuluna_luna_seen', 'Legacy Luna welcome preference', 'preferences']
  ];
  const LEGACY_DAILY = /^ovuluna_daily_log_\d{4}-\d{2}-\d{2}$/;
  function definition(key) {
    const known = STORES.find(item => item[0] === key);
    if (known) return { key: known[0], label: known[1], group: known[2] };
    if (LEGACY_DAILY.test(key)) return { key: key, label: 'Legacy daily log · ' + key.slice(-10), group: 'legacy' };
    return null;
  }
  function inventory(storage) {
    const keys = [];
    for (let i = 0; i < storage.length; i++) { const key = storage.key(i); if (typeof key === 'string') keys.push(key); }
    return keys.sort().map(key => { const item = definition(key); if (!item) return null; const raw = storage.getItem(key); return raw === null ? null : Object.assign(item, { characters: raw.length }); }).filter(Boolean);
  }
  function snapshot(storage, keys) {
    if (!Array.isArray(keys) || !keys.length) throw new Error('Select at least one stored item.');
    return [...new Set(keys)].map(key => {
      const item = definition(key); if (!item) throw new Error('Unrecognized storage key. Nothing was changed.');
      const raw = storage.getItem(key); if (raw === null) throw new Error('A selected item changed. Review your selection again.');
      return Object.assign(item, { raw: raw });
    });
  }
  function exportData(storage, keys, origin) {
    return { format: 'ovuluna-local-export', version: 1, exportedAt: new Date().toISOString(), origin: origin, note: 'Raw local storage strings, not clinically interpreted results. Keep this file private. No restore or cloud backup is provided by this export.', stores: snapshot(storage, keys) };
  }
  function removeReviewed(storage, reviewed) {
    if (!Array.isArray(reviewed) || !reviewed.length) throw new Error('Review selected items before deleting.');
    // Validate every item before removing any. A changed record invalidates consent.
    reviewed.forEach(item => { if (!item || !definition(item.key) || typeof item.raw !== 'string' || storage.getItem(item.key) !== item.raw) throw new Error('Stored data changed after review. Nothing was deleted. Review again.'); });
    const deleted = [], failed = [];
    reviewed.forEach(item => { try { storage.removeItem(item.key); if (storage.getItem(item.key) !== null) throw new Error('not removed'); deleted.push(item.key); } catch (_) { failed.push(item.key); } });
    return { deleted: deleted, failed: failed };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { inventory, snapshot, exportData, removeReviewed, definition }; return; }
  const d = root.document; if (!d) return;
  function boot() {
    const list = d.getElementById('privacy-stores'); if (!list) return;
    /* the controls show, export and delete the diary on this phone, so they open only for its own signed-in account
     * (menopause walk, 21 Oct: after Sign out, keep my diary, this page still listed and exported it) */
    let sess = null, prof = {}; try { sess = JSON.parse(root.localStorage.getItem('ovumind_auth_v1') || 'null'); prof = ((JSON.parse(root.localStorage.getItem('ovumind_db_v1') || 'null') || {}).profile) || {}; } catch (_) { }
    const owner = typeof prof.owner === 'string' ? (prof.owner || null) : ((prof.cloud && prof.cloud.uid) || ((prof.consentEvents || []).filter(e => e && e.uid)[0] || {}).uid || null), uidNow = sess && sess.user && sess.user.id;
    function allowed() { let s2 = null, p2 = {}; try { s2 = JSON.parse(root.localStorage.getItem('ovumind_auth_v1') || 'null'); p2 = ((JSON.parse(root.localStorage.getItem('ovumind_db_v1') || 'null') || {}).profile) || {}; } catch (_) { return false; } const o2 = typeof p2.owner === 'string' ? (p2.owner || null) : ((p2.cloud && p2.cloud.uid) || ((p2.consentEvents || []).filter(e => e && e.uid)[0] || {}).uid || null), u2 = s2 && s2.user && s2.user.id; return !!(s2 && s2.access_token) && !(o2 && u2 && o2 !== u2); }
    function lock() { const ej = d.getElementById('privacy-export-json'), er = d.getElementById('privacy-export-result'), dg = d.getElementById('privacy-delete-dialog'); if (ej) ej.value = ''; if (er) er.hidden = true; if (dg && dg.open) dg.close(); if (!list.isConnected) return; const box = list.closest('section') || list.parentNode; const note = d.createElement('p'); note.className = 'privacy-locked'; note.textContent = 'Sign in to Rhythme with the account this diary belongs to, to view, export or delete it here.'; const a = d.createElement('a'); a.href = 'room.html'; a.textContent = 'Open Rhythme'; note.append(' ', a); box.replaceChildren(note); }
    try { root.addEventListener('storage', function (e) { if ((!e || e.key === null || e.key === 'ovumind_auth_v1' || e.key === 'ovumind_db_v1') && !allowed()) lock(); }); root.addEventListener('pageshow', function () { if (!allowed()) lock(); }); } catch (_) { }
    if (!(sess && sess.access_token) || (owner && uidNow && owner !== uidNow)) { const box = list.closest('section') || list.parentNode; const note = d.createElement('p'); note.className = 'privacy-locked'; note.textContent = 'Sign in to Rhythme with the account this diary belongs to, to view, export or delete it here.'; const a = d.createElement('a'); a.href = 'room.html'; a.textContent = 'Open Rhythme'; note.append(' ', a); box.replaceChildren(note); return; }
    const status = d.getElementById('privacy-status'), dialog = d.getElementById('privacy-delete-dialog'), confirm = d.getElementById('privacy-confirm-delete'), agree = d.getElementById('privacy-delete-agree');
    const reviewButton = d.getElementById('privacy-review-delete'), exportButton = d.getElementById('privacy-export');
    let reviewed = null, downloadable = null;
    function message(text) { status.textContent = text; }
    function selected() { return Array.from(list.querySelectorAll('input:checked')).map(input => input.value); }
    function setActions() { const hasSelection = selected().length > 0; exportButton.disabled = !hasSelection; reviewButton.disabled = !hasSelection; d.getElementById('privacy-clear-selection').disabled = !hasSelection; d.getElementById('privacy-select-all').disabled = list.querySelectorAll('input').length === 0; }
    function refresh() {
      list.replaceChildren();
      try {
        const items = inventory(root.localStorage);
        d.getElementById('privacy-inventory-count').textContent = items.length ? items.length + ' recognized stored items. Select exactly what to include.' : 'No recognized Rhythme records are stored in this origin.';
        [['current', 'Current records'], ['additional', 'Other app records'], ['legacy', 'Legacy data · preserved unless selected'], ['preferences', 'Appearance and preferences']].forEach(group => {
          const records = items.filter(item => item.group === group[0]); if (!records.length) return;
          const fieldset = d.createElement('fieldset'), legend = d.createElement('legend'); legend.textContent = group[1]; fieldset.append(legend);
          records.forEach(item => {
            const label = d.createElement('label'), input = d.createElement('input'), text = d.createElement('span'), name = d.createElement('strong'), key = d.createElement('small');
            input.type = 'checkbox'; input.value = item.key; input.addEventListener('change', setActions);
            name.textContent = item.label; key.textContent = item.key + ' · ' + item.characters.toLocaleString() + ' stored characters'; text.append(name, key); label.append(input, text); fieldset.append(label);
          }); list.append(fieldset);
        });
      } catch (_) { message('Browser storage is unavailable. Export and deletion cannot run here.'); }
      setActions();
    }
    function clearExport() { downloadable = null; d.getElementById('privacy-export-json').value = ''; d.getElementById('privacy-export-result').hidden = true; }
    function closeReview() { reviewed = null; if (dialog.open) dialog.close(); reviewButton.focus(); }
    function finishDelete() {
      if (!reviewed || !agree.checked) return;
      if (!allowed()) { closeReview(); lock(); return; }
      try {
        const result = removeReviewed(root.localStorage, reviewed); closeReview(); clearExport(); refresh();
        message(result.deleted.length + ' selected items deleted from this origin.' + (result.failed.length ? ' ' + result.failed.length + ' could not be deleted; review the remaining list.' : ' Unselected and unrecognized stores were preserved.') + ' Other devices, downloads and server-held records are unaffected. Reload other open tabs before editing records.');
      } catch (error) { closeReview(); refresh(); message(error.message || 'Deletion failed. Review the stored items again.'); }
    }
    d.getElementById('privacy-select-all').addEventListener('click', function () { list.querySelectorAll('input').forEach(input => { input.checked = true; }); setActions(); message('All listed local items selected. Review before deleting; no data has changed.'); });
    d.getElementById('privacy-clear-selection').addEventListener('click', function () { list.querySelectorAll('input').forEach(input => { input.checked = false; }); setActions(); message('Selection cleared. No data has changed.'); });
    d.getElementById('privacy-export-before-delete').addEventListener('click', function () { closeReview(); exportButton.click(); });
    exportButton.addEventListener('click', function () {
      if (!allowed()) { lock(); return; }
      try {
        downloadable = JSON.stringify(exportData(root.localStorage, selected(), root.location.origin), null, 2);
        d.getElementById('privacy-export-json').value = downloadable; d.getElementById('privacy-export-result').hidden = false;
        d.getElementById('privacy-export-result').scrollIntoView({ block: 'nearest' });
        message('Selected JSON export is ready below. It contains personal data. Save it somewhere private.');
      } catch (error) { clearExport(); message(error.message || 'Export could not be prepared.'); }
    });
    d.getElementById('privacy-download').addEventListener('click', function () {
      if (!downloadable) return;
      if (root.OvumindRuntime?.platform === 'ios-development' || root.location.protocol === 'capacitor:') { message('Native file sharing is not connected in this build. The JSON below can be selected and copied; no download was started.'); return; }
      let url;
      try {
        url = URL.createObjectURL(new Blob([downloadable], { type: 'application/json' })); const link = d.createElement('a'); link.href = url; link.download = 'ovuluna-local-data-' + new Date().toISOString().slice(0, 10) + '.json'; d.body.append(link); link.click(); link.remove(); root.setTimeout(() => URL.revokeObjectURL(url), 1000); message('Browser download requested. Check that the file was saved.');
      } catch (_) { if (url) URL.revokeObjectURL(url); message('Download unavailable here. Select and copy the JSON below.'); }
    });
    d.getElementById('privacy-select-json').addEventListener('click', function () { const text = d.getElementById('privacy-export-json'); text.focus(); text.select(); message('JSON selected. Use your device’s Copy command to copy it.'); });
    d.getElementById('privacy-hide-export').addEventListener('click', function () { clearExport(); exportButton.focus(); message('Export preview cleared. Any downloaded copies remain on your device.'); });
    reviewButton.addEventListener('click', function () {
      try { reviewed = snapshot(root.localStorage, selected()); } catch (error) { message(error.message); refresh(); return; }
      const summary = d.getElementById('privacy-delete-summary'); summary.replaceChildren();
      reviewed.forEach(item => { const li = d.createElement('li'); li.textContent = item.label + ' (' + item.key + ')'; summary.append(li); });
      agree.checked = false; confirm.disabled = true;
      if (typeof dialog.showModal === 'function') { dialog.showModal(); d.getElementById('privacy-cancel-delete').focus(); }
      else if (root.confirm('Permanently delete only these local stores?\n' + reviewed.map(item => item.label + ' (' + item.key + ')').join('\n') + '\nNo undo. Other devices and downloads are unaffected.')) { agree.checked = true; finishDelete(); } else reviewed = null;
    });
    agree.addEventListener('change', () => { confirm.disabled = !agree.checked; }); confirm.addEventListener('click', finishDelete);
    d.getElementById('privacy-cancel-delete').addEventListener('click', closeReview);
    dialog.addEventListener('cancel', () => { reviewed = null; }); dialog.addEventListener('close', () => { reviewed = null; reviewButton.focus(); });
    root.addEventListener('storage', event => { if (event.key === null || definition(event.key)) { if (dialog.open) closeReview(); clearExport(); refresh(); message('Local data changed in another tab. Review your selection again.'); } });
    root.addEventListener('pagehide', () => { reviewed = null; clearExport(); if (dialog.open) dialog.close(); });
    function focusDestination() { const id = root.location.hash.slice(1); if (id === 'privacy-local-title' || id === 'privacy-account-title') { const heading = d.getElementById(id); heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start' }); } }
    root.addEventListener('hashchange', focusDestination);
    root.addEventListener('pageshow', refresh); refresh(); focusDestination();
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
