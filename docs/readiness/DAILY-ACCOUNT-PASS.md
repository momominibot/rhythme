# Daily companion and web account foundation

Reviewed 1 October 2026. **deploy_needed**. Local implementation only; production and external account configuration are unchanged.

## Delivered locally

- Home, Profile, Settings, Reminders and the existing daily-overview route open `daily.html`. The shared screen menu also includes Daily companion and My account.
- A separately confirmed, dated life context and contraception answer select a small reading/action plan. Appearance and the illustrated ring never supply clinical answers. Current Home check-ins/journal and the previous six days of observations supply descriptive reasons. The reading windows are software choices, not validated clinical thresholds.
- Each prompt has an explanation, supporting evidence and a record or care-guide link. In-window postmenopausal/postpartum bleeding notes keep their original dates and priority even when newer ordinary or private entries exist. They cannot be dismissed with a routine completion mark.
- Optional daily marks are reversible. A chosen local time displays a cue while the app is open, including updates at that time and midnight. No push, email, device alarm, phase prescription, ovarian-age score or treatment override is implemented.
- A successful same-page Home save refreshes daily guidance immediately. Failed writes preserve records and drafts. The three exact daily stores are covered by local export/review/deletion; unknown stores and account credentials are excluded.
- `account.html` and seven Vercel handlers implement a configuration-driven web BFF for Apple/Google PKCE OAuth and email-code verification. Identity is verified server-side, credentials stay in encrypted HttpOnly cookies, and local health notes remain separate. Unconfigured services fail closed without a pretend login. See [the account setup contract](ACCOUNT-AUTH.md).

## Verification

The new daily suite passes 32 groups and the account suite 30. Related checks pass: Home 19, entry/preferences 12, local privacy 15 and existing API boundary 22. **130 targeted groups** in these six suites pass. Provider responses and credentials in the account/API suites are synthetic. Receipts: `daily-guidance-regressions.json`, `account-auth-regressions.json`, `daily-account-browser-qa.json` and `daily-account-verification.json`.

The static checker covers 91 pages, 142 parsed scripts, 3,199 local references and 1,107 local page links after screen-menu integration. No missing targets or syntax failures; four computed references remain explicitly outside static verification. Source metadata presence is not verified citation coverage.

Web and native public-asset builds pass with 277 assets. The native asset checker confirms API source, dependencies and private configuration are excluded, all bundled routes reference available resources, and fonts/animation assets retain licenses. Native launch/sign-in and physical-device behavior were not tested in this pass.

Actual browser actions on a separate fictional localhost origin verified: context save/reload/edit, local routine persistence, reversible completion, evidence drawer, mood save/edit and immediate preview changes, and perimenopause/sleep guidance with the original reported duration. Dark and light 320px layouts at extra-large app text have no horizontal overflow. This is targeted UI evidence, not whole-app accessibility or clinical validation.

## External state checked read-only

- Vercel `ovuluna` is linked to `momominibot/ovuluna-web` main with framework `nextjs` and no environment keys. This candidate is a static public build plus Vercel functions. Reconcile the approved source/framework/target before release.
- Supabase `ovaria-app` (`zodkohwaznqgrfrcfdkf`) is inactive in the already connected free organization. Its relationship to Ovuluna, existing data and intended reuse are unconfirmed. It was not resumed or connected. Other business backends were not repurposed.
- After owner-completed Apple Developer login on 1 October, inspection verified active Individual membership through 23 April 2027, accepted developer agreements, no recent support activity shown within 90 days, and no Ovuluna App ID or web Services IDs. Authorized Mail review then located the original conversion case, sent readiness confirmation on 2 September, sent follow-up on 11 September and Apple's repeated readiness request on 12 September. Precise delay cause/current internal review stage remain unverified. `hello@ranklore.ai` already receives mail in Mac Mail; app SMTP remains unconfigured. Individual membership supports Apple's web sign-in configuration; conversion is not itself a prerequisite. See [the authenticated inspection](ACCOUNT-AUTH.md#apple-membership-inspection-1-october-2026) and [mailbox evidence limits](ACCOUNT-AUTH.md#authorized-mailbox-follow-up-1-october-2026).
- Current first-party Apple, Google-provider, Supabase email/SMTP/session and clinical guidance were checked. The source ledger is [DAILY-GUIDANCE-EVIDENCE.md](DAILY-GUIDANCE-EVIDENCE.md). Source checking is not clinician approval.

## Open acceptance gates

Live Apple/Google authorization, actual email delivery, configured-provider session recovery/revocation, native sign-in and complete account deletion are not demonstrated. An independent offline audit reproduced refresh/logout ordering across separate server instances; process memory cannot coordinate those instances. Web Locks and a same-process tombstone close the tested browser/same-process race, but a durable shared session boundary remains a public-release requirement. Already-issued JWTs are not instantly invalidated by provider logout. No protected health, community or paid feature may rely on this status alone.

Public signup must wait for complete deletion/revocation, distributed session and abuse controls, provider verification, truthful privacy disclosures and protected per-user storage. Existing health notes remain unencrypted device-only browser records and are not isolated by signing in. Clinical/content and native release gates remain open.

Jamie must confirm the intended backend before restoration or new-project setup. Apple Developer membership is already active; no new enrollment/payment is needed for this setup. Provider identifiers/keys and email-sender registration need approved external configuration. Never ask for or paste existing secrets into chat. Nothing was pushed, deployed, purchased or submitted.
