# How we know Rhythme works, and how data collection can start honestly

18 October 2026. Written for Jamie after the question "now that we have built the app, how can we make sure it works and the data are collected". Part 1 is being implemented tonight; Part 2 is a design that stays switched off until the consent notice and the privacy policy allow it.

## Part 1. Making sure it works

### What exists today
- `tools/test-core.js`: 139 checks over the rule agents, the store, the cycle maths, NOVA, the pet shop and the PDF writer, run in a Node vm with a fake browser. Fast, deterministic, no network.
- `tools/check.py`: every inline script and JS file must parse, every local link and asset must exist (80 pages).
- GitHub Pages deploys from a GitHub Actions workflow on every push to `main`. Until tonight the workflow deployed without running anything, so a broken push went live within a minute.
- Supabase edge functions (`luna` v5, `insight` v4, `foods` v2, `podcast` v1) are origin-locked, counted per day, and keep the model key in Vault. They have no automated test.

### What changes tonight (commit on main)
1. **Deploy is gated.** `.github/workflows/deploy.yml` now runs three jobs: `test` (the 139 checks and the page checker), `smoke` (the end-to-end suite below in headless Chromium), and only then `deploy`. A pull request runs the first two without deploying. A red run means Pages keeps the previous good version.
2. **End-to-end smoke suite** `tools/e2e_smoke.py` drives the real pages at 390 x 844 with the relay blocked (no model call, nothing leaves the machine):
   - the room boots for a consenting person, consent stays closed, eight hotspots and five tabs render, no sideways scroll;
   - the Cycle tab opens the calendar; the Food tab opens with its modes;
   - Luna's on-phone rules turn "slept 11pm to 7am, cramps 6/10" into a confirm card without any relay call (AI help off by default);
   - the journal shows the six tiles, the three seeded entries, and Download PDF produces a real `Rhythme-summary-<date>.pdf`;
   - the evidence page lists E49; a Learn page carries the Rhythme header and tabs with no old launcher; `home.html` redirects into the room;
   - a first-time visitor sees the welcome, nothing is saved, and any other page sends them to the room first;
   - zero page errors and zero console errors across the run.
   Run it locally with `python3 tools/e2e_smoke.py` (Playwright 1.63, Chromium).

### What still needs a person or a phone
- **iPhone Safari is the real device and nothing here emulates it.** The iOS Simulator tool needs a full Xcode install, which this Mac lacks. A ten-minute device pass after each notable release: add to home screen; open from the icon; barcode scan on a real pack; food photo; a podcast episode plays with the screen locked; Download PDF opens the share sheet; airplane mode, then open the app (service worker shell); pinch to zoom the house. Jamie's group chat testers can do this against a checklist in the You tab later.
- **Field errors.** The app sends no telemetry, by design and by the consent notice. The honest substitute is a local error log: window errors and failed relay calls kept on the phone (last 20, with page, time and message, no diary data), shown under You as "Diagnostics" with a copy button, so a tester can paste it to Jamie. Proposed, not built.
- **Backend watch.** Supabase keeps function logs and the `luna_usage` day buckets; the Supabase MCP `get_advisors` currently reports only the intended "RLS enabled, no policy" tables (service role only) and the unused Auth leaked-password setting. A monthly look at logs and counters is enough until there are users.
- **Model-written text.** The 28-day-default leak showed that any string in the summary input becomes prose. After every change to `cycleStats`, `fourWeekSummary` or the prompts, read one generated clinician summary end to end.

## Part 2. Collecting data without breaking the promise

### Where we stand
- The diary lives in the browser (`ovumind_db_v1`). There is no account and no sync. The Supabase tables `profiles` and `entries` (migration `sync`) exist with zero rows and nothing writes to them.
- Consent v2 (18 Oct) says, in the user's words: "Help make Rhythme better" is unticked by default, "nothing is shared today, and we will tell you before it starts", research is asked about separately, and "before any cloud backup starts, we will show a new notice and ask you again". Luna's optional AI help is the only thing that leaves the phone, and nothing is kept.
- Server-side data today: `luna_usage` counters (hashed network address, day, bucket) and `plus_grants` (code use). That is all, and it matches the notice.

So "collecting data" means building a pipeline that is **correct and switched off**, then switching it on only with notice v3 plus the policy Jamie is writing.

### Decide the questions before the fields
Collect only what answers a named question. Proposed first set:
1. **Prediction accuracy.** For each cycle: predicted window (from, to) at the time of prediction, the observed start, the mode (normal, wide), how many logged cycles informed it. Answers "is the window right, and how often".
2. **Coverage and retention.** Days with any entry per 28-day window, entry types used, weeks active since first open. Answers "do people keep logging, and what".
3. **Feature use.** Counts per feature per week (Luna notes, photos, barcode, PDF export, podcast plays, practices). Answers "what earns its place".
4. **Symptom patterns by phase** (later, after a research notice): symptom categories by cycle day bucket. Counts only.

Not collected, ever: names, free text, notes, photos, exact dates of birth, the diary itself, device identifiers from the OS, IP addresses beyond the existing hashed counters, anything from under-16s.

### De-identification design
- A **device pseudonym**: a random UUID made on the phone, stored beside the diary, shown in You ("your anonymous id"), rotatable, and deleted with "Delete everything". Deletion sends one request that removes every row carrying it.
- **Relative time only**: day offsets from a per-device random epoch, so rows carry no calendar dates. Cycle length and window width are differences, so accuracy maths still works.
- **Categorical, bounded values**: age band, life stage, prediction mode, entry type, feature name, symptom category from the fixed list. A strict allowlist is enforced server-side; anything else is dropped, not stored.
- **Small-cell rule in analysis**: aggregate views only report buckets with at least 20 devices (our choice, stated in the policy). Raw rows are never exported.
- **Retention**: 24 months from receipt, then deleted by a scheduled job; stated in the policy.

### Architecture (all pieces already have a pattern in this repo)
- Edge function `improve`: POST only, origin-locked like `luna`, per-device and global day caps through `luna_bump`, JSON schema allowlist, writes with the service role into `improve_events(device uuid, kind, offset_day, fields jsonb, received_at)`; `DELETE` with the pseudonym removes everything for it. RLS on, no policies (service role only), same as today.
- Client `ovu-improve.js`: a queue in the store, batched once a day when the improve tick is on **and** the stored notice version is 3 or higher; nothing is queued otherwise; the You tab shows the last send and what was in it.
- Views for the four questions, read only through the dashboard, never by the app.
- Tests: schema allowlist and dropping of unknown fields; nothing queued without the tick; nothing queued on notice v2; deletion by pseudonym; relative-day arithmetic; a Playwright check that a v2 user never triggers a request.

### What the notice and policy must say first (Singapore)
- PDPA basics the consent reviews already listed: who the organisation is and a DPO contact; purposes stated specifically (the four questions above); what is collected and what is not; retention; how to withdraw (untick, and the pseudonym deletion); access and correction routes. Sources: the PDPC Data Protection by Design guide (https://www.pdpc.gov.sg/-/media/Files/PDPC/PDF-Files/Other-Guides/Guide-to-Data-Protection-by-Design-for-ICT-Systems-%28310519%29.pdf) and the PDPC guidance on children's data (https://www.pdpc.gov.sg/-/media/files/pdpc/pdf-files/advisory-guidelines/advisory-guidelines-on-the-pdpa-for-children%27s-personal-data-in-the-digital-environment_mar24.pdf). Certainty: moderate that these are the right instruments; the policy itself needs a professional read before publication.
- De-identified is not anonymous under the PDPA unless re-identification is not reasonably possible; the small-cell rule, no dates, no free text and no OS identifiers are the design choices that argue for that, and the policy should still treat the pipeline as personal data processing under consent. The PDPC Guide to Basic Anonymisation (31 March 2022, five steps: know the data, de-identify, apply techniques, compute risk, manage risk; https://www.pdpc.gov.sg/-/media/Files/PDPC/PDF-Files/Advisory-Guidelines/Guide-to-Basic-Anonymisation-31-March-2022.ashx) is the reference to follow when the fields are final; it says itself that following it does not by itself establish PDPA compliance.
- Overseas transfer: Supabase hosts the project outside Singapore, so the policy names that and the safeguards (PDPA Transfer Limitation, Personal Data Protection Regulations 2021 reg 10: https://sso.agc.gov.sg/SL/PDPA2012-S63-2021#pr10-).
- App stores later: Apple 5.1.1 to 5.1.3 need the same disclosures and a visible opt-in (https://developer.apple.com/app-store/review/guidelines/#privacy).
- Children: the notice already requires 13 or older or a guardian; the pipeline must also refuse to queue when the age band is under 16.

### Order of work
1. Tonight: deploy gate and smoke suite (done when this commit's run is green).
2. Next session: diagnostics log in You; the `improve` function, client queue, schema, tests, dashboard views, all behind the notice-version check so nothing is sent; a draft of notice v3 text for Jamie's policy.
3. Jamie: finish the privacy policy and the DPO contact; decide the retention period and the 20-device rule; approve notice v3.
4. Then the switch: ship notice v3 (existing users are asked again), turn the queue on for people who tick, and read the first accuracy view after a month.
5. Separate, bigger decision: accounts and cloud backup (Supabase Auth, the existing `profiles` and `entries` tables), which the notice promised to ask about on its own.

### Limits of this document
Nothing in Part 2 is built. The device pass in Part 1 has not been done by anyone yet tonight. The smoke suite runs Chromium, not WebKit, so it proves the pages and the logic, not iPhone Safari behaviour.
