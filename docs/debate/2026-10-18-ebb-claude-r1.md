# Claude round 1: independent read of "Ebb cycle chat flows" against Ovumind (2026-10-18)

Written before seeing Codex's review. Evidence: docs/dr-patrick-ebb-chat-flows-2026-10-18.md (12 screens) and the current code (room.js, ovu-orb.js, ovu-agents.js, ovu-store.js, ovu-remind.js, ovu-insight.js, journal.html, doctor.html, face-ppg.html, privacy.html).

## 1. What Ebb is

A chat-first cycle companion. Every interaction is a message plus a structured "I'll save this" card, with quick-reply chips, an Undo after each save, a cycle-day header on every screen ("Day 27 · Late luteal · Period likely in 1 to 4 days"), proactive cycle-aware nudges with a stated policy, an optional 60-second camera HRV scan, a one-page doctor summary with suggested questions, a red-flag interception, and a privacy card answerable in chat.

Ovumind already has the pieces underneath (local event log, rule agents, Luna confirm card, prediction modes, encrypted doctor share, PPG beta, reminders). What it lacks is the conversational glue Ebb shows: context after every save, clarifying questions, corrections, undo, cycle-aware nudges, and Luna answering "why" questions from the user's own data.

## 2. Screen by screen

### 1a to 1c Onboarding in chat
- Ebb: 3 steps. Last period with certainty ("around 4 Oct I think" becomes 4 Oct, Certainty Approximate), goals plus free text, hormonal contraception, then camera scan with two consent toggles (insights on by default, research off by default) and "camera video never uploaded".
- Ovumind: 17 chip steps in the room (room.js `ONB`), Codex-reviewed, covering age, menarche, pregnancy states, hormones, bleeding signs, urgent screen, diagnoses, family history, body signals, goals, habits, body, name. predictionMode normal/wide/suspended. Research consent is a jev decision (separate opt-in, 0.86) with no UI yet.
- Keep: the 17-step intake. Jamie asked for the crucial ovarian-health points and Ebb's 3 questions cannot replace them (no age, pregnancy state, postmenopausal bleeding, PCOS, family menopause age).
- Adopt: (a) a `certainty` field on the last-period answer and on period-start events (exact / approximate / unsure) that widens the prediction window; (b) chaptering the 17 steps into 3 chapters with "1 of 3" framing (About you, Your cycle, Your choices) so it feels like Ebb's three; (c) a free-text option on date and goals that Luna parses ("around 4 Oct"), chips stay the default; (d) the final chapter offers the calm check scan with the two toggles, worded honestly (see section 3).

### 2a Quick log with confirm card
- Ebb: one sentence becomes four fields (Period started, Flow, Cramps 5/10, Sleep Poor), then a contextual sentence from the user's own history ("inside the 31 Oct to 3 Nov range I predicted; the cycle that just ended was 27 days, within your usual 27 to 30") and follow-up chips.
- Ovumind: `openLuna` in room.js builds "Here is what I understood" with checkboxes and Save ticked / Discard; the reply is a random warm line (`ORB.reply`), no cycle context. `cycleStats` already has lengths, lastStart, cycleDay, phase, predictedNext (single date, not a range).
- Adopt: deterministic context line after save, built from `cycleStats`: cycle day and phase, whether a new period start fell inside the predicted range, last cycle length against the usual range (min to max of the last 6 lengths, or wider under predictionMode wide; nothing under suspended). Predicted range instead of a single date everywhere (deck, Luna, journal). Follow-up chips after a period save (Add a symptom, Took a painkiller, Done for today). Size M, fully deterministic.
- Gap: "slept badly" with no times. The rules need a quality-only sleep entry (bedTime and wakeTime null, quality 2). Size S.

### 2b One clarifying question
- Ebb asks "period or spotting?" and explains why it matters (it sets the next cycle start). Then Saved with Undo, and a pattern note "2 of your last 3 cycles".
- Ovumind: no clarifying questions; spotting is a flow value, so brown discharge gets saved as a period day and shifts the cycle start. This is a correctness bug, not just polish.
- Adopt: when parsed text contains spotting/discharge words without a clear "period started", Luna asks the one question with three chips and saves accordingly (spotting goes to the symptom list, not to period flow, unless the user picks period). Deterministic. Size S.
- Adopt: Undo on the save line (soft delete of the just-saved ids within the session). Size S.
- Adopt: per-symptom pattern across cycles ("spotting a day or two before a period in 2 of your last 3 cycles"): a new deterministic helper in ovu-agents.js that counts, for each completed cycle, whether a symptom occurred within a cycle-day window. Only speak when there are at least 3 completed cycles. Size M.

### 2c Correction and backfill
- Ebb: "actually my period ended on Tuesday" updates the existing entry with a strikethrough and Undo; "also had a migraine on day 2" lands on the correct date; a third-cycle pattern offers a reminder.
- Ovumind: the model schema (ovu-orb.js SYSTEM) only creates entries; there is no update or delete op, and the rules do not read "actually" or "day 2".
- Adopt: extend the schema with `{"op":"update"|"delete","match":{"type","date"},"set":{...}}` and a rule for "actually ... ended on <day>". "day 2" resolves against `cycleStats.lastStart`. Show the before and after on the card. Size M, needs the model for free wording, rules for the common forms.
- Add `migraine` to the symptom list and a `meds` entry type ({name, dose?, time}) so "took a painkiller" is recorded. Size S.

### 3a Timed nudge and check-in
- Ebb: a heads-up 2 days before the earliest likely start, with the user's own Day-1 cramp pattern; actions Remind me to pack supplies / Snooze / Why am I seeing this; policy "at most one nudge a day, never after 10 pm"; a 9 pm "Anything to note today?" with Bleeding / Symptoms / All good, and "All good" is logged as nothing to note.
- Ovumind: ovu-remind.js has fixed-time templates only. No cycle-aware reminder, no evening check-in, no explicit "nothing to note" record.
- Adopt: a `cycle` reminder kind computed from `cycleStats` (earliest predicted start minus N days, default 2), suppressed under predictionMode suspended, wider wording under wide; quiet hours after 22:00 and a one-nudge-a-day cap written into the code and shown in a "Why am I seeing this" line. An `evening` check-in reminder that opens Luna with the three chips; "All good" saves a `checkin` event {ok:true}, which the agents can count as a logged day. Deterministic. Size M.

### 3b Ask why, with Ebb HRV
- Ebb answers "why am I so anxious this week?" with cycle-day context, a general line, a chart of HRV by cycle day (this cycle versus the last 3), "about 12% below your follicular average, same dip as your last 3 cycles, seen in 3 of 3 cycles", and actions (3-minute breathing, Note for my doctor, Tell me more).
- Ovumind: Luna only logs. The PPG readings live in localStorage in face-ppg.html and never reach the event store, so nothing can relate them to cycle day. The insight agents already produce grounded prose with basis and limits.
- Adopt: Luna question mode. If the message is a question (why / is it normal / should I), answer with: cycle day and phase from the store, the deterministic pattern for the named symptom across cycles, one general education sentence from a vetted list, and chips (breathing session, add to my doctor questions, tell me more via the insight relay with the note only). Never diagnose, always "from your own log". Size M.
- Adopt: move PPG readings into the event store as type `ppg` {bpm, rmssd, calm, quality, method} and compute RMSSD by cycle phase only when at least 3 readings per phase exist across at least 3 cycles, always labelled as a noisy camera estimate. Size M.

### 3c Chart view
- Ebb: month calendar (period, predicted, symptom, today), cycle length of the last 6 against the usual range, body signals by phase, "Ask about your chart".
- Ovumind: journal.html has trends; cycle-trends.html is legacy. The data exists in `cycleStats`.
- Adopt: a cycle-length strip (last 6 with usual range) and a predicted range band on the calendar. Size S to M. The body-signals-by-phase chart waits for the `ppg` store work.

### 4a Red-flag alert
- Ebb: "soaking through a pad every hour since lunch, feeling a bit dizzy" triggers "Please get checked today", an escalation line ("If you faint, feel very weak or your heart is racing, call 995 now"), actions (Find nearest A&E or clinic, Call 995, Show my chart to the doctor), the disclaimer "I can't diagnose. This advice was written with clinicians", and follow-up chips (I'm getting help, It's easing now).
- Ovumind: ovu-agents.js already raises HEAVY_DIZZY as a high flag and POSTMENO_BLEED as high, but only when summaries run; Luna does not react at the moment of logging. `openUrgentCard` (995, KKH) exists for onboarding only.
- Adopt: real-time interception in Luna. After parsing, if the entries or the raw text match the high-level rules (heavy flow plus dizziness or faintness the same day, soaking hourly, sudden severe pelvic pain, bleeding in pregnancy, bleeding after menopause), show the urgent card inline before the confirm card, with Call 995, a maps link for the nearest A&E, KKH Urgent O&G Centre, and "Show my chart" (opens the Dr share). Still save the entries. Follow-up chips write a `checkin` note. Deterministic. Size M.
- Wording: Ovumind can only say "written with clinicians" after Dr Patrick signs the exact copy and thresholds. That is a concrete ask for him. The NHS heavy-bleeding guidance (soaking through a pad or tampon every hour for several hours, dizziness, fainting) supports the "today" urgency; the 995 line for fainting, weakness or racing heart is consistent with Singapore emergency guidance.

### 4b Doctor report
- Ebb: one-page summary of the last 6 cycles (cycle length range, typical period length, worst pain day, recurring migraine by cycle day, premenstrual mood window, flagged events), Download and Share, three suggested questions the user can edit, Add to calendar.
- Ovumind: doctor.html already renders flags, prepared questions, the written summary (rules plus model), daily summaries and raw entries from an encrypted share, with print to PDF. journal.html has "Questions you could ask" and the insight agent suggests questions.
- Adopt: a compact "Cycle summary · last 6 cycles" block at the top of doctor.html and in the journal share (deterministic from `cycleStats` and the new pattern helper), editable questions saved into the share, and an .ics for the appointment (ovu-remind.js already writes .ics). Size S to M.

### 4c Privacy and data control
- Ebb: "who can actually see my data?" answered in chat: only you, on this phone with an encrypted backup only you can unlock, camera video never leaves the phone, no ads, never sold; toggles for chat history, research contribution, partner sharing; Export and Delete everything; natural-language deletion.
- Ovumind: privacy.html is a long legacy page; the onboarding privacy step is honest; research consent UI does not exist yet; the Supabase sync plan is RLS, not end-to-end encrypted.
- Adopt: a privacy card Luna can answer (rules: "who can see", "delete", "forget"), with the true facts for this build: entries stay in this browser, Luna's relay forwards the note only, nothing is sold, no ads; Export and Delete link to the existing controls; "forget yesterday's log" deletes with confirmation. Research toggle off by default, shown here and at the end of onboarding, wired to the existing `research_consent` table only when sync ships. Size S.
- Decision needed: if the app ever says "encrypted backup only you can unlock", the sync must be end-to-end encrypted with a passphrase (ovu-store already has AES-GCM for shares). Otherwise the copy must say "backed up to your account" instead.

## 3. Overclaims in the Ebb copy

1. "A 60-second scan ... lets me read your heart-rate variability, stress and recovery. It helps me see where you are in your cycle, even on days you don't log anything." A 30 to 60 second camera reading gives a noisy RMSSD, and per-person cycle-phase detection from HRV is not validated. Honest wording: "a calm check: pulse and a rough variability number, kept as a wellness cue; over several cycles you may see your own pattern." Our face-ppg.html already carries that caution.
2. "This advice was written with clinicians." Only true after sign-off. Until then: "This advice follows NHS and Singapore emergency guidance; Ovumind cannot diagnose."
3. "Encrypted backup only you can unlock." Only true with client-side encryption.
4. "HRV about 12% below your follicular average, the same dip as your last 3 cycles." A fine example, but the app should only say it with at least 3 cycles of readings and should show the count ("seen in 3 of 3 cycles" is good practice; keep it).
5. "Right on time ... inside the range I predicted" assumes a range model. Ovumind predicts a single date today; build the range first.

## 4. Naming: Ebb or Luna

Keep Luna as the companion's name inside the room. Reasons: Luna is already shipped and visible (the moon orb, the night sky, the hotspot), the moon metaphor is the cycle metaphor, and the app already carries ERIN (brand) and Erin Lee (coach); adding a third name splits attention. "Ebb" is a strong word for the tide of a cycle; use it as the name of this feature set internally ("the Ebb flows") and, if Dr Patrick wants it public, as the name of the chat mode ("Luna, in Ebb mode") rather than a new character. This is Jamie's and Dr Patrick's call; the decision does not block any of the work above.

## 5. Ranked changes (my first pass)

1. Clarify period versus spotting (2b): S, deterministic. Fixes a cycle-start bug. Test: "brown discharge" never creates a period-flow day without the user choosing it.
2. Real-time red-flag interception in Luna (4a): M, deterministic. Test: "soaking through a pad every hour, dizzy" shows the urgent card before the confirm card, entries still saved, HEAVY_DIZZY flag raised the same day.
3. Context line after save plus predicted range (2a): M, deterministic. Test: a period start inside the range says so; a 27-day cycle against a 27 to 30 usual range is reported; nothing is said under predictionMode suspended.
4. Undo after save (2b, 2c): S. Test: Undo removes exactly the ids just saved and the deck re-renders.
5. Cycle heads-up nudge with policy and evening check-in (3a): M, deterministic. Test: no notification after 22:00, at most one per day, none under suspended, "All good" writes a checkin event.
6. Corrections and backfill ops (2c): M, model plus rules. Test: "actually my period ended on Tuesday" changes the period end and shows before and after with Undo.
7. Luna question mode grounded in own data (3b): M. Test: "why am I so anxious" returns cycle day, phase, the user's own pattern count, one education line, and three chips; never a diagnosis.
8. Pattern-across-cycles helper feeding 2b, 2c, 3b, 4b: M, deterministic. Test: counts match a hand check on fixture data; silent under 3 cycles.
9. Cycle summary block in doctor.html and the journal share, editable questions, .ics (4b): S to M.
10. PPG into the event store and RMSSD by phase with honest labels (3b, 3c): M.
11. Onboarding chaptering, certainty on last period, scan offer with two toggles at the end, privacy card in Luna (1a to 1c, 4c): S each.

## 6. Reject or defer

- Replacing the 17-step intake with Ebb's 3 questions: reject.
- Claiming cycle-phase detection from the scan: reject until validated.
- Partner sharing of the predicted period (4c toggle): defer; partner-code.html is legacy and the sync design is not settled.
- Chat history as the record of truth: reject; the event store stays the record, chat is a view.
