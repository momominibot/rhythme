/* Rhythme accounts: sign in with email (one-time code), Google or Apple, and
 * the small cloud-backup notice that signing in unlocks.
 *
 * A thin, dependency-free client over Supabase Auth (GoTrue) and its REST API,
 * using the publishable key and PKCE in the browser. It is quiet by design:
 * nothing touches the network until the person acts (sends a code, taps a
 * provider) or a saved session needs a refresh for a sync they asked for, so a
 * visitor who has not signed in makes no request to the auth or data service.
 *
 * All of the sign-in UI lives in the You tab (OvuAuth.renderAccount, called from
 * room.js openYou) and the cloud-backup notice is a small overlay this file
 * builds on the fly. It never touches the first-visit data notice (#consent).
 *
 * OAuth note: Google and Apple are wired and start working the moment their
 * provider is configured in Supabase and the matching flag in ovu-config.js is
 * turned on. Until then their buttons stay hidden; email works on its own. */
(function (root) {
  'use strict';
  var CFG = root.OVU_CONFIG || {};
  var AUTH_LS = 'ovumind_auth_v1';
  var PKCE_LS = 'ovumind_pkce_v1';
  var CLOUD_V = 1;
  var NOTICE_V = (root.OvuStore && root.OvuStore.NOTICE_V) || 3; /* the first-visit data notice this build asks for */
  var listeners = [];
  var authEpoch = 0; /* bumped on sign-out or account change, to drop stale async auth results */

  /* "Help improve logging": the one optional choice that lets Rhythme learn from diaries, and only in
   * group counts and averages across at least 20 consenting adults (docs/design/2026-10-19-data-capture-
   * dashboard-agents.md, section 10). The words below are the consent text itself: the consent sheet and
   * You both show them, and a hash of them is recorded with the choice on the account. Change them and the
   * notice version must move. Off until ticked; a tick made before any account is recorded on the first
   * sign-in; after that the account's own record is the truth and this phone mirrors it. */
  var IMPROVE = {
    title: 'Help improve logging, optional',
    body: 'Rhythme’s server may use the backed-up entries of adults who turned this on to compute group counts and averages, to improve logging, reminders and the app. Staff are shown only group results across at least 20 adults, never your entries, notes or name. You can turn this off at any time and keep your backup.'
  };
  function improveText() { return IMPROVE.title + '. ' + IMPROVE.body; }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function nowIso() { return new Date().toISOString(); }
  function oauthEnabled(p) { var o = CFG.oauth || {}; return o[p] === true; }

  /* ---------- session store (one object in localStorage) ---------- */
  function getSession() { try { var s = JSON.parse(localStorage.getItem(AUTH_LS) || 'null'); return s && s.access_token ? s : null; } catch (e) { return null; } }
  function setSession(j) {
    if (!j || !j.access_token) return null;
    var prev = getSession();
    var exp = j.expires_at ? Number(j.expires_at) : (Math.floor(Date.now() / 1000) + Number(j.expires_in || 3600));
    var s = { access_token: j.access_token, refresh_token: j.refresh_token || (prev && prev.refresh_token) || null, expires_at: exp, user: { id: j.user && j.user.id, email: j.user && j.user.email } };
    if (prev && prev.user && s.user && prev.user.id !== s.user.id) authEpoch++;
    try { localStorage.setItem(AUTH_LS, JSON.stringify(s)); } catch (e) { }
    notifyAuth(); return s;
  }
  function clearSession() { authEpoch++; try { localStorage.removeItem(AUTH_LS); } catch (e) { } notifyAuth(); }
  function session() { return getSession(); }
  function userId() { var s = getSession(); return s && s.user ? s.user.id : null; }
  function email() { var s = getSession(); return s && s.user ? s.user.email : null; }
  function isSignedIn() { return !!getSession(); }
  function notifyAuth() {
    listeners.slice().forEach(function (fn) { try { fn(); } catch (e) { } });
    /* the account's own grants (Rhythme Plus, tester mode) follow the person onto every device they sign in on */
    try { var s = getSession(); if (s && s.access_token && root.OvuPodcast && OvuPodcast.claimAccount) OvuPodcast.claimAccount(s.access_token).then(function (d) { if (d && (d.plus || d.tester) && root.OvuRoom && OvuRoom.renderProps) { OvuRoom.renderProps(); } }); } catch (e) { }
  }

  /* ---------- network ---------- */
  function call(method, path, body, bearer) {
    var h = { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' };
    if (bearer) h.Authorization = 'Bearer ' + bearer;
    return fetch(CFG.supabaseUrl + path, { method: method, headers: h, body: body != null ? JSON.stringify(body) : undefined }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
        if (!r.ok) { var e2 = new Error((j && (j.msg || j.error_description || j.error || j.message)) || ('request failed (' + r.status + ')')); e2.status = r.status; e2.code = (j && (j.code || j.error_code)) || null; throw e2; }
        return j;
      });
    });
  }
  /* A valid access token, refreshing if it is within a minute of expiry. Returns
     null if there is no session, if a refresh is rejected as invalid (then we
     sign out), or if the network is down (the saved login is kept for later). */
  function token() {
    var s = getSession();
    if (!s) return Promise.resolve(null);
    if (Date.now() < (s.expires_at * 1000) - 60000) return Promise.resolve(s.access_token);
    if (!s.refresh_token) { clearSession(); return Promise.resolve(null); }
    var ep = authEpoch, rt = s.refresh_token;
    /* guard against a sign-out or a different account signing in (even in another
       tab) while the refresh was in flight: only restore if the stored session is
       still the same one we refreshed. */
    function stillOurs() { var cur = getSession(); return authEpoch === ep && cur && cur.refresh_token === rt; }
    return call('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: rt }).then(
      function (j) { if (!stillOurs()) return null; var ns = setSession(j); return ns ? ns.access_token : null; },
      function (err) { if (stillOurs() && err && (err.status === 400 || err.status === 401 || err.status === 403)) clearSession(); return null; }
    );
  }
  function fetchUser(at) { return call('GET', '/auth/v1/user', null, at).then(function (u) { return { id: u && u.id, email: u && u.email }; }); }
  function sha256hex(s) {
    try {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))).then(function (h) { return Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }, function () { return ''; });
    } catch (e) { return Promise.resolve(''); }
  }

  /* ---------- "Help improve logging" (profile.analysis on this phone, public.analysis_consent on the account) ---------- */
  function improveLocal() { var p = root.OvuStore ? OvuStore.profile() : {}; var a = p && p.analysis; return a && typeof a === 'object' ? a : { on: false, v: null, at: null, uid: null, syncedAt: null }; }
  function writeImprove(patch) { if (root.OvuStore) OvuStore.setProfile({ analysis: Object.assign({}, improveLocal(), patch) }); }
  /* What to do once the account's own row is known. local: what this phone recorded; uid: the signed-in
     account; server: the account's row (null when it has none, undefined when not read yet).
     A tick made before any account, under the current notice, is recorded once, and only on an account that
     has never decided (no row at all): a withdrawn row is a decision and stays withdrawn. Everything else
     adopts the account's record, so a second phone or a different account never pushes a stale tick.
     Pure, so the harness can check every branch. */
  function improvePlan(local, uid, server) {
    if (!uid || server === undefined) return { action: 'none' };
    local = local || {};
    var serverOn = !!(server && server.accepted_at && !server.withdrawn_at);
    if (local.on === true && !local.uid && local.v === NOTICE_V && server === null) return { action: 'push', on: true };
    return { action: 'adopt', on: serverOn, since: serverOn ? server.accepted_at : null, notice: server ? server.notice_version : null, scope: serverOn ? (server.history_scope || 'from_now') : null, rev: (server && server.updated_at) || null };
  }
  function fromRow(row, uid) { /* the phone's mirror of the account's row, as the server returned it */
    var active = !!(row && row.accepted_at && !row.withdrawn_at);
    return { on: active, v: (row && row.notice_version) || NOTICE_V, at: active ? row.accepted_at : nowIso(), uid: uid, syncedAt: nowIso(), scope: active ? (row.history_scope || 'from_now') : null, rev: (row && row.updated_at) || null };
  }
  var RPC = '/rest/v1/rpc/analysis_consent_set';
  function improveFetch() { /* the account's row; null when it has none; rejects when offline */
    return token().then(function (at) {
      if (!at) return undefined;
      return call('GET', '/rest/v1/analysis_consent?select=notice_version,history_scope,accepted_at,withdrawn_at,updated_at&user_id=eq.' + encodeURIComponent(userId()), null, at)
        .then(function (rows) { return Array.isArray(rows) && rows.length ? rows[0] : null; });
    });
  }
  /* records the choice on the account, with the notice version the choice was made under and a hash of the words; resolves to the row.
     rev is the row's last change as this phone saw it (updated_at): when given, the server refuses with SQLSTATE 40001 if another
     phone changed the choice since, and the phone re-reads instead of overwriting. */
  function reqId() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  /* opts.expectNone: an automatic first binding, refused (40001) when any decision already exists on the account; opts.reqId: a
     stable id for this logical request, so a resend after a lost reply returns the same receipt and writes nothing */
  function improveSend(on, v, rev, opts) {
    opts = opts || {};
    return token().then(function (at) {
      if (!at) throw new Error('Please sign in again.');
      var args = { p_on: !!on, p_request_id: opts.reqId || reqId() }; if (rev) args.p_expected_updated_at = rev; if (opts.expectNone) args.p_expect_none = true;
      if (!on) return call('POST', RPC, args, at);
      var p = root.OvuStore ? OvuStore.profile() : {};
      return sha256hex(improveText()).then(function (h) {
        args.p_notice = v || NOTICE_V; args.p_age_band = String(p.ageRange || 'adult').slice(0, 12); /* every account is an adult after the gate; the optional range only refines */ args.p_scope = 'from_now'; args.p_hash = h || null;
        return call('POST', RPC, args, at);
      });
    });
  }
  function isConflict(err) { return !!(err && (err.code === '40001' || /another phone/i.test(err.message || ''))); }
  var improveRead = {}; /* uid -> true once this session has read the account's row, 'failed' when the read failed (retried when You is opened again) */
  var improveSeq = 0; /* bumped by every choice, so a read or write that started earlier can never overwrite a newer choice */
  var improveInflight = {}; /* uid -> the reconcile promise in flight, so a sign-in and an open You panel share one */
  /* The person's choice, from the consent sheet or the switch in You. Signed out and never bound to an
     account: kept on this phone for the first sign-in. Signed out but belonging to an account: refused,
     sign in to change it. Signed in: recorded on the account first and only then shown as changed; if
     the request fails the switch goes back to what the account holds. */
  function noteImprove(on, method, extra) { try { if (root.OvuConsent && OvuConsent.allows('improve_logging') !== !!on) OvuConsent.record('improve_logging', on ? 'grant' : 'withdraw', method || 'you', extra); } catch (e) { } }
  function setImprove(on, method) {
    on = !!on;
    var prev = improveLocal(), uid = userId() || null, seq = ++improveSeq;
    if (!uid) {
      if (prev.uid) return Promise.resolve({ ok: false, error: 'Sign in to change this.' });
      writeImprove({ on: on, v: NOTICE_V, at: nowIso(), uid: null, syncedAt: null, scope: null }); noteImprove(on, method);
      return Promise.resolve({ ok: true, local: true });
    }
    /* a withdrawal always reaches the account, whatever this phone's mirror says, so the aggregate and the record never disagree */
    var rev = prev.uid === uid && prev.syncedAt ? (prev.rev || null) : null; /* the row as this phone last saw it, so a change from another phone is caught */
    return improveSend(on, NOTICE_V, rev, { reqId: reqId() }).then(function (row) {
      if (userId() === uid && improveSeq === seq) { writeImprove(fromRow(row, uid)); noteImprove(on, method); }
      return { ok: true };
    }, function (err) {
      if (improveSeq === seq) writeImprove(prev); /* back to what the account holds */
      if (isConflict(err) && improveSeq === seq) { delete improveRead[uid]; return syncImprove().then(function () { return { ok: false, conflict: true, error: (err && err.message) || 'This choice was changed on another phone just now.' }; }); }
      return { ok: false, error: (err && err.message) || 'try again' };
    });
  }
  /* Read the account's record and reconcile (see improvePlan). Called after a sign-in and when the You panel opens signed in. */
  function syncImprove() {
    var uid = userId(); if (!uid) return Promise.resolve({ action: 'none' });
    if (improveInflight[uid]) return improveInflight[uid];
    var seq = improveSeq;
    var p = improveFetch().then(function (server) {
      improveRead[uid] = true;
      if (userId() !== uid) return { action: 'none' };
      if (improveSeq !== seq) return { action: 'superseded' }; /* a choice was made while this read was in flight; it wins */
      var plan = improvePlan(improveLocal(), uid, server);
      if (plan.action === 'push') {
        writeImprove({ uid: uid }); /* bound to this account before anything is sent, so no other account can inherit the tick */
        return improveSend(true, improveLocal().v || NOTICE_V, null, { expectNone: true, reqId: reqId() }).then(
          function (row) { if (userId() === uid && improveSeq === seq) writeImprove(fromRow(row, uid)); return plan; },
          function (err) {
            if (improveSeq !== seq) return { action: 'failed' };
            if (isConflict(err)) { delete improveRead[uid]; delete improveInflight[uid]; return syncImprove(); } /* a decision landed on the account meanwhile (a first refusal on another phone): adopt it, never overwrite it */
            writeImprove({ on: false, uid: uid, syncedAt: null, scope: null }); return { action: 'failed' }; }); /* not recorded: shown off, the person can tick again */
      }
      var l = improveLocal();
      if (l.on !== plan.on || l.uid !== uid || !l.syncedAt || (l.scope || null) !== plan.scope || (l.rev || null) !== plan.rev) writeImprove({ on: plan.on, v: plan.notice || l.v || NOTICE_V, at: plan.since || l.at || nowIso(), uid: uid, syncedAt: nowIso(), scope: plan.scope, rev: plan.rev });
      noteImprove(plan.on, 'import', { sent: true, notice: plan.notice || NOTICE_V });
      return plan;
    }, function () { improveRead[uid] = 'failed'; return { action: 'offline' }; });
    improveInflight[uid] = p.then(function (r) { delete improveInflight[uid]; return r; }, function (e) { delete improveInflight[uid]; throw e; });
    return improveInflight[uid];
  }
  function fmtDay(iso) { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function improveHTML(signed) {
    var l = improveLocal(), uid = userId(), mine = signed && l.uid === uid;
    var read = signed ? improveRead[uid] : true, pending = signed && !read, failed = signed && read === 'failed';
    var on = signed ? (mine && l.on === true) : l.on === true;
    var disabled = pending || failed || (!signed && !!l.uid);
    var state = pending ? 'Checking your account…'
      : failed ? 'Could not reach your account just now. Open You again to retry.'
      : signed ? (on ? ('On for this account' + (l.at ? ' since ' + fmtDay(l.at) : '') + (l.scope === 'all' ? ', including your earlier entries' : '')) : 'Off')
      : l.uid ? (l.on ? 'On for the account that turned it on. Sign in to change it.' : 'Off for the account that set it. Sign in to change it.')
      : (l.on ? 'Saved on this phone. It is recorded on your account when you sign in.' : 'Off');
    return '<label class="perm ya-improve"><input type="checkbox" id="yaImprove"' + (on ? ' checked' : '') + (disabled ? ' disabled' : '') + '><span class="ms">volunteer_activism</span><div><b>' + esc(IMPROVE.title) + '</b><span>' + esc(IMPROVE.body) + '</span><small class="ya-state" aria-live="polite">' + esc(state) + '</small></div></label>';
  }

  /* ---------- email one-time code ---------- */
  function sendCode(addr) { return call('POST', '/auth/v1/otp', { email: String(addr || '').trim(), create_user: true }); }
  /* Why a code could not be sent, in plain words. Supabase's own email service sends at most 2 sign-in emails an hour for
   * the whole project, and one per minute to the same address (supabase.com/docs/guides/auth/rate-limits, 20 Oct 2026).
   * limited: a code that already arrived can still be typed in, so the code box opens. */
  function sendError(err) {
    var t = String((err && err.message) || ''), wait = /after (\d+) seconds?/i.exec(t);
    if (wait) return { limited: true, text: 'Please wait ' + wait[1] + ' seconds before asking for another code. If a code already arrived, type it below.' };
    if ((err && err.status === 429) || /rate limit|over_email_send_rate_limit/i.test(t + ' ' + ((err && err.code) || ''))) return { limited: true, text: 'Too many sign-in emails went out in the last hour (the email service sends 2 an hour for now). If a code already arrived, type it below. Otherwise try again in about an hour.' };
    return { limited: false, text: t ? 'Could not send the code: ' + t : 'Could not send the code. Try again.' };
  }
  function verifyCode(addr, code) {
    return call('POST', '/auth/v1/verify', { type: 'email', email: String(addr || '').trim(), token: String(code || '').trim() }).then(function (j) {
      setSession(j); onSignedIn(); return j;
    });
  }

  /* ---------- OAuth (Google / Apple) via PKCE ---------- */
  function b64url(buf) { var s = ''; new Uint8Array(buf).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function verifier() { var a = new Uint8Array(32); crypto.getRandomValues(a); return b64url(a.buffer); }
  function challenge(v) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)).then(function (h) { return b64url(h); }); }
  function redirectTo() { return location.origin + location.pathname; }
  function signInWith(provider) {
    var v = verifier();
    return challenge(v).then(function (cc) {
      try { localStorage.setItem(PKCE_LS, JSON.stringify({ v: v, at: Date.now() })); } catch (e) { }
      location.href = CFG.supabaseUrl + '/auth/v1/authorize?provider=' + encodeURIComponent(provider) +
        '&redirect_to=' + encodeURIComponent(redirectTo()) + '&code_challenge=' + cc + '&code_challenge_method=s256';
    });
  }
  function cleanUrl() { try { history.replaceState(null, '', location.pathname); } catch (e) { } }
  /* On load after an OAuth round trip the URL carries ?code= (PKCE); exchange it
     for a session. Returns quietly (no network) on an ordinary load. */
  function handleRedirect() {
    var sp; try { sp = new URLSearchParams(location.search); } catch (e) { return Promise.resolve({}); }
    var err = sp.get('error_description') || sp.get('error');
    if (err) { cleanUrl(); return Promise.resolve({ error: err }); }
    var code = sp.get('code');
    if (code) {
      var pk = null; try { pk = JSON.parse(localStorage.getItem(PKCE_LS) || 'null'); } catch (e) { }
      cleanUrl();
      if (!pk || !pk.v) return Promise.resolve({ error: 'This sign-in link was opened on a different device or browser. Please try again here.' });
      return call('POST', '/auth/v1/token?grant_type=pkce', { auth_code: code, code_verifier: pk.v }).then(function (j) {
        try { localStorage.removeItem(PKCE_LS); } catch (e) { }
        setSession(j); onSignedIn(); return { signedIn: true };
      });
    }
    /* an emailed sign-in link lands back with tokens in the URL fragment */
    if (location.hash && location.hash.indexOf('access_token=') > -1) {
      var hp; try { hp = new URLSearchParams(location.hash.slice(1)); } catch (e) { hp = null; }
      var at = hp && hp.get('access_token');
      if (at) {
        cleanUrl();
        var sess = { access_token: at, refresh_token: hp.get('refresh_token'), expires_at: Number(hp.get('expires_at')) || undefined, expires_in: Number(hp.get('expires_in') || 3600) };
        return fetchUser(at).then(function (u) { sess.user = u; setSession(sess); onSignedIn(); return { signedIn: true }; }, function () { return { error: 'Could not complete sign-in. Please try the six-digit code.' }; });
      }
    }
    return Promise.resolve({});
  }

  /* ---------- sign out / account ---------- */
  function signOut(removeLocal) {
    var s = getSession();
    var done = function () {
      clearSession();
      if (root.OvuSync) OvuSync.resetPosition();
      if (removeLocal && root.OvuStore) {
        try { OvuStore.clearAll(); } catch (e) { }
        ['ovumind_ai_v1', 'ovumind_desk_v1', 'ovumind_nova_words', 'ovuluna_onboarding'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { } });
        try { location.replace('room.html'); } catch (e) { }
      }
    };
    if (s) return call('POST', '/auth/v1/logout', {}, s.access_token).then(done, done);
    done(); return Promise.resolve();
  }

  /* ---------- after any sign-in ---------- */
  /* Cloud consent belongs to the account that gave it, so a different account
     signing in on this phone is asked again before anything syncs. */
  function hasCloud() { var p = root.OvuStore ? OvuStore.profile() : {}; return !!(p.cloud && p.cloud.v >= CLOUD_V && p.cloud.at && p.cloud.uid === userId()); }
  function onSignedIn() {
    try { if (root.OvuConsent) OvuConsent.bindAccount(); } catch (e) { } /* a choice made before any account belongs to this one now */
    rerenderOpen();
    if (!hasCloud()) promptCloud();
    else if (root.OvuSync) OvuSync.syncNow();
    syncImprove().then(rerenderOpen);
  }

  /* ---------- cloud-backup notice (its own overlay, never #consent) ---------- */
  function promptCloud() {
    if (document.getElementById('ovuCloudSheet')) return;
    ensureStyle();
    var wrap = document.createElement('div');
    wrap.id = 'ovuCloudSheet'; wrap.className = 'ovu-cloud-veil'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-labelledby', 'ovuCloudTitle');
    wrap.innerHTML =
      '<div class="ovu-cloud-card">' +
      '<div class="ovu-cloud-head"><span class="ms">cloud_sync</span><h2 id="ovuCloudTitle">Cloud backup</h2></div>' +
      '<p>Back up your diary to your account so you can sign in on another phone and carry on where you left off. It is optional, and off until you turn it on here.</p>' +
      '<ul class="ovu-cloud-list">' +
      '<li><span class="ms">inventory_2</span><span><b>What is saved</b><small>Your entries, your getting-to-know-you answers and your cycle settings. Food photo thumbnails are never uploaded.</small></span></li>' +
      '<li><span class="ms">public</span><span><b>Where it lives</b><small>A secure database hosted in Singapore, tied to your account. Other Rhythme users cannot see your backup. Rhythme’s server uses it to back up, restore and delete your diary, and authorised Rhythme administrators and the companies that run the database can reach it only to run, secure or support the service. Learning from your records to improve the app is a separate choice, off unless you turn it on.</small></span></li>' +
      '<li><span class="ms">delete</span><span><b>You can undo it</b><small>Turn backup off, or delete your account and its cloud copy, any time from Your account.</small></span></li>' +
      '<li><span class="ms">dark_mode</span><span><b>Luna is unchanged</b><small>This is only about backing up your diary. Luna’s AI help settings stay exactly as you set them.</small></span></li>' +
      '</ul>' +
      '<div class="ovu-cloud-btns"><button type="button" class="btn primary" id="ovuCloudYes"><span class="ms">cloud_done</span>Turn on backup</button><button type="button" class="btn ghost" id="ovuCloudNo">Not now</button></div>' +
      '</div>';
    document.body.appendChild(wrap);
    var close = function () { try { wrap.remove(); } catch (e) { wrap.parentNode && wrap.parentNode.removeChild(wrap); } };
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    document.getElementById('ovuCloudNo').addEventListener('click', function () { close(); rerenderOpen(); });
    document.getElementById('ovuCloudYes').addEventListener('click', function () {
      try { if (root.OvuConsent) OvuConsent.grant('cloud_sync', 'sheet'); else if (root.OvuStore) OvuStore.setProfile({ cloud: { v: CLOUD_V, at: nowIso(), uid: userId() } }); } catch (e) { }
      close(); rerenderOpen();
      if (root.OvuSync) OvuSync.syncNow();
    });
    try { document.getElementById('ovuCloudYes').focus({ preventScroll: true }); } catch (e) { }
  }

  function ensureStyle() {
    if (document.getElementById('ovuAuthStyle')) return;
    var s = document.createElement('style'); s.id = 'ovuAuthStyle';
    s.textContent =
      '.ovu-cloud-veil{position:fixed;inset:0;z-index:120;display:flex;align-items:flex-end;justify-content:center;background:rgba(40,28,52,.45);backdrop-filter:blur(3px);padding:0}' +
      '@media(min-width:640px){.ovu-cloud-veil{align-items:center;padding:20px}}' +
      '.ovu-cloud-card{background:var(--card,#fff);color:var(--ink,#2a2130);width:100%;max-width:460px;border-radius:22px 22px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(40,28,52,.25);max-height:88vh;overflow:auto}' +
      '@media(min-width:640px){.ovu-cloud-card{border-radius:22px}}' +
      '.ovu-cloud-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}.ovu-cloud-head .ms{font-size:26px;color:var(--accent,#b57edc)}.ovu-cloud-head h2{margin:0;font-size:20px}' +
      '.ovu-cloud-list{list-style:none;margin:14px 0 4px;padding:0;display:grid;gap:12px}' +
      '.ovu-cloud-list li{display:flex;gap:10px;align-items:flex-start}.ovu-cloud-list .ms{font-size:20px;color:var(--accent,#b57edc);flex:0 0 auto;margin-top:1px}' +
      '.ovu-cloud-list b{display:block;font-size:14px}.ovu-cloud-list small{display:block;color:var(--muted,#6b6475);font-size:12.5px;line-height:1.45}' +
      '.ovu-cloud-btns{display:flex;gap:10px;margin-top:18px}.ovu-cloud-btns .btn{flex:1}' +
      '.ya-intro{color:var(--muted,#6b6475);font-size:13px;margin:2px 0 10px;line-height:1.5}' +
      '.ya-btns{display:grid;gap:8px}.ya-who{display:flex;gap:10px;align-items:center;padding:4px 2px 10px}.ya-who .ms{font-size:24px;color:var(--accent,#b57edc)}.ya-who b{display:block;font-size:14px}.ya-who small{display:block;color:var(--muted,#6b6475);font-size:12.5px}' +
      '.ya-email{margin-top:10px}.ya-code{letter-spacing:.3em;text-align:center;font-size:18px}.ya-danger{color:#b4412f}' +
      '.ya-improve{margin-top:12px}.ya-improve span:not(.ms){display:block;font-weight:500;line-height:1.45}.ya-state{display:block;margin-top:5px;font-size:12px;color:var(--muted,#6b6475)}';
    document.head.appendChild(s);
  }

  /* ---------- account UI in the You tab ---------- */
  var openCtx = null; /* { el, opts } while the You sheet shows the account */
  function rerenderOpen() { if (openCtx && document.body.contains(openCtx.el)) renderAccount(openCtx.el, Object.assign({}, openCtx.opts, { _rerender: true })); }
  function toastVia(opts, text, icon) { if (opts && typeof opts.toast === 'function') opts.toast(text, icon); }

  function renderAccount(el, opts) {
    if (!el) return;
    ensureStyle();
    opts = opts || {}; openCtx = { el: el, opts: opts };
    var signed = isSignedIn();
    var html = '<div class="ygroup"><span class="lbl">Your account</span>';
    if (!signed) {
      html += '<p class="ya-intro">Sign in to back up your diary and pick it up on another phone. Your diary stays on this phone unless you sign in and turn on cloud backup.</p>' +
        '<div class="ya-btns">' +
        (oauthEnabled('google') ? '<button type="button" class="btn soft" data-ya="oauth" data-prov="google"><span class="ms">login</span>Continue with Google</button>' : '') +
        (oauthEnabled('apple') ? '<button type="button" class="btn soft" data-ya="oauth" data-prov="apple"><span class="ms">login</span>Continue with Apple</button>' : '') +
        '<button type="button" class="btn soft" data-ya="email-start"><span class="ms">mail</span>Continue with email</button>' +
        '</div>' +
        '<form class="ya-email" id="yaEmailForm" hidden autocomplete="on">' +
        '<div class="field"><label for="yaEmail">Your email</label><input class="input" id="yaEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"></div>' +
        '<div class="field" id="yaCodeWrap" hidden><label for="yaCode">Six-digit code we emailed you</label><input class="input ya-code" id="yaCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="------"></div>' +
        '<div class="row"><button type="submit" class="btn primary" id="yaEmailGo"><span class="ms">send</span>Send me a code</button></div>' +
        '<p class="msg" id="yaMsg" aria-live="polite"></p>' +
        '</form>' + improveHTML(false);
    } else {
      var cloud = hasCloud();
      var st = root.OvuSync ? OvuSync.status() : { lastSyncAt: null, state: 'idle' };
      var when = st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
      var held = cloud && st.held ? st.held : 0; /* Movement entries the server cannot take yet stay on this phone (ovu-sync.js) */
      var sub = cloud ? (st.state === 'syncing' ? 'Backing up…' : st.state === 'error' ? 'Backup paused, will retry' : held ? 'Cloud backup on · ' + held + ' Movement ' + (held === 1 ? 'entry' : 'entries') + ' not backed up yet' : (when ? 'Cloud backup on · last sync ' + when : 'Cloud backup on')) : 'Signed in · cloud backup off';
      html += '<div class="ya-who"><span class="ms">' + (cloud ? 'cloud_done' : 'account_circle') + '</span><div><b>' + esc(email() || 'Your account') + '</b><small>' + esc(sub) + '</small></div></div>' +
        '<div class="ya-btns">' +
        (cloud ? '<button type="button" class="btn soft" data-ya="sync"><span class="ms">sync</span>Sync now</button><button type="button" class="btn ghost" data-ya="disable-cloud"><span class="ms">cloud_off</span>Turn off cloud backup</button>' : '<button type="button" class="btn primary" data-ya="enable-cloud"><span class="ms">cloud_upload</span>Turn on cloud backup</button><button type="button" class="btn ghost ya-danger" data-ya="wipe-cloud"><span class="ms">delete</span>Delete the cloud copy</button>') + /* with backup off a copy can still be there (kept, or a delete that failed): she can always delete it (Codex legal review, 20 Oct) */
        '<button type="button" class="btn ghost" data-ya="signout"><span class="ms">logout</span>Sign out</button>' +
        '<button type="button" class="btn ghost ya-danger" data-ya="delete-account"><span class="ms">delete_forever</span>Delete my account</button>' +
        '</div><p class="help">' + (cloud ? (held ? 'Your diary is backed up except ' + held + ' Movement ' + (held === 1 ? 'entry, which stays' : 'entries, which stay') + ' on this phone until the backup can take ' + (held === 1 ? 'it' : 'them') + '. Please keep this phone’s data until then. ' : 'Your diary is backed up to your account and kept in step across your phones. ') + 'Food photos stay on this phone.' : 'Backup is off. Your account, your choices and the features you use, such as the plaza and Plus, still talk to their services. Turn backup on to keep a copy of your diary in your account.') + '</p>' +
        improveHTML(true);
    }
    html += '</div>';
    el.innerHTML = html;
    wire(el, opts);
    if (signed) { var u = userId(), rd = improveRead[u]; if (!rd || (rd === 'failed' && !opts._rerender)) syncImprove().then(rerenderOpen); }
  }

  function wire(el, opts) {
    var msg = function (text, ok) { var m = el.querySelector('#yaMsg'); if (m) { m.textContent = text; m.className = 'msg on ' + (ok ? 'ok' : 'err'); } };
    var form = el.querySelector('#yaEmailForm');
    var stage = 'email';
    /* assign (not addEventListener) so a re-render never stacks handlers */
    el.onclick = function (e) {
      var b = e.target.closest('[data-ya]'); if (!b) return;
      var act = b.dataset.ya;
      if (act === 'email-start') { if (form) { form.hidden = false; var i = el.querySelector('#yaEmail'); if (i) i.focus(); } return; }
      if (act === 'oauth') { b.disabled = true; signInWith(b.dataset.prov).catch(function (err) { b.disabled = false; toastVia(opts, 'Could not start sign-in: ' + err.message, 'error'); }); return; }
      if (act === 'sync') { toastVia(opts, 'Syncing…', 'sync'); OvuSync.syncNow().then(function (r) { toastVia(opts, r && r.ok ? (r.held ? 'Backed up, except ' + r.held + ' Movement ' + (r.held === 1 ? 'entry' : 'entries') + ' kept on this phone for now.' : 'Backed up.') : ('Sync failed: ' + ((r && r.error) || 'try again')), r && r.ok ? (r.held ? 'cloud_sync' : 'cloud_done') : 'error'); rerenderOpen(); }); return; }
      if (act === 'enable-cloud') { promptCloud(); return; }
      if (act === 'disable-cloud') { confirmDisableCloud(el, opts); return; }
      if (act === 'wipe-cloud') { confirmWipeCloud(el, opts); return; }
      if (act === 'signout') { confirmSignOut(el, opts); return; }
      if (act === 'delete-account') { confirmDelete(el, opts); return; }
    };
    el.onchange = function (e) {
      var t = e.target; if (!t || t.id !== 'yaImprove') return;
      var on = !!t.checked; t.disabled = true;
      setImprove(on).then(function (r) {
        toastVia(opts, r.ok ? (on ? 'Thank you. Help improve logging is on.' : 'Help improve logging is off.') : ('Could not save that to your account: ' + r.error), r.ok ? 'check_circle' : 'error');
        rerenderOpen();
      });
    };
    if (form) form.onsubmit = function (e) {
      e.preventDefault();
      var go = el.querySelector('#yaEmailGo'), emailEl = el.querySelector('#yaEmail'), codeWrap = el.querySelector('#yaCodeWrap'), codeEl = el.querySelector('#yaCode');
      var addr = (emailEl.value || '').trim();
      if (stage === 'email') {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) { msg('Please enter a real email address.'); return; }
        go.disabled = true; msg('Sending…', true);
        sendCode(addr).then(function () {
          stage = 'code'; go.disabled = false; codeWrap.hidden = false; emailEl.readOnly = true;
          go.innerHTML = '<span class="ms">login</span>Verify and sign in';
          msg('We emailed a six-digit code to ' + addr + '. Enter it here. If a sign-in link arrives instead, open it on this phone.', true);
          if (codeEl) codeEl.focus();
        }, function (err) {
          var se = sendError(err); go.disabled = false; msg(se.text);
          if (se.limited) { stage = 'code'; codeWrap.hidden = false; emailEl.readOnly = true; go.innerHTML = '<span class="ms">login</span>Verify and sign in'; if (codeEl) codeEl.focus(); } /* a code already in the inbox still works */
        });
      } else {
        var code = (codeEl.value || '').replace(/\s/g, '');
        if (!/^\d{6}$/.test(code)) { msg('Enter the six-digit code from the email.'); return; }
        go.disabled = true; msg('Checking…', true);
        verifyCode(addr, code).then(function () { toastVia(opts, 'Signed in.', 'cloud_done'); }, function (err) { go.disabled = false; msg(err.message || 'That code did not match. Check it, or send a new one.'); });
      }
    };
  }

  /* delete whatever copy the account holds, with backup on or off; the server does not guard deletes on consent */
  function confirmWipeCloud(el, opts) {
    var g = el.querySelector('.ygroup'); if (!g || g.querySelector('.ya-confirm')) return;
    var box = document.createElement('div'); box.className = 'flag watch ya-confirm'; box.style.marginTop = '10px';
    box.innerHTML = '<span class="ms">delete</span><div><b>Delete the cloud copy?</b><span>This deletes the entries and settings kept in your account. Your diary on this phone stays, and your account stays until you delete it.</span>' +
      '<div class="row"><button type="button" class="btn ghost ya-danger" data-wc="yes"><span class="ms">delete</span>Delete the cloud copy</button><button type="button" class="btn ghost" data-wc="no">Keep it</button></div></div>';
    g.appendChild(box); box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.onclick = function (e) { var b = e.target.closest('[data-wc]'); if (!b) return;
      if (b.dataset.wc === 'no') { box.remove(); return; }
      if (!(root.OvuSync && OvuSync.wipeCloud)) { toastVia(opts, 'Deleting the cloud copy is not available here. Write to hello@ranklore.ai and we will do it.', 'error'); return; }
      b.disabled = true;
      OvuSync.wipeCloud().then(function () { toastVia(opts, 'The copy in your account is deleted. Your diary is still on this phone.', 'delete'); rerenderOpen(); },
        function (err) { b.disabled = false; toastVia(opts, 'The copy could not be deleted just now: ' + err.message + '. Try again, or write to hello@ranklore.ai.', 'error'); });
    };
  }
  function confirmDisableCloud(el, opts) {
    var g = el.querySelector('.ygroup'); if (!g) return;
    if (g.querySelector('.ya-confirm')) return;
    var box = document.createElement('div'); box.className = 'flag watch ya-confirm'; box.style.marginTop = '10px';
    box.innerHTML = '<span class="ms">cloud_off</span><div><b>Turn off cloud backup?</b><span>This phone stops backing up and syncing from now on, and the change is kept on your record. Keep the copy already in your account, or delete it now; either way you can turn backup on again any time.</span>' +
      '<div class="row"><button type="button" class="btn soft" data-dc="keep"><span class="ms">cloud_off</span>Turn off, keep the copy</button><button type="button" class="btn ghost ya-danger" data-dc="wipe"><span class="ms">delete</span>Turn off and delete the copy</button></div>' +
      '<div class="row"><button type="button" class="btn ghost" data-dc="no">Keep it on</button></div></div>';
    g.appendChild(box); box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.onclick = function (e) { var b = e.target.closest('[data-dc]'); if (!b) return; var what = b.dataset.dc;
      if (what === 'no') { box.remove(); return; }
      try { if (root.OvuConsent) OvuConsent.withdraw('cloud_sync', 'you'); else if (root.OvuStore) OvuStore.setProfile({ cloud: { v: 0, at: nowIso() } }); } catch (err) { }
      if (root.OvuSync && OvuSync.resetPosition) OvuSync.resetPosition();
      if (what === 'wipe' && root.OvuSync && OvuSync.wipeCloud) {
        b.disabled = true;
        OvuSync.wipeCloud().then(function () { toastVia(opts, 'Cloud backup is off and the copy in your account is deleted. Your diary is still on this phone.', 'cloud_off'); rerenderOpen(); },
          function (err) { toastVia(opts, 'Backup is off, but the copy could not be deleted just now: ' + err.message + '. Tap Delete the cloud copy in Your account to try again.', 'error'); rerenderOpen(); });
        return;
      }
      toastVia(opts, 'Cloud backup is off. New entries stay on this phone; the copy in your account is kept until you delete it.', 'cloud_off'); rerenderOpen();
    };
  }

  function confirmSignOut(el, opts) {
    var g = el.querySelector('.ygroup'); if (!g) return;
    if (g.querySelector('.ya-confirm')) return;
    var box = document.createElement('div'); box.className = 'flag watch ya-confirm'; box.style.marginTop = '10px';
    box.innerHTML = '<span class="ms">logout</span><div><b>Sign out?</b><span>Your diary stays on this phone. You can sign back in any time to keep backing up.</span>' +
      '<div class="row"><button type="button" class="btn soft" data-so="keep"><span class="ms">logout</span>Sign out, keep my diary</button><button type="button" class="btn ghost ya-danger" data-so="remove"><span class="ms">delete</span>Sign out and remove from this phone</button></div>' +
      '<div class="row"><button type="button" class="btn ghost" data-so="cancel">Cancel</button></div></div>';
    g.appendChild(box); box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.onclick = function (e) { var b = e.target.closest('[data-so]'); if (!b) return; var a = b.dataset.so;
      if (a === 'cancel') { box.remove(); return; }
      if (a === 'keep') { signOut(false).then(function () { toastVia(opts, 'Signed out. Your diary is still here.', 'check_circle'); rerenderOpen(); }); }
      if (a === 'remove') { signOut(true); } /* reloads the room */
    };
  }

  function confirmDelete(el, opts) {
    var g = el.querySelector('.ygroup'); if (!g) return;
    if (g.querySelector('.ya-confirm')) return;
    var box = document.createElement('div'); box.className = 'flag high ya-confirm'; box.style.marginTop = '10px';
    box.innerHTML = '<span class="ms">warning</span><div><b>Delete your account and its cloud copy?</b><span>This removes your account and everything backed up to it, for good. Your diary on this phone is kept. Export a copy first if you want one.</span>' +
      '<div class="row"><button type="button" class="btn danger" data-da="yes"><span class="ms">delete_forever</span>Delete my account</button><button type="button" class="btn ghost" data-da="no">Keep my account</button></div></div>';
    g.appendChild(box); box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.onclick = function (e) { var b = e.target.closest('[data-da]'); if (!b) return;
      if (b.dataset.da === 'no') { box.remove(); return; }
      b.disabled = true; b.innerHTML = '<span class="ms">hourglass_empty</span>Deleting…';
      OvuSync.deleteAccount().then(function () { clearSession(); toastVia(opts, 'Your account and its backup are deleted. Your diary is still on this phone.', 'check_circle'); rerenderOpen(); },
        function (err) { b.disabled = false; b.innerHTML = '<span class="ms">delete_forever</span>Delete my account'; toastVia(opts, 'Could not delete the account: ' + err.message, 'error'); });
    };
  }

  function init() {
    handleRedirect().then(function (r) {
      if (r && r.error) { try { if (window.console) console.warn('sign-in:', r.error); } catch (e) { } }
    });
  }

  root.OvuAuth = {
    init: init, renderAccount: renderAccount,
    session: session, userId: userId, email: email, isSignedIn: isSignedIn, token: token,
    sendCode: sendCode, sendError: sendError, verifyCode: verifyCode, signInWith: signInWith, signOut: signOut,
    promptCloud: promptCloud, hasCloud: hasCloud,
    NOTICE_V: NOTICE_V, IMPROVE: IMPROVE, improveText: improveText, improvePlan: improvePlan, improveLocal: improveLocal, setImprove: setImprove, syncImprove: syncImprove,
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }
  };
})(window);
