# Independent review: Ebb chat flows vs Ovumind

## 1. Features Ebb has that the app lacks

- **Conversational onboarding (1a, 1b).** Value: users can say "around 4 Oct I think" and change goals later. Clinical-safety risk: Ebb's 3 screens omit age band, pregnancy state, urgent-now screening, diagnoses, family history, height/weight. Replacing the current 17-step onboarding with this would miss high-risk users. Deterministic or LM: date parsing needs LM or fuzzy local parsing; clinical fields must stay structured.

- **One clarifying question (2b).** "Is this the start of your period, or spotting?" Value: prevents a wrong cycle start. Risk: if the user chooses "Just spotting" but it is breakthrough or pregnancy-related bleeding, predictions continue from the old start. Needs undo. Deterministic: the trigger can be a rule on "brown discharge" or "spotting"; no LM needed.

- **Correction and backfill (2c).** "Actually my period ended on Tuesday not Wednesday." Value: fixes wrong entries; the app has no edit, undo, or backfill. Risk: changing period dates alters cycleStats and flags silently. Every correction must be logged, reversible, and recalculated. Needs LM to parse corrections; updates are then deterministic.

- **Cycle-aware nudge (3a).** "Period likely to start in the next 2 to 5 days" with snooze and "Why am I seeing this?" Value: makes reminders relevant to the cycle. Risk: predictions from average length are uncalibrated; copy must say "estimate" and no nudge after 10 pm. Deterministic from cycleStats.

- **On-demand "why am I..." (3b).** Returns cycle day, phase, HRV by cycle day, breathing, note for doctor. Value: gives a reason for symptoms. Risk: phone-camera HRV is noisy; "Seen in 3 of 3 cycles" overstates. Deterministic from stored RMSSD/bpm and cycleStats; prose can be LM.

- **Chart view (3c).** Calendar, predicted period, symptom dots, cycle length last 6. Value: makes the local event store visible. Risk: none. Deterministic.

- **In-moment red flag (4a).** Heavy bleeding with dizziness triggers an alert at logging time. Value: the existing rule exists but only appears in summaries, not when the user logs. Risk: the threshold must be explicit and the advice must not overclaim clinician authorship. Deterministic rule.

- **One-page doctor report (4b).** PDF summary, flagged events, suggested questions. Value: useful for a gynae visit. Risk: if it replaces doctor.html, it loses raw entries and patient questions. Deterministic templates; questions can be LM.

- **Privacy controls in chat (4c).** Export, delete everything, research toggle. Value: direct user control. Risk: current copy overclaims backup and sync. Deterministic local commands.

## 2. What the app already does better and must not lose

- **Onboarding depth.** The 17-step flow includes age band, pregnancy state, urgent-now 995/KKH screen, diagnoses, family history, body signals, goals. Ebb's three screens are not a safe substitute.

- **Local-first privacy.** Data stays in the browser; no sync. Ebb's privacy copy implies cloud and encrypted backup that does not exist.

- **Rule agents as the source of flags.** Deterministic, auditable flags are safer than LM-generated alerts. Ebb's "written with clinicians" cannot replace this.

- **Doctor share.** Encrypted bundle with flags, patient questions, model summary, daily summaries, raw entries, print to PDF. Ebb's one-page PDF is thinner and could under-share.

- **Existing reminders and .ics export.** Stable, even if not cycle-aware. These should not be lost while adding nudges.

- **Camera pulse beta.** Labelled experimental, stored locally. It should stay labelled, not become Ebb's "stress and recovery" claim.

## 3. Overclaims and safety problems in Ebb copy

- **1c:** "A 60-second scan with your phone camera lets me read your heart-rate variability, stress and recovery. It helps me see where you are in your cycle." Replacement: "This experimental scan estimates heart rate and heart-rate variability. Readings are rough, not medical grade. I can show them next to your cycle day, but they do not determine your cycle phase."

- **4a:** "This advice was written with clinicians." Replacement: "This alert follows our heavy-bleeding safety rule, reviewed by local clinicians." For dizziness with heavy bleeding, "Please get checked today" is too slow. Replacement: "Call 995 or go to A&E now. Do not wait until you faint."

- **4c:** "An encrypted backup only you can unlock." Replacement: "Your data stays in this browser. There is no backup yet. If you clear browser data, it is gone. Use Export my data to keep a copy." Also "Keep chat history" is false: the app stores charted entries, not chat transcripts.

- **Prediction ranges:** 2a "inside the 31 Oct to 3 Nov range I predicted", 3a "likely to start in the next 2 to 5 days". Replacement: "My estimate, based only on your average cycle length: 31 Oct to 3 Nov. This is not a medical prediction." Do not say "likely" unless the range is calibrated on logged cycles.

## 4. Naming

**Stay Luna.** Luna is already the chat logger, so users do not need to learn a second persona. ERIN and Erin Lee already create naming density; adding Ebb makes it worse. "Ebb" also suggests withdrawal, not rhythm. Evolve Luna with Ebb's features rather than renaming. If a distinct voice is wanted, call it "Luna by ERIN".

## 5. Ranked top 10 changes

| # | Change | Size | Acceptance test |
|---|---|---|---|
| 1 | Show in-moment red flags for high-severity rules | M | Log "soaking through a pad every hour, dizzy" and receive an immediate "Call 995 or go to A&E now" alert; the entry is saved and appears in doctor share. |
| 2 | Add correction and undo for period and symptoms | L | Say "period ended Tuesday not Wednesday" after a prior entry; app shows updated period end and length with Undo; undo restores previous values and recalculates cycleStats. |
| 3 | Add clarifying question for spotting vs period start | S | Log "brown discharge"; app asks "Period started, Just spotting, Not sure"; choosing spotting saves spotting and does not reset cycle start. |
| 4 | Port 17-step clinical onboarding into chat without dropping fields | L | New user can complete age band, pregnancy state, urgent-now screen, diagnoses, family history in chat before first log; every current field is present. |
| 5 | Add cycle-aware nudge with snooze and why | S | On day 2 before earliest predicted start, one nudge appears before 10 pm; "Why" shows the rule basis; snooze suppresses for 24 hours. |
| 6 | Link experimental camera pulse to cycle day with disclaimers | S | After a scan, bpm/RMSSD appear on the current cycle day labelled "experimental"; no text says HRV determines phase. |
| 7 | Add on-demand "why" with deterministic basis | M | Ask "why am I so anxious?"; app returns cycle day, phase, and logged symptom/HRV averages, plus "I can't tell causes"; if no data, says not enough data. |
| 8 | Generate one-page doctor summary from existing doctor share | S | Button exports a print view with last 6 cycles, period length, pain, migraine, flagged events, and editable suggested questions. |
| 9 | Add privacy chat commands and truthful storage copy | S | "Export my data" downloads JSON; "delete everything" confirms and clears local event store; privacy screen says no cloud backup. |
| 10 | Add chart view in the app | M | Calendar shows cycle day, predicted window, period, symptom dots, last 6 cycle lengths, all from local events. |

## 6. What to reject or defer

- **Reject** replacing the 17-step onboarding with Ebb's 3-screen version.
- **Reject** "encrypted backup only you can unlock" until sync and encryption are actually implemented.
- **Reject** the "Contribute de-identified data to research" checkbox in onboarding. Research consent must be a separate, informed opt-in.
- **Defer** "Share predicted period with a partner" until there is a secure sharing mechanism; current doctor share is encrypted but not partner-facing.
- **Defer** HRV-based cycle phase prediction and any "stress and recovery" wording; keep camera pulse labelled experimental.
- **Defer** the "Keep chat history" toggle because the app does not retain chat, only typed entries.
- **Defer** adopting the Ebb name; use Luna.