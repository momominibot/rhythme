# Review worker migration: live dry runs, 23 Oct 2026

Sent `20261023140000_staff_review_worker.sql` plus `review_worker_dryrun.sql` as one batch to project zodkohwaznqgrfrcfdkf
(`tools/db/dryrun.py`). The batch ended with `RESULT`, so all of it rolled back. A readback afterwards found no
`staff.review_jobs`, no `worker_claim`, no review policy rows, no synthetic users or owners, and no provider blocks.

Body hashes: all 20 functions reported by the dry run equal `dryrun.py --bodies` on the file (20 of 20).

| Check | Result |
|---|---|
| Defaults | review_on false, review_transfer_cleared false |
| Grants | worker_claim: anon yes, authenticated no; admin_refresh: authenticated yes, anon no; anon cannot read review_jobs (42501); authenticated cannot read worker_keys |
| Clearance setter | admin_policy_set('review_transfer_cleared') refused: "that setting is not changeable here" |
| Refresh, review off | not_queued, review_off |
| Refresh, on but not cleared | not_queued, transfer_not_cleared; same request id replays the same answer |
| Refresh, cleared, no measured numbers | not_queued, nothing_to_review (live has no eligible adults yet) |
| Worker, bad key | denied, and counted once in worker_denials |
| Worker claim | gets the queued job for the right run |
| Stage out of order (sleep first) | out_of_order, expected cycle |
| Stage cycle | payload keys: findings, floor, kinds, metric_version, registry, report_tz, targets, window_end_exclusive, window_start; findings are aggregates only |
| Same stage again | already_admitted |
| Heartbeat | ok |
| worker_fail provider_limit | block written; next claim returns no job; status shows the block; a refresh answers blocked |

The queued job in this run was inserted directly for a run given one synthetic measured finding, since live has none.

## Second dry run, after the round-1 fixes

The revised file (`review_matrix`, `key_active`, `review_gate`, locks before receipts, gates on beat and finish, the
null-safe contract, prune keeping its owner) was sent the same way and rolled back. 22 of 22 function bodies match
`dryrun.py --bodies`. A readback afterwards found no new tables, functions, policy rows, users, owners or blocks.
Same outcomes as above, and the cycle payload now carries `matrix` (the agent's own kinds and targets) in place of the
two separate lists: `findings, floor, matrix, metric_version, registry, report_tz, window_end_exclusive, window_start`.
