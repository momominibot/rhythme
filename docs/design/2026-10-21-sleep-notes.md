# Sleep details and the two-week sleep check

Jamie, 21 Oct 2026: "add in questions about disrupted sleep research and discuss with codex to check the questionnaire
to monitor sleep quality", then, after Codex's review of the questionnaire options: "Write our own based on evidence."

Built on 21 Oct 2026 (branch `claude/sleep-notes`). No licensed scale is used (the PSQI, ISI, ESS and STOP-Bang were
considered and set aside: licence terms, a composite score, or a purpose Rhythme does not have). There is no score.
Every question can be skipped, "not sure" is its own answer and is counted apart, a blank is unknown, never zero, and
every count carries its denominator. Care notes are never gated by how many questions were answered.

## 1. What was added

- **Sleep details, optional, on any night** ("Add sleep details (optional)" under Record a night and under the morning
  Wake sheet): time to fall asleep, number of wakings, time awake in the night, waking early, what woke her (hot flush,
  cramps, toilet, child, snoring, noise, worry, pain, gasping or choking, other), how rested she felt. The fields are
  the Consensus Sleep Diary's morning items, in Rhythme's own words, with chips instead of free numbers.
- **The two-week sleep check**, offered on the sleep record once fourteen nights have passed since the last one: nights
  with trouble falling or staying asleep in each of the last two weeks, whether she usually has the chance to sleep,
  the effect on her days, how long it has been going on, breathing signs (snoring with pauses or gasping), restless
  legs, and sleepiness while driving.
- **Notes raised by the check**, as care cards with the room's own levels: drowsy driving (today), breathing signs
  (prompt), restless legs with the iron question (prompt), persistent trouble with an effect on the day (prompt, with
  CBT-I named when it has lasted three months or more, and "you do not need to wait for it to last for months"
  otherwise), and an information line when she rarely has the chance to sleep (not insomnia).
- **Patterns, not scores**: in the journal (Sleep details, last four weeks), in the share and the PDF, and in the doctor
  view: nights recorded, nights with details, each field as "n of m" with its "not sure" count and the "over 30
  minutes" marker count, what woke her, and the last two checks with their notes.
- **Hearts**: a night with details earns the night's ten, as any night does; the check earns nothing.

## 2. Evidence ledger (primary pages opened 21 Oct 2026)

| Used for | Source | What it says (as used) |
|---|---|---|
| The morning items | Carney CE et al. The Consensus Sleep Diary. Sleep 2012. doi 10.5665/sleep.1642 (E73) | A standard morning diary: time to fall asleep, number and length of awakenings, final waking, quality; completed in the morning, within about an hour of rising. |
| Chronic insomnia, in words | Grima NA, Bei B, Mansfield D. Insomnia theory and assessment. AJGP April 2019 (E74) | ICSD-3: trouble falling asleep, staying asleep or waking early despite the chance to sleep, with a daytime effect, three or more nights a week for three months or more. |
| "Over 30 minutes" marker | Lichstein KL et al. Behav Res Ther 2003. doi 10.1016/S0005-7967(02)00023-2 (E79) | Quantitative research criteria: 31 minutes or more to fall asleep or awake in the night, three or more nights a week, for six months or more. Rhythme shows the marker count and says it is a research marker, not a diagnosis. |
| Breathing signs | NICE NG202, 2021, recommendations 1.1.1, 1.1.4, 1.2.2 (E75) | Assess for sleep apnoea when two or more of snoring, witnessed pauses or choking, unrefreshing sleep, sleepiness and others are present; refer for assessment. |
| Restless legs and iron | Winkelman JW et al. AASM clinical practice guideline, J Clin Sleep Med 2025. doi 10.5664/jcsm.11390 (E76) | Urge to move the legs at rest, eased by movement, worse in the evening; check iron (ferritin 75 or less, or transferrin saturation under 20 per cent, is the threshold for iron treatment); more common in women and in pregnancy. The guideline does not mention menstruation; Rhythme's wording about heavy periods is its own, offered as a reason to ask about iron. |
| Drowsy driving | Watson NF et al. AASM, J Clin Sleep Med 2015. doi 10.5664/jcsm.5200 (E77) | Drowsy driving is a serious public health concern; a sleepy driver should stop. Hence the "today" level for sleepiness while driving. |
| CBT-I first | Edinger JD et al. AASM, J Clin Sleep Med 2021. doi 10.5664/jcsm.8986 (E78) | Strong recommendation for multicomponent CBT-I for chronic insomnia in adults. |
| The three-month line | APA (DSM-5) and ICSD-3 via E74 | Three or more nights a week for three months. |
| Why not PROMIS | healthmeasures.net, updated 1 Oct 2026 | Commercial use of PROMIS measures carries a fee (USD 750 per measure for three years); Rhythme writes its own items instead. |

The evidence module (`ovu-evidence.js`) carries E73 to E79 with these URLs under the topics `sleep` and `sleepcheck`.

## 3. Rules kept

- No composite number anywhere; no "poor sleeper" label; no streak, no reminder to do the check.
- The check is one per day (`SINGLE_PER_DAY`), replaces the day's earlier answer, and refuses an empty answer set.
- Every care note comes from one answered question, not from a total.
- The two-week check is held on the phone until the server's type check accepts it (`ovu-sync.js` holds new types);
  migration `20261021090000_sleepcheck_entries.sql` adds `sleepcheck` to the entries type check and is applied only
  with Jamie's word.

## 4. Checks

`tools/test-core.js` (38 checks): cleaning of codes, one-a-day replacement, update refusal before any mutation,
denominators and the not-sure count, the newest answer winning in `nightDetails`, each note by its code, Luna's cards
(a 20-day-old check gives none), hearts (0 for the check, 10 for a night with details), `splitByType` holding the new
type, `cleanShare` against injected markup, and the share's HTML text. `tools/e2e_smoke.py` covers the sheets.
