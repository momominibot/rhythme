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
  var SYMPTOMS = ['cramps', 'headache', 'bloating', 'breast tenderness', 'back pain', 'fatigue', 'nausea', 'acne', 'cravings', 'insomnia', 'hot flushes', 'dizziness', 'spotting', 'discharge change', 'low mood', 'anxiety', 'irritability', 'brain fog', 'vaginal dryness', 'urinary discomfort', 'pain during sex']; /* the last three from the four-persona review, 20 Oct */
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
    /* pain during sex is worth a review at any age (RCOG, ACOG); it is named once, never counted as a score */
    var sexPain = S.list('symptom', { from: S.addDays(end, -27), to: end }).filter(function (e) { return (e.data.symptoms || []).indexOf('pain during sex') > -1; });
    if (sexPain.length) flags.push(flag('watch', 'SEX_PAIN', 'Pain during sex', 'Logged on ' + sexPain.length + ' day' + (sexPain.length > 1 ? 's' : '') + ' in the last 4 weeks. Pain during or after sex is worth raising with your GP or polyclinic; there are often simple things that help.', sexPain[sexPain.length - 1].date));
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
    var chk = S.latestOnDate ? S.latestOnDate('sleepcheck', date) : entries.filter(function (e) { return e.type === 'sleepcheck'; }).slice(-1)[0]; /* the newest edit of the day's check, whatever a sync brought */
    if (chk) { var cn = sleepCheckNotes(chk.data).filter(function (x) { return x.level !== 'info'; }).length; bullets.push('fact_check'); parts.push('Two-week sleep check done' + (cn ? ', ' + cn + ' note' + (cn === 1 ? '' : 's') + ' raised' : '') + '.'); }
    var flags = allFlags(date).filter(function (f) { return f.date === date; });
    return { date: date, text: parts.length ? parts.join(' ') : 'Nothing logged this day.', items: parts.map(function (t, k) { return { icon: bullets[k] || 'circle', text: t }; }), highlights: highlights, flags: flags, count: entries.length, agent: 'DailySummaryAgent v1 (rule-based)' };
  }

  /* ---------- 4-Week Summary agent ---------- */
  /* what the clinician should know before reading the numbers, all self-reported (four-persona review, 20 Oct: Nadia's export
   * left out the birth, breastfeeding and paused predictions; Siti's left out her medicines) */
  var HORMONE_NAMES = { pill: 'combined pill', pop: 'progestogen-only pill', iud_h: 'hormonal IUD', iud_cu: 'copper IUD', implant: 'implant or injection', hrt: 'HRT (MHT)', fertility: 'fertility medicines', ec: 'emergency contraception recently', other: 'another relevant medicine' };
  function contextLines(p) {
    p = p || {}; var out = [];
    if (isPostmenopausal(p)) out.push('After menopause: 12 months or more without a period');
    else if (p.lifeStage === 'peri') out.push('Perimenopause signs reported (hot flushes or night sweats)');
    if (p.pregState === 'pregnant') out.push('Pregnant');
    if (p.pregState === 'maybe') out.push('Could be pregnant');
    if (p.pregState === 'postpartum') out.push('Gave birth in the last year' + (p.breastfeeding === 'yes' ? ', breastfeeding' : p.breastfeeding === 'no' ? ', not breastfeeding' : '') + (p.periodsBack === 'no' ? ', periods not back yet' : p.periodsBack === 'yes' ? ', periods back' : ''));
    if (p.pregState === 'loss') out.push('Recent pregnancy loss');
    if (p.plans === 'ttc') out.push('Trying to conceive' + (p.ttcMonths ? ' (' + p.ttcMonths + ' months)' : '') + (p.fertilityTx === 'yes' ? ', had fertility treatment before' : ''));
    var hs = (p.hormones || []).filter(function (h) { return HORMONE_NAMES[h]; }).map(function (h) { return HORMONE_NAMES[h]; });
    if (hs.length) out.push('Uses: ' + hs.join(', '));
    var mode = (function () { try { return S.cycleStats().mode; } catch (e) { return p.predictionMode; } })();
    if (mode === 'suspended') out.push('Cycle predictions are paused for this situation');
    return out;
  }
  function fourWeekSummary(end) {
    end = end || S.today();
    var from = S.addDays(end, -27);
    var events = S.list(null, { from: from, to: end });
    var daysWithEntries = {}; events.forEach(function (e) { daysWithEntries[e.date] = true; });
    var cs = S.cycleStats(end), sl = S.sleepStats(28, end);
    var periodDays = S.list('period', { from: from, to: end }).filter(function (e) { return e.data.flow && e.data.flow !== 'none'; });
    var symptoms = S.list('symptom', { from: from, to: end }), counts = {}, pain = [], moods = {};
    var flush = { days: 0, counted: 0, total: 0, nightsWoken: 0 };
    symptoms.forEach(function (e) { (e.data.symptoms || []).forEach(function (s) { counts[s] = (counts[s] || 0) + 1; }); if (typeof e.data.pain === 'number') pain.push(e.data.pain); if (e.data.mood) moods[e.data.mood] = (moods[e.data.mood] || 0) + 1;
      if ((e.data.symptoms || []).indexOf('hot flushes') > -1) { flush.days++; if (typeof e.data.flushes === 'number') { flush.counted++; flush.total += e.data.flushes; } if (e.data.flushNight) flush.nightsWoken++; } });
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
      cycle: { filledDays: periodDays.filter(function (e) { return e.data.autofill; }).length, periodDays: periodDays.length, episodes: cs.episodes.filter(function (ep) { return ep.end >= from; }).map(function (ep) { return { start: ep.start, end: ep.end, length: ep.length, heavyDays: ep.heavyDays }; }), cycleLengths: cs.lengths.slice(-6), averageLength: cs.averageLength, lastStart: cs.lastStart, predictedNext: cs.predictedNext, cycleDay: cs.cycleDay, phase: cs.phase, basis: cs.basis },
      sleep: { nights: sl.count, average: sl.avg, under6: sl.under6, series: sl.nights.map(function (n) { return { date: n.date, hours: n.hours, quality: n.quality }; }) },
      context: contextLines(S.profile()),
      symptoms: { flushes: flush, daysLogged: symptoms.length, top: top, painAvg: pain.length ? Math.round(pain.reduce(function (a, b) { return a + b; }, 0) / pain.length * 10) / 10 : null, painMax: pain.length ? Math.max.apply(null, pain) : null, moods: moods },
      food: { meals: meals.length, daysLogged: Object.keys(foodDays).length, tags: tags, nutrients: nutrientDays(meals) },
      mindfulness: (function () { var ss = S.list('mindfulness', { from: from, to: end }); return { sessions: sessionCount(ss), minutes: Math.round(ss.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0)) }; })(),
      /* self-reported movement over the 28 days: totals only, no score (ovu-exercise.js has the weekly WHO view) */
      /* metMinutes covers entries with a known MET only; metUnknownSessions says how many had none (never counted as zero) */
      movement: (function () { var ex = S.list('exercise', { from: from, to: end }), days = {}, sdays = {}, met = 0, known = 0; ex.forEach(function (e) { days[e.date] = 1; if (e.data.strength) sdays[e.date] = 1; if (typeof e.data.met === 'number' && e.data.met > 0) { known++; met += e.data.met * (Number(e.data.minutes) || 0); } }); return { sessions: ex.length, minutes: Math.round(ex.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0)), activeDays: Object.keys(days).length, strengthDays: Object.keys(sdays).length, metMinutes: known ? Math.round(met) : null, metUnknownSessions: ex.length - known }; })(),
      flags: flags, questions: questions,
      disclaimer: 'Self-reported entries summarised by deterministic rules in the browser. For clinician review; not a diagnosis.'
    };
  }
  /* ---------- Cycle history: the trend over months, for the journal, the share, the Doctor view and the PDF ----------
   * Clinical history, not the prediction: every interval between two logged starts is kept as a dated row, gaps over
   * 60 days included, with the reason they are left out of the numbers (the same product rule as cycleStats, not a
   * clinical threshold). Episodes use bleeding days only (spotting stays an observation) and are clipped to the range end.
   * Recorded bleeding days and the span are reported apart: a bridged day is a missing day, never a bleeding day.
   * Pain is the highest pain actually recorded on that period's days, or null; missing never reads as zero.
   * No normal or irregular labels: FIGO 2018 is printed as a reference beside the numbers (Codex design review, 20 Oct). */
  var IMPORTED = { 'apple-health': 1, 'google-fit': 1 };
  function cycleHistory(from, to) {
    to = to || S.today();
    var eps = S.periodEpisodes().filter(function (ep) { return ep.start <= to; }).map(function (ep) {
      var days = ep.days.filter(function (d) { return d.date <= to; });
      return { start: ep.start, end: days[days.length - 1].date, days: days };
    });
    var painOn = {};
    S.list('symptom', { to: to }).forEach(function (e) { if (typeof e.data.pain === 'number') painOn[e.date] = Math.max(painOn[e.date] === undefined ? 0 : painOn[e.date], e.data.pain); });
    var rows = [];
    eps.forEach(function (ep, i) {
      var next = eps[i + 1];
      if (from && ep.start < from && next && next.start < from) return; /* an interval that runs into the range is kept, and so is a period still open at its start */
      var interval = next ? S.diffDays(ep.start, next.start) : null, pain = null, span = S.diffDays(ep.start, ep.end) + 1;
      ep.days.forEach(function (d) { if (painOn[d.date] !== undefined) pain = Math.max(pain === null ? 0 : pain, painOn[d.date]); });
      rows.push({
        start: ep.start, end: ep.end, beforeRange: !!(from && ep.start < from),
        interval: interval, nextStart: next ? next.start : null, current: !next, sinceStart: next ? null : S.diffDays(ep.start, to) + 1,
        counted: interval !== null && interval <= 60, excluded: interval !== null && interval > 60 ? 'gap over 60 days: a break in the record, not counted as a cycle' : null,
        bleedDays: ep.days.length, span: span, missingDays: span - ep.days.length,
        heavyDays: ep.days.filter(function (d) { return d.data.flow === 'heavy'; }).length,
        flowUnrecorded: ep.days.filter(function (d) { return d.data.flow === 'unspecified'; }).length,
        largeClots: ep.days.some(function (d) { return !!d.data.largeClots; }), flooding: ep.days.some(function (d) { return !!d.data.flooding; }),
        autofilled: ep.days.filter(function (d) { return !!d.data.autofill; }).length,
        imported: ep.days.filter(function (d) { return !!IMPORTED[d.source]; }).length,
        painMax: pain
      });
    });
    var lens = rows.filter(function (r) { return r.counted && !r.beforeRange; }).map(function (r) { return r.interval; });
    var sorted = lens.slice().sort(function (x, y) { return x - y; }), mid = Math.floor(sorted.length / 2);
    var start = from || (rows[0] && rows[0].start) || to, spanDays = S.diffDays(start, to) + 1, logged = {};
    S.list(null, { from: start, to: to }).forEach(function (e) { logged[e.date] = 1; });
    return {
      range: { from: start, to: to, days: spanDays }, rows: rows,
      coverage: { daysWithEntries: Object.keys(logged).length, days: spanDays },
      stats: {
        starts: rows.filter(function (r) { return !r.beforeRange; }).length, intervals: lens.length,
        excluded: rows.filter(function (r) { return r.excluded && !r.beforeRange; }).length,
        median: sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : null, /* exact: 28 and 29 give 28.5 */
        shortest: sorted.length ? sorted[0] : null, longest: sorted.length ? sorted[sorted.length - 1] : null,
        variation: sorted.length >= 2 ? sorted[sorted.length - 1] - sorted[0] : null,
        longestBleed: rows.length ? Math.max.apply(null, rows.map(function (r) { return r.bleedDays; })) : null,
        heavyPeriods: rows.filter(function (r) { return r.heavyDays > 0; }).length
      },
      reference: 'FIGO 2018 (non-pregnant, reproductive years): cycles of 24 to 38 days; bleeding up to 8 days; shortest to longest cycle within 7 to 9 days depending on age. A reference, not a verdict: two or three intervals describe what was recorded, they do not establish a pattern.',
      limits: 'Self-reported. Missing days are not absence of bleeding or symptoms. Intervals run from one logged first bleeding day to the next.'
    };
  }
  /* ---------- Ranges in calendar months, and month-by-month totals ----------
   * "6 months" ending 20 Oct starts 21 Apr: the same day of the month n months back, plus one day, clamped to the end of
   * shorter months (31 Mar back one month is 28 Feb, so the range is 1 to 31 Mar). Week arithmetic called 364 days
   * "12 months" (Codex diff review, 20 Oct). */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function monthsBack(end, n) {
    var y = +end.slice(0, 4), m = +end.slice(5, 7) - 1 - n, d = +end.slice(8, 10);
    var first = new Date(Date.UTC(y, m, 1)), last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    return S.addDays(first.getUTCFullYear() + '-' + pad2(first.getUTCMonth() + 1) + '-' + pad2(Math.min(d, last)), 1);
  }
  /* what a longer share keeps of everything, so older meals, movement and calm are counted even when their entries stay home */
  function monthlyTotals(from, to) {
    var by = {}, order = [];
    function m(k) { if (!by[k]) { by[k] = { month: k, from: null, to: null, daysWithEntries: 0, bleedingDays: 0, filledDays: 0, symptomDays: 0, sleepNights: 0, meals: 0, foodDays: 0, movementSessions: 0, movementMinutes: 0, calmSessions: 0, calmMinutes: 0, _d: {}, _f: {}, _b: {}, _a: {}, _c: [] }; order.push(k); } return by[k]; }
    for (var d = from; d <= to; d = S.addDays(d, 1)) { var o = m(d.slice(0, 7)); if (!o.from) o.from = d; o.to = d; }
    S.list(null, { from: from, to: to }).forEach(function (e) {
      var o = m(e.date.slice(0, 7)); o._d[e.date] = 1;
      if (e.type === 'period' && e.data.flow && e.data.flow !== 'none' && e.data.flow !== 'spotting') { if (e.data.autofill) o._a[e.date] = 1; else o._b[e.date] = 1; } /* filled-in days are counted apart, never as recorded bleeding */
      if (e.type === 'symptom') o.symptomDays++;
      if (e.type === 'food') { o.meals++; o._f[e.date] = 1; }
      if (e.type === 'exercise') { o.movementSessions++; o.movementMinutes += Number(e.data.minutes) || 0; }
      if (e.type === 'mindfulness') { o._c.push(e); o.calmMinutes += Number(e.data.minutes) || 0; }
    });
    S.sleepStats(S.diffDays(from, to) + 1, to).nights.forEach(function (n) { if (by[n.date.slice(0, 7)]) by[n.date.slice(0, 7)].sleepNights++; });
    return order.map(function (k) { var o = by[k]; o.daysWithEntries = Object.keys(o._d).length; o.foodDays = Object.keys(o._f).length; o.bleedingDays = Object.keys(o._b).length; o.filledDays = Object.keys(o._a).filter(function (d) { return !o._b[d]; }).length; o.calmSessions = sessionCount(o._c); o.movementMinutes = Math.round(o.movementMinutes); o.calmMinutes = Math.round(o.calmMinutes); o.days = S.diffDays(o.from, o.to) + 1; delete o._d; delete o._f; delete o._b; delete o._a; delete o._c; return o; });
  }
  /* ---------- Patterns: one row of marks per day, for the month calendars ----------
   * Display bins only, not severity grades: bleeding by recorded flow, pain 0 / 1-3 / 4-6 / 7-10 only when a number was
   * recorded, sleep < 6 / 6 to < 7 / 7 to 9 / > 9 hours from merged nights on the morning date (AASM: at least 7 for adults;
   * more than 9 can be right, so it is never shown as a failure). No stress score. */
  function painBand(n) { return n === 0 ? 0 : n <= 3 ? 1 : n <= 6 ? 2 : 3; }
  function sleepBand(h) { return h < 6 ? 0 : h < 7 ? 1 : h <= 9 ? 2 : 3; }
  function patternDays(from, to) {
    to = to || S.today();
    var out = {}, d;
    for (d = from; d <= to; d = S.addDays(d, 1)) out[d] = { date: d, flow: null, autofill: false, pain: null, painBand: null, symptoms: null, none: false, mood: null, sleep: null, sleepBand: null, entries: 0 };
    S.list(null, { from: from, to: to }).forEach(function (e) {
      var o = out[e.date]; if (!o) return; o.entries++;
      if (e.type === 'period' && e.data.flow && e.data.flow !== 'none') { o.flow = e.data.flow; o.autofill = !!e.data.autofill; }
      if (e.type === 'symptom') {
        if (typeof e.data.pain === 'number') { o.pain = o.pain === null ? e.data.pain : Math.max(o.pain, e.data.pain); o.painBand = painBand(o.pain); }
        o.symptoms = (o.symptoms || []).concat(e.data.symptoms || []); if (e.data.none) o.none = true; if (e.data.mood) o.mood = e.data.mood;
      }
    });
    var answers = S.load().state.checkin || {};
    Object.keys(out).forEach(function (k) { var a = answers[k]; if (!a) return; if (a.bleeding && !out[k].flow) out[k].bleedAnswer = a.bleeding; if (a.sleep) out[k].sleepAnswer = a.sleep; if (a.mood && !out[k].mood) out[k].moodAnswer = a.mood; });
    S.sleepStats(S.diffDays(from, to) + 1, to).nights.forEach(function (n) { var o = out[n.date]; if (o) { o.sleep = n.hours; o.sleepBand = sleepBand(n.hours); delete o.sleepAnswer; } });
    return Object.keys(out).sort().map(function (k) { return out[k]; });
  }
  /* ---------- Today's check-in: what is recorded today, at a glance ----------
   * Six tiles; a few are "key" and the tick means those were answered today. "None" and "not sure" are full answers; a
   * missing day is never read as nothing happening. No health verdict, no streak, no hearts for the tick (the logs
   * themselves earn as before). Bleeding is key only while periods are expected: not after menopause, in pregnancy,
   * after a birth until she says periods are back, with predictions paused (hormonal methods, hysterectomy) or when
   * nothing says she menstruates. She can choose what counts (choice) (Codex design review, 20 Oct). */
  var CHECK_TILES = [['bleeding', 'Bleeding', 'water_drop'], ['sleep', 'Sleep', 'bedtime'], ['symptoms', 'Symptoms & mood', 'sentiment_satisfied'], ['food', 'Food', 'restaurant'], ['movement', 'Movement', 'directions_run'], ['calm', 'Calm', 'self_improvement']];
  function bleedingExpected(p, cs) {
    if (isPostmenopausal(p) || p.pregState === 'pregnant' || p.pregState === 'maybe') return false;
    if (p.pregState === 'postpartum' && p.periodsBack !== 'yes') return false;
    if (cs.mode === 'suspended' || p.periodsStarted === 'no') return false;
    return p.periodsStarted === 'yes' || !!p.regularity || S.list('period').length > 0;
  }
  function defaultKeys(p, cs) { return { bleeding: bleedingExpected(p, cs), sleep: true, symptoms: true, food: true, movement: false, calm: false }; }
  function todayCheckIn(date, choice) {
    date = date || S.today();
    var p = S.profile(), cs = S.cycleStats(date), ans = S.checkinAnswers(date), ent = S.byDate(date);
    var keys = Object.assign(defaultKeys(p, cs), choice || {});
    function of(t) { return ent.filter(function (e) { return e.type === t; }); }
    var out = {};
    var SRCNAME = { 'apple-health': 'from Apple Health', 'google-fit': 'from Google' };
    var per = of('period').filter(function (e) { return e.data.flow && e.data.flow !== 'none'; })[0];
    /* a day the calendar filled in as typical is not confirmed, so it never earns the tick until she checks the flow */
    out.bleeding = per && per.data.autofill ? { state: 'partial', value: 'Filled in', sub: 'check the flow' }
      : per ? { state: 'done', value: per.data.flow === 'unspecified' ? 'Logged' : per.data.flow.charAt(0).toUpperCase() + per.data.flow.slice(1), sub: SRCNAME[per.source] || (per.data.flow === 'spotting' ? 'spotting' : 'flow today') }
      : ans.bleeding === 'none' ? { state: 'done', value: 'None', sub: 'no bleeding today', answer: true } : ans.bleeding === 'unsure' ? { state: 'unsure', value: 'Not sure', sub: 'answered', answer: true } : null;
    var night = S.sleepStats(1, date).nights[0], nightSrc = of('sleep').map(function (e) { return SRCNAME[e.source]; }).filter(Boolean)[0];
    out.sleep = night ? { state: 'done', value: fmtHours(night.hours), sub: nightSrc || 'last night' } : ans.sleep === 'unsure' ? { state: 'unsure', value: 'Not sure', sub: 'answered', answer: true } : null;
    var sym = of('symptom'), list = [], none = false, mood = '';
    sym.forEach(function (e) { list = list.concat(e.data.symptoms || []); if (e.data.none) none = true; if (e.data.mood) mood = e.data.mood; });
    var symAns = list.length || none, moodAns = mood || ans.mood === 'unsure';
    out.symptoms = symAns && moodAns ? { state: 'done', value: (list.length ? (list.length === 1 ? list[0].charAt(0).toUpperCase() + list[0].slice(1) : list.length + ' symptoms') : 'None'), sub: mood ? 'mood ' + mood : 'mood not sure', answer: !mood }
      : symAns || moodAns ? { state: 'partial', value: symAns ? 'Mood?' : 'Symptoms?', sub: symAns ? 'add your mood' : 'tick symptoms or None', answer: !mood && !!moodAns } : null;
    var meals = of('food');
    out.food = meals.length ? { state: 'done', value: meals.length + (meals.length === 1 ? ' meal' : ' meals'), sub: 'logged' } : ans.food === 'skip' ? { state: 'done', value: 'Not today', sub: 'nothing to log', answer: true } : null;
    var mv = of('exercise'); out.movement = mv.length ? { state: 'done', value: Math.round(mv.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0)) + ' min', sub: 'movement' } : null;
    var mi = of('mindfulness'); out.calm = mi.length ? { state: 'done', value: Math.round(mi.reduce(function (a, e) { return a + (Number(e.data.minutes) || 0); }, 0)) + ' min', sub: 'calm' } : null;
    var tiles = CHECK_TILES.map(function (t) {
      var r = out[t[0]] || { state: keys[t[0]] ? 'add' : 'optional', value: keys[t[0]] ? 'Add' : 'Optional', sub: '' };
      return { id: t[0], label: t[1], icon: t[2], key: !!keys[t[0]], state: r.state, value: r.value, sub: r.sub, answer: !!r.answer, recorded: r.state === 'done' || r.state === 'unsure' };
    });
    var key = tiles.filter(function (t) { return t.key; }), done = key.filter(function (t) { return t.recorded; });
    return { date: date, tiles: tiles, keyCount: key.length, keyDone: done.length, complete: key.length > 0 && done.length === key.length, defaults: defaultKeys(p, cs) };
  }
  function saveMonthlySummary() {
    var db = S.load(), sum = fourWeekSummary();
    if (root.OvuInsight) sum.insight = root.OvuInsight.cachedFourWeeks(sum.range.to) || null; /* the model-written prose rides along with the rule summary */
    db.summaries = (db.summaries || []).filter(function (s) { return s.range.to !== sum.range.to; });
    db.summaries.push(sum);
    S.setState({ lastSummaryAt: sum.generatedAt });
    return sum;
  }

  /* ---------- sleep details and the two-week sleep check ----------
   * Rhythme's own optional questions (codes in ovu-store.js). Nothing here is a score or a diagnosis: patterns are counts
   * over the nights that answered, "not sure" is counted apart, and a blank question is unknown, never zero. The
   * 30-minute marker is a common research cut-off (Lichstein 2003, E79), labelled as Rhythme's marker wherever it shows. */
  var SLEEP_LABELS = {
    latency: { q: 'Falling asleep took about', hint: '', opts: [['le15', '15 min or less'], ['16-30', '16 to 30 min'], ['31-60', '31 to 60 min'], ['gt60', 'Over an hour'], ['unsure', 'Not sure']] },
    wakeups: { q: 'Times you woke in the night', hint: 'Leave out the final waking in the morning.', opts: [['0', 'None'], ['1', '1'], ['2', '2'], ['3', '3'], ['4+', '4 or more'], ['unsure', 'Not sure']] },
    awake: { q: 'Time awake in the night, all together', hint: '', opts: [['le15', 'Up to 15 min'], ['16-30', '16 to 30 min'], ['31-60', '31 to 60 min'], ['61-120', '1 to 2 hours'], ['gt120', 'Over 2 hours'], ['unsure', 'Not sure']] },
    early: { q: 'Woke earlier than you wanted and could not get back to sleep', hint: '', opts: [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']] },
    woke: { q: 'What woke you?', hint: 'Tick any that fit.', opts: [['flush', 'Hot flush or night sweat'], ['cramps', 'Cramps or period pain'], ['toilet', 'Needed the toilet'], ['child', 'Baby or child'], ['snoring', 'Someone snoring'], ['noise', 'Noise or light'], ['worry', 'Worry or a busy mind'], ['pain', 'Other pain'], ['gasp', 'Woke gasping or choking'], ['other', 'Something else']] },
    rested: { q: 'How rested did you feel on waking?', hint: '', opts: [['1', 'Not at all'], ['2', 'A little'], ['3', 'Moderately'], ['4', 'Quite'], ['5', 'Fully'], ['unsure', 'Not sure']] }
  };
  var CHECK_LABELS = {
    w1: { q: 'In the last 7 days, on how many nights was sleep hard?', hint: 'Trouble falling asleep, staying asleep, or waking too early.', opts: ['0', '1', '2', '3', '4', '5', '6', '7'].map(function (n) { return [n, n]; }).concat([['unsure', 'Not sure']]) },
    w2: { q: 'And in the 7 days before that?', hint: '', opts: ['0', '1', '2', '3', '4', '5', '6', '7'].map(function (n) { return [n, n]; }).concat([['unsure', 'Not sure']]) },
    chance: { q: 'Did you have enough time and a suitable place to sleep?', hint: '', opts: [['usually', 'Usually'], ['sometimes', 'Sometimes'], ['rarely', 'Rarely'], ['unsure', 'Not sure']] },
    impact: { q: 'How much has sleep trouble affected your days?', hint: 'Mood, energy, focus or work.', opts: [['none', 'Not at all'], ['little', 'A little'], ['lot', 'A lot'], ['unsure', 'Not sure']] },
    since: { q: 'How long has sleep been like this?', hint: '', opts: [['lt2w', 'Under 2 weeks'], ['2w-3m', '2 weeks to 3 months'], ['3m+', '3 months or more'], ['unsure', 'Not sure']] },
    breathing: { q: 'Has anyone noticed loud snoring, gasping, or pauses in your breathing while you sleep?', hint: '', opts: [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure, or I sleep alone']] },
    legs: { q: 'Do your legs get an urge to move, often with uncomfortable feelings, that comes on when resting in the evening or at night and eases when you move?', hint: '', opts: [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']] },
    driving: { q: 'In these two weeks, have you felt sleepy while driving, or nodded off at the wheel?', hint: '', opts: [['yes', 'Yes'], ['no', 'No'], ['nodrive', 'I do not drive']] }
  };
  var CHECK_ORDER = ['w1', 'w2', 'chance', 'impact', 'since', 'breathing', 'legs', 'driving'];
  var DETAIL_ORDER = ['latency', 'wakeups', 'awake', 'early', 'woke', 'rested'];
  function optLabel(map, k, v) { var o = (map[k] && map[k].opts || []).filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : ''; }
  /* one night's details: entries on the same date are read newest first, so a later answer wins; reasons for waking add up */
  function nightDetails(date) {
    var es = S.list('sleep', { from: date, to: date }).filter(function (e) { return e.data && e.data.details; }).map(function (e, i) { return { e: e, i: i }; })
      .sort(function (a, b) { var ta = String(a.e.updatedAt || a.e.createdAt || ''), tb = String(b.e.updatedAt || b.e.createdAt || ''); return tb > ta ? 1 : tb < ta ? -1 : (b.i - a.i); }).map(function (x) { return x.e; }); /* newest edit first; on a tie the later entry (Codex, 21 Oct) */
    var out = null;
    es.forEach(function (e) {
      var d = S.cleanSleepDetails(e.data.details); if (!d) return; out = out || {};
      Object.keys(d).forEach(function (k) { if (k === 'woke') { out.woke = (out.woke || []).concat(d.woke.filter(function (c) { return (out.woke || []).indexOf(c) < 0; })); } else if (out[k] === undefined) out[k] = d[k]; });
    });
    if (out && out.wakeups === '0') delete out.awake;
    return out;
  }
  var DETAIL_MARK = { latency: ['31-60', 'gt60'], wakeups: ['2', '3', '4+'], awake: ['31-60', '61-120', 'gt120'], early: ['yes'], rested: ['1', '2'] };
  function sleepCheckNotes(a) {
    a = S.cleanSleepCheck(a || {}); var out = [], n = function (v) { return v === undefined || v === 'unsure' ? null : Number(v); };
    if (a.driving === 'yes') out.push({ level: 'today', code: 'SLEEP_DROWSY_DRIVING', title: 'Sleepy at the wheel is dangerous', trigger: 'feeling sleepy while driving',
      message: 'If you feel sleepy while driving, pull over somewhere safe and stop. An open window or loud music will not keep you awake. Please do not drive while sleepy, and see a doctor soon about why you are this sleepy.' });
    if (a.breathing === 'yes') out.push(breathingNote());
    if (a.legs === 'yes') out.push({ level: 'prompt', code: 'SLEEP_LEGS', title: 'Worth raising: restless legs', trigger: 'an urge to move the legs at rest',
      message: 'An urge to move your legs that comes on at rest in the evening and eases when you move can be restless legs syndrome. It is more common in women and in pregnancy. Mention it to your GP, and say if your periods are heavy: low iron can play a part, and a blood test can check it. It is best to have that test before taking iron.' });
    var worst = Math.max(n(a.w1) || 0, n(a.w2) || 0);
    if (worst >= 3 && (a.impact === 'little' || a.impact === 'lot')) out.push({ level: 'prompt', code: 'SLEEP_PERSISTENT', title: 'Worth raising: ongoing sleep trouble', trigger: 'sleep trouble on 3 or more nights a week that affects the day',
      message: a.since === '3m+'
        ? 'You reported trouble sleeping on ' + worst + ' nights in one of the last two weeks, with an effect on your days, and say it has gone on for 3 months or more. That is worth talking through with a doctor, who can say whether it is chronic insomnia. For chronic insomnia the recommended first treatment is a talking therapy (CBT-I), not sleeping pills.'
        : 'Trouble sleeping on ' + worst + ' nights in a week, with an effect on your days, is worth talking through with a doctor or nurse. You do not need to wait for it to last for months.' });
    if (a.chance === 'rarely') out.push({ level: 'info', code: 'SLEEP_OPPORTUNITY', title: 'Time and place to sleep', trigger: 'rarely enough time or a suitable place to sleep',
      message: 'You said you rarely have enough time or a suitable place to sleep. Sleep cut short by too little time or a hard place to sleep is a different problem from insomnia, and it is worth telling a clinician about too.' });
    return out;
  }
  function breathingNote() {
    return { level: 'prompt', code: 'SLEEP_BREATHING', title: 'Worth raising: breathing at night', trigger: 'snoring, gasping or pauses in breathing during sleep',
      message: 'Loud snoring, gasping or choking, or pauses in breathing during sleep can be signs of sleep apnoea. Please book a visit with your GP or a polyclinic to talk about it, even if you do not feel sleepy in the day. If you are pregnant, or you drive or work with machinery for a living, say so when you book: the guideline asks for a faster assessment then.' };
  }
  function sleepNotes(from, to) {
    var dates = {}, nights = S.sleepStats(S.diffDays(from, to) + 1, to).nights;
    nights.forEach(function (x) { dates[x.date] = 1; });
    S.list('sleep', { from: from, to: to }).forEach(function (e) { if (e.data && e.data.details) dates[e.date] = 1; });
    var fields = {}, woke = {}, withDetails = 0, flushDates = {};
    Object.keys(DETAIL_MARK).forEach(function (k) { fields[k] = { answered: 0, marked: 0, unsure: 0 }; });
    Object.keys(dates).sort().forEach(function (date) {
      var d = nightDetails(date); if (!d) return; withDetails++;
      Object.keys(DETAIL_MARK).forEach(function (k) { var v = d[k]; if (v === undefined) return; if (v === 'unsure') { fields[k].unsure++; return; } fields[k].answered++; if (DETAIL_MARK[k].indexOf(v) > -1) fields[k].marked++; });
      (d.woke || []).forEach(function (c) { woke[c] = (woke[c] || 0) + 1; if (c === 'flush') flushDates[date] = 1; });
    });
    S.list('symptom', { from: from, to: to }).forEach(function (e) { if (e.data && e.data.flushNight) flushDates[e.date] = 1; });
    var byDay = {}; S.list('sleepcheck', { from: from, to: to }).forEach(function (e, i) { var cur = byDay[e.date], te = String(e.updatedAt || e.createdAt || ''), tc = cur ? String(cur.e.updatedAt || cur.e.createdAt || '') : ''; if (!cur || te > tc || (te === tc && i > cur.i)) byDay[e.date] = { e: e, i: i }; }); /* one check a day: the newest edit, whatever a sync brought */
    var checks = Object.keys(byDay).sort().reverse().map(function (d) { var e = byDay[d].e, a = S.cleanSleepCheck(e.data); return { date: e.date, answers: a, notes: sleepCheckNotes(a) }; });
    return { from: from, to: to, nights: Object.keys(dates).length, withDetails: withDetails, fields: fields, woke: woke, flushNights: Object.keys(flushDates).length, checks: checks };
  }
  /* one night's answers as a short line for the journal and the PDF */
  var DETAIL_SHORT = { latency: 'time to fall asleep', wakeups: 'times woken', awake: 'awake in the night', early: 'woke too early', rested: 'rested on waking' };
  function sleepDetailText(raw) {
    var d = S.cleanSleepDetails(raw); if (!d) return '';
    return DETAIL_ORDER.filter(function (k) { return d[k] !== undefined; }).map(function (k) {
      if (k === 'woke') return 'woken by ' + d.woke.map(function (c) { return optLabel(SLEEP_LABELS, 'woke', c).toLowerCase(); }).join(', ');
      return DETAIL_SHORT[k] + ' ' + optLabel(SLEEP_LABELS, k, d[k]).toLowerCase();
    }).join('; ');
  }
  /* label and value rows, the same words in the journal, the PDF and the doctor's view */
  var NOTE_ROWS = [['latency', 'Over 30 min to fall asleep'], ['wakeups', 'Woke 2 or more times'], ['awake', 'Awake over 30 min in the night'], ['early', 'Woke too early and could not get back to sleep'], ['rested', 'Felt not at all or only a little rested']];
  function sleepNotesRows(sn) {
    if (!sn || !sn.withDetails) return [];
    var rows = [['Sleep details', sn.withDetails + ' of ' + sn.nights + ' recorded night' + (sn.nights === 1 ? '' : 's')]];
    NOTE_ROWS.forEach(function (r) { var f = sn.fields[r[0]]; if (!f || (!f.answered && !f.unsure)) return; rows.push([r[1], f.answered ? f.marked + ' of ' + f.answered + ' answered night' + (f.answered === 1 ? '' : 's') + (f.unsure ? ', ' + f.unsure + ' not sure' : '') : f.unsure + ' not sure']); });
    var wk = Object.keys(sn.woke).sort(function (a, b) { return sn.woke[b] - sn.woke[a]; });
    if (wk.length) rows.push(['Woken by', wk.map(function (c) { return optLabel(SLEEP_LABELS, 'woke', c).toLowerCase() + ' ' + sn.woke[c] + ' of ' + sn.withDetails; }).join(', ') + ' night' + (sn.withDetails === 1 ? '' : 's') + ' with details']);
    return rows;
  }
  function sleepCheckText(a) {
    a = S.cleanSleepCheck(a || {});
    return CHECK_ORDER.filter(function (k) { return a[k] !== undefined; }).map(function (k) {
      /* answers in the third person for the doctor and the PDF ("I do not drive" reads "does not drive") */
      var v = ({ driving: { nodrive: 'does not drive' }, breathing: { unsure: 'not sure, or sleeps alone' } }[k] || {})[a[k]] || optLabel(CHECK_LABELS, k, a[k]).toLowerCase();
      return { w1: 'hard nights, last 7 days: ' + v, w2: 'the 7 days before: ' + v, chance: 'enough time and place to sleep: ' + v, impact: 'affects the day: ' + v, since: 'for: ' + v, breathing: 'snoring, gasping or pauses noticed: ' + v, legs: 'restless legs feelings: ' + v, driving: 'sleepy while driving: ' + v }[k];
    }).join('; ');
  }
  root.OvuAgents = { SLEEP_LABELS: SLEEP_LABELS, CHECK_LABELS: CHECK_LABELS, CHECK_ORDER: CHECK_ORDER, DETAIL_ORDER: DETAIL_ORDER, nightDetails: nightDetails, sleepDetailText: sleepDetailText, sleepNotes: sleepNotes, sleepNotesRows: sleepNotesRows, sleepCheckNotes: sleepCheckNotes, sleepCheckText: sleepCheckText, breathingNote: breathingNote, isPostmenopausal: isPostmenopausal, SYMPTOMS: SYMPTOMS, MOODS: MOODS, FOOD_TAGS: FOOD_TAGS, supervisor: supervisor, analyze: analyze, allFlags: allFlags, dailySummary: dailySummary, fourWeekSummary: fourWeekSummary, cycleHistory: cycleHistory, patternDays: patternDays, monthsBack: monthsBack, monthlyTotals: monthlyTotals, todayCheckIn: todayCheckIn, dismissFlag: dismissFlag, saveMonthlySummary: saveMonthlySummary, agents: AGENTS, fmtHours: fmtHours };
})(window);
