# Phase 0 final dry run (23 Oct 2026, live project zodkohwaznqgrfrcfdkf, migration at 69c1137)

Sent as one batch through execute_sql: the migration (header comments left out) followed by `tools/db/phase0_final_dryrun.sql`,
plus a `bodies` probe. It ended with `RESULT`, so the implicit transaction rolled back.

Result: setter_args 8; notices {3: false, 4: true, 5: true}; metric_version 3; overview_one_statement true; v3 refused
("older notice"); v5 grant accepted; same request id replayed; reused id with another payload refused; expect_none on an
existing row 40001; first refusal kept as a withdrawn row; admin_run ok and the overview's latest run is that run; floor 20;
scheduled false; a 20.5 floor refused; raising the floor held 2 runs and cleared the latest run; stored floor back to "20".

Function bodies in the batch matched the file (`python3 tools/db/dryrun.py --bodies`): admin_overview 3fba1c50...,
admin_policy_set 462a7894..., analysis_consent_set 858fe7de....

Readback afterwards: no 8-argument setter, no staff.notice_registry, no staff.consent_requests, no invalidated_at column,
no dry-run users, old admin_overview. Nothing persisted.
