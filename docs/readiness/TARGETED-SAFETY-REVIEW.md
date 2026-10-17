# Focused Ovuluna safety-copy and behavior pass

Checked 30 September 2026. The changes are local in the reconciled app. No deployment, patient records, account deletion, external messages or backend writes were performed. Source checking does not constitute clinical approval, validation of Ovuluna, or Apple approval.

## Owned changes

| File and current anchor | Result |
| --- | --- |
| mental-health.html:155 | Original mood words are explicitly non-scored reflection prompts. Selection lasts for the current visit only. Saving requires opening the actual wellness journal. |
| mental-health.html:161 | Replaced the paraphrased EPDS implementation and reassuring thresholds with descriptive support. A clinician can select and interpret a suitable instrument; this page administers none. |
| mental-health.html:166 | Urgent support is always present before any answer. Immediate danger points to local emergency services; postpartum confusion, hallucinations or delusions prompt urgent medical assessment. |
| mental-health.html:173 | Country-specific support uses an explicitly external Find A Helpline directory. No country, universal phone number, availability guarantee or service response time is assumed. |
| straw-calculator.html:35 | Preserved the existing URL and shell, changed title and purpose to framework education plus a descriptive input summary. Removed all individual stage classification, including age-based shortcuts. |
| straw-calculator.html:45 | Optional cycle entries have no defaults, are not saved and do not infer ovarian age, fertility or menopause. Entries are shown literally with any selected context. Invalid or edited entries cannot retain a stale output. |
| tcm-footsoak.html:74 | Diabetes, reduced sensation and poor circulation take priority over a comfort ritual. Removed herb formulas/grams, hot-water regimens, pregnancy automatic recommendations and unsupported numeric benefit claims. |
| tcm-footsoak.html:84 | Traditional language is separated from measured ovarian/hormonal effects. No treatment, dose or frequency is assigned. |
| evidence-safety.js | Five fresh records: mental-health-scope, mental-health-support-worldwide, straw10, foot-care-safety, tcm-evidence-limits. The shared merge imports these after legacy evidence. |

The three clinical regions declare English and opt out of automatic interface translation. Their source copy requires separate qualified translation review. The evidence buttons use the shared `.qi[data-evidence]` handler and native evidence dialog.

## Supporting-source receipt

Each new record contains claim, narrow supporting explanation, source URLs, a checked-source date, short exact passage receipts and explicit limitations. The sources establish the copy described here, not accuracy of an app assessment.

| Record | Sources and checked sections | Boundary |
| --- | --- | --- |
| mental-health-scope | [NHS postnatal depression](https://www.nhs.uk/mental-health/conditions/postnatal-depression/), sections on coping, getting help and diagnosis; [NHS postpartum psychosis](https://www.nhs.uk/mental-health/conditions/post-partum-psychosis/), symptoms and urgent help; [WHO suicide Q&A](https://www.who.int/news-room/questions-and-answers/item/suicide), actions for self-harm concern | Two NHS pages share an organization; they are not two independent trials. WHO independently supports general urgent-help actions. This is not a scored screening instrument. |
| mental-health-support-worldwide | [WHO suicide Q&A, dated 31 August 2026](https://www.who.int/news-room/questions-and-answers/item/suicide); [Find A Helpline](https://findahelpline.com/), country selection and contact options | WHO supports seeking help. ThroughLine’s directory is first-party evidence of its contact lookup, not clinical diagnostic guidance. Each listing, language, opening hour and response has not been independently checked by Ovuluna. |
| straw10 | [ASRM STRAW+10 executive summary](https://prod.asrm.org/practice-guidance/practice-committee-documents/executive-summary-of-the-stages-of-reproductive-aging-workshopd10-addressing-the-unfinished-agenda-of-staging-reproductive-aging-2012/), results/inclusiveness; [NICE NG23 recommendations](https://www.nice.org.uk/guidance/ng23/chapter/Recommendations), identifying menopause and hormonal-treatment context | ASRM framework is foundational 2012 consensus. NICE provides current clinical context. Neither validates an Ovuluna staging algorithm. Removed unconfirmed legacy PMID/DOI mapping rather than restating it. |
| foot-care-safety | [CDC diabetes and feet](https://www.cdc.gov/diabetes/diabetes-complications/diabetes-and-your-feet.html), healthy-foot tips and reduced sensation; [Guy’s and St Thomas’ NHS foot-care guidance](https://www.guysandstthomas.nhs.uk/health-information/falls/keeping-your-feet-healthy), washing and clinician advice | CDC’s no-soak advice for diabetes takes priority. The NHS duration ceiling is in general falls/foot-care guidance, not evidence of hormonal, pain, sleep or fertility benefit, and not a treatment dose. |
| tcm-evidence-limits | [NCCIH TCM overview](https://www.nccih.nih.gov/health/traditional-chinese-medicine-what-you-need-to-know), herbal evidence/safety and More To Consider; [FDA supplement Q&A](https://www.fda.gov/food/information-consumers-using-dietary-supplements/questions-and-answers-dietary-supplements), discussion with healthcare professionals and product definitions | The FDA guidance applies to ingested supplements, not topical foot baths. The sources do not prove a specific foot-bath formula safe or effective. No prescription is generated. |

WHO, the NHS pages, CDC, Guy’s and St Thomas’, NCCIH, FDA and Find A Helpline were opened and read directly. ASRM direct opening failed; the complete indexed first-party text was retrieved and read. NICE recommendations were read from indexed first-party content when direct access was limited. These retrieval limits remain visible in the record. PubMed/PMC access failures did not become verified citation metadata.

NHS telephone numbers and access pathways were not exported as worldwide defaults. The original Singapore and US contact mismatch has been removed from this page. Future regional shortcuts need a deliberate country choice and renewed first-party service verification.

The existing heat-therapy-dysmenorrhea record remains attached only to the distinction between an abdominal heat study and an herbal foot bath. This pass did not newly verify that inherited trial record; it does not support foot-bath equivalence.

## Checks

- `node --check evidence-safety.js`: passed.
- `node docs/readiness/targeted-safety-regressions.cjs`: 10 isolated DOM checks passed. Tested empty, invalid, long-gap and ordinary-cycle entries; no computed stage; invalidation of stale summaries; row cap; ephemeral mood selection; no owned health-data writes; global support; source-merge resolution.
- `node docs/readiness/targeted-safety-browser.cjs`: 7 ephemeral headless Chrome checks passed, no page errors. Tested actual mood/form controls, native evidence dialogs, source details, Escape/focus return, 320px dark layout and no horizontal document overflow. Remote requests were blocked and synthetic empty storage was used.
- `node scripts/check-site.cjs --output docs/readiness/targeted-safety-site-static.json`: passed across 88 pages and 245 script groups after all evidence bundles landed. The 148 evidence records had source metadata and all statically discovered evidence keys resolved. Record/key presence is not citation correctness or clinical validation.

The first browser attempt was blocked from opening a local test listener by sandbox permissions; the isolated local test was rerun with the approved local permission. An intermediate test failed because it looked for an explicit `role=dialog` rather than the native dialog’s implicit role and used an unscoped submit selector that included the offline guide. The production evidence/form behavior did not require repair for those test-selector failures.

## Remaining readiness limits

Clinical review, instrument licensing where applicable, real-world safety/usability testing, translated clinical-content review and regulatory/app-store review are still separate work. The app remains a wellness education/observation tool. Community backend readiness and third-party device integrations were not expanded by this pass. The broader claim-screening inventory is a queue for source verification, not proof that all its candidate matches remain active or are unsupported.
