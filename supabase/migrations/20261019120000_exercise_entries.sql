-- Rhythme Movement: let 'exercise' entries sync. NOT APPLIED YET: production migrations wait for Jamie.
--
-- The local store (ovu-store.js) writes a new entry type, 'exercise' (ovu-exercise.js). The entries table only
-- accepts the seven older types (20261019000000_accounts_sync_tombstones.sql). Until this runs, ovu-sync.js holds
-- exercise rows on the phone and uploads everything else; after it runs, the held rows go up on the next sync.
-- Only the named type check is replaced; any other constraint on entries is left alone. If the live constraint ever
-- had another name, the old one would still refuse 'exercise' and the phone would simply keep holding those rows.

alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries
  add constraint entries_type_check
  check (type in ('sleep','period','symptom','food','reflection','mindfulness','weight','exercise'));
