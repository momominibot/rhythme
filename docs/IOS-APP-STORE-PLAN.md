# Ovuluna — iOS implementation plan and design framework

Prepared 11 September 2026. Working source: `ovuluna-doubao`, branch `codex/doubao-continuation`, based on the verified Doubao continuation. This is an implementation and release-gate plan, not a certificate of medical accuracy or App Store approval.

## Decision and current readiness

Preserve the Doubao lunar identity and consolidate its implementation. Build the first iOS release from bundled web assets in a Capacitor native shell, with narrowly scoped native integrations. This keeps the current design while providing a path to native permissions, secure storage, accessibility settings and optional HealthKit. Capacitor provides an iOS project managed through Xcode; a local development project now exists and has passed an unsigned simulator build; signing and real-device verification remain open. [Capacitor iOS documentation](https://capacitorjs.com/docs/ios)

**Do not submit the present build.** The audit found fixed example results presented as personal measurements, unsupported ovarian-age conversions, incorrect citations, and incomplete native/account/community workflows. The current repository has 76 static HTML pages, a reproducible public-asset build and a local Capacitor iOS development project. These additions do not close the clinical, identity, data-protection or release requirements. A working Vercel site is only one part of the release.

| Area | Verified state | Required release outcome |
|---|---|---|
| Visual system | Learn, 14 articles and TCM have revised theme surfaces; six Higgsfield watercolor icons; shared safe-area/text/nav repairs and 21 representative layouts checked | Every shipped route uses the same shell, typography, spacing and accessibility behavior |
| Learn | 18 real guide destinations, topic/search/chapter filters, six existing films | Reviewed content; transcripts/captions; no invented endorsements or accuracy claims |
| Citations | Existing evidence records and triggers; popup accessibility upgraded; two mismatches corrected and PhenoAge method/version documented | Every health claim mapped to a checked source and explicit applicability/limitations |
| Ovarian score | Unsupported rules removed; versioned input/record flow; no numerical prediction | A specified, reproducible, clinically validated endpoint, or no clinical age result |
| Bio-Age | Unit-aware nine-marker research calculation and optional history connected; published coefficient version traced; clinical applicability remains open | One actual computation path, no demonstration numbers masquerading as measurements |
| Camera PPG | Deterministic lifecycle and advice-gating defects reproduced; targeted repairs in this change set | Device validation, reliable quality rejection, consistent measurement provenance |
| Accounts/community | Audit confirms prototypes and invitation/entitlement/auth defects; no operational private group chat established | Verified authorization, deletion, moderation and cross-account isolation |
| iOS | Pinned Capacitor shell and local asset build exist; unsigned simulator build verified | Signed build, real-device evidence, privacy declarations and complete review materials |

## 1. One visual language across every route

Use a route manifest assigning each shipped page its title, tab, parent, authentication requirement and supported actions. Replace heuristic redirects for `#` links with explicit destinations or clearly unavailable controls. Keep five main destinations: Home, Learn, TCM, Foods, Profile. Put secondary tasks under their parent, with a real back action. Exclude prototype/provider/debug routes from the production launcher until complete.

The audit found 63 `.scroll` shells, nine `.content` shells, two bottom-navigation implementations and 2,684 inline style attributes. A shared component contract is more reliable than appending further page-specific overrides.

| Design token | Proposed standard | Implementation rule |
|---|---|---|
| Spacing | 4, 8, 12, 16, 24, 32 | Screen gutter 20; card padding 16–20; section gap 24; related items 8–12 |
| Grid | One column on phones; adaptive two columns for short choices | Use `minmax(0,1fr)`; stack at accessibility text sizes; no fixed text heights |
| Radii | 12 controls; 20 cards; 28 sheets | Keep the soft visual language without inconsistent rounding |
| Surfaces | Light lavender paper / opaque white cards; dark plum paper / opaque plum cards | Persona changes decorative accents, never text/surface contrast |
| Text | Deep plum in light mode; warm near-white in dark mode | Semantic primary/secondary/on-accent tokens; no pastel body text |
| Accents | Lavender, muted peach, sage, warm gold | Use for illustration, borders and decorative emphasis; pair text with tested colors |
| Type | Newsreader headings; Manrope body in web; native text styles in iOS | Heading 28/22; body 17; supporting 14; caption 12; body line-height about 1.55 |
| Controls | At least 44 × 44 pt design target | Visible focus; labels for icons; selected/error status beyond color alone |
| Safe areas | Insets supplied by iOS, including top and bottom | Add `viewport-fit=cover`; include safe-area insets in header, nav, sheets and content offsets |

Target WCAG AA text contrast: at least 4.5:1 for normal text and 3:1 for qualifying large text. Use 7:1 as an internal goal for important instructions where practical. Measure actual backgrounds, including both ends of gradients. [W3C contrast requirements](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)

Apple recommends 17 pt default custom text on iOS and supporting significant enlargement. Adopt Dynamic Type with custom-font scaling, rather than relying on the present A/A+/A++ zoom control alone. Audit VoiceOver, text enlargement, focus order and content reflow. [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Apple typography](https://developer.apple.com/design/human-interface-guidelines/typography)

**Migration order:** shared shell and primitive controls → Home/Profile/inputs/results/PPG → Foods/TCM → Learn articles → remaining routes. Each migration must preserve the user’s records and established navigation. The current shell measures fixed bars, covers both content/nav variants and prevents doubled text scaling. Legacy px pages still use one content zoom; rem pages opt into `text-scaled-page`. Full native Dynamic Type and all-route accessibility migration remain planned.

## 2. Visual-first patient journeys

Use a watercolor illustration to introduce a concept, one plain-language takeaway, then optional detail. Never embed necessary text in raster art. Use the generated icons in `assets/knowledge/`; job IDs and prompts are in `docs/KNOWLEDGE-ICONS.json`. Keep Luna as a guide, with an optional quiet mode. Decorative art must not look like a real scan or imply an actual body measurement.

| Journey | Visual treatment | Always-visible information |
|---|---|---|
| First use | Three illustrated cards: record, understand, discuss | Intended use, privacy choice, what the app cannot infer |
| Lab entry | Vial icon; one measurement at a time | Name, value, unit, test date, lab/reference interval and source |
| Cycle log | Illustrated phase strip with an explicitly estimated state | Actual recorded dates; missing-data state; assumptions |
| Results | Simple metric cards and a transparent input-completeness indicator | Value or unavailable state, unit, provenance, date, quality and evidence button |
| PPG | Placement illustration → steady-signal indicator → countdown → observation | Cancel, quality feedback, device limitations; no synthetic wave presented as measured |
| Learn | Watercolor topic grid, search, short guides, user-initiated films | Topic titles and textual alternatives remain visible without animation |
| Evidence | Tappable “Why this result?” / “Sources” control → bottom sheet | Applicable claim, source, population, limitations, method and check date |

Motion specification: use 120/200/320 ms transitions for state changes; gentle decorative floating/glow only when enabled. Stop offscreen and background work. Respect Reduce Motion by showing the final static state, not hiding charts. Every explanatory animation needs a static equivalent; videos need captions and transcripts. Do not make reading or navigation wait for an animation cycle.

Keep risk information next to the related action. Dense technical methods belong in the evidence sheet, but uncertainty and missing data must remain visible on the result itself. Do not hide essential eligibility or contraindication information behind a tooltip.

## 3. Establish what the ovarian engine actually measures

Start by defining the endpoint with a reproductive-health clinician: ovarian reserve interpretation, a research prediction endpoint, and a self-reported habit score are different outputs. General biological age is not ovarian age. Software correctness cannot establish clinical validity.

AMH/AFC inform ovarian reserve and treatment response; they do not justify arbitrary age offsets. ACOG cautions against using a single AMH result to predict time to pregnancy in women with presumed fertility. These statements do not validate Ovuluna’s composite model. [ASRM reserve guidance](https://www.asrm.org/practice-guidance/practice-committee-documents/testing-and-interpreting-measures-of-ovarian-reserve-a-committee-opinion-2020/), [ACOG Committee Opinion 773](https://pubmed.ncbi.nlm.nih.gov/30913198/)

**Chosen implementation policy:** retain actual records and explanatory context now. Keep clinical ovarian-age, menopause-timing and fertility predictions out of the release until an appropriate model and validation dossier exist. If a habit score is retained, label it as a transparent product score, not a medical age, and do not claim its weights are clinically established.

| Input/attribute | Required contract | Disallowed shortcut |
|---|---|---|
| Age | Real supplied value; valid population; recorded assessment date | Defaulting a blank entry to 30 or 33 |
| AMH, AFC, FSH, estradiol | Unit-aware records; assay/lab context; dates; clinician-defined applicability | Converting a broad bucket into “+7 ovarian years” |
| Cycle history | Actual dates and missingness; postpartum, contraception and other masking contexts | Classifying postpartum irregularity or a teen’s missed period as menopause |
| Sleep, diet, stress, activity | Validated instrument only where actually used; otherwise transparent self-report | Assuming omitted answers are healthy or substituting a clinical result |
| PPG pulse/PRV | Timestamped samples, device/session metadata and accepted quality | Using an unreliable reading to diagnose stress, confirm ovulation or change fasting |
| Wearable data | Source type, units, timestamp, consent, import/version and duplicates | Claiming Oura/WHOOP/HealthKit integration without a working implementation |

Implement one pure, versioned calculation module with explicit input validation. It returns a discriminated result: `available`, `insufficient-data`, `unsupported-context`, `quality-rejected`, or `invalid-input`. Include reasons; never emit NaN/Infinity, fill missing values silently, or reuse a stale result after input changes. Save the input snapshot, model version, evidence version, result and assessment time together.

```text
Recorded input + units + source + dates
                 ↓
Validation → eligibility → completeness → signal quality
                 ↓
Versioned method with published applicability
                 ↓
Result + uncertainty + limitations + evidence IDs
                 ↓
Metric UI / history / export (same result object)
```

For the PPG arithmetic, define peak times `t[i]`, interbeat intervals `IBI[i] = t[i+1] − t[i]`, then `RMSSD = sqrt(mean((IBI[i+1] − IBI[i])²))`, using milliseconds. Test deterministic fixtures, but label camera-derived variability as PRV unless agreement with the intended HRV reference has been established. Specify a single BPM estimator and its window/edge convention. Correct arithmetic is only one part of measurement validity.

Before any medical prediction: document data rights, intended population, target definition, coefficients/model artifact, missing-data rules, calibration, external validation and subgroup performance. Freeze the model before evaluating an independent set. Report error distributions, uncertainty, exclusions and failure rates; pre-specify acceptable performance with clinical oversight. Do not invent a passing threshold after seeing results. A prospective study, ethics review and regulatory assessment may be necessary; their duration cannot be estimated from this code audit.

## 4. Dynamic citations and traceability

The upgraded shared `evidence.js`/`evidence.css` opens an accessible bottom sheet from existing `data-evidence` controls. It supports multiple sources, safe HTTPS links, method details, limitations and source-check dates. Missing records produce an explicit unavailable state. Legacy records default to **Source review pending**; a citation record is not automatically “strong evidence.”

The current data layer is a foundation, not full coverage. For each shipped health metric, recommendation and score, register:

| Field | Meaning |
|---|---|
| Stable claim ID and version | Exact statement being supported; version preserved with results |
| Endpoint / scope | Background education, measured observation, product rule or clinical prediction |
| Source(s) | Full title/authors/date; DOI/PMID/official URL verified against the actual document |
| Evidence summary | What the source supports, without expanding association into causation |
| Population and limitations | Who was studied; exclusions; whether the result applies to this user |
| Method | Inputs, units, formula/version, missingness and quality rules |
| Source-check status/date | Bibliographic/content review status; separate clinical approval record |
| Clinical sign-off | Reviewer identity and approval only with a real documented review |
| UI bindings | Every card, advice item, chart metric and export using the claim |

Source workflow: retrieve the primary source → verify title/DOI/PMID → check claim and population → independently review the load-bearing claim → approve a versioned summary → run coverage checks. Retractions, corrections and superseded guidance must invalidate affected recommendations for review. Do not update executable scoring rules from a live citation feed; release versioned changes after testing.

CI must fail a release when a health claim has no reviewed record, a metric lacks its method/provenance, an ID is unresolved, or a safety-critical source is rejected. Inventory coverage over the actual rendered metric/advice states, not merely the number of info icons. Offline evidence summaries should remain available; external source links may require a connection.

Two corrected examples: the former ovarian-age PMID pointed to an acute-stroke paper; the former menstrual-HRV PMID pointed to a urothelial-cancer paper. The revised ovarian record explains reserve limits; the HRV record links to the actual 2019 review. Its group-level association does not confirm an individual’s ovulation or establish a fasting rule. [Original mismatched record](https://pubmed.ncbi.nlm.nih.gov/32668115/), [second mismatched record](https://pubmed.ncbi.nlm.nih.gov/32751328/), [correct HRV review](https://pubmed.ncbi.nlm.nih.gov/31726666/)

## 5. iOS and medical release requirements

Apple scrutinizes potentially inaccurate medical information and requires support for health-measurement accuracy claims. Include methodology and any applicable regulatory documentation, and remind users to consult a clinician for medical decisions. Review also requires complete working features, accurate metadata, and an experience beyond a repackaged website. Community features require filtering, reporting, blocking and reachable support. Health-data handling has specific restrictions, including advertising uses and inaccurate HealthKit writes. These are release gates, not guarantees of acceptance. [Apple App Review Guidelines, 1.2, 1.4.1, 2.1, 4.2 and 5.1.3](https://developer.apple.com/app-store/review/guidelines/)

For Singapore, assess intended medical purpose against HSA’s digital-health framework. For a US release, assess FDA device/general-wellness boundaries separately. A “wellness” disclaimer alone does not settle classification while the product claims diagnosis or treatment. Obtain a documented determination for the actual functions and markets before medical marketing. [HSA Digital Health](https://www.hsa.gov.sg/medical-devices/digital-health/), [FDA General Wellness guidance, January 2026](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices)

Native implementation package:

- Bundle production HTML/CSS/JS/assets and reviewed evidence for offline use. Keep Vercel APIs as authenticated services; never include server secrets in the client bundle. Enforce an explicit navigation/HTTPS allowlist in the native bridge.
- Add purpose-specific camera/health permission explanations, denial/revocation handling, secure credentials in Keychain, protected records and explicit consent. Treat health sync as optional; manual records must still work.
- Define data retention, export and deletion. Inventory every SDK/network destination, remove health data from analytics/logs, and match App Privacy disclosures to observed collection. [Apple privacy documentation](https://developer.apple.com/app-store/user-privacy-and-data-use/)
- If accounts can be created, implement in-app initiation of full account deletion and explain any legally required retention. Test completion across storage, tokens and shared content. [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- Create bundle ID, signing/capabilities, app icon, launch assets, privacy manifest and subscription flows where applicable. As checked on 11 September 2026, uploads require Xcode 26 or later and the applicable version-26 SDK; recheck before upload. This is distinct from the chosen minimum supported iOS version. [Apple SDK requirements](https://developer.apple.com/news/upcoming-requirements/)
- Ship useful, working record entry/history, understandable results, evidence detail and user-controlled export. Include only operational community and connected-device features. Test the packaged app independently of the browser preview.

## 6. QA and acceptance checklist

| Test family | Required cases | Passing evidence |
|---|---|---|
| Routes and actions | Every shipped link/button; direct load; back navigation; expired session; deep link | Route/action inventory has no placeholders, silent no-ops or inaccessible states |
| Layout | 320/390/430 px, supported iPad widths, rotation, keyboard, both themes, all chapters | No clipped copy or obscured controls; stable safe areas; semantic layout snapshots |
| Accessibility | VoiceOver, keyboard/Switch Control, maximum Dynamic Type, 200% web text, Reduce Motion, Increase Contrast | Complete tasks without sight-dependent cues; correct focus restoration; static charts visible |
| Entry validation | Empty/zero/negative/extreme values; decimal locale; incompatible units; old dates; future dates; duplicates | Explicit field errors; valid values retained; no false reassurance or assumed values |
| Ovarian method | Independent reference fixtures, boundaries, missing fields, unsupported populations, repeatability | Exact agreement with specified method; no result for ineligible inputs; separate clinical-validation dossier |
| PPG lifecycle | Start/cancel/retry; duplicate start; denied/revoked camera; no torch; background; finger loss; dropped frames | One active acquisition loop; stream/torch stopped; no old callback affects a new session |
| PPG validity | Synthetic pulse/artifact recordings plus real paired reference measurements across supported devices | Quality rejection tested; prespecified error targets; exclusions and failure rates documented |
| Evidence | Every claim/state; missing key; multiple sources; unsafe source URL; stale version; long source title | Safe rendering; real links; review status accurate; no unverified clinical recommendation released |
| Persistence | Restart/reinstall policy, edit/delete, timezone changes, interrupted sync, concurrent updates | No silent overwrites; provenance and versions survive; deletion/export consistent |
| Security/privacy | Cross-account access, auth expiry, authorization rules, logs, SDK traffic, consent withdrawal | Independent security review and negative authorization tests; disclosures match behavior |
| Community | Join/leave, block/report, moderation, deleted user, reconnect/delivery order, abusive content | No unauthorized access; operational moderation; verified delivery and retention behavior |
| iOS release | Clean install, offline launch, camera hardware, low-memory/background, TestFlight update, subscriptions | Real-device recording and issue log for the exact signed build |

Do not mark “all pages functional” based on static link checks. A successful HTTP response does not verify a form saves, an algorithm uses its inputs, or a chat message reaches only the intended members.

## 7. Delivery sequence and sign-off

| Stage | Owner | Deliverable | Exit condition |
|---|---|---|---|
| 0 — release blockers | Engineering + clinical owner | Remove fabricated live outputs; correct input/context guards; evidence register; PPG fixes | No unsupported health output in release routes |
| 1 — design consolidation | Design + engineering | Tokens, shell, reusable controls, route manifest, static/animated illustration system | All shipped pages pass layout/accessibility acceptance |
| 2 — scoring and evidence | Engineering + clinical reviewer | Typed inputs/results, versioned method, full citation coverage, reference fixtures | Calculation verification and clinical applicability approved separately |
| 3 — native/data integrity | iOS + backend | Native shell, permissions, protected data, account lifecycle, optional health import | Real-device and authorization tests pass |
| 4 — release candidate | QA + product owner | TestFlight build, review dossier, accurate screenshots/privacy/support | Zero open critical/high defects; all gates signed for exact build |

Parallelize visual migration and backend/privacy work after defining the release scope. Clinical validation is the schedule dependency; do not promise a submission date before it is resolved. A record-and-education release can be prepared earlier only if its actual functionality and marketing conform to that scope.

Review dossier: intended use and target population; feature inventory; model/evidence versions; validation and risk-management documents; regulatory determination/clearance if applicable; supported-device matrix; accessibility results; data-flow/privacy records; credentials for a working review account; support/contact URLs; accurate screenshots; and specific Notes for Review. Clinical, engineering, privacy/security and product owners approve their areas before Jamie authorizes external submission.

## Next implementation tickets

1. Completed locally: replaced fixed Bio-Age/Insights/Overview outputs with explicit input-driven or saved-record states. Home now reads actual dated check-ins/labs, with one hormone Bar / Graph card. Next: audit remaining legacy/demo routes and determine the approved scope of the research calculation.
2. Completed locally: removed ovarian-age/menopause-year heuristics and repaired blank/negative/unit/context handling. Next: establish and validate the intended ovarian model; validate PhenoAge clinical applicability for the intended use; its original published equation is now traced. Unavailable prediction states do not fulfill a validated scoring requirement.
3. Continue reviewing accuracy percentages and clinician endorsements in the remaining Learn and device pages against real artifacts; remove unsupported claims. The ovarian-age, camera PPG and wearables Learn articles have been corrected; remaining library claims need review. Luna now offers an explicitly offline prepared guide, with no diagnosis, account entitlement or cloud-success simulation.
4. Complete the evidence register across all health outputs, with clinical review and a failing release coverage gate.
5. Shared safe areas, font scaling, navigation geometry and reduced-motion chart visibility are repaired and tested on representative routes. Finish all-route reflow, 200% text, VoiceOver, physical iOS and native Dynamic Type; replace remaining nonsemantic controls.
6. Implement authenticated account/community/data boundaries identified in `readiness/NATIVE-DATA-AUDIT.md`, then test them. Settings now exposes scoped local-data deletion and accurately identifies absent account deletion. Finish signed native packaging and real-device PPG validation before submission.

The broader release gates remain open; completed local subtasks are identified above. Detailed scoring verification is in `readiness/SCORING-INTEGRITY.md`. The local visual improvements and deterministic tests are progress toward readiness, not evidence that the entire medical application is ready to ship.

Latest Home/shell/technology implementation and verification: `readiness/HOME-SHELL-PASS.md`. Native implementation and its verification limits are recorded in `readiness/NATIVE-FOUNDATION-PASS.md`; API boundary work in `readiness/API-HARDENING.md`; local deletion in `readiness/PRIVACY-LUNA-PASS.md`. The specialist’s measurement concerns and next input contract are recorded in `readiness/SPECIALIST-MEASUREMENT-REVIEW.md`.
