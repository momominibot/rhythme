/* Rhythme body signals: steps, resting heart rate and temperature brought in from a health app (ovu-health.js).
 * Pure maths and the words shown; no storage and no DOM (room.js draws them, tools/test-core.js tests them).
 *
 * The rules (23 Oct 2026, design note docs/design/2026-10-23-health-steps-workouts-heart-temperature.md):
 *  - synced only: nobody is asked to type steps, a heart rate or a temperature in;
 *  - no target and no score: steps are compared with her own usual (the median of the 28 days before today, from
 *    7 days of data), never with a fixed 10,000; nothing is called stress, because heart rate alone does not measure it;
 *  - resting heart rate and temperature are shown as a difference from her own usual, with the cycle as one
 *    ordinary reason among others, and never used to predict a period or ovulation.
 * Sources (ovu-evidence.js): Paluch et al. 2022, Lancet Public Health (E120); Shilaih et al. 2017, Scientific Reports
 * (E121); Apple, retrospective ovulation estimates (E122). */
(function (root) {
  'use strict';
  function pad(n) { return String(n).padStart(2, '0'); }
  function addDays(dateStr, n) { var t = new Date(dateStr + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }
  function median(xs) { if (!xs.length) return null; var a = xs.slice().sort(function (x, y) { return x - y; }), m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function mean(xs) { if (!xs.length) return null; var n = 0; xs.forEach(function (x) { n += x; }); return n / xs.length; }
  /* one value per date: the newest entry of the day wins (a refresh, or a later read) */
  function byDate(entries, type, pick) {
    var out = {}, at = {};
    (entries || []).forEach(function (e) {
      if (!e || e.type !== type || !e.data) return; var v = pick(e.data); if (typeof v !== 'number' || !isFinite(v)) return;
      var t = String(e.updatedAt || e.createdAt || ''); if (out[e.date] === undefined || t >= at[e.date]) { out[e.date] = v; at[e.date] = t; }
    });
    return out;
  }
  function window_(map, from, to) { var xs = []; Object.keys(map).forEach(function (d) { if (d >= from && d <= to) xs.push(map[d]); }); return xs; }

  /* Steps: the last 7 days (today's count may still be growing, so it is shown but kept out of the usual), and her usual */
  function steps(entries, today) {
    var m = byDate(entries, 'steps', function (d) { return Number(d.steps); }), days = [];
    for (var i = 6; i >= 0; i--) { var d = addDays(today, -i); days.push({ date: d, steps: m[d] === undefined ? null : Math.round(m[d]) }); }
    var past = window_(m, addDays(today, -28), addDays(today, -1)), usual = past.length >= 7 ? Math.round(median(past) / 10) * 10 : null;
    var latest = null; Object.keys(m).sort().forEach(function (d) { if (d <= today) latest = { date: d, steps: Math.round(m[d]) }; });
    return { days: days, usual: usual, usualDays: past.length, latest: latest, any: Object.keys(m).length > 0 };
  }
  /* Resting heart rate: the last 7 days against the 28 before them. A difference under 2 beats is "about your usual". */
  function heart(entries, today) {
    var m = byDate(entries, 'restinghr', function (d) { return Number(d.bpm); });
    var recentXs = window_(m, addDays(today, -6), today), pastXs = window_(m, addDays(today, -34), addDays(today, -7));
    var recent = recentXs.length >= 3 ? Math.round(mean(recentXs)) : null, usual = pastXs.length >= 10 ? Math.round(median(pastXs)) : null;
    var series = []; for (var i = 27; i >= 0; i--) { var d = addDays(today, -i); series.push({ date: d, bpm: m[d] === undefined ? null : m[d] }); }
    return { recent: recent, usual: usual, diff: recent !== null && usual !== null ? recent - usual : null, series: series, any: Object.keys(m).length > 0 };
  }
  /* Temperature: wrist (while asleep) and basal kept apart; the last 3 days against her usual over the 28 before them */
  function temperature(entries, today) {
    function one(field) {
      var m = byDate(entries, 'temperature', function (d) { return typeof d[field] === 'number' ? d[field] : NaN; });
      var recentXs = window_(m, addDays(today, -2), today), pastXs = window_(m, addDays(today, -30), addDays(today, -3));
      var recent = recentXs.length ? mean(recentXs) : null, usual = pastXs.length >= 10 ? median(pastXs) : null;
      var series = []; for (var i = 27; i >= 0; i--) { var d = addDays(today, -i); series.push({ date: d, c: m[d] === undefined ? null : m[d] }); }
      return { recent: recent === null ? null : Math.round(recent * 100) / 100, usual: usual === null ? null : Math.round(usual * 100) / 100, diff: recent !== null && usual !== null ? Math.round((recent - usual) * 10) / 10 : null, series: series, any: Object.keys(m).length > 0 };
    }
    return { wrist: one('wrist'), basal: one('basal') };
  }

  var COPY = {
    stepsNote: 'No fixed goal here. In a large 2022 study, the benefit of more daily steps levelled off at about 6,000 to 8,000 a day for people aged 60 and over, and about 8,000 to 10,000 for younger adults. Your usual is the middle of your last 28 days.',
    stepsNoUsual: 'Your usual appears after 7 days of steps.',
    heartNote: 'Resting heart rate often rises a few beats a minute in the second half of a cycle, after ovulation, and settles around the period. A cold, poor sleep, alcohol, heat or hard training can raise it too. Rhythme shows it as it is and never calls it stress: heart rate alone does not measure stress.',
    heartNoUsual: 'Your usual appears after about two weeks of readings.',
    tempNote: 'Temperature while asleep often rises a few tenths of a degree after ovulation and falls again around the period. Apple uses this shift to estimate ovulation after it has happened. Rhythme shows it as it is and never uses it to predict a period or fertile days.',
    tempNoUsual: 'Your usual appears after about two weeks of readings.'
  };
  function heartLine(h) {
    if (h.recent === null) return 'Fewer than 3 readings in the last 7 days.';
    if (h.usual === null) return 'About ' + h.recent + ' beats a minute over the last 7 days. ' + COPY.heartNoUsual;
    if (Math.abs(h.diff) < 2) return 'About ' + h.recent + ' beats a minute this week, around your usual of ' + h.usual + '.';
    return 'About ' + h.recent + ' beats a minute this week, ' + Math.abs(h.diff) + (h.diff > 0 ? ' above' : ' below') + ' your usual of ' + h.usual + '.';
  }
  function tempLine(t, which) {
    if (t.recent === null) return 'No ' + which + ' reading in the last 3 days.';
    if (t.usual === null) return t.recent.toFixed(2) + ' °C lately. ' + COPY.tempNoUsual;
    if (Math.abs(t.diff) < 0.1) return 'Around your usual over the last 3 days.';
    return (t.diff > 0 ? '+' : '') + t.diff.toFixed(1) + ' °C compared with your usual over the last 3 days.';
  }

  root.OvuSignals = { steps: steps, heart: heart, temperature: temperature, heartLine: heartLine, tempLine: tempLine, COPY: COPY, median: median, addDays: addDays };
})(typeof window !== 'undefined' ? window : this);
