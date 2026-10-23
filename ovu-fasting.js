/* Rhythme fasting timing (Jamie, 21 Oct 2026: "For the food diary I want to track fasting timing as well").
 * Two things kept apart, both behind one switch she turns on after a short eligibility step: a record of when a fast
 * began and ended, and a plain reading of the gaps between her timed food entries. Nothing counts up while she fasts,
 * nothing is a target, nothing is a streak, nothing earns a heart. The shape follows docs/design/2026-10-21-fasting-timing.md
 * (v2, after a Codex design review). Records live in state.fasting on this phone (no new diary type, no cloud sync in
 * this version). Pure parts first (tested in node), then the sheets. */
(function (root) {
  'use strict';
  var MAX_NOTE = 200, FORGOTTEN_H = 72, AT_MEAL_MIN = 90, MAX_BACK_DAYS = 30;
  var CARE = 'Fasting is not for pregnancy or breastfeeding, for anyone with diabetes medicines that can cause low blood sugar, under 18, or with a history of disordered eating. Stop and eat if you feel faint, shaky, sweaty or confused. With diabetes, treat a low as your care team has shown you. Severe confusion, a fit, fainting that does not pass or trouble swallowing: call your local emergency number.';
  var EVIDENCE = ['E81', 'E82', 'E83', 'E84', 'E85', 'E86', 'E87', 'E88', 'E89', 'E90'];
  function S() { return root.OvuStore; }
  function R() { return root.OvuRoom; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  /* ---------- time, kept literal ---------- */
  function minutesOf(hm) { var m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hm || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
  function hmOf(min) { min = ((min % 1440) + 1440) % 1440; return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function validDate(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !isNaN(new Date(d + 'T12:00:00').getTime()); }
  function dateOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(dateStr, n) { var d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return dateOf(d); }
  /* the instant for a local date and clock time on this device, with the offset it had */
  function instant(dateStr, hm) {
    var min = minutesOf(hm); if (!validDate(dateStr) || min === null) return null;
    var d = new Date(dateStr + 'T' + hm + ':00'); if (isNaN(d.getTime())) return null;
    return { at: d.toISOString(), offset: -d.getTimezoneOffset(), local: dateStr + 'T' + hm };
  }
  function localOf(iso) { var d = new Date(iso); if (isNaN(d.getTime())) return null; return { date: dateOf(d), time: pad(d.getHours()) + ':' + pad(d.getMinutes()), min: d.getHours() * 60 + d.getMinutes() }; }
  function fmtMin(min) { if (min === null || min === undefined || !isFinite(min)) return ''; var h = Math.floor(min / 60), m = Math.round(min - h * 60); if (m === 60) { h += 1; m = 0; } return h ? h + ' h' + (m ? ' ' + m + ' m' : '') : m + ' m'; }
  function fmtMs(ms) { return fmtMin(Math.round(ms / 60000)); }

  /* ---------- which food times count (design section 5) ---------- */
  function timeStatus(e) {
    if (!e || e.type !== 'food' || !e.data) return 'none';
    var min = minutesOf(e.data.time); if (min === null) return 'none';
    if (e.data.timeSet === true) return 'confirmed';
    var c = e.createdAt ? localOf(e.createdAt) : null; /* logged at the meal: saved on the same date within 90 minutes of its time */
    if (c && c.date === e.date && Math.abs(c.min - min) <= AT_MEAL_MIN) return 'confirmed';
    return 'unconfirmed';
  }
  function confirmedMinutes(e) { return timeStatus(e) === 'confirmed' ? minutesOf(e.data.time) : null; }
  /* one calendar day: the confirmed times, distinct and sorted; a span only with two distinct times */
  function dayTimes(entries, date) {
    var mins = [], untimed = 0, unconfirmed = 0;
    (entries || []).forEach(function (e) {
      if (!e || e.type !== 'food' || e.date !== date) return;
      var st = timeStatus(e); if (st === 'none') untimed++; else if (st === 'unconfirmed') unconfirmed++; else { var m = minutesOf(e.data.time); if (mins.indexOf(m) < 0) mins.push(m); }
    });
    mins.sort(function (a, b) { return a - b; });
    return { date: date, times: mins, first: mins.length ? mins[0] : null, last: mins.length ? mins[mins.length - 1] : null, span: mins.length >= 2 ? mins[mins.length - 1] - mins[0] : null, count: mins.length, untimed: untimed, unconfirmed: unconfirmed };
  }
  /* the gap from the previous calendar day's last confirmed entry to this day's first; the previous day may lie outside any displayed range */
  function gapFromPrevious(entries, date) {
    var today = dayTimes(entries, date), prev = dayTimes(entries, addDays(date, -1));
    if (today.first === null || prev.last === null) return null;
    return (1440 - prev.last) + today.first;
  }
  function median(xs) { if (!xs.length) return null; var s = xs.slice().sort(function (a, b) { return a - b; }), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
  /* the period's medians, each on its own, over the days with two or more confirmed times; the denominator is shown */
  function summary(entries, from, to) {
    var firsts = [], lasts = [], spans = [], days = 0, eligible = 0;
    for (var d = from; d <= to; d = addDays(d, 1)) { days++; var t = dayTimes(entries, d); if (t.count >= 2) { eligible++; firsts.push(t.first); lasts.push(t.last); spans.push(t.span); } if (days > 400) break; }
    return { days: days, eligible: eligible, medianFirst: median(firsts), medianLast: median(lasts), medianSpan: median(spans) };
  }

  /* ---------- records ---------- */
  function fasting() { var st = S() ? (S().state().fasting || null) : null; return st && typeof st === 'object' ? st : { on: false, elig: null, records: [] }; }
  function records() { var f = fasting(); return Array.isArray(f.records) ? f.records.filter(function (r) { return r && typeof r === 'object' && r.id; }) : []; }
  function write(patch) { var cur = fasting(), next = Object.assign({}, cur, patch); S().setState({ fasting: next }); return next; }
  function uid() { return 'fast_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); }
  /* a clean record or a thrown reason: literal times, an end after the start, nothing in the future, nothing from long ago */
  function validateRecord(rec, now) {
    now = now || new Date(); if (!rec || typeof rec !== 'object') throw new Error('Not a fasting record.');
    var start = typeof rec.startLocal === 'string' ? rec.startLocal.split('T') : null; if (!start || start.length !== 2) throw new Error('Choose a real start date and time.');
    var si = instant(start[0], start[1]); if (!si) throw new Error('Choose a real start date and time.');
    if (new Date(si.at).getTime() > now.getTime() + 60000) throw new Error('A fast cannot start in the future.');
    if (now.getTime() - new Date(si.at).getTime() > MAX_BACK_DAYS * 86400000) throw new Error('A start more than 30 days ago is not kept here; log it as a note instead.');
    var out = { id: typeof rec.id === 'string' && rec.id ? rec.id : uid(), startAt: si.at, startOffset: si.offset, startLocal: si.local, endAt: null, endOffset: null, endLocal: null, note: '', createdAt: rec.createdAt || now.toISOString(), updatedAt: now.toISOString() };
    if (rec.endLocal) {
      var end = typeof rec.endLocal === 'string' ? rec.endLocal.split('T') : null; if (!end || end.length !== 2) throw new Error('Choose a real end date and time.');
      var ei = instant(end[0], end[1]); if (!ei) throw new Error('Choose a real end date and time.');
      if (new Date(ei.at).getTime() <= new Date(si.at).getTime()) throw new Error('The end must come after the start.');
      if (new Date(ei.at).getTime() > now.getTime() + 60000) throw new Error('An end cannot be in the future.');
      out.endAt = ei.at; out.endOffset = ei.offset; out.endLocal = ei.local;
    }
    if (rec.note !== undefined && rec.note !== null) { if (typeof rec.note !== 'string') throw new Error('The note must be text.'); out.note = rec.note.trim().slice(0, MAX_NOTE); }
    return out;
  }
  function openRecords(list) { return (list || records()).filter(function (r) { return r && !r.endAt; }); }
  function conflict(list) { return openRecords(list).length > 1; }
  function forgotten(rec, now) { now = now || new Date(); return !!(rec && !rec.endAt && now.getTime() - new Date(rec.startAt).getTime() > FORGOTTEN_H * 3600000); }
  function lengthMs(rec) { return rec && rec.endAt ? new Date(rec.endAt).getTime() - new Date(rec.startAt).getTime() : null; }
  function saveRecord(rec) { var clean = validateRecord(rec), list = records().filter(function (r) { return r.id !== clean.id; }); list.push(clean); list.sort(function (a, b) { return a.startAt < b.startAt ? 1 : -1; }); write({ records: list }); return clean; }
  function deleteRecord(id) { write({ records: records().filter(function (r) { return r.id !== id; }) }); }

  /* ---------- eligibility (design section 3): every answer no, or the record control stays closed ---------- */
  var QUESTIONS = [
    { key: 'preg', text: 'Could you be pregnant, are you pregnant, or did you give birth in the last year?' },
    { key: 'bf', text: 'Are you breastfeeding?' },
    { key: 'dm', text: 'Do you take insulin, or any medicine for diabetes or blood sugar?' },
    { key: 'ed', text: 'Have you ever had an eating disorder, or eating you would call restrictive?' },
    { key: 'weight', text: 'Have you lost weight without meaning to, been told you are underweight, or are you under 18?' }
  ];
  /* the intro's own answers win where they say yes; trying to conceive is a precaution, not a diagnosis */
  function prefill(profile) {
    var p = profile || {}, out = {};
    if (p.pregState === 'pregnant' || p.pregState === 'maybe' || p.pregState === 'postpartum') out.preg = 'yes';
    if (p.breastfeeding === 'yes') out.bf = 'yes';
    if ((p.signals || []).indexOf('restrict') > -1) out.ed = 'yes';
    if (p.ageBand === 'under18' || p.minorAck === 'yes' || p.minorAck === true) out.weight = 'yes';
    return out;
  }
  function eligible(answers, profile) {
    var a = Object.assign({}, answers || {}, prefill(profile)), reasons = [], unknown = [];
    QUESTIONS.forEach(function (q) { var v = a[q.key]; if (v === 'yes') reasons.push(q.key); else if (v !== 'no') unknown.push(q.key); });
    var ttc = !!(profile && profile.plans === 'ttc');
    return { ok: reasons.length === 0 && unknown.length === 0 && !ttc, reasons: reasons, unknown: unknown, ttc: ttc, answers: a, locked: Object.keys(prefill(profile)) };
  }
  function reasonText(el) {
    if (el.ok) return '';
    if (el.ttc && !el.reasons.length && !el.unknown.length) return 'While you are trying to conceive, Rhythme keeps the fasting record closed as a precaution (a product choice, not a medical rule). The food diary works as usual.';
    var why = { preg: 'pregnancy, possible pregnancy or the year after a birth', bf: 'breastfeeding', dm: 'diabetes or blood sugar medicines', ed: 'a history of disordered or restrictive eating', weight: 'unintended weight loss, being underweight or being under 18' };
    var parts = el.reasons.map(function (k) { return why[k]; }), un = el.unknown.map(function (k) { return why[k]; });
    return 'The fasting record stays closed' + (parts.length ? ' because of ' + parts.join(', ') : '') + (un.length ? (parts.length ? ', and' : '') + ' while an answer is not sure (' + un.join(', ') + ')' : '') + '. The food diary works as usual. If something changes, you can answer again here.';
  }

  /* ---------- the meal offer: only a meal today with a confirmed time after the record's start ---------- */
  function offerFor(meal, rec, today) {
    if (!meal || !rec || rec.endAt || !meal.data) return null;
    if (meal.date !== (today || dateOf(new Date()))) return null;
    if (timeStatus(meal) !== 'confirmed') return null;
    var at = instant(meal.date, meal.data.time); if (!at || new Date(at.at).getTime() <= new Date(rec.startAt).getTime()) return null;
    return { recordId: rec.id, recordUpdatedAt: rec.updatedAt, mealId: meal.id, mealUpdatedAt: meal.updatedAt, endLocal: at.local, time: meal.data.time };
  }
  var pendingOffer = null;
  function onMealSaved(ev) {
    if (!fasting().on) return; var open = openRecords(); if (open.length !== 1) return;
    pendingOffer = offerFor(ev, open[0]); renderStrip();
  }
  /* an offer is shown only while the meal and the record are as they were */
  function liveOffer() {
    if (!pendingOffer) return null;
    var rec = records().filter(function (r) { return r.id === pendingOffer.recordId; })[0], meal = S().get ? S().get(pendingOffer.mealId) : null;
    if (!rec || rec.endAt || rec.updatedAt !== pendingOffer.recordUpdatedAt || !meal || meal.updatedAt !== pendingOffer.mealUpdatedAt) { pendingOffer = null; return null; }
    return pendingOffer;
  }

  /* ---------- what she sees in the food sheet (today pane) ---------- */
  function gapsHTML(date) {
    var evs = S().list('food', { from: addDays(date, -1), to: date }), t = dayTimes(evs, date), gap = gapFromPrevious(evs, date), bits = [];
    if (t.count >= 2) bits.push('Timed food entries ' + (date === S().today() ? 'today' : 'that day') + ': first ' + hmOf(t.first) + ', last ' + hmOf(t.last) + ', ' + fmtMin(t.span) + ' apart.');
    else if (t.count === 1) bits.push('One timed food entry so far (' + hmOf(t.first) + '); a span needs two.');
    else bits.push('No timed food entries ' + (date === S().today() ? 'yet today' : 'that day') + '.');
    if (gap !== null) bits.push('Gap since yesterday’s last timed entry: ' + fmtMin(gap) + '.');
    if (t.untimed || t.unconfirmed) bits.push((t.untimed ? t.untimed + ' without a time' : '') + (t.untimed && t.unconfirmed ? ', ' : '') + (t.unconfirmed ? t.unconfirmed + ' with a time not confirmed' : '') + ', left out.');
    return '<p class="help fgaps">' + esc(bits.join(' ')) + ' <span class="muted">Entries, not measured fasting.</span></p>';
  }
  function recordHTML() {
    var open = openRecords(), now = new Date(), h = '';
    if (open.length > 1) {
      h += '<div class="fconflict"><b>Two fasting records are open.</b> End or delete one; nothing is chosen for you.' + open.map(function (r) { return '<div class="frow"><span>Open since ' + esc(whenText(r.startLocal)) + '</span><button type="button" class="btn ghost small" data-fast="end" data-id="' + esc(r.id) + '">End</button><button type="button" class="btn ghost small" data-fast="delete" data-id="' + esc(r.id) + '">Delete</button></div>'; }).join('') + '</div>';
      return h;
    }
    if (open.length === 1) {
      var r = open[0], off = liveOffer();
      if (forgotten(r, now)) h += '<p class="fopen"><b>Fasting record open since ' + esc(whenText(r.startLocal)) + '</b>, which is probably forgotten. End it at a time, or delete it.</p>';
      else h += '<p class="fopen"><b>Fasting record open since ' + esc(whenText(r.startLocal)) + '.</b></p>';
      if (off) h += '<div class="foffer"><span>End the fasting record at this meal’s time (' + esc(off.time) + ')?</span><div class="row"><button type="button" class="btn primary small" data-fast="end-at-meal">End record</button><button type="button" class="btn ghost small" data-fast="leave">Leave unchanged</button></div></div>';
      h += '<div class="row"><button type="button" class="btn soft small" data-fast="end" data-id="' + esc(r.id) + '"><span class="ms" aria-hidden="true">stop_circle</span>End record</button><button type="button" class="btn ghost small" data-fast="delete" data-id="' + esc(r.id) + '">Delete</button></div>';
      return h;
    }
    h += '<div class="row"><button type="button" class="btn soft small" data-fast="start"><span class="ms" aria-hidden="true">play_circle</span>Start a fasting record</button></div>';
    return h;
  }
  function whenText(local) { var p = String(local || '').split('T'); if (p.length !== 2) return local; var today = S().today(); return p[1] + (p[0] === today ? '' : p[0] === addDays(today, -1) ? ' yesterday' : ' on ' + p[0]); }
  function historyHTML(limit) {
    var done = records().filter(function (r) { return r.endAt; }).slice(0, limit || 6);
    if (!done.length) return '';
    return '<div class="fhist"><span class="lbl">Past records</span>' + done.map(function (r) { return '<div class="frow"><span>' + esc(whenText(r.startLocal)) + ' to ' + esc(whenText(r.endLocal)) + ' · ' + esc(fmtMs(lengthMs(r))) + (r.note ? ' · ' + esc(r.note) : '') + '</span><button type="button" class="btn ghost small" data-fast="edit" data-id="' + esc(r.id) + '">Edit</button><button type="button" class="btn ghost small" data-fast="delete" data-id="' + esc(r.id) + '">Delete</button></div>'; }).join('') + '</div>';
  }
  function careHTML() { return '<p class="help fcare">' + esc(CARE) + ' <span class="evid">' + EVIDENCE.map(function (e) { return '<a href="evidence.html#' + e + '">' + e + '</a>'; }).join(' ') + '</span></p>'; }
  function stripHTML() {
    var f = fasting();
    if (!f.on) return '<div class="fstrip off"><span class="lbl">Fasting timing: off</span><div class="row"><button type="button" class="btn ghost small" data-fast="turn-on"><span class="ms" aria-hidden="true">timer_off</span>Turn on</button></div><p class="help">A record of when a fast began and ended, and the gaps between your timed food entries. It asks five questions first.</p></div>';
    var el = eligible(f.elig && f.elig.answers, S().profile()), h = '<div class="fstrip on"><span class="lbl">Fasting timing</span>';
    if (el.ok) h += recordHTML(); else h += '<p class="help freason">' + esc(reasonText(el)) + '</p><div class="row"><button type="button" class="btn ghost small" data-fast="answer">Answer again</button></div>';
    h += gapsHTML(S().today()) + historyHTML(6) + careHTML();
    h += '<p class="help muted">Records stay on this phone. They are in your diary export and go with Delete everything.</p>';
    h += '<div class="row"><button type="button" class="btn ghost small" data-fast="hide">Hide fasting</button></div></div>';
    return h;
  }
  function renderStrip() { var d = root.document, box = d && d.getElementById('fastStrip'); if (!box) return; box.innerHTML = stripHTML(); }

  /* ---------- the small sheets (eligibility, start, end, edit) ---------- */
  var sheetWas = null;
  function sheet(id, title, sub, html, wire) { var r = R(); if (!r || !r.openSheet) return; r.openSheet(id, title, sub, 'timer', html); var d = root.document; if (wire) wire(d); }
  function reopenDiary() { var r = R(); if (r && r.openDiary) { r.openDiary('today'); return; } if (r && r.tap && r.hotspot) { var h = r.hotspot('fridge') || r.hotspot('table'); if (h) r.tap(h); } }
  function openEligibility() {
    var f = fasting(), pre = prefill(S().profile()), cur = Object.assign({}, (f.elig && f.elig.answers) || {}, pre);
    var h = '<p class="help">Five questions, so the record is offered only where fasting is not advised against. Not sure counts as not yet.</p>' +
      QUESTIONS.map(function (q) { var locked = pre[q.key] !== undefined; return '<div class="field fq" data-q="' + q.key + '"><span class="lbl">' + esc(q.text) + (locked ? ' <small>(from your intro)</small>' : '') + '</span><div class="chips">' + ['yes', 'no', 'unsure'].map(function (v) { return '<button type="button" class="chipbtn' + (cur[q.key] === v ? ' on' : '') + '" data-v="' + v + '"' + (locked ? ' disabled' : '') + '>' + (v === 'unsure' ? 'Not sure' : v === 'yes' ? 'Yes' : 'No') + '</button>'; }).join('') + '</div></div>'; }).join('') +
      '<div class="row"><button type="button" class="btn primary" id="fqSave"><span class="ms">check</span>Save answers</button><button type="button" class="btn ghost" id="fqCancel">Cancel</button></div>' + careHTML();
    sheet('fastElig', 'Fasting timing', 'Before the record opens', h, function (d) {
      d.querySelectorAll('.fq .chips').forEach(function (c) { c.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b || b.disabled) return; c.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); }); });
      d.getElementById('fqCancel').addEventListener('click', function () { reopenDiary(); });
      d.getElementById('fqSave').addEventListener('click', function () {
        var answers = {}; d.querySelectorAll('.fq').forEach(function (q) { var on = q.querySelector('button.on'); if (on) answers[q.dataset.q] = on.dataset.v; });
        write({ on: true, elig: { answers: answers, at: new Date().toISOString() } });
        var el = eligible(answers, S().profile()); try { R().toast(el.ok ? 'Fasting timing is on. The record control is in the food diary, under Today.' : 'Fasting timing is on for the gaps between entries; the record stays closed for now.', 'timer'); } catch (e) { }
        reopenDiary();
      });
    });
  }
  function timeFields(prefix, local) {
    var p = (local || '').split('T'), today = S().today(), date = p[0] || today, time = p[1] || (pad(new Date().getHours()) + ':' + pad(new Date().getMinutes()));
    return '<div class="grid2"><div class="field"><label for="' + prefix + 'Date">Date</label><input class="input" id="' + prefix + 'Date" type="date" value="' + esc(date) + '" max="' + today + '"></div><div class="field"><label for="' + prefix + 'Time">Time</label><input class="input" id="' + prefix + 'Time" type="time" value="' + esc(time) + '"></div></div>';
  }
  function readLocal(d, prefix) { return d.getElementById(prefix + 'Date').value + 'T' + d.getElementById(prefix + 'Time').value; }
  function openStart() {
    var h = '<p class="help">When did the fast begin? Now, or a time you remember, today or yesterday.</p>' + timeFields('fs', null) + '<div class="field"><label for="fsNote">Note (optional)</label><input class="input" id="fsNote" maxlength="' + MAX_NOTE + '" placeholder="e.g. after dinner"></div>' +
      '<div class="row"><button type="button" class="btn primary" id="fsSave"><span class="ms">check</span>Save start</button><button type="button" class="btn ghost" id="fsCancel">Cancel</button></div><p class="help" id="fsMsg" hidden></p>' + careHTML();
    sheet('fastStart', 'Start a fasting record', 'A start time, nothing counting', h, function (d) {
      d.getElementById('fsCancel').addEventListener('click', reopenDiary);
      d.getElementById('fsSave').addEventListener('click', function () {
        try {
          if (openRecords().length) throw new Error('A fasting record is already open. End it first.');
          var note = d.getElementById('fsNote').value; saveRecord({ startLocal: readLocal(d, 'fs'), note: note });
          noteCare(note); try { R().toast('Fasting record started. Nothing counts up; end it when you eat.', 'timer'); } catch (e) { }
          reopenDiary();
        } catch (e) { var m = d.getElementById('fsMsg'); m.hidden = false; m.textContent = e.message; }
      });
    });
  }
  function openEnd(id, presetLocal) {
    var rec = records().filter(function (r) { return r.id === id; })[0]; if (!rec) return;
    var h = '<p class="help">Open since ' + esc(whenText(rec.startLocal)) + '. When did it end?</p>' + timeFields('fe', presetLocal || null) +
      '<div class="row"><button type="button" class="btn primary" id="feSave"><span class="ms">check</span>Save end</button><button type="button" class="btn ghost" id="feCancel">Leave unchanged</button></div><p class="help" id="feMsg" hidden></p>';
    sheet('fastEnd', 'End the fasting record', 'The length is shown once it ends', h, function (d) {
      d.getElementById('feCancel').addEventListener('click', reopenDiary);
      d.getElementById('feSave').addEventListener('click', function () {
        try { var saved = saveRecord(Object.assign({}, rec, { endLocal: readLocal(d, 'fe') })); pendingOffer = null; try { R().toast('Fasting record ended: ' + fmtMs(lengthMs(saved)) + '.', 'timer'); } catch (e) { } reopenDiary(); }
        catch (e) { var m = d.getElementById('feMsg'); m.hidden = false; m.textContent = e.message; }
      });
    });
  }
  function openEdit(id) {
    var rec = records().filter(function (r) { return r.id === id; })[0]; if (!rec) return;
    var h = '<span class="lbl">Start</span>' + timeFields('es', rec.startLocal) + (rec.endLocal ? '<span class="lbl">End</span>' + timeFields('ee', rec.endLocal) : '') + '<div class="field"><label for="esNote">Note</label><input class="input" id="esNote" maxlength="' + MAX_NOTE + '" value="' + esc(rec.note || '') + '"></div>' +
      '<div class="row"><button type="button" class="btn primary" id="esSave"><span class="ms">check</span>Save changes</button><button type="button" class="btn ghost" id="esCancel">Cancel</button></div><p class="help" id="esMsg" hidden></p>';
    sheet('fastEdit', 'Edit the fasting record', 'Times as you remember them', h, function (d) {
      d.getElementById('esCancel').addEventListener('click', reopenDiary);
      d.getElementById('esSave').addEventListener('click', function () {
        try { saveRecord(Object.assign({}, rec, { startLocal: readLocal(d, 'es'), endLocal: rec.endLocal ? readLocal(d, 'ee') : null, note: d.getElementById('esNote').value })); try { R().toast('Fasting record updated.', 'timer'); } catch (e) { } reopenDiary(); }
        catch (e) { var m = d.getElementById('esMsg'); m.hidden = false; m.textContent = e.message; }
      });
    });
  }
  /* a note is read by the safety rules as any note would be; the feature claims nothing about what they know */
  function noteCare(note) {
    if (!note || !root.OvuOrb || !root.OvuOrb.urgent) return;
    try { var u = root.OvuOrb.urgent(note, S().profile()); if (u && R() && R().openSheet) R().openSheet('care', u.title || 'Please get care', u.trigger || '', 'emergency', '<div class="bub urgent' + (u.level === 'emergency' ? ' emergency' : '') + '"><b>' + esc(u.title || '') + '</b><p>' + esc(u.message || 'Please get medical advice now.') + '</p></div>'); } catch (e) { }
  }
  /* clicks inside the strip (delegated by the food sheet) */
  function onClick(e) {
    var b = e.target.closest('[data-fast]'); if (!b) return false;
    var act = b.dataset.fast, id = b.dataset.id;
    if (act === 'turn-on' || act === 'answer') openEligibility();
    else if (act === 'hide') { write({ on: false }); pendingOffer = null; renderStrip(); try { R().toast('Fasting timing hidden. Your records are kept.', 'timer'); } catch (x) { } }
    else if (act === 'start') { if (R() && R().asleep && R().asleep()) { try { R().toast('She is asleep. Tap the bed to wake her first.', 'bedtime'); } catch (x) { } return true; } openStart(); }
    else if (act === 'end') openEnd(id);
    else if (act === 'end-at-meal') { var off = liveOffer(); if (!off) { renderStrip(); return true; } try { var rec = records().filter(function (r) { return r.id === off.recordId; })[0]; var saved = saveRecord(Object.assign({}, rec, { endLocal: off.endLocal })); pendingOffer = null; try { R().toast('Meal saved. Fasting record ended: ' + fmtMs(lengthMs(saved)) + '.', 'timer'); } catch (x) { } } catch (err) { pendingOffer = null; try { R().toast('Meal saved; fasting record unchanged (' + err.message + ')', 'info'); } catch (x) { } } renderStrip(); }
    else if (act === 'leave') { pendingOffer = null; renderStrip(); }
    else if (act === 'edit') openEdit(id);
    else if (act === 'delete') { if (root.confirm && !root.confirm('Delete this fasting record? This cannot be undone.')) return true; deleteRecord(id); if (pendingOffer && pendingOffer.recordId === id) pendingOffer = null; renderStrip(); }
    return true;
  }

  /* ---------- the journal's block ---------- */
  function journalHTML(from, to) {
    var f = fasting(); if (!f.on) return '';
    var evs = S().list('food', { from: addDays(from, -1), to: to }), sm = summary(evs, from, to), done = records().filter(function (r) { return r.endAt && r.startLocal.slice(0, 10) >= from; });
    var h = '<div class="sechead"><span class="ms">timer</span><div><b>Fasting timing</b><small>Entries and records, not measured fasting</small></div></div>';
    if (sm.eligible) h += '<ul class="ilist"><li><span class="ms">schedule</span><span>Median first timed entry ' + hmOf(sm.medianFirst) + ', median last ' + hmOf(sm.medianLast) + ', across ' + sm.eligible + ' of ' + sm.days + ' days with two or more timed entries.</span></li><li><span class="ms">straighten</span><span>Median span between first and last timed entries: ' + esc(fmtMin(sm.medianSpan)) + ' (a separate median, not the gap between the two times above).</span></li></ul>';
    else h += '<p class="help">No day in this period has two timed food entries, so there is no span to show.</p>';
    if (done.length) h += '<ul class="ilist">' + done.slice(0, 12).map(function (r) { return '<li><span class="ms">timer</span><span>' + esc(r.startLocal.replace('T', ' ')) + ' to ' + esc(r.endLocal.replace('T', ' ')) + ' · ' + esc(fmtMs(lengthMs(r))) + (r.note ? ' · ' + esc(r.note) : '') + '</span></li>'; }).join('') + '</ul>';
    h += '<p class="help">Records are edited in the food diary, under Today. ' + esc(CARE) + '</p>';
    return '<div class="card fastingcard">' + h + '</div>';
  }

  root.OvuFasting = { QUESTIONS: QUESTIONS, CARE: CARE, EVIDENCE: EVIDENCE, MAX_NOTE: MAX_NOTE, FORGOTTEN_H: FORGOTTEN_H, AT_MEAL_MIN: AT_MEAL_MIN,
    minutesOf: minutesOf, hmOf: hmOf, instant: instant, localOf: localOf, fmtMin: fmtMin, addDays: addDays,
    timeStatus: timeStatus, confirmedMinutes: confirmedMinutes, dayTimes: dayTimes, gapFromPrevious: gapFromPrevious, median: median, summary: summary,
    validateRecord: validateRecord, openRecords: openRecords, conflict: conflict, forgotten: forgotten, lengthMs: lengthMs, prefill: prefill, eligible: eligible, reasonText: reasonText, offerFor: offerFor,
    fasting: fasting, records: records, saveRecord: saveRecord, deleteRecord: deleteRecord, onMealSaved: onMealSaved, liveOffer: liveOffer, stripHTML: stripHTML, renderStrip: renderStrip, onClick: onClick, journalHTML: journalHTML, openEligibility: openEligibility, openStart: openStart, openEnd: openEnd };
})(typeof window !== 'undefined' ? window : this);
