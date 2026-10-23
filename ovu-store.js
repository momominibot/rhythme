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
  var TYPES = ['sleep', 'period', 'symptom', 'food', 'reflection', 'mindfulness', 'weight', 'exercise', 'sleepcheck', 'steps', 'restinghr', 'temperature']; /* exercise: ovu-exercise.js, many a day; sleepcheck: the two-week sleep check, one a day; steps, restinghr, temperature: synced from a health app only (ovu-health.js), one a day */
  var SINGLE_PER_DAY = { period: true, symptom: true, weight: true, sleepcheck: true, steps: true, restinghr: true, temperature: true };
  var IMPORTED = { 'apple-health': true, 'google-fit': true };
  var listeners = [];
  var cache = null;
  var seenRaw = null, baseText = null; /* the stored text this tab last read or wrote, and its own copy at that moment: the base of mergeStored() */
  var REV = 'ovumind_db_rev', seenRev = null;
  /* a fresh token whenever the diary is replaced as a whole (Delete everything, a restore that replaces it): another tab tells a
     new diary from an ordinary save by it, even when a restored backup keeps the old createdAt. Not diary data */
  var EPOCH = 'ovumind_db_epoch_v1';
  function newEpoch() { try { localStorage.setItem(EPOCH, Date.now().toString(36) + Math.random().toString(36).slice(2, 8)); } catch (e) { } } /* a short token every save changes, so a read can tell cheaply that another tab wrote */
  function readRev() { try { return localStorage.getItem(REV); } catch (e) { return null; } }

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
    /* every read catches up when another tab saved since, so a caller that reads, builds a patch and commits it builds
       on the current copy (review, 21 Oct: a stale tab's farm patch undid seeds whose hearts the other tab had taken) */
    if (cache && !force) { if (sandboxDepth === 0 && readRev() !== seenRev) catchUp(); return cache; }
    var raw = null; seenRev = readRev();
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    try { cache = normalise(raw ? JSON.parse(raw) : null); } catch (e) { cache = empty(); cache.state.corruptBackup = raw; }
    seenRaw = raw; baseText = JSON.stringify(cache);
    return cache;
  }
  function emit(reason, removed) { listeners.slice().forEach(function (fn) { try { fn(reason || 'change', cache, removed); } catch (e) { /* listener errors never block saving */ } }); }
  /* ---------- several tabs on one phone ----------
   * Each tab keeps its own copy in memory, and a tab that missed another tab's storage event (asleep in the background,
   * or the event still on its way) used to write that stale copy over the other tab's saves, consent included. Now a
   * save first merges in whatever another tab stored since this tab last read or wrote, three ways against that base
   * (docs/design/2026-10-21-multitab-store.md):
   * - entries and consent events, by id: one added in either tab is kept; one deleted in either tab stays deleted (a
   *   delete is never undone); one changed in one tab takes that change; one changed in both takes the newer updatedAt,
   *   and this tab's on a tie or when there is none. Their order is the stored one, then this tab's new ones.
   * - profile and state, key by key: a key changed in one tab takes that change; a key changed in both takes this tab's,
   *   the write being made now. A key moves whole (state.farm, state.rewards), so one game's state never mixes two tabs.
   * - summaries move whole, the same way.
   * The merge is built apart and adopted into memory, in place, only once the write verified, so a failed save leaves
   * memory as it was (commit's contract) and callers holding an entry or the state object keep a live one. */
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function byId(arr) { var m = {}; (arr || []).forEach(function (x) { if (x && x.id !== undefined) m[x.id] = x; }); return m; }
  function newer(a, b) { var ta = Date.parse(a && a.updatedAt), tb = Date.parse(b && b.updatedAt); return isFinite(ta) && isFinite(tb) && ta > tb; }
  function mergeById(mine, base, theirs) {
    var M = byId(mine), B = byId(base), T = byId(theirs), out = [], seen = {};
    function pick(id) {
      var m = M[id], b = B[id], t = T[id];
      if (b) { if (!m || !t) return null; if (same(m, b)) return t; if (same(t, b)) return m; return newer(t, m) ? t : m; }
      if (m && t) return newer(t, m) ? t : m;
      return m || t;
    }
    (theirs || []).concat(mine || []).forEach(function (x) { if (!x || x.id === undefined || seen[x.id]) return; seen[x.id] = true; var k = pick(x.id); if (k) out.push(k); });
    return out;
  }
  /* a module may merge its own state key by id (water records, 21 Oct): fn(mine, base, theirs) returns the merged value */
  var MERGERS = {};
  function registerMerge(key, fn) { if (typeof fn === 'function') MERGERS[key] = fn; }
  function mergeKeys(mine, base, theirs, byIdKeys) {
    var out = {}, keys = {};
    [mine, base, theirs].forEach(function (o) { Object.keys(o || {}).forEach(function (k) { keys[k] = true; }); });
    Object.keys(keys).forEach(function (k) {
      var v = MERGERS[k] && (mine[k] !== undefined || theirs[k] !== undefined) && !same(mine[k], theirs[k]) ? MERGERS[k](mine[k], base[k], theirs[k]) : byIdKeys && byIdKeys[k] && (Array.isArray(mine[k]) || Array.isArray(theirs[k])) ? mergeById(mine[k], base[k], theirs[k]) : (!same(mine[k], base[k]) ? mine[k] : theirs[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  /* null when the stored copy is the one this tab last saw (or cannot be read: then this tab's copy is written, as before) */
  function mergeStored(db) {
    var raw; try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
    if (raw === seenRaw || sandboxDepth > 0) return null;
    var theirs, base; try { theirs = normalise(raw ? JSON.parse(raw) : null); base = normalise(baseText ? JSON.parse(baseText) : null); } catch (e) { return null; }
    return { raw: raw, theirs: theirs, db: { version: db.version, createdAt: db.createdAt, updatedAt: db.updatedAt,
      profile: mergeKeys(db.profile, base.profile, theirs.profile, { consentEvents: true }),
      events: mergeById(db.events, base.events, theirs.events),
      summaries: !same(db.summaries, base.summaries) ? db.summaries : theirs.summaries,
      state: mergeKeys(db.state, base.state, theirs.state) } };
  }
  function adopt(next) {
    var db = cache;
    ['profile', 'state'].forEach(function (k) { var o = db[k]; Object.keys(o).forEach(function (x) { if (!(x in next[k])) delete o[x]; }); Object.assign(o, next[k]); });
    db.events = next.events; db.summaries = next.summaries; db.updatedAt = next.updatedAt;
  }
  /* bring another tab's saves into memory before a write that looks at what is there (one entry a day, an entry that
     may have been deleted), keeping anything this tab has not saved yet */
  function catchUp() {
    if (!cache) { load(); return; }
    seenRev = readRev();
    var m = mergeStored(cache); if (!m) return;
    adopt(m.db); seenRaw = m.raw; baseText = JSON.stringify(m.theirs);
  }
  /* whole: write this tab's copy as it is (Delete everything, a restored file that replaces the diary) */
  /* removed: the ids this call deleted, passed to listeners so the backup records only this tab's own deletes as
     tombstones, never entries another tab's Delete everything wiped (review, 21 Oct) */
  function save(reason, whole, removed) {
    var db = whole ? cache : load(), m = whole ? null : mergeStored(db), /* a whole write is never caught up first */ next = m ? m.db : db, at = nowIso();
    var text = JSON.stringify(Object.assign({}, next, { updatedAt: at }));
    localStorage.setItem(KEY, text);
    if (localStorage.getItem(KEY) !== text) throw new Error('Saving did not verify. Your browser storage may be full or blocked.');
    next.updatedAt = at; if (m) adopt(next);
    seenRaw = baseText = text;
    seenRev = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try { localStorage.setItem(REV, seenRev); } catch (e) { /* the diary is saved; another tab still merges it at its next write */ }
    emit(reason, removed);
  }
  try { window.addEventListener('storage', function (ev) { if (ev.key === KEY || ev.key === null) { catchUp(); emit('external'); } }); } catch (e) { /* non-browser */ }

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
  /* ---------- optional sleep details and the two-week sleep check ----------
   * Rhythme's own questions (not a licensed scale, and never scored), built on the items of the Consensus Sleep Diary
   * (Carney 2012, E73) and the insomnia, sleep apnoea and restless legs guidance in ovu-evidence.js. Every answer is a
   * fixed code and anything else is dropped, so a question left blank stays unknown: it is never read as zero, and
   * "not sure" is kept as an answer of its own. Labels and patterns live in ovu-agents.js. */
  var SLEEP_DETAIL = { latency: ['le15', '16-30', '31-60', 'gt60', 'unsure'], wakeups: ['0', '1', '2', '3', '4+', 'unsure'], awake: ['le15', '16-30', '31-60', '61-120', 'gt120', 'unsure'], early: ['yes', 'no', 'unsure'], rested: ['1', '2', '3', '4', '5', 'unsure'] };
  var SLEEP_WOKE = ['flush', 'cramps', 'toilet', 'child', 'snoring', 'noise', 'worry', 'pain', 'gasp', 'other'];
  var NIGHTS = ['0', '1', '2', '3', '4', '5', '6', '7', 'unsure'];
  var SLEEP_CHECK = { w1: NIGHTS, w2: NIGHTS, chance: ['usually', 'sometimes', 'rarely', 'unsure'], impact: ['none', 'little', 'lot', 'unsure'], since: ['lt2w', '2w-3m', '3m+', 'unsure'], breathing: ['yes', 'no', 'unsure'], legs: ['yes', 'no', 'unsure'], driving: ['yes', 'no', 'nodrive'] };
  function pickCodes(spec, o) {
    var out = {}; if (!o || typeof o !== 'object') return out;
    Object.keys(spec).forEach(function (k) { var v = o[k]; if (typeof v === 'number' && isFinite(v)) v = String(v); if (typeof v === 'string' && spec[k].indexOf(v) > -1) out[k] = v; });
    return out;
  }
  function cleanSleepDetails(o) {
    var out = pickCodes(SLEEP_DETAIL, o);
    if (o && Array.isArray(o.woke)) { var w = SLEEP_WOKE.filter(function (c) { return o.woke.indexOf(c) > -1; }); if (w.length) out.woke = w; }
    if (out.wakeups === '0') delete out.awake; /* no waking means no time awake to ask about */
    return Object.keys(out).length ? out : null;
  }
  function cleanSleepCheck(o) {
    var out = pickCodes(SLEEP_CHECK, o);
    if (out.w1 === '0' && out.w2 === '0') delete out.since; /* "how long has it been like this" only follows a night of trouble */
    return out;
  }
  /* the write boundary: a sleep entry keeps only known detail codes; a check must answer at least one question */
  function cleanData(type, data) {
    if (type === 'sleep' && data && typeof data === 'object' && data.details !== undefined) { var c = Object.assign({}, data), dt = cleanSleepDetails(data.details); if (dt) c.details = dt; else delete c.details; return c; }
    if (type === 'sleepcheck') { var sc = cleanSleepCheck(data); if (!Object.keys(sc).length) throw new Error('Answer at least one question.'); return sc; }
    return data;
  }
  function add(type, date, data, source, opts) {
    if (TYPES.indexOf(type) < 0) throw new Error('Unknown entry type: ' + type);
    data = cleanData(type, data);
    if (!validDate(date)) throw new Error('Choose a real date.');
    if (date > today()) throw new Error('Entries cannot be in the future.');
    catchUp(); /* another tab may already have this day's entry */
    var db = load();
    var existing = SINGLE_PER_DAY[type] ? db.events.filter(function (e) { return e.type === type && e.date === date; })[0] : null;
    if (existing) { return update(existing.id, { data: opts && opts.merge ? mergeData(type, existing.data, data) : data, source: IMPORTED[existing.source] ? (source || 'room') : undefined }); }
    var ev = { id: uid(), type: type, date: date, createdAt: nowIso(), updatedAt: nowIso(), source: source || 'room', data: data };
    db.events.push(ev);
    /* A confirmed practice and its exploration count share one rollback-capable write. */
    try { if (opts && opts.statePatch) commit(opts.statePatch); else save('add:' + type); } catch (e) { var at = db.events.indexOf(ev); if (at > -1) db.events.splice(at, 1); throw e; } /* a failed write leaves memory as it was, so a retry is clean */
    mirrorLegacy(ev);
    return ev;
  }
  function update(id, patch) {
    catchUp(); /* an entry another tab deleted is gone here too, never written back */
    var db = load(), ev = get(id);
    if (!ev) throw new Error('That entry no longer exists.');
    /* a failed write puts the entry back exactly as it was, as add() does: an edit that did not save must never show
       as saved (Codex diff review, 20 Oct: a mood edit that failed to save still completed the day's check-in) */
    var before = { date: ev.date, data: ev.data, source: ev.source, updatedAt: ev.updatedAt };
    var newData = patch.data !== undefined ? cleanData(ev.type, patch.data) : undefined; /* checked before anything changes */
    if (patch.date !== undefined) { if (!validDate(patch.date) || patch.date > today()) throw new Error('Choose a real date on or before today.'); ev.date = patch.date; }
    if (patch.data !== undefined) ev.data = newData;
    /* An imported entry (Apple Health, Google) that the person changes by hand becomes hers: a later import
     * leaves it alone and "Remove imported data" keeps it. Imports refresh their own rows through addMany. */
    if (patch.source) ev.source = patch.source; else if ((patch.data !== undefined || patch.date !== undefined) && IMPORTED[ev.source]) ev.source = 'room';
    ev.updatedAt = nowIso();
    try { save('update:' + ev.type); } catch (e) { ev.date = before.date; ev.data = before.data; ev.source = before.source; ev.updatedAt = before.updatedAt; throw e; }
    mirrorLegacy(ev);
    return ev;
  }
  /* Bulk write for imports (ovu-health.js): one save and one change event for the whole batch, so a
   * thousand nights do not mean a thousand localStorage rewrites. Each item is {type, date, data, source}
   * to add, or {id, data} to update in place. Single-per-day kinds never gain a second entry here; a
   * date that already has one is skipped, so a hand-written day is left alone. Nothing is mirrored to the
   * legacy keys except the cycle summary, which is recomputed once when a period day was written. */
  function addMany(items) {
    catchUp();
    var db = load(), t = today(), added = 0, updated = 0, skipped = 0, touchedPeriod = false;
    var have = {}; db.events.forEach(function (e) { if (SINGLE_PER_DAY[e.type]) have[e.type + '|' + e.date] = true; });
    (items || []).forEach(function (it) {
      if (!it || typeof it !== 'object') { skipped++; return; }
      if (it.id) { var ev = get(it.id); if (!ev || !it.data || typeof it.data !== 'object') { skipped++; return; } try { ev.data = cleanData(ev.type, it.data); } catch (err) { skipped++; return; } ev.updatedAt = nowIso(); updated++; if (ev.type === 'period') touchedPeriod = true; return; }
      if (TYPES.indexOf(it.type) < 0 || !validDate(it.date) || it.date > t || !it.data || typeof it.data !== 'object') { skipped++; return; }
      var itData; try { itData = cleanData(it.type, it.data); } catch (err) { skipped++; return; } /* the same write boundary as add(): an empty check or stray codes never land (Codex, 21 Oct) */
      if (SINGLE_PER_DAY[it.type]) { if (have[it.type + '|' + it.date]) { skipped++; return; } have[it.type + '|' + it.date] = true; }
      db.events.push({ id: uid(), type: it.type, date: it.date, createdAt: nowIso(), updatedAt: nowIso(), source: it.source || 'import', data: itData });
      added++; if (it.type === 'period') touchedPeriod = true;
    });
    if (added || updated) { save('import'); if (touchedPeriod) mirrorLegacy({ type: 'period' }); }
    return { added: added, updated: updated, skipped: skipped };
  }
  function removeWhere(pred) {
    catchUp();
    var db = load(), before = db.events.length, gone = db.events.filter(function (e) { return !!pred(e); });
    if (!gone.length) return 0;
    db.events = db.events.filter(function (e) { return !pred(e); });
    save('remove:bulk', false, gone.map(function (e) { return e.id; }));
    gone.forEach(function (e) { if (e.type === 'food' || e.type === 'sleep') mirrorLegacy(e, true); }); /* the meal and sleep copies go with them */
    if (gone.some(function (e) { return e.type === 'period'; })) mirrorLegacy({ type: 'period' });
    return gone.length;
  }
  function remove(id) {
    catchUp();
    var db = load(), ev = get(id);
    if (!ev) return false;
    db.events = db.events.filter(function (e) { return e.id !== id; });
    save('remove:' + ev.type, false, [id]);
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
    catchUp();
    var db = load(), changed = [];
    (puts || []).forEach(function (ev) {
      if (!ev || typeof ev !== 'object' || TYPES.indexOf(ev.type) < 0 || !validDate(ev.date) || !ev.data || typeof ev.data !== 'object') return;
      var id = String(ev.id || uid()), evData; try { evData = cleanData(ev.type, ev.data); } catch (err) { return; } /* a cloud row that cleans to nothing is not applied */
      var norm = { id: id, type: ev.type, date: ev.date, createdAt: ev.createdAt || nowIso(), updatedAt: ev.updatedAt || ev.createdAt || nowIso(), source: ev.source || 'cloud', data: evData };
      var found = false;
      var stale = false; /* a put planned before another tab's newer edit arrived never replaces it (last write wins, as in the plan) */
      for (var i = 0; i < db.events.length; i++) { if (db.events[i].id === id) { if (newer(db.events[i], norm)) stale = true; else db.events[i] = norm; found = true; break; } }
      if (stale) return;
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
  /* a failed save puts the profile back as it was, as commit() does for state: a consent choice that did not save must not
     sit in memory and land later, after a newer choice made in another tab (review, 21 Oct) */
  function setProfile(patch) {
    var p = load().profile, had = {}, prev = {};
    Object.keys(patch).forEach(function (k) { had[k] = Object.prototype.hasOwnProperty.call(p, k); prev[k] = p[k]; });
    Object.assign(p, patch);
    try { save('profile'); } catch (e) { Object.keys(prev).forEach(function (k) { if (had[k]) p[k] = prev[k]; else delete p[k]; }); throw e; }
    return profile();
  }
  function state() { return load().state; }
  function setState(patch) { Object.assign(load().state, patch); save('state'); return state(); }
  /* a write that lands whole or leaves memory exactly as it was: a purchase must never take hearts without the item, or give
   * the item without the hearts, when storage is full (Codex review, 20 Oct). Patch values must be new objects, not edited
   * live ones, so the old ones are still there to put back. */
  function commit(patch) {
    var st = load().state, had = {}, prev = {};
    Object.keys(patch).forEach(function (k) { had[k] = Object.prototype.hasOwnProperty.call(st, k); prev[k] = st[k]; });
    Object.assign(st, patch);
    try { save('state'); } catch (e) { Object.keys(prev).forEach(function (k) { if (had[k]) st[k] = prev[k]; else delete st[k]; }); throw e; }
    return state();
  }

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
  /* One night per date. Sleep is not single-per-day, so a broken night, a nap or the same night logged twice can give
   * several entries on one date; they are joined before any rule counts nights (five same-date entries once fired
   * five-night warnings). Timed entries become spans ending at their wake time and overlapping spans are merged, so a
   * repeat counts once and separate blocks add up; an entry without clock times counts by its own length (the
   * longest one). A night is `assumed` when any of its entries had back-computed times (Luna's "slept 7h"), so timing
   * rules can leave it out while its duration still counts. `entries` keeps one row per entry for lists that delete. */
  function oneNight(date, blocks) {
    var spans = [], untimed = 0, longest = blocks[0], total = 0, cur = null;
    blocks.forEach(function (b) {
      if (b.hours > longest.hours) longest = b;
      var mins = Math.round(b.hours * 60);
      if (validTime(b.wakeTime) && mins > 0) { var w = b.wakeTime.split(':'), wm = Number(w[0]) * 60 + Number(w[1]); spans.push([wm - mins, wm]); }
      else untimed = Math.max(untimed, mins);
    });
    spans.sort(function (a, b) { return a[0] - b[0]; }).forEach(function (sp) { if (cur && sp[0] <= cur[1]) cur[1] = Math.max(cur[1], sp[1]); else { if (cur) total += cur[1] - cur[0]; cur = sp.slice(); } });
    if (cur) total += cur[1] - cur[0];
    total = Math.min(24 * 60, Math.max(total, untimed));
    var rated = blocks.filter(function (b) { return b.quality; })[0];
    return { date: date, hours: Math.round(total / 6) / 10, quality: longest.quality || (rated ? rated.quality : null), id: longest.id, ids: blocks.map(function (b) { return b.id; }), blocks: blocks.length, longest: longest.hours, assumed: blocks.some(function (b) { return b.assumed; }) };
  }
  function sleepStats(days, end) {
    end = end || today(); days = days || 7;
    var from = addDays(end, -(days - 1));
    var entries = list('sleep', { from: from, to: end }).map(function (e) { return { date: e.date, hours: sleepHours(e.data), quality: e.data.quality || null, id: e.id, assumed: e.data.assumed === true, wakeTime: e.data.wakeTime, measured: typeof e.data.asleepMin === 'number' && e.data.asleepMin > 0 }; }).filter(function (n) { return n.hours !== null; });
    var byDay = {};
    entries.forEach(function (n) { (byDay[n.date] = byDay[n.date] || []).push(n); });
    var nights = Object.keys(byDay).sort().map(function (d) { return oneNight(d, byDay[d]); });
    var total = nights.reduce(function (s, n) { return s + n.hours; }, 0);
    return { from: from, to: end, nights: nights, entries: entries.map(function (n) { return { date: n.date, hours: n.hours, quality: n.quality, id: n.id, assumed: n.assumed }; }), count: nights.length, windowed: entries.some(function (n) { return !n.measured; }), measured: entries.some(function (n) { return n.measured; }), avg: nights.length ? Math.round(total / nights.length * 10) / 10 : null, under6: nights.filter(function (n) { return n.hours < 6; }).length };
  }

  /* ---------- today's check-in answers ----------
   * Answers that are not measurements: "no bleeding today", "not sure", "nothing to log". They only mark a check-in as
   * answered on this device: never an entry, a flow, coverage, a cycle or hearts, and anything logged later wins.
   * The write lands whole or not at all (commit), so a full storage never shows a tick (Codex design review, 20 Oct). */
  var CHECKIN = { bleeding: ['none', 'unsure'], sleep: ['unsure'], mood: ['unsure'], food: ['skip'], water: ['skip'] }; /* water replaced food in Today's check-in (21 Oct); old food answers stay readable */
  function checkinAnswers(date) { var c = load().state.checkin || {}; return Object.assign({}, c[date] || {}); }
  function setCheckinAnswer(date, domain, status) {
    if (!validDate(date) || !CHECKIN[domain] || (status !== null && CHECKIN[domain].indexOf(status) < 0)) throw new Error('That is not a check-in answer.');
    catchUp(); /* the answers are copied whole below, so another tab's answers must be in them */
    var all = JSON.parse(JSON.stringify(load().state.checkin || {})), day = all[date] || {};
    if (status === null) delete day[domain]; else day[domain] = status;
    if (Object.keys(day).length) all[date] = day; else delete all[date];
    var keys = Object.keys(all).sort(); if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(function (k) { delete all[k]; });
    commit({ checkin: all });
    return checkinAnswers(date);
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
  /* A gap of more than 60 days between two logged starts is a break in the record, not a cycle (the same upper
   * bound as the remembered-period window above). Product rule, not a clinical threshold; see
   * docs/design/2026-10-20-cycle-gaps.md. Only the cycles since the last break set the estimate, the way a broken
   * chain restarts the remembered run; gaps of 39 to 60 days stay cycles and the agent flags them as long. */
  var CYCLE_GAP_MAX = 60;
  function cycleStats(asOf) {
    asOf = asOf || today();
    var eps = periodEpisodes().filter(function (ep) { return ep.start <= asOf; });
    var starts = eps.map(function (ep) { return ep.start; });
    var cycles = [], lengths = [];
    for (var i = 1; i < starts.length; i++) {
      var gap = { from: starts[i - 1], to: starts[i], days: diffDays(starts[i - 1], starts[i]) };
      gap.counted = gap.days <= CYCLE_GAP_MAX;
      cycles.push(gap);
      if (gap.counted) lengths.push(gap.days); else lengths = [];
    }
    var breaks = cycles.filter(function (c) { return !c.counted; });
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
    /* after a birth with periods not back, nothing is predicted until a period is logged after set-up (four-persona review, 20 Oct:
     * Nadia at four months, breastfeeding, had imported cycles from before pregnancy reviving predictions) */
    /* paused for as long as she says so; she says periods are back from the calendar or her intro (Codex branch review, 20 Oct:
     * a set-up timestamp is rewritten by every intro edit, so it cannot decide this) */
    if (p.pregState === 'postpartum' && p.periodsBack === 'no') mode = 'suspended';
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
    /* the latest break, when it changed this estimate (older cycles would otherwise have been in the last six) */
    var gapLeftOut = null;
    if (breaks.length && lengths.length < 6) {
      var lb = breaks[breaks.length - 1];
      gapLeftOut = { from: lb.from, to: lb.to, days: lb.days, cyclesBefore: cycles.filter(function (c) { return c.counted && c.to <= lb.from; }).length };
    }
    return { mode: mode, uncertain: mode === 'wide', episodes: eps, starts: starts, cycles: cycles, breaks: breaks, gapLeftOut: gapLeftOut, lengths: lengths, averageLength: avg, periodLength: periodLen, lastStart: last, cycleDay: day, phase: phase, predictedNext: predictedNext, predictedFrom: predictedFrom, predictedTo: predictedTo, recalled: rr, fromRecall: useRecall || anchorRecalled, observedRange: lo !== null ? { lo: lo, hi: hi } : null, basis: recent.length >= 2 ? recent.length + ' logged cycles' : (useRecall ? 'remembered period dates' : (recent.length ? '1 logged cycle' : (p.cycleLength ? 'your profile setting' : 'no cycle length yet'))), estimate: true };
  }

  /* ---------- legacy mirrors (so older screens keep showing the same data) ---------- */
  function mirrorLegacy(ev, removed) {
    try {
      if (ev.type === 'food') {
        var j = JSON.parse(localStorage.getItem('ovumind_food_journal') || '{}');
        Object.keys(j).forEach(function (d) { var r = j[d]; if (!r || typeof r !== 'object') return; ['breakfast', 'lunch', 'dinner', 'snack'].forEach(function (m) { if (Array.isArray(r[m])) r[m] = r[m].filter(function (it) { return !it || it.ovuId !== ev.id; }); }); }); /* every date: a meal moved to another day leaves no copy behind */
        var dayRec = j[ev.date] || (j[ev.date] = { breakfast: [], lunch: [], dinner: [], snack: [] });
        var meal = ['breakfast', 'lunch', 'dinner', 'snack'].indexOf(ev.data.meal) > -1 ? ev.data.meal : 'snack';
        if (!removed) dayRec[meal].push({ ovuId: ev.id, emoji: '', name: ev.data.foods || 'Meal', tags: (ev.data.tags || []).join(' · ') || 'Logged in your room' });
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
        else localStorage.removeItem('ovumind_cycle'); /* the last period deleted: no copy of it stays behind */
      }
    } catch (e) { /* legacy mirrors are best effort */ }
  }

  /* ---------- export / import ---------- */
  function exportJSON() { return JSON.stringify(load(), null, 1); }
  function importJSON(text, mode) {
    var incoming = normalise(JSON.parse(text));
    incoming.events = (incoming.events || []).map(function (e) { try { return Object.assign({}, e, { data: cleanData(e.type, e.data) }); } catch (err) { return null; } }).filter(Boolean); /* a restored file passes the same write boundary */
    if (mode !== 'replace') catchUp();
    var db = load(), keep = {}; ['owner', 'cloud', 'consent', 'consentEvents', 'ageAttest'].forEach(function (k) { if (db.profile && db.profile[k] !== undefined) keep[k] = db.profile[k]; }); /* this phone's account and consent stay as they are (Codex sweep, 21 Oct) */
    if (mode === 'replace') { cache = incoming; }
    else {
      var ids = {}; db.events.forEach(function (e) { ids[e.id] = true; });
      incoming.events.forEach(function (e) { if (!ids[e.id]) db.events.push(e); });
      db.profile = Object.assign(db.profile, incoming.profile);
    }
    var pf = load().profile; ['owner', 'cloud', 'consent', 'consentEvents', 'ageAttest'].forEach(function (k) { if (k in keep) pf[k] = keep[k]; else delete pf[k]; }); /* a backup never brings an account, not even an old one onto a fresh phone */
    if (mode === 'replace') newEpoch(); /* before the save, so another tab's storage event already reads the new diary */
    save('import', mode === 'replace');
    return load().events.length;
  }
  /* Delete everything on this phone: the diary and every older copy of it, by an explicit list of Rhythme's own keys
   * (the momominibot.github.io origin is shared with other projects, so nothing is matched by prefix). The meal, sleep
   * and cycle copies, the earlier Ovuluna pages' logs, scores and choices, and Erin's podcast listening all go (launch
   * sweep, 20 Oct 2026: they used to stay). Kept, and named on the Delete screen: the sign-in, the backup bookkeeping
   * and Rhythme Plus access, which are not diary data; the privacy page can remove them one by one. */
  var OWN_KEYS = ['ovumind_gamesave_v1', 'ovumind_food_journal', 'ovumind_cycle', 'ovumind_ai_v1', 'ovumind_reminders_v1', 'ovumind_nova_words', 'ovumind_room', 'ovumind_room_skipped', 'ovumind_device_v1', 'ovumind_desk_v1',
    'rhythme_podcast_v1', 'rhythme_voice_muted',
    'ovuluna_observations_v1', 'ovuluna_lab_records_v1', 'ovuluna_wellness_journal_v1', 'ovuluna_daily_checkins_v1', 'ovuluna_daily_context_v1', 'ovuluna_daily_routine_v1', 'ovuluna_daily_completions_v1',
    'ovuluna_ovarian_assessments_v2', 'ovuluna_phenoage_records_v1', 'ovuluna_profile', 'ovuluna_label_scans', 'ovuluna_medas14', 'ovuluna_pss10', 'ovuluna_sleep_logs', 'ovuluna_cycle', 'ovuluna_cycles',
    'ovuluna_footsoak_reminder', 'ovuluna_luna', 'ovuluna_luna_seen', 'ovuluna_ovarian_age', 'ovuluna_labs', 'ovuluna_wellness_data', 'ovuluna_cycle_data', 'ovuluna_onboarding', 'ovuluna_language', 'ovuluna_units',
    'ovuluna_auth', 'ovuluna_preferences_v1', 'ovuluna_persona', 'ovuluna_theme', 'ovuluna_fontsize', 'ovuluna_font_size', 'ovuluna_hormone_view',
    'ov_hydro', 'ov_acupoint_routine', 'ov_result', 'ov_mascot_hide'];
  var KEEP_ON_CLEAR = ['ovumind_auth_v1', 'ovumind_sync_v1', 'ovumind_sync_pos_v1', 'ovumind_sync_reset_v1', 'rhythme_plus_v1', 'rhythme_plus_v1_pending']; /* the two sync_pos/reset keys are backup bookkeeping too (ovu-sync.js) */
  var DAILY_LOG = /^ovuluna_daily_log_\d{4}-\d{2}-\d{2}$/;
  function clearAll() {
    try { if (root.OvuPodcast && root.OvuPodcast.forget) root.OvuPodcast.forget(); } catch (e) { } /* its page-close save would write the listening back */
    cache = empty(); newEpoch(); save('clear', true);
    try { localStorage.removeItem(REV); } catch (e) { } /* not diary data; another tab reads its absence as a change */
    try {
      var keys = []; for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.forEach(function (k) { if (k && (OWN_KEYS.indexOf(k) > -1 || DAILY_LOG.test(k))) { try { localStorage.removeItem(k); } catch (e) { } } });
    } catch (e) { }
  }

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
  /* 28 characters from 32 easy-to-read letters and digits (no 0, O, 1 or I), in seven groups: 140 random bits, so a
   * shared file cannot be opened by guessing (the four-word version had about 24 bits; Codex launch review, 20 Oct).
   * 32 divides 256, so taking each random byte modulo 32 is unbiased. */
  var PASS_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function generatePassphrase() {
    var bytes = crypto.getRandomValues(new Uint8Array(28)), out = '';
    for (var i = 0; i < 28; i++) { out += PASS_ALPHABET[bytes[i] & 31]; if (i % 4 === 3 && i < 27) out += '-'; }
    return out;
  }
  function toCode(bundle) { return btoa(JSON.stringify(bundle)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function fromCode(code) { var s = code.trim().replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return JSON.parse(atob(s)); }

  /* Run fn against a throwaway in-memory database (used by the Doctor view to
     render a decrypted share or fictional sample data). Nothing is saved. */
  var sandboxDepth = 0;
  function sandbox(dbLike, fn) {
    var real = cache; cache = normalise(dbLike); sandboxDepth++;
    try { return fn(); } finally { sandboxDepth--; cache = real; }
  }
  /* true while a sandbox runs: a save then would write the sample over the real record, so callers that write lazily check this */
  function isSandbox() { return sandboxDepth > 0; }

  /* same-day duplicates (a sync can bring two checks for one day): the newest edit is the answer; on a tie, the later row (Codex, 21 Oct) */
  function newestFirst(a, b) { var ta = String(a.updatedAt || a.createdAt || ''), tb = String(b.updatedAt || b.createdAt || ''); return tb > ta ? 1 : tb < ta ? -1 : 0; }
  function latestOnDate(type, date) { var l = list(type, { from: date, to: date }).map(function (e, i) { return { e: e, i: i }; }).sort(function (x, y) { return newestFirst(x.e, y.e) || (y.i - x.i); }); return l.length ? l[0].e : null; }
  /* which diary this is, as stored: Delete everything or a restore that replaces the diary changes it, and another tab sees it
     at once (ovu-gym.js ends a workout on it; that tab's merge keeps its own createdAt in memory). Before any replacement the
     diary's createdAt stands in */
  function born() {
    try {
      var e = localStorage.getItem(EPOCH); if (e) return 'e:' + e;
      var raw = localStorage.getItem(KEY), m = raw && /"createdAt"\s*:\s*"([^"]{1,40})"/.exec(raw.slice(0, 400)); if (m) return m[1];
    } catch (err) { }
    return load().createdAt || null;
  }
  root.OvuStore = { registerMerge: registerMerge, born: born,
    /* the current first-visit data notice (ovu-consent.js asks again below it; the gate below sends people to the room) */
    NOTICE_V: 5, /* v5, 21 Oct 2026: an optional birthday, the year only if she adds it, kept on this phone for the birthday card (the sheet promises to ask again when what is collected changes); v4, 20 Oct 2026: backup and improve-logging wording says who can reach records (Codex legal review) */
    KEY: KEY, TYPES: TYPES, checkinAnswers: checkinAnswers, setCheckinAnswer: setCheckinAnswer, today: today, validDate: validDate, validTime: validTime, addDays: addDays, diffDays: diffDays,
    load: load, list: list, get: get, latestOnDate: latestOnDate, newestFirst: newestFirst, byDate: byDate, add: add, update: update, remove: remove, sandbox: sandbox, isSandbox: isSandbox,
    putEvent: putEvent, applyRemote: applyRemote,
    addMany: addMany, removeWhere: removeWhere,
    profile: profile, setProfile: setProfile, state: state, setState: setState, commit: commit, reload: function () { load(true); return state(); },
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    sleepHours: sleepHours, sleepStats: sleepStats, cleanSleepDetails: cleanSleepDetails, cleanSleepCheck: cleanSleepCheck, SLEEP_DETAIL: SLEEP_DETAIL, SLEEP_WOKE: SLEEP_WOKE, SLEEP_CHECK: SLEEP_CHECK, periodEpisodes: periodEpisodes, cycleStats: cycleStats, rhythmFromRecall: rhythmFromRecall,
    exportJSON: exportJSON, importJSON: importJSON, clearAll: clearAll,
    OWN_KEYS: OWN_KEYS, KEEP_ON_CLEAR: KEEP_ON_CLEAR, crypto: { PASS_ALPHABET: PASS_ALPHABET, encrypt: encrypt, decrypt: decrypt, generatePassphrase: generatePassphrase, toCode: toCode, fromCode: fromCode }
  };
})(window);

/* Rhythme asks for the data notice in the room first: a first-time visitor, anyone whose consent is older than the current notice (OvuStore.NOTICE_V), anyone who has not confirmed 18+, or an unreadable record, is sent there. appnav.js carries the same check for pages without this file. */
(function () { function wrongOwner(db, sn) { var p = (db && db.profile) || {}, o = typeof p.owner === 'string' ? (p.owner || null) : ((p.cloud && p.cloud.uid) || ((p.consentEvents || []).filter(function (e) { return e && e.uid; })[0] || {}).uid || null), u = sn && sn.user && sn.user.id; return !!(o && u && o !== u); } /* the room shows which account this diary belongs to (persona walks, 21 Oct) */ function gate() { try { var pg = location.pathname.split('/').pop() || 'index.html'; if (/^(room|privacy|terms|index|404|doctor)\.html$/.test(pg)) return; /* doctor.html decrypts a patient's file for a clinician who has no account (persona walk, 21 Oct) */ var db = JSON.parse(localStorage.getItem('ovumind_db_v1') || 'null'), c = db && db.profile && db.profile.consent, a = db && db.profile && db.profile.ageAttest, sn = JSON.parse(localStorage.getItem('ovumind_auth_v1') || 'null'); if (!(sn && sn.access_token) || wrongOwner(db, sn) || !(c && c.at && c.v >= window.OvuStore.NOTICE_V && a && a.confirmed === true)) location.replace('room.html'); } catch (e) { try { location.replace('room.html'); } catch (e2) { } } } gate(); try { window.addEventListener('storage', function (e) { if (!e || e.key === null || e.key === 'ovumind_auth_v1' || e.key === 'ovumind_db_v1') gate(); }); window.addEventListener('pageshow', function (e) { if (e && e.persisted) gate(); }); } catch (e) { } })(); /* a sign-out or a wipe in another tab closes this page too (Codex, 21 Oct) */
