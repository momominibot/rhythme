# Data capture, the admin dashboard and the agent team (19 October 2026)

Jamie: "figure out the best way to capture data; a dashboard to see all the data; admin accounts I control; one agent in charge of menstrual, one of sleep, one of food, one of mindfulness and stress, one orchestrator; a live feed of how the agents collect all users' data to date; the orchestrator picks those up and improves app stickiness and logging autonomously." This page is the design, the review record and the build order. It extends the parent note `2026-10-18-verification-and-data-collection.md` (Part 2), which is still the honest pipeline for people who never sign in.

## 1. Where the data is today (read live on 19 Oct, project `zodkohwaznqgrfrcfdkf`)

| Store | Rows | Who can read | Promise in the app's words |
|---|---|---|---|
| Diary on the phone (`ovumind_db_v1`) | every user | the phone only | "Your diary stays on this phone unless you sign in and turn on cloud backup" (privacy.html) |
| `entries`, `profiles` (cloud backup) | 0 | own rows only (RLS) | cloud notice: "set up so **only your signed-in account can read it**" |
| `auth.users` | 1 | service role | account sign-in (email code) |
| `account_grants`, `plus_*` | 1, 3 codes | service role | Plus and tester grants |
| `luna_usage` | 18 day-buckets | service role | hashed address counters, no diary |
| Edge functions `luna`, `insight`, `foods`, `podcast`, `plus-upload`, `account` | | | origin-locked, model key in Vault |

The in-app agents (`ovu-agents.js`: cycle, sleep, symptom, food, reflection, Supervisor, Daily and Four-Week Summary) run on the phone over one person's diary. Nothing on the server has ever read a diary row.

**The load-bearing constraint.** The cloud notice promises that only the person's own account can read the backup. A server-side agent or an owner dashboard reading `entries`, even to count rows, is a read by someone else. So the dashboard and the agents are built now, but they read the diary tables only after the cloud notice says so (section 6), gated by one policy flag that Jamie flips. With zero backup rows today this costs nothing: nobody has to be re-asked.

## 2. The three data streams

1. **Backup stream** (signed-in, backup on): full entries with dates, own-rows RLS. Richest, smallest. Read by the dashboard and the agents only as aggregates, after the notice bump; per-person drill-down is a separate, later notice.
2. **Improve stream** (parent's Part 2, not built yet): de-identified device pseudonym, day offsets from a random epoch, categorical fields, server allowlist, small-cell rule. Covers everyone who ticks "help make Rhythme better" under notice v3, signed in or not. This is where most logging and retention data will come from, because most people will not make an account.
3. **Service stream** (exists): `luna_usage` buckets, function logs, Plus grants, account counts. No diary content. Readable now.

The agents are written against one internal shape (`agent_metrics`) that all three streams can fill, so switching a stream on is a policy change, not a code change.

## 3. Admin accounts

- `admin_accounts(email, role, added_by, added_at, note)`; RLS on, no policies (service role and the SQL below only). Jamie seeds the first row by SQL; afterwards the dashboard's Admins panel adds or removes emails through `admin_set(email, role, on)` which only an existing admin may call.
- Sign-in reuses the app's email code (`OvuAuth.sendCode/verifyCode`). The dashboard page then calls `admin_me()`; a non-admin gets `{admin:false}` and a plain "This page is for Rhythme staff" screen. Nothing is hidden by CSS alone: every read is a `security definer` RPC that starts with `if not is_admin() then raise`.
- `is_admin()` = `exists (select 1 from admin_accounts where email = auth.email())`. Roles: `owner` (everything, manage admins, approve actions), `analyst` (read aggregates, run agents). Only `owner` can flip policy flags.
- **Audit**: every RPC call writes `admin_audit(at, email, rpc, args_hash, rows)`. The dashboard shows the audit tail to owners. This is the PDPA access-control evidence.
- Secrets: none in the browser. The dashboard uses the publishable key plus the admin's own JWT; RLS and the RPC checks do the rest.

## 4. The agent team (server side, Supabase)

One edge function `team` (same guard rails as `insight`: origin lock for browser calls, Vault key, per-day caps) with three entry points:
- `pulse`: every hour, deterministic only. Each domain agent computes its metrics and writes findings. No model call.
- `review`: once a day (02:00 Singapore). Each agent turns its findings into proposals; the orchestrator ranks and acts. One model call per agent and one for the orchestrator, on aggregates only (never a diary row, never free text).
- `run_now`: the dashboard's button; an admin's JWT, checked by `is_admin()`.

Scheduling: `pg_cron` + `pg_net` (both available on the project, not yet enabled) POST to the function with a bearer secret kept in Vault (`team_secret`), per the Supabase scheduling guide. A failed or invalid provider response stops that run, writes `agent_runs.status = 'blocked'` with the error, and nothing retries automatically (house rule). The next scheduled run starts fresh; deterministic findings never depend on the model.

### The four domain agents and what each owns

| Agent | Reads (aggregates) | Findings it raises | Levers it may propose |
|---|---|---|---|
| **Menstrual** (`cycle`) | period and symptom entries per week; people with a first period logged; gap since last period per person bucketed; prediction mode mix (normal/wide/suspended) | coverage of cycle data, how many people have 2+ cycles, late-period silence, symptom logging without period logging | prompt copy for the calendar tap, which symptom chips lead, when to show the "no period for 40 days" question |
| **Sleep** | sleep entries per night per week; nights per person per week bucket; imported vs typed | nights logged per week, bedtime-tap use vs typed, drop after import, weekend gaps | wind-down reminder template timing, bed-tap greeting line, import nudge |
| **Food** | food entries, photo vs text vs barcode share, NOVA coverage | days with any meal, photo acceptance rate, barcode use, hawker match rate | which Luna food mode the Food tab opens on, portion prompt copy, HPB match gaps |
| **Mindfulness and stress** | mindfulness and reflection entries, practice kinds, minutes, Moon Tap, Erin sessions, watering | minutes per week bucket, which practices are repeated, which are tried once, mood words logged | which practice the mat offers first, bench variety order, Erin line choice, calm reminder time |

Every agent writes the same row shapes:
- `agent_findings(run_id, agent, metric, window, value numeric, people int, detail jsonb, severity)`; rows with `people < k` (k = 5 for the owner's operational view, 20 for anything that leaves the dashboard) carry `value = null` and `suppressed = true`.
- `agent_proposals(run_id, agent, kind, target, change jsonb, rationale, expected_effect, confidence, risk, requires_human)`.

### The orchestrator

Reads all open proposals, scores `expected_effect × confidence ÷ risk`, dedupes by target, then checks `agent_policy`:

| Action kind | Autonomous? | Lands in |
|---|---|---|
| `nudge_copy`: pick one of the pre-written gentle lines for a room surface (greeting, bed tap, mat, calendar) | yes, within the approved line set | `live_nudges` (public read, no personal data) |
| `reminder_template`: suggest a template time or label | yes | `live_nudges` |
| `drop_order`: which weekly drop goes first | yes, among built drops | `live_nudges` |
| `points_rule`: change hearts, caps, bonuses | **no**, proposal only | dashboard approval |
| `new_copy`: any line not in the approved set | **no**, proposal only | dashboard approval |
| `notice`, `consent`, `data_scope` | never proposed | |

Applied actions get `agent_actions(status='applied', expires_at)`; a lever expires after 14 days unless renewed by a later run, so a bad guess cannot stick. Every decision is an `agent_events` row (the live feed): "sleep: 0 nights from 0 people this week; coverage unknown", "orchestrator: 3 proposals, 1 applied (bed-tap line B), 1 held for Jamie (points), 1 dropped (duplicate)". Measurement: each applied action records the metric it hopes to move and its value at apply time; the next review compares and writes `outcome` (up, flat, down, too few people). Nothing here is causal proof; it is a before/after with the people count shown.

### What the model sees and does not see

Input to the model per agent: the agent's findings table for the window (numbers, buckets, counts), the approved line set, the policy, the last outcomes. Never: diary rows, names, free text, dates per person, device identifiers. Output: strict JSON proposals, validated server-side (kind in policy, target in the known surface list, change against a JSON schema), anything else dropped. Model: the existing Doubao relay key in Vault (no new vendor; no model names in the product).

## 5. The dashboard (`admin.html`, `admin.js`, `admin.css`)

Same static site, same look as the room's sheets, phone-first (Jamie reads on the phone). Panels:
1. **Today**: people with accounts, backups on, improve-stream devices, entries to date by type (suppressed buckets shown as "under 5 people"), active last 7 days, 28-day retention.
2. **Live feed**: `agent_events` over Realtime (`postgres_changes` on a table in the `supabase_realtime` publication with an `is_admin()` SELECT policy), newest first, with a pulse dot per agent; falls back to a 20-second poll.
3. **Agents**: one card per agent: last run, findings count, open proposals, applied levers and their outcomes; "Run now".
4. **Orchestrator**: the ranked queue, Approve / Hold / Reject for `requires_human` items, policy flags (owner only): `read_entries`, `read_improve`, `autonomy_on`, `k`.
5. **Retention and logging**: cohort curves (week of first entry vs weeks active), entries per active person per week, by type; streams side by side.
6. **Admins and audit** (owner): add or remove an email; the audit tail.

Charts are inline SVG drawn by `admin.js` (no chart library, same as the app). Every number carries its people count. Nothing on the page is exportable as raw rows.

## 6. What must change in the words before the diary streams switch on

- Cloud notice (`ovu-auth.js`, `CLOUD_V` bump, parent's file): add one bullet, proposed wording: "**How Rhythme learns from it.** Rhythme's own staff and its analysis agents may read counts and averages across everyone who backs up, never your diary on its own, to improve logging and the app. You can turn backup off at any time." Per-person reads by staff would need a further sentence and a reason-logged drill-down; not proposed now.
- Notice v3 for the improve stream: the parent's note already lists what it must say (PDPC guides linked there).
- Until the bump: `agent_policy.read_entries = false`, and the dashboard's diary panels show "waiting for the notice" with the service-stream numbers only.

## 7. Tests and checks

- `tools/test-core.js`: orchestrator ranking and policy gating as pure functions (`supabase/functions/team/policy.ts` mirrored in `tools/team-policy.js`); suppression of small buckets; proposal schema validation drops unknown kinds and targets; a lever expires.
- SQL: `pgtap` cases for `is_admin()`, the RPC refusals for non-admins, audit rows written, Realtime policy.
- `tools/e2e_smoke.py`: `admin.html` signed out shows the staff screen and makes no data request; with a faked non-admin session the RPC refusal is shown; no console errors.
- Live: run `pulse` by hand through the dashboard against the empty project, see the events arrive in the feed on the phone.

## 8. Build order

1. Migration `team_dashboard`: tables, RLS, `is_admin`, RPCs, audit, Realtime publication, policy rows, approved nudge lines (seeded from the room's existing copy), `live_nudges`.
2. Edge function `team` (deterministic agents + orchestrator + optional model step), Vault secret, `pg_cron` schedule.
3. `admin.html/js/css` with the six panels and the live feed; `ovu-nudges.js` (the app reads `live_nudges` anonymously; the room decides where to show a line, parent's call).
4. Tests above; Codex review; deploy; seed Jamie's admin email; first pulse.
5. Hand the notice wording to the parent session (owner of `ovu-auth.js` and `room.js`).

## 9. Review record

- jevtriage: full depth; jevauto, Gold Drop, Astra 6 selected. jevauto's top candidate ("client-side interaction tracking, consent modal, React/Vue dashboard, WebSockets") was taken as a lead and rejected on two points: the app is vanilla and stays so, and client-side tracking is exactly what the consent notice forbids until notice v3. Its one useful point, realtime push to the dashboard, is kept (Supabase Realtime).
- Codex (gpt-6-astra) and DeepSeek (Ark) opinions: see the section appended after the reviews.

## Sources

- Supabase, Scheduling Edge Functions (pg_cron + pg_net, credentials in Vault): https://supabase.com/docs/guides/functions/schedule-functions
- Supabase, pg_cron reference: https://supabase.com/docs/guides/database/extensions/pgcron
- Supabase, Subscribing to database changes (publication, RLS as the subscribing role): https://supabase.com/docs/guides/realtime/subscribing-to-database-changes and the troubleshooting page https://supabase.com/docs/guides/troubleshooting/realtime-postgres-changes-troubleshooting
- Amagai et al. 2022, Challenges in Participant Engagement and Retention Using Mobile Health Apps: Literature Review (62 studies 2015 to 2020: feedback, appropriate reminders and in-app support promote retention; lack of support, technical difficulty and low usefulness are the barriers): https://pmc.ncbi.nlm.nih.gov/articles/PMC9092233 . This supports "levers = feedback, reminders, support", not any specific streak or points rule.
- PDPC guides (Data Protection by Design, children's data, Basic Anonymisation, Key Concepts, transfer limitation): linked in `2026-10-18-verification-and-data-collection.md`.
