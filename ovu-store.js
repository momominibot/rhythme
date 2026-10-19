/* Rhythme local-first record store.
 * One versioned event log in this browser's localStorage. Observation date
 * (`date`) is separate from creation time, so backdated entries are first-class.
 * Nothing here uploads anything. Sharing is an explicit, passphrase-encrypted
 * export (AES-GCM, PBKDF2-SHA256) that the Doctor view decrypts locally.
 */
(function (root) {
  'use strict';
  var KEY = 'ovumind_db_v1';
  var VERSION = 1;
  var TYPES = ['sleep', 'period', 'symptom', 'food', 'reflection', 'mindfulness', 'weight'];
  var SINGLE_PER_DAY = { period: true, symptom: true, weight: true };
  var listeners = [];
  var cache = null;

  function nowIso() { return new Date().toISOString(); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function today(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function validDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + 'T12:00:00Z')) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
  }
  function validTime(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
  function addDays(dateStr, n) { var d = new Date(dateStr + 'T12:00:00'); d.setDate(d.getDate() + n); return today(d); }
  function diffDays(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
  function uid() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function empty() {
    return {
      version: VERSION, createdAt: nowIso(), updatedAt: nowIso(),
      profile: { name: '', outfit: 'base', lifeStage: '', cycleLength: null, periodLength: null },
      events: [], summaries: [],
      state: { sleeping: null, visited: {}, tourDone: false }
    };
  }
  function normalise(db) {
    if (!db || typeof db !== 'object' || Array.isArray(db)) return empty();
    var out = empty();
    out.createdAt = typeof db.createdAt === 'string' ? db.createdAt : out.createdAt;
    out.profile = Object.assign(out.profile, db.profile && typeof db.profile === 'object' ? db.profile : {});
    out.state = Object.assign(out.state, db.state && typeof db.state === 'object' ? db.state : {});
    out.summaries = Array.isArray(db.summaries) ? db.summaries : [];
    out.events = (Array.isArray(db.events) ? db.events : []).filter(function (e) {
      return e && typeof e === 'object' && TYPES.indexOf(e.type) > -1 && validDate(e.date) && e.data && typeof e.data === 'object';
    }).map(function (e) {
      return { id: typeof e.id === 'string' ? e.id : uid(), type: e.type, date: e.date, createdAt: e.createdAt || nowIso(), updatedAt: e.updatedAt || e.createdAt || nowIso(), source: e.source || 'manual', data: e.data };
    });
    return out;
  }
  function load(force) {
    if (cache && !force) return cache;
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    try { cache = normalise(raw ? JSON.parse(raw) : null); } catch (e) { cache = empty(); cache.state.corruptBackup = raw; }
    return cache;
  }
  function emit(reason) { listeners.slice().forEach(function (fn) { try { fn(reason || 'change', cache); } catch (e) { /* listener errors never block saving */ } }); }
  function save(reason) {
    var db = load();
    db.updatedAt = nowIso();
    var text = JSON.stringify(db);
    localStorage.setItem(KEY, text);
    if (localStorage.getItem(KEY) !== text) throw new Error('Saving did not verify. Your browser storage may be full or blocked.');
    emit(reason);
  }
  try { window.addEventListener('storage', function (ev) { if (ev.key === KEY || ev.key === null) { load(true); emit('external'); } }); } catch (e) { /* non-browser */ }

  /* ---------- events ---------- */
  function sortEvents(list) { return list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt < b.createdAt ? -1 : 1); }); }
  function list(type, opts) {
    opts = opts || {};
    var out = load().events.filter(function (e) {
      if (type && e.type !== type) return false;
      if (opts.from && e.date < opts.from) return false;
      if (opts.to && e.date > opts.to) return false;
      return true;
    });
    return sortEvents(out.slice());
  }
  function get(id) { return load().events.filter(function (e) { return e.id === id; })[0] || null; }
  function byDate(date) { return list(null, { from: date, to: date }); }
  /* Merge a second same-day note into a single-per-day entry instead of replacing it:
   * symptoms are unioned, pain and mood are kept unless the new note restates them, notes are joined. */
  function mergeData(type, oldData, newData) {
    var o = oldData || {}, n = newData || {};
    if (type === 'symptom') {
      var syms = (o.symptoms || []).slice(); (n.symptoms || []).forEach(function (s) { if (syms.indexOf(s) < 0) syms.push(s); });
      var merged = Object.assign({}, o, n, {
        symptoms: syms,
        pain: n.pain === null || n.pain === undefined ? (o.pain === undefined ? null : o.pain) : n.pain,
        mood: n.mood ? n.mood : (o.mood || ''),
        notes: [o.notes, n.notes].filter(Boolean).join(' ')
      });
      if (o.none || n.none) { if (syms.length) delete merged.none; else merged.none = true; } /* "None" for the day stops once a symptom is noted */
      return merged;
    }
    return Object.assign({}, o, n);
  }
  function add(type, date, data, source, opts) {
    if (TYPES.indexOf(type) < 0) throw new Error('Unknown entry type: ' + type);
    if (!validDate(date)) throw new Error('Choose a real date.');
    if (date > today()) throw new Error('Entries cannot be in the future.');
    var db = load();
    var existing = SINGLE_PER_DAY[type] ? db.events.filter(function (e) { return e.type === type && e.date === date; })[0] : null;
    if (existing) { return update(existing.id, { data: opts && opts.merge ? mergeData(type, existing.data, data) : data }); }
    var ev = { id: uid(), type: type, date: date, createdAt: nowIso(), updatedAt: nowIso(), source: source || 'room', data: data };
    db.events.push(ev);
    save('add:' + type);
    mirrorLegacy(ev);
    return ev;
  }
  function update(id, patch) {
    var db = load(), ev = get(id);
    if (!ev) throw new Error('That entry no longer exists.');
    if (patch.date !== undefined) { if (!validDate(patch.date) || patch.date > today()) throw new Error('Choose a real date on or before today.'); ev.date = patch.date; }
    if (patch.data !== undefined) ev.data = patch.data;
    ev.updatedAt = nowIso();
    save('update:' + ev.type);
    mirrorLegacy(ev);
    return ev;
  }
  /* Bulk write for imports (ovu-health.js): one save and one change event for the whole batch, so a
   * thousand nights do not mean a thousand localStorage rewrites. Each item is {type, date, data, source}
   * to add, or {id, data} to update in place. Single-per-day kinds never gain a second entry here; a
   * date that already has one is skipped, so a hand-written day is left alone. Nothing is mirrored to the
   * legacy keys except the cycle summary, which is recomputed once when a period day was written. */
  function addMany(items) {
    var db = load(), t = today(), added = 0, updated = 0, skipped = 0, touchedPeriod = false;
    var have = {}; db.events.forEach(function (e) { if (SINGLE_PER_DAY[e.type]) have[e.type + '|' + e.date] = true; });
    (items || []).forEach(function (it) {
      if (!it || typeof it !== 'object') { skipped++; return; }
      if (it.id) { var ev = get(it.id); if (!ev || !it.data || typeof it.data !== 'object') { skipped++; return; } ev.data = it.data; ev.updatedAt = nowIso(); updated++; if (ev.type === 'period') touchedPeriod = true; return; }
      if (TYPES.indexOf(it.type) < 0 || !validDate(it.date) || it.date > t || !it.data || typeof it.data !== 'object') { skipped++; return; }
      if (SINGLE_PER_DAY[it.type]) { if (have[it.type + '|' + it.date]) { skipped++; return; } have[it.type + '|' + it.date] = true; }
      db.events.push({ id: uid(), type: it.type, date: it.date, createdAt: nowIso(), updatedAt: nowIso(), source: it.source || 'import', data: it.data });
      added++; if (it.type === 'period') touchedPeriod = true;
    });
    if (added || updated) { save('import'); if (touchedPeriod) mirrorLegacy({ type: 'period' }); }
    return { added: added, updated: updated, skipped: skipped };
  }
  function removeWhere(pred) {
    var db = load(), before = db.events.length, gone = db.events.filter(function (e) { return !!pred(e); });
    if (!gone.length) return 0;
    db.events = db.events.filter(function (e) { return !pred(e); });
    save('remove:bulk');
    if (gone.some(function (e) { return e.type === 'period'; })) mirrorLegacy({ type: 'period' });
    return before - db.events.length;
  }
  function remove(id) {
    var db = load(), ev = get(id);
    if (!ev) return false;
    db.events = db.events.filter(function (e) { return e.id !== id; });
    save('remove:' + ev.type);
    mirrorLegacy(ev, true);
    return true;
  }

  /* ---------- cloud sync adapter (used only by ovu-sync.js) ----------
   * Insert or replace events by id, trusting the caller's own timestamps, so a
   * pull from the cloud restores rows with their original ids and edit times
   * instead of minting new ones (add()/update() would). Deletions in a pull go
   * through applyRemote too. Nothing here uploads; ovu-sync does the network. */
  function putEvent(ev) {
    if (!ev || typeof ev !== 'object' || TYPES.indexOf(ev.type) < 0 || !validDate(ev.date) || !ev.data || typeof ev.data !== 'object') return false;
    applyRemote([ev], null); return true;
  }
  /* Apply a batch of pulled cloud changes in one save: puts (insert or replace
   * by id), then deletes (by id). Emits 'sync' so the room can re-render. */
  function applyRemote(puts, dels) {
    var db = load(), changed = [];
    (puts || []).forEach(function (ev) {
      if (!ev || typeof ev !== 'object' || TYPES.indexOf(ev.type) < 0 || !validDate(ev.date) || !ev.data || typeof ev.data !== 'object') return;
      var id = String(ev.id || uid());
      var norm = { id: id, type: ev.type, date: ev.date, createdAt: ev.createdAt || nowIso(), updatedAt: ev.updatedAt || ev.createdAt || nowIso(), source: ev.source || 'cloud', data: ev.data };
      var found = false;
      for (var i = 0; i < db.events.length; i++) { if (db.events[i].id === id) { db.events[i] = norm; found = true; break; } }
      if (!found) db.events.push(norm);
      changed.push({ ev: norm });
    });
    (dels || []).forEach(function (id) {
      id = String(id);
      db.events = db.events.filter(function (e) { if (e.id === id) { changed.push({ removed: e }); return false; } return true; });
    });
    if (!changed.length) return 0;
    save('sync');
    changed.forEach(function (c) { if (c.removed) mirrorLegacy(c.removed, true); else mirrorLegacy(c.ev); });
    return changed.length;
  }

  /* ---------- profile / state ---------- */
  function profile() { return Object.assign({}, load().profile); }
  function setProfile(patch) { Object.assign(load().profile, patch); save('profile'); return profile(); }
  function state() { return load().state; }
  function setState(patch) { Object.assign(load().state, patch); save('state'); return state(); }

  /* ---------- derived: sleep ---------- */
  function sleepHours(d) {
    /* An imported night carries the minutes actually asleep (stages added up), which is the honest number;
     * a hand-written night only has bed and wake times, so the window between them is used. */
    if (typeof d.asleepMin === 'number' && isFinite(d.asleepMin) && d.asleepMin > 0) return Math.round(d.asleepMin / 6) / 10;
    if (!validTime(d.bedTime) || !validTime(d.wakeTime)) return typeof d.hours === 'number' ? d.hours : null;
    var b = d.bedTime.split(':'), w = d.wakeTime.split(':');
    var mins = (Number(w[0]) * 60 + Number(w[1])) - (Number(b[0]) * 60 + Number(b[1]));
    // Only a wake time earlier than bedtime crosses midnight; identical times mean no sleep, not a full day.
    if (mins < 0) mins += 24 * 60;
    return Math.round(mins / 6) / 10;
  }
  function sleepStats(days, end) {
    end = end || today(); days = days || 7;
    var from = addDays(end, -(days - 1));
    var nights = list('sleep', { from: from, to: end }).map(function (e) { return { date: e.date, hours: sleepHours(e.data), quality: e.data.quality || null, id: e.id }; }).filter(function (n) { return n.hours !== null; });
    var total = nights.reduce(function (s, n) { return s + n.hours; }, 0);
    return { from: from, to: end, nights: nights, count: nights.length, avg: nights.length ? Math.round(total / nights.length * 10) / 10 : null, under6: nights.filter(function (n) { return n.hours < 6; }).length };
  }

  /* ---------- derived: cycle ---------- */
  /* Spotting is an observation, never the start of a cycle: episodes are built from bleeding days only
   * (light, medium, heavy). A spotting day stays in the log and the agents read it separately. */
  function isBleeding(e) { return !!(e.data.flow && e.data.flow !== 'none' && e.data.flow !== 'spotting'); }
  function periodEpisodes() {
    var days = list('period').filter(isBleeding);
    var episodes = [];
    days.forEach(function (e) {
      var last = episodes[episodes.length - 1];
      if (last && diffDays(last.end, e.date) <= 2) { last.end = e.date; last.days.push(e); }
      else episodes.push({ start: e.date, end: e.date, days: [e] });
    });
    episodes.forEach(function (ep) { ep.length = diffDays(ep.start, ep.end) + 1; ep.heavyDays = ep.days.filter(function (d) { return d.data.flow === 'heavy'; }).length; });
    return episodes;
  }
  /* ---------- remembered period starts (the onboarding calendar) ----------
   * Remembered starts live in profile.periodRecall, apart from logged bleeding: they never create flow,
   * episodes, coverage, streaks or hearts. They can only give a first, wide window until real periods are
   * logged. These are product rules, not clinically validated thresholds:
   * - a gap of 38 days or less counts as consecutive (a missed start inside it would need a cycle under
   *   20 days); a longer gap counts only when the person says none are missing;
   * - an approximate month between two marks breaks the chain, and is never turned into a date;
   * - starts 14 days or less apart need an answer: separate periods, or one bleed that restarted;
   * - a window needs two consecutive gaps of 15 to 60 days whose spread is 20 days or less, and a
   *   confirmed most recent start no more than 60 days ago. */
  function rhythmFromRecall(rc, asOf) {
    asOf = asOf || today();
    var out = { exact: [], approx: [], gaps: [], adjacent: [], run: [], median: null, min: null, max: null, spread: null, ok: false, reason: 'none', latest: null, unresolved: [] };
    if (!rc || !Array.isArray(rc.starts)) return out;
    var dates = [], months = [];
    rc.starts.forEach(function (st) {
      if (st && st.precision === 'day' && validDate(st.date) && st.date <= asOf) dates.push(st.date);
      else if (st && st.precision === 'month' && /^\d{4}-\d{2}$/.test(st.month || '') && st.month <= asOf.slice(0, 7)) months.push(st.month);
    });
    dates = dates.filter(function (d, i) { return dates.indexOf(d) === i; }).sort();
    months = months.filter(function (m, i) { return months.indexOf(m) === i; }).sort();
    var cl = rc.clusters || {}, kept = [];
    dates.forEach(function (d) {
      var prev = kept[kept.length - 1];
      if (prev && diffDays(prev, d) <= 14) { var ans = cl[prev + '|' + d]; if (ans === 'one') return; if (ans !== 'separate') out.unresolved.push([prev, d]); }
      kept.push(d);
    });
    out.exact = kept; out.approx = months;
    var run = [];
    for (var i = 1; i < kept.length; i++) {
      var a = kept[i - 1], b = kept[i], g = diffDays(a, b);
      var broken = months.some(function (m) { return m >= a.slice(0, 7) && m <= b.slice(0, 7); });
      var adjacent = !broken && (g <= 38 || rc.complete === 'yes');
      out.gaps.push(g);
      if (adjacent) out.adjacent.push({ from: a, to: b, gap: g });
      if (adjacent && g >= 15 && g <= 60) run.push(g); else run = [];
    }
    run = run.slice(-6); out.run = run;
    if (run.length) { out.min = Math.min.apply(null, run); out.max = Math.max.apply(null, run); out.spread = out.max - out.min; var sr = run.slice().sort(function (x, y) { return x - y; }), mid = Math.floor(sr.length / 2); out.median = sr.length % 2 ? sr[mid] : Math.round((sr[mid - 1] + sr[mid]) / 2); }
    if (rc.latest === 'yes' && kept.length) out.latest = kept[kept.length - 1];
    if (out.unresolved.length) out.reason = 'cluster';
    else if (run.length < 2) out.reason = 'few';
    else if (out.spread > 20) out.reason = 'irregular';
    else if (!out.latest) out.reason = 'latest-unconfirmed';
    else if (diffDays(out.latest, asOf) > 60) out.reason = 'latest-old';
    else if (run.length && kept.indexOf(out.latest) !== kept.length - 1) out.reason = 'latest-unconfirmed';
    else { out.ok = true; out.reason = 'ok'; }
    return out;
  }
  function cycleStats(asOf) {
    asOf = asOf || today();
    var eps = periodEpisodes().filter(function (ep) { return ep.start <= asOf; });
    var starts = eps.map(function (ep) { return ep.start; });
    var lengths = [];
    for (var i = 1; i < starts.length; i++) lengths.push(diffDays(starts[i - 1], starts[i]));
    var recent = lengths.slice(-6);
    var p = profile();
    var rr = p.periodRecall ? rhythmFromRecall(p.periodRecall, asOf) : null;
    var useRecall = recent.length < 2 && !!(rr && rr.ok);
    var avg = recent.length >= 2 ? Math.round(recent.reduce(function (a, b) { return a + b; }, 0) / recent.length) : (useRecall ? rr.median : (recent.length ? recent[0] : (p.cycleLength || null)));
    var periodLen = eps.length ? Math.round(eps.slice(-3).reduce(function (a, ep) { return a + ep.length; }, 0) / Math.min(3, eps.length)) : (p.periodLength || null);
    var last = starts[starts.length - 1] || null, anchorRecalled = false;
    if (rr && rr.latest && (!last || rr.latest > last)) { last = rr.latest; anchorRecalled = true; }
    var day = last ? diffDays(last, asOf) + 1 : null;
    /* no silent 28-day assumption: predictions need a logged or stated length, and pause while pregnant, after a hysterectomy or past menopause */
    var mode = p.predictionMode || 'normal';
    if (useRecall && mode === 'normal') mode = 'wide'; /* remembered dates only ever give a wide window */
    var predictedNext = last && avg && mode !== 'suspended' ? addDays(last, avg) : null;
    /* An observed window, not a point: the shortest to longest of the last six logged cycles (at least
     * plus or minus a day), plus or minus two days around a single length or a stated profile length.
     * 'wide' adds three days each side; 'suspended' predicts nothing. */
    var lo = null, hi = null;
    if (recent.length >= 2) { lo = Math.min.apply(null, recent); hi = Math.max.apply(null, recent); if (hi - lo < 2) { lo -= 1; hi += 1; } }
    else if (useRecall) { lo = rr.min; hi = rr.max; if (hi - lo < 2) { lo -= 1; hi += 1; } }
    else if (recent.length === 1) { lo = recent[0] - 2; hi = recent[0] + 2; }
    else if (p.cycleLength && Number(p.cycleLength) > 0) { lo = Number(p.cycleLength) - 2; hi = Number(p.cycleLength) + 2; }
    if (lo !== null && mode === 'wide') { lo -= 3; hi += 3; }
    var predictedFrom = last && lo !== null && mode !== 'suspended' ? addDays(last, Math.max(15, lo)) : null;
    var predictedTo = last && hi !== null && mode !== 'suspended' ? addDays(last, hi) : null;
    /* No silent 28-day phase either: without a logged or stated length the phase stays unknown. */
    var phase = null;
    /* A remembered start gives a day count but no phase: the bleeding days themselves were not logged. */
    if (day && avg && mode !== 'suspended' && !anchorRecalled) {
      var L = avg, pl = periodLen || 5;
      if (day <= pl) phase = 'menstrual';
      else if (day < L - 16) phase = 'follicular';
      else if (day <= L - 12) phase = 'ovulatory';
      else phase = 'luteal';
      if (day > L + 7) phase = 'late';
    }
    return { mode: mode, uncertain: mode === 'wide', episodes: eps, starts: starts, lengths: lengths, averageLength: avg, periodLength: periodLen, lastStart: last, cycleDay: day, phase: phase, predictedNext: predictedNext, predictedFrom: predictedFrom, predictedTo: predictedTo, recalled: rr, fromRecall: useRecall || anchorRecalled, observedRange: lo !== null ? { lo: lo, hi: hi } : null, basis: recent.length ? recent.length + ' logged cycle' + (recent.length === 1 ? '' : 's') : (useRecall ? 'remembered period dates' : (p.cycleLength ? 'your profile setting' : 'no cycle length yet')), estimate: true };
  }

  /* ---------- legacy mirrors (so older screens keep showing the same data) ---------- */
  function mirrorLegacy(ev, removed) {
    try {
      if (ev.type === 'food') {
        var j = JSON.parse(localStorage.getItem('ovumind_food_journal') || '{}');
        var dayRec = j[ev.date] || (j[ev.date] = { breakfast: [], lunch: [], dinner: [], snack: [] });
        var meal = ['breakfast', 'lunch', 'dinner', 'snack'].indexOf(ev.data.meal) > -1 ? ev.data.meal : 'snack';
        ['breakfast', 'lunch', 'dinner', 'snack'].forEach(function (m) { dayRec[m] = (dayRec[m] || []).filter(function (it) { return it.ovuId !== ev.id; }); });
        if (!removed) dayRec[meal].push({ ovuId: ev.id, emoji: ({ breakfast: '🥣', lunch: '🥗', dinner: '🍲', snack: '🍓' })[meal], name: ev.data.foods || 'Meal', tags: (ev.data.tags || []).join(' · ') || 'Logged in your room' });
        localStorage.setItem('ovumind_food_journal', JSON.stringify(j));
      }
      if (ev.type === 'sleep') {
        var logs = [];
        try { logs = JSON.parse(localStorage.getItem('ovuluna_sleep_logs') || '[]'); if (!Array.isArray(logs)) logs = []; } catch (e) { logs = []; }
        logs = logs.filter(function (r) { return !(r && r.ovuId === ev.id); });
        if (!removed && validTime(ev.data.bedTime) && validTime(ev.data.wakeTime)) {
          var qmap = { 5: 0, 4: 1, 3: 1, 2: 2, 1: 3 };
          logs.push({ entryVersion: 1, source: 'self-reported', ovuId: ev.id, observedOn: ev.date, bedTime: ev.data.bedTime, wakeTime: ev.data.wakeTime, date: ev.updatedAt, latency: null, quality: qmap[ev.data.quality] === undefined ? null : qmap[ev.data.quality], disturbances: null, daytime: null });
        }
        localStorage.setItem('ovuluna_sleep_logs', JSON.stringify(logs));
      }
      if (ev.type === 'period') {
        var cs = cycleStats();
        if (cs.lastStart) localStorage.setItem('ovumind_cycle', JSON.stringify({ lastPeriod: cs.lastStart, currentPhase: cs.phase, cycleLength: cs.averageLength, periodLength: cs.periodLength, estimate: true, source: 'ovumind_db_v1' }));
      }
    } catch (e) { /* legacy mirrors are best effort */ }
  }

  /* ---------- export / import ---------- */
  function exportJSON() { return JSON.stringify(load(), null, 1); }
  function importJSON(text, mode) {
    var incoming = normalise(JSON.parse(text));
    var db = load();
    if (mode === 'replace') { cache = incoming; }
    else {
      var ids = {}; db.events.forEach(function (e) { ids[e.id] = true; });
      incoming.events.forEach(function (e) { if (!ids[e.id]) db.events.push(e); });
      db.profile = Object.assign(db.profile, incoming.profile);
    }
    save('import');
    return load().events.length;
  }
  function clearAll() { cache = empty(); save('clear'); ['ovumind_cycle'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { } }); }

  /* ---------- crypto share ---------- */
  function b64(buf) { var s = ''; new Uint8Array(buf).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s); }
  function unb64(str) { var bin = atob(str), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return arr.buffer; }
  function deriveKey(pass, salt, iter) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function encrypt(obj, pass) {
    if (!pass || pass.length < 8) return Promise.reject(new Error('Use a passphrase of at least 8 characters.'));
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), iter = 310000;
    return deriveKey(pass, salt, iter).then(function (key) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
    }).then(function (ct) {
      return { format: 'ovumind-share', v: 1, kdf: 'PBKDF2-SHA256', iter: iter, salt: b64(salt), iv: b64(iv), ct: b64(ct), created: nowIso() };
    });
  }
  function decrypt(bundle, pass) {
    if (!bundle || bundle.format !== 'ovumind-share' || !bundle.ct) return Promise.reject(new Error('This is not an Rhythme share file.'));
    return deriveKey(pass, new Uint8Array(unb64(bundle.salt)), bundle.iter || 310000).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(unb64(bundle.iv)) }, key, unb64(bundle.ct));
    }).then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); }, function () { throw new Error('Could not decrypt. Check the passphrase.'); });
  }
  function generatePassphrase() {
    var words = ['moon', 'lilac', 'cloud', 'star', 'rose', 'dawn', 'fern', 'pearl', 'honey', 'river', 'petal', 'willow', 'amber', 'dove', 'maple', 'coral', 'sage', 'violet', 'cocoa', 'snow'];
    var arr = crypto.getRandomValues(new Uint32Array(4));
    return Array.prototype.map.call(arr, function (n) { return words[n % words.length]; }).join('-') + '-' + (crypto.getRandomValues(new Uint32Array(1))[0] % 90 + 10);
  }
  function toCode(bundle) { return btoa(JSON.stringify(bundle)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function fromCode(code) { var s = code.trim().replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return JSON.parse(atob(s)); }

  /* Run fn against a throwaway in-memory database (used by the Doctor view to
     render a decrypted share or fictional sample data). Nothing is saved. */
  function sandbox(dbLike, fn) {
    var real = cache; cache = normalise(dbLike);
    try { return fn(); } finally { cache = real; }
  }

  root.OvuStore = {
    KEY: KEY, TYPES: TYPES, today: today, validDate: validDate, validTime: validTime, addDays: addDays, diffDays: diffDays,
    load: load, list: list, get: get, byDate: byDate, add: add, update: update, remove: remove, sandbox: sandbox,
    putEvent: putEvent, applyRemote: applyRemote,
    addMany: addMany, removeWhere: removeWhere,
    profile: profile, setProfile: setProfile, state: state, setState: setState,
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    sleepHours: sleepHours, sleepStats: sleepStats, periodEpisodes: periodEpisodes, cycleStats: cycleStats, rhythmFromRecall: rhythmFromRecall,
    exportJSON: exportJSON, importJSON: importJSON, clearAll: clearAll,
    crypto: { encrypt: encrypt, decrypt: decrypt, generatePassphrase: generatePassphrase, toCode: toCode, fromCode: fromCode }
  };
})(window);

/* Rhythme asks for the data notice in the room first: a first-time visitor, or anyone whose consent is older than notice v2 or unreadable, is sent there. Keep the 2 in step with CONSENT_V in room.js. */
(function () { try { var pg = location.pathname.split('/').pop() || 'index.html'; if (/^(room|privacy|terms|index|404)\.html$/.test(pg)) return; var db = JSON.parse(localStorage.getItem('ovumind_db_v1') || 'null'), c = db && db.profile && db.profile.consent; if (!(c && c.at && c.v >= 2)) location.replace('room.html'); } catch (e) { try { location.replace('room.html'); } catch (e2) { } } })();
