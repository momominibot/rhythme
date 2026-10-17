# Doubao source handoff and verification

Reviewed 11 September 2026 by Codex.

## Source provenance

The Ovuluna App conversation in Doubao identified its command working directory as `/Users/michiyomimi/Doubao/chats/2026-09-07/new-chat-4/nemow`. That repository was clean at `41b389b` (10 September, 20:16 Singapore). An independent public HTTP comparison confirmed identical bytes for `home.html`, `darkmode.js`, `theme.css`, `ppg.js`, `bio-age.js` and the zero-byte `wellness-checkin.html`. This establishes the working baseline for this continuation, rather than relying on an older GitHub main or the earlier Codex checkout.

A separate clone and branch preserve all Doubao commits. The original checkout was rechecked and remained clean at the same commit after this work. No original user files or browser health records were changed.

## What changed in this local continuation

The three syntax fixes are quote/escape repairs only. Missing `ovaria-persona.css` references now point to the existing `ovuluna-persona.css`. The shared navigation points to the existing partner page instead of the absent intimacy page and removes absent duplicate circle/partner-learning entries. No group-chat backend was implemented.

The journal and onboarding logic were recovered from the earlier working Codex implementation. The journal uses the existing distinct `ovuluna_wellness_journal_v1` key, validates required input, preserves unreadable records, and uses textContent for stored notes. It was adapted to the latest brand header and navigation; it does not introduce a new wellness score. Onboarding saves only a local starting-page preference and targets routes present in this static version.

## Verification scope

The static sweep checked 76 pages, 68 executable scripts and 776 local page links. No parse failures, empty pages or unresolved local file references remain in that sweep. One informational finding remains: `learn-hormone-phase-locking.html` has no discovered inbound link. Script-generated fragments, backend availability and every interactive feature are not proved by a file-existence check.

Five ephemeral jsdom tests exercised the journal's incomplete-form guard, fictional save, reload, same-date update without duplication, and malformed-record preservation. No test health entry was written into the user-facing browser.

At a 390px mobile viewport, the font cycle reached 1.0, 1.15 and 1.3 content zoom; header and nav remained 390px wide at the same positions. Extra-large Home showed a 1px document-width rounding overflow, not addressed in this focused handoff. Font resizing on legacy pages without `.scroll` remains unverified. The working Home water panel now opens, the journal is accessible from Home and its incomplete submission is blocked, and both onboarding steps and its no-save return path render. The initial baseline tab logged the two diagnosed apostrophe errors; no new errors appeared after repair in the inspected browser log.

## Separate biometric and application review still needed

This baseline contains its own standalone camera engine and scoring code. Earlier audited Next.js camera/evidence routes have not been merged. Do not overwrite either implementation without comparing data schemas and measurement behavior.

A concrete timing mismatch exists in the current standalone PPG: `ppg.js` fixes acquisition endTime from elapsed wall time, while `ppg.html` subtracts paused duration only from the displayed countdown. Its result filter removes low-red samples without splitting discontinuous timestamps. Pause/resume and interval quality need correction and testing before stronger measurement claims. Stress/luteal labels, fasting statements, PhenoAge/ovarian-age interpretation and existing Home demo values need independent evidence and data-integrity review. The source pass did not clinically validate them. Do not describe this whole app as production-ready.

No production deployment, API credentials, billing, health-provider connection or community data store was changed. The local static preview does not provide Vercel API routes.
