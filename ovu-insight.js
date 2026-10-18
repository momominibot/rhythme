/* Insight agents: model-assisted summaries layered on the rule agents.
 * The rules in ovu-agents.js decide every flag deterministically. These two
 * agents only write prose and pattern hypotheses from compact, de-identified
 * inputs, through the Ovumind insight relay (same guard rails as Luna). A tiny
 * supervisor decides when each one runs; results are cached on the device.
 *   daily     -> Daily Summary Agent, shown in the journal and on the home card
 *   fourweeks -> Four-Week Summary Agent, shown on the Dr shares card and in the doctor view */
(function (root) {
  'use strict';
  var S = root.OvuStore, A = root.OvuAgents, ORB = root.OvuOrb;
  var URL = 'https://zodkohwaznqgrfrcfdkf.supabase.co/functions/v1/insight';
  var KEEP_DAILY = 14, KEEP_4W = 3;

  /* Readings need their own permission (insights: true), separate from letting Luna's model read a note. */
  function enabled() { var c = ORB ? ORB.aiConfig() : { on: false }; return !!(c.on && c.provider === 'ovumind' && c.insights === true); }
  function store() { return S.state().insights || { daily: {}, fourweeks: {} }; }
  function put(kind, key, value) {
    var st = store(); st[kind] = st[kind] || {}; st[kind][key] = value;
    var keys = Object.keys(st[kind]).sort(), keep = kind === 'daily' ? KEEP_DAILY : KEEP_4W;
    keys.slice(0, Math.max(0, keys.length - keep)).forEach(function (k) { delete st[kind][k]; });
    S.setState({ insights: st }); return value;
  }
  /* strip anything that could identify the person before it leaves the device */
  function clean(text) { return String(text || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/\+?\d[\d\s-]{7,}\d/g, '[number]').replace(/@\w{3,}/g, '[handle]').slice(0, 240); }
  function context() {
    var p = S.profile();
    return { ageBand: p.ageBand || '', lifeStage: p.lifeStage || '', predictionMode: p.predictionMode || 'normal', regularity: p.regularity || '', selfReportedConditions: p.conditions || [], goals: p.goals || [], hormones: p.hormones || [], pregState: p.pregState || '' };
  }
  function dayCompact(date) {
    var es = S.byDate(date), out = { date: date }, sleep = es.filter(function (e) { return e.type === 'sleep'; })[0], per = es.filter(function (e) { return e.type === 'period'; })[0], sym = es.filter(function (e) { return e.type === 'symptom'; })[0];
    if (sleep) out.sleep = { hours: Math.round(S.sleepHours(sleep.data) * 10) / 10, quality: sleep.data.quality || null, notes: clean(sleep.data.notes) };
    if (per) out.period = { flow: per.data.flow, clots: !!per.data.clots, impact: !!per.data.impact };
    if (sym) out.symptoms = { list: sym.data.symptoms || [], pain: typeof sym.data.pain === 'number' ? sym.data.pain : null, mood: sym.data.mood || '', notes: clean(sym.data.notes) };
    var meals = es.filter(function (e) { return e.type === 'food'; });
    if (meals.length) out.meals = meals.map(function (m) { var t = m.data.totals || {}; return { meal: m.data.meal, foods: clean(m.data.foods).slice(0, 80), tags: m.data.tags || [], kcal: t.kcal === undefined ? null : t.kcal, protein: t.protein === undefined ? null : t.protein, fibre: t.fiber === undefined ? null : t.fiber }; });
    var mind = es.filter(function (e) { return e.type === 'mindfulness'; });
    if (mind.length) out.mindfulness = mind.map(function (m) { return { kind: m.data.kind, activity: m.data.activity || null, minutes: m.data.minutes }; });
    var refl = es.filter(function (e) { return e.type === 'reflection'; });
    if (refl.length) out.reflections = refl.map(function (r) { return { mood: r.data.mood || '', text: clean(r.data.text) }; });
    return out;
  }
  function sigFor(from, to) { var es = S.list(null, { from: from, to: to }); return es.length + ':' + es.map(function (e) { return (e.updatedAt || e.createdAt || '').slice(0, 19); }).sort().slice(-1)[0]; }

  function dailyInput(date) {
    var days = []; for (var i = 7; i >= 0; i--) { var d = S.addDays(date, -i); var c = dayCompact(d); if (Object.keys(c).length > 1) days.push(c); }
    var cs = S.cycleStats(date), flags = A.allFlags(date).filter(function (f) { return f.date === date || !f.date; }).map(function (f) { return { code: f.code, title: f.title, level: f.level }; });
    return { today: date, cycle: { day: cs.cycleDay, phase: cs.phase, mode: cs.mode, uncertain: !!cs.uncertain }, context: context(), ruleFlagsToday: flags, ruleSummary: A.dailySummary(date).text, days: days };
  }
  function fourWeekInput(end) {
    var sum = A.fourWeekSummary(end), p = S.profile();
    return { range: sum.range, coverage: sum.coverage, cycle: sum.cycle, sleep: { nights: sum.sleep.nights, average: sum.sleep.average, under6: sum.sleep.under6 }, symptoms: sum.symptoms, food: sum.food, mindfulness: sum.mindfulness, ruleFlags: sum.flags.map(function (f) { return { code: f.code, level: f.level, title: f.title, detail: f.detail, date: f.date || null }; }), ruleQuestions: sum.questions, intakeNotes: (p.intakeNotes || []).map(function (n) { return n.title; }), context: context() };
  }

  function call(mode, input) {
    return fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: mode, input: input }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || ('The insight relay replied ' + r.status + '.')); return d; }); });
  }
  /* Daily Summary Agent: cached per day; refreshes when the day's entries changed and force is set */
  function daily(date, force) {
    date = date || S.today();
    var cached = store().daily[date], sig = sigFor(S.addDays(date, -7), date);
    if (cached && (!force || cached.sig === sig)) return Promise.resolve(cached);
    if (!enabled()) return Promise.reject(new Error('Luna’s own model is off. Turn it on in Luna’s settings for written summaries.'));
    return call('daily', dailyInput(date)).then(function (d) {
      var r = d.result || {};
      return put('daily', date, { date: date, sig: sig, generatedAt: d.generatedAt, model: d.model, agent: 'DailySummaryAgent v2 (rules + model)', summary: String(r.summary || ''), patterns: Array.isArray(r.patterns) ? r.patterns.slice(0, 3) : [], suggestion: String(r.suggestion || ''), questions: Array.isArray(r.questions) ? r.questions.slice(0, 2) : [], caution: String(r.caution || '') });
    });
  }
  /* Four-Week Summary Agent: explicit, cached per range end */
  function fourweeks(end, force) {
    end = end || S.today();
    var cached = store().fourweeks[end], sig = sigFor(S.addDays(end, -27), end);
    if (cached && (!force || cached.sig === sig)) return Promise.resolve(cached);
    if (!enabled()) return Promise.reject(new Error('Luna’s own model is off. Turn it on in Luna’s settings for a written summary.'));
    return call('fourweeks', fourWeekInput(end)).then(function (d) {
      var r = d.result || {}, c = r.clinician || {}, u = r.user || {};
      return put('fourweeks', end, { end: end, sig: sig, generatedAt: d.generatedAt, model: d.model, agent: 'FourWeekSummaryAgent v2 (rules + model)', clinician: { overview: c.overview || '', cycle: c.cycle || '', bleeding: c.bleeding || '', symptoms_pain: c.symptoms_pain || '', sleep: c.sleep || '', nutrition: c.nutrition || '', mood_calm: c.mood_calm || '', patterns: Array.isArray(c.patterns) ? c.patterns.slice(0, 5) : [], questions: Array.isArray(c.questions) ? c.questions.slice(0, 6) : [], limits: c.limits || '' }, user: { summary: u.summary || '', wins: Array.isArray(u.wins) ? u.wins.slice(0, 3) : [], watch: Array.isArray(u.watch) ? u.watch.slice(0, 3) : [] } });
    });
  }
  function cachedDaily(date) { return store().daily[date || S.today()] || null; }
  function cachedFourWeeks(end) { return store().fourweeks[end || S.today()] || null; }
  /* supervisor: what should run now, without spending calls the user did not ask for */
  function plan(where) {
    var today = S.today(), out = [];
    if (where === 'journal' && enabled() && !cachedDaily(today) && S.byDate(today).length) out.push('daily');
    return out;
  }
  function stale(kind, key) { var c = kind === 'daily' ? cachedDaily(key) : cachedFourWeeks(key); if (!c) return true; var k = key || S.today(); return c.sig !== (kind === 'daily' ? sigFor(S.addDays(k, -7), k) : sigFor(S.addDays(k, -27), k)); }
  root.OvuInsight = { enabled: enabled, daily: daily, fourweeks: fourweeks, cachedDaily: cachedDaily, cachedFourWeeks: cachedFourWeeks, plan: plan, stale: stale, dailyInput: dailyInput, fourWeekInput: fourWeekInput, URL: URL };
})(window);
