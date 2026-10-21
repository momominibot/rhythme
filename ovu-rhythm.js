/* Rhythme: "Your cycle rhythm" (Jamie, 21 Oct 2026: "add back the cycle tab ... I still want to put in cycle wellness
 * scoring on the tab"). The shape is Option C of docs/design/2026-10-21-cycle-tab-rhythm.md, chosen with Codex against the
 * 18 Oct analysis: the only number is how much history there is (1 of 3, 2 of 3, 3 of 3 completed cycles), four cards each
 * with its own level and its evidence, never a total. Ovulation is not assessed, because nothing the app logs can tell.
 * Care prompts never wait for readiness. Pure parts first (tested in tools/test-core.js), then the panel's HTML. */
(function (root) {
  'use strict';
  var WINDOW_MONTHS = 6, GAP_DAYS = 60, MIN_INTERVALS = 3, SYM_DAYS = 14, MIN_ANSWERS = 7, CYCLE_LO = 24, CYCLE_HI = 38, BLEED_MAX = 8;
  var BANDS = { '18-25': 9, '26-41': 7, '42-45': 9 }; /* FIGO 2018 (E7): the normal variation, shortest to longest cycle, by age */
  var LEVELS = { ok: 'Nothing flagged in these entries', ref: 'Within the reference range in these records', note: 'A pattern worth noticing', chat: 'Worth a chat', building: 'Building your picture', thin: 'Not enough information for a pattern', na: 'Not assessed' };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function diffDays(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
  function addDays(dateStr, n) { var d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return dateOf(d); }
  function addMonths(dateStr, n) { var d = new Date(dateStr + 'T12:00:00'), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return dateOf(d); }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }

  /* ---------- the age band for FIGO's regularity limit: the intro's ranges straddle FIGO's, so some need one more answer ---------- */
  function bandFor(profile) {
    var p = profile || {};
    if (p.cycleAgeBand && (BANDS[p.cycleAgeBand] !== undefined || p.cycleAgeBand === '46+')) return p.cycleAgeBand;
    return ({ '18-24': '18-25', '30-34': '26-41', '35-39': '26-41' })[p.ageRange] || null;
  }
  function bandNeedsAsking(profile) { var p = profile || {}; return !bandFor(p) && ['25-29', '40-44', '45-49', '50+'].indexOf(p.ageRange) > -1 || (!bandFor(p) && !p.ageRange); }

  /* ---------- confirmed periods: an episode counts when at least one of its days was logged by her, not filled in ---------- */
  function confirmedEpisodes(episodes) {
    return (episodes || []).filter(function (ep) { return ep && ep.days && ep.days.some(function (d) { return !(d.data && d.data.autofill); }); })
      .map(function (ep) { var recorded = ep.days.filter(function (d) { return !(d.data && d.data.autofill); }).length; return { start: ep.start, end: ep.end, span: diffDays(ep.start, ep.end) + 1, recorded: recorded, filled: ep.days.length - recorded, unknown: diffDays(ep.start, ep.end) + 1 - ep.days.length }; });
  }
  /* the completed cycles between confirmed starts in the last six months; a gap over 60 days is a gap between records, not a cycle */
  function intervals(eps, asOf) {
    var from = addMonths(asOf, -WINDOW_MONTHS), starts = eps.map(function (e) { return e.start; }).filter(function (s) { return s >= from && s <= asOf; }).sort(), out = [], gaps = [];
    for (var i = 1; i < starts.length; i++) { var d = diffDays(starts[i - 1], starts[i]); (d > GAP_DAYS ? gaps : out).push({ from: starts[i - 1], to: starts[i], days: d }); }
    return { from: from, to: asOf, starts: starts, cycles: out, gaps: gaps };
  }
  function readiness(iv) {
    var n = Math.min(MIN_INTERVALS, iv.cycles.length), line = n === 0 ? (iv.starts.length ? 'Your first period start is recorded. The first full cycle appears with the next one.' : 'Log the first day of a period and the picture begins.') : n === 1 ? 'Your first complete cycle is recorded.' : n === 2 ? 'Your cycle picture is taking shape.' : 'An initial comparison is available.';
    return { n: n, of: MIN_INTERVALS, total: iv.cycles.length, line: line };
  }
  /* cycle regularity: the range of the cycle lengths against FIGO's limit for the age band (E7) */
  function regularity(iv, profile) {
    var band = bandFor(profile), lens = iv.cycles.map(function (c) { return c.days; });
    if (lens.length < MIN_INTERVALS) return { level: 'building', spread: lens.length >= 2 ? Math.max.apply(null, lens) - Math.min.apply(null, lens) : null, lengths: lens, band: band, limit: band && BANDS[band] !== undefined ? BANDS[band] : null, text: lens.length ? 'Recorded so far: ' + lens.join(', ') + ' days. Three complete cycles are needed before a comparison (a Rhythme threshold for an initial look, not a validated baseline).' : 'A comparison needs three complete cycles in the last six months.' };
    var spread = Math.max.apply(null, lens) - Math.min.apply(null, lens), limit = band && BANDS[band] !== undefined ? BANDS[band] : null;
    if (limit === null) return { level: 'building', spread: spread, lengths: lens, band: band, limit: null, text: 'Your cycles ranged over ' + spread + ' days (' + Math.min.apply(null, lens) + ' to ' + Math.max.apply(null, lens) + '). ' + (band === '46+' ? 'FIGO gives no reference variation after 45, so this is shown without a verdict.' : 'Choose the age band below to compare it with FIGO’s reference variation.') };
    return { level: spread > limit ? 'chat' : 'ref', spread: spread, lengths: lens, band: band, limit: limit, text: 'Your cycles ranged over ' + spread + ' days (' + Math.min.apply(null, lens) + ' to ' + Math.max.apply(null, lens) + ') across ' + lens.length + ' cycles. FIGO’s reference variation at ' + band.replace('-', ' to ') + ' is up to ' + limit + ' days.' + (spread > limit ? ' That is more variation than the reference, which is worth a conversation with a GP or gynaecologist; it is an observation, not a diagnosis.' : '') };
  }
  /* cycle and bleeding length: every interval against 24 to 38 days, every confirmed episode against up to 8 days (E7); never the average alone */
  function lengths(iv, eps) {
    var outside = iv.cycles.filter(function (c) { return c.days < CYCLE_LO || c.days > CYCLE_HI; }), inWin = eps.filter(function (e) { return e.start >= iv.from && e.start <= iv.to; });
    var longBleeds = inWin.filter(function (e) { return e.recorded > BLEED_MAX; }), unsure = inWin.filter(function (e) { return e.unknown > 0 || e.filled > 0; });
    var level = (outside.length || longBleeds.length) ? 'chat' : (iv.cycles.length || inWin.length) ? 'ref' : 'building';
    var bits = [];
    if (iv.cycles.length) bits.push(outside.length ? outside.length + ' of ' + iv.cycles.length + ' cycles fell outside 24 to 38 days (' + outside.map(function (c) { return c.days; }).join(', ') + ').' : 'Every recorded cycle (' + iv.cycles.map(function (c) { return c.days; }).join(', ') + ' days) sat within 24 to 38 days.');
    if (inWin.length) bits.push(longBleeds.length ? longBleeds.length + ' period' + (longBleeds.length === 1 ? '' : 's') + ' had bleeding recorded on more than 8 days.' : 'Bleeding was recorded on up to ' + Math.max.apply(null, inWin.map(function (e) { return e.recorded; })) + ' days per period.');
    if (unsure.length) bits.push(unsure.length + ' period' + (unsure.length === 1 ? '' : 's') + ' had days filled in or unknown between recorded days, so their length is uncertain.');
    if (iv.gaps.length) bits.push(iv.gaps.length + ' gap' + (iv.gaps.length === 1 ? '' : 's') + ' of more than 60 days between records (' + iv.gaps.map(function (g) { return g.days; }).join(', ') + ' days) ' + (iv.gaps.length === 1 ? 'is' : 'are') + ' kept as a gap, not a cycle. If there really was no period in between, that is worth mentioning to a clinician.');
    if (!bits.length) bits.push('No complete cycle or period in the last six months yet.');
    return { level: level, outside: outside, longBleeds: longBleeds, unsure: unsure, text: bits.join(' ') + ' Heavy bleeding, flooding or large clots are separate care signs whatever the length.' };
  }
  /* symptoms and comfort: the last 14 days, three measures with their own denominators; levels are Rhythme thresholds */
  function symptoms(entries, asOf, profile, careFlags) {
    var from = addDays(asOf, -(SYM_DAYS - 1)), byDate = {};
    (entries || []).forEach(function (e) { if (!e || e.type !== 'symptom' || !e.data || e.date < from || e.date > asOf) return; var d = byDate[e.date] = byDate[e.date] || { sym: null, pain: null, mood: null }; if (Array.isArray(e.data.symptoms)) d.sym = d.sym || e.data.symptoms.length > 0; if (typeof e.data.pain === 'number' && isFinite(e.data.pain)) d.pain = d.pain === null ? e.data.pain : Math.max(d.pain, e.data.pain); if (e.data.mood) d.mood = e.data.mood; });
    var dates = Object.keys(byDate), symAns = dates.filter(function (k) { return byDate[k].sym !== null; }), symDays = symAns.filter(function (k) { return byDate[k].sym; }).length;
    var pains = dates.map(function (k) { return byDate[k].pain; }).filter(function (p) { return p !== null; }), moodAns = dates.filter(function (k) { return byDate[k].mood; }), moodLow = moodAns.filter(function (k) { return byDate[k].mood === 'low' || byDate[k].mood === 'bad'; }).length;
    var painMean = pains.length ? Math.round(pains.reduce(function (a, b) { return a + b; }, 0) / pains.length * 10) / 10 : null, painMax = pains.length ? Math.max.apply(null, pains) : null;
    var postpartum = !!(profile && profile.pregState === 'postpartum'), reasons = [], level;
    if ((careFlags || []).length) reasons.push('a care note in your entries');
    if (painMax !== null && painMax >= 8) reasons.push('pain of 8 or more on a day');
    if (moodLow >= (postpartum ? 3 : 5)) reasons.push('low or bad mood on ' + moodLow + ' days');
    if (reasons.length) level = 'chat';
    else {
      var notes = [];
      if (symAns.length >= MIN_ANSWERS && symDays > symAns.length / 2) notes.push('symptoms on more than half of the days you answered');
      if (pains.length >= MIN_ANSWERS && painMean >= 4) notes.push('pain averaging ' + painMean);
      if (moodAns.length >= MIN_ANSWERS && moodLow >= 3) notes.push('low or bad mood on ' + moodLow + ' days');
      if (notes.length) { level = 'note'; reasons = notes; }
      else level = (symAns.length >= MIN_ANSWERS && pains.length >= MIN_ANSWERS && moodAns.length >= MIN_ANSWERS) ? 'ok' : 'thin';
    }
    return { level: level, reasons: reasons, symDays: symDays, symAnswered: symAns.length, painMean: painMean, painMax: painMax, painAnswered: pains.length, moodLow: moodLow, moodAnswered: moodAns.length, days: SYM_DAYS, postpartum: postpartum,
      text: 'Symptoms answered on ' + symAns.length + ' of ' + SYM_DAYS + ' days (' + symDays + ' with symptoms); pain on ' + pains.length + (painMean !== null ? ' (mean ' + painMean + ', highest ' + painMax + ')' : '') + '; mood on ' + moodAns.length + (moodAns.length ? ' (' + moodLow + ' low or bad)' : '') + '. Other days are unknown.' + (reasons.length ? ' Noted: ' + reasons.join(', ') + '.' : '') };
  }
  /* which view fits her situation: the cards are not forced on everyone */
  function stage(profile, cs) {
    var p = profile || {}, h = p.hormones || [];
    if (['post', 'postmenopause', 'postmenopausal'].indexOf(p.lifeStage || '') > -1) return 'post';
    if (p.pregState === 'pregnant' || p.pregState === 'maybe') return 'pregnant';
    if (p.pregState === 'postpartum' && p.periodsBack === 'no') return 'postpartum-none';
    if (p.pregState === 'postpartum') return 'postpartum';
    if (p.pregState === 'loss') return 'loss';
    if (h.some(function (x) { return ['pill', 'pop', 'iud_h', 'implant', 'hrt', 'fertility'].indexOf(x) > -1; })) return 'hormones';
    if (cs && cs.mode === 'suspended') return 'suspended';
    if (cs && cs.mode === 'wide') return 'wide';
    return 'normal';
  }
  /* everything the panel shows, from the data the app already keeps */
  function panel(ctx) {
    var S = ctx.store, A = ctx.agents, asOf = ctx.asOf || S.today(), profile = S.profile(), cs = S.cycleStats(asOf), st = stage(profile, cs);
    var eps = confirmedEpisodes(cs.episodes || S.periodEpisodes()), iv = intervals(eps, asOf), rd = readiness(iv);
    var careFlags = []; try { var sum = A && A.fourWeekSummary ? A.fourWeekSummary(asOf) : null; careFlags = sum && sum.flags ? sum.flags.filter(function (f) { return f.level === 'high'; }) : []; } catch (e) { careFlags = []; }
    var sym = symptoms(S.list('symptom', { from: addDays(asOf, -(SYM_DAYS - 1)), to: asOf }), asOf, profile, careFlags);
    var out = { stage: st, asOf: asOf, readiness: rd, intervals: iv, episodes: eps, regularity: regularity(iv, profile), lengths: lengths(iv, eps), symptoms: sym, band: bandFor(profile), askBand: bandNeedsAsking(profile), remembered: (cs.recalled || []).length, showCycle: ['normal', 'wide', 'hormones', 'postpartum', 'suspended'].indexOf(st) > -1 };
    return out;
  }

  /* ---------- the panel's HTML ---------- */
  function chipTh() { return '<span class="chip-th" title="A threshold Rhythme chose, not a clinical cut-off">Rhythme threshold</span>'; }
  function chipE(ids) { return ids.map(function (id) { return '<a class="chip-e" href="evidence.html#' + id + '">' + id + '</a>'; }).join(''); }
  function badge(level) { return '<span class="lvl lvl-' + esc(level) + '">' + esc(LEVELS[level] || level) + '</span>'; }
  function card(title, sub, level, text, chips) { return '<div class="rcard"><div class="rhead"><b>' + esc(title) + '</b>' + badge(level) + '</div><small>' + esc(sub) + '</small><p>' + esc(text) + '</p><div class="rchips">' + (chips || '') + '</div></div>'; }
  function stageNote(st) {
    return ({ pregnant: 'Pregnant or possibly pregnant: cycle counting, period estimates and ovulation are paused. Symptoms and care stay on. Bleeding or strong pain in pregnancy needs urgent care now.',
      'postpartum-none': 'After a birth, before periods return: no cycle count and no absence to worry about here. Symptoms and bleeding observations stay on.',
      postpartum: 'Periods returning after a birth are recorded as they come, in a fresh context; the regularity comparison is not applied to them.',
      loss: 'After a recent pregnancy loss, bleeding is shown as it is recorded and is not read as a new ordinary baseline. Take the time you need.',
      hormones: 'With hormonal contraception, HRT or fertility medicines, bleeding follows the medicine more than the cycle: lengths are shown as recorded, without a regularity grade.',
      suspended: 'Cycle predictions are paused for your situation; what you record is shown as it is.',
      wide: 'Your pattern is changing, so estimates are wide. Wide is uncertainty, never a mark against you.',
      post: 'After the menopause there is no cycle to count. This view keeps symptoms and comfort, and any bleeding at all, even once and even a little, is something to have checked.' })[st] || '';
  }
  function html(ctx) {
    var P = panel(ctx), S = ctx.store, h = '';
    if (P.stage === 'post') {
      h += '<div class="rhythm"><h3>Your body</h3><p class="help">' + esc(stageNote('post')) + ' ' + chipE(['E93']) + '</p>';
      h += card('Symptoms and comfort', 'Pain, mood and symptoms on the days you answered; other days are unknown.', P.symptoms.level, P.symptoms.text, chipTh() + chipE(['E8', 'E9']));
      return h + footer();
    }
    h += '<div class="rhythm"><h3>Your cycle rhythm</h3>';
    if (P.stage !== 'normal') h += '<p class="help stagenote">' + esc(stageNote(P.stage)) + '</p>';
    if (P.stage !== 'pregnant' && P.stage !== 'postpartum-none' && P.stage !== 'loss') {
      h += '<div class="ready"><span class="lbl">Building your cycle picture</span><div class="dots">' + [1, 2, 3].map(function (i) { return '<span class="dot' + (P.readiness.n >= i ? ' on' : '') + '"><i>' + i + '</i><em>' + ['First cycle', 'Taking shape', 'First comparison'][i - 1] + '</em></span>'; }).join('') + '</div><p>' + esc(P.readiness.n + ' of ' + P.readiness.of + ' complete cycles in the last six months. ' + P.readiness.line) + (P.remembered ? ' Remembered dates from your intro are shown on the calendar but do not count here.' : '') + '</p></div>';
      var reg = P.regularity, regChips = chipE(['E7', 'E91']) + (reg.level === 'building' ? chipTh() : '');
      var regText = reg.text + (P.stage === 'hormones' || P.stage === 'postpartum' ? ' Shown as recorded; no grade applies in your situation.' : '');
      h += card('Cycle regularity', 'How much the time between your recorded period starts varies.', (P.stage === 'hormones' || P.stage === 'postpartum') && reg.level !== 'building' ? 'building' : reg.level, regText, regChips);
      if (P.askBand || (!P.band && reg.lengths.length >= MIN_INTERVALS)) h += '<div class="rband"><span class="lbl">Which age band fits you? FIGO’s reference variation differs by age.</span><div class="chips">' + ['18-25', '26-41', '42-45', '46+'].map(function (b) { return '<button type="button" class="chipbtn' + (P.band === b ? ' on' : '') + '" data-band="' + b + '">' + b.replace('-', ' to ').replace('46+', '46 or older') + '</button>'; }).join('') + '</div></div>';
      h += card('Cycle and bleeding length', 'Your recorded cycle lengths and bleeding days, alongside their reference ranges.', P.lengths.level, P.lengths.text, chipE(['E7', 'E4']));
      h += card('Ovulation signs', 'Signs you record can add context; Rhythme cannot confirm ovulation.', 'na', 'Your current records cannot tell whether you ovulated. The calendar’s phase and fertile colouring are estimates from dates, not evidence of ovulation, and they count for nothing here.', chipE(['E92']));
    }
    h += card('Symptoms and comfort', 'Pain, mood and symptoms on the days you answered; other days are unknown.', P.symptoms.level, P.symptoms.text, chipTh() + chipE(['E8', 'E9', 'E94']));
    return h + footer();
  }
  function footer() { return '<p class="help rfoot">Levels describe what you recorded; they are not a diagnosis, a fertility reading or a measure of health. Care prompts never wait for three cycles. Anything that worries you is worth a conversation whatever this says.</p></div>'; }

  /* ---------- wiring in the calendar sheet ---------- */
  function render(box) {
    var S = root.OvuStore, A = root.OvuAgents; if (!box || !S) return;
    box.innerHTML = html({ store: S, agents: A });
    box.querySelectorAll('[data-band]').forEach(function (b) { b.addEventListener('click', function () { S.setProfile({ cycleAgeBand: b.dataset.band }); render(box); }); });
  }
  root.OvuRhythm = { BANDS: BANDS, LEVELS: LEVELS, WINDOW_MONTHS: WINDOW_MONTHS, GAP_DAYS: GAP_DAYS, MIN_INTERVALS: MIN_INTERVALS, SYM_DAYS: SYM_DAYS, MIN_ANSWERS: MIN_ANSWERS, addMonths: addMonths, bandFor: bandFor, bandNeedsAsking: bandNeedsAsking,
    confirmedEpisodes: confirmedEpisodes, intervals: intervals, readiness: readiness, regularity: regularity, lengths: lengths, symptoms: symptoms, stage: stage, stageNote: stageNote, panel: panel, html: html, render: render };
})(typeof window !== 'undefined' ? window : this);
