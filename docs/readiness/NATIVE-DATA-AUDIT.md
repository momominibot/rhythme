# Ovuluna native, data and connected-feature audit

11 September 2026 · Source baseline `b866852` · `/Users/michiyomimi/Desktop/ovuluna-doubao`

## Outcome and scope

The existing Doubao interface can be continued in a bundled Capacitor iOS app, and the Mac has usable Xcode and an iOS Simulator runtime. The native project has not been created. The next concrete stage is a native/data foundation: a reproducible public-asset bundle, explicit runtime configuration, protected record storage, and real account/authorization contracts. Connected partner/community work depends on that foundation and remains part of the full release objective.

**This checkout does not implement connected community group chat.** That conclusion comes from its actual handlers and API inventory, not from a failed static preview. Partner redemption only shows an alert; Circle posting is explicitly coming soon; the account screen navigates without authenticating. An unrelated or separately deployed backend may exist, but none is configured or consumed by these flows here. No claim is made about the health of an uninspected external service.

This was a scoped source/tool audit. No production API requests, credential-value reads, account creation, installation, paid calls, app-data changes, deployment or submission occurred. Source lines below refer to baseline `b866852`; parallel UI changes may move later line numbers. Retrieve the exact snapshot with `git show b866852:<file>`. Source-derived conclusions have high confidence; deployment configuration, signing entitlement and real-device behavior remain unverified.

## 1. Runtime and data flow that actually exists

| Area | Verified implementation | Consequence |
|---|---|---|
| Web shipping shape | `vercel.json:2–5` sets `framework: null`, output `.` and `.html` routes. No package manifest/lockfile, native project, Capacitor configuration, app manifest or service worker was found in the scoped repository inventory. | This is static HTML/CSS/JavaScript plus five Vercel API source files, not a current Next.js build. Do not copy the entire repository into a native public bundle. |
| Entry point | `index.html:19–31` is a design gallery with prototype descriptions and links. | The native entry needs an actual application start/resume flow. Bundling the present index would open the gallery. |
| Server functions | `api/chat.js`, `api/food-vision.js`, `api/food-lookup.js`, `api/nfc.js`, `api/nfc-verify.js`. | There is meaningful API code, but no account, room, message, membership or durable-record API in this checkout. Production execution/configuration was not tested. |
| AI requests | `luna-chat.js:306–314` posts typed conversation history to `/api/chat`; `api/chat.js:86–99` forwards to the declared Volcengine endpoint. `label-scan.html:448` also calls this route. | AI text/images are a network data flow. The general privacy statement that processing only happens on-device does not describe all app paths. No automatic upload of the repaired lab/journal stores was found. |
| AI demo behavior | `luna-chat.js:286–297` always uses canned responses on `localhost`/`127.0.0.1`; lines 319–333 also substitute canned content on an empty reply or failed request. `api/chat.js:58–65` has an explicit no-key demo response. | A local chat reply cannot demonstrate the live AI connection. Native localhost detection must become an explicit demo/runtime capability. Errors must not be disguised as successful personalized advice. |
| Food lookup | `nutrition-scanner.html:96–102` directly calls Open Food Facts. `api/food-lookup.js:71–88,226–278` implements barcode/manual processing; `api/food-vision.js:68–103` forwards a photo and cycle context to Volcengine. | These are separate external services from the local record flows. Native networking, consent, request validation and failure behavior need individual verification. |
| Appearance dependencies | For example, `index.html:11` and `privacy.html:11` load Google Fonts and Material Symbols from Google. | An offline native bundle must include licensed font/icon assets or tested fallbacks; the current network font request is part of the data-flow inventory. |
| PPG | `ppg.html` and `ppg.js` use browser media/canvas processing. The repaired result flow withholds rejected quality and does not automatically save a baseline. | Deterministic software checks already exist. They do not establish WKWebView camera/torch behavior, paired-reference measurement accuracy or HealthKit integration. |

The local preview deliberately excludes server API source, as recorded in `STATUS.md`. Failure of a relative API request in that preview therefore does not establish that a Vercel API is broken.

## 2. Account, partner and community findings

| Priority | Concrete source finding | Required change before calling it connected |
|---|---|---|
| P0 | `login.html:121–131` accepts email/password inputs but its buttons navigate directly to Home/onboarding. Google at lines 165–168 also navigates. Apple and password reset are `#` links at 123,136–137. `personal-info.html:240` signs out by linking to login. No session creation, verification, revocation or route authorization accompanies these controls. | Implement a real identity/session lifecycle and authorization at the data/API layer. Keep local-only access explicit until that exists; a login-looking page is not an access boundary. |
| P0 | `partner-code.html:246–252` reports success for **any nonempty input**, with no network request or membership write. Lines 87 and 242 use a fixed invite/link; `partner-connect.html:97–100` routes to that page rather than issuing a code. | Issue opaque server-generated invitations tied to the inviter, scope and expiry. Redeem once atomically; support expiry, revocation, recipient confirmation and an auditable consent grant. Do not reuse a visible constant as a credential. |
| P0 | `partner-connect.html:87–88,106–121` shows fixed days/insights counts and health updates as shared. No sending or sharing-policy implementation exists in its script imports (221–225). | Store explicit per-field sharing grants; derive the displayed partner state from actual relationships and consent. Revocation must prevent subsequent reads, including realtime subscriptions. No implicit disclosure of lab or journal records. |
| P0 | `circle.html:90–92` has literal membership/online/post counts. Its create button at 317 alerts “coming soon”; the inline script at 333–348 only changes chip selection and like icon styling. `community.html:69–73` contains Join buttons without a membership handler. | Implement authenticated membership and a durable message/post log, then connect real reads/writes and delivery state. The present pages are community interface prototypes, not a demonstrated group-chat service. |
| P0 | Circle claims active moderation (`circle.html:301`), but no report/block/moderation endpoint, queue or permission model was found. Anonymous mode at 99 only toggles a class. | Add report/block/leave controls backed by server rules and an operational moderation queue. Pseudonymous posting must remain attributable to the moderation system while hiding identity according to a documented policy. |
| P1 | `appnav.js:62–100` rewrites placeholder links by text or shows a coming-soon toast. | A reachable page or a clickable control does not prove the named action happened. Use an explicit action/route capability map for the release. The parallel shell work may revise this file. |

A minimum connected-community acceptance run requires two authenticated members and one outsider: join with a valid invite; reject expired/replayed/revoked invites; deny outsider reads/writes/subscriptions; persist and replay messages after reconnect; deduplicate retried sends using client message IDs; preserve server ordering/pagination; honor block/leave/revocation; submit and resolve a moderation report; and verify account deletion/retention behavior. Define expected group size and delivery/load targets before measuring stability. Neither source presence nor two successful messages alone establishes production reliability.

## 3. Persistence, privacy and entitlement boundaries

The repaired records are real local records with validation, not cloud records. They use `JSON.stringify` in browser `localStorage`; no application-layer encryption, user namespace, native Keychain integration, database migrations or cloud synchronization is connected to these stores.

| Record family | Current storage/implementation | Preserve during migration |
|---|---|---|
| Labs | `ovuluna_lab_records_v1`; `labs-records.js:4,67–89`; actual-value validation, edit/history/export at 133–174 | Original value, qualifier, unit, collection date, lab/assay/context, record identity and timestamps. Keep `ovuluna_labs` legacy data byte-for-byte until an explicit migration is confirmed. |
| Ovarian assessment | `ovuluna_ovarian_assessments_v2`; `ovarian-model.js:6,80–101` | Input/context, method version and unavailable-prediction status. Do not convert missing data or old heuristic outputs into a new clinical result. |
| Research PhenoAge | `ovuluna_phenoage_records_v1`; `bio-age.js:12,173–199` | Original and normalized units, collection date, method version and reproducible output. Calculation verification and clinical approval remain separate. |
| Wellness journal | `ovuluna_wellness_journal_v1`; `wellness-checkin.html:19–24` | Dated self-report, notes and updates; errors must not erase prior data. |
| Summary reads | `insights-records.js:6–9,52` | Continue reading recorded provenance rather than generating substitute values. |
| Luna conversation/credits | `ovuluna_luna`; `luna-chat.js:49–78` | Up to 20 saved messages plus client-editable credits/premium flag. This is not an enforceable paid entitlement or an account-bound private message store. |

`privacy.html:37–67` currently asserts compliance, encryption, Face ID/2FA and active cloud sync. Its toggles only switch CSS classes at line 103. Export/cache/deletion links at 72–77 have no data-lifecycle implementation; `personal-info.html:210` links “Delete My Data” to Settings. The described protections must be backed by actual implementation and reviewed operational evidence before they are represented as active. No legal compliance conclusion is made here.

**Verified API boundary defects:**

- `api/chat.js:29–56` has no session/entitlement check; its IP limiter is an in-process Map (10–19). Lines 50,70–71,93 accept a client-supplied system instruction and model. The server must own its instruction/model allowlist and enforce bounded request shape, authenticated quotas and durable rate limits before exposing a paid provider connection. CORS `*` at line 31 is not authentication. Upstream error bodies are logged at 103; review logging for health data and secret leakage.
- `api/food-vision.js:38–83` has method/size checks but no account, quota or authorization check; returned model JSON is parsed at 115–119, not clinically validated by its shape.
- `api/nfc-verify.js:29–61` grants `valid: true`/premium from a parseable token and future expiry, with no signature or database check. `api/nfc.js:59–61` derives premium from a card-type string. Neither can establish a purchase or a user entitlement.
- `premium.html:138–148` changes plan copy but has no checkout/StoreKit/receipt verification handler. Account/subscription text elsewhere must not be interpreted as proof of a working purchase system.

Four isolated reproductions confirmed the above behaviors using fictional input and a stubbed network: unsigned future NFC token accepted; synthetic premium card accepted; an unauthenticated chat request reached the stub with client-selected model/system; arbitrary partner input produced a redeemed alert. No real endpoint, token, user storage or paid API was used. Results: `native-data-reproduction.json`. These demonstrate code behavior, not exploitation of a deployed service.

## 4. Local native tooling: available versus not established

| Check | Observed result |
|---|---|
| Node / npm | Node `v24.16.0`, npm `11.13.0`; `node`, `npm`, `npx` available. |
| CocoaPods | `pod --version` → `1.16.2`. |
| Default developer selection | `xcode-select -p` → `/Library/Developer/CommandLineTools`; plain `xcodebuild -version` fails because that selection is not full Xcode. |
| Installed full Xcode | `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -version` → Xcode `26.6`, build `17F113`. |
| iPhone SDK | The same per-command override with `xcrun --sdk iphoneos --show-sdk-version` → `26.5`. |
| Simulator runtime | `DEVELOPER_DIR=… xcrun simctl list runtimes` → installed iOS `26.5 (23F77)`. The initial sandboxed read was blocked by CoreSimulator permissions; a read-only escalation succeeded. No runtime was installed or simulator booted. |
| Capacitor project/tooling | No project manifest/dependency lock, Capacitor config, iOS directory/project, entitlements or privacy manifest found in this checkout. Global npm package inventory contains no Capacitor CLI. No assumption is made about unrelated directories. |
| Not inspected | Apple Developer membership, signing identity/profile contents, reserved bundle ID, App Store Connect record, physical-device pairing or release automation. |

The global Xcode selection need not be changed to continue: use the verified per-command `DEVELOPER_DIR` for local build commands. Current Capacitor v8 documentation supports iOS 15+ and requires Xcode 26+; adding the native platform still requires the relevant package/project setup. This is tooling compatibility, not a successful app build. [Capacitor iOS documentation](https://capacitorjs.com/docs/ios)

Two predictable packaging failures should be addressed before the first native run:

1. Capacitor's documented default iOS origin is `capacitor://localhost`. Existing relative `/api/chat` and `/api/food-lookup` calls will target the bundled origin unless an explicit API base/transport is introduced; Luna's hostname branch will also choose demo replies. Bundle app assets and use a reviewed HTTPS service base with auth, explicit demo configuration and network-error states. `server.url` is documented for live reload rather than production; it should not be used as the production packaging shortcut. [Capacitor configuration](https://capacitorjs.com/docs/config)
2. Existing record functions are synchronous `getItem/setItem` consumers. Native protected storage is a separate asynchronous boundary. Add a record repository with explicit readiness/failure semantics and migrate callers deliberately; do not replace the methods with promises and let current code treat them as strings. Capacitor Preferences is for lightweight preferences, uses UserDefaults on iOS and is not a health-record database; its documentation also warns that mobile systems can clear web localStorage. Preserve preferences separately from health records and validate migration/backup behavior. [Capacitor Preferences](https://capacitorjs.com/docs/apis/preferences)

## 5. Concrete next implementation stage

**Recommended stage: deliver a locally runnable native app plus a tested record/account boundary, while continuing clinical method work in parallel.** A Swift UI rewrite would discard substantial current interface work; merely loading the hosted site would leave the runtime/data defects unresolved. Bundled Capacitor assets preserve the chosen design and allow direct testing with the available toolchain.

1. **Make capabilities truthful before packaging.** Replace fabricated connected/security/sharing/subscription states with actual capability state. Keep the intended features visible with accurate availability and preserve the full connected-product backlog; do not count unavailable states as feature completion. Inventory which routes/actions will ship and select a real app entry instead of the gallery.
2. **Create a reproducible native build boundary.** Add pinned dependencies/lockfile, a public-asset packaging script and generated output directory, Capacitor config and iOS project. Exclude Git, docs, tests, server API code and environment files from the bundle. Include an offline evidence/font strategy. Use the installed Xcode override. Exit: an unsigned simulator build launches, navigates and survives cold/offline restart with the exact source version recorded.
3. **Introduce the data/runtime contracts.** Define asynchronous record-store operations, an explicit API base, capability discovery, user-controlled export/deletion and migration versioning. Protect health records at rest with a reviewed native store; store credentials in Keychain and keep appearance preferences separate. Migrate fictional fixtures first, covering interrupted writes, malformed legacy data, duplicates, origin changes, denial and rollback. Never silently delete or overwrite existing web records.
4. **Implement identity and server authorization.** Add actual signup/sign-in/recovery/logout/deletion; authenticate every personal-data/community/paid API operation; namespace records by verified user identity. Add schema migrations and negative cross-account tests. Replace the NFC string entitlement with server-verified state and purchase verification before monetization. Harden the AI/food proxies and record their consent/data flows.
5. **Connect Partners and Circle to that boundary.** Implement the invitation/grant/membership/message/moderation contracts above, with persistent server IDs, idempotency, reconnect history and clear pending/failed states. Prove isolation and revocation with multiple test accounts, then test the agreed group-size/load target. Operational moderation and support must exist before opening a community to real users.
6. **Complete the full iOS/scoring gates.** Test the actual packaged camera/torch on supported phones and conduct the required measurement/reference validation. Add optional native health imports with consent, provenance and deduplication only after permission/revocation paths work. Resolve the clinical ovarian model and PhenoAge-method applicability/discrepancy, finish clinical citation review and complete the real-device/privacy/accessibility/release dossier. These remain required outcomes; a simulator shell or record-only UI does not satisfy the complete request.

No claim of clinical validation, stable community operation or App Store readiness follows from this audit. The immediate work is concrete and locally testable; external service provisioning, purchases, production publishing and submission remain separate outward-facing actions.
