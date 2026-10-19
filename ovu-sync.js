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
 * Pull is incremental (rows whose updated_at is newer than our high-watermark),
 * so wiping this phone and reloading does not re-download the whole cloud; only
 * a brand-new install (no watermark) restores the full diary. */
(function (root) {
  'use strict';
  var S = root.OvuStore;
  var CFG = root.OVU_CONFIG || {};
  var LS = 'ovumind_sync_v1';
  var EPOCH = '1970-01-01T00:00:00Z';
  /* keys whose values are, or may hold, a photo; never uploaded */
  var PHOTO_KEYS = { photo: 1, photos: 1, thumb: 1, thumbs: 1, thumbnail: 1, thumbnails: 1, image: 1, images: 1, img: 1, dataurl: 1, picture: 1, preview: 1, src: 1, base64: 1, b64: 1 };

  var listeners = [];
  var statusNow = { state: 'idle', at: null, error: null };
  var busy = false, busyPromise = null, debounceTimer = null;

  /* ---------- sync position (one object in localStorage) ---------- */
  function loadState() {
    try { var s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s && s.v === 1) { s.shadow = s.shadow || {}; s.tombstones = s.tombstones || {}; return s; } } catch (e) { }
    /* pulledSeq: server synced_at cursor for the incremental pull (in arrival order).
       pushedAt: the newest local updatedAt we have pushed, so unchanged rows are not re-sent. */
    return { v: 1, userId: null, shadow: {}, tombstones: {}, pulledSeq: null, pushedAt: null, profilePulledAt: null, profileDirty: false, lastSyncAt: null };
  }
  function saveState(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) { } }
  function snapshot() { var m = {}; S.list(null).forEach(function (e) { m[e.id] = e.updatedAt; }); return m; }
  function nowIso() { return new Date().toISOString(); }
  /* Compare by instant, not by text: the server returns '...+00:00' while the
     client writes '...Z', so the same moment has two spellings. */
  function ts(x) { var n = Date.parse(x); return isFinite(n) ? n : -1; }
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
  function liveUid() { var s = session(); return s && s.user ? s.user.id : null; }
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

  /* Pull every entry whose server arrival is after the cursor, oldest first, in
     pages (PostgREST caps a response, so a full restore needs more than one). */
  function pullSince(cursor, token) {
    var PAGE = 1000, all = [], offset = 0;
    var base = '/entries?select=*&order=synced_at.asc,id.asc&limit=' + PAGE + (cursor ? '&synced_at=gt.' + encodeURIComponent(cursor) : '');
    function page() {
      return rest('GET', base + '&offset=' + offset, null, null, token).then(function (rows) {
        rows = rows || []; all = all.concat(rows);
        if (rows.length === PAGE && all.length < 20000) { offset += PAGE; return page(); }
        return all;
      });
    }
    return page();
  }

  /* ---------- the sync ---------- */
  function notify() { listeners.slice().forEach(function (fn) { try { fn(statusNow); } catch (e) { } }); }
  function setStatus(state, error) { statusNow = { state: state, at: loadState().lastSyncAt, error: error || null }; notify(); }

  function syncNow() {
    if (busy) return busyPromise;
    if (!canSync()) { setStatus('idle'); return Promise.resolve({ ok: false, reason: 'not-enabled' }); }
    busy = true; setStatus('syncing');
    var a = auth();
    busyPromise = a.token().then(function (token) {
      if (!token) throw new Error('no session');
      var uid = a.userId();
      var st = loadState();
      if (st.userId && st.userId !== uid) { st = { v: 1, userId: uid, shadow: snapshot(), tombstones: st.tombstones || {}, pulledSeq: null, pushedAt: null, profilePulledAt: null, profileDirty: false, lastSyncAt: st.lastSyncAt || null }; }
      if (!st.userId) { st.userId = uid; st.shadow = snapshot(); if (S.list(null).length || (S.profile().name || '').trim() || S.profile().lifeStage) st.profileDirty = true; }
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
      return pre.then(function () { return pullSince(st.pulledSeq, token); }).then(function (remoteRows) {
        /* consent or sign-in may have changed during the network wait */
        if (!canSync() || a.userId() !== uid) { busy = false; setStatus('idle'); return { ok: false, reason: 'cancelled' }; }
        var pushedAt = loadState().pushedAt || '';
        var plan = merge(S.list(null), loadState().tombstones || {}, remoteRows, pushedAt);
        /* serialise what we push NOW: an edit made to the same event during the
           upload must not move the watermark to an unsent time (pushUp holds live
           event references), or that edit would never be backed up. */
        var upRows = plan.pushUp.map(function (ev) { return evToRow(ev, uid); });
        if (plan.applyPut.length || plan.applyDel.length) S.applyRemote(plan.applyPut.map(function (r) { return keepLocalPhotos(rowToEvent(r)); }), plan.applyDel);
        var step = Promise.resolve();
        if (upRows.length) {
          step = step.then(function () { return rest('POST', '/entries?on_conflict=user_id,id', upRows, 'resolution=merge-duplicates,return=minimal', token); });
        }
        plan.pushDel.forEach(function (d) {
          step = step.then(function () { return rest('PATCH', '/entries?id=eq.' + encodeURIComponent(d.id) + '&user_id=eq.' + uid, { deleted: true, deleted_at: d.deleted_at, updated_at: d.deleted_at }, 'return=minimal', token); });
        });
        return step.then(function () {
          var seqMax = remoteRows.reduce(function (m, r) { return maxIso(m, r.synced_at); }, '');
          var upMax = upRows.reduce(function (m, r) { return maxIso(m, r.updated_at); }, '');
          var delMax = plan.pushDel.reduce(function (m, d) { return maxIso(m, d.deleted_at); }, '');
          var remoteMax = remoteRows.reduce(function (m, r) { return maxIso(m, r.updated_at, r.deleted_at || ''); }, '');
          var settled = {};
          plan.pushDel.forEach(function (d) { settled[d.id] = 1; });
          plan.applyDel.forEach(function (id) { settled[id] = 1; });
          plan.applyPut.forEach(function (r) { settled[r.id] = 1; }); /* a restored row's old tombstone is resolved */
          remoteRows.forEach(function (r) { if (r.deleted) settled[r.id] = 1; });
          /* read-modify-write so a deletion made while this sync was in flight is kept */
          var cur = loadState(); cur.userId = uid;
          cur.pulledSeq = maxIso(cur.pulledSeq || '', seqMax) || cur.pulledSeq || null;
          cur.pushedAt = maxIso(cur.pushedAt || '', upMax, delMax, remoteMax) || cur.pushedAt || null;
          Object.keys(settled).forEach(function (id) { delete cur.tombstones[id]; });
          cur.shadow = snapshot();
          saveState(cur);
          return syncProfile(token, uid).then(function () {
            var s2 = loadState(); s2.lastSyncAt = nowIso(); saveState(s2);
            busy = false; setStatus('ok');
            return { ok: true, pulled: remoteRows.length, pushed: plan.pushUp.length + plan.pushDel.length };
          });
        });
      });
    }).catch(function (err) {
      busy = false; setStatus('error', (err && err.message) || String(err));
      /* the account says backup is off (turned off on another phone): this phone adopts it and stops */
      if (err && /Cloud backup is off for this account/i.test(err.message || '') && root.OvuConsent && OvuConsent.allows('cloud_sync')) { try { OvuConsent.record('cloud_sync', 'withdraw', 'server', { sent: true }); } catch (e2) { } setStatus('idle'); }
      return { ok: false, error: (err && err.message) || String(err) };
    });
    return busyPromise;
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

  function syncProfile(token, uid) {
    var first = loadState().profilePulledAt == null;
    return rest('GET', '/profiles?select=*&user_id=eq.' + uid, null, null, token).then(function (rows) {
      if (!canSync() || liveUid() !== uid) return; /* consent or sign-in changed during the GET */
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
        return rest('POST', '/profiles?on_conflict=user_id', { user_id: uid, display_name: (S.profile().name || '').slice(0, 80) || null, profile: JSON.parse(snapSent), updated_at: sent }, 'resolution=merge-duplicates,return=minimal', token).then(function () {
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
    var st = loadState();
    saveState({ v: 1, userId: null, shadow: snapshot(), tombstones: st.tombstones || {}, pulledSeq: null, pushedAt: null, profilePulledAt: null, profileDirty: false, lastSyncAt: null });
    setStatus('idle');
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
    status: function () { var st = loadState(); return { state: statusNow.state, error: statusNow.error, lastSyncAt: st.lastSyncAt, pending: Object.keys(st.tombstones || {}).length }; },
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    /* pure helpers, exported for the tests */
    merge: merge, stripThumbs: stripThumbs, evToRow: evToRow, rowToEvent: rowToEvent, profileForCloud: profileForCloud
  };
})(window);
