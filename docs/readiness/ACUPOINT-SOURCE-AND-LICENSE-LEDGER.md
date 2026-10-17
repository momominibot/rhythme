# Ovuluna acupoint atlas: source, licensing and implementation handoff

Source check: 30 September 2026. Prepared locally; no production deployment. The source check is separate from clinical or anatomical review of the app, which remains pending.

## Decision and implementation

Use an original, lightweight 2D orientation atlas for this release. It supplies searchable point names, front/back views, local limb views, written anatomical landmarks and evidence details. Display approximate markers explicitly as navigation aids. A qualified practitioner needs to check the diagrams before they could support any treatment guidance. Dreamy illustration is decorative; it is not an anatomy source.

The implemented files are `app/acupoints.html`, `app/acupoint-atlas.css`, `app/acupoint-atlas.js` and `app/evidence-acupoint.js`. The last file exports `window.ACUPOINT_EVIDENCE`, then merges those records into `window.EVIDENCE_DB` so the page works before central consolidation. It uses the existing accessible evidence-dialog implementation. The atlas does not write local or server records.

The original schematics are labeled Ovuluna 2026, CC BY 4.0. They were drawn from basic geometric outlines rather than copied from WHO, BodyParts3D, Wikimedia or AI anatomy. Selected-point text, SVG title/description, buttons and evidence triggers remain keyboard accessible. Fonts use relative units; labels and lines use shared light/dark contrast variables.

## Open anatomy options and verified licenses

| Option | Source and current license | Practical assessment |
|---|---|---|
| BodyParts3D archive | [Official archive license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), updated 27 February 2025, CC BY 4.0 | Best candidate for a future commercial 3D viewer. The archive requests a specific attribution, now shown in the app. Preserve credit, link the license and mark modifications. Raw archives are too large for a first mobile screen. |
| Z-Anatomy models | [Official model repository](https://github.com/Z-Anatomy/Models-of-human-anatomy), CC BY-SA 4.0 project, with differently licensed credited assets | Do not import the complete package into a commercial product without per-asset review. Its README credits inner-ear assets under BY-NC-SA and a kidney under BY-NC. Upstream BodyParts3D relicensing does not automatically change these adaptations. |
| Z-Anatomy Unity application | [Official application repository](https://github.com/LluisV/Z-Anatomy), CC BY-SA 4.0 | Native Unity application rather than a small web component. Extra rendering and delivery work, and exact imported asset licensing still matters. |
| Wikimedia front/back body schemes | [Individual file record](https://commons.wikimedia.org/wiki/File:Human_body_schemes.png), CC BY-SA 4.0, S.raeder based on Uwe Thormann | Small practical alternative for basic orientation, but cropped or modified versions need attribution and compatible ShareAlike licensing. A Commons URL alone does not establish a license or clinical accuracy. |
| Wikimedia female/male shaded SVG | [Individual file record](https://commons.wikimedia.org/wiki/File:Female-male_front-back_3d-shaded_human_illustration.svg), CC BY-SA 4.0, Goran tek-en and credited contributors | More detailed, but large and visually crowded on mobile. A crop would be an adaptation. It does not establish acupoint coordinates. |
| Original Ovuluna schematics | Original artwork, explicitly approximate, CC BY 4.0 | Lowest delivery and license complexity for the current orientation feature. Does not replace validated anatomy. |

BodyParts3D's [download listing](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) includes a 136 MB IS-A archive at 99% polygon reduction and a 62 MB PART-OF archive. Future work should extract only a needed region, optimize a GLB, lazy-load it, test constrained phones and have each overlay clinically reviewed. No 3D model is embedded now. Older claims that the current BodyParts3D archive requires CC BY-SA 2.1 Japan are stale.

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) differ. ShareAlike obligations apply to adapted licensed assets; do not assume either that they disappear in an app or that the whole app must automatically be open sourced. Review the actual asset and distribution structure. Noncommercial and NoDerivatives assets need separate permission or exclusion for incompatible uses.

The [TARA research repository](https://tara-repository.mgb.org/ontology) is a promising ontology and research reference. A first-party commercial-use license was not verified here, and a catalog lead indicated possible NC-ND restrictions. Do not import its bulk data or clinical "indications" as evidence of treatment efficacy. It is not used in this release.

## Landmark verification and coordinate contract

The complete [WHO Standard Acupuncture Point Locations](https://iris.who.int/server/api/core/bitstreams/d98c1c98-3fbf-4e4e-8c9a-1bbe72ccd00e/content) was retrieved from the current WHO repository and checked directly. It is the 2008 publication with a 2009 updated reprint. Old `/bitstream/handle/` links returned HTML, so the current DSpace bitstream was used and its PDF signature checked. `markitdown` was attempted first; missing PDF extras required `pdftotext` as a fallback.

The JavaScript contains concise paraphrases of all 13 landmark descriptions. B-cun means proportional body measurement, not centimeters or an interchangeable fixed four-finger rule. The original drawings must not be treated as accurate scaled anatomy. No WHO figure or logo is copied.

| Code | Printed WHO page | Default view | Schematic main x,y | Detail x,y |
|---|---:|---|---|---|
| SP6 | 72 | Inner ankle | 182,556 | 174,155 |
| CV4 | 221 | Front | 200,324 | 200,210 |
| ST36 | 64 | Front | 167,493 | 150,220 |
| LR3 | 193 | Top of foot | 181,610 | 180,180 |
| LI4 | 35 | Hand | 109,355 | 151,190 |
| PC6 | 159 | Forearm | 110,321 | 200,205 |
| CV6 | 222 | Front | 200,309 | 200,165 |
| CV3 | 221 | Front | 200,334 | 200,240 |
| ST29 | 60 | Front | 179,334 | 140,240 |
| SP10 | 74 | Front | 185,436 | 235,101 |
| KI3 | 137 | Inner ankle | 183,587 | 146,266 |
| BL23 | 111 | Back | 177,279 | 156,140 |
| GV4 | 205 | Back | 200,279 | 200,140 |

Main SVG uses a `400 × 650` viewBox; local diagrams use `400 × 420`. Coordinates are only an implementation contract for approximate marker navigation. Text is the reference. In particular, ST36 is referenced to ST35 rather than an invented distance from the patella, LI4 uses the radial midpoint of the second metacarpal, and BL23/GV4 appear on posterior views. ST29 and BL23 have bilateral marks; other local views illustrate one representative side. Check the current JS before changing drawings because coordinate labels are not real body measurements.

## Narrow evidence ledger

| App claim | Retrieved evidence | Scope and decision |
|---|---|---|
| Acupressure may help primary period pain | [Yu et al. 2025](https://pubmed.ncbi.nlm.nih.gov/41138782/), [Ravi et al. 2024](https://pubmed.ncbi.nlm.nih.gov/39309625/), [Cochrane 2016](https://www.cochrane.org/evidence/CD007854_acupuncture-period-pain) | Newer reviews are promising but limited; Yu explicitly calls evidence low quality and harms reporting sparse. Review abstracts, not full reviews, were available. Formal full-text appraisal is pending. No personalized regimen or ovarian-health claim. |
| LI4/ST36/SP6 included in a teen pain trial | [Aksoy-Can et al. 2025 full text](https://link.springer.com/article/10.1186/s12906-025-04965-0) | Small single-center trial, 56 adolescents, three-point combination. Adherence, pressure and concurrent analgesic use limit interpretation. It cannot prove a single point's benefit, long-term safety or effects across all life stages. |
| No established ovarian-reserve or pregnancy benefit in this atlas | [Cochrane PCOS 2025](https://www.cochrane.org/evidence/CD007689_what-are-benefits-and-harms-acupuncture-women-polycystic-ovary-syndrome), [NCCIH](https://www.nccih.nih.gov/health/acupuncture-effectiveness-and-safety) | Sham-controlled fertility outcomes are unclear or show no advantage in the cited evidence. Uncertainty remains. Acupuncture results do not prove acupressure effects or individual point efficacy. No egg-quality, follicle-development or ovarian-age score. |
| Menopause complementary guidance is nuanced | [IMS full guidance posted March 2026](https://www.imsociety.org/wp-content/uploads/2026/03/IMS-Recommendations-Full-Document.pdf), Section 24 pp. 218/225; [Menopause Society 2023](https://pubmed.ncbi.nlm.nih.gov/37252752/) | IMS finds insufficient evidence for manual acupuncture for vasomotor symptoms, allowing discussion of electroacupuncture with low-certainty grade C. The older Menopause Society statement does not recommend acupuncture for these symptoms. Do not collapse these interventions into a point-specific self-care claim. |
| Do not infer personal safety from an atlas | [NCCIH safety](https://www.nccih.nih.gov/health/acupuncture-effectiveness-and-safety), [NHS complementary therapies, reviewed 2026](https://www.nhs.uk/tests-and-treatments/herbal-medicines-and-complementary-therapies/) | No `pregSafe` flags, needle-depth advice, moxa dose or pressure schedule. Pregnancy, possible pregnancy, recent birth and fertility treatment need discussion with the care team. |
| Pelvic-pain red flags need assessment | [NHS pelvic pain, reviewed November 2025](https://www.nhs.uk/symptoms/pelvic-pain/) | Clear urgent/emergency referral copy with source, not diagnostic triage. Local services rather than universal UK phone numbers. Persistent or recurrent pain also needs assessment. |

The original page's unsupported "13 evidence-backed acupoints for ovarian health", "53 RCTs" certainty, follicle-support claims, pregnancy-safe labels and home needle/moxa protocols were removed from the replacement. Traditional channel classification remains visibly distinct from tested outcomes. A point appearing in a study is not proof of individual efficacy. The Cochrane PCOS page has inconsistent study totals between the displayed plain-language and abstract sections; no total is repeated in app copy.

## Remaining checks before release

Qualified anatomical review of schematic orientation, written simplifications and marker placements; clinical review of the public safety and efficacy summaries; final root browser checks across dark/light themes, font enlargement, keyboard navigation, search/filter and evidence-dialog focus; then the user's explicit production-deploy approval. The visual atlas is a useful education draft, not a validated clinical localization or treatment tool.
