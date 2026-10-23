# Codex gpt-6-astra design review of the on-refresh review worker (23 Oct 2026, read-only, verdict BUILD with changes)

Reviewed `61ef9aa` on `claude/data-capture-phase0`, including `admin.js` and the staff migrations. I treated the migration’s live status as supplied by you. This was a read-only review; no implementation or live execution was performed.

The refresh-triggered architecture is viable. The draft needs the following corrections before it becomes a build brief. **No P0 found.**

1. **P1: The Codex isolation claim is false.**  
   `-s read-only` prevents writes; an empty `-C` directory does not prevent reads elsewhere, inherited instructions, configuration, memories, or connectors. Define a dedicated, pinned runtime with tools/connectors disabled, restricted filesystem reads, minimal environment, and ephemeral session storage. Keep the worker key outside the model’s reachable environment. Prove these restrictions with denied-read and connector tests. [Codex permissions](https://learn.chatgpt.com/docs/permissions)

2. **P1: One CLI invocation does not establish one provider attempt.**  
   Codex has internal HTTP and stream retries. Disable and verify those for the installed version, pin the model/account, and prevent additional tool-driven model turns. A fake `codex` executable tests the wrapper, but cannot prove the real CLI’s transport behavior; add a fake-provider test that counts requests. [Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)

3. **P1: Tail-only error scanning can miss the first failure.**  
   An early stdout error followed by more events falls outside “last event lines.” Parse every structured lifecycle/error event as it arrives, separately from echoed prompts and model-authored text. Require a recognized successful terminal event, exit zero, and valid final output. Bound output sizes and stop immediately on the first provider failure.

4. **P1: Timeout and crash handling do not prove that execution stopped.**  
   `perl alarm 600` is not sufficient evidence that descendants stopped. Supervise the owned process group, terminate, kill if necessary, and wait before releasing the lock. Persist an attempt-start record before spawning. After a crash, an unfinished attempt must become uncertain/blocked, rather than being restarted after deleting a stale lock.

5. **P1: The shared provider block may never be recorded.**  
   A failure after lease expiry cannot pass the proposed `worker_finish` lease check. A failed finish request also leaves only the local block, whose early exit prevents reconciliation. Add a durable local failure receipt and an idempotent server failure-recording path that accepts the exact historical claim after expiry, without permitting further results or execution. Blocked workers may reconcile control state, never call models.

6. **P1: Authorization is checked too early.**  
   Enqueue-time checks do not cover a queued or running job after an owner disables reviews, opens a block, revokes a key, or invalidates the run. Require fresh server authorization before **every** model stage, including Nimbus. Serialize admission, block creation, and invalidation using a consistent lock order. Fetch only that stage’s authorized payload. Cancel ongoing work where possible; explicitly acknowledge that already transmitted data cannot be recalled. The existing invalidation lock is in the [phase 0 migration](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/supabase/migrations/20261021100000_staff_data_contract_v3.sql:128).

7. **P1: The server does not enforce the five-stage protocol.**  
   Key, token, and lease checks alone permit duplicate posts, skipped stages, posts after completion, and `done` without five accepted reports. Persist stage admission and immutable report receipts, bind claims to a worker key identity, enforce legal transitions, and uniquely constrain `(job, agent)`. A lost HTTP acknowledgement must be reconciled against a receipt without regenerating the report.

8. **P1: Held proposals remain actionable and cached.**  
   Existing `admin_decide` accepts a proposal ID without checking its run’s validity or enforcing prior-status transitions. Existing dashboard invalidation clears findings/feed but leaves cached proposals. Guard decisions under the invalidation lock, reject approvals of invalidated evidence, and clear/generation-guard all proposal/report caches. [Decision RPC](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/supabase/migrations/20261019030000_team_dashboard.sql:430), [dashboard cache handling](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/admin.js:337)

9. **P1: Status and error fields can become an unredacted second output channel.**  
   Feed redaction does not cover heartbeat notes, job errors, provider-block reasons, or proposal ranking/notes. Use fixed operational states and sanitized error codes there. Apply run-validity checks to every derived-output reader. Explicitly exclude claim tokens, key hashes, raw stdout/stderr, and payload fragments from dashboard responses and denial audits.

10. **P1: Staff data can survive account changes.**  
    `admin.js` does not subscribe to the available auth-change notification. Stopping timers does not clear caches or invalidate pending responses. Subscribe to account changes, clear staff data immediately, bind requests to account plus generation, discard late responses, and rerun `admin_me`. [Dashboard boot](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/admin.js:372), [auth subscription](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/ovu-auth.js:547)

11. **P1: The external disclosure boundary is unresolved.**  
    Current improvement wording describes server computation and staff group results. It does not establish the proposed Codex processing route, account settings, retention, or deletion behavior. The existing design explicitly reserves review before provider transfers. Resolve that boundary before enabling reviews; a floor of 20 does not establish anonymity. [Current consent wording](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/ovu-consent.js:38), [recorded transfer gate](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/docs/design/2026-10-21-data-capture-live-path-and-future-proofing.md:173)

The remaining **P2 findings concern ordinary use**:

12. **P2: The lease contradicts the execution budget.**  
    Five calls at 600 seconds allow 50 minutes, against a 15-minute lease. Choose a bounded total deadline with compatible stage timeouts and explicit lease renewal. Heartbeats must continue during calls. Check expiry using current server time after lock waits; test sleep/resume and clock changes.

13. **P2: Refresh needs an idempotency contract.**  
    A partial unique index prevents simultaneous open jobs, not duplicate work after a completed request or lost response. Give each explicit refresh a request ID and durable receipt. Handle enqueue conflicts without rolling back a successful deterministic run. Consider reusing an existing review when the released input and review versions are unchanged.

14. **P2: Queued jobs can remain stale indefinitely.**  
    Only claimed jobs expire. An asleep Mac can leave an old queued job blocking every later refresh, then review obsolete numbers on waking. Add queue expiry and define what a newer explicit refresh does to an unclaimed request.

15. **P2: “Review done” can describe the wrong run.**  
    Refresh B can publish while review A is running. A later completes, but the dashboard displays B’s findings. Show the reviewed run and whether newer results remain unreviewed. Do not silently enqueue B when A finishes.

16. **P2: Policy wiring is incomplete and contradictory.**  
    `admin_policy_set` currently rejects `review_on`; the UI already exposes `model_on` and `autonomy_on`. Choose one review authority, update its typed owner-only setter, and remove contradictory controls/copy. Worker code must have no application capability regardless of legacy autonomy settings. Also, `admin_run` returns `{ok, run_id, summary}`, not a `status` field. [Current setter](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/supabase/migrations/20261021100000_staff_data_contract_v3.sql:517)

17. **P2: Successful runs can contain nothing useful to review.**  
    `status='ok'` includes zero eligible adults and wholly suppressed results. Skip model calls when there are no usable released findings beyond readiness, and report that deterministically. Otherwise an empty dashboard costs five calls per refresh.

18. **P2: Payload semantics need an immutable contract.**  
    Use the exact job’s run, not the historical rows returned by `admin_findings`. Include the applicable denominator, people rule, timezone, window bounds, floor, and computation version. Snapshot definitions because the registry is mutable. Filter each specialist to its own metrics, including shared `eligible_people`; do not pass overview counts or arbitrary `detail`.

19. **P2: Agent descriptions exceed the available measurements.**  
    The current descriptions mention prediction availability, sleep duration/quality, HPB/NOVA coverage, practice-kind breakdowns, and repeat practice. These are not all implemented in the v3 registry. Supply explicit available/unavailable capabilities and forbid inference of missing measurements. [Agent descriptions](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/admin.js:16), [registry](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/supabase/migrations/20261021100000_staff_data_contract_v3.sql:65)

20. **P2: “Strict JSON” is not a sufficient proposal contract.**  
    Define exact types, nested keys, byte/depth limits, duplicate-key rejection, and finite-number handling, including exponent overflow. PostgreSQL `jsonb` has already discarded duplicate keys before RPC validation. Validate an agent→metric and kind→target→change-schema matrix, with evidence from this run. “Any registry metric” wrongly admits inventory weight optimization. Schema validity must not promote model prose into a measured finding.

21. **P2: Nimbus references and ranking are undefined.**  
    `worker_post` should return stable proposal references. Nimbus may reference only accepted proposals from this job; reject duplicate, missing, foreign, or invented references. Define whether Nimbus can introduce proposals, what ranking completeness means, and how ranking is persisted/displayed.

22. **P2: The Queue does not support meaningful review yet.**  
    It does not regularly reload proposals, so new ones can remain invisible. It also omits `change`, showing rationale beside Approve. Refresh proposals on relevant events and Queue opening; display the exact change, supporting measurement, run/version, and the meaning of approval. Treat fetch failure as unavailable, not an empty queue. [Queue rendering](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/admin.js:276)

23. **P2: Grants and public-endpoint abuse controls are unspecified.**  
    Specify function ownership, `SECURITY DEFINER`, empty search paths, schema-qualified references, and exact table/sequence/function grants. Existing grants do not automatically cover new objects. Bound and coalesce bad-key audits so public requests cannot create unlimited database writes. Test actual Supabase-style default privileges. [Supabase function security](https://supabase.com/docs/guides/database/functions)

24. **P2: Two independently cleared blocks do not implement “one try.”**  
    Existing `admin_block_clear` only timestamps a row. File deletion neither reconciles the failure nor consumes a one-run authorization. Use an owner-issued recovery receipt tied to the block generation, consumed for one explicit job. Let the worker reconcile the local state automatically. Neither elapsed time nor file absence should authorize recovery.

25. **P2: Retention and provenance are missing.**  
    Record input/report hashes and CLI, model, prompt, schema, policy, and metric versions. Define retention for jobs, reports, proposals, temporary files, CLI sessions, and diagnostic logs. Existing pruning covers audit/feed events only. Redaction after invalidation is not deletion of local or provider copies.

26. **P3: Heartbeat wording overstates liveness.**  
    Before/after events are last-observed transitions, not proof that Bloom is currently working. Separate worker liveness from stage state, bind displayed heartbeats to the job, and show stale/unknown explicitly. Update the existing “no model,” “daily review,” and readiness copy throughout the dashboard.

The proposed tests need additional coverage before acceptance:

- Real two-session races for claim/admission versus invalidation, policy changes, block insertion, and expiry.
- Duplicate/out-of-order/terminal posts, missing-stage finish, ambiguous HTTP acknowledgements, and expired-lease failure recording.
- Real CLI transport retry counts, isolation, early stdout errors, descendant termination, crash points, and failed block persistence.
- Account changes with late replies, cached-proposal invalidation, held-proposal approval, no-data skipping, stale queues, and review A versus findings B.
- Nimbus references, strict-JSON boundary cases, safe diagnostic projections, recovery authorization consumption, and disclosure-risk fixtures.

On the three open questions:

1. **Anon plus key is acceptable for this narrowly scoped worker.** A dedicated Auth user is not inherently safer and adds session-renewal failure modes. Keep the 32-byte random capability, hashed storage, TLS, revocation/rotation, explicit grants, and narrow RPC permissions. Never give the worker staff membership or a service-role key. Test “anon cannot call staff/admin RPCs”; anon must intentionally be able to invoke worker RPCs, whose bodies deny invalid keys.

2. **Keep the 15-second outbound polling initially.** It needs no public endpoint on the Mac and makes 5,760 polls per continuously awake day. Avoid a durable audit row for every empty poll. A LaunchAgent depends on the user being logged in; interval firings are missed during sleep or while the job is running. Queue expiry and honest offline status are essential. [Apple launchd guidance](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)

3. **Yes, the payload can still expose an individual’s contribution.** Repeated exact snapshots permit differencing; overlapping stream counts permit inference; one person can dominate record-weighted totals; zero and suppression transitions reveal information. V3 already protects positive and complementary contributor cells for shares, so those controls are not missing. They do not solve these residual risks. Minimize per-agent payloads, control repeated releases, assess contribution limits/coarsening, and do not call the results anonymous solely because `k=20`. [NIST’s aggregate-disclosure guidance](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-226.pdf)

**BUILD with the changes listed above.**

