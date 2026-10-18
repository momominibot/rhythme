// Rhythme Plus preview (Supabase Edge Function): Erin Lee's premium Take A Pause episodes.
// Premium audio sits in the private 'erin-premium' bucket. An access code (stored only as a SHA-256 hash)
// is redeemed once for a revocable grant; the app then asks for a short-lived signed URL per episode.
// Codex security review, 18 Oct 2026: atomic redemption, retry-safe grant ids, HMAC verified with
// crypto.subtle.verify, server-owned episode list, per-IP, per-grant and global limits, no codes or tokens in logs.
// Signed URLs can be shared for their hour; revoking a grant stops new URLs, not ones already issued.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ORIGINS = ["https://momominibot.github.io", "http://127.0.0.1:4310", "http://localhost:4310"];
const PREMIUM: Record<string, string> = {
  "tap-96": "when-persistence-stops-working.v1.mp3", "tap-95": "what-truly-matters.v1.mp3",
  "tap-94": "the-path-beneath-our-feet.v1.mp3", "tap-93": "the-scent-of-a-life-well-lived.v1.mp3",
  "tap-92": "the-happiness-chapter.v1.mp3", "tap-91": "an-island-within.v1.mp3",
  "tap-90": "better-than-a-thousand-words.v1.mp3", "tap-89": "the-freedom-beyond-anger.v1.mp3",
  "tap-88": "the-mind-leads-the-way.v1.mp3", "tap-85": "committing-wholeheartedly.v1.mp3",
  "tap-84": "being-real-and-honest.v1.mp3", "tap-83": "the-strength-to-stay.v1.mp3",
};
const URL_TTL = 3600;
const LIMITS = { redeemIp: 20, redeemAll: 500, urlIp: 300, urlGrant: 200, urlAll: 20000 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra } });
}
const enc = new TextEncoder();
async function sha256hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function b64url(u: Uint8Array) { let s = ""; u.forEach((b) => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64url(s: string) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }

let keyPromise: Promise<CryptoKey> | null = null;
function hmacKey(sb: ReturnType<typeof createClient>) {
  if (!keyPromise) keyPromise = (async () => {
    const { data, error } = await sb.rpc("plus_key_get");
    if (error || !data) throw new Error("key");
    const raw = new Uint8Array((data as string).match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  })().catch((e) => { keyPromise = null; throw e; });
  return keyPromise;
}
async function signToken(sb: ReturnType<typeof createClient>, claims: Record<string, unknown>) {
  const body = enc.encode(JSON.stringify(claims));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(sb), body));
  return b64url(body) + "." + b64url(sig);
}
async function readToken(sb: ReturnType<typeof createClient>, token: string) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || parts[0].length > 400 || parts[1].length > 100) return null;
  let body: Uint8Array, sig: Uint8Array;
  try { body = unb64url(parts[0]); sig = unb64url(parts[1]); } catch { return null; }
  if (!(await crypto.subtle.verify("HMAC", await hmacKey(sb), sig, body))) return null;
  let c: { v?: number; g?: string; exp?: number };
  try { c = JSON.parse(new TextDecoder().decode(body)); } catch { return null; }
  if (c.v !== 1 || typeof c.g !== "string" || !UUID.test(c.g) || typeof c.exp !== "number" || c.exp * 1000 < Date.now()) return null;
  return c as { v: number; g: string; exp: number };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const allowed = ORIGINS.includes(origin);
  const cors = { "Access-Control-Allow-Origin": allowed ? origin : ORIGINS[0], "Vary": "Origin", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "86400" };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  if (!allowed) return json({ error: "This endpoint only serves the Rhythme app." }, 403, cors);
  let body: { action?: unknown; code?: unknown; grant?: unknown; id?: unknown; token?: unknown; jwt?: unknown } = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "0").split(",")[0].trim();
  const ipHash = (await sha256hex("rhythme-plus:" + ip)).slice(0, 32);
  const bump = async (bucket: string, limit: number) => { const r = await sb.rpc("luna_bump", { p_bucket: bucket, p_limit: limit }); return !r.error && r.data === true; };

  try {
    if (body.action === "redeem") {
      const code = String(body.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const grant = String(body.grant || "").toLowerCase();
      if (code.length < 20 || code.length > 40 || !UUID.test(grant)) return json({ error: "That code does not look right. Check it and try again." }, 400, cors);
      if (!(await bump("plusredeem:" + ipHash, LIMITS.redeemIp)) || !(await bump("plusredeem-all", LIMITS.redeemAll))) return json({ error: "Too many tries for today. Please try again tomorrow." }, 429, cors);
      const { data, error } = await sb.rpc("plus_redeem", { p_hash: await sha256hex(code), p_grant: grant });
      if (error) return json({ error: "Rhythme Plus is unavailable right now." }, 503, cors);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || row.status !== "ok") return json({ error: row && row.status === "revoked" ? "This access has been switched off." : "That code is not valid, or it has already been used." }, 403, cors);
      const exp = Math.floor(new Date(row.expires_at).getTime() / 1000);
      return json({ token: await signToken(sb, { v: 1, g: row.grant_id, exp }), expiresAt: row.expires_at }, 200, cors);
    }
    if (body.action === "account") {
      // a signed-in person whose email carries a grant (account_grants) gets a normal Plus token, plus the tester flag
      const jwt = String(body.jwt || "");
      if (!jwt || jwt.length > 4096) return json({ error: "Please sign in again." }, 401, cors);
      if (!(await bump("plusacct:" + ipHash, 60))) return json({ error: "Too many tries for today." }, 429, cors);
      const { data: who, error: whoErr } = await sb.auth.getUser(jwt);
      const uid = who?.user?.id, email = (who?.user?.email || "").toLowerCase();
      if (whoErr || !uid || !email) return json({ error: "Your session is not valid. Please sign in again." }, 401, cors);
      const { data: gdata, error: gerr } = await sb.rpc("plus_account_grant", { p_email: email, p_uid: uid });
      if (gerr) return json({ error: "Rhythme Plus is unavailable right now." }, 503, cors);
      const g = Array.isArray(gdata) ? gdata[0] : gdata;
      if (!g || g.status !== "ok") return json({ plus: false, tester: !!(g && g.tester) }, 200, cors);
      const exp = Math.floor(new Date(g.expires_at).getTime() / 1000);
      return json({ plus: true, tester: !!g.tester, token: await signToken(sb, { v: 1, g: g.grant_id, exp }), expiresAt: g.expires_at }, 200, cors);
    }
    if (body.action === "url") {
      const id = String(body.id || ""), path = PREMIUM[id];
      if (!path) return json({ error: "Unknown episode." }, 404, cors);
      const claims = await readToken(sb, String(body.token || ""));
      if (!claims) return json({ error: "Rhythme Plus is not active on this phone.", code: "no-access" }, 401, cors);
      if (!(await bump("plusurl:" + ipHash, LIMITS.urlIp)) || !(await bump("plusurl-g:" + claims.g, LIMITS.urlGrant)) || !(await bump("plusurl-all", LIMITS.urlAll))) return json({ error: "That is a lot of listening for one day. Please try again tomorrow." }, 429, cors);
      const { data: ok, error: gerr } = await sb.rpc("plus_grant_ok", { p_grant: claims.g });
      if (gerr) return json({ error: "Rhythme Plus is unavailable right now." }, 503, cors);
      if (!ok) return json({ error: "This access has ended or been switched off.", code: "no-access" }, 401, cors);
      const { data: signed, error: serr } = await sb.storage.from("erin-premium").createSignedUrl(path, URL_TTL);
      if (serr || !signed) return json({ error: "This episode could not be prepared. Try again in a moment." }, 502, cors);
      return json({ url: signed.signedUrl, expiresIn: URL_TTL }, 200, cors);
    }
    return json({ error: "Unknown action." }, 400, cors);
  } catch {
    return json({ error: "Rhythme Plus is unavailable right now." }, 503, cors);
  }
});
