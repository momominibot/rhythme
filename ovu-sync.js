/* Rhythme cloud backup and sync.
 *
 * The local diary (OvuStore) is the source of truth. When a person signs in
 * (OvuAuth) and turns on cloud backup, this module mirrors their own rows to
 * Supabase and brings back anything newer from another device. It never runs
 * without both a session and cloud consent (profile.cloud), and it never uploads
 * food photo thumbnails.
 *
 * Conflict rule: last write wins per event id, by the event's own updatedAt.
 * Deletions are tombstones (deleted = true, deleted_at, and the entry's data emptied, so a deleted note leaves nothing
 * readable on the server; launch sweep, 20 Oct 2026). The server keeps the
 * client's updatedAt (its touch trigger is dropped), so everything is one clock.
 *
 * Pull is incremental (rows that reached the server after the last one we pulled,
 * by synced_at then id), so wiping this phone and reloading does not re-download
 * the whole cloud; only a brand-new install (no cursor) restores the full diary. */
(function (root) {
  'use strict';
  var S = root.OvuStore;
  var CFG = root.OVU_CONFIG || {};
  var LS = 'ovumind_sync_v1';
  var EPOCH = '1970-01-01T00:00:00Z';
  /* keys whose values are, or may hold, a photo; never uploaded */
  var PHOTO_KEYS = { photo: 1, photos: 1, thumb: 1, thumbs: 1, thumbnail: 1, thumbnails: 1, image: 1, images: 1, img: 1, dataurl: 1, picture: 1, preview: 1, src: 1, base64: 1, b64: 1 };

  /* Entry types the cloud table accepted before Movement (20261019000000_accounts_sync_tombstones.sql). A newer type
     is sent too; if the server refuses it by its type check, those rows are held on this phone and sent again on the
     next sync, while every other row still uploads. 20261019120000_exercise_entries.sql lets 'exercise' through. */
  var CLOUD_TYPES_V1 = { sleep: 1, period: 1, symptom: 1, food: 1, reflection: 1, mindfulness: 1, weight: 1 };

  var listeners = [];
  var statusNow = { state: 'idle', at: null, error: null };
  var busy = false, busyPromise = null, debounceTimer = null;

  /* ---------- sync state ----------
   * Three keys, kept apart so that nothing written late in one tab can carry another's progress back (Codex sync
   * reviews, rounds one to five, 20 Oct):
   * - the outbox, ovumind_sync_v1: shadow (the diary as last seen), tombstones (deletions still to send) and
   *   profileDirty. onStoreChange writes it whole after every diary change, in whichever tab made it.
   * - the position, ovumind_sync_pos_v1: the account this phone syncs with (uid), how far it has pushed (pushedAt),
   *   rows the server held back (held), when the profile was last restored (profilePulledAt), the last sync (lastSyncAt),
   *   where the pull resumes (pulledSeq and pulledId: the last row the incremental pull saw, its synced_at exactly as the
   *   server wrote it; pulledSeq without pulledId is an older version's millisecond cursor) and the typed recovery
   *   (types, typedAfter). Only a sync holding the lock writes it, and each write carries the reset token that sync
   *   started under.
   * - the reset token, ovumind_sync_reset_v1: a random value that only a reset writes. A position stamped with any
   *   other token reads as empty, so a reset needs no other write, and whatever a sync it overtook writes afterwards
   *   is void. Two resets never share a token.
   * Older versions kept the position inside ovumind_sync_v1; the first sync copies it across, holding the lock,
   * before its first request. */
  function loadState() {
    try { var s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s && s.v === 1) { s.shadow = s.shadow || {}; s.tombstones = s.tombstones || {}; return s; } } catch (e) { }
    return { v: 1, shadow: {}, tombstones: {}, profileDirty: false };
  }
  function saveState(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) { } }
  var LS_POS = 'ovumind_sync_pos_v1', LS_RESET = 'ovumind_sync_reset_v1';
  function readKey(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function resetToken() { return readKey(LS_RESET) || ''; }
  function newToken() {
    try { var b = new Uint8Array(16); root.crypto.getRandomValues(b); return Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join(''); }
    catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); }
  }
  function emptyPos() { return { v: 1, uid: null, pushedAt: null, held: {}, profilePulledAt: null, lastSyncAt: null, pulledSeq: null, pulledId: null, types: null, typedAfter: null }; }
  function storedPos() { try { var p = JSON.parse(readKey(LS_POS) || 'null'); return p && p.v === 1 ? p : null; } catch (e) { return null; } }
  /* an older version's position, from the main object, for a phone that has never had a position key or a reset */
  function legacyPos() {
    var s = loadState(), p = emptyPos();
    p.uid = s.userId || null; p.pushedAt = s.pushedAt || null; p.held = s.held || {}; p.profilePulledAt = s.profilePulledAt || null; p.lastSyncAt = s.lastSyncAt || null;
    p.pulledSeq = s.pulledSeq || null; p.pulledId = s.pulledSeq && s.pulledId != null ? s.pulledId : null; p.types = s.types || null; p.typedAfter = s.typedAfter || null;
    return p;
  }
  /* the position as it stands under the current reset token */
  function loadPos() {
    var p = storedPos();
    if (!p) return readKey(LS_RESET) == null ? legacyPos() : emptyPos();
    if ((p.token || '') !== resetToken()) return emptyPos();
    p.held = p.held || {};
    return p;
  }
  function savePos(p, token) { var out = Object.assign({}, p, { v: 1, token: token }); try { localStorage.setItem(LS_POS, JSON.stringify(out)); } catch (e) { } }
  function snapshot() { var m = {}; S.list(null).forEach(function (e) { m[e.id] = e.updatedAt; }); return m; }
  function nowIso() { return new Date().toISOString(); }
  /* Compare by instant, not by text: the server returns '...+00:00' while the
     client writes '...Z', so the same moment has two spellings. */
  function ts(x) { var n = Date.parse(x); return isFinite(n) ? n : -1; }
  /* The same comparison to the microsecond, which the server keeps and Date.parse drops; for ordering pull cursors. */
  function micros(x) {
    var m = /^(.+?)(?:\.(\d+))?(Z|[+-]\d\d:?\d\d)$/.exec(String(x || '')), ms = m ? Date.parse(m[1] + m[3]) : NaN;
    return isFinite(ms) ? ms * 1000 + Number(((m[2] || '') + '000000').slice(0, 6)) : -1;
  }
  /* The latest instant among the arguments, as a canonical '...Z' string. */
  function maxIso() { var bt = -Infinity; for (var i = 0; i < arguments.length; i++) { var n = ts(arguments[i]); if (n > bt) bt = n; } return bt > -Infinity ? new Date(bt).toISOString() : ''; }

  /* ---------- deletion capture (no store edits needed) ----------
   * A single-entry delete (reason 'remove:*') records a tombstone in the outbox.
   * A whole-phone wipe (reason 'clear') or a cloud pull (reason 'sync') never
   * becomes a tombstone, so "start fresh on this phone" does not delete the
   * cloud backup and a pull does not bounce back as a deletion. */
  function onStoreChange(reason, db, removed) {
    var st = loadState();
    if (reason && reason.indexOf('remove:') === 0) {
      var cur = snapshot();
      /* the store names the ids this tab deleted; an entry another tab's Delete everything wiped is not one (review, 21 Oct) */
      (Array.isArray(removed) ? removed : Object.keys(st.shadow).filter(function (id) { return !(id in cur); })).forEach(function (id) { if (st.shadow[id] !== undefined && !(id in cur)) st.tombstones[id] = nowIso(); });
      st.shadow = cur;
    } else {
      if (reason === 'profile') st.profileDirty = true;
      st.shadow = snapshot();
    }
    saveState(st);
    if (reason && reason.indexOf('sync') === 0) return; /* our own apply; don't loop */
    scheduleSync();
  }

  /* ---------- pure merge (exported for tools/test-core.js) ----------
   * Decides, per id, what to apply locally and what to push, by last-write-wins.
   * remoteRows are the cloud rows changed since `syncedAt`; absence from that
   * incremental set means "unchanged on the server", not "absent", so a local
   * row older than syncedAt with no remote change is left alone (not re-pushed). */
  function merge(localEvents, tombstones, remoteRows, syncedAt) {
    syncedAt = syncedAt || '';
    tombstones = tombstones || {};
    var L = {}, R = {}, ids = {};
    (localEvents || []).forEach(function (e) { L[e.id] = e; ids[e.id] = 1; });
    (remoteRows || []).forEach(function (r) { R[r.id] = r; ids[r.id] = 1; });
    Object.keys(tombstones).forEach(function (k) { ids[k] = 1; });
    var applyPut = [], applyDel = [], pushUp = [], pushDel = [];
    Object.keys(ids).forEach(function (id) {
      var lev = L[id] || null, ltomb = tombstones[id] || null;
      var local = lev ? { kind: 'live', t: lev.updatedAt, ev: lev } : (ltomb ? { kind: 'dead', t: ltomb } : null);
      var r = R[id] || null;
      var remote = r ? (r.deleted ? { kind: 'dead', t: r.deleted_at || r.updated_at } : { kind: 'live', t: r.updated_at, row: r }) : null;
      if (remote && local) {
        if (ts(remote.t) > ts(local.t)) {
          if (remote.kind === 'live') applyPut.push(remote.row); else if (local.kind === 'live') applyDel.push(id);
        } else {
          if (local.kind === 'live') { if (ts(local.t) > ts(syncedAt)) pushUp.push(local.ev); } else pushDel.push({ id: id, deleted_at: local.t });
        }
      } else if (remote && !local) {
        if (remote.kind === 'live') applyPut.push(remote.row);
      } else if (local && !remote) {
        if (local.kind === 'live') { if (ts(local.t) > ts(syncedAt)) pushUp.push(local.ev); } else pushDel.push({ id: id, deleted_at: local.t });
      }
    });
    return { applyPut: applyPut, applyDel: applyDel, pushUp: pushUp, pushDel: pushDel };
  }

  /* ---------- held rows (pure, exported for tools/test-core.js) ----------
   * Rows held back by an earlier sync go up again with this one, unless this sync already sends them or a newer
   * cloud copy has just replaced or deleted them. The global push watermark can move past a held row's edit time,
   * so without this the row would never be sent once the server accepts its type. */
  function addHeld(plan, held, getEvent) {
    var have = {};
    plan.pushUp.forEach(function (e) { have[e.id] = 1; });
    plan.applyPut.forEach(function (r) { have[r.id] = 1; });
    plan.applyDel.forEach(function (id) { have[id] = 1; });
    Object.keys(held || {}).forEach(function (id) { if (have[id]) return; var ev = getEvent(id); if (ev) { plan.pushUp.push(ev); have[id] = 1; } });
    return plan;
  }
  /* the same row can arrive in both pulls; keep the copy the server stamped last */
  function mergeRows(a, b) {
    var by = {}, out = [];
    (a || []).concat(b || []).forEach(function (r) { var k = r.id, cur = by[k]; if (!cur || ts(r.synced_at) > ts(cur.synced_at)) by[k] = r; });
    Object.keys(by).forEach(function (k) { out.push(by[k]); });
    return out.sort(function (x, y) { return ts(x.synced_at) - ts(y.synced_at); });
  }
  function typeRejected(err) { return /violates check constraint/i.test(String((err && err.message) || '')); }
  /* Split a refused batch: the older types go up on their own, the newer ones are held. */
  function splitByType(rows) { var ok = [], held = []; (rows || []).forEach(function (r) { (CLOUD_TYPES_V1[r.type] ? ok : held).push(r); }); return { ok: ok, held: held }; }

  /* ---------- row <-> event, with thumbnails stripped on the way up ---------- */
  function stripThumbs(v) {
    if (Array.isArray(v)) return v.map(stripThumbs);
    if (v && typeof v === 'object') {
      var out = {};
      Object.keys(v).forEach(function (k) { if (PHOTO_KEYS[k] || PHOTO_KEYS[String(k).toLowerCase()]) return; out[k] = stripThumbs(v[k]); });
      return out;
    }
    if (typeof v === 'string' && v.slice(0, 11).toLowerCase() === 'data:image/') return '';
    return v;
  }
  function evToRow(ev, uid) {
    return { id: ev.id, user_id: uid, type: ev.type, date: ev.date, data: stripThumbs(ev.data || {}), source: ev.source || 'app', created_at: ev.createdAt || ev.updatedAt, updated_at: ev.updatedAt, deleted: false, deleted_at: null };
  }
  function rowToEvent(r) {
    /* normalise the server's '+00:00' times to canonical '...Z' so the local
       store stays in one timestamp format */
    return { id: r.id, type: r.type, date: r.date, data: r.data || {}, source: r.source || 'cloud', createdAt: r.created_at ? maxIso(r.created_at) : undefined, updatedAt: maxIso(r.updated_at) };
  }
  /* Photos never leave the phone, so a pulled row has none. When a remote edit
     overwrites an event that still has a local-only thumbnail, carry the photo
     fields over so the picture on this phone is not lost. */
  function keepLocalPhotos(incomingEv) {
    var local = S.get(incomingEv.id); if (!local || !local.data) return incomingEv;
    Object.keys(local.data).forEach(function (k) {
      if (!(PHOTO_KEYS[k] || PHOTO_KEYS[String(k).toLowerCase()])) return;
      if (!(k in incomingEv.data)) incomingEv.data[k] = local.data[k];
    });
    return incomingEv;
  }
  /* consent, the cloud choice, the improve record, the consent log and the age attestation are this phone's or the account's own control state, never part of the backed-up profile, so a restore can never carry a choice between phones */
  var CONTROL_KEYS = { consent: 1, cloud: 1, analysis: 1, consentEvents: 1, consentImportedAt: 1, ageAttest: 1 };
  /* kept on this phone only: her birthday (a month and a day, and the year if she gave it, for the birthday card) never travels in the cloud copy, either way */
  var DEVICE_KEYS = { birthday: 1, birthYear: 1 };
  function profileForCloud(p) { var out = {}; Object.keys(p || {}).forEach(function (k) { if (CONTROL_KEYS[k] || DEVICE_KEYS[k]) return; out[k] = p[k]; }); return out; }

  /* ---------- gate ---------- */
  function consentOk(p) { var c = (p || {}).cloud; return !!(c && c.v >= 1 && c.at); }
  function auth() { return root.OvuAuth || null; }
  function session() { var a = auth(); return a && a.session ? a.session() : null; }
  /* Cloud consent is tied to the account that gave it: after signing out and
     into a different account, nothing syncs until that account also opts in, so
     one person's diary is never uploaded under another person's account. */
  function consentForUser(p, uid) { var c = (p || {}).cloud; return consentOk(p) && c.uid === uid; }
  /* nothing moves without a session, the cloud choice for this account, the 18+ attestation and the current notice (ovu-consent.js) */
  function doorOpen() { var C = root.OvuConsent; return !C || (!C.needsSheet() && C.allows('cloud_sync')); }
  function ownerFits(p, uid) { p = p || {}; var o = typeof p.owner === 'string' ? (p.owner || null) : ((p.cloud && p.cloud.uid) || ((p.consentEvents || []).filter(function (e) { return e && e.uid; })[0] || {}).uid || null); return !o || o === uid; }
  function canSync() { var s = session(); return !!(s && s.user && ownerFits(S.profile(), s.user.id) && consentForUser(S.profile(), s.user.id) && doorOpen()); } /* a diary never backs up to another account (Codex sweep, 21 Oct) */

  /* ---------- REST ---------- */
  /* How long one request may take (OVU_CONFIG.syncRequestMs, 30 seconds unless set). A sync holds the lock every tab
     shares, so a request that never answers must not hold it for ever: past the limit the sync stops, the lock is
     free again, and the late answer, if it ever comes, is ignored. */
  function limitMs() { var c = root.OVU_CONFIG; return (c && c.syncRequestMs) || 30000; }
  var SLOW = 'Cloud backup took too long to answer. Your diary is safe on this phone, and backup will try again.';
  function timed(p, ctl) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { if (ctl) { try { ctl.abort(); } catch (e) { } } rej(new Error(SLOW)); }, limitMs());
      Promise.resolve(p).then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  function rest(method, path, body, prefer, token) {
    var h = { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    if (prefer) h.Prefer = prefer;
    var ctl = typeof AbortController === 'function' ? new AbortController() : null; /* abort stops the request and its body */
    return timed(fetch(CFG.supabaseUrl + '/rest/v1' + path, { method: method, headers: h, body: body != null ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
        if (!r.ok) throw new Error('rest ' + r.status + (j && j.message ? ' ' + j.message : ''));
        return j;
      });
    }), ctl);
  }

  /* A PostgREST filter value in double quotes, so commas, brackets, dots and colons in it are read as text. */
  function quoted(v) { return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
  /* Rows after the cursor in (synced_at, id) order. A cursor an older version saved (a millisecond time, no id)
     resumes from that millisecond inclusive: rows it already had may come again, which is harmless, but none are missed. */
  function afterCursor(at, id) {
    if (!at) return '';
    if (id == null) return '&synced_at=gte.' + encodeURIComponent(at);
    return '&or=' + encodeURIComponent('(synced_at.gt.' + quoted(at) + ',and(synced_at.eq.' + quoted(at) + ',id.gt.' + quoted(id) + '))');
  }
  /* Pull every entry whose server arrival is after the cursor, oldest first, in pages (PostgREST caps a response,
     so a full restore needs more than one), at most 20,000 rows a sync. The cursor is the last row seen: its
     synced_at exactly as the server wrote it, and its id. One upload stamps all its rows with one now(), so ids tell
     those rows apart, and the server's microseconds are never rounded to milliseconds; a page or the 20,000 cap can
     split such a group without skipping or fetching again any of it. Returns the rows and the new cursor. */
  function pullSince(at, id, token, guard) {
    var PAGE = 1000, all = [], cur = { at: at || null, id: at && id != null ? id : null };
    var base = '/entries?select=*&order=synced_at.asc,id.asc&limit=' + PAGE;
    function page() {
      if (guard) guard();
      return rest('GET', base + afterCursor(cur.at, cur.id), null, null, token).then(function (rows) {
        rows = rows || []; all = all.concat(rows);
        if (rows.length) { var last = rows[rows.length - 1]; cur = { at: last.synced_at, id: last.id }; }
        if (rows.length === PAGE && all.length < 20000) return page();
        return { rows: all, at: cur.at, id: cur.id };
      });
    }
    return page();
  }
  /* The one-time recovery of newly known types walks every row of those types in id order, resuming after the last id
     it saw (keyset paging). Ids are unique, so rows that share a synced_at (one upload is stamped with one now()) can
     neither be skipped nor fetched forever, and no timestamp rounding is involved. At most 20,000 rows a sync;
     `done` is true only when a page came back short, meaning the scan reached the end. */
  function pullTypedAfter(afterId, token, types, guard) {
    var PAGE = 1000, all = [], last = afterId || null;
    var base = '/entries?select=*&type=in.(' + types.map(encodeURIComponent).join(',') + ')&order=id.asc&limit=' + PAGE;
    function page() {
      if (guard) guard();
      return rest('GET', base + (last ? '&id=gt.' + encodeURIComponent(last) : ''), null, null, token).then(function (rows) {
        rows = rows || []; all = all.concat(rows);
        if (rows.length) last = rows[rows.length - 1].id;
        if (rows.length === PAGE && all.length < 20000) return page();
        return { rows: all, lastId: last, done: rows.length < PAGE };
      });
    }
    return page();
  }

  /* ---------- the sync ---------- */
  function notify() { listeners.slice().forEach(function (fn) { try { fn(statusNow); } catch (e) { } }); }
  function setStatus(state, error) { statusNow = { state: state, at: loadPos().lastSyncAt, error: error || null }; notify(); }

  /* one sync at a time across every tab of this browser (Web Locks: Safari 15.4+, Chrome 69+). Where the browser has
     none, or the page may not use it, the work runs unlocked, and this tab's busy flag and the generation checks below
     are what keep a stale sync from writing. */
  function withLock(fn) {
    var L = root.navigator && root.navigator.locks, ran = false, p;
    if (!L || typeof L.request !== 'function') return fn();
    try { p = L.request('ovumind-sync', function () { ran = true; return fn(); }); } catch (e) { return fn(); }
    return Promise.resolve(p).catch(function (err) { if (ran) throw err; return fn(); });
  }
  var CANCELLED = { cancelled: true };
  function syncNow() {
    if (busy) return busyPromise;
    if (!canSync()) { setStatus('idle'); return Promise.resolve({ ok: false, reason: 'not-enabled' }); }
    busy = true; setStatus('syncing');
    /* the reset token is read now, before waiting for the lock: a reset while this sync waits ends it */
    var a = auth(), tok0 = resetToken();
    busyPromise = withLock(function () { return runSync(a, tok0); }).then(function (r) { busy = false; return r; }, function (err) { busy = false; throw err; });
    return busyPromise;
  }
  function runSync(a, tok0) {
    /* another tab may have reset things while this one waited for the lock */
    if (resetToken() !== tok0) { setStatus('idle'); return Promise.resolve({ ok: false, reason: 'cancelled' }); }
    if (!canSync()) { setStatus('idle'); return Promise.resolve({ ok: false, reason: 'not-enabled' }); }
    /* an older version's position moves to its own key now, holding the lock and before any wait */
    if (!storedPos()) savePos(loadPos(), tok0);
    /* the account this sync is for, and whether nothing has reset or switched since; the error handler below reads both */
    var uid = null, alive = function () { return false; };
    return timed(a.token()).then(function (token) {
      if (!token) throw new Error('no session');
      uid = a.userId();
      if (resetToken() !== tok0 || !canSync()) throw CANCELLED; /* a reset while the token was on its way */
      var pull = loadPos(), st = loadState();
      if (pull.uid !== uid) {
        /* another account, or the first sync after a reset or ever: the position starts clean for this account. A
           switch keeps the last sync time; a first sync marks the profile for upload if this phone has anything. */
        var last = pull.uid ? pull.lastSyncAt : null, first = !pull.uid;
        pull = emptyPos(); pull.uid = uid; pull.lastSyncAt = last;
        st.shadow = snapshot();
        st.profileDirty = first ? !!(S.list(null).length || (S.profile().name || '').trim() || S.profile().lifeStage) : false;
        savePos(pull, tok0); saveState(st);
      }
      /* the same reset token and account, signed in as it, and allowed to sync */
      alive = function () { return resetToken() === tok0 && loadPos().uid === uid && a.userId() === uid && canSync(); };
      function stillAlive() { if (!alive()) throw CANCELLED; }
      /* An older app version drops rows of types it does not know, while its pull cursor moves past them. When this
         version knows types the cursor was built without (Movement added 'exercise'), pull those types once from the
         start. Only the new types: a full re-pull would bring back older entries someone deliberately cleared. */
      var knownTypes = (S.TYPES || []).join(','), before = pull.types ? pull.types.split(',') : Object.keys(CLOUD_TYPES_V1);
      var newTypes = pull.pulledSeq ? (S.TYPES || []).filter(function (t) { return before.indexOf(t) < 0; }) : [];
      /* the typed recovery keeps its own position (typedAfter, the last id it saw) and never moves the shared cursor,
         so rows of other types that arrive between the two requests are still pulled next time; it resumes across
         syncs when the backlog is larger than one sync's share, and only a scan that reached the end marks the new
         types as known */
      var incRows = [], incEnd = null, typed = null, typedDone = !newTypes.length;
      /* before any row moves: read the account's own record (a withdrawal made on another phone is adopted here and stops
         the sync), then make sure this account has heard this phone's cloud choice (the server refuses writes it has not
         been told about, and a phone must not upload on a choice the account does not hold) */
      var C = root.OvuConsent;
      var pre = !C ? Promise.resolve() : timed(C.pullAccountState()).then(function (acc) {
        /* the answer is about the account it was asked for: after a sign-out or a switch it must never be applied to
           whoever is signed in now */
        stillAlive();
        if (acc && acc.cloud_sync && acc.cloud_sync.on === false && C.allows('cloud_sync')) { C.record('cloud_sync', 'withdraw', 'server', { sent: true, uid: uid }); throw new Error('Cloud backup was turned off on another phone.'); }
        return timed(C.flush());
      }).then(function () {
        stillAlive();
        if (a.userId() !== uid || !C.allows('cloud_sync') || !C.recordedOnAccount('cloud_sync')) throw new Error('Your cloud backup choice has not reached your account yet. Try again in a moment.');
      });
      /* pull every row whose server arrival (synced_at) is after our cursor, in
         order and in pages, so a late-arriving older edit is never skipped */
      return pre.then(function () { stillAlive(); return pullSince(pull.pulledSeq, pull.pulledId, token, stillAlive); }).then(function (got) {
        stillAlive();
        var rows = got.rows; incRows = rows; incEnd = got;
        if (!newTypes.length) return rows;
        return pullTypedAfter(pull.typedAfter || null, token, newTypes, stillAlive).then(function (t) { typed = t; typedDone = t.done; return mergeRows(rows, t.rows); });
      }).then(function (remoteRows) {
        /* consent, sign-in or a reset may have changed during the network wait */
        stillAlive();
        var pushedAt = loadPos().pushedAt || '';
        var plan = addHeld(merge(S.list(null), loadState().tombstones || {}, remoteRows, pushedAt), loadPos().held, S.get);
        /* serialise what we push NOW: an edit made to the same event during the
           upload must not move the watermark to an unsent time (pushUp holds live
           event references), or that edit would never be backed up. */
        var upRows = plan.pushUp.map(function (ev) { return evToRow(ev, uid); });
        if (plan.applyPut.length || plan.applyDel.length) S.applyRemote(plan.applyPut.map(function (r) { return keepLocalPhotos(rowToEvent(r)); }), plan.applyDel);
        var step = Promise.resolve(), pushedRows = upRows, heldRows = [];
        function post(rows) { stillAlive(); return rest('POST', '/entries?on_conflict=user_id,id', rows, 'resolution=merge-duplicates,return=minimal', token); }
        if (upRows.length) {
          step = step.then(function () {
            return post(upRows).catch(function (err) {
              if (!typeRejected(err)) throw err;
              var sp = splitByType(upRows); if (!sp.held.length) throw err;
              /* the older types go up together; each newer type is tried on its own, so a type the server already takes is never held behind one it refuses (Codex, 21 Oct) */
              pushedRows = sp.ok; heldRows = [];
              var byType = {}; sp.held.forEach(function (r) { (byType[r.type] = byType[r.type] || []).push(r); });
              var chain = sp.ok.length ? post(sp.ok) : Promise.resolve(null);
              Object.keys(byType).forEach(function (t) { chain = chain.then(function () { return post(byType[t]).then(function () { pushedRows = pushedRows.concat(byType[t]); }, function (e2) { if (!typeRejected(e2)) throw e2; heldRows = heldRows.concat(byType[t]); }); }); });
              return chain;
            });
          });
        }
        plan.pushDel.forEach(function (d) {
          step = step.then(function () { stillAlive(); return rest('PATCH', '/entries?id=eq.' + encodeURIComponent(d.id) + '&user_id=eq.' + uid, { deleted: true, deleted_at: d.deleted_at, updated_at: d.deleted_at, data: {} }, 'return=minimal', token); });
        });
        return step.then(function () {
          var upMax = pushedRows.reduce(function (m, r) { return maxIso(m, r.updated_at); }, ''); /* held rows did not go up */
          var delMax = plan.pushDel.reduce(function (m, d) { return maxIso(m, d.deleted_at); }, '');
          var remoteMax = remoteRows.reduce(function (m, r) { return maxIso(m, r.updated_at, r.deleted_at || ''); }, '');
          var settled = {};
          plan.pushDel.forEach(function (d) { settled[d.id] = 1; });
          plan.applyDel.forEach(function (id) { settled[id] = 1; });
          plan.applyPut.forEach(function (r) { settled[r.id] = 1; }); /* a restored row's old tombstone is resolved */
          remoteRows.forEach(function (r) { if (r.deleted) settled[r.id] = 1; });
          /* a sign-out, an account switch or a reset during the upload: write nothing back. (A reset that lands after this
             check makes the position written below void: it carries this sync's token, no longer the current one.) */
          stillAlive();
          /* read-modify-write so a deletion made while this sync was in flight is kept */
          var cur = loadState(), pos = loadPos();
          /* the shared cursor moves to the last all-type row this pull saw (never a typed-recovery row), kept exactly as
             the server wrote it, and only forward. If it moved while this sync ran (another tab, where the browser has
             no Web Locks), ours is written only when it is strictly later: a cursor wound back would pull again rows
             this phone may have cleared since. A tie on the instant keeps the stored one, because comparing ids here
             could disagree with the server's collation, and pulling a few rows again is safer than skipping any. */
          var movedMeanwhile = (pos.pulledSeq || null) !== (pull.pulledSeq || null) || (pos.pulledId || null) !== (pull.pulledId || null);
          if (incRows.length && (!movedMeanwhile || (pos.pulledSeq && micros(incEnd.at) > micros(pos.pulledSeq)))) { pos.pulledSeq = incEnd.at; pos.pulledId = incEnd.id; }
          if (typedDone) { pos.types = knownTypes; pos.typedAfter = null; }
          else if (typed && typed.lastId) pos.typedAfter = typed.lastId;
          pos.pushedAt = maxIso(pos.pushedAt || '', upMax, delMax, remoteMax) || pos.pushedAt || null;
          Object.keys(settled).forEach(function (id) { delete cur.tombstones[id]; });
          var held = pos.held || {};
          /* a held row is released only if the version that went up is still the one on this phone; an edit made
             during the upload keeps it held, so it is sent next time even if the watermark has moved past it */
          pushedRows.forEach(function (r) { var now = S.get(r.id); if (!now || now.updatedAt === r.updated_at) delete held[r.id]; });
          /* release a hold only where the cloud's version actually won; a remote deletion that lost to a newer local
             edit settles its tombstone but must not drop the hold */
          plan.applyPut.forEach(function (r) { delete held[r.id]; });
          plan.applyDel.forEach(function (id) { delete held[id]; });
          heldRows.forEach(function (r) { held[r.id] = r.updated_at; });
          Object.keys(held).forEach(function (id) { if (!S.get(id)) delete held[id]; });
          pos.held = held;
          savePos(pos, tok0);
          cur.shadow = snapshot();
          saveState(cur);
          return syncProfile(token, uid, alive, tok0).then(function () {
            stillAlive();
            var p2 = loadPos(); p2.lastSyncAt = nowIso(); savePos(p2, tok0);
            setStatus('ok');
            return { ok: true, pulled: remoteRows.length, pushed: pushedRows.length + plan.pushDel.length, held: Object.keys(loadPos().held || {}).length }; /* every row still waiting, not only this request's refusals */
          });
        });
      });
    }).catch(function (err) {
      if (err === CANCELLED) { setStatus('idle'); return { ok: false, reason: 'cancelled' }; }
      setStatus('error', (err && err.message) || String(err));
      /* the account says backup is off (turned off on another phone): this phone adopts it and stops, but only while the
         account and position this sync was for are still the current ones */
      if (err && /Cloud backup is off for this account/i.test(err.message || '') && root.OvuConsent && OvuConsent.allows('cloud_sync') && uid && alive()) { try { OvuConsent.record('cloud_sync', 'withdraw', 'server', { sent: true, uid: uid }); } catch (e2) { } setStatus('idle'); }
      return { ok: false, error: (err && err.message) || String(err) };
    });
  }

  /* delete the copy in the account (entries, tombstones and profile) and forget the sync position; the account itself stays */
  function wipeCloud() {
    var a = auth(); if (!a) return Promise.reject(new Error('not signed in'));
    return a.token().then(function (token) {
      if (!token) throw new Error('Please sign in again.');
      var uid = a.userId();
      return rest('DELETE', '/entries?user_id=eq.' + encodeURIComponent(uid), null, 'return=minimal', token)
        .then(function () { return rest('DELETE', '/profiles?user_id=eq.' + encodeURIComponent(uid), null, 'return=minimal', token); })
        .then(function () { resetPosition(); return { ok: true }; });
    });
  }

  /* `alive` says the position and account are still this sync's; `tok` is the reset token its writes carry */
  function syncProfile(token, uid, alive, tok) {
    if (!alive()) return Promise.resolve();
    var first = loadPos().profilePulledAt == null;
    return rest('GET', '/profiles?select=*&user_id=eq.' + uid, null, null, token).then(function (rows) {
      if (!alive()) return; /* consent, sign-in or a reset changed during the GET */
      var st = loadState(); /* re-read: a profile edit may have happened during the GET */
      var remote = rows && rows[0];
      /* On the first sync for this account, the cloud copy wins: a new phone
         restores it, and turning on backup (which marks the profile "dirty")
         must not overwrite real history with this phone's empty defaults.
         After that, a genuine local edit (dirty) is pushed; otherwise a newer
         remote is pulled. */
      if (remote && (first || (!st.profileDirty && ts(remote.updated_at) > ts(loadPos().profilePulledAt)))) {
        var incoming = profileForCloud(remote.profile || {});
        if (!alive()) return;
        if (Object.keys(incoming).length) S.setProfile(incoming); /* keeps local consent + cloud */
        var pp = loadPos(); pp.profilePulledAt = maxIso(remote.updated_at); savePos(pp, tok);
        var sp = loadState(); sp.profileDirty = false; saveState(sp);
        return;
      }
      if (st.profileDirty || (first && !remote)) {
        var sent = nowIso(), snapSent = JSON.stringify(profileForCloud(S.profile()));
        if (!alive()) return;
        return rest('POST', '/profiles?on_conflict=user_id', { user_id: uid, display_name: (S.profile().name || '').slice(0, 80) || null, profile: JSON.parse(snapSent), updated_at: sent }, 'resolution=merge-duplicates,return=minimal', token).then(function () {
          /* a reset or a switch during the upload: its completion must not mark the new state as already restored, or
             the next account would skip its own first restore and upload this profile over its cloud copy */
          if (!alive()) return;
          var pp = loadPos(); pp.profilePulledAt = sent; savePos(pp, tok);
          /* keep dirty if the profile was edited again during the upload, so that edit is still backed up */
          var s = loadState(); s.profileDirty = JSON.stringify(profileForCloud(S.profile())) !== snapSent;
          saveState(s);
        });
      }
    });
  }

  function scheduleSync() {
    if (!canSync()) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () { if (busy) { scheduleSync(); return; } syncNow(); }, 1500);
  }

  /* ---------- account controls ---------- */
  /* Delete every cloud row and the account itself, through the origin-locked
     edge function (service role on the server). The local diary is untouched. */
  function deleteAccount() {
    var a = auth(); if (!a) return Promise.reject(new Error('not signed in'));
    return a.token().then(function (token) {
      if (!token) throw new Error('not signed in');
      return fetch(CFG.functionsBase + '/account', { method: 'POST', headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete' }) }).then(function (r) {
        return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { } if (!r.ok) throw new Error('delete ' + r.status + (j && j.message ? ' ' + j.message : '')); return j; });
      });
    }).then(function (res) { resetPosition(); return res; });
  }
  /* Forget this device's sync position (on sign-out or account switch); the
     local diary stays, deletions outbox is kept so they still propagate later. */
  function resetPosition() {
    /* a fresh token is the whole reset: every position written under the old one reads as empty from now on, and a
       sync that started before it stops at its next check */
    var tok = newToken();
    try { localStorage.setItem(LS_RESET, tok); } catch (e) { }
    setStatus('idle');
    /* Nothing else is written: the old position stays in storage, unreadable under the new token, until the next sync
       for an account replaces it. (A tidy-up here could run after a sync that started under the new token and erase
       that sync's valid position: Codex round five, finding 1.) */
  }

  function init() {
    if (!S) return;
    S.subscribe(onStoreChange);
    var st = loadState(); if (!st.shadow || !Object.keys(st.shadow).length) { st.shadow = snapshot(); saveState(st); }
    if (canSync()) scheduleSync();
  }

  root.OvuSync = {
    wipeCloud: wipeCloud, CONTROL_KEYS: CONTROL_KEYS, DEVICE_KEYS: DEVICE_KEYS, canSync: canSync, doorOpen: doorOpen,
    init: init,
    syncNow: syncNow,
    canSync: canSync,
    consentOk: consentOk,
    deleteAccount: deleteAccount,
    resetPosition: resetPosition,
    status: function () { var st = loadState(), p = loadPos(); return { state: statusNow.state, error: statusNow.error, lastSyncAt: p.lastSyncAt, pending: Object.keys(st.tombstones || {}).length, held: Object.keys(p.held || {}).length }; },
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    /* pure helpers, exported for the tests */
    merge: merge, stripThumbs: stripThumbs, evToRow: evToRow, rowToEvent: rowToEvent, profileForCloud: profileForCloud, addHeld: addHeld, splitByType: splitByType, typeRejected: typeRejected, mergeRows: mergeRows
  };
})(window);
