// Rhythme insight agents (Supabase Edge Function).
// Two model-assisted summary agents that sit on top of the deterministic rule
// agents in the app: the Daily Summary Agent (journal) and the Four-Week
// Summary Agent (Dr shares card). The browser sends compact, de-identified
// inputs (no name, no contact details); the function returns strict JSON.
// Red flags are never produced here: the rules in ovu-agents.js own those.
// Same guard rails as the Luna relay: origin lock, per-day counters, Ark key
// read from Vault through luna_secret_get().
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ORIGINS = ["https://momominibot.github.io", "http://127.0.0.1:4310", "http://localhost:4310"];
const MODELS = { daily: "doubao-seed-2-1-turbo-260628", fourweeks: "doubao-seed-2-1-pro-260915" };
const CAPS = { daily: 24, fourweeks: 8, all: 3000 };

const DAILY_SYSTEM = `You are the Daily Summary Agent of Rhythme, a women's cycle and ovarian-health journal. You receive one person's entries for today and the previous seven days (dates are ISO, no name, no identifiers) plus minimal context. Write for her, in the second person, warm and plain. Output ONLY strict JSON:
{"summary":"two short sentences about today, grounded only in the entries","patterns":[{"title":"short","detail":"one sentence","basis":"which entries or days support it","confidence":"low|medium|high"}],"suggestion":"one gentle non-medical idea for tomorrow, or empty string","questions":["up to two questions she could raise with a clinician if something keeps recurring"],"caution":"empty string, or one sentence if an entry suggests she should seek care soon"}
Rules: at most three patterns; never name a condition as present or likely; never advise medicines, supplements or doses; do not restate the deterministic flags already given in context; if data is thin say so instead of guessing; never invent values; never describe or guess how the app calculates anything. If there are no entries today, summarise the week gently and invite one small log.`;

const FOURWEEK_SYSTEM = `You are the Four-Week Summary Agent of Rhythme. You receive aggregated 28-day statistics from one person's self-reported entries, the deterministic pattern flags the app already raised, and intake context. Write two things: a clinician-facing summary in neutral clinical prose, and a short user-facing summary in the second person. Output ONLY strict JSON:
{"clinician":{"overview":"2-3 sentences with coverage and the main themes","cycle":"","bleeding":"","symptoms_pain":"","sleep":"","nutrition":"","mood_calm":"","patterns":[{"title":"","detail":"","basis":""}],"questions":["questions worth raising at the visit"],"limits":"data limits and what the summary cannot say"},"user":{"summary":"three warm sentences","wins":["up to three things that went well"],"watch":["up to three things worth noticing, non-alarming"]}}
Rules: label everything as self-reported; do not diagnose, stage, or recommend treatment; do not change or add to the deterministic flags, you may refer to them; if coverage is low (under 14 days) say so first; keep each section under 60 words; never invent numbers that are not in the input; describe only what the input contains and never describe or guess how the app calculates anything (no defaults, formulas, assumptions or methods); when cycle.averageLength is null say that no cycle length is available yet; keep each wins and watch item under 12 words; use "the patient" in clinician text and "you" in user text.`;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });
}
async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
function scrub(s: string) {
  // belt and braces: the client already de-identifies, but strip emails, phones and handles if any slipped through
  return s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/\+?\d[\d\s-]{7,}\d/g, "[number]").replace(/@\w{3,}/g, "[handle]");
}

// Consent (19 Oct 2026, docs/design/2026-10-19-consent-rebuild-plan.md): a signed-in caller must hold the purpose in
// public.consent_events (consent_allows); a caller without an account must send X-Rhythme-Consent naming the purpose,
// the phone's own record, which is the honest limit for people who keep everything on the phone. A silent call is refused.
// deno-lint-ignore no-explicit-any
async function consentGate(req: Request, sb: any, purpose: string, cors: Record<string, string>) {
  const refused = () => json({ error: "This use of your diary is off in your choices. Turn it on under You, then try again.", code: "no-consent" }, 403, cors);
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (jwt && jwt !== anonKey) {
    const { data: who, error } = await sb.auth.getUser(jwt);
    const uid = who?.user?.id;
    if (error || !uid) return json({ error: "Your session is not valid. Please sign in again.", code: "no-session" }, 401, cors);
    const { data: ok, error: cerr } = await sb.rpc("consent_allows", { p_uid: uid, p_purpose: purpose });
    if (cerr) return json({ error: "Luna cannot check your choices right now." }, 503, cors);
    return ok === true ? null : refused();
  }
  const claimed = (req.headers.get("x-rhythme-consent") || "").split(";")[0].trim();
  return claimed === purpose ? null : refused();
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const allowed = ORIGINS.includes(origin);
  const cors = {
    "Access-Control-Allow-Origin": allowed ? origin : ORIGINS[0],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "content-type, authorization, x-rhythme-consent",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  if (!allowed) return json({ error: "This endpoint only serves the Rhythme app." }, 403, cors);

  let body: { mode?: unknown; input?: unknown } = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  const mode = body.mode === "fourweeks" ? "fourweeks" : body.mode === "daily" ? "daily" : null;
  if (!mode) return json({ error: "mode must be daily or fourweeks" }, 400, cors);
  let input = "";
  try { input = scrub(JSON.stringify(body.input ?? {})); } catch { return json({ error: "bad input" }, 400, cors); }
  if (input.length < 10) return json({ error: "empty" }, 400, cors);
  if (input.length > 24000) return json({ error: "input too large" }, 413, cors);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const gate = await consentGate(req, sb, "ai_summaries", cors);
  if (gate) return gate;
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "0").split(",")[0].trim();
  const [ipOk, allOk] = await Promise.all([
    sb.rpc("luna_bump", { p_bucket: "ins:" + mode + ":" + await sha(ip), p_limit: CAPS[mode] }),
    sb.rpc("luna_bump", { p_bucket: "ins:all", p_limit: CAPS.all }),
  ]);
  if (ipOk.error || allOk.error) return json({ error: "The insight counter is unavailable right now." }, 503, cors);
  if (ipOk.data === false || allOk.data === false) return json({ error: "Enough summaries for today. The rule-based summary is always available." }, 429, cors);

  const { data: key, error: kerr } = await sb.rpc("luna_secret_get");
  if (kerr || !key) return json({ error: "Luna is not set up yet." }, 503, cors);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 70000);
  let r: Response;
  try {
    r = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELS[mode], temperature: 0.2, max_tokens: mode === "daily" ? 900 : 2400, thinking: { type: "disabled" }, response_format: { type: "json_object" },
        messages: [{ role: "system", content: mode === "daily" ? DAILY_SYSTEM : FOURWEEK_SYSTEM }, { role: "user", content: "Input JSON: " + input }],
      }),
    });
  } catch {
    clearTimeout(timer);
    return json({ error: "Luna did not answer in time. Try again in a moment." }, 504, cors);
  }
  clearTimeout(timer);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: "Luna could not answer just now (" + r.status + ")." }, 502, cors);
  const content: string = d?.choices?.[0]?.message?.content || "";
  const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
  const m = content.match(/\{[\s\S]*\}?/);
  let out: Record<string, unknown> | null = tryParse(content) || (m ? tryParse(m[0]) : null);
  if (!out && m) { // a cut-off reply: close whatever is still open
    let s = m[0].replace(/,\s*"[^"]*"?\s*:?\s*"?[^"]*$/, "");
    for (let i = 0; i < 8 && !out; i++) { s = s.replace(/,\s*$/, ""); s += (s.split("[").length > s.split("]").length) ? "]" : "}"; out = tryParse(s); }
  }
  if (!out) return json({ error: "Luna could not write a readable summary this time.", finish: d?.choices?.[0]?.finish_reason || null, chars: content.length }, 502, cors);
  return json({ ok: true, mode, result: out, generatedAt: new Date().toISOString() }, 200, cors);
});
