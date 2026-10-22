/* Game save (Jamie, 22 Oct 2026: "about the hearts lost, we need login to save"). Hearts, the farm, the bag, the greenhouse,
 * the villagers, the home and the pets lived only on this phone, so a new phone or a cleared browser lost them. This saves
 * that game progress to the signed-in account. It needs only a login, never the diary cloud-backup choice, because nothing
 * in it is diary data: only game fields are saved (no Harbour Lane letters, no garden diary dates, no hearts log, no
 * daily logging record), chosen field by field in pack().
 *
 * How two phones stay right (second version, after the Codex HOLD of 22 Oct): the server keeps a revision. A phone writes
 * only on top of the revision it last saw (game_save_put); otherwise it gets the current save back, merges three ways
 * against the save both last shared (hearts and counts add up from both sides, items bought on either side are kept, other
 * fields take whichever side changed), and tries again. A write acknowledges only the changes it carried.
 * First sign-in on a phone: the account's save is used and what this phone earned before signing in is added on top; it is
 * applied here only once the server has accepted it, so a failed try never counts twice. A phone whose diary was cleared
 * forgets its link (OvuStore clears this key) and links again instead of uploading an empty game, and no write ever carries
 * less total play (rewards.earned) than the account already holds. Tester mode never saves, and progress made in it is
 * never added to the account. "Delete my cloud copy" marks the save deleted on the server, so a phone that missed it stops
 * saving instead of recreating it; a fresh sign-in starts saving again. */
(function (root) {
  'use strict';
  var GAME_KEYS = ['rewards', 'farm', 'greenhouse', 'villagers', 'home', 'propPos', 'pets', 'garden', 'harbour', 'lane', 'stamina', 'visited', 'game'];
  var REWARD_FIELDS = ['hearts', 'earned', 'owned', 'placed', 'streak', 'lastDay'];
  var LOG_KINDS = { sleep: 1, period: 1, symptom: 1, food: 1, reflection: 1, exercise: 1, water: 1 };
  var META = 'ovumind_gamesave_v1', MAX_BYTES = 200000, KEEPALIVE_MAX = 60000, DEBOUNCE_MS = 4000, TRIES = 3;

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function plain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
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
  function earned(save) { var r = save && save.rewards; return r && isFinite(r.earned) ? Number(r.earned) : 0; }
  /* three-way merge: b is the save both sides last shared, l this phone's, r the account's */
  function merge3(b, l, r) {
    if (eq(l, b)) return clone(r);
    if (eq(r, b) || eq(l, r)) return clone(l);
    if (typeof l === 'number' && typeof r === 'number') { var base = typeof b === 'number' ? b : 0, v = r + (l - base); return (l >= 0 && r >= 0 && v < 0) ? 0 : v; }
    if ((plain(l) || l === undefined) && (plain(r) || r === undefined) && (plain(b) || b === undefined) && (l !== undefined || r !== undefined)) {
      var out = {}, keys = {}; [b, l, r].forEach(function (o) { Object.keys(o || {}).forEach(function (k) { keys[k] = 1; }); });
      Object.keys(keys).forEach(function (k) { var v = merge3(b && b[k], l && l[k], r && r[k]); if (v !== undefined) out[k] = v; });
      return out;
    }
    if (Array.isArray(l) && Array.isArray(r) && l.concat(r, Array.isArray(b) ? b : []).every(function (x) { return x === null || typeof x !== 'object'; })) {
      var bb = Array.isArray(b) ? b : [], added = l.filter(function (x) { return bb.indexOf(x) < 0; }), gone = bb.filter(function (x) { return l.indexOf(x) < 0; });
      return r.filter(function (x) { return gone.indexOf(x) < 0; }).concat(added.filter(function (x) { return r.indexOf(x) < 0; }));
    }
    return clone(l); /* both changed one value: this phone, where she is playing now, wins */
  }
  /* first sign-in: the account's save, plus the hearts, earnings and items this phone gathered before signing in */
  function linkMerge(local, remote) {
    var out = clone(remote) || {}, lr = local && local.rewards;
    if (lr) {
      var r = out.rewards = out.rewards || {};
      r.hearts = Math.max(0, (Number(r.hearts) || 0) + (Number(lr.hearts) || 0)); r.earned = (Number(r.earned) || 0) + (Number(lr.earned) || 0);
      r.owned = Array.isArray(r.owned) ? r.owned : []; (lr.owned || []).forEach(function (id) { if (r.owned.indexOf(id) < 0) r.owned.push(id); });
      r.placed = plain(r.placed) ? r.placed : {}; Object.keys(lr.placed || {}).forEach(function (id) { if (!(id in r.placed)) r.placed[id] = lr.placed[id]; });
    }
    return out;
  }
  /* what this phone's state becomes when a save arrives: game fields from the save; letters, garden diary dates, the hearts
     log and today's logging record stay as they are here. A phone that never earned here gets no second round of today's hearts. */
  function applyTo(state, save, today) {
    var patch = {};
    GAME_KEYS.forEach(function (k) {
      if (!save || save[k] === undefined) return;
      var v = clone(save[k]), mine = state[k];
      if (k === 'rewards') {
        if (plain(mine)) ['log', 'daily', 'dailyLast', 'mindDay', 'moveDay'].forEach(function (f) { if (mine[f] !== undefined) v[f] = clone(mine[f]); });
        else { v.log = []; v.daily = { day: today, kinds: clone(LOG_KINDS) }; v.dailyLast = today; v.mindDay = { day: today, pts: 999 }; v.moveDay = { day: today, pts: 999 }; }
      }
      if (k === 'garden') v = Object.assign({}, plain(mine) ? clone(mine) : {}, { watered: v.watered || [] });
      if (k === 'lane' && plain(mine) && mine.letters !== undefined) v.letters = clone(mine.letters);
      patch[k] = v;
    });
    return patch;
  }
  function hashOf(save) { var t = JSON.stringify(save), h = 5381; for (var i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36) + ':' + t.length; }

  /* ---------- wiring ---------- */
  var S = root.OvuStore, A = function () { return root.OvuAuth; }, CFG = root.OVU_CONFIG || {}, timer = 0, busy = false, again = false, applying = false;
  function readMeta() { try { var m = JSON.parse(localStorage.getItem(META) || 'null'); return plain(m) ? m : {}; } catch (e) { return {}; } }
  function metaFor(uid) { return readMeta()[uid] || null; }
  function setMetaFor(uid, m) { var all = readMeta(); all[uid] = m; try { localStorage.setItem(META, JSON.stringify(all)); } catch (e) { } }
  function patchMeta(uid, p) { setMetaFor(uid, Object.assign({}, metaFor(uid) || { uid: uid }, p)); }
  function tester() { var t = S && S.state && S.state().tester; return !!(t && t.hearts); }
  function ownerOk(uid) { var p = (S && S.profile && S.profile()) || {}, o = typeof p.owner === 'string' ? p.owner : null; return !o || o === uid; }
  function ready() { var a = A(); return !!(S && a && a.isSignedIn && a.isSignedIn() && a.userId() && !(S.isSandbox && S.isSandbox()) && typeof fetch === 'function' && CFG.supabaseUrl); }
  function call(method, path, body) {
    return Promise.resolve(A().token()).then(function (token) {
      if (!token) throw new Error('no token');
      var text = body != null ? JSON.stringify(body) : undefined;
      return fetch(CFG.supabaseUrl + '/rest/v1' + path, { method: method, headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: text, keepalive: !!(text && text.length < KEEPALIVE_MAX) })
        .then(function (r) { return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { } if (!r.ok) { var er = new Error('game save ' + r.status); er.status = r.status; er.code = j && j.code; throw er; } return j; }); });
    });
  }
  function getRow(uid) { return call('GET', '/game_saves?select=save,rev,deleted&user_id=eq.' + encodeURIComponent(uid)).then(function (rows) { return rows && rows[0] || null; }); }
  function put(save, base) {
    if (JSON.stringify(save).length > MAX_BYTES) return Promise.reject(new Error('too big'));
    return call('POST', '/rpc/game_save_put', { p_save: save, p_base: base }).then(function (rows) { return Array.isArray(rows) ? rows[0] || null : rows; });
  }
  function apply(save) {
    var before = S.state().home, patch = applyTo(S.state(), save, S.today());
    if (!Object.keys(patch).length) return;
    applying = true; try { (S.commit || S.setState)(patch); } finally { applying = false; }
    try { if (root.OvuRoom && OvuRoom.renderProps) OvuRoom.renderProps(); } catch (e) { }
    try { /* a restored home shows at once when she is standing in the old one and nothing is running */
      var R = root.OvuRoom, now = S.state().home;
      if (R && now && now !== before && R.layout && R.layout() && R.layout().id === (before || 'room') && !(R.busy && R.busy()) && !(R.sheetOpen && R.sheetOpen()) && R.applyLayout) R.applyLayout(now);
    } catch (e) { }
  }
  function isOff(uid) { return !!(metaFor(uid) || {}).off; }
  /* write `save` on top of revision `base`; on a clash, merge with what came back and try again (at most TRIES).
     `seq` is the change count the write carries: later changes stay waiting. */
  function write(uid, save, base, seq, tries) {
    return put(save, base).then(function (res) {
      if (A().userId() !== uid || isOff(uid)) return 'stopped';
      if (res && res.ok) { patchMeta(uid, { linked: true, rev: res.rev, base: save, acked: seq }); return 'saved'; }
      if (res && res.deleted) { patchMeta(uid, { off: true }); return 'deleted'; }
      if (!res || tries <= 1) return 'clash';
      var m = metaFor(uid) || {}, now = (m.seq || 0), merged = merge3(m.base, pack(S.state()), res.save);
      if (earned(merged) < earned(res.save)) return 'refused';   /* never write less play than the account already has */
      apply(merged);
      return write(uid, merged, res.rev, now, tries - 1);
    });
  }
  function link(uid, m, row) {
    var mine = pack(S.state()), live = row && !row.deleted && row.rev > 0;
    var target = live ? (m.tainted ? clone(row.save) : linkMerge(mine, row.save)) : mine;
    return put(target, row ? row.rev : 0).then(function (res) {
      if (A().userId() !== uid) return 'stopped';
      if (!res || !res.ok) return 'clash';                          /* nothing was applied here, so the next try starts from the same place */
      apply(target);
      patchMeta(uid, { linked: true, off: false, rev: res.rev, base: target, seq: 0, acked: 0, hash: hashOf(pack(S.state())), tainted: false });
      return 'linked';
    });
  }
  function sync() {
    if (!ready()) return Promise.resolve('off');
    var uid = A().userId(); if (!ownerOk(uid)) return Promise.resolve('owner');
    if (tester()) { patchMeta(uid, { tainted: true }); return Promise.resolve('tester'); }
    if (isOff(uid)) return Promise.resolve('deleted');
    if (busy) { again = true; return Promise.resolve('busy'); }
    busy = true;
    return getRow(uid).then(function (row) {
      if (A().userId() !== uid || isOff(uid)) return 'stopped';
      var m = metaFor(uid) || { uid: uid }, seq = m.seq || 0, dirty = seq > (m.acked || 0), mine = pack(S.state());
      if (!m.linked) return link(uid, m, row);
      if (!row) return write(uid, mine, 0, seq, TRIES);
      if (row.deleted && row.rev > (m.rev || 0)) { patchMeta(uid, { off: true }); return 'deleted'; }
      if (row.rev > (m.rev || 0)) {
        var merged = dirty ? merge3(m.base, mine, row.save) : clone(row.save);
        if (!eq(merged, mine)) apply(merged);
        if (!dirty) { patchMeta(uid, { rev: row.rev, base: clone(row.save), hash: hashOf(pack(S.state())) }); return 'pulled'; }
        if (earned(merged) < earned(row.save)) return 'refused';
        return write(uid, merged, row.rev, seq, TRIES);
      }
      if (!dirty) return 'none';
      if (earned(mine) < earned(m.base)) return 'refused';         /* a lost or cleared game never overwrites the account */
      return write(uid, mine, m.rev || 0, seq, TRIES);
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
    patchMeta(uid, { seq: (m.seq || 0) + 1, hash: h }); schedule();
  }
  /* after "delete my cloud copy": mark the server save deleted, then stop saving on this phone until the next sign-in.
     A server that has no game save yet is not an error; any other failure is passed back to the caller. */
  function forget() {
    if (!ready()) return Promise.resolve(null);
    var uid = A().userId(); clearTimeout(timer); timer = 0; patchMeta(uid, { off: true });
    return call('POST', '/rpc/game_save_delete', {}).catch(function (e) { if (e && (e.status === 404 || e.code === 'PGRST202')) return null; throw e; });
  }
  if (S && S.subscribe && typeof window !== 'undefined' && window.document) {
    S.subscribe(onChange);
    var lastUid = null;
    var start = function () {
      lastUid = A() && A().userId ? A().userId() : null;
      if (A() && A().subscribe) A().subscribe(function () {
        var now = A().userId();
        if (now && now !== lastUid && isOff(now)) setMetaFor(now, { uid: now }); /* a fresh sign-in after a deletion starts saving again */
        lastUid = now; setTimeout(sync, 500);
      });
      setTimeout(sync, 1500);
    };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && timer) { clearTimeout(timer); timer = 0; sync(); } });
  }
  root.OvuGameSave = { META: META, GAME_KEYS: GAME_KEYS, pack: pack, merge3: merge3, linkMerge: linkMerge, applyTo: applyTo, hashOf: hashOf, sync: sync, forget: forget, _setTimers: function (ms) { DEBOUNCE_MS = ms; } };
})(typeof window !== 'undefined' ? window : this);
