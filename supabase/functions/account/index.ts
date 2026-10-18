// Rhythme account deletion (Supabase Edge Function).
// A signed-in person can erase their account and everything backed up to it.
// Only the Rhythme origins may call it, and the caller must present their own
// valid access token: the function verifies the token, deletes that user's
// rows (entries, profile) and then the auth user itself, all with the service
// role on the server. It never touches anyone else's data, and the local diary
// on the phone is the app's concern, not this function's.
//
// Deploy with verify_jwt = false (it does its own origin check and verifies the
// bearer token by hand, so it can return friendly JSON instead of a 401 shell).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const ORIGINS = ["https://momominibot.github.io", "http://127.0.0.1:4310", "http://localhost:4310"];

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const allowed = ORIGINS.includes(origin);
  const cors = {
    "Access-Control-Allow-Origin": allowed ? origin : ORIGINS[0],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, cors);
  if (!allowed) return json({ error: "This endpoint only serves the Rhythme app." }, 403, cors);

  const auth = req.headers.get("authorization") || "";
  const jwt = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!jwt) return json({ error: "Please sign in again." }, 401, cors);

  let body: { action?: unknown } = {};
  try { body = await req.json(); } catch { body = {}; }
  if (body.action !== "delete") return json({ error: "Unknown action." }, 400, cors);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // verify the caller's token and resolve their user id
  const { data: who, error: whoErr } = await admin.auth.getUser(jwt);
  const uid = who?.user?.id;
  if (whoErr || !uid) return json({ error: "Your session is not valid. Please sign in again." }, 401, cors);

  // delete the user's own rows first, then the account (FK cascade would also
  // clear the rows, but doing it explicitly keeps the intent obvious)
  const delEntries = await admin.from("entries").delete().eq("user_id", uid);
  if (delEntries.error) return json({ error: "Could not remove your entries. Nothing was deleted; please try again." }, 500, cors);
  await admin.from("profiles").delete().eq("user_id", uid);

  const { error: userErr } = await admin.auth.admin.deleteUser(uid);
  if (userErr) return json({ error: "Your data was removed but the account could not be closed. Please try again." }, 500, cors);

  return json({ ok: true }, 200, cors);
});
