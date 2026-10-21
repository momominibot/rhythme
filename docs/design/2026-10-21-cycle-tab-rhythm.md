# The Cycle tab comes back, with "Your cycle rhythm" (decision note, 21 Oct 2026)

Jamie, 21 Oct: "I think we add back the cycle tab, not everyone wants to play the game. I still want to put in cycle
wellness scoring on the tab. Discuss with codex how you want to present this & also calculate the scoring. We had some
deep analysis previously about this." He attached Ovuluna's "Your Cycle Wellness Score" screen: three cycles to build a
baseline (start logging, patterns emerge, score unlocked) and four cards (cycle regularity, cycle and period length,
ovulation confirmation, symptom burden).

The earlier analysis (`2026-10-18-cycle-wellness-score.md`, three reviewers, four persona walks, a jev comb of the
evidence register) found nothing that validates adding those measures into one number. Codex (gpt-6-astra, read-only,
with web search, 21 Oct; full text in `docs/debate/2026-10-21-cycle-tab-codex.md`) was asked to weigh three ways to
honour both the owner's wish and that finding. Its recommendation, adopted here:

## The decision: Option C

- **The only number is history, not health.** "Building your cycle picture: 1 of 3, 2 of 3, 3 of 3" counts completed
  cycles between confirmed period starts (three intervals need four starts; the fourth period need not have finished).
  It earns no hearts and has no deadline. Three cycles unlock an initial comparison, not certainty.
- **Four cards, each with its own level**, never a total: Cycle regularity; Cycle and bleeding length; Ovulation signs;
  Symptoms and comfort. Levels: "Nothing flagged in these entries", "A pattern worth noticing", "Worth a chat", with
  "Within the reference range in these records" reserved for a real reference comparison, and neutral states ("Not
  enough information for a pattern", "Building your picture") for missing data. Every product threshold wears a
  "Rhythme threshold" chip; every sourced one an E number.
- **Ovulation signs: not assessed.** Nothing the app logs today can tell whether she ovulated (no basal temperature,
  LH tests or mucus log; the calendar's phase and fertile colouring are assumptions and contribute nothing). An
  optional observation log (mucus, home LH tests) is a later decision; it would record signs, never confirm ovulation.
- **Care prompts never wait** for readiness or coverage. Urgent entries override every level.
- **Screen name**: "Your cycle rhythm", with "Building your cycle picture" above the readiness indicator. Not "score",
  not "unlocked".
- **Navigation**: Home · Cycle · Food · Mind · You. Cycle opens the diary directly (calendar first, a Rhythm check view
  beside it), reachable while the avatar sleeps or walks, with the last view remembered. After the menopause the same
  position reads **Body** and opens a symptom-first view; pregnancy and postpartum foreground wellbeing instead of a
  cycle count.

In two sentences, for Jamie: We can bring back Ovuluna's three-cycle journey and four cards, with the number showing how
much history Rhythme has rather than grading someone's health. Each card explains the recorded pattern, its evidence and
when support may help, without pretending those different things add up to a meaningful score out of 100.

## The calculations (proposed for clinical review, not yet validated)

Shared: observed, dated records, one contribution per calendar date; missing, explicitly absent and zero kept apart;
a rolling six-calendar-month window (FIGO 2023 explains the 2018 system over the preceding six months, pregnancy and
the puerperium excluded), its dates and the number of usable intervals shown; unconfirmed autofill, onboarding recall
alone and unresolved gaps never count as confirmed.

| Card | Calculation | Reference | Level rules |
|---|---|---|---|
| Cycle regularity | spread = longest minus shortest confirmed consecutive cycle (a range, not a variance) | FIGO 2018 (E7): at most 9 days at 18 to 25, 7 at 26 to 41, 9 at 42 to 45; less defined after 45 | under three intervals: Building your picture with the lengths; above the band's limit: Worth a chat; within: Within the reference range in these records. The intro's age choices straddle FIGO's bands (25 to 29), so an optional matching band is asked once; without it the spread is shown with no verdict |
| Cycle and bleeding length | each confirmed start-to-start interval against 24 to 38 days inclusive; each confirmed episode's duration (last confirmed bleeding day minus first plus one, spotting inside the episode included) against up to 8 days; never the average alone | FIGO 2018 (E7); NHS heavy periods (E4) keeps over seven days as a possible heavy-period sign | an interval outside the range or confirmed bleeding beyond eight days: Worth a chat, without waiting for readiness; unknown boundaries shown as "Bleeding recorded on 5 days across a 7-day span, two days unknown"; a gap over 60 days with unknown intervening periods: "Gap between records", excluded from readiness |
| Ovulation signs | none possible from current data | ASRM 2021 committee opinions | "Not assessed. Your current records cannot tell whether you ovulated." |
| Symptoms and comfort | last 14 calendar days: symptom days over days with a symptom answer or an explicit None; mean and maximum of recorded pain; low or bad mood days over answered mood days; each denominator shown | E8 (the scale, not the numbers), E9 | Worth a chat: a care flag, any pain of 8 or more, low or bad mood on five or more dates (three postpartum); A pattern worth noticing with at least seven answers: symptoms on more than half the answered days, mean pain 4 or more, low mood on three or more dates; Nothing flagged only when all three measures have seven or more answers; otherwise Not enough information |

Modes and stages: wide mode is uncertainty, never a penalty; pregnant or possibly pregnant suspends readiness,
predictions and ovulation and shows symptoms and care; postpartum with periods not back shows no countdown and no
absence penalty; returning cycles are recorded descriptively in a fresh context; perimenopause foregrounds bleeding
changes, symptoms and impact and never extends the 7 or 9 day limits beyond their scope; hormonal contraception, HRT
or fertility hormones show bleeding and symptoms with treatment context and no spontaneous-cycle grade; a recent loss
gets a recovery-aware descriptive view; after the menopause the Body view hides readiness and ovulation, and any
bleeding prompts assessment (NHS).

## Before release

Input integrity (the untouched pain slider that becomes zero; confirmed bleeding versus autofill; episode completeness;
context boundaries), calculation tests (four starts versus three intervals; the 7 and 9 day bands; 24, 38 and 8 day
boundaries; unknown age; gaps over 60 days; spotting; missing days; explicit None; duplicates; imports, edits,
deletions; no later-data leakage), safety tests in every mode with no history, consistency between the tab, the journal,
the four-week summary and the clinician report, evidence IDs appended never renumbered, clinician sign-off on every
threshold and wording, and the four persona walks plus a diary-only person who never enters the room.

## What Jamie decides

1. Home · Cycle · Food · Mind · You, calendar first, diary reachable regardless of game state, Body after the menopause.
2. "Your cycle rhythm" with readiness counts and the four cards, no wellness total.
3. The small data additions for honest comparisons: a matching age band, confirmed bleeding boundaries, context confirmation.
4. Whether an optional mucus and LH observation log joins the first release (recommendation: not yet).
5. Clinician approval and repeated persona walks before the levels go live.
