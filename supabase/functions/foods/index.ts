// Ovumind product search (Supabase Edge Function).
// Open Food Facts' text search does not send CORS headers, so the browser
// cannot call it directly. This function searches by product name for the
// Ovumind origins only, returns a short list (Singapore products first) and
// lets the app fetch full nutrition by barcode from the normal OFF product API.
// No key and no personal data: only the typed product name is sent.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ORIGINS = ["https://momominibot.github.io", "http://127.0.0.1:4310", "http://localhost:4310"];
const PER_IP_PER_DAY = 300;
const FIELDS = "code,product_name,product_name_en,brands,quantity,nova_group,countries_tags,image_front_small_url";

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
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "GET") return json({ error: "GET only" }, 405, cors);
  if (!allowed) return json({ error: "This endpoint only serves the Ovumind app." }, 403, cors);

  const q = (new URL(req.url).searchParams.get("q") || "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (q.length < 2) return json({ error: "Type at least two letters." }, 400, cors);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "0").split(",")[0].trim();
  const bump = await sb.rpc("luna_bump", { p_bucket: "foods:" + await sha(ip), p_limit: PER_IP_PER_DAY });
  if (bump.error) return json({ error: "Search is unavailable right now." }, 503, cors);
  if (bump.data === false) return json({ error: "That is a lot of searching for one day. Try again tomorrow, or type the barcode digits." }, 429, cors);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  let r: Response;
  try {
    r = await fetch("https://search.openfoodfacts.org/search?q=" + encodeURIComponent(q) + "&page_size=24&fields=" + FIELDS, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Ovumind/1.0 (https://momominibot.github.io/ovumind.github.io/)" },
    });
  } catch {
    clearTimeout(timer);
    return json({ error: "Open Food Facts did not answer in time. Try again." }, 504, cors);
  }
  clearTimeout(timer);
  if (!r.ok) return json({ error: "Open Food Facts is busy (" + r.status + "). Try again." }, 502, cors);
  const d = await r.json().catch(() => ({}));
  const hits: Record<string, unknown>[] = Array.isArray(d?.hits) ? d.hits : [];
  const seen = new Set<string>();
  const products = hits.map((h) => {
    const name = String(h.product_name_en || h.product_name || "").trim();
    const brands = Array.isArray(h.brands) ? (h.brands as string[]).join(", ") : String(h.brands || "");
    const countries = Array.isArray(h.countries_tags) ? h.countries_tags as string[] : [];
    return {
      code: String(h.code || ""),
      name: name.slice(0, 90),
      brands: brands.slice(0, 60),
      quantity: String(h.quantity || "").slice(0, 30),
      nova: [1, 2, 3, 4].includes(Number(h.nova_group)) ? Number(h.nova_group) : null,
      sg: countries.includes("en:singapore"),
      image: typeof h.image_front_small_url === "string" ? h.image_front_small_url : null,
    };
  }).filter((p) => /^\d{8,14}$/.test(p.code) && p.name && !seen.has(p.code) && seen.add(p.code))
    .sort((a, b) => Number(b.sg) - Number(a.sg))
    .slice(0, 12);
  return json({ q, products, source: "Open Food Facts (ODbL)" }, 200, { ...cors, "Cache-Control": "public, max-age=3600" });
});
