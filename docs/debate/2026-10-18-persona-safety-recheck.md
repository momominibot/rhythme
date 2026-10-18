# Persona safety findings, re-checked with the app's own parser (18 October 2026)

The four Codex persona walkthroughs (docs/debate/2026-10-18-persona-*.md) reported parser behaviour from isolated tests. This session re-ran the exact sentences through `OvuOrb.urgent()` and `OvuOrb.parseLocal()` in a Node vm using the same module loader as `tools/test-core.js` (ovu-store, ovu-food, ovu-nova, ovu-agents, ovu-orb, ovu-rewards, ovu-pets), with an empty profile unless stated. No app code was changed. Script: the original session's scratchpad `recheck.js`.

| Sentence | Profile | urgent() | parseLocal() entries | Verdict |
|---|---|---|---|---|
| No bleeding, but sudden severe pelvic pain. | none | null | none | Reproduced: a leading "no bleeding" returns early (`ovu-orb.js:39`) before the severe-pain rule |
| Sudden severe pelvic pain. | none | SEVERE_PAIN_NOW | none | Control: the rule works without the negation |
| No period, but severe abdominal pain. | none | null | none | Reproduced (same early return on "no period") |
| I want to hurt myself | none | null | none | Reproduced: no self-harm rule exists |
| I feel like killing myself | none | null | none | Reproduced |
| No period for two years, but spotting today | lifeStage post | null | symptom: spotting | Reproduced: "no period" suppresses the POSTMENO_BLEED prompt; the symptom-only spotting then escapes the bleeding flag in `ovu-agents.js` which reads period entries |
| Spotting today | lifeStage post | POSTMENO_BLEED | symptom: spotting | Control: the prompt fires without the negation |
| My period has not returned. | none | null | period: medium flow | Reproduced: a false period entry with medium flow |
| No hot flushes today | none | null | symptom: hot flushes | Reproduced: negation ignored for symptoms |
| I feel anxious and low before my period. | none | null | period: medium flow; symptom: low mood, anxiety, mood low | Reproduced: a false period entry alongside the correct mood entry |
| I had night sweats and woke at 3 am. | none | null | food: dinner, "night sweats and woke at 3 am" | Reproduced: "had" routes to the meal rule; night sweats are not a symptom word |
| I am irritable and forgetful. | none | null | none | Reproduced: "irritable" does not match the "irritability" symptom word; "forgetful" does not match "brain fog" |
| Slept 11pm to 7am but awake from 3am. | none | null | sleep 23:00 to 07:00 | Reproduced: wakefulness discarded, stored as 8 h |
| Slept 11pm to 7am, woke every 2 hours to breastfeed, quality 2. | none | null | sleep 23:00 to 07:00, quality 2 | Reproduced: feeding interruptions discarded |
| I walked for 30 minutes today. | none | null | none | Reproduced: no movement entry type |
| My ovulation test was positive. | none | null | none | Reproduced: no LH test entry type |
| I skipped breakfast. | none | null | none | Reproduced: nothing logged |

What this means for the rhythm check: any read built on these logs inherits false period days (which would move cycle lengths and phases), missed urgent cards, and misread nights. The design doc (docs/design/2026-10-18-cycle-wellness-score.md, section 9) lists these as prerequisites. Suggested direction, for the implementer, not applied here:

- Make the negation clause-aware: strip "no X" clauses before testing the rest of the sentence, rather than returning early (`ovu-orb.js:39`), and never let a negation suppress SEVERE_PAIN or the postmenopausal bleeding prompt.
- Add a self-harm and harm-to-baby rule to `urgent()` with the SOS 1767 and 995 wording from the design doc, shown before parsing.
- Treat "has not returned", "no period", "not bleeding" as explicit "no period today" observations, never as flow.
- Apply negation to symptom words ("no hot flushes").
- Add "night sweats", "irritable", "forgetful", "flat", "tearful" to the symptom vocabulary mapping (hot flushes, irritability, brain fog, low mood).
- Keep "awake from", "woke every N hours", "took an hour to fall asleep" as night-detail fields (section 4 of the design doc) instead of discarding them.
- Add movement, LH test and skipped-meal entry types or tags.
