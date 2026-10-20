/* Rhythme analysis agents (rule-based, run in this browser).
 * Mirrors the reference architecture: a Supervisor decides which analysis
 * tools an entry needs, each agent returns flags and metrics, a Daily Summary
 * agent writes the journal-log line and a 4-Week Summary agent builds the
 * "Dr shares" card. Everything is deterministic and labelled
 * "for clinician review": these are pattern notes, not a diagnosis.
 * Reference ranges: FIGO 2018 normal cycle frequency 24 to 38 days and bleeding
 * up to 8 days; AASM/SRS 2015 adult sleep recommendation of 7 or more hours.
 */
(function (root) {
  'use strict';
  var S = root.OvuStore;
  var SYMPTOMS = ['cramps', 'headache', 'bloating', 'breast tenderness', 'back pain', 'fatigue', 'nausea', 'acne', 'cravings', 'insomnia', 'hot flushes', 'dizziness', 'spotting', 'discharge change', 'low mood', 'anxiety', 'irritability', 'brain fog'];
  var MOODS = ['great', 'good', 'ok', 'low', 'bad'];
  /* a day of mindful minutes brought in from Apple Health or Google is one entry that may hold several sessions */
  function sessionCount(list) { return list.reduce(function (n, e) { return n + (e.data && e.data.kind === 'imported' ? Math.max(1, Number(e.data.sessions) || 1) : 1); }, 0); }
  var FOOD_TAGS = ['home-cooked', 'veggies', 'protein', 'iron-rich', 'sweet', 'caffeine', 'alcohol', 'ultra-processed', 'late night'];

  function flag(level, code, title, detail, date) { return { level: level, code: code, title: title, detail: detail, date: date || null }; }
  /* The onboarding writes 'post'; older profiles and the legacy pages wrote 'postmenopause'. Both count. */
  function isPostmenopausal(p) { return ['post', 'postmenopause', 'postmenopausal'].indexOf((p && p.lifeStage) || '') > -1; }

  /* ---------- Supervisor: tool decisions ---------- */
  function supervisor(event) {
    var tools = [];
    if (event.type === 'sleep') tools.push('sleepAgent');
    if (event.type === 'period') tools.push('cycleAgent');
    if (event.type === 'symptom') tools.push('symptomAgent', 'cycleAgent');
    if (event.type === 'food') tools.push('foodAgent');
    if (event.type === 'reflection' || event.type === 'mindfulness') tools.push('reflectionAgent');
    return { event: event.id, tools: tools, decidedAt: new Date().toISOString() };
  }

  /* ---------- Analysis agents ---------- */
  function sleepAgent(end) {
    var st = S.sleepStats(7, end), flags = [];
    if (st.count >= 5 && st.avg !== null && st.avg < 6) flags.push(flag('watch', 'SLEEP_SHORT_AVG', 'Short sleep this week', 'Average ' + st.avg + ' h over ' + st.count + ' nights, below the 7+ hours recommended for adults.', end));
    /* nights are one per date (ovu-store.js sleepStats); "in a row" needs adjacent dates, so a gap restarts the run */
    var run = 0, worst = 0, prev = null;
    st.nights.forEach(function (n) { run = n.hours < 5 ? (run && prev && S.diffDays(prev, n.date) === 1 ? run + 1 : 1) : 0; prev = n.date; worst = Math.max(worst, run); });
    if (worst >= 3) flags.push(flag('watch', 'SLEEP_SHORT_RUN', 'Three or more very short nights in a row', 'Several consecutive nights under 5 hours. Worth mentioning if this continues.', end));
    return { agent: 'sleepAgent', metrics: st, flags: flags };
  }
  /* Bleeding after menopause, from any entry type: a period day of any flow, or spotting ticked as a symptom
   * ("No period for two years, but spotting today" is saved as a spotting symptom). It is found in the last 28 days,
   * then remembered in state.postmenoBleed so the note stays across sessions and past the 28 days until the person
   * dismisses it (dismissFlag); a newer bleed raises it again. Entries older than the window never raise it, so
   * periods imported from before menopause stay quiet. Returns the date of the latest bleed, or null. The memory is
   * written once per new bleed, never inside a sandbox (the doctor sample), which would save the sample over the record. */
  function postmenoBleed(end, p) {
    if (!isPostmenopausal(p)) return null;
    var from = S.addDays(end, -27), recent = null;
    S.list('period', { from: from, to: end }).forEach(function (e) { if (e.data.flow && e.data.flow !== 'none' && (!recent || e.date > recent)) recent = e.date; });
    S.list('symptom', { from: from, to: end }).forEach(function (e) { if ((e.data.symptoms || []).indexOf('spotting') > -1 && (!recent || e.date > recent)) recent = e.date; });
    var st = S.state().postmenoBleed || {}, seen = st.last && st.last <= end ? st.last : null;
    /* only a bleed in the 28 days before the real today is remembered: the journal also reads past days, and an old
     * period seen from one of those must not become a standing note */
    if (recent && recent >= S.addDays(S.today(), -27) && (!st.last || recent > st.last) && !(S.isSandbox && S.isSandbox())) { try { S.setState({ postmenoBleed: { last: recent, dismissedThrough: st.dismissedThrough || null } }); } catch (err) { /* a full or blocked storage never hides the note */ } }
    var last = recent && (!seen || recent > seen) ? recent : seen;
    if (!last || (st.dismissedThrough && st.dismissedThrough >= last)) return null;
    return last;
  }
  /* The person hides a note they have acted on. Only notes marked dismissible can be hidden: today that is the
   * bleeding-after-menopause note, which comes back with any newer bleed or spotting. */
  function dismissFlag(code, end) {
    if (code !== 'POSTMENO_BLEED') return false;
    end = end || S.today();
    var last = postmenoBleed(end, S.profile()); if (!last) return false;
    var st = S.state().postmenoBleed || {};
    S.setState({ postmenoBleed: { last: st.last && st.last > last ? st.last : last, dismissedThrough: last, dismissedAt: new Date().toISOString() } });
    return true;
  }
  function cycleAgent(end) {
    end = end || S.today();
    var cs = S.cycleStats(end), flags = [], p = S.profile();
    /* the last three gaps between logged starts: a cycle outside 24 to 38 days is flagged; a gap of over 60 days
     * is a break in the record (not a cycle), so it is named as a gap and left out of the averages */
    cs.cycles.slice(-3).forEach(function (c) {
      var L = c.days;
      if (!c.counted) flags.push(flag('info', 'GAP_LONG', 'A gap of ' + L + ' days between logged periods', 'Left out of your cycle averages. If no period came in that time, a gap this long is worth mentioning to a clinician; if periods came but were not logged, you can ignore this.', c.to));
      else if (L < 24 || L > 38) flags.push(flag('watch', L < 24 ? 'CYCLE_SHORT' : 'CYCLE_LONG', 'Cycle of ' + L + ' days', 'Outside the typical 24 to 38 day range (FIGO 2018). Cycles of 21 to 45 days can still be typical in the first years after a first period.', c.to));
    });
    cs.episodes.slice(-3).forEach(function (ep) {
      if (ep.length > 8) flags.push(flag('watch', 'BLEED_LONG', 'Bleeding lasted ' + ep.length + ' days', 'Longer than the typical up to 8 days. Worth mentioning to a clinician.', ep.start));
      var impact = ep.days.filter(function (d) { return (d.data.flow === 'heavy' && (d.data.clots || d.data.largeClots || d.data.flooding || d.data.impact)) || d.data.flooding || d.data.largeClots; }).length;
      if (impact >= 2) flags.push(flag('watch', 'BLEED_HEAVY_IMPACT', 'Heavy bleeding that affected your day', impact + ' heavy days with clots or disruption in one period. Heavy bleeding that interferes with daily life is a reason to ask for a review.', ep.start));
    });
    if (cs.lastStart && cs.cycles.length >= 1 && S.diffDays(cs.lastStart, end) > 45) flags.push(flag('info', 'PERIOD_LATE', 'No period logged for ' + S.diffDays(cs.lastStart, end) + ' days', 'If a period is overdue and pregnancy is possible, a test is a sensible first step. Persistent gaps are worth a clinician visit.', end));
    var spotting = S.list('symptom', { from: S.addDays(end, -27), to: end }).filter(function (e) { return (e.data.symptoms || []).indexOf('spotting') > -1 && !cs.episodes.some(function (ep) { return e.date >= S.addDays(ep.start, -1) && e.date <= S.addDays(ep.end, 1); }); });
    if (spotting.length >= 2) flags.push(flag('watch', 'SPOTTING_BETWEEN', 'Spotting between periods', spotting.length + ' days of spotting outside a period in the last 4 weeks.', spotting[spotting.length - 1].date));
    var pmb = postmenoBleed(end, p);
    if (pmb) { var pf = flag('high', 'POSTMENO_BLEED', 'Bleeding after menopause', 'Bleeding or spotting was logged on ' + pmb + ' after menopause. Any bleeding after menopause should be checked by a clinician promptly.', end); pf.dismissible = true; pf.since = pmb; flags.push(pf); }
    return { agent: 'cycleAgent', metrics: cs, flags: flags };
  }
  function symptomAgent(end) {
    end = end || S.today();
    var recent = S.list('symptom', { from: S.addDays(end, -13), to: end }), flags = [];
    var severe = recent.filter(function (e) { return typeof e.data.pain === 'number' && e.data.pain >= 8; });
    if (severe.length) flags.push(flag('watch', 'PAIN_SEVERE', 'Severe pain logged', severe.length + ' day(s) with pain 8/10 or more in the last two weeks. Pain that stops normal activities deserves a proper review.', severe[severe.length - 1].date));
    var low = recent.filter(function (e) { return e.data.mood === 'low' || e.data.mood === 'bad'; });
    /* after a birth, three low days in two weeks are enough to say so (four-persona review, 20 Oct: help must not wait for seven
     * records); otherwise most of at least a week of logged days */
    var pp = (S.profile() || {}).pregState === 'postpartum';
    if ((pp && low.length >= 3) || (recent.length >= 7 && low.length >= 5)) flags.push(flag('watch', 'MOOD_LOW', 'Low mood on ' + (pp ? 'several' : 'most') + ' logged days', low.length + ' of the last ' + recent.length + ' logged days were low. You deserve support, and you do not have to wait: mindline 1771 is open 24 hours, and your GP, polyclinic' + (pp ? ' or KKH' : '') + ' can help.', low[low.length - 1].date));
    var dizzyHeavy = recent.filter(function (e) {
      var heavy = S.byDate(e.date).some(function (x) { return x.type === 'period' && x.data.flow === 'heavy'; });
      return heavy && (e.data.symptoms || []).indexOf('dizziness') > -1;
    });
    if (dizzyHeavy.length) flags.push(flag('high', 'HEAVY_DIZZY', 'Heavy bleeding with dizziness', 'Heavy bleeding together with dizziness or faintness should be checked soon, today if it is happening now.', dizzyHeavy[dizzyHeavy.length - 1].date));
    var counts = {};
    recent.forEach(function (e) { (e.data.symptoms || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; }); });
    return { agent: 'symptomAgent', metrics: { days: recent.length, counts: counts }, flags: flags };
  }
  function foodAgent(end) {
    end = end || S.today();
    var meals = S.list('food', { from: S.addDays(end, -6), to: end }), tags = {}, days = {};
    meals.forEach(function (m) { days[m.date] = true; (m.data.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    var flags = [];
    if ((tags['alcohol'] || 0) >= 5) flags.push(flag('info', 'ALCOHOL_FREQ', 'Alcohol on 5+ meals this week', 'Noted as a pattern only. Alcohol can affect sleep quality and cycle symptoms.', end));
    if ((tags['late night'] || 0) >= 4) flags.push(flag('info', 'LATE_EATING', 'Several late-night meals', 'Late eating often shows up as lighter sleep the same night.', end));
    var nut = nutrientDays(meals);
    if (nut.days >= 3 && nut.avg.fiber !== null && nut.avg.fiber < 15 && nut.complete.fiber >= 3) flags.push(flag('info', 'FIBRE_LOW', 'Fibre looks low on logged days', 'Averaging ' + Math.round(nut.avg.fiber) + ' g per logged day; common guidance is 25 g or more for adults. Only days with complete entries count.', end));
    /* NOVA processing over the week: calories by group, ultra-processed share (ovu-nova.js). A metric only, never a flag. */
    var NV = root.OvuNova, processing = NV ? NV.share(NV.entriesItems(meals)) : null;
    return { agent: 'foodAgent', metrics: { meals: meals.length, daysLogged: Object.keys(days).length, tags: tags, nutrients: nut, processing: processing && processing.items ? { upfSharePctOfClassified: processing.coverage !== null && processing.coverage >= 0.5 && !processing.noKcal[4] ? NV.pct(processing.upfShare) : null, coveragePct: NV.pct(processing.coverage), itemsByGroup: processing.count, itemsWithoutCalories: processing.noKcal, freshlyMadeWithProcessedParts: processing.partsDishes, likelyEstimates: processing.likely } : null }, flags: flags };
  }
  /* Per-day nutrient totals from entries that carry database values. A day counts
     as complete for a nutrient only when every item that day has that value. */
  function nutrientDays(meals) {
    var keys = ['kcal', 'protein', 'carb', 'fat', 'fiber', 'fe', 'ca'], byDay = {};
    meals.forEach(function (m) { var d = byDay[m.date] = byDay[m.date] || { items: 0, missing: {}, totals: {} }; (m.data.items || []).forEach(function (it) { d.items++; keys.forEach(function (k) { var v = it.nutrients ? it.nutrients[k] : null; if (v === null || v === undefined) d.missing[k] = (d.missing[k] || 0) + 1; else d.totals[k] = (d.totals[k] || 0) + v; }); }); if (!(m.data.items || []).length) { keys.forEach(function (k) { d.missing[k] = (d.missing[k] || 0) + 1; }); } });
    var out = { days: 0, avg: {}, complete: {} };
    keys.forEach(function (k) { var sum = 0, n = 0; Object.keys(byDay).forEach(function (d) { if (!byDay[d].missing[k] && byDay[d].totals[k] !== undefined) { sum += byDay[d].totals[k]; n++; } }); out.avg[k] = n ? Math.round(sum / n * 10) / 10 : null; out.complete[k] = n; });
    out.days = Object.keys(byDay).length;
    return out;
  }
  function reflectionAgent(end) {
    end = end || S.today();
    var notes = S.list('reflection', { from: S.addDays(end, -13), to: end });
    var sessions = S.list('mindfulness', { from: S.addDays(end, -13), to: end });
    var minutes = sessions.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0);
    return { agent: 'reflectionAgent', metrics: { count: notes.length, sessions: sessionCount(sessions), minutes: Math.round(minutes) }, flags: [] };
  }
  var AGENTS = { sleepAgent: sleepAgent, cycleAgent: cycleAgent, symptomAgent: symptomAgent, foodAgent: foodAgent, reflectionAgent: reflectionAgent };

  function analyze(event) {
    var decision = supervisor(event), results = [];
    decision.tools.forEach(function (name) { results.push(AGENTS[name](event.date > S.today() ? S.today() : S.today())); });
    var flags = [];
    results.forEach(function (r) { r.flags.forEach(function (f) { if (!flags.some(function (x) { return x.code === f.code && x.date === f.date; })) flags.push(f); }); });
    return { decision: decision, results: results, flags: flags };
  }
  function allFlags(end) {
    var flags = [];
    Object.keys(AGENTS).forEach(function (k) { AGENTS[k](end).flags.forEach(function (f) { if (!flags.some(function (x) { return x.code === f.code && x.date === f.date; })) flags.push(f); }); });
    var rank = { high: 0, watch: 1, info: 2 };
    return flags.sort(function (a, b) { return rank[a.level] - rank[b.level]; });
  }

  /* ---------- Daily Summary agent ---------- */
  function fmtHours(h) { if (h === null || h === undefined) return ''; var H = Math.floor(h), M = Math.round((h - H) * 60); return H + 'h' + (M ? ' ' + M + 'm' : ''); }
  function dailySummary(date) {
    var entries = S.byDate(date), parts = [], highlights = [], bullets = [];
    var sleep = entries.filter(function (e) { return e.type === 'sleep'; })[0];
    var period = entries.filter(function (e) { return e.type === 'period'; })[0];
    var sym = entries.filter(function (e) { return e.type === 'symptom'; })[0];
    var food = entries.filter(function (e) { return e.type === 'food'; });
    var refl = entries.filter(function (e) { return e.type === 'reflection'; });
    var cs = S.cycleStats(date);
    if (sleep) { var h = S.sleepHours(sleep.data); bullets.push('bedtime'); parts.push('Slept ' + fmtHours(h) + (sleep.data.quality ? ' (quality ' + sleep.data.quality + '/5)' : '') + '.'); highlights.push({ icon: 'bedtime', text: fmtHours(h) + ' sleep' }); }
    if (period) { bullets.push('water_drop'); parts.push('Period day' + (cs.cycleDay ? ' ' + cs.cycleDay : '') + ', ' + period.data.flow + ' flow' + (period.data.clots ? ' with clots' : '') + '.'); highlights.push({ icon: 'water_drop', text: period.data.flow + ' flow' }); }
    else if (cs.cycleDay) { bullets.push('water_drop'); parts.push('Cycle day ' + cs.cycleDay + (cs.phase ? ', estimated ' + cs.phase + ' phase' : '') + '.'); }
    if (sym) { var list = (sym.data.symptoms || []); bullets.push('sentiment_satisfied'); parts.push((list.length ? 'Logged ' + list.join(', ') : 'No symptoms ticked') + (typeof sym.data.pain === 'number' ? ', pain ' + sym.data.pain + '/10' : '') + (sym.data.mood ? ', mood ' + sym.data.mood : '') + '.'); if (list.length) highlights.push({ icon: 'spa', text: list.slice(0, 2).join(', ') + (list.length > 2 ? ' +' + (list.length - 2) : '') }); }
    if (food.length) {
      var tags = {}, items = [], withItems = 0; food.forEach(function (f) { (f.data.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); if ((f.data.items || []).length) { withItems++; items = items.concat(f.data.items); } });
      var nutri = '';
      if (items.length && root.OvuFood) { var sm = root.OvuFood.sum(items); nutri = ' ' + (sm.totals.kcal !== null ? Math.round(sm.totals.kcal) + ' kcal' : '') + (sm.totals.protein !== null ? ', ' + Math.round(sm.totals.protein) + ' g protein' : '') + (sm.totals.fiber !== null ? ', ' + Math.round(sm.totals.fiber) + ' g fibre' : '') + (withItems < food.length ? ' from ' + withItems + ' of ' + food.length + ' entries' : '') + '.'; }
      bullets.push('restaurant'); parts.push(food.length + ' meal' + (food.length > 1 ? 's' : '') + ' logged' + (tags['home-cooked'] ? ' (' + tags['home-cooked'] + ' home-cooked)' : '') + '.' + nutri); highlights.push({ icon: 'restaurant', text: food.length + ' meal' + (food.length > 1 ? 's' : '') });
    }
    var mind = entries.filter(function (e) { return e.type === 'mindfulness'; });
    if (mind.length) { var mins = mind.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0); bullets.push('self_improvement'); parts.push(Math.round(mins) + ' min of mindfulness' + (mind.some(function (e) { return e.data.kind === 'erin'; }) ? ' with Erin' : '') + '.'); highlights.push({ icon: 'self_improvement', text: Math.round(mins) + ' min calm' }); }
    var moves = entries.filter(function (e) { return e.type === 'exercise'; });
    if (moves.length) { var mvMin = moves.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0), mvNames = []; moves.forEach(function (e) { var n = String(e.data.label || 'movement').toLowerCase(); if (mvNames.indexOf(n) < 0) mvNames.push(n); }); bullets.push('directions_run'); parts.push(Math.round(mvMin) + ' min of movement (' + mvNames.join(', ') + ').'); highlights.push({ icon: 'directions_run', text: Math.round(mvMin) + ' min moving' }); }
    if (refl.length) { bullets.push('edit_note'); parts.push(refl.length + ' reflection' + (refl.length > 1 ? 's' : '') + '.'); }
    var flags = allFlags(date).filter(function (f) { return f.date === date; });
    return { date: date, text: parts.length ? parts.join(' ') : 'Nothing logged this day.', items: parts.map(function (t, k) { return { icon: bullets[k] || 'circle', text: t }; }), highlights: highlights, flags: flags, count: entries.length, agent: 'DailySummaryAgent v1 (rule-based)' };
  }

  /* ---------- 4-Week Summary agent ---------- */
  function fourWeekSummary(end) {
    end = end || S.today();
    var from = S.addDays(end, -27);
    var events = S.list(null, { from: from, to: end });
    var daysWithEntries = {}; events.forEach(function (e) { daysWithEntries[e.date] = true; });
    var cs = S.cycleStats(end), sl = S.sleepStats(28, end);
    var periodDays = S.list('period', { from: from, to: end }).filter(function (e) { return e.data.flow && e.data.flow !== 'none'; });
    var symptoms = S.list('symptom', { from: from, to: end }), counts = {}, pain = [], moods = {};
    symptoms.forEach(function (e) { (e.data.symptoms || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; }); if (typeof e.data.pain === 'number') pain.push(e.data.pain); if (e.data.mood) moods[e.data.mood] = (moods[e.data.mood] || 0) + 1; });
    var top = Object.keys(counts).map(function (k) { return { name: k, days: counts[k] }; }).sort(function (a, b) { return b.days - a.days; }).slice(0, 6);
    var meals = S.list('food', { from: from, to: end }), tags = {}, foodDays = {};
    meals.forEach(function (m) { foodDays[m.date] = true; (m.data.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    var flags = allFlags(end).filter(function (f) { return !f.date || f.date >= from; });
    var questions = [];
    flags.forEach(function (f) {
      var q = ({ CYCLE_SHORT: 'My cycles have been shorter than 24 days. Is that something to look into?', CYCLE_LONG: 'My cycles have been longer than 38 days. Should we check hormones or thyroid?', BLEED_LONG: 'My period lasted more than 8 days. What could cause that?', BLEED_HEAVY_IMPACT: 'Heavy bleeding is affecting my day. Could I be low in iron, and what are my options?', SLEEP_SHORT_AVG: 'I am averaging under 6 hours of sleep. Could my cycle or stress be part of it?', SLEEP_SHORT_RUN: 'I had several nights under 5 hours. What should I try first?', PAIN_SEVERE: 'My pain reached 8/10. Could this be more than typical cramps?', MOOD_LOW: 'My mood has been low on most days. What support is available?', SPOTTING_BETWEEN: 'I have had spotting between periods. Should this be checked?', PERIOD_LATE: 'My period is overdue. What should I rule out?', GAP_LONG: 'There was a gap of more than 60 days between my logged periods. If no period came in that time, what should we check?', POSTMENO_BLEED: 'I had bleeding after menopause and understand this needs checking.', HEAVY_DIZZY: 'I felt dizzy during heavy bleeding. Should I be checked for anaemia?' })[f.code];
      if (q && questions.indexOf(q) < 0) questions.push(q);
    });
    return {
      agent: 'FourWeekSummaryAgent v1 (rule-based)', generatedAt: new Date().toISOString(), range: { from: from, to: end },
      coverage: { daysWithEntries: Object.keys(daysWithEntries).length, totalDays: 28 },
      cycle: { periodDays: periodDays.length, episodes: cs.episodes.filter(function (ep) { return ep.end >= from; }).map(function (ep) { return { start: ep.start, end: ep.end, length: ep.length, heavyDays: ep.heavyDays }; }), cycleLengths: cs.lengths.slice(-6), averageLength: cs.averageLength, lastStart: cs.lastStart, predictedNext: cs.predictedNext, cycleDay: cs.cycleDay, phase: cs.phase, basis: cs.basis },
      sleep: { nights: sl.count, average: sl.avg, under6: sl.under6, series: sl.nights.map(function (n) { return { date: n.date, hours: n.hours, quality: n.quality }; }) },
      symptoms: { daysLogged: symptoms.length, top: top, painAvg: pain.length ? Math.round(pain.reduce(function (a, b) { return a + b; }, 0) / pain.length * 10) / 10 : null, painMax: pain.length ? Math.max.apply(null, pain) : null, moods: moods },
      food: { meals: meals.length, daysLogged: Object.keys(foodDays).length, tags: tags, nutrients: nutrientDays(meals) },
      mindfulness: (function () { var ss = S.list('mindfulness', { from: from, to: end }); return { sessions: sessionCount(ss), minutes: Math.round(ss.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0)) }; })(),
      /* self-reported movement over the 28 days: totals only, no score (ovu-exercise.js has the weekly WHO view) */
      /* metMinutes covers entries with a known MET only; metUnknownSessions says how many had none (never counted as zero) */
      movement: (function () { var ex = S.list('exercise', { from: from, to: end }), days = {}, sdays = {}, met = 0, known = 0; ex.forEach(function (e) { days[e.date] = 1; if (e.data.strength) sdays[e.date] = 1; if (typeof e.data.met === 'number' && e.data.met > 0) { known++; met += e.data.met * (Number(e.data.minutes) || 0); } }); return { sessions: ex.length, minutes: Math.round(ex.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0)), activeDays: Object.keys(days).length, strengthDays: Object.keys(sdays).length, metMinutes: known ? Math.round(met) : null, metUnknownSessions: ex.length - known }; })(),
      flags: flags, questions: questions,
      disclaimer: 'Self-reported entries summarised by deterministic rules in the browser. For clinician review; not a diagnosis.'
    };
  }
  function saveMonthlySummary() {
    var db = S.load(), sum = fourWeekSummary();
    if (root.OvuInsight) sum.insight = root.OvuInsight.cachedFourWeeks(sum.range.to) || null; /* the model-written prose rides along with the rule summary */
    db.summaries = (db.summaries || []).filter(function (s) { return s.range.to !== sum.range.to; });
    db.summaries.push(sum);
    S.setState({ lastSummaryAt: sum.generatedAt });
    return sum;
  }

  root.OvuAgents = { SYMPTOMS: SYMPTOMS, MOODS: MOODS, FOOD_TAGS: FOOD_TAGS, supervisor: supervisor, analyze: analyze, allFlags: allFlags, dailySummary: dailySummary, fourWeekSummary: fourWeekSummary, dismissFlag: dismissFlag, saveMonthlySummary: saveMonthlySummary, agents: AGENTS, fmtHours: fmtHours };
})(window);
