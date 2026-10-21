/* Rhythme health import: reads an Apple Health export (export.zip or export.xml) or Google
 * Takeout's Fit folder (the Takeout zip, or its JSON and CSV files) on the phone and turns sleep
 * nights, weigh-ins and period days into diary entries. Nothing is uploaded.
 *
 * How it stays light on a phone: files are read in 2 MB slices; export.xml (often hundreds of MB)
 * is scanned with a per-<Record> regex and a small carry buffer, never held as one string; zips
 * are read by walking the central directory and inflating one entry at a time through fflate
 * (assets/vendor, MIT, loaded only when a zip is chosen). Only the three record kinds Rhythme has
 * a place for are kept; everything else is counted and named in the summary.
 *
 * Reading a file only scans it: kinds() lists every kind found with counts and date ranges, and
 * nothing is written until the person ticks kinds in the picker (none are ticked by default).
 * Imported entries carry source 'apple-health' or 'google-fit'. A day that already holds an entry
 * written by hand (or by any other source) is left alone; a day already imported from the same
 * source is refreshed in place; removal takes out only these two sources, one kind or all of them.
 * An imported entry that the person edits becomes theirs (ovu-store.js update), so it is never
 * overwritten by a later import or removed with the imported data.
 * The pure functions here are unit-tested in tools/test-core.js. */
(function (root) {
  'use strict';
  var SOURCE = { apple: 'apple-health', google: 'google-fit' };
  var SOURCES = [SOURCE.apple, SOURCE.google];
  var CHUNK = 2 * 1024 * 1024;
  var ZIP_LIB = 'assets/vendor/fflate-0.8.2.umd.min.js';
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var breathe = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

  /* ---------- wall-clock time in the record's own offset ----------
   * Apple writes "2026-03-01 23:15:00 +0800"; Takeout writes "2026-03-01T23:15:00.000+08:00". We keep the
   * clock time the phone showed when the record was made, so a night slept in Singapore still reads
   * 23:15 to 07:05 when the export is opened elsewhere. `wall` is epoch ms shifted by the offset and is
   * read back with UTC getters; `ms` is the true instant. */
  function parseStamp(s) {
    if (typeof s !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(s.trim());
    if (!m) return null;
    var wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0), +((m[7] || '0') + '00').slice(0, 3));
    if (isNaN(wall)) return null;
    var off = 0;
    if (m[8] && m[8] !== 'Z') { var d = m[8].slice(1).replace(':', ''); off = (m[8][0] === '-' ? -1 : 1) * (Number(d.slice(0, 2)) * 60 + Number(d.slice(2, 4))) * 60000; }
    return { wall: wall, ms: wall - off };
  }
  function wallDate(w) { var d = new Date(w); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function wallHM(w) { var d = new Date(w); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
  function toKg(v, unit) {
    var x = Number(String(v === undefined || v === null ? '' : v).replace(',', '.')); if (!isFinite(x) || x <= 0) return null;
    var u = String(unit || 'kg').toLowerCase().trim();
    if (u === 'lb' || u === 'lbs') x *= 0.45359237; else if (u === 'g') x /= 1000; else if (u === 'st') x *= 6.35029318; else if (u !== 'kg' && u !== 'kgs') return null;
    x = Math.round(x * 10) / 10; return x >= 20 && x <= 400 ? x : null;
  }

  /* ---------- nights from sleep segments ----------
   * Segments are {s, e} in wall ms. Overlaps (an Apple Watch and an iPhone can both write the same
   * minutes) are merged; a gap of more than four hours starts a new session; a session belongs to the
   * date of the morning it ends on, so a night that crosses midnight lands on the morning's date. When
   * two sessions share a date the longer one is the night and the others count as naps. Bedtime is the
   * first asleep start, wake the last asleep end, and the hours are the asleep minutes added up. */
  var GAP = 4 * 3600000;
  function nightsFrom(segs) {
    var list = (segs || []).filter(function (x) { return x && isFinite(x.s) && isFinite(x.e) && x.e > x.s; }).sort(function (a, b) { return a.s - b.s; });
    var merged = [];
    list.forEach(function (x) { var l = merged[merged.length - 1]; if (l && x.s <= l.e + 60000) { if (x.e > l.e) l.e = x.e; } else merged.push({ s: x.s, e: x.e }); });
    var sessions = [];
    merged.forEach(function (x) { var l = sessions[sessions.length - 1]; if (l && x.s - l.e <= GAP) { l.e = x.e; l.asleep += x.e - x.s; l.n++; } else sessions.push({ s: x.s, e: x.e, asleep: x.e - x.s, n: 1 }); });
    var byDate = {}, naps = 0;
    sessions.forEach(function (ss) { var d = wallDate(ss.e), cur = byDate[d]; if (!cur) byDate[d] = ss; else { naps++; if (ss.asleep > cur.asleep) byDate[d] = ss; } });
    var nights = Object.keys(byDate).sort().map(function (d) {
      var ss = byDate[d];
      return { date: d, bedTime: wallHM(ss.s), wakeTime: wallHM(ss.e), asleepMin: Math.round(ss.asleep / 60000), hours: Math.round(ss.asleep / 360000) / 10, segments: ss.n };
    });
    return { nights: nights, naps: naps };
  }
  var FLOW_RANK = { unspecified: 1, light: 2, medium: 3, heavy: 4 };
  /* mindful sessions per start day as true-time intervals; mindDays() merges overlaps before adding minutes up */
  function mindAdd(map, s, e) { var d = wallDate(s.wall); (map[d] = map[d] || []).push({ s: s.ms, e: e.ms }); }
  function mindDays(map) {
    return Object.keys(map).sort().map(function (d) {
      var iv = map[d].slice().sort(function (a, b) { return a.s - b.s; }), merged = [];
      iv.forEach(function (x) { var l = merged[merged.length - 1]; if (l && x.s <= l.e) { if (x.e > l.e) l.e = x.e; } else merged.push({ s: x.s, e: x.e }); });
      var mins = merged.reduce(function (n, x) { return n + (x.e - x.s) / 60000; }, 0);
      return { date: d, minutes: Math.max(1, Math.round(mins)), sessions: merged.length };
    });
  }
  function strongerFlow(a, b) { if (!a) return b; if (!b) return a; return FLOW_RANK[b] > FLOW_RANK[a] ? b : a; }

  /* ---------- Apple Health export.xml ----------
   * Record attributes we read: type, unit, startDate, endDate, value. Sleep values are the
   * HKCategoryValueSleepAnalysis* names (older exports wrote numbers: 0 in bed, 1 asleep, 2 awake,
   * 3 core, 4 deep, 5 REM). Menstrual flow: Unspecified 1, Light 2, Medium 3, Heavy 4, None 5 (skipped).
   * Body mass comes with a unit, usually kg or lb. */
  var SLEEP_T = 'HKCategoryTypeIdentifierSleepAnalysis', MASS_T = 'HKQuantityTypeIdentifierBodyMass', FLOW_T = 'HKCategoryTypeIdentifierMenstrualFlow';
  var SPOT_T = 'HKCategoryTypeIdentifierIntermenstrualBleeding', MIND_T = 'HKCategoryTypeIdentifierMindfulSession', WORKOUT_T = 'HKWorkout';
  /* Apple's symptom types (developer.apple.com/documentation/healthkit/symptom-type-identifiers, read 19 Oct 2026)
   * that match one of Rhythme's own symptom chips (OvuAgents.SYMPTOMS). The rest (mood changes, night sweats,
   * sleep changes, memory lapse and so on) have no chip and are listed as not in Rhythme yet, never guessed. */
  var SYMPTOM_T = { HKCategoryTypeIdentifierAbdominalCramps: 'cramps', HKCategoryTypeIdentifierHeadache: 'headache', HKCategoryTypeIdentifierBloating: 'bloating', HKCategoryTypeIdentifierBreastPain: 'breast tenderness', HKCategoryTypeIdentifierLowerBackPain: 'back pain', HKCategoryTypeIdentifierFatigue: 'fatigue', HKCategoryTypeIdentifierNausea: 'nausea', HKCategoryTypeIdentifierAcne: 'acne', HKCategoryTypeIdentifierHotFlashes: 'hot flushes', HKCategoryTypeIdentifierDizziness: 'dizziness' };
  /* severity and presence values: NotPresent (raw 1) means the symptom was recorded as absent */
  function symptomPresent(v) { v = String(v || ''); return !(/NotPresent/i.test(v) || v === '1'); }
  var FLOW = { '1': 'unspecified', '2': 'light', '3': 'medium', '4': 'heavy', '5': 'none', HKCategoryValueMenstrualFlowUnspecified: 'unspecified', HKCategoryValueMenstrualFlowLight: 'light', HKCategoryValueMenstrualFlowMedium: 'medium', HKCategoryValueMenstrualFlowHeavy: 'heavy', HKCategoryValueMenstrualFlowNone: 'none' };
  var FRIENDLY = { HKWorkout: 'workouts', HKCategoryTypeIdentifierNightSweats: 'night sweats', HKCategoryTypeIdentifierSleepChanges: 'sleep changes', HKCategoryTypeIdentifierMemoryLapse: 'memory lapse', HKCategoryTypeIdentifierPelvicPain: 'pelvic pain', HKCategoryTypeIdentifierVaginalDryness: 'vaginal dryness', HKCategoryTypeIdentifierAppetiteChanges: 'appetite changes', HKCategoryTypeIdentifierHandwashingEvent: 'handwashing', HKCategoryTypeIdentifierToothbrushingEvent: 'toothbrushing', HKQuantityTypeIdentifierStepCount: 'steps', HKQuantityTypeIdentifierHeartRate: 'heart rate', HKQuantityTypeIdentifierActiveEnergyBurned: 'active energy', HKQuantityTypeIdentifierBasalEnergyBurned: 'resting energy', HKQuantityTypeIdentifierDistanceWalkingRunning: 'walking distance', HKQuantityTypeIdentifierFlightsClimbed: 'flights climbed', HKQuantityTypeIdentifierRespiratoryRate: 'breathing rate', HKQuantityTypeIdentifierHeartRateVariabilitySDNN: 'heart rate variability', HKQuantityTypeIdentifierOxygenSaturation: 'blood oxygen', HKQuantityTypeIdentifierAppleExerciseTime: 'exercise minutes', HKQuantityTypeIdentifierAppleStandTime: 'stand time', HKCategoryTypeIdentifierAppleStandHour: 'stand hours', HKQuantityTypeIdentifierEnvironmentalAudioExposure: 'noise levels', HKQuantityTypeIdentifierHeadphoneAudioExposure: 'headphone levels', HKQuantityTypeIdentifierWalkingSpeed: 'walking speed', HKQuantityTypeIdentifierBodyMassIndex: 'BMI', HKQuantityTypeIdentifierHeight: 'height', HKQuantityTypeIdentifierBodyTemperature: 'body temperature', HKQuantityTypeIdentifierBasalBodyTemperature: 'basal body temperature', HKQuantityTypeIdentifierAppleSleepingWristTemperature: 'wrist temperature', HKCategoryTypeIdentifierOvulationTestResult: 'ovulation tests', HKCategoryTypeIdentifierCervicalMucusQuality: 'cervical mucus', HKCategoryTypeIdentifierIntermenstrualBleeding: 'spotting between periods', HKCategoryTypeIdentifierSexualActivity: 'sexual activity', HKCategoryTypeIdentifierMindfulSession: 'mindful minutes', HKQuantityTypeIdentifierDietaryWater: 'water', HKQuantityTypeIdentifierDietaryEnergyConsumed: 'calories eaten', HKCategoryTypeIdentifierHeadache: 'headaches', HKCategoryTypeIdentifierAbdominalCramps: 'cramps', HKCategoryTypeIdentifierMoodChanges: 'mood changes', HKCategoryTypeIdentifierBloating: 'bloating', HKCategoryTypeIdentifierFatigue: 'fatigue', HKQuantityTypeIdentifierRestingHeartRate: 'resting heart rate', HKQuantityTypeIdentifierWalkingHeartRateAverage: 'walking heart rate', HKQuantityTypeIdentifierVO2Max: 'VO2 max', HKQuantityTypeIdentifierBloodPressureSystolic: 'blood pressure', HKQuantityTypeIdentifierBloodPressureDiastolic: 'blood pressure', HKQuantityTypeIdentifierBloodGlucose: 'blood glucose' };
  function friendlyType(t) {
    if (FRIENDLY[t]) return FRIENDLY[t];
    var s = String(t || '').replace(/^HK(Quantity|Category|Correlation|Data)TypeIdentifier/, '').replace(/^Apple/, '');
    return s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() || 'other records';
  }
  function sleepKind(v) {
    if (/Asleep/.test(v) || v === '1' || v === '3' || v === '4' || v === '5') return 'asleep';
    if (/InBed/.test(v) || v === '0') return 'inbed';
    return null;
  }
  function attrs(s) { var o = {}, m, re = /([\w:.-]+)="([^"]*)"/g; while ((m = re.exec(s))) o[m[1]] = m[2]; return o; }

  function appleScanner() {
    var carry = '', asleep = [], inbed = [], weights = {}, flows = {}, spots = {}, syms = {}, minds = {}, skipped = {}, skipDates = {};
    var counts = { records: 0, sleepSegments: 0, awake: 0, weighIns: 0, flowRecords: 0, flowNone: 0, spotRecords: 0, symptomRecords: 0, symptomAbsent: 0, mindfulSessions: 0, workouts: 0, unreadable: 0 };
    var RE = /<(Record|Workout)\s([^>]*)>/g;
    /* kinds Rhythme has no place for are counted with their first and last date (the first ten characters of startDate) */
    function skip(t, body) {
      skipped[t] = (skipped[t] || 0) + 1;
      var si = body.indexOf('startDate="'), d = si > -1 ? body.slice(si + 11, si + 21) : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      var r = skipDates[t]; if (!r) skipDates[t] = { from: d, to: d }; else { if (d < r.from) r.from = d; if (d > r.to) r.to = d; }
    }
    function one(a) {
      var t = a.type;
      if (t === SLEEP_T) {
        var k = sleepKind(a.value || ''); if (!k) { counts.awake++; return; }
        var s = parseStamp(a.startDate), e = parseStamp(a.endDate); if (!s || !e || e.wall <= s.wall) { counts.unreadable++; return; }
        (k === 'asleep' ? asleep : inbed).push({ s: s.wall, e: e.wall }); counts.sleepSegments++; return;
      }
      if (t === MASS_T) {
        var kg = toKg(a.value, a.unit), st = parseStamp(a.startDate); if (kg === null || !st) { counts.unreadable++; return; }
        var d = wallDate(st.wall); if (!weights[d] || st.wall >= weights[d].wall) weights[d] = { wall: st.wall, kg: kg }; counts.weighIns++; return;
      }
      if (t === FLOW_T) {
        var f = FLOW[a.value], fs = parseStamp(a.startDate); if (!f || !fs) { counts.unreadable++; return; }
        if (f === 'none') { counts.flowNone++; return; }
        var fd = wallDate(fs.wall); flows[fd] = strongerFlow(flows[fd], f); counts.flowRecords++; return;
      }
      if (t === SPOT_T) {
        var ss = parseStamp(a.startDate); if (!ss) { counts.unreadable++; return; }
        spots[wallDate(ss.wall)] = true; counts.spotRecords++; return;
      }
      if (t === MIND_T) {
        var ms = parseStamp(a.startDate), me = parseStamp(a.endDate); if (!ms || !me) { counts.unreadable++; return; }
        var mins = (me.ms - ms.ms) / 60000; if (!(mins >= 0.5 && mins <= 600)) { counts.unreadable++; return; }
        mindAdd(minds, ms, me); counts.mindfulSessions++; return;
      }
      if (SYMPTOM_T[t]) {
        if (!symptomPresent(a.value)) { counts.symptomAbsent++; return; }
        var ys = parseStamp(a.startDate); if (!ys) { counts.unreadable++; return; }
        var yd = wallDate(ys.wall), list = syms[yd] || (syms[yd] = []); if (list.indexOf(SYMPTOM_T[t]) < 0) list.push(SYMPTOM_T[t]); counts.symptomRecords++; return;
      }
      counts.unreadable++;
    }
    function push(text, final) {
      var buf = carry ? carry + text : (text || '');
      var cut = final ? buf.length : buf.lastIndexOf('>') + 1;
      carry = final ? '' : buf.slice(cut);
      var head = cut === buf.length ? buf : buf.slice(0, cut), m;
      RE.lastIndex = 0;
      while ((m = RE.exec(head))) {
        var body = m[2];
        if (m[1] === 'Workout') { counts.workouts++; skip(WORKOUT_T, body); continue; }
        counts.records++;
        var ti = body.indexOf('type="'); if (ti < 0) { counts.unreadable++; continue; }
        var t = body.slice(ti + 6, body.indexOf('"', ti + 6));
        if (t === SLEEP_T || t === MASS_T || t === FLOW_T || t === SPOT_T || t === MIND_T || SYMPTOM_T[t]) one(attrs(body)); else skip(t, body);
      }
    }
    function result() {
      var sl = nightsFrom(asleep), nights = sl.nights, have = {};
      nights.forEach(function (n) { have[n.date] = 1; n.basis = 'asleep'; });
      /* An iPhone without a watch only writes time in bed; those nights are kept, labelled, where no asleep data exists. */
      var ib = nightsFrom(inbed); ib.nights.forEach(function (n) { if (!have[n.date]) { n.basis = 'in-bed'; nights.push(n); } });
      nights.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      var weight = Object.keys(weights).sort().map(function (d) { return { date: d, kg: weights[d].kg }; });
      var period = Object.keys(flows).sort().map(function (d) { return { date: d, flow: flows[d] }; });
      /* a day with recorded flow is a period day, so spotting on that same day is not listed separately */
      var spotting = Object.keys(spots).filter(function (d) { return !flows[d]; }).sort().map(function (d) { return { date: d, flow: 'spotting' }; });
      var symptoms = Object.keys(syms).sort().map(function (d) { return { date: d, symptoms: syms[d].slice() }; });
      var mindful = mindDays(minds);
      var total = 0; Object.keys(skipped).forEach(function (k) { total += skipped[k]; });
      return { source: SOURCE.apple, sleep: nights, weight: weight, period: period, spotting: spotting, symptoms: symptoms, mindful: mindful, naps: sl.naps, inBedNights: ib.nights.filter(function (n) { return n.basis === 'in-bed'; }).length, skipped: skipped, skipDates: skipDates, skippedTotal: total, skippedKinds: Object.keys(skipped).length, counts: counts };
    }
    /* record(a): one HealthKit sample handed over by the native shell, already split into the export's
     * attributes (type, startDate, endDate, value, unit), so a direct read takes exactly the path a file does */
    function record(a) {
      if (!a || typeof a.type !== 'string') { counts.unreadable++; return; }
      counts.records++; var t = a.type;
      if (t === SLEEP_T || t === MASS_T || t === FLOW_T || t === SPOT_T || t === MIND_T || SYMPTOM_T[t]) one({ type: t, startDate: String(a.startDate || ''), endDate: String(a.endDate || ''), value: a.value === undefined || a.value === null ? '' : String(a.value), unit: a.unit ? String(a.unit) : '' });
      else skip(t, 'startDate="' + String(a.startDate || '') + '"');
    }
    return { push: push, record: record, result: result };
  }
  function parseAppleXml(text) { var sc = appleScanner(); sc.push(text, true); return sc.result(); }

  /* ---------- Google Takeout: Fit ----------
   * Takeout/Fit/All Sessions/*.json holds one session per file (sleep sessions carry stage segments);
   * Takeout/Fit/Daily activity metrics/*.csv holds "Daily activity metrics.csv" (one row per date) and
   * one file per day with 15-minute rows. Google documents neither file, so the reader looks for the
   * fields by name and ignores what it cannot place. Health Connect itself only backs up to cloud storage. */
  function googleSession(obj, name) {
    if (!obj || typeof obj !== 'object') return null;
    var act = String(obj.fitnessActivity || obj.activityType || obj.activity || obj.type || '').toLowerCase();
    if (!(/sleep/.test(act) || /_SLEEP\.json$/i.test(name || ''))) return null;
    var s = parseStamp(obj.startTime), e = parseStamp(obj.endTime); if (!s || !e || e.wall <= s.wall) return null;
    var segs = [];
    (Array.isArray(obj.segment) ? obj.segment : Array.isArray(obj.segments) ? obj.segments : []).forEach(function (sg) {
      var a = String(sg && (sg.fitnessActivity || sg.activityType || sg.activity || sg.type) || '').toLowerCase();
      if (/awake|out.?of.?bed|unknown/.test(a)) return;
      var ss = parseStamp(sg.startTime), se = parseStamp(sg.endTime); if (ss && se && se.wall > ss.wall) segs.push({ s: ss.wall, e: se.wall });
    });
    if (!segs.length) segs.push({ s: s.wall, e: e.wall });
    return segs;
  }
  function parseCsv(text) {
    var rows = [], row = [], cell = '', q = false, i, c;
    text = String(text || '').replace(/^﻿/, '');
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || (r[0] || '').trim(); });
  }
  function googleDailyCsv(text, name) {
    var rows = parseCsv(text); if (rows.length < 2) return [];
    var header = rows[0].map(function (h) { return h.trim(); });
    var di = -1, wi = -1, unit = 'kg';
    header.forEach(function (h, i) {
      if (/^date$/i.test(h)) di = i;
      if (wi < 0 && /average weight/i.test(h)) { wi = i; unit = /\(lb/i.test(h) ? 'lb' : 'kg'; }
    });
    if (wi < 0) header.forEach(function (h, i) { if (wi < 0 && /weight/i.test(h) && /\((kg|lb)/i.test(h)) { wi = i; unit = /\(lb/i.test(h) ? 'lb' : 'kg'; } });
    if (wi < 0) return [];
    var fileDate = (/(\d{4}-\d{2}-\d{2})\.csv$/i.exec(name || '') || [])[1] || null, out = {};
    rows.slice(1).forEach(function (r) {
      var date = di >= 0 ? String(r[di] || '').trim().slice(0, 10) : fileDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return;
      var kg = toKg(r[wi], unit); if (kg === null) return;
      out[date] = kg;
    });
    return Object.keys(out).sort().map(function (d) { return { date: d, kg: out[d] }; });
  }
  function googleBuilder() {
    var segs = [], weights = {}, minds = {}, cols = {}, counts = { files: 0, sleepSessions: 0, mindfulSessions: 0, otherSessions: 0, csvFiles: 0, weighIns: 0, unreadable: 0 }, otherKinds = {}, skipDates = {};
    function seen(k, d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return; var r = skipDates[k]; if (!r) skipDates[k] = { from: d, to: d }; else { if (d < r.from) r.from = d; if (d > r.to) r.to = d; } }
    return {
      json: function (text, name) {
        counts.files++;
        var obj; try { obj = JSON.parse(text); } catch (e) { counts.unreadable++; return; }
        var s = googleSession(obj, name);
        if (s) { counts.sleepSessions++; segs = segs.concat(s); return; }
        var act = String(obj && (obj.fitnessActivity || obj.activityType || obj.activity) || 'other').toLowerCase().replace(/_/g, ' ');
        var st = parseStamp(obj && obj.startTime), en = parseStamp(obj && obj.endTime);
        if (/meditat|mindful/.test(act) && st && en && en.ms > st.ms) {
          var mins = (en.ms - st.ms) / 60000; if (mins >= 0.5 && mins <= 600) { mindAdd(minds, st, en); counts.mindfulSessions++; return; }
        }
        counts.otherSessions++; otherKinds[act] = (otherKinds[act] || 0) + 1; if (st) seen(act, wallDate(st.wall));
      },
      csv: function (text, name) {
        counts.files++; counts.csvFiles++;
        googleDailyCsv(text, name).forEach(function (w) { weights[w.date] = w.kg; counts.weighIns++; });
        var dc = googleDailyColumns(text, name); Object.keys(dc).forEach(function (n) { var m = cols[n] || (cols[n] = {}); dc[n].forEach(function (d) { m[d] = 1; }); });
      },
      result: function () {
        var sl = nightsFrom(segs); sl.nights.forEach(function (n) { n.basis = 'asleep'; });
        var weight = Object.keys(weights).sort().map(function (d) { return { date: d, kg: weights[d] }; });
        var mindful = mindDays(minds);
        Object.keys(cols).forEach(function (name) { var ds = Object.keys(cols[name]).sort(); if (ds.length) { otherKinds[name] = ds.length; skipDates[name] = { from: ds[0], to: ds[ds.length - 1] }; } });
        var total = 0; Object.keys(otherKinds).forEach(function (k) { total += otherKinds[k]; });
        return { source: SOURCE.google, sleep: sl.nights, weight: weight, period: [], spotting: [], symptoms: [], mindful: mindful, naps: sl.naps, inBedNights: 0, skipped: otherKinds, skipDates: skipDates, skippedTotal: total, skippedKinds: Object.keys(otherKinds).length, counts: counts };
      }
    };
  }
  /* Every other numeric column of a Takeout daily CSV (steps, calories, distance, Heart Points, move minutes and so on)
   * is a kind Rhythme has no place for yet: {name: [dates with a value above zero]}. Weight columns and the date and
   * time columns are left out. The summary file has a Date column; a per-day file is named by its date. */
  function googleDailyColumns(text, name) {
    var rows = parseCsv(text); if (rows.length < 2) return {};
    var header = rows[0].map(function (h) { return h.trim(); }), di = -1, cs = [];
    header.forEach(function (h, i) {
      if (/^date$/i.test(h)) { di = i; return; }
      if (!h || /weight/i.test(h) || /^(start|end) time$/i.test(h)) return;
      var nm = h.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+count$/i, '').trim().toLowerCase();
      cs.push({ i: i, name: nm === 'step' ? 'steps' : nm });
    });
    var fileDate = (/(\d{4}-\d{2}-\d{2})\.csv$/i.exec(name || '') || [])[1] || null, out = {};
    rows.slice(1).forEach(function (r) {
      var d = di >= 0 ? String(r[di] || '').trim().slice(0, 10) : fileDate; if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return;
      cs.forEach(function (c) { if (Number(r[c.i]) > 0) (out[c.name] = out[c.name] || {})[d] = 1; });
    });
    var res = {}; Object.keys(out).forEach(function (n) { res[n] = Object.keys(out[n]); }); return res;
  }

  /* ---------- zip reading: central directory, one entry at a time ---------- */
  function u16(b, i) { return b[i] | (b[i + 1] << 8); }
  function u32(b, i) { return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) + b[i + 3] * 16777216; }
  function u64(b, i) { return u32(b, i) + u32(b, i + 4) * 4294967296; }
  function sig(b, i, c, d) { return b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === c && b[i + 3] === d; }
  function readSlice(file, a, b) { return file.slice(a, b).arrayBuffer().then(function (ab) { return new Uint8Array(ab); }); }
  var utf8 = function (u8) { return new TextDecoder('utf-8').decode(u8); };
  function zipIndex(file) {
    var size = file.size, tailLen = Math.min(size, 65557 + 20);
    if (size < 22) return Promise.reject(new Error('This file is too small to be a zip.'));
    return readSlice(file, size - tailLen, size).then(function (tail) {
      var i; for (i = tail.length - 22; i >= 0; i--) if (sig(tail, i, 0x05, 0x06)) break;
      if (i < 0) throw new Error('This file does not look like a zip.');
      var count = u16(tail, i + 10), cdSize = u32(tail, i + 12), cdOff = u32(tail, i + 16), p = Promise.resolve();
      if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) {
        var li = i - 20;
        if (li < 0 || !sig(tail, li, 0x06, 0x07)) throw new Error('This zip uses a layout Rhythme cannot read.');
        var recOff = u64(tail, li + 8);
        p = readSlice(file, recOff, recOff + 56).then(function (r) { if (!sig(r, 0, 0x06, 0x06)) throw new Error('This zip uses a layout Rhythme cannot read.'); cdSize = u64(r, 40); cdOff = u64(r, 48); });
      }
      return p.then(function () { return readSlice(file, cdOff, cdOff + cdSize); }).then(function (cd) {
        var entries = [], o = 0;
        while (o + 46 <= cd.length && sig(cd, o, 0x01, 0x02)) {
          var flags = u16(cd, o + 8), method = u16(cd, o + 10), csize = u32(cd, o + 20), usize = u32(cd, o + 24), nl = u16(cd, o + 28), xl = u16(cd, o + 30), cl = u16(cd, o + 32), off = u32(cd, o + 42);
          var name = utf8(cd.subarray(o + 46, o + 46 + nl)), x = o + 46 + nl, xe = x + xl;
          while (x + 4 <= xe) {
            var id = u16(cd, x), len = u16(cd, x + 2), q = x + 4;
            if (id === 1) { if (usize === 0xffffffff) { usize = u64(cd, q); q += 8; } if (csize === 0xffffffff) { csize = u64(cd, q); q += 8; } if (off === 0xffffffff) { off = u64(cd, q); } }
            x += 4 + len;
          }
          entries.push({ name: name, flags: flags, method: method, csize: csize, usize: usize, offset: off, dir: /\/$/.test(name) });
          o += 46 + nl + xl + cl;
        }
        return entries;
      });
    });
  }
  function ensureZipLib() {
    if (root.fflate) return Promise.resolve(root.fflate);
    if (!root.document) return Promise.reject(new Error('The zip reader is not loaded.'));
    return new Promise(function (res, rej) {
      var s = root.document.createElement('script'); s.src = ZIP_LIB;
      s.onload = function () { if (root.fflate) res(root.fflate); else rej(new Error('The zip reader did not load.')); };
      s.onerror = function () { rej(new Error('The zip reader could not load. Please check your connection once and try again.')); };
      root.document.head.appendChild(s);
    });
  }
  /* Streams one entry's bytes to onChunk(u8, final), inflating when needed. Progress is 0 to 1 over the entry. */
  function zipEntryStream(file, ent, onChunk, onProgress) {
    if (ent.flags & 1) return Promise.reject(new Error('This zip is password protected. Please export it again without a password.'));
    if (ent.method !== 8 && ent.method !== 0) return Promise.reject(new Error('This zip uses a compression Rhythme cannot read.'));
    return ensureZipLib().then(function (ff) { return readSlice(file, ent.offset, ent.offset + 30).then(function (h) {
      if (!sig(h, 0, 0x03, 0x04)) throw new Error('This zip looks damaged.');
      var start = ent.offset + 30 + u16(h, 26) + u16(h, 28), end = start + ent.csize, pos = start, done = false;
      var inf = ent.method === 8 ? new ff.Inflate(function (chunk, final) { if (!done) { done = !!final; onChunk(chunk, !!final); } }) : null;
      function step() {
        if (pos >= end) { if (!done) { done = true; onChunk(new Uint8Array(0), true); } return Promise.resolve(); }
        var next = Math.min(end, pos + CHUNK);
        return readSlice(file, pos, next).then(function (u8) {
          pos = next; var final = pos >= end;
          if (inf) inf.push(u8, final); else { done = final; onChunk(u8, final); }
          if (onProgress) onProgress((pos - start) / Math.max(1, end - start));
          return breathe().then(step);
        });
      }
      return step();
    }); });
  }
  function zipEntryText(file, ent) {
    var parts = [];
    return zipEntryStream(file, ent, function (u8) { if (u8.length) parts.push(u8); }).then(function () {
      var n = 0; parts.forEach(function (p) { n += p.length; }); var all = new Uint8Array(n), o = 0; parts.forEach(function (p) { all.set(p, o); o += p.length; });
      return utf8(all);
    });
  }
  function textStream(file, onText, onProgress) {
    var dec = new TextDecoder('utf-8'), pos = 0, size = file.size;
    function step() {
      if (pos >= size) { onText(dec.decode(), true); return Promise.resolve(); }
      var next = Math.min(size, pos + CHUNK);
      return readSlice(file, pos, next).then(function (u8) {
        pos = next; var final = pos >= size;
        onText(dec.decode(u8, { stream: !final }), final);
        if (onProgress) onProgress(pos / size);
        return breathe().then(step);
      });
    }
    return step();
  }

  /* ---------- the import itself ---------- */
  var isApple = function (name) { return /(^|\/)export\.xml$/i.test(name); };
  var isFitJson = function (name) { return /(^|\/)Fit\/[^]*\.json$/i.test(name) && !/\/\._/.test(name); };
  var isFitCsv = function (name) { return /(^|\/)Fit\/[^]*\.csv$/i.test(name) && !/\/\._/.test(name); };
  function appleFromXmlFile(file, progress) {
    var sc = appleScanner();
    progress(0, 'Reading ' + file.name);
    return textStream(file, function (t, final) { sc.push(t, final); }, function (f) { progress(f, 'Reading ' + file.name); }).then(function () { return sc.result(); });
  }
  function appleFromZip(file, ent, progress) {
    var sc = appleScanner(), dec = new TextDecoder('utf-8');
    progress(0, 'Unpacking export.zip');
    return zipEntryStream(file, ent, function (u8, final) { sc.push(dec.decode(u8, { stream: !final }), final); }, function (f) { progress(f, 'Reading export.xml inside the zip'); }).then(function () { return sc.result(); });
  }
  function googleFromZips(zips, progress) {
    var gb = googleBuilder(), jobs = [];
    return zips.reduce(function (p, z) {
      return p.then(function () { return zipIndex(z.file); }).then(function (entries) { entries.forEach(function (e) { if (!e.dir && (isFitJson(e.name) || isFitCsv(e.name))) jobs.push({ file: z.file, ent: e }); }); });
    }, Promise.resolve()).then(function () {
      if (!jobs.length) throw new Error('No Fit folder in this Takeout. In Takeout, tick Fit before creating the export.');
      var i = 0;
      function next() {
        if (i >= jobs.length) return Promise.resolve();
        var j = jobs[i++];
        return zipEntryText(j.file, j.ent).then(function (text) {
          if (isFitJson(j.ent.name)) gb.json(text, j.ent.name); else gb.csv(text, j.ent.name);
          if (i % 25 === 0 || i === jobs.length) progress(i / jobs.length, 'Reading Fit file ' + i + ' of ' + jobs.length);
          return next();
        });
      }
      progress(0, 'Reading ' + jobs.length + ' Fit files'); return next();
    }).then(function () { return gb.result(); });
  }
  function googleFromFiles(files, progress) {
    var gb = googleBuilder(), i = 0;
    function next() {
      if (i >= files.length) return Promise.resolve();
      var f = files[i++];
      return f.text().then(function (text) { if (/\.json$/i.test(f.name)) gb.json(text, f.name); else gb.csv(text, f.name); progress(i / files.length, 'Reading ' + f.name); return next(); });
    }
    return next().then(function () { return gb.result(); });
  }
  /* files: a FileList or array of File. Returns a promise of the parsed result (see appleScanner.result). */
  function importFiles(files, opts) {
    opts = opts || {}; var progress = opts.onProgress || function () { };
    var list = Array.prototype.slice.call(files || []).filter(Boolean);
    if (!list.length) return Promise.reject(new Error('Choose a file first.'));
    var xml = list.filter(function (f) { return /\.xml$/i.test(f.name); })[0];
    var zips = list.filter(function (f) { return /\.zip$/i.test(f.name); });
    var flat = list.filter(function (f) { return /\.(json|csv)$/i.test(f.name); });
    if (xml) return appleFromXmlFile(xml, progress);
    if (zips.length) {
      return ensureZipLib().then(function () { return Promise.all(zips.map(function (z) { return zipIndex(z).then(function (entries) { return { file: z, entries: entries }; }); })); }).then(function (indexed) {
        var apple = null;
        indexed.forEach(function (z) { z.entries.forEach(function (e) { if (!apple && !e.dir && isApple(e.name)) apple = { file: z.file, ent: e }; }); });
        if (apple) return appleFromZip(apple.file, apple.ent, progress);
        var google = indexed.filter(function (z) { return z.entries.some(function (e) { return !e.dir && (isFitJson(e.name) || isFitCsv(e.name)); }); });
        if (google.length) return googleFromZips(google, progress);
        throw new Error('This zip has neither Apple Health’s export.xml nor a Takeout Fit folder. Choose export.zip from the Health app, or the zip Google Takeout made with Fit ticked.');
      });
    }
    if (flat.length) return googleFromFiles(flat, progress);
    return Promise.reject(new Error('Rhythme can read export.zip or export.xml from Apple Health, or the Takeout zip (or the JSON and CSV files inside its Fit folder) from Google.'));
  }

  /* ---------- what was found: the picker's list ----------
   * KINDS are the kinds Rhythme has a place for, in the order the picker shows them. Each maps to one entry
   * type (spotting is a period day with flow 'spotting', mindful minutes are one mindfulness entry per day). */
  var KINDS = [
    { id: 'sleep', type: 'sleep', label: 'Sleep', icon: 'bedtime', one: 'night', many: 'nights', note: 'Bedtime, wake time and hours asleep' },
    { id: 'period', type: 'period', label: 'Period days', icon: 'water_drop', one: 'day', many: 'days', note: 'Flow as recorded' },
    { id: 'spotting', type: 'period', label: 'Spotting between periods', icon: 'opacity', one: 'day', many: 'days', note: 'Shown as spotting; it never starts a new cycle' },
    { id: 'symptoms', type: 'symptom', label: 'Cycle symptoms', icon: 'spa', one: 'day', many: 'days', note: 'Only symptoms Rhythme has a chip for' },
    { id: 'weight', type: 'weight', label: 'Weight', icon: 'monitor_weight', one: 'weigh-in', many: 'weigh-ins', note: 'One per day, in kilograms' },
    { id: 'mindful', type: 'mindfulness', label: 'Mindful minutes', icon: 'self_improvement', one: 'day', many: 'days', note: 'Minutes added up per day' }
  ];
  function kindDef(id) { return KINDS.filter(function (k) { return k.id === id; })[0] || null; }
  function inRange(d, from) { return !from || d >= from; }
  /* kinds(result, {from}) -> {ready: [{id, label, icon, count, from, to, ...}], later: [{name, count, from, to}]} */
  function kinds(result, opts) {
    var from = (opts && opts.from) || null, to = (opts && opts.to) || null, ready = [], later = {};
    KINDS.forEach(function (k) {
      var items = (result[k.id] || []).filter(function (it) { return inRange(it.date, from) && (!to || it.date <= to); });
      if (!(result[k.id] || []).length) return;
      ready.push(Object.assign({}, k, { count: items.length, from: items.length ? items[0].date : null, to: items.length ? items[items.length - 1].date : null }));
    });
    var sk = result.skipped || {}, sd = result.skipDates || {};
    Object.keys(sk).forEach(function (t) {
      var name = result.source === SOURCE.apple ? friendlyType(t) : t, r = sd[t] || {}, cur = later[name] || (later[name] = { name: name, count: 0, from: null, to: null });
      cur.count += sk[t]; if (r.from && (!cur.from || r.from < cur.from)) cur.from = r.from; if (r.to && (!cur.to || r.to > cur.to)) cur.to = r.to;
    });
    return { ready: ready, later: Object.keys(later).map(function (n) { return later[n]; }).sort(function (a, b) { return b.count - a.count; }) };
  }

  /* ---------- writing into the diary ----------
   * plan(result, store, {kinds, from}) decides, per date and kind: skip when someone wrote that day by hand
   * (or another source did), refresh when this same source wrote it before, otherwise add. Only the kinds
   * named in opts.kinds are considered; with no opts every kind is (kept for tests and older callers).
   * apply() writes the plan in one batch. */
  function plan(result, store, opts) {
    opts = opts || {};
    var want = {}, from = opts.from || null;
    (opts.kinds || KINDS.map(function (k) { return k.id; })).forEach(function (id) { want[id] = true; });
    var src = result.source, index = {}, items = [], kept = 0, refreshed = 0, future = 0, dates = [], t = store.today();
    var counts = { sleep: 0, weight: 0, period: 0, spotting: 0, symptoms: 0, mindful: 0 }, keptBy = { sleep: 0, weight: 0, period: 0, spotting: 0, symptoms: 0, mindful: 0 };
    store.list().forEach(function (e) { (index[e.type + '|' + e.date] = index[e.type + '|' + e.date] || []).push(e); });
    function consider(kind, type, date, data) {
      if (!inRange(date, from)) return;
      if (date > t) { future++; return; }
      var ex = index[type + '|' + date] || [];
      if (ex.some(function (e) { return e.source !== src; })) { kept++; keptBy[kind]++; return; }
      var mine = ex.filter(function (e) { return e.source === src; })[0];
      if (mine) { items.push({ id: mine.id, data: data }); refreshed++; } else items.push({ type: type, date: date, data: data, source: src });
      counts[kind]++; dates.push(date);
    }
    var label = src === SOURCE.apple ? 'Apple Health' : 'Google Takeout (Fit)';
    if (want.sleep) (result.sleep || []).forEach(function (n) { consider('sleep', 'sleep', n.date, { bedTime: n.bedTime, wakeTime: n.wakeTime, hours: n.hours, asleepMin: n.asleepMin, quality: null, notes: 'From ' + label + (n.basis === 'in-bed' ? ' (time in bed; no sleep stages were recorded)' : ''), mode: 'import', basis: n.basis || 'asleep', segments: n.segments }); });
    if (want.weight) (result.weight || []).forEach(function (w) { consider('weight', 'weight', w.date, { kg: w.kg }); });
    if (want.period) (result.period || []).forEach(function (p) { consider('period', 'period', p.date, { flow: p.flow }); });
    if (want.spotting) (result.spotting || []).forEach(function (p) { consider('spotting', 'period', p.date, { flow: 'spotting' }); });
    if (want.symptoms) (result.symptoms || []).forEach(function (y) { consider('symptoms', 'symptom', y.date, { symptoms: y.symptoms.slice(), pain: null, mood: '', notes: 'From ' + label }); });
    if (want.mindful) (result.mindful || []).forEach(function (m) { consider('mindful', 'mindfulness', m.date, { kind: 'imported', minutes: m.minutes, sessions: m.sessions, completed: true, guide: 'From ' + label }); });
    dates.sort();
    return { source: src, items: items, counts: counts, kept: kept, keptBy: keptBy, refreshed: refreshed, future: future, from: dates[0] || null, to: dates[dates.length - 1] || null, total: items.length };
  }
  function apply(result, store, opts) {
    var p = plan(result, store, opts);
    var w = store.addMany ? store.addMany(p.items) : { added: 0, updated: 0, skipped: p.items.length };
    p.written = w; return p;
  }
  /* which picker kind an entry belongs to (null for kinds the importer never writes) */
  function kindOf(e) {
    if (e.type === 'period') return e.data && e.data.flow === 'spotting' ? 'spotting' : 'period';
    return { sleep: 'sleep', weight: 'weight', symptom: 'symptoms', mindfulness: 'mindful' }[e.type] || null;
  }
  function isImported(e) { return SOURCES.indexOf(e.source) > -1; }
  function importedCount(store, kind) { return store.list().filter(function (e) { return isImported(e) && (!kind || kindOf(e) === kind); }).length; }
  function removeImported(store, kind) { return store.removeWhere ? store.removeWhere(function (e) { return isImported(e) && (!kind || kindOf(e) === kind); }) : 0; }
  /* what has been brought in so far, per kind, for the Health data view: newest last */
  function imported(store) {
    var out = {};
    store.list().forEach(function (e) {
      if (!isImported(e)) return; var k = kindOf(e); if (!k) return;
      var o = out[k] || (out[k] = Object.assign({}, kindDef(k), { count: 0, from: null, to: null, sources: {}, entries: [] }));
      o.count++; o.entries.push(e); o.sources[e.source] = (o.sources[e.source] || 0) + 1;
      if (!o.from || e.date < o.from) o.from = e.date; if (!o.to || e.date > o.to) o.to = e.date;
    });
    return KINDS.filter(function (k) { return out[k.id]; }).map(function (k) { return out[k.id]; });
  }

  root.OvuHealth = {
    SOURCE: SOURCE, SOURCES: SOURCES, HK: { sleep: SLEEP_T, menstrualFlow: FLOW_T, intermenstrualBleeding: SPOT_T, bodyMass: MASS_T, mindful: MIND_T },
    parseStamp: parseStamp, wallDate: wallDate, wallHM: wallHM, toKg: toKg, nightsFrom: nightsFrom, friendlyType: friendlyType,
    appleScanner: appleScanner, parseAppleXml: parseAppleXml,
    googleSession: googleSession, googleDailyCsv: googleDailyCsv, googleBuilder: googleBuilder, parseCsv: parseCsv,
    zipIndex: zipIndex, zipEntryStream: zipEntryStream, zipEntryText: zipEntryText, ensureZipLib: ensureZipLib,
    importFiles: importFiles, plan: plan, apply: apply, importedCount: importedCount, removeImported: removeImported,
    KINDS: KINDS, kinds: kinds, kindOf: kindOf, imported: imported, isImported: isImported, symptomPresent: symptomPresent, googleDailyColumns: googleDailyColumns, mindDays: mindDays
  };
})(typeof window !== 'undefined' ? window : this);
