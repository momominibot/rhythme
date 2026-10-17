// Server-only API boundary. No token issuer, account service or client-side secret.
export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function reject(status = 400, code = 'invalid_request', message = 'The request is not valid.') {
  throw new ApiError(status, code, message);
}
export function fail(res, error) {
  const known = error instanceof ApiError;
  const status = known ? error.status : 500;
  if (status === 401) res.setHeader('WWW-Authenticate', 'Bearer realm="ovuluna"');
  if (status === 429) res.setHeader('Retry-After', '60');
  // Never log or echo tokens, request bodies, prompts, images or provider errors.
  return res.status(status).json({ error: known ? error.code : 'internal_error', message: known ? error.message : 'The service could not complete this request.', available: false });
}
export function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function keys(value, allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) reject();
}
export function boundedText(value, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /\u0000/.test(value)) reject();
  return value;
}
export function begin(req, res, methods) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Allow', [...methods, 'OPTIONS'].join(', '));
  const origin = req.headers?.origin;
  if (origin !== undefined) {
    if (typeof origin !== 'string') reject(403, 'origin_not_allowed', 'This request origin is not allowed.');
    const allowed = (process.env.OVULUNA_ALLOWED_ORIGINS || 'https://ovuluna.vercel.app').split(',').map(value => value.trim());
    // Exact origins only. A wildcard/null entry can never enable arbitrary origins.
    if (origin === 'null' || origin === '*' || !allowed.includes(origin)) reject(403, 'origin_not_allowed', 'This request origin is not allowed.');
    let parsed;
    try { parsed = new URL(origin); } catch { reject(403, 'origin_not_allowed', 'This request origin is not allowed.'); }
    const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== '/') ||
        !(['https:'].includes(parsed.protocol) || (local && ['capacitor:', 'http:'].includes(parsed.protocol)))) reject(403, 'origin_not_allowed', 'This request origin is not allowed.');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    const requestedMethod = req.headers?.['access-control-request-method'];
    const requestedHeaders = req.headers?.['access-control-request-headers'];
    if ((requestedMethod && !methods.includes(requestedMethod)) || (requestedHeaders && (typeof requestedHeaders !== 'string' || requestedHeaders.split(',').some(name => !['content-type', 'authorization'].includes(name.trim().toLowerCase()))))) reject(403, 'origin_not_allowed', 'This preflight request is not allowed.');
    res.status(204).end(); return false;
  }
  if (!methods.includes(req.method)) reject(405, 'method_not_allowed', 'This request method is not supported.');
  return true;
}
export function jsonBody(req, maxBytes = 3 * 1024 * 1024) {
  if (typeof req.headers?.['content-type'] !== 'string' || !/^application\/json(?:\s*;[^\r\n]*)?$/i.test(req.headers['content-type'])) reject(415, 'unsupported_media_type', 'Send an application/json request.');
  const length = req.headers?.['content-length'];
  if (length !== undefined && (typeof length !== 'string' || !/^\d+$/.test(length) || Number(length) > maxBytes)) reject(413, 'request_too_large', 'The request is too large.');
  let text;
  try { text = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body); }
  catch { reject(); }
  if (typeof text !== 'string') reject();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) reject(413, 'request_too_large', 'The request is too large.');
  let value; try { value = JSON.parse(text); } catch { reject(); }
  if (!object(value)) reject();
  return value;
}
export async function fetchJson(url, options, { timeoutMs = 12000, maxBytes = 128 * 1024, identity = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, redirect: 'error', signal: controller.signal });
    if (!response.ok) reject(identity ? 503 : 502, identity ? 'service_unavailable' : 'upstream_unavailable', identity ? 'Account verification is unavailable.' : 'The AI service is unavailable.');
    const declared = response.headers.get('content-length');
    if ((declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) || !response.body) throw new Error('Invalid response');
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); throw new Error('Oversized response'); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const timedOut = controller.signal.aborted || ['AbortError', 'TimeoutError'].includes(error?.name);
    reject(identity ? 503 : timedOut ? 504 : 502, identity ? 'service_unavailable' : timedOut ? 'upstream_timeout' : 'upstream_unavailable', identity ? 'Account verification is unavailable.' : timedOut ? 'The AI service did not respond in time.' : 'The AI service returned an unusable response.');
  } finally { clearTimeout(timer); controller.abort(); } // Cancel any unread error response body.
}
function verificationConfig() {
  const env = process.env;
  const config = { url: env.OVULUNA_AUTH_INTROSPECTION_URL, id: env.OVULUNA_AUTH_CLIENT_ID, secret: env.OVULUNA_AUTH_CLIENT_SECRET, issuer: env.OVULUNA_AUTH_ISSUER, audience: env.OVULUNA_AUTH_AUDIENCE };
  if (Object.values(config).some(value => typeof value !== 'string' || !value.trim() || value.length > 2048)) reject(503, 'service_unavailable', 'Account verification is not connected.');
  let url; try { url = new URL(config.url); } catch { reject(503, 'service_unavailable', 'Account verification is not configured correctly.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) reject(503, 'service_unavailable', 'Account verification is not configured correctly.');
  return config;
}
export async function authorize(req, scope) {
  // An opaque token is NEVER accepted by inspecting its format or decoding claims.
  // A separately operated trusted authorization server must attest its live state.
  const config = verificationConfig();
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || header.length > 4103 || !/^Bearer [A-Za-z0-9\-._~+/]+=*$/i.test(header)) reject(401, 'authentication_required', 'Sign in with a verified account to use this service.');
  const token = header.slice(7);
  const encodeCredential = value => new URLSearchParams({ v: value }).toString().slice(2);
  const credential = Buffer.from(encodeCredential(config.id) + ':' + encodeCredential(config.secret)).toString('base64');
  const result = await fetchJson(config.url, { method: 'POST', headers: { Authorization: 'Basic ' + credential, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ token, token_type_hint: 'access_token' }).toString() }, { timeoutMs: 3000, maxBytes: 16384, identity: true });
  if (!object(result) || result.active !== true) reject(401, 'authentication_required', 'This session is not active. Sign in again.');
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(result.exp) || result.exp <= now || (result.nbf !== undefined && (!Number.isSafeInteger(result.nbf) || result.nbf > now + 30)) || (result.iat !== undefined && (!Number.isSafeInteger(result.iat) || result.iat > now + 30))) reject(401, 'authentication_required', 'This session is not active. Sign in again.');
  const audiences = typeof result.aud === 'string' ? [result.aud] : result.aud;
  if (typeof result.sub !== 'string' || !result.sub.trim() || result.sub.length > 256 || result.iss !== config.issuer || !Array.isArray(audiences) || audiences.length > 10 || !audiences.every(value => typeof value === 'string') || !audiences.includes(config.audience) || typeof result.scope !== 'string' || result.scope.length > 2048 || !result.scope.split(/\s+/).includes(scope)) reject(403, 'access_denied', 'This account is not authorized for this service.');
  return { subject: result.sub };
}
const attempts = new Map();
export function limitInstance(subject, endpoint) {
  // Additional per-instance backstop only; not a shared billing/quota system.
  const now = Date.now(), key = endpoint + ':' + subject;
  for (const [id, state] of attempts) if (state.until <= now) attempts.delete(id);
  let state = attempts.get(key);
  if (!state) { if (attempts.size >= 1024) reject(429, 'rate_limited', 'Please try again later.'); state = { count: 0, until: now + 60000 }; attempts.set(key, state); }
  state.count += 1;
  if (state.count > 20) reject(429, 'rate_limited', 'Please wait before trying again.');
}
export function providerKey() {
  const key = process.env.VOLCENGINE_API_KEY;
  if (typeof key !== 'string' || !key.trim() || key.length > 4096 || /[\r\n]/.test(key)) reject(503, 'service_unavailable', 'The AI service is not connected.');
  return key;
}
