-- Ovumind keeps this project (decided 2026-10-18); the empty leftovers of the
-- earlier Ovaria app go. Verified before dropping: every table below had 0 rows,
-- no storage, and no app configuration points at them (Ovuluna readiness notes,
-- 1 Oct 2026, record this project as unused by Ovuluna). Research tables for
-- Ovumind will be designed fresh with their own consent flow.
drop view if exists public.research_analysis;
drop table if exists public.research_events;
drop table if exists public.research_consent;
drop table if exists public.user_snapshots;

-- Security advisor: pin the search_path of the trigger function.
alter function public.touch_updated_at() set search_path = '';
