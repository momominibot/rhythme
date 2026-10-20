# Four personas, three models: what every activity needed (20 October 2026)

Jamie asked for every model to walk the app as four different users, and for every activity to carry a mindful moment and a visible action from the avatar, in her own outfit.

## Method

- **Inventory.** Codex (gpt-6-astra, read-only) listed every activity from the code with file and line, the mindful element present, what the avatar does and whether her outfit is kept: `2026-10-20-personas/inventory-codex.md`.
- **Personas.** Wei Ling, 33, trying to conceive for eight months. Nadia, 31, four months after a birth, breastfeeding, wears a tudung. Siti, 46, perimenopause, heavy irregular bleeding, night flushes, amlodipine, shift work. Mrs Tan, 54, two years after her last period, dryness, poor sleep, osteopenia, gardens, has a cat.
- **Walkthroughs.** Codex read the code as each persona (`codex-*.md`). DeepSeek v4 pro and Doubao seed 2.1 pro, which cannot read the code, walked the inventory as each persona (`deepseek-*.md`, `doubao-*.md`). Twelve reviews in all, with the same brief (`brief-*.md`). Each model run used one job at a time and would stop on the first provider failure; none failed.
- **Verification.** Clinical claims that changed the app were checked against primary sources before use: Wilcox 1995 (NEJM, PMID 7477165) and Wilcox 2000 (BMJ, PMID 11082086) for the fertile window, NICE NG257 for intercourse frequency, ASRM 2021 for when to seek a fertility check, MOH (18 June 2025) for mindline 1771. Every new red-flag rule was probed with phrases that must and must not raise it (`tools/test-core.js`, block 2b).

## Where all three models agreed

| Finding | Personas | Change |
|---|---|---|
| Red flags beyond the period were missed: chest pain, stroke signs, face or throat swelling, ectopic pain, fever with pelvic pain or a sore breast or wound, a swollen leg, a fall, hearing voices | all four | `ovu-orb.js urgent()` gained these cards; a denied symptom never raises one |
| Entries saved by hand only toasted "see the journal" | Siti, Mrs Tan | `ovu-orb.js entryUrgent()`; the care card opens at once after a hand save |
| Self-harm card spoke of "your baby" to everyone | Mrs Tan | the baby is named only when the note or profile has one |
| "Trying to get pregnant, period came today" raised the pregnancy-bleeding emergency | Wei Ling | `pregnantNow()` reads trying, not pregnant and negative tests as not pregnant |
| "Worried my period is coming" was offered as a period day | Wei Ling | worry and waiting are feelings, never flow |
| The fertility page showed a made-up 85% chance, a "detected" LH surge and sample temperatures | Wei Ling | rewritten as a sourced explainer with her own calendar estimate |
| Streak bonus and per-item meal bonus are pressure | all four | removed; the hearts text matches the real rules |
| "Did you really do it, with attention?" judges | all four | "Save this pause to your journal?" with an honest-but-kind note |
| Help for low mood waited for seven logged days | Nadia | mindline 1771 shows as soon as a low mood is picked; after a birth three low days raise the note |
| The mat put her in the yoga set, the bed in pyjamas, the stretch in yoga clothes | all four | outfit-matched sprites for meditate, sleep and stretch; a practice from the Mind hub no longer plays to an empty room |
| No tudung | Nadia (all three models) | a baju kurung and tudung outfit, checked by Doubao's vision model for respect and fit |
| Predictions after a birth with periods not back | Nadia | paused until a period is logged after set-up |
| After menopause, any bleeding is not a period | Mrs Tan | the calendar says Bleeding, fills nothing, and a saved day opens the prompt card ("This is not a period") |
| Menopause on HRT was not recorded | Mrs Tan | HRT no longer blocks the after-menopause stage |
| The sleep form started at 23:00 to 07:00 | Nadia, Siti | blank until she fills it |
| No way to log dryness, urinary discomfort or pain during sex | Mrs Tan, Wei Ling | three new symptoms, with a review note for pain during sex |
| Hot flushes need a count and night waking | Siti, Mrs Tan | optional count and "woke me at night", carried into the clinician summary |
| The clinician export left out life-stage context | Nadia, Siti | a self-reported Context line (birth, breastfeeding, periods back, trying, menopause, medicines, paused predictions) and the number of filled-in days |
| Herb cautions sat below every card | Wei Ling, Nadia | for trying, pregnant or after a birth: cautions first, nothing ranked by phase |
| Camera calm, pulse and stress tools read as tests; the stress scan was called a PSS-10 questionnaire | all four (DeepSeek, Doubao) | labelled experimental, not a medical test, with 995 for real symptoms |
| The AI switches did not say where notes go | all four (Codex) | the consent sheet states the server in Singapore and the AI service in China beside the switches |
| Reminders promised more than a web page can | Wei Ling, Siti | they fire only while Rhythme is open; the calendar file is the reliable way |
| A sample noticeboard note claimed ginger tea helped cramps | Wei Ling, Nadia | replaced with a note that claims nothing |
| The evening stretch folds forward | Mrs Tan | a care line before Begin: keep the bend small or stay upright with osteoporosis or a sore back (the voiced steps are unchanged) |

## The mindful moment

`ovu-moments.js` gives each activity a pose and a few lines (18 words at most, no score, streak, "should" or em dash; checked in the harness). After a save she writes in her notebook, eats, steps on the scale or stretches; at the farm she kneels to plant and gathers the harvest; she wears headphones for the podcast, reads at the desk, presses her wrist for acupressure, holds a shopping bag, waves in the plaza and tends her pets. The line also rides on the toast, so it is seen under a sheet. A care card always comes alone. Eleven new poses were drawn with Seedream 5.0 pro from her own sprite, then in every outfit with the outfit as the second reference.

## Where the models disagreed, and what was chosen

- **Postmenopausal bleeding: today or this week.** DeepSeek and Doubao wanted "today"; Codex and RCOG say promptly. The card says this week, sooner if heavy or painful, and 995 with faintness, chest pain or trouble breathing.
- **Food ideas while breastfeeding.** DeepSeek wanted phase ideas hidden. Jamie decided on 20 October that ideas start at the period tab; that stays, with a note when phases are paused. The list has no pork or alcohol, which answers Doubao's halal point for ideas.
- **Sleeping in a baju kurung.** Doubao found it not offensive but less believable. Jamie's rule is that nothing changes her outfit by itself; bedtime already offers pyjamas.
- **Walk cycles for the tudung outfit.** Not drawn: a missing walk strip falls back to a step bob without changing her clothes, the same as the kebaya outfits.

## Left for later

- Shops' opening hours exclude night-shift users (Siti). The one real clock is Jamie's rule; a later change would need her call.
- Postpartum sleep in several pieces (Nadia, Doubao). One night per record stays for now; the form says an honest estimate is enough.
- Server-side Luna rules (the edge function) were not changed; the new symptoms are read on the phone.
