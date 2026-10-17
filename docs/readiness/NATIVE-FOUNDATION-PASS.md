# Local native foundation — 11 September 2026

Working branch: `codex/doubao-continuation`; baseline `3c6fefb`. This pass adds an unsigned iOS development shell around the existing Doubao design. It is not a production release, clinical validation or App Store submission.

## Build and runtime boundary

- Pinned Capacitor core/iOS/CLI 8.5.1; Node >=22; deterministic public asset builder with separate web/native targets. `npm run build` prepares web assets; `npm run native:sync` prepares the native target and syncs iOS.
- Generated `www` includes only root public HTML/CSS/JS and allowlisted assets. API handlers, docs, credentials, native source and dependencies are excluded. A size/SHA-256 manifest records source revision and dirty state; the checker verifies both the manifest and the actual disk inventory, refusing extra, missing, altered or symbolic-link assets.
- Newsreader, Manrope, Material Symbols and the two existing animation runtimes are pinned and bundled with licenses. Native pages require no remote font or script load. Native CSP restricts network connections to self; legacy inline handlers/styles still require `unsafe-inline` and should be migrated before stricter policy is claimed.
- The development app launches bundled `/home.html` at `capacitor://localhost`. No remote live reload, backend URL, broad navigation allowlist, HTTP override or production credential is configured. Native source links still require connectivity and have not had a complete external-link UX review.
- Bundle `app.vercel.ovuluna.dev`, display name **Ovuluna Dev**, iOS 15 minimum. Placeholder native icon/splash remain. Camera purpose string describes actual pulse/scan entry points; camera hardware validation is pending.
- `SceneDelegate` overlays a system-colored Ovuluna screen when inactive to obscure app-switcher snapshots. This is visual shielding, not authentication, storage encryption or biometric unlock. Its background snapshot behavior still needs real-device verification.
- Privacy manifest reflects this offline development shell, not a completed production privacy review. SDK manifests are retained. No final export-encryption declaration is asserted; signing, App Store identifiers, entitlement and legal/privacy answers remain release work.

## Integrated native UI fixes

The first installed simulator build exposed a collapsed evidence reading area: body height 32px. An isolated WKWebView fixture proved that `flex: 1 1 auto` preserves a content basis inside the auto-height sheet while retaining the max-height and scroll behavior. The actual shared evidence stylesheet now uses that fix. Its final-app integration is verified separately below.

Scoped `touch-action: manipulation` on the theme/font controls is intended to prevent rapid double-tap zoom while keeping app text enlargement and pinch zoom enabled. This is a scoped control fix, not full native Dynamic Type support.

## Dependency review

The saved npm audit reported no high/critical advisories and three moderate entries in one development-only dependency chain: Capacitor CLI → xcode → uuid 7. The [uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) concerns buffer bounds in v3/v5/v6 with a supplied buffer. The installed xcode caller uses `uuid.v4()` for project IDs; no affected invocation was found in that caller. These CLI dependencies are excluded from public/native assets. No untested dependency override or CLI downgrade was applied. The audit is not clean; review a compatible upstream fix before release and rescan the exact release lockfile.

## Verification

Final unsigned Xcode build succeeded. The isolated **Ovuluna Development QA** simulator (iOS26.5 / Xcode26.6) passed **two native flows with zero failures**, 67.935 seconds. Receipt: `native-verification.json`; exact generated asset inventory: `native-tested-manifest.json`; reproducible XCTest source and seven screenshots: `native-ui/`. The manifest accurately records the parent revision plus a dirty working tree at build time; the source was committed after verification.

Verified rapid A→A++ double-taps without WebView expansion, offline Luna topic/close then Learn navigation, article and evidence access, physical scrolling to the ACOG source and limitations, A++ portrait/landscape bounds and screen capture, cold-restart appearance persistence, Settings deletion review/disabled confirmation/Cancel, and the truthful unavailable-account screen. Evidence body now measures **652px in portrait and 251px in landscape**, replacing the reproduced 32px collapse. Final landscape screenshot uses the device screen; the earlier application-only screenshot was cropped by the capture API and is not the final visual evidence.

The first integrated run found a native navigation failure after Luna automatically focused its question input. Luna now opens with focus on Close, so people can read and choose a topic without an unsolicited keyboard; closing blurs input and restores the launcher with `preventScroll`. The same native sequence and final isolated browser suite then passed. Guide source and article links also have their own visual rows.

Settings tests canceled native deletion. Actual removal, export-first, stale-review refusal, partial failure and unknown/legacy preservation were tested with synthetic browser/storage fixtures; no real user's records were deleted. Fourteen additional regression groups prevent the two reproduced legacy stale-tab writers from restoring deleted data. The storage layer is still nontransactional.

Web and native builds each include 76 pages and 228 manifest files. Final source and built-web route checks found 825 local page links, zero missing targets or syntax failures, and two explicitly unresolved computed references. The actual bundle checker also rejected a synthetic unmanifested file, which was immediately removed. API22, Privacy/Luna11, stale-writer14, Bio-Age20 and PPG9 regression groups pass; the three independent PhenoAge reference comparisons also pass. These are separate bounded suites, not a full clinical or end-to-end account test.

To reproduce native checks, copy `native-ui/` to a temporary working directory, run XcodeGen with its `project.yml`, install the built development app on a dedicated simulator, and run the OvulunaSmoke scheme against that simulator. The tests intentionally target only `app.vercel.ovuluna.dev`; do not point data-changing QA at a personal installation. Retained `.xcresult` bundles are in `/private/tmp/ovuluna-native-smoke/`.

## Remaining production requirements

Real account creation/session/revocation/deletion and per-user authorization; protected health-data persistence and complete cross-tab deletion audit; community membership/message delivery/moderation; HealthKit/Health Connect and native export sharing; deployed API verification, consent and durable quotas; complete source review and a validated ovarian endpoint; physical-phone PPG/ECG validation; all-route accessibility, VoiceOver and Dynamic Type; signed release artwork, privacy declarations and exact-build review dossier. These remain substantive work, not tasks closed by the simulator build.
