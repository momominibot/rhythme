# Ovuluna user acceptance recheck

Reviewed 5 October 2026 against local source commit `100fbcc`, branch `codex/daily-guidance-auth`. **deploy_needed. The published app does not pass real-user account acceptance.** No production records, accounts, configuration or deployment were changed.

## What was verified now

Five newly created localhost origins kept fictional early-menstrual-years, conception, postpartum, perimenopause and postmenopause journeys separate from the owner's records. Through actual UI controls, each life context was saved and restored after reload. Each persona saved mood Low, reloaded it, edited it to Good and reloaded the edit. The support suggestion appeared for the saved Low answer and disappeared immediately after the Good edit; daily guidance read one dated Home entry, not a duplicate.

An additional fictional Spotting observation with explicit Postmenopause context and first-full-flow answer No was saved. On the daily page, it produced the care note with the original dated context. The care note persisted after reload. Its evidence drawer opened, displayed the two existing sources and limitations, and closed correctly. This verifies record-to-guidance routing, not a diagnosis, estimated ovarian age, confirmation of ovulation or validation of the clinical content. Existing source-check dates were preserved.

The October 1 [five-persona record review](PERSONA-USER-JOURNEY-PASS.md) separately documents actual bleeding, BBT/LH, AMH/FSH, journal, sleep and profile save/reload/edit actions. Those broader UI journeys were not all repeated today. Today's independently rerun 15 offline suites cover the underlying daily/account/observation/care/lab/journal/privacy/Home/summary/API/sleep/stale-write/input contracts: **227 groups passed, zero failed suites**. Provider responses remain synthetic; this is not proof of operational OAuth or email delivery.

## Published-version result

Fresh browser inspection of [live login](https://ovuluna.vercel.app/login.html) attempted Continue with Email without accepting Terms. No identity or account was verified. The actual public handler still sets an `ovuluna_auth` browser flag with `loggedIn: true` and navigates to onboarding; it does not perform real OAuth/email verification. No credentials, Terms acceptance or production records were entered.

Public HTTP checks returned 200 for Home/login, whose exact source bytes differ from the repaired candidate. The repaired `daily.html`, `account.html` and `ovarian-health.html` returned **404**. The current local account page, using the actual unconfigured account dispatcher with empty configuration and blocked provider traffic, correctly says sign-in is not configured and no account has been verified.

## Build and remaining limits

The first canonical build attempt found absent pinned font dependencies. `npm ci --ignore-scripts` restored the lockfile dependencies; the public build then passed with 277 assets. Static checks passed for 91 pages, 142 scripts and 1,107 local page links, with four computed references explicitly unverified. The earlier October 1 static receipt was preserved and today's receipt saved separately.

The dependency audit reports one high and three moderate advisories in transitive native-development tooling, including brace-expansion and uuid/xcode through the Capacitor CLI. These packages are excluded from the static public asset bundle. This is not a complete exposure or native-build security assessment; no forced upgrade was made. Address the development-tooling findings before certifying native release readiness.

Real Apple/Google/email authentication, protected per-user storage, complete account deletion/provider revocation, durable cross-instance session controls and provider abuse controls remain release gates. Local notes are not cloud-synced or isolated by signing in. Community chat, purchases, Apple/Google Health connections, physical-device PPG accuracy, whole-app accessibility and qualified clinical review have not passed acceptance. This recheck does not certify every app route or all life-stage outcomes.

## Exact receipts

- [Current actual UI scope and fictional proof](user-acceptance-20261005-browser.json)
- [Current independent offline regression results](user-acceptance-20261005-regressions.json)
- [Current public HTTP/source checks](user-acceptance-20261005-live.json)
- [Separate current static receipt](user-acceptance-20261005-static.json)
- [Current public-build and dependency-audit scope](user-acceptance-20261005-build.json)

No release or external account setup was performed. Reconcile the exact approved source and Vercel target before an explicitly authorized deployment; configure and verify the full account lifecycle before presenting the app as ready for real signed-in users.
