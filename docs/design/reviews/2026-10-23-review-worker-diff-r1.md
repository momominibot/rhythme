# Codex diff review, round 1 (23 Oct 2026): HOLD

**HOLD.** I reviewed all 14 changed files, the design responses, and the supplied dry-run evidence. The checkout advanced to `8b4689b` through a main merge during review; the worker, SQL migration and dashboard implementation remained unchanged.

Below, `review_worker.py` means `tools/worker/review_worker.py`; SQL locations refer to `supabase/migrations/20261023140000_staff_review_worker.sql`.

1. **P1: Exit-zero provider failures can pass as success.**  
   `review_worker.py:240`, `:254`, `:281`  
   Reproduced acceptance of valid output alongside a usage-limit message in an ordinary stdout message, HTTP 429/authentication failures on stderr, and a limit message in the final report. The classifier examines too few event types and phrases.  
   **Fix:** Check both complete output channels and the final response for structured provider failures and tested failure signatures before accepting a stage.

2. **P1: A simultaneous server stop discards an observed provider failure.**  
   `review_worker.py:268`, `:271`, `:381`  
   If the output reader records a failure while a heartbeat is pending, and that heartbeat returns stop, `Stop` wins over `Fail`. The attempt is deleted without a provider block. Reproduced.  
   **Fix:** Preserve and durably record the first provider failure even when cancellation also occurs.

3. **P1: Zero retry counters do not establish the no-retry rule.**  
   `review_worker.py:32`, `:207`, `:268`  
   After repairing the startup configuration, Codex 0.160.0 still has default-enabled unbounded connection recovery and a transport-fallback path outside the ordinary retry budget. The supervisor can be blocked inside a 20-second heartbeat while Codex retries. This is source-verified, not a live provider experiment.  
   **Fix:** Pin a runtime/configuration that disables every recovery path, and prove exactly one request against a local failing provider. Keep termination supervision independent of heartbeat requests. [Codex retry implementation](https://raw.githubusercontent.com/openai/codex/rust-v0.160.0/codex-rs/core/src/responses_retry.rs), [feature defaults](https://raw.githubusercontent.com/openai/codex/rust-v0.160.0/codex-rs/features/src/lib.rs).

4. **P1: Held proposal words remain on screen.**  
   `admin.js:343`, `:354`  
   Both hold paths clear `proposals` in memory without immediately redrawing Queue. If the following overview request hangs or fails, the previous rationale and change remain visible. Reproduced with rendered-state probes.  
   **Fix:** Synchronously remove held content from the current view before starting replacement requests.

5. **P1: Switching accounts leaves the previous account’s screen and some caches visible.**  
   `admin.js:419`, `:405`  
   `accountChanged()` clears several variables but leaves the DOM until the new `admin_me` answers. A slow request leaves account A’s screen visible to B. `reports` and `plaza` caches are not cleared either. Reproduced.  
   **Fix:** Immediately replace the screen with a neutral loading state and clear every account-bound cache and loading flag.

6. **P1: Routine pruning deletes outstanding proposals and decision history.**  
   SQL `:74`, `:270`; `admin.js:329`  
   “Prune audit older than a year” also deletes terminal review jobs older than 90 days. The new cascading foreign key deletes their proposals, including open/held proposals or a proposal approved yesterday.  
   **Fix:** Preserve proposals independently, for example with `ON DELETE SET NULL`, and specify any proposal retention separately. Report intentional deletion counts accurately.

7. **P1: Failed feed loads still appear empty. This is an inherited path reused by the feature.**  
   `admin.js:231`, `:351`, `:365`  
   An initial failed feed request leaves “Nothing has happened yet.” Unexpected successful response shapes are also converted to `[]`. This violates the stated dashboard house rule even though the underlying behavior predates this diff.  
   **Fix:** Distinguish loading, unavailable, stale and successfully empty states.

8. **P2: The installed Codex rejects the worker’s configuration before starting.**  
   `review_worker.py:207`  
   An offline configuration check on Codex 0.160.0 returns: `model_providers contains reserved built-in provider IDs: openai`. Consequently, every attempted review fails before inference.  
   **Fix:** Use supported configuration for the pinned CLI and validate configuration locally before claiming a job.

9. **P2: The LaunchAgent cannot find the installed Codex executable.**  
   `tools/worker/com.rhythme.review-worker.plist:27`; `review_worker.py:23`, `:211`  
   Its PATH excludes `/Users/michiyomimi/.local/bin`, where Codex is installed. The template therefore claims a job and fails spawning the child, later recording an uncertain attempt.  
   **Fix:** Configure a verified absolute `RHYTHME_CODEX` path and check executable availability before claiming.

10. **P2: The generated output schema is incompatible with strict Structured Outputs.**  
    `review_worker.py:175`  
    `change` allows arbitrary object properties through an `additionalProperties` schema. Strict output requires `additionalProperties: false`. This is a documented incompatibility; no provider request was made to demonstrate rejection.  
    **Fix:** Define explicit change variants or a bounded key/value representation that satisfies the supported schema subset. [Structured Outputs requirements](https://developers.openai.com/api/docs/guides/structured-outputs).

11. **P2: The configured runtime is neither tool-free nor restricted to the supplied aggregate context.**  
    `review_worker.py:32`, `:205`, `:210`  
    Real HOME/CODEX_HOME are retained. `--ignore-user-config` skips configuration, and `--ignore-rules` skips execution-policy files; neither establishes exclusion of global AGENTS instructions. The default-enabled `view_image` feature is also omitted from the disable list. An empty working directory does not provide the claimed isolation.  
    **Fix:** Use an isolated instruction/configuration environment, explicitly disable all tools, restrict readable files, and verify the actual prompt/tool inventory offline. No diary leak was reproduced. [CLI flag definitions](https://raw.githubusercontent.com/openai/codex/rust-v0.160.0/codex-rs/exec/src/cli.rs), [global instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [tool defaults](https://raw.githubusercontent.com/openai/codex/rust-v0.160.0/codex-rs/features/src/lib.rs).

12. **P2: Old boot callbacks can replace the new account’s dashboard.**  
    `admin.js:407`, `:411`, `:415`, `:424`  
    After B boots successfully, A’s late `admin_me` rejection reaches the unguarded catch and replaces B’s view with a sign-in error. Separately, the auth subscription and explicit sign-in/init callbacks can start overlapping boots and install duplicate polling timers.  
    **Fix:** Give the entire boot lifecycle a generation, including catches and timer installation, and coalesce duplicate boots.

13. **P2: Refresh does not maintain one request identity while pending or uncertain.**  
    `admin.js:217`, `:219`  
    Busy state exists only on the current button. An overview redraw replaces it with an enabled button while the request remains pending; another click creates another request ID. A lost response similarly provides no reconciliation path.  
    **Fix:** Store refresh state and its request ID outside the DOM, preserve it across renders, and reconcile uncertain outcomes before creating another operation.

14. **P2: Concurrent identical refresh requests do not replay the receipt reliably.**  
    SQL `:138`, `:140`, `:167`  
    Both requests can miss the receipt before acquiring the worker lock. The second then repeats the deterministic work and fails on the receipt’s unique constraint instead of returning the first answer. Its transaction rolls back, but the caller receives an error.  
    **Fix:** Acquire the lock before checking the receipt, or recheck immediately after acquiring it. Add a two-session duplicate-request test.

15. **P2: The promised proposal matrix is not enforced.**  
    `review_worker.py:162`; SQL `:377`  
    Kind and target are independently allowed, and `change` can be empty. For example, a cycle proposal with `reminder_timing`, `metric_registry`, and `{}` passes the Python validator; the SQL predicates permit the same combination.  
    **Fix:** Define one shared agent/kind/target contract with required change fields and types, and enforce it on both sides.

16. **P2: Heartbeats do not notice an active review being disabled or held.**  
    SQL `:351`  
    `worker_beat` checks claim and time only. Turning review off, withdrawing the run or recording another provider block still returns okay to an active stage. Cancellation is discovered only at posting or the next admission.  
    **Fix:** Recheck the gates under the shared lock and return a stop immediately. Previously transferred data cannot be recalled, but continued processing can be stopped.

17. **P2: Review-status failures are silently concealed.**  
    `admin.js:368`, `:379`  
    An initial failure produces no status line. Later failures retain “reading” and the old heartbeat age indefinitely, while a successful overview can label the page live.  
    **Fix:** Track review-status availability and last successful observation separately; show unavailable/stale state and age it locally.

18. **P2: Accepted report summaries are truncated without a way to read the remainder.**  
    SQL `:438`; `review_worker.py:153`  
    Summaries may contain 400 characters, but the only staff-facing copy keeps 280. Event details omit the full summary, and no report reader exposes the stored remainder.  
    **Fix:** Include the full summary in a held-run-protected detail/read endpoint, or make the accepted contract match the display.

19. **P2: Block recovery instructions promise work that is never queued.**  
    `admin.js:372`; SQL `:253`; `review_worker.py:337`  
    The dashboard says clearing the block lets the worker pick up another try automatically. Clearing only removes the block; it does not queue a job, and the worker’s unblocking pass claims nothing.  
    **Fix:** Say explicitly that the owner must clear the block and then press Refresh.

20. **P3: Failure persistence has a crash window.**  
    `review_worker.py:385`, `:302`  
    The attempt is deleted before the pending failure receipt is written. A crash or write failure between those operations loses the evidence requiring a provider block.  
    **Fix:** Durably write the pending failure first, then remove the attempt. Exercise interruption at each transition.

21. **P3: Process-group termination can leave descendants alive.**  
    `review_worker.py:214`  
    If the parent exits on TERM but a descendant ignores it, `p.wait()` succeeds and KILL is never sent to the remaining group. The existing test uses a cooperative `sleep` child.  
    **Fix:** Check the owned group independently of parent exit and enforce the grace-period kill for surviving descendants.

22. **P3: Crash recovery records uncertainty but does not stop the orphaned model process.**  
    `review_worker.py:211`, `:324`, `:363`  
    The child starts a separate session, while the attempt receipt contains no process identity. If Python dies, restart blocks further work but cannot terminate the previous child. Clearing the block can allow a new review while that child survives.  
    **Fix:** Persist verifiable process identity and reconcile/terminate the exact owned process tree before allowing recovery.

23. **P3: A blocked stdin write bypasses every timeout and heartbeat.**  
    `review_worker.py:258`  
    Deadline initialization happens after writing the entire prompt. A child that never reads stdin can stall the worker indefinitely. Reproduced with a valid 112,210-byte Nimbus prompt and a local non-model child: the configured timeout elapsed with zero heartbeats.  
    **Fix:** Start supervision before writing stdin and use a bounded asynchronous/nonblocking writer.

24. **P3: The local lock is not acquired atomically.**  
    `review_worker.py:83`  
    Another invocation can observe the directory before its PID file exists, or race another invocation reclaiming a stale directory. Both can claim ownership and later remove each other’s lock/state.  
    **Fix:** Use an OS-held lock such as `fcntl.flock`, with ownership-safe cleanup.

25. **P3: A stdout-reader exception can still produce success.**  
    `review_worker.py:245`, `:270`  
    Reproduced: `turn.completed`, followed by an item whose value is a list, crashes the reader with `AttributeError`. Exit zero and valid output still pass because thread exceptions are not propagated.  
    **Fix:** Validate event shapes, convert every reader exception into failure, and require successful completion of both readers.

26. **P3: Stream limits are checked after potentially unbounded allocation.**  
    `review_worker.py:231`, `:251`  
    Pipe iteration reads a whole line before counting bytes. A huge unterminated line bypasses the intended memory bound. Stderr also has no total-output limit; 64 KiB limits only retained diagnostics.  
    **Fix:** Read bounded chunks and cap both line length and total bytes on both channels.

27. **P3: Finishing a job bypasses expiry and current gates.**  
    SQL `:468`  
    After five accepted stages, a delayed finish can mark the job done after its deadline or after review/run validity changes, provided another RPC has not already expired it.  
    **Fix:** Run expiry and current-gate checks under the lock before accepting completion.

28. **P3: Deadline checks use transaction-start time after lock waits.**  
    SQL `:117`, `:308`, `:339`  
    A request can begin before expiry, wait for the lock until after expiry, then still admit a stage because `now()` remains the earlier transaction timestamp.  
    **Fix:** Sample `clock_timestamp()` after lock acquisition and use that consistent instant for admission and lease calculations.

29. **P3: Worker-key authorization is cached before lock acquisition.**  
    SQL `:305`, `:308`, `:394`  
    A request can validate its key, wait, and proceed after that key has been revoked. The key is not revalidated at the protected admission/post boundary.  
    **Fix:** Revalidate under the same serialization used for key revocation and stage admission.

30. **P3: SQL validation accepts missing required report fields.**  
    SQL `:368`, `:385`  
    Missing properties yield SQL NULL, so the `IF` predicates do not reject them. A report containing only a valid summary can pass the helper; missing Nimbus ranking also passes. Python currently masks this gap in the normal path.  
    **Fix:** Require the keys explicitly and use NULL-safe type comparisons.

31. **P3: Key rotation can make failure recovery impossible through the dashboard.**  
    SQL `:447`; `review_worker.py:316`  
    The revoked key cannot submit its pending failure. A replacement key cannot match the old job’s `key_id`, resulting in a permanent local block with no server block ID for the owner to clear.  
    **Fix:** Provide narrowly scoped reconciliation of historical claims and an audited owner recovery route, without restoring execution authority to revoked keys.

32. **P3: Registry definitions are read live instead of from the report’s snapshot.**  
    SQL `:333`, `:338`  
    A registry change between deterministic computation and stage admission combines old findings with new definitions. Only an input hash is retained, so the original interpretation cannot be reconstructed.  
    **Fix:** Snapshot/version the registry with the deterministic run and retain the exact admitted payload or an immutable reference.

33. **P3: Queue counts and empty-state copy are incorrect.**  
    `admin.js:281`, `:284`  
    An unavailable proposal load displays a count of 11, the length of `"unavailable"`. A successful review returning no proposals still says this phase has nothing it may measure.  
    **Fix:** Count only arrays and use an empty-state message based on actual review state.

34. **P3: Operational documentation contradicts the implementation.**  
    `review_worker.py:2`; `tools/worker/com.rhythme.review-worker.plist:23`; design sections 2 and 4  
    The worker/design say 15-second polling versus the template’s 20 seconds. The design also describes heartbeat supervision as a timer thread, whereas the implementation performs blocking heartbeat calls in the supervisor loop.  
    **Fix:** Align the documentation with the final supervised implementation and verified interval.

The tests explain several missed failures:

- `tools/test-core.js:5990` returns a fresh element for every lookup, and `:5993` always reports no session. Consequently, its passing cache assertions do not test retained DOM content or a real signed-in account switch. Use persistent DOM state and signed-in A/B transitions.
- `tools/worker/test_review_worker.py:97` checks that flags are present, while `fake_codex.py` accepts them without configuration parsing. Add offline checks using the pinned CLI and a local fake provider.
- The process test at `tools/worker/test_review_worker.py:140` needs TERM-resistant descendants and crash/orphan cases. The database suite needs concurrent receipt, expiry and revocation scenarios.

The added dashboard harness passed **10/10**, but the additional probes above reproduced failures it does not cover. Python/XML syntax checks passed. I did not rerun the database-mutating suites or make a live model call. The supplied dry run supports its listed checks, not the missing concurrency/runtime cases. I found no automatic proposal-application path or diary-row query in the worker payload construction.

**HOLD.**

