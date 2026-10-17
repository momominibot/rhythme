# Dated observation log and deletion coverage

Completed locally 12 September 2026. Continues Doubao's current lunar palette, shared app shell and font controls. This is a recording workflow, not a clinically validated estimator or a production account release.

## Delivered

- `cycle-log.html` now saves observations instead of offering unsaved selections. Six separate kinds: bleeding, waking BBT, mucus, urine tests, treatment context and manually copied device/app outputs. Home and Settings link directly to it; existing cycle-page links continue working.
- Versioned `ovuluna_observations_v1` store retains actual observation date, optional time and original UTC offset, source, creation/edit timestamps, context and notes. Same-day events can coexist. Calendar dates stay local; an unknown offset is not replaced with the current one. Editing preserves the entry ID and first-saved time.
- Missing/unsure/invalid states are explicit. Empty fields remain null, distinct from numeric zero. Spotting and full-flow onset are separated. BBT retains its original Celsius/Fahrenheit units. Urine LH and PdG, qualitative outputs, numeric concentrations (including qualifiers) and app line ratios remain distinguishable. Device temperature changes and estimates remain derived outputs; no conversions, thresholds, scores or treatment changes are applied.
- Treatment plans entered by a user remain user-transcribed; multiline notes survive editing. No clinician verification, connected device import, camera/photo classification or automated account syncing is implied.
- Timeline provides review/edit, filtering, incremental history and per-entry deletion with review/Cancel. Draft replacement requires explicit discard. Deleting an unrelated entry preserves a current draft; deletion of the edited record prevents stale restoration.
- Export contains all saved observation kinds as JSON or readable notes for a care visit. Original fields, missing values and provenance remain visible. It excludes separate lab/journal stores and says so. Browser download is real; native file sharing remains unavailable, with selectable text offered instead. Nothing is sent automatically.
- Settings inventory includes the exact new store for raw export and scoped deletion. Unknown/unselected stores remain untouched. Storage changes invalidate open forms and export previews. Corrupt/unsupported records and denied writes are reported without silent overwrite. Local-storage compare-before-write is **not an atomic cross-tab transaction**; protected per-user storage remains a production requirement.

## Evidence basis

The field choices are product decisions informed by sources, not a published scoring formula. Root independently fetched/read the primary ASRM, FDA, CDC and Apple pages on 12 September; the bounded clinical review is in `OBSERVATION-EVIDENCE-REVIEW.md`. Review date does not change publication dates.

- [ASRM fertility evaluation](https://www.asrm.org/practice-guidance/practice-committee-documents/fertility-evaluation-of-infertile-women-a-committee-opinion-2021/): BBT limits, indirect urine LH evidence, source/treatment context and test-specific interpretation.
- [FDA urine LH tests](https://www.fda.gov/medical-devices/home-use-tests/ovulation-urine-test): brand-specific collection/reading instructions. Its general qualitative-kit description is not a universal specification for every monitor.
- [CDC fertility-sign considerations](https://www.cdc.gov/contraception/hcp/usmec/fertility-awareness-based-methods.html): bleeding, discharge, medicines, postpartum context and temperature-related interpretation limits.
- [Apple wrist-temperature guidance](https://support.apple.com/en-us/102674): nightly wrist aggregates and changes relative to baseline, distinct from a waking thermometer reading.

No unsupported ovarian-age, ovulation-confirmation, TCM diagnosis, contraceptive decision or fasting override was added. The prior specialist review remains relevant; its proposed structured logging now has this bounded implementation. Formal device imports, linked lab/treatment IDs, a validated interpretation model and full clinical review remain open.

## Verification

- `node scripts/check-observations.cjs`: 21 synthetic regression groups pass, covering every record kind, units/zero/missing/qualifiers, multiline plan preservation, date validation, spoofed provenance, corrupt stores, stale edits/new entries/removals and storage failures.
- `node scripts/check-privacy-luna.cjs --browser`: 11 data/link groups plus the existing full Settings/privacy/Luna browser flow pass. Fixed only a test timing race: the active element may briefly be null during navigation, so its focus wait now polls safely.
- `node scripts/check-observation-ui.cjs`: eight real Chromium interaction groups pass with a fresh profile and synthetic records. Save/reload/edit, discard/Cancel, source/units/time zone, zero ratio, missing records, hostile text, multiline plan, complete download, native fallback, individual deletion and unrelated draft preservation, Settings deletion plus stale-tab invalidation, corrupt/denied storage, and six light/dark A++ layouts at 320/390/768px. No page errors or API calls. Receipt: `observation-browser.json`; screenshots: `observation-ui/`.
- Initial UI layout check compared the fixed header against a deliberately scrolled form. Corrected the test to return to the top before measuring; no product layout change was needed.
- Source check: 76 pages, 232 parsed scripts, 829 local page links, zero missing targets/syntax failures; two computed references still require runtime review. Receipt: `observation-site-static.json`.
- Both web and native public-asset builds pass. Native bundle validator passes: 76 routes/231 assets, matching hashes, no server code/secrets/dependencies bundled, local fonts/scripts. This batch did **not** rerun Xcode or physical-device testing; previous native simulator receipts are historical.

The reproducible browser suites require an external Playwright installation via `OVULUNA_PLAYWRIGHT_MODULE`, an installed Chrome, and a local public build. No test accesses the user's browser profile or health records. Synthetic exports are test artifacts only.

## Local review and remaining gates

Preview restored at `http://127.0.0.1:4194/cycle-log.html`; Home and Settings expose the new destination. The localhost-bound server serves only the generated `www` directory. Start if needed: `python3 -m http.server 4194 --bind 127.0.0.1 --directory /Users/michiyomimi/Desktop/ovuluna-doubao/www` after `npm run build`.

Account creation/sign-in, account-bound health storage, server deletion/revocation and real community remain unimplemented. Settings' Delete my account entry accurately explains that no account service is connected. Do not label local-store deletion as server account erasure. No auth provider or paid service was created, no real records deleted, and no push, deploy, external message or App Store submission occurred.
