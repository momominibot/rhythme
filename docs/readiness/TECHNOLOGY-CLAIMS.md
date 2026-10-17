# Technology education claim corrections

Prepared 11 September 2026 in `/Users/michiyomimi/Desktop/ovuluna-doubao`, starting from `b866852`. Scope: `learn-ppg-tech.html` and `learn-wearables.html`. No deployment or clinical validation.

## What changed

Both articles retain the Doubao app shell, article styling, fixed navigation and existing Higgsfield watercolor technology icon. Short visual steps, paired metric cards and one expandable arithmetic example replace the lengthy unsupported product descriptions. Source controls are explicit `button.qi[data-evidence]` elements. Links lead to the working camera check, local observations/journal, related education and original sources; no connection button implies an integration exists.

| Removed claim | Replacement and reasoning |
| --- | --- |
| Named OB-GYN review | Source-check date and an explicit statement that no clinician endorsement is claimed. No review record supports the named endorsement. |
| Ovuluna ring, proprietary multi-wavelength architecture, patents and phase-locked ML | Actual local source follows a smartphone red-channel signal (`ppg.js`). No ring hardware or trained model is established here. |
| Ovuluna internal 1,200-cycle trial; ≥96% ovulation accuracy; ±1.2 bpm/±3.8 ms/±1.1 breaths per minute | Removed rather than borrowing another device's accuracy. Published studies are described with their specific purpose and scope. No corresponding Ovuluna trial artifact exists in this inspected continuation. |
| PPG skin-temperature measurement, definite hormone transitions and nocturnal metrics | The camera article explains only pulse rate and pulse-rate variability. It makes no ovarian-phase, temperature, respiratory-rate or treatment inference. |
| Active Oura/WHOOP/Apple imports and cross-device synthesis | Current status is **not connected**. Separate current platform routes and authorization are explained without claiming they are implemented. |
| HRV as one interchangeable cross-device number | Distinguishes HealthKit SDNN, Health Connect RMSSD, camera PRV, source and recording context. Separate series are a stated display recommendation, not a clinical threshold. |

## Evidence and verification

Primary study abstracts were read from PubMed; the Bae open-access article was also retrieved. Official platform descriptions and API definitions were independently retrieved. These checks support the limited statements below, not the performance of Ovuluna.

- [Bolkhovsky, Scully & Chon, 2012](https://pubmed.ncbi.nlm.nih.gov/23366214/), DOI `10.1109/EMBC.2012.6346253`: fingertip smartphone video contains a pulsatile component. The research compared phone-derived measurements with ECG; it used specific phones and protocols.
- [Plews et al., 2017](https://pubmed.ncbi.nlm.nih.gov/28290720/), DOI `10.1123/ijspp.2016-0668`: confirmed **29 healthy participants**, **five-minute resting recordings**, guided/normal breathing and RMSSD comparison with ECG. No transfer of the study's agreement results to Ovuluna, ovarian-age estimation or ovulation confirmation.
- [Bae et al., 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9053269/), DOI `10.1038/s43856-022-00102-x`: confirmed **95 participants analyzed in the heart-rate study**. Its fingertip/rear-camera heart-rate method is distinct from its front-camera respiratory method. The article does not present this as an Ovuluna HRV validation study.
- [Heathers, 2013](https://pubmed.ncbi.nlm.nih.gov/23751411/), DOI `10.1016/j.ijpsycho.2013.05.017`: optical pulse-to-pulse variability is an approximation to an ECG-derived series; its comparison depended on correction and experimental conditions.
- [Apple HRV SDNN definition](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/heartratevariabilitysdnn) and [Android RMSSD record definition](https://developer.android.com/reference/kotlin/androidx/health/connect/client/records/HeartRateVariabilityRmssdRecord): verified the different named calculations. The displayed example uses three fictional pulse intervals, clearly labelled; the arithmetic gives √1000 ≈ **31.6 ms**.
- [HealthKit authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data) and [Health Connect setup](https://developer.android.com/health-and-fitness/health-connect/get-started): individual data-type permissions and native app setup. Apple also documents that an app cannot generally distinguish denied read permission from missing readable samples; the article therefore does not interpret missing records as a health measurement.
- [Oura authentication](https://cloud.ouraring.com/docs/authentication), [WHOOP OAuth](https://developer.whoop.com/docs/developing/oauth/) and [Google Health API](https://developers.google.com/health): account-based authorization is documented. Google Health API is included separately from on-device Health Connect, avoiding the outdated assertion that Google offers no cloud health route.

## Product-source checks

Read the current `ppg.html` and `ppg.js`: a 60-second page measurement setting; red-channel extraction; rate from detected intervals; RMSSD arithmetic; rejected outputs withheld; interrupted finger contact discards acquisition; no diagnostic mapper or automatic fasting/phase write. These are code observations, not proven camera accuracy. No relevant provider import implementation was found in the inspected API source. Root's broader integration review remains authoritative for release readiness.

## Integration and checks

New source records were merged into `evidence-db.js` by the parent. Keys: `camera-ppg-study-scope`, `wearable-data-permissions`, `hrv-source-methods`. Shared evidence files were not edited in this subtask. Each entry includes sources, review date, method and limitations; official-documentation years are labelled as access years.

- Both HTML documents parse with one H1, semantic section headings and a main landmark.
- All local `src`/`href` targets exist; no bare `#` action or script link remains.
- Every evidence trigger is a typed button with class `qi`, accessible label and a matching supplied source record.
- Removed-claim checks and `git diff --check` pass.
- RMSSD worked-example arithmetic independently checked: intervals `[1000,1020,980]` produce approximately `31.6227766 ms`.
- The new content adds no custom JavaScript or storage access. The expandable example uses native `<details>`.

Parent subsequently checked the merged preview in the browser: camera guide, expanded worked example, camera source popup/Escape/focus restoration, navigation to wearables and its source popup at 320px/A++. No device validation or full clinical review of the remaining library is claimed.
