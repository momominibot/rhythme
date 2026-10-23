-- Rhythme steps, resting heart rate and temperature: let these entry types sync. NOT APPLIED YET: production
-- migrations wait for Jamie.
--
-- ovu-health.js now brings in three new entry types from Apple Health, Health Connect or Google Takeout, one a day:
-- 'steps' (data.steps), 'restinghr' (data.bpm) and 'temperature' (data.wrist, data.basal in degrees Celsius). They are
-- never typed in by hand. Until this runs, ovu-sync.js holds these rows on the phone and uploads everything else,
-- exactly as it did for 'exercise' and 'sleepcheck'; after it runs, the held rows go up on the next sync. Workouts
-- become ordinary 'exercise' rows and need nothing here.
-- The staff data contract (20261021100000_staff_data_contract_v3.sql) names the types it reads and is left alone,
-- so none of the three reaches the staff dashboard. Only the named type check is replaced.

alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries
  add constraint entries_type_check
  check (type in ('sleep','period','symptom','food','reflection','mindfulness','weight','exercise','sleepcheck','steps','restinghr','temperature'));
