# Rhythme Plus: locking part of Erin's podcast (design for review)

Context: Rhythme is a static PWA on GitHub Pages (public repo) with a Supabase Pro backend
(edge functions with verify_jwt off and an Origin allow-list, Vault secrets, a `luna_bump(bucket, limit)`
daily counter RPC). No user accounts yet. No Stripe keys. The owner has not set a price.
Erin Lee (podcast author) has given permission to host her episodes in the app (confirmed by the owner, 18 Oct 2026).

## Split
- 19 episodes (81 to 99). Free (7): 99, 98, 97 (newest), 86, 82, 87 (the cycle-phase picks), 81 (first).
  Premium (12): 83, 84, 85, 88, 89, 90, 91, 92, 93, 94, 95, 96.
- Free episodes keep streaming from Erin's public Substack audio URL.
- Premium episodes: re-encoded 48 kbps mono MP3 in a PRIVATE Supabase Storage bucket `erin-premium`,
  path `<slug>.v1.mp3`. Never in the public repo.

## Access without accounts (until payments launch)
- Table `plus_codes(code_hash text primary key, label text, max_uses int, uses int default 0,
  revoked boolean default false, expires_at timestamptz, created_at timestamptz default now())`, RLS on, no policies
  (service role only). Codes are 12+ random characters; only SHA-256 hashes are stored.
- Edge function `podcast`:
  - POST {action:'redeem', code}: rate limit 20/day per IP hash (luna_bump), hash the code, look up the row, reject
    revoked, expired or used up, increment uses, return token = base64url(JSON {v:1, sub:<random uuid>, tier:'plus',
    cid:<first 16 hex of code_hash>, exp:<now+365 days>}) + '.' + HMAC-SHA256(secret from Vault).
  - POST {action:'url', id, token}: rate limit 300/day per IP hash, verify HMAC and exp, check that the code row
    (by cid prefix) is not revoked, check id is in the server's own premium list, then
    `storage.from('erin-premium').createSignedUrl(path, 3600)` and return it.
  - Same Origin allow-list as the other functions. No personal data is sent or stored.
- Client: premium cards show a lock chip. Play without a token opens a "Rhythme Plus" sheet (what is included,
  "price to be announced", an "I have an access code" field). With a token, the app asks `podcast` for a signed URL,
  then plays. If a signed URL expires mid-listen (error event), it fetches a fresh one and resumes at the saved position.
  Token kept in localStorage per device.
- Later: Stripe Checkout through an edge function plus webhook that issues a code or token, once accounts and a price exist.

## Questions for the reviewer
1. Security holes or abuse paths (code brute force, token forgery or replay, signed URL sharing, bucket exposure).
2. Anything that makes this unfair or non-compliant to show as "premium" before a price and terms exist
   (Singapore consumer law: CPFTA; PDPA).
3. Implementation pitfalls (Supabase storage signed URLs and range requests on iOS Safari, Vault access from Deno,
   HMAC in Deno WebCrypto, RLS).
4. Whether the free/premium split is sensible for a calm, non-pushy wellbeing app.
Answer concisely with headings: Must fix, Should fix, Fine as is.
