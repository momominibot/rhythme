# Reading Apple Health and Health Connect directly

Written 21 October 2026. Companion to `docs/design/2026-10-18-health-connections.md` (the file import).

## 1. The short answer

A web page cannot reach HealthKit or Health Connect. Both live only inside native apps, so a direct
link needs the Capacitor shells: `ios/App` (already there) and `android/` (added on this branch with
`@capacitor/android` 8.5.1). Inside a shell, a native read becomes one more source for the import that
already ships: the same `kinds()` list, the same picker with nothing ticked, the same `plan()` and
`apply()`, and the same Remove. iPhone entries carry `source: 'apple-health'` like the export file; Health
Connect entries carry `source: 'google-fit'`, the source Google's data already uses (see section 4).

This branch builds both slices, each behind its own switch, both off.

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

### Google (before the Android slice can reach real users)

| Step | Where | Notes |
|---|---|---|
| Android shell | `android/` in this repo | Done on this branch. `minSdkVersion` is 26 (the Health Connect client needs it); Health Connect itself runs on Android 9+ with the Health Connect app, and is built into Android 14+. App ID is still `app.vercel.ovuluna.dev`; pick the real one before the Play app record exists, because it cannot change afterwards. |
| Permissions in `AndroidManifest.xml` | `android/app/src/main/AndroidManifest.xml` | Done: `READ_SLEEP`, `READ_MENSTRUATION` (covers flow and period records), `READ_INTERMENSTRUAL_BLEEDING`, `READ_HEALTH_DATA_HISTORY` (only requested when the phone's Health Connect supports it), the `ACTION_SHOW_PERMISSIONS_RATIONALE` filter on MainActivity and the `VIEW_PERMISSION_USAGE` activity alias for Android 14+. Either one opens `privacy.html` in the app (`MainActivity.showPrivacyIfAsked`). |
| Play Console developer account and app record | play.google.com/console | Jamie's account exists. Creating the app record and uploading a signed bundle is his step. |
| Play Console: Health apps declaration | App content > Health apps | Tick sleep and cycle tracking, and for each of the three data types plus history give a specific reason ("shows your sleep and period days in your Rhythme diary when you choose to bring them in"). Request only these. Re-declare whenever the types change; Google may review again with each version. |
| Play Console: Data safety | App content > Data safety | Health info (sleep, cycle) collected only when cloud backup is on, for app functionality, not shared, deletable. Must match the privacy policy, and the policy must be the same one Health Connect links to. |
| Privacy policy | `privacy.html` | Done: the "Health data you bring in" entry names Health Connect and what is read. |
| Switch on | `ovu-config.js` `nativeHealth.android: true` | Only in a build for testers after the declaration is accepted. |

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

For Android the same reasoning won: `@kiwi-health/capacitor-health-connect` has the cycle records but
declares Capacitor 7, and pulling an unmatched third-party package into the path of menstrual data was
not worth it. `android/app/src/main/java/app/vercel/ovuluna/dev/RhythmeHealthPlugin.kt` (about 170 lines,
Kotlin, `androidx.health.connect:connect-client` 1.1.0, the current stable release) answers to the same
`RhythmeHealth` name with the same three methods and is registered in `MainActivity` before the bridge
starts. It reads `SleepSessionRecord`, `MenstruationFlowRecord`, `MenstruationPeriodRecord` and
`IntermenstrualBleedingRecord`, pages through every result, and returns the records as Health Connect
describes them; the mapping lives in JavaScript where it is tested.

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
- Health Connect mapping (`OvuHealthNative.fromHealthConnect`): sleep stages light, deep, REM and plain
  sleeping become asleep; awake, awake in bed and out of bed are dropped like Apple's awake; an unknown stage
  and a session with no stages at all count as time in bed, so they are labelled "time in bed" rather than
  claimed as sleep. Flow light, medium, heavy keep their names, unknown becomes "not recorded". A
  `MenstruationPeriodRecord` span (some apps write only these) marks each day it covers as not recorded,
  capped at 20 days, and never weakens a day with recorded flow.
- Health Connect, unlike HealthKit, says which permissions were granted. Types not allowed are not read and
  the picker title says how many of the three were allowed. Without "past data" Health Connect shows apps only
  the last 30 days; the picker then says "last 30 days" instead of 90.
- Source: Health Connect entries use `google-fit`, which the store, journal, rewards, Luna's parser and the
  two team dashboard SQL functions already treat as imported Google data. A new source name would have to be
  added in nine files and two live migrations; the person-facing words say "Health Connect" from
  `result.sourceLabel`, and `plan()` writes "From Health Connect" in each entry's note.
- With `nativeHealth.apple` false, or in any browser, `OvuHealthNative.available()` is false: the You row
  is not drawn, no native call is made, and the web build behaves as before (`ovu-healthnative.js` loads and
  does nothing).

## 5. What the slices include

- `ovu-healthnative.js`: switch check, shell detection (`Capacitor.isNativePlatform`, platform `ios`, the
  plugin in `Capacitor.PluginHeaders`, `nativePromise`), `connect()`, `read({days, now})`, `fromSamples()`.
- `ovu-health.js`: the Apple scanner gains `record(a)` (one parsed record) and `OvuHealth.HK` names the type identifiers.
- `ovu-config.js`: `nativeHealth: { apple: false, android: false }`.
- Android: `@capacitor/android` 8.5.1, `android/` from `cap add android`, Kotlin 2.2.21 Gradle plugin,
  `connect-client` 1.1.0, coroutines 1.10.2, `minSdkVersion` 26, the four read permissions, the rationale
  intent filter and alias, `RhythmeHealthPlugin.kt`, and `MainActivity` registering it.
- `room.js`: You > "Connect Apple Health" row (only when available), a sheet that names the three reads before
  Apple's sheet appears, progress, the honest empty message, and picker and summary wording for a direct read.
- iOS: `RhythmeHealthPlugin.swift`, `RhythmeBridgeViewController.swift`, `App.entitlements`,
  `NSHealthShareUsageDescription` in `Info.plist`, `SceneDelegate` uses the new bridge view controller.
- `privacy.html`: the "Health data you bring in" entry.
- Tests: 21 checks in `tools/test-core.js` for iOS and 12 for Android with fake shells. Android: the switch,
  per-platform switches, the exact permission request, stages into one night, a stage-less session as time
  in bed, flow strength with a period span, spotting, the Health Connect note, period-span day counting and
  cap, reading only allowed types with the 30-day notice, and nothing read when nothing is allowed. iOS (flag, detection, exact permission request, 90-day
  window, sleep stages across midnight, in-bed nights, flow strength, spotting, parity with export.xml, picker
  counts, hand-written day wins, refresh not duplicate, empty read, 366-day cap, errors, nothing called when off).

Verified on 21 October 2026: `./gradlew assembleDebug` builds the Android app with the plugin (Java 21, SDK 36).
On an Android 15 emulator (Google APIs image, Health Connect built in) with the switch forced on in a local
copy, tapping through showed Health Connect's onboarding, then its own screen asking to read exactly
Menstruation, Sleep and Spotting, then the separate past-data screen. With the three allowed and past data
refused, the plugin reported all three granted and `history: false`, and the three reads came back without
error (empty: the emulator holds no health data). That run caught a real bug the unit tests could not:
Capacitor's `PluginCall.getDouble` returns null for whole-number epoch milliseconds, so every read was refused
as "window must be under a year"; the plugin now reads any `Number`. Records with real data in them have
not been read on Android yet.
A Debug build for the iOS 26.5 simulator (Xcode 26.6) compiles, and with the switch
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
