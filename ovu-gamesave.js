/* Game save (Jamie, 22 Oct 2026: "about the hearts lost, we need login to save"). Hearts, the farm, the bag, the greenhouse,
 * the villagers, the home and the pets lived only on this phone, so a new phone or a cleared browser lost them. This saves
 * that game progress to the signed-in account. It needs only a login, never the diary cloud-backup choice, because nothing
 * in it is diary data: only game fields are saved (no Harbour Lane letters, no garden diary dates, no hearts log, no
 * diary receipts, no daily logging record), chosen field by field in pack().
 *
 * The rule (third version, after two Codex HOLDs on 22 Oct: a field-by-field merge of game state double-counts harvests,
 * adds up positions and energy, and charges a retried purchase twice):
 *  - The account's save is the one true copy. A phone writes only on top of the revision it last saw (game_save_put);
 *    it saves a few seconds after every change, so two phones rarely both change between saves.
 *  - When the account moved on since this phone last saw it, the account's save is taken whole, and the hearts this
 *    phone earned since its last save are added on top. Its other unsaved changes (a purchase, a planting) are dropped
 *    together with what they cost, so nothing is double-counted or charged twice.
 *  - Every write carries an operation id kept until the server answers, so a write whose answer was lost is never applied twice.
 *  - First sign-in on a phone: the account's save, plus this phone's hearts balance, earnings and owned items (once).
 *  - A cleared phone forgets its link (OvuStore clears this key) and links again instead of uploading an empty game.
 *  - Tester mode never saves; a phone that used it takes the account's save whole on its next sync.
 *  - "Delete my cloud copy" marks the save deleted on the server; a phone never revives it on its own, only after a new
 *    sign-in. The deletion is sent with the account and token of the delete itself. */
(function (root) {
  'use strict';
  var GAME_KEYS = ['rewards', 'farm', 'greenhouse', 'villagers', 'home', 'propPos', 'pets', 'garden', 'harbour', 'lane', 'stamina', 'visited', 'game'];
  var REWARD_FIELDS = ['hearts', 'earned', 'owned', 'placed', 'treats', 'wear', 'gifts', 'streak', 'lastDay'];
  var LOG_KINDS = { sleep: 1, period: 1, symptom: 1, food: 1, reflection: 1, exercise: 1, water: 1 };
  var META = 'ovumind_gamesave_v1', MAX_BYTES = 200000, KEEPALIVE_MAX = 60000, DEBOUNCE_MS = 4000;

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function plain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
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
    var r = out.rewards = plain(out.rewards) ? out.rewards : {};
    r.hearts = Math.max(0, num(r.hearts)) + gain; r.earned = num(r.earned) + gain;
    return out;
  }
  /* first sign-in: the account's save, plus the hearts balance, earnings and items this phone gathered before signing in */
  function linkMerge(local, remote) {
    var out = clone(remote) || {}, lr = local && local.rewards;
    if (plain(lr)) {
      var r = out.rewards = plain(out.rewards) ? out.rewards : {};
      r.hearts = Math.max(0, num(r.hearts)) + Math.max(0, num(lr.hearts)); r.earned = num(r.earned) + Math.max(0, num(lr.earned));
      r.owned = Array.isArray(r.owned) ? r.owned : []; (Array.isArray(lr.owned) ? lr.owned : []).forEach(function (id) { if (r.owned.indexOf(id) < 0) r.owned.push(id); });
      r.placed = plain(r.placed) ? r.placed : {}; Object.keys(plain(lr.placed) ? lr.placed : {}).forEach(function (id) { if (!(id in r.placed)) r.placed[id] = lr.placed[id]; });
    }
    return out;
  }
  /* what this phone's state becomes when a save arrives: game fields from the save; letters, garden diary dates and every
     local-only rewards field (log, receipts, today's caps) stay as they are here. A phone that never earned here gets no
     second round of today's hearts. */
  function applyTo(state, save, today) {
    var patch = {};
    GAME_KEYS.forEach(function (k) {
      if (!save || save[k] === undefined) {
        /* the account copy is taken whole: game progress it does not have goes too (tester gifts, unsaved purchases),
           while this phone's private parts stay */
        var had = state[k]; if (had === undefined || had === null) return;
        if (k === 'rewards') { var keep = {}; if (plain(had)) Object.keys(had).forEach(function (f) { if (REWARD_FIELDS.indexOf(f) < 0) keep[f] = clone(had[f]); }); patch.rewards = keep; }
        else if (k === 'garden') patch.garden = plain(had) && had.credited ? { credited: clone(had.credited), watered: [] } : null;
        else if (k === 'lane') patch.lane = plain(had) && had.letters !== undefined ? { letters: clone(had.letters) } : null;
        else patch[k] = null;
        return;
      }
      var v = clone(save[k]), mine = state[k];
      if (k === 'rewards') {
        if (plain(mine)) Object.keys(mine).forEach(function (f) { if (REWARD_FIELDS.indexOf(f) < 0) v[f] = clone(mine[f]); });
        else { v.log = []; v.daily = { day: today, kinds: clone(LOG_KINDS) }; v.dailyLast = today; v.mindDay = { day: today, pts: 999 }; v.moveDay = { day: today, pts: 999 }; }
      }
      if (k === 'garden') v = Object.assign({}, plain(mine) ? clone(mine) : {}, { watered: v.watered || [] });
      if (k === 'lane' && plain(mine) && mine.letters !== undefined) v.letters = clone(mine.letters);
      patch[k] = v;
    });
    return patch;
  }
  function hashOf(save) { var t = JSON.stringify(save), h = 5381; for (var i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36) + ':' + t.length; }
  function opId() { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }

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
  function showHome(before) {
    try { /* a restored home shows as soon as she is standing in the old one with nothing running (tried for a minute) */
      var R = root.OvuRoom, now = S.state().home; if (!R || !now || now === before || !R.layout || !R.applyLayout) return;
      if (R.layout() && R.layout().id === now) return;
      if (R.layout() && R.layout().id === (before || 'room') && !(R.busy && R.busy()) && !(R.sheetOpen && R.sheetOpen())) { R.applyLayout(now); return; }
      if (++homeTries < 30) setTimeout(function () { showHome(before); }, 2000);
    } catch (e) { }
  }
  function apply(save) {
    var before = S.state().home, patch = applyTo(S.state(), save, S.today());
    if (!Object.keys(patch).length) return;
    applying = true; try { (S.commit || S.setState)(patch); } finally { applying = false; }
    try { if (root.OvuRoom && OvuRoom.renderProps) OvuRoom.renderProps(); } catch (e) { }
    homeTries = 0; showHome(before);
  }
  function isOff(uid) { return !!(metaFor(uid) || {}).off; }
  /* send the write recorded in meta.pending (kept until the server answers, so a lost answer is resent with the same id) */
  function sendPending(uid) {
    var p = (metaFor(uid) || {}).pending; if (!p) return Promise.resolve(null);
    return put(p.save, p.base, p.op).then(function (res) {
      if (A().userId() !== uid) return 'stopped';
      if (res && res.ok) {
        var m = metaFor(uid) || {};
        if (p.kind === 'link') {
          var gain = earned(pack(S.state())) - num(p.localEarned); /* hearts she earned while the link was on its way */
          apply(withEarnings(p.save, gain));
          patchMeta(uid, { linked: true, off: false, revive: false, tainted: false, rev: res.rev, savedEarned: earned(p.save), seq: gain > 0 ? 1 : 0, acked: 0, hash: hashOf(pack(S.state())), pending: null });
          return 'linked';
        }
        patchMeta(uid, { rev: res.rev, savedEarned: earned(p.save), acked: Math.max(num(m.acked), num(p.seq)), pending: null });
        return 'saved';
      }
      patchMeta(uid, { pending: null });
      if (res && res.deleted && !(metaFor(uid) || {}).revive) { patchMeta(uid, { off: true }); return 'deleted'; }
      schedule(); return 'clash';                                /* the next sync takes the account's newer save */
    });
  }
  function queue(uid, kind, save, base, extra) { patchMeta(uid, { pending: Object.assign({ kind: kind, save: save, base: base, op: opId() }, extra || {}) }); return sendPending(uid); }
  function sync() {
    if (!ready()) return Promise.resolve('off');
    var uid = A().userId(); if (!ownerOk(uid)) return Promise.resolve('owner');
    if (tester()) { patchMeta(uid, { tainted: true }); return Promise.resolve('tester'); }
    if (isOff(uid)) return Promise.resolve('deleted');
    if (busy) { again = true; return Promise.resolve('busy'); }
    busy = true;
    return sendPending(uid).then(function () { return getRow(uid); }).then(function (row) {
      if (A().userId() !== uid || isOff(uid)) return 'stopped';
      var m = metaFor(uid) || { uid: uid }, seq = num(m.seq), dirty = seq > num(m.acked), mine = pack(S.state());
      var live = row && !row.deleted && row.rev > 0;
      if (row && row.deleted && !m.revive) { patchMeta(uid, { off: true }); return 'deleted'; }
      if (!m.linked) {
        if (m.tainted && !live) return 'tester';                    /* tester progress is never uploaded */
        var target = live ? (m.tainted ? clone(row.save) : linkMerge(mine, row.save)) : mine;
        return queue(uid, 'link', target, row ? row.rev : 0, { localEarned: earned(mine) });
      }
      if (!row) return queue(uid, 'save', mine, 0, { seq: seq });
      if (m.tainted) { apply(row.save); patchMeta(uid, { tainted: false, rev: row.rev, savedEarned: earned(row.save), acked: seq, hash: hashOf(pack(S.state())) }); return 'pulled'; }
      if (row.rev > num(m.rev) || row.deleted) {
        var gain = dirty ? earned(mine) - num(m.savedEarned) : 0, next = withEarnings(row.save, gain);
        if (!eq(next, mine)) apply(next);
        if (gain > 0) return queue(uid, 'save', next, row.rev, { seq: seq });
        patchMeta(uid, { rev: row.rev, savedEarned: earned(row.save), acked: seq, hash: hashOf(pack(S.state())) }); return 'pulled';
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
    var h = hashOf(pack(S.state())); if (h === m.hash) return;   /* a settings change, not game progress */
    patchMeta(uid, { seq: num(m.seq) + 1, hash: h }); schedule();
  }
  /* "delete my cloud copy", for the account and token the delete was started with: mark the save deleted on the server,
     then stop saving on this phone for that account until its next sign-in. A server without the game save is not an
     error; any other failure goes back to the caller. */
  function forget(uid, token) {
    if (!uid || !token) return Promise.reject(new Error('Please sign in again.'));
    clearTimeout(timer); timer = 0; patchMeta(uid, { off: true, pending: null, revive: false });
    return call('POST', '/rpc/game_save_delete', {}, token).catch(function (e) { if (e && (e.status === 404 || e.code === 'PGRST202')) return null; throw e; });
  }
  if (S && S.subscribe && typeof window !== 'undefined' && window.document) {
    S.subscribe(onChange);
    var lastUid = null;
    var start = function () {
      lastUid = A() && A().userId ? A().userId() : null;
      if (A() && A().subscribe) A().subscribe(function () {
        var now = A().userId();
        if (now && now !== lastUid) { var m = metaFor(now); if (m && m.off) setMetaFor(now, { uid: now, revive: true }); else if (m && !m.linked) patchMeta(now, { revive: true }); else if (!m) setMetaFor(now, { uid: now, revive: true }); } /* a new sign-in may start a save again */
        lastUid = now; setTimeout(sync, 500);
      });
      setTimeout(sync, 1500);
    };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && timer) { clearTimeout(timer); timer = 0; sync(); } });
  }
  root.OvuGameSave = { META: META, GAME_KEYS: GAME_KEYS, REWARD_FIELDS: REWARD_FIELDS, pack: pack, withEarnings: withEarnings, linkMerge: linkMerge, applyTo: applyTo, hashOf: hashOf, sync: sync, forget: forget };
})(typeof window !== 'undefined' ? window : this);
