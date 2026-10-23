# The staff team comes online when Jamie refreshes (23 Oct 2026)

Jamie: "i dont need claude hourly but only when i refresh, it should run via codex CLI".

This is the build spec, revised after Codex's design review (full text in
`docs/design/reviews/2026-10-23-review-worker-design-review.md`, verdict BUILD with changes). Each review finding is
answered in section 7.

## 1. The one thing that is not mine to decide

Sending even aggregate numbers to Codex is a transfer to an outside provider (OpenAI, through Jamie's ChatGPT account).
The current "help improve logging" wording describes server computation and staff group results, not that route, and the
phase 0 design reserves a review before any provider transfer. So the worker ships **built, tested and switched off**. Two
switches must both be on before any model is called:

- `review_on`: an owner setting on the dashboard (the existing typed setter, now with this key);
- `review_transfer_cleared`: not settable from the dashboard or any RPC. Only a separate, approved SQL statement sets it,
  after Jamie's legal read accepts the route and the consent wording says so.

Until both are true, Refresh does exactly what Run now did: the deterministic run, nothing more.

## 2. One refresh

1. Staff press Refresh. `admin_refresh(p_days, p_request_id)` runs the deterministic run exactly as `admin_run` does. A
   repeated request id returns the first answer (a receipt), so a double tap or a lost reply never runs twice.
2. It then asks whether a review may be queued: both switches on, no provider block open, the run published (`ok`, not
   held) and it has at least one `measured` finding outside `eligible_people`. If not, it records why (a fixed code) and
   stops. If a review is already claimed by the worker, nothing is queued and the answer says so. If one is queued but not
   yet claimed, it is dropped (`superseded`) and the new run is queued instead.
3. A queued job expires after 10 minutes unclaimed (`expired`), so a sleeping Mac never wakes up to review old numbers.
4. The LaunchAgent `com.rhythme.review-worker` (StartInterval 20 s) runs `tools/worker/review_worker.py --once`: a local
   preflight of the pinned CLI (no network), then one `worker_claim` call. No job: it exits. No audit row is written for
   an empty poll.
5. With a job it runs five stages in a fixed order: `cycle`, `sleep`, `food`, `mind`, `orchestrator` (Bloom, Dozy,
   Pudding, Misty, Nimbus). For each stage it first calls `worker_stage_begin`, which re-checks every switch, block, key
   and run validity **at that moment** under the worker lock and only then returns that stage's payload. One `codex exec`
   call per stage. Each report is posted with `worker_post`. `worker_finish` marks the job done only when all five stages
   were accepted.
6. Nothing runs again until the next refresh.

## 3. What the model sees, and what it cannot touch

Payload, per specialist stage: only that agent's findings from the job's own run (never `admin_findings`' history), each
as metric, window, value, people, state, plus a snapshot of that metric's registry entry (unit, denominator, people rule,
window rule, computation version) and the floor, timezone and window bounds. `eligible_people` is included for every
agent. Values and people are null when suppressed. No overview counts, no `detail` blobs, no ids beyond the run id, no
diary rows, no consent rows, no free text. The agent's capability lines come from the registry, not the dashboard's
descriptions, and the prompt forbids inferring anything not measured. Nimbus's payload is the four accepted reports of
this job.

Codex runtime, for every call (revised after the round-1 diff review, `docs/design/reviews/2026-10-23-review-worker-diff-r1.md`):
- a throwaway 0700 folder per call: its own `HOME`, its own `CODEX_HOME` holding only the worker's config and a symlink to
  the real `auth.json` (so a token refresh lands in the real file), an empty working folder. No AGENTS.md, rules,
  memories, plugins or skills exist there;
- the config: a provider `rhythme` (`requires_openai_auth = true`, `request_max_retries = 0`, `stream_max_retries = 0`,
  `supports_websockets = false`, so no transport fallback), every feature 0.160.0 lists set false (including
  `unbounded_connection_retries`, which otherwise retries a dropped connection without limit), `[agents] enabled = false`,
  skills instructions and bundled skills off, and `model_catalog_json` pointing at a copy of the model's own cache entry
  with `tool_mode = direct`, `shell_type = disabled` and the search tool off;
- `codex exec --strict-config --ephemeral --ignore-rules --skip-git-repo-check -s read-only --json --output-schema
  <strict schema> -o <out> -m gpt-6-astra -C <empty folder> -`, with `PATH`, `LANG`, `TMPDIR`, `HOME` and `CODEX_HOME`
  only in its environment. The worker key is never in the child's environment or files;
- preflight before any claim: the CLI at an absolute path, version exactly `codex-cli 0.160.0`, and no feature reported
  on except stages marked removed and `unified_exec` (0.160.0 prints it on regardless; no shell tool is offered).
What is proven, offline and without a model call: `tools/worker/test_codex_offline.py` runs the real pinned CLI through
the worker's own code against a local stand-in provider: one request each for 500, 429, 401 and a dropped connection,
each with the right code; a clean answer parses; the request offers no usable tool (only Plan-mode `request_user_input`,
and any tool event is refused anyway) and carries none of this Mac's instructions. What is still not proven: the real
service's behaviour; that is one guarded live run at the enable step, never run by me on my own.

## 4. House rules for the model calls

- One job lock on the Mac (`flock`, released by the kernel if the pass dies). Before spawning, the worker writes an
  attempt record (job, stage, started, then the child's process group and start time). On start, an attempt record with
  no outcome means the last run died mid-call: the recorded child is killed if it still runs with the same start time,
  the attempt is treated as a failure (`uncertain`), reported to the server, and nothing is called. A failure receipt is
  written before the attempt record is removed.
- One attempt. No retry, no other model or account. Every `--json` event is parsed as it arrives. The first `error`,
  `turn.failed`, retry or reconnect event, a usage/rate/credit/auth phrase on stderr, a non-zero exit, a missing
  `turn.completed`, an output over 64 KB or invalid output stops the whole job.
- Per-stage timeout 240 s, total deadline 25 minutes, lease 30 minutes renewed by every heartbeat. Heartbeats run on
  their own thread and the prompt is written on another, so a slow network or a child that never reads cannot stall
  supervision. Events must be of known types (anything else, an error item, a tool item, a limit phrase in any message or
  in the answer, any stderr line) stops the job; reads are bounded per line and per stream. A failure seen together with
  a server stop is still recorded as a block. On a stop the whole process group gets TERM, then KILL after 5 s, until no
  member is left.
- On a failure the worker writes `~/.local/state/rhythme-worker/BLOCKED.json` and a pending failure receipt, then calls
  `worker_fail`, which accepts the exact claim even after its lease and opens a provider block (source `codex-worker`,
  fixed code). If that call fails, the receipt stays pending and the next `--once` sends it before anything else. A
  blocked worker only reconciles; it never calls a model.
- Recovery: an owner clears the server block (existing `admin_block_clear`, which now records the block generation). The
  worker sees the cleared block id equal to the one in BLOCKED.json and removes the file itself. Time passing or a deleted
  file never counts as recovery.
- No test model call to see whether a limit has reset.

## 5. Server (migration `20261023140000_staff_review_worker.sql`; dry run only, applied with Jamie's approval)

Tables: `staff.review_jobs`, `staff.review_stages` (unique `(job_id, agent)`, report, report hash, input hash, refs,
provenance: CLI version, model, prompt and schema version), `staff.worker_heartbeats` (job-bound), `staff.worker_keys`
(sha256 only; the key itself lives at `~/.config/rhythme/worker_key`, 600, inserted after approval, never in the file),
`staff.worker_denials` (one row per minute, a counter), `staff.refresh_receipts`.

RPCs, all `security definer`, empty `search_path`, owned by `rhythme_staff_fn`, explicit grants:
- staff: `admin_refresh(integer, text)`, `admin_review_status()`; redefined `admin_proposals` (withholds change and
  rationale of proposals whose run is held), `admin_decide` (under the worker lock; refuses held evidence; open or held
  only), `admin_policy_set` (adds `review_on`), `admin_block_clear` (records generation).
- worker (granted to `anon`, key checked first): `worker_claim`, `worker_stage_begin`, `worker_beat`, `worker_post`,
  `worker_fail`, `worker_finish`.
- Every state the dashboard can see is a fixed code (`queued`, `claimed`, `reading`, `posted`, `done`, `blocked`,
  `dropped`, `expired`, `superseded`, `nothing_to_review`; failure codes `timeout`, `provider_limit`, `provider_error`,
  `bad_output`, `crash`, `uncertain`, `lease_lost`). No free text from the worker reaches heartbeats, jobs or blocks.
- Proposal contract checked on the server too: agent to metric (the registry agent, or `all` for `eligible_people`), kind
  to target, `change` an object of at most 1 KB with no nesting beyond two levels, rationale at most 300 characters.
  Nimbus may only rank refs of proposals accepted in this job, each once.
- Retention: jobs, stages and heartbeats older than 90 days are pruned by the existing `admin_prune`.

## 6. Dashboard

Run now becomes Refresh, with a request id. Under it, the team line from `admin_review_status`: switched off (and which
switch), queued, a stage with its last heartbeat age (stale after 60 s), done for run X (and "newer results not reviewed"
when X is not the latest), or stopped with its code. The Queue reloads proposals when opened and when a review event
arrives, shows the change, the metric and the run, and treats a failed load as unavailable, not empty. Proposal and
review caches drop on a release change, on any account change (`OvuAuth` change subscription), with request generations
so late replies are ignored. Copy that says "no model" or "daily review" is updated.

## 7. Review findings and answers

| # | Finding | Answer |
|---|---|---|
| 1 | Isolation claim false | All tool features off, no user config or rules, ephemeral, empty cwd, scrubbed env; proof of the real CLI deferred to the enable step |
| 2 | Retries inside one call | Provider retries set to 0; any retry or reconnect event stops the job; real-CLI proof deferred as above |
| 3 | Tail-only scanning | Every JSON event parsed as it arrives; success needs `turn.completed`, exit 0 and valid output |
| 4 | Timeout and crash | Process group TERM then KILL then wait; attempt record before spawn; an orphaned attempt is `uncertain` |
| 5 | Block may never be recorded | `worker_fail` accepts the exact claim after lease; pending receipt resent first |
| 6 | Authorization too early | `worker_stage_begin` re-checks everything under the worker lock per stage |
| 7 | Protocol not enforced | Stage rows, order, unique (job, agent), immutable report hash, idempotent repost, finish needs five |
| 8 | Held proposals actionable | `admin_decide` refuses held evidence under the lock; dashboard drops proposal caches |
| 9 | Second output channel | Fixed codes only in heartbeats, jobs, blocks; readers withhold held runs |
| 10 | Account changes | Auth subscription clears caches and reboots; generations discard late replies |
| 11 | Disclosure boundary | Section 1: built and off; the transfer switch is set only after Jamie's legal read |
| 12 | Lease vs budget | 240 s stages, 25 min total, 30 min lease renewed by heartbeats |
| 13 | Refresh idempotency | Request id receipts |
| 14 | Stale queue | 10 minute queue expiry; a newer refresh supersedes an unclaimed job |
| 15 | Wrong run | Status names the reviewed run and says when newer results are unreviewed |
| 16 | Policy wiring | One authority `review_on` in the typed setter; worker has no apply capability |
| 17 | Nothing to review | No model call unless a measured finding beyond eligibility exists |
| 18 | Payload contract | The job's own run, registry snapshot, per-agent filter |
| 19 | Descriptions exceed data | Capabilities from the registry; inference forbidden |
| 20 | Strict JSON | Duplicate keys, non-finite numbers, depth and size rejected in the worker; matrix checked on the server |
| 21 | Nimbus refs | Refs only to accepted proposals of this job, each once; Nimbus adds no proposals |
| 22 | Queue | Reloads, shows change and evidence, failure is not empty |
| 23 | Grants, abuse | Explicit grants, minute-coalesced denial counter |
| 24 | Recovery | Generation-bound: the worker clears its file only when the server shows that block cleared |
| 25 | Retention, provenance | Hashes and versions per stage; 90 day prune; ephemeral sessions; temp dirs removed |
| 26 | Heartbeat wording | Job-bound, age shown, stale after 60 s |

Residual risk stated plainly (Codex question 3): repeated exact releases can be differenced and a floor of 20 is not
anonymity. Reviews only see what the dashboard already releases; the legal read must weigh that before the transfer
switch is set.
