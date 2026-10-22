/* Game save (Jamie, 22 Oct 2026: "about the hearts lost, we need login to save"). Hearts, the farm, the bag, the villagers,
 * the home and the pets lived only on this phone, so a new phone or a cleared browser lost them. This saves that game
 * progress to the signed-in account, separately from the diary backup: it needs only a login, never the cloud-backup
 * choice, because nothing in it is diary data. The hearts log is the one place a diary kind could show (it records
 * "period" or "sleep" with the time of the reward), so every log line is reduced to its time, its points and "log".
 *
 * Rules (pure, tested in tools/test-core.js):
 *  - pack(state) keeps only GAME_KEYS, deep-copied, with the hearts log scrubbed.
 *  - The first time this phone meets an account that already has a save, the account's save is used and whatever this
 *    phone earned before signing in is added on top (hearts summed, owned items joined), so nothing is lost either way.
 *  - After that, a save nobody else has touched since this phone last saw it simply moves forward. When both phones moved,
 *    the one with more hearts earned in total wins as a whole (earned only grows with play), and on a tie the newer one.
 *  - Only game changes count: a sound or settings change never marks the game as changed (hash of the packed save).
 *  - Nothing is sent while the phone's diary belongs to a different account (profile.owner), or in a sandbox. */
(function (root) {
  'use strict';
  var GAME_KEYS = ['rewards', 'farm', 'villagers', 'home', 'propPos', 'pets', 'garden', 'harbour', 'lane', 'stamina', 'visited', 'game'];
  var GAME_LOG_TYPES = { spend: 1, refund: 1, breathtap: 1, lightflower: 1, bonus: 1, gift: 1 };
  var META = 'ovumind_gamesave_v1', MAX_BYTES = 200000, DEBOUNCE_MS = 4000;

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function scrubLog(log) {
    return (Array.isArray(log) ? log : []).slice(0, 200).map(function (x) {
      x = x || {}; var out = { at: typeof x.at === 'string' ? x.at : null, points: Number(x.points) || 0, type: GAME_LOG_TYPES[x.type] ? x.type : 'log' };
      if (typeof x.item === 'string') out.item = x.item; if (typeof x.what === 'string' && GAME_LOG_TYPES[x.type]) out.what = x.what;
      return out;
    });
  }
  function pack(state) {
    var out = {}; state = state || {};
    GAME_KEYS.forEach(function (k) { if (state[k] !== undefined) out[k] = clone(state[k]); });
    if (out.rewards) { out.rewards.log = scrubLog(out.rewards.log); delete out.rewards.daily; } /* the daily caps are rebuilt from the log */
    return out;
  }
  function hearts(save) { var r = save && save.rewards; return r && isFinite(r.hearts) ? Math.max(0, Number(r.hearts)) : 0; }
  /* what to write into the phone's state, given the phone's game and the account's save */
  function firstLinkMerge(local, remote) {
    var out = clone(remote) || {}, lr = (local && local.rewards) || null;
    if (lr) {
      var r = out.rewards = out.rewards || { hearts: 0, earned: 0, log: [], owned: [], placed: {} };
      r.hearts = hearts(out) + hearts(local); r.earned = (Number(r.earned) || 0) + (Number(lr.earned) || 0);
      r.owned = Array.isArray(r.owned) ? r.owned : [];
      (lr.owned || []).forEach(function (id) { if (r.owned.indexOf(id) < 0) r.owned.push(id); });
      r.placed = r.placed || {}; Object.keys(lr.placed || {}).forEach(function (id) { if (!(id in r.placed)) r.placed[id] = lr.placed[id]; });
      r.log = scrubLog((lr.log || []).concat(r.log || [])).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).slice(0, 200);
    }
    return out;
  }
  /* decide one sync step: meta is this phone's record for the account ({uid, linked, savedAt, pulledAt, dirty}) */
  function earned(save) { var r = save && save.rewards; return r && isFinite(r.earned) ? Number(r.earned) : 0; }
  function decide(meta, remote, local) {
    if (!remote) return 'push';
    if (!meta || !meta.linked) return 'link';
    var rAt = Date.parse(remote.saved_at) || 0, pulled = Date.parse(meta.pulledAt) || 0, mine = Date.parse(meta.savedAt) || 0;
    if (rAt <= pulled) return meta.dirty ? 'push' : 'none';    /* nobody else wrote since this phone last saw it */
    if (!meta.dirty) return 'pull';                            /* only the other phone moved */
    var le = earned(local), re = earned(remote.save);          /* both moved: more play wins, then the newer save */
    if (le !== re) return le > re ? 'push' : 'pull';
    return mine > rAt ? 'push' : 'pull';
  }
  function hashOf(save) { var t = JSON.stringify(save), h = 5381; for (var i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36) + ':' + t.length; }

  /* ---------- wiring ---------- */
  var S = root.OvuStore, A = function () { return root.OvuAuth; }, CFG = root.OVU_CONFIG || {}, timer = 0, busy = false, again = false;
  function readMeta() { try { return JSON.parse(localStorage.getItem(META) || 'null') || {}; } catch (e) { return {}; } }
  function writeMeta(m) { try { localStorage.setItem(META, JSON.stringify(m)); } catch (e) { } }
  function metaFor(uid) { var all = readMeta(); return all[uid] || null; }
  function setMetaFor(uid, m) { var all = readMeta(); all[uid] = m; writeMeta(all); }
  function ownerOk(uid) { var p = (S && S.profile && S.profile()) || {}, o = typeof p.owner === 'string' ? p.owner : null; return !o || o === uid; }
  function ready() { var a = A(); return !!(S && a && a.isSignedIn && a.isSignedIn() && a.userId() && !(S.isSandbox && S.isSandbox()) && typeof fetch === 'function' && CFG.supabaseUrl); }
  function call(method, path, body, prefer) {
    return Promise.resolve(A().token()).then(function (token) {
    if (!token) throw new Error('no token');
    var h = { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    if (prefer) h.Prefer = prefer;
    return fetch(CFG.supabaseUrl + '/rest/v1' + path, { method: method, headers: h, body: body != null ? JSON.stringify(body) : undefined, keepalive: method !== 'GET' })
      .then(function (r) { return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { } if (!r.ok) throw new Error('game save ' + r.status); return j; }); });
    });
  }
  function apply(save) {
    var patch = {}; GAME_KEYS.forEach(function (k) { if (save && save[k] !== undefined) patch[k] = clone(save[k]); });
    if (patch.rewards) delete patch.rewards.daily;
    if (Object.keys(patch).length) { applying = true; try { (S.commit || S.setState)(patch); } finally { applying = false; } }
    try { if (root.OvuRoom && OvuRoom.renderProps) OvuRoom.renderProps(); } catch (e) { }
  }
  var applying = false;
  function push(uid, m) {
    var body = pack(S.state()), at = new Date().toISOString(), text = JSON.stringify(body);
    if (text.length > MAX_BYTES) return Promise.resolve(null);
    return call('POST', '/game_saves?on_conflict=user_id', { user_id: uid, save: body, saved_at: at }, 'resolution=merge-duplicates,return=minimal')
      .then(function () { setMetaFor(uid, Object.assign({}, m, { uid: uid, linked: true, savedAt: at, pulledAt: at, dirty: false, hash: hashOf(body) })); });
  }
  function sync() {
    if (!ready()) return Promise.resolve('off');
    var uid = A().userId(); if (!ownerOk(uid)) return Promise.resolve('owner');
    if ((metaFor(uid) || {}).off) return Promise.resolve('deleted');
    if (busy) { again = true; return Promise.resolve('busy'); }
    busy = true;
    return call('GET', '/game_saves?select=save,saved_at&user_id=eq.' + encodeURIComponent(uid), null, null).then(function (rows) {
      if (A().userId() !== uid) return 'switched';
      var remote = rows && rows[0] || null, m = metaFor(uid) || { uid: uid }, step = decide(m, remote, pack(S.state()));
      if (step === 'link') { apply(firstLinkMerge(pack(S.state()), remote.save)); return push(uid, m).then(function () { return 'linked'; }); }
      if (step === 'pull') { apply(remote.save); setMetaFor(uid, Object.assign({}, m, { linked: true, pulledAt: remote.saved_at, savedAt: remote.saved_at, dirty: false, hash: hashOf(pack(S.state())) })); return 'pulled'; }
      if (step === 'push') return push(uid, m).then(function () { return 'pushed'; });
      return 'none';
    }).catch(function () { return 'error'; }).then(function (r) { busy = false; if (again) { again = false; schedule(); } return r; });
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(sync, DEBOUNCE_MS); }
  function onChange(reason) {
    if (applying || reason !== 'state' || !ready()) return;
    var uid = A().userId(), m = metaFor(uid); if (m && m.off) return; if (!m || !m.linked) { schedule(); return; } /* the first sync links before anything is pushed */
    var h = hashOf(pack(S.state())); if (h === m.hash) return;                   /* a settings change, not game progress */
    setMetaFor(uid, Object.assign({}, m, { savedAt: new Date().toISOString(), dirty: true, hash: h })); schedule();
  }
  if (S && S.subscribe && typeof window !== 'undefined' && window.document) {
    S.subscribe(onChange);
    var lastUid = null;
    var start = function () {
      lastUid = A() && A().userId ? A().userId() : null;
      if (A() && A().subscribe) A().subscribe(function () {
        var now = A().userId();
        if (now && now !== lastUid) { var m = metaFor(now); if (m && m.off) setMetaFor(now, { uid: now }); } /* a fresh sign-in after "delete my cloud copy" starts saving again */
        lastUid = now; setTimeout(sync, 500);
      });
      setTimeout(sync, 1500);
    };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && timer) { clearTimeout(timer); timer = 0; sync(); } });
  }
  /* after the cloud copy is deleted, this phone stops saving the game for that account until its next sign-in */
  function forget(uid) { if (uid) { clearTimeout(timer); timer = 0; setMetaFor(uid, { uid: uid, off: true }); } }
  root.OvuGameSave = { forget: forget, GAME_KEYS: GAME_KEYS, pack: pack, firstLinkMerge: firstLinkMerge, decide: decide, scrubLog: scrubLog, hashOf: hashOf, sync: sync };
})(typeof window !== 'undefined' ? window : this);
