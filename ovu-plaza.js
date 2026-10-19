/* Rhythme plaza servers, phase 1 (docs/design/2026-10-19-plaza-servers-and-hosts.md).
 * Groups in the plaza, by stage of life rather than by place (Rhythme is worldwide): Everyone, Trying to conceive, PCOS
 * and Menopause, room for 24 in each. A signed-in person chooses one while she is in the plaza and is counted there while
 * she stays: her phone checks in every 25 seconds, and walking out of the plaza,
 * putting the app away, going to sleep, signing out or tapping Leave takes her out. Only counts travel back to people
 * and staff: no name, no diary, no chat. Signed out, nothing is sent; the pill says how to join.
 * Server side: supabase/migrations/20261019080000_plaza_presence.sql, 20261019090000_plaza_presence_v2.sql and
 * 20261019100000_plaza_groups.sql. The groups are about health, so the sheet says what joining tells Rhythme, anyone
 * may join any group, and nothing in her profile ever picks one for her. */
(function (root) {
  'use strict';
  var BEAT = 25000, LIST = 30000, TIMEOUT = 10000;

  /* ---------- words (pure, tested in tools/test-core.js) ---------- */
  function countText(n, me) {
    n = Math.max(0, Number(n) || 0);
    if (me && n <= 1) return 'just you for now';
    return n === 0 ? 'nobody here yet' : n === 1 ? '1 person here' : n + ' people here';
  }
  function roomText(s) {
    if (!s) return '';
    if (s.open === false) return 'Closed for now';
    var n = Math.max(0, Number(s.people) || 0);
    return n >= s.capacity ? n + ' of ' + s.capacity + ', full' : n + ' of ' + s.capacity + ' here';
  }
  function pillText(st) {
    if (!st || !st.signedIn) return 'Groups · sign in to join';
    if (st.joined) return st.joined.name + ' · ' + (st.offline ? 'reconnecting' : countText(st.joined.people, true));
    var total = (st.servers || []).reduce(function (a, s) { return a + (Number(s.people) || 0); }, 0);
    return 'Choose a group' + (st.servers ? ' · ' + total + ' online' : '');
  }
  function fullText(j) {
    var s = j && j.suggest;
    return (j && j.name ? j.name : 'That group') + ' is full right now.' + (s && s.name ? ' ' + s.name + ' has room.' : ' Try again in a little while.');
  }
  /* a quiet icon per group; an unknown group gets the plain one */
  var ICONS = { everyone: 'groups', 'trying-to-conceive': 'favorite', pcos: 'water_drop', menopause: 'spa' };
  function icon(id) { return ICONS[id] || 'groups'; }
  var P = { BEAT: BEAT, LIST: LIST, ICONS: ICONS, icon: icon, countText: countText, roomText: roomText, pillText: pillText, fullText: fullText };
  root.OvuPlaza = P;

  /* ---------- the scene ---------- */
  var R = root.OvuRoom, A = root.OvuAuth, S = root.OvuStore, doc = root.document, CFG = root.OVU_CONFIG || {};
  if (!R || !A || !S || !doc || !doc.createElement) return;

  /* Membership is reconciled, never raced. `want` is the plaza she means to be in; `have` is what the server last
   * confirmed. One join or leave is in flight at a time; anything she does meanwhile only changes `want`, and when the
   * request settles the loop runs again toward the latest wish (walking out during a join sends a leave for it once it
   * lands). Every reply is checked against the account and the plaza it was sent for, so a late reply can never move
   * her back, and a leave names the plaza it leaves. */
  var want = null, have = null, servers = null, offline = false, inflight = false, beating = false;
  var tickT = 0, listT = 0, listGen = 0, pill = null, lastToken = null;

  function esc(s) { return R.esc ? R.esc(s) : String(s == null ? '' : s); }
  function inPlaza() { var L = R.layout && R.layout(); return !!(L && L.id === 'plaza'); }
  function asleep() { return !!(R.asleep && R.asleep()); }
  function uid() { var s = A.session && A.session(); return s && s.user ? s.user.id : null; }
  function eligible() { return !!uid() && inPlaza() && !asleep() && !doc.hidden; }
  function desired() { return eligible() ? want : null; }
  function remembered() { var p = S.state().plaza; return p && p.server ? p.server : null; }
  function server(id) { return (servers || []).filter(function (s) { return s.id === id; })[0] || null; }

  function rpc(name, args, opts) {
    opts = opts || {};
    var send = function (t) {
      if (!t) return Promise.reject(new Error('signed out'));
      if (opts.check && !opts.check()) return Promise.reject(new Error('cancelled')); /* her wish changed before this left the phone */
      lastToken = t;
      var ctl = !opts.keepalive && root.AbortController ? new root.AbortController() : null;
      var timer = ctl ? root.setTimeout(function () { ctl.abort(); }, TIMEOUT) : 0;
      var done = function () { if (timer) root.clearTimeout(timer); };
      return root.fetch(CFG.supabaseUrl + '/rest/v1/rpc/' + name, {
        method: 'POST', keepalive: !!opts.keepalive, signal: ctl ? ctl.signal : undefined,
        headers: { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(args || {})
      }).then(function (r) {
        return r.text().then(function (x) { done(); var j = null; try { j = x ? JSON.parse(x) : null; } catch (e) { } if (!r.ok) throw new Error((j && j.message) || ('error ' + r.status)); return j; });
      }, function (e) { done(); throw e; });
    };
    if (opts.token) return send(opts.token); /* signed out already: the last token still lets her leave */
    if (opts.keepalive) { var s = A.session(); return send((s && s.access_token) || lastToken); } /* the page may be going away: no time to refresh */
    return Promise.resolve(A.token()).then(send);
  }

  /* ---------- the loop ---------- */
  function sync() {
    if (inflight) return; /* the settling request runs the loop again */
    var d = desired(), h = have ? have.id : null, u = uid();
    if (d === h) return;
    var leaving = !d;
    if (!leaving && !u) return;
    inflight = true; render();
    var op = leaving
      ? rpc('plaza_leave', { p_server: h }, { keepalive: doc.hidden, token: u ? null : lastToken })
      : rpc('plaza_join', { p_server: d }, { check: function () { return uid() === u && desired() === d; } });
    var failed = false;
    op.then(function (j) {
      if (leaving) { have = null; return; }
      if (uid() !== u) return; /* the account changed while this was on its way */
      if (j && j.ok) {
        have = { id: j.server, name: j.name, people: j.people, capacity: j.capacity }; offline = false;
        if (want === d) S.setState({ plaza: { server: d } });
        if (want === d && desired() === d) { R.chime('tap'); R.toast('You are in ' + j.name + '. ' + countText(j.people, true).replace(/^./, function (c) { return c.toUpperCase(); }) + '.', 'groups'); }
        return;
      }
      /* refused: she stays where she was, and the wish falls back to it */
      R.toast(j && j.why === 'full' ? fullText(j) : 'That group is closed for now.', 'groups');
      if (want === d) { want = h; if (!h) S.setState({ plaza: null }); }
    }, function (e) {
      if (e && e.message === 'cancelled') return;
      failed = true; offline = true;
      if (leaving) have = null; /* the server stops counting her after 75 s by itself */
    }).then(function () {
      inflight = false; render();
      if (!failed) sync(); /* converge on the latest wish; after a failure the next tick tries again */
    });
  }
  function tick() {
    if (desired() !== (have ? have.id : null)) { sync(); return; }
    if (!have || inflight || beating) return;
    var id = have.id, u = uid(); beating = true;
    rpc('plaza_beat', { p_server: id }, { check: function () { return !!have && have.id === id && uid() === u; } }).then(function (j) {
      if (!have || have.id !== id || uid() !== u) return; /* a reply for a membership she no longer has */
      if (j && j.ok) { have.people = j.people; offline = false; return; }
      if (j && j.rejoin) { have = null; sync(); } /* quiet too long: join again, capacity is checked again */
    }, function (e) { if (e && e.message !== 'cancelled' && have && have.id === id) offline = true; }).then(function () { beating = false; render(); });
  }
  function refresh() {
    if (!uid() || !inPlaza()) return Promise.resolve();
    var g = ++listGen;
    return rpc('plaza_list').then(function (j) {
      if (g !== listGen) return;
      servers = (j && j.servers) || []; offline = false;
      if (have) { var s = server(have.id); if (s) have.people = s.people; }
      render();
    }, function () { if (g === listGen) { offline = true; render(); } });
  }
  function startTimers() { stopTimers(); tickT = root.setInterval(tick, BEAT); listT = root.setInterval(function () { if (!doc.hidden) refresh(); }, LIST); }
  function stopTimers() { if (tickT) root.clearInterval(tickT); if (listT) root.clearInterval(listT); tickT = listT = 0; }

  function choose(id) { want = id; sync(); render(); }
  function leaveForGood() { want = null; S.setState({ plaza: null }); sync(); render(); }
  function arrive() {
    render();
    if (!eligible()) { sync(); return; }
    if (!want) want = remembered();
    startTimers(); refresh(); sync();
  }
  function depart() { stopTimers(); listGen++; servers = null; sync(); render(); }

  /* ---------- the pill and the sheet ---------- */
  function build() {
    pill = doc.createElement('button'); pill.type = 'button'; pill.className = 'plazapill'; pill.id = 'plazaPill'; pill.hidden = true;
    pill.innerHTML = '<span class="ms" aria-hidden="true">groups</span><span class="pt"></span>';
    pill.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (asleep()) { if (root.OvuWalk && root.OvuWalk.napping) root.OvuWalk.napping(); return; } openSheet(); });
    R.els.scene.appendChild(pill);
  }
  function state() { return { signedIn: !!uid(), joined: have, servers: servers, offline: offline }; }
  function render() {
    if (!pill) return;
    pill.hidden = !(inPlaza() && !asleep() && !(R.els.hud && R.els.hud.classList.contains('on')) && !(R.sessionOn && R.sessionOn()));
    var t = pillText(state()); pill.querySelector('.pt').textContent = t; pill.setAttribute('aria-label', t);
    pill.classList.toggle('in', !!have);
    fillSheet();
  }
  function openSheet() {
    if (!uid()) {
      R.openSheet('plaza', 'Plaza groups', 'Choose a topic you want to connect around', 'groups',
        '<p>The plaza has groups for everyone, for trying to conceive, for PCOS and for menopause, each showing how many people are in it right now. Sign in to see the counts and join one. You are not counted in a group until you choose Join.</p>' +
        '<div class="row"><button type="button" class="btn primary" id="plazaSignIn"><span class="ms">person</span>Sign in from You</button></div>');
      var b = doc.getElementById('plazaSignIn');
      if (b) b.addEventListener('click', function () { R.hideSheet(); var a = doc.querySelector('nav a[data-tab="you"]'); if (a) a.click(); });
      return;
    }
    R.openSheet('plaza', 'Plaza groups', 'Choose a topic you want to connect around', 'groups',
      '<div class="plazalist" id="plazaList"><p class="help">Looking around…</p></div>' +
      '<p class="help">Joining stores that your account is in this group, with the time you joined and last checked in, so you can be counted. The groups are about health, so joining one tells Rhythme something about you while you are in it. Anyone can join any group, and nothing in your profile chooses one for you. This phone remembers the group you chose and rejoins it when you come back to the plaza; tap Leave the group to forget it. Other people and Rhythme staff see only the number, never who. Leaving the plaza, putting Rhythme away, going to sleep or signing out takes you out; if that message does not get through, you stop being counted after 75 seconds and the record is deleted the next time anyone uses the groups. Each group also keeps daily counts of joins and its busiest moment, with no account attached. There is no chat yet.</p>' +
      '<div class="row" id="plazaLeaveRow" hidden><button type="button" class="btn soft" id="plazaLeave"><span class="ms">logout</span>Leave the group</button></div>');
    var list = doc.getElementById('plazaList');
    list.addEventListener('click', function (e) { var b = e.target.closest('[data-join]'); if (!b || b.disabled) return; choose(b.dataset.join); });
    doc.getElementById('plazaLeave').addEventListener('click', function () { leaveForGood(); R.toast('You left the group. You can still walk around the plaza; you are just not counted.', 'logout'); });
    fillSheet(); refresh();
  }
  /* rows are built once and updated in place, so a focused button is not replaced under a keyboard or screen reader */
  function fillSheet() {
    var list = doc.getElementById('plazaList'); if (!list) return;
    var lr = doc.getElementById('plazaLeaveRow'); if (lr) lr.hidden = !have;
    if (!servers) { if (!list.querySelector('.plazarow')) list.innerHTML = '<p class="help">' + (offline ? 'Could not reach the groups. Check the connection; this tries again by itself.' : 'Looking around…') + '</p>'; return; }
    var ids = servers.map(function (s) { return s.id; }).join(',');
    if (list.getAttribute('data-ids') !== ids) {
      list.setAttribute('data-ids', ids);
      list.innerHTML = servers.map(function (s) { return '<div class="plazarow" data-row="' + esc(s.id) + '"><span class="ms" aria-hidden="true"></span><span class="pn"><b>' + esc(s.name) + '</b><small></small></span><button type="button" class="btn" data-join="' + esc(s.id) + '"></button></div>'; }).join('');
    }
    servers.forEach(function (s) {
      var r = list.querySelector('[data-row="' + s.id + '"]'); if (!r) return;
      var here = !!have && have.id === s.id, pending = inflight && want === s.id && !here, full = !here && (s.open === false || s.people >= s.capacity);
      r.classList.toggle('here', here);
      r.querySelector('.ms').textContent = icon(s.id);
      r.querySelector('small').textContent = (s.blurb ? s.blurb + ' · ' : '') + (here ? countText(have.people, true) : roomText(s));
      var b = r.querySelector('button');
      b.className = 'btn ' + (here || full || pending ? 'soft' : 'primary');
      b.disabled = here || full || pending;
      b.textContent = here ? 'You’re here' : pending ? 'Joining…' : full ? (s.open === false ? 'Closed' : 'Full') : 'Join';
      b.setAttribute('aria-label', here ? 'You are in ' + s.name : pending ? 'Joining ' + s.name : full ? s.name + ' is ' + (s.open === false ? 'closed' : 'full') : 'Join ' + s.name);
    });
  }

  function mount() {
    build(); render();
    R.on('layout', function () { if (inPlaza()) arrive(); else depart(); });
    if (inPlaza()) arrive();
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) { stopTimers(); sync(); } else if (inPlaza()) arrive(); }); /* hidden: a keepalive leave */
    root.addEventListener('pagehide', function () { if (have) { rpc('plaza_leave', { p_server: have.id }, { keepalive: true }).catch(function () { }); have = null; } });
    root.addEventListener('pageshow', function () { if (inPlaza() && !doc.hidden) arrive(); });
    /* a logged sleep stops the game: out of the plaza, pill down; waking brings her back if she is still there */
    var wasAsleep = asleep();
    S.subscribe(function () { var now = asleep(); if (now === wasAsleep) return; wasAsleep = now; if (now) { stopTimers(); sync(); render(); } else if (inPlaza()) arrive(); });
    /* signing out: the session is gone, but the token she last used still lets the phone say she left */
    var lastUid = uid();
    if (A.subscribe) A.subscribe(function () {
      var u = uid(); if (u === lastUid) return;
      var before = lastUid; lastUid = u;
      if (before) { want = null; S.setState({ plaza: null }); stopTimers(); servers = null; listGen++; }
      if (u && have) have = null; /* another account now: the old row lapses by itself */
      sync(); if (u && inPlaza()) arrive(); render();
    });
    if (root.MutationObserver && R.els.hud) new root.MutationObserver(render).observe(R.els.hud, { attributes: true, attributeFilter: ['class'] });
  }
  R.on('boot', mount);
  P.state = function () { return { signedIn: !!uid(), joined: have ? Object.assign({}, have) : null, want: want, servers: servers ? servers.slice() : null, offline: offline, beating: !!tickT, inflight: inflight }; };
  P.open = openSheet; P.join = choose; P.leave = leaveForGood; P.refresh = refresh; P.tick = tick; /* tick is exported for the smoke suite, which cannot wait 25 s */
})(typeof window !== 'undefined' ? window : this);
