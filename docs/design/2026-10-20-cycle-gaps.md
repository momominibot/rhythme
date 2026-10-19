# Long gaps between logged periods are breaks, not cycles

20 October 2026. Product rule, not a clinically validated threshold.

## What went wrong

`cycleStats` (ovu-store.js) counted every gap between two logged period starts as a cycle. Reproduced on 19 October:
one period day imported from Apple Health in June 2025 plus a period logged yesterday made the calendar say "Next
period expected between Tue, Feb 29 and Sat, Mar 4 (estimate from 1 logged cycle)": a 501-day cycle, two years
out. Health import (PR #8) lets people bring in old history with a date range, so this now happens easily. The same
gap also reached the cycle agent as "Cycle of 501 days" and the clinician summary as a cycle length.

## The rule

1. **A gap of more than 60 days between two logged period starts is a break in the record, not a cycle.** It is left
   out of cycle lengths, the average, the observed window and the phase. 60 is the same upper bound the remembered
   periods use (`rhythmFromRecall`: a window needs gaps of 15 to 60 days).
2. **Predictions use only the cycles since the last break**, the same way a non-adjacent gap restarts the run of
   remembered gaps. After a long gap we cannot know what happened in it (no logging, pregnancy, hormones, a real
   pause), so cycles from before it do not set the next window. Without cycles since the break, the estimate falls
   back exactly as before: remembered dates when their window is valid, then a stated profile length, then nothing
   ("log another period to start predictions"). `predictionMode` is untouched: wide still widens, suspended still
   predicts nothing.
3. **Gaps of 39 to 60 days stay cycles.** Logged days are denser than remembered marks, so the 38-day adjacency rule
   for remembered dates (which exists because marks can be missing) is not applied here; the cycle agent keeps
   flagging these as long cycles against the FIGO 2018 range of 24 to 38 days, as it does today.
4. **Short gaps are unchanged.** Episodes still merge across up to two dry days, and a gap under 24 days still counts
   and is flagged as a short cycle; that is logged bleeding and the agent's job, not this fix.
5. **Say so, without guessing.** When the latest break changed the estimate (fewer than six cycles since it), the
   calendar and the window card add: "The 501-day gap before your period on 18 Oct is left out of the estimate. We
   can't tell whether periods in that time went unlogged." When cycles were logged before the gap, the first sentence
   adds "along with the cycles logged before it". It does not say what the estimate came from instead; the basis
   in brackets already does (Codex review: "only cycles since then count" was wrong when remembered dates supply
   the window).
6. **Keep the signal.** A break among the last three gaps raises an info note, `GAP_LONG`, in place of the old
   "Cycle of N days": "A gap of N days between logged periods. Left out of your cycle averages. If no period came in
   that time, a gap this long is worth mentioning to a clinician; if periods came but were not logged, you can
   ignore this." Info, like `PERIOD_LATE` (the same gap while it is still open), so it never lights the journal
   button for what may only be a logging gap. `PERIOD_LATE` keeps its old condition (two logged starts or more).

## Shape of `cycleStats`

- `cycles`: every start-to-start gap, `{ from, to, days, counted }`.
- `breaks`: the gaps over 60 days.
- `lengths`: counted cycle lengths since the last break (what the average, the window, the clinician summary's
  cycle lengths and the "N logged cycles" basis all use, so they agree with each other).
- `gapLeftOut`: the latest break (`from`, `to`, `days`, `cyclesBefore`) when it changed this estimate, else null.
- `basis` keeps its existing words, now in the same order as the average: two or more logged cycles, then
  remembered dates, then one logged cycle, then the profile setting. Before, one logged cycle plus valid remembered
  dates was averaged from the remembered dates but named "1 logged cycle" (found in review; older than this change,
  made more likely by it).

## Luna's written readings

A reading written before this change may describe the old numbers. `ovu-insight.js` now puts a rules version in the
signature it compares, so such a reading shows "Update" and regenerates when she asks. It is not hidden (that would
also drop two weeks of unaffected daily readings) and nothing calls the relay by itself. Four-week readings are kept
per day, so an old one is only ever today's.

## Checks

`tools/test-core.js`, block `cycleGapsAreBreaks`: the reproduced case gives no 500-day prediction and names the
gap; normal consecutive cycles give the same numbers as before; cycles after a break predict from those cycles only;
a profile length still predicts after a break; a 45-day cycle is still a cycle and still flagged long; the agent
says "gap" not "cycle" for the break; wide and suspended modes still behave; the 60-day cycle keeps its long-cycle note;
the gap note names the latest of several breaks and goes once six cycles follow it; remembered dates name themselves
in the basis; an old reading is stale but still readable.
