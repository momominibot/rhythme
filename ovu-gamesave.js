/* Game save (Jamie, 22 Oct 2026: "about the hearts lost, we need login to save"). Hearts, the farm, the bag, the greenhouse,
 * the villagers, the home and the pets lived only on this phone, so a new phone or a cleared browser lost them. This saves
 * that game progress to the signed-in account. It needs only a login, never the diary cloud-backup choice, because nothing
 * in it is diary data: only game fields are saved (no Harbour Lane letters, no garden diary dates, no hearts log, no
 * diary receipts, no record of which kinds of diary entry earned today), chosen field by field in pack().
 *
 * The rule (fourth version, after three Codex reviews on 22 Oct):
 *  - The account's save is the one true copy. A phone writes only on top of the revision it last saw (game_save_put) and
 *    saves a few seconds after every game change.
 *  - When the account moved on, the phone takes the account's save whole and replays on top of it the hearts it earned
 *    that the account has not seen, from a short journal of its own awards: practice hearts again obey the day's cap of
 *    twenty and a bench or morning part already paid on another phone is not paid again; other hearts are added as they
 *    are. Its other unsaved changes (a purchase, a planting) are dropped together with what they cost.
 *  - Every write carries this phone's id and a number that only goes up; the server keeps the highest number it applied
 *    from each phone, so a write whose answer was lost is never applied twice, however much later it is sent again.
 *    Tabs take turns (a browser lock) and acknowledge a write once.
 *  - Today's practice caps (practice hearts, benches, morning parts) are part of the save, so they hold across phones;
 *    which diary kinds earned today, the last logging day and the streak stay on the phone, and a phone that never earned
 *    here gets none of today's logging hearts a second time.
 *  - First sign-in on a phone: the account's save, plus this phone's hearts balance, earnings, treats and owned items
 *    (placed items stay as the account has them, so one-per-slot holds).
 *  - A cleared phone links again instead of uploading an empty game; a tester phone never saves and takes the account copy.
 *  - "Delete my cloud copy" marks the save deleted on the server. The server brings it back only for a sign-in made after
 *    the deletion (the sign-in time in the token), so no phone can revive it by itself. The deletion is sent with the
 *    account and token of the delete itself. */
(function (root) {
  'use strict';
  var GAME_KEYS = ['rewards', 'farm', 'greenhouse', 'villagers', 'home', 'propPos', 'pets', 'garden', 'harbour', 'lane', 'stamina', 'visited', 'game'];
  var REWARD_FIELDS = ['hearts', 'earned', 'owned', 'placed', 'treats', 'wear', 'gifts', 'mindDay', 'mindActs', 'seatDay'];
  var DAY_FIELDS = ['mindDay', 'mindActs', 'seatDay'];
  function practiceCap() { var R = root.OvuRewards; return R && R.PRACTICE && isFinite(R.PRACTICE.cap) ? R.PRACTICE.cap : 20; }
  var LOG_KINDS = { sleep: 1, period: 1, symptom: 1, food: 1, reflection: 1, exercise: 1, water: 1 };
  var META = 'ovumind_gamesave_v1', MAX_BYTES = 200000, KEEPALIVE_MAX = 60000, DEBOUNCE_MS = 4000;

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function plain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  /* a complete ledger: the shape ovu-rewards.js starts from, so every reader finds its arrays and objects */
  function ledger(r) {
    r = plain(r) ? r : {};
    r.hearts = Math.max(0, num(r.hearts)); r.earned = Math.max(0, num(r.earned));
    if (!Array.isArray(r.owned)) r.owned = []; if (!plain(r.placed)) r.placed = {};
    if (r.lastDay === undefined) r.lastDay = null; if (r.streak === undefined) r.streak = 0;
    return r;
  }
  /* only game fields leave the phone */
  function pack(state) {
    var out = {}; state = state || {};
    GAME_KEYS.forEach(function (k) {
      var v = state[k]; if (v === undefined || v === null) return;
      if (k === 'rewards') { if (!plain(v)) return; var r = {}; REWARD_FIELDS.forEach(function (f) { if (v[f] !== undefined) r[f] = clone(v[f]); }); out.rewards = r; return; }
      if (k === 'garden') { if (plain(v) && Array.isArray(v.watered)) out.garden = { watered: clone(v.watered) }; return; } /* credited is diary dates: rebuilt on the phone */
      if (k === 'lane') { if (!plain(v)) return; var l = clone(v); delete l.letters; out.lane = l; return; }               /* her letters stay on this phone */
      out[k] = clone(v);
    });
    return out;
  }
  function earned(save) { return num(save && save.rewards && save.rewards.earned); }
  /* the account's save, plus hearts this phone earned that the account has not seen (never less than nothing) */
  function withEarnings(remote, gain) {
    var out = clone(remote) || {}; gain = Math.max(0, num(gain)); if (!gain) return out;
    var r = out.rewards = ledger(out.rewards);
    r.hearts += gain; r.earned += gain;
    return out;
  }
  /* first sign-in: the account's save, plus the hearts balance, earnings, treats and items this phone gathered before */
  function linkMerge(local, remote) {
    var out = clone(remote) || {}, lr = local && local.rewards;
    if (plain(lr)) {
      var r = out.rewards = ledger(out.rewards);
      r.hearts += Math.max(0, num(lr.hearts)); r.earned += Math.max(0, num(lr.earned));
      (Array.isArray(lr.owned) ? lr.owned : []).forEach(function (id) { if (r.owned.indexOf(id) < 0) r.owned.push(id); });
      if (plain(lr.treats)) { r.treats = plain(r.treats) ? r.treats : {}; Object.keys(lr.treats).forEach(function (k) { r.treats[k] = num(r.treats[k]) + Math.max(0, num(lr.treats[k])); }); }
      if (plain(lr.wear)) { r.wear = plain(r.wear) ? r.wear : {}; Object.keys(lr.wear).forEach(function (k) { var used = Object.keys(r.wear).map(function (j) { return JSON.stringify(r.wear[j]); }); if (!(k in r.wear) && used.indexOf(JSON.stringify(lr.wear[k])) < 0) r.wear[k] = clone(lr.wear[k]); }); } /* one accessory, one wearer */
    }
    return out;
  }
  /* two records of the same day's caps join (a seat or practice paid on either phone stays paid); a newer day wins */
  function mergeDay(a, b) {
    if (!plain(a)) return clone(b); if (!plain(b)) return clone(a);
    if (a.day !== b.day) return clone(String(a.day) > String(b.day) ? a : b);
    var out = clone(a);
    Object.keys(b).forEach(function (k) {
      if (k === 'day') return;
      if (typeof b[k] === 'number') out[k] = Math.max(num(out[k]), b[k]);
      else if (plain(b[k])) { out[k] = plain(out[k]) ? out[k] : {}; Object.keys(b[k]).forEach(function (j) { var x = b[k][j]; out[k][j] = typeof x === 'number' ? Math.max(num(out[k][j]), x) : (out[k][j] || x); }); }
    });
    return out;
  }
  /* the practice caps as plain sets, to see what a change awarded */
  function caps(r) {
    r = plain(r) ? r : {};
    var md = plain(r.mindDay) ? r.mindDay : {}, sd = plain(r.seatDay) ? r.seatDay : {}, ma = plain(r.mindActs) ? r.mindActs : {};
    return { earned: num(r.earned), day: md.day || null, pts: num(md.pts), seatDay: sd.day || null, seats: Object.keys(plain(sd.seats) ? sd.seats : {}), actDay: ma.day || null, acts: Object.keys(plain(ma.acts) ? ma.acts : {}) };
  }
  /* what one change earned, as journal entries: practice hearts with the benches or morning parts they used, and the rest */
  function journalFor(prev, now) {
    var out = [], dE = now.earned - prev.earned; if (dE <= 0) return out;
    var dP = now.day && now.day === prev.day ? now.pts - prev.pts : now.pts;
    var seats = now.seats.filter(function (k) { return now.seatDay !== prev.seatDay || prev.seats.indexOf(k) < 0; });
    var acts = now.acts.filter(function (k) { return now.actDay !== prev.actDay || prev.acts.indexOf(k) < 0; });
    dP = Math.max(0, Math.min(dP, dE));
    if (dP > 0) out.push({ kind: 'mind', day: now.day, n: dP, seats: seats, acts: acts });
    if (dE - dP > 0) out.push({ kind: 'other', n: dE - dP });
    return out;
  }
  /* the account's save with this phone's unseen awards replayed on top, under the same caps */
  function replay(remote, journal) {
    var out = clone(remote) || {}; if (!journal || !journal.length) return out;
    var r = out.rewards = ledger(out.rewards), cap = practiceCap();
    journal.forEach(function (e) {
      var n = Math.max(0, num(e.n)); if (!n) return;
      if (e.kind !== 'mind') { r.hearts += n; r.earned += n; return; }
      var md = plain(r.mindDay) ? r.mindDay : null;
      if (md && md.day && e.day && String(md.day) > String(e.day)) { r.hearts += n; r.earned += n; return; } /* a past day the account no longer tracks */
      if (!md || md.day !== e.day) r.mindDay = md = { day: e.day, pts: 0 };
      if (!plain(r.seatDay) || r.seatDay.day !== e.day) r.seatDay = { day: e.day, seats: {} };
      if (!plain(r.mindActs) || r.mindActs.day !== e.day) r.mindActs = { day: e.day, acts: {} };
      if ((e.seats || []).some(function (k) { return r.seatDay.seats[k]; }) || (e.acts || []).some(function (k) { return r.mindActs.acts[k]; })) return; /* paid on another phone */
      var keep = Math.max(0, Math.min(n, cap - num(md.pts))); if (!keep) return;
      md.pts = num(md.pts) + keep; (e.seats || []).forEach(function (k) { r.seatDay.seats[k] = 1; }); (e.acts || []).forEach(function (k) { r.mindActs.acts[k] = 1; });
      r.hearts += keep; r.earned += keep;
    });
    return out;
  }
  /* what this phone's state becomes when a save arrives: the account copy taken whole for game fields; letters, garden
     diary dates and the phone-only rewards fields stay; today's game caps join; a phone that never earned here gets no
     second round of today's logging hearts */
  function applyTo(state, save, today) {
    var patch = {};
    GAME_KEYS.forEach(function (k) {
      var had = state[k], v = save ? clone(save[k]) : undefined;
      if (k === 'rewards') {
        var r = ledger(plain(v) ? v : {});
        if (plain(had)) {
          Object.keys(had).forEach(function (f) { if (REWARD_FIELDS.indexOf(f) < 0) r[f] = clone(had[f]); });
          /* today's practice caps come from the account; this phone's unsaved awards were joined by replay() */
        } else { r.log = []; r.daily = { day: today, kinds: clone(LOG_KINDS) }; r.dailyLast = today; r.moveDay = { day: today, pts: 999 }; }
        if (!Array.isArray(r.log)) r.log = [];
        patch.rewards = r; return;
      }
      if (v === undefined) {
        if (had === undefined || had === null) return;                         /* game progress the account does not have goes */
        if (k === 'garden') patch.garden = plain(had) && had.credited ? { credited: clone(had.credited), watered: [] } : null;
        else if (k === 'lane') patch.lane = plain(had) && had.letters !== undefined ? { letters: clone(had.letters) } : null;
        else patch[k] = null;
        return;
      }
      if (k === 'garden') v = Object.assign({}, plain(had) ? clone(had) : {}, { watered: Array.isArray(v.watered) ? v.watered : [] });
      if (k === 'lane' && plain(had) && had.letters !== undefined) v.letters = clone(had.letters);
      patch[k] = v;
    });
    return patch;
  }
  function hashOf(save) { var t = JSON.stringify(save), h = 5381; for (var i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36) + ':' + t.length; }
  function deviceId() {
    var all = readMeta(); if (typeof all._device === 'string' && /^[a-z0-9]{6,40}$/.test(all._device)) return all._device;
    all._device = (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^a-z0-9]/g, '').slice(0, 30);
    try { localStorage.setItem(META, JSON.stringify(all)); } catch (e) { } return all._device;
  }

  /* ---------- wiring ---------- */
  var S = root.OvuStore, A = function () { return root.OvuAuth; }, CFG = root.OVU_CONFIG || {}, timer = 0, busy = false, again = false, applying = false;
  function readMeta() { try { var m = JSON.parse(localStorage.getItem(META) || 'null'); return plain(m) ? m : {}; } catch (e) { return {}; } }
  function metaFor(uid) { return readMeta()[uid] || null; }
  function setMetaFor(uid, m) { var all = readMeta(); all[uid] = m; try { localStorage.setItem(META, JSON.stringify(all)); } catch (e) { } }
  function patchMeta(uid, p) { setMetaFor(uid, Object.assign({}, metaFor(uid) || { uid: uid }, p)); }
  function tester() { var t = S && S.state && S.state().tester; return !!(t && t.hearts); }
  function ownerOk(uid) { var p = (S && S.profile && S.profile()) || {}, o = typeof p.owner === 'string' ? p.owner : null; return !o || o === uid; }
  function ready() { var a = A(); return !!(S && a && a.isSignedIn && a.isSignedIn() && a.userId() && !(S.isSandbox && S.isSandbox()) && typeof fetch === 'function' && CFG.supabaseUrl); }
  function call(method, path, body, token) {
    return Promise.resolve(token || A().token()).then(function (tk) {
      if (!tk) throw new Error('no token');
      var text = body != null ? JSON.stringify(body) : undefined;
      return fetch(CFG.supabaseUrl + '/rest/v1' + path, { method: method, headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: text, keepalive: !!(text && text.length < KEEPALIVE_MAX) })
        .then(function (r) { return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { } if (!r.ok) { var er = new Error('game save ' + r.status); er.status = r.status; er.code = j && j.code; throw er; } return j; }); });
    });
  }
  function getRow(uid) { return call('GET', '/game_saves?select=save,rev,deleted&user_id=eq.' + encodeURIComponent(uid)).then(function (rows) { return rows && rows[0] || null; }); }
  function put(save, base, op) {
    if (JSON.stringify(save).length > MAX_BYTES) return Promise.reject(new Error('too big'));
    return call('POST', '/rpc/game_save_put', { p_save: save, p_base: base, p_op: op }).then(function (rows) { return Array.isArray(rows) ? rows[0] || null : rows; });
  }
  var homeTries = 0;
  function homeOf() { try { return root.OvuRoom && OvuRoom.homeId ? OvuRoom.homeId() : (S.state().home || 'room'); } catch (e) { return 'room'; } }
  function showHome(before) {
    try { /* the home she has now shows as soon as she is standing in the old one with nothing running (tried for a minute) */
      var R = root.OvuRoom, now = homeOf(); if (!R || now === before || !R.layout || !R.applyLayout || !R.layout()) return;
      if (R.layout().id === now) return;
      if (R.layout().id === before && !(R.busy && R.busy()) && !(R.sheetOpen && R.sheetOpen())) { R.applyLayout(now); return; }
      if (R.layout().id === before && ++homeTries < 30) setTimeout(function () { showHome(before); }, 2000);
    } catch (e) { }
  }
  /* apply a save; the award journal compares later changes with what the phone now shows */
  function apply(uid, save) {
    var before = homeOf(), patch = applyTo(S.state(), save, S.today());
    if (Object.keys(patch).length) {
      applying = true; try { (S.commit || S.setState)(patch); } finally { applying = false; }
      try { if (root.OvuRoom && OvuRoom.renderProps) OvuRoom.renderProps(); } catch (e) { }
      homeTries = 0; showHome(before);
    }
    var p = pack(S.state()); if (uid) patchMeta(uid, { snap: caps(p.rewards), hash: hashOf(p) });
  }
  function isOff(uid) { return !!(metaFor(uid) || {}).off; }
  /* send the write recorded in meta.pending (kept until the server answers, so a lost answer is resent with the same id) */
  function sendPending(uid) {
    var p = (metaFor(uid) || {}).pending; if (!p) return Promise.resolve(null);
    return put(p.save, p.base, p.op).then(function (res) {
      if (A().userId() !== uid) return 'stopped';
      if (res && res.ok) {
        /* the revision this write made is base + 1; a resend reported as already done may come back with a later one,
           which another phone wrote and this phone has not seen yet, so the next sync still takes it */
        var m = metaFor(uid) || {}, mine = num(p.base) + 1;
        if (!m.pending || m.pending.op !== p.op) return 'saved';         /* another tab already acknowledged this write */
        if (p.kind === 'link') {
          var extra = Math.max(0, earned(pack(S.state())) - num(p.localEarned)); /* hearts she earned while the link was on its way */
          apply(uid, withEarnings(p.save, extra));
          patchMeta(uid, { linked: true, off: false, tried: null, tainted: false, rev: mine, savedEarned: earned(p.save), journal: extra ? [{ id: 'l' + Date.now(), kind: 'other', n: extra }] : [], pending: null, seq: extra ? 1 : 0, acked: 0 });
          if (extra) schedule();
          return 'linked';
        }
        var carried = p.ids || [];
        patchMeta(uid, { rev: mine, savedEarned: earned(p.save), journal: (m.journal || []).filter(function (e) { return carried.indexOf(e.id) < 0; }), acked: Math.max(num(m.acked), num(p.seq)), pending: null });
        return 'saved';
      }
      patchMeta(uid, { pending: null });
      schedule(); return 'clash';                                /* the next sync takes the account's newer save */
    });
  }
  /* every new write takes the next number for this phone; a resend keeps its number */
  function queue(uid, kind, save, base, extra) {
    var m = metaFor(uid) || {}, n = num(m.wseq) + 1;
    patchMeta(uid, { wseq: n, pending: Object.assign({ kind: kind, save: save, base: base, op: deviceId() + ':' + n, ids: (m.journal || []).map(function (e) { return e.id; }) }, extra || {}) });
    return sendPending(uid);
  }
  /* a deleted save is tried once per sign-in; the server refuses unless that sign-in came after the deletion */
  function mayTry(m, row) { return !!(row && row.deleted && m && m.tried !== row.rev); }
  function sync() {
    if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) return navigator.locks.request('ovumind-gamesave', function () { return syncNow(); });
    return syncNow();
  }
  function syncNow() {
    if (!ready()) return Promise.resolve('off');
    var uid = A().userId(); if (!ownerOk(uid)) return Promise.resolve('owner');
    if (tester()) { patchMeta(uid, { tainted: true }); return Promise.resolve('tester'); }
    if (isOff(uid) && (metaFor(uid) || {}).tried != null) return Promise.resolve('deleted');
    if (busy) { again = true; return Promise.resolve('busy'); }
    busy = true;
    return sendPending(uid).then(function () { return getRow(uid); }).then(function (row) {
      if (A().userId() !== uid) return 'stopped';
      var m = metaFor(uid) || { uid: uid }, seq = num(m.seq), dirty = seq > num(m.acked), mine = pack(S.state()), journal = m.journal || [];
      var live = row && !row.deleted && row.rev > 0;
      if (row && row.deleted && !mayTry(m, row)) { patchMeta(uid, { off: true }); return 'deleted'; }
      if (m.off && !(row && row.deleted)) { patchMeta(uid, { off: false, linked: false }); m = metaFor(uid); } /* revived elsewhere after a later sign-in: link to it */
      if (row && row.deleted) patchMeta(uid, { tried: row.rev, off: true });
      if (!m.linked || m.off || (row && row.deleted)) {
        if (m.tainted && !live) return 'tester';                    /* tester progress is never uploaded */
        var target = live ? (m.tainted ? clone(row.save) : linkMerge(mine, row.save)) : mine;
        return queue(uid, 'link', target, row ? row.rev : 0, { localEarned: earned(mine) });
      }
      if (!row) return queue(uid, 'save', mine, 0, { seq: seq });
      if (m.tainted) { apply(uid, row.save); patchMeta(uid, { tainted: false, rev: row.rev, savedEarned: earned(row.save), journal: [], acked: seq }); return 'pulled'; }
      if (row.rev > num(m.rev)) {
        apply(uid, replay(row.save, journal));
        if (journal.length) return queue(uid, 'save', pack(S.state()), row.rev, { seq: seq }); /* the replayed awards and joined caps go up */
        patchMeta(uid, { rev: row.rev, savedEarned: earned(row.save), acked: seq }); return 'pulled';
      }
      if (!dirty) return 'none';
      if (earned(mine) < num(m.savedEarned)) return 'refused';      /* a lost or cleared game never overwrites the account */
      return queue(uid, 'save', mine, num(m.rev), { seq: seq });
    }).catch(function () { return 'error'; }).then(function (r) { busy = false; if (again) { again = false; schedule(); } return r; });
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(function () { timer = 0; sync(); }, DEBOUNCE_MS); }
  function onChange(reason) {
    if (applying || (reason !== 'state' && reason !== 'external') || !ready()) return;
    var uid = A().userId(), m = metaFor(uid);
    if (tester()) { patchMeta(uid, { tainted: true }); return; }
    if (m && m.off) return;
    if (!m || !m.linked) { schedule(); return; }
    var p = pack(S.state()), h = hashOf(p); if (h === m.hash) return;   /* a settings change, not game progress */
    var now = caps(p.rewards), add = m.snap ? journalFor(m.snap, now) : [], t = Date.now().toString(36);
    add.forEach(function (x, i) { x.id = t + '-' + i; });
    patchMeta(uid, { seq: num(m.seq) + 1, hash: h, snap: now, journal: (m.journal || []).concat(add).slice(-200) }); schedule();
  }
  /* "delete my cloud copy", for the account and token the delete was started with: mark the save deleted on the server,
     then stop saving on this phone for that account until a sign-in after the deletion. A server without the game save is
     not an error; any other failure goes back to the caller. */
  function forget(uid, token) {
    if (!uid || !token) return Promise.reject(new Error('Please sign in again.'));
    clearTimeout(timer); timer = 0; patchMeta(uid, { off: true, pending: null, tried: null });
    return call('POST', '/rpc/game_save_delete', {}, token).catch(function (e) { if (e && (e.status === 404 || e.code === 'PGRST202')) return null; throw e; });
  }
  /* a new sign-in may try a deleted save once more; the server checks that the sign-in came after the deletion */
  function noteSignIn(uid) { var m = metaFor(uid); if (m && m.off) patchMeta(uid, { tried: null }); return Promise.resolve(); }
  if (S && S.subscribe && typeof window !== 'undefined' && window.document) {
    S.subscribe(onChange);
    var lastUid = null;
    var start = function () {
      lastUid = A() && A().userId ? A().userId() : null;
      if (A() && A().subscribe) A().subscribe(function () {
        var now = A().userId(), fresh = now && now !== lastUid; lastUid = now;
        if (fresh) noteSignIn(now).then(function () { setTimeout(sync, 300); }); else setTimeout(sync, 500);
      });
      setTimeout(sync, 1500);
    };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && timer) { clearTimeout(timer); timer = 0; sync(); } });
  }
  root.OvuGameSave = { META: META, GAME_KEYS: GAME_KEYS, REWARD_FIELDS: REWARD_FIELDS, pack: pack, withEarnings: withEarnings, linkMerge: linkMerge, applyTo: applyTo, mergeDay: mergeDay, caps: caps, journalFor: journalFor, replay: replay, hashOf: hashOf, sync: sync, forget: forget, noteSignIn: noteSignIn };
})(typeof window !== 'undefined' ? window : this);
