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

# Round three (after commit e7e620f, verdict FIX; all items fixed in the following commit)

**FIX.** Reviewed `e7e620f` against `01a10a1`. The main metric corrections are present, but consent handling and verification remain incomplete.

References: **M** = [migration](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/supabase/migrations/20261021100000_staff_data_contract_v3.sql); **T** = [database tests](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/tools/db/test_team_pipeline.py). P0 retains the earlier reviews’ meaning: fix before processing real contributions.

1. **P0: A stale automatic grant can still overwrite a first refusal.**  
   `ovu-auth.js:115,185`; **M:197–199**. Phone A reads no row and prepares an automatic grant. Phone B records its first refusal. A then submits without an expected revision, and the setter reactivates consent. The advisory lock serializes writes but does not protect this read-to-write gap.  
   **Smallest fix:** give automatic binding an explicit “expect no existing decision” precondition, checked under the account lock. On conflict, adopt the server decision. This is separate from the deferred age-receipt ordering.

2. **P1: Request idempotency remains incomplete.**  
   `ovu-auth.js:133–141`; **M:188–195,221–231**.
   - The actual client never sends `p_request_id`.
   - Replay validation compares only the action, accepting changed notice, hash, scope or age-band payloads.
   - A withdrawal while already withdrawn stores no request receipt. With no expected revision, `withdraw A → withdraw B while off → grant C → retry B` performs another withdrawal.

   **Smallest fix:** send a stable ID per logical request and persist its normalized payload and receipt, including accepted no-op requests. Reject mismatched reuse.

3. **P1: The mirror still reports an unconfirmed transition as recorded.**  
   `ovu-consent.js:179,207`. `drain()` marks improvement events sent merely because `setImprove` exists. My focused execution returned `recordedOnAccount=true` with **zero setter calls**. Awaiting the age receipt does not resolve this separate part of round-two finding 8.  
   **Smallest fix:** mark the mirror recorded only after a confirmed authoritative transition or matching account-state reconciliation.

4. **P1: Eligibility omits the configured notice-hash requirement.**  
   **M:239–240**. Exact notice-version equality fixes the legacy notice-9 case. However, once a current-version hash is registered, existing rows with missing or different hashes remain eligible. The seeded hashes are currently NULL, so this is a conditional contract gap, not evidence of a current mismatch.  
   **Smallest fix:** require the current registry row and `(registry.hash IS NULL OR consent.notice_hash = registry.hash)`.

5. **P1: Acceptance tests still miss concurrency and do not isolate the suppression fixes.**  
   **T:244–247,317–323**. The lock check uses a previously committed running row, not concurrent transactions. The new sleep assertions have only **18 contributors**, already below `k=20`; reverting either relevant suppression correction can still pass. The missing-tags result `tg` is never asserted.  
   **Smallest fix:** add two-session run-versus-withdrawal/deletion tests. Use isolated suppression fixtures with sufficient total contributors but exactly one positive or complement contributor, plus observed-zero cases. Verify those fixtures fail against the previous SQL.

6. **P1: Manual rollback still omits a reader.**  
   **M:498** lists only `admin_overview` and `admin_findings`. Restoring the old `admin_feed` definition would reopen held summaries.  
   **Smallest fix:** include `public.admin_feed(integer,bigint,bigint)` in the initial reader revocation. This preserves the accepted manual rollback approach.

7. **P2: Schedule detection still does not verify the intended job.**  
   **M:438** now checks `active`, but any active job with that name counts, regardless of its command or schedule.  
   **Smallest fix:** validate the intended command and schedule when the phase-1 job contract is defined. This does not justify enabling scheduling now.

Round-two disposition:

| Finding | Round-three result |
|---|---|
| 1. NULL adulthood bypass | Resolved in source. |
| 2. Small positive groups | Source corrected; effective regression coverage still missing. |
| 3. NULL complements | Source corrected with `IS NOT TRUE`; coverage still incomplete. |
| 4. Held feed exposure | Current RPC corrected; rollback omission remains. |
| 5. First refusal and serialization | Persisted row and lock added; stale automatic-grant gap remains. |
| 6. Unsupported legacy notice | Version issue resolved; configured-hash condition missing. |
| 7. Active scope narrowing | Resolved by rejecting narrowing until withdrawal. |
| 8. Sign-in ordering and false receipt | Ordering deliberately deferred; false receipt remains. |
| 9. Request idempotency | Partial; finding 2 above. |
| 10. Test coverage | Repeat-grant backdating, auth cascade and feed checks improved; finding 5 remains. |
| P2: Inactive schedule | Inactive check fixed; configuration check remains. |
| P2: Relay label | Resolved. |
| P2: Registry descriptions | Resolved. |

The metadata-only seed, observation-date boundary and scheduled reservation deferral remain accepted. I found no additional execution defect in the changed metric or feed SQL.

JavaScript syntax, Python parsing and **1,004 core checks passed**. Focused client probes reproduced the omissions above. I did not rerun the PostgreSQL suite or modify files; the reported 50 database passes remain independently unverified.

**FIX**

# Round four (after the merge with main, commit adaa8fc, verdict FIX; fixed in the following commit)

**Client-first deployment is unsafe. Migration-first is required, but `adaa8fc` still needs fixes before release.**

References: **M** = `supabase/migrations/20261021100000_staff_data_contract_v3.sql`; **T** = `tools/db/test_team_pipeline.py`.

1. **P1: The merge introduces a notice-version mismatch.**  
   `ovu-store.js:650` declares notice **5**, inherited by `ovu-auth.js:23` and sent at `ovu-auth.js:144`. **M:42–44** registers only **3 and 4**, so **M:218–219** rejects new grants even after migration. I confirmed the actual client emits `p_notice:5`.  
   **Smallest fix:** give the unchanged improvement wording its own registered notice version, used consistently by sending and first-binding logic. Alternatively, register version 5 with an explicit policy for existing v4 grants. Merely adding 5 changes `notice_current` and makes existing v4 grants ineligible. Add a client-to-migration contract test using the real store constant.

2. **P1: An open dashboard retains invalidated report summaries.**  
   `admin.js:335–345` only fetches newer feed IDs and prepends them. After withdrawal, the new invalidation event arrives, but previously loaded titles and `detail.summary` remain visible. The corrected server redaction at **M:505–508** never reaches those cached rows. I reproduced this with the real module: `held_runs=1`, `latest_run=null`, yet the old `eligible:21` summary remained.  
   **Smallest fix:** replace or redact cached feed rows when invalidation is observed, and reconcile through overview refreshes so missed invalidation events cannot preserve stale results. This is an integration gap with inherited main code.

3. **P1: Round-three acceptance coverage remains incomplete.**  
   **T:348–388** adds genuine withdrawal concurrency and useful isolated suppression fixtures, but still lacks concurrent deletion, an isolated NULL-source complement, and a one-person missing-duration case. **T:342–346** repeats one withdrawal ID after an active grant; it does not test the reported no-op sequence.  
   **Smallest fix:** add those cases, including `withdraw A → new withdrawal B while off → grant C → replay B`, and verify the relevant fixtures fail when their protections are removed.

4. **P2: Superseded improvement events remain permanently pending.**  
   `ovu-consent.js:186` skips an old unconfirmed grant after reconciliation adopts a withdrawal, while `receipt()` at line 160 still counts it. The UI at line 354 indefinitely reports a change awaiting delivery. Reproduced: latest withdrawal recorded, but `pending=1` and `recorded=false` after repeated flushes.  
   **Smallest fix:** mark superseded mirrors with a distinct terminal status and exclude them from pending counts without claiming they were sent.

5. **P2: Agent summaries still confuse no data with suppression.**  
   `admin.js:182`, also line 91, says every result was held under the floor whenever no numeric result exists. Version 3 explicitly produces `no_data`, `suppressed:false`, `value:null` at **M:389–390**.  
   **Smallest fix:** distinguish absent data from suppressed findings in both summaries.

The seven round-three findings reconcile as follows:

| Round-three finding | Round-four disposition |
|---|---|
| 1. Stale automatic grant | **Resolved in source:** account-locked `p_expect_none` check and conflict reconciliation. |
| 2. Request idempotency | **Resolved in source:** client IDs, payload validation, and receipts for accepted no-ops. Replay returns current state without another write. Exact no-op regression test remains missing. |
| 3. Unconfirmed mirror marked recorded | **Resolved:** matching synchronized account state is required. Superseded-event status issue remains above. |
| 4. Configured notice hash | **Resolved:** eligibility checks the registered hash when configured. |
| 5. Acceptance tests | **Partially resolved**, detailed above; not an owner-declared deferral. |
| 6. Rollback reader omission | **Resolved:** **M:514** includes `admin_feed(integer,bigint,bigint)`. |
| 7. Schedule verification | **P2 remains phase-1 work:** **M:454** checks active status and a command substring, not exact command/cadence. Complete before enabling scheduling. |

The owner’s first-sign-in ordering, metadata-only receipt seed, scheduled reservation, manual rollback, and observation-date decisions remain accepted as stated.

**Required ship order:** fix the notice contract and remaining blockers, apply `20261021100000_staff_data_contract_v3.sql`, refresh/verify PostgREST’s schema cache and eight-argument RPC, verify old and new payload compatibility, then merge/deploy the Pages client.

Before migration, even withdrawals send `p_request_id` at `ovu-auth.js:140–141`. The supplied six-argument RPC cannot match that payload; the client restores its previous local state after failure. PostgREST maps JSON keys to function arguments and requires schema-cache refresh after signature changes. [PostgREST RPC documentation](https://docs.postgrest.org/en/stable/references/api/functions.html)

Independently verified: **1,809 core checks passed**, **81 pages with zero static-check problems**, and scoped diff checks passed. Static checking used stdin instead of temporary files to respect read-only access. The reported **59 PostgreSQL passes were not rerun**. No files or live state changed.

FIX

# Round five (commit d48ca43, verdict FIX, one P1; fixed in the following commit)

**One P1 remains at `d48ca43`.**

**P1: Invalidated summaries can survive feed reconciliation.** [admin.js:336](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/admin.js:336) advances `releaseKey` before the full feed refresh succeeds, while line 348 swallows refresh failures.

Independently reproduced with the actual loading functions:

- A failed full refresh leaves `eligible:21` cached. Subsequent identical overviews never retry reconciliation.
- An older incremental response arriving after successful redaction restores the invalidated summary.

**Smallest fix:** immediately clear/redact cached feed content when the release key changes, reject responses from earlier request generations, and keep full reconciliation pending until replacement succeeds.

| Round-four finding | Round-five disposition |
|---|---|
| 1. Notice-version mismatch | Resolved: v4 and v5 explicitly accepted; v3 retired; hash checks retained. |
| 2. Cached invalidated summaries | Partially resolved. P1 above remains. |
| 3. Acceptance coverage | Resolved in test source: concurrent deletion, NULL-source complement, one-person missing duration, and exact no-op withdrawal replay added. |
| 4. Permanently pending superseded mirrors | Resolved: distinct terminal status excluded from pending and delivery. |
| 5. No-data versus suppression wording | Resolved in both summaries. |

No additional P0/P1/P2 findings in the changed-code sweep. All stated owner deferrals remain accepted, as does migration first, schema-cache refresh and eight-argument RPC verification, then client merge.

Independently verified **1,810 core checks**, **81 pages with zero static problems**, Python parsing and scoped code-diff checks. PostgreSQL **64/64** and the three mutation catches remain owner-reported, not rerun. No files or live state changed.

FIX

# Round six (commit 20e4329, verdict FIX, one P1; fixed in the following commit)

**P1 remains: first-load reconciliation skips invalidation.** At [admin.js:337](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/admin.js:337), `releaseKey !== null` excludes the first overview, while `boot()` starts overview and feed concurrently.

Reproduced with the real loading functions:

1. First overview reports `latest_run:null, held_runs:1`.
2. A delayed pre-hold feed response restores `eligible:21`.
3. Identical overviews and subsequent incremental polls retain those words, with `feedNeedsFull=false`.

Reconcile the initial release key against in-flight feed requests and add this first-load ordering case.

The reported failure/retry sequence is fixed. Independently verified **1,812/1,812 core checks**, the supplied regression and its guard-removal mutation, syntax and diff checks. No other changed-line findings. PostgreSQL tests were not rerun; no files changed. Migration-first ordering remains required.

FIX

Fix: the first overview always owes one full feed reload, so a feed request sent at boot before a hold is answered can never outlive it (admin.js loadOverview; test-core dashboardFeedFirstLoad). The round-five hold test was adjusted because the first overview now issues that reload itself, and async harnesses now register so a stalled one fails the run instead of silently dropping its checks.


# Round seven (commit 07e3680, verdict FIX, one P1; fixed in the following commit)

**P1 remains: first overview does not clear an already-populated feed.** At [admin.js:337](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/admin.js:337), the `releaseKey === null` branch sets `feedNeedsFull` but leaves `feed`, `feedTop` and displayed content intact.

Reproduced with the real loading functions:

1. Boot feed returns pre-hold `eligible:21` before the first overview.
2. First overview reports `latest_run:null, held_runs:1`.
3. Its full reload fails with HTTP 500.
4. Cached rows and panel HTML retain `eligible:21`, including after an identical overview and failed retry.

Clear the cached feed and cursor, and redraw the Feed tab on initial reconciliation too. Add this response-order/failure regression.

The slower boot-answer case is resolved. No other changed-line findings. Independently verified **1,813/1,813 core checks**, **81 pages with zero static problems**, and both stalled-harness and removed-generation-guard mutations fail correctly. PostgreSQL tests were not rerun. No files changed; migration-first ordering remains required.

FIX

Fix: the first overview now counts as a change, so it drops the cached feed and cursor and redraws the Feed tab before the owed full reload (admin.js loadOverview; test-core dashboardFeedFirstLoadFails, which fails on 07e3680).


# Round eight (commit 4301955, verdict FIX, two P1; fixed in the following commit)

**Round-seven P1 is resolved at `4301955`. Two P1s remain.**

1. **P1: Incremental invalidation leaves held Feed content visible.** [admin.js:346](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/admin.js:346) prepends `kind:"invalidated"` without clearing cached summaries. Reproduced: published feed → invalidation event → overview HTTP 500 → empty incremental poll. Both the hold announcement and old `eligible:21` title/detail remain rendered, with `needsFull:false`. Repeated overview failures preserve them indefinitely.

   **Fix:** treat incremental invalidation as an immediate clearing and full-reconciliation trigger, retaining generation protection and reload debt.

2. **P1: An older overview restores held summaries on Today/Agents.** [admin.js:337](/Users/michiyomimi/Doubao/chats/2026-10-16/new-chat-12/ovumind/.claude/worktrees/farm-barn-cave/admin.js:337) has no response-generation guard. Reproduced on both tabs: overview A starts before withdrawal; newer B returns held and removes summaries; delayed A then restores `21 eligible` and rolls `releaseKey` backward. Subsequent overview failure leaves those words visible. This affects overview content, not Feed resurrection.

   **Fix:** reject obsolete overview responses before updating state or rendering; add this overlap regression.

Swept boot, Run now, polling, visibility return, tab rendering, denial, failed/empty reloads, and delayed feed responses. No additional feed-specific findings.

Verified **1814/1814 core checks**, **81 pages with zero static problems**, and the supplied regression passing HEAD and failing `07e3680`. A separate rendered-panel probe confirms the round-seven fix. PostgreSQL **64/64** remains owner-reported, not rerun. No files changed.

Ship order remains migration first, schema-cache refresh, eight-argument RPC verification, then client merge.

FIX

Fix: a feed poll that brings an invalidated event drops the cached feed and cursor, asks for a new overview and a full reload, and keeps the reload owed if either fails; only the newest overview request may write (ovGen), so an older answer cannot roll the release key or held summaries back (test-core dashboardHoldPaths; each guard mutated alone fails its check).
