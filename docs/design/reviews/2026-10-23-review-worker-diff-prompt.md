You are reviewing branch claude/review-worker of the Rhythme repo (read-only; the repo is your working directory).
Diff: `git diff origin/main...HEAD`. Design: docs/design/2026-10-23-review-worker-on-refresh.md (it answers the 26
findings of your earlier design review in docs/design/reviews/2026-10-23-review-worker-design-review.md). Live dry run:
tools/db/review_worker_dryrun.result.md.

What it is: a staff Refresh button runs the deterministic report and, only when review_on and review_transfer_cleared
are both true, queues one review job. tools/worker/review_worker.py, run every 20 s by a LaunchAgent on the owner's Mac,
claims it via anon RPCs that check a worker key, runs five stages (cycle, sleep, food, mind, orchestrator), each as one
`codex exec` call over released aggregates only, and posts reports and proposals back. The first provider failure of
any kind writes a provider block; nothing retries, nothing falls back; an owner clears the block on the dashboard.

House rules that must hold: no diary rows ever reach the worker or the model; no automatic retry or fallback after any
provider failure, including an exit-0 run whose output or stderr shows a limit; one model call per stage per job; no
proposal is ever applied automatically; held runs keep their words off screen; a stalled worker never leaves a job
open forever; the dashboard never shows a failed load as empty and drops answers meant for another account.

Do one exhaustive sweep of everything in the diff (SQL, worker, dashboard, tests). List ALL defects you find, ranked:
P1 = breaks a house rule or loses or leaks data in ordinary use; P2 = wrong behaviour in ordinary use; P3 = rare edge
cases or polish. For each: file:line, the concrete scenario, and the fix. Then say MERGE-READY or HOLD. Do not edit files.
