# Codex gpt-6-astra review of phase 0, round one (21 Oct 2026, read-only, verdict FIX)

**FIX.** Several original P0 requirements remain unresolved. Here, P0 means “before processing real contributions,” matching the supplied review.

Reviewed commit `2330ce6b`. PostgreSQL could not run because the sandbox denied port binding. JavaScript syntax, Python parsing, and focused checks against the actual JavaScript passed or reproduced the issues noted below. I did not access production or modify files.

References: **M** = `supabase/migrations/20261021100000_staff_data_contract_v3.sql`; **D** = `supabase/migrations/20261019030000_team_dashboard.sql`; **T** = `tools/db/test_team_pipeline.py`.

1. **P0: Withdrawal/deletion can miss a running report.**  
   `M:111`, `M:223`, `M:319`. A run stages eligible users and entries. A concurrent withdrawal invalidates only visible, successful runs, missing the uncommitted running report. That report can subsequently publish the withdrawn contribution. The run lock does not coordinate with consent or deletion. This follows PostgreSQL’s committed-row visibility rules. [PostgreSQL transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)  
   **Smallest fix:** coordinate eligibility reads, publication and invalidation through a shared synchronization/revision contract with consistent lock ordering. Add two-session withdrawal and deletion races.

2. **P0: Invalidated findings remain available through another RPC.**  
   `D:401–408`, `M:363`. `admin_findings()` still returns historical findings without checking their run’s invalidation status. Hiding `admin_overview.latest` therefore does not withdraw access. Invalidated run summaries also remain in overview/history responses.  
   **Smallest fix:** enforce the same valid-release predicate across every findings reader; retain operational audit metadata while withholding invalidated derived values.

3. **P0: Consent still has two independently writable authorities.**  
   `M:179–184`; `20261019060000_consent_events_v2.sql:17–33`; `ovu-auth.js:153`. The existing authenticated `consent_record()` still accepts `improve_logging` grants and withdrawals without updating `analysis_consent` or invalidating reports. The app continues sending separate events through that endpoint. Also, the new setter has no request deduplication, and withdrawal when no projection row exists records nothing.  
   **Smallest fix:** route this purpose through one atomic, idempotent transition, including first-row withdrawals. Update the client mirror from that server receipt instead of independently submitting another event.

4. **P0: The notice/adulthood contract does not match the approved P0 requirements or current app.**  
   `M:34`, `M:168–188`, `M:223–224`.
   
   - The registry seeds notice **3**, while `ovu-store.js:516` declares notice **4**, inherited by the auth/consent modules.
   - The setter accepts unregistered future versions, never validates the hash, and accepts an age-band string without the canonical `age_18` event.
   - Cohort selection does not revalidate notice or adult-attestation state.
   - `adult_attested_by` is returned but never persisted.

   **Smallest fix:** register the actual approved notice/hash, validate supported versions explicitly, persist canonical adult-attestation provenance, and reuse that eligibility predicate during analysis.

   There is also reproducibility drift: `ovu-auth.js:140` sends `'adult'` when the optional age range is absent, but the migration chain’s `adult_bands` excludes it. Such users can successfully opt in yet remain ineligible. The document reports a manual live-policy correction; this migration does not reproduce it. Await attestation persistence during first sign-in and test the ordinary `'adult'` payload.

5. **P0: “From now” still includes historical imports.**  
   `M:255`; `ovu-store.js:141`; `T:158`. Eligibility still uses client-controlled `created_at`. Importing old observations after consent stamps new creation times, so those observations qualify without `scope='all'`. The test cohort explicitly exercises this behaviour as success.  
   **Smallest fix:** settle the promised boundary, then enforce it. An observation-based promise needs an observation-date boundary; a collection-based promise needs immutable server receipt provenance. Add a historical-import rejection case.

6. **P0: The migration itself scans unconsented diary rows.**  
   `M:90–92` backfills receipts with an unrestricted `SELECT … FROM public.entries`. Moving subsequent counts to receipts does not satisfy “no diary row read before consent” during migration.  
   **Smallest fix:** remove that backfill. Use approved existing operational evidence, or mark historical backup status unavailable until a receipt exists.

7. **P0: Percentage suppression still permits one-person numerator disclosures.**  
   `M:277`, `M:280`, `M:284`, `M:291`. Twenty people with one sleep record each, only one imported, produce an unsuppressed **5%**. Tagged meals and completion percentages have the same issue. The supposed numerator test at `T:236–239` tests a one-person whole metric instead.  
   **Smallest fix:** calculate numerator and complement contributor counts and suppress small positive subgroups, including related outputs that permit subtraction. Test both numerator and complement cases.

8. **P1: The projection reads unnecessary history for every stream.**  
   `M:255`. `least(win_start, date '1970-01-01')` effectively selects history since 1970 for food, sleep, mindfulness, reflections and weight, although their calculations use only the reporting window.  
   **Smallest fix:** restrict non-period inputs to `date >= win_start`; retain only separately authorised period history.

9. **P1: Valid short practices are classified as missing.**  
   `M:282–283`. Actual Light Flower and Morning start functions return `minutes: 0.5` for saved 30-second practices. I reproduced those payloads. SQL excludes them from minutes and counts them as missing.  
   **Smallest fix:** support the valid durations produced by the app, preferably through an explicit seconds-based contract. Distinguish invalid durations from absent durations.

10. **P1: Known zero and absent data remain conflated.**  
    `M:276`, `M:283`, `M:291–294`. Twenty people with valid practice durations and no missing durations yield `practices_missing_duration = NULL/no_data`. Twenty people with one sleep record each similarly yield `nights_with_several_records = NULL/no_data`. Both are observed zeros with available denominators.  
    **Smallest fix:** track denominator coverage separately from positive contributors, then distinguish zero, unavailable and suppressed positive cells.

11. **P1: Cancellation loses the scheduled-attempt receipt and due key.**  
    `M:321`, `M:345–347`. Reservation and execution occur in one transaction. Cancellation, timeout or connection loss can roll back both, permitting another attempt for the same day. `WHEN OTHERS` does not catch `QUERY_CANCELED`. [PostgreSQL exception handling](https://www.postgresql.org/docs/17/plpgsql-control-structures.html)  
    **Smallest fix:** durably commit the attempt reservation before bounded execution, then reconcile terminal state. The present unique index prevents duplicate retained attempts, not all repeated execution.

12. **P1: Upgrade and rollback do not preserve the publication boundary.**  
    `M:97`, `M:356`, `M:4–5`. Existing successful v2 runs receive `invalidated_at = NULL` and remain publishable while the overview advertises metric version 3. No safe rollback is supplied; restoring the old overview would ignore invalidation and reopen held findings.  
    **Smallest fix:** hold incompatible releases during upgrade and provide a rollback that pauses metric readers while preserving invalidation. Test with existing v2 findings and withdrawn contributions.

13. **P1: The test suite does not verify several claimed acceptance paths.**  
    `T:90–93` writes every entry as the server, not the authenticated account. `T:231–234` checks a previously committed running row sequentially, not concurrent lock contention. The initial no-consent case has no backup-only diary to prove exclusion.  
    **Smallest fix:** add authenticated allowed/denied writes under production-equivalent grants, actual two-session races, cancellation, historical RPC readback, real account cascade deletion, stale consent requests, heterogeneous person-level medians, and upgrade/rollback fixtures. Check exact function privileges rather than accepting any exception as proof of an execute denial.

The remaining smaller corrections are:

| Rank | Location | Finding and smallest fix |
|---|---|---|
| P2 | `admin.js:160`; `M:293–294` | Every `no_data` result also has `suppressed:true`, so the new “no data” branch is unreachable. I reproduced “held back / under 20 people.” Define state precedence consistently. |
| P2 | `M:251–252` | `completed:null` or `"unknown"` enters the completion denominator. Require a JSON boolean; track unknown coverage separately. |
| P2 | `M:369` | Historical scheduled execution does not prove an active schedule. Read the designated current job/configuration through a private helper. |
| P2 | `M:340–347` | A supplied historical due date labels a run whose metrics still use today. Reject noncurrent dates until an explicit backfill contract exists. |
| P2 | `M:197`; `ovu-sync.js:389–390` | Receipts survive cloud-copy deletion, so this counts accounts that **ever** backed up, not accounts currently holding a cloud copy. Rename the metric or maintain current state. |
| P2 | `M:201`; `admin.js:95` | `sum(count)` measures bucket increments, not “buckets touched.” Change the label or use the intended bucket count. |
| P2 | `M:296` | History-based cycle metrics receive the same 28-day bounds as windowed metrics. Store metric-specific bounds. |

The prior phase-0 fail-closed client requirement is also still outstanding: `ovu-sync.js:181` permits the gate when `OvuConsent` is absent. Require the module and its affirmative checks.

Several parts are correct in the checked source: completed Singapore date bounds, units, two-day period joining, person-level medians, and excluding whole JSON from staging. The new constraints retain existing allowed values, and current three-argument `run_begin` callers resolve through the default fourth argument.

I found no direct API-role bypass of `run_scheduled`’s revocations. It runs with the migration runner’s privileges; the invoker-security `run_core` does not downgrade those privileges merely because its owner is `rhythme_staff_fn`. Existing replaced admin functions retain their owners and grants. [PostgreSQL function ownership](https://www.postgresql.org/docs/17/sql-createfunction.html) Actual catalog assertions remain necessary before deployment.

For heavy sync, the receipt trigger adds one receipt update per entry and needs bulk-load testing. I am **not** claiming a demonstrated deadlock or measured performance regression.

**FIX**

# Round two (after commit 01a10a1, verdict FIX)

**FIX.** The main corrections are present, but consent and suppression gaps remain. P0 below retains round one’s meaning: **fix before processing real contributions**.

Reviewed the current working tree on `claude/data-capture-phase0` against `2330ce6`. JavaScript syntax, Python parsing and `git diff --check` passed. A focused test using the actual JavaScript modules reproduced the sign-in race below. PostgreSQL access was denied by the sandbox, so I could not independently reproduce the reported 42 passes. No files or production state were changed.

References:

- **M**: `supabase/migrations/20261021100000_staff_data_contract_v3.sql`
- **D**: `supabase/migrations/20261019030000_team_dashboard.sql`
- **T**: `tools/db/test_team_pipeline.py`

1. **P0: An omitted age band bypasses the adulthood check.**  
   **M:199–202, M:280.** With no `age_18` grant and `p_age_band=NULL`, `band_ok` becomes NULL. The rejection condition also becomes NULL, so execution continues and writes `adult_attested_by='age band'`. That account then qualifies for analysis. This follows PostgreSQL’s [NULL logic](https://www.postgresql.org/docs/17/functions-logical.html) and [IF semantics](https://www.postgresql.org/docs/17/plpgsql-control-structures.html#PLPGSQL-CONDITIONALS).  
   **Smallest fix:** reject unless `(adult_event OR band_ok) IS TRUE`. Test omitted, NULL and empty bands separately.

2. **P0: The observed-zero fix exposes small positive groups.**  
   **M:335, M:342, M:348.** Twenty sleepers with only one person having multiple records now publish `nights_with_several_records=1`. Twenty practitioners with only one missing duration similarly publish `practices_missing_duration=1`. Both metrics use all participants as `people` and supply no positive-contributor count.  
   **Smallest fix:** retain denominator coverage for observed zero, but separately suppress positive cells contributed by fewer than `k` people. Update the registry’s contributor definitions accordingly.

3. **P0: NULL classifications escape percentage-complement suppression.**  
   **M:309, M:324, M:336, M:339.** `source=NULL` produces `imported=NULL`; missing `tags` produces `has_tags=NULL`. Those records enter the denominator, but neither numerator nor complement contributor counts. Twenty imported/tagged accounts plus one NULL-classified account therefore publish **95.2%**, with complement count zero.  
   **Smallest fix:** use `IS NOT TRUE` for the complement wherever NULL remains in the denominator, or normalize classifications explicitly. Test NULL sources and missing tags.

4. **P0: Invalidated summaries remain readable through `admin_feed`.**  
   **D:391–398; M:293, M:376–379.** The findings RPC and overview are fixed, but the feed still returns events from invalidated runs. These contain `detail.summary` and exact eligible counts in their titles.  
   **Smallest fix:** apply the release predicate to feed output too, redacting derived titles/details while retaining operational metadata. Include this reader in the manual rollback hold.

5. **P0: A first refusal is logged but still looks like “never decided” to the client.**  
   **M:213–215; `ovu-auth.js:115`, `ovu-auth.js:123–127`.** A first refusal creates no `analysis_consent` row. Another phone holding an unbound, current-notice opt-in reads `server=null`, and `improvePlan()` automatically pushes a grant. I reproduced that client decision. Also, `SELECT FOR UPDATE` cannot serialize first transitions when no row exists.  
   **Smallest fix:** persist a first-refusal state/revision that reconciliation reads, and serialize initial transitions per account before inspecting state.

6. **P0: Previously accepted, unregistered notice versions remain eligible.**  
   **M:177–180, M:253, M:280.** The old setter accepted arbitrary positive versions. An existing notice-9 row with an adult band gains attestation provenance during migration, then passes `notice_version >= 4`, despite notice 9 being unregistered. Testing rejection of a *new* notice-9 request does not cover this.  
   **Smallest fix:** reuse one eligibility predicate requiring the registered current notice and its hash when configured. Seed legacy unsupported-version rows before migration in the upgrade test.

7. **P0: Narrowing history permission leaves earlier releases published.**  
   **M:204–206.** An active `all → from_now` change alters subsequent reads but never invalidates reports computed using the removed history. It also retains the original acceptance date as the boundary.  
   **Smallest fix:** reject active scope changes and require withdrawal followed by a new grant, or implement an explicit scope-change boundary with invalidation.

8. **P1: The ordinary first-sign-in race remains, and the new mirror can claim success after failure.**  
   **`ovu-auth.js:292–296`, `ovu-auth.js:185–187`; `ovu-consent.js:179`, `ovu-consent.js:268–269`.** `bindAccount()` is not awaited before `syncImprove()`. With delayed consent receipts and no optional age range, the improvement request reaches the server before `age_18`, is rejected, and turns the local choice off. Later, the new drain branch marks the improvement event sent without a successful setter receipt. My test ended with `analysis.on=false` but `recordedOnAccount('improve_logging')=true`.  
   **Smallest fix:** await successful age-receipt persistence before granting improvement consent, including the signed-in notice-sheet path. Mark the mirror recorded only from a confirmed account transition.

9. **P1: The authoritative setter is still not request-idempotent.**  
   **M:182, M:206–207, M:215; T:158.** There is no request identifier. Repeated grants append events and advance the revision; repeated first refusals append events too. The test explicitly expects two grant events. Removing the second writer does not resolve this part of round-one finding 3.  
   **Smallest fix:** accept a stable client request ID and return the original receipt for an exact replay, rejecting mismatched payload reuse.

10. **P1: The test suite still misses required paths and masks one regression.**  
    **T:89, T:153–158, T:217–219, T:228–237.** The helper overwrites `accepted_at` after every grant, so the repeat-grant preservation test would pass even if the setter reset it incorrectly. The lock test remains sequential; account deletion deletes the consent row rather than exercising the auth cascade. There are no direct held-feed/readback checks.  
    **Smallest fix:** disable fixture backdating for the repeat-grant assertion; add actual two-session withdrawal/deletion races, auth-account cascade deletion, held-reader checks and the counterexamples above. Keep cancellation testing with the explicitly deferred reservation work.

The remaining P2 corrections are:

| Location | Finding and smallest fix |
|---|---|
| **M:418; `admin.js:83`** | A named but inactive cron job still displays “Scheduled.” Check `active` and the intended job configuration. [pg_cron explicitly supports deactivation](https://github.com/citusdata/pg_cron#altering-a-job). |
| **M:255; `admin.js:95`** | “One per call” is incorrect. Luna increments both an IP bucket and a global bucket (`supabase/functions/luna/index.ts:151–153`); insight does likewise (`supabase/functions/insight/index.ts:83–85`). Rename this to counter increments, or count only the designated global buckets and label them as counted attempts. |
| **M:61, M:67, M:74** | Registry descriptions no longer match eligibility and participant counting. Align them with the final attestation and denominator/contributor rules. |

The disposition of every round-one ranked item is:

| Round one | Round-two disposition |
|---|---|
| **1. Running-report invalidation race** | Source fix addresses the identified race under READ COMMITTED. Two-session verification remains missing. |
| **2. Invalidated readers** | Partial. Findings and overview fixed; feed remains open, finding 4 above. |
| **3. Two consent authorities** | Second writer removed. First-refusal state, receipt handling and idempotency remain unresolved. |
| **4. Notice/adulthood contract** | Partial. Version 4 and persisted provenance added; NULL bypass, legacy eligibility and sign-in ordering remain. Registered hash remains pending the legal read. |
| **5. Historical imports** | Resolved under the explicitly chosen observation-date boundary. |
| **6. Receipt backfill** | Accepted as the documented metadata-only exception, subject to the owner’s legal read. |
| **7. Percentage suppression** | Partial. Ordinary boolean cases improved; NULL complements remain unsafe. |
| **8. Unnecessary history reads** | Resolved for non-period streams. |
| **9. Short practices** | Resolved: 0.5 minutes is accepted. |
| **10. Zero versus missing** | Zero representation improved, but small positive cells now leak, finding 2. |
| **11. Durable scheduled reservation** | Accepted phase-1 deferral while scheduling remains disabled. |
| **12. Upgrade/rollback** | Upgrade hold implemented. Manual rollback approach accepted, but its reader hold must include the feed. |
| **13. Acceptance coverage** | Partial. Authenticated writes and execute-privilege assertions added; remaining gaps described above. |

Of the original P2s, `no_data` display, boolean-only completion, historical due-date rejection, last-entry receipt cleanup and history-specific bounds are corrected in source. Schedule detection and relay labeling remain incomplete. The missing-consent-module sync gate now fails closed.

I accept the four declared decisions for this unscheduled phase, with the rollback-reader qualification above. They do not account for the remaining findings.

**FIX**