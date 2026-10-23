/* Rhythme water (Jamie, 21 Oct 2026: "put water intake under food diary ... today's check-in should put water intake
 * instead of food ... reward ... but we need to factor in if they have any kidney disease"). Design v2 after the Codex
 * review (docs/design/2026-10-21-water-intake.md): a record of the plain water she drank, kept on this phone; general
 * drinking information with its sources, never a personal amount she "requires"; six hearts for the first record of the
 * real day in every mode, nothing for volume; optional screening that chooses which information line shows and nothing
 * else; care-team lines where fluids are the care team's call. Records carry ids and tombstones and merge by id, so two
 * tabs lose nothing and a stale tab never resurrects a wiped diary. Pure parts first (tested in node), then the strip. */
(function (root) {
  'use strict';
  var MAX_ML = 3000, QUICK = [[250, 'a glass'], [200, 'a cup'], [500, 'a small bottle']], KEEP_DAYS = 400, TOMB_DAYS = 60;
  var EVIDENCE = ['E95', 'E96', 'E97', 'E98', 'E99', 'E100', 'E101'];
  var QUESTIONS = [
    { key: 'kidney', text: 'Do you have kidney disease, or are you on dialysis?' },
    { key: 'heart', text: 'Heart failure, low blood sodium or SIADH, cirrhosis with fluid in the tummy, or lithium?' },
    { key: 'advice', text: 'Has a doctor given you advice about how much to drink, more or less?' },
    { key: 'preg', text: 'Pregnant, possibly pregnant, or pre-eclampsia?' }
  ];
  var INFO = {
    general: [
      'Most adults do well on about six to eight cups or glasses of fluid a day. Water, milk, tea and coffee all count, and so does the fluid in food. For most adults, pale yellow urine is a reasonable sign; it is not a reliable one in older age.',
      'Pregnancy and breastfeeding raise the need (about 300 ml and 700 ml more total water a day). Hot days, exercise and illness raise it too.',
      'Drinking far beyond thirst can lower the sodium in your blood. Around exercise, drink to thirst.',
      'Had kidney stones? The NHS and NICE advise 2.5 to 3 litres of water a day to help prevent more; if your clinic gave you a number, use theirs.'
    ],
    preg: [
      'In pregnancy and while breastfeeding the need is higher (about 300 ml and 700 ml more total water a day, EFSA). Hot days, exercise and illness raise it too. If a doctor has given you fluid advice, theirs comes first.',
      'Drinking far beyond thirst can lower the sodium in your blood. Drink to thirst.'
    ],
    care: [
      'Follow your care team’s advice about fluids. This log records plain water only, so it does not show your total fluid intake (tea, coffee, soup and milk count too).',
      'In kidney disease, drinking more did not slow the decline of kidney function in a one-year trial; in advanced kidney disease, dialysis and heart failure the right amount is set by your care team, and with lithium an adequate, steady intake matters. Rhythme never pays hearts for an amount.'
    ]
  };
  var CARE_LINK = 'https://www.healthhub.sg/health-conditions/heart-failure-monitoring-fluid-and-salt-intake';
  function S() { return root.OvuStore; }
  function R() { return root.OvuRoom; }
  function RW() { return root.OvuRewards; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function validDate(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false; var d = new Date(s + 'T12:00:00'); return !isNaN(d.getTime()) && d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) === s; }
  function validMl(v) { var n = Number(v); if (typeof v === 'boolean' || v === '' || v === null || v === undefined || !isFinite(n)) return null; n = Math.round(n); return n >= 1 && n <= MAX_ML ? n : null; }
  function validIso(s) { return typeof s === 'string' && isFinite(Date.parse(s)) ? s : null; }

  /* ---------- the shape, cleaned on every read ---------- */
  function empty() { return { v: 1, settings: {}, records: {}, tombstones: {} }; }
  function cleanSettings(s) {
    s = s && typeof s === 'object' && !Array.isArray(s) ? s : {}; var out = {}, a = s.answers && typeof s.answers === 'object' ? s.answers : null;
    if (a) { out.answers = {}; QUESTIONS.forEach(function (q) { if (a[q.key] === 'yes' || a[q.key] === 'no' || a[q.key] === 'unsure') out.answers[q.key] = a[q.key]; }); }
    if (s.bf === true) out.bf = true;
    if (s.declined === true) out.declined = true;
    if (s.hideNumbers === true) out.hideNumbers = true;
    if (s.legacyImported === true) out.legacyImported = true;
    if (validIso(s.at)) out.at = s.at;
    return out;
  }
  function clean(w) {
    var out = empty(); if (!w || typeof w !== 'object' || Array.isArray(w)) return out;
    out.settings = cleanSettings(w.settings);
    var recs = w.records && typeof w.records === 'object' && !Array.isArray(w.records) ? w.records : {};
    Object.keys(recs).forEach(function (id) {
      var r = recs[id]; if (!r || typeof r !== 'object' || !/^[a-z0-9_-]{1,40}$/i.test(id)) return;
      var ml = validMl(r.ml), at = validIso(r.at); if (!ml || !at || !validDate(r.date)) return;
      out.records[id] = { id: id, date: r.date, ml: ml, at: at };
    });
    var tombs = w.tombstones && typeof w.tombstones === 'object' && !Array.isArray(w.tombstones) ? w.tombstones : {};
    Object.keys(tombs).forEach(function (id) { var t = validIso(tombs[id]); if (t && /^[a-z0-9_-]{1,40}$/i.test(id)) { out.tombstones[id] = t; delete out.records[id]; } });
    return out;
  }
  /* records and tombstones by id, settings key by key: a tombstone wins; a record changed in both takes the newer time; mine on a tie */
  function merge(mine, base, theirs) {
    var m = clean(mine), b = clean(base), t = clean(theirs), out = empty(), ids = {};
    [m, t].forEach(function (w) { Object.keys(w.records).forEach(function (id) { ids[id] = true; }); Object.keys(w.tombstones).forEach(function (id) { out.tombstones[id] = out.tombstones[id] && out.tombstones[id] > w.tombstones[id] ? out.tombstones[id] : w.tombstones[id]; }); });
    Object.keys(ids).forEach(function (id) {
      if (out.tombstones[id]) return;
      var a = m.records[id], c = t.records[id], was = b.records[id];
      if (was && !c && (!a || a.at === was.at)) return; /* the other tab dropped it since the shared base (Delete everything, a replacing restore): it stays gone */
      if (a && c) out.records[id] = c.at > a.at ? c : a; else out.records[id] = a || c;
    });
    var keys = {}; [m.settings, b.settings, t.settings].forEach(function (o) { Object.keys(o).forEach(function (k) { keys[k] = true; }); });
    Object.keys(keys).forEach(function (k) { var v = JSON.stringify(m.settings[k]) !== JSON.stringify(b.settings[k]) ? m.settings[k] : t.settings[k]; if (v !== undefined) out.settings[k] = v; });
    return out;
  }
  /* old tombstones and records far in the past leave the copy before a write; nothing shown today is affected */
  function prune(w, today) {
    var out = clean(w), cut = addDays(today, -KEEP_DAYS), tcut = new Date(Date.parse(today + 'T00:00:00') - TOMB_DAYS * 86400000).toISOString();
    Object.keys(out.records).forEach(function (id) { if (out.records[id].date < cut) delete out.records[id]; });
    Object.keys(out.tombstones).forEach(function (id) { if (out.tombstones[id] < tcut) delete out.tombstones[id]; });
    return out;
  }
  function addDays(dateStr, n) { var d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* ---------- reading ---------- */
  function current() { var st = S() ? S().state() : null; return clean(st && st.water); }
  function recordsOn(w, date) { return Object.keys(w.records).map(function (id) { return w.records[id]; }).filter(function (r) { return r.date === date; }).sort(function (a, b) { return a.at < b.at ? -1 : 1; }); }
  function dayTotal(date, w) { w = w || current(); return recordsOn(w, date).reduce(function (a, r) { return a + r.ml; }, 0); }
  function dayCount(date, w) { w = w || current(); return recordsOn(w, date).length; }
  function fmtMl(ml) { return ml >= 1000 ? (Math.round(ml / 100) / 10) + ' L' : ml + ' ml'; }
  /* which information shows: the answers decide this and nothing else; not sure counts as a care-team line */
  function mode(settings, profile) {
    var s = cleanSettings(settings), a = s.answers;
    if (!a) return s.declined ? 'general' : 'unknown';
    if (['kidney', 'heart', 'advice'].some(function (k) { return a[k] === 'yes' || a[k] === 'unsure'; })) return 'care';
    if (a.preg === 'yes' || a.preg === 'unsure' || s.bf) return 'preg';
    return 'general';
  }
  function infoLines(m) { return INFO[m === 'unknown' ? 'general' : m] || INFO.general; }

  /* ---------- writing: one commit, the rewards ledger in the same save ---------- */
  function uid() { return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  function write(next, award) {
    var st = S(), today = st.today(), patch = { water: prune(next, today) };
    if (award && RW() && RW().recordWith) return RW().recordWith('water', patch); /* the first record of the real day earns its logging hearts, in the same save */
    if (st.commit) st.commit(patch); else st.setState(patch);
    return { points: 0 };
  }
  /* a record for a date: today's first record earns; another day's, or a date in the future, never does */
  function add(ml, date) {
    var st = S(), n = validMl(ml); if (!n) throw new Error('Choose an amount between 1 and ' + MAX_ML + ' ml.');
    date = date || st.today(); if (!validDate(date)) throw new Error('That is not a date.');
    if (date > st.today()) throw new Error('Water cannot be recorded for a day that has not come.');
    var w = current(), id = uid(); w.records[id] = { id: id, date: date, ml: n, at: new Date().toISOString() };
    var r = write(w, date === st.today()); return { id: id, ml: n, date: date, points: r.points || 0, hearts: r.hearts };
  }
  function remove(id) {
    var w = current(); if (!w.records[id]) return false;
    delete w.records[id]; w.tombstones[id] = new Date().toISOString(); write(w, false); return true;
  }
  function saveSettings(patch) {
    var w = current(), s = Object.assign({}, w.settings);
    if (patch.answers) { s.answers = {}; QUESTIONS.forEach(function (q) { var v = patch.answers[q.key]; if (v === 'yes' || v === 'no' || v === 'unsure') s.answers[q.key] = v; }); s.declined = false; s.at = new Date().toISOString(); }
    if (patch.declined === true) { delete s.answers; s.declined = true; s.at = new Date().toISOString(); }
    if (typeof patch.bf === 'boolean') s.bf = patch.bf;
    if (typeof patch.hideNumbers === 'boolean') s.hideNumbers = patch.hideNumbers;
    if (patch.legacyImported === true) s.legacyImported = true;
    w.settings = cleanSettings(s); write(w, false); return w.settings;
  }
  /* a backup restored through the journal: records merged by id, tombstones kept, never a heart; answers older than the restore are asked again */
  function restore(fileWater) {
    if (!fileWater || typeof fileWater !== 'object') return { restored: 0 };
    var theirs = clean(fileWater), mine = current(), before = Object.keys(mine.records).length, next = merge(mine, mine, theirs);
    next.settings = Object.assign({}, mine.settings); /* this phone's answers stay; a backup never brings screening answers */
    write(next, false); return { restored: Math.max(0, Object.keys(current().records).length - before) };
  }
  /* the old hydration page's log (ov_hydro: { log: [{ ml, at }] } or similar), brought in once; nothing earns */
  function importLegacy() {
    var w = current(); if (w.settings.legacyImported) return { imported: 0, done: true };
    var raw = null; try { raw = JSON.parse(root.localStorage.getItem('ov_hydro') || 'null'); } catch (e) { raw = null; }
    var list = [], n = 0;
    if (raw && typeof raw === 'object') { ['log', 'entries', 'history', 'records'].forEach(function (k) { if (Array.isArray(raw[k])) list = list.concat(raw[k]); }); if (raw.days && typeof raw.days === 'object') Object.keys(raw.days).forEach(function (d) { var v = raw.days[d]; if (typeof v === 'number') list.push({ ml: v, at: d + 'T12:00:00' }); else if (Array.isArray(v)) v.forEach(function (x) { list.push(Object.assign({ at: d + 'T12:00:00' }, x)); }); }); }
    list.forEach(function (x) { var ml = validMl(x && (x.ml || x.amount || x.volume)), at = validIso(x && (x.at || x.time || x.ts)); if (!ml || !at) return; var d = new Date(at), date = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); var id = 'legacy_' + Math.abs(hash(date + ml + at)); if (w.records[id] || w.tombstones[id]) return; w.records[id] = { id: id, date: date, ml: ml, at: d.toISOString() }; n++; });
    w.settings.legacyImported = true; write(w, false); return { imported: n, done: true };
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  /* ---------- the strip in the food diary's Today pane ---------- */
  var date = null;
  function setDate(d) { date = d; renderStrip(); }
  function infoHTML(m) {
    var lines = infoLines(m);
    return '<details class="winfo"><summary><span class="ms" aria-hidden="true">info</span>' + (m === 'care' ? 'For you: your care team’s advice comes first' : 'General drinking information') + '</summary>' +
      lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') +
      (m === 'care' ? '<p><a href="' + CARE_LINK + '" target="_blank" rel="noopener">HealthHub on fluids with heart failure</a> (NHG Health): the amount there is a total of every drink, soup and medicine water, which this plain-water log cannot show.</p>' : '') +
      '<p class="evid">' + EVIDENCE.map(function (e) { return '<a href="evidence.html#' + e + '">' + e + '</a>'; }).join(' ') + '</p></details>';
  }
  function stripHTML(d) {
    d = d || (S() && S().today()); var st = S(), w = current(), s = w.settings, m = mode(s, st.profile()), recs = recordsOn(w, d), total = recs.reduce(function (a, r) { return a + r.ml; }, 0), today = d === st.today(), hide = !!s.hideNumbers;
    var h = '<div class="wstrip' + (m === 'care' ? ' care' : '') + '"><div class="whead"><span class="ms" aria-hidden="true">water_full</span><div><b>Water recorded ' + (today ? 'today' : 'that day') + ': ' + (hide ? (recs.length + (recs.length === 1 ? ' record' : ' records')) : esc(fmtMl(total))) + '</b><small>' + (recs.length ? recs.length + (recs.length === 1 ? ' record' : ' records') + (hide ? '' : ', plain water') : 'Nothing recorded ' + (today ? 'yet' : 'that day')) + '</small></div></div>';
    h += '<div class="wadd"><span class="lbl">Add water you already drank</span><div class="row wrow">' + QUICK.map(function (q) { return '<button type="button" class="btn soft small" data-water="add" data-ml="' + q[0] + '">' + q[0] + ' ml<small>' + q[1] + '</small></button>'; }).join('') + '<button type="button" class="btn ghost small" data-water="other">Other amount</button></div></div>';
    if (recs.length) h += '<ul class="wlist">' + recs.map(function (r) { var t = new Date(r.at); return '<li><span>' + (hide ? 'Water' : esc(fmtMl(r.ml))) + ' <small>' + pad(t.getHours()) + ':' + pad(t.getMinutes()) + '</small></span><button type="button" class="btn ghost small" data-water="remove" data-id="' + esc(r.id) + '">Remove</button></li>'; }).join('') + '</ul>';
    if (m === 'unknown') h += '<p class="help wask">Four short questions choose which information shows here; nothing else changes, and you can skip them. <button type="button" class="linkbtn" data-water="questions">Answer</button> <button type="button" class="linkbtn" data-water="decline">Skip</button></p>';
    h += infoHTML(m);
    h += '<p class="help muted">Saved on this device. Water records are not included in cloud backup yet. ' + (m !== 'unknown' ? '<button type="button" class="linkbtn" data-water="questions">Answer the questions again</button>' : '') + (hide ? ' <button type="button" class="linkbtn" data-water="numbers">Show amounts</button>' : ' <button type="button" class="linkbtn" data-water="hide">Hide amounts</button>') + '</p>';
    if (!s.legacyImported && hasLegacy()) h += '<p class="help"><button type="button" class="linkbtn" data-water="legacy">Bring in old water records</button> from the earlier water page, once.</p>';
    return h + '</div>';
  }
  function hasLegacy() { try { return !!root.localStorage.getItem('ov_hydro'); } catch (e) { return false; } }
  function renderStrip() { var doc = root.document, box = doc && doc.getElementById('waterStrip'); if (!box) return; box.innerHTML = stripHTML(date); }
  function toast(msg, icon) { try { R().toast(msg, icon); } catch (e) { } }
  function sheet(id, title, sub, icon, html, wire) { var r = R(); if (!r || !r.openSheet) return; r.openSheet(id, title, sub, icon, html); if (wire) wire(root.document); }
  function reopenDiary() { var r = R(); if (r && r.openDiary) r.openDiary('today'); }
  function openQuestions() {
    var w = current(), cur = (w.settings.answers) || {};
    var h = '<p class="help">These choose which information shows under your water records. Nothing else changes: not the records, not the hearts. Not sure is kept as not sure.</p>' +
      QUESTIONS.map(function (q) { return '<div class="field wq" data-q="' + q.key + '"><span class="lbl">' + esc(q.text) + '</span><div class="chips">' + ['yes', 'no', 'unsure'].map(function (v) { return '<button type="button" class="chipbtn' + (cur[q.key] === v ? ' on' : '') + '" data-v="' + v + '">' + (v === 'unsure' ? 'Not sure' : v === 'yes' ? 'Yes' : 'No') + '</button>'; }).join('') + '</div></div>'; }).join('') +
      '<label class="wbf"><input type="checkbox" id="wqBf"' + (w.settings.bf ? ' checked' : '') + '> Breastfeeding now</label>' +
      '<div class="row"><button type="button" class="btn primary" id="wqSave"><span class="ms">check</span>Save</button><button type="button" class="btn ghost" id="wqSkip">Skip the questions</button></div><p class="help" id="wqMsg" hidden></p>';
    sheet('waterQ', 'Water', 'Which information fits you', 'water_full', h, function (d) {
      d.querySelectorAll('.wq .chips').forEach(function (c) { c.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; c.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); }); });
      d.getElementById('wqSave').addEventListener('click', function () {
        var answers = {}; d.querySelectorAll('.wq').forEach(function (q) { var on = q.querySelector('button.on'); if (on) answers[q.dataset.q] = on.dataset.v; });
        try { saveSettings({ answers: answers, bf: !!d.getElementById('wqBf').checked }); toast('Saved. The information under your water records now fits your answers.', 'water_full'); refresh(); reopenDiary(); }
        catch (e) { var m = d.getElementById('wqMsg'); m.hidden = false; m.textContent = 'That could not be saved: ' + e.message; }
      });
      d.getElementById('wqSkip').addEventListener('click', function () { try { saveSettings({ declined: true, bf: !!d.getElementById('wqBf').checked }); } catch (e) { } refresh(); reopenDiary(); });
    });
  }
  function openOther() {
    var h = '<div class="field"><label for="wOther">Millilitres</label><input class="input" id="wOther" type="number" inputmode="numeric" min="1" max="' + MAX_ML + '" step="10" placeholder="e.g. 330"></div><div class="row"><button type="button" class="btn primary" id="wOtherSave"><span class="ms">check</span>Add</button><button type="button" class="btn ghost" id="wOtherCancel">Cancel</button></div><p class="help" id="wOtherMsg" hidden></p>';
    sheet('waterOther', 'Add water', 'Water you already drank', 'water_full', h, function (d) {
      d.getElementById('wOtherCancel').addEventListener('click', reopenDiary);
      d.getElementById('wOtherSave').addEventListener('click', function () {
        try { var r = add(d.getElementById('wOther').value, date); toast(fmtMl(r.ml) + ' recorded.' + (r.points ? ' +' + r.points + ' hearts for today’s first record.' : ''), 'water_full'); reopenDiary(); }
        catch (e) { var m = d.getElementById('wOtherMsg'); m.hidden = false; m.textContent = e.message; }
      });
    });
  }
  function onClick(e) {
    var b = e.target.closest('[data-water]'); if (!b) return false;
    var act = b.dataset.water;
    try {
      if (act === 'add') { if (R() && R().asleep && R().asleep()) { toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); return true; } var r = add(b.dataset.ml, date); toast(fmtMl(r.ml) + ' recorded.' + (r.points ? ' +' + r.points + ' hearts for today’s first record.' : ''), 'water_full'); refresh(); }
      else if (act === 'other') openOther();
      else if (act === 'remove') { if (root.confirm && !root.confirm('Remove this water record?')) return true; remove(b.dataset.id); refresh(); }
      else if (act === 'questions') openQuestions();
      else if (act === 'decline') { saveSettings({ declined: true }); refresh(); }
      else if (act === 'hide') { saveSettings({ hideNumbers: true }); refresh(); }
      else if (act === 'numbers') { saveSettings({ hideNumbers: false }); refresh(); }
      else if (act === 'legacy') { var res = importLegacy(); toast(res.imported ? res.imported + ' old water records brought in. They earn nothing.' : 'No old water records were found.', 'water_full'); refresh(); }
    } catch (err) { toast('That could not be saved: ' + err.message, 'error'); renderStrip(); }
    return true;
  }
  /* every change she makes redraws the strip and the deck: the Water tile reads the same settings (Hide amounts) and records */
  function refresh() { renderStrip(); var r = R(); if (r && r.renderDeck) r.renderDeck(); }
  var refreshTimer = 0;
  function scheduleRefresh() { root.clearTimeout(refreshTimer); refreshTimer = root.setTimeout(renderStrip, 120); }
  function wire() {
    var st = S();
    if (st && st.registerMerge && !wire.merge) { wire.merge = true; st.registerMerge('water', merge); } /* two tabs: records merge by id inside the store's own merge */
    var doc = root.document; if (!doc || typeof doc.getElementById !== 'function') return; /* the node harness has no strip to draw and no timers to leave behind */
    if (st && st.subscribe && !wire.sub) { wire.sub = true; st.subscribe(function () { scheduleRefresh(); }); }
    if (!wire.vis) { wire.vis = true; doc.addEventListener('visibilitychange', function () { if (!doc.hidden) scheduleRefresh(); }); }
  }
  if (root.document) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', wire); else wire(); } else wire();

  root.OvuWater = { MAX_ML: MAX_ML, QUICK: QUICK, QUESTIONS: QUESTIONS, INFO: INFO, EVIDENCE: EVIDENCE, CARE_LINK: CARE_LINK,
    validMl: validMl, validDate: validDate, clean: clean, merge: merge, prune: prune, empty: empty, cleanSettings: cleanSettings,
    current: current, recordsOn: recordsOn, dayTotal: dayTotal, dayCount: dayCount, fmtMl: fmtMl, mode: mode, infoLines: infoLines,
    add: add, remove: remove, saveSettings: saveSettings, restore: restore, importLegacy: importLegacy, hasLegacy: hasLegacy,
    stripHTML: stripHTML, renderStrip: renderStrip, setDate: setDate, onClick: onClick, openQuestions: openQuestions, openOther: openOther, wire: wire };
})(typeof window !== 'undefined' ? window : this);
