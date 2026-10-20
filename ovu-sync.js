/* Rhythme cloud backup and sync.
 *
 * The local diary (OvuStore) is the source of truth. When a person signs in
 * (OvuAuth) and turns on cloud backup, this module mirrors their own rows to
 * Supabase and brings back anything newer from another device. It never runs
 * without both a session and cloud consent (profile.cloud), and it never uploads
 * food photo thumbnails.
 *
 * Conflict rule: last write wins per event id, by the event's own updatedAt.
 * Deletions are tombstones (deleted = true, deleted_at). The server keeps the
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

  /* ---------- sync position (one object in localStorage) ---------- */
  function loadState() {
    try { var s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s && s.v === 1) { s.shadow = s.shadow || {}; s.tombstones = s.tombstones || {}; return s; } } catch (e) { }
    /* pushedAt: the newest local updatedAt we have pushed, so unchanged rows are not re-sent. */
    return { v: 1, userId: null, shadow: {}, tombstones: {}, pushedAt: null, profilePulledAt: null, profileDirty: false, lastSyncAt: null };
  }
  function saveState(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) { } }
  /* Where the pull resumes, in its own key. Only a sync's commit (holding the sync lock, where the browser has Web
     Locks) and a reset write it, so another tab's write of the whole main state (an edit there, say, read before a
     sync finished and saved after it) cannot carry it back.
       epoch: the reset generation, raised by every reset; a sync started under an older one writes nothing more
       pulledSeq, pulledId: the shared cursor, the last row the incremental pull saw (synced_at exactly as the server
         wrote it, and that row's id); pulledSeq without pulledId is an older version's millisecond cursor
       types, typedAfter: the one-time typed recovery's position
     Older versions kept these in the main state, so they are read from there until this key is first written. */
  var LS_PULL = 'ovumind_sync_pull_v1';
  function loadPull() {
    try { var p = JSON.parse(localStorage.getItem(LS_PULL) || 'null'); if (p && p.v === 1) return p; } catch (e) { }
    var s = loadState();
    return { v: 1, epoch: 0, pulledSeq: s.pulledSeq || null, pulledId: s.pulledSeq && s.pulledId != null ? s.pulledId : null, types: s.types || null, typedAfter: s.typedAfter || null };
  }
  function savePull(p) { try { localStorage.setItem(LS_PULL, JSON.stringify(p)); } catch (e) { } }
  /* Forget the position: a new reset generation first (a sync still running stops at its next check), then an empty
     pull position and main state for `uid` (an account switch) or for nobody. The diary, its shadow and the deletions
     outbox stay, so deletions still reach the cloud later. Returns the new generation. */
  function resetNow(uid) {
    var st = loadState(), epoch = (loadPull().epoch || 0) + 1;
    savePull({ v: 1, epoch: epoch, pulledSeq: null, pulledId: null, types: null, typedAfter: null });
    saveState({ v: 1, userId: uid || null, shadow: snapshot(), tombstones: st.tombstones || {}, pushedAt: null, profilePulledAt: null, profileDirty: false, lastSyncAt: uid ? (st.lastSyncAt || null) : null });
    return epoch;
  }
  /* One sync at a time across this phone's tabs (Web Locks: Safari 15.4+, Chrome 69+), so two tabs never read and
     write the sync state at once. Without the API, or where the page may not use it, the work runs unlocked. */
  function withSyncLock(fn) {
    var L = root.navigator && root.navigator.locks, ran = false;
    if (!L || typeof L.request !== 'function') return fn();
    return Promise.resolve().then(function () { return L.request('ovumind-sync', function () { ran = true; return fn(); }); })
      .catch(function (err) { if (ran) throw err; return fn(); });
  }
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
  function onStoreChange(reason) {
    var st = loadState();
    if (reason && reason.indexOf('remove:') === 0) {
      var cur = snapshot();
      Object.keys(st.shadow).forEach(function (id) { if (!(id in cur)) st.tombstones[id] = nowIso(); });
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
  function profileForCloud(p) { var out = {}; Object.keys(p || {}).forEach(function (k) { if (CONTROL_KEYS[k]) return; out[k] = p[k]; }); return out; }

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
  function canSync() { var s = session(); return !!(s && s.user && consentForUser(S.profile(), s.user.id) && doorOpen()); }

  /* ---------- REST ---------- */
  function rest(method, path, body, prefer, token) {
    var h = { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    if (prefer) h.Prefer = prefer;
    return fetch(CFG.supabaseUrl + '/rest/v1' + path, { method: method, headers: h, body: body != null ? JSON.stringify(body) : undefined }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
        if (!r.ok) throw new Error('rest ' + r.status + (j && j.message ? ' ' + j.message : ''));
        return j;
      });
    });
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
  function setStatus(state, error) { statusNow = { state: state, at: loadState().lastSyncAt, error: error || null }; notify(); }

  /* thrown when the position was reset (or the choice or sign-in changed) while a sync ran; it ends that sync quietly */
  var CANCELLED = { cancelled: true };
  function syncNow() {
    if (busy) return busyPromise;
    if (!canSync()) { setStatus('idle'); return Promise.resolve({ ok: false, reason: 'not-enabled' }); }
    busy = true; setStatus('syncing');
    busyPromise = withSyncLock(runSync).catch(function (err) { busy = false; setStatus('error', (err && err.message) || String(err)); return { ok: false, error: (err && err.message) || String(err) }; });
    return busyPromise;
  }
  function runSync() {
    /* the choice or the sign-in may have changed while another tab held the lock */
    if (!canSync()) { busy = false; setStatus('idle'); return Promise.resolve({ ok: false, reason: 'not-enabled' }); }
    var a = auth();
    return a.token().then(function (token) {
      if (!token) throw new Error('no session');
      var uid = a.userId();
      var st = loadState();
      if (st.userId && st.userId !== uid) { resetNow(uid); st = loadState(); }
      if (!st.userId) { st.userId = uid; st.shadow = snapshot(); if (S.list(null).length || (S.profile().name || '').trim() || S.profile().lifeStage) st.profileDirty = true; }
      var pull = loadPull(), epoch = pull.epoch;
      /* Every later request and every write first checks that nothing reset the position since this sync began: a
         sign-out, an account switch, a withdrawal or a wipe, here or in another tab, even one that then turned sync on
         again for the same account. A sync that finds one stops and writes nothing more. */
      function alive() { return loadPull().epoch === epoch && loadState().userId === uid && a.userId() === uid && canSync(); }
      function live() { if (!alive()) throw CANCELLED; }
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
      saveState(st); /* persist the activation/reset before any network call */
      /* before any row moves: read the account's own record (a withdrawal made on another phone is adopted here and stops
         the sync), then make sure this account has heard this phone's cloud choice (the server refuses writes it has not
         been told about, and a phone must not upload on a choice the account does not hold) */
      var C = root.OvuConsent;
      var pre = !C ? Promise.resolve() : C.pullAccountState().then(function (acc) {
        if (acc && acc.cloud_sync && acc.cloud_sync.on === false && C.allows('cloud_sync')) { C.record('cloud_sync', 'withdraw', 'server', { sent: true }); throw new Error('Cloud backup was turned off on another phone.'); }
        return C.flush();
      }).then(function () {
        if (a.userId() !== uid || !C.allows('cloud_sync') || !C.recordedOnAccount('cloud_sync')) throw new Error('Your cloud backup choice has not reached your account yet. Try again in a moment.');
      });
      /* pull every row whose server arrival (synced_at) is after our cursor, in
         order and in pages, so a late-arriving older edit is never skipped */
      return pre.then(function () { return pullSince(pull.pulledSeq, pull.pulledId, token, live); }).then(function (got) {
        var rows = got.rows; incRows = rows; incEnd = got;
        if (!newTypes.length) return rows;
        return pullTypedAfter(pull.typedAfter || null, token, newTypes, live).then(function (t) { typed = t; typedDone = t.done; return mergeRows(rows, t.rows); });
      }).then(function (remoteRows) {
        /* consent, sign-in or the position may have changed during the network wait */
        live();
        var pushedAt = loadState().pushedAt || '';
        var plan = addHeld(merge(S.list(null), loadState().tombstones || {}, remoteRows, pushedAt), loadState().held, S.get);
        /* serialise what we push NOW: an edit made to the same event during the
           upload must not move the watermark to an unsent time (pushUp holds live
           event references), or that edit would never be backed up. */
        var upRows = plan.pushUp.map(function (ev) { return evToRow(ev, uid); });
        if (plan.applyPut.length || plan.applyDel.length) S.applyRemote(plan.applyPut.map(function (r) { return keepLocalPhotos(rowToEvent(r)); }), plan.applyDel);
        var step = Promise.resolve(), pushedRows = upRows, heldRows = [];
        function post(rows) { return rest('POST', '/entries?on_conflict=user_id,id', rows, 'resolution=merge-duplicates,return=minimal', token); }
        if (upRows.length) {
          step = step.then(function () {
            live();
            return post(upRows).catch(function (err) {
              if (!typeRejected(err)) throw err;
              var sp = splitByType(upRows); if (!sp.held.length) throw err;
              pushedRows = sp.ok; heldRows = sp.held;
              live();
              return sp.ok.length ? post(sp.ok) : null;
            });
          });
        }
        plan.pushDel.forEach(function (d) {
          step = step.then(function () { live(); return rest('PATCH', '/entries?id=eq.' + encodeURIComponent(d.id) + '&user_id=eq.' + uid, { deleted: true, deleted_at: d.deleted_at, updated_at: d.deleted_at }, 'return=minimal', token); });
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
          /* a reset during the upload leaves the position reset: nothing below is written */
          live();
          /* read-modify-write so a deletion made while this sync was in flight is kept */
          var cur = loadState(), pos = loadPull();
          /* the shared cursor moves to the last all-type row this pull saw (never a typed-recovery row), kept exactly as
             the server wrote it, and only forward. If it moved while this sync ran (another tab, where the browser has
             no Web Locks), ours is written only when it is strictly later: a cursor wound back would pull again rows
             this phone may have cleared since. A tie on the instant keeps the stored one, because comparing ids here
             could disagree with the server's collation, and pulling a few rows again is safer than skipping any. */
          var movedMeanwhile = (pos.pulledSeq || null) !== (pull.pulledSeq || null) || (pos.pulledId || null) !== (pull.pulledId || null);
          if (incRows.length && (!movedMeanwhile || (pos.pulledSeq && micros(incEnd.at) > micros(pos.pulledSeq)))) { pos.pulledSeq = incEnd.at; pos.pulledId = incEnd.id; }
          if (typedDone) { pos.types = knownTypes; pos.typedAfter = null; }
          else if (typed && typed.lastId) pos.typedAfter = typed.lastId;
          savePull(pos);
          cur.pushedAt = maxIso(cur.pushedAt || '', upMax, delMax, remoteMax) || cur.pushedAt || null;
          Object.keys(settled).forEach(function (id) { delete cur.tombstones[id]; });
          var held = cur.held || {};
          /* a held row is released only if the version that went up is still the one on this phone; an edit made
             during the upload keeps it held, so it is sent next time even if the watermark has moved past it */
          pushedRows.forEach(function (r) { var now = S.get(r.id); if (!now || now.updatedAt === r.updated_at) delete held[r.id]; });
          /* release a hold only where the cloud's version actually won; a remote deletion that lost to a newer local
             edit settles its tombstone but must not drop the hold */
          plan.applyPut.forEach(function (r) { delete held[r.id]; });
          plan.applyDel.forEach(function (id) { delete held[id]; });
          heldRows.forEach(function (r) { held[r.id] = r.updated_at; });
          Object.keys(held).forEach(function (id) { if (!S.get(id)) delete held[id]; });
          cur.held = held;
          cur.shadow = snapshot();
          saveState(cur);
          return syncProfile(token, uid, live).then(function () {
            live();
            var s2 = loadState(); s2.lastSyncAt = nowIso(); saveState(s2);
            busy = false; setStatus('ok');
            return { ok: true, pulled: remoteRows.length, pushed: pushedRows.length + plan.pushDel.length, held: Object.keys(loadState().held || {}).length }; /* every row still waiting, not only this request's refusals */
          });
        });
      });
    }).catch(function (err) {
      if (err === CANCELLED) { busy = false; setStatus('idle'); return { ok: false, reason: 'cancelled' }; }
      busy = false; setStatus('error', (err && err.message) || String(err));
      /* the account says backup is off (turned off on another phone): this phone adopts it and stops */
      if (err && /Cloud backup is off for this account/i.test(err.message || '') && root.OvuConsent && OvuConsent.allows('cloud_sync')) { try { OvuConsent.record('cloud_sync', 'withdraw', 'server', { sent: true }); } catch (e2) { } setStatus('idle'); }
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

  /* `live` throws when the position was reset, or the choice or sign-in changed, since the sync began (see runSync) */
  function syncProfile(token, uid, live) {
    var first = loadState().profilePulledAt == null;
    live();
    return rest('GET', '/profiles?select=*&user_id=eq.' + uid, null, null, token).then(function (rows) {
      live(); /* consent, sign-in or the position changed during the GET */
      var st = loadState(); /* re-read: a profile edit may have happened during the GET */
      var remote = rows && rows[0];
      /* On the first sync for this account, the cloud copy wins: a new phone
         restores it, and turning on backup (which marks the profile "dirty")
         must not overwrite real history with this phone's empty defaults.
         After that, a genuine local edit (dirty) is pushed; otherwise a newer
         remote is pulled. */
      if (remote && (first || (!st.profileDirty && ts(remote.updated_at) > ts(st.profilePulledAt)))) {
        var incoming = profileForCloud(remote.profile || {});
        if (Object.keys(incoming).length) S.setProfile(incoming); /* keeps local consent + cloud */
        var sp = loadState(); sp.profilePulledAt = maxIso(remote.updated_at); sp.profileDirty = false; saveState(sp);
        return;
      }
      if (st.profileDirty || (first && !remote)) {
        var sent = nowIso(), snapSent = JSON.stringify(profileForCloud(S.profile()));
        live();
        return rest('POST', '/profiles?on_conflict=user_id', { user_id: uid, display_name: (S.profile().name || '').slice(0, 80) || null, profile: JSON.parse(snapSent), updated_at: sent }, 'resolution=merge-duplicates,return=minimal', token).then(function () {
          live(); /* a reset during the upload stays a reset */
          var s = loadState(); s.profilePulledAt = sent;
          /* keep dirty if the profile was edited again during the upload, so that edit is still backed up */
          s.profileDirty = JSON.stringify(profileForCloud(S.profile())) !== snapSent;
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
    var epoch = resetNow(null);
    setStatus('idle');
    /* A sync in another tab can pass its last check just before this reset and still write. Once it lets go of the
       lock, reset again if its write carried back an older generation; a newer reset, or this one intact, is left. */
    withSyncLock(function () { if ((loadPull().epoch || 0) < epoch) { resetNow(null); var p = loadPull(); p.epoch = epoch; savePull(p); } });
  }

  function init() {
    if (!S) return;
    S.subscribe(onStoreChange);
    var st = loadState(); if (!st.shadow || !Object.keys(st.shadow).length) { st.shadow = snapshot(); saveState(st); }
    if (canSync()) scheduleSync();
  }

  root.OvuSync = {
    wipeCloud: wipeCloud, CONTROL_KEYS: CONTROL_KEYS, canSync: canSync, doorOpen: doorOpen,
    init: init,
    syncNow: syncNow,
    canSync: canSync,
    consentOk: consentOk,
    deleteAccount: deleteAccount,
    resetPosition: resetPosition,
    status: function () { var st = loadState(); return { state: statusNow.state, error: statusNow.error, lastSyncAt: st.lastSyncAt, pending: Object.keys(st.tombstones || {}).length, held: Object.keys(st.held || {}).length }; },
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    /* pure helpers, exported for the tests */
    merge: merge, stripThumbs: stripThumbs, evToRow: evToRow, rowToEvent: rowToEvent, profileForCloud: profileForCloud, addHeld: addHeld, splitByType: splitByType, typeRejected: typeRejected, mergeRows: mergeRows
  };
})(window);
