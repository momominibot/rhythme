# Plaza friends dry runs, 19 October 2026

`python3 tools/db/dryrun.py supabase/migrations/20261019130000_plaza_friends.sql tools/db/plaza_friends_dryrun.sql`,
sent as one `execute_sql` batch to the live project (zodkohwaznqgrfrcfdkf), with full-line comments outside function
bodies removed. The batch raises its own `RESULT`, so the transaction rolls back. A follow-up query after each run found
no `social` or `cron` schema, no pg_cron extension, no `social_*` tables, no trigger, no dry-run accounts, no `social`
consent events and the old purpose check: nothing was kept.

## Second cut (after the first Codex review): 53 of 53

`all: true`, `count: 53`, `expected: 53`, `missing: null`. A missing or null check now fails the run. New checks for the
review's findings: no_opt_in_refused, edit_needs_its_card, stale_edit_after_withdraw (finding 1); hidden_cannot_ask (6);
locks_pair and locks_withdrawal, read from `pg_locks` for accounts made without any call (3, 4, 9);
reciprocal_needs_14_days (10); declines_keep_quota (8); block_snapshot_only_if_visible (5); inbox_only_friends_notes
(3); daily_cleanup_scheduled (design note, retention). `bodies`: md5 of all 32 function bodies on the server equal
`python3 tools/db/dryrun.py --bodies` of the file. Refusals logged, all expected: `sign in first`, `permission denied
for table social_profiles`, `This page is for Rhythme staff.` twice.

What a single transaction cannot show: two sessions racing. The locks are shown to be taken before the checks (the
order is in the source; `pg_locks` shows both accounts held after a call), not exercised by concurrent sessions.

## First cut: 42 of 42

Found one bug before passing: `recorded || 'age_18'` read the word as an array literal; now `array_append`.
