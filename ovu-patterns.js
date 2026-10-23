/* Cycles over time and the colour-coded month calendars, drawn the same way in the journal, the Doctor view and the
 * sample share. Input is plain data (OvuAgents.cycleHistory and OvuAgents.patternDays), so a decrypted share renders
 * without the patient's store. Display bins only, never a verdict: no normal or irregular badge, FIGO 2018 printed
 * as a reference (Codex design review, 20 Oct). Every mark has a length as well as a colour, every day has a spoken
 * label and a text detail, and nothing recorded stays visibly empty. */
(function (root) {
  'use strict';
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function pretty(iso, o) { return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, o || { day: 'numeric', month: 'short' }); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  var FLOW = { spotting: ['Spotting', 1], light: ['Light', 2], medium: ['Medium', 3], heavy: ['Heavy', 4], unspecified: ['Flow not recorded', 2] };
  var PAIN = ['pain 0', 'pain 1 to 3', 'pain 4 to 6', 'pain 7 to 10'];
  var SLEEP = ['under 6 h', '6 to under 7 h', '7 to 9 h', 'over 9 h'];

  /* ---------- cycles over time ---------- */
  function kpi(label, val, sub) { return '<div class="kpi"><small>' + esc(label) + '</small><b>' + val + '</b><span>' + esc(sub || '') + '</span></div>'; }
  function plot(rows) {
    var shown = rows.filter(function (r) { return r.interval !== null; });
    if (!shown.length) return '';
    var W = 300, H = 120, top = 70, n = shown.length, bw = Math.min(34, (W - 24) / n), y = function (d) { return H - Math.min(d, top) / top * H; };
    var svg = '<svg class="pplot" viewBox="0 0 ' + W + ' ' + (H + 20) + '" role="img" aria-label="' + esc('Days from one period start to the next: ' + shown.map(function (r) { return pretty(r.start) + ' ' + r.interval + ' days' + (r.counted ? '' : ' (a gap, not counted)'); }).join('; ')) + '">';
    svg += '<rect class="pband" x="0" y="' + y(38) + '" width="' + W + '" height="' + (y(24) - y(38)) + '"/>';
    shown.forEach(function (r, i) {
      var x = 24 + i * ((W - 24) / n) + ((W - 24) / n - bw) / 2, v = Math.min(r.interval, top);
      svg += '<rect class="' + (r.counted ? 'pbar' : 'pgap') + '" x="' + x.toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (H - y(v)).toFixed(1) + '" rx="3"><title>' + esc(pretty(r.start) + ': ' + r.interval + ' days' + (r.counted ? '' : ', a gap in the record')) + '</title></rect>';
      svg += '<text class="pval" x="' + (x + bw / 2).toFixed(1) + '" y="' + (y(v) - 3).toFixed(1) + '" text-anchor="middle">' + r.interval + '</text>';
      svg += '<text class="pax" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H + 14) + '" text-anchor="middle">' + esc(pretty(r.start, { day: 'numeric', month: 'short' })) + '</text>';
    });
    var gaps = shown.some(function (r) { return !r.counted; });
    return svg + '</svg><p class="plotkey"><span><i class="kband"></i> 24 to 38 days, the FIGO 2018 reference range</span>' + (gaps ? '<span><i class="kgap"></i> a gap over 60 days, not counted</span>' : '') + '</p>';
  }
  function bleedText(r) { return r.bleedDays + (r.span > r.bleedDays ? ' of ' + r.span : '') + ' bleeding ' + (r.bleedDays === 1 && r.span === 1 ? 'day' : 'days') + ' recorded'; }
  function bleedNotes(r) {
    var notes = [];
    if (r.missingDays) notes.push(plural(r.missingDays, 'day') + ' in between not recorded');
    if (r.autofilled) notes.push(r.autofilled + ' filled in as typical, not confirmed');
    if (r.imported) notes.push(r.imported + ' brought in from another app');
    if (r.flowUnrecorded) notes.push(r.flowUnrecorded + ' without the flow noted');
    return notes.join('; ');
  }
  function intervalText(r) {
    if (r.current) return 'Next start not recorded · day ' + r.sinceStart + ' now';
    if (!r.counted) return r.interval + ' days · a gap in the record, not counted';
    return r.interval + ' days to the next start' + (r.beforeRange ? ' · started before this range' : '');
  }
  function historyHTML(h, o) {
    o = o || {};
    var st = h.stats, rows = h.rows;
    if (!rows.length) return '<p class="note">No period logged in this range yet. Once two first days are logged, the days between them show here.</p>';
    var nI = st.intervals;
    var html = '<div class="kpis k4">' +
      kpi('Intervals', String(nI), nI ? 'start to next start' : 'needs two starts') +
      kpi('Median', st.median !== null ? st.median + '<em>d</em>' : 'Not yet', nI ? 'of ' + plural(nI, 'interval') : '') +
      kpi('Shortest–longest', st.shortest !== null ? st.shortest + '–' + st.longest + '<em>d</em>' : 'Not yet', nI ? 'counted intervals' : '') +
      kpi('Variation', st.variation !== null ? st.variation + '<em>d</em>' : 'Not yet', st.variation !== null ? 'longest minus shortest, ' + plural(nI, 'interval') : 'needs two intervals') +
      '</div>';
    html += '<div class="chart">' + plot(rows) + '</div>';
    html += '<ol class="prows">' + rows.slice().reverse().map(function (r) {
      var bits = [bleedText(r)];
      if (r.heavyDays) bits.push(plural(r.heavyDays, 'heavy day'));
      if (r.largeClots) bits.push('clots over 2.5 cm'); if (r.flooding) bits.push('flooding');
      bits.push(r.painMax === null ? 'pain not recorded' : 'pain up to ' + r.painMax + '/10');
      return '<li' + (r.counted || r.current ? '' : ' class="muted"') + '><b>' + esc(pretty(r.start, { day: 'numeric', month: 'short', year: 'numeric' })) + '</b><span class="iv">' + intervalText(r) + '</span><span class="dt">' + esc(bits.join(' · ')) + (bleedNotes(r) ? '<small>' + esc(bleedNotes(r)) + '</small>' : '') + '</span></li>';
    }).join('') + '</ol>';
    html += '<p class="note">' + esc((h.coverage ? 'Entries on ' + h.coverage.daysWithEntries + ' of ' + h.coverage.days + ' days, ' + pretty(h.range.from, { day: 'numeric', month: 'short', year: 'numeric' }) + ' to ' + pretty(h.range.to, { day: 'numeric', month: 'short', year: 'numeric' }) + '. ' : '') + (st.excluded ? plural(st.excluded, 'gap') + ' over 60 days ' + (st.excluded === 1 ? 'is' : 'are') + ' listed but left out of the numbers. ' : '') + h.limits) + '</p>';
    html += '<p class="note ref"><span class="ms">menu_book</span>' + esc(h.reference) + '</p>';
    return html;
  }

  /* ---------- month calendars ---------- */
  function dayLabel(d) {
    var parts = [pretty(d.date, { weekday: 'long', day: 'numeric', month: 'long' })];
    if (d.flow) parts.push((FLOW[d.flow] ? FLOW[d.flow][0] : d.flow).toLowerCase() + ' bleeding' + (d.autofill ? ', filled in as a typical day' : ''));
    else if (d.bleedAnswer === 'none') parts.push('no bleeding');
    else if (d.bleedAnswer === 'unsure') parts.push('not sure about bleeding');
    if (d.pain !== null) parts.push('pain ' + d.pain + ' of 10');
    if (d.none) parts.push('no symptoms');
    else if (d.symptoms && d.symptoms.length) parts.push(d.symptoms.join(', '));
    if (d.mood) parts.push('mood ' + d.mood); else if (d.moodAnswer === 'unsure') parts.push('mood not sure');
    if (d.sleep !== null) parts.push('slept ' + d.sleep + ' hours'); else if (d.sleepAnswer === 'unsure') parts.push('not sure about sleep');
    if (parts.length === 1) parts.push('nothing recorded');
    return parts.join(', ');
  }
  function track(kind, cls, w) { return '<span class="tr ' + kind + (cls ? ' ' + cls : '') + '">' + (w ? '<i style="width:' + w + '%"></i>' : '') + '</span>'; }
  function cellHTML(d, today) {
    var f = d.flow ? FLOW[d.flow] || FLOW.unspecified : null;
    /* flow not noted gets its own broken mark, never the light-flow mark; "None" for symptoms marks nothing on pain
       (it is not a pain answer); "not sure" has its own sign (Codex diff review, 20 Oct) */
    var bl = f ? track('bl', d.flow === 'unspecified' ? 'unk' : 'b' + f[1] + (d.autofill ? ' auto' : ''), d.flow === 'unspecified' ? 60 : f[1] * 25) : track('bl', d.bleedAnswer === 'none' ? 'ans' : d.bleedAnswer === 'unsure' ? 'uns' : '', 0);
    var pn = d.painBand !== null && d.painBand !== undefined ? track('pn', 'p' + d.painBand, [14, 40, 70, 100][d.painBand]) : track('pn', '', 0);
    var sl = d.sleepBand !== null && d.sleepBand !== undefined ? track('sl', 's' + d.sleepBand, [25, 50, 75, 100][d.sleepBand]) : track('sl', d.sleepAnswer === 'unsure' ? 'uns' : '', 0);
    return '<button type="button" class="pday' + (d.date === today ? ' today' : '') + (d.entries ? '' : ' unrec') + '" data-pday="' + d.date + '" aria-label="' + esc(dayLabel(d)) + '" aria-pressed="false"><span class="dn" aria-hidden="true">' + Number(d.date.slice(8)) + '</span>' + bl + pn + sl + '</button>';
  }
  function legendHTML() {
    function sw(kind, cls, w, t) { return '<span class="lg"><span class="tr ' + kind + ' ' + cls + '"><i style="width:' + w + '%"></i></span>' + esc(t) + '</span>'; }
    return '<div class="plegend" aria-label="Key">' +
      '<div><b>Bleeding</b>' + sw('bl', 'b1', 25, 'spotting') + sw('bl', 'b2', 50, 'light') + sw('bl', 'b3', 75, 'medium') + sw('bl', 'b4', 100, 'heavy') + sw('bl', 'b3 auto', 75, 'filled in') + '</div>' +
      '<div><b>Pain</b>' + sw('pn', 'p0', 14, '0') + sw('pn', 'p1', 40, '1–3') + sw('pn', 'p2', 70, '4–6') + sw('pn', 'p3', 100, '7–10') + '</div>' +
      '<div><b>Sleep</b>' + sw('sl', 's0', 25, 'under 6 h') + sw('sl', 's1', 50, '6–7 h') + sw('sl', 's2', 75, '7–9 h') + sw('sl', 's3', 100, 'over 9 h') + '</div>' +
      '<div><span class="lg"><span class="tr bl unk"><i style="width:60%"></i></span>flow not noted</span><span class="lg"><span class="tr bl ans"></span>answered “no bleeding”</span><span class="lg"><span class="tr bl uns"></span>not sure</span><span class="lg"><span class="tr bl"></span>not recorded</span></div>' +
      '<p class="note">Display bands, not grades. A longer, darker mark is more bleeding, more pain or more sleep; an empty line means nothing was recorded, not that nothing happened.</p></div>';
  }
  function calendarHTML(days, o) {
    o = o || {};
    var today = o.today || (days.length ? days[days.length - 1].date : ''), months = {}, order = [];
    days.forEach(function (d) { var m = d.date.slice(0, 7); if (!months[m]) { months[m] = []; order.push(m); } months[m].push(d); });
    order.reverse();
    var head = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (x) { return '<span class="wd" aria-hidden="true">' + x + '</span>'; }).join('');
    return legendHTML() + order.map(function (m, k) {
      var list = months[m], first = new Date(list[0].date + 'T12:00:00'), lead = (first.getDay() + 6) % 7;
      var rec = list.filter(function (d) { return d.entries; }).length, bleed = list.filter(function (d) { return d.flow && d.flow !== 'spotting'; }).length;
      var title = new Date(m + '-01T12:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      return '<details class="pmonth"' + (k === 0 ? ' open' : '') + '><summary><b>' + esc(title) + '</b><span>' + esc(plural(rec, 'day') + ' recorded' + (bleed ? ', ' + plural(bleed, 'bleeding day') : '')) + '</span></summary>' +
        '<div class="pgrid">' + head + new Array(lead + 1).join('<span class="pad" aria-hidden="true"></span>') + list.map(function (d) { return cellHTML(d, today); }).join('') + '</div>' +
        '<div class="pdetail" aria-live="polite" hidden></div></details>';
    }).join('');
  }
  function detailHTML(d) {
    var lines = [];
    lines.push(d.flow ? (FLOW[d.flow] ? FLOW[d.flow][0] : d.flow) + ' bleeding' + (d.autofill ? ' (filled in as a typical day, not confirmed)' : '') : d.bleedAnswer === 'none' ? 'No bleeding' : d.bleedAnswer === 'unsure' ? 'Not sure about bleeding' : 'Bleeding not recorded');
    lines.push(d.pain !== null ? 'Pain ' + d.pain + '/10' : 'Pain not recorded');
    if (d.none) lines.push('No symptoms'); else if (d.symptoms && d.symptoms.length) lines.push(d.symptoms.join(', '));
    if (d.mood) lines.push('Mood ' + d.mood); else if (d.moodAnswer === 'unsure') lines.push('Mood: not sure');
    lines.push(d.sleep !== null ? 'Slept ' + d.sleep + ' h' : d.sleepAnswer === 'unsure' ? 'Not sure about sleep' : 'Sleep not recorded');
    return '<b>' + esc(pretty(d.date, { weekday: 'long', day: 'numeric', month: 'long' })) + '</b><span>' + lines.map(esc).join(' · ') + '</span>';
  }
  /* days: the array drawn, or a function returning the current one (the journal redraws on every change) */
  function wire(container, days) {
    container.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pday]'); if (!b || !container.contains(b)) return;
      var list = typeof days === 'function' ? days() : days, d = null;
      for (var i = 0; i < list.length; i++) if (list[i].date === b.dataset.pday) { d = list[i]; break; }
      var mon = b.closest('.pmonth'), det = mon && mon.querySelector('.pdetail'); if (!det || !d) return;
      var was = b.getAttribute('aria-pressed') === 'true';
      Array.prototype.forEach.call(container.querySelectorAll('.pday[aria-pressed="true"]'), function (x) { x.setAttribute('aria-pressed', 'false'); });
      Array.prototype.forEach.call(container.querySelectorAll('.pdetail'), function (x) { if (x !== det) x.hidden = true; });
      if (was) { det.hidden = true; return; }
      b.setAttribute('aria-pressed', 'true'); det.innerHTML = detailHTML(d); det.hidden = false;
    });
  }
  /* ---------- a share is data from outside: clean it to strict types before anything is drawn ----------
   * The Doctor view opens files from anyone, so every field that reaches HTML is a real date, a finite number in range or
   * one of the known words; anything else is dropped (Codex re-review, 20 Oct: crafted month counts reached innerHTML). */
  var DATE = /^\d{4}-\d{2}-\d{2}$/, MONTH = /^\d{4}-\d{2}$/;
  function n(v, lo, hi) { var x = Number(v); return v === null || v === undefined || v === '' || !isFinite(x) ? null : Math.max(lo, Math.min(hi, x)); }
  function int(v, lo, hi) { var x = n(v, lo, hi); return x === null ? null : Math.round(x); }
  function word(v, list) { return list.indexOf(v) > -1 ? v : null; }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 60) : null; }
  function cleanShare(share) {
    var out = {};
    var h = share && share.history;
    if (h && typeof h === 'object' && Array.isArray(h.rows) && h.range && DATE.test(h.range.from) && DATE.test(h.range.to)) {
      var rows = h.rows.filter(function (r) { return r && DATE.test(r.start) && DATE.test(r.end); }).slice(0, 400).map(function (r) {
        return { start: r.start, end: r.end, beforeRange: !!r.beforeRange, interval: int(r.interval, 0, 5000), nextStart: DATE.test(r.nextStart) ? r.nextStart : null, current: !!r.current, sinceStart: int(r.sinceStart, 0, 5000),
          counted: !!r.counted, excluded: r.excluded ? 'gap over 60 days: a break in the record, not counted as a cycle' : null, bleedDays: int(r.bleedDays, 0, 400) || 0, span: int(r.span, 0, 400) || 0, missingDays: int(r.missingDays, 0, 400) || 0,
          heavyDays: int(r.heavyDays, 0, 400) || 0, flowUnrecorded: int(r.flowUnrecorded, 0, 400) || 0, largeClots: !!r.largeClots, flooding: !!r.flooding, autofilled: int(r.autofilled, 0, 400) || 0, imported: int(r.imported, 0, 400) || 0, painMax: int(r.painMax, 0, 10) };
      });
      var st = h.stats || {};
      out.history = { range: { from: h.range.from, to: h.range.to, days: int(h.range.days, 0, 5000) }, rows: rows,
        coverage: h.coverage ? { daysWithEntries: int(h.coverage.daysWithEntries, 0, 5000) || 0, days: int(h.coverage.days, 0, 5000) || 0 } : null,
        stats: { starts: int(st.starts, 0, 400) || 0, intervals: int(st.intervals, 0, 400) || 0, excluded: int(st.excluded, 0, 400) || 0, median: n(st.median, 0, 5000), shortest: int(st.shortest, 0, 5000), longest: int(st.longest, 0, 5000), variation: int(st.variation, 0, 5000), longestBleed: int(st.longestBleed, 0, 400), heavyPeriods: int(st.heavyPeriods, 0, 400) || 0 },
        reference: str(h.reference, 400) || '', limits: str(h.limits, 400) || '' };
    }
    if (share && Array.isArray(share.patterns)) {
      out.patterns = share.patterns.filter(function (d) { return d && DATE.test(d.date); }).slice(-800).map(function (d) {
        return { date: d.date, flow: word(d.flow, ['spotting', 'light', 'medium', 'heavy', 'unspecified']), autofill: !!d.autofill, pain: int(d.pain, 0, 10), painBand: int(d.painBand, 0, 3),
          symptoms: Array.isArray(d.symptoms) ? d.symptoms.map(function (x) { return str(x, 40); }).filter(Boolean).slice(0, 30) : null, none: !!d.none, mood: word(d.mood, ['great', 'good', 'ok', 'low', 'bad']),
          sleep: n(d.sleep, 0, 24), sleepBand: int(d.sleepBand, 0, 3), entries: int(d.entries, 0, 500) || 0,
          bleedAnswer: word(d.bleedAnswer, ['none', 'unsure']), sleepAnswer: word(d.sleepAnswer, ['unsure']), moodAnswer: word(d.moodAnswer, ['unsure']) };
      });
    }
    if (share && Array.isArray(share.months)) {
      out.months = share.months.filter(function (m) { return m && MONTH.test(m.month); }).slice(0, 60).map(function (m) {
        var o = { month: m.month }; ['days', 'daysWithEntries', 'bleedingDays', 'filledDays', 'symptomDays', 'sleepNights', 'meals', 'foodDays', 'movementSessions', 'movementMinutes', 'calmSessions', 'calmMinutes'].forEach(function (k) { o[k] = int(m[k], 0, 100000) || 0; }); return o;
      });
    }
    var sn = share && share.sleepNotes, ST = root.OvuStore;
    if (sn && typeof sn === 'object' && DATE.test(sn.from) && DATE.test(sn.to) && ST && ST.cleanSleepCheck) {
      var f = {}, woke = {};
      ['latency', 'wakeups', 'awake', 'early', 'rested'].forEach(function (k) { var v = sn.fields && sn.fields[k] || {}; f[k] = { answered: int(v.answered, 0, 5000) || 0, marked: int(v.marked, 0, 5000) || 0, unsure: int(v.unsure, 0, 5000) || 0 }; if (f[k].marked > f[k].answered) f[k].marked = f[k].answered; });
      (ST.SLEEP_WOKE || []).forEach(function (c) { var x = int(sn.woke && sn.woke[c], 0, 5000); if (x) woke[c] = x; });
      out.sleepNotes = { from: sn.from, to: sn.to, nights: int(sn.nights, 0, 5000) || 0, withDetails: int(sn.withDetails, 0, 5000) || 0, fields: f, woke: woke, flushNights: int(sn.flushNights, 0, 5000) || 0,
        checks: (Array.isArray(sn.checks) ? sn.checks : []).filter(function (c) { return c && DATE.test(c.date); }).slice(0, 60).map(function (c) { return { date: c.date, answers: ST.cleanSleepCheck(c.answers || {}) }; }) };
      /* the sleep quality summary: numbers only, each kept in range; anything missing stays missing (never zero) */
      var q = sn.quality;
      if (q && typeof q === 'object') {
        var num = function (v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi ? v : null; }, cnt = function (v) { return int(v, 0, 5000) || 0; };
        var oq = { nights: cnt(q.nights), avgHours: num(q.avgHours, 0, 24), sevenPlus: cnt(q.sevenPlus), withHours: cnt(q.withHours), timed: cnt(q.timed), midSD: num(q.midSD, 0, 720), bedSD: num(q.bedSD, 0, 720), wakeSD: num(q.wakeSD, 0, 720), awakeNights: cnt(q.awakeNights), awakeMedian: num(q.awakeMedian, 0, 1440), awakeOver30: cnt(q.awakeOver30), effNights: cnt(q.effNights), effMedian: num(q.effMedian, 0, 100), stagedNights: cnt(q.stagedNights), stages: null };
        if (q.stages && typeof q.stages === 'object') { var sc = num(q.stages.core, 0, 100), sd = num(q.stages.deep, 0, 100), sr = num(q.stages.rem, 0, 100); if (sc !== null && sd !== null && sr !== null) oq.stages = { core: sc, deep: sd, rem: sr }; }
        if (oq.withHours > oq.nights) oq.withHours = oq.nights; if (oq.sevenPlus > oq.withHours) oq.sevenPlus = oq.withHours; if (oq.awakeOver30 > oq.awakeNights) oq.awakeOver30 = oq.awakeNights;
        if (oq.avgHours === null) oq.withHours = 0; if (oq.awakeMedian === null) oq.awakeNights = 0; if (oq.effMedian === null) oq.effNights = 0; if (oq.midSD === null || oq.bedSD === null || oq.wakeSD === null) oq.midSD = null;
        out.sleepNotes.quality = oq;
      }
    }
    return out;
  }
  /* ---------- sleep details (OvuAgents.sleepNotes), the same words in the journal and the Doctor view ---------- */
  function sleepNotesHTML(sn, opts) {
    var A = root.OvuAgents; opts = opts || {};
    if (!sn || !A) return '';
    var rows = A.sleepNotesRows(sn);
    if (sn.flushNights) rows.push(['Nights woken by a hot flush or night sweat', sn.flushNights + ' of ' + Math.max(sn.nights, sn.flushNights) + ' recorded date' + (Math.max(sn.nights, sn.flushNights) === 1 ? '' : 's') + ' (from sleep details or symptom notes; a night without either is not counted as no)']);
    var checks = (sn.checks || []).filter(function (c) { return c.answers && Object.keys(c.answers).length; });
    if (!rows.length && !checks.length) return '<p class="note">' + esc(opts.empty || 'No sleep details answered in this range.') + '</p>';
    var html = rows.length ? '<dl class="sndl">' + rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl>' : '';
    if (checks.length) html += '<div class="snchecks">' + checks.slice(0, opts.checks || 2).map(function (c) {
      var notes = A.sleepCheckNotes(c.answers).map(function (x) { return x.title.replace(/^Worth raising: /, ''); });
      return '<div class="sncheck"><b>Two-week sleep check, ' + esc(pretty(c.date, { day: 'numeric', month: 'short', year: 'numeric' })) + '</b><span>' + esc(A.sleepCheckText(c.answers)) + '</span>' + (notes.length ? '<span class="snnotes">Notes raised: ' + esc(notes.join('; ').toLowerCase()) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
    var hasQ = A.sleepQualityRows && A.sleepQualityRows(sn.quality).length;
    var hasAnswers = sn.withDetails || checks.length;
    return html + '<p class="snfoot">' + (hasQ ? 'Sleep figures come from the nights recorded, imported or synced; stages are the device’s own estimate, not a score. ' : '') + (hasAnswers || !hasQ ? 'Rhythme’s own optional questions, not a validated scale and not a score. Counts use only the nights that answered; ' : 'Counts use only the nights that have each measure; ') + '“over 30 min” is a research marker (Lichstein 2003), not a diagnosis.</p>';
  }
  root.OvuPatterns = { sleepNotesHTML: sleepNotesHTML, cleanShare: cleanShare, historyHTML: historyHTML, calendarHTML: calendarHTML, wire: wire, dayLabel: dayLabel, detailHTML: detailHTML };
})(typeof window !== 'undefined' ? window : this);
