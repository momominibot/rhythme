# Reading Apple Health and Health Connect directly

Written 21 October 2026. Companion to `docs/design/2026-10-18-health-connections.md` (the file import).

## 1. The short answer

A web page cannot reach HealthKit or Health Connect. Both live only inside native apps, so a direct
link needs the Capacitor shells: the iOS one already exists in `ios/App`, an Android one does not yet.
Inside the shell, a native read becomes one more source for the import that already ships: the same
`kinds()` list, the same picker with nothing ticked, the same `plan()` and `apply()`, the same
`source: 'apple-health'` on every entry, and the same Remove.

This branch builds the iOS slice behind a switch that is off. Health Connect is planned below and not built.

## 2. What Jamie needs on his side

### Apple (before the slice can run on a real iPhone)

| Step | Where | Notes |
|---|---|---|
| Apple Developer Program membership | developer.apple.com | Already in place (GoutBye went through App Store Connect this week). |
| Decide the real bundle ID and name | Xcode, App Store Connect | The shell is still `app.vercel.ovuluna.dev`, display name "Ovuluna Dev", start page `home.html`. Rhythme needs its own ID (for example `sg.rhythme.app`), the name Rhythme, and `appStartPath: /room.html`. Changing the ID later means a new App ID and a new app record, so pick it first. |
| HealthKit capability on the App ID | Xcode: target App > Signing & Capabilities > + Capability > HealthKit, with his team selected | With automatic signing Xcode registers the capability on the App ID and makes a profile that includes it. This repo already has `ios/App/App/App.entitlements` (`com.apple.developer.healthkit` true, `healthkit.access` empty, no clinical records) wired as `CODE_SIGN_ENTITLEMENTS`, so Xcode will see the capability as already on. Do not tick Clinical Health Records or Background Delivery; the slice needs neither. |
| App Store Connect app record | appstoreconnect.apple.com > Apps > + | Only when he wants TestFlight. A local build to his own iPhone needs only the capability and his team. |
| App Privacy answers | App Store Connect > App Privacy | Health and Fitness data: "Health" for period days and spotting; sleep fits "Health" or "Fitness" (Apple does not name sleep in either definition, so pick one and keep it consistent with the policy). Collected only if cloud backup is on (entries then leave the phone), used for App Functionality, linked to the person's account, not used for tracking. The file import already brings the same kinds in, so the answer is needed whether or not this slice ships. |
| Privacy policy URL | App Store Connect > App Information | Must name the specific health data read. `privacy.html` now has a "Health data you bring in" entry naming all three sources (Apple Health export, Google Takeout Fit, Apple Health read directly in the iPhone app). |
| Switch on | `ovu-config.js` `nativeHealth.apple: true` | Only after the steps above, in the build that goes to the phone. |

Apple's rules that bind this feature (App Review Guidelines, read 21 October 2026):

- 5.1.3(i): HealthKit data may not be used or disclosed to third parties for advertising, marketing or use-based data mining, other than improving health management or health research, and then only with permission. The app must disclose the specific health data it collects.
- 5.1.3(ii): no false data written to HealthKit, and no personal health information stored in iCloud. Rhythme writes nothing to HealthKit; its backup is Supabase in Singapore, not iCloud.
- 5.1.2(vi): HealthKit data may not be used for marketing, advertising or use-based data mining, including by third parties.
- 2.5.1: HealthKit is for health and fitness purposes and should integrate with the Health app.
- HealthKit never tells an app whether the person allowed reading (a refused type returns no samples, the same as no data). The UI must not say "you have no data"; this slice says "nothing came back" and explains both causes.

One thing to settle before the switch goes on: Luna's AI relay (paused today) sends diary text to a third-party AI service. If it is turned back on, entries that came from HealthKit must either be left out of every relay payload or be sent only after a specific permission that says so, to stay inside 5.1.3(i). The rules engine and the insight agents must be checked the same way.

### Google (Health Connect, for a later Android slice)

| Step | Where | Notes |
|---|---|---|
| Android shell | `npx cap add android` in this repo | Does not exist yet. Health Connect needs Android 9+ with the Health Connect app, or Android 14+ where it is built in. |
| Permissions in `AndroidManifest.xml` | the Android project | `android.permission.health.READ_SLEEP`, `READ_MENSTRUATION` (covers flow and period records), `READ_INTERMENSTRUAL_BLEEDING`, and `READ_HEALTH_DATA_HISTORY` if more than the last 30 days is wanted. Plus the permissions-rationale activity that shows the privacy policy, which Health Connect opens from its own screen. |
| Play Console: Health apps declaration | Play Console > App content > Health apps | Tick the health features, and for each data type give a specific justification of how it benefits the user. Request only the types the feature uses. The declaration can be reviewed again with each new version, and must be filled in again when the data types change. |
| Play Console: Data safety | App content > Data safety | Must match the privacy policy, and the policy must be the same one Health Connect links to. |
| Privacy policy | `privacy.html` | Add Health Connect by name (sleep, menstruation, spotting) when the Android slice ships. Do not name it before. |

Google Fit's APIs are being retired in favour of Health Connect, so no Fit API work; the Takeout file import stays for people with old Fit history.

## 3. Which plugin

Checked on npm and in each package's type definitions on 21 October 2026.

| Package | Version, last publish | Platforms | Sleep | Menstrual flow / spotting | Weight | Steps / workouts | Notes |
|---|---|---|---|---|---|---|---|
| `@capgo/capacitor-health` | 8.11.12, 15 Oct 2026, Capacitor >= 8 | iOS, Android | yes, with stages | **no** | yes | yes | Best maintained cross-platform plugin, but no cycle types at all. |
| `@capacitor/health-fitness` (Ionic) | 1.0.2, 7 Oct 2026, Capacitor >= 8 | iOS, Android | yes | **no** | yes | yes | Official, new in August 2026; variables are fitness, health and profile groups, no cycle types. Asks for background modes we do not need. |
| `capacitor-health` (mley) | 8.4.0, 23 Sep 2026 | iOS, Android | yes | **no** | yes | yes | Same gap. |
| `@perfood/capacitor-healthkit` | 1.3.2, Feb 2025, Capacitor 4 | iOS | yes | no | yes | yes | Unmaintained for Capacitor 8. |
| `@kiwi-health/capacitor-health-connect` | 0.0.43, 29 Sep 2026, Capacitor ^7 | Android only | yes (`SleepSession`) | **yes** (`MenstruationFlow`, `MenstruationPeriod`, `IntermenstrualBleeding`) | yes | yes | The only package with Health Connect cycle records. Peer range is Capacitor 7; the app is on 8.5.1, so it needs a test or a fork. |

No maintained Capacitor plugin reads menstrual flow from HealthKit. Rhythme's main reason to connect is
cycle data, so the iOS slice uses a small plugin that lives in the app target:
`ios/App/App/RhythmeHealthPlugin.swift` (about 100 lines, read only, three category types, no third-party
code near health data), registered by `RhythmeBridgeViewController.capacitorDidLoad`. Steps or workouts
can come later from the same plugin (`HKQuantityType(.stepCount)`, `HKWorkout`) or by adding
`@capgo/capacitor-health` next to it; Rhythme has no place for steps today, so they stay in the
"not in Rhythme yet" list.

For Android, the plan is to try `@kiwi-health/capacitor-health-connect` on Capacitor 8 first; if its
peer range blocks it, write the same kind of local Kotlin plugin (`HealthConnectClient.readRecords` for
`SleepSessionRecord`, `MenstruationFlowRecord`, `IntermenstrualBleedingRecord`) and map it the same way.

## 4. How the native read joins the existing import

```
iPhone app                                        web code (same in browser and shell)
RhythmeHealthPlugin.readSamples ──samples──▶  OvuHealthNative.read()
  {type: HKCategoryTypeIdentifier..., startDate,     │  each sample ▶ OvuHealth.appleScanner().record(a)
   endDate (local offset), value}                    │  (the same code path as a <Record> in export.xml)
                                                     ▼
                                              result {source:'apple-health', origin:'healthkit', sleep, period, spotting, ...}
                                                     │
                     You > Connect Apple Health ▶ renderImportPicker ▶ plan() ▶ apply()  (unchanged)
```

- The Swift side returns each sample shaped like an export `<Record>`: the HealthKit type identifier, the
  start and end as ISO 8601 with the offset the phone used (from `HKMetadataKeyTimeZone` when present,
  else the current zone), and the raw category value as a string. So `0` in bed, `1/3/4/5` asleep, `2`
  awake for sleep; `1` to `5` for flow (5 = none, skipped). The wall-clock rule, the night-on-its-morning
  rule, merging of watch and phone minutes, flow strength per day and "spotting on a flow day is not
  listed apart" are all inherited, and a test proves a direct read and an export of the same records give
  identical nights and days.
- `source` stays `apple-health`, so a direct read refreshes days that an earlier file import brought in,
  and Remove takes both. `origin: 'healthkit'` only changes wording ("Found in Apple Health", "Read from
  Health on this iPhone").
- Window: the last 90 days by default, capped at 366 days by both sides. The picker's own date chips still apply.
- Nothing is written to Health; the plugin asks `requestAuthorization(toShare: nil, read: ...)`.
- With `nativeHealth.apple` false, or in any browser, `OvuHealthNative.available()` is false: the You row
  is not drawn, no native call is made, and the web build behaves as before (`ovu-healthnative.js` loads and
  does nothing).

## 5. What this slice includes

- `ovu-healthnative.js`: switch check, shell detection (`Capacitor.isNativePlatform`, platform `ios`, the
  plugin in `Capacitor.PluginHeaders`, `nativePromise`), `connect()`, `read({days, now})`, `fromSamples()`.
- `ovu-health.js`: the Apple scanner gains `record(a)` (one parsed record) and `OvuHealth.HK` names the type identifiers.
- `ovu-config.js`: `nativeHealth: { apple: false }`.
- `room.js`: You > "Connect Apple Health" row (only when available), a sheet that names the three reads before
  Apple's sheet appears, progress, the honest empty message, and picker and summary wording for a direct read.
- iOS: `RhythmeHealthPlugin.swift`, `RhythmeBridgeViewController.swift`, `App.entitlements`,
  `NSHealthShareUsageDescription` in `Info.plist`, `SceneDelegate` uses the new bridge view controller.
- `privacy.html`: the "Health data you bring in" entry.
- Tests: 21 checks in `tools/test-core.js` with a fake shell (flag, detection, exact permission request, 90-day
  window, sleep stages across midnight, in-bed nights, flow strength, spotting, parity with export.xml, picker
  counts, hand-written day wins, refresh not duplicate, empty read, 366-day cap, errors, nothing called when off).

Verified on 21 October 2026: a Debug build for the iOS 26.5 simulator (Xcode 26.6) compiles, and with the switch
forced on in a local copy, Apple's Health Access sheet appears asking to read exactly Menstruation, Sleep
and Spotting. Not verified: the read after tapping Allow (the simulator has no Health data and was driven
headless), and anything on a real iPhone.

## 6. Known gaps and follow-ups

- `npm run build:native` (`scripts/build-web.cjs`) fails on main today: it rejects `.mp3` and other assets
  added since it was written. It must be brought up to date before any shell build carries the real app.
- The shell's identity (bundle ID, "Ovuluna" names in `Info.plist`, `SceneDelegate`'s privacy shield label,
  `appStartPath: /home.html`) predates Rhythme.
- The native build's CSP and `limitsNavigationsToAppBoundDomains` need checking against the Supabase calls
  before sign-in and backup can work in the shell.
- Weight and mindful minutes from HealthKit, and steps or workouts, are deliberately left out of this slice.
