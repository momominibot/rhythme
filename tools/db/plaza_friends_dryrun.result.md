# Plaza friends dry runs, 19-20 October 2026

`python3 tools/db/dryrun.py supabase/migrations/20261019130000_plaza_friends.sql tools/db/plaza_friends_dryrun.sql`,
sent as one `execute_sql` batch to the live project (zodkohwaznqgrfrcfdkf), with full-line comments outside function
bodies removed. The batch raises its own `RESULT`, so the transaction rolls back. A follow-up query after each run found
no `social` or `cron` schema, no pg_cron extension, no `social_*` tables, no trigger, no dry-run accounts, no `social`
consent events and the old purpose check: nothing was kept.

## Fourth cut (after the third Codex review): 61 of 61, superseded by main

Locally: 61 of 61, races 8 of 8 safe, and with the lock removed 7 of 8 end with wrong answers or rows (counted on the
outcome only; the staff race stays right on its row lock). New checks: cooldown_survives_block, quota_survives_block,
visible_follows_inbox.

Live (20 Oct, about 10:45): `all: true`, `count: 61`, `expected: 61`, `missing: null`, all 32 body hashes equal the file.
This run was not on an empty project: main's own version of this migration had been applied at 01:39 UTC
(`20261020013954 plaza_friends`, with `social_ask_log`), so the batch's `create ... if not exists` statements found
main's tables and the functions were replaced inside the transaction. Afterwards the project held main's version
unchanged (no `social_cooldowns`, no dry-run accounts, main's function bodies), so the rollback held. The empty-project
path for this cut was covered by the local run only.

## Third cut (after the second Codex review): 58 of 58 live, plus two-session races locally

Live: `all: true`, `count: 58`, `expected: 58`, `missing: null`; all 32 function body hashes equal the file; nothing kept
afterwards (no `social` or `cron` schema, no pg_cron, no trigger, no dry-run accounts, the old purpose check). New
checks: block_snapshot_not_if_blocked, block_snapshot_not_if_hidden (round two 5, 6), age_withdraw_deletes (13),
read_needs_ok (15), decide_rechecks (14). Refusals logged, all expected (the four below plus "That report is already
decided." and "Unknown decision.").

Two sessions, on a throwaway local Postgres 17 (`tools/db/race_test.py --mutate --dryrun`; stand-ins for auth, consent,
staff and pg_cron in `tools/db/local_stub.sql`, the real plaza and friends migrations loaded unchanged except the
`create extension pg_cron` line): 8 of 8 races come out safe, each with the second session seen waiting on a lock in
`pg_stat_activity` before the first commits: block vs note, Plaza friends withdrawn vs note, 18+ withdrawn vs accept, one
account accepting two asks at 199 friends, two staff decisions on one report, two people asking each other at once,
unfriend vs note, turning off vs an ask. With `social.lock()` made a no-op, 7 of the 8 go wrong (the staff race stays
safe on its row lock), so the tests see the bug they guard against. The full dry run also passes 58 of 58 locally.

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
