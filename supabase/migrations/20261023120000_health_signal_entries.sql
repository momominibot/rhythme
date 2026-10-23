-- Rhythme steps, resting heart rate and temperature: let these entry types sync. APPLIED to the live project on
-- 23 Oct 2026 (Jamie: "Yes, apply the 20261023120000_health_signal_entries migration to the live database"). It
-- also carried 'sleepcheck', whose own migration (20261021090000) had not been applied.
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
