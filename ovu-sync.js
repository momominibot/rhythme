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
 * Pull is incremental (rows that reached the server after the last one we pulled),
 * so wiping this phone and reloading does not re-download the whole cloud; only a
 * brand-new install (no cursor) restores the full diary. Rows come by the id of
 * the transaction that wrote them (sync_xid, id), and only once every lower one has
 * ended, so a long upload that commits late can never land behind the cursor. This
 * version never pulls by synced_at: on a server without entries_pull
 * (20261020120000_sync_pull_commit_order.sql not applied) the sync pauses. */
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
  /* set when a newer version of the app has taken over this page (watchUpdates): this page never syncs again */
  var retired = false;
  /* what the person reads when the server has no entries_pull (Jamie, 20 Oct, R5-B: no pull by time in this version) */
  var PULL_PAUSED = 'Cloud backup is paused until the cloud is updated again. Everything stays safe on this phone.';

  /* ---------- sync position (one object in localStorage) ---------- */
  function loadState() {
    try { var s = JSON.parse(localStorage.getItem(LS) || 'null'); if (s && s.v === 1) { s.shadow = s.shadow || {}; s.tombstones = s.tombstones || {}; return s; } } catch (e) { }
    /* pulledXid, pulledXidId: the transaction-ordered pull's cursor, the last row it saw (its transaction id as text, and
       its id), or the fence with no id once a page came back short. pullSince: { at, id, snap }, a hand-over in progress
       from the older time cursor, with the snapshot it began with.
       pulledSeq, pulledId: the time cursor older versions pull by (synced_at exactly as the server wrote it, and that
       row's id). This version never pulls by it: a hand-over starts from it, and each pull moves it to the server's
       time_safe for a tab still on an older version; pulledSeq without pulledId is an older version's millisecond
       cursor.
       pushedAt: the newest local updatedAt we have pushed, so unchanged rows are not re-sent. */
    return { v: 1, gen: 0, userId: null, shadow: {}, tombstones: {}, pulledXid: null, pulledXidId: null, pulledSeq: null, pulledId: null, pushedAt: null, profilePulledAt: null, profileDirty: false, lastSyncAt: null };
  }
  /* gen: bumped by every reset and every account switch. A sync captures it when it starts and checks it, with the
     account, before each request and before every write, so a sync that a sign-out or a switch overtook can never
     write its account's progress into the new state (Codex pre-merge review, 20 Oct, blocker 2). */
  function genOf(s) { return Number(s && s.gen) || 0; }
  function saveState(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) { } }
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
   * row older than syncedAt with no remote change is left alone (not re-pushed).
   * acked: { id: updated_at } of cloud revisions this phone applied after a pull that was saved before its uploads
   * finished. A local row still exactly that revision is the cloud's own copy, not an edit made here, so it is never
   * pushed back up (Codex round five, finding 2). */
  function merge(localEvents, tombstones, remoteRows, syncedAt, acked) {
    syncedAt = syncedAt || '';
    tombstones = tombstones || {};
    acked = acked || {};
    function mine(id, t) { return ts(t) > ts(syncedAt) && !(acked[id] != null && ts(acked[id]) === ts(t)); }
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
          if (local.kind === 'live') { if (mine(id, local.t)) pushUp.push(local.ev); } else pushDel.push({ id: id, deleted_at: local.t });
        }
      } else if (remote && !local) {
        if (remote.kind === 'live') applyPut.push(remote.row);
      } else if (local && !remote) {
        if (local.kind === 'live') { if (mine(id, local.t)) pushUp.push(local.ev); } else pushDel.push({ id: id, deleted_at: local.t });
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
  function liveUid() { var s = session(); return s && s.user ? s.user.id : null; }
  /* Cloud consent is tied to the account that gave it: after signing out and
     into a different account, nothing syncs until that account also opts in, so
     one person's diary is never uploaded under another person's account. */
  function consentForUser(p, uid) { var c = (p || {}).cloud; return consentOk(p) && c.uid === uid; }
  /* nothing moves without a session, the cloud choice for this account, the 18+ attestation and the current notice (ovu-consent.js) */
  function doorOpen() { var C = root.OvuConsent; return !C || (!C.needsSheet() && C.allows('cloud_sync')); }
  function canSync() { var s = session(); return !retired && !!(s && s.user && consentForUser(S.profile(), s.user.id) && doorOpen()); }

  /* ---------- REST ---------- */
  function rest(method, path, body, prefer, token) {
    var h = { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    if (prefer) h.Prefer = prefer;
    return fetch(CFG.supabaseUrl + '/rest/v1' + path, { method: method, headers: h, body: body != null ? JSON.stringify(body) : undefined }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
        if (!r.ok) { var err = new Error('rest ' + r.status + (j && j.message ? ' ' + j.message : '')); err.status = r.status; err.code = (j && j.code) || null; throw err; }
        return j;
      });
    });
  }

  /* A transaction id (xid8) as the server writes it: decimal, no leading zeros. Kept as text and compared by length,
     then digit by digit, because it can be larger than a JavaScript number holds exactly. */
  function isXid(v) { return typeof v === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(v); }
  function xidCmp(a, b) { return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0); }
  /* A snapshot as the server writes it ('xmin:xmax:xip_list', transaction ids in text); returns its xmax, or null. */
  function snapXmax(v) { var m = typeof v === 'string' && v.length < 65536 ? /^(0|[1-9][0-9]{0,19}):(0|[1-9][0-9]{0,19}):((0|[1-9][0-9]{0,19})(,(0|[1-9][0-9]{0,19}))*)?$/.exec(v) : null; return m ? m[2] : null; }
  /* the server has no entries_pull (20261020120000_sync_pull_commit_order.sql not applied): PostgREST answers PGRST202 */
  function rpcMissing(err) { return !!err && err.status === 404 && err.code === 'PGRST202'; }
  /* The transaction-ordered pull. Rows come in (sync_xid, id) order, and only from transactions that have all ended:
     the server cuts every page at a fence, the lowest transaction id still running, and any later write gets a higher
     id. So a long upload that started before a short one and commits after it can never land behind the cursor; its
     rows wait for the next page or the next sync instead. (This is transaction id order, not commit order: a lower id
     that commits later still comes first, once final.) When a page comes back short, everything below the fence has
     been seen, and the cursor moves up to the fence itself (id null: from that transaction id on). One upload is one
     transaction id, so ids tell its rows apart and a page or the 20,000 cap can split it without skipping or fetching
     again any of it.
     `hand` is the hand-over from an older version's time cursor: { at, id, snap }. The server applies that cursor only
     to rows whose transaction had ended when the hand-over began (the snapshot `snap`, which the first page returns),
     so nothing the older version pulled comes again (rows cleared from this phone on purpose stay cleared), and a write
     still open at that moment arrives once it ends. It is kept until the cursor reaches the snapshot's xmax, beyond
     which no row can be one the older version saw.
     Every page also returns `time_safe`, a forward-only (synced_at, id) position kept for a tab still on an older
     version. From this page's view it is the latest point before which every visible row has reached this phone or was
     covered by the hand-over (the server's own collation, so ties on one instant; bounded by the earliest row still to
     come: backlog past the cap, rows held behind the fence). But it never goes back past `time`, the time cursor this
     sync started from, so a row that became visible behind an earlier position can stay behind it: a compatibility
     cursor with known gaps, not a fresh guarantee. The time cursor follows it only for that older tab, which can pull
     by nothing else; that tab's
     weaker guarantee is in docs/design/2026-10-20-sync-commit-order.md (premortem 5). */
  function pullCommitted(xid, id, hand, time, token, onHand) {
    var PAGE = 1000, all = [], cur = { xid: xid || null, id: xid && id != null ? id : null }, timeSafe = null;
    function page() {
      return rest('POST', '/rpc/entries_pull', { p_after_xid: cur.xid, p_after_id: cur.id, p_since: hand ? hand.at : null, p_since_id: hand && hand.id != null ? hand.id : null, p_handover: hand ? hand.snap || null : null, p_time_at: time ? time.at : null, p_time_id: time && time.id != null ? time.id : null, p_limit: PAGE }, null, token).then(function (res) {
        var rows = res && res.rows, ts = res ? res.time_safe : undefined;
        if (!Array.isArray(rows) || !isXid(res.fence) || !rows.every(function (r) { return r && isXid(r.sync_xid) && xidCmp(r.sync_xid, res.fence) < 0; })
          || !(ts === null || (ts && micros(ts.at) >= 0 && (ts.id === null || typeof ts.id === 'string')))
          || (hand && !hand.snap && !snapXmax(res.snapshot))) throw new Error('The cloud sent a pull reply this version does not understand.');
        if (hand && !hand.snap) { /* the hand-over begins with this page's view, saved at once so a retry after a failed page or upload keeps it (Codex round five, finding 1) */
          hand = { at: hand.at, id: hand.id, snap: res.snapshot };
          if (onHand) onHand(hand);
        }
        all = all.concat(rows); timeSafe = ts;
        if (rows.length) { var last = rows[rows.length - 1]; cur = { xid: last.sync_xid, id: last.id }; }
        if (rows.length === PAGE && all.length < 20000) return page();
        if (rows.length < PAGE && (!cur.xid || xidCmp(res.fence, cur.xid) > 0)) cur = { xid: res.fence, id: null };
        if (hand && cur.xid && xidCmp(cur.xid, snapXmax(hand.snap)) >= 0) hand = null; /* past every row the older version could have seen */
        return { rows: all, xid: cur.xid, id: cur.id, hand: hand, timeSafe: timeSafe };
      });
    }
    return page();
  }
  /* Is transaction-ordered cursor `a` strictly later than the stored one? (x, no id) means "from transaction x on", so it
     sits before any (x, id). Two different ids under one transaction id are a tie, which keeps the stored one: the
     server's collation orders ids, not this phone. */
  function xidLater(a, c) {
    if (!c.pulledXid) return true;
    var k = xidCmp(a.xid, c.pulledXid);
    return k > 0 || (k === 0 && a.id != null && c.pulledXidId == null);
  }
  /* The shared pull, always by transaction id (Jamie, 20 Oct, R5-B). A server without entries_pull pauses the sync:
     this version has no pull by time to fall back on, because rows received out of time order cannot be described by
     one time cursor without either skipping some or sending others again (Codex rounds three and four). */
  function pullShared(st, token, onHand) {
    var x = isXid(st.pulledXid) ? st.pulledXid : null;
    /* a hand-over in progress (pullSince, with the snapshot its first page returned) carries on, also when no
       transaction cursor was saved yet; a phone with only the older time cursor starts one from it */
    var ps = st.pullSince, saved = ps && ps.at && snapXmax(ps.snap) ? { at: ps.at, id: ps.id != null ? ps.id : null, snap: ps.snap } : null;
    var hand = saved || (!x && st.pulledSeq ? { at: st.pulledSeq, id: st.pulledId != null ? st.pulledId : null, snap: null } : null);
    var time = st.pulledSeq ? { at: st.pulledSeq, id: st.pulledId != null ? st.pulledId : null } : null;
    return pullCommitted(x, x ? st.pulledXidId : null, hand, time, token, onHand).catch(function (err) {
      if (rpcMissing(err)) throw new Error(PULL_PAUSED);
      throw err;
    });
  }

  /* The one-time recovery of newly known types walks every row of those types in id order, resuming after the last id
     it saw (keyset paging). Ids are unique, so rows that share a synced_at (one upload is stamped with one now()) can
     neither be skipped nor fetched forever, and no timestamp rounding is involved. At most 20,000 rows a sync;
     `done` is true only when a page came back short, meaning the scan reached the end. */
  function pullTypedAfter(afterId, token, types) {
    var PAGE = 1000, all = [], last = afterId || null;
    var base = '/entries?select=*&type=in.(' + types.map(encodeURIComponent).join(',') + ')&order=id.asc&limit=' + PAGE;
    function page() {
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

  /* one sync at a time across every tab of this browser (Web Locks); where the browser has none, this tab's own busy flag
     and the generation checks below still keep a stale sync from writing (Codex pre-merge review, 20 Oct, item 3) */
  function withLock(fn) {
    try { if (root.navigator && root.navigator.locks && typeof root.navigator.locks.request === 'function') return root.navigator.locks.request('ovumind-sync', function () { return fn(); }); } catch (e) { }
    return fn();
  }
  var CANCELLED = { cancelled: true };
  /* A newer version of the app took over this page's service worker (sw.js skips waiting and claims every open page):
     the code running here is now older than the code beside it, so this page stops syncing at once (a sync in flight is
     cancelled at its next check) and reloads once it is out of sight AND nothing is unfinished (canReload, the room's
     test: no sheet or form open, no activity holding the HUD, no session, practice or podcast running). Hidden alone is
     not enough: a half-filled form would be lost (Codex round four). Until then it waits, and checks again each time
     she leaves, a moment after the other hide handlers (Breath Tap and Light Flower save when the app is hidden).
     The first install also claims the page, and that is not an update. A page can also start with no controller after
     a force refresh while a worker is already active; then its first takeover is an update. So a takeover counts as an
     update when the page had a controller at load, or this browser has seen a controlling worker before (a flag kept
     from earlier loads), or the registration lookup started at load finds an active worker; a takeover that comes
     before that lookup answers waits for it (Codex round five, finding 3). The listener is armed at load, before the
     room boots, so an early takeover is not missed. */
  var SW_SEEN = 'ovumind_sw_seen_v1';
  var upd = { armed: false, had: false, looking: false, deferred: false, seen: false, reloading: false, onUpdate: null, canReload: null };
  function retire() { retired = true; clearTimeout(debounceTimer); setStatus('idle'); }
  function swSeen() { try { return localStorage.getItem(SW_SEEN) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SW_SEEN, '1'); } catch (e) { } }
  function tryReload() {
    var doc = root.document;
    if (!upd.seen || upd.reloading || !upd.canReload || (doc && !doc.hidden)) return;
    var ok = false; try { ok = !!upd.canReload(); } catch (e) { ok = false; }
    if (ok) { upd.reloading = true; try { root.location.reload(); } catch (e) { upd.reloading = false; } }
  }
  function takeover() {
    if (upd.seen) return;
    upd.seen = true; retire();
    if (upd.onUpdate) { try { upd.onUpdate(); } catch (e) { } }
    tryReload();
  }
  function armUpdates() {
    var sw = root.navigator && root.navigator.serviceWorker;
    if (upd.armed || !sw || typeof sw.addEventListener !== 'function') return upd.armed;
    upd.armed = true; upd.had = !!sw.controller || swSeen();
    if (sw.controller) markSeen();
    if (!upd.had && typeof sw.getRegistration === 'function') {
      upd.looking = true;
      var settle = function (active) {
        upd.looking = false;
        if (active) upd.had = true;
        if (upd.deferred) { upd.deferred = false; if (active) takeover(); else upd.had = true; }
      };
      try { Promise.resolve(sw.getRegistration()).then(function (reg) { settle(!!(reg && reg.active)); }, function () { settle(false); }); } catch (e) { settle(false); }
    }
    sw.addEventListener('controllerchange', function () {
      markSeen();
      if (!upd.had) { if (upd.looking) upd.deferred = true; else upd.had = true; return; }
      takeover();
    });
    var doc = root.document;
    if (doc && typeof doc.addEventListener === 'function') doc.addEventListener('visibilitychange', function () { if (doc.hidden && upd.seen) setTimeout(tryReload, 0); });
    return true;
  }
  /* the room hands over its note (onUpdate) and its own "nothing unfinished" test (canReload); an update seen before
     then still gets its note, and the page reloads only once the room has said it is safe */
  function watchUpdates(onUpdate, canReload) {
    var on = armUpdates();
    upd.onUpdate = typeof onUpdate === 'function' ? onUpdate : null;
    upd.canReload = typeof canReload === 'function' ? canReload : null;
    if (upd.seen) { if (upd.onUpdate) { try { upd.onUpdate(); } catch (e) { } } tryReload(); }
    return on;
  }
  /* a retired page answers why it does not sync, in words */
  var UPDATE_READY = 'A new version of Rhythme is ready. It opens once you finish what you are doing and leave the app.';
  function syncNow() {
    if (retired) return Promise.resolve({ ok: false, reason: 'update', error: UPDATE_READY });
    if (busy) return busyPromise;
    if (!canSync()) { setStatus('idle'); return Promise.resolve({ ok: false, reason: 'not-enabled' }); }
    busy = true; setStatus('syncing');
    var a = auth();
    busyPromise = withLock(function () { return runSync(a); }).then(function (r) { busy = false; return r; }, function (err) { busy = false; throw err; });
    return busyPromise;
  }
  function runSync(a) {
    if (!canSync()) { setStatus('idle'); return Promise.resolve({ ok: false, reason: 'not-enabled' }); } /* another tab may have changed things while this one waited for the lock */
    return a.token().then(function (token) {
      if (!token) throw new Error('no session');
      var uid = a.userId();
      var st = loadState();
      /* a switch to another account, or the first sync after a reset: every position field starts clean and the
         generation moves on, so nothing still in flight from before can land in it */
      if (st.userId && st.userId !== uid) { st = { v: 1, gen: genOf(st) + 1, userId: uid, shadow: snapshot(), tombstones: st.tombstones || {}, pulledXid: null, pulledXidId: null, pulledSeq: null, pulledId: null, pushedAt: null, profilePulledAt: null, profileDirty: false, lastSyncAt: st.lastSyncAt || null }; }
      if (!st.userId) { st.gen = genOf(st) + 1; st.userId = uid; st.shadow = snapshot(); st.pulledXid = null; st.pulledXidId = null; delete st.pullSince; delete st.acked; st.pulledSeq = null; st.pulledId = null; st.pushedAt = null; st.profilePulledAt = null; delete st.typedAfter; delete st.types; delete st.held; st.profileDirty = !!(S.list(null).length || (S.profile().name || '').trim() || S.profile().lifeStage); }
      var gen0 = genOf(st);
      /* still the same account, the same generation, signed in as it, and allowed to sync */
      function alive() { var c = loadState(); return genOf(c) === gen0 && c.userId === uid && a.userId() === uid && canSync(); }
      function stillAlive() { if (!alive()) throw CANCELLED; }
      /* An older app version drops rows of types it does not know, while its pull cursor moves past them. When this
         version knows types the cursor was built without (Movement added 'exercise'), pull those types once from the
         start. Only the new types: a full re-pull would bring back older entries someone deliberately cleared. */
      var knownTypes = (S.TYPES || []).join(','), before = st.types ? st.types.split(',') : Object.keys(CLOUD_TYPES_V1);
      var newTypes = st.pulledSeq || st.pulledXid ? (S.TYPES || []).filter(function (t) { return before.indexOf(t) < 0; }) : [];
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
      /* pull every row that reached the server after our cursor, in order and in pages, so a late-arriving older edit
         is never skipped */
      /* the first page of a hand-over saves its snapshot straight away, unless another tab already moved on */
      function onHand(h) {
        var c = loadState();
        if (c.userId !== uid || genOf(c) !== gen0 || isXid(c.pulledXid) || (c.pullSince && snapXmax(c.pullSince.snap))) return;
        c.pullSince = h; saveState(c);
      }
      return pre.then(function () { stillAlive(); return pullShared(st, token, onHand); }).then(function (got) {
        stillAlive();
        var rows = got.rows; incRows = rows; incEnd = got;
        if (!newTypes.length) return rows;
        return pullTypedAfter(st.typedAfter || null, token, newTypes).then(function (t) { typed = t; typedDone = t.done; return mergeRows(rows, t.rows); });
      }).then(function (remoteRows) {
        /* consent, sign-in or a reset may have changed during the network wait */
        stillAlive();
        var pushedAt = loadState().pushedAt || '';
        var plan = addHeld(merge(S.list(null), loadState().tombstones || {}, remoteRows, pushedAt, loadState().acked), loadState().held, S.get);
        /* serialise what we push NOW: an edit made to the same event during the
           upload must not move the watermark to an unsent time (pushUp holds live
           event references), or that edit would never be backed up. */
        var upRows = plan.pushUp.map(function (ev) { return evToRow(ev, uid); });
        if (plan.applyPut.length || plan.applyDel.length) S.applyRemote(plan.applyPut.map(function (r) { return keepLocalPhotos(rowToEvent(r)); }), plan.applyDel);
        var remoteMax = remoteRows.reduce(function (m, r) { return maxIso(m, r.updated_at, r.deleted_at || ''); }, '');
        checkpoint();
        /* What this pull brought is saved before any upload (Codex round five, findings 1 and 2): the cursors move, the
           hand-over keeps its snapshot, and tombstones and holds the cloud's newer copy settled are cleared. So a failed
           upload neither pulls those rows again (which could bring back one cleared from this phone in between) nor lets
           a retry start a new hand-over that would miss a write still open at the first one. Rows now on this phone
           exactly as the cloud has them go in `acked`, so a retry does not push them back up as if they were new here;
           with nothing to upload, the push watermark moves past them instead. */
        function checkpoint() {
          var cur = loadState();
          if (cur.userId !== uid || genOf(cur) !== gen0 || a.userId() !== uid) throw CANCELLED;
          /* the shared cursor moves to where this pull ended (never past a typed-recovery row), and only forward. If
             another tab moved it while this sync ran, ours is written only when it is strictly later: a cursor wound
             back would pull again rows this phone may have cleared since. It can move with no rows (up to the fence);
             a hand-over still in progress travels with it (Codex round one, finding 2). */
          var movedX = (cur.pulledXid || null) !== (st.pulledXid || null) || (cur.pulledXidId || null) !== (st.pulledXidId || null);
          if (incEnd.xid && (!movedX || xidLater(incEnd, cur))) {
            cur.pulledXid = incEnd.xid; cur.pulledXidId = incEnd.id;
            if (incEnd.hand) cur.pullSince = incEnd.hand; else delete cur.pullSince;
          }
          /* the time cursor, for a tab still on an older version, follows the server's time_safe (Codex rounds one and
             two). The server already kept it from going back past the one this sync started from; if another tab or an
             older version moved it meanwhile, ours is written only when it is later by instant (a tie keeps the stored
             one: ids are ordered by the server's collation, not this phone's) */
          var tsafe = incEnd.timeSafe, movedT = (cur.pulledSeq || null) !== (st.pulledSeq || null) || (cur.pulledId || null) !== (st.pulledId || null);
          if (tsafe && (!movedT || !cur.pulledSeq || micros(tsafe.at) > micros(cur.pulledSeq))) { cur.pulledSeq = tsafe.at; cur.pulledId = tsafe.id; }
          if (typedDone) { cur.types = knownTypes; delete cur.typedAfter; }
          else if (typed && typed.lastId) cur.typedAfter = typed.lastId;
          var push = {}; plan.pushDel.forEach(function (d) { push[d.id] = 1; });
          plan.applyDel.forEach(function (id) { delete cur.tombstones[id]; });
          plan.applyPut.forEach(function (r) { delete cur.tombstones[r.id]; });
          remoteRows.forEach(function (r) { if (r.deleted && !push[r.id]) delete cur.tombstones[r.id]; });
          var held = cur.held || {};
          plan.applyPut.forEach(function (r) { delete held[r.id]; });
          plan.applyDel.forEach(function (id) { delete held[id]; });
          cur.held = held;
          if (!plan.pushUp.length && !plan.pushDel.length) cur.pushedAt = maxIso(cur.pushedAt || '', remoteMax) || cur.pushedAt || null;
          else {
            var acked = cur.acked || {}, wm = ts(cur.pushedAt || '');
            remoteRows.forEach(function (r) {
              if (r.deleted) { delete acked[r.id]; return; }
              var ev = S.get(r.id);
              if (ev && ts(ev.updatedAt) === ts(r.updated_at) && ts(r.updated_at) > wm) acked[r.id] = r.updated_at;
            });
            cur.acked = acked;
          }
          saveState(cur);
        }
        var step = Promise.resolve(), pushedRows = upRows, heldRows = [];
        function post(rows) { stillAlive(); return rest('POST', '/entries?on_conflict=user_id,id', rows, 'resolution=merge-duplicates,return=minimal', token); }
        if (upRows.length) {
          step = step.then(function () {
            return post(upRows).catch(function (err) {
              if (!typeRejected(err)) throw err;
              var sp = splitByType(upRows); if (!sp.held.length) throw err;
              pushedRows = sp.ok; heldRows = sp.held;
              return sp.ok.length ? post(sp.ok) : null;
            });
          });
        }
        plan.pushDel.forEach(function (d) {
          step = step.then(function () { stillAlive(); return rest('PATCH', '/entries?id=eq.' + encodeURIComponent(d.id) + '&user_id=eq.' + uid, { deleted: true, deleted_at: d.deleted_at, updated_at: d.deleted_at, data: {} }, 'return=minimal', token); });
        });
        return step.then(function () {
          var upMax = pushedRows.reduce(function (m, r) { return maxIso(m, r.updated_at); }, ''); /* held rows did not go up */
          var delMax = plan.pushDel.reduce(function (m, d) { return maxIso(m, d.deleted_at); }, '');
          var settled = {};
          plan.pushDel.forEach(function (d) { settled[d.id] = 1; });
          plan.applyDel.forEach(function (id) { settled[id] = 1; });
          plan.applyPut.forEach(function (r) { settled[r.id] = 1; }); /* a restored row's old tombstone is resolved */
          remoteRows.forEach(function (r) { if (r.deleted) settled[r.id] = 1; });
          /* read-modify-write so a deletion made while this sync was in flight is kept */
          var cur = loadState();
          /* a sign-out, an account switch or a reset of the position during the upload cleared it: leave it cleared,
             rather than write this account and its progress back into it */
          if (cur.userId !== uid || genOf(cur) !== gen0 || a.userId() !== uid) throw CANCELLED;
          /* the cursors were saved before the uploads (checkpoint above); the push watermark moves now, and the ledger
             keeps only cloud revisions it does not cover that are still on this phone unchanged */
          cur.pushedAt = maxIso(cur.pushedAt || '', upMax, delMax, remoteMax) || cur.pushedAt || null;
          if (cur.acked) {
            var wm2 = ts(cur.pushedAt || '');
            Object.keys(cur.acked).forEach(function (id) { var ev = S.get(id), v = cur.acked[id]; if (ts(v) <= wm2 || !ev || ts(ev.updatedAt) !== ts(v)) delete cur.acked[id]; });
            if (!Object.keys(cur.acked).length) delete cur.acked;
          }
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
          return syncProfile(token, uid, alive).then(function () {
            stillAlive();
            var s2 = loadState(); s2.lastSyncAt = nowIso(); saveState(s2);
            setStatus('ok');
            return { ok: true, pulled: remoteRows.length, pushed: pushedRows.length + plan.pushDel.length, held: Object.keys(loadState().held || {}).length }; /* every row still waiting, not only this request's refusals */
          });
        });
      });
    }).catch(function (err) {
      if (err === CANCELLED) { setStatus('idle'); return { ok: false, reason: 'cancelled' }; }
      setStatus('error', (err && err.message) || String(err));
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

  function syncProfile(token, uid, alive) {
    alive = alive || function () { return canSync() && liveUid() === uid; };
    if (!alive()) return Promise.resolve();
    var first = loadState().profilePulledAt == null;
    return rest('GET', '/profiles?select=*&user_id=eq.' + uid, null, null, token).then(function (rows) {
      if (!alive()) return; /* consent, sign-in or a reset changed during the GET */
      var st = loadState(); /* re-read: a profile edit may have happened during the GET */
      var remote = rows && rows[0];
      /* On the first sync for this account, the cloud copy wins: a new phone
         restores it, and turning on backup (which marks the profile "dirty")
         must not overwrite real history with this phone's empty defaults.
         After that, a genuine local edit (dirty) is pushed; otherwise a newer
         remote is pulled. */
      if (remote && (first || (!st.profileDirty && ts(remote.updated_at) > ts(st.profilePulledAt)))) {
        var incoming = profileForCloud(remote.profile || {});
        if (!alive()) return;
        if (Object.keys(incoming).length) S.setProfile(incoming); /* keeps local consent + cloud */
        var sp = loadState(); sp.profilePulledAt = maxIso(remote.updated_at); sp.profileDirty = false; saveState(sp);
        return;
      }
      if (st.profileDirty || (first && !remote)) {
        var sent = nowIso(), snapSent = JSON.stringify(profileForCloud(S.profile()));
        return rest('POST', '/profiles?on_conflict=user_id', { user_id: uid, display_name: (S.profile().name || '').slice(0, 80) || null, profile: JSON.parse(snapSent), updated_at: sent }, 'resolution=merge-duplicates,return=minimal', token).then(function () {
          /* a reset or a switch during the upload: its completion must not mark the new state as already restored, or
             the next account would skip its own first restore and upload this profile over its cloud copy */
          if (!alive()) return;
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
    saveState({ v: 1, gen: genOf(st) + 1, userId: null, shadow: snapshot(), tombstones: st.tombstones || {}, pulledXid: null, pulledXidId: null, pulledSeq: null, pulledId: null, pushedAt: null, profilePulledAt: null, profileDirty: false, lastSyncAt: null });
    setStatus('idle');
  }

  armUpdates(); /* at load, before the room registers the worker or boots (premortem 8) */

  function init() {
    if (!S) return;
    S.subscribe(onStoreChange);
    var st = loadState(); if (!st.shadow || !Object.keys(st.shadow).length) { st.shadow = snapshot(); saveState(st); }
    if (canSync()) scheduleSync();
  }

  root.OvuSync = {
    watchUpdates: watchUpdates,
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
    merge: merge, stripThumbs: stripThumbs, evToRow: evToRow, rowToEvent: rowToEvent, profileForCloud: profileForCloud, addHeld: addHeld, splitByType: splitByType, typeRejected: typeRejected, mergeRows: mergeRows, xidCmp: xidCmp, isXid: isXid, snapXmax: snapXmax
  };
})(window);
