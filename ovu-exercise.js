/* Rhythme movement: the activity table and the maths for a week of exercise entries.
 * MET values and codes are from the 2024 Adult Compendium of Physical Activities (pacompendium.com, checked
 * 19 Oct 2026; evidence E69). Weekly targets follow WHO 2020 (E67): 150 to 300 moderate minutes, a vigorous
 * minute counts as two (E68), muscle-strengthening on 2 or more days. Intensity is WHO's absolute scale:
 * light under 3 METs, moderate 3 to under 6, vigorous 6 or more. No storage and no DOM here; ovu-store.js
 * keeps the entries and room.js draws them. Design note: docs/design/2026-10-19-exercise-logging.md */
(function (root) {
  'use strict';
  function v(id, label, code, met) { return { id: id, label: label, code: code, met: met }; }
  /* aerobic: false means the minutes count as strength work, not toward WHO's aerobic minutes.
     strength: true only pre-ticks "worked all my main muscle groups"; the person decides, because WHO's strength day
     means all major muscle groups at moderate effort or more, which a preset cannot know. */
  var ACTIVITIES = [
    { id: 'walk', label: 'Walking', icon: 'directions_walk', variants: [v('slow', 'Slow, about 3 to 4 km/h', '17152', 2.8), v('steady', 'Steady, about 4.5 to 5.5 km/h', '17190', 3.8), v('brisk', 'Brisk, about 5.6 to 6.3 km/h', '17200', 4.8), v('fast', 'Very brisk, about 6.4 to 7.1 km/h', '17220', 5.5)] },
    { id: 'run', label: 'Running', icon: 'directions_run', variants: [v('jogwalk', 'Walking with short jogs (under 10 minutes of jogging)', '12010', 6.0), v('jog', 'Jogging, your own pace', '12020', 7.5), v('run', 'Running, about 10 km/h', '12050', 9.3), v('fast', 'Running, about 11 km/h', '12070', 11.0)] },
    { id: 'cycle', label: 'Cycling', icon: 'directions_bike', variants: [v('easy', 'Easy, under 16 km/h', '01010', 4.0), v('general', 'General riding', '01014', 7.0), v('fast', 'Fast, about 23 to 26 km/h', '01040', 10.0), v('stationary', 'Stationary bike', '01200', 6.8), v('spin', 'Spin class', '01270', 9.0)] },
    { id: 'swim', label: 'Swimming', icon: 'pool', variants: [v('breast', 'Breaststroke, relaxed', '18265', 5.3), v('laps', 'Laps, slow freestyle', '18240', 5.8), v('leisure', 'Leisurely, not laps', '18310', 6.0), v('fast', 'Laps, fast freestyle', '18230', 9.8), v('aqua', 'Water aerobics', '18355', 5.5)] },
    { id: 'yoga', label: 'Yoga', icon: 'self_improvement', variants: [v('hatha', 'Hatha', '02150', 2.3), v('vinyasa', 'Vinyasa flow', '02185', 2.7), v('hot', 'Hot yoga', '02155', 3.0), v('power', 'Power yoga', '02160', 4.0)] },
    { id: 'pilates', label: 'Pilates', icon: 'accessibility_new', variants: [v('mat', 'Traditional mat', '02103', 1.8), v('general', 'General class', '02105', 2.8)] },
    { id: 'strength', label: 'Strength or weights', icon: 'fitness_center', aerobic: false, strength: true, variants: [v('body', 'Bodyweight: squats, lunges, push-ups', '02056', 3.0), v('reps', 'Weights, 8 to 15 reps', '02054', 3.5), v('heavy', 'Heavy lifts: squats, deadlifts', '02052', 5.0), v('vigorous', 'Vigorous lifting', '02050', 6.0)] },
    { id: 'hiit', label: 'Intervals or circuits', icon: 'bolt', variants: [v('circuit', 'Circuit, moderate effort', '02035', 5.0), v('intervals', 'Intervals, moderate effort', '02210', 7.0), v('vigorous', 'Intervals, vigorous effort (burpees, Tabata)', '02214', 11.0)] },
    { id: 'dance', label: 'Dance', icon: 'music_note', variants: [v('slow', 'Slow dancing', '03040', 3.0), v('class', 'Ballet, modern or jazz class', '03010', 5.0), v('zumba', 'Zumba class', '02310', 6.5), v('vigorous', 'Vigorous: line, folk or club', '03031', 9.8)] },
    { id: 'hike', label: 'Hiking', icon: 'hiking', variants: [v('easy', 'Easy trail, no load', '17081', 3.8), v('normal', 'Normal pace, no load', '17082', 5.3), v('cross', 'Cross-country', '17080', 6.0)] },
    { id: 'stairs', label: 'Stairs', icon: 'stairs', variants: [v('slow', 'Slow climb', '17133', 4.5), v('steady', 'Steady climb', '17131', 6.8), v('fast', 'Fast climb, one step at a time', '17134', 9.3)] },
    { id: 'racket', label: 'Racket sports', icon: 'sports_tennis', variants: [v('tt', 'Table tennis', '15660', 4.0), v('badminton', 'Badminton, social', '15030', 5.5), v('tennis', 'Tennis, moderate effort', '15675', 6.8), v('badmintonc', 'Badminton, competitive', '15020', 7.0)] },
    { id: 'team', label: 'Team sports', icon: 'sports_basketball', variants: [v('walkfoot', 'Walking football', '15615', 3.5), v('netball', 'Netball', '15477', 7.0), v('football', 'Football, casual', '15610', 7.0), v('basketball', 'Basketball', '15055', 7.5)] },
    { id: 'taichi', label: 'Tai chi or qigong', icon: 'spa', variants: [v('general', 'Tai chi or qigong', '15670', 3.3), v('yang', 'Tai chi chuan, Yang style', '15674', 6.0)] },
    { id: 'stretch', label: 'Stretching', icon: 'accessibility', variants: [v('mild', 'Gentle stretching', '02101', 2.3)] },
    { id: 'machine', label: 'Gym cardio machine', icon: 'exercise', variants: [v('elliptical', 'Elliptical, moderate effort', '02048', 5.0), v('ellipticalv', 'Elliptical, vigorous effort', '02049', 9.0), v('row', 'Rowing machine, moderate effort', '02071', 5.0), v('rowv', 'Rowing machine, vigorous effort', '02070', 7.3), v('stair', 'Stair machine', '02065', 9.3)] },
    { id: 'chores', label: 'Housework', icon: 'cleaning_services', variants: [v('light', 'Light, several tasks', '05025', 2.8), v('moderate', 'Moderate, several tasks', '05026', 3.3), v('vigorous', 'Vigorous, several tasks', '05027', 4.3)] },
    { id: 'garden', label: 'Gardening', icon: 'yard', variants: [v('general', 'General gardening', '08066', 2.0), v('weeding', 'Weeding', '08240', 4.5), v('digging', 'Digging or composting', '08050', 5.0)] },
    /* Something else has no Compendium value: it counts toward minutes by the effort chosen (WHO's relative
       scale: light 2 to 4 out of 10, moderate 5 to 6, vigorous 7 to 8) and is left out of MET-minutes. */
    { id: 'other', label: 'Something else', icon: 'more_horiz', variants: [{ id: 'light', label: 'Easy, about 2 to 4 out of 10 effort', code: null, met: null, effort: 'light' }, { id: 'moderate', label: 'Moderate, about 5 to 6 out of 10 effort', code: null, met: null, effort: 'moderate' }, { id: 'vigorous', label: 'Vigorous, about 7 to 8 out of 10 effort', code: null, met: null, effort: 'vigorous' }] }
  ];
  var BY = {}; ACTIVITIES.forEach(function (a) { BY[a.id] = a; });
  var WHO = { moderateMin: 150, moderateMax: 300, strengthDays: 2, metMinLow: 500, metMinHigh: 1000 };
  var MAX_MINUTES = 600, NOTE_MAX = 280;

  function activity(id) { return BY[id] || null; }
  function variant(actId, varId) { var a = BY[actId]; if (!a) return null; return a.variants.filter(function (x) { return x.id === varId; })[0] || null; }
  function intensityOf(met, effort) {
    if (typeof met === 'number' && isFinite(met) && met > 0) return met < 3 ? 'light' : met < 6 ? 'moderate' : 'vigorous';
    return effort === 'light' || effort === 'moderate' || effort === 'vigorous' ? effort : null;
  }
  var WORD = { light: 'light', moderate: 'moderate', vigorous: 'vigorous' };
  function round1(n) { return Math.round(n * 10) / 10; }

  /* Build the stored data for one entry from what the person chose; throws a friendly Error when something is off.
     The Compendium code and MET are copied in, so a later change to this table never rewrites an old entry. */
  function makeEntry(input) {
    input = input || {};
    var a = BY[input.activity]; if (!a) throw new Error('Choose what you did.');
    var vv = variant(a.id, input.variant) || (a.variants.length === 1 ? a.variants[0] : null);
    if (!vv) throw new Error('Choose how it went.');
    var mins = Number(input.minutes);
    if (!isFinite(mins) || mins <= 0) throw new Error('Add how many minutes.');
    mins = Math.round(mins);
    if (mins < 1) throw new Error('Add how many minutes.');
    if (mins > MAX_MINUTES) throw new Error('Up to 10 hours in one entry. Split longer days into two.');
    var note = String(input.note || '').trim().slice(0, NOTE_MAX);
    var strength = typeof input.strength === 'boolean' ? input.strength : !!a.strength;
    return {
      activity: a.id, label: a.label, variant: vv.id, detail: vv.label,
      code: vv.code, met: vv.met, metSource: vv.met === null ? null : '2024 Adult Compendium',
      minutes: mins, intensity: intensityOf(vv.met, vv.effort), strength: strength, aerobic: a.aerobic !== false, note: note
    };
  }
  function metMinutes(d) { return d && typeof d.met === 'number' && isFinite(d.met) && d.met > 0 ? round1(d.met * (Number(d.minutes) || 0)) : null; }

  function pad(n) { return String(n).padStart(2, '0'); }
  function addDays(dateStr, n) { var t = new Date(dateStr + 'T12:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }

  /* The last 7 days ending on `end` (rolling, like the mat's week). Light minutes are shown but never count
     toward WHO's range; strength work counts in MET-minutes, not in aerobic minutes. A strength day needs the
     person's "all main muscle groups" tick and an effort that is not light (WHO: moderate or greater).
     aerobicMetMinutes counts only moderate and vigorous aerobic entries, the activity the US guideline's
     500 to 1,000 MET-minute equivalence describes; metMinutes is everything with a known MET. */
  function week(entries, end) {
    var from = addDays(end, -6);
    var s = { from: from, to: end, sessions: 0, minutes: 0, light: 0, moderate: 0, vigorous: 0, strengthMinutes: 0, moderateEquivalent: 0, metMinutes: 0, aerobicMetMinutes: 0, metUnknown: 0, strengthDays: 0, activeDays: 0, status: 'below', toGo: WHO.moderateMin, byActivity: [] };
    var sDays = {}, aDays = {}, byAct = {};
    (entries || []).forEach(function (e) {
      if (!e || e.type !== 'exercise' || !e.data || e.date < from || e.date > end) return;
      var d = e.data, m = Math.max(0, Math.round(Number(d.minutes) || 0)); if (!m) return;
      var it = d.intensity || intensityOf(d.met, null), aerobic = d.aerobic !== false && d.activity !== 'strength';
      s.sessions++; s.minutes += m; aDays[e.date] = 1;
      if (d.strength && it && it !== 'light') sDays[e.date] = 1;
      if (!aerobic) s.strengthMinutes += m;
      else if (it === 'vigorous') s.vigorous += m;
      else if (it === 'moderate') s.moderate += m;
      else s.light += m;
      var mm = metMinutes(d); if (mm === null) s.metUnknown++; else { s.metMinutes += mm; if (aerobic && (it === 'moderate' || it === 'vigorous')) s.aerobicMetMinutes += mm; }
      var k = d.activity || 'other'; byAct[k] = byAct[k] || { activity: k, label: d.label || (BY[k] ? BY[k].label : 'Movement'), minutes: 0, sessions: 0 }; byAct[k].minutes += m; byAct[k].sessions++;
    });
    s.metMinutes = Math.round(s.metMinutes); s.aerobicMetMinutes = Math.round(s.aerobicMetMinutes);
    s.moderateEquivalent = s.moderate + 2 * s.vigorous;
    s.strengthDays = Object.keys(sDays).length;
    s.activeDays = Object.keys(aDays).length;
    s.status = s.moderateEquivalent < WHO.moderateMin ? 'below' : s.moderateEquivalent <= WHO.moderateMax ? 'in' : 'above';
    s.toGo = Math.max(0, WHO.moderateMin - s.moderateEquivalent);
    s.byActivity = Object.keys(byAct).map(function (k) { return byAct[k]; }).sort(function (a, b) { return b.minutes - a.minutes; });
    return s;
  }
  /* One plain sentence for the week; never a score, never a judgement. */
  function weekLine(s) {
    if (!s.sessions) return 'Nothing logged in the last 7 days yet. Some movement is better than none, and every minute counts.';
    if (s.status === 'below') return s.toGo + ' more moderate minutes would reach WHO’s weekly range. Some movement is better than none.';
    if (s.status === 'in') return 'You are inside WHO’s weekly range of 150 to 300 moderate minutes.';
    return 'You are above WHO’s weekly range. WHO says more can bring extra benefit.';
  }

  /* Today's logged body context, never a predicted phase: a period day or cramps ticked. Spotting is not a period
     (ovu-store.js keeps it out of period episodes), so it gets no period framing here. */
  function periodContext(todayEntries) {
    var period = (todayEntries || []).some(function (e) { return e && e.type === 'period' && e.data && e.data.flow && e.data.flow !== 'none' && e.data.flow !== 'spotting'; });
    var cramps = (todayEntries || []).some(function (e) { return e && e.type === 'symptom' && e.data && (e.data.symptoms || []).indexOf('cramps') > -1; });
    return period ? 'period' : cramps ? 'cramps' : null;
  }

  /* Words shown in the app, kept here so the tests can read every one of them (no em dashes, no fixed-day rules). */
  var COPY = {
    week: 'WHO suggests 150 to 300 minutes of moderate activity a week, or 75 to 150 minutes of vigorous activity, or a mix of both, plus muscle-strengthening on 2 or more days. Some movement is better than none: start small and build up.',
    periodTitle: { period: 'Moving on your period', cramps: 'Moving with cramps' },
    period: 'Moving on your period is your choice. If you feel like it, gentle exercise such as walking, swimming, yoga or cycling may help with cramps, and resting is fine too. Listen to your body, and stop if something hurts.',
    periodEvidence: 'Trials suggest regular exercise through the month may ease period pain, but the evidence is low certainty, some trials asked women not to exercise while bleeding, and it is unclear whether the benefit holds after 25.',
    redFlags: 'Ask for an urgent appointment if the pain is severe or worse than usual and painkillers have not helped. See a doctor if your periods become more painful, heavier or irregular, if pain stops your usual day, if you have pain during sex or when peeing or pooing, or if you bleed between periods. If your periods stop while you are training a lot, tell a doctor too: too much exercise is one of the causes.',
    cycle: 'Energy and strength can feel different across your cycle, and that is normal. A large review found that performance might dip very slightly early in the cycle, on average, but the evidence was weak and studies varied a lot, so the researchers suggest going by how you respond rather than a calendar. Rhythme never plans your training by cycle day.',
    pregnancy: 'In pregnancy and after birth, if there is no medical reason not to, WHO suggests regular activity: at least 150 minutes of moderate activity across the week, with some muscle-strengthening and gentle stretching. Start small and build up. In pregnancy WHO also advises avoiding exercise in excessive heat and humidity (so not hot yoga), contact sports and activities with a high risk of falling, and exercises lying on your back after the first three months; drink water before, during and after. After birth, return gradually, and after a caesarean, plan your return with a health professional. If new symptoms appear, stop and get advice.',
    later: 'From 65, WHO adds balance and strength work at moderate effort or more on 3 or more days a week, to keep you steady and help prevent falls.',
    counting: 'Each activity uses a reference MET value from the 2024 Adult Compendium of Physical Activities, tailored to adults aged 19 to 59, so it is an estimate: the same walk can feel harder or easier for you. MET-minutes are MET times minutes. WHO counts minutes: moderate is 3 to under 6 METs, vigorous 6 or more, and a vigorous minute counts as two. Light movement and strength work are shown but do not count toward the aerobic minutes, and the 500 to 1,000 MET-minute guide counts only moderate and vigorous aerobic activity. A strength day is a day you worked all your main muscle groups at moderate effort or more; you tick it yourself. Something else has no MET value, so it counts by the effort you choose and is left out of MET-minutes.',
    strengthTick: 'Worked all my main muscle groups, at moderate effort or more (a strength day)'
  };

  root.OvuExercise = { ACTIVITIES: ACTIVITIES, WHO: WHO, COPY: COPY, MAX_MINUTES: MAX_MINUTES, WORD: WORD, activity: activity, variant: variant, intensityOf: intensityOf, makeEntry: makeEntry, metMinutes: metMinutes, week: week, weekLine: weekLine, periodContext: periodContext, addDays: addDays };
})(typeof window !== 'undefined' ? window : this);
