/**
 * Browser-only Supabase Auth BFF. No SDK, health-record storage or service-role key.
 * The browser receives identity summaries and CSRF nonces, never provider tokens.
 * All configuration is explicit; an unrelated existing project is never selected.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const NAMES = Object.freeze({ csrf: '__Host-ov-csrf', flow: '__Host-ov-auth-flow', email: '__Host-ov-email-flow', access: '__Host-ov-account', refresh: '__Host-ov-account-refresh' });
const MAX_COOKIE = 3800;
const SESSION_SECONDS = 86400;
const FLOW_SECONDS = 600;
const DELETION = Object.freeze({ available: false, reason: 'Server account deletion is not enabled. Provider revocation and the full deletion lifecycle must be verified first. Local health records can be deleted separately in Settings.' });
class AuthError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const error = (status, code, message) => { throw new AuthError(status, code, message); };
const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length > 4096 || b.length > 4096) return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const token = (n = 32) => randomBytes(n).toString('base64url');
const header = (req, name) => {
  const value = req.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) error(400, 'invalid_request', 'Duplicate request headers are not accepted.');
  return typeof value === 'string' ? value : '';
};
function configuration(env) {
  try {
    const app = new URL(env.OVULUNA_ACCOUNT_APP_URL || '');
    const backend = new URL(env.OVULUNA_SUPABASE_URL || '');
    if (app.protocol !== 'https:' || app.username || app.password || app.pathname !== '/' || app.search || app.hash) return null;
    if (backend.protocol !== 'https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(backend.hostname) || backend.port || backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash) return null;
    if (env.OVULUNA_ACCOUNT_BACKEND_CONFIRMED !== 'true') return null;
    const keyText = env.OVULUNA_AUTH_COOKIE_KEY || '';
    if (!/^[A-Za-z0-9+/]{43}=$/.test(keyText)) return null;
    const key = Buffer.from(keyText, 'base64');
    if (key.length !== 32 || key.toString('base64') !== keyText) return null;
    const apiKey = env.OVULUNA_SUPABASE_ANON_KEY || '';
    if (apiKey.length < 20 || apiKey.length > 2048 || /[\s\r\n]/.test(apiKey) || apiKey.startsWith('sb_secret_')) return null;
    if (apiKey.split('.').length === 3) {
      const role = JSON.parse(Buffer.from(apiKey.split('.')[1], 'base64url').toString()).role;
      if (role !== 'anon') return null;
    } else if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(apiKey)) return null;
    return { origin: app.origin, host: app.host, backend: backend.origin, key, apiKey,
      providers: { google: env.OVULUNA_AUTH_GOOGLE_ENABLED === 'true', apple: env.OVULUNA_AUTH_APPLE_ENABLED === 'true', email: env.OVULUNA_AUTH_EMAIL_ENABLED === 'true' && env.OVULUNA_AUTH_EMAIL_SMTP_CONFIRMED === 'true' } };
  } catch { return null; }
}

function parseCookies(req, forgetSession = false) {
  const raw = header(req, 'cookie');
  if (raw.length > 18000) error(400, 'invalid_cookie', 'The browser session could not be read.');
  const result = Object.create(null);
  for (const item of raw.split(';')) {
    const at = item.indexOf('=');
    if (at < 0) continue;
    const name = item.slice(0, at).trim();
    if (!Object.values(NAMES).includes(name)) continue;
    if (Object.hasOwn(result, name)) {
      if (forgetSession && name !== NAMES.csrf) continue;
      error(400, 'invalid_cookie', 'The browser session could not be read.');
    }
    const value = item.slice(at + 1).trim();
    if (value.length > MAX_COOKIE || (!forgetSession || name === NAMES.csrf) && !/^[A-Za-z0-9_.-]+$/.test(value)) error(400, 'invalid_cookie', 'The browser session could not be read.');
    result[name] = value;
  }
  return result;
}

function body(req, allowed) {
  if (!/^application\/json(?:\s*;|$)/i.test(header(req, 'content-type'))) error(415, 'invalid_request', 'Use a JSON request.');
  let value = req.body;
  if (typeof value === 'string') {
    if (Buffer.byteLength(value) > 8192) error(413, 'invalid_request', 'The request is too large.');
    try { value = JSON.parse(value); } catch { error(400, 'invalid_request', 'The request could not be read.'); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value)) > 8192 || Object.keys(value).some(k => !allowed.includes(k))) error(400, 'invalid_request', 'The request could not be read.');
  return value;
}

/** Injectable transport and clock keep regression tests entirely offline. */
export function createAccountAuth({ env = process.env, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const config = configuration(env);
  const refreshes = new Map();
  const rates = new Map();
  const endedSessions = new Map();
  let mutationBlockUntil = 0;
  const seconds = () => Math.floor(now() / 1000);

  function seal(kind, value) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', config.key, iv);
    cipher.setAAD(Buffer.from(`${kind}|${config.origin}|${config.backend}|v1`));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    const result = `v1.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url')}`;
    if (result.length > MAX_COOKIE) error(502, 'session_too_large', 'The identity provider returned a session this browser cannot safely store.');
    return result;
  }
  function open(kind, cookies, { allowExpired = false } = {}) {
    const value = cookies[NAMES[kind]];
    if (!value) return null;
    try {
      if (!value.startsWith('v1.')) throw new Error('version');
      const buffer = Buffer.from(value.slice(3), 'base64url');
      if (buffer.length < 30) throw new Error('size');
      const decipher = createDecipheriv('aes-256-gcm', config.key, buffer.subarray(0, 12));
      decipher.setAAD(Buffer.from(`${kind}|${config.origin}|${config.backend}|v1`));
      decipher.setAuthTag(buffer.subarray(12, 28));
      const data = JSON.parse(Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]).toString('utf8'));
      if (!Number.isSafeInteger(data.iat) || !Number.isSafeInteger(data.exp) || data.iat > seconds() + 30 || data.exp <= data.iat || (!allowExpired && data.exp <= seconds())) throw new Error('expiry');
      return data;
    } catch { error(401, 'invalid_session', 'This browser session has expired or could not be verified. Start sign-in again.'); }
  }
  function cookie(res, kind, value, maxAge) {
    const current = res.getHeader?.('Set-Cookie') || [];
    const list = Array.isArray(current) ? current : [current];
    res.setHeader('Set-Cookie', [...list, `${NAMES[kind]}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`]);
  }
  const clear = (res, kind) => cookie(res, kind, '', 0);
  function issue(res, kind, value) {
    const age = Math.max(0, value.exp - seconds());
    cookie(res, kind, seal(kind, value), age);
  }
  function csrf(req, res, cookies, input) {
    const saved = open('csrf', cookies);
    if (!saved || !/^[A-Za-z0-9_-]{43}$/.test(saved.nonce) || !same(saved.nonce, input.csrfToken)) error(403, 'csrf_rejected', 'Reload the account page and try again.');
  }
  function guard(req, method, { callback = false } = {}) {
    if (req.method !== method) error(405, 'method_not_allowed', 'This request method is not supported.');
    if (!config) error(503, 'account_unavailable', 'Account sign-in is not configured. Continue using this device without an account.');
    // Do not trust X-Forwarded-Host or accept arbitrary preview origins.
    if (header(req, 'host').toLowerCase() !== config.host.toLowerCase()) error(403, 'origin_rejected', 'Use the approved Ovuluna website to manage your account.');
    if (callback) return;
    const origin = header(req, 'origin');
    const site = header(req, 'sec-fetch-site');
    if ((method === 'POST' && origin !== config.origin) || (origin && origin !== config.origin) || (site && site !== 'same-origin' && !(method === 'GET' && site === 'none'))) error(403, 'origin_rejected', 'Use the approved Ovuluna website to manage your account.');
    if (method === 'POST' && header(req, 'sec-fetch-mode') === 'navigate') error(403, 'origin_rejected', 'Reload the account page and try again.');
  }
  function rate(key, limit, window = 60) {
    const stamp = seconds();
    for (const [k, item] of rates) if (item.until <= stamp) rates.delete(k);
    if (rates.size >= 1000 && !rates.has(key)) error(429, 'rate_limited', 'Please wait before trying again.');
    const item = rates.get(key) || { until: stamp + window, count: 0 };
    if (++item.count > limit) error(429, 'rate_limited', 'Please wait before trying again.');
    rates.set(key, item);
  }
  async function upstream(path, { method = 'GET', json, access } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetchImpl(`${config.backend}/auth/v1/${path}`, { method, redirect: 'error', signal: controller.signal,
        headers: { apikey: config.apiKey, ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) }, ...(json ? { body: JSON.stringify(json) } : {}) });
      if (!response.ok) error(response.status === 429 ? 429 : response.status === 400 || response.status === 401 || response.status === 403 ? 401 : 502, 'provider_rejected', response.status === 429 ? 'Please wait before trying again.' : 'The identity provider could not verify this request. Please try again.');
      if (response.status === 204) return null;
      if (!/^application\/json/i.test(response.headers.get('content-type') || '')) error(502, 'provider_unavailable', 'The identity provider returned an unexpected response.');
      if (Number(response.headers.get('content-length')) > 65536) error(502, 'provider_unavailable', 'The identity provider returned an unexpected response.');
      let chunks = [], size = 0;
      for await (const chunk of response.body || []) {
        size += chunk.length;
        if (size > 65536) { controller.abort(); error(502, 'provider_unavailable', 'The identity provider returned an unexpected response.'); }
        chunks.push(Buffer.from(chunk));
      }
      const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('shape');
      return result;
    } catch (failure) {
      if (failure instanceof AuthError) throw failure;
      error(502, 'provider_unavailable', 'The identity provider is unavailable. Your local health notes have not changed.');
    } finally { clearTimeout(timer); }
  }
  async function userFor(access, expected = {}) {
    const user = await upstream('user', { access });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id || '') || user.is_anonymous === true || user.role !== 'authenticated') error(401, 'identity_rejected', 'The account identity could not be verified.');
    const providers = Array.isArray(user.identities) ? user.identities.map(i => i?.provider) : [];
    if (expected.id && !same(user.id, expected.id)) error(401, 'identity_rejected', 'The account identity could not be verified.');
    if (expected.provider && !providers.includes(expected.provider)) error(401, 'identity_rejected', 'The account identity could not be verified.');
    if (expected.email && (!user.email_confirmed_at || typeof user.email !== 'string' || user.email.toLowerCase() !== expected.email.toLowerCase())) error(401, 'identity_rejected', 'The account email could not be verified.');
    return { id: user.id, email: typeof user.email === 'string' && user.email.length <= 254 ? user.email : null, provider: expected.provider || null };
  }
  function pair(cookies) {
    const access = open('access', cookies);
    const refresh = open('refresh', cookies);
    if (!access && !refresh) return null;
    if (!access || !refresh || !same(access.nonce, refresh.nonce) || !same(access.sessionId, refresh.sessionId) || !/^[A-Za-z0-9_-]{43}$/.test(access.sessionId) || !same(access.id, refresh.id) || access.exp !== refresh.exp || access.iat !== refresh.iat || !['google', 'apple', 'email'].includes(access.provider) || !Number.isSafeInteger(access.accessExp) || typeof access.token !== 'string' || typeof refresh.token !== 'string') error(401, 'invalid_session', 'This browser session could not be verified.');
    return { access, refresh };
  }
  function validateTokens(data) {
    if (typeof data.access_token !== 'string' || data.access_token.length < 10 || data.access_token.length > 2500 || typeof data.refresh_token !== 'string' || data.refresh_token.length < 10 || data.refresh_token.length > 512 || data.token_type !== 'bearer' || !Number.isFinite(data.expires_in) || data.expires_in < 1 || data.expires_in > 86400) error(502, 'invalid_provider_session', 'The identity provider returned an unsupported session.');
    return data;
  }
  function sessionCookies(res, data, user, prior) {
    if (prior) activeSession(prior);
    const iat = prior?.access.iat || seconds();
    const exp = prior?.access.exp || iat + SESSION_SECONDS;
    const nonce = token();
    const sessionId = prior?.access.sessionId || token();
    const access = { iat, exp, nonce, sessionId, id: user.id, provider: user.provider, token: data.access_token, accessExp: Math.min(exp, seconds() + Math.floor(data.expires_in)) };
    const refresh = { iat, exp, nonce, sessionId, id: user.id, token: data.refresh_token };
    // Construct both before any header mutation; oversized sessions fail atomically.
    const accessValue = seal('access', access), refreshValue = seal('refresh', refresh);
    cookie(res, 'access', accessValue, exp - seconds());
    cookie(res, 'refresh', refreshValue, exp - seconds());
    if (!prior) issue(res, 'csrf', { nonce: token(), iat: seconds(), exp: seconds() + 3600 });
  }
  function noExistingSession(cookies) {
    if (pair(cookies)) error(409, 'account_present', 'Sign out of the current browser account before starting another sign-in.');
  }
  function activeSession(saved) {
    for (const [id, exp] of endedSessions) if (exp <= seconds()) endedSessions.delete(id);
    if (mutationBlockUntil > seconds()) error(503, 'session_coordination_unavailable', 'Session refresh is unavailable. Sign in again after removing this browser session.');
    if (endedSessions.has(saved.access.sessionId)) error(401, 'session_ended', 'This browser session has been signed out. Start sign-in again.');
  }
  function endSession(saved) {
    for (const [id, exp] of endedSessions) if (exp <= seconds()) endedSessions.delete(id);
    if (endedSessions.size >= 1000) mutationBlockUntil = Math.min(...endedSessions.values());
    else endedSessions.set(saved.access.sessionId, saved.access.exp);
  }
  async function rotated(saved) {
    activeSession(saved);
    const key = createHash('sha256').update(saved.refresh.token).digest('hex');
    for (const [k, item] of refreshes) if (item.until <= seconds()) refreshes.delete(k);
    if (refreshes.has(key)) return refreshes.get(key).promise;
    if (refreshes.size >= 1000) error(429, 'rate_limited', 'Please wait before refreshing your session.');
    const promise = (async () => {
      const data = validateTokens(await upstream('token?grant_type=refresh_token', { method: 'POST', json: { refresh_token: saved.refresh.token } }));
      const user = await userFor(data.access_token, { id: saved.access.id, provider: saved.access.provider });
      activeSession(saved);
      return { data, user };
    })();
    refreshes.set(key, { until: seconds() + 10, promise });
    try { return await promise; } catch (failure) { refreshes.delete(key); throw failure; }
  }
  const response = (res, status, data) => res.status(status).json(data);
  const redirect = (res, code) => { res.setHeader('Location', `${config.origin}/account.html?auth=${code}`); res.status(303).end(); };

  async function dispatch(action, req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Vary', 'Cookie, Origin');
    try {
      if (action === 'status' && !config) {
        if (req.method !== 'GET') error(405, 'method_not_allowed', 'This request method is not supported.');
        return response(res, 200, { available: false, providers: { email: false, google: false, apple: false }, authenticated: false, user: null, csrfToken: null, sessionState: 'unavailable', refreshAvailable: false, records: 'device-only', accountDeletion: DELETION });
      }
      guard(req, action === 'status' || action === 'callback' ? 'GET' : 'POST', { callback: action === 'callback' });
      const cookies = parseCookies(req, action === 'signout');
      if (action === 'status') {
        let savedCsrf;
        try { savedCsrf = open('csrf', cookies); } catch { savedCsrf = null; }
        if (!savedCsrf || !/^[A-Za-z0-9_-]{43}$/.test(savedCsrf.nonce)) { savedCsrf = { nonce: token(), iat: seconds(), exp: seconds() + 3600 }; issue(res, 'csrf', savedCsrf); }
        const base = { available: true, providers: config.providers, authenticated: false, user: null, csrfToken: savedCsrf.nonce, sessionState: 'signed-out', refreshAvailable: false, records: 'device-only', accountDeletion: DELETION };
        try {
          const saved = pair(cookies);
          if (!saved) return response(res, 200, base);
          activeSession(saved);
          if (saved.access.accessExp <= seconds() + 15) return response(res, 200, { ...base, sessionState: 'needs-refresh', refreshAvailable: true });
          const user = await userFor(saved.access.token, { id: saved.access.id, provider: saved.access.provider });
          return response(res, 200, { ...base, authenticated: true, user, sessionState: 'verified' });
        } catch (failure) {
          return response(res, 200, { ...base, sessionState: failure.code === 'provider_unavailable' ? 'provider-unavailable' : 'unverified', error: failure instanceof AuthError ? failure.message : 'This account could not be verified.' });
        }
      }
      if (action === 'callback') {
        const query = new URL(req.url, config.origin).searchParams;
        for (const key of ['code', 'state', 'error', 'error_description', 'error_code']) if (query.getAll(key).length > 1) error(400, 'invalid_request', 'This sign-in callback could not be verified.');
        const flow = open('flow', cookies);
        if (!flow || !same(flow.state, query.get('state'))) error(403, 'state_rejected', 'This sign-in callback could not be verified.');
        noExistingSession(cookies);
        clear(res, 'flow');
        if (!config.providers[flow.provider]) return redirect(res, 'unavailable');
        if (query.has('error')) return redirect(res, query.get('error') === 'access_denied' ? 'cancelled' : 'failed');
        const code = query.get('code');
        if (!code || code.length > 1024 || !/^[A-Za-z0-9_.-]+$/.test(code) || !/^[A-Za-z0-9_-]{43}$/.test(flow.verifier)) return redirect(res, 'failed');
        try {
          const data = validateTokens(await upstream('token?grant_type=pkce', { method: 'POST', json: { auth_code: code, code_verifier: flow.verifier } }));
          const user = await userFor(data.access_token, { provider: flow.provider });
          sessionCookies(res, data, user);
          clear(res, 'email');
          return redirect(res, 'complete');
        } catch { return redirect(res, 'failed'); }
      }
      const input = body(req, action === 'start' ? ['provider', 'csrfToken'] : action === 'email' ? ['action', 'email', 'createUser', 'code', 'csrfToken'] : ['csrfToken']);
      csrf(req, res, cookies, input);
      if (action === 'signout') {
        // A revoked/corrupt/expired provider session must not trap this browser.
        // Cookie removal is local sign-out, and is never called remote revocation.
        let remoteRevoked = false;
        try {
          const saved = pair(cookies);
          if (saved) {
            // Tombstone before awaiting the provider: a held refresh on this
            // process must not reissue cookies after sign-out has completed.
            endSession(saved);
            try { await upstream('logout?scope=local', { method: 'POST', access: saved.access.token }); }
            catch (failure) {
              if (failure.status !== 401) throw failure;
              const data = validateTokens(await upstream('token?grant_type=refresh_token', { method: 'POST', json: { refresh_token: saved.refresh.token } }));
              await userFor(data.access_token, { id: saved.access.id, provider: saved.access.provider });
              await upstream('logout?scope=local', { method: 'POST', access: data.access_token });
            }
            remoteRevoked = true;
          }
        } catch { /* Return explicit uncertainty below; never emit provider details. */ }
        refreshes.clear();
        for (const kind of ['access', 'refresh', 'flow', 'email']) clear(res, kind);
        return response(res, 200, { signedOut: true, remoteRevoked, message: remoteRevoked ? 'This browser account was signed out and its refresh session revoked. Health notes stored on this device remain here.' : 'This browser account was removed from this device. The provider session could not be confirmed revoked; use your provider account controls if needed. Local health notes remain here.' });
      }
      if (action === 'start') {
        if (!['google', 'apple'].includes(input.provider) || !config.providers[input.provider]) error(503, 'provider_disabled', 'This sign-in method is not available.');
        noExistingSession(cookies);
        const nonce = open('csrf', cookies).nonce;
        rate(`oauth:${nonce}`, 5);
        const state = token(), verifier = token();
        issue(res, 'flow', { iat: seconds(), exp: seconds() + FLOW_SECONDS, state, verifier, provider: input.provider });
        const authorization = new URL(`${config.backend}/auth/v1/authorize`);
        authorization.searchParams.set('provider', input.provider);
        authorization.searchParams.set('redirect_to', `${config.origin}/api/auth-callback?state=${state}`);
        authorization.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'));
        authorization.searchParams.set('code_challenge_method', 's256');
        return response(res, 200, { authorizationUrl: authorization.toString() });
      }
      if (action === 'email') {
        if (!config.providers.email) error(503, 'provider_disabled', 'Email code sign-in is not available.');
        noExistingSession(cookies);
        const nonce = open('csrf', cookies).nonce;
        if (input.action === 'request') {
          if (input.code !== undefined || typeof input.createUser !== 'boolean' || typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) error(400, 'invalid_request', 'Enter a valid email address and choose sign-in or account creation.');
          rate(`email:${createHash('sha256').update(input.email.toLowerCase()).digest('hex')}`, 1);
          rate(`email-browser:${nonce}`, 3, 300);
          await upstream('otp', { method: 'POST', json: { email: input.email.trim(), create_user: input.createUser } });
          issue(res, 'email', { iat: seconds(), exp: seconds() + FLOW_SECONDS, email: input.email.trim(), nonce });
          return response(res, 200, { sent: true, authenticated: false, message: 'If this address is eligible, a sign-in code has been sent. Enter it here within 10 minutes. Sending a code does not sign you in.' });
        }
        if (input.action !== 'verify' || input.email !== undefined || input.createUser !== undefined || typeof input.code !== 'string' || !/^\d{6}$/.test(input.code)) error(400, 'invalid_request', 'Enter the six-digit code sent to your email.');
        const pending = open('email', cookies);
        if (!pending || !same(pending.nonce, nonce)) error(401, 'email_flow_expired', 'Request a new code in this browser before verifying.');
        rate(`verify:${nonce}`, 5, 300);
        const data = validateTokens(await upstream('verify', { method: 'POST', json: { email: pending.email, token: input.code, type: 'email' } }));
        const user = await userFor(data.access_token, { email: pending.email, provider: 'email' });
        sessionCookies(res, data, user);
        clear(res, 'email'); clear(res, 'flow');
        return response(res, 200, { authenticated: true, message: 'Code verified. Checking your account status.' });
      }
      if (action === 'delete') error(501, 'deletion_unavailable', DELETION.reason);
      const saved = pair(cookies);
      if (!saved) error(401, 'no_session', 'No browser account session is available.');
      if (action === 'refresh') {
        rate(`refresh:${open('csrf', cookies).nonce}`, 8);
        const result = await rotated(saved);
        sessionCookies(res, result.data, result.user, saved);
        return response(res, 200, { refreshed: true, message: 'Session refreshed. Check account status again.' });
      }
      error(404, 'not_found', 'This account operation is not supported.');
    } catch (failure) {
      if (failure instanceof AuthError) return response(res, failure.status, { error: { code: failure.code, message: failure.message }, authenticated: false });
      return response(res, 500, { error: { code: 'account_error', message: 'The account request could not be completed. Local health notes have not changed.' }, authenticated: false });
    }
  }
  return { dispatch };
}

let current;
export async function accountRoute(action, req, res) {
  current ||= createAccountAuth();
  return current.dispatch(action, req, res);
}
