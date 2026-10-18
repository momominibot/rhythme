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
  var listeners = [];
  var authEpoch = 0; /* bumped on sign-out or account change, to drop stale async auth results */

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
        if (!r.ok) { var e2 = new Error((j && (j.msg || j.error_description || j.error || j.message)) || ('request failed (' + r.status + ')')); e2.status = r.status; throw e2; }
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

  /* ---------- email one-time code ---------- */
  function sendCode(addr) { return call('POST', '/auth/v1/otp', { email: String(addr || '').trim(), create_user: true }); }
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
    rerenderOpen();
    if (!hasCloud()) promptCloud();
    else if (root.OvuSync) OvuSync.syncNow();
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
      '<li><span class="ms">public</span><span><b>Where it lives</b><small>A secure database hosted outside Singapore, tied to your account and set up so only your signed-in account can read it.</small></span></li>' +
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
      try { if (root.OvuStore) OvuStore.setProfile({ cloud: { v: CLOUD_V, at: nowIso(), uid: userId() } }); } catch (e) { }
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
      '.ya-email{margin-top:10px}.ya-code{letter-spacing:.3em;text-align:center;font-size:18px}.ya-danger{color:#b4412f}';
    document.head.appendChild(s);
  }

  /* ---------- account UI in the You tab ---------- */
  var openCtx = null; /* { el, opts } while the You sheet shows the account */
  function rerenderOpen() { if (openCtx && document.body.contains(openCtx.el)) renderAccount(openCtx.el, openCtx.opts); }
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
        '</form>';
    } else {
      var cloud = hasCloud();
      var st = root.OvuSync ? OvuSync.status() : { lastSyncAt: null, state: 'idle' };
      var when = st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
      var sub = cloud ? (st.state === 'syncing' ? 'Backing up…' : st.state === 'error' ? 'Backup paused, will retry' : (when ? 'Cloud backup on · last sync ' + when : 'Cloud backup on')) : 'Signed in · cloud backup off';
      html += '<div class="ya-who"><span class="ms">' + (cloud ? 'cloud_done' : 'account_circle') + '</span><div><b>' + esc(email() || 'Your account') + '</b><small>' + esc(sub) + '</small></div></div>' +
        '<div class="ya-btns">' +
        (cloud ? '<button type="button" class="btn soft" data-ya="sync"><span class="ms">sync</span>Sync now</button><button type="button" class="btn ghost" data-ya="disable-cloud"><span class="ms">cloud_off</span>Turn off cloud backup</button>' : '<button type="button" class="btn primary" data-ya="enable-cloud"><span class="ms">cloud_upload</span>Turn on cloud backup</button>') +
        '<button type="button" class="btn ghost" data-ya="signout"><span class="ms">logout</span>Sign out</button>' +
        '<button type="button" class="btn ghost ya-danger" data-ya="delete-account"><span class="ms">delete_forever</span>Delete my account</button>' +
        '</div><p class="help">' + (cloud ? 'Your diary is backed up to your account and kept in step across your phones. Food photos stay on this phone.' : 'Backup is off, so nothing leaves this phone yet. Turn it on to back up your diary.') + '</p>';
    }
    html += '</div>';
    el.innerHTML = html;
    wire(el, opts);
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
      if (act === 'sync') { toastVia(opts, 'Syncing…', 'sync'); OvuSync.syncNow().then(function (r) { toastVia(opts, r && r.ok ? 'Backed up.' : ('Sync failed: ' + ((r && r.error) || 'try again')), r && r.ok ? 'cloud_done' : 'error'); rerenderOpen(); }); return; }
      if (act === 'enable-cloud') { promptCloud(); return; }
      if (act === 'disable-cloud') { confirmDisableCloud(el, opts); return; }
      if (act === 'signout') { confirmSignOut(el, opts); return; }
      if (act === 'delete-account') { confirmDelete(el, opts); return; }
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
        }, function (err) { go.disabled = false; msg(err.message || 'Could not send the code. Try again.'); });
      } else {
        var code = (codeEl.value || '').replace(/\s/g, '');
        if (!/^\d{6}$/.test(code)) { msg('Enter the six-digit code from the email.'); return; }
        go.disabled = true; msg('Checking…', true);
        verifyCode(addr, code).then(function () { toastVia(opts, 'Signed in.', 'cloud_done'); }, function (err) { go.disabled = false; msg(err.message || 'That code did not match. Check it, or send a new one.'); });
      }
    };
  }

  function confirmDisableCloud(el, opts) {
    var g = el.querySelector('.ygroup'); if (!g) return;
    if (g.querySelector('.ya-confirm')) return;
    var box = document.createElement('div'); box.className = 'flag watch ya-confirm'; box.style.marginTop = '10px';
    box.innerHTML = '<span class="ms">cloud_off</span><div><b>Turn off cloud backup?</b><span>This phone stops backing up and syncing. Your diary here and the copy already in your account are both kept, and you can turn backup on again any time.</span>' +
      '<div class="row"><button type="button" class="btn soft" data-dc="yes"><span class="ms">cloud_off</span>Turn off backup</button><button type="button" class="btn ghost" data-dc="no">Keep it on</button></div></div>';
    g.appendChild(box); box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    box.onclick = function (e) { var b = e.target.closest('[data-dc]'); if (!b) return;
      if (b.dataset.dc === 'no') { box.remove(); return; }
      try { if (root.OvuStore) OvuStore.setProfile({ cloud: { v: 0, at: nowIso() } }); } catch (err) { }
      toastVia(opts, 'Cloud backup is off. Nothing new leaves this phone.', 'cloud_off'); rerenderOpen();
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
    sendCode: sendCode, verifyCode: verifyCode, signInWith: signInWith, signOut: signOut,
    promptCloud: promptCloud, hasCloud: hasCloud,
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }
  };
})(window);
