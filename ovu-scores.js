/* Rhythme scores (Jamie, 22 Oct 2026: "for cycle tab - i want graphing and a cycle wellness scoring + circadian cycle scoring
 * (need you to figure out the formulae to derive the scores)"). The formulas follow the Codex sol review of 22 Oct
 * (docs/design/reviews/2026-10-22-codex-score-formulas.md): app-defined diary summaries, never a diagnosis.
 *
 * Cycle wellness (cycle-v1), 0 to 100 = 0.25 regularity + 0.25 frequency + 0.20 period length + 0.30 comfort.
 *   regularity: shortest-to-longest cycle spread against FIGO 2018's normal variation for her age (9 days at 18-25 and
 *     42-45, 7 at 26-41): 100 at or under it, falling to 0 at 13 days over; no limit is invented after 45 or without an age.
 *   frequency: the share of cycles 24 to 38 days long (FIGO 2018).
 *   period length: the share of periods 8 days or shorter (FIGO).
 *   comfort: 100 minus 10 x her average 0-10 period pain, each period weighted the same, once at least 80 per cent of
 *     its days have a pain answer and there are 5 or more answers in all.
 *   Window: the last six calendar months; three or more cycles from confirmed periods. A gap over 90 days splits the run.
 * Circadian rhythm (sleep-diary-v1), 0 to 100 = 0.70 steady timing + 0.30 enough sleep.
 *   steady timing: the circular spread (SD) of the middle of her sleep: 100 at 30 minutes or less, 0 at 120 or more.
 *   enough sleep: the share of nights reaching 7 hours (AASM/SRS 2015); more than 9 is never marked down.
 *   Needs 10 nights in the last 14 days with at least 4 in each week. Wake-time spread and the weekday-weekend shift are
 *   shown beside it, not inside it.
 * Any missing part leaves the total empty (an em dash, never 0) and says what is missing. Care notes never depend on a
 * score: they run in ovu-agents.js and ovu-rhythm.js whatever these say. Pure functions first (tested in node), then the
 * panel's HTML. */
(function (root) {
  'use strict';
  var CYCLE_W = { regularity: 0.25, frequency: 0.25, duration: 0.20, comfort: 0.30 }, SLEEP_W = { timing: 0.70, duration: 0.30 };
  var GAP = 90;
  function clamp01(x) { return Math.min(1, Math.max(0, x)); }
  function descending(v, fullAt, zeroAt) { return 100 * clamp01((zeroAt - v) / (zeroAt - fullAt)); }
  function pct(arr, pred) { return arr.length ? 100 * arr.filter(pred).length / arr.length : null; }
  function diffDays(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
  function addMonths(d, n) { var x = new Date(d + 'T12:00:00Z'), day = x.getUTCDate(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth() + n); var last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate(); x.setUTCDate(Math.min(day, last)); return x.toISOString().slice(0, 10); }
  function addDays(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function variationFor(band) { return band === '18-25' || band === '42-45' ? 9 : band === '26-41' ? 7 : null; }
  /* circular mean and SD of clock minutes (0..1439) */
  function circular(mins) {
    if (!mins.length) return { mean: null, sd: null };
    var c = 0, s = 0; mins.forEach(function (m) { var a = m * 2 * Math.PI / 1440; c += Math.cos(a); s += Math.sin(a); }); c /= mins.length; s /= mins.length;
    var r = Math.min(1, Math.hypot(c, s)); if (r <= 1e-12) return { mean: null, sd: Infinity };
    var mean = (Math.atan2(s, c) * 1440 / (2 * Math.PI) + 1440) % 1440;
    return { mean: mean, sd: Math.sqrt(-2 * Math.log(r)) * 1440 / (2 * Math.PI) };
  }
  function circDist(a, b) { var d = Math.abs(a - b) % 1440; return Math.min(d, 1440 - d); }
  function hm(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }

  /* episodes: [{start, end, days:[{date, pain}]}] from confirmed periods; band: FIGO age band or null */
  function cycleScore(episodes, today, band) {
    var from = addMonths(today, -6), eps = (episodes || []).filter(function (e) { return e && e.start && e.start >= from && e.start <= today; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    /* the latest unbroken run: a gap over 90 days splits it (a long absence goes to the care notes instead) */
    var run = []; eps.forEach(function (e) { var last = run[run.length - 1]; if (last && diffDays(last.start, e.start) > GAP) run = []; run.push(e); });
    var lengths = []; for (var i = 1; i < run.length; i++) lengths.push(diffDays(run[i - 1].start, run[i].start));
    var periods = run.slice(0, Math.max(0, run.length - 1)), V = variationFor(band), c = { regularity: null, frequency: null, duration: null, comfort: null };
    var need = [];
    if (lengths.length >= 3) {
      if (V !== null) c.regularity = Math.round(descending(Math.max.apply(null, lengths) - Math.min.apply(null, lengths), V, V + 13));
      else need.push('an age range for the regularity part');
      c.frequency = Math.round(pct(lengths, function (L) { return L >= 24 && L <= 38; }));
    } else need.push((3 - lengths.length) + ' more complete cycle' + (3 - lengths.length === 1 ? '' : 's'));
    if (periods.length >= 3) {
      c.duration = Math.round(pct(periods, function (p) { return diffDays(p.start, p.end) + 1 <= 8; }));
      var answers = 0, covered = periods.every(function (p) { var span = diffDays(p.start, p.end) + 1, got = (p.days || []).filter(function (d) { return typeof d.pain === 'number'; }).length; answers += got; return got >= Math.ceil(0.8 * span); });
      if (covered && answers >= 5) { var means = periods.map(function (p) { var ps = p.days.filter(function (d) { return typeof d.pain === 'number'; }).map(function (d) { return d.pain; }); return ps.reduce(function (a, b) { return a + b; }, 0) / ps.length; }); c.comfort = Math.round(100 - 10 * means.reduce(function (a, b) { return a + b; }, 0) / means.length); }
      else need.push('a pain answer (0 to 10) on most period days');
    }
    var full = Object.keys(c).every(function (k) { return c[k] !== null; });
    var total = full ? Math.round(Object.keys(CYCLE_W).reduce(function (a, k) { return a + CYCLE_W[k] * c[k]; }, 0)) : null;
    return { score: total, parts: c, lengths: lengths, periodDays: periods.map(function (p) { return diffDays(p.start, p.end) + 1; }), from: run.length ? run[0].start : null, need: need, version: 'cycle-v1' };
  }
  /* nights: [{date, bed:'HH:MM', wake:'HH:MM', asleepMin, assumed}] */
  function sleepScore(nights, today) {
    var from = addDays(today, -13), mid = addDays(today, -6), T = [], D = [];
    (nights || []).forEach(function (n) {
      if (!n || !n.date || n.date < from || n.date > today || n.assumed) return;
      var b = hm(n.bed), w = hm(n.wake);
      if (b !== null && w !== null) { var len = (w - b + 1440) % 1440 || 1440; T.push({ date: n.date, mid: (b + len / 2) % 1440, wake: w }); }
      var mins = typeof n.asleepMin === 'number' ? n.asleepMin : (b !== null && w !== null ? ((w - b + 1440) % 1440) : null);
      if (mins !== null) D.push({ date: n.date, mins: mins });
    });
    function covered(X) { return X.length >= 10 && X.filter(function (x) { return x.date < mid; }).length >= 4 && X.filter(function (x) { return x.date >= mid; }).length >= 4; }
    var c = { timing: null, duration: null }, spread = circular(T.map(function (x) { return x.mid; })).sd, wakeSd = circular(T.map(function (x) { return x.wake; })).sd;
    if (covered(T)) c.timing = Math.round(descending(spread, 30, 120));
    if (covered(D)) c.duration = Math.round(pct(D, function (x) { return x.mins >= 420; }));
    var wk = T.filter(function (x) { var d = new Date(x.date + 'T12:00:00Z').getUTCDay(); return d === 0 || d === 6; }), wd = T.filter(function (x) { var d = new Date(x.date + 'T12:00:00Z').getUTCDay(); return d !== 0 && d !== 6; });
    var shift = wk.length >= 2 && wd.length >= 2 ? Math.round(circDist(circular(wk.map(function (x) { return x.mid; })).mean, circular(wd.map(function (x) { return x.mid; })).mean)) : null;
    var full = c.timing !== null && c.duration !== null;
    var need = []; if (!covered(T)) need.push('bed and wake times on ' + Math.max(0, 10 - T.length) + ' more nights (at least 4 in each week)');
    return { score: full ? Math.round(SLEEP_W.timing * c.timing + SLEEP_W.duration * c.duration) : null, parts: c, nights: T.length, midSpread: isFinite(spread) && spread !== null ? Math.round(spread) : null, wakeSpread: isFinite(wakeSd) && wakeSd !== null ? Math.round(wakeSd) : null, weekendShift: shift, hours: D.map(function (x) { return { date: x.date, h: Math.round(x.mins / 6) / 10 }; }), need: need, version: 'sleep-diary-v1' };
  }
  var SC = { CYCLE_W: CYCLE_W, SLEEP_W: SLEEP_W, cycleScore: cycleScore, sleepScore: sleepScore, circular: circular, variationFor: variationFor };
  root.OvuScores = SC;

  /* ---------- from the store, and the panel ---------- */
  var S = root.OvuStore;
  function episodesFromStore() {
    if (!S || !S.periodEpisodes) return [];
    var RH = root.OvuRhythm, eps = S.periodEpisodes(), sym = {};
    (S.list('symptom') || []).forEach(function (e) { if (typeof e.data.pain === 'number') sym[e.date] = e.data.pain; });
    var conf = RH && RH.confirmedEpisodes ? RH.confirmedEpisodes(eps) : eps.map(function (e) { return { start: e.start, end: e.end }; });
    return conf.map(function (e) { var days = []; for (var d = e.start; d <= e.end; d = addDays(d, 1)) days.push({ date: d, pain: sym[d] }); return { start: e.start, end: e.end, days: days }; });
  }
  function nightsFromStore() { return (S && S.list ? S.list('sleep') : []).map(function (e) { return { date: e.date, bed: e.data.bedTime, wake: e.data.wakeTime, asleepMin: typeof e.data.asleepMin === 'number' ? e.data.asleepMin : undefined, assumed: e.data.assumed === true }; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function bars(vals, lo, hi, max, unit) {
    if (!vals.length) return '<p class="help">No data to draw yet.</p>';
    var W = 300, H = 90, bw = Math.min(28, (W - 20) / vals.length - 4);
    var y = function (v) { return H - 14 - (Math.min(v, max) / max) * (H - 24); };
    var band = lo !== null ? '<rect x="0" y="' + y(hi) + '" width="' + W + '" height="' + (y(lo) - y(hi)) + '" fill="rgba(140,200,170,.22)"/>' : '';
    return '<svg class="scgraph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + vals.length + ' values">' + band + vals.map(function (v, i) { var x = 10 + i * (bw + 4), inside = lo === null || (v >= lo && v <= hi); return '<rect x="' + x + '" y="' + y(v) + '" width="' + bw + '" height="' + (H - 14 - y(v)) + '" rx="4" fill="' + (inside ? '#a98bd8' : '#f0a07a') + '"/><text x="' + (x + bw / 2) + '" y="' + (H - 2) + '" text-anchor="middle" font-size="9" fill="#7a6a96">' + v + '</text>'; }).join('') + '</svg>';
  }
  function partRow(name, v, note) { return '<li><span>' + esc(name) + '</span><b>' + (v === null ? '—' : v) + '</b>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</li>'; }
  function panelHTML(profile) {
    var today = S.today(), RH = root.OvuRhythm, band = RH && RH.bandFor ? RH.bandFor(profile || {}) : null;
    var cs = cycleScore(episodesFromStore(), today, band), ss = sleepScore(nightsFromStore(), today);
    var h = '<section class="scorecard"><h3><span class="ms">favorite</span>Cycle wellness</h3><div class="scbig">' + (cs.score === null ? '—' : cs.score) + '<small>/100</small></div>' +
      '<ul class="scparts">' + partRow('Regularity (25%)', cs.parts.regularity, 'spread vs FIGO normal for your age') + partRow('Frequency (25%)', cs.parts.frequency, 'cycles 24 to 38 days') + partRow('Period length (20%)', cs.parts.duration, '8 days or less') + partRow('Comfort (30%)', cs.parts.comfort, 'from your 0 to 10 period pain') + '</ul>' +
      (cs.need.length ? '<p class="help">Still needed: ' + esc(cs.need.join('; ')) + '.</p>' : '') +
      '<h4 class="schead">Cycle lengths (days)</h4>' + bars(cs.lengths, 24, 38, 60) + '<h4 class="schead">Period lengths (days)</h4>' + bars(cs.periodDays, 1, 8, 12) +
      '<p class="help">An app-defined summary of your recorded cycles and period pain. It does not assess fertility, confirm ovulation or rule out a health condition.</p></section>';
    h += '<section class="scorecard"><h3><span class="ms">bedtime</span>Circadian rhythm</h3><div class="scbig">' + (ss.score === null ? '—' : ss.score) + '<small>/100</small></div>' +
      '<ul class="scparts">' + partRow('Steady timing (70%)', ss.parts.timing, ss.midSpread !== null ? 'the middle of your sleep moves about ' + ss.midSpread + ' min' : '') + partRow('Enough sleep (30%)', ss.parts.duration, 'nights reaching 7 hours') + partRow('Wake time spread', ss.wakeSpread === null ? null : ss.wakeSpread + ' min', 'shown, not scored') + partRow('Weekend shift', ss.weekendShift === null ? null : ss.weekendShift + ' min', 'shown, not scored') + '</ul>' +
      (ss.need.length ? '<p class="help">Still needed: ' + esc(ss.need.join('; ')) + '.</p>' : '') +
      '<h4 class="schead">Sleep, last 14 days (hours)</h4>' + bars(ss.hours.map(function (x) { return x.h; }), 7, 9, 12) +
      '<p class="help">Estimated from your recorded sleep schedule and length. It does not measure your body clock, and a steady score does not rule out a sleep problem.</p></section>';
    return h;
  }
  SC.panelHTML = panelHTML; SC.episodesFromStore = episodesFromStore; SC.nightsFromStore = nightsFromStore;
})(typeof window !== 'undefined' ? window : this);
