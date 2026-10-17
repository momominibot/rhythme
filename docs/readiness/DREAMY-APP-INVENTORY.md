# Ovuluna source and claim-screening inventory

Checked 30 September 2026. This is an engineering/source inventory. It is not clinical sign-off or a statement that every health claim is supported.

## Source reconciliation

- The earlier continuation was `/Users/michiyomimi/Desktop/ovuluna-doubao`, clean HEAD `0e8580b` dated 12 September.
- The current Doubao source was `/Users/michiyomimi/Doubao/chats/2026-09-07/new-chat-4/nemow`, clean HEAD `e6020a4ea4764705db678ea9e0cb6f89c9ed4ca5` dated 25 September.
- Nine public files returned HTTP 200 and were byte-identical to the current Doubao checkout: index, Home, Learn, theme stylesheet, dark-mode controller, evidence DB and controller, postpartum guide and i18n controller. All differed from the continuation. This sample does not prove every live file matches.
- The working reconciled app is `/private/tmp/ovuluna-dreamy-20260930/app`. Original checkouts and user records were preserved.
- Public comparison receipt: `/private/tmp/ovuluna-dreamy-20260930/live/comparison.json`.

## Initial inventory snapshot, before this pass’s fixes

The JSON snapshot was taken at 2026-09-30T12:10:37.569981+00:00. It covered 81 HTML pages. Page hashes, exact literals and original line numbers are retained in DREAMY-APP-INVENTORY.json so later edits do not erase the audit trail.

Latest source added postpartum, mental-health, exercise, stage-calculator and terms pages plus more interface dictionaries. The original life-stage journeys were primarily Bloom, Grow, Nurture and Wisdom routes with fixed examples in several places. The app was a mixed shared-CSS static shell, rather than one React/Next.js component tree.

At that snapshot, theme CSS and dark-mode assets were imported on 81 pages; app navigation on 74; evidence DB/controller on 76; i18n on 62. Some newer pages used alternate evidence attributes with no working handler.

The Unicode scan found 682 emoji codepoints in source, including data arrays and scripts. This count is not the number of visible icons.

## Prioritized candidate risks

Keyword candidates are leads, not verified findings. CSS class names, quoted examples and prototype gates can produce false positives. Each applicable item needs source, identity or backend verification. Exact matches are in the machine-readable inventory.

| Area | Initial candidates | Required interpretation |
| --- | ---: | --- |
| account-status | 32 | Check source context and actual rendered behavior. |
| clinician-identity | 12 | Check source context and actual rendered behavior. |
| derived-prediction | 12 | Check source context and actual rendered behavior. |
| restricted-treatment | 15 | Check behavior and user-facing medical implications. |
| phase-prescription | 27 | Check source context and actual rendered behavior. |
| postpartum-prescription | 17 | Check behavior and user-facing medical implications. |
| clinical-validation | 14 | Check source context and actual rendered behavior. |
| crisis-contact | 9 | Check behavior and user-facing medical implications. |
| mental-screening | 108 | Check behavior and user-facing medical implications. |
| app-staging | 16 | Check behavior and user-facing medical implications. |
| unhandled-evidence | 9 | Check source context and actual rendered behavior. |
| benefit-overclaim | 11 | Check source context and actual rendered behavior. |

| Initial page and line | Literal or context | Focus |
| --- | --- | --- |
| learn-hormone-phase-locking.html:47 | 12px;justify-content:center"> verified Reviewed by Dr. Priya Menon, OB-GYN · 7 min read | clinician-identity |
| learn-hormone-phase-locking.html:80 | PPG surrogate: No direct hormone measurement, but r ≥ 0.85 correlation with key hormonal state transitions via physiological proxies (HRV, RHR, temperature) | clinical-validation |
| learn-hormone-phase-locking.html:83 | 🔬 The r ≥ 0.85 Threshold | clinical-validation |
| learn-longevity-pathways.html:47 | 12px;justify-content:center"> verified Reviewed by Dr. Lena Okoro, OB-GYN · 8 min read | clinician-identity |
| learn-longevity-pathways.html:69 | Zone 2 training (3–4 sessions/week, 30–45 min at 70–80% of FatMax), protein intake ≥ 1.6 g/kg/day, CGM-guided glycemic control (HbA1C | restricted-treatment |
| learn-longevity-pathways.html:69 | s/week, 30–45 min at 70–80% of FatMax), protein intake ≥ 1.6 g/kg/day, CGM-guided glycemic control (HbA1C | restricted-treatment |
| learn-biomarkers.html:54 | 12px;justify-content:center"> verified Reviewed by Dr. Priya Menon, OB-GYN · 8 min read | clinician-identity |
| learn-biomarkers.html:53 | v class="sub" style="font-size:12px;margin-top:8px">Understanding the key hormones and markers that shape your fertility, cycle health, and aging trajectory | clinical-validation |
| learn-biomarkers.html:82 | day. AMH | derived-prediction |
| supplements.html:153 | ovarian response & embryo quality in diminished reserve; meta-analysis ~2× clinical pregnancy odds (OR 2.22). Start ≥90 days ahead.'}, | benefit-overclaim |
| supplements.html:155 | why:'Restored ovulation in ~70% of women with PCOS in 16 weeks; improves insulin sensitivity, oocyte maturation & cycle regularity. Not a stand-alone fertility treatment.'}, | benefit-overclaim |
| supplements.html:156 | meal', ic:'wb_sunny', col:'var(--terracotta)', bg:'rgba(196,111,79,.16)', ev:'Strong', tag:'If low (most are)', | benefit-overclaim |
| nutrients.html:165 | AI Tip · Diet alone may not restore optimal stores quickly. A clinical-grade iron bisglycinate supplement is recommended — re-test in 8–12 weeks. | restricted-treatment |
| nutrients.html:165 | >AI Tip · Diet alone may not restore optimal stores quickly. A clinical-grade iron bisglycinate supplement is recommended — re-test in 8–12 weeks. | restricted-treatment |
| straw-calculator.html:143 | Reproductive stage: unable to determine | app-staging |
| straw-calculator.html:324 | stage: '-1', label: 'Late Menopausal Transition', | app-staging |
| straw-calculator.html:334 | const baseline = cycles[cycles.length - 1]; // most recent as baseline | app-staging |
| mental-health.html:228 | SOS (Samaritans of Singapore) 24-hour emotional support: 1-767 | crisis-contact |
| mental-health.html:228 | SOS (Samaritans of Singapore) 24-hour emotional support: 1-767 | crisis-contact |
| mental-health.html:232 | Text line Text 741741 to connect with a crisis responder | crisis-contact |
| tcm-footsoak.html:200 | Strong warming action that penetrates deep into the channels. Relieves cold-type pain, reduces dampness, and improves circulation in the lower body. Use in smaller quantities due to its potency. | benefit-overclaim |
| tcm-footsoak.html:236 | reasing peripheral blood flow by 2–3×. Herbal compounds (volatile oils, flavonoids) may be absorbed transdermally at low levels. | benefit-overclaim |
| tcm-footsoak.html:237 | Menstrual pain: Meta-analysis of 15 RCTs (n=1,236) found herbal footbaths reduced VAS pain scores by 2.1 points vs. control (p (i) | benefit-overclaim |
| fertility.html:42 | tyle="font-size:11.5px;font-weight:800;color:var(--terracotta);margin-top:8px;letter-spacing:.03em">Predicted ovulation: Tomorrow | derived-prediction |
| fertility.html:131 | Biological Markers Consistent tracking of your BBT shift and LH peak pinpoints the exact window of ovulation rather than estimating from calendar days alone — and reflects your ovarian reserve over time. | derived-prediction |

## Changes within this agent’s ownership

- Mental health now uses a non-scored, ephemeral mood reflection and actual journal navigation. Urgent support is always available. The paraphrased EPDS algorithm, reassuring thresholds, automatic mood writes and mislocalized phone numbers were removed. Country selection is delegated to a clearly external helpline directory.
- The stage-calculator URL now explains STRAW+10 and summarizes optional typed observations. It does not assign a reproductive stage or fertility interpretation, and saves nothing. Context and input validation are visible.
- The foot-care page provides a cautious comfort description rather than herb prescriptions, high-temperature schedules or fabricated efficacy numbers. Diabetes/reduced sensation/poor-circulation precautions are explicit.
- Five new narrow supporting-source records are in evidence-safety.js. straw10 replaces the legacy metadata through evidence-merge.js. This is a source receipt, not medical approval.
- The remaining app, shared design, lifecycle content and acupoint atlas are owned by other agents. Do not infer closure of all initial candidates from these three fixes.

## Shared evidence and translation behavior

The current coverage receipt is dreamy-evidence-coverage.json with 148 merged records and 57 records carrying a checked-source flag. Legacy records stay visibly pending rather than becoming verified because a link or metadata exists.

The original i18n controller matched complete text-node strings once at DOM ready. It did not systematically translate dynamically injected health copy or accessible labels. Dictionary lookup assigned textContent, so the audited walker did not execute dictionary HTML. This is not a review of all dictionary translations.

New safety passages are marked lang=en and data-dream-skip-translate. The shared walker now skips those regions, reviewed chapter regions, dream-icon regions and evidence sheets. This prevents partial interface translations from altering clinical language or citation identifiers. New clinical translations still require separate qualified review. A translated navigation label does not mean the whole app is clinically translated.

CSS font-ligature icons and emoji text replacement need runtime checks: preserve visible/accessible names, input text, source excerpts and original units. Root owns the shared dream-icon mapper and reduced-motion behavior.

## Verification boundaries

- All original and reconciled HTML was converted with markitdown before analysis. Plain Markdown/JavaScript source was inspected directly.
- Read-only public requests and byte comparisons were separate from local changes. No deployment, social publication, account creation, patient-data use or backend mutation occurred.
- After the acupoint bundle landed, the full static check passed across 88 pages, 245 script groups and 982 local page links. Passing verifies syntax and reference/key presence only; it does not establish clinical validity or all runtime behavior.
- Focused test receipts and supporting-source retrieval limits are in TARGETED-SAFETY-REVIEW.md. App-store approval and clinical review have not been obtained.
