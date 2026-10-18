# Ovumind on Supabase

The app is a static site on GitHub Pages. Two small server pieces live in Supabase
project `ovaria-app` (ap-southeast-1, Singapore):

- `functions/luna/index.ts`: the Luna relay. Origin-locked, per-day
  limits (80 per hashed IP, 4000 overall), reads the Volcengine Ark key from
  Supabase Vault through `luna_secret_get()` and calls `doubao-seed-2-1-turbo`.
  Deployed with `verify_jwt = false`; `__SETUP_TOKEN__` is replaced at deploy
  time and used once to store the key (`luna_secret_set_once`).
- `functions/insight/index.ts`: the insight agents. `daily` (Doubao Seed 2.1
  turbo) and `fourweeks` (Doubao Seed 2.1 pro, JSON mode) write prose and pattern
  hypotheses on top of the deterministic rule agents in `ovu-agents.js`; same
  origin lock, Vault key and `luna_bump` counters (daily 24, four-week 8 per hashed
  IP per day). The browser sends compact, de-identified inputs (`ovu-insight.js`).
- `migrations/20261018100000_luna.sql`: counters and the Vault functions.
- `migrations/20261018110000_sync.sql`: the future account sync schema
  (`profiles`, `entries`, RLS own-rows-only). jev-1.13.0 chose Supabase (0.94)
  over Firebase, PocketBase, Cloudflare D1 or staying local-only. Not wired to
  the app yet.

Nothing here holds a secret; keys live in Vault and `~/.config` only.

## GitHub link

The project is on the Pro plan and linked to this repository (18 Oct 2026). With this
`supabase/` folder at the repo root, a push to `main` lets the Supabase GitHub integration
apply new files in `migrations/` and deploy `functions/` with the settings in `config.toml`
(`verify_jwt = false` for both functions). The two existing migrations were applied by hand
earlier and are recorded in `supabase_migrations.schema_migrations`, so they are not re-run.
`__SETUP_TOKEN__` in the Luna source stays a placeholder: the key is already in Vault and
`luna_secret_set_once` refuses a second write, so a redeploy from the repo cannot change it.
