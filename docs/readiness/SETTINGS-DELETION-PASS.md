# Settings deletion pass — 11 September 2026

## Delivered behavior

- Settings exposes **Delete my data** and **Delete my account** under Your data & account, immediately after the page introduction. The same plum/lunar palette, shared header controls and bottom navigation are retained.
- The data entry opens Privacy’s local inventory and focuses its heading. Selection is explicit and itemized. Select all includes only enumerated recognized stores. Clear selection, Cancel and Escape leave stored records unchanged. Export first prepares an exact raw JSON copy without deleting; review and confirmation are still required afterward.
- Deletion checks that all selected raw values still match the reviewed snapshot before any removal, reports partial failures, and preserves unselected and unrecognized stores. No actual user data was erased for testing.
- The account entry opens the explanation **No connected account in this build**. It does not report success, call a pretend deletion endpoint, or equate local cleanup with server-account deletion. Current `login.html` actions navigate between pages; they do not create a verified account. The server API authorization helper is not an identity issuer or account lifecycle service. No actual provider credentials, account or remote deletion was exercised.
- Adjacent Settings claims now match this implementation: no fabricated person, paid membership, connected device, active reminder or account-session sign-out. The life-stage appearance preference is still editable with keyboard buttons and storage-failure feedback. Personal Info’s deletion link points directly to reviewed deletion; other legacy profile screens still require a separate audit.

## Verification

`node scripts/check-privacy-luna.cjs` passes 11 pure storage/link groups. They cover exact malformed/raw export, recognized keys, deletion scope, explicit legacy selection, stale snapshots, missing/unauthorized selection, partial failure, duplicate input and generated Luna guide destinations.

The browser mode passes in a new Chromium context against loopback source. Synthetic malformed lab records, legacy chat and an unrelated key were used. External services and `/api/` calls were blocked; API request count was zero. Verified:

- Settings → data/account destinations, heading focus and honest account-unavailable copy, without erasing records;
- select-all/clear, exact JSON export and browser download;
- disabled confirmation, Cancel, Escape/focus return and Export first without deletion;
- actual scoped deletion, stale-review rejection and forced single-store removal failure with accurate remaining data;
- native export limitation, offline Luna, source dialog/focus, hostile text safety and legacy preservation;
- 320/390px light/dark Settings and guide panels at the largest in-app text size and reduced motion.

Receipt: `settings-deletion-checks.json`. Screenshot `/private/tmp/ovuluna-settings-delete-320.png` uses intentionally blocked external fonts, so legacy Material Symbol text fallbacks are visible. Native bundled-font and real-device checks are handled separately; this test does not establish native accessibility conformance or encrypted storage.

## Remaining account and deletion boundaries

Account deletion remains a production gate until a real account service exists. Integration must use the authenticated account identity, review the records that will be removed, require intentional confirmation, revoke sessions/identity-provider tokens where applicable, and verify the server-side result. It must distinguish a request still processing from completed removal, disclose actual retention exceptions, and handle external subscription cancellation accurately. Community posts, uploads and backups need explicit service policies and deletion handling when those services are implemented.

[Apple’s account-deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/) was read on 11 September 2026. For apps supporting account creation, Apple requires an in-app path to initiate account deletion, not merely temporary deactivation. The path should be easy to find and communicate completion timing and subscription handling. This local-only control is not a claim of App Store readiness.

Local controls cannot delete other origins/installations, external services or previously exported files. The reproduced legacy Acupoints/Hydration stale-page restoration paths were subsequently fixed and passed 14 actual-inline-script regression groups; see `STALE-WRITERS-PASS.md`. Writers reject changed/deleted storage before saving cached content. Local storage still has no atomic cross-context transaction, and other tabs should be reloaded before editing. This does not establish full app-wide deletion durability under simultaneous writes.

## Final-source browser recheck

The full isolated suite was rerun after root’s native-discovered Luna focus fix and guide-link spacing adjustment. It passes with an added assertion that opening Luna focuses **Close**, not the input; closing after input focus returns focus to the Luna button. This keeps the initial browser flow ready for reading. Desktop Chromium does not model the iOS software keyboard, so the native keyboard/navigation result remains in root’s native receipt. The corrected Settings wellness destination is `wellness-checkin.html`. `git diff --check` passes on this scope.
