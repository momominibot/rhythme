// Ovumind Luna proxy (Supabase Edge Function).
// Turns one short health note into journal entries with a Doubao model on
// Volcengine Ark. The Ark key lives in Supabase Vault and is read through a
// security-definer function; the browser never sees it. Only the Ovumind
// origins may call it, and every call is counted per day (per IP and overall).
//
// Deploy: through the Supabase MCP / CLI with verify_jwt = false (the function
// does its own origin check). __SETUP_TOKEN__ is replaced at deploy time with
// a random string used once to store the key, then it is useless.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ORIGINS = ["https://momominibot.github.io", "http://127.0.0.1:4310", "http://localhost:4310"];
const MODEL = "doubao-seed-2-1-turbo-260628";
const SETUP_TOKEN = "__SETUP_TOKEN__";
const PER_IP_PER_DAY = 80;
const ALL_PER_DAY = 4000;
const SYSTEM = 'You convert one short personal health note into strict JSON for a women\'s health journal. Output only JSON: {"entries":[...],"reply":"one warm sentence"}. Entry shapes: {"type":"sleep","date":"YYYY-MM-DD","data":{"bedTime":"HH:MM","wakeTime":"HH:MM","quality":1-5|null,"notes":""}}; {"type":"period","date":"YYYY-MM-DD","data":{"flow":"spotting|light|medium|heavy","clots":bool,"impact":bool}}; {"type":"symptom","date":"YYYY-MM-DD","data":{"symptoms":[from: cramps, headache, bloating, breast tenderness, back pain, fatigue, nausea, acne, cravings, insomnia, hot flushes, dizziness, spotting, discharge change, low mood, anxiety, irritability, brain fog],"pain":0-10|null,"mood":"great|good|ok|low|bad|","notes":""}}; {"type":"food","date":"YYYY-MM-DD","data":{"meal":"breakfast|lunch|dinner|snack","time":"HH:MM"|null,"foods":"text","tags":[]}}; {"type":"mindfulness","date":"YYYY-MM-DD","data":{"kind":"breathe","minutes":number}}. Use the given today date; "yesterday" means the day before. Never invent values that are not in the note; use null. Do not diagnose. Reply in the language of the note.';

// Food photos: one image in, estimated items out. The photo is sent to the model
// once and never stored here. Pro reads hawker dishes better than turbo (tested
// on bak chor mee 18 Oct 2026: turbo called the side soup porridge).
const VISION_MODEL = "doubao-seed-2-1-pro-260915";
const IMG_PER_IP_PER_DAY = 30;
const IMG_ALL_PER_DAY = 1500;
const MAX_IMAGE_CHARS = 700000;
const FOOD_SYSTEM = "You identify food in one photo for a women's health food journal in Singapore. Know local hawker and home dishes by their real names (for example bak chor mee, chicken rice, laksa, nasi lemak, roti prata, kaya toast, kopi, teh). " +
  "Output only JSON: {\"is_food\":true|false,\"meal_name\":\"short dish name\",\"items\":[{\"name\":\"plain English, local name in brackets if any\",\"portion\":\"bowl|plate|cup|glass|piece|slice|serving\",\"grams\":number,\"kcal\":number,\"protein_g\":number,\"carb_g\":number,\"fat_g\":number,\"fiber_g\":number,\"confidence\":\"high|medium|low\"}],\"note\":\"one short neutral sentence describing what you see\"}. " +
  "One item per separate dish or drink, at most 8. Estimate typical Singapore portions and count visible oil, lard, gravy and sauces. If the photo is not food or drink, return is_food false and an empty items list. " +
  "Never judge the meal, the person, weight or diet. Never guess allergens, medical effects or what is hidden inside.";

function num(v: unknown, max: number): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(max, Math.round(n * 10) / 10) : null;
}
function cleanFood(o: Record<string, unknown> | null) {
  const items = (Array.isArray(o?.items) ? o!.items as Record<string, unknown>[] : []).slice(0, 8).map((it) => ({
    name: String(it?.name || "").trim().slice(0, 80),
    portion: String(it?.portion || "serving").trim().slice(0, 20),
    grams: num(it?.grams, 2000),
    kcal: num(it?.kcal, 3000),
    protein_g: num(it?.protein_g, 300),
    carb_g: num(it?.carb_g, 500),
    fat_g: num(it?.fat_g, 300),
    fiber_g: num(it?.fiber_g, 100),
    confidence: ["high", "medium", "low"].includes(String(it?.confidence)) ? String(it?.confidence) : "low",
  })).filter((it) => it.name);
  return {
    is_food: o?.is_food === true && items.length > 0,
    meal_name: String(o?.meal_name || "").trim().slice(0, 80),
    items,
    note: String(o?.note || "").trim().slice(0, 200),
  };
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });
}
async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const allowed = ORIGINS.includes(origin);
  const cors = {
    "Access-Control-Allow-Origin": allowed ? origin : ORIGINS[0],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "content-type, x-setup-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const url = new URL(req.url);

  if (url.searchParams.get("setup") === "1") {
    if (!SETUP_TOKEN || SETUP_TOKEN.startsWith("__") || req.headers.get("x-setup-token") !== SETUP_TOKEN) return json({ error: "forbidden" }, 403, cors);
    const body = await req.json().catch(() => ({}));
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (key.length < 20) return json({ error: "key" }, 400, cors);
    const { data, error } = await sb.rpc("luna_secret_set_once", { p_key: key });
    return json({ ok: data === true, error: error?.message || null }, 200, cors);
  }

  if (!allowed) return json({ error: "This endpoint only serves the Ovumind app." }, 403, cors);
  let body: { text?: unknown; today?: unknown; image?: unknown } = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, cors); }
  const text = String(body.text || "").trim().slice(0, 600);
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today || "")) ? String(body.today) : new Date().toISOString().slice(0, 10);
  const image = typeof body.image === "string" ? body.image : "";
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "0").split(",")[0].trim();

  if (image) {
    if (image.length > MAX_IMAGE_CHARS || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) return json({ error: "That photo is too large or is not an image. Try again from the camera." }, 400, cors);
    const [ipOk, allOk] = await Promise.all([
      sb.rpc("luna_bump", { p_bucket: "img:" + await sha(ip), p_limit: IMG_PER_IP_PER_DAY }),
      sb.rpc("luna_bump", { p_bucket: "img-all", p_limit: IMG_ALL_PER_DAY }),
    ]);
    if (ipOk.error || allOk.error) return json({ error: "Luna's counter is unavailable right now." }, 503, cors);
    if (ipOk.data === false || allOk.data === false) return json({ error: "Luna has looked at enough photos for today. You can still log the meal by hand." }, 429, cors);
    const { data: key, error: kerr } = await sb.rpc("luna_secret_get");
    if (kerr || !key) return json({ error: "Luna's model key is not set up yet." }, 503, cors);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let r: Response;
    try {
      r = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: VISION_MODEL, temperature: 0, max_tokens: 900, thinking: { type: "disabled" }, response_format: { type: "json_object" },
          messages: [{ role: "system", content: FOOD_SYSTEM }, { role: "user", content: [{ type: "image_url", image_url: { url: image } }, { type: "text", text: "What food and drink is in this photo?" }] }],
        }),
      });
    } catch {
      clearTimeout(timer);
      return json({ error: "The model did not answer in time. Try again, or log the meal by hand." }, 504, cors);
    }
    clearTimeout(timer);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: "The model replied " + r.status + "." }, 502, cors);
    const content: string = d?.choices?.[0]?.message?.content || "";
    const m = content.match(/\{[\s\S]*\}/);
    let parsed: Record<string, unknown> | null = null;
    try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
    return json({ food: cleanFood(parsed) }, 200, cors);
  }

  if (!text) return json({ error: "empty" }, 400, cors);
  const [ipOk, allOk] = await Promise.all([
    sb.rpc("luna_bump", { p_bucket: "ip:" + await sha(ip), p_limit: PER_IP_PER_DAY }),
    sb.rpc("luna_bump", { p_bucket: "all", p_limit: ALL_PER_DAY }),
  ]);
  if (ipOk.error || allOk.error) return json({ error: "Luna's counter is unavailable right now." }, 503, cors);
  if (ipOk.data === false || allOk.data === false) return json({ error: "Luna is resting for today. The on-device rules still work." }, 429, cors);

  const { data: key, error: kerr } = await sb.rpc("luna_secret_get");
  if (kerr || !key) return json({ error: "Luna's model key is not set up yet." }, 503, cors);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  let r: Response;
  try {
    r = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, temperature: 0, max_tokens: 500, thinking: { type: "disabled" },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: "Today is " + today + ". Note: " + text }],
      }),
    });
  } catch {
    clearTimeout(timer);
    return json({ error: "The model did not answer in time." }, 504, cors);
  }
  clearTimeout(timer);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: "The model replied " + r.status + "." }, 502, cors);
  const content: string = d?.choices?.[0]?.message?.content || "";
  const m = content.match(/\{[\s\S]*\}/);
  let out: { entries?: unknown; reply?: unknown } | null = null;
  try { out = m ? JSON.parse(m[0]) : null; } catch { out = null; }
  return json({
    entries: Array.isArray(out?.entries) ? out!.entries : [],
    reply: typeof out?.reply === "string" ? out!.reply : "",
  }, 200, cors);
});
