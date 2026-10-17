# Local entry and preferences audit

Completed locally 1 October 2026. This is a truthful local recording/learning flow, not a connected-account release. Production was not changed.

## Defects found and repaired

The prior candidate’s email/password and Google controls navigated without verifying identity; Apple and recovery were dead links. A separately checked newer live script instead wrote an `ovuluna_auth` object with `loggedIn: true` after a Terms checkbox. Neither behavior creates a verified server session. The API introspection boundary validates tokens from an external service when configured; it does not create accounts or provide account lifecycle.

- `login.html` now offers explicit device/browser-local access and optional learning setup. It collects no email/password and does not write a pretend signed-in state.
- `personal-info.html` replaces fabricated customer, Premium, device, encryption, reminder and password claims with a real optional nickname form and links to actual record/appearance controls.
- `local-preferences.js` uses the already inventoried `ovuluna_preferences_v1` key. Saving/editing/restoring retains unknown fields and unrelated/legacy bytes, refuses damaged or newer data, detects changed/deleted saved data, verifies persistence and retains the draft after failure. No access, billing or clinical interpretation is attached to a nickname.
- `onboarding.js` now refuses to advance or route to Home when persistence fails. It restores usable existing answers, preserves unknown fields, rejects damaged/newer data and stale writes, and shows read/write failure while retaining the page draft. On completion failure, in-memory completion flags are rolled back.
- The privacy inventory includes actual onboarding, language, units and legacy sign-in-appearance keys. Each is reviewable/exportable/deletable by exact key. The `ovuluna_auth` label explicitly says it is not a verified account. Opening pages does not erase legacy records.
- `index.html` no longer advertises working social login, purchase plans or a free trial.

## Validation and limits

`OVULUNA_JSDOM_PATH=/Users/michiyomimi/Desktop/ovuluna/node_modules/jsdom node scripts/check-entry-preferences.cjs`: 12 isolated groups pass, including actual save/reload/edit/restore, unknown-field preservation, corruption, denied writes, stale/deleted data and completion failure/retry. A navigation spy captures the completion decision in those tests. It is not a browser or external account test. Receipt: `entry-preferences-checks.json`.

`node scripts/check-privacy-luna.cjs`: 14 pure storage/link groups pass, including new inventory export and reviewed scoped deletion. No Playwright/browser option, network or real user storage was used for this pass. Syntax and changed-file whitespace checks pass.

Records remain browser-origin localStorage. There is no account isolation, protected record repository, real signup/login/recovery/logout, verified subscription or server-account deletion here. Existing account-deletion copy remains honest about that absence. A future provider integration needs verified session identity, authorized per-user record operations, revocation/deletion and cross-account negative tests. A navigation click or client-side loggedIn flag cannot satisfy those requirements.
