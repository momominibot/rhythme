# Data capture: the live path today and how to future-proof it (21 October 2026)

Jamie: "make sure the data processing in the dashboard is live, run through it, and do a deep analysis with Codex on how to
capture the data effectively for future proofing, using the Ranklore adaptive decision engine and jev."

Method: the live database was read on 21 October (counts, runs, findings, policy, cron); the code was walked link by
link; jev (TypeSafe System One, model jev-1.13.0) gave typed judgments on the state; the Ranklore Quantum Optimization
Playbook (v1.0, 21 Oct) was read for the decision-engine part. The Codex deep analysis could not run: the Codex account
hit its usage limit (resets 27 October 14:41 SGT). The block is recorded at `~/.local/share/codex-block/BLOCKED.json`
and nothing was retried or switched to another account. This note is therefore a single-reviewer analysis plus jev;
the Codex pass should be added when the limit resets, or by another provider only on Jamie's word.

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

## 2. Gaps for future-proofing (ranked)

P0, before real data arrives
- No scheduled run. Add a pg_cron job calling `public.admin_run(28)` once a day (Singapore night), with the existing
  provider-block rule (a failure records a block and nothing retries). jev: safe before any consent exists, 0.75, since
  the run reads no diary row when `analysis_consent` is empty and only records readiness.
- The stale "is not built" findings from 19 Oct: one new run replaces them (the server copy was already corrected by
  migration `20261019040000`). Pressing Run now on the dashboard does it; the scheduled run would do it every day.
- Deletion propagation: define what happens to `staff.agent_findings` and run summaries when an account uses Delete
  everything or withdraws the choice. Aggregates across at least 20 people need no deletion, but any per-run temp data,
  audit rows naming a user id, and `analysis_consent` rows need a stated retention. Write the rule down and test it.

P1, before the first measured run
- Versioning: `metric_version` exists (1) but nothing bumps it; add a rule: any change to how a metric is computed bumps
  the version, and findings carry it, so time series are never silently mixed. Same for the notice version each consent
  row was given under (`p_notice` already exists in `analysis_consent_set`).
- Idempotent, replayable runs: a run should be reproducible from (window, consent set as of, metric_version); store
  the consent snapshot size and the entry high-water mark (`synced_at`) in the run summary so a rerun can be compared.
- Late and edited entries: the sync cursor work (PRs #16, #22) means entries can arrive after a run; findings should
  state the `synced_at` watermark they saw, and the daily run should recompute the trailing window rather than append.
- Date keys and time zones: entries carry a `date` column; the run uses `current_date` on the server (UTC). Use the
  Singapore date for windows, or state the zone in every finding.
- Observability: a run row already has started, finished, error and summary; add duration and a diff against the
  previous run (which metrics changed by more than the floor allows to show), surfaced on Today.

P2, as the product grows
- An event vocabulary for app usage (feature opened, practice started, farm visited) with no health content, consented
  under its own purpose, so product decisions do not lean on diary streams. Design doc section 4 already planned this.
- Research export: tidy tables per finding (agent, metric, window, value, people, metric_version, notice_version,
  run id), never row level; with a documented k floor of 20 and small-cell suppression as now.
- Boundaries to confirm with a lawyer, not here: PDPA purposes for the improvement choice, and whether any planned use
  becomes identifiable health research under HBRA (the 20 Oct data-strategy note for GoutBye covers the same ground).

What not to capture: free-text notes and reflections (already excluded by the agents), exact per-person values, anything
from local-only diaries, anything before the account's accepted date unless she chose all history.

## 3. The adaptive decision engine, honestly

The Ranklore playbook's own first principle is classical first: OR-Tools CP-SAT for real constrained choices, evidence-
graded inputs, "recommended under current evidence" never "optimal", a pre-registered baseline and kill criterion, and
the quantum label dropped (no proven quantum advantage for practical sizes; npj Digit Med 2025;8:237 found none in
digital health). That is the right frame here.

Where each tool fits in this pipeline:
- jev (typed judgments, about 0.3 s): gating questions on each proposal and on run health, with the state as evidence
  and the question naming the condition, never the conclusion. Examples: "does this proposal read a diary row", "is this
  finding below the floor", "did the run see fewer entries than the previous one". Used today in this note.
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
output = one ranked plan plus two named alternatives written to the proposal rationale, nothing applied without an
owner. jev screens each proposal first; CP-SAT ranks the survivors once there are more candidates than slots.

## 4. Phased plan

Phase 0, this week (reversible, no diary read before consent)
1. Migration: the daily pg_cron run of `admin_run(28)`. Needs Jamie's word (production migration). Until then,
   pressing Run now on the dashboard refreshes the findings and clears the stale 19 Oct sentence.
2. Dashboard: Today shows "last scheduled run" and the next due time; the clouds already read the kept findings (PR #43).
3. Jamie and one other adult account: sign in, turn on cloud backup and the improve choice, log for a week. This is the
   only way to see a real number before launch, and it is still under the floor (held back) until 20 adults.
4. A written retention and deletion rule for staff tables, with a test.

Phase 1, before the first measured run (20 consenting adults)
5. Versioning rule and run watermarks (metric_version bump policy, notice version on findings, synced_at high-water).
6. Singapore-date windows and a run diff on Today.
7. jev screening of proposals wired into the orchestrator step (deterministic function, typed questions, logged).

Phase 2
8. App usage events under their own consent purpose; research export; the CP-SAT lever ranker only when proposals
   exceed slots, with the baseline and kill criterion pre-registered.

Gates for Jamie: the cron migration in phase 0; whether the two staff accounts become the first test diaries; the
retention rule wording; any second-provider review while Codex is blocked.

## 5. What could not be verified
- No Codex pass (usage limit). jev judgments are probabilities, not proof.
- Deletion behaviour of the staff tables on Delete everything was read from the schema, not exercised.
- Whether the social sweep cron runs successfully (its job exists; its run log was not read).
- jevauto was run as the triage asked; its four candidates (API-first, event microservices, browser storage, third-party
  analytics) describe greenfield architectures and were rejected as not applicable to the existing pipeline.
