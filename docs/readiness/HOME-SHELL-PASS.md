# Home records, shared shell and technology guides

Local pass on 11 September 2026, following baseline `b866852`. This preserves the Doubao lunar/plum design. It is not a production deployment, clinical validation, or completed iOS release.

## Implemented behavior

- Home now uses dated, explicitly saved check-ins for mood, sleep, symptoms, water, activity and food. Required inputs start blank, optional answers remain missing, and entered zero values are retained. Same-day/category edits update that record; other records and legacy keys are preserved. History shows the latest 20 entries and export includes the full log.
- Sleep, water, movement and meal summaries read actual saved values. Removed preset personal HRV, sleep and calorie numbers and fabricated synchronization. Storage failures clear stale summaries and keep previous stored data intact; a visible page refreshes at local midnight.
- Home keeps one hormone card with Bar / Graph controls. It reads actual dated lab records, isolates each hormone and reported unit, preserves report source/method in a table, and keeps inequality bounds out of exact-point plots. LH and progesterone are now supported by lab entry and record summaries. No conversion, clinical range or ovarian-age calculation is inferred from these plots.
- The glowing cycle ring remains a 28-day teaching illustration with keyboard/range and previous/next controls. It does not read personal cycle dates or identify fertility. Four persistent SVG segments replace repeatedly rebuilt animation/listener state. Component-owned charts and the camera progress ring are excluded from generic entrance animation.
- Shared top/bottom bars use measured heights and safe-area padding. All 76 HTML viewport tags include `viewport-fit=cover` (73 updated in this pass). Four header controls retain 44px targets, both bottom navigation variants share the app column, and content scales once at 100/115/130%. Native Dynamic Type and 200% accessibility text still require separate work.
- The camera and wearable Learn guides now distinguish tested research from Ovuluna's implementation, PRV from ECG HRV, SDNN from RMSSD, and documented connection capabilities from active imports. Four new source-checked evidence records are integrated. Seven of 90 records have explicit source-check status; the remaining 83 still require review. Source checking does not constitute clinical approval.

## Data and implementation contract

`home-records.js` owns `ovuluna_daily_checkins_v1`, with versioned records containing category, local observation date, submitted values, identity, save time and self-reported provenance. Validation rejects malformed dates, incompatible choices, unsupported fractional/infinite values, inconsistent rest-day duration, duplicate stored identities and unsupported store versions. No input limit is presented as a health target. Browser localStorage remains a prototype persistence mechanism, not encrypted account storage or cloud backup.

`hormone-graph.js` consumes the existing validated Labs contract and persists only a display preference. Maximum-value ratios keep SVG coordinates finite, including extreme finite inputs. Table rows retain original dates/units/bounds. Connecting recorded points is a visual aid, not a continuous measurement.

The shared shell supports legacy px layouts through one content zoom and rem-based pages through one root scale. New rem pages opt into `text-scaled-page`. Full-page typography migration remains unfinished; see `SHELL-ACCESSIBILITY.md`.

## Verification and reproduced fixes

- `check-home.cjs`: 17 groups pass against the actual Home controller in isolated jsdom, including all six forms, missing/zero/optional values, update preservation, corruption/quota failures, safe text, export, timezone dates, midnight rollover and focus restoration. Independent tests exposed stale summaries, missing midnight refresh, stale assessment text and rebuilt-trigger focus; these were fixed before the final pass.
- `check-home-visuals.cjs`: 13 groups pass, covering real selectors, units, dates, bounds, latest-12 display, corruption recovery, safe source text, LH/P4 integration, finite extreme-value geometry, ring boundaries and stable listeners. Native range keyboard behavior was additionally checked in the browser.
- Existing Labs (9) and Insights/Overview (7) groups pass with the new analytes. These 46 groups establish bounded software behavior, not clinical accuracy.
- `check-shell.cjs`: 21 Chromium layouts pass across Home, Learn, TCM, Bio-Age, ovarian entry, biomarkers article and Profile at 320/390/768px with dark theme and A++. Additional checks cover one-time text scaling, persistence, 44px targets, simulated safe insets, wrapped bars, focus, reduced-motion final states and preservation of the camera progress offset. No pageerror events in this isolated run.
- Root browser checks used `localhost:4194`, separate from the user's `127.0.0.1:4194` storage. Checked empty and zero-value check-in submission, save/reload/reopen/Escape, FSH graph/unit isolation, native ring ArrowRight, visible ring arcs, readable TCM in both themes, source dialogs and focus return, expanded RMSSD example and article navigation. Home and wearable article had no page overflow at 320px/A++. The source button wrapping and hidden ring arcs found during review were repaired. A final light-theme check also scoped Home button styles to content/dialogs, restoring the shared 2px header outlines without changing form buttons.
- Whole-site static checks cover 76 pages and 814 local page links with no missing local targets or syntax failures. Six computed markup references remain explicitly unresolved. This is not proof that all forms, accounts or community functions work.

Receipts: `home-shell-regressions.json`, `shell-browser-layouts.json`, `home-shell-browser-ui.json`, `home-shell-site-static.json`. The jsdom/Playwright tools use existing local dependencies; no new app runtime dependency was added.

## Remaining release work

The native/data audit confirmed that partner/circle/account interfaces do not establish authenticated messaging, moderation or private data access. Four isolated stub-only reproductions exposed false invite success, unsigned NFC entitlement acceptance and unauthenticated chat forwarding. These source defects are documented in `NATIVE-DATA-AUDIT.md`; no live endpoint was tested or modified. Full Xcode and an iOS simulator runtime are installed, but this repository has no native project.

Still required: authenticated backend and account lifecycle, protected storage, actual community delivery/moderation, clinical review of remaining content (including legacy Luna responses), validated ovarian model, resolution of the PhenoAge publication discrepancy, real-device PPG/reference validation, complete accessibility/privacy checks and native packaging. No push, deployment, TestFlight upload or submission was performed.
