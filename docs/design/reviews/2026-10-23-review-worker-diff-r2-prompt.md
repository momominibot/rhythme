You are reviewing branch claude/review-worker of the Rhythme repo again (read-only; the repo is your working directory).
Diff: `git diff origin/main...HEAD`. Your round-1 findings: docs/design/reviews/2026-10-23-review-worker-diff-r1.md.
The design (revised): docs/design/2026-10-23-review-worker-on-refresh.md. Live dry runs: tools/db/review_worker_dryrun.result.md.

Since round 1:
- tools/worker/review_worker.py: a throwaway CODEX_HOME per call with its own config (custom provider, zero retries,
  no websockets, every feature off, agents/skills off, a model catalog copy with tool_mode direct); a preflight; an
  event allowlist; bounded reads; stdin, heartbeat and readers on their own threads; failure beats stop; group kill
  with zombie reaping; pending before attempt removal; flock; orphan recovery. tools/worker/test_codex_offline.py runs
  the real pinned CLI 0.160.0 offline against tools/worker/fake_provider.py.
- the migration: one review_matrix contract, locks before receipts, key rechecks after the lock, clock_timestamp,
  gates in beat and finish, a null-safe report contract, worker_fail for rotated keys, set null on proposals, prune
  keeps its owner.
- admin.js: merged with main's account guard; held words leave the Queue at once; failed loads say so; one refresh
  request id; status staleness; block copy.

First, for EACH of your 34 round-1 findings, say FIXED, PARTLY or NOT FIXED, with the evidence (file:line) in one line.
Then do one exhaustive sweep of the whole diff for anything new, ranked P1 (breaks a house rule or loses or leaks data
in ordinary use), P2 (wrong in ordinary use), P3 (rare or polish), each with file:line, scenario and fix.
House rules: no diary rows reach the worker or model; no retry or fallback after any provider failure; one model call
per stage per job; nothing applied automatically; held runs keep their words off screen; nothing waits for ever; the
dashboard never shows a failed load as empty and drops answers meant for another account.
End with MERGE-READY or HOLD. Do not edit files. Do not run the real codex against a real provider.
