## 1. LIVE PATH VERDICT

**The dashboard has a functioning storage and display path, plus evidence of an earlier deterministic run. It is not currently a continuously running data-processing pipeline, and the available evidence does not establish that the deployed phone-to-dashboard path works end to end today.**

The empty tables are not evidence of a failure. However, the missing schedule, misleading freshness labels, and several consent, metric and deletion defects need attention before real measurements are relied upon.

This is a read-only review of checkout `080a8ff`. I accepted your 21 October database snapshot as current evidence. I made no changes, triggered no dashboard run, and made no model calls.

For SQL references below:

- **D** = `supabase/migrations/20261019030000_team_dashboard.sql`
- **F** = `supabase/migrations/20261019040000_team_dashboard_floor.sql`

### The actual path

| Link | What the code does | Verdict |
|---|---|---|
| **Phone entry → local store** | Writes entries to `localStorage` under `ovumind_db_v1`. Entries have an ID, type, observation date, JSON data, source and client timestamps. Save checks and rollback exist for add/update. `ovu-store.js:9`, `:58`, `:99`, `:112`. | **Implemented.** Local diaries are not represented by your database counts. |
| **Local store → sync eligibility** | Requires a signed-in account and that account’s cloud-backup choice. Sync reconciles account consent before transferring records. `ovu-sync.js:179`, `:286`. | **Implemented, with a defect:** `doorOpen()` returns true if `OvuConsent` is absent. This client gate fails open, although server checks provide another boundary. `ovu-sync.js:181`. |
| **Sync → `public.entries`** | Uploads entry JSON after removing photo fields; notes and reflections are not generally removed from the backup. Uses account RLS, upserts, deletion tombstones and a pull cursor. `ovu-sync.js:137`, `:148`, `:298`, `:314`, `:325`; `20261018110000_sync.sql`. | **Built; currently empty.** Zero entries and profiles means no cloud diary is present now. It does not prove nobody ever backed up or that first backup succeeds on the deployed frontend. |
| **Improvement choice → server consent** | `OvuAuth.setImprove()` writes `analysis_consent_set`, then updates the local mirror. The purpose exists separately from cloud backup. `ovu-consent.js:38`; `ovu-auth.js:133`, `:154`; F:9. | **Built; currently empty.** No account currently has a row authorizing this analysis. |
| **Consent → eligible cohort** | `metrics_build` selects active `analysis_consent` rows whose age band is in policy, then applies the accepted-time/history scope. F:42. | **Implemented but incomplete as a consent contract.** It does not independently verify current notice requirements or the canonical adult-attestation event. |
| **Eligible cohort → diary inputs** | Copies eligible entries into a temporary table, including the entire `data` JSON. Filters deleted records and `created_at` against consent scope. F:48. | **No eligible inputs today.** The claim that text is never read is too strong: full JSON is copied, although the metrics do not analyse the text. |
| **Inputs → metrics** | Fixed SQL calculates logging counts, percentages, practice minutes and cycle intervals. F:70. | **Implemented, with correctness defects described below.** It is deterministic SQL, not four model agents. |
| **Run → stored findings** | `admin_run` creates a run, invokes the metric builder, inserts findings/events and records success or a caught failure. F:112. | **Historically exercised.** Your snapshot proves one readiness run was retained on 19 October, with no eligible people and no measured diary data. |
| **Daily scheduling** | No agent cron job exists in your supplied snapshot. | **Missing.** The social sweep is a different job and does not refresh these metrics. |
| **Findings → `admin_overview`** | Returns findings from the latest successful run, alongside current operational counts. D:374. | **Implemented.** Reading the overview does not recompute findings. It can combine fresh account counts with old metrics. |
| **Overview → dashboard page** | JavaScript polls overview/feed endpoints and renders stored findings. `admin.js:252`, `:284`. | **Implemented in this checkout; current rendered deployment not independently verified.** Polling is not continuous metric processing. |
| **Plaza → dashboard** | Plaza counts use separate operational RPCs and retention logic. | **Separate live path.** Plaza activity does not establish that diary analytics ran successfully. |

### What is empty, missing or broken

**Empty by current state**

There are zero backed-up entries, zero analysis-consent rows and therefore no authorized cohort to measure. Those are legitimate empty states. The two auth accounts and two staff owners are not evidence of two consenting diary participants.

Twenty opt-ins alone would still be insufficient for many metrics. Twenty eligible accounts with no sleep records cannot produce a measured sleep result. Each finding needs its own qualifying contributor count.

**Missing**

There is no daily agent schedule. There is also no implemented proposal-ranking or action-application engine: the current run counts proposals and reports policy state. F:123. The dashboard’s orchestration language is ahead of that implementation.

**Broken or misleading in the checked source**

- **“Pipeline Alive” does not mean fresh.** Any latest run with status `ok` produces that label, regardless of age. `admin.js:79`.
- **“Measured” can overstate coverage.** `metrics_build` returns `measured: true` whenever eligible accounts exist, even if every metric is suppressed. Readiness also counts consented accounts without requiring any eligible diary contribution. F:53, F:107.
- **A direct cron call to `public.admin_run(28)` is unsuitable.** `staff.caller()` requires authenticated request JWT claims identifying a staff member. A normal database cron invocation supplies no such user context. It would return a denial, potentially while the SQL job itself appears successful. D:187, D:205; F:116.
- **Metrics have date, unit and interpretation defects.** These are detailed in section 2.
- **Withdrawal or deletion does not invalidate already stored findings.** The overview continues selecting the latest successful run. D:386.

### Corrections to the supplied reviewer note

| Draft claim | Checked conclusion |
|---|---|
| “The plumbing exists end to end and is not broken.” | Too strong. The components exist, but deployment parity and a current real-account traversal are unverified, and the source contains defects. |
| The two accounts “have never backed up a diary.” | Not established. The snapshot proves no cloud copy exists now. |
| `metrics_build` is the only diary reader. | Not literally true. `staff.svc_counts()` also reads account IDs from `public.entries`, without improvement consent, to count cloud copies. It does not read diary content. D:246. This still conflicts with a strict “no diary row read before analysis consent” requirement. |
| A new run “rewrites” stale findings. | It **appends** new findings. The overview then selects the new successful run; old findings and wording remain in history. F:57, D:386. |
| The “not built” sentence is corrected in the later migration. | Confirmed in source. Whether that exact function definition is currently installed needs catalog readback. The design document says the migration was applied. |
| `metric_version` exists but nothing bumps it. | Incorrect. F hardcodes version **2**, while the supplied live policy says **1**. There are competing version authorities. F:59, F:102. |
| Free text is already excluded from the agents. | Excluded from metric expressions, but not from their temporary input table: F:50 selects full `e.data`. |
| Aggregates over twenty people need no deletion. | Unsupported. A count threshold does not establish anonymisation, lawful indefinite retention or freedom from the product’s deletion promise. |
| UTC is definitely the reporting timezone. | Unverified. SQL uses session-dependent `current_date`; it does not explicitly select Singapore time. |
| A `synced_at` watermark makes a run replayable. | Insufficient. Updates overwrite records, consent changes, and the timestamp cursor has a transaction-order problem. |
| Jev’s scores establish the reason or readiness. | They are reported judgments, not measured probabilities or verification. The supplied zero counts already explain the absence of measurements without ranking causes numerically. |
| Real test diaries are the only way to test measured results before launch. | Incorrect. A disposable synthetic cohort can exercise the twenty-person boundary without collecting real health data. |

The design document already records a **rolled-back synthetic test on 19 October** with 22 accounts and 21 opt-ins. That is useful historical evidence, not current production acceptance. Its closing note also records an earlier first-backup frontend/server mismatch. `docs/design/2026-10-19-data-capture-dashboard-agents.md:153`, `:170`.

That document contains sections 1–11 in this checkout; I found no section 12. Later sections supersede several earlier proposals.

## 2. GAPS FOR FUTURE-PROOFING

### P0: resolve before processing real contributions

**1. Make consent one authoritative, versioned server contract.**

Currently, `analysis_consent` and `consent_events` can diverge. The analysis setter updates one; the client separately records the other. The setter accepts any notice version of at least one, a client-supplied age band and an API-supplied `all` history scope. Repeated grants reset `accepted_at`. The revision precondition is optional. F:9.

Required changes:

- Record the consent event and update its current-state projection atomically.
- Validate the accepted notice and purpose against an immutable server notice registry.
- Preserve the start of an existing consent interval on an idempotent repeat.
- Require the server’s adult-attestation state, not merely an age-band string.
- Make withdrawal and publication share a consent revision check, so a run cannot publish against a consent snapshot that has become invalid.
- Keep backup, improvement, AI assistance, social participation and research as separate purposes.

The app sends `'adult'` when no optional age range exists, but D:58 does not seed it. The consent plan says it was added directly to the live policy. **This is migration reproducibility drift, not a confirmed live eligibility failure.** `ovu-auth.js:140`; `docs/design/2026-10-19-consent-rebuild-plan.md:110`.

There is also an account-isolation concern: the local consent ledger derives state without filtering every event to the current account. An isolated in-memory check accepted an event attributed to another account. Harden event admission and test late responses across account switches. `ovu-consent.js:57`, `:97`.

**2. Define “from now” precisely and minimise the analysis projection.**

The current boundary is `entry.created_at >= accepted_at`, not observation date. An imported historical observation created after consent can qualify. Conversely, updating an older record does not necessarily make it qualify. Client-controlled timestamps are a weak foundation for this policy. F:50; `ovu-store.js:112`, `:133`.

Choose and disclose whether “from now” means:

- observations occurring after consent;
- records first collected after consent;
- or a separately approved historical range.

Store observation date, client recording time and server receipt time separately.

For analytics, select only fields needed by approved metrics. Do not copy whole JSON objects containing reflections, food notes or other text into an analysis staging table. Exit before querying entries when there are no eligible accounts.

Move operational backup counts to purpose-appropriate backup receipts, instead of scanning unconsented diary rows through `svc_counts`.

**3. Make deletion and withdrawal affect published derivatives.**

The current actions have different meanings:

| Action | Current effect | Missing downstream effect |
|---|---|---|
| Local “Delete everything” | Explicitly described as starting fresh on this phone; preserves account/cloud state. `room.js:1390`; `ovu-store.js:445`. | It is not global erasure. Its scope must remain unmistakable. |
| Delete cloud copy | Deletes entries and profile through separate requests. `ovu-sync.js:383`. | No derived-finding invalidation; no atomic consent/deletion transaction. |
| Delete account | Deletes entries, attempts profile deletion, then deletes the auth user. `supabase/functions/account/index.ts:44`. | Aggregate findings survive. Partial failures are possible; the profile-delete error is ignored. |
| Withdraw improvement | Marks the analysis row withdrawn. F:23. | Existing results remain available through overview/history. |

The simplest safe first implementation is to **invalidate affected report releases and recompute from remaining authorized data**, suppressing any newly small cells. Until the retention policy is agreed, avoid exposing historical releases whose contribution rights are unresolved.

There is no persistent participant-to-finding lineage today. That means targeted invalidation cannot simply be assumed. Initially, conservatively invalidate the relevant report family/windows instead of creating a permanent sensitive membership map solely for convenience.

Inventory other retained identifiers too. Staff audit actors, email-keyed account grants and copied social-report names are not all removed by an auth-user cascade. Social moderation retention needs its own documented purpose. D:36; `20261019020000_account_grants.sql:2`; `20261019130000_plaza_friends.sql:155`.

**4. Treat twenty as a suppression policy, not an anonymity guarantee.**

The revised builder correctly suppresses both value and people count below twenty. F:96. But:

- `svc_counts` returns exact active, eligible and withdrawn consent counts; the page displays active opt-ins exactly. D:250; `admin.js:84`.
- Percentages can have twenty contributing people but a tiny numerator subgroup.
- Repeated overlapping releases can reveal changes attributable to very few people.
- One participant can dominate an unbounded total.
- Raising the current floor does not resuppress historical findings on read.
- Plaza groups such as trying-to-conceive or menopause carry potentially sensitive context, even without diary text.

Apply suppression to every relevant response and export, including numerator/complement cells where needed. Add contribution bounds and a release policy for overlapping windows. Keep operational counts and health-analysis outputs explicitly separated.

**The present implementation is a minimum-contributor rule. It is not proof of formal k-anonymity or differential privacy.**

**5. Correct the metric contract before treating numbers as trustworthy.**

| Defect | Evidence and consequence |
|---|---|
| “Last 28 days” includes 29 calendar dates | `date >= current_date - 28` includes today plus the preceding 28 dates. F:36, F:72. |
| No upper date boundary | Future-dated server rows could enter the window. Client validation is not a database guarantee. F:72–77. |
| Wrong units | Every finding receives unit `accounts`, including minutes, percentages, days and median intervals. F:102. |
| Different cycle episode definitions | The phone joins bleeding dates separated by one missing day; SQL starts a new episode for any gap greater than one day. `ovu-store.js:281`; F:73. An isolated check reproduced one phone episode versus two SQL starts for 1 and 3 October. |
| Ambiguous population weighting | The median is over recorded intervals, so people with more intervals contribute more weight. It is not a median of person-level medians. F:82. |
| Missing values become zero | Practice minutes use `coalesce(..., 0)`. Malformed numeric text can fail the whole run. F:90. |
| Recording patterns become diagnoses of data quality | Multiple sleep rows are labelled conflicts, although naps and split sleep can legitimately produce multiple rows. F:84. |
| Completion denominator is unclear | Missing `completed` is effectively not completed, even if a capture route never supplied the field. F:91. |

Recommended reporting convention: **28 completed dates**, with `[report_date − 28, report_date)` boundaries, plus a separately labelled provisional “today” view if needed. Use `Asia/Singapore` for the reporting clock while preserving each observation’s original local date.

### P1: establish reliable daily operation and defensible provenance

**6. Version the schemas, notices and computations separately.**

A single store `VERSION = 1` and loosely structured entry JSON are insufficient for evolving capture. `ovu-store.js:10`, `:36`.

Introduce:

- `entry_schema_version` and per-type validation;
- `event_schema_version` for operational events;
- immutable notice ID, version, text hash and purpose;
- a metric registry containing definition, unit, valid inputs, denominator, person-count rule, window, purpose and computation version;
- explicit report and policy versions;
- app build and computation-source hashes.

Unknown entry types should be preserved safely or quarantined, not silently discarded by an older client. Preserve immutable import provenance separately from the current editor/source label.

Remove the competing version authorities: the live policy’s `1` and the builder’s hardcoded `2` must not silently coexist.

**7. Make runs idempotent, distinguish recomputation from replay, and publish atomically.**

`run_begin` provides a transaction lock, but it does not deduplicate the same requested run. A second caller can wait for the first transaction and then create another run. D:226.

Use an explicit unique run key, for example:

`job + due_date + window + metric_version + requested_revision`

Record the source boundary, consent revision, purpose, eligible population, valid contributor counts and code version. Publish the complete report only after validation.

A timestamp and cohort size cannot reproduce overwritten history. Choose between:

- **Recommended initially:** recompute current authorized data and publish a new report revision, retaining the reason it changed;
- **Later, only if justified:** a limited, consented input-version journal with explicit retention and deletion rules.

Do not retain health snapshots indefinitely merely to make old numbers reproducible. Withdrawal must supersede replay convenience.

**8. Repair sync ordering before relying on complete ingestion.**

This checkout uses a `(synced_at, id)` cursor, which handles timestamp ties. However, the database stamps `synced_at = now()`, meaning transaction start time. A long transaction can commit after a newer cursor has advanced past its timestamp. `ovu-sync.js:199`; `20261019010000_accounts_sync_order_guard.sql:24`.

PostgreSQL documents this transaction-time behaviour explicitly. [PostgreSQL date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html)

The draft’s references to PRs #16 and #22 do not establish that their fixes are installed here or live.

Adopt a reviewed transaction-order delivery mechanism, with real two-session race tests and an explicit compatibility transition. Separately, recompute affected metric windows when entries arrive late, are edited or are deleted. A correct pull cursor and correct aggregate refresh are different requirements.

**9. Add scheduling with a private worker entry point and durable failure evidence.**

Keep the interactive staff RPC authenticated. Add a narrowly permissioned internal SQL entry point for cron; do not manufacture a staff user JWT.

Required run behaviour:

- one scheduled attempt per due key;
- no automatic retry of that attempt;
- bounded execution;
- independent evidence that the attempt started and finished;
- explicit application success, not just SQL execution success;
- missed-run and stale-output detection;
- a documented pause and unschedule mechanism.

The present run uses `now()` for both start and finish inside one transaction, so subtraction is not a reliable duration. Use `clock_timestamp()` or an external monotonic timer.

Caught SQL errors return JSON, so cron can report SQL success while the application reports failure. Cancellation or connection loss can roll back the run receipt entirely. PostgreSQL’s `OTHERS` handler also excludes query cancellation. Reconcile application runs with `cron.job_run_details`. [PostgreSQL exception handling](https://www.postgresql.org/docs/current/plpgsql-control-structures.html), [Supabase Cron](https://supabase.com/docs/guides/cron)

**10. Enforce model gates at execution, not through dashboard wording.**

Today’s staff metric run makes no model calls, which is appropriate.

However, `staff.provider_blocks` is currently a table and owner-clear interface, not a complete provider execution controller. The run merely counts existing blocks. F:122.

Any future Jev or other model stage must check, server side:

1. `model_on`;
2. permitted purpose and approved payload;
3. active provider/workflow blocks;
4. explicit run authority and budget;
5. a single-job lock.

The first timeout, authentication/usage/rate failure, invalid response or structured provider error must persist a block and stop the attempt. No automatic retry, provider fallback or next-day bypass.

The separate Luna and insight relays do not check staff `model_on` or these provider blocks. They use their own consent gates. Frontend `aiPaused` is not a server-wide switch. `supabase/functions/luna/index.ts:95`; `supabase/functions/insight/index.ts:80`, `:97`.

Therefore, **staff `model_on: false` cannot be described as “all Rhythme AI is disabled.”**

**11. Give every finding a verifiable provenance record and honest operational status.**

Store and expose:

- run ID and immutable report revision;
- metric definition/version and unit;
- exact window and reporting timezone;
- actual qualifying people, record denominator and missing/invalid coverage;
- consent purpose and eligible notice versions;
- computation version/source hash;
- source boundary, supersession and invalidation status;
- suppression reason.

`admin_overview` currently omits several of these fields even where details exist. D:387.

Show separate statuses for **API reachable**, **run due**, **run completed**, **output fresh**, **no authorized data**, **suppressed** and **failed**.

Also fix two operational traps:

- The feed can skip events when more than its page limit arrives between polls; drain pages before advancing the cursor. D:391; `admin.js:253`.
- `relay_calls_today` sums rate-limit buckets, including global and per-user/IP buckets. That is not a count of successful model responses. D:253; `supabase/functions/insight/index.ts:83`.

Sanitize failure messages. Raw SQL conversion errors can contain submitted values and should not become a staff feed’s accidental health-data channel.

### P2: collect only what supports a defined question

**12. Add a small, separate feature-event stream.**

Useful questions include:

- Did an import start, finish or fail?
- Did a logging form open and save successfully?
- Was a restore attempted successfully?
- Did a help explanation resolve a technical task?

A minimal event could contain a random deduplication ID, allowlisted event name, schema/app version, coarse date, platform class, result code and applicable consent revision.

Avoid an open-ended `properties` JSON bag. Batch and deduplicate events. Prefer daily summaries and coarse duration bands over permanent click timelines.

Even a feature name can reveal health context. Do not casually log precise condition-specific screens or plaza groups under a “no health content” label. Use its own opt-in purpose and a strict vocabulary.

**13. Design research exports as releases, not database dumps.**

Use one tidy row per finding, with:

`release_id, run_id, metric_id, metric_version, window_start, window_end, timezone, value, unit, people, denominator, coverage, state, suppression_reason, purpose, notice_versions, computed_at, source_version`

Provide CSV or Parquet plus a JSON data dictionary. Suppressed values remain null, never zero. Each finding needs its own people count; a run-level eligible count is not a substitute.

Improvement consent does not automatically authorize a new research purpose, external sharing or person-level export. No raw notes, user IDs or participant membership lists should be included by default.

**14. Set Singapore governance boundaries before expanding purposes.**

This is a list for the DPO and lawyer, not legal clearance:

- Does the notice accurately describe the actual inputs, derived outputs and recipients?
- Is each proposed use product improvement, service delivery or a separate research purpose?
- What retention is justified for raw data, derived reports, audit evidence, moderation records and backups?
- What must happen after withdrawal, cloud deletion and account deletion?
- Are overseas transfers, provider contracts and processing locations appropriate?
- Does a proposed study fall within HBRA, and what institutional, ethics-review and consent requirements follow?

Singapore’s retention limitation is purpose-based; it is not satisfied merely by calling a result an aggregate. [MDDI’s explanation of PDPA deletion and retention](https://www.mddi.gov.sg/newsroom/pq-on-provision-for-deletion-of-personal-data-upon-request/)

MOH provides the applicable human biomedical research framework, but a specific study requires classification against its actual aims and data. [MOH: Regulation of Human Biomedical Research](https://www.moh.gov.sg/others/health-regulation/regulation-of-human-biomedical-research/)

**Do not capture:** local-only diaries for analytics, pre-consent history by default, free-text reflections, photos, exact location, advertising identifiers, contact lists, persistent device fingerprints, detailed interaction timelines, or inferred diagnoses for future unspecified use. Do not join social identities and health records merely because a join is technically possible.

## 3. THE ADAPTIVE DECISION ENGINE

**A small classical decision layer could eventually help choose among approved proposals. It adds little value to today’s empty, unscheduled metric pipeline. Quantum hardware is not justified here.**

I could read the Ranklore Quantum Optimization Playbook, beginning with its README. Its classical-first approach, explicit constraints, baseline comparison and evidence discipline are useful. Its broad speed or future quantum-migration expectations should remain hypotheses, not product claims.

The cited systematic review found no consistent empirical quantum utility in the digital-health studies it examined. It searched literature through June 2024, so it is not proof that every possible quantum application fails or a comprehensive assessment of all 2026 work. It nevertheless provides no justification for quantum hardware in this pipeline. [npj Digital Medicine 2025;8:237](https://www.nature.com/articles/s41746-025-01597-z)

### Where each component belongs

| Component | Appropriate role | Inappropriate role |
|---|---|---|
| **Deterministic code** | Consent eligibility, counts, schema validation, suppression, deadlines, deduplication and provider holds. | None of these should depend on a probabilistic model judgment. |
| **Jev** | Optional typed classification of proposal descriptions, evidence relevance or ambiguity, with citations and uncertainty. | Deciding whether consent exists, whether a count is below twenty, whether a run happened, or whether an action is legally permitted. |
| **Enumeration or CP-SAT** | Selecting a feasible subset of approved proposals under capacity, dependency, exclusion and timing constraints. | Inventing impact estimates, granting authority, establishing causal benefit or deciding clinical guidance. |
| **Human review** | Purposes, notices, retention, research releases, clinical changes, production changes and approved action boundaries. | Delegating these decisions implicitly through a high model score. |

Jev is still a model call. It must remain off while `model_on` is false and must obey existing provider blocks. Its typed output should advise a proposal review, not silently alter hard policy.

### A concrete first decision layer

Use `staff.agent_proposals`, extended with typed fields rather than assumptions buried in `change` JSON.

**Inputs**

- immutable proposal ID and revision;
- approved non-clinical surface and content ID;
- evidence references and grade;
- estimated effort;
- risk classification;
- dependencies and conflicts;
- owner approval status;
- expiry/cooldown;
- baseline metric and a proposed evaluation plan.

**Hard constraints**

- only explicitly approved, non-clinical candidates;
- at most one active revision per surface;
- a fixed total effort budget and maximum simultaneous changes;
- all dependencies satisfied;
- incompatible proposals excluded;
- no changes to consent, collection, clinical advice, predictions, reminders, rewards, pricing or saved preferences;
- an empty selection is valid.

For illustration, Jamie might authorize two simultaneous content changes and four review-hours per cycle. Those are proposed policy values, not evidence-based constants.

**Objective**

Initially use a transparent lexicographic order:

1. resolve approved operational defects;
2. prefer stronger evidence and clearer evaluation;
3. minimise risk and effort;
4. use a stable ID tie-break.

Do not turn speculative “impact” into a precise probability. Later, validated benefit estimates can support a constrained objective.

**Outputs**

An immutable recommendation containing selected and rejected proposal IDs, reasons, constraints, policy/input versions, alternatives and comparison with a simple baseline. Selection does not apply a change.

For a handful of proposals, bounded enumeration is easy to inspect. Introduce CP-SAT when dependencies and competing constraints make it useful. OR-Tools supports integer constraint models and explicit solution statuses. [OR-Tools CP-SAT documentation](https://developers.google.com/optimization/cp/cp_solver)

### Keep the mathematical and evidence boundaries

- Encode capacity directly as `Σ effortᵢ × selectedᵢ ≤ budget` in CP-SAT.
- In QUBO, squaring `budget − used_capacity` without slack penalises leaving capacity unused and changes the problem. A proper inequality conversion needs suitable slack variables, penalty calibration and validation against the original constraints. [D-Wave reformulation guidance](https://docs.dwavequantum.com/en/latest/quantum_research/reformulating.html)
- Weighted sums can miss discrete Pareto alternatives. Use constrained alternatives or epsilon constraints with tie handling when trade-offs matter.
- Solver “optimal” means optimal for the model and its tolerances. CP-SAT can return `OPTIMAL` after satisfying a configured gap limit. [OR-Tools solver definition](https://github.com/google/or-tools/blob/stable/ortools/sat/cp_model.proto)
- Monitoring before and after a change does not establish causal benefit. Use a predefined comparison, preferably randomized where appropriate, before claiming lift.
- A twenty-person floor is not a differential-privacy budget. Do not let an optimizer choose increasingly intrusive metrics under that label.

A daily cron schedule needs reliable orchestration, not optimization. Metric selection should initially be a small approved registry, not a contest to extract the most information.

## 4. A PHASED PLAN

All steps below are proposed. Nothing was implemented or scheduled.

### Phase 0: this week

| Step | Concrete work | Acceptance and reversibility |
|---|---|---|
| **Reconcile deployed state** | Read current function definitions, grants, triggers, policy including `adult_bands`, migration history and deployed app version. | Record source/live differences. Catalog reads only; no dashboard run required. |
| **Specify consent and deletion semantics** | Update the two design documents and define a purpose/notice registry, “from now”, local reset, cloud deletion and account deletion. | Jamie approves the user-facing contract before production changes. |
| **Prepare consent and minimisation repair** | New migration `<timestamp>_staff_consent_projection.sql`; changes to `ovu-consent.js`, `ovu-auth.js`, `ovu-sync.js`. | Atomic/idempotent consent, account-switch checks, fail-closed client gate, no unconsented diary scan. Additive migration with a feature flag. |
| **Prepare corrected metrics** | `<timestamp>_staff_metrics_v3.sql`, with typed projections and a metric registry; `admin.js`. | Correct windows, units, missingness and per-finding contributors. Build in a separate report version; keep publication off until verified. |
| **Prepare deletion invalidation** | `<timestamp>_staff_report_invalidation.sql`; account deletion function and cloud-wipe flow. | Withdrawal/deletion makes affected reports unavailable or recomputed. Safe rollback keeps publication paused rather than restoring unsafe exposure. |
| **Reproduce the full path locally** | Extend `tools/test-core.js`; add `tools/db/test_team_pipeline.py` and focused browser checks. | Synthetic accounts only. No real diary solicitation and no model calls. |

Essential tests: no consent, backup-only consent, 19/20 contributors, malformed values, historical import after consent, stale consent update, account switch, withdrawal during a run, deletion after publication, one-person numerator, edited records, concurrent writes and a cancelled run.

The historical synthetic test is a starting point, not a replacement for these cases.

### Phase 1: dependable daily reporting

1. **Run contract migration:** `<timestamp>_staff_run_contract.sql` adds unique due keys, report revisions, provenance, consent revisions and atomic publication.
2. **Private scheduling migration:** `<timestamp>_staff_schedule.sql` adds the internal worker and one daily job after the Phase 0 gates pass. Unscheduling and pausing are explicit rollback operations.
3. **Failure reconciliation:** compare application runs with cron execution receipts; preserve failed attempts, sanitize errors and alert on overdue output.
4. **Dashboard update:** `admin.js` shows freshness, expected next run, measured coverage, invalidation and failure separately.
5. **Sync acceptance:** integrate only the reviewed transaction-order cursor design, with migration-first deployment and real concurrent-transaction tests.
6. **Retention execution:** scheduled, bounded pruning for approved table classes, with deletion receipts and report invalidation tests.

Keep `model_on` and `autonomy_on` false. Daily metrics require neither.

### Phase 2: purposeful capture and constrained recommendations

1. Add `<timestamp>_usage_events.sql` and a small consented client event module with an allowlisted vocabulary, deduplication and short retention.
2. Add versioned aggregate exports and a data dictionary, behind a release gate.
3. Add `<timestamp>_proposal_plans.sql` for immutable proposal inputs and decision records.
4. Start with deterministic proposal selection. Add CP-SAT only when real choices exceed simple selection.
5. Consider Jev screening only after an explicit model-use decision, provider eligibility review, payload minimisation and tested persistent stop controls.
6. Evaluate permitted interventions against a predefined baseline before claiming benefit.

Each new stream should start disabled, with a deletion path and a clear owner.

### Jamie’s decisions and gates

- Approve the exact improvement purpose, history scope, notice and retention/deletion promises.
- Decide whether “Delete everything” remains explicitly device-only or gains a separate global-erasure action.
- Approve production migrations, frontend deployment and the daily schedule.
- Approve any real participant pilot. Each participant must independently consent; staff ownership is not consent.
- Obtain DPO/legal review before new research purposes, external exports or provider transfers.
- Approve any model activation, spending and provider use. Existing usage and workflow blocks remain in force.
- Approve the permitted proposal surfaces and any eventual outward-facing application.
- Resolve any applicable existing two-failed-review hold before that held work resumes.

## 5. LOAD-BEARING CLAIMS I COULD NOT VERIFY

- The exact current database function bodies, grants, adult-band policy and deployed frontend match this checkout.
- A real account can currently complete first backup, opt-in, measurement and dashboard rendering on the deployed app.
- The documented 19 October synthetic test can be reproduced against today’s installed definitions.
- Current cron execution history, database session timezone and social-sweep success.
- Complete deletion behaviour across live backups, moderation records, grants and external providers.
- Production activation of the transaction-order sync fixes referenced by the draft.
- Current provider processing locations, contractual eligibility and the legal classification of any future research study.

The mandatory triage attempt returned a local-state hold. I preserved it and did not retry, invoke additional reviewers, or restart the blocked Codex CLI workflow. The draft’s Jev scores and provider-status assertions were therefore not independently reproduced.

