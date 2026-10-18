# Health connections: what ships today, what a live link would take

Written 18 October 2026 for Rhythme (code name Ovumind). Companion to the import that shipped
the same day (`ovu-health.js`, the You tab's "Import from Apple Health or Google" sheet).

## 1. What is built now

A file import that runs entirely on the phone. Nothing is uploaded.

| Source | What the person does | What Rhythme reads | What lands in the diary |
|---|---|---|---|
| Apple Health | Health app > picture or initials > Export All Health Data > save export.zip to Files > choose it in You | `export.xml` inside the zip (or the bare xml), scanned record by record | Sleep nights (`HKCategoryTypeIdentifierSleepAnalysis` asleep stages, one entry per morning), weigh-ins (`HKQuantityTypeIdentifierBodyMass`, kg or lb to kg), period days (`HKCategoryTypeIdentifierMenstrualFlow` 1 to 4; 5 "none" skipped) |
| Google (Fit) | takeout.google.com > Deselect all > tick Fit > Export once > download the zip > choose it in You, or pick the files from its Fit folder | `Takeout/Fit/All Sessions/*.json` sleep sessions and `Takeout/Fit/Daily activity metrics/*.csv` weight columns | Sleep nights and weigh-ins. Fit's Takeout folder carries no period data |

Rules the import keeps:

- A day already written by hand (or by any other source, like the scale) is never replaced. Imported entries carry `source: 'apple-health'` or `'google-fit'`; a re-import refreshes those in place; "Remove imported data" removes only those two sources.
- Nights that cross midnight belong to the morning's date. Bedtime is the first asleep start, wake the last asleep end, hours are the asleep minutes added up (an Apple Watch and an iPhone writing the same minutes are merged, not doubled). A gap over four hours starts a new session; when two sessions share a morning the longer one is the night and the rest are counted as naps. An iPhone without a watch only writes time in bed; those nights are kept and labelled.
- Big exports stay light: the file is read in 2 MB slices, `export.xml` is scanned with a per-`<Record>` regex and a carry buffer (never one string), and zips are read by central directory with one entry inflated at a time through fflate 0.8.2 (`assets/vendor`, MIT, loaded only when a zip is chosen). Everything Rhythme has no place for (steps, heart rate and so on) is counted by kind and named in the summary.
- The sheet shows two cards with the steps in plain words, a progress bar, then a summary: nights, weigh-ins, period days, date range, what was left alone, what was skipped, and the line that the file never left the phone.

Tests: parser units in `tools/test-core.js` (fixtures in `tools/fixtures/apple-export-mini.*`, `takeout-fit-mini.zip`, `fit-*.{json,csv}`, including a night across midnight and a tag split across chunks) and a smoke check in `tools/e2e_smoke.py` that imports the xml and the Takeout zip in headless Chromium at 390 px and removes them again.

Known limits of the file route:

- It is a snapshot. New nights appear only after the next export; there is no background sync.
- Google documents neither the Takeout Fit JSON nor the CSV layout, so the reader finds fields by name (`fitnessActivity`, `startTime`, `endTime`, `segment`, `Average weight (kg)`) and ignores what it cannot place. The fixture follows real exports seen in the wild; the first real Takeout from Jamie's phone is the test that matters.
- Health Connect (Android 14 and later, the successor to Google Fit) has no file export a person can open. Its only built-in route is a scheduled backup zip to a cloud storage provider, meant for restoring onto another phone (Google: "Back up and restore your Health Connect data", support.google.com/android/answer/15323271). Rhythme does not read that file.

## 2. The native route: a shell app around the same web app

HealthKit and Health Connect are only reachable from native apps. The smallest honest way to get there is a Capacitor shell (capacitorjs.com): the existing static PWA runs inside a WebView, and two small native plugins hand it sleep, weight and menstrual flow records on request, which it writes through the same `OvuStore.addMany` the file import uses, with sources `apple-health` and `health-connect`. The repo already carries `capacitor.config.json` and an `ios/` folder from an earlier experiment; nothing in them is wired to health data.

### iOS (HealthKit)

- Apple Developer Program membership: US$99 a year (developer.apple.com/programs, "$99 annual membership"). Required for the HealthKit entitlement, TestFlight and App Store distribution. This is Jamie's purchase; nothing here creates an account.
- Xcode project with the HealthKit capability, `NSHealthShareUsageDescription` (and `NSHealthUpdateUsageDescription` only if we ever write back; we would not), and a read-only request for `HKCategoryTypeIdentifierSleepAnalysis`, `HKQuantityTypeIdentifierBodyMass`, `HKCategoryTypeIdentifierMenstrualFlow`. HealthKit works on iPhone only, never on the web.
- App Review Guideline 5.1.3 Health and Health Research (read 18 October 2026): health data may not be used or disclosed for advertising, marketing or other use-based data mining; apps must disclose the specific health data collected from the device; apps must not write false data into HealthKit and may not store personal health information in iCloud. 5.1.1 requires a privacy policy link in App Store Connect and inside the app, stating what is collected, how, every use, retention and deletion, and how to withdraw consent. Rhythme's local-first design fits this, but the accounts and cloud backup work in the parallel session must keep health records out of any iCloud-backed store and the privacy notes must name HealthKit explicitly before release.
- App Store review itself, plus the App Privacy "nutrition label" answers (Health & Fitness data, linked or not linked, not used for tracking).

### Android (Health Connect)

- Google Play Console developer account: US$25 one-time registration fee (support.google.com/googleplay/android-developer/answer/6112435), identity verification (government ID and a card under the legal name), and for new personal accounts a verified Android device through the Play Console app. Jamie's purchase and identity, not something a session should do.
- Health Connect SDK (`androidx.health.connect:connect-client`), `android.permission.health.READ_SLEEP`, `READ_WEIGHT`, `READ_MENSTRUATION`, the `ACTION_SHOW_PERMISSIONS_RATIONALE` activity (Android 13 and lower) and the `VIEW_PERMISSION_USAGE` alias (Android 14 and later) that shows the same privacy policy as the Play listing. Health Connect is part of Android from 14; on 9 to 13 it is a separate app from the Play Store.
- Play Console "Health apps" declaration form on the App content page: for each data type, a clear justification of how the data benefits the user; request only the minimum; the privacy policy on the Play listing must be the same one shown from Health Connect. Access is allow-listed per package after review; without approval the person sees "this app can't access Health Connect". Re-submit when data types change. Timelines are not published by Google.
- Play's Data safety section and the User data and Permissions policies (health data is "personal and sensitive user data").

### Shared work for either platform

- A privacy policy page that names HealthKit and Health Connect, the three data types, on-device storage, no advertising use, and how to delete (the room's "Delete everything" already covers local data).
- Consent notice v3 in the room (current is v2) with a separate, default-off choice for reading health data, and the same "your own entries win" rule.
- Background refresh is optional and adds review surface (HealthKit background delivery, Health Connect changes API). A manual "Refresh from Health" button in the same You sheet is enough for a first release.
- Store assets, age rating (Health & Fitness, 13+), screenshots, and the TestFlight or internal-testing round with Jamie's phone.

### Rough cost and time

| Item | Money | Effort |
|---|---|---|
| Apple Developer Program | US$99 per year | Enrolment takes a day or two to verify |
| Google Play Console | US$25 once | Identity and device verification, a few days |
| Capacitor shell + two plugins + consent v3 + policy | 0 | About two focused weeks of build, then review rounds; Health Connect's form review is the slowest unknown |
| Ongoing | US$99 a year | Keep up with HealthKit and Health Connect SDK changes; re-submit the declaration when data types change |

Nothing in section 2 is built. No developer accounts, certificates, bundle identifiers, keys or declaration forms were created or submitted while writing this note, and none should be without Jamie doing the purchase and identity steps himself.

## 3. Sources read on 18 October 2026

- developer.apple.com/programs ($99 annual membership) and developer.apple.com/support/compare-memberships
- developer.apple.com/app-store/review/guidelines (5.1.1, 5.1.3)
- support.google.com/googleplay/android-developer/answer/6112435 (US$25 one-time fee, verification)
- developer.android.com/health-and-fitness/guides/health-connect/publish/request-access (declaration form)
- developer.android.com/health-and-fitness/guides/health-connect/develop/get-started (manifest, versions, rationale activity)
- support.google.com/android/answer/15323271 (Health Connect backup to cloud storage, Android 14 and up; zip for restore, no local or manual export)
- fflate 0.8.2 from the npm registry, MIT, sha256 of umd/index.js c3b34f2e9f5e74d4d7d64e01cac7a0c01954c6c406414d42185c7b53d6875ddf
