# Privacy and Luna integrity pass — 11 September 2026

Scope: `luna-chat.js`, bounded `luna-chat.css` additions, `privacy.html`, `privacy-local.js`, `privacy-local.css`, `settings.html`, the deletion link in `personal-info.html`, and `scripts/check-privacy-luna.cjs`. This is a local development repair; no production deployment, patient-data migration or legal certification was performed. This note supersedes the Luna/privacy behavior described at the original source lines in `NATIVE-DATA-AUDIT.md`, not that audit’s broader release findings.

## Behavior now implemented

- Luna is explicitly an **offline educational guide on every origin**, including `capacitor://localhost`. No hostname shortcut pretends to provide a model response. It makes no chat requests, reads no health or conversation stores, and saves no new conversation. Conversation state is in memory, bounded to 20 messages, clearable, and cleared when leaving the page.
- Removed fictitious premium entitlements, daily credit limits, ungrounded dosing recommendations, phase diagnoses, ovarian-age inference and automated fasting advice. Existing `ovuluna_luna` bytes are preserved, not loaded into the guide.
- Three prepared explanations use existing reviewed evidence keys: `ovarian-age-concept`, `cycle-teaching-model`, `camera-ppg-study-scope`. The source buttons render only for entries explicitly marked reviewed. No new evidence metadata or clinical validation claim was added. Message text is rendered as text, never HTML.
- Opening Luna focuses its Close control so reading does not immediately request a phone keyboard. Closing blurs the input and restores focus to the launcher without scrolling. Final-source browser checks pass; native keyboard behavior is checked separately.
- `OvulunaLuna.open/close/getCredits/ask` remain available. `getCredits()` returns `null`; `ask(question, callback)` returns `callback(null, 'authentication_required: …')` without a request. `getCapabilities()` explicitly reports offline guide, no online/auth/premium/persistent conversation. A future integration must provide real identity, consent and service configuration before online chat is enabled; client-side strings or local storage are not credentials.
- Privacy shows actual capability limits instead of inactive Face ID, 2FA, encrypted sync, research sharing, fake account deletion or compliance toggles. Links are real routes; there is no fictitious version, last password-change date or published policy.
- Export requires explicit store selection. JSON includes raw values, origin, version and export time. This preserves malformed/legacy records exactly rather than translating them into invented measurements. Nothing is selected by default; unknown stores are excluded.
- Deletion requires an itemized review and acknowledgment. A change between review and confirmation aborts before deletion. Per-item storage failures are reported without claiming all items were removed. Other devices, server records, exports and unselected stores are unaffected. Cross-tab change notifications clear the selection/review; local storage has no multi-tab transaction lock, so other tabs should be reloaded before editing.
- Browser export uses a download request plus a selectable JSON fallback. On the native development runtime, the page clearly reports that **native file sharing is not connected** and offers selection/copy instead. This does not verify iOS Files/share-sheet behavior or provide restore/import.

## Settings entry points added on resume

Settings now includes separate **Delete my data** and **Delete my account** entry points near the top. Data deletion links directly to the local inventory; account deletion links to a truthful no-connected-account explanation. Opening either changes no records. The fabricated Settings identity, active subscription, device connections, dead service toggles and sign-out action were replaced with the current capability status. Appearance selection remains functional, keyboard accessible and reports save failures. `personal-info.html` now links its Delete My Data action directly to the inventory; its other prototype fields remain outside this pass.

The inventory offers explicit Select all listed local items / Clear selection. Nothing is preselected. The review dialog also offers Export first, which closes the review and prepares a copy without deleting anything. A later deletion still requires a fresh review and acknowledgment. The camera topic in Luna now links to the existing `learn-ppg-tech.html`; all generated guide destinations are checked.

See `SETTINGS-DELETION-PASS.md` for the account backend gate and latest verification.

## Storage coverage

Current explicit stores: lab records, wellness journal, daily check-ins, ovarian assessment inputs/history, PhenoAge research inputs/history. Additional enumerated stores: health profile, label scans, MEDAS/PSS questionnaires, sleep diary, hydration, acupoint routine and footsoak reminder. Legacy choices include `ovuluna_luna`, `ovuluna_ovarian_age`, `ov_result`, `ovuluna_labs`, `ovuluna_wellness_data`, `ovuluna_cycle_data`, plus individually recognized `ovuluna_daily_log_YYYY-MM-DD` keys. Appearance/preferences are separate choices. There is no `localStorage.clear()` or prefix-wide deletion.

This is an export/delete inventory, not a claim that every older tool or record format has been validated. Local records still use browser storage without app-layer encryption or account isolation. The shared appearance controller may persist theme/font preferences; the privacy controller itself does not write or delete data during initial display.

## Source checks

Reviewed 11 September 2026:

- [ASRM ovarian reserve committee opinion](https://www.asrm.org/practice-guidance/practice-committee-documents/testing-and-interpreting-measures-of-ovarian-reserve-a-committee-opinion-2020/) and [ACOG AMH committee opinion](https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2019/04/the-use-of-antimullerian-hormone-in-women-not-seeking-fertility-care): reserve and fertility interpretation limits; neither establishes an Ovuluna age conversion.
- [Endotext cycle physiology](https://www.ncbi.nlm.nih.gov/books/NBK279054/) and [NICHD menstruation overview](https://www.nichd.nih.gov/health/topics/menstruation): educational sequence and variable cycle timing. The app’s fixed ring is source-inspected illustration code, not a personal phase detector.
- [Bae et al., Communications Medicine 2022](https://www.nature.com/articles/s43856-022-00102-x): specific smartphone HR/RR algorithms and study populations. This study is not validation of Ovuluna. The existing reviewed PPG entry also retains its other phone/PRV study references and limitations.
- [OWASP HTML5 Security Cheat Sheet, Storage APIs](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#storage-apis): browser storage must not imply authentication or confidentiality; stored text is untrusted input. Source inspection confirms no app-layer encryption or identity boundary in the enumerated stores.
- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/): disclosures must reflect actual app/third-party data practices. This UI does not resolve App Store privacy labels, controller identity, processor retention or jurisdiction-specific compliance. The PDPC obligations page was retrieved but its body was unavailable to this reader; no legal conclusion was based on it.

## Verification and remaining boundaries

`node scripts/check-privacy-luna.cjs` checks byte preservation, malformed/hostile payloads, known versus unknown stores, empty selection, scoped/legacy deletion, changed-review rejection and partial storage failure (11 groups including generated guide-link existence).

`node scripts/check-privacy-luna.cjs --browser` additionally requires an externally supplied Playwright installation (`OVULUNA_PLAYWRIGHT_MODULE`) and a local preview (`OVULUNA_TEST_URL`, default `http://localhost:4197`). It uses a fresh Chromium context, synthetic records and blocked external/API requests. It checks JSON download, deletion consent/cancel/Escape/focus, stale review, legacy preservation, native-export limitation, source dialog focus, unavailable evidence, storage denial, HTML-safe messages and zero API calls; 320/390px light/dark panels with A++ and reduced motion. The A++ check found and fixed guide clipping by allowing a taller panel.

These checks do not establish VoiceOver conformance, native keyboard/viewport behavior, physical device security, native sharing, or clinical accuracy. Existing web headers/nav depend on externally loaded icon fonts; with fonts intentionally blocked, those icons show their legacy text fallback. The native bundle/font work is owned separately. Other pages still require their own claim and data-flow audit. Full operator privacy policy, account lifecycle, secure persistence, verified identity, processor agreements/retention and evidence review remain release work.
