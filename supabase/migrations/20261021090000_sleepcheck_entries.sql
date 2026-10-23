-- Rhythme two-week sleep check: let 'sleepcheck' entries sync. Applied on 23 Oct 2026 as part of
-- 20261023120000_health_signal_entries.sql (the later file carries the full list).
--
-- The local store (ovu-store.js) writes a new entry type, 'sleepcheck' (the optional two-week sleep check, one a day).
-- Until this runs, ovu-sync.js holds sleepcheck rows on the phone and uploads everything else, exactly as it did for
-- 'exercise' (20261019120000_exercise_entries.sql); after it runs, the held rows go up on the next sync. The nightly
-- sleep details live inside ordinary 'sleep' rows (data.details), so they need nothing here.
-- Only the named type check is replaced; any other constraint on entries is left alone.

alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries
  add constraint entries_type_check
  check (type in ('sleep','period','symptom','food','reflection','mindfulness','weight','exercise','sleepcheck'));
