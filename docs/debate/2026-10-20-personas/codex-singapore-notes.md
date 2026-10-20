Tested **60 synthetic notes: 30 urgent, 30 ordinary**, loading the six specified scripts in a Node VM with `profile={}`. **7 missed alerts, 8 false alerts.** No files edited.

`null` means no card. Every non-null return below had level `emergency`; its exact code is shown.

| Note | Returned | Should return |
|---|---|---|
| my words suddenly damn slurred now | `null` | `emergency` |
| pad full every 20min, feel like fainting | `null` | `emergency` |
| Chest damn tight, suddenly sweating cold. | `null` | `emergency` |
| Suddenly left arm no strength, cannot talk properly. | `null` | `emergency` |
| Pad soaked hourly, dizzy like going to pengsan. | `null` | `emergency` |
| Delivered last week, voices say hurt baby now. | `null` | `emergency` |
| Baby born last week, TV sends me special messages. | `null` | At least `today`; `emergency` acceptable |
| no thoughts of self-harm, feeling okay | `SELF_HARM_NOW` | `null` |
| soaked my laundry, period normal | `HEAVY_BLEED_NOW` | `null` |
| mum had chest pain years ago, recovered | `CHEST_BREATH_NOW` | `null` |
| had chest pain last year, doctor cleared it | `CHEST_BREATH_NOW` | `null` |
| no severe pelvic pain, just mild cramps | `SEVERE_PAIN_NOW` | `null` |
| Period heavy as usual, no dizziness or weakness. | `HEAVY_DIZZY_NOW` | `null` |
| Chest pain years ago was checked, nothing since. | `CHEST_BREATH_NOW` | `null` |
| Drama character said I want to die, so sad. | `SELF_HARM_NOW` | `null` |

Expected urgency was checked against [MOH/SCDF emergency signs](https://www.moh.gov.sg/newsroom/prudent-use-of-scdf-emergency-medical-services-and-emergency-department-services/), [ACOG bleeding guidance](https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding), and [NHS postpartum psychosis guidance](https://www.nhs.uk/mental-health/conditions/post-partum-psychosis/).

**Yes, I would block release.** “Chest damn tight” and “arm no strength” are ordinary, plausible Singapore phrasing for dangerous symptoms. Their reproducible misses warrant a hold. This synthetic sample establishes failures, not their frequency among actual users.
