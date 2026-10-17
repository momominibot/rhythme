# Ovuluna persona and record journey review

Local review, 1 October 2026. **deploy_needed**. No production change.

## What was exercised

The live entry screen at `https://ovuluna.vercel.app/login.html` was opened and Continue with Email was attempted. It stopped at the agreement gate. The public inline handler was then read: its social/guest paths write an `ovuluna_auth` browser flag and navigate to onboarding; they do not verify an identity or create a server session. No Terms were accepted, credentials entered, account created or production record changed. This is a real-account acceptance failure, not a successful sign-in test.

The repaired local entry collects no credentials or impersonates OAuth. Continue on this device was clicked and reached Home. Five separate, newly created localhost origins provided storage isolation for fictional QA records. They are separate browser origins, **not authenticated users or proof of per-account isolation**.

| Fictional context | Actual UI actions | Verified after reload/edit |
| --- | --- | --- |
| Early menstrual years, port 4197 | Saved bleeding on 22 September; changed Moderate to Light. Saved and edited the wellness journal. | One Light-flow observation; journal Energy changed Low to Some; both present in Understand my records. |
| Trying to conceive, port 4198 | Saved waking oral temperature and a qualitative positive LH result. Edited temperature 36.5 to 36.6°C. Saved AMH 2.4 and edited to 2.7 ng/mL, collection 25 September. | Two observations and one lab; original dates/units retained. No ovulation confirmation or fertility probability. Ovarian-reserve source dialog opened and closed with Escape. |
| After pregnancy, port 4199 | Saved Light flow, then changed to Spotting; explicitly selected Postpartum and Breastfeeding, first full-flow day No. Saved Home sleep 3.5 hours and edited to 4 hours. | Context and spotting preserved; summary and Sleep page display 4 hours/Poor, absent times stay Not recorded. No new-cycle inference. |
| Perimenopause, port 4200 | Saved FSH 12 and edited to 13 IU/L, collection 20 September. Saved journal with sleep/hot-flush context; edited Energy Low to Some. | Lab and journal remain dated, separate observations. Reading context displays assessment limits, not a diagnosis from one FSH value. |
| After menopause, port 4201 | Saved and edited spotting dated 30 September, first full-flow day No, explicit Postmenopause context. Saved/reloaded/edited local nickname; selected Wisdom appearance. | Spotting and context preserved. Source-linked care note appears beside Save on edit; source dialog/Escape work. Profile displays the edited nickname; Home restores Wisdom appearance. |

The separate sleep diary was also exercised through its linked route: dated bed/wake times and quality saved, reloaded, edited from wake 05:30 to 05:45, and reloaded as one entry. New-format rows have Edit/Save changes/Cancel; unconfirmed legacy rows remain read-only and preserved. No duration or clinical score is inferred from clock times.

The reading selector was exercised for all five contexts. It changes educational content for that visit and does not change records or assign a reproductive stage. Local preferences do not create medical context, account access or subscription rights.

## Repairs

- Replaced fake account controls and fabricated profile identity with truthful local entry and editable nickname. Corrupt, failed, stale or deleted preference/questionnaire data cannot silently be replaced by a save. Questionnaire stores are covered by exact-key export/delete inventory.
- Journal dates restore existing values; explicit Edit/Save changes preserve other dates. Failed/stale writes retain the draft and existing bytes. The same date cannot acquire a second unreviewed entry.
- Insights and Overview now include cycle observations and Home check-ins, with original source, missingness, dates and units. `ovarian-health.html` brings these records together with life-context explanations and existing source dialogs. It performs no clinical scoring or statistical correlation.
- Fixed shared navigation binding routes to child labels inside real controls. Tapping Home Sleep now opens its real check-in rather than navigating to example data. A regression loads the actual shared navigation and taps the label/icon of all six check-in controls.
- Replaced fabricated sleep-stage/efficiency/RHR/score displays with actual Home sleep notes. Removed the separate diary’s unsupported reserve/score claims and default times; new dated diary records can be edited without truncating history or changing legacy/other entry bytes. Home and Profile restore the same explicit appearance preference on return; an appearance is not a diagnosis.
- Added optional self-reported peri/postmenopause observation flags. Explicit postmenopause bleeding shows assessment guidance; explicit postpartum bleeding shows after-birth context. These messages are hidden for missing/withheld/no-bleeding input and never clear or infer fields.
- Removed age cutoffs from appearance labels. Postpartum and postmenopause chapter links now reach dated bleeding observations.

## Evidence boundary

Load-bearing explanations were independently checked against primary guidance, including:

| Explanation | Primary evidence | Scope retained |
| --- | --- | --- |
| Reserve is not egg quality or a standalone natural-conception probability | [ASRM reserve guidance](https://www.asrm.org/practice-guidance/practice-committee-documents/testing-and-interpreting-measures-of-ovarian-reserve-a-committee-opinion-2020/); [ASRM fertility evaluation](https://www.asrm.org/practice-guidance/practice-committee-documents/fertility-evaluation-of-infertile-women-a-committee-opinion-2021/) | Clinical context and stimulation planning; no ovarian-age formula or general fertility score. |
| Temperature/mucus/LH are observations with limitations | [ASRM fertility evaluation](https://www.asrm.org/practice-guidance/practice-committee-documents/fertility-evaluation-of-infertile-women-a-committee-opinion-2021/); [NHS fertility awareness](https://www.nhs.uk/contraception/methods-of-contraception/natural-family-planning/) | No app ovulation confirmation or contraception assurance. |
| After-birth bleeding and fertility need context | [NHS body after birth](https://www.nhs.uk/pregnancy/labour-and-birth/your-body/); [CDC lactational amenorrhea method](https://www.cdc.gov/contraception/hcp/usmec/lactational-amenorrhea-method.html) | Postpartum bleeding not automatically cycle day 1; lactation is not an app infertility guarantee. |
| Menopause history and symptoms need assessment context | [WHO menopause](https://www.who.int/news-room/fact-sheets/detail/menopause); [NHS menopause symptoms](https://www.nhs.uk/conditions/menopause-and-perimenopause/symptoms/) | No classification from appearance, chronological age or one FSH result. |
| Any postmenopause vaginal bleeding warrants assessment | [NHS postmenopausal bleeding, reviewed 24 September 2026](https://www.nhs.uk/symptoms/post-menopausal-bleeding/); [KK Menopause Centre / SingHealth](https://www.singhealth.com.sg/symptoms-treatments/menopause) | No cause diagnosis, normality reassurance or promised referral deadline. |
| Adolescent cycles need adolescent context | [RCH adolescent heavy bleeding guidance](https://www.rch.org.au/clinicalguide/guideline_index/Adolescent_Gynaecology_Menorrhagia/); [2025 adolescent PCOS recommendations](https://link.springer.com/article/10.1186/s12916-025-03901-w) | No adult-cycle rule or AMH-based adolescent diagnosis. |

ASRM's two documents share some underlying studies; this is corroborating guidance, not two independent experiments. The Steiner cohort cited by ASRM studied women aged 30–44 without known infertility; it is not a universal validation study. NICE full-page retrieval was blocked and is not recorded as freshly read. Existing evidence-record check dates were preserved; this targeted review does not verify every older app citation. Qualified clinical and translated-content review remain pending.

## Verification and limits

167 deterministic regression groups pass across 14 suites, with zero failed suites. See `persona-browser-qa.json`, `persona-regressions.json`, `scoring-site-static.json` and `persona-build-checks.json` for exact checks. Targeted phone QA used 320px/390px, dark theme and A++ text; no horizontal document overflow was observed on the new records/care flows. The view remains scrollable with fixed navigation. This is not a full accessibility, screen-reader or physical-device certification.

No cloud-account sign-in, account isolation, server deletion, device sync, community, purchase, clinical model or physical PPG validation passed. Other legacy/demo routes still need a full product/clinical review. A local-only health record is not an encrypted protected account. Some providers have no current configuration; configuration alone would not prove an operational account lifecycle.

No push, deployment, native upload, external message, real medical data upload or billing action. Screenshots use fictional QA content only. The prior Doubao source is preserved. Local changes must be reviewed before an explicitly approved production deployment, with the exact source and Vercel target reconciled first.
