/* Web BFF client. Credentials stay in HttpOnly cookies, never browser storage. */
(function () {
  'use strict';
  var d = document, status = d.getElementById('account-status');
  if (!status) return;
  var csrf = null, snapshot = null, busy = false, pendingEmail = false;
  var native = !!(window.OvumindRuntime && window.OvumindRuntime.platform !== 'web');
  var channel = null, pendingRecheck = false;
  try { if (!native && typeof BroadcastChannel === 'function') channel = new BroadcastChannel('ovuluna-account-status'); } catch (_) { /* Notifications are optional, not a lock. */ }
  function supportsLocks() { return !!(navigator.locks && typeof navigator.locks.request === 'function'); }
  function node(id) { return d.getElementById('account-' + id); }
  function message(text, tone) { status.textContent = text; status.dataset.tone = tone || 'normal'; }
  function hideIdentity() { node('signed-in').hidden = true; node('identity').textContent = ''; }
  function controls() {
    var providers = snapshot && snapshot.providers || {};
    node('google').disabled = busy || !csrf || providers.google !== true;
    node('apple').disabled = busy || !csrf || providers.apple !== true;
    node('send').disabled = busy || !csrf || providers.email !== true;
    node('verify').disabled = busy || !csrf || providers.email !== true;
    node('signout').disabled = busy || !csrf;
    node('refresh').disabled = busy || !csrf || !supportsLocks() || !(snapshot && snapshot.refreshAvailable);
    node('recovery-signout').disabled = busy || !csrf;
    node('recheck').disabled = busy;
    node('change-email').disabled = busy;
  }
  async function request(path, data) {
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 15000);
    try {
      var response = await fetch('/api/auth-' + path, { method: data ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: controller.signal, headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(Object.assign({}, data, { csrfToken: csrf })) : undefined });
      var result;
      try { result = await response.json(); } catch (_) { throw new Error('Unreadable account response'); }
      if (!response.ok) { var rejection = new Error(result && result.error && typeof result.error.message === 'string' && result.error.message.length <= 500 ? result.error.message : 'Account sign-in is unavailable. Please recheck your account status.'); rejection.accountMessage = true; throw rejection; }
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Unexpected account response');
      if (path === 'status' && (typeof result.available !== 'boolean' || typeof result.authenticated !== 'boolean' || !result.providers || ['google', 'apple', 'email'].some(function (p) { return typeof result.providers[p] !== 'boolean'; }) || !(result.csrfToken === null || typeof result.csrfToken === 'string' && /^[A-Za-z0-9_-]{43}$/.test(result.csrfToken)) || !['unavailable','signed-out','verified','needs-refresh','provider-unavailable','unverified'].includes(result.sessionState) || result.authenticated && (result.sessionState !== 'verified' || !result.user || typeof result.user.id !== 'string' || !['email','google','apple'].includes(result.user.provider)))) throw new Error('Unexpected account response');
      return result;
    } catch (failure) {
      if (failure && failure.name === 'AbortError') throw new Error('The account request timed out. Recheck your account status before trying again.');
      if (failure && failure.accountMessage) throw failure;
      throw new Error('Account sign-in is unavailable right now. Recheck your account status, or continue on this device. Your local health notes have not changed.');
    } finally { clearTimeout(timer); }
  }
  function render(data) {
    // A success callback or successful OTP request alone never enables this card.
    snapshot = data; csrf = typeof data.csrfToken === 'string' ? data.csrfToken : null;
    hideIdentity();
    node('entry-panel').hidden = true; node('recovery').hidden = true;
    if (!data.available) { message('Account sign-in is not configured yet. You can continue on this device. No account has been created or verified here.', 'error'); controls(); return; }
    if (data.authenticated === true && data.sessionState === 'verified' && data.user && typeof data.user.id === 'string') {
      node('signed-in').hidden = false;
      var provider = ({ apple: 'Apple', google: 'Google', email: 'email code' })[data.user.provider] || 'your identity provider';
      node('identity').textContent = (data.user.email || 'Verified account') + ' · Signed in through ' + provider;
      message('Your account identity is verified. Health notes remain on this device.');
    } else if (data.sessionState === 'needs-refresh' || data.sessionState === 'provider-unavailable' || data.sessionState === 'unverified') {
      node('recovery').hidden = false;
      node('recovery-note').textContent = data.error || 'Your previous account session needs a refresh before it can be verified again.';
      if (data.refreshAvailable && !supportsLocks()) node('recovery-note').textContent += ' Session refresh is disabled because this browser cannot lock account changes across tabs. You can remove the browser account session and sign in again.';
      message('A signed-in account cannot be confirmed right now.', 'error');
    } else {
      node('entry-panel').hidden = false;
      node('email-form').hidden = data.providers.email !== true || pendingEmail;
      node('code-form').hidden = data.providers.email !== true || !pendingEmail;
      var enabled = ['google', 'apple', 'email'].filter(function (key) { return data.providers[key] === true; });
      node('provider-note').textContent = enabled.length ? 'Only configured methods are enabled. A disabled button does not start sign-in.' : 'No sign-in method has been enabled yet. Continue on this device below.';
      message('Choose an available sign-in method, or continue on this device.');
    }
    controls();
  }
  async function check() { hideIdentity(); return render(await request('status')); }
  async function mutation(work, kind) {
    // Refresh AND logout use the same lock. Separate locks still allow resurrection.
    if (supportsLocks()) return navigator.locks.request('ovuluna-account-mutation', work);
    // A broadcast message is not mutual exclusion. Without Web Locks, never
    // refresh, but allow explicit browser-session removal for recovery.
    if (kind === 'refresh') throw new Error('Session refresh is disabled in this browser. Remove the browser account session, then sign in again.');
    return work();
  }
  async function action(work) {
    if (busy || native) return;
    busy = true; controls();
    try { await work(); }
    catch (failure) { hideIdentity(); node('recovery').hidden = false; node('recovery-note').textContent = 'Your account status could not be confirmed. Recheck it, or remove this browser account session. Local health notes are unchanged.'; message(failure instanceof Error ? failure.message : 'This request could not be completed. Please reload and try again.', 'error'); }
    finally { busy = false; controls(); if (pendingRecheck && !d.hidden) { pendingRecheck = false; action(check); } }
  }
  ['google', 'apple'].forEach(function (provider) {
    node(provider).addEventListener('click', function () { action(async function () {
      var result = await request('start', { provider: provider });
      var url = new URL(result.authorizationUrl);
      if (url.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) || url.username || url.password || url.pathname !== '/auth/v1/authorize' || url.searchParams.get('provider') !== provider) throw new Error('The sign-in destination could not be verified.');
      var callback = new URL(url.searchParams.get('redirect_to'));
      if (callback.origin !== location.origin || callback.pathname !== '/api/auth-callback') throw new Error('The sign-in destination could not be verified.');
      message('Opening ' + (provider === 'apple' ? 'Apple' : 'Google') + ' to verify your account…');
      location.assign(url.toString());
    }); });
  });
  node('email-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    action(async function () {
      var result = await request('email', { action: 'request', email: node('email').value.trim(), createUser: node('create').checked });
      pendingEmail = true; node('email-form').hidden = true; node('code-form').hidden = false;
      message(result.message || 'If eligible, a code has been sent. You are not signed in yet.'); node('code').focus();
    });
  });
  node('code-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    action(async function () { await request('email', { action: 'verify', code: node('code').value.trim() }); node('code').value = ''; pendingEmail = false; await check(); });
  });
  node('change-email').addEventListener('click', function () { if (!busy) { pendingEmail = false; node('code').value = ''; node('code-form').hidden = true; node('email-form').hidden = false; message('Request a new code for the address you want to use.'); } });
  function signout() { action(function () { return mutation(async function () { var result = await request('signout', {}); pendingEmail = false; if (channel) channel.postMessage({ type: 'account-changed' }); await check(); message(result.message || 'The browser account session was removed. Local health notes remain on this device.', result.remoteRevoked ? 'normal' : 'error'); }, 'signout'); }); }
  node('signout').addEventListener('click', signout); node('recovery-signout').addEventListener('click', signout);
  node('recheck').addEventListener('click', function () { action(check); });
  node('refresh').addEventListener('click', function () { action(async function () {
    // Serialize refresh across tabs where supported; recheck inside the lock.
    var refresh = async function () { await check(); if (snapshot && snapshot.refreshAvailable) { await request('refresh', {}); await check(); } };
    await mutation(refresh, 'refresh');
  }); });
  if (native) { message('Native account sign-in is not connected. Your health notes remain on this device; no web account request was sent.', 'error'); controls(); return; }
  function recheckVisible() { if (!busy && !d.hidden) action(check); }
  window.addEventListener('pageshow', recheckVisible);
  window.addEventListener('focus', recheckVisible);
  d.addEventListener('visibilitychange', function () { if (d.hidden) hideIdentity(); else recheckVisible(); });
  if (channel) channel.onmessage = function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'account-changed') { hideIdentity(); if (busy) pendingRecheck = true; else recheckVisible(); }
  };
  // Remove callback status from the address bar; never render provider error text.
  var auth = new URL(location.href).searchParams.get('auth');
  if (auth) { var clean = new URL(location.href); clean.searchParams.delete('auth'); clean.hash = ''; history.replaceState(null, '', clean.pathname + clean.search); }
  action(async function () { await check(); if (auth === 'cancelled' || auth === 'failed' || auth === 'unavailable') message(auth === 'cancelled' ? 'Sign-in was cancelled. No new account session was verified.' : 'Sign-in could not be completed. Try an available method below.', 'error'); });
}());
