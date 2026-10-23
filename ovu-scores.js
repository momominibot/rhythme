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
    /* "so far" (Jamie, 23 Oct: three months logged and no cycle wellness shown): once three cycles give frequency and period
       length, the parts that exist are shown as a number with their own weights scaled to 100, labelled as so far and with
       what is missing; the full score keeps its definition and stays empty until every part is there */
    var have = Object.keys(c).filter(function (k) { return c[k] !== null; }), soFar = null;
    if (!full && c.frequency !== null && c.duration !== null) { var wsum = have.reduce(function (a, k) { return a + CYCLE_W[k]; }, 0); soFar = Math.round(have.reduce(function (a, k) { return a + CYCLE_W[k] * c[k]; }, 0) / wsum); }
    return { score: total, soFar: soFar, partsReady: have.length, parts: c, lengths: lengths, periodDays: periods.map(function (p) { return diffDays(p.start, p.end) + 1; }), from: run.length ? run[0].start : null, need: need, version: 'cycle-v1' };
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
  /* ---------- the dreamy view (Jamie, 22 Oct: "I need the cute dreamy scoring") ----------
   * Each score is a soft ring with its number inside and a Luna cloud whose mood follows it; the parts are pastel pill
   * bars; the graphs are rounded pastel bars over a soft "comfortable" band. Nothing here changes a number: it draws what
   * cycleScore and sleepScore computed, and says plainly what is still needed. */
  var ART = 'assets/room/scores/';
  function mood(score) { return score === null ? 'sleepy' : score < 40 ? 'tender' : score < 70 ? 'calm' : score < 90 ? 'happy' : 'glow'; }
  /* the line says where the number sits, not how she is: an app-defined index can be high with pain in it (Codex, 22 Oct) */
  function moodLine(kind, score, sofar) {
    if (sofar && score !== null) return 'So far, from ' + sofar + ' of 4 parts. The rest fills in as you record; the parts below say which.';
    if (score === null) return kind === 'cycle' ? 'Still gathering your cycles. Luna rests until there is enough to draw.' : 'Still gathering your nights. Luna rests until there is enough to draw.';
    if (score < 40) return 'Lower in these records. A number to notice, not a verdict; the parts below say which.';
    if (score < 70) return 'Mid-range in these records. The parts below say what is pulling it where.';
    if (score < 90) return 'High in these records. Each part below has its own picture.';
    return 'At the top of the range in these records. The parts below still carry their own detail.';
  }
  /* the ring draws itself from empty to its number and the number counts up with it (animate(), below); sparkles twinkle
     round a ring that has a number; with reduced motion everything simply appears */
  function ring(score, label, id, sofar) {
    var r = 52, c = 2 * Math.PI * r, v = score === null ? 0 : score, dash = c * v / 100;
    return '<div class="scring' + (score === null ? ' empty' : '') + (sofar ? ' sofar' : '') + '" style="--c:' + c.toFixed(1) + ';--d:' + dash.toFixed(1) + '"><svg viewBox="0 0 128 128" role="img" aria-label="' + esc(label) + ': ' + (score === null ? 'not yet' : score + ' out of 100' + (sofar ? ', so far' : '')) + '">' +
      '<defs><linearGradient id="scg-' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6c9d6"/><stop offset=".5" stop-color="#c9b6e6"/><stop offset="1" stop-color="#bfe3d4"/></linearGradient>' +
      '<filter id="scf-' + id + '" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter></defs>' +
      '<circle cx="64" cy="64" r="' + r + '" fill="none" stroke="#efe7f7" stroke-width="12"/>' +
      (score === null ? '' : '<circle class="scarc glow" cx="64" cy="64" r="' + r + '" fill="none" stroke="url(#scg-' + id + ')" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 64 64)" filter="url(#scf-' + id + ')" opacity=".55"/>' +
      '<circle class="scarc" cx="64" cy="64" r="' + r + '" fill="none" stroke="url(#scg-' + id + ')" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 64 64)"/>') +
      '<circle cx="64" cy="64" r="40" fill="rgba(255,255,255,.75)"/></svg>' +
      (score === null ? '' : '<i class="scspark s1" aria-hidden="true"></i><i class="scspark s2" aria-hidden="true"></i><i class="scspark s3" aria-hidden="true"></i><i class="scspark s4" aria-hidden="true"></i>') +
      '<div class="scnum">' + (score === null ? '<span class="scdash">·</span>' : '<b data-n="' + score + '">' + score + '</b><small>' + (sofar ? 'so far' : 'of 100') + '</small>') + '</div></div>';
  }
  function pill(name, v, note, shown) {
    var has = v !== null && v !== undefined, num = has && typeof v === 'number' ? v : null;
    return '<div class="scpill' + (has ? '' : ' empty') + '"><div class="scpill-top"><span>' + esc(name) + '</span><b>' + (has ? esc(String(v)) : 'soon') + '</b></div>' +
      (shown ? '' : '<div class="scbar"><i style="width:' + (num === null ? 0 : Math.max(2, num)) + '%"></i></div>') +
      (note ? '<small>' + esc(note) + '</small>' : '') + '</div>';
  }
  function needRow(need) {
    if (!need.length) return '';
    return '<div class="scneed"><span class="ms">auto_awesome</span><span>To finish the picture: ' + esc(need.join('; ')) + '.</span></div>';
  }
  function bars(vals, lo, hi, max, unit) {
    if (!vals.length) return '<div class="scgraph-empty"><span class="ms">nights_stay</span>No ' + esc(unit || 'data') + ' to draw yet.</div>';
    var W = 300, H = 96, n = vals.length, bw = Math.min(24, (W - 24) / n - 5), gap = (W - 24 - n * bw) / Math.max(1, n - 1), step = bw + Math.min(gap, 10);
    var x0 = (W - (n * bw + (n - 1) * Math.min(gap, 10))) / 2;
    var y = function (v) { return H - 18 - (Math.min(v, max) / max) * (H - 30); };
    var band = lo !== null ? '<rect x="6" y="' + y(hi).toFixed(1) + '" width="' + (W - 12) + '" height="' + (y(lo) - y(hi)).toFixed(1) + '" rx="8" fill="rgba(191,227,212,.35)"/><text x="12" y="' + (y(hi) + 10).toFixed(1) + '" font-size="8" fill="#2f6b4f" font-weight="800">reference range</text>' : '';
    return '<svg class="scgraph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + n + ' values">' +
      '<defs><linearGradient id="scb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9c7f2"/><stop offset="1" stop-color="#a98bd8"/></linearGradient><linearGradient id="sco" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbd7c2"/><stop offset="1" stop-color="#f0a07a"/></linearGradient></defs>' + band +
      vals.map(function (v, i) { var x = x0 + i * step, inside = lo === null || (v >= lo && v <= hi); return '<rect x="' + x.toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (H - 18 - y(v)).toFixed(1) + '" rx="' + Math.min(8, bw / 2) + '" fill="url(#' + (inside ? 'scb' : 'sco') + ')"/><text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" font-size="9" font-weight="700" fill="#7a6a96">' + v + '</text>'; }).join('') + '</svg>';
  }
  /* each score has its own friend: Luna's moon for sleep, and for the cycle its own picture once it is drawn (CYCLE_ART;
     Jamie, 23 Oct: "the emoji of cycle wellness should be different from circadian cycle") */
  var CYCLE_ART = 'cloud-';
  function card(kind, title, icon, score, body, sofar) {
    var m = mood(score);
    return '<section class="scorecard dreamy sc-' + kind + (sofar ? ' sofar' : '') + '" data-score="' + kind + '" data-mood="' + m + '"><div class="schero">' + ring(score, title, kind, sofar) +
      '<div class="scside"><h3><span class="ms">' + icon + '</span>' + esc(title) + '</h3><p class="scmood">' + esc(moodLine(kind, score, sofar)) + '</p></div>' +
      '<img class="sccloud" src="' + ART + (kind === 'cycle' ? CYCLE_ART : 'cloud-') + m + '.webp" alt="" width="96" height="96" loading="lazy"></div>' + body + '</section>';
  }
  /* the motion after the panel is on screen: each number counts up as its ring draws (about a second); nothing moves with
     reduced motion, and the number written in the page is always the real one */
  function animate(box) {
    if (!box || !root.requestAnimationFrame) return;
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduce) return;
    Array.prototype.forEach.call(box.querySelectorAll('.scnum b[data-n]'), function (el) {
      var n = Number(el.getAttribute('data-n')), t0 = null; if (!(n > 0)) return; el.textContent = '0';
      function step(t) { if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3); el.textContent = String(Math.round(n * e)); if (k < 1) root.requestAnimationFrame(step); else el.textContent = String(n); }
      root.requestAnimationFrame(step);
    });
  }
  function panelHTML(profile) {
    var today = S.today(), RH = root.OvuRhythm, band = RH && RH.bandFor ? RH.bandFor(profile || {}) : null;
    var cs = cycleScore(episodesFromStore(), today, band), ss = sleepScore(nightsFromStore(), today), AG = root.OvuAgents;
    /* the cycle score is for menstrual cycles: after menopause it is not shown, and in pregnancy it pauses (request check, 22 Oct) */
    var post = !!(AG && AG.isPostmenopausal && AG.isPostmenopausal(profile || {})), preg = (profile || {}).lifeStage === 'pregnant';
    var h = post || preg ? '<section class="scorecard dreamy sc-cycle" data-score="cycle" data-mood="sleepy"><div class="schero"><div class="scside"><h3><span class="ms">favorite</span>Cycle wellness</h3><p class="scmood">' + (post ? 'Cycle wellness is for menstrual cycles, so it is not shown after menopause. Any bleeding you record is named as something to get checked.' : 'Cycle wellness pauses during pregnancy. It comes back once your periods return.') + '</p></div><img class="sccloud" src="' + ART + 'cloud-sleepy.webp" alt="" width="96" height="96" loading="lazy"></div></section>' :
      card('cycle', 'Cycle wellness', 'local_florist', cs.score !== null ? cs.score : cs.soFar,
        '<div class="scpills">' + pill('Regularity', cs.parts.regularity, 'how much your cycle lengths vary, against what is usual for your age') + pill('Frequency', cs.parts.frequency, 'cycles of 24 to 38 days') + pill('Period length', cs.parts.duration, 'periods of 8 days or less') + pill('Comfort', cs.parts.comfort, 'from your 0 to 10 period pain') + '</div>' +
        needRow(cs.need) +
        '<h4 class="schead">Cycle lengths, days (reference 24 to 38)</h4>' + bars(cs.lengths, 24, 38, 60, 'cycles') + '<h4 class="schead">Period lengths, days (reference up to 8)</h4>' + bars(cs.periodDays, 1, 8, 12, 'periods') +
        '<p class="help scfoot">An app-defined summary of your recorded cycles and period pain (weights: regularity 25, frequency 25, period length 20, comfort 30). It does not assess fertility, confirm ovulation or rule out a health condition.' + (cs.score === null && cs.soFar !== null ? ' So far uses only the parts that are ready, with their weights scaled to 100.' : '') + '</p>', cs.score === null && cs.soFar !== null ? cs.partsReady : 0);
    h += card('sleep', 'Circadian rhythm', 'bedtime', ss.score,
      '<div class="scpills">' + pill('Steady timing', ss.parts.timing, ss.midSpread !== null ? 'the middle of your sleep moves about ' + ss.midSpread + ' min' : 'how much the middle of your sleep moves') + pill('Enough sleep', ss.parts.duration, 'nights reaching 7 hours') + pill('Wake time spread', ss.wakeSpread === null ? null : ss.wakeSpread + ' min', 'shown, not scored', true) + pill('Weekend shift', ss.weekendShift === null ? null : ss.weekendShift + ' min', 'shown, not scored', true) + '</div>' +
      needRow(ss.need) +
      '<h4 class="schead">Sleep, last 14 nights, hours (reference 7 to 9)</h4>' + bars(ss.hours.map(function (x) { return x.h; }), 7, 9, 12, 'nights') +
      '<p class="help scfoot">Estimated from your recorded sleep schedule and length (weights: steady timing 70, enough sleep 30). It does not measure your body clock, and a steady score does not rule out a sleep problem.</p>');
    return h;
  }
  SC.mood = mood; SC.animate = animate;
  SC.panelHTML = panelHTML; SC.episodesFromStore = episodesFromStore; SC.nightsFromStore = nightsFromStore;
})(typeof window !== 'undefined' ? window : this);
