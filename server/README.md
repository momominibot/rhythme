# Ovumind server pieces

The app is a static site on GitHub Pages. Two small server pieces live in Supabase
project `ovaria-app` (ap-southeast-1, Singapore):

- `supabase/functions/luna/index.ts`: the Luna relay. Origin-locked, per-day
  limits (80 per hashed IP, 4000 overall), reads the Volcengine Ark key from
  Supabase Vault through `luna_secret_get()` and calls `doubao-seed-2-1-turbo`.
  Deployed with `verify_jwt = false`; `__SETUP_TOKEN__` is replaced at deploy
  time and used once to store the key (`luna_secret_set_once`).
- `supabase/migrations/20261018_luna.sql`: counters and the Vault functions.
- `supabase/migrations/20261018_sync.sql`: the future account sync schema
  (`profiles`, `entries`, RLS own-rows-only). jev-1.13.0 chose Supabase (0.94)
  over Firebase, PocketBase, Cloudflare D1 or staying local-only. Not wired to
  the app yet.

Nothing here holds a secret; keys live in Vault and `~/.config` only.
