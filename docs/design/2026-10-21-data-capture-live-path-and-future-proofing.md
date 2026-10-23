# Data capture: the live path today and how to future-proof it (21 October 2026)

Jamie: "make sure the data processing in the dashboard is live, run through it, and do a deep analysis with Codex on how to
capture the data effectively for future proofing, using the Ranklore adaptive decision engine and jev."

Method: the live database was read on 21 October (counts, runs, findings, policy, cron); the code was walked link by
link; jev (TypeSafe System One, model jev-1.13.0) gave typed judgments on the state; the Ranklore Quantum Optimization
Playbook (v1.0, 21 Oct) was read for the decision-engine part. The Codex deep analysis (gpt-6-astra, read-only, with
this note as a draft to check) ran after Jamie reset the account; its full text is in
`docs/design/reviews/2026-10-21-codex-data-capture-analysis.md` and is the authoritative deep version. Section 0 below
lists where it corrected this note; the rest of this note was revised to agree with it.

## 0. What the Codex pass corrected (verified where marked)

| Draft claim | Checked conclusion |
|---|---|
| "The plumbing exists end to end and is not broken" | Too strong. The parts exist, but the source has defects before real numbers can be trusted (below), and nobody has traversed the deployed path with a real account. |
| A daily pg_cron job can call `admin_run(28)` | **Wrong, verified**: `staff.caller()` requires an authenticated JWT (`20261019030000_team_dashboard.sql:186`); a cron call has none and would be denied while the SQL job reports success. A private worker entry point is needed. |
| `metric_version` exists at 1 and nothing bumps it | **Wrong, verified in the live catalog**: the installed `metrics_build` hardcodes `metric_version 2` while `agent_policy.metric_version` is 1. Two competing authorities. |
| The stale "is not built" sentence | **Verified**: the installed function no longer contains it; the 19 Oct findings carry the old wording until a new run. A run appends findings; the overview selects the latest successful run, so old rows stay in history. |
| `metrics_build` is the only diary reader | `staff.svc_counts()` also reads account ids from `public.entries` (without improvement consent) to count cloud copies. Not content, but a row read. |
| Free text is excluded | Excluded from the metric expressions, but the staging table copies the whole entry JSON, notes included. Minimise the projection. |
| The two accounts never backed up | Not established; only that no cloud copy exists now. |
| Real test diaries are the only way to see a number | No: a disposable synthetic cohort exercises the 20-person boundary without real health data (one such test was run and rolled back on 19 Oct). |
| jev judgments establish readiness | They are reported judgments, not verification; jev is a model call and must obey `model_on` and provider blocks if it ever runs server side. |
| The 20-person floor is anonymity | It is a minimum-contributor suppression rule, not k-anonymity or differential privacy; exact opt-in counts are still shown, percentages can have tiny numerators, overlapping releases can leak small changes. |
| "Aggregates need no deletion" | Unsupported: withdrawal and deletion do not invalidate stored findings today; retention is purpose based under PDPA, not satisfied by calling something an aggregate. |

Further defects Codex found in the metric contract: "last 28 days" spans 29 dates and has no upper bound; every finding is
labelled unit `accounts`; the SQL splits a period on any gap over one day while the phone joins across one missing day;
the median interval is over intervals, not people; missing minutes become zero; multiple sleep rows are called conflicts;
the live adult bands include `adult` but the migration does not seed it (reproducibility drift); the client sync gate
fails open when the consent module is absent; the feed can skip events past its page limit; `relay_calls_today` sums
rate buckets, not answered calls; the staff `model_on` switch does not govern the Luna and insight relays.

## 1. The live path, link by link

| Link | State today | Evidence |
|---|---|---|
| Phone diary (localStorage `ovumind_db_v1`) | live | `ovu-store.js` |
| Sync of entries to `public.entries` | built and live, but only for a signed-in account with cloud backup recorded on the account | `ovu-sync.js:181` (door opens on `cloud_sync` consent), `:294` |
| `public.entries` | **empty: 0 rows**; 2 auth users, 0 profiles, 0 consent events | database read 21 Oct |
| "Help improve logging" choice | built in the app (`improve_logging` purpose, `OvuAuth.setImprove` to `public.analysis_consent_set`) | `ovu-consent.js:38`, `ovu-auth.js:154`, `supabase/migrations/20261019030000_team_dashboard.sql:168` |
| `public.analysis_consent` | **empty: 0 rows** (nobody has turned the choice on) | database read |
| `staff.metrics_build` (the only diary reader) | built; reads only users in `analysis_consent` with an adult band and no withdrawal, from their accepted date | `supabase/migrations/20261019030000_team_dashboard.sql:278` and the `elig_users` insert |
| `admin_run` | built, deterministic, no model; one run so far (19 Oct, run_now, eligible 0) | `supabase/migrations/20261019030000_team_dashboard.sql:515`, `staff.agent_runs` |
| Scheduled runs | **missing**: `cron.job` holds only `rhythme-social-sweep`; nothing runs the agents daily | database read |
| `admin_overview` to the page | live; the dashboard shows the kept findings and the plaza counts | `admin.js` (PR #43 restyle pending) |
| Finding text | **stale, from the one run on 19 Oct**: those findings say the improve switch "is not built". That sentence was in the first version of `staff.metrics_build` (`supabase/migrations/20261019030000_team_dashboard.sql:307`); migration `20261019040000_team_dashboard_floor.sql` replaced the copy the same day, after that run. The next run, pressed or scheduled, rewrites the findings with the current wording; no migration is needed for this | database read, SQL |

Verdict: the plumbing exists end to end and is not broken, but no data flows through it. jev agrees: "working end to end
today" 0.10; the single biggest reason no number is measured is that no account has backed anything up (0.91), ahead
of consent (0.06) and scheduling (0.02); readiness to measure once 20 adults consent and back up scores 1.5 of 3
(between "key links missing" and "complete, needs data and a schedule", 0.47 / 0.52). The missing links are the
schedule, the stale server sentence, and the items in section 2.

What "live" would look like: an adult signs in, turns on cloud backup and "help improve logging", logs for a few days;
20 such adults; a daily run; the clouds on the dashboard report numbers with people counts. Today the count of such
adults is zero, and the two accounts that exist have never backed up a diary.

## 2. Gaps for future-proofing (ranked, reconciled with the Codex pass)

P0, before any real contribution is processed
- One authoritative, versioned consent contract on the server: record the consent event and its current-state
  projection atomically, validate notice and purpose against an immutable notice registry, keep the original accepted
  date on repeat grants, require the server's adult attestation, and make withdrawal and publication share a revision
  check. Keep backup, improvement, AI help, social and research as separate purposes.
- Define "from now" (observation date, first-collected date, or an approved history range), store observation date,
  client time and server receipt time separately, and minimise the staging projection to the fields each approved metric
  needs (no whole JSON, no notes). Move cloud-copy counts off `entries` onto backup receipts.
- Deletion and withdrawal must reach derived outputs: invalidate affected report releases and recompute from the
  remaining authorised data, suppressing newly small cells; inventory other retained identifiers (audit actors, email
  keyed grants, copied social report names). Keep "Delete everything" unmistakably device only, or add a separate
  global erasure.
- Treat 20 as a suppression policy, not anonymity: suppress every relevant response and export, bound contributions,
  add a release policy for overlapping windows, keep operational counts and health outputs apart.
- Fix the metric contract (28 completed dates with explicit bounds, Singapore reporting clock, real units, the phone's
  period-episode rule, person-level medians, missing is not zero, naps are not conflicts) in a new metrics version, and
  remove the competing `metric_version` authorities.

P1, dependable daily operation and provenance
- Version schemas, notices and computations separately (entry schema version, notice id and hash, a metric registry
  with definition, unit, denominator, people rule, window and computation version).
- Idempotent runs with a unique due key, atomic publication of a report revision, provenance on every finding (run,
  revision, metric version, window and zone, qualifying people, denominator, coverage, consent revision, suppression
  reason); recompute rather than replay, never keep health snapshots for reproducibility.
- Scheduling through a private worker entry point (never a manufactured staff JWT): one attempt per due key, no
  automatic retry, bounded, `clock_timestamp` durations, reconciled against `cron.job_run_details`, overdue alerts,
  explicit pause and unschedule.
- Sync ordering: only the reviewed transaction-order cursor (PR #16 family) with real two-session race tests; late,
  edited and deleted entries trigger a recompute of the affected windows.
- Dashboard statuses kept apart: API reachable, run due, run completed, output fresh, no authorised data, suppressed,
  failed. Drain feed pages before advancing the cursor. Sanitise error text.

P2, purposeful capture
- A small feature-event stream with an allowlisted vocabulary, its own opt-in purpose, deduplication, coarse dates and
  short retention; no open-ended properties bag; no condition-specific screen names under a "no health content" label.
- Research exports as releases (one tidy row per finding with release id, run, metric and version, window and zone,
  value, unit, people, denominator, coverage, state, suppression reason, purpose, notice versions) plus a data
  dictionary; suppressed stays null; improvement consent does not authorise a research purpose or person-level export.
- A DPO and lawyer list before any new purpose: notice accuracy, purpose classification, retention per data class,
  effects of withdrawal and deletion, transfers and processing locations, HBRA classification of any study.

What not to capture: local-only diaries, pre-consent history by default, free-text reflections, photos, location,
advertising identifiers, contact lists, device fingerprints, detailed interaction timelines, inferred diagnoses, and no
joining of social identities with health records just because a join is possible.

## 3. The adaptive decision engine, honestly

The Ranklore playbook's own first principle is classical first: OR-Tools CP-SAT for real constrained choices, evidence-
graded inputs, "recommended under current evidence" never "optimal", a pre-registered baseline and kill criterion, and
the quantum label dropped (no proven quantum advantage for practical sizes; npj Digit Med 2025;8:237 found none in
digital health). That is the right frame here.

Where each tool fits in this pipeline:
- jev (typed judgments, about 0.3 s): optional classification of proposal descriptions, evidence relevance and
  ambiguity, with the state as evidence and the question naming the condition, never the conclusion. Never for whether
  consent exists, whether a count is under the floor, whether a run happened, or what is legally permitted: those are
  deterministic code. jev is a model call, so server side it stays off while `model_on` is false and obeys provider
  blocks; the judgments in this note were made by hand from the dashboard side, as advice.
- An optimizer (CP-SAT): only once there is a real constrained choice, which today there is not. The first candidate is
  choosing which approved content levers to apply per cycle under a cap on live levers, a risk threshold and
  dependencies, with impact as evidence-graded ranges. Formulate per the playbook checklist (binary variables, two to
  three objectives, hard constraints only, a greedy baseline, a kill rule). Keep the house lessons: slack variables for
  capacity, no squared shortfall; AUGMECON for distinct trade-offs; solver OPTIMAL is model optimality, not lift;
  monitoring does not identify causal effect, so lever outcomes need a held-out comparison before any claim.
- Neither decides: anything clinical, prediction rules, reminders, care guidance, consent, and the floor. Those stay
  human-gated, as the orchestrator's policy already says (autonomy off, model off).

Concrete small layer, deterministic, on the existing tables: inputs = open `staff.agent_proposals` with evidence grade,
estimated impact range, effort, risk, dependencies; constraints = at most N live levers, at most one high-risk, only
approved content ids, only non-clinical surfaces; objective = evidence-weighted impact minus effort, ties to lower risk;
objective = a transparent lexicographic order first (approved operational defects, then stronger evidence and clearer
evaluation, then lower risk and effort, then a stable id), never a speculative impact probability; output = an immutable
recommendation with selected and rejected ids, reasons, constraints, versions, alternatives and a greedy baseline,
nothing applied without an owner. Bounded enumeration for a handful of proposals; CP-SAT only when dependencies and
competing constraints make it useful; an empty selection is valid.

## 4. Phased plan (Codex's, kept as proposed; nothing implemented or scheduled)

Phase 0, this week
1. Reconcile deployed state by catalog reads: function bodies, grants, triggers, the live `adult_bands`, migration
   history, deployed app version (started above: the installed `metrics_build` matches the floor migration, with
   `metric_version 2` hardcoded; live `adult_bands` includes `adult`).
2. Specify consent and deletion semantics in the two design documents: purpose and notice registry, "from now", local
   reset, cloud deletion, account deletion. Jamie approves the user-facing contract before production changes.
3. Prepare the consent and minimisation repair (a migration plus `ovu-consent.js`, `ovu-auth.js`, `ovu-sync.js`):
   atomic idempotent consent, account-switch checks, fail-closed client gate, no unconsented diary scan; additive and
   flagged.
4. Prepare corrected metrics as a new report version with a metric registry; publication stays off until verified.
5. Prepare deletion invalidation (migration plus the account function and cloud-wipe flow); rollback keeps publication
   paused rather than restoring unsafe exposure.
6. Reproduce the whole path locally with synthetic accounts only (extend `tools/test-core.js`, add
   `tools/db/test_team_pipeline.py`): no consent, backup only, 19 and 20 contributors, malformed values, history after
   consent, stale consent update, account switch, withdrawal during a run, deletion after publication, one-person
   numerator, edited records, concurrent writes, a cancelled run.

Phase 1, dependable daily reporting
7. Run contract migration (unique due keys, report revisions, provenance, consent revisions, atomic publication).
8. Private scheduling migration (internal worker, one daily job) after the phase 0 gates pass; pause and unschedule
   are explicit rollbacks. Until then, a staff press of Run now is the only refresh and it clears the 19 Oct wording.
9. Failure reconciliation against cron receipts, sanitised errors, overdue alerts.
10. Dashboard freshness, next run, measured coverage, invalidation and failure shown separately.
11. Only the reviewed transaction-order sync cursor, migration first, with real race tests.
12. Scheduled bounded retention with deletion receipts and invalidation tests. `model_on` and `autonomy_on` stay false.

Phase 2
13. Consented feature events with an allowlisted vocabulary and short retention; versioned aggregate exports behind a
    release gate; immutable proposal inputs and decision records; deterministic proposal selection first, CP-SAT only
    when real choices exceed simple selection; jev screening only after an explicit model-use decision; interventions
    evaluated against a predefined baseline before any claim of benefit.

Gates for Jamie: the improvement purpose, history scope, notice and retention and deletion promises; whether "Delete
everything" stays device only; every production migration, frontend deployment and the daily schedule; any real
participant pilot (each participant consents independently; staff ownership is not consent); DPO and legal review
before new research purposes, exports or provider transfers; any model activation or spend; the permitted proposal
surfaces; resolving any two-failed-review hold before that work resumes.

## 5. What could not be verified
- Codex itself could not verify: that the deployed frontend and every live function match this checkout (two of its
  claims were checked here against the catalog and held); that a real account completes first backup, opt-in,
  measurement and rendering on the deployed app; the current cron history and session time zone; complete deletion
  behaviour across backups, moderation records, grants and providers; the production state of the sync-order fixes.
- jev judgments are reported probabilities, not proof.
- Deletion behaviour of the staff tables on Delete everything was read from the schema, not exercised.
- Whether the social sweep cron runs successfully (its job exists; its run log was not read).
- jevauto was run as the triage asked; its four candidates (API-first, event microservices, browser storage, third-party
  analytics) describe greenfield architectures and were rejected as not applicable to the existing pipeline.

## 6. Phase 0 as built (21 Oct, branch claude/data-capture-phase0)
Migration `supabase/migrations/20261021100000_staff_data_contract_v3.sql`, test `tools/db/test_team_pipeline.py` (64 checks on a
throwaway postgres@17 with `tools/db/local_stub.sql`, which emulates Supabase's default grants so RLS is what the tests prove),
and small changes to admin.js, ovu-consent.js and ovu-sync.js. Reviewed by Codex gpt-6-astra in eight rounds so far (all FIX: 13, 10, 7, 5, 1, 1, 1 and 2 ranked items, every one verified against
the source before any change and fixed in the following commit; full texts under docs/design/reviews/). A
self-cancelling dry run of round one on the live project passed every probe and left nothing behind; the final text gets the
same dry run before the PR is opened. Nothing is applied to production and no schedule is installed.

Decisions taken in round two that the legal read should see:
- **"From now" is an observation-date boundary.** The notice promises no date, so this is a product decision: an entry
  counts only when it is dated on or after the day the choice was made and was recorded after it. A later import of older
  observations does not qualify unless the person chose all history.
- **One consent authority.** `analysis_consent_set` is the only writer of the improve-logging choice. The phone's consent
  mirror (`consent_record`) returns the server's own event for that purpose and writes nothing.
- **Adulthood is attested, not labelled.** A concrete age range attests on its own; the plain `adult` label the phone sends
  without a range counts only with the server's age_18 event. The attestation is persisted on the consent row.
- **Shares are held on either side.** A percentage is held back when the people in its numerator or in its complement
  number fewer than the floor, since either side would tell on them.
- **Holds reach a running report.** Invalidation takes the worker lock, so a withdrawal or deletion that lands during a
  report waits for it to publish and then holds it. The cost: a withdrawal RPC can wait for a running report (seconds).
- **The receipt seed reads user_id and timestamps only** (no content) to count cloud copies before the trigger existed.
- **Every result published under the previous contract is held by the upgrade** and recomputed by the next run.

Deferred to phase 1 (the schedule migration): a durable two-statement reservation for the scheduled attempt (today one
transaction reserves and executes, so a cancellation can roll back the due key; the unique index prevents duplicate retained
attempts); an automatic rollback script (the manual order is written in the migration).
