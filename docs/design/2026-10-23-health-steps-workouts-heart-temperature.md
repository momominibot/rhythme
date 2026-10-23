# Steps, workouts, resting heart rate and temperature from Health (23 Oct 2026)

Jamie asked which Apple Health data points Rhythme should collect, and whether steps belong in the app. The plan
he accepted, in order of value:

1. **Steps, synced only.** A daily total and the last 7 days, compared with her own usual. Nobody types steps in.
   No fixed 10,000 goal: in Paluch et al. 2022 (Lancet Public Health, 15 cohorts, 47,471 adults, PMID 35247352)
   the benefit levelled off at about 6,000 to 8,000 a day for adults 60 and over and 8,000 to 10,000 for younger
   adults. "Your usual" is the median of the 28 days before today, shown once there are 7 days.
2. **Workouts, synced.** Type, minutes and distance become ordinary Movement entries (`exercise`), so the WHO week
   and MET-minutes count them. Manual logging stays for people without a wearable. Counted once: at import, a day
   where she logged the same activity herself keeps hers; and `OvuExercise.week` leaves an imported workout out on
   a day she logs the same activity by hand afterwards. Pace picks the Compendium variant when distance and time are
   both recorded (walk, run, cycle); otherwise a middle variant, and the entry says the pace was not recorded. A
   strength day stays her own tick. Workout types with no Movement activity are listed, never guessed. Imports earn
   no hearts.
3. **Resting heart rate, one number a day.** Shown in the Cycle tab as this week against her usual (median of the
   28 days before). Shilaih et al. 2017 (Scientific Reports, 91 women, 274 cycles, PMID 28465583) found pulse during
   sleep 2.1 bpm higher in the fertile window and 3.8 bpm higher mid-luteal than during the period. Nothing is
   called stress: heart rate alone does not measure it.
4. **Temperature, where it exists.** Sleeping wrist temperature (Apple Watch Series 8 and later, Ultra) and basal
   body temperature, kept apart, in °C, shown as the last 3 days against her usual. Apple uses the post-ovulation
   rise for retrospective ovulation estimates (support.apple.com/en-us/120357); Rhythme does not predict anything
   from it.

HRV is left out for now. If added later it is a plain trend with no score (the 18 Oct no-composite-score decision).

## How it is built

- `ovu-health.js`: the Apple scanner reads StepCount, RestingHeartRate, AppleSleepingWristTemperature,
  BasalBodyTemperature and `<Workout>` (with `<WorkoutStatistics>` distance); the Takeout reader reads the daily
  step column and workout sessions. Steps from a phone and a watch for the same hour keep the larger count, then
  hours add up. New picker kinds: steps, workouts, restinghr, temperature (nothing ticked).
- `ovu-store.js`: new entry types `steps`, `restinghr`, `temperature`, one a day.
- `ovu-signals.js`: the pure maths and words (usual, recent, lines). Tested in `tools/test-core.js`.
- `room.js`: steps panel in Movement; Body signals in the Cycle tab; import cards; the iPhone read lists the new kinds.
- `journal.html`: the new kinds render, under their own "Steps and body" chip, kept out of All.
- `ios/App/App/RhythmeHealthPlugin.swift`: reads the new types (steps as Apple's own daily totals through a
  statistics query, so devices never double count); still never asks to write. Built for the simulator on 23 Oct.
  `Info.plist` says what is read.
- Health Connect (Android) keeps its three types until its Kotlin plugin learns the new ones; it is never asked for a
  type it would refuse.
- `supabase/migrations/20261023120000_health_signal_entries.sql`: lets the three new types sync. **Not applied.**
  Until it is, `ovu-sync.js` holds those rows on the phone, as it did for `exercise` and `sleepcheck`. The staff data
  contract names its own types, so none of the three reaches the dashboard.
