# Plaza friends dry run, 19 October 2026

`python3 tools/db/dryrun.py supabase/migrations/20261019130000_plaza_friends.sql tools/db/plaza_friends_dryrun.sql`,
sent as one `execute_sql` batch to the live project (zodkohwaznqgrfrcfdkf). The batch raised its own `RESULT`, so the
transaction rolled back. A follow-up query found no `social` schema, no `social_*` tables, no trigger, no dry-run
accounts, no `social` consent events and the old purpose check: nothing was kept.

- `all: true`, 42 checks: names, anon_refused, no_sub_refused, tables_closed, minor_refused, bad_name_refused, card_a,
  hide_show_keeps_handle, handles_not_ids, people_mutual_same_group, people_needs_her_visit, no_card_sees_nobody,
  hidden_sees_nobody, ask, ask_other_group_refused, ask_hidden_refused, ask_bad_hello_refused, inbox_asks,
  not_now_silent, mutual_ask_friends, note, note_too_fast, note_not_friend, note_bad_phrase, note_in_inbox, note_read,
  report_bad_reason, report_not_her_note, report, reports_staff_only, reports_owner_view, decide_owner_only, pause,
  pause_survives_off_on, new_card_new_handle, block, unblock, unfriend, withdraw_any_route, rate_limits, retention,
  account_delete.
- Refusals logged during the run, all expected: `sign in first` (no account), `permission denied for table
  social_profiles` (tables closed), `This page is for Rhythme staff.` twice (a non-staff account calling the two staff
  calls; both audited as denied).
- `bodies`: md5 of all 30 function bodies on the server equal `python3 tools/db/dryrun.py --bodies` of the file, so
  the batch that ran is the file.
- First run found one bug, fixed before the passing run: `recorded || 'age_18'` read the word as an array literal;
  now `array_append`.
